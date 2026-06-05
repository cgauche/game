/**
 * PALETTE SÉMANTIQUE du rig — personnalisation de couleur cohérente, applicable à tout.
 *
 * Les parts (tenues, visage/cheveux, parts monstrueuses) référencent des EMPLACEMENTS
 * nommés au lieu de couleurs en dur : `@peau`, `@cheveux`, `@vet1` (vêtement principal),
 * `@vet2` (secondaire), `@cuir`, `@metal`. Au moment de composer le rig, `resolveTokens`
 * remplace ces tokens par les couleurs de la palette du personnage. Les ombres/reflets
 * sont DÉRIVÉS automatiquement : `@peauO` = peau assombrie, `@peauH` = éclaircie → le
 * dégradé survit au recoloriage. Résolu en hex (pas de var() CSS) → marche en navigateur
 * ET en rendu headless (resvg).
 */

/** Emplacements de couleur d'un personnage. Tout est optionnel (défauts sinon). */
export interface Palette {
  peau?: string;
  cheveux?: string;
  vet1?: string; // vêtement principal
  vet2?: string; // vêtement secondaire / doublure
  cuir?: string;
  metal?: string;
}

/** Palette par défaut (paysan générique) — base avant overrides espèce/carrière/mutation. */
export const DEFAULT_PALETTE: Required<Palette> = {
  peau: '#e2b48c',
  cheveux: '#5a4427',
  vet1: '#6a5a3a',
  vet2: '#4a3a22',
  cuir: '#5a3f24',
  metal: '#8b94a6',
};

/** Multiplie chaque canal RGB d'un hex par f (clamp 0..255) → assombrit (<1) / éclaircit (>1). */
function scale(hex: string, f: number): string {
  const m = /^#?([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(hex.trim());
  if (!m) return hex;
  const ch = (h: string) => Math.max(0, Math.min(255, Math.round(parseInt(h, 16) * f)));
  const to2 = (n: number) => n.toString(16).padStart(2, '0');
  return `#${to2(ch(m[1]))}${to2(ch(m[2]))}${to2(ch(m[3]))}`;
}

// Suffixes de teinte : base, Ombre (assombri), Highlight (éclairci).
const SHADES: [suffix: string, factor: number][] = [['', 1], ['O', 0.78], ['H', 1.18]];

/** Construit la table token→hex pour une palette (slot + slotO + slotH chacun). */
function tokenMap(p: Palette): Record<string, string> {
  const full = { ...DEFAULT_PALETTE, ...stripUndef(p) };
  const out: Record<string, string> = {};
  for (const [slot, base] of Object.entries(full)) {
    for (const [suf, f] of SHADES) out[slot + suf] = f === 1 ? base : scale(base, f);
  }
  return out;
}

function stripUndef(p: Palette): Palette {
  const out: Palette = {};
  for (const [k, v] of Object.entries(p)) if (v != null) (out as Record<string, string>)[k] = v;
  return out;
}

/** Remplace les tokens `@slot` / `@slotO` / `@slotH` d'un fragment SVG par les couleurs
 *  de la palette. Un token inconnu est laissé tel quel (no-op). */
export function resolveTokens(svg: string, palette: Palette): string {
  if (!svg.includes('@')) return svg;
  const m = tokenMap(palette);
  return svg.replace(/@([a-zA-Z]\w*)/g, (whole, key: string) => m[key] ?? whole);
}
