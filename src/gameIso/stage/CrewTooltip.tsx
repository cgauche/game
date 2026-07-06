/**
 * Tooltip ÉQUIPE d'une pièce de siège/artillerie SURVOLÉE (turn-INDÉPENDANT, via hoveredId) : chef +
 * renforts + Indice d'Arme d'équipe + effectif (sous-effectif en rouge), et l'invite « Clic : rejoindre »
 * si le héros actif peut la servir. Données pures (poste.crewIds / qualité arme-d-equipe) — zéro mécanique.
 */
import type { BattleState } from '../../state/store';
import { Combatant } from '../../engine/types';
import { serveTargetPoste, isPosteManned, servingCrewPresent, posteCrewSplit, isCrewQualified } from '../../state/shipPostes';
import { weaponGroupLabel } from '../../data';

export function CrewTooltip({ battle, hoveredId, myTurn, anchor }: {
  battle: BattleState;
  hoveredId: string | null;
  myTurn: boolean;
  anchor: (c: Combatant) => { cx: number; cy: number };
}) {
  const occ = hoveredId ? battle.combatants.find((c) => c.id === hoveredId) : null;
  if (!occ?.postes?.length || !occ.pos) return null;
  const active = battle.combatants.find((c) => c.id === battle.order[battle.turn]);
  // Pièce que le héros ACTIF pourrait REJOINDRE (affordance « Servir cette pièce ») → carte d'ACTION
  // (qualifié/aide), à l'image de la carte d'attaque quand on cible un ennemi.
  const servePoste = active && active.kind === 'hero' && myTurn ? serveTargetPoste(active, occ, battle.combatants) : undefined;
  const lines: { text: string; color: string; bold?: boolean }[] = [];
  for (const p of occ.postes) {
    const indice = p.item.qualities?.find((q) => q.id === 'arme-d-equipe')?.value ?? 0;
    const manned = isPosteManned(p, battle.combatants);
    const chefId = p.crewIds?.[0];
    const chef = manned ? battle.combatants.find((c) => c.id === chefId) : undefined;
    // Équipage réparti par QUALIFICATION (AA p.122 l.3900-3902) : qualifiés = comptent dans l'effectif ;
    // aides = présents mais non qualifiés (déplacent/compensent, ne comptent pas). Chef listé à part.
    const { qualified, aides } = posteCrewSplit(p, battle.combatants);
    const renforts = qualified.filter((c) => c.id !== chefId).map((c) => c.name);
    const aideNames = aides.filter((c) => c.id !== chefId).map((c) => c.name);
    const present = chef ? servingCrewPresent(chef, battle.combatants) : undefined;
    const groupLabel = p.item.weaponGroup ? weaponGroupLabel(p.item.weaponGroup) : '';
    lines.push({ text: indice > 0 ? `${p.item.name} · Arme d’équipe ${indice}` : p.item.name, color: 'var(--combat-gold)', bold: true });
    lines.push({ text: `Chef : ${manned ? chef?.name ?? 'aucun' : 'aucun'}`, color: 'var(--tooltip-fg)' });
    if (renforts.length) lines.push({ text: `Renforts : ${renforts.join(', ')}`, color: 'var(--tooltip-muted)' });
    if (aideNames.length) lines.push({ text: `Aides (non qual.) : ${aideNames.join(', ')}`, color: 'var(--tooltip-dim)' });
    if (indice > 0 && present != null) lines.push({ text: `Effectif (qualifié) : ${present}/${indice}${present < indice ? ' sous-effectif' : ''}`, color: present < indice ? 'var(--combat-enemy)' : 'var(--combat-ally)' });
    // Carte d'ACTION du héros actif : SA qualification pour CETTE pièce (même check RAW que l'effectif),
    // affichée DÈS le survol (même non adjacent) → on sait d'un coup d'œil si ce héros peut l'armer.
    if (active && active.kind === 'hero' && myTurn) {
      const canServeNow = !!(servePoste && servePoste.item.uid === p.item.uid); // adjacent + servable maintenant
      if (isCrewQualified(active, p)) {
        lines.push({ text: `✓ Qualifié${groupLabel ? ` (Projectiles ${groupLabel})` : ''}`, color: 'var(--combat-ally)', bold: true });
        lines.push({ text: !canServeNow ? '↳ approchez-vous pour servir' : manned ? '↳ compte pour l’effectif' : '↳ chef : peut tirer (pièce libre)', color: 'var(--tooltip-ok)' });
      } else {
        lines.push({ text: `✗ NON qualifié (Projectiles ${groupLabel})`, color: 'var(--tooltip-warn)', bold: true });
        lines.push({ text: '↳ AIDE : ne compte pas, ne tire pas', color: 'var(--tooltip-aid)' });
      }
    }
  }
  const at = anchor(occ);
  const w = Math.max(...lines.map((l) => l.text.length)) * 6.1 + 20;
  const h = lines.length * 14 + 12;
  const x0 = -w / 2 + 10;
  return (
    <g pointerEvents="none" transform={`translate(${at.cx},${at.cy - 64})`}>
      <rect x={-w / 2} y={-h} width={w} height={h} rx={6} fill="var(--tooltip-bg)" fillOpacity={0.95} stroke="var(--combat-gold)" strokeOpacity={0.6} strokeWidth={1} />
      {lines.map((l, i) => (
        <text key={i} x={x0} y={-h + 15 + i * 14} fontSize={l.bold ? 11.5 : 10.5} fontWeight={l.bold ? 700 : 500} fill={l.color}>{l.text}</text>
      ))}
    </g>
  );
}
