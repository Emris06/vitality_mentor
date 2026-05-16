export interface HealthCheck {
  name: string;
  status: 'ok' | 'degraded' | 'down';
  latencyMs?: number;
  detail?: string;
}

export interface HealthResponse {
  status: 'ok' | 'degraded' | 'down';
  version: string;
  checks: HealthCheck[];
  timestamp: string;
}
