/**
 * Accounts Section Component
 * Manages connected OAuth accounts for a provider
 */

import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { User, Plus, Globe } from 'lucide-react';
import { AccountItem } from './account-item';
import type { OAuthAccount } from '@/lib/api-client';

interface AccountsSectionProps {
  accounts: OAuthAccount[];
  onAddAccount: () => void;
  onSetDefault: (accountId: string) => void;
  onRemoveAccount: (accountId: string) => void;
  isRemovingAccount?: boolean;
  privacyMode?: boolean;
  /** Kiro-specific: show "use normal browser" toggle */
  isKiro?: boolean;
  kiroNoIncognito?: boolean;
  onKiroNoIncognitoChange?: (enabled: boolean) => void;
  kiroSettingsLoading?: boolean;
}

export function AccountsSection({
  accounts,
  onAddAccount,
  onSetDefault,
  onRemoveAccount,
  isRemovingAccount,
  privacyMode,
  isKiro,
  kiroNoIncognito,
  onKiroNoIncognitoChange,
  kiroSettingsLoading,
}: AccountsSectionProps) {
  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-medium flex items-center gap-2">
          <User className="w-4 h-4" />
          Accounts
          {accounts.length > 0 && (
            <Badge variant="secondary" className="text-xs">
              {accounts.length}
            </Badge>
          )}
        </h3>
        <Button variant="default" size="sm" className="h-7 text-xs gap-1" onClick={onAddAccount}>
          <Plus className="w-3 h-3" />
          Add
        </Button>
      </div>

      {accounts.length > 0 ? (
        <div className="space-y-2">
          {accounts.map((account) => (
            <AccountItem
              key={account.id}
              account={account}
              onSetDefault={() => onSetDefault(account.id)}
              onRemove={() => onRemoveAccount(account.id)}
              isRemoving={isRemovingAccount}
              privacyMode={privacyMode}
            />
          ))}
        </div>
      ) : (
        <div className="py-6 text-center text-muted-foreground bg-muted/30 rounded-lg border border-dashed">
          <User className="w-8 h-8 mx-auto mb-2 opacity-50" />
          <p className="text-sm">No accounts connected</p>
          <p className="text-xs opacity-70">Add an account to get started</p>
        </div>
      )}

      {/* Kiro-specific: Incognito browser setting - users complain "it keeps opening incognito" */}
      {isKiro && onKiroNoIncognitoChange && (
        <div className="mt-3 pt-3 border-t border-dashed">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Globe className="w-3.5 h-3.5" />
              <span>Use incognito</span>
            </div>
            <Switch
              checked={!kiroNoIncognito}
              onCheckedChange={(v) => onKiroNoIncognitoChange(!v)}
              disabled={kiroSettingsLoading}
              className="scale-90"
            />
          </div>
        </div>
      )}
    </div>
  );
}
