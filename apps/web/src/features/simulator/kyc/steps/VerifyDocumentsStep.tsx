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
      <h2 className="text-base font-semibold tracking-tight text-zinc-900">
        {t('sim.kyc.steps.verify_documents.title')}
      </h2>
      <p className="mt-1.5 max-w-2xl text-[13px] leading-relaxed text-zinc-600">
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
          data-clicky-target="confirm, next, continue, submit, verify, documents"
          data-clicky-hint="Confirms your verdict on both documents and moves to sanctions."
          className="inline-flex items-center gap-2 rounded-md bg-mentora-600 px-5 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-mentora-700 focus:outline-none focus:ring-2 focus:ring-mentora-600/30 disabled:cursor-not-allowed disabled:opacity-50"
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
    <div className="overflow-hidden rounded-md ring-1 ring-zinc-200">
      <div className="border-b border-zinc-200 bg-zinc-50 px-4 py-2 font-mono-tech text-[11px] uppercase tracking-wider text-zinc-600">
        {title}
      </div>
      <dl className="divide-y divide-zinc-100">
        {fields.map((field) => (
          <div
            key={field.label}
            className="grid grid-cols-[140px_1fr] gap-2 bg-white px-4 py-2 text-[13px]"
          >
            <dt className="text-zinc-500">{field.label}</dt>
            <dd
              className={
                'text-zinc-900 ' +
                (field.mono ? 'font-mono-tech text-[12px]' : '')
              }
            >
              {field.value ?? <span className="text-zinc-400">—</span>}
            </dd>
          </div>
        ))}
      </dl>
      <div className="space-y-2 border-t border-zinc-100 bg-zinc-50/50 px-4 py-3">
        <div className="flex flex-wrap gap-2 text-sm">
          <label
            data-clicky-target={`valid, ok, accept, pass, ${title.toLowerCase()}`}
            data-clicky-hint={`Mark "${title}" as valid — only when every field matches what you'd see on a real document.`}
            className={
              'inline-flex cursor-pointer items-center gap-2 rounded-md px-3 py-1.5 text-[13px] transition ' +
              (verdict === 'valid'
                ? 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200'
                : 'bg-white text-zinc-700 ring-1 ring-zinc-200 hover:bg-zinc-50')
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
            data-clicky-target={`invalid, reject, fail, flag, ${title.toLowerCase()}`}
            data-clicky-hint={`Mark "${title}" as invalid — when a field is fake, expired, or inconsistent.`}
            className={
              'inline-flex cursor-pointer items-center gap-2 rounded-md px-3 py-1.5 text-[13px] transition ' +
              (verdict === 'invalid'
                ? 'bg-rose-50 text-rose-700 ring-1 ring-rose-200'
                : 'bg-white text-zinc-700 ring-1 ring-zinc-200 hover:bg-zinc-50')
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
          data-clicky-target={`why, reason, notes, rationale, ${title.toLowerCase()}`}
          data-clicky-hint={`Briefly note why you reached your verdict on "${title}". The grader reads this for partial credit.`}
          className="w-full resize-none rounded-md bg-white px-2.5 py-1.5 text-xs text-zinc-800 ring-1 ring-zinc-200 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-mentora-600/30"
        />
      </div>
    </div>
  );
}
