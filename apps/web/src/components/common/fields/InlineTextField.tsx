import { useRef, useState, type ReactNode } from 'react';
import { Check } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { Pill } from './Pill';

// The default trigger keeps unset fields compact in issue details.
export default function InlineTextField({
  value,
  fieldType,
  saveKey,
  label,
  compact = false,
  percentage = false,
  renderTrigger,
  onSave,
}: {
  value: string | number | null;
  fieldType: 'text' | 'number';
  saveKey: string;
  label: string;
  compact?: boolean;
  percentage?: boolean;
  renderTrigger?: (onClick: () => void) => ReactNode;
  onSave: (v: string | number | null) => void;
}) {
  const t = useTranslations('issue.fields');
  const tCommon = useTranslations('common');
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');
  const [invalid, setInvalid] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const closed = useRef(false);
  const display = value === '' || value == null ? null : String(value);

  function start() {
    setDraft(display ?? '');
    setInvalid(false);
    closed.current = false;
    setEditing(true);
  }

  function close() {
    closed.current = true;
    setEditing(false);
  }

  function commit(blur = false) {
    if (closed.current) return;
    let next: string | number | null = draft || null;
    if (fieldType === 'number' && next !== null) next = Number(next);
    if (
      (typeof next === 'number' && !Number.isFinite(next)) ||
      (percentage && input.current?.validity.valid === false)
    ) {
      if (blur) close();
      else setInvalid(true);
      return;
    }
    close();
    if (!percentage || next !== value) onSave(next);
  }

  if (!editing) {
    if (renderTrigger) return renderTrigger(start);
    return (
      <Pill active={display != null} onClick={start}>
        <span className="max-w-[240px] truncate">{display ?? t('empty')}</span>
      </Pill>
    );
  }

  return (
    <div
      className={cn(
        'flex items-center',
        compact
          ? 'max-w-32 min-w-0 rounded-md border border-input bg-background focus-within:border-ring focus-within:ring-1 focus-within:ring-ring has-aria-invalid:border-destructive has-aria-invalid:ring-destructive'
          : 'gap-1.5',
      )}
    >
      <Input
        ref={input}
        type={fieldType}
        {...(percentage && { min: 0, max: 100, step: 'any' })}
        autoFocus
        value={draft}
        key={saveKey}
        aria-label={label}
        aria-invalid={invalid || undefined}
        className={
          compact
            ? 'h-6 flex-1 [appearance:textfield] rounded-none border-0 ps-0.5 pe-0 tabular-nums shadow-none focus-visible:ring-0 md:text-xs [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none'
            : 'h-8 max-w-[220px]'
        }
        onChange={(e) => {
          setDraft(e.target.value);
          setInvalid(false);
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter') commit();
          if (e.key === 'Escape') close();
        }}
        onBlur={() => (percentage ? commit(true) : close())}
      />
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        className={cn('text-muted-foreground hover:text-foreground', compact && 'size-6')}
        title={tCommon('save')}
        onMouseDown={(e) => e.preventDefault()}
        onClick={() => commit()}
      >
        <Check className="size-4" />
      </Button>
    </div>
  );
}
