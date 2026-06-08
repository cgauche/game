import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { validateScene } from '../../state/validateScene';
import type { Scene } from '../../state/scene';
import { findCreature, findTrapping } from '../../data';
import { MERCHANTS } from '../../state/merchants/index';

/**
 * L'arène est un PROJET de données pures (créable/éditable dans l'éditeur) qui tourne sur le moteur
 * existant — aucun code applicatif dédié. Ce test verrouille que le JSON est VALIDE (transitions,
 * dialogues, ids) et que chaque ennemi référence une vraie créature du bestiaire (sinon mannequin B10).
 */
const project = JSON.parse(
  readFileSync(join(__dirname, 'arene-projet.json'), 'utf8'),
) as Scene[];

describe('Arène — projet de données (zéro code applicatif)', () => {
  it('5 scènes, entrée = arene-zone1, hub + 4 zones reliées', () => {
    expect(project).toHaveLength(5);
    expect(project[0].id).toBe('arene-zone1');
    const ids = project.map((s) => s.id);
    expect(ids).toContain('arene-hub');
    expect(ids).toContain('arene-zone4');
  });

  it('validateScene(projet) ne lève AUCUNE erreur (transitions/dialogues/ids OK)', () => {
    const errors = validateScene(project).filter((w) => w.level === 'error');
    expect(errors).toEqual([]);
  });

  it('chaque ennemi référence une vraie créature (pas de mannequin B10)', () => {
    const missing: string[] = [];
    for (const sc of project)
      for (const enc of sc.encounters)
        for (const e of enc.enemies)
          if (e.ref && !findCreature(e.ref)) missing.push(`${sc.id}:${e.ref}`);
    expect(missing).toEqual([]);
  });

  it('boucle complète : chaque zone se solde par un retour au hub (transition)', () => {
    for (const z of project.filter((s) => s.id.startsWith('arene-zone'))) {
      const ov = z.encounters[0]?.onVictory ?? [];
      expect(ov.some((e) => e.type === 'transition' && e.scene === 'arene-hub')).toBe(true);
      expect(ov.some((e) => e.type === 'setFlag')).toBe(true);
    }
  });

  it('le hub ouvre la zone suivante via flags (porte gated zoneN_clear)', () => {
    const hub = project.find((s) => s.id === 'arene-hub')!;
    const door = hub.dialogues.find((d) => d.id === 'dlg-hub')!;
    const choices = door.nodes[0].choices;
    const doors = choices.filter((c) => c.effects?.some((e) => e.type === 'transition' && e.scene.startsWith('arene-zone')));
    expect(doors.length).toBeGreaterThanOrEqual(3); // zones 2,3,4 ouvertes par progression
    expect(doors.every((c) => /clear/.test(c.condition ?? ''))).toBe(true);
  });

  it('le hub a un Médecin (LDB 75) qui vend des soins ET des prothèses, curatifs garantis', () => {
    const hub = project.find((s) => s.id === 'arene-hub')!;
    const medecin = hub.entities.find((e) => e.id === 'medecin');
    expect(medecin?.merchant?.archetype).toBe('medecin');
    const arch = MERCHANTS['medecin'];
    expect(arch).toBeTruthy();
    expect(arch.category.subTypes).toContain('Herbes et potions');
    expect(arch.category.subTypes).toContain('Prothèses');
    // tous les articles garantis (curated) référencent un vrai trapping
    for (const label of arch.curated ?? []) expect(findTrapping(label), label).toBeTruthy();
  });
});
