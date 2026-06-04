import { lazy, Suspense } from 'react';
import { useGame } from '../state/store';
import { MainMenu } from './MainMenu';
import { PartyScreen } from './PartyScreen';
import { CharacterCreator } from './CharacterCreator';

// Le rendu de jeu (iso SVG + sprites du bestiaire) et l'éditeur d'authoring ne
// sont pas nécessaires à l'écran menu : chunks async séparés (React.lazy) pour
// alléger le démarrage. Un joueur n'ouvre jamais l'éditeur.
const CampaignView = lazy(() => import('./CampaignView').then((m) => ({ default: m.CampaignView })));
const Editor = lazy(() => import('./editor/Editor').then((m) => ({ default: m.Editor })));

export function App() {
  const screen = useGame((s) => s.screen);
  return (
    <div className="app">
      <Suspense fallback={<div className="stage-hint">Chargement…</div>}>
        {screen === 'menu' && <MainMenu />}
        {screen === 'party' && <PartyScreen />}
        {screen === 'creator' && <CharacterCreator />}
        {screen === 'campaign' && <CampaignView />}
        {screen === 'editor' && <Editor />}
      </Suspense>
    </div>
  );
}
