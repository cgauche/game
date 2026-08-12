/**
 * PORTE UNIQUE du montage d'une rangée de jet (#1262) — le NOYAU (`RollRowCore` → `buildRollRow`) et
 * la FAMILLE de constructeurs qui en dérivent : `participantRow` (l'unité du monteur MULTI),
 * `tableRow` (rangée porte-sélecteur d'un tirage sur table), `worldRow` (rangée sans acteur),
 * `witnessRow` (témoin d'un jet déjà subi, `rolled` par construction) et `frozenOpposedRow` (témoin à
 * jet figé, calendrier de découverte `opposedFrozen`).
 *
 * Le montage est de l'AFFICHAGE : aucune règle, aucun RNG, et surtout aucune décision de POSSESSION —
 * elle est posée au mint côté `state` (`rollFlowFactory`/`rollSeam.surfaceOf`) et seulement LUE ici.
 *
 * Chaque constructeur POSE la marque `ROLL_ROW_BRAND` : une rangée montée à la main ne la porte pas.
 * La propriété reste OPTIONNELLE au type (les littéraux historiques restent assignables) — la
 * transition est tenue par le cliquet `ui-ratchets` (xvii), pas par `tsc`, jusqu'au requis terminal.
 */
import type { Combatant } from '../engine/types';
import type { GameState } from '../state/store';
import type { RollRowData } from './RollShell';
import type { PanelRowData } from './RollPanel';
import { maskOpposedRow } from './opposedFrozen';

/**
 * ÉTIQUETTE d'origine d'une rangée d'affichage, posée par les constructeurs de CE module — et
 * SEULEMENT une étiquette : PORTÉE de l'instrument, à ne pas lire comme le murage du jumeau
 * `BuiltCascadeStep` (`state/stepBrand.ts`), qui documente l'INVERSE (propriété REQUISE, symbole
 * non exporté, forge murée au lint).
 *
 * Ce qu'elle donne : une marque MESURABLE à l'exécution — « ce constructeur cesse de poser la
 * marque » est une mutation rejouable en vitest. C'est la raison du choix divergent : avec un
 * `declare const` phantom (patron `stepBrand`), la marque n'existe qu'au type, seul `tsc` la voit,
 * et la mutation du lot n'aurait été ni rouge ni rejouable tant que `RollShell.rows` n'exige rien.
 *
 * Ce qu'elle NE donne PAS : aucune garantie de provenance. La propriété est OPTIONNELLE, donc un
 * `RollRowData` nu reste assignable à `BuiltRollRow` (types structurellement identiques) ; le
 * symbole est EXPORTÉ et `Symbol.for` est reproductible partout, donc la marque est forgeable sans
 * cast — le lint anti-`as BuiltRollRow` ne mord sur aucune de ces routes. Ce qui tient la
 * transition d'ici là, c'est le cliquet `ui/roll-row-mount-ratchet.test.ts`, pas le compilateur.
 *
 * Le murage vient au lot terminal : propriété REQUISE + `RollShell.rows: readonly BuiltRollRow[]`.
 * L'adoption du patron `stepBrand` (symbole non reproductible) s'y tranchera — décision de ce
 * lot-là, pas d'ici.
 */
export const ROLL_ROW_BRAND: unique symbol = Symbol.for('wfrp.builtRollRow');

/** Rangée d'affichage MONTÉE par un constructeur de ce module (étiquette optionnelle, cf. ci-dessus). */
export type BuiltRollRow = RollRowData & { readonly [ROLL_ROW_BRAND]?: true };

/** La rangée porte-t-elle la marque ? (le post-traitement par spread la conserve). */
export function isBuiltRollRow(row: RollRowData): boolean {
  return (row as BuiltRollRow)[ROLL_ROW_BRAND] === true;
}

/** Estampille — site UNIQUE de pose de la marque. */
function mark<T extends RollRowData>(row: T): T & { readonly [ROLL_ROW_BRAND]?: true } {
  return { [ROLL_ROW_BRAND]: true, ...row };
}

/** NOYAU d'une rangée MONO — les 11 champs que tout monteur de rangée remplit. Chance, relance
 *  gratuite et Résilience n'y sont PAS : elles se DÉRIVENT de `actor` une seule fois, au rendu
 *  (`RollRow`/`InfluenceRow`), au lieu d'être recopiées (et divergées) par chaque site. */
export interface RollRowCore {
  row: PanelRowData;
  /** Le jeteur — porte Chance/Résilience. Absent = rangée sans `Combatant` (vue pure, adversaire
   *  abstrait) : alors le site fournit lui-même les primitives via `extras`. */
  actor?: Combatant;
  onRoll?: () => void;
  rerollable?: boolean;
  onReroll?: () => void;
  darkPactable?: boolean;
  onDarkPact?: () => void;
  onBonusSL?: () => void;
  onForce?: () => void;
  forceShow?: boolean;
  freeReroll?: boolean;
}

/** Extras TYPÉS d'un site : tout `RollRowData` hors noyau et hors `rolled` (dérivé). */
export type RollRowExtras = Omit<RollRowData, keyof RollRowCore | 'rolled'>;

/**
 * MONTEUR MONO — le noyau ci-dessus + les extras TYPÉS du site (`resist`, `reverse`, `extendedDr`,
 * `declare`, `forcedRoll`…). Il pose `rolled` depuis la donnée du jet (`row.d` existe ⇒ le dé est
 * tombé) : DÉFINITION UNIQUE de « la rangée affiche un dé », plus un site pour la recalculer.
 */
export function buildRollRow(core: RollRowCore, extras?: RollRowExtras): BuiltRollRow {
  return mark({ ...core, rolled: !!core.row.d, ...extras });
}

/** Rangée-PARTICIPANT d'un flux MULTI (unité de `buildParticipantRows`) : le noyau + l'identité de
 *  slot (`key`), l'interactivité du siège, le libellé de jet et la barre de Test étendu. */
export interface ParticipantRowCore extends RollRowCore {
  key: string;
  interactive?: boolean;
  rollLabel?: RollRowData['rollLabel'];
  extendedDr?: RollRowData['extendedDr'];
}

export function participantRow(core: ParticipantRowCore): BuiltRollRow {
  const { key, interactive, rollLabel, extendedDr, ...rest } = core;
  return buildRollRow(rest, {
    key,
    ...(interactive !== undefined ? { interactive } : {}),
    ...(rollLabel != null ? { rollLabel } : {}),
    ...(extendedDr ? { extendedDr } : {}),
  });
}

/** Rangée PORTE-SÉLECTEUR d'un tirage sur table : elle n'a ni cible ni DR à pré-afficher, et aucun
 *  `onRoll` — ni bouton de rangée, ni « Lancer » hissé, ni cycle d'influence. Le dé s'y inscrit
 *  (`row.d`) quand le tirage est fait, et `rolled` le suit comme partout ailleurs. */
export function tableRow(core: {
  key: string;
  row: PanelRowData;
  forcedRoll?: RollRowData['forcedRoll'];
  fixedMark?: boolean;
}): BuiltRollRow {
  const { key, row, forcedRoll, fixedMark } = core;
  return buildRollRow({ row }, {
    key,
    ...(forcedRoll ? { forcedRoll } : {}),
    ...(fixedMark !== undefined ? { fixedMark } : {}),
  });
}

/** Rangée-MONDE (étape sans acteur présentable : désertion, Moral d'une bande) — aucun `Combatant`
 *  n'y porte de Chance/Résilience, le cycle d'influence est donc NUL par construction. */
export function worldRow(core: Omit<RollRowCore, 'actor'>, extras?: RollRowExtras): BuiltRollRow {
  return buildRollRow(core, extras);
}

/**
 * Rangée TÉMOIN d'un jet figé d'adversaire (figée, sans cycle d'influence), masquée jusqu'au jet de
 * réponse (calendrier `opposedFrozen`, #990). `rolled: true` par CONSTRUCTION : le jet figé est déjà
 * tombé même quand sa valeur reste opaque et s'affiche en `pending` (Marchandage, `BargainModal:93`).
 */
export function frozenOpposedRow(
  s: GameState,
  o: { ownerId?: string; responded: boolean; row: PanelRowData },
): BuiltRollRow {
  return maskOpposedRow(s, o, witnessRow({ row: o.row }));
}

/**
 * Rangée TÉMOIN d'un jet DÉJÀ SUBI (pile figée d'une séquence, rangées d'un pas validé) : lecture
 * seule (`interactive:false`, aucun cycle d'influence) et `rolled:true` par CONSTRUCTION — c'est ce
 * qui la distingue du noyau, dont le `rolled` se dérive du dé (`!!row.d`). Un témoin porte parfois
 * une NOTE seule (étape d'affichage/choix validée, pas figé sans ligne de jet) : la dériver rendrait
 * `false` et rallumerait la phase pré-jet sur une rangée qui n'a plus rien à lancer.
 */
export function witnessRow(core: {
  key?: RollRowData['key'];
  row: PanelRowData;
  fixedMark?: boolean;
  extendedDr?: RollRowData['extendedDr'];
}): BuiltRollRow {
  const { key, row, fixedMark, extendedDr } = core;
  return mark({
    row,
    rolled: true,
    interactive: false as const,
    ...(key !== undefined ? { key } : {}),
    ...(fixedMark !== undefined ? { fixedMark } : {}),
    ...(extendedDr ? { extendedDr } : {}),
  });
}
