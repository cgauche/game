#!/usr/bin/env -S npx tsx
/**
 * Génère `src/scenes/loup-et-saumure/loup-et-saumure-projet.json` (projet v2 : { schema, scenes, worldMap }).
 * Modelé sur `scripts/arene/generate.mjs` — RÉUTILISE `scene()`/`hero()`/`NPC()`/`P()`/`flowOf()`/
 * `flagWhen()`/`testNode()` de `scripts/arene/lib.mjs` (IMPORT, zéro modification de ce fichier).
 *
 * Écart d'authoring trouvé (à documenter pour `creer-une-campagne`) : `lib.mjs::scene()` normalise le
 * `ref` des ennemis TERSE (`encounters[].enemies[]`) via `creatureId()`, qui n'interroge QUE le
 * registre des CRÉATURES (`findCreatureById`/`findCreature`) — un `ref` de NAVIRE (`vehicles.json` :
 * `cogue`/`langskip`/`loup-imperial`) y lève « créature introuvable ». Contournement : les entités-COQUE
 * (Grimm/cogue/langskip, avec `crewIds`/`postes`) sont posées en `entities` BRUTES (chemin QUI EXISTE
 * dans `MapSpec`/`buildScene`, jamais normalisé) + enrôlées via `encounters[].members` (ids explicites)
 * plutôt que par le chemin terse `enemies[]` — aucun helper de lib.mjs modifié, aucune ré-implémentation
 * du compilateur, juste l'autre chemin déjà prévu par le schéma pour des entités déjà posées.
 */
import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { scene, hero, NPC, P, flowOf, flagWhen, testNode } from '../arene/lib.mjs';

// ── Postes d'artillerie : ItemInstance à la main (patron `itemFromTrappingById`, engine/items.ts) ──
// lib.mjs n'exporte aucun fabricant de ShipPoste (outillage pensé « arène » = terrestre, pas naval) —
// helper LOCAL, noté au journal comme 2e trouvaille de lib d'auteur incomplète côté naval.
let uidN = 0;
const uid = (tag) => `itm-${tag}-${++uidN}`;
function canonMoyen(tag) {
  return {
    uid: uid(tag), trappingId: 'canon-moyen', name: 'Canon (moyen)', kind: 'ranged',
    damage: { plusBF: false, flat: 14 }, reach: null, range: 75,
    qualities: [{ id: 'dangereuse' }, { id: 'recharge', value: 6 }, { id: 'arme-d-equipe', value: 3 }, { id: 'siege' }],
    enc: 50, equipped: false, weaponGroup: 'poudre-noire', subType: 'armes-de-siege',
  };
}
function pierrier(tag) {
  return {
    uid: uid(tag), trappingId: 'pierrier', name: 'Pierrier', kind: 'ranged',
    damage: { plusBF: false, flat: 14 }, reach: null, range: 30,
    qualities: [{ id: 'dangereuse' }, { id: 'recharge', value: 4 }],
    enc: 5, equipped: false, weaponGroup: 'poudre-noire', subType: 'armes-de-siege',
  };
}
/** Poste SANS chef pré-assigné (`crewIds` vide) : servable EN JEU par tout héros adjacent (« Servir
 *  cette pièce », `state/shipPostes.ts` servablePostes/serveAtPoste) — les ids de héros ne sont connus
 *  qu'à la création de personnage, jamais à l'authoring de campagne. */
function poste(item, side) { return { item, side, crewIds: [] }; }

/** Entité-COQUE brute (navire = Combattant à PV, ref vers `vehicles.json`) — chemin `entities` du
 *  MapSpec (jamais normalisé par `creatureId`), cf. commentaire d'en-tête. `upgrades` = améliorations
 *  d'INSTANCE (`NavalTraitRef[]` : `{ id, value? }`, lues au spawn par `spawn.ts` puis par les Tests
 *  d'équipage de combat via `Combatant.upgrades`). */
function hull(id, ref, x, y, facing, label, crewIds, postes, upgrades) {
  return { id, kind: 'personnage', ref, pos: { x, y }, facing, label, crewIds, postes, ...(upgrades ? { upgrades } : {}) };
}
/** Rangées ASCII d'une scène MER : `w`×`h` cases d'eau ('.') avec DEUX empreintes rectangulaires ('=')
 *  posées par coordonnées — construites par CODE (pas comptées à la main) pour éviter l'erreur de
 *  largeur de `parseAsciiRows` (chaque ligne DOIT faire exactement `w` caractères). */
function seaRows(w, h, footprints) {
  const rows = [];
  for (let y = 0; y < h; y++) {
    const chars = new Array(w).fill('.');
    for (const f of footprints) if (y >= f.y && y < f.y + f.h) for (let x = f.x; x < f.x + f.w; x++) chars[x] = '=';
    rows.push(chars.join(''));
  }
  return rows;
}

/** Membre d'équipage exposé (MDG ch.14) SANS ref de bestiaire dédiée (aucune créature générique
 *  « marin »/« matelot » au catalogue, cf. journal) : CustomStatblock minimal justifié (règle stricte 7 —
 *  omission documentée, pas un « MJ décide »). */
function marinDuGrimm(id, x, y, label) {
  return {
    id, kind: 'personnage', pos: { x, y }, label,
    statblock: { name: label, char: { M: 4, CC: 35, CT: 30, F: 33, E: 35, Ag: 30, Dex: 30, Int: 30, FM: 30, Soc: 30, B: 12 } },
  };
}

const scenes = [];

// ════════════════════════════════════════════════════════════════════════════════════════════
// Scène 0 — Salzenmund, le quai (Acte 0 : commission, armement, départ sous les auspices)
// ════════════════════════════════════════════════════════════════════════════════════════════
scenes.push(scene({
  id: 'ls-quai-salzenmund',
  nom: 'Salzenmund — le quai de la Seconde Flotte',
  description:
    "L'automne rend la Mer des Griffes mauvaise et le fret précieux. Le baron Ludolf Köhler attend sur le quai, " +
    "à côté du Grimm amarré. Frère Aldo bénit les départs ; Dame Kramer surveille le chargement de son fret ; " +
    "Griet accorde son luth.",
  weather: 'brouillard',
  base: 'sable',
  legend: { '~': 'eau', '=': 'planches' },
  rows: [
    '................',
    '................',
    '................',
    '................',
    '................',
    '................',
    '................',
    '================',
    '~~~~~~~~~~~~~~~~',
    '~~~~~~~~~~~~~~~~',
  ],
  entities: [
    hero(2, 4),
    NPC('kohler', 5, 3, 'Baron Ludolf Köhler', { facing: 'S', dialogueId: 'dlg-kohler', appearance: { species: 'Humains (Reiklander)', career: 'Noblesse', sex: 'M', build: 0.5 } }),
    NPC('aldo', 8, 3, 'Frère Aldo', { facing: 'S', dialogueId: 'dlg-aldo', appearance: { species: 'Humains (Reiklander)', career: 'Prêtre initié', sex: 'M', build: 0.6 } }),
    NPC('kramer', 11, 3, 'Dame Vasilika Kramer', { facing: 'S', dialogueId: 'dlg-kramer', appearance: { career: 'Marchande', sex: 'F', build: 0.45 } }),
    NPC('griet', 5, 6, 'Griet', { facing: 'N', dialogueId: 'dlg-griet', appearance: { species: 'Humains (Reiklander)', career: 'Ménestrel', sex: 'F', build: 0.4 } }),
    NPC('avitailleuse', 9, 6, 'Cambuse du port (rations/eau)', { facing: 'N', merchant: { archetype: 'taverniere' }, appearance: { species: 'Humains (Reiklander)', career: 'Bourgeois', sex: 'F', build: 0.55 } }),
    NPC('armurier', 12, 6, 'Arsenal du port (munitions/pièces)', { facing: 'N', merchant: { archetype: 'armurier' }, appearance: { species: 'Humains (Reiklander)', career: 'Artisan', sex: 'M', build: 0.6 } }),
    NPC('avitailleur', 13, 4, 'Chandelier du quai (eau, rations de mer, pièces, boulets)', { facing: 'S', merchant: { archetype: 'avitailleur' }, appearance: { species: 'Humains (Reiklander)', career: 'Bourgeois', sex: 'M', build: 0.5 } }),
    P(2, 8, undefined, {
      label: 'La jetée d’appareillage',
      interact: {
        flow: {
          kind: 'if', cond: flagWhen('ls_commission_acceptee'),
          then: flowOf([{ type: 'openWorldMap' }]),
          else: flowOf([{ type: 'journal', text: 'Il faut d’abord accepter la commission du baron Köhler.' }]),
        },
      },
    }),
  ],
  dialogues: [
    {
      id: 'dlg-kohler', start: 'k1',
      nodes: [{
        id: 'k1', speaker: 'Baron Ludolf Köhler',
        text:
          "« Capitaine. Le Grimm est vôtre pour cette traversée — porter à Erengrad une cargaison " +
          "d'armes, en rapporter de la laine kislevite avant les glaces. Voici votre lettre de mission, et " +
          "une avance de 40 couronnes. Dame Kramer voyage avec vous : sa cargaison, sa cabine, son contrat. »",
        choices: [
          {
            text: 'Accepter la commission (40 CO, le Grimm à quai)',
            when: { kind: 'flag', expr: '!ls_commission_acceptee' },
            flow: flowOf([
              { type: 'giveMoney', gold: 40 },
              // saboteurDR: -2 [maison] — le sabotage discret de l'affréteuse Kramer pèse sur les Tests
              // d'équipage du voyage dès le départ (MDG 14 l.45-47), posé par cette MÊME commission qui
              // embarque Kramer à bord.
              // crew : roster SALARIÉ d'un petit caboteur — officiers de bord nommés + poignée de mousses
              // (paie hebdo `tickCampaignVesselWeek`, barème `crew-roles.json`). #216
              {
                type: 'setVessel', vehicleId: 'loup-imperial', name: 'Le Grimm',
                morale: 75, hullCurrent: 180, hullMax: 180, saboteurDR: -2,
                crew: [
                  { roleId: 'navigateur', count: 1 },
                  { roleId: 'chirurgien', count: 1 },
                  { roleId: 'cuisinier', count: 1 },
                  { roleId: 'chansonnier', count: 1 },
                  { roleId: 'vigie', count: 1 },
                  { roleId: 'mousse', count: 8 },
                ],
              },
              { type: 'setFlag', flag: 'ls_commission_acceptee' },
              { type: 'journal', text: 'Le Grimm est à vous. 43 âmes à bord sur 50 — un sous-effectif visible dès le départ, et une avance qui ne couvre pas le carénage.' },
            ]),
            next: 'k1',
          },
          {
            text: 'Lui demander de financer le carénage (60 CO)',
            flow: flowOf([{ type: 'journal', text: '« L’avance de 40 couronnes est tout ce que la Seconde Flotte peut avancer, capitaine. Le reste sort de votre poche — ou vous partez sale. »' }]),
            next: 'k1',
          },
          {
            text: 'Prendre congé',
            when: { kind: 'flag', expr: 'ls_commission_acceptee' },
            flow: flowOf([{ type: 'endDialogue' }]),
          },
        ],
      }],
    },
    {
      id: 'dlg-aldo', start: 'a1',
      nodes: [{
        id: 'a1', speaker: 'Frère Aldo',
        text:
          "« Un navire qui appareille sans la bénédiction de Manann navigue nu, capitaine. Un petit sacrifice, " +
          "et je bénis la coque. »",
        choices: [
          {
            // Aldo est prêtre initié et sans Point de Péché (texte de présentation) — sa propre bénédiction,
            // sans offrande du capitaine, mappe sur le facteur « prêtre à bord sans péché » (MANANN_FACTORS,
            // sea-events.json id `pretre-sans-peche`).
            text: 'Demander la bénédiction du navire',
            flow: flowOf([
              { type: 'adjustManann', factorId: 'pretre-sans-peche' },
              { type: 'setFlag', flag: 'ls_benediction_aldo' },
              { type: 'journal', text: 'Frère Aldo asperge la proue d’eau de mer et prie Manann à voix basse. L’équipage se signe.' },
            ]),
            next: 'a1',
          },
          {
            text: 'Faire un petit sacrifice (une pièce jetée à la mer)',
            flow: flowOf([
              { type: 'giveMoney', gold: -1 },
              { type: 'adjustManann', factorId: 'petit-sacrifice' },
              { type: 'journal', text: 'Une pièce tombe dans l’écume. Aldo hoche la tête, satisfait. « Manann prend note, capitaine. »' },
            ]),
            next: 'a1',
          },
          {
            text: 'Faire un sacrifice moyen (une gemme de votre bourse)',
            flow: flowOf([
              { type: 'giveMoney', gold: -20 },
              { type: 'adjustManann', factorId: 'sacrifice-moyen' },
              { type: 'journal', text: 'La gemme disparaît sous les vagues. « Un sacrifice qui compte, capitaine. Manann s’en souviendra. »' },
            ]),
            next: 'a1',
          },
          {
            text: 'Faire un grand sacrifice (une vache entière, la moitié des provisions)',
            flow: flowOf([
              { type: 'giveMoney', gold: -50 },
              { type: 'adjustManann', factorId: 'grand-sacrifice' },
              { type: 'journal', text: 'La vache est jetée par-dessus bord avec la moitié des provisions. L’équipage retient son souffle — puis Aldo sourit. « Manann ne vous oubliera pas. »' },
            ]),
            next: 'a1',
          },
          {
            text: 'Lui demander l’origine de son ordre',
            flow: flowOf([{ type: 'journal', text: '« J’ai prêché sur tous les quais de la Mer des Griffes, capitaine. Je connais le Requin — Stromfels — mieux que je ne le voudrais. »' }]),
            next: 'a1',
          },
          { text: 'Le saluer', flow: flowOf([{ type: 'endDialogue' }]) },
        ],
      }],
    },
    {
      id: 'dlg-kramer', start: 'kr1',
      nodes: [{
        id: 'kr1', speaker: 'Dame Vasilika Kramer',
        text:
          "« Ma cargaison est dans la cale, capitaine, et j'entends qu'elle y reste jusqu'à Erengrad. »",
        choices: [
          { text: 'S’enquérir du fret', flow: flowOf([{ type: 'journal', text: '« Des étoffes, des piécettes d’ambre. Rien qui vous regarde, capitaine. »' }]), next: 'kr1' },
          {
            text: 'L’observer discrètement (Intuition)',
            flow: testNode(
              { skill: 'intuition', difficulty: 'difficile', label: 'Intuition — quelque chose cloche chez Kramer' },
              [{ type: 'setFlag', flag: 'ls_kramer_soupconnee' }, { type: 'journal', text: 'Un éclair de calcul froid passe dans son regard, vite maîtrisé. Elle cache quelque chose.' }],
              [{ type: 'journal', text: 'Rien ne transparaît — une négociante comme une autre, en apparence.' }],
            ),
            next: 'kr1',
          },
          { text: 'La laisser à ses affaires', flow: flowOf([{ type: 'endDialogue' }]) },
        ],
      }],
    },
    {
      id: 'dlg-griet', start: 'g1',
      nodes: [{
        id: 'g1', speaker: 'Griet',
        text: "« Une chanson pour la route, capitaine ? »",
        choices: [
          { text: 'Écouter sa chanson', flow: flowOf([{ type: 'journal', text: 'Griet entonne « Jacques Bret a rencontré notre acier » — l’équipage reprend le refrain.' }]), next: 'g1' },
          { text: 'La saluer', flow: flowOf([{ type: 'endDialogue' }]) },
        ],
      }],
    },
  ],
  entryPoints: { retour: { x: 2, y: 4 } },
}));

// ════════════════════════════════════════════════════════════════════════════════════════════
// Scène 1 — L'aller : la Dent de Manann (combat naval d'artillerie, Acte I scène 1.3)
// ════════════════════════════════════════════════════════════════════════════════════════════
scenes.push(scene({
  id: 'ls-abordage-cogue',
  nom: 'La Dent de Manann — voile noire sous le vent (J4)',
  description:
    "La cogue pirate intercepte le Grimm en haute mer. Sommation RAW complète (MDG 15 l.171-173) : fouille " +
    "de cale et pillage, PUIS un prisonnier à sacrifier à Stromfels. Frère Aldo nomme l'ennemi à voix haute.",
  weather: 'brouillard',
  base: 'eau',
  legend: { '=': 'planches' },
  metresPerTile: 10,
  rows: seaRows(22, 14, [{ x: 3, y: 5, w: 4, h: 4 }, { x: 15, y: 5, w: 3, h: 3 }]),
  entities: [
    hero(4, 6),
    hull('grimm', 'loup-imperial', 4, 6, 'E', 'Le Grimm', ['aldo-crew', 'griet-crew'],
      [poste(canonMoyen('grimm-tribord'), 'tribord'), poste(canonMoyen('grimm-babord'), 'babord'), poste(pierrier('grimm-proue'), 'proue')]),
    marinDuGrimm('aldo-crew', 4, 5, 'Frère Aldo (équipage exposé)'),
    marinDuGrimm('griet-crew', 5, 5, 'Griet (équipage exposé)'),
    hull('cogue', 'cogue', 16, 6, 'O', 'La Dent de Manann', ['pirate-1', 'pirate-2'],
      [poste(canonMoyen('cogue-tribord'), 'tribord')]),
    { id: 'pirate-1', kind: 'personnage', ref: 'pirate-fluvial', pos: { x: 15, y: 5 }, label: 'Pirate' },
    { id: 'pirate-2', kind: 'personnage', ref: 'pirate-fluvial', pos: { x: 15, y: 7 }, label: 'Pirate' },
    { id: 'chef-cogue', kind: 'personnage', ref: 'chef-pirate', pos: { x: 17, y: 6 }, label: 'Le chef de la Dent de Manann' },
  ],
  encounters: [
    {
      id: 'enc-cogue',
      // #215
      members: [
        { entityId: 'grimm', side: 'ally' },
        { entityId: 'aldo-crew', side: 'ally' },
        { entityId: 'griet-crew', side: 'ally' },
        { entityId: 'cogue', side: 'enemy' },
        { entityId: 'pirate-1', side: 'enemy' },
        { entityId: 'pirate-2', side: 'enemy' },
        { entityId: 'chef-cogue', side: 'enemy' },
      ],
      onVictory: flowOf([
        { type: 'setFlag', flag: 'ls_cogue_vaincue' },
        { type: 'giveXp', amount: 150 },
        { type: 'giveMoney', gold: 15 },
        { type: 'journal', text: 'La Dent de Manann rompt et sombre. Des épaves flottent — Séquestre à faire valoir à quai.' },
        { type: 'transition', scene: 'ls-quai-erengrad', entry: 'arrivee' },
      ]),
    },
  ],
  entryPoints: { arrivee: { x: 4, y: 6 } },
}));

// ════════════════════════════════════════════════════════════════════════════════════════════
// Scène 2 — Erengrad, l'escale (Acte II)
// ════════════════════════════════════════════════════════════════════════════════════════════
scenes.push(scene({
  id: 'ls-quai-erengrad',
  nom: 'Erengrad — le port kislevite',
  description:
    "Erengrad (Taille 4, Richesse 4, surplus Laine +1 — MDG 15 l.439-506). Négoce, rumeurs, et une nuit où " +
    "le chat du bord tombe malade.",
  weather: 'neige',
  base: 'sable',
  legend: { '~': 'eau', '=': 'planches' },
  rows: [
    '................',
    '................',
    '................',
    '................',
    '................',
    '................',
    '================',
    '~~~~~~~~~~~~~~~~',
  ],
  entities: [
    hero(2, 4),
    NPC('docker', 7, 3, 'Docker du port', { facing: 'S', dialogueId: 'dlg-rumeur-olg', appearance: { career: 'Ouvrier', sex: 'M', build: 0.6 } }),
    NPC('kramer-erengrad', 11, 3, 'Dame Vasilika Kramer', { facing: 'S', dialogueId: 'dlg-kramer-nuit-du-chat', appearance: { career: 'Marchande', sex: 'F', build: 0.45 } }),
    NPC('charpentier', 9, 6, 'Charpentier de bord', { facing: 'N', dialogueId: 'dlg-reparation', appearance: { species: 'Humains (Reiklander)', career: 'Artisan', sex: 'M', build: 0.6 } }),
    P(2, 7, undefined, { label: 'Reprendre la mer vers Salzenmund', interact: { flow: flowOf([{ type: 'openWorldMap' }]) } }),
  ],
  dialogues: [
    {
      id: 'dlg-rumeur-olg', start: 'r1',
      nodes: [{
        id: 'r1', speaker: 'Docker',
        text:
          "« Vous naviguez vers Salzenmund ? Faites gaffe à Olg Blóðsalt — un skaeling qui « boit la saumure » " +
          "et écume la route avec son langskip. La guilde marchande a mis une prime sur sa tête. »",
        choices: [{ text: 'Merci pour l’avertissement', flow: flowOf([{ type: 'setFlag', flag: 'ls_rumeur_olg' }, { type: 'endDialogue' }]) }],
      }],
    },
    {
      id: 'dlg-kramer-nuit-du-chat', start: 'nc1',
      nodes: [{
        id: 'nc1', speaker: 'Dame Vasilika Kramer',
        text:
          "Au matin de l'appareillage, le chat du bord est malade et un albatros mort est cloué au beaupré. " +
          "Kramer était « à terre toute la nuit ».",
        choices: [
          {
            // Démasquer Kramer ne LÈVE PAS son sabotage (`saboteurDR: -2`, scène du quai) : `setVessel`
            // REMPLACE tout `state.vessel` (morale/coque/manann compris), ce n'est pas un patch — un second
            // `setVessel` ici effacerait la progression d'Humeur de Manann et les dégâts de coque accumulés
            // depuis le départ. [INEXPRIMABLE, non tenté] : consigné au journal d'authoring plutôt que
            // câblé au prix d'une régression du navire de campagne.
            text: 'L’interroger sur sa nuit (Intuition)',
            flow: testNode(
              { skill: 'intuition', difficulty: 'difficile', label: 'Intuition — la nuit du chat' },
              [{ type: 'setFlag', flag: 'ls_kramer_demasquee' }, { type: 'journal', text: 'Elle craque : ce n’est pas une négociante, mais une initiée de Stromfels. L’équipage gronde.' }],
              [{ type: 'journal', text: '« Une insomnie de plus, capitaine. La traversée est éprouvante pour tous. »' }],
            ),
            next: 'nc1',
          },
          { text: 'La laisser tranquille', flow: flowOf([{ type: 'endDialogue' }]) },
        ],
      }],
    },
    {
      id: 'dlg-reparation', start: 'rp1',
      nodes: [{
        id: 'rp1', speaker: 'Charpentier de bord',
        text: "« Calfeutrons la coque avant de reprendre la mer, capitaine — la traversée l'a mise à mal. »",
        choices: [
          {
            text: 'Superviser la réparation (Test étendu de Métier (Charpentier), 5 DR)',
            flow: flowOf([{ type: 'extendedTest', skill: 'metier', spec: 'Charpentier', difficulty: 'intermediaire', label: 'Réparation temporaire du Grimm', targetDR: 5, flag: 'ls_coque_reparee' }]),
            next: 'rp1',
          },
          { text: 'Plus tard', flow: flowOf([{ type: 'endDialogue' }]) },
        ],
      }],
    },
  ],
  entryPoints: { arrivee: { x: 2, y: 4 } },
}));

// ════════════════════════════════════════════════════════════════════════════════════════════
// Scène 3 — Le retour : Olg Blóðsalt attaque (Acte III, climax scène 3.2)
// ════════════════════════════════════════════════════════════════════════════════════════════
scenes.push(scene({
  id: 'ls-abordage-olg',
  nom: 'Rames dans l’eau ! — le Serpent-de-Sel attaque (banc de Norden, J10-J11)',
  description:
    "Au petit matin, le langskip d'Olg Blóðsalt fond sur le Grimm chargé de laine. Poursuite, feu de chasse, " +
    "collision, abordage — le morceau de bravoure de la traversée.",
  weather: 'tempete',
  base: 'eau',
  legend: { '=': 'planches' },
  metresPerTile: 10,
  rows: seaRows(22, 14, [{ x: 3, y: 5, w: 4, h: 4 }, { x: 15, y: 5, w: 3, h: 3 }]),
  entities: [
    hero(4, 6),
    hull('grimm2', 'loup-imperial', 4, 6, 'E', 'Le Grimm', ['aldo-crew-2', 'griet-crew-2'],
      [poste(canonMoyen('grimm2-tribord'), 'tribord'), poste(canonMoyen('grimm2-babord'), 'babord'), poste(pierrier('grimm2-poupe'), 'poupe')]),
    marinDuGrimm('aldo-crew-2', 4, 5, 'Frère Aldo (équipage exposé)'),
    marinDuGrimm('griet-crew-2', 5, 5, 'Griet (équipage exposé)'),
    // Proue-idole de Stromfels : amélioration d'INSTANCE de la coque (#221).
    hull('serpent-de-sel', 'langskip', 16, 6, 'O', 'Le Serpent-de-Sel', ['norse-1', 'norse-2'], undefined,
      [{ id: 'proue-idole-de-stromfels' }]),
    { id: 'norse-1', kind: 'personnage', ref: 'maraudeur-du-chaos', pos: { x: 15, y: 5 }, label: 'Norse' },
    { id: 'norse-2', kind: 'personnage', ref: 'maraudeur-du-chaos', pos: { x: 15, y: 7 }, label: 'Norse' },
    { id: 'olg', kind: 'personnage', ref: 'olg-blodsalt', pos: { x: 17, y: 6 }, label: 'Olg Blóðsalt', weapon: 'Hache' },
  ],
  encounters: [
    {
      id: 'enc-olg',
      members: [
        { entityId: 'grimm2', side: 'ally' },
        { entityId: 'aldo-crew-2', side: 'ally' },
        { entityId: 'griet-crew-2', side: 'ally' },
        { entityId: 'serpent-de-sel', side: 'enemy' },
        { entityId: 'norse-1', side: 'enemy' },
        { entityId: 'norse-2', side: 'enemy' },
        { entityId: 'olg', side: 'enemy' },
      ],
      threat: { camp: 'enemies', tier: 'dangereuse' },
      onVictory: flowOf([
        { type: 'setFlag', flag: 'ls_olg_vaincu' },
        { type: 'giveXp', amount: 250 },
        { type: 'giveMoney', gold: 40 },
        { type: 'journal', text: 'Olg Blóðsalt tombe. Le Serpent-de-Sel amène pavillon — la prise à armer, ~40 survivants à répartir sur deux coques.' },
        { type: 'transition', scene: 'ls-epilogue-salzenmund', entry: 'retour' },
      ]),
    },
  ],
  entryPoints: { arrivee: { x: 4, y: 6 } },
}));

// ════════════════════════════════════════════════════════════════════════════════════════════
// Scène 4 — Salzenmund, l'épilogue (J13)
// ════════════════════════════════════════════════════════════════════════════════════════════
scenes.push(scene({
  id: 'ls-epilogue-salzenmund',
  nom: 'Salzenmund — le retour (J13)',
  description: "Les parts, le chantier, le conseil final. Köhler regarde la prise avec des yeux gourmands.",
  base: 'sable',
  legend: { '~': 'eau', '=': 'planches' },
  rows: [
    '..............',
    '..............',
    '..............',
    '..............',
    '..............',
    '..............',
    '==============',
    '~~~~~~~~~~~~~~',
    '~~~~~~~~~~~~~~',
  ],
  entities: [
    hero(2, 3),
    NPC('kohler-epilogue', 6, 3, 'Baron Ludolf Köhler', { facing: 'S', dialogueId: 'dlg-epilogue' }),
  ],
  dialogues: [
    {
      id: 'dlg-epilogue', start: 'e1',
      nodes: [{
        id: 'e1', speaker: 'Baron Ludolf Köhler',
        text: "« La Seconde Flotte manque de coques, capitaine. La prise du Serpent-de-Sel est à vendre ? »",
        choices: [
          {
            text: 'Toucher la solde de la mission (parts + prime)',
            when: { kind: 'flag', expr: '!ls_solde_versee' },
            flow: flowOf([
              { type: 'giveMoney', gold: 60 },
              { type: 'setFlag', flag: 'ls_solde_versee' },
              { type: 'giveXp', amount: 100 },
              { type: 'journal', text: 'Köhler verse la solde et la prime d’Olg. Le chantier attend le Grimm — carénage enfin, critiques réparés.' },
            ]),
            next: 'e1',
          },
          { text: 'Prendre congé', flow: flowOf([{ type: 'endDialogue' }]) },
        ],
      }],
    },
  ],
  entryPoints: { retour: { x: 2, y: 3 } },
}));

// ── Carte du monde ──────────────────────────────────────────────────────────────────────────
const worldMap = {
  id: 'carte-loup-et-saumure',
  nom: 'La Mer des Griffes — Salzenmund ⇄ Erengrad',
  places: [
    {
      id: 'salzenmund', label: 'Salzenmund', pos: { x: 25, y: 60 }, scene: 'ls-quai-salzenmund', icon: 'scenario/port',
      port: { ref: 'salzenmund' }, // #217 — Taille/Richesse/Production/Surplus/Demande RAW coulent du catalogue
    },
    {
      id: 'erengrad', label: 'Erengrad', pos: { x: 78, y: 20 }, scene: 'ls-quai-erengrad', icon: 'scenario/port',
      port: { ref: 'erengrad' }, // #217
    },
  ],
  routes: [
    {
      id: 'route-salzenmund-erengrad-aller',
      a: 'salzenmund', b: 'erengrad', km: 550, modes: ['mer'], sea: true, seaHeading: 'nord',
      ambush: { scene: 'ls-abordage-cogue', encounter: 'enc-cogue' },
    },
    {
      // DEUXIÈME route entre les MÊMES lieux — le schéma l'ACCEPTE (`MapRoute.id` est la seule clé ; `a`/`b`
      // ne sont pas contraints à l'unicité) : porte l'embuscade d'Olg au RETOUR. Limite trouvée : rien dans
      // `WorldMap`/`travel.ts` ne restreint une route au SENS de trajet — les deux sont offertes dans les
      // deux sens ; le scénario suppose que le joueur reprend la seconde au retour, l'engin ne l'IMPOSE PAS
      // [CONTOURNÉ : deux routes nommées, direction non appliquée mécaniquement].
      id: 'route-salzenmund-erengrad-retour',
      a: 'salzenmund', b: 'erengrad', km: 550, modes: ['mer'], sea: true, seaHeading: 'sud',
      ambush: { scene: 'ls-abordage-olg', encounter: 'enc-olg' },
    },
  ],
};

// ── Garde-fous d'authoring (patron `scripts/arene/generate.mjs`) ───────────────────────────
const ids = new Set();
for (const s of scenes) {
  if (ids.has(s.id)) throw new Error(`id de scène dupliqué : ${s.id}`);
  ids.add(s.id);
  const starts = s.entities.filter((e) => e.kind === 'heroStart');
  if (starts.length !== 1) throw new Error(`${s.id} : ${starts.length} heroStart (1 attendu)`);
}
for (const p of worldMap.places) if (!ids.has(p.scene)) throw new Error(`carte : lieu ${p.id} → scène inconnue ${p.scene}`);

const doc = { schema: 2, scenes, worldMap };
const out = join(dirname(fileURLToPath(import.meta.url)), '../../src/scenes/loup-et-saumure/loup-et-saumure-projet.json');
writeFileSync(out, JSON.stringify(doc, null, 1) + '\n');
console.log(`loup-et-saumure-projet.json : ${scenes.length} scènes, ${worldMap.places.length} lieux, ${worldMap.routes.length} routes.`);
