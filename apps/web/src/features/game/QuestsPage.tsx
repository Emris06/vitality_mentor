import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../auth/AuthProvider';
import { gameApi } from '../../lib/api';
import { QuestCard } from './QuestCard';
import { InternShell } from '../workspace/InternShell';
import type { Quest } from './types';

const SEED_QUESTS: Quest[] = [
  {
    id: 'daily_chat_3',
    kind: 'daily',
    nameKey: 'quests.daily_chat_3.name',
    descriptionKey: 'quests.daily_chat_3.desc',
    goal: { chatSolved: 3 },
    progress: { chatSolved: 1 },
    rewardXp: 8,
  },
  {
    id: 'weekly_sim_2',
    kind: 'weekly',
    nameKey: 'quests.weekly_sim_2.name',
    descriptionKey: 'quests.weekly_sim_2.desc',
    goal: { simScored: 2 },
    progress: { simScored: 0 },
    rewardXp: 24,
  },
  {
    id: 'onboarding_first_kyc',
    kind: 'onboarding',
    nameKey: 'quests.onboarding_first_kyc.name',
    descriptionKey: 'quests.onboarding_first_kyc.desc',
    goal: { simScoredKyc: 1 },
    progress: { simScoredKyc: 1 },
    rewardXp: 30,
    completedAt: '2026-05-20T10:00:00Z',
  },
];

const KIND_LABEL: Record<string, string> = {
  daily: 'Daily',
  weekly: 'Weekly',
  onboarding: 'Onboarding',
};

export default function QuestsPage() {
  const { t } = useTranslation();
  const { profile } = useAuth();
  const [quests, setQuests] = useState<Quest[] | null>(null);

  const userName = profile?.fullName ?? '';
  const firstName = userName.split(' ')[0] || userName;

  useEffect(() => {
    gameApi
      .quests()
      .then((data) => setQuests(data.length > 0 ? data : SEED_QUESTS))
      .catch(() => setQuests(SEED_QUESTS));
  }, []);

  const active = quests?.filter((q) => !q.completedAt) ?? [];
  const done = quests?.filter((q) => q.completedAt) ?? [];

  return (
    <InternShell
      userName={userName}
      userRole={t('auth.role_intern_name')}
      greeting={t('intern.shell.greeting', { name: firstName })}
      pageTitle={t('page.quests.title')}
    >
      {quests === null ? (
        <div className="space-y-4">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-28 rounded-2xl bg-white/40 animate-pulse" />
          ))}
        </div>
      ) : (
        <>
          {active.length > 0 && (
            <section className="space-y-3">
              <p className="text-xs font-semibold uppercase tracking-widest text-[var(--muted-warm)]">
                {t('page.quests.active')}
              </p>
              {active.map((q) => (
                <div
                  key={q.id}
                  className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-zinc-100"
                >
                  <div className="mb-3 flex items-center gap-2">
                    <span className="rounded-full bg-zinc-100 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-[var(--muted-warm)]">
                      {KIND_LABEL[q.kind] ?? q.kind}
                    </span>
                  </div>
                  <QuestCard quest={q} />
                </div>
              ))}
            </section>
          )}

          {done.length > 0 && (
            <section className="space-y-3">
              <p className="text-xs font-semibold uppercase tracking-widest text-[var(--muted-warm)]">
                {t('page.quests.completed')}
              </p>
              <div className="opacity-60">
                {done.map((q) => (
                  <div
                    key={q.id}
                    className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-zinc-100"
                  >
                    <div className="mb-3 flex items-center gap-2">
                      <span className="rounded-full bg-zinc-100 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-[var(--muted-warm)]">
                        {KIND_LABEL[q.kind] ?? q.kind}
                      </span>
                    </div>
                    <QuestCard quest={q} />
                  </div>
                ))}
              </div>
            </section>
          )}

          {quests.length === 0 && (
            <p className="text-[var(--muted-warm)]">{t('page.quests.empty')}</p>
          )}
        </>
      )}
    </InternShell>
  );
}
