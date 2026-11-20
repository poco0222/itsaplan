import { useFormatter, useTranslations } from 'next-intl';
import type { DeliveryItem } from '@/lib/api/endpoints/deliveryWorkflow';

export default function DeliveryProgressBadge({ item }: { item: DeliveryItem }) {
  const t = useTranslations('issue.deliveryWorkflow');
  const format = useFormatter();
  if (item.progress === null && !item.problem) return null;
  const label = item.problem
    ? t(`problems.${item.problem}`)
    : t('progressValue', {
        value: format.number((item.progress ?? 0) / 100, {
          style: 'percent',
          maximumFractionDigits: 2,
        }),
      });
  return <span className="shrink-0 text-xs text-muted-foreground tabular-nums">{label}</span>;
}
