import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { PartyPicker, PartyScreenView } from './PartyScreen';
import { makePregens } from '../data/pregens';
import { rosterAdd } from '../state/roster';
import { initialNet, type NetState } from '../state/netFlow';
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

describe('PartyScreen — emplacements coop (l’hôte attribue, chacun remplit les siens)', () => {
  beforeEach(() => {
    (globalThis as { localStorage?: Storage }).localStorage = fakeStorage();
  });
  afterEach(() => {
    delete (globalThis as { localStorage?: Storage }).localStorage;
  });

  const noop = () => {};
  const render = (party: Combatant[], net: NetState, inProgress = false) =>
    renderToStaticMarkup(
      <PartyScreenView
        party={party}
        net={net}
        title="Votre groupe d'aventuriers"
        inProgress={inProgress}
        onMenu={noop}
        onQuitCoop={noop}
        onCreate={noop}
        onAddHero={noop}
        onRemoveHero={noop}
        onAssignSlot={noop}
        onStart={noop}
        onResume={noop}
      />,
    );

  it('solo : 4 emplacements à soi (boutons), pas de bandeau joueur', () => {
    const html = render([], initialNet());
    expect(html).not.toContain('slot-owner');
    expect((html.match(/Créer un personnage/g) ?? []).length).toBe(4);
    expect(html).toContain('Commencer');
    expect(html).not.toContain('Reprendre'); // pas de partie en cours
  });

  it('partie en cours : « Reprendre » prend la primauté, « Commencer » reste (rétrogradé)', () => {
    const h = savedHero();
    const html = render([h], initialNet(), true);
    expect(html).toMatch(/btn btn-primary[^>]*>Reprendre/);
    expect(html).toContain('Commencer');
    expect(html).not.toMatch(/btn btn-primary[^>]*>Commencer/); // plus le bouton primaire
  });

  it('invité : pas de « Reprendre » même partie en cours (l’hôte pilote)', () => {
    const html = render([], {
      mode: 'guest', mySeat: 1, seatNames: { 0: 'Hôte', 1: 'Antoine' }, ownership: {}, slots: [0, 1, 1, 0],
    }, true);
    expect(html).not.toContain('Reprendre');
  });

  it('invité : ses slots actifs, ceux des autres en attente, pas de « Commencer »', () => {
    const html = render([], {
      mode: 'guest', mySeat: 1, seatNames: { 0: 'Hôte', 1: 'Antoine' }, ownership: {}, slots: [0, 1, 1, 0],
    });
    expect((html.match(/Créer un personnage/g) ?? []).length).toBe(2); // slots 1 et 2 (siège 1)
    expect(html).toContain('En attente de Hôte'); // slots 0 et 3
    expect(html).not.toContain('Commencer');
    expect(html).toContain('Quitter');
  });

  it('hôte : select de siège sur les slots vides, « Commencer » grisé tant qu’un slot invité est vide', () => {
    const html = render([], {
      mode: 'host', mySeat: 0, seatNames: { 0: 'Hôte', 1: 'Antoine' }, ownership: {}, slots: [0, 1, 0, 0],
    });
    expect(html).toContain('<select'); // attribution par slot
    expect(html).toContain('Antoine');
    expect(html).toMatch(/Commencer[^<]*→<\/button>/);
    expect(html).toContain('disabled'); // slot du siège 1 vide → bouton grisé
    expect(html).toContain('En attente que chaque joueur remplisse ses emplacements');
  });

  it('hôte : héros de l’invité dans SON slot, « Retirer » réservé au propriétaire', () => {
    const h = savedHero();
    const html = render([h], {
      mode: 'host', mySeat: 0, seatNames: { 0: 'Hôte', 1: 'Antoine' }, ownership: { [h.id]: 1 }, slots: [1, 0, 0, 0],
    });
    expect(html).toContain(h.name); // affiché dans le slot du siège 1
    expect(html).not.toContain('Retirer'); // pas à l'hôte → pas de retrait
  });
});
