/**
 * Router Page - Master-detail layout for router profile management
 */

import { useState, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Plus, Search, Route, Loader2 } from 'lucide-react';
import {
  RouterProfileCard,
  RouterProfileCreateDialog,
  RouterProfileEditor,
} from '@/components/router';
import { ConfirmDialog } from '@/components/shared/confirm-dialog';
import {
  useRouterProfiles,
  useRouterProfile,
  useDeleteRouterProfile,
} from '@/hooks/use-router-profiles';

export function RouterPage() {
  const [selectedName, setSelectedName] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const [editorHasChanges, setEditorHasChanges] = useState(false);
  const [pendingSwitch, setPendingSwitch] = useState<string | null>(null);
  const [isCreateDialogOpen, setCreateDialogOpen] = useState(false);

  const { data, isLoading } = useRouterProfiles();
  const deleteMutation = useDeleteRouterProfile();

  // Fetch full profile when selected
  const { data: selectedProfile, isLoading: isProfileLoading } = useRouterProfile(
    selectedName ?? ''
  );

  const profiles = useMemo(() => data?.profiles ?? [], [data?.profiles]);

  // Filter by search
  const filteredProfiles = useMemo(() => {
    if (!searchQuery) return profiles;
    const q = searchQuery.toLowerCase();
    return profiles.filter(
      (p) => p.name.toLowerCase().includes(q) || p.description?.toLowerCase().includes(q)
    );
  }, [profiles, searchQuery]);

  // Handle selection with unsaved changes check
  const handleSelect = (name: string) => {
    if (editorHasChanges && selectedName && name !== selectedName) {
      setPendingSwitch(name);
    } else {
      setSelectedName(name);
    }
  };

  const handleConfirmSwitch = () => {
    if (pendingSwitch) {
      setSelectedName(pendingSwitch);
      setPendingSwitch(null);
      setEditorHasChanges(false);
    }
  };

  const handleCreateSuccess = (name: string) => {
    setCreateDialogOpen(false);
    setSelectedName(name);
  };

  const handleDelete = (name: string) => {
    deleteMutation.mutate(name, {
      onSuccess: () => {
        if (selectedName === name) setSelectedName(null);
        setDeleteTarget(null);
      },
    });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-[calc(100vh-100px)]">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="flex h-[calc(100vh-100px)]">
      {/* Left Panel - Profile List */}
      <div className="w-80 border-r flex flex-col bg-muted/30">
        {/* Header */}
        <div className="p-4 border-b bg-background">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Route className="w-5 h-5 text-primary" />
              <h1 className="font-semibold">Router Profiles</h1>
            </div>
            <Button size="sm" onClick={() => setCreateDialogOpen(true)}>
              <Plus className="w-4 h-4 mr-1" />
              New
            </Button>
          </div>
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search profiles..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-8 h-9"
            />
          </div>
        </div>

        {/* Profile List */}
        <ScrollArea className="flex-1">
          <div className="p-2 space-y-2">
            {filteredProfiles.length === 0 ? (
              <div className="p-4 text-center text-sm text-muted-foreground">
                {searchQuery ? 'No matching profiles' : 'No profiles configured'}
              </div>
            ) : (
              filteredProfiles.map((profile) => (
                <RouterProfileCard
                  key={profile.name}
                  profile={profile}
                  isActive={profile.name === selectedName}
                  onClick={() => handleSelect(profile.name)}
                  onDelete={() => setDeleteTarget(profile.name)}
                />
              ))
            )}
          </div>
        </ScrollArea>

        {/* Footer Stats */}
        <div className="p-3 border-t bg-background text-xs text-muted-foreground">
          {profiles.length} profile{profiles.length !== 1 ? 's' : ''} configured
        </div>
      </div>

      {/* Right Panel - Editor or Empty State */}
      <div className="flex-1 overflow-auto p-6">
        {selectedName && isProfileLoading ? (
          <div className="flex items-center justify-center h-full">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        ) : selectedProfile ? (
          <RouterProfileEditor
            key={selectedName}
            profile={selectedProfile}
            onHasChanges={setEditorHasChanges}
          />
        ) : (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <Route className="w-16 h-16 text-muted-foreground/30 mb-4" />
            <h2 className="text-lg font-medium mb-2">No Profile Selected</h2>
            <p className="text-sm text-muted-foreground mb-4">
              Select a profile from the list or create a new one
            </p>
            <Button onClick={() => setCreateDialogOpen(true)}>
              <Plus className="w-4 h-4 mr-1" />
              Create Profile
            </Button>
          </div>
        )}
      </div>

      {/* Delete Confirmation Dialog */}
      <ConfirmDialog
        open={!!deleteTarget}
        onCancel={() => setDeleteTarget(null)}
        title="Delete Profile"
        description={`Are you sure you want to delete "${deleteTarget}"? This action cannot be undone.`}
        confirmText="Delete"
        variant="destructive"
        onConfirm={() => deleteTarget && handleDelete(deleteTarget)}
      />

      {/* Unsaved Changes Dialog */}
      <ConfirmDialog
        open={!!pendingSwitch}
        onCancel={() => setPendingSwitch(null)}
        title="Unsaved Changes"
        description="You have unsaved changes. Discard and switch profiles?"
        confirmText="Discard & Switch"
        variant="destructive"
        onConfirm={handleConfirmSwitch}
      />

      {/* Create Profile Dialog */}
      <RouterProfileCreateDialog
        open={isCreateDialogOpen}
        onOpenChange={setCreateDialogOpen}
        onSuccess={handleCreateSuccess}
      />
    </div>
  );
}
