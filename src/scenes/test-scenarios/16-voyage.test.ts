import { describe, it, expect, afterEach } from 'vitest';
import { useGame } from '../../state/store';
import { setRule, resetRule } from '../../engine/policy';
import { seedBattleRng } from '../../state/battleRng';
import { scenario } from './16-voyage';

describe('16-voyage — intégration Voyage par Étapes', () => {
  afterEach(() => resetRule('travel-etapes'));
  it('règle pré-activée → postes résolus, véhicule à coque bâti, météo d’Étape journalisée', () => {
    for (const [id, v] of Object.entries(scenario.rules ?? {})) setRule(id, v as any);
    seedBattleRng(7);
    useGame.getState().setParty(scenario.makeParty());
    // La LONGUE route part du hameau : on entre à p-hameau pour la prendre en diligence.
    useGame.getState().loadProject([scenario.scene, ...(scenario.extraScenes ?? [])], 'test-voyage-hameau', scenario.worldMap!);
    useGame.setState({ money: scenario.money as any });
    useGame.getState().startTravel('r-longue', 'diligence', { classKey: 'exterieur' });
    const plan = useGame.getState().travelPlan;
    expect(plan?.vehicle?.bodyShape).toBe('vehicule'); // diligence E45/B50
    const j = useGame.getState().journal;
    expect(j.some((l) => l.includes('Météo'))).toBe(true);
    expect(j.some((l) => l.includes('Plein air') || l.includes('Aux aguets') || l.includes('Cartographie') || l.includes('Approvisionnement'))).toBe(true);
  });
});
