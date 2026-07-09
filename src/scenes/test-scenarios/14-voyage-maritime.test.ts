import { describe, it, expect, beforeEach } from 'vitest';
import { useGame } from '../../state/store';
import { testScenarios } from './index';
import { seedBattleRng } from '../../state/battleRng';

const scen = testScenarios.find((s) => s.id === 'voyage-maritime')!;
const get = () => useGame.getState();

/** Lance le scénario EXACTEMENT comme le menu (setParty → loadProject → money → vessel). */
function launch(seed = 1) {
  seedBattleRng(seed);
  const g = get();
  g.setParty(scen.makeParty());
  g.loadProject([scen.scene, ...(scen.extraScenes ?? [])], scen.scene.id, scen.worldMap ?? null);
  if (scen.money) useGame.setState({ money: scen.money });
  if (scen.vessel) useGame.setState({ vessel: scen.vessel });
}

/** Dort à une halte de nuit (« Dormir » → cascade de nuit → reprise de la route au matin). */
function sleepThroughHalt(): void {
  get().restSleep();
  let guard = 0;
  while (get().pendingCascade && guard++ < 80) {
    const p = get().pendingCascade!;
    const cur = p.participants[p.cursor];
    if (cur.target != null && !cur.result) get().cascadeRoll(cur.id);
    get().cascadeNext();
  }
}

/** Déroule la traversée jusqu'à l'ACCOSTAGE (travelPlan retombé à null + scène du port d'arrivée) : roule les
 *  Tests d'équipage, saute les Activités, dort aux haltes. Renvoie les `kind` de Tests d'équipage rencontrés. */
function sailToPort(maxSteps = 400): string[] {
  const kinds: string[] = [];
  for (let i = 0; i < maxSteps; i++) {
    if (!get().travelPlan && get().scene?.id === 'test-mer-arrivee') break; // arrivé
    const ct = get().pendingCrewTest;
    if (ct) {
      kinds.push(ct.voyage!.kind);
      for (const part of ct.participants) if (!part.result) get().crewTestRoll(part.id);
      get().crewTestConfirm();
      if (get().pendingCrewTest?.resolved) get().crewTestContinue();
      continue;
    }
    if (get().pendingSeaActivities) { get().seaActivitiesConfirm({}); continue; }
    if (get().pendingRest) { sleepThroughHalt(); continue; }
    if (get().pendingShoreLeave) { get().resolveShoreLeave(true); continue; } // accoste : relâche accordée par défaut (MDG 15 l.245)
    if (!get().travelPlan) break; // sécurité : plus de plan et pas au port → on s'arrête
  }
  return kinds;
}

describe('Scénario Voyage maritime — enregistrement & carte', () => {
  it('est dans la section Naval, avec route MARITIME (milles) entre 2 ports dont un à phare + le navire de campagne', () => {
    expect(scen.category).toBe('naval');
    expect(scen.vessel?.vehicleId).toBe('cogue');
    const route = scen.worldMap!.routes.find((r) => r.id === 'route-marienburg')!;
    expect(route.sea).toBe(true);
    expect(route.modes).toContain('mer');
    const marienburg = scen.worldMap!.places.find((p) => p.id === 'p-marienburg')!;
    expect(marienburg.port).toBeTruthy();
    expect(marienburg.port!.lighthouse).toBe(true);
    expect(scen.extraScenes?.some((s) => s.id === 'test-mer-arrivee')).toBe(true);
  });
});

describe('Scénario Voyage maritime — traversée JOUABLE de bout en bout', () => {
  beforeEach(() => launch(1));

  it('appareille, enchaîne des jours de mer (Tests d’équipage + haltes) et ACCOSTE au Grand Port', () => {
    const t0 = get().gameTime;
    expect(get().scene?.id).toBe('test-mer-depart');
    get().startTravel('route-marienburg', 'mer'); // mode MER : appareillage sur le navire de campagne
    expect(get().travelPlan?.mode).toBe('mer');
    expect(get().travelPlan?.sea).toBeTruthy();

    const kinds = sailToPort();

    // ARRIVÉE : la traversée est finie, on est à Marienburg, plusieurs jours ont passé.
    expect(get().travelPlan).toBeNull();
    expect(get().scene?.id).toBe('test-mer-arrivee');
    expect(get().gameTime - t0).toBeGreaterThanOrEqual(2 * 24 * 60); // ≥ 2 jours de mer
    // Les Tests d’équipage de VOYAGE ont bien été joués (Progression quotidienne, Orientation).
    expect(kinds).toContain('progression');
    expect(kinds).toContain('orientation');
    // La coque partie endommagée a fait l’objet d’un entretien du soir (Test d’équipage d’entretien).
    expect(kinds).toContain('entretien');
    expect(get().journal.join('\n')).toMatch(/Accostage|Marienburg/);
  });

  it('à quai : l’écran Port ouvre et propose réparation + offres de commerce', () => {
    get().startTravel('route-marienburg', 'mer');
    sailToPort();
    expect(get().scene?.id).toBe('test-mer-arrivee');

    // Coque endommagée persistée sur le navire de campagne → réparable au chantier (1 CO/Blessure).
    const woundsBefore = get().vessel!.wounds!.current;
    expect(woundsBefore).toBeLessThan(get().vessel!.wounds!.max);
    const goldBefore = get().money.gold;
    get().portRepair();
    expect(get().vessel!.wounds!.current).toBe(get().vessel!.wounds!.max); // remise à neuf
    expect(get().money.gold).toBeLessThan(goldBefore); // 1 CO par Blessure

    // Écran Port : offres de commerce du grand port cosmopolite (Production + Surplus).
    get().openPort();
    expect(get().port!.placeId).toBe('p-marienburg');
    expect(get().port!.offers.length).toBeGreaterThan(0);
  });
});
