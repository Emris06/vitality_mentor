import { useTranslation } from 'react-i18next';
import type { StepProps } from './stepTypes';

export function IntakeStep({ submitting, onSubmit }: StepProps) {
  const { t } = useTranslation();

  return (
    <div
      className="p-6"
      data-clicky-target="intake, start, begin, kyc, customer, file"
      data-clicky-hint={t('clicky.hint.kyc.scenario')}
    >
      <h2 className="text-base font-semibold tracking-tight text-zinc-900">
        {t('sim.kyc.steps.intake.title')}
      </h2>
      <p className="mt-1.5 max-w-2xl text-[13px] leading-relaxed text-zinc-600">
        {t('sim.kyc.steps.intake.description')}
      </p>

      <div className="mt-5 rounded-md border border-dashed border-zinc-300 bg-zinc-50 px-5 py-8 text-center">
        <p className="mb-4 font-mono-tech text-[11px] uppercase tracking-wider text-zinc-500">
          {t('sim.kyc.steps.intake.field_person_id')}
        </p>
        <button
          type="button"
          disabled={submitting}
          onClick={() => onSubmit({ personId: 'next' })}
          data-clicky-target="submit, next, continue, confirm, intake, person, customer"
          data-clicky-hint="Click here to confirm the customer and move to document verification."
          className="btn btn-primary disabled:cursor-not-allowed disabled:opacity-60"
        >
          {submitting ? '…' : t('sim.kyc.steps.intake.submit')}
        </button>
      </div>
    </div>
  );
}
