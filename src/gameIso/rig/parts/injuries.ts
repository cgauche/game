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
import { OEIL_PERDU as OEIL_PERDU_ART, OEIL_DE_VERRE as OEIL_DE_VERRE_ART, CACHE_OEIL as CACHE_OEIL_ART } from './eyes';

const g = (slug: string, svg: string) => `<g data-injury="${slug}">${svg}</g>`;

// --- Art (repères locaux : main = poignet origine +y descend ; tête = visage (0,7) r9 ;
// --- cuisse = hanche origine, jambe peinte ~50 de long) -----------------------------------
// Moignon bandé : poignet de chair terminé par un bandage arrondi (pas de poing).
const MOIGNON = g('moignon',
  '<rect x="-1.8" y="-5" width="3.6" height="6" rx="1.6" fill="@peau"/>'
  + '<ellipse cx="0" cy="1.4" rx="2" ry="1.7" fill="#d8cdb4" stroke="#a89878" stroke-width="0.4"/>'
  + '<path d="M-1.9 -0.8 h3.8 M-1.8 0.6 h3.6" stroke="#d8cdb4" stroke-width="1.1"/>');
// Crochet (LDB 73) : manchon de cuir sanglé + crochet d'acier recourbé.
const CROCHET = g('crochet',
  '<rect x="-2" y="-5" width="4" height="6.2" rx="1.2" fill="@cuir" stroke="#2e2014" stroke-width="0.4"/>'
  + '<path d="M-2 -2.6 h4 M-2 -0.6 h4" stroke="#2e2014" stroke-width="0.5" opacity="0.6"/>'
  + '<path d="M0 1 L0 3.6 Q0.2 7.4 -2.4 7.2 Q-4.1 6.8 -3.6 5" stroke="@metal" stroke-width="1.5" fill="none" stroke-linecap="round"/>'
  + '<path d="M-3.6 5 l0.5 -1.2" stroke="@metal" stroke-width="1" stroke-linecap="round"/>');
// Merveille d'ingénierie (main) : paume d'acier rivetée + doigts articulés.
const MAIN_MECA = g('main-mecanique',
  '<rect x="-2.2" y="-5" width="4.4" height="5.6" rx="1" fill="@metal" stroke="#3a4048" stroke-width="0.45"/>'
  + '<circle cx="0" cy="-2.2" r="0.5" fill="#3a4048"/>'
  + '<path d="M-1.9 1 q-0.3 2.6 0.3 4.4 M-0.6 1.2 q-0.1 2.8 0.2 4.8 M0.7 1.2 q0.1 2.8 -0.2 4.8 M1.9 1 q0.3 2.6 -0.3 4.4" stroke="@metal" stroke-width="1" fill="none" stroke-linecap="round"/>'
  + '<path d="M-2 2.6 h4" stroke="#3a4048" stroke-width="0.4" opacity="0.7"/>');
// Jambe de bois (Fausse jambe/Merveille) : cuisse au pantalon, manchette de cuir au genou,
// pilon de bois veiné — REMPLACE la jambe peinte ; le pied est effacé.
const JAMBE_DE_BOIS = g('jambe-de-bois',
  '<path d="M-3.4 0 L3.4 0 L2.8 20 L-2.8 20 Z" fill="@vet1"/>'
  + '<rect x="-3" y="19" width="6" height="3.6" rx="1" fill="@cuir" stroke="#2e2014" stroke-width="0.4"/>'
  + '<path d="M-1.5 22.6 L1.5 22.6 L0.9 50 L-0.9 50 Z" fill="#8a6a3e" stroke="#5a4226" stroke-width="0.5"/>'
  + '<path d="M-0.3 24 Q-0.6 37 -0.2 48" stroke="#5a4226" stroke-width="0.4" fill="none" opacity="0.6"/>'
  + '<ellipse cx="0" cy="50" rx="1.3" ry="0.7" fill="#5a4226"/>');
// Les visuels d'ŒIL (perdu / verre / cache-œil) ne sont PAS des calques : ils remplacent
// l'œil peint EN PLACE via le système d'yeux (parts/eyes.ts, ancres data-eye du visage) —
// cf. `injuryAppearance` ci-dessous.
// Cécité (les deux yeux) : bandage noué sur les yeux.
const BANDEAU_CECITE = g('cecite',
  '<path d="M-8.8 5 Q0 3.4 8.8 5 L8.8 8.6 Q0 10 -8.8 8.6 Z" fill="#d8cdb4" stroke="#a89878" stroke-width="0.45"/>'
  + '<path d="M-8.8 6.8 Q0 5.4 8.8 6.8" stroke="#a89878" stroke-width="0.4" fill="none" opacity="0.7"/>');
// Nez amputé : cavité sombre à la place du nez.
const NEZ_AMPUTE = g('nez-ampute',
  '<path d="M-1 7.4 q1 -0.8 2 0 q-0.3 2 -1 2.3 q-0.7 -0.3 -1 -2.3 Z" fill="#5a3030" stroke="#3a1c1c" stroke-width="0.3"/>');
// Nez doré (LDB 73) : prothèse d'or sanglée.
const NEZ_DORE = g('nez-dore',
  '<path d="M-1.1 6.6 L0.4 6.4 Q1.7 8.4 0.7 9.7 Q-0.6 10.2 -1.3 9.4 Z" fill="#e0b34a" stroke="#8a6a1e" stroke-width="0.4"/>'
  + '<path d="M-0.7 7.2 q0.7 -0.3 1.2 0.2" stroke="#f4dc8a" stroke-width="0.4" fill="none"/>');

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
      const svg = worn(c, 'merveille-d-ingenierie') ? MAIN_MECA : worn(c, 'crochet') ? CROCHET : MOIGNON;
      out.push({ bone: handBone(t), svg, replace: true });
    }
    // Jambe : visible seulement avec une prothèse (jambe de bois) — pilon + pied effacé.
    if (t.label.startsWith('Membre inférieur amputé') && (t.location === 'jambeG' || t.location === 'jambeD')) {
      if (worn(c, 'fausse-jambe') || worn(c, 'merveille-d-ingenierie')) {
        const side = t.location === 'jambeG' ? 'G' : 'D';
        out.push({ bone: `cuisse${side}` as BoneId, svg: JAMBE_DE_BOIS, replace: true });
        out.push({ bone: `pied${side}` as BoneId, svg: '', replace: true });
      }
    }
    if (t.label === 'Nez amputé') out.push({ bone: 'tete', svg: worn(c, 'nez-dore') ? NEZ_DORE : NEZ_AMPUTE, view: 'front' });
  }
  // Cécité (agrégat des deux yeux) : bandage par-dessus le visage (l'œil unique perdu, lui,
  // passe par le remplacement d'œil — injuryAppearance).
  if (traumas.some((t) => t.label === 'Cécité')) {
    out.push({ bone: 'tete', svg: BANDEAU_CECITE, view: 'front' });
  }
  return out;
}

/** Modifications d'APPARENCE dues aux blessures : l'œil perdu remplace l'œil peint en place
 *  (cicatrice / Cache-œil / Œil de verre selon la prothèse portée). Même référence si rien. */
export function injuryAppearance(a: Appearance, c: Combatant): Appearance {
  const traumas = c.traumas ?? [];
  if (!traumas.some((t) => t.label === 'Œil perdu') || traumas.some((t) => t.label === 'Cécité')) return a;
  const art = worn(c, 'cache-oeil') ? CACHE_OEIL_ART : worn(c, 'oeil-de-verre') ? OEIL_DE_VERRE_ART : OEIL_PERDU_ART;
  return { ...a, eyes: { ...a.eyes, G: art } };
}
