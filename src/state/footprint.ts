/**
 * Empreinte de grille des créatures par Taille — LDB `15 - Déplacement.md` l.55 :
 * « 1 case = 2 mètres … Les créatures plus grandes peuvent occuper **2, 4 ou même plus de cases**
 * sur la carte, en fonction de leur trait Taille (voir p.342). » Le LDB ne fige PAS de table par
 * catégorie (formulation permissive) ; choix de design ANCRÉ sur le texte canon :
 *   Grande = 2×2 (= les « 4 cases » citées), Énorme = 3×3, Monstrueuse = 4×4 (« ou même plus ») ;
 *   Minuscule → Moyenne = 1×1 (standard implicite des espèces jouables).
 *
 * PUR (géométrie de grille, pas une règle testée). Convention d'ANCRAGE : `pos` = coin Nord-Ouest
 * (min x, min y) de l'empreinte, qui s'étend vers +x/+y. Une créature 1×1 garde sa sémantique
 * actuelle (pos = sa tuile), donc tout le code positionnel existant reste correct par défaut.
 */
import { effectiveSize, type SizeCategory } from '../engine/size';
import type { Combatant } from '../engine/types';
import type { Pt } from './path';

/** Côté N de l'empreinte carrée N×N par catégorie de Taille (LDB 15 l.55, ancré « 2/4/+ cases »). */
const FOOTPRINT_SIDE: Record<SizeCategory, number> = {
  minuscule: 1,
  tresPetite: 1,
  petite: 1,
  moyenne: 1,
  grande: 2,
  enorme: 3,
  monstrueuse: 4,
};

/** Côté N de l'empreinte carrée pour une Taille créature (défaut Moyenne = 1). */
export function sizeFootprint(size?: SizeCategory): number {
  return FOOTPRINT_SIDE[effectiveSize(size)];
}

/** Côté N de l'empreinte d'une ENTITÉ — accesseur UNIQUE qui DÉCOUPLE l'empreinte de grille de la Taille
 *  créature : `footprint` explicite (objet à empreinte propre — un NAVIRE, MDG ch.12, qui occupe N cases sans
 *  être une créature) prime ; sinon dérivée de la Taille créature (`size`). Un navire n'a donc PAS de `size`
 *  (→ aucune Peur de Taille / Piétinement / ×Dégâts) tout en occupant ses cases. */
export function footprintN(c: { size?: SizeCategory; footprint?: number }): number {
  return c.footprint ?? sizeFootprint(c.size);
}

/** Tuiles occupées par une empreinte carrée de côté `n` ancrée en `pos` (coin NO). Renvoie n×n tuiles. */
export function footprintTiles(pos: Pt, n = 1): Pt[] {
  if (n <= 1) return [{ x: pos.x, y: pos.y }];
  const out: Pt[] = [];
  for (let dy = 0; dy < n; dy++) for (let dx = 0; dx < n; dx++) out.push({ x: pos.x + dx, y: pos.y + dy });
  return out;
}

/** L'empreinte (pos, côté `n`) couvre-t-elle la tuile (x, y) ? */
export function occupiesTile(pos: Pt, n: number, x: number, y: number): boolean {
  const side = Math.max(1, n);
  return x >= pos.x && x < pos.x + side && y >= pos.y && y < pos.y + side;
}

/** Géométrie d'un DÉCOR à empreinte rectangulaire (`SceneEntity.foot {w,h}`, ancre = coin NO) :
 *  décalage fractionnaire vers le CENTRE du bloc (pour y poser le token) et facteur d'échelle
 *  visuel (côté max). Absent/1×1 ⇒ identité — le décor historique ne bouge pas. */
export function decorFootGeometry(foot?: { w: number; h: number }): { offX: number; offY: number; scale: number } {
  const w = Math.max(1, foot?.w ?? 1);
  const h = Math.max(1, foot?.h ?? 1);
  return { offX: (w - 1) / 2, offY: (h - 1) / 2, scale: Math.max(w, h) };
}

/** Écart 1D minimal entre les intervalles [a, a+an) et [b, b+bn) (0 s'ils se recouvrent ou se touchent). */
function gapAxis(a: number, an: number, b: number, bn: number): number {
  const a2 = a + an - 1;
  const b2 = b + bn - 1;
  if (a <= b2 && b <= a2) return 0; // recouvrement sur cet axe
  return Math.max(b - a2, a - b2); // écart positif (l'un est strictement avant l'autre)
}

/**
 * Distance de Chebyshev MINIMALE entre deux empreintes (la plus petite distance tuile-à-tuile,
 * diagonale incluse) : 0 = chevauchement, 1 = au contact/adjacentes. Coïncide avec `chebyshev`
 * pour deux créatures 1×1. Base de l'adjacence / portée / Engagement « par empreinte ».
 */
export function footprintChebyshev(aPos: Pt, an: number, bPos: Pt, bn: number): number {
  return Math.max(gapAxis(aPos.x, an, bPos.x, bn), gapAxis(aPos.y, an, bPos.y, bn));
}

/** Deux empreintes (de côtés `an`/`bn`) se chevauchent-elles (collision de placement) ? */
export function footprintsOverlap(aPos: Pt, an: number, bPos: Pt, bn: number): boolean {
  return footprintChebyshev(aPos, an, bPos, bn) === 0;
}

/** Un niveau de hauteur (étage) en cases. DÉRIVÉ (jamais inventé) : `FALL_METRES_PER_LEVEL` (4 m,
 *  `jumpMove.ts`) ÷ 2 m par case (canon LDB 15 « 1 case = 2 m ») = 2. Constante documentée plutôt
 *  qu'import, pour garder `footprint.ts` PUR (pas de dépendance vers la couche Effet/Flow de `jumpMove`). */
const TILES_PER_LEVEL = 2;

/**
 * Distance de COMBAT (Chebyshev d'empreinte) entre deux combattants positionnés — `Infinity` si l'un
 * n'est pas posé. Un grand est « au contact » (distance 1) si UNE de ses tuiles touche la cible, et
 * la portée d'un tir se mesure du bord de l'empreinte. Remplace `chebyshev(a.pos, b.pos)` partout où
 * la Taille des deux combattants compte (mêlée, bandes de portée, sélection de cible).
 *
 * Z-AWARE : la séparation verticale (Δétage × `TILES_PER_LEVEL`) borne la distance par le bas — deux
 * combattants à la même case mais à des étages différents NE sont pas superposés (muraille vs sol).
 * Δz=0 (cas coplanaire) ⇒ le terme vaut 0 ⇒ résultat byte-identique à l'ancien.
 */
export function combatDistance(a: Combatant, b: Combatant): number {
  if (!a.pos || !b.pos) return Infinity;
  const horizontal = footprintChebyshev(a.pos, footprintN(a), b.pos, footprintN(b));
  const vertical = TILES_PER_LEVEL * Math.abs((a.pos.z ?? 0) - (b.pos.z ?? 0));
  return Math.max(horizontal, vertical);
}
