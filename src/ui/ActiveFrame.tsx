import { PortraitTile } from './PortraitTile';
import { ADVANTAGE_CAP } from '../engine/advantage';
import type { Combatant } from '../engine/types';

/** Jauge CRANTÉE à taille fixe : N segments égaux dans une longueur constante (2 ou 150 points →
 *  même encombrement). `vertical` = colonne (remplie du bas vers le haut). `spend`/`gain` = aperçu
 *  de clic : les crans qui VONT être dépensés (`on spend`, clignotent) / gagnés (`gain`, se
 *  remplissent en clignotant) avant le commit du 2ᵉ clic. */
function Notches({ kind, value, max, vertical, title, spend = 0, gain = 0 }: { kind: string; value: number; max: number; vertical?: boolean; title: string; spend?: number; gain?: number }) {
  if (max <= 0) return null;
  const spendFrom = Math.max(0, value - spend); // [spendFrom, value) = crans dépensés (clignotent)
  const gainTo = Math.min(max, value + gain); // [value, gainTo) = crans gagnés (clignotent)
  return (
    <span className={`af-bar af-${kind} ${vertical ? 'af-v' : 'af-h'}`} title={title} aria-label={title}>
      {Array.from({ length: max }, (_, i) => {
        const cls = i < spendFrom ? 'on' : i < value ? 'on spend' : i < gainTo ? 'gain' : 'off';
        return <i key={i} className={cls} />;
      })}
    </span>
  );
}

/** Cadre du combattant ACTIF (barre d'action seulement) : Action verticale à gauche | portrait |
 *  Mouvement vertical à droite ; sous le portrait : Avantage (10 crans — plafond RAW optionnel
 *  LDB 15-Dépl l.17). Le portrait + sa VIE viennent de la tuile-portrait UNIFIÉE (PortraitTile),
 *  identique au dock et à la frise. Pur à props (testable en SSR). */
export function ActiveFrame({ c, ring, isHero, actAvail, actMax, moveLeft, moveMax, title, spendAction = 0, spendMove = 0, gainAdv = 0 }: {
  c: Combatant; ring: string; isHero: boolean;
  actAvail: number; actMax: number; moveLeft: number; moveMax: number; title?: string;
  /** Aperçu de clic (tap 1) : Action/Mouvement qui VONT être dépensés, Avantage qui VA être gagné. */
  spendAction?: number; spendMove?: number; gainAdv?: number;
}) {
  return (
    <div className="aframe">
      {isHero && <Notches kind="action" vertical value={actAvail} max={actMax} spend={spendAction} title={`Action : ${actAvail}/${actMax}`} />}
      <div className="af-mid">
        <PortraitTile c={c} ring={ring} size={72} showPv team={isHero ? 'ally' : 'enemy'} title={title} />
        <Notches kind="adv" value={Math.min(c.advantage, ADVANTAGE_CAP)} max={ADVANTAGE_CAP} gain={gainAdv} title={`Avantage : ${c.advantage}/${ADVANTAGE_CAP}`} />
      </div>
      {isHero && <Notches kind="move" vertical value={moveLeft} max={moveMax} spend={spendMove} title={`Mouvement : ${moveLeft}/${moveMax} case${moveMax > 1 ? 's' : ''}`} />}
    </div>
  );
}
