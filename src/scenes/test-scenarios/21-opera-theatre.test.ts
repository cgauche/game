import { describe, it, expect } from 'vitest';
import { validateScene } from '../../state/validateScene';
import { isWalkable } from '../../state/scene';
import { scenario } from './21-opera-theatre';

/**
 * Le théâtre multi-niveaux est du CONTENU pur (données éditeur). Ce gate vérifie qu'il est
 * structurellement cohérent et passe `validateScene` sans erreur — pas de loge orpheline, pas de
 * prop hors carte, pas d'entité sur un étage inexistant. C'est la preuve « zéro hardcode » : la
 * salle est assemblée avec `levels`/`SceneEntity.z`/props et reste éditable + valide.
 */
describe('Scénario « Opéra — Théâtre » : salle multi-niveaux valide', () => {
  const scene = scenario.scene;

  it('passe validateScene sans erreur (avertissements tolérés)', () => {
    const errors = validateScene([scene]).filter((w) => w.level === 'error');
    expect(errors).toEqual([]);
  });

  it('est bien multi-niveaux : parterre (z0) + galerie de loges (z1)', () => {
    expect(scene.levels.map((l) => l.z).sort()).toEqual([0, 1]);
    // un plancher de loge existe au niveau 1 (loge royale en surplomb)
    expect(isWalkable(scene, 8, 12, 1)).toBe(true);
    // le parterre est marchable au sol sous la loge royale
    expect(isWalkable(scene, 8, 10, 0)).toBe(true);
  });

  it('le mobilier et les PNJ sont posés à leur étage (entités z=1 présentes)', () => {
    const upper = scene.entities.filter((e) => (e.z ?? 0) === 1);
    expect(upper.length).toBeGreaterThan(5);
    // la Comtesse siège dans la loge royale (z1)
    const comtesse = scene.entities.find((e) => e.id === 'comtesse')!;
    expect(comtesse.z).toBe(1);
    expect(comtesse.kind).toBe('personnage');
    // tout prop/PNJ d'étage référence un niveau existant
    const zs = new Set(scene.levels.map((l) => l.z));
    for (const e of scene.entities) expect(zs.has(e.z ?? 0)).toBe(true);
  });
});
