import { useState } from 'react';
import { useGame } from '../state/store';
import { listSaves } from '../state/saves';
import { SaveLoadModal } from './SaveLoadModal';

export function MainMenu() {
  const setScreen = useGame((s) => s.setScreen);
  const [loadOpen, setLoadOpen] = useState(false);
  const hasSaves = listSaves().some((m) => m != null);

  return (
    <div className="menu">
      <div className="menu-card">
        <h1 className="title">Warhammer Fantasy</h1>
        <p className="subtitle">Jeu de Rôle — 4ᵉ édition · La campagne <em>L'Ennemi Intérieur</em></p>
        <div className="rule-fleur" aria-hidden>⚜</div>
        <div className="menu-buttons">
          <button className="btn btn-primary" onClick={() => setScreen('party')}>
            ⚔️ Nouvelle partie
          </button>
          <button className="btn" onClick={() => setLoadOpen(true)} title={hasSaves ? 'Reprendre une partie sauvegardée' : 'Aucun emplacement rempli — un fichier exporté reste importable'}>
            📂 Charger une partie
          </button>
          <button className="btn" onClick={() => setScreen('coop')}>
            🌐 Jouer en ligne
          </button>
        </div>
        <div className="rule-fleur menu-tools-rule" aria-hidden>Atelier</div>
        <div className="menu-buttons menu-tools">
          <button className="btn" onClick={() => setScreen('editor')}>
            🏗️ Éditeur de niveau
          </button>
          <button className="btn btn-test" onClick={() => setScreen('test')}>
            🧪 Scénarios de test
          </button>
          <a className="btn menu-link" href="galeries.html" target="_blank" rel="noopener">
            🎨 Galeries d'art
          </a>
        </div>
        <p className="footnote">
          Groupe de 4 aventuriers · tactique au tour par tour · coop en ligne par code. Règles et contenu
          adaptés du Livre de base et des Archives de l'Empire I &amp; II (WFRP 4e).
        </p>
      </div>
      {loadOpen && <SaveLoadModal mode="load" onClose={() => setLoadOpen(false)} />}
    </div>
  );
}
