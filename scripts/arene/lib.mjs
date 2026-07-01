/**
 * Outillage d'AUTHORING de l'Arène — helpers purs pour composer le projet (cartes ASCII → tiles,
 * fabriques d'entités/rencontres/triggers). Le JSON commité (`src/scenes/arene/arene-projet.json`)
 * reste la SOURCE CANONIQUE, 100 % éditable dans l'éditeur : ce script n'est qu'un outil d'auteur
 * (itération de layout), PAS un build — ne pas le brancher dans package.json.
 *
 * Lancé via tsx (`tsx scripts/arene/generate.mjs`) pour importer le SEUL `buildEncounter` du moteur
 * (`src/state/encounterAuthoring.ts`) — l'expansion enemies→entités+members n'est PAS dupliquée ici.
 */
import { buildEncounter } from '../../src/state/encounterAuthoring.ts';
import { findCreature, findCreatureById, findSkill, findSkillById, findSpellById, spells as SPELL_CATALOG } from '../../src/data/index.ts';
import { parseTraitInstance } from '../../src/engine/traits/dispatch.ts';

// ── Normalisation LIBELLÉ → id STABLE, à l'AUTHORING ────────────────────────────────────────
// L'auteur écrit des LIBELLÉS lisibles (« Snotling », « Taille (Petite) », « Résistance ») ; le JSON
// canonique, lui, ne porte QUE des ids stables (`snotling`, `{id:'taille',arg:'Petite'}`, `resistance`)
// — un libellé qui se faufile fait un mannequin de repli / un trait mort / une compétence introuvable
// au runtime. Chaque résolveur est IDEMPOTENT (un id déjà résolu passe tel quel) et FAIL-FAST (libellé
// inconnu → throw, jamais un id deviné). Cf. [[game-ids-internes-libelles-display-multilangue]].

/** Apostrophe typographique (U+2019/U+2018/U+02BC) → droite, pour matcher un libellé de catalogue. */
const APOS = (s) => s.normalize('NFC').replace(/[‘’ʼ]/g, "'");

/** `ref` créature : id stable (idempotent). Libellé de bestiaire → son id ; inconnu → throw. */
function creatureId(ref) {
  if (findCreatureById(ref)) return ref;
  const c = findCreature(ref);
  if (!c) throw new Error(`arène : créature introuvable « ${ref} » (ni id ni libellé de bestiaire)`);
  return c.id;
}
/** Compétence : skillId stable (idempotent). Libellé → son id ; inconnu → throw. */
function skillId(label) {
  if (findSkillById(label)) return label;
  const s = findSkill(label);
  if (!s) throw new Error(`arène : compétence introuvable « ${label} »`);
  return s.id;
}
/** Sort : id stable (idempotent). Libellé (apostrophe tolérante) → son id ; inconnu → throw. */
function spellId(label) {
  if (findSpellById(label)) return label;
  const key = APOS(label);
  const sp = SPELL_CATALOG.find((s) => APOS(s.label) === key);
  if (!sp) throw new Error(`arène : sort introuvable « ${label} »`);
  return sp.id;
}
/** Chaîne de statbloc/optionnel (« Souffle +15 (Ténèbres) ») → `TraitInstance` structuré ; objet déjà
 *  structuré → inchangé. `parseTraitInstance` est le SEUL parseur libellé→trait (registre `traits.json`). */
const traitInstance = (t) => (typeof t === 'string' ? parseTraitInstance(t) : t);

/** Un ennemi authored terse : `ref`/`optionals`/`spells`/`statblock.traits` par libellé → ids stables.
 *  PUR (renvoie une copie ; ne mute pas les statblocs-constantes partagés). */
function normalizeEnemy(e) {
  const out = { ...e };
  if (out.ref) out.ref = creatureId(out.ref);
  if (out.optionals) out.optionals = out.optionals.map(traitInstance);
  if (out.spells) out.spells = out.spells.map(spellId);
  if (out.statblock?.traits) out.statblock = { ...out.statblock, traits: out.statblock.traits.map(traitInstance) };
  return out;
}

/** Normalise EN PLACE les réfs par libellé nichées dans les flows d'une scène : `FlowTest.skill`
 *  (et l'`attackerSkill` d'un test opposé), `corruptionExposure.skill`, `learnSpell.spell`. Ne touche
 *  QUE les valeurs STRING (un `medicalAid.skill: 55` numérique reste intact). Balayage récursif unique. */
function normalizeFlowRefs(node) {
  if (Array.isArray(node)) { node.forEach(normalizeFlowRefs); return; }
  if (!node || typeof node !== 'object') return;
  if (typeof node.skill === 'string') node.skill = skillId(node.skill);
  if (typeof node.attackerSkill === 'string') node.attackerSkill = skillId(node.attackerSkill);
  if (node.type === 'learnSpell' && typeof node.spell === 'string') node.spell = spellId(node.spell);
  for (const v of Object.values(node)) normalizeFlowRefs(v);
}

/** Légende ASCII commune (complétée/surchargée par scène via `legend`). `.` = sol de base. */
const BASE_LEGEND = {
  '#': 'mur',
  '~': 'eau',
  D: 'porte',
  _: 'fosse',
  '=': 'planches',
};

/** Parse une carte ASCII (1 char = 1 tuile) → { w, h, tiles }. `base` = terrain du '.' (et de l'espace). */
export function parseRows(rows, base, legend = {}) {
  const w = rows[0].length;
  const lg = { ...BASE_LEGEND, ...legend };
  const tiles = [];
  for (const [y, row] of rows.entries()) {
    if (row.length !== w) throw new Error(`ligne ${y} : largeur ${row.length} ≠ ${w}`);
    for (const ch of row) {
      if (ch === '.' || ch === ' ') tiles.push(base);
      else if (lg[ch]) tiles.push(lg[ch]);
      else throw new Error(`char inconnu « ${ch} » (ligne ${y})`);
    }
  }
  return { w, h: rows.length, tiles };
}

/** Fabrique de scène : carte ASCII + le reste, avec défauts sûrs et ids vérifiés uniques. Les
 *  rencontres authored terse (`enemies[]`) sont expansées en entités + members par `buildEncounter`
 *  (moteur), à l'AUTHORING — plus aucune migration au chargement. `hidden` (défaut false = VISIBLE,
 *  RAW : le groupe voit ses adversaires) pose `combat.hiddenUntilCombat`. */
export function scene({ id, nom, description = '', ambiance = 'exterieur', weather, music, startMessage, rows, base, legend, entities = [], buildings = [], dialogues = [], triggers = [], encounters = [], entryPoints, flags = {} }) {
  const allEntities = [...entities];
  const outEncounters = encounters.map((enc) => {
    if (!enc.enemies) return enc; // déjà en members (ou rencontre vide)
    // Les ennemis authorés en LIBELLÉS (ref/optionals/spells/statblock.traits) sont résolus en ids
    // AVANT l'expansion → les entités enrôlées ne portent QUE des ids stables.
    const { entities: spawned, encounter } = buildEncounter({ ...enc, enemies: enc.enemies.map(normalizeEnemy) });
    allEntities.push(...spawned);
    return encounter;
  });
  const { w, h, tiles } = parseRows(rows, base, legend);
  for (const list of [allEntities, buildings, triggers, dialogues, outEncounters]) {
    const seen = new Set();
    for (const it of list) {
      if (seen.has(it.id)) throw new Error(`${id} : id dupliqué « ${it.id} »`);
      seen.add(it.id);
    }
  }
  const sc = { id, nom, description, dimensions: { w, h }, ambiance, tiles, entities: allEntities, buildings, dialogues, triggers, encounters: outEncounters, flags };
  if (weather) sc.weather = weather;
  if (music) sc.music = music;
  if (startMessage) sc.startMessage = startMessage;
  if (entryPoints) sc.entryPoints = entryPoints;
  normalizeFlowRefs(sc); // compétences/sorts des flows (tests, corruption, learnSpell) → ids stables
  return sc;
}

let propSeq = 0;
/** Décor. `extra` : foot / interact / anim / label… L'id est auto (réinitialisé par scène via resetIds). */
export function P(x, y, ref, extra = {}) {
  return { id: `p${propSeq++}`, kind: 'prop', pos: { x, y }, ref, ...extra };
}
export function resetIds() {
  propSeq = 0;
}

/** Personnage (PNJ) : apparence/dialogue/marchand via opts. */
export function NPC(id, x, y, label, opts = {}) {
  return { id, kind: 'personnage', pos: { x, y }, label, ...opts };
}

export function hero(x, y) {
  return { id: 'start', kind: 'heroStart', pos: { x, y } };
}

/** Flow PLAT (séquence de `do`) à partir d'une liste d'Effets — forme attendue par `Trigger.flow`. */
export function flowOf(effects) {
  return { kind: 'seq', steps: effects.map((effect) => ({ kind: 'do', effect })) };
}
/** Condition d'entrée de flag (`Trigger.when`) à partir d'une expr « flag,!flag ». */
export function flagWhen(expr) {
  return { kind: 'flag', expr };
}
/** Nœud Flow `test` (jet de compétence → RÉUSSITE/ÉCHEC) ; `success`/`fail` = listes d'Effets (→ flowOf).
 *  Remplace l'ancien `Effect.test` à brancher dans un flow (un test n'est PAS une feuille `do`). */
export function testNode(test, success = [], fail = []) {
  return { kind: 'test', test, success: flowOf(success), fail: flowOf(fail) };
}

/** Trigger de combat standard (une fois) : entrer dans le rect lance la rencontre. */
export function fightTrigger(encounter, rect, extra = {}) {
  return { id: `fight-${encounter}`, rect, once: true, flow: flowOf([{ type: 'startCombat', encounter }]), ...extra };
}

/** onVictory standard d'une zone de l'échelle : bourse + PX + flag de porte + retour au Bourg.
 *  ÉCONOMIE : la vie coûte des PISTOLES (repas 1 pa, nuit 10 sb/tête, ration 2 pa) et la plate
 *  complète ~31 CO ; les bourses montent donc de quelques pa (échauffement) à ~10 co (dragon) —
 *  l'équipement lourd se GAGNE sur toute l'échelle, pas au premier combat. XP : ~100 → 450 par
 *  zone (progression de carrière sentie à CHAQUE victoire, pas tous les 3 combats). */
export function zoneVictory(n, { money, xp, journal, extra = [] }) {
  return flowOf([
    { type: 'giveMoney', ...money },
    { type: 'giveXp', amount: xp },
    { type: 'setFlag', flag: `zone${n}_clear` },
    { type: 'journal', text: journal },
    ...extra,
    { type: 'transition', scene: 'arene-hub', entry: 'porte-arene' },
  ]);
}

/** Fouille interactive (décor). Accepte une LISTE d'Effets (butin ramassable, → flowOf) OU un Flow
 *  déjà construit (fouille à risque : `testNode(...)`). `consume` retire le décor une fois pris. */
export function fouille(effectsOrFlow, consume = false) {
  const flow = Array.isArray(effectsOrFlow) ? flowOf(effectsOrFlow) : effectsOrFlow;
  return { interact: { flow, ...(consume ? { consume: true } : {}) } };
}

/** Statblocks d'AUTEUR conservés VERBATIM du projet v1 (sourcés à leur création). */
export const NUEE_DE_RATS = {
  name: 'Nuée de rats',
  char: { M: 4, CC: 30, F: 25, E: 30, Ag: 40, B: 5 },
  traits: ['Nuée', 'Taille (Petite)'],
};
export const DRAGON_DES_TENEBRES = {
  name: 'Dragon des ténèbres',
  char: { M: 6, CC: 55, CT: 45, F: 55, E: 55, I: 50, Ag: 35, Dex: 30, Int: 40, FM: 60, Soc: 40, B: 104 },
  traits: ['Taille (Monstrueuse)', 'Souffle +15 (Ténèbres)', 'Terreur 2', 'Armure 5', 'Arme +10', 'Morsure +10', 'Vol'],
  size: 'monstrueuse',
};
