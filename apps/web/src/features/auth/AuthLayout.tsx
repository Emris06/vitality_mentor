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
// AuthLayout — warm theme (Phase G).
//
// Two-column shell shared by SignIn and SignUp. Left = form, right = lazy 3D
// hero with a soft mentora/coral wash on a cream canvas. Collapses to single
// column under `md`. 3D scene self-fallbacks to BankIllustration via its own
// reduced-motion + viewport checks.
// ──────────────────────────────────────────────────────────────────────────

export function AuthLayout({ children }: AuthLayoutProps) {
  const { t } = useTranslation();

  return (
    <main
      className="min-h-screen font-jakarta text-[var(--ink-warm)]"
      style={{
        background:
          'radial-gradient(900px 500px at 88% -200px, rgba(32, 70, 255, 0.10), transparent 60%), ' +
          'radial-gradient(700px 400px at -10% 280px, rgba(255, 107, 74, 0.08), transparent 60%), ' +
          '#fbfaf7',
      }}
    >
      <div className="grid min-h-screen md:grid-cols-[1.05fr_1fr]">
        <section className="flex flex-col px-6 py-8 md:px-12 md:py-10">
          <header className="flex items-center justify-between">
            <Link
              to="/"
              className="inline-flex cursor-pointer items-center gap-1.5 rounded-full bg-white px-3 py-1.5 text-sm font-semibold text-[var(--ink-warm-2)] shadow-chip transition-colors hover:text-[var(--ink-warm)]"
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

        <aside className="relative hidden overflow-hidden border-l border-zinc-100 md:flex md:flex-col md:items-center md:justify-center md:px-10">
          <div
            className="absolute inset-0"
            aria-hidden
            style={{
              background:
                'radial-gradient(600px 400px at 70% 20%, rgba(32, 70, 255, 0.16), transparent 60%), ' +
                'radial-gradient(500px 350px at 20% 80%, rgba(255, 107, 74, 0.12), transparent 60%)',
            }}
          />
          <div className="relative z-10 flex w-full flex-col items-center text-center">
            <div className="flex items-center gap-2.5">
              <span className="grid h-10 w-10 place-items-center rounded-2xl bg-[var(--ink-warm)] shadow-card-warm-sm">
                <MentoraMark className="h-6 w-6 text-white" />
              </span>
              <span className="text-xl font-extrabold tracking-tight text-[var(--ink-warm)]">
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
            <p className="mt-6 max-w-xs text-lg font-semibold leading-snug text-[var(--ink-warm-2)]">
              {t('auth.app_tagline')}
            </p>
          </div>
        </aside>
      </div>
    </main>
  );
}
