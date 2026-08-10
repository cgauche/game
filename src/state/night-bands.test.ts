/**
 * BANDES de la NUIT (#1117 L3) — les jets de nuit ne défilent plus un par un : ils font UNE fenêtre
 * par entrée de RÈGLE et par JOUR (`state/nightBands`), une RANGÉE par héros appelé.
 *
 * Ce que ce fichier verrouille :
 *  1. la CLÉ contient le JOUR — trois jours franchis font trois fenêtres de Dessoûlage, jamais trois
 *     rangées de même id dans une seule (elles seraient INJOIGNABLES : les surfaces de rangée keyent
 *     par id nu) ; et l'INVARIANT structurel « aucune bande ne contient deux rangées de même id » ;
 *  2. une bande = N rangées (Faim de plusieurs affamés dans la MÊME fenêtre) ;
 *  3. la gueule de bois est due par TOUTE rangée du dessoûlage (LDB 09 l.485 : « Une fois tous les
 *     effets dissipés, effectuez un nouveau Test »), et forme UNE bande ;
 *  4. une bande par MALADIE (la contagion ne mélange pas deux entrées de règle) ;
 *  5. la file de fin de combat est SCINDÉE par pilote : rangées manuelles influençables, témoins
 *     résolus d'office DANS LEUR PROPRE bande (jamais `interactive:false` dans la bande jouée).
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { useGame } from './store';
import { createHero } from '../engine/character';
import { makeRNG } from '../engine/dice';
import { seedBattleRng } from './battleRng';
import { emptyScene } from './scene';
import { MINUTES_PER_DAY } from '../engine/clock';
import { nightBands, splitBandRows } from './nightBands';
import { checkBattleOver, applyEffects } from './combatFlow';
import { addCondition } from '../engine/conditions';
import { contractDisease } from '../engine/disease';
import type { Combatant } from '../engine/types';
import type { CascadeStep } from './pendings';

const get = useGame.getState;
const set = useGame.setState;

function h(id: string, over: Partial<Combatant> = {}): Combatant {
  const c = createHero({ speciesId: 'humains-reiklander', careerId: 'soldat', label: id, rng: makeRNG(4) });
  c.id = id;
  Object.assign(c, over);
  return c;
}

/** Toutes les bandes d'un `kind` de la cascade ouverte. */
const bandsOf = (kind: string): CascadeStep[] =>
  (get().pendingCascade?.participants ?? []).filter((s) => s.kind === kind);

beforeEach(() => {
  seedBattleRng(1);
  set({
    battle: null, pendingCascade: null, suspendedCascades: [], deferredUpkeepQueue: [],
    pendingRest: null, pendingVictory: null, journal: [], scene: emptyScene(6, 6),
    gameTime: 0, lastUpkeepDay: 0, lastNightDay: 0,
  } as never);
});

describe('CLÉ de bande = (entrée de règle, JOUR)', () => {
  it('3 jours franchis, 1 héros ivre → TROIS bandes de Dessoûlage (une par jour), jamais une bande à 3 rangées', () => {
    set({ party: [h('h1', { drunk: { failedTests: 3, drunk: true } })] } as never);
    get().advanceTime(3 * MINUTES_PER_DAY);

    const bandes = bandsOf('dessoulage');
    expect(bandes).toHaveLength(3); // un Test par journée franchie (LDB 09 l.485), donc trois fenêtres
    expect(bandes.map((b) => b.meta?.day)).toEqual([1, 2, 3]);
    expect(bandes.every((b) => b.participants!.length === 1)).toBe(true);
  });

  /** SONDE du juge de design : aucune fenêtre ne peut contenir deux rangées de même porteur — une
   *  seconde serait INJOIGNABLE (les verbes de rangée s'adressent à `part.id`). */
  it('INVARIANT : aucune bande de nuit ne contient deux rangées de même id', () => {
    set({ party: [h('h1', { drunk: { failedTests: 2, drunk: true } }), h('h2', { drunk: { failedTests: 1, drunk: true } })] } as never);
    get().advanceTime(3 * MINUTES_PER_DAY);

    const doublons: string[] = [];
    for (const band of get().pendingCascade!.participants) {
      const ids = (band.participants ?? []).map((p) => p.id);
      if (new Set(ids).size !== ids.length) doublons.push(`${band.id} : ${ids.join(',')}`);
    }
    expect(doublons, `bande(s) à rangées injoignables :\n${doublons.join('\n')}`).toEqual([]);
  });

  it('la fabrique SÉPARE aussi deux jets de même entrée le MÊME jour chez le MÊME héros (deux fenêtres)', () => {
    const mono = (id: string, day: number): CascadeStep => ({
      id, kind: 'traumaFracture', actorId: 'h1', label: 'Convalescence', rollLabel: 'Résistance',
      base: 40, difficulty: 'accessible', target: 60, result: null, interactive: true, meta: { day },
    });
    const out = nightBands([mono('a', 4), mono('b', 4)]);
    expect(out).toHaveLength(2); // deux Convalescences échéant le même jour : deux fenêtres, jamais un doublon
    expect(out.every((b) => b.participants!.length === 1)).toBe(true);
  });

  /** Le JOUR est dans la CLÉ, pas seulement rattrapé par le filet anti-doublon : sans lui, la rangée
   *  d'un héros NON encore présent rejoindrait la fenêtre d'un AUTRE jour — un Test du jour 2 joué
   *  dans la fenêtre du jour 1, sous l'enjeu et le décompte de celle-ci. */
  it('deux JOURS, des porteurs différents : chaque fenêtre ne mêle QUE des rangées de son jour', () => {
    const mono = (id: string, hero: string, day: number): CascadeStep => ({
      id, kind: 'faim', actorId: hero, label: 'Faim', rollLabel: 'Résistance',
      base: 40, difficulty: 'intermediaire', target: 40, result: null, interactive: true, meta: { day },
    });
    const out = nightBands([mono('a', 'h1', 1), mono('b', 'h1', 2), mono('c', 'h2', 2)]);
    expect(out).toHaveLength(2);
    expect(out.map((b) => b.meta?.day)).toEqual([1, 2]);
    expect(out.map((b) => b.participants!.map((r) => r.id))).toEqual([['h1'], ['h1', 'h2']]);
    // Aucune fenêtre ne mêle deux jours : chaque rangée porte le jour de SA fenêtre.
    for (const band of out) expect(band.participants!.every((r) => r.meta?.day === band.meta?.day)).toBe(true);
  });
});

describe('une bande, N rangées', () => {
  it('deux affamés le même jour → UNE fenêtre « Faim » à deux rangées', () => {
    const affame = (id: string) => h(id, { hunger: { days: 1, tests: 0, failures: 0 } });
    set({ party: [affame('h1'), affame('h2')] } as never);
    get().advanceTime(MINUTES_PER_DAY);

    const faim = bandsOf('faim');
    expect(faim).toHaveLength(1);
    expect(faim[0].participants!.map((p) => p.id)).toEqual(['h1', 'h2']);
    expect(faim[0].aggregate).toBe('none'); // jets INDÉPENDANTS : chaque rangée porte SA conséquence
    expect(faim[0].participants!.every((p) => p.interactive && p.result === null)).toBe(true);
  });
});

describe('gueule de bois (LDB 09 l.485) — due par TOUTE rangée du dessoûlage', () => {
  it('deux ivres, l’un réussit l’autre rate → UNE bande de gueule de bois à DEUX rangées', () => {
    set({ party: [h('h1', { drunk: { failedTests: 2, drunk: true } }), h('h2', { drunk: { failedTests: 4, drunk: true } })] } as never);
    get().advanceTime(MINUTES_PER_DAY);
    const desso = bandsOf('dessoulage')[0];
    expect(desso.participants).toHaveLength(2);

    const p = get().pendingCascade!;
    const rows = desso.participants!.map((r, i) => ({
      ...r, result: i === 0 ? { roll: 1, target: r.target, sl: 3, success: true } : { roll: 99, target: r.target, sl: -3, success: false },
    }));
    set({ pendingCascade: { ...p, participants: p.participants.map((s) => (s.id === desso.id ? { ...s, participants: rows } : s)) } });
    get().cascadeNext();

    const hangover = bandsOf('dessoulageHangover');
    expect(hangover, 'le 2ᵉ Test est dû « une fois tous les effets dissipés », pas aux seuls perdants').toHaveLength(1);
    expect(hangover[0].participants!.map((r) => r.id)).toEqual(['h1', 'h2']);
  });
});

describe('une bande par MALADIE', () => {
  const contagion = (id: string, hero: string, maladie: string): CascadeStep => ({
    id, kind: 'contagion', actorId: hero, label: `Contagion (${maladie})`, rollLabel: 'Résistance',
    base: 40, difficulty: 'accessible', target: 60, result: null, interactive: true,
    menace: 'maladie', meta: { diseaseName: maladie, day: 2 },
  });

  it('deux MALADIES distinctes → DEUX fenêtres ; deux héros exposés à la MÊME → UNE fenêtre à deux rangées', () => {
    // La clé de dédoublonnage du RAW est la maladie (LDB 20 l.206, « Toux et éternuements ») — une
    // `ContagionSpec` ne porte AUCUN id de source : la bande « par source » est inconstructible.
    const deux = nightBands([contagion('c1', 'h1', 'verole-urticante'), contagion('c2', 'h1', 'courante-galopante')]);
    expect(deux).toHaveLength(2);
    expect(deux.map((band) => band.meta?.diseaseName)).toEqual(['verole-urticante', 'courante-galopante']);

    const une = nightBands([contagion('c1', 'h1', 'verole-urticante'), contagion('c2', 'h2', 'verole-urticante')]);
    expect(une).toHaveLength(1);
    expect(une[0].participants!.map((r) => r.id)).toEqual(['h1', 'h2']);
    expect(une[0].menace, 'le tag Menace de la Résistance (LDB 10) survit à la bande').toBe('maladie');
  });

  it('CHEMIN RÉEL : un compagnon contagieux ouvre UNE fenêtre de Contagion, une rangée par héros sain', () => {
    const sick = contractDisease('verole-urticante', { int: () => 1 } as never, { incubation: 0, duration: 5 })!;
    set({ party: [h('m1', { diseases: [sick] }), h('s1'), h('s2')], scene: emptyScene(6, 6) } as never);
    get().openRest({ places: { camp: true } });
    for (const id of ['m1', 's1', 's2']) get().restSet(id, { food: 'rien' });
    get().restSleep();

    const cont = bandsOf('contagion');
    expect(cont).toHaveLength(1);
    expect(cont[0].participants!.map((r) => r.id).sort()).toEqual(['s1', 's2']);
  });
});

/**
 * Le `kind` 'exposure' a TROIS producteurs (nuit de repos, effet de scène `exposureNight`, entretien
 * de mer) et UN SEUL applier — d'escalade cumulative (LDB 18 l.330/334). Si l'un d'eux restait MONO,
 * l'applier de bande RENONCERAIT sur ses étapes : jets lancés, aucune conséquence, en silence (le
 * sinistre du migrateur psy). Garde STRUCTURELLE : tout FICHIER qui construit une étape d'Exposition
 * mentionne la fabrique de vagues.
 * PORTÉE MESURÉE — le détecteur est à granularité FICHIER, pas SITE : il ne voit que le littéral
 * `kind: 'exposure'` et la simple PRÉSENCE de `exposureWaveBand` dans le même fichier. Un SECOND site
 * d'Exposition ajouté dans un fichier déjà conforme (ex. un 2ᵉ montage dans `restFlow.ts`) passerait
 * donc MUET ici ; ce qui le rattraperait est le comportement, mesuré par les tests de bout en bout.
 */
describe('les TROIS producteurs d’Exposition passent par la MÊME fabrique de vagues', () => {
  it('aucun site ne construit d’étape `exposure` sans `exposureWaveBand`', () => {
    const root = join(fileURLToPath(new URL('.', import.meta.url)), '..');
    const walk = (dir: string, out: string[] = []): string[] => {
      for (const e of readdirSync(dir)) {
        const p = join(dir, e);
        if (statSync(p).isDirectory()) walk(p, out);
        else if (/\.tsx?$/.test(e) && !/\.test\.tsx?$/.test(e)) out.push(p);
      }
      return out;
    };
    const producteurs = walk(root)
      .filter((f) => /kind: 'exposure'/.test(readFileSync(f, 'utf-8')))
      .map((f) => f.replace(/\\/g, '/').slice(f.replace(/\\/g, '/').indexOf('/src/') + 1));
    expect(producteurs.sort(), 'le stock de producteurs a bougé — vérifier que le nouveau passe par la fabrique')
      .toEqual(['src/state/combatEffects.ts', 'src/state/restFlow.ts', 'src/state/seaVoyageFlow.ts']);
    const sansFabrique = producteurs.filter((rel) => !readFileSync(join(root, '..', rel), 'utf-8').includes('exposureWaveBand'));
    expect(sansFabrique, `producteur d’Exposition hors fabrique :\n${sansFabrique.join('\n')}`).toEqual([]);
  });
});

describe('file de fin de combat — SCISSION par pilote (invariant 7)', () => {
  it('`splitBandRows` rend DEUX bandes entières, aucune rangée `interactive:false` dans la jouée', () => {
    const band: CascadeStep = {
      id: 'bande-faim', kind: 'faim', label: 'Faim', interactive: true, aggregate: 'none',
      participants: [
        { id: 'manuel', interactive: true, label: 'Résistance', base: 40, target: 40, result: null },
        { id: 'temoin', interactive: true, label: 'Résistance', base: 35, target: 35, result: null },
      ],
    };
    const { kept, others } = splitBandRows(band, (id) => id === 'manuel');
    expect(kept!.participants!.map((r) => r.id)).toEqual(['manuel']);
    expect(others!.participants!.map((r) => r.id)).toEqual(['temoin']);
    expect(kept!.participants!.every((r) => r.interactive !== false)).toBe(true);
    expect(others!.participants!.every((r) => r.interactive !== false)).toBe(true);
    expect(others!.id).not.toBe(kept!.id); // deux étapes DISTINCTES, jamais le même id dans la séquence
  });

  it('fin de combat : le témoin HORS D’ACTION voit sa conséquence appliquée d’office, le manuel garde son jet', () => {
    const manuel = h('manuel', { hunger: { days: 2, tests: 0, failures: 0 } });
    const temoin = h('temoin', { hunger: { days: 2, tests: 0, failures: 0 } });
    addCondition(temoin, 'inconscient', 1); // hors d'action → jamais un jet à influencer
    const ennemi = { id: 'e', kind: 'enemy', label: 'Bandit', characteristics: { endurance: 30 } as never,
      wounds: { current: 0, max: 10 }, dead: true, conditions: [], skills: [], items: [], weapons: [], movement: 4, advantage: 0 } as unknown as Combatant;
    const queue = nightBands([
      { id: 'faim-manuel-0', kind: 'faim', actorId: 'manuel', label: 'Faim', rollLabel: 'Résistance', base: 40, difficulty: 'intermediaire', target: 40, result: null, interactive: true, meta: { day: 1 } },
      { id: 'faim-temoin-1', kind: 'faim', actorId: 'temoin', label: 'Faim', rollLabel: 'Résistance', base: 35, difficulty: 'intermediaire', target: 35, result: null, interactive: true, meta: { day: 1 } },
    ]);
    expect(queue).toHaveLength(1); // une SEULE fenêtre est mise en file (même règle, même jour)
    set({
      party: [manuel, temoin],
      battle: { combatants: [{ ...manuel }, { ...temoin }, ennemi], order: ['manuel', 'temoin', 'e'], turn: 0, round: 1, log: [], over: null } as never,
      deferredUpkeepQueue: queue, pendingCascade: null, pendingVictory: null,
    } as never);

    expect(checkBattleOver(get, set)).toBe(true);
    expect(get().deferredUpkeepQueue).toHaveLength(0); // file consommée
    const faim = (get().pendingCascade?.participants ?? []).filter((s) => s.kind === 'faim');
    expect(faim).toHaveLength(1);
    expect(faim[0].participants!.map((r) => r.id), 'seul le pilote manuel joue son jet').toEqual(['manuel']);
    // Le témoin, lui, a bien SUBI son Test (résolu d'office dans sa propre bande) — jamais un silence.
    expect(get().party.find((c) => c.id === 'temoin')!.hunger!.tests).toBe(1);
    expect(get().party.find((c) => c.id === 'manuel')!.hunger!.tests).toBe(0);
  });

  /** SONDE A — FAIL-OPEN : une étape que la fabrique REFUSE de bander (kind hors vocabulaire de nuit)
   *  ne doit pas se dissoudre dans la scission de rangées. `splitBandRows` rendrait `{}` sur elle : la
   *  file étant VIDÉE dans le même geste, l'étape — et sa conséquence — disparaîtraient en silence. */
  it('SONDE A : une étape NON bandable de la file survit (chemin d’origine), jamais dissoute par la scission', () => {
    const manuel = h('manuel');
    const ennemi = { id: 'e', kind: 'enemy', label: 'Bandit', characteristics: { endurance: 30 } as never,
      wounds: { current: 0, max: 10 }, dead: true, conditions: [], skills: [], items: [], weapons: [], movement: 4, advantage: 0 } as unknown as Combatant;
    // `combatEndDisease` n'est PAS un `NightTestKind` → `nightBands` la laisse passer INTACTE.
    const etrangere: CascadeStep = {
      id: 'combatEndDisease-manuel-x', kind: 'combatEndDisease', actorId: 'manuel', label: 'Résistance',
      rollLabel: 'Résistance', base: 40, difficulty: 'intermediaire', target: 40, result: null,
      interactive: true, meta: { disease: 'courante-galopante' },
    };
    expect(nightBands([etrangere])[0]).toBe(etrangere); // garde du prémisse : elle traverse la fabrique telle quelle
    set({
      party: [manuel],
      battle: { combatants: [{ ...manuel }, ennemi], order: ['manuel', 'e'], turn: 0, round: 1, log: [], over: null } as never,
      deferredUpkeepQueue: [etrangere], pendingCascade: null, pendingVictory: null,
    } as never);

    expect(checkBattleOver(get, set)).toBe(true);
    const vues = (get().pendingCascade?.participants ?? []).filter((s) => s.kind === 'combatEndDisease');
    expect(vues, 'l’étape non bandable a disparu de la file ET de la cascade').toHaveLength(1);
    expect(vues[0].id).toBe('combatEndDisease-manuel-x');
  });
});

/**
 * SONDE B — les ids de BANDE doivent rester uniques dans une séquence : deux insertions issues du
 * MÊME `step.id` (la gueule de bois `dessoulageHangover-<héros>` de deux Dessoûlages) proviennent de
 * DEUX appels distincts à la fabrique, qui ne peut donc pas les dédoublonner entre elles — c'est le
 * DISCRIMINANT de clé porté par l'id (le jour, sinon le rang) qui les sépare.
 */
describe('SONDE B — ids de bande UNIQUES dans la séquence', () => {
  it('deux jours de Dessoûlage → deux bandes de gueule de bois aux ids DISTINCTS', () => {
    set({ party: [h('h1', { drunk: { failedTests: 3, drunk: true } })] } as never);
    get().advanceTime(2 * MINUTES_PER_DAY);
    expect(bandsOf('dessoulage')).toHaveLength(2);

    // Déroule TOUTE la séquence (chaque Dessoûlage INSÈRE sa gueule de bois derrière lui) en relevant
    // les fenêtres traversées : les insertions viennent de DEUX appels distincts à la fabrique.
    const vus: { kind: string; id: string }[] = [];
    let guard = 0;
    while (get().pendingCascade && guard++ < 30) {
      const p = get().pendingCascade!;
      const cur = p.participants[p.cursor];
      vus.push({ kind: cur.kind, id: String(cur.id) });
      const rows = cur.participants!.map((r) => ({ ...r, result: { roll: 50, target: r.target, sl: 0, success: true } }));
      set({ pendingCascade: { ...p, participants: p.participants.map((s, k) => (k === p.cursor ? { ...s, participants: rows } : s)) } });
      get().cascadeNext();
    }

    const hangovers = vus.filter((v) => v.kind === 'dessoulageHangover');
    expect(hangovers, 'chaque Dessoûlage doit sa gueule de bois (LDB 09 l.485)').toHaveLength(2);
    const ids = vus.map((v) => v.id);
    const doublons = ids.filter((id, i) => ids.indexOf(id) !== i);
    expect(doublons, `ids de bande DUPLIQUÉS dans la séquence : ${doublons.join(',')}`).toEqual([]);
  });
});

/**
 * SONDE D — Exposition BOUT EN BOUT sur le store (le cycle que ni l'unité ni le chemin de repos ne
 * jouent en entier) : bande de vague 0 à DEUX rangées → une seule offre un délestage (LDB 18 l.332,
 * seul h1 porte une Possession lourde) → « jeter » ANNULE l'échec de h1 et déclenche la construction
 * de la vague 1 → l'escalade y vaut 0 pour h1 (annulé) et 1 pour h2.
 */
describe('SONDE D — Exposition (chaleur) de bout en bout : drop → cancelsRowId → vague N+1', () => {
  it('la vague 1 porte priorFails { h1: 0, h2: 1 } — l’échec annulé ne compte que pour son porteur', () => {
    const heavy = { uid: 'sac', trappingId: 'grand-sac', label: 'Grand sac à dos', kind: 'misc', qualities: [], equipped: true, enc: 3 } as never;
    const h1 = h('h1'); h1.items = [heavy];
    const h2 = h('h2'); h2.items = [];
    set({ party: [h1, h2], pendingCascade: null, journal: [] } as never);
    applyEffects(get, set, [{ type: 'exposureNight', kind: 'chaleur', count: 2, target: 'party' }]);

    const wave0 = get().pendingCascade!.participants[0];
    expect(wave0.participants!.map((r) => r.id)).toEqual(['h1', 'h2']);
    expect(wave0.meta?.waves).toBe(2);
    // Les DEUX ratent leur Test.
    const p = get().pendingCascade!;
    const rows = wave0.participants!.map((r) => ({ ...r, result: { roll: 99, target: r.target, sl: -5, success: false } }));
    set({ pendingCascade: { ...p, participants: p.participants.map((s, k) => (k === p.cursor ? { ...s, participants: rows } : s)) } });
    get().cascadeNext();

    // UN SEUL délestage inséré (h2 n'a rien de lourd à jeter — sa conséquence est immédiate).
    const cur = () => { const c = get().pendingCascade!; return c.participants[c.cursor]; };
    expect(cur().kind).toBe('exposure-heat-drop');
    expect(cur().actorId).toBe('h1');
    expect(cur().meta?.cancelsRowId).toBe(`${wave0.id}:h1`);
    get().cascadeChoose(cur().id, 'jeter');
    get().cascadeNext();

    const wave1 = cur();
    expect(wave1.kind).toBe('exposure');
    expect(wave1.meta?.wave).toBe(1);
    expect(Object.fromEntries(wave1.participants!.map((r) => [r.id, r.meta?.priorFails])))
      .toEqual({ h1: 0, h2: 1 }); // h1 : échec ANNULÉ par le délestage ; h2 : échec bien compté
    expect(get().party.find((c) => c.id === 'h1')!.items).toHaveLength(0); // la Possession a bien été jetée
  });
});
