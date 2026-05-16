import type { ErpNavSection } from './ErpShell';
import {
  IconChart,
  IconChat,
  IconGrid,
  IconPeople,
  IconRocket,
  IconShield,
} from './ErpShell';

export function buildWorkspaceSections(): ErpNavSection[] {
  return [
    {
      label: 'Role Homes',
      items: [
        { to: '/hr', label: 'HR Dashboard', icon: <IconGrid /> },
        { to: '/employee', label: 'Employee Desk', icon: <IconPeople /> },
        { to: '/intern', label: 'Intern Desk', icon: <IconShield /> },
      ],
    },
    {
      label: 'Operations',
      items: [
        { to: '/chat', label: 'AI Assistant', icon: <IconChat /> },
        { to: '/simulator', label: 'Scenario Lab', icon: <IconRocket /> },
        { to: '/skills', label: 'Skills ERP', icon: <IconChart /> },
        { to: '/me', label: 'My Progress', icon: <IconPeople /> },
      ],
    },
  ];
}

