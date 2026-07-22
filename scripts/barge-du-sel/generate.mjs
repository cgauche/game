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
import { itemFromTrappingById } from '../../src/engine/items.ts';

let ammoSeq = 0;
/** Munition de bord (`ItemInstance` kind:'ammo') bâtie par la couture CANONIQUE `itemFromTrappingById`,
 *  uid STABLE + quantité — cohérence témoin avec `scripts/loup-et-saumure/generate.mjs`. */
function ammoStock(trappingId, qty) {
  const base = itemFromTrappingById(trappingId);
  if (!base) throw new Error(`munition inconnue au catalogue : ${trappingId}`);
  return { ...base, uid: `ammo-${trappingId}-${++ammoSeq}`, qty };
}
/** Poste ARMÉ (#241) : le `poste()` DOTÉ de son coffre à boulets de bord (`ShipPoste.ammo`) + la munition
 *  sélectionnée par défaut. Sans dotation, la pièce est muette (affordance « Pas de munitions »). */
function armedPoste(trappingId, side, stock) {
  const p = poste(trappingId, side);
  p.ammo = stock.map((s) => ammoStock(s.ref, s.qty));
  p.ammoUid = p.ammo[0].uid;
  return p;
}

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

/** Compétences NAVALES d'un marin représentant (MDG 14 l.39) — barreur (Voile) / canonnier (Poudre noire) : de
 *  quoi que la coque MANŒUVRE et FASSE FEU à la couche Mer. Témoin cohérent avec `loup-et-saumure`. */
const HELM_SKILLS = [{ id: 'voile', value: 55 }, { id: 'ramer', value: 45 }];
const GUN_SKILLS = [{ id: 'projectiles', spec: 'poudre-noire', value: 55 }];
/** Marin d'équipage COMPÉTENT (passager, hors rendu à la Mer) — CustomStatblock sourcé (règle stricte 7). */
function marine(id, x, y, label, skills) {
  return { id, kind: 'personnage', pos: { x, y }, label,
    // Clés = `CharKey` (slugs pleins, #311/`src/engine/types.ts`) ∪ `M`/`B` (`CustomStatblock.char`).
    statblock: {
      name: label,
      char: {
        M: 4,
        'capacite-de-combat': 35,
        'capacite-de-tir': 40,
        force: 33,
        endurance: 35,
        agilite: 30,
        dexterite: 30,
        intelligence: 30,
        'force-mentale': 30,
        sociabilite: 30,
        B: 12,
      },
      ...(skills ? { skills } : {}),
    } };
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
          type: 'setVessel', vehicleId: 'loup-imperial', label: 'La Louve grise',
          morale: 70, hullCurrent: 120, hullMax: 120,
          crew: [{ roleId: 'mousse', count: 2 }],
        },
        OBJ("Convoyer le sel jusqu'à l'îlot, malgré les pirates qui infestent la route."),
        { type: 'journal', text: "La Louve grise appareille, la cale pleine de sel, deux matelots à son bord — son canon servi, poudre et boulets en soute." },
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
  // COUCHE MER (10 m/case, MDG ch.13 : 1 point de Distance = 10 m → 1 case). Duel de coques NAVIRE-UNITÉ, témoin
  // du modèle : l'IA de coque (`runShipAI`) manœuvre la cogue pirate pour aligner sa bordée puis fait feu ; le
  // joueur joue le tour de la Louve grise. Coques ouvertes à ~150 m (15 cases) → l'approche se JOUE. Cf. loup-et-saumure.
  metresPerTile: 10,
  rows: seaRows(24, 14, []),
  entities: [
    hero(3, 7),
    hull('louve-grise', 'loup-imperial', 3, 7, 'E', 'La Louve grise', ['louve-helm', 'louve-gun'],
      [armedPoste('canon-moyen', 'tribord', [{ ref: 'boulet-et-poudre', qty: 12 }, { ref: 'mitraille-et-poudre', qty: 4 }]),
       armedPoste('canon-moyen', 'babord', [{ ref: 'boulet-et-poudre', qty: 12 }, { ref: 'mitraille-et-poudre', qty: 4 }]),
       armedPoste('pierrier', 'proue', [{ ref: 'balles-et-poudre-pierrier', qty: 16 }])]),
    marine('louve-helm', 3, 6, 'Timonier de la Louve grise', HELM_SKILLS),
    marine('louve-gun', 3, 8, 'Canonnier de la Louve grise', GUN_SKILLS),
    // Trait naval du catalogue (`naval-traits.json`, kind:'trait') posé en amélioration d'INSTANCE sur la
    // coque pirate — « Renforcé » (MDG p.97, +10 Endurance/niveau), thématiquement une coque de pirates
    // renforcée pour l'abordage. Passagers : les pirates + le chef, + un barreur/canonnier compétents.
    hull('cogue-pirate', 'cogue', 18, 7, 'O', 'La cogue pirate', ['pirate-1', 'pirate-2', 'chef-pirate-1', 'cogue-helm', 'cogue-gun'],
      [armedPoste('canon-moyen', 'tribord', [{ ref: 'boulet-et-poudre', qty: 12 }]),
       armedPoste('canon-moyen', 'babord', [{ ref: 'boulet-et-poudre', qty: 12 }]),
       armedPoste('canon-moyen', 'proue', [{ ref: 'boulet-et-poudre', qty: 8 }])],
      [{ id: 'renforce', value: 1 }]),
    { id: 'pirate-1', kind: 'personnage', ref: 'pirate-fluvial', pos: { x: 18, y: 6 }, label: 'Pirate' },
    { id: 'pirate-2', kind: 'personnage', ref: 'pirate-fluvial', pos: { x: 18, y: 8 }, label: 'Pirate' },
    { id: 'chef-pirate-1', kind: 'personnage', ref: 'chef-pirate', pos: { x: 19, y: 7 }, label: 'Le chef des pirates' },
    marine('cogue-helm', 18, 5, 'Barreur de la cogue', HELM_SKILLS),
    marine('cogue-gun', 18, 9, 'Canonnier de la cogue', GUN_SKILLS),
  ],
  encounters: [
    {
      id: 'enc-embuscade-sel',
      // Surprise navale = avantage de POSITION (couche Mer : pas d'État Surpris sur une coque) : Perception
      // ratée → la cogue surgit plus près, bordée alignée ; repérée → ~150 m sans avantage (`applyNavalSurprisePosition`).
      surprise: 'party',
      // Reddition à 40 % de Blessures (VictoryCondition.woundsThreshold, doc §8) : la cogue pirate amène
      // son pavillon avant le naufrage complet.
      victoryCondition: { type: 'woundsThreshold', targetId: 'cogue-pirate', belowPercent: 40 },
      members: [
        { entityId: 'louve-grise', side: 'ally' },
        { entityId: 'cogue-pirate', side: 'enemy' },
        { entityId: 'pirate-1', side: 'enemy' },
        { entityId: 'pirate-2', side: 'enemy' },
        { entityId: 'chef-pirate-1', side: 'enemy' },
        { entityId: 'cogue-helm', side: 'enemy' },
        { entityId: 'cogue-gun', side: 'enemy' },
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
  entryPoints: { arrivee: { x: 3, y: 7 } },
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
