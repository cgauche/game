/**
 * Outillage d'AUTHORING de l'Arène — helpers purs pour composer le projet (fabriques
 * d'entités/rencontres/triggers). Le JSON commité (`src/scenes/arene/arene-projet.json`) reste la
 * SOURCE CANONIQUE, 100 % éditable dans l'éditeur : ce script n'est qu'un outil d'auteur (itération de
 * layout), PAS un build — ne pas le brancher dans package.json.
 *
 * Lancé via tsx (`tsx scripts/arene/generate.mjs`) : `scene()` construit un `MapSpec` (format déclaratif)
 * puis appelle `buildScene` (`src/state/mapSpec.ts`) — MÊME compilateur headless-editor que les scénarios
 * `src/scenes/…`. Plus de fabrique de scène divergente : l'ASCII est parsé par `buildScene`, les bâtiments
 * composés par `addBuilding`, les rencontres terse par `buildEncounter`. Ce fichier ne garde QUE la couche
 * de normalisation LIBELLÉ→id (l'auteur écrit des libellés lisibles ; le JSON canonique ne porte que des ids).
 */
import { buildScene } from '../../src/state/mapSpec.ts';
import { findCreature, findCreatureById, findSkill, findSkillById, findSpellById, spells as SPELL_CATALOG, species as SPECIES_CATALOG } from '../../src/data/index.ts';
import { creatureSpeciesOptions } from '../../src/gameIso/rig/creatures/index.ts';
import { parseTraitInstance } from '../../src/engine/traits/dispatch.ts';

// ── Normalisation LIBELLÉ → id STABLE, à l'AUTHORING ────────────────────────────────────────
// L'auteur écrit des LIBELLÉS lisibles (« Snotling », « Résistance ») ; le JSON canonique, lui, ne
// porte QUE des ids stables (`snotling`, `resistance`) — un libellé qui se faufile fait un mannequin
// de repli / un trait mort / une compétence introuvable au runtime. Chaque résolveur est IDEMPOTENT
// (un id déjà résolu passe tel quel) et FAIL-FAST (libellé inconnu → throw, jamais un id deviné).
// Cf. [[game-ids-internes-libelles-display-multilangue]].
// ⚠ `traitInstance`/`parseTraitInstance` (LIGNE suivante) ne normalise QUE la clé du trait (« Taille »
// → `taille`) — son `arg` (« Taille (Petite) » → `arg:'Petite'`) reste VERBATIM, jamais résolu vers
// l'id du registre (`sizes`/`arcaneDomains`/…) : sur un trait à source FERMÉE (ex. `taille`), écrire
// directement l'id en minuscule dans la parenthèse (« Taille (petite) »), pas le libellé du livre
// (#146 : `arene-projet.json` portait `arg:'Petite'` — un libellé pris pour un id, source fermée).

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
// Vocabulaire d'`appearance.species` : ids STABLES de species.json (espèces jouables) ∪ ids de def rig
// (DEF_BY_ID, monstres/races non-jouables). Un LIBELLÉ n'est PAS un id — cf. [[game-ids-internes-libelles-display-multilangue]].
const SPECIES_IDS = new Set(SPECIES_CATALOG.map((s) => s.id));
const SPECIES_ID_BY_LABEL = new Map(SPECIES_CATALOG.map((s) => [s.label, s.id]));
const RIG_DEF_IDS = new Set(creatureSpeciesOptions().map((o) => o.id));
/** `appearance.species` : id STABLE (species.json OU def rig) — IDEMPOTENT (id valide passe tel quel) ;
 *  libellé EXACT de species.json → son id ; tout le reste → throw (jamais un id deviné). */
function speciesId(input) {
  if (SPECIES_IDS.has(input) || RIG_DEF_IDS.has(input)) return input;
  const byLabel = SPECIES_ID_BY_LABEL.get(input);
  if (byLabel) return byLabel;
  throw new Error(
    `arène : appearance.species introuvable « ${input} » — attendu un id de species.json ` +
      `(${[...SPECIES_IDS].join(', ')}) ou un id de def rig (ex. ${[...RIG_DEF_IDS].slice(0, 8).join(', ')}…)`,
  );
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

/** Terrain de sol d'un bâtiment selon son type (sanctuaire de pierre → dalle, sinon plancher de bois). */
function buildingFloor(type) {
  return type === 'chapelle' ? 'dalle' : 'planches';
}

/** Côté CARDINAL (N/S/O/E) du périmètre du `foot` que touche la CASE-porte. La case de porte est sur un
 *  bord FRANC (jamais un coin). `addBuilding` canonise ensuite (S→N du dessous, O→E de gauche). */
function doorSide(foot, door) {
  const { x, y, w, h } = foot;
  if (door.y === y) return 'N'; // bord haut
  if (door.y === y + h - 1) return 'S'; // bord bas
  if (door.x === x) return 'O'; // bord gauche
  if (door.x === x + w - 1) return 'E'; // bord droit
  throw new Error(`porte (${door.x},${door.y}) hors du périmètre de ${JSON.stringify(foot)}`);
}

/** Fabrique de scène : construit un `MapSpec` déclaratif (ASCII → étage z0, bâtiments → `rooms`,
 *  rencontres terse → `encounters`) puis délègue à `buildScene` (compilateur headless-editor). Les
 *  réfs par LIBELLÉ (créatures/compétences/sorts/traits des rencontres et des flows) sont normalisées
 *  en ids stables SUR LE SPEC avant compilation. `hidden` (défaut false = VISIBLE, RAW : le groupe voit
 *  ses adversaires) pose `combat.hiddenUntilCombat` sur les entités enrôlées. */
export function scene({ id, nom, description = '', ambiance = 'exterieur', weather, music, startMessage, rows, base, legend, entities = [], buildings = [], dialogues = [], triggers = [], encounters = [], entryPoints, flags = {} }) {
  const spec = {
    id,
    nom,
    description,
    ambiance,
    size: [rows[0].length, rows.length],
    terrain: base,
    levels: { z0: rows.join('\n') },
    entities, // BRUTS : ids CONSERVÉS (dont `id:'start'` du héros — pas de passage par heroStart).
    // Bâtiments composés : `addBuilding` (toit + périmètre de murs `mur-en-bois` + porte + sol) — même
    // primitive que l'éditeur. La CASE-porte devient le côté cardinal du périmètre (canonisé par addBuilding).
    rooms: buildings.map((b) => ({
      id: b.id, // id d'auteur (`taverne`, `maison-prevot`…) préservé sur le toit
      style: b.type,
      foot: [b.foot.x, b.foot.y, b.foot.w, b.foot.h],
      // `noFloor` : l'auteur PEINT lui-même le sol de l'intérieur dans la grille ASCII (bâtiment
      // tout-en-scène où l'intérieur détaillé — nef de marbre, plancher — doit survivre à `addBuilding`,
      // dont le `floor` écraserait le rect entier). Sinon sol par défaut selon le type.
      ...(b.noFloor ? {} : { floor: buildingFloor(b.type) }),
      wallStructure: 'mur-en-bois',
      ...(b.door ? { door: { x: b.door.x, y: b.door.y, side: doorSide(b.foot, b.door) } } : {}),
      ...(b.label ? { label: b.label } : {}),
    })),
    dialogues,
    triggers,
    // Rencontres terse (`enemies[]`) : les libellés (ref/optionals/spells/statblock.traits) → ids AVANT
    // que `buildScene` n'expanse (via `buildEncounter`) — les entités enrôlées ne portent que des ids.
    encounters: encounters.map((enc) => ({
      ...enc,
      ...(enc.enemies ? { enemies: enc.enemies.map(normalizeEnemy) } : {}),
    })),
    flags,
  };
  if (legend) spec.legend = legend;
  if (weather) spec.weather = weather;
  if (music) spec.music = music;
  if (startMessage) spec.startMessage = startMessage;
  // entryPoints d'auteur `{name:{x,y}}` → `{name:[x,y]}` (forme MapSpec).
  if (entryPoints) spec.entryPoints = Object.fromEntries(Object.entries(entryPoints).map(([k, p]) => [k, [p.x, p.y]]));
  // Compétences/sorts des flows (tests, corruption, learnSpell) → ids : dialogues, triggers, onVictory des
  // rencontres, ET les flows de fouille nichés dans `entities[].interact` (testNode d'un décor piégé).
  normalizeFlowRefs({ dialogues, triggers, entities, encounters: spec.encounters });
  return buildScene(spec);
}

let propSeq = 0;
/** Décor. `extra` : foot / interact / anim / label… L'id est auto (réinitialisé par scène via resetIds). */
export function P(x, y, ref, extra = {}) {
  return { id: `p${propSeq++}`, kind: 'prop', pos: { x, y }, ref, ...extra };
}
export function resetIds() {
  propSeq = 0;
}

/** Personnage (PNJ) : apparence/dialogue/marchand via opts. `appearance.species` (LIBELLÉ lisible
 *  d'auteur) → id STABLE via `speciesId` (fail-fast). `species` absent = défaut Humain (documenté). */
export function NPC(id, x, y, label, opts = {}) {
  const e = { id, kind: 'personnage', pos: { x, y }, label, ...opts };
  if (e.appearance?.species != null) e.appearance = { ...e.appearance, species: speciesId(e.appearance.species) };
  return e;
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
  // `Taille` a `specsSource: sizes` (registre FERMÉ, ids en camelCase) : `parseTraitInstance` ne
  // normalise QUE le nom du trait, jamais son `arg` (#146) — on écrit donc directement l'id ('petite'),
  // pas le libellé du livre ('Petite'), pour ne pas régénérer la dérive libellé-pris-pour-un-id.
  traits: ['Nuée', 'Taille (petite)'],
};
export const DRAGON_DES_TENEBRES = {
  name: 'Dragon des ténèbres',
  char: { M: 6, CC: 55, CT: 45, F: 55, E: 55, I: 50, Ag: 35, Dex: 30, Int: 40, FM: 60, Soc: 40, B: 104 },
  // Taille : id du registre FERMÉ ('monstrueuse'), cf. commentaire NUEE_DE_RATS. Souffle (Ténèbres) reste
  // un descripteur LIBRE (registre `breath-types.json` : Feu/Froid/Corrosif/Électrique/Poison/Fumée
  // seulement — « Ténèbres » n'y figure pas, trait ouvert `specsOpen`, texte verbatim légitime).
  traits: ['Taille (monstrueuse)', 'Souffle +15 (Ténèbres)', 'Terreur 2', 'Armure 5', 'Arme +10', 'Morsure +10', 'Vol'],
  size: 'monstrueuse',
};
