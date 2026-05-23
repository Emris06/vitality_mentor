import {
  IconBoard,
  IconBook,
  IconChart,
  IconChat,
  IconCheckBoard,
  IconHome,
  IconMessage,
  IconPeople,
  type MentoraNavItem,
} from './InternShell';
import type { UserRole } from '../auth/types';

// ──────────────────────────────────────────────────────────────────────────
// Per-role navy-sidebar nav for the warm Mentora shell.
//
// Same chrome across every role; only the slots differ. Items carry i18n
// KEYS, not resolved strings — the shell calls `t(...)` at render time.
//
// "Coming soon" placeholders are intentional: they signal future product
// scope (Messages, Resources, Reports) to the user without committing to a
// route. They're rendered dimmed + with a tooltip explaining they're not
// shipped yet. The 6-slot sidebar fills naturally; we don't pad otherwise.
// ──────────────────────────────────────────────────────────────────────────

const INTERN_NAV: MentoraNavItem[] = [
  {
    to: '/intern',
    labelKey: 'nav.home',
    icon: <IconHome />,
    matchExact: true,
    clickyTarget: 'home, dashboard, today, intern',
    clickyHintKey: 'clicky.hint.nav.home',
  },
  {
    to: '/simulator',
    labelKey: 'nav.scenarios',
    icon: <IconBoard />,
    clickyTarget: 'scenarios, simulator, catalog, browse, lab',
    clickyHintKey: 'clicky.hint.nav.scenarios',
  },
  {
    to: '/quests',
    labelKey: 'nav.quests',
    icon: <IconCheckBoard />,
    clickyTarget: 'quests, tasks, todo',
  },
  {
    to: '/chat',
    labelKey: 'nav.chat',
    icon: <IconChat />,
    clickyTarget: 'chat, ai, mentor, ask, bank, question',
    clickyHintKey: 'clicky.hint.nav.chat',
  },
  {
    to: '/messages',
    labelKey: 'nav.messages',
    icon: <IconMessage />,
    badge: 'dot',
    clickyTarget: 'messages, inbox, mail',
  },
  {
    to: '/resources',
    labelKey: 'nav.resources',
    icon: <IconBook />,
    clickyTarget: 'resources, docs, library, sop',
  },
];

const MENTOR_NAV: MentoraNavItem[] = [
  {
    to: '/employee',
    labelKey: 'nav.home',
    icon: <IconHome />,
    matchExact: true,
    clickyTarget: 'home, dashboard, my interns, mentees',
    clickyHintKey: 'clicky.hint.nav.home',
  },
  {
    to: '/simulator',
    labelKey: 'nav.scenarios',
    icon: <IconBoard />,
    clickyTarget: 'scenarios, simulator, review, catalog',
    clickyHintKey: 'clicky.hint.nav.scenarios',
  },
  {
    to: '/chat',
    labelKey: 'nav.knowledge',
    icon: <IconChat />,
    clickyTarget: 'knowledge, lookup, chat, ai, ask',
    clickyHintKey: 'clicky.hint.nav.chat',
  },
  {
    to: '/messages',
    labelKey: 'nav.messages',
    icon: <IconMessage />,
    badge: 'dot',
    clickyTarget: 'messages, inbox, mail',
  },
  {
    to: '/resources',
    labelKey: 'nav.resources',
    icon: <IconBook />,
    clickyTarget: 'resources, docs, library, sop',
  },
];

const HR_NAV: MentoraNavItem[] = [
  {
    to: '/hr',
    labelKey: 'nav.home',
    icon: <IconHome />,
    matchExact: true,
    clickyTarget: 'home, dashboard, cohort, hr',
    clickyHintKey: 'clicky.hint.nav.home',
  },
  {
    to: '/hr?tab=newcomers',
    labelKey: 'nav.newcomers',
    icon: <IconPeople />,
    clickyTarget: 'newcomers, interns, list, cohort',
  },
  {
    to: '/hr?tab=mentors',
    labelKey: 'nav.mentors',
    icon: <IconBoard />,
    clickyTarget: 'mentors, employees, assign, match',
  },
  {
    to: '/hr?tab=performance',
    labelKey: 'nav.performance',
    icon: <IconChart />,
    clickyTarget: 'performance, scores, analytics, reports',
  },
  {
    to: '/messages',
    labelKey: 'nav.messages',
    icon: <IconMessage />,
    badge: 'dot',
    clickyTarget: 'messages, inbox, mail',
  },
];

/**
 * Build the navy-sidebar nav for a given role.
 *
 * Falls back to the intern nav for unknown / null roles — keeps the shell
 * functional on routes reached before auth resolves.
 */
export function buildMentoraNav(role: UserRole | null | undefined): MentoraNavItem[] {
  switch (role) {
    case 'hr':
    case 'admin':
      return HR_NAV;
    case 'employee':
      return MENTOR_NAV;
    case 'intern':
    default:
      return INTERN_NAV;
  }
}
