import 'webextension-polyfill';
import { blockedDomainsStorage, normalizeDomain } from '@extension/storage';

console.log('Background loaded');

const checkAndBlockDomain = async (url: string, tabId: number): Promise<void> => {
  // Skip chrome://, extension://, about: URLs, and our own blocked page
  if (
    url.startsWith('chrome://') ||
    url.startsWith('chrome-extension://') ||
    url.startsWith('about:') ||
    url.includes('blocked.html')
  ) {
    return;
  }

  try {
    const urlObj = new URL(url);
    const domain = normalizeDomain(urlObj.hostname);

    // Check if domain is blocked
    const isBlocked = await blockedDomainsStorage.isBlocked(domain);

    if (isBlocked) {
      // Redirect to blocked page
      chrome.tabs.update(tabId, {
        url: chrome.runtime.getURL('blocked.html'),
      });
    }
  } catch (error) {
    // Ignore errors (e.g., invalid URLs)
    console.error('Error checking blocked domain:', error);
  }
};

// Block navigation to blocked domains (only on committed navigation, not autocomplete attempts)
chrome.webNavigation.onCommitted.addListener(
  async details => {
    // Only block main frame navigations, not subframes
    if (details.frameId === 0) {
      await checkAndBlockDomain(details.url, details.tabId);
    }
  },
  {
    url: [{ schemes: ['http', 'https'] }],
  },
);

// Also check when tabs are updated (e.g., user types in address bar)
chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  if (changeInfo.status === 'loading' && tab.url) {
    await checkAndBlockDomain(tab.url, tabId);
  }
});
