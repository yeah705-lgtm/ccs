/**
 * CLIProxy Tabs Component
 * Tab navigation wrapper for Overview, Config, and Logs tabs
 */

import type { ReactNode } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { LayoutDashboard, FileCode, ScrollText } from 'lucide-react';

export type CliproxyTabValue = 'overview' | 'config' | 'logs';

interface CliproxyTabsProps {
  activeTab: CliproxyTabValue;
  onTabChange: (tab: CliproxyTabValue) => void;
  children: {
    overview: ReactNode;
    config: ReactNode;
    logs: ReactNode;
  };
}

const TAB_CONFIG = [
  { value: 'overview' as const, label: 'Overview', icon: LayoutDashboard },
  { value: 'config' as const, label: 'Config', icon: FileCode },
  { value: 'logs' as const, label: 'Logs', icon: ScrollText },
];

export function CliproxyTabs({ activeTab, onTabChange, children }: CliproxyTabsProps) {
  return (
    <Tabs
      value={activeTab}
      onValueChange={(v) => onTabChange(v as CliproxyTabValue)}
      className="w-full"
    >
      <TabsList className="grid w-full grid-cols-3 max-w-md">
        {TAB_CONFIG.map(({ value, label, icon: Icon }) => (
          <TabsTrigger key={value} value={value} className="gap-2">
            <Icon className="w-4 h-4" />
            <span className="hidden sm:inline">{label}</span>
          </TabsTrigger>
        ))}
      </TabsList>

      <TabsContent value="overview" className="mt-6">
        {children.overview}
      </TabsContent>
      <TabsContent value="config" className="mt-6">
        {children.config}
      </TabsContent>
      <TabsContent value="logs" className="mt-6">
        {children.logs}
      </TabsContent>
    </Tabs>
  );
}
