import '@src/Popup.css';
import { t } from '@extension/i18n';
import { useStorage, withErrorBoundary, withSuspense } from '@extension/shared';
import { blockedDomainsStorage, isValidDomain, normalizeDomain } from '@extension/storage';
import { Badge, Button, cn, ErrorDisplay, Input, LoadingSpinner } from '@extension/ui';
import { useState, useMemo } from 'react';

const Popup = () => {
  const blockedDomains = useStorage(blockedDomainsStorage);
  const [domainInput, setDomainInput] = useState('');
  const [error, setError] = useState<string | null>(null);

  // Real-time validation
  const validationError = useMemo(() => {
    if (!domainInput.trim()) {
      return null;
    }

    const normalized = normalizeDomain(domainInput);

    // Check if domain already exists (even if disabled)
    const exists = blockedDomains.some(d => d.domain === normalized);
    if (exists) {
      return t('domainExists');
    }

    // Validate domain format
    if (!isValidDomain(normalized)) {
      return t('invalidDomain');
    }

    return null;
  }, [domainInput, blockedDomains]);

  const handleAddDomain = async () => {
    if (!domainInput.trim()) {
      return;
    }

    // Use validation error if exists
    if (validationError) {
      setError(validationError);
      return;
    }

    setError(null);

    try {
      await blockedDomainsStorage.add(domainInput);
      setDomainInput('');
    } catch (err) {
      if (err instanceof Error) {
        if (err.message === 'Invalid domain format') {
          setError(t('invalidDomain'));
        } else if (err.message === 'Domain already exists') {
          setError(t('domainExists'));
        } else {
          setError(err.message);
        }
      }
    }
  };

  const handleRemoveDomain = async (domain: string) => {
    await blockedDomainsStorage.remove(domain);
  };

  const handleToggleDomain = async (domain: string) => {
    await blockedDomainsStorage.toggle(domain);
  };

  const handleAddCurrentPage = async () => {
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

      if (!tab.url) {
        setError(t('cannotBlockCurrentPage'));
        return;
      }

      // Skip chrome:// and extension:// URLs
      if (
        tab.url.startsWith('chrome://') ||
        tab.url.startsWith('chrome-extension://') ||
        tab.url.startsWith('about:')
      ) {
        setError(t('cannotBlockCurrentPage'));
        return;
      }

      setError(null);

      try {
        await blockedDomainsStorage.add(tab.url);
      } catch (err) {
        if (err instanceof Error) {
          if (err.message === 'Invalid domain format') {
            setError(t('invalidDomain'));
          } else if (err.message === 'Domain already exists') {
            setError(t('domainExists'));
          } else {
            setError(err.message);
          }
        }
      }
    } catch {
      setError(t('cannotBlockCurrentPage'));
    }
  };

  const enabledCount = blockedDomains.filter(d => d.enabled).length;

  return (
    <div className={cn('mx-auto w-[450px]')}>
      <header className={cn('bg-muted/30 border-b px-6 py-4')}>
        <h1 className={cn('text-center text-lg font-semibold', 'text-foreground')}>{t('extensionName')}</h1>
      </header>
      <div className={cn('p-6')}>
        <div className="space-y-2">
          <div className="flex gap-2">
            <div className="flex-1 space-y-1">
              <Input
                type="text"
                value={domainInput}
                onChange={e => {
                  setDomainInput(e.target.value);
                  setError(null);
                }}
                onKeyDown={e => {
                  if (e.key === 'Enter' && !validationError && domainInput.trim()) {
                    handleAddDomain();
                  }
                }}
                placeholder={t('enterDomainPlaceholder')}
                className={cn((error || validationError) && 'border-destructive focus-visible:ring-destructive')}
              />
              {(error || validationError) && (
                <p className={cn('text-destructive text-xs font-medium')}>{error || validationError}</p>
              )}
            </div>
          </div>
          <Button onClick={handleAddCurrentPage} variant="outline" className="w-full">
            {t('addCurrentPage')}
          </Button>
        </div>
      </div>

      {blockedDomains.length > 0 && (
        <div className={cn('border-t p-6')}>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className={cn('text-base font-semibold', 'text-foreground')}>{t('blocked')}</h3>
              <Badge variant="secondary">
                {enabledCount}/{blockedDomains.length}
              </Badge>
            </div>

            <div className={cn('max-h-64 space-y-2 overflow-y-auto')}>
              {blockedDomains.map(({ domain, enabled }) => (
                <div key={domain} className={cn('bg-muted/50 rounded-lg border p-4', !enabled && 'opacity-60')}>
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex min-w-0 flex-1 items-center gap-2">
                      <span
                        className={cn(
                          'truncate text-sm font-medium',
                          enabled ? 'text-foreground' : 'text-muted-foreground line-through',
                        )}>
                        {domain}
                      </span>
                    </div>
                    <div className="flex shrink-0 gap-2">
                      <Button
                        variant={enabled ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => handleToggleDomain(domain)}>
                        {enabled ? t('disable') : t('enable')}
                      </Button>
                      <Button variant="destructive" size="sm" onClick={() => handleRemoveDomain(domain)}>
                        {t('remove')}
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {blockedDomains.length === 0 && (
        <div className={cn('border-t p-6')}>
          <p className={cn('text-center text-sm', 'text-muted-foreground')}>{t('noBlockedDomains')}</p>
        </div>
      )}
    </div>
  );
};

export default withErrorBoundary(withSuspense(Popup, <LoadingSpinner />), ErrorDisplay);
