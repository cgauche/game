/**
 * Édition DEV d'une entrée du Compendium — édite la VRAIE donnée (`src/data/*.json`, app-owned).
 * Réutilise le navigateur du Compendium (cet éditeur ne vit QUE dans le panneau détail) + le motif
 * `<datalist>` d'autocomplétion (cf. SpellsField) pour les champs-références (traits/talents/sorts…
 * piochés dans leurs vrais datasets, param libre « 8 Tentacules +8 » conservé). Sauvegarde via File
 * System Access (`fsPersist`) + preview mémoire (`setDataset`).
 */
import { useEffect, useMemo, useState } from 'react';
import { datasetArray, setDataset, type DatasetKey } from '../../data/overrides';
import { serializeDataset } from '../../data/serialize';
import * as fs from '../../data/fsPersist';
import { inferFields, type FieldDesc } from './editFields';
import { MonsterPartsFields } from '../editor/MonsterPartsFields';
import { RACES } from '../../gameIso/rig/races';
import type { EntityAppearance } from '../../state/scene';

/** Catégorie Codex → dataset éditable. `gods` (cultes générés) absent = non éditable en v1. */
const CATEGORY_DATASET: Record<string, DatasetKey> = {
  races: 'species', careers: 'careers', characteristics: 'characteristics', classes: 'classes',
  stars: 'stars', skills: 'skills', talents: 'talents', trappings: 'trappings', qualities: 'qualities',
  etats: 'etats', spells: 'spells', creatures: 'creatures', traits: 'traits', locations: 'locations', books: 'books',
};
export const editableDataset = (categoryKey: string): DatasetKey | undefined => CATEGORY_DATASET[categoryKey];

/** Champ-liste (string[]) → dataset dont on propose les libellés en autocomplétion. */
const REF_LIST_DATASET: Record<string, DatasetKey> = {
  traits: 'traits', optionals: 'traits', skills: 'skills', talents: 'talents',
  spells: 'spells', trappings: 'trappings', blessings: 'spells', miracles: 'spells',
};

type Entry = Record<string, unknown>;

export function CodexEdit({ categoryKey, label, onClose }: { categoryKey: string; label: string; onClose: () => void }) {
  const dsKey = editableDataset(categoryKey)!;
  const arr = datasetArray(dsKey) as Entry[];
  const index = useMemo(() => arr.findIndex((e) => e.label === label), [arr, label]);
  const [entry, setEntry] = useState<Entry>(() => structuredClone(arr[index] ?? {}));
  const [dir, setDir] = useState<FileSystemDirectoryHandle | null>(null);
  const [needsGrant, setNeedsGrant] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [msg, setMsg] = useState('');

  useEffect(() => { fs.restoreDataDir().then((r) => { if (r) { setDir(r.handle); setNeedsGrant(!r.granted); } }); }, []);
  useEffect(() => { setEntry(structuredClone(arr[index] ?? {})); setDirty(false); setMsg(''); }, [index, dsKey]); // eslint-disable-line react-hooks/exhaustive-deps

  // L'apparence des créatures a son éditeur dédié (MonsterPartsFields) — on la sort du formulaire
  // générique (sinon rendue en JSON brut). Les autres datasets gardent le formulaire inféré.
  const isCreature = categoryKey === 'creatures';
  const fields = useMemo(
    () => inferFields(arr as Record<string, unknown>[]).filter((f) => !(isCreature && f.key === 'appearance')),
    [arr, isCreature],
  );
  const edit = (key: string, v: unknown) => { setEntry((e) => ({ ...e, [key]: v })); setDirty(true); };

  const save = async () => {
    const next = arr.map((e, i) => (i === index ? entry : e));
    setDataset(dsKey, next as never); // preview mémoire (live)
    const file = `${dsKey}.json`;
    const text = serializeDataset(next);
    try {
      if (fs.FS_API && dir && !needsGrant) { await fs.writeFile(dir, file, text); setMsg(`Enregistré ${file} — Vite recharge…`); }
      else { fs.downloadFallback(file, text); setMsg(`Téléchargé ${file} — reposez-le dans src/data/`); }
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
        <button className="btn small btn-primary" disabled={!dirty} onClick={save}>Enregistrer{dirty ? ' •' : ''}</button>
      </div>
      <div className="codex-edit-form">
        {isCreature && <AppearanceField value={entry.appearance as EntityAppearance | undefined} onChange={(v) => edit('appearance', v)} />}
        {fields.map((f) => <Field key={f.key} field={f} value={entry[f.key]} onChange={(v) => edit(f.key, v)} />)}
      </div>
    </div>
  );
}

/** Éditeur d'apparence par défaut d'une créature (bloc `appearance` UNIFIÉ) — réutilise la brique
 *  partagée `MonsterPartsFields` (espèce + parts/couleurs/coiffure/tenue/yeux). Édite le VRAI record
 *  `creatures.json` ; le rig le lit comme couche de défaut → l'apparence en jeu reflète l'édition. */
function AppearanceField({ value, onChange }: { value: EntityAppearance | undefined; onChange: (v: EntityAppearance) => void }) {
  const a = value ?? {};
  const patch = (p: Partial<EntityAppearance>) => onChange({ ...a, ...p });
  return (
    <div className="ed-field ed-appearance">
      <span>apparence par défaut (rig) — éditée sur le record, reflétée en jeu</span>
      <label className="ed-subfield">
        Espèce
        <input value={a.species ?? ''} list="dl-rig-species" placeholder="(déduite du nom)"
          onChange={(e) => patch({ species: e.target.value || undefined })} />
        <datalist id="dl-rig-species">{Object.keys(RACES).map((s) => <option key={s} value={s} />)}</datalist>
      </label>
      <MonsterPartsFields
        monster={a.monster} colors={a.colors} sex={a.sex} build={a.build} parts={a.parts} tenue={a.tenue} eyes={a.eyes}
        onMonster={(p) => patch({ monster: { ...(a.monster ?? {}), ...p } })}
        onColors={(p) => patch({ colors: { ...(a.colors ?? {}), ...p } })}
        onSex={(s) => patch({ sex: s })}
        onBuild={(b) => patch({ build: b })}
        onParts={(p) => patch({ parts: { ...(a.parts ?? {}), ...p } })}
        onTenue={(c) => patch({ tenue: c })}
        onEyes={(p) => patch({ eyes: { ...(a.eyes ?? {}), ...p } })}
      />
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
  if (kind === 'json') return <JsonField field={field} value={value} onChange={onChange} />;
  return <label className="ed-field"><span>{key}</span><input value={(value as string) ?? ''} onChange={(e) => onChange(field.nullable && e.target.value === '' ? null : e.target.value)} /></label>;
}

/** `<datalist>` des libellés d'un dataset (dé-dupliqués) — réutilise le motif SpellsField. */
function RefDatalist({ ds }: { ds: DatasetKey }) {
  const labels = useMemo(() => [...new Set((datasetArray(ds) as { label?: string }[]).map((e) => e.label).filter(Boolean))] as string[], [ds]);
  return <datalist id={`dl-${ds}`}>{labels.map((l) => <option key={l} value={l} />)}</datalist>;
}

function JsonField({ field, value, onChange }: { field: FieldDesc; value: unknown; onChange: (v: unknown) => void }) {
  const [raw, setRaw] = useState(() => JSON.stringify(value ?? null, null, 2));
  const [err, setErr] = useState(false);
  return (
    <label className="ed-field"><span>{field.key} <em className="de-hint">(JSON)</em></span>
      <textarea rows={4} className={err ? 'de-invalid' : ''} value={raw}
        onChange={(e) => { setRaw(e.target.value); try { onChange(JSON.parse(e.target.value)); setErr(false); } catch { setErr(true); } }} />
    </label>
  );
}
