import { NumberField } from './NumberField';

/** La fourchette telle que la donnée la porte (`plageSchema` / `plageOuverteSchema`,
 *  `src/data/schemas/grammaire/valeurs.ts`) — `max: null` = bande FINALE sans plafond. */
export interface PlageValue {
  min: number;
  max: number | null;
}

/**
 * DOMAINE de la fourchette : ce sur quoi la table est tirée ou mesurée. C'est un fait de la TABLE
 * (le dé qu'elle nomme, l'unité de sa colonne), pas de ce composant — le site le passe, tiré de la
 * donnée ou de la déclaration du champ. `nom` s'affiche à côté du libellé (« 1d10 », « d100 »,
 * « mètres »), `min`/`max` bornent la saisie (absents = saisie non bornée).
 */
export interface PlageDomaine {
  nom?: string;
  min?: number;
  max?: number;
}

export interface PlageFieldProps {
  /** Libellé FR du champ (`sub` → « Sous-tirage ») — l'appelant le tient de la méta du def. */
  label: string;
  value: PlageValue | undefined;
  /** `undefined` n'est émis que si `optionnelle` : c'est le champ ABSENT. */
  onChange: (v: PlageValue | undefined) => void;
  domaine?: PlageDomaine;
  /** La bande peut n'avoir AUCUN plafond (`max: null`, « et plus ») — une case le dit. */
  ouvrable?: boolean;
  /** Le champ peut être ABSENT (une entrée sans sous-tirage) — une case le dit. */
  optionnelle?: boolean;
  /** Ce que la case d'activation nomme quand `optionnelle` (défaut : le libellé). */
  activation?: string;
}

/** Valeur posée quand une fourchette s'active sans en avoir eu : la borne basse du domaine, ou 1. */
const depart = (d: PlageDomaine | undefined): PlageValue => ({ min: d?.min ?? 1, max: d?.min ?? 1 });

/**
 * FOURCHETTE ÉDITABLE — primitive PARTAGÉE de la paire de bornes (#1659) : DEUX bornes inclusives,
 * la forme unique que `findTableEntry` (`src/engine/tables.ts`) lit et que la grammaire déclare
 * (`plageSchema` / `plageOuverteSchema`). UNE fourchette éditable pour tout le dépôt, et elle sert
 * les trois populations mesurées : sous-tirage astral (1d10), taille de coque (mètres, bande finale
 * ouverte), disponibilité saisonnière (d100).
 *
 * Elle COMPOSE `NumberField` (primitive « Champ NOMBRE ») en variante `nu`, `commit: 'geste'` : une
 * saisie hors domaine est REFUSÉE et le domaine rendu apparent, jamais calée en silence — les deux
 * bornes d'une bande de table décident d'un tirage, les caler ferait un trou muet dans la table.
 *
 * Le DOMAINE (le dé, l'unité, les bornes de saisie) vient du site, qui le tient de la donnée ou du
 * def : ce composant n'en connaît aucun.
 */
export function PlageField({ label, value, onChange, domaine, ouvrable, optionnelle, activation }: PlageFieldProps) {
  // Une fourchette REQUISE s'édite dès l'entrée NEUVE : sans valeur, le champ montre la borne basse
  // du domaine plutôt que RIEN — un champ absent rendrait la cargaison ou la taille de coque neuve
  // inauthorables (règle stricte 2). Seule `optionnelle` a un état « absent », et il se coche.
  const courante = value ?? (optionnelle ? undefined : depart(domaine));
  const presente = courante != null;
  const ouverte = courante?.max === null;
  const bornes = { min: domaine?.min, max: domaine?.max };
  const poser = (v: Partial<PlageValue>) => onChange({ ...(courante ?? depart(domaine)), ...v });
  return (
    <div className="ed-field">
      <span>{label}{domaine?.nom ? ` — ${domaine.nom}` : ''}</span>
      <div className="tf-row">
        {optionnelle && (
          <label className="dr">
            <input
              type="checkbox"
              checked={presente}
              onChange={(e) => onChange(e.target.checked ? (courante ?? depart(domaine)) : undefined)}
            />
            {' '}{activation ?? label}
          </label>
        )}
        {presente && (
          <>
            <label className="dr">
              de{' '}
              <NumberField
                variant="nu"
                commit="geste"
                label={`${label} — borne basse`}
                min={bornes.min}
                max={bornes.max}
                value={courante.min}
                onChange={(n) => poser({ min: n })}
              />
            </label>
            {ouverte ? (
              <span className="hint">et plus</span>
            ) : (
              <label className="dr">
                à{' '}
                <NumberField
                  variant="nu"
                  commit="geste"
                  label={`${label} — borne haute`}
                  min={bornes.min}
                  max={bornes.max}
                  value={courante.max ?? courante.min}
                  onChange={(n) => poser({ max: n })}
                />
              </label>
            )}
            {ouvrable && (
              <label className="dr">
                <input
                  type="checkbox"
                  checked={ouverte}
                  onChange={(e) => poser({ max: e.target.checked ? null : (domaine?.max ?? courante.min) })}
                />
                {' '}sans plafond
              </label>
            )}
          </>
        )}
      </div>
    </div>
  );
}
