import { QtyStepper } from './QtyStepper';

/**
 * CHAMP NOMBRE BORNÉ — primitive PARTAGÉE (#1279) : la saisie et le compteur, ensemble, pour poser un
 * nombre dans une plage. Moissonnée de l'étalon de la coquille de cascade (l'étape « quantité »,
 * `CascadeModal`) et composée aussi par les réglages de table des jeux de taverne.
 *
 * TROIS affordances pour UNE grandeur, et c'est le point : le CHAMP (clavier, saisie directe — d'un
 * bout à l'autre d'un 1..100, cliquer 99 fois n'est pas une affordance), le COMPTEUR (`QtyStepper`,
 * primitive canonique) pour le cran à cran, et la PLAGE DITE (une flèche éteinte sans raison est une
 * affordance morte). La borne est tenue à UN endroit (`cale`), pour les deux gestes.
 *
 * STRUCTURE de l'étalon, tenue ici : le `<label>` n'enveloppe QUE son champ (un stepper est fait de
 * boutons — les enfermer dans un label les rend cliquables par le libellé, ce qui n'est pas ce qu'un
 * libellé promet). Le libellé est donc lié au champ par `htmlFor`, et les boutons portent le leur.
 */
export function NumberField({ id, label, min, max, value, step = 1, unit, hint = true, onChange }: {
  id: string;
  label: string;
  min: number;
  max: number;
  value: number;
  /** Pas du compteur (défaut 1). */
  step?: number;
  /** Ce qui se compte, au pluriel (« points ») — AFFICHAGE. */
  unit?: string;
  /** Dire la plage sous le champ (défaut : oui). */
  hint?: boolean;
  onChange: (n: number) => void;
}) {
  const pas = Math.max(1, Math.floor(step));
  const unite = unit ? ` ${unit}` : '';
  const cale = (n: number): number => Math.max(min, Math.min(max, n));
  return (
    <div className="prow-act">
      <label className="field" htmlFor={id}>
        <span>{label}</span>
        <input
          id={id}
          type="number"
          min={min}
          max={max}
          step={pas}
          value={value}
          onChange={(e) => onChange(cale(Number(e.target.value) || min))}
        />
      </label>
      <QtyStepper
        center={<>{value}{unite}</>}
        onDec={() => onChange(cale(value - pas))}
        onInc={() => onChange(cale(value + pas))}
        decDisabled={value <= min}
        incDisabled={value >= max}
        decLabel={`Retirer ${pas}`}
        incLabel={`Ajouter ${pas}`}
      />
      {hint && <p className="hint">De {min} à {max}{unite}.</p>}
    </div>
  );
}
