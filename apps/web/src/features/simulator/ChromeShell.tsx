import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import type { ReactNode } from 'react';

// ──────────────────────────────────────────────────────────────────────────
// ChromeShell — reference sim-shell layout.
//
//   ┌──────────────────────────────────────────────────────────────────────┐
//   │ .sim-band  (dark band — breadcrumb + progress)                       │
//   ├──────────┬────────────────────────────────────┬─────────────────────┤
//   │.sim-side │ .sim-main (children)               │ .sim-rail           │
//   │ CRM nav  │                                    │ steps + hint        │
//   ├──────────┴────────────────────────────────────┴─────────────────────┤
//   │ .sim-foot (run meta + back + hint)                                   │
//   └──────────────────────────────────────────────────────────────────────┘
// ──────────────────────────────────────────────────────────────────────────

export interface StepDef {
  id: string;
  titleKey: string;
}

interface ChromeShellProps {
  steps: StepDef[];
  currentStepId: string | null;
  completedStepIds: string[];
  /** Optional final score shown in the rail when present. */
  score?: number;
  /** Short run identifier, e.g. "SYN-849-2207". */
  runIdShort?: string;
  /** Mono breadcrumb, e.g. "ABC ▸ KYC ▸ Sanctions". */
  breadcrumb?: string;
  children: ReactNode;
  onOpenHint?: () => void;
}

const CRM_NAV = [
  { id: 'kyc', label: 'KYC', labelRu: 'Идентификация' },
  { id: 'open-account', label: 'Счёт', labelRu: 'Открыть счёт' },
  { id: 'deposit', label: 'Депозит', labelRu: 'Депозиты' },
  { id: 'transfer', label: 'Перевод', labelRu: 'Переводы' },
  { id: 'card', label: 'Карта', labelRu: 'Выпуск карты' },
];

const CRM_AUX = [
  { id: 'aml', label: 'AML' },
  { id: 'compliance', label: 'Комплаенс' },
];

function detectActiveNav(crumb: string): string {
  const lower = crumb.toLowerCase();
  if (lower.includes('kyc') || lower.includes('идентиф')) return 'kyc';
  if (lower.includes('open') || lower.includes('счёт') || lower.includes('schet')) return 'open-account';
  if (lower.includes('deposit') || lower.includes('депозит')) return 'deposit';
  if (lower.includes('transfer') || lower.includes('перевод')) return 'transfer';
  return 'kyc';
}

export function ChromeShell({
  steps,
  currentStepId,
  completedStepIds,
  score,
  runIdShort,
  breadcrumb,
  children,
  onOpenHint,
}: ChromeShellProps) {
  const { t } = useTranslation();

  const totalSteps = steps.length;
  const currentIdx = steps.findIndex((s) => s.id === currentStepId);
  const stepNumber = currentIdx === -1 ? completedStepIds.length : currentIdx + 1;
  const currentTitle =
    currentIdx >= 0 && steps[currentIdx] ? t(steps[currentIdx]!.titleKey) : '';
  const fullCrumb =
    breadcrumb ?? (currentTitle ? `ABC ▸ KYC ▸ ${currentTitle}` : 'ABC ▸ KYC');
  const activeNav = detectActiveNav(fullCrumb);

  const progressPct =
    totalSteps > 0
      ? Math.round((completedStepIds.length / totalSteps) * 100)
      : 0;

  return (
    <div className="sim-shell" style={{ height: '100vh' }}>
      {/* ── Dark band ──────────────────────────────────────────── */}
      <header className="sim-band">
        <div className="pip" aria-hidden="true" />
        <div className="crumbs-x">
          {fullCrumb.split('▸').map((part, i, arr) => (
            <span key={i}>
              {i < arr.length - 1 ? (
                <>
                  <span style={{ opacity: 0.5 }}>{part.trim()}</span>
                  <span style={{ opacity: 0.3, margin: '0 4px' }}>▸</span>
                </>
              ) : (
                <b>{part.trim()}</b>
              )}
            </span>
          ))}
        </div>

        <div className="scenario-progress">
          <span
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: 11,
              color: 'rgba(255,255,255,0.55)',
              letterSpacing: '0.04em',
            }}
          >
            {Math.max(stepNumber, 1)}/{totalSteps}
          </span>
          {score !== undefined && (
            <span
              style={{
                background: 'rgba(11,143,92,0.25)',
                color: '#6EFFC4',
                fontFamily: 'var(--font-mono)',
                fontSize: 11,
                padding: '3px 8px',
                borderRadius: 4,
                letterSpacing: '0.04em',
              }}
            >
              {t('sim.run.score')} {score}
            </span>
          )}
          <div className="bar">
            <i style={{ width: `${progressPct}%` }} />
          </div>
        </div>
      </header>

      {/* ── 3-column body ──────────────────────────────────────── */}
      <div className="sim-body">
        {/* Left: CRM nav */}
        <aside className="sim-side">
          <h4>{t('sim.kyc.header_label')}</h4>
          <nav>
            {CRM_NAV.map((item) => (
              <div
                key={item.id}
                className={`navx${item.id === activeNav ? ' active' : ''}`}
                data-clicky-target={`${item.id}, ${item.label.toLowerCase()}, ${item.labelRu.toLowerCase()}`}
                data-clicky-hint={`${item.labelRu} — bank operation section.`}
              >
                <CrmIcon id={item.id} />
                <span>{item.labelRu}</span>
              </div>
            ))}
          </nav>

          <h4 style={{ marginTop: 20 }}>Комплаенс</h4>
          <nav>
            {CRM_AUX.map((item) => (
              <div key={item.id} className="navx" style={{ opacity: 0.55 }}>
                <CrmIcon id={item.id} />
                <span>{item.label}</span>
              </div>
            ))}
          </nav>

          <div
            style={{
              marginTop: 'auto',
              paddingTop: 20,
            }}
          >
            {onOpenHint && (
              <button
                type="button"
                onClick={onOpenHint}
                data-clicky-target="hint, help, stuck, idea, tip, ai, clicky"
                data-clicky-hint="Open an AI hint for the current step."
                className="navx"
                style={{ width: '100%', background: 'var(--cobalt-tint)', color: 'var(--cobalt)' }}
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ width: 14, height: 14 }}>
                  <circle cx="12" cy="12" r="10" />
                  <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
                  <path d="M12 17h.01" />
                </svg>
                <span style={{ color: 'var(--cobalt)', fontWeight: 600 }}>
                  Спросить Клика <kbd style={{ fontFamily: 'var(--font-mono)', fontSize: 10, background: 'rgba(32,70,255,0.12)', borderRadius: 3, padding: '1px 4px' }}>`</kbd>
                </span>
              </button>
            )}
          </div>
        </aside>

        {/* Center: step content */}
        <main className="sim-main">
          {/* Mobile warning */}
          <div
            className="md:hidden"
            style={{
              background: 'var(--warn-tint)',
              border: '1px solid rgba(197,130,0,0.25)',
              borderRadius: 'var(--r-md)',
              padding: '10px 14px',
              fontSize: 12,
              color: 'var(--warn-ref)',
              marginBottom: 16,
            }}
          >
            {t('sim.best_on_desktop')}
          </div>
          {children}
        </main>

        {/* Right: steps rail */}
        <aside className="sim-rail">
          <div className="steps-panel">
            <h4>Шаги</h4>
            <ol style={{ listStyle: 'none', margin: 0, padding: 0 }}>
              {steps.map((step, idx) => {
                const isCompleted = completedStepIds.includes(step.id);
                const isCurrent = step.id === currentStepId;
                const stepClass = isCompleted ? 'done' : isCurrent ? 'active' : 'pending';
                const title = t(step.titleKey);
                return (
                  <li
                    key={step.id}
                    className={`step ${stepClass}`}
                    data-clicky-target={`${step.id}, ${title.toLowerCase()}, step ${idx + 1}, ${isCurrent ? 'current, here' : isCompleted ? 'done, completed' : 'next, upcoming'}`}
                    data-clicky-hint={
                      isCurrent
                        ? `You are on step ${idx + 1}: ${title}.`
                        : isCompleted
                          ? `Step ${idx + 1} (${title}) is done.`
                          : `Step ${idx + 1}: ${title}. Locked until previous step is done.`
                    }
                  >
                    <span className="marker" aria-hidden="true">
                      {isCompleted ? (
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" style={{ width: 10, height: 10 }}>
                          <path d="M20 6 9 17l-5-5" />
                        </svg>
                      ) : (
                        <span style={{ fontSize: 10, fontFamily: 'var(--font-mono)', fontWeight: 600 }}>
                          {idx + 1}
                        </span>
                      )}
                    </span>
                    <div>
                      <b>{title}</b>
                      <span>
                        {isCurrent
                          ? 'Текущий шаг'
                          : isCompleted
                            ? 'Выполнен'
                            : 'Ожидает'}
                      </span>
                    </div>
                  </li>
                );
              })}
            </ol>
          </div>

          <div className="hint-card">
            <h5>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ width: 12, height: 12 }}>
                <circle cx="12" cy="12" r="10" />
                <path d="M12 16v-4" />
                <path d="M12 8h.01" />
              </svg>
              Синтетические данные
            </h5>
            <p>{t('sim.kyc.banner_synthetic')}</p>
          </div>

          {runIdShort && (
            <div
              style={{
                padding: '12px 14px',
                background: 'var(--surface)',
                border: '1px solid var(--line)',
                borderRadius: 'var(--r-md)',
              }}
            >
              <div style={{ fontSize: 10, fontFamily: 'var(--font-mono)', letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--mute-2)', marginBottom: 4 }}>
                Сессия
              </div>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 13, color: 'var(--ink)', fontWeight: 500 }}>
                {runIdShort}
              </div>
            </div>
          )}
        </aside>
      </div>

      {/* ── Footer ──────────────────────────────────────────────── */}
      <footer className="sim-foot">
        <div className="left">
          <b>ABC · KYC</b> · <span style={{ fontFamily: 'var(--font-mono)' }}>{runIdShort ?? 'SYN-…'}</span>
        </div>
        <span className="synth-tag">СИНТЕТИЧЕСКИЕ ДАННЫЕ</span>
        <div className="spacer" />
        <Link
          to="/simulator"
          className="btn btn-ghost"
          data-clicky-target="back, exit, leave, home, dashboard, quit"
          data-clicky-hint="Leave the simulator and return to your dashboard. Your progress is saved."
        >
          ← {t('sim.back')}
        </Link>
        {onOpenHint && (
          <button
            type="button"
            onClick={onOpenHint}
            data-clicky-target="hint, help, stuck, idea, tip, ai"
            data-clicky-hint="Stuck? This button opens an AI hint scoped to your current step."
            className="btn btn-ghost"
            style={{ display: 'flex', alignItems: 'center', gap: 6 }}
          >
            {t('sim.run.hint')}
            <kbd style={{ fontFamily: 'var(--font-mono)', fontSize: 10, background: 'var(--surface-2)', border: '1px solid var(--line)', borderRadius: 3, padding: '1px 5px' }}>`</kbd>
          </button>
        )}
      </footer>
    </div>
  );
}

function CrmIcon({ id }: { id: string }) {
  if (id === 'kyc' || id === 'compliance') {
    return (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
        <polyline points="14 2 14 8 20 8" />
        <line x1="16" y1="13" x2="8" y2="13" />
        <line x1="16" y1="17" x2="8" y2="17" />
        <polyline points="10 9 9 9 8 9" />
      </svg>
    );
  }
  if (id === 'open-account') {
    return (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="2" y="5" width="20" height="14" rx="2" />
        <line x1="2" y1="10" x2="22" y2="10" />
      </svg>
    );
  }
  if (id === 'deposit') {
    return (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10" />
        <path d="M12 8v8" />
        <path d="M8 12h8" />
      </svg>
    );
  }
  if (id === 'transfer') {
    return (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="m17 4 4 4-4 4" />
        <path d="M3 8h18" />
        <path d="m7 20-4-4 4-4" />
        <path d="M21 16H3" />
      </svg>
    );
  }
  if (id === 'card') {
    return (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="2" y="5" width="20" height="14" rx="2" />
        <line x1="2" y1="10" x2="22" y2="10" />
        <path d="M6 15h2" />
      </svg>
    );
  }
  if (id === 'aml') {
    return (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
    </svg>
  );
}
