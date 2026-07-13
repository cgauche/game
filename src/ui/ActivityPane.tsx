import type { ReactNode } from 'react';
import { Icon } from './Icon';
import { Prose } from './Prose';
import { PendingRollLine, type PendingRoll } from './RollLine';

/**
 * Gabarit UNIQUE d'un panneau d'Activité/Service (#371) : en-tête (icône du registre + titre),
 * description VERBATIM `<Prose>` (règle 5), corps DÉFILABLE (`children`), et PIED FIXE — pré-jet
 * (`PendingRollLine`), coût `<Coins>`, complément, bouton(s) d'action jamais cachés par le scroll.
 * Slots GÉNÉRIQUES `ReactNode` : composé par `InterludeScreen` (volets d'Activité) et
 * `CityHubScreen` (détail de service) — aucun métier de l'un ou l'autre ne vit ici.
 */
export function ActivityPane({ icon, title, desc, blocked, prejet, cost, note, actions, children }: {
  icon: string;
  title: ReactNode;
  /** Description VERBATIM (Markdown) de la source — rendue par `<Prose>` (règle 5). */
  desc?: string;
  /** Raison d'indisponibilité (gate d'affordance) — l'action du pied est alors désactivée. */
  blocked?: ReactNode;
  /** Ligne de test AVANT d'entreprendre (compétence en chip + Difficulté + cible). */
  prejet?: PendingRoll;
  /** Coût de l'Activité (rendu `<Coins>`/PX) — affiché dans le pied. */
  cost?: ReactNode;
  /** Formule/complément du pied (activités SANS jet : tirage direct, taux, livraison…). */
  note?: ReactNode;
  /** Bouton(s) du pied. */
  actions?: ReactNode;
  children?: ReactNode;
}) {
  const hasFoot = prejet != null || cost != null || note != null || actions != null;
  return (
    <div className="activity-pane">
      <header className="activity-pane-head"><Icon id={icon} /> <b>{title}</b></header>
      <div className="activity-pane-body">
        {desc && <div className="activity-pane-desc"><Prose md={desc} /></div>}
        {blocked && <p className="activity-pane-blocked">{blocked}</p>}
        {children}
      </div>
      {hasFoot && (
        <footer className="activity-pane-foot">
          <div className="activity-pane-terms">
            {prejet && <PendingRollLine p={prejet} />}
            {(cost != null || note != null) && (
              <p className="activity-pane-detail">
                {cost != null && <>Coût : <b>{cost}</b>{note != null ? ' · ' : ''}</>}
                {note}
              </p>
            )}
          </div>
          <div className="activity-pane-actions">{actions}</div>
        </footer>
      )}
    </div>
  );
}
