/**
 * Écran « Entre deux aventures » refondu (LOT 6) : bandeau de SYNTHÈSE persistant (vignettes héros
 * + pips d'Activités + bourse du groupe, les 3 phases), volets homogènes au gabarit `ActivityPane`
 * (pied FIXE : pré-jet visible AVANT « Entreprendre »), clôture récapitulative confirmée (M3).
 * Rendu statique : le store SSR sert l'état initial, d'où le seam (même pattern que WorldMapView).
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { useGame } from '../state/store';
import { createHero } from '../engine/character';
import { makeRNG } from '../engine/dice';
import { fromBrass } from '../engine/money';
import { testScene } from '../scenes/test-fixture';
import { interludeCatalog } from '../state/interludeFlow';
import { InterludeScreen, type InterludeSeam } from './InterludeScreen';

function buildSeam(weeks = 3): InterludeSeam {
  const a = createHero({ speciesId: 'humains-reiklander', careerId: 'soldat', name: 'Vétéran', rng: makeRNG(1601) });
  a.xp = 300;
  const b = createHero({ speciesId: 'nains', careerId: 'artisan', name: 'Forgeron', rng: makeRNG(1602) });
  if (!b.skills.some((s) => s.skillId === 'metier')) b.skills.push({ skillId: 'metier', spec: 'Forgeron', characteristic: 'dexterite', advances: 10 });
  useGame.setState({ party: [a, b], battle: null, interlude: null, bank: [], pendingOrders: [], journal: [], money: fromBrass(5000) });
  useGame.getState().startScene(testScene);
  vi.clearAllTimers();
  useGame.setState({ money: fromBrass(5000), screen: 'interlude' });
  useGame.getState().seedRng(7);
  useGame.getState().startInterlude(weeks);
  const s = useGame.getState();
  return { interlude: s.interlude!, party: s.party, money: s.money, bank: s.bank, pendingOrders: s.pendingOrders };
}

describe('InterludeScreen — refonte LOT 6', () => {
  beforeEach(() => { vi.useFakeTimers(); });
  afterEach(() => { vi.clearAllTimers(); vi.useRealTimers(); });

  it('ouvre sur la phase Événements : d100 raconté par héros + CTA vers les Activités', () => {
    const seam = buildSeam();
    const html = renderToStaticMarkup(<InterludeScreen seam={seam} />);
    expect(html).toContain('Entre deux aventures');
    expect(html).toContain('Vétéran');
    expect(html).toContain('Événement'); // hint de phase
    expect(html).toContain('Passer aux Activités');
    expect(html).not.toContain('Clore'); // pas de clôture sur la phase d'intro
  });

  it('bandeau de SYNTHÈSE persistant : vignettes héros (pips ●○) + bourse du groupe, dès la phase Événements', () => {
    const seam = buildSeam();
    const html = renderToStaticMarkup(<InterludeScreen seam={seam} />);
    expect(html).toContain('interlude-synth'); // le bandeau
    expect(html).toContain('●'); // pips d'Activités restantes DANS le bandeau (phase 1 incluse)
    expect(html).toContain('interlude-synth-purse'); // bourse du groupe (impact des événements visible)
    expect(html).toContain('Vétéran');
    expect(html).toContain('Forgeron');
  });

  it('Activités : UN héros à la fois (Tabs) + maître-détail (liste des Activités) + clôture pour l’hôte', () => {
    const seam = buildSeam();
    const html = renderToStaticMarkup(<InterludeScreen seam={{ ...seam, phase: 'activities' }} />);
    // plus AUCUNE saisie de libellé exact héritée du POC
    expect(html).not.toContain('nom exact');
    expect(html).toContain('tab-btn'); // Tabs (primitive UNIQUE) — les onglets SÉLECTIONNENT le héros (#330)
    expect(html.match(/interlude-hero panel/g)?.length).toBe(1); // UN SEUL volet de héros rendu à la fois
    expect(html).toContain('master-detail'); // gabarit MasterDetail (liste GAUCHE + détail CENTRE)
    expect(html).toContain('Revenus'); // Revenus est un volet comme les autres (gabarit commun)
    expect(html).toContain('Artisanat');
    expect(html).toContain('Apprentissage');
    expect(html).toContain('Commande');
    expect(html).toContain('Banque');
    expect(html).toContain('Identifier');
    expect(html).toContain('●'); // pips (bandeau)
    expect(html).toContain('Clore l&#x27;interlude…');
  });

  it('pied FIXE du volet : le PRÉ-JET (compétence + Difficulté) est visible AVANT « Entreprendre » (Revenus)', () => {
    const seam = buildSeam();
    const hero = seam.party[0]; // Vétéran
    const html = renderToStaticMarkup(
      <InterludeScreen seam={{ ...seam, phase: 'activities', openPane: { heroId: hero.id, pane: 'revenus' } }} />,
    );
    expect(html).toContain('master-detail'); // maître-détail (#330) : liste GAUCHE + détail CENTRE
    expect(html).toContain('interlude-pane-desc'); // la description VERBATIM `<Prose>` (`desc` de activities.json)
    expect(html).toContain('Cette Activité englobe'); // desc de Revenus — EXISTAIT en donnée, jamais affichée avant #330
    expect(html).toContain('interlude-pane-foot'); // le pied du gabarit
    expect(html).toContain('rm-roll pending'); // la ligne de pré-jet (PendingRollLine)
    expect(html).toContain('Accessible'); // la Difficulté du Test de Revenus (LDB 08)
    expect(html).toContain('Entreprendre');
    expect(html).toMatch(/\d ×/); // la formule de Revenus (« N × 2d10 sous »…)
  });

  it('pied FIXE d’une Activité du CATALOGUE : compétence en chip + Difficulté avant « Entreprendre » (Convalescence)', () => {
    const seam = buildSeam();
    useGame.setState({ worldMap: null });
    const catalog = interludeCatalog(useGame.getState());
    const hero = seam.party[0];
    const html = renderToStaticMarkup(
      <InterludeScreen seam={{ ...seam, phase: 'activities', catalog, openPane: { heroId: hero.id, pane: 'convalescence' } }} />,
    );
    expect(html).toContain('master-detail'); // maître-détail (#330)
    expect(html).toContain('interlude-pane-foot');
    expect(html).toContain('Calme'); // la compétence du Test (chip Codex)
    expect(html).toContain('Très difficile'); // la Difficulté (chip de mod du pré-jet)
    expect(html).toContain('Entreprendre');
  });

  it('activité SANS jet (Banque) : formule/coût dans le même pied, sans ligne de pré-jet', () => {
    const seam = buildSeam();
    const hero = seam.party[0];
    const html = renderToStaticMarkup(
      <InterludeScreen seam={{ ...seam, phase: 'activities', openPane: { heroId: hero.id, pane: 'bank' } }} />,
    );
    expect(html).toContain('master-detail'); // maître-détail (#330)
    expect(html).toContain('interlude-pane-foot');
    expect(html).not.toContain('rm-roll pending'); // pas de Test : dépôt direct
    expect(html).toContain('Sans jet');
    expect(html).toContain('Investir');
    expect(html).toContain('Planquer');
  });

  it('clôture : récapitulatif confirmé (argent gaspillé annoncé, temps qui passe)', () => {
    const seam = buildSeam(2);
    const html = renderToStaticMarkup(<InterludeScreen seam={{ ...seam, phase: 'closing' }} />);
    expect(html).toContain('Clore l&#x27;interlude ?');
    expect(html).toContain('Argent à gaspiller');
    expect(html).toContain('14 jours');
    expect(html).toContain('Pas encore'); // annulable
  });
});

describe('InterludeScreen — coop (audit M7) : chacun mène SES héros', () => {
  beforeEach(() => { vi.useFakeTimers(); });

  it('invité : ses héros actifs, ceux des autres en lecture seule (propriétaire affiché), pas de « Clore »', () => {
    const seam = buildSeam(2);
    const [a, b] = seam.party; // a = Vétéran, b = Forgeron
    const html = renderToStaticMarkup(
      <InterludeScreen seam={{
        ...seam,
        phase: 'activities',
        net: { mode: 'guest', mySeat: 1, ownership: { [a.id]: 0, [b.id]: 1 }, seatNames: { 0: 'Hôte', 1: 'Moi' } },
      }} />,
    );
    expect(html).toContain('interlude-owner'); // le héros de l'hôte porte son propriétaire (vignette + carte)
    expect(html).toContain('Hôte');
    expect(html).toContain('Mené par Hôte'); // … et ses volets sont désactivés (title)
    expect(html).not.toContain('Clore l&#x27;interlude…'); // la clôture appartient à l'hôte
    expect(html).toContain('L&#x27;hôte clôt l&#x27;interlude');
  });

  it('hôte : tout est actif chez lui, le héros de l’invité est en lecture seule', () => {
    const seam = buildSeam(2);
    const [a, b] = seam.party;
    const html = renderToStaticMarkup(
      <InterludeScreen seam={{
        ...seam,
        phase: 'activities',
        net: { mode: 'host', mySeat: 0, ownership: { [a.id]: 0, [b.id]: 1 }, seatNames: { 0: 'Hôte', 1: 'Antoine' } },
      }} />,
    );
    expect(html).toContain('Antoine');
    expect(html).toContain('interlude-owner');
    expect(html).toContain('Clore l&#x27;interlude…');
  });
});

describe('InterludeScreen — catalogue d’Activités data-driven (ADE2 + ACE Annexe I, gate `where`)', () => {
  beforeEach(() => { vi.useFakeTimers(); });
  afterEach(() => { vi.clearAllTimers(); vi.useRealTimers(); });

  it('hors d’Altdorf : la Convalescence (ADE2, sans gate) est proposée, pas les Activités d’ACE', () => {
    const seam = buildSeam();
    useGame.setState({ worldMap: null });
    const catalog = interludeCatalog(useGame.getState());
    const html = renderToStaticMarkup(<InterludeScreen seam={{ ...seam, phase: 'activities', catalog }} />);
    expect(html).toContain('Convalescence');
    expect(html).not.toContain('Pénitence');
    expect(html).not.toContain('Mécénat');
  });

  it('à Altdorf (place de la carte liée à la scène courante) : les Activités d’ACE apparaissent', () => {
    const seam = buildSeam();
    useGame.setState({ worldMap: { id: 'w', nom: 'W', places: [{ id: 'altdorf', label: 'Altdorf', pos: { x: 0, y: 0 }, scene: testScene.id }], routes: [] } });
    const catalog = interludeCatalog(useGame.getState());
    const html = renderToStaticMarkup(<InterludeScreen seam={{ ...seam, phase: 'activities', catalog }} />);
    expect(html).toContain('Convalescence');
    expect(html).toContain('Pénitence');
    expect(html).toContain('Entraînement avec une arme inhabituelle');
    expect(html).toContain('Tester des objets magiques');
    expect(html).toContain('Recherche universitaire');
    expect(html).not.toContain('Mécénat…'); // pas un volet héros : variante d'Opération bancaire (volet Banque)
  });
});

describe('InterludeScreen — refonte visuelle #257 (coquille dédiée, masthead orné, chronique)', () => {
  beforeEach(() => { vi.useFakeTimers(); });
  afterEach(() => { vi.clearAllTimers(); vi.useRealTimers(); });

  it('coquille dédiée à texture d’ambiance + masthead orné doré (plus de .menu-card partagé)', () => {
    const seam = buildSeam();
    const html = renderToStaticMarkup(<InterludeScreen seam={seam} />);
    expect(html).toContain('interlude-shell'); // coquille propre à l’interlude
    expect(html).toContain('tx-ink'); // texture d’ambiance chartée
    expect(html).toContain('ornate-frame'); // OrnateFrame du masthead (identité de cérémonie)
    expect(html).toContain('interlude-title'); // titre gothique (font-display)
    expect(html).not.toContain('menu-card'); // découplé de l’écran voisin en refonte
  });

  it('filet de phase (RuleDivider labellisé) : « nouvelles » en Événements, « Activités » ensuite', () => {
    const seam = buildSeam();
    const events = renderToStaticMarkup(<InterludeScreen seam={seam} />);
    expect(events).toContain('Les nouvelles de la période');
    const acts = renderToStaticMarkup(<InterludeScreen seam={{ ...seam, phase: 'activities' }} />);
    expect(acts).toContain('Les Activités du groupe');
  });

  it('phase Événements : chronique sur parchemin + sceau de cire portant le d100', () => {
    const seam = buildSeam();
    const html = renderToStaticMarkup(<InterludeScreen seam={seam} />);
    expect(html).toContain('parchment-card'); // récit enluminé par héros (primitive ParchmentCard)
    expect(html).toContain('tx-parchment'); // parchemin (récit dark-ink)
    expect(html).toContain('parchment-seal'); // sceau du d100
    expect(html).toContain('parchment-card-title'); // titre d’événement en font-display
  });

  it('zéro emoji dans les affordances de clôture (charte)', () => {
    const seam = buildSeam(2);
    const html = renderToStaticMarkup(<InterludeScreen seam={{ ...seam, phase: 'activities' }} />);
    expect(html).not.toMatch(/💸|⏳/);
  });
});

describe("InterludeScreen -- libelles i18n Phase D", () => {
  beforeEach(() => { vi.useFakeTimers(); });
  afterEach(() => { vi.clearAllTimers(); vi.useRealTimers(); });

  it("affiche le titre, le hint d'evenements et le CTA Passer aux Activites", () => {
    const seam = buildSeam();
    const html = renderToStaticMarkup(<InterludeScreen seam={seam} />);
    expect(html).toContain("Entre deux aventures");
    expect(html).toContain("Pendant que le groupe souffle");
    expect(html).toContain("Passer aux Activités →");
  });

  it("phase activites : bouton Clore l'interlude visible pour l'hote", () => {
    const seam = buildSeam(2);
    const html = renderToStaticMarkup(<InterludeScreen seam={{ ...seam, phase: "activities" }} />);
    expect(html).toMatch(/Clore l\S*interlude\S*/);
  });

  it("phase closing : titre recapitulatif et boutons de confirmation", () => {
    const seam = buildSeam(2);
    const html = renderToStaticMarkup(<InterludeScreen seam={{ ...seam, phase: "closing" }} />);
    expect(html).toMatch(/Clore l\S*interlude \?/);
    expect(html).toContain("Pas encore");
  });

  it("invite : message d'attente hote visible", () => {
    const seam = buildSeam(2);
    const [a, b] = seam.party;
    const html = renderToStaticMarkup(
      <InterludeScreen seam={{
        ...seam,
        phase: "activities",
        net: { mode: "guest", mySeat: 1, ownership: { [a.id]: 0, [b.id]: 1 }, seatNames: { 0: "Hote", 1: "Moi" } },
      }} />,
    );
    expect(html).toMatch(/L\S*h\S*te cl\S*t l\S*interlude/);
  });
});
