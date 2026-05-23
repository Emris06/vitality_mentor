import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../auth/AuthProvider';
import { internApi } from '../../lib/api';
import { InternShell } from '../workspace/InternShell';
import type { InternActivityEntry } from '../../lib/api';

const LAST_READ_KEY = 'vitality.messages.lastRead';

const now = Date.now();
const SEED_ACTIVITY: InternActivityEntry[] = [
  {
    id: 'seed-1',
    variant: 'mentor_assigned',
    actorName: 'Sardor Rakhimov',
    createdAt: new Date(now - 30 * 60 * 1000).toISOString(),
  },
  {
    id: 'seed-2',
    variant: 'sim_scored',
    actorName: 'KYC Verification · 87 pts',
    createdAt: new Date(now - 3 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: 'seed-3',
    variant: 'quest_completed',
    actorName: 'First KYC onboarding · +30 XP',
    createdAt: new Date(now - 26 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: 'seed-4',
    variant: 'sim_scored',
    actorName: 'Open Account · 92 pts',
    createdAt: new Date(now - 28 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: 'seed-5',
    variant: 'quest_completed',
    actorName: 'Three questions to the mentor · +8 XP',
    createdAt: new Date(now - 3 * 24 * 60 * 60 * 1000).toISOString(),
  },
];

function groupByDate(entries: InternActivityEntry[]) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  const groups: { label: string; items: InternActivityEntry[] }[] = [];
  const todayItems = entries.filter((e) => new Date(e.createdAt) >= today);
  const yestItems = entries.filter(
    (e) => new Date(e.createdAt) >= yesterday && new Date(e.createdAt) < today,
  );
  const earlierItems = entries.filter((e) => new Date(e.createdAt) < yesterday);

  if (todayItems.length) groups.push({ label: 'page.messages.today', items: todayItems });
  if (yestItems.length) groups.push({ label: 'page.messages.yesterday', items: yestItems });
  if (earlierItems.length) groups.push({ label: 'page.messages.earlier', items: earlierItems });
  return groups;
}

const VARIANT_ICON: Record<string, string> = {
  sim_scored: '⭐',
  mentor_assigned: '👤',
  quest_completed: '✓',
};

const VARIANT_COLOR: Record<string, string> = {
  sim_scored: 'bg-amber-50 text-amber-700',
  mentor_assigned: 'bg-blue-50 text-blue-700',
  quest_completed: 'bg-emerald-50 text-emerald-700',
};

export default function MessagesPage() {
  const { t } = useTranslation();
  const { profile } = useAuth();
  const [entries, setEntries] = useState<InternActivityEntry[] | null>(null);
  const lastRead = localStorage.getItem(LAST_READ_KEY);

  const userName = profile?.fullName ?? '';
  const firstName = userName.split(' ')[0] || userName;

  useEffect(() => {
    internApi
      .activity({ limit: 20 })
      .then((data) => setEntries(data.length > 0 ? data : SEED_ACTIVITY))
      .catch(() => setEntries(SEED_ACTIVITY));
    localStorage.setItem(LAST_READ_KEY, new Date().toISOString());
  }, []);

  const groups = entries ? groupByDate(entries) : [];

  return (
    <InternShell
      userName={userName}
      userRole={t('auth.role_intern_name')}
      greeting={t('intern.shell.greeting', { name: firstName })}
      pageTitle={t('page.messages.title')}
    >
      {entries === null ? (
        <div className="space-y-3">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="h-16 rounded-xl bg-white/40 animate-pulse" />
          ))}
        </div>
      ) : entries.length === 0 ? (
        <p className="text-[var(--muted-warm)]">{t('page.messages.empty')}</p>
      ) : (
        <div className="space-y-6">
          {groups.map((group) => (
            <section key={group.label} className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-widest text-[var(--muted-warm)]">
                {t(group.label)}
              </p>
              {group.items.map((entry) => {
                const isUnread =
                  !lastRead || new Date(entry.createdAt) > new Date(lastRead);
                return (
                  <div
                    key={entry.id}
                    className={`flex items-center gap-3 rounded-xl bg-white p-4 shadow-sm ring-1 ring-zinc-100 transition ${
                      isUnread ? 'border-l-[3px] border-mentora-600' : ''
                    }`}
                  >
                    <span
                      className={`grid h-9 w-9 shrink-0 place-items-center rounded-full text-sm font-bold ${
                        VARIANT_COLOR[entry.variant] ?? 'bg-zinc-100 text-zinc-500'
                      }`}
                    >
                      {VARIANT_ICON[entry.variant] ?? '•'}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-[var(--ink-warm)]">
                        {t(`activity.${entry.variant}`)}
                      </p>
                      <p className="text-xs text-[var(--muted-warm)] truncate mt-0.5">
                        {entry.actorName}
                      </p>
                    </div>
                    <div className="shrink-0 text-right">
                      {isUnread && (
                        <span className="mb-1 block h-2 w-2 rounded-full bg-mentora-600 ml-auto" />
                      )}
                      <time className="text-xs text-[var(--muted-warm)]">
                        {new Date(entry.createdAt).toLocaleTimeString([], {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </time>
                    </div>
                  </div>
                );
              })}
            </section>
          ))}
        </div>
      )}
    </InternShell>
  );
}
