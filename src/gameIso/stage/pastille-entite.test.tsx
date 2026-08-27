// @vitest-environment jsdom
import { act } from 'react';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createRoot, type Root } from 'react-dom/client';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { MondeDeCampagne } from './MondeDeCampagne';
import { setStageRendererFactory } from './GameStage3D';
import { battreStageFrames } from './stageFrames';
import { BancRenderer, brancherArdoise } from './banc-volumique';
import { useGame, type BattleState } from '../../state/store';
import { emptyScene } from '../../state/scene';
import { flowFromEffects } from '../../state/flow';
import { itemFromTrappingById } from '../../engine/items';
import { ACTIONS, type ActionDef } from '../../data/index';
import { ACTION_CANDIDATES, ACTION_PORTEURS } from '../../state/actionRegistry';
import type { Combatant, ShipPoste } from '../../engine/types';
import type { Scene } from '../../state/scene';

/**
 * LES PASTILLES D'ENTITÉ (#1411 P2-C, spec HUD combat zone 4) — « le geste vit sur ce qui l'offre » :
 * Monter naît de la MONTURE, Servir/Pousser de la PIÈCE, Ramasser du TAS au sol. Ces gestes SORTENT de
 * la console (géométrie immuable, arbitrage HUD 2026-08-16) et se peignent sur leur porteur.
 *
 * Ce que ces sondes mesurent :
 *  (1) LE PICKING — une pastille dessinée dans le SVG du monde n'y déclenche PAS le clic-monde (sinon
 *      un clic vaudrait deux gestes) ; le témoin POSITIF (le même geste ailleurs sur le SVG atteint
 *      bien le picking) borne la mesure ;
 *  (2) LA POPULATION — une entité qui offre, une pastille ; une qui n'offre pas, rien ;
 *  (3) LE PANNEAU — N choix d'une MÊME entité s'y bornent (jamais une liste), et le choix commet ;
 *  (4) LES LOIS — refus VISIBLE avec sa raison, annulation gratuite, coop (siège non propriétaire) ;
 *  (5) LA SURFACE STRUCTURELLE — une entrée `pastille-entite` FABRIQUÉE, avec son sélecteur et son
 *      porteur, rend une pastille SANS une ligne de code : c'est ce qui fait du registre la surface.
 */
(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const CHARS = {
  'capacite-de-combat': 30, 'capacite-de-tir': 30, force: 40, endurance: 30, initiative: 30,
  agilite: 30, dexterite: 30, intelligence: 30, 'force-mentale': 30, sociabilite: 30,
};

const hero = (id: string, pos: { x: number; y: number }, over: Partial<Combatant> = {}): Combatant =>
  ({
    id, label: id, name: id, kind: 'hero', pos, size: 'moyenne', characteristics: CHARS,
    wounds: { current: 12, max: 12 }, advantage: 0, conditions: [], weapons: [], items: [],
    skills: [], talents: [], armour: {}, movement: 4, loaded: true, ...over,
  }) as unknown as Combatant;

const combat = (combatants: Combatant[], over: Partial<BattleState> = {}): BattleState =>
  ({
    combatants, order: [combatants[0].id], baseOrder: [combatants[0].id], turn: 0, round: 1,
    action: null, selectedSpellId: null, reachable: new Map(), movementUsed: 0, movedPreAction: false,
    acted: false, log: [], over: null, zones: [], preview: null, ...over,
  }) as unknown as BattleState;

let root: Root | null = null;
let conteneur: HTMLDivElement | null = null;

brancherArdoise();

function monter(retouche: Record<string, unknown>): HTMLDivElement {
  useGame.setState({
    scene: emptyScene(12, 12),
    mode: 'battle',
    viewMode: 'iso',
    partyPos: { x: 6, y: 6 },
    dialogue: null,
    flags: {},
    hovered: null,
    pendingAttack: null,
    net: { mode: 'local', mySeat: 0, gmSeat: null, ownership: {} },
    ...retouche,
  } as never);
  conteneur = document.createElement('div');
  document.body.appendChild(conteneur);
  root = createRoot(conteneur);
  act(() => root!.render(<MondeDeCampagne />));
  return conteneur;
}

function démonter(): void {
  if (root) { act(() => root!.unmount()); root = null; }
  if (conteneur) { conteneur.remove(); conteneur = null; }
}

beforeAll(() => {
  Object.defineProperty(HTMLCanvasElement.prototype, 'clientWidth', { configurable: true, get: () => 800 });
  Object.defineProperty(HTMLCanvasElement.prototype, 'clientHeight', { configurable: true, get: () => 600 });
  setStageRendererFactory(() => new BancRenderer());
});
afterAll(() => setStageRendererFactory(null));
beforeEach(() => {
  vi.stubGlobal('requestAnimationFrame', () => 0);
  vi.stubGlobal('cancelAnimationFrame', () => {});
});
afterEach(() => {
  démonter();
  useGame.setState({ battle: null, party: [], net: { mode: 'local', mySeat: 0, gmSeat: null, ownership: {} } } as never);
  vi.unstubAllGlobals();
});

/** La pastille d'une entité, telle qu'elle vit au DOM (dans le groupe recalé par la boucle de marche). */
const pastille = (el: HTMLElement, entityId: string) =>
  el.querySelector(`svg.iso-stage g[data-geste-cid="${entityId}"] [data-pastille-entite]`) as HTMLElement | null;
const boutonDe = (el: HTMLElement, entityId: string) =>
  pastille(el, entityId)?.querySelector('button') as HTMLButtonElement | null;
const panneau = () => document.querySelector('[data-panneau-parametre]') as HTMLElement | null;

/** Un geste de pointeur (React lit le TYPE, pas la classe d'événement — cf. `pan-camera-imperatif`). */
const geste = (cible: Element, type: string) =>
  act(() => { cible.dispatchEvent(new MouseEvent(type, { clientX: 100, clientY: 100, button: 0, bubbles: true })); });

/** Le SVG du plateau, muni du témoin de picking : `useStagePointer` capture le pointeur sur LUI à
 *  chaque `pointerdown` qui l'atteint — c'est le signal « le clic-monde a eu lieu ». */
/** Le contenu d'une fonction de transformation (`matrix(…)`, `scale(…)`) — lu sans expression
 *  régulière, pour que la sonde mesure ce que le DOM porte et rien d'autre. */
/** La feuille du CHROME DU MONDE — contrat CSS lu à la source (jsdom n'applique aucune mise en page). */
const animCss = () => readFileSync(resolve(process.cwd(), 'src/gameIso/anim.css'), 'utf8');

const entreParentheses = (t: string) => t.slice(t.indexOf('(') + 1, t.lastIndexOf(')'));

/** Cadre de rendu SIMULÉ : jsdom ne met rien en page, la surcouche lit donc `clientWidth/Height` du
 *  SVG porteur — on les pose, comme `pick-parity`/`stage-pinch` posent leur `getBoundingClientRect`. */
function poserCadre(w: number, h: number): void {
  Object.defineProperty(SVGElement.prototype, 'clientWidth', { configurable: true, get: () => w });
  Object.defineProperty(SVGElement.prototype, 'clientHeight', { configurable: true, get: () => h });
}

function svgTémoin(el: HTMLElement): { svg: SVGSVGElement; capture: ReturnType<typeof vi.fn> } {
  const svg = el.querySelector('svg.iso-stage') as SVGSVGElement;
  const capture = vi.fn();
  svg.setPointerCapture = capture;
  svg.releasePointerCapture = () => undefined;
  svg.getBoundingClientRect = () => ({ left: 0, top: 0, width: 1280, height: 720, right: 1280, bottom: 720, x: 0, y: 0, toJSON: () => ({}) }) as DOMRect;
  return { svg, capture };
}

// ── Fixtures des trois familles de porteurs ─────────────────────────────────────────────────────
const mkPoste = (engineId: string, crewIds: string[]): ShipPoste => ({ item: itemFromTrappingById(engineId)!, crewIds });

const mkHull = (postes: ShipPoste[], pos = { x: 4, y: 3 }): Combatant =>
  ({ id: 'hull', label: 'Bélier', name: 'Bélier', kind: 'enemy', pos, conditions: [], weapons: [],
    inert: true, wounds: { current: 0, max: 0 }, advantage: 0, postes }) as unknown as Combatant;

/** Une scène portant un TAS d'objets ramassables adjacent au héros. */
function sceneAvecTas(nb: number): Scene {
  const sc = emptyScene(12, 12);
  sc.entities.push({
    id: 'tas', kind: 'prop', pos: { x: 4, y: 3 }, label: 'Tas',
    interact: { flow: flowFromEffects(Array.from({ length: nb }, (_, i) => ({ type: 'giveTrapping', custom: `Objet ${i + 1}` }))) },
  } as never);
  return sc;
}

describe('Pastille d’entité — le geste vit sur ce qui l’offre (#1411 P2-C, spec zone 4)', () => {
  it('MONTURE adjacente : une pastille sur ELLE, et le clic enfourche CETTE monture', () => {
    const h = hero('h1', { x: 3, y: 3 });
    const m = hero('m1', { x: 3, y: 4 }, { mountable: true, label: 'Destrier' } as Partial<Combatant>);
    const el = monter({ party: [h], battle: combat([h, m]) });
    expect(pastille(el, 'm1'), 'la monture porte la pastille').toBeTruthy();
    expect(pastille(el, 'h1'), 'le héros actif n’offre rien à lui-même').toBeNull();
    act(() => boutonDe(el, 'm1')!.click());
    const st = useGame.getState();
    expect(st.battle!.combatants.find((c) => c.id === 'h1')!.mountId, 'la monture désignée est enfourchée').toBe('m1');
  });

  it('MONTURE hors de portée : aucune pastille (l’offre est celle du registre, pas un dessin décoratif)', () => {
    const h = hero('h1', { x: 3, y: 3 });
    const m = hero('m1', { x: 9, y: 9 }, { mountable: true } as Partial<Combatant>);
    const el = monter({ party: [h], battle: combat([h, m]) });
    expect(pastille(el, 'm1')).toBeNull();
  });

  it('PICKING — le clic de la pastille n’est PAS un clic-monde (témoin positif : le même geste sur le SVG l’est)', () => {
    const h = hero('h1', { x: 3, y: 3 });
    const m = hero('m1', { x: 3, y: 4 }, { mountable: true } as Partial<Combatant>);
    const el = monter({ party: [h], battle: combat([h, m]) });
    const { svg, capture } = svgTémoin(el);
    // TÉMOIN : hors de la pastille, le picking du monde reçoit bien le geste (la mesure est vivante).
    geste(svg, 'pointerdown');
    expect(capture, 'témoin : le SVG capture le pointeur d’un clic-monde').toHaveBeenCalledTimes(1);
    capture.mockClear();
    // MESURE : sur la pastille, l'événement s'arrête chez elle — le monde dessous n'est pas cliqué.
    const btn = boutonDe(el, 'm1')!;
    geste(btn, 'pointerdown');
    geste(btn, 'pointerup');
    expect(capture, 'la pastille ne laisse PAS le clic filer au monde').not.toHaveBeenCalled();
  });

  it('PICKING — la BOÎTE de la pastille ne mange pas le champ (206 px de bande, recette 2026-08-23)', () => {
    const h = hero('h1', { x: 3, y: 3 });
    const m = hero('m1', { x: 3, y: 4 }, { mountable: true } as Partial<Combatant>);
    const el = monter({ party: [h], battle: combat([h, m]) });
    const { capture } = svgTémoin(el);
    // La boîte du geste couvre plusieurs cases : seul le BOUTON prend le pointeur. Un geste qui tombe
    // sur la boîte (et pas sur le bouton) doit atteindre le monde — sinon une bande du champ devient
    // muette au clic ET au survol, alors qu'elle continue d'y surligner des cases.
    geste(pastille(el, 'm1')!, 'pointerdown');
    expect(capture, 'la boîte laisse passer : elle n’arrête rien, seul le bouton le fait').toHaveBeenCalledTimes(1);
    capture.mockClear();
    geste(boutonDe(el, 'm1')!, 'pointerdown');
    expect(capture, 'le bouton, lui, consomme son pointeur').not.toHaveBeenCalled();
    // …et la transparence au pointeur est DITE dans la feuille du chrome (jsdom ne fait aucune mise en
    // page : c'est le contrat CSS qui la porte au navigateur, et le rendu qui n'arrête rien à la boîte).
    const css = animCss();
    const bloc = css.slice(css.indexOf('.pastille-entite {'), css.indexOf('.pastille-entite .pe-cost'));
    expect(bloc, 'la boîte est transparente au pointeur').toContain('pointer-events: none');
    expect(bloc, 'et le bouton le reçoit, lui seul').toContain('.pastille-entite .btn {');
    expect(bloc.slice(bloc.indexOf('.pastille-entite .btn {')), 'le bouton reçoit le pointeur').toContain('pointer-events: auto');
  });

  it('PANNEAU ancré au MONDE : un cran de molette le ferme (recette 2026-08-23 — il y survivait)', () => {
    // L'ancre du panneau vit dans la carte : zoomer la déplace sous lui. Le repère (pan/lacet/zoom) est
    // pris À L'OUVERTURE et comparé au battement de la caméra ; le prendre en DÉPENDANCE d'effet le
    // re-capturait à chaque cran, et la comparaison n'était jamais vraie.
    const h = hero('h1', { x: 3, y: 3 });
    const p1 = mkPoste('belier-ade2', []);
    const p2 = mkPoste('belier-ade2', []);
    const el = monter({ party: [h], battle: combat([h, mkHull([p1, p2])]) });
    act(() => boutonDe(el, 'hull')!.click());
    expect(panneau(), 'le panneau est ouvert').toBeTruthy();
    // Deux temps, comme au navigateur : le cran de molette écrit le store et REND (l'effet se
    // remonterait ici), PUIS la boucle de caméra bat. En un seul temps, la sonde ne verrait jamais le
    // défaut — c'est le rendu intercalé qui re-capturait le repère.
    act(() => { useGame.setState({ zoom: useGame.getState().zoom * 1.2 } as never); });
    act(() => { battreStageFrames(); });
    expect(panneau(), 'un cran de molette le referme — annulation gratuite').toBeNull();
  });

  it('PIÈCES servables (N sur une même coque) : UN panneau-paramètre borné, et le choix sert CE poste', () => {
    const h = hero('h1', { x: 3, y: 3 });
    const p1 = mkPoste('belier-ade2', []);
    const p2 = mkPoste('belier-ade2', []);
    const hull = mkHull([p1, p2]);
    const el = monter({ party: [h], battle: combat([h, hull]) });
    const btn = boutonDe(el, 'hull')!;
    expect(btn.textContent, 'la pastille annonce les N gestes de son entité').toContain('2');
    expect(panneau(), 'rien n’est ouvert avant le geste').toBeNull();
    act(() => btn.click());
    const options = [...panneau()!.querySelectorAll('button')];
    expect(options.length, 'un candidat par pièce, bornés à CETTE entité').toBe(2);
    act(() => options[1].click());
    const st = useGame.getState();
    expect(st.battle!.combatants.find((c) => c.id === 'h1')!.mannedPoste?.item.uid, 'le poste ÉLU est servi').toBe(p2.item.uid);
    expect(panneau(), 'un clic = commit + fermeture').toBeNull();
  });

  it('OBJETS au sol (N sur un même tas) : le panneau les borne, et le choix ramasse CET objet', () => {
    const h = hero('h1', { x: 3, y: 3 });
    const el = monter({ party: [h], battle: combat([h]), scene: sceneAvecTas(2) });
    const btn = boutonDe(el, 'tas')!;
    act(() => btn.click());
    const options = [...panneau()!.querySelectorAll('button')];
    expect(options.length, 'un candidat par objet du tas').toBe(2);
    act(() => options[0].click());
    const porteur = useGame.getState().battle!.combatants.find((c) => c.id === 'h1')!;
    expect(porteur.items?.length, 'l’objet élu est ramassé').toBe(1);
  });

  it('POUSSER : la pastille naît de la pièce SERVIE, arme le mode, et le re-clic le désarme (gratuit)', () => {
    const poste = mkPoste('belier-ade2', ['h1', 's1', 's2']);
    const h = hero('h1', { x: 4, y: 4 }, { mannedPoste: poste } as Partial<Combatant>);
    const s1 = hero('s1', { x: 5, y: 4 }, { kind: 'npc' } as Partial<Combatant>);
    const s2 = hero('s2', { x: 3, y: 4 }, { kind: 'npc' } as Partial<Combatant>);
    const hull = mkHull([poste], { x: 4, y: 3 });
    const el = monter({ party: [h], battle: combat([h, hull, s1, s2]) });
    const btn = boutonDe(el, 'hull')!;
    expect(btn.textContent, 'le geste de la pièce servie est Pousser').toContain('Pousser');
    act(() => btn.click());
    expect(useGame.getState().battle!.action, 'le mode de poussée est ARMÉ').toBe('push');
    expect(useGame.getState().battle!.reachable.size, 'et sa portée est peinte').toBeGreaterThan(0);
    act(() => boutonDe(el, 'hull')!.click());
    expect(useGame.getState().battle!.action, 'annulation GRATUITE au re-clic').toBeNull();
  });

  it('PIÈCE NON POUSSABLE (pierrier naval) : AUCUNE pastille Pousser — jamais un clic muet (recette F1)', () => {
    // Le pierrier est une arme de siège SANS Qualité `equipe` (`trappings.json`) : rien à pousser
    // (ADE II 8 l.258 vise les engins à roues servis en équipe). L'affordance est celle de la source
    // unique `pushSlot` — la pastille ne se dessine donc pas, au lieu d'accueillir un clic sans effet.
    const poste = mkPoste('pierrier', ['h1']);
    const h = hero('h1', { x: 4, y: 4 }, { mannedPoste: poste } as Partial<Combatant>);
    const hull = mkHull([poste], { x: 4, y: 3 });
    const el = monter({ party: [h], battle: combat([h, hull]) });
    expect(pastille(el, 'hull'), 'aucun geste offert par une pièce qui ne se pousse pas').toBeNull();
  });

  it('ÉQUIPE INSUFFISANTE : la pastille RESTE et porte sa raison (ADE II 8 l.233), sans rien armer', () => {
    // Un bélier demande une Équipe (Qualité `equipe`) ; sous la moitié requise, l'engin ne peut être mû.
    // Le refus se lit AU GESTE (loi 2026-08-19), il n'escamote pas la pastille.
    const poste = mkPoste('belier-ade2', ['h1']);
    const h = hero('h1', { x: 4, y: 4 }, { mannedPoste: poste } as Partial<Combatant>);
    const hull = mkHull([poste], { x: 4, y: 3 });
    const el = monter({ party: [h], battle: combat([h, hull]) });
    const btn = boutonDe(el, 'hull')!;
    // Refusé par `aria-disabled` (jamais `disabled`) : la pastille reste FOCALISABLE, donc sa raison —
    // qui naît au survol/focus/tap dans l'infobulle partagée — est atteignable au clavier, à la manette
    // et au doigt. Elle reste par ailleurs LUE au point du geste (copie `aria-describedby`).
    expect(btn.getAttribute('aria-disabled'), 'le geste est refusé').toBe('true');
    expect(btn.disabled, 'un geste refusé `disabled` couperait toute lecture de sa raison').toBe(false);
    expect(pastille(el, 'hull')!.textContent, 'et sa raison est portée au point du geste').toContain('équipe');
    act(() => btn.click());
    expect(useGame.getState().battle!.action, 'rien n’est armé').toBeNull();
  });

  it('CHEF SONNÉ : Pousser coûte le MOUVEMENT, pas l’Action — le geste MORD (sonde du juge, R1)', () => {
    // L'État Sonné (`etats.json`, LDB 08) laisse le déplacement à demi-budget et retire l'Action. L'entrée
    // « Pousser » du registre déclare `cost: 'mouvement'` (`actions.json`, sa raison `maison` à l'appui ; ADE II 8
    // l.256/258) : un chef Sonné pousse donc, à demi-budget. Exiger la capacité d'ACTION au dispatcher
    // faisait mentir ce coût déclaré — et rendait le clic MUET.
    const poste = mkPoste('belier-ade2', ['h1', 's1', 's2']);
    const h = hero('h1', { x: 4, y: 4 }, { mannedPoste: poste, conditions: [{ id: 'sonne', stacks: 1 }] } as unknown as Partial<Combatant>);
    const s1 = hero('s1', { x: 5, y: 4 }, { kind: 'npc' } as Partial<Combatant>);
    const s2 = hero('s2', { x: 3, y: 4 }, { kind: 'npc' } as Partial<Combatant>);
    const hull = mkHull([poste], { x: 4, y: 3 });
    const el = monter({ party: [h], battle: combat([h, hull, s1, s2]) });
    const btn = boutonDe(el, 'hull')!;
    expect(btn.disabled, 'le geste reste OFFERT : le Sonné garde son Mouvement').toBe(false);
    act(() => btn.click());
    expect(useGame.getState().battle!.action, 'et il MORD (aucun clic muet)').toBe('push');
  });

  it('CHEF CLOUÉ (Inconscient) : le geste est REFUSÉ AVEC SA RAISON, jamais un clic muet', () => {
    // `gating.movement: 'none'` (etats.json) → budget de Mouvement nul : le verdict du registre le DIT
    // au point du geste, au lieu de laisser le dispatcher rendre en silence.
    const poste = mkPoste('belier-ade2', ['h1', 's1', 's2']);
    const h = hero('h1', { x: 4, y: 4 }, { mannedPoste: poste, conditions: [{ id: 'inconscient', stacks: 1 }] } as unknown as Partial<Combatant>);
    const s1 = hero('s1', { x: 5, y: 4 }, { kind: 'npc' } as Partial<Combatant>);
    const s2 = hero('s2', { x: 3, y: 4 }, { kind: 'npc' } as Partial<Combatant>);
    const hull = mkHull([poste], { x: 4, y: 3 });
    // Un SECOND héros debout : sans lui, le groupe entier serait hors d'action et le combat se
    // terminerait (défaite) avant qu'aucune affordance ne se peigne — ce n'est pas ce qu'on mesure.
    const debout = hero('h2', { x: 2, y: 2 });
    const el = monter({ party: [h, debout], battle: combat([h, hull, s1, s2, debout]) });
    expect(boutonDe(el, 'hull')!.getAttribute('aria-disabled'), 'geste fermé').toBe('true');
    expect(pastille(el, 'hull')!.textContent, 'la raison est lisible').toContain('mouvoir');
    expect(useGame.getState().battle!.action, 'rien n’est armé').toBeNull();
  });

  it('REFUS VISIBLE : gate fermée → la pastille RESTE, porte sa raison, et ne commet rien', () => {
    const h = hero('h1', { x: 3, y: 3 });
    const m = hero('m1', { x: 3, y: 4 }, { mountable: true } as Partial<Combatant>);
    // Mouvement déjà dépensé : le verdict `mouvement-intact` refuse « Monter ».
    const el = monter({ party: [h], battle: combat([h, m], { movementUsed: 4 }) });
    const btn = boutonDe(el, 'm1')!;
    expect(btn.getAttribute('aria-disabled'), 'le geste refusé doit être inerte').toBe('true');
    expect(pastille(el, 'm1')!.textContent, 'la raison est LISIBLE au point du geste').toContain('Mouvement');
    act(() => btn.click());
    expect(useGame.getState().battle!.combatants.find((c) => c.id === 'h1')!.mountId, 'rien n’est commis').toBeUndefined();
  });

  it('COOP — un siège qui ne contrôle pas l’actif ne voit AUCUNE pastille', () => {
    const h = hero('h1', { x: 3, y: 3 });
    const m = hero('m1', { x: 3, y: 4 }, { mountable: true } as Partial<Combatant>);
    const el = monter({
      party: [h], battle: combat([h, m]),
      net: { mode: 'guest', mySeat: 1, gmSeat: null, ownership: { h1: 0 } },
    });
    expect(pastille(el, 'm1'), 'le héros d’un autre joueur n’ouvre pas ses gestes ici').toBeNull();
  });

  it('CIBLE TACTILE — ≥ 40 px D’ÉCRAN à TOUT zoom et TOUT viewport (9 combinaisons)', () => {
    // Mesure en PIXELS D'ÉCRAN, sur la chaîne RENDUE : la matrice du groupe caméra telle qu'elle est
    // écrite dans le DOM, et le recouvrement `slice` du viewBox tel que le SVG le déclare (son
    // `viewBox` et sa taille). Rien n'est repris du module qui pose la contre-échelle — sans quoi la
    // sonde mesurerait sa propre formule.
    const h = hero('h1', { x: 3, y: 3 });
    const m = hero('m1', { x: 3, y: 4 }, { mountable: true } as Partial<Combatant>);
    const mesures: string[] = [];
    for (const [w, hh] of [[1920, 1080], [1280, 720], [360, 640]] as const) {
      for (const zoom of [0.4, 1, 2.6]) {
        poserCadre(w, hh);
        const el = monter({ party: [h], battle: combat([h, m]), zoom });
        const svg = el.querySelector('svg.iso-stage') as SVGSVGElement;
        const [, , vbW, vbH] = svg.getAttribute('viewBox')!.split(' ').map(Number);
        const cssCam = (svg.querySelector('g') as SVGGElement).style.transform; // matrix(k, 0, 0, k, tx, ty)
        const camK = Number(entreParentheses(cssCam).split(',')[0]);
        const slice = Math.max(w / vbW, hh / vbH); // preserveAspectRatio="xMidYMid slice"
        const groupe = el.querySelector('svg.iso-stage g[data-geste-cid] > g') as SVGGElement;
        const contre = Number(entreParentheses(groupe.getAttribute('transform')!)); // scale(e)
        const btn = boutonDe(el, 'm1')!;
        const nominal = Number((el.querySelector('svg.iso-stage foreignObject') as SVGElement).getAttribute('height'));
        const ecran = nominal * contre * camK * slice;
        const mesure = `${w}×${hh} z${zoom} → ${ecran.toFixed(1)} px`;
        mesures.push(mesure);
        expect(btn.className, 'la cible vient de la primitive (`.btn-tactile`, base.css)').toContain('btn-tactile');
        expect(ecran, `cible écran : ${mesure}`).toBeGreaterThanOrEqual(40);
        démonter();
      }
    }
    expect(mesures.length, 'les neuf combinaisons sont bien mesurées').toBe(9);
  });
});

/**
 * LA SURFACE EST LE REGISTRE (garde structurelle de `state/action-atteignabilite.test.ts`, qui tourne
 * en `node` et ne peut mesurer qu'une lecture de source). Ici, au DOM : une entrée `pastille-entite`
 * FABRIQUÉE — avec son sélecteur et son porteur — reçoit sa pastille sans qu'aucune ligne de rendu ne
 * la nomme. Débrancher le rendeur (`TokenChromeOverlay` → `PastilleEntite`) vire cette sonde rouge.
 */
describe('Pastille d’entité — le REGISTRE est la surface (aucun id d’action dans le rendu)', () => {
  const FABRIQUÉE: ActionDef = {
    id: 'geste-fabrique', label: 'Geste fabriqué', icon: 'action/mount', surface: 'pastille-entite',
    gate: 'toujours', candidates: 'candidats-fabriques', cost: 'gratuit',
  } as ActionDef;

  beforeEach(() => {
    ACTION_CANDIDATES['candidats-fabriques'] = ({ battle }) => battle.combatants.filter((c) => c.id === 'cible');
    ACTION_PORTEURS['candidats-fabriques'] = (c) => ({ porteurId: (c as Combatant).id, args: {} });
    ACTIONS.push(FABRIQUÉE);
  });
  afterEach(() => {
    ACTIONS.splice(ACTIONS.indexOf(FABRIQUÉE), 1);
    delete ACTION_CANDIDATES['candidats-fabriques'];
    delete ACTION_PORTEURS['candidats-fabriques'];
  });

  it('une entrée FABRIQUÉE reçoit sa pastille, avec son libellé et son coût, sans code', () => {
    const h = hero('h1', { x: 3, y: 3 });
    const cible = hero('cible', { x: 4, y: 3 }, { kind: 'enemy' } as Partial<Combatant>);
    const el = monter({ party: [h], battle: combat([h, cible]) });
    const btn = boutonDe(el, 'cible');
    expect(btn, 'l’entité désignée par le registre porte la pastille').toBeTruthy();
    expect(btn!.textContent).toContain('Geste fabriqué');
    expect(btn!.textContent, 'le coût de l’acte est dit sur la pastille').toContain('gratuit');
  });
});
