import type { ErpNavSection } from './ErpShell';
import {
  IconBook,
  IconChart,
  IconChat,
  IconGrid,
  IconPeople,
  IconRocket,
  IconShield,
} from './ErpShell';
import type { UserRole } from '../auth/types';

interface WorkspaceNavOptions {
  includeRoleSwitcher?: boolean;
}

// Role-pure navigation. Each role sees only the surfaces it owns; shared
// feature pages (chat, simulator, skills) are exposed per role only where
// they're genuinely part of that role's job.
//
//   Intern  → LEARN: learning path, simulator, AI mentor, my progress
//   Mentor  → MENTOR: my interns, ask-queue, availability
//   HR      → RUN: cohort, skills analytics, LMS sync
//   Admin   → all three, plus role switcher

function internSections(): ErpNavSection[] {
  return [
    {
      label: 'Learn',
      items: [
        { to: '/intern', label: 'Today', icon: <IconShield /> },
        { to: '/simulator', label: 'Scenario Lab', icon: <IconRocket /> },
        { to: '/chat', label: 'Ask AI Mentor', icon: <IconChat /> },
      ],
    },
    {
      label: 'Me',
      items: [{ to: '/me', label: 'Progress & Badges', icon: <IconPeople /> }],
    },
  ];
}

function mentorSections(): ErpNavSection[] {
  return [
    {
      label: 'Mentor',
      items: [
        { to: '/employee', label: 'My Interns', icon: <IconPeople /> },
        { to: '/chat', label: 'Knowledge Lookup', icon: <IconChat /> },
      ],
    },
    {
      label: 'Me',
      items: [{ to: '/me', label: 'My Profile', icon: <IconBook /> }],
    },
  ];
}

function hrSections(): ErpNavSection[] {
  return [
    {
      label: 'Run',
      items: [
        { to: '/hr', label: 'Cohort', icon: <IconGrid /> },
        { to: '/skills', label: 'Skills Analytics', icon: <IconChart /> },
      ],
    },
  ];
}

function adminExtras(): ErpNavSection {
  return {
    label: 'Switch role',
    items: [
      { to: '/hr', label: 'HR view', icon: <IconGrid /> },
      { to: '/employee', label: 'Mentor view', icon: <IconPeople /> },
      { to: '/intern', label: 'Intern view', icon: <IconShield /> },
    ],
  };
}

export function buildWorkspaceSections(
  currentRole: UserRole | null,
  opts: WorkspaceNavOptions = {},
): ErpNavSection[] {
  const base = (() => {
    switch (currentRole) {
      case 'intern':
        return internSections();
      case 'employee':
        return mentorSections();
      case 'hr':
        return hrSections();
      case 'admin':
        return hrSections();
      default:
        return internSections();
    }
  })();

  if (opts.includeRoleSwitcher && currentRole === 'admin') {
    return [...base, adminExtras()];
  }
  return base;
}
