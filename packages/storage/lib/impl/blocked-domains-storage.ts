import { createStorage, StorageEnum } from '../base/index.js';
import type { BaseStorageType } from '../base/index.js';

type BlockedDomain = {
  domain: string;
  enabled: boolean;
};

type BlockedDomainsStorageType = BaseStorageType<BlockedDomain[]> & {
  add: (domain: string) => Promise<void>;
  remove: (domain: string) => Promise<void>;
  toggle: (domain: string) => Promise<void>;
  isBlocked: (domain: string) => Promise<boolean>;
};

const storage = createStorage<BlockedDomain[]>('blocked-domains-storage-key', [], {
  storageEnum: StorageEnum.Local,
  liveUpdate: true,
  serialization: {
    serialize: (value: BlockedDomain[]) => JSON.stringify(value),
    deserialize: (text: unknown) => {
      // Handle undefined, null, or non-string values
      if (text === undefined || text === null) {
        return [];
      }

      // Convert to string and check for invalid values
      const textStr = String(text);
      if (textStr === 'undefined' || textStr === 'null' || textStr.trim() === '') {
        return [];
      }

      // Try to parse JSON
      try {
        const parsed = JSON.parse(textStr);
        if (!Array.isArray(parsed)) {
          return [];
        }
        // Migrate old string array format to new format
        if (parsed.length > 0 && typeof parsed[0] === 'string') {
          return parsed.map((domain: string) => ({ domain, enabled: true }));
        }
        // Validate new format
        return parsed.filter(
          (item: unknown) =>
            item && typeof item === 'object' && typeof item.domain === 'string' && typeof item.enabled === 'boolean',
        );
      } catch {
        return [];
      }
    },
  },
});

const normalizeDomain = (input: string): string => {
  let domain = input.trim().toLowerCase();

  // Remove protocol if present
  domain = domain.replace(/^https?:\/\//, '');

  // Remove www. prefix
  domain = domain.replace(/^www\./, '');

  // Remove trailing slash
  domain = domain.replace(/\/$/, '');

  // Remove path if present (keep only domain)
  domain = domain.split('/')[0];

  return domain;
};

const isValidDomain = (domain: string): boolean => {
  if (!domain || domain.length === 0) {
    return false;
  }

  // Domain must have at least one dot (TLD required)
  // Examples: example.com, subdomain.example.com, example.co.uk
  // Must NOT match: test, example (single words without TLD)
  const domainRegex = /^([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,}$/i;

  // Check if it's a valid domain format with TLD
  if (!domainRegex.test(domain)) {
    return false;
  }

  // Check length constraints
  if (domain.length > 253) {
    return false;
  }

  // Check each label (part between dots)
  const labels = domain.split('.');

  // Must have at least 2 labels (domain + TLD)
  if (labels.length < 2) {
    return false;
  }

  // TLD must be at least 2 characters
  const tld = labels[labels.length - 1];
  if (tld.length < 2) {
    return false;
  }

  for (const label of labels) {
    if (label.length > 63 || label.length === 0) {
      return false;
    }
    if (label.startsWith('-') || label.endsWith('-')) {
      return false;
    }
  }

  return true;
};

const blockedDomainsStorage: BlockedDomainsStorageType = {
  ...storage,
  add: async (domain: string) => {
    const normalized = normalizeDomain(domain);
    if (!normalized || !isValidDomain(normalized)) {
      throw new Error('Invalid domain format');
    }

    await storage.set(currentDomains => {
      // Check if domain already exists
      if (currentDomains.some(d => d.domain === normalized)) {
        throw new Error('Domain already exists');
      }
      return [...currentDomains, { domain: normalized, enabled: true }];
    });
  },
  remove: async (domain: string) => {
    await storage.set(currentDomains => currentDomains.filter(d => d.domain !== domain));
  },
  toggle: async (domain: string) => {
    await storage.set(currentDomains =>
      currentDomains.map(d => (d.domain === domain ? { ...d, enabled: !d.enabled } : d)),
    );
  },
  isBlocked: async (domain: string) => {
    const normalized = normalizeDomain(domain);
    const domains = await storage.get();
    const blocked = domains.find(d => d.domain === normalized);
    return blocked ? blocked.enabled : false;
  },
};

export type { BlockedDomain, BlockedDomainsStorageType };
export { blockedDomainsStorage, isValidDomain, normalizeDomain };
