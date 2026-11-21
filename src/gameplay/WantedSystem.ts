export class WantedSystem {
  public stars = 0;
  public heat = 0;
  private cooldownTimer = 0;

  public addHeat(amount: number): void {
    this.heat = Math.min(500, this.heat + amount);
    this.cooldownTimer = 18.0; // 18s without crimes to start losing stars
    this.recomputeStars();
  }

  public reset(): void {
    this.stars = 0;
    this.heat = 0;
    this.cooldownTimer = 0;
  }

  public update(dt: number): void {
    if (this.stars <= 0) return;

    this.cooldownTimer -= dt;
    if (this.cooldownTimer <= 0) {
      this.heat = Math.max(0, this.heat - dt * 28);
      this.recomputeStars();
    }
  }

  public isCoolingDown(): boolean {
    return this.stars > 0 && this.cooldownTimer <= 3.0;
  }

  private recomputeStars(): void {
    if (this.heat >= 360) this.stars = 5;
    else if (this.heat >= 250) this.stars = 4;
    else if (this.heat >= 150) this.stars = 3;
    else if (this.heat >= 70) this.stars = 2;
    else if (this.heat >= 20) this.stars = 1;
    else this.stars = 0;
  }
}
