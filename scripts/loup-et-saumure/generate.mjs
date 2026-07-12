#!/usr/bin/env -S npx tsx
/**
 * Génère `src/scenes/loup-et-saumure/loup-et-saumure-projet.json` (projet v2 : { schema, scenes, worldMap }).
 * Modelé sur `scripts/arene/generate.mjs` — RÉUTILISE `scene()`/`hero()`/`NPC()`/`P()`/`flowOf()`/
 * `flagWhen()`/`testNode()`/`poste()` de `scripts/campagne/lib.mjs` (IMPORT, zéro modification de ce fichier).
 *
 * `scene()` normalise le `ref` des ennemis TERSE (`encounters[].enemies[]`) via `creatureId()`, qui
 * accepte désormais créature ∪ véhicule (#218) — un `ref` de NAVIRE (`vehicles.json` : `cogue`/`langskip`/
 * `loup-imperial`) passe. Les entités-COQUE (Grimm/cogue/langskip) restent posées en `entities` BRUTES +
 * enrôlées via `encounters[].members` (ids explicites) car elles portent `crewIds`/`postes`/`upgrades`
 * (équipage exposé, artillerie montée, améliorations d'instance) — plus riche que le terse `enemies[]`.
 *
 * DÉMO du produit : chaque dénouement (refus de la jetée, lecture d'Intuition, démasquage de Kramer) a
 * une surface VISIBLE au moment (nœud de dialogue conditionnel `flagWhen`, ou modale `document`) — le
 * `journal` ne fait que doubler en archive (« personne ne lit le journal »). Les objectifs d'acte
 * (`setObjective`, id STABLE `ls-mission`) balisent chaque bascule ; `clearObjective` à l'épilogue.
 */
import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { scene, hero, NPC, P, flowOf, flagWhen, testNode, poste, resetIds } from '../campagne/lib.mjs';
import { dailyWaterLitres } from '../../src/engine/seaWeather.ts';
import { itemFromTrappingById } from '../../src/engine/items.ts';

let ammoSeq = 0;
/** Munition de bord (`ItemInstance` kind:'ammo') bâtie par la couture CANONIQUE `itemFromTrappingById`
 *  (Dégâts/Qualités du catalogue), estampillée d'un uid STABLE et de sa quantité (le fond de soute). */
function ammoStock(trappingId, qty) {
  const base = itemFromTrappingById(trappingId);
  if (!base) throw new Error(`munition inconnue au catalogue : ${trappingId}`);
  return { ...base, uid: `ammo-${trappingId}-${++ammoSeq}`, qty };
}
/** Poste d'artillerie ARMÉ (#241) : le `poste()` DOTÉ de son coffre à boulets de bord (`ShipPoste.ammo`,
 *  MDG ch.12 l.410-424) + la munition sélectionnée par défaut (`ammoUid` = 1re du stock). Sans dotation,
 *  la pièce est muette (affordance « Pas de munitions ») — un baron n'arme jamais un caboteur à sec. */
function armedPoste(trappingId, side, stock) {
  const p = poste(trappingId, side);
  p.ammo = stock.map((s) => ammoStock(s.ref, s.qty));
  p.ammoUid = p.ammo[0].uid;
  return p;
}

// #241 — fond de cale du Grimm au départ : régime de bord médian (MDG 14 l.242) × 43 âmes (journal
// « 43 âmes à bord sur 50 ») × 4 jours (quelques jours d'eau, pas l'autonomie totale du voyage).
const GRIMM_WATER_LITRES = dailyWaterLitres('mediane') * 43 * 4;

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

/** Compétences NAVALES d'un marin représentant (MDG 14 l.39) : le Timonier tient la Voile, l'Artilleur la
 *  Poudre noire — de quoi que le navire MANŒUVRE et FASSE FEU à la couche Mer (Tests d'équipage). */
const HELM_SKILLS = [{ id: 'voile', value: 55 }, { id: 'ramer', value: 45 }];
const GUN_SKILLS = [{ id: 'projectiles', spec: 'poudre-noire', value: 55 }];

/** Membre d'équipage exposé (MDG ch.14) SANS ref de bestiaire dédiée (aucune créature générique
 *  « marin »/« matelot » au catalogue, cf. journal) : CustomStatblock minimal justifié (règle stricte 7 —
 *  omission documentée, pas un « MJ décide »). `skills` (optionnel) : compétences navales du représentant. */
function marinDuGrimm(id, x, y, label, skills) {
  return {
    id, kind: 'personnage', pos: { x, y }, label,
    statblock: {
      name: label,
      // Clés = `CharKey` (slugs pleins, #311/`src/engine/types.ts`) ∪ `M`/`B` (`CustomStatblock.char`).
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
    },
  };
}

/** Objectif d'acte (surface « je fais quoi ? », #238) sur la pile `store.objectives`, keyé par id STABLE
 *  UNIQUE `ls-mission` : re-poser met à jour le texte et le remonte en tête (doc §10). */
const OBJ = (text) => ({ type: 'setObjective', id: 'ls-mission', text });

// Apparences EXPLICITES, id STABLE (point 6). Kramer partagée par ses DEUX instances (même personnage :
// même seed/colors/tenue → rendu identique quai ⇄ Erengrad) ; Köhler partagé quai ⇄ épilogue.
const KRAMER_APPEARANCE = { species: 'humains-reiklander', tenue: 'marchand', sex: 'F', build: 0.45, seed: 20471 };
const KOHLER_APPEARANCE = { species: 'humains-reiklander', tenue: 'noble', sex: 'M', build: 0.5, seed: 5120 };

const scenes = [];

// ════════════════════════════════════════════════════════════════════════════════════════════
// Scène 0 — Salzenmund, le quai (Acte 0 : commission, armement, départ sous les auspices)
// ════════════════════════════════════════════════════════════════════════════════════════════
resetIds();
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
  // Trigger d'ARRIVÉE de RETOUR (patron obj-erengrad) : au premier pas sur le quai, si le fret a été livré
  // à Erengrad (`ls_fret_livre`), on bascule vers l'épilogue. Au DÉPART (Acte 0) le flag est absent → il ne
  // se déclenche pas : ce même quai sert l'ouverture ET la clôture, l'épilogue n'arrive qu'après la livraison.
  triggers: [
    {
      id: 'ls-retour-epilogue', rect: { x: 0, y: 0, w: 16, h: 8 }, once: true, when: flagWhen('ls_fret_livre'),
      flow: flowOf([{ type: 'transition', scene: 'ls-epilogue-salzenmund', entry: 'retour' }]),
    },
  ],
  entities: [
    hero(2, 4),
    NPC('kohler', 5, 3, 'Baron Ludolf Köhler', { facing: 'S', dialogueId: 'dlg-kohler', appearance: KOHLER_APPEARANCE }),
    NPC('aldo', 8, 3, 'Frère Aldo', { facing: 'S', dialogueId: 'dlg-aldo', appearance: { species: 'humains-reiklander', tenue: 'pretre', sex: 'M', build: 0.6 } }),
    NPC('kramer', 11, 3, 'Dame Vasilika Kramer', { facing: 'S', dialogueId: 'dlg-kramer', appearance: KRAMER_APPEARANCE }),
    NPC('griet', 5, 6, 'Griet', { facing: 'N', dialogueId: 'dlg-griet', appearance: { species: 'humains-reiklander', tenue: 'artiste', sex: 'F', build: 0.4 } }),
    NPC('avitailleuse', 9, 6, 'Cambuse du port (rations/eau)', { facing: 'N', merchant: { archetype: 'taverniere' }, appearance: { species: 'humains-reiklander', tenue: 'bourgeois', sex: 'F', build: 0.55 } }),
    NPC('armurier', 12, 6, 'Arsenal du port (munitions/pièces)', { facing: 'N', merchant: { archetype: 'armurier' }, appearance: { species: 'humains-reiklander', tenue: 'artisan', sex: 'M', build: 0.6 } }),
    NPC('avitailleur', 13, 4, 'Chandelier du quai (eau, rations de mer, pièces, boulets)', { facing: 'S', merchant: { archetype: 'avitailleur' }, appearance: { species: 'humains-reiklander', tenue: 'bourgeois', sex: 'M', build: 0.5 } }),
    P(2, 8, undefined, {
      label: 'La jetée d’appareillage',
      interact: {
        flow: {
          kind: 'if', cond: flagWhen('ls_commission_acceptee'),
          then: flowOf([{ type: 'openWorldMap' }]),
          // Refus VISIBLE (modale) : « personne ne lit le journal » — le maître de quai barre la passerelle.
          else: flowOf([{ type: 'document', title: 'La passerelle du Grimm', text: 'Le maître de quai croise les bras devant la passerelle. « Pas d’appareillage sans l’ordre du baron Köhler, capitaine. Voyez-le d’abord. »' }]),
        },
      },
    }),
  ],
  dialogues: [
    {
      id: 'dlg-kohler', start: 'k1',
      nodes: [
        {
          id: 'k1', speaker: 'Baron Ludolf Köhler',
          text:
            "« Capitaine. Le Grimm est vôtre pour cette traversée — porter à Erengrad une cargaison " +
            "d'armes, en rapporter de la laine kislevite avant les glaces. Voici votre lettre de mission, et " +
            "une avance de 40 couronnes. Dame Kramer voyage avec vous : sa cargaison, sa cabine, son contrat. " +
            "Les trois pièces du Grimm sont servies, soutes garnies de poudre et de boulets pour la traversée ; " +
            "mais le fond de cale est avitaillé au minimum — le chandelier du quai vous vendra l'eau et les vivres du voyage. »",
          choices: [
            {
              text: 'Accepter la commission (40 CO, le Grimm à quai)',
              when: { kind: 'flag', expr: '!ls_commission_acceptee' },
              flow: flowOf([
                { type: 'giveMoney', gold: 40 },
                // saboteurDR: -2 [maison] — le sabotage discret de l'affréteuse Kramer pèse sur les Tests
                // d'équipage de COMBAT dès le départ (MDG 14 l.45-47), posé par cette MÊME commission qui
                // embarque Kramer à bord. Levé au démasquage (nuit du chat) via `adjustVessel { saboteurDR: 0 }`.
                // crew : roster SALARIÉ d'un petit caboteur (paie hebdo `tickCampaignVesselWeek`, `crew-roles.json`). #216
                {
                  type: 'setVessel', vehicleId: 'loup-imperial', name: 'Le Grimm',
                  morale: 75, hullCurrent: 180, hullMax: 180, saboteurDR: -2, waterLitres: GRIMM_WATER_LITRES,
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
                OBJ('Livrer le fret de Dame Kramer à Erengrad avant les glaces.'),
                { type: 'journal', text: 'Le Grimm est à vous. 43 âmes à bord sur 50 — un sous-effectif visible dès le départ, et une avance qui ne couvre pas le carénage.' },
              ]),
              next: 'k1',
            },
            {
              text: 'Lui demander de financer le carénage (60 CO)',
              next: 'k-careene',
            },
            {
              text: 'Prendre congé',
              when: { kind: 'flag', expr: 'ls_commission_acceptee' },
              flow: flowOf([{ type: 'endDialogue' }]),
            },
          ],
        },
        {
          id: 'k-careene', speaker: 'Baron Ludolf Köhler',
          text: '« L’avance de 40 couronnes est tout ce que la Seconde Flotte peut avancer, capitaine. Le reste sort de votre poche — ou vous partez sale, et vous traînerez la salissure dans chaque manœuvre. »',
          choices: [{ text: 'Revenir à la commission', next: 'k1' }],
        },
      ],
    },
    {
      id: 'dlg-aldo', start: 'a1',
      nodes: [
        {
          id: 'a1', speaker: 'Frère Aldo',
          text:
            "« Un navire qui appareille sans la bénédiction de Manann navigue nu, capitaine. Un petit sacrifice, " +
            "et je bénis la coque. »",
          choices: [
            {
              // Aldo est prêtre initié et sans Point de Péché (texte de présentation) — sa propre bénédiction,
              // sans offrande du capitaine, mappe sur le facteur « prêtre à bord sans péché » (sea-events.json
              // id `pretre-sans-peche`).
              text: 'Demander la bénédiction du navire',
              flow: flowOf([
                { type: 'adjustManann', factorId: 'pretre-sans-peche' },
                { type: 'setFlag', flag: 'ls_benediction_aldo' },
              ]),
              next: 'a-benediction',
            },
            {
              text: 'Faire un petit sacrifice (une pièce jetée à la mer)',
              flow: flowOf([{ type: 'giveMoney', gold: -1 }, { type: 'adjustManann', factorId: 'petit-sacrifice' }]),
              next: 'a-petit',
            },
            {
              text: 'Faire un sacrifice moyen (une gemme de votre bourse)',
              flow: flowOf([{ type: 'giveMoney', gold: -20 }, { type: 'adjustManann', factorId: 'sacrifice-moyen' }]),
              next: 'a-moyen',
            },
            {
              text: 'Faire un grand sacrifice (une vache entière, la moitié des provisions)',
              flow: flowOf([{ type: 'giveMoney', gold: -50 }, { type: 'adjustManann', factorId: 'grand-sacrifice' }]),
              next: 'a-grand',
            },
            { text: 'Lui demander l’origine de son ordre', next: 'a-origine' },
            { text: 'Le saluer', flow: flowOf([{ type: 'endDialogue' }]) },
          ],
        },
        {
          id: 'a-benediction', speaker: 'Frère Aldo',
          text: 'Frère Aldo asperge la proue d’eau de mer et prie Manann à voix basse. L’équipage se signe. « La coque est bénie, capitaine. Manann veille. »',
          choices: [{ text: 'Le remercier', next: 'a1' }],
        },
        {
          id: 'a-petit', speaker: 'Frère Aldo',
          text: 'Une pièce tombe dans l’écume. Aldo hoche la tête, satisfait. « Manann prend note, capitaine. »',
          choices: [{ text: 'Revenir', next: 'a1' }],
        },
        {
          id: 'a-moyen', speaker: 'Frère Aldo',
          text: 'La gemme disparaît sous les vagues. « Un sacrifice qui compte, capitaine. Manann s’en souviendra. »',
          choices: [{ text: 'Revenir', next: 'a1' }],
        },
        {
          id: 'a-grand', speaker: 'Frère Aldo',
          text: 'La vache est jetée par-dessus bord avec la moitié des provisions. L’équipage retient son souffle — puis Aldo sourit. « Manann ne vous oubliera pas. »',
          choices: [{ text: 'Revenir', next: 'a1' }],
        },
        {
          id: 'a-origine', speaker: 'Frère Aldo',
          text: '« J’ai prêché sur tous les quais de la Mer des Griffes, capitaine. Je connais le Requin — Stromfels, le dieu des naufrageurs — mieux que je ne le voudrais. On ne le paie pas : on le nourrit. »',
          choices: [{ text: 'Revenir', next: 'a1' }],
        },
      ],
    },
    {
      id: 'dlg-kramer', start: 'kr1',
      nodes: [
        {
          id: 'kr1', speaker: 'Dame Vasilika Kramer',
          text:
            "« Ma cargaison est dans la cale, capitaine, et j'entends qu'elle y reste jusqu'à Erengrad. »",
          choices: [
            { text: 'S’enquérir du fret', next: 'kr-fret' },
            {
              text: 'L’observer discrètement (Intuition)',
              flow: testNode(
                { skill: 'intuition', difficulty: 'difficile', label: 'Intuition — quelque chose cloche chez Kramer' },
                // Révélation VISIBLE au moment (modale document) + flag + archive au journal.
                [
                  { type: 'setFlag', flag: 'ls_kramer_soupconnee' },
                  { type: 'document', title: 'Votre intuition', text: 'Un éclair de calcul froid passe dans le regard de Dame Kramer, vite maîtrisé. Cette femme cache quelque chose — et ce n’est pas une simple affaire de fret.' },
                  { type: 'journal', text: 'Intuition : Dame Kramer cache quelque chose.' },
                ],
                [{ type: 'document', title: 'Votre intuition', text: 'Rien ne transparaît — une négociante comme une autre, en apparence.' }],
              ),
              next: 'kr1',
            },
            { text: 'La laisser à ses affaires', flow: flowOf([{ type: 'endDialogue' }]) },
          ],
        },
        {
          id: 'kr-fret', speaker: 'Dame Vasilika Kramer',
          text: '« Des étoffes, des piécettes d’ambre. Rien qui vous regarde, capitaine. »',
          choices: [{ text: 'Revenir', next: 'kr1' }],
        },
      ],
    },
    {
      id: 'dlg-griet', start: 'g1',
      nodes: [
        {
          id: 'g1', speaker: 'Griet',
          text: "« Une chanson pour la route, capitaine ? »",
          choices: [
            // Après écoute, le choix ne reboucle plus à l'identique : la réplique change (flag ls_chant_griet).
            { text: 'Écouter sa chanson', when: { kind: 'flag', expr: '!ls_chant_griet' }, flow: flowOf([{ type: 'setFlag', flag: 'ls_chant_griet' }]), next: 'g-chant' },
            { text: 'Lui demander un autre air', when: { kind: 'flag', expr: 'ls_chant_griet' }, next: 'g-chant-encore' },
            { text: 'La saluer', flow: flowOf([{ type: 'endDialogue' }]) },
          ],
        },
        {
          id: 'g-chant', speaker: 'Griet',
          // Narration VISIBLE : le refrain répond (le vrai effet « Camarades d'équipage »/« Jacques Bret »
          // est un buff de DR de COMBAT — inexprimable à quai, cf. journal d'authoring).
          text: 'Griet entonne « Jacques Bret a rencontré notre acier ». Le refrain court de bouche en bouche ; les gabiers tapent du pied sur le pont et reprennent en chœur.',
          choices: [{ text: 'Applaudir', next: 'g1' }],
        },
        {
          id: 'g-chant-encore', speaker: 'Griet',
          text: '« Toujours la même rengaine ? » Elle rit et enchaîne une complainte plus douce, pour ceux qui restent à quai.',
          choices: [{ text: 'La saluer', next: 'g1' }],
        },
      ],
    },
  ],
  entryPoints: { retour: { x: 2, y: 4 } },
}));

// ════════════════════════════════════════════════════════════════════════════════════════════
// Scène 1 — L'aller : la Dent de Manann (combat naval d'artillerie, Acte I scène 1.3)
// ════════════════════════════════════════════════════════════════════════════════════════════
resetIds();
scenes.push(scene({
  id: 'ls-abordage-cogue',
  nom: 'La Dent de Manann — voile noire sous le vent (J4)',
  description:
    "La cogue pirate intercepte le Grimm en haute mer. Sommation RAW complète (MDG 15 l.171-173) : fouille " +
    "de cale et pillage, PUIS un prisonnier à sacrifier à Stromfels. Frère Aldo nomme l'ennemi à voix haute.",
  weather: 'brouillard',
  base: 'eau',
  legend: { '=': 'planches' },
  // COUCHE MER (10 m/case, MDG ch.13 l.362 : 1 point de Distance = 10 m → 1 case ; portées 50/75/150 m = 5/7,5/15
  // cases). Le combat se joue en NAVIRE-UNITÉ (équipage passager, tour de coque, Bordée) : l'IA de coque
  // (`runShipAI`) manœuvre la Dent de Manann pour aligner sa bordée puis fait feu ; le joueur joue le tour du Grimm.
  // Les coques s'ouvrent à ~150 m (15 cases) : l'approche se JOUE sur plusieurs Rounds.
  metresPerTile: 10,
  rows: seaRows(24, 14, []),
  entities: [
    hero(3, 7),
    hull('grimm', 'loup-imperial', 3, 7, 'E', 'Le Grimm', ['aldo-crew', 'griet-crew'],
      [armedPoste('canon-moyen', 'tribord', [{ ref: 'boulet-et-poudre', qty: 12 }, { ref: 'mitraille-et-poudre', qty: 4 }]),
       armedPoste('canon-moyen', 'babord', [{ ref: 'boulet-et-poudre', qty: 12 }, { ref: 'mitraille-et-poudre', qty: 4 }]),
       armedPoste('pierrier', 'proue', [{ ref: 'balles-et-poudre-pierrier', qty: 16 }])]),
    marinDuGrimm('aldo-crew', 3, 6, 'Frère Aldo (équipage exposé)', HELM_SKILLS),
    marinDuGrimm('griet-crew', 3, 8, 'Griet (équipage exposé)', GUN_SKILLS),
    // Dent de Manann — passagers : les pirates + le chef (hors ordre/rendu à la Mer) ET des marins représentants
    // compétents (barreur/canonnier) pour que la coque manœuvre et fasse feu. Deux bordées + chasse de proue.
    hull('cogue', 'cogue', 18, 7, 'O', 'La Dent de Manann', ['pirate-1', 'pirate-2', 'chef-cogue', 'cogue-helm', 'cogue-gun'],
      [armedPoste('canon-moyen', 'tribord', [{ ref: 'boulet-et-poudre', qty: 12 }]),
       armedPoste('canon-moyen', 'babord', [{ ref: 'boulet-et-poudre', qty: 12 }]),
       armedPoste('canon-moyen', 'proue', [{ ref: 'boulet-et-poudre', qty: 8 }])]),
    { id: 'pirate-1', kind: 'personnage', ref: 'pirate-fluvial', pos: { x: 18, y: 6 }, label: 'Pirate' },
    { id: 'pirate-2', kind: 'personnage', ref: 'pirate-fluvial', pos: { x: 18, y: 8 }, label: 'Pirate' },
    { id: 'chef-cogue', kind: 'personnage', ref: 'chef-pirate', pos: { x: 19, y: 7 }, label: 'Le chef de la Dent de Manann' },
    marinDuGrimm('cogue-helm', 18, 5, 'Barreur de la Dent de Manann', HELM_SKILLS),
    marinDuGrimm('cogue-gun', 18, 9, 'Canonnier de la Dent de Manann', GUN_SKILLS),
  ],
  encounters: [
    {
      id: 'enc-cogue',
      // Surprise NAVALE → avantage de POSITION (couche Mer : pas d'État Surpris sur une coque) : si la vigie n'a
      // pas repéré la voile (Perception ratée → `noSurprise:false`), la Dent de Manann surgit plus PRÈS, bordée
      // déjà alignée (`applyNavalSurprisePosition`). Repérée → placement authoré (~150 m, aucun avantage).
      surprise: 'party',
      // Reddition à mi-coque (#215) : la Dent de Manann amène son pavillon quand la coque `cogue` tombe
      // sous 50 % de ses Blessures — la victoire se déclenche à la reddition, pas au naufrage.
      victoryCondition: { type: 'woundsThreshold', targetId: 'cogue', belowPercent: 50 },
      members: [
        { entityId: 'grimm', side: 'ally' },
        { entityId: 'aldo-crew', side: 'ally' },
        { entityId: 'griet-crew', side: 'ally' },
        { entityId: 'cogue', side: 'enemy' },
        { entityId: 'pirate-1', side: 'enemy' },
        { entityId: 'pirate-2', side: 'enemy' },
        { entityId: 'chef-cogue', side: 'enemy' },
        { entityId: 'cogue-helm', side: 'enemy' },
        { entityId: 'cogue-gun', side: 'enemy' },
      ],
      onVictory: flowOf([
        { type: 'setFlag', flag: 'ls_cogue_vaincue' },
        { type: 'giveXp', amount: 150 },
        { type: 'giveMoney', gold: 15 },
        OBJ('Rallier Erengrad avec le fret — la Dent de Manann écartée.'),
        { type: 'journal', text: 'La Dent de Manann amène son pavillon à mi-coque — la cogue se rend. Des épaves flottent : Séquestre à faire valoir à quai.' },
        // Pas de transition en dur : l'abordage n'est qu'une INTERRUPTION de la traversée. Le combat gagné,
        // le voyage REPREND (bouton carte « voyage interrompu ») vers SA destination (Erengrad) — accostage
        // naturel (relâche à terre, événement de port). Le sens du trajet décide de la destination, jamais l'ennemi.
      ]),
    },
  ],
  entryPoints: { arrivee: { x: 3, y: 7 } },
}));

// ════════════════════════════════════════════════════════════════════════════════════════════
// Scène 2 — Erengrad, l'escale (Acte II)
// ════════════════════════════════════════════════════════════════════════════════════════════
resetIds();
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
  // Objectif d'acte II posé à l'ARRIVÉE (premier pas sur le quai — `checkTriggers` sur le rect de scène).
  // Le même pas pose `ls_fret_livre` : le fret d'armes de Köhler EST livré en atteignant Erengrad — flag
  // qui gâche (gate) l'épilogue de retour à Salzenmund (« l'épilogue n'arrive qu'après la livraison »).
  triggers: [
    { id: 'obj-erengrad', rect: { x: 0, y: 0, w: 16, h: 8 }, once: true, flow: flowOf([
      { type: 'setFlag', flag: 'ls_fret_livre' },
      OBJ('Vendre la laine kislevite et découvrir qui en veut à la cargaison.'),
    ]) },
  ],
  entities: [
    hero(2, 4),
    NPC('docker', 7, 3, 'Docker du port', { facing: 'S', dialogueId: 'dlg-rumeur-olg', appearance: { species: 'humains-reiklander', tenue: 'debardeur', sex: 'M', build: 0.6, seed: 8830 } }),
    NPC('kramer-erengrad', 11, 3, 'Dame Vasilika Kramer', { facing: 'S', dialogueId: 'dlg-kramer-nuit-du-chat', appearance: KRAMER_APPEARANCE }),
    NPC('charpentier', 9, 6, 'Charpentier de bord', { facing: 'N', dialogueId: 'dlg-reparation', appearance: { species: 'humains-reiklander', tenue: 'artisan', sex: 'M', build: 0.6, seed: 3312 } }),
    P(2, 7, undefined, {
      label: 'Reprendre la mer vers Salzenmund',
      interact: { flow: flowOf([OBJ('Ramener le Grimm et sa cargaison à Salzenmund.'), { type: 'openWorldMap' }]) },
    }),
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
            text: 'L’interroger sur sa nuit (Intuition)',
            flow: testNode(
              { skill: 'intuition', difficulty: 'difficile', label: 'Intuition — la nuit du chat' },
              // Démasquage : dénouement VISIBLE (document) + le sabotage CESSE (adjustVessel { saboteurDR: 0 }
              // — patch INCRÉMENTAL, la coque/l'Humeur/le Moral accumulés depuis le départ sont préservés, #233).
              [
                { type: 'setFlag', flag: 'ls_kramer_demasquee' },
                { type: 'adjustVessel', saboteurDR: 0 },
                { type: 'document', title: 'Kramer démasquée', text: 'Elle craque. Ce n’est pas une négociante de Kislev, mais une initiée de Stromfels — c’est elle qui minait le Grimm depuis Salzenmund. Prise à découvert, elle n’a plus les mains libres : ses manigances cessent. L’équipage gronde.' },
                { type: 'journal', text: 'Dame Kramer démasquée : initiée de Stromfels, saboteuse. Le sabotage cesse.' },
              ],
              [{ type: 'document', title: 'La nuit du chat', text: '« Une insomnie de plus, capitaine. La traversée est éprouvante pour tous. »' }],
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
resetIds();
scenes.push(scene({
  id: 'ls-abordage-olg',
  nom: 'Rames dans l’eau ! — le Serpent-de-Sel attaque (banc de Norden, J10-J11)',
  description:
    "Au petit matin, le langskip d'Olg Blóðsalt fond sur le Grimm chargé de laine. Poursuite, feu de chasse, " +
    "collision, abordage — le morceau de bravoure de la traversée.",
  weather: 'tempete',
  base: 'eau',
  legend: { '=': 'planches' },
  // COUCHE MER (10 m/case) : duel de coques NAVIRE-UNITÉ. Le langskip d'Olg (rapide, M6 aux avirons) FOND sur le
  // Grimm : l'IA de coque (`runShipAI`) ferme la distance et lâche ses bordées ; le joueur joue le tour du Grimm.
  // Poursuite, feu de chasse et collision (éperonnage) se jouent en Distance-points (1 case = 10 m). Cf. scène 1.
  metresPerTile: 10,
  rows: seaRows(24, 14, []),
  entities: [
    hero(3, 7),
    hull('grimm2', 'loup-imperial', 3, 7, 'E', 'Le Grimm', ['aldo-crew-2', 'griet-crew-2'],
      [armedPoste('canon-moyen', 'tribord', [{ ref: 'boulet-et-poudre', qty: 12 }, { ref: 'mitraille-et-poudre', qty: 4 }]),
       armedPoste('canon-moyen', 'babord', [{ ref: 'boulet-et-poudre', qty: 12 }, { ref: 'mitraille-et-poudre', qty: 4 }]),
       armedPoste('pierrier', 'poupe', [{ ref: 'balles-et-poudre-pierrier', qty: 16 }])]),
    marinDuGrimm('aldo-crew-2', 3, 6, 'Frère Aldo (équipage exposé)', HELM_SKILLS),
    marinDuGrimm('griet-crew-2', 3, 8, 'Griet (équipage exposé)', GUN_SKILLS),
    // Le Serpent-de-Sel : Proue-idole de Stromfels (amélioration d'INSTANCE, #221) + Bélier de proue par sa
    // culture d'abordage. Passagers : les Norses + Olg (hors ordre/rendu) ET des marins représentants compétents.
    hull('serpent-de-sel', 'langskip', 18, 7, 'O', 'Le Serpent-de-Sel', ['norse-1', 'norse-2', 'olg', 'serpent-helm', 'serpent-gun'],
      [armedPoste('canon-moyen', 'tribord', [{ ref: 'boulet-et-poudre', qty: 10 }]),
       armedPoste('canon-moyen', 'babord', [{ ref: 'boulet-et-poudre', qty: 10 }]),
       armedPoste('canon-moyen', 'proue', [{ ref: 'boulet-et-poudre', qty: 8 }])],
      [{ id: 'proue-idole-de-stromfels' }]),
    { id: 'norse-1', kind: 'personnage', ref: 'maraudeur-du-chaos', pos: { x: 18, y: 6 }, label: 'Norse' },
    { id: 'norse-2', kind: 'personnage', ref: 'maraudeur-du-chaos', pos: { x: 18, y: 8 }, label: 'Norse' },
    { id: 'olg', kind: 'personnage', ref: 'olg-blodsalt', pos: { x: 19, y: 7 }, label: 'Olg Blóðsalt', weapon: 'hache-d-armes' },
    marinDuGrimm('serpent-helm', 18, 5, 'Barreur du Serpent-de-Sel', HELM_SKILLS),
    marinDuGrimm('serpent-gun', 18, 9, 'Canonnier du Serpent-de-Sel', GUN_SKILLS),
  ],
  encounters: [
    {
      id: 'enc-olg',
      // Surprise navale = avantage de POSITION (couche Mer, cf. scène 1) : Perception ratée → le langskip surgit
      // plus près, bordée alignée ; repéré → ~150 m sans avantage.
      surprise: 'party',
      // Reddition à mi-coque (#215), comme la Dent de Manann : le Serpent-de-Sel amène son pavillon quand
      // la coque `serpent-de-sel` tombe sous 50 % de ses Blessures — la victoire = la reddition (texte VRAI),
      // pas le naufrage. `targetId` référence la coque ENNEMIE réelle enrôlée dans cette scène.
      victoryCondition: { type: 'woundsThreshold', targetId: 'serpent-de-sel', belowPercent: 50 },
      members: [
        { entityId: 'grimm2', side: 'ally' },
        { entityId: 'aldo-crew-2', side: 'ally' },
        { entityId: 'griet-crew-2', side: 'ally' },
        { entityId: 'serpent-de-sel', side: 'enemy' },
        { entityId: 'norse-1', side: 'enemy' },
        { entityId: 'norse-2', side: 'enemy' },
        { entityId: 'olg', side: 'enemy' },
        { entityId: 'serpent-helm', side: 'enemy' },
        { entityId: 'serpent-gun', side: 'enemy' },
      ],
      threat: { camp: 'enemies', tier: 'dangereuse' },
      onVictory: flowOf([
        { type: 'setFlag', flag: 'ls_olg_vaincu' },
        { type: 'giveXp', amount: 250 },
        { type: 'giveMoney', gold: 40 },
        { type: 'journal', text: 'Olg Blóðsalt tombe. Le Serpent-de-Sel amène pavillon — la prise à armer, ~40 survivants à répartir sur deux coques.' },
        // Pas de transition en dur : l'abordage n'INTERROMPT que la traversée. Le voyage REPREND vers SA
        // destination (Salzenmund) et accoste ; l'épilogue se joue à l'ARRIVÉE au quai, gaté par la livraison
        // du fret (`ls_fret_livre`, trigger de `ls-quai-salzenmund`) — jamais court-circuité par l'aller.
      ]),
    },
  ],
  entryPoints: { arrivee: { x: 3, y: 7 } },
}));

// ════════════════════════════════════════════════════════════════════════════════════════════
// Scène 4 — Salzenmund, l'épilogue (J13)
// ════════════════════════════════════════════════════════════════════════════════════════════
resetIds();
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
    NPC('kohler-epilogue', 6, 3, 'Baron Ludolf Köhler', { facing: 'S', dialogueId: 'dlg-epilogue', appearance: KOHLER_APPEARANCE }),
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
              { type: 'clearObjective' }, // fin d'acte : la pile d'objectifs de la campagne est vidée
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
      // `temple` : `naval-ports.json#salzenmund.desc` (RAW MDG p.138) — « Grand Temple d'Ulric et temple de
      // Manann Resplendissant » — Frère Aldo (NPC de la scène) l'incarne (bénédiction du départ, #360).
      services: [{ kind: 'auberge' }, { kind: 'forgeron' }, { kind: 'temple' }],
      // POI (#345 phase 5, densifié #360) : onglet Plan du hub — services réels du quai, cliquables sur le plan.
      poi: [
        { id: 'salzenmund-auberge', label: 'Auberge du Port', pos: { x: 30, y: 45 }, serviceKind: 'auberge' },
        { id: 'salzenmund-forgeron', label: 'Arsenal du Port', pos: { x: 62, y: 60 }, serviceKind: 'forgeron' },
        { id: 'salzenmund-temple', label: 'Temple de Manann', pos: { x: 48, y: 30 }, serviceKind: 'temple' },
        { id: 'salzenmund-port', label: 'Le port', pos: { x: 15, y: 70 }, serviceKind: 'port' },
      ],
    },
    {
      id: 'erengrad', label: 'Erengrad', pos: { x: 78, y: 20 }, scene: 'ls-quai-erengrad', icon: 'scenario/port',
      port: { ref: 'erengrad' }, // #217
      // `guilde` : la guilde marchande d'Erengrad (dlg-rumeur-olg, prime sur Olg Blóðsalt) ; `chantier` :
      // `naval-ports.json#erengrad.surplus` (RAW MDG p.138) — surplus « pièces détachées de navire » —
      // le Charpentier de bord (NPC de la scène, réparation du Grimm) l'incarne (#360).
      services: [{ kind: 'auberge' }, { kind: 'guilde' }, { kind: 'chantier' }],
      poi: [
        { id: 'erengrad-auberge', label: 'Auberge du Quai', pos: { x: 40, y: 50 }, serviceKind: 'auberge' },
        { id: 'erengrad-port', label: 'Le port', pos: { x: 20, y: 70 }, serviceKind: 'port' },
        { id: 'erengrad-guilde', label: 'Guilde marchande', pos: { x: 60, y: 25 }, serviceKind: 'guilde' },
        { id: 'erengrad-chantier', label: 'Chantier naval', pos: { x: 75, y: 55 }, serviceKind: 'chantier' },
      ],
    },
  ],
  routes: [
    {
      // Route de l'ALLER, À SENS UNIQUE (`from: salzenmund`) : elle n'est offerte au clic QUE depuis
      // Salzenmund (`routesFrom`) — le joueur y rencontre DÉTERMINISTEMENT la Dent de Manann, jamais Olg.
      id: 'route-salzenmund-erengrad-aller', from: 'salzenmund',
      a: 'salzenmund', b: 'erengrad', km: 550, modes: ['mer'], sea: true, seaHeading: 'nord',
      ambush: { scene: 'ls-abordage-cogue', encounter: 'enc-cogue' },
    },
    {
      // Route du RETOUR, À SENS UNIQUE (`from: erengrad`) : offerte QUE depuis Erengrad — le retour porte
      // DÉTERMINISTEMENT l'embuscade d'Olg. Deux routes entre les mêmes ports, mais discernables par le SENS :
      // depuis chaque port, une seule est cliquable, donc l'embuscade tirée ne dépend plus du hasard du clic.
      id: 'route-salzenmund-erengrad-retour', from: 'erengrad',
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

// Offre de REPOS par scène (patron `scripts/arene/generate.mjs`) — les quais déclarent le service
// `auberge` (`worldMap.places[].services`) mais `placeServices` dérive son couchage effectif de
// `scene.rest.auberge` (`sceneAubergeOffer`, `worldMap.ts`) : sans cette offre, le panneau auberge du
// hub affiche des prix sans bouton Dormir actionnable (recette 2026-07-12).
const REST_OFFERS = {
  'ls-quai-salzenmund': { auberge: true },
  'ls-quai-erengrad': { auberge: true },
};
for (const s of scenes) if (REST_OFFERS[s.id] !== undefined) s.rest = REST_OFFERS[s.id];

const doc = { schema: 2, scenes, worldMap };
const out = join(dirname(fileURLToPath(import.meta.url)), '../../src/scenes/loup-et-saumure/loup-et-saumure-projet.json');
writeFileSync(out, JSON.stringify(doc, null, 1) + '\n');
console.log(`loup-et-saumure-projet.json : ${scenes.length} scènes, ${worldMap.places.length} lieux, ${worldMap.routes.length} routes.`);
