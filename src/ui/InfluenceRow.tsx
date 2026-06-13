import type { ReactNode } from 'react';
import type { Combatant } from '../engine/types';
import { freeRerollOf } from '../engine/activeFlags';
import { ChanceButtons } from './ChanceButtons';
import { ResilienceButton } from './ResilienceButton';

/**
 * Rangée « influencer le jet » PARTAGÉE (Chance · Relance gratuite · +1 DR · Pacte · Résilience) —
 * le bloc était copié/collé dans chaque modale à jet (Attaque, Défense, Incantation,
 * Désengagement…). L'acteur est passé UNE fois : sa Chance, sa relance gratuite (Bénédiction de
 * Chance, LDB 41) et sa Résilience en découlent — plus d'oubli de `freeReroll` par modale.
 * `children` : boutons contextuels supplémentaires (Détermination, actions de chirurgie…).
 */
export function InfluenceRow({
  actor,
  fortune,
  freeReroll,
  resilience,
  rerollable,
  onReroll,
  onBonusSL,
  darkPactable,
  onDarkPact,
  onForce,
  forceShow = false,
  children,
}: {
  /** Le héros qui jette : Chance/relance gratuite/Résilience en sont DÉRIVÉES (passé une fois, plus
   *  d'oubli). Les vues présentationnelles `*View` et `RollFlowShell` passent plutôt les primitives
   *  ci-dessous (testables sans `Combatant`). */
  actor?: Combatant | null;
  /** Primitives — PRIORITAIRES sur `actor` quand fournies (vues sans `Combatant`). */
  fortune?: number;
  freeReroll?: boolean;
  resilience?: number;
  rerollable: boolean;
  onReroll: () => void;
  /** Absent → Test binaire : pas de « +1 DR ». */
  onBonusSL?: () => void;
  darkPactable?: boolean;
  onDarkPact?: () => void;
  /** Absent → pas de Résilience sur ce flux. */
  onForce?: () => void;
  /** Montre la Résilience (condition d'échec propre au flux). */
  forceShow?: boolean;
  children?: ReactNode;
}) {
  const fort = fortune ?? actor?.fortune ?? 0;
  const free = freeReroll ?? freeRerollOf(actor);
  const resil = resilience ?? actor?.resilience ?? 0;
  return (
    <div className="rm-influence">
      <ChanceButtons
        fortune={fort}
        rerollable={rerollable}
        onReroll={onReroll}
        freeReroll={free}
        onBonusSL={onBonusSL}
        darkPactable={darkPactable}
        onDarkPact={onDarkPact}
      />
      {onForce && <ResilienceButton resilience={resil} show={forceShow} onForce={onForce} />}
      {children}
    </div>
  );
}
