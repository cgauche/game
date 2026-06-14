/**
 * CATALOGUE UNIFIÉ d'éléments d'apparence (convergence B) — vocabulaire UNIQUE des éléments
 * visuels réutilisables, comme `GameOp` côté mécanique. Un PNJ / créature / race = une COMBINAISON
 * de clés de ce catalogue ; rien n'est verrouillé à une créature (cf. spec apparence-catalogue-unifie).
 *
 * B1 : les `features` de race (queue, cornes, oreilles, barbe, panse, écailles, pelage, griffes,
 * crocs, verrues, plaie…) — jusqu'ici inline et non réutilisables dans chaque `RaceDef` — vivent ICI,
 * keyées. Les races (et bientôt créatures/PNJ) les référencent par CLÉ via `feat(key)`.
 * B2 (à venir) : y fondre yeux (EYE_OPTIONS), membres monstrueux (MONSTER_*), mutations (MUTATION_VISUALS).
 */
import type { RaceFeature } from '../races/types';
import { OV_QUEUE, OV_QUEUE_RAT, OV_GRIFFES, OV_VERRUES, OV_PLAIE, OV_CROCS, OV_CORNES_TAUREAU, OV_CORNES_DEMON } from './monstrous';
import { lateralPair } from './parallax';
import { scalesPatch, furPatch } from './textures';

export type ElementCategory = 'oeil' | 'tete' | 'bras' | 'jambes' | 'trait' | 'morpho';

/** Un élément d'apparence : effets cumulables (superset des 4 registres). Pour B1, seuls
 *  `overlays` (traits de corps) sont peuplés ; les autres champs préparent la convergence B2. */
export interface AppearanceElement {
  label: string;                 // FR — pour les pickers de l'éditeur
  category: ElementCategory;
  overlays?: RaceFeature[];      // calques sur os (bone/svg/layer/scale/view). B2 élargira (replace/behind)
  eye?: { G?: string; D?: string }; // remplacement d'œil en place (B2)
  build?: number; legs?: number;    // morpho (B2)
  skin?: string; faceFlip?: boolean;// recolor / visage retourné (B2)
}

// --- Art inline déplacé des RaceDef vers le catalogue (byte-identique) ---------------------------
// Définition musculaire sur chair rouge (Démon) — pectoraux/ligne médiane/abdominaux en @peauO.
const OV_MUSCLES_TORSE =
  `<path d="M-8.5 -15 Q-4 -11.5 0 -12 Q4 -11.5 8.5 -15" stroke="@peauO" stroke-width="1" fill="none" opacity="0.8"/>`
  + `<path d="M0 -11.5 L0 9" stroke="@peauO" stroke-width="0.9" fill="none" opacity="0.7"/>`
  + `<path d="M-4.5 -5 Q0 -3.6 4.5 -5 M-4.2 1 Q0 2.4 4.2 1 M-3.8 7 Q0 8.4 3.8 7" stroke="@peauO" stroke-width="0.8" fill="none" opacity="0.65"/>`
  + `<path d="M-9 -18 Q-7 -12 -8.5 -6 M9 -18 Q7 -12 8.5 -6" stroke="@peauO" stroke-width="0.8" fill="none" opacity="0.55"/>`;
// Corne de PROFIL du Démon : UNE corne balayée vers l'arrière (paire proche/lointaine via lateralPair).
const CORNE_DEMON_PROFIL =
  `<path d="M6 -5 Q0 -9 -4.5 -13.5 Q-8.5 -18 -7.5 -23 Q-6.8 -25.8 -4.2 -26.6 Q-6.4 -22.8 -4.8 -18.8 Q-2.8 -13.8 1.6 -10 Q3.6 -8.2 6 -7 Z" fill="#1a1410" stroke="#000" stroke-width="0.5"/>`
  + `<path d="M-3.4 -14.5 q-1.8 -1 -2.4 -2.6 M-5.4 -19.5 q-1.4 -0.8 -1.7 -2.2" stroke="#3a3026" stroke-width="0.6" fill="none"/>`;
// Oreilles pointues aux tempes (elfes) — tell de l'elfe, couleur @peau.
const OREILLES_POINTUES =
  '<g>'
  + '<path d="M-8 7 Q-15 4 -14 -3 Q-11 1 -7 5 Z" fill="@peau" stroke="@peauO" stroke-width="0.6"/>'
  + '<path d="M8 7 Q15 4 14 -3 Q11 1 7 5 Z" fill="@peau" stroke="@peauO" stroke-width="0.6"/>'
  + '</g>';
// Grande barbe nourrie ancrée à la mâchoire (Nain) — couleur @cheveux.
const BARBE_NAINE =
  '<g>'
  + '<path d="M-9 8 Q-12 24 -5 32 Q0 35 5 32 Q12 24 9 8 Q5 13 0 13 Q-5 13 -9 8 Z" fill="@cheveux" stroke="@cheveuxO" stroke-width="0.7"/>'
  + '<path d="M-5 15 Q0 18 5 15" fill="none" stroke="@cheveuxO" stroke-width="0.7"/>'
  + '<path d="M-3 18 L-3 30 M3 18 L3 30" stroke="@cheveuxO" stroke-width="0.6" opacity="0.7"/>'
  + '</g>';
// Panse de l'Ogre : MORPHOLOGIE (corps nu) — grosse bedaine @peau (la plaque-bedaine est dans la tenue).
const PANSE_OGRE = '<ellipse cx="0" cy="6" rx="15" ry="16" fill="@peau" stroke="@peauO" stroke-width="0.8"/>';

/** Catalogue — clé stable → élément. B1 : traits de corps (category 'trait'). */
export const APPEARANCE_ELEMENTS: Record<string, AppearanceElement> = {
  // Queues
  'queue': { label: 'Queue', category: 'trait', overlays: [{ bone: 'bassin', svg: OV_QUEUE, scale: 'bone', layer: -2 }] },
  'queue-rat': { label: 'Queue de rat', category: 'trait', overlays: [{ bone: 'bassin', svg: OV_QUEUE_RAT, scale: 'bone', layer: -2 }] },
  // Cornes (variantes distinctes)
  'cornes-demon': {
    label: 'Cornes de démon', category: 'trait', overlays: [
      { bone: 'tete', svg: OV_CORNES_DEMON, scale: 'bone', layer: -2, view: 'front' },
      { bone: 'tete', svg: OV_CORNES_DEMON, scale: 'bone', layer: -2, view: 'back' },
      { bone: 'tete', svg: lateralPair(CORNE_DEMON_PROFIL, { dx: 4 }), scale: 'bone', layer: -2, view: 'profile' },
    ],
  },
  'cornes-taureau': { label: 'Cornes de taureau', category: 'trait', overlays: [{ bone: 'tete', svg: OV_CORNES_TAUREAU, scale: 'bone', layer: -2 }] },
  // Têtes/visage
  'oreilles-pointues': { label: 'Oreilles pointues', category: 'trait', overlays: [{ bone: 'tete', svg: OREILLES_POINTUES, scale: 'bone', layer: 3 }] },
  'barbe-naine': { label: 'Barbe naine', category: 'trait', overlays: [{ bone: 'tete', svg: BARBE_NAINE, scale: 'bone', layer: 10 }] },
  'crocs': { label: 'Crocs', category: 'trait', overlays: [{ bone: 'tete', svg: OV_CROCS, scale: 'bone', layer: 98, view: 'front' }] },
  // Mains
  'griffes': { label: 'Griffes', category: 'trait', overlays: [{ bone: 'mainG', svg: OV_GRIFFES, scale: 'bone', layer: 98 }, { bone: 'mainD', svg: OV_GRIFFES, scale: 'bone', layer: 98 }] },
  // Torse
  'muscles-torse': { label: 'Musculature marquée', category: 'trait', overlays: [{ bone: 'torse', svg: OV_MUSCLES_TORSE, scale: 'bone', layer: 60 }] },
  'panse': { label: 'Panse', category: 'trait', overlays: [{ bone: 'torse', svg: PANSE_OGRE, scale: 'bone', layer: 50 }] },
  'verrues': { label: 'Verrues', category: 'trait', overlays: [{ bone: 'torse', svg: OV_VERRUES, scale: 'bone', layer: 98 }] },
  'plaie': { label: 'Plaie ouverte', category: 'trait', overlays: [{ bone: 'torse', svg: OV_PLAIE, scale: 'bone', layer: 98 }] },
  // Peaux texturées (multi-os) — tunées par carrure : pelage standard / massif, écailles
  'pelage': {
    label: 'Pelage', category: 'trait', overlays: [
      { bone: 'torse', svg: furPatch(-7.5, 7.5, -19, 11, 3.2), scale: 'bone' },
      { bone: 'epauleG', svg: furPatch(-2.4, 2.4, 2, 24, 2.8), scale: 'bone' },
      { bone: 'epauleD', svg: furPatch(-2.4, 2.4, 2, 24, 2.8), scale: 'bone' },
    ],
  },
  'pelage-massif': {
    label: 'Pelage massif', category: 'trait', overlays: [
      { bone: 'torse', svg: furPatch(-8, 8, -20, 12, 3.4), scale: 'bone' },
      { bone: 'epauleG', svg: furPatch(-2.6, 2.6, 2, 26, 3), scale: 'bone' },
      { bone: 'epauleD', svg: furPatch(-2.6, 2.6, 2, 26, 3), scale: 'bone' },
    ],
  },
  'ecailles': {
    label: 'Écailles', category: 'trait', overlays: [
      { bone: 'torse', svg: scalesPatch(-8, 8, -20, 12, 3), scale: 'bone' },
      { bone: 'epauleG', svg: scalesPatch(-2.6, 2.6, 2, 26, 2.6), scale: 'bone' },
      { bone: 'epauleD', svg: scalesPatch(-2.6, 2.6, 2, 26, 2.6), scale: 'bone' },
      { bone: 'cuisseG', svg: scalesPatch(-3, 3, 2, 42, 3), scale: 'bone' },
      { bone: 'cuisseD', svg: scalesPatch(-3, 3, 2, 42, 3), scale: 'bone' },
    ],
  },
};

/** Résout des clés du catalogue en calques (overlays). Clé inconnue → ignorée. Utilisé par les
 *  RaceDef (sélection par défaut) et l'apparence d'instance (PNJ qui ajoute des traits). */
export function feat(...keys: string[]): RaceFeature[] {
  return keys.flatMap((k) => APPEARANCE_ELEMENTS[k]?.overlays ?? []);
}
