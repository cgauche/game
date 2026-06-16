/**
 * Éditeur RÉUTILISABLE d'une liste de `PsychTrait` (traits psychologiques conférés — Frénésie d'une
 * mutation, Animosité(Elfes), Phobie(Serpents)…). Édite les vrais `PsychTrait` ({type, cible?, indice?}).
 * Source UNIQUE des libellés de type psy (cf. `PsychType`).
 */
import type { PsychTrait, PsychType } from '../../engine/psychology';

const PSYCH_TYPES: PsychType[] = ['peur', 'terreur', 'frenesie', 'animosite', 'haine', 'prejuge', 'amour', 'camaraderie', 'phobie', 'trauma'];
const PSYCH_LABEL: Record<PsychType, string> = {
  peur: 'Peur', terreur: 'Terreur', frenesie: 'Frénésie', animosite: 'Animosité', haine: 'Haine',
  prejuge: 'Préjugé', amour: 'Amour', camaraderie: 'Camaraderie', phobie: 'Phobie', trauma: 'Trauma',
};
/** Types CIBLÉS (Animosité(Elfes)…) / À INDICE (Peur 2) — pour n'afficher les champs que quand utiles. */
const TARGETED = new Set<PsychType>(['animosite', 'haine', 'prejuge', 'amour', 'camaraderie', 'phobie']);
const INDEXED = new Set<PsychType>(['peur', 'terreur', 'phobie']);

export function PsychTraitsField({ value, onChange }: { value: PsychTrait[] | undefined; onChange: (v: PsychTrait[] | undefined) => void }) {
  const list = value ?? [];
  const set = (next: PsychTrait[]) => onChange(next.length ? next : undefined);
  const upd = (i: number, p: Partial<PsychTrait>) => set(list.map((t, j) => (j === i ? { ...t, ...p } : t)));
  return (
    <div className="ed-field">
      <span>Traits psychologiques conférés (Frénésie, Animosité, Phobie…)</span>
      {list.map((t, i) => (
        <div className="tf-row" key={i}>
          <select value={t.type} onChange={(e) => upd(i, { type: e.target.value as PsychType })}>
            {PSYCH_TYPES.map((p) => <option key={p} value={p}>{PSYCH_LABEL[p]}</option>)}
          </select>
          {TARGETED.has(t.type) && (
            <input placeholder="cible (Elfes, Serpents…)" value={t.cible ?? ''} onChange={(e) => upd(i, { cible: e.target.value || undefined })} />
          )}
          {INDEXED.has(t.type) && (
            <label className="dr">Indice<input type="number" min={0} value={t.indice ?? ''} onChange={(e) => upd(i, { indice: e.target.value === '' ? undefined : Math.max(0, Number(e.target.value) || 0) })} /></label>
          )}
          <button className="btn small danger" title="Retirer" onClick={() => set(list.filter((_, j) => j !== i))}>✕</button>
        </div>
      ))}
      <button className="btn small" onClick={() => set([...list, { type: 'frenesie' }])}>+ Trait psy</button>
    </div>
  );
}
