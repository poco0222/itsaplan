import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useLiveRefresh } from '@/hooks/useLiveRefresh';
import {
  applyDeliveryAction,
  getDeliveryDetail,
  getDeliverySettings,
  listDeliveryItems,
  putDeliverySettings,
  type DeliveryAction,
  type DeliverySettings,
} from '@/lib/api/endpoints/deliveryWorkflow';
import { revScope } from '@/utils/revScopes';

const projectKey = (project: string) => ['delivery-workflow', project] as const;

export function useDeliveryBindings(project: string) {
  const client = useQueryClient();
  const key = [...projectKey(project), 'settings'];
  const query = useQuery({ queryKey: key, queryFn: () => getDeliverySettings(project) });
  const save = useMutation({
    mutationFn: (settings: DeliverySettings) => putDeliverySettings(project, settings),
    onSuccess: (settings) => {
      client.setQueryData(key, { settings });
      void client.invalidateQueries({ queryKey: projectKey(project) });
    },
  });
  return { query, save };
}

export function useDeliveryItems(project: string, projectId: number, enabled: boolean) {
  const key = [...projectKey(project), 'items'];
  useLiveRefresh({ scope: revScope.board(projectId), targets: [key], enabled });
  return useQuery({ queryKey: key, queryFn: () => listDeliveryItems(project), enabled });
}

export function useDeliveryDetail(project: string, projectId: number, issueId: number) {
  const client = useQueryClient();
  const key = [...projectKey(project), 'issue', issueId];
  useLiveRefresh({ scope: revScope.board(projectId), targets: [key] });
  const query = useQuery({ queryKey: key, queryFn: () => getDeliveryDetail(project, issueId) });
  const mutate = useMutation({
    mutationFn: (action: DeliveryAction) => applyDeliveryAction(project, issueId, action),
    onSuccess: () => void client.invalidateQueries({ queryKey: projectKey(project) }),
  });
  return { query, mutate };
}
