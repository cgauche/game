import { describe, it, expect, beforeEach } from 'vitest';
import { useGame } from './store';
import { makePregens } from '../data/pregens';
import { resolvePortArrival } from './seaVoyageFlow';
import { advanceCascade, setCascadeChoice } from './cascade';
import { seedBattleRng } from './battleRng';
import type { RNG } from '../engine/dice';

/**
 * EMBRIGADEMENT — recouvrement d'équipage (MDG 15 l.245, #164). La perte de 2d10 marins est persistée,
 * puis le groupe DÉCIDE de tenter (opt-in RAW « Vous pouvez ») ou renoncer ; s'il tente, une SÉQUENCE
 * de Tests influençables permet de les récupérer : Ragot Intermédiaire → rançon 2d10 CO OU Discrétion
 * Complexe ; un échec sur l'un des deux coûte 1d10 marins de plus. Les jets de la
 * cascade sont pilotés ici en INJECTANT le résultat de l'étape courante (le cycle Chance/Résilience de
 * `FLOWS.cascade` est testé ailleurs) — on vérifie les CONSÉQUENCES (recouvrement = delta NÉGATIF, +1d10).
 */
const get = useGame.getState.bind(useGame);
const set = useGame.setState.bind(useGame);

// Tous les d10 → 1 (quel que soit l'index) : événement de port min 1 (Embrigadement, avec Humeur −1),
// lostCrew 2d10 = 2, ransomCO 2d10 = 2, failExtraLostCrew 1d10 = 1.
const ones: RNG = { int: (min) => min };

function fresh() {
  seedBattleRng(1);
  useGame.setState({
    party: makePregens().slice(0, 3),
    scene: { id: 'port', nom: 'Port', dimensions: { w: 2, h: 2 }, layers: [{ z: 0, tiles: ['sol', 'sol', 'sol', 'sol'] }], entities: [], dialogues: [], triggers: [] } as never,
    battle: null,
    pendingCascade: null,
    money: { gold: 100, silver: 0, brass: 0 },
    // Humeur de Manann −1 : place le tirage 2d10=2 sur l'événement n°1 (Embrigadement).
    vessel: { vehicleId: 'cogue', morale: { score: 75, lastMoraleWeek: 0, factors: [] }, manann: { score: -1, applied: [] } },
    journal: [],
  } as never);
}

/** Injecte le résultat de l'étape-jet courante puis valide (comme le ferait la modale après un jet). */
function jet(success: boolean): void {
  const p = get().pendingCascade!;
  const i = p.cursor;
  const cur = p.participants[i];
  const result = { roll: success ? 5 : 95, target: cur.target!, sl: success ? 2 : -2, success };
  set({ pendingCascade: { ...p, participants: p.participants.map((x, k) => (k === i ? { ...x, result } : x)) } });
  advanceCascade(get, set);
}

/** Tranche l'étape « choix » courante puis valide. */
function choose(key: string): void {
  const p = get().pendingCascade!;
  setCascadeChoice(get, set, p.participants[p.cursor].id, key);
  advanceCascade(get, set);
}

describe('Embrigadement — recouvrement (MDG 15 l.245, #164)', () => {
  beforeEach(fresh);

  it('déclenche la perte de 2d10 marins ET ouvre la cascade sur la DÉCISION opt-in', () => {
    resolvePortArrival(get, set, undefined, ones);
    expect(get().vessel!.crewLost).toBe(2); // 2d10 = 2 marins enlevés (cogue, nominal 15)
    const p = get().pendingCascade!;
    expect(p.title).toBe('Embrigadement');
    expect(p.participants[0].kind).toBe('embrigadementDecision'); // tenter/renoncer AVANT tout Test
    expect(p.participants[0].options?.map((o) => o.key)).toEqual(['tenter', 'renoncer']);
  });

  it('RENONCER : aucun Test, aucune perte supplémentaire (RAW « Vous pouvez »)', () => {
    resolvePortArrival(get, set, undefined, ones);
    choose('renoncer');
    expect(get().pendingCascade).toBeNull(); // séquence close sans risque
    expect(get().vessel!.crewLost).toBe(2); // perte 2d10 encaissée, PAS de 1d10 de plus
  });

  it('Ragot réussi + PAIEMENT : rançon débitée (2d10 CO) et marins récupérés (delta NÉGATIF)', () => {
    resolvePortArrival(get, set, undefined, ones);
    choose('tenter'); // opt-in → étape Ragot
    jet(true); // Ragot réussi → étape « choix »
    choose('payer'); // rançon 2 CO
    expect(get().pendingCascade).toBeNull();
    expect(get().vessel!.crewLost).toBe(0); // les 2 marins reviennent (applyVesselCrewLoss négatif)
    expect(get().money.gold).toBe(98); // 100 − 2 CO
  });

  it('Ragot réussi + DISCRÉTION réussie : marins récupérés sans dépense', () => {
    resolvePortArrival(get, set, undefined, ones);
    choose('tenter');
    jet(true); // Ragot
    choose('discretion'); // → étape-jet Discrétion Complexe
    jet(true); // Discrétion réussie
    expect(get().pendingCascade).toBeNull();
    expect(get().vessel!.crewLost).toBe(0);
    expect(get().money.gold).toBe(100); // bourse intacte
  });

  it('Ragot RATÉ : l\'autre navire lève l\'ancre → 1d10 marins de plus perdus', () => {
    resolvePortArrival(get, set, undefined, ones);
    choose('tenter');
    jet(false); // Ragot raté
    expect(get().pendingCascade).toBeNull(); // séquence terminée
    expect(get().vessel!.crewLost).toBe(3); // 2 + 1d10 (=1)
  });

  it('Discrétion RATÉE : 1d10 marins de plus perdus (pas de récupération)', () => {
    resolvePortArrival(get, set, undefined, ones);
    choose('tenter');
    jet(true); // Ragot
    choose('discretion');
    jet(false); // Discrétion ratée
    expect(get().pendingCascade).toBeNull();
    expect(get().vessel!.crewLost).toBe(3); // 2 + 1
  });

  it('PAIEMENT bourse insuffisante : aucun débit, marins NON récupérés', () => {
    set({ money: { gold: 0, silver: 0, brass: 0 } });
    resolvePortArrival(get, set, undefined, ones);
    choose('tenter');
    jet(true);
    choose('payer');
    expect(get().pendingCascade).toBeNull();
    expect(get().money.gold).toBe(0);
    expect(get().vessel!.crewLost).toBe(2); // rançon impayable → captifs
  });

  it('perte plafonnée au nominal : aucun marin réellement enlevé → pas de cascade (rien à récupérer)', () => {
    set({ vessel: { ...get().vessel!, crewLost: 15 } }); // déjà tout l'équipage perdu (cogue nominal 15)
    resolvePortArrival(get, set, undefined, ones);
    expect(get().vessel!.crewLost).toBe(15);
    expect(get().pendingCascade).toBeNull(); // recover === 0 → openEmbrigadementRecovery s'arrête
  });

  it('TENTER sans personne à bord pour mener le Ragot (équipage = les PJ, MDG 14 l.39, tous morts) : cascade close SANS Test, journal explicite', () => {
    set({ party: get().party.map((h) => ({ ...h, dead: true })) });
    resolvePortArrival(get, set, undefined, ones);
    choose('tenter');
    expect(get().pendingCascade).toBeNull(); // aucun meneur → pas d'étape Ragot insérée
    expect(get().vessel!.crewLost).toBe(2); // perte de base inchangée, pas de récupération tentée
    expect(get().journal.some((l) => l.includes('Personne à bord ne peut mener l\'enquête'))).toBe(true);
  });
});
