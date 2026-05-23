import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';

/* -------------------------------------------------------------------------- */
/* Step definitions — KYC Verification, 4 steps + done                       */
/* -------------------------------------------------------------------------- */

type StepId = 1 | 2 | 3 | 4 | 'done';

interface StepConfig {
  label: string;
  progress: number;
  score: number;
  xpGain: string;
  fields: { label: string; value: string; verified?: boolean }[];
  clickyMsg: string;
  btnLabel: string;
}

const STEPS: Record<Exclude<StepId, 'done'>, StepConfig> = {
  1: {
    label: 'Step 1 of 4',
    progress: 25,
    score: 0,
    xpGain: '+8 XP',
    fields: [
      { label: 'Full Name', value: 'Alisher Karimov' },
      { label: 'DOB', value: '15 Mar 1988' },
      { label: 'Nationality', value: 'Uzbekistan' },
    ],
    clickyMsg:
      'Start with identity. Confirm the full name matches the passport exactly before proceeding.',
    btnLabel: 'Next: Document',
  },
  2: {
    label: 'Step 2 of 4',
    progress: 50,
    score: 24,
    xpGain: '+8 XP',
    fields: [
      { label: 'Customer', value: 'Alisher Karimov' },
      { label: 'Type', value: 'Individual' },
      { label: 'Document', value: 'Passport UZ-038472', verified: true },
    ],
    clickyMsg:
      "Document verified! Now confirm the expiry date is after today's date.",
    btnLabel: 'Verify & Continue',
  },
  3: {
    label: 'Step 3 of 4',
    progress: 75,
    score: 56,
    xpGain: '+8 XP',
    fields: [
      { label: 'Address', value: 'Amir Temur 47, apt 12' },
      { label: 'City', value: 'Tashkent, UZ' },
      { label: 'Proof', value: 'Utility bill · Mar 2026', verified: true },
    ],
    clickyMsg:
      'The utility bill is recent. Verify the address matches the ID document.',
    btnLabel: 'Verify Address',
  },
  4: {
    label: 'Step 4 of 4',
    progress: 100,
    score: 87,
    xpGain: '+14 XP',
    fields: [
      { label: 'Risk Level', value: 'Low', verified: true },
      { label: 'AML Check', value: 'No matches', verified: true },
      { label: 'KYC Status', value: 'Ready to approve', verified: true },
    ],
    clickyMsg:
      'All checks passed! Risk level is Low — safe to submit the application.',
    btnLabel: 'Submit KYC',
  },
};

/* -------------------------------------------------------------------------- */
/* Component                                                                   */
/* -------------------------------------------------------------------------- */

export default function HeroAppMockup() {
  const [step, setStep] = useState<StepId>(2);
  const [xpFlash, setXpFlash] = useState<string | null>(null);
  const [frameVisible, setFrameVisible] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setFrameVisible(true), 200);
    return () => clearTimeout(t);
  }, []);

  function advance() {
    const gain = step !== 'done' ? STEPS[step as Exclude<StepId, 'done'>].xpGain : null;
    if (step === 4) {
      setStep('done');
    } else if (step !== 'done') {
      setStep(((step as number) + 1) as StepId);
    } else {
      setStep(1);
      return;
    }
    if (gain) {
      setXpFlash(gain);
      setTimeout(() => setXpFlash(null), 1800);
    }
  }

  function goBack() {
    if (step === 'done') { setStep(4); return; }
    if (step === 1) return;
    setStep(((step as number) - 1) as StepId);
  }

  const cfg = step !== 'done' ? STEPS[step as Exclude<StepId, 'done'>] : null;
  const isDone = step === 'done';
  const score = cfg?.score ?? 92;

  return (
    <div className="relative flex items-center justify-center py-6">
      {/* ── Floating stat chips ── */}

      {/* XP flash — appears briefly on each step advance */}
      <AnimatePresence>
        {xpFlash && (
          <motion.div
            key="xp"
            initial={{ opacity: 0, scale: 0.8, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.8, y: -10 }}
            transition={{ duration: 0.28 }}
            className="absolute -top-1 right-0 z-20 flex items-center gap-1.5 rounded-full bg-amber-50 px-3 py-1.5 shadow-sm ring-1 ring-amber-100"
          >
            <span className="text-xs font-bold text-amber-600">{xpFlash}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Quest completed — shows only in done state */}
      <AnimatePresence>
        {isDone && (
          <motion.div
            key="quest"
            initial={{ opacity: 0, scale: 0.85, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ delay: 0.3, duration: 0.35 }}
            className="absolute -top-1 right-0 z-10 flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1.5 shadow-sm ring-1 ring-emerald-100"
          >
            <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-xs font-semibold text-emerald-700">Quest completed</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Score chip — updates with each step */}
      <motion.div
        initial={{ opacity: 0, scale: 0.88, y: 6 }}
        animate={{ opacity: frameVisible ? 1 : 0, scale: frameVisible ? 1 : 0.88, y: frameVisible ? 0 : 6 }}
        transition={{ delay: 0.5, duration: 0.35 }}
        className="absolute bottom-8 right-0 z-10 flex items-center gap-1.5 rounded-full bg-blue-50 px-3 py-1.5 shadow-sm ring-1 ring-blue-100"
      >
        <AnimatePresence mode="wait">
          <motion.span
            key={score}
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.2 }}
            className="text-xs font-semibold text-mentora-600"
          >
            Score: {isDone ? 92 : score} pts
          </motion.span>
        </AnimatePresence>
      </motion.div>

      {/* ── App frame ── */}
      <motion.div
        initial={{ opacity: 0, y: 18 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: 'easeOut' as const }}
        className="w-full max-w-sm overflow-hidden rounded-2xl bg-white shadow-xl ring-1 ring-zinc-100"
      >
        {/* Window chrome */}
        <div className="flex items-center gap-2 bg-[var(--ink-warm)] px-4 py-3">
          <div className="flex gap-1.5">
            <div className="h-2.5 w-2.5 rounded-full bg-white/20" />
            <div className="h-2.5 w-2.5 rounded-full bg-white/20" />
            <div className="h-2.5 w-2.5 rounded-full bg-white/20" />
          </div>
          <div className="flex-1 text-center">
            <span className="text-xs font-semibold tracking-wide text-white/90">
              mentora — KYC Verification
            </span>
          </div>
        </div>

        <AnimatePresence mode="wait">
          {isDone ? (
            <motion.div
              key="done"
              initial={{ opacity: 0, x: 16 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -16 }}
              transition={{ duration: 0.22 }}
            >
              <SuccessState onRestart={() => setStep(1)} />
            </motion.div>
          ) : (
            <motion.div
              key={step}
              initial={{ opacity: 0, x: 16 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -16 }}
              transition={{ duration: 0.22 }}
            >
              <StepBody
                cfg={cfg!}
                stepNum={step as number}
                frameVisible={frameVisible}
                onBack={goBack}
                onNext={advance}
              />
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Step body                                                                   */
/* -------------------------------------------------------------------------- */

function StepBody({
  cfg,
  stepNum,
  frameVisible,
  onBack,
  onNext,
}: {
  cfg: StepConfig;
  stepNum: number;
  frameVisible: boolean;
  onBack: () => void;
  onNext: () => void;
}) {
  return (
    <>
      <div className="px-5 pb-3 pt-4">
        {/* Step header */}
        <div className="mb-2 flex items-center justify-between">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-zinc-400">
            {cfg.label}
          </span>
          <span className="text-[11px] font-bold text-mentora-600">{cfg.progress}%</span>
        </div>

        {/* Progress bar */}
        <div className="mb-4 h-1.5 w-full overflow-hidden rounded-full bg-zinc-100">
          <motion.div
            className="h-full rounded-full bg-mentora-500"
            animate={{ width: frameVisible ? `${cfg.progress}%` : '0%' }}
            transition={{ duration: 0.7, ease: [0.34, 1.0, 0.64, 1.0] as [number, number, number, number] }}
          />
        </div>

        {/* Data fields */}
        <div className="mb-4 space-y-2">
          {cfg.fields.map((f) => (
            <DataRow key={f.label} label={f.label} value={f.value} verified={f.verified} />
          ))}
        </div>

        {/* Action buttons */}
        <div className="flex gap-2">
          <button
            type="button"
            onClick={onBack}
            disabled={stepNum === 1}
            className="shrink-0 cursor-pointer rounded-lg bg-zinc-100 px-3 py-2 text-xs font-semibold text-zinc-500 transition hover:bg-zinc-200 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Back
          </button>
          <button
            type="button"
            onClick={onNext}
            className="flex flex-1 cursor-pointer items-center justify-center gap-1.5 rounded-lg bg-[var(--ink-warm)] px-3 py-2 text-xs font-semibold text-white transition hover:opacity-90 active:scale-95"
          >
            {cfg.btnLabel}
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">
              <path
                d="M2.5 6h7M7 3.5 9.5 6 7 8.5"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>
        </div>
      </div>

      {/* Clicky AI bubble */}
      <div className="flex items-start gap-2.5 border-t border-zinc-50 bg-blue-50/50 px-4 py-3">
        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[var(--ink-warm)]">
          <span className="text-[10px] font-extrabold tracking-tight text-white">C</span>
        </div>
        <div>
          <p className="mb-0.5 text-[11px] font-semibold text-mentora-700">Clicky</p>
          <AnimatePresence mode="wait">
            <motion.p
              key={cfg.label}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="text-[11px] leading-relaxed text-zinc-600"
            >
              {cfg.clickyMsg}
            </motion.p>
          </AnimatePresence>
        </div>
      </div>
    </>
  );
}

/* -------------------------------------------------------------------------- */
/* Success state — shown after Submit KYC                                     */
/* -------------------------------------------------------------------------- */

function SuccessState({ onRestart }: { onRestart: () => void }) {
  return (
    <>
      <div className="px-5 pb-4 pt-5 text-center">
        <motion.div
          initial={{ scale: 0.5, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: 'spring', stiffness: 260, damping: 18, delay: 0.1 }}
          className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-emerald-50 ring-4 ring-emerald-100"
        >
          <svg width="28" height="28" viewBox="0 0 28 28" fill="none" aria-hidden="true">
            <path
              d="M6 14.5l5.5 5.5 10.5-12"
              stroke="#10B981"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </motion.div>

        <p className="text-sm font-extrabold text-[var(--ink-warm)]">KYC Submitted!</p>
        <p className="mt-0.5 text-[11px] text-zinc-500">Alisher Karimov · Individual</p>

        <div className="mt-3 grid grid-cols-3 gap-2">
          {[
            { label: 'Score', value: '92 / 100' },
            { label: 'Risk', value: 'Low' },
            { label: 'Time', value: '3m 24s' },
          ].map((stat) => (
            <div key={stat.label} className="rounded-lg bg-zinc-50 py-2 text-center">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-zinc-400">
                {stat.label}
              </p>
              <p className="mt-0.5 text-xs font-bold text-[var(--ink-warm)]">{stat.value}</p>
            </div>
          ))}
        </div>

        <button
          type="button"
          onClick={onRestart}
          className="mt-4 w-full cursor-pointer rounded-lg bg-zinc-100 py-2 text-xs font-semibold text-zinc-600 transition hover:bg-zinc-200 active:scale-95"
        >
          Try again ↩
        </button>
      </div>

      {/* Clicky celebration */}
      <div className="flex items-start gap-2.5 border-t border-zinc-50 bg-emerald-50/50 px-4 py-3">
        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[var(--ink-warm)]">
          <span className="text-[10px] font-extrabold tracking-tight text-white">C</span>
        </div>
        <div>
          <p className="mb-0.5 text-[11px] font-semibold text-emerald-700">Clicky</p>
          <p className="text-[11px] leading-relaxed text-zinc-600">
            Excellent work! Perfect KYC completion.{' '}
            <strong className="text-emerald-700">+30 XP</strong> awarded to your profile.
          </p>
        </div>
      </div>
    </>
  );
}

/* -------------------------------------------------------------------------- */
/* Data row                                                                   */
/* -------------------------------------------------------------------------- */

function DataRow({ label, value, verified }: { label: string; value: string; verified?: boolean }) {
  return (
    <div className="flex items-center gap-2 rounded-lg bg-zinc-50 px-3 py-2">
      <span className="w-16 shrink-0 text-[10px] font-semibold uppercase tracking-wider text-zinc-400">
        {label}
      </span>
      <span className="flex-1 text-xs font-medium text-zinc-700">{value}</span>
      {verified && (
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-label="Verified" className="shrink-0">
          <circle cx="7" cy="7" r="6.5" fill="#10B981" />
          <path
            d="m4.5 7 2 2 3.5-4"
            stroke="white"
            strokeWidth="1.4"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      )}
    </div>
  );
}
