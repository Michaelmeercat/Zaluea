/** Uniform spatial hash for enemy queries (rebuilt every tick; cheap for a few hundred entities). */
export class SpatialGrid<T extends { x: number; y: number }> {
  private cells: T[][];
  private cols: number;
  private rows: number;
  private used: number[] = [];
  constructor(private w: number, private h: number, private size: number) {
    this.cols = Math.ceil(w / size) + 1;
    this.rows = Math.ceil(h / size) + 1;
    this.cells = Array.from({ length: this.cols * this.rows }, () => []);
  }
  clear() {
    for (const i of this.used) this.cells[i].length = 0;
    this.used.length = 0;
  }
  private idx(x: number, y: number) {
    const cx = Math.max(0, Math.min(this.cols - 1, Math.floor(x / this.size)));
    const cy = Math.max(0, Math.min(this.rows - 1, Math.floor(y / this.size)));
    return cy * this.cols + cx;
  }
  insert(item: T) {
    const i = this.idx(item.x, item.y);
    if (this.cells[i].length === 0) this.used.push(i);
    this.cells[i].push(item);
  }
  /** Calls fn for each item whose cell intersects the circle (caller does exact distance test). */
  query(x: number, y: number, r: number, out: T[]): T[] {
    out.length = 0;
    const s = this.size;
    const x0 = Math.max(0, Math.floor((x - r) / s)), x1 = Math.min(this.cols - 1, Math.floor((x + r) / s));
    const y0 = Math.max(0, Math.floor((y - r) / s)), y1 = Math.min(this.rows - 1, Math.floor((y + r) / s));
    for (let cy = y0; cy <= y1; cy++)
      for (let cx = x0; cx <= x1; cx++) {
        const c = this.cells[cy * this.cols + cx];
        for (let k = 0; k < c.length; k++) out.push(c[k]);
      }
    return out;
  }
}
