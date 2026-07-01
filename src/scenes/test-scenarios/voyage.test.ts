import { describe, it, expect, afterEach } from 'vitest';
import { useGame } from '../../state/store';
import { setRule, resetRule } from '../../engine/policy';
import { seedBattleRng } from '../../state/battleRng';
import { scenario } from './voyage';

/** Les 5 sous-scènes sont désormais produites par `buildScene(MapSpec)` (WorldMap/extraScenes restent sur
 *  le TestScenario). Ce bloc verrouille l'équivalence en jeu des Scenes PRODUITES : dimensions, terrain,
 *  météo/repos, entités/dialogues déclaratifs, et l'embuscade cachée (members + hiddenUntilCombat). */
describe('16-voyage — Scenes produites par buildScene', () => {
  const byId = (id: string) => [scenario.scene, ...(scenario.extraScenes ?? [])].find((s) => s.id === id)!;

  it('produit les 5 sous-scènes attendues (village + 4 extra), la scène d’entrée = le village', () => {
    expect(scenario.scene.id).toBe('test-voyage-village');
    expect((scenario.extraScenes ?? []).map((s) => s.id)).toEqual([
      'test-voyage-hameau', 'test-voyage-bourg', 'test-voyage-cite', 'test-voyage-embuscade',
    ]);
  });

  it('village : 14×9, pluie, auberge, départ (3,4), aubergiste + dialogue', () => {
    const v = byId('test-voyage-village');
    expect(v.dimensions).toEqual({ w: 14, h: 9 });
    expect(v.weather).toBe('pluie');
    expect(v.rest).toEqual({ auberge: true });
    expect(v.entities.find((e) => e.kind === 'heroStart')?.pos).toEqual({ x: 3, y: 4 });
    expect(v.entities.find((e) => e.id === 'aubergiste')?.dialogueId).toBe('dlg-auberge');
    expect(v.dialogues.find((d) => d.id === 'dlg-auberge')).toBeTruthy();
  });

  it('cité : cercle runique + trigger d’interlude (rect 5,3,3×3)', () => {
    const c = byId('test-voyage-cite');
    expect(c.entities.find((e) => e.id === 'cercle')?.ref).toBe('cercle-runique');
    const interlude = c.triggers.find((t) => t.id === 'interlude')!;
    expect(interlude.rect).toEqual({ x: 5, y: 3, w: 3, h: 3 });
  });

  it('embuscade : 2 gobelins cachés (hiddenUntilCombat) + rencontre surprise « party »', () => {
    const e = byId('test-voyage-embuscade');
    const enc = e.encounters.find((x) => x.id === 'enc-vembuscade')!;
    expect(enc.surprise).toBe('party');
    expect(enc.members).toEqual([{ entityId: 'enemy-enc-vembuscade-0' }, { entityId: 'enemy-enc-vembuscade-1' }]);
    const gobs = e.entities.filter((x) => x.ref === 'gobelin');
    expect(gobs).toHaveLength(2);
    expect(gobs.every((g) => g.combat?.hiddenUntilCombat === true)).toBe(true);
    expect(gobs.map((g) => g.pos)).toEqual([{ x: 9, y: 3 }, { x: 10, y: 5 }]);
  });
});

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
