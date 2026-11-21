// Lightweight 8-bit Web Audio API synthesizer for the TAB RAID promotional site
// Never autoplays; only triggers on explicit visitor interaction.

class SiteSoundEffects {
  private ctx: AudioContext | null = null;
  public muted = false;
  private readonly masterVolume = 0.22;

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

    gain.gain.setValueAtTime(gainLevel * this.masterVolume, start);
    gain.gain.exponentialRampToValueAtTime(0.001, start + durationSec);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(start);
    osc.stop(start + durationSec + 0.01);
  }

  public playHeroShot(): void {
    this.playTone(940, 150, 0.11, 'square', 0.55, 0);
    this.playTone(440, 220, 0.08, 'triangle', 0.45, 0.05);
    this.playTone(587.33, 880, 0.09, 'square', 0.35, 0.09);
  }

  public playWeaponFire(level: 1 | 2 | 3): void {
    if (level === 1) {
      this.playTone(960, 160, 0.11, 'square', 0.5);
    } else if (level === 2) {
      this.playTone(760, 130, 0.11, 'square', 0.55, 0);
      this.playTone(880, 150, 0.11, 'sawtooth', 0.5, 0.045);
    } else {
      this.playTone(1180, 75, 0.18, 'sawtooth', 0.65, 0);
      this.playTone(240, 48, 0.18, 'triangle', 0.7, 0.02);
    }
  }

  public playUiBlip(): void {
    this.playTone(660, 880, 0.045, 'square', 0.3);
  }

  public playCopyConfirm(): void {
    this.playTone(523.25, 783.99, 0.06, 'square', 0.35, 0);
    this.playTone(783.99, 1046.5, 0.08, 'square', 0.35, 0.055);
  }
}

export const siteSoundFX = new SiteSoundEffects();
