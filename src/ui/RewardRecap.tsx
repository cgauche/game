import type { ReactNode } from 'react';
import { Coins } from './Coins';
import { Icon } from './Icon';
import { toBrass, type Money } from '../engine/money';

/** Une rubrique du récapitulatif : son titre et son contenu. `className` est l'ANCRAGE de l'écran
 *  hôte sur cette rubrique (mise en avant, ferrage) — la matière commune reste `.reward-section`. */
export interface RecapSection {
  /** Identité STABLE de la rubrique : la liste est conditionnelle (une rubrique disparaît quand elle se vide). */
  id: string;
  titre: ReactNode;
  className?: string;
  children: ReactNode;
}

/**
 * Récapitulatif de GAIN — messages d'ambiance, récompenses chiffrées, rubriques titrées, geste de
 * sortie. Brique partagée de l'écran de VICTOIRE (fin de combat) et de la fenêtre de BUTIN hors
 * combat : les deux montrent la même chose, seul l'ancrage diffère.
 * Un compteur à ZÉRO ne s'affiche jamais nu (#377) : la brique le masque ELLE-MÊME (PX comme bourse),
 * et `emptyNote` remplace une rangée vide par une ligne narrative.
 */
export function RewardRecap({ messages, xp, gold, emptyNote, sections, action }: {
  /** Lignes de journal de l'événement (Effets `onVictory`, texte d'ambiance d'une fouille). */
  messages?: readonly ReactNode[];
  /** Points d'Expérience gagnés — rendus au-delà de zéro seulement. */
  xp?: number;
  /** Argent trouvé, déjà crédité — rendu au-delà de zéro seulement. */
  gold?: Money;
  /** Ligne narrative quand il n'y a NI PX NI or. */
  emptyNote?: ReactNode;
  sections?: readonly RecapSection[];
  /** Le geste de sortie (bouton, ou ready-check coop + bouton). */
  action: ReactNode;
}) {
  const hasXp = (xp ?? 0) > 0;
  const hasGold = !!gold && toBrass(gold) > 0;
  const hasRewards = hasXp || hasGold;
  return (
    <>
      {(messages?.length ?? 0) > 0 && (
        <div className="reward-messages">
          {messages!.map((m, i) => <p key={i} className="reward-msg">{m}</p>)}
        </div>
      )}

      {hasRewards ? (
        <div className="reward-stats">
          {hasXp && (
            <div className="reward-stat"><span className="reward-ico"><Icon id="action/cast" size="sm" /></span> <b>{xp}</b> <span className="reward-unit">PX</span></div>
          )}
          {hasGold && (
            <div className="reward-stat"><span className="reward-ico"><Icon id="resource/gold-purse" size="sm" /></span> <Coins money={gold!} /></div>
          )}
        </div>
      ) : emptyNote ? (
        <p className="reward-msg">{emptyNote}</p>
      ) : null}

      {sections?.map((s) => (
        <div key={s.id} className={s.className ? `reward-section ${s.className}` : 'reward-section'}>
          <h3>{s.titre}</h3>
          {s.children}
        </div>
      ))}

      {action}
    </>
  );
}
