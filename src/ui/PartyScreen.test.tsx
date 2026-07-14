import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { HeroSelector, PartyScreenView, slotKeyNav } from './PartyScreen';
import { heroSubtitle } from './CharCard';
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

describe('HeroSelector — sélecteur dédié (écran plein-champ) : recrutement & remplacement', () => {
  beforeEach(() => {
    (globalThis as { localStorage?: Storage }).localStorage = fakeStorage();
  });
  afterEach(() => {
    delete (globalThis as { localStorage?: Storage }).localStorage;
  });

  it('recrutement : écran ScreenShell (voile plein champ) + onglets + cartes-portraits des pré-tirés', () => {
    const html = renderToStaticMarkup(<HeroSelector party={[]} mode="recruit" onPick={noop} onClose={noop} />);
    expect(html).toContain('worldmap-overlay'); // coquille plein-champ (ScreenShell), pas une petite modale
    expect(html).toContain('Choisir un aventurier'); // titre du mode recrutement
    expect(html).toContain('Pré-tirés');
    expect(html).toContain('Mes personnages');
    expect(html).toContain('candidate-card');
    expect(html).not.toContain('candidate-modal'); // recrutement = grandes cartes (gallery)
  });

  it('roster non vide : MÊME carte-portrait (nom complet + recruter + outils export/suppr)', () => {
    rosterAdd({ hero: savedHero(), wealth: { gold: 1, silver: 0, brass: 0 } });
    const html = renderToStaticMarkup(<HeroSelector party={[]} mode="recruit" onPick={noop} onClose={noop} />);
    expect(html).toContain('Aventurière Sauvegardée'); // nom COMPLET
    expect(html).toContain('candidate-name');
    expect(html).toContain('Recruter');
    expect(html).toContain('Supprimer'); // action secondaire SUR la carte
  });

  it('remplacement : cartes compactes, membre du groupe grisé « Déjà choisi »', () => {
    const h = savedHero();
    rosterAdd({ hero: h, wealth: { gold: 0, silver: 5, brass: 0 } });
    const html = renderToStaticMarkup(<HeroSelector party={[h]} mode="replace" replaceName={h.name} onPick={noop} onClose={noop} />);
    expect(html).toContain('Remplacer Aventurière Sauvegardée'); // titre du mode remplacement
    expect(html).toContain('candidate-modal');
    expect(html).toContain('Déjà choisi');
  });
});

describe('PartyScreen — LA COMPAGNIE SEULE (aucune galerie inline) : coop, hôte attribue', () => {
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

  it('solo : compagnie (grille de sièges vides), siège vide = actions Créer / Choisir, AUCUNE galerie inline', () => {
    const html = render([], initialNet());
    expect(html).toContain('party-roster');
    expect(html).toContain('seat-empty');
    expect(html).not.toContain('slot-owner'); // pas de bandeau joueur en solo
    expect(html).toContain('Créer'); // action sur siège vide
    expect(html).toContain('Choisir'); // ouvre le sélecteur dédié
    expect(html).not.toContain('candidate-gallery'); // plus de galerie sur l'écran de groupe
    expect(html).not.toContain('candidate-card'); // ni de cartes-candidats inline
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

  it('invité : sièges des autres « en attente », son siège recrutable (Choisir), pas de « Commencer »', () => {
    const html = render([], {
      ...initialNet(), mode: 'guest', mySeat: 1, seatNames: { 0: 'Hôte', 1: 'Antoine' }, ownership: {}, slots: [0, 1, 1, 0],
    });
    expect(html).toContain('En attente de Hôte'); // sièges 0 et 3 (siège 0)
    expect(html).toContain('Choisir'); // l’invité recrute ses sièges via le sélecteur dédié
    expect(html).not.toContain('Commencer');
    expect(html).toContain('Quitter');
  });

  it('hôte : select de siège sur les sièges vides, « Commencer » grisé + RAISON visible tant qu’un siège invité est vide', () => {
    const html = render([], {
      ...initialNet(), mode: 'host', mySeat: 0, seatNames: { 0: 'Hôte', 1: 'Antoine' }, ownership: {}, slots: [0, 1, 0, 0],
    });
    expect(html).toContain('<select');
    expect(html).toContain('Antoine');
    expect(html).toMatch(/Commencer[^<]*→<\/button>/);
    expect(html).toContain('disabled');
    expect(html).toContain('gated-action-reason'); // raison VISIBLE (a11y), plus un simple title
    expect(html).toContain('Des emplacements attribués aux autres joueurs sont encore vides.');
  });

  it('hôte : héros de l’invité dans SON siège (carte), « Retirer » réservé au propriétaire', () => {
    const h = savedHero();
    const html = render([h], {
      ...initialNet(), mode: 'host', mySeat: 0, seatNames: { 0: 'Hôte', 1: 'Antoine' }, ownership: { [h.id]: 1 }, slots: [1, 0, 0, 0],
    });
    expect(html).toContain(h.name); // carte de siège dans la compagnie
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
});

describe('PartyScreen — présentation par le PERSONNAGE (plus de bouton « Qui est-ce ? »)', () => {
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

  it('siège occupé : contrat scellé — portrait + nom + rôle + cartouche « Contrat N » + sceau, personnage cliquable', () => {
    const heroes = makePregens().slice(0, 2);
    const html = render(heroes, initialNet());
    expect(html).toContain('seat-card');
    expect(html).toContain('seat-card-contract');
    expect(html).toContain('Contrat I');
    expect(html).toContain('seat-card-seal'); // sceau de cire (contrat scellé)
    expect(html).toContain(heroes[0].name); // nom COMPLET dans la compagnie
    expect(html).toContain('card-roles'); // rôle (forces) sur la carte de siège
    expect(html).toContain('char-present'); // la figurine+identité EST le contrôle de présentation
    expect(html).toContain(`Voir ${heroes[0].name}`); // aria-label du contrôle
    expect(html).not.toContain('Qui est-ce ?'); // le bouton loupe est SUPPRIMÉ
    expect(html).not.toContain('who-btn');
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

  it('groupe complet : 4 cartes de siège, aucun siège vide, aucune galerie', () => {
    const heroes = makePregens().slice(0, 4);
    const full = render(heroes, initialNet());
    expect((full.match(/seat-card-contract/g) ?? []).length).toBe(4);
    for (const h of heroes) expect(full).toContain(h.name);
    expect(full).not.toContain('seat-empty'); // groupe complet → aucun siège vide
    expect(full).not.toContain('candidate-card'); // pas de galerie sur l'écran de groupe
  });

  it('sous-titre d’archétype : la CARRIÈRE d’abord, l’espèce ensuite (arbitrage user 2026-07-13)', () => {
    const hero = makePregens()[0];
    const sub = heroSubtitle(hero);
    expect(sub).toContain(' — '); // « Carrière — Espèce »
    // la carrière précède l'espèce (séparateur em-dash entre les deux)
    const [career] = sub.split(' — ');
    expect(career.length).toBeGreaterThan(0);
    expect(render([hero], initialNet())).toContain('candidate-sub');
  });
});
