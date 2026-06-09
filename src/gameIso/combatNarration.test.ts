import { describe, it, expect } from 'vitest';
import { narrateEvent, combatFeed } from './combatNarration';
import { ev } from '../state/combatLog';

const ally = { id: 'h1', name: 'Bidule', kind: 'hero' };
const ally2 = { id: 'h2', name: 'Grunni', kind: 'hero' };
const foe = { id: 'e1', name: 'Machin', kind: 'monster' };
const foe2 = { id: 'e2', name: 'Rat géant', kind: 'monster' };
const cs = [ally, ally2, foe, foe2] as any;

describe('narrateEvent — icône déduite du kind (zéro devinage)', () => {
  it('charge → ✊ et important (passe au bandeau)', () => {
    const n = narrateEvent(ev('charge', 'Machin charge Bidule', foe.id, ally.id), cs);
    expect(n.icon).toBe('✊');
    expect(n.important).toBe(true);
  });
  it('tir → 🏹', () => {
    expect(narrateEvent(ev('shoot', 'Grunni tire sur Machin — 5 dégâts', ally2.id, foe.id), cs).icon).toBe('🏹');
  });
  it('attaque mêlée → ⚔️', () => {
    expect(narrateEvent(ev('attack', 'Bidule attaque Machin', ally.id, foe.id), cs).icon).toBe('⚔️');
  });
  it('posture défensive → 🛡️ et important', () => {
    const n = narrateEvent(ev('defensive', 'Bidule se met en position défensive', ally.id), cs);
    expect(n.icon).toBe('🛡️');
    expect(n.important).toBe(true);
  });
  it('viser → 🎯', () => {
    expect(narrateEvent(ev('aim', 'Grunni commence à viser', ally2.id), cs).icon).toBe('🎯');
  });
  it('état Sonné (kind condition) → icône de effectIcons (💫)', () => {
    expect(narrateEvent(ev('condition', 'Bidule est Sonné', ally.id), cs).icon).toBe('💫');
  });
  it('hors de combat → ☠️ et important', () => {
    const n = narrateEvent(ev('death', 'Machin est mis hors de combat !', foe.id), cs);
    expect(n.icon).toBe('☠️');
    expect(n.important).toBe(true);
  });
  it('déplacement → 👣 mais NON important (journal seul)', () => {
    const n = narrateEvent(ev('move', 'Bidule se déplace', ally.id), cs);
    expect(n.icon).toBe('👣');
    expect(n.important).toBe(false);
  });
});

describe('coloration des noms par camp', () => {
  it('colore l’ennemi (Machin) et l’allié (Bidule), texte reconstituable', () => {
    const n = narrateEvent(ev('charge', 'Machin charge Bidule', foe.id, ally.id), cs);
    const machin = n.segments.find((s) => s.text === 'Machin');
    const bidule = n.segments.find((s) => s.text === 'Bidule');
    expect(machin?.team).toBe('enemy');
    expect(bidule?.team).toBe('ally');
    expect(n.segments.map((s) => s.text).join('')).toBe('Machin charge Bidule');
  });
  it('préfère le nom le plus long (Rat géant, pas “Rat”)', () => {
    const n = narrateEvent(ev('charge', 'Rat géant charge Bidule', foe2.id, ally.id), cs);
    expect(n.segments.some((s) => s.text === 'Rat géant' && s.team === 'enemy')).toBe(true);
  });
});

describe('combatFeed — derniers événements importants (bandeau)', () => {
  it('garde les N derniers importants, ordre préservé, exclut le déplacement', () => {
    const events = [
      ev('move', 'Bidule se déplace', ally.id),
      ev('charge', 'Machin charge Bidule', foe.id, ally.id),
      ev('aim', 'Grunni commence à viser', ally2.id),
    ];
    const feed = combatFeed(events, cs, 2);
    expect(feed.map((f) => f.icon)).toEqual(['✊', '🎯']);
  });
});
