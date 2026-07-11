import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { useGame } from './store';
import { makePregens } from '../data/pregens';
import { seedBattleRng } from './battleRng';
import { setRule, resetRule } from '../engine/policy';
import type { PortProfile } from '../engine/seaVoyage';
import type { Combatant, SkillInstance } from '../engine/types';

/**
 * VENTE au port (`portSellCargo`, dernier reliquat #275/#274) — la chaîne Ragot → acheteur →
 * Marchandage est désormais une CASCADE (`openRoll` par étape, enchaînée via `chainStep`,
 * `state/portFlow.ts`). Chaque test isole une branche via un `PortProfile`/parti CONTRÔLÉ (jamais un
 * `openPort` aléatoire) pour un déterminisme lisible.
 */
const get = useGame.getState.bind(useGame);
const set = useGame.setState.bind(useGame);

const tick = () => new Promise<void>((r) => setTimeout(r, 0));
async function drain(): Promise<void> {
  for (let i = 0; i < 30; i++) {
    const p = get().pendingCascade;
    if (p) {
      const cur = p.participants[p.cursor];
      if (cur && cur.target != null && !cur.result) get().cascadeRoll(cur.id);
      get().cascadeNext();
    }
    await tick();
  }
}

function setSkill(c: Combatant, skillId: string, advances: number): void {
  const ex = c.skills.find((s) => s.skillId === skillId);
  if (ex) ex.advances = advances;
  else c.skills.push({ skillId, advances } as SkillInstance);
}

const scene = { id: 'scene-P', nom: 'Port', dimensions: { w: 2, h: 2 }, layers: [{ z: 0, tiles: ['sol', 'sol', 'sol', 'sol'] }], entities: [], dialogues: [], triggers: [] } as never;

function setup(port: PortProfile, party: Combatant[], enc = 40): void {
  seedBattleRng(1);
  set({
    party, scene,
    battle: null,
    worldMap: { id: 'm', nom: 'x', places: [{ id: 'P', label: 'Port', pos: { x: 0, y: 0 }, scene: 'scene-P', port }], routes: [] },
    money: { gold: 0, silver: 0, brass: 0 },
    vessel: { vehicleId: 'cogue', morale: { score: 75, lastMoraleWeek: 0, factors: [] }, cargo: [{ cargoId: 'bois', enc, basePriceGold: 10 }], lastVoyageMilles: 0 },
    port: { placeId: 'P', label: 'Port', port, freeEnc: 0, maxLoadEnc: 0, offers: [] },
    journal: [],
    pendingCascade: null,
  } as never);
}

describe('portSellCargo — cascade Ragot → acheteur → Marchandage (#275/#274)', () => {
  // Bandes automatiques du d100 (LDB 12 l.46, 01-05 auto-succès / 96-00 auto-échec) OFF pour ces tests :
  // les cibles construites (0 ou ≥ 100) doivent trancher SEULES, sans les 10 % de rolls « forcés ».
  beforeEach(() => setRule('test-auto-bands', 'off'));
  afterEach(() => resetRule('test-auto-bands'));

  it('port producteur (Ragot requis), groupe VIDE → refus IMMÉDIAT (aucun candidat au Ragot), aucun jet', () => {
    setup({ taille: 4, richesse: 4, production: ['bois'] }, []);
    get().portSellCargo(0);
    expect(get().pendingCascade).toBeNull();
    expect(get().journal.some((l) => /ne trouve pas de camelot/.test(l))).toBe(true);
    expect(get().vessel!.cargo).toHaveLength(1); // rien vendu
  });

  it('port producteur, Ragot au plancher (skill 0) → le journal enchaîne exactement UN dénouement (succès ou échec du Ragot), jamais les deux', async () => {
    const hero = makePregens()[0];
    setSkill(hero, 'ragot', 0);
    setup({ taille: 4, richesse: 4, production: ['bois'] }, [hero]);
    get().portSellCargo(0);
    await drain();
    expect(get().pendingCascade).toBeNull();
    const j = get().journal.join('\n');
    const gossipOutcome = /Ragot.*échoue|acheteur potentiel est approché/.test(j);
    expect(gossipOutcome).toBe(true);
  });

  it('port SANS relation au bien (gossip nul), acheteur GARANTI (Taille énorme → cible ≥ 100), groupe VIDE (aucun marchandeur) → vente conclue au prix d’offre', async () => {
    // relation 'no-produce' (bois absent de production/surplus) : gossip=null, target=(taille+demande)×10.
    setup({ taille: 10, richesse: 4, production: [] }, []);
    const before = get().money.gold;
    get().portSellCargo(0);
    await drain();
    expect(get().pendingCascade).toBeNull();
    expect(get().vessel!.cargo).toHaveLength(0); // lot ENTIER vendu
    expect(get().money.gold).toBeGreaterThan(before);
    expect(get().journal.some((l) => /Aucun marchandeur — prix d’offre pris tel quel/.test(l))).toBe(true);
  });

  it('port SANS relation au bien, cible d’acheteur NULLE (Taille 0) → aucun marchand intéressé, cargaison intacte', async () => {
    setup({ taille: 0, richesse: 0, production: [] }, [], 40);
    seedBattleRng(2);
    get().portSellCargo(0);
    await drain();
    expect(get().pendingCascade).toBeNull();
    expect(get().vessel!.cargo).toHaveLength(1);
    expect(get().journal.some((l) => /aucun marchand intéressé/.test(l))).toBe(true);
  });

  it('cible d’acheteur AU PLANCHER (clamp policy `targetMin`) → 1ʳᵉ tentative ratée, la 2ᵉ (moitié du lot) trouve preneur', async () => {
    const hero = makePregens()[0];
    setup({ taille: 0, richesse: 0, production: [] }, [hero]); // seed 1 (défaut de `setup`)
    get().portSellCargo(0);
    await drain();
    expect(get().pendingCascade).toBeNull();
    expect(get().journal.some((l) => /la moitié \(20 Enc\) trouve preneur/.test(l))).toBe(true);
    expect(get().vessel!.cargo).toEqual([{ cargoId: 'bois', enc: 20, basePriceGold: 10 }]); // moitié vendue
  });

  it('port SANS relation au bien, marchandeur compétent (skill 90) → Marchandage joué, gain crédité et journalisé', async () => {
    const hero = makePregens()[0];
    setSkill(hero, 'marchandage', 90);
    setup({ taille: 10, richesse: 4, production: [] }, [hero]);
    const before = get().money.gold;
    get().portSellCargo(0);
    await drain();
    expect(get().pendingCascade).toBeNull();
    expect(get().vessel!.cargo).toHaveLength(0);
    expect(get().money.gold).toBeGreaterThan(before);
    expect(get().journal.some((l) => /Marchandage \(/.test(l))).toBe(true);
  });

  it('déterminisme seedé conservé : rejouer la MÊME graine + même parti produit le MÊME gain (byte-identique)', async () => {
    const hero = makePregens()[0];
    setSkill(hero, 'marchandage', 90);
    setup({ taille: 10, richesse: 4, production: [] }, [hero]);
    get().portSellCargo(0);
    await drain();
    const gainA = get().money.gold;

    const hero2 = makePregens()[0];
    setSkill(hero2, 'marchandage', 90);
    setup({ taille: 10, richesse: 4, production: [] }, [hero2]);
    get().portSellCargo(0);
    await drain();
    const gainB = get().money.gold;

    expect(gainB).toBe(gainA);
  });
});

/**
 * ACHAT au port (`portBuyCargo`, #266) — le Marchandage d'achat est SURFACÉ par la même cascade
 * `openRoll` (hero-test) que la vente, jamais résolu en silence. Chaque test contrôle l'offre + le parti.
 */
function setupBuy(party: Combatant[], offerEnc = 20, basePrice = 10): void {
  seedBattleRng(1);
  const port = { taille: 4, richesse: 4, production: [] as string[] } as PortProfile;
  set({
    party, scene,
    battle: null,
    worldMap: { id: 'm', nom: 'x', places: [{ id: 'P', label: 'Port', pos: { x: 0, y: 0 }, scene: 'scene-P', port }], routes: [] },
    money: { gold: 5000, silver: 0, brass: 0 },
    vessel: { vehicleId: 'cogue', morale: { score: 75, lastMoraleWeek: 0, factors: [] }, cargo: [], lastVoyageMilles: 0 },
    port: { placeId: 'P', label: 'Port', port, freeEnc: 300, maxLoadEnc: 450, offers: [{ cargoId: 'bois', label: 'Bois', enc: offerEnc, basePrice, surplus: false }] },
    journal: [],
    pendingCascade: null,
  } as never);
}

describe('portBuyCargo — Marchandage d’achat SURFACÉ par cascade openRoll (#266)', () => {
  beforeEach(() => setRule('test-auto-bands', 'off'));
  afterEach(() => resetRule('test-auto-bands'));

  it('groupe VIDE (aucun marchandeur) → achat conclu au PRIX PLEIN, aucun jet ouvert', () => {
    setupBuy([]);
    const before = get().money.gold;
    get().portBuyCargo('bois', 10);
    expect(get().pendingCascade).toBeNull(); // aucune modale — prix plein, pas de Test
    expect(get().vessel!.cargo).toEqual([{ cargoId: 'bois', enc: 10, basePriceGold: 10 }]);
    expect(get().money.gold).toBe(before - 100); // 10 Enc × 10 CO, pct 0
    expect(get().journal.some((l) => /Aucun marchandeur dans le groupe — prix plein/.test(l))).toBe(true);
  });

  it('marchandeur présent → le Marchandage OUVRE une cascade (jet SURFACÉ, jamais silencieux)', () => {
    const hero = makePregens()[0];
    setSkill(hero, 'marchandage', 90);
    setupBuy([hero]);
    get().portBuyCargo('bois', 10);
    // Le Marchandage doit se résoudre dans la modale AVANT tout embarquement : cale intacte, cascade ouverte.
    expect(get().pendingCascade).not.toBeNull();
    expect(get().vessel!.cargo).toHaveLength(0);
  });

  it('marchandeur compétent (skill 90) → Marchandage joué, cargaison embarquée, remise journalisée', async () => {
    const hero = makePregens()[0];
    setSkill(hero, 'marchandage', 90);
    setupBuy([hero]);
    const before = get().money.gold;
    get().portBuyCargo('bois', 10);
    await drain();
    expect(get().pendingCascade).toBeNull();
    expect(get().vessel!.cargo).toHaveLength(1);
    expect(get().money.gold).toBeLessThan(before);
    expect(get().journal.some((l) => /Marchandage \(/.test(l))).toBe(true);
  });

  it('déterminisme seedé : rejouer la MÊME graine + même parti produit le MÊME coût', async () => {
    const hero = makePregens()[0];
    setSkill(hero, 'marchandage', 90);
    setupBuy([hero]);
    get().portBuyCargo('bois', 10);
    await drain();
    const spentA = 5000 - get().money.gold;

    const hero2 = makePregens()[0];
    setSkill(hero2, 'marchandage', 90);
    setupBuy([hero2]);
    get().portBuyCargo('bois', 10);
    await drain();
    const spentB = 5000 - get().money.gold;

    expect(spentB).toBe(spentA);
  });
});
