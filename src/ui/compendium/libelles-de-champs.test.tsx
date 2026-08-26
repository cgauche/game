/**
 * #1466 L1a T4 — l'atelier affiche un LIBELLÉ, plus la clé technique brute.
 *
 * Ce que ce fichier verrouille :
 *  - la CASCADE (`libelleDuChamp`) : clé d'ENVELOPPE → table FR de la fabrique (`document.ts`, seule
 *    détentrice de ces noms puisque `document()` refuse une méta sur une clé d'enveloppe) ; sinon la
 *    méta d'édition du def (canal `SchemaDef.meta`) ; sinon la clé technique ;
 *  - le CANAL registre→atelier (`metaPourFichier`) ;
 *  - le CANAL atelier→picker de réf (`RefField` reçoit le libellé, pas la clé) ;
 *  - la CONVENTION D'EXPORT que le générateur de registre sait lire (export PLAT `export const meta`).
 * Les champs de charge utile suivent la méta du def : leur libellé FR arrive avec l'adoption de
 * `document()` par le def (lot L1b #1467) — 0 def adoptant à ce commit.
 */
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { z } from 'zod';
import { libelleDuChamp, inferFields } from './editFields';
import { RefField, refFieldCfg } from './RefField';
import { editableEntries, isEditableCategory } from './CodexEdit';
import { CODEX } from './registry';
import { CLES_ENVELOPPE, LIBELLES_ENVELOPPE, document } from '../../data/schemas/grammaire/document';
import { metaPourFichier, DEFS_DE_DOCUMENT } from '../../data/schemas/validate';
import { stripComments } from '../../../scripts/guards/lib/hardcode.mjs';

const handleDemo = () => document(
  'demo', 'entite',
  { portee: z.number() },
  { portee: { label: 'Portée' } },
  { codex: { keys: ['demo'] }, edit: { none: 'fixture de test' } },
);

describe('table FR de l’enveloppe', () => {
  it('chaque clé d’enveloppe a son libellé FR non vide', () => {
    const manquants = CLES_ENVELOPPE.filter((k) => !LIBELLES_ENVELOPPE[k]?.trim());
    expect(manquants, `clés d’enveloppe sans libellé : ${manquants.join(', ')}`).toEqual([]);
  });

  it('la table ne se lit QUE sur ses propres clés (jamais la chaîne de prototypes)', () => {
    expect(libelleDuChamp('toString')).toBe('toString');
    expect(libelleDuChamp('constructor')).toBe('constructor');
  });
});

describe('cascade du libellé', () => {
  it('clé d’enveloppe → libellé FR de la fabrique', () => {
    expect(libelleDuChamp('id')).toBe('Identifiant');
    expect(libelleDuChamp('labelF')).toBe('Libellé (forme féminine)');
    expect(libelleDuChamp('alsoIn')).toBe('Aussi publié dans');
  });

  it('`type` sur un document SANS handle reste la clé (discriminant de charge utile, jamais « Type de document »)', () => {
    expect(libelleDuChamp('type')).toBe('type');
  });

  it('`type` sur un document À handle est bien le type de document', () => {
    expect(libelleDuChamp('type', { meta: handleDemo().meta })).toBe('Type de document');
  });

  it('champ de charge utile → label FR de la méta du def', () => {
    expect(libelleDuChamp('portee', { meta: handleDemo().meta })).toBe('Portée');
  });

  it('champ inconnu de la méta → clé technique (seam d’extinction, L1b #1467)', () => {
    expect(libelleDuChamp('cadence', { meta: handleDemo().meta })).toBe('cadence');
    expect(libelleDuChamp('cadence')).toBe('cadence');
  });
});

describe('cascade sur DONNÉE RÉELLE (`trappings`, def sans handle)', () => {
  const champs = () => inferFields(editableEntries('trappings') as Record<string, unknown>[], { meta: metaPourFichier('trappings.json') });

  it('`type` de `trappings.json` est un discriminant de charge utile → sa clé, jamais « Type de document »', () => {
    const entrees = editableEntries('trappings') as Record<string, unknown>[];
    expect(entrees.some((e) => typeof e.type === 'string'), 'la population `type` a disparu de trappings.json').toBe(true);
    expect(libelleDuChamp('type', { meta: metaPourFichier('trappings.json') })).toBe('type');
    expect(champs().find((f) => f.key === 'type')!.label).toBe('type');
  });

  it('un champ d’enveloppe réel (`desc`) porte son libellé FR', () => {
    const desc = champs().find((f) => f.key === 'desc');
    expect(desc, '`desc` a disparu de trappings.json').toBeDefined();
    expect(desc!.label).toBe('Description');
  });
});

describe('inferFields porte le libellé sans perdre la clé', () => {
  it('avec méta : enveloppe libellée, charge utile libellée, inconnu en clé', () => {
    const champs = inferFields([{ id: 'a', label: 'A', portee: 3, cadence: 1 }], { meta: handleDemo().meta });
    expect(champs.map((f) => [f.key, f.label])).toEqual([
      ['id', 'Identifiant'],
      ['label', 'Libellé'],
      ['portee', 'Portée'],
      ['cadence', 'cadence'],
    ]);
  });

  it('sans méta (appel à 1 argument) : la table d’enveloppe s’applique seule, `type` excepté', () => {
    const champs = inferFields([{ id: 'a', type: 'melee', portee: 3 }]);
    expect(champs.map((f) => [f.key, f.label])).toEqual([
      ['id', 'Identifiant'],
      ['type', 'type'],
      ['portee', 'portee'],
    ]);
  });
});

/**
 * L'ENVELOPPE n'existe qu'au PREMIER NIVEAU. Population réelle mesurée : `naval-traits.json`
 * `install.cost.bands[]` porte `maison` sur 20 entrées, `activities.json` `outcomes[].ops[]` porte
 * `id` (« extenue ») sur 20 ops — homonymes de champs d'enveloppe, à NE PAS libeller.
 */
describe('régime PROFONDEUR — pas de fuite des libellés d’enveloppe dans les sous-formulaires', () => {
  it('un `maison` de bande de coût reste sa clé (jamais « Arbitrage maison »)', () => {
    const bandes = [{ maxLengthM: 35, value: 10 }, { maxLengthM: null, value: 20, maison: 'arbitrage' }];
    const cols = inferFields(bandes, { niveau: 'profondeur' });
    expect(cols.find((f) => f.key === 'maison')!.label).toBe('maison');
    expect(libelleDuChamp('maison', { niveau: 'profondeur' })).toBe('maison');
  });

  it('un `id` d’op de profondeur reste sa clé (jamais « Identifiant »)', () => {
    const ops = [{ op: 'condition', id: 'extenue' }];
    expect(inferFields(ops, { niveau: 'profondeur' }).find((f) => f.key === 'id')!.label).toBe('id');
    expect(libelleDuChamp('desc', { niveau: 'profondeur' })).toBe('desc');
  });

  it('le PREMIER NIVEAU garde ses libellés d’enveloppe (non-régression)', () => {
    expect(libelleDuChamp('maison')).toBe('Arbitrage maison');
    expect(libelleDuChamp('id')).toBe('Identifiant');
    expect(libelleDuChamp('desc')).toBe('Description');
    expect(inferFields([{ id: 'a', desc: 'd' }]).map((f) => f.label)).toEqual(['Identifiant', 'Description']);
  });

  it('la méta d’un def ne nomme pas non plus un sous-champ homonyme', () => {
    expect(libelleDuChamp('portee', { meta: handleDemo().meta, niveau: 'profondeur' })).toBe('portee');
  });
});

describe('canal registre → atelier (`metaPourFichier`)', () => {
  it('un document registré SANS méta rend `undefined` (0 def adoptant à ce commit)', () => {
    expect(metaPourFichier('trappings.json')).toBeUndefined();
  });

  it('un fichier inconnu du registre rend `undefined` (jamais une exception)', () => {
    expect(metaPourFichier('fichier-qui-nexiste-pas.json')).toBeUndefined();
  });

  it('la clé du canal est le `file` du registre TEL QUEL — chemin relatif pour `src/scenes`, sans collision de basename', () => {
    const scenes = DEFS_DE_DOCUMENT.filter((d) => d.root === 'src/scenes');
    expect(scenes.length).toBeGreaterThan(0);
    expect(scenes.every((d) => d.file.includes('/')), `un def de scène sans chemin relatif : ${scenes.map((d) => d.file).join(', ')}`).toBe(true);
    const files = DEFS_DE_DOCUMENT.map((d) => d.file);
    expect(new Set(files).size, 'deux defs partagent la même clé de canal').toBe(files.length);
    const basenames = scenes.map((d) => d.file.split('/').pop()!);
    const collisions = basenames.filter((b) => DEFS_DE_DOCUMENT.some((d) => d.file === b));
    expect(collisions, `basename de scène en collision avec un document de src/data : ${collisions.join(', ')}`).toEqual([]);
  });
});

describe('canal atelier → picker de référence (`RefField`)', () => {
  it('un champ à config REF affiche le LIBELLÉ reçu, jamais sa clé technique', () => {
    const html = renderToStaticMarkup(<RefField cfg={{ ds: 'qualityTypes', single: true }} fieldKey="type" label="Type de document" value="" onChange={() => {}} />);
    expect(html).toContain('Type de document');
    expect(html).not.toContain('<span>type<');
  });

  it('sans libellé, le picker retombe sur la clé (appelants qui ne connaissent que la clé)', () => {
    const html = renderToStaticMarkup(<RefField cfg={{ ds: 'qualityTypes', single: true }} fieldKey="subType" value="" onChange={() => {}} />);
    expect(html).toContain('subType');
  });

  /**
   * BUG de recette (2026-08-26) : la config de `skills.characteristic` peuplait ses options par
   * `abr` alors que `skills.json` stocke l'`id` — le select rendait « dexterite (inconnu) » sur une
   * donnée VALIDE, et les 7 `abr` vides collidaient en une même clé React.
   */
  it('`skills.characteristic` : la valeur STOCKÉE est une option, et les clés d’option sont uniques', () => {
    const skills = editableEntries('skills') as Record<string, unknown>[];
    const stockees = [...new Set(skills.map((s) => String(s.characteristic ?? '')))].filter(Boolean);
    expect(stockees.length, 'la population `characteristic` a disparu de skills.json').toBeGreaterThan(0);
    const cfg = refFieldCfg('skills', 'characteristic')!;
    for (const v of stockees) {
      const html = renderToStaticMarkup(<RefField cfg={cfg} fieldKey="characteristic" label="Caractéristique" value={v} onChange={() => {}} />);
      expect(html, `valeur stockée « ${v} » rendue « (inconnu) » — la config du select ne parle pas la langue de la donnée`).not.toContain('(inconnu)');
      expect(html).toContain(`value="${v}"`);
    }
    const valeursDOption = [...renderToStaticMarkup(<RefField cfg={cfg} fieldKey="characteristic" label="Caractéristique" value={stockees[0]} onChange={() => {}} />).matchAll(/<option value="([^"]*)"/g)].map((m) => m[1]);
    const doublons = valeursDOption.filter((v, i) => valeursDOption.indexOf(v) !== i);
    expect(doublons, `clés d’option dupliquées (warning React « same key ») : ${doublons.join(', ')}`).toEqual([]);
  });

  it('les champs à config REF des catégories réelles sont bien porteurs d’un libellé (même projection que `CodexEdit`)', () => {
    const refs = CODEX.filter((c) => isEditableCategory(c.key)).flatMap((c) =>
      inferFields(editableEntries(c.key) as Record<string, unknown>[], { meta: metaPourFichier(`${c.key}.json`) })
        .filter((f) => refFieldCfg(c.key, f.key))
        .map((f) => ({ cat: c.key, key: f.key, label: f.label })),
    );
    expect(refs.length, 'aucun champ à config REF trouvé — la projection a changé de forme').toBeGreaterThan(0);
    const nus = refs.filter((r) => !r.label);
    expect(nus, `champ REF sans libellé : ${nus.map((r) => `${r.cat}.${r.key}`).join(', ')}`).toEqual([]);
  });
});

/**
 * CONVENTION D'EXPORT du générateur de registre (`scripts/gen-registry.mjs`) : il est TEXTUEL et
 * détecte `meta` par `^export const meta` — un export destructuré (`export const { meta } = doc`) ou
 * ré-exporté (`export { meta }`) ne serait PAS émis, et l'atelier retomberait sur la clé sans qu'aucun
 * gate ne rougisse. Cette garde est le rouge manquant, appliquée à tout def qui appelle `document(`.
 */
const RACINES_DE_DEFS = ['src/data/schemas/defs', 'src/data/schemas/defs-scenes'];
const APPELLE_DOCUMENT = /\bdocument\s*\(/;
const EXPORT_META_PLAT = /^export const meta\b/m;

/** Defs qui déclarent un document sans exporter `meta` À PLAT — la liste que la garde exige vide. */
export function defsSansExportMetaPlat(sources: { file: string; src: string }[]): string[] {
  // `stripComments` (lib de garde partagée) : une PROSE qui dit « intra-document » n'est pas un appel
  // à la fabrique, et l'import nommé de `document` non plus — seuls les SITES d'appel comptent.
  return sources
    .filter((s) => APPELLE_DOCUMENT.test(stripComments(s.src)) && !EXPORT_META_PLAT.test(s.src))
    .map((s) => s.file);
}

function sourcesDesDefs(): { file: string; src: string }[] {
  return RACINES_DE_DEFS.flatMap((dir) =>
    readdirSync(dir)
      .filter((f) => /\.tsx?$/.test(f) && !f.startsWith('_') && !/\.test\.tsx?$/.test(f))
      .map((f) => ({ file: `${dir}/${f}`, src: readFileSync(join(dir, f), 'utf8') })),
  );
}

describe('convention d’export lue par le générateur de registre', () => {
  it('tout def qui appelle `document(` exporte `meta` À PLAT', () => {
    const muets = defsSansExportMetaPlat(sourcesDesDefs());
    expect(
      muets,
      `la convention du gen exige l'export PLAT — un export destructuré/ré-exporté serait muet au registre :\n${muets.join('\n')}`,
    ).toEqual([]);
  });

  it('la garde MORD sur les deux formes muettes (fixtures de source)', () => {
    const muets = defsSansExportMetaPlat([
      { file: 'destructure.ts', src: "const doc = document('x', 'entite', {}, {}, {});\nexport const { schema, meta } = doc;\n" },
      { file: 'reexport.ts', src: "const doc = document('y', 'entite', {}, {}, {});\nconst meta = doc.meta;\nexport { meta };\n" },
      { file: 'plat.ts', src: "const doc = document('z', 'entite', {}, {}, {});\nexport const meta = doc.meta;\n" },
      { file: 'sans-fabrique.ts', src: "export const schema = z.array(z.object({}));\n" },
    ]);
    expect(muets).toEqual(['destructure.ts', 'reexport.ts']);
  });

  it('la marche des defs voit une population réelle (le contrat n’est pas vide par erreur de chemin)', () => {
    expect(sourcesDesDefs().length).toBeGreaterThan(100);
  });
});
