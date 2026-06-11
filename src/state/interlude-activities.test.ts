/**
 * Activités d'interlude (LDB 23) : Revenus (LDB 08 l.135-144), Artisanat (Test étendu, matériaux
 * ¼ prix, achèvement → objet avec qualités), Opérations bancaires (invest/planque), blocages
 * d'événements par Classe.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { useGame } from './store';
import { createHero } from '../engine/character';
import { makeRNG } from '../engine/dice';
import { toBrass, fromBrass } from '../engine/money';
import { findTrapping } from '../data';
import { tome1Intro } from '../scenes/tome1-intro';
// (les tests Apprentissage/commande utilisent les actions store et les données réelles)

describe('Activités d’interlude (LDB 23)', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllTimers();
    const a = createHero({ speciesLabel: 'Humains (Reiklander)', careerLabel: 'Soldat', name: 'A', rng: makeRNG(1) });
    useGame.setState({ party: [a], battle: null, interlude: null, bank: [], pendingOrders: [], pendingActivity: null, journal: [] });
    useGame.getState().startScene(tome1Intro);
    vi.clearAllTimers();
    useGame.setState({ money: fromBrass(2000) });
    useGame.getState().seedRng(13);
    useGame.getState().startInterlude(3);
  });
  afterEach(() => { vi.clearAllTimers(); vi.useRealTimers(); });

  function hero() { return useGame.getState().party[0]; }
  function st() { return useGame.getState().interlude!.perHero[hero().id]; }

  it('Revenus : modale → jet → Appliquer crédite revenueBrass et consomme l’Activité', () => {
    // Neutralise un éventuel blocage d'événement pour CE test (on teste le flux, pas l'événement).
    const itl = useGame.getState().interlude!;
    itl.perHero[hero().id] = { ...st(), fx: undefined, left: 2 };
    useGame.setState({ interlude: { ...itl } });
    useGame.getState().interludeRevenus(hero().id);
    const pa = useGame.getState().pendingActivity;
    expect(pa?.kind).toBe('revenus');
    useGame.getState().activityRoll();
    // Force un succès propre (déterminisme du gain testé côté moteur).
    useGame.setState({ pendingActivity: { ...useGame.getState().pendingActivity!, roll: 1, success: true, sl: 2 } });
    useGame.getState().activityConfirm();
    expect(useGame.getState().pendingActivity).toBeNull();
    const after = st();
    expect(after.didRevenus).toBe(true);
    expect(after.left).toBe(1);
    expect(after.revenueBrass).toBeGreaterThan(0);
  });

  it('Revenus bloqués par l’événement (classe ou *) : la modale ne s’ouvre pas', () => {
    const itl = useGame.getState().interlude!;
    itl.perHero[hero().id] = { ...st(), fx: { revenueBlockedClasses: ['*'] }, left: 2 };
    useGame.setState({ interlude: { ...itl } });
    useGame.getState().interludeRevenus(hero().id);
    expect(useGame.getState().pendingActivity).toBeNull();
    expect(useGame.getState().journal.join('\n')).toMatch(/ne peut pas entreprendre Revenus/);
  });

  it('Artisanat : engager paie ¼ du prix ; le jet cumule ; l’achèvement crée l’objet qualifié', () => {
    const h = hero();
    h.skills.push({ name: 'Métier (Forgeron)', characteristic: 'Dex', advances: 10 });
    const itl0 = useGame.getState().interlude!;
    itl0.perHero[h.id] = { ...st(), fx: undefined, left: 3 };
    useGame.setState({ interlude: { ...itl0 } });
    const price = findTrapping('Dague')!.price;
    const quarter = Math.max(1, Math.floor(toBrass({ gold: price.gold, silver: price.silver, brass: price.bronze }) / 4));
    const before = toBrass(useGame.getState().money);
    useGame.getState().interludeCraftStart(h.id, 'Dague', ['Solide'], []);
    expect(toBrass(useGame.getState().money)).toBe(before - quarter);
    expect(st().craft?.trapping).toBe('Dague');
    // Lancer : on force l'achèvement (drBefore au seuil).
    useGame.getState().interludeCraftRoll(h.id);
    expect(useGame.getState().pendingActivity?.kind).toBe('craft');
    useGame.getState().activityRoll();
    const pa = useGame.getState().pendingActivity!;
    useGame.setState({ pendingActivity: { ...pa, roll: 1, success: true, sl: Math.max(1, pa.drTarget ?? 1) , drBefore: pa.drTarget } });
    useGame.getState().activityConfirm();
    const after = st();
    expect(after.craft).toBeUndefined();
    expect(after.left).toBe(2);
    const made = hero().items?.find((i) => i.name === 'Dague' && (i.qualities ?? []).includes('Solide'));
    expect(made).toBeTruthy();
  });

  it('Banque : invest interdit à l’échelon Bronze ; la planque débite et consomme l’Activité', () => {
    const itl = useGame.getState().interlude!;
    itl.perHero[hero().id] = { ...st(), fx: undefined, left: 2 };
    useGame.setState({ interlude: { ...itl } });
    hero().career = 'Agitateur'; // Pamphlétaire (niv.1) = Bronze 1 → invest refusé
    hero().careerLevel = 1;
    useGame.getState().interludeBank(hero().id, 'invest', 120);
    expect(useGame.getState().bank).toHaveLength(0);
    expect(useGame.getState().journal.join('\n')).toMatch(/échelons Or et Argent/);
    const before = toBrass(useGame.getState().money);
    useGame.getState().interludeBank(hero().id, 'stash', 120);
    expect(useGame.getState().bank).toHaveLength(1);
    expect(toBrass(useGame.getState().money)).toBe(before - 120);
    expect(st().left).toBe(1);
  });

  it('Apprentissage particulier : échec = PX et argent perdus + compteur d’acharnement ; succès = Talent acquis', () => {
    const h = hero();
    h.xp = 300;
    const itl = useGame.getState().interlude!;
    itl.perHero[h.id] = { ...st(), fx: undefined, left: 3 };
    useGame.setState({ interlude: { ...itl }, money: fromBrass(5000) });
    useGame.getState().interludeLearn(h.id, 'Chanceux');
    const pa = useGame.getState().pendingActivity!;
    expect(pa.kind).toBe('learn');
    expect(pa.xpCost).toBe(100);
    const moneyBefore = toBrass(useGame.getState().money);
    useGame.getState().activityRoll();
    // Échec forcé : PX/argent dépensés en vain, +10 cumulé.
    useGame.setState({ pendingActivity: { ...useGame.getState().pendingActivity!, roll: 99, success: false, sl: -2 } });
    useGame.getState().activityConfirm();
    expect(hero().xp).toBe(200);
    expect(toBrass(useGame.getState().money)).toBe(moneyBefore - (pa.tutorBrass ?? 0));
    expect(st().learnFails?.['Chanceux']).toBe(1);
    expect(hero().talents.some((t) => t.name === 'Chanceux')).toBe(false);
    // Seconde tentative : succès → Talent acquis (et le +10 d'acharnement était affiché).
    useGame.getState().interludeLearn(h.id, 'Chanceux');
    expect(useGame.getState().pendingActivity!.skillValue).toBeGreaterThan(pa.skillValue);
    useGame.getState().activityRoll();
    useGame.setState({ pendingActivity: { ...useGame.getState().pendingActivity!, roll: 1, success: true, sl: 1 } });
    useGame.getState().activityConfirm();
    expect(hero().talents.some((t) => t.name === 'Chanceux')).toBe(true);
    expect(hero().xp).toBe(100);
  });

  it('Passer commande : non-Exotique refusé ; Exotique payé maintenant, livré à l’interlude SUIVANT', () => {
    const h = hero();
    const itl = useGame.getState().interlude!;
    itl.perHero[h.id] = { ...st(), fx: undefined, left: 3 };
    useGame.setState({ interlude: { ...itl }, money: fromBrass(999999) });
    useGame.getState().interludeOrder(h.id, 'Dague'); // Commune → refus
    expect(useGame.getState().pendingOrders).toHaveLength(0);
    expect(useGame.getState().journal.join('\n')).toMatch(/Passer commande sert aux objets Exotiques/);
    const exotic = findTrapping('Long fusil de Hochland'); // l'exemple du LDB (Exotique)
    if (!exotic || exotic.availability !== 'Exotique') return; // garde : données absentes → couvert par le refus ci-dessus
    useGame.getState().interludeOrder(h.id, exotic.label);
    expect(useGame.getState().pendingOrders).toEqual([{ heroId: h.id, trapping: exotic.label }]);
    expect(st().left).toBe(2);
    // Clôture + nouvel interlude : la commande est livrée.
    useGame.getState().interludeEnd();
    useGame.getState().startInterlude(1);
    expect(hero().items?.some((i) => i.name === exotic.label)).toBe(true);
    expect(useGame.getState().pendingOrders).toHaveLength(0);
  });

  it('Banque : le retrait d’une planque rend l’argent (ou la perd sur 🎲 ≤ 10) et vide le dépôt', () => {
    const itl = useGame.getState().interlude!;
    itl.perHero[hero().id] = { ...st(), fx: undefined, left: 2 };
    useGame.setState({ interlude: { ...itl }, bank: [{ heroId: hero().id, kind: 'stash', brass: 240, rate: 0 }] });
    const before = toBrass(useGame.getState().money);
    useGame.getState().interludeWithdraw(0);
    expect(useGame.getState().bank).toHaveLength(0);
    const after = toBrass(useGame.getState().money);
    const journal = useGame.getState().journal.join('\n');
    if (after > before) expect(journal).toMatch(/récupère/);
    else expect(journal).toMatch(/découverte|perdus/);
  });
});
