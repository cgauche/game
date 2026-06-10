import { PortraitTile } from './PortraitTile';
import { hpColor } from '../gameIso/teamColors';
import { ADVANTAGE_CAP } from '../engine/advantage';
import type { Combatant } from '../engine/types';

/** Jauge CRANTÉE à taille fixe : N segments égaux dans une longueur constante (2 ou 150 points →
 *  même encombrement). `vertical` = colonne (remplie du bas vers le haut). */
function Notches({ kind, value, max, vertical, title }: { kind: string; value: number; max: number; vertical?: boolean; title: string }) {
  if (max <= 0) return null;
  return (
    <span className={`af-bar af-${kind} ${vertical ? 'af-v' : 'af-h'}`} title={title} aria-label={title}>
      {Array.from({ length: max }, (_, i) => <i key={i} className={i < value ? 'on' : 'off'} />)}
    </span>
  );
}

/** Cadre du combattant ACTIF (barre d'action seulement) : Action verticale à gauche | portrait |
 *  Mouvement vertical à droite ; dessous : vie (continue) puis Avantage (10 crans — plafond RAW
 *  optionnel LDB 15-Dépl l.17). Pur à props (testable en SSR). */
export function ActiveFrame({ c, ring, isHero, actAvail, actMax, moveLeft, moveMax, title }: {
  c: Combatant; ring: string; isHero: boolean;
  actAvail: number; actMax: number; moveLeft: number; moveMax: number; title?: string;
}) {
  const ratio = c.wounds.max > 0 ? Math.max(0, Math.min(1, c.wounds.current / c.wounds.max)) : 0;
  return (
    <div className="aframe">
      {isHero && <Notches kind="action" vertical value={actAvail} max={actMax} title={`Action : ${actAvail}/${actMax}`} />}
      <div className="af-mid">
        <PortraitTile c={c} ring={ring} size={72} showGauge={false} title={title} />
        <span className="af-hp" title={`Blessures : ${c.wounds.current}/${c.wounds.max}`}>
          <b style={{ width: `${Math.round(ratio * 100)}%`, background: hpColor(ratio) }} />
          <span className="af-hp-n">{c.dead ? '☠️' : `${c.wounds.current}/${c.wounds.max}`}</span>
        </span>
        <Notches kind="adv" value={Math.min(c.advantage, ADVANTAGE_CAP)} max={ADVANTAGE_CAP} title={`Avantage : ${c.advantage}/${ADVANTAGE_CAP}`} />
      </div>
      {isHero && <Notches kind="move" vertical value={moveLeft} max={moveMax} title={`Mouvement : ${moveLeft}/${moveMax} case${moveMax > 1 ? 's' : ''}`} />}
    </div>
  );
}
