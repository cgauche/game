import { useGame } from '../state/store';
import { makePregens } from '../data/pregens';
import { campaign } from '../scenes/campaign';

export function MainMenu() {
  const setScreen = useGame((s) => s.setScreen);
  const setParty = useGame((s) => s.setParty);
  const startScene = useGame((s) => s.startScene);

  /** Raccourci dev : équipe pré-tirée + scène de test, sans passer par les menus. */
  const quickTest = () => {
    setParty(makePregens().slice(0, 4));
    startScene(campaign[0].scene);
    setScreen('campaign');
  };

  return (
    <div className="menu">
      <div className="menu-card">
        <h1 className="title">Warhammer Fantasy</h1>
        <p className="subtitle">Jeu de Rôle — 4ᵉ édition · RPG tactique au tour par tour</p>
        <div className="menu-buttons">
          <button className="btn btn-primary" onClick={() => setScreen('party')}>
            Nouvelle partie
          </button>
          <button className="btn" onClick={() => setScreen('editor')}>
            Éditeur de niveau
          </button>
          <button className="btn btn-test" onClick={quickTest}>
            🧪 Test rapide — équipe pré-tirée + scène
          </button>
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
    </div>
  );
}
