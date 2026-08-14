import { afterEach, describe, expect, it } from 'vitest';
import { getStageBackend, setStageBackend, toggleStageBackend } from './stage3d';
import { snapshotSave } from './saves';
import { useGame } from './store';

/**
 * L'interrupteur de voie de rendu (#1176) décrit le CHANTIER, pas le monde : il ne doit jamais partir
 * dans une sauvegarde. La preuve ne peut pas être « il n'est pas dans la liste » — `snapshotSave` copie
 * TOUTE clé de données de l'état initial, sans liste : on sonde donc le document PRODUIT, avec
 * l'interrupteur volontairement basculé.
 */
afterEach(() => setStageBackend('webgl'));

describe('Voie de rendu du monde — interrupteur de chantier', () => {
  it('la voie VOLUMIQUE est le défaut (le jeu se joue dans le monde volumique, prod comprise)', () => {
    expect(getStageBackend()).toBe('webgl');
  });

  it('la bascule fait l’aller-retour (la voie affine reste joignable, en secours)', () => {
    expect(toggleStageBackend()).toBe('affine');
    expect(getStageBackend()).toBe('affine');
    expect(toggleStageBackend()).toBe('webgl');
  });

  it('la voie choisie n’entre PAS dans la sauvegarde (ni clé, ni valeur)', () => {
    setStageBackend('webgl');
    const save = snapshotSave(
      useGame.getState() as unknown as Record<string, unknown>,
      useGame.getInitialState() as unknown as Record<string, unknown>,
      new Date(0).toISOString(),
    );
    expect(Object.keys(save.data).some((k) => /stage3d|stageBackend|webgl/i.test(k))).toBe(false);
    expect(Object.values(save.data)).not.toContain('webgl');
    // …et la sauvegarde ne la porte pas davantage sous une forme imbriquée.
    expect(JSON.stringify(save.data)).not.toContain('webgl');
  });

  it('charger une partie ne touche pas la voie de rendu (elle vit hors de l’état de jeu)', () => {
    setStageBackend('affine'); // écartée du défaut : un retour au défaut au chargement se verrait
    useGame.setState(JSON.parse(JSON.stringify(useGame.getInitialState())) as Record<string, never>);
    expect(getStageBackend()).toBe('affine');
  });
});
