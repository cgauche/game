import { describe, it, expect } from 'vitest';
import { verifieExhaustiviteDesIds, idsDuDataset } from '../../../scripts/gen-registry.mjs';

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

/**
 * EXTRACTION des ids (`idsDuDataset`) sur la forme RECORD, avant et après l'enveloppe
 * (#1467 L1b V-FLIP-RECORD). Un record enveloppé porte sa carte sous `entries` : ce sont SES clés qui
 * sont des ids de premier niveau, jamais `id`/`type`/`label`/`entries`. Les trois fixtures sont les
 * coins de ce bras — clés-ids (le registre les prend), clés camelCase (aucun id : le défaut nominatif
 * reste exigé), record NU à racine plate (ses clés de racine SONT les ids).
 */
describe('extraction des ids — record enveloppé sous `entries` (#1467 L1b V-FLIP-RECORD)', () => {
  const enveloppe = (entries: Record<string, unknown>) => ({ id: 'sonde', type: 'sonde', label: 'Sonde', entries });

  it('record ENVELOPPÉ à clés-ids : les clés d’`entries` entrent au registre, et aucun défaut n’est exigé', () => {
    const ids = idsDuDataset(enveloppe({ 'zone-marche': '#111111', 'anneau-actif': '#222222' }), 'record');
    expect(ids).toEqual(['anneau-actif', 'zone-marche']);
    expect(() => verifieExhaustiviteDesIds(new Set(['r.json']), familles({ 'r.json': 'record' }), {})).not.toThrow();
  });

  it('record ENVELOPPÉ à clés camelCase : aucun id — le défaut nominatif reste la seule voie', () => {
    expect(idsDuDataset(enveloppe({ terreTresSombre: '#333333', boisMoyen: '#444444' }), 'record')).toBeNull();
    expect(() => verifieExhaustiviteDesIds(new Set(), familles({ 'r.json': 'record' }), {})).toThrow(
      /r\.json \(famille record\) : aucun id au registre et aucune entrée de DEFAUTS_IDS\./,
    );
    expect(() =>
      verifieExhaustiviteDesIds(new Set(), familles({ 'r.json': 'record' }), { 'r.json': 'clés camelCase' }),
    ).not.toThrow();
  });

  it('record NU (forme d’avant le flip) : les clés de RACINE restent les ids', () => {
    expect(idsDuDataset({ 'zone-marche': '#111111', 'anneau-actif': '#222222' }, 'record')).toEqual([
      'anneau-actif',
      'zone-marche',
    ]);
  });

  it('l’enveloppe SEULE n’est jamais un record à ids (`id`+`label` de racine = UN document)', () => {
    expect(idsDuDataset(enveloppe({ 'zone-marche': '#111111' }), 'entite')).toBeNull();
  });
});
