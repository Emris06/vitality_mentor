import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../auth/AuthProvider';
import { resourcesApi } from '../../lib/api';
import { InternShell } from '../workspace/InternShell';
import type { Resource } from '../../lib/api';

const CATEGORIES = ['aml_kyc', 'customer', 'products', 'operations'] as const;

const SEED_RESOURCES: Resource[] = [
  { id: 's1', titleKey: 'resources.aml_intro.title',        descKey: 'resources.aml_intro.desc',        category: 'aml_kyc',    docType: 'guide'      },
  { id: 's2', titleKey: 'resources.kyc_checklist.title',    descKey: 'resources.kyc_checklist.desc',    category: 'aml_kyc',    docType: 'checklist'  },
  { id: 's3', titleKey: 'resources.pep_screening.title',    descKey: 'resources.pep_screening.desc',    category: 'aml_kyc',    docType: 'checklist'  },
  { id: 's4', titleKey: 'resources.complaint_sop.title',    descKey: 'resources.complaint_sop.desc',    category: 'customer',   docType: 'sop'        },
  { id: 's5', titleKey: 'resources.account_types.title',    descKey: 'resources.account_types.desc',    category: 'products',   docType: 'guide'      },
  { id: 's6', titleKey: 'resources.deposit_ops.title',      descKey: 'resources.deposit_ops.desc',      category: 'operations', docType: 'sop'        },
  { id: 's7', titleKey: 'resources.transfer_reg.title',     descKey: 'resources.transfer_reg.desc',     category: 'operations', docType: 'regulation' },
  { id: 's8', titleKey: 'resources.onboarding_guide.title', descKey: 'resources.onboarding_guide.desc', category: 'operations', docType: 'guide'      },
];

const DOC_TYPE_ICON: Record<string, string> = {
  guide:      '📖',
  checklist:  '✅',
  sop:        '📋',
  regulation: '⚖️',
};

const DOC_TYPE_COLOR: Record<string, string> = {
  guide:      'bg-blue-50   text-blue-700',
  checklist:  'bg-emerald-50 text-emerald-700',
  sop:        'bg-amber-50  text-amber-700',
  regulation: 'bg-rose-50   text-rose-700',
};

export default function ResourcesPage() {
  const { t } = useTranslation();
  const { profile } = useAuth();
  const [allResources, setAllResources] = useState<Resource[] | null>(null);
  const [filter, setFilter] = useState<string | undefined>(undefined);

  const userName = profile?.fullName ?? '';
  const firstName = userName.split(' ')[0] || userName;

  useEffect(() => {
    resourcesApi
      .list()
      .then((data) => setAllResources(data.length > 0 ? data : SEED_RESOURCES))
      .catch(() => setAllResources(SEED_RESOURCES));
  }, []);

  const visible = allResources
    ? filter
      ? allResources.filter((r) => r.category === filter)
      : allResources
    : null;

  return (
    <InternShell
      userName={userName}
      userRole={t('auth.role_intern_name')}
      greeting={t('intern.shell.greeting', { name: firstName })}
      pageTitle={t('page.resources.title')}
    >
      {/* Category filter chips */}
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => setFilter(undefined)}
          className={`rounded-full px-4 py-1.5 text-sm font-medium transition ${
            !filter
              ? 'bg-[var(--ink-warm)] text-white shadow-sm'
              : 'bg-white text-[var(--ink-warm-2)] hover:bg-zinc-50 shadow-sm ring-1 ring-zinc-100'
          }`}
        >
          {t('page.resources.all')}
          {!filter && allResources && (
            <span className="ml-1.5 opacity-60">{allResources.length}</span>
          )}
        </button>
        {CATEGORIES.map((cat) => {
          const count = allResources?.filter((r) => r.category === cat).length ?? 0;
          return (
            <button
              key={cat}
              type="button"
              onClick={() => setFilter(cat)}
              className={`rounded-full px-4 py-1.5 text-sm font-medium transition ${
                filter === cat
                  ? 'bg-[var(--ink-warm)] text-white shadow-sm'
                  : 'bg-white text-[var(--ink-warm-2)] hover:bg-zinc-50 shadow-sm ring-1 ring-zinc-100'
              }`}
            >
              {t(`resources.category.${cat}`)}
              {allResources && (
                <span className="ml-1.5 opacity-50">{count}</span>
              )}
            </button>
          );
        })}
      </div>

      {/* Loading skeleton */}
      {visible === null && (
        <div className="grid gap-4 sm:grid-cols-2">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="h-32 rounded-2xl bg-white/40 animate-pulse" />
          ))}
        </div>
      )}

      {/* Empty state */}
      {visible !== null && visible.length === 0 && (
        <p className="text-[var(--muted-warm)]">{t('page.resources.empty')}</p>
      )}

      {/* Grid */}
      {visible !== null && visible.length > 0 && (
        <div className="grid gap-4 sm:grid-cols-2">
          {visible.map((r) => (
            <div
              key={r.id}
              className="group rounded-2xl bg-white p-5 shadow-sm ring-1 ring-zinc-100 flex flex-col gap-4 transition hover:shadow-md hover:ring-zinc-200"
            >
              <div className="flex items-start gap-3">
                <span
                  className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl text-lg ${
                    DOC_TYPE_COLOR[r.docType] ?? 'bg-zinc-50 text-zinc-500'
                  }`}
                >
                  {DOC_TYPE_ICON[r.docType] ?? '📄'}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-[var(--ink-warm)] text-sm leading-snug">
                    {t(r.titleKey)}
                  </p>
                  <p className="text-xs text-[var(--muted-warm)] mt-1 leading-relaxed line-clamp-2">
                    {t(r.descKey)}
                  </p>
                </div>
              </div>
              <div className="flex items-center justify-between border-t border-zinc-50 pt-3">
                <span
                  className={`text-[10px] font-bold uppercase tracking-wider rounded-full px-2.5 py-1 ${
                    DOC_TYPE_COLOR[r.docType] ?? 'bg-zinc-100 text-zinc-500'
                  }`}
                >
                  {t(`resources.type.${r.docType}`)}
                </span>
                <button
                  type="button"
                  disabled
                  className="text-xs font-semibold text-[var(--ink-warm)]/30 cursor-not-allowed"
                >
                  {t('page.resources.open')} →
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </InternShell>
  );
}
