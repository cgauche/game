/**
 * Dump TEXTE du plan de l'Opéra (géométrie réelle de `buildOperaFloorplan`) en box-drawing, pour comparer
 * avec le rendu. Une carte WxH s'écrit en (2H+1)×(2W+1) : slots impairs = TUILES, pairs = ARÊTES.
 *   `-`/`|` mur · `:` porte · `+` jonction · espace = ouvert · `/ \` diagonale dans la case.
 *   Tuiles : `.` parquet(parterre/loges) · `,` dalle(salles/couloirs) · `M` marbre(foyer/loge royale) ·
 *            `S` scène surélevée · `s` fosse(planches en contrebas) · `#` escalier · espace = vide.
 * npx tsx scripts/qc/dump-opera-ascii.mts
 */
import { buildOperaFloorplan } from '../../src/scenes/opera/floorplan';

const s = buildOperaFloorplan();
const W = s.dimensions.w, H = s.dimensions.h;

function dump(z: number) {
  const lvl = s.levels.find((l) => l.z === z)!;
  const tiles = lvl.tiles, elev = lvl.elev ?? [];
  const wall = new Map<string, boolean>(); // key "x,y,N|E" -> door?
  const diag = new Map<string, string>();
  const stair = new Set<string>();
  for (const w of s.walls ?? []) {
    if ((w.z ?? 0) !== z) continue;
    if (w.side === 'N' || w.side === 'E') wall.set(`${w.x},${w.y},${w.side}`, !!w.door);
    else diag.set(`${w.x},${w.y}`, w.side);
  }
  for (const st of s.stairs ?? []) if (st.from.z === z || st.to.z === z) stair.add(`${st.from.x},${st.from.y}`);

  const cell = (x: number, y: number) => {
    if (stair.has(`${x},${y}`)) return '#';
    const d = diag.get(`${x},${y}`); if (d) return d;
    const t = tiles[y * W + x], e = elev[y * W + x] ?? 0;
    if (t === 'planches') return e > 0 ? 'S' : e < 0 ? 's' : 'P';
    return t === 'plancher' ? '.' : t === 'dalle' ? ',' : t === 'marbre' ? 'M' : t === 'vide' ? ' ' : '?';
  };

  const rows: string[] = [];
  for (let gy = 0; gy <= 2 * H; gy++) {
    let line = '';
    for (let gx = 0; gx <= 2 * W; gx++) {
      const ox = gx % 2 === 1, oy = gy % 2 === 1;
      if (ox && oy) line += cell((gx - 1) / 2, (gy - 1) / 2);
      else if (!ox && !oy) line += '+';
      else if (ox && !oy) { const w = wall.get(`${(gx - 1) / 2},${gy / 2},N`); line += w === undefined ? ' ' : w ? ':' : '-'; }
      else { const w = wall.get(`${gx / 2 - 1},${(gy - 1) / 2},E`); line += w === undefined ? ' ' : w ? ':' : '|'; }
    }
    rows.push(line.replace(/\s+$/, ''));
  }
  return rows.join('\n');
}

console.log(`=== REZ-DE-CHAUSSÉE (z=0) ${W}×${H} ===`);
console.log(dump(0));
console.log(`\n=== PREMIER ÉTAGE (z=1) ===`);
console.log(dump(1));
