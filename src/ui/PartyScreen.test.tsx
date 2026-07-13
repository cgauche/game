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

  it('solo : 4 emplacements à soi (boutons), pas de bandeau joueur', () => {
    const html = render([], initialNet());
    expect(html).not.toContain('slot-owner');
    expect((html.match(/Créer un personnage/g) ?? []).length).toBe(4);
    expect(html).toContain('Commencer');
    expect(html).not.toContain('Reprendre'); // pas de partie en cours
  });

  it('cartouche campagne : nom + « Changer » quand on peut choisir, lecture seule sinon', () => {
    const editable = render([], initialNet(), false, { name: "L'Arène", canChange: true });
    expect(editable).toContain('Arène'); // l'apostrophe est échappée (&#x27;) dans le HTML statique
    expect(editable).toContain('Changer');
    const guest = render([], { ...initialNet(), mode: 'guest', mySeat: 1 }, false, { name: 'Ma campagne' });
    expect(guest).toContain('Ma campagne'); // l'invité voit le choix de l'hôte…
    expect(guest).not.toContain('Changer'); // …sans pouvoir le modifier
    const absent = render([], initialNet());
    expect(absent).not.toContain('campaign-pill'); // pas de cartouche sans campagne fournie
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
      ...initialNet(), mode: 'guest', mySeat: 1, seatNames: { 0: 'Hôte', 1: 'Antoine' }, ownership: {}, slots: [0, 1, 1, 0],
    }, true);
    expect(html).not.toContain('Reprendre');
  });

  it('invité : ses slots actifs, ceux des autres en attente, pas de « Commencer »', () => {
    const html = render([], {
      ...initialNet(), mode: 'guest', mySeat: 1, seatNames: { 0: 'Hôte', 1: 'Antoine' }, ownership: {}, slots: [0, 1, 1, 0],
    });
    expect((html.match(/Créer un personnage/g) ?? []).length).toBe(2); // slots 1 et 2 (siège 1)
    expect(html).toContain('En attente de Hôte'); // slots 0 et 3
    expect(html).not.toContain('Commencer');
    expect(html).toContain('Quitter');
  });

  it('hôte : select de siège sur les slots vides, « Commencer » grisé tant qu’un slot invité est vide', () => {
    const html = render([], {
      ...initialNet(), mode: 'host', mySeat: 0, seatNames: { 0: 'Hôte', 1: 'Antoine' }, ownership: {}, slots: [0, 1, 0, 0],
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
      ...initialNet(), mode: 'host', mySeat: 0, seatNames: { 0: 'Hôte', 1: 'Antoine' }, ownership: { [h.id]: 1 }, slots: [1, 0, 0, 0],
    });
    expect(html).toContain(h.name); // affiché dans le slot du siège 1
    expect(html).not.toContain('Retirer'); // pas à l'hôte → pas de retrait
  });

  it('slot possédé : bouton « Remplacer » rendu quand onReplaceHero est fourni', () => {
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

  it('slot d’un AUTRE siège : pas de « Remplacer » (non possédé)', () => {
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

describe("PartyScreen -- libelles i18n Phase D", () => {
  beforeEach(() => {
    (globalThis as { localStorage?: Storage }).localStorage = fakeStorage();
  });
  afterEach(() => {
    delete (globalThis as { localStorage?: Storage }).localStorage;
  });

  const noop = () => {};
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

  it("libelles solo : navigation, emplacements, actions", () => {
    const html = renderView([], initialNet());
    expect(html).toContain("← Menu");
    expect(html).toContain("Aventurier 1");
    expect(html).toContain("Aventurier 4");
    expect(html).toContain("Créer un personnage");
    expect(html).toContain("candidate-gallery"); // galerie de candidats sur l’écran (recrutement)
    expect(html).toContain("Candidats"); // titre de la galerie
    expect(html).toContain("Commencer →");
  });

  it("libelles invite : bouton Quitter, message attente hote", () => {
    const html = renderView([], { ...initialNet(), mode: "guest", mySeat: 1, slots: [0, 1, 0, 0] });
    expect(html).toContain("← Quitter");
    expect(html).toMatch(/L\S*h\S*te lance la partie/);
  });

  it("libelles hote avec slot invite vide : Commencer, message en attente", () => {
    const html = renderView([], {
      ...initialNet(), mode: "host", mySeat: 0, seatNames: { 0: "Hote", 1: "Antoine" }, ownership: {}, slots: [0, 1, 0, 0],
    });
    expect(html).toContain("Commencer →");
    expect(html).toContain("En attente que chaque joueur remplisse ses emplacements");
  });

  it("libelles PartyPicker : onglets, bouton Termine", () => {
    const html = renderToStaticMarkup(<PartyPicker party={[]} onPick={() => {}} onClose={() => {}} />);
    expect(html).toContain("Mes personnages");
    expect(html).toContain("Pré-tirés");
    expect(html).toContain("Terminé");
    expect(html).toContain("Choisir");
  });
});

describe('PartyScreen — présentation v2 (cadres ornés, carte en pied, nav clavier, picker)', () => {
  beforeEach(() => {
    (globalThis as { localStorage?: Storage }).localStorage = fakeStorage();
  });
  afterEach(() => {
    delete (globalThis as { localStorage?: Storage }).localStorage;
  });

  const noop = () => {};
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

  it('roving tabindex : UN seul emplacement tabbable, les trois autres à -1', () => {
    const html = render([], initialNet());
    // Scopé aux EMPLACEMENTS (la galerie de candidats a ses propres onglets tabbables) : un seul slot à 0.
    expect((html.match(/party-slot[^>]*tabindex="0"/g) ?? []).length).toBe(1);
    expect((html.match(/party-slot[^>]*tabindex="-1"/g) ?? []).length).toBe(3);
  });

  it('slotKeyNav (pur) : flèches = focus voisin bouclé, Enter/Espace = action principale', () => {
    expect(slotKeyNav('ArrowRight', 0, 4)).toEqual({ focus: 1 });
    expect(slotKeyNav('ArrowLeft', 1, 4)).toEqual({ focus: 0 });
    expect(slotKeyNav('ArrowLeft', 0, 4)).toEqual({ focus: 3 }); // bouclé à gauche
    expect(slotKeyNav('ArrowRight', 3, 4)).toEqual({ focus: 0 }); // bouclé à droite
    expect(slotKeyNav('Enter', 2, 4)).toBe('primary');
    expect(slotKeyNav(' ', 2, 4)).toBe('primary');
    expect(slotKeyNav('Tab', 2, 4)).toBeNull();
    expect(slotKeyNav('ArrowDown', 2, 4)).toBeNull();
  });

  it('emplacement vide : cadre orné + silhouette d’aventurier assombrie (plus de ✠ texte)', () => {
    const html = render([], initialNet());
    expect(html).toContain('empty-slot');
    expect(html).toContain('ornate-frame'); // OrnateFrame
    expect(html).toContain('slot-silhouette'); // ombre de personnage (rig réel assombri en CSS)
    expect(html).toContain('charprev'); // CharacterPreview (rig d’un pré-tiré)
    expect(html).toContain('Un siège à pourvoir'); // libellé d’invitation
    expect(html).not.toContain('✠');
  });

  it('slot occupé : carte v2 — perso EN PIED (CharacterPreview) dans un cadre orné, identité + statut', () => {
    // Groupe COMPLET (4/4) : plus de vivier, chaque emplacement occupé affiche la carte PLEINE.
    const heroes = makePregens().slice(0, 4);
    const html = render(heroes, initialNet());
    expect(html).toContain('char-card');
    expect(html).toContain('ornate-frame');
    expect(html).toContain('charprev'); // figure en pied (rig réel)
    expect(html).toContain(heroes[0].name);
    expect(html).toContain('Statut'); // statut social du niveau de carrière
    expect(html).not.toContain('char-card-row'); // mode plein, pas la rangée compacte du vivier
  });

  it('picker : « Créer un personnage » visible MÊME avec un roster non vide', () => {
    rosterAdd({ hero: savedHero(), wealth: { gold: 0, silver: 0, brass: 0 } });
    const html = renderToStaticMarkup(<PartyPicker party={[]} onPick={() => {}} onClose={() => {}} />);
    expect(html).toContain('Créer un personnage');
    expect(html).toContain('Aventurière Sauvegardée'); // le roster reste listé sous le bouton
  });

  it('picker : rangées compactes v2 (char-card-row + figure xs)', () => {
    const html = renderToStaticMarkup(<PartyPicker party={[]} onPick={() => {}} onClose={() => {}} />);
    expect(html).toContain('char-card-row');
    expect(html).toContain('charprev-xs');
  });

  it('galerie de candidats : visible tant qu’un siège est libre (rangées + « Choisir »), masquée à 4/4', () => {
    const recruiting = render([], initialNet());
    expect(recruiting).toContain('candidate-gallery');
    expect(recruiting).toContain('pregen-row'); // les VISAGES des candidats (CharCard compact) sur l’écran
    expect(recruiting).toContain('Choisir'); // clic = 1er siège libre (même onAddHero que la modale)

    const full = render(makePregens().slice(0, 4), initialNet());
    expect(full).not.toContain('candidate-gallery'); // groupe complet → plus de vivier
  });
});
