import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { PartyPicker, PartyScreenView, slotKeyNav } from './PartyScreen';
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

const noop = () => {};

describe('PartyPicker — remplacement : mêmes cartes-portraits (variant modal)', () => {
  beforeEach(() => {
    (globalThis as { localStorage?: Storage }).localStorage = fakeStorage();
  });
  afterEach(() => {
    delete (globalThis as { localStorage?: Storage }).localStorage;
  });

  it('roster vide : onglet Pré-tirés actif, cartes-portraits des pré-tirés rendues', () => {
    const html = renderToStaticMarkup(<PartyPicker party={[]} onPick={() => {}} onClose={() => {}} />);
    expect(html).toContain('Pré-tirés');
    expect(html).toContain('Mes personnages');
    expect(html).toContain('candidate-card');
    expect(html).toContain('candidate-modal'); // format modale (pas un 3e format)
  });

  it('roster non vide : onglet « Mes personnages » actif, la MÊME carte-portrait (nom + choisir + actions)', () => {
    rosterAdd({ hero: savedHero(), wealth: { gold: 1, silver: 0, brass: 0 } });
    const html = renderToStaticMarkup(<PartyPicker party={[]} onPick={() => {}} onClose={() => {}} />);
    expect(html).toContain('Aventurière Sauvegardée'); // nom COMPLET, pas une ligne anonyme
    expect(html).toContain('candidate-name');
    expect(html).toContain('Choisir');
    expect(html).toContain('Supprimer'); // action secondaire SUR la carte
  });

  it('carte du roster déjà dans le groupe : bouton « Déjà choisi » désactivé', () => {
    const h = savedHero();
    rosterAdd({ hero: h, wealth: { gold: 0, silver: 5, brass: 0 } });
    const html = renderToStaticMarkup(<PartyPicker party={[h]} onPick={() => {}} onClose={() => {}} />);
    expect(html).toContain('Déjà choisi');
  });
});

describe('PartyScreen — équipe (colonne latérale) coop : l’hôte attribue, chacun remplit les siens', () => {
  beforeEach(() => {
    (globalThis as { localStorage?: Storage }).localStorage = fakeStorage();
  });
  afterEach(() => {
    delete (globalThis as { localStorage?: Storage }).localStorage;
  });

  const render = (party: Combatant[], net: NetState, inProgress = false, campaign?: { name: string; canChange?: boolean }) =>
    renderToStaticMarkup(
      <PartyScreenView
        party={party}
        net={net}
        title="Votre groupe d'aventuriers"
        campaignName={campaign?.name}
        onChangeCampaign={campaign?.canChange ? noop : undefined}
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

  it('solo : colonne d’équipe (4 sièges vides), UNE seule carte-action « Créer un personnage »', () => {
    const html = render([], initialNet());
    expect(html).toContain('party-roster');
    expect(html).toContain('seat-empty');
    expect(html).not.toContain('slot-owner'); // pas de bandeau joueur en solo
    expect((html.match(/Créer un personnage/g) ?? []).length).toBe(1);
    expect(html).toContain('Commencer');
    expect(html).not.toContain('Reprendre');
  });

  it('cartouche campagne : nom + « Changer » quand on peut choisir, lecture seule sinon', () => {
    const editable = render([], initialNet(), false, { name: "L'Arène", canChange: true });
    expect(editable).toContain('Arène');
    expect(editable).toContain('Changer');
    const guest = render([], { ...initialNet(), mode: 'guest', mySeat: 1 }, false, { name: 'Ma campagne' });
    expect(guest).toContain('Ma campagne');
    expect(guest).not.toContain('Changer');
    const absent = render([], initialNet());
    expect(absent).not.toContain('campaign-pill');
  });

  it('partie en cours : « Reprendre » prend la primauté, « Commencer » reste (rétrogradé)', () => {
    const h = savedHero();
    const html = render([h], initialNet(), true);
    expect(html).toMatch(/btn btn-primary[^>]*>Reprendre/);
    expect(html).toContain('Commencer');
    expect(html).not.toMatch(/btn btn-primary[^>]*>Commencer/);
  });

  it('invité : pas de « Reprendre » même partie en cours (l’hôte pilote)', () => {
    const html = render([], {
      ...initialNet(), mode: 'guest', mySeat: 1, seatNames: { 0: 'Hôte', 1: 'Antoine' }, ownership: {}, slots: [0, 1, 1, 0],
    }, true);
    expect(html).not.toContain('Reprendre');
  });

  it('invité : sièges des autres « en attente », étal de recrutement présent, pas de « Commencer »', () => {
    const html = render([], {
      ...initialNet(), mode: 'guest', mySeat: 1, seatNames: { 0: 'Hôte', 1: 'Antoine' }, ownership: {}, slots: [0, 1, 1, 0],
    });
    expect(html).toContain('En attente de Hôte'); // sièges 0 et 3 (siège 0)
    expect(html).toContain('candidate-gallery'); // l’invité recrute ses sièges via l’étal
    expect(html).not.toContain('Commencer');
    expect(html).toContain('Quitter');
  });

  it('hôte : select de siège sur les sièges vides, « Commencer » grisé tant qu’un siège invité est vide', () => {
    const html = render([], {
      ...initialNet(), mode: 'host', mySeat: 0, seatNames: { 0: 'Hôte', 1: 'Antoine' }, ownership: {}, slots: [0, 1, 0, 0],
    });
    expect(html).toContain('<select');
    expect(html).toContain('Antoine');
    expect(html).toMatch(/Commencer[^<]*→<\/button>/);
    expect(html).toContain('disabled');
    expect(html).toContain('En attente que chaque joueur remplisse ses emplacements');
  });

  it('hôte : héros de l’invité dans SON siège (carte), « Retirer » réservé au propriétaire', () => {
    const h = savedHero();
    const html = render([h], {
      ...initialNet(), mode: 'host', mySeat: 0, seatNames: { 0: 'Hôte', 1: 'Antoine' }, ownership: { [h.id]: 1 }, slots: [1, 0, 0, 0],
    });
    expect(html).toContain(h.name); // carte de siège dans la colonne
    expect(html).not.toMatch(/<button[^>]*>Retirer<\/button>/); // siège non possédé → pas d'action
  });

  it('siège possédé : bouton « Remplacer » rendu quand onReplaceHero est fourni', () => {
    const h = savedHero();
    const html = renderToStaticMarkup(
      <PartyScreenView
        party={[h]}
        net={initialNet()}
        title="Votre groupe d'aventuriers"
        onMenu={noop} onQuitCoop={noop} onCreate={noop}
        onAddHero={noop} onRemoveHero={noop} onReplaceHero={noop}
        onAssignSlot={noop} onStart={noop}
      />,
    );
    expect(html).toContain('Remplacer');
  });

  it('siège d’un AUTRE joueur : pas de « Remplacer » (non possédé)', () => {
    const h = savedHero();
    const html = renderToStaticMarkup(
      <PartyScreenView
        party={[h]}
        net={{ ...initialNet(), mode: 'host', mySeat: 0, seatNames: { 0: 'Hôte', 1: 'Antoine' }, ownership: { [h.id]: 1 }, slots: [1, 0, 0, 0] }}
        title="Votre groupe d'aventuriers"
        onMenu={noop} onQuitCoop={noop} onCreate={noop}
        onAddHero={noop} onRemoveHero={noop} onReplaceHero={noop}
        onAssignSlot={noop} onStart={noop}
      />,
    );
    expect(html).not.toContain('Remplacer');
  });
});

describe('PartyScreen — libellés i18n', () => {
  beforeEach(() => {
    (globalThis as { localStorage?: Storage }).localStorage = fakeStorage();
  });
  afterEach(() => {
    delete (globalThis as { localStorage?: Storage }).localStorage;
  });

  const renderView = (party: Combatant[], net: NetState) =>
    renderToStaticMarkup(
      <PartyScreenView
        party={party}
        net={net}
        title="Votre groupe d'aventuriers"
        onMenu={noop}
        onQuitCoop={noop}
        onCreate={noop}
        onAddHero={noop}
        onRemoveHero={noop}
        onAssignSlot={noop}
        onStart={noop}
      />,
    );

  it('libellés solo : navigation, sièges, étal, action', () => {
    const html = renderView([], initialNet());
    expect(html).toContain('← Menu');
    expect(html).toContain('Siège 1');
    expect(html).toContain('Siège 4');
    expect(html).toContain('Un siège à pourvoir');
    expect(html).toContain('candidate-gallery');
    expect(html).toContain('Pré-tirés');
    expect(html).toContain('Commencer →');
  });

  it('libellés invité : bouton Quitter, message attente hôte', () => {
    const html = renderView([], { ...initialNet(), mode: 'guest', mySeat: 1, slots: [0, 1, 0, 0] });
    expect(html).toContain('← Quitter');
    expect(html).toMatch(/L\S*h\S*te lance la partie/);
  });

  it('libellés hôte avec siège invité vide : Commencer, message en attente', () => {
    const html = renderView([], {
      ...initialNet(), mode: 'host', mySeat: 0, seatNames: { 0: 'Hote', 1: 'Antoine' }, ownership: {}, slots: [0, 1, 0, 0],
    });
    expect(html).toContain('Commencer →');
    expect(html).toContain('En attente que chaque joueur remplisse ses emplacements');
  });

  it('libellés PartyPicker : onglets, bouton Terminé', () => {
    const html = renderToStaticMarkup(<PartyPicker party={[]} onPick={() => {}} onClose={() => {}} />);
    expect(html).toContain('Mes personnages');
    expect(html).toContain('Pré-tirés');
    expect(html).toContain('Terminé');
    expect(html).toContain('Choisir');
  });
});

describe('PartyScreen — hiérarchie : équipe (star, colonne) + étal de candidats', () => {
  beforeEach(() => {
    (globalThis as { localStorage?: Storage }).localStorage = fakeStorage();
  });
  afterEach(() => {
    delete (globalThis as { localStorage?: Storage }).localStorage;
  });

  const render = (party: Combatant[], net: NetState) =>
    renderToStaticMarkup(
      <PartyScreenView
        party={party}
        net={net}
        title="Votre groupe d'aventuriers"
        onMenu={noop}
        onQuitCoop={noop}
        onCreate={noop}
        onAddHero={noop}
        onRemoveHero={noop}
        onAssignSlot={noop}
        onStart={noop}
      />,
    );

  it('layout : colonne latérale (layout-sidebar) équipe + étal', () => {
    const html = render([], initialNet());
    expect(html).toContain('layout-sidebar party-layout');
    expect(html).toContain('party-roster');
    expect(html).toContain('candidate-gallery');
  });

  it('roving tabindex : UN seul siège tabbable, les trois autres à -1', () => {
    const html = render([], initialNet());
    expect((html.match(/seat-slot[^>]*?tabindex="0"/g) ?? []).length).toBe(1);
    expect((html.match(/seat-slot[^>]*?tabindex="-1"/g) ?? []).length).toBe(3);
  });

  it('slotKeyNav (pur) : Haut/Bas (⇄ tolérées) = focus voisin bouclé, Enter/Espace = action', () => {
    expect(slotKeyNav('ArrowDown', 0, 4)).toEqual({ focus: 1 });
    expect(slotKeyNav('ArrowUp', 1, 4)).toEqual({ focus: 0 });
    expect(slotKeyNav('ArrowUp', 0, 4)).toEqual({ focus: 3 }); // bouclé
    expect(slotKeyNav('ArrowDown', 3, 4)).toEqual({ focus: 0 }); // bouclé
    expect(slotKeyNav('ArrowRight', 0, 4)).toEqual({ focus: 1 }); // ⇄ tolérées
    expect(slotKeyNav('ArrowLeft', 0, 4)).toEqual({ focus: 3 });
    expect(slotKeyNav('Enter', 2, 4)).toBe('primary');
    expect(slotKeyNav(' ', 2, 4)).toBe('primary');
    expect(slotKeyNav('Tab', 2, 4)).toBeNull();
    expect(slotKeyNav('x', 2, 4)).toBeNull();
  });

  it('siège vide : placeholder COURT « Siège N » (il ne vole pas la place des sièges pleins)', () => {
    const html = render([], initialNet());
    expect(html).toContain('seat-empty');
    expect(html).toContain('Siège 1');
    expect((html.match(/Créer un personnage/g) ?? []).length).toBe(1);
  });

  it('siège occupé : carte de siège RICHE — portrait + nom + rôle + accroche + badge « Siège N »', () => {
    const heroes = makePregens().slice(0, 2);
    const html = render(heroes, initialNet());
    expect(html).toContain('seat-card');
    expect(html).toContain('seat-card-badge');
    expect(html).toContain('Siège 1');
    expect(html).toContain(heroes[0].name); // nom COMPLET dans la colonne
    expect(html).toContain('card-roles'); // rôle (forces) sur la carte de siège
  });

  it('étal : grandes cartes-portraits (figure + nom + rôle + accroche) + carte-action + « Qui est-ce ? »', () => {
    const html = render([], initialNet());
    expect(html).toContain('candidate-grid');
    expect(html).toContain('candidate-card');
    expect(html).toContain('candidate-name');
    expect(html).toContain('card-roles'); // RÔLE en toutes lettres (plus de chips cryptiques)
    expect(html).not.toContain('res-chip'); // plus de chips icône+nombre
    expect(html).toContain('candidate-action-card');
    expect(html).toContain('Recruter');
    expect(html).toContain('Qui est-ce ?'); // affordance présentation VISIBLE
  });

  it('recruté : le visage QUITTE l’étal pour la colonne (hideInParty)', () => {
    const heroes = makePregens().slice(0, 4);
    const full = render(heroes, initialNet());
    // les 4 recrutés sont dans la colonne (4 cartes de siège), plus dans l’étal.
    expect((full.match(/seat-card-badge/g) ?? []).length).toBe(4);
    for (const h of heroes) expect(full).toContain(h.name);
    // étal restant : 4 pré-tirés non recrutés + la carte-action « Créer ».
    expect(full).toContain('candidate-card');
    expect(full).not.toContain('seat-empty'); // groupe complet → aucun siège vide
  });

  it('archétype : sous-titre « Espèce · Carrière » SANS « (niv. N) » (bruit retiré)', () => {
    const html = render([], initialNet());
    expect(html).toContain('candidate-sub');
    expect(html).not.toContain('(niv.'); // le niveau vit dans la fiche, pas sur la carte
  });

  it('onglet Mes personnages : carte-action Créer + carte-action Importer (même famille)', () => {
    rosterAdd({ hero: savedHero(), wealth: { gold: 0, silver: 0, brass: 0 } });
    const html = render([], initialNet());
    expect(html).toContain('Aventurière Sauvegardée');
    expect(html).toContain('candidate-name');
    expect((html.match(/candidate-action-card/g) ?? []).length).toBe(2); // Créer + Importer
    expect((html.match(/Créer un personnage/g) ?? []).length).toBe(1);
    expect(html).toContain('Importer un personnage');
  });
});
