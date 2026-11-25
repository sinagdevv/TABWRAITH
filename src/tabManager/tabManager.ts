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
  groupId?: number; // ephemeral native group id: runtime only, never persisted
  index?: number; // browser tab order (within its window)
  windowId?: number;
}

export interface RaidGroup {
  id: number; // ephemeral native group id
  title: string;
  color: string; // chrome.tabGroups color name
  collapsed?: boolean; // native collapsed state
  windowId?: number;
}

export const GROUP_COLORS: Record<string, string> = {
  grey: '#94A3B8',
  blue: '#38BDF8',
  red: '#FF4D4D',
  yellow: '#FACC15',
  green: '#A3E635',
  pink: '#F472B6',
  purple: '#A78BFA',
  cyan: '#22D3EE',
  orange: '#FB923C',
};

export interface ClosedTabRecord {
  tab: RaidTab;
  bookmarkId?: string;
  closedAt: number;
}

const ARCHIVE_FOLDER_TITLE = 'TABWRAITH Archive';
const LEGACY_ARCHIVE_FOLDER_TITLE = 'TAB RAID Archive'; // v4 folder: reused so upgrades keep one archive

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
    groupId: 2,
  },
  {
    id: 9002,
    title: 'Stack Overflow - How to center a pixel sprite in 2026',
    url: 'https://stackoverflow.com/questions/9002/pixel-sprite-grid',
    domain: 'stackoverflow.com',
    estThreatTier: 2,
    isMock: true,
    groupId: 2,
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
    groupId: 1,
  },
  {
    id: 9005,
    title: 'GitHub - google-ai-edge/mediapipe: Cross-platform ML solutions',
    url: 'https://github.com/google-ai-edge/mediapipe',
    domain: 'github.com',
    estThreatTier: 4,
    isMock: true,
    groupId: 1,
  },
  {
    id: 9006,
    title: 'Google Docs - Hackathon Pitch Deck Notes (34 Collaborators)',
    url: 'https://docs.google.com/document/d/1devfest-notes',
    domain: 'docs.google.com',
    estThreatTier: 4,
    isMock: true,
    groupId: 1,
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
  {
    id: 9009,
    title: 'Hacker News - Ask HN: How many browser tabs do you have open right now?',
    url: 'https://news.ycombinator.com/item?id=40291821',
    domain: 'news.ycombinator.com',
    estThreatTier: 2,
    isMock: true,
  },
];

const MOCK_GROUPS: RaidGroup[] = [
  { id: 1, title: 'DEVFEST', color: 'blue' },
  { id: 2, title: 'REFERENCE', color: 'green' },
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

export interface RaidQuery {
  tabs: RaidTab[];
  groups: RaidGroup[];
  usingRealTabs: boolean;
}

const mockQuery = (): RaidQuery => ({ tabs: [...MOCK_TABS], groups: [...MOCK_GROUPS], usingRealTabs: false });

export async function queryRaidTargets(): Promise<RaidQuery> {
  if (!isChromeExtensionEnv()) return mockQuery();

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
          groupId: t.groupId !== undefined && t.groupId >= 0 ? t.groupId : undefined,
          index: t.index,
          windowId: t.windowId,
        };
      });

    if (eligible.length > 0) {
      const groupIds = new Set(eligible.map((t) => t.groupId).filter((g): g is number => g !== undefined));
      const groups: RaidGroup[] = [];
      for (const id of groupIds) {
        try {
          const g = await chrome.tabGroups.get(id);
          groups.push({ id, title: g.title || 'UNNAMED LEGION', color: g.color, collapsed: g.collapsed, windowId: g.windowId });
        } catch {
          // group vanished mid-query: members become ungrouped
          eligible.forEach((t) => t.groupId === id && (t.groupId = undefined));
        }
      }
      return { tabs: eligible, groups, usingRealTabs: true };
    }

    return mockQuery();
  } catch (err) {
    console.warn('[TABWRAITH] Falling back to simulated targets:', err);
    return mockQuery();
  }
}

export async function getOrCreateArchiveFolderId(): Promise<string> {
  const found = [
    ...(await chrome.bookmarks.search({ title: ARCHIVE_FOLDER_TITLE })),
    ...(await chrome.bookmarks.search({ title: LEGACY_ARCHIVE_FOLDER_TITLE })),
  ];
  const folder = found.find((node) => !node.url);
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
      title: `[TABWRAITH] ${tab.title}`,
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

/**
 * Bulk archive-then-close (group cleanup / duplicates). Bookmarks EVERY tab first;
 * if any archive fails nothing is closed. SAFE MODE / mock tabs are never touched.
 */
export async function archiveAndCloseMany(
  tabs: RaidTab[],
  liveMode: boolean
): Promise<{ success: boolean; records: ClosedTabRecord[]; error?: string }> {
  if (!liveMode) return { success: false, records: [], error: 'LIVE MODE REQUIRED' };
  const real = tabs.filter((t) => !t.isMock);
  if (real.length === 0 || !isChromeExtensionEnv()) return { success: false, records: [], error: 'NO REAL TABS' };
  try {
    const folderId = await getOrCreateArchiveFolderId();
    const records: ClosedTabRecord[] = [];
    for (const tab of real) {
      const bm = await chrome.bookmarks.create({ parentId: folderId, title: `[TABWRAITH] ${tab.title}`, url: tab.url });
      if (!bm?.id) throw new Error('Bookmark archive failed; no tabs were closed.');
      records.push({ tab, bookmarkId: bm.id, closedAt: Date.now() });
    }
    await chrome.tabs.remove(real.map((t) => t.id));
    return { success: true, records };
  } catch (err) {
    return { success: false, records: [], error: err instanceof Error ? err.message : 'Archive failed' };
  }
}

/** Folds/unfolds the native browser tab group (no tab is opened or closed). */
export async function setNativeGroupCollapsed(groupId: number, collapsed: boolean): Promise<boolean> {
  try {
    await chrome.tabGroups.update(groupId, { collapsed });
    return true;
  } catch {
    return false;
  }
}

/** Calls onChange (debounced) when tabs/groups change in the browser. Returns an unsubscribe fn. */
export function subscribeTabChanges(onChange: () => void, delayMs = 450): () => void {
  if (!isChromeExtensionEnv()) return () => {};
  let timer = 0;
  const fire = () => {
    window.clearTimeout(timer);
    timer = window.setTimeout(onChange, delayMs);
  };
  const emitters = [
    chrome.tabs.onCreated,
    chrome.tabs.onRemoved,
    chrome.tabs.onMoved,
    chrome.tabs.onAttached,
    chrome.tabs.onDetached,
    chrome.tabs.onUpdated,
    chrome.tabGroups?.onUpdated,
    chrome.tabGroups?.onCreated,
    chrome.tabGroups?.onRemoved,
  ].filter(Boolean) as Array<chrome.events.Event<(...args: never[]) => void>>;
  emitters.forEach((e) => e.addListener(fire));
  return () => {
    window.clearTimeout(timer);
    emitters.forEach((e) => e.removeListener(fire));
  };
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

    if (record.tab.groupId !== undefined && createdTab.id !== undefined) {
      try {
        await chrome.tabs.group({ tabIds: createdTab.id, groupId: record.tab.groupId });
      } catch {
        // group no longer exists; tab stays ungrouped
      }
    }

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
