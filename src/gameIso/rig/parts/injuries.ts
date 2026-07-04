/**
 * Visuels des AMPUTATIONS et PROTHÈSES (LDB 18 Traumatisme / LDB 73 prothèses) — COSMÉTIQUE,
 * même architecture que les mutations (mutations.ts) : `Combatant.traumas` + prothèse PORTÉE
 * (`items` equipped) → calques/membres remplacés sur le rig.
 *
 *  - Main/bras amputé : moignon bandé ; Crochet porté → crochet ; Merveille → main mécanique.
 *  - Membre inférieur amputé : visible quand une Fausse jambe/Merveille est portée → jambe de
 *    bois (sans prothèse, la jambe peinte reste — un moignon rendrait la marche absurde).
 *  - Œil perdu : cicatrice ; Cache-œil → bandeau ; Œil de verre → œil pâle. Cécité → bandage.
 *  - Nez amputé : trou sombre ; Nez doré → nez d'or.
 *  Doigts/dents/oreilles : trop petits pour l'art du rig — pas de visuel (assumé).
 */
import type { Combatant, Trauma } from '../../../engine/types';
import type { RigOverlay, BoneId } from '../bones';
import type { Appearance } from '../appearance';
import { EYES } from './eyes';
import { PROSTHESIS } from './prosthesis';

// Prothèse PORTÉE par son `trappingId` STABLE (≠ libellé) — réf de catalogue (trappings.json).
const worn = (c: Combatant, trappingId: string): boolean => (c.items ?? []).some((i) => i.trappingId === trappingId && i.equipped);
const handBone = (t: Trauma): BoneId => (t.location === 'brasG' ? 'mainG' : 'mainD');

/** Calques d'amputations/prothèses d'un combattant (traumas + objets portés). */
export function injuryOverlaysFor(c: Combatant): RigOverlay[] {
  const traumas = c.traumas ?? [];
  if (!traumas.length) return [];
  const out: RigOverlay[] = [];
  for (const t of traumas) {
    // Main/bras : la prothèse portée remplace le poing, sinon moignon bandé.
    if (t.ops?.some((o) => o.op === 'maxWeaponHands') && (t.location === 'brasG' || t.location === 'brasD')) {
      const svg = worn(c, 'merveille-d-ingenierie') ? PROSTHESIS['main-mecanique'] : worn(c, 'crochet') ? PROSTHESIS.crochet : PROSTHESIS.moignon;
      out.push({ bone: handBone(t), svg, replace: true });
    }
    // Jambe : visible seulement avec une prothèse (jambe de bois) — pilon + pied effacé.
    if (t.traumaId === 'membre-inferieur-ampute' && (t.location === 'jambeG' || t.location === 'jambeD')) {
      if (worn(c, 'fausse-jambe') || worn(c, 'merveille-d-ingenierie')) {
        const side = t.location === 'jambeG' ? 'G' : 'D';
        out.push({ bone: `cuisse${side}` as BoneId, svg: PROSTHESIS['jambe-de-bois'], replace: true });
        out.push({ bone: `pied${side}` as BoneId, svg: '', replace: true });
      }
    }
    if (t.traumaId === 'nez-ampute') out.push({ bone: 'tete', svg: worn(c, 'nez-dore') ? PROSTHESIS['nez-dore'] : PROSTHESIS['nez-ampute'], view: 'front' });
  }
  // Cécité (agrégat des deux yeux) : bandage par-dessus le visage (l'œil unique perdu, lui,
  // passe par le remplacement d'œil — injuryAppearance).
  if (traumas.some((t) => t.traumaId === 'cecite')) {
    out.push({ bone: 'tete', svg: PROSTHESIS.cecite, view: 'front' });
  }
  return out;
}

/** Modifications d'APPARENCE dues aux blessures : l'œil perdu remplace l'œil peint en place
 *  (cicatrice / Cache-œil / Œil de verre selon la prothèse portée). Même référence si rien. */
export function injuryAppearance(a: Appearance, c: Combatant): Appearance {
  const traumas = c.traumas ?? [];
  if (!traumas.some((t) => t.traumaId === 'oeil-perdu') || traumas.some((t) => t.traumaId === 'cecite')) return a;
  const art = worn(c, 'cache-oeil') ? EYES['cache-oeil'] : worn(c, 'oeil-de-verre') ? EYES.verre : EYES.perdu;
  return { ...a, eyes: { ...a.eyes, G: art } };
}
