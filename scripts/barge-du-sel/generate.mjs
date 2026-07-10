#!/usr/bin/env -S npx tsx
/**
 * Génère `src/scenes/barge-du-sel/barge-du-sel-projet.json` (projet v2 : { schema, scenes, worldMap }).
 * Mini-campagne navale « La Barge du Sel » (issue #218, expérience auteur) — modelée sur
 * `scripts/loup-et-saumure/generate.mjs` : RÉUTILISE `scene()`/`hero()`/`P()`/`flowOf()`/`poste()`/
 * `resetIds()` de `scripts/campagne/lib.mjs` (IMPORT, zéro modification de ce fichier).
 *
 * 3 scènes : le quai de départ (le navire du groupe et l'objectif courant sont posés à l'entrée), une
 * embuscade de pirates ancrée à MI-ROUTE (coque type cogue, trait naval « Renforcé » du catalogue,
 * reddition à 40 % de Blessures), et l'îlot d'arrivée. Patron des entités-coque (`hull()`) et des rangées
 * ASCII de mer (`seaRows()`) repris À L'IDENTIQUE de `scripts/loup-et-saumure/generate.mjs` : ces deux
 * fabriques sont LOCALES à chaque générateur naval (`lib.mjs` ne les exporte pas — cf. journal
 * `docs/plans/2026-07-08-211-naval-authoring-journal.md`, friction n°1/n°2), donc dupliquées ici À
 * L'IDENTIQUE plutôt que réinventées.
 */
import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { scene, hero, P, flowOf, poste, resetIds } from '../campagne/lib.mjs';

/** Entité-COQUE brute (chemin `entities` du MapSpec, JAMAIS normalisée par `creatureId`) — une coque
 *  RICHE (crewIds/postes/upgrades) se pose ainsi puis s'enrôle via `encounters[].members` (doc
 *  `campagne-authoring.md` §7). */
function hull(id, ref, x, y, facing, label, crewIds, postes, upgrades) {
  return { id, kind: 'personnage', ref, pos: { x, y }, facing, label, crewIds, postes, ...(upgrades ? { upgrades } : {}) };
}

/** Rangées ASCII d'une scène MER : `w`×`h` cases d'eau ('.') avec des empreintes rectangulaires ('=')
 *  posées par coordonnées — construites par CODE (jamais comptées à la main), `parseAsciiRows` lève sinon
 *  une erreur explicite sur une ligne de largeur fautive. */
function seaRows(w, h, footprints) {
  const rows = [];
  for (let y = 0; y < h; y++) {
    const chars = new Array(w).fill('.');
    for (const f of footprints) if (y >= f.y && y < f.y + f.h) for (let x = f.x; x < f.x + f.w; x++) chars[x] = '=';
    rows.push(chars.join(''));
  }
  return rows;
}

/** Objectif courant (#238, doc §10) — id STABLE UNIQUE : re-poser met à jour le texte et le remonte en tête. */
const OBJ = (text) => ({ type: 'setObjective', id: 'barge-du-sel-mission', text });

const scenes = [];

// ════════════════════════════════════════════════════════════════════════════════════════════
// Scène 0 — le quai de départ : la Louve grise est armée, l'objectif courant posé À L'ENTRÉE.
// ════════════════════════════════════════════════════════════════════════════════════════════
resetIds();
scenes.push(scene({
  id: 'barge-du-sel-quai',
  nom: 'Le quai de la Barge du Sel',
  description:
    "Un petit quai de chargement. La Louve grise attend, amarrée, la cale pleine de sel à livrer à l'îlot voisin.",
  base: 'sable',
  legend: { '~': 'eau', '=': 'planches' },
  rows: [
    '............',
    '............',
    '............',
    '............',
    '............',
    '============',
    '~~~~~~~~~~~~',
    '~~~~~~~~~~~~',
  ],
  triggers: [
    {
      id: 'barge-du-sel-depart', rect: { x: 0, y: 0, w: 12, h: 8 }, once: true,
      flow: flowOf([
        {
          type: 'setVessel', vehicleId: 'loup-imperial', name: 'La Louve grise',
          morale: 70, hullCurrent: 120, hullMax: 120,
          crew: [{ roleId: 'mousse', count: 2 }],
        },
        OBJ("Convoyer le sel jusqu'à l'îlot, malgré les pirates qui infestent la route."),
        { type: 'journal', text: "La Louve grise appareille, la cale pleine de sel, deux matelots à son bord." },
      ]),
    },
  ],
  entities: [
    hero(2, 3),
    P(2, 6, undefined, {
      label: 'Appareiller vers l’îlot',
      interact: { flow: flowOf([{ type: 'openWorldMap' }]) },
    }),
  ],
}));

// ════════════════════════════════════════════════════════════════════════════════════════════
// Scène 1 — l'embuscade de pirates, ancrée à MI-ROUTE (route.ambush.at = 0.5).
// ════════════════════════════════════════════════════════════════════════════════════════════
resetIds();
scenes.push(scene({
  id: 'barge-du-sel-embuscade',
  nom: 'Voile noire à mi-route — une cogue pirate attaque',
  description: "Une cogue pirate coupe la route de la Louve grise en pleine mer.",
  weather: 'brouillard',
  base: 'eau',
  legend: { '=': 'planches' },
  // Grille d'ABORDAGE = échelle PERSON-scale 2 m/case. metresPerTile≥4 fait basculer `isMerScene`
  // (src/state/scene.ts) → modèle navire-UNITÉ (équipage passager, tour de coque, Bordée) qui exige une IA de
  // manœuvre de coque ennemie ABSENTE (runEnemyAI ne pilote pas les vehicule → la coque reste immobile) et met
  // la bordée hors de portée sans manœuvre d'approche. À 2 m/case : l'équipage combat individuellement, les
  // héros SERVENT les pièces, l'abordage se joue (reachTiles LDB 15 = 1 case fixe). L'échelle mer est réservée
  // aux scènes de TRAVERSÉE jusqu'à ce que l'IA navale existe.
  rows: seaRows(22, 14, [{ x: 3, y: 5, w: 4, h: 4 }, { x: 15, y: 5, w: 3, h: 3 }]),
  entities: [
    hero(4, 6),
    hull('louve-grise', 'loup-imperial', 4, 6, 'E', 'La Louve grise', [], [poste('canon-moyen', 'tribord')]),
    // Trait naval du catalogue (`naval-traits.json`, kind:'trait') posé en amélioration d'INSTANCE sur la
    // coque pirate — « Renforcé » (MDG p.97, +10 Endurance/niveau), thématiquement une coque de pirates
    // renforcée pour l'abordage.
    hull('cogue-pirate', 'cogue', 16, 6, 'O', 'La cogue pirate', ['pirate-1', 'pirate-2'], [],
      [{ id: 'renforce', value: 1 }]),
    { id: 'pirate-1', kind: 'personnage', ref: 'pirate-fluvial', pos: { x: 15, y: 5 }, label: 'Pirate' },
    { id: 'pirate-2', kind: 'personnage', ref: 'pirate-fluvial', pos: { x: 15, y: 7 }, label: 'Pirate' },
    { id: 'chef-pirate-1', kind: 'personnage', ref: 'chef-pirate', pos: { x: 17, y: 6 }, label: 'Le chef des pirates' },
  ],
  encounters: [
    {
      id: 'enc-embuscade-sel',
      // Reddition à 40 % de Blessures (VictoryCondition.woundsThreshold, doc §8) : la cogue pirate amène
      // son pavillon avant le naufrage complet.
      victoryCondition: { type: 'woundsThreshold', targetId: 'cogue-pirate', belowPercent: 40 },
      members: [
        { entityId: 'louve-grise', side: 'ally' },
        { entityId: 'cogue-pirate', side: 'enemy' },
        { entityId: 'pirate-1', side: 'enemy' },
        { entityId: 'pirate-2', side: 'enemy' },
        { entityId: 'chef-pirate-1', side: 'enemy' },
      ],
      onVictory: flowOf([
        { type: 'setFlag', flag: 'sel_embuscade_vaincue' },
        { type: 'giveXp', amount: 100 },
        { type: 'giveMoney', gold: 10 },
        OBJ("Rallier l'îlot avec le sel — la cogue pirate écartée."),
        { type: 'journal', text: "La cogue pirate amène son pavillon à mi-coque et rompt le combat." },
        // Pas de transition en dur : l'embuscade n'est qu'une INTERRUPTION de la traversée (patron
        // loup-et-saumure) — le voyage REPREND vers l'îlot une fois le combat gagné.
      ]),
    },
  ],
  entryPoints: { arrivee: { x: 4, y: 6 } },
}));

// ════════════════════════════════════════════════════════════════════════════════════════════
// Scène 2 — l'îlot d'arrivée.
// ════════════════════════════════════════════════════════════════════════════════════════════
resetIds();
scenes.push(scene({
  id: 'barge-du-sel-ilot',
  nom: 'L’îlot du sel',
  description: "Un petit îlot rocheux où la cargaison de sel doit être débarquée.",
  base: 'sable',
  legend: { '~': 'eau', '=': 'planches' },
  rows: [
    '............',
    '............',
    '............',
    '............',
    '============',
    '~~~~~~~~~~~~',
  ],
  triggers: [
    {
      id: 'barge-du-sel-arrivee', rect: { x: 0, y: 0, w: 12, h: 6 }, once: true,
      flow: flowOf([
        { type: 'clearObjective' },
        { type: 'journal', text: "La Louve grise accoste à l'îlot, la cale toujours pleine de sel." },
      ]),
    },
  ],
  entities: [hero(2, 2)],
}));

// ── Carte du monde ──────────────────────────────────────────────────────────────────────────
const worldMap = {
  id: 'carte-barge-du-sel',
  nom: 'La Barge du Sel',
  places: [
    { id: 'quai-du-sel', label: 'Le quai de départ', pos: { x: 20, y: 60 }, scene: 'barge-du-sel-quai', icon: 'scenario/port' },
    { id: 'ilot-du-sel', label: 'L’îlot du sel', pos: { x: 60, y: 40 }, scene: 'barge-du-sel-ilot', icon: 'scenario/port' },
  ],
  routes: [
    {
      id: 'route-quai-ilot', a: 'quai-du-sel', b: 'ilot-du-sel', km: 30, modes: ['mer'], sea: true, seaHeading: 'nord',
      ambush: { scene: 'barge-du-sel-embuscade', encounter: 'enc-embuscade-sel', at: 0.5 },
    },
  ],
};

// ── Garde-fous d'authoring (patron `scripts/arene/generate.mjs` / `scripts/loup-et-saumure/generate.mjs`) ──
const ids = new Set();
for (const s of scenes) {
  if (ids.has(s.id)) throw new Error(`id de scène dupliqué : ${s.id}`);
  ids.add(s.id);
  const starts = s.entities.filter((e) => e.kind === 'heroStart');
  if (starts.length !== 1) throw new Error(`${s.id} : ${starts.length} heroStart (1 attendu)`);
}
for (const p of worldMap.places) if (!ids.has(p.scene)) throw new Error(`carte : lieu ${p.id} → scène inconnue ${p.scene}`);

const doc = { schema: 2, scenes, worldMap };
const out = join(dirname(fileURLToPath(import.meta.url)), '../../src/scenes/barge-du-sel/barge-du-sel-projet.json');
writeFileSync(out, JSON.stringify(doc, null, 1) + '\n');
console.log(`barge-du-sel-projet.json : ${scenes.length} scènes, ${worldMap.places.length} lieux, ${worldMap.routes.length} routes.`);
