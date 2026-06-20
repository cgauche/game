/**
 * Édition DEV d'une entrée du Compendium — édite la VRAIE donnée (`src/data/*.json`, app-owned).
 * Réutilise le navigateur du Compendium (cet éditeur ne vit QUE dans le panneau détail) + le motif
 * `<datalist>` d'autocomplétion (cf. SpellsField) pour les champs-références (traits/talents/sorts…
 * piochés dans leurs vrais datasets, param libre « 8 Tentacules +8 » conservé). Sauvegarde via File
 * System Access (`fsPersist`) + preview mémoire (`setDataset`).
 */
import { useEffect, useMemo, useState } from 'react';
import { datasetArray, setDataset, datasetObject, setObjectDataset, type DatasetKey, type ObjectDatasetKey } from '../../data/overrides';
import { serializeDataset } from '../../data/serialize';
import * as fs from '../../data/fsPersist';
import { inferFields, type FieldDesc } from './editFields';
import { entryKey } from './registry';
import { RefField, refFieldCfg } from './RefField';
import { MonsterPartsFields } from '../editor/MonsterPartsFields';
import { FlowEditor } from '../editor/FlowEditor';
import { GameOpEditor } from '../editor/GameOpEditor';
import type { GameOp } from '../../engine/ops';
import { JsonField } from '../editor/JsonField';
import { RACES } from '../../gameIso/rig/races';
import { CreaturePreview } from './CreaturePreview';
import type { EntityAppearance } from '../../state/scene';
import { type Flow, EMPTY_FLOW, type TriggeredEffect, type EffectTrigger } from '../../state/flow';
import type { ManeuverDef } from '../../data';
import { ATTACK_LABEL, type AttackKind } from '../../engine/creatureAttacks';
import { WeaponField } from '../editor/WeaponField';
import { PsychTraitsField } from '../editor/PsychTraitsField';
import type { Weapon } from '../../engine/types';
import type { PsychTrait } from '../../engine/psychology';
import { SymptomsField, CombatField, AdvancementRefField, TrappingRefField, CharKeysField, StarSubField, DomainEffectsField, TraitListField, HarvestField } from './StructFields';
import type { TraitInstance } from '../../engine/statEntry';
import type { DomainData } from '../../data';
import type { CharKey } from '../../engine/types';
import type { DiseaseSymptom } from '../../engine/disease';
import type { CombatFeature } from '../../engine/combatFeatures/types';
import type { AdvancementRef, TrappingRef } from '../../data';

/** Catégorie Codex → dataset éditable (source app-owned `src/data/*.json`). */
const CATEGORY_DATASET: Record<string, DatasetKey> = {
  races: 'species', careers: 'careers', characteristics: 'characteristics', classes: 'classes',
  stars: 'stars', skills: 'skills', talents: 'talents', trappings: 'trappings', weaponGroups: 'weaponGroups', qualities: 'qualities',
  etats: 'etats', maladies: 'maladies', spells: 'spells', maneuvers: 'maneuvers', creatures: 'creatures', traits: 'traits', locations: 'locations', books: 'books',
  mutations: 'mutations', mutationTables: 'mutationTables', gods: 'gods', domains: 'domains',
  // E3a : tables & gabarits éditables (catégorie Codex = clé identique au dataset).
  careerLevels: 'careerLevels', eyes: 'eyes', hairs: 'hairs', raceAppearance: 'raceAppearance',
  pregens: 'pregens', oups: 'oups', interludeEvents: 'interludeEvents', peripeties: 'peripeties',
};
/** Catégorie Codex → dataset-OBJET éditable (E3b) : pas un tableau d'entités mais UN objet de config
 *  unique (`details`) ou un Record keyé par entrée (`names`, une entrée par race). Le `mode` dit comment
 *  l'éditeur projette l'objet : `single` = édite l'objet entier ; `record` = une entrée par clé (l'item
 *  Codex porte la clé en `label`). */
const OBJECT_CATEGORY: Record<string, { ds: ObjectDatasetKey; mode: 'single' | 'record' }> = {
  details: { ds: 'details', mode: 'single' },
  names: { ds: 'names', mode: 'record' },
};
export const editableObjectDataset = (categoryKey: string): { ds: ObjectDatasetKey; mode: 'single' | 'record' } | undefined => OBJECT_CATEGORY[categoryKey];
/** Une catégorie est éditable au Codex ssi elle a un dataset tableau OU un dataset-objet. */
export const editableDataset = (categoryKey: string): DatasetKey | undefined => CATEGORY_DATASET[categoryKey];
export const isEditableCategory = (categoryKey: string): boolean => !!CATEGORY_DATASET[categoryKey] || !!OBJECT_CATEGORY[categoryKey];

/** Champ-liste (string[]) → dataset dont on propose les libellés en autocomplétion. */
const REF_LIST_DATASET: Record<string, DatasetKey> = {
  traits: 'traits', optionals: 'traits', skills: 'skills', talents: 'talents',
  spells: 'spells', trappings: 'trappings', blessings: 'spells', miracles: 'spells',
};

type Entry = Record<string, unknown>;

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
  if (['spells', 'traits', 'qualities', 'domains', 'talents', 'maneuvers'].includes(categoryKey)) add('effects');
  if (categoryKey === 'maneuvers') add(...MANEUVER_PROFILE_KEYS);
  if (['traits', 'qualities', 'mutations', 'talents'].includes(categoryKey)) add('passive');
  if (categoryKey === 'stars') add('effect', 'sub');
  if (categoryKey === 'mutationTables') add('ranges');
  if (categoryKey === 'mutations') add('psychTraits');
  if (['mutations', 'trappings'].includes(categoryKey)) add('derivedWeapon');
  if (categoryKey === 'maladies') add('symptoms');
  if (categoryKey === 'talents') add('combat');
  if (categoryKey === 'races' || categoryKey === 'careerLevels') add('skills', 'talents');
  if (categoryKey === 'classes' || categoryKey === 'careerLevels') add('trappings');
  if (categoryKey === 'careerLevels') add('characteristics');
  if (categoryKey === 'domains') add('castBonus', 'missile', 'afterCast');
  if (categoryKey === 'creatures') add('traits', 'optionals', 'harvest');
  if (categoryKey === 'details') add('texts');
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
  const src = useMemo<{ entries: Entry[]; initial: Entry; file: string; recordMode: boolean; initialKey: string; persist: (entry: Entry, key: string) => void }>(() => {
    const entries = editableEntries(categoryKey);
    if (obj) {
      const data = datasetObject(obj.ds) as Record<string, unknown>;
      const file = `${obj.ds}.json`;
      if (obj.mode === 'single')
        return { entries, initial: data as Entry, file, recordMode: false, initialKey: '', persist: (e) => setObjectDataset(obj.ds, e as never) };
      // record : une entrée par clé (le `label` du navigateur = la clé, ex. la race) ; inférence sur
      // TOUTES les valeurs (mêmes champs partout). `isNew` → clé vide à saisir dans le champ « Clé ».
      const initialKey = isNew ? '' : label;
      const initial = (data[initialKey] as Entry) ?? {};
      return {
        entries, initial, file, recordMode: true, initialKey,
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
      file: `${dsKey}.json`, recordMode: false, initialKey: '',
      persist: (e) => setDataset(dsKey, (index < 0 ? [...arr, e] : arr.map((x, i) => (i === index ? e : x))) as never),
    };
  }, [obj, categoryKey, label, isNew]); // eslint-disable-line react-hooks/exhaustive-deps

  const [entry, setEntry] = useState<Entry>(() => structuredClone(src.initial));
  const [recordKey, setRecordKey] = useState(src.initialKey);
  const [dir, setDir] = useState<FileSystemDirectoryHandle | null>(null);
  const [needsGrant, setNeedsGrant] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [msg, setMsg] = useState('');

  useEffect(() => { fs.restoreDataDir().then((r) => { if (r) { setDir(r.handle); setNeedsGrant(!r.granted); } }); }, []);
  useEffect(() => { setEntry(structuredClone(src.initial)); setRecordKey(src.initialKey); setDirty(false); setMsg(''); }, [src]); // eslint-disable-line react-hooks/exhaustive-deps

  // L'apparence (MonsterPartsFields) ET les EFFETS d'un sort (FlowEditor) ont leur éditeur dédié — on les
  // sort du formulaire générique (sinon rendus en JSON brut). Les autres champs gardent le formulaire
  // inféré. Même patron : on filtre le champ et on rend l'éditeur spécialisé. L'apparence est éditable sur
  // les créatures ET les difformités déclarées en donnée (traits / mutations → fragment `appearance`).
  const hasAppearance = categoryKey === 'creatures' || categoryKey === 'traits' || categoryKey === 'mutations';
  const isSpell = categoryKey === 'spells';
  // Porteurs d'effets DÉCLENCHÉS (mêmes `TriggeredEffect` éditables) : Traits, Atouts d'arme, Domaines
  // (riders « à la touche »…) ET Talents (Assaut féroce onHit, Frappe réactive onCharged…).
  const isTriggered = categoryKey === 'traits' || categoryKey === 'qualities' || categoryKey === 'domains' || categoryKey === 'talents';
  // Manœuvre = ENTITÉ de 1ʳᵉ classe : profil dédié + ses effets AUTHORÉS (Dégâts + États) en GameOp.
  const isManeuver = categoryKey === 'maneuvers';
  // Porteurs de modificateurs PASSIFS continus (`GameOp[]`) édités par ops (GameOpEditor), comme un sort.
  // Talents inclus (Coup puissant, Dur à cuire… ou Frénésie → grantFreeAttack, tous en `passive`).
  const isPassive = categoryKey === 'traits' || categoryKey === 'qualities' || categoryKey === 'mutations' || categoryKey === 'talents';
  // Signe astral : son EFFET de création (charMod / grantTalent) en `GameOp[]` — même éditeur que les
  // passifs, mais champ `effect` (appliqué une fois aux attributs de départ, cf. applyStarEffect).
  const isStarEffect = categoryKey === 'stars';
  // Table de Corruption : ses `ranges` (plages d100 → réf mutation) ont leur éditeur dédié.
  const isMutationTable = categoryKey === 'mutationTables';
  // Mutation : traits psy conférés (PsychTraitsField) — sorti du repli JSON.
  const isMutation = categoryKey === 'mutations';
  // Arme DÉRIVÉE (WeaponField) : portée par une Mutation (Tentacule…) OU une Possession (prothèse-arme).
  const hasDerivedWeapon = categoryKey === 'mutations' || categoryKey === 'trappings';
  // Maladie : ses `symptoms` (DiseaseSymptom[]) ont un éditeur dédié (type + sévérité + difficulté).
  const isDisease = categoryKey === 'maladies';
  // Talent : sa capacité de combat `combat` (CombatFeature : drapeaux + castingKind/attackModes/offHand).
  const hasCombat = categoryKey === 'talents';
  // Avancement (espèce / niveau de carrière) : `skills`/`talents` = AdvancementRef[] (réf/joker/choix/aléatoire).
  const hasAdvancement = categoryKey === 'races' || categoryKey === 'careerLevels';
  // Possessions de DÉPART (classe / niveau de carrière) : `trappings` = TrappingRef[] (id catalogue + quantité, ou texte).
  const hasTrappings = categoryKey === 'classes' || categoryKey === 'careerLevels';
  // Niveau de carrière : `characteristics` = CharKey[] (vocab fermé) → multi-sélection (pas de saisie libre).
  const hasCharKeys = categoryKey === 'careerLevels';
  // Étoile : `sub` = sous-fourchette d100 [min,max] (Étoile du Sorcier) → deux inputs number.
  const hasStarSub = categoryKey === 'stars';
  // Domaine de magie : `castBonus`/`missile`/`afterCast` = petits objets d'effet typés (éditeur dédié).
  const hasDomainEffects = categoryKey === 'domains';
  // Créature : `traits`/`optionals` = TraitInstance[] (réutilise `TraitListField` du StatblockEditor),
  // `harvest` = objet { rareté, dangerosité, usages } (HarvestField) → sortis du repli JSON.
  const isCreature = categoryKey === 'creatures';
  // Détails de création (objet unique `details.json`) : `texts` (5 entrées { all, bySpecies }) a son
  // éditeur dédié ; les 4 records Âge/Taille restent au formulaire générique (`recordNumber`).
  const isDetails = categoryKey === 'details';
  // Champs au formulaire GÉNÉRIQUE = tous les champs inférés SAUF ceux couverts par un éditeur dédié
  // (`dedicatedFieldKeys`, source unique partagée avec le garde-fou no-json-fields.test).
  const fields = useMemo(() => {
    const handled = dedicatedFieldKeys(categoryKey);
    return inferFields(src.entries as Record<string, unknown>[]).filter((f) => !handled.has(f.key));
  }, [src.entries, categoryKey]);
  const edit = (key: string, v: unknown) => { setEntry((e) => ({ ...e, [key]: v })); setDirty(true); };
  // En mode Record, la clé (race) ne peut pas être vide (sinon entrée fantôme) — bloque l'enregistrement.
  const canSave = dirty && (!src.recordMode || recordKey.trim().length > 0);

  const save = async () => {
    src.persist(entry, recordKey.trim()); // preview mémoire (live) — mutation en place (tableau ou objet)
    // Le texte écrit = la SOURCE entière (tableau ou objet-dataset), re-sérialisée byte-fidèle.
    const text = serializeDataset(obj ? datasetObject(obj.ds) : datasetArray(editableDataset(categoryKey)!));
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
        {fs.FS_API && !dir && <button className="btn small" onClick={() => fs.connectDataDir().then((h) => { setDir(h); setNeedsGrant(false); }).catch(() => {})}>📁 Connecter src/data…</button>}
        {fs.FS_API && dir && needsGrant && <button className="btn small" onClick={() => dir && fs.grantPermission(dir).then((ok) => ok && setNeedsGrant(false))}>Autoriser l'écriture</button>}
        {fs.FS_API && dir && !needsGrant && <span className="de-ok">📁 connecté</span>}
        <span className="de-spacer" />
        {msg && <span className="de-msg">{msg}</span>}
        <button className="btn small" onClick={onClose}>Fermer</button>
        <button className="btn small btn-primary" disabled={!canSave} onClick={save}>Enregistrer{dirty ? ' •' : ''}</button>
      </div>
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
        {isTriggered && <TriggeredEffectsField value={entry.effects as TriggeredEffect[] | undefined} onChange={(v) => edit('effects', v)} />}
        {isManeuver && <ManeuverDefField entry={entry} edit={edit} />}
        {isMutationTable && <MutationTableField value={entry.ranges as MutationRange[] | undefined} onChange={(v) => edit('ranges', v)} />}
        {hasDerivedWeapon && <WeaponField value={entry.derivedWeapon as Weapon | undefined} onChange={(v) => edit('derivedWeapon', v)} />}
        {isMutation && <PsychTraitsField value={entry.psychTraits as PsychTrait[] | undefined} onChange={(v) => edit('psychTraits', v)} />}
        {isDisease && <SymptomsField value={entry.symptoms as DiseaseSymptom[] | undefined} onChange={(v) => edit('symptoms', v)} />}
        {hasCombat && <CombatField value={entry.combat as Partial<CombatFeature> | undefined} allFeatures={src.entries.map((e) => e.combat as Partial<CombatFeature> | undefined)} onChange={(v) => edit('combat', v)} />}
        {hasAdvancement && <AdvancementRefField ds="skills" label="Compétences" value={entry.skills as AdvancementRef[] | undefined} onChange={(v) => edit('skills', v)} />}
        {hasAdvancement && <AdvancementRefField ds="talents" label="Talents" value={entry.talents as AdvancementRef[] | undefined} onChange={(v) => edit('talents', v)} />}
        {hasTrappings && <TrappingRefField value={entry.trappings as TrappingRef[] | undefined} onChange={(v) => edit('trappings', v)} />}
        {hasCharKeys && <CharKeysField value={entry.characteristics as CharKey[] | undefined} onChange={(v) => edit('characteristics', v)} />}
        {hasStarSub && <StarSubField value={entry.sub as [number, number] | undefined} onChange={(v) => edit('sub', v)} />}
        {hasDomainEffects && (
          <>
            <DomainEffectsField
              castBonus={entry.castBonus as DomainData['castBonus']}
              missile={entry.missile as DomainData['missile']}
              afterCast={entry.afterCast as DomainData['afterCast']}
              onCastBonus={(v) => edit('castBonus', v)}
              onMissile={(v) => edit('missile', v)}
              onAfterCast={(v) => edit('afterCast', v)}
            />
            <RefDatalist ds="etats" /* alimente l'autocomplétion « par État » de castBonus */ />
          </>
        )}
        {isCreature && (
          <>
            <TraitListField label="Traits" hint="(LDB 85 — armement « Arme (Épée) +7 », Psychologie « Peur 3 »…)" value={entry.traits as TraitInstance[] | undefined} onChange={(v) => edit('traits', v)} />
            <TraitListField label="Traits optionnels" hint="(LDB 76 — proposés au spawn)" value={entry.optionals as TraitInstance[] | undefined} onChange={(v) => edit('optionals', v)} />
            <HarvestField value={entry.harvest as { rarity: import('../../data').HarvestRarity; danger: import('../../data').HarvestDanger; uses: string } | undefined} onChange={(v) => edit('harvest', v)} />
          </>
        )}
        {isDetails && <DetailsTextsField value={entry.texts as DetailsTexts | undefined} onChange={(v) => edit('texts', v)} />}
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
        <input value={a.species ?? ''} list="dl-rig-species" placeholder="(déduite du nom)"
          onChange={(e) => patch({ species: e.target.value || undefined })} />
        <datalist id="dl-rig-species">{Object.keys(RACES).map((s) => <option key={s} value={s} />)}</datalist>
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

const TRIGGER_LABEL: Record<EffectTrigger, string> = {
  onHit: 'à la touche',
  onWoundLoss: 'quand le porteur perd des PB',
  onRoundStart: 'au début de son Round',
  onStartled: 'magie / bruit fort',
  onKill: 'quand il neutralise un adversaire',
  onCharged: 'quand le porteur est Chargé',
  onGainCondition: 'quand le porteur gagne un État',
  onCombatStart: 'au début du combat',
  onCombatEnd: 'à la fin du combat',
  onRoundEnd: 'à la fin du Round',
  onTurnStart: 'au début de son tour',
  onTurnEnd: 'à la fin de son tour',
};
const ON_LABEL: Record<'self' | 'victim' | 'engaged', string> = {
  self: 'le porteur lui-même',
  victim: 'la victime touchée',
  engaged: 'tous ceux Engagés avec lui',
};

/** Éditeur des EFFETS DÉCLENCHÉS (`TriggeredEffect[]`) — porté indifféremment par un Trait OU un Atout
 *  d'arme. MÊME logique authorée que les sorts : une LISTE d'effets, chacun = un DÉCLENCHEUR (sur
 *  événement) + une CIBLE + un `Flow` d'ops éditable (réutilise `FlowEditor`/`GameOpEditor`). Écrit le
 *  record `traits.json`/`qualities.json` au save → `state/triggeredEffects` les applique en jeu. */
function TriggeredEffectsField({ value, onChange }: { value: TriggeredEffect[] | undefined; onChange: (v: TriggeredEffect[]) => void }) {
  const list = value ?? [];
  const set = (i: number, patch: Partial<TriggeredEffect>) => onChange(list.map((e, j) => (j === i ? { ...e, ...patch } : e)));
  const add = () => onChange([...list, { trigger: 'onHit', on: 'victim', flow: EMPTY_FLOW }]);
  return (
    <div className="ed-field">
      <span>effets déclenchés (déclencheur → Flow d’ops, comme un sort)</span>
      {list.map((eff, i) => (
        <div className="ed-subfield trait-effect" key={i}>
          <div className="tf-row">
            <label className="dr">Déclencheur
              <select value={eff.trigger} onChange={(e) => set(i, { trigger: e.target.value as EffectTrigger })}>
                {(Object.keys(TRIGGER_LABEL) as EffectTrigger[]).map((t) => <option key={t} value={t}>{TRIGGER_LABEL[t]}</option>)}
              </select>
            </label>
            <label className="dr">Cible
              <select value={typeof eff.on === 'object' ? 'near' : eff.on} onChange={(e) => set(i, { on: e.target.value === 'near' ? { near: 'victim', radiusMeters: 2 } : e.target.value as TriggeredEffect['on'] })}>
                {(Object.keys(ON_LABEL) as ('self' | 'victim' | 'engaged')[]).map((o) => <option key={o} value={o}>{ON_LABEL[o]}</option>)}
                <option value="near">les cibles à portée (zone)</option>
              </select>
            </label>
            {typeof eff.on === 'object' && (
              <label className="dr">à ≤ <input type="number" min={1} style={{ width: '3.4em' }} value={eff.on.radiusMeters} onChange={(e) => set(i, { on: { near: (eff.on as { near: 'self' | 'victim' }).near, radiusMeters: Math.max(1, Number(e.target.value) || 1) } })} /> m de
              <select value={eff.on.near} onChange={(e) => set(i, { on: { near: e.target.value as 'self' | 'victim', radiusMeters: (eff.on as { radiusMeters: number }).radiusMeters } })}>
                <option value="victim">la victime</option>
                <option value="self">soi</option>
              </select></label>
            )}
            <button className="btn small danger" title="Supprimer l’effet" onClick={() => onChange(list.filter((_, j) => j !== i))}>✕</button>
          </div>
          <FlowEditor flow={eff.flow ?? EMPTY_FLOW} ctx={{ encounters: [], dialogues: [] }} onChange={(flow) => set(i, { flow })} />
        </div>
      ))}
      <button className="btn small" onClick={add}>+ Effet de trait</button>
    </div>
  );
}

const ACTIVATION_LABEL: Record<ManeuverDef['activation'], string> = {
  action: 'Action', free: 'Gratuite (coût d’Avantage)', charge: 'À la Charge',
};
const STAT_LABEL: Record<NonNullable<ManeuverDef['stat']>, string> = { CC: 'CC (mêlée)', CT: 'CT (distance)' };
const ADV_MODE_LABEL: Record<NonNullable<ManeuverDef['advantageMode']>, string> = {
  fixed: 'Coût fixe', variable: 'Au choix (+1 DR/Av)', all: 'Tout l’Avantage',
};
const DEFENSE_LABEL: Record<NonNullable<ManeuverDef['defense']>, string> = {
  esquive: 'Esquive', parade: 'Parade', init: 'Initiative', resist: 'Résistance (cible)', auto: 'Meilleure (auto)',
};
const TARGETING_LABEL: Record<ManeuverDef['targeting'], string> = {
  melee: 'Mêlée', ranged: 'Distance', zone: 'Zone', allFoes: 'Tous les ennemis',
};

/** Éditeur d'une MANŒUVRE (entité de 1ʳᵉ classe, `maneuvers.json`) : son PROFIL (type/activation/coût/
 *  jet/défense/ciblage/portée/magie) + ses effets AUTHORÉS (Dégâts + États en GameOp, via
 *  `TriggeredEffectsField`). Édite les champs TOP-LEVEL de `ManeuverDef` (id/label/desc/source restent
 *  au repli générique). Source UNIQUE de résolution : ces effets sont joués tels quels par `resolveManeuver`. */
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
            {(Object.keys(ACTIVATION_LABEL) as ManeuverDef['activation'][]).map((a) => <option key={a} value={a}>{ACTIVATION_LABEL[a]}</option>)}
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
            {(Object.keys(TARGETING_LABEL) as ManeuverDef['targeting'][]).map((t) => <option key={t} value={t}>{TARGETING_LABEL[t]}</option>)}
          </select>
        </label>
        <label className="dr"><input type="checkbox" checked={!!m.magic} onChange={(e) => edit('magic', e.target.checked || undefined)} /> Magique</label>
      </div>
      <div className="tf-row">
        <label className="dr">Portée<input value={m.range ?? ''} placeholder="ex. Bonus d’Endurance + 20 mètres" onChange={(e) => edit('range', e.target.value || undefined)} /></label>
        <label className="dr">Souffle/zone<input value={m.blast ?? ''} placeholder="ex. Bonus de Force mètres" onChange={(e) => edit('blast', e.target.value || undefined)} /></label>
      </div>
      <span>effets AUTHORÉS de la manœuvre (Dégâts + États, appliqués quand ELLE touche)</span>
      <TriggeredEffectsField value={m.effects} onChange={(effects) => edit('effects', effects.length ? effects : undefined)} />
    </div>
  );
}

/** Une plage d100 d'une Table de Corruption : [min,max] → mutation référencée par label. */
interface MutationRange { min: number; max: number; mutation: string; }

/** Éditeur des PLAGES d'une Table de Corruption (`mutationTables.json`) : chaque rangée = un intervalle d100
 *  → une mutation (réf par label, autocomplétée depuis le dataset `mutations`). La table renvoie la mutation
 *  dont l'intervalle contient le jet (`findTableEntry`). DÉCOUPLÉ de la mutation : plusieurs tables (une par
 *  dieu du Chaos, Compagnon T1) peuvent pointer la même mutation à des plages différentes. Réutilise
 *  `RefDatalist` (autocomplétion des labels de mutation). */
function MutationTableField({ value, onChange }: { value: MutationRange[] | undefined; onChange: (v: MutationRange[]) => void }) {
  const list = value ?? [];
  const set = (i: number, patch: Partial<MutationRange>) => onChange(list.map((r, j) => (j === i ? { ...r, ...patch } : r)));
  const clampD100 = (s: string) => Math.max(1, Math.min(100, Number(s) || 1));
  return (
    <div className="ed-field">
      <span>plages d100 → mutation (la table renvoie la mutation dont l'intervalle contient le jet)</span>
      {list.map((r, i) => (
        <div className="ed-subfield" key={i}>
          <div className="tf-row">
            <label className="dr">d100&nbsp;<input type="number" min={1} max={100} value={r.min} onChange={(e) => set(i, { min: clampD100(e.target.value) })} />–<input type="number" min={1} max={100} value={r.max} onChange={(e) => set(i, { max: clampD100(e.target.value) })} /></label>
            <input list="dl-mutations" value={r.mutation} placeholder="mutation (label)" onChange={(e) => set(i, { mutation: e.target.value })} />
            <button className="btn small danger" title="Supprimer la plage" onClick={() => onChange(list.filter((_, j) => j !== i))}>✕</button>
          </div>
        </div>
      ))}
      <RefDatalist ds="mutations" />
      <button className="btn small" onClick={() => onChange([...list, { min: 1, max: 1, mutation: '' }])}>+ Plage d100</button>
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

