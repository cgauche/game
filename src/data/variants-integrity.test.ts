/**
 * Garde des VARIANTES réglées (#563/#564 Lot 3) : `when.rule` DOIT être un id de `OPTIONAL_RULES`
 * (item 1, gate fantôme sinon), et la règle stricte 5 (verbatim + folio) s'applique PAR VARIANTE
 * comme pour l'ancre (item 2 — `folioIntegrity.mjs:citedEntriesOf` la découvre déjà, aucune
 * extension nécessaire : une variante est structurellement `{desc, source}` comme une entrée).
 *
 * `talents.json` et `spells.json` portent des variantes en donnée — la garde EXHAUSTIVE ci-dessous
 * DÉRIVE la liste autorisée des defs (`RESOLVED_BY_FILE`) et couvre ces fichiers réels ; les morsures
 * de la règle 5 restent des fixtures SYNTHÉTIQUES (patron partagé
 * avec `secondary-ref-integrity.test.ts`). Troisième garde (#564) : deux variantes d'une MÊME entrée ne
 * doivent jamais pouvoir être actives ensemble — `activeVariant` prend la première, silencieusement.
 */
import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { OPTIONAL_RULES } from '../engine/policy';
import { unknownVariantRules, variantRulesOf } from '../../scripts/guards/lib/variantRule.mjs';
import { citedEntriesOf, auditFolio } from '../../scripts/guards/lib/folioIntegrity.mjs';
import * as talentsDef from './schemas/defs/talents';
import * as traitsDef from './schemas/defs/traits';
import * as spellsDef from './schemas/defs/spells';
import { characteristics } from './index';

const DIR = fileURLToPath(new URL('.', import.meta.url));
const KNOWN_RULE_IDS = new Set(OPTIONAL_RULES.map((r) => r.id));
/** Clés du schéma d'ENTRÉE de chaque dataset à variantes — lues du schéma zod, jamais recopiées. */
const SHAPE_BY_FILE = new Map<string, string[]>([
  [talentsDef.file, Object.keys(talentsDef.schema.element.shape)],
  [traitsDef.file, Object.keys(traitsDef.schema.element.shape)],
  [spellsDef.file, Object.keys(spellsDef.schema.element.shape)],
]);

/** id de la Caractéristique nommée par une ligne « Maxi : Bonus d'Agilité » — DÉRIVÉ de
 *  `characteristics.json` (le label est de l'affichage ; la logique compare des ids). */
const CHAR_ID_BY_LABEL = new Map(characteristics.map((c) => [c.label.toLocaleLowerCase('fr'), c.id]));
function bonusCharId(printed: string): string | undefined {
  const m = /^Bonus (?:d'|de )(.+)$/i.exec(printed.trim());
  return m ? CHAR_ID_BY_LABEL.get(m[1].trim().toLocaleLowerCase('fr')) : undefined;
}

describe('variantRulesOf — walk de `variants[].when.rule`', () => {
  it('collecte chaque variante avec la clé de son porteur', () => {
    const data = [{ id: 'exemple', variants: [{ when: { rule: 'combat-aa-avantage-groupe' } }] }];
    expect(variantRulesOf(data)).toEqual([{ key: 'exemple.variants[0]', rule: 'combat-aa-avantage-groupe' }]);
  });
});

describe('garde-fou « when.rule ∈ OPTIONAL_RULES » (#564 Lot 3 item 1)', () => {
  it('0 variante réelle sur src/data/*.json ne référence un id de règle inconnu (aucune migration au Lot 0/3)', () => {
    const violations = unknownVariantRules(DIR, KNOWN_RULE_IDS);
    expect(violations).toEqual([]);
  });

  it('MORSURE — `when.rule` fantôme (`regle-inventee`) → rouge', () => {
    const data = [{ id: 'fixture', variants: [{ when: { rule: 'regle-inventee' } }] }];
    const violations = variantRulesOf(data).filter((e) => !KNOWN_RULE_IDS.has(e.rule));
    expect(violations).toEqual([{ key: 'fixture.variants[0]', rule: 'regle-inventee' }]);
  });

  it('un id RÉEL du registre passe (vert)', () => {
    const known = OPTIONAL_RULES[0].id;
    const data = [{ id: 'fixture', variants: [{ when: { rule: known } }] }];
    expect(variantRulesOf(data).filter((e) => !KNOWN_RULE_IDS.has(e.rule))).toEqual([]);
  });

  it('EXHAUSTIF : seuls les datasets à liste blanche déclarée référencent `variants` en donnée (contrôle croisé texte brut)', () => {
    const files = readdirSync(DIR).filter((f) => f.endsWith('.json'));
    // La liste autorisée est DÉRIVÉE des defs (`RESOLVED_BY_FILE`), jamais une liste de fichiers à la main.
    const offenders = files.filter((f) => !RESOLVED_BY_FILE.has(f) && readFileSync(join(DIR, f), 'utf8').includes('"variants"'));
    expect(offenders).toEqual([]);
  });
});

describe('règle 5 PAR VARIANTE — `variants[i].desc` verbatim dans `variants[i].source` (#563 Lot 3 item 2)', () => {
  // Fixture RÉELLE (ZI, folio 23) — même patron que `secondary-ref-integrity.test.ts` : preuve de
  // câblage contre le vrai corpus, pas un livre inventé. Cf. `folioIntegrity.mjs` note l.241-244 :
  // une variante est structurellement `{desc, source}` sur le même nœud qu'une entrée, découverte à
  // toute profondeur SANS extension de `citedEntriesOf`.
  const VERBATIM =
    "cette créature peut se déplacer en creusant un tunnel dans la terre ou la pierre à une vitesse inimaginable.";

  it('desc de variante VERBATIM + folio juste → folio-ok (aucune extension du walk nécessaire)', () => {
    const data = {
      id: 'porteur',
      variants: [{ when: { rule: 'test-auto-bands' }, desc: VERBATIM, source: { book: 'zoo-imperial', page: 23 } }],
    };
    const entries = citedEntriesOf(data);
    // `citedEntriesOf` (`folioIntegrity.mjs`) chemine par PATH JSON, pas par id du porteur remonté :
    // même comportement que sur les 16 entrées anonymes réelles du dépôt (note l.252-253) — la clé
    // porteur (`porteur.variants[0]`) est celle de `variantRulesOf` (`variantRule.mjs`), un vocabulaire
    // DIFFÉRENT (guard #564 item 1, pas règle 5 item 2).
    expect(entries).toEqual([{ id: 'variants[0]', book: 'zoo-imperial', page: 23, desc: VERBATIM }]);
    expect(auditFolio(entries[0]).verdict).toBe('folio-ok');
  });

  it('MORSURE — desc de variante ALTÉRÉE d\'un mot → folio-ment (rouge)', () => {
    const altered = VERBATIM.replace('creusant', 'VOLANT');
    const entry = { id: 'variants[0]', book: 'zoo-imperial', page: 23, desc: altered };
    expect(auditFolio(entry).verdict).toBe('desc-introuvable');
  });

  it('MORSURE — desc de variante juste mais folio menteur → folio-ment (rouge)', () => {
    const entry = { id: 'variants[0]', book: 'zoo-imperial', page: 1, desc: VERBATIM };
    expect(auditFolio(entry).verdict).toBe('folio-ment');
  });
});

// ── Conflit de variantes : deux gardes simultanément vraies sur la MÊME entrée (#564) ─────────────
type When = { rule: string; equals?: unknown };

/** Deux gardes peuvent-elles être vraies EN MÊME TEMPS ? Une garde contraint UNE règle à UNE valeur
 *  (`equals`, défaut `true`) : deux gardes ne s'excluent QUE si elles contraignent la même règle à des
 *  valeurs différentes. Tout le reste est simultanément satisfiable — donc un conflit. */
function coActivable(a: When, b: When): boolean {
  return a.rule !== b.rule || (a.equals ?? true) === (b.equals ?? true);
}

/** Entrées portant DEUX variantes co-activables, par chemin JSON — `activeVariant` ne peut pas les
 *  départager (premier match). Walk générique, à toute profondeur, comme `citedEntriesOf`. */
function variantConflicts(node: unknown, path = ''): { key: string; rules: string[] }[] {
  const out: { key: string; rules: string[] }[] = [];
  if (Array.isArray(node)) {
    node.forEach((v, i) => out.push(...variantConflicts(v, `${path}[${i}]`)));
    return out;
  }
  if (!node || typeof node !== 'object') return out;
  const rec = node as Record<string, unknown>;
  const key = typeof rec.id === 'string' ? rec.id : path;
  const variants = rec.variants;
  if (Array.isArray(variants)) {
    const whens = variants.map((v) => (v as { when?: When }).when).filter((w): w is When => !!w);
    for (let i = 0; i < whens.length; i++)
      for (let j = i + 1; j < whens.length; j++)
        if (coActivable(whens[i], whens[j])) out.push({ key, rules: [whens[i].rule, whens[j].rule] });
  }
  for (const [k, v] of Object.entries(rec)) if (k !== 'variants') out.push(...variantConflicts(v, path ? `${path}.${k}` : k));
  return out;
}

describe('garde-fou « deux variantes jamais actives ensemble » (#564)', () => {
  it('0 entrée réelle de src/data/*.json ne porte deux variantes co-activables', () => {
    const files = readdirSync(DIR).filter((f) => f.endsWith('.json'));
    const offenders = files.flatMap((f) =>
      variantConflicts(JSON.parse(readFileSync(join(DIR, f), 'utf8'))).map((c) => ({ file: f, ...c })),
    );
    expect(offenders).toEqual([]);
  });

  it('MORSURE — deux variantes sur des règles DIFFÉRENTES (toutes deux activables) → rouge', () => {
    const data = [{
      id: 'fixture',
      variants: [
        { when: { rule: 'combat-aa-avantage-groupe' } },
        { when: { rule: 'autre-regle-optionnelle' } },
      ],
    }];
    expect(variantConflicts(data)).toEqual([{ key: 'fixture', rules: ['combat-aa-avantage-groupe', 'autre-regle-optionnelle'] }]);
  });

  it('MORSURE — deux variantes sur la MÊME règle à la MÊME valeur → rouge (la seconde est morte)', () => {
    const data = [{ id: 'fixture', variants: [{ when: { rule: 'r', equals: true } }, { when: { rule: 'r' } }] }];
    expect(variantConflicts(data)).toHaveLength(1);
  });

  it('deux variantes de la MÊME règle à des valeurs EXCLUSIVES passent (vert)', () => {
    const data = [{ id: 'fixture', variants: [{ when: { rule: 'r', equals: 'a' } }, { when: { rule: 'r', equals: 'b' } }] }];
    expect(variantConflicts(data)).toEqual([]);
  });
});

// ── Couverture du « Maxi » republié par Aux Armes, Annexe III (#564) ──────────────────────────────
const AA_ANNEXE_III = fileURLToPath(
  new URL('../../Source/WH - V4 - Aux Armes/13 - ANNEXE III NOUVEAUX TALENTS ET TALENTS MIS À JOUR.md', import.meta.url),
);

/** `label → ligne « Maxi » imprimée` de l'Annexe III, LUE dans le Source (jamais une liste recopiée). */
function maxiLinesOfAnnexeIII(): Map<string, string> {
  const out = new Map<string, string>();
  const lines = readFileSync(AA_ANNEXE_III, 'utf8').split(/\r?\n/);
  let current: string | null = null;
  for (const line of lines) {
    const head = /^#{3,4} \*\*(.+?)\*\*\s*$/.exec(line);
    if (head) { current = head[1].toLocaleLowerCase('fr'); continue; } // le label est de l'AFFICHAGE : la casse ne porte rien
    const maxi = /^\*\*Maxi :\*\*\s*(.+?)\s*$/.exec(line);
    if (maxi && current) { out.set(current, maxi[1]); current = null; }
  }
  return out;
}

describe('couverture du « Maxi » d’Aux Armes Annexe III (#564) — la forme imprimée est PORTÉE en donnée', () => {
  const maxi = maxiLinesOfAnnexeIII();
  const carriers = (JSON.parse(readFileSync(join(DIR, 'talents.json'), 'utf8')) as {
    id: string; label: string; max?: unknown; variants?: { when: { rule: string }; max?: unknown; source?: { book: string } }[];
  }[]).filter((t) => t.variants?.some((v) => v.source?.book === 'aux-armes'));

  it('l’Annexe III est lisible et chaque porteur de variante AA y a son entrée', () => {
    expect(carriers.length).toBeGreaterThan(0);
    expect(carriers.filter((t) => !maxi.has(t.label.toLocaleLowerCase('fr'))).map((t) => t.label)).toEqual([]);
  });

  for (const t of carriers) {
    it(`${t.id} — « Maxi : ${maxi.get(t.label.toLocaleLowerCase('fr'))} » (AA) est la forme EFFECTIVE sous la règle`, () => {
      const printed = maxi.get(t.label.toLocaleLowerCase('fr'))!;
      const v = t.variants!.find((x) => x.source?.book === 'aux-armes')!;
      const effective = 'max' in v ? v.max : t.max;
      if (/^\d+$/.test(printed)) expect(effective).toBe(Number(printed));
      else {
        const charId = bonusCharId(printed);
        expect(charId, `« ${printed} » ne nomme aucune Caractéristique de characteristics.json`).toBeTruthy();
        expect(effective).toEqual({ bonusOf: charId }); // la CARACTÉRISTIQUE imprimée, pas « un bonusOf quelconque »
      }
    });
  }
});

// ── Champs republiables : la liste blanche de chaque dataset = ses champs RÉSOLUS (#564 audit) ─────
/** Datasets autorisant des variantes, avec les champs que leur résolution APPLIQUE (`effectiveEntry`).
 *  Un dataset absent d'ici n'admet aucune variante (son schéma ne porte pas le champ `variants`). */
const RESOLVED_BY_FILE = new Map<string, readonly string[]>([
  [talentsDef.file, talentsDef.VARIANT_RESOLVED_FIELDS],
  [traitsDef.file, traitsDef.VARIANT_RESOLVED_FIELDS],
  [spellsDef.file, spellsDef.VARIANT_RESOLVED_FIELDS],
]);

/** Chaque nœud `variants[]` rencontré à toute profondeur, avec les champs qu'il DÉCLARE (hors `when`). */
function variantFieldsOf(node: unknown, path = ''): { key: string; fields: string[] }[] {
  const out: { key: string; fields: string[] }[] = [];
  if (Array.isArray(node)) {
    node.forEach((v, i) => out.push(...variantFieldsOf(v, `${path}[${i}]`)));
    return out;
  }
  if (!node || typeof node !== 'object') return out;
  const rec = node as Record<string, unknown>;
  const key = typeof rec.id === 'string' ? rec.id : path;
  if (Array.isArray(rec.variants)) {
    rec.variants.forEach((v, i) => {
      if (!v || typeof v !== 'object') return;
      out.push({ key: `${key}.variants[${i}]`, fields: Object.keys(v as object).filter((k) => k !== 'when') });
    });
  }
  for (const [k, v] of Object.entries(rec)) if (k !== 'variants') out.push(...variantFieldsOf(v, path ? `${path}.${k}` : k));
  return out;
}

/** Champs déclarés hors de la liste blanche du dataset — un champ admis mais lu BRUT par le moteur
 *  ferait afficher la variante au Codex pendant que le moteur applique la base. */
function unresolvedVariantFields(node: unknown, resolved: readonly string[] | undefined) {
  return variantFieldsOf(node)
    .map((v) => ({ key: v.key, extra: v.fields.filter((f) => !(resolved ?? []).includes(f)) }))
    .filter((v) => v.extra.length > 0);
}

describe('garde-fou « une variante ne déclare QUE des champs résolus » (#564 audit)', () => {
  it('0 variante réelle de src/data/*.json ne déclare un champ hors de la liste résolue de son dataset', () => {
    const files = readdirSync(DIR).filter((f) => f.endsWith('.json'));
    const offenders = files.flatMap((f) =>
      unresolvedVariantFields(JSON.parse(readFileSync(join(DIR, f), 'utf8')), RESOLVED_BY_FILE.get(f)).map((v) => ({ file: f, ...v })),
    );
    expect(offenders).toEqual([]);
  });

  it('MORSURE — une variante déclarant `passive` (lu BRUT par talentEffects.ts) → rouge', () => {
    const data = [{ id: 'fixture', variants: [{ when: { rule: 'combat-aa-avantage-groupe' }, desc: 'x', passive: [] }] }];
    expect(unresolvedVariantFields(data, talentsDef.VARIANT_RESOLVED_FIELDS)).toEqual([
      { key: 'fixture.variants[0]', extra: ['passive'] },
    ]);
  });

  it('MORSURE — un dataset SANS liste blanche (aucune résolution) rejette toute variante peuplée', () => {
    const data = [{ id: 'fixture', variants: [{ when: { rule: 'combat-aa-avantage-groupe' }, desc: 'x' }] }];
    expect(unresolvedVariantFields(data, RESOLVED_BY_FILE.get('domains.json'))).toEqual([
      { key: 'fixture.variants[0]', extra: ['desc'] },
    ]);
  });

  it('MORSURE — le SCHÉMA lui-même refuse le champ non résolu (zod, avant même la garde)', () => {
    const entry = JSON.parse(readFileSync(join(DIR, 'talents.json'), 'utf8'))
      .find((t: { id: string }) => t.id === 'fuite');
    expect(talentsDef.schema.safeParse([entry]).success).toBe(true);
    const poisoned = { ...entry, variants: [{ ...entry.variants[0], passive: [{ op: 'heal' }] }] };
    expect(talentsDef.schema.safeParse([poisoned]).success).toBe(false);
  });

  it('chaque champ résolu déclaré est bien un champ du schéma d’ENTRÉE de son dataset (aucune clé fantôme)', () => {
    for (const [file, fields] of RESOLVED_BY_FILE) {
      const shape = SHAPE_BY_FILE.get(file)!;
      expect(fields.filter((f) => !shape.includes(f)), file).toEqual([]);
    }
  });
});
