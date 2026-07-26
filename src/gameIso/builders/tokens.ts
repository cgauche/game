/**
 * BUILDER de TOKENS — produit les éléments `token` du pivot (cf. ./types) : FIGURANTS de scène
 * (PNJ/créatures d'ambiance) et COMBATTANTS (branche combat, couples montés compris).
 * Porte l'IDENTITÉ et la position LOGIQUE + toutes les DÉCISIONS de scène (filtres d'étage/brouillard/
 * couverture, ordre d'anneau héros, surplomb) ; la position INTERPOLÉE de marche est PAR-FRAME et reste
 * au stage, comme le corps React (pickBackend/BodyToken). PUR : aucune caméra — seule la bascule
 * `top` (pions-portraits : cavalier et monture séparés) est une vérité de MODE DE VUE, pas de pose.
 */
import type { Scene } from '../../state/scene';
import { isMerScene, enrolledEntityIds } from '../../state/scene';
import type { BattleState } from '../../state/store';
import { combatantAtTile } from '../../state/combatGeometry';
import { isPassengerInBattle } from '../../state/shipPostes';
import { isRider, isMount, riderOf } from '../../state/mount';
import { isStructure } from '../../engine/structures';
import { isOverhang } from './floors';
import type { TokenEl } from './types';

/** Vérité de JEU pilotant la sélection (PAS une caméra) : étage actif/isolé + mode de vue du dessus
 *  (`top` : les couples montés redeviennent deux pions distincts). */
export interface TokenView {
  activeZ: number;
  viewZ: number | null;
  top: boolean;
}

/** Éléments `token` de la scène — figurants (toujours), puis combattants (si `battle`). Les hors-vue
 *  sont COUPÉS (une créature non vue n'est pas dessinée) → tout token émis est VISIBLE (au-dessus du
 *  voile de brouillard). */
export function buildTokens(scene: Scene, visible: ReadonlySet<string>, battle: BattleState | null, view: TokenView): TokenEl[] {
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
    if (ent.combat?.hiddenUntilCombat) continue; // ennemi d'embuscade : invisible avant le combat
    if (inBattle && battle!.combatants.some((c) => c.id === ent.id)) continue; // enrôlé : le combattant le rend
    const ez = ent.z ?? 0;
    if (viewZ != null ? ez !== viewZ : ez > activeZ) continue; // isole ; sinon couche active + dessous
    if (!ez && covered(ent.pos.x, ent.pos.y)) continue; // l'occlusion par combattant ne vaut qu'au sol
    if (!visible.has(`${ent.pos.x},${ent.pos.y},${ez}`)) continue; // hors-vue → coupé
    out.push({
      kind: 'token',
      key: `fig:${ent.id}`,
      id: ent.id,
      cell: { x: ent.pos.x, y: ent.pos.y, z: ez },
      subject: { kind: 'figurant', ent, enrolled: enrolledIds.has(ent.id), inBattle },
      states: { visible: true },
    });
  }

  if (!battle) return out;

  // ── COMBATTANTS : mêmes filtres et même ORDRE D'ANNEAU héros que la branche combat historique. ────
  let hi = 0; // ordinal d'anneau héros — consommé AUSSI par un cavalier non dessiné (couleur stable)
  for (const c of battle.combatants) {
    if (!c.pos) continue;
    // Échelle MER : l'équipage d'un navire est ABSTRAIT (la coque le représente, MDG 14).
    if (isPassengerInBattle(c, battle.combatants, isMerScene(scene))) continue;
    // Structure de siège : AUCUN jeton de case — elle se rend sur son ARÊTE (hit-area `data-cid`).
    if (isStructure(c)) continue;
    const cz = c.pos.z ?? 0;
    // Jeton de muraille vu d'en bas : un combattant posé sur un SURPLOMB au-dessus de la zone active
    // reste rendu (défenseurs/pièces ciblables depuis la cour — parité avec le picking cross-couche).
    const overhang = viewZ == null && cz > activeZ && isOverhang(scene, c.pos.x, c.pos.y, cz);
    if (viewZ != null ? cz !== viewZ : cz > activeZ && !overhang) continue;
    const isHero = c.kind === 'hero';
    // Brouillard : un ennemi/PNJ que personne du groupe ne voit n'est pas dessiné (les alliés, qui
    // SONT les viewers, restent toujours rendus). Clé z-aware = l'étage du combattant.
    if (!isHero && !visible.has(`${c.pos.x},${c.pos.y},${cz}`)) continue;
    // Combat monté (iso) : cavalier rendu EN SELLE (couple composite ci-dessous) ; en vue du dessus,
    // cavalier et monture sont deux pions distincts.
    if (!top && isRider(c)) {
      if (isHero) hi++;
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
  // Couples MONTÉS (iso seulement) : UN corps composite à la tuile/empreinte de la monture.
  if (!top)
    for (const mount of battle.combatants) {
      if (!isMount(mount) || !mount.pos) continue;
      const rider = riderOf(battle, mount);
      if (!rider) continue;
      const mz = mount.pos.z ?? 0;
      out.push({
        kind: 'token',
        key: `mtd:${mount.id}`,
        id: mount.id,
        cell: { x: mount.pos.x, y: mount.pos.y, z: mz },
        subject: { kind: 'mounted', mount, rider },
        states: { visible: true },
      });
    }
  return out;
}
