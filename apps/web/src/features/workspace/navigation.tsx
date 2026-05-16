import type { ErpNavSection } from './ErpShell';
import {
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

function roleHome(role: UserRole | null) {
  switch (role) {
    case 'hr':
    case 'admin':
      return { to: '/hr', label: 'HR Dashboard', icon: <IconGrid /> };
    case 'intern':
      return { to: '/intern', label: 'Intern Desk', icon: <IconShield /> };
    case 'employee':
      return { to: '/employee', label: 'Employee Desk', icon: <IconPeople /> };
    default:
      return { to: '/employee', label: 'Workspace', icon: <IconPeople /> };
  }
}

function roleSwitcherItems(role: UserRole | null) {
  if (role !== 'admin') return [];
  return [
    { to: '/hr', label: 'HR Dashboard', icon: <IconGrid /> },
    { to: '/employee', label: 'Employee Desk', icon: <IconPeople /> },
    { to: '/intern', label: 'Intern Desk', icon: <IconShield /> },
  ];
}

function operationsForRole(role: UserRole | null) {
  if (role === 'intern') {
    return [
      { to: '/simulator', label: 'Scenario Lab', icon: <IconRocket /> },
      { to: '/chat', label: 'AI Mentor', icon: <IconChat /> },
      { to: '/me', label: 'My Progress', icon: <IconPeople /> },
    ];
  }
  if (role === 'employee') {
    return [
      { to: '/chat', label: 'AI Assistant', icon: <IconChat /> },
      { to: '/skills', label: 'Skills Hub', icon: <IconChart /> },
      { to: '/simulator', label: 'Scenario Lab', icon: <IconRocket /> },
    ];
  }
  return [
    { to: '/chat', label: 'AI Assistant', icon: <IconChat /> },
    { to: '/simulator', label: 'Scenario Lab', icon: <IconRocket /> },
    { to: '/skills', label: 'Skills ERP', icon: <IconChart /> },
  ];
}

export function buildWorkspaceSections(
  currentRole: UserRole | null,
  opts: WorkspaceNavOptions = {},
): ErpNavSection[] {
  const sectionA: ErpNavSection = {
    label: 'Workspace',
    items: [roleHome(currentRole)],
  };
  const switcher = opts.includeRoleSwitcher ? roleSwitcherItems(currentRole) : [];
  if (switcher.length > 0) {
    sectionA.items.push(...switcher);
  }
  return [
    sectionA,
    {
      label: 'Operations',
      items: operationsForRole(currentRole),
    },
  ];
}
