import { useState, type ReactNode } from 'react';
import { type Money } from '../engine/money';
import { Coins } from './Coins';
import { GameDate } from './GameDate';
import { t } from '../i18n';
import { Icon } from './Icon';

/**
 * Menu ☰ du jeu (haut-gauche, COMBAT et EXPLORATION — mobile-first). Regroupe ce qui a quitté
 * l'écran : nom de la scène, Bourse (`<Coins>`), date complète du Calendrier Impérial
 * (`<GameDate>`), et « Quitter la partie » (retour à l'écran de groupe — parité avec l'ancien
 * bouton toujours visible). `initialOpen` = aide de test. Pur à props.
 */
export function GameMenu({ sceneName, money, time, onQuit, onSaveLoad, onEndSession, onHouseRules, onOptions, coop, initialOpen = false }: {
  sceneName?: string;
  money: Money;
  /** Horloge de campagne (minutes depuis l'époque) — rendue par `<GameDate>`. */
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
  /** Section coop de l'HÔTE (réinviter un déconnecté, réattribuer les héros — Jalon 7 P3c). */
  coop?: ReactNode;
  initialOpen?: boolean;
}) {
  const [open, setOpen] = useState(initialOpen);
  return (
    <div className={`game-menu ${open ? 'open' : ''}`}>
      <button type="button" className="gm-btn" aria-label={open ? t('gameMenu.close') : t('gameMenu.menu')} aria-expanded={open} onClick={() => setOpen(!open)} title={open ? t('gameMenu.close') : t('gameMenu.menu')}>
        ☰
      </button>
      {open && (
        <div className="gm-panel">
          {sceneName && <h3 className="gm-scene">{sceneName}</h3>}
          <div className="gm-date"><GameDate time={time} /></div>
          <div className="gm-section">
            <span className="mini-title">{t('gameMenu.purse')}</span>
            <Coins money={money} />
          </div>
          {coop}
          {onSaveLoad && (
            <button type="button" className="btn small" onClick={() => { setOpen(false); onSaveLoad(); }}>
              {t('gameMenu.saveLoad')}
            </button>
          )}
          {onEndSession && (
            <button type="button" className="btn small" onClick={() => { setOpen(false); onEndSession(); }}>
              Fin de séance
            </button>
          )}
          {onHouseRules && (
            <button type="button" className="btn small" onClick={() => { setOpen(false); onHouseRules(); }}>
              {t('gameMenu.houseRules')}
            </button>
          )}
          {onOptions && (
            <button type="button" className="btn small" onClick={() => { setOpen(false); onOptions(); }}>
              <Icon id="ui/settings" size="sm" /> Options
            </button>
          )}
          <button type="button" className="btn small gm-quit" onClick={onQuit}>{t('gameMenu.quit')}</button>
        </div>
      )}
    </div>
  );
}
