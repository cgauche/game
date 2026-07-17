/**
 * Garde des VARIANTES réglées (#563/#564 Lot 3) : `when.rule` DOIT être un id de `OPTIONAL_RULES`
 * (item 1, gate fantôme sinon), et la règle stricte 5 (verbatim + folio) s'applique PAR VARIANTE
 * comme pour l'ancre (item 2 — `folioIntegrity.mjs:citedEntriesOf` la découvre déjà, aucune
 * extension nécessaire : une variante est structurellement `{desc, source}` comme une entrée).
 *
 * Lot 4 (#564) migre `talents.json` (9 talents `descAA`/`combat.aa` → `variants`) — la garde
 * EXHAUSTIVE ci-dessous couvre ce fichier réel ; les morsures de la règle 5 restent des fixtures
 * SYNTHÉTIQUES (patron partagé avec `secondary-ref-integrity.test.ts`).
 */
import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { OPTIONAL_RULES } from '../engine/policy';
import { unknownVariantRules, variantRulesOf } from '../../scripts/guards/lib/variantRule.mjs';
import { citedEntriesOf, auditFolio } from '../../scripts/guards/lib/folioIntegrity.mjs';

const DIR = fileURLToPath(new URL('.', import.meta.url));
const KNOWN_RULE_IDS = new Set(OPTIONAL_RULES.map((r) => r.id));

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

  it('EXHAUSTIF : seul `talents.json` référence `variants` en donnée (Lot 4 #564 — 9 talents migrés, contrôle croisé texte brut)', () => {
    const files = readdirSync(DIR).filter((f) => f.endsWith('.json'));
    const offenders = files.filter((f) => f !== 'talents.json' && readFileSync(join(DIR, f), 'utf8').includes('"variants"'));
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
