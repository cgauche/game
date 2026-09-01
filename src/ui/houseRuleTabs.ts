import { OPTIONAL_RULES, type OptionalRule } from '../engine/policy';

/**
 * Découpe du panneau des règles optionnelles en ONGLETS — DÉRIVÉE du registre, jamais une liste de
 * groupes en dur (une règle d'un groupe inédit doit apparaître toute seule, cf. #839 / chantier VDM).
 *
 * Autant de groupes que d'onglets ne ferait pas des onglets utiles (compte des règles et des groupes :
 * `docs/regles-optionnelles.md`, GÉNÉRÉ) : un groupe n'obtient son onglet qu'à partir
 * de `OWN_TAB_MIN` entrées ; les résiduels se rassemblent dans un onglet fourre-tout DÉRIVÉ, où ils
 * gardent leur intertitre de groupe. Le partitionnement est TOTAL : la somme des règles des onglets
 * vaut toujours `OPTIONAL_RULES.length` (garde `houseRuleTabs.test.ts`).
 */
export const OWN_TAB_MIN = 4;
export const MISC_TAB_KEY = 'divers';
export const MISC_TAB_LABEL = 'Divers';

export interface RuleTab {
  /** Clé d'onglet (`g:<groupe>` pour un groupe propre, `divers` pour le fourre-tout). */
  key: string;
  label: string;
  /** Groupes rassemblés dans l'onglet, dans l'ordre du registre. */
  groups: string[];
  rules: OptionalRule[];
}

export function houseRuleTabs(rules: OptionalRule[] = OPTIONAL_RULES, min = OWN_TAB_MIN): RuleTab[] {
  const byGroup = new Map<string, OptionalRule[]>();
  for (const r of rules) (byGroup.get(r.group) ?? byGroup.set(r.group, []).get(r.group)!).push(r);
  const own: RuleTab[] = [];
  const misc: RuleTab = { key: MISC_TAB_KEY, label: MISC_TAB_LABEL, groups: [], rules: [] };
  for (const [group, list] of byGroup) {
    if (list.length >= min) own.push({ key: `g:${group}`, label: group, groups: [group], rules: list });
    else {
      misc.groups.push(group);
      misc.rules.push(...list);
    }
  }
  own.sort((a, b) => b.rules.length - a.rules.length);
  return misc.rules.length ? [...own, misc] : own;
}
