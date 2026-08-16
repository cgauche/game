import { useGame } from '../state/store';
import { creditBourse } from '../state/bourseFlow';
import { setRule } from '../engine/policy';
import { testScenarios, type TestScenario, type ScenarioCategory } from '../scenes/test-scenarios';
import { SCENARIO_SECTIONS } from '../scenes/test-scenarios/_shared';
import { Icon } from './Icon';
import { MenuCard, MenuCardHead } from './MenuCard';

type Section = (typeof SCENARIO_SECTIONS)[number];

/** Regroupe les scénarios (déjà triés par `order`) par section, dans l'ordre de `SCENARIO_SECTIONS`. */
function groupBySection(list: TestScenario[]): { section: Section; items: TestScenario[] }[] {
  const byCat = new Map<ScenarioCategory, TestScenario[]>();
  for (const sc of list) {
    const bucket = byCat.get(sc.category) ?? [];
    bucket.push(sc);
    byCat.set(sc.category, bucket);
  }
  return SCENARIO_SECTIONS.filter((s) => byCat.has(s.key)).map((s) => ({ section: s, items: byCat.get(s.key)! }));
}

/** Sous-écran « Scénarios de test » : chaque scénario fixe un groupe et une scène adaptée. */
export function TestScenariosScreen() {
  const setScreen = useGame((s) => s.setScreen);
  const setParty = useGame((s) => s.setParty);
  const startScene = useGame((s) => s.startScene);
  const loadProject = useGame((s) => s.loadProject);
  const startCombat = useGame((s) => s.startCombat);

  const launch = (sc: TestScenario) => {
    if (sc.rules) for (const [id, v] of Object.entries(sc.rules)) setRule(id, v); // règles pré-activées (modifiables en jeu)
    setParty(sc.makeParty());
    // Scénario multi-scènes / avec carte du monde (#T2) / avec narratif (presets #671) → chargé comme
    // un projet (le narratif est posé pour résoudre les `presetId`) ; sinon scène simple.
    if (sc.extraScenes?.length || sc.worldMap || sc.narratif) loadProject([sc.scene, ...(sc.extraScenes ?? [])], sc.scene.id, sc.worldMap ?? null, sc.narratif);
    else startScene(sc.scene);
    const scLead = useGame.getState().party[0];
    if (sc.money && scLead) creditBourse(useGame.getState, useGame.setState, scLead.id, sc.money); // seed de bourse du scénario (après le reset du lancement)
    if (sc.vessel) useGame.setState({ vessel: sc.vessel }); // navire de campagne (voyage/combat maritime) — après le reset
    if (sc.autoCombat) startCombat(sc.autoCombat);
    // Bataille de masse (ADE II 08) : startMassBattle bascule lui-même sur l'écran dédié.
    if (sc.massBattle) { useGame.getState().startMassBattle(sc.massBattle); return; }
    setScreen('campaign');
  };

  return (
    <div className="menu">
      <MenuCard
        className="test-scenarios"
        header={<MenuCardHead
          lead={<button type="button" className="btn small btn-ghost menu-back" onClick={() => setScreen('menu')}>
            <Icon id="ui/undo" size="sm" /> Retour
          </button>}
          title="Scénarios de test"
          sub="Chaque scénario fixe un groupe et une scène adaptée à ce qu'on vérifie."
        />}
      >
        {groupBySection(testScenarios).map((sec) => (
          <section className="ts-section" key={sec.section.key}>
            <h2 className="mini-title"><Icon id={sec.section.icon} size="sm" /> {sec.section.label}</h2>
            <div className="ts-grid">
              {sec.items.map((sc) => (
                <div className="ts-card" key={sc.id}>
                  <div className="ts-head">
                    <span className="ts-ico"><Icon id={sc.icon} size={20} /></span>
                    <strong>{sc.title}</strong>
                  </div>
                  <p className="ts-tests" title={sc.tests}>{sc.tests}</p>
                  <p className="ts-party">{sc.partyNote}</p>
                  {/* Ancrage de RECETTE (#1335) : l'id du scénario, stable au reload — le libellé et
                      l'ordre des cartes ne le sont pas. Aucun effet de style. */}
                  <button className="btn btn-primary" data-testid={`scenario-launch-${sc.id}`} onClick={() => launch(sc)}>
                    Lancer
                  </button>
                </div>
              ))}
            </div>
          </section>
        ))}
      </MenuCard>
    </div>
  );
}
