import { useState } from 'react';
import { ScreenShell } from '../ScreenShell';
import { Tabs, type TabItem } from '../Tabs';
import { Icon } from '../Icon';
import { MasterDetail } from '../MasterDetail';
import { MonsterPartsFields } from './MonsterPartsFields';
import { creatureSpeciesOptions } from '../../gameIso/rig/creatures';
import { creatures, creatureLabel, findCreatureById } from '../../data';
import { CHAR_KEYS, CHAR_LABELS, type CharKey } from '../../engine/types';
import type { NarratifBlock, PresetPnj } from '../../state/campaignNarratif';
import type { CreatureData } from '../../data';
import type { EntityAppearance } from '../../engine/authoringAppearance';

/**
 * Éditeur du bloc NARRATIF d'un paquet de campagne (#765) — overlay plein-champ (`ScreenShell`, même
 * coquille que la Carte du monde). L'onglet PNJ (`presetsPnj`) est ÉDITABLE (#671 lot B) ; les onglets
 * Affaires/Indices/Objets restent en lecture (leurs formulaires d'authoring sont #670/suivi). Frontière
 * RÉFÉRENCE vs NARRATIF : ces entrées référencent la règle globale PAR ID.
 */
type NarratifTab = 'affaires' | 'indices' | 'presetsPnj' | 'objets';

/** Liste des créatures globales (base d'un preset), triée par libellé — patron `Inspector.tsx`. */
const CREATURE_OPTIONS = [...creatures].map((c) => ({ id: c.id, label: c.label })).sort((a, b) => a.label.localeCompare(b.label));

/** Nom affiché d'un preset dans la liste maître : profil.label, sinon la base, sinon l'id. */
function presetName(p: PresetPnj): string {
  return p.profil?.label ?? (p.base ? creatureLabel(p.base) : undefined) ?? p.id;
}

/** Id de preset frais, non-colluant avec les ids déjà présents. */
function freshPresetId(existing: PresetPnj[]): string {
  let n = existing.length + 1;
  const has = (x: string) => existing.some((p) => p.id === x);
  while (has(`pnj-${n}`)) n++;
  return `pnj-${n}`;
}

export function NarratifEditor({ narratif, onChange, onClose }: {
  narratif: NarratifBlock;
  /** Chemin d'écriture (#671 lot B) — toute mutation de preset produit un `NarratifBlock` neuf (immutable). */
  onChange?: (n: NarratifBlock) => void;
  onClose: () => void;
}) {
  const [tab, setTab] = useState<NarratifTab>('affaires');
  const [selId, setSelId] = useState<string | null>(narratif.presetsPnj[0]?.id ?? null);

  const setPresets = (presetsPnj: PresetPnj[]) => onChange?.({ ...narratif, presetsPnj });

  const addPreset = () => {
    const id = freshPresetId(narratif.presetsPnj);
    // Base par défaut = première créature globale : garantit un preset VALIDE au round-trip
    // (`validateNarratif` refuse un preset sans base ni profil) ; l'auteur la change ensuite.
    setPresets([...narratif.presetsPnj, { id, base: CREATURE_OPTIONS[0]?.id }]);
    setSelId(id);
  };

  const removePreset = (id: string) => {
    setPresets(narratif.presetsPnj.filter((p) => p.id !== id));
    if (selId === id) setSelId(null);
  };

  const updatePreset = (id: string, patch: Partial<PresetPnj>) => {
    setPresets(narratif.presetsPnj.map((p) => (p.id === id ? { ...p, ...patch } : p)));
  };

  const renamePreset = (id: string, nextId: string) => {
    const trimmed = nextId.trim();
    // Id STABLE : refuse le vide et toute collision avec un AUTRE preset (le parse fail-fast reste la
    // garde ultime : collision avec un id global/narratif y est rejetée).
    if (!trimmed || narratif.presetsPnj.some((p) => p.id !== id && p.id === trimmed)) return;
    setPresets(narratif.presetsPnj.map((p) => (p.id === id ? { ...p, id: trimmed } : p)));
    if (selId === id) setSelId(trimmed);
  };

  const selected = narratif.presetsPnj.find((p) => p.id === selId) ?? null;

  const tabs: TabItem<NarratifTab>[] = [
    { key: 'affaires', label: 'Affaires', count: narratif.affaires.length },
    { key: 'indices', label: 'Indices', count: narratif.indices.length },
    { key: 'presetsPnj', label: 'PNJ', count: narratif.presetsPnj.length },
    { key: 'objets', label: 'Objets', count: narratif.objets.length },
  ];

  return (
    <ScreenShell
      title={<><Icon id="nav/compendium" size="sm" /> Narratif de la campagne</>}
      onClose={onClose}
      body="centered"
      tabs={<Tabs tabs={tabs} active={tab} onChange={setTab} label="Rubriques du narratif" />}
    >
      {tab === 'affaires' && (
        narratif.affaires.length === 0
          ? <p className="empty">Aucune affaire dans cette campagne.</p>
          : narratif.affaires.map((a) => (
              <div key={a.id} className="listrow">
                <span className="lr-name">{a.titre}</span>
                <span className="chip">{a.id}</span>
              </div>
            ))
      )}
      {tab === 'indices' && (
        narratif.indices.length === 0
          ? <p className="empty">Aucun indice dans cette campagne.</p>
          : narratif.indices.map((i) => (
              <div key={i.id} className="listrow">
                <span className="lr-name">{i.titre}</span>
                <span className="chip">{i.kind === 'rumeur' ? 'Rumeur' : 'Indice'}</span>
                <span className="chip">{i.id}</span>
              </div>
            ))
      )}
      {tab === 'presetsPnj' && (
        <MasterDetail
          listLabel="PNJ pré-composés"
          list={
            <>
              {narratif.presetsPnj.length === 0
                ? <p className="empty">Aucun PNJ pré-composé dans cette campagne.</p>
                : narratif.presetsPnj.map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      className={`listrow${p.id === selId ? ' is-selected' : ''}`}
                      aria-pressed={p.id === selId}
                      onClick={() => setSelId(p.id)}
                    >
                      <span className="lr-name">{presetName(p)}</span>
                      <span className="chip">{p.id}</span>
                    </button>
                  ))}
              <button type="button" className="btn small" onClick={addPreset}>
                <Icon id="ui/add" size="sm" /> Ajouter un PNJ
              </button>
            </>
          }
          detail={
            selected
              ? <PresetForm
                  preset={selected}
                  onRename={(nextId) => renamePreset(selected.id, nextId)}
                  onPatch={(patch) => updatePreset(selected.id, patch)}
                  onRemove={() => removePreset(selected.id)}
                />
              : <p className="empty">Sélectionnez un PNJ à éditer, ou ajoutez-en un.</p>
          }
        />
      )}
      {tab === 'objets' && (
        narratif.objets.length === 0
          ? <p className="empty">Aucun objet narratif dans cette campagne.</p>
          : narratif.objets.map((o) => (
              <div key={o.id} className="listrow">
                <span className="lr-name">{o.label}</span>
                <span className="chip">{o.id}</span>
              </div>
            ))
      )}
    </ScreenShell>
  );
}

/** Formulaire d'un preset de PNJ : identité + base + surcharges de caracs + apparence + portrait + source. */
function PresetForm({ preset, onRename, onPatch, onRemove }: {
  preset: PresetPnj;
  onRename: (nextId: string) => void;
  onPatch: (patch: Partial<PresetPnj>) => void;
  onRemove: () => void;
}) {
  const profil = preset.profil ?? {};
  const appearance: EntityAppearance = preset.apparence ?? {};
  const base = preset.base ? findCreatureById(preset.base) : undefined;

  /** Fusionne un patch de `profil` (retire `profil` s'il redevient vide). */
  const patchProfil = (patch: Partial<CreatureData>) => {
    const next = { ...profil, ...patch };
    onPatch({ profil: Object.keys(next).length ? next : undefined });
  };
  /** Surcharge d'une carac (vide = héritée de la base) — retire `char` s'il redevient vide. */
  const setChar = (k: CharKey, raw: string) => {
    const char = { ...(profil.char ?? {}) };
    if (raw.trim() === '') delete char[k];
    else char[k] = Number(raw);
    patchProfil({ char: Object.keys(char).length ? char : undefined });
  };
  /** Fusionne un patch d'apparence (retire `apparence` si elle redevient vide). */
  const patchAppearance = (patch: Partial<EntityAppearance>) => {
    const next = { ...appearance, ...patch };
    onPatch({ apparence: Object.keys(next).length ? next : undefined });
  };

  return (
    <div className="preset-form">
      <label className="ed-field">
        Identifiant (id stable)
        <input value={preset.id} onChange={(e) => onRename(e.target.value)} />
      </label>
      <label className="ed-field">
        Créature de base (profil de combat)
        <select value={preset.base ?? ''} onChange={(e) => onPatch({ base: e.target.value || undefined })}>
          <option value="">— aucune (profil ad hoc) —</option>
          {CREATURE_OPTIONS.map((c) => (
            <option key={c.id} value={c.id}>{c.label}</option>
          ))}
        </select>
      </label>
      <label className="ed-field">
        Nom du PNJ
        <input
          value={profil.label ?? ''}
          placeholder={base?.label ?? 'ex. Josef Quartjin'}
          onChange={(e) => patchProfil({ label: e.target.value || undefined })}
        />
      </label>
      <div className="ed-field">
        <span>Surcharges de caractéristiques (vide = héritée de la base)</span>
        <div className="statblock-grid">
          {CHAR_KEYS.map((k) => (
            <label key={k} className="ed-subfield" title={CHAR_LABELS[k]}>
              {k}
              <input
                type="number"
                value={profil.char?.[k] ?? ''}
                placeholder={base ? String(base.char[k] ?? '') : ''}
                onChange={(e) => setChar(k, e.target.value)}
              />
            </label>
          ))}
        </div>
      </div>
      <div className="ed-field">
        <span>Apparence (rig)</span>
        <label className="ed-subfield">
          Espèce
          <select value={appearance.species ?? ''} onChange={(e) => patchAppearance({ species: e.target.value || undefined })}>
            <option value="">(par défaut : Humain)</option>
            {creatureSpeciesOptions().map((o) => (
              <option key={o.id} value={o.id}>{o.label}</option>
            ))}
          </select>
        </label>
      </div>
      <MonsterPartsFields
        monster={appearance.monster}
        colors={appearance.colors}
        sex={appearance.sex}
        build={appearance.build}
        hairstyle={appearance.hairstyle}
        tenue={appearance.tenue}
        eyes={appearance.eyes}
        features={appearance.features}
        onMonster={(patch) => patchAppearance({ monster: { ...(appearance.monster ?? {}), ...patch } })}
        onColors={(patch) => patchAppearance({ colors: { ...(appearance.colors ?? {}), ...patch } })}
        onSex={(s) => patchAppearance({ sex: s })}
        onBuild={(b) => patchAppearance({ build: b })}
        onHairstyle={(id) => patchAppearance({ hairstyle: id })}
        onTenue={(c) => patchAppearance({ tenue: c })}
        onEyes={(patch) => patchAppearance({ eyes: { ...(appearance.eyes ?? {}), ...patch } })}
        onFeatures={(f) => patchAppearance({ features: f.length ? f : undefined })}
      />
      <label className="ed-field">
        Portrait (id d'illustration)
        <input
          value={preset.portrait ?? ''}
          placeholder="id du registre d'art"
          onChange={(e) => onPatch({ portrait: e.target.value || undefined })}
        />
      </label>
      <div className="ed-field">
        <span>Source</span>
        <label className="ed-subfield">
          Livre
          <input
            value={preset.source?.book ?? ''}
            onChange={(e) => {
              const book = e.target.value;
              onPatch({ source: book || preset.source?.page ? { book, page: preset.source?.page ?? 0 } : undefined });
            }}
          />
        </label>
        <label className="ed-subfield">
          Page
          <input
            type="number"
            value={preset.source?.page ?? ''}
            onChange={(e) => {
              const page = e.target.value === '' ? undefined : Number(e.target.value);
              onPatch({ source: preset.source?.book || page != null ? { book: preset.source?.book ?? '', page: page ?? 0 } : undefined });
            }}
          />
        </label>
      </div>
      <button type="button" className="btn small danger" onClick={onRemove}>
        <Icon id="ui/delete" size="sm" /> Supprimer ce PNJ
      </button>
    </div>
  );
}
