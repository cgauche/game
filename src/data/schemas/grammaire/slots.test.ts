/**
 * Contrats du REGISTRE DES SLOTS (#1466 L1a T2) — la marche du schéma composé, le compteur
 * anti-perte-silencieuse, et la def-PREUVE qui prouve la couverture sur le corpus RÉEL.
 */
import { readFileSync } from 'node:fs';
import { describe, it, expect } from 'vitest';
import { z } from 'zod';
import merchantsJson from '../../merchants.json';
import { SCHEMA_DEFS } from '../_registry.generated';
import { SCHEMA_DEFS_SCENES } from '../_registry-scenes.generated';
import { marqueDe, marquesPosées, marquesRetrouvées, profondeurDe, PROFONDEUR_MAX, slotsDe, defDe, enfantsDe } from './slots';
import { idDe, ref, refs, pick, specRef } from './ref';
import { actorRefSchema, conditionSchema, gameOpSchema, OP_DEFS, OPS_NON_TYPEES } from './mecanique';

const paths = (schema: unknown) => slotsDe('src/data', 'jouet.json', schema).map((s) => s.path);

describe('slotsDe — un slot par référence RÉELLE, à son path exact', () => {
  it('descend liste, objet, optionnel, union, record et tuple', () => {
    expect(paths(z.array(ref('skill')))).toEqual(['[].id']);
    expect(paths(z.strictObject({ t: ref('talent').optional() }))).toEqual(['t.id']);
    expect(paths(z.union([ref('skill'), ref('talent')]))).toEqual(['|0.id', '|1.id']);
    expect(paths(z.record(z.string(), ref('trapping')))).toEqual(['{}.id']);
    expect(paths(pick('talent'))).toEqual(['|0.of[]|0.id', '|0.of[]|1.id', '|1.table.id']);
    expect(paths(z.tuple([ref('spell')]))).toEqual(['[0].id']);
  });

  it('la CARDINALITÉ se déduit du path, jamais d’un drapeau porté par la descente', () => {
    const slots = slotsDe('src/data', 'jouet.json', z.strictObject({ un: ref('skill'), beaucoup: refs('skill') }));
    expect(slots.map((s) => [s.path, s.cardinalite])).toEqual([
      ['un.id', 'un'],
      ['beaucoup[]', 'liste'],
    ]);
    // `pick` n'est pas une cardinalité : le path le dit (`of[]` = liste, `table` = un).
    expect(slotsDe('src/data', 'jouet.json', pick('talent')).map((s) => s.cardinalite)).toEqual(['liste', 'liste', 'un']);
  });

  it('une INSTANCE PARTAGÉE par 3 champs vaut 3 slots (pile d’ancêtres, jamais un `vus` global)', () => {
    const partage = ref('skill', { value: z.number() });
    expect(paths(z.strictObject({ a: partage, b: z.array(partage), c: z.strictObject({ d: partage }) }))).toEqual([
      'a.id',
      'b[].id',
      'c.d.id',
    ]);
  });

  it('un schéma RÉCURSIF (`lazy`) ne fait pas boucler la marche', () => {
    expect(() => slotsDe('src/data', 'jouet.json', conditionSchema)).not.toThrow();
  });

  it('la 2ᵉ espèce : l’ACTEUR d’une mécanique est un slot, `type` absent', () => {
    const slots = slotsDe('src/data', 'jouet.json', z.strictObject({ who: actorRefSchema }));
    expect(slots).toEqual([{ root: 'src/data', dataset: 'jouet.json', path: 'who', type: undefined, espece: 'acteur', cardinalite: 'un' }]);
  });

  it('la marque vit sur la FEUILLE : `ref()`/`specRef()` n’émettent qu’UN slot par référence', () => {
    expect(paths(ref('skill'))).toEqual(['id']);
    expect(paths(specRef('skill'))).toEqual(['id']);
    expect(paths(refs('skill'))).toEqual(['[]']);
  });
});

describe('compteur de marques — le seul détecteur du zéro SILENCIEUX', () => {
  it('un nœud marqué puis `.refine`-é HORS fabrique disparaît de la marche : le test le NOMME', () => {
    const feuille = idDe('skill');
    const clone = (feuille as unknown as { refine: (f: () => boolean) => unknown }).refine(() => true);
    expect(marqueDe(feuille)?.site).toBe("idDe('skill')");
    expect(marqueDe(clone)).toBeUndefined();
    const perdue = marquesPosées().find((p) => p.noeud === feuille)!;
    expect(perdue.marque.site).toBe("idDe('skill')");
    expect(paths(z.strictObject({ s: clone }))).toEqual([]);
    expect(paths(z.strictObject({ s: feuille }))).toEqual(['s']);
  });

  it('les enveloppes qui ne clonent PAS la feuille la préservent (`.optional()`, `.array().min()`)', () => {
    const feuille = idDe('trait');
    expect(paths(z.strictObject({ s: feuille.optional() }))).toEqual(['s']);
    expect(paths(z.strictObject({ s: z.array(feuille).min(1) }))).toEqual(['s[]']);
  });

  it('la marche des defs des DEUX racines ne perd aucune marque et NOMME les fabriques retrouvées', () => {
    const retrouvées = new Set<object>();
    for (const { root, file, schema } of [...SCHEMA_DEFS, ...SCHEMA_DEFS_SCENES]) {
      for (const n of marquesRetrouvées(schema)) retrouvées.add(n);
      expect(() => slotsDe(root, file, schema)).not.toThrow();
    }
    // Le stock des références ADOPTÉES par les defs, nommé par sa fabrique : il ne peut que CROÎTRE
    // (L1b/L2/L3 adoptent concept par concept) ; un retrait silencieux rougit ici. La marque de
    // `defs-scenes/narratif.ts` (`idDe('creature')`) n'est nommée QUE si les deux racines sont marchées.
    expect(
      [...retrouvées].map((n) => marqueDe(n)!.site).sort(),
      'marque(s) de référence perdue(s) ou apparue(s) — une feuille marquée puis clonée hors fabrique (`.refine` EXTERNE) disparaît de la marche SANS erreur : c’est le zéro silencieux que ce stock nominatif détecte.',
    // 11 sites de référence de Compétence ADOPTÉS au lot L2 #1548 (commit 3b) : `refOuSpec('skill')`
    // pose UNE marque par INSTANCE de fabrique (activities, axes, crew-roles, creatures, sea-cargo,
    // sea-perils ×2, steam-breakdown, water-exposure, `mount.riderTest`, `shipCrewHitSchema`) — puis
    // 11 → 30 au commit 3c, où la référence emboîtée gagne 19 instances : la grammaire (`flowTest`),
    // les conteneurs de Test (`criticals.test`, `etats.recover`, `psychology.test`,
    // `spells.opposed`, `miscast` ×2), le matcher `talents.testMatch`, les 4 instances de l'union
    // `talents.reverseFailed` (2 branches × base et `variants`, que `variantOf` clone), les 5 slots de
    // `tavernGames` et les 2 effets de scène `extendedTest`/`startPursuit`. Les DEUX portes
    // `corruptionExposure` (op `GameOp`, effet de scène) n'en posent AUCUNE : `refTestDeCorruption`
    // est un ENUM d'alphabet (`TESTS_DE_CORRUPTION`) et non une réf de catalogue — borne plus étroite,
    // donc hors du compteur de FK. Le stock des sites ADOPTÉS ne peut que CROÎTRE.
    // … puis 30 → 28 au commit 3d, où l'UNION de `talents.reverseFailed` MEURT : le champ porte
    // TOUJOURS une liste (`skills`), donc 1 fabrique par instance au lieu de 2 — 2 marques de moins
    // pour un MÊME nombre de références validées (les 2 instances restantes, base et `variants`,
    // couvrent les 9 références des 8 Talents). Une BRANCHE de moins n'est pas un site de moins.
    // … puis 28 → 34 `idDe('skill')` au commit 4, où l'AVANCEMENT adopte la grammaire : les 4 champs `skills`/`talents`
    // de `careerLevels`/`species` composent `avancement(type)`, et CHAQUE instance pose 4 marques —
    // `refOuSpec(type)` (1), puis le `pick(type, [tirage])` qui l'accompagne, dont l'option est
    // l'union `ref(type)` | `specRef(type)` | nœud (2 de plus) et dont la branche `{pick, table}`
    // désigne une table d100 (1 `idDe('table')`). D'où +6 `skill`, +6 `talent` et +4 `table` pour les
    // 4 instances. Le stock des sites ADOPTÉS ne peut que CROÎTRE.
    // … puis QUATRE sites ADOPTÉS de plus au L-gram-2 (#1463, 2026-09-01), un par fabrique écrite :
    // `defs/species.ts › previewCareer` (`ref('career')`, la carrière icône d'une espèce),
    // `defs/vehicles.ts › ship.traits` (`ref('navalTrait', {value})`, foyer `naval-traits.json`),
    // `defs/domains.ts › windModifiers[].cancelledBy.requiresSkill` (`refOuSpec('skill')`, 36 → 37) et
    // `defs/structures.ts › traits` (`ref('trait')`). Le stock des sites ADOPTÉS ne peut que CROÎTRE.
    ).toEqual([
      'actorRefSchema',
      "idDe('career')",
      "idDe('creature')",
      // +1 site ADOPTÉ (#674, 2026-08-31) : `defs/maladies.ts › mutation.into` désigne la maladie en
      // laquelle une autre se transforme (Rhume commun → Pneumonie, EDOC 08 l.122) et compose
      // `idDe('maladie')` dès sa première écriture, sans passer par un `z.string()`.
      // (Les `idDe('maladie')`/`idDe('symptome')` posés au MÊME lot sur `aggravateSymptom`/
      // `grantSymptom` n'apparaissent PAS ici : `OP_DEFS` est atteint par le superRefine de
      // `gameOpSchema`, hors de la marche des defs — même angle mort que les `idDe('trait')` d'op.
      // L'`idDe('trait')` listé plus bas, lui, est un champ de def (`structures.ts › traits`) : il est
      // sur le chemin de la marche, donc compté.)
      "idDe('maladie')",
      "idDe('navalTrait')",
      // … puis 34 → 36 `idDe('skill')` au commit 4bis : les DEUX statblocs adoptent la grammaire —
      // `defs/creatures.ts › skills` et `defs-scenes/communs.ts › skills` composent
      // `refOuSpec('skill', {value})` là où ils redéclaraient chacun leur `{id, spec?, value}`.
      // 1 marque par instance de fabrique. Le stock des sites ADOPTÉS ne peut que CROÎTRE.
      // … puis 37 → 36 (#1657 B2a) : `defs/aa-criticals.ts › aaEntrySchema.resist.skill` MEURT avec
      // son def — la Compétence testée par une rangée de Critique est désormais celle du nœud
      // partagé (`flowTestSchema.skill`, `grammaire/mecanique.ts`), qui n'est pas un champ de DEF et
      // ne se compte donc pas ici. Une marche de MOINS pour la MÊME référence validée : le site n'a
      // pas disparu, il a rejoint la grammaire commune — c'est le sens même de cette vague.
      // … puis 36 → 35 (#1657 B2c), MOUVEMENT IDENTIQUE : `shipCrewTestSchema.skill` meurt avec la
      // graphie propriétaire du coup à l'équipage — le sujet du jet est celui du nœud partagé
      // (`flowTestSchema.skill`), qui n'est pas un champ de DEF. La référence « Canon détaché »
      // (`athletisme`, MDG 13 l.763) reste VALIDÉE, par la marche de la grammaire.
      ...Array.from({ length: 35 }, () => "idDe('skill')"),
      ...Array.from({ length: 4 }, () => "idDe('table')"),
      ...Array.from({ length: 6 }, () => "idDe('talent')"),
      "idDe('trait')",
      "idDe('trapping')",
    ]);
  });

  it('la coupe de PROFONDEUR_MAX est BRUYANTE : un schéma trop profond LÈVE en nommant son path', () => {
    let jouet: z.ZodTypeAny = ref('skill');
    for (let i = 0; i < PROFONDEUR_MAX + 1; i++) jouet = z.strictObject({ n: jouet });
    expect(() => slotsDe('src/data', 'jouet.json', jouet)).toThrow(
      new RegExp(`descente coupée à PROFONDEUR_MAX=${PROFONDEUR_MAX} sous « n\\.n\\.n`),
    );
  });

  it('la MARGE sous PROFONDEUR_MAX est verrouillée : le rouge arrive AVANT que `slotsDe` ne lève', () => {
    const mesures = [...SCHEMA_DEFS, ...SCHEMA_DEFS_SCENES]
      .map((d) => ({ def: `${d.root}/${d.file}`, ...profondeurDe(d.schema) }))
      .sort((a, b) => b.profondeur - a.profondeur);
    expect(
      SCHEMA_DEFS_SCENES.length,
      'le registre des scènes est vide : la moitié du corpus ne serait pas mesurée.',
    ).toBeGreaterThan(0);
    expect(mesures[0].profondeur, 'la mesure de profondeur ne rend rien : elle ne prouverait aucune marge.').toBeGreaterThan(0);
    const pire = mesures[0];
    expect(
      pire.profondeur,
      `la def la PLUS PROFONDE du corpus atteint ou dépasse PROFONDEUR_MAX=${PROFONDEUR_MAX} — « ${pire.def} » à ${pire.profondeur} sous « ${pire.chemin} ». ` +
        'La marge est épuisée : re-mesurer (`profondeurDe`) et relever `PROFONDEUR_MAX` AVEC ce motif au commentaire de `slots.ts` — jamais en silence, sinon des slots se perdent à la coupe.',
    ).toBeLessThan(PROFONDEUR_MAX);
    // Corollaire : sous cette marge, aucune def ne fait LEVER la marche des slots.
    const leves = [...SCHEMA_DEFS, ...SCHEMA_DEFS_SCENES]
      .filter((d) => {
        try {
          slotsDe(d.root, d.file, d.schema);
          return false;
        } catch {
          return true;
        }
      })
      .map((d) => `${d.root}/${d.file}`);
    expect(leves, 'def(s) dont la marche des slots LÈVE alors que la marge est censée tenir.').toEqual([]);
  });
});

describe('def-PREUVE — `merchants.json` `curated` adopte `refs(\'trapping\')`, aucune donnée ne change', () => {
  const def = SCHEMA_DEFS.find((d) => d.file === 'merchants.json')!;

  it('la marche émet le slot attendu, path/type/cardinalité EXACTS', () => {
    expect(slotsDe(def.root, def.file, def.schema)).toEqual([
      { root: 'src/data', dataset: 'merchants.json', path: '[].curated[]', type: 'trapping', espece: 'id', cardinalite: 'liste' },
    ]);
  });

  it('le dataset RÉEL parse, et un id de trapping inventé casse au parse', () => {
    const merchants = def.schema.parse(JSON.parse(JSON.stringify(merchantsJson)));
    expect(Array.isArray(merchants)).toBe(true);
    const faux = JSON.parse(JSON.stringify(merchantsJson)) as { curated?: string[] }[];
    const porteur = faux.find((m) => m.curated?.length)!;
    porteur.curated![0] = 'objet-qui-n-existe-pas';
    const res = def.schema.safeParse(faux);
    expect(res.success).toBe(false);
    expect(JSON.stringify(res.error?.issues)).toMatch(/objet-qui-n-existe-pas.*trappings\.json/);
  });
});

describe('descente PARTAGÉE avec l’introspection du doc', () => {
  it('`defDe`/`enfantsDe` lisent la forme d’un nœud zod, segments compris', () => {
    const objet = z.strictObject({ a: z.string(), b: z.number() });
    expect(defDe(objet)?.type).toBe('object');
    expect(enfantsDe(defDe(objet)!).map((e) => e.segment)).toEqual(['.a', '.b']);
    expect(enfantsDe(defDe(z.array(z.string()))!).map((e) => e.segment)).toEqual(['[]']);
    expect(defDe('pas un nœud')).toBeUndefined();
  });
});

describe('OP_DEFS — payload strict par op, repli nominatif, rouge au SITE', () => {
  it('une op TYPÉE valide son payload et refuse un champ étranger', () => {
    expect(gameOpSchema.safeParse({ op: 'heal', amount: { dice: { n: 1, sides: 10 } } }).success).toBe(true);
    expect(gameOpSchema.safeParse({ op: 'heal', amount: 2, perSL: { every: 2, amount: 1 } }).success).toBe(true);
    const res = gameOpSchema.safeParse({ op: 'heal', amount: 2, champInvente: true });
    expect(res.success).toBe(false);
    expect(JSON.stringify(res.error?.issues)).toMatch(/GameOp « heal »/);
    expect(gameOpSchema.safeParse({ op: 'kill' }).success).toBe(true);
    expect(gameOpSchema.safeParse({ op: 'kill', cible: 'x' }).success).toBe(false);
  });

  it('une op NON TYPÉE garde la forme loose', () => {
    expect(OPS_NON_TYPEES).toContain('narrative');
    expect(gameOpSchema.safeParse({ op: 'narrative', text: 'un récit', quoiQueCeSoit: 3 }).success).toBe(true);
  });

  it('une op inconnue des DEUX registres est NOMMÉE en erreur', () => {
    const res = gameOpSchema.safeParse({ op: 'nImporteQuoi' });
    expect(res.success).toBe(false);
    expect(JSON.stringify(res.error?.issues)).toMatch(/GameOp « nImporteQuoi » : op inconnue de OP_DEFS et de OPS_NON_TYPEES/);
  });

  it('une op TYPÉE au payload FAUX est refusée AU CHAMP (le gate ne s’arrête pas au nom de l’op)', () => {
    // `heal.amount` est un nombre ou une Formula — une chaîne n'en est ni l'un ni l'autre. Le rouge
    // doit venir du CHAMP (`amount`), pas du repli nominatif : sans cela, une op nommée juste passerait
    // avec n'importe quelle charge utile.
    const res = gameOpSchema.safeParse({ op: 'heal', amount: 'beaucoup' });
    expect(res.success).toBe(false);
    const issues = res.error!.issues;
    expect(issues.map((i) => i.path.join('.'))).toContain('amount');
    expect(JSON.stringify(issues)).toMatch(/Invalid input/);
  });

  it('une op TYPÉE à CLÉ EN TROP est refusée par la clé NOMMÉE, pas par un message générique', () => {
    const res = gameOpSchema.safeParse({ op: 'kill', zzz: 1 });
    expect(res.success).toBe(false);
    const texte = JSON.stringify(res.error!.issues);
    expect(texte).toMatch(/Unrecognized key/);
    expect(texte).toMatch(/zzz/);
  });

  it('la clé `op` SURCHARGÉE d’une `Condition` (comparateur) ne passe pas par ce rouge', () => {
    for (const comparateur of ['>=', '<=', '>', '<', '==']) {
      const cond = { kind: 'slThreshold', op: comparateur, value: 2 };
      expect(conditionSchema.safeParse(cond).success).toBe(true);
    }
  });

  it('les deux registres sont DISJOINTS et couvrent EXACTEMENT les ops du moteur, sans compte magique', () => {
    const typees = Object.keys(OP_DEFS);
    expect(typees.filter((o) => OPS_NON_TYPEES.includes(o))).toEqual([]);
    // La référence est la SOURCE `src/engine/ops.ts` : chaque branche littérale de l'union `GameOp`
    // (`rollTable` en porte 2, dédoublonnées par l'ensemble). Égalité d'ensembles BIDIRECTIONNELLE :
    // une op moteur non couverte comme une entrée orpheline sont NOMMÉES.
    const source = readFileSync(new URL('../../../engine/ops.ts', import.meta.url), 'utf8');
    const opsDuMoteur = new Set([...source.matchAll(/^\s*\|\s*\{\s*op:\s*'([^']+)'/gm)].map((m) => m[1]));
    expect(opsDuMoteur.size).toBeGreaterThan(0);
    const couvertes = new Set([...typees, ...OPS_NON_TYPEES]);
    expect([...opsDuMoteur].filter((o) => !couvertes.has(o)).sort()).toEqual([]);
    expect([...couvertes].filter((o) => !opsDuMoteur.has(o)).sort()).toEqual([]);
  });
});
