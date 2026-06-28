/**
 * Accès typé à NOTRE base de jeu — désormais APP-OWNED et ÉDITABLE (éditeur de données DEV in-app,
 * écran 'dataEditor'). Les *.json de ce dossier sont la SOURCE CANONIQUE app-owned : la migration
 * `build:data` (re-seed depuis Source/all-data.json) a été RETIRÉE — elle écrasait nos données curées.
 */
import type { EntityAppearance } from '../state/scene';
import { slugId } from './slug';
import characteristicsJson from './characteristics.json';
import speciesJson from './species.json';
import classesJson from './classes.json';
import careersJson from './careers.json';
import careerLevelsJson from './careerLevels.json';
import skillsJson from './skills.json';
import talentsJson from './talents.json';
import etatsJson from './etats.json';
import psychologyJson from './psychology.json';
import maladiesJson from './maladies.json';
import traitsJson from './traits.json';
import qualitiesJson from './qualities.json';
import mutationsJson from './mutations.json';
import mutationTablesJson from './mutationTables.json';
import trappingsJson from './trappings.json';
import vehiclesJson from './vehicles.json';
import navalTraitsJson from './naval-traits.json';
import crewRolesJson from './crew-roles.json';
import crewTestTypesJson from './crew-test-types.json';
import weaponGroupsJson from './weaponGroups.json';
import creaturesJson from './creatures.json';
import spellsJson from './spells.json';
import maneuversJson from './maneuvers.json';
import domainsJson from './domains.json';
import lightLevelsJson from './lightLevels.json';
import propsJson from './props.json';
import eyesJson from './eyes.json';
import hairsJson from './hairs.json';
import calendarMonthsJson from './calendarMonths.json';
import calendarIntercalaryJson from './calendarIntercalary.json';
import calendarWeekdaysJson from './calendarWeekdays.json';
import calendarPhasesJson from './calendarPhases.json';
import weatherJson from './weather.json';
import symptomsJson from './symptoms.json';
import detailsJson from './details.json';
import starsJson from './stars.json';
import locationsJson from './locations.json';
import booksJson from './books.json';
import namesJson from './names.json';
import raceAppearanceJson from './raceAppearance.json';
import godsJson from './gods.json';
import pregensJson from './pregens.json';
import oupsJson from './oups.json';
import interludeEventsJson from './interludeEvents.json';
import peripetiesJson from './peripeties.json';
import grappleJson from './grapple.json';
import { CharKey, Weapon, VehicleData, Availability } from '../engine/types';
import type { MutationData, MutationTable } from './mutations'; // type-only (évite le cycle data→mutations→engine→data)
import type { DiseaseDef } from '../engine/disease'; // type-only (le runtime de disease.ts importe `maladies` d'ici)
import { type DiceSpec, formatDice } from '../engine/dice';
import type { PregenDef } from './pregens'; // type-only (pregens.ts importe la donnée d'ici)
import type { OupsEntry } from './oups';
import type { InterludeEvent } from './interludeEvents';
import type { Peripetie } from './peripeties';

/** Règle d'EMPOIGNADE en DONNÉE (LDB 14 l.155-169) : `init` = ops à la touche d'une Empoignade déclarée
 *  (Empêtré + relation via le flag `grapple`) ; `win` = les 3 options du Test opposé GAGNÉ (l.161), appliquées
 *  avec `ctx.sl = DR`. La mécanique vit ICI (GameOp éditables), le flux `pendingGrapple` n'orchestre que le choix. */
export interface GrappleRule {
  init: import('../engine/ops').GameOp[];
  win: { damage: import('../engine/ops').GameOp[]; entangle: import('../engine/ops').GameOp[]; free: import('../engine/ops').GameOp[] };
}
export const GRAPPLE = grappleJson as GrappleRule;

export interface SpeciesData {
  /** id STABLE (slug du libellé) — cible de `Combatant.species`, pregens, draft. Le `label` ne sert
   *  qu'à l'affichage (`speciesSingular`). */
  id: string;
  label: string;
  refChar: string;
  refCareer: string;
  rand: number;
  desc: string;
  movement: number;
  fate: { fate: number; resilience: number; extra: number };
  small: boolean;
  baseChar: Partial<Record<CharKey, number>>;
  /** Compétences d'espèce (`AdvancementRef[]` ; positionnel +5/+3 — lu via `advancementLabel`). */
  skills: AdvancementRef[];
  /** Talents d'espèce (`AdvancementRef[]` : {ref}, {choice} « A ou B », {random} « N aléatoire », {wildcard}). */
  talents: AdvancementRef[];
  source: { book: string; page: number };
  /** Racial de Groupe ÉDITABLE (Traits psy ciblés, LDB 21) — surcharge la dérivation par label
   *  (`engine/groups`). Absent = racial auto-dérivé du `label` d'espèce. */
  group?: string;
  /** Seuil d100 de mutation PHYSIQUE (LDB 19 l.87-91 : d100 ≤ seuil → corps, sinon esprit) :
   *  Elfe 0, Nain 5, Halfling 10, Humain 50. Ogre 10 (ADE2 « Ogres et Mutations »). ABSENT = défaut
   *  Humain (50) — le Gnome y est rattaché par NADJ « Gnomes et Corruption » (« mutent comme les humains »). */
  mutationBodyMax?: number;
}
export interface ClassData {
  /** id STABLE (slug du libellé) — cible de `CareerData.class`. */
  id: string;
  label: string;
  /** Possessions de départ (`TrappingRef` : id du catalogue + quantité, ou `{text}` flavor hors catalogue). */
  trappings: TrappingRef[];
  desc: string;
  source: { book: string; page: number };
}
export interface CareerData {
  /** id STABLE (slug du libellé) — cible de `Combatant.career`, `CareerLevelData.career`, pregens. */
  id: string;
  label: string;
  /** `id` de la Classe (`ClassData.id`) — réf d'entité, ≠ libellé. */
  class: string;
  /** Tableau des Classes et Carrières aléatoires (LDB 05 l.197+) : borne haute d100 par colonne
   *  d'espèce (`SpeciesData.refCareer`). null = carrière INDISPONIBLE pour cette espèce (l.360). */
  rand: Record<string, number | null>;
  desc: string;
  source: { book: string; page: number };
}
export interface CareerLevelData {
  label: string;
  /** `id` de la Carrière (`CareerData.id`) — réf d'entité, ≠ libellé. */
  career: string;
  level: number;
  /** Compétences/talents d'emplacement (`AdvancementRef[]` : {ref}/{wildcard}/{choice}) — lus via
   *  `advancementLabel` (slotsOfLevel) ou structure. */
  skills: AdvancementRef[];
  talents: AdvancementRef[];
  /** Possessions de niveau (`TrappingRef` : id catalogue + quantité « (3) », ou `{text}` flavor). */
  trappings: TrappingRef[];
  /** Caractéristiques de carrière (clés `CharKey` — « CT », « F »… ; pas de libellé, multilangue). */
  characteristics: CharKey[];
  status: string;
}
export interface SkillData {
  /** Identifiant STABLE (slug du libellé d'origine) — cible des références structurées, robuste au
   *  renommage du `label`. Source unique pour `findSkillById`. */
  id: string;
  label: string;
  characteristic: import('../engine/types').CharKey;
  type: string;
  specs: string[];
  desc: string;
  source: { book: string; page: number };
  /** Test « impliquant un déplacement » (LDB 16 l.37/85) : ciblé par les pénalités d'État À Terre /
   *  Empêtré (`movementOnly`). Classification de COMPÉTENCE portée par la DONNÉE (éditable au Codex),
   *  lue par `engine/conditions.testStatePenalty` — plus de liste d'ids en dur. */
  movement?: boolean;
}
/** UN « matcher » de Test (recodage de la ligne « Tests : » du livre, cf. `TalentTest`) : à quel(s)
 *  Test(s) le talent se rapporte. `skill` (id de Compétence, XOR `char`) OU `char` (Caractéristique nue).
 *  `spec` = spécialisation FIXE ; `specFromInstance` = « (Au choix) » → matche la spec CHOISIE de
 *  l'instance (`t.spec`). `when` = contexte MÉCANISABLE (Condition combat — auto si vraie) ; `manual` =
 *  contexte NARRATIF inmécanisable (« quand vous soulevez ») → advisory, JAMAIS auto-appliqué. */
export interface TestMatch {
  skill?: string;
  char?: import('../engine/types').CharKey;
  spec?: string;
  specFromInstance?: boolean;
  /** EXCLUT une spécialisation (matche toute spec SAUF celle-ci) — Linguistique « Langue (toutes) » qui
   *  « ne fonctionne pas avec Langue (Magick) » : `{ skill:'langue', exceptSpec:'Magick' }`. */
  exceptSpec?: string;
  when?: import('../state/flow').Condition;
  manual?: boolean;
}
/** Champ « Tests » d'un Talent (LDB 10 : +1 DR/niveau sur un Test lié RÉUSSI). `raw` = la ligne du livre
 *  VERBATIM (affichage Codex, rule 5) ; `matches` = la forme STRUCTURÉE id-based lue par la logique
 *  (`talentTestSLBonus`/`castTestTalentDR`) — la logique ne lit JAMAIS `raw`. */
export interface TalentTest {
  raw: string;
  matches: TestMatch[];
}
export interface TalentData {
  /** Identifiant STABLE (slug du libellé d'origine) — cible des références structurées, robuste au
   *  renommage du `label`. Source unique pour `findTalentById`. */
  id: string;
  label: string;
  /** Maxi d'acquisitions (LDB 10 « Schéma des Talents ») : un nombre fixe, ou le BONUS d'une
   *  caractéristique (`{bonusOf}`, structuré — remplace la chaîne « Bonus de X » re-parsée par regex),
   *  ou `null` = sans limite (ex-« Aucun »). */
  max: number | { bonusOf: import('../engine/types').CharKey } | null;
  /** Ligne « Tests » recodée : `{ raw verbatim (Codex), matches[] structuré (logique) }`. `null` = le
   *  talent ne se rapporte à aucun Test. */
  test: TalentTest | null;
  desc: string;
  specs?: string[];
  /** Borne haute de plage d100 sur le Tableau des Talents aléatoires (null = hors table). */
  rand?: number | null;
  source: { book: string; page: number };
  /** Effets MÉCANIQUES authorés (déclencheur → ops du Flow) — Talents « effet sur événement » (Assaut
   *  féroce `onHit`, Frappe réactive `onCharged`…), appliqués par `state/triggeredEffects` exactement comme
   *  les traits. Type-only (le moteur reste pur). Édité au Codex par `TriggeredEffectsField`. */
  effects?: import('../state/flow').TriggeredEffect[];
  /** Modificateurs PASSIFS continus (Coup puissant, Dur à cuire…) en `GameOp[]` — MÊME vocabulaire que les
   *  sorts/traits, lus par le collecteur passif (`talentPassiveMods` → `passiveMods`, kind `intrinsèque`,
   *  répété par niveau). Édité au Codex par `GameOpEditor`. L'octroi d'attaque gratuite (Frénésie) vit ici :
   *  `grantFreeAttack{when:'available'}`, lu par `availableAttacks`. */
  passive?: import('../engine/ops').GameOp[];
  /** Capacités de combat/jeu (LDB 10) en DONNÉE : sac de flags lu par `featuresOf`/`dispatch` (Coup
   *  puissant `meleeDamageBonus`, Riposte, Tueur, castingKind…). Remplace les `combatFeatures/defs/*.ts`. */
  combat?: import('../engine/combatFeatures/types').CombatFeature;
}
/** Capacités IRRÉDUCTIBLES d'un objet (drapeaux NON exprimables en GameOp) — canal `capabilities`, MÊME
 *  logique que `TraitCapabilities`/`QualityCapabilities` : règles que le moteur INTERROGE par id, jamais
 *  par le nom FR de l'objet. Lues par `engine/capabilities` (`itemCapability` par-objet, `hasCapability`
 *  agrégat par-personnage cross-source). */
export interface ItemCapabilities {
  /** Gantelet verrouillé (AA folio 94) : le porteur NE LÂCHE PAS l'arme tenue dans la main gantée la 1re
   *  fois que les circonstances l'y forceraient (désarmement / Piège-lame) — lu par `applyBladeTrap`
   *  (GATÉ sur le port). */
  preventForcedDrop?: boolean;
  /** Protège des intempéries (Cape/Manteau, LDB ch.66 l.46) — annule le malus de Test d'Exposition au
   *  froid (GATÉ sur le port). */
  weatherProtection?: boolean;
  /** Abri de campement (Tente, LDB p.308) — annule/atténue l'Exposition d'une nuit dehors (NON gaté). */
  isShelter?: boolean;
  /** Ration de voyage (« Ration (1 jour) », LDB p.302) — consommée par l'entretien de Faim (NON gaté). */
  isRations?: boolean;
  /** Grimoire / livre de Sorts (LDB 47 l.34) — un Sort non mémorisé du Domaine peut y être lu (NON gaté). */
  isGrimoire?: boolean;
}
export interface TrappingData {
  /** id STABLE (slug du libellé) — cible des `TrappingRef`, robuste au renommage. */
  id: string;
  label: string;
  /** Latéralité TYPÉE (LDB 62) : `2` = arme à deux mains, absent = une main. Remplace l'ancien marqueur
   *  d'affichage `(2M)` re-parsé par regex — source de vérité unique, multilangue-safe. */
  hands?: 1 | 2;
  /** Taille TYPÉE du paquet de munitions (« 12 flèches », LDB 290) : remplace l'ancien marqueur `(12)`. */
  packSize?: number;
  type: string;
  /** `id` du Groupe d'objet (`WeaponGroupData.id`) : Groupe d'arme (Base/Escrime…), famille de munition
   *  (Arc/Poudre noire…), type d'armure (Plate/Mailles…) ou catégorie d'inventaire — réf d'entité, ≠ libellé. */
  subType: string | null;
  /** Slug de FORME (`WeaponDef`/`ShieldDef.slug`) — id STABLE de routage de l'art d'arme/bouclier (rig),
   *  ≠ libellé. Posé à la migration par jointure `norm(label)` → forme. Absent pour munitions/armes de
   *  siège/Mains nues (aucune silhouette tenue). Propagé sur `ItemInstance.shape` puis `Weapon.shape`. */
  shape?: string;
  /** Formes choisibles (slugs `WeaponDef.slug`) d'une arme ABSTRAITE (« Arme simple » → épée/hache/
   *  masse/marteau de guerre/demi-lance). Le picker pose le choix sur `ItemInstance.shape` ; défaut =
   *  `shape` du trapping. Absent pour une arme à forme unique. */
  formChoices?: string[];
  /** Encombrement (Points d'Encombrement). Honnête : la donnée porte aussi des STRINGS pour des cas
   *  NON-ENCOMBRANTS / non chiffrés — `'ND'` (ateliers : on ne les transporte pas) et `'Variable'`
   *  (arme improvisée). Ces strings sont traitées comme 0 au calcul (`itemFromTrappingById`). */
  enc: number | 'ND' | 'Variable' | null;
  availability: string | null;
  /** Allonge de MÊLÉE — UNIQUEMENT un libellé d'ordre de portée whitelisté (Personnelle / Très courte /
   *  Courte / Moyenne / Longue / Très longue / Considérable / Variable) ou null. NE conflate PLUS aucune
   *  Portée de tir : ni nombre, ni formule « BFx3 » (→ `range:{bf}`), ni modificateur de munition
   *  « Moitié de l'arme »/« +50 »/« Comme l'arme » (→ `ammoRangeMod`). */
  reach: string | null;
  /** Portée de TIR — SPEC non résolue (`WeaponRangeSpec`) : `number` = mètres FIXES (arc/arbalète/
   *  pistolet…), `{bf}` = Bonus de Force × bf mètres (armes de JET — javelot/bombe…). Absent/null pour
   *  la mêlée et les munitions (qui héritent de l'arme). Résolue à l'usage par `effectiveRange`. */
  range?: import('../engine/types').WeaponRangeSpec | null;
  /** MUNITION : modificateur STRUCTURÉ de la Portée de l'arme de tir (`AmmoRangeMod` : `{mult}` fraction /
   *  `{add}` mètres ±). Appliqué en combat (`effectiveWeaponRange`) à l'arme qui tire cette munition. « Comme
   *  l'arme » = absent/null (Portée de l'arme inchangée). Sorti de `reach` (qui n'est qu'une Allonge mêlée). */
  ammoRangeMod?: import('../engine/types').AmmoRangeMod | null;
  loc: string | null;
  pa: number | null;
  /** Dégâts d'arme STRUCTURÉS (cf. `WeaponDamageSpec`) — remplace la chaîne « +BF+4 » re-parsée au runtime. */
  damage: import('../engine/types').WeaponDamageSpec | null;
  /** Qualités d'arme/armure (`QualityRef` : id + Indice éventuel « Solide 3 » → value, spec = arg éventuel). */
  qualities: QualityRef[];
  desc: string | null;
  /** Effet d'un CONSOMMABLE (potion/bandage, LDB 307) en `GameOp[]` — MÊME vocabulaire que sorts/passifs
   *  (`heal`/`removeCondition`/`preventInfection`), exécuté par `applyOps`. Remplace le parsing du `desc`
   *  au runtime ; édité au Codex via `GameOpEditor`. Copié sur `ItemInstance.consumable` à la construction. */
  consumable?: import('../engine/ops').GameOp[];
  /** Contenant (LDB 64) : capacité de rangement (« Contenu », en Enc). Sacs/sacoches/sac à dos. */
  container?: { capacity: number };
  price: { gold: number; silver: number; bronze: number };
  source: { book: string; page: number };
  /** Arme DÉRIVÉE conférée tant que l'objet est ÉQUIPÉ (prothèse-arme, LDB 73 : le Crochet « est
   *  considéré comme une Dague » en mêlée). Lue par recomputeLoadout : ajouter une prothèse-arme =
   *  remplir ce champ dans la donnée, plus de name-match `i.name === 'Crochet'`. */
  derivedWeapon?: Weapon;
  /** Capacités IRRÉDUCTIBLES de l'objet (drapeaux NON exprimables en GameOp) — canal `capabilities`,
   *  MÊME logique que `TraitCapabilities`/`QualityCapabilities` : règles que le moteur INTERROGE par id
   *  (`engine/capabilities`), jamais par le nom FR de l'objet. Couvre les 5 marqueurs de catégorie :
   *  `weatherProtection` (Cape/Manteau), `isShelter` (Tente), `isRations` (Ration), `isGrimoire`
   *  (Grimoire), `preventForcedDrop` (Gantelet verrouillé). Édité au Compendium. */
  capabilities?: ItemCapabilities;
  /** Modificateurs PASSIFS continus de l'objet (GameOp[], MÊME vocabulaire que traits/qualités/sorts) —
   *  appliqués tant que l'objet est PORTÉ ou TENU (collecteur `passiveMods`). Ex. Bésicles → `skillMod`
   *  +20 Langue/Perception (LDB 67). */
  passive?: import('../engine/ops').GameOp[];
}
/** Groupe d'objet (taxonomie `subType` id-ifiée) : Groupe d'ARME (Base, Escrime, Deux-mains, Armes
 *  d'hast…), famille de MUNITION (Arc, Arbalète, Poudre noire…), type d'ARMURE (Plate, Mailles, Cuir
 *  souple/bouilli) ou catégorie d'INVENTAIRE (Outils, Possessions diverses…). `id` = cible de
 *  `Trapping/Weapon/ItemInstance.subType` (réf, ≠ libellé) ; `kind` = métadonnée d'affichage. */
export interface WeaponGroupData {
  id: string;
  label: string;
  kind: 'weapon' | 'ammo' | 'armour' | 'inventory';
  /** Matériau d'une armure (groupes `kind:'armour'`) — source TYPÉE des exemptions de Magie des Arcanes
   *  (Chamon/Azyr ignorent le métal, Ghur le cuir, LDB 46 l.188). Remplace la devinette par regex sur le nom. */
  material?: 'metal' | 'leather';
}
/** Rareté de récolte/trophée = `Availability` (LDB 59) ÉTENDUE de `'Unique'` (pièce de bestiaire singulière). */
export type HarvestRarity = Availability | 'Unique';
export type HarvestDanger = 'Inoffensive' | 'Inquiétante' | 'Menaçante' | 'Mortelle';

export interface CreatureData {
  /** `id` STABLE (slug) — clé de résolution runtime/données (scènes, encounters, rig). « Plus de label » :
   *  les références pointent l'id (robuste au renommage/multilangue) ; le `label` ne sert qu'à l'affichage. */
  id: string;
  label: string;
  title: string | null;
  /** `true` = individu NOMMÉ (vs rôle générique / espèce de bestiaire) ; absent/`false` = générique.
   *  SOURCE UNIQUE de la nommé-ité — ne PAS l'inférer de `title`. Éditable au Codex. */
  named?: boolean;
  folder: string | null;
  char: Record<string, number | null>;
  /** Traits STRUCTURÉS (`TraitInstance[]`) — source app-owned migrée du parsing de chaînes (de-POC).
   *  Lus sans aucun parsing (`resolveTraits`/`hasTraitKey`) ; plus de chaîne legacy. */
  traits: import('../engine/statEntry').TraitList;
  /** Traits FACULTATIFS (`TraitInstance` structurés) — affichés au Codex, choisissables au spawn. */
  optionals: import('../engine/statEntry').TraitInstance[];
  /** Compétences STRUCTURÉES (`SkillRef` par id stable + valeur de Test imprimée) — fin du parsing
   *  de chaînes « Calme 58 ». Le bestiaire stocke des refs ; `skillRefLabel` reformate à l'affichage. */
  skills: SkillRef[];
  /** Talents STRUCTURÉS (`TalentRef` par id stable + niveau/spécialisation) — fin du parsing de chaînes
   *  « Maîtrise du combat 2 », « Magie des Arcanes (Ghur) ». `talentRefLabel` reformate à l'affichage ;
   *  au spawn, `talentsFromBook` reconstruit le libellé canonique AVEC sa spec (clé du registre). */
  talents: TalentRef[];
  /** Possessions (`TrappingRef` : id catalogue + quantité, ou `{text}` narratif — « collection d'alcool »). */
  trappings: TrappingRef[];
  /** Sorts connus (`Ref` par id de sort). */
  spells: Ref[];
  desc: string | null;
  source: { book: string; page: number };
  /** Apparence par défaut UNIFIÉE (plan P2) — UN seul bloc éditable porté par l'enregistrement :
   *  espèce, tenue, parts monstrueux, couleurs, coiffure, sexe/carrure, yeux. Le rig la lit comme
   *  couche de défaut (sous une éventuelle surcharge de scène). Même format que `EntityAppearance`
   *  (éditeur de scène) → une SEULE structure d'apparence dans toute l'app. */
  appearance?: EntityAppearance;
  /** Récolte « Précieuses Entrailles » (ZI) : rareté + dangerosité (→ coût par Enc des pièces,
   *  cf. engine/harvest) et usages supposés des organes. Porté par la créature (pas de table //). */
  harvest?: { rarity: HarvestRarity; danger: HarvestDanger; uses: string };
  /** Catégorie de Groupe ÉDITABLE (Traits psy ciblés, LDB 21) — surcharge la dérivation par folder
   *  (`engine/groups`). Absent = catégorie auto-dérivée du `folder`. */
  group?: string;
}
/** Base PARTAGÉE d'un STATUT porté pilotant des effets en DONNÉES — soit un État (LDB 16, `EtatData`), soit
 *  un état psychologique (LDB 21, `PsychologyData`). Porte le vocabulaire commun : modificateurs PASSIFS
 *  (`passive: GameOp[]`, MÊME éditeur `GameOpEditor` que traits/atouts) ET effets DÉCLENCHÉS
 *  (`effects: TriggeredEffect[]`). Folding UNIQUE : `passiveMods` (passifs) + `fireStatusEffects` (déclenchés)
 *  itèrent indifféremment États et états psy → zéro duplication de schéma ni de collecteur. */
export interface StatusData {
  /** id STABLE (slug du libellé) — cible des instances (`ConditionInstance.name` / `PsychAffliction.type`). */
  id: string;
  label: string;
  desc: string;
  source: { book: string; page: number };
  /** Modificateurs PASSIFS continus (pénalité de Test, `incomingAttackMod`, `sbBonus`…) en `GameOp[]`, lus
   *  par `passiveMods` (kind `etat` : pool non-cumul, le pire seul, LDB 16 l.20). MÊME éditeur GameOpEditor. */
  passive?: import('../engine/ops').GameOp[];
  /** Effets DÉCLENCHÉS (dégâts par round → `onRoundEnd` ; sortie de Frénésie → `onTurnStart`…) en
   *  `TriggeredEffect[]`, diffusés par `fireStatusEffects` — le même cœur `applyTriggeredEffects`. */
  effects?: import('../state/flow').TriggeredEffect[];
  /** Restriction d'Action / de Mouvement / de défense imposée par le STATUT (États : À Terre/Sonné/
   *  Inconscient/Surpris/Empêtré ; et Psychologie — « Etat comme Psy »), lue en DONNÉES par les prédicats
   *  moteur `canTakeAction`/`effectiveMovement`/`cannotDefend` via le collecteur `conditionGating` (plus de
   *  branche par-nom). Sur `StatusData` → partagée par `EtatData` ET `PsychologyData`. */
  gating?: { action?: 'none'; movement?: 'none' | 'half' | 'crawl'; cannotDefend?: true };
}

export interface EtatData extends StatusData {
  /** Les magnitudes du `passive` sont-elles multipliées par le nombre de pions (Exténué −10/pion, LDB 16
   *  l.89) ? Appliqué à l'émission par le collecteur `passiveMods`. Défaut (absent) : magnitude fixe. */
  perStack?: boolean;
  /** Le nombre de pions vu par les `effects` (le `{stacks:'self'}` des dégâts par-round) est RÉDUIT du
   *  niveau de cette capacité de combat chez la cible — ex. Hémorragique réduit par Endurci (`bleedIgnore`,
   *  LDB 10). Clé de `CombatFeature` ; lu génériquement par `fireConditionEffects` (jamais codé par-nom). */
  stacksReducedBy?: string;
  /** Récupération de l'État par une ACTION (LDB 16 : Empêtré « se libérer » l.61 = Test OPPOSÉ de Force
   *  contre la source de l'empêtrement ; En flammes « se rouler » l.77 = Test d'Athlétisme simple). Lue par
   *  l'action `recover` (IA inline ET flux joueur — SOURCE UNIQUE `resolveRecoverTest`) au lieu des branches
   *  par-nom. `opposedBy:'source'` → opposé contre la Force d'entrave : `escapeStrength` FIGÉE en priorité
   *  (vaut même source absente), sinon Force de la source VIVANTE. Retire 1 + DR pions sur succès. */
  recover?: { skill?: string; characteristic?: import('../engine/types').CharKey; opposedBy?: 'source'; difficulty?: import('../engine/types').Difficulty };
  /** Cet État VERROUILLE l'Action : le Mouvement + l'Action doivent servir à fuir/se cacher (Brisé, LDB 16
   *  l.55). Drapeau DÉCLARATIF lu en DONNÉES par `isActionLocked`/`restrictingConditions` (engine/conditions),
   *  partagé par le gate de hotbar (`battleSelectAction`) ET l'IA (dépense PROACTIVE de Détermination pour se
   *  ressaisir) — plus de nom d'État en dur. */
  restrictsAction?: boolean;
}

/** État PSYCHOLOGIQUE en DONNÉES (LDB 21) — `id` = `PsychType` (`frenesie`, à terme `peur`/`terreur`/…).
 *  Étend `StatusData` (passive/effects mutualisés) ; n'ajoute que la capacité propre à la psychologie. */
export interface PsychologyData extends StatusData {
  /** Porter cet état psy IMMUNISE à la Psychologie (Frénésie, LDB 21 l.34) — lu GÉNÉRIQUEMENT par
   *  `isPsychImmune` (jamais codé par-nom), à l'égal du drapeau de trait « Immunité (Psychologie) ». */
  psychImmune?: boolean;
  /** Emoji d'affichage (HUD/modales/Codex) — SOURCE UNIQUE, remplace les maps `CIBLE_LABEL`/`PSYCH_LABEL`. */
  emoji?: string;
  /** Trait psychologique CIBLÉ (Animosité/Haine/Préjugé/Amour/Camaraderie/Phobie, LDB 21) : résolution
   *  binaire de Calme pilotée par un Groupe-Cible. Dérive `CIBLE_TYPES` de la donnée (plus de Set codé). */
  targeted?: boolean;
  /** RAW LDB 21 : cette affliction CIBLÉE cesse dès que son porteur tombe sous un AUTRE effet psychologique
   *  « dominant » (Peur/Terreur/Haine…) — « Animosité est annulé par Peur et Terreur » ; Préjugé idem. */
  endedByOtherPsych?: boolean;
  /** RAW LDB 21 : tant que cette affliction CIBLÉE est active, son porteur est IMMUNISÉ aux KINDS psy listés
   *  causés par un membre de sa Cible (Haine → ['peur'], « mais pas Terreur »). Lu par `fearSourceFor`. */
  immuneToFromTarget?: string[];
  /** Contribution de cet état psy au DEGRÉ DE RÉUSSITE de l'ATTAQUE de son porteur (LDB 21, ±1 DR) — lu
   *  par `psychDRAdjust` (plus de ±1 codé par-nom). `vs:'source'` = Peur vs sa source (active non vaincue,
   *  l.29) ; `vs:'group'` = Haine/Animosité vs le groupe ciblé actif (l.22/41) ; `vs:'any'` = Amour/
   *  Camaraderie en défense, dès lors qu'actif (l.77/82). */
  attackDR?: { amount: number; vs: 'source' | 'group' | 'any' };
  /** Actif, cet état ANNULE le malus de Peur de l'attaquant (Amour : « immunisé à la Peur tant que vous
   *  défendez les êtres aimés », LDB 21 l.77) — généralise, hors-groupe, l'immunité `immuneToFromTarget`. */
  cancelsFear?: boolean;
  /** Mode de RÉSOLUTION du Test de Psychologie (LDB 21), lu par l'applier GÉNÉRIQUE `combatPsych` (plus de
   *  dispatch `kind === 'terreur'` codé) : `'extended'` = Test ÉTENDU de Calme cumulant le DR vers l'Indice
   *  (Peur, l.27) ; `'terreur'` = Test BINAIRE dont l'échec inflige `failCondition` (Indice + |DR négatifs|)
   *  puis pose l'état `becomes` (Terreur → Peur, l.55-57) ; `'binary'` = Test BINAIRE activant l'affliction
   *  CIBLÉE (traits ciblés). Absent (Frénésie/trauma) = pas de Test de résolution surmontable. */
  resolution?: 'extended' | 'terreur' | 'binary';
  /** (résolution `'terreur'`) État infligé à l'ÉCHEC (l'id de l'état, p.ex. `'brise'`) ; la QUANTITÉ est
   *  déclarée par `failAmount` (défaut = Indice + |DR négatifs|, LDB 21 l.57). */
  failCondition?: string;
  /** (résolution `'terreur'`) QUANTITÉ d'état infligée à l'échec, EN DONNÉES (`failConditionAmount`) :
   *  `base` (l'Indice de l'affliction via `'indice'`, ou un nombre FIXE) + `perDegreeOfFailure` par DR
   *  négatif. Défauts `{ base:'indice', perDegreeOfFailure:1 }` = la règle Brisé Terreur — plus de calcul
   *  codé : un nouvel État/Psy déclare ICI sa quantité (fixe, ou par degrés seuls). */
  failAmount?: { base?: 'indice' | number; perDegreeOfFailure?: number };
  /** (résolution `'terreur'`) État psychologique SUBSÉQUENT au Test (la Terreur devient une Peur, l.55). */
  becomes?: string;
  /** Paramètres du Test de Psychologie (LDB 21) : `skill` (compétence stable, défaut `calme` — la valeur
   *  NUE est lue par `skillBaseValue`) + `difficulty` (défaut Intermédiaire +0). Lu par `psychStepFor`/
   *  l'encounter, plus de Calme/Intermédiaire codé : un nouvel État/Psy déclare ICI son Test (ex. testé en
   *  Résistance, ou à une difficulté propre). « Sans Peur (Ennemi) » force Accessible à part (par-combattant). */
  test?: { skill?: string; difficulty?: import('../engine/types').Difficulty };
}
/** Tables Couleur des Yeux / Cheveux (LDB 05 l.698-744) : 2d10, libellé par refChar. */
export interface DetailColorData {
  label: string;
  /** Borne haute 2d10 (incluse). */
  rand: number;
  color: Record<string, string>;
}
/** Texte d'aide (LDB 05 « Détails ») : global + par colonne refChar (HTML léger des données). */
export interface DetailText {
  all: string;
  bySpecies: Record<string, string>;
}
/** Formules d'Âge/Taille (LDB 05 l.691-707) : « base + N d10 », par colonne refChar —
 *  + textes d'aide (conventions de noms, espérance de vie, tailles moyennes, Ambitions). */
export interface DetailsData {
  ageBase: Record<string, number>;
  ageRoll: Record<string, number>;
  heightBase: Record<string, number>;
  heightRoll: Record<string, number>;
  texts: {
    nom: DetailText;
    age: DetailText;
    taille: DetailText;
    ambitionShort: DetailText;
    ambitionLong: DetailText;
  };
}
/** MANŒUVRE de combat (attaque naturelle activée — LDB 85) — ENTITÉ ÉDITABLE de PREMIÈRE CLASSE (au
 *  même titre qu'un Sort) : son propre dataset `maneuvers.json`, sa catégorie Codex, ses effets
 *  AUTHORÉS en GameOp (`effects`). Un trait l'OCTROIE (`TraitData.grantsManeuvers`) ; le résolveur
 *  générique (`state/combatManeuvers.resolveManeuver`) la joue ENTIÈREMENT depuis cette donnée — plus
 *  de table en dur ni d'applier par type. `kind` ne sert QU'À l'anim/pose/icône (jamais à résoudre).
 *  La géométrie/portée/opposition restent moteur (règle 3) ; Dégâts (`wounds`) + États = data. */
/** Mesure de géométrie de manœuvre en MÈTRES (Portée/Souffle) : `bonus(ref)` de la carac `bonusOf` (référent
 *  = Attaquant pour la Portée, Cible au centre pour le Souffle, RAW l.251) + constante `plus`. Résolue par
 *  `measureMeters` (`combatManeuvers`) — remplace la formule-chaîne FR re-parsée par regex au runtime. */
export interface ManeuverMeasure {
  bonusOf?: CharKey;
  plus?: number;
}
export interface ManeuverDef {
  id: string;
  label: string;
  /** Anim/pose/icône SEULEMENT (pas la résolution) — type d'attaque naturelle (geste distinct). */
  kind: import('../engine/creatureAttacks').AttackKind;
  /** Déclenchement RAW : Action normale, gratuite (coût d'Avantage), ou gratuite à la Charge. */
  activation: 'action' | 'free' | 'charge';
  advantageCost: number;
  /** Gestion de l'Avantage dépensé : `fixed` = `advantageCost` (défaut) ; `variable` = le joueur
   *  CHOISIT (Regard : +1 DR par Avantage, LDB 85 l.238) ; `all` = dépense tout (Hurlement, l.135). */
  advantageMode?: 'fixed' | 'variable' | 'all';
  /** Caractéristique du jet de l'attaquant (CC mêlée / CT distance·zone) ; absent = AUCUN jet
   *  d'attaquant (Hurlement : chaque cible teste sa Résistance). */
  stat?: 'CC' | 'CT';
  /** Défense opposée : Esquive / Parade, Initiative (Regard), Résistance/auto sans opposition. */
  defense?: 'esquive' | 'parade' | 'init' | 'resist' | 'auto';
  /** Mode de ciblage (le résolveur en dérive la géométrie moteur). */
  targeting: 'melee' | 'ranged' | 'zone' | 'allFoes';
  /** Portée / Souffle STRUCTURÉS (`ManeuverMeasure`) — mètres = `bonus(ref) + plus`. `range` résolu contre
   *  l'Attaquant, `blast` contre la cible au centre (RAW l.251). Remplace la formule-chaîne re-parsée au runtime. */
  range?: ManeuverMeasure;
  blast?: ManeuverMeasure;
  /** Attaque magique (Souffle, Étreinte glaciale) → soumise à la Résistance à la Magie, etc. */
  magic?: boolean;
  /** Effets AUTHORÉS (Dégâts `wounds` + États) appliqués quand la manœuvre touche (`onHit`) — MÊME
   *  vocabulaire que les sorts (Flow d'ops), exécutés par `applyTriggeredEffects`. */
  effects?: import('../state/flow').TriggeredEffect[];
  desc?: string;
  source?: { book: string; page: number };
  /** Pertinence de BASE pour le scoreur d'attaque (clic droit joueur ET décision IA) : POIDS ÉDITABLE,
   *  plus haut = choisie plus volontiers. Combinée aux bonus situationnels AUTO (dégâts attendus,
   *  multi-cible, état onHit applicable). Défaut 1 ; 0 = jamais auto-choisie (reste manuelle). */
  priority?: number;
}
/** Drapeaux de CAPACITÉ IRRÉDUCTIBLES d'un trait (LDB 85) — décisions d'IA/psychologie, règles de
 *  résolution de combat, capacités de construction/déplacement/vision : NI un modificateur (`passive`)
 *  NI un effet déclenché (`effects`), mais une règle que le moteur INTERROGE. Édité au Codex. Le
 *  seuil/type éventuel (Démoniaque 8+, Immunité (Poison)) vient de l'INDICE/arg de l'INSTANCE, pas d'ici. */
export interface TraitCapabilities {
  // Construction / spawn
  bonusWoundsBE?: boolean;
  mutationAtSpawn?: 'physique' | 'mentale';
  swarm?: boolean;
  /** Attaque NATURELLE (LDB 85) : le trait EST une arme (morsure, cornes, tentacules…) — pas d'objet
   *  tenu par le rig. Remplace l'ancienne reconnaissance par découpe du libellé + Map FR au runtime
   *  (`statEntry` interdit le parsing de chaîne au runtime). `ranged` pour les attaques à distance (crachat). */
  naturalWeapon?: { ranged?: boolean };
  // Résolution de combat (seuil/type éventuel depuis l'instance)
  wardSave?: boolean;
  magicResistance?: boolean;
  damageImmunity?: boolean;
  /** Manifestation de Ghur (bestiaire de Middenheim) : le porteur est IMMUNISÉ aux effets des Sorts
   *  du Domaine d'id donné (« bete » = Domaine de la Bête / Ghur). Lu PAR ID par le chemin
   *  d'incantation (`immuneToSpellDomain` → `applyCast`) : les effets d'un Sort de ce Domaine ne
   *  s'appliquent pas au porteur. NB : la clause RAW de vulnérabilité aux dégâts supplémentaires
   *  anti-démon/mort-vivant (hors Bête) n'est PAS modélisée — le moteur n'a aucun concept de créature
   *  « vulnérable comme un démon/mort-vivant » (les riders de Domaine ciblent l'appartenance LITTÉRALE
   *  à un Groupe/Trait), donc rien d'inventé. */
  spellDomainImmunity?: string;
  /** Contre-attaque en gagnant un Test opposé de défense (Champion LDB 85). MÊME capacité GÉNÉRIQUE que
   *  le talent Riposte (`CombatFeature.counterOnDefenseWin`) — un seul concept pour traits ET talents. */
  counterOnDefenseWin?: boolean;
  counterRequiresFastParry?: boolean;
  unstable?: boolean;
  painless?: boolean;
  // Psychologie / IA
  psychImmuneIfAhead?: boolean;
  /** Psychologie portée par le trait (LDB 21), lue par `parsePsychTraits` (data-driven). L'Indice
   *  (Peur/Terreur) vient de l'instance (`value`) ; la Cible (Animosité…) de l'instance (`arg`). */
  psychType?: 'peur' | 'terreur' | 'animosite' | 'haine' | 'prejuge' | 'amour' | 'camaraderie' | 'phobie';
  psychImmune?: boolean; // Immunité (Psychologie) — annule Peur/Terreur (LDB 85 l.143-144)
  psychIndice?: number; // Indice FIXE si absent de l'instance (Phobie = 1, Effrayé = 0)
  mindless?: boolean;
  bestial?: boolean;
  coldBlooded?: boolean;
  stupid?: boolean;
  rage?: boolean;
  territorial?: boolean;
  /** Monture trop ombrageuse pour agir seule (Nerveux, LDB 14 l.221) : MONTÉE, elle ne consacre pas sa
   *  propre Action à attaquer (une monture SANS ce drapeau est « un combattant à part entière »). Lu par
   *  l'IA de combat monté — drapeau de donnée, plus de test par-nom du trait. */
  skittishMount?: boolean;
  // Déplacement / vision
  fly?: boolean;
  leap?: boolean;
  stride?: boolean;
  seesInDark?: boolean;
  /** Portée de vision dans le noir, en cases (Vision nocturne 20 m/niv = 10 — `LDB 11 l.147` ;
   *  Infravision = illimité, grande valeur — `LDB 85 l.165`). Lue par `darkSightTiles`. */
  darkSightTiles?: number;
}
/** Trait de créature (LDB 85) : libellé canonique + desc VERBATIM (affichée à l'inspecteur). */
export interface TraitData {
  /** Identifiant STABLE (slug du libellé) — clé d'instance/lookup, indépendant de la langue. */
  id: string;
  label: string;
  /** Squelette d'arguments du libellé (« (Indice) (Portée) »…), null si aucun. */
  prefix: string | null;
  desc: string;
  source: { book: string; page: number };
  /** Effets MÉCANIQUES authorés (déclencheur → ops du Flow) — Traits « effet sur événement » (Toile,
   *  Sang corrosif, Régénération…) appliqués par `state/triggeredEffects`, plus de handler en dur.
   *  Type-only (le moteur reste pur : la donnée référence le Flow sans en dépendre à l'exécution). */
  effects?: import('../state/flow').TriggeredEffect[];
  /** Manœuvres OCTROYÉES par ce trait (Morsure, Attaque caudale, Souffle…) — `Ref[]` vers le dataset
   *  `maneuvers`. Un trait d'attaque naturelle octroie sa/ses manœuvre(s) ; `engine/creatureAttacks`
   *  les résout par id (`findManeuverById`). Le trait Souffle en octroie plusieurs (un par Type). */
  grantsManeuvers?: Ref[];
  /** Modificateurs de PROFIL PASSIFS (Élite +20 CC/CT/FM, Brutal −1 M…) en `GameOp[]` — le MÊME vocabulaire
   *  d'ops que les sorts et `Trauma.ops`, CONTINUS (sans wrapper Flow/déclencheur, ≠ `effects`) : édités par
   *  `GameOpEditor` (le composant de liste d'ops existant), lus par le collecteur passif (`traitPassiveMods`
   *  → liveTraits) qui leur AFFECTE le `kind` `intrinsèque` (comme la séquelle dérive le sien). */
  passive?: import('../engine/ops').GameOp[];
  /** Apparence COSMÉTIQUE déclarée en DONNÉE (calques du catalogue via `features` + `colors` + `eyes`) —
   *  fusionnée sur le rig quand le trait est présent (cf. `combatantVisuals`). Même fragment éditable
   *  (`AppearanceField`) que les créatures/mutations. */
  appearance?: EntityAppearance;
  /** Drapeaux de CAPACITÉ irréductibles (décisions IA/psy, résolution, build/déplacement/vision) —
   *  migrés des `defs/` mécaniques, lus PAR ID par `engine/traits/dispatch`. Édité au Codex. */
  capabilities?: TraitCapabilities;
  /** Capacités d'AUTRES traits du même porteur ANNULÉES par ce trait (« entraîné à IGNORER son Trait
   *  X » — LDB 85 : Dressé (Dompté) ignore Bestial). Mécanisme GÉNÉRIQUE de suppression, lu par
   *  `traitCapability` : une capacité supprimée par n'importe quel trait porté répond false. */
  suppressesCapabilities?: (keyof TraitCapabilities)[];
  /** AURA de combat : projette des `passive` GameOp[] sur les combattants À PORTÉE (Perturbant : −20 aux
   *  Tests à `rangeChar` mètres, LDB 85 p.341 ; `affects` = qui est touché). Recalculée chaque Round par le
   *  hook GÉNÉRIQUE `recompute-auras`, accumulée dans `Combatant.auraMods` (lu par `passiveMods`, kind `etat`
   *  NON-CUMUL — « une seule fois, peu importe le nombre d'ennemis Perturbants »). Aucun code par-nom. */
  aura?: { rangeChar?: CharKey; rangeMeters?: number; affects?: 'enemies' | 'allies' | 'all'; passive: import('../engine/ops').GameOp[] };
  /** Trait STANDARD (LDB 76 l.28-31 : « ajoutés à la liste Facultative de TOUTES les créatures ») —
   *  proposé par le picker de Traits facultatifs sur n'importe quel bestiaire. Édité au Codex. */
  standard?: boolean;
}
/** Drapeaux/marqueurs de CAPACITÉ IRRÉDUCTIBLES d'une qualité d'arme/armure/objet (LDB 62-63) — règles
 *  que le moteur INTERROGE (résolution de combat, économie d'artisanat) : NI un modificateur (`passive`)
 *  NI un effet déclenché (`effects`). Migrés des `defs/` mécaniques, lus PAR ID par `engine/qualities/dispatch`.
 *  Les INDICES (Salve N, Protectrice N, Arme d'équipe N…) restent lus du RUNTIME string (`parseQuality().indice`)
 *  — la capability n'est qu'un marqueur de PRÉSENCE, jamais le porteur de l'Indice. Édité au Codex. */
export interface QualityCapabilities {
  // Résolution de combat (mêlée)
  fastStrike?: boolean;   // Rapide : pré-emption d'initiative + −10 parade adverse non-Rapide
  slowStrike?: boolean;   // Lente : frappe en dernier
  fumbleOn9?: boolean;    // Dangereuse : Maladresse sur tout Test raté incluant un 9
  pushback?: boolean;     // Perturbante : repousse au lieu de blesser
  bladeTrap?: boolean;    // Piège-lame : piéger/briser une lame sur un Critique défensif
  damagesArmour?: boolean;// Taille : endommage l'armure/le bouclier frappé
  // (Taillade « État sur Critique » n'est PLUS une capability : `effects:[{trigger:'onCrit'}]` data-driven.)
  // Armes à feu / chargeurs
  firearm?: boolean;            // Poudre noire / Explosion : Incident de Tir + terreur (Nerveux)
  canFireWhileEngaged?: boolean;// Pistolet : tir au contact
  magazine?: boolean;           // À Répétition : chargeur (Indice)
  salvo?: boolean;              // Salve : chargeur (Indice)
  areaFire?: boolean;           // Tir de zone : nuage de projectiles (Indice)
  explosion?: boolean;          // À Explosion : tous à Indice m du point cible subissent DR+Dégâts + États de l'arme (LDB p.298)
  crewedTeam?: boolean;         // Arme d'équipe : sous-effectif (Indice)
  parryAP?: boolean;            // Protectrice : Indice PA en opposant (Indice)
  // Objet / artisanat (LDB 60)
  encDelta?: number;            // Léger −1 / Volumineux +1 Encombrement
  // Armure (LDB 63)
  layerable?: boolean;          // Flexible : superposition sous une couche non Flexible
  critImmuneOdd?: boolean;      // Impénétrable : Critiques sur jet impair ignorés
  apIgnoredOnEven?: boolean;    // Partielle : PA ignorés sur jet pair ou Critique
  apIgnoredOnImpaleCrit?: boolean; // Points faibles : PA ignorés sur Critique Empaleuse
  // Marqueurs
  unbreakable?: boolean;        // Incassable : insensible aux dégâts/destruction
  magic?: boolean;              // Magique : attaques magiques (blesse l'Éthéré)
  /** Préséance : cette qualité l'emporte sur les `beats` (ids) si toutes deux présentes (Imprécise > Précise, Lente > Rapide). */
  beats?: string[];
}
/** Atout/Défaut d'arme (LDB 62-63) : libellé + desc VERBATIM + effets déclenchés authorés (mêmes
 *  `TriggeredEffect` que les Traits — un Atout « à la touche : 1d10 + Empêtré » s'édite au Codex). */
export interface QualityData {
  /** id STABLE (slug du libellé) — cible des `Ref` de qualité, robuste au renommage. */
  id: string;
  label: string;
  type: string;
  subType: string | null;
  desc: string;
  effects?: import('../state/flow').TriggeredEffect[];
  /** Modificateurs PASSIFS continus (objet Laid : −10 aux Tests de Soc ; PASSIFS d'arme : weaponRollMod/
   *  weaponDamageMod/armourPierce/critOnRoll) en `GameOp[]` — MÊME vocab/éditeur (`GameOpEditor`) que les
   *  traits et les sorts ; lus par `engine/qualities/dispatch` (par id) et le collecteur passif. */
  passive?: import('../engine/ops').GameOp[];
  /** Drapeaux/marqueurs de CAPACITÉ irréductibles (résolution combat, artisanat) — migrés des `defs/`,
   *  lus PAR ID par `engine/qualities/dispatch`. Édité au Codex. */
  capabilities?: QualityCapabilities;
}
/** Capacités IRRÉDUCTIBLES d'un symptôme de maladie — drapeaux lus par la machinerie de cycle
 *  (`engine/disease`), pour les comportements non exprimables en GameOp continu. */
export interface SymptomCapabilities {
  blocksHealing?: boolean;   // « Blessé »/Gangrène : bloque la guérison d'1 PB par symptôme (LDB 20 l.145)
  amputation?: boolean;      // Gangrène : Test quotidien, échecs > BE → Localisation perdue (l.176)
  stickyExtenue?: boolean;   // Malaise : État Exténué collant tant que la maladie dure (l.188)
  contagious?: boolean;      // Toux & éternuements : expose l'entourage (l.206)
  nausea?: boolean;          // Nausée : Sonné sur Test de déplacement raté en combat (l.194)
  endTest?: boolean;         // Persistant : Test de fin de Durée (difficulté portée par l'instance, l.200)
}
/** Symptôme de maladie (LDB 20) — entité de DONNÉE éditable au Codex, mécaniques en GameOp / 3 canaux
 *  (comme un trait/qualité). `passive` = pénalités continues (charMod) ; `severePassive` = variante
 *  appliquée quand l'instance porte `severity` (Convulsions −20) ; `onTick` = Test de cycle quotidien +
 *  conséquence GameOp appliquée par la cascade (différée/influençable) ; `capabilities` = règles
 *  irréductibles lues par la machinerie de maladie. */
export interface SymptomData {
  id: string;
  label: string;
  desc: string;
  source?: { book: string; page: number };
  passive?: import('../engine/ops').GameOp[];
  severePassive?: import('../engine/ops').GameOp[];
  onTick?: { difficulty: import('../engine/types').Difficulty; onFail: import('../engine/ops').GameOp[] };
  capabilities?: SymptomCapabilities;
}
/** Domaine de magie (Couleur, LDB 48) : ses ATTRIBUTS éditables au Codex — riders « à la touche »
 *  (`effects`, gatés par les Conditions Flow `relation`/`has`), mitigation de Projectile
 *  (`missile`), ops post-incantation au lanceur (`casterOps`). Le `label` correspond au `subType`
 *  d'un Sort d'Arcane (`domainOf`). */
export interface DomainData {
  id: string;
  label: string;
  desc?: string;
  source?: { book: string; page: number };
  /** Effets DÉCLENCHÉS « à la touche » sur une cible d'un Sort du Domaine (Feu → En flammes…) — MÊMES
   *  `TriggeredEffect` éditables que Traits/Atouts, gatés par les Conditions Flow `relation`/`has`. */
  effects?: import('../state/flow').TriggeredEffect[];
  /** Mitigation des Projectiles : ignore les PA d'une matière (`metal`/`nonMagic`) ; `bonusFromBypass`
   *  les ajoute aussi aux Dégâts (Métal). */
  missile?: { bypass: 'metal' | 'nonMagic'; bonusFromBypass?: boolean };
  /** Ops appliquées AU LANCEUR après une incantation réussie (ex. Bête → Peur 1 pendant 1d10 Rounds).
   *  Canal CAPABILITY (pas passive ni effects) : l'effet cible le lanceur lui-même, non une cible.
   *  Exécutées par `domainCasterOps` (engine/domainAttributes) via `applyOps`. */
  casterOps?: import('../engine/ops').GameOp[];
  /** Élément du Souffle conféré par le Talent Magie des Arcanes du Domaine (Cieux → Électricité,
   *  Métal → Corrosif, Ombres → Fumée, Feu → Feu) — lu par le résolveur de Souffle. */
  breathType?: string;
  /** Bonus d'incantation CONDITIONNEL (Aqshy l.157) : +`bonus` par État `perCondition` porté par un
   *  combattant situé à `radiusStat` (Bonus de carac.) mètres du lanceur (géométrie résolue par state).
   *  CAPABILITY irréductible : modifie le JET d'incantation via la géométrie de l'arène → hors GameOp
   *  (cf. 3 canaux passive / effects / capabilities). */
  castBonus?: { perCondition: string; radiusStat: import('../engine/types').CharKey; bonus: number };
  /** Caractéristique des Tests d'Incantation (Langue (Magick)) des Sorts de ce Domaine, à la place de la
   *  carac par défaut (ADE II l.653 : la Magie de la Gueule, réservée aux ogres, se lance sur l'Endurance).
   *  Lue par `castingValue` — porté par la DONNÉE du domaine, aucun sniff d'espèce dans le moteur. */
  castingChar?: import('../engine/types').CharKey;
}
export interface SpellData {
  /** id STABLE (slug du libellé) — cible des `Ref` de sort (sorts de créature, bénédictions/miracles). */
  id: string;
  label: string;
  type: string;
  subType: string | null;
  /** id STABLE du Domaine de magie (= `DomainData.id`, ex. « feu ») — source RUNTIME du chemin
   *  sort→domaine (attributs LDB 48). Dérivé du `subType` (libellé) à l'authoring ; le runtime ne
   *  lit QUE l'id. Absent = Sort sans Domaine (Magie Mineure, Prière…). */
  domainId?: string;
  /** Prière (Béni/Invocation) plutôt qu'un Sort arcanique : branche d'incantation (Test de Prière,
   *  pas de Niveau d'Incantation, non dissipable) lue PAR LA DONNÉE — cf. `castInfo`/`isArcaneSpell`. */
  isPrayer?: boolean;
  /** Famille d'incantation STABLE (id, multilangue) — DISCRIMINANT moteur (familyOf / isArcaneSpell /
   *  canCastFromGrimoire / Chaos) ; `type` ci-dessus n'est plus qu'un libellé d'affichage. */
  family: import('../engine/combatFeatures/types').CastingKind;
  /** Niveau d'Incantation (NI). `null` pour les Prières (Béni/Invocation). */
  cn: number | null;
  /** Portée STRUCTURÉE (LDB 46/47) — d'où le sort peut être lancé. `null` = donnée absente (homebrew
   *  non extrait). Remplace l'ancienne prose re-parsée au runtime ; l'affichage est DÉRIVÉ
   *  (`engine/spellRangeFormat`). */
  range: import('../engine/spellRange').SpellRange | null;
  /** Cible STRUCTURÉE (LDB 47) — qui/quoi est affecté (compte, ZONE par rayon/diamètre, cône, spécial).
   *  `null` = donnée absente. L'aire (ex-`zdeRadiusMeters`) vit désormais ICI (source unique). */
  target: import('../engine/spellRange').SpellTarget | null;
  /** Durée STRUCTURÉE (LDB 47) — instant/Rounds/horloge/lever-du-soleil/spécial. `null` = donnée absente.
   *  L'échelle Rounds (ex-`durationRounds`) vit désormais ICI (source unique). */
  duration: import('../engine/spellDuration').SpellDuration | null;
  desc: string;
  /** Projectile magique (Dégâts résolus façon attaque) — DONNÉE (multilangue ; remplace la regex
   *  `/projectile magique/` sur la desc). `damage` = bonus ADDITIF (+ DR + BFM, LDB 46) ; `ignorePA`/
   *  `ignoreBE` = ignore les PA / le Bonus d'Endurance de la cible. Lus par `evaluateMissile`/IA. */
  missile?: boolean;
  damage?: number;
  ignorePA?: boolean;
  ignoreBE?: boolean;
  // ── MÉTADONNÉES DE RÉSOLUTION (migrées depuis src/data/spellspecs/*.ts — migration #5) ──────────
  // Ces champs sont multilingue-safe (ids/formules, jamais du texte d'affichage).
  // Présents sur toutes les entrées OFFICIELLES (curated:true) ; absents sur les sorts homebrew (frenchy.bzh).
  /** Vrai pour une entrée curée de la base officielle. Absent/false pour les sorts homebrew (frenchy.bzh).
   *  Permet au test de couverture de vérifier que TOUS les sorts officiels ont une spec complète. */
  curated?: boolean;
  // POUSSÉE / TÉLÉPORTATION / ATTAQUES EN CHAÎNE : effets POSITIONNELS désormais portés par des ops
  // IMPURES (`push`/`teleport`/`chain`, on:'caster') dans `effects`, résolus par combatFlow (cf. engine/ops).
  /** Sort « Souffle » (LDB 47 p.244) : délégué à l'attaque de ZONE du Trait Souffle. */
  breathAttack?: true;
  /** OPPOSITION de la cible (multijet dans la modale d'incantation).
   *  `resist` : Test opposé par la caractéristique/compétence `char`/`skill` de la cible.
   *  `contact` : Sort de Portée Contact — frappe via Test opposé de Corps à corps (Bagarre). */
  opposed?: {
    kind: 'resist' | 'contact';
    /** Caractéristique opposée (`resist` uniquement). */
    char?: import('../engine/types').CharKey;
    /** Compétence opposée en libellé (`resist` uniquement, rare — FM, Intelligence, Calme…). */
    skill?: string;
  };
  /**
   * EFFETS du sort — `Flow` ÉDITABLE (système logique unique : `do`/`if`/`test`), source des effets
   * mécaniques appliqués à l'incantation (feuilles EffectOp `{type:'ops', on:'target'|'caster', ops}`).
   * Édité dans le Compendium (CodexEdit → FlowEditor), exécuté par `runCombatFlow`. SOURCE UNIQUE des
   * effets. Import TYPE seul (effacé à la compilation) → la couche data NE dépend PAS d'une valeur
   * de `state` (pureté préservée). Absent = aucun effet mécanique (narratif).
   */
  effects?: import('../state/flow').Flow;
  source: { book: string; page: number };
}

/** Signe astral (ADE2) : table d100 (`rand` = borne haute cumulée), flavor + effet de création. */
export interface StarData {
  /** id STABLE (slug du libellé) — `Combatant.star` le stocke, le runtime résout par `findStarById`
   *  (≠ libellé — multilangue-safe). */
  id: string;
  label: string;
  rand: number;
  signe: string | null;
  classique: string | null;
  ascendant: string | null;
  dates: string | null;
  dieux: string | null;
  apparence: string | null;
  /** Effet ADE2 appliqué AUX ATTRIBUTS DE DÉPART (ch.03 l.38) — donnée éditable au Codex
   *  (`GameOpEditor`) : `charMod` (±carac) et/ou `grantTalent` (talent octroyé). Appliqué une
   *  fois à la création (cf. `applyStarEffect`), pas collecté en passif continu. */
  effect?: import('../engine/ops').GameOp[];
  /** L'Étoile du Sorcier (ADE2 l.62) : fourchette du 1d10 interne `[min, max]` parmi les variantes
   *  partageant `rand:100`. Absent = pas de sous-tirage (signe simple). */
  sub?: [number, number];
  desc: string | null;
  source: { book: string; page: number };
}
/** Lieu (Glorieux Reikland, LDB) : hiérarchie par `parent` (label d'un autre lieu). */
export interface LocationData {
  /** id STABLE (slug du libellé) — cible de `parent` (réf id, ≠ libellé) et des réfs inverses. */
  id: string;
  label: string;
  /** `id` du lieu parent (`LocationData.id`), ou null si racine — réf d'entité, ≠ libellé. */
  parent: string | null;
  prefix: string | null;
  suffix: string | null;
  desc: string | null;
  source: { book: string; page: number };
}
/** Ouvrage WFRP4 référencé (bibliographie). `desc` = HTML de présentation. */
export interface BookData {
  label: string;
  abr: string | null;
  language: string | null;
  folder: string | null;
  desc: string | null;
}
/**
 * Apparence de base d'une espèce de rig (Humain, Ogre, Skaven…) — éditable dans le Compendium.
 * PAR RÉFÉRENCE : `featureKeys` (catalogue d'éléments, résolus par `feat()`), ids de gabarit/tête/
 * jambes, libellé de tenue, couleurs. Les SVG/gabarits restent des registres CODE (résolus par le
 * rig). Le rig (`raceById`) lit ce dataset comme SOURCE et le résout en `RaceDef`.
 */
export interface RaceAppearanceData {
  id: string;
  gabarit: string;
  gabaritOverride?: Record<string, number>;
  palette?: Record<string, string>;
  paletteF?: Record<string, string>;
  head?: string;
  legs?: string;
  armG?: string;
  armD?: string;
  dropHeadgear?: boolean;
  featureKeys?: string[];
  pose?: Record<string, number>;
  tenue?: string;
  colors?: Record<string, string>;
  sex?: 'M' | 'F';
  parts?: { cheveux?: number; visage?: number };
  scale?: number;
  eyes?: { G?: string; D?: string };
}
/** Banque de noms par race (clé : « Humain », « Nain »…) : prénoms M/F + noms de famille (LDB 05). */
export interface NamePool {
  maleFirstNames: string[];
  femaleFirstNames: string[];
  lastNames: string[];
  /** Suffixes de patronyme par sexe du PERSONNAGE (Nain, LDB 05 l.622 : « –sson » fils de…, « –snev »
   *  neveu de…, « –sdottir » fille de…, « –sniz » nièce de…) — le nom de famille est généré depuis le
   *  parent + suffixe quand `lastNames` est vide. Absent = pas de génération par suffixe. */
  lastNameSuffixes?: { M: string[]; F: string[] };
}

export const characteristics = characteristicsJson as any[];
export const species = speciesJson as SpeciesData[];
export const classes = classesJson as ClassData[];
export const careers = careersJson as CareerData[];
export const careerLevels = careerLevelsJson as CareerLevelData[];
export const skills = skillsJson as SkillData[];
export const talents = talentsJson as TalentData[];
export const etats = etatsJson as EtatData[];
/** Maladies (LDB 20) — app-owned éditable au Codex ; le COMPORTEMENT (cycle/symptômes) vit dans
 *  `engine/disease`. `DiseaseDef` (type) y est défini ; ici on n'expose que la DONNÉE. */
export const maladies = maladiesJson as DiseaseDef[];
const DISEASE_BY_ID = new Map(maladies.map((m) => [m.id, m]));
/** Résout une Maladie par son `id` STABLE. */
export function findDiseaseById(id: string): DiseaseDef | undefined {
  return DISEASE_BY_ID.get(id);
}
/** Libellé d'affichage d'une Maladie par son id (repli sur l'id). */
export function diseaseLabel(id: string): string {
  return DISEASE_BY_ID.get(id)?.label ?? id;
}
// Traits app-owned (officiels + homebrew frenchy.bzh Aura de Dhar/Mort, Charnier + suppléments
// Redoutable/Fouissement ZI) — TOUT dans `traits.json` (l'ex-`frenchy-traits.json`, fichier de
// migration one-shot, a été FONDU ici ; chaque entrée garde sa vraie `source` : ZI, frenchy.bzh…).
export const traits = traitsJson as TraitData[];
/** Index des Traits par libellé canonique — lecture des `effects` au runtime (state/triggeredEffects). */
export const traitByLabel: Map<string, TraitData> = new Map(traits.map((t) => [t.label, t]));
/** Index des Traits par `id` STABLE (slug) — lookup runtime indépendant de la langue. */
export const traitById: Map<string, TraitData> = new Map(traits.map((t) => [t.id, t]));
export const findTraitById = (id: string): TraitData | undefined => traitById.get(id);
export const qualities = qualitiesJson as QualityData[];
/** Index des Atouts/Défauts par libellé — lecture des `effects` déclenchés au runtime (triggeredEffects). */
export const qualityByLabel: Map<string, QualityData> = new Map(qualities.map((q) => [q.label, q]));
/** Index des Atouts/Défauts par `id` STABLE (slug) — lookup runtime indépendant de la langue (dispatch). */
export const qualityById: Map<string, QualityData> = new Map(qualities.map((q) => [q.id, q]));
/** Symptômes de maladie (LDB 20) — entités de DONNÉE éditables au Codex (passive/onTick/capabilities). */
export const symptoms = symptomsJson as SymptomData[];
export const symptomById: Map<string, SymptomData> = new Map(symptoms.map((s) => [s.id, s]));
export const findSymptomById = (id: string): SymptomData | undefined => symptomById.get(id);
/** Libellé FR d'un symptôme par son id (repli sur l'id si inconnu). */
export const symptomLabel = (id: string): string => symptomById.get(id)?.label ?? id;
/** Mutations (entités) + Tables de Corruption (plages d100 → réf), DÉCOUPLÉES (cf. data/mutations.ts) —
 *  app-owned éditables au Codex. Le runtime du tirage (`rollMutation`) vit dans `mutations.ts`. */
export const mutations = mutationsJson as MutationData[];
export const mutationTables = mutationTablesJson as MutationTable[];
export const trappings = trappingsJson as TrappingData[];
/** Véhicules / embarcations à coque — FOYER UNIQUE app-owned (data-driven). Trois facettes par
 *  enregistrement (achat / voyage / coque) ; cf. `VehicleData`. La facette `travel` est lue par
 *  `engine/travel` ; les facettes `purchase`/`hull` par le marché et les incidents/combat. */
export const vehicles = vehiclesJson as VehicleData[];
export const vehicleById: Map<string, VehicleData> = new Map(vehicles.map((v) => [v.id, v]));
export const findVehicleById = (id: string): VehicleData | undefined => vehicleById.get(id);

/** Traits & Améliorations de navire (MDG ch.12) — catalogue app-owned éditable au Codex. La DONNÉE (`desc`
 *  verbatim + effet) vit ici ; `engine/navalTraits.ts` ne fait que la LIRE (aucune valeur codée en dur).
 *  `kind` distingue Trait (construction) et Amélioration (ajout/retrait) ; `ranked` = prend un Indice
 *  (« Renforcé 2 », « Peu maniable 1 »). L'EFFET mécanique passe par la langue UNIQUE `GameOp[]` (`passive`,
 *  MÊME vocabulaire/éditeur que traits & mutations) — `ap` (Blindage → PA de coque), `moveMod` (Lissage → M),
 *  `skillDRBonus` (Peu maniable → DR des Tests de Voile/Ramer). Restent en CHAMP DE DOMAINE les sous-systèmes
 *  navire hors vocabulaire combattant : `ram` (Bélier → collision proue/frontale) et `deckCover` (Sabord →
 *  couvert de pont). Absent = pas d'effet mécanisé (Robuste déféré) ou déjà baké dans les colonnes du véhicule
 *  (Renforcé/Solide → E/B). */
export interface NavalTraitData {
  /** id STABLE (slug) — la clé d'appariement avec `ship.traits`/`Combatant.upgrades` (`NavalTraitRef.id`). */
  id: string;
  /** Libellé VERBATIM de BASE (sans Indice) — affichage seul, résolu par `findNavalTrait(id)?.label`. */
  label: string;
  kind: 'trait' | 'amelioration';
  source?: { book: string; page: number };
  desc: string;
  /** Prend un Indice (le libellé authoré peut être « Renforcé 2 ») — l'effet `passive` est répété par niveau. */
  ranked?: boolean;
  /** Effet mécanique en `GameOp[]` (langue unique) — lu par `navalPassiveOps` puis filtré par effet
   *  (`ap`/`moveMod`/`skillDRBonus`), répété ×Indice si `ranked`. MÊME éditeur `GameOpEditor` que les traits. */
  passive?: import('../engine/ops').GameOp[];
  /** Bélier (MDG ch.12 l.221) : bonus de COLLISION (géométrie proue/frontale) — sous-système navire hors
   *  vocabulaire combattant (≠ `ap` qui mitige TOUT) → injecté dans `resolveCollision` via `belierRam`. */
  ram?: { ic: number; ap: number };
  /** Sabord (MDG ch.12 l.364) : la Coque offre un COUVERT total à ses postes — géométrie de Pont, consommée
   *  par `effectiveDeckPostes`/le rendu du Pont. Sous-système navire, hors vocabulaire combattant. */
  deckCover?: boolean;
}
export const NAVAL_TRAITS = navalTraitsJson as NavalTraitData[];
const navalTraitById = new Map(NAVAL_TRAITS.map((t) => [t.id, t]));
/** Entrée du catalogue pour une réf par id STABLE (`NavalTraitRef.id`) — l'Indice vit dans `NavalTraitRef.value`,
 *  PAS dans la clé (plus de parsing de libellé « Renforcé 2 »). PUR. */
export function findNavalTrait(id: string): NavalTraitData | undefined {
  return navalTraitById.get(id);
}
/** Rôles d'équipage naval (MDG ch.14 « Tests d'équipage ») — catalogue app-owned éditable au Codex.
 *  Chaque rôle mappe une (ou plusieurs, ex. Mousse = Voile/Ramer → meilleure) Compétence par `id` STABLE
 *  (+ `spec` pour Artilleur/Cuisinier/Chansonnier). Le `desc` est le verbatim de la colonne « Tâches ». */
export interface CrewRoleData {
  id: string;
  label: string;
  skills: { skillId: string; spec?: string }[];
  desc: string;
}
/** Type de Test d'équipage (MDG ch.14) : rôles contributeurs + rôle ESSENTIEL (son DR compte double). */
export interface CrewTestTypeData {
  id: string;
  label: string;
  roles: string[];
  essential: string;
}
export const crewRoles = crewRolesJson as CrewRoleData[];
const crewRoleById = new Map(crewRoles.map((r) => [r.id, r]));
export const findCrewRoleById = (id: string): CrewRoleData | undefined => crewRoleById.get(id);
export const crewTestTypes = crewTestTypesJson as CrewTestTypeData[];
const crewTestTypeById = new Map(crewTestTypes.map((t) => [t.id, t]));
export const findCrewTestTypeById = (id: string): CrewTestTypeData | undefined => crewTestTypeById.get(id);
/** Groupes d'objet app-owned (taxonomie `subType` id-ifiée) — éditable au Codex. */
export const weaponGroups = weaponGroupsJson as WeaponGroupData[];
// Bestiaire APP-OWNED : officiel + complément « frenchy.bzh » INTÉGRÉ directement dans creatures.json
// (fusionné 2026-06-15, espèce explicite posée) — plus de dataset frenchy séparé à merger.
export const creatures = creaturesJson as CreatureData[];
// Sorts app-owned — officiels + homebrew « frenchy.bzh » des casters (Magie Mineure/Arcanes,
// Bénédictions, Miracles…) TOUT dans `spells.json` (l'ex-`frenchy-spells.json`, migration one-shot,
// a été FONDU ici ; chaque sort garde sa `source`, dont `frenchy.bzh` pour le homebrew).
export const spells = spellsJson as SpellData[];
/** Manœuvres app-owned (attaques naturelles activées — LDB 85) : ENTITÉ de 1ʳᵉ classe éditable au Codex,
 *  effets en GameOp. Octroyées aux créatures via `TraitData.grantsManeuvers` ; résolues par id. */
export const maneuvers = maneuversJson as ManeuverDef[];
/** Niveaux de lumière ambiante app-owned (brouillard de guerre) : `scalar` 0..1 (assombrissement du
 *  rendu) + `baseSightTiles` (rayon de vue de base en cases — réglage MAISON : le LDB ne stat pas la
 *  portée de vue). Édité au Codex. `Scene.ambientLight` réfère un `id` (ou `auto` = suit l'horloge). */
export interface LightLevelDef { id: string; label: string; scalar: number; baseSightTiles: number }
export const lightLevels = lightLevelsJson as LightLevelDef[];
export const LIGHT_LEVEL_BY_ID = new Map(lightLevels.map((l) => [l.id, l]));
export const findLightLevelById = (id: string): LightLevelDef | undefined => LIGHT_LEVEL_BY_ID.get(id);
/** Type de PROP/décor app-owned : couche SÉMANTIQUE (physique `solid`, opacité `opaque`, classe de
 *  `cover`, émission de lumière `light`) — le rendu SVG/label reste dans le catalogue gameIso. Lu par
 *  la walkability (`sceneRules`), la Ligne de Vue/couvert (`lineOfSight`) et la lumière (`vision`).
 *  Édité au Codex. Un prop ABSENT de ce dataset = passable, transparent, sans couvert ni lumière. */
export interface PropData { id: string; solid?: boolean; opaque?: boolean; cover?: 'imparfaite' | 'moyenne' | 'totale'; light?: { radiusTiles: number } }
export const props = propsJson as PropData[];
export const PROP_BY_ID = new Map(props.map((p) => [p.id, p]));
export const findPropById = (id: string): PropData | undefined => PROP_BY_ID.get(id);
/** Domaines de magie app-owned (LDB 48) — ENTITÉ éditable au Codex (attributs en données : onHit,
 *  projectile, post-incantation). Le RUNTIME résout par `id` STABLE (= `SpellData.domainId`, cf.
 *  `findDomainById`) ; `domainByLabel`/`findDomain` restent pour l'authoring/affichage. */
export const domains = domainsJson as DomainData[];
export const domainByLabel: Map<string, DomainData> = new Map(domains.map((d) => [d.label, d]));
export const findDomain = (label: string | null | undefined): DomainData | undefined => (label ? domainByLabel.get(label) : undefined);
/** Index des Domaines par `id` STABLE — lookup RUNTIME indépendant de la langue (sort→domaine). */
export const domainById: Map<string, DomainData> = new Map(domains.map((d) => [d.id, d]));
export const findDomainById = (id: string | null | undefined): DomainData | undefined => (id ? domainById.get(id) : undefined);
export const eyes = eyesJson as DetailColorData[];
export const hairs = hairsJson as DetailColorData[];
/** Calendrier impérial — tables de CONTENU éditables au Codex (cf. `engine/clock.ts` pour la mécanique). */
export const calendarMonths = calendarMonthsJson as { name: string; days: number }[];
export const calendarIntercalary = calendarIntercalaryJson as { name: string; afterMonth: number }[];
export const calendarWeekdays = calendarWeekdaysJson as { name: string }[];
export const calendarPhases = calendarPhasesJson as { key: string; start: number; label: string; icon: string }[];
/** Table de Météo de voyage (EDOC ch.5) — 1 entrée par saison, `ranges` = plages d100 → météo. Éditable au Codex. */
export const weather = weatherJson as { id: string; label: string; ranges: { max: number; weather: string }[] }[];
export const details = detailsJson as DetailsData;
export const stars = starsJson as StarData[];
/** Apparences d'espèce de rig (app-owned, éditable) — SOURCE lue+résolue par `raceById` (rig). */
export const raceAppearance = raceAppearanceJson as RaceAppearanceData[];
export const locations = locationsJson as LocationData[];
const LOCATION_BY_ID = new Map(locations.map((l) => [l.id, l]));
/** Résout un Lieu par son `id` STABLE (cible de `LocationData.parent`). Le libellé ne sert qu'à l'affichage. */
export function findLocationById(id: string | null | undefined): LocationData | undefined {
  return id ? LOCATION_BY_ID.get(id) : undefined;
}
export const books = booksJson as BookData[];
/** Culte/Dieu (LDB 41) : `key` = clé STABLE (« Sigmar »), Bénédictions/Miracles en `Ref[]` (sorts par id),
 *  desc = lore HTML (Codex). Dataset éditable (Compendium) — remplace les `cults/defs/*.ts` (codegen retiré). */
export interface GodData {
  key: string;
  title?: string;
  blessings: Ref[];
  miracles: Ref[];
  desc?: string;
  source?: { book: string; page: number };
}
export const gods = godsJson as GodData[];
export const names = namesJson as Record<string, NamePool>;
/** Personnages pré-tirés (DÉFINITIONS) — app-owned éditable au Codex ; la FABRIQUE (`createHero`)
 *  vit dans `pregens.ts`, qui consomme CE tableau (même référence → mutation live de l'éditeur). */
export const pregens = pregensJson as PregenDef[];
/** Tableau des Oups ! (LDB Maladresses) — app-owned éditable ; consommé par `oups.ts` (même référence). */
export const oups = oupsJson as OupsEntry[];
/** Événements « Entre deux aventures » (LDB d100) — app-owned éditable ; consommé par `interludeEvents.ts`. */
export const interludeEvents = interludeEventsJson as InterludeEvent[];
/** Péripéties de voyage (1d10) — app-owned éditable ; consommé par `peripeties.ts` (même référence). */
export const peripeties = peripetiesJson as Peripetie[];

const ETAT_BY_ID = new Map(etats.map((e) => [e.id, e]));
/** Résout un État par son `id` STABLE (`ConditionId`). */
export function findConditionById(id: string): EtatData | undefined {
  return ETAT_BY_ID.get(id);
}

/** États PSYCHOLOGIQUES (LDB 21) — base app-owned éditable au Codex. Données de Frénésie aujourd'hui ;
 *  Peur/Terreur/Animosité/Haine à migrer (chantier psychologie data-driven). */
export const psychologies = psychologyJson as PsychologyData[];
const PSYCH_BY_ID = new Map(psychologies.map((p) => [p.id, p]));
/** Résout un état psychologique par son `id` STABLE (`PsychType`). Absent → undefined (folding inerte). */
export function findPsychologyById(id: string): PsychologyData | undefined {
  return PSYCH_BY_ID.get(id);
}
/** Libellé d'affichage d'un État par son id (repli sur l'id). SOURCE UNIQUE du nom d'État affiché. */
export function conditionLabel(id: string): string {
  return ETAT_BY_ID.get(id)?.label ?? id;
}
/** Libellé d'affichage d'un état psychologique par son `id` (`PsychType`), repli sur l'id — délègue au
 *  résolveur de libellé GÉNÉRIQUE (`refLabel`), plus de copie locale du motif `MAP.get(id)?.label ?? id`. */
export function psychologyLabel(id: string): string {
  return refLabel('psychology', { id });
}
const ETAT_ID_BY_LABEL = new Map(etats.map((e) => [e.label.toLowerCase(), e.id]));
/** Résout un `id` d'État depuis un LIBELLÉ (authoring : parsing de desc/texte) — insensible à la casse. */
export function conditionIdByLabel(label: string): string | undefined {
  return ETAT_ID_BY_LABEL.get(label.toLowerCase());
}
const SPECIES_BY_ID = new Map(species.map((s) => [s.id, s]));
/** Résout une Espèce par son `id` STABLE (slug du libellé) — réf runtime/données (Combatant.species,
 *  pregens, draft). Le libellé ne sert qu'à l'affichage (`speciesSingular`). */
export function findSpeciesById(id: string | undefined): SpeciesData | undefined {
  return id ? SPECIES_BY_ID.get(id) : undefined;
}
/** id d'espèce RIG (slug, clé `appearance.species`) dérivé d'un id d'espèce RULES (ou chaîne libre) :
 *  slug du LIBELLÉ d'espèce. Pont UNIQUE rules→rig (pregens/draft/creator/defaultAppearance). Défaut Humain. */
export function rigSpeciesId(rulesId: string | undefined): string {
  return slugId(findSpeciesById(rulesId)?.label ?? rulesId ?? 'Humain');
}
/** Seuil d100 de mutation PHYSIQUE d'une espèce par `id` (LDB 19 l.87-91). Défaut **50** = colonne
 *  Humain (LDB) — couvre aussi le Gnome (NADJ « Gnomes et Corruption » : « mutent comme les humains »)
 *  et toute espèce hors Tableau. Les valeurs ≠ 50 (Elfe 0, Nain 5, Halfling 10, Ogre 10) sont en donnée. */
export function mutationBodyMaxForSpecies(id: string | undefined): number {
  return findSpeciesById(id)?.mutationBodyMax ?? 50;
}

/** Affichage SINGULIER de l'espèce d'un INDIVIDU : les `label` du catalogue sont des libellés de
 *  CATÉGORIE au pluriel (« Nains », « Humains (Reiklander) ») ; un personnage est un individu (B1).
 *  Mappe le groupe pluriel → singulier en conservant la sous-espèce entre parenthèses. Repli = tel quel. */
const SPECIES_SINGULAR: Record<string, string> = {
  Humains: 'Humain',
  Halflings: 'Halfling',
  Nains: 'Nain',
  Gnomes: 'Gnome',
  Ogres: 'Ogre',
  'Hauts elfes': 'Haut elfe',
  'Elfes sylvains': 'Elfe sylvain',
};
export function speciesSingular(label: string | undefined): string {
  if (!label) return '';
  const i = label.indexOf('(');
  const group = (i >= 0 ? label.slice(0, i) : label).trim();
  const suffix = i >= 0 ? ' ' + label.slice(i).trim() : '';
  return (SPECIES_SINGULAR[group] ?? group) + suffix;
}
/**
 * Carrières accessibles à une espèce (Tableau des Classes et Carrières aléatoires, LDB 05
 * l.197+ : « certaines ont des restrictions liées à la Race », l.360). `ignoreRestrictions`
 * = option « Mais je veux jouer un elfe sylvain Flagellant ! » (l.362, accord du MJ).
 */
export function careersForSpecies(refCareer: string, ignoreRestrictions = false): CareerData[] {
  if (ignoreRestrictions) return careers;
  return careers.filter((c) => c.rand?.[refCareer] != null);
}
const CAREER_BY_ID = new Map(careers.map((c) => [c.id, c]));
/** Résout une Carrière par son `id` STABLE. Le libellé ne sert qu'à l'affichage. */
export function findCareerById(id: string | undefined): CareerData | undefined {
  return id ? CAREER_BY_ID.get(id) : undefined;
}
const CLASS_BY_ID = new Map(classes.map((c) => [c.id, c]));
/** Résout une Classe par son `id` STABLE (= `CareerData.class`). */
export function findClassById(id: string | undefined): ClassData | undefined {
  return id ? CLASS_BY_ID.get(id) : undefined;
}
export function levelsForCareer(careerId: string): CareerLevelData[] {
  return careerLevels.filter((c) => c.career === careerId).sort((a, b) => a.level - b.level);
}
export function firstLevel(careerId: string): CareerLevelData | undefined {
  return levelsForCareer(careerId)[0];
}
export function findSkill(label: string): SkillData | undefined {
  // Exact d'abord, puis casse ignorée (les statblocs de campagne écrivent « Corps à Corps »).
  return skills.find((s) => s.label === label) ?? skills.find((s) => s.label.toLowerCase() === label.toLowerCase());
}
const SKILL_BY_ID = new Map(skills.map((s) => [s.id, s]));
/** Résout une Compétence par son `id` STABLE (référence structurée — fin du lookup par libellé parsé). */
export function findSkillById(id: string): SkillData | undefined {
  return SKILL_BY_ID.get(id);
}
/** Noyau de RÉFÉRENCE structurée par `id` STABLE — partagé par toutes les refs de la donnée
 *  (compétences, talents, sorts, qualités, possessions, bénédictions…). `id` = slug du libellé
 *  (robuste au renommage) ; `spec` = spécialisation/type concret libre (« Ghur », « Reikland »), non un id. */
export interface Ref {
  id: string;
  spec?: string;
}
/** Référence STRUCTURÉE à une Compétence (`Ref` + valeur de Test IMPRIMÉE) — fin des chaînes « Calme 58 ». */
export interface SkillRef extends Ref {
  value: number;
}
/** Libellé d'affichage d'une `SkillRef` : « Langue (Magick) 63 » (base+spec via `refLabel`, + valeur). */
export function skillRefLabel(ref: SkillRef): string {
  return `${refLabel('skills', ref)} ${ref.value}`;
}
export function findTalent(label: string): TalentData | undefined {
  return talents.find((t) => t.label === label);
}
const TALENT_BY_ID = new Map(talents.map((t) => [t.id, t]));
/** Résout un Talent par son `id` STABLE (référence structurée — fin du lookup par libellé parsé). */
export function findTalentById(id: string): TalentData | undefined {
  return TALENT_BY_ID.get(id);
}
/** Référence STRUCTURÉE à un Talent (`Ref` + niveau `times` ≥2) — fin des chaînes « Maîtrise du combat 2 ». */
export interface TalentRef extends Ref {
  times?: number;
}
/** Libellé d'affichage d'une `TalentRef` : « Magie des Arcanes (Ghur) », « Maîtrise du combat 2 »
 *  (base+spec via `refLabel`, + niveau si ≥2). La spec RESTE dans le libellé (clé du registre combatFeatures). */
export function talentRefLabel(ref: TalentRef): string {
  return refLabel('talents', ref) + (ref.times && ref.times > 1 ? ` ${ref.times}` : '');
}
const WEAPON_GROUP_BY_ID = new Map(weaponGroups.map((g) => [g.id, g]));
/** Résout un Groupe d'objet par son `id` STABLE (= `subType` d'un trapping/Weapon/ItemInstance). */
export function findWeaponGroupById(id: string | null | undefined): WeaponGroupData | undefined {
  return id ? WEAPON_GROUP_BY_ID.get(id) : undefined;
}
/** Libellé d'affichage d'un Groupe d'objet par son id (repli sur l'id). SOURCE UNIQUE du nom de Groupe. */
export function weaponGroupLabel(id: string | null | undefined): string {
  return id ? (WEAPON_GROUP_BY_ID.get(id)?.label ?? id) : '';
}
const WEAPON_GROUP_ID_BY_LABEL = new Map(weaponGroups.map((g) => [g.label.toLowerCase(), g.id]));
/** Résout un `id` de Groupe depuis un LIBELLÉ (authoring/données de Sort « subType » par libellé) —
 *  insensible à la casse. Renvoie l'id si déjà un id connu, sinon résout le libellé. */
export function weaponGroupIdByLabel(label: string | null | undefined): string | undefined {
  if (!label) return undefined;
  if (WEAPON_GROUP_BY_ID.has(label)) return label; // déjà un id
  return WEAPON_GROUP_ID_BY_LABEL.get(label.toLowerCase());
}
const CREATURE_BY_ID = new Map(creatures.map((c) => [c.id, c]));
/** Résout une créature par son `id` STABLE — référence runtime/données (scènes, encounters, rig). */
export function findCreatureById(id: string | undefined): CreatureData | undefined {
  return id ? CREATURE_BY_ID.get(id) : undefined;
}
/** Libellé d'affichage d'une créature par son id (repli sur l'id si introuvable). */
export function creatureLabel(id: string): string {
  return CREATURE_BY_ID.get(id)?.label ?? id;
}
/** Seul lecteur autorisé de la nommé-ité (jamais via `title`) : `true` si la créature est un individu nommé. */
export function isNamed(c: CreatureData): boolean {
  return c.named === true;
}
/** Lookup par LIBELLÉ — réservé à l'AUTHORING/affichage (picker éditeur, Codex) ; le runtime résout par id. */
export function findCreature(label: string): CreatureData | undefined {
  return creatures.find((c) => c.label === label);
}
export function findSpell(label: string): SpellData | undefined {
  return spells.find((s) => s.label === label);
}
/** Signe astral par LIBELLÉ — bord AUTHORING/affichage (l'éditeur, le tirage qui produit un libellé). */
export function findStar(label: string): StarData | undefined {
  return stars.find((s) => s.label === label);
}
const STAR_BY_ID = new Map(stars.map((s) => [s.id, s]));
/** Signe astral par `id` STABLE — lookup RUNTIME indépendant de la langue (`Combatant.star` = id). */
export function findStarById(id: string | null | undefined): StarData | undefined {
  return id ? STAR_BY_ID.get(id) : undefined;
}

const TRAPPING_BY_ID = new Map(trappings.map((t) => [t.id, t]));
/** Résout une Possession par son `id` STABLE (référence structurée — ≠ `findTrapping` par libellé, authoring). */
export function findTrappingById(id: string): TrappingData | undefined {
  return TRAPPING_BY_ID.get(id);
}
/** Résout une Qualité par son `id` STABLE. */
export function findQualityById(id: string): QualityData | undefined {
  return qualityById.get(id);
}
const SPELL_BY_ID = new Map(spells.map((s) => [s.id, s]));
/** Résout un Sort par son `id` STABLE. */
export function findSpellById(id: string): SpellData | undefined {
  return SPELL_BY_ID.get(id);
}
export const MANEUVER_BY_ID = new Map(maneuvers.map((m) => [m.id, m]));
/** Résout une Manœuvre par son `id` STABLE (réf `TraitData.grantsManeuvers` → résolveur générique). */
export function findManeuverById(id: string): ManeuverDef | undefined {
  return MANEUVER_BY_ID.get(id);
}
const GOD_BY_KEY = new Map(gods.map((g) => [g.key, g]));
/** Résout un Culte/Dieu par sa clé STABLE (« Sigmar »). */
export function findGodById(key: string): GodData | undefined {
  return GOD_BY_KEY.get(key);
}
/** Clés de culte disponibles, triées (choix de divinité à la création, joker « Béni (Au choix) »). */
export const CULT_KEYS: string[] = gods.map((g) => g.key).sort();
/** Les six Bénédictions d'un culte, IDS de sort (le runtime/grimoire compare par id ; l'UI résout en
 *  libellé). Culte inconnu → []. */
export function blessingsOf(cult: string): string[] {
  return (findGodById(cult)?.blessings ?? []).map((r) => r.id);
}
/** Les Miracles d'un culte, IDS de sort. Culte inconnu → []. */
export function miraclesOf(cult: string): string[] {
  return (findGodById(cult)?.miracles ?? []).map((r) => r.id);
}

/** Référence à une Qualité d'objet (`Ref` + Indice éventuel : « Solide 3 » → value 3). */
export interface QualityRef extends Ref {
  value?: number;
}
/** Quantité d'une possession conférée : nombre fixe (« (3) ») ou jet de dés structuré (« (1d10) »). */
export type CountSpec = { fixed: number } | { roll: DiceSpec };
/** Référence à une Possession : par `id` du catalogue (+ quantité éventuelle) OU texte NARRATIF hors
 *  catalogue (statblocs de créature : « collection d'alcool sans pareille »). */
export type TrappingRef = (Ref & { count?: CountSpec }) | { text: string; count?: CountSpec };
/** EMPLACEMENT d'avancement (espèce/carrière) : un espace de CHOIX, pas une instance résolue —
 *  ref simple, joker « (Au choix) » (+ specs restreintes « Fléau ou À deux mains »), choix « A ou B »,
 *  ou tirage aléatoire (« N Talent aléatoire »). Chaque branche concrète EST un `Ref`. */
export type AdvancementRef =
  | { ref: Ref }
  | { wildcard: Ref; specOptions?: string[] }
  | { choice: AdvancementRef[] }
  | { random: number };

/** Résout une entrée de dataset par (catégorie, `id`) — rendu/lookup des refs structurées. */
export function findById(category: string, id: string): { label: string } | undefined {
  switch (category) {
    case 'skills': return findSkillById(id);
    case 'talents': return findTalentById(id);
    case 'trappings': return findTrappingById(id);
    case 'weaponGroups': return findWeaponGroupById(id);
    case 'qualities': return findQualityById(id);
    case 'spells': return findSpellById(id);
    case 'maneuvers': return findManeuverById(id);
    case 'careers': return findCareerById(id);
    case 'classes': return findClassById(id);
    case 'races': return findSpeciesById(id);
    case 'etats': return findConditionById(id);
    case 'psychology': return findPsychologyById(id);
    case 'maladies': return findDiseaseById(id) ? { label: findDiseaseById(id)!.label } : undefined;
    default: return undefined;
  }
}
/** Libellé CONCRET d'une `Ref` : « Magie des Arcanes (Ghur) » — base (repli sur l'id) + spec. SOURCE
 *  UNIQUE du nom affiché ET de la clé runtime (combatFeatures/grimoire). */
export function refLabel(category: string, ref: Ref): string {
  const base = findById(category, ref.id)?.label ?? ref.id;
  return ref.spec ? `${base} (${ref.spec})` : base;
}
/** Copie une `QualityRef` de catalogue en `QualityInstance` RUNTIME FRAÎCHE (`{id, value?}`) — objet neuf
 *  (le runtime mute `qualities` : enchantements, munitions). Plus d'aplatissement en chaîne « id value ». */
export function qualityInstance(q: QualityRef): import('../engine/types').QualityInstance {
  return q.value != null ? { id: q.id, value: q.value } : { id: q.id };
}
/** Libellé d'affichage d'une `QualityRef` (ou `QualityInstance` runtime) : « Solide 3 », « Tranchante ». */
export function qualityRefLabel(q: QualityRef): string {
  return q.value != null ? `${refLabel('qualities', q)} ${q.value}` : refLabel('qualities', q);
}
/** Libellé d'affichage d'une `SkillInstance` (id+spec → « Langue (Magick) »). Repli sur l'id. */
export function skillInstanceLabel(s: { skillId: string; spec?: string }): string {
  return refLabel('skills', { id: s.skillId, spec: s.spec });
}
/** Libellé CONCRET d'une `TalentInstance` (id+spec → « Magie des Arcanes (Ghur) ») — clé du registre
 *  combatFeatures + affichage. Repli sur l'id. */
export function talentConcrete(t: { talentId: string; spec?: string }): string {
  return refLabel('talents', { id: t.talentId, spec: t.spec });
}
/** Libellé d'affichage/clé concrète d'un `AdvancementRef` : « Savoir (Au choix) », « A ou B »,
 *  « 3 Talent aléatoire », « Magie des Arcanes (Ghur) ». SOURCE UNIQUE (Codex + résolution création). */
export function advancementLabel(category: string, a: AdvancementRef): string {
  if ('ref' in a) return refLabel(category, a.ref);
  if ('wildcard' in a) return a.specOptions?.length
    ? `${refLabel(category, a.wildcard)} (${a.specOptions.join(' ou ')})`
    : `${refLabel(category, a.wildcard)} (Au choix)`;
  if ('choice' in a) return a.choice.map((x) => advancementLabel(category, x)).join(' ou ');
  return a.random === 1 ? 'Talent aléatoire' : `${a.random} Talent aléatoire`;
}
/** id de base d'un `AdvancementRef` simple (ref/wildcard) — pour matcher par id une compétence/un talent
 *  POSSÉDÉ (ex. compétence de revenus). undefined pour choice/random (pas un id unique). */
export function advancementBaseId(a: AdvancementRef): string | undefined {
  if ('ref' in a) return a.ref.id;
  if ('wildcard' in a) return a.wildcard.id;
  return undefined;
}
/** Libellé d'affichage d'une `TrappingRef` : « Marteau », « Pamphlétaire (3) », « Chiffon (1d10) », ou
 *  texte narratif hors catalogue. SOURCE UNIQUE (Codex, créateur, marchand, inventaire). */
export function trappingRefLabel(ref: TrappingRef): string {
  const base = 'text' in ref ? ref.text : (findTrappingById(ref.id)?.label ?? ref.id);
  const count = ref.count ? ('fixed' in ref.count ? ` (${ref.count.fixed})` : ` (${formatDice(ref.count.roll)})`) : '';
  return base + count;
}
