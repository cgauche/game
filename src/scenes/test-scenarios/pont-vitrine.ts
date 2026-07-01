import { makeShowcaseParty } from '../../data/pregens';
import { parseAsciiRows } from '../../state/asciiMap';
import type { Scene, SceneEntity, Terrain } from '../../state/scene';
import type { TestScenario } from './_shared';

/**
 * PONT — VITRINE DU RELIEF MÉTRIQUE. Objectif-phare du chantier « relief unifié » : prouver qu'on marche
 * SUR et SOUS un même pont, qu'une montée s'authore en cases de hauteur croissante (rampe auto, AUCUN objet
 * escalier) et qu'un dénivelé > 1 m est une FALAISE infranchissable à pied.
 *
 * Tout est de la DONNÉE (2 couches + hauteurs métriques parallèles aux tuiles), zéro géométrie en dur :
 *  - COUCHE 0 = le sol (herbe, h=0) traversé par un CHEMIN (route) nord-sud qui passe SOUS le pont ;
 *  - COUCHE 1 = le TABLIER du pont (planches, h=2 m) enjambant le chemin d'est en ouest ; partout ailleurs
 *    la couche 1 est du `vide` (transparent → on voit/marche la couche 0 en dessous) ;
 *  - 2 RAMPES de pierre (h montant 0→1→2 m, ≤1 m/case) rejoignent le tablier là où les hauteurs coïncident
 *    (Δh≤1 m ⇒ le moteur relie les surfaces et fabrique la pente) ;
 *  - un PETIT RELIEF (plateau h=1 m, relié par ses rampes douces de 1 m) ;
 *  - une FALAISE : un rebord d'herbe à h=3 m (rejoint par une rampe 0→1→2→3) dominant un CREUX à h=0 séparé
 *    par un gouffre — Δ3 m ⇒ falaise (on n'y descend PAS à pied : on tombe en sautant le gouffre).
 *
 * Le moteur tire tout cela de `surfaceLink` (|Δh|≤`STEP_MAX_M` ⇒ marchable) : aucune machinerie d'escalier.
 */

const W = 16, H = 16;

const rowsOf = (s: string) => s.split('\n').slice(1, -1);

// ── COUCHE 0 (sol) : herbe de base, CHEMIN `route` (R), RAMPES de pierre (S), GOUFFRE de la falaise (vide, X) ─
const SOL = String.raw`
.......RR.......
.......RR.......
.......RR.......
.......RR.......
.......RR.......
.......RR.......
...SS..RR..SS...
...SS..RR..SS...
...SS..RR..SS...
.......RR.......
.......RR.......
.......RRSS.....
.......RR.XXXXXX
.......RR.X.....
.......RR.X.....
.......RR.X.....
`;
const g0 = parseAsciiRows(rowsOf(SOL), 'herbe', { R: 'route', S: 'pierre', X: 'vide' });

// ── COUCHE 1 (tablier du pont) : vide partout, PLANCHES (P) sur la travée qui enjambe le chemin ──────────
const TABLIER = String.raw`
................
................
................
................
................
................
.....PPPPPP.....
.....PPPPPP.....
.....PPPPPP.....
................
................
................
................
................
................
................
`;
const g1 = parseAsciiRows(rowsOf(TABLIER), 'vide', { P: 'planches' });

// ── HAUTEURS MÉTRIQUES (tableaux PARALLÈLES aux tuiles, indexation y·W+x), construites en code ───────────
const idx = (x: number, y: number) => y * W + x;
type HSpec = { rect?: [number, number, number, number]; cell?: [number, number]; h: number };
function heights(specs: HSpec[]): number[] {
  const g = new Array(W * H).fill(0) as number[];
  for (const s of specs) {
    if (s.rect) { const [x0, y0, x1, y1] = s.rect; for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) g[idx(x, y)] = s.h; }
    if (s.cell) g[idx(s.cell[0], s.cell[1])] = s.h;
  }
  return g;
}

// Couche 0 : rampes du pont (0→1→2 sur 2 cases / rive), plateau (1), rampe + rebord de la falaise (1→2→3).
const h0 = heights([
  // Rampe OUEST du pont : col 3 → 1 m, col 4 → 2 m (rejoint le tablier à 2 m sur la rive ouest).
  { rect: [3, 6, 3, 8], h: 1 }, { rect: [4, 6, 4, 8], h: 2 },
  // Rampe EST du pont : col 12 → 1 m, col 11 → 2 m (rejoint le tablier à 2 m sur la rive est).
  { rect: [12, 6, 12, 8], h: 1 }, { rect: [11, 6, 11, 8], h: 2 },
  // Petit relief : plateau à 1 m (rampe douce de 1 m sur tout son pourtour).
  { rect: [1, 12, 4, 14], h: 1 },
  // Falaise : rampe d'accès (col 9 → 1 m, col 10 → 2 m) puis REBORD à 3 m (rangée 11, cols 11-15).
  { cell: [9, 11], h: 1 }, { cell: [10, 11], h: 2 }, { rect: [11, 11, 15, 11], h: 3 },
]);

// Couche 1 : le tablier du pont est à 2 m (les rampes de la couche 0 le rejoignent à hauteur égale).
const h1 = heights([{ rect: [5, 6, 10, 8], h: 2 }]);

// ── Décor d'extérieur (props purs) : repères visuels des trois reliefs ──────────────────────────────────
const prop = (id: string, ref: string, x: number, y: number, z = 0): SceneEntity =>
  ({ id, kind: 'prop', ref, pos: { x, y }, ...(z ? { z } : {}) });
const decor: SceneEntity[] = [
  prop('arbre-0', 'arbre', 0, 2), prop('arbre-1', 'arbre', 15, 4), prop('arbre-2', 'arbre', 0, 9),
  prop('panneau', 'panneau', 6, 4),                 // panneau au pied de la rampe ouest
  prop('rocher-falaise', 'rocher', 13, 11, 0),       // rocher sur le rebord de la falaise (h=3)
  prop('buisson-creux', 'buisson', 13, 14),          // buisson au fond du creux
];

const tiles0: Terrain[] = g0.tiles, tiles1: Terrain[] = g1.tiles;

const scene: Scene = {
  id: 'pont-vitrine',
  nom: 'Pont — vitrine du relief',
  description:
    "Vitrine du relief métrique : un chemin de pierre traverse une clairière en passant SOUS un pont de bois " +
    "(tablier à 2 m, couche 1) que l'on rejoint par deux rampes ; un petit plateau à 1 m ; et un rebord de " +
    "falaise à 3 m dominant un creux. Marchez sous le pont, montez la rampe pour marcher dessus, escaladez le " +
    "plateau — mais la falaise ne se descend pas à pied.",
  dimensions: { w: W, h: H },
  ambiance: 'exterieur',
  ambientLight: 'jour',
  layers: [
    { z: 0, tiles: tiles0, height: h0 },
    { z: 1, tiles: tiles1, height: h1 },
  ],
  entities: [
    { id: 'start', kind: 'heroStart', pos: { x: 7, y: 1 } }, // sur le chemin, au nord (couche 0)
    ...decor,
  ],
  dialogues: [],
  triggers: [],
  encounters: [],
  flags: {},
  startMessage:
    "Vous tenez le chemin, au nord. Suivez-le vers le sud : il passe SOUS le pont. Pour marcher DESSUS, prenez " +
    "l'une des deux rampes (est ou ouest). À l'ouest, un plateau se gravit ; au sud-est, un rebord de falaise " +
    "surplombe un creux — infranchissable à pied.",
};

export const scenario: TestScenario = {
  id: 'pont-vitrine',
  order: 50,
  category: '🖼️ Rendu',
  icon: '🌉',
  title: 'Pont — vitrine',
  tests:
    'Relief métrique 100 % données (2 couches + hauteurs parallèles) : on marche SOUS le pont (couche 0, h=0) ' +
    "et DESSUS (couche 1 'planches', h=2 m) ; accès par 2 RAMPES auto-dérivées (hauteurs 0→1→2, AUCUN escalier) ; " +
    'un plateau à 1 m ; une FALAISE (rebord h=3 m / creux h=0) infranchissable à pied (surfaceLink → cliff).',
  partyNote: 'Groupe vitrine (Soldat / Tueur / Sorcier / Chasseur) — promenade libre, aucun combat.',
  makeParty: makeShowcaseParty,
  scene,
};
