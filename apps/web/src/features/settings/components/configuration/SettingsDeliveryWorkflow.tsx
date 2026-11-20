import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { usePermissions } from '@/hooks/usePermissions';
import type { DeliverySettings } from '@/lib/api/endpoints/deliveryWorkflow';
import type { ProjectDetail } from '@/lib/api/endpoints/projects';
import { useDeliveryBindings } from '@/services/deliveryWorkflow.service';

const typeKeys = ['moduleTypeId', 'nodeTypeId', 'taskTypeId', 'maintenanceTypeId'] as const;
const fieldKeys = {
  nodeWeightId: 'nodeTypeId',
  taskWeightId: 'taskTypeId',
  nodeProgressId: 'nodeTypeId',
  taskProgressId: 'taskTypeId',
} as const;
const keys: (keyof DeliverySettings)[] = [
  ...typeKeys,
  'nodeWeightId',
  'taskWeightId',
  'nodeProgressId',
  'taskProgressId',
];

export default function SettingsDeliveryWorkflow({ project }: { project: ProjectDetail }) {
  const t = useTranslations('settings.deliveryWorkflow');
  const common = useTranslations('common');
  const { can } = usePermissions(project);
  const { query, save } = useDeliveryBindings(project.project.ref);
  const [draft, setDraft] = useState<Partial<DeliverySettings>>({});
  const current = query.data?.settings;
  const settings = { ...current, ...draft };
  const editable = can('workflow_config', 'edit');
  const options = (key: keyof DeliverySettings) =>
    key in fieldKeys
      ? project.customFields.filter(
          (field) =>
            field.fieldType === 'number' &&
            (field.issueTypeId === null ||
              field.issueTypeId === settings[fieldKeys[key as keyof typeof fieldKeys]]),
        )
      : project.issueTypes;
  const ready =
    keys.every((key) => options(key).some(({ id }) => id === settings[key])) &&
    new Set(typeKeys.map((key) => settings[key])).size === typeKeys.length &&
    settings.nodeWeightId !== settings.nodeProgressId &&
    settings.taskWeightId !== settings.taskProgressId;

  function submit() {
    if (!ready) return;
    save.mutate(settings as DeliverySettings, {
      onSuccess: () => {
        setDraft({});
        toast.success(t('saved'));
      },
    });
  }

  return (
    <section className="space-y-4">
      <div>
        <h2 className="text-sm font-semibold">{t('title')}</h2>
        <p className="text-sm text-muted-foreground">{t('description')}</p>
      </div>
      {query.isError && (
        <p className="text-sm text-destructive" role="alert">
          {t('loadError')}
        </p>
      )}
      {!query.isPending && !query.isError && (
        <div className="grid gap-3 sm:grid-cols-2">
          {keys.map((key) => {
            const entries = options(key);
            return editable ? (
              <div key={key} className="space-y-2">
                <Label htmlFor={`delivery-${key}`}>{t(key)}</Label>
                <select
                  id={`delivery-${key}`}
                  className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
                  value={entries.some(({ id }) => id === settings[key]) ? settings[key] : 0}
                  onChange={(event) => setDraft({ ...draft, [key]: Number(event.target.value) })}
                >
                  <option value={0}>{t('choose')}</option>
                  {entries.map(({ id, name }) => (
                    <option key={id} value={id}>
                      {name}
                    </option>
                  ))}
                </select>
              </div>
            ) : (
              <p key={key} className="text-sm">
                {t(key)} · {entries.find(({ id }) => id === settings[key])?.name ?? t('choose')}
              </p>
            );
          })}
          {editable && (
            <div className="sm:col-span-2">
              <Button size="sm" disabled={!ready || save.isPending} onClick={submit}>
                {current ? common('save') : t('enable')}
              </Button>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
