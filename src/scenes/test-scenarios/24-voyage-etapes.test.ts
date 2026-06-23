import { describe, it, expect, afterEach } from 'vitest';
import { useGame } from '../../state/store';
import { setRule, resetRule } from '../../engine/policy';
import { seedBattleRng } from '../../state/battleRng';
import { scenario } from './24-voyage-etapes';

describe('24-voyage-etapes — intégration Voyage par Étapes', () => {
  afterEach(() => resetRule('travel-etapes'));
  it('règle pré-activée → postes résolus, véhicule à coque bâti, météo d’Étape journalisée', () => {
    for (const [id, v] of Object.entries(scenario.rules ?? {})) setRule(id, v as any);
    seedBattleRng(7);
    useGame.getState().setParty(scenario.makeParty());
    useGame.getState().loadProject([scenario.scene, ...(scenario.extraScenes ?? [])], scenario.scene.id, scenario.worldMap!);
    useGame.setState({ money: scenario.money as any });
    // Diligence : coque bâtie, voyage long → halte → plan persiste.
    useGame.getState().startTravel('r-drakenmoor', 'diligence', { classKey: 'exterieur' });
    const plan = useGame.getState().travelPlan;
    expect(plan?.vehicle?.bodyShape).toBe('vehicule'); // diligence E45/B50
    const j = useGame.getState().journal;
    expect(j.some((l) => l.includes('Météo'))).toBe(true);
    expect(j.some((l) => l.includes('Plein air') || l.includes('Aux aguets') || l.includes('Cartographie') || l.includes('Approvisionnement'))).toBe(true);
  });
});
