import { describe, it, expect, afterAll } from 'vitest';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { verifieExhaustiviteDesIds, idsDuDataset, discriminantsDeclares, marqueursDeclares, idsParMarqueur, lireDefs } from '../../../scripts/gen-registry.mjs';

/**
 * Contrat FERMÉ famille ⇄ registre d'ids (`scripts/gen-registry.mjs::verifieExhaustiviteDesIds`) —
 * le garde-fou du garde-fou. Le contrat existait depuis #1467 L1b SANS AUCUN TEST : sa seule mesure
 * était le `npm run gen` de l'arbre courant, qui ne prouve que le cas VERT du jour.
 *
 * Les fixtures ci-dessous sont les coins du contrat, sur des familles SIMULÉES (aucune lecture de
 * `defs/`, aucun `DEFAUTS_IDS` réel) : un document `record` À IDS passe ; un `record` sans ids ni
 * défaut échoue ; une `config` à ids échoue ; un défaut posé sur une `config` échoue ; un défaut
 * sans def de schéma échoue.
 */
const familles = (m: Record<string, string>) => new Map(Object.entries(m));

describe('contrat famille ⇄ registre d’ids (#1467 L1b)', () => {
  it('un document `record` dont les ids sont au registre PASSE', () => {
    expect(() => verifieExhaustiviteDesIds(new Set(['t.json']), familles({ 't.json': 'record' }), {})).not.toThrow();
  });

  it('un document `record` SANS ids au registre et SANS défaut nominatif ÉCHOUE', () => {
    expect(() => verifieExhaustiviteDesIds(new Set(), familles({ 't.json': 'record' }), {})).toThrow(
      /t\.json \(famille record\) : aucun id au registre et aucune entrée de DEFAUTS_IDS\./,
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

/**
 * LECTEUR UNIQUE des exports d'un def (`scripts/gen-registry.mjs › lireExports`) : un export absent est
 * un champ absent, un export présent hors de sa forme canonique fait LEVER la génération en nommant le
 * def et le champ. Fixtures sous `os.tmpdir()`, un dossier par def (une levée arrête la lecture du dossier).
 */
describe('lecteur des exports d’un def (#1897)', () => {
  const racine = mkdtempSync(join(tmpdir(), 'gen-registry-lecteur-'));
  afterAll(() => rmSync(racine, { recursive: true, force: true }));
  const dossierDe = (nom: string, src: string): string => {
    const dir = join(racine, nom);
    mkdirSync(dir);
    writeFileSync(join(dir, `${nom}.ts`), src);
    return dir;
  };

  it('la forme CANONIQUE se lit : `file`, `discriminant`, `marqueurs`', () => {
    const dir = dossierDe('canon', "export const file = 'a.json';\nexport const discriminant = 'domain';\nexport const marqueurs = ['volume', 'toit'];\n");
    expect(discriminantsDeclares(dir)).toEqual(new Map([['a.json', 'domain']]));
    expect(marqueursDeclares(dir)).toEqual(new Map([['a.json', ['volume', 'toit']]]));
  });

  it('une entrée PORTE le marqueur quand le champ est présent et autre que `false` (décochage au Codex)', () => {
    const racine = [{ id: 'coche', m: true }, { id: 'decoche', m: false }, { id: 'absent' }, { id: 'objet', m: { h: 1 } }];
    expect(idsParMarqueur(racine, ['m'], 'x.json')).toEqual({ m: ['coche', 'objet'] });
  });

  it('un export ABSENT est un champ absent, sans levée', () => {
    const dir = dossierDe('absent', "export const file = 'a.json';\n");
    expect(discriminantsDeclares(dir)).toEqual(new Map());
    expect(marqueursDeclares(dir)).toEqual(new Map());
    expect(lireDefs(dir, ['file', 'meta', 'chargeParDiscriminant'])).toEqual([{ module: 'absent.ts', file: 'a.json', meta: undefined, chargeParDiscriminant: undefined }]);
  });

  const horsForme: [string, string, string][] = [
    ['commentaire-discriminant', "export const file = 'b.json';\nexport const discriminant = 'domain'; // commentaire\n", 'discriminant'],
    ['commentaire-marqueurs', "export const file = 'b.json';\nexport const marqueurs = ['volume']; // commentaire\n", 'marqueurs'],
    ['asconst-discriminant', "export const file = 'c.json';\nexport const discriminant = 'domain' as const;\n", 'discriminant'],
    ['asconst-marqueurs', "export const file = 'c.json';\nexport const marqueurs = ['volume'] as const;\n", 'marqueurs'],
    ['type-discriminant', "export const file = 'd.json';\nexport const discriminant: string = 'domain';\n", 'discriminant'],
    ['type-marqueurs', "export const file = 'd.json';\nexport const marqueurs: readonly string[] = ['volume'];\n", 'marqueurs'],
    ['guillemets-discriminant', "export const file = 'e.json';\nexport const discriminant = \"domain\";\n", 'discriminant'],
    ['guillemets-marqueurs', "export const file = 'e.json';\nexport const marqueurs = [\"volume\"];\n", 'marqueurs'],
    ['guillemets-file', 'export const file = "e.json";\nexport const discriminant = \'domain\';\n', 'file'],
    ['espace-file', "export const file = 'f.json' ;\nexport const marqueurs = ['volume'];\n", 'file'],
  ];
  for (const [nom, src, champ] of horsForme) {
    it(`hors forme canonique LÈVE en nommant le def et le champ : ${nom}`, () => {
      const dir = dossierDe(nom, src);
      const attendu = new RegExp(`${nom}\\.ts : export « ${champ} » hors de sa forme canonique`);
      // Chaque projection lit `file` et SON champ : `file` hors forme fait lever les deux.
      if (champ !== 'marqueurs') expect(() => discriminantsDeclares(dir)).toThrow(attendu);
      if (champ !== 'discriminant') expect(() => marqueursDeclares(dir)).toThrow(attendu);
    });
  }
});
