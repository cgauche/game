import { useGame } from '../state/store';
import { MainMenu } from './MainMenu';
import { PartyScreen } from './PartyScreen';
import { CharacterCreator } from './CharacterCreator';
import { CampaignView } from './CampaignView';
import { Editor } from './editor/Editor';

export function App() {
  const screen = useGame((s) => s.screen);
  return (
    <div className="app">
      {screen === 'menu' && <MainMenu />}
      {screen === 'party' && <PartyScreen />}
      {screen === 'creator' && <CharacterCreator />}
      {screen === 'campaign' && <CampaignView />}
      {screen === 'editor' && <Editor />}
    </div>
  );
}
