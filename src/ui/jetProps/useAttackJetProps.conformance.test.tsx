// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { Combatant, HitLocation, Weapon } from '../../engine/types';
import { openAttackCascade } from '../../state/combatFlow';
import { useGame, type BattleState } from '../../state/store';
import { testScene } from '../../scenes/test-fixture';
import { RollShell } from '../RollShell';
import { ANONYMES } from '../RollLine';
import { useAttackJetProps } from './useAttackJetProps';

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const characteristics = {
  'capacite-de-combat': 45,
  'capacite-de-tir': 40,
  force: 35,
  endurance: 35,
  initiative: 30,
  agilite: 40,
  dexterite: 30,
  intelligence: 30,
  'force-mentale': 30,
  sociabilite: 30,
};
const sword = {
  name: 'Épée',
  label: 'Épée',
  type: 'melee',
  damage: { plusBF: true, flat: 0, bare: true },
  uid: 'sword',
  qualities: [],
} as unknown as Weapon;
const bow = {
  name: 'Arc',
  label: 'Arc',
  type: 'ranged',
  damage: { plusBF: false, flat: 8 },
  range: 60,
  uid: 'bow',
  qualities: [],
} as unknown as Weapon;

function combatant(id: string, label: string, kind: 'hero' | 'enemy', x: number, weapons: Weapon[] = [sword], advantage = 0): Combatant {
  return {
    id,
    name: label,
    label,
    kind,
    characteristics: { ...characteristics },
    conditions: [],
    traumas: [],
    engagedWith: [],
    skills: [],
    talents: [],
    items: [],
    weapons,
    advantage,
    size: 'moyenne',
    pos: { x, y: 0 },
    wounds: { current: 18, max: 18 },
    armour: { tete: 0, brasG: 0, brasD: 0, corps: 0, jambeG: 0, jambeD: 0 },
    species: 'humains-reiklander',
    bodyShape: 'humanoide',
    movement: 4,
  } as unknown as Combatant;
}

function Probe() {
  const props = useAttackJetProps();
  return props ? <RollShell {...props} /> : null;
}

let root: Root | null = null;
let host: HTMLDivElement | null = null;

beforeEach(() => { ANONYMES.count = 0; });
afterEach(() => {
  if (root) act(() => root!.unmount());
  host?.remove();
  root = null;
  host = null;
});

/**
 * Monte l'écran d'attaque RÉEL (store → `openAttackCascade` → hook → `RollShell`). Les options
 * cadrent la SITUATION mesurée, jamais le rendu : arme tirée, distance, météo de la scène,
 * Localisation visée, tir en mouvement, États et AVANTAGE du jeteur. Défaut = duel de mêlée nu, par
 * temps clair, tireur immobile.
 */
function renderAttack(opts: { ranged?: boolean; cases?: number; fog?: boolean; location?: HitLocation; enMouvement?: boolean; avantage?: number; conditions?: { id: string; value: number }[] } = {}): HTMLDivElement {
  const weapon = opts.ranged ? bow : sword;
  // Tir : 20 cases = 40 m avec une Portée de 60 m → bande « Moyenne » (+0, aucune chip de portée) ;
  // 5 cases = 10 m → « Courte portée » (+20, entrée de la table). Mêlée : au contact. La distance est
  // CHOISIE pour que seules les circonstances mesurées pèsent.
  const attacker = combatant('attacker', 'Elsa', 'hero', 0, [weapon], opts.avantage ?? 0);
  const target = combatant('target', 'Gobelin', 'enemy', opts.cases ?? (opts.ranged ? 20 : 1));
  if (opts.conditions) (attacker as unknown as { conditions: unknown[] }).conditions = opts.conditions;
  const battle = {
    combatants: [attacker, target],
    order: [attacker.id, target.id],
    baseOrder: [attacker.id, target.id],
    turn: 0,
    round: 1,
    action: null,
    selectedSpellId: null,
    reachable: new Map(),
    movementUsed: 0,
    movedPreAction: false,
    acted: false,
    log: [],
    over: null,
  } as unknown as BattleState;
  useGame.setState({
    battle,
    mode: 'battle',
    scene: { ...testScene, weather: opts.fog ? 'brouillard' : 'clair' },
    gameTime: 12 * 60, // plein jour : l'obscurité de nuit ne se surajoute pas au brouillard mesuré
    pendingAttack: null,
    pendingCascade: null,
    net: { ...useGame.getState().net, mode: 'local', mySeat: 0, gmSeat: 0, ownership: {} },
  });
  openAttackCascade(
    useGame.getState,
    useGame.setState,
    { attackerId: attacker.id, targetId: target.id, location: opts.location ?? null, result: null, weaponUid: weapon.uid, heldGround: !opts.enMouvement },
    'Attaque',
    'action/attack',
  );
  host = document.createElement('div');
  document.body.appendChild(host);
  root = createRoot(host);
  act(() => root!.render(<Probe />));
  return host;
}

describe('Attaque — contrat d’affichage Z0–Z15', () => {
  it('rend une seule modale avec le titre nu, le sous-titre composé et un unique A→B', () => {
    const view = renderAttack();
    const dialogs = view.querySelectorAll('[role="dialog"]');
    expect(dialogs).toHaveLength(1);
    expect(dialogs[0].querySelector('h3')?.textContent).toBe('Attaque');
    expect(dialogs[0].querySelector('.rm-subtitle')?.textContent).toBe('Elsa — Attaque (Corps à corps)');
    expect(dialogs[0].querySelectorAll('.rm-vs')).toHaveLength(1);
    expect(dialogs[0].textContent).not.toContain('Round 1');
    expect(dialogs[0].textContent).not.toContain('Groupe');
  });
});

/**
 * GRILLE DE RECETTE du palier DÉRIVÉ (#1153 L3b-2), sur l'ÉCRAN RÉEL — aucun pending forgé. Mesuré :
 *  1. la zone Difficulté (Z5, `.rm-roll-diff`) dit le palier que les CIRCONSTANCES composent
 *     (`LDB 14 l.91-96`, verbatim : « le brouillard ajouté au fait de vouloir toucher une
 *     Localisation précise […] le Test devient simplement **Très Difficile (-30)** ») ;
 *  2. ces circonstances ne sont plus des chips — le palier les porte (composition au popover) ;
 *  3. un modificateur de JET (État du jeteur, `LDB 16 l.11` « à tous vos Tests ») RESTE une chip et
 *     ne bouge pas le palier : la taxonomie se VOIT à l'écran ;
 *  4. `ANONYMES.count === 0` partout : aucune ligne ne cache d'écart.
 */
describe('Attaque — la Difficulté DÉRIVE des circonstances (#1153 L3b-2)', () => {
  const ligne = (v: HTMLDivElement) => v.querySelector('.rm-roll-block') as HTMLElement;
  const palier = (v: HTMLDivElement) => ligne(v).querySelector('.rm-roll-diff')?.textContent;
  const chips = (v: HTMLDivElement) => Array.from(ligne(v).querySelectorAll('.rm-mod')).map((c) => c.textContent);
  const calcul = (v: HTMLDivElement) => ligne(v).querySelector('.rm-roll-calc')?.textContent;
  /** Le palier est-il sa PROPRE affordance de règle (déclencheur `CodexRef` → popover de composition,
   *  fiche « Combiner les Difficultés ») ? C'est la trace ADN du mode DÉRIVÉ — un palier CHOISI reste
   *  du texte nu. */
  const porte = (v: HTMLDivElement) => ligne(v).querySelector('.rm-roll-diff .codex-ref')?.textContent;
  /** OUVRE le popover du palier (survol) et rend son contenu : le popover est un PORTAL monté à la
   *  demande — sans le geste, il n'existe pas dans le DOM. C'est là que se lit la COMPOSITION. */
  const popover = (v: HTMLDivElement): string => {
    const trigger = ligne(v).querySelector('.rm-roll-diff .codex-ref');
    if (!trigger) return '';
    act(() => { trigger.dispatchEvent(new MouseEvent('mouseover', { bubbles: true })); });
    return document.querySelector('.codex-pop')?.textContent ?? '';
  };

  it('RAW l.95 — brouillard + Localisation visée : « Très difficile (−30) », zéro chip de circonstance', () => {
    const v = renderAttack({ ranged: true, fog: true, location: 'tete' });
    expect(palier(v)).toBe(' — Très difficile (−30)');
    expect(chips(v), 'les circonstances vivent dans le palier, pas en chips').toEqual([]);
    expect(ligne(v).textContent).not.toContain('plafond Difficultés');
    expect(ligne(v).textContent).not.toContain('autres');
    // Capacité de Tir 40 − 30 = 10, et non 40 − 40 : le plafond a mordu, le palier le DIT.
    expect(calcul(v)).toBe('40 −30 = 10');
    expect(porte(v), 'le palier DÉRIVÉ porte le popover de sa composition').toBe('Très difficile (−30)');
    expect(ANONYMES.count).toBe(0);
  });

  it('attaque simple : palier « Intermédiaire (+0) » (LDB 13 l.118), aucune chip', () => {
    const v = renderAttack();
    expect(palier(v)).toBe(' — Intermédiaire (+0)');
    expect(chips(v)).toEqual([]);
    expect(calcul(v)).toBe('45');
    expect(porte(v), 'palier CHOISI : aucun popover de composition à ouvrir').toBeUndefined();
    expect(ANONYMES.count).toBe(0);
  });

  it('l’État du JETEUR (Empoisonné, LDB 16 l.11) reste une CHIP — palier inchangé', () => {
    const v = renderAttack({ conditions: [{ id: 'empoisonne', value: 1 }] });
    expect(palier(v)).toBe(' — Intermédiaire (+0)');
    expect(chips(v)).toEqual(['−10 Empoisonné']);
    expect(calcul(v)).toBe('45 −10 = 35');
    expect(ANONYMES.count).toBe(0);
  });

  it('MIXTE — la chip d’État SURVIT à côté du palier composé par la Localisation visée', () => {
    const v = renderAttack({ location: 'tete', conditions: [{ id: 'empoisonne', value: 1 }] });
    expect(palier(v)).toBe(' — Difficile (−20)');
    expect(chips(v)).toEqual(['−10 Empoisonné']);
    expect(calcul(v)).toBe('45 −30 = 15');
    expect(ANONYMES.count).toBe(0);
  });

  /**
   * CAS DE RECETTE (bug reproduit 2× par le recetteur, capture `cas3-BUG-label-vs-cible.png`) — le
   * plafond MORD À CHEVAL sur les deux familles : les circonstances SEULES valent −10 (Complexe),
   * mais `combineMods` plafonne le pool COMMUN (Σ malus −40 → −30) et rembourse +10 aux
   * circonstances. Un palier dérivé de ce total annoncerait « Intermédiaire (+0) » — une Difficulté
   * que la table ne dit pas. Condition (d) : familles non séparables ⇒ REPLI intégral, tout se lit
   * en chips, l'amputation NOMMÉE comprise.
   */
  it('RECETTE — plafond à CHEVAL sur les deux familles : aucun palier dérivé, tout en chips', () => {
    const v = renderAttack({
      ranged: true, cases: 5, location: 'tete', enMouvement: true,
      conditions: [{ id: 'empoisonne', value: 1 }],
    });
    expect(palier(v), 'la Difficulté DÉCLARÉE tient — aucun palier menteur').toBe(' — Intermédiaire (+0)');
    expect(porte(v), 'rien à composer : pas de popover de composition').toBeUndefined();
    expect(chips(v)).toEqual([
      '−10 Empoisonné', // composante de la VALEUR (État du jeteur) — en tête, avant les mods de cible
      '+20 Courte portée',
      '−20 Localisation visée',
      '−10 Tir en bougeant',
      '+10 plafond Difficultés', // l'amputation reste NOMMÉE : sans palier à composer, elle est une chip
    ]);
    expect(calcul(v)).toBe('40 −10 = 30');
    expect(ANONYMES.count).toBe(0);
  });

  /**
   * Le palier ne se contente pas d'être une porte : son popover DIT sa composition. Sans cette
   * mesure, `difficultyParts` pourrait être vide/tronqué et le déclencheur resterait vert — le
   * joueur lirait « Très difficile » sans jamais savoir de quoi c'est fait.
   */
  it('le POPOVER du palier énumère les circonstances qui le composent', () => {
    const v = renderAttack({ ranged: true, fog: true, location: 'tete' });
    const pop = popover(v);
    expect(pop, 'l’instance lue à l’écran ouvre le popover').toContain('Très difficile (−30)');
    expect(pop, 'la règle qui plafonne est nommée').toContain('Combiner les Difficultés');
    expect(pop).toContain('−20 Brouillard');
    expect(pop).toContain('−20 Localisation visée');
    expect(pop, 'l’amputation du plafond est une composante du palier, pas un silence').toContain('+10 plafond Difficultés');
  });

  /**
   * AVANTAGE 6 (+60 `uncapped`, `LDB 13`) — Capacité de Combat 45 + 60 = 105, au-delà de la borne
   * `targetMax` : `clampTarget` ramène à 99 et MESURE l'amputation (−6). C'est le bug historique de
   * recette : sans le relai de `clamped` jusqu'au pending, cet écart sortait en chip « autres ».
   * Aucun test d'ÉCRAN ne le verrouillait — celui-ci le fait, sur la ligne réellement rendue.
   */
  it('AVANTAGE 6 : la cible écrêtée à 99 nomme son « plafond 99 » — jamais « autres »', () => {
    const v = renderAttack({ avantage: 6 });
    expect(chips(v)).toEqual(['+60 Avantage', '−6 plafond 99']);
    expect(calcul(v)).toBe('45 +54 = 99');
    expect(ligne(v).textContent).not.toContain('autres');
    expect(ANONYMES.count, 'la sonde DEV ne compte aucune chip anonyme').toBe(0);
  });
});
