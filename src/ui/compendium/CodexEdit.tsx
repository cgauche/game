/**
 * Édition DEV d'une entrée du Compendium — édite la VRAIE donnée (`src/data/*.json`, app-owned).
 * Réutilise le navigateur du Compendium (cet éditeur ne vit QUE dans le panneau détail) + le motif
 * `<datalist>` d'autocomplétion (cf. SpellsField) pour les champs-références (traits/talents/sorts…
 * piochés dans leurs vrais datasets, param libre « 8 Tentacules +8 » conservé). Sauvegarde via File
 * System Access (`fsPersist`) + preview mémoire (`setDataset`).
 */
import { useEffect, useMemo, useState } from 'react';
import { datasetArray, setDataset, datasetObject, setObjectDataset, datasetFile, datasetSerializeRoot, datasetObjectFile, type DatasetKey, type ObjectDatasetKey } from '../../data/overrides';
import type { ShipCrewTest } from '../../data/shipCriticals';
import { serializeDataset } from '../../data/serialize';
import { validateDataset } from '../../data/schemas/validate';
import * as fs from '../../data/fsPersist';
import { inferFields, type FieldDesc } from './editFields';
import { entryKey, invalidateCodexLookup, ACTIVITY_CONTEXT_LABEL, OUTCOME_ON_LABEL, BATTLE_COND_LABEL, BATTLE_TARGET_LABEL, BATTLE_SCALE_LABEL, BATTLE_SIDE_LABEL } from './registry';
import type { ActivityContext, OutcomeBand, BattleOutcome, BattleSide, BattleOutcomeTarget, BattleOutcomeScale, BattleCond } from '../../engine/activities';
import { WEATHER_LABEL } from '../../engine/travelStages';
import { RefField, refFieldCfg } from './RefField';
import { Icon } from '../Icon';
import { MonsterPartsFields } from '../editor/MonsterPartsFields';
import { FlowEditor } from '../editor/FlowEditor';
import { GameOpEditor, FormulaField } from '../editor/GameOpEditor';
import type { GameOp } from '../../engine/ops';
import type { ConsumableDuration } from '../../engine/consumables';
import { JsonField } from '../editor/JsonField';
import { creatureSpeciesOptions } from '../../gameIso/rig/creatures';
import { CreaturePreview } from './CreaturePreview';
import type { EntityAppearance } from '../../engine/authoringAppearance';
import { type Flow, EMPTY_FLOW, type TriggeredEffect, type EffectTrigger } from '../../state/flow';
import { TRIGGER_LABEL, ON_LABEL } from './triggerLabels';
import { MANEUVER_ACTIVATION_LABEL, MANEUVER_TARGETING_LABEL } from './maneuverLabels';
import type { ManeuverDef, ManeuverMeasure } from '../../data';
import { ATTACK_LABEL, type AttackKind } from '../../engine/creatureAttacks';
import { WeaponField } from '../editor/WeaponField';
import { PsychTraitsField } from '../editor/PsychTraitsField';
import type { Weapon } from '../../engine/types';
import type { PsychTrait } from '../../engine/psychology';
import { SymptomsField, SymptomTickField, TalentTestField, CombatField, AdvancementRefField, TrappingRefField, CharKeysField, StarSubField, DomainEffectsField, TraitListField, OptionalsListField, HarvestField, SpecsField } from './StructFields';
import type { TraitInstance, OptionalEntry } from '../../engine/statEntry';
import type { DomainData } from '../../data';
import type { CharKey, Difficulty } from '../../engine/types';
import { CHAR_KEYS, CHAR_LABELS, DIFFICULTY_LABELS } from '../../engine/types';
import type { DiseaseSymptom } from '../../engine/disease';
import type { CombatFeature } from '../../engine/combatFeatures/types';
import type { AdvancementRef, TrappingRef, TalentTest, SpecEntry, WaterExposureData, WaterExposureModifier } from '../../data';
import { SPEC_SOURCES, type SpecsSource } from '../../data';

/** Catégorie Codex → dataset éditable (source app-owned `src/data/*.json`). */
const CATEGORY_DATASET: Record<string, DatasetKey> = {
  races: 'species', careers: 'careers', characteristics: 'characteristics', classes: 'classes',
  stars: 'stars', skills: 'skills', talents: 'talents', trappings: 'trappings', weaponGroups: 'weaponGroups', qualities: 'qualities',
  etats: 'etats', maladies: 'maladies', spells: 'spells', maneuvers: 'maneuvers', creatures: 'creatures', traits: 'traits', locations: 'locations', books: 'books',
  mutations: 'mutations', mutationTables: 'mutationTables', gods: 'gods', domains: 'domains',
  // E3a : tables & gabarits éditables (catégorie Codex = clé identique au dataset).
  careerLevels: 'careerLevels', eyes: 'eyes', hairs: 'hairs', raceAppearance: 'raceAppearance',
  pregens: 'pregens', oups: 'oups', interludeEvents: 'interludeEvents', peripeties: 'peripeties',
  // Calendrier impérial — tables de contenu éditables (cf. engine/clock.ts pour la mécanique).
  calendarMonths: 'calendarMonths', calendarIntercalary: 'calendarIntercalary',
  calendarWeekdays: 'calendarWeekdays', calendarPhases: 'calendarPhases', weather: 'weather',
  symptoms: 'symptoms',
  // Combat de masse (ADE II ch.8, #148) — 5 tableaux NICHÉS dans UN fichier (`mass-battle.json`) :
  // `datasetFile`/`datasetSerializeRoot` (overrides.ts) réécrivent le fichier PARENT entier au save,
  // pas juste le tableau touché (sinon les 4 autres sections seraient perdues).
  massBattleWarMachines: 'massBattleWarMachines', massBattleStructures: 'massBattleStructures',
  massBattleHazards: 'massBattleHazards', massBattleMightModifiers: 'massBattleMightModifiers',
  massBattlePowerEstimate: 'massBattlePowerEstimate',
  // #168 : catalogue UNIQUE des Activités (interlude/voyage/mer/bataille de masse) — fichier
  // `activities.json` (défaut), racine sérialisée = le tableau ; schéma `activities` déjà registré (#176).
  activities: 'activities',
  // #157 : catalogues de CONTENU app-owned exposés au Codex — clé catégorie = clé dataset.
  structures: 'structures', vehicles: 'vehicles', celestialHouses: 'celestialHouses', groups: 'groups',
  psychologies: 'psychologies', seaShanties: 'seaShanties', crewRoles: 'crewRoles', crewTestTypes: 'crewTestTypes',
  navalTraits: 'navalTraits', montures: 'montures', incidentsMonture: 'incidentsMonture', problemesVehicule: 'problemesVehicule',
  tavernGames: 'tavernGames', obsessions: 'obsessions', structureCriticals: 'structureCriticals', traumas: 'traumas',
  landCargo: 'landCargo', seaCargo: 'seaCargo', riverPerils: 'riverPerils',
  crewMoraleFactors: 'crewMoraleFactors', crewMoraleBands: 'crewMoraleBands', steamBreakdowns: 'steamBreakdowns',
  criticalsTete: 'criticalsTete', criticalsBras: 'criticalsBras', criticalsCorps: 'criticalsCorps', criticalsJambe: 'criticalsJambe',
  aaCriticalsTete: 'aaCriticalsTete', aaCriticalsBras: 'aaCriticalsBras', aaCriticalsCorps: 'aaCriticalsCorps', aaCriticalsJambe: 'aaCriticalsJambe',
  // #157 (suite) : Critiques de coque (MDG ch.13 navire / T2C ch.5 fluvial), Rencontres de voyage
  // (EDOC ch.5) et Longs voyages en mer (MDG ch.15) — mêmes patrons (nichés) que ci-dessus.
  shipCriticalsCargaison: 'shipCriticalsCargaison', shipCriticalsGreement: 'shipCriticalsGreement',
  shipCriticalsCoque: 'shipCriticalsCoque', shipCriticalsAvirons: 'shipCriticalsAvirons', shipCriticalsEquipements: 'shipCriticalsEquipements',
  riverCriticalsGreement: 'riverCriticalsGreement', riverCriticalsAvirons: 'riverCriticalsAvirons',
  riverCriticalsGouvernail: 'riverCriticalsGouvernail', riverCriticalsCoque: 'riverCriticalsCoque', riverCriticalsSuperstructure: 'riverCriticalsSuperstructure',
  rencontresPositives: 'rencontresPositives', rencontresFortuites: 'rencontresFortuites', rencontresDangereuses: 'rencontresDangereuses',
  seaManannFactors: 'seaManannFactors', seaBoardEvents: 'seaBoardEvents', seaPortEvents: 'seaPortEvents',
};
/** Catégorie Codex → dataset-OBJET éditable (E3b) : pas un tableau d'entités mais UN objet de config
 *  unique (`details`) ou un Record keyé par entrée (`names`, une entrée par race). Le `mode` dit comment
 *  l'éditeur projette l'objet : `single` = édite l'objet entier ; `record` = une entrée par clé (l'item
 *  Codex porte la clé en `label`). */
const OBJECT_CATEGORY: Record<string, { ds: ObjectDatasetKey; mode: 'single' | 'record' }> = {
  details: { ds: 'details', mode: 'single' },
  names: { ds: 'names', mode: 'record' },
  // Exposition à l'eau (T2C ch.14, #157 suite) : UNE seule fiche de règle (fichier `water-exposure.json`,
  // clé JS `waterExposure` — `datasetObjectFile` gère la divergence de nom).
  waterExposure: { ds: 'waterExposure', mode: 'single' },
};
export const editableObjectDataset = (categoryKey: string): { ds: ObjectDatasetKey; mode: 'single' | 'record' } | undefined => OBJECT_CATEGORY[categoryKey];
/** Une catégorie est éditable au Codex ssi elle a un dataset tableau OU un dataset-objet. */
export const editableDataset = (categoryKey: string): DatasetKey | undefined => CATEGORY_DATASET[categoryKey];
export const isEditableCategory = (categoryKey: string): boolean => !!CATEGORY_DATASET[categoryKey] || !!OBJECT_CATEGORY[categoryKey];

/** Champ-réf → son dataset. Double usage : autocomplétion `<datalist>` des champs-listes ET
 *  validation des refs (`validateEntry` : chaque `{id}` du champ doit résoudre dans ce dataset). */
const REF_LIST_DATASET: Record<string, DatasetKey> = {
  traits: 'traits', optionals: 'traits', skills: 'skills', talents: 'talents',
  spells: 'spells', trappings: 'trappings', blessings: 'spells', miracles: 'spells', chaosSpells: 'spells',
  traumas: 'traumas',
};

/** Catégories/CHAMPS portant un `GameOp[]` NOMMÉ autre que `passive` (#157) — MÊME éditeur
 *  (`GameOpEditor`), juste un champ différent : `ops` (effet immédiat d'un Critique/Traumatisme),
 *  `occupantOps` (subi par un tiers — cavalier/passager), `crewOps`/`captainOps` (Chant de marin).
 *  Généralise l'idée d'`isPassive` (qui ne couvre QUE `passive`) sans dupliquer l'éditeur : ajouter une
 *  source = ajouter SA/SES clé(s) ici (lu par `dedicatedFieldKeys` ET le rendu). */
/** Les 10 catégories de Critiques de coque (MDG ch.13 navire + T2C ch.5 fluvial, #157 suite) —
 *  MÊME forme `ShipCritEntry` (`ops` + `crewTest` structuré), partagée par `OPS_FIELDS` et le rendu. */
const SHIP_CRIT_CATEGORIES = [
  'shipCriticalsCargaison', 'shipCriticalsGreement', 'shipCriticalsCoque', 'shipCriticalsAvirons', 'shipCriticalsEquipements',
  'riverCriticalsGreement', 'riverCriticalsAvirons', 'riverCriticalsGouvernail', 'riverCriticalsCoque', 'riverCriticalsSuperstructure',
];

/** Les 8 catégories de Critiques localisés (LDB ch.6 + AA, #173) partageant `traumas: string[]` — DES
 *  IDS de fiches de traumatisme (`traumas.json`), résolus PAR ID (`traumaFicheById`/`traumaById`,
 *  `engine/critical.ts:120`/`engine/aaCritical.ts`). Éditeur dédié (`TraumaListField`, sélecteurs
 *  id→label) plutôt que le datalist générique : les fiches partagent des labels NON uniques (deux
 *  fiches « Fracture » à sévérité différente) — un datalist par label ne pourrait même pas les distinguer. */
const CRITICAL_CATEGORIES = [
  'criticalsTete', 'criticalsBras', 'criticalsCorps', 'criticalsJambe',
  'aaCriticalsTete', 'aaCriticalsBras', 'aaCriticalsCorps', 'aaCriticalsJambe',
];

const OPS_FIELDS: Record<string, string[]> = {
  traumas: ['ops'],
  activities: ['onSuccess'], // #168 : effet mécanique de réussite (GameOp[]) → GameOpEditor commun

  criticalsTete: ['ops'], criticalsBras: ['ops'], criticalsCorps: ['ops'], criticalsJambe: ['ops'],
  aaCriticalsTete: ['ops'], aaCriticalsBras: ['ops'], aaCriticalsCorps: ['ops'], aaCriticalsJambe: ['ops'],
  incidentsMonture: ['occupantOps'], problemesVehicule: ['occupantOps'],
  seaShanties: ['crewOps', 'captainOps'],
  ...Object.fromEntries(SHIP_CRIT_CATEGORIES.map((k) => [k, ['ops']])),
};
const opsFieldsOf = (categoryKey: string): string[] => OPS_FIELDS[categoryKey] ?? [];

type Entry = Record<string, unknown>;

/** ids d'un champ-liste de refs — descend dans les branches `choice` des `AdvancementRef` et les
 *  enveloppes `{ref:{id}}` ; ignore les `{text}` narratifs et jokers. Une CHAÎNE BRUTE (ex.
 *  `criticalsTete.traumas: string[]`) est traitée comme un id DIRECT (#173 : ces listes référencent
 *  leur dataset par id, jamais par libellé — cf. `STRING_LIST_LABEL_EXCEPTIONS` pour l'unique
 *  contre-exemple documenté). */
function refIdsIn(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  const out: string[] = [];
  for (const x of v) {
    if (typeof x === 'string') { out.push(x); continue; }
    if (!x || typeof x !== 'object') continue;
    const o = x as { choice?: unknown; ref?: { id?: unknown }; id?: unknown };
    if (o.choice) out.push(...refIdsIn(o.choice));
    else if (o.ref && typeof o.ref.id === 'string') out.push(o.ref.id);
    else if (typeof o.id === 'string') out.push(o.id);
  }
  return out;
}

/** (categorie.champ) où un champ-liste de CHAÎNES de `REF_LIST_DATASET` porte légitimement des
 *  LIBELLÉS et non des ids — SEULE exception connue : `pregens.spells` (libellés d'AUTHORING résolus
 *  en id AU CHARGEMENT par `findSpell(l)`, `src/data/pregens.ts:60` ; jamais relu par id depuis le
 *  JSON). Toute autre liste de chaînes d'un champ-réf DOIT contenir des ids qui résolvent (#173 :
 *  un éditeur par datalist-de-labels y écrivait un libellé, cassant `traumaFicheById` au runtime —
 *  cf. `criticalsTete.traumas`). */
const STRING_LIST_LABEL_EXCEPTIONS = new Set(['pregens.spells']);

/** Champs-réf NICHÉS (une valeur ou une liste, sous un sous-objet/sous-tableau — hors de portée de
 *  `REF_LIST_DATASET`, qui ne regarde QUE les champs top-level de `entry`) : même garantie de
 *  résolvabilité, décrite par un accesseur PUR `entry → (id|undefined)[]`. #173 : `mutationTables.
 *  ranges[].mutation` et `domains.castBonus.perCondition` en sont les 2 sites CONFIRMÉS (un éditeur par
 *  datalist-de-labels y écrivait un libellé, cassant `mutations.ts::rollMutation`/`state/combatFlow.ts::
 *  domainCastBonus` au runtime) — ajouter une réf nichée = ajouter SON accesseur ici. `weather.json`
 *  partage la forme `ranges[]` mais sa clé est `.weather` (union fermée, pas une réf de dataset) :
 *  l'accesseur `mutation` y est simplement `undefined`, filtré plus bas — aucun faux positif. */
const NESTED_REF_FIELDS: { key: string; ds: DatasetKey; get: (entry: Entry) => (string | undefined)[] }[] = [
  { key: 'ranges[].mutation', ds: 'mutations', get: (e) => ((e.ranges as { mutation?: string }[] | undefined) ?? []).map((r) => r.mutation) },
  { key: 'castBonus.perCondition', ds: 'etats', get: (e) => [(e.castBonus as { perCondition?: string } | undefined)?.perCondition] },
];

/** Valide une entrée AVANT persist (bouton Enregistrer bloqué tant que non vide) : identité
 *  (id non vide + unique, libellé non vide) + refs (`{id}` ou chaîne directe) résolvables dans leur
 *  dataset. PUR. `selfIndex` = position de l'entrée éditée dans `entries` (−1 pour une création). */
export function validateEntry(categoryKey: string, entry: Entry, entries: Entry[], selfIndex: number): string[] {
  const errors: string[] = [];
  // id : requis + unique là où le dataset est id-based (toutes les entités migrées par-id).
  if (entries.some((e) => typeof e.id === 'string')) {
    const id = typeof entry.id === 'string' ? entry.id.trim() : '';
    if (!id) errors.push('id vide — identifiant stable requis');
    else if (entries.some((e, i) => i !== selfIndex && e.id === id)) errors.push(`id « ${id} » déjà pris par une autre entrée`);
  }
  // Libellé : la clé d'identité générique (label/name/key/id) ne peut pas être vide — c'est elle
  // que le navigateur du Codex et l'éditeur utilisent pour retrouver l'entrée.
  if (!entryKey(entry).trim()) errors.push('libellé vide');
  // Refs résolvables : chaque `{id}` (ou chaîne directe) d'un champ-réf doit exister dans son dataset —
  // détecté par nom de champ (table unique), sauf la contre-exception déclarée ci-dessus.
  for (const [field, ds] of Object.entries(REF_LIST_DATASET)) {
    if (!(field in entry)) continue;
    if (STRING_LIST_LABEL_EXCEPTIONS.has(`${categoryKey}.${field}`)) continue;
    const known = new Set((datasetArray(ds) as { id?: string }[]).map((e) => e.id).filter(Boolean));
    for (const id of refIdsIn(entry[field])) if (!known.has(id)) errors.push(`${field} : réf « ${id} » introuvable (${ds})`);
  }
  // Refs NICHÉES (#173) : même garantie, pour les champs-réf sous un sous-objet/sous-tableau.
  for (const { key, ds, get } of NESTED_REF_FIELDS) {
    const known = new Set((datasetArray(ds) as { id?: string }[]).map((e) => e.id).filter(Boolean));
    for (const id of get(entry)) if (id != null && !known.has(id)) errors.push(`${key} : réf « ${id} » introuvable (${ds})`);
  }
  return errors;
}

/** Axes du PROFIL de manœuvre rendus par `ManeuverDefField` (selects/checkbox). */
const MANEUVER_PROFILE_KEYS = ['kind', 'activation', 'advantageCost', 'advantageMode', 'stat', 'defense', 'targeting', 'range', 'blast', 'magic'];

/**
 * Clés de champ COUVERTES par un éditeur dédié (sorties du formulaire générique inféré), PAR catégorie.
 * SOURCE UNIQUE : utilisée par le filtre de `CodexEdit` ET par le garde-fou `no-json-fields.test` (qui
 * vérifie qu'aucun champ d'aucun dataset éditable ne retombe en `kind:'json'`). Ajouter un éditeur dédié
 * = ajouter sa/ses clé(s) ici (et le composant dans le rendu). */
export function dedicatedFieldKeys(categoryKey: string): Set<string> {
  const k = new Set<string>();
  const add = (...keys: string[]) => keys.forEach((x) => k.add(x));
  if (['creatures', 'traits', 'mutations'].includes(categoryKey)) add('appearance');
  if (['spells', 'traits', 'qualities', 'domains', 'talents', 'maneuvers', 'etats', 'psychologies'].includes(categoryKey)) add('effects');
  if (categoryKey === 'maneuvers') add(...MANEUVER_PROFILE_KEYS);
  if (['traits', 'qualities', 'mutations', 'talents', 'etats', 'trappings', 'psychologies', 'navalTraits'].includes(categoryKey)) add('passive');
  if (categoryKey === 'structures') add('traits'); // {id,value?}[] → réutilise TraitListField (comme creatures)
  if (categoryKey === 'crewRoles') add('skills'); // {skillId,spec?}[] → éditeur dédié (SkillSpecListField)
  if (categoryKey === 'traumas') add('prosthesis'); // {trappingId,cancels}[] → éditeur dédié (ProsthesisField)
  if (CRITICAL_CATEGORIES.includes(categoryKey)) add('traumas'); // string[] d'ids → éditeur dédié (TraumaListField, #173)
  if (categoryKey === 'steamBreakdowns') add('restart'); // {skillId,spec?,difficulty,extendedDR?}[] → éditeur dédié
  add(...opsFieldsOf(categoryKey)); // ops/occupantOps/crewOps/captainOps → GameOpEditor (#157)
  if (categoryKey === 'symptoms') add('passive', 'severePassive', 'onTick'); // GameOp[] + test de cycle → éditeurs dédiés (capabilities = sous-form générique)
  if (categoryKey === 'stars') add('effect', 'sub');
  if (categoryKey === 'mutationTables' || categoryKey === 'weather') add('ranges');
  if (categoryKey === 'mutations') add('psychTraits');
  if (['mutations', 'trappings'].includes(categoryKey)) add('derivedWeapon');
  if (categoryKey === 'trappings') add('consumable', 'consumableDuration', 'onHitEffects'); // onHitEffects → TriggeredEffectsField (#175)
  if (categoryKey === 'maladies') add('symptoms');
  if (categoryKey === 'talents') add('combat', 'test');
  if (categoryKey === 'skills' || categoryKey === 'talents') add('specs');
  if (categoryKey === 'traits') add('specsSource', 'indice', 'range', 'specsOpen', 'specsMulti'); // schéma d'argument → éditeur dédié

  if (categoryKey === 'races' || categoryKey === 'careerLevels') add('skills', 'talents');
  if (categoryKey === 'classes' || categoryKey === 'careerLevels') add('trappings');
  if (categoryKey === 'careerLevels') add('characteristics');
  if (categoryKey === 'domains') add('castBonus', 'missile', 'casterOps');
  if (categoryKey === 'creatures') add('traits', 'optionals', 'harvest');
  if (categoryKey === 'details') add('texts');
  if (SHIP_CRIT_CATEGORIES.includes(categoryKey)) add('crewTest'); // {skillId?,difficulty?,crewTarget?,onFail}
  if (categoryKey === 'waterExposure') add('test', 'modifiers', 'diseases'); // #157 suite (T2C ch.14)
  // #168 : Activité — Test « posté » (contexts/skills « au choix »/char/difficulty) + table d'issues
  // `outcomes` (OutcomeBand[]) → éditeurs dédiés ; `onSuccess` couvert par opsFieldsOf ci-dessus.
  if (categoryKey === 'activities') add('contexts', 'skills', 'char', 'difficulty', 'outcomes');
  return k;
}

/** Échantillons pour `inferFields` d'une catégorie éditable (tableau d'entités, objet unique, ou
 *  valeurs d'un Record keyé). SOURCE UNIQUE des champs inférés — utilisée par `CodexEdit` ET le
 *  garde-fou no-json-fields.test (pas de duplication de la logique de projection). */
export function editableEntries(categoryKey: string): Entry[] {
  const obj = editableObjectDataset(categoryKey);
  if (obj) {
    const data = datasetObject(obj.ds) as Record<string, unknown>;
    if (obj.mode === 'single') return [data as Entry];
    const entries = Object.values(data) as Entry[];
    return entries.length ? entries : [{}];
  }
  return datasetArray(editableDataset(categoryKey)!) as Entry[];
}

export function CodexEdit({ categoryKey, label, onClose, isNew }: { categoryKey: string; label: string; onClose: () => void; isNew?: boolean }) {
  // SOURCE de données UNIFIÉE (tableau d'entités OU dataset-objet) → la même UI de formulaire édite les
  // trois formes : tableau (une entité par item Codex), objet unique (`details`), Record keyé (`names`,
  // une entrée par race). `entries` = échantillons pour `inferFields` ; `initial` = l'objet édité ;
  // `file`/`persist` = écriture disque (preview live in-place + `serializeDataset` byte-fidèle).
  const obj = editableObjectDataset(categoryKey);
  // `recordMode` : dataset-objet Record (`names`) — l'entrée est keyée par une CLÉ (la race) éditable
  // (création/renommage). `persist(entry, key)` écrit sous `key` (et purge l'ancienne si renommée).
  const src = useMemo<{ entries: Entry[]; initial: Entry; index: number; file: string; recordMode: boolean; initialKey: string; persist: (entry: Entry, key: string) => void }>(() => {
    const entries = editableEntries(categoryKey);
    if (obj) {
      const data = datasetObject(obj.ds) as Record<string, unknown>;
      const file = datasetObjectFile(obj.ds);
      if (obj.mode === 'single')
        return { entries, initial: data as Entry, index: -1, file, recordMode: false, initialKey: '', persist: (e) => setObjectDataset(obj.ds, e as never) };
      // record : une entrée par clé (le `label` du navigateur = la clé, ex. la race) ; inférence sur
      // TOUTES les valeurs (mêmes champs partout). `isNew` → clé vide à saisir dans le champ « Clé ».
      const initialKey = isNew ? '' : label;
      const initial = (data[initialKey] as Entry) ?? {};
      return {
        entries, initial, index: -1, file, recordMode: true, initialKey,
        persist: (e, key) => {
          const next = { ...data } as Record<string, unknown>;
          if (initialKey && initialKey !== key) delete next[initialKey]; // renommage : retire l'ancienne clé
          if (key) next[key] = e;
          setObjectDataset(obj.ds, next as never);
        },
      };
    }
    const dsKey = editableDataset(categoryKey)!;
    const arr = entries;
    // `isNew` : entrée VIERGE (le save APPEND) ; sinon identité GÉNÉRIQUE via `entryKey` (label/name/key/
    // id, composite careerLevels) — MÊME clé que le navigateur passe en `label`.
    const index = isNew ? -1 : arr.findIndex((e) => entryKey(e) === label);
    return {
      entries: arr,
      initial: arr[index] ?? {},
      index,
      file: datasetFile(dsKey), recordMode: false, initialKey: '',
      persist: (e) => setDataset(dsKey, (index < 0 ? [...arr, e] : arr.map((x, i) => (i === index ? e : x))) as never),
    };
  }, [obj, categoryKey, label, isNew]);

  const [entry, setEntry] = useState<Entry>(() => structuredClone(src.initial));
  const [recordKey, setRecordKey] = useState(src.initialKey);
  const [dir, setDir] = useState<FileSystemDirectoryHandle | null>(null);
  const [needsGrant, setNeedsGrant] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [msg, setMsg] = useState('');
  // Refus de SCHÉMA (contrat de donnée #176) : message champ-par-champ (formatZodError) quand la donnée
  // sérialisée ne parse pas son schéma zod — l'écriture disque est bloquée. Effacé à toute ré-édition.
  const [schemaError, setSchemaError] = useState<string | null>(null);

  useEffect(() => { fs.restoreDataDir().then((r) => { if (r) { setDir(r.handle); setNeedsGrant(!r.granted); } }); }, []);
  useEffect(() => { setEntry(structuredClone(src.initial)); setRecordKey(src.initialKey); setDirty(false); setMsg(''); setSchemaError(null); }, [src]);

  // L'apparence (MonsterPartsFields) ET les EFFETS d'un sort (FlowEditor) ont leur éditeur dédié — on les
  // sort du formulaire générique (sinon rendus en JSON brut). Les autres champs gardent le formulaire
  // inféré. Même patron : on filtre le champ et on rend l'éditeur spécialisé. L'apparence est éditable sur
  // les créatures ET les difformités déclarées en donnée (traits / mutations → fragment `appearance`).
  const hasAppearance = categoryKey === 'creatures' || categoryKey === 'traits' || categoryKey === 'mutations';
  const isSpell = categoryKey === 'spells';
  // Porteurs d'effets DÉCLENCHÉS (mêmes `TriggeredEffect` éditables) : Traits, Atouts d'arme, Domaines
  // (riders « à la touche »…) ET Talents (Assaut féroce onHit, Frappe réactive onCharged…).
  // États psychologiques (`psychologies`, LDB 21, #157) ÉTENDENT le même `StatusData` que les États
  // (`passive`/`effects` mutualisés) — même patron de rendu.
  const isTriggered = categoryKey === 'traits' || categoryKey === 'qualities' || categoryKey === 'domains' || categoryKey === 'talents' || categoryKey === 'etats' || categoryKey === 'psychologies';
  // Manœuvre = ENTITÉ de 1ʳᵉ classe : profil dédié + ses effets AUTHORÉS (Dégâts + États) en GameOp.
  const isManeuver = categoryKey === 'maneuvers';
  // Porteurs de modificateurs PASSIFS continus (`GameOp[]`) édités par ops (GameOpEditor), comme un sort.
  // Talents inclus (Coup puissant, Dur à cuire… ou Frénésie → grantFreeAttack, tous en `passive`).
  // `psychologies` (États psy) et `navalTraits` (Trait/Amélioration de navire, #157) rejoignent le lot.
  const isPassive = categoryKey === 'traits' || categoryKey === 'qualities' || categoryKey === 'mutations' || categoryKey === 'talents' || categoryKey === 'etats' || categoryKey === 'symptoms' || categoryKey === 'trappings' || categoryKey === 'psychologies' || categoryKey === 'navalTraits';
  // Structure de siège (`structures`, #157) : `traits` = {id,value?}[] → réutilise TraitListField (comme
  // les Traits/Traits optionnels d'une créature).
  const isStructure = categoryKey === 'structures';
  // Rôle d'équipage (`crewRoles`, #157) : `skills` = {skillId,spec?}[] → éditeur dédié.
  const hasCrewSkills = categoryKey === 'crewRoles';
  // Traumatisme (`traumas`, #157) : `prosthesis` (prothèses annulatrices, LDB 73) = {trappingId,cancels}[].
  const hasProsthesis = categoryKey === 'traumas';
  // Critique localisé (LDB ch.6/AA, #173) : `traumas` = string[] d'ids de fiche (`traumas.json`) →
  // éditeur dédié (TraumaListField, sélecteurs id→label) au lieu du datalist générique par-label.
  const hasTraumaList = CRITICAL_CATEGORIES.includes(categoryKey);
  // Panne de Vapeur (`steamBreakdowns`, #157) : `restart` (Test de redémarrage) = {skillId,spec?,difficulty,extendedDR?}[].
  const hasRestartTest = categoryKey === 'steamBreakdowns';
  // Champs `GameOp[]` autres que `passive` (ops/occupantOps/crewOps/captainOps, #157) — même GameOpEditor.
  const opsFields = opsFieldsOf(categoryKey);
  // Symptôme de maladie : pénalité aggravée `severePassive` (Modérée/Grave) + Test de cycle `onTick`
  // (difficulté + conséquence GameOp `onFail`) — éditeurs dédiés au-dessus du formulaire générique.
  const isSymptom = categoryKey === 'symptoms';
  // Signe astral : son EFFET de création (charMod / grantTalent) en `GameOp[]` — même éditeur que les
  // passifs, mais champ `effect` (appliqué une fois aux attributs de départ, cf. applyStarEffect).
  const isStarEffect = categoryKey === 'stars';
  // Table de Corruption : ses `ranges` (plages d100 → réf mutation) ont leur éditeur dédié.
  const isMutationTable = categoryKey === 'mutationTables';
  // Météo : ses `ranges` (plages d100 → type de météo) ont leur éditeur dédié.
  const isWeather = categoryKey === 'weather';
  // Mutation : traits psy conférés (PsychTraitsField) — sorti du repli JSON.
  const isMutation = categoryKey === 'mutations';
  // Arme DÉRIVÉE (WeaponField) : portée par une Mutation (Tentacule…) OU une Possession (prothèse-arme).
  const hasDerivedWeapon = categoryKey === 'mutations' || categoryKey === 'trappings';
  const hasConsumable = categoryKey === 'trappings';
  // Maladie : ses `symptoms` (DiseaseSymptom[]) ont un éditeur dédié (type + sévérité + difficulté).
  const isDisease = categoryKey === 'maladies';
  // Talent : sa capacité de combat `combat` (CombatFeature : drapeaux + castingKind/attackModes/offHand).
  const hasCombat = categoryKey === 'talents';
  // Compétence/Talent : `specs` = SpecEntry[] ({id,label}).
  const hasSpecs = categoryKey === 'skills' || categoryKey === 'talents';
  // Avancement (espèce / niveau de carrière) : `skills`/`talents` = AdvancementRef[] (réf/joker/choix/aléatoire).
  const hasAdvancement = categoryKey === 'races' || categoryKey === 'careerLevels';
  // Possessions de DÉPART (classe / niveau de carrière) : `trappings` = TrappingRef[] (id catalogue + quantité, ou texte).
  const hasTrappings = categoryKey === 'classes' || categoryKey === 'careerLevels';
  // Niveau de carrière : `characteristics` = CharKey[] (vocab fermé) → multi-sélection (pas de saisie libre).
  const hasCharKeys = categoryKey === 'careerLevels';
  // Étoile : `sub` = sous-fourchette d100 [min,max] (Étoile du Sorcier) → deux inputs number.
  const hasStarSub = categoryKey === 'stars';
  // Domaine de magie : `castBonus`/`missile`/`casterOps` = attributs de domaine (éditeur dédié).
  const hasDomainEffects = categoryKey === 'domains';
  // Créature : `traits`/`optionals` = TraitInstance[] (réutilise `TraitListField` du StatblockEditor),
  // `harvest` = objet { rareté, dangerosité, usages } (HarvestField) → sortis du repli JSON.
  const isCreature = categoryKey === 'creatures';
  // Détails de création (objet unique `details.json`) : `texts` (5 entrées { all, bySpecies }) a son
  // éditeur dédié ; les 4 records Âge/Taille restent au formulaire générique (`recordNumber`).
  const isDetails = categoryKey === 'details';
  // Trait : SCHÉMA de son argument (indice/range/specsSource/specsOpen/specsMulti) → éditeur dédié
  // (select des sources DÉRIVÉ de SPEC_SOURCES + booléens + libellé d'indice), sorti du repli générique.
  const isTrait = categoryKey === 'traits';
  // Critique de coque (10 catégories navire/fluvial, #157 suite) : `crewTest` (skillId?/difficulty?/
  // crewTarget?/onFail) → éditeur dédié (ShipCrewTestField) ; `ops` reste sur le lot GameOpEditor commun.
  const isShipCrit = SHIP_CRIT_CATEGORIES.includes(categoryKey);
  // Exposition à l'eau (`waterExposure`, #157 suite, T2C ch.14) : `test` (Compétence+Difficulté),
  // `modifiers` (WaterExposureModifier[]) et `diseases` (plages d100 → maladie) ont chacun leur éditeur.
  const isWaterExposure = categoryKey === 'waterExposure';
  // #168 : Activité (`activities`) — Test « posté » (contexts/skills « au choix »/char/difficulty) +
  // table d'issues `outcomes` (OutcomeBand[]) ; `onSuccess` reste sur le lot GameOpEditor commun.
  const isActivity = categoryKey === 'activities';
  // Champs au formulaire GÉNÉRIQUE = tous les champs inférés SAUF ceux couverts par un éditeur dédié
  // (`dedicatedFieldKeys`, source unique partagée avec le garde-fou no-json-fields.test).
  const fields = useMemo(() => {
    const handled = dedicatedFieldKeys(categoryKey);
    return inferFields(src.entries as Record<string, unknown>[]).filter((f) => !handled.has(f.key));
  }, [src.entries, categoryKey]);
  const edit = (key: string, v: unknown) => { setEntry((e) => ({ ...e, [key]: v })); setDirty(true); setSchemaError(null); };
  // Erreurs BLOQUANTES avant persist (identité + refs résolvables) — pas de validation des
  // datasets-objet (details/names : pas d'identité par entrée ; la clé du mode Record a sa garde).
  const errors = useMemo(() => (obj ? [] : validateEntry(categoryKey, entry, src.entries, src.index)), [obj, categoryKey, entry, src]);
  // En mode Record, la clé (race) ne peut pas être vide (sinon entrée fantôme) — bloque l'enregistrement.
  const canSave = dirty && errors.length === 0 && (!src.recordMode || recordKey.trim().length > 0);

  const save = async () => {
    src.persist(entry, recordKey.trim()); // preview mémoire (live) — mutation en place (tableau ou objet)
    invalidateCodexLookup(); // l'index de `codexLookup` repart de la donnée persistée
    // Le texte écrit = la SOURCE entière (tableau ou objet-dataset), re-sérialisée byte-fidèle.
    const root = obj ? datasetObject(obj.ds) : datasetSerializeRoot(editableDataset(categoryKey)!);
    // Contrat de donnée (#176) : la source entière doit parser son schéma zod (SCHEMA_DEFS) AVANT toute
    // écriture disque — refus champ-par-champ sinon (rien n'est écrit ; la preview mémoire reste éditable).
    const schemaErr = validateDataset(src.file, root);
    if (schemaErr) { setSchemaError(schemaErr); setMsg(''); return; }
    setSchemaError(null);
    const text = serializeDataset(root);
    try {
      if (fs.FS_API && dir && !needsGrant) { await fs.writeFile(dir, src.file, text); setMsg(`Enregistré ${src.file} — Vite recharge…`); }
      else { fs.downloadFallback(src.file, text); setMsg(`Téléchargé ${src.file} — reposez-le dans src/data/`); }
      setDirty(false);
    } catch (e) { setMsg(`Échec : ${String(e)}`); }
  };

  return (
    <div className="codex-edit">
      <div className="codex-edit-bar">
        {!fs.FS_API && <span className="de-warn">FS Access indisponible — sauvegarde par téléchargement</span>}
        {fs.FS_API && !dir && <button className="btn small" onClick={() => fs.connectDataDir().then((h) => { setDir(h); setNeedsGrant(false); }).catch(() => {})}><Icon id="file/folder" size="sm" /> Connecter src/data…</button>}
        {fs.FS_API && dir && needsGrant && <button className="btn small" onClick={() => dir && fs.grantPermission(dir).then((ok) => ok && setNeedsGrant(false))}>Autoriser l'écriture</button>}
        {fs.FS_API && dir && !needsGrant && <span className="de-ok"><Icon id="file/folder" size="sm" /> connecté</span>}
        <span className="de-spacer" />
        {msg && <span className="de-msg">{msg}</span>}
        <button className="btn small" onClick={onClose}>Fermer</button>
        <button className="btn small btn-primary" disabled={!canSave} onClick={save}>Enregistrer{dirty ? ' •' : ''}</button>
      </div>
      {dirty && errors.length > 0 && (
        <ul className="codex-edit-errors">
          {errors.map((e) => <li key={e}>{e}</li>)}
        </ul>
      )}
      {schemaError && (
        <ul className="codex-edit-errors">
          {schemaError.split('\n').map((line, i) => <li key={i}>{line}</li>)}
        </ul>
      )}
      <div className="codex-edit-form">
        {src.recordMode && (
          <label className="ed-field"><span>Clé (race) — identifiant de l'entrée</span>
            <input value={recordKey} placeholder="ex. Humain" onChange={(e) => { setRecordKey(e.target.value); setDirty(true); }} />
          </label>
        )}
        {hasAppearance && <AppearanceField name={String(entry.label ?? label)} value={entry.appearance as EntityAppearance | undefined} onChange={(v) => edit('appearance', v)} />}
        {isSpell && <SpellEffectsField value={entry.effects as Flow | undefined} onChange={(v) => edit('effects', v)} />}
        {isPassive && (
          <div className="ed-field">
            <span>modificateurs PASSIFS continus (mêmes ops que les sorts — sans déclencheur)</span>
            <GameOpEditor ops={(entry.passive as GameOp[] | undefined) ?? []} onChange={(ops) => edit('passive', ops)} />
          </div>
        )}
        {isStarEffect && (
          <div className="ed-field">
            <span>effet du signe — appliqué aux attributs de départ à la création (±carac / Talent octroyé)</span>
            <GameOpEditor ops={(entry.effect as GameOp[] | undefined) ?? []} onChange={(ops) => edit('effect', ops)} />
          </div>
        )}
        {isSymptom && (
          <div className="ed-field">
            <span>modificateurs PASSIFS aggravés — appliqués quand l'instance porte une sévérité (Convulsions Modérée/Grave → −20)</span>
            <GameOpEditor ops={(entry.severePassive as GameOp[] | undefined) ?? []} onChange={(ops) => edit('severePassive', ops.length ? ops : undefined)} />
          </div>
        )}
        {isSymptom && <SymptomTickField value={entry.onTick as { difficulty: Difficulty; onFail: GameOp[] } | undefined} onChange={(v) => edit('onTick', v)} />}
        {isTriggered && <TriggeredEffectsField value={entry.effects as TriggeredEffect[] | undefined} onChange={(v) => edit('effects', v)} />}
        {hasConsumable && <TriggeredEffectsField label="effets à la touche de l’arme (onHit → Flow d’ops, ADE II)" value={entry.onHitEffects as TriggeredEffect[] | undefined} onChange={(v) => edit('onHitEffects', v.length ? v : undefined)} />}
        {isManeuver && <ManeuverDefField entry={entry} edit={edit} />}
        {isMutationTable && <MutationTableField value={entry.ranges as MutationRange[] | undefined} onChange={(v) => edit('ranges', v)} />}
        {isWeather && <WeatherRangesField value={entry.ranges as { max: number; weather: string }[] | undefined} onChange={(v) => edit('ranges', v)} />}
        {hasDerivedWeapon && <WeaponField value={entry.derivedWeapon as Weapon | undefined} onChange={(v) => edit('derivedWeapon', v)} />}
        {hasConsumable && (
          <div className="ed-field">
            <span>effet d’un CONSOMMABLE (potion/drogue/bandage) — Flow appliqué au buveur (ops, branches, Tests « au boire »)</span>
            <FlowEditor flow={(entry.consumable as Flow | undefined) ?? EMPTY_FLOW} ctx={{ encounters: [], dialogues: [] }}
              onChange={(f) => edit('consumable', f.kind === 'seq' && f.steps.length === 0 ? undefined : f)} />
          </div>
        )}
        {hasConsumable && <ConsumableDurationField value={entry.consumableDuration as ConsumableDuration | undefined} onChange={(v) => edit('consumableDuration', v)} />}
        {isMutation && <PsychTraitsField value={entry.psychTraits as PsychTrait[] | undefined} onChange={(v) => edit('psychTraits', v)} />}
        {isDisease && <SymptomsField value={entry.symptoms as DiseaseSymptom[] | undefined} onChange={(v) => edit('symptoms', v)} />}
        {hasCombat && <TalentTestField value={entry.test as TalentTest | undefined} onChange={(v) => edit('test', v)} />}
        {hasCombat && <CombatField value={entry.combat as Partial<CombatFeature> | undefined} allFeatures={src.entries.map((e) => e.combat as Partial<CombatFeature> | undefined)} onChange={(v) => edit('combat', v)} />}
        {hasSpecs && <SpecsField value={entry.specs as SpecEntry[] | undefined} onChange={(v) => edit('specs', v)} />}
        {hasAdvancement && <AdvancementRefField ds="skills" label="Compétences" value={entry.skills as AdvancementRef[] | undefined} onChange={(v) => edit('skills', v)} />}
        {hasAdvancement && <AdvancementRefField ds="talents" label="Talents" value={entry.talents as AdvancementRef[] | undefined} onChange={(v) => edit('talents', v)} />}
        {hasTrappings && <TrappingRefField value={entry.trappings as TrappingRef[] | undefined} onChange={(v) => edit('trappings', v)} />}
        {hasCharKeys && <CharKeysField value={entry.characteristics as CharKey[] | undefined} onChange={(v) => edit('characteristics', v)} />}
        {hasStarSub && <StarSubField value={entry.sub as [number, number] | undefined} onChange={(v) => edit('sub', v)} />}
        {hasDomainEffects && (
          <DomainEffectsField
            castBonus={entry.castBonus as DomainData['castBonus']}
            missile={entry.missile as DomainData['missile']}
            casterOps={entry.casterOps as DomainData['casterOps']}
            onCastBonus={(v) => edit('castBonus', v)}
            onMissile={(v) => edit('missile', v)}
            onCasterOps={(v) => edit('casterOps', v)}
          />
        )}
        {isCreature && (
          <>
            <TraitListField label="Traits" hint="(LDB 85 — armement « Arme (Épée) +7 », Psychologie « Peur 3 »…)" value={entry.traits as TraitInstance[] | undefined} onChange={(v) => edit('traits', v)} />
            <OptionalsListField label="Traits optionnels" hint="(LDB 76 — proposés au spawn ; notes composées « swap »/« tous les traits » en lecture seule)" value={entry.optionals as OptionalEntry[] | undefined} onChange={(v) => edit('optionals', v)} />
            <HarvestField value={entry.harvest as { rarity: import('../../data').HarvestRarity; danger: import('../../data').HarvestDanger; uses: string } | undefined} onChange={(v) => edit('harvest', v)} />
          </>
        )}
        {isDetails && <DetailsTextsField value={entry.texts as DetailsTexts | undefined} onChange={(v) => edit('texts', v)} />}
        {isTrait && <TraitSchemaField entry={entry} edit={edit} />}
        {isStructure && <TraitListField label="Atouts" hint="(Résistant/Impénétrable — ADE II ch.08)" value={entry.traits as TraitInstance[] | undefined} onChange={(v) => edit('traits', v)} />}
        {hasCrewSkills && <SkillSpecListField value={entry.skills as { skillId: string; spec?: string }[] | undefined} onChange={(v) => edit('skills', v)} />}
        {hasProsthesis && <ProsthesisField value={entry.prosthesis as { trappingId: string; cancels: 'all' | 'movement' }[] | undefined} onChange={(v) => edit('prosthesis', v.length ? v : undefined)} />}
        {hasTraumaList && <TraumaListField value={entry.traumas as string[] | undefined} onChange={(v) => edit('traumas', v.length ? v : undefined)} />}
        {hasRestartTest && <RestartTestField value={entry.restart as { skillId: string; spec?: string; difficulty: Difficulty; extendedDR?: number }[] | undefined} onChange={(v) => edit('restart', v.length ? v : undefined)} />}
        {isShipCrit && <ShipCrewTestField value={entry.crewTest as ShipCrewTest | undefined} onChange={(v) => edit('crewTest', v)} />}
        {isWaterExposure && <WaterTestField value={entry.test as { skillId: string; difficulty: Difficulty } | undefined} onChange={(v) => edit('test', v)} />}
        {isWaterExposure && <WaterModifiersField value={entry.modifiers as WaterExposureModifier[] | undefined} onChange={(v) => edit('modifiers', v)} />}
        {isWaterExposure && <WaterDiseasesField value={entry.diseases as WaterExposureData['diseases'] | undefined} onChange={(v) => edit('diseases', v)} />}
        {isActivity && <ActivityTestField entry={entry} edit={edit} />}
        {isActivity && <OutcomeBandsField value={entry.outcomes as OutcomeBand[] | undefined} onChange={(v) => edit('outcomes', v.length ? v : undefined)} />}
        {opsFields.map((fieldKey) => (
          <div className="ed-field" key={fieldKey}>
            <span>{fieldKey} — effet (GameOp[], même éditeur que les modificateurs passifs)</span>
            <GameOpEditor ops={(entry[fieldKey] as GameOp[] | undefined) ?? []} onChange={(ops) => edit(fieldKey, ops)} />
          </div>
        ))}
        {fields.map((f) => {
          const cfg = refFieldCfg(categoryKey, f.key);
          return cfg
            ? <RefField key={f.key} cfg={cfg} categoryKey={categoryKey} fieldKey={f.key} nullable={f.nullable} value={entry[f.key]} onChange={(v) => edit(f.key, v)} />
            : <Field key={f.key} field={f} value={entry[f.key]} onChange={(v) => edit(f.key, v)} />;
        })}
      </div>
    </div>
  );
}

/** Éditeur d'apparence par défaut d'une créature (bloc `appearance` UNIFIÉ) — réutilise la brique
 *  partagée `MonsterPartsFields` (espèce + parts/couleurs/coiffure/tenue/yeux). Édite le VRAI record
 *  `creatures.json` ; le rig le lit comme couche de défaut → l'apparence en jeu reflète l'édition. */
function AppearanceField({ name, value, onChange }: { name: string; value: EntityAppearance | undefined; onChange: (v: EntityAppearance) => void }) {
  const a = value ?? {};
  const patch = (p: Partial<EntityAppearance>) => onChange({ ...a, ...p });
  return (
    <div className="ed-field ed-appearance">
      <span>apparence par défaut (rig) — éditée sur le record, reflétée en jeu</span>
      <CreaturePreview name={name} appearance={a} />{/* aperçu LIVE : se met à jour à chaque modification */}
      <label className="ed-subfield">
        Espèce
        <select value={a.species ?? ''} onChange={(e) => patch({ species: e.target.value || undefined })}>
          <option value="">(par défaut : Humain)</option>
          {creatureSpeciesOptions().map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
        </select>
      </label>
      <MonsterPartsFields
        monster={a.monster} colors={a.colors} sex={a.sex} build={a.build} parts={a.parts} tenue={a.tenue} eyes={a.eyes} features={a.features}
        onMonster={(p) => patch({ monster: { ...(a.monster ?? {}), ...p } })}
        onColors={(p) => patch({ colors: { ...(a.colors ?? {}), ...p } })}
        onSex={(s) => patch({ sex: s })}
        onBuild={(b) => patch({ build: b })}
        onParts={(p) => patch({ parts: { ...(a.parts ?? {}), ...p } })}
        onTenue={(c) => patch({ tenue: c })}
        onEyes={(p) => patch({ eyes: { ...(a.eyes ?? {}), ...p } })}
        onFeatures={(f) => patch({ features: f.length ? f : undefined })}
      />
    </div>
  );
}

/** Éditeur de la DURÉE d'horloge d'un consommable (`TrappingData.consumableDuration` — LDB 71/72
 *  « Durée : … ») : UNE unité (minutes/heures/jours) + une Formule (littéral, dés, « dés × facteur »
 *  pour « 1d10 × 10 minutes »). Résolue AU BOIRE (`consumableUntilTime`). */
function ConsumableDurationField({ value, onChange }: { value: ConsumableDuration | undefined; onChange: (v: ConsumableDuration | undefined) => void }) {
  const unit: keyof ConsumableDuration = value?.days != null ? 'days' : value?.hours != null ? 'hours' : 'minutes';
  const formula = value?.[unit];
  return (
    <div className="ed-field">
      <span>durée d’horloge du consommable (« Durée : … », LDB 71/72) — vide = effets instantanés/permanents</span>
      <div className="tf-row">
        <label className="dr"><input type="checkbox" checked={value != null} onChange={(e) => onChange(e.target.checked ? { minutes: 10 } : undefined)} /> durée</label>
        {value != null && (
          <>
            <select value={unit} onChange={(e) => onChange({ [e.target.value as keyof ConsumableDuration]: formula ?? 1 })}>
              <option value="minutes">minutes</option>
              <option value="hours">heures</option>
              <option value="days">jours</option>
            </select>
            <FormulaField label="Durée" value={formula} min={1} onChange={(f) => onChange({ [unit]: f })} />
          </>
        )}
      </div>
    </div>
  );
}

/** Éditeur des EFFETS d'un sort (`SpellData.effects`) — le `Flow` ÉDITABLE (do/si/test, feuilles
 *  EffectOp). Réutilise le `FlowEditor` de l'éditeur de scène (source UNIQUE de la logique authorée) :
 *  pose des effets mécaniques `on:'target'`/`on:'caster'`, des branches conditionnelles, des Tests. Écrit
 *  le record `spells.json` au save → l'incantation en jeu lit ces effets (runCombatFlow). `ctx` vide :
 *  un sort n'a pas d'encounters/dialogues de scène (les transitions/dialogues n'ont pas cours ici). */
function SpellEffectsField({ value, onChange }: { value: Flow | undefined; onChange: (v: Flow) => void }) {
  return (
    <div className="ed-field">
      <span>effets du sort (Flow éditable — effets mécaniques, conditions, tests)</span>
      <FlowEditor flow={value ?? EMPTY_FLOW} ctx={{ encounters: [], dialogues: [] }} onChange={onChange} />
    </div>
  );
}


/** Éditeur des EFFETS DÉCLENCHÉS (`TriggeredEffect[]`) — porté indifféremment par un Trait OU un Atout
 *  d'arme. MÊME logique authorée que les sorts : une LISTE d'effets, chacun = un DÉCLENCHEUR (sur
 *  événement) + une CIBLE + un `Flow` d'ops éditable (réutilise `FlowEditor`/`GameOpEditor`). Écrit le
 *  record `traits.json`/`qualities.json` au save → `state/triggeredEffects` les applique en jeu. */
function TriggeredEffectsField({ value, onChange, label = 'effets déclenchés (déclencheur → Flow d’ops, comme un sort)' }: { value: TriggeredEffect[] | undefined; onChange: (v: TriggeredEffect[]) => void; label?: string }) {
  const list = value ?? [];
  const set = (i: number, patch: Partial<TriggeredEffect>) => onChange(list.map((e, j) => (j === i ? { ...e, ...patch } : e)));
  const add = () => onChange([...list, { trigger: 'onHit', on: 'victim', flow: EMPTY_FLOW }]);
  return (
    <div className="ed-field">
      <span>{label}</span>
      {list.map((eff, i) => (
        <div className="ed-subfield trait-effect" key={i}>
          <div className="tf-row">
            <label className="dr">Déclencheur
              <select value={eff.trigger} onChange={(e) => set(i, { trigger: e.target.value as EffectTrigger })}>
                {(Object.keys(TRIGGER_LABEL) as EffectTrigger[]).map((t) => <option key={t} value={t}>{TRIGGER_LABEL[t]}</option>)}
              </select>
            </label>
            <label className="dr">Cible
              <select value={typeof eff.on === 'object' ? ('pick' in eff.on ? 'pick' : 'near') : eff.on}
                onChange={(e) => set(i, { on:
                  e.target.value === 'near' ? { near: 'victim', radiusMeters: 2 }
                  : e.target.value === 'pick' ? { pick: 'engaged', sizeAtMost: 'self', max: 1 }
                  : e.target.value as TriggeredEffect['on'] })}>
                {(Object.keys(ON_LABEL) as ('self' | 'victim' | 'engaged' | 'grappled')[]).map((o) => <option key={o} value={o}>{ON_LABEL[o]}</option>)}
                <option value="near">les cibles à portée (zone)</option>
                <option value="pick">un adversaire engagé (sélection)</option>
              </select>
            </label>
            {typeof eff.on === 'object' && 'near' in eff.on && (
              <label className="dr">à ≤ <input type="number" min={1} style={{ width: '3.4em' }} value={eff.on.radiusMeters} onChange={(e) => set(i, { on: { near: (eff.on as { near: 'self' | 'victim' }).near, radiusMeters: Math.max(1, Number(e.target.value) || 1) } })} /> m de
              <select value={eff.on.near} onChange={(e) => set(i, { on: { near: e.target.value as 'self' | 'victim', radiusMeters: (eff.on as { radiusMeters: number }).radiusMeters } })}>
                <option value="victim">la victime</option>
                <option value="self">soi</option>
              </select></label>
            )}
            {typeof eff.on === 'object' && 'pick' in eff.on && (
              <label className="dr">max <input type="number" min={1} style={{ width: '3.4em' }} value={eff.on.max} onChange={(e) => set(i, { on: { pick: 'engaged', ...((eff.on as { sizeAtMost?: 'self' }).sizeAtMost ? { sizeAtMost: 'self' as const } : {}), max: Math.max(1, Number(e.target.value) || 1) } })} />
              <input type="checkbox" checked={(eff.on as { sizeAtMost?: 'self' }).sizeAtMost === 'self'} onChange={(e) => set(i, { on: { pick: 'engaged', ...(e.target.checked ? { sizeAtMost: 'self' as const } : {}), max: (eff.on as { max: number }).max } })} /> Taille ≤ la sienne</label>
            )}
            <label className="dr" title="RAW « Vous pouvez… » (Contrôle de la Frénésie) : le héros CHOISIT de déclencher (étape de choix en fin de Round) ; l’IA ne l’exerce jamais">
              <input type="checkbox" checked={!!eff.optional} onChange={(e) => set(i, { optional: e.target.checked || undefined })} /> optionnel
            </label>
            <button className="btn small danger" title="Supprimer l’effet" onClick={() => onChange(list.filter((_, j) => j !== i))}>✕</button>
          </div>
          <FlowEditor flow={eff.flow ?? EMPTY_FLOW} ctx={{ encounters: [], dialogues: [] }} onChange={(flow) => set(i, { flow })} />
        </div>
      ))}
      <button className="btn small" onClick={add}>+ Effet de trait</button>
    </div>
  );
}

const STAT_LABEL: Record<NonNullable<ManeuverDef['stat']>, string> = { CC: 'CC (mêlée)', CT: 'CT (distance)' };
const ADV_MODE_LABEL: Record<NonNullable<ManeuverDef['advantageMode']>, string> = {
  fixed: 'Coût fixe', variable: 'Au choix (+1 DR/Av)', all: 'Tout l’Avantage',
};
const DEFENSE_LABEL: Record<NonNullable<ManeuverDef['defense']>, string> = {
  esquive: 'Esquive', parade: 'Parade', init: 'Initiative', resist: 'Résistance (cible)', auto: 'Meilleure (auto)',
};

/** Éditeur d'une MANŒUVRE (entité de 1ʳᵉ classe, `maneuvers.json`) : son PROFIL (type/activation/coût/
 *  jet/défense/ciblage/portée/magie) + ses effets AUTHORÉS (Dégâts + États en GameOp, via
 *  `TriggeredEffectsField`). Édite les champs TOP-LEVEL de `ManeuverDef` (id/label/desc/source restent
 *  au repli générique). Source UNIQUE de résolution : ces effets sont joués tels quels par `resolveManeuver`. */
/** Éditeur d'une `ManeuverMeasure` (Portée/Souffle) : Bonus de carac + constante (mètres). Structuré —
 *  plus de saisie prose « Bonus de Force mètres » re-parsée au runtime. */
function MeasureField({ label, value, onChange }: { label: string; value: ManeuverMeasure | undefined; onChange: (v: ManeuverMeasure | undefined) => void }) {
  const v = value ?? {};
  const upd = (p: Partial<ManeuverMeasure>) => {
    const bonusOf = 'bonusOf' in p ? p.bonusOf : v.bonusOf;
    const plus = 'plus' in p ? p.plus : v.plus;
    const next: ManeuverMeasure = {};
    if (bonusOf) next.bonusOf = bonusOf;
    if (plus != null) next.plus = plus;
    onChange(next.bonusOf || next.plus != null ? next : undefined);
  };
  return (
    <label className="dr">{label}
      <select value={v.bonusOf ?? ''} onChange={(e) => upd({ bonusOf: (e.target.value || undefined) as CharKey | undefined })}>
        <option value="">— (aucun)</option>
        {CHAR_KEYS.map((k) => <option key={k} value={k}>Bonus de {CHAR_LABELS[k]}</option>)}
      </select>
      <input type="number" placeholder="+ m" style={{ width: 64 }} value={v.plus ?? ''} onChange={(e) => upd({ plus: e.target.value === '' ? undefined : (Number(e.target.value) || 0) })} /> m
    </label>
  );
}

function ManeuverDefField({ entry, edit }: { entry: Entry; edit: (key: string, v: unknown) => void }) {
  const m = entry as Partial<ManeuverDef>;
  return (
    <div className="ed-field ed-maneuver">
      <div className="tf-row">
        <label className="dr">Type (geste)
          <select value={m.kind ?? 'morsure'} onChange={(e) => edit('kind', e.target.value as AttackKind)}>
            {(Object.keys(ATTACK_LABEL) as AttackKind[]).map((k) => <option key={k} value={k}>{ATTACK_LABEL[k]}</option>)}
          </select>
        </label>
        <label className="dr">Activation
          <select value={m.activation ?? 'free'} onChange={(e) => edit('activation', e.target.value as ManeuverDef['activation'])}>
            {(Object.keys(MANEUVER_ACTIVATION_LABEL) as ManeuverDef['activation'][]).map((a) => <option key={a} value={a}>{MANEUVER_ACTIVATION_LABEL[a]}</option>)}
          </select>
        </label>
        <label className="dr">Coût d’Avantage<input type="number" min={0} value={m.advantageCost ?? 0} onChange={(e) => edit('advantageCost', Math.max(0, Number(e.target.value) || 0))} /></label>
        <label className="dr">Avantage
          <select value={m.advantageMode ?? 'fixed'} onChange={(e) => edit('advantageMode', e.target.value === 'fixed' ? undefined : (e.target.value as ManeuverDef['advantageMode']))}>
            {(Object.keys(ADV_MODE_LABEL) as NonNullable<ManeuverDef['advantageMode']>[]).map((a) => <option key={a} value={a}>{ADV_MODE_LABEL[a]}</option>)}
          </select>
        </label>
      </div>
      <div className="tf-row">
        <label className="dr">Jet d’attaquant
          <select value={m.stat ?? ''} onChange={(e) => edit('stat', e.target.value || undefined)}>
            <option value="">— (aucun)</option>
            {(Object.keys(STAT_LABEL) as NonNullable<ManeuverDef['stat']>[]).map((s) => <option key={s} value={s}>{STAT_LABEL[s]}</option>)}
          </select>
        </label>
        <label className="dr">Défense
          <select value={m.defense ?? ''} onChange={(e) => edit('defense', e.target.value || undefined)}>
            <option value="">— (aucune)</option>
            {(Object.keys(DEFENSE_LABEL) as NonNullable<ManeuverDef['defense']>[]).map((d) => <option key={d} value={d}>{DEFENSE_LABEL[d]}</option>)}
          </select>
        </label>
        <label className="dr">Ciblage
          <select value={m.targeting ?? 'melee'} onChange={(e) => edit('targeting', e.target.value as ManeuverDef['targeting'])}>
            {(Object.keys(MANEUVER_TARGETING_LABEL) as ManeuverDef['targeting'][]).map((t) => <option key={t} value={t}>{MANEUVER_TARGETING_LABEL[t]}</option>)}
          </select>
        </label>
        <label className="dr"><input type="checkbox" checked={!!m.magic} onChange={(e) => edit('magic', e.target.checked || undefined)} /> Magique</label>
      </div>
      <div className="tf-row">
        <MeasureField label="Portée" value={m.range} onChange={(v) => edit('range', v)} />
        <MeasureField label="Souffle/zone" value={m.blast} onChange={(v) => edit('blast', v)} />
      </div>
      <span>effets AUTHORÉS de la manœuvre (Dégâts + États, appliqués quand ELLE touche)</span>
      <TriggeredEffectsField value={m.effects} onChange={(effects) => edit('effects', effects.length ? effects : undefined)} />
    </div>
  );
}

/** Libellés FR (affichage) des sources de spéc. La LISTE d'options DÉRIVE de `SPEC_SOURCES` (SSOT) ;
 *  ce map n'est qu'un habillage — repli sur la clé brute si absent, donc une source ajoutée à l'union
 *  `SpecsSource` reste sélectionnable sans toucher ici. */
const SPECS_SOURCE_LABEL: Partial<Record<SpecsSource, string>> = {
  weaponGroupsMelee: 'Groupes d’arme (mêlée)', weaponGroupsRanged: 'Groupes d’arme (distance)',
  winds: 'Vents de magie', arcaneDomains: 'Domaines arcaniques', cultBlessings: 'Bénédictions (dieux)',
  cultMiracles: 'Miracles (dieux)', cultChaos: 'Magie du Chaos (dieux)', seaShanties: 'Chansons de marin',
  groups: 'Groupes (créatures/factions)', diseases: 'Maladies', sizes: 'Tailles', mutations: 'Mutations',
  breathTypes: 'Types de Souffle', damageTypes: 'Types de Dégâts (immunité)',
};
/** Sources sélectionnables — DÉRIVÉES du catalogue `SPEC_SOURCES` (jamais une copie en dur de l'union). */
const SPECS_SOURCE_KEYS = Object.keys(SPEC_SOURCES) as SpecsSource[];

/** Éditeur du SCHÉMA d'ARGUMENT d'un Trait (`traits.json`) : décrit comment son INSTANCE porte sa
 *  valeur/argument — `indice` (sens de la valeur numérique : Indice/Difficulté/Degré…), `range` (portée
 *  en m), `specsSource` (registre d'où l'`arg` tire ses ids — catalogue `SPEC_SOURCES`), `specsOpen`
 *  (arg = texte libre), `specsMulti` (arg = liste d'ids séparés par virgules). Réutilise les motifs
 *  existants (select comme `ManeuverDefField`, checkbox `.dr`, input `.dr`). Gate `traits` uniquement. */
function TraitSchemaField({ entry, edit }: { entry: Entry; edit: (key: string, v: unknown) => void }) {
  const indice = entry.indice as { label: string } | undefined;
  return (
    <div className="ed-field">
      <span>schéma de l’argument — comment l’instance porte sa valeur/argument</span>
      <div className="tf-row">
        <label className="dr">valeur numérique — libellé
          <input placeholder="ex. Indice / Difficulté / Degré" value={indice?.label ?? ''}
            onChange={(e) => edit('indice', e.target.value ? { label: e.target.value } : undefined)} />
        </label>
        <label className="dr"><input type="checkbox" checked={!!entry.range} onChange={(e) => edit('range', e.target.checked || undefined)} /> porte une portée (m)</label>
      </div>
      <div className="tf-row">
        <label className="dr">source de l’argument (registre)
          <select value={(entry.specsSource as string) ?? ''} onChange={(e) => edit('specsSource', e.target.value || undefined)}>
            <option value="">— (aucune / argument libre) —</option>
            {SPECS_SOURCE_KEYS.map((s) => <option key={s} value={s}>{SPECS_SOURCE_LABEL[s] ?? s}</option>)}
          </select>
        </label>
        <label className="dr"><input type="checkbox" checked={!!entry.specsOpen} onChange={(e) => edit('specsOpen', e.target.checked || undefined)} /> argument en texte libre (ouvert)</label>
        <label className="dr"><input type="checkbox" checked={!!entry.specsMulti} onChange={(e) => edit('specsMulti', e.target.checked || undefined)} /> liste d’ids (séparés par virgules)</label>
      </div>
    </div>
  );
}

/** Compétences d'un Rôle d'équipage (`crewRoles.skills`, MDG ch.14, #157) : `{skillId,spec?}[]` — un
 *  rôle peut mapper plusieurs Compétences candidates (Mousse = Voile OU Ramer, la meilleure retenue). */
function SkillSpecListField({ value, onChange }: { value: { skillId: string; spec?: string }[] | undefined; onChange: (v: { skillId: string; spec?: string }[]) => void }) {
  const list = value ?? [];
  const skillOpts = datasetArray('skills') as { id: string; label: string }[];
  const set = (next: typeof list) => onChange(next);
  return (
    <div className="ed-field">
      <span>compétences du rôle (au moins une ; « au choix » si plusieurs — la meilleure est retenue)</span>
      {list.map((s, i) => (
        <div className="tf-row" key={i}>
          <select value={s.skillId} onChange={(e) => set(list.map((x, j) => (j === i ? { ...x, skillId: e.target.value } : x)))}>
            {skillOpts.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
          </select>
          <input placeholder="spécialisation (facultatif)" value={s.spec ?? ''} onChange={(e) => set(list.map((x, j) => (j === i ? { ...x, spec: e.target.value || undefined } : x)))} />
          <button className="btn small danger" title="Retirer" onClick={() => set(list.filter((_, j) => j !== i))}>✕</button>
        </div>
      ))}
      <button className="btn small" onClick={() => set([...list, { skillId: skillOpts[0]?.id ?? '' }])}>+ Compétence</button>
    </div>
  );
}

/** Prothèses ANNULATRICES d'un Traumatisme (`traumas.prosthesis`, LDB 73, #157) : `{trappingId,cancels}[]`
 *  — un objet porté (jambe de bois, crochet…) qui annule tout ou partie de la séquelle. */
function ProsthesisField({ value, onChange }: { value: { trappingId: string; cancels: 'all' | 'movement' }[] | undefined; onChange: (v: { trappingId: string; cancels: 'all' | 'movement' }[]) => void }) {
  const list = value ?? [];
  const trappingOpts = datasetArray('trappings') as { id: string; label: string }[];
  const set = (next: typeof list) => onChange(next);
  return (
    <div className="ed-field">
      <span>prothèses annulatrices (LDB 73) — objet porté qui annule cette séquelle</span>
      {list.map((p, i) => (
        <div className="tf-row" key={i}>
          <select value={p.trappingId} onChange={(e) => set(list.map((x, j) => (j === i ? { ...x, trappingId: e.target.value } : x)))}>
            <option value="">— (choisir une possession) —</option>
            {trappingOpts.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
          </select>
          <select value={p.cancels} onChange={(e) => set(list.map((x, j) => (j === i ? { ...x, cancels: e.target.value as 'all' | 'movement' } : x)))}>
            <option value="all">annule tout</option>
            <option value="movement">annule le Mouvement seul</option>
          </select>
          <button className="btn small danger" title="Retirer" onClick={() => set(list.filter((_, j) => j !== i))}>✕</button>
        </div>
      ))}
      <button className="btn small" onClick={() => set([...list, { trappingId: trappingOpts[0]?.id ?? '', cancels: 'all' }])}>+ Prothèse</button>
    </div>
  );
}

/** Traumatismes STRUCTURELS infligés par un Critique localisé (`criticals[Tete|Bras|Corps|Jambe].traumas`,
 *  `aaCriticals*`, LDB ch.6/AA, #173) : `string[]` d'ids de fiche (`traumas.json`), lus PAR ID
 *  (`traumaFicheById`/`traumaById`). Sélecteurs id→label (comme `SkillSpecListField`/`ProsthesisField`),
 *  PAS le motif `<datalist>` par label : plusieurs fiches partagent le même libellé (« Fracture » mineure
 *  ET majeure) — un datalist par label ne pourrait même pas les distinguer, et écrirait un libellé au lieu
 *  de l'id attendu par le lecteur. */
function TraumaListField({ value, onChange }: { value: string[] | undefined; onChange: (v: string[]) => void }) {
  const list = value ?? [];
  const traumaOpts = datasetArray('traumas') as { id: string; label: string }[];
  const set = (next: string[]) => onChange(next);
  return (
    <div className="ed-field">
      <span>traumatismes (LDB 73) — séquelle(s) structurelle(s) infligée(s) par ce critique</span>
      {list.map((id, i) => (
        <div className="tf-row" key={i}>
          <select value={id} onChange={(e) => set(list.map((x, j) => (j === i ? e.target.value : x)))}>
            <option value="">— (choisir un traumatisme) —</option>
            {traumaOpts.map((o) => <option key={o.id} value={o.id}>{o.label} — {o.id}</option>)}
          </select>
          <button className="btn small danger" title="Retirer" onClick={() => set(list.filter((_, j) => j !== i))}>✕</button>
        </div>
      ))}
      <button className="btn small" onClick={() => set([...list, traumaOpts[0]?.id ?? ''])}>+ Traumatisme</button>
    </div>
  );
}

const DIFFICULTIES = Object.keys(DIFFICULTY_LABELS) as Difficulty[];

/** Test de REDÉMARRAGE d'un moteur à vapeur (`steamBreakdowns.restart`, MDG ch.12, #157) :
 *  `{skillId,spec?,difficulty,extendedDR?}[]` — Compétence + Difficulté (+ DR cumulés si Test étendu). */
function RestartTestField({ value, onChange }: { value: { skillId: string; spec?: string; difficulty: Difficulty; extendedDR?: number }[] | undefined; onChange: (v: { skillId: string; spec?: string; difficulty: Difficulty; extendedDR?: number }[]) => void }) {
  const list = value ?? [];
  const skillOpts = datasetArray('skills') as { id: string; label: string }[];
  const set = (next: typeof list) => onChange(next);
  return (
    <div className="ed-field">
      <span>Test de redémarrage du moteur — Compétence + Difficulté (DR cumulés si Test étendu)</span>
      {list.map((r, i) => (
        <div className="tf-row" key={i}>
          <select value={r.skillId} onChange={(e) => set(list.map((x, j) => (j === i ? { ...x, skillId: e.target.value } : x)))}>
            {skillOpts.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
          </select>
          <input placeholder="spécialisation (facultatif)" value={r.spec ?? ''} onChange={(e) => set(list.map((x, j) => (j === i ? { ...x, spec: e.target.value || undefined } : x)))} />
          <select value={r.difficulty} onChange={(e) => set(list.map((x, j) => (j === i ? { ...x, difficulty: e.target.value as Difficulty } : x)))}>
            {DIFFICULTIES.map((d) => <option key={d} value={d}>{DIFFICULTY_LABELS[d]}</option>)}
          </select>
          <input type="number" min={1} placeholder="DR cumulés (étendu)" style={{ width: 64 }} value={r.extendedDR ?? ''} onChange={(e) => set(list.map((x, j) => (j === i ? { ...x, extendedDR: e.target.value === '' ? undefined : Number(e.target.value) } : x)))} />
          <button className="btn small danger" title="Retirer" onClick={() => set(list.filter((_, j) => j !== i))}>✕</button>
        </div>
      ))}
      <button className="btn small" onClick={() => set([...list, { skillId: skillOpts[0]?.id ?? '', difficulty: DIFFICULTIES[0] }])}>+ Test</button>
    </div>
  );
}

/** Test d'ÉQUIPAGE (échec) d'un Critique de coque (`ShipCritEntry.crewTest`, MDG ch.13 / T2C ch.5,
 *  #157 suite) : Compétence + Difficulté (vide = dégâts AUTOMATIQUES, aucun Test) + cible (poste tiré
 *  au sort ou tout le pont) + conséquence en `GameOp[]` (même éditeur que les modificateurs passifs). */
function ShipCrewTestField({ value, onChange }: { value: ShipCrewTest | undefined; onChange: (v: ShipCrewTest | undefined) => void }) {
  const skillOpts = datasetArray('skills') as { id: string; label: string }[];
  const v = value;
  return (
    <div className="ed-field">
      <span>Test d’équipage (échec) — Compétence (vide = dégâts automatiques) + cible + conséquence</span>
      <div className="tf-row">
        <label className="dr"><input type="checkbox" checked={!!v} onChange={(e) => onChange(e.target.checked ? { crewTarget: 'poste', onFail: [] } : undefined)} /> Test requis</label>
        {v && (
          <>
            <select value={v.skillId ?? ''} onChange={(e) => onChange({ ...v, skillId: e.target.value || undefined })}>
              <option value="">— (aucune, dégâts automatiques) —</option>
              {skillOpts.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
            </select>
            {v.skillId && (
              <select value={v.difficulty ?? DIFFICULTIES[0]} onChange={(e) => onChange({ ...v, difficulty: e.target.value as Difficulty })}>
                {DIFFICULTIES.map((d) => <option key={d} value={d}>{DIFFICULTY_LABELS[d]}</option>)}
              </select>
            )}
            <select value={v.crewTarget ?? 'poste'} onChange={(e) => onChange({ ...v, crewTarget: e.target.value as 'poste' | 'deck' })}>
              <option value="poste">Équipage du poste (tiré au sort)</option>
              <option value="deck">Toute personne sur le pont</option>
            </select>
          </>
        )}
      </div>
      {v && (
        <div className="ed-subfield">
          <span>conséquence (GameOp[]) — en cas d’échec (ou dégâts directs si aucune Compétence)</span>
          <GameOpEditor ops={v.onFail ?? []} onChange={(ops) => onChange({ ...v, onFail: ops })} />
        </div>
      )}
    </div>
  );
}

/** Test de Résistance d'Exposition hydrique (`waterExposure.test`, T2C ch.14 p.91, #157 suite) :
 *  Compétence + Difficulté — sorti du repli générique (le repli traiterait ce couple {skillId,difficulty}
 *  en `recordText` renommable, ce qui autoriserait de corrompre les clés d'un objet à forme FIXE). */
function WaterTestField({ value, onChange }: { value: { skillId: string; difficulty: Difficulty } | undefined; onChange: (v: { skillId: string; difficulty: Difficulty }) => void }) {
  const skillOpts = datasetArray('skills') as { id: string; label: string }[];
  const v = value ?? { skillId: skillOpts[0]?.id ?? '', difficulty: DIFFICULTIES[0] };
  return (
    <div className="ed-field">
      <span>Test de Résistance (T2C ch.14 p.91) — Compétence + Difficulté</span>
      <div className="tf-row">
        <select value={v.skillId} onChange={(e) => onChange({ ...v, skillId: e.target.value })}>
          {skillOpts.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
        </select>
        <select value={v.difficulty} onChange={(e) => onChange({ ...v, difficulty: e.target.value as Difficulty })}>
          {DIFFICULTIES.map((d) => <option key={d} value={d}>{DIFFICULTY_LABELS[d]}</option>)}
        </select>
      </div>
    </div>
  );
}

/** Contextes d'application d'un modificateur d'Exposition hydrique (T2C ch.14 p.91). */
const WATER_APPLIES_TO: { id: 'ingestion' | 'immersion'; label: string }[] = [
  { id: 'ingestion', label: 'Ingestion' }, { id: 'immersion', label: 'Immersion' },
];
const WATER_TABLE_OPTS: { id: 'source-d-eau' | 'blessures-et-etats'; label: string }[] = [
  { id: 'source-d-eau', label: 'Source d’eau' }, { id: 'blessures-et-etats', label: 'Blessures et États' },
];

/** Modificateurs du Test de Résistance d'Exposition hydrique (`waterExposure.modifiers`, T2C ch.14 p.91) :
 *  id/libellé/valeur + contexte (Ingestion/Immersion, cumulables) + table d'origine. `auto` (dérivation
 *  automatique depuis le Combatant — PB restants/perdus, État) reste en JSON : union à 5 formes, rare
 *  (6/12 entrées), pas assez structurante pour justifier un 2ᵉ éditeur dédié. */
function WaterModifiersField({ value, onChange }: { value: WaterExposureModifier[] | undefined; onChange: (v: WaterExposureModifier[]) => void }) {
  const list = value ?? [];
  const set = (i: number, patch: Partial<WaterExposureModifier>) => onChange(list.map((m, j) => (j === i ? { ...m, ...patch } : m)));
  const toggleAppliesTo = (i: number, ctx: 'ingestion' | 'immersion') => {
    const cur = list[i].appliesTo;
    set(i, { appliesTo: cur.includes(ctx) ? cur.filter((c) => c !== ctx) : [...cur, ctx] });
  };
  return (
    <div className="ed-field">
      <span>modificateurs du Test de Résistance (T2C ch.14 p.91) — cumulables</span>
      {list.map((m, i) => (
        <div className="ed-subfield" key={i}>
          <div className="tf-row">
            <input placeholder="id" style={{ width: 140 }} value={m.id} onChange={(e) => set(i, { id: e.target.value })} />
            <input placeholder="libellé" value={m.label} onChange={(e) => set(i, { label: e.target.value })} />
            <input type="number" style={{ width: 64 }} value={m.mod} onChange={(e) => set(i, { mod: Number(e.target.value) || 0 })} />
            <select value={m.table} onChange={(e) => set(i, { table: e.target.value as WaterExposureModifier['table'] })}>
              {WATER_TABLE_OPTS.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
            </select>
            <button className="btn small danger" title="Retirer" onClick={() => onChange(list.filter((_, j) => j !== i))}>✕</button>
          </div>
          <div className="tf-row">
            {WATER_APPLIES_TO.map((ctx) => (
              <label className="dr" key={ctx.id}><input type="checkbox" checked={m.appliesTo.includes(ctx.id)} onChange={() => toggleAppliesTo(i, ctx.id)} /> {ctx.label}</label>
            ))}
          </div>
          <JsonField label="condition automatique (auto — facultatif, dérivée du Combatant)" value={m.auto} onChange={(v) => set(i, { auto: v as WaterExposureModifier['auto'] })} />
        </div>
      ))}
      <button className="btn small" onClick={() => onChange([...list, { id: '', label: '', mod: 0, appliesTo: [], table: 'source-d-eau' }])}>+ Modificateur</button>
    </div>
  );
}

/** Maladies contractées sur Exposition hydrique (`waterExposure.diseases`, T2C ch.14 p.91) : plage d100
 *  (jet APRÈS échec du Test) → maladie référencée par ID (sélecteur, comme `SkillSpecListField`/
 *  `ProsthesisField`/`MutationTableField` — la donnée est un id, jamais un label). */
function WaterDiseasesField({ value, onChange }: { value: WaterExposureData['diseases'] | undefined; onChange: (v: WaterExposureData['diseases']) => void }) {
  const list = value ?? [];
  const maladieOpts = datasetArray('maladies') as { id: string; label: string }[];
  const set = (i: number, patch: Partial<WaterExposureData['diseases'][number]>) => onChange(list.map((r, j) => (j === i ? { ...r, ...patch } : r)));
  const clampD100 = (s: string) => Math.max(1, Math.min(100, Number(s) || 1));
  return (
    <div className="ed-field">
      <span>maladies contractées — jet d100 après échec du Test de Résistance (T2C ch.14 p.91)</span>
      {list.map((r, i) => (
        <div className="tf-row" key={i}>
          <label className="dr">d100&nbsp;<input type="number" min={1} max={100} value={r.min} onChange={(e) => set(i, { min: clampD100(e.target.value) })} />–<input type="number" min={1} max={100} value={r.max} onChange={(e) => set(i, { max: clampD100(e.target.value) })} /></label>
          <select value={r.disease} onChange={(e) => set(i, { disease: e.target.value })}>
            <option value="">— (choisir une maladie) —</option>
            {maladieOpts.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
          </select>
          <label className="dr"><input type="checkbox" checked={!!r.rerollUnlessWounded} onChange={(e) => set(i, { rerollUnlessWounded: e.target.checked || undefined })} /> relance si indemne</label>
          <button className="btn small danger" title="Retirer" onClick={() => onChange(list.filter((_, j) => j !== i))}>✕</button>
        </div>
      ))}
      <button className="btn small" onClick={() => onChange([...list, { min: 1, max: 1, disease: maladieOpts[0]?.id ?? '' }])}>+ Maladie</button>
    </div>
  );
}

// ── Activités (`activities.json`, #168) — Test « posté » + table d'issues `OutcomeBand[]` ────────────
const ACTIVITY_CONTEXTS = Object.keys(ACTIVITY_CONTEXT_LABEL) as ActivityContext[];
const OUTCOME_ON_KEYS = Object.keys(OUTCOME_ON_LABEL) as ('success' | 'failure' | 'fumble')[];
const BATTLE_COND_KEYS = Object.keys(BATTLE_COND_LABEL) as BattleCond[];
const BATTLE_TARGET_KEYS = Object.keys(BATTLE_TARGET_LABEL) as BattleOutcomeTarget[];
const BATTLE_SCALE_KEYS = Object.keys(BATTLE_SCALE_LABEL) as BattleOutcomeScale[];
const BATTLE_SIDE_KEYS = Object.keys(BATTLE_SIDE_LABEL) as BattleSide[];

/** Test « posté » d'une Activité (`TestSpec` — LDB 12) : contextes de proposition + compétence(s) « au
 *  choix » (la meilleure de l'acteur est retenue) + caractéristique de repli + Difficulté. Réutilise
 *  `SkillSpecListField` (mêmes `{skillId,spec?}[]` que les Rôles d'équipage). Vide = Activité SANS Test. */
function ActivityTestField({ entry, edit }: { entry: Entry; edit: (key: string, v: unknown) => void }) {
  const contexts = (entry.contexts as ActivityContext[] | undefined) ?? [];
  const toggle = (c: ActivityContext) => edit('contexts', contexts.includes(c) ? contexts.filter((x) => x !== c) : [...contexts, c]);
  return (
    <div className="ed-field">
      <span>contextes où l’Activité est proposable (au moins un)</span>
      <div className="tf-row">
        {ACTIVITY_CONTEXTS.map((c) => (
          <label className="dr" key={c}><input type="checkbox" checked={contexts.includes(c)} onChange={() => toggle(c)} /> {ACTIVITY_CONTEXT_LABEL[c]}</label>
        ))}
      </div>
      <span>Test « posté » — compétence(s) « au choix » + caractéristique de repli + Difficulté (laisser vide = Activité SANS Test)</span>
      <SkillSpecListField value={entry.skills as { skillId: string; spec?: string }[] | undefined} onChange={(v) => edit('skills', v.length ? v : undefined)} />
      <div className="tf-row">
        <label className="dr">Caractéristique (repli)
          <select value={(entry.char as string) ?? ''} onChange={(e) => edit('char', e.target.value || undefined)}>
            <option value="">— (aucune) —</option>
            {CHAR_KEYS.map((k) => <option key={k} value={k}>{CHAR_LABELS[k]}</option>)}
          </select>
        </label>
        <label className="dr">Difficulté
          <select value={(entry.difficulty as string) ?? ''} onChange={(e) => edit('difficulty', e.target.value || undefined)}>
            <option value="">— (aucune) —</option>
            {DIFFICULTIES.map((d) => <option key={d} value={d}>{DIFFICULTY_LABELS[d]}</option>)}
          </select>
        </label>
      </div>
    </div>
  );
}

/** Issues de BATAILLE (ADE II ch.8) d'une bande — portent sur l'ARMÉE (delta de Puissance / mod de Test),
 *  échelle `scale` (plat / × DR / × touches / × ennemis tués), montant SIGNÉ, camp éventuel. */
function BattleOutcomeListField({ value, onChange }: { value: BattleOutcome[] | undefined; onChange: (v: BattleOutcome[]) => void }) {
  const list = value ?? [];
  const set = (i: number, patch: Partial<BattleOutcome>) => onChange(list.map((o, j) => (j === i ? { ...o, ...patch } : o)));
  return (
    <div className="ed-subfield">
      <span>issues de BATAILLE (ADE II ch.8) — portent sur l’ARMÉE, pas sur le héros</span>
      {list.map((o, i) => (
        <div className="tf-row" key={i}>
          <select value={o.target} onChange={(e) => set(i, { target: e.target.value as BattleOutcomeTarget })}>
            {BATTLE_TARGET_KEYS.map((t) => <option key={t} value={t}>{BATTLE_TARGET_LABEL[t]}</option>)}
          </select>
          <select value={o.scale} onChange={(e) => set(i, { scale: e.target.value as BattleOutcomeScale })}>
            {BATTLE_SCALE_KEYS.map((s) => <option key={s} value={s}>{BATTLE_SCALE_LABEL[s]}</option>)}
          </select>
          <label className="dr">montant<input type="number" style={{ width: 72 }} value={o.amount} onChange={(e) => set(i, { amount: Number(e.target.value) || 0 })} /></label>
          <select value={o.side ?? ''} onChange={(e) => set(i, { side: (e.target.value || undefined) as BattleSide | undefined })}>
            <option value="">— camp (auto) —</option>
            {BATTLE_SIDE_KEYS.map((s) => <option key={s} value={s}>{BATTLE_SIDE_LABEL[s]}</option>)}
          </select>
          <button className="btn small danger" title="Retirer" onClick={() => onChange(list.filter((_, j) => j !== i))}>✕</button>
        </div>
      ))}
      <button className="btn small" onClick={() => onChange([...list, { target: 'might', scale: 'fixed', amount: 0 }])}>+ Issue de bataille</button>
    </div>
  );
}

/** Scènes IMPOSÉES au Round suivant si la bande matche (ids de rencontre/scène — enchaînements de bataille). */
function ChainsField({ value, onChange }: { value: string[] | undefined; onChange: (v: string[]) => void }) {
  const list = value ?? [];
  return (
    <div className="ed-subfield">
      <span>scènes enchaînées (imposées au Round suivant) — ids de rencontre/scène</span>
      {list.map((c, i) => (
        <div className="de-reflrow" key={i}>
          <input value={c} onChange={(e) => onChange(list.map((x, j) => (j === i ? e.target.value : x)))} />
          <button className="btn small danger" title="Retirer" onClick={() => onChange(list.filter((_, j) => j !== i))}>✕</button>
        </div>
      ))}
      <button className="btn small" onClick={() => onChange([...list, ''])}>+ Scène enchaînée</button>
    </div>
  );
}

/** Table d'ISSUES d'une Activité (`OutcomeBand[]`, ACE Annexe I / ADE II ch.8) : chaque bande = une
 *  fourchette de DR (`minSL`/`maxSL`, primitive de PLAGE comme mutationTables/weather) filtrée par issue
 *  (`on`) et gate de bataille (`when`), portant sa note VERBATIM, son effet `ops` (GameOpEditor commun),
 *  ses issues de bataille et ses enchaînements. Maladresse (`on:'fumble'`) REMPLACE toute autre issue. */
function OutcomeBandsField({ value, onChange }: { value: OutcomeBand[] | undefined; onChange: (v: OutcomeBand[]) => void }) {
  const list = value ?? [];
  const set = (i: number, patch: Partial<OutcomeBand>) => onChange(list.map((b, j) => (j === i ? { ...b, ...patch } : b)));
  const numOrUndef = (s: string): number | undefined => (s === '' ? undefined : Number(s));
  return (
    <div className="ed-field">
      <span>issues par Degrés de Réussite (bandes DR → résultat) — Maladresse remplace toute autre issue ; sans « issue » la bande matche par DR seul (ACE Annexe I)</span>
      {list.map((b, i) => (
        <div className="ed-subfield" key={i}>
          <div className="tf-row">
            <label className="dr">Issue
              <select value={b.on ?? ''} onChange={(e) => set(i, { on: (e.target.value || undefined) as OutcomeBand['on'] })}>
                <option value="">— toute issue —</option>
                {OUTCOME_ON_KEYS.map((o) => <option key={o} value={o}>{OUTCOME_ON_LABEL[o]}</option>)}
              </select>
            </label>
            <label className="dr">DR min<input type="number" style={{ width: 64 }} value={b.minSL ?? ''} onChange={(e) => set(i, { minSL: numOrUndef(e.target.value) })} /></label>
            <label className="dr">DR max<input type="number" style={{ width: 64 }} value={b.maxSL ?? ''} onChange={(e) => set(i, { maxSL: numOrUndef(e.target.value) })} /></label>
            <label className="dr">gate bataille
              <select value={b.when ?? ''} onChange={(e) => set(i, { when: (e.target.value || undefined) as BattleCond | undefined })}>
                <option value="">— aucun —</option>
                {BATTLE_COND_KEYS.map((c) => <option key={c} value={c}>{BATTLE_COND_LABEL[c]}</option>)}
              </select>
            </label>
            <button className="btn small danger" title="Supprimer la bande" onClick={() => onChange(list.filter((_, j) => j !== i))}>✕</button>
          </div>
          <label className="ed-subfield">note (texte de résultat VERBATIM de la source)
            <textarea rows={2} value={b.note ?? ''} onChange={(e) => set(i, { note: e.target.value || undefined })} />
          </label>
          <div className="tf-row">
            <label className="dr">résolveur (bespoke)<input value={b.resolver ?? ''} onChange={(e) => set(i, { resolver: e.target.value || undefined })} /></label>
            <label className="dr">rendu %<input type="number" style={{ width: 64 }} value={b.payoutPct ?? ''} onChange={(e) => set(i, { payoutPct: numOrUndef(e.target.value) })} /></label>
          </div>
          <div className="ed-subfield">
            <span>effet mécanique sur le Personnage (GameOp[])</span>
            <GameOpEditor ops={b.ops ?? []} onChange={(ops) => set(i, { ops: ops.length ? ops : undefined })} />
          </div>
          <BattleOutcomeListField value={b.battle} onChange={(v) => set(i, { battle: v.length ? v : undefined })} />
          <ChainsField value={b.chains} onChange={(v) => set(i, { chains: v.length ? v : undefined })} />
        </div>
      ))}
      <button className="btn small" onClick={() => onChange([...list, {}])}>+ Bande d’issue</button>
    </div>
  );
}

/** Une plage d100 d'une Table de Corruption : [min,max] → mutation référencée PAR ID (`mutations.ts` :
 *  `BY_ID.get(range.mutation)`). */
interface MutationRange { min: number; max: number; mutation: string; }

/** Éditeur des PLAGES d'une Table de Corruption (`mutationTables.json`) : chaque rangée = un intervalle d100
 *  → une mutation (sélecteur id→label, #173 — PAS le datalist par label : la donnée est un id). La table
 *  renvoie la mutation dont l'intervalle contient le jet (`findTableEntry`). DÉCOUPLÉ de la mutation :
 *  plusieurs tables (une par dieu du Chaos, Compagnon T1) peuvent pointer la même mutation à des plages
 *  différentes. */
/** Éditeur des PLAGES de Météo d'une saison (`weather.json`) : chaque rangée = un intervalle d100
 *  (jusqu'à `max` inclus, ordonné, la dernière finit à 100) → une Météo (parmi les types connus). */
function WeatherRangesField({ value, onChange }: { value: { max: number; weather: string }[] | undefined; onChange: (v: { max: number; weather: string }[]) => void }) {
  const list = value ?? [];
  const set = (i: number, patch: Partial<{ max: number; weather: string }>) => onChange(list.map((r, j) => (j === i ? { ...r, ...patch } : r)));
  const clampD100 = (s: string) => Math.max(1, Math.min(100, Number(s) || 1));
  return (
    <div className="ed-field">
      <span>plages d100 → météo (jusqu'à `max` inclus, ordonnées ; la dernière doit finir à 100)</span>
      {list.map((r, i) => (
        <div className="ed-subfield" key={i}>
          <div className="tf-row">
            <label className="dr">d100 ≤&nbsp;<input type="number" min={1} max={100} value={r.max} onChange={(e) => set(i, { max: clampD100(e.target.value) })} /></label>
            <select value={r.weather} onChange={(e) => set(i, { weather: e.target.value })}>
              {(Object.keys(WEATHER_LABEL) as (keyof typeof WEATHER_LABEL)[]).map((w) => <option key={w} value={w}>{WEATHER_LABEL[w]}</option>)}
            </select>
            <button className="btn small danger" title="Supprimer la plage" onClick={() => onChange(list.filter((_, j) => j !== i))}>✕</button>
          </div>
        </div>
      ))}
      <button className="btn small" onClick={() => onChange([...list, { max: 100, weather: 'beau' }])}>+ Plage d100</button>
    </div>
  );
}

function MutationTableField({ value, onChange }: { value: MutationRange[] | undefined; onChange: (v: MutationRange[]) => void }) {
  const list = value ?? [];
  const mutationOpts = datasetArray('mutations') as { id: string; label: string }[];
  const set = (i: number, patch: Partial<MutationRange>) => onChange(list.map((r, j) => (j === i ? { ...r, ...patch } : r)));
  const clampD100 = (s: string) => Math.max(1, Math.min(100, Number(s) || 1));
  return (
    <div className="ed-field">
      <span>plages d100 → mutation (la table renvoie la mutation dont l'intervalle contient le jet)</span>
      {list.map((r, i) => (
        <div className="ed-subfield" key={i}>
          <div className="tf-row">
            <label className="dr">d100&nbsp;<input type="number" min={1} max={100} value={r.min} onChange={(e) => set(i, { min: clampD100(e.target.value) })} />–<input type="number" min={1} max={100} value={r.max} onChange={(e) => set(i, { max: clampD100(e.target.value) })} /></label>
            <select value={r.mutation} onChange={(e) => set(i, { mutation: e.target.value })}>
              <option value="">— (choisir une mutation) —</option>
              {mutationOpts.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
            </select>
            <button className="btn small danger" title="Supprimer la plage" onClick={() => onChange(list.filter((_, j) => j !== i))}>✕</button>
          </div>
        </div>
      ))}
      <button className="btn small" onClick={() => onChange([...list, { min: 1, max: 1, mutation: mutationOpts[0]?.id ?? '' }])}>+ Plage d100</button>
    </div>
  );
}

/** Texte d'aide LDB 05 (« Détails ») : global + par espèce (HTML léger). */
interface DetailText { all: string; bySpecies: Record<string, string>; }
/** Bloc `details.texts` : 5 entrées d'aide (nom/âge/taille/Ambitions courte & longue). Clés OUVERTES
 *  (un nouveau texte ajouté à la donnée apparaît tout seul). */
type DetailsTexts = Record<string, DetailText>;

const DETAIL_TEXT_LABEL: Record<string, string> = {
  nom: 'Noms', age: 'Âge', taille: 'Taille', ambitionShort: 'Ambition (court terme)', ambitionLong: 'Ambition (long terme)',
};

/** Éditeur du bloc `details.texts` (objet `details.json`) — pour chaque entrée d'aide : un texte GLOBAL
 *  (`all`) + des surcharges PAR ESPÈCE (`bySpecies`, clés ouvertes). HTML léger autorisé (rendu via
 *  LoreText au Codex). Réutilise le motif `de-reflrow` (rangée + ✕ + « + »). Sort `texts` du repli JSON. */
function DetailsTextsField({ value, onChange }: { value: DetailsTexts | undefined; onChange: (v: DetailsTexts) => void }) {
  const texts = value ?? {};
  const EMPTY_TEXT: DetailText = { all: '', bySpecies: {} };
  const setText = (key: string, patch: Partial<DetailText>) => onChange({ ...texts, [key]: { ...EMPTY_TEXT, ...texts[key], ...patch } });
  const setSpecies = (key: string, sp: string, v: string) => setText(key, { bySpecies: { ...texts[key]?.bySpecies, [sp]: v } });
  const renameSpecies = (key: string, oldSp: string, newSp: string) => {
    const by = { ...texts[key]?.bySpecies };
    const v = by[oldSp]; delete by[oldSp]; if (newSp) by[newSp] = v ?? '';
    setText(key, { bySpecies: by });
  };
  const removeSpecies = (key: string, sp: string) => {
    const by = { ...texts[key]?.bySpecies }; delete by[sp];
    setText(key, { bySpecies: by });
  };
  return (
    <div className="ed-field">
      <span>textes d'aide de création (LDB 05 — global + surcharges par espèce, HTML léger)</span>
      {Object.keys(texts).map((key) => {
        const t = texts[key];
        return (
          <div className="ed-subfield" key={key}>
            <b>{DETAIL_TEXT_LABEL[key] ?? key}</b>
            <label className="ed-subfield">global<textarea rows={3} value={t.all} onChange={(e) => setText(key, { all: e.target.value })} /></label>
            <span className="de-hint">par espèce</span>
            {Object.keys(t.bySpecies ?? {}).map((sp) => (
              <div className="de-reflrow" key={sp}>
                <input style={{ width: 120 }} value={sp} onChange={(e) => renameSpecies(key, sp, e.target.value)} />
                <textarea rows={2} value={t.bySpecies[sp]} onChange={(e) => setSpecies(key, sp, e.target.value)} />
                <button className="btn small danger" title="Retirer l'espèce" onClick={() => removeSpecies(key, sp)}>✕</button>
              </div>
            ))}
            <button className="btn small" onClick={() => setSpecies(key, '', '')}>+ Espèce</button>
          </div>
        );
      })}
    </div>
  );
}

/** Rendu d'un champ, avec autocomplétion `<datalist>` pour les listes de références. */
function Field({ field, value, onChange }: { field: FieldDesc; value: unknown; onChange: (v: unknown) => void }) {
  const { key, kind } = field;
  const refDs = REF_LIST_DATASET[key];

  if (kind === 'stringList') {
    const list = (value as string[]) ?? [];
    const set = (next: string[]) => onChange(next);
    return (
      <div className="ed-field">
        <span>{key}{refDs && <em className="de-hint"> (autocomplétion {refDs})</em>}</span>
        {list.map((item, i) => (
          <div key={i} className="de-reflrow">
            <input value={item} list={refDs ? `dl-${refDs}` : undefined}
              onChange={(e) => set(list.map((x, j) => (j === i ? e.target.value : x)))} />
            <button className="btn small danger" onClick={() => set(list.filter((_, j) => j !== i))}>✕</button>
          </div>
        ))}
        <button className="btn small" onClick={() => set([...list, ''])}>+ Ajouter</button>
        {refDs && <RefDatalist ds={refDs} />}
      </div>
    );
  }
  if (kind === 'textarea')
    return <label className="ed-field"><span>{key}</span><textarea rows={3} value={(value as string) ?? ''} onChange={(e) => onChange(e.target.value)} /></label>;
  if (kind === 'number')
    return <label className="ed-field"><span>{key}</span><input type="number" value={value == null ? '' : (value as number)} onChange={(e) => onChange(e.target.value === '' ? (field.nullable ? null : 0) : Number(e.target.value))} /></label>;
  if (kind === 'checkbox')
    return <label className="ed-check"><input type="checkbox" checked={!!value} onChange={(e) => onChange(e.target.checked)} /><span>{key}</span></label>;
  if (kind === 'source') {
    const s = (value as { book?: string; page?: number }) ?? {};
    return <div className="ed-field"><span>{key}</span><div className="de-source"><input placeholder="livre" value={s.book ?? ''} onChange={(e) => onChange({ ...s, book: e.target.value })} /><input type="number" placeholder="page" value={s.page ?? ''} onChange={(e) => onChange({ ...s, page: Number(e.target.value) || 0 })} /></div></div>;
  }
  if (kind === 'recordNumber') {
    const rec = (value as Record<string, number | null>) ?? {};
    const keys = Object.keys(rec);
    return <div className="ed-field"><span>{key}</span>{keys.length === 0 ? <em className="de-hint">vide</em> : <div className="de-grid">{keys.map((k) => <label key={k} className="de-cell"><span>{k}</span><input type="number" value={rec[k] ?? ''} onChange={(e) => onChange({ ...rec, [k]: e.target.value === '' ? null : Number(e.target.value) })} /></label>)}</div>}</div>;
  }
  if (kind === 'recordText') return <RecordTextField label={key} value={value as Record<string, string> | undefined} onChange={onChange} />;
  if (kind === 'object') return <ObjectField label={key} value={value as Record<string, unknown> | undefined} onChange={onChange} />;
  if (kind === 'json') return <JsonField label={field.key} value={value} onChange={onChange} />;
  return <label className="ed-field"><span>{key}</span><input value={(value as string) ?? ''} onChange={(e) => onChange(field.nullable && e.target.value === '' ? null : e.target.value)} /></label>;
}

/** Record homogène clé→chaîne (couleur par espèce des yeux/cheveux, palette de couleurs d'apparence) :
 *  une rangée par clé (clé renommable + valeur), + ajout/retrait. Clés OUVERTES → un nouveau membre
 *  s'ajoute sans toucher le code. */
function RecordTextField({ label, value, onChange }: { label: string; value: Record<string, string> | undefined; onChange: (v: Record<string, string>) => void }) {
  const rec = value ?? {};
  const keys = Object.keys(rec);
  const rename = (oldK: string, newK: string) => {
    const next: Record<string, string> = {};
    for (const k of keys) next[k === oldK ? newK : k] = rec[k]; // ordre préservé
    onChange(next);
  };
  return (
    <div className="ed-field">
      <span>{label}</span>
      {keys.map((k) => (
        <div className="de-reflrow" key={k}>
          <input style={{ width: 140 }} value={k} onChange={(e) => rename(k, e.target.value)} />
          <input value={rec[k]} onChange={(e) => onChange({ ...rec, [k]: e.target.value })} />
          <button className="btn small danger" title="Retirer" onClick={() => { const next = { ...rec }; delete next[k]; onChange(next); }}>✕</button>
        </div>
      ))}
      <button className="btn small" onClick={() => onChange({ ...rec, '': '' })}>+ Entrée</button>
    </div>
  );
}

/** Objet de config hétérogène (`interludeEvents.fx`, `raceAppearance.eyes`…) : SOUS-FORMULAIRE inféré
 *  (récursif) — chaque sous-champ retrouve son kind structuré (number/checkbox/stringList/recordText/…)
 *  via le MÊME `inferFields` + `Field`. Plus de repli JSON pour les objets plats. */
function ObjectField({ label, value, onChange }: { label: string; value: Record<string, unknown> | undefined; onChange: (v: Record<string, unknown>) => void }) {
  const obj = value ?? {};
  const subFields = useMemo(() => inferFields([obj]), [obj]);
  return (
    <div className="ed-field ed-subform">
      <span>{label}</span>
      <div className="ed-subfield">
        {subFields.map((f) => (
          <Field key={f.key} field={f} value={obj[f.key]} onChange={(v) => onChange({ ...obj, [f.key]: v })} />
        ))}
      </div>
    </div>
  );
}

/** `<datalist>` des libellés d'un dataset (dé-dupliqués) — réutilise le motif SpellsField. */
function RefDatalist({ ds }: { ds: DatasetKey }) {
  const labels = useMemo(() => [...new Set((datasetArray(ds) as { label?: string }[]).map((e) => e.label).filter(Boolean))] as string[], [ds]);
  return <datalist id={`dl-${ds}`}>{labels.map((l) => <option key={l} value={l} />)}</datalist>;
}

