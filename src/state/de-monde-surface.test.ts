import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { useGame } from './store';
import { resolveSurface, type RollRequest } from './rollSeam';
import { runCascadeImmediate, lireDeEtape, tableStepDefs, naturalRollForTableRow, rollTableStep } from './cascade';
import { weather } from '../data';
import { weatherFromRoll, type Season } from '../engine/travelStages';
import { buildAuthorPerilSteps } from './authorPerils';
import { DE_NON_NOMME } from './etalLot';
import type { MapRoute } from './worldMap';
import { WORLD_STEP_OWNER, seatOwns } from './netOwnership';
import { setDesFixes, resetDesFixes } from '../engine/fixedDie';
import { setCadence, resetCadence } from '../engine/cadence';
import { seedBattleRng } from './battleRng';
import { landSellCargo, openLandMarket } from './landMarketFlow';
import { persistCarriersCargo } from './carriers';
import { createHero, skillCharacteristicById } from '../engine/character';
import { makeRNG } from '../engine/dice';
import { buildScene } from './mapSpec';
import type { Combatant, SkillInstance } from '../engine/types';
import type { WorldMap } from './worldMap';
import type { LandMarketProfile } from '../engine/landCargo';
import type { CargoLot } from '../engine/cargo';
import type { Possession } from '../engine/possession';

/**
 * LE DÉ DE MONDE SOUS CONTRÔLE DU SIÈGE ENVIRONNEMENT (#1426).
 *
 * Le socle portait deux prédicats qui se CONTREDISAIENT : `netOwnership` donne le monde au siège 0 en
 * solo (`seatOwns(…, WORLD_STEP_OWNER)`, verrouillé par `fixed-die.test.ts`), mais `resolveSurface`
 * rendait `I` (silence de fond) à tout côté `worldSide` dès qu'aucun siège MJ n'existait — un siège
 * qui POSSÈDE un jet et ne le voit JAMAIS. Les `openWorldTest` de l'arbre (recherche d'acheteur,
 * désertion) étaient donc muets en solo, option « Dés fixés » comprise.
 *
 * Ce que ces cas verrouillent, dans l'ordre où ils peuvent casser :
 *  1. le CONTRÔLE POSITIF — option OFF, RIEN ne change (la surface d'origine, à l'identique) ;
 *  2. le fix — option ON + le siège local possède le monde → la fenêtre s'ouvre ;
 *  3. la DOMINATION de la cadence auto, qui ne se renverse pas ;
 *  4. la coop — la fenêtre suit le siège MJ, jamais « l'hôte par défaut » ;
 *  5. la PARITÉ terre/mer du commerce (`landSellCargo`), migré vers la porte dans ce lot.
 */

const get = useGame.getState.bind(useGame);
const set = useGame.setState.bind(useGame);

/** Une requête de jet de MONDE minimale — la forme exacte que monte `openWorldTest`. */
const requeteMonde = (): RollRequest => ({
  side: { worldSide: 'world' },
  actionLabel: 'Trouver un acheteur',
  test: {},
  difficulty: 'intermediaire',
  klass: 'subi',
});

describe('#1426 socle — un siège qui POSSÈDE le monde VOIT son dé (resolveSurface, côté worldSide)', () => {
  beforeEach(() => {
    resetDesFixes();
    resetCadence();
    set({ net: { ...get().net, mode: 'local', mySeat: 0, gmSeat: undefined } });
  });
  afterEach(() => { resetDesFixes(); resetCadence(); });

  it('CONTRÔLE POSITIF — option « Dés fixés » OFF : la surface d’origine, inchangée (I en solo)', () => {
    expect(seatOwns(get(), 0, WORLD_STEP_OWNER), 'précondition : le siège 0 possède le monde en solo').toBe(true);
    expect(resolveSurface(get, requeteMonde(), 'x')).toBe('I');
  });

  it('option ON + le siège local possède le monde → M : la fenêtre de pose existe', () => {
    setDesFixes(true);
    expect(resolveSurface(get, requeteMonde(), 'x')).toBe('M');
  });

  it('la cadence AUTO domine toujours : auto + option ON reste I (le précédent ne se renverse pas)', () => {
    setDesFixes(true);
    setCadence('rapide');
    expect(resolveSurface(get, requeteMonde(), 'x')).toBe('I');
  });

  it('coop AVEC siège MJ : V (le MJ voit/lance), et la possession du monde SUIT ce siège', () => {
    set({ net: { ...get().net, mode: 'host', mySeat: 0, gmSeat: 1 } });
    expect(resolveSurface(get, requeteMonde(), 'x')).toBe('V');
    expect(seatOwns(get(), 1, WORLD_STEP_OWNER), 'la fenêtre appartient au siège MJ').toBe(true);
    expect(seatOwns(get(), 0, WORLD_STEP_OWNER), 'et plus à l’hôte').toBe(false);
    setDesFixes(true);
    expect(resolveSurface(get, requeteMonde(), 'x'), 'l’option ne déplace pas une fenêtre déjà due au MJ').toBe('V');
  });
});

// ── PARITÉ TERRE/MER du commerce : `landSellCargo` migré vers `openWorldTest` ────────────────────

function skill(c: Combatant, skillId: string, advances: number): void {
  const ex = c.skills.find((s) => s.skillId === skillId && s.spec == null);
  if (ex) ex.advances = Math.max(ex.advances, advances);
  else c.skills.push({ skillId, characteristic: skillCharacteristicById(skillId), advances } as SkillInstance);
}

const CARRIER_ID = 'convoi-1';
const profile = (extra: Partial<LandMarketProfile> = {}): LandMarketProfile => ({ taille: 4, richesse: 4, produits: ['commerce', 'vin'], ...extra });
const lot: CargoLot = { cargoId: 'vin', enc: 40, basePriceGold: 10 };
const marche = (id: string, nom: string) => buildScene({ id, nom, description: '.', size: [8, 6], terrain: 'planches', heroStart: [2, 3] });

function carte(): WorldMap {
  return {
    id: 'm', nom: 'Le Reik',
    places: [{ id: 'B', label: 'Altdorf', pos: { x: 0, y: 0 }, scene: 'marche-b', market: profile() }],
    routes: [],
  };
}

/** Marché ouvert à Altdorf, un lot de 40 Enc sur le convoi, option « Dés fixés » ACTIVE (le dé se pose). */
function marcheAvecLot(): void {
  seedBattleRng(7);
  const h = createHero({ speciesId: 'humains-reiklander', careerId: 'marchand', label: 'Artur', motivation: 'x', rng: makeRNG(11), id: 't-artur' });
  skill(h, 'marchandage', 60);
  get().setParty([h]);
  get().loadProject([marche('marche-b', 'Altdorf')], 'marche-b', carte());
  const convoi: Possession = { uid: CARRIER_ID, ownerId: h.id, nature: 'vehicule', vehicleId: 'diligence', location: { kind: 'avec-le-groupe' }, items: [] };
  set({
    landMarket: { placeId: 'B', label: 'Altdorf', market: profile(), offers: [] },
    tradeRumours: [], journal: [], pendingCascade: null, possessions: [convoi],
  });
  set(persistCarriersCargo(get(), [{ carrierId: CARRIER_ID, cargo: [{ ...lot }] }]));
}

/** Pose le dé de l'étape COURANTE puis valide — le geste exact qu'offre la fenêtre au siège du monde. */
function poser(roll: number): void {
  const p = get().pendingCascade!;
  const cur = p.participants[p.cursor];
  // Le geste de la rangée : LANCER puis SUBSTITUER (couple atomique, `withPreRollFixedDie`), enfin
  // valider — c'est la séquence exacte que produit le champ de dé fixé (`ui/forcedDieRow.ts`).
  get().cascadeRoll(cur.id);
  get().cascadeSetForcedRoll(cur.id, roll);
  get().cascadeNext();
  vi.runAllTimers();
}

/**
 * FLUX RNG, OPTION OFF — l'invariant que la migration ne doit PAS payer : la cadence est portée par
 * l'OPTION, pas par le call-site. Sans fenêtre, la vente consomme la MÊME séquence de dés qu'avant
 * (acheteur → marchand → Marchandage opposé), donc rend le MÊME gain sous la MÊME graine. Aucun test
 * du dépôt ne verrouillait cet ordre pour le marché TERRESTRE : `land-market-flow.test.ts` compare des
 * gains ENTRE EUX (rumeur ×2), ce qu'un décalage de flux laisse passer intact.
 */
describe('#1426 — option OFF : le flux RNG de la vente terrestre est celui d’avant la porte', () => {
  beforeEach(() => { resetDesFixes(); resetCadence(); set({ net: { ...get().net, mode: 'local', mySeat: 0, gmSeat: undefined } }); });
  afterEach(() => { resetDesFixes(); resetCadence(); });

  it('sous graine FIXE, la vente est SYNCHRONE et rend un gain EXACT (un dé de plus/de moins le change)', () => {
    marcheAvecLot();
    resetDesFixes(); // `marcheAvecLot` ne pose rien : c'est le `beforeEach` qui décide de l'option
    seedBattleRng(3);
    landSellCargo(get, set, CARRIER_ID, 0);
    expect(get().pendingCascade, 'option OFF : aucune fenêtre, la vente se dénoue d’un trait').toBeNull();
    const vente = get().journal.find((l) => l.includes('vendus'));
    expect(vente, 'la vente a bien eu lieu').toBeTruthy();
    // Valeur MESURÉE sur la graine 3 : elle ne vaut que par sa STABILITÉ — inverser deux tirages
    // (marchand avant acheteur, ou un dé consommé en trop) la déplace.
    // Graine 3 : le 1ᵉʳ dé d'acheteur RATE, le 2ᵉ passe sur la moitié du lot — donc la BRANCHE de
    // reprise est jouée, puis le marchand et le Marchandage tirent DERRIÈRE, dans cet ordre.
    expect(get().journal.some((l) => l.includes('la moitié (20 Enc) trouve preneur'))).toBe(true);
    expect(vente).toBe('20 Enc de Vin/Eau-de-vie vendus (mise à prix 105 % du base — Artur — Marchandage (77 vs 49) : +10 %.) : 231 CO.');
  });
});

describe('#1426 — « Trouver un acheteur » terrestre passe par la porte (MSRC 13 l.146, parité portFlow)', () => {
  beforeEach(() => { vi.useFakeTimers(); vi.clearAllTimers(); resetDesFixes(); resetCadence(); setDesFixes(true); set({ net: { ...get().net, mode: 'local', mySeat: 0, gmSeat: undefined } }); });
  afterEach(() => { vi.clearAllTimers(); vi.useRealTimers(); resetDesFixes(); resetCadence(); });

  it('le dé d’acheteur OUVRE une étape de MONDE (plus aucune résolution muette au journal)', () => {
    marcheAvecLot();
    landSellCargo(get, set, CARRIER_ID, 0);
    const p = get().pendingCascade;
    expect(p, 'la vente ouvre une fenêtre au lieu de trancher en silence').toBeTruthy();
    const step = p!.participants[p!.cursor];
    expect(step.kind).toBe('land-sell-buyer');
    expect(step.worldOwner, 'étape de MONDE : aucun acteur ne la porte, le sentinel la route au siège').toBe(true);
    expect(step.actorId).toBeUndefined();
    // La cible EST la Demande du Lieu (Taille 4 × 10 + 30 Commerce) — posée par le call-site en
    // `meta.baseValue`, jamais recalculée par la porte.
    expect(step.target).toBe(70);
  });

  it('1ʳᵉ tentative RÉUSSIE : la vente se conclut, SANS le message de moitié', () => {
    marcheAvecLot();
    landSellCargo(get, set, CARRIER_ID, 0);
    poser(1); // ≤ 70 → acheteur trouvé
    const j = get().journal.join('\n');
    expect(j).not.toContain('la moitié');
    expect(j).toContain('40 Enc de Vin/Eau-de-vie vendus'); // le lot ENTIER part
  });

  it('1ʳᵉ ratée → 2ᵉ tentative sur la MOITIÉ du lot, à la MÊME Demande (l.146 verbatim)', () => {
    marcheAvecLot();
    landSellCargo(get, set, CARRIER_ID, 0);
    poser(99); // > 70 → pas d'acheteur pour tout le lot
    const p = get().pendingCascade;
    expect(p, 'la 2ᵉ tentative est une SECONDE étape posable').toBeTruthy();
    const step = p!.participants[p!.cursor];
    expect(step.kind).toBe('land-sell-buyer');
    expect(step.target, '« lancez à nouveau le dé en l’opposant au nombre précédemment obtenu »').toBe(70);
    expect(step.meta?.sellEnc, 'la MOITIÉ du lot, pas la moitié de la Demande').toBe(20);
  });

  it('2ᵉ tentative RÉUSSIE : le message « la moitié trouve preneur » précède la ligne de vente', () => {
    marcheAvecLot();
    landSellCargo(get, set, CARRIER_ID, 0);
    poser(99);
    poser(1);
    const j = get().journal;
    const demi = j.findIndex((l) => l.includes('la moitié (20 Enc) trouve preneur'));
    const vente = j.findIndex((l) => l.includes('20 Enc de Vin/Eau-de-vie vendus'));
    expect(demi, 'le message de moitié est journalisé').toBeGreaterThanOrEqual(0);
    expect(vente).toBeGreaterThan(demi); // ordre de la résolution synchrone d'origine, préservé
  });

  it('les DEUX tentatives ratées : aucun acheteur, et la ligne NOMME la Demande visée', () => {
    marcheAvecLot();
    landSellCargo(get, set, CARRIER_ID, 0);
    poser(99);
    poser(99);
    expect(get().journal.join('\n')).toContain('aucun acheteur intéressé à Altdorf (Demande 70)');
    expect(get().pendingCascade).toBeNull();
  });
});

// ── Q1 : LE VERBE `stopSequence` ────────────────────────────────────────────────────────────────

/**
 * `stopSequence` — le verbe SYMÉTRIQUE d'`insert` que le contrat d'applier n'avait pas. Une boucle
 * `for (peril) { … break }` savait s'arrêter ; une SÉQUENCE d'étapes ne le savait pas, et c'est
 * précisément ce qui manquait pour transformer les périls d'auteur en dés posables sans changer le
 * flux RNG : sans troncature, les périls suivants rejoueraient leurs dés après le combat.
 */
describe('#1426 Q1 — `stopSequence` TRONQUE la séquence au goulot partagé (parité du `break`)', () => {
  beforeEach(() => {
    resetDesFixes(); resetCadence();
    set({ net: { ...get().net, mode: 'local', mySeat: 0, gmSeat: undefined }, suspendedCascades: [], pendingCascade: null, journal: [] });
  });
  afterEach(() => { resetDesFixes(); resetCadence(); });

  /** Route à 3 périls d'auteur À 100 % ; le rang `interrompt` porte un `startCombat`. */
  const routeAvecPerils = (interrompt: number): MapRoute => ({
    id: 'r1', a: 'A', b: 'B', km: 10, modes: ['pied'],
    perils: [0, 1, 2].map((i) => ({
      label: `P${i}`, chancePct: 100,
      effects: i === interrompt ? [{ type: 'startCombat' as const, encounter: 'enc-x' }] : [{ type: 'journal' as const, text: `note ${i}` }],
    })),
  } as MapRoute);

  function planSur(route: MapRoute): void {
    set({
      worldMap: { id: 'm', nom: 'm', places: [], routes: [route] } as unknown as WorldMap,
      travelPlan: { routeId: 'r1', fromPlaceId: 'A', toPlaceId: 'B', mode: 'pied', hoursPerDay: 8, km: 10, kmDone: 0, interrupted: false } as never,
    });
  }

  it('le 1ᵉʳ péril qui INTERROMPT tronque : les suivants ne sont NI résolus NI préservés', () => {
    const route = routeAvecPerils(0);
    planSur(route);
    seedBattleRng(5);
    const steps = runCascadeImmediate(get, set, [...buildAuthorPerilSteps(route, 'B', 'voyage-mer')]);
    // UN seul dé tombé : la séquence est tronquée à l'étape courante (3 étapes construites, 1 gardée).
    expect(steps).toHaveLength(1);
    expect(steps[0].result?.roll).toBeGreaterThan(0);
    expect(get().travelPlan!.interrupted).toBe(true);
    // Et RIEN n'est mis de côté pour plus tard : un reste préservé rejouerait ses dés au retour.
    expect(get().suspendedCascades).toEqual([]);
    const j = get().journal.join('\n');
    expect(j).toContain('Péripétie : P0');
    expect(j).not.toContain('P1');
    expect(j).not.toContain('P2');
  });

  it('sans interruption, les TROIS périls se jouent : la troncature ne s’applique pas d’elle-même', () => {
    const route = routeAvecPerils(-1);
    planSur(route);
    seedBattleRng(5);
    const steps = runCascadeImmediate(get, set, [...buildAuthorPerilSteps(route, 'B', 'voyage-mer')]);
    expect(steps).toHaveLength(3);
    expect(get().travelPlan!.interrupted).toBe(false);
  });

  it('l’ORDRE d’authoring EST le flux RNG : permuter les périls change qui reçoit quel dé', () => {
    const des = (perils: MapRoute['perils']) => {
      const route = { ...routeAvecPerils(-1), perils } as MapRoute;
      planSur(route);
      set({ journal: [] });
      seedBattleRng(5);
      return runCascadeImmediate(get, set, [...buildAuthorPerilSteps(route, 'B', 'voyage-mer')])
        .map((s2) => ({ qui: String(s2.label), de: s2.result!.roll }));
    };
    const base = routeAvecPerils(-1).perils!;
    const direct = des(base);
    const permute = des([base[2], base[1], base[0]]);
    expect(direct).not.toEqual(permute);
    // Le FLUX de dés ne bouge pas (même graine, même nombre de tirages) — seuls leurs PORTEURS changent.
    expect(direct.map((x) => x.de)).toEqual(permute.map((x) => x.de));
    expect(direct.map((x) => x.qui)).toEqual([...permute.map((x) => x.qui)].reverse());
  });

  it('JOURNAL — un péril ÉVITÉ laisse SA ligne : 3 périls ratés = 3 lignes, aucune muselée', () => {
    const brut = routeAvecPerils(-1);
    const route = { ...brut, perils: brut.perils!.map((p2) => ({ ...p2, chancePct: 0 })) } as MapRoute;
    planSur(route);
    set({ journal: [] });
    seedBattleRng(5);
    runCascadeImmediate(get, set, [...buildAuthorPerilSteps(route, 'B', 'voyage-mer')]);
    const evites = get().journal.filter((l) => l.includes('Péripétie évitée'));
    expect(evites).toHaveLength(3);
    expect(get().journal.some((l) => l.includes('Péripétie : '))).toBe(false);
  });
});

// ── Q2 : ÉVALUATION « SEUIL PUR » ───────────────────────────────────────────────────────────────

/**
 * Un pourcentage RAW n'est pas un Test. Le RAW écrit « Lancez un d100 : si le résultat est inférieur
 * ou égal au chiffre final, un acheteur est trouvé » (MSRC 13 l.146) et « Lancez 1d100 et si le
 * résultat est inférieur ou égal au nombre visé » (MDG 15 l.362) — quand il veut un Test, il écrit
 * « Test de Ragot Complexe (–10) » trois lignes plus haut, sur la même page.
 *
 * Lu comme un Test, ce dé recevait deux règles que le RAW ne lui donne pas : les bandes automatiques
 * (LDB 12 l.28 — 01-05 réussit, 96-00 échoue quoi qu'il arrive) et l'écrêtage de la cible à 99.
 */
describe('#1426 Q2 — le pourcentage d’auteur se lit « dé ≤ nombre visé », et rien d’autre', () => {
  const faces = [...Array(100)].map((_, i) => i + 1);

  it('nombre visé 100 = 100 % : les 100 faces passent (en Test, 5 échoueraient d’office)', () => {
    expect(faces.filter((r) => lireDeEtape(r, 100, 'seuil').success)).toHaveLength(100);
    expect(faces.filter((r) => lireDeEtape(r, 100).success)).toHaveLength(95);
  });

  it('les bandes automatiques inventent des issues que le seuil ignore (nombre visé bas)', () => {
    const divergentes = faces.filter((r) => lireDeEtape(r, 2, 'seuil').success !== lireDeEtape(r, 2).success);
    expect(divergentes).toEqual([3, 4, 5]); // 01-05 réussit d'office EN TEST, pas sous 2 en seuil
  });

  it('AUCUN Degré de Réussite : un pourcentage n’en a pas (le Test, si)', () => {
    expect(lireDeEtape(11, 70, 'seuil').sl).toBe(0);
    expect(lireDeEtape(11, 70).sl).toBe(6);
  });

  it('la recherche d’acheteur ne parle JAMAIS de DR au journal', () => {
    marcheAvecLot();
    resetDesFixes();
    seedBattleRng(3);
    landSellCargo(get, set, CARRIER_ID, 0);
    const lignes = get().journal.filter((l) => l.includes('Trouver un acheteur'));
    expect(lignes.length, 'le dé d’acheteur laisse sa ligne au journal').toBeGreaterThan(0);
    for (const l of lignes) expect(l).not.toMatch(/\bDR\b/);
  });
});

// ── LES TABLES DE MONDE : la pose fonctionne sur chacune ─────────────────────────────────────────

/**
 * Une table de monde n'est utile que si le joueur peut y POSER un dé — et poser un dé n'a de sens que
 * si CHAQUE ligne de la table est atteignable. `naturalRollForTableRow` rend le dé NATUREL à saisir
 * pour viser une ligne, `mod` compris ; `null` = ligne hors d'atteinte.
 *
 * Le piège que ces cas ferment : la Météo a une table PAR SAISON. Si la saison avait été implémentée
 * comme un MODIFICATEUR sur une table unique, le décalage aurait rendu des lignes faussement
 * inatteignables (un `mod` de +30 tue les 30 premiers naturels). Ici la saison choisit la TABLE, donc
 * `mod` vaut 0 et les quatre saisons offrent toutes leurs lignes.
 */
describe('#1426 — la POSE fonctionne sur les tables de monde migrées', () => {
  it('Météo : les 4 saisons couvrent 1..100 sans trou ni chevauchement (table DÉRIVÉE de la donnée)', () => {
    for (const saison of weather) {
      const def = tableStepDefs[`stage-weather-${saison.id}`];
      expect(def, `table de saison « ${saison.id} » enregistrée`).toBeTruthy();
      expect(def.rows[0].min).toBe(1);
      expect(def.rows[def.rows.length - 1].max).toBe(100);
      for (let i = 1; i < def.rows.length; i++) expect(def.rows[i].min).toBe(def.rows[i - 1].max + 1);
    }
  });

  it('Météo : CHAQUE ligne de CHAQUE saison est atteignable à la pose (aucun mod saisonnier)', () => {
    const inatteignables: string[] = [];
    for (const saison of weather) {
      const tableId = `stage-weather-${saison.id}`;
      const def = tableStepDefs[tableId];
      for (const row of def.rows) {
        const nat = naturalRollForTableRow({ tableId, die: 100 }, row);
        if (nat == null) inatteignables.push(`${tableId}/${row.id}`);
        else expect(weatherFromRoll(nat, saison.id as Season)).toBe(row.id); // le naturel proposé DONNE bien cette ligne
      }
    }
    expect(inatteignables, 'une ligne qu’aucun dé ne peut viser rend la pose menteuse').toEqual([]);
  });

  it('Météo : le dé POSÉ décide de la météo — la table et le résolveur d’origine s’accordent', () => {
    for (const saison of weather) {
      const tableId = `stage-weather-${saison.id}`;
      for (const face of [1, 25, 50, 75, 100]) {
        const r = rollTableStep({ tableId, die: 100, forcedRoll: face }, { int: () => face });
        expect(r.id).toBe(weatherFromRoll(face, saison.id as Season));
      }
    }
  });

  it('Événement de bord : l’Humeur de Manann DÉPLACE la fenêtre atteignable de la table (MDG 15 l.85)', () => {
    const def = tableStepDefs['sea-board-events'];
    expect(def, 'table des événements de bord enregistrée').toBeTruthy();
    // La table court de −9999 à +9999 : le d100 seul n'en atteint qu'une TRANCHE, et l'Humeur la
    // déplace. Une ligne est visable exactement quand sa plage croise [1+mod, 100+mod] — c'est le RAW
    // (une Humeur très haute rend le naufrage inatteignable, une très basse rend la manne impossible).
    const visable = (mod: number, id: string) => {
      const row = def.rows.find((r) => r.id === id)!;
      return naturalRollForTableRow({ tableId: 'sea-board-events', die: 100, ...(mod ? { mod } : {}) }, row) != null;
    };
    expect(visable(0, 'triton'), 'sans Humeur, les lignes très négatives sont hors du d100').toBe(false);
    expect(visable(-200, 'triton'), 'Humeur très basse : le triton devient atteignable').toBe(true);
    expect(visable(0, 'manne-de-manann'), 'sans Humeur, la manne est hors d’atteinte').toBe(false);
    expect(visable(200, 'manne-de-manann'), 'Humeur très haute : la manne s’ouvre').toBe(true);
    // Et à Humeur nulle, la tranche 1..100 offre bien des lignes à viser (la pose n'est pas morte).
    const offertes = def.rows.filter((r) => naturalRollForTableRow({ tableId: 'sea-board-events', die: 100 }, r) != null);
    expect(offertes.length, 'au moins une ligne visable sans Humeur').toBeGreaterThan(0);
  });
});

// ── LA FENÊTRE DE LOT D'UN ÉTAL ─────────────────────────────────────────────────────────────────

/**
 * Les dés d'ouverture d'un étal (marchand présent, quantités, prix) sont des dés de MONDE, mais ils
 * ne forment pas une séquence : ils naissent tous ensemble, avant l'écran. D'où la fenêtre de LOT —
 * une rangée posable par dé, validée d'un bloc.
 *
 * Ce que ces cas verrouillent, dans l'ordre où ça peut casser :
 *  (a) option OFF : l'étal est celui d'avant, à l'octet — la fenêtre n'existe pas ;
 *  (b) poser un dé change l'offre correspondante ;
 *  (c) l'ordre des rangées EST l'ordre des dés (permuter = étal différent) ;
 *  (d) option ON + validation sans aucune pose : étal IDENTIQUE au OFF — la fenêtre ne change rien
 *      par sa seule existence.
 */
describe('#1426 — la fenêtre de LOT d’un étal (halle terrestre)', () => {
  beforeEach(() => {
    resetDesFixes(); resetCadence();
    set({ net: { ...get().net, mode: 'local', mySeat: 0, gmSeat: undefined }, pendingEtalLot: null, pendingCascade: null, journal: [] });
  });
  afterEach(() => { resetDesFixes(); resetCadence(); });

  /** Ouvre la halle sous graine fixe et rend l'étal produit (forme comparable à l'octet). */
  const etal = () => (get().landMarket?.offers ?? []).map((o) => `${o.cargoId}:${o.enc}:${o.basePrice}`);

  function halle(): void {
    marcheAvecLot();
    set({ landMarket: null, pendingEtalLot: null });
    seedBattleRng(9);
  }

  it('(a) option OFF : aucune fenêtre, l’étal se génère d’un bloc', () => {
    halle();
    resetDesFixes();
    openLandMarket(get, set);
    expect(get().pendingEtalLot, 'option OFF : rien à poser, rien à ouvrir').toBeNull();
    expect(get().landMarket, 'l’étal existe').toBeTruthy();
  });

  it('(d) option ON + validation SANS aucune pose : l’étal est celui du OFF, à l’identique', () => {
    halle();
    resetDesFixes();
    openLandMarket(get, set);
    const sansFenetre = etal();

    halle();
    setDesFixes(true);
    openLandMarket(get, set);
    const lot = get().pendingEtalLot;
    expect(lot, 'option ON : la fenêtre de lot s’ouvre AVANT l’écran').toBeTruthy();
    expect(lot!.participants.length, 'un lot vide n’aurait rien à poser').toBeGreaterThan(0);
    get().etalLotConfirm();
    expect(get().pendingEtalLot, 'la validation referme la fenêtre').toBeNull();
    expect(etal(), 'la fenêtre ne change RIEN par sa seule existence').toEqual(sansFenetre);
  });

  it('(b) poser un dé change l’étal — et seul le dé posé bouge', () => {
    halle();
    setDesFixes(true);
    openLandMarket(get, set);
    const avant = (() => { const g = get(); return g.pendingEtalLot!.participants.map((r) => r.value); })();
    // On pose le DERNIER dé (un prix/une quantité, jamais la présence du marchand) à une valeur
    // franchement différente : l'étal doit suivre.
    const parts0 = get().pendingEtalLot!.participants;
    const dernier = parts0[parts0.length - 1];
    const neuf = dernier.value === dernier.max ? dernier.min : dernier.max;
    get().etalLotSetForcedRoll(dernier.id, neuf);
    const apres = get().pendingEtalLot!.participants.map((r) => r.value);
    expect(apres[apres.length - 1], 'la valeur saisie est la valeur posée').toBe(neuf);
    expect(apres.slice(0, -1), 'aucun autre dé n’a bougé').toEqual(avant.slice(0, -1));
    get().etalLotConfirm();
    expect(get().landMarket, 'l’étal est ouvert après validation').toBeTruthy();
  });

  it('(c) l’ORDRE des rangées est l’ordre des dés : permuter deux valeurs change l’étal', () => {
    halle();
    setDesFixes(true);
    openLandMarket(get, set);
    const lot = get().pendingEtalLot!;
    // Il faut deux dés de valeurs DIFFÉRENTES pour que la permutation se voie.
    const paire = lot.participants.findIndex((r, i) => i > 0 && r.value !== lot.participants[i - 1].value);
    if (paire < 1) return; // graine dégénérée : rien à permuter, le cas ne dit rien
    get().etalLotConfirm();
    const direct = etal();

    halle();
    setDesFixes(true);
    openLandMarket(get, set);
    const l2 = get().pendingEtalLot!;
    const a = l2.participants[paire - 1];
    const b = l2.participants[paire];
    get().etalLotSetForcedRoll(a.id, b.value);
    get().etalLotSetForcedRoll(b.id, a.value);
    get().etalLotConfirm();
    expect(etal(), 'deux dés permutés ne peuvent pas rendre le même étal').not.toEqual(direct);
  });

  it('le lot NOMME chaque dé : un dé sans nom ne serait pas posable', () => {
    halle();
    setDesFixes(true);
    openLandMarket(get, set);
    for (const r of get().pendingEtalLot!.participants) {
      // Un libellé NON VIDE ne suffit pas : le repli du journal en fournirait un. Ce qu'on exige est
      // qu'AUCUN dé ne soit resté anonyme — poser un dé dont on ignore ce qu'il décide n'est pas poser.
      expect(r.label, 'un dé que le générateur n’a pas nommé n’est pas posable').not.toBe(DE_NON_NOMME);
      expect(r.label.length, 'chaque rangée dit ce que son dé décide').toBeGreaterThan(0);
      expect(r.max).toBeGreaterThan(0);
      expect(r.value).toBeGreaterThanOrEqual(r.min);
      expect(r.value).toBeLessThanOrEqual(r.max);
    }
  });
});
