import type { HitLocation, BodyShape } from '../engine/types';
import { useRef, useState } from 'react';
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
export function ForcedRollPicker({ roll, target, onSet, critable = true, fixed = false, marked = false, max, mod = 0, effective, commitOnBlur = true }: {
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
  /** Faces du dé de CE tirage quand elles ne sont pas le d100 (tirage sur table à d10/d20…) : la borne
   *  du champ. Absent = d100. Le champ REFUSE une valeur hors domaine plutôt que de la ramener en
   *  silence (une saisie ramenée est une valeur menteuse : le joueur lit 47, le moteur applique 10). */
  max?: number;
  /** Modificateur appliqué au dé SAISI pour obtenir le dé EFFECTIF (celui qui résout : `roll + mod`,
   *  ex. −20 d'overkill sur le Tableau des Critiques). Présent et non nul → le champ AFFICHE l'effectif
   *  à côté de la saisie : sans lui le joueur lirait 76 là où le moteur applique 56 — la même classe de
   *  valeur menteuse que la borne ci-dessus. */
  mod?: number;
  /** Dé EFFECTIF rendu par le RÉSOLVEUR (`CascadeTableResult.die`) : l'UI l'AFFICHE, elle ne le
   *  recalcule pas — lui seul connaît le plancher de sa table. Absent = rien n'est encore résolu. */
  effective?: number | null;
  /** La perte de focus COMMET la saisie (défaut). `false` là où commettre est un acte IRRÉVERSIBLE —
   *  la saisie PRÉ-jet LANCE le dé (`forcedDieRow`) : quitter le champ pour cliquer « Annuler »
   *  roulerait le jet qu'on annule. Le brouillon revient alors à la dernière valeur commise, et
   *  Entrée reste le seul geste qui pose le dé. */
  commitOnBlur?: boolean;
}) {
  // Borne : dé fixé → les faces du dé (d100 par défaut) ; Résilience → ≤ cible ET hors bande d'échec
  // auto (dérivé de la policy).
  const maxRoll = fixed ? Math.min(max ?? FIXED_ROLL_MAX, FIXED_ROLL_MAX) : maxForcedRoll(target);
  // La frappe reste LOCALE : le dé ne se commet qu'au geste TERMINAL (Entrée, et la perte de focus
  // quand `commitOnBlur`). Un commit par frappe rendrait tout nombre à deux chiffres insaisissable
  // avant le jet — la branche pré-jet LANCE au commit (`forcedDieRow`), le « 5 » de « 50 » résoudrait
  // le Test.
  const [draft, setDraft] = useState(roll != null ? String(roll) : '');
  // Dernière valeur COMMISE : un second geste terminal sur la même valeur (Entrée puis blur) ne
  // rejoue pas le commit. Quand le dé du MODÈLE change (jet, Résilience, ligne de table cliquée), le
  // champ le reflète — ajustement dérivé fait AU RENDU, pas dans un effet différé.
  const committed = useRef<number | null>(roll);
  if (committed.current !== roll) {
    committed.current = roll;
    setDraft(roll != null ? String(roll) : '');
  }

  const commit = (n: number) => {
    if (n === committed.current) return;
    committed.current = n;
    setDraft(String(n));
    onSet(n);
  };
  // REFUS honnête hors domaine (jamais un clamp silencieux) : une saisie qui sortirait des faces
  // n'est pas commise — le champ revient à la dernière valeur valide.
  const commitDraft = () => {
    const n = Number(draft);
    if (draft !== '' && Number.isInteger(n) && n >= 1 && n <= maxRoll) commit(n);
    else setDraft(committed.current != null ? String(committed.current) : '');
  };
  return (
    <div className="rm-die-pick">
      {!fixed && (
        <button className={`btn small ${roll === 1 ? 'btn-primary' : ''}`} title="Le score le plus bas → DR maximum" onClick={() => commit(1)}>
          01 · DR max
        </button>
      )}
      {!fixed && critable && maxRoll >= 11 && (
        <button className={`btn small ${roll === 11 ? 'btn-primary' : ''}`} title="Le plus bas double réussi → Critique au meilleur DR" onClick={() => commit(11)}>
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
          value={draft}
          placeholder={`d${maxRoll}`}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              // Entrée est CONSOMMÉE par le champ : elle pose le dé, et rien d'autre. Sans
              // `stopPropagation`, l'écouteur clavier de `Modal` la reçoit à son tour et clique le
              // bouton primaire — le jet posé partirait avec la validation de la boîte.
              e.preventDefault();
              e.stopPropagation();
              commitDraft();
            }
          }}
          onBlur={commitOnBlur ? commitDraft : () => setDraft(committed.current != null ? String(committed.current) : '')}
          title={fixed ? `Saisir la valeur du dé (1 à ${maxRoll}), validée par Entrée` : `Choisir librement la valeur du dé (1 à ${maxRoll}), validée par Entrée`}
        />
      </label>
      {/* Le dé qui RÉSOUT n'est pas celui qui est saisi dès qu'un modificateur s'applique : on montre
          l'opération en clair, à côté de la saisie. Sans elle, la valeur affichée ment sur l'issue. */}
      {mod !== 0 && roll != null && effective != null && (
        <span className="hint">
          = <b>{effective}</b> ({roll} {mod > 0 ? '+' : '−'} {Math.abs(mod)})
        </span>
      )}
    </div>
  );
}
