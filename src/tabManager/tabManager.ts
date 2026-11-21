export type ThreatTier = 1 | 2 | 3 | 4 | 5;

export interface RaidTab {
  id: number;
  title: string;
  url: string;
  favIconUrl?: string;
  domain: string;
  audible?: boolean;
  discarded?: boolean;
  estThreatTier: ThreatTier;
  isMock?: boolean;
}

export interface ClosedTabRecord {
  tab: RaidTab;
  bookmarkId?: string;
  closedAt: number;
}

const ARCHIVE_FOLDER_TITLE = 'TAB RAID Archive';

/**
 * Deterministic heuristic for ESTIMATED RESOURCE THREAT TIER (1..5).
 * Kept separate so genuine per-tab memory telemetry can drop in later if available.
 */
export function estimateTabThreatTier(params: {
  url: string;
  title: string;
  audible?: boolean;
  discarded?: boolean;
}): ThreatTier {
  const urlLower = (params.url || '').toLowerCase();
  const titleLower = (params.title || '').toLowerCase();

  // Tier 1: Discarded tabs or lightweight docs/reference pages
  if (params.discarded) {
    return 1;
  }

  // Tier 5: Heavy media/streaming, 3D/design canvases, or actively playing audio/video
  if (
    params.audible ||
    urlLower.includes('youtube.com/watch') ||
    urlLower.includes('twitch.tv') ||
    urlLower.includes('figma.com') ||
    urlLower.includes('canva.com') ||
    urlLower.includes('meet.google.com') ||
    titleLower.includes('14 hrs open') ||
    titleLower.includes('4k')
  ) {
    return 5;
  }

  // Tier 4: Heavy web apps, cloud consoles, sheets/docs editors, AI/ML repos
  if (
    urlLower.includes('docs.google.com') ||
    urlLower.includes('console.cloud') ||
    urlLower.includes('aws.amazon.com') ||
    urlLower.includes('mediapipe') ||
    urlLower.includes('discord.com') ||
    urlLower.includes('slack.com')
  ) {
    return 4;
  }

  // Tier 3: Active dev servers, GitHub PRs/issues, complex dashboards
  if (
    urlLower.includes('localhost:') ||
    urlLower.includes('127.0.0.1') ||
    urlLower.includes('github.com') ||
    urlLower.includes('gitlab.com') ||
    urlLower.includes('vercel.com')
  ) {
    return 3;
  }

  // Tier 2: Forums, Q&A, social feeds, news aggregators
  if (
    urlLower.includes('stackoverflow.com') ||
    urlLower.includes('news.ycombinator.com') ||
    urlLower.includes('reddit.com') ||
    urlLower.includes('x.com')
  ) {
    return 2;
  }

  // Deterministic fallback hash across tiers 1..3 for general web pages
  let hash = 0;
  for (let i = 0; i < urlLower.length; i++) {
    hash = (hash * 31 + urlLower.charCodeAt(i)) | 0;
  }
  const bucket = (Math.abs(hash) % 3) + 1;
  return bucket as ThreatTier;
}

const MOCK_TABS: RaidTab[] = [
  {
    id: 9001,
    title: 'MDN Web Docs - Chrome Extensions Manifest V3 CSP Reference',
    url: 'https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions',
    domain: 'developer.mozilla.org',
    discarded: true,
    estThreatTier: 1,
    isMock: true,
  },
  {
    id: 9002,
    title: 'Stack Overflow - How to center a pixel sprite in 2026',
    url: 'https://stackoverflow.com/questions/9002/pixel-sprite-grid',
    domain: 'stackoverflow.com',
    estThreatTier: 2,
    isMock: true,
  },
  {
    id: 9003,
    title: 'Hacker News - Ask HN: How many browser tabs do you have open right now?',
    url: 'https://news.ycombinator.com/item?id=40291821',
    domain: 'news.ycombinator.com',
    estThreatTier: 2,
    isMock: true,
  },
  {
    id: 9004,
    title: 'localhost:5173 - Unfinished DevFest Side Project #47',
    url: 'http://localhost:5173/dashboard',
    domain: 'localhost:5173',
    estThreatTier: 3,
    isMock: true,
  },
  {
    id: 9005,
    title: 'GitHub - google-ai-edge/mediapipe: Cross-platform ML solutions',
    url: 'https://github.com/google-ai-edge/mediapipe',
    domain: 'github.com',
    estThreatTier: 4,
    isMock: true,
  },
  {
    id: 9006,
    title: 'Google Docs - Hackathon Pitch Deck Notes (34 Collaborators)',
    url: 'https://docs.google.com/document/d/1devfest-notes',
    domain: 'docs.google.com',
    estThreatTier: 4,
    isMock: true,
  },
  {
    id: 9007,
    title: 'Figma - DevFest Arcade UI Master Canvas v14_FINAL_REAL',
    url: 'https://www.figma.com/file/devfest-tab-raid',
    domain: 'figma.com',
    estThreatTier: 5,
    isMock: true,
  },
  {
    id: 9008,
    title: 'YouTube - Synthwave Arcade Boss OST (14 hrs open, 4K60)',
    url: 'https://www.youtube.com/watch?v=jfKfPfyJRdk',
    domain: 'youtube.com',
    audible: true,
    estThreatTier: 5,
    isMock: true,
  },
];

export function isChromeExtensionEnv(): boolean {
  return typeof chrome !== 'undefined' && !!chrome.tabs && typeof chrome.tabs.query === 'function';
}

export function extractDomain(rawUrl: string): string {
  try {
    const parsed = new URL(rawUrl);
    return parsed.host || 'browser.tab';
  } catch {
    return 'browser.tab';
  }
}

export function isEligibleRaidTab(tab: chrome.tabs.Tab, currentArenaTabId?: number): boolean {
  if (!tab.id || tab.id === currentArenaTabId) return false;
  if (tab.pinned) return false;

  const url = tab.url || tab.pendingUrl || '';
  if (!url) return false;

  const blockedPrefixes = [
    'chrome://',
    'chrome-extension://',
    'brave://',
    'edge://',
    'about:',
    'devtools://',
    'view-source:',
    'chrome-search://',
  ];

  const lower = url.toLowerCase();
  for (const prefix of blockedPrefixes) {
    if (lower.startsWith(prefix)) return false;
  }

  if (lower.includes('index.html') && lower.includes('tab-raid')) {
    return false;
  }

  return true;
}

export async function queryRaidTargets(): Promise<{ tabs: RaidTab[]; usingRealTabs: boolean }> {
  if (!isChromeExtensionEnv()) {
    return { tabs: [...MOCK_TABS], usingRealTabs: false };
  }

  try {
    const currentTab = await chrome.tabs.getCurrent();
    const currentTabId = currentTab?.id;
    const allTabs = await chrome.tabs.query({});

    const eligible: RaidTab[] = allTabs
      .filter((t) => isEligibleRaidTab(t, currentTabId))
      .map((t) => {
        const url = t.url || t.pendingUrl || 'https://example.com';
        const title = t.title || extractDomain(url);
        const audible = Boolean(t.audible);
        const discarded = Boolean(t.discarded);
        return {
          id: t.id!,
          title,
          url,
          favIconUrl: t.favIconUrl || undefined,
          domain: extractDomain(url),
          audible,
          discarded,
          estThreatTier: estimateTabThreatTier({ url, title, audible, discarded }),
          isMock: false,
        };
      });

    if (eligible.length > 0) {
      return { tabs: eligible, usingRealTabs: true };
    }

    return { tabs: [...MOCK_TABS], usingRealTabs: false };
  } catch (err) {
    console.warn('[TAB RAID] Falling back to simulated targets:', err);
    return { tabs: [...MOCK_TABS], usingRealTabs: false };
  }
}

async function getOrCreateArchiveFolderId(): Promise<string> {
  const existing = await chrome.bookmarks.search({ title: ARCHIVE_FOLDER_TITLE });
  const folder = existing.find((node) => !node.url);
  if (folder?.id) {
    return folder.id;
  }
  const created = await chrome.bookmarks.create({
    title: ARCHIVE_FOLDER_TITLE,
  });
  return created.id;
}

/**
 * Archives and optionally closes a single defeated tab.
 * Safety invariants:
 * - Only called when monster HP reaches 0.
 * - In SAFE MODE (`liveMode === false`) or on mock targets, never touches real tabs.
 * - In LIVE MODE (`liveMode === true`), creates a bookmark FIRST; only calls `chrome.tabs.remove(tab.id)` if bookmark creation succeeds.
 */
export async function archiveAndCloseTab(
  tab: RaidTab,
  liveMode: boolean
): Promise<{ success: boolean; record?: ClosedTabRecord; error?: string }> {
  if (!liveMode || tab.isMock || !isChromeExtensionEnv()) {
    return {
      success: true,
      record: {
        tab,
        closedAt: Date.now(),
      },
    };
  }

  try {
    if (!chrome.bookmarks || !chrome.tabs) {
      return {
        success: false,
        error: 'Chrome tabs/bookmarks permissions unavailable.',
      };
    }

    const folderId = await getOrCreateArchiveFolderId();
    const bookmark = await chrome.bookmarks.create({
      parentId: folderId,
      title: `[TAB RAID] ${tab.title}`,
      url: tab.url,
    });

    if (!bookmark || !bookmark.id) {
      return {
        success: false,
        error: 'Bookmark archive verification failed; tab was NOT closed.',
      };
    }

    await chrome.tabs.remove(tab.id);

    return {
      success: true,
      record: {
        tab,
        bookmarkId: bookmark.id,
        closedAt: Date.now(),
      },
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to archive/close tab';
    return {
      success: false,
      error: message,
    };
  }
}

export async function restoreClosedTab(
  record: ClosedTabRecord,
  liveMode: boolean
): Promise<RaidTab> {
  if (!liveMode || record.tab.isMock || !isChromeExtensionEnv()) {
    return record.tab;
  }

  try {
    const createdTab = await chrome.tabs.create({
      url: record.tab.url,
      active: false,
    });

    if (record.bookmarkId && chrome.bookmarks) {
      try {
        await chrome.bookmarks.remove(record.bookmarkId);
      } catch {
        // Ignore if user already deleted bookmark
      }
    }

    return {
      ...record.tab,
      id: createdTab.id ?? record.tab.id,
      isMock: false,
    };
  } catch {
    return record.tab;
  }
}

export async function spawnDemoRealTabs(): Promise<void> {
  if (!isChromeExtensionEnv()) return;
  const sampleUrls = [
    'https://developer.chrome.com/docs/extensions/mv3/',
    'https://news.ycombinator.com/',
    'https://github.com/google-ai-edge/mediapipe',
    'https://www.youtube.com/watch?v=jfKfPfyJRdk',
  ];
  for (const url of sampleUrls) {
    await chrome.tabs.create({ url, active: false });
  }
}
