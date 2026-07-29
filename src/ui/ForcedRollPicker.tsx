import type { HitLocation, BodyShape } from '../engine/types';
import { locationLabel } from '../engine/combat';
import { maxForcedRoll } from '../engine/tests';
import { FIXED_ROLL_MAX } from '../engine/fixedDie';
import { OptionChooser, type RollOption } from './OptionChooser';
import { Icon } from './Icon';

/** Les 6 localisations d'un Coup Critique (ordre du tableau LDB). */
const CRIT_LOCS: HitLocation[] = ['tete', 'corps', 'brasD', 'brasG', 'jambeD', 'jambeG'];

/**
 * Grille PARTAGÉE de la localisation d'un Coup Critique FORCÉ (RAW-2, LDB 17 l.68 : sur un Critique
 * obtenu via « Je ne faillirai pas ! », le joueur CHOISIT la localisation atteinte). Un seul endroit
 * d'affichage — les modales qui en ont besoin la posent (attaque), elles ne la recopient plus. La grille
 * elle-même EST `OptionChooser layout="grid"` (source unique des grilles de boutons `.rm-loc-grid`).
 */
export function CritLocationPicker({ current, onSet, shape = 'humanoide' }: {
  current?: HitLocation | null;
  onSet: (loc: HitLocation) => void;
  /** Forme du corps de la cible → libellés de localisation adaptés (patte/aile… vs bras/jambe). */
  shape?: BodyShape;
}) {
  const options: RollOption[] = CRIT_LOCS.map((l) => ({
    key: l, label: locationLabel(l, shape), primary: current === l, onSelect: () => onSet(l),
  }));
  return (
    <div className="rm-options">
      <span className="mini-title"><Icon id="fire/flame" size="sm" /> Localisation du Coup Critique (Je ne faillirai pas !)</span>
      <OptionChooser options={options} layout="grid" />
    </div>
  );
}

/**
 * « Je ne faillirai pas ! » (LDB 17 l.68) : « au lieu de lancer les dés pour un Test, vous
 * choisissez le résultat ». Sélecteur PARTAGÉ du dé choisi d'un Test forcé par la Résilience :
 *  - 01 = le score le plus bas → DR maximum ;
 *  - 11 = le PLUS BAS double réussi → Critique au meilleur DR (l'exemple Salundra, l.70, choisit 11) ;
 *  - saisie libre ≤ cible (le choix doit RESTER une réussite) — les unités nourrissent
 *    Percutante/Dévastatrice et la localisation inversée côté attaque.
 */
export function ForcedRollPicker({ roll, target, onSet, critable = true, fixed = false, marked = false }: {
  /** `null` = RIEN n'est encore fixé (offre pré-jet) : le champ est VIDE, la valeur ne se commet qu'à la saisie. */
  roll: number | null;
  target: number;
  onSet: (roll: number) => void;
  /** Le double a un effet (Coup/Incantation Critique) → bouton « 11 · Critique ». */
  critable?: boolean;
  /** PROVENANCE « dé fixé » (option de confort, `engine/fixedDie.ts`) : aucune ressource dépensée, tout
   *  le d100 est permis (le jet saisi n'a pas à rester une réussite) — le MÊME sélecteur sert les deux. */
  fixed?: boolean;
  /** Le dé de cette rangée est DÉJÀ saisi : le champ PORTE la marque de provenance (une seule surface à
   *  l'écran — `RollRow` ne rend alors pas `.prow-fixed-mark` en plus). */
  marked?: boolean;
}) {
  // Borne : dé fixé → tout le d100 ; Résilience → ≤ cible ET hors bande d'échec auto (dérivé de la policy).
  const maxRoll = fixed ? FIXED_ROLL_MAX : maxForcedRoll(target);
  return (
    <div className="rm-die-pick">
      {!fixed && (
        <button className={`btn small ${roll === 1 ? 'btn-primary' : ''}`} title="Le score le plus bas → DR maximum" onClick={() => onSet(1)}>
          01 · DR max
        </button>
      )}
      {!fixed && critable && maxRoll >= 11 && (
        <button className={`btn small ${roll === 11 ? 'btn-primary' : ''}`} title="Le plus bas double réussi → Critique au meilleur DR" onClick={() => onSet(11)}>
          11 · Critique
        </button>
      )}
      {/* UNE surface par ÉTAT : « Fixer le dé » tant que rien n'est commis (une OFFRE), « Dé fixé » une
          fois le dé saisi (la MARQUE de provenance, sa valeur restant éditable en place). */}
      <label className="field">
        <span>{!fixed ? 'Dé choisi' : marked ? 'Dé fixé' : 'Fixer le dé'}</span>
        <input
          className="rm-die-input"
          type="number"
          min={1}
          max={maxRoll}
          value={roll ?? ''}
          placeholder="d100"
          onChange={(e) => { if (e.target.value !== '') onSet(Number(e.target.value)); }}
          title={fixed ? `Saisir la valeur du dé (1 à ${maxRoll})` : `Choisir librement la valeur du dé (1 à ${maxRoll})`}
        />
      </label>
    </div>
  );
}
