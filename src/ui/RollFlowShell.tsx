import { useState } from 'react';
import type { ReactNode } from 'react';
import type { RollBreakdown } from '../engine/combat';
import { bus, EVT } from '../state/bus';
import { ForcedRollPicker } from './ForcedRollPicker';
import { ResilienceButton } from './ResilienceButton';
import { ResistButton } from './ResistButton';
import { InfluenceRow } from './InfluenceRow';
import { RollPanel, type RollRowData } from './RollPanel';
import type { PendingRoll } from './RollLine';
import type { Combatant } from '../engine/types';
import { Modal } from './Modal';

// Dé d100 canonique (désormais animé) — ré-exporté pour les modales qui l'importaient d'ici.
export { Dice } from './Dice';

/**
 * Coquille PARTAGÉE des modales de jet différé — pendant UI de
 * la fabrique `state/rollFlow.ts`. Toutes suivent le même squelette :
 *
 *   overlay → titre → sous-titre → panneau de jet (`RollPanel`, pré-rempli ou rempli) → issue
 *   style journal → rangée « influencer le jet » (ressources contextuelles : Chance / Pacte /
 *   Résilience / Détermination) → barre d'actions (2 boutons max : Annuler · primaire).
 *
 * La modale concrète ne fournit QUE sa partie spécifique : titre, sous-titre, ligne(s) de jet
 * (`breakdown` → RollPanel) + issue style journal (`outcome`), et les handlers du flux.
 * Variantes couvertes par props :
 * - `variant` : famille de classes ('roll' = roll-modal/rm-vs ; 'test' = test-modal/test-actor) ;
 * - `onBonusSL` absent : Test binaire → pas de bouton « +1 DR » ;
 * - `onForce` absent : pas de Résilience (flux sans « Réussite garantie ») ;
 * - `preRollForce` : action Résilience pré-jet spécifique (ex. Piétinement : lancer PUIS forcer) ;
 * - `cancelAfterRoll` : Annuler aussi après le jet (Piétinement, Focalisation) ;
 * - `rows`/`winnerIndex`/`netSL` : Test opposé riche (portraits + vainqueur accentué).
 */
export function RollFlowShell({
  variant = 'roll',
  embedded = false,
  title,
  subtitle,
  extra,
  actor,
  rolled,
  rollLabel = '🎲 Lancer',
  onRoll,
  onCancel,
  cancelAfterRoll = false,
  breakdown,
  rows,
  pending,
  winnerIndex,
  netSL,
  outcome,
  determination,
  fortune,
  rerollable,
  onReroll,
  freeReroll,
  onBonusSL,
  darkPactable,
  onDarkPact,
  resilience = 0,
  onForce,
  preRollForce,
  forceShow = false,
  resist,
  forcedRoll,
  confirmLabel = 'Appliquer',
  confirmTitle,
  onConfirm,
  setup,
  preInfluence,
  postRollExtra,
  forcedExtra,
  rollFrisson = false,
  cancelLabel = 'Annuler',
  cancelTitle,
  disableEscClose = false,
}: {
  variant?: 'roll' | 'test';
  /** Rendu EMBARQUÉ (zone de jet d'une modale persistante, ex. infirmerie) : même contenu,
   *  sans l'enveloppe Modal (le parent EST la modale ; Échap géré par lui). */
  embedded?: boolean;
  title: ReactNode;
  subtitle: ReactNode;
  /** Contenu optionnel entre le sous-titre et le jet (ex. sélecteur de cible du soin, portraits). */
  extra?: ReactNode;
  /** Acteur du jet (jet à UN combattant) : son PORTRAIT est injecté DANS la ligne de jet (comme la
   *  cascade) → « montrer, pas écrire ». Les modales mono-acteur passent `actor` au lieu d'un nom en
   *  clair dans le sous-titre. Ignoré si la ligne porte déjà un combattant (Défense/cascade multi). */
  actor?: Combatant;
  rolled: boolean;
  rollLabel?: string;
  onRoll: () => void;
  /** Absent → pas de bouton « Annuler ». */
  onCancel?: () => void;
  cancelAfterRoll?: boolean;
  /** Ligne(s) de jet riche(s) (base = cible · d100 · DR), façon Attaque/Défense — un tableau pour
   *  les Tests opposés (acteur puis opposant). */
  breakdown?: RollBreakdown | RollBreakdown[];
  /** Lignes riches avec portraits (prioritaire sur `breakdown` si fourni). */
  rows?: RollRowData[];
  /** Ligne(s) de jet EN ATTENTE (pré-jet) montrée(s) AVANT le lancer — parité Attaque/Défense. */
  pending?: PendingRoll | PendingRoll[];
  /** Test opposé : index de la ligne gagnante (accent) + DR net (badge). */
  winnerIndex?: number | null;
  netSL?: number;
  /** Ligne d'issue style journal sous la ligne de jet (le « log » de l'action). */
  outcome?: ReactNode;
  /** Détermination (LDB 17 l.62) : immunité Psychologie. Affiché pré-jet et après échec. */
  determination?: { resolve: number; onResolve: () => void };
  fortune: number;
  rerollable: boolean;
  onReroll: () => void;
  /** Bénédiction de Chance (LDB 41) : relance gratuite disponible (actif même à 0 Chance). */
  freeReroll?: boolean;
  /** Absent → Test binaire : pas de « +1 DR ». */
  onBonusSL?: () => void;
  /** Sombre Pacte (LDB 19 l.41) : +1 Corruption pour relancer le Test raté, même déjà relancé. */
  darkPactable?: boolean;
  onDarkPact?: () => void;
  resilience?: number;
  /** Absent → pas de Résilience sur ce flux. */
  onForce?: () => void;
  /** Action Résilience pré-jet (défaut : `onForce`). */
  preRollForce?: () => void;
  /** Montre la Résilience APRÈS le jet (condition d'échec propre au flux). */
  forceShow?: boolean;
  /** Résistance (Menace) (LDB 10) : auto-succès du talent sur un Test tagué `menace` — fourni quand le
   *  talent est DISPONIBLE (spec non consommée cette séance). Affiché AVANT le jet, et après un ÉCHEC. */
  resist?: { menace: string; onResist: () => void };
  /** « vous choisissez le résultat » (LDB 17 l.73) : sélecteur du dé d'un Test FORCÉ — fourni par
   *  les flux où la valeur a un enjeu (double → Critique). Absent → pas de sélecteur. */
  forcedRoll?: { roll: number; target: number; onSet: (roll: number) => void; critable?: boolean };
  confirmLabel?: string;
  /** Infobulle du bouton primaire (ex. « Poser la zone » de l'incantation). */
  confirmTitle?: string;
  onConfirm: () => void;
  /** Contenu métier PRÉ-JET uniquement (options : choix d'arme/localisation visée, Parade/Esquive…). */
  setup?: ReactNode;
  /** Boutons contextuels dans la rangée d'influence PRÉ-JET (ex. Détermination « retirer un État »). */
  preInfluence?: ReactNode;
  /** Contenu métier POST-JET, APRÈS l'issue et AVANT le picker du dé forcé (Surincantation,
   *  Contre-sort, choix d'effet du Critique d'incantation). */
  postRollExtra?: ReactNode;
  /** Contenu métier juste APRÈS le picker du dé forcé (grille de localisation du Critique forcé). */
  forcedExtra?: ReactNode;
  /** Anime le jet (« frisson » ~480 ms) avant de résoudre — Attaque/Défense. Honore reduced-motion. */
  rollFrisson?: boolean;
  /** Libellé du bouton « Annuler » (ex. « Subir » pour la défense passive). */
  cancelLabel?: string;
  /** Infobulle du bouton d'annulation. */
  cancelTitle?: string;
  /** N'attache PAS Échap/✕ à l'annulation (flux où l'on ne peut pas « fermer » — défense obligatoire). */
  disableEscClose?: boolean;
}) {
  const subClass = variant === 'test' ? 'test-actor' : 'rm-vs';
  const [rolling, setRolling] = useState(false);
  const reduceMotion = typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  // Frisson du jet (R3) : beat cosmétique avant le jet (seeded) réel. Sans `rollFrisson` → immédiat.
  const doRoll = () => {
    bus.emit(EVT.DICE_ROLL);
    if (!rollFrisson || reduceMotion) return onRoll();
    setRolling(true);
    window.setTimeout(() => { setRolling(false); onRoll(); }, 480);
  };
  const cancelBtn = onCancel && (
    <button className="btn btn-ghost" onClick={onCancel} title={cancelTitle}>
      {cancelLabel}
    </button>
  );
  const determineBtn = determination && determination.resolve > 0 && (
    <button
      className="btn btn-resource"
      onClick={determination.onResolve}
      title="Dépense 1 Détermination : immunité à la Psychologie jusqu'à la fin du prochain Round"
    >
      ✊ Détermination ×{determination.resolve}
    </button>
  );
  // `actor` (jet MONO-acteur) → portrait injecté dans la ligne de jet UNIQUE (mutualise le « portrait
  // dans la ligne » de la cascade). Garde-fou : SEULEMENT si une seule ligne — les flux opposés/multi
  // (Défense, Marchandage, Empêtré) ont >1 ligne et posent leur PROPRE combattant par ligne.
  const injectActor = (rs: RollRowData[] | undefined): RollRowData[] | undefined =>
    actor && rs && rs.length === 1 && !rs[0].combatant ? [{ ...rs[0], combatant: actor }] : rs;
  const panelRows: RollRowData[] | undefined =
    injectActor(rows ?? (breakdown ? (Array.isArray(breakdown) ? breakdown : [breakdown]).map((d) => ({ d })) : undefined));
  // Pré-jet : ligne(s) en attente (dé/DR vides), mêmes que l'Attaque/Défense avant le lancer.
  const preRows: RollRowData[] | undefined = injectActor(pending
    ? (Array.isArray(pending) ? pending : [pending]).map((p) => ({ pending: p }))
    : undefined);
  // Échap = Annuler, exactement quand le bouton Annuler est visible (pré-jet, ou post-jet si le flux le
  // permet) — JAMAIS pendant le frisson (le jet est imminent), comme les anciennes modales lourdes.
  const escClose = (disableEscClose || rolling) ? undefined : ((!rolled || cancelAfterRoll) ? onCancel : undefined);
  const body = (
    <>
      {subtitle && <p className={subClass}>{subtitle}</p>}
      {extra}
      {!rolled ? (
        <>
          {setup}
          {preRows && <RollPanel rows={preRows} />}
          {rolling ? (
            <div className="rm-rolling"><span className="rm-die">🎲</span></div>
          ) : (
            <>
              <div className="rm-influence">
                {/* Résilience AVANT le jet (LDB 17 l.73 : « au lieu de lancer les dés »). */}
                {onForce && <ResilienceButton resilience={resilience} show={resilience > 0} onForce={preRollForce ?? onForce} />}
                {/* Résistance (Menace) AVANT le jet (LDB 10 : « réussir automatiquement le premier Test »). */}
                {resist && <ResistButton menace={resist.menace} show onResist={resist.onResist} />}
                {preInfluence}
                {determineBtn}
              </div>
              <div className="modal-actions">
                {cancelBtn}
                <button className="btn btn-primary" onClick={doRoll}>
                  {rollLabel}
                </button>
              </div>
            </>
          )}
        </>
      ) : (
        <>
          {panelRows && <RollPanel rows={panelRows} winnerIndex={winnerIndex} netSL={netSL} />}
          {outcome}
          {postRollExtra}
          {forcedRoll && <ForcedRollPicker {...forcedRoll} />}
          {forcedExtra}
          {/* Rangée « influencer le jet » : assemblée UNE seule fois (InfluenceRow) — le shell passe
              les primitives (fortune/freeReroll/resilience), pas d'acteur. */}
          <InfluenceRow
            fortune={fortune}
            freeReroll={freeReroll}
            resilience={resilience}
            rerollable={rerollable}
            onReroll={onReroll}
            onBonusSL={onBonusSL}
            darkPactable={darkPactable}
            onDarkPact={onDarkPact}
            onForce={onForce}
            forceShow={forceShow}
          >
            {/* Résistance (Menace) après un ÉCHEC — le parent ne passe `resist` que quand l'issue est encore défavorable. */}
            {resist && <ResistButton menace={resist.menace} show onResist={resist.onResist} />}
            {forceShow && determineBtn}
          </InfluenceRow>
          <div className="modal-actions">
            {cancelAfterRoll && cancelBtn}
            {/* () => onConfirm() : ne PAS passer l'événement React à l'action — en coop l'invité
                sérialise les args de l'intent (JSON), un événement (circulaire) perdrait l'intent. */}
            <button className="btn btn-primary" onClick={() => onConfirm()} title={confirmTitle}>
              {confirmLabel}
            </button>
          </div>
        </>
      )}
    </>
  );
  if (embedded) {
    return (
      <div className={`rfs-embedded ${variant === 'test' ? 'test-modal' : 'roll-modal'}`}>
        <div className="mini-title">{title}</div>
        {body}
      </div>
    );
  }
  return (
    <Modal title={title} variant={variant} onClose={escClose}>
      {body}
    </Modal>
  );
}

/** Ré-export pour composer des lignes riches (portraits) côté modale. */
export type { RollRowData } from './RollPanel';
