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
export type RuleKind = 'flag' | 'param' | 'mode';
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
  /** Forme du contrôle auto-rendu : flag=toggle, param=nombre, mode=select. */
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
    id: 'test-over-100',
    label: 'Tests supérieurs à 100 %',
    ref: 'LDB 12 l.101',
    group: 'Tests',
    kind: 'flag',
    default: false,
    hint: 'Une valeur de Compétence/Caractéristique au-delà de 100 % n’est plus plafonnée : +1 DR par tranche de 10 % au-dessus de 100 sur une réussite.',
  },
  {
    id: 'test-auto-band-width',
    label: 'Largeur des bandes automatiques',
    ref: 'LDB 12 l.48',
    group: 'Tests',
    kind: 'param',
    default: 5,
    min: 0,
    max: 10,
    hint: 'Largeur des bandes de réussite/échec automatiques : 01-N réussite, (101−N)-00 échec. Défaut 5 (01-05 / 96-00) ; 0 = aucune bande.',
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
  {
    id: 'combat-diff-cap-bonus',
    label: 'Plafond des bonus de Difficulté',
    ref: 'LDB 14 l.126',
    group: 'Combat',
    kind: 'param',
    default: 60,
    min: 0,
    max: 100,
    step: 10,
    hint: 'Plafond de la SOMME des bonus de Difficulté d’un Test (RAW +60 = Très Facile). L’Avantage reste hors plafond.',
  },
  {
    id: 'combat-diff-cap-malus',
    label: 'Plafond des malus de Difficulté',
    ref: 'LDB 14 l.126',
    group: 'Combat',
    kind: 'param',
    default: 30,
    min: 0,
    max: 100,
    step: 10,
    hint: 'Plafond de la SOMME des malus de Difficulté d’un Test (RAW −30 = Très Difficile), exprimé en valeur positive.',
  },
  {
    id: 'combat-frappe-mortelle',
    label: 'Frappe Mortelle',
    ref: 'LDB 14 l.9',
    group: 'Combat',
    kind: 'flag',
    default: false,
    hint: 'Tuer un adversaire en un seul coup permet d’enchaîner sur un autre (jusqu’au Bonus de CC). La règle de Taille enchaîne déjà sur une simple touche, indépendamment de cette option.',
  },
  {
    id: 'combat-sudden-death',
    label: 'Mort Subite',
    ref: 'LDB 18 l.51',
    group: 'Combat',
    kind: 'mode',
    default: 'figurants',
    options: ['figurants', 'tous', 'off'],
    hint: 'Sur un coup fatal (Dégâts > PB), la cible meurt ou tombe Inconsciente sans passer par les Blessures critiques. figurants = figurants seuls (défaut) ; tous = aussi les PNJ importants ; off = personne (tout passe par les critiques). Jamais les PJ.',
  },
  {
    id: 'creation-signes-astraux',
    label: 'Signes astraux à la création',
    ref: 'ADE2 ch.03',
    group: 'Création',
    kind: 'flag',
    default: true,
    hint: 'Étape optionnelle ADE2 : un signe astral (1d100, +25 PX si le tirage est gardé) qui modifie les attributs de départ ou octroie un Talent, plus l’ascendant et les demeures célestes (flavor). Désactiver retire l’étape du créateur.',
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
