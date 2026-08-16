import { type ReactNode } from 'react';
import { Icon } from './Icon';
import type { IconIdInput } from './icons';
import { RuleDivider } from './Ornaments';
import { t } from '../i18n';

/**
 * MenuCard — primitive du patron « vrai menu » : une carte qui empile un en-tête, des SECTIONS de
 * grands boutons pleine largeur (icône + libellé) séparées par un filet titré. Source UNIQUE
 * composée par le MENU PRINCIPAL (`MainMenu`, carte plein-champ centrée) ET le MENU SYSTÈME plein
 * écran EN JEU (`GameMenu`, pause + ses sous-écrans Coopération/Options) — MÊME langage visuel.
 * Ne jamais recoder un `.menu-card` ni un `<button className="btn">` de menu à la main : composer
 * `MenuCard` > `MenuSection` > `MenuButton` (et `MenuToggle` pour un interrupteur de menu).
 */
export function MenuCard({ header, footer, className, children }: {
  /** En-tête de la carte (titre, sous-titre/méta) — rendu avant les sections. */
  header?: ReactNode;
  /** Pied de carte (note discrète) — rendu après les sections. */
  footer?: ReactNode;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div className={`menu-card${className ? ` ${className}` : ''}`}>
      {header}
      {children}
      {footer}
    </div>
  );
}

/**
 * EN-TÊTE de `MenuCard` : titre + `lead` (bouton Retour du sous-écran) + méta optionnelle
 * (sous-titre de scène, `ScreenMeta`). Sous-composant de la MÊME primitive — le markup de l'en-tête
 * (`.menu-card-head`/`-title`/`-meta`/`-sub`) ne se réécrit à aucun appelant : `MenuSubScreen` et le
 * menu système (`GameMenu`) le COMPOSENT.
 */
export function MenuCardHead({ title, lead, sub, meta, className }: {
  title: ReactNode;
  /** Élément AVANT le titre (bouton « Retour » d'un sous-écran). */
  lead?: ReactNode;
  /** Sous-titre discret de la méta (ex. nom de scène). */
  sub?: ReactNode;
  /** Méta de droite (`ScreenMeta` : date, jamais la bourse en menu système). */
  meta?: ReactNode;
  className?: string;
}) {
  return (
    <div className={`menu-card-head${className ? ` ${className}` : ''}`}>
      {lead}
      <h2 className="menu-card-title">{title}</h2>
      {(sub != null || meta != null) && (
        <div className="menu-card-meta">
          {sub != null && <span className="menu-card-sub">{sub}</span>}
          {meta}
        </div>
      )}
    </div>
  );
}

/**
 * SOUS-ÉCRAN de menu (Coopération, Options) : la MÊME carte plein écran, en-tête « Retour » + titre.
 * Vit ICI (à côté de `MenuCard`, dont c'est une composition) et non dans un foyer, parce que les DEUX
 * menus s'en servent : le menu SYSTÈME en jeu (`GameMenu`) et le menu PRINCIPAL hors partie
 * (`MainMenu` → `OptionsScreen`) — même langage, un seul markup. `wide` élargit la carte et lui pose
 * son contrat de hauteur (`.game-menu-sub-wide` : plafond au champ, corps seul défilant, #839).
 */
export function MenuSubScreen({ title, onBack, wide, children }: {
  title: ReactNode;
  onBack: () => void;
  wide?: boolean;
  children: ReactNode;
}) {
  return (
    <MenuCard
      className={`game-menu-card game-menu-sub${wide ? ' game-menu-sub-wide' : ''}`}
      header={<MenuCardHead
        className="menu-sub-head"
        lead={<button type="button" className="btn small btn-ghost menu-back" onClick={onBack}>
          <Icon id="ui/undo" size="sm" /> {t('gameMenu.back')}
        </button>}
        title={title}
      />}
    >
      {children}
    </MenuCard>
  );
}

/** Section de menu : filet séparateur (fleuron si `label` absent, titré sinon) + liste verticale de
 *  `MenuButton`. `rule={false}` supprime le filet (première section adossée à l'en-tête). */
export function MenuSection({ label, rule = true, ruleClassName, className, children }: {
  label?: ReactNode;
  rule?: boolean;
  ruleClassName?: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <>
      {rule && <RuleDivider label={label} className={ruleClassName} />}
      <div className={`menu-buttons${className ? ` ${className}` : ''}`}>{children}</div>
    </>
  );
}

/** Grand bouton de menu : `<Icon>` + libellé, pleine largeur. `href` → lien (`<a>`, ex. galeries) ;
 *  `tone` mappe les variantes canon `.btn-primary`/`.btn-test`. */
export function MenuButton({ icon, tone, onClick, href, target, rel, title, disabled, children }: {
  icon: IconIdInput;
  tone?: 'primary' | 'test';
  onClick?: () => void;
  href?: string;
  target?: string;
  rel?: string;
  title?: string;
  disabled?: boolean;
  children: ReactNode;
}) {
  const cls = `btn menu-btn${tone === 'primary' ? ' btn-primary' : tone === 'test' ? ' btn-test' : ''}`;
  if (href) {
    return (
      <a className={`${cls} menu-link`} href={href} target={target} rel={rel} title={title}>
        <Icon id={icon} /> {children}
      </a>
    );
  }
  return (
    <button type="button" className={cls} onClick={onClick} title={title} disabled={disabled}>
      <Icon id={icon} /> {children}
    </button>
  );
}

/** Interrupteur de menu (case à cocher alignée + libellé) — motif partagé, remplace le `.radio` de
 *  talent détourné (case cochée mal alignée, feedback juge). */
export function MenuToggle({ checked, onChange, children }: {
  checked: boolean;
  onChange: (v: boolean) => void;
  children: ReactNode;
}) {
  return (
    <label className="menu-toggle">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <span>{children}</span>
    </label>
  );
}
