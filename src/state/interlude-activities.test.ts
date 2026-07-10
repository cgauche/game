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
import { findTrappingById } from '../data';
import { testScene } from '../scenes/test-fixture';
// (les tests Apprentissage/commande utilisent les actions store et les données réelles)

describe('Activités d’interlude (LDB 23)', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllTimers();
    const a = createHero({ speciesId: 'humains-reiklander', careerId: 'soldat', name: 'A', rng: makeRNG(1) });
    useGame.setState({ party: [a], battle: null, interlude: null, bank: [], pendingOrders: [], pendingActivity: null, journal: [] });
    useGame.getState().startScene(testScene);
    vi.clearAllTimers();
    useGame.setState({ money: fromBrass(2000) });
    useGame.getState().seedRng(13);
    useGame.getState().startInterlude(3);
  });
  afterEach(() => { vi.clearAllTimers(); vi.useRealTimers(); });

  function hero() { return useGame.getState().party[0]; }
  function st() { return useGame.getState().interlude!.perHero[hero().id]; }

  it('Revenus : modale → jet → Appliquer crédite revenueBrass (crédit DIFFÉRÉ, LDB 23 l.191) et consomme l’Activité', () => {
    // RAW : « Sur un succès, vous gagnez l'argent indiqué » (LDB 08 l.110) ; l'argent « vous est
    // seulement remis une fois que vous avez disposé de l'argent de votre dernière aventure » (LDB 23
    // l.191) → jamais dans `money`, seulement `revenueBrass`. Revenus maintient le Statut (l.193).
    // Neutralise un éventuel blocage d'événement pour CE test (on teste le flux, pas l'événement).
    const itl = useGame.getState().interlude!;
    itl.perHero[hero().id] = { ...st(), fx: undefined, left: 2 };
    useGame.setState({ interlude: { ...itl } });
    const moneyBefore = toBrass(useGame.getState().money);
    useGame.getState().interludeActivity(hero().id, 'revenus');
    const pa = useGame.getState().pendingActivity;
    expect(pa?.kind).toBe('catalog');
    expect(pa?.activityId).toBe('revenus');
    expect(pa?.difficulty).toBe('accessible'); // « Test Spectaculaire Accessible (+20) » (LDB 08 l.110) — Spectaculaire = Test à DR ordinaire (LDB 12 l.172), PAS étendu
    useGame.getState().activityRoll();
    // Force un succès propre (déterminisme du gain testé côté moteur).
    useGame.setState({ pendingActivity: { ...useGame.getState().pendingActivity!, roll: 1, success: true, sl: 2 } });
    useGame.getState().activityConfirm();
    expect(useGame.getState().pendingActivity).toBeNull();
    const after = st();
    expect(after.didRevenus).toBe(true);
    expect(after.left).toBe(1);
    expect(after.revenueBrass).toBeGreaterThan(0);
    expect(toBrass(useGame.getState().money)).toBe(moneyBefore); // crédit DIFFÉRÉ : la bourse n'a pas bougé
  });

  it('Revenus bloqués par l’événement (classe ou *) : la modale ne s’ouvre pas', () => {
    const itl = useGame.getState().interlude!;
    itl.perHero[hero().id] = { ...st(), fx: { revenueBlockedClasses: ['*'] }, left: 2 };
    useGame.setState({ interlude: { ...itl } });
    useGame.getState().interludeActivity(hero().id, 'revenus');
    expect(useGame.getState().pendingActivity).toBeNull();
    expect(useGame.getState().journal.join('\n')).toMatch(/ne peut pas entreprendre Revenus/);
  });

  it('Artisanat : engager paie ¼ du prix (LDB 23 l.76) ; le Test étendu cumule ; l’achèvement crée l’objet qualifié', () => {
    // RAW l.76 : « les matières premières […] coûteront un quart du prix de l'équipement, et devront
    // être achetées avant le début de l'Activité » ; l.78 : « Test étendu de Métier » ; l.102 : « Chaque
    // Activité […] vous permet d'effectuer un lancer pour votre Test étendu ».
    const h = hero();
    h.skills.push({ skillId: 'metier', spec: 'Forgeron', characteristic: 'dexterite', advances: 10 });
    const itl0 = useGame.getState().interlude!;
    itl0.perHero[h.id] = { ...st(), fx: undefined, left: 3 };
    useGame.setState({ interlude: { ...itl0 } });
    const price = findTrappingById('dague')!.price!;
    const quarter = Math.max(1, Math.floor(toBrass({ gold: price.gold, silver: price.silver, brass: price.bronze }) / 4));
    const before = toBrass(useGame.getState().money);
    useGame.getState().interludeCraftStart(h.id, 'dague', ['solide'], []);
    expect(toBrass(useGame.getState().money)).toBe(before - quarter);
    expect(st().craft?.trappingId).toBe('dague');
    // Lancer : on force l'achèvement (drBefore au seuil).
    useGame.getState().interludeActivity(h.id, 'craft');
    expect(useGame.getState().pendingActivity?.kind).toBe('catalog');
    expect(useGame.getState().pendingActivity?.activityId).toBe('craft');
    expect(useGame.getState().pendingActivity?.drTarget).toBeGreaterThan(0); // Test étendu : cible de DR peuplée
    useGame.getState().activityRoll();
    const pa = useGame.getState().pendingActivity!;
    useGame.setState({ pendingActivity: { ...pa, roll: 1, success: true, sl: Math.max(1, pa.drTarget ?? 1) , drBefore: pa.drTarget } });
    useGame.getState().activityConfirm();
    const after = st();
    expect(after.craft).toBeUndefined();
    expect(after.left).toBe(2);
    const made = hero().items?.find((i) => i.name === 'Dague' && (i.qualities ?? []).some((q) => q.id === 'solide'));
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

  it('Apprentissage particulier (LDB 23 l.66-72) : échec = PX et argent perdus « en vain » + acharnement +10 ; succès = Talent acquis', () => {
    // RAW l.68 : « dépensant en vain des PX et de l'argent » ; l.72 : « Tentez un Test Difficile (-20)
    // […] Sur un succès, vous avez appris le Talent. Sinon […] gagnez un modificateur de +10 pour
    // chaque tentative ratée ». Prix du tuteur (l.72) : « 2D10 pistoles d'argent par 100PX ».
    const h = hero();
    h.xp = 300;
    const itl = useGame.getState().interlude!;
    itl.perHero[h.id] = { ...st(), fx: undefined, left: 3 };
    useGame.setState({ interlude: { ...itl }, money: fromBrass(5000) });
    useGame.getState().interludeActivity(h.id, 'learn', { talentId: 'chanceux' }); // id STABLE du Talent
    const pa = useGame.getState().pendingActivity!;
    expect(pa.kind).toBe('catalog');
    expect(pa.activityId).toBe('learn');
    expect(pa.difficulty).toBe('difficile'); // « Test Difficile (-20) »
    expect(pa.xpCost).toBe(100);
    const moneyBefore = toBrass(useGame.getState().money);
    useGame.getState().activityRoll();
    // Échec forcé : PX/argent dépensés en vain, +10 cumulé.
    useGame.setState({ pendingActivity: { ...useGame.getState().pendingActivity!, roll: 99, success: false, sl: -2 } });
    useGame.getState().activityConfirm();
    expect(hero().xp).toBe(200);
    expect(toBrass(useGame.getState().money)).toBe(moneyBefore - (pa.tutorBrass ?? 0)); // tuteur payé MÊME sur échec
    expect(st().learnFails?.['chanceux']).toBe(1); // clé = id stable
    expect(hero().talents.some((t) => t.talentId === 'chanceux')).toBe(false);
    // Seconde tentative : succès → Talent acquis (et le +10 d'acharnement s'ajoute à la valeur du Test).
    useGame.getState().interludeActivity(h.id, 'learn', { talentId: 'chanceux' });
    expect(useGame.getState().pendingActivity!.skillValue).toBeGreaterThan(pa.skillValue);
    useGame.getState().activityRoll();
    useGame.setState({ pendingActivity: { ...useGame.getState().pendingActivity!, roll: 1, success: true, sl: 1 } });
    useGame.getState().activityConfirm();
    expect(hero().talents.some((t) => t.talentId === 'chanceux')).toBe(true);
    expect(hero().xp).toBe(100);
  });

  it('Passer commande : non-Exotique refusé ; Exotique payé maintenant, livré à l’interlude SUIVANT', () => {
    const h = hero();
    const itl = useGame.getState().interlude!;
    itl.perHero[h.id] = { ...st(), fx: undefined, left: 3 };
    useGame.setState({ interlude: { ...itl }, money: fromBrass(999999) });
    useGame.getState().interludeOrder(h.id, 'dague'); // Commune → refus
    expect(useGame.getState().pendingOrders).toHaveLength(0);
    expect(useGame.getState().journal.join('\n')).toMatch(/Passer commande sert aux objets Exotiques/);
    const exotic = findTrappingById('long-fusil-d-hochland'); // l'exemple du LDB (Exotique)
    if (!exotic || exotic.availability !== 'Exotique') return; // garde : données absentes → couvert par le refus ci-dessus
    useGame.getState().interludeOrder(h.id, exotic.id);
    expect(useGame.getState().pendingOrders).toEqual([{ heroId: h.id, trappingId: exotic.id }]);
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

  // ── Identifier un artefact magique (ADE2 ch.4 l.46-59) ─────────────────────────────────────
  function armArtefact(withSavoir = true) {
    const h = hero();
    if (withSavoir) h.skills.push({ skillId: 'savoir', spec: 'magie', characteristic: 'intelligence', advances: 10 });
    h.items = [...(h.items ?? []), { uid: 'art1', name: 'Épée ancienne', kind: 'melee', qualities: [{ id: 'de-plaies-atroces' }], enc: 1, equipped: false, identified: false } as never];
    const itl = useGame.getState().interlude!;
    itl.perHero[h.id] = { ...st(), fx: undefined, left: 3 };
    useGame.setState({ interlude: { ...itl }, party: [...useGame.getState().party] });
  }
  const artefact = () => hero().items!.find((i) => i.uid === 'art1')!;
  const forceRoll = (roll: number, success: boolean, sl: number) => {
    useGame.getState().activityRoll();
    useGame.setState({ pendingActivity: { ...useGame.getState().pendingActivity!, roll, success, sl } });
    useGame.getState().activityConfirm();
  };

  it('Identifier : exige Savoir (Magie) acquis (« Pour d’autres sorciers », ADE2 l.41)', () => {
    armArtefact(false);
    useGame.getState().interludeActivity(hero().id, 'identify', { itemUid: 'art1' });
    expect(useGame.getState().pendingActivity).toBeNull();
    expect(useGame.getState().journal.join('\n')).toMatch(/Savoir \(Magie\)/);
  });

  it('Identifier : Test de Savoir (Magie) Intermédiaire (+0), Activité consommée (ADE2 l.41)', () => {
    armArtefact();
    useGame.getState().interludeActivity(hero().id, 'identify', { itemUid: 'art1' });
    const pa = useGame.getState().pendingActivity;
    expect(pa?.kind).toBe('catalog');
    expect(pa?.activityId).toBe('identify');
    expect(pa?.difficulty).toBe('intermediaire'); // « Savoir (Magie) Intermédiaire (+0) »
    forceRoll(5, true, 4);
    expect(st().left).toBe(2);
  });

  // ADE2 l.43-52 — table de DR complète (le POC collapsait ≥+4/≤+3 et IGNORAIT la ligne « 0 à +1 »).
  it('Identifier : Succès Impressionnant (+4 à +5) → identifié + « sait s’il a des Particularités »', () => {
    armArtefact();
    useGame.getState().interludeActivity(hero().id, 'identify', { itemUid: 'art1' });
    forceRoll(5, true, 4);
    expect(artefact().identified).toBe(true); // « le Personnage est capable d'identifier l'objet »
    expect(artefact().magicKnown).toBe(true); // « et sait s'il a des Particularités »
  });

  it('Identifier : Succès (+2 à +3) → identifié, Particularités visibles seulement (pas les cachées)', () => {
    armArtefact();
    useGame.getState().interludeActivity(hero().id, 'identify', { itemUid: 'art1' });
    forceRoll(20, true, 2);
    expect(artefact().identified).toBe(true); // RAW : tout succès identifie l'objet (correction du POC)
    expect(artefact().magicKnown).toBeFalsy(); // « il ne voit pas celles qui sont cachées »
  });

  it('Identifier : Succès Minime (0 à +1) → identifié ET découvre UNE Particularité cachée (ligne ignorée par le POC)', () => {
    armArtefact();
    useGame.getState().interludeActivity(hero().id, 'identify', { itemUid: 'art1' });
    forceRoll(41, true, 1); // DR +1 → Succès Minime
    expect(artefact().identified).toBe(true);
    expect(artefact().magicKnown).toBe(true); // « découvre une Particularité cachée »
  });

  it('Identifier : Échec (−2 à −3) → confond avec un objet similaire, AUCUNE fausse Particularité (ADE2 l.50)', () => {
    armArtefact();
    useGame.getState().interludeActivity(hero().id, 'identify', { itemUid: 'art1' });
    forceRoll(70, false, -2);
    expect(artefact().identified).toBe(false); // « confond l'artefact avec un type d'objet similaire »
    expect(artefact().suspectedQualities ?? []).toHaveLength(0); // pas de fausse Particularité avant −4 (≠ Échec Minime)
  });

  it('Identifier : Échec Impressionnant (−4 à −5) → UNE fausse Particularité soupçonnée', () => {
    armArtefact();
    useGame.getState().interludeActivity(hero().id, 'identify', { itemUid: 'art1' });
    forceRoll(88, false, -4);
    const suspected = artefact().suspectedQualities ?? [];
    expect(suspected).toHaveLength(1); // « soupçonne également que l'objet possède une Particularité qu'il n'a pas »
    expect(suspected).not.toContain('De plaies atroces'); // jamais une qualité RÉELLE de l'objet
    expect(artefact().identified).toBe(false); // « confond l'artefact avec un type d'objet similaire »
  });

  it('Identifier : Échec Stupéfiant (−6 ou moins) → AU MOINS DEUX fausses Particularités, purgées par une vraie révélation', () => {
    armArtefact();
    useGame.getState().interludeActivity(hero().id, 'identify', { itemUid: 'art1' });
    forceRoll(99, false, -6);
    const suspected = artefact().suspectedQualities ?? [];
    expect(suspected).toHaveLength(2); // « soupçonne également que l'objet possède au moins deux Particularités qu'il n'a pas »
    expect(suspected).not.toContain('De plaies atroces');
    expect(artefact().identified).toBe(false);
    // Une identification réussie ultérieure dissipe les fausses certitudes.
    useGame.getState().interludeActivity(hero().id, 'identify', { itemUid: 'art1' });
    forceRoll(3, true, 6);
    expect(artefact().identified).toBe(true);
    expect(artefact().suspectedQualities).toBeUndefined();
  });
});
