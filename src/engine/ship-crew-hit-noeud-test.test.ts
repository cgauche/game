/**
 * #1657 B2c — le coup à l'ÉQUIPAGE d'un Critique de coque porte son JET dans le nœud `test` du Flow.
 *
 * Contrat POSITIF, mesuré sur la donnée RÉELLE (`river-criticals.json`, `ship-criticals.json`) :
 *  1. le nœud est LU par la grammaire partagée — `noeudTest(flowSchema, { difficulteRequise: true,
 *     echecSeulServi: true })` accepte les nœuds de la base, et REFUSE nominativement un nœud sans
 *     `difficulty`, un nœud à branche de réussite peuplée, un nœud à `fail` embranché ;
 *  2. le porteur ne garde que ce qu'il DÉCRIT — QUI encaisse (`crewTarget`) ; il ne redit ni le
 *     sujet du jet, ni sa Difficulté, ni la conséquence ;
 *  3. un coup SANS jet n'est pas une épreuve : il porte `ops` (MSRC 07 l.82), et le XOR
 *     `test` ⊕ `ops` est verrouillé par le schéma ;
 *  4. INVARIANCE : `applyCrewHit` rend, sur 40 seeds × chaque porteur RÉEL, exactement ce que
 *     rendait le lecteur d'AVANT la migration — mêmes victimes, mêmes Blessures, et le MÊME nombre
 *     de tirages consommés dans le MÊME ordre. Le lecteur d'avant est transcrit VERBATIM ici et
 *     nourri par la DÉ-MIGRATION de la donnée committée : aucune fixture figée, aucune valeur
 *     recopiée à la main.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { applyCrewHit, exposedCrew } from './shipCritical';
import { applyOps, type GameOp } from './ops';
import { rollTest } from './tests';
import { testValue } from './skills';
import { spellOps } from './flowCore';
import { makeRNG, type RNG } from './dice';
import type { Combatant, ShipPoste, CharKey, Difficulty } from './types';
import type { SkillRef } from './skills';
import type { ShipCrewHit, ShipCritEntry } from '../data/shipCriticals';
import { shipCrewHitSchema, flowSchema, noeudTest } from '../data/schemas/grammaire/mecanique';

const DATA = join(fileURLToPath(new URL('.', import.meta.url)), '..', 'data');
const lire = (f: string) => JSON.parse(readFileSync(join(DATA, f), 'utf8')) as { tables: Record<string, ShipCritEntry[]> };
const FICHIERS = ['river-criticals.json', 'ship-criticals.json'] as const;

/** LE schéma du PORTEUR, celui que `shipCritEntrySchema` compose — jamais une recomposition locale :
 *  une option perdue dans `grammaire/mecanique.ts` doit rougir ICI. */
const schemaDuCoup = shipCrewHitSchema;

/** Les porteurs de coup, LUS dans la donnée — jamais une liste d'ids écrite ici. */
const coups = () =>
  FICHIERS.flatMap((f) =>
    Object.values(lire(f).tables)
      .flat()
      .filter((e) => e.crewHit)
      .map((e) => ({ fichier: f, id: e.id, hit: e.crewHit! })),
  );

/** Marin minimal — assez pour `testValue` (Ag/I) + `applyOps` wounds (BE=3, PA=0). */
const sailor = (id: string, over: Partial<Combatant> = {}): Combatant =>
  ({
    id, name: id, kind: 'npc',
    characteristics: { 'capacite-de-combat': 31, 'capacite-de-tir': 31, force: 31, endurance: 31, initiative: 42, agilite: 36, dexterite: 36, intelligence: 31, 'force-mentale': 31, sociabilite: 36 },
    skills: [], talents: [], traits: [], conditions: [], activeEffects: [], liveTraits: [], weapons: [],
    armour: { corps: 0 }, wounds: { current: 40, max: 40, base: 40 }, advantage: 0, ...over,
  }) as unknown as Combatant;

const coqueAvecPostes = (crewIds: string[]): Combatant => {
  const poste: ShipPoste = { item: { uid: 'p1', name: 'Canon' } as never, side: 'tribord', crewIds };
  return { id: 'hull', postes: [poste, { ...poste, item: { uid: 'p2', name: 'Pierrier' } as never, side: 'babord' }] } as unknown as Combatant;
};

/** RNG qui COMPTE ses tirages — l'ordre de consommation est le vrai gate du train. */
function rngCompteur(seed: number): RNG & { tirages: number[] } {
  const base = makeRNG(seed);
  const tirages: number[] = [];
  return {
    tirages,
    int: (min: number, max: number) => {
      const v = base.int(min, max);
      tirages.push(v);
      return v;
    },
  } as RNG & { tirages: number[] };
}

/** La graphie PROPRIÉTAIRE d'avant la migration, telle que la donnée la portait. */
type CrewTestAvant = { skill?: SkillRef; char?: CharKey; difficulty?: Difficulty; crewTarget?: 'poste' | 'deck'; onFail: GameOp[] };

/** DÉ-MIGRATION : le `crewHit` committé rendu à sa graphie d'avant — la source du lecteur de référence. */
function demigrer(hit: ShipCrewHit): CrewTestAvant {
  const n = hit.test;
  return {
    ...(n?.test.skill ? { skill: n.test.skill } : {}),
    ...(n?.test.characteristic ? { char: n.test.characteristic } : {}),
    ...(n?.test.difficulty ? { difficulty: n.test.difficulty } : {}),
    ...(hit.crewTarget ? { crewTarget: hit.crewTarget } : {}),
    onFail: n ? spellOps(n.fail, 'target') : hit.ops ?? [],
  };
}

/** Équipage EXPOSÉ d'un poste tiré au sort — transcription VERBATIM de `posteCrew` d'avant le lot. */
function posteCrewAvant(hull: Combatant, crew: Combatant[], rng: RNG): Combatant[] {
  const postes = hull.postes;
  if (!postes?.length) return [];
  const poste = postes[rng.int(0, postes.length - 1)];
  return (poste.crewIds ?? [])
    .map((id) => crew.find((c) => c.id === id))
    .filter((c): c is Combatant => !!c && !c.dead && (c.wounds?.current ?? 0) > 0);
}

/** `applyCrewHit` d'AVANT la migration — transcription VERBATIM du lecteur de `1e14c9922`. */
function applyCrewHitAvant(hull: Combatant, crew: Combatant[], crewTest: CrewTestAvant, rng: RNG): { crewId: string }[] {
  const victims = crewTest.crewTarget === 'deck' ? exposedCrew(crew) : posteCrewAvant(hull, crew, rng);
  const hits: { crewId: string }[] = [];
  for (const sailorC of victims) {
    const fails = (crewTest.skill || crewTest.char) && crewTest.difficulty
      ? !rollTest(testValue(sailorC, crewTest.skill?.id, crewTest.char, crewTest.skill?.spec), crewTest.difficulty, rng).success
      : true;
    if (fails) {
      applyOps(sailorC, crewTest.onFail, { rng });
      hits.push({ crewId: sailorC.id });
    }
  }
  return hits;
}

describe('coup à l’équipage — le JET vit dans le nœud `test` du Flow (#1657 B2c)', () => {
  it('les porteurs sont LUS par la grammaire partagée, et chacun dit ce qu’il est', () => {
    const tous = coups();
    expect(tous.length, 'la sonde mesure quelque chose').toBe(4);
    expect(tous.filter((c) => c.hit.test).map((c) => c.id)).toEqual(['greement-fluvial', 'superstructure-fluvial', 'canon-detache']);
    // MSRC 07 l.82 : « les échardes infligent +5 Dégâts aux rameurs » — aucun Test appelé, donc pas de nœud.
    expect(tous.filter((c) => c.hit.ops).map((c) => c.id)).toEqual(['rames-fluvial']);

    for (const { fichier, id, hit } of tous) {
      expect(Boolean(hit.test) !== Boolean(hit.ops), `${fichier}/${id} : XOR test ⊕ ops rompu`).toBe(true);
      if (!hit.test) continue;
      expect(schemaDuCoup.safeParse(hit).success, `${fichier}/${id} : porteur refusé par la grammaire`).toBe(true);
      // Le PORTEUR ne redit rien du jet : ni sujet, ni Difficulté, ni conséquence.
      expect(Object.keys(hit).filter((k) => k !== 'test' && k !== 'crewTarget'), `${fichier}/${id}`).toEqual([]);
      // La branche de RÉUSSITE est vide : `applyCrewHit` ne sert que l'échec.
      expect(spellOps(hit.test.success, 'target'), `${fichier}/${id} : branche success peuplée`).toEqual([]);
      expect(spellOps(hit.test.fail, 'target').length, `${fichier}/${id} : branche fail vide`).toBeGreaterThan(0);
    }
  });

  it('le SCHÉMA DU PORTEUR refuse ce que le moteur ne saurait pas jouer (difficulté absente, réussite peuplée, échec embranché, XOR rompu)', () => {
    const porteur = coups().find((c) => c.hit.test)!.hit;
    const noeud = porteur.test!;
    const avec = (n: unknown) => ({ ...porteur, test: n });
    // La branche de RÉUSSITE peuplée et l'ÉCHEC EMBRANCHÉ sont des charges VALIDES en soi : seul le
    // resserrement `echecSeulServi` les refuse. On le PROUVE en les repassant au contrat NON resserré
    // (patron `disease-noeud-test.test.ts`) — sans quoi une charge malformée rendrait l'assertion VACUE.
    const sansEchecSeul = noeudTest(flowSchema, { difficulteRequise: true });
    const reussitePeuplee = { ...noeud, success: noeud.fail };
    const echecEmbranche = { ...noeud, fail: { kind: 'if', cond: { kind: 'flag', expr: 'x' }, then: noeud.fail } };
    expect(sansEchecSeul.safeParse(reussitePeuplee).success, 'la charge « réussite peuplée » est INVALIDE en soi — l’assertion serait vacue').toBe(true);
    expect(sansEchecSeul.safeParse(echecEmbranche).success, 'la charge « échec embranché » est INVALIDE en soi — l’assertion serait vacue').toBe(true);

    expect(schemaDuCoup.safeParse(avec({ ...noeud, test: { ...noeud.test, difficulty: undefined } })).success, 'un nœud sans Difficulté passe').toBe(false);
    expect(schemaDuCoup.safeParse(avec(reussitePeuplee)).success, 'une branche de réussite peuplée passe').toBe(false);
    expect(schemaDuCoup.safeParse(avec(echecEmbranche)).success, 'un échec embranché passe').toBe(false);
    expect(schemaDuCoup.safeParse({ ...porteur, ops: [] }).success, 'un porteur à la fois épreuve ET certain passe').toBe(false);
    expect(schemaDuCoup.safeParse({ crewTarget: 'deck' }).success, 'un porteur sans aucune issue passe').toBe(false);
  });

  it('INVARIANCE — 40 seeds × chaque porteur RÉEL : victimes, Blessures et FLUX de tirages identiques au lecteur d’avant', () => {
    for (const { fichier, id, hit } of coups()) {
      const avant = demigrer(hit);
      for (let seed = 1; seed <= 40; seed++) {
        const ids = ['m1', 'm2', 'm3'];
        const equipageA = ids.map((i) => sailor(i));
        const equipageB = ids.map((i) => sailor(i));
        const rngA = rngCompteur(seed);
        const rngB = rngCompteur(seed);

        const hitsA = applyCrewHitAvant(coqueAvecPostes(ids), equipageA, avant, rngA);
        const hitsB = applyCrewHit(coqueAvecPostes(ids), equipageB, hit, rngB);

        expect(hitsB, `${fichier}/${id} seed ${seed} : victimes`).toEqual(hitsA);
        expect(equipageB.map((c) => c.wounds.current), `${fichier}/${id} seed ${seed} : Blessures`).toEqual(equipageA.map((c) => c.wounds.current));
        expect(rngB.tirages, `${fichier}/${id} seed ${seed} : FLUX de tirages`).toEqual(rngA.tirages);
      }
    }
  });
});
