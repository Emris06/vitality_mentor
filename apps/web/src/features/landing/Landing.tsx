import { Suspense, lazy, useRef, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import {
  motion,
  useMotionValue,
  useReducedMotion,
  useSpring,
  useTransform,
} from 'framer-motion';
import { LocalePicker } from '../../components/LocalePicker';
import { BankIllustration } from '../../components/ui/IllustrationGreeting';
import { MentoraMark } from '../../components/warm/MentoraMark';
import { WarmCard } from '../../components/warm/WarmCard';
import { useAuth } from '../auth/AuthProvider';
import { homeRouteFor } from '../auth/types';

const HeroScene3D = lazy(() => import('./HeroScene3D'));

// ──────────────────────────────────────────────────────────────────────────
// Public landing — warm theme (Phase H).
//
// Bespoke chrome (NOT the authenticated InternShell) but in the same warm
// brand vocabulary: cream canvas with mentora/coral radial wash, navy CTAs,
// `WarmCard` tiles. The dark constraints strip is kept as an intentional
// contrast moment, recolored from cool slate-900 to warm `--ink-warm`.
//
// Behavioral preserved bit-identical: tilt-card 3D pointer transforms,
// section anchor nav, CTA routing, prefers-reduced-motion + viewport
// fallbacks in HeroScene3D, Suspense around the 3D scene.
// ──────────────────────────────────────────────────────────────────────────

export function Landing() {
  const { t } = useTranslation();
  const { session, profile } = useAuth();
  const signedIn = Boolean(session && profile);
  const homeRoute = homeRouteFor(profile?.role ?? null);

  return (
    <main
      className="min-h-full font-jakarta text-[var(--ink-warm)]"
      style={{
        background:
          'radial-gradient(900px 500px at 88% -200px, rgba(32, 70, 255, 0.10), transparent 60%), ' +
          'radial-gradient(700px 400px at -10% 280px, rgba(255, 107, 74, 0.08), transparent 60%), ' +
          '#fbfaf7',
      }}
    >
      <TopBar signedIn={signedIn} homeRoute={homeRoute} />

      <section className="mx-auto max-w-7xl px-6 py-14 md:px-10 md:py-20">
        <div className="grid items-center gap-10 md:grid-cols-[1.15fr_1fr] md:gap-14">
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45, ease: 'easeOut' }}
          >
            <p className="font-mono-tech text-xs font-bold uppercase tracking-[0.22em] text-mentora-700">
              {t('landing.hero_eyebrow')}
            </p>
            <h1 className="mt-4 text-4xl font-extrabold leading-[1.05] tracking-tight text-[var(--ink-warm)] md:text-5xl lg:text-6xl">
              {t('landing.hero_title')}
            </h1>
            <p className="mt-5 max-w-xl text-base leading-relaxed text-[var(--ink-warm-2)] md:text-lg">
              {t('landing.hero_subtitle')}
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link
                to="/signup"
                className="inline-flex items-center gap-2 rounded-full bg-[var(--ink-warm)] px-5 py-3 text-sm font-semibold text-white shadow-sm transition-colors hover:brightness-110"
              >
                {t('landing.hero_cta_primary')}
                <ArrowRightIcon />
              </Link>
              <Link
                to="/signin"
                className="inline-flex items-center gap-2 rounded-full bg-white px-5 py-3 text-sm font-semibold text-[var(--ink-warm-2)] shadow-sm ring-1 ring-zinc-200 transition-colors hover:bg-zinc-50"
              >
                {t('landing.hero_cta_secondary')}
              </Link>
            </div>
          </motion.div>

          <div className="relative">
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
        </div>
      </section>

      <RolesStrip />

      <FeatureGrid />

      <ConstraintsStrip />

      <Footer />
    </main>
  );
}

/* -------------------------------------------------------------------------- */
/* Top bar                                                                    */
/* -------------------------------------------------------------------------- */

function TopBar({ signedIn, homeRoute }: { signedIn: boolean; homeRoute: string }) {
  const { t } = useTranslation();
  return (
    <header className="sticky top-0 z-30 border-b border-zinc-100 bg-cream-50/80 backdrop-blur">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4 md:px-10">
        <Link to="/" className="flex cursor-pointer items-center gap-2.5">
          <span className="grid h-9 w-9 place-items-center rounded-2xl bg-[var(--ink-warm)] shadow-card-warm-sm">
            <MentoraMark className="h-5 w-5 text-white" />
          </span>
          <span className="text-lg font-extrabold tracking-tight text-[var(--ink-warm)]">
            mentora
          </span>
        </Link>
        <nav className="hidden items-center gap-6 text-sm font-semibold text-[var(--ink-warm-2)] md:flex">
          <a href="#features" className="transition hover:text-mentora-700">
            Features
          </a>
          <a href="#roles" className="transition hover:text-mentora-700">
            How It Works
          </a>
          <a href="#constraints" className="transition hover:text-mentora-700">
            Pricing
          </a>
          <a href="#contact" className="transition hover:text-mentora-700">
            Contact
          </a>
        </nav>
        <div className="flex items-center gap-3">
          <LocalePicker />
          {signedIn ? (
            <Link
              to={homeRoute}
              className="inline-flex items-center gap-2 rounded-full bg-white px-4 py-1.5 text-sm font-semibold text-[var(--ink-warm-2)] shadow-sm ring-1 ring-zinc-200 transition-colors hover:bg-zinc-50"
            >
              {t('landing.nav_continue')}
              <ArrowRightIcon />
            </Link>
          ) : (
            <>
              <Link
                to="/signin"
                className="hidden cursor-pointer text-sm font-semibold text-[var(--ink-warm-2)] transition hover:text-mentora-700 sm:inline-flex"
              >
                {t('landing.nav_signin')}
              </Link>
              <Link
                to="/signup"
                className="inline-flex items-center rounded-full bg-mentora-600 px-4 py-1.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-mentora-700"
              >
                {t('landing.nav_signup')}
              </Link>
            </>
          )}
        </div>
      </div>
    </header>
  );
}

/* -------------------------------------------------------------------------- */
/* Roles strip — tilt cards                                                   */
/* -------------------------------------------------------------------------- */

interface RoleDef {
  slug: 'hr' | 'employee' | 'intern';
  nameKey: string;
  blurbKey: string;
  icon: ReactNode;
  iconStyle: { backgroundColor: string; color: string };
}

const ROLES: RoleDef[] = [
  {
    slug: 'hr',
    nameKey: 'landing.role_hr_name',
    blurbKey: 'landing.role_hr_blurb',
    icon: <PeopleIcon />,
    iconStyle: { backgroundColor: 'rgba(32, 70, 255, 0.10)', color: '#2046FF' },
  },
  {
    slug: 'employee',
    nameKey: 'landing.role_employee_name',
    blurbKey: 'landing.role_employee_blurb',
    icon: <SparkIcon />,
    iconStyle: { backgroundColor: 'rgba(180, 83, 9, 0.12)', color: '#92400e' },
  },
  {
    slug: 'intern',
    nameKey: 'landing.role_intern_name',
    blurbKey: 'landing.role_intern_blurb',
    icon: <CompassIcon />,
    iconStyle: { backgroundColor: 'rgba(255, 107, 74, 0.14)', color: '#c2410c' },
  },
];

function RolesStrip() {
  const { t } = useTranslation();
  return (
    <section id="roles" className="mx-auto max-w-7xl px-6 pb-14 md:px-10 md:pb-20">
      <SectionHeader title={t('landing.roles_title')} subtitle={t('landing.roles_subtitle')} />
      <motion.div
        initial="hidden"
        whileInView="show"
        viewport={{ once: true, margin: '-80px' }}
        variants={{
          hidden: {},
          show: { transition: { staggerChildren: 0.08 } },
        }}
        className="mt-8 grid gap-5 md:grid-cols-3"
      >
        {ROLES.map((role) => (
          <motion.div
            key={role.slug}
            variants={{
              hidden: { opacity: 0, y: 12 },
              show: { opacity: 1, y: 0, transition: { duration: 0.4, ease: 'easeOut' } },
            }}
          >
            <TiltCard>
              <Link
                to={`/signup?role=${role.slug}`}
                className="group block h-full cursor-pointer rounded-3xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-mentora-600/30"
              >
                <WarmCard className="flex h-full flex-col p-6 transition-transform group-hover:-translate-y-0.5">
                  <span
                    className="grid h-10 w-10 place-items-center rounded-2xl"
                    style={role.iconStyle}
                  >
                    {role.icon}
                  </span>
                  <h3 className="mt-4 text-xl font-extrabold tracking-tight text-[var(--ink-warm)]">
                    {t(role.nameKey)}
                  </h3>
                  <p className="mt-2 text-sm leading-relaxed text-[var(--ink-warm-2)]">
                    {t(role.blurbKey)}
                  </p>
                  <div className="mt-6 flex-1" />
                  <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-mentora-700 transition-colors group-hover:text-mentora-800">
                    {t('landing.role_card_cta', { role: t(role.nameKey) })}
                    <ArrowRightIcon />
                  </span>
                </WarmCard>
              </Link>
            </TiltCard>
          </motion.div>
        ))}
      </motion.div>
    </section>
  );
}

/**
 * Tilt-on-pointer wrapper. Maps cursor position over the element to a small
 * rotateX/rotateY transform (±6°). Respects prefers-reduced-motion — when set,
 * the wrapper is a no-op pass-through so cards stay flat.
 */
function TiltCard({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLDivElement | null>(null);
  const reduced = useReducedMotion();

  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const rotX = useSpring(useTransform(y, [-0.5, 0.5], [6, -6]), { stiffness: 140, damping: 14 });
  const rotY = useSpring(useTransform(x, [-0.5, 0.5], [-6, 6]), { stiffness: 140, damping: 14 });

  if (reduced) return <div className="h-full">{children}</div>;

  return (
    <motion.div
      ref={ref}
      onPointerMove={(e) => {
        const el = ref.current;
        if (!el) return;
        const rect = el.getBoundingClientRect();
        x.set((e.clientX - rect.left) / rect.width - 0.5);
        y.set((e.clientY - rect.top) / rect.height - 0.5);
      }}
      onPointerLeave={() => {
        x.set(0);
        y.set(0);
      }}
      style={{ rotateX: rotX, rotateY: rotY, transformStyle: 'preserve-3d' }}
      className="group h-full [perspective:1000px] will-change-transform"
    >
      {children}
    </motion.div>
  );
}

/* -------------------------------------------------------------------------- */
/* Feature grid                                                               */
/* -------------------------------------------------------------------------- */

interface FeatureDef {
  key: string;
  nameKey: string;
  descKey: string;
  icon: ReactNode;
  iconStyle: { backgroundColor: string; color: string };
}

const FEATURES: FeatureDef[] = [
  {
    key: 'kb',
    nameKey: 'landing.feature_kb_name',
    descKey: 'landing.feature_kb_desc',
    icon: <BookIcon />,
    iconStyle: { backgroundColor: 'rgba(32, 70, 255, 0.10)', color: '#2046FF' },
  },
  {
    key: 'simulator',
    nameKey: 'landing.feature_simulator_name',
    descKey: 'landing.feature_simulator_desc',
    icon: <MonitorIcon />,
    iconStyle: { backgroundColor: 'rgba(255, 107, 74, 0.12)', color: '#c2410c' },
  },
  {
    key: 'skills',
    nameKey: 'landing.feature_skills_name',
    descKey: 'landing.feature_skills_desc',
    icon: <BarsIcon />,
    iconStyle: { backgroundColor: 'rgba(245, 158, 11, 0.14)', color: '#b45309' },
  },
  {
    key: 'matching',
    nameKey: 'landing.feature_matching_name',
    descKey: 'landing.feature_matching_desc',
    icon: <LinkIcon />,
    iconStyle: { backgroundColor: 'rgba(236, 72, 153, 0.10)', color: '#be185d' },
  },
  {
    key: 'gamification',
    nameKey: 'landing.feature_gamification_name',
    descKey: 'landing.feature_gamification_desc',
    icon: <StarIcon />,
    iconStyle: { backgroundColor: 'rgba(16, 185, 129, 0.12)', color: '#047857' },
  },
  {
    key: 'lms',
    nameKey: 'landing.feature_lms_name',
    descKey: 'landing.feature_lms_desc',
    icon: <UploadCloudIcon />,
    iconStyle: { backgroundColor: 'rgba(99, 102, 241, 0.12)', color: '#4338ca' },
  },
];

function FeatureGrid() {
  const { t } = useTranslation();
  return (
    <section id="features" className="mx-auto max-w-7xl px-6 pb-14 md:px-10 md:pb-20">
      <SectionHeader title={t('landing.features_title')} subtitle={t('landing.features_subtitle')} />
      <div className="mt-8 grid gap-4 md:grid-cols-3">
        {FEATURES.map((feature, idx) => (
          <motion.div
            key={feature.key}
            initial={{ opacity: 0, y: 12 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-80px' }}
            transition={{ duration: 0.4, ease: 'easeOut', delay: (idx % 3) * 0.05 }}
          >
            <WarmCard className="h-full p-6">
              <span
                className="grid h-9 w-9 place-items-center rounded-2xl"
                style={feature.iconStyle}
              >
                {feature.icon}
              </span>
              <h3 className="mt-4 text-base font-extrabold tracking-tight text-[var(--ink-warm)]">
                {t(feature.nameKey)}
              </h3>
              <p className="mt-1 text-sm leading-relaxed text-[var(--ink-warm-2)]">
                {t(feature.descKey)}
              </p>
            </WarmCard>
          </motion.div>
        ))}
      </div>
    </section>
  );
}

/* -------------------------------------------------------------------------- */
/* Constraints strip — intentional dark moment, warm-toned                    */
/* -------------------------------------------------------------------------- */

function ConstraintsStrip() {
  const { t } = useTranslation();
  const constraints = [
    t('landing.constraint_synthetic'),
    t('landing.constraint_latency'),
    t('landing.constraint_trilingual'),
  ];
  return (
    <section id="constraints" className="mx-auto max-w-7xl px-6 pb-14 md:px-10 md:pb-20">
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: '-80px' }}
        transition={{ duration: 0.5, ease: 'easeOut' }}
        className="rounded-3xl px-6 py-8 text-white shadow-card-warm md:px-10 md:py-10"
        style={{ backgroundColor: 'var(--ink-warm)' }}
      >
        <div className="flex flex-col gap-6 md:flex-row md:items-center md:gap-10">
          <span className="font-mono-tech text-xs font-bold uppercase tracking-[0.18em] text-mentora-300">
            {t('landing.constraints_title')}
          </span>
          <div className="flex flex-1 flex-col gap-4 md:flex-row md:flex-wrap md:gap-x-10 md:gap-y-4">
            {constraints.map((line) => (
              <div key={line} className="flex items-start gap-3">
                <span className="mt-1.5 inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-coral-400" />
                <p className="text-sm leading-relaxed text-zinc-200">{line}</p>
              </div>
            ))}
          </div>
        </div>
      </motion.div>
    </section>
  );
}

/* -------------------------------------------------------------------------- */
/* Footer                                                                     */
/* -------------------------------------------------------------------------- */

function Footer() {
  const { t } = useTranslation();
  return (
    <footer id="contact" className="border-t border-zinc-100 bg-white/60 backdrop-blur">
      <div className="mx-auto flex max-w-7xl flex-col gap-4 px-6 py-6 text-sm text-[var(--ink-warm-2)] md:flex-row md:items-center md:justify-between md:px-10">
        <div className="flex items-center gap-2.5">
          <span className="grid h-7 w-7 place-items-center rounded-xl bg-[var(--ink-warm)]">
            <MentoraMark className="h-4 w-4 text-white" />
          </span>
          <span className="text-sm font-extrabold tracking-tight text-[var(--ink-warm)]">
            mentora
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-4">
          <Link
            to="/signin"
            className="cursor-pointer font-semibold transition-colors hover:text-mentora-700"
          >
            {t('landing.footer_signin')}
          </Link>
          <Link
            to="/signup"
            className="cursor-pointer font-semibold transition-colors hover:text-mentora-700"
          >
            {t('landing.footer_signup')}
          </Link>
          <span className="font-mono-tech text-[var(--muted-warm)]">© 2026</span>
        </div>
      </div>
    </footer>
  );
}

/* -------------------------------------------------------------------------- */
/* Section header                                                             */
/* -------------------------------------------------------------------------- */

function SectionHeader({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div className="max-w-2xl">
      <h2 className="text-3xl font-extrabold tracking-tight text-[var(--ink-warm)] md:text-4xl">
        {title}
      </h2>
      <p className="mt-2 text-base text-[var(--ink-warm-2)]">{subtitle}</p>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Inline SVG icons (20×20, currentColor)                                     */
/* -------------------------------------------------------------------------- */

function ArrowRightIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path
        d="M3.5 8h9M9 4.5 12.5 8 9 11.5"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function PeopleIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <circle cx="7" cy="7" r="3" stroke="currentColor" strokeWidth="1.6" />
      <circle cx="14" cy="8" r="2.2" stroke="currentColor" strokeWidth="1.6" />
      <path d="M2 16c0-2.2 2.2-4 5-4s5 1.8 5 4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      <path d="M12 16c0-1.7 1.4-3.2 3.5-3.2S19 14.3 19 16" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

function SparkIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <path
        d="M10 2v4M10 14v4M2 10h4M14 10h4M4.4 4.4l2.8 2.8M12.8 12.8l2.8 2.8M4.4 15.6l2.8-2.8M12.8 7.2l2.8-2.8"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
    </svg>
  );
}

function CompassIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <circle cx="10" cy="10" r="7.5" stroke="currentColor" strokeWidth="1.6" />
      <path d="M13 7l-1.5 4.5L7 13l1.5-4.5L13 7z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
    </svg>
  );
}

function BookIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <path
        d="M3.5 4.5A1.5 1.5 0 0 1 5 3h4.5v13H5a1.5 1.5 0 0 1-1.5-1.5v-10z"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
      <path
        d="M16.5 4.5A1.5 1.5 0 0 0 15 3h-4.5v13H15a1.5 1.5 0 0 0 1.5-1.5v-10z"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function MonitorIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <rect x="2.5" y="3.5" width="15" height="10" rx="1.5" stroke="currentColor" strokeWidth="1.6" />
      <path d="M7 17h6M10 13.5V17" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

function BarsIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <path d="M4 16V9M10 16V4M16 16v-5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

function LinkIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <path d="M8.5 11.5a3 3 0 0 0 4.2 0l2.3-2.3a3 3 0 0 0-4.2-4.2L9.7 6" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      <path d="M11.5 8.5a3 3 0 0 0-4.2 0L5 10.8a3 3 0 1 0 4.2 4.2L10.3 14" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

function StarIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <path
        d="M10 2.5l2.3 4.7 5.2.8-3.8 3.7.9 5.2L10 14.5l-4.6 2.4.9-5.2L2.5 8l5.2-.8L10 2.5z"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function UploadCloudIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <path
        d="M5 14a3.5 3.5 0 0 1 .6-6.96 5 5 0 0 1 9.7 1.2A3.5 3.5 0 0 1 15 14"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
      <path
        d="M10 9.5V17M7.5 12L10 9.5l2.5 2.5"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
