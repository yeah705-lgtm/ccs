/**
 * Router Profile Editor - Edit profile details with tier configurations
 * 2-column layout with tier config on left and tabbed preview (YAML/Settings) on right
 */
/* eslint-disable react-hooks/set-state-in-effect */

import { useState, useEffect, useCallback, useMemo, Suspense, lazy } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Save, TestTube2, Loader2, Code2, Terminal, FileJson, RefreshCw } from 'lucide-react';
import { RouterTierConfig } from './router-tier-config';
import { useRouterProviders } from '@/hooks/use-router-providers';
import {
  useUpdateRouterProfile,
  useTestRouterProfile,
  useRouterProfileSettings,
  useUpdateRouterProfileSettings,
  useRegenerateRouterProfileSettings,
} from '@/hooks/use-router-profiles';
import { CopyButton } from '@/components/ui/copy-button';
import type { RouterProfile, TierConfig } from '@/lib/router-types';

// Lazy load CodeEditor
const CodeEditor = lazy(() =>
  import('@/components/shared/code-editor').then((m) => ({ default: m.CodeEditor }))
);

interface RouterProfileEditorProps {
  profile: RouterProfile;
  onHasChanges?: (hasChanges: boolean) => void;
}

export function RouterProfileEditor({ profile, onHasChanges }: RouterProfileEditorProps) {
  const [description, setDescription] = useState(profile.description ?? '');
  const [tiers, setTiers] = useState(profile.tiers);
  const [settingsEdits, setSettingsEdits] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<string>('yaml');

  const { data: providersData } = useRouterProviders();
  const updateMutation = useUpdateRouterProfile();
  const testMutation = useTestRouterProfile();

  // Settings hooks
  const { data: settingsData, isLoading: settingsLoading } = useRouterProfileSettings(profile.name);
  const updateSettingsMutation = useUpdateRouterProfileSettings();
  const regenerateSettingsMutation = useRegenerateRouterProfileSettings();

  const providers = providersData?.providers ?? [];

  // Track profile config changes
  const hasProfileChanges =
    description !== (profile.description ?? '') ||
    JSON.stringify(tiers) !== JSON.stringify(profile.tiers);

  // Track settings changes
  const hasSettingsChanges = useMemo(() => {
    if (!settingsEdits || !settingsData) return false;
    return settingsEdits !== JSON.stringify(settingsData.settings, null, 2);
  }, [settingsEdits, settingsData]);

  // Combined changes
  const hasChanges = hasProfileChanges || hasSettingsChanges;

  useEffect(() => {
    onHasChanges?.(hasChanges);
  }, [hasChanges, onHasChanges]);

  // Initialize settings edits when data loads
  useEffect(() => {
    if (settingsData && settingsEdits === null) {
      setSettingsEdits(JSON.stringify(settingsData.settings, null, 2));
    }
  }, [settingsData, settingsEdits]);

  // Reset settings edits when profile changes
  useEffect(() => {
    setSettingsEdits(null);
  }, [profile.name]);

  const handleTierChange = useCallback((tier: 'opus' | 'sonnet' | 'haiku', config: TierConfig) => {
    setTiers((prev) => ({ ...prev, [tier]: config }));
  }, []);

  const handleSaveProfile = () => {
    updateMutation.mutate({
      name: profile.name,
      data: { description: description || undefined, tiers },
    });
  };

  const handleSaveSettings = () => {
    if (!settingsEdits) return;
    try {
      const parsed = JSON.parse(settingsEdits);
      updateSettingsMutation.mutate({
        name: profile.name,
        settings: parsed,
        expectedMtime: settingsData?.mtime,
      });
    } catch {
      // Invalid JSON - ignore
    }
  };

  const handleRegenerateSettings = () => {
    regenerateSettingsMutation.mutate(profile.name, {
      onSuccess: (data) => {
        setSettingsEdits(JSON.stringify(data.settings, null, 2));
      },
    });
  };

  const handleTest = () => {
    testMutation.mutate(profile.name);
  };

  // Check if settings JSON is valid
  const isSettingsJsonValid = useMemo(() => {
    if (!settingsEdits) return true;
    try {
      JSON.parse(settingsEdits);
      return true;
    } catch {
      return false;
    }
  }, [settingsEdits]);

  // Generate YAML preview for the config panel
  const yamlPreview = useMemo(() => {
    const tierToYaml = (tier: TierConfig) => {
      const lines = [
        `      provider: ${tier.provider || '""'}`,
        `      model: ${tier.model || '""'}`,
      ];
      if (tier.fallback && tier.fallback.length > 0) {
        lines.push('      fallback:');
        tier.fallback.forEach((fb) => {
          lines.push(`        - provider: ${fb.provider}`);
          lines.push(`          model: ${fb.model}`);
        });
      }
      return lines.join('\n');
    };

    return `# Router Profile: ${profile.name}
${description ? `# ${description}\n` : ''}
router:
  profiles:
    ${profile.name}:
      description: ${description ? `"${description}"` : '""'}
      tiers:
        opus:
${tierToYaml(tiers.opus)
  .split('\n')
  .map((l) => '  ' + l)
  .join('\n')}
        sonnet:
${tierToYaml(tiers.sonnet)
  .split('\n')
  .map((l) => '  ' + l)
  .join('\n')}
        haiku:
${tierToYaml(tiers.haiku)
  .split('\n')
  .map((l) => '  ' + l)
  .join('\n')}`;
  }, [profile.name, description, tiers]);

  // CLI command to use this profile
  const cliCommand = `ccs ${profile.name} "Your prompt here"`;

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="px-6 py-4 border-b bg-background flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">{profile.name}</h2>
          <p className="text-sm text-muted-foreground">Configure tier routing for this profile</p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleTest}
            disabled={testMutation.isPending}
          >
            {testMutation.isPending ? (
              <Loader2 className="w-4 h-4 mr-1 animate-spin" />
            ) : (
              <TestTube2 className="w-4 h-4 mr-1" />
            )}
            Test
          </Button>
          <Button
            size="sm"
            onClick={handleSaveProfile}
            disabled={!hasProfileChanges || updateMutation.isPending}
          >
            {updateMutation.isPending ? (
              <Loader2 className="w-4 h-4 mr-1 animate-spin" />
            ) : (
              <Save className="w-4 h-4 mr-1" />
            )}
            Save Config
          </Button>
        </div>
      </div>

      {/* 2-column layout */}
      <div className="flex-1 grid grid-cols-[55%_45%] divide-x overflow-hidden">
        {/* Left: Tier Configuration */}
        <ScrollArea className="flex-1">
          <div className="p-6 space-y-6">
            {/* Description */}
            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Input
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="e.g., Route opus to Gemini, sonnet to AGY, haiku to GLM"
              />
            </div>

            {/* Tier Configurations */}
            <div className="space-y-4">
              <Label>Tier Configuration</Label>
              <p className="text-xs text-muted-foreground -mt-2">
                Map each Claude tier to a provider. Requests will be routed based on the requested
                tier.
              </p>
              {(['opus', 'sonnet', 'haiku'] as const).map((tier) => (
                <RouterTierConfig
                  key={tier}
                  tier={tier}
                  config={tiers[tier]}
                  providers={providers}
                  onChange={(config) => handleTierChange(tier, config)}
                />
              ))}
            </div>

            {/* CLI Usage */}
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <Terminal className="w-4 h-4" />
                CLI Usage
              </Label>
              <div className="flex items-center gap-2 bg-muted/50 rounded-md p-3">
                <code className="flex-1 text-sm font-mono">{cliCommand}</code>
                <CopyButton value={cliCommand} />
              </div>
            </div>
          </div>
        </ScrollArea>

        {/* Right: Tabbed Preview (YAML / Settings) */}
        <div className="flex flex-col overflow-hidden">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="flex flex-col h-full">
            <div className="px-4 py-2 bg-muted/30 border-b flex items-center gap-2 shrink-0">
              <TabsList className="h-8">
                <TabsTrigger value="yaml" className="text-xs px-3 py-1 h-6">
                  <Code2 className="w-3 h-3 mr-1" />
                  Config
                </TabsTrigger>
                <TabsTrigger value="settings" className="text-xs px-3 py-1 h-6">
                  <FileJson className="w-3 h-3 mr-1" />
                  Settings
                  {hasSettingsChanges && (
                    <Badge variant="secondary" className="ml-1 px-1 py-0 text-[9px]">
                      *
                    </Badge>
                  )}
                </TabsTrigger>
              </TabsList>

              {activeTab === 'settings' && (
                <div className="ml-auto flex items-center gap-2">
                  {settingsData?.generated && (
                    <Badge variant="outline" className="text-[10px]">
                      Auto-generated
                    </Badge>
                  )}
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 px-2"
                    onClick={handleRegenerateSettings}
                    disabled={regenerateSettingsMutation.isPending}
                    title="Regenerate from profile"
                  >
                    {regenerateSettingsMutation.isPending ? (
                      <Loader2 className="w-3 h-3 animate-spin" />
                    ) : (
                      <RefreshCw className="w-3 h-3" />
                    )}
                  </Button>
                  <Button
                    size="sm"
                    className="h-6 px-2"
                    onClick={handleSaveSettings}
                    disabled={
                      !hasSettingsChanges ||
                      !isSettingsJsonValid ||
                      updateSettingsMutation.isPending
                    }
                  >
                    {updateSettingsMutation.isPending ? (
                      <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                    ) : (
                      <Save className="w-3 h-3 mr-1" />
                    )}
                    Save
                  </Button>
                </div>
              )}

              {activeTab === 'yaml' && (
                <span className="text-xs text-muted-foreground ml-auto">Read-only</span>
              )}
            </div>

            <TabsContent value="yaml" className="flex-1 m-0 overflow-hidden">
              <Suspense
                fallback={
                  <div className="flex-1 flex items-center justify-center h-full">
                    <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                  </div>
                }
              >
                <div className="h-full overflow-hidden p-4">
                  <div className="h-full border rounded-md overflow-hidden bg-background">
                    <CodeEditor
                      value={yamlPreview}
                      onChange={() => {}}
                      language="yaml"
                      minHeight="100%"
                      readonly
                    />
                  </div>
                </div>
              </Suspense>
            </TabsContent>

            <TabsContent value="settings" className="flex-1 m-0 overflow-hidden">
              {settingsLoading ? (
                <div className="flex-1 flex items-center justify-center h-full">
                  <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                </div>
              ) : (
                <Suspense
                  fallback={
                    <div className="flex-1 flex items-center justify-center h-full">
                      <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                    </div>
                  }
                >
                  <div className="h-full overflow-hidden p-4">
                    <div className="h-full border rounded-md overflow-hidden bg-background">
                      <CodeEditor
                        value={settingsEdits ?? '{}'}
                        onChange={setSettingsEdits}
                        language="json"
                        minHeight="100%"
                      />
                    </div>
                    {!isSettingsJsonValid && (
                      <div className="absolute bottom-6 left-6 right-6">
                        <Badge variant="destructive" className="text-xs">
                          Invalid JSON
                        </Badge>
                      </div>
                    )}
                  </div>
                </Suspense>
              )}
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
}
