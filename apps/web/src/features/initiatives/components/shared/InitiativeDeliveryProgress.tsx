import { useFormatter, useTranslations } from 'next-intl';
import { Progress } from '@/components/ui/progress';
import type { Initiative } from '@/lib/api/endpoints/initiatives';

export default function InitiativeDeliveryProgress({
  delivery,
}: {
  delivery: NonNullable<Initiative['delivery']>;
}) {
  const t = useTranslations('issue.deliveryWorkflow');
  const format = useFormatter();
  if (delivery.progress === null) {
    return (
      <span className="text-xs text-muted-foreground">
        {t(`problems.${delivery.problem ?? 'progress'}`)}
      </span>
    );
  }
  const value = format.number(delivery.progress / 100, {
    style: 'percent',
    maximumFractionDigits: 1,
  });
  return (
    <div className="flex items-center gap-2">
      <Progress
        value={delivery.progress}
        aria-label={t('title')}
        aria-valuenow={delivery.progress}
        aria-valuetext={value}
        className="h-1.5 w-16 shrink-0"
      />
      <span className="text-xs text-muted-foreground tabular-nums">{value}</span>
    </div>
  );
}
