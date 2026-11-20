import { useState } from 'react';
import { useTranslations } from 'next-intl';
import Modal from '@/components/common/overlay/Modal';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import type { DeliveryAction } from '@/lib/api/endpoints/deliveryWorkflow';

export default function IssueDeliveryAction({
  action,
  busy,
  onClose,
  onSubmit,
}: {
  action: DeliveryAction;
  busy: boolean;
  onClose: () => void;
  onSubmit: (action: DeliveryAction) => void;
}) {
  const t = useTranslations('issue.deliveryWorkflow');
  const common = useTranslations('common');
  const [reason, setReason] = useState('');
  return (
    <Modal title={t(action.kind)} description={t(`${action.kind}Help`)} onClose={onClose}>
      <form
        className="space-y-4"
        onSubmit={(event) => {
          event.preventDefault();
          onSubmit(action.kind === 'reversal' ? { ...action, reason: reason.trim() } : action);
        }}
      >
        {action.kind === 'reversal' && (
          <div className="space-y-2">
            <Label htmlFor="handoff-reason">{t('reason')}</Label>
            <Textarea
              id="handoff-reason"
              value={reason}
              maxLength={2000}
              required
              onChange={(event) => setReason(event.target.value)}
            />
          </div>
        )}
        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={onClose}>
            {common('cancel')}
          </Button>
          <Button type="submit" disabled={busy || (action.kind === 'reversal' && !reason.trim())}>
            {t(action.kind)}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
