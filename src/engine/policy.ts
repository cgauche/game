/**
 * Registre des RÈGLES OPTIONNELLES (« règles maison ») — SOURCE UNIQUE.
 *
 * Une règle = UNE entrée `OptionalRule`. Le moteur lit sa valeur effective via `rule(id)`
 * (= surcharge runtime ⊕ défaut). Le panneau in-game (state/houseRules + ui/HouseRulesPanel)
 * écrit la surcharge par `setRule` et la PERSISTE ; il se RÉ-GÉNÈRE depuis ce registre (un
 * contrôle par entrée selon `kind`), donc ajouter une règle = ajouter une entrée ici, et elle
 * apparaît automatiquement en jeu. Module FEUILLE pur : aucune dépendance store/UI (la persistance
 * vit dans state/, pas ici — le moteur reste pur).
 *
 * Réf. : Livre de base, chapitre « Tests » et autres « Option : … ».
 */
export type RuleKind = 'flag' | 'param' | 'mode' | 'flow';
export type RuleValue = boolean | number | string;

export interface OptionalRule {
  /** Identifiant stable (clé de surcharge + persistance). */
  id: string;
  /** Libellé affiché dans le panneau. */
  label: string;
  /** Citation de la règle (« LDB 12 l.48 »), montrée en infobulle. */
  ref: string;
  /** Sous-système (regroupement dans le panneau). */
  group: string;
  /** Forme du contrôle auto-rendu : flag=toggle, param=nombre, mode=select, flow=toggle lourd. */
  kind: RuleKind;
  /** Valeur par défaut (RAW). */
  default: RuleValue;
  /** Valeurs possibles (kind='mode'). */
  options?: string[];
  /** Bornes (kind='param'). */
  min?: number;
  max?: number;
  step?: number;
  /** Aide courte (optionnelle). */
  hint?: string;
}

/**
 * LE registre. Ajouter une règle optionnelle = ajouter une entrée (et un SEUL point de lecture
 * dans son module métier via `rule(id)`). Les règles de Test pilotent `testPolicy.getTestPolicy()`.
 */
export const OPTIONAL_RULES: OptionalRule[] = [
  {
    id: 'test-auto-bands',
    label: 'Réussite / échec automatiques',
    ref: 'LDB 12 l.46/48',
    group: 'Tests',
    kind: 'mode',
    default: 'normal',
    options: ['normal', 'inverted', 'off'],
    hint: 'normal = 01-05 réussite auto / 96-00 échec auto (RAW) ; inverted = l’inverse ; off = aucune bande.',
  },
  {
    id: 'test-fast-sl',
    label: 'Calculer rapidement un DR',
    ref: 'LDB 12 l.128',
    group: 'Tests',
    kind: 'flag',
    default: false,
    hint: 'Sur une réussite, le DR = le chiffre des dizaines du jet.',
  },
  {
    id: 'combat-advantage-cap',
    label: 'Plafond d’Avantage',
    ref: 'LDB 15 l.17',
    group: 'Combat',
    kind: 'param',
    default: 10,
    min: 1,
    max: 20,
    hint: 'Limiter les Avantages : valeur maximale d’Avantage qu’un combattant peut accumuler.',
  },
];

const RULES_BY_ID = new Map<string, OptionalRule>(OPTIONAL_RULES.map((r) => [r.id, r]));
const overrides = new Map<string, RuleValue>();

/** Définition d'une règle (métadonnée pour l'auto-rendu du panneau). */
export function ruleDef(id: string): OptionalRule | undefined {
  return RULES_BY_ID.get(id);
}

/** Valeur EFFECTIVE d'une règle : surcharge runtime si présente, sinon défaut. */
export function rule(id: string): RuleValue {
  if (overrides.has(id)) return overrides.get(id)!;
  return RULES_BY_ID.get(id)?.default ?? false;
}

/** Surcharge runtime (depuis le panneau in-game). Ignore un id inconnu. */
export function setRule(id: string, value: RuleValue): void {
  if (RULES_BY_ID.has(id)) overrides.set(id, value);
}

/** Retire la surcharge → retour au défaut. */
export function resetRule(id: string): void {
  overrides.delete(id);
}

/** Snapshot des surcharges (pour persistance). */
export function ruleOverrides(): Record<string, RuleValue> {
  return Object.fromEntries(overrides);
}

/** Remplace les surcharges (depuis la persistance). Ignore les ids inconnus. */
export function loadRuleOverrides(o: Record<string, RuleValue>): void {
  overrides.clear();
  for (const [k, v] of Object.entries(o)) if (RULES_BY_ID.has(k)) overrides.set(k, v);
}
