/**
 * COUTURE UNIQUE du sélecteur de dé d'une rangée de jet — dérivée, jamais recopiée par modale.
 *
 * `RollShell` porte déjà l'identité du flux (`flowKey`, = le PRÉFIXE des délégués de store, cf.
 * `FLOW_VERBS`) et chaque rangée porte son acteur (`row.actor`) et, en multi, l'id de son slot
 * (`row.key`). Cela suffit à dériver le sélecteur pour TOUTE modale de jet : plus aucune modale ne
 * calcule son `forcedDie` (les six qui le faisaient — attaque/défense/incantation/cascade/coup dans
 * le dos/piétinement — ne le font plus), et une modale qui n'en avait jamais l'offre désormais.
 *
 * DEUX provenances, un seul contrôle (`ForcedRollPicker`) :
 *  - **Résilience** — LDB 17 l.68 : « au lieu de lancer les dés pour un Test, vous choisissez le
 *    résultat ». Le slot est `forced` (le point est déjà dépensé par `forceSuccess`) ; le dé choisi
 *    doit rester une réussite (`maxForcedRoll`). INCONDITIONNEL : offert sur tout flux à Résilience,
 *    y compris un Test binaire (le dé y change le DR affiché, jamais l'issue).
 *  - **Dé fixé** — option de confort `des-fixes` (`engine/fixedDie.ts`), gatée par le prédicat
 *    UNIQUE `canFixDie` (option + contrôle du siège). Tout le d100, avant comme après le jet.
 *
 * L'écriture passe TOUJOURS par le délégué de store `<prefix>SetForcedRoll` (jamais
 * `FLOW_HANDLERS[k].setForcedRoll(get,set,…)` en direct) : c'est lui que le routage d'intents coop
 * intercepte côté invité.
 */
import { FLOW_HANDLERS, FLOW_VERBS } from '../state/rollFlowSpecs';
import { canFixDie } from '../state/netOwnership';
import { FIXED_ROLL_MAX } from '../engine/fixedDie';
import type { GameState } from '../state/store';
import type { RollRowProps } from './RollRow';

export type FlowKey = keyof typeof FLOW_VERBS;

type SetForcedMono = (roll: number) => void;
type SetForcedMulti = (pid: string, roll: number) => void;

/**
 * Sélecteur de dé de CETTE rangée, ou `undefined`. `row.noForcedDie` = opt-out explicite du SITE
 * (cible Inconsciente : le moteur a déjà choisi le meilleur dé, seule la Localisation reste un choix).
 * `row.forcedRoll` déjà posé par un appelant reste prioritaire (aucune régression possible).
 */
export function rowForcedDie(
  s: GameState,
  flowKey: FlowKey | undefined,
  row: Pick<RollRowProps, 'actor' | 'rolled' | 'forcedRoll' | 'noForcedDie' | 'interactive'> & {
    key?: string | number;
    /** Déclencheur du jet de CETTE rangée. REQUIS et explicitement `null` quand la rangée n'est pas
     *  lançable (témoin, post-jet) : la saisie PRÉ-jet LANCE puis substitue, donc sans lui aucun dé
     *  pré-jet n'est offert. L'omettre est une erreur de compilation, jamais un champ mort. */
    onRoll: (() => void) | null;
  },
  rolled: boolean,
): { forcedRoll?: RollRowProps['forcedRoll']; fixedMark?: boolean } {
  if (row.forcedRoll) return { forcedRoll: row.forcedRoll };
  if (!flowKey || row.noForcedDie || row.interactive === false) return {};
  const flow = FLOW_HANDLERS[flowKey];
  const verbs = FLOW_VERBS[flowKey].verbs as readonly string[];
  if (!flow || !verbs.includes('setForcedRoll')) return {};
  // Un dé ne se SAISIT que là où le socle sait le RÉÉVALUER : `fixable` = l'ACCESSEUR DE DÉ du flux est
  // complet (lire où vit le dé, réécrire l'issue re-dérivée). Même gate côté fabrique (`setForcedRoll`).

  const multi = FLOW_VERBS[flowKey].kind === 'multi';
  const pid = multi && row.key != null ? String(row.key) : undefined;
  const slot = flow.slotOf(() => s, pid);
  if (!slot) return {};

  const delegate = (s as unknown as Record<string, unknown>)[`${flowKey}SetForcedRoll`];
  if (typeof delegate !== 'function') return {};
  const onSet = multi
    ? (r: number) => (delegate as SetForcedMulti)(pid ?? '', r)
    : (r: number) => (delegate as SetForcedMono)(r);

  const isRolled = row.rolled ?? rolled;
  if (!flow.fixable || !flow.picker) return {};
  const pick = flow.picker(slot, row.actor, s);
  // La marque appartient au dé COURANT : une Résilience postérieure re-tire le dé, la mention s'efface.
  const mark = !!slot.fixed && !slot.forced;

  // Résilience en cours : le dé CHOISI prime (le point est dépensé, l'issue reste une réussite).
  if (slot.forced && pick) return { forcedRoll: { ...pick, onSet }, fixedMark: mark };
  if (!canFixDie(s, row.actor?.id)) return { fixedMark: mark };
  if (isRolled) return pick ? { forcedRoll: { roll: pick.roll, target: pick.target, onSet, fixed: true }, fixedMark: mark } : { fixedMark: mark };
  // AVANT le jet : la saisie LANCE puis substitue — même geste que la Résilience pré-jet (`preRollForce`).
  // Sans déclencheur de jet, la rangée n'a rien à substituer : aucun champ n'est offert.
  const doRoll = row.onRoll;
  if (!doRoll) return { fixedMark: mark };
  return {
    // `roll: null` — le champ est une OFFRE : rien n'est fixé tant que le joueur n'a pas saisi.
    forcedRoll: { roll: null, target: FIXED_ROLL_MAX, fixed: true, onSet: (r) => { doRoll(); onSet(r); } },
    fixedMark: mark,
  };
}
