import { LOWRIDER_DIR_SYMBOL, type LowriderDir } from '../gameplay/LowriderBattleSystem';

// Dirty-checked DOM write helpers to eliminate redundant style/layout work at 60–144 FPS
const domCache = new WeakMap<Element, string>();
export function setText(el: HTMLElement, text: string): void {
  if (domCache.get(el) !== text) {
    domCache.set(el, text);
    el.textContent = text;
  }
}

const widthCache = new WeakMap<HTMLElement, string>();
export function setWidth(el: HTMLElement, w: string): void {
  if (widthCache.get(el) !== w) {
    widthCache.set(el, w);
    el.style.width = w;
  }
}

export function setSquareSize(el: HTMLElement, size: string): void {
  if (widthCache.get(el) !== size) {
    widthCache.set(el, size);
    el.style.width = size;
    el.style.height = size;
  }
}

const opacityCache = new WeakMap<HTMLElement, string>();
export function setOpacity(el: HTMLElement, op: string): void {
  if (opacityCache.get(el) !== op) {
    opacityCache.set(el, op);
    el.style.opacity = op;
  }
}

const displayCache = new WeakMap<HTMLElement, string>();
export function setDisplay(el: HTMLElement, disp: string): void {
  if (displayCache.get(el) !== disp) {
    displayCache.set(el, disp);
    el.style.display = disp;
  }
}

const classCache = new WeakMap<Element, Map<string, boolean>>();
export function setClass(el: Element, cls: string, enabled: boolean): void {
  let map = classCache.get(el);
  if (!map) {
    map = new Map<string, boolean>();
    classCache.set(el, map);
  }
  if (map.get(cls) !== enabled) {
    map.set(cls, enabled);
    el.classList.toggle(cls, enabled);
  }
}

export const STAR_STRINGS = ['☆☆☆☆☆', '★☆☆☆☆', '★★☆☆☆', '★★★☆☆', '★★★★☆', '★★★★★'];

let cachedCashValue = -1;
let cachedCashText = '$0';
export function formatHudCash(cash: number): string {
  if (cash !== cachedCashValue) {
    cachedCashValue = cash;
    cachedCashText = `$${cash.toLocaleString('en-US')}`;
  }
  return cachedCashText;
}

/**
 * Pooled DOM nodes for the Lowrider Rhythm Battle track (zero innerHTML / createElement in the render loop!).
 */
export class LowriderNotePool {
  private readonly pool: HTMLDivElement[] = [];

  constructor(container: HTMLElement, poolSize = 8) {
    container.innerHTML = '';
    for (let i = 0; i < poolSize; i++) {
      const el = document.createElement('div');
      el.className = 'lowrider-note';
      el.style.display = 'none';
      container.appendChild(el);
      this.pool.push(el);
    }
  }

  public render(notes: { dir: LowriderDir; offsetSec: number }[]): void {
    const count = Math.min(notes.length, this.pool.length);
    for (let i = 0; i < count; i++) {
      const n = notes[i];
      const el = this.pool[i];
      const leftPct = 16 + (n.offsetSec / 1.8) * 82;
      setDisplay(el, 'block');
      setClass(el, 'hop', n.dir === 'hop');
      el.style.left = `${leftPct.toFixed(1)}%`;
      setText(el, LOWRIDER_DIR_SYMBOL[n.dir]);
    }
    for (let i = count; i < this.pool.length; i++) {
      setDisplay(this.pool[i], 'none');
    }
  }
}
