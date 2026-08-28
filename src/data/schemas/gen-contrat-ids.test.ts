import { describe, it, expect } from 'vitest';
import { verifieExhaustiviteDesIds } from '../../../scripts/gen-registry.mjs';

/**
 * Contrat FERMÉ famille ⇄ registre d'ids (`scripts/gen-registry.mjs::verifieExhaustiviteDesIds`) —
 * le garde-fou du garde-fou. Le contrat existait depuis #1467 L1b SANS AUCUN TEST : sa seule mesure
 * était le `npm run gen` de l'arbre courant, qui ne prouve que le cas VERT du jour.
 *
 * Les fixtures ci-dessous sont les coins du contrat, sur des familles SIMULÉES (aucune lecture de
 * `defs/`, aucun `DEFAUTS_IDS` réel) : un document `table` À IDS passe ; un `table` sans ids ni
 * défaut échoue ; une `config` à ids échoue ; un défaut posé sur une `config` échoue ; un défaut
 * sans def de schéma échoue.
 */
const familles = (m: Record<string, string>) => new Map(Object.entries(m));

describe('contrat famille ⇄ registre d’ids (#1467 L1b)', () => {
  it('un document `table` dont les ids sont au registre PASSE', () => {
    expect(() => verifieExhaustiviteDesIds(new Set(['t.json']), familles({ 't.json': 'table' }), {})).not.toThrow();
  });

  it('un document `table` SANS ids au registre et SANS défaut nominatif ÉCHOUE', () => {
    expect(() => verifieExhaustiviteDesIds(new Set(), familles({ 't.json': 'table' }), {})).toThrow(
      /t\.json \(famille table\) : aucun id au registre et aucune entrée de DEFAUTS_IDS\./,
    );
  });

  it('un document `config` dont le registre indexe des ids ÉCHOUE', () => {
    expect(() => verifieExhaustiviteDesIds(new Set(['c.json']), familles({ 'c.json': 'config' }), {})).toThrow(
      /c\.json \(famille config\) : un document de réglage ne porte aucun id de premier niveau, or le registre en indexe\./,
    );
  });

  it('un défaut de DEFAUTS_IDS posé sur un document `config` ÉCHOUE', () => {
    expect(() => verifieExhaustiviteDesIds(new Set(), familles({ 'c.json': 'config' }), { 'c.json': 'raison' })).toThrow(
      /c\.json \(famille config\) : entrée de DEFAUTS_IDS sur un document qui n'attend aucun id\./,
    );
  });

  it('un document `entite` sans ids et sans défaut ÉCHOUE — la famille historique est jouée aussi', () => {
    expect(() => verifieExhaustiviteDesIds(new Set(), familles({ 'e.json': 'entite' }), {})).toThrow(
      /e\.json \(famille entite\) : aucun id au registre et aucune entrée de DEFAUTS_IDS\./,
    );
    // …et le cas VERT de la même famille, pour que le rouge ci-dessus ne vienne pas d'ailleurs.
    expect(() => verifieExhaustiviteDesIds(new Set(['e.json']), familles({ 'e.json': 'entite' }), {})).not.toThrow();
  });

  it('un document à ids au registre ET un défaut nominatif ÉCHOUE (les deux voies s’excluent)', () => {
    expect(() => verifieExhaustiviteDesIds(new Set(['e.json']), familles({ 'e.json': 'entite' }), { 'e.json': 'raison' })).toThrow(
      /e\.json : porte des ids au registre ET une entrée de DEFAUTS_IDS — retirer l'entrée\./,
    );
  });

  it('un défaut sans def de schéma ÉCHOUE (entrée fantôme)', () => {
    expect(() => verifieExhaustiviteDesIds(new Set(), familles({}), { 'fantome.json': 'raison' })).toThrow(
      /fantome\.json : entrée de DEFAUTS_IDS sans def de schéma\./,
    );
  });
});
