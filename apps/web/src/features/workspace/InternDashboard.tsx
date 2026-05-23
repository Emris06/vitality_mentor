import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../auth/AuthProvider';
import {
  DEFAULT_LOCALE,
  isLocale,
  type Locale,
  type ScenarioId,
} from '@vitality/shared';
import {
  gameApi,
  internApi,
  simApi,
  SimHttpError,
  type InternActivityEntry,
  type InternMe,
} from '../../lib/api';
import type { GameProfile } from '../game/types';
import { InternShell } from './InternShell';

// ──────────────────────────────────────────────────────────────────────────
// Intern dashboard — v4 (reference design).
//
// Layout matches reference/Mentora/screens/Dashboard.jsx exactly:
//   A. Hero grid (1.7fr | 1fr): quest card + 3 stat cards
//   B. Scenario grid: 4-column cards from LEARNING_PATH
//   C. Lower 2-col: activity feed | badges shelf
//   D. Cohort strip
// ──────────────────────────────────────────────────────────────────────────

interface PathStep {
  id: string;
  scenarioId: ScenarioId | null;
  titleKey: string;
  descKey: string;
  moduleKey: string;
  glyph: string;
  state: 'done' | 'current' | 'locked';
  estMins: number;
}

const LEARNING_PATH: readonly PathStep[] = [
  {
    id: 'orientation',
    scenarioId: null,
    titleKey: 'intern.dashboard.scenarios.item.orientation',
    descKey: 'intern.dashboard.scenarios.desc.orientation',
    moduleKey: 'intern.dashboard.scenarios.module.orientation',
    glyph: '🧭',
    state: 'done',
    estMins: 10,
  },
  {
    id: 'kyc',
    scenarioId: 'kyc',
    titleKey: 'intern.dashboard.scenarios.item.kyc',
    descKey: 'intern.dashboard.scenarios.desc.kyc',
    moduleKey: 'intern.dashboard.scenarios.module.retail_ops',
    glyph: '📋',
    state: 'current',
    estMins: 25,
  },
  {
    id: 'open-account',
    scenarioId: 'open-account',
    titleKey: 'intern.dashboard.scenarios.item.open_account',
    descKey: 'intern.dashboard.scenarios.desc.open_account',
    moduleKey: 'intern.dashboard.scenarios.module.retail_ops',
    glyph: '💳',
    state: 'locked',
    estMins: 20,
  },
  {
    id: 'transfer',
    scenarioId: 'transfer',
    titleKey: 'intern.dashboard.scenarios.item.transfer',
    descKey: 'intern.dashboard.scenarios.desc.transfer',
    moduleKey: 'intern.dashboard.scenarios.module.payments',
    glyph: '↔',
    state: 'locked',
    estMins: 30,
  },
];

const XP_PER_LEVEL = 600;
const STREAK_CONSISTENT = 5;
const STUB_DEADLINE = '2026-08-31';

const BADGE_DEFS = [
  { id: 'first_kyc', emoji: '🏅', label: 'Первый KYC', glyphClass: 'gold', earned: false },
  { id: 'kyc_perfectionist', emoji: '🎯', label: 'Перфекционист', glyphClass: 'cobalt', earned: false },
  { id: 'streak_7', emoji: '🔥', label: '7-дневная серия', glyphClass: 'rose', earned: false },
  { id: 'night_owl', emoji: '🦉', label: 'Ночная сова', glyphClass: 'lilac', earned: false },
  { id: 'polyglot', emoji: '🌐', label: 'Полиглот', glyphClass: 'teal', earned: false },
  { id: 'fast_learner', emoji: '⚡', label: 'Быстрый ученик', glyphClass: 'gold', earned: false },
];

const SEED_ACTIVITY = [
  { id: 'a1', dot: 'cobalt', text: <><b>Оскар Холлоуэй</b> оставил комментарий к вашему <b>KYC</b></>, when: '10 мин' },
  { id: 'a2', dot: 'green', text: <><b>Клики</b> указал на подсказку по проверке санкций</>, when: '25 мин' },
  { id: 'a3', dot: 'warm', text: <><b>Дилшода К.</b> завершила модуль открытия счёта</>, when: '1 ч' },
  { id: 'a4', dot: 'mute', text: <><b>HR (Нилуфар)</b> назначила вас в когорту Туронбанк</>, when: '2 ч' },
];

const SEED_COHORT = [
  { initials: 'ДК', name: 'Дилшода', level: 5, cls: 'teal' },
  { initials: 'АТ', name: 'Азиз', level: 3, cls: '' },
  { initials: 'ЖК', name: 'Жасур', level: 4, cls: 'teal' },
  { initials: 'ЗН', name: 'Зарина', level: 4, cls: 'lilac' },
];

export function InternDashboard() {
  const { t, i18n } = useTranslation();
  const { profile } = useAuth();
  const navigate = useNavigate();
  const [starting, setStarting] = useState(false);
  const [startError, setStartError] = useState<string | null>(null);
  const [game, setGame] = useState<GameProfile | null>(null);
  const [gameLoading, setGameLoading] = useState(true);
  const [internData, setInternData] = useState<InternMe | null>(null);
  const [activityData, setActivityData] = useState<InternActivityEntry[] | null>(null);

  const locale: Locale = useMemo(() => {
    const r = i18n.resolvedLanguage ?? DEFAULT_LOCALE;
    return isLocale(r) ? r : DEFAULT_LOCALE;
  }, [i18n.resolvedLanguage]);

  const internName = profile?.fullName ?? 'Стажёр';
  const firstName = internName.split(/\s+/)[0] ?? internName;
  const current = LEARNING_PATH.find((s) => s.state === 'current') ?? null;
  const doneCount = LEARNING_PATH.filter((s) => s.state === 'done').length;

  useEffect(() => {
    let cancelled = false;
    setGameLoading(true);
    void (async () => {
      const [gr, ir, ar] = await Promise.allSettled([
        gameApi.me<GameProfile>(),
        internApi.me(),
        internApi.activity(),
      ]);
      if (cancelled) return;
      if (gr.status === 'fulfilled') setGame(gr.value);
      if (ir.status === 'fulfilled') setInternData(ir.value);
      if (ar.status === 'fulfilled') setActivityData(ar.value);
      setGameLoading(false);
    })();
    return () => { cancelled = true; };
  }, []);

  async function startScenario(scenarioId: ScenarioId | null) {
    if (!scenarioId) return;
    setStarting(true);
    setStartError(null);
    try {
      const run = await simApi.startRun(scenarioId, locale);
      navigate(scenarioId === 'kyc' ? `/simulator/kyc/${run.id}` : '/simulator');
    } catch (err) {
      setStartError(err instanceof SimHttpError ? err.message : t('sim.run.load_error'));
      setStarting(false);
    }
  }

  // Derive stats from game profile
  const totalXp = game
    ? Object.values(game.xpBySkill).reduce((a, b) => a + (Number.isFinite(b) ? b : 0), 0)
    : 0;
  const level = Math.floor(totalXp / XP_PER_LEVEL) + 1;
  const xpInLevel = totalXp % XP_PER_LEVEL;
  const levelPct = (xpInLevel / XP_PER_LEVEL) * 100;
  const streakDays = game?.streak.current ?? 0;
  const badgesEarned = game?.badges ?? [];

  const deadlineDate = new Date(game?.onboardingDeadline ?? STUB_DEADLINE);
  const daysLeft = Math.max(0, Math.ceil((deadlineDate.getTime() - Date.now()) / 86_400_000));

  const dateRange = useMemo(() => formatDateRange(locale), [locale]);
  const currentTitle = current ? t(current.titleKey) : '';

  // Map earned badges onto BADGE_DEFS
  const badgeDefs = BADGE_DEFS.map((b) => ({
    ...b,
    earned: badgesEarned.some((eb) => eb.id === b.id),
  }));

  return (
    <InternShell
      userName={internName}
      userRole={t('auth.role_intern_name')}
      greeting={t('intern.shell.greeting', { name: firstName })}
      pageTitle={t('intern.shell.page_title')}
      dateRange={dateRange}
      currentScenarioCta={
        current?.scenarioId
          ? {
              label: starting ? t('intern.dashboard.starting') : t('intern.dashboard.continue_cta', { title: currentTitle }),
              onClick: () => void startScenario(current.scenarioId),
              disabled: starting,
              clickyTarget: 'start, continue, begin, kyc, scenario, current, simulator',
              clickyHint: `Launches "${currentTitle}" simulator.`,
            }
          : undefined
      }
    >
      {startError && (
        <div role="alert" style={{ padding: '12px 16px', marginBottom: '18px', background: 'var(--bad-tint)', border: '1px solid var(--bad)', borderRadius: 'var(--r-md)', fontSize: '13px', color: 'var(--bad)' }}>
          {startError}
        </div>
      )}

      {/* ── A. Hero grid ── */}
      <div className="dash-hero">

        {/* Quest card */}
        <div
          className="quest"
          data-clicky-target="quest, today, mission, start, continue, kyc"
          data-clicky-hint="Your quest for today. Press Start when ready."
          id="todays-quest"
        >
          <span className="quest-mark">КВЕСТ · ДЕНЬ-{String(doneCount + 1).padStart(2, '0')}</span>
          <h2>
            {currentTitle
              ? <><em>{currentTitle}</em> — применяй на практике</>
              : <>Все квесты <em>завершены!</em></>}
          </h2>
          <div className="quest-meta">
            <span>+50 <b>XP</b></span>
            <span>{current?.estMins ?? 0} мин</span>
            <span>{doneCount}/{LEARNING_PATH.length} шагов</span>
          </div>
          {current?.scenarioId && (
            <div className="quest-actions">
              <button
                className="btn btn-light-on-cobalt"
                onClick={() => void startScenario(current.scenarioId)}
                disabled={starting}
                data-clicky-target="start, begin, launch, scenario"
                data-clicky-hint="Start the scenario."
              >
                {starting ? 'Запуск…' : 'Начать →'}
              </button>
              <Link to="/simulator" className="btn btn-ghost-on-cobalt" style={{ display: 'inline-flex', alignItems: 'center' }}>
                Открыть каталог
              </Link>
            </div>
          )}
        </div>

        {/* 3 stat cards stacked */}
        <div className="stats">
          {/* Level + XP */}
          <div
            className="stat"
            data-clicky-target="level, xp, points, rank"
            data-clicky-hint={t('clicky.hint.stats.level')}
          >
            <div className="stat-icon">
              <span style={{ fontSize: '14px' }}>✦</span>
            </div>
            <div>
              <div className="stat-value">
                {gameLoading ? '—' : level}
                <small>ур.</small>
              </div>
              <div className="stat-label">
                {gameLoading ? '…' : `${xpInLevel} / ${XP_PER_LEVEL} XP`}
              </div>
              {!gameLoading && (
                <div style={{ marginTop: '6px', height: '3px', background: 'var(--cobalt-tint)', borderRadius: '2px', overflow: 'hidden' }}>
                  <div style={{ width: `${levelPct}%`, height: '100%', background: 'var(--cobalt)', borderRadius: '2px', transition: 'width 0.6s ease' }} />
                </div>
              )}
            </div>
          </div>

          {/* Streak */}
          <div
            className="stat"
            data-clicky-target="streak, days, consistency, fire"
            data-clicky-hint={t('clicky.hint.stats.streak')}
          >
            <div className="stat-icon warm">🔥</div>
            <div>
              <div className="stat-value">
                {gameLoading ? '—' : streakDays}
                <small>дн.</small>
              </div>
              <div className="stat-label">Серия</div>
              {!gameLoading && (
                <div className="streak-dots" style={{ marginTop: '4px' }}>
                  {Array.from({ length: 7 }).map((_, i) => (
                    <i key={i} className={i < streakDays ? '' : 'miss'} />
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Deadline */}
          <div
            className="stat"
            data-clicky-target="onboarding, deadline, days left, timer, countdown"
            data-clicky-hint={t('clicky.hint.stats.onboarding')}
          >
            <div className="stat-icon green">⌛</div>
            <div>
              <div className="stat-value">
                {gameLoading ? '—' : daysLeft}
                <small>дн.</small>
              </div>
              <div className="stat-label">До дедлайна</div>
            </div>
          </div>
        </div>
      </div>

      {/* ── B. Scenario grid ── */}
      <div>
        <div className="section-head">
          <div>
            <p className="h-eyebrow" style={{ marginBottom: '4px' }}>
              {t('intern.dashboard.scenarios.section_label')}
            </p>
            <p className="h2">{t('intern.dashboard.scenarios.section_title')}</p>
          </div>
          <Link
            to="/simulator"
            style={{ fontSize: '12.5px', color: 'var(--mute)', transition: 'color 0.15s' }}
            onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--cobalt)')}
            onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--mute)')}
            data-clicky-target="all, scenarios, browse, catalog, simulator"
            data-clicky-hint="Browse every scenario in the catalog."
          >
            Все сценарии →
          </Link>
        </div>

        <div className="scenarios">
          {LEARNING_PATH.map((step) => {
            const locked = step.state === 'locked';
            const done = step.state === 'done';
            const active = step.state === 'current';
            const title = t(step.titleKey);
            const desc = (() => {
              try { return t(step.descKey); } catch { return ''; }
            })();
            return (
              <button
                key={step.id}
                type="button"
                className={`scenario${locked ? ' locked' : ''}`}
                onClick={() => !locked && step.scenarioId && void startScenario(step.scenarioId)}
                disabled={locked || !step.scenarioId}
                data-clicky-target={`${step.id}, ${title.toLowerCase()}, scenario, ${step.state}`}
                data-clicky-hint={locked ? `"${title}" заблокирован.` : `Начать "${title}".`}
                style={{
                  textAlign: 'left',
                  borderColor: active ? 'var(--cobalt-glow)' : undefined,
                  background: active ? 'var(--cobalt-50)' : undefined,
                }}
              >
                <div className="scenario-glyph" style={{ fontSize: '16px' }}>{step.glyph}</div>
                <div>
                  <div className="scenario-name">{title}</div>
                  {desc && <div className="scenario-desc">{desc}</div>}
                </div>
                <div className="scenario-foot">
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--mute)' }}>
                    {step.estMins} мин
                  </span>
                  {done && <span className="score-pill">✓</span>}
                  {active && <span className="new-pill">NOW</span>}
                  {locked && <span style={{ padding: '3px 6px', background: 'var(--surface-2)', color: 'var(--mute-2)', borderRadius: '4px', fontSize: '11px' }}>🔒</span>}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* ── C. Lower 2-column ── */}
      <div className="dash-low">

        {/* Activity feed */}
        <div className="card">
          <div className="card-pad" style={{ borderBottom: '1px solid var(--line)', paddingBottom: '14px' }}>
            <p className="h2">Активность</p>
          </div>
          <div style={{ padding: '0 20px' }}>
            {SEED_ACTIVITY.map((entry) => (
              <div key={entry.id} className="activity-row">
                <span className={`dot ${entry.dot}`} />
                <span style={{ fontSize: '13px' }}>{entry.text}</span>
                <span className="when">{entry.when}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Badges shelf */}
        <div className="card">
          <div className="card-pad" style={{ borderBottom: '1px solid var(--line)', paddingBottom: '14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <p className="h2">Значки</p>
            <Link to="/me" style={{ fontSize: '12px', color: 'var(--mute)' }}>Все →</Link>
          </div>
          <div className="badges-shelf"
            data-clicky-target="badges, achievements, trophy, awards"
            data-clicky-hint={t('clicky.hint.stats.badges')}
          >
            {badgeDefs.map((b) => (
              <div key={b.id} className={`badge${!b.earned ? ' locked' : ''}`}>
                <div className={`badge-glyph ${b.glyphClass}`}>{b.emoji}</div>
                <b style={{ fontSize: '11px' }}>{b.label}</b>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── D. Cohort strip ── */}
      <div className="cohort" style={{ marginTop: '18px' }}
        data-clicky-target="cohort, peers, interns, team, colleagues"
        data-clicky-hint="Your cohort — fellow interns going through onboarding with you."
      >
        <div className="stack">
          {(internData?.cohort.length
            ? internData.cohort.slice(0, 5).map((m, i) => ({
                initials: m.initials,
                cls: (['teal', '', 'teal', 'lilac', 'rose'] as const)[i % 5],
              }))
            : SEED_COHORT
          ).map((c, i) => (
            <div
              key={i}
              className={`avatar${c.cls ? ` ${c.cls}` : ''}`}
              style={{ width: '28px', height: '28px', fontSize: '10px', fontWeight: 600 }}
            >
              {c.initials}
            </div>
          ))}
        </div>
        <small style={{ color: 'var(--mute)', fontSize: '12.5px' }}>
          {internData ? `${internData.cohort.length} стажёров в когорте` : `${SEED_COHORT.length} стажёров`}
        </small>
        <button
          type="button"
          className="btn btn-ghost"
          style={{ marginLeft: 'auto', height: '30px', fontSize: '12px' }}
          data-clicky-target="mentor, ask, help, question, chat"
          data-clicky-hint="Send a message to your assigned mentor."
        >
          Спросить наставника
        </button>
      </div>
    </InternShell>
  );
}

// ── Date helpers ──────────────────────────────────────────────────────────

function localeToBcp47(l: Locale): string {
  return l === 'uz' ? 'uz-UZ' : l === 'ru' ? 'ru-RU' : 'en-US';
}

function formatDateRange(locale: Locale): string {
  const today = new Date();
  const start = new Date(today);
  start.setDate(today.getDate() - 4);
  const fmt = (d: Date, full?: boolean) =>
    new Intl.DateTimeFormat(localeToBcp47(locale), {
      month: 'short',
      day: 'numeric',
      ...(full ? { year: 'numeric' } : {}),
    }).format(d);
  return `${fmt(start)} — ${fmt(today, true)}`;
}
