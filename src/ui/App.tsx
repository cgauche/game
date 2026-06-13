import { lazy, Suspense, useEffect } from 'react';
import { useGame } from '../state/store';
import { loadHouseRules } from '../state/houseRules';
import { MainMenu } from './MainMenu';
import { PartyScreen } from './PartyScreen';
import { CharacterCreator } from './creator/CharacterCreator';

// Le rendu de jeu (iso SVG + sprites du bestiaire) et l'éditeur d'authoring ne
// sont pas nécessaires à l'écran menu : chunks async séparés (React.lazy) pour
// alléger le démarrage. Un joueur n'ouvre jamais l'éditeur.
const CampaignView = lazy(() => import('./CampaignView').then((m) => ({ default: m.CampaignView })));
const Editor = lazy(() => import('./editor/Editor').then((m) => ({ default: m.Editor })));
const TestScenariosScreen = lazy(() => import('./TestScenariosScreen').then((m) => ({ default: m.TestScenariosScreen })));
const InterludeScreen = lazy(() => import('./InterludeScreen').then((m) => ({ default: m.InterludeScreen })));
const CoopLobby = lazy(() => import('./CoopLobby').then((m) => ({ default: m.CoopLobby })));
const CompendiumScreen = lazy(() => import('./compendium/CompendiumScreen').then((m) => ({ default: m.CompendiumScreen })));

/** Bannière coop non bloquante : reconnexions en cours (invité comme hôte). */
function CoopBanner() {
  const net = useGame((s) => s.net);
  if (net.mode === 'guest' && net.connection === 'reconnecting')
    return <div className="coop-banner">🔌 Reconnexion en cours…</div>;
  if (net.mode === 'guest' && net.hostAway)
    return <div className="coop-banner">⏳ L'hôte est déconnecté — la partie reprendra à son retour.</div>;
  if (net.mode === 'host') {
    const away = Object.entries(net.presence)
      .filter(([, p]) => p === 'away')
      .map(([s]) => net.seatNames[Number(s)] ?? `Joueur ${Number(s) + 1}`);
    if (away.length) return <div className="coop-banner">🔌 {away.join(', ')} : reconnexion en cours…</div>;
  }
  return null;
}

export function App() {
  const screen = useGame((s) => s.screen);
  // Règles maison persistées → registre (avant tout jet) ; lien d'invitation ?join=CODE → écran coop.
  useEffect(() => {
    loadHouseRules();
    if (new URLSearchParams(location.search).get('join')) useGame.getState().setScreen('coop');
  }, []);
  return (
    <div className="app">
      <CoopBanner />
      <Suspense fallback={<div className="lazy-fallback" role="status"><span aria-hidden>⚜</span> Chargement…</div>}>
        {screen === 'menu' && <MainMenu />}
        {screen === 'party' && <PartyScreen />}
        {screen === 'creator' && <CharacterCreator />}
        {screen === 'campaign' && <CampaignView />}
        {screen === 'editor' && <Editor />}
        {screen === 'test' && <TestScenariosScreen />}
        {screen === 'interlude' && <InterludeScreen />}
        {screen === 'coop' && <CoopLobby />}
        {screen === 'compendium' && <CompendiumScreen />}
      </Suspense>
    </div>
  );
}
