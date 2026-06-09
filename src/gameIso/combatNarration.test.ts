import { describe, it, expect } from 'vitest';
import { narrateLine, combatFeed } from './combatNarration';

const ally = { id: 'h1', name: 'Bidule', kind: 'hero' };
const ally2 = { id: 'h2', name: 'Grunni', kind: 'hero' };
const foe = { id: 'e1', name: 'Machin', kind: 'monster' };
const foe2 = { id: 'e2', name: 'Rat géant', kind: 'monster' };
const cs = [ally, ally2, foe, foe2] as any;

describe('narrateLine — icône unifiée par type d’événement', () => {
  it('charge → ✊ et important (passe au bandeau)', () => {
    const n = narrateLine('Machin charge Bidule', cs);
    expect(n.icon).toBe('✊');
    expect(n.important).toBe(true);
  });
  it('tir → 🏹', () => {
    expect(narrateLine('Grunni tire sur Machin — 5 dégâts', cs).icon).toBe('🏹');
  });
  it('attaque mêlée → ⚔️', () => {
    expect(narrateLine('Bidule attaque Machin', cs).icon).toBe('⚔️');
  });
  it('posture défensive → 🛡️ et important', () => {
    const n = narrateLine('Bidule se met en position défensive', cs);
    expect(n.icon).toBe('🛡️');
    expect(n.important).toBe(true);
  });
  it('viser → 🎯', () => {
    expect(narrateLine('Grunni commence à viser', cs).icon).toBe('🎯');
  });
  it('état Sonné → icône de effectIcons (💫)', () => {
    expect(narrateLine('Bidule est Sonné', cs).icon).toBe('💫');
  });
  it('hors de combat → ☠️ et important', () => {
    const n = narrateLine('Machin est mis hors de combat !', cs);
    expect(n.icon).toBe('☠️');
    expect(n.important).toBe(true);
  });
  it('déplacement → 👣 mais NON important (journal seul)', () => {
    const n = narrateLine('Bidule se déplace', cs);
    expect(n.icon).toBe('👣');
    expect(n.important).toBe(false);
  });
});

describe('coloration des noms par camp', () => {
  it('colore l’ennemi (Machin) et l’allié (Bidule), texte reconstituable', () => {
    const n = narrateLine('Machin charge Bidule', cs);
    const machin = n.segments.find((s) => s.text === 'Machin');
    const bidule = n.segments.find((s) => s.text === 'Bidule');
    expect(machin?.team).toBe('enemy');
    expect(bidule?.team).toBe('ally');
    expect(n.segments.map((s) => s.text).join('')).toBe('Machin charge Bidule');
  });
  it('préfère le nom le plus long (Rat géant, pas “Rat”)', () => {
    const n = narrateLine('Rat géant charge Bidule', cs);
    expect(n.segments.some((s) => s.text === 'Rat géant' && s.team === 'enemy')).toBe(true);
  });
});

describe('combatFeed — derniers événements importants (bandeau)', () => {
  it('garde les N derniers importants, ordre préservé, exclut le déplacement', () => {
    const lines = ['Bidule se déplace', 'Machin charge Bidule', 'Grunni commence à viser'];
    const feed = combatFeed(lines, cs, 2);
    expect(feed.map((f) => f.icon)).toEqual(['✊', '🎯']);
  });
});
