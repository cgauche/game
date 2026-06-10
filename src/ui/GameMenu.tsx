import { useState } from 'react';
import { formatMoney, type Money } from '../engine/money';

/**
 * Menu ☰ du jeu (haut-gauche, COMBAT et EXPLORATION — mobile-first). Regroupe ce qui a quitté
 * l'écran : nom de la scène, Bourse, Inventaire du groupe (handouts/butin party-level), date
 * complète du Calendrier Impérial, et « Quitter la partie » (retour à l'écran de groupe — parité
 * avec l'ancien bouton toujours visible). `initialOpen` = aide de test. Pur à props.
 */
export function GameMenu({ sceneName, money, inventory, dateLine, onQuit, onSaveLoad, initialOpen = false }: {
  sceneName?: string;
  money: Money;
  inventory: string[];
  dateLine: string;
  onQuit: () => void;
  /** Ouvre la modale Sauvegarder/Charger (Jalon 5) — absent en combat (sauvegarde refusée). */
  onSaveLoad?: () => void;
  initialOpen?: boolean;
}) {
  const [open, setOpen] = useState(initialOpen);
  return (
    <div className={`game-menu ${open ? 'open' : ''}`}>
      <button type="button" className="gm-btn" onClick={() => setOpen(!open)} title={open ? 'Fermer le menu' : 'Menu'}>
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
          <div className="gm-section">
            <span className="mini-title">Inventaire ({inventory.length})</span>
            <div className="inv-list">
              {inventory.length === 0 && <p className="empty">— vide —</p>}
              {inventory.map((it, i) => (
                <span className="inv-item" key={i}>{it}</span>
              ))}
            </div>
          </div>
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
