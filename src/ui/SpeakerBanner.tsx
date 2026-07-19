import type { ReactNode } from 'react';
import type { SceneEntity } from '../state/scene';
import { pickBackend } from '../gameIso/pickBackend';
import { Fleuron } from './Ornaments';

/**
 * Bandeau d'interlocuteur (#371 lot 1) — gabarit visuel UNIQUE d'un PNJ qui s'adresse au joueur :
 * portrait (même pipeline que le rendu iso, `pickBackend` en vue de face) + nom + texte.
 *  - `dialogue` : arbre de choix (`DialogueBox`) — zone de choix rendue si fournie ; portrait ABSENT
 *    tant qu'aucune entité n'est liée (comportement historique : une ligne narrateur sans portrait).
 *  - `boniment` : réplique STATIQUE, sans arbre (marchand, aubergiste…) — portrait TOUJOURS montré,
 *    replié sur un fleuron neutre si aucune entité de scène n'incarne l'interlocuteur.
 */
export interface SpeakerBannerProps {
  /** Entité de scène incarnant l'interlocuteur (portrait rig) — absente = pas d'entité liée. */
  ent?: SceneEntity;
  label?: ReactNode;
  variant?: 'dialogue' | 'boniment';
  /** Réplique (texte du nœud de dialogue, ou boniment). */
  children?: ReactNode;
  /** Zone de choix (variant `dialogue` seulement). */
  choices?: ReactNode;
  className?: string;
}

export function SpeakerBanner({ ent, label, variant = 'dialogue', children, choices, className }: SpeakerBannerProps) {
  const portrait = ent ? pickBackend({ kind: 'sceneEntity', ent }, 'top') : null;
  const showPortraitSlot = portrait != null || variant === 'boniment';
  return (
    <div className={`dialogue-box${variant === 'boniment' ? ' dlg-boniment' : ''}${className ? ` ${className}` : ''}`}>
      <div className="dlg-head">
        {showPortraitSlot && (
          <span className="dlg-portrait">
            {portrait ? (
              <svg viewBox={portrait.portraitBox} preserveAspectRatio="xMidYMid slice">{portrait.body}</svg>
            ) : (
              <Fleuron size={14} />
            )}
          </span>
        )}
        <div className="dlg-body">
          {label && <div className="dlg-speaker">{label}</div>}
          {children && <p className="dlg-text">{children}</p>}
        </div>
      </div>
      {variant === 'dialogue' && choices && <div className="dlg-choices">{choices}</div>}
    </div>
  );
}
