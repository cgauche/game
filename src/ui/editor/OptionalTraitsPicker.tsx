/**
 * Personnalisation d'un ennemi de rencontre référencé au BESTIAIRE (volet spawn de l'Inspector) :
 *  - aperçu du PROFIL (caractéristiques + traits fixes) — l'auteur voit ce qu'il pose ;
 *  - Traits FACULTATIFS (LDB 76 l.49 : « Traits de créature courants que vous pouvez ajouter si
 *    vous créez votre propre version ») + Traits STANDARD (LDB 76 l.28-31 : « ajoutés à la liste
 *    Facultative de toutes les créatures ») — chaque trait choisi reste une chaîne ÉDITABLE
 *    (l'auteur complète l'Indice/la Cible : « Armure 2 », « Haine (Sigmarites) ») ;
 *  - sorts connus (la donnée bestiaire n'en liste pas — choix d'auteur, datalist sur spells.json).
 */
import { CreatureData, spells, findSpell, refLabel, traits } from '../../data';
import { CHAR_KEYS } from '../../engine/types';
import { traitLabels, parseTraitInstance, formatTrait } from '../../engine/traits/dispatch';
import type { TraitInstance } from '../../engine/statEntry';

/** Traits Standard de créature (LDB 76 l.28-31) — « ajoutés à la liste Facultative de TOUTES les
 *  créatures » : dérivés de la DONNÉE (`traits.json`, drapeau `standard`), pas d'une liste en dur. */
const STANDARD_OPTIONALS = traits.filter((t) => t.standard).map((t) => t.label);

/** Aperçu lecture seule du profil du bestiaire : ligne de caractéristiques (« – » = inexistante,
 *  Schéma des Profils LDB 76) + traits fixes. */
export function CreatureProfile({ creature }: { creature: CreatureData }) {
  const cols = ['M', ...CHAR_KEYS, 'B'];
  return (
    <div className="creature-profile">
      <table>
        <thead>
          <tr>{cols.map((k) => <th key={k}>{k}</th>)}</tr>
        </thead>
        <tbody>
          <tr>
            {cols.map((k) => {
              const v = creature.char[k];
              return <td key={k}>{typeof v === 'number' ? v : '–'}</td>;
            })}
          </tr>
        </tbody>
      </table>
      <div className="creature-profile-traits">
        <b>Traits :</b> {traitLabels(creature.traits).join(', ') || '—'}
      </div>
    </div>
  );
}

export function OptionalTraitsPicker({
  creature,
  value,
  onChange,
}: {
  creature: CreatureData;
  value: TraitInstance[] | undefined;
  onChange: (v: TraitInstance[] | undefined) => void;
}) {
  const chosen = value ?? [];
  const set = (next: TraitInstance[]) => onChange(next.length ? next : undefined);
  // creature.optionals = TraitInstance[] → libellés pour les suggestions (l'édition reste en chaînes, parsées au choix).
  const optionLabels = traitLabels(creature.optionals);
  // « Tous les traits » (Mutant) n'est pas une chaîne posable telle quelle → note, pas d'option.
  const suggested = optionLabels.filter((o) => !/^tous les traits$/i.test(o));
  const allTraits = optionLabels.some((o) => /^tous les traits$/i.test(o));
  return (
    <div className="ed-field">
      Traits facultatifs (LDB 76) — éditez la chaîne pour compléter l'Indice/la Cible
      {chosen.map((t, i) => (
        <div key={i} className="trait-row">
          <input value={formatTrait(t)} onChange={(e) => set(chosen.map((x, j) => (j === i ? parseTraitInstance(e.target.value) : x)))} />
          <button className="btn small danger" title="Retirer ce trait facultatif" onClick={() => set(chosen.filter((_, j) => j !== i))}>
            ✕
          </button>
        </div>
      ))}
      <select value="" onChange={(e) => e.target.value && set([...chosen, parseTraitInstance(e.target.value)])}>
        <option value="">+ Ajouter un trait facultatif…</option>
        {suggested.length > 0 && (
          <optgroup label={`Facultatifs de ${creature.label}`}>
            {suggested.map((o) => (
              <option key={o} value={o}>{o}</option>
            ))}
          </optgroup>
        )}
        <optgroup label="Traits standard (LDB 76 : toutes créatures)">
          {STANDARD_OPTIONALS.map((o) => (
            <option key={o} value={o}>{o}</option>
          ))}
        </optgroup>
      </select>
      {allTraits && (
        <span className="hint">
          Facultatif « Tous les traits » ({creature.label}) : n'importe quel Trait peut être saisi ci-dessus.
        </span>
      )}
    </div>
  );
}

/** Sorts connus d'un ennemi (IDS de spells.json) — l'IA incante les Projectiles magiques connus
 *  (combatFlow). UX inchangée (saisie comma-text par LIBELLÉ via datalist) mais STOCKE des ids
 *  (multilangue) : affichage id→libellé (`refLabel`), saisie libellé→id (`findSpell`). Partagé :
 *  spawn `ref` (Inspector) et statbloc. */
export function SpellsField({ value, onChange }: { value: string[] | undefined; onChange: (v: string[] | undefined) => void }) {
  return (
    <label className="ed-field">
      Sorts connus (séparés par des virgules — l'IA lance les Projectiles magiques, ex. « Fléchette »)
      <input
        value={(value ?? []).map((id) => refLabel('spells', { id })).join(', ')}
        list="ed-spells-list"
        placeholder="aucun"
        onChange={(e) => {
          const list = e.target.value
            .split(',')
            .map((s) => findSpell(s.trim())?.id)
            .filter((x): x is string => !!x);
          onChange(list.length ? list : undefined);
        }}
      />
      <datalist id="ed-spells-list">
        {/* dédoublonné par libellé : spells.json répète certains noms (clés React uniques). */}
        {Array.from(new Map(spells.map((s) => [s.label, s])).values()).map((s) => (
          <option key={s.label} value={s.label}>{s.type}{s.subType ? ` — ${s.subType}` : ''}</option>
        ))}
      </datalist>
    </label>
  );
}
