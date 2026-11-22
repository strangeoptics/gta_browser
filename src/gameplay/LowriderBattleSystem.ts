export type LowriderDir = 'up' | 'down' | 'left' | 'right' | 'hop';

export interface LowriderNote {
  id: number;
  dir: LowriderDir;
  targetTime: number;
  hit: boolean;
  missed: boolean;
}

export interface LowriderHudState {
  active: boolean;
  score: number;
  combo: number;
  feedback: string;
  feedbackKind: 'perfect' | 'good' | 'miss' | '';
  progressPct: number;
  notes: { dir: LowriderDir; offsetSec: number }[];
  finishedReward: number;
  finishedToast: string | null;
}

const DIRECTIONS: LowriderDir[] = ['up', 'left', 'right', 'down', 'hop'];

export const LOWRIDER_DIR_SYMBOL: Record<LowriderDir, string> = {
  up: '↑ W',
  down: '↓ S',
  left: '← A',
  right: '→ D',
  hop: '⬆ SPACE',
};

/**
 * Little Havana Plaza Lowrider Hydraulics Rhythm Battle!
 * 16 beats of 80s Miami bounce prompts — hit W/A/S/D or Arrow keys or Space on the beat
 * to bounce your hydraulic suspension and win $1,200 – $1,800 prize money!
 */
export class LowriderBattleSystem {
  private active = false;
  private elapsed = 0;
  private duration = 12.2;
  private score = 0;
  private combo = 0;
  private feedback = '';
  private feedbackKind: 'perfect' | 'good' | 'miss' | '' = '';
  private feedbackTimer = 0;
  private notes: LowriderNote[] = [];
  private finishedReward = 0;
  private finishedToast: string | null = null;
  private beatPulse = 0;

  public isActive(): boolean {
    return this.active;
  }

  public start(): void {
    this.active = true;
    this.elapsed = 0;
    this.score = 0;
    this.combo = 0;
    this.feedback = 'BEREIT... IM TAKT HÜPFEN!';
    this.feedbackKind = 'good';
    this.feedbackTimer = 1.4;
    this.finishedReward = 0;
    this.finishedToast = null;
    this.beatPulse = 0;

    // Generate 16 groovy beat notes spaced cleanly (~0.62s apart, starting at 1.4s)
    this.notes = [];
    let t = 1.45;
    let prevIdx = -1;
    for (let i = 0; i < 16; i++) {
      let idx = Math.floor(Math.random() * DIRECTIONS.length);
      if (idx === prevIdx) idx = (idx + 1) % DIRECTIONS.length;
      if (i === 15) idx = 4; // Grand finale SPACE hop!
      prevIdx = idx;
      this.notes.push({
        id: i,
        dir: DIRECTIONS[idx],
        targetTime: t,
        hit: false,
        missed: false,
      });
      t += i % 4 === 3 ? 0.78 : 0.62;
    }
    this.duration = t + 0.85;
  }

  public cancel(): void {
    this.active = false;
    this.notes = [];
    this.feedback = '';
    this.feedbackKind = '';
  }

  public handleKey(code: string): { matched: boolean; dir: LowriderDir | null; quality: 'perfect' | 'good' | 'miss' } {
    if (!this.active) return { matched: false, dir: null, quality: 'miss' };

    let dir: LowriderDir | null = null;
    if (code === 'KeyW' || code === 'ArrowUp') dir = 'up';
    else if (code === 'KeyS' || code === 'ArrowDown') dir = 'down';
    else if (code === 'KeyA' || code === 'ArrowLeft') dir = 'left';
    else if (code === 'KeyD' || code === 'ArrowRight') dir = 'right';
    else if (code === 'Space') dir = 'hop';
    if (!dir) return { matched: false, dir: null, quality: 'miss' };

    // Find closest unhit note within ±0.26s window
    let bestNote: LowriderNote | null = null;
    let bestAbs = 0.28;
    for (const n of this.notes) {
      if (n.hit || n.missed) continue;
      const absDiff = Math.abs(n.targetTime - this.elapsed);
      if (absDiff < bestAbs) {
        bestAbs = absDiff;
        bestNote = n;
      }
    }

    if (bestNote && bestNote.dir === dir) {
      bestNote.hit = true;
      this.combo++;
      const mult = 1 + Math.min(3, Math.floor(this.combo / 4)) * 0.25;
      if (bestAbs <= 0.115) {
        const pts = Math.round(100 * mult);
        this.score += pts;
        this.feedback = `PERFEKT! +${pts}${this.combo >= 3 ? ` (${this.combo}× COMBO)` : ''}`;
        this.feedbackKind = 'perfect';
        this.feedbackTimer = 0.85;
        this.beatPulse = 1.0;
        return { matched: true, dir, quality: 'perfect' };
      } else {
        const pts = Math.round(60 * mult);
        this.score += pts;
        this.feedback = `GUT! +${pts}`;
        this.feedbackKind = 'good';
        this.feedbackTimer = 0.75;
        this.beatPulse = 0.75;
        return { matched: true, dir, quality: 'good' };
      }
    }

    // Wrong key or too early/late
    this.combo = 0;
    this.feedback = 'DANEBEN!';
    this.feedbackKind = 'miss';
    this.feedbackTimer = 0.65;
    return { matched: false, dir, quality: 'miss' };
  }

  public update(dt: number): LowriderHudState {
    this.finishedReward = 0;
    this.finishedToast = null;

    if (!this.active) {
      return {
        active: false,
        score: 0,
        combo: 0,
        feedback: '',
        feedbackKind: '',
        progressPct: 0,
        notes: [],
        finishedReward: 0,
        finishedToast: null,
      };
    }

    this.elapsed += dt;
    this.beatPulse = Math.max(0, this.beatPulse - dt * 3.5);
    if (this.feedbackTimer > 0) {
      this.feedbackTimer = Math.max(0, this.feedbackTimer - dt);
      if (this.feedbackTimer <= 0) {
        this.feedback = '';
        this.feedbackKind = '';
      }
    }

    // Mark missed notes that passed the hit window
    for (const n of this.notes) {
      if (!n.hit && !n.missed && this.elapsed - n.targetTime > 0.26) {
        n.missed = true;
        this.combo = 0;
        this.feedback = 'VERPASST!';
        this.feedbackKind = 'miss';
        this.feedbackTimer = 0.6;
      }
    }

    const visibleNotes: { dir: LowriderDir; offsetSec: number }[] = [];
    for (const n of this.notes) {
      if (n.hit || n.missed) continue;
      const offsetSec = n.targetTime - this.elapsed;
      if (offsetSec >= -0.25 && offsetSec <= 1.8) {
        visibleNotes.push({ dir: n.dir, offsetSec });
      }
    }

    if (this.elapsed >= this.duration) {
      this.active = false;
      if (this.score >= 1200) {
        this.finishedReward = 1800;
        this.finishedToast = `LOWRIDER-KÖNIG VON LITTLE HAVANA! (${this.score} PKT) · +$1.800`;
      } else if (this.score >= 700) {
        this.finishedReward = 1200;
        this.finishedToast = `LOWRIDER-BATTLE GEWONNEN! (${this.score} PKT) · +$1.200`;
      } else {
        this.finishedReward = 0;
        this.finishedToast = `LOWRIDER-BATTLE VERLOREN (${this.score}/700 PKT) · NOCHMAL VERSUCHEN!`;
      }
    }

    return {
      active: this.active,
      score: this.score,
      combo: this.combo,
      feedback: this.feedback,
      feedbackKind: this.feedbackKind,
      progressPct: Math.min(100, Math.round((this.elapsed / this.duration) * 100)),
      notes: visibleNotes,
      finishedReward: this.finishedReward,
      finishedToast: this.finishedToast,
    };
  }
}
