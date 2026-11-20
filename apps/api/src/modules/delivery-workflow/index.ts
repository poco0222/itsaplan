import { Elysia, t } from 'elysia';
import { assertPermission, requireUser } from '#shared/access';
import { authContext } from '#shared/auth-context';
import { guards, requiresPermission } from '#shared/guards';
import { commonErrors, errors } from '#shared/responses';
import {
  DeliveryDetail,
  DeliveryItem,
  DeliverySettings,
  deliveryItemParams,
  legacyCompletionsBody,
  reverseHandoffBody,
} from './model';
import {
  confirmDeliveryHandoff,
  markLegacyCompletions,
  readDeliveryDetail,
  readDeliveryItems,
  readDeliverySettings,
  reverseDeliveryHandoff,
  writeDeliverySettings,
} from './service';

const mutationResponse = { 200: t.Object({ id: t.Number() }), ...commonErrors, ...errors(409) };

export const deliveryWorkflowRoutes = new Elysia({
  name: 'delivery-workflow',
  detail: { tags: ['Delivery Workflow'] },
})
  .use(authContext)
  .use(guards)
  .get(
    '/projects/:projectKey/settings/delivery-workflow',
    async ({ project }) => ({ settings: await readDeliverySettings(project.id) }),
    {
      permission: ['workflow_config', 'read'],
      response: { 200: t.Object({ settings: t.Nullable(DeliverySettings) }), ...commonErrors },
      detail: { summary: 'Get delivery workflow settings' },
    },
  )
  .put(
    '/projects/:projectKey/settings/delivery-workflow',
    ({ project, body }) => writeDeliverySettings(project.id, body),
    {
      permission: ['workflow_config', 'edit'],
      body: DeliverySettings,
      response: { 200: DeliverySettings, ...commonErrors, ...errors(409) },
      detail: { summary: 'Configure the delivery workflow' },
    },
  )
  .get('/projects/:projectKey/delivery-workflow', ({ project }) => readDeliveryItems(project.id), {
    permission: ['work_items', 'read'],
    response: { 200: t.Array(DeliveryItem), ...commonErrors },
    detail: { summary: 'Get effective progress and completion dates for project delivery work' },
  })
  .get(
    '/projects/:projectKey/delivery-workflow/:issueId',
    ({ project, params }) => readDeliveryDetail(project.id, params.issueId),
    {
      permission: ['work_items', 'read'],
      params: deliveryItemParams,
      response: { 200: DeliveryDetail, ...commonErrors },
      detail: { summary: 'Get delivery progress and handoff history for a work item' },
    },
  )
  .post(
    '/projects/:projectKey/delivery-workflow/:issueId/handoff',
    async ({ project, params, user }) => {
      await assertPermission(project.id, user, 'work_items', 'edit');
      return confirmDeliveryHandoff(project.id, params.issueId, requireUser(user).id);
    },
    {
      permission: ['workflow_config', 'edit'],
      params: deliveryItemParams,
      response: mutationResponse,
      detail: {
        summary: 'Confirm maintenance handoff',
        ...requiresPermission(['work_items', 'edit']),
      },
    },
  )
  .post(
    '/projects/:projectKey/delivery-workflow/:issueId/reversal',
    async ({ project, params, body, user }) => {
      await assertPermission(project.id, user, 'work_items', 'edit');
      return reverseDeliveryHandoff(
        project.id,
        params.issueId,
        requireUser(user).id,
        body.handoffId,
        body.reason,
      );
    },
    {
      permission: ['workflow_config', 'edit'],
      params: deliveryItemParams,
      body: reverseHandoffBody,
      response: mutationResponse,
      detail: {
        summary: 'Reverse a maintenance handoff',
        ...requiresPermission(['work_items', 'edit']),
      },
    },
  )
  .post(
    '/projects/:projectKey/delivery-workflow/legacy-completions',
    async ({ project, body, user }) => {
      await assertPermission(project.id, user, 'work_items', 'edit');
      return markLegacyCompletions(project.id, body.issueIds);
    },
    {
      permission: ['workflow_config', 'edit'],
      body: legacyCompletionsBody,
      response: { 200: t.Object({ count: t.Number() }), ...commonErrors },
      detail: {
        summary: 'Mark selected historical completion dates as unknown',
        ...requiresPermission(['work_items', 'edit']),
      },
    },
  );
