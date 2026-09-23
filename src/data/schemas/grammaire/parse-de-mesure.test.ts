/**
 * PARSE DE MESURE (`reperesDuParse`, `grammaire/ref.ts`) — le côté DÉCLARÉ du volet SLOTS
 * (`docs/structures-donnees.md` §6) est ce que `idDe` valide au parse (#1473 R1). Ce banc tient :
 *  - le PATH de donnée de chaque repère, à travers la récursion (`z.lazy`), l'union (première branche
 *    propre), la clé de record, et le report d'une issue de payload d'op (`gameOpSchema`) ;
 *  - la BORNE du mode : aucun parse hors `reperesDuParse` n'émet de repère, même quand il lève ;
 *  - la GARDE DES UNIONS : aucune union des documents des deux racines ne place une branche
 *    permissive sans `idDe` APRÈS une branche qui en porte — le parse de mesure y perdrait le slot.
 */
import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { estFeuilleDId, idDe, reperesDuParse } from './ref';
import { gameOpSchema } from './mecanique';
import { defDe, enfantsDe } from './slots';
import { IDS_PAR_DATASET } from '../_ids.generated';
import { DEFS_DE_DOCUMENT } from '../validate';

const COMPETENCE = IDS_PAR_DATASET['skills.json'][0];
const TRAIT = IDS_PAR_DATASET['traits.json'][0];
const POSTE = IDS_PAR_DATASET['ship-stations.json'][0];

type Flux = { skill?: string; steps?: Flux[] };
const flux: z.ZodType<Flux> = z.lazy(() => z.strictObject({ skill: idDe('skill').optional(), steps: z.array(flux).optional() }));

describe('reperesDuParse — le path de DONNÉE de chaque référence validée par `idDe`', () => {
  it('RÉCURSION : un flux imbriqué sur deux niveaux rend chaque `skill` à son path', () => {
    const donnee = { skill: COMPETENCE, steps: [{ steps: [{ skill: COMPETENCE }] }] };
    expect(reperesDuParse(flux, donnee)).toEqual([
      { path: ['skill'], type: 'skill', parCle: false },
      { path: ['steps', 0, 'steps', 0, 'skill'], type: 'skill', parCle: false },
    ]);
  });

  it('PAYLOAD D’OP : le repère traverse le re-parse de `gameOpSchema`, à son path dans l’op', () => {
    expect(reperesDuParse(z.array(gameOpSchema), [{ op: 'domeWard', traitId: TRAIT, indice: 1 }])).toEqual([
      { path: [0, 'traitId'], type: 'trait', parCle: false },
    ]);
  });

  it('REPORT D’UNE ISSUE DE PAYLOAD : `gameOpSchema` garde son `code`, son `path` et ses `params`', () => {
    const r = gameOpSchema.safeParse({ op: 'domeWard', traitId: 3, indice: 1 });
    expect(r.success).toBe(false);
    expect(r.error?.issues.map((i) => ({ code: i.code, path: i.path }))).toEqual([{ code: 'invalid_type', path: ['traitId'] }]);
    // Les `params` sont ceux du repère : sans eux, le type du slot se perdrait au report.
    expect(reperesDuParse(gameOpSchema, { op: 'domeWard', traitId: TRAIT, indice: 1 }).map((r) => r.type)).toEqual(['trait']);
  });

  it('UNION : seule la PREMIÈRE branche propre compte — celle que le parse normal choisit', () => {
    const u = z.union([z.strictObject({ a: idDe('skill') }), z.strictObject({ a: idDe('skill'), b: z.string().optional() })]);
    expect(reperesDuParse(u, { a: COMPETENCE })).toEqual([{ path: ['a'], type: 'skill', parCle: false }]);
    const v = z.union([z.strictObject({ k: z.number() }), z.strictObject({ k: idDe('skill') })]);
    expect(reperesDuParse(z.array(v), [{ k: 1 }, { k: COMPETENCE }])).toEqual([{ path: [1, 'k'], type: 'skill', parCle: false }]);
  });

  it('CLÉ DE RECORD : la référence portée par une clé est rendue `parCle`', () => {
    expect(reperesDuParse(z.record(idDe('shipStation'), z.number()), { [POSTE]: 3 })).toEqual([{ path: [POSTE], type: 'shipStation', parCle: true }]);
  });

  it('une donnée INVALIDE au parse normal LÈVE en nommant le path — jamais un slot en moins en silence', () => {
    expect(() => reperesDuParse(flux, { steps: [{ skill: 'zzz-inconnue' }] })).toThrow(/« custom » à « steps\.0\.skill »/);
  });
});

describe('le mode de mesure est BORNÉ à l’appel de `reperesDuParse`', () => {
  it('aucun parse ordinaire n’émet de repère, avant comme après une mesure — y compris une mesure qui lève', () => {
    const feuille = idDe('skill');
    expect(feuille.safeParse(COMPETENCE).success).toBe(true);
    expect(reperesDuParse(feuille, COMPETENCE)).toHaveLength(1);
    expect(feuille.safeParse(COMPETENCE).success).toBe(true);
    expect(() => reperesDuParse(feuille, 'zzz-inconnue')).toThrow();
    expect(feuille.safeParse(COMPETENCE).success).toBe(true);
    expect(gameOpSchema.safeParse({ op: 'domeWard', traitId: TRAIT, indice: 1 }).success).toBe(true);
  });
});

/** Le nœud porte-t-il une feuille `idDe` (pile d'ancêtres contre les `z.lazy`) ? */
function porteUneReference(noeud: unknown, ancetres: ReadonlySet<unknown> = new Set()): boolean {
  if (!noeud || typeof noeud !== 'object' || ancetres.has(noeud)) return false;
  if (estFeuilleDId(noeud)) return true;
  const def = defDe(noeud);
  if (!def) return false;
  const pile = new Set(ancetres).add(noeud);
  return enfantsDe(def).some((e) => porteUneReference(e.noeud, pile));
}

/** Une branche PERMISSIVE accepte toute donnée de sa classe : chaîne ou valeur sans contrainte, objet ouvert, record. */
function permissivite(noeud: unknown): string | undefined {
  const def = defDe(noeud) as { type: string; checks?: unknown[]; catchall?: unknown } | undefined;
  if (!def) return undefined;
  if (['string', 'unknown', 'any', 'custom'].includes(def.type) && !def.checks?.length) return def.type;
  if (def.type === 'object' && defDe(def.catchall)?.type === 'unknown') return 'looseObject';
  if (def.type === 'record') return 'record';
  return undefined;
}

/** Les unions d'un schéma où une branche permissive sans `idDe` suit une branche qui en porte. */
function unionsQuiMasquent(schema: unknown, nom: string): string[] {
  const trouvees: string[] = [];
  const vues = new Set<unknown>();
  const marcher = (noeud: unknown, path: string, ancetres: ReadonlySet<unknown>): void => {
    if (!noeud || typeof noeud !== 'object' || ancetres.has(noeud) || estFeuilleDId(noeud)) return;
    const def = defDe(noeud);
    if (!def) return;
    if (def.type === 'union' && !vues.has(noeud)) {
      vues.add(noeud);
      const options = def.options ?? [];
      options.forEach((o, i) => {
        if (!porteUneReference(o)) return;
        options.slice(i + 1).forEach((q, j) => {
          const p = permissivite(q);
          if (p && !porteUneReference(q)) trouvees.push(`${nom} ${path} : branche ${i} (idDe) puis branche ${i + 1 + j} (${p})`);
        });
      });
    }
    const pile = new Set(ancetres).add(noeud);
    for (const e of enfantsDe(def)) marcher(e.noeud, path + e.segment, pile);
  };
  marcher(schema, '', new Set());
  return trouvees;
}

describe('GARDE DES UNIONS — aucune branche permissive sans `idDe` après une branche qui en porte', () => {
  it('le détecteur mord sur une union fautive, et laisse passer l’ordre inverse', () => {
    const fautive = z.strictObject({ k: z.union([idDe('skill'), z.string()]) });
    expect(unionsQuiMasquent(fautive, 'témoin')).toEqual(['témoin .k : branche 0 (idDe) puis branche 1 (string)']);
    expect(unionsQuiMasquent(z.union([z.number(), idDe('skill')]), 'témoin')).toEqual([]);
    // Ce qu'elle protège : sous une telle union, la mesure perd la référence que le parse normal valide.
    expect(reperesDuParse(fautive, { k: COMPETENCE })).toEqual([]);
  });

  it('les schémas des documents des DEUX racines n’en portent aucune', () => {
    expect(DEFS_DE_DOCUMENT.flatMap((d) => unionsQuiMasquent(d.schema, d.file))).toEqual([]);
  });
});
