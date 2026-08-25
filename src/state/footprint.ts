/**
 * Empreinte de grille des créatures par Taille — LDB `15 - Déplacement.md` l.12 :
 * « 1 case = 2 mètres … Les créatures plus grandes peuvent occuper 2, 4 ou même plus de cases
 * sur la carte, en fonction de leur trait Taille (voir page 342). » Le canon n'imprime AUCUNE barre
 * par catégorie : les 7 valeurs sont une extrapolation MAISON, sortie en donnée éditable
 * (`src/data/sizes.json::footprintSide`, lue par `sizeFootprintSide`).
 *
 * PUR (géométrie de grille, pas une règle testée). Convention d'ANCRAGE : `pos` = coin Nord-Ouest
 * (min x, min y) de l'empreinte, qui s'étend vers +x/+y. Une créature 1×1 garde sa sémantique
 * actuelle (pos = sa tuile), donc tout le code positionnel existant reste correct par défaut.
 */
import { findPropById, propFootOf } from '../data';
import { effectiveSize, sizeFootprintSide, type SizeCategory } from '../engine/size';
import type { Combatant } from '../engine/types';
import type { Pt } from './path';
import { verticalTiles } from './relief';

/** Côté N de l'empreinte carrée pour une Taille créature (défaut Moyenne = 1). */
export function sizeFootprint(size?: SizeCategory): number {
  return sizeFootprintSide(effectiveSize(size));
}

/** Côté N de l'empreinte d'une ENTITÉ — accesseur UNIQUE qui DÉCOUPLE l'empreinte de grille de la Taille
 *  créature : `footprint` explicite (objet à empreinte propre — un NAVIRE, MDG 12, qui occupe N cases sans
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

/** Empreinte DÉCLARÉE du TYPE de décor (`props.json` `foot`, ancre = coin NO) — vérité UNIQUE des
 *  dimensions d'un prop : une instance de scène n'en redéclare aucune. Absente = le décor n'occupe
 *  que sa case et ne bloque que s'il est solide ou interactif (cf. `entityBlockedAt`). */
export const propDeclaredFoot = (ref: string | undefined): { w: number; h: number } | undefined =>
  (ref ? findPropById(ref)?.foot : undefined);

/** Cases couvertes par un décor de ref `ref` ancré en `pos` (sa seule case si aucune empreinte déclarée). */
export function propFootTiles(ref: string | undefined, pos: Pt): Pt[] {
  const { w, h } = propFootOf(findPropById(ref ?? ''));
  const out: Pt[] = [];
  for (let dy = 0; dy < h; dy++) for (let dx = 0; dx < w; dx++) out.push({ x: pos.x + dx, y: pos.y + dy });
  return out;
}

/** Géométrie d'un DÉCOR à empreinte rectangulaire (`PropData.foot {w,h}`, ancre = coin NO) :
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

/**
 * Distance de COMBAT (Chebyshev d'empreinte) entre deux combattants positionnés — `Infinity` si l'un
 * n'est pas posé. Un grand est « au contact » (distance 1) si UNE de ses tuiles touche la cible, et
 * la portée d'un tir se mesure du bord de l'empreinte. Remplace `chebyshev(a.pos, b.pos)` partout où
 * la Taille des deux combattants compte (mêlée, bandes de portée, sélection de cible).
 *
 * RELIEF : la séparation VERTICALE est la vraie hauteur métrique entre les deux surfaces, convertie en
 * cases (`verticalTiles`, Δhauteur ÷ échelle métrique) — un défenseur de muraille (h élevée) n'est PAS
 * superposé aux assaillants au sol. `mpt` = m/case de la scène (défaut 2 person-scale ; les appelants
 * qui ont la scène passent `sceneMetresPerTile(scene)`). Δhauteur=0 (même altitude) ⇒ terme nul ⇒
 * résultat byte-identique au plan. `pos.h` est stampé/rafraîchi à chaque mouvement (`placeCombatant`).
 */
export function combatDistance(a: Combatant, b: Combatant, mpt = 2): number {
  if (!a.pos || !b.pos) return Infinity;
  const horizontal = footprintChebyshev(a.pos, footprintN(a), b.pos, footprintN(b));
  const vertical = verticalTiles(a.pos.h ?? 0, b.pos.h ?? 0, mpt);
  return Math.max(horizontal, vertical);
}
