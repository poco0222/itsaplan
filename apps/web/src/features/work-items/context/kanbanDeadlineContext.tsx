import { createContext, useMemo, type ReactNode } from 'react';
import { useCurrentTime } from '@/context/relativeTimeContext';
import { toDateStr } from '@/utils/dates';

export const KanbanDeadlineContext = createContext<{
  today: string;
  actualDateFieldId: number | undefined;
}>({ today: '', actualDateFieldId: undefined });

export function KanbanDeadlineProvider({
  actualDateFieldId,
  children,
}: {
  actualDateFieldId: number | undefined;
  children: ReactNode;
}) {
  const today = toDateStr(useCurrentTime());
  const value = useMemo(() => ({ today, actualDateFieldId }), [today, actualDateFieldId]);
  return <KanbanDeadlineContext.Provider value={value}>{children}</KanbanDeadlineContext.Provider>;
}
