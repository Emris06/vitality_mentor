import type { Locale } from './locale';

export type EmployeeRole = 'hr' | 'mentor' | 'newcomer' | 'employee' | 'admin';

export interface Employee {
  id: string;
  fullName: string;
  role: EmployeeRole;
  department?: string;
  position?: string;
  languages: Locale[];
  currentLoad: number;
  skills: string[];
  hiredAt?: string;
}

export interface Newcomer extends Employee {
  role: 'newcomer';
  startDate: string;
  onboardingDeadline: string;
  assignedMentorId?: string;
  modulesCompleted: number;
  modulesTotal: number;
}

export interface MentorAssignment {
  id: string;
  mentorId: string;
  newcomerId: string;
  status: 'active' | 'completed' | 'paused';
  matchScore: number;
  matchReasons: string[];
  assignedAt: string;
}
