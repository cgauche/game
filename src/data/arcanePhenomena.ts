/**
 * Magie ENVIRONNEMENTALE (`arcane-phenomena.json`, `VDM 14` folios 189-204) — TYPES + chargement +
 * lookups. Même patron que `effectTables.ts` : ce module ne porte AUCUNE mécanique (elle vit dans
 * `src/engine/magicEnvironment.ts`) ; régler un phénomène = éditer le JSON, jamais ce fichier.
 */
import arcaneJson from './arcane-phenomena.json';

/** Tests qu'un phénomène peut modifier — surensemble de `WindTest` (`engine/domainAttributes.ts`). */
export type PhenomenonTest = 'incantation' | 'focalisation' | 'dissipation';

/** À QUELS Sorts s'applique un modificateur. Plusieurs clés = OU (le RAW énumère « la Sorcellerie,
 *  la Magie noire ou le Chaos »). Absente = tous les Domaines. */
export interface PhenomenonScope {
  domains?: string[];
  domainsExcept?: string[];
  chaosMagic?: boolean;
  dominantWinds?: boolean;
  nonDominantWinds?: boolean;
}

export interface PhenomenonTestMod {
  tests: PhenomenonTest[];
  /** Delta de DR — borne BASSE quand le RAW ne donne qu'une fourchette (`drMax`). */
  dr: number;
  drMax?: number;
  /** Loi du tirage par Round (`1d10/2`) : le SITE tire et pose la valeur dans `ArcaneOccurrence.dr`. */
  drDie?: { faces: number; divide: number; perRound?: boolean };
  scope?: PhenomenonScope;
  /** Restreint le modificateur aux Vents déclarés par le site (`VDM 14` l.161). */
  windRestricted?: boolean;
  maison?: string;
  source: { book: string; page: number };
  desc: string;
}

export interface SaturationEffect {
  levelsPerYear?: number;
  levelsPerMonth?: number;
  levels?: number;
  viaGrandVortex?: boolean;
  blocksPropagation?: boolean;
  preventsJonctionSaturee?: boolean;
  whenOffLine?: boolean;
  source: { book: string; page: number };
  desc: string;
}

export interface SaturationLevel {
  id: string;
  label: string;
  order: number;
  effectsMin: number;
  effectsMax: number;
  corrupts?: boolean;
  testMods?: PhenomenonTestMod[];
  source: { book: string; page: number };
  desc: string;
}

export interface WindSaturationEffects {
  id: string;
  domainId: string;
  wind: string;
  environments: string[];
  effects: { label: string; tier: 'premier' | 'courant' | 'extreme' }[];
  surnoms: string[];
  source: { book: string; page: number };
}

export interface ArcanePhenomenon {
  id: string;
  label: string;
  /** `site` = lieu NOMMÉ du chapitre dont le RAW chiffre l'effet magique (folios 200-207). */
  kind: 'ligne-de-force' | 'pierre-gardienne' | 'vortex' | 'nexus' | 'appui-arcanique' | 'tempete' | 'corruption' | 'site';
  testMods?: PhenomenonTestMod[];
  saturation?: SaturationEffect;
  influenceMalveillante?: boolean;
  critOnTens?: boolean;
  daemonsDoubled?: boolean;
  singleWind?: boolean;
  cancelsTraitId?: string;
  refractedWindsOnly?: { source: { book: string; page: number }; desc: string };
  stonePropertySlots?: { max: number; source: { book: string; page: number }; desc: string };
  fluxTableId?: string;
  controlFlux?: { difficulty: string; source: { book: string; page: number }; desc: string };
  overcastPerSpell?: { dice: string; source: { book: string; page: number }; desc: string };
  tableId?: string;
  draws?: number;
  source: { book: string; page: number };
  desc: string;
}

/** Rangée d'une table du chapitre — fourchette `[min,max]` (lookup `findTableEntry`). */
export interface ArcaneTableRow {
  min: number;
  max: number;
  label: string;
  /** Flux magique : Domaine(s) désigné(s) par la rangée. */
  domainIds?: string[];
  /** Flux magique : la rangée désigne AUSSI la Magie du Chaos (sans Domaine dédié). */
  chaosMagic?: boolean;
  /** Rangée RECONSTRUITE (cellule vide à l'impression) : dit ce qui est LU et ce qui est DÉDUIT. */
  maison?: string;
}

export interface ArcaneTable {
  id: string;
  label: string;
  die: 'd10' | 'd100';
  rows: ArcaneTableRow[];
  source: { book: string; page: number };
  desc: string;
}

interface ArcaneData {
  saturationLevels: SaturationLevel[];
  windSaturationEffects: WindSaturationEffects[];
  phenomena: ArcanePhenomenon[];
  tables: ArcaneTable[];
}

const DATA = arcaneJson as unknown as ArcaneData;

/** Les cinq paliers de Saturation environnementale, du plus faible au plus fort (`order`). */
export const saturationLevels: SaturationLevel[] = [...DATA.saturationLevels].sort((a, b) => a.order - b.order);
/** La rangée d'Effets de Saturation de chaque Vent. */
export const windSaturationEffects: WindSaturationEffects[] = DATA.windSaturationEffects;
/** Tous les phénomènes arcaniques du chapitre. */
export const arcanePhenomena: ArcanePhenomenon[] = DATA.phenomena;
/** Les tables du chapitre (Corruption chaotique/nécromantique, Flux magique). */
export const arcaneTables: ArcaneTable[] = DATA.tables;

const LEVEL_BY_ID = new Map(DATA.saturationLevels.map((l) => [l.id, l]));
const PHENOMENON_BY_ID = new Map(DATA.phenomena.map((p) => [p.id, p]));
const TABLE_BY_ID = new Map(DATA.tables.map((t) => [t.id, t]));
const WIND_BY_DOMAIN = new Map(DATA.windSaturationEffects.map((w) => [w.domainId, w]));

/** Palier de Saturation par `id` STABLE — `undefined` si la zone n'en déclare aucun. */
export function findSaturationLevelById(id: string | null | undefined): SaturationLevel | undefined {
  return id ? LEVEL_BY_ID.get(id) : undefined;
}

/** Phénomène par `id` STABLE — `undefined` si l'id n'est pas au registre. */
export function findArcanePhenomenonById(id: string | null | undefined): ArcanePhenomenon | undefined {
  return id ? PHENOMENON_BY_ID.get(id) : undefined;
}

/** Table du chapitre par `id` STABLE — FAIL-FAST (id inconnu = bug de données/authoring). */
export function findArcaneTableById(id: string): ArcaneTable {
  const t = TABLE_BY_ID.get(id);
  if (!t) throw new Error(`findArcaneTableById : table « ${id} » introuvable (arcane-phenomena.json)`);
  return t;
}

/** Effets de Saturation du Vent d'un Domaine — `undefined` pour un Domaine sans Vent (Sorcellerie…). */
export function findWindSaturationEffects(domainId: string | null | undefined): WindSaturationEffects | undefined {
  return domainId ? WIND_BY_DOMAIN.get(domainId) : undefined;
}
