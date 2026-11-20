import { useFormatter, useTranslations } from 'next-intl';
import type { DeliveryItem } from '@/lib/api/endpoints/deliveryWorkflow';

export default function DeliveryProgressBadge({
  item,
  valueOnly = false,
}: {
  item: DeliveryItem;
  valueOnly?: boolean;
}) {
  const t = useTranslations('issue.deliveryWorkflow');
  const format = useFormatter();
  if (item.progress === null && !item.problem && !valueOnly) return null;
  let label = '—';
  if (item.problem) {
    label = t(`problems.${item.problem}`);
  } else if (item.progress !== null) {
    const value = format.number(item.progress / 100, {
      style: 'percent',
      maximumFractionDigits: 2,
    });
    label = valueOnly ? value : t('progressValue', { value });
  }
  return <span className="shrink-0 text-xs text-muted-foreground tabular-nums">{label}</span>;
}
