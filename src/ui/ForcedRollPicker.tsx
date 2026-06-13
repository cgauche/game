import { HIT_LOCATION_LABELS } from '../engine/types';
import type { HitLocation } from '../engine/types';
import { maxForcedRoll } from '../engine/tests';

/** Les 6 localisations d'un Coup Critique (ordre du tableau LDB). */
const CRIT_LOCS: HitLocation[] = ['tete', 'corps', 'brasD', 'brasG', 'jambeD', 'jambeG'];

/**
 * Grille PARTAGÉE de la localisation d'un Coup Critique FORCÉ (RAW-2, LDB 17 l.73 : sur un Critique
 * obtenu via « Je ne faillirai pas ! », le joueur CHOISIT la localisation atteinte). Un seul endroit
 * d'affichage — les modales qui en ont besoin la posent (attaque), elles ne la recopient plus.
 */
export function CritLocationPicker({ current, onSet }: {
  current?: HitLocation | null;
  onSet: (loc: HitLocation) => void;
}) {
  return (
    <div className="rm-options">
      <span className="mini-title">🔥 Localisation du Coup Critique (Je ne faillirai pas !)</span>
      <div className="rm-loc-grid">
        {CRIT_LOCS.map((l) => (
          <button key={l} className={`btn small ${current === l ? 'btn-primary' : ''}`} onClick={() => onSet(l)}>
            {HIT_LOCATION_LABELS[l]}
          </button>
        ))}
      </div>
    </div>
  );
}

/**
 * « Je ne faillirai pas ! » (LDB 17 l.73) : « au lieu de lancer les dés pour un Test, vous
 * choisissez le résultat ». Sélecteur PARTAGÉ du dé choisi d'un Test forcé par la Résilience :
 *  - 01 = le score le plus bas → DR maximum ;
 *  - 11 = le PLUS BAS double réussi → Critique au meilleur DR (l'exemple Salundra, l.75, choisit 11) ;
 *  - saisie libre ≤ cible (le choix doit RESTER une réussite) — les unités nourrissent
 *    Percutante/Dévastatrice et la localisation inversée côté attaque.
 */
export function ForcedRollPicker({ roll, target, onSet, critable = true }: {
  roll: number;
  target: number;
  onSet: (roll: number) => void;
  /** Le double a un effet (Coup/Incantation Critique) → bouton « 11 · Critique ». */
  critable?: boolean;
}) {
  const maxRoll = maxForcedRoll(target); // ≤ cible ET hors bande d'échec auto (dérivé de la policy)
  return (
    <div className="rm-options">
      <span className="mini-title">🎲 Dé choisi (Je ne faillirai pas !)</span>
      <div className="rm-loc-grid">
        <button className={`btn small ${roll === 1 ? 'btn-primary' : ''}`} title="Le score le plus bas → DR maximum" onClick={() => onSet(1)}>
          01 · DR max
        </button>
        {critable && maxRoll >= 11 && (
          <button className={`btn small ${roll === 11 ? 'btn-primary' : ''}`} title="Le plus bas double réussi → Critique au meilleur DR" onClick={() => onSet(11)}>
            11 · Critique
          </button>
        )}
        <input
          className="rm-die-input"
          type="number"
          min={1}
          max={maxRoll}
          value={roll}
          onChange={(e) => onSet(Number(e.target.value))}
          title={`Choisir librement la valeur du dé (1 à ${maxRoll})`}
        />
      </div>
    </div>
  );
}
