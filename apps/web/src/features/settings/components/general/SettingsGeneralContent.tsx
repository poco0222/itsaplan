import { useTranslations } from 'next-intl';
import type { ProjectDetail } from '@/lib/api/endpoints/projects';
import { settingsSection } from '@/utils/settingsSections';
import { useSettingsSectionText } from '@/hooks/useSectionLabels';
import { Button } from '@/components/ui/button';
import SectionPageView from '@/components/common/page/SectionPageView';
import RequirePermission from '@/components/common/permissions/RequirePermission';
import { SettingsResourceProvider } from '../../context/settingsPermission';
import { useGeneralForm } from '../../hooks/useGeneralForm';
import { useFeatureToggles } from '../../hooks/useFeatureToggles';
import SettingsGeneral from './SettingsGeneral';
import SettingsFeatures from './SettingsFeatures';

const section = settingsSection('general');

export default function SettingsGeneralContent({ project }: { project: ProjectDetail }) {
  const t = useTranslations('common');
  const sectionText = useSettingsSectionText()(section.slug);
  const form = useGeneralForm(project);
  const features = useFeatureToggles(project);
  return (
    <SectionPageView
      title={sectionText.label}
      description={sectionText.description}
      actions={
        form.editable ? (
          <Button size="sm" onClick={() => void form.save()} disabled={!form.canSave}>
            {t('save')}
          </Button>
        ) : undefined
      }
    >
      <SettingsResourceProvider resource={section.resource}>
        <RequirePermission resource={section.resource} action="read">
          <div className="space-y-10">
            <SettingsGeneral form={form} />
            <SettingsFeatures form={features} />
          </div>
        </RequirePermission>
      </SettingsResourceProvider>
    </SectionPageView>
  );
}
