/**
 * Procedural Web Audio API synthesizer for Vice Dusk:
 * - Weapon SFX (9mm, SMG, 12G Shotgun, Reload)
 * - Continuous vehicle engine hum (pitch tracks speed)
 * - Continuous Vice PD siren (fades in with Wanted level)
 * - Wet asphalt footsteps, damage thud, mission passed arpeggio & wasted sweep
 * - Toggleable low-volume coastal synthwave pulse ([M] key)
 */
export class AudioEngine {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private noiseBuffer: AudioBuffer | null = null;

  // Continuous engine & siren nodes
  private engineOsc: OscillatorNode | null = null;
  private engineGain: GainNode | null = null;
  private sirenOsc: OscillatorNode | null = null;
  private sirenGain: GainNode | null = null;

  // Synthwave pulse state
  private musicEnabled = true;
  private muted = false;
  private beatTimer = 0;
  private beatStep = 0;
  private stepTimer = 0;

  private readonly bassLine = [55, 55, 65.41, 73.42, 55, 55, 82.41, 73.42]; // A1-C2-D2-E2 retro groove

  public unlock(): void {
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtx) return;
      this.ctx = new AudioCtx();

      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.value = 0.55;
      this.masterGain.connect(this.ctx.destination);

      // Shared white-noise buffer for gunshots, footsteps & coastal surf
      const len = this.ctx.sampleRate * 1.5;
      this.noiseBuffer = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
      const data = this.noiseBuffer.getChannelData(0);
      for (let i = 0; i < len; i++) {
        data[i] = Math.random() * 2 - 1;
      }

      // Engine hum oscillator
      this.engineOsc = this.ctx.createOscillator();
      this.engineOsc.type = 'sawtooth';
      this.engineOsc.frequency.value = 55;
      const engineFilter = this.ctx.createBiquadFilter();
      engineFilter.type = 'lowpass';
      engineFilter.frequency.value = 210;
      this.engineGain = this.ctx.createGain();
      this.engineGain.gain.value = 0;
      this.engineOsc.connect(engineFilter);
      engineFilter.connect(this.engineGain);
      this.engineGain.connect(this.masterGain);
      this.engineOsc.start();

      // Police siren oscillator
      this.sirenOsc = this.ctx.createOscillator();
      this.sirenOsc.type = 'triangle';
      this.sirenOsc.frequency.value = 620;
      this.sirenGain = this.ctx.createGain();
      this.sirenGain.gain.value = 0;
      this.sirenOsc.connect(this.sirenGain);
      this.sirenGain.connect(this.masterGain);
      this.sirenOsc.start();
    }

    if (this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
  }

  public toggleMute(): boolean {
    this.muted = !this.muted;
    if (this.masterGain && this.ctx) {
      this.masterGain.gain.setTargetAtTime(this.muted ? 0 : 0.55, this.ctx.currentTime, 0.04);
    }
    return this.muted;
  }

  public isMuted(): boolean {
    return this.muted;
  }

  public playShot(weaponId: string): void {
    if (!this.ctx || !this.masterGain || !this.noiseBuffer || this.muted) return;
    const now = this.ctx.currentTime;

    // Noise crack
    const noise = this.ctx.createBufferSource();
    noise.buffer = this.noiseBuffer;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    const nGain = this.ctx.createGain();

    // Low punch oscillator
    const osc = this.ctx.createOscillator();
    const oGain = this.ctx.createGain();
    osc.type = 'triangle';

    if (weaponId === 'launcher') {
      filter.frequency.setValueAtTime(380, now);
      filter.Q.value = 0.6;
      nGain.gain.setValueAtTime(0.55, now);
      nGain.gain.exponentialRampToValueAtTime(0.001, now + 0.36);

      osc.frequency.setValueAtTime(120, now);
      osc.frequency.exponentialRampToValueAtTime(38, now + 0.28);
      oGain.gain.setValueAtTime(0.6, now);
      oGain.gain.exponentialRampToValueAtTime(0.001, now + 0.3);
    } else if (weaponId === 'shotgun') {
      filter.frequency.setValueAtTime(620, now);
      filter.Q.value = 0.7;
      nGain.gain.setValueAtTime(0.65, now);
      nGain.gain.exponentialRampToValueAtTime(0.001, now + 0.28);

      osc.frequency.setValueAtTime(145, now);
      osc.frequency.exponentialRampToValueAtTime(34, now + 0.22);
      oGain.gain.setValueAtTime(0.7, now);
      oGain.gain.exponentialRampToValueAtTime(0.001, now + 0.24);
    } else if (weaponId === 'smg') {
      filter.frequency.setValueAtTime(1450, now);
      filter.Q.value = 1.2;
      nGain.gain.setValueAtTime(0.32, now);
      nGain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);

      osc.frequency.setValueAtTime(210, now);
      osc.frequency.exponentialRampToValueAtTime(65, now + 0.06);
      oGain.gain.setValueAtTime(0.28, now);
      oGain.gain.exponentialRampToValueAtTime(0.001, now + 0.07);
    } else {
      // 9mm pistol
      filter.frequency.setValueAtTime(1150, now);
      filter.Q.value = 0.9;
      nGain.gain.setValueAtTime(0.45, now);
      nGain.gain.exponentialRampToValueAtTime(0.001, now + 0.14);

      osc.frequency.setValueAtTime(180, now);
      osc.frequency.exponentialRampToValueAtTime(48, now + 0.11);
      oGain.gain.setValueAtTime(0.45, now);
      oGain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);
    }

    noise.connect(filter);
    filter.connect(nGain);
    nGain.connect(this.masterGain);
    noise.start(now);
    noise.stop(now + 0.32);

    osc.connect(oGain);
    oGain.connect(this.masterGain);
    osc.start(now);
    osc.stop(now + 0.26);
  }

  public playDamage(): void {
    if (!this.ctx || !this.masterGain || this.muted) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(110, now);
    osc.frequency.exponentialRampToValueAtTime(42, now + 0.15);
    gain.gain.setValueAtTime(0.45, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.16);
    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.start(now);
    osc.stop(now + 0.18);
  }

  public playMissionPassed(): void {
    if (!this.ctx || !this.masterGain || this.muted) return;
    const now = this.ctx.currentTime;
    const notes = [440, 554.37, 659.25, 880]; // A major retro synth arp
    notes.forEach((freq, idx) => {
      const osc = this.ctx!.createOscillator();
      const gain = this.ctx!.createGain();
      osc.type = 'triangle';
      const t = now + idx * 0.095;
      osc.frequency.setValueAtTime(freq, t);
      gain.gain.setValueAtTime(0.22, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.35);
      osc.connect(gain);
      gain.connect(this.masterGain!);
      osc.start(t);
      osc.stop(t + 0.36);
    });
  }

  public playWasted(): void {
    if (!this.ctx || !this.masterGain || this.muted) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sawtooth';
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 420;
    osc.frequency.setValueAtTime(220, now);
    osc.frequency.exponentialRampToValueAtTime(52, now + 1.1);
    gain.gain.setValueAtTime(0.32, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 1.2);
    osc.connect(filter);
    filter.connect(gain);
    gain.connect(this.masterGain);
    osc.start(now);
    osc.stop(now + 1.25);
  }

  public playExplosion(): void {
    if (!this.ctx || !this.masterGain || !this.noiseBuffer || this.muted) return;
    const now = this.ctx.currentTime;

    // Deep sub-bass boom
    const osc = this.ctx.createOscillator();
    const oGain = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(92, now);
    osc.frequency.exponentialRampToValueAtTime(24, now + 0.65);
    oGain.gain.setValueAtTime(0.85, now);
    oGain.gain.exponentialRampToValueAtTime(0.001, now + 0.72);
    osc.connect(oGain);
    oGain.connect(this.masterGain);
    osc.start(now);
    osc.stop(now + 0.75);

    // Filtered noise roar
    const noise = this.ctx.createBufferSource();
    noise.buffer = this.noiseBuffer;
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(950, now);
    filter.frequency.exponentialRampToValueAtTime(140, now + 0.85);
    const nGain = this.ctx.createGain();
    nGain.gain.setValueAtTime(0.75, now);
    nGain.gain.exponentialRampToValueAtTime(0.001, now + 0.9);
    noise.connect(filter);
    filter.connect(nGain);
    nGain.connect(this.masterGain);
    noise.start(now);
    noise.stop(now + 0.95);
  }

  public playPurchase(): void {
    if (!this.ctx || !this.masterGain || this.muted) return;
    const now = this.ctx.currentTime;
    [587.33, 880].forEach((freq, i) => {
      const osc = this.ctx!.createOscillator();
      const gain = this.ctx!.createGain();
      osc.type = 'sine';
      const t = now + i * 0.07;
      osc.frequency.setValueAtTime(freq, t);
      gain.gain.setValueAtTime(0.24, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.2);
      osc.connect(gain);
      gain.connect(this.masterGain!);
      osc.start(t);
      osc.stop(t + 0.22);
    });
  }

  public playCheckpoint(): void {
    if (!this.ctx || !this.masterGain || this.muted) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(740, now);
    osc.frequency.exponentialRampToValueAtTime(1108, now + 0.14);
    gain.gain.setValueAtTime(0.22, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.22);
    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.start(now);
    osc.stop(now + 0.24);
  }

  public playCrash(intensity: number): void {
    if (!this.ctx || !this.masterGain || !this.noiseBuffer || this.muted) return;
    const clamped = Math.max(0.15, Math.min(1, intensity));
    const now = this.ctx.currentTime;

    // Metallic crunch noise
    const noise = this.ctx.createBufferSource();
    noise.buffer = this.noiseBuffer;
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(700 + clamped * 600, now);
    filter.Q.value = 1.1;
    const nGain = this.ctx.createGain();
    nGain.gain.setValueAtTime(0.45 * clamped, now);
    nGain.gain.exponentialRampToValueAtTime(0.001, now + 0.18 + clamped * 0.16);
    noise.connect(filter);
    filter.connect(nGain);
    nGain.connect(this.masterGain);
    noise.start(now);
    noise.stop(now + 0.38);

    // Heavy body thud
    const osc = this.ctx.createOscillator();
    const oGain = this.ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(115 + clamped * 35, now);
    osc.frequency.exponentialRampToValueAtTime(34, now + 0.16 + clamped * 0.1);
    oGain.gain.setValueAtTime(0.55 * clamped, now);
    oGain.gain.exponentialRampToValueAtTime(0.001, now + 0.28);
    osc.connect(oGain);
    oGain.connect(this.masterGain);
    osc.start(now);
    osc.stop(now + 0.3);
  }

  private playWetFootstep(): void {
    if (!this.ctx || !this.masterGain || !this.noiseBuffer || this.muted) return;
    const now = this.ctx.currentTime;
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuffer;
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = 1800 + Math.random() * 500;
    filter.Q.value = 2.0;
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.055, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.055);
    src.connect(filter);
    filter.connect(gain);
    gain.connect(this.masterGain);
    src.start(now);
    src.stop(now + 0.06);
  }

  private playSynthPulse(freq: number): void {
    if (!this.ctx || !this.masterGain || this.muted) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const filter = this.ctx.createBiquadFilter();
    const gain = this.ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(freq, now);
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(420, now);
    filter.frequency.exponentialRampToValueAtTime(140, now + 0.24);
    gain.gain.setValueAtTime(0.065, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.28);
    osc.connect(filter);
    filter.connect(gain);
    gain.connect(this.masterGain);
    osc.start(now);
    osc.stop(now + 0.3);
  }

  public update(
    dt: number,
    elapsed: number,
    isActive: boolean,
    inVehicle: boolean,
    speedKmh: number,
    onFootSpeed: number,
    grounded: boolean,
    wantedStars: number,
  ): void {
    if (!this.ctx || !this.engineOsc || !this.engineGain || !this.sirenOsc || !this.sirenGain) return;
    const now = this.ctx.currentTime;

    // 1) Engine hum while driving
    const targetEngineGain = isActive && inVehicle ? 0.14 + Math.min(0.12, speedKmh * 0.0015) : 0;
    const targetEngineFreq = 52 + speedKmh * 1.45;
    this.engineGain.gain.setTargetAtTime(targetEngineGain, now, 0.08);
    this.engineOsc.frequency.setTargetAtTime(targetEngineFreq, now, 0.06);

    // 2) Subtle distant Vice PD siren when Wanted > 0
    const targetSirenGain = isActive && wantedStars > 0 ? 0.035 + wantedStars * 0.008 : 0;
    const wail = 560 + Math.sin(elapsed * 4.2) * 185;
    this.sirenGain.gain.setTargetAtTime(targetSirenGain, now, 0.12);
    this.sirenOsc.frequency.setTargetAtTime(wail, now, 0.04);

    // 3) Wet asphalt footsteps
    if (isActive && !inVehicle && grounded && onFootSpeed > 1.2) {
      this.stepTimer -= dt;
      if (this.stepTimer <= 0) {
        this.playWetFootstep();
        this.stepTimer = onFootSpeed > 8 ? 0.31 : 0.46;
      }
    } else {
      this.stepTimer = 0.12;
    }

    // 4) Soft 80s synthwave dusk pulse (104 BPM eighth-notes)
    if (isActive && this.musicEnabled && !this.muted) {
      this.beatTimer -= dt;
      if (this.beatTimer <= 0) {
        this.beatTimer = 0.288;
        const note = this.bassLine[this.beatStep % this.bassLine.length];
        this.playSynthPulse(note);
        this.beatStep++;
      }
    }
  }
}
