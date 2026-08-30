/**
 * ISSUE SCELLÉE d'un jet — seam de jet unique (#275, Décision 2) : `TestOutcome` a un CONSTRUCTEUR
 * PRIVÉ + une marque nominale (`unique symbol`) →
 * un littéral `{won, sl}` n'est pas assignable (échec STRUCTUREL) — « un contournement ne compile pas ».
 *
 * `TestOutcome.seal` est le SEUL point de scellement (whitelist de quarantaine posée en Ronde 4, #274) :
 * `rollSeam.ts`, `rollFlowFactory.ts`, `cascade.ts` (résolveur générique), `rollFlowSpecs.ts` (resolveurs
 * de spec). Le TYPE `TestOutcome` (lecture) reste libre partout — seule la CONSTRUCTION est scellée.
 *
 * Écart documenté vs le squelette du doc (Décision 2) : `detail` (`RollBreakdown`) est ici OPTIONNEL
 * (`detail?: RollBreakdown`), pas obligatoire. Le doc l'a en 2ᵉ paramètre non-optionnel ; en pratique
 * la majorité des `outcome:` de `rollFlowSpecs.ts` (Test d'équipage/activité/évaluation/marchandage/
 * corruption/Calme…) n'ont PAS de `RollBreakdown` (label/base/modifier détaillés) — seulement un
 * `{roll,target,sl,success}` nu (`TestResult`). Le rendre obligatoire aurait forcé les sites SANS
 * breakdown à en FABRIQUER un factice (mods/base à 0) — de la fausse donnée typée, jamais consommée
 * (rien ne lit `.detail` aujourd'hui). Les sites qui possèdent un VRAI `RollBreakdown` (attaque/défense/
 * piétinement/contre-sort/opposition…) le font toujours transiter tel quel.
 */
import type { TestResult } from './tests';
import type { RollBreakdown } from './combat';

// Écart mineur vs le squelette du doc : `declare const OUTCOME_BRAND: unique symbol` (type-only) n'a
// PAS d'existence runtime — la propriété calculée `[OUTCOME_BRAND]` sur la classe le référence à
// l'EXÉCUTION (chaque instanciation), donc `ReferenceError: OUTCOME_BRAND is not defined`. Un vrai
// `Symbol()` est nécessaire ; la marque reste NOMINALE (le type `unique symbol` interdit toujours le
// forgeage structurel, seul le mode de déclaration change).
const OUTCOME_BRAND: unique symbol = Symbol('TestOutcome.brand');

export class TestOutcome {
  readonly won: boolean;
  readonly sl: number;
  readonly roll: number;
  readonly target: number;
  /** Marque NOMINALE (privée) : un objet littéral ne peut jamais la fournir → pas de forgeage. */
  private readonly [OUTCOME_BRAND] = true;
  private constructor(tr: TestResult, readonly detail?: RollBreakdown) {
    this.won = tr.success;
    this.sl = tr.sl;
    this.roll = tr.roll;
    this.target = tr.target;
    void this[OUTCOME_BRAND];
  }
  /** SCELLEMENT — appelé UNIQUEMENT par le noyau du seam (whitelist #274, Ronde 4). */
  static seal(tr: TestResult, detail?: RollBreakdown): TestOutcome {
    return new TestOutcome(tr, detail);
  }
}
