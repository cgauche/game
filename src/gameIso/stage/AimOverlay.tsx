/**
 * Ciblage du JOUEUR — réticule persistant des jets à cible en cours (modale ouverte), sinon survol
 * (hoverAim) : réticule sur cible VALIDE + infobulle unifiée mêlée/tir/sort « arme ou sort · compétence
 * base ±mod · Dégâts N » (états bloquants : LdV / portée / Engagé). INTERACTION → overlay du stage, hors builders.
 */
import type { BattleState, PendingAttack, PendingDefense, PendingTrample, PendingHeal, PendingCast } from '../../state/store';
import { Combatant } from '../../engine/types';
import { firedWeapon } from '../../state/combatFlow';
import { Dims, tileCenter } from '../../geometry/iso';
import { TargetReticle } from '../TargetReticle';
import { relationColor } from '../teamColors';
import { IconG } from '../../ui/Icon';
import type { HoverAim } from './useHoverTargeting';

export function AimOverlay({ battle, hoverAim, anchor, dims, pendingAttack, pendingDefense, pendingTrample, pendingHeal, pendingCast }: {
  battle: BattleState;
  hoverAim: HoverAim | null;
  anchor: (c: Combatant) => { cx: number; cy: number };
  dims: Dims;
  pendingAttack: PendingAttack | null;
  pendingDefense: PendingDefense | null;
  pendingTrample: PendingTrample | null;
  pendingHeal: PendingHeal | null;
  pendingCast: PendingCast | null;
}) {
  const byId = (id?: string | null) => (id ? battle.combatants.find((c) => c.id === id && c.pos) : undefined);
  if (pendingAttack) {
    const a = byId(pendingAttack.attackerId), t = byId(pendingAttack.victimId ?? pendingAttack.targetId);
    if (!a || !t) return null;
    const ranged = firedWeapon(a, t, pendingAttack.weaponUid).type === 'ranged';
    return <TargetReticle from={anchor(a)} to={anchor(t)} line={ranged ? 'dashed' : 'solid'} lineColor={a.kind === 'hero' ? 'var(--combat-gold)' : 'var(--combat-enemy)'} />;
  }
  if (pendingDefense) {
    const a = byId(pendingDefense.attackerId), t = byId(pendingDefense.defenderId);
    return a && t ? <TargetReticle from={anchor(a)} to={anchor(t)} line={pendingDefense.weapon.type === 'ranged' ? 'dashed' : 'solid'} lineColor="var(--combat-enemy)" /> : null;
  }
  if (pendingTrample) {
    const a = byId(pendingTrample.attackerId), t = byId(pendingTrample.targetId);
    return a && t ? <TargetReticle from={anchor(a)} to={anchor(t)} line="solid" lineColor={a.kind === 'hero' ? 'var(--combat-gold)' : 'var(--combat-enemy)'} /> : null;
  }
  if (pendingCast && !pendingCast.pickingTargets) {
    const a = byId(pendingCast.casterId);
    const t = byId(pendingCast.targetId);
    // Zone NON posée (flux « jet puis pose ») : rien à viser encore — le gabarit suit le curseur.
    const to = pendingCast.zone
      ? pendingCast.zone.center ? tileCenter(pendingCast.zone.center.x, pendingCast.zone.center.y, dims) : null
      : t ? anchor(t) : null;
    if (!a || !to) return null;
    const self = !pendingCast.zone && pendingCast.casterId === pendingCast.targetId; // sort sur SOI : réticule seul
    return <TargetReticle from={self ? null : anchor(a)} to={to} line={self ? null : 'dashed'} lineColor={a.kind === 'hero' ? 'var(--combat-gold)' : 'var(--combat-enemy)'} />;
  }
  if (pendingHeal) {
    const t = byId(pendingHeal.targetId);
    return t ? <TargetReticle to={anchor(t)} /> : null;
  }
  if (!hoverAim) return null;
  const t = byId(hoverAim.toId);
  if (!t) return null;
  const to = anchor(t);
  const a = byId(hoverAim.fromId);
  const tip = hoverAim.tip;
  // Charge / rejoindre : on trace le CHEMIN réel du déplacement combiné (le clic UNIQUE commet
  // mouvement + attaque) — la ligne droite ne vaut que pour l'attaque sur place.
  const pathPts = (hoverAim.path?.length ?? 0) > 1
    ? hoverAim.path!.map((p) => tileCenter(p.x, p.y, dims)).map((p) => `${p.cx},${p.cy}`).join(' ')
    : null;
  const relCol = relationColor(t.kind); // couleur de relation de la cible : rouge adversaire / vert allié / or neutre
  return (
    <g pointerEvents="none">
      {pathPts && <polyline points={pathPts} fill="none" stroke={relCol} strokeWidth={3} opacity={0.9} />}
      {hoverAim.reticle && <TargetReticle from={pathPts ? null : a ? anchor(a) : null} to={to} line={pathPts ? null : hoverAim.line} lineColor={relCol} />}
      {tip?.kind === 'err' && (() => {
        const w = tip.text.length * 6.4 + 40;
        return (
          <g transform={`translate(${to.cx},${to.cy - 64})`}>
            <rect x={-w / 2} y={-13} width={w} height={20} rx={5} fill="var(--tooltip-bg)" opacity={0.94} stroke="var(--tooltip-border)" strokeWidth={1} />
            <IconG id="ui/warning" x={-w / 2 + 8} y={-10} size={14} />
            <text x={-w / 2 + 28} y={1} dominantBaseline="middle" fill="var(--tooltip-fg)" fontSize={11} fontWeight={600}>
              {tip.text}
            </text>
          </g>
        );
      })()}
      {tip?.kind === 'info' && !t.postes?.length && (() => {
        // Carte compacte : nom de la CIBLE (or, titre) / arme-ou-sort (sous-titre) / compétence +
        // valeur EFFECTIVE (mod entre parenthèses) / dégâts « +N » / manœuvre (Charge…).
        const eff = tip.base + tip.mod;
        const modTxt = tip.mod ? ` (${tip.mod > 0 ? '+' : '−'}${Math.abs(tip.mod)})` : '';
        const l2 = `${tip.skill}  ${eff}${modTxt}`;
        const l3 = tip.dmg != null ? `Dégâts +${tip.dmg}` : null;
        const l4 = tip.note ?? null;
        const w = Math.max(tip.targetName.length * 6.6, tip.title.length * 6, l2.length * 6, (l3 ?? '').length * 6, (l4 ?? '').length * 6) + 20;
        const h = 52 + (l3 ? 14 : 0) + (l4 ? 14 : 0);
        const x0 = -w / 2 + 10;
        let y = -h + 44; // la compétence démarre sous nom+titre ; chaque ligne suivante descend de 14
        return (
          <g transform={`translate(${to.cx},${to.cy - 60})`}>
            <rect x={-w / 2} y={-h} width={w} height={h} rx={6} fill="var(--tooltip-bg)" fillOpacity={0.95} stroke="var(--combat-gold)" strokeOpacity={0.75} strokeWidth={1} />
            <text x={x0} y={-h + 16} fill="var(--combat-gold)" fontSize={11.5} fontWeight={700}>{tip.targetName}</text>
            <text x={x0} y={-h + 30} fill="var(--tooltip-muted)" fontSize={10}>{tip.title}</text>
            <text x={x0} y={y} fontSize={10.5}>
              <tspan fill="var(--tooltip-muted)">{tip.skill}</tspan>
              <tspan fill="var(--tooltip-fg)" fontWeight={700}>{`  ${eff}`}</tspan>
              {tip.mod !== 0 && <tspan fill={tip.mod > 0 ? 'var(--combat-ally)' : 'var(--combat-enemy)'} fontWeight={700}>{modTxt}</tspan>}
            </text>
            {l3 && (
              <text x={x0} y={(y += 14)} fontSize={10.5}>
                <tspan fill="var(--tooltip-muted)">Dégâts</tspan>
                <tspan fill="var(--tooltip-fg)" fontWeight={700}>{`  +${tip.dmg}`}</tspan>
              </text>
            )}
            {l4 && (
              <text x={x0} y={y + 14} fontSize={10.5} fill="var(--gold2)" fontWeight={600}>
                {l4}
              </text>
            )}
          </g>
        );
      })()}
    </g>
  );
}
