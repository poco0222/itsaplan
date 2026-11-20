import { useState } from 'react';
import { useFormatter, useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import type { DeliveryAction } from '@/lib/api/endpoints/deliveryWorkflow';
import type { ProjectDetail } from '@/lib/api/endpoints/projects';
import { usePermissions } from '@/hooks/usePermissions';
import type { useDeliveryDetail } from '@/services/deliveryWorkflow.service';
import { formatDateTime } from '@/utils/dates';
import IssueDeliveryAction from './IssueDeliveryAction';

export default function IssueDeliveryWorkflow({
  project,
  delivery,
}: {
  project: ProjectDetail;
  delivery: ReturnType<typeof useDeliveryDetail>;
}) {
  const t = useTranslations('issue.deliveryWorkflow');
  const format = useFormatter();
  const { can } = usePermissions(project);
  const { query, mutate } = delivery;
  const [action, setAction] = useState<DeliveryAction | null>(null);
  const item = query.data?.item;
  if (!item) return null;
  const history = query.data?.history ?? [];
  const active = history.find((entry) => !entry.reversedAt);
  const canManage = can('workflow_config', 'edit') && can('work_items', 'edit');

  return (
    <section aria-label={t('title')} className="mt-4 space-y-2 rounded-md border px-3 py-2 text-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-medium">{t('title')}</h2>
        {item.role === 'module' && (
          <span className="text-xs text-muted-foreground">{t(item.phase)}</span>
        )}
      </div>
      {item.progress !== null && (
        <p>
          {t('progressValue', {
            value: format.number(item.progress / 100, {
              style: 'percent',
              maximumFractionDigits: 2,
            }),
          })}
        </p>
      )}
      {item.problem && <p className="text-muted-foreground">{t(`problems.${item.problem}`)}</p>}
      {item.completed && (
        <p className="text-muted-foreground">
          {t('completionDate', {
            date: item.completedAt ? formatDateTime(item.completedAt) : t('unknown'),
          })}
        </p>
      )}
      {canManage && (
        <div className="flex flex-wrap gap-2">
          {item.canConfirm && (
            <Button size="sm" variant="outline" onClick={() => setAction({ kind: 'handoff' })}>
              {t('handoff')}
            </Button>
          )}
          {active && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => setAction({ kind: 'reversal', handoffId: active.id, reason: '' })}
            >
              {t('reversal')}
            </Button>
          )}
          {item.completedAt && !active && (
            <Button size="sm" variant="ghost" onClick={() => setAction({ kind: 'legacy' })}>
              {t('legacy')}
            </Button>
          )}
        </div>
      )}
      {history.length > 0 && (
        <details className="text-xs">
          <summary className="cursor-pointer text-muted-foreground">{t('history')}</summary>
          <ul className="mt-2 space-y-2">
            {history.map((entry) => (
              <li key={entry.id} className="space-y-1">
                <p>
                  {t('confirmedEvent', {
                    who: entry.confirmedBy ?? t('unknown'),
                    when: formatDateTime(entry.confirmedAt),
                  })}
                </p>
                {entry.reversedAt && (
                  <>
                    <p>
                      {t('reversedEvent', {
                        who: entry.reversedBy ?? t('unknown'),
                        when: formatDateTime(entry.reversedAt),
                      })}
                    </p>
                    <p dir="auto" className="break-words text-muted-foreground">
                      {entry.reversalReason}
                    </p>
                  </>
                )}
              </li>
            ))}
          </ul>
        </details>
      )}
      {action && (
        <IssueDeliveryAction
          action={action}
          busy={mutate.isPending}
          onClose={() => setAction(null)}
          onSubmit={(input) =>
            mutate.mutate(input, {
              onSuccess: () => {
                toast.success(t('saved'));
                setAction(null);
              },
            })
          }
        />
      )}
    </section>
  );
}
