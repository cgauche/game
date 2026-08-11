/**
 * #1117 L4 — la FIN DE COMBAT en BANDES : « une situation = une fenêtre ».
 *
 * Trois contrats que la forme MONO ne pouvait pas tenir :
 *  1. la CLÉ de bande est (kind, ENTRÉE DE RÈGLE) — l'Infection Mineure d'après Blessure critique
 *     (LDB 20 l.90, « sur un échec d'un Test de Résistance Très Facile (+60) après un combat où vous
 *     avez subi une Blessure critique ») et la Contagion d'une créature Infectée (LDB 20 l.25/l.51)
 *     sont DEUX entrées, et peuvent viser la MÊME maladie chez le MÊME personnage. En MONO les deux
 *     étapes sortaient sous le MÊME id, la seconde injoignable ;
 *  2. la POSSESSION d'une bande à plusieurs porteurs est PARTAGÉE (`groupOwner`) — chaque siège tient
 *     SA rangée dans l'unique fenêtre d'Exposition à la Corruption ;
 *  3. la RAFALE de seuils de Corruption (LDB 19 l.70, « effectuez immédiatement un Test de Résistance
 *     Intermédiaire (+0) ») : le slot `pendingCorruption` est UNIQUE, et une bande fait déborder N
 *     héros d'un seul applier. Sans file, le 2ᵉ tombait sur le repli auto-résolu — un Test RAW roulé
 *     en silence, que le passage en bande aurait INTRODUIT.
 *
 * Plus la migration de sauvegarde (`MIGRATIONS[19]`), sur le cas legacy des ids dupliqués.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { useGame } from './store';
import { openCombatEndCascade } from './combatFlow';
import { combatEndBands } from './combatEndBands';
import { splitBandRows } from './nightBands';
import { stepReady } from './cascade';
import { createHero } from '../engine/character';
import { makeRNG } from '../engine/dice';
import { seedBattleRng } from './battleRng';
import { resetDesFixes } from '../engine/fixedDie';
import { seatOwns } from './netOwnership';
import { modalOwnerOf } from './modalArbiter';
import { migrateSave, SAVE_VERSION } from './saves';
import { corruptionThreshold } from '../engine/corruption';
import { testScene } from '../scenes/test-fixture';
import { readFileSync } from 'node:fs';
import type { Combatant } from '../engine/types';
import type { CascadeStep } from './pendings';

const NET0 = useGame.getState().net;
const g = useGame.getState;
const etapes = () => g().pendingCascade?.participants ?? [];
const bandes = (k: string) => etapes().filter((s) => s.kind === k);

/** Combat RÉEL à deux sièges (calque `sequence-possession.test.ts`) : le siège 1 possède les héros
 *  d'indice `invites`, l'hôte (siège 0) garde les autres. Tous les ennemis sauf le premier sont morts. */
function setupCoop(opts: { heros?: number; invites?: number[] } = {}): { H: Combatant[]; E: Combatant[] } {
  const n = opts.heros ?? 1;
  const party = Array.from({ length: n }, (_, i) =>
    createHero({ speciesId: 'humains-reiklander', careerId: 'soldat', label: `H${i}`, rng: makeRNG(i + 1) }));
  useGame.setState({ party });
  g().startScene(testScene);
  g().startCombat('enc-mutants');
  g().confirmRoundStart();
  vi.clearAllTimers();
  const b = g().battle!;
  const H = b.combatants.filter((c) => c.kind === 'hero');
  const enemies = b.combatants.filter((c) => c.kind === 'enemy');
  enemies.slice(1).forEach((e) => (e.dead = true));
  const E = enemies.slice(0, 1);
  H.forEach((h, i) => (h.pos = { x: 10, y: 10 + i }));
  E.forEach((e, i) => (e.pos = { x: 11 + i, y: 10 }));
  const ownership: Record<string, number> = {};
  for (const i of opts.invites ?? []) ownership[H[i].id] = 1;
  useGame.setState({ battle: { ...b }, pendingCascade: null, suspendedCascades: [], pendingLogQueue: [] } as never);
  useGame.setState({ net: { ...NET0, mode: 'host', mySeat: 0, slots: [0, 1, 0, 0], ownership } } as never);
  return { H, E };
}

/** Pose l'issue de TOUTES les rangées de la bande courante (aucun dé : le contrat testé est la
 *  conséquence, pas le tirage), puis valide l'étape. */
function jouerBande(success: boolean): void {
  const p = g().pendingCascade!;
  const cur = p.participants[p.cursor];
  useGame.setState({
    pendingCascade: {
      ...p,
      participants: p.participants.map((s, i) => (i !== p.cursor ? s : {
        ...s,
        participants: (cur.participants ?? []).map((r) => ({ ...r, result: { roll: success ? 1 : 99, target: r.target ?? 0, sl: success ? 3 : -3, success } })),
      })),
    },
  } as never);
  g().cascadeNext();
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.clearAllTimers();
  seedBattleRng(4);
  resetDesFixes();
  useGame.setState({ battle: null, pendingCascade: null, suspendedCascades: [], pendingCorruption: null, pendingRenounce: null, corruptionQueue: [], pendingLogQueue: [] } as never);
});
afterEach(() => {
  vi.clearAllTimers();
  vi.useRealTimers();
  resetDesFixes();
  useGame.setState({ net: NET0, battle: null, pendingCascade: null, suspendedCascades: [], pendingCorruption: null, pendingRenounce: null, corruptionQueue: [] } as never);
});

describe('#1117 L4 — une bande par ENTRÉE DE RÈGLE (LDB 20 l.90 ≠ l.25/l.51)', () => {
  it('un héros à la fois blessé grièvement ET exposé à la même maladie reçoit DEUX bandes d’ids DISTINCTS', () => {
    const { H } = setupCoop({ heros: 1, invites: [0] });
    const c = g().battle!.combatants.find((x) => x.id === H[0].id)!;
    c.tookCriticalThisFight = true; // → Infection Mineure (LDB 20 l.90)
    c.diseaseExposure = [{ disease: 'infection-mineure' }] as Combatant['diseaseExposure']; // → Contagion (l.25/l.51)

    openCombatEndCascade(g, useGame.setState);

    const vues = bandes('combatEndDisease');
    expect(vues.length, 'DEUX entrées de règle = DEUX fenêtres').toBe(2);
    expect(new Set(vues.map((s) => s.id)).size, 'ids DISTINCTS — sinon la seconde fenêtre est injoignable').toBe(2);
    // Chaque bande porte UNE rangée, celle du héros — et chacune sait de quelle entrée elle vient.
    for (const b of vues) {
      expect(b.participants!.map((r) => r.id)).toEqual([H[0].id]);
      expect(b.participants![0].result, 'rien n’a été roulé : la rangée est à jouer').toBeNull();
    }
    expect(vues.map((b) => b.meta?.entry).sort()).toEqual(['contagion', 'infection']);
    expect(vues.map((b) => b.meta?.disease)).toEqual(['infection-mineure', 'infection-mineure']);
    expect(c.diseases ?? [], 'rien n’a été contracté en silence').toHaveLength(0);
  });

  it('la même entrée pour DEUX héros ne fait qu’UNE bande, à deux rangées', () => {
    const { H } = setupCoop({ heros: 2 });
    for (const h of H) g().battle!.combatants.find((x) => x.id === h.id)!.tookCriticalThisFight = true;

    openCombatEndCascade(g, useGame.setState);

    const vues = bandes('combatEndDisease');
    expect(vues.length).toBe(1);
    expect(vues[0].participants!.map((r) => r.id)).toEqual([H[0].id, H[1].id]);
    expect(vues[0].aggregate, 'jets INDÉPENDANTS').toBe('none');
  });

  /** CAS DISCRIMINANT de la clé : deux porteurs DIFFÉRENTS, la MÊME maladie, mais chacun par SON
   *  entrée de règle. Le filet d'id ne peut rien ici (les porteurs diffèrent, aucune collision) —
   *  seule la CLÉ (kind, entrée de règle) empêche la sur-bande : une fenêtre unique fondrait
   *  l'Infection post-critique et la Contagion en une seule « situation », qu'elles ne sont pas. */
  it('deux porteurs, MÊME maladie, entrées DIFFÉRENTES → deux bandes (la clé, pas le filet d’id)', () => {
    const { H } = setupCoop({ heros: 2 });
    const [a, b] = H.map((h) => g().battle!.combatants.find((x) => x.id === h.id)!);
    a.tookCriticalThisFight = true; // Infection Mineure (LDB 20 l.90)
    b.diseaseExposure = [{ disease: 'infection-mineure' }] as Combatant['diseaseExposure']; // Contagion (l.25/l.51)

    openCombatEndCascade(g, useGame.setState);

    const vues = bandes('combatEndDisease');
    expect(vues.length, 'deux entrées de règle = deux fenêtres, même sans collision d’id').toBe(2);
    expect(vues.map((s) => [s.meta?.entry, s.participants!.map((r) => r.id)]))
      .toEqual([['infection', [a.id]], ['contagion', [b.id]]]);
  });

  /** SONDE A promue : les rangées RÉELLES produites ci-dessus, repassées à la fabrique avec puis SANS
   *  leur discriminant d'entrée. C'est le seul test qui meurt si `entry` sort de la clé sans que le
   *  filet d'id le rattrape — et il MONTRE la sur-bande interdite (une fenêtre à deux rangées, qui
   *  poserait l'Infection post-critique et la Contagion comme une seule « situation »). */
  it('les MÊMES rangées, privées de leur `entry`, FONDENT en une seule fenêtre — la clé porte', () => {
    const { H } = setupCoop({ heros: 2 });
    const [a, b] = H.map((h) => g().battle!.combatants.find((x) => x.id === h.id)!);
    a.tookCriticalThisFight = true;
    b.diseaseExposure = [{ disease: 'infection-mineure' }] as Combatant['diseaseExposure'];
    openCombatEndCascade(g, useGame.setState);

    // Reconstruit les étapes MONO dont les bandes sont issues (une par rangée), telles que la fabrique
    // les reçoit d'`openCombatEndCascade` ou d'une save.
    const monos = bandes('combatEndDisease').flatMap((bd, i) => bd.participants!.map((r, j) => ({
      id: `m${i}${j}`, kind: bd.kind, actorId: r.id, target: r.target ?? 40, rollLabel: 'Résistance',
      meta: { ...bd.meta, ...r.meta },
    })));
    expect(monos.length).toBe(2);

    const avec = combatEndBands(monos as never);
    const sans = combatEndBands(monos.map((m) => {
      const meta = { ...m.meta } as Record<string, unknown>;
      delete meta.entry;
      return { ...m, meta };
    }) as never);
    expect(avec.length, 'avec l’entrée de règle : deux fenêtres').toBe(2);
    expect(sans.length, 'sans elle : UNE fenêtre — la sur-bande que la clé interdit').toBe(1);
    expect(sans[0].participants!.length, 'et elle fondrait DEUX entrées de règle en une situation').toBe(2);
  });
});

describe('#1117 L4 (#1262 B7) — la bande d’Exposition à la Corruption est PARTAGÉE entre sièges', () => {
  it('deux héros de sièges DIFFÉRENTS → UNE fenêtre, une rangée chacun, possession de groupe', () => {
    const { H, E } = setupCoop({ heros: 2, invites: [1] });
    E[0].traits = [{ id: 'corruption', arg: 'Mineure' }] as Combatant['traits'];

    openCombatEndCascade(g, useGame.setState);

    const vues = bandes('combatEndCorruption');
    expect(vues.length, 'l’exposition est GLOBALE (pire Degré affronté) : UNE entrée de règle').toBe(1);
    const bande = vues[0];
    expect(bande.participants!.map((r) => r.id)).toEqual([H[0].id, H[1].id]);
    expect(bande.groupOwner, 'plusieurs porteurs → possession de groupe').toBe(true);
    expect(bande.actorId, 'aucun porteur ne s’approprie la fenêtre').toBeUndefined();
    expect(modalOwnerOf(g())).toBe('*');
    expect(seatOwns(g(), 0, H[0].id), 'l’hôte tient SA rangée').toBe(true);
    expect(seatOwns(g(), 1, H[1].id), 'l’invité tient la sienne, dans la MÊME fenêtre').toBe(true);
    expect(seatOwns(g(), 0, H[1].id), 'et l’hôte ne roule pas pour lui').toBe(false);
  });
});

describe('#1117 L4 — RAFALE de seuils de Corruption (LDB 19 l.70) : une file, jamais un jet muet', () => {
  it('deux héros débordent leur seuil dans la MÊME bande → le 2ᵉ prend rang au lieu d’être roulé en silence', () => {
    const { H, E } = setupCoop({ heros: 2 });
    E[0].traits = [{ id: 'corruption', arg: 'Mineure' }] as Combatant['traits'];
    const porteurs = H.map((h) => g().battle!.combatants.find((x) => x.id === h.id)!);
    // Au SEUIL pile : l'échec du Test d'Exposition (Mineure → +1 Point) le fait DÉBORDER (l.70).
    for (const c of porteurs) c.corruption = corruptionThreshold(c);

    openCombatEndCascade(g, useGame.setState);
    expect(bandes('combatEndCorruption').length).toBe(1);
    jouerBande(false); // les DEUX rangées échouent → +1 Point chacune → deux seuils dus

    expect(porteurs.map((c) => c.corruption)).toEqual(porteurs.map((c) => corruptionThreshold(c) + 1));
    expect(g().pendingCorruption?.heroId, 'le premier seuil ouvre SA fenêtre').toBe(H[0].id);
    expect(g().pendingCorruption?.kind).toBe('seuil');
    expect(g().corruptionQueue.map((q) => q.heroId), 'le second ATTEND — il n’est pas résolu en silence').toEqual([H[1].id]);
    expect(porteurs[1].mutations ?? [], 'aucune mutation posée sans que son Test soit joué').toHaveLength(0);

    // Le premier acquitte (réussite : Corruption contenue) → la fenêtre passe au second.
    useGame.setState({ pendingCorruption: { ...g().pendingCorruption!, roll: 1, target: 40, sl: 4, success: true } } as never);
    g().resolveCorruption();
    expect(g().pendingCorruption?.heroId, 'le seuil en file reçoit SA fenêtre').toBe(H[1].id);
    expect(g().corruptionQueue, 'la file est vidée d’autant').toEqual([]);
  });

  /** SONDE B promue : le « Je te renie ! » (LDB 17 l.67) s'insère AU MILIEU de la rafale. Le drain est
   *  BLOQUÉ tant que la décision est en attente — deux fenêtres de Corruption ouvertes se
   *  recouvriraient — et c'est `resolveRenounce` qui rend le slot au seuil suivant. Chemin qu'aucun
   *  autre test ne parcourt. */
  it('Renoncement AU MILIEU de la rafale : le drain ATTEND la décision, puis le seuil suivant s’ouvre', () => {
    const { H, E } = setupCoop({ heros: 2 });
    E[0].traits = [{ id: 'corruption', arg: 'Mineure' }] as Combatant['traits'];
    const porteurs = H.map((h) => g().battle!.combatants.find((x) => x.id === h.id)!);
    for (const c of porteurs) { c.corruption = corruptionThreshold(c); c.resilience = 2; }

    openCombatEndCascade(g, useGame.setState);
    jouerBande(false);
    expect(g().pendingCorruption?.heroId).toBe(H[0].id);
    expect(g().corruptionQueue.map((q) => q.heroId)).toEqual([H[1].id]);

    // Le premier RATE son Test de seuil et a de la Résilience → la mutation lui est proposée.
    useGame.setState({ pendingCorruption: { ...g().pendingCorruption!, roll: 99, target: 40, sl: -3, success: false } } as never);
    g().resolveCorruption();
    expect(g().pendingRenounce?.heroId, 'la décision de renoncement appartient au premier').toBe(H[0].id);
    expect(g().pendingCorruption, 'le slot reste VIDE : le second ne double pas la fenêtre').toBeNull();
    expect(g().corruptionQueue.map((q) => q.heroId), 'la file n’a pas bougé').toEqual([H[1].id]);

    g().renounceResolve(true); // « Je te renie ! » : −1 Résilience, aucune mutation
    expect(g().pendingCorruption?.heroId, 'la décision rendue, le seuil en file reçoit SA fenêtre').toBe(H[1].id);
    expect(g().pendingCorruption?.kind).toBe('seuil');
    expect(g().corruptionQueue).toEqual([]);
    expect(porteurs[0].resilience, '1 Point de Résilience dépensé').toBe(1);
    expect(porteurs[0].mutations ?? [], 'refusée').toHaveLength(0);
    expect(porteurs[1].mutations ?? [], 'et le second n’a toujours rien subi sans son Test').toHaveLength(0);
  });
});

describe('#1117 L4 — la pénalité d’ÉTATS pèse sur la rangée, des DEUX côtés de la scission', () => {
  /** La voie résolue d'office ROULAIT le Test de Contraction sans la pénalité d'États, là où la voie
   *  influençable la comptait : divergence d'ARTEFACT (deux arithmétiques), pas de règle. Depuis L4 les
   *  deux côtés sortent de la MÊME rangée. Sonné : « -10 à tous les Tests » (`LDB 16 l.125`). */
  it('la rangée du Sonné porte le −10 NOMMÉ, et la moitié résolue d’office garde la MÊME cible', () => {
    const { H } = setupCoop({ heros: 2 });
    const porteurs = H.map((h) => g().battle!.combatants.find((x) => x.id === h.id)!);
    // E 30 : la cible de Très Facile (+60) reste SOUS le plafond de 99 (`clampTarget`) — le test
    // mesure la pénalité d'États, pas l'écrêtage.
    for (const c of porteurs) { c.tookCriticalThisFight = true; c.characteristics.endurance = 30; c.skills = []; }
    porteurs[0].conditions = [{ id: 'sonne', value: 1 }] as Combatant['conditions'];

    openCombatEndCascade(g, useGame.setState);
    const bande = g().pendingCascade!.participants.find((s) => s.kind === 'combatEndDisease')!;
    const row = (id: string) => bande.participants!.find((r) => r.id === id)!;

    expect(row(H[0].id).target, 'cible = base + 60 (Très Facile) − 10 (Sonné)').toBe(row(H[0].id).base! + 50);
    expect(row(H[1].id).target, 'porteur sain : base + 60, aucun malus').toBe(row(H[1].id).base! + 60);
    expect((row(H[0].id).mods ?? []).some((m) => m.value === -10), 'le −10 est NOMMÉ, pas un écart muet').toBe(true);
    expect(row(H[1].id).mods ?? []).toEqual([]);

    // Moitié RÉSOLUE D'OFFICE (aucun porteur piloté) : les MÊMES rangées, donc la même cible.
    const { others } = splitBandRows(bande, () => false);
    expect(others!.participants!.find((r) => r.id === H[0].id)!.target).toBe(row(H[0].id).target);
  });
});

describe('#1117 L4 — MIGRATIONS[19] : une save v19 en pleine cascade de bilan redevient des bandes', () => {
  const fixture = () => JSON.parse(
    readFileSync(new URL('./__fixtures__/saves/v19-fin-de-combat-mono.json', import.meta.url), 'utf-8'),
  ) as unknown;

  it('les DEUX étapes legacy de MÊME id (Infection + Contagion) donnent DEUX bandes joignables', () => {
    const migrated = migrateSave(fixture())!;
    expect(migrated.version).toBe(SAVE_VERSION);
    const steps = (migrated.data as { pendingCascade: { participants: { id: string; kind: string; participants?: { id: string }[] }[] } }).pendingCascade.participants;
    const maladies = steps.filter((s) => s.kind === 'combatEndDisease');
    expect(maladies.length, 'deux entrées legacy chez h1 + une chez h2 → deux bandes').toBe(2);
    expect(new Set(maladies.map((s) => s.id)).size, 'ids de bande DISTINCTS').toBe(2);
    // h1 a UNE rangée dans chacune ; h2 rejoint la première (sa seule entrée).
    expect(maladies.map((s) => s.participants!.map((r) => r.id))).toEqual([['h1', 'h2'], ['h1']]);
    for (const s of maladies) expect(new Set(s.participants!.map((r) => r.id)).size).toBe(s.participants!.length);
  });

  it('les deux Expositions à la Corruption fusionnent en UNE bande à deux rangées', () => {
    const migrated = migrateSave(fixture())!;
    const steps = (migrated.data as { pendingCascade: { participants: { kind: string; participants?: { id: string }[] }[] } }).pendingCascade.participants;
    const corr = steps.filter((s) => s.kind === 'combatEndCorruption');
    expect(corr.length).toBe(1);
    expect(corr[0].participants!.map((r) => r.id)).toEqual(['h1', 'h2']);
  });

  /** SONDE F promue (#1259) : la bandification NE DÉPLACE PAS le curseur (contrairement à
   *  `bandifyPursuitSteps`, qui le REPOSE parce qu'une manche se juge à la clôture). Une bande dont
   *  TOUTES les rangées sont déjà roulées reste PRÊTE à valider — jamais sautée, jamais rejouée. */
  it('le curseur ne dérive pas, et une bande toute roulée reste à VALIDER', () => {
    const doc = fixture() as { data: { pendingCascade: { cursor: number; participants: { result?: unknown }[] } } };
    doc.data.pendingCascade.cursor = 1; // la 1re étape est de l'historique inerte
    for (let i = 1; i < doc.data.pendingCascade.participants.length; i++) {
      doc.data.pendingCascade.participants[i].result = { roll: 77, target: 40, sl: -3, success: false };
    }
    const migrated = migrateSave(doc)!;
    const pc = (migrated.data as { pendingCascade: { cursor: number; participants: CascadeStep[] } }).pendingCascade;

    expect(pc.cursor, 'le curseur reste POSÉ où la save l’a laissé').toBe(1);
    expect(pc.participants[0].participants, 'l’avant-curseur n’est pas bandé').toBeUndefined();
    const cur = pc.participants[pc.cursor];
    expect(cur.participants, 'le curseur pointe la 1re BANDE').toBeTruthy();
    expect(cur.participants!.every((r) => r.result), 'toutes ses rangées portent leur jet').toBe(true);
    expect(stepReady(cur), 'toute roulée = PRÊTE à valider').toBe(true);
  });
});
