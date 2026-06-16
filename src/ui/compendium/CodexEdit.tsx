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
import { FlowEditor } from '../editor/FlowEditor';
import { JsonField } from '../editor/JsonField';
import { RACES } from '../../gameIso/rig/races';
import { CreaturePreview } from './CreaturePreview';
import type { EntityAppearance } from '../../state/scene';
import { type Flow, EMPTY_FLOW, type TriggeredEffect, type EffectTrigger } from '../../state/flow';
import type { ManeuverProfile } from '../../data';
import { ATTACK_LABEL, type AttackKind } from '../../engine/creatureAttacks';

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

  // L'apparence des créatures (MonsterPartsFields) ET les EFFETS d'un sort (FlowEditor) ont leur éditeur
  // dédié — on les sort du formulaire générique (sinon rendus en JSON brut). Les autres champs gardent le
  // formulaire inféré. Même patron que `appearance` : on filtre le champ et on rend l'éditeur spécialisé.
  const isCreature = categoryKey === 'creatures';
  const isSpell = categoryKey === 'spells';
  // Porteurs d'effets DÉCLENCHÉS (mêmes `TriggeredEffect` éditables) : Traits ET Atouts d'arme.
  const isTriggered = categoryKey === 'traits' || categoryKey === 'qualities';
  const isTrait = categoryKey === 'traits'; // les Traits portent en plus un profil de MANŒUVRE éditable
  const fields = useMemo(
    () => inferFields(arr as Record<string, unknown>[]).filter(
      (f) => !(isCreature && f.key === 'appearance') && !((isSpell || isTriggered) && f.key === 'effects') && !(isTrait && f.key === 'maneuver'),
    ),
    [arr, isCreature, isSpell, isTriggered, isTrait],
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
        {isCreature && <AppearanceField name={String(entry.label ?? label)} value={entry.appearance as EntityAppearance | undefined} onChange={(v) => edit('appearance', v)} />}
        {isSpell && <SpellEffectsField value={entry.effects as Flow | undefined} onChange={(v) => edit('effects', v)} />}
        {isTriggered && <TriggeredEffectsField value={entry.effects as TriggeredEffect[] | undefined} onChange={(v) => edit('effects', v)} />}
        {isTrait && <ManeuverField value={entry.maneuver as ManeuverProfile | undefined} onChange={(v) => edit('maneuver', v)} />}
        {fields.map((f) => <Field key={f.key} field={f} value={entry[f.key]} onChange={(v) => edit(f.key, v)} />)}
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
 *  le record `spells.json` au save → l'incantation en jeu lit ces effets (runSpellFlow). `ctx` vide :
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
};
const ON_LABEL: Record<TriggeredEffect['on'], string> = {
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
              <select value={eff.on} onChange={(e) => set(i, { on: e.target.value as TriggeredEffect['on'] })}>
                {(Object.keys(ON_LABEL) as TriggeredEffect['on'][]).map((o) => <option key={o} value={o}>{ON_LABEL[o]}</option>)}
              </select>
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

const ACTIVATION_LABEL: Record<ManeuverProfile['activation'], string> = {
  action: 'Action', free: 'Gratuite (coût d’Avantage)', charge: 'À la Charge',
};

/** Éditeur du PROFIL de MANŒUVRE d'un trait (`TraitData.maneuver`, ex-table `RULES`) + ses effets onHit
 *  propres (réutilise `TriggeredEffectsField`). Active/désactive la manœuvre ; profil = type/activation/
 *  coût d'Avantage + drapeaux de résolution ; effets = Flow d'ops appliqués quand LA manœuvre touche. */
function ManeuverField({ value, onChange }: { value: ManeuverProfile | undefined; onChange: (v: ManeuverProfile | undefined) => void }) {
  if (!value) return (
    <div className="ed-field">
      <label className="dr"><input type="checkbox" checked={false} onChange={() => onChange({ kind: 'arme', activation: 'free', advantageCost: 1 })} /> ce trait est une MANŒUVRE (attaque naturelle activée)</label>
    </div>
  );
  const m = value;
  const patch = (p: Partial<ManeuverProfile>) => onChange({ ...m, ...p });
  return (
    <div className="ed-field ed-maneuver">
      <label className="dr"><input type="checkbox" checked onChange={() => onChange(undefined)} /> MANŒUVRE de combat</label>
      <div className="tf-row">
        <label className="dr">Type
          <select value={m.kind} onChange={(e) => patch({ kind: e.target.value as AttackKind })}>
            {(Object.keys(ATTACK_LABEL) as AttackKind[]).map((k) => <option key={k} value={k}>{ATTACK_LABEL[k]}</option>)}
          </select>
        </label>
        <label className="dr">Activation
          <select value={m.activation} onChange={(e) => patch({ activation: e.target.value as ManeuverProfile['activation'] })}>
            {(Object.keys(ACTIVATION_LABEL) as ManeuverProfile['activation'][]).map((a) => <option key={a} value={a}>{ACTIVATION_LABEL[a]}</option>)}
          </select>
        </label>
        <label className="dr">Coût d’Avantage<input type="number" min={0} value={m.advantageCost} onChange={(e) => patch({ advantageCost: Math.max(0, Number(e.target.value) || 0) })} /></label>
        <label className="dr"><input type="checkbox" checked={!!m.aoe} onChange={(e) => patch({ aoe: e.target.checked || undefined })} /> Zone</label>
        <label className="dr"><input type="checkbox" checked={!!m.magic} onChange={(e) => patch({ magic: e.target.checked || undefined })} /> Magique</label>
        <label className="dr"><input type="checkbox" checked={!!m.perTentacle} onChange={(e) => patch({ perTentacle: e.target.checked || undefined })} /> Par tentacule</label>
      </div>
      <span>effets PROPRES à la manœuvre (appliqués quand ELLE touche)</span>
      <TriggeredEffectsField value={m.effects} onChange={(effects) => patch({ effects: effects.length ? effects : undefined })} />
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
  if (kind === 'json') return <JsonField label={field.key} value={value} onChange={onChange} />;
  return <label className="ed-field"><span>{key}</span><input value={(value as string) ?? ''} onChange={(e) => onChange(field.nullable && e.target.value === '' ? null : e.target.value)} /></label>;
}

/** `<datalist>` des libellés d'un dataset (dé-dupliqués) — réutilise le motif SpellsField. */
function RefDatalist({ ds }: { ds: DatasetKey }) {
  const labels = useMemo(() => [...new Set((datasetArray(ds) as { label?: string }[]).map((e) => e.label).filter(Boolean))] as string[], [ds]);
  return <datalist id={`dl-${ds}`}>{labels.map((l) => <option key={l} value={l} />)}</datalist>;
}

