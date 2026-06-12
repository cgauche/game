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
import { woundsForSize, resizeBySteps, stepSize, SIZE_LABEL, SIZE_ORDER } from '../../engine/size';
import { bonus } from '../../engine/characteristics';
import { sizeFromTraits } from '../../state/spawn';
import { SpellsField } from './OptionalTraitsPicker';

const EXTRA: { key: 'M'; label: string; def: number }[] = [{ key: 'M', label: 'Mouvement', def: 4 }];

/** Statbloc minimal par défaut (humain de base). Blessures NON fixées → dérivées par la formule de
 *  Taille au spawn (LDB 85 ; `B` rempli = surcharge). */
export const emptyStatblock = (name = 'Profil personnalisé'): CustomStatblock => ({ name, char: { M: 4 } });

/** Clone une créature du bestiaire en statbloc éditable (base à personnaliser). */
function cloneFromCreature(label: string): CustomStatblock | null {
  const c = findCreature(label);
  if (!c) return null;
  const char: CustomStatblock['char'] = {};
  for (const [k, v] of Object.entries(c.char)) if (typeof v === 'number') (char as Record<string, number>)[k] = v;
  return {
    name: c.label,
    char,
    traits: [...(c.traits ?? [])],
    // PNJ nommés (Eusapia…) : compétences/talents/sorts de la donnée embarqués dans le clone.
    ...(c.skills.length ? { skills: [...c.skills] } : {}),
    ...(c.talents.length ? { talents: [...c.talents] } : {}),
    ...(c.spells.length ? { spells: [...c.spells] } : {}),
  };
}

export function StatblockEditor({ stat, onChange }: { stat: CustomStatblock; onChange: (s: CustomStatblock) => void }) {
  const setChar = (k: string, v: number) => onChange({ ...stat, char: { ...stat.char, [k]: v } });
  // Blessures de la formule (LDB 85), recalculées en live depuis F/E/FM + la Taille (explicite ou dérivée
  // d'un Trait « Taille (X) », sinon Moyenne) — sert de placeholder au champ « B » laissé vide.
  const size = stat.size ?? sizeFromTraits(stat.traits ?? []) ?? 'moyenne';
  const formulaWounds = woundsForSize(bonus(stat.char.F ?? 30), bonus(stat.char.E ?? 30), bonus(stat.char.FM ?? 30), size);
  /** Champ Blessures optionnel : vide → `char.B` retiré (formule au spawn) ; rempli → surcharge fixe. */
  const setB = (raw: string) => {
    const char = { ...stat.char };
    if (raw.trim() === '') delete char.B;
    else char.B = Number(raw);
    onChange({ ...stat, char });
  };
  /** « Utiliser les Tailles » (LDB 85 l.276-277) : agrandir/réduire de `steps` catégories ajuste F/E
   *  (+10/cat.) et Ag (−5/cat.) et met à jour le Trait « Taille (X) » (visible dans la liste). */
  const applyResize = (steps: number) => {
    const traits = (stat.traits ?? []).filter((t) => !/^Taille\s*\(/i.test(t));
    traits.push(`Taille (${SIZE_LABEL[stepSize(size, steps)]})`);
    onChange({ ...stat, char: resizeBySteps(stat.char, steps), traits });
  };
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
      <div className="statblock-grid">
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
        <label className="ed-subfield" title={`Blessures — laisser vide = formule par Taille (${formulaWounds}) ; remplir = surcharge fixe`}>
          B
          <input
            type="number"
            value={stat.char.B ?? ''}
            placeholder={String(formulaWounds)}
            onChange={(e) => setB(e.target.value)}
          />
        </label>
      </div>
      <div className="ed-field statblock-size">
        <span>Taille : <b>{SIZE_LABEL[size]}</b></span>
        <button type="button" onClick={() => applyResize(-1)} disabled={SIZE_ORDER[size] === 0} title="Réduire d'une catégorie (−10 F, −10 E, +5 Ag)">▼ Réduire</button>
        <button type="button" onClick={() => applyResize(1)} disabled={SIZE_ORDER[size] === 6} title="Agrandir d'une catégorie (+10 F, +10 E, −5 Ag)">Agrandir ▲</button>
        <span className="statblock-note">« Utiliser les Tailles » (LDB 85) : ±10 F/E, ∓5 Ag par catégorie</span>
      </div>
      <label className="ed-field">
        Traits (un par ligne — armement : « Arme (Épée) +7 », « À distance (Arbalète) +9 (60) » ; Taille : « Taille (Énorme) » ;
        Psychologie (LDB 21) : « Peur 3 », « Terreur 2 », « Immunité (Psychologie) », « Animosité (Elfes) », « Haine (Skavens) »,
        « Phobie (Araignées) », « Frénésie » — une Cible « (un au choix) » reste inerte jusqu'à ce qu'on la précise ici)
        <textarea
          rows={4}
          value={(stat.traits ?? []).join('\n')}
          onChange={(e) => onChange({ ...stat, traits: e.target.value.split('\n').map((s) => s.trim()).filter(Boolean) })}
        />
      </label>
      <label className="ed-field">
        Groupes (séparés par des virgules — ex. « Sigmarite, Cultiste ») : appartenances supplémentaires pour les Traits psy
        ciblés (Animosité/Haine/…). La catégorie du bestiaire (folder) est ajoutée automatiquement au spawn.
        <input
          value={(stat.groups ?? []).join(', ')}
          placeholder="auto (catégorie du bestiaire) + extras manuels"
          onChange={(e) => {
            const groups = e.target.value.split(',').map((s) => s.trim()).filter(Boolean);
            onChange({ ...stat, groups: groups.length ? groups : undefined });
          }}
        />
      </label>
      <label className="ed-field">
        Compétences (une par ligne, format livre « Compétence (Spéc) Valeur » — la valeur est le Test FINAL :
        « Langue (Magick) 63 », « Corps à corps (Base) 52 », « Esquive 48 » ; les avances sont dérivées au spawn)
        <textarea
          rows={3}
          value={(stat.skills ?? []).join('\n')}
          onChange={(e) => {
            const skills = e.target.value.split('\n').map((s) => s.trim()).filter(Boolean);
            onChange({ ...stat, skills: skills.length ? skills : undefined });
          }}
        />
      </label>
      <label className="ed-field">
        Talents (séparés par des virgules — « Magie des Arcanes (Ghur), Magie mineure, Menaçant »)
        <input
          value={(stat.talents ?? []).join(', ')}
          onChange={(e) => {
            const talents = e.target.value.split(',').map((s) => s.trim()).filter(Boolean);
            onChange({ ...stat, talents: talents.length ? talents : undefined });
          }}
        />
      </label>
      <SpellsField value={stat.spells} onChange={(spells) => onChange({ ...stat, spells })} />
      <label className="ed-field" title="LDB 78 : « soustrayez -10 et ajoutez 2d10. Une Caractéristique de 30 se traduit donc par 2d10+20. » Tirage stable au spawn (rejouable) ; Blessures recalculées par la formule.">
        <input
          type="checkbox"
          checked={stat.randomChars ?? false}
          onChange={(e) => onChange({ ...stat, randomChars: e.target.checked || undefined })}
        />{' '}
        🎲 Caractéristiques aléatoires (LDB 78 : −10 + 2d10)
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
