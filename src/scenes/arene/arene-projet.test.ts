import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { validateScene } from '../../state/validateScene';
import { isWalkable, type Scene } from '../../state/scene';
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
  it('11 scènes, entrée = arene-zone1, hub + 10 zones reliées', () => {
    expect(project).toHaveLength(11);
    expect(project[0].id).toBe('arene-zone1');
    const ids = project.map((s) => s.id);
    expect(ids).toContain('arene-hub');
    expect(ids).toContain('arene-zone10'); // L'Antre du Dragon (finale)
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

  it('chaque ennemi spawn sur une case DANS la carte et MARCHABLE (pas sur un mur/eau/décor)', () => {
    const bad: string[] = [];
    for (const sc of project)
      for (const enc of sc.encounters)
        for (const e of enc.enemies) {
          const { x, y } = e.pos;
          const inBounds = x >= 0 && y >= 0 && x < sc.dimensions.w && y < sc.dimensions.h;
          if (!inBounds || !isWalkable(sc, x, y)) bad.push(`${sc.id}:${e.ref ?? '?'}@(${x},${y})`);
        }
    expect(bad).toEqual([]);
  });

  it('couvre les types de rencontre ÉTENDUS : Surprise/embuscade, Nuée (statbloc), Terreur, Test interactif', () => {
    const encs = project.flatMap((s) => s.encounters);
    expect(encs.some((e) => e.surprise === 'party')).toBe(true); // embuscade
    expect(encs.some((e) => e.enemies.some((en) => (en.statblock?.traits ?? []).includes('Nuée')))).toBe(true); // Nuée = statbloc custom
    expect(encs.some((e) => e.enemies.some((en) => en.ref === 'Spectre de cairn'))).toBe(true); // créature Terreur
    const hub = project.find((s) => s.id === 'arene-hub')!;
    const hasTest = hub.dialogues.some((d) => d.nodes.some((n) => n.choices.some((c) => c.effects?.some((ef) => ef.type === 'test'))));
    expect(hasTest).toBe(true); // Effet `test` (Crochetage) avec branches succès/échec
  });

  it('une zone met en scène la CAVALERIE : un cavalier pré-monté + un cheval libre allié (montable)', () => {
    const allEnemies = project.flatMap((s) => s.encounters.flatMap((e) => e.enemies));
    expect(allEnemies.some((e) => e.rides != null)).toBe(true); // cavalier pré-monté (rides → index de la monture)
    expect(allEnemies.some((e) => e.mount && e.side === 'ally')).toBe(true); // monture LIBRE côté héros
  });

  it('FINALE : un boss MONSTRUEUX (4×4) au SOUFFLE de ténèbres (statbloc inline)', () => {
    const dragon = project
      .flatMap((s) => s.encounters.flatMap((e) => e.enemies))
      .find((e) => e.statblock?.size === 'monstrueuse');
    expect(dragon, 'un ennemi de Taille Monstrueuse').toBeTruthy();
    expect((dragon!.statblock!.traits ?? []).some((t) => /Souffle/i.test(t))).toBe(true); // attaque de Souffle
  });

  it('chaque zone est UNIQUE : terrains de base distincts (campagne démo)', () => {
    const zones = project.filter((s) => s.id.startsWith('arene-zone'));
    const bases = zones.map((z) => z.tiles[0]); // 1re tuile = terrain de base
    expect(new Set(bases).size).toBeGreaterThanOrEqual(4); // au moins 4 sols différents sur 10 zones
  });

  it('les ennemis d’une vague sont RÉPARTIS (pas tous dans la même colonne)', () => {
    for (const sc of project.filter((s) => s.id.startsWith('arene-zone'))) {
      const xs = new Set(sc.encounters[0].enemies.map((e) => e.pos.x));
      expect(xs.size, sc.id).toBeGreaterThanOrEqual(2); // au moins 2 colonnes distinctes
    }
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
