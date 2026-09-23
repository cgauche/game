/**
 * PALETTE SÉMANTIQUE du rig — personnalisation de couleur cohérente, applicable à tout.
 *
 * Les parts (tenues, visage/cheveux, parts monstrueuses) référencent des CLÉS DE PALETTE
 * (`clesDePalette.ts`) au lieu de couleurs en dur : `@peau`, `@cheveux`, `@vet1` (vêtement principal),
 * `@vet2` (secondaire), `@cuir`, `@metal`. Au moment de composer le rig, `buildTokenMap` +
 * `applyTokenMap` remplacent ces jetons par les couleurs résolues. Chaque clé porte une GAMME : sa
 * base, son ombre `<clé>O` et sa lumière `<clé>H`. Résolu en hex (pas de var() CSS) → marche en
 * navigateur ET en rendu headless (resvg).
 */
import type { PartArt } from './parts/types';
import { SLOTS, type Slot } from '../../data/palette.types';
import { CLES, COUCHE_DEFAUT, SUIVEUSES, defautDe, propagerSuiveuses } from './clesDePalette';

export { SLOTS, type Slot };

/** Surcharge du joueur, par clé recoloriable. Tout est optionnel. */
export type Palette = { [K in Slot]?: string };

/** Multiplie chaque canal RGB d'un hex par f (clamp 0..255) → assombrit (<1) / éclaircit (>1). */
function scale(hex: string, f: number): string {
  const m = /^#?([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(hex.trim());
  if (!m) return hex;
  const ch = (h: string) => Math.max(0, Math.min(255, Math.round(parseInt(h, 16) * f)));
  const to2 = (n: number) => n.toString(16).padStart(2, '0');
  return `#${to2(ch(m[1]))}${to2(ch(m[2]))}${to2(ch(m[3]))}`;
}

// Suffixes de gamme : base, Ombre (assombrie), lumière H (éclaircie).
const SHADES: [suffix: string, factor: number][] = [['', 1], ['O', 0.78], ['H', 1.18]];

/** Luminance Rec.709 ramenée sur 0..100 — l'échelle du contrat (jamais 0..255). */
export function lum(r: number, g: number, b: number): number {
  return ((0.2126 * r + 0.7152 * g + 0.0722 * b) / 255) * 100;
}

/**
 * Palette DÉCLARÉE d'une couche (def de tenue, arme, armure, espèce…) : des bases (`vet1`, `cuir`…)
 * et, le cas échéant, l'ombre et la lumière EXACTES de leur gamme (`vet1O`, `vet1H`…).
 */
export type PaletteDeclaree = Record<string, string>;

function stripUndef(p: Palette): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(p)) if (v != null) out[k] = v;
  return out;
}

/** Indice de la couche la plus haute qui donne la base `k`, -1 si aucune. */
function coucheQuiDonne(pile: readonly Readonly<Record<string, string>>[], k: string): number {
  let i = pile.length - 1;
  while (i >= 0 && pile[i][k] == null) i--;
  return i;
}

/**
 * Table finale jeton→hex, par couches (#1903 D3) : défaut (`COUCHE_DEFAUT`) < `couches`, de la plus
 * basse à la plus haute < `surcharge`. Chaque couche propage ses clés suiveuses (`propagerSuiveuses`).
 * Pour chaque base (clés de la table ∪ bases déclarées) :
 *  - sans surcharge, la base est celle de la couche la plus haute qui la donne ; son ombre/sa lumière
 *    est celle de CETTE couche si elle y est déclarée, sinon dérivée de la base ;
 *  - sous surcharge, toute la gamme est dérivée de la couleur choisie ; une suiveuse suit la surcharge
 *    de sa clé suivie, sauf si la couche qui donne sa base la déclare elle-même.
 */
export function buildTokenMap(couches: readonly PaletteDeclaree[], surcharge: Palette = {}): Record<string, string> {
  const declarees = [COUCHE_DEFAUT, ...couches];
  const pile = declarees.map(propagerSuiveuses);
  const ov = stripUndef(surcharge);
  for (const [f, s] of SUIVEUSES) {
    if (ov[s] == null || ov[f] != null) continue;
    const i = coucheQuiDonne(pile, f);
    if (i < 0 || declarees[i][f] == null) ov[f] = ov[s];
  }
  const bases = new Set<string>(CLES);
  for (const c of pile) for (const k of Object.keys(c)) bases.add(k.replace(/(O|H)$/, ''));
  const out: Record<string, string> = {};
  for (const k of bases) {
    const choisie = ov[k];
    if (choisie != null) {
      for (const [suf, f] of SHADES) out[k + suf] = f === 1 ? choisie : scale(choisie, f);
      continue;
    }
    const i = coucheQuiDonne(pile, k);
    if (i < 0) continue;
    const couche = pile[i];
    for (const [suf, f] of SHADES) out[k + suf] = couche[k + suf] ?? scale(couche[k], f);
  }
  return out;
}

/** Substitue les tokens `@slot`/`@slotO`/`@slotH` d'un fragment SVG via une table prête.
 *  Un token inconnu est laissé tel quel (no-op). Construire la table 1× par rig. */
export function applyTokenMap(svg: string, map: Record<string, string>): string {
  if (!svg.includes('@')) return svg;
  return svg.replace(/@([a-zA-Z]\w*)/g, (whole, key: string) => map[key] ?? whole);
}

/** Relève `applyTokenMap` sur un `PartArt` : string → substitution directe ; art directionnel →
 *  substitution sur chaque vue présente (les clés absentes restent absentes). No-op sur un art
 *  sans `@token` (préserve l'art verbatim). Source unique pour recolorier un art tenu (arme/bouclier). */
export function applyTokenMapArt(art: PartArt, map: Record<string, string>): PartArt {
  return typeof art === 'string'
    ? applyTokenMap(art, map)
    : {
        front: applyTokenMap(art.front, map),
        ...(art.back !== undefined && { back: applyTokenMap(art.back, map) }),
        ...(art.profile !== undefined && { profile: applyTokenMap(art.profile, map) }),
      };
}

/**
 * Chair DYNAMIQUE (#583 point 2) : `g_flesh` (`fxGradients.ts`) est un dégradé global FIXE
 * (peau claire), monté une seule fois au niveau du stage — il ne peut donc pas varier par
 * personnage sous ce même id. `fleshGradientId`/`fleshGradientDefs` fabriquent, PAR INSTANCE, un
 * dégradé équivalent dérivé de la peau résolue (`@peauH` → `@peauO`) ; `composeRig.tsx` l'injecte
 * en `<defs>` local et réécrit `url(#g_flesh)` vers cet id quand une part du personnage l'utilise
 * — aucune tenue n'est modifiée, seule la RÉSOLUTION change. Id déterministe (dérivé des hex
 * résolus) : deux personnages de même teinte de peau partagent le même dégradé sans collision.
 */
/** Stops H/O de la chair — DÉRIVÉS de `peau` via `scale`/`SHADES` (même dérivation que
 *  `buildTokenMap`) quand la map n'en porte pas déjà, jamais un dégradé PLAT (les deux stops
 *  identiques à `map.peau`) : le chemin réel (`composeRig.tsx`, `tmap = buildTokenMap(...)`)
 *  les porte toujours, mais tout appelant qui passerait une palette non résolue (`PaletteDeclaree`
 *  brute) doit recevoir un dégradé qui ombre quand même. */
function fleshStops(map: Record<string, string>): { h: string; o: string } {
  const peau = map.peau ?? defautDe('peau');
  const shadeOf = (suf: 'O' | 'H', f: number) => map[`peau${suf}`] ?? scale(peau, f);
  return { h: shadeOf('H', 1.18), o: shadeOf('O', 0.78) };
}

export function fleshGradientId(map: Record<string, string>): string {
  const { h, o } = fleshStops(map);
  return `g_flesh_${h.replace('#', '')}_${o.replace('#', '')}`;
}

export function fleshGradientDefs(map: Record<string, string>): string {
  const { h, o } = fleshStops(map);
  return `<defs><linearGradient id="${fleshGradientId(map)}" x1="0" y1="0" x2="0" y2="1">` +
    `<stop offset="0%" stop-color="${h}"/><stop offset="100%" stop-color="${o}"/></linearGradient></defs>`;
}
