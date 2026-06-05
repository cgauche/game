/**
 * Éditeur de statbloc personnalisé (profil d'ennemi défini à la main, au lieu
 * d'une créature du bestiaire). Consommé par `spawnEnemy` → `statblockToCombatant`
 * (state/spawn.ts) : nom, 10 Caractéristiques + Mouvement (M) + Blessures (B),
 * Traits (l'armement des monstres y vit : « Arme (Épée) +7 », « Mutation (…) »),
 * dégâts d'arme et Points d'Armure.
 *
 * Modèle WFRP4 : on part d'une créature de BASE du bestiaire puis on la personnalise
 * (les créatures d'aventure ne sont PAS dans le bestiaire générique → custom).
 */
import { CustomStatblock } from '../../state/scene';
import { CHAR_KEYS, CHAR_LABELS, CharKey } from '../../engine/types';
import { creatures, findCreature } from '../../data';

const EXTRA: { key: 'M' | 'B'; label: string; def: number }[] = [
  { key: 'M', label: 'Mouvement', def: 4 },
  { key: 'B', label: 'Blessures', def: 10 },
];

/** Statbloc minimal par défaut (humain de base). */
export const emptyStatblock = (name = 'Profil personnalisé'): CustomStatblock => ({ name, char: { B: 10, M: 4 } });

/** Clone une créature du bestiaire en statbloc éditable (base à personnaliser). */
function cloneFromCreature(label: string): CustomStatblock | null {
  const c = findCreature(label);
  if (!c) return null;
  const char: CustomStatblock['char'] = {};
  for (const [k, v] of Object.entries(c.char)) if (typeof v === 'number') (char as Record<string, number>)[k] = v;
  return { name: c.label, char, traits: [...(c.traits ?? [])] };
}

export function StatblockEditor({ stat, onChange }: { stat: CustomStatblock; onChange: (s: CustomStatblock) => void }) {
  const setChar = (k: string, v: number) => onChange({ ...stat, char: { ...stat.char, [k]: v } });
  return (
    <div className="statblock-editor">
      <label className="ed-field">
        Cloner une créature de base
        <select
          value=""
          onChange={(e) => {
            const base = cloneFromCreature(e.target.value);
            if (base) onChange({ ...base, name: stat.name && stat.name !== 'Profil personnalisé' ? stat.name : base.name });
          }}
        >
          <option value="">— choisir une base à personnaliser —</option>
          {creatures.map((c) => (
            <option key={c.label} value={c.label}>{c.label}</option>
          ))}
        </select>
      </label>
      <label className="ed-field">
        Nom du profil
        <input value={stat.name} onChange={(e) => onChange({ ...stat, name: e.target.value })} />
      </label>
      <div className="statblock-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '4px' }}>
        {(CHAR_KEYS as CharKey[]).map((k) => (
          <label key={k} className="ed-subfield" title={CHAR_LABELS[k]}>
            {k}
            <input type="number" value={stat.char[k] ?? 30} onChange={(e) => setChar(k, Number(e.target.value))} />
          </label>
        ))}
        {EXTRA.map(({ key, label, def }) => (
          <label key={key} className="ed-subfield" title={label}>
            {key}
            <input type="number" value={stat.char[key] ?? def} onChange={(e) => setChar(key, Number(e.target.value))} />
          </label>
        ))}
      </div>
      <label className="ed-field">
        Traits (un par ligne — ex. « Arme (Épée) +7 », « À distance (Arbalète) +9 (60) », « Mutation (Écailles épineuses) »)
        <textarea
          rows={4}
          value={(stat.traits ?? []).join('\n')}
          onChange={(e) => onChange({ ...stat, traits: e.target.value.split('\n').map((s) => s.trim()).filter(Boolean) })}
        />
      </label>
      <label className="ed-field">
        Dégâts d'arme de secours (si aucun trait d'arme, ex. +BF+4)
        <input value={stat.weaponDamage ?? ''} onChange={(e) => onChange({ ...stat, weaponDamage: e.target.value || undefined })} />
      </label>
      <label className="ed-field">
        Armure (PA uniforme)
        <input
          type="number"
          value={stat.armour ?? 0}
          onChange={(e) => onChange({ ...stat, armour: Number(e.target.value) || undefined })}
        />
      </label>
    </div>
  );
}
