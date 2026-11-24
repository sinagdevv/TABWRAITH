// Synthesized 8-Bit Web Audio API Arcade SFX — lightweight, zero external dependencies
// Default volume calibrated to ~25% master gain

class SoundEffects {
  private ctx: AudioContext | null = null;
  private bus: AudioNode | null = null; // compressor -> destination (anti-clipping)
  private echo: AudioNode | null = null; // light feedback delay send
  private voices = 0;
  private readonly maxVoices = 22;
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
        const comp = this.ctx.createDynamicsCompressor();
        comp.threshold.value = -14;
        comp.ratio.value = 6;
        comp.connect(this.ctx.destination);
        this.bus = comp;
        const delay = this.ctx.createDelay(0.5);
        delay.delayTime.value = 0.12;
        const fb = this.ctx.createGain();
        fb.gain.value = 0.28;
        const wetGain = this.ctx.createGain();
        wetGain.gain.value = 0.35;
        delay.connect(fb);
        fb.connect(delay);
        delay.connect(wetGain);
        wetGain.connect(comp);
        this.echo = delay;
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
    delaySec = 0,
    wet = false
  ): void {
    const ctx = this.getContext();
    if (!ctx || !this.bus || this.voices >= this.maxVoices) return;

    const start = ctx.currentTime + delaySec;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = type;
    osc.frequency.setValueAtTime(freqStart, start);
    if (freqEnd !== freqStart) {
      osc.frequency.exponentialRampToValueAtTime(Math.max(20, freqEnd), start + durationSec);
    }

    // 4ms attack avoids clicks; exponential release
    const effectiveGain = gainLevel * this.masterVolume;
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.linearRampToValueAtTime(effectiveGain, start + 0.004);
    gain.gain.exponentialRampToValueAtTime(0.001, start + durationSec);

    osc.connect(gain);
    gain.connect(this.bus);
    if (wet && this.echo) gain.connect(this.echo);
    this.voices++;
    osc.onended = () => {
      this.voices--;
    };
    osc.start(start);
    osc.stop(start + durationSec + 0.01);
  }

  // Filtered pixel-noise burst; band = bandpass centre Hz (0 = unfiltered)
  private playNoiseBurst(durationSec: number, gainLevel = 0.25, delaySec = 0, band = 0): void {
    const ctx = this.getContext();
    if (!ctx || !this.bus || this.voices >= this.maxVoices) return;

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
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.linearRampToValueAtTime(gainLevel * this.masterVolume, start + 0.003);
    gain.gain.exponentialRampToValueAtTime(0.001, start + durationSec);

    if (band > 0) {
      const f = ctx.createBiquadFilter();
      f.type = 'bandpass';
      f.frequency.value = band;
      f.Q.value = 1.2;
      source.connect(f);
      f.connect(gain);
    } else {
      source.connect(gain);
    }
    gain.connect(this.bus);
    this.voices++;
    source.onended = () => {
      this.voices--;
    };
    source.start(start);
  }

  // 8-bit arcade start jingle
  public playStartJingle(): void {
    // Ominous ceremonial three-note cue over a low impact
    this.playTone(58, 36, 0.4, 'sine', 0.8);
    [196, 233.08, 293.66].forEach((n, idx) =>
      this.playTone(n, n * 0.99, idx === 2 ? 0.35 : 0.14, 'sawtooth', 0.28, 0.05 + idx * 0.16, true)
    );
  }

  // Weapon upgrade 8-bit chiptune powerup arpeggio
  public playWeaponUpgrade(): void {
    // Forge strike, then ascending magical confirmation
    this.playNoiseBurst(0.05, 0.55, 0, 2600);
    this.playTone(1320, 1300, 0.28, 'triangle', 0.4, 0.005, true);
    this.playTone(110, 70, 0.18, 'square', 0.5);
    [392, 523.25, 659.25, 783.99, 1046.5].forEach((n, idx) =>
      this.playTone(n, n * 1.01, 0.1, 'triangle', 0.4, 0.22 + idx * 0.06, true)
    );
  }

  // Short original chiptune arpeggio when switching hero masks
  public playMaskSelect(notes: number[]): void {
    notes.forEach((n, idx) => this.playTone(n, n * 1.02, 0.07, 'square', 0.4, idx * 0.055));
  }

  // Finger-gun ready / cocked blip
  public playGunReady(): void {
    // Quiet spectral charge
    this.playTone(420, 840, 0.09, 'sine', 0.22, 0, true);
  }

  // Distinct weapon firing audio per weapon tier (1: Starter, 2: Double Barrel, 3: Plasma Cannon)
  public playLaser(weaponLevel: 1 | 2 | 3 = 1): void {
    // Magical projectile: quick rising attack, falling tail
    if (weaponLevel === 1) {
      this.playTone(520, 1040, 0.025, 'square', 0.35);
      this.playTone(1040, 240, 0.12, 'triangle', 0.55, 0.02, true);
    } else if (weaponLevel === 2) {
      // Twin Hexcasters: two tight layered pulses
      this.playTone(600, 1200, 0.025, 'square', 0.3);
      this.playTone(1200, 260, 0.11, 'triangle', 0.5, 0.02, true);
      this.playTone(780, 1500, 0.025, 'square', 0.3, 0.055);
      this.playTone(1500, 340, 0.11, 'triangle', 0.45, 0.075, true);
    } else {
      // Abyssal Cannon: heavy low discharge
      this.playNoiseBurst(0.12, 0.5, 0, 700);
      this.playTone(300, 55, 0.26, 'sawtooth', 0.55);
      this.playTone(90, 38, 0.3, 'sine', 0.85, 0.01, true);
    }
  }

  // Monster hit (non-lethal): crunchy pixel impact
  public playMonsterHit(): void {
    // Crunchy pixel impact + muted crackle
    this.playNoiseBurst(0.06, 0.5, 0, 1800);
    this.playTone(260, 120, 0.07, 'square', 0.4);
    this.playNoiseBurst(0.05, 0.18, 0.05, 5200);
  }

  // Boss damage: heavier digital impact
  public playBossDamage(): void {
    this.playNoiseBurst(0.1, 0.6, 0, 900);
    this.playTone(150, 52, 0.18, 'sawtooth', 0.55);
    this.playTone(340, 170, 0.1, 'square', 0.3, 0.02);
  }

  // Monster death: noise burst + descending notes
  public playMonsterDeath(isBoss = false): void {
    // Spectral shatter: bright glassy burst, pixel noise, descending tone
    this.playNoiseBurst(isBoss ? 0.3 : 0.14, isBoss ? 0.65 : 0.5, 0, 3400);
    this.playTone(1500, 600, 0.08, 'triangle', 0.35, 0, true);
    this.playTone(1100, 420, 0.1, 'square', 0.2, 0.03);
    const fall = isBoss ? [520, 390, 260, 130] : [420, 280];
    fall.forEach((n, idx) => this.playTone(n, n * 0.55, 0.1, 'triangle', 0.5, 0.05 + idx * 0.07));
    if (isBoss) {
      // Short dark-fantasy flourish
      this.playTone(48, 32, 0.45, 'sine', 0.9, 0.02);
      [293.66, 349.23, 440, 587.33].forEach((n, idx) =>
        this.playTone(n, n, idx === 3 ? 0.3 : 0.09, 'square', 0.28, 0.4 + idx * 0.09, true)
      );
    }
  }

  public playHitExplosion(): void {
    this.playMonsterDeath(false);
  }

  // Combo: ascending notes
  public playCombo(comboCount: number): void {
    // Restrained: milestones only (3x, 5x, 8x)
    if (![3, 5, 8].includes(comboCount)) return;
    const base = comboCount === 3 ? 523.25 : comboCount === 5 ? 659.25 : 783.99;
    [1, 1.25, 1.5].forEach((m, idx) => this.playTone(base * m, base * m, 0.08, 'triangle', 0.3, idx * 0.07, true));
  }

  // Victory: original 4-note fanfare
  public playVictory(): void {
    // Short original fantasy fanfare (D minor rise, open fifth finish)
    [293.66, 349.23, 440, 587.33].forEach((n, idx) => {
      const dur = idx === 3 ? 0.32 : 0.1;
      this.playTone(n, n, dur, 'square', 0.4, idx * 0.11);
      this.playTone(n / 2, n / 2, dur, 'triangle', 0.5, idx * 0.11);
    });
  }

  // Soul Snap: quiet arming blip, then crisp snap + violet burst
  public playSnapArm(): void {
    this.playTone(560, 900, 0.07, 'sine', 0.22, 0, true);
  }

  public playSnapRelease(): void {
    this.playNoiseBurst(0.035, 0.6, 0, 4200);
    this.playTone(1900, 700, 0.1, 'triangle', 0.45, 0.005, true);
    this.playTone(200, 420, 0.16, 'sine', 0.5, 0.01);
  }

  // Wraithblade: airy swing, metallic impact
  public playSwordSwing(): void {
    this.playNoiseBurst(0.16, 0.3, 0, 1900);
    this.playTone(1100, 320, 0.14, 'sawtooth', 0.16);
  }

  public playSwordImpact(): void {
    this.playNoiseBurst(0.06, 0.5, 0, 3200);
    this.playTone(1760, 1700, 0.18, 'triangle', 0.3, 0, true);
    this.playTone(2349, 2300, 0.12, 'triangle', 0.2, 0.01);
    this.playTone(150, 70, 0.1, 'square', 0.4);
  }

  public playCombatSwitch(): void {
    this.playTone(392, 392, 0.05, 'square', 0.3);
    this.playTone(587.33, 587.33, 0.08, 'square', 0.3, 0.055, true);
  }

  // Strong magical finisher for lethal Snap / Blade hits
  public playFinisher(): void {
    this.playTone(98, 49, 0.3, 'sine', 0.8);
    [392, 523.25, 659.25, 783.99].forEach((n, i) => this.playTone(n, n, 0.08, 'triangle', 0.32, 0.03 + i * 0.05, true));
  }

  // Miss shot
  public playMiss(): void {
    this.playTone(200, 110, 0.06, 'triangle', 0.2);
  }

  // Undo: short reverse digital blip
  public playRestore(): void {
    // Reverse magical shimmer
    [1046.5, 783.99, 659.25, 523.25, 392].forEach((n, idx) =>
      this.playTone(n * 0.9, n * 1.1, 0.08, 'sine', 0.3, idx * 0.05, true)
    );
  }
}

export const soundFX = new SoundEffects();
