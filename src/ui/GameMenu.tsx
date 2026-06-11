import { useState, type ReactNode } from 'react';
import { formatMoney, type Money } from '../engine/money';

/**
 * Menu ☰ du jeu (haut-gauche, COMBAT et EXPLORATION — mobile-first). Regroupe ce qui a quitté
 * l'écran : nom de la scène, Bourse, date complète du Calendrier Impérial, et « Quitter la partie »
 * (retour à l'écran de groupe — parité avec l'ancien bouton toujours visible). `initialOpen` = aide
 * de test. Pur à props.
 */
export function GameMenu({ sceneName, money, dateLine, onQuit, onSaveLoad, coop, initialOpen = false }: {
  sceneName?: string;
  money: Money;
  dateLine: string;
  onQuit: () => void;
  /** Ouvre la modale Sauvegarder/Charger (Jalon 5) — absent en combat (sauvegarde refusée). */
  onSaveLoad?: () => void;
  /** Section coop de l'HÔTE (réinviter un déconnecté, réattribuer les héros — Jalon 7 P3c). */
  coop?: ReactNode;
  initialOpen?: boolean;
}) {
  const [open, setOpen] = useState(initialOpen);
  return (
    <div className={`game-menu ${open ? 'open' : ''}`}>
      <button type="button" className="gm-btn" aria-label={open ? 'Fermer le menu' : 'Menu'} aria-expanded={open} onClick={() => setOpen(!open)} title={open ? 'Fermer le menu' : 'Menu'}>
        ☰
      </button>
      {open && (
        <div className="gm-panel">
          {sceneName && <h3 className="gm-scene">{sceneName}</h3>}
          <div className="gm-date">{dateLine}</div>
          <div className="gm-section">
            <span className="mini-title">Bourse</span>
            <span className="coins">{formatMoney(money)}</span>
          </div>
          {coop}
          {onSaveLoad && (
            <button type="button" className="btn small" onClick={() => { setOpen(false); onSaveLoad(); }}>
              💾 Sauvegarder / Charger
            </button>
          )}
          <button type="button" className="btn small gm-quit" onClick={onQuit}>← Quitter la partie</button>
        </div>
      )}
    </div>
  );
}
