/**
 * Registre du Codex — SOURCE UNIQUE des catégories consultables en jeu.
 *
 * Chaque catégorie projette un tableau de `src/data` (façade `index.ts`) en `CodexItem` RICHE :
 * faits-clés + **sections structurées** dont les entités citées (compétences, talents, sorts,
 * traits, qualités…) sont des **liens `CodexRef`** vers leur propre fiche (cross-références).
 * **Ajouter une catégorie = UNE entrée dans `CODEX`** ; enrichir = ajouter des sections (data),
 * pas un composant.
 */
import { useSyncExternalStore } from 'react';
import {
  species, careers, characteristics, classes, skills, talents,
  qualities, trappings, siegeEngines, weaponGroups, etats, maladies, creatures, traits, spells, maneuvers, domains, mutations, mutationTables, gods,
  stars, locations, findLocationById, books, bookAbr, careerLevels, raceAppearance, levelsForCareer, skillRefLabel, talentRefLabel, refLabel, trappingRefLabel, qualityRefLabel, advancementLabel, advancementBaseId, weaponGroupLabel, qualitySubtypeLabel, qualityTypeLabel,
  skillInstanceLabel, talentConcrete, careersForSpecies, findCareerById, findClassById, findSpeciesById, eyes, hairs, details, names, RACE_KEY_LABEL,
  pregens, oups, interludeEvents, peripeties, psychologyLabel,
  allAxes,
  calendarMonths, calendarIntercalary, calendarWeekdays, calendarPhases, weather, symptoms, symptomLabel, windsOfMagicTable,
  isNamed, specIdsOf, specLabel,
  vehicles, celestialHouses, groups, psychologies, seaShanties, crewRoles, crewTestTypes, NAVAL_TRAITS, findTrappingById, structures, regles,
  CHAR_ABR, rigSpeciesId, navalPorts, shipConstruction, effectTables, disponibilite,
  conditionLabel,
} from '../../data';
// #157 (audit d'exposition Codex) : catalogues app-owned chargés par un module dédié plutôt que la
// façade `index.ts` — réutilisés TELS QUELS (même patron que `POWER_ESTIMATE` etc. ci-dessous, déjà
// importés directement d'`engine/massBattle`).
import type { RaceKey, SourceRef } from '../../data/schemas/common';
import { MOUNT_PROFILES } from '../../engine/mountTravel';
import { MOUNT_INCIDENTS, VEHICLE_PROBLEMS } from '../../engine/travelTables';
import type { TravelTableEntry } from '../../engine/travelTables';
import { TAVERN_GAMES } from '../../engine/tavernGame';
import { OBSESSIONS } from '../../data/obsessions';
import { STRUCTURE_CRITICALS } from '../../data/structureCriticals';
import { ARTILLERY_MISFIRE } from '../../data/artilleryMisfire';
import { LAND_CARGOES } from '../../engine/landCargo';
import { CARGOES } from '../../engine/seaVoyage';
import type { SeaEventDef, ManannFactor } from '../../engine/seaVoyage';
import { RIVER_PERILS } from '../../engine/riverNavigation';
import { MORALE_FACTORS, MORALE_BANDS } from '../../engine/crewMorale';
import { STEAM_BREAKDOWNS } from '../../engine/shipBuild';
import { traumaFicheById } from '../../engine/trauma';
import type { ShipCritEntry } from '../../data/shipCriticals';
import { datasetArray, datasetObject } from '../../data/overrides';
import type { CritTableEntry, MiscastRowEntry } from '../../data/overrides';
import { activeVariant } from '../../engine/variants';
import { statName } from '../../engine/statEntry';
import { damageString } from '../../engine/items';
import { rangeSpecLabel, ammoRangeModLabel, conditionalDamageNote } from '../weaponStats';
import { formatSpellRange, formatSpellTarget, formatSpellDuration } from '../../engine/spellRangeFormat';
import { talentMaxLabel } from '../../engine/careerSlots';
import type { AdvancementRef, WaterExposureModifier } from '../../data';
import { ATTACK_LABEL } from '../../engine/creatureAttacks';
import { POWER_ESTIMATE, MIGHT_MODIFIERS, WAR_MACHINES, STRUCTURES as MASS_BATTLE_STRUCTURES, BATTLE_HAZARDS } from '../../engine/massBattle';
import { AVAILABILITY_RANK } from '../../engine/disponibilite';
import { ACTIVITIES } from '../../engine/activities';
import type { ActivityContext, OutcomeBand, BattleSide, BattleOutcomeTarget, BattleOutcomeScale, BattleCond } from '../../engine/activities';
import { traitLabels, optionalLabels, traitArgSkeleton } from '../../engine/traits/dispatch';
import { CHAR_KEYS, CHAR_LABELS, HIT_LOCATION_LABELS, DIFFICULTY_LABELS, type Combatant, type HitLocation } from '../../engine/types';
import { SIZE_LABEL, effectiveSize, woundsForSize } from '../../engine/size';
import { bonus, effectiveChar } from '../../engine/characteristics';
import { skillBaseValue } from '../../engine/skills';
import { sizeFromTraits } from '../../state/spawn';
import { formatDice } from '../../engine/dice';
import { formatDiseaseTime } from '../../engine/disease';
import { costPerEnc } from '../../engine/harvest';
import { formatMoney, priceToMoney } from '../../engine/money';
import type { EntityAppearance } from '../../engine/authoringAppearance';
import type { MutationData } from '../../data/mutations';
import { passiveSection, effectsSection, careerGrantSection, spellFlowSection, capabilitySection } from './describe';
import { opRows, tableRows } from './opRows';
import { humanizeCastBonus } from './humanize';
import { reverseGroups, bookContents } from './relations';
import { MANEUVER_ACTIVATION_LABEL, MANEUVER_TARGETING_LABEL, formatManeuverMeasure } from './maneuverLabels';
import { slugId } from '../../data/slug';

export type CodexGroup = 'Personnage' | 'Compétences' | 'Équipement' | 'Effets' | 'Magie' | 'Monde' | 'Tables';

/** Ordre d'affichage des familles (onglets du haut). */
export const CODEX_GROUPS: CodexGroup[] = ['Personnage', 'Compétences', 'Équipement', 'Effets', 'Magie', 'Monde', 'Tables'];

/**
 * Identité GÉNÉRIQUE d'une entrée de dataset — clé STABLE servant À LA FOIS de `CodexItem.label`
 * (ce que le navigateur passe à l'éditeur) ET de cible du `findIndex` côté `CodexEdit`. Précédence
 * `label → name → key → id` (couvre gods keyé `key`, maladies keyées `name`, raceAppearance keyé `id`,
 * pregens keyés `name`…). EXCEPTION careerLevels : pas de clé mono-champ UNIQUE (le même libellé de
 * niveau « Recrue » revient sur plusieurs carrières) → composite carrière + niveau, identique des deux
 * côtés (l'éditeur réécrit la bonne entrée, plus de collision sur le 1er homonyme).
 */
export function entryKey(e: Record<string, unknown>): string {
  if (typeof e.career === 'string' && typeof e.level === 'number')
    return `${findCareerById(e.career)?.label ?? e.career} · N${e.level} ${e.label ?? ''}`.trim();
  return String(e.label ?? e.name ?? e.key ?? e.id ?? '');
}

/** Vue de projection Codex de `SourceRef` (`src/data/schemas/common.ts:36` — SEULE forme à importer,
 *  #563 dette soldée) : `book` y est déjà résolu en ABRÉVIATION affichable (`bookAbr`, cf. `src()`
 *  ci-dessous), jamais l'id stable — projection d'AFFICHAGE, pas la donnée. */
export type CodexSource = Pick<SourceRef, 'page'> & { book: string };
export interface CodexFact {
  label: string;
  value: string;
  /** Lien Codex du LIBELLÉ (facultatif) — même forme que `CodexRow['kv'].kref` : la bande statbloc
   *  (profil M+carac+B) devient cliquable quand le fait référence une entité du Codex. */
  kref?: { category: string; id: string; label: string };
}
/** Une ligne d'une section. */
export type CodexRow =
  | { t: 'text'; text: string }
  | { t: 'kv'; k: string; v: string; kref?: { category: string; id: string; label: string } }
  /** Lien vers une autre fiche. `id` = identité STABLE de la cible (navigation) ; `label` reste la clé
   *  de résolution (base, affichage/repli) ; `show` = libellé affiché, qui PORTE les Indices
   *  (« 8 Tentacules +8 ») et est transmis au Codex/popover comme instance.
   *  `badge` = annotation de fin NON cliquable (rang « N2 », « facultatif », « Bénédiction »…). */
  | { t: 'ref'; category: string; id: string; label: string; show: string; badge?: string }
  /** CHOIX « A ou B » : chaque option est un lien cross-réf cliquable, séparées par « ou ». */
  | { t: 'choice'; category: string; options: { id: string; label: string; show: string }[] }
  /** Mini sous-en-tête à l'intérieur d'une section (« Compétences », « Talents »…). */
  | { t: 'sub'; label: string }
  /** Bloc REPLIABLE (`<details class="fold">`) : `summary` visible, `text` (Markdown) dévoilé au clic.
   *  Porte la forme TECHNIQUE d'atelier (« Détail technique ») sous la phrase humaine — cf. `describe`. */
  | { t: 'fold'; summary: string; text: string }
  /** Note d'atelier NON cliquable, en fin de section (« se tranchent à l'étape 5 ») — jamais un lien,
   *  jamais une règle inventée : un simple repère de parcours (#393 P2, verdict juge vision P1 item 8). */
  | { t: 'nb'; text: string };
export interface CodexSection {
  title: string;
  layout?: 'list' | 'chips' | 'grid';
  rows: CodexRow[];
}
/** Regroupement EXPLICITE de sections en UN onglet de fiche (ex. « Profil » = carac+compétences+
 *  talents). Quand une catégorie le fournit, l'onglet groupe ses sections ; sinon = un onglet/section. */
export interface CodexTab {
  title: string;
  sections: CodexSection[];
}
/** Entrée normalisée, rendue uniformément par `CodexEntry`. */
export interface CodexItem {
  /** Identité STABLE (id de l'entité source ; slug dérivé du libellé pour les datasets sans id
   *  propre — cf. `CODEX_SPECS`) — la clé de navigation/comparaison ; `label` reste l'AFFICHAGE. */
  id: string;
  label: string;
  sub?: string;
  /** Groupe pour la liste hiérarchique (famille de race, classe de carrière, dossier de créature…). */
  group?: string;
  meta?: CodexFact[];
  /** Sections riches (statbloc, niveaux de carrière, bénédictions…) avec liens cross-réf. */
  sections?: CodexSection[];
  /** Regroupement EXPLICITE des sections en onglets (sinon : un onglet par section). */
  tabs?: CodexTab[];
  /** Corps prose en **Markdown** (verbatim de la source), rendu par `<Prose>` (auto-liage des règles). */
  desc?: string;
  /** Exergue Markdown VERBATIM (extrait de la desc, jamais reformulé) : citation/tract mis en tête de
   *  fiche sur `ParchmentCard` (bande parchemin). Optionnel — item sans exergue = fiche telle quelle. */
  exergue?: string;
  source?: CodexSource | null;
  /** Apparence (rig) à prévisualiser dans la fiche : créature, difformité de mutation, trait à visuel. */
  appearance?: EntityAppearance;
  /** `id` de créature pour résoudre l'aperçu rig PAR ID (Nuées/non-bipèdes lisent leurs traits du record). */
  previewRef?: string;
  /** Statbloc COMPACT (bande parchemin en tête de fiche) : profil imprimé (M + 10 caracs + Blessures)
   *  + traits en chips cross-réf. Projection data-driven (catégorie créatures). */
  statblock?: { profile: CodexFact[]; traits: CodexRow[] };
}
/** Facette de filtre d'une catégorie (chips multi-sélection au-dessus de la recherche) : lit UN
 *  champ de l'item ; ses valeurs sont DÉRIVÉES des items au rendu (jamais une liste en dur). */
export interface CodexFacet {
  key: string;
  label: string;
  valueOf: (item: CodexItem) => string | undefined;
}
export interface CodexCategory {
  key: string;
  label: string;
  group: CodexGroup;
  /** Sous-groupe FR (dépliable dans la barre de catégories) — cf. `CodexCategorySpec.cluster`. */
  cluster?: string;
  /** Réf de source de la TABLE entière (« LDB 18 », « MDG 13 ») — affichée discrètement, JAMAIS
   *  dans le libellé joueur (une réf de livre nue n'est pas un nom de catégorie). */
  sourceRef?: string;
  /** Projection PARESSEUSE (getter, cache par version) : les datasets étant mutés EN PLACE
   *  (`overrides.ts::setDataset`), la re-projection après `invalidateCodexLookup()` lit la donnée
   *  FRAÎCHE. Ne se re-matérialise qu'à l'invalidation (persist DEV, rare), jamais par rendu. */
  items: CodexItem[];
  /** Facettes de filtre — DÉRIVÉES des items dans la même re-projection (livre partout, groupe là où porté). */
  facets?: CodexFacet[];
}

const src = (s: { book?: string; page?: number } | null | undefined): CodexSource | null =>
  s && s.book ? { book: bookAbr(s.book), page: s.page ?? 0 } : null;

const fact = (label: string, value: unknown): CodexFact | null =>
  value == null || value === '' || value === '–' ? null : { label, value: String(value) };

const facts = (...xs: (CodexFact | null)[]): CodexFact[] => xs.filter((x): x is CodexFact => x != null);

const join = (...parts: (string | null | undefined)[]): string | undefined => {
  const s = parts.filter(Boolean).join(' · ');
  return s || undefined;
};

/** Fait « Spécialisations » d'une Compétence/Talent : pool DÉRIVÉ (`specIdsOf` — registre partagé si
 *  `specsSource`, sinon `specs[]`) rendu en libellés FR via `specLabel`. Null si le domaine n'a aucune spec. */
const specsFact = (cat: 'skills' | 'talents', def: { id: string; specsSource?: import('../../data').SpecsSource; specs?: import('../../data').SpecEntry[] }): string | null => {
  const ids = specIdsOf(def);
  return ids.length ? ids.map((id) => specLabel(cat, def.id, id)).join(', ') : null;
};

/** Prix d'une possession (`{gold,silver,bronze}`) → libellé monnaie canon, ou null si gratuit/absent. */
const priceLabel = (p: { gold: number; silver: number; bronze: number } | null | undefined): string | null =>
  p && (p.gold || p.silver || p.bronze) ? formatMoney(priceToMoney(p)) : null;

/** Fait « Dégâts » d'une arme/pièce : chaîne imprimée + note CONDITIONNELLE dérivée des capacités de qualité
 *  (Bélier `ram` / Siège `siege`, #135) — jamais un total qui suggère un dégât inconditionnel quand la
 *  donnée dit le contraire. `conditionalDamageNote` = SOURCE UNIQUE (`weaponStats.ts`), la MÊME que
 *  `weaponStatParts` pour les armes EN MAIN (Sac/popover/fiche personnage). */
const damageFact = (t: { damage: import('../../engine/types').WeaponDamageSpec | null; qualities: { id: string; value?: number }[]; onHitEffects?: import('../../engine/flowCore').TriggeredEffect[] }): string | undefined =>
  join(t.damage ? damageString(t.damage) : null, conditionalDamageNote(t));

/** Famille d'une race/variante : « Humains (Reiklander) » → « Humains ». */
const family = (label: string): string => label.split(' (')[0].trim();

/** Id résolu d'une référence par (catégorie, libellé) — même résolution que `CodexRef` (recherche
 *  exacte puis casse pliée dans les items DÉJÀ projetés de la catégorie cible) ; repli sur un slug
 *  du libellé si la cible n'est pas (encore) au catalogue (défensif — arme naturelle hors catalogue,
 *  entrée cassée… — ne doit jamais faire échouer un build). */
const refId = (category: string, label: string): string => codexLookup(category, label)?.id ?? slugId(label);

/** Lien cross-réf : nom canonique pour le lookup (via le parseur PARTAGÉ `parseStatEntry` —
 *  « 8 Tentacules +8 » → « Tentacules »), libellé complet conservé pour l'affichage + l'instance. */
const refRow = (category: string, raw: string): CodexRow => {
  const label = statName(raw);
  return { t: 'ref', category, id: refId(category, label), label, show: raw.trim() };
};
const refRows = (category: string, items?: string[] | null): CodexRow[] => (items ?? []).map((s) => refRow(category, s));
/** Lien cross-réf par `id` STABLE DÉJÀ CONNU (skip le round-trip par libellé de `refRow` — patron
 *  `critEntryItem`/traumas) : compétence/talent référencé par un axe de forces (axes.json, #409). */
const idRefRow = (category: 'skills' | 'talents', id: string, spec?: string): CodexRow => {
  const label = refLabel(category, { id, spec });
  return { t: 'ref', category, id, label, show: label };
};
const kvRows = (pairs: [string, unknown][]): CodexRow[] =>
  pairs
    .filter(([, v]) => v != null && v !== '' && v !== '–')
    .map(([k, v]) => ({ t: 'kv', k, v: String(v) } as CodexRow));

/** Section de pastilles cross-réf (skip si vide). */
const chips = (title: string, category: string, items?: string[] | null): CodexSection | null =>
  items && items.length ? { title, layout: 'chips', rows: refRows(category, items) } : null;

/** Compose des sections en écartant les vides/null. */
const sections = (...xs: (CodexSection | null | undefined | false)[]): CodexSection[] =>
  xs.filter((s): s is CodexSection => !!s && s.rows.length > 0);

/** Sections INVERSES d'une entité (« Créatures ayant ce trait », « Carrières par rang », « Talents le
 *  conférant »…) dérivées de la brique relationnelle id-based (`relations.ts`). Chaque groupe = une
 *  section de chips cross-réf cliquables ; le détail (rang/facultatif/Bénédiction) = badge non cliquable.
 *  Vide si l'entité n'est référencée nulle part. À SPREAD dans `sections(...)`. */
const reverseSections = (category: string, id: string | undefined): CodexSection[] =>
  id == null ? [] : reverseGroups(category, id).map((g) => ({
    title: g.title,
    layout: 'chips' as const,
    rows: g.referrers.map((r) => ({ t: 'ref', category: r.category, id: r.id, label: r.label, show: r.label, badge: r.detail } as CodexRow)),
  }));

/** Fourchette de Statut social d'une carrière (LDB 05) : `status` du 1er échelon → celui du dernier
 *  (« Bronze 1 → Or 1 »). Un seul échelon ⇒ statut simple ; aucune donnée ⇒ null (fait omis). */
const careerStatusRange = (levels: import('../../data').CareerLevelData[]): string | null => {
  if (!levels.length) return null;
  const first = levels[0].status;
  const last = levels[levels.length - 1].status;
  return first === last ? first : `${first} → ${last}`;
};

/** Libellés FR du déclenchement / ciblage d'une Manœuvre (Codex). */
const WEAPON_GROUP_KIND_LABEL: Record<string, string> = { weapon: 'Groupe d’arme', ammo: 'Munitions', armour: 'Armure', inventory: 'Inventaire' };
/** Libellés FR des CAPACITÉS irréductibles d'un Symptôme (drapeaux lus par la machinerie de maladie). */
const SYMPTOM_CAP_LABEL: Record<string, string> = {
  blocksHealing: 'Bloque la guérison (1 PB)', amputation: 'Gangrène (amputation)',
  stickyExtenue: 'Exténué collant', contagious: 'Contagieux', nausea: 'Nausée (Sonné)',
  endTest: 'Test de fin de Durée',
};
/** Libellé d'un jet de dés (`{n,d,plus?}`) — « 1d10 », « 2d10+2 ». */
const diceLabel = formatDice;
/** Libellés FR des types de résultat « Oups ! » (Maladresse, LDB 12) — affichage (donnée = `kind` STABLE). */
const OUPS_KIND_LABEL: Record<string, string> = {
  selfWound: 'Auto-blessure', weaponDamageActLast: 'Arme abîmée + agit en dernier', actionPenalty: 'Malus d’Action',
  loseMovement: 'Perte de Mouvement', loseAction: 'Perte d’Action', trauma: 'Traumatisme', hitAlly: 'Touche un allié',
  misfire: 'Incident de Tir',
};
/** Libellés FR des CAPACITÉS de Trait (drapeaux booléens lus par le moteur — `TraitCapabilities`).
 *  Les capacités psy (psychType/psychImmune/psychIndice) sont surfacées à part (méta). */
const TRAIT_CAP_LABEL: Record<string, string> = {
  bonusWoundsBE: 'Blessures bonifiées (+BE)', swarm: 'Nuée', wardSave: 'Sauvegarde invulnérable',
  magicResistance: 'Résistance à la magie', damageImmunity: 'Immunité aux dégâts',
  counterOnDefenseWin: 'Contre-attaque (défense gagnée)', counterRequiresFastParry: 'Contre exige arme Rapide', unstable: 'Instable', painless: 'Insensible à la douleur',
  psychImmuneIfAhead: 'Immunité psy si en avantage', mindless: 'Sans esprit', bestial: 'Bestial',
  coldBlooded: 'Sang-froid', stupid: 'Stupidité', rage: 'Rage', territorial: 'Territorial', skittishMount: 'Monture ombrageuse',
  fly: 'Vol', leap: 'Bond', stride: 'Foulée', seesInDark: 'Vision nocturne',
  spellcaster: 'Lanceur de Sorts', frenzyCapable: 'Peut entrer en Frénésie', undead: 'Mort-vivant',
};
/** Libellés FR des CAPACITÉS de Qualité d'arme/armure (`QualityCapabilities`). */
const QUALITY_CAP_LABEL: Record<string, string> = {
  fastStrike: 'Rapide', slowStrike: 'Lente', fumbleOn9: 'Dangereuse', pushback: 'Perturbante',
  bladeTrap: 'Piège-lame', damagesArmour: 'Endommage l’armure', firearm: 'Arme à feu', canFireWhileEngaged: 'Tir au contact',
  magazine: 'À répétition', salvo: 'Salve', areaFire: 'Tir de zone', crewedTeam: 'Arme d’équipe', parryAP: 'Protectrice',
  layerable: 'Flexible', critImmuneOdd: 'Impénétrable', apIgnoredOnEven: 'Partielle', apIgnoredOnImpaleCrit: 'Points faibles',
  unbreakable: 'Incassable', magic: 'Magique',
};

// ── Activités (activities.json) — libellés FR d'affichage, SOURCE UNIQUE partagée par la projection
//    Codex ci-dessous ET l'éditeur `CodexEdit` (selects). La logique reste keyée par id STABLE. ──
export const ACTIVITY_CONTEXT_LABEL: Record<ActivityContext, string> = {
  interlude: 'Entre deux aventures', voyage: 'Voyage (terre)', mer: 'Mer',
  bataille: 'Bataille — préparation', 'bataille-round': 'Bataille — Scène de Round',
  auberge: 'Auberge (hub de ville)',
};
export const OUTCOME_ON_LABEL: Record<'success' | 'failure' | 'fumble', string> = {
  success: 'Succès', failure: 'Échec', fumble: 'Maladresse',
};
export const BATTLE_COND_LABEL: Record<BattleCond, string> = {
  generalDown: 'Général ennemi tombé', intervention: 'Un autre PJ a frappé',
  noIntervention: 'Aucune intervention', combatWon: 'Combat gagné', combatLost: 'Combat perdu',
};
export const BATTLE_TARGET_LABEL: Record<BattleOutcomeTarget, string> = {
  might: 'Puissance courante', startMight: 'Puissance de départ',
  allyTestMod: 'Mod. Tests alliés (permanent)', firstRoundBonus: 'Bonus au 1er Round',
  planningBonus: 'Bonus au prochain Test de Planification',
};
export const BATTLE_SCALE_LABEL: Record<BattleOutcomeScale, string> = {
  fixed: 'Plat', perDR: '× DR', perHit: '× touches', perKill: '× ennemis tués',
};
export const BATTLE_SIDE_LABEL: Record<BattleSide, string> = { ally: 'Armée alliée', enemy: 'Armée ennemie' };

/** Section « Issues par Degrés de Réussite » d'une Activité (bandes `OutcomeBand[]`) : une sous-tête par
 *  bande (issue + fourchette de DR + gate de bataille) puis note verbatim, résolveur, rendu, effets et
 *  issues de bataille. Vide si l'Activité n'a pas de table d'issues. */
function outcomeBandsSection(bands?: OutcomeBand[]): CodexSection | null {
  if (!bands?.length) return null;
  const rows: CodexRow[] = [];
  for (const b of bands) {
    const head = [
      b.on ? OUTCOME_ON_LABEL[b.on] : 'Toute issue',
      b.minSL != null || b.maxSL != null ? `DR ${b.minSL ?? '−∞'} … ${b.maxSL ?? '+∞'}` : null,
      b.when ? BATTLE_COND_LABEL[b.when] : null,
    ].filter(Boolean).join(' · ');
    rows.push({ t: 'sub', label: head });
    if (b.note) rows.push({ t: 'text', text: b.note });
    if (b.resolver) rows.push({ t: 'kv', k: 'Résolveur', v: b.resolver });
    if (b.payoutPct != null) rows.push({ t: 'kv', k: 'Rendu', v: `${b.payoutPct} %` });
    if (b.ops?.length) rows.push({ t: 'kv', k: 'Effet', v: `${b.ops.length} op(s) sur le Personnage` });
    for (const o of b.battle ?? [])
      rows.push({ t: 'kv', k: 'Bataille', v: `${BATTLE_TARGET_LABEL[o.target]} ${BATTLE_SCALE_LABEL[o.scale]} ${o.amount >= 0 ? '+' : ''}${o.amount}${o.side ? ` (${BATTLE_SIDE_LABEL[o.side]})` : ''}` });
    if (b.chains?.length) rows.push({ t: 'kv', k: 'Enchaîne', v: b.chains.join(', ') });
  }
  return { title: 'Issues par Degrés de Réussite', layout: 'list', rows };
}

/**
 * SOURCE UNIQUE du contenu structuré d'une fiche de race — onglets Profil / Carrières / Détails.
 * Consommée par le Codex (`registry.races`) ET l'étape Race du créateur (`SpeciesRaceScreen`, ses
 * sections Caractéristiques/Compétences/Talents seulement — Carrières/Détails restent au Codex), pour
 * qu'elles ne puissent plus diverger. Données tirées des MÊMES tables que le créateur
 * (`careersForSpecies`, `details`, `eyes`, `hairs`). Les faits-clés (M/Destin/Résilience) restent en
 * en-tête (méta), pas ici ; le tirage aléatoire (création) est ajouté PAR le créateur.
 */
/** Une ENTRÉE de compétence/talent de race : « A ou B » (`choice`) → ligne de CHOIX (chaque option
 *  cliquable), sinon un simple lien cross-réf. Lit l'`AdvancementRef` STRUCTURÉ (plus de split de prose). */
const choiceOrRef = (category: string, a: AdvancementRef): CodexRow => {
  if ('choice' in a) {
    return {
      t: 'choice', category,
      options: a.choice.map((x) => {
        const lbl = advancementLabel(category, x);
        const name = statName(lbl);
        return { id: advancementBaseId(x) ?? refId(category, name), label: name, show: lbl };
      }),
    };
  }
  return refRow(category, advancementLabel(category, a));
};

/** Section « Caractéristiques de base » d'une race — chaque carac affiche son écart racial (±). */
export function raceCharSection(s: (typeof species)[number]): CodexSection {
  const rows: CodexRow[] = CHAR_KEYS.map((k) => {
    const base = s.baseChar?.[k] ?? 20;
    const diff = base - 20;
    return {
      t: 'kv',
      k: CHAR_ABR[k],
      v: diff !== 0 ? `${base} (${diff > 0 ? '+' : ''}${diff})` : String(base),
      kref: { category: 'characteristics', id: k, label: CHAR_LABELS[k] },
    };
  });
  return { title: 'Caractéristiques de base', layout: 'grid', rows };
}

/** Section « Compétences de race » — chips cliquables, « A ou B » éclaté en choix. */
export function raceSkillSection(s: (typeof species)[number]): CodexSection | null {
  const rows = s.skills.map((a) => choiceOrRef('skills', a));
  return rows.length ? { title: 'Compétences de race', layout: 'chips', rows } : null;
}

/** Section « Talents de race » — chips cliquables, « A ou B » éclaté en choix. Note d'atelier finale
 *  (#393 P2, verdict juge vision P1 item 8) : les choix/tirages (« au d100 ») ne se tranchent pas ici,
 *  mais à l'étape 5 (Compétences & Talents) du créateur. */
export function raceTalentSection(s: (typeof species)[number]): CodexSection | null {
  const rows = s.talents.map((a) => choiceOrRef('talents', a));
  if (!rows.length) return null;
  return { title: 'Talents de race', layout: 'chips', rows: [...rows, { t: 'nb', text: 'se tranchent à l’étape 5' }] };
}

/** Section « Carrières accessibles » d'une race — groupées par classe, cliquables (→ fiche carrière). */
export function raceCareerSection(s: (typeof species)[number]): CodexSection | null {
  const accessible = careersForSpecies(s.refCareer);
  const rows: CodexRow[] = [];
  for (const cl of classes) {
    const list = accessible.filter((c) => c.class === cl.id);
    if (list.length) rows.push({ t: 'sub', label: cl.label }, ...list.map((c) => refRow('careers', c.label)));
  }
  return rows.length ? { title: 'Carrières accessibles', layout: 'chips', rows } : null;
}

/** Section « Détails » d'une race — âge, taille, yeux & cheveux, noms (tables de création). */
export function raceDetailSection(s: (typeof species)[number]): CodexSection {
  const ref = s.refChar;
  // `bySpecies` reste label-keyé (clé OUVERTE, #313 hors périmètre) : pont id→label via `RACE_KEY_LABEL`.
  const refLabelForText = RACE_KEY_LABEL[ref];
  const txt = details.texts;
  const eyeColors = [...new Set(eyes.map((e) => e.color[ref]).filter(Boolean))];
  const hairColors = [...new Set(hairs.map((e) => e.color[ref]).filter(Boolean))];
  const rows: CodexRow[] = [
    { t: 'sub', label: 'Âge' },
    { t: 'text', text: `${details.ageBase[ref] ?? details.ageBase.humain} + ${Math.round(details.ageRoll[ref] ?? 1)}d10 ans` },
  ];
  if (txt.age.bySpecies[refLabelForText]) rows.push({ t: 'text', text: txt.age.bySpecies[refLabelForText] });
  rows.push({ t: 'sub', label: 'Taille' }, { t: 'text', text: `${details.heightBase[ref] ?? details.heightBase.humain} + ${Math.round(details.heightRoll[ref] ?? 1)}d10 cm` });
  const tailleTxt = txt.taille.bySpecies[refLabelForText] ?? txt.taille.all;
  if (tailleTxt) rows.push({ t: 'text', text: tailleTxt });
  if (eyeColors.length) rows.push({ t: 'sub', label: 'Yeux' }, { t: 'text', text: eyeColors.join(', ') });
  if (hairColors.length) rows.push({ t: 'sub', label: 'Cheveux' }, { t: 'text', text: hairColors.join(', ') });
  const namesTxt = txt.nom.bySpecies[refLabelForText] ?? txt.nom.bySpecies['Humain'];
  if (namesTxt) rows.push({ t: 'sub', label: 'Noms' }, { t: 'text', text: namesTxt });
  return { title: 'Âge, taille & apparence', layout: 'list', rows };
}

export function raceFicheTabs(s: (typeof species)[number]): CodexTab[] {
  const career = raceCareerSection(s);
  return [
    { title: 'Profil', sections: sections(raceCharSection(s), raceSkillSection(s), raceTalentSection(s)) },
    ...(career ? [{ title: 'Carrières', sections: [career] }] : []),
    { title: 'Détails', sections: [raceDetailSection(s)] },
  ];
}

/** SOURCE UNIQUE de la fiche d'un Trait (partagée par la catégorie « Traits » ET le filtre
 *  « Psychologie ») : manœuvres conférées + passifs + effets + réfs INVERSES (créatures/mutations) ;
 *  la capacité psy (LDB 21) remonte en méta (type + immunité + Indice fixe). */
/** Statbloc compact d'une créature : profil IMPRIMÉ (M + les 10 caracs, « – » si inexistante —
 *  LDB 76, Schéma des Profils) + Blessures (valeur livre `char.B` si imprimée, sinon formule
 *  BF+2×BE+BFM × Taille, LDB 85) + traits en chips cross-réf. Zéro logique par-créature. */
function creatureStatblock(c: (typeof creatures)[number]): NonNullable<CodexItem['statblock']> {
  const cell = (label: string, v: number | null | undefined, kref?: CodexFact['kref']): CodexFact => ({ label, value: v != null ? String(v) : '–', kref });
  const size = sizeFromTraits(c.traits) ?? 'moyenne';
  const wounds = typeof c.char.B === 'number'
    ? c.char.B
    : woundsForSize(bonus(c.char.force ?? 0), bonus(c.char.endurance ?? 0), bonus(c.char['force-mentale'] ?? 0), size);
  return {
    profile: [
      cell('M', c.char.M, { category: 'characteristics', id: 'mouvement', label: 'Mouvement' }),
      ...CHAR_KEYS.map((k) => cell(CHAR_ABR[k], c.char[k], { category: 'characteristics', id: k, label: CHAR_LABELS[k] })),
      { label: 'B', value: String(wounds), kref: { category: 'characteristics', id: 'blessure', label: 'Blessure' } },
    ],
    traits: refRows('traits', traitLabels(c.traits)),
  };
}

const traitItem = (t: (typeof traits)[number]): CodexItem => {
  const cap = t.capabilities;
  return {
    id: t.id, label: t.label, sub: traitArgSkeleton(t), desc: t.desc, source: src(t.source), appearance: t.appearance,
    meta: facts(
      cap?.psychType ? fact('Psychologie', psychologyLabel(cap.psychType)) : null,
      cap?.psychImmune ? fact('Immunité', '(Psychologie)') : null,
      cap?.psychIndice != null ? fact('Indice', cap.psychIndice) : null,
    ),
    sections: sections(
      capabilitySection(cap as Record<string, unknown> | undefined, TRAIT_CAP_LABEL),
      chips('Manœuvres conférées', 'maneuvers', (t.grantsManeuvers ?? []).map((r) => refLabel('maneuvers', r))),
      passiveSection(t.passive), effectsSection(t.effects),
      ...reverseSections('traits', t.id), // Créatures ayant ce trait · Mutations le conférant
    ),
  };
};

// ── Fraîcheur du Codex : invalidation, version, projections paresseuses ─────────────────────────
// `setDataset` (persist d'une édition Codex) splice les tableaux de `src/data` EN PLACE : les
// projections ci-dessous redonnent la donnée FRAÎCHE à condition d'être RE-EXÉCUTÉES. Chaque
// catégorie matérialise donc ses `items` (et ses facettes dérivées) PARESSEUSEMENT, cachés tant que
// la version ne bouge pas ; `invalidateCodexLookup()` (appelé par `CodexEdit` au persist) bump la
// version → le prochain accès re-projette, et les composants abonnés (`useCodexVersion`) re-rendent.
let LOOKUP: Map<string, { byId: Map<string, CodexItem>; exact: Map<string, CodexItem>; folded: Map<string, CodexItem> }> | null = null;
let LOOKUP_VERSION = 0;
const VERSION_LISTENERS = new Set<() => void>();

/** Version courante de la donnée Codex — bumpée à chaque invalidation. */
export const codexLookupVersion = (): number => LOOKUP_VERSION;

/** Invalide index ET projections (donnée modifiée — persist de `CodexEdit`) : le prochain accès
 *  (`codexLookup`, `c.items`, `c.facets`) reconstruit depuis les datasets live, et les composants
 *  abonnés via `useCodexVersion()` re-rendent. */
export function invalidateCodexLookup(): void {
  LOOKUP = null;
  LOOKUP_VERSION++;
  for (const l of VERSION_LISTENERS) l();
}

const subscribeCodex = (l: () => void): (() => void) => {
  VERSION_LISTENERS.add(l);
  return () => VERSION_LISTENERS.delete(l);
};

/** Abonne un composant à la fraîcheur du Codex : re-rend après chaque `invalidateCodexLookup()`.
 *  La valeur sert aussi de dépendance de `useMemo` sur `c.items` (cf. `CompendiumScreen`). */
export function useCodexVersion(): number {
  return useSyncExternalStore(subscribeCodex, codexLookupVersion);
}

/** Libellé de la facette hiérarchique (`group`) par catégorie. */
const GROUP_FACET_LABEL: Record<string, string> = {
  races: 'Famille', careers: 'Classe', mutations: 'Type', psychologie: 'Type',
  creatures: 'Dossier', locations: 'Lieu parent', books: 'Dossier', careerLevels: 'Carrière',
};

/** Facettes d'une catégorie, DÉRIVÉES de ses items projetés : une facette n'existe que si des items
 *  PORTENT le champ (livre source partout ; hiérarchie `group` là où la catégorie en a une). */
function deriveFacets(key: string, items: CodexItem[]): CodexFacet[] | undefined {
  const facets: CodexFacet[] = [];
  if (items.some((i) => i.source?.book)) facets.push({ key: 'book', label: 'Livre', valueOf: (i) => i.source?.book });
  if (items.some((i) => i.group)) facets.push({ key: 'group', label: GROUP_FACET_LABEL[key] ?? 'Groupe', valueOf: (i) => i.group });
  return facets.length ? facets : undefined;
}

/** Spec d'une catégorie : identité + projection `build` (exécutée paresseusement, re-exécutable). */
interface CodexCategorySpec {
  key: string;
  label: string;
  group: CodexGroup;
  /** Sous-groupe FR : les catégories d'un même `cluster` se replient sous UN dépliable dans la barre
   *  de catégories (anti-avalanche des groupes touffus Effets/Tables). Absent = pastille à plat. */
  cluster?: string;
  /** Réf de source de la table (« LDB 18 ») — hors du libellé, cf. `CodexCategory.sourceRef`. */
  sourceRef?: string;
  build: () => CodexItem[];
}

/** Catégorie à projections PARESSEUSES (cache keyé sur la version d'invalidation). */
function makeCategory(spec: CodexCategorySpec): CodexCategory {
  let items: CodexItem[] | null = null;
  let facets: CodexFacet[] | undefined;
  let builtAt = -1;
  const fresh = (): CodexItem[] => {
    if (!items || builtAt !== LOOKUP_VERSION) {
      items = spec.build();
      facets = deriveFacets(spec.key, items);
      builtAt = LOOKUP_VERSION;
    }
    return items;
  };
  return {
    key: spec.key,
    label: spec.label,
    group: spec.group,
    cluster: spec.cluster,
    sourceRef: spec.sourceRef,
    get items() { return fresh(); },
    get facets() { fresh(); return facets; },
  };
}

/** Libellé d'une fiche de Traumatisme par id, SANS crasher si la réf est cassée (contrairement à
 *  `traumaFicheById`, qui lève — le Codex reste défensif comme `codexLookup`). */
const traumaLabelOf = (id: string): string => { try { return traumaFicheById(id).label; } catch { return id; } };

/** Item Codex d'une entrée de table de Blessures Critiques par Localisation (LDB 18 « Traumatisme » ET
 *  AA « approche alternative », #157) — 8 catégories (4 familles LDB + 4 AA), MÊME projection : plage
 *  d100 → nom, effet immédiat (`ops`, même vocabulaire GameOp que passifs/sorts) + Traumatismes engendrés
 *  en cross-réf (résolus par id → libellé, comme les Tables de Corruption pour les mutations). */
function critEntryItem(e: CritTableEntry): CodexItem {
  return {
    id: e.id, label: e.label,
    sub: `d100 ${e.min}–${e.max}`,
    desc: e.desc,
    meta: facts(
      typeof e.blessures === 'number' ? fact('Blessures', e.blessures) : null,
      e.trivial ? fact('Type', 'Triviale (« T »)') : null,
      e.lethal ? fact('Létal', 'oui') : null,
    ),
    sections: sections(
      passiveSection(e.ops, 'Effet immédiat'),
      e.traumas?.length
        ? {
            title: 'Traumatismes engendrés', layout: 'chips',
            rows: e.traumas.map((id) => { const label = traumaLabelOf(id); return { t: 'ref', category: 'traumas', id, label, show: label } as CodexRow; }),
          }
        : null,
    ),
  };
}

/** Item Codex d'une entrée de table de voyage d100 (`TravelTableEntry` — Incidents de monte EDOC 7,
 *  Problèmes de véhicule EDOC 7, Rencontres EDOC 8, #157 suite) — MÊME projection pour les 3
 *  familles : plage d100 → texte + Dégâts véhicule éventuels + effet GameOp sur les occupants. */
function travelEntryItem(e: TravelTableEntry, occupantsTitle: string): CodexItem {
  return {
    id: e.id, label: e.label,
    sub: `d100 ${e.min}–${e.max}`,
    desc: e.text,
    meta: facts(fact('Dégâts véhicule', e.vehicleWounds ?? null)),
    sections: sections(passiveSection(e.occupantOps, occupantsTitle)),
  };
}

/** Item Codex d'une entrée de Critique de coque (`ShipCritEntry` — MDG 13 navire, MSRC 7 fluvial,
 *  #157 suite) : plage d10 → effet immédiat (`ops`) + Test d'équipage (échec) authoré en `GameOp`, MÊME
 *  vocabulaire que les autres Critiques (`critEntryItem`). */
function shipCritEntryItem(e: ShipCritEntry): CodexItem {
  const ct = e.crewTest;
  return {
    id: e.id, label: e.label,
    sub: `d10 ${e.min}–${e.max}`,
    desc: e.note,
    meta: facts(
      typeof e.shrapnel === 'number' ? fact('Éclats (Indice)', e.shrapnel) : null,
      e.hullCrits ? fact('Critiques Coque suppl.', e.hullCrits) : null,
    ),
    sections: sections(
      passiveSection(e.ops, 'Effet immédiat'),
      ct
        ? {
            title: 'Test d’équipage',
            layout: 'list',
            rows: [
              { t: 'kv', k: 'Jet', v: ct.skillId ? `${refLabel('skills', { id: ct.skillId })}${ct.difficulty ? ` ${DIFFICULTY_LABELS[ct.difficulty]}` : ''}` : 'Automatique (aucun Test)' } as CodexRow,
              { t: 'kv', k: 'Cible', v: ct.crewTarget === 'deck' ? 'Toute personne sur le pont' : 'Équipage du poste tiré au sort' } as CodexRow,
            ],
          }
        : null,
      ct ? passiveSection(ct.onFail, 'Conséquence (échec du Test)') : null,
    ),
  };
}

/** Item Codex d'un Événement de bord/de port (`SeaEventDef` — MDG 15, #157 suite) : plage de jet
 *  (d100 modifié par l'Humeur de Manann, ou 2d10) → texte verbatim. */
function seaEventItem(e: SeaEventDef): CodexItem {
  return { id: e.id, label: e.label, sub: `${e.min}–${e.max}`, desc: e.desc };
}

/** Item Codex d'un Facteur d'Humeur de Manann (`ManannFactor` — MDG 15, #157 suite) : effet signé
 *  (Nd10 + constante) appliqué UNE fois par navire. */
function manannFactorItem(f: ManannFactor): CodexItem {
  const eff = f.effect;
  const magnitude = eff.d10 > 0 ? diceLabel({ n: eff.d10, sides: 10, plus: eff.flat || undefined }) : String(eff.flat);
  return {
    id: f.id, label: f.label,
    meta: facts(fact('Effet sur l’Humeur de Manann', `${eff.sign > 0 ? '+' : '−'}${magnitude}`)),
  };
}

/** Libellé d'une TABLE de modificateur d'Exposition hydrique (MSRC 16 p.91, #157 suite). */
const WATER_TABLE_LABEL: Record<string, string> = { 'source-d-eau': 'Source d’eau', 'blessures-et-etats': 'Blessures et États' };

/** Section « Modificateurs » d'Exposition hydrique — groupée par table (Source d'eau / Blessures et
 *  États), chaque ligne portant son contexte d'application (Ingestion/Immersion). */
function waterModifiersSection(mods: WaterExposureModifier[]): CodexSection | null {
  if (!mods.length) return null;
  const groups = [...new Set(mods.map((m) => m.table))];
  const rows: CodexRow[] = [];
  for (const g of groups) {
    rows.push({ t: 'sub', label: WATER_TABLE_LABEL[g] ?? g });
    for (const m of mods.filter((x) => x.table === g))
      rows.push({ t: 'kv', k: m.label, v: `${m.mod > 0 ? '+' : ''}${m.mod} (${m.appliesTo.join(', ')})` });
  }
  return { title: 'Modificateurs', layout: 'list', rows };
}

/** Exergue d'une fiche : SÉLECTION STRUCTURELLE (pas d'heuristique fragile) de la citation/tract d'une
 *  desc. Les desc de Carrière (LDB 2) suivent la convention d'épigraphe WFRP — un paragraphe
 *  ENTIÈREMENT cité `« … »` (parfois en italique `*« … »*`) SUIVI d'un paragraphe d'attribution (tiret
 *  `–`/`—`/`-`, parfois échappé `\-`) — sur 93/96 carrières. On lève ce couple VERBATIM (règle stricte 5)
 *  et on le retire du corps (pas de doublon visuel entre l'exergue et l'onglet Description) ; une desc
 *  sans épigraphe (ex. Chevalier Errant : citation sans attribution suivante) reste entière, exergue absent. */
const QUOTE_PARA = /^\s*\*?\s*«/;
const ATTRIB_PARA = /^\s*\*?\s*\\?\s*[–—-]/;
export function extractEpigraph(desc: string): { epigraph?: string; body: string } {
  const paras = desc.split(/\n\n+/);
  for (let i = 0; i < paras.length - 1; i++) {
    const q = paras[i].trim();
    if (QUOTE_PARA.test(q) && q.includes('»') && ATTRIB_PARA.test(paras[i + 1].trim())) {
      return {
        epigraph: `${q}\n\n${paras[i + 1].trim()}`,
        body: paras.filter((_, j) => j !== i && j !== i + 1).join('\n\n'),
      };
    }
  }
  return { body: desc };
}

// ── LOT 1 #422 : famille NAVALE (MDG 12/13/15) — Ports, Progression, Navigation, Périls, Météo,
//    Construction navale. Ports & sous-tableaux de construction restent des CATÉGORIES-tableau (une
//    fiche par entité, patron `criticalsTete`) ; Navigation/Périls/Météo sont des FICHES DE RÈGLE
//    UNIQUES (dataset-objet, MÊME patron que `waterExposure`, #157 suite) — chaque config imbriquée
//    (Salissures, Orientation, Détroits, Tourbillons…) devient une section plutôt qu'une entité isolée. ──

/** Libellé FR d'une entrée de `production`/`surplus`/`demande` d'un Port (`naval-ports.json`) : id réel
 *  de `sea-cargo.json` → lien cross-réf ; marqueur `commerce`/`minimum-vital` (hors catalogue de
 *  cargaison, LDB/MDG 15 l.343-349) → texte simple non cliquable. */
function portCargoRow(id: string, qty?: number): CodexRow {
  const cargo = CARGOES.find((c) => c.id === id);
  const label = cargo?.label ?? (id === 'commerce' ? 'Commerce (marqueur)' : id === 'minimum-vital' ? 'Minimum vital (marqueur)' : id);
  const show = qty != null ? `${label} (${qty})` : label;
  return cargo ? { t: 'ref', category: 'seaCargo', id: cargo.id, label, show } : { t: 'text', text: show };
}

/** Libellés FR des 5 modes de la table PROGRESSION D'UN NAVIRE (`naval-progression.json`, MDG 13 l.68-75). */
const PROGRESSION_MODE_LABEL: Record<string, string> = {
  plus2: 'Progression maximale (M+2)', plus1: 'Bonne progression (M+1)', normal: 'Progression normale (M)',
  minus1: 'Progression lente (M−1)', half: 'Lutte pour avancer (M÷2)',
};

/** Libellés FR des 7 gabarits de coque standard (`ship-construction.json::standard`, MDG 12 l.120-129). */
const SHIP_SIZE_LABEL: Record<string, string> = {
  minuscule: 'Minuscule', 'tres-petite': 'Très petite', petite: 'Petite', moyenne: 'Moyenne',
  grande: 'Grande', enorme: 'Énorme', monstrueuse: 'Monstrueuse',
};

/** Libellés FR des 4 Traits de CONSTRUCTION (`ship-construction.json::constructionTraits`, sans champ
 *  `label` en donnée — id STABLE déjà la clé, MDG 12 l.167-193). */
const CONSTRUCTION_TRAIT_LABEL: Record<string, string> = {
  'peu-maniable': 'Peu maniable', renforce: 'Renforcé', robuste: 'Robuste', solide: 'Solide',
};

/** Fait signé (« +10 % », « −20 », « 0 ») — évite de dupliquer le ternaire de signe à chaque site. */
const signedFact = (label: string, v: number | undefined, suffix = ''): CodexFact | null =>
  v == null ? null : fact(label, `${v > 0 ? '+' : ''}${v}${suffix}`);

/** Section « Propulsion & Manœuvrabilité » (MDG 12 l.131-144, `ship-construction.json::propulsion`/
 *  `::manoeuvrability`) — règle GLOBALE de construction (pas une entité par gabarit) : répétée telle
 *  quelle sur chaque fiche de coque (patron « note de règle partagée », comme `Ligne CE` sur un profil
 *  de créature). Lecture seule — les 2 sous-tables restent hors des 3 catégories-tableau (aucun id
 *  propre par ligne côté source), mais le FICHIER entier reste couvert par le schéma/la garde d'exposition. */
function shipConstructionRulesSection(): CodexSection {
  const p = shipConstruction.propulsion;
  return {
    title: 'Propulsion & Manœuvrabilité (règle de construction)', layout: 'list',
    rows: [
      { t: 'kv', k: 'Propulsion secondaire — malus au coût', v: `${p.secondaryMalus > 0 ? '+' : ''}${p.secondaryMalus}` } as CodexRow,
      { t: 'kv', k: 'Propulsion secondaire — M minimum', v: String(p.secondaryMinM) } as CodexRow,
      ...shipConstruction.manoeuvrability.map((m) => ({
        t: 'kv', k: `Manœuvrabilité ${m.manDR >= 0 ? '+' : ''}${m.manDR}`, v: `Coût ${m.costPct >= 0 ? '+' : ''}${m.costPct} %`,
      } as CodexRow)),
    ],
  };
}

// ── LOT 1 #422 : famille RÈGLES LDB — Coût des Augmentations (07), Disponibilité & Troc (59), Accidents
//    de Conduite d'attelage / Ivresse (09), Surchargé par palier (61). Coût des Augmentations/Surchargé
//    restent des CATÉGORIES-tableau (une bande/un palier = une entité, id/label ajoutés en donnée pour
//    l'exposition, #422) ; Disponibilité & Troc est une FICHE DE RÈGLE UNIQUE (dataset-objet, patron
//    `waterExposure`) ; Accidents de Conduite / Ivresse restent des CATÉGORIES-tableau (id/name déjà
//    en donnée, MÊME patron que `incidentsMonture`/`problemesVehicule`). ──

/** Libellés FR des 4 issues de l'Accident de Conduite d'attelage (`driving-mishap.json::effect`, LDB 09
 *  l.140-149) — vocabulaire machine (`DrivingMishapEffect`) lu par `mishapCausesCrash`. */
const DRIVING_MISHAP_EFFECT_LABEL: Record<string, string> = {
  harness: 'Harnais cassé', jolt: 'Cahots de la route', wheel: 'Roue brisée', crash: 'Essieu cassé (Accidenté)',
};

/** Libellés FR des 5 résultats du Tableau d'Ivresse (`drunkenness.json::effect`, LDB 09 l.475-481) —
 *  vocabulaire machine lu par `drunkStaggers`/`soberUp`. */
const DRUNKENNESS_EFFECT_LABEL: Record<string, string> = {
  bravoure: 'Bravoure du Marienburgher', ami: 'Meilleur ami', staggering: 'La pièce tourne',
  belligerent: 'Tous, un par un', blackout: 'Trou noir (gueule de bois)',
};

/** Section « % de Disponibilité » (LDB 59 l.25-30, `disponibilite.json::dispoPct`) — une sous-tête par
 *  classe (Limitée/Rare), % de réussite du Test (d100 ≤ %) par taille de colonie. */
function dispoPctSection(rows: (typeof disponibilite)['dispoPct']): CodexSection {
  const rowsOut: CodexRow[] = [];
  for (const r of rows) {
    rowsOut.push({ t: 'sub', label: r.availability } as CodexRow);
    rowsOut.push({ t: 'kv', k: 'Village', v: `${r.pct.village} %` } as CodexRow);
    rowsOut.push({ t: 'kv', k: 'Ville', v: `${r.pct.ville} %` } as CodexRow);
    rowsOut.push({ t: 'kv', k: 'Cité', v: `${r.pct.cite} %` } as CodexRow);
  }
  return { title: '% de Disponibilité (Test d100 ≤ %, par taille de colonie)', layout: 'list', rows: rowsOut };
}

/** Section « Ratios de Troc » (LDB 59 l.68-76, `disponibilite.json::barterRatios`) — pour chaque
 *  Disponibilité de l'objet DONNÉ, le ratio `give:get` contre chaque Disponibilité de l'objet ACQUIS. */
function barterRatiosSection(rows: (typeof disponibilite)['barterRatios']): CodexSection {
  const rowsOut: CodexRow[] = [];
  for (const r of rows) {
    rowsOut.push({ t: 'sub', label: `Donné : ${r.give}` } as CodexRow);
    for (const acquired of AVAILABILITY_RANK) {
      const ratio = r.ratios[acquired];
      rowsOut.push({ t: 'kv', k: `Acquis : ${acquired}`, v: `${ratio.give} : ${ratio.get}` } as CodexRow);
    }
  }
  return { title: 'Ratios de Troc (donné : acquis)', layout: 'list', rows: rowsOut };
}

// ── LOT 3 #422 (FINAL) : les 3 dernières exemptions AUDIT — Empoignade (LDB 14, fiche de règle
//    UNIQUE), Incantations Imparfaites/Colère des dieux (LDB 46/40, DIALECTE compilé — PAS de vrais
//    `GameOp`, cf. `MiscastRowEntry`/`engine/miscast.ts::JsonRow` — renderer DÉDIÉ ci-dessous, jamais
//    `passiveSection`), enjeux de la cascade de nuit (`night-stakes.json`, catégorie-tableau simple). ──

/** Libellé lisible d'un montant du DIALECTE miscast (nombre / dé, éventuellement sin-paramétré / 1+Péché
 *  — `JsonFormula`, `engine/miscast.ts`). Le sin-paramétrage n'est résolu qu'à l'exécution (Points de
 *  Péché du lanceur) : ici, affichage d'AUTEUR (« 1d10 + Points de Péché »), jamais une valeur bakée. */
function miscastAmountLabel(a: unknown): string {
  if (typeof a === 'number') return String(a);
  if (a && typeof a === 'object') {
    if ('sinPlus1' in a) return '1 + Points de Péché';
    if ('dice' in a) {
      const d = (a as { dice: { n: number; sides: number; sinPlus?: boolean } }).dice;
      return `${d.n}d${d.sides}${d.sinPlus ? ' + Points de Péché' : ''}`;
    }
  }
  return String(a);
}

/** Une op du DIALECTE miscast (`JsonOp`) → sa ligne Codex — sous-ensemble des `op` réellement présents
 *  dans `miscast.json` (`condition`/`wounds`/`corruption`/`reduceToZero`/`castPenalty`, cf.
 *  `engine/miscast.ts::expandOp`). Chip cross-réf pour l'État ; texte structuré pour le reste. */
function miscastOpRow(o: Record<string, unknown>): CodexRow {
  switch (o.op) {
    case 'condition': {
      const name = String(o.name ?? '');
      const label = conditionLabel(name);
      const value = o.sinPlus1Value ? '1 + Points de Péché' : o.value != null ? miscastAmountLabel(o.value) : null;
      const dur = o.durationRounds != null ? `${miscastAmountLabel(o.durationRounds)} Round(s)` : undefined;
      const show = value && value !== '1' ? `${value} × ${label}` : label;
      return { t: 'ref', category: 'etats', id: name, label, show, badge: dur };
    }
    case 'wounds':
      return { t: 'kv', k: 'Blessures', v: `${miscastAmountLabel(o.amount)} (ignorant les PA)` };
    case 'corruption':
      return { t: 'kv', k: 'Corruption', v: `+${o.amount as number} point(s)` };
    case 'reduceToZero':
      return { t: 'text', text: 'Points de Blessure réduits à 0' };
    case 'castPenalty': {
      const skillId = o.skill ? String(o.skill) : undefined;
      const dur = o.rounds != null ? `${miscastAmountLabel(o.rounds)} Round(s)`
        : o.hours != null ? `${miscastAmountLabel(o.hours)} heure(s)`
        : o.minutes != null ? `${miscastAmountLabel(o.minutes)} minute(s)`
        : o.days != null ? `${o.days as number} jour(s)` : undefined;
      const eff = o.blocked ? 'Bloqué' : o.maxZeroDR ? 'DR plafonné à 0' : `${(o.mod as number | undefined) ?? 0}`;
      return skillId
        ? { t: 'ref', category: 'skills', id: skillId, label: refLabel('skills', { id: skillId }), show: `${eff}${dur ? ` (${dur})` : ''}` }
        : { t: 'kv', k: 'Magie', v: `${eff}${dur ? ` (${dur})` : ''}` };
    }
    default:
      return { t: 'text', text: String(o.op) };
  }
}

/** Section « Test imbriqué » d'une entrée miscast (« Résistance Accessible ou Sonné »), palier
 *  `onFailHard` inclus (« si vous échouez avec DR ≤ N → EN PLUS »). */
function miscastTestSection(t: NonNullable<MiscastRowEntry['test']>): CodexSection {
  const who = t.skill ? refLabel('skills', { id: t.skill }) : t.characteristic ? CHAR_LABELS[t.characteristic as keyof typeof CHAR_LABELS] : 'Test';
  const rows: CodexRow[] = [
    { t: 'kv', k: 'Test', v: `${who} ${DIFFICULTY_LABELS[t.difficulty as keyof typeof DIFFICULTY_LABELS]}` },
    { t: 'sub', label: 'Échec' },
    ...t.onFail.map(miscastOpRow),
  ];
  if (t.onFailHard) rows.push({ t: 'sub', label: `Échec ≤ DR ${t.onFailHard.dr}` }, ...t.onFailHard.ops.map(miscastOpRow));
  return { title: 'Test imbriqué', layout: 'list', rows };
}

/** Item Codex d'une entrée de table miscast (Incantation Imparfaite / Colère des dieux) — plage d100 →
 *  nom, effet immédiat (`ops`, dialecte) + Test imbriqué éventuel + relance (cascade/multiplication). */
function miscastRowItem(e: MiscastRowEntry): CodexItem {
  return {
    id: e.id, label: e.label, sub: `d100 ${e.min}–${e.max}`,
    source: src(e.source),
    meta: facts(e.reroll ? fact('Relance', e.reroll === 'majeure' ? 'Cascade → Tableau Majeur' : 'Multiplication (2 tirages Mineurs)') : null),
    sections: sections(
      e.ops?.length ? { title: 'Effet immédiat', layout: 'list', rows: e.ops.map(miscastOpRow) } : null,
      e.test ? miscastTestSection(e.test) : null,
    ),
  };
}

const CODEX_SPECS: CodexCategorySpec[] = [
  {
    key: 'advancementCosts', label: 'Coût des Augmentations', group: 'Tables', cluster: 'Création de personnage', sourceRef: 'LDB 07',
    build: () => datasetArray('advancementCosts').map((b) => ({
      id: b.id, label: b.label, sub: 'Augmentations déjà achetées',
      meta: facts(fact('Coût — Caractéristique', b.char), fact('Coût — Compétence', b.skill)),
      source: src(b.source),
    })),
  },
  {
    key: 'disponibilite', label: 'Disponibilité & Troc', group: 'Tables', sourceRef: 'LDB 59',
    build: () => {
      const d = datasetObject('disponibilite');
      return [{
        id: 'disponibilite', label: 'Disponibilité & Troc (Faire son marché)',
        source: src(d.dispoPct[0]?.source),
        sections: sections(dispoPctSection(d.dispoPct), barterRatiosSection(d.barterRatios)),
      }];
    },
  },
  {
    key: 'drivingMishap', label: 'Accidents de Conduite d’attelage', group: 'Tables', cluster: 'Voyage terrestre', sourceRef: 'LDB 09',
    build: () => datasetArray('drivingMishap').map((e) => ({
      id: e.id, label: e.label, sub: `1d10 ${e.min}–${e.max}`, desc: e.desc,
      meta: facts(fact('Type', DRIVING_MISHAP_EFFECT_LABEL[e.effect] ?? e.effect)),
    })),
  },
  {
    key: 'drunkenness', label: 'Ivresse (Tableau)', group: 'Tables', sourceRef: 'LDB 09',
    build: () => datasetArray('drunkenness').map((e) => ({
      id: e.id, label: e.label, sub: `1d10 ${e.min}–${e.max}`, desc: e.desc,
      meta: facts(fact('Type', DRUNKENNESS_EFFECT_LABEL[e.effect] ?? e.effect)),
      sections: sections(passiveSection(e.ops, 'Effet')),
    })),
  },
  {
    key: 'encumbranceTiers', label: 'Surchargé — Paliers d’Encombrement', group: 'Tables', sourceRef: 'LDB 61',
    build: () => datasetArray('encumbranceTiers').map((t) => ({
      id: t.id, label: t.label,
      meta: facts(
        fact('Pénalité de Mouvement', t.immobile ? 'Immobilisé' : (t.movePenalty ? `−${t.movePenalty} (plancher ${t.moveFloor})` : 'Aucune')),
        fact('Pénalité d’Agilité', t.agilityPenalty ? String(t.agilityPenalty) : null),
        fact('Fatigue de voyage (États Exténué)', t.travelFatigue || null),
      ),
      source: src(t.source),
    })),
  },
  {
    key: 'riverNavigation', label: 'Navigation fluviale (Vent, Chavirage, Échouage)', group: 'Tables', cluster: 'Mer & rivière', sourceRef: 'MSRC 7',
    build: () => {
      const n = datasetObject('riverNavigation');
      const forceLabel = new Map(n.windForces.map((f) => [f.id, f.label]));
      const dirLabel = new Map(n.windDirections.map((d) => [d.id, d.label]));
      const effectText = (e: { pct?: number; drift?: boolean; tack?: boolean; capsizeRisk?: boolean; riggingRisk?: boolean } | undefined): string => {
        if (!e) return '—';
        const parts: string[] = [];
        if (e.pct != null) parts.push(`${e.pct > 0 ? '+' : ''}${e.pct} % vitesse`);
        if (e.drift) parts.push('Dérive (Navigation −10)');
        if (e.tack) parts.push('Louvoyer (Navigation Accessible +20)');
        if (e.capsizeRisk) parts.push('Risque de chavirage');
        if (e.riggingRisk) parts.push('Risque au gréement');
        return parts.join(' · ') || '—';
      };
      return [{
        id: 'riverNavigation', label: 'Navigation fluviale', source: src(n.source),
        meta: facts(
          fact('Savoir (Voies fluviales)', `+${n.savoirVoiesFluvialesDR} DR`),
          fact('Difficulté de base', DIFFICULTY_LABELS[n.navBaseDifficulty]),
          fact('Difficulté de Louvoyer', DIFFICULTY_LABELS[n.tackDifficulty]),
        ),
        sections: sections(
          {
            title: 'Force du vent (1d10)', layout: 'list',
            rows: n.windForces.map((f) => ({ t: 'kv', k: `1d10 ${f.min}–${f.max}`, v: f.label } as CodexRow)),
          },
          {
            title: 'Direction du vent (1d10, relative au bateau)', layout: 'list',
            rows: n.windDirections.map((d) => ({ t: 'kv', k: `1d10 ${d.min}–${d.max}`, v: d.label } as CodexRow)),
          },
          {
            title: 'Effet du vent (Force × Direction)', layout: 'list',
            rows: n.windForces.flatMap((f) => n.windDirections.map((d) => ({
              t: 'kv', k: `${forceLabel.get(f.id)} · ${dirLabel.get(d.id)}`, v: effectText(n.windEffect[f.id]?.[d.id as 'arriere' | 'cote' | 'contraire']),
            } as CodexRow))),
          },
          {
            title: 'Agilité de rame (Test quotidien)', layout: 'list',
            rows: [
              { t: 'kv', k: 'Difficulté', v: DIFFICULTY_LABELS[n.rowingAgility.difficulty] } as CodexRow,
              { t: 'kv', k: 'Échec', v: `${n.rowingAgility.failSpeedPct} % vitesse` } as CodexRow,
              { t: 'kv', k: `Échec spectaculaire (DR ≤ ${n.rowingAgility.spectacularSL})`, v: `×${n.rowingAgility.spectacularSpeedFactor} vitesse` } as CodexRow,
            ],
          },
          {
            title: 'Chavirage (Très fort de côté)', layout: 'list',
            rows: [
              { t: 'kv', k: 'Retirer la voile', v: DIFFICULTY_LABELS[n.capsize.removeSailDifficulty] } as CodexRow,
              { t: 'kv', k: 'Redresser (par Round)', v: `${DIFFICULTY_LABELS[n.capsize.rightDifficulty]} (−${Math.abs(n.capsize.rightCumulativePenalty)} cumulatif par échec)` } as CodexRow,
            ],
          },
          {
            title: 'Autres dangers', layout: 'list',
            rows: [
              { t: 'kv', k: 'Hors de contrôle', v: `${n.outOfControl.navPenalty} Navigation` } as CodexRow,
              { t: 'kv', k: 'S’échouer', v: `${n.echouage.hullDamage} Dégâts de coque` } as CodexRow,
              { t: 'kv', k: 'Réparation temporaire', v: `${DIFFICULTY_LABELS[n.temporaryRepair.difficulty]} (Charpentier ${n.temporaryRepair.charpentierPenalty}, ${n.temporaryRepair.woundsPerRepair} Blessures)` } as CodexRow,
            ],
          },
        ),
      }];
    },
  },

  // ── LOT 3 #422 (FINAL) : les 3 dernières exemptions AUDIT ──
  {
    key: 'grapple', label: 'Empoignade — mécanique', group: 'Tables', sourceRef: 'LDB 14',
    build: () => {
      const g = datasetObject('grapple');
      return [{
        id: 'grapple', label: 'Empoignade — mécanique (GameOp)',
        source: src(g.source),
        sections: sections(
          passiveSection(g.init, 'À la touche (Empêtré)'),
          passiveSection(g.win.damage, 'Test opposé gagné — Infliger des Dégâts'),
          passiveSection(g.win.entangle, 'Test opposé gagné — Empêtrer davantage'),
          passiveSection(g.win.free, 'Test opposé gagné — Se libérer'),
        ),
      }];
    },
  },
  {
    key: 'miscastMinor', label: 'Incantations Imparfaites — Mineures', group: 'Magie', sourceRef: 'LDB 46',
    build: () => datasetArray('miscastMinor').map(miscastRowItem),
  },
  {
    key: 'miscastMajor', label: 'Incantations Imparfaites — Majeures', group: 'Magie', sourceRef: 'LDB 46',
    build: () => datasetArray('miscastMajor').map(miscastRowItem),
  },
  {
    key: 'miscastWrath', label: 'Colère des dieux', group: 'Magie', sourceRef: 'LDB 40',
    build: () => datasetArray('miscastWrath').map(miscastRowItem),
  },
  {
    key: 'nightStakes', label: 'Enjeux — cascade de repos', group: 'Tables', sourceRef: 'LDB 18/09/20/21',
    build: () => datasetArray('nightStakes').map((e) => ({
      id: e.id, label: e.label, desc: e.stake, source: src(e.source),
    })),
  },

  {
    key: 'races', label: 'Races', group: 'Personnage',
    build: () => species.map((s) => ({
      id: s.id,
      label: s.label,
      group: family(s.label),
      desc: s.desc,
      source: src(s.source),
      // Aperçu rig DATA-DRIVEN (même chemin que le créateur) : la fiche de race montre sa silhouette.
      appearance: { species: rigSpeciesId(s.id) },
      meta: facts(fact('Mouvement', s.movement), fact('Destin', s.fate?.fate), fact('Résilience', s.fate?.resilience)),
      // Contenu = SOURCE UNIQUE partagée avec le créateur (plus de ré-implémentation divergente).
      tabs: raceFicheTabs(s),
    })),
  },
  {
    key: 'careers', label: 'Carrières', group: 'Personnage',
    build: () => careers.map((c) => {
      const levels = levelsForCareer(c.id);
      const className = findClassById(c.class)?.label ?? c.class;
      // Les 4 échelons réunis en UN onglet « Progression » (au lieu d'un onglet par niveau) → la
      // montée en Carrière se lit d'un trait ; la description flavor gagne en proéminence relative.
      const levelSections: CodexSection[] = levels.map((lv) => ({
        title: `Niveau ${lv.level} : ${lv.label} — ${lv.status}`,
        layout: 'chips' as const,
        rows: [
          ...(lv.characteristics.length ? [{ t: 'sub', label: 'Caractéristiques avancées' } as CodexRow, { t: 'text', text: lv.characteristics.map((k) => CHAR_LABELS[k]).join(', ') } as CodexRow] : []),
          ...(lv.skills.length ? [{ t: 'sub', label: 'Compétences' } as CodexRow, ...refRows('skills', lv.skills.map((a) => advancementLabel('skills', a)))] : []),
          ...(lv.talents.length ? [{ t: 'sub', label: 'Talents' } as CodexRow, ...refRows('talents', lv.talents.map((a) => advancementLabel('talents', a)))] : []),
          ...(lv.trappings.length ? [{ t: 'sub', label: 'Possessions' } as CodexRow, ...refRows('trappings', lv.trappings.map(trappingRefLabel))] : []),
        ],
      }));
      // Citation/tract levée en tête de fiche (`ParchmentCard`) — c'est le flavor qui « vend » la
      // carrière ; le corps restant garde la desc verbatim moins ce couple (pas de doublon).
      const { epigraph, body } = extractEpigraph(c.desc);
      return {
        id: c.id, label: c.label, sub: className, group: className, desc: body, exergue: epigraph, source: src(c.source),
        // Faits-clés en en-tête (comme les Races portent M/Destin/Résilience) : Classe + fourchette de Statut social.
        meta: facts(fact('Classe', className), fact('Statut', careerStatusRange(levels))),
        tabs: [
          ...(levelSections.length ? [{ title: 'Progression', sections: levelSections }] : []),
          ...reverseSections('careers', c.id).map((s) => ({ title: s.title, sections: [s] })), // Races y accédant
        ],
      };
    }),
  },
  {
    key: 'characteristics', label: 'Caractéristiques', group: 'Personnage',
    build: () => (characteristics as { id: string; label: string; abr?: string; type?: string; desc?: string; source?: CodexSource }[]).map((c) => ({
      id: c.id, label: c.label, sub: c.abr, desc: c.desc, source: src(c.source),
      // Bonus de Caractéristique = chiffre des dizaines (LDB 03) — rappel sur les caracs à jet (d100).
      meta: c.type === 'roll' ? facts(fact('Bonus', 'chiffre des dizaines')) : undefined,
      sections: sections(...reverseSections('characteristics', c.id)),
    })),
  },
  {
    key: 'classes', label: 'Classes', group: 'Personnage',
    build: () => classes.map((c) => ({
      id: c.id, label: c.label, desc: c.desc, source: src(c.source),
      sections: sections(chips('Possessions de départ', 'trappings', c.trappings.map(trappingRefLabel)), ...reverseSections('classes', c.id)),
    })),
  },
  {
    key: 'stars', label: 'Étoiles', group: 'Personnage',
    build: () => stars.map((s) => ({
      id: s.id, label: s.label, sub: s.signe ?? undefined, desc: s.desc ?? undefined, source: src(s.source),
      meta: facts(fact('Dates', s.dates), fact('Dieu', s.dieux), fact('Ascendant', s.ascendant)),
      sections: sections(passiveSection(s.effect, 'Effet du signe')),
    })),
  },
  {
    key: 'skills', label: 'Compétences', group: 'Compétences',
    build: () => skills.map((s) => ({
      id: s.id, label: s.label, sub: join(CHAR_LABELS[s.characteristic], s.type), desc: s.desc, source: src(s.source),
      meta: facts(fact('Caractéristique', CHAR_LABELS[s.characteristic]), fact('Type', s.type), fact('Spécialisations', specsFact('skills', s))),
      sections: sections(...reverseSections('skills', s.id)),
    })),
  },
  {
    key: 'talents', label: 'Talents', group: 'Compétences',
    build: () => talents.map((t) => {
      // `TalentData` (`data/index.ts`) n'expose que `desc`/`source` de base ; le SCHÉMA zod porte aussi
      // `variants` (`schemas/defs/talents.ts`). Cast local ciblé (#564 Lot 4, même patron que `dispatch.ts`).
      const td = t as unknown as { variants?: import('../../data/schemas/common').Variant[] };
      const v = activeVariant(td.variants);
      return {
      id: t.id, label: t.label, desc: v?.desc ?? t.desc, source: src(v?.source ?? t.source), // variante réglée (#563/#564) selon la règle optionnelle active
      meta: facts(fact('Max', talentMaxLabel(t.max)), fact('Test', t.test?.raw ?? null), fact('Spécialisations', specsFact('talents', t))),
      sections: sections(
        careerGrantSection(t.passive), // Compétence/Talent ajouté à toute carrière (Maître artisan, Flagellant…)
        passiveSection(t.passive),
        effectsSection(t.effects, 'Effets déclenchés'),
        ...reverseSections('talents', t.id), // Races · Carrières (rang) · Créatures · Talents le conférant
      ),
      };
    }),
  },
  {
    key: 'axes', label: 'Axes de forces', group: 'Compétences',
    build: () => allAxes.map((a) => ({
      id: a.id, label: a.label, desc: a.desc,
      meta: facts(fact('Portée', a.core ? 'Socle de base' : 'Axe de scénario')),
      sections: sections(
        a.skills?.length ? { title: 'Compétences', layout: 'chips', rows: a.skills.map((r) => idRefRow('skills', r.skillId, r.spec)) } : null,
        a.talents?.length ? { title: 'Talents', layout: 'chips', rows: a.talents.map((r) => idRefRow('talents', r.talentId, r.spec)) } : null,
      ),
    })),
  },
  {
    key: 'trappings', label: 'Possessions', group: 'Équipement',
    build: () => trappings.map((t) => {
      // Capacités FONCTIONNELLES (canal `capabilities`, lu PAR ID — ≠ nom FR) + arme dérivée tant qu'équipée.
      const caps = t.capabilities;
      const props = [
        caps?.weatherProtection ? 'Protège des intempéries' : null,
        caps?.isShelter ? 'Abri de campement' : null,
        caps?.isRations ? 'Ration de voyage' : null,
        caps?.isGrimoire ? 'Grimoire (lecture de Sorts)' : null,
        caps?.preventForcedDrop ? 'Empêche le lâcher forcé (gantelet verrouillé)' : null,
        t.derivedWeapon ? `Arme dérivée : ${t.derivedWeapon.label} (${damageString(t.derivedWeapon.damage)})` : null,
      ].filter(Boolean) as string[];
      // Allonge = mêlée, Portée = distance (LDB 62). Tir/munition : « Portée 50 m » (fixe) / « BF×3 m » (jet)
      // sinon le modificateur de munition (« Portée ×½ », `ammoRangeModLabel`) ; jamais « Allonge 50 ».
      const reachFact = (t.type === 'ranged' || t.type === 'ammunition')
        ? fact('Portée', rangeSpecLabel(t.range) ?? ammoRangeModLabel(t.ammoRangeMod))
        : fact('Allonge', t.reach);
      return {
        id: t.id, label: t.label, sub: join(t.type, weaponGroupLabel(t.subType) || undefined), desc: t.desc ?? undefined, source: src(t.source),
        meta: facts(fact('Prix', priceLabel(t.price)), fact('Enc', t.enc), fact('Disponibilité', t.availability), fact('Emplacement', t.loc), fact('Dégâts', damageFact(t)), fact('PA', t.pa), reachFact),
        sections: sections(
          chips('Qualités', 'qualities', t.qualities.map(qualityRefLabel)),
          props.length ? { title: 'Propriétés', layout: 'list', rows: [{ t: 'text', text: props.join(' · ') }] } : null,
          ...reverseSections('trappings', t.id),
        ),
      };
    }),
  },
  {
    key: 'siegeEngines', label: 'Engins de siège', group: 'Équipement',
    // Engins de siège = Possessions portant l'art d'affût `siegeRig` (les 12 mêmes que la Palette de
    // l'éditeur, `SIEGE_ENGINES`). Miroir de « Créatures » pour l'aperçu rig (l'affût est rendu par le
    // MÊME chemin — appearance.species = siegeRig) ET de « Possessions » pour les faits d'arme
    // (Portée/Dégâts) + Atouts (l'Indice « Arme d'équipe N » = équipage requis).
    build: () => siegeEngines.map((t) => ({
      id: t.id, label: t.label, sub: join(t.type, weaponGroupLabel(t.subType) || undefined), desc: t.desc ?? undefined, source: src(t.source),
      // Aperçu rig de l'affût, résolu comme une créature (par id + apparence species).
      appearance: { species: t.siegeRig! }, previewRef: t.siegeRig!,
      meta: facts(
        fact('Prix', priceLabel(t.price)), fact('Enc', t.enc), fact('Disponibilité', t.availability),
        fact('Dégâts', damageFact(t)), fact('PA', t.pa),
        fact('Portée', rangeSpecLabel(t.range) ?? ammoRangeModLabel(t.ammoRangeMod)),
      ),
      sections: sections(
        chips('Qualités', 'qualities', t.qualities.map(qualityRefLabel)),
        ...reverseSections('trappings', t.id),
      ),
    })),
  },
  {
    key: 'weaponGroups', label: 'Groupes d’objet', group: 'Équipement',
    build: () => weaponGroups.map((g) => ({ id: g.id, label: g.label, sub: WEAPON_GROUP_KIND_LABEL[g.kind], sections: sections(...reverseSections('weaponGroups', g.id)) })),
  },
  {
    key: 'qualities', label: 'Qualités', group: 'Équipement',
    build: () => (qualities as { id: string; label: string; type?: string; subType?: string; desc?: string; source?: CodexSource; passive?: import('../../engine/ops').GameOp[]; effects?: import('../../state/flow').TriggeredEffect[]; capabilities?: Record<string, unknown> }[]).map((q) => ({
      id: q.id, label: q.label, sub: join(qualityTypeLabel(q.type), qualitySubtypeLabel(q.subType)), desc: q.desc, source: src(q.source),
      sections: sections(capabilitySection(q.capabilities, QUALITY_CAP_LABEL), passiveSection(q.passive), effectsSection(q.effects, 'Effets déclenchés'), ...reverseSections('qualities', q.id)),
    })),
  },
  {
    key: 'etats', label: 'États', group: 'Effets',
    build: () => etats.map((e) => ({
      id: e.id, label: e.label, desc: e.desc, source: src(e.source),
      sections: sections(...reverseSections('etats', e.id)), // Sorts/Traits/Qualités/Talents/Domaines l'infligeant
    })),
  },
  {
    key: 'maladies', label: 'Maladies', group: 'Effets',
    build: () => maladies.map((m) => ({
      id: m.id,
      label: m.label,
      sub: m.symptoms.map((s) => symptomLabel(s.symptomId)).join(', '),
      meta: facts(
        fact('Contraction', DIFFICULTY_LABELS[m.contractDifficulty]),
        fact('Incubation', formatDiseaseTime(m.incubation)),
        fact('Durée', formatDiseaseTime(m.duration)),
      ),
      sections: sections({
        title: 'Symptômes', layout: 'list',
        rows: m.symptoms.map((s) => ({
          // `spec` = localisation/précision imprimée de l'instance (« Gonflement (Visage et tête) », EDO 11 p.145).
          t: 'kv', k: `${symptomLabel(s.symptomId)}${s.spec ? ` (${s.spec})` : ''}`,
          v: [s.severity === 'grave' ? 'Grave' : s.severity === 'moderee' ? 'Modérée' : null, s.difficulty ? `Test ${DIFFICULTY_LABELS[s.difficulty]}` : null].filter(Boolean).join(' · ') || '—',
        } as CodexRow)),
      }),
    })),
  },
  {
    key: 'symptoms', label: 'Symptômes', group: 'Effets',
    build: () => symptoms.map((s) => ({
      id: s.id, label: s.label, desc: s.desc, source: src(s.source),
      sections: sections(
        passiveSection(s.passive),
        passiveSection(s.severePassive, 'Modificateurs (Modérée / Grave)'),
        s.onTick
          ? {
              title: 'Cycle quotidien', layout: 'list',
              rows: [
                { t: 'kv', k: 'Difficulté', v: s.onTick.difficulty ? DIFFICULTY_LABELS[s.onTick.difficulty] : 'inconditionnel' } as CodexRow,
                s.onTick.afterDays ? ({ t: 'kv', k: 'Déclenchement', v: `${s.onTick.once ? 'une fois, au' : 'à partir du'} ${s.onTick.afterDays}ᵉ jour de phase active` } as CodexRow) : null,
                // Conséquence de l'échec (ops directes ou `rollTable` : table EXPANSÉE en rangées lisibles).
                ...opRows(s.onTick.onFail),
              ].filter((r): r is CodexRow => r != null),
            }
          : null,
        capabilitySection(s.capabilities as Record<string, unknown> | undefined, SYMPTOM_CAP_LABEL),
      ),
    })),
  },
  {
    key: 'mutations', label: 'Mutations', group: 'Effets',
    build: () => (mutations as MutationData[]).map((m) => ({
      id: m.id,
      label: m.label,
      sub: m.kind === 'physique' ? 'Physique' : 'Mentale',
      group: m.kind === 'physique' ? 'Physiques' : 'Mentales',
      desc: m.desc,
      appearance: m.appearance,
      source: src(m.source),
      // PA / arme naturelle / traits conférés sont désormais des GameOps du `passive` (ap /
      // grantNaturalWeapon / grantTrait) → rendus par passiveSection ; plus de facts/chips dédiés.
      sections: sections(
        passiveSection(m.passive),
        ...reverseSections('mutations', m.id), // Tables de Corruption la tirant
      ),
    })),
  },
  {
    key: 'mutationTables', label: 'Tables de Corruption', group: 'Effets',
    build: () => (mutationTables as { id: string; label: string; ranges: { min: number; max: number; mutation: string }[] }[]).map((t) => ({
      id: t.id, label: t.label, sub: `${t.ranges.length} plages d100`,
      // Tirage d100 → Mutation : chaque plage est un lien cross-réf vers la fiche de mutation.
      sections: sections({
        title: 'Tirage (d100 → Mutation)', layout: 'list',
        rows: t.ranges.map((r) => {
          const label = (mutations as MutationData[]).find((mu) => mu.id === r.mutation)?.label ?? r.mutation;
          return { t: 'ref', category: 'mutations', id: r.mutation, label, show: label, badge: `${r.min}–${r.max}` } as CodexRow;
        }),
      }),
    })),
  },
  {
    key: 'effectTables', label: 'Tables d’effets', group: 'Effets',
    // Tables `[min,max] → GameOp[]` référencées par l'op `rollTable` (Allure démoniaque : Tableau des
    // aspects démoniaques par Domaine du Chaos). Chaque rangée = fourchette + ops (chips codex-liées).
    build: () => effectTables.map((t) => ({
      id: t.id, label: t.label, sub: `${t.rows.length} rangée(s) · ${t.die}`, source: src(t.source),
      sections: sections({ title: `Tirage (${t.die} → effet)`, layout: 'list', rows: tableRows(t.rows) }),
    })),
  },
  {
    key: 'maneuvers', label: 'Manœuvres', group: 'Effets',
    build: () => maneuvers.map((m) => ({
      id: m.id, label: m.label, sub: ATTACK_LABEL[m.kind], desc: m.desc, source: src(m.source),
      meta: facts(
        fact('Activation', MANEUVER_ACTIVATION_LABEL[m.activation]),
        fact('Coût Av', m.advantageCost),
        fact('Portée', m.range ? formatManeuverMeasure(m.range) : null),
        fact('Cible', MANEUVER_TARGETING_LABEL[m.targeting]),
      ),
      sections: sections(...reverseSections('maneuvers', m.id)),
    })),
  },
  {
    key: 'psychologie', label: 'Psychologie', group: 'Effets',
    // Filtre DATA-DRIVEN des Traits à capacité psychologique (LDB 21, migration #1) : réutilise la
    // fiche de Trait (traitItem) — « Créatures ayant ce trait » montre QUI cause/possède la Psychologie.
    // Groupés par type (Peur, Terreur, Animosité…). Édition = catégorie « Traits » (source unique).
    build: () => traits
      .filter((t) => t.capabilities?.psychType || t.capabilities?.psychImmune)
      .map((t) => ({ ...traitItem(t), group: t.capabilities?.psychType ? psychologyLabel(t.capabilities.psychType) : 'Immunité' })),
  },
  {
    key: 'domains', label: 'Domaines', group: 'Magie',
    build: () => domains.map((d) => ({
      id: d.id, label: d.label, desc: d.desc, source: src(d.source),
      meta: facts(
        fact('Projectile', d.missile ? `ignore les PA ${d.missile.bypass === 'metal' ? 'métalliques' : 'non magiques'}${d.missile.bonusFromBypass ? ' (+ Dégâts)' : ''}` : null),
        fact('Bonus d’incantation', d.castBonus ? humanizeCastBonus(d.castBonus) : null),
        fact('Post-incantation', d.casterOps?.length ? `${d.casterOps.length} op(s) au lanceur` : null),
      ),
      sections: sections(effectsSection(d.effects, 'Riders à la touche'), ...reverseSections('domains', d.id)),
    })),
  },
  {
    key: 'spells', label: 'Sorts', group: 'Magie',
    build: () => spells.map((s) => ({
      id: s.id, label: s.label, sub: join(s.type, s.subType), desc: s.desc, source: src(s.source),
      meta: facts(
        fact('NI', s.cn),
        fact('Portée', s.range ? formatSpellRange(s.range) : null),
        fact('Cible', s.target ? formatSpellTarget(s.target) : null),
        fact('Durée', s.duration ? formatSpellDuration(s.duration) : null),
        // Projectile magique (#2 data-driven) : Dégâts additifs + DR + BFM, ignore éventuellement PA/BE.
        fact('Projectile', s.missile ? `Dégâts ${s.damage ? `${s.damage} + ` : ''}DR + BFM${s.ignorePA ? ' · ignore PA' : ''}${s.ignoreBE ? ' · ignore BE' : ''}` : null),
      ),
      sections: sections(
        spellFlowSection(s.effects), // Effet mécanique (Flow) — #5 data-driven
        ...reverseSections('spells', s.id), // Cultes (Bénédictions/Miracles) · Créatures · Domaine
      ),
    })),
  },
  {
    key: 'gods', label: 'Dieux', group: 'Magie',
    build: () => gods.map((c) => ({
      id: c.id, label: c.label, sub: c.title, desc: c.desc, source: c.source ?? null,
      sections: sections(
        chips('Bénédictions', 'spells', c.blessings.map((b) => refLabel('spells', b))),
        chips('Miracles', 'spells', c.miracles.map((m) => refLabel('spells', m))),
        chips('Sorts du Chaos', 'spells', (c.chaosSpells ?? []).map((s) => refLabel('spells', s))),
      ),
    })),
  },
  {
    key: 'ventsTourbillonnants', label: 'Vents Tourbillonnants', group: 'Magie',
    // Option `vents-tourbillonnants` (LDB 46 l.179-190) : table 1d10 de force des Vents, ajoutée
    // aux Tests d'Incantation/Focalisation (`engine/windsOfMagic.ts`).
    build: () => windsOfMagicTable.map((e) => ({
      id: e.id, label: e.label, sub: `1d10 ${e.min}${e.max > e.min ? `–${e.max}` : ''}`,
      meta: facts(fact('Modificateur', e.mod >= 0 ? `+${e.mod}` : `${e.mod}`)),
    })),
  },
  {
    key: 'creatures', label: 'Créatures', group: 'Monde',
    build: () => creatures.map((c) => ({
      id: c.id, label: c.label, sub: c.title ?? undefined, group: c.folder ?? undefined, desc: c.desc ?? undefined, source: src(c.source),
      appearance: c.appearance, previewRef: c.id, // aperçu rig résolu par id (Nuées/non-bipèdes lisent leurs traits)
      statblock: creatureStatblock(c),
      meta: facts(
        // pastille d'en-tête TOUJOURS visible : marque l'individu nommé (lu via `isNamed`, jamais via `title`).
        isNamed(c) ? fact('Type', 'Individu nommé') : null,
        c.harvest ? fact('Récolte (1 Enc)', formatMoney(costPerEnc(c.harvest))) : null,
      ),
      sections: sections(
        { title: 'Caractéristiques', layout: 'grid', rows: kvRows(Object.entries(c.char)) },
        chips('Traits', 'traits', traitLabels(c.traits)),
        chips('Traits optionnels', 'traits', optionalLabels(c.optionals)),
        chips('Compétences', 'skills', c.skills.map(skillRefLabel)), // SkillRef[] → libellés « Calme 58 »
        chips('Talents', 'talents', c.talents.map(talentRefLabel)), // TalentRef[] → libellés « Magie des Arcanes (Ghur) »
        chips('Sorts', 'spells', c.spells.map((s) => refLabel('spells', s))),
        chips('Possessions', 'trappings', c.trappings.map(trappingRefLabel)),
        c.harvest
          ? {
              title: 'Récolte (Précieuses Entrailles)',
              layout: 'list',
              rows: [
                { t: 'kv', k: 'Rareté', v: c.harvest.rarity },
                { t: 'kv', k: 'Dangerosité', v: c.harvest.danger },
                { t: 'kv', k: 'Valeur (1 Enc, conservé)', v: formatMoney(costPerEnc(c.harvest)) },
                { t: 'text', text: c.harvest.uses },
              ],
            }
          : null,
      ),
    })),
  },
  {
    key: 'traits', label: 'Traits', group: 'Monde',
    build: () => traits.map(traitItem),
  },
  {
    key: 'locations', label: 'Lieux', group: 'Monde',
    // `parent` est un id → résolu en libellé pour l'affichage ; la réf inverse « Sous-lieux » clé par id.
    build: () => locations.map((l) => {
      const parentLabel = findLocationById(l.parent)?.label;
      return {
        id: l.id, label: l.label, sub: parentLabel, group: parentLabel, desc: l.desc ?? undefined, source: src(l.source),
        sections: sections(...reverseSections('locations', l.id)),
      };
    }),
  },
  {
    key: 'books', label: 'Livres', group: 'Monde',
    // Fiche Livre : « contenu, par type » (index `bookContents`) projeté DANS le build (paresseux).
    // Les entités référencent leur livre par son ABBR (`source.book`) → match sur abbr + libellé ;
    // `categoryByKey(...)?.label` ne lit que l'identité STATIQUE des catégories (pas leurs items :
    // aucun cycle de projection).
    build: () => books.map((b) => ({
      id: b.id, label: b.label, sub: b.abbr ?? b.folder ?? undefined, group: b.folder ?? undefined, desc: b.desc ?? undefined,
      sections: bookContents(b.id).map((g) => ({
        title: categoryByKey(g.category)?.label ?? g.category,
        layout: 'chips' as const,
        rows: g.entries.map((e) => ({ t: 'ref', category: g.category, id: e.id, label: e.label, show: e.label } as CodexRow)),
      })),
    })),
  },
  // ── Tables & gabarits éditables (E3a) ─────────────────────────────────────────
  {
    key: 'careerLevels', label: 'Niveaux de carrière', group: 'Tables',
    // Pas de clé mono-champ UNIQUE (même libellé de niveau sur plusieurs carrières) — id composite
    // carrière + niveau, cf. `entryKey` (même composition côté éditeur `CodexEdit`).
    build: () => careerLevels.map((lv) => ({
      id: `${lv.career}:${lv.level}`,
      label: entryKey(lv as unknown as Record<string, unknown>),
      sub: lv.status, group: findCareerById(lv.career)?.label ?? lv.career,
      sections: sections(
        lv.characteristics.length ? { title: 'Caractéristiques avancées', layout: 'chips', rows: [{ t: 'text', text: lv.characteristics.map((k) => CHAR_LABELS[k]).join(', ') }] } : null,
        chips('Compétences', 'skills', lv.skills.map((a) => advancementLabel('skills', a))),
        chips('Talents', 'talents', lv.talents.map((a) => advancementLabel('talents', a))),
        chips('Possessions', 'trappings', lv.trappings.map(trappingRefLabel)),
      ),
    })),
  },
  {
    key: 'eyes', label: 'Couleur des yeux', group: 'Tables', cluster: 'Création de personnage',
    build: () => eyes.map((e) => ({ id: e.id, label: e.label, sub: `2d10 ≤ ${e.rand}`, sections: sections(colorTableSection(e)) })),
  },
  {
    key: 'hairs', label: 'Couleur des cheveux', group: 'Tables', cluster: 'Création de personnage',
    build: () => hairs.map((h) => ({ id: h.id, label: h.label, sub: `2d10 ≤ ${h.rand}`, sections: sections(colorTableSection(h)) })),
  },
  {
    key: 'calendarMonths', label: 'Calendrier — Mois', group: 'Tables', cluster: 'Calendrier',
    build: () => calendarMonths.map((m) => ({ id: m.id, label: m.label, sub: `${m.days} jours` })),
  },
  {
    key: 'calendarIntercalary', label: 'Calendrier — Jours intercalaires', group: 'Tables', cluster: 'Calendrier',
    build: () => calendarIntercalary.map((i) => ({
      id: i.id,
      label: i.label,
      sub: i.afterMonth < 0 ? 'avant le 1ᵉʳ mois' : `après ${calendarMonths[i.afterMonth]?.label ?? `mois ${i.afterMonth}`}`,
    })),
  },
  {
    key: 'calendarWeekdays', label: 'Calendrier — Jours de la semaine', group: 'Tables', cluster: 'Calendrier',
    build: () => calendarWeekdays.map((w) => ({ id: w.id, label: w.label })),
  },
  {
    key: 'calendarPhases', label: 'Calendrier — Phases du jour', group: 'Tables', cluster: 'Calendrier',
    build: () => calendarPhases.map((p) => ({
      id: p.key, label: p.label, // `p.icon` = id d'icône (time/*, registre src/ui/icons), plus un glyphe affichable en préfixe

      sub: `dès ${String(Math.floor(p.start / 60)).padStart(2, '0')}:${String(p.start % 60).padStart(2, '0')}`,
    })),
  },
  {
    key: 'weather', label: 'Météo de voyage', group: 'Tables', cluster: 'Voyage terrestre',
    build: () => weather.map((s) => ({ id: s.id, label: s.label, sub: `${s.ranges.length} plages d100 (EDOC 8)` })),
  },
  {
    key: 'raceAppearance', label: 'Apparences (rig)', group: 'Tables', cluster: 'Création de personnage',
    build: () => raceAppearance.map((r) => ({
      id: r.id, label: r.id, sub: r.gabarit, appearance: { species: r.id },
      meta: facts(fact('Gabarit', r.gabarit), fact('Tenue', r.tenue), fact('Tête', r.head), fact('Jambes', r.legs)),
    })),
  },
  {
    key: 'pregens', label: 'Pré-tirés', group: 'Tables', cluster: 'Création de personnage',
    build: () => pregens.map((p) => ({
      id: p.id,
      label: p.name, sub: join(findSpeciesById(p.species)?.label ?? p.species, findCareerById(p.career)?.label ?? p.career),
      meta: facts(fact('Motivation', p.motivation), fact('Graine', p.seed)),
      sections: p.spells?.length ? sections(chips('Sorts/Prières', 'spells', p.spells)) : undefined,
    })),
  },
  {
    key: 'oups', label: 'Oups !', group: 'Tables',
    // Le `label` EST le texte du résultat (et la clé d'édition `entryKey`) → on le garde tel quel ;
    // on enrichit par la plage d100 et le TYPE d'effet (kind) en méta.
    build: () => oups.map((o) => {
      const range = 'min' in o ? `d100 ${o.min}–${o.max}` : 'Hors table (arme à Poudre noire, jet pair)';
      return {
        id: o.id,
        label: o.label, sub: range,
        meta: facts(fact('d100', range), fact('Type', OUPS_KIND_LABEL[o.kind] ?? o.kind)),
      };
    }),
  },
  {
    key: 'interludeEvents', label: 'Entre deux aventures', group: 'Tables',
    build: () => interludeEvents.map((e) => ({ id: e.id, label: e.label, sub: `d100 ${e.min}–${e.max}`, desc: e.text })),
  },
  {
    key: 'peripeties', label: 'Péripéties de voyage', group: 'Tables', cluster: 'Voyage terrestre',
    build: () => peripeties.map((p) => ({ id: p.id, label: p.label, sub: `1d10 = ${p.roll} · ${p.kind}`, desc: p.text })),
  },
  {
    key: 'activities', label: 'Activités', group: 'Tables',
    // Catalogue UNIQUE des Activités (interlude LDB 23 / voyage EDOC 8 / mer MDG 15 / bataille de
    // masse ADE II 8). Un Test « posté » (compétence(s) au choix + Difficulté) dont l'issue s'exprime
    // en `onSuccess` (GameOp) et/ou en bandes `outcomes` (table DR → résultat, verbatim + effets).
    build: () => ACTIVITIES.map((a) => ({
      id: a.id, label: a.label,
      sub: a.contexts.map((c) => ACTIVITY_CONTEXT_LABEL[c] ?? c).join(', '),
      desc: a.desc,
      source: src(a.source),
      meta: facts(
        fact('Contextes', a.contexts.map((c) => ACTIVITY_CONTEXT_LABEL[c] ?? c).join(', ')),
        fact('Compétence(s)', a.skills?.length ? a.skills.map((s) => refLabel('skills', { id: s.skillId, spec: s.spec })).join(' / ') : (a.freeSkill ? 'Au choix (libre)' : null)),
        fact('Caractéristique', a.char ? CHAR_LABELS[a.char] : null),
        fact('Difficulté', a.difficulty ? DIFFICULTY_LABELS[a.difficulty] : null),
        fact('Test étendu', a.extended ? `${a.extended.drPerStage} DR / Étape` : null),
        fact('Résolveur', a.resolver ?? null),
      ),
      sections: sections(
        chips('Compétences (au choix)', 'skills', (a.skills ?? []).map((s) => refLabel('skills', { id: s.skillId, spec: s.spec }))),
        passiveSection(a.onSuccess, 'Effet de réussite'),
        outcomeBandsSection(a.outcomes),
      ),
    })),
  },
  // ── Combat de masse / Puissance de Bataille (ADE II 8, #148) — 5 tables verbatim NICHÉES dans
  // UN seul fichier (`mass-battle.json`, moteur `engine/massBattle.ts`). Champs déjà imprimés en
  // STRINGS par la source (prix/portée/dégâts/atouts) → faits bruts (`fact`), pas de cross-réf chips :
  // les libellés d'Atouts imprimés ici (« Explosion 15 », « Impénétrable »…) ne correspondent PAS
  // toujours tels quels aux libellés canoniques de `qualities`/`traits` (ex. qualité « À Explosion » vs
  // « Explosion » ici, trait « Impénétrable (structure) » vs « Impénétrable » ici) — une décomposition
  // par id resterait à faire côté donnée (hors périmètre #148, ne pas inventer un rapprochement flou). ──
  {
    key: 'massBattlePowerEstimate', label: 'Bataille de masse — Estimation de Puissance', group: 'Tables', cluster: 'Bataille de masse',
    build: () => POWER_ESTIMATE.map((p) => ({
      id: p.id, label: p.label,
      meta: facts(fact('Puissance alliée', p.ally), fact('Puissance ennemie', p.enemy)),
      desc: p.example,
    })),
  },
  {
    key: 'massBattleMightModifiers', label: 'Bataille de masse — Modificateurs de Puissance', group: 'Tables', cluster: 'Bataille de masse',
    build: () => MIGHT_MODIFIERS.map((m) => ({
      id: m.id, label: m.label,
      meta: facts(fact('Modificateur', m.mod > 0 ? `+${m.mod}` : String(m.mod))),
      desc: m.example,
    })),
  },
  {
    key: 'massBattleWarMachines', label: 'Bataille de masse — Machines de guerre', group: 'Tables', cluster: 'Bataille de masse',
    build: () => WAR_MACHINES.map((w) => ({
      id: w.id, label: w.label,
      meta: facts(
        fact('Prix', w.price), fact('Équipe', w.crew), fact('Disponibilité', w.availability),
        fact('Portée', w.range), fact('Dégâts', w.damage), fact('Atouts', w.traits),
      ),
    })),
  },
  {
    key: 'massBattleStructures', label: 'Bataille de masse — Structures', group: 'Tables', cluster: 'Bataille de masse',
    build: () => MASS_BATTLE_STRUCTURES.map((s) => ({
      id: s.id, label: s.label,
      meta: facts(fact('BE', s.be), fact('Blessures', s.wounds), fact('Atouts', s.traits)),
    })),
  },
  {
    key: 'massBattleHazards', label: 'Bataille de masse — Aléas de bataille', group: 'Tables', cluster: 'Bataille de masse',
    build: () => BATTLE_HAZARDS.map((h) => ({ id: h.id, label: h.label, sub: `1d10 = ${h.min}`, desc: h.text })),
  },
  // ── Datasets-OBJETS uniques (E3b) : config de création (objet) + banque de noms (Record par race) ──
  {
    key: 'details', label: 'Détails de création', group: 'Tables', cluster: 'Création de personnage', sourceRef: 'LDB 05',
    // UNE seule entrée (objet `details.json`) — formules Âge/Taille par espèce + textes d'aide.
    build: () => [{
      id: 'details', label: 'Détails de création',
      sections: sections({
        title: 'Formules Âge & Taille (base + Nd10)', layout: 'list',
        rows: (Object.keys(details.ageBase) as RaceKey[]).map((sp) => ({
          t: 'kv', k: sp,
          v: `Âge ${details.ageBase[sp]}+${Math.round(details.ageRoll[sp] ?? 1)}d10 · Taille ${details.heightBase[sp]}+${Math.round(details.heightRoll[sp] ?? 1)}d10 cm`,
        } as CodexRow)),
      }),
    }],
  },
  {
    key: 'names', label: 'Banque de noms', group: 'Tables', cluster: 'Création de personnage',
    // Record race → NamePool : une entrée par race (clé = libellé de l'item, édité au Codex) — la clé
    // de Record EST déjà une identité stable (`RaceKey`), reprise telle quelle comme id.
    build: () => Object.entries(names).map(([race, pool]) => ({
      id: race, label: race,
      sub: `${pool.maleFirstNames.length}♂ · ${pool.femaleFirstNames.length}♀ · ${pool.lastNames.length} noms`,
      sections: sections(
        pool.maleFirstNames.length ? { title: 'Prénoms masculins', layout: 'chips', rows: [{ t: 'text', text: pool.maleFirstNames.join(', ') }] } : null,
        pool.femaleFirstNames.length ? { title: 'Prénoms féminins', layout: 'chips', rows: [{ t: 'text', text: pool.femaleFirstNames.join(', ') }] } : null,
        pool.lastNames.length ? { title: 'Noms de famille', layout: 'chips', rows: [{ t: 'text', text: pool.lastNames.join(', ') }] } : null,
      ),
    })),
  },
  // ── #157 : catalogues de CONTENU app-owned (façade ou module dédié) exposés au Codex. ──
  {
    key: 'structures', label: 'Structures (siège)', group: 'Monde',
    build: () => structures.map((s) => ({
      id: s.id, label: s.label, sub: s.kind === 'porte' ? 'Porte' : 'Mur', desc: s.desc ?? undefined,
      meta: facts(
        fact('BE', s.char.BE), fact('Blessures', s.char.B), fact('Fortifiée', s.fortified ? 'oui' : null),
        fact('Source', s.source ? `${bookAbr(s.source.book)} ch.${s.source.chapter}` : null),
      ),
      sections: sections(chips('Atouts', 'traits', traitLabels(s.traits as unknown as import('../../engine/statEntry').TraitList))),
    })),
  },
  {
    key: 'vehicles', label: 'Véhicules', group: 'Monde',
    build: () => vehicles.map((v) => ({
      id: v.id, label: v.label, desc: v.desc ?? undefined, source: src(v.source),
      meta: facts(
        fact('Prix', priceLabel(v.purchase?.price)), fact('Disponibilité', v.purchase?.availability ?? null),
        fact('Enc', v.enc), fact('Mouvement (voyage)', v.travel?.movement),
        fact('Endurance', v.hull?.char.endurance), fact('Blessures', v.hull?.char.B),
      ),
    })),
  },
  {
    key: 'celestialHouses', label: 'Demeures astrologiques', group: 'Personnage',
    build: () => celestialHouses.map((h) => ({ id: h.id, label: h.label, sub: `2d10 ≤ ${h.rand}`, desc: h.desc, source: src(h.source) })),
  },
  {
    key: 'groups', label: 'Groupes (Cible)', group: 'Monde',
    build: () => groups.map((g) => ({ id: g.id, label: g.label })),
  },
  {
    key: 'psychologies', label: 'États psychologiques', group: 'Effets',
    build: () => psychologies.map((p) => ({
      id: p.id, label: p.label, desc: p.desc, source: src(p.source),
      sections: sections(passiveSection(p.passive), effectsSection(p.effects), ...reverseSections('psychologies', p.id)),
    })),
  },
  {
    key: 'seaShanties', label: 'Chants de marins', group: 'Monde',
    build: () => seaShanties.map((s) => ({
      id: s.id, label: s.label, desc: s.desc, source: src(s.source),
      meta: facts(fact('Note', s.note ?? null)),
      sections: sections(passiveSection(s.crewOps, 'Effet (équipage)'), passiveSection(s.captainOps, 'Effet (capitaine)')),
    })),
  },
  {
    key: 'crewRoles', label: 'Rôles d’équipage', group: 'Monde',
    build: () => crewRoles.map((r) => ({
      id: r.id, label: r.label, desc: r.desc,
      sections: sections(chips('Compétences', 'skills', r.skills.map((sk) => refLabel('skills', { id: sk.skillId, spec: sk.spec })))),
    })),
  },
  {
    key: 'crewTestTypes', label: 'Tests d’équipage (types)', group: 'Monde',
    build: () => crewTestTypes.map((t) => ({
      id: t.id, label: t.label,
      meta: facts(fact('Rôle essentiel', crewRoles.find((r) => r.id === t.essential)?.label ?? t.essential)),
      sections: sections(chips('Rôles contributeurs', 'crewRoles', t.roles.map((id) => crewRoles.find((r) => r.id === id)?.label ?? id))),
    })),
  },
  {
    key: 'navalTraits', label: 'Traits & améliorations navales', group: 'Équipement',
    build: () => NAVAL_TRAITS.map((t) => ({
      id: t.id, label: t.label, sub: t.kind === 'trait' ? 'Trait (construction)' : 'Amélioration', desc: t.desc, source: src(t.source),
      sections: sections(passiveSection(t.passive)),
    })),
  },
  {
    key: 'traumas', label: 'Traumatismes (séquelles)', group: 'Effets',
    build: () => datasetArray('traumas').map((f) => ({
      id: f.id, label: f.label,
      sub: f.kind ? `${f.kind === 'dechirure' ? 'Déchirure' : 'Fracture'}${f.severity ? ` (${f.severity})` : ''}` : undefined,
      desc: f.desc,
      sections: sections(passiveSection(f.ops, 'Effet permanent')),
    })),
  },
  {
    key: 'criticalsTete', label: 'Critiques — Tête (Traumatisme)', group: 'Effets', cluster: 'Blessures critiques', sourceRef: 'LDB 18',
    build: () => datasetArray('criticalsTete').map(critEntryItem),
  },
  {
    key: 'criticalsBras', label: 'Critiques — Bras (Traumatisme)', group: 'Effets', cluster: 'Blessures critiques', sourceRef: 'LDB 18',
    build: () => datasetArray('criticalsBras').map(critEntryItem),
  },
  {
    key: 'criticalsCorps', label: 'Critiques — Corps (Traumatisme)', group: 'Effets', cluster: 'Blessures critiques', sourceRef: 'LDB 18',
    build: () => datasetArray('criticalsCorps').map(critEntryItem),
  },
  {
    key: 'criticalsJambe', label: 'Critiques — Jambe (Traumatisme)', group: 'Effets', cluster: 'Blessures critiques', sourceRef: 'LDB 18',
    build: () => datasetArray('criticalsJambe').map(critEntryItem),
  },
  {
    key: 'aaCriticalsTete', label: 'Critiques — Tête (approche alternative)', group: 'Effets', cluster: 'Blessures critiques', sourceRef: 'AA',
    build: () => datasetArray('aaCriticalsTete').map(critEntryItem),
  },
  {
    key: 'aaCriticalsBras', label: 'Critiques — Bras (approche alternative)', group: 'Effets', cluster: 'Blessures critiques', sourceRef: 'AA',
    build: () => datasetArray('aaCriticalsBras').map(critEntryItem),
  },
  {
    key: 'aaCriticalsCorps', label: 'Critiques — Corps (approche alternative)', group: 'Effets', cluster: 'Blessures critiques', sourceRef: 'AA',
    build: () => datasetArray('aaCriticalsCorps').map(critEntryItem),
  },
  {
    key: 'aaCriticalsJambe', label: 'Critiques — Jambe (approche alternative)', group: 'Effets', cluster: 'Blessures critiques', sourceRef: 'AA',
    build: () => datasetArray('aaCriticalsJambe').map(critEntryItem),
  },
  {
    key: 'incidentsMonture', label: 'Incidents de monte', group: 'Tables', cluster: 'Voyage terrestre',
    build: () => MOUNT_INCIDENTS.map((e) => travelEntryItem(e, 'Effet sur le cavalier')),
  },
  {
    key: 'problemesVehicule', label: 'Problèmes de véhicule', group: 'Tables', cluster: 'Voyage terrestre',
    build: () => VEHICLE_PROBLEMS.map((e) => travelEntryItem(e, 'Effet sur les occupants')),
  },
  {
    key: 'rencontresPositives', label: 'Rencontres — Positives', group: 'Tables', cluster: 'Rencontres',
    build: () => datasetArray('rencontresPositives').map((e) => travelEntryItem(e, 'Effet sur les occupants')),
  },
  {
    key: 'rencontresFortuites', label: 'Rencontres — Fortuites', group: 'Tables', cluster: 'Rencontres',
    build: () => datasetArray('rencontresFortuites').map((e) => travelEntryItem(e, 'Effet sur les occupants')),
  },
  {
    key: 'rencontresDangereuses', label: 'Rencontres — Dangereuses', group: 'Tables', cluster: 'Rencontres',
    build: () => datasetArray('rencontresDangereuses').map((e) => travelEntryItem(e, 'Effet sur les occupants')),
  },
  {
    key: 'shipCriticalsCargaison', label: 'Critiques de navire — Cargaison', group: 'Effets', cluster: 'Critiques de navire', sourceRef: 'MDG 13',
    build: () => datasetArray('shipCriticalsCargaison').map(shipCritEntryItem),
  },
  {
    key: 'shipCriticalsGreement', label: 'Critiques de navire — Gréement', group: 'Effets', cluster: 'Critiques de navire', sourceRef: 'MDG 13',
    build: () => datasetArray('shipCriticalsGreement').map(shipCritEntryItem),
  },
  {
    key: 'shipCriticalsCoque', label: 'Critiques de navire — Coque', group: 'Effets', cluster: 'Critiques de navire', sourceRef: 'MDG 13',
    build: () => datasetArray('shipCriticalsCoque').map(shipCritEntryItem),
  },
  {
    key: 'shipCriticalsAvirons', label: 'Critiques de navire — Avirons', group: 'Effets', cluster: 'Critiques de navire', sourceRef: 'MDG 13',
    build: () => datasetArray('shipCriticalsAvirons').map(shipCritEntryItem),
  },
  {
    key: 'shipCriticalsEquipements', label: 'Critiques de navire — Équipements', group: 'Effets', cluster: 'Critiques de navire', sourceRef: 'MDG 13',
    build: () => datasetArray('shipCriticalsEquipements').map(shipCritEntryItem),
  },
  {
    key: 'riverCriticalsGreement', label: 'Critiques fluviaux — Gréement', group: 'Effets', cluster: 'Critiques fluviaux', sourceRef: 'MSRC 7',
    build: () => datasetArray('riverCriticalsGreement').map(shipCritEntryItem),
  },
  {
    key: 'riverCriticalsAvirons', label: 'Critiques fluviaux — Rames', group: 'Effets', cluster: 'Critiques fluviaux', sourceRef: 'MSRC 7',
    build: () => datasetArray('riverCriticalsAvirons').map(shipCritEntryItem),
  },
  {
    key: 'riverCriticalsGouvernail', label: 'Critiques fluviaux — Gouvernail', group: 'Effets', cluster: 'Critiques fluviaux', sourceRef: 'MSRC 7',
    build: () => datasetArray('riverCriticalsGouvernail').map(shipCritEntryItem),
  },
  {
    key: 'riverCriticalsCoque', label: 'Critiques fluviaux — Coque', group: 'Effets', cluster: 'Critiques fluviaux', sourceRef: 'MSRC 7',
    build: () => datasetArray('riverCriticalsCoque').map(shipCritEntryItem),
  },
  {
    key: 'riverCriticalsSuperstructure', label: 'Critiques fluviaux — Superstructure', group: 'Effets', cluster: 'Critiques fluviaux', sourceRef: 'MSRC 7',
    build: () => datasetArray('riverCriticalsSuperstructure').map(shipCritEntryItem),
  },
  {
    key: 'seaManannFactors', label: 'Humeur de Manann — Facteurs', group: 'Tables', cluster: 'Mer & rivière', sourceRef: 'MDG 15',
    build: () => datasetArray('seaManannFactors').map(manannFactorItem),
  },
  {
    key: 'seaBoardEvents', label: 'Événements de bord (mer)', group: 'Tables', cluster: 'Mer & rivière', sourceRef: 'MDG 15',
    build: () => datasetArray('seaBoardEvents').map(seaEventItem),
  },
  {
    key: 'seaPortEvents', label: 'Événements de port (mer)', group: 'Tables', cluster: 'Mer & rivière', sourceRef: 'MDG 15',
    build: () => datasetArray('seaPortEvents').map(seaEventItem),
  },
  {
    key: 'waterExposure', label: 'Exposition à l’eau (maladies hydriques)', group: 'Tables', cluster: 'Mer & rivière', sourceRef: 'MSRC 16',
    build: () => {
      const w = datasetObject('waterExposure');
      return [{
        id: 'waterExposure', label: w.label, desc: w.desc, source: src(w.source),
        meta: facts(
          fact('Test', `${refLabel('skills', { id: w.test.skillId })} ${DIFFICULTY_LABELS[w.test.difficulty]}`),
          fact('Malus par DR négatif (jet de maladie)', `+${w.rollModPerNegativeSL}`),
        ),
        sections: sections(
          waterModifiersSection(w.modifiers),
          {
            title: 'Maladies (jet d100 après échec du Test)', layout: 'list',
            rows: w.diseases.map((d) => {
              const label = maladies.find((m) => m.id === d.disease)?.label ?? d.disease;
              return { t: 'ref', category: 'maladies', id: d.disease, label, show: label, badge: `${d.min}–${d.max}${d.rerollUnlessWounded ? ' · relance si indemne' : ''}` } as CodexRow;
            }),
          },
        ),
      }];
    },
  },
  {
    key: 'navalPorts', label: 'Ports (Index de la Mer des Griffes)', group: 'Monde', sourceRef: 'MDG 15',
    build: () => navalPorts.map((p) => ({
      id: p.id, label: p.label, group: p.region, desc: p.desc, source: src(p.source),
      meta: facts(
        fact('Taille', p.taille), fact('Richesse', p.richesse),
        fact('Dirigeant', p.dirigeant ?? null), fact('Cosmopolite', p.cosmopolite ? 'oui' : null),
      ),
      sections: sections(
        p.production?.length ? { title: 'Production', layout: 'chips', rows: p.production.map((id) => portCargoRow(id)) } : null,
        p.surplus && Object.keys(p.surplus).length ? { title: 'Surplus', layout: 'chips', rows: Object.entries(p.surplus).map(([id, q]) => portCargoRow(id, q)) } : null,
        p.demande && Object.keys(p.demande).length ? { title: 'Demande', layout: 'chips', rows: Object.entries(p.demande).map(([id, q]) => portCargoRow(id, q)) } : null,
      ),
    })),
  },
  {
    key: 'navalProgression', label: 'Progression de navire (DR de Navigation → Mouvement)', group: 'Tables', cluster: 'Mer & rivière', sourceRef: 'MDG 13',
    build: () => datasetArray('navalProgression').map((e) => ({
      id: e.id, label: PROGRESSION_MODE_LABEL[e.mode] ?? e.mode,
      sub: `DR ${e.min}…${e.max}`, desc: e.desc, source: src(e.source),
    })),
  },
  {
    key: 'shipHullSizes', label: 'Gabarits de coque (Construction navale)', group: 'Équipement', cluster: 'Mer & rivière', sourceRef: 'MDG 12',
    build: () => datasetArray('shipHullSizes').map((s) => ({
      id: s.id, label: SHIP_SIZE_LABEL[s.size] ?? s.size, source: src(s.source),
      meta: facts(
        fact('Coût', formatMoney(priceToMoney({ gold: s.costGold, silver: 0, bronze: 0 }))),
        fact('Équipage', s.crew),
        s.sail ? fact('Voile', `M${s.sail.m} (équipage ${s.sail.crew})`) : null,
        s.oars ? fact('Rames', `M${s.oars.m} (équipage ${s.oars.crew})`) : null,
        fact('Longueur', `${s.lengthM[0]}–${s.lengthM[1]} m`),
        fact('Endurance', s.e), fact('Blessures', s.b), fact('Capacité', s.capacity),
      ),
      sections: sections(shipConstructionRulesSection()),
    })),
  },
  {
    key: 'shipSpeedTraits', label: 'Traits de vitesse (Construction navale)', group: 'Équipement', cluster: 'Mer & rivière', sourceRef: 'MDG 12',
    build: () => datasetArray('shipSpeedTraits').map((t) => ({
      id: t.id, label: t.label, source: src(t.source),
      meta: facts(
        signedFact('Mouvement', t.mMod), signedFact('Capacité', t.capacityPct, ' %'),
        signedFact('Manœuvrabilité', t.manDR), signedFact('Coût', t.costPct, ' %'),
      ),
    })),
  },
  {
    key: 'shipConstructionTraits', label: 'Traits de construction (navire)', group: 'Équipement', cluster: 'Mer & rivière', sourceRef: 'MDG 12',
    build: () => datasetArray('shipConstructionTraits').map((t) => ({
      id: t.id, label: CONSTRUCTION_TRAIT_LABEL[t.id] ?? t.id, source: src(t.source),
      meta: facts(
        fact('Niveau max', t.maxLevel), signedFact('Coût / niveau', t.costPctPerLevel, ' %'),
        signedFact('Endurance / niveau', t.ePerLevel), signedFact('Blessures / niveau', t.bPctPerLevel, ' %'),
        signedFact('Capacité / niveau', t.capacityPctPerLevel, ' %'),
      ),
    })),
  },
  {
    key: 'seaNavigation', label: 'Navigation maritime (Progression, Salissures, Orientation, Phares, Poursuite…)', group: 'Tables', cluster: 'Mer & rivière', sourceRef: 'MDG 13/15',
    build: () => {
      const n = datasetObject('seaNavigation');
      return [{
        id: 'seaNavigation', label: 'Navigation maritime', source: src(n.workPeriodHours.source),
        sections: sections(
          {
            title: 'Périodes de travail & Épuisement', layout: 'list',
            rows: [
              { t: 'kv', k: 'Voile / Barre', v: `${n.workPeriodHours.voile} h` },
              { t: 'kv', k: 'Rames', v: `${n.workPeriodHours.avirons} h` },
              { t: 'kv', k: 'Test d’Épuisement', v: DIFFICULTY_LABELS[n.epuisement.difficulty] },
              { t: 'kv', k: 'Test d’Épuisement (rythme forcé)', v: DIFFICULTY_LABELS[n.epuisement.forcedDifficulty] },
            ],
          },
          {
            title: 'Forcer le rythme', layout: 'list',
            rows: n.forcerLeRythme.map((r) => ({
              t: 'kv', k: `+${r.bonusM} M`,
              v: [r.voile ? `Voile ${DIFFICULTY_LABELS[r.voile]}` : null, r.avirons ? `Rames ${DIFFICULTY_LABELS[r.avirons]}` : null].filter(Boolean).join(' · '),
            } as CodexRow)),
          },
          {
            title: 'Vitesses maximum (« Ça va lâcher, capitaine ! »)', layout: 'list',
            rows: [
              { t: 'kv', k: 'Sans risque', v: `jusqu’à M+${n.vitesseMax.safeBonus}` } as CodexRow,
              ...n.vitesseMax.table.map((row) => ({ t: 'kv', k: `M+${row.min}${row.max > row.min ? `…+${row.max}` : ''}`, v: `${DIFFICULTY_LABELS[row.difficulty]} · ${row.damage} Dégâts/${row.per}` } as CodexRow)),
            ],
          },
          {
            title: 'Salissures (Test hebdomadaire de Résistance du navire)', layout: 'list',
            rows: n.salissures.levels.map((l) => ({ t: 'kv', k: `Niveau ${l.level}`, v: `Man ${l.manDR} · M${l.mMod} · Nav ${l.navDR} · réparation ${l.repairPctOfBase} % — ${l.desc}` } as CodexRow)),
          },
          {
            title: 'Orientation — Repères (1 Test/jour)', layout: 'list',
            rows: n.orientation.reperes.map((r) => ({ t: 'kv', k: `DR ${r.min}…${r.max}`, v: r.desc } as CodexRow)),
          },
          {
            title: 'Changement de cap', layout: 'list',
            rows: n.orientation.changementDeCap.map((r) => ({ t: 'kv', k: `d10 ${r.min}…${r.max}`, v: r.desc } as CodexRow)),
          },
          {
            title: 'Phares & clochers (Perception)', layout: 'list',
            rows: n.phares.voirLaLumiere.map((r) => ({ t: 'kv', k: `jusqu’à ${r.max} milles`, v: DIFFICULTY_LABELS[r.difficulty] } as CodexRow)),
          },
          {
            title: 'Longs voyages', layout: 'list',
            rows: [
              { t: 'kv', k: 'Milles/jour par point de M', v: String(n.longsVoyages.millesParJourParM) } as CodexRow,
              { t: 'kv', k: 'Sans voguer de nuit', v: `÷${n.longsVoyages.sansVoguerDeNuitDiviseur}` } as CodexRow,
              { t: 'kv', k: 'Progression du Test d’équipage', v: `±${n.longsVoyages.progressionPctParDR} % / DR` } as CodexRow,
            ],
          },
          {
            title: 'Course-poursuite (distances d’évasion)', layout: 'list',
            rows: n.poursuite.escapeDistances.map((e) => ({ t: 'kv', k: e.label, v: `${e.distance} points` } as CodexRow)),
          },
          {
            title: 'Réparations au port', layout: 'list',
            rows: [
              { t: 'kv', k: 'Coût au port', v: `${n.reparation.portCostGoldPerWound} po / Blessure` } as CodexRow,
              { t: 'kv', k: 'Temps de Test', v: n.reparation.testHours } as CodexRow,
              { t: 'kv', k: 'Blessures réparées / Test', v: n.reparation.woundsPerTest } as CodexRow,
            ],
          },
        ),
      }];
    },
  },
  {
    key: 'seaPerils', label: 'Périls en mer (Échouage, Icebergs, Détroits, Tourbillons)', group: 'Tables', cluster: 'Mer & rivière', sourceRef: 'MDG 13',
    build: () => {
      const p = datasetObject('seaPerils');
      return [{
        id: 'seaPerils', label: 'Périls en mer', desc: p.echouer.desc, source: src(p.echouer.source),
        sections: sections(
          {
            title: 'Dangers flottants', layout: 'list',
            rows: p.hazards.map((h) => ({ t: 'kv', k: h.label, v: `IC ${h.ic}${h.m != null ? ` · M${h.m}` : ''}${h.strandChancePct != null ? ` · Échouage ${h.strandChancePct} %` : ''}${h.entangleChancePct != null ? ` · Empêtrement ${h.entangleChancePct} %` : ''} — ${h.desc}` } as CodexRow)),
          },
          {
            title: 'Détroits', layout: 'list',
            rows: p.detroits.map((d) => ({ t: 'kv', k: d.label, v: `M${d.m} · Nav ${d.navDR}` } as CodexRow)),
          },
          {
            title: 'Tourbillons', layout: 'list',
            rows: p.tourbillons.map((w) => ({ t: 'kv', k: w.label, v: `M${w.m} · rayon ${w.zoneRadiusM} m (spirale ${w.zoneSpiralM} m) · Man ${w.manDR} · IC ${w.ic} · évasion ${DIFFICULTY_LABELS[w.evasion.difficulty]} (${w.evasion.totalDR} DR)` } as CodexRow)),
          },
          {
            title: 'Gestion des périls (repérage / évitement par distance)', layout: 'list',
            rows: p.gestionDesPerils.map((g) => ({ t: 'kv', k: `${g.distanceM} m`, v: `repérage ${DIFFICULTY_LABELS[g.spot]} · évitement ${DIFFICULTY_LABELS[g.avoid]}` } as CodexRow)),
          },
        ),
      }];
    },
  },
  {
    key: 'seaWeather', label: 'Météo de la Mer des Griffes', group: 'Tables', cluster: 'Mer & rivière', sourceRef: 'MDG 13',
    build: () => {
      const w = datasetObject('seaWeather');
      // Les 4 aspects du tirage (`table[].precipitations`/`.temperature`/`.visibilite`/`.vent`) sont des
      // ids de catalogue (`w.precipitations`/`.temperatures`/`.visibilites`/`.vents`, CHACUN déjà porteur
      // de son `label` FR verbatim MDG) — la fiche résout id→label PAR LOOKUP (jamais l'id affiché ;
      // aucune duplication de `label` sur `table[]`, la SOURCE UNIQUE du libellé reste le catalogue).
      const precipLabel = new Map(w.precipitations.map((p) => [p.id, p.label]));
      const tempLabel = new Map(w.temperatures.map((t) => [t.id, t.label]));
      const visLabel = new Map(w.visibilites.map((v) => [v.id, v.label]));
      const windLabel = new Map(w.vents.map((v) => [v.id, v.label]));
      return [{
        id: 'seaWeather', label: 'Météo de la Mer des Griffes', source: src(w.table[0]?.source),
        meta: facts(fact('Modificateur mer chaude', w.warmSeaMod)),
        sections: sections(
          {
            title: 'Tirage quotidien (2d10)', layout: 'list',
            rows: w.table.map((row) => ({
              t: 'kv', k: `2d10 ${row.min}…${row.max}`,
              v: [precipLabel.get(row.precipitations), tempLabel.get(row.temperature), visLabel.get(row.visibilite), windLabel.get(row.vent)].join(' · '),
            } as CodexRow)),
          },
          {
            title: 'Modificateur saisonnier', layout: 'list',
            rows: [
              { t: 'kv', k: 'Été', v: String(w.seasonMod.ete) } as CodexRow,
              { t: 'kv', k: 'Automne', v: String(w.seasonMod.automne) } as CodexRow,
              { t: 'kv', k: 'Printemps', v: String(w.seasonMod.printemps) } as CodexRow,
              { t: 'kv', k: 'Hiver', v: String(w.seasonMod.hiver) } as CodexRow,
            ],
          },
          {
            title: 'Précipitations', layout: 'list',
            rows: w.precipitations.map((p) => ({ t: 'kv', k: p.label, v: p.desc ?? '—' } as CodexRow)),
          },
          {
            title: 'Température', layout: 'list',
            rows: w.temperatures.map((t) => ({ t: 'kv', k: t.label, v: t.difficulty ? `Test toutes les ${t.testEveryHours} h — ${DIFFICULTY_LABELS[t.difficulty]} (${t.exposure})` : '—' } as CodexRow)),
          },
          {
            title: 'Visibilité', layout: 'list',
            rows: w.visibilites.map((v) => ({ t: 'kv', k: v.label, v: v.drPenalty != null ? `${v.drPenalty} DR au-delà de ${v.beyondM} m` : '—' } as CodexRow)),
          },
          {
            title: 'Vents', layout: 'chips',
            rows: w.vents.map((v) => ({ t: 'text', text: v.label } as CodexRow)),
          },
        ),
      }];
    },
  },
  {
    key: 'montures', label: 'Montures (profils de voyage)', group: 'Monde',
    build: () => MOUNT_PROFILES.map((p) => ({
      id: p.id, label: p.label,
      meta: facts(fact('Mouvement', p.m), fact('Endurance', p.e), fact('Trotte', p.trot ? 'oui' : 'non')),
      sections: sections(chips('Possessions liées', 'trappings', p.trappingIds.map((id) => findTrappingById(id)?.label ?? id))),
    })),
  },
  {
    key: 'tavernGames', label: 'Jeux de taverne', group: 'Monde',
    build: () => TAVERN_GAMES.map((g) => ({
      id: g.id, label: g.label, desc: g.desc, source: src(g.source),
      meta: facts(
        fact('Compétence', g.skill ? refLabel('skills', { id: g.skill, spec: g.spec }) : 'Pari (aucune Compétence)'),
        fact('Caractéristique', g.characteristic ? CHAR_LABELS[g.characteristic] : null),
        fact('Mode', g.mode === 'extended' ? `Étendu (${g.target ?? '?'} DR)` : 'Opposé simple'),
        fact('Plafond de DR', g.drCap ?? null), fact('Mise', g.stake ?? null),
      ),
    })),
  },
  {
    key: 'obsessions', label: 'Obsessions (table)', group: 'Tables',
    build: () => OBSESSIONS.map((o) => ({ id: o.id, label: o.label, sub: `2d10 ${o.min}–${o.max}` })),
  },
  {
    key: 'structureCriticals', label: 'Critiques de structure', group: 'Effets',
    build: () => STRUCTURE_CRITICALS.map((c) => ({
      id: c.id, label: c.label, sub: `d100 ${c.min}–${c.max}`, desc: c.note,
      meta: facts(
        c.wounds != null ? fact('Blessures', c.wounds) : null,
        c.trivial ? fact('Type', 'Triviale (« T »)') : null,
        c.destroyed ? fact('Effondrement', 'oui') : null,
      ),
    })),
  },
  {
    key: 'artilleryMisfire', label: 'Incidents de Tir par Salve', group: 'Effets',
    build: () => ARTILLERY_MISFIRE.map((e) => ({
      id: e.id, label: e.label, sub: `d10 ${e.min}–${e.max}`, desc: e.note,
      meta: facts(
        fact('Localisation', e.location === 'brasPrincipal' ? 'Bras principal' : 'Aléatoire'),
        e.perSalveIndex ? fact('Répétition', 'par Indice de Salve restant') : null,
        e.destroyed ? fact('Pièce détruite', 'oui') : null,
        e.strayFire ? fact('Tir perdu', 'oui') : null,
      ),
    })),
  },
  {
    key: 'landCargo', label: 'Cargaison terrestre', group: 'Monde',
    build: () => LAND_CARGOES.map((c) => ({ id: c.id, label: c.label, meta: facts(fact('Vin', c.wine ? 'oui' : null)) })),
  },
  {
    key: 'seaCargo', label: 'Cargaison maritime', group: 'Monde',
    build: () => CARGOES.map((c) => ({ id: c.id, label: c.label })),
  },
  {
    key: 'riverPerils', label: 'Périls fluviaux', group: 'Monde',
    build: () => RIVER_PERILS.map((p) => ({ id: p.id, label: p.label, sub: p.kind })),
  },
  {
    key: 'crewMoraleFactors', label: 'Moral d’équipage — Facteurs', group: 'Tables', cluster: 'Équipage & navire',
    build: () => MORALE_FACTORS.map((f) => ({ id: f.id, label: f.label, desc: f.effect })),
  },
  {
    key: 'crewMoraleBands', label: 'Moral d’équipage — Effets', group: 'Tables', cluster: 'Équipage & navire',
    build: () => MORALE_BANDS.map((b) => ({
      id: b.id, label: b.id, sub: `d100 ${b.min}–${b.max}`,
      meta: facts(
        fact('DR Commandement (capitaine)', b.captainCmdDR), fact('DR Tests équipage', b.crewTestDR),
        fact('Désertion (seuil d100)', b.desertionRoll ?? null),
      ),
    })),
  },
  {
    key: 'steamBreakdowns', label: 'Pannes de navire à vapeur', group: 'Tables', cluster: 'Équipage & navire',
    build: () => STEAM_BREAKDOWNS.map((e) => ({
      id: e.id, label: e.label, sub: `d100 ${e.min}–${e.max}`, desc: e.desc,
      meta: facts(fact('Moteur détruit', e.engineDestroyed ? 'oui' : null)),
    })),
  },
  {
    // Procédures / options de jeu au texte VERBATIM (Sombre Pacte, Empoignade, modes d'attaque…) —
    // cible des tooltips `CodexRef` qui portaient une paraphrase de règle (#392).
    key: 'regles', label: 'Règles de jeu', group: 'Monde',
    build: () => regles.map((r) => ({ id: r.id, label: r.label, desc: r.desc, source: src(r.source) })),
  },
];

/** Les catégories consultables — chaque `items`/`facets` est un getter re-projetable (fraîcheur). */
export const CODEX: CodexCategory[] = CODEX_SPECS.map(makeCategory);

/** Section « table 2d10 » d'une couleur (yeux/cheveux) — borne + couleur par colonne d'espèce. */
function colorTableSection(c: (typeof eyes)[number]): CodexSection {
  return {
    title: 'Couleur par espèce (colonne refChar)', layout: 'list',
    rows: Object.entries(c.color).filter(([, v]) => v).map(([sp, v]) => ({ t: 'kv', k: sp, v } as CodexRow)),
  };
}

/** Catégories d'une famille, dans l'ordre de déclaration. */
export const categoriesIn = (group: CodexGroup): CodexCategory[] => CODEX.filter((c) => c.group === group);

/** Un sous-groupe repliable de catégories (barre de catégories du Compendium). */
/** Sous-groupe replié de la barre de catégories : `id` STABLE (slug du `cluster` authoré) porte la
 *  LOGIQUE (clé de repli, clé React), `label` l'AFFICHAGE — le titre FR ne sert plus de clé (#602). */
export interface CodexCluster { id: string; label: string; cats: CodexCategory[] }
/** Éclate les catégories d'une famille en pastilles À PLAT (sans `cluster`) + sous-groupes repliables
 *  (par `cluster`), dans l'ordre de déclaration. Anti-avalanche des familles touffues (Effets/Tables) :
 *  les catégories d'un même `cluster` se replient sous un unique dépliable. */
export const clustersIn = (group: CodexGroup): { flat: CodexCategory[]; clusters: CodexCluster[] } => {
  const flat: CodexCategory[] = [];
  const clusters: CodexCluster[] = [];
  const byName = new Map<string, CodexCluster>();
  for (const c of categoriesIn(group)) {
    if (!c.cluster) { flat.push(c); continue; }
    let cl = byName.get(c.cluster);
    if (!cl) { cl = { id: slugId(c.cluster), label: c.cluster, cats: [] }; byName.set(c.cluster, cl); clusters.push(cl); }
    cl.cats.push(c);
  }
  return { flat, clusters };
};

/** Catégorie par clé. */
export const categoryByKey = (key: string): CodexCategory | undefined => CODEX.find((c) => c.key === key);

/** Identité STABLE d'une entrée de Codex = sérialisation canonique du couple `{category, id}` —
 *  `CodexItem.id` est unique par catégorie, la clé de navigation qualifie donc la catégorie. C'est
 *  la clé de sélection du navigateur (jamais un `.label ===` nu). */
export const codexItemKey = (category: string, id: string): string => `${category}␞${id}`;

// ── Index de lookup PARESSEUX (par catégorie) ────────────────────────────────────────────────────
// `codexLookup` est appelé par CHAQUE `CodexRef` à CHAQUE rendu → un `items.find` linéaire ne scale
// pas (des centaines de refs × des centaines d'items). L'index (label exact → item, + repli casse
// pliée) se construit à la 1re résolution d'une catégorie — sur les `items` COURANTS du getter
// re-projetable — et se ré-utilise ensuite. La 1re occurrence gagne (même précédence que l'ancien
// `find`). Invalidé par `invalidateCodexLookup` (persist d'une édition Codex) : index ET projections
// (`c.items`/`c.facets`) repartent alors de la donnée persistée, et `useCodexVersion` fait re-rendre
// les lecteurs (CompendiumScreen). L'état (`LOOKUP`/`LOOKUP_VERSION`) vit en tête de fichier, avec
// la machinerie de fraîcheur.

/** Index (byId + label exact/casse pliée) d'une catégorie, construit à la 1re résolution — `undefined`
 *  si la catégorie est inconnue (jamais mis en cache, répond `undefined` à chaque appel). */
function categoryIndex(category: string): { byId: Map<string, CodexItem>; exact: Map<string, CodexItem>; folded: Map<string, CodexItem> } | undefined {
  if (!LOOKUP) LOOKUP = new Map();
  let idx = LOOKUP.get(category);
  if (!idx) {
    const items = categoryByKey(category)?.items;
    if (!items) return undefined;
    idx = { byId: new Map(), exact: new Map(), folded: new Map() };
    // Parcours INVERSÉ + `set` nu : le dernier écrit gagne, donc la PREMIÈRE occurrence de la liste
    // l'emporte (précédence historique du `find`), sans interroger un index par libellé (#602) —
    // remplir un index de texte est la couture tolérée, le questionner par `.label` ne l'est pas.
    for (let i = items.length - 1; i >= 0; i--) {
      const it = items[i];
      if (it.id) idx.byId.set(it.id, it);
      if (!it.label) continue; // entrée sans label (défensif) : non indexée
      idx.exact.set(it.label, it);
      idx.folded.set(it.label.toLowerCase(), it);
    }
    LOOKUP.set(category, idx);
  }
  return idx;
}

/** Résout une entrée (catégorie + id) → sa fiche, pour les liens `CodexRef` qui connaissent déjà
 *  l'identité STABLE de leur cible (résolution PRIMAIRE — cf. `codexLookup` pour le repli par libellé). */
export function codexLookupById(category: string, id: string): CodexItem | undefined {
  if (!id) return undefined;
  return categoryIndex(category)?.byId.get(id);
}

/** Résout une entrée (catégorie + libellé) → sa fiche, pour les liens `CodexRef` — REPLI de compat/
 *  affichage (l'auto-liage matche du texte). Exact d'abord, puis casse ignorée (les libellés à
 *  spécialisation s'écrivent parfois autrement). */
export function codexLookup(category: string, label: string): CodexItem | undefined {
  // Robustesse : un libellé absent (entité sans nom — arme/compétence malformée) ou une entrée sans
  // label NE DOIT PAS crasher tout le rendu. Pas de fiche trouvée → le CodexRef se replie en texte.
  if (!label) return undefined;
  const idx = categoryIndex(category);
  if (!idx) return undefined;
  return idx.exact.get(label) ?? idx.folded.get(label.toLowerCase());
}

const ARMOUR_LOCS: HitLocation[] = ['tete', 'corps', 'brasG', 'brasD', 'jambeG', 'jambeD'];

/** Statbloc d'un combattant VIVANT (valeurs réelles : carac, armes/armure dérivées, états déjà à
 *  part) en sections — MÊME rendu que la fiche Codex (CodexEntry/CodexSections). Sert l'inspection
 *  d'un ennemi en combat sans recopier un panneau partiel. TOUTES les caracs (« – » si inexistante). */
export function combatantSections(c: Combatant): CodexSection[] {
  const ch = c.characteristics;
  const charRows: CodexRow[] = [
    { t: 'kv', k: 'M', v: String(c.movement), kref: { category: 'characteristics', id: 'mouvement', label: 'Mouvement' } },
    ...CHAR_KEYS.map((k) => ({ t: 'kv', k: CHAR_ABR[k], v: ch[k] > 0 || c.kind === 'hero' ? String(effectiveChar(c, k)) : '–', kref: { category: 'characteristics', id: k, label: CHAR_LABELS[k] } } as CodexRow)),
    { t: 'kv', k: 'Taille', v: SIZE_LABEL[effectiveSize(c.size)] }, // Taille : pas une caractéristique → pas de lien Codex
  ];
  const skillRows: CodexRow[] = (c.skills ?? []).map((s) =>
    refRow('skills', `${skillInstanceLabel(s)} ${skillBaseValue(c, s.skillId, s.spec)}`),
  );
  // Comme les compétences/talents/sorts : chaque arme est une ENTITÉ (CodexRef vers sa fiche Codex
  // « trappings » — popover au survol + clic — repli gracieux en texte pour une arme naturelle hors
  // catalogue type « Morsure »), avec les Dégâts en BADGE (damageString, jamais l'objet brut).
  const weaponRows: CodexRow[] = (c.weapons ?? []).map((w) => ({ t: 'ref', category: 'trappings', id: refId('trappings', w.label), label: w.label, show: w.label, badge: damageString(w.damage) }));
  const worn = ARMOUR_LOCS.filter((l) => (c.armour?.[l] ?? 0) > 0);
  return sections(
    { title: 'Caractéristiques', layout: 'grid', rows: charRows },
    weaponRows.length ? { title: 'Armes', layout: 'chips', rows: weaponRows } : null,
    worn.length ? { title: 'Armure', layout: 'list', rows: [{ t: 'text', text: worn.map((l) => `${HIT_LOCATION_LABELS[l]} ${c.armour![l]}`).join(' · ') }] } : null,
    chips('Traits', 'traits', traitLabels(c.traits)),
    skillRows.length ? { title: 'Compétences', layout: 'chips', rows: skillRows } : null,
    chips('Talents', 'talents', (c.talents ?? []).map((t) => talentConcrete(t))),
    chips('Sorts', 'spells', (c.spells ?? []).map((id) => refLabel('spells', { id }))),
  );
}
