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

  it('effet transition vers scène inconnue → erreur', () => {
    const s = base();
    s.triggers.push({ id: 't-0', rect: { x: 0, y: 0, w: 1, h: 1 }, effects: [{ type: 'transition', scene: 'nope' }] });
    expect(msgs(validateScene([s])).some((m) => /scène inexistante/.test(m))).toBe(true);
  });

  it('trigger hors carte → avertissement', () => {
    const s = base();
    s.triggers.push({ id: 't-1', rect: { x: 4, y: 4, w: 3, h: 3 }, effects: [] });
    expect(msgs(validateScene([s])).some((m) => /déborde/.test(m))).toBe(true);
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

  it('effet imbriqué dans un Test (onSuccess) est validé', () => {
    const s = base();
    s.triggers.push({
      id: 't-2',
      rect: { x: 0, y: 0, w: 1, h: 1 },
      effects: [{ type: 'test', onSuccess: [{ type: 'startDialogue', dialogue: 'absent' }] }],
    });
    expect(msgs(validateScene([s])).some((m) => /dialogue inexistant/.test(m))).toBe(true);
  });

  it('zoneBlast : formule de dégâts manquante → erreur ; centre hors carte → avertissement', () => {
    const s = base(); // 5×5
    s.triggers.push({ id: 't-zb', rect: { x: 0, y: 0, w: 1, h: 1 }, effects: [{ type: 'zoneBlast', center: { x: 9, y: 9 }, radius: 2, damage: '' }] });
    const m = msgs(validateScene([s]));
    expect(m.some((x) => /formule de dégâts manquante/.test(x))).toBe(true);
    expect(m.some((x) => /centre.*hors de la carte/.test(x))).toBe(true);
  });

  it('zoneBlast bien formé = 0 avertissement', () => {
    const s = base();
    s.triggers.push({ id: 't-zb2', rect: { x: 0, y: 0, w: 1, h: 1 }, effects: [{ type: 'zoneBlast', center: { x: 2, y: 2 }, radius: 2, damage: '1d10+15' }] });
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
