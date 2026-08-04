import type { ReactNode } from 'react';
import type { ModLine, RollBreakdown, RollMask } from '../engine/combat';
import { Dice } from './Dice';
import { Icon } from './Icon';

/** RÉCONCILIE les chips avec le modificateur RÉEL de la ligne : l'écart non itemisé devient une chip
 *  NOMMÉE de plus, jamais un masquage. Le bornage de cible ne se DEVINE pas (une cible à 99 peut
 *  l'être sans écrêtage) : il est NOMMÉ seulement à hauteur de ce que le résolveur a MESURÉ
 *  (`clamped`, `engine/tests.ts` — négatif au plafond, positif au plancher) ; le reste est avoué
 *  « autres » et se résorbe en itemisant sa source à l'émission. Une ligne SANS aucune chip ne
 *  prétend rien détailler (« 55 −10 = 45 » se lit seul) : rien à réconcilier. */
function reconciled(mods: ModLine[], modifier: number, target: number, clamped?: number): ModLine[] {
  const residual = modifier - mods.reduce((s, m) => s + m.value, 0);
  if (!mods.length || residual === 0) return mods;
  // La part ÉCRÊTÉE n'est nommée que si elle est à la fois mesurée ET de même sens que le reste à
  // expliquer (un `clamped` sans rapport avec l'écart courant ne s'invite pas dans la ligne).
  const cut = clamped && Math.sign(clamped) === Math.sign(residual) && Math.abs(clamped) <= Math.abs(residual) ? clamped : 0;
  const rest = residual - cut;
  return [
    ...mods,
    ...(cut ? [{ label: `${cut < 0 ? 'plafond' : 'plancher'} ${target}`, value: cut }] : []),
    ...(rest ? [{ label: 'autres', value: rest }] : []),
  ];
}

/** Chips des modificateurs étiquetés (« Courte portée +40 », « Sonné −10 »…). */
function ModChips({ mods }: { mods: ModLine[] }) {
  return (
    <div className="rm-roll-mods">
      {mods.map((m, i) => (
        <span key={i} className={`rm-mod ${m.value >= 0 ? 'pos' : 'neg'}`}>
          {m.value >= 0 ? '+' : '−'}
          {Math.abs(m.value)} {m.label}
        </span>
      ))}
    </div>
  );
}

/** Sens du « ? » d'une cellule masquée, en langage JOUEUR — FORMULATION UNIQUE (title + aria-label,
 *  toutes cellules, toutes modales). `'roll'` : le jet existe, il attend MA réponse ; `'value'` : la
 *  valeur de l'adversaire ne se lit pas (marchand). */
const MASK_HINT: Record<RollMask, string> = {
  roll: 'Caché jusqu’à votre jet',
  value: 'Valeur de l’adversaire cachée',
};

/** Cellule de calcul d'un jet : « base ±mod = cible ». S'il n'y a AUCUN modificateur (nul ou
 *  compensé), on n'affiche QUE la cible — jamais « 55 = 55 ». `mask` : la cellule porte un « ? »
 *  (jamais un VIDE, qui dirait « pas de valeur ») + son sens. Source UNIQUE partagée par RollLine
 *  (résolu) et PendingRollLine (pré-jet). */
function RollCalc({ base, modifier, target, mask }: { base?: number; modifier: number; target: number; mask?: RollMask }) {
  const hasMod = modifier !== 0;
  return (
    <span
      className="rm-roll-calc"
      title={mask ? MASK_HINT[mask] : hasMod ? 'Compétence de base + modificateurs détaillés ci-dessous = cible à ne pas dépasser' : undefined}
      aria-label={mask ? MASK_HINT[mask] : undefined}
    >
      {mask ? '?' : (hasMod
        ? <>{base} {modifier > 0 ? '+' : '−'}{Math.abs(modifier)} = <b>{target}</b></>
        : <b>{target}</b>)}
    </span>
  );
}

/** Une ligne de jet : base + modificateurs = cible · d100 · DR (✓/✗), + le détail étiqueté
 *  des modificateurs (« Courte portée +40 », « Viser +20 »…). Les chips sont TOUJOURS servies quand
 *  la ligne en porte : un total qu'elles ne réconcilient pas se COMPLÈTE d'une chip nommée
 *  (`reconciled`) au lieu de tout effacer — le joueur ne perd jamais le détail au moment où il lit
 *  son résultat.
 *  `d.mask` (site de rendu UNIQUE du masque) : `'value'` cache le calcul ; `'roll'` masque en plus
 *  le dé et le ✓/✗ ±DR par un « ? » PAR CELLULE (une cellule VIDE dirait « pas de jet »), retire
 *  l'accent ok/fail — la couleur EST le verdict — et pose l'état `.masked` (liseré et empreintes
 *  de colonnes de la ligne résolue : la révélation change les valeurs, pas la géométrie). Les chips
 *  de modificateurs restent affichées. */
export function RollLine({ d }: { d: RollBreakdown }) {
  const mods = reconciled(d.mods ?? [], d.modifier, d.target, d.clamped);
  const masked = d.mask === 'roll';
  return (
    <div className="rm-roll-block">
      <div className={`rm-roll ${masked ? 'masked' : d.success ? 'ok' : 'fail'}`}>
        <span className="rm-roll-label">{d.label}</span>
        <RollCalc base={d.base} modifier={d.modifier} target={d.target} mask={d.mask} />
        <span className="rm-roll-dice" title={masked ? MASK_HINT.roll : undefined} aria-label={masked ? MASK_HINT.roll : undefined}>
          <Icon id="nav/dice" size="sm" /> <b>{masked ? '?' : <Dice roll={d.roll} />}</b>
        </span>
        <span className="rm-roll-sl" title={masked ? MASK_HINT.roll : undefined} aria-label={masked ? MASK_HINT.roll : undefined}>
          {masked ? '?' : <>{d.success ? '✓' : '✗'} {d.sl >= 0 ? '+' : '−'}{Math.abs(d.sl)} DR</>}
        </span>
      </div>
      {mods.length > 0 && <ModChips mods={mods} />}
    </div>
  );
}

/** Ligne de jet EN ATTENTE (pré-jet) : même géométrie que `RollLine`, dé et DR vides — l'avant-jet
 *  est le même bloc que le résultat, pré-rempli. `mask` (ligne adverse) : compétence + chips
 *  de bonus/malus SANS total (on ne révèle pas le score de l'adversaire). */
export interface PendingRoll {
  /** Libellé du jet — texte, ou nœud riche (ex. compétence en chip `EntityRef` d'un pied de volet). */
  label: ReactNode;
  /** Valeur de compétence de base (absente si `mask`). */
  base?: number;
  /** Cible effective (base + modificateurs COMBINÉS, plafonds inclus) ; défaut : base + somme des chips. */
  target?: number;
  mods?: ModLine[];
  /** ÉCRÊTAGE mesuré de la cible (même donnée que `RollBreakdown.clamped`) — seule autorisation de
   *  nommer « plafond/plancher » avant le jet. */
  clamped?: number;
  /** Ligne adverse : ne pas afficher base/cible (portrait + compétence + bonus/malus seulement).
   *  Aucun dé n'est encore posé ici : `'value'` et `'roll'` cachent la même chose. */
  mask?: RollMask;
}

export function PendingRollLine({ p }: { p: PendingRoll }) {
  const declared = p.mods ?? [];
  const target = p.target ?? (p.base != null ? p.base + declared.reduce((s, m) => s + m.value, 0) : 0);
  const diff = p.base != null ? target - p.base : 0;
  // Pré-jet : MÊME réconciliation que la ligne résolue — une cible déjà plafonnée/portant un mod non
  // itemisé montre son écart nommé au lieu d'un total qui ne tombe pas juste.
  const mods = p.base != null ? reconciled(declared, diff, target, p.clamped) : declared;
  return (
    <div className="rm-roll-block">
      <div className="rm-roll pending">
        <span className="rm-roll-label">{p.label}</span>
        {/* MASQUÉE → « ? » (une valeur est cachée) ; SANS base ni masque → cellule vide (il n'y a
            rien à cacher : cette ligne n'a simplement pas de valeur chiffrée). */}
        {p.mask || p.base != null
          ? <RollCalc base={p.base} modifier={diff} target={target} mask={p.mask} />
          : <span className="rm-roll-calc" />}
        <span className="rm-roll-dice">
          <Icon id="nav/dice" size="sm" /> <b className="rm-roll-empty">à lancer</b>
        </span>
        <span className="rm-roll-sl rm-roll-sl-pending" aria-hidden="true">—</span>
      </div>
      {mods.length > 0 && <ModChips mods={mods} />}
    </div>
  );
}

/** Présentation canonique d'un d100 SUR TABLE à conséquences (Oups !, Critiques, Imparfaites,
 *  mutations…) : rangée compacte NEUTRE `nom de la table · dé · résultat` — remplace les
 *  anciens verdicts plein écran rouge/vert (`.test-result`). `roll` absent : libellé seul.
 *
 *  `mod` = modificateur appliqué au dé pour atteindre la ligne (ex. −20 d'overkill, LDB 18 l.16).
 *  Non nul → la pastille porte le dé EFFECTIF (celui qui a résolu la ligne affichée) et l'opération
 *  qui y mène : montrer le seul dé NATUREL à côté d'une ligne obtenue avec un modificateur est une
 *  valeur menteuse (le joueur lit 76, la ligne vient de 56). */
export function TableRollLine({ table, roll, die, result, mod = 0 }: { table: string; roll?: number | null; die?: number | null; result?: string; mod?: number }) {
  // Le dé EFFECTIF est celui du RÉSOLVEUR (`CascadeTableResult.die`, qui borne au plancher de SA
  // table) : l'UI l'affiche, elle ne le recalcule pas — un second calcul ici divergerait dès qu'une
  // table déclarerait un plancher ≠ 1. Repli sur le naturel quand aucun résolveur n'est en jeu.
  const effective = die ?? roll ?? null;
  return (
    <div className="rm-roll-block">
      <div className="rm-roll table">
        <span className="rm-roll-label">{table}</span>
        <span className="rm-roll-calc rm-table-result">{result}</span>
        <span className="rm-roll-dice">
          {effective != null && (
            <>
              <Icon id="nav/dice" size="sm" /> <b><Dice roll={effective} /></b>
              {mod !== 0 && <span className="hint">({roll} {mod > 0 ? '+' : '−'} {Math.abs(mod)})</span>}
            </>
          )}
        </span>
      </div>
    </div>
  );
}
