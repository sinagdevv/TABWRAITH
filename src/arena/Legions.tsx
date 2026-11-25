import React, { useEffect, useRef, useState } from 'react';
import { RaidGroup, RaidTab, GROUP_COLORS } from '../tabManager/tabManager';
import { VaultSession } from '../tabManager/tabVault';

export interface LegionInfo {
  group: RaidGroup;
  members: RaidTab[]; // eligible tabs only, in browser order
  collapsedInArena: boolean;
}

const CREST = [
  '.A........A.',
  '.AA......AA.',
  '.AAAAAAAAAA.',
  'AAAAAAAAAAAA',
  'AAWWAAAAWWAA',
  'AAWRWAAWRWAA',
  'AAWWAAAAWWAA',
  '.AAAAWWAAAA.',
  '.AAAWAAWAAA.',
  '..AAWWWWAA..',
  '...AAAAAA...',
  '....AAAA....',
];

export const legionColor = (color: string) => GROUP_COLORS[color] || GROUP_COLORS.grey;

/** Original pixel horned-skull crest, tinted with the native group colour. */
export const LegionCrest: React.FC<{ color: string; size?: number; flash?: boolean }> = React.memo(({ color, size = 64, flash }) => (
  <svg viewBox="0 0 12 12" width={size} height={size} shapeRendering="crispEdges" className="pixel-monster-svg" aria-hidden="true">
    {CREST.flatMap((row, y) =>
      [...row].map((ch, x) =>
        ch === '.' ? null : (
          <rect
            key={`${x}-${y}`}
            x={x}
            y={y}
            width={1}
            height={1}
            fill={flash ? '#E9DFCF' : ch === 'A' ? legionColor(color) : ch === 'W' ? '#E9DFCF' : '#B44653'}
          />
        )
      )
    )}
  </svg>
));

interface PanelProps {
  legions: LegionInfo[];
  ungroupedCount: number;
  sessions: VaultSession[];
  liveMode: boolean;
  busy: boolean;
  native: boolean; // real browser (native fold supported)
  onToggleArena: (groupId: number) => void;
  onToggleNative: (legion: LegionInfo) => void;
  onSave: (legion: LegionInfo) => void;
  onCleanup: (legion: LegionInfo) => void;
  onRestore: (session: VaultSession) => void;
  onDelete: (id: string) => void;
  onClose: () => void;
}

export const LegionsPanel: React.FC<PanelProps> = (p) => {
  const [review, setReview] = useState<LegionInfo | null>(null);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const confirmRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    rootRef.current?.querySelector<HTMLElement>('button')?.focus();
  }, []);
  useEffect(() => {
    if (review) confirmRef.current?.focus();
  }, [review]);

  // keep the review dialog honest if the legion changed under it
  const liveReview = review ? p.legions.find((l) => l.group.id === review.group.id) ?? null : null;

  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.stopPropagation();
      if (review) setReview(null);
      else p.onClose();
    }
  };

  return (
    <div className="armory-drawer legions-panel" data-hud-interactive="true" data-testid="legions-panel" ref={rootRef} onKeyDown={onKey}>
      <div className="armory-header">
        <div>
          <span className="armory-title">CURSED LEGIONS &amp; THE SOUL ARCHIVE</span>
          <span className="armory-sub">TAB GROUPS BECOME LEGIONS. SAVING NEVER CLOSES ANYTHING.</span>
        </div>
        <button type="button" className="hud-btn" onClick={p.onClose} data-testid="legions-close-btn">
          CLOSE [ESC]
        </button>
      </div>

      <div className="legion-cols">
        <section aria-label="Legions">
          <h3 className="legion-h">LEGIONS ({p.legions.length})</h3>
          {p.legions.length === 0 && <p className="legion-empty">No tab groups found. Group tabs in your browser to raise a legion.</p>}
          {p.legions.map((l) => (
            <div className="legion-row" key={l.group.id} data-testid={`legion-row-${l.group.id}`}>
              <span className="legion-chip" style={{ background: legionColor(l.group.color) }} aria-hidden="true" />
              <div className="legion-meta">
                <span className="legion-title">{l.group.title}</span>
                <span className="legion-sub">
                  {l.members.length} TABS · {l.group.color.toUpperCase()}
                  {l.group.collapsed ? ' · FOLDED' : ''}
                </span>
              </div>
              <div className="legion-actions">
                <button type="button" className="hud-btn" onClick={() => p.onToggleArena(l.group.id)}>
                  {l.collapsedInArena ? 'EXPAND' : 'COLLAPSE'}
                </button>
                {p.native && (
                  <button type="button" className="hud-btn" onClick={() => p.onToggleNative(l)} title="Fold or unfold the group in the browser tab strip">
                    {l.group.collapsed ? 'UNFOLD TABS' : 'FOLD TABS'}
                  </button>
                )}
                <button type="button" className="hud-btn" disabled={p.busy || l.members.length === 0} onClick={() => p.onSave(l)}>
                  SAVE
                </button>
                <button type="button" className="hud-btn hud-btn-danger-outline" disabled={p.busy || l.members.length === 0} onClick={() => setReview(l)}>
                  REVIEW CLEANUP
                </button>
              </div>
            </div>
          ))}
          <p className="legion-sub legion-foot">{p.ungroupedCount} UNGROUPED TABS ROAM FREE</p>
        </section>

        <section aria-label="Soul Archive">
          <h3 className="legion-h">SOUL ARCHIVE ({p.sessions.length})</h3>
          {p.sessions.length === 0 && <p className="legion-empty">No saved legions yet.</p>}
          {p.sessions.map((s) => (
            <div className="legion-row" key={s.id}>
              <span className="legion-chip" style={{ background: legionColor(s.color) }} aria-hidden="true" />
              <div className="legion-meta">
                <span className="legion-title">{s.title}</span>
                <span className="legion-sub">
                  {s.tabs.length} TABS · {new Date(s.savedAt).toLocaleString()}
                </span>
              </div>
              <div className="legion-actions">
                <button type="button" className="hud-btn" disabled={p.busy} onClick={() => p.onRestore(s)} title={p.liveMode ? 'Reopen these URLs as a native tab group' : 'Arm LIVE MODE to reopen tabs'}>
                  RESTORE
                </button>
                <button type="button" className="hud-btn" onClick={() => p.onDelete(s.id)} aria-label={`Delete saved legion ${s.title}`}>
                  DELETE
                </button>
              </div>
            </div>
          ))}
          <p className="legion-sub legion-foot">RESTORE REOPENS URLS AND THE GROUP NAME AND COLOUR. UNSAVED PAGE STATE IS NOT RECOVERED.</p>
        </section>
      </div>

      {review && (
        <div className="legion-dialog-back">
          <div className="legion-dialog" role="dialog" aria-modal="true" aria-labelledby="legion-dialog-title" data-testid="cleanup-dialog">
            <h3 id="legion-dialog-title" className="legion-h">
              REVIEW CLEANUP: {review.group.title}
            </h3>
            {!liveReview || liveReview.members.length === 0 ? (
              <p className="legion-empty">Nothing eligible remains in this legion.</p>
            ) : (
              <>
                <p className="legion-sub">
                  These {liveReview.members.length} tabs will be saved to the Soul Archive, bookmarked, then closed. Pinned, internal, extension and arena tabs are
                  excluded.
                </p>
                <ul className="legion-tablist">
                  {liveReview.members.map((t) => (
                    <li key={t.id} title={t.url}>
                      <b>{t.domain}</b> {t.title}
                    </li>
                  ))}
                </ul>
              </>
            )}
            {!p.liveMode && <p className="legion-warn">SAFE MODE IS ON. ARM LIVE MODE IN THE TOP BAR TO ALLOW CLOSING.</p>}
            <div className="legion-actions">
              <button type="button" className="hud-btn" onClick={() => setReview(null)}>
                CANCEL
              </button>
              <button
                type="button"
                ref={confirmRef}
                className="hud-btn hud-btn-danger-outline"
                disabled={!p.liveMode || p.busy || !liveReview || liveReview.members.length === 0}
                onClick={() => {
                  if (liveReview) p.onCleanup(liveReview);
                  setReview(null);
                }}
                data-testid="cleanup-confirm-btn"
              >
                ARCHIVE &amp; CLOSE {liveReview?.members.length ?? 0} TABS
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
