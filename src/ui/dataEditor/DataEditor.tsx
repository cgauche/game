/**
 * Éditeur de données DEV — édite la VRAIE base (`src/data/*.json`), source canonique app-owned.
 * 3 volets : rail des datasets · liste filtrable des entrées · formulaire (champs inférés). Sauvegarde
 * via File System Access (écrit le fichier → Vite recharge) ; repli téléchargement si l'API manque.
 * Mute aussi la façade en mémoire (`setDataset`) pour une preview immédiate.
 */
import { useEffect, useMemo, useState } from 'react';
import { useGame } from '../../state/store';
import { DATASET_KEYS, datasetArray, setDataset, type DatasetKey } from '../../data/overrides';
import { serializeDataset } from '../../data/serialize';
import * as fs from '../../data/fsPersist';
import { inferFields, defaultFor } from './fieldSchema';
import { FieldRenderer } from './FieldRenderer';

const LABELS: Record<DatasetKey, string> = {
  characteristics: 'Caractéristiques', species: 'Espèces', classes: 'Classes', careers: 'Carrières',
  careerLevels: 'Niveaux de carrière', skills: 'Compétences', talents: 'Talents', etats: 'États',
  traits: 'Traits', qualities: 'Qualités', trappings: 'Possessions', creatures: 'Créatures',
  spells: 'Sorts', eyes: 'Yeux', hairs: 'Cheveux', stars: 'Étoiles', locations: 'Lieux', books: 'Livres',
};

type Entry = Record<string, unknown>;
const labelOf = (e: Entry): string => String(e.label ?? e.abr ?? '(sans label)');

export function DataEditor() {
  const setScreen = useGame((s) => s.setScreen);
  const [dir, setDir] = useState<FileSystemDirectoryHandle | null>(null);
  const [needsGrant, setNeedsGrant] = useState(false);
  const [dsKey, setDsKey] = useState<DatasetKey>(() => (sessionStorage.getItem('de.ds') as DatasetKey) || 'etats');
  const [entries, setEntries] = useState<Entry[]>([]);
  const [sel, setSel] = useState(0);
  const [filter, setFilter] = useState('');
  const [dirty, setDirty] = useState(false);
  const [msg, setMsg] = useState('');

  useEffect(() => { fs.restoreDataDir().then((r) => { if (r) { setDir(r.handle); setNeedsGrant(!r.granted); } }); }, []);

  useEffect(() => {
    setEntries(structuredClone(datasetArray(dsKey)) as Entry[]);
    setSel(0); setDirty(false); setMsg(''); sessionStorage.setItem('de.ds', dsKey);
  }, [dsKey]);

  // Champs inférés une fois par dataset (et au changement de nombre d'entrées).
  const fields = useMemo(() => inferFields(entries), [dsKey, entries.length]);
  const shown = useMemo(
    () => entries.map((e, i) => ({ e, i })).filter(({ e }) => labelOf(e).toLowerCase().includes(filter.toLowerCase())),
    [entries, filter],
  );

  const editField = (key: string, v: unknown) => {
    setEntries((es) => es.map((e, i) => (i === sel ? { ...e, [key]: v } : e)));
    setDirty(true);
  };
  const addEntry = () => {
    const blank: Entry = {};
    for (const f of fields) blank[f.key] = defaultFor(f.kind);
    blank.label = 'Nouveau';
    setEntries((es) => [...es, blank]);
    setSel(entries.length); setDirty(true);
  };
  const dupEntry = () => {
    if (!entries[sel]) return;
    const c = structuredClone(entries[sel]); c.label = labelOf(c) + ' (copie)';
    setEntries((es) => [...es.slice(0, sel + 1), c, ...es.slice(sel + 1)]);
    setSel(sel + 1); setDirty(true);
  };
  const delEntry = () => {
    if (!entries[sel]) return;
    setEntries((es) => es.filter((_, i) => i !== sel));
    setSel((s) => Math.max(0, s - 1)); setDirty(true);
  };

  const connect = async () => { try { const h = await fs.connectDataDir(); setDir(h); setNeedsGrant(false); } catch { /* annulé */ } };
  const grant = async () => { if (dir && (await fs.grantPermission(dir))) setNeedsGrant(false); };
  const save = async () => {
    const text = serializeDataset(entries);
    setDataset(dsKey, entries as never); // preview mémoire
    const file = `${dsKey}.json`;
    try {
      if (fs.FS_API && dir && !needsGrant) { await fs.writeFile(dir, file, text); setMsg(`Enregistré ${file} — rechargement Vite…`); }
      else { fs.downloadFallback(file, text); setMsg(`Téléchargé ${file} — reposez-le dans src/data/`); }
      setDirty(false);
    } catch (e) { setMsg(`Échec écriture : ${String(e)}`); }
  };

  const cur = entries[sel];
  return (
    <div className="data-editor">
      <header className="bar de-bar">
        <button className="btn" onClick={() => setScreen('menu')}>← Menu</button>
        <strong>Éditeur de données</strong>
        {!fs.FS_API && <span className="de-warn">FS Access indisponible — sauvegarde par téléchargement</span>}
        {fs.FS_API && !dir && <button className="btn" onClick={connect}>Connecter src/data…</button>}
        {fs.FS_API && dir && needsGrant && <button className="btn" onClick={grant}>Autoriser l'écriture</button>}
        {fs.FS_API && dir && !needsGrant && <span className="de-ok">📁 connecté</span>}
        <span className="de-spacer" />
        {msg && <span className="de-msg">{msg}</span>}
        <button className="btn btn-primary" disabled={!dirty} onClick={save}>Enregistrer{dirty ? ' •' : ''}</button>
      </header>
      <div className="de-body">
        <nav className="de-rail">
          {DATASET_KEYS.map((k) => (
            <button key={k} className={`de-ds ${k === dsKey ? 'active' : ''}`} onClick={() => setDsKey(k)}>
              {LABELS[k]} <em>{datasetArray(k).length}</em>
            </button>
          ))}
        </nav>
        <section className="de-list">
          <input className="de-filter" placeholder="Filtrer…" value={filter} onChange={(e) => setFilter(e.target.value)} />
          <div className="de-rows">
            {shown.map(({ e, i }) => (
              <button key={i} className={`listrow ${i === sel ? 'active' : ''}`} onClick={() => setSel(i)}>{labelOf(e)}</button>
            ))}
          </div>
          <div className="de-actions">
            <button className="btn" onClick={addEntry}>+ Ajouter</button>
            <button className="btn" onClick={dupEntry} disabled={!cur}>Dupliquer</button>
            <button className="btn" onClick={delEntry} disabled={!cur}>Supprimer</button>
          </div>
        </section>
        <section className="de-form" key={`${dsKey}:${sel}`}>
          {cur
            ? fields.map((f) => <FieldRenderer key={f.key} field={f} value={cur[f.key]} onChange={(v) => editField(f.key, v)} />)
            : <p className="de-empty">Aucune entrée — ajoutez-en une.</p>}
        </section>
      </div>
    </div>
  );
}
