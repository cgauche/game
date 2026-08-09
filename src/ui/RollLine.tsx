import type { ReactNode } from 'react';
import type { ModLine, RollBreakdown, RollMask } from '../engine/combat';
import type { VerdictReason } from '../engine/tests';
import { DIFFICULTY_LABELS, DIFFICULTY_MODIFIERS, type Difficulty } from '../engine/types';
import { Dice } from './Dice';
import { Icon } from './Icon';
import { CodexRef } from './compendium/CodexRef';
import { RULE_REF, type ModProvenance } from '../engine/ruleRefs';
import type { StakeRef } from '../data';
import { actorIn } from '../state/combatants';
import { useGame, type GameState } from '../state/store';

/** Valeur de la Difficulté déjà comprise dans le modificateur de la ligne — elle est EXPLIQUÉE par le
 *  texte de la ligne, donc retirée de ce que les chips ont à réconcilier (#1072). */
function difficultyValue(difficulty?: Difficulty): number {
  return difficulty ? DIFFICULTY_MODIFIERS[difficulty] : 0;
}

/** Difficulté du Test SUR la ligne, en texte + valeur (« — Accessible (+20) ») : elle dit la
 *  NATURE du jet, pas une circonstance — les chips restent aux modificateurs circonstanciels
 *  (Soutien, Avantage, plafond mesuré…). `easedBy` (`FlowTest.easierIf`) voyage avec elle. */
function DifficultyText({ difficulty, easedBy }: { difficulty?: Difficulty; easedBy?: string }) {
  if (!difficulty) return null;
  return (
    <span className="rm-roll-diff">
      {' '}— {DIFFICULTY_LABELS[difficulty]}
      {easedBy ? `, allégée : ${easedBy}` : ''}
    </span>
  );
}

/** RÉCONCILIE les chips avec le modificateur RÉEL de la ligne : l'écart non itemisé devient une chip
 *  NOMMÉE de plus, jamais un masquage. Le bornage de cible ne se DEVINE pas (une cible à 99 peut
 *  l'être sans écrêtage) : il est NOMMÉ seulement à hauteur de ce que le résolveur a MESURÉ
 *  (`clamped`, `engine/tests.ts` — négatif au plafond, positif au plancher) ; le reste est avoué
 *  « autres » et se résorbe en itemisant sa source à l'émission. Une ligne SANS aucune chip NI
 *  Difficulté ne prétend rien détailler (« 55 −10 = 45 » se lit seul) : rien à réconcilier. La
 *  Difficulté (`diff`, rendue en TEXTE sur la ligne, #1072) compte comme un détail déjà donné : elle
 *  ENGAGE la réconciliation sans y contribuer de chip — sinon une ligne dont elle est le seul poste
 *  tairait son écrêtage mesuré (régression #1064). */
function reconciled(mods: ModLine[], modifier: number, target: number, clamped?: number, diff = 0): ModLine[] {
  const residual = modifier - mods.reduce((s, m) => s + m.value, 0);
  if ((!mods.length && !diff) || residual === 0) return mods;
  // La part ÉCRÊTÉE n'est nommée que si elle est à la fois mesurée ET de même sens que le reste à
  // expliquer (un `clamped` sans rapport avec l'écart courant ne s'invite pas dans la ligne).
  const cut = clamped && Math.sign(clamped) === Math.sign(residual) && Math.abs(clamped) <= Math.abs(residual) ? clamped : 0;
  const rest = residual - cut;
  // Une chip « autres » n'est PAS une information : c'est un monteur de ligne qui ment (base fondue,
  // modificateur jamais nommé). En DEV le fait se journalise à l'écran où il se produit — le compte
  // sert de sonde au cliquet « zéro chip anonyme » (#1153) ; en PROD, rien à dire au joueur.
  if (rest && import.meta.env?.DEV) {
    ANONYMES.count += 1;
    console.error(`[RollLine] chip « autres » (${rest}) : la ligne ne s'explique pas — itemiser la source à l'ÉMISSION (rollSeam.rollLine).`);
  }
  return [
    ...mods,
    ...(cut ? [{ label: `${cut < 0 ? 'plafond' : 'plancher'} ${target}`, value: cut }] : []),
    ...(rest ? [{ label: 'autres', value: rest }] : []),
  ];
}

/** COMPTEUR DEV des chips « autres » réellement rendues (#1153) — sonde partagée : un écran de recette
 *  ou un test peut lire `ANONYMES.count` pour prouver qu'aucune ligne n'a rien à cacher. Inerte en PROD. */
export const ANONYMES = { count: 0 };

/**
 * Nom d'AFFICHAGE d'une provenance — COUTURE UNIQUE de la résolution id→nom (#1078).
 *
 * Les producteurs de `ModLine` sont PURS : ils ne connaissent que des ids stables. Résoudre au
 * producteur exigerait que chaque site passe un résolveur — et le site N+1 l'oublie (recette B3a :
 * « pregen-101 » à l'écran depuis `medicFlow`). La résolution vit donc ICI, au seul endroit que
 * TOUTE chip traverse : `actorIn` (combat OU groupe, primitive partagée). Un `label` qui vaut son
 * propre id est traité comme absent — c'est l'empreinte exacte du repli fautif. Sans acteur
 * résolvable (source hors combattants), le `label` fourni fait foi ; en dernier recours l'id, jamais
 * un vide muet.
 */
function provenanceLabel(p: ModProvenance, state: GameState): string {
  const raw = p.label && p.label !== p.id ? p.label : undefined;
  const resolved = p.id ? actorIn(state, p.id)?.label : undefined;
  return raw ?? resolved ?? p.label ?? p.id ?? '—';
}

/** UNE chip de modificateur. Toute ligne qui porte sa RÈGLE (`ModLine.ref`, ids stables) devient une
 *  chip CODEX-LIÉE : survol/focus = le texte de la règle, clic = sa fiche — la chip EST l'affordance
 *  (aucun ⓘ à côté). L'`instance` transmise est le circonstanciel tel qu'il est lu à l'écran
 *  (« +10 Soutien »), ce que le Codex reprend à l'ouverture. Sans `ref`, la chip reste le span muet.
 *  `by` (provenance STRUCTURÉE : les soutiens) est NOMMÉE par `provenanceLabel` et se lit DANS le
 *  popover de la chip ; sans `ref` (pas de popover), elle passe par le `title` du span. */
function ModChip({ m }: { m: ModLine }) {
  // Lecture NON réactive : un nom de combattant ne bouge pas pendant qu'on lit son jet, et une
  // souscription par chip re-rendrait toute la grille de mods à chaque tick de combat.
  const state = useGame.getState();
  const tone = m.value >= 0 ? 'pos' : 'neg';
  const amount = `${m.value >= 0 ? '+' : '−'}${Math.abs(m.value)}`;
  const text = `${amount} ${m.label}`;
  // PROVENANCE (qui soutient, qui octroie) : elle vit DANS le popover de la chip — arbitrage user
  // 2026-08-05, verbatim « Normalement les informations de ce genre sont dans le hover codex non ? ».
  // Les noms flottant à côté de la chip (badges inline) ne se rattachaient visuellement à rien : le
  // lecteur ne savait pas de quel modificateur ils parlaient. La chip reste sobre.
  const provenances = m.by?.map((p) => provenanceLabel(p, state)) ?? [];
  return m.ref
    ? (
      <CodexRef category={m.ref.category} id={m.ref.id} label={m.label} instance={text} className={`rm-mod ${tone}`} provenances={provenances}>
        {text}
      </CodexRef>
    )
    : <span className={`rm-mod ${tone}`} title={provenances.length ? provenances.join(' · ') : undefined}>{text}</span>;
}

/** Chips des modificateurs étiquetés (« Courte portée +40 », « Sonné −10 »…). */
function ModChips({ mods }: { mods: ModLine[] }) {
  return (
    <div className="rm-roll-mods">
      {mods.map((m, i) => <ModChip key={i} m={m} />)}
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

/** Z5c — la RAISON du verdict, ANNOTÉE sous la ligne qu'elle explique (`docs/charte-ui.md`) : elle
 *  ne paraît que quand la comparaison des DR affichés ne dit pas le verdict à elle seule (départage
 *  d'un Test opposé, LDB 12 l.160). Le résolveur fournit le critère et les grandeurs comparées
 *  (`VerdictReason`) ; ce site n'en rend que la phrase, il ne recompare rien. L'annotation EST
 *  l'affordance de la règle (`CodexRef` vers sa fiche) — aucun ⓘ voisin. */
function VerdictNote({ r }: { r: VerdictReason }) {
  const ref = RULE_REF['tests-opposes'];
  return (
    <div className="hint">
      <CodexRef category={ref.category} id={ref.id} label="Tests opposés" inline>
        {r.by === 'valeur'
          ? <>DR égaux — la Compétence ou Caractéristique la plus élevée l’emporte ({r.own} &gt; {r.other})</>
          : <>Égalité parfaite — statu quo</>}
      </CodexRef>
    </div>
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
 *  de modificateurs restent affichées.
 *  `d.decided` (Z5c) : la RAISON du verdict, annotée sous la ligne — rendue sur les seules lignes SANS
 *  masque (`d.mask`), dont le calcul et le ✓/✗ se lisent tels quels. */
export function RollLine({ d }: { d: RollBreakdown }) {
  const dv = difficultyValue(d.difficulty);
  const mods = reconciled(d.mods ?? [], d.modifier - dv, d.target, d.clamped, dv);
  const masked = d.mask === 'roll';
  return (
    <div className="rm-roll-block">
      <div className={`rm-roll ${masked ? 'masked' : d.success ? 'ok' : 'fail'}`}>
        <span className="rm-roll-label">{d.label}<DifficultyText difficulty={d.difficulty} easedBy={d.easedBy} /></span>
        <RollCalc base={d.base} modifier={d.modifier} target={d.target} mask={d.mask} />
        <span className="rm-roll-dice" title={masked ? MASK_HINT.roll : undefined} aria-label={masked ? MASK_HINT.roll : undefined}>
          <Icon id="nav/dice" size="sm" /> <b>{masked ? '?' : <Dice roll={d.roll} />}</b>
        </span>
        <span className="rm-roll-sl" title={masked ? MASK_HINT.roll : undefined} aria-label={masked ? MASK_HINT.roll : undefined}>
          {masked ? '?' : <>{d.success ? '✓' : '✗'} {d.sl >= 0 ? '+' : '−'}{Math.abs(d.sl)} DR</>}
        </span>
      </div>
      {mods.length > 0 && <ModChips mods={mods} />}
      {!d.mask && d.decided && <VerdictNote r={d.decided} />}
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
  /** Cible effective (base + modificateurs COMBINÉS, plafonds inclus) ; défaut : base + Difficulté + somme des chips. */
  target?: number;
  mods?: ModLine[];
  /** Difficulté du Test — rendue sur la LIGNE, jamais en chip (#1072) ; sa valeur reste
   *  comprise dans la cible (dérivée ici quand `target` est omise). */
  difficulty?: Difficulty;
  /** Difficulté ALLÉGÉE (`FlowTest.easierIf`) : libellé de la Compétence/du Talent qui l'a permis. */
  easedBy?: string;
  /** ÉCRÊTAGE mesuré de la cible (même donnée que `RollBreakdown.clamped`) — seule autorisation de
   *  nommer « plafond/plancher » avant le jet. */
  clamped?: number;
  /** Ligne adverse : ne pas afficher base/cible (portrait + compétence + bonus/malus seulement).
   *  Aucun dé n'est encore posé ici : `'value'` et `'roll'` cachent la même chose. */
  mask?: RollMask;
  /** ENJEU du jet à venir (#1117 L1b) — la RÉFÉRENCE de donnée, jamais un texte (le type l'interdit).
   *  Porté par l'ENTRÉE de jet pour les surfaces hors `RollShell` (pied d'`ActivityPane`) : la
   *  coquille de jet, elle, a sa propre prop de premier rang. Absent = la surface ne rend RIEN. */
  stake?: StakeRef;
}

export function PendingRollLine({ p }: { p: PendingRoll }) {
  const declared = p.mods ?? [];
  const dv = difficultyValue(p.difficulty);
  const target = p.target ?? (p.base != null ? p.base + dv + declared.reduce((s, m) => s + m.value, 0) : 0);
  const diff = p.base != null ? target - p.base : 0;
  // Pré-jet : MÊME réconciliation que la ligne résolue — une cible déjà plafonnée/portant un mod non
  // itemisé montre son écart nommé au lieu d'un total qui ne tombe pas juste.
  const mods = p.base != null ? reconciled(declared, diff - dv, target, p.clamped, dv) : declared;
  return (
    <div className="rm-roll-block">
      <div className="rm-roll pending">
        <span className="rm-roll-label">{p.label}<DifficultyText difficulty={p.difficulty} easedBy={p.easedBy} /></span>
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
