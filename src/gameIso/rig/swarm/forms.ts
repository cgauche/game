/**
 * FORMES de NUÉE — la silhouette d'UN constituant de l'amas (un rat, une araignée, un nurgling…)
 * + sa palette par défaut, indexées par id de FORME. C'est la DONNÉE qui rend les 8 nuées du jeu
 * distinctes : `composeSwarm` lit `SWARM_FORMS[appearance.species]` et tapisse l'amas de CE critter.
 * Pattern calqué sur `FISH_SPECIES`/`BIRD_SPECIES` (Record keyé par id stable, ZÉRO if-par-nom).
 *
 * `appearance.colors` du record peut SURCHARGER la palette (cf. `buildTokenMap(form.stored, colors)`).
 * Repli `swarmFormOf(species)` : un record dont l'espèce n'est pas une clé de FORME mais une vraie
 * espèce de créature (`appearance.species = 'rat-geant'`…) est routé par le `plan` de sa def.
 */
import type { View } from '../facing';
import type { StoredPalette } from '../palette';
import { defById } from '../creatures';

export interface SwarmForm {
  /** Dessine UN constituant centré en (cx,cy), à l'échelle s, miroité si flip ; +x = avant/tête. */
  critter(cx: number, cy: number, s: number, flip: boolean, view: View): string;
  /** Palette par défaut de la forme (corps/ombre/reflet) — surchargeable par `appearance.colors`. */
  stored: StoredPalette;
  /** Forme VOLANTE (oiseaux) : tapissée en flock dispersé en hauteur, sans amas au sol. */
  aerial?: boolean;
}

const fnum = (flip: boolean) => (flip ? -1 : 1);
/** Enveloppe commune : translate+scale (miroir horizontal si flip) autour du dessin local. */
function wrap(cx: number, cy: number, s: number, flip: boolean, inner: string): string {
  return `<g transform="translate(${cx},${cy}) scale(${(s * fnum(flip)).toFixed(3)},${s.toFixed(3)})">${inner}</g>`;
}
/** Œil sombre + reflet ambré, au museau (avant +x) — réutilisé par plusieurs formes. */
const eye = (x = 4.2, y = -1.1): string =>
  `<circle cx="${x}" cy="${y}" r="1" fill="#160c06"/><circle cx="${x + 0.3}" cy="${y - 0.3}" r="0.35" fill="#e8c84a"/>`;

// --- générique (DEFAULT) : l'amas brun ovoïde d'origine (repli pour toute nuée non typée) ----------
const generiqueDraw =
  '<path d="M-2.6 4 l-1.6 3.4 M0 4.4 l0 3.4 M2.6 4 l1.6 3.4" stroke="@corpsO" stroke-width="0.7"/>' +
  '<ellipse cx="0" cy="0" rx="5.6" ry="3.7" fill="@corps" stroke="@corpsO" stroke-width="0.5"/>' +
  '<ellipse cx="0" cy="1.3" rx="4" ry="1.7" fill="@corpsO" opacity="0.45"/>' +
  '<path d="M-5.4 -0.6 q-3.2 -0.8 -5 -2.8" stroke="@corpsO" stroke-width="0.8" fill="none"/>' +
  eye();
export const DEFAULT_FORM: SwarmForm = {
  critter: (cx, cy, s, flip) => wrap(cx, cy, s, flip, generiqueDraw),
  stored: { corps: '#6a5a44', corpsO: '#3e3424', corpsH: '#8a7a5e' },
};

// --- RATS : corps allongé, longue queue grêle, museau pointu, oreille ronde -------------------------
const ratsDraw =
  '<path d="M-2.6 3.2 l-1 3 M0.2 3.4 l0 3 M2.8 3 l1 3" stroke="@corpsO" stroke-width="0.6"/>' + // pattes
  '<path d="M-5.2 0.2 q-6 0.6 -10.2 3.6" stroke="@corpsO" stroke-width="0.8" fill="none"/>' + // longue queue
  '<ellipse cx="0" cy="0" rx="6" ry="3" fill="@corps" stroke="@corpsO" stroke-width="0.5"/>' +
  '<ellipse cx="0.5" cy="1" rx="4.2" ry="1.4" fill="@corpsO" opacity="0.4"/>' +
  '<path d="M5 -1 L9.6 0.2 L5 1.4 Z" fill="@corps" stroke="@corpsO" stroke-width="0.4"/>' + // museau
  '<circle cx="3.2" cy="-2.9" r="1.5" fill="@corps" stroke="@corpsO" stroke-width="0.4"/>' + // oreille
  '<circle cx="3.2" cy="-2.9" r="0.7" fill="@corpsO" opacity="0.5"/>' +
  '<circle cx="5.6" cy="-0.5" r="0.7" fill="#160c06"/>' + // œil
  '<circle cx="9.3" cy="0.2" r="0.5" fill="#1a0d08"/>'; // truffe
const RATS: SwarmForm = {
  critter: (cx, cy, s, flip) => wrap(cx, cy, s, flip, ratsDraw),
  stored: { corps: '#74675a', corpsO: '#403830', corpsH: '#9a8c7c' },
};

// --- MARCASSINS : trapu, groin, petites défenses, raies juvéniles ----------------------------------
const marcassinsDraw =
  '<path d="M-3 3.4 l-0.6 2.8 M-1 3.6 l0 2.8 M2 3.6 l0.4 2.8 M3.6 3.2 l0.8 2.8" stroke="@corpsO" stroke-width="0.9"/>' + // pattes
  '<path d="M-5.6 -1.2 q-2 0.4 -2.6 2.4" stroke="@corpsO" stroke-width="0.8" fill="none"/>' + // queue
  '<ellipse cx="0" cy="0" rx="6" ry="4" fill="@corps" stroke="@corpsO" stroke-width="0.5"/>' +
  '<path d="M-3.2 -2.8 q0.2 3.4 0.6 5.8 M-0.2 -3.2 q0.2 3.6 0.4 6.2 M2.8 -2.8 q-0.2 3.2 -0.6 5.6" stroke="@corpsH" stroke-width="0.7" fill="none" opacity="0.75"/>' + // raies juvéniles
  '<ellipse cx="6.2" cy="0.6" rx="2.4" ry="1.8" fill="@corps" stroke="@corpsO" stroke-width="0.4"/>' + // groin
  '<circle cx="7.7" cy="0.2" r="0.4" fill="#160c06"/><circle cx="7.7" cy="1.1" r="0.4" fill="#160c06"/>' + // naseaux
  '<path d="M6.4 1.8 l1.4 1.4" stroke="#efe6cf" stroke-width="0.8" stroke-linecap="round"/>' + // défense
  '<path d="M1.8 -3.6 l-1.2 -2.2 l2.6 0.8 Z" fill="@corps" stroke="@corpsO" stroke-width="0.3"/>' + // oreille
  '<circle cx="4.4" cy="-1.2" r="0.7" fill="#160c06"/>'; // œil
const MARCASSINS: SwarmForm = {
  critter: (cx, cy, s, flip) => wrap(cx, cy, s, flip, marcassinsDraw),
  stored: { corps: '#7a5a36', corpsO: '#4a3620', corpsH: '#caa674' },
};

// --- ARAIGNÉES : vue de dessus, corps rond, 8 pattes, 2 yeux ---------------------------------------
const araigneesDraw =
  // 8 pattes (4 par côté) rayonnant, recourbées
  '<path d="M0 -2 Q3 -5.4 6.2 -6.4 M1 -1.4 Q5.2 -3 8.4 -3 M1 1.4 Q5.2 3 8.4 3 M0 2 Q3 5.4 6.2 6.4" stroke="@corps" stroke-width="0.9" fill="none" stroke-linecap="round"/>' +
  '<path d="M-1 -2 Q-4 -5.4 -7.2 -6.4 M-2 -1.4 Q-6.2 -3 -9.4 -3 M-2 1.4 Q-6.2 3 -9.4 3 M-1 2 Q-4 5.4 -7.2 6.4" stroke="@corps" stroke-width="0.9" fill="none" stroke-linecap="round"/>' +
  '<ellipse cx="-2.2" cy="0" rx="3.8" ry="3.3" fill="@corps" stroke="@corpsO" stroke-width="0.5"/>' + // abdomen
  '<ellipse cx="-2.8" cy="-0.9" rx="2" ry="1.4" fill="@corpsH" opacity="0.28"/>' +
  '<circle cx="2.6" cy="0" r="2.3" fill="@corps" stroke="@corpsO" stroke-width="0.5"/>' + // céphalothorax
  '<circle cx="3.6" cy="-0.9" r="0.65" fill="#c43030"/><circle cx="3.6" cy="0.9" r="0.65" fill="#c43030"/>'; // 2 yeux rouges
const ARAIGNEES: SwarmForm = {
  critter: (cx, cy, s, flip) => wrap(cx, cy, s, flip, araigneesDraw),
  stored: { corps: '#2a231f', corpsO: '#14100c', corpsH: '#54463a' },
};

// --- NOCTECORBES : petit oiseau aux ailes déployées (VOLANT) ---------------------------------------
const noctecorbesDraw =
  '<path d="M-1.6 -0.8 Q-7 -5 -11.4 -3 Q-7 -1 -2 0.2 Z" fill="@corps" stroke="@corpsO" stroke-width="0.4"/>' + // aile G
  '<path d="M1.6 -0.8 Q7 -5 11.4 -3 Q7 -1 2 0.2 Z" fill="@corps" stroke="@corpsO" stroke-width="0.4"/>' + // aile D
  '<path d="M-3.4 -1.6 l-3.2 -0.4 M-5.6 -0.6 l-3 0.2 M3.4 -1.6 l3.2 -0.4 M5.6 -0.6 l3 0.2" stroke="@corpsO" stroke-width="0.4" opacity="0.6"/>' + // rémiges
  '<ellipse cx="0" cy="0.4" rx="2.4" ry="3.2" fill="@corps" stroke="@corpsO" stroke-width="0.5"/>' + // corps
  '<path d="M-1.4 3.2 l-1.4 3 l4 -1 Z" fill="@corps" stroke="@corpsO" stroke-width="0.4"/>' + // queue
  '<circle cx="0" cy="-3.6" r="1.6" fill="@corps" stroke="@corpsO" stroke-width="0.4"/>' + // tête
  '<path d="M0.4 -4.8 l2.4 -1.2 l-2.2 0.2 Z" fill="@accent"/>' + // bec
  '<circle cx="0.8" cy="-3.8" r="0.45" fill="#d8402a"/>'; // œil rouge
const NOCTECORBES: SwarmForm = {
  critter: (cx, cy, s, flip) => wrap(cx, cy, s, flip, noctecorbesDraw),
  stored: { corps: '#2c2c34', corpsO: '#141419', corpsH: '#4e4e58', accent: '#c4402a' },
  aerial: true,
};

// --- SNOTLINGS : petit humanoïde vert à grandes oreilles ------------------------------------------
const snotlingsDraw =
  '<path d="M-2.6 1.4 l-2.2 1.6 M2.6 1.4 l2.2 1.6 M-1.2 4 l-0.8 2.2 M1.2 4 l0.8 2.2" stroke="@corpsO" stroke-width="0.8" stroke-linecap="round"/>' + // membres
  '<ellipse cx="0" cy="1.8" rx="3" ry="2.6" fill="@corps" stroke="@corpsO" stroke-width="0.5"/>' + // corps
  '<path d="M-2.6 -2.6 L-7.2 -4.6 L-2.8 -0.8 Z" fill="@corps" stroke="@corpsO" stroke-width="0.4"/>' + // oreille G
  '<path d="M2.6 -2.6 L7.2 -4.6 L2.8 -0.8 Z" fill="@corps" stroke="@corpsO" stroke-width="0.4"/>' + // oreille D
  '<circle cx="0" cy="-2.6" r="3" fill="@corps" stroke="@corpsO" stroke-width="0.5"/>' + // tête
  '<circle cx="-1.1" cy="-3" r="0.8" fill="#160c06"/><circle cx="1.1" cy="-3" r="0.8" fill="#160c06"/>' + // yeux
  '<path d="M-1.8 -1.2 Q0 0.4 1.8 -1.2" stroke="#160c06" stroke-width="0.5" fill="none"/>'; // bouche
const SNOTLINGS: SwarmForm = {
  critter: (cx, cy, s, flip) => wrap(cx, cy, s, flip, snotlingsDraw),
  stored: { corps: '#5c7c32', corpsO: '#36481e', corpsH: '#88aa50' },
};

// --- NURGLINGS : petit pansu vert, gros œil unique, bave -------------------------------------------
const nurglingsDraw =
  '<path d="M-3.8 0.6 l-2.2 1.2 M3.8 0.6 l2.2 1.2 M-1.6 4.2 l-0.6 2 M1.6 4.2 l0.6 2" stroke="@corpsO" stroke-width="0.8" stroke-linecap="round"/>' + // membres courts
  '<ellipse cx="0" cy="1.2" rx="4.4" ry="3.6" fill="@corps" stroke="@corpsO" stroke-width="0.5"/>' + // gros ventre
  '<ellipse cx="-1.2" cy="0" rx="2.4" ry="1.8" fill="@corpsH" opacity="0.3"/>' +
  '<circle cx="1.8" cy="1.8" r="0.7" fill="@corpsO" opacity="0.5"/><circle cx="-2.2" cy="2.4" r="0.6" fill="@corpsO" opacity="0.5"/>' + // pustules
  '<circle cx="0" cy="-3.2" r="2.5" fill="@corps" stroke="@corpsO" stroke-width="0.5"/>' + // tête
  '<circle cx="0" cy="-3.2" r="1.6" fill="#e8e4c8"/><circle cx="0.4" cy="-3" r="0.85" fill="#160c06"/>' + // gros œil unique
  '<path d="M-1.8 -1.2 Q0 0.8 1.8 -1.2 Z" fill="#2a1a0e"/>' + // bouche
  '<path d="M-0.9 -0.8 l0 1.5 M0.5 -0.6 l0 1.7" stroke="#dcd6b8" stroke-width="0.4"/>' + // dents
  '<path d="M1.4 -0.6 q1.1 1.8 0.4 3.6" stroke="@corpsH" stroke-width="0.6" fill="none" opacity="0.85"/>'; // bave
const NURGLINGS: SwarmForm = {
  critter: (cx, cy, s, flip) => wrap(cx, cy, s, flip, nurglingsDraw),
  stored: { corps: '#6e8a38', corpsO: '#445222', corpsH: '#9cba5a' },
};

// --- SQUIGS : boule à grande gueule de crocs (motif squig) -----------------------------------------
const squigsDraw =
  '<path d="M-2 3.8 l-0.7 2.2 M2 3.8 l0.7 2.2" stroke="@corpsO" stroke-width="0.9" stroke-linecap="round"/>' + // pattes
  '<circle cx="0" cy="0" r="4.4" fill="@corps" stroke="@corpsO" stroke-width="0.6"/>' + // boule
  '<ellipse cx="-1.2" cy="-1.6" rx="2" ry="1.6" fill="@corpsH" opacity="0.3"/>' +
  '<path d="M-3.6 0.6 Q0 -1 3.6 0.6 Q3 4.2 0 4.4 Q-3 4.2 -3.6 0.6 Z" fill="#2a0e0c"/>' + // gueule béante
  '<path d="M-2.4 0.8 l0.8 2.4 l0.9 -2.2 Z M-0.1 0.4 l0.7 2.8 l0.9 -2.6 Z M2 0.8 l0.7 2.2 l0.8 -2 Z" fill="#efe6cf"/>' + // crocs
  '<circle cx="-1.8" cy="-2.4" r="1" fill="#f4ecd8"/><circle cx="-1.6" cy="-2.2" r="0.5" fill="#160c06"/>' + // œil G
  '<circle cx="1.8" cy="-2.4" r="1" fill="#f4ecd8"/><circle cx="1.6" cy="-2.2" r="0.5" fill="#160c06"/>'; // œil D
const SQUIGS: SwarmForm = {
  critter: (cx, cy, s, flip) => wrap(cx, cy, s, flip, squigsDraw),
  stored: { corps: '#9a2a46', corpsO: '#5e1426', corpsH: '#c85a6e' },
};

// --- ZOMBIES : petit humanoïde voûté en lambeaux, bras tendu ---------------------------------------
const zombiesDraw =
  '<path d="M-1 4 l-0.7 2.6 M1 4 l0.5 2.6" stroke="@corpsO" stroke-width="1" stroke-linecap="round"/>' + // jambes
  '<path d="M-2.6 4 Q-3.2 -1.2 0 -3.2 Q3.2 -1.2 2.6 4 Z" fill="@corps" stroke="@corpsO" stroke-width="0.5"/>' + // torse voûté
  '<path d="M-2.6 3.4 l0.9 1.8 l0.8 -1.4 l0.9 1.8 l0.8 -1.4 l0.9 1.6" fill="@corpsO" opacity="0.6"/>' + // ourlet déchiré
  '<path d="M-1.6 -1 Q-3.2 1 -3.4 3.6" stroke="@corps" stroke-width="1.2" fill="none" stroke-linecap="round"/>' + // bras pendant
  '<path d="M1.6 -1.2 Q5.2 -1.4 7.8 0.2" stroke="@corps" stroke-width="1.5" fill="none" stroke-linecap="round"/>' + // bras tendu
  '<path d="M7.8 0.2 l1.5 -0.7 M7.8 0.2 l1.1 1.1 M8.4 0 l0.8 -1.2" stroke="@corpsO" stroke-width="0.6" stroke-linecap="round"/>' + // main
  '<circle cx="2.2" cy="-4.2" r="2.1" fill="@corpsH" stroke="@corpsO" stroke-width="0.5"/>' + // tête tombée
  '<circle cx="2.9" cy="-4.4" r="0.5" fill="#160c06"/>' + // œil creux
  '<path d="M1.8 -2.8 q1.3 0.7 2 -0.1" stroke="@corpsO" stroke-width="0.4" fill="none"/>'; // mâchoire
const ZOMBIES: SwarmForm = {
  critter: (cx, cy, s, flip) => wrap(cx, cy, s, flip, zombiesDraw),
  stored: { corps: '#6a6a5c', corpsO: '#3a3a30', corpsH: '#8c9476' },
};

/** Table des FORMES de nuée — keyée par id de forme (= `appearance.species` des records Nuée). */
export const SWARM_FORMS: Record<string, SwarmForm> = {
  rats: RATS,
  marcassins: MARCASSINS,
  araignees: ARAIGNEES,
  noctecorbes: NOCTECORBES,
  snotlings: SNOTLINGS,
  nurglings: NURGLINGS,
  squigs: SQUIGS,
  zombies: ZOMBIES,
};

/** Repli : une nuée dont `appearance.species` est une VRAIE espèce (pas un id de forme) est routée
 *  par le `plan` de sa def de créature. N'importe QUE `defById` (pas resolveRender/bodyPlan → cycle). */
const PLAN_TO_FORM: Record<string, string> = {
  arachnid: 'araignees',
  avian: 'noctecorbes',
  squig: 'squigs',
  quadruped: 'rats',
  winged: 'noctecorbes',
  biped: 'zombies',
};
export function swarmFormOf(species: string): SwarmForm | undefined {
  const plan = defById(species)?.plan;
  return plan ? SWARM_FORMS[PLAN_TO_FORM[plan]] : undefined;
}
