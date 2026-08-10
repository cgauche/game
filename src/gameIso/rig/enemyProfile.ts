/**
 * Profil de rendu RIG d'un combattant ennemi/PNJ humanoïde — COSMÉTIQUE (l'engine
 * n'en dépend jamais). Transforme un Combatant en (apparence, tenue, équipement,
 * calques de mutation) pour le rendre via le rig au lieu du sprite monolithique.
 *
 * Décisions : voir docs/superpowers/specs/2026-06-05-F1-ennemis-rig-design.md
 */
import type { Combatant, ItemInstance, ArmourPoints, HitLocation } from '../../engine/types';
import type { Appearance, RigSpeciesId } from './appearance';
import type { EquipCtx } from './parts/equipment';
import { equipFromCombatant } from './parts/equipment';
import { emptyArmour } from '../../engine/items';
import { renderWeaponsFromTraits, armourFromTraits, weaponFromId } from '../../engine/creatureEquip';
import type { TraitList } from '../../engine/statEntry';
import { EYE_OPTIONS, eyesArtFromKeys } from './parts/eyes';
import type { MonsterParts } from './parts/monstrous';
import { hashSeed } from '../../engine/dice';
import type { SceneEntity } from '../../state/scene';
import { bipedDef } from './creatures';
import { resolveRender } from './bodyPlan';
import { findCreatureById } from '../../data';
import type { EntityAppearance } from '../../engine/authoringAppearance';
import { raceById } from './races';
import { baseSpeciesOf } from './skeletons';
import { humanSeedColors, humanSeedHairIndex } from './parts/humanVariety';
import { diagOnce, diagSubject } from './devDiag';

export interface EnemyRigProfile {
  appearance: Appearance;
  tenue: string;
  equip: EquipCtx;
}

/** Classe de rendu d'un ID de créature — délègue au résolveur unique `resolveRender` (espèce du
 *  record). 'rig' (humanoïde → rig bipède) ou 'creature' (gabarit quad/ailé/… / nuée). */
export function classifyEnemy(creatureId: string): 'rig' | 'creature' {
  return resolveRender(undefined, findCreatureById(creatureId)?.traits, creatureId).kind === 'plan' ? 'creature' : 'rig';
}

/** Classe de rendu DATA-DRIVEN (de-POC P5) — délègue au résolveur unique `resolveRender` : trait
 *  Nuée ou espèce EXPLICITE (arg/record, lookup exact) ; sans espèce → bipède (rig). */
export function classifyBy(species: string | undefined, traits: import('../../engine/statEntry').TraitList | undefined, id: string | undefined): 'rig' | 'creature' {
  return resolveRender(species, traits, id).kind === 'plan' ? 'creature' : 'rig';
}


// Les défauts d'apparence (tenue / monster / sex / parts / colors / scale) d'un bipède viennent
// désormais de sa RACE (canonique, partagée — cf. `raceById(baseSpeciesOf(species))`), surchargés
// par les éventuelles surcharges propres à la créature (`def.perso`, pour les espèces
// non-canoniques repliées sur une race partagée : Fimir/Géant/Liche/Démonette).

/** Override d'apparence d'AUTHORING → `Partial<Appearance>` : seuls les champs RÉELLEMENT fournis
 *  sortent (yeux clés→art). Les défauts (espèce/sexe/carrure/couleurs) restent au constructeur
 *  `rigAppearance`, qui les tient du record/race — un override muet n'écrase plus rien. */
export interface RiggedOpts {
  monster?: MonsterParts;
  species?: string;
  colors?: import('./palette').Palette;
  parts?: Appearance['parts']; // coiffure/visage épinglés (idx)
  hairstyle?: string; // coiffure IMPOSÉE par id stable (#637) — prime sur parts.cheveux/seed
  sex?: 'M' | 'F'; // surcharge le sexe dérivé du seed
  build?: number; // surcharge la carrure dérivée du seed
  gabarit?: string; // carrure imposée (def créature : Rat ogre → brute-bras-longs)
  /** yeux personnalisés (CLÉS du catalogue EYE_OPTIONS, donnée éditeur) → art résolu ici. */
  eyes?: { G?: string; D?: string };
  features?: string[]; // traits ADDITIFS (clés du catalogue d'éléments)
}
const eyeArt = (k?: string): string | undefined => (k ? EYE_OPTIONS[k]?.art : undefined);
export function riggedAppearance(_name: string, seed: number, opts: RiggedOpts = {}): Partial<Appearance> {
  const eyes = opts.eyes && (eyeArt(opts.eyes.G) || eyeArt(opts.eyes.D))
    ? { ...(eyeArt(opts.eyes.G) ? { G: eyeArt(opts.eyes.G) } : {}), ...(eyeArt(opts.eyes.D) ? { D: eyeArt(opts.eyes.D) } : {}) }
    : undefined;
  return { species: opts.species as RigSpeciesId | undefined, sex: opts.sex, build: opts.build, seed, monster: opts.monster, features: opts.features, colors: opts.colors, parts: opts.parts, hairstyle: opts.hairstyle, gabarit: opts.gabarit, eyes };
}

/** Synthèse d'items d'armure depuis les PA par localisation (matériau via palier) — UNIQUEMENT si
 *  l'apparence de la créature DÉCLARE son armure de statblock PORTÉE (`armurePortee`) [entériné
 *  2026-07-22, #774 : « Les PA ne devrait pas impacté l'apparence, sauf si on le décide »]. Par défaut,
 *  les PA restent mécaniques PURS (PA/zoneBadges/enc lisent `c.armour`/de vrais items) : aucun item
 *  d'art n'est fabriqué. Curation par créature dans `creatures.json` (`appearance.armurePortee`). */
function synthArmour(ap: ArmourPoints, armurePortee: boolean | undefined): ItemInstance[] {
  if (!armurePortee) return [];
  const items: ItemInstance[] = [];
  const piece = (uid: string, name: string, pa: number, locs: HitLocation[]) => {
    items.push({ uid, label: name, kind: 'armor', qualities: [], pa, locs, enc: 0, equipped: true });
  };
  if (ap.corps > 0) piece('syn-corps', 'Protection (corps)', ap.corps, ['corps']);
  if (ap.tete > 0) piece('syn-tete', 'Protection (tête)', ap.tete, ['tete']);
  const bras = Math.max(ap.brasG, ap.brasD);
  if (bras > 0) piece('syn-bras', 'Protection (bras)', bras, ['brasG', 'brasD']);
  const jambes = Math.max(ap.jambeG, ap.jambeD);
  if (jambes > 0) piece('syn-jambes', 'Protection (jambes)', jambes, ['jambeG', 'jambeD']);
  return items;
}

/** Résolution PARTAGÉE (combat ET exploration, IDENTIQUE) : espèce → def bipède canonique + race
 *  (défauts d'apparence partagés) + perso (surcharges d'espèce non-canonique). `species` vient
 *  TOUJOURS de `resolveRender` (résolveur unique) — aucun repli d'espèce ici. */
function bipedBase(species: string) {
  const d = bipedDef(species);
  return { species, d, race: raceById(d?.race ?? baseSpeciesOf(species)), perso: d?.perso };
}

/** Garde-robe PARTAGÉE (id STABLE) : surcharge (carrière / opts) → record créature → perso/race → 'nu'
 *  (l'auteur l'habille). Toutes ces sources portent des IDS de garde-robe (tenue ∪ carrière), jamais un libellé. */
function bipedTenue(override: string | undefined, cd: EntityAppearance | undefined, perso: { tenue?: string } | undefined, race: { tenue?: string }): string {
  return override ?? cd?.tenue ?? perso?.tenue ?? race.tenue ?? 'nu';
}

/** Carrure par défaut dérivée du seed (0.35..0.75) — formule UNIQUE. */
const buildFromSeed = (seed: number): number => +(0.35 + ((Math.floor(seed / 7) % 41) / 100)).toFixed(2);

/**
 * CONSTRUCTEUR UNIQUE de l'apparence rig — combat ET exploration. Une seule précédence par champ :
 * override d'instance → record créature (`cd`) → perso/race → défaut-seed. `override` porte ses YEUX
 * DÉJÀ en art (combat : `c.appearanceOverride` figé au rendu par `riggedAppearance` ; exploration :
 * `opts` pré-résolus par l'appelant).
 */
function rigAppearance(seed: number, base: ReturnType<typeof bipedBase>, cd: EntityAppearance | undefined, override?: Partial<Appearance>): Appearance {
  const { species, d, race, perso } = base;
  const o = override ?? {};
  return {
    species: o.species ?? (species as RigSpeciesId),
    sex: o.sex ?? cd?.sex ?? perso?.sex ?? race.sex ?? (seed % 7 < 2 ? 'F' : 'M'),
    build: o.build ?? cd?.build ?? buildFromSeed(seed),
    seed: o.seed ?? cd?.seed ?? seed,
    monster: o.monster ?? cd?.monster ?? perso?.monster,
    features: o.features ?? cd?.features,
    colors: o.colors ?? cd?.colors ?? perso?.colors ?? race.colors,
    parts: o.parts ?? cd?.parts ?? perso?.parts ?? race.parts,
    hairstyle: o.hairstyle ?? cd?.hairstyle,
    gabarit: o.gabarit ?? perso?.gabarit ?? d?.gabarit,
    eyes: o.eyes ?? eyesArtFromKeys(cd?.eyes) ?? eyesArtFromKeys(perso?.eyes),
  };
}

/**
 * Un combattant rendu depuis SON PROPRE inventaire (personnage-joueur du groupe : apparence dans
 * `c.appearance`, tenue du `career`, armure en `ItemInstance`) — vs par PROFIL SYNTHÉTISÉ du bestiaire/
 * statbloc (`enemyRigProfile` : armure des PA/Traits, tenue du record). Un allié PNJ passe `side:'ally'`
 * → `kind:'hero'` (camp) au combat, mais reste une instance de bestiaire (`creatureId`) ou de statbloc
 * pilotée par l'IA (`aiControlled`) : son armure vit en PA/Traits, jamais en items → il DOIT passer par
 * `enemyRigProfile` pour rendre IDENTIQUEMENT au hors-combat (`entityRigProfile`). Router le rendu sur le
 * camp (`kind`) au lieu de l'ORIGINE écraserait la couche armure des alliés de bestiaire (#181/#182). */
export function rendersFromOwnInventory(c: Combatant): boolean {
  return c.kind === 'hero' && !c.aiControlled && !c.creatureId;
}

/**
 * Profil rig d'un combattant, ou null si non-humanoïde (→ rendu par son gabarit corporel
 * via AnimatedPlanToken, plus aucun sprite monolithique). PURE et déterministe (seed dérivé de l'id).
 */
export function enemyRigProfile(c: Combatant): EnemyRigProfile | null {
  // Résolution de rendu par le résolveur UNIQUE, sur les MÊMES entrées qu'en exploration
  // (`entityRigProfile`) : espèce explicite → espèce du record (par id). Son `species` alimente
  // ensuite `bipedBase` → aucune 2ᵉ précédence d'espèce côté combat.
  const r = resolveRender(c.species, c.traits, c.creatureId);
  if (r.kind === 'plan') return null;

  const seed = hashSeed(c.id);
  const cd = findCreatureById(c.creatureId)?.appearance; // apparence par défaut UNIFIÉE du record créature (par id)
  const bb = bipedBase(r.species); // résolution PARTAGÉE espèce→def/race/perso
  // Override d'authoring (`c.appearanceOverride`) FIGÉ PARESSEUSEMENT ici (#187 : plus au spawn/state) :
  // yeux clés→art. Déterministe (seed dérivé de l'id, `id === SceneEntity.id`), superposé aux défauts
  // de race/record par `rigAppearance` — un champ non authoré n'est PAS porté par l'override.
  const ov = c.appearanceOverride;
  const eseed = ov?.seed ?? seed;
  let override: Partial<Appearance> | undefined = ov
    ? riggedAppearance(c.label, eseed, { species: ov.species, monster: ov.monster, features: ov.features, colors: ov.colors, parts: ov.parts, hairstyle: ov.hairstyle, sex: ov.sex, build: ov.build, eyes: ov.eyes })
    : undefined;
  // Variété seedée des humains GÉNÉRIQUES (#223) : hors bestiaire (pas de creatureId) et sans
  // couleurs/coiffure authorées → teintes/coiffure dérivées du seed (parité explo↔combat). Un
  // record de bestiaire (creatureId) garde son apparence figée → goldens intacts.
  if (!c.creatureId && baseSpeciesOf(bb.species) === 'Humain' && !override?.colors && !override?.parts) {
    override = { ...(override ?? {}), colors: humanSeedColors(eseed), parts: { cheveux: humanSeedHairIndex(eseed) } };
  }
  const appearance = rigAppearance(eseed, bb, cd, override);
  // Tenue DATA-DRIVEN : carrière du Combatant → record → défaut de la def (perso/race) → Nu (l'auteur l'habille).
  const tenue = bipedTenue(c.career, cd, bb.perso, bb.race);

  // Équipement : l'inventaire du combattant prime ; sinon armure synthétisée des PA (visible SEULEMENT
  // si l'apparence la déclare portée — override d'authoring (`c.appearanceOverride.armurePortee`) PRIME
  // sur le record (`cd?.armurePortee`), symétrique de `entityRigProfile` (`opts.armurePortee ?? cd?.armurePortee`,
  // parité #181/#182 : une entité à statbloc SANS record honore SON armurePortee en combat comme en explo).
  const base = equipFromCombatant(c);
  const armour = base.armour.length ? base.armour : synthArmour(c.armour, ov?.armurePortee ?? cd?.armurePortee);
  const equip: EquipCtx = { weapons: base.weapons, armour, shield: base.shield };

  // Calques de mutation = donnée (`combatantOverlays(c.mutations)`, appliqués par AnimatedRigToken),
  // jamais le nom : un mutant déclare son tell via un trait « Mutation (X) » → c.mutations au spawn.
  return { appearance, tenue, equip };
}

/**
 * Profil rig pour une ENTITÉ de scène humanoïde (hors combat) : pas d'équipement de
 * combat (mains libres, pour les poses d'ambiance), apparence dérivée de la réf + seed.
 * null si la réf désigne une créature non-humanoïde.
 */
export function entityRigProfile(
  name: string | undefined,
  seed: number,
  opts?: { species?: string; tenue?: string; monster?: MonsterParts; features?: string[]; weapon?: string; colors?: import('./palette').Palette; parts?: Appearance['parts']; hairstyle?: string; sex?: 'M' | 'F'; build?: number; eyes?: { G?: string; D?: string };
    /** Profil de combat de l'entité (statbloc d'éditeur) → équipement affiché en explo, comme au combat. */
    traits?: TraitList; armour?: number;
    /** Armure de statblock VISIBLE/portée (#774) — override d'authoring (`ent.appearance.armurePortee`)
     *  pour une entité SANS record de bestiaire ; repli sur `cd?.armurePortee` (record) sinon. */
    armurePortee?: boolean;
    /** L'entité est ENRÔLÉE dans une rencontre (membre d'un `EncounterDef`) → c'est un combattant : on
     *  affiche son équipement par défaut DÉRIVÉ du record (parité avec le spawn `creatureToCombatant`),
     *  même sans statbloc. Une entité d'AMBIANCE (non enrôlée, défaut `false`) reste mains libres, quitte
     *  à ce que son record porte un trait « Arme » (un villageois ne dégaine pas pour décorer la scène). */
    enrolled?: boolean;
    /** Variété seedée d'un humain GÉNÉRIQUE (#223) — opt-in réservé au rendu de scène
     *  (`entityRigProfileFor`) ; les goldens appellent SANS → apparence de repli figée. */
    seededVariety?: boolean },
): EnemyRigProfile | null {
  const rec = findCreatureById(name);
  // Résolution d'espèce par la DONNÉE (espèce explicite de l'entité → espèce du record) — IDENTIQUE à
  // resolveById/resolveRender : un record porte son `appearance.species` (ex. « Peau-de-Loup ») qui
  // résout vers son def (sinon repli Humain → perso.head/race du def perdus). `r.species` porte ce résultat.
  const r = resolveRender(opts?.species ?? rec?.appearance?.species, rec?.traits, name);
  if (r.kind === 'plan') return null; // non-humanoïde → gabarit corporel
  const cd = rec?.appearance; // apparence par défaut UNIFIÉE du record créature
  const base = bipedBase(r.species); // espèce RÉSOLUE → def/race/perso corrects
  // Override d'AUTHORING → `Partial<Appearance>` (yeux clés→art) passé au CONSTRUCTEUR UNIQUE `rigAppearance`.
  // Une entité d'ambiance « mutée » déclare ses parts/overlays dans son apparence (monster), pas via le nom.
  const override: Partial<Appearance> = {
    species: opts?.species as RigSpeciesId | undefined, sex: opts?.sex, build: opts?.build, monster: opts?.monster,
    features: opts?.features, colors: opts?.colors, parts: opts?.parts, hairstyle: opts?.hairstyle, eyes: eyesArtFromKeys(opts?.eyes),
  };
  // Variété seedée des humains GÉNÉRIQUES (#223, miroir exact d'`enemyRigProfile`) : opt-in de scène,
  // hors record de bestiaire (`!rec`), sans couleurs/coiffure authorées → dérivées du seed stable.
  if (opts?.seededVariety && r.kind === 'rig' && !rec && baseSpeciesOf(r.species) === 'Humain' && !override.colors && !override.parts) {
    override.colors = humanSeedColors(seed);
    override.parts = { cheveux: humanSeedHairIndex(seed) };
  }
  // Équipement : MÊME dérivation qu'au combat (parité explo↔combat). Précédence des traits de combat :
  //   statbloc d'éditeur (`opts.traits`) → record créature SI ENRÔLÉE (`rec.traits`) → mains libres.
  // Le repli sur `rec.traits` est RÉSERVÉ aux entités enrôlées (combattantes) — c'est exactement la
  // dérivation du spawn `creatureToCombatant` (ref sans statbloc). Une entité d'AMBIANCE (non enrôlée)
  // reste mains libres même si son record porte un trait « Arme ». Armes EXPLICITES seulement
  // (`renderWeaponsFromTraits` — pas de repli « Arme » générique qui serait dessiné en épée).
  const traits = opts?.traits ?? (opts?.enrolled ? rec?.traits ?? [] : []);
  // `opts.weapon` (trappingId d'authoring) ne s'ajoute QUE si les Traits n'ont PAS déjà produit une arme du
  // MÊME type (melee/ranged) — même règle que le spawn de combat (`spawn.ts` spawnEnemy), sinon
  // DUPLICATION du rendu (#126/#145). Un type ABSENT des Traits reste additif (Garde du Village posté
  // « archer » : trait Arme mêlée générique + `weapon:'arc'`).
  const traitWeapons = renderWeaponsFromTraits(traits);
  const idWeaponInst = opts?.weapon ? weaponFromId(opts.weapon) : undefined;
  const idWeapon = idWeaponInst && !traitWeapons.some((w) => w.type === idWeaponInst.type) ? [idWeaponInst] : [];
  const armourPA: ArmourPoints = opts?.armour != null ? emptyArmour(opts.armour) : armourFromTraits(traits);
  return {
    appearance: rigAppearance(seed, base, cd, override),
    tenue: bipedTenue(opts?.tenue, cd, base.perso, base.race),
    equip: { weapons: [...idWeapon, ...traitWeapons], armour: synthArmour(armourPA, opts?.armurePortee ?? cd?.armurePortee) },
  };
}

/** Réf de rendu d'une entité de scène = sa `ref` (id de créature / trapping d'affût / véhicule), et
 *  RIEN d'autre : le label est de l'affichage, jamais une identité. Une entité sans `ref` n'a pas
 *  d'apparence à résoudre — elle ne reçoit pas le record d'un tiers (`resolveRender` le signale). */
export function refOf(ent: Pick<SceneEntity, 'ref'>): string | undefined {
  return ent.ref;
}

/** Profil rig d'une ENTITÉ de scène (perso), dérivation UNIQUE partagée par `tokenBodyKind` (iso) et
 *  `buildPovBillboards` (POV) : mêmes seed / refName / apparence / équipement (dont `enrolled`). Une
 *  entité sans réf NI Espèce n'a aucune apparence à résoudre : signalée en dev, nommée par son id. */
export function entityRigProfileFor(ent: SceneEntity, enrolled?: boolean): EnemyRigProfile | null {
  const seed = ent.appearance?.seed ?? hashSeed(ent.id);
  const refName = refOf(ent);
  if (import.meta.env?.DEV && !refName && !ent.appearance?.species)
    diagOnce(`rig:entite:${diagSubject() || ent.id}`, () => console.error(`[rig] entité « ${ent.id} » (${ent.label ?? 'sans libellé'}) : ni réf de créature ni Espèce — donnée de scène à corriger.`));
  return entityRigProfile(refName, seed, {
    species: ent.appearance?.species, tenue: ent.appearance?.tenue, monster: ent.appearance?.monster,
    features: ent.appearance?.features, weapon: ent.weapon, colors: ent.appearance?.colors,
    parts: ent.appearance?.parts, hairstyle: ent.appearance?.hairstyle, sex: ent.appearance?.sex, build: ent.appearance?.build,
    eyes: ent.appearance?.eyes, traits: ent.statblock?.traits, armour: ent.statblock?.armour, enrolled,
    armurePortee: ent.appearance?.armurePortee, seededVariety: true,
  });
}
