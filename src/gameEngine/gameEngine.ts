import { RaidTab, RaidGroup, ThreatTier } from '../tabManager/tabManager';
import { MONSTER_ARCHETYPES, MonsterArchetypeSpec } from '../arena/PixelMonsterSprite';

export interface FloatingTargetCard {
  tab: RaidTab;
  archetype: MonsterArchetypeSpec;
  hp: number;
  maxHp: number;
  points: number;
  x: number; // Center X in arena percentage (14..86)
  y: number; // Center Y in arena percentage (17..81)
  vx: number; // Drift velocity % per second
  vy: number;
  widthPx: number;
  heightPx: number;
  phase: number;
  floatAmpX: number;
  floatAmpY: number;
  hitFlashUntil: number;
  recoilOffsetY: number;
  isDestroying?: boolean;
  hidden?: boolean; // member of a collapsed legion: not drawn, not targetable
  squad?: { groupId: number; title: string; color: string; total: number }; // legion boss marker (visual only)
}

export interface LaserBeamEffect {
  id: string;
  fromX: number; // px relative to arena stage
  fromY: number; // px
  toX: number; // px
  toY: number; // px
  hit: boolean;
  color: string;
  coreColor: string;
  width: number;
  createdAt: number;
  style?: 'bolt' | 'snap' | 'blade';
}

export interface ParticleBurst {
  id: string;
  x: number; // px relative to arena stage
  y: number; // px
  isBoss?: boolean;
  particles: Array<{
    angle: number;
    distance: number;
    size: number;
    color: string;
  }>;
  label?: string;
  subLabel?: string;
  createdAt: number;
}

const ARCHETYPE_DEATH_COLORS: Record<ThreatTier, string[]> = {
  1: ['#A3E635', '#CA955C', '#4D7C0F', '#FFFFFF'],
  2: ['#7BAA9B', '#7BAA9B', '#CA955C', '#FFFFFF'],
  3: ['#CA955C', '#FB923C', '#EF4444', '#FFFFFF'],
  4: ['#E2E8F0', '#B44653', '#A89B8C', '#CA955C'],
  5: ['#B44653', '#CA955C', '#CA955C', '#FFFFFF'],
};

export function createFloatingCards(tabs: RaidTab[]): FloatingTargetCard[] {
  const count = tabs.length;
  const cols = Math.max(2, Math.min(4, Math.ceil(Math.sqrt(count))));
  const rows = Math.max(1, Math.ceil(count / cols));

  return tabs.map((tab, index) => {
    const tier: ThreatTier = tab.estThreatTier || 1;
    const archetype = MONSTER_ARCHETYPES[tier];

    const col = index % cols;
    const row = Math.floor(index / cols);

    // Well-spaced slots strictly inside the 70% arena stage (x: 15%..85%, y: 18%..80%)
    const cellW = 70 / Math.max(1, cols);
    const cellH = 62 / Math.max(1, rows);

    const seed = Math.abs(tab.id * 97 + index * 31);
    const jitterX = ((seed % 5) - 2) * 0.9;
    const jitterY = (((seed >> 3) % 5) - 2) * 0.9;

    const x = Math.min(85, Math.max(15, 15 + col * cellW + cellW * 0.5 + jitterX));
    const y = Math.min(80, Math.max(18, 18 + row * cellH + cellH * 0.5 + jitterY));

    const speedByTier: Record<ThreatTier, number> = {
      1: 1.35,
      2: 2.2,
      3: 1.65,
      4: 1.4,
      5: 0.95,
    };
    const speed = speedByTier[tier];
    const angle = ((seed * 137.5) % 360) * (Math.PI / 180);

    return {
      tab,
      archetype,
      hp: archetype.maxHp,
      maxHp: archetype.maxHp,
      points: archetype.points,
      x,
      y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed * 0.78,
      widthPx: tier === 5 ? 196 : 178,
      heightPx: tier === 5 ? 222 : 206, // full footprint: HP plate + sprite + nameplate
      phase: (seed % 12) * 0.6,
      floatAmpX: tier === 2 ? 1.35 : 0.65,
      floatAmpY: tier === 1 ? 1.15 : 0.75,
      hitFlashUntil: 0,
      recoilOffsetY: 0,
    };
  });
}

export function stepFloatingCards(
  cards: FloatingTargetCard[],
  dtSeconds: number,
  elapsedSeconds: number,
  stageW = 950,
  stageH = 640
): FloatingTargetCard[] {
  // Separation and bounds work in real pixels using each card's full footprint, so HP plates,
  // sprites and nameplates of neighbours stop overlapping and nothing leaves the arena.
  return cards.map((card, i) => {
    if (card.isDestroying || card.hidden) return card;
    const halfW = card.widthPx / 2;
    const halfH = card.heightPx / 2;
    const minX = ((halfW + 8) / stageW) * 100;
    const maxX = 100 - minX;
    const minY = ((halfH + 8) / stageH) * 100;
    const maxY = Math.max(minY + 1, 100 - ((halfH + 36) / stageH) * 100); // keep clear of the banner
    let pushX = 0;
    let pushY = 0;
    for (let j = 0; j < cards.length; j++) {
      const o = cards[j];
      if (i === j || o.isDestroying || o.hidden) continue;
      const dxp = ((card.x - o.x) / 100) * stageW || (i > j ? 0.5 : -0.5);
      const dyp = ((card.y - o.y) / 100) * stageH || (i > j ? 0.5 : -0.5);
      const overlapX = (halfW + o.widthPx / 2) * 0.94 - Math.abs(dxp);
      const overlapY = (halfH + o.heightPx / 2) * 0.94 - Math.abs(dyp);
      if (overlapX > 0 && overlapY > 0) {
        // resolve along the axis with the smaller penetration
        if (overlapX < overlapY) pushX += (Math.sign(dxp) * overlapX * 5 * dtSeconds * 100) / stageW;
        else pushY += (Math.sign(dyp) * overlapY * 5 * dtSeconds * 100) / stageH;
      }
    }

    let nextX = card.x + card.vx * dtSeconds + pushX;
    let nextY = card.y + card.vy * dtSeconds + pushY;
    let nextVx = card.vx;
    let nextVy = card.vy;

    if (nextX < minX) {
      nextX = minX;
      nextVx = Math.abs(nextVx);
    } else if (nextX > maxX) {
      nextX = maxX;
      nextVx = -Math.abs(nextVx);
    }

    if (nextY < minY) {
      nextY = minY;
      nextVy = Math.abs(nextVy);
    } else if (nextY > maxY) {
      nextY = maxY;
      nextVy = -Math.abs(nextVy);
    }

    const bobX = Math.sin(elapsedSeconds * 1.9 + card.phase) * card.floatAmpX * dtSeconds;
    const bobY = Math.cos(elapsedSeconds * 2.4 + card.phase) * card.floatAmpY * dtSeconds;
    const nextRecoil = card.recoilOffsetY * Math.max(0, 1 - dtSeconds * 12);

    return {
      ...card,
      x: nextX + bobX,
      y: nextY + bobY,
      vx: nextVx,
      vy: nextVy,
      recoilOffsetY: Math.abs(nextRecoil) < 0.3 ? 0 : nextRecoil,
    };
  });
}

/**
 * Checks whether stage-local coordinates (px) hit any active monster.
 * Uses a generous forgiving aim-assist padding (30px default) for hand-aiming precision.
 */
export function findTargetAtPoint(
  cards: FloatingTargetCard[],
  aimStageX: number,
  aimStageY: number,
  stageW: number,
  stageH: number,
  aimAssistPadPx = 30
): FloatingTargetCard | null {
  let bestMatch: FloatingTargetCard | null = null;
  let bestDist = Infinity;

  for (const card of cards) {
    if (card.isDestroying || card.hidden) continue;

    const centerX = (card.x / 100) * stageW;
    const centerY = (card.y / 100) * stageH;
    const halfW = card.widthPx / 2 + aimAssistPadPx;
    const halfH = card.heightPx / 2 + aimAssistPadPx;

    if (
      aimStageX >= centerX - halfW &&
      aimStageX <= centerX + halfW &&
      aimStageY >= centerY - halfH &&
      aimStageY <= centerY + halfH
    ) {
      const dist = Math.hypot(aimStageX - centerX, aimStageY - centerY);
      if (dist < bestDist) {
        bestDist = dist;
        bestMatch = card;
      }
    }
  }

  return bestMatch;
}

/**
 * First active monster whose padded hitbox the swipe segment passes through (nearest to the start).
 * Samples the segment, which is plenty for a ~30px-padded 170px hitbox.
 */
export function findTargetOnSegment(
  cards: FloatingTargetCard[],
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  stageW: number,
  stageH: number,
  pad = 30
): FloatingTargetCard | null {
  const steps = Math.max(2, Math.ceil(Math.hypot(x1 - x0, y1 - y0) / 12));
  for (let i = 0; i <= steps; i++) {
    const x = x0 + ((x1 - x0) * i) / steps;
    const y = y0 + ((y1 - y0) * i) / steps;
    const hit = findTargetAtPoint(cards, x, y, stageW, stageH, pad);
    if (hit) return hit;
  }
  return null;
}

/**
 * Reconciles the arena with the browser: keeps existing monster state (HP, position) for tabs that
 * still exist, adds new tabs, drops tabs that vanished, and keeps one visual legion boss per group.
 * Group ids are session-scoped and only used as in-memory keys here.
 */
export function mergeCards(
  prev: FloatingTargetCard[],
  tabs: RaidTab[],
  groups: RaidGroup[],
  collapsed: Set<number>
): FloatingTargetCard[] {
  const liveGroupIds = new Set(groups.map((g) => g.id));
  const tabById = new Map(tabs.map((t) => [t.id, { ...t, groupId: t.groupId !== undefined && liveGroupIds.has(t.groupId) ? t.groupId : undefined }]));
  const prevTabs = new Map(prev.filter((c) => !c.squad).map((c) => [c.tab.id, c]));

  const keptTabs: FloatingTargetCard[] = [];
  for (const c of prev) {
    if (c.squad) continue;
    const fresh = tabById.get(c.tab.id);
    if (c.isDestroying) keptTabs.push(c);
    else if (fresh) keptTabs.push({ ...c, tab: { ...c.tab, ...fresh }, hidden: fresh.groupId !== undefined && collapsed.has(fresh.groupId) });
  }
  const fresh = createFloatingCards(tabs.filter((t) => !prevTabs.has(t.id)).map((t) => tabById.get(t.id)!)).map((c) => ({
    ...c,
    hidden: c.tab.groupId !== undefined && collapsed.has(c.tab.groupId),
  }));
  const tabCards = [...keptTabs, ...fresh];

  const squads: FloatingTargetCard[] = [];
  for (const g of groups) {
    const members = tabCards.filter((c) => c.tab.groupId === g.id && !c.isDestroying).length;
    if (members === 0) continue;
    const existing = prev.find((c) => c.squad?.groupId === g.id);
    const squad = { groupId: g.id, title: g.title, color: g.color, total: Math.max(members, existing?.squad?.total ?? 0) };
    if (existing) {
      squads.push({ ...existing, squad });
    } else {
      const pseudo: RaidTab = { id: -g.id - 1, title: g.title, url: '', domain: 'LEGION', estThreatTier: 5 };
      squads.push({ ...createFloatingCards([pseudo])[0], hp: 0, maxHp: 0, points: 0, squad });
    }
  }
  return [...squads, ...tabCards];
}

export function createParticleBurst(
  x: number,
  y: number,
  tier: ThreatTier,
  label?: string,
  subLabel?: string,
  isDefeat = true
): ParticleBurst {
  const palette = ARCHETYPE_DEATH_COLORS[tier] || ARCHETYPE_DEATH_COLORS[1];
  const isBoss = tier === 5 && isDefeat;
  const count = isDefeat ? (isBoss ? 24 : 14) : 8;

  const particles = Array.from({ length: count }, (_, i) => {
    const angle = (i / count) * Math.PI * 2 + (i % 3) * 0.14;
    const distance = isDefeat ? (isBoss ? 68 : 44) + ((i * 23) % 48) : 24 + ((i * 13) % 24);
    const size = isBoss ? 7 + (i % 3) * 2 : 5 + (i % 3) * 2;
    const color = palette[i % palette.length];
    return { angle, distance, size, color };
  });

  return {
    id: `burst-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    x,
    y,
    isBoss,
    particles,
    label,
    subLabel,
    createdAt: Date.now(),
  };
}
