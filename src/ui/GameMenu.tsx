import { useState, type ReactNode } from 'react';
import { formatMoney, type Money } from '../engine/money';
import { t } from '../i18n';

/**
 * Menu ☰ du jeu (haut-gauche, COMBAT et EXPLORATION — mobile-first). Regroupe ce qui a quitté
 * l'écran : nom de la scène, Bourse, date complète du Calendrier Impérial, et « Quitter la partie »
 * (retour à l'écran de groupe — parité avec l'ancien bouton toujours visible). `initialOpen` = aide
 * de test. Pur à props.
 */
export function GameMenu({ sceneName, money, dateLine, onQuit, onSaveLoad, onHouseRules, onOptions, coop, initialOpen = false }: {
  sceneName?: string;
  money: Money;
  dateLine: string;
  onQuit: () => void;
  /** Ouvre la modale Sauvegarder/Charger (Jalon 5) — absent en combat (sauvegarde refusée). */
  onSaveLoad?: () => void;
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
          <div className="gm-date">{dateLine}</div>
          <div className="gm-section">
            <span className="mini-title">{t('gameMenu.purse')}</span>
            <span className="coins">{formatMoney(money)}</span>
          </div>
          {coop}
          {onSaveLoad && (
            <button type="button" className="btn small" onClick={() => { setOpen(false); onSaveLoad(); }}>
              {t('gameMenu.saveLoad')}
            </button>
          )}
          {onHouseRules && (
            <button type="button" className="btn small" onClick={() => { setOpen(false); onHouseRules(); }}>
              {t('gameMenu.houseRules')}
            </button>
          )}
          {onOptions && (
            <button type="button" className="btn small" onClick={() => { setOpen(false); onOptions(); }}>
              ⚙️ Options
            </button>
          )}
          <button type="button" className="btn small gm-quit" onClick={onQuit}>{t('gameMenu.quit')}</button>
        </div>
      )}
    </div>
  );
}
