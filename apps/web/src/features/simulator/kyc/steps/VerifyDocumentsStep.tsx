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
      <h2 className="text-base font-semibold tracking-tight text-[var(--ink)]">
        {t('sim.kyc.steps.verify_documents.title')}
      </h2>
      <p className="mt-1.5 max-w-2xl text-[13px] leading-relaxed text-[var(--mute)]">
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
          className="btn btn-primary inline-flex items-center gap-2 rounded-[var(--r-md)] px-5 py-2 text-sm font-semibold shadow-sm transition focus:outline-none focus:ring-2 focus:ring-[var(--cobalt)]/30 disabled:cursor-not-allowed disabled:opacity-50"
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
    <div className="overflow-hidden rounded-[var(--r-md)] ring-1 ring-[var(--line)]">
      <div className="border-b border-[var(--line)] bg-[var(--surface-2)] px-4 py-2 font-mono text-[11px] uppercase tracking-wider text-[var(--mute)]">
        {title}
      </div>
      <dl className="divide-y divide-[var(--line)]">
        {fields.map((field) => (
          <div
            key={field.label}
            className="grid grid-cols-[140px_1fr] gap-2 bg-white px-4 py-2 text-[13px]"
          >
            <dt className="text-[var(--mute)]">{field.label}</dt>
            <dd
              className={
                'text-[var(--ink)] ' +
                (field.mono ? 'font-mono text-[12px]' : '')
              }
            >
              {field.value ?? <span className="text-[var(--mute-2)]">—</span>}
            </dd>
          </div>
        ))}
      </dl>
      <div className="space-y-2 border-t border-[var(--line)] bg-[var(--surface-2)] px-4 py-3">
        <div className="flex flex-wrap gap-2 text-sm">
          <label
            data-clicky-target={`valid, ok, accept, pass, ${title.toLowerCase()}`}
            data-clicky-hint={`Mark "${title}" as valid — only when every field matches what you'd see on a real document.`}
            className={
              'inline-flex cursor-pointer items-center gap-2 rounded-[var(--r-sm)] px-3 py-1.5 text-[13px] transition ' +
              (verdict === 'valid'
                ? 'bg-[var(--good-tint)] text-[var(--good)] ring-1 ring-[var(--good)]'
                : 'bg-white text-[var(--mute)] ring-1 ring-[var(--line)] hover:bg-[var(--surface-2)]')
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
              'inline-flex cursor-pointer items-center gap-2 rounded-[var(--r-sm)] px-3 py-1.5 text-[13px] transition ' +
              (verdict === 'invalid'
                ? 'bg-[var(--bad-tint)] text-[var(--bad)] ring-1 ring-[var(--bad)]'
                : 'bg-white text-[var(--mute)] ring-1 ring-[var(--line)] hover:bg-[var(--surface-2)]')
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
          className="w-full resize-none rounded-[var(--r-sm)] bg-white px-2.5 py-1.5 text-xs text-[var(--ink)] ring-1 ring-[var(--line)] placeholder:text-[var(--mute-2)] focus:outline-none focus:ring-2 focus:ring-[var(--cobalt)]/30"
        />
      </div>
    </div>
  );
}
