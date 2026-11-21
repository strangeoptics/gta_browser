import * as THREE from 'three';

/**
 * Procedural 80s "VICE CHANNEL 6 · BREAKING NEWS" live TV broadcast for the Safehouse CRT TV:
 * - Animated 2D-canvas news studio with blinking LIVE badge, talking 80s anchor,
 *   scrolling breaking-news ticker & CRT scanlines
 * - Real American English news anchor voice via browser Web Speech API (`speechSynthesis`)
 * - Automatically cancels speech when turned off or when the player leaves the Safehouse
 */
export class ViceNewsTv {
  public readonly texture: THREE.CanvasTexture;
  public isOn = false;

  private readonly canvas: HTMLCanvasElement;
  private readonly ctx: CanvasRenderingContext2D;
  private readonly w = 320;
  private readonly h = 240;

  private staticTimer = 0;
  private redrawTimer = 0;
  private storyIndex = 0;
  private storyTimer = 0;
  private tickerX = 320;
  private isSpeaking = false;

  private currentCash = 0;
  private currentStars = 0;

  constructor() {
    this.canvas = document.createElement('canvas');
    this.canvas.width = this.w;
    this.canvas.height = this.h;
    this.ctx = this.canvas.getContext('2d')!;

    this.texture = new THREE.CanvasTexture(this.canvas);
    this.texture.colorSpace = THREE.SRGBColorSpace;
    this.drawOffScreen();
  }

  public toggle(cash: number, wantedStars: number): boolean {
    this.currentCash = cash;
    this.currentStars = wantedStars;
    this.isOn = !this.isOn;

    if (this.isOn) {
      this.staticTimer = 0.32;
      this.storyTimer = 0.45;
      this.tickerX = this.w;
      this.drawBroadcast(0);
    } else {
      this.stopSpeech();
      this.drawOffScreen();
    }
    return this.isOn;
  }

  public turnOff(): void {
    if (!this.isOn) return;
    this.isOn = false;
    this.stopSpeech();
    this.drawOffScreen();
  }

  private getStories(): { headline: string; spoken: string }[] {
    const stories: { headline: string; spoken: string }[] = [
      {
        headline: 'HIGH-SPEED CHASE ON OCEAN DRIVE',
        spoken:
          'Good evening Vice Coast. This is Channel Six News. Police are searching for a suspect spotted speeding down Ocean Drive in a neon sports car.',
      },
      {
        headline: 'VICE BEACH WEATHER: GOLDEN HOUR DUSK',
        spoken:
          'Weather update from South Beach. Expect warm golden hour skies after a brief tropical rain shower. Watch out for slick asphalt and beach stunt ramps.',
      },
      {
        headline: 'NEON CLUB BASS SHAKES COASTAL DISTRICT',
        spoken:
          'Local residents report massive one hundred twenty six B P M bass shaking windows all along the Neon Club beachfront tonight.',
      },
      {
        headline: 'VICE PD AIR-ONE CHOPPER ON ALERT',
        spoken:
          'Vice P D Air One helicopter and pursuit interceptors remain on high alert following multiple roadblock breakouts downtown.',
      },
    ];

    if (this.currentCash >= 1000) {
      stories.unshift({
        headline: `MYSTERY VIGILANTE HITS $${this.currentCash.toLocaleString('en-US')}`,
        spoken: `Breaking news on Channel Six! Authorities are stunned as an unknown coastal driver has already amassed over ${this.currentCash} dollars in street bounties tonight.`,
      });
    }
    if (this.currentStars >= 2) {
      stories.unshift({
        headline: `ACTIVE ${this.currentStars}-STAR POLICE MANHUNT`,
        spoken: `Urgent bulletin! Vice P D has issued a level ${this.currentStars} alert across the coastal district. Citizens are advised to stay indoors.`,
      });
    }
    return stories;
  }

  private speakHeadline(text: string): void {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
    try {
      window.speechSynthesis.cancel();
      const utter = new SpeechSynthesisUtterance(text);
      utter.lang = 'en-US';
      utter.rate = 1.03;
      utter.pitch = 0.96;
      utter.volume = 0.85;

      const voices = window.speechSynthesis.getVoices();
      const usVoice =
        voices.find((v) => v.lang.toLowerCase().startsWith('en-us')) ??
        voices.find((v) => v.lang.toLowerCase().startsWith('en'));
      if (usVoice) utter.voice = usVoice;

      utter.onstart = () => {
        this.isSpeaking = true;
      };
      utter.onend = () => {
        this.isSpeaking = false;
      };
      utter.onerror = () => {
        this.isSpeaking = false;
      };
      window.speechSynthesis.speak(utter);
    } catch {
      this.isSpeaking = false;
    }
  }

  private stopSpeech(): void {
    this.isSpeaking = false;
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      try {
        window.speechSynthesis.cancel();
      } catch {
        // ignore
      }
    }
  }

  public update(dt: number, elapsed: number, playerInsideSafehouse: boolean, cash: number, wantedStars: number): void {
    this.currentCash = cash;
    this.currentStars = wantedStars;

    if (!this.isOn) return;

    // Quietly mute/turn off voice if player walks out of the Safehouse
    if (!playerInsideSafehouse && this.isSpeaking) {
      this.stopSpeech();
    }

    if (this.staticTimer > 0) {
      this.staticTimer = Math.max(0, this.staticTimer - dt);
    }

    // Cycle news story every ~11s while player is inside
    this.storyTimer -= dt;
    if (this.storyTimer <= 0 && playerInsideSafehouse) {
      const stories = this.getStories();
      const story = stories[this.storyIndex % stories.length];
      this.storyIndex = (this.storyIndex + 1) % stories.length;
      this.speakHeadline(story.spoken);
      this.storyTimer = 11.5;
    }

    // Redraw animated CRT canvas at ~16 FPS (lightweight & authentic retro feel)
    this.redrawTimer -= dt;
    if (this.redrawTimer <= 0) {
      this.redrawTimer = 0.062;
      this.tickerX -= 3.2;
      if (this.tickerX < -460) this.tickerX = this.w + 20;
      this.drawBroadcast(elapsed);
    }
  }

  private drawOffScreen(): void {
    const ctx = this.ctx;
    ctx.fillStyle = '#0d0f17';
    ctx.fillRect(0, 0, this.w, this.h);
    // Subtle curved CRT glass reflection glint
    const grad = ctx.createLinearGradient(0, 0, this.w, this.h);
    grad.addColorStop(0, 'rgba(90, 120, 160, 0.14)');
    grad.addColorStop(0.5, 'rgba(20, 20, 34, 0.0)');
    grad.addColorStop(1, 'rgba(255, 110, 180, 0.08)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, this.w, this.h);
    this.texture.needsUpdate = true;
  }

  private drawBroadcast(elapsed: number): void {
    const ctx = this.ctx;
    const w = this.w;
    const h = this.h;

    if (this.staticTimer > 0) {
      // Brief CRT turn-on static snow
      ctx.fillStyle = '#181822';
      ctx.fillRect(0, 0, w, h);
      for (let i = 0; i < 420; i++) {
        const v = Math.floor(Math.random() * 255);
        ctx.fillStyle = `rgb(${v},${v},${v})`;
        ctx.fillRect(Math.random() * w, Math.random() * h, 6, 3);
      }
      this.texture.needsUpdate = true;
      return;
    }

    // 1) 80s News Studio Sunset Backdrop
    const bg = ctx.createLinearGradient(0, 0, 0, h);
    bg.addColorStop(0, '#14193d');
    bg.addColorStop(0.55, '#59286e');
    bg.addColorStop(1, '#1a1228');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, w, h);

    // Studio background city skyline silhouette
    ctx.fillStyle = 'rgba(18, 12, 34, 0.72)';
    const bars = [38, 62, 48, 76, 54, 42, 68, 52, 60];
    bars.forEach((bh, i) => {
      ctx.fillRect(i * 36 + 4, 152 - bh, 28, bh);
    });

    // Side inset graphic box ("VICE COAST LIVE")
    ctx.fillStyle = 'rgba(20, 32, 68, 0.88)';
    ctx.fillRect(16, 48, 86, 62);
    ctx.strokeStyle = '#36f1e6';
    ctx.lineWidth = 2;
    ctx.strokeRect(16, 48, 86, 62);
    ctx.fillStyle = '#ff8e53';
    ctx.beginPath();
    ctx.arc(59, 82, 16, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#1b4f72';
    ctx.fillRect(18, 86, 82, 22);
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 9px sans-serif';
    ctx.fillText('OCEAN DRIVE', 26, 61);

    // 2) Animated 80s News Anchor behind the desk
    const ax = 192;
    const ay = 104 + Math.sin(elapsed * 3.5) * 1.5;

    // Navy suit shoulders & red tie
    ctx.fillStyle = '#1a274f';
    ctx.beginPath();
    ctx.ellipse(ax, ay + 58, 46, 36, 0, Math.PI, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.moveTo(ax - 12, ay + 28);
    ctx.lineTo(ax + 12, ay + 28);
    ctx.lineTo(ax, ay + 56);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#e63956';
    ctx.fillRect(ax - 3, ay + 34, 6, 22);

    // Head & 80s feathered hair
    ctx.fillStyle = '#e2b192';
    ctx.beginPath();
    ctx.arc(ax, ay + 6, 22, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#3b241c';
    ctx.beginPath();
    ctx.arc(ax, ay - 2, 23, Math.PI, Math.PI * 2);
    ctx.fill();
    ctx.fillRect(ax - 23, ay - 6, 7, 14);
    ctx.fillRect(ax + 16, ay - 6, 7, 14);

    // Eyes (occasional blink)
    const blinking = Math.sin(elapsed * 1.7) > 0.96;
    ctx.fillStyle = '#1b1520';
    if (blinking) {
      ctx.fillRect(ax - 10, ay + 4, 6, 2);
      ctx.fillRect(ax + 4, ay + 4, 6, 2);
    } else {
      ctx.fillRect(ax - 9, ay + 2, 4, 5);
      ctx.fillRect(ax + 5, ay + 2, 4, 5);
    }

    // Animated talking mouth!
    const mouthOpen = this.isSpeaking ? 2 + Math.abs(Math.sin(elapsed * 16)) * 6 : 2;
    ctx.fillStyle = '#6b2232';
    ctx.fillRect(ax - 6, ay + 15, 12, mouthOpen);

    // News Desk foreground
    ctx.fillStyle = '#241838';
    ctx.fillRect(0, 154, w, 46);
    ctx.fillStyle = '#36f1e6';
    ctx.fillRect(0, 154, w, 3);

    // 3) Top-Left LIVE badge & Top-Right CHANNEL 6 logo
    if (Math.sin(elapsed * 5) > -0.3) {
      ctx.fillStyle = '#e62244';
      ctx.fillRect(14, 14, 54, 18);
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 11px sans-serif';
      ctx.fillText('● LIVE', 21, 27);
    }
    ctx.fillStyle = 'rgba(14, 10, 26, 0.8)';
    ctx.fillRect(w - 92, 12, 80, 22);
    ctx.fillStyle = '#ffd15c';
    ctx.font = '900 12px sans-serif';
    ctx.fillText('VICE 6 NEWS', w - 87, 27);

    // 4) Lower-Third Breaking News Banner + Scrolling Ticker
    const stories = this.getStories();
    const activeStory = stories[(this.storyIndex + stories.length - 1) % stories.length];

    ctx.fillStyle = '#cc1b3e';
    ctx.fillRect(0, 174, w, 24);
    ctx.fillStyle = '#ffffff';
    ctx.font = '900 12px sans-serif';
    ctx.fillText(`BREAKING: ${activeStory.headline}`, 10, 190);

    // Scrolling ticker bar
    ctx.fillStyle = '#120b20';
    ctx.fillRect(0, 198, w, 26);
    ctx.fillStyle = '#ffd15c';
    ctx.font = 'bold 11px monospace';
    ctx.fillText(
      '+++ VICE CHANNEL 6 +++ OCEAN DRIVE TRAFFIC HEAVY +++ NEON CLUB OPEN ALL NIGHT +++ AMMU-NEON SALE AT CENTRAL PLAZA +++',
      this.tickerX,
      215,
    );

    // 5) Subtle CRT Scanlines
    ctx.fillStyle = 'rgba(0, 0, 0, 0.18)';
    for (let y = 0; y < h; y += 4) {
      ctx.fillRect(0, y, w, 1);
    }

    this.texture.needsUpdate = true;
  }
}
