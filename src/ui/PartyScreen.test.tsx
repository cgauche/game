import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { PartyPicker } from './PartyScreen';
import { makePregens } from '../data/pregens';
import { rosterAdd } from '../state/roster';
import { Combatant } from '../engine/types';

/** Fake Storage minimal — l'environnement de test est `node` (pas de localStorage). */
function fakeStorage(): Storage {
  const m = new Map<string, string>();
  return {
    getItem: (k: string) => m.get(k) ?? null,
    setItem: (k: string, v: string) => void m.set(k, String(v)),
    removeItem: (k: string) => void m.delete(k),
    clear: () => m.clear(),
    key: (i: number) => [...m.keys()][i] ?? null,
    get length() {
      return m.size;
    },
  } as Storage;
}

function savedHero(): Combatant {
  const h: Combatant = JSON.parse(JSON.stringify(makePregens()[0]));
  h.id = 'roster-test-1';
  h.name = 'Aventurière Sauvegardée';
  return h;
}

describe('PartyPicker — pré-tirés + roster persistant', () => {
  beforeEach(() => {
    (globalThis as { localStorage?: Storage }).localStorage = fakeStorage();
  });
  afterEach(() => {
    delete (globalThis as { localStorage?: Storage }).localStorage;
  });

  it('roster vide : onglet Pré-tirés actif, liste des pré-tirés rendue', () => {
    const html = renderToStaticMarkup(<PartyPicker party={[]} onPick={() => {}} onClose={() => {}} />);
    expect(html).toContain('Pré-tirés');
    expect(html).toContain('Mes personnages');
    expect(html).toContain('pregen-row'); // au moins un pré-tiré listé
  });

  it('roster non vide : onglet « Mes personnages » actif par défaut, perso + Choisir + Supprimer', () => {
    rosterAdd({ hero: savedHero(), wealth: { gold: 1, silver: 0, brass: 0 } });
    const html = renderToStaticMarkup(<PartyPicker party={[]} onPick={() => {}} onClose={() => {}} />);
    expect(html).toContain('Aventurière Sauvegardée');
    expect(html).toContain('Choisir');
    expect(html).toContain('Supprimer');
  });

  it('perso du roster déjà dans le groupe : « Déjà choisi »', () => {
    const h = savedHero();
    rosterAdd({ hero: h, wealth: { gold: 0, silver: 5, brass: 0 } });
    const html = renderToStaticMarkup(<PartyPicker party={[h]} onPick={() => {}} onClose={() => {}} />);
    expect(html).toContain('Déjà choisi');
  });
});
