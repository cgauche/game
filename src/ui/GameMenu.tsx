import { useState, type ReactNode } from 'react';
import { type Money } from '../engine/money';
import { ScreenMeta } from './ScreenMeta';
import { MenuCard, MenuSection, MenuButton } from './MenuCard';
import { t } from '../i18n';

/**
 * Menu ☰ du jeu (barre HUD supérieure, COMBAT et EXPLORATION). Tiroir « vrai menu » composé de la
 * primitive `MenuCard` : en-tête (titre « Menu » + lieu LABELLISÉ en méta discrète + méta unifiée
 * date/bourse via `ScreenMeta`), puis sections nettes (Partie / Réglages / Coopération). `initialOpen`
 * = aide de test. Pur à props.
 */
export function GameMenu({ sceneName, money, time, onQuit, onSaveLoad, onEndSession, onHouseRules, onOptions, audio, coop, initialOpen = false }: {
  sceneName?: string;
  money: Money;
  /** Horloge de campagne (minutes depuis l'époque) — méta d'en-tête via `ScreenMeta`. */
  time: number;
  onQuit: () => void;
  /** Ouvre la modale Sauvegarder/Charger (Jalon 5) — absent en combat (sauvegarde refusée). */
  onSaveLoad?: () => void;
  /** Ouvre l'écran de fin de séance (Ambitions + Détermination + Chance restaurée) — exploration seule. */
  onEndSession?: () => void;
  /** Ouvre le panneau « Règles maison » (mêmes réglages qu'au menu principal, dont la Cadence de combat). */
  onHouseRules?: () => void;
  /** Ouvre l'écran Options (remap clavier, etc.). */
  onOptions?: () => void;
  /** Contrôles audio (`AudioControls`) — rendus dans la section Réglages. */
  audio?: ReactNode;
  /** Section coop de l'HÔTE / siège du contrôleur solo (réinviter, réattribuer les héros). */
  coop?: ReactNode;
  initialOpen?: boolean;
}) {
  const [open, setOpen] = useState(initialOpen);
  const act = (fn?: () => void) => () => { setOpen(false); fn?.(); };
  return (
    <div className={`game-menu ${open ? 'open' : ''}`}>
      <button type="button" className="gm-btn" aria-label={open ? t('gameMenu.close') : t('gameMenu.menu')} aria-expanded={open} onClick={() => setOpen(!open)} title={open ? t('gameMenu.close') : t('gameMenu.menu')}>
        ☰
      </button>
      {open && (
        <MenuCard
          variant="panel"
          header={<div className="menu-card-head">
            <h3 className="menu-card-title">{t('gameMenu.menu')}</h3>
            {sceneName && <p className="menu-card-sub">{t('gameMenu.scene')} — {sceneName}</p>}
            <div className="menu-card-meta"><ScreenMeta meta={{ time, money }} /></div>
          </div>}
        >
          <MenuSection label={t('gameMenu.section.game')}>
            {onSaveLoad && <MenuButton icon="file/save" onClick={act(onSaveLoad)}>{t('gameMenu.saveLoad')}</MenuButton>}
            {onEndSession && <MenuButton icon="resource/xp" onClick={act(onEndSession)}>{t('gameMenu.endSession')}</MenuButton>}
            <MenuButton icon="map-tool/door" onClick={onQuit}>{t('gameMenu.quit')}</MenuButton>
          </MenuSection>
          <MenuSection label={t('gameMenu.section.settings')}>
            {onOptions && <MenuButton icon="ui/settings" onClick={act(onOptions)}>{t('gameMenu.options')}</MenuButton>}
            {onHouseRules && <MenuButton icon="nav/rules" onClick={act(onHouseRules)}>{t('gameMenu.houseRules')}</MenuButton>}
            {audio}
          </MenuSection>
          {coop && (
            <MenuSection label={t('gameMenu.section.coop')}>
              {coop}
            </MenuSection>
          )}
        </MenuCard>
      )}
    </div>
  );
}
