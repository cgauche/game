import { describe, it, expect, beforeEach } from 'vitest';
import { useGame } from './store';
import type { Combatant } from '../engine/types';

const hero = (): Combatant =>
  ({
    id: 'h', name: 'H', kind: 'hero',
    characteristics: { CC: 40, CT: 40, F: 35, E: 35, I: 30, Ag: 35, Dex: 30, Int: 30, FM: 30, Soc: 30 },
    wounds: { current: 10, max: 10 }, advantage: 0, conditions: [], weapons: [], armour: {}, skills: [], talents: [], movement: 4, items: [],
  }) as unknown as Combatant;

/**
 * Écran de victoire — assignation du butin : `giveItemToHero` retire l'objet du stock de groupe ET du
 * butin affiché, puis l'ajoute à l'inventaire perso du héros (via `addItemToHero`, flux marchand mutualisé).
 */
describe('giveItemToHero — assignation du butin de victoire', () => {
  beforeEach(() => {
    useGame.setState({ party: [hero()], inventory: ['Épée', 'Babiole'], pendingVictory: { xp: 50, gold: { gold: 1, silver: 0, brass: 0 }, loot: ['Épée', 'Babiole'], defeated: [] } });
  });

  it('retire l’objet du stock de groupe et du butin de l’écran', () => {
    useGame.getState().giveItemToHero('Épée', 'h');
    const st = useGame.getState();
    expect(st.inventory).toEqual(['Babiole']); // retiré du stock de groupe
    expect(st.pendingVictory?.loot).toEqual(['Babiole']); // retiré du butin affiché
  });

  it('objet absent du stock → no-op', () => {
    useGame.getState().giveItemToHero('Inexistant', 'h');
    expect(useGame.getState().inventory).toEqual(['Épée', 'Babiole']);
  });

  it('dismissVictory ferme l’écran et revient à l’exploration', () => {
    useGame.setState({ battle: { over: 'victory' } as never });
    useGame.getState().dismissVictory();
    const st = useGame.getState();
    expect(st.pendingVictory).toBeNull();
    expect(st.battle).toBeNull();
    expect(st.mode).toBe('exploration');
  });
});

/**
 * Écran de victoire — ÉQUIPEMENT (giveTrapping) : attribuable au héros choisi, qualités/skin conservés
 * (ne part plus d'office au 1er héros) ; non attribué → 1er héros à la fermeture (rien de perdu).
 */
describe('assignVictoryGear — équipement attribuable, qualités conservées', () => {
  const gearEntry = () => ({
    label: 'Dague', magic: true,
    effect: { type: 'giveTrapping', trapping: 'Dague', qualities: ['Dévastatrice'], identified: false },
  });
  beforeEach(() => {
    useGame.setState({
      party: [hero()], inventory: [],
      pendingVictory: { xp: 0, gold: { gold: 0, silver: 0, brass: 0 }, loot: [], gear: [gearEntry()], defeated: [] } as never,
    });
  });

  it('l’équipement n’est PAS donné tant qu’on n’a pas choisi le héros', () => {
    expect(useGame.getState().party[0].items?.length ?? 0).toBe(0);
    expect(useGame.getState().pendingVictory?.gear?.length).toBe(1);
  });

  it('assignVictoryGear donne l’objet au héros choisi avec ses qualités (non identifié)', () => {
    useGame.getState().assignVictoryGear(0, 'h');
    const it = useGame.getState().party[0].items?.find((x) => /dague/i.test(x.name));
    expect(it).toBeTruthy();
    expect(it!.identified).toBe(false); // flag « non identifié » conservé
    expect((it!.qualities ?? []).length).toBeGreaterThan(0); // qualité magique conservée
    expect(useGame.getState().pendingVictory?.gear?.length).toBe(0); // retiré du butin de l'écran
  });

  it('équipement non attribué → 1er héros à la fermeture (rien de perdu)', () => {
    useGame.setState({ battle: { over: 'victory' } as never });
    useGame.getState().dismissVictory();
    const it = useGame.getState().party[0].items?.find((x) => /dague/i.test(x.name));
    expect(it).toBeTruthy();
  });
});
