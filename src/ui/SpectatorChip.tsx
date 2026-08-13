import { Icon } from './Icon';

/**
 * AFFORDANCE DE SPECTATEUR (coop) — puce discrète qui NOMME le siège attendu quand le geste
 * n'appartient pas au siège local. Deux poses : en surimpression de l'écran (défaut, arbitre de
 * modales) ou `inline`, DANS le panneau qui porte les commandes désactivées (zone de choix d'un
 * dialogue) — la puce y suit le flux au lieu de flotter au bas de l'écran.
 */
export function SpectatorChip({ label, action = 'joue…', inline = false }: {
  label: string;
  /** Ce que le siège nommé est en train de faire (« joue… », « choisit la réponse… »). */
  action?: string;
  inline?: boolean;
}) {
  return <div className="spectator-chip" data-pose={inline ? 'inline' : undefined}><Icon id="ui/wait" size="sm" /> {label} {action}</div>;
}
