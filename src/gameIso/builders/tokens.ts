/**
 * BUILDER de TOKENS — produit les éléments `token` du pivot (cf. ./types) : FIGURANTS de scène
 * (PNJ/créatures d'ambiance) et COMBATTANTS (branche combat, couples montés compris).
 * Porte l'IDENTITÉ et la position LOGIQUE + toutes les DÉCISIONS de scène (filtres d'étage/brouillard/
 * couverture, ordre d'anneau héros, surplomb) ; la position INTERPOLÉE de marche est PAR-FRAME et reste
 * au stage, comme le corps React (`tokenBodyKind`). PUR : aucune caméra — seule la bascule
 * `top` (pions-portraits : cavalier et monture séparés) est une vérité de MODE DE VUE, pas de pose.
 */
import type { Scene } from '../../state/scene';
import { isMerScene, enrolledEntityIds } from '../../state/scene';
import type { BattleState } from '../../state/store';
import { combatantAtTile } from '../../state/combatGeometry';
import { isPassengerInBattle } from '../../state/shipPostes';
import { isRider, isMount, riderOf } from '../../state/mount';
import { seatPoseOf } from '../../state/seating';
import { isStructure } from '../../engine/structures';
import { isOverhang } from './floors';
import type { TokenEl } from './types';

/** Vérité de JEU pilotant la sélection (PAS une caméra) : étage actif/isolé + mode de vue du dessus
 *  (`top` : les couples montés redeviennent deux pions distincts). */
export interface TokenView {
  activeZ: number;
  viewZ: number | null;
  top: boolean;
  /** AUTHORING (#1176, P3-3) : l'ÉDITEUR voit les EMBUSQUEURS. Une entité `hiddenUntilCombat` est
   *  invisible EN JEU avant le combat — l'auteur, lui, doit voir le corps de ce qu'il pose, sinon il
   *  édite un cadre vide. Absent = la loi de jeu, la seule qu'un écran de partie puisse demander. */
  ambush?: boolean;
}

/** Filtres de CASE d'un combattant — étage isolé/actif, surplomb de muraille, brouillard. Les mêmes
 *  pour un fantassin et pour un couple monté (qui les prend à la case de sa MONTURE) : un couple ne
 *  peut pas rester visible là où le même ennemi à pied est coupé. `héros` = allié VIEWER (jamais
 *  masqué par sa propre vue) ; pour un couple, l'un OU l'autre des deux corps suffit. */
function cutByView(scene: Scene, visible: ReadonlySet<string> | undefined, view: TokenView, pos: { x: number; y: number; z?: number }, héros: boolean): { cut: boolean; overhang: boolean } {
  const cz = pos.z ?? 0;
  // Jeton de muraille vu d'en bas : un combattant posé sur un SURPLOMB au-dessus de la zone active
  // reste rendu (défenseurs/pièces ciblables depuis la cour — parité avec le picking cross-couche).
  const overhang = view.viewZ == null && cz > view.activeZ && isOverhang(scene, pos.x, pos.y, cz);
  if (view.viewZ != null ? cz !== view.viewZ : cz > view.activeZ && !overhang) return { cut: true, overhang };
  // Brouillard : un ennemi/PNJ que personne du groupe ne voit n'est pas dessiné (les alliés, qui
  // SONT les viewers, restent toujours rendus). Clé z-aware = l'étage du combattant.
  if (!héros && visible && !visible.has(`${pos.x},${pos.y},${cz}`)) return { cut: true, overhang };
  return { cut: false, overhang };
}

/** Éléments `token` de la scène — figurants (toujours), puis combattants (si `battle`). Les hors-vue
 *  sont COUPÉS (une créature non vue n'est pas dessinée) → tout token émis est VISIBLE (au-dessus du
 *  voile de brouillard). `visible` ABSENT = aucune loi de vue (planches QC : elles jugent
 *  l'environnement, pas le brouillard) — même convention que `buildFloors`/`buildProps`.
 *
 *  SOURCE UNIQUE des jetons du monde (#1176) : le monde volumique en fait des billboards
 *  (`sceneBillboards`) et la surcouche SVG leur chrome (`stage/TokenChromeOverlay`) — les filtres
 *  (embuscade, enrôlé, couverture, étage, hors-vue) ne se recopient pas, ils se CONSOMMENT. */
export function buildTokens(scene: Scene, visible: ReadonlySet<string> | undefined, battle: BattleState | null, view: TokenView): TokenEl[] {
  const { activeZ, viewZ, top } = view;
  const out: TokenEl[] = [];
  const inBattle = !!battle;

  // ── FIGURANTS (PNJ d'ambiance) : maintenus en combat — estompés, cases libres seulement. ──────────
  // Entités ENRÔLÉES (membres d'une rencontre) → équipement dérivé du record (parité avec le spawn).
  const enrolledIds = enrolledEntityIds(scene);
  // Un figurant dont la case est occupée par un combattant n'est pas dessiné (pas d'empilement de
  // corps) — figurants de décor = sol (z0) uniquement.
  const covered = (x: number, y: number) => inBattle && !!combatantAtTile(battle!.combatants, x, y, 0);
  for (const ent of scene.entities) {
    if (ent.kind === 'heroStart' || ent.kind === 'prop') continue;
    if (ent.combat?.hiddenUntilCombat && !view.ambush) continue; // ennemi d'embuscade : invisible avant le combat (sauf à l'authoring)
    if (inBattle && battle!.combatants.some((c) => c.id === ent.id)) continue; // enrôlé : le combattant le rend
    const ez = ent.z ?? 0;
    if (viewZ != null ? ez !== viewZ : ez > activeZ) continue; // isole ; sinon couche active + dessous
    if (!ez && covered(ent.pos.x, ent.pos.y)) continue; // l'occlusion par combattant ne vaut qu'au sol
    if (visible && !visible.has(`${ent.pos.x},${ent.pos.y},${ez}`)) continue; // hors-vue → coupé
    // ASSISE : un PNJ authored attablé (`Scene.seatAssignments`) porte son ancre et son cap depuis la
    // SOURCE UNIQUE `state/seating` — le builder ne recalcule aucune géométrie de meuble.
    const assis = seatPoseOf(scene, { kind: 'entity', entityId: ent.id });
    out.push({
      kind: 'token',
      key: `fig:${ent.id}`,
      id: ent.id,
      cell: { x: ent.pos.x, y: ent.pos.y, z: ez },
      subject: { kind: 'figurant', ent, enrolled: enrolledIds.has(ent.id), inBattle, ...(assis ? { seat: assis } : {}) },
      states: { visible: true },
    });
  }

  if (!battle) return out;

  // ── COMBATTANTS : mêmes filtres et même ORDRE D'ANNEAU héros que la branche combat historique. ────
  let hi = 0; // ordinal d'anneau héros — consommé AUSSI par un cavalier non dessiné (couleur stable)
  // L'ordinal réservé par un cavalier héros : c'est l'identité d'équipe que portera son COUPLE plus bas.
  const riderHi = new Map<string, number>();
  for (const c of battle.combatants) {
    if (!c.pos) continue;
    // Échelle MER : l'équipage d'un navire est ABSTRAIT (la coque le représente, MDG 14).
    if (isPassengerInBattle(c, battle.combatants, isMerScene(scene))) continue;
    // Structure de siège : AUCUN jeton de case — elle se rend sur son ARÊTE (hit-area `data-cid`).
    if (isStructure(c)) continue;
    const cz = c.pos.z ?? 0;
    const isHero = c.kind === 'hero';
    const { cut, overhang } = cutByView(scene, visible, view, c.pos, isHero);
    if (cut) continue;
    // Combat monté (iso) : cavalier rendu EN SELLE (couple composite ci-dessous) ; en vue du dessus,
    // cavalier et monture sont deux pions distincts.
    if (!top && isRider(c)) {
      if (isHero) riderHi.set(c.id, hi++);
      continue;
    }
    if (!top && isMount(c)) continue;
    out.push({
      kind: 'token',
      key: `cbt:${c.id}`,
      id: c.id,
      cell: { x: c.pos.x, y: c.pos.y, z: cz },
      subject: { kind: 'combatant', c, ...(isHero ? { heroIndex: hi++ } : {}), overhang },
      states: { visible: true },
    });
  }
  // Couples MONTÉS (iso seulement) : UN corps composite à la tuile/empreinte de la monture, filtré
  // comme n'importe quel combattant — équipage abstrait, étage, surplomb, brouillard.
  //
  // ÉCART RÉSIDUEL DÉCLARÉ (#1176, P3-5) : en vue du DESSUS (`top`), le couple redevient DEUX pions
  // superposés (branche ci-dessus), et le monde volumique en hérite deux billboards à la même case.
  // La vue du dessus tactique le tranche.
  if (!top)
    for (const mount of battle.combatants) {
      if (!isMount(mount) || !mount.pos) continue;
      const rider = riderOf(battle, mount);
      if (!rider) continue;
      if (isPassengerInBattle(mount, battle.combatants, isMerScene(scene))) continue;
      // Un couple est VIEWER dès que l'un des deux corps est un héros (le cheval d'un héros ne
      // disparaît pas parce que le record de la monture est d'un autre camp).
      if (cutByView(scene, visible, view, mount.pos, mount.kind === 'hero' || rider.kind === 'hero').cut) continue;
      out.push({
        kind: 'token',
        key: `mtd:${mount.id}`,
        id: mount.id,
        cell: { x: mount.pos.x, y: mount.pos.y, z: mount.pos.z ?? 0 },
        subject: { kind: 'mounted', mount, rider, ...(riderHi.has(rider.id) ? { heroIndex: riderHi.get(rider.id) } : {}) },
        states: { visible: true },
      });
    }
  return out;
}
