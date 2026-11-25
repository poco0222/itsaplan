import { useState } from 'react';
import { X } from 'lucide-react';
import { useTranslations } from 'next-intl';
import Modal from '@/components/common/overlay/Modal';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { Column, StatusFieldUpdate } from '@/lib/api/endpoints/columns';
import type { ProjectDetail } from '@/lib/api/endpoints/projects';
import { canonicalTimezone } from '@/utils/dates';
import { useUpdateColumn } from '../../services/settings.service';

interface Draft {
  fieldId: number;
  type: StatusFieldUpdate['type'];
  input: string;
}

export default function SettingsStateFieldUpdatesDialog({
  project,
  column,
  onClose,
}: {
  project: ProjectDetail;
  column: Column;
  onClose: () => void;
}) {
  const t = useTranslations('settings.states.fieldUpdates');
  const common = useTranslations('common');
  const updateColumn = useUpdateColumn(project.project.ref);
  const fields = project.customFields.filter(
    ({ fieldType }) => fieldType === 'number' || fieldType === 'date',
  );
  const [rules, setRules] = useState<Draft[]>(() =>
    (column.fieldUpdates ?? [])
      .filter((rule) =>
        fields.some(({ id, fieldType }) => id === rule.fieldId && fieldType === rule.type),
      )
      .map((rule) => ({
        fieldId: rule.fieldId,
        type: rule.type,
        input: rule.type === 'number' ? String(rule.value) : rule.timeZone,
      })),
  );
  const available = fields.filter(({ id }) => !rules.some(({ fieldId }) => id === fieldId));

  function add(fieldId: number) {
    const type = available.find(({ id }) => id === fieldId)?.fieldType;
    if (type !== 'number' && type !== 'date') return;
    const input =
      type === 'number' ? '' : canonicalTimezone(Intl.DateTimeFormat().resolvedOptions().timeZone);
    setRules((current) => [...current, { fieldId, type, input }]);
  }

  function save() {
    const fieldUpdates = rules.map(({ fieldId, type, input }): StatusFieldUpdate =>
      type === 'number'
        ? { fieldId, type, value: Number(input) }
        : { fieldId, type, timeZone: input.trim() },
    );
    updateColumn.mutate({ id: column.id, patch: { fieldUpdates } }, { onSuccess: onClose });
  }

  return (
    <Modal
      title={t('title')}
      description={t('description', { name: column.name })}
      onClose={onClose}
    >
      <form
        className="space-y-4"
        onSubmit={(event) => {
          event.preventDefault();
          save();
        }}
      >
        {rules.map(({ fieldId, type, input }) => {
          const field = fields.find(({ id }) => id === fieldId);
          if (!field) return null;
          const inputId = `status-field-update-${fieldId}`;
          const valueLabel = type === 'number' ? t('number') : t('timeZone');
          return (
            <div key={fieldId} className="space-y-1.5">
              <Label htmlFor={inputId}>
                {field.name} · {valueLabel}
              </Label>
              <div className="flex items-center gap-2">
                <Input
                  id={inputId}
                  dir="ltr"
                  type={type === 'number' ? 'number' : 'text'}
                  step={type === 'number' ? 'any' : undefined}
                  required
                  value={input}
                  onChange={(event) =>
                    setRules(
                      rules.map((rule) =>
                        rule.fieldId === fieldId ? { ...rule, input: event.target.value } : rule,
                      ),
                    )
                  }
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="shrink-0"
                  aria-label={t('remove', { name: field.name })}
                  onClick={() => setRules(rules.filter((rule) => rule.fieldId !== fieldId))}
                >
                  <X />
                </Button>
              </div>
            </div>
          );
        })}
        {available.length > 0 && (
          <Select value="" onValueChange={(value) => add(Number(value))}>
            <SelectTrigger className="w-full" aria-label={t('add')}>
              <SelectValue placeholder={t('add')} />
            </SelectTrigger>
            <SelectContent>
              {available.map(({ id, name }) => (
                <SelectItem key={id} value={String(id)}>
                  {name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
        {fields.length === 0 && <p className="text-sm text-muted-foreground">{t('empty')}</p>}
        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={onClose}>
            {common('cancel')}
          </Button>
          <Button type="submit" disabled={updateColumn.isPending}>
            {common('save')}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
