// Synthesized 8-Bit Web Audio API Arcade SFX — lightweight, zero external dependencies
// Default volume calibrated to ~25% master gain

class SoundEffects {
  private ctx: AudioContext | null = null;
  public muted = false;
  private readonly masterVolume = 0.25;

  private getContext(): AudioContext | null {
    if (this.muted) return null;
    if (!this.ctx && typeof window !== 'undefined') {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
    return this.ctx;
  }

  private playTone(
    freqStart: number,
    freqEnd: number,
    durationSec: number,
    type: OscillatorType = 'square',
    gainLevel = 0.25,
    delaySec = 0
  ): void {
    const ctx = this.getContext();
    if (!ctx) return;

    const start = ctx.currentTime + delaySec;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = type;
    osc.frequency.setValueAtTime(freqStart, start);
    if (freqEnd !== freqStart) {
      osc.frequency.exponentialRampToValueAtTime(Math.max(20, freqEnd), start + durationSec);
    }

    const effectiveGain = gainLevel * this.masterVolume;
    gain.gain.setValueAtTime(effectiveGain, start);
    gain.gain.exponentialRampToValueAtTime(0.001, start + durationSec);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(start);
    osc.stop(start + durationSec + 0.01);
  }

  private playNoiseBurst(durationSec: number, gainLevel = 0.25, delaySec = 0): void {
    const ctx = this.getContext();
    if (!ctx) return;

    const start = ctx.currentTime + delaySec;
    const sampleRate = ctx.sampleRate;
    const length = Math.max(1, Math.floor(sampleRate * durationSec));
    const buffer = ctx.createBuffer(1, length, sampleRate);
    const data = buffer.getChannelData(0);

    let lastSample = 0;
    for (let i = 0; i < length; i++) {
      if (i % 6 === 0) {
        lastSample = Math.random() * 2 - 1;
      }
      data[i] = lastSample;
    }

    const source = ctx.createBufferSource();
    source.buffer = buffer;

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(gainLevel * this.masterVolume, start);
    gain.gain.exponentialRampToValueAtTime(0.001, start + durationSec);

    source.connect(gain);
    gain.connect(ctx.destination);
    source.start(start);
  }

  // 8-bit arcade start jingle
  public playStartJingle(): void {
    const notes = [330, 392, 523.25, 659.25];
    notes.forEach((n, idx) => {
      this.playTone(n, n, 0.08, 'square', 0.45, idx * 0.075);
    });
  }

  // Weapon upgrade 8-bit chiptune powerup arpeggio
  public playWeaponUpgrade(): void {
    const notes = [392, 523.25, 659.25, 783.99, 1046.5];
    notes.forEach((n, idx) => {
      this.playTone(n, n * 1.04, 0.075, 'square', 0.5, idx * 0.06);
    });
  }

  // Finger-gun ready / cocked blip
  public playGunReady(): void {
    this.playTone(660, 990, 0.055, 'square', 0.35);
  }

  // Distinct weapon firing audio per weapon tier (1: Starter, 2: Double Barrel, 3: Plasma Cannon)
  public playLaser(weaponLevel: 1 | 2 | 3 = 1): void {
    if (weaponLevel === 1) {
      this.playTone(960, 160, 0.11, 'square', 0.5);
    } else if (weaponLevel === 2) {
      // Twin-pulse scatter shot
      this.playTone(760, 130, 0.11, 'square', 0.55, 0);
      this.playTone(880, 150, 0.11, 'sawtooth', 0.5, 0.045);
    } else {
      // Heavy overcharged plasma rail
      this.playNoiseBurst(0.08, 0.5);
      this.playTone(1180, 75, 0.18, 'sawtooth', 0.65, 0);
      this.playTone(240, 48, 0.18, 'triangle', 0.7, 0.02);
    }
  }

  // Monster hit (non-lethal): crunchy pixel impact
  public playMonsterHit(): void {
    this.playNoiseBurst(0.06, 0.45);
    this.playTone(310, 140, 0.08, 'square', 0.5);
  }

  // Boss damage: heavier digital impact
  public playBossDamage(): void {
    this.playNoiseBurst(0.09, 0.65);
    this.playTone(180, 55, 0.14, 'sawtooth', 0.7);
    this.playTone(420, 210, 0.09, 'square', 0.45, 0.02);
  }

  // Monster death: noise burst + descending notes
  public playMonsterDeath(isBoss = false): void {
    this.playNoiseBurst(isBoss ? 0.28 : 0.16, isBoss ? 0.75 : 0.55);
    if (isBoss) {
      this.playTone(300, 180, 0.09, 'square', 0.65, 0);
      this.playTone(220, 110, 0.1, 'square', 0.65, 0.08);
      this.playTone(150, 42, 0.2, 'triangle', 0.75, 0.16);
    } else {
      this.playTone(440, 260, 0.07, 'square', 0.5, 0);
      this.playTone(260, 95, 0.12, 'triangle', 0.55, 0.06);
    }
  }

  public playHitExplosion(): void {
    this.playMonsterDeath(false);
  }

  // Combo: ascending notes
  public playCombo(comboCount: number): void {
    const base = 440 + Math.min(8, comboCount) * 55;
    this.playTone(base, base * 1.25, 0.07, 'square', 0.35, 0.05);
  }

  // Victory: original 4-note fanfare
  public playVictory(): void {
    const notes = [523.25, 659.25, 783.99, 1046.5];
    notes.forEach((n, idx) => {
      const dur = idx === 3 ? 0.24 : 0.09;
      this.playTone(n, n, dur, 'square', 0.5, idx * 0.1);
    });
  }

  // Miss shot
  public playMiss(): void {
    this.playTone(170, 90, 0.07, 'triangle', 0.28);
  }

  // Undo: short reverse digital blip
  public playRestore(): void {
    this.playTone(290, 580, 0.07, 'square', 0.4, 0);
    this.playTone(580, 880, 0.09, 'square', 0.4, 0.06);
  }
}

export const soundFX = new SoundEffects();
