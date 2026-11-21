import { RaidTab, ThreatTier } from '../tabManager/tabManager';
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
  1: ['#A3E635', '#CCFF00', '#4D7C0F', '#FFFFFF'],
  2: ['#38BDF8', '#00F5D4', '#FACC15', '#FFFFFF'],
  3: ['#F59E0B', '#FB923C', '#EF4444', '#FFFFFF'],
  4: ['#E2E8F0', '#FF3B5C', '#94A3B8', '#CCFF00'],
  5: ['#FF4D4D', '#CCFF00', '#FACC15', '#FFFFFF'],
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
      heightPx: tier === 5 ? 164 : 148,
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
  elapsedSeconds: number
): FloatingTargetCard[] {
  const minX = 13;
  const maxX = 87;
  const minY = 17;
  const maxY = 81;

  // Stronger separation pass so larger monsters and nameplates never overlap
  return cards.map((card, i) => {
    if (card.isDestroying) return card;
    let pushX = 0;
    let pushY = 0;
    for (let j = 0; j < cards.length; j++) {
      if (i === j || cards[j].isDestroying) continue;
      const dx = card.x - cards[j].x;
      const dy = (card.y - cards[j].y) * 1.15;
      const dist = Math.hypot(dx, dy);
      const minSep = 23.5; // percentage units
      if (dist > 0.01 && dist < minSep) {
        const force = ((minSep - dist) / minSep) * 11.0;
        pushX += (dx / dist) * force * dtSeconds;
        pushY += (dy / dist) * force * dtSeconds;
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
    if (card.isDestroying) continue;

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
