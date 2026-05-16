import { Suspense, lazy, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import { LocalePicker } from '../../components/LocalePicker';
import { BankIllustration } from '../../components/ui/IllustrationGreeting';

const HeroScene3D = lazy(() => import('../landing/HeroScene3D'));

interface AuthLayoutProps {
  children: ReactNode;
}

/**
 * Two-column shell used by SignUp and SignIn. The right panel is a quiet
 * brand-gradient billboard with a lazy-loaded 3D credential scene so the auth
 * pages feel like part of the product, not a stark login modal. Collapses to a
 * single column under `md`. The 3D scene self-fallbacks to BankIllustration
 * when reduced-motion is set or on narrow viewports.
 */
export function AuthLayout({ children }: AuthLayoutProps) {
  const { t } = useTranslation();

  return (
    <main className="min-h-screen bg-slate-50">
      <div className="grid min-h-screen md:grid-cols-[1.05fr_1fr]">
        <section className="flex flex-col px-6 py-8 md:px-12 md:py-10">
          <header className="flex items-center justify-between">
            <Link
              to="/"
              className="inline-flex cursor-pointer items-center gap-1.5 text-sm font-medium text-slate-500 transition-colors hover:text-slate-900"
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

        <aside className="relative hidden overflow-hidden border-l border-slate-200 bg-gradient-to-br from-brand-50 via-white to-brand-50/40 md:flex md:flex-col md:items-center md:justify-center md:px-10">
          <div className="absolute inset-0 -z-0 opacity-70">
            <div className="absolute -left-24 top-12 h-72 w-72 rounded-full bg-brand-100 blur-3xl" />
            <div className="absolute -right-16 bottom-10 h-64 w-64 rounded-full bg-brand-200/60 blur-3xl" />
          </div>
          <div className="relative z-10 flex w-full flex-col items-center text-center">
            <div className="flex items-center gap-2.5">
              <span className="grid h-10 w-10 place-items-center rounded-lg bg-brand-600 font-display text-base font-semibold text-white shadow-card">
                A
              </span>
              <span className="font-display text-xl font-semibold tracking-tight text-slate-900">
                {t('auth.app_name')}
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
            <p className="mt-6 max-w-xs font-display text-lg leading-snug text-slate-700">
              {t('auth.app_tagline')}
            </p>
          </div>
        </aside>
      </div>
    </main>
  );
}
