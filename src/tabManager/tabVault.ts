import { RaidTab, RaidGroup, isChromeExtensionEnv } from './tabManager';

// Saved sessions hold URLs + order + group title/color only. Native group ids are
// ephemeral and are deliberately NOT stored. Unsaved page state is never restored.
export interface VaultSession {
  id: string;
  title: string;
  color: string;
  savedAt: number;
  tabs: Array<{ url: string; title: string; favIconUrl?: string }>;
}

const KEY = 'tabRaidVault';

const hasStore = () => typeof chrome !== 'undefined' && !!chrome.storage?.local;

export async function listVault(): Promise<VaultSession[]> {
  try {
    if (hasStore()) {
      const got = await chrome.storage.local.get(KEY);
      return (got[KEY] as VaultSession[]) || [];
    }
    return JSON.parse(localStorage.getItem(KEY) || '[]');
  } catch {
    return [];
  }
}

async function writeVault(list: VaultSession[]): Promise<void> {
  if (hasStore()) await chrome.storage.local.set({ [KEY]: list });
  else localStorage.setItem(KEY, JSON.stringify(list));
}

export async function saveGroupSession(
  group: RaidGroup,
  tabs: RaidTab[]
): Promise<{ success: boolean; error?: string }> {
  if (tabs.length === 0) return { success: false, error: 'NO ELIGIBLE TABS IN GROUP' };
  try {
    const list = await listVault();
    list.unshift({
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      title: group.title,
      color: group.color,
      savedAt: Date.now(),
      tabs: tabs.map((t) => ({ url: t.url, title: t.title, favIconUrl: t.favIconUrl })),
    });
    await writeVault(list.slice(0, 50));
    return { success: true };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : 'Vault write failed' };
  }
}

export async function deleteSession(id: string): Promise<void> {
  await writeVault((await listVault()).filter((s) => s.id !== id));
}

/** Re-opens a saved session in order and re-creates the native group when possible. */
export async function restoreSession(
  session: VaultSession,
  liveMode: boolean
): Promise<{ success: boolean; count: number; grouped: boolean; error?: string }> {
  if (!liveMode || !isChromeExtensionEnv()) {
    return { success: true, count: session.tabs.length, grouped: false }; // SAFE MODE: simulated
  }
  try {
    const ids: number[] = [];
    let failed = 0;
    for (const t of session.tabs) {
      try {
        const created = await chrome.tabs.create({ url: t.url, active: false });
        if (created.id !== undefined) ids.push(created.id);
      } catch {
        failed++; // keep going: report a partial restore instead of aborting
      }
    }
    let grouped = false;
    if (ids.length > 0) {
      try {
        const gid = await chrome.tabs.group({ tabIds: ids });
        await chrome.tabGroups.update(gid, { title: session.title, color: session.color as chrome.tabGroups.ColorEnum });
        grouped = true;
      } catch {
        // tabs restored but ungrouped
      }
    }
    return {
      success: ids.length > 0,
      count: ids.length,
      grouped,
      error: failed ? `${failed} OF ${session.tabs.length} TABS COULD NOT BE REOPENED` : undefined,
    };
  } catch (err) {
    return { success: false, count: 0, grouped: false, error: err instanceof Error ? err.message : 'Restore failed' };
  }
}

/** Groups tabs sharing an exact URL. First tab (browser order) is the keeper. */
export function findDuplicates(tabs: RaidTab[]): Map<string, RaidTab[]> {
  const byUrl = new Map<string, RaidTab[]>();
  for (const t of tabs) {
    if (!t.url) continue;
    byUrl.set(t.url, [...(byUrl.get(t.url) || []), t]);
  }
  for (const [k, v] of byUrl) if (v.length < 2) byUrl.delete(k);
  return byUrl;
}
