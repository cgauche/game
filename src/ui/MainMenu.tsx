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
        <p className="subtitle">Jeu de Rôle — 4ᵉ édition · RPG tactique au tour par tour</p>
        <div className="menu-buttons">
          <button className="btn btn-primary" onClick={() => setScreen('party')}>
            Nouvelle partie
          </button>
          <button className="btn" onClick={() => setLoadOpen(true)} title={hasSaves ? 'Reprendre une partie sauvegardée' : 'Aucun emplacement rempli — un fichier exporté reste importable'}>
            📂 Charger une partie
          </button>
          <button className="btn" onClick={() => setScreen('coop')}>
            🌐 Jouer en ligne
          </button>
          <button className="btn" onClick={() => setScreen('editor')}>
            Éditeur de niveau
          </button>
          <button className="btn btn-test" onClick={() => setScreen('test')}>
            🧪 Tests — scénarios
          </button>
          <a
            className="btn"
            href="galeries.html"
            target="_blank"
            rel="noopener"
            style={{ textDecoration: 'none', textAlign: 'center', display: 'block' }}
          >
            🎨 Galeries — sprites, animations &amp; bestiaire
          </a>
        </div>
        <p className="hint">
          Composez un groupe de 4 aventuriers (créés ou pré-tirés), puis lancez l'ouverture de la campagne
          impériale <em>L'Ennemi dans l'Ombre</em>. Coopération en local (hotseat).
        </p>
        <p className="footnote">
          Règles et contenu adaptés du Livre de base et des Archives de l'Empire I & II (WFRP 4e). Données
          générées localement.
        </p>
      </div>
      {loadOpen && <SaveLoadModal mode="load" onClose={() => setLoadOpen(false)} />}
    </div>
  );
}
