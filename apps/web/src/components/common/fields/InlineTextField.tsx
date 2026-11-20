import { useState, type ReactNode } from 'react';
import { Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useTranslations } from 'next-intl';
import { Pill } from './Pill';

// The default trigger keeps unset fields compact in issue details.
export default function InlineTextField({
  value,
  fieldType,
  saveKey,
  label,
  renderTrigger,
  onSave,
}: {
  value: string | number | null;
  fieldType: 'text' | 'number';
  saveKey: string;
  label: string;
  renderTrigger?: (onClick: () => void) => ReactNode;
  onSave: (v: string | number | null) => void;
}) {
  const t = useTranslations('issue.fields');
  const tCommon = useTranslations('common');
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');
  const [invalid, setInvalid] = useState(false);
  const display = value === '' || value == null ? null : String(value);

  function start() {
    setDraft(display ?? '');
    setInvalid(false);
    setEditing(true);
  }

  function commit() {
    if (draft === '') {
      onSave(null);
      setEditing(false);
      return;
    }
    if (fieldType === 'number') {
      const n = Number(draft);
      // Reject anything that is not a finite number (NaN from pasted text,
      // Infinity) — the value column is numeric and the API would reject it.
      if (!Number.isFinite(n)) {
        setInvalid(true);
        return;
      }
      onSave(n);
      setEditing(false);
      return;
    }
    onSave(draft);
    setEditing(false);
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
    <div className="flex items-center gap-1.5">
      <Input
        type={fieldType}
        autoFocus
        value={draft}
        key={saveKey}
        aria-label={label}
        aria-invalid={invalid || undefined}
        className="h-8 max-w-[220px]"
        onChange={(e) => {
          setDraft(e.target.value);
          setInvalid(false);
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter') commit();
          if (e.key === 'Escape') setEditing(false);
        }}
        // Clicking outside cancels the edit (discards the draft). The Save
        // button suppresses this via onMouseDown preventDefault, so the input
        // keeps focus and commit() still runs when it is clicked.
        onBlur={() => setEditing(false)}
      />
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="size-8 shrink-0 text-muted-foreground hover:text-foreground"
        title={tCommon('save')}
        onMouseDown={(e) => e.preventDefault()}
        onClick={commit}
      >
        <Check className="size-4" />
      </Button>
    </div>
  );
}
