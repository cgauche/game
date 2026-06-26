import { flowFromEffects, testFlow, EMPTY_FLOW } from '../state/flow';
import { describe, it, expect } from 'vitest';
import { validateScene, type Warning } from './validateScene';
import { emptyScene } from './scene';

function base() {
  const s = emptyScene(5, 5);
  s.id = 'A';
  return s;
}
const msgs = (w: Warning[]) => w.map((x) => x.message);

describe('validateScene', () => {
  it('scène propre = 0 avertissement', () => {
    expect(validateScene([base()])).toEqual([]);
  });

  it("dialogueId d'entité inexistant → erreur", () => {
    const s = base();
    s.entities.push({ id: 'e-0', kind: 'personnage', pos: { x: 1, y: 1 }, dialogueId: 'manque' });
    const w = validateScene([s]);
    expect(w.some((x) => x.scope === 'entity' && x.refId === 'e-0' && /dialogue inexistant/.test(x.message))).toBe(true);
  });

  it('entité sur un étage inexistant → avertissement', () => {
    const s = base(); // un seul niveau z=0
    s.entities.push({ id: 'e-z', kind: 'personnage', pos: { x: 1, y: 1 }, z: 2 });
    expect(msgs(validateScene([s])).some((m) => /étage 2 inexistant/.test(m))).toBe(true);
  });

  it('effet transition vers scène inconnue → erreur', () => {
    const s = base();
    s.triggers.push({ id: 't-0', rect: { x: 0, y: 0, w: 1, h: 1 }, flow: flowFromEffects([{ type: 'transition', scene: 'nope' }]) });
    expect(msgs(validateScene([s])).some((m) => /scène inexistante/.test(m))).toBe(true);
  });

  it('trigger hors carte → avertissement', () => {
    const s = base();
    s.triggers.push({ id: 't-1', rect: { x: 4, y: 4, w: 3, h: 3 }, flow: flowFromEffects([]) });
    expect(msgs(validateScene([s])).some((m) => /déborde/.test(m))).toBe(true);
  });

  function twoLevel() {
    const s = base(); // 5×5
    const z1 = new Array(25).fill('vide') as string[];
    z1[1 * 5 + 1] = 'plancher'; // (1,1) marchable à l'étage
    s.levels.push({ z: 1, tiles: z1 });
    return s;
  }

  it('escalier valide (parterre→étage marchable, z différent) → 0 avertissement escalier', () => {
    const s = twoLevel();
    s.stairs = [{ from: { x: 1, y: 1, z: 0 }, to: { x: 1, y: 1, z: 1 } }];
    expect(msgs(validateScene([s])).some((m) => /escalier/i.test(m))).toBe(false);
  });

  it('escalier vers un étage inexistant → avertissement', () => {
    const s = twoLevel();
    s.stairs = [{ from: { x: 1, y: 1, z: 0 }, to: { x: 1, y: 1, z: 5 } }];
    expect(msgs(validateScene([s])).some((m) => /escalier.*étage 5 inexistant/i.test(m))).toBe(true);
  });

  it('escalier sur une case non marchable (vide) → avertissement', () => {
    const s = twoLevel();
    s.stairs = [{ from: { x: 1, y: 1, z: 0 }, to: { x: 2, y: 2, z: 1 } }]; // (2,2,1) = vide
    expect(msgs(validateScene([s])).some((m) => /escalier.*non marchable/i.test(m))).toBe(true);
  });

  it('escalier reliant le même étage → avertissement', () => {
    const s = twoLevel();
    s.stairs = [{ from: { x: 1, y: 1, z: 0 }, to: { x: 2, y: 1, z: 0 } }];
    expect(msgs(validateScene([s])).some((m) => /escalier.*même étage/i.test(m))).toBe(true);
  });

  it('ids dupliqués → erreur', () => {
    const s = base();
    s.entities.push({ id: 'dup', kind: 'prop', pos: { x: 0, y: 0 } }, { id: 'dup', kind: 'prop', pos: { x: 1, y: 1 } });
    expect(msgs(validateScene([s])).some((m) => /dupliqué/.test(m))).toBe(true);
  });

  it('building interiorScene vers une scène présente dans le projet = OK', () => {
    const a = base();
    a.buildings = [{ id: 'b', type: 'maison', foot: { x: 0, y: 0, w: 2, h: 2 }, reveal: 'door', interiorScene: 'B' }];
    const b = emptyScene(3, 3);
    b.id = 'B';
    expect(validateScene([a, b]).filter((w) => w.scope === 'building')).toEqual([]);
  });

  it('effet imbriqué dans la branche RÉUSSITE d’un nœud Test est validé', () => {
    const s = base();
    s.triggers.push({
      id: 't-2',
      rect: { x: 0, y: 0, w: 1, h: 1 },
      flow: testFlow({ skill: 'perception' }, flowFromEffects([{ type: 'startDialogue', dialogue: 'absent' }]), EMPTY_FLOW),
    });
    expect(msgs(validateScene([s])).some((m) => /dialogue inexistant/.test(m))).toBe(true);
  });

  it('zoneBlast : aucun effet mécanique → erreur ; centre hors carte → avertissement', () => {
    const s = base(); // 5×5
    s.triggers.push({ id: 't-zb', rect: { x: 0, y: 0, w: 1, h: 1 }, flow: flowFromEffects([{ type: 'zoneBlast', center: { x: 9, y: 9 }, radius: 2, ops: [] }]) });
    const m = msgs(validateScene([s]));
    expect(m.some((x) => /aucun effet mécanique/.test(x))).toBe(true);
    expect(m.some((x) => /centre.*hors de la carte/.test(x))).toBe(true);
  });

  it('zoneBlast bien formé = 0 avertissement', () => {
    const s = base();
    s.triggers.push({ id: 't-zb2', rect: { x: 0, y: 0, w: 1, h: 1 }, flow: flowFromEffects([{ type: 'zoneBlast', center: { x: 2, y: 2 }, radius: 2, ops: [{ op: 'wounds', amount: { dice: { n: 1, sides: 10, plus: 15 } } }] }]) });
    expect(validateScene([s]).filter((w) => /zone/i.test(w.message))).toEqual([]);
  });

  it('musique de scène inconnue au registre → avertissement ; piste réelle / silence / auto = OK', () => {
    const s = base();
    s.music = { ambient: 'piste-fantome', combat: 'musique-combat' };
    expect(msgs(validateScene([s])).some((m) => /Musique .*piste-fantome/.test(m))).toBe(true);
    s.music = { ambient: null, combat: 'musique-combat' }; // silence + piste réelle
    expect(validateScene([s])).toEqual([]);
    s.music = undefined; // automatique
    expect(validateScene([s])).toEqual([]);
  });
});
