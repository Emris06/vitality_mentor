export interface SkillNode {
  id: string;
  nameKey: string;
  category: string;
  relatedSkillIds: string[];
}

export interface SkillLevel {
  skillId: string;
  xp: number;
  level: number;
  updatedAt: string;
}

export interface SkillGap {
  skillId: string;
  current: number;
  target: number;
  severity: 'low' | 'medium' | 'high';
}

export interface PromotionReadiness {
  employeeId: string;
  targetRole: string;
  ready: boolean;
  metRequirements: string[];
  missingRequirements: string[];
  confidence: number;
}

export interface SkillForecastPoint {
  date: string;
  expected: number;
  lower: number;
  upper: number;
}

export interface SkillForecast {
  skillId: string;
  horizonDays: number;
  points: SkillForecastPoint[];
}
