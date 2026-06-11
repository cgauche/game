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
import { ARMS, LEGS } from './monster';
import { pickView } from './types';
import { plumeFan, scalesPatch } from './textures';
import { OEIL_ENORME } from './eyes';

/** Clé de registre : label normalisé, apostrophe typographique (U+2019) repliée. */
export const mutKey = (s: string): string => norm(s).replace(/[’']/g, "'");

const g = (slug: string, svg: string) => `<g data-mut="${slug}">${svg}</g>`;

// --- Art ---------------------------------------------------------------------
// Pattes d'animaux : les JAMBES sont REMPLACÉES par les pattes de chèvre du registre
// monster/ (couleur de peau du perso via @peau, sabot inclus) et les bottes effacées —
// le traitement « membre muté » du tentacule, appliqué aux jambes (comme un Gor).
const PATTES = g('pattes-danimaux', pickView(LEGS['chevre'], 'front'));
// Doigts trop longs couleur chair, ANCRÉS dans la paume (ils partent de l'intérieur du
// poing, pas en dessous) — chair étirée, pas des serres.
const DOIGTS = g('doigts-distendus',
  '<path d="M-1.6 1.2 Q-2.6 2.4 -2.6 4 L-2.5 5 M1.6 1.2 Q2.6 2.4 2.6 4 L2.5 5" stroke="@peau" stroke-width="1.6" fill="none" stroke-linecap="round"/>'
  + '<path d="M-2.5 4.4 q-0.7 3.6 -0.4 7.2 M-0.85 2 q-0.2 5 0 9 M0.85 2 q0.2 5 0 9 M2.5 4.4 q0.7 3.6 0.4 7.2" stroke="@peau" stroke-width="1.25" fill="none" stroke-linecap="round"/>'
  + '<path d="M-2.9 10.2 q-0.1 1.2 0.1 2 M-0.85 10.6 q0 1 0.1 1.8 M0.85 10.6 q0 1 -0.1 1.8 M2.9 10.2 q0.1 1.2 -0.1 2" stroke="@peauO" stroke-width="1.05" fill="none" stroke-linecap="round"/>');
// Œil énorme : REMPLACE l'œil peint en place (système d'yeux, parts/eyes.ts) — globe
// disproportionné veiné de sang qui évince l'œil normal, ancré sur la vraie orbite.
// Renflement articulaire + plis anguleux à mi-tibia.
const ARTICULATION = g('articulation-jambes',
  '<ellipse cx="0" cy="10" rx="2.6" ry="2" fill="@peau" stroke="@peauO" stroke-width="0.6"/>'
  + '<path d="M-2.1 8.7 q2.1 1.3 4.2 0 M-2.1 11.3 q2.1 -1.3 4.2 0" stroke="@peauO" stroke-width="0.5" fill="none" opacity="0.7"/>');
// Bouche parasite béante SUR LA PEAU VISIBLE — en travers du front (le RAW tire une
// Localisation au hasard mais ne fait pas surgir la bouche À TRAVERS les vêtements) :
// lèvres charnues, dents sur les deux mâchoires, langue, filet de bave.
const BOUCHE = g('bouche-supplementaire',
  '<g transform="rotate(-9 0 1)">'
  + '<path d="M-3.2 0.8 Q0 -1.4 3.2 1 Q0.2 3.4 -3.2 0.8 Z" fill="#5a1010" stroke="#2e0808" stroke-width="0.5"/>'
  + '<path d="M-0.8 2 Q0.4 2.6 1.6 1.9 Q0.6 2.9 -0.8 2 Z" fill="#b04a4a"/>'
  + '<path d="M-2.4 0.4 l0.7 0.9 l0.6 -1 l0.7 0.9 l0.6 -1 l0.7 0.9 l0.6 -0.9" stroke="#f4ecd8" stroke-width="0.6" fill="none"/>'
  + '<path d="M-1.6 2.1 l0.6 -0.8 l0.6 0.9 l0.6 -0.8 l0.6 0.8" stroke="#e8dcc0" stroke-width="0.55" fill="none"/>'
  + '<path d="M2.8 1.6 q0.4 1.6 -0.1 3" stroke="#c8d0b0" stroke-width="0.45" fill="none" opacity="0.8"/>'
  + '</g>');
// Tentacule épais : REMPLACE le bras gauche (part monstrueuse du registre monster/, couleur
// de peau du personnage via @peau) et efface le poing — un membre muté, pas un appendice posé.
const TENTACULE = g('tentacule-epais', pickView(ARMS['tentacule'], 'front'));
// Éclats spéculaires (lumière de bougie) sur la PEAU VISIBLE : front/pommette + dos de
// main — accompagne la peau recolorée corps entier (pas d'éclat sur les vêtements).
const LUSTRE_VISAGE = g('peau-brillante',
  '<path d="M-4.6 1.6 q1.8 -1.6 4 -1.2 M3.2 4.6 q1.2 1 1 2.6" stroke="#ffffff" stroke-width="0.9" fill="none" opacity="0.6" stroke-linecap="round"/>');
const LUSTRE_MAIN = g('peau-brillante',
  '<path d="M-1.6 1.2 q1.4 -0.9 3 -0.4" stroke="#ffffff" stroke-width="0.7" fill="none" opacity="0.6" stroke-linecap="round"/>');
// Halo doré diffus derrière la tête.
const HALO = g('beaute-surnaturelle',
  '<circle cx="0" cy="5" r="13" fill="#e8c860" opacity="0.3"/>'
  + '<circle cx="0" cy="5" r="13" fill="none" stroke="#e8c860" stroke-width="0.8" opacity="0.55"/>');
// Visage inversé : le VRAI visage du personnage est retourné tête en bas (flip du slot
// `visage` dans resolveRig via `Appearance.faceFlip`) — pas d'art dédié.
// Peau d'acier : recolorisation CORPS ENTIER via la palette (`skin`), pas de calque —
// le visage, les mains et tout membre nu virent au gris métal (ombres dérivées).
// Langue rose pendant de la bouche jusque sous le menton.
const LANGUE = g('langue-pendante',
  '<path d="M-1.2 11 Q-1.6 16 0 19.5 Q1.8 16.5 1.4 11 Z" fill="#c46a76" stroke="#8a3a46" stroke-width="0.5"/>'
  + '<path d="M0.1 12 Q0 15.5 0.2 18" stroke="#8a3a46" stroke-width="0.5" fill="none" opacity="0.7"/>');
// Plumage épars (textures.ts) : épaulettes en éventail sur les DEUX épaules, crête
// derrière le crâne (perce les cheveux) et plumes le long de l'avant-bras — des panaches
// assumés qui JAILLISSENT du corps, pas une plume collée sur la chemise.
const PLUMES_EPAULE_G = g('plumes-eparses', plumeFan(0, 0.5, { n: 3, k: 0.9, baseRot: -14 }));
const PLUMES_EPAULE_D = g('plumes-eparses', plumeFan(0, 0.5, { n: 3, k: 0.8, baseRot: 14 }));
const PLUMES_CRETE = g('plumes-eparses', plumeFan(0, -4, { n: 4, spread: 84, k: 1.05 }));
const PLUMES_BRAS = g('plumes-eparses', plumeFan(-1.4, 7, { n: 2, spread: 26, k: 0.62, baseRot: -76 }) + plumeFan(-1.2, 12, { n: 1, k: 0.5, baseRot: -82, colors: ['#8a6a48'] }));
// Épines triangulaires hérissant flancs et épaules — accompagne la peau écailleuse
// recolorée corps entier (olive reptilien via `skin`).
const ECAILLES = g('ecailles-epineuses',
  '<path d="M-9 -14 l-3 -1.4 l2.2 2.8 Z M-9.5 -8 l-3.2 -0.8 l2.4 2.6 Z M-9.4 -2 l-3 -0.4 l2.2 2.4 Z'
  + ' M9 -14 l3 -1.4 l-2.2 2.8 Z M9.5 -8 l3.2 -0.8 l-2.4 2.6 Z M9.4 -2 l3 -0.4 l-2.2 2.4 Z" fill="@peauO" stroke="#2a2018" stroke-width="0.4"/>');
// TEXTURE d'écailles (textures.ts) sur la peau visible : tempes/mâchoire (face) et dos des
// mains — les arcs imbriqués @peauO/@peauH suivent la couleur de peau mutée.
const ECAILLES_VISAGE = g('ecailles-epineuses', scalesPatch(-7.6, -3.4, 2, 8.4, 2.1) + scalesPatch(3.4, 7.6, 2, 8.4, 2.1));
const ECAILLES_MAIN = g('ecailles-epineuses', scalesPatch(-2.6, 2.6, 0.4, 5.4, 1.8));
// Grande corne charnue à droite (reprise du POC) + moignon tordu à gauche : l'asymétrie
// EST la mutation — et reste le « tell » de silhouette du mutant. Le moignon monte à −16
// pour dépasser des cheveux (le calque est DERRIÈRE la part de tête).
const CORNES = g('cornes-asymetriques',
  '<path d="M4 -2 Q11 -12 7 -26 Q2 -14 -1 -4 Z" fill="#c8a880" stroke="#4a3826" stroke-width="0.8"/>'
  + '<path d="M3 -5 Q9 -14 6 -22" fill="none" stroke="#7a5a3a" stroke-width="0.5" opacity="0.6"/>'
  + '<path d="M-5 -2 Q-9 -8 -6.6 -16 Q-9.6 -12 -8.6 -6 Q-7.6 -1.6 -3 -0.6 Z" fill="#c8a880" stroke="#4a3826" stroke-width="0.7"/>');
// Suintement de pus MULTI-SITES sur la PEAU VISIBLE (la note RAW tire une Localisation
// au hasard, elle ne perce pas les vêtements) : tempe + menton + dos de main, chacun
// avec ses coulures jaune-vert.
const PUS_TETE = g('suintement-de-pus',
  '<ellipse cx="5" cy="2.6" rx="1.6" ry="2" fill="#7a1010"/><ellipse cx="5" cy="2.6" rx="0.8" ry="1.2" fill="#b03a2e"/>'
  + '<path d="M5.4 4.2 q0.3 2.2 -0.2 4" stroke="#b8b34a" stroke-width="0.7" fill="none" stroke-linecap="round" opacity="0.9"/>'
  + '<circle cx="-3.4" cy="12.6" r="1.1" fill="#7a1010"/><circle cx="-3.4" cy="12.6" r="0.55" fill="#b03a2e"/>'
  + '<path d="M-3.2 13.6 q0.2 1.8 -0.2 3.2" stroke="#b8b34a" stroke-width="0.6" fill="none" stroke-linecap="round" opacity="0.9"/>');
const PUS_MAIN = g('suintement-de-pus',
  '<ellipse cx="0.4" cy="2.2" rx="1.4" ry="1.7" fill="#7a1010"/><ellipse cx="0.4" cy="2.2" rx="0.7" ry="1" fill="#b03a2e"/>'
  + '<path d="M0 3.6 q-0.2 2 0.3 3.6 M1.2 3.4 q0.3 1.6 0 3" stroke="#b8b34a" stroke-width="0.65" fill="none" stroke-linecap="round" opacity="0.9"/>');
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
  /** recolorisation de la peau CORPS ENTIER via la palette (`@peau` + ombres dérivées,
   *  visage/mains/membres compris) — Peau d'acier, Écailles, Peau brillante. */
  skin?: string;
  /** le vrai visage du personnage retourné tête en bas (Visage inversé). */
  faceFlip?: boolean;
  /** remplacement de l'œil GAUCHE en place (art centré, cf. parts/eyes.ts — Œil énorme). */
  eyeG?: string;
}

/** Clé = `mutKey(label)` des entrées de `src/data/mutations.ts` (table physique). */
export const MUTATION_VISUALS: Record<string, MutationVisual | null> = {
  [mutKey('Pattes d’animaux')]: {
    overlays: [
      { bone: 'cuisseG', svg: PATTES, replace: true },
      { bone: 'cuisseD', svg: PATTES, replace: true },
      { bone: 'piedG', svg: '', replace: true }, // le sabot est dans la patte — bottes effacées
      { bone: 'piedD', svg: '', replace: true },
    ],
  },
  [mutKey('Corpulent')]: { build: 0.2 },
  [mutKey('Doigts distendus')]: { overlays: [{ bone: 'mainG', svg: DOIGTS }, { bone: 'mainD', svg: DOIGTS }] },
  [mutKey('Émacié')]: { build: -0.2 },
  [mutKey('Œil énorme')]: { eyeG: OEIL_ENORME },
  [mutKey('Articulation supplémentaire aux jambes')]: { overlays: [{ bone: 'tibiaG', svg: ARTICULATION }, { bone: 'tibiaD', svg: ARTICULATION }] },
  [mutKey('Bouche supplémentaire')]: { overlays: [{ bone: 'tete', svg: BOUCHE, view: 'front' }] },
  [mutKey('Tentacule épais')]: { overlays: [{ bone: 'epauleG', svg: TENTACULE, replace: true }, { bone: 'mainG', svg: '', replace: true }] },
  [mutKey('Peau brillante')]: {
    skin: '#f0d8a8',
    overlays: [
      { bone: 'tete', svg: LUSTRE_VISAGE, view: 'front' },
      { bone: 'mainG', svg: LUSTRE_MAIN },
      { bone: 'mainD', svg: LUSTRE_MAIN },
    ],
  },
  [mutKey('Beauté surnaturelle')]: { overlays: [{ bone: 'tete', svg: HALO, behind: true }] },
  [mutKey('Visage inversé')]: { faceFlip: true },
  [mutKey('Peau d’acier')]: { skin: '#8a93a0' },
  [mutKey('Langue pendante')]: { overlays: [{ bone: 'tete', svg: LANGUE, view: 'front' }] },
  [mutKey('Plumes éparses')]: {
    overlays: [
      { bone: 'epauleG', svg: PLUMES_EPAULE_G },
      { bone: 'epauleD', svg: PLUMES_EPAULE_D },
      { bone: 'tete', svg: PLUMES_CRETE, behind: true },
      { bone: 'avantBrasG', svg: PLUMES_BRAS },
    ],
  },
  [mutKey('Court sur pattes')]: { legs: 0.78 },
  [mutKey('Écailles épineuses')]: {
    skin: '#8a8a58',
    overlays: [
      { bone: 'torse', svg: ECAILLES },
      { bone: 'tete', svg: ECAILLES_VISAGE, view: 'front' },
      { bone: 'mainG', svg: ECAILLES_MAIN },
      { bone: 'mainD', svg: ECAILLES_MAIN },
    ],
  },
  [mutKey('Cornes asymétriques')]: { overlays: [{ bone: 'tete', svg: CORNES, behind: true }] },
  [mutKey('Suintement de pus')]: {
    overlays: [
      { bone: 'tete', svg: PUS_TETE, view: 'front' },
      { bone: 'mainD', svg: PUS_MAIN },
    ],
  },
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

/** Applique les mutations MORPHO (Corpulent/Émacié/Court sur pattes) et de PEAU corps entier
 *  (Peau d'acier/Écailles/Brillante) à l'apparence. Même référence si rien (stabilité des props). */
export function mutationAppearance(a: Appearance, mutations?: Mutation[]): Appearance {
  if (!mutations?.length) return a;
  let dBuild = 0;
  let legs = 1;
  let skin: string | undefined;
  let faceFlip = false;
  let eyeG: string | undefined;
  for (const m of mutations) {
    if (m.kind !== 'physique') continue;
    const v = MUTATION_VISUALS[mutKey(m.label)];
    if (v?.build) dBuild += v.build;
    if (v?.legs) legs *= v.legs;
    if (v?.skin) skin = v.skin; // la mutation transforme la peau (prime sur la couleur choisie)
    if (v?.faceFlip) faceFlip = true;
    if (v?.eyeG) eyeG = v.eyeG;
  }
  if (!dBuild && legs === 1 && !skin && !faceFlip && !eyeG) return a;
  return {
    ...a,
    build: Math.min(1, Math.max(0, a.build + dBuild)),
    legs: (a.legs ?? 1) * legs,
    ...(skin ? { colors: { ...a.colors, peau: skin } } : {}),
    ...(faceFlip ? { faceFlip } : {}),
    ...(eyeG ? { eyes: { ...a.eyes, G: eyeG } } : {}),
  };
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
