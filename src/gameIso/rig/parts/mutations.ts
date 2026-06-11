/**
 * Visuels des mutations physiques (Tableau de Corruption LDB 19) — COSMÉTIQUE.
 * Une entrée par mutation de `src/data/mutations.ts` (clé = label normalisé) :
 * calques (RigOverlay sur l'os porteur) et/ou morpho (delta de carrure, jambes).
 * Les mutations MENTALES n'ont aucun visuel. « Choix du MJ » = null (rien d'inventé).
 *
 * Repères locaux (cf. monstrous.ts) : tête visage ≈ (0,7) r9, cornes y −1..−26 ;
 * torse x −9..9, y −22..16 ; main origine poignet (+y descend, poing cy 2.6) ;
 * pied x −3.4..3.4, y −1..8 ; épaule : le membre descend en +y (~26-30).
 * Chaque visuel est enveloppé `<g data-mut="…">` (tests + débogage devtools).
 */
import type { Mutation } from '../../../engine/corruption';
import type { RigOverlay } from '../bones';
import type { Appearance } from '../appearance';
import { norm } from '../../../lib/normalize';
import { OV_PLAIE } from './monstrous';

/** Clé de registre : label normalisé, apostrophe typographique (U+2019) repliée. */
export const mutKey = (s: string): string => norm(s).replace(/[’']/g, "'");

const g = (slug: string, svg: string) => `<g data-mut="${slug}">${svg}</g>`;

// --- Art ---------------------------------------------------------------------
// Sabots fendus brun sombre couvrant la botte, fente médiane + ergot.
const SABOT = g('pattes-danimaux',
  '<path d="M-3.6 1.2 Q0 -0.6 3.6 1.2 L3.1 8 L0.6 8 L0.4 3.4 L-0.4 3.4 L-0.6 8 L-3.1 8 Z" fill="#4a3424" stroke="#241a10" stroke-width="0.6"/>'
  + '<path d="M-3.9 2.8 q-1.3 0.7 -1.5 2.2" stroke="#241a10" stroke-width="1" fill="none" stroke-linecap="round"/>');
// Doigts trop longs couleur chair, bouts assombris — chair étirée, pas des serres.
const DOIGTS = g('doigts-distendus',
  '<path d="M-2.6 3 q-0.7 4.4 -0.4 8.6 M-0.9 3.8 q-0.2 4.6 0 8.6 M0.9 3.8 q0.2 4.6 0 8.6 M2.6 3 q0.7 4.4 0.4 8.6" stroke="@peau" stroke-width="1.25" fill="none" stroke-linecap="round"/>'
  + '<path d="M-3 10.4 q-0.1 1.2 0.1 2 M-0.9 11.4 q0 1 0.1 1.8 M0.9 11.4 q0 1 -0.1 1.8 M3 10.4 q0.1 1.2 -0.1 2" stroke="@peauO" stroke-width="1.05" fill="none" stroke-linecap="round"/>');
// Œil unique disproportionné côté gauche du visage (sclère ivoire, iris injecté).
const OEIL = g('oeil-enorme',
  '<ellipse cx="-3" cy="6" rx="4.2" ry="3.4" fill="#e0d8b0" stroke="#3a2820" stroke-width="0.7"/>'
  + '<ellipse cx="-3" cy="6" rx="2.4" ry="2.2" fill="#7a1010"/><circle cx="-3" cy="6" r="1.1" fill="#0a0808"/>'
  + '<circle cx="-2.2" cy="5.2" r="0.5" fill="#ffffff" opacity="0.6"/>');
// Renflement articulaire + plis anguleux à mi-tibia.
const ARTICULATION = g('articulation-jambes',
  '<ellipse cx="0" cy="10" rx="2.6" ry="2" fill="@peau" stroke="@peauO" stroke-width="0.6"/>'
  + '<path d="M-2.1 8.7 q2.1 1.3 4.2 0 M-2.1 11.3 q2.1 -1.3 4.2 0" stroke="@peauO" stroke-width="0.5" fill="none" opacity="0.7"/>');
// Bouche de travers sur le pectoral, dents triangulaires ivoire.
const BOUCHE = g('bouche-supplementaire',
  '<path d="M0.5 -8.5 Q3 -10.2 5.5 -8 Q3.2 -6.2 0.5 -8.5 Z" fill="#6a1414" stroke="#3a0c0c" stroke-width="0.5"/>'
  + '<path d="M1.4 -8.4 l0.8 1 l0.7 -1.2 l0.8 1 l0.7 -1.2 l0.7 0.9" stroke="#f4ecd8" stroke-width="0.7" fill="none"/>');
// Tentacule sinueux verdâtre depuis l'épaule (repris du POC ennemi).
const TENTACULE = g('tentacule-epais',
  '<path d="M3 -4 Q16 2 14 18 Q12 28 6 24 Q10 18 8 10 Q6 2 0 -2 Z" fill="#8a9a6a" stroke="#4a5836" stroke-width="0.8"/>'
  + '<path d="M8 8 Q15 14 12 22" fill="none" stroke="#5a6a3a" stroke-width="0.6" opacity="0.7"/>');
// Lustre : voile clair + éclats spéculaires (lumière de bougie).
const LUSTRE = g('peau-brillante',
  '<ellipse cx="-2" cy="-8" rx="5" ry="9" fill="#ffffff" opacity="0.22"/>'
  + '<path d="M-4 -14 q2 -2 4 -1 M3 -4 q1.6 1.4 1.2 3.4" stroke="#ffffff" stroke-width="1.1" fill="none" opacity="0.5" stroke-linecap="round"/>');
// Halo doré diffus derrière la tête.
const HALO = g('beaute-surnaturelle',
  '<circle cx="0" cy="5" r="13" fill="#e8c860" opacity="0.3"/>'
  + '<circle cx="0" cy="5" r="13" fill="none" stroke="#e8c860" stroke-width="0.8" opacity="0.55"/>');
// Ovale de chair couvrant le visage, traits retournés : bouche en haut, yeux en bas.
const VISAGE_INVERSE = g('visage-inverse',
  '<ellipse cx="0" cy="7" rx="6.5" ry="7.5" fill="@peau" stroke="@peauO" stroke-width="0.5"/>'
  + '<path d="M-2.4 2.4 Q0 0.8 2.4 2.4" stroke="#5a2020" stroke-width="1" fill="none"/>'
  + '<path d="M0 6 q-1 1.4 0 2.4" stroke="@peauO" stroke-width="0.7" fill="none"/>'
  + '<circle cx="-2.6" cy="11" r="1" fill="#241a12"/><circle cx="2.6" cy="11" r="1" fill="#241a12"/>');
// Plaques gris acier rivetées épousant le torse.
const ACIER = g('peau-dacier',
  '<path d="M-7 -16 Q0 -19 7 -16 L7.5 -6 Q0 -3.5 -7.5 -6 Z" fill="#8a93a0" stroke="#4a5058" stroke-width="0.6" opacity="0.85"/>'
  + '<path d="M-7.5 -4 Q0 -1.5 7.5 -4 L7 6 Q0 9 -7 6 Z" fill="#7e8794" stroke="#4a5058" stroke-width="0.6" opacity="0.85"/>'
  + '<circle cx="-5" cy="-12" r="0.5" fill="#3a4048"/><circle cx="5" cy="-12" r="0.5" fill="#3a4048"/>'
  + '<circle cx="-4.6" cy="0" r="0.5" fill="#3a4048"/><circle cx="4.6" cy="0" r="0.5" fill="#3a4048"/>'
  + '<path d="M-4 -15 q1.6 -1 3.4 -0.6" stroke="#c8d0da" stroke-width="0.8" fill="none" opacity="0.7"/>');
// Langue rose pendant de la bouche jusque sous le menton.
const LANGUE = g('langue-pendante',
  '<path d="M-1.2 11 Q-1.6 16 0 19.5 Q1.8 16.5 1.4 11 Z" fill="#c46a76" stroke="#8a3a46" stroke-width="0.5"/>'
  + '<path d="M0.1 12 Q0 15.5 0.2 18" stroke="#8a3a46" stroke-width="0.5" fill="none" opacity="0.7"/>');
// Plumes plantées de travers : rachis + barbes, brun et blanc cassé.
const PLUMES_EPAULE = g('plumes-eparses',
  '<path d="M1 2 q4 -5 8 -6 q-2 4 -6 7 Z" fill="#e8e0d0" stroke="#6a5a48" stroke-width="0.5"/>'
  + '<path d="M2.5 1.5 q3 -3.5 6 -4.6" stroke="#6a5a48" stroke-width="0.4" fill="none"/>'
  + '<path d="M0 7 q5 -3 9 -2.6 q-3 3.4 -8 4.6 Z" fill="#8a7a64" stroke="#5a4a3a" stroke-width="0.5"/>');
const PLUMES_TORSE = g('plumes-eparses',
  '<path d="M-8 -2 q-5 -2 -7 -6 q4.6 0 8 3 Z" fill="#e8e0d0" stroke="#6a5a48" stroke-width="0.5"/>'
  + '<path d="M6 4 q5 -1 8 -4 q-2 4.4 -6 6.4 Z" fill="#8a7a64" stroke="#5a4a3a" stroke-width="0.5"/>'
  + '<path d="M-5 10 q-4.4 1 -7.4 -1 q3 -3 7 -2 Z" fill="#e8e0d0" stroke="#6a5a48" stroke-width="0.5"/>');
// Écailles triangulaires pointues hérissant flancs et épaules.
const ECAILLES = g('ecailles-epineuses',
  '<path d="M-9 -14 l-3 -1.4 l2.2 2.8 Z M-9.5 -8 l-3.2 -0.8 l2.4 2.6 Z M-9.4 -2 l-3 -0.4 l2.2 2.4 Z'
  + ' M9 -14 l3 -1.4 l-2.2 2.8 Z M9.5 -8 l3.2 -0.8 l-2.4 2.6 Z M9.4 -2 l3 -0.4 l-2.2 2.4 Z" fill="@peauO" stroke="#2a2018" stroke-width="0.4"/>');
// Grande corne charnue à droite (reprise du POC) + moignon tordu à gauche : l'asymétrie
// EST la mutation — et reste le « tell » de silhouette du mutant. Le moignon monte à −16
// pour dépasser des cheveux (le calque est DERRIÈRE la part de tête).
const CORNES = g('cornes-asymetriques',
  '<path d="M4 -2 Q11 -12 7 -26 Q2 -14 -1 -4 Z" fill="#c8a880" stroke="#4a3826" stroke-width="0.8"/>'
  + '<path d="M3 -5 Q9 -14 6 -22" fill="none" stroke="#7a5a3a" stroke-width="0.5" opacity="0.6"/>'
  + '<path d="M-5 -2 Q-9 -8 -6.6 -16 Q-9.6 -12 -8.6 -6 Q-7.6 -1.6 -3 -0.6 Z" fill="#c8a880" stroke="#4a3826" stroke-width="0.7"/>');
// Plaie exposée (réutilise l'art zombie) + coulures de pus jaune-vert.
const PUS = g('suintement-de-pus',
  OV_PLAIE
  + '<path d="M-3 -7 q-0.4 3 0.2 5.6 M-1 -6.6 q0 2.6 0.6 4.6" stroke="#b8b34a" stroke-width="1" fill="none" stroke-linecap="round" opacity="0.9"/>'
  + '<circle cx="-2.8" cy="-0.8" r="0.7" fill="#b8b34a"/>');
// Groin porcin rose, naseaux sombres, poils raides autour.
const GROIN = g('groin-poilu',
  '<ellipse cx="0" cy="8.5" rx="4" ry="3" fill="#d39a8e" stroke="#9a6a60" stroke-width="0.6"/>'
  + '<ellipse cx="-1.3" cy="8.5" rx="0.8" ry="1.1" fill="#5a3a34"/><ellipse cx="1.3" cy="8.5" rx="0.8" ry="1.1" fill="#5a3a34"/>'
  + '<path d="M-4.6 6.4 q-1.4 -1 -2 -2.4 M-5 9 q-1.6 0 -2.8 -0.6 M4.6 6.4 q1.4 -1 2 -2.4 M5 9 q1.6 0 2.8 -0.6 M-2.6 4.6 q-0.6 -1.2 -0.4 -2.2 M2.6 4.6 q0.6 -1.2 0.4 -2.2" stroke="#241a12" stroke-width="0.6" fill="none" stroke-linecap="round"/>');

// --- Registre ------------------------------------------------------------------
/** Effet visuel d'une mutation : calques et/ou morpho. `null` = volontairement sans visuel. */
export interface MutationVisual {
  overlays?: RigOverlay[];
  /** delta de carrure (Appearance.build, clampé 0..1). */
  build?: number;
  /** multiplicateur de longueur de jambes (Appearance.legs). */
  legs?: number;
}

/** Clé = `mutKey(label)` des entrées de `src/data/mutations.ts` (table physique). */
export const MUTATION_VISUALS: Record<string, MutationVisual | null> = {
  [mutKey('Pattes d’animaux')]: { overlays: [{ bone: 'piedG', svg: SABOT }, { bone: 'piedD', svg: SABOT }] },
  [mutKey('Corpulent')]: { build: 0.2 },
  [mutKey('Doigts distendus')]: { overlays: [{ bone: 'mainG', svg: DOIGTS }, { bone: 'mainD', svg: DOIGTS }] },
  [mutKey('Émacié')]: { build: -0.2 },
  [mutKey('Œil énorme')]: { overlays: [{ bone: 'tete', svg: OEIL, view: 'front' }] },
  [mutKey('Articulation supplémentaire aux jambes')]: { overlays: [{ bone: 'tibiaG', svg: ARTICULATION }, { bone: 'tibiaD', svg: ARTICULATION }] },
  [mutKey('Bouche supplémentaire')]: { overlays: [{ bone: 'torse', svg: BOUCHE, view: 'front' }] },
  [mutKey('Tentacule épais')]: { overlays: [{ bone: 'epauleD', svg: TENTACULE }] },
  [mutKey('Peau brillante')]: { overlays: [{ bone: 'torse', svg: LUSTRE }] },
  [mutKey('Beauté surnaturelle')]: { overlays: [{ bone: 'tete', svg: HALO, behind: true }] },
  [mutKey('Visage inversé')]: { overlays: [{ bone: 'tete', svg: VISAGE_INVERSE, view: 'front' }] },
  [mutKey('Peau d’acier')]: { overlays: [{ bone: 'torse', svg: ACIER }] },
  [mutKey('Langue pendante')]: { overlays: [{ bone: 'tete', svg: LANGUE, view: 'front' }] },
  [mutKey('Plumes éparses')]: { overlays: [{ bone: 'epauleG', svg: PLUMES_EPAULE }, { bone: 'torse', svg: PLUMES_TORSE }] },
  [mutKey('Court sur pattes')]: { legs: 0.78 },
  [mutKey('Écailles épineuses')]: { overlays: [{ bone: 'torse', svg: ECAILLES }] },
  [mutKey('Cornes asymétriques')]: { overlays: [{ bone: 'tete', svg: CORNES, behind: true }] },
  [mutKey('Suintement de pus')]: { overlays: [{ bone: 'torse', svg: PUS }] },
  [mutKey('Groin poilu')]: { overlays: [{ bone: 'tete', svg: GROIN, view: 'front' }] },
  [mutKey('Choix du MJ')]: null,
};

/** Calques des mutations PHYSIQUES d'un combattant (mentales/labels inconnus → rien). */
export function mutationOverlaysFor(mutations?: Mutation[]): RigOverlay[] {
  if (!mutations?.length) return [];
  const out: RigOverlay[] = [];
  for (const m of mutations) {
    if (m.kind !== 'physique') continue;
    const v = MUTATION_VISUALS[mutKey(m.label)];
    if (v?.overlays) out.push(...v.overlays);
  }
  return out;
}

/** Applique les mutations MORPHO (Corpulent/Émacié/Court sur pattes) à l'apparence.
 *  Même référence si aucune morpho (stabilité des props). */
export function mutationAppearance(a: Appearance, mutations?: Mutation[]): Appearance {
  if (!mutations?.length) return a;
  let dBuild = 0;
  let legs = 1;
  for (const m of mutations) {
    if (m.kind !== 'physique') continue;
    const v = MUTATION_VISUALS[mutKey(m.label)];
    if (v?.build) dBuild += v.build;
    if (v?.legs) legs *= v.legs;
  }
  if (!dBuild && legs === 1) return a;
  return { ...a, build: Math.min(1, Math.max(0, a.build + dBuild)), legs: (a.legs ?? 1) * legs };
}

// Pool des visuels à calques pour le tirage ennemi — hors cornes (déjà garanties) et hors
// halo de Beauté surnaturelle (lit « saint », pas « mutant » : réservé aux mutations réelles).
const POOL: RigOverlay[][] = Object.entries(MUTATION_VISUALS)
  .filter(([k, v]) => v?.overlays && k !== mutKey('Cornes asymétriques') && k !== mutKey('Beauté surnaturelle'))
  .map(([, v]) => v!.overlays!);

/** Visuel d'un ennemi « mutant » sans donnée de mutations : cornes toujours (tell de
 *  silhouette) + 1-2 visuels du pool, déterministe au seed. */
export function randomMutationOverlays(seed: number): RigOverlay[] {
  const out: RigOverlay[] = [...MUTATION_VISUALS[mutKey('Cornes asymétriques')]!.overlays!];
  const extraCount = 1 + (seed % 2);
  const picked = new Set<number>();
  for (let i = 0; i < extraCount; i++) {
    const idx = (seed + i * 5) % POOL.length;
    if (picked.has(idx)) continue;
    picked.add(idx);
    out.push(...POOL[idx]);
  }
  return out;
}
