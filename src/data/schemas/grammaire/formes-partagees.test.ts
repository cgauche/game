/**
 * `trappingRefSchema` (`src/data/schemas/grammaire/reference.ts`) — branche `{creatureId}` ouverte au SOCLE
 * POSSESSIONS #615/#617 §9 (dotation BÊTE, `creatures.json`), en plus des branches existantes.
 */
import { describe, it, expect } from 'vitest';
import { z } from 'zod';
import { trappingRefSchema } from './reference';
import { flowTestSchema, gameOpSchema } from './mecanique';
import { TESTS_DE_CORRUPTION, plageSchema } from './valeurs';
import { validateDataset } from '../validate';
import criticals from '../../criticals.json';
import aaCriticals from '../../aa-criticals.json';
import localisation from '../../localisation.json';
import structureCriticals from '../../structure-criticals.json';
import riverCriticals from '../../river-criticals.json';
import shipCriticals from '../../ship-criticals.json';
import waterExposure from '../../water-exposure.json';
import mutationTables from '../../mutationTables.json';
import obsessions from '../../obsessions.json';
import miscast from '../../miscast.json';
import arcanePhenomena from '../../arcane-phenomena.json';
import ventsTourbillonnants from '../../vents-tourbillonnants.json';
import tables from '../../tables.json';
import interludeEvents from '../../interludeEvents.json';
import drunkenness from '../../drunkenness.json';
import weather from '../../weather.json';
import tavernGames from '../../tavernGames.json';
import { corruptionExposureSchema } from '../defs-scenes/effets';
import { menaceIds } from '../../../engine/menace';
import { resolveTrappingChoices } from '../../../engine/trappingChoices';
import { trappingRefLabel, type TrappingRef } from '../../index';

describe('trappingRefSchema — branches de TrappingRef', () => {
  it('accepte {id} de catalogue (+ count optionnel)', () => {
    expect(trappingRefSchema.safeParse({ id: 'epee-courte' }).success).toBe(true);
    expect(trappingRefSchema.safeParse({ id: 'epee-courte', count: { fixed: 2 } }).success).toBe(true);
  });

  it('accepte {text} narratif hors catalogue', () => {
    expect(trappingRefSchema.safeParse({ text: 'collection d’alcool sans pareille' }).success).toBe(true);
  });

  it('accepte {vehicleId} — dotation véhicule', () => {
    expect(trappingRefSchema.safeParse({ vehicleId: 'chariot-leger' }).success).toBe(true);
  });

  it('accepte {creatureId} — dotation bête (#615/#617 §9)', () => {
    expect(trappingRefSchema.safeParse({ creatureId: 'mule' }).success).toBe(true);
    expect(trappingRefSchema.safeParse({ creatureId: 'mule', count: { fixed: 1 } }).success).toBe(true);
  });

  it('refuse un mélange de branches (strictObject)', () => {
    expect(trappingRefSchema.safeParse({ id: 'epee-courte', vehicleId: 'chariot-leger' }).success).toBe(false);
    expect(trappingRefSchema.safeParse({ creatureId: 'mule', vehicleId: 'chariot-leger' }).success).toBe(false);
  });

  it('accepte {choice} — dotation « X ou Y » migrée (chantier #654 Lot 3)', () => {
    const ref = { choice: [{ id: 'arbalete-de-poing' }, { id: 'pistolet' }] };
    expect(trappingRefSchema.safeParse(ref).success).toBe(true);
  });

  it('{choice} migré (Arbalète de poing ou pistolet) résout la 2e branche via resolveTrappingChoices', () => {
    const ref: TrappingRef = { choice: [{ id: 'arbalete-de-poing' }, { id: 'pistolet' }] };
    const label = trappingRefLabel(ref);
    expect(resolveTrappingChoices([ref], { [label]: trappingRefLabel({ id: 'pistolet' }) })).toEqual([
      { id: 'pistolet' },
    ]);
  });
});

/**
 * `plageSchema` (`grammaire/valeurs.ts`, vague `plage` #1463 P1) — les deux bornes d'une rangée de
 * table de tirage se déclarent UNE fois et se composent par la SHAPE. Le spread est un ANGLE MORT du
 * scanner de redéclarations (`scripts/docs/lib/structures-scan.mts` lit les littéraux par AST et ne
 * résout pas un spread, cf. `grammaire/reference.ts:37-38`) : l'extinction d'une ligne de stock ne
 * prouve donc RIEN sur le parse. Ce gate est POSITIF — il mesure que la garde des bornes tient
 * encore, au schéma partagé ET à chaque site adoptant, par la porte de validation réelle
 * (`validateDataset`).
 */
describe('plageSchema — fourchette PARTAGÉE des rangées de table', () => {
  const CHARGE = { min: 1, max: 10 };

  it('accepte les deux bornes, et REFUSE une rangée sans `min` / sans `max` — message NOMMANT la borne', () => {
    expect(plageSchema.safeParse(CHARGE).success).toBe(true);
    for (const borne of ['min', 'max'] as const) {
      const { [borne]: _absente, ...ampute } = CHARGE;
      const r = plageSchema.safeParse(ampute);
      expect(r.success, `une rangée sans \`${borne}\` a été ACCEPTÉE`).toBe(false);
      expect(r.error!.issues.map((i) => i.path.join('.')), `l'issue ne nomme pas \`${borne}\``).toContain(borne);
    }
  });

  it('reste STRICT après composition par SHAPE — une clé inconnue est refusée', () => {
    const etendu = z.strictObject({ ...plageSchema.shape, mutation: plageSchema.shape.min });
    expect(etendu.safeParse({ ...CHARGE, mutation: 3 }).success).toBe(true);
    expect(etendu.safeParse({ ...CHARGE, mutation: 3, inconnue: 1 }).success).toBe(false);
    expect(etendu.safeParse({ ...CHARGE }).success).toBe(false); // la charge utile reste requise
  });

  /** Position d'un jeu de taverne par son ID (jamais par sa place : la donnée est réordonnable au Codex). */
  const jeuDeTaverne = (id: string) => String((tavernGames as ReadonlyArray<{ id: string }>).findIndex((j) => j.id === id));

  /**
   * Chaque document ADOPTANT est mesuré sur SA donnée réelle : on ampute la première rangée à deux
   * bornes de son `min`, et la porte doit refuser en nommant le CHEMIN de la borne. Une composition
   * débranchée (spread perdu, borne rendue optionnelle) laisserait passer.
   */
  const SITES: ReadonlyArray<readonly [string, unknown, string[]?]> = [
    ['criticals.json', criticals],
    ['aa-criticals.json', aaCriticals],
    ['localisation.json', localisation],
    ['structure-criticals.json', structureCriticals],
    ['river-criticals.json', riverCriticals],
    ['ship-criticals.json', shipCriticals],
    // Descente EXPLICITE : `modifiers[].auto` porte aussi deux bornes (`{kind:'woundsLost', op:'between'}`),
    // mais ce sont des bornes de BLESSURES PERDUES dans une condition — pas une rangée de table de
    // tirage, donc hors composition. La table lue par `findTableEntry` est `diseases`.
    ['water-exposure.json', waterExposure, ['diseases']],
    ['mutationTables.json', mutationTables],
    ['obsessions.json', obsessions],
    ['miscast.json', miscast],
    ['arcane-phenomena.json', arcanePhenomena],
    ['vents-tourbillonnants.json', ventsTourbillonnants],
    ['tables.json', tables],
    ['interludeEvents.json', interludeEvents],
    ['drunkenness.json', drunkenness],
    ['weather.json', weather],
    // Deux sites de rangée y composent (`table` d'un jeu à score par plage, `pot.rows` d'un jeu à mises) ;
    // sans descente, le parcours tomberait sur `pot.targetRange` — la plage adoptée NUE en P1-a.
    ['tavernGames.json', tavernGames, [jeuDeTaverne('torchon'), 'table']],
    ['tavernGames.json', tavernGames, [jeuDeTaverne('al-zahr'), 'pot', 'rows']],
  ];

  /** Chemin de la PREMIÈRE rangée `{min, max}` numériques rencontrée en parcours stable. */
  const premiereFourchette = (v: unknown, chemin: string[] = []): string[] | null => {
    if (Array.isArray(v)) {
      for (const [i, e] of v.entries()) {
        const t = premiereFourchette(e, [...chemin, String(i)]);
        if (t) return t;
      }
      return null;
    }
    if (v && typeof v === 'object') {
      const o = v as Record<string, unknown>;
      if (typeof o.min === 'number' && typeof o.max === 'number') return chemin;
      for (const [k, e] of Object.entries(o)) {
        const t = premiereFourchette(e, [...chemin, k]);
        if (t) return t;
      }
    }
    return null;
  };

  const ampute = (v: unknown, chemin: readonly string[]): unknown => {
    if (!chemin.length) {
      const { min: _min, ...reste } = v as Record<string, unknown>;
      return reste;
    }
    const [tete, ...suite] = chemin;
    if (Array.isArray(v)) return v.map((e, i) => (String(i) === tete ? ampute(e, suite) : e));
    return { ...(v as Record<string, unknown>), [tete]: ampute((v as Record<string, unknown>)[tete], suite) };
  };

  const descend = (v: unknown, chemin: readonly string[]) =>
    chemin.reduce<unknown>((acc, k) => (acc as Record<string, unknown>)[k], v);

  for (const [fichier, data, sous = []] of SITES) {
    it(`${fichier}${sous.length ? ` › ${sous.join('.')}` : ''} : sa donnée réelle passe, la MÊME rangée sans \`min\` est REFUSÉE`, () => {
      const relatif = premiereFourchette(descend(data, sous));
      const chemin = relatif && [...sous, ...relatif];
      expect(chemin, `aucune rangée {min,max} trouvée dans ${fichier}`).not.toBeNull();
      expect(validateDataset(fichier, data)).toBeNull();
      const err = validateDataset(fichier, ampute(data, chemin!));
      expect(err, `${fichier} accepte une rangée sans borne basse`).not.toBeNull();
      expect(err).toContain([...chemin!, 'min'].join('.'));
    });
  }
});

/**
 * `flowTestSchema.menace` (#1346) — CLÉ ÉTRANGÈRE vers un id de spec du talent « Résistance (Menace) »
 * (LDB 10 l.1016-1020). La liste est OUVERTE côté RAW : elle n'est donc PAS figée dans le code, elle
 * est résolue au catalogue (`talents.json`) à la VALIDATION. Un tag hors catalogue est refusé au
 * chargement DEV (`dev-validate`), au contrat CI (`schema-contract.test.ts`) et à la sauvegarde Codex.
 */
describe('flowTestSchema.menace — FK vers les specs du talent Résistance', () => {
  const parse = (menace?: string) => flowTestSchema.safeParse({ skill: { id: 'resistance' }, ...(menace != null ? { menace } : {}) });

  it('accepte un id de spec EXISTANT, et l’absence de tag', () => {
    for (const id of menaceIds()) expect(parse(id).success, `spec authorée « ${id} » refusée`).toBe(true);
    expect(parse().success).toBe(true); // un Test sans Menace reste valide
    expect(menaceIds().length).toBeGreaterThan(0); // le catalogue mesuré n'est pas vide
  });

  it('REFUSE le libellé capitalisé (« Poison ») — un id n’est pas un label', () => {
    const r = parse('Poison');
    expect(r.success).toBe(false);
    expect(r.error!.issues.map((i) => i.message).join('\n')).toContain('menace « Poison »');
  });

  it('REFUSE un id hors catalogue, et le message DIT la valeur ET les valeurs admises', () => {
    const r = parse('exposition');
    expect(r.success).toBe(false);
    const msg = r.error!.issues.map((i) => i.message).join('\n');
    expect(msg).toContain('menace « exposition »');
    expect(msg).toContain('resistance');
    for (const id of menaceIds()) expect(msg).toContain(id);
  });
});

/**
 * `corruptionExposure.skill` (`refTestDeCorruption`, `grammaire/valeurs.ts`) — le Test d'Exposition se
 * joue avec l'UNE des deux Compétences que la règle offre (`LDB 19 l.23-75`). Une référence de
 * Compétence NUE laisserait passer les 100+ entrées de `skills.json` : le runtime
 * (`state/corruptionFlow.ts`) les raboterait en silence et la donnée mentirait. Les DEUX portes du
 * même concept — l'op `GameOp` et l'effet de scène — partagent la MÊME borne.
 */
describe('corruptionExposure.skill — borné aux deux Compétences du Test (LDB 19 l.23-75)', () => {
  const portes = {
    'op GameOp': (skill?: { id: string }) => gameOpSchema.safeParse({ op: 'corruptionExposure', level: 'mineure', ...(skill ? { skill } : {}) }),
    'effet de scène': (skill?: { id: string }) => corruptionExposureSchema.safeParse({ type: 'corruptionExposure', level: 'mineure', ...(skill ? { skill } : {}) }),
  };

  for (const [nom, parse] of Object.entries(portes)) {
    it(`${nom} : accepte les deux Compétences de l'alphabet, et l'absence (choix du joueur)`, () => {
      expect(TESTS_DE_CORRUPTION).toEqual(['resistance', 'calme']);
      for (const id of TESTS_DE_CORRUPTION) expect(parse({ id }).success, `« ${id} » refusé`).toBe(true);
      expect(parse().success).toBe(true);
    });

    it(`${nom} : REFUSE une Compétence hors alphabet, et le message NOMME la valeur et la paire`, () => {
      const r = parse({ id: 'charme' });
      expect(r.success).toBe(false);
      const msg = r.error!.issues.map((i) => i.message).join('\n');
      expect(msg).toContain('charme');
      expect(msg).toContain('resistance');
      expect(msg).toContain('calme');
      expect(msg).toContain('LDB 19 l.23-75');
    });
  }
});
