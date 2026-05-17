import { useTranslation } from 'react-i18next';
import type { StepProps } from './stepTypes';

export function IntakeStep({ submitting, onSubmit }: StepProps) {
  const { t } = useTranslation();

  return (
    <div className="p-6">
      <h2 className="text-lg font-semibold text-ink-900">{t('sim.kyc.steps.intake.title')}</h2>
      <p className="mt-2 max-w-2xl text-sm text-ink-600">
        {t('sim.kyc.steps.intake.description')}
      </p>

      <div className="mt-6 rounded border border-dashed border-ink-300 bg-ink-50 px-5 py-8 text-center">
        <p className="mb-4 text-xs uppercase tracking-wide text-ink-500">
          {t('sim.kyc.steps.intake.field_person_id')}
        </p>
        <button
          type="button"
          disabled={submitting}
          onClick={() => onSubmit({ personId: 'next' })}
          data-clicky-target="submit, next, continue, confirm, intake, person, customer"
          data-clicky-hint="Click here to confirm the customer and move to document verification."
          className="inline-flex items-center gap-2 rounded bg-brand-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-brand-700 focus:outline-none focus:ring-2 focus:ring-brand-300 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {submitting ? '…' : t('sim.kyc.steps.intake.submit')}
        </button>
      </div>
    </div>
  );
}
