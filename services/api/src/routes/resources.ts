import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { sql } from '../plugins/db';

// ──────────────────────────────────────────────────────────────────────────
// Resources API surface.
//
// Serves rows from the `resources` table — training docs, SOPs, guides, and
// checklists. No auth check on the list endpoint; titles + descriptions are
// i18n keys so no sensitive data leaks. The actual document content is out
// of scope for this phase (the "Open" button is disabled in the UI).
// ──────────────────────────────────────────────────────────────────────────

interface ResourceRow {
  id: string;
  title_key: string;
  desc_key: string;
  category: string;
  doc_type: string;
}

export async function resourcesRoutes(app: FastifyInstance): Promise<void> {
  // GET /resources -----------------------------------------------------------
  app.get('/', async (req: FastifyRequest, reply: FastifyReply) => {
    const { category } = req.query as { category?: string };

    let rows: ResourceRow[];
    if (category) {
      rows = await sql<ResourceRow[]>`
        SELECT id, title_key, desc_key, category, doc_type
        FROM resources
        WHERE is_published = true
          AND category = ${category}
        ORDER BY category, title_key
      `;
    } else {
      rows = await sql<ResourceRow[]>`
        SELECT id, title_key, desc_key, category, doc_type
        FROM resources
        WHERE is_published = true
        ORDER BY category, title_key
      `;
    }

    return reply.send(rows.map((r) => ({
      id: r.id,
      titleKey: r.title_key,
      descKey: r.desc_key,
      category: r.category,
      docType: r.doc_type,
    })));
  });
}
