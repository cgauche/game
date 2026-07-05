/**
 * Picker DEV de RÉFÉRENCE unifié au Codex — UN composant, 3 modes, configuré par (catégorie, champ) :
 *  - `liste`  : `Ref[]` = {id, value?} (sorts d'une créature, Bénédictions/Miracles d'un dieu, Qualités
 *               d'une possession) — choix dans le dataset cible, LIBELLÉ affiché mais `id` STABLE stocké ;
 *  - `single` : UN `<select>` (sous-type d'arme, classe d'une carrière, espèce/carrière d'un pré-tiré…) ;
 *  - `vocab`  : `<input list>` + `<datalist>` des valeurs DISTINCTES d'un champ (refChar/refCareer/subType…)
 *               → pioche OU saisie libre.
 * On stocke partout l'`id` (ou la valeur de `valueKey`) — multilangue-safe (cf.
 * [[game-ids-internes-libelles-display-multilangue]]). Le composant est « bête » : il reçoit sa `cfg`.
 */
import { useMemo } from 'react';
import { datasetArray, type DatasetKey } from '../../data/overrides';

/** Config d'un champ-réf, par (catégorie, champ). Dataset réel (liste/single) OU vocabulaire d'un champ. */
export type RefFieldCfg =
  | { ds: DatasetKey; value?: boolean; single?: boolean; valueKey?: 'id' | 'label' | 'abr'; labelOf?: 'label' | 'name'; spec?: boolean }
  | { vocabFrom: string };

/**
 * REF_FIELD — clés par `'<catégorie>.<champ>'` (priorité) ou par `'<champ>'` (repli global).
 *  - listes (comportement existant conservé) : sorts/bénédictions/miracles, qualités (Indice), manœuvres ;
 *  - single (dataset réel) : sous-type d'arme, classe, carrière (niveau/pré-tiré), parent de lieu (par
 *    label), espèce d'un pré-tiré, compétence/talent ajouté par un talent (+ spec libre) ;
 *  - vocab : caracs/carrières de référence d'une espèce, sous-type d'une qualité.
 */
export const REF_FIELD: Record<string, RefFieldCfg> = {
  // ── listes (Ref[]) — existant ───────────────────────────────────────────────
  spells: { ds: 'spells' },
  blessings: { ds: 'spells' },
  miracles: { ds: 'spells' },
  chaosSpells: { ds: 'spells' },
  qualities: { ds: 'qualities', value: true },
  grantsManeuvers: { ds: 'maneuvers' },
  // Traits conférés par une mutation (Tentacule → Arme) : `{id}` simple (≠ traits de créature qui
  // portent value/arg/range/count → éditeur de statbloc dédié). Liste de réfs par id, lossless ici.
  'mutations.traits': { ds: 'traits' },
  // ── single (dataset réel) ───────────────────────────────────────────────────
  'trappings.subType': { ds: 'weaponGroups', single: true },
  'careers.class': { ds: 'classes', single: true },
  'careerLevels.career': { ds: 'careers', single: true },
  'locations.parent': { ds: 'locations', single: true, valueKey: 'label' },
  'pregens.species': { ds: 'species', single: true },
  'pregens.career': { ds: 'careers', single: true },
  // Caractéristique d'une compétence : SÉLECTEUR (pas d'input libre) — le dataset `characteristics` n'a
  // pas d'`id`, il est keyé par `label` ; la valeur STOCKÉE lue par l'engine (CHAR_BY_LABEL) est le label
  // complet (« Dextérité ») → single-ref keyé `label`, format inchangé.
  'skills.characteristic': { ds: 'characteristics', single: true, valueKey: 'abr' },
  // ── vocab (valeurs distinctes d'un champ) ───────────────────────────────────
  // refChar/refCareer n'existent QUE sur les espèces → repli global par nom (la catégorie Codex
  // d'`species.json` est `races`, pas `species` ; un nom de champ unique évite de la coder en dur).
  refChar: { vocabFrom: 'species.refChar' },
  refCareer: { vocabFrom: 'species.refCareer' },
  'qualities.subType': { ds: 'qualitySubtypes', single: true },
  'qualities.type': { ds: 'qualityTypes', single: true },
};

/** Résout la config d'un champ : clé (catégorie, champ) puis repli global par champ. */
export function refFieldCfg(categoryKey: string, fieldKey: string): RefFieldCfg | undefined {
  return REF_FIELD[`${categoryKey}.${fieldKey}`] ?? REF_FIELD[fieldKey];
}

const isVocab = (cfg: RefFieldCfg): cfg is { vocabFrom: string } => 'vocabFrom' in cfg;

/** Libellé d'affichage d'une entrée (maladies → `name`, sinon `label`). */
const entryLabel = (e: Record<string, unknown>, labelOf: 'label' | 'name' = 'label'): string =>
  String(e[labelOf] ?? e.label ?? e.id ?? '');
/** Valeur stockée d'une entrée (lieux keyés par `label` → `label`, sinon `id`). */
const valueOf = (e: Record<string, unknown>, valueKey: 'id' | 'label' | 'abr' = 'id'): string =>
  String(e[valueKey] ?? '');

interface RefEntry { id: string; value?: number }
interface SpecRef { id: string; spec?: string }

export function RefField(
  { cfg, fieldKey, value, onChange, nullable }:
  { cfg: RefFieldCfg; categoryKey?: string; fieldKey?: string; value: unknown; onChange: (v: unknown) => void; nullable?: boolean },
) {
  if (isVocab(cfg)) return <VocabField label={fieldKey} vocabFrom={cfg.vocabFrom} value={value} onChange={onChange} nullable={nullable} />;
  if (cfg.single) return <SingleRefField label={fieldKey} cfg={cfg} value={value} onChange={onChange} nullable={nullable} />;
  return <ListRefField label={fieldKey} cfg={cfg} value={value} onChange={onChange} />;
}

/** Options triées d'un dataset (valeur stockée + libellé), pour single/liste. */
function useOptions(cfg: { ds: DatasetKey; valueKey?: 'id' | 'label' | 'abr'; labelOf?: 'label' | 'name' }) {
  return useMemo(
    () => (datasetArray(cfg.ds) as Record<string, unknown>[])
      .map((e) => ({ v: valueOf(e, cfg.valueKey), label: entryLabel(e, cfg.labelOf) }))
      .sort((a, b) => a.label.localeCompare(b.label)),
    [cfg.ds, cfg.valueKey, cfg.labelOf],
  );
}

/** Mode `single` : UN `<select>` (+ option « — (aucun) — » si nullable, option « (inconnu) » si hors liste).
 *  `spec` → un `<input>` texte à côté, on stocke `{ id, spec? }` (spec omis si vide) ; sinon la chaîne brute. */
function SingleRefField(
  { label, cfg, value, onChange, nullable }:
  { label?: string; cfg: { ds: DatasetKey; valueKey?: 'id' | 'label' | 'abr'; labelOf?: 'label' | 'name'; spec?: boolean }; value: unknown; onChange: (v: unknown) => void; nullable?: boolean },
) {
  const options = useOptions(cfg);
  const cur: SpecRef = cfg.spec
    ? (value && typeof value === 'object' ? (value as SpecRef) : { id: typeof value === 'string' ? value : '' })
    : { id: typeof value === 'string' ? value : '' };
  const id = cur.id ?? '';
  const known = id === '' || options.some((o) => o.v === id);
  const emit = (nextId: string, nextSpec?: string) => {
    if (nextId === '') { onChange(nullable ? null : ''); return; }
    if (cfg.spec) { const v: SpecRef = { id: nextId }; if (nextSpec) v.spec = nextSpec; onChange(v); }
    else onChange(nextId);
  };
  return (
    <div className="ed-field">
      <span>{label}<em className="de-hint"> (réf {cfg.ds})</em></span>
      <div className="de-reflrow">
        <select value={id} onChange={(e) => emit(e.target.value, cur.spec)}>
          {nullable && <option value="">— (aucun) —</option>}
          {!known && <option value={id}>{id} (inconnu)</option>}
          {options.map((o) => <option key={o.v} value={o.v}>{o.label}</option>)}
        </select>
        {cfg.spec && (
          <input placeholder="spec" style={{ width: 120 }} value={cur.spec ?? ''}
            onChange={(e) => emit(id, e.target.value || undefined)} />
        )}
      </div>
    </div>
  );
}

/** Mode `vocab` : `<input list>` + `<datalist>` des valeurs distinctes d'un champ `'<ds>.<champ>'`. */
function VocabField(
  { label, vocabFrom, value, onChange, nullable }:
  { label?: string; vocabFrom: string; value: unknown; onChange: (v: unknown) => void; nullable?: boolean },
) {
  const [ds, field] = vocabFrom.split('.') as [DatasetKey, string];
  const dlId = `dl-vocab-${ds}-${field}`;
  const values = useMemo(
    () => [...new Set((datasetArray(ds) as Record<string, unknown>[]).map((e) => e[field]).filter(Boolean) as string[])].sort(),
    [ds, field],
  );
  return (
    <div className="ed-field">
      <span>{label}<em className="de-hint"> (vocabulaire {ds}.{field})</em></span>
      <input list={dlId} value={(value as string) ?? ''}
        onChange={(e) => onChange(e.target.value === '' && nullable ? null : e.target.value)} />
      <datalist id={dlId}>{values.map((v) => <option key={v} value={v} />)}</datalist>
    </div>
  );
}

/** Mode `liste` (défaut) : `Ref[]` = {id, value?} — choix dans le dataset, +Ajouter / ✕, `value` (Indice) si `cfg.value`. */
function ListRefField(
  { label, cfg, value, onChange }:
  { label?: string; cfg: { ds: DatasetKey; value?: boolean; valueKey?: 'id' | 'label' | 'abr'; labelOf?: 'label' | 'name' }; value: unknown; onChange: (v: unknown) => void },
) {
  const options = useOptions(cfg);
  const list = (value as RefEntry[]) ?? [];
  const set = (next: RefEntry[]) => onChange(next);
  return (
    <div className="ed-field">
      <span>{label}<em className="de-hint"> (réf {cfg.ds} par id)</em></span>
      {list.map((ref, i) => (
        <div key={i} className="de-reflrow">
          <select value={ref.id} onChange={(e) => set(list.map((r, j) => (j === i ? { ...r, id: e.target.value } : r)))}>
            {!options.some((o) => o.v === ref.id) && <option value={ref.id}>{ref.id} (inconnu)</option>}
            {options.map((o) => <option key={o.v} value={o.v}>{o.label}</option>)}
          </select>
          {cfg.value && (
            <input type="number" placeholder="Indice" style={{ width: 64 }} value={ref.value ?? ''}
              onChange={(e) => set(list.map((r, j) => (j === i ? { ...r, value: e.target.value === '' ? undefined : Number(e.target.value) } : r)))} />
          )}
          <button className="btn small danger" title="Retirer" onClick={() => set(list.filter((_, j) => j !== i))}>✕</button>
        </div>
      ))}
      <button className="btn small" onClick={() => set([...list, { id: options[0]?.v ?? '' }])}>+ Ajouter</button>
    </div>
  );
}
