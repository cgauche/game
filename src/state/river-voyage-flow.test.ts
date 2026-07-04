import { describe, it, expect, beforeEach } from 'vitest';
import { useGame } from './store';
import { buildRiverPlan, runRiverDays, hasBatelier } from './riverVoyageFlow';
import { seedBattleRng } from './battleRng';
import { createHero, skillCharacteristicById } from '../engine/character';
import { makeRNG } from '../engine/dice';
import { buildScene } from './mapSpec';
import type { Combatant, SkillInstance } from '../engine/types';
import type { MapRoute, WorldMap } from './worldMap';

/**
 * VOYAGE FLUVIAL (T2C ch.5) — la descente du Reik en barge JOUÉE jour par jour : Test de Navigation par
 * étape (Voile/Ramer), Agilité de rame, table des vents, chavirage, périls. Réutilise la machinerie de
 * voyage (halte de nuit `openRest`, entretien quotidien, coque persistée) sans la dupliquer.
 */
const get = useGame.getState.bind(useGame);
const set = useGame.setState.bind(useGame);

function skill(c: Combatant, skillId: string, advances: number, spec?: string): void {
  // find-or-update : la carrière batelier possède déjà Voile/Ramer — on RELÈVE l'avance de la Compétence
  // EXISTANTE (spec null/undefined équivalents) au lieu d'ajouter un doublon shadowé par `testValue`.
  const ex = c.skills.find((s) => s.skillId === skillId && (s.spec ?? null) === (spec ?? null));
  if (ex) ex.advances = Math.max(ex.advances, advances);
  else c.skills.push({ skillId, spec, characteristic: skillCharacteristicById(skillId), advances } as SkillInstance);
}

/** Un équipage de barge : Gunnar le batelier (Ramer/Voile), plus deux passagers sans compétence de marin. */
function crew(withSavoir = false): Combatant[] {
  const gunnar = createHero({ speciesId: 'humains-reiklander', careerId: 'batelier', name: 'Gunnar', motivation: 'x', rng: makeRNG(11), id: 'r-gunnar' });
  skill(gunnar, 'ramer', 50);
  skill(gunnar, 'voile', 45);
  skill(gunnar, 'metier', 40, 'Construction de bateaux');
  const otto = createHero({ speciesId: 'humains-reiklander', careerId: 'garde', name: 'Otto', motivation: 'x', rng: makeRNG(12), id: 'r-otto' });
  const lise = createHero({ speciesId: 'humains-reiklander', careerId: 'erudit', name: 'Lise', motivation: 'x', rng: makeRNG(13), id: 'r-lise' });
  const trio = [gunnar, otto, lise];
  // Équipage aguerri du Reik : tous connaissent les Voies fluviales → le pilote (quel qu'il soit) crédite
  // le +1 DR (l.13). Sinon le pilote résolu (meilleure valeur de Voile/Ramer) pourrait ne pas l'avoir.
  if (withSavoir) for (const h of trio) skill(h, 'savoir', 40, 'Voies fluviales');
  return trio;
}

const route = (km: number, extra: Partial<MapRoute> = {}): MapRoute => ({
  id: 'r-reik', a: 'A', b: 'B', km, modes: ['barge', 'pied'], river: true, inns: true, perilDie: 0, ...extra,
});

function riverMap(km: number, extra: Partial<MapRoute> = {}): WorldMap {
  return {
    id: 'm', nom: 'Le Reik',
    places: [
      { id: 'A', label: 'Grünburg', pos: { x: 0, y: 0 }, scene: 'quai-a' },
      { id: 'B', label: 'Altdorf', pos: { x: 90, y: 0 }, scene: 'quai-b' },
    ],
    routes: [route(km, extra)],
  };
}

const quai = (id: string, nom: string) => buildScene({ id, nom, description: '.', size: [8, 6], terrain: 'planches', heroStart: [2, 3] });

/** Charge le projet (2 quais + carte) et l'équipage, au quai de Grünburg. */
function launch(withSavoir = false, km = 45, extra: Partial<MapRoute> = {}): void {
  seedBattleRng(7);
  const g = get();
  g.setParty(crew(withSavoir));
  g.loadProject([quai('quai-a', 'Grünburg'), quai('quai-b', 'Altdorf')], 'quai-a', riverMap(km, extra));
  set({ money: { gold: 500, silver: 0, brass: 0 }, travelPlan: null, pendingRest: null, pendingCascade: null, travelRecap: null, journal: [] });
}

describe('buildRiverPlan — la descente exige un batelier et une embarcation', () => {
  beforeEach(() => launch());

  it('construit un plan fluvial (mode barge, coque, état de vent) avec un batelier', () => {
    const plan = buildRiverPlan(get, 'r-reik', 'A', 'B', get().worldMap!.routes[0])!;
    expect(plan.mode).toBe('barge');
    expect(plan.river).toBeTruthy();
    expect(plan.vehicle!.wounds.max).toBe(60); // coque de barge (vehicles.json : B60)
    expect(['calme', 'leger', 'modere', 'fort', 'tres-fort']).toContain(plan.river!.windForce);
  });

  it('sans batelier (aucune avance Voile/Ramer) → null → repli transport payant', () => {
    const noSailors = crew().map((h) => ({ ...h, skills: h.skills.filter((s) => s.skillId !== 'ramer' && s.skillId !== 'voile') }));
    expect(hasBatelier(noSailors)).toBe(false);
    set({ party: noSailors });
    expect(buildRiverPlan(get, 'r-reik', 'A', 'B', get().worldMap!.routes[0])).toBeNull();
  });
});

describe('une journée de descente — Navigation, Agilité, vent (l.11-33)', () => {
  beforeEach(() => launch());

  it('startTravel(barge) sur une route fluviale JOUE la journée (Navigation + Agilité + progression)', () => {
    get().startTravel('r-reik', 'barge');
    const j = get().journal.join('\n');
    expect(j).toContain('Vent du jour'); // table des vents (l.21)
    expect(j).toMatch(/Navigation \((Voile|Ramer)/); // Test de Navigation de l'étape (l.15)
    expect(j).toContain('Agilité de rame'); // Test d'Agilité de début de jour (l.17)
    expect(j).toContain('Progression du jour');
    // La journée s'achève sur une halte de nuit OU l'arrivée (45 km ≈ une journée de barge).
    expect(get().pendingRest || get().scene?.id === 'quai-b').toBeTruthy();
  });

  it('un pilote doté de Savoir (Voies fluviales) le voit crédité au Test de Navigation (+1 DR, l.13)', () => {
    launch(true);
    get().startTravel('r-reik', 'barge');
    expect(get().journal.join('\n')).toContain('Savoir Voies fluviales +1 DR');
  });
});

describe('chavirage — Très fort de côté (note 4, l.40)', () => {
  beforeEach(() => launch());

  it('déclenche la séquence « retirer la voile / chavirer »', () => {
    seedBattleRng(3);
    const plan = buildRiverPlan(get, 'r-reik', 'A', 'B', get().worldMap!.routes[0])!;
    set({ travelPlan: { ...plan, river: { ...plan.river!, windForce: 'tres-fort', windDir: 'cote' } }, journal: [] });
    runRiverDays(get, set);
    const j = get().journal.join('\n');
    expect(j).toContain('retirer la voile avant de chavirer'); // Navigation Accessible (+20), note 4
  });
});

describe('péril de rivière — débris flottants (l.123-125)', () => {
  beforeEach(() => launch(false, 45, { riverPerils: [{ perilId: 'debris', chancePct: 100 }] }));

  it('un péril garanti (chance 100 %) est joué : manœuvre d\'évitement (Navigation)', () => {
    seedBattleRng(5);
    get().startTravel('r-reik', 'barge');
    expect(get().journal.join('\n')).toContain('Débris flottants en aval');
  });
});

describe('exposition hydrique de la descente (T2C ch.14) — l\'Effet waterExposure EXERCÉ', () => {
  it('un tirage garanti (chance 100 %) ouvre la cascade de Test de Résistance (Exposition), source d\'eau créditée', () => {
    launch(false, 45, { riverExposure: { source: 'aval-grande-ville-8km', mode: 'ingestion', chancePct: 100 } });
    seedBattleRng(4);
    get().startTravel('r-reik', 'barge');
    // La cascade d'Exposition s'ouvre pendant la journée (une étape par héros vivant).
    const pc = get().pendingCascade;
    expect(pc?.purpose).toBe('test');
    expect(pc?.participants.every((s) => s.kind === 'waterExposure')).toBe(true);
    expect(pc?.participants.length).toBe(get().party.filter((h) => !h.dead).length);
  });

  it('un héros peut CONTRACTER la maladie sur échec du Test d\'Exposition (contraction directe, T2C ch.14)', () => {
    launch(false, 45, { riverExposure: { source: 'grande-ville-marais', mode: 'ingestion', chancePct: 100 } });
    // Groupe fragile face à l'eau souillée d'une grande ville (−30) : Résistance rabaissée pour garantir l'échec.
    set({ party: get().party.map((h) => ({ ...h, characteristics: { ...h.characteristics, E: 1 } })) });
    seedBattleRng(1);
    get().startTravel('r-reik', 'barge');
    // Déroule la cascade d'Exposition (chaque participant lance puis avance).
    let g = 0;
    while (get().pendingCascade && g++ < 40) {
      const p = get().pendingCascade!;
      const cur = p.participants[p.cursor];
      if (cur.target != null && !cur.result) get().cascadeRoll(cur.id);
      else get().cascadeNext();
    }
    // Au moins un héros a contracté une maladie transmise par l'eau (journal + instance de maladie).
    const anyDiseased = get().party.some((h) => (h.diseases ?? []).length > 0);
    expect(anyDiseased).toBe(true);
  });
});

describe('entretien du jour de voyage — la Faim se résout À LA HALTE, après le repas (LDB 18 l.417-422)', () => {
  // Le groupe SANS ration : sans correctif, l'entretien EAGER de fin de jour installe la Faim
  // AVANT que la halte ne serve le repas → héros affamé malgré l'auberge. Invariant : un jour de
  // voyage ne roule JAMAIS l'entretien en eager ; il se résout dans la cascade de nuit, après le repas.
  const stripRations = () => set({ party: get().party.map((h) => ({ ...h, items: (h.items ?? []).filter((i) => i.trappingId !== 'ration'), hunger: undefined })) });

  /** Déroule la cascade de nuit ouverte par `restSleep` (roule chaque étape puis avance). */
  const drainCascade = () => {
    let g = 0;
    while (get().pendingCascade && g++ < 80) {
      const p = get().pendingCascade!;
      const cur = p.participants[p.cursor];
      if (cur.target != null && !cur.result) get().cascadeRoll(cur.id);
      get().cascadeNext();
    }
  };

  it('AUCUN Test de Faim n\'est roulé EAGER pendant le jour de descente (avant la halte)', () => {
    launch(false, 45); // 45 km ≈ une journée → halte de nuit
    stripRations();
    seedBattleRng(7);
    get().startTravel('r-reik', 'barge');
    // La journée s'achève sur une halte de nuit (pas d'arrivée à 45 km).
    expect(get().pendingRest).toBeTruthy();
    // Rien de faim n'a été résolu pendant le jour : ni jet dans le journal, ni État de faim installé.
    expect(get().journal.join('\n')).not.toMatch(/Faim : Test de Résistance/);
    for (const h of get().party) expect(h.hunger?.days ?? 0).toBe(0);
  });

  it('le repas d\'auberge à la halte couvre la journée → PERSONNE n\'est affamé au réveil', () => {
    launch(false, 45);
    stripRations();
    seedBattleRng(7);
    get().startTravel('r-reik', 'barge');
    expect(get().pendingRest).toBeTruthy();
    // Repas d'auberge pour tous (défaut de la halte sur une route à relais) — puis la nuit.
    for (const h of get().party) get().restSet(h.id, { food: 'repas' });
    get().restSleep();
    drainCascade();
    // Au réveil, la Faim ne s'est jamais installée : le repas de la halte a couvert le jour.
    for (const h of get().party) {
      expect(h.hunger?.days ?? 0).toBe(0);
      expect(h.hunger?.failures ?? 0).toBe(0);
    }
  });

  it('SANS repas ni ration (belle étoile, ventre vide), la Faim suit son cours — étape de cascade, pas de régression', () => {
    launch(false, 45);
    stripRations();
    seedBattleRng(7);
    get().startTravel('r-reik', 'barge');
    expect(get().pendingRest).toBeTruthy();
    // Personne ne mange à la halte (dehors + ventre vide).
    for (const h of get().party) get().restSet(h.id, { lodging: 'dehors', food: 'rien' });
    // La Faim tombe le 2ᵉ jour sans manger (l.422) : un seul jour ici → l'État s'installe (days=1) sans Test encore dû.
    get().restSleep();
    drainCascade();
    for (const h of get().party) expect(h.hunger?.days ?? 0).toBe(1);
  });
});

describe('descente end-to-end — le Reik jusqu\'à Altdorf', () => {
  beforeEach(() => launch(false, 120, { riverPerils: [{ perilId: 'debris', chancePct: 40 }] }));

  it('la barge descend jusqu\'à destination (haltes de nuit traversées), le voyage retombe à null', () => {
    seedBattleRng(9);
    get().startTravel('r-reik', 'barge');
    for (let i = 0; i < 80; i++) {
      if (!get().travelPlan && get().scene?.id === 'quai-b') break;
      if (get().pendingRest) {
        get().restSleep();
        let g = 0;
        while (get().pendingCascade && g++ < 80) {
          const p = get().pendingCascade!;
          const cur = p.participants[p.cursor];
          if (cur.target != null && !cur.result) get().cascadeRoll(cur.id);
          get().cascadeNext();
        }
        continue;
      }
      if (!get().travelPlan) break;
    }
    expect(get().travelPlan).toBeNull();
    expect(get().scene?.id).toBe('quai-b'); // arrivée à Altdorf
    expect(get().gameTime).toBeGreaterThanOrEqual(24 * 60); // au moins une journée a passé
  });
});
