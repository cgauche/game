/**
 * Outillage d'AUTHORING de CAMPAGNE — helpers purs pour composer un projet (`{ schema, scenes, worldMap }`)
 * partagé par TOUTES les campagnes (Arène, « Le Loup et la Saumure », …). Le JSON commité
 * (`src/scenes/<campagne>/<campagne>-projet.json`) reste la SOURCE CANONIQUE, 100 % éditable dans
 * l'éditeur : ce script n'est qu'un outil d'auteur (itération de layout), PAS un build — ne pas le
 * brancher dans package.json.
 *
 * Lancé via tsx : `scene()` construit un `MapSpec` (format déclaratif) puis appelle `buildScene`
 * (`src/state/mapSpec.ts`) — MÊME compilateur headless-editor que les scénarios `src/scenes/…`. Plus de
 * fabrique de scène divergente : l'ASCII est parsé par `buildScene`, les bâtiments composés par
 * `addBuilding`, les rencontres terse par `buildEncounter`. L'auteur écrit des IDS ; ce fichier ne fait
 * que les VALIDER (fail-fast) — il ne normalise plus aucun libellé (doctrine « labels interdits »).
 */
import { buildScene } from '../../src/state/mapSpec.ts';
import { findCreatureById, findSkillById, findSpellById, findTrappingById, findVehicleById, species as SPECIES_CATALOG } from '../../src/data/index.ts';
import { creatureSpeciesOptions } from '../../src/gameIso/rig/creatures/index.ts';
import { wardrobeKeyResolves } from '../../src/gameIso/rig/parts/career.ts';
import { parseTraitInstance } from '../../src/engine/traits/dispatch.ts';

// ── VALIDATION id-only, à l'AUTHORING ───────────────────────────────────────────────────────
// L'auteur écrit des IDS STABLES (`snotling`, `resistance`, `arc`, `mendiant`) — le libellé est de
// l'AFFICHAGE (multilangue), jamais une clé (CLAUDE.md, encadré id STABLE). Chaque résolveur VALIDE :
// un id valide passe tel quel, TOUT le reste → throw en pointant où trouver les ids (Compendium/
// catalogue). Il ne NORMALISE plus (plus de libellé accepté au chargement). Les pickers de l'éditeur/
// Compendium aident à trouver l'id à la saisie.
// ⚠ `traitInstance`/`parseTraitInstance` (statblocks de créature) ne normalise QUE la clé du trait
// (« Taille » → `taille`) — son `arg` (« Taille (Petite) » → `arg:'Petite'`) reste VERBATIM : sur un
// trait à source FERMÉE (ex. `taille`), écrire directement l'id en minuscule (« Taille (petite) »), pas
// le libellé du livre (#146).

/** `ref` d'entité : id STABLE de bestiaire OU de coque (`vehicles.json`, findVehicleById). Une coque est
 *  un ref d'entité LÉGITIME (naval, MDG ch.13) posé en `enemies[]` terse comme en `entities`. Valide →
 *  passe ; inconnu → throw (chercher au Compendium). */
function creatureId(ref) {
  if (findCreatureById(ref) || findVehicleById(ref)) return ref;
  throw new Error(`campagne : réf introuvable « ${ref} » — ni créature ni véhicule du catalogue (Compendium → Bestiaire / Véhicules).`);
}
/** Compétence : skillId STABLE. Valide → passe ; inconnu → throw. */
function skillId(id) {
  if (findSkillById(id)) return id;
  throw new Error(`campagne : compétence introuvable « ${id} » — attendu un id de skills.json (Compendium → Compétences).`);
}
/** Sort : id STABLE. Valide → passe ; inconnu → throw. */
function spellId(id) {
  if (findSpellById(id)) return id;
  throw new Error(`campagne : sort introuvable « ${id} » — attendu un id de spells.json (Compendium → Sorts).`);
}
// Vocabulaire d'`appearance.species` : ids STABLES de species.json (espèces jouables) ∪ ids de def rig
// (DEF_BY_ID, monstres/races non-jouables). Un LIBELLÉ n'est PAS un id — cf. [[game-ids-internes-libelles-display-multilangue]].
const SPECIES_IDS = new Set(SPECIES_CATALOG.map((s) => s.id));
const RIG_DEF_IDS = new Set(creatureSpeciesOptions().map((o) => o.id));
/** `appearance.species` : id STABLE (species.json OU def rig). Valide → passe ; tout le reste → throw. */
function speciesId(id) {
  if (SPECIES_IDS.has(id) || RIG_DEF_IDS.has(id)) return id;
  throw new Error(
    `campagne : appearance.species introuvable « ${id} » — attendu un id de species.json ` +
      `(${[...SPECIES_IDS].join(', ')}) ou un id de def rig (ex. ${[...RIG_DEF_IDS].slice(0, 8).join(', ')}…).`,
  );
}
/** `appearance.tenue` : id STABLE de garde-robe (tenue ∪ carrière ∪ classe ∪ 'nu'). Valide → passe ;
 *  tout le reste → throw (chercher au Compendium → Carrières / au registre des tenues). */
function tenueId(id) {
  if (wardrobeKeyResolves(id)) return id;
  throw new Error(`campagne : appearance.tenue introuvable « ${id} » — attendu un id de tenue/carrière/classe (Compendium → Carrières).`);
}
/** `weapon` d'entité de scène : `trappingId` STABLE du catalogue d'armes. Valide → passe ; tout le reste
 *  → throw (chercher au Compendium → Objets). */
function weaponId(id) {
  if (findTrappingById(id)) return id;
  throw new Error(`campagne : weapon introuvable « ${id} » — attendu un trappingId du catalogue d'armes (Compendium → Objets).`);
}

/** Chaîne de statbloc/optionnel (« Souffle +15 (Ténèbres) ») → `TraitInstance` structuré ; objet déjà
 *  structuré → inchangé. `parseTraitInstance` est le SEUL parseur libellé→trait (registre `traits.json`). */
const traitInstance = (t) => (typeof t === 'string' ? parseTraitInstance(t) : t);

/** Un ennemi authored terse : VALIDE `ref`/`spells`/`weapon`/`appearance` (ids stables, throw sinon),
 *  parse `optionals`/`statblock.traits` (statblocks). PUR (copie ; ne mute pas les statblocs partagés). */
function normalizeEnemy(e) {
  const out = { ...e };
  if (out.ref) out.ref = creatureId(out.ref);
  if (out.weapon) out.weapon = weaponId(out.weapon);
  if (out.optionals) out.optionals = out.optionals.map(traitInstance);
  if (out.spells) out.spells = out.spells.map(spellId);
  if (out.appearance?.species != null || out.appearance?.tenue != null) out.appearance = validateAppearance(out.appearance);
  if (out.statblock?.traits) out.statblock = { ...out.statblock, traits: out.statblock.traits.map(traitInstance) };
  return out;
}

/** VALIDE `appearance.species`/`appearance.tenue` (ids stables) — copie, throw si un libellé s'y glisse. */
function validateAppearance(app) {
  const out = { ...app };
  if (out.species != null) out.species = speciesId(out.species);
  if (out.tenue != null) out.tenue = tenueId(out.tenue);
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

/** Personnage (PNJ) : apparence/dialogue/marchand via opts. `weapon`/`appearance.species`/`appearance.tenue`
 *  sont VALIDÉS (ids stables, fail-fast). `species`/`tenue` absents = défauts documentés (Humain / garde-robe de race). */
export function NPC(id, x, y, label, opts = {}) {
  const e = { id, kind: 'personnage', pos: { x, y }, label, ...opts };
  if (e.weapon != null) e.weapon = weaponId(e.weapon);
  if (e.appearance != null) e.appearance = validateAppearance(e.appearance);
  return e;
}

export function hero(x, y) {
  return { id: 'start', kind: 'heroStart', pos: { x, y } };
}

let posteSeq = 0;
/** Poste d'artillerie MONTÉ (#222) : émet la forme AUTHORÉE de référence `{ trappingId, uid, side, crewIds }`
 *  — la base (Dégâts/Qualités/Enc/Portée) N'est PAS matérialisée, elle est HYDRATÉE au spawn depuis
 *  `trappingId` (`hydratePoste`, `src/engine/items.ts`). VALIDE `trappingId` : doit être une pièce POSABLE
 *  (trapping à art d'affût `siegeRig`, cf. `siegeEngines`/`findVehicleById` du naval) — sinon throw. `crewIds`
 *  vide par défaut : aucun id de héros n'est connu à l'authoring, le poste est servable en jeu (`serveAtPoste`). */
export function poste(trappingId, side, crewIds = []) {
  const t = findTrappingById(trappingId);
  if (!t?.siegeRig) throw new Error(`campagne : poste « ${trappingId} » — attendu un trappingId de pièce POSABLE (art d'affût siegeRig ; Compendium → Objets, armes de siège).`);
  return { trappingId, uid: `poste-${++posteSeq}`, side, crewIds };
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

/** Statblocks d'AUTEUR conservés VERBATIM du projet Arène v1 (sourcés à leur création). */
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
