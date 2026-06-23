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
  yeux?: string; // iris
  vet1?: string; // vêtement principal
  vet2?: string; // vêtement secondaire / doublure
  cuir?: string;
  metal?: string;
  corps?: string; // robe/pelage/peau de corps des créatures (gabarits non-humains)
  accent?: string; // détail vif (crête, langue, marque) — créatures
}

/** Palette par défaut (paysan générique) — base avant overrides espèce/carrière/mutation. */
export const DEFAULT_PALETTE: Required<Palette> = {
  peau: '#e2b48c',
  cheveux: '#5a4427',
  yeux: '#5a3e28',
  vet1: '#6a5a3a',
  vet2: '#4a3a22',
  cuir: '#5a3f24',
  metal: '#8b94a6',
  corps: '#6b4a2e',
  accent: '#c8923a',
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

/** Emplacements de base (ordre stable). */
export const SLOTS = ['peau', 'cheveux', 'yeux', 'vet1', 'vet2', 'cuir', 'metal', 'corps', 'accent'] as const;
export type Slot = (typeof SLOTS)[number];

/**
 * Palette STOCKÉE d'une tenue/tête : peut contenir non seulement les bases (`vet1`,
 * `cuir`…) mais aussi les ombres/reflets EXACTS d'origine (`vet1O`, `vet1H`, `cuirO`…).
 * Sert de DÉFAUT par-carrière → rendu identique à l'art dessiné, sans perte.
 */
export type StoredPalette = Record<string, string>;

function stripUndef(p: Palette): Palette {
  const out: Palette = {};
  for (const [k, v] of Object.entries(p)) if (v != null) (out as Record<string, string>)[k] = v;
  return out;
}

/**
 * Table finale token→hex. Règle par slot :
 *  - slot NON surchargé par l'utilisateur → on rend l'ombre/reflet EXACT stocké
 *    (`stored.vet1O`…) s'il existe → rendu par défaut identique à l'art ; sinon dérivé.
 *  - slot surchargé (`overrides.vet1`) → TOUTE la famille (base+O+H) est DÉRIVÉE de la
 *    couleur choisie → recoloriage cohérent (les ombres suivent).
 */
export function buildTokenMap(stored: StoredPalette, overrides: Palette = {}): Record<string, string> {
  const ov = stripUndef(overrides) as Record<string, string>;
  const out: Record<string, string> = {};
  // Bases CUSTOM qu'un plan déclare AU-DELÀ des slots créature (ex. navire : `coque`/`voile`/`mat`) —
  // adapté, pas tordu : on ne détourne plus `vet1`/`cuir`, chaque plan nomme ses propres jetons.
  const slotSet = new Set<string>(SLOTS);
  const customBases = [...new Set(
    Object.keys(stored).map((k) => k.replace(/(O|H)$/, '')).filter((b) => !slotSet.has(b)),
  )];
  for (const slot of [...SLOTS, ...customBases]) {
    const userBase = ov[slot];
    const base = userBase ?? stored[slot] ?? (DEFAULT_PALETTE as Record<string, string>)[slot];
    if (base == null) continue; // base custom non fournie → rien à dériver
    for (const [suf, f] of SHADES) {
      const token = slot + suf;
      if (userBase != null) {
        out[token] = f === 1 ? userBase : scale(userBase, f); // recolor → dérivé du choix
      } else {
        out[token] = stored[token] ?? (f === 1 ? base : scale(base, f)); // défaut → exact sinon dérivé
      }
    }
  }
  return out;
}

/** Substitue les tokens `@slot`/`@slotO`/`@slotH` d'un fragment SVG via une table prête.
 *  Un token inconnu est laissé tel quel (no-op). Construire la table 1× par rig. */
export function applyTokenMap(svg: string, map: Record<string, string>): string {
  if (!svg.includes('@')) return svg;
  return svg.replace(/@([a-zA-Z]\w*)/g, (whole, key: string) => map[key] ?? whole);
}

/** Commodité : (overrides, stored?) → SVG résolu. Pour 1 fragment ; sinon préférer
 *  buildTokenMap + applyTokenMap (table réutilisée). */
export function resolveTokens(svg: string, overrides: Palette, stored: StoredPalette = {}): string {
  if (!svg.includes('@')) return svg;
  return applyTokenMap(svg, buildTokenMap(stored, overrides));
}
