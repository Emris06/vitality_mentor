import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import Anthropic from '@anthropic-ai/sdk';
import { request as undiciRequest } from 'undici';
import { config } from '../config';

// ──────────────────────────────────────────────────────────────────────────
// Clicky intent endpoint.
//
// Input  : transcript + visible page targets (collected client-side from
//          [data-clicky-target] elements) + optional page context.
// Output : { action: 'point' | 'explain', uid: string | null, spoken: string }
//
// Brain  : Claude Haiku 4.5 — picked because the project already enforces a
//          ≤2 s chat budget, and Haiku is the only Claude family that
//          consistently finishes a short JSON response well under that.
//          Override with CLICKY_MODEL env var.
//
// Fallback: if ANTHROPIC_API_KEY is missing OR the LLM call errors / times
//           out, we run a tiny keyword matcher in-process so the demo never
//           hangs. The frontend cannot tell the difference.
// ──────────────────────────────────────────────────────────────────────────

const targetSchema = z.object({
  uid: z.string().min(1).max(64),
  label: z.string().max(120).default(''),
  keywords: z.array(z.string().max(40)).max(24).default([]),
  hint: z.string().max(280).nullable().default(null),
});

const intentRequestSchema = z.object({
  transcript: z.string().min(1).max(500),
  locale: z.enum(['uz', 'ru', 'en']).default('en'),
  page: z.string().max(120).optional(),
  scenarioId: z.string().max(32).optional(),
  stepId: z.string().max(64).optional(),
  targets: z.array(targetSchema).min(0).max(60),
});

const explainRequestSchema = z.object({
  transcript: z.string().min(1).max(500),
  locale: z.enum(['uz', 'ru', 'en']).default('en'),
  scenarioId: z.string().max(32).optional(),
  stepId: z.string().max(64).optional(),
});

type IntentRequest = z.infer<typeof intentRequestSchema>;
type Target = z.infer<typeof targetSchema>;

interface IntentResponse {
  action: 'point' | 'explain';
  uid: string | null;
  spoken: string;
  source: 'llm' | 'fallback';
}

const SYSTEM_PROMPT = `You are Clicky, a voice cursor that helps a banking intern learn by pointing at on-screen controls.

Each request gives you:
- the intern's spoken question (UZ, RU, or EN)
- a JSON array of visible page targets, each with uid, label, keywords, and optional hint
- the intern's current page (optional)

Reply with strict JSON, no prose:
{ "action": "point", "uid": "<one of the provided uids>", "spoken": "<one short sentence>" }
or
{ "action": "explain", "uid": null, "spoken": "<one short sentence>" }

Rules:
1. Prefer "point" over "explain" whenever a target plausibly answers the question. Pointing is what makes Clicky feel alive.
2. \`spoken\` must be ≤ 2 short sentences and in the SAME language the intern just spoke.
3. You are inside a synthetic-data training simulator. Never reference real customers, real accounts, or production systems. If the intern asks for sensitive operations on real data, refuse briefly and redirect them to the simulator.
4. Stay grounded in the targets provided. Do not invent buttons, menus, or step names that aren't in the list.
5. Keep the tone warm but quick — the intern is mid-task, not mid-conversation.
6. If no target matches, use "explain" with a one-sentence answer or a redirection.`;

const INTENT_SCHEMA = {
  type: 'object',
  properties: {
    action: { type: 'string', enum: ['point', 'explain'] },
    uid: { type: ['string', 'null'] },
    spoken: { type: 'string' },
  },
  required: ['action', 'uid', 'spoken'],
  additionalProperties: false,
} as const;

let _client: Anthropic | null = null;
function getClient(): Anthropic | null {
  if (!config.ANTHROPIC_API_KEY) return null;
  if (!_client) _client = new Anthropic({ apiKey: config.ANTHROPIC_API_KEY });
  return _client;
}

export async function clickyRoutes(app: FastifyInstance): Promise<void> {
  app.post('/clicky/explain', async (req, reply) => {
    const parsed = explainRequestSchema.safeParse(req.body);
    if (!parsed.success) {
      reply.code(400);
      return { error: 'invalid_request', detail: parsed.error.flatten() };
    }
    try {
      const upstream = await undiciRequest(`${config.AI_SERVICE_URL}/clicky/explain`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(parsed.data),
        bodyTimeout: 8_000,
        headersTimeout: 8_000,
      });
      if (upstream.statusCode >= 400) {
        reply.code(502);
        return { error: 'ai_error' };
      }
      return JSON.parse(await upstream.body.text());
    } catch (err) {
      req.log.warn({ err }, 'clicky explain proxy failed');
      reply.code(502);
      return { error: 'ai_unreachable' };
    }
  });

  app.post('/clicky/intent', async (req, reply) => {
    const parsed = intentRequestSchema.safeParse(req.body);
    if (!parsed.success) {
      reply.code(400);
      return { error: 'invalid_request', detail: parsed.error.flatten() };
    }
    const body = parsed.data;

    // Always have a deterministic answer ready — used both as the no-API-key
    // path and as the timeout/error fallback.
    const fallback = runLocalAgent(body);

    const client = getClient();
    if (!client) {
      return { ...fallback, source: 'fallback' } satisfies IntentResponse;
    }

    try {
      const userMessage = JSON.stringify({
        transcript: body.transcript,
        locale: body.locale,
        page: body.page ?? null,
        targets: body.targets.map((t) => ({
          uid: t.uid,
          label: t.label,
          keywords: t.keywords,
          hint: t.hint,
        })),
      });

      const message = await client.messages.create(
        {
          model: config.CLICKY_MODEL,
          max_tokens: 256,
          system: SYSTEM_PROMPT,
          messages: [{ role: 'user', content: userMessage }],
          output_config: { format: { type: 'json_schema', schema: INTENT_SCHEMA } },
        },
        { signal: AbortSignal.timeout(config.CLICKY_TIMEOUT_MS) },
      );

      const text = message.content
        .filter((b): b is Anthropic.TextBlock => b.type === 'text')
        .map((b) => b.text)
        .join('')
        .trim();

      const raw = JSON.parse(text) as unknown;
      const action = validateAction(raw, body.targets);
      return { ...action, source: 'llm' } satisfies IntentResponse;
    } catch (err) {
      // Typed exceptions per @anthropic-ai/sdk — we log them but always
      // return a usable answer to the frontend.
      if (err instanceof Anthropic.RateLimitError) {
        req.log.warn({ err }, 'clicky: anthropic rate limited');
      } else if (err instanceof Anthropic.APIError) {
        req.log.warn({ err, status: err.status }, 'clicky: anthropic api error');
      } else {
        req.log.warn({ err }, 'clicky: agent call failed, falling back');
      }
      return { ...fallback, source: 'fallback' } satisfies IntentResponse;
    }
  });
}

// ── Fallback agent (same shape as the LLM response) ──────────────────────
const STOPWORDS = new Set([
  'a', 'an', 'the', 'is', 'it', 'to', 'do', 'i', 'me', 'my', 'how', 'what',
  'where', 'should', 'can', 'this', 'that', 'please', 'ok', 'okay',
]);

function tokens(s: string): string[] {
  return s
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .split(/\s+/)
    .filter((t) => t.length > 1 && !STOPWORDS.has(t));
}

function scoreTarget(qTokens: string[], target: Target): number {
  const labelTokens = new Set(tokens(target.label));
  let score = 0;
  for (const t of qTokens) {
    if (target.keywords.includes(t)) score += 3;
    else if (labelTokens.has(t)) score += 1;
  }
  return score;
}

function runLocalAgent(body: IntentRequest): { action: 'point' | 'explain'; uid: string | null; spoken: string } {
  const qTokens = tokens(body.transcript);
  let best: Target | null = null;
  let bestScore = 0;
  for (const t of body.targets) {
    const s = scoreTarget(qTokens, t);
    if (s > bestScore) {
      bestScore = s;
      best = t;
    }
  }
  if (best && bestScore > 0) {
    return {
      action: 'point',
      uid: best.uid,
      spoken: best.hint ?? `Here — ${best.label}.`,
    };
  }
  return {
    action: 'explain',
    uid: null,
    spoken: 'I am not sure what to point at. Try naming a button on screen.',
  };
}

function validateAction(
  raw: unknown,
  targets: Target[],
): { action: 'point' | 'explain'; uid: string | null; spoken: string } {
  if (!raw || typeof raw !== 'object') throw new Error('agent returned non-object');
  const obj = raw as Record<string, unknown>;
  const action = obj.action === 'point' ? 'point' : 'explain';
  const spoken = typeof obj.spoken === 'string' ? obj.spoken.slice(0, 280) : '';
  if (!spoken) throw new Error('agent returned empty spoken');
  if (action === 'point') {
    const uid = typeof obj.uid === 'string' ? obj.uid : null;
    if (!uid || !targets.some((t) => t.uid === uid)) {
      // Model hallucinated a uid — downgrade to explain rather than send the
      // client on a wild goose chase.
      return { action: 'explain', uid: null, spoken };
    }
    return { action: 'point', uid, spoken };
  }
  return { action: 'explain', uid: null, spoken };
}
