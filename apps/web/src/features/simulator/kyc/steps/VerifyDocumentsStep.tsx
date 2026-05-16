import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { readState, type StepProps } from './stepTypes';

type Verdict = 'valid' | 'invalid' | null;

export function VerifyDocumentsStep({ run, submitting, onSubmit }: StepProps) {
  const { t } = useTranslation();
  const state = readState(run);
  const person = state.person ?? {};
  const docs = state.documents ?? {};

  const [passportVerdict, setPassportVerdict] = useState<Verdict>(null);
  const [passportWhy, setPassportWhy] = useState('');
  const [incomeVerdict, setIncomeVerdict] = useState<Verdict>(null);
  const [incomeWhy, setIncomeWhy] = useState('');

  const canSubmit = passportVerdict !== null && incomeVerdict !== null && !submitting;

  return (
    <div className="p-6">
      <h2 className="text-lg font-semibold text-ink-900">
        {t('sim.kyc.steps.verify_documents.title')}
      </h2>
      <p className="mt-2 max-w-2xl text-sm text-ink-600">
        {t('sim.kyc.steps.verify_documents.description')}
      </p>

      <div className="mt-5 grid gap-4 lg:grid-cols-2">
        <DocumentPanel
          title={t('sim.kyc.steps.verify_documents.passport_title')}
          fields={[
            {
              label: t('sim.kyc.steps.verify_documents.field_full_name'),
              value: docs.passport?.fullName ?? person.fullName,
            },
            {
              label: t('sim.kyc.steps.verify_documents.field_dob'),
              value: docs.passport?.dob ?? person.dob,
              mono: true,
            },
            {
              label: t('sim.kyc.steps.verify_documents.field_passport_no'),
              value: docs.passport?.passportNo ?? person.passport,
              mono: true,
            },
            {
              label: t('sim.kyc.steps.verify_documents.field_address'),
              value: person.address,
            },
          ]}
          verdict={passportVerdict}
          onVerdict={setPassportVerdict}
          why={passportWhy}
          onWhyChange={setPassportWhy}
          validLabel={t('sim.kyc.steps.verify_documents.passport_valid')}
          invalidLabel={t('sim.kyc.steps.verify_documents.passport_invalid')}
          whyPlaceholder={t('sim.kyc.steps.verify_documents.why_placeholder')}
        />

        <DocumentPanel
          title={t('sim.kyc.steps.verify_documents.income_title')}
          fields={[
            {
              label: t('sim.kyc.steps.verify_documents.field_full_name'),
              value: person.fullName,
            },
            {
              label: t('sim.kyc.steps.verify_documents.field_employer'),
              value: docs.incomeStatement?.employer,
            },
            {
              label: t('sim.kyc.steps.verify_documents.field_monthly_income'),
              value:
                docs.incomeStatement?.monthlyIncome != null
                  ? docs.incomeStatement.monthlyIncome.toLocaleString()
                  : undefined,
              mono: true,
            },
            {
              label: t('sim.kyc.steps.verify_documents.field_inn'),
              value: person.inn,
              mono: true,
            },
          ]}
          verdict={incomeVerdict}
          onVerdict={setIncomeVerdict}
          why={incomeWhy}
          onWhyChange={setIncomeWhy}
          validLabel={t('sim.kyc.steps.verify_documents.income_valid')}
          invalidLabel={t('sim.kyc.steps.verify_documents.income_invalid')}
          whyPlaceholder={t('sim.kyc.steps.verify_documents.why_placeholder')}
        />
      </div>

      <div className="mt-6 flex justify-end">
        <button
          type="button"
          disabled={!canSubmit}
          onClick={() =>
            onSubmit({
              passportValid: passportVerdict === 'valid',
              incomeStatementValid: incomeVerdict === 'valid',
            })
          }
          className="inline-flex items-center gap-2 rounded bg-brand-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-brand-700 focus:outline-none focus:ring-2 focus:ring-brand-300 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {t('sim.kyc.steps.verify_documents.confirm')}
        </button>
      </div>
    </div>
  );
}

interface Field {
  label: string;
  value: string | number | undefined;
  mono?: boolean;
}

interface DocumentPanelProps {
  title: string;
  fields: Field[];
  verdict: Verdict;
  onVerdict: (v: Verdict) => void;
  why: string;
  onWhyChange: (s: string) => void;
  validLabel: string;
  invalidLabel: string;
  whyPlaceholder: string;
}

function DocumentPanel({
  title,
  fields,
  verdict,
  onVerdict,
  why,
  onWhyChange,
  validLabel,
  invalidLabel,
  whyPlaceholder,
}: DocumentPanelProps) {
  return (
    <div className="rounded border border-ink-300 bg-ink-50/50">
      <div className="border-b border-ink-300 bg-ink-100 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-ink-700">
        {title}
      </div>
      <dl className="divide-y divide-ink-200">
        {fields.map((field) => (
          <div key={field.label} className="grid grid-cols-[140px_1fr] gap-2 px-4 py-2 text-sm">
            <dt className="text-ink-500">{field.label}</dt>
            <dd
              className={
                'text-ink-900 ' + (field.mono ? 'tabular-nums font-mono text-[13px]' : '')
              }
            >
              {field.value ?? <span className="text-ink-400">—</span>}
            </dd>
          </div>
        ))}
      </dl>
      <div className="space-y-2 border-t border-ink-200 bg-white px-4 py-3">
        <div className="flex flex-wrap gap-2 text-sm">
          <label
            className={
              'inline-flex items-center gap-2 rounded border px-3 py-1.5 cursor-pointer ' +
              (verdict === 'valid'
                ? 'border-emerald-300 bg-emerald-50 text-emerald-800'
                : 'border-ink-200 bg-white text-ink-700 hover:bg-ink-50')
            }
          >
            <input
              type="radio"
              className="accent-emerald-600"
              checked={verdict === 'valid'}
              onChange={() => onVerdict('valid')}
            />
            {validLabel}
          </label>
          <label
            className={
              'inline-flex items-center gap-2 rounded border px-3 py-1.5 cursor-pointer ' +
              (verdict === 'invalid'
                ? 'border-rose-300 bg-rose-50 text-rose-800'
                : 'border-ink-200 bg-white text-ink-700 hover:bg-ink-50')
            }
          >
            <input
              type="radio"
              className="accent-rose-600"
              checked={verdict === 'invalid'}
              onChange={() => onVerdict('invalid')}
            />
            {invalidLabel}
          </label>
        </div>
        <textarea
          value={why}
          onChange={(e) => onWhyChange(e.target.value)}
          placeholder={whyPlaceholder}
          rows={2}
          className="w-full resize-none rounded border border-ink-200 bg-white px-2.5 py-1.5 text-xs text-ink-800 placeholder:text-ink-400 focus:border-brand-400 focus:outline-none focus:ring-1 focus:ring-brand-300"
        />
      </div>
    </div>
  );
}
