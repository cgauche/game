/**
 * Picker DEV d'une LISTE DE RÉFÉRENCES par `id` (sorts d'une créature, Bénédictions/Miracles d'un
 * dieu, Qualités d'une possession) — remplace le `<datalist>` de libellés libres : on choisit dans le
 * dataset cible, le LIBELLÉ est affiché mais l'`id` STABLE est stocké (multilangue-safe — cf.
 * [[game-ids-internes-libelles-display-multilangue]]). Les listes structurées plus riches (AdvancementRef,
 * TrappingRef, SkillRef/TalentRef) gardent l'éditeur JSON générique pour l'instant.
 */
import { useMemo } from 'react';
import { datasetArray, type DatasetKey } from '../../data/overrides';

/** Champ « liste de réf simple » → dataset cible (+ `value` = Indice éditable pour les qualités). */
export const REF_FIELD: Record<string, { ds: DatasetKey; value?: boolean }> = {
  spells: { ds: 'spells' },
  blessings: { ds: 'spells' },
  miracles: { ds: 'spells' },
  qualities: { ds: 'qualities', value: true },
  grantsManeuvers: { ds: 'maneuvers' },
};

interface RefEntry { id: string; value?: number }

export function RefField({ fieldKey, value, onChange }: { fieldKey: string; value: unknown; onChange: (v: unknown) => void }) {
  const cfg = REF_FIELD[fieldKey];
  const options = useMemo(
    () => (datasetArray(cfg.ds) as { id: string; label: string }[])
      .map((e) => ({ id: e.id, label: e.label }))
      .sort((a, b) => a.label.localeCompare(b.label)),
    [cfg.ds],
  );
  const list = (value as RefEntry[]) ?? [];
  const set = (next: RefEntry[]) => onChange(next);
  return (
    <div className="ed-field">
      <span>{fieldKey}<em className="de-hint"> (réf {cfg.ds} par id)</em></span>
      {list.map((ref, i) => (
        <div key={i} className="de-reflrow">
          <select value={ref.id} onChange={(e) => set(list.map((r, j) => (j === i ? { ...r, id: e.target.value } : r)))}>
            {!options.some((o) => o.id === ref.id) && <option value={ref.id}>{ref.id} (inconnu)</option>}
            {options.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
          </select>
          {cfg.value && (
            <input type="number" placeholder="Indice" style={{ width: 64 }} value={ref.value ?? ''}
              onChange={(e) => set(list.map((r, j) => (j === i ? { ...r, value: e.target.value === '' ? undefined : Number(e.target.value) } : r)))} />
          )}
          <button className="btn small danger" title="Retirer" onClick={() => set(list.filter((_, j) => j !== i))}>✕</button>
        </div>
      ))}
      <button className="btn small" onClick={() => set([...list, { id: options[0]?.id ?? '' }])}>+ Ajouter</button>
    </div>
  );
}
