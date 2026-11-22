/**
 * K.I.T.T. Sarcastic AI Voice & Subtitle System for the 1982 Pontiac Firebird Trans Am.
 * Uses the browser Web Speech API (`speechSynthesis`, de-DE) just like ViceNewsTv.ts,
 * plus returns subtitle text for the HUD dialogue banner so jokes are always readable even if muted.
 */
export type KittQuipCategory = 'enter' | 'boost' | 'crash' | 'wanted' | 'stunt';

const KITT_QUIPS: Record<KittQuipCategory, string[]> = {
  enter: [
    'Guten Abend, Michael. Ich hoffe, Sie haben heute eine gültige Fahrerlaubnis dabei.',
    'Willkommen an Bord. Bitte fassen Sie nicht schon wieder mein Armaturenbrett mit fettigen Fingern an.',
    'Systeme online. Versuchen wir heute zur Abwechslung mal, die Lackierung intakt zu lassen.',
    'Alle Sensoren bereit. Und nein, ich fahre nicht durch den Drive-Thru vom Starlight Diner.',
  ],
  boost: [
    'Ich bezweifle stark, dass dieses Manöver von der Straßenverkehrsordnung gedeckt ist.',
    'Turbo-Boost aktiviert. Meine Stoßdämpfer schicken Ihnen übrigens herzliche Grüße.',
    'Fliegen war technisch gesehen nicht Teil meiner Werksgarantie, Michael.',
    'Über eine Polizeisperre springen? Wie überaus subtil.',
    'Schwerkraft erfolgreich beleidigt. Ich berechne bereits die Werkstattrechnung.',
    'Turbo-Boost gezündet. Bitte behalten Sie Arme, Beine und Hawaiihemd im Fahrzeug.',
  ],
  crash: [
    'Ausgezeichnet. Ein weiterer Kratzer in meiner molekularen Panzerung.',
    'Statistisch gesehen wäre Bremsen die klügere Option gewesen, Michael.',
    'Das war kein Parkplatz, das war ein massiver Betonpfeiler.',
    'Ich habe ein hochentwickeltes Kollisionsradar — Sie ignorieren es lediglich mit beeindruckender Konsequenz.',
  ],
  wanted: [
    'Mehrere Vice-PD-Einheiten verfolgen uns. Soll ich schon mal einen Anwalt anrufen?',
    'Blaulicht im Rückspiegel. Ich nehme an, wir halten nicht für ein freundliches Gespräch an?',
    'Die Polizei von Palm City scheint heute besonders anhänglich zu sein.',
  ],
  stunt: [
    'Beeindruckende Flugbahn. Die Physik weint gerade leise im Hintergrund.',
    'Landung geglückt. Meine Wirbelsäule — pardon, meine Hinterachse — dankt es Ihnen.',
  ],
};

export class KittAiSystem {
  private readonly lastIdx: Record<KittQuipCategory, number> = {
    enter: -1,
    boost: -1,
    crash: -1,
    wanted: -1,
    stunt: -1,
  };

  private subtitleText = '';
  private subtitleTimer = 0;
  private cooldownTimer = 0;

  public speak(category: KittQuipCategory, muted: boolean, force = false): string | null {
    if (!force && this.cooldownTimer > 0) return null;

    const pool = KITT_QUIPS[category];
    let idx = Math.floor(Math.random() * pool.length);
    if (pool.length > 1 && idx === this.lastIdx[category]) {
      idx = (idx + 1) % pool.length;
    }
    this.lastIdx[category] = idx;
    const line = pool[idx];

    this.subtitleText = line;
    this.subtitleTimer = Math.max(3.6, Math.min(6.2, line.length * 0.068));
    this.cooldownTimer = category === 'boost' ? 1.8 : 4.5;

    if (!muted) {
      this.speakTts(line);
    }
    return line;
  }

  public stop(): void {
    this.subtitleText = '';
    this.subtitleTimer = 0;
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      try {
        window.speechSynthesis.cancel();
      } catch {
        // ignore
      }
    }
  }

  public update(dt: number): { speaker: string | null; text: string | null } {
    if (this.cooldownTimer > 0) {
      this.cooldownTimer = Math.max(0, this.cooldownTimer - dt);
    }
    if (this.subtitleTimer > 0) {
      this.subtitleTimer = Math.max(0, this.subtitleTimer - dt);
      if (this.subtitleTimer <= 0) {
        this.subtitleText = '';
      }
    }
    if (this.subtitleText) {
      return { speaker: 'K.I.T.T. · KI', text: this.subtitleText };
    }
    return { speaker: null, text: null };
  }

  private speakTts(text: string): void {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
    try {
      window.speechSynthesis.cancel();
      const utter = new SpeechSynthesisUtterance(text);
      utter.lang = 'de-DE';
      utter.rate = 1.05;
      utter.pitch = 0.84;
      utter.volume = 0.9;

      const voices = window.speechSynthesis.getVoices();
      const deVoice =
        voices.find((v) => v.lang.toLowerCase().startsWith('de-de')) ??
        voices.find((v) => v.lang.toLowerCase().startsWith('de'));
      if (deVoice) utter.voice = deVoice;

      window.speechSynthesis.speak(utter);
    } catch {
      // Speech synthesis not supported or blocked
    }
  }
}
