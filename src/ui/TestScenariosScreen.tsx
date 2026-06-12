import { useGame } from '../state/store';
import { testScenarios, type TestScenario } from '../scenes/test-scenarios';

/** Sous-écran « Scénarios de test » : chaque scénario fixe un groupe et une scène adaptée. */
export function TestScenariosScreen() {
  const setScreen = useGame((s) => s.setScreen);
  const setParty = useGame((s) => s.setParty);
  const startScene = useGame((s) => s.startScene);
  const loadProject = useGame((s) => s.loadProject);
  const startCombat = useGame((s) => s.startCombat);

  const launch = (sc: TestScenario) => {
    setParty(sc.makeParty());
    // Scénario multi-scènes / avec carte du monde (#T2) → chargé comme un projet ; sinon scène simple.
    if (sc.extraScenes?.length || sc.worldMap) loadProject([sc.scene, ...(sc.extraScenes ?? [])], sc.scene.id, sc.worldMap ?? null);
    else startScene(sc.scene);
    if (sc.money) useGame.setState({ money: sc.money }); // bourse du scénario (après le reset du lancement)
    if (sc.autoCombat) startCombat(sc.autoCombat);
    setScreen('campaign');
  };

  return (
    <div className="menu">
      <div className="menu-card test-scenarios">
        <button className="btn small" onClick={() => setScreen('menu')}>
          ← Retour
        </button>
        <h1 className="title">Scénarios de test</h1>
        <p className="subtitle">Chaque scénario fixe un groupe et une scène adaptée à ce qu'on vérifie.</p>
        <div className="ts-grid">
          {testScenarios.map((sc) => (
            <div className="ts-card" key={sc.id}>
              <div className="ts-head">
                <span className="ts-ico">{sc.icon}</span>
                <strong>{sc.title}</strong>
              </div>
              <p className="ts-tests">{sc.tests}</p>
              <p className="ts-party">👥 {sc.partyNote}</p>
              <button className="btn btn-primary" onClick={() => launch(sc)}>
                Lancer
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
