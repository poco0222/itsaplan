'use client';

import { useShell } from '@/context/shellContext';
import SettingsGeneralContent from './components/general/SettingsGeneralContent';

export default function SettingsGeneralPage() {
  const { project } = useShell();
  if (!project) return null;
  return <SettingsGeneralContent project={project} />;
}
