import { createContext, useMemo, type ReactNode } from 'react';
import { useCurrentTime } from '@/context/relativeTimeContext';
import type { DeliveryItem } from '@/lib/api/endpoints/deliveryWorkflow';
import { toDateStr } from '@/utils/dates';

export const KanbanDeadlineContext = createContext<{
  today: string;
  actualDateFieldId: number | undefined;
  deliveryById?: Map<number, DeliveryItem>;
}>({ today: '', actualDateFieldId: undefined });

export function KanbanDeadlineProvider({
  actualDateFieldId,
  deliveryById,
  children,
}: {
  actualDateFieldId: number | undefined;
  deliveryById?: Map<number, DeliveryItem>;
  children: ReactNode;
}) {
  const today = toDateStr(useCurrentTime());
  const value = useMemo(
    () => ({ today, actualDateFieldId, deliveryById }),
    [today, actualDateFieldId, deliveryById],
  );
  return <KanbanDeadlineContext.Provider value={value}>{children}</KanbanDeadlineContext.Provider>;
}
