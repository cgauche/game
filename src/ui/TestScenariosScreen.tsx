import { useGame } from '../state/store';
import { testScenarios, type TestScenario } from '../scenes/test-scenarios';

/** Sous-écran « Scénarios de test » : chaque scénario fixe un groupe et une scène adaptée. */
export function TestScenariosScreen() {
  const setScreen = useGame((s) => s.setScreen);
  const setParty = useGame((s) => s.setParty);
  const startScene = useGame((s) => s.startScene);
  const startCombat = useGame((s) => s.startCombat);

  const launch = (sc: TestScenario) => {
    setParty(sc.makeParty());
    startScene(sc.scene);
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
