import { Suspense, lazy, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import { LocalePicker } from '../../components/LocalePicker';
import { BankIllustration } from '../../components/ui/IllustrationGreeting';
import { MentoraMark } from '../../components/warm/MentoraMark';

const HeroScene3D = lazy(() => import('../landing/HeroScene3D'));

interface AuthLayoutProps {
  children: ReactNode;
}

// ──────────────────────────────────────────────────────────────────────────
// AuthLayout — reference theme (Phase 7).
//
// Two-column shell shared by SignIn and SignUp. Left = form, right = lazy 3D
// hero with a soft cobalt wash on the paper canvas. Collapses to single
// column under `md`. 3D scene self-fallbacks to BankIllustration via its own
// reduced-motion + viewport checks.
//
// All visuals routed through reference tokens (--paper, --ink, --line,
// --cobalt, --font-sans) so this surface matches the rest of the app.
// ──────────────────────────────────────────────────────────────────────────

export function AuthLayout({ children }: AuthLayoutProps) {
  const { t } = useTranslation();

  return (
    <main
      className="min-h-screen"
      style={{
        background:
          'radial-gradient(900px 500px at 88% -200px, var(--cobalt-glow), transparent 60%), ' +
          'radial-gradient(700px 400px at -10% 280px, rgba(255, 122, 26, 0.08), transparent 60%), ' +
          'var(--paper)',
        fontFamily: 'var(--font-sans)',
        color: 'var(--ink)',
      }}
    >
      <div className="grid min-h-screen md:grid-cols-[1.05fr_1fr]">
        <section className="flex flex-col px-6 py-8 md:px-12 md:py-10">
          <header className="flex items-center justify-between">
            <Link
              to="/"
              className="inline-flex cursor-pointer items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-medium transition-colors"
              style={{
                background: 'var(--surface)',
                border: '1px solid var(--line)',
                color: 'var(--mute)',
                fontFamily: 'var(--font-sans)',
                boxShadow: 'var(--shadow-sm)',
              }}
            >
              <span aria-hidden>←</span>
              <span>{t('auth.back_home')}</span>
            </Link>
            <LocalePicker />
          </header>

          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35, ease: 'easeOut' }}
            className="mx-auto mt-10 w-full max-w-md flex-1"
          >
            {children}
          </motion.div>
        </section>

        <aside
          className="relative hidden overflow-hidden md:flex md:flex-col md:items-center md:justify-center md:px-10"
          style={{ borderLeft: '1px solid var(--line)' }}
        >
          <div
            className="absolute inset-0"
            aria-hidden
            style={{
              background:
                'radial-gradient(600px 400px at 70% 20%, var(--cobalt-glow), transparent 60%), ' +
                'radial-gradient(500px 350px at 20% 80%, rgba(255, 122, 26, 0.10), transparent 60%)',
            }}
          />
          <div className="relative z-10 flex w-full flex-col items-center text-center">
            <div className="flex items-center gap-2.5">
              <span
                className="grid h-10 w-10 place-items-center"
                style={{
                  background: 'var(--ink)',
                  borderRadius: 'var(--r-md)',
                  boxShadow: 'var(--shadow-sm)',
                }}
              >
                <MentoraMark className="h-6 w-6 text-white" />
              </span>
              <span
                className="text-xl font-semibold tracking-tight"
                style={{ color: 'var(--ink)', letterSpacing: '-0.015em' }}
              >
                mentora
              </span>
            </div>
            <div className="mt-6 w-full max-w-[420px]">
              <Suspense
                fallback={
                  <div className="flex items-center justify-center">
                    <BankIllustration />
                  </div>
                }
              >
                <HeroScene3D />
              </Suspense>
            </div>
            <p
              className="mt-6 max-w-xs text-lg font-medium leading-snug"
              style={{ color: 'var(--mute)' }}
            >
              {t('auth.app_tagline')}
            </p>
          </div>
        </aside>
      </div>
    </main>
  );
}
