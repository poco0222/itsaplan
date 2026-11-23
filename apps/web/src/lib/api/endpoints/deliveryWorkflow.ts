import { request } from '@/lib/api/core/client';

export interface DeliverySettings {
  moduleTypeId: number;
  nodeTypeId: number;
  taskTypeId: number;
  maintenanceTypeId: number;
  nodeWeightId: number;
  taskWeightId: number;
  nodeProgressId: number;
  taskProgressId: number;
}

export interface DeliveryItem {
  id: number;
  moduleId: number | null;
  childTypeId: number | null;
  role: 'module' | 'node' | 'task' | 'maintenance';
  phase: 'delivery' | 'maintenance';
  progress: number | null;
  progressFieldId: number | null;
  weightFieldId?: number | null;
  progressReadOnly: boolean;
  problem: 'hierarchy' | 'children' | 'weights' | 'child' | 'progress' | null;
  canConfirm: boolean;
  completed: boolean;
  completedAt: string | null;
}

interface Handoff {
  id: number;
  confirmedBy: string | null;
  confirmedAt: string;
  reversedBy: string | null;
  reversedAt: string | null;
  reversalReason: string | null;
}

interface DeliveryDetail {
  item: DeliveryItem | null;
  history: Handoff[];
}

export type DeliveryAction =
  | { kind: 'handoff' }
  | { kind: 'reversal'; handoffId: number; reason: string }
  | { kind: 'legacy' };

const projectPath = (projectKey: string) => `/projects/${encodeURIComponent(projectKey)}`;

export function getDeliverySettings(projectKey: string) {
  return request<{ settings: DeliverySettings | null }>(
    `${projectPath(projectKey)}/settings/delivery-workflow`,
  );
}

export function putDeliverySettings(projectKey: string, settings: DeliverySettings) {
  return request<DeliverySettings>(`${projectPath(projectKey)}/settings/delivery-workflow`, {
    method: 'PUT',
    body: JSON.stringify(settings),
  });
}

export function listDeliveryItems(projectKey: string) {
  return request<DeliveryItem[]>(`${projectPath(projectKey)}/delivery-workflow`);
}

export function getDeliveryDetail(projectKey: string, issueId: number) {
  return request<DeliveryDetail>(`${projectPath(projectKey)}/delivery-workflow/${issueId}`);
}

export function applyDeliveryAction(projectKey: string, issueId: number, action: DeliveryAction) {
  const base = `${projectPath(projectKey)}/delivery-workflow`;
  if (action.kind === 'legacy') {
    return request(`${base}/legacy-completions`, {
      method: 'POST',
      body: JSON.stringify({ issueIds: [issueId] }),
    });
  }
  return request(`${base}/${issueId}/${action.kind}`, {
    method: 'POST',
    body:
      action.kind === 'reversal'
        ? JSON.stringify({ handoffId: action.handoffId, reason: action.reason })
        : undefined,
  });
}
