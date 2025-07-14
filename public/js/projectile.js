class Projectile {
  constructor(from, to) {
    this.from = from;
    this.to = to;
    this.progress = 0;
  }

  update(dt) {
    this.progress += dt * 5;
  }

  draw(ctx) {
    const fromPos = hexToPixel(this.from.q, this.from.r);
    const toPos = hexToPixel(this.to.q, this.to.r);

    const x = fromPos.x + (toPos.x - fromPos.x) * this.progress;
    const y = fromPos.y + (toPos.y - fromPos.y) * this.progress;

    ctx.fillStyle = 'yellow';
    ctx.beginPath();
    ctx.arc(x, y, 5, 0, 2 * Math.PI);
    ctx.fill();
  }

  isFinished() {
    return this.progress >= 1;
  }
}
