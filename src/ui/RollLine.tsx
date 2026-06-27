import type { ModLine, RollBreakdown } from '../engine/combat';
import { Dice } from './Dice';

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

/** Cellule de calcul d'un jet : « base ±mod = cible ». S'il n'y a AUCUN modificateur (nul ou
 *  compensé), on n'affiche QUE la cible — jamais « 55 = 55 ». `hidden` = ligne adverse opaque
 *  (dé + DR seuls). Source UNIQUE partagée par RollLine (résolu) et PendingRollLine (pré-jet). */
function RollCalc({ base, modifier, target, hidden }: { base?: number; modifier: number; target: number; hidden?: boolean }) {
  const hasMod = modifier !== 0;
  return (
    <span className="rm-roll-calc" title={hidden || !hasMod ? undefined : 'Compétence de base + modificateurs détaillés ci-dessous = cible à ne pas dépasser'}>
      {!hidden && (hasMod
        ? <>{base} {modifier > 0 ? '+' : '−'}{Math.abs(modifier)} = <b>{target}</b></>
        : <b>{target}</b>)}
    </span>
  );
}

/** Une ligne de jet : base + modificateurs = cible · d100 · DR (✓/✗), + le détail étiqueté
 *  des modificateurs (« Courte portée +40 », « Viser +20 »…) quand il réconcilie le total. */
export function RollLine({ d }: { d: RollBreakdown }) {
  const mods = d.mods ?? [];
  const showMods = mods.length > 0 && mods.reduce((s, m) => s + m.value, 0) === d.modifier;
  return (
    <div className="rm-roll-block">
      <div className={`rm-roll ${d.success ? 'ok' : 'fail'}`}>
        <span className="rm-roll-label">{d.label}</span>
        {/* Valeur CACHÉE (adversaire opaque, ex. Marchandage du marchand) : on ne montre que dé + DR. */}
        <RollCalc base={d.base} modifier={d.modifier} target={d.target} hidden={d.hideValue} />
        <span className="rm-roll-dice">
          🎲 <b><Dice roll={d.roll} /></b>
        </span>
        <span className="rm-roll-sl">
          {d.success ? '✓' : '✗'} {d.sl >= 0 ? '+' : '−'}
          {Math.abs(d.sl)} DR
        </span>
      </div>
      {showMods && <ModChips mods={mods} />}
    </div>
  );
}

/** Ligne de jet EN ATTENTE (pré-jet) : même géométrie que `RollLine`, dé et DR vides — l'avant-jet
 *  est le même bloc que le résultat, pré-rempli. `hideValue` (ligne adverse) : compétence + chips
 *  de bonus/malus SANS total (on ne révèle pas le score de l'adversaire). */
export interface PendingRoll {
  label: string;
  /** Valeur de compétence de base (absente si `hideValue`). */
  base?: number;
  /** Cible effective (base + modificateurs COMBINÉS, plafonds inclus) ; défaut : base + somme des chips. */
  target?: number;
  mods?: ModLine[];
  /** Ligne adverse : ne pas afficher base/cible (portrait + compétence + bonus/malus seulement). */
  hideValue?: boolean;
}

export function PendingRollLine({ p }: { p: PendingRoll }) {
  const mods = p.mods ?? [];
  const sum = mods.reduce((s, m) => s + m.value, 0);
  const showValue = !p.hideValue && p.base != null;
  const target = p.target ?? (p.base != null ? p.base + sum : 0);
  const diff = p.base != null ? target - p.base : 0;
  return (
    <div className="rm-roll-block">
      <div className="rm-roll pending">
        <span className="rm-roll-label">{p.label}</span>
        <RollCalc base={p.base} modifier={diff} target={target} hidden={!showValue} />
        <span className="rm-roll-dice">
          🎲 <b className="rm-roll-empty">--</b>
        </span>
        <span className="rm-roll-sl">-- DR</span>
      </div>
      {mods.length > 0 && <ModChips mods={mods} />}
    </div>
  );
}

/** Présentation canonique d'un d100 SUR TABLE à conséquences (Oups !, Critiques, Imparfaites,
 *  mutations…) : rangée compacte NEUTRE `nom de la table · 🎲 dé · résultat` — remplace les
 *  anciens verdicts plein écran rouge/vert (`.test-result`). `roll` absent : libellé seul. */
export function TableRollLine({ table, roll, result }: { table: string; roll?: number | null; result?: string }) {
  return (
    <div className="rm-roll-block">
      <div className="rm-roll table">
        <span className="rm-roll-label">{table}</span>
        <span className="rm-roll-calc rm-table-result">{result}</span>
        <span className="rm-roll-dice">
          {roll != null && (
            <>
              🎲 <b><Dice roll={roll} /></b>
            </>
          )}
        </span>
      </div>
    </div>
  );
}
