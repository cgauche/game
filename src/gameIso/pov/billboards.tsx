/**
 * POV — couche ENTITÉS BILLBOARDS (la « vie » + le DÉCOR de la scène en vue première personne).
 *
 * En POV on regarde par les yeux du chef de groupe. Rien n'est un polygone 3D ici : ce sont des
 * sprites PLATS posés face à la caméra, ancrés aux pieds, projetés en pixels viewport et RAPETISSÉS
 * avec la distance — le MÉCANISME (ancre/échelle/budget) est le noyau PUR partagé `billboardCore`.
 * Trois familles, même mécanisme, budgets distincts :
 *  - PERSONNAGES humanoïdes : rig paper-doll (`entityRigProfile` → `RigSprite`), l'ANGLE présenté
 *    (face/dos/profil + miroir) piloté par `povView(cam.fwd, cam.right, facing)` — surtout PAS par la
 *    rotation iso (`useRigAnim`/`RigToken` la dérivent du camRot iso : inutilisable ici) ; un idle bob
 *    (respiration `CLIPS.idle`) les anime via un rAF ISOLÉ (`PovPerson`), l'angle `povView` conservé ;
 *  - CRÉATURES non-humanoïdes : gabarit corporel ANIMÉ de son anim de repos DATA-DRIVEN
 *    (`plan.idlePose` : battement d'ailes/ondulation/dodelinement), même rAF isolé (`PovCreature`) ; un
 *    plan sans `idlePose` (quadrupède…) reste figé en `restPose`, comme l'iso ;
 *  - PROPS (décor) : le MÊME SVG que l'iso (`buildPropBillboards`, noyau pur — aussi consommé par la QC).
 * Les trois familles fusionnent dans UN peintre (loin→près) : un tonneau devant un PNJ le recouvre.
 *
 * PUR & TESTABLE : composant à PROPS (aucune lecture de store) → `renderToStaticMarkup`.
 * L'occlusion (LdV / brouillard) est déjà résolue en amont : `visible` porte les clés de case vues ;
 * une entité dont la case n'y est pas n'est simplement pas rendue.
 */
import { povView, type CamPose } from './camera';
import {
  BB_W,
  ENT_H_M,
  MAX_PERSON_BILLBOARDS,
  bbTransform,
  buildPropBillboards,
  footAnchor,
  keepClosest,
} from './billboardCore';
import { entityRigProfile } from '../rig/enemyProfile';
import { RigSprite } from '../rig/composeRig';
import { CLIPS, sampleClip } from '../rig/anim/clips';
import { resolveRender, planById, type BodyPlan } from '../rig/bodyPlan';
import { bonesToSvg } from '../rig/renderBones';
import { eyesArtFromKeys } from '../rig/parts/eyes';
import type { Palette } from '../rig/palette';
import { hashSeed } from '../appearance';
import { findCreatureById } from '../../data';
import type { Scene } from '../../state/scene';
import { usePovIdle } from './usePovIdle';

/** Période de l'anim de repos d'un gabarit (battement d'ailes/ondulation/dodelinement) — miroir de
 *  `usePlanAnim.IDLE_MS` (l'idle iso), gardé LOCAL pour ne pas coupler la couche POV pure au module
 *  store/bus de l'iso. La POSE, elle, vient de `plan.idlePose` (donnée), jamais d'une valeur en dur. */
const IDLE_MS = 1600;

/** Un billboard prêt à trier/rendre : profondeur caméra (m) + son nœud SVG déjà positionné. */
type Billboard = { id: string; depth: number; node: JSX.Element };

/** Nœud ancré aux pieds : `translate(sx,sy)` puis recentrage/échelle de la boîte locale 120×150.
 *  `o` = fondu atmosphérique (une silhouette lointaine se délave dans la brume). */
function anchored(id: string, a: { sx: number; sy: number; o: number }, s: number, child: JSX.Element): JSX.Element {
  const t = bbTransform(a, s);
  return (
    <g key={id} transform={t.outer} opacity={a.o < 1 ? a.o : undefined}>
      <g transform={t.inner}>{child}</g>
    </g>
  );
}

/** Miroir DANS le repère local (autour de la boîte 120×150), comme `RigToken` — l'entité regarde bâbord. */
function mirrored(sprite: JSX.Element, mirror: boolean): JSX.Element {
  return mirror ? <g transform={`translate(${BB_W},0) scale(-1,1)`}>{sprite}</g> : sprite;
}

/** Billboard d'un PERSONNAGE humanoïde en POV, ANIMÉ d'un idle bob (respiration) : l'horloge PURE
 *  `usePovIdle` (rAF isolé) échantillonne `CLIPS.idle` par frame, donc SEUL ce sous-arbre se re-rend —
 *  la géométrie POV mémoïsée (sols/murs) ne bouge pas. L'angle présenté (`view`/`mirror`, imposé par
 *  `povView`) est CONSERVÉ : la respiration n'ajoute que des deltas d'os (torse/tête), jamais un
 *  changement de vue. Sous `renderToStaticMarkup`, l'horloge reste à 0 → `sampleClip(CLIPS.idle, 0)`
 *  = pose neutre `{}`, markup identique au rendu statique. */
function PovPerson({ id, prof, view, mirror, a }: {
  id: string;
  prof: NonNullable<ReturnType<typeof entityRigProfile>>;
  view: 'front' | 'back' | 'profile';
  mirror: boolean;
  a: { sx: number; sy: number; o: number; s: number };
}): JSX.Element {
  const { pose } = sampleClip(CLIPS.idle, usePovIdle()); // idle en boucle (respiration) — rAF isolé, sans culling iso
  const sprite = <RigSprite appearance={prof.appearance} equip={prof.equip} career={prof.tenue} view={view} mirror={mirror} pose={pose} />;
  return anchored(id, a, a.s, mirrored(sprite, mirror));
}

/** Billboard d'une CRÉATURE non-humanoïde (gabarit quadrupède/ailé/serpentin/…) en POV, ANIMÉE de son
 *  anim de repos DATA-DRIVEN (`plan.idlePose` : battement d'ailes/ondulation/dodelinement). MIROIR EXACT
 *  de `PovPerson` : la même horloge PURE `usePovIdle` produit une phase 0→1 (période `IDLE_MS`) → SEUL ce
 *  sous-arbre se re-rend. `plan.idlePose` absent (ex. quadrupède) → pose de repos figée (`restPose`),
 *  exactement comme l'iso. L'angle `view`/`mirror` (imposé par `povView`) est CONSERVÉ, ailes repliées au
 *  repos. Sous `renderToStaticMarkup`, l'horloge reste à 0 → pose INITIALE (phase 0). */
function PovCreature({ id, plan, species, view, mirror, colors, eyes, a }: {
  id: string;
  plan: BodyPlan;
  species: string;
  view: 'front' | 'back' | 'profile';
  mirror: boolean;
  colors?: Palette;
  eyes?: { G?: string; D?: string };
  a: { sx: number; sy: number; o: number; s: number };
}): JSX.Element {
  const t = usePovIdle();
  const pose = plan.idlePose ? plan.idlePose((t % IDLE_MS) / IDLE_MS) : plan.restPose();
  const sprite = <g dangerouslySetInnerHTML={{ __html: bonesToSvg(plan.resolve(species, view, pose, { colors, eyes, wings: 'folded' })) }} />;
  return anchored(id, a, a.s, mirrored(sprite, mirror));
}

/**
 * Couche des entités en POV. Pour chaque `SceneEntity` de `kind:'personnage'` :
 *  1. CULL par visibilité (clé `x,y,z` absente de `visible` → sautée : le brouillard gère l'occlusion) ;
 *  2. ancre PIEDS + cull distance/derrière/hors-cadre ET échelle ∝ profondeur × espèce
 *     (`footAnchor(…, ENT_H_M, r.scale)`, noyau partagé) ;
 *  4. VUE/MIROIR imposés par `povView` (l'entité regarde `facing`, vue depuis la caméra) ;
 *  5. corps : rig humanoïde ANIMÉ (`PovPerson` : idle bob) OU gabarit non-bipède ANIMÉ (`PovCreature` :
 *     `plan.idlePose`), tous deux via le même rAF isolé `usePovIdle`. Miroir = `translate(120,0)
 *     scale(-1,1)` AUTOUR de la boîte (comme `RigToken`, via `mirrored`) + `mirror` passé à `RigSprite`
 *     (profondeur de profil de l'arme/bouclier) ;
 *  6. TRI loin→près + BUDGET par famille (`keepClosest`) — puis fusion peintre avec les PROPS.
 */
export function PovBillboards({ scene, cam, visible }: { scene: Scene; cam: CamPose; visible: Set<string> }): JSX.Element {
  const persons: Billboard[] = [];

  for (const e of scene.entities) {
    if (e.kind !== 'personnage') continue; // les props passent par le noyau pur (ci-dessous)
    const z = e.z ?? 0;
    if (!visible.has(`${e.pos.x},${e.pos.y},${z}`)) continue; // 1) culling LdV/brouillard
    // Résolution de rendu UNIQUE (même dérivation que `pickBackend`) : rig humanoïde ou gabarit.
    const seed = e.appearance?.seed ?? hashSeed(e.id);
    const refName = e.ref ?? e.label ?? 'villageois';
    const r = resolveRender(e.appearance?.species, findCreatureById(refName)?.traits, refName);
    const a = footAnchor(scene, cam, e.pos.x, e.pos.y, z, ENT_H_M, r.scale); // 2-3) ancre + échelle + culls
    if (!a) continue;
    const { view, mirror } = povView(cam.fwd, cam.right, e.facing ?? 'S'); // 4) angle présenté

    if (r.kind === 'rig') {
      // PERSONNAGE humanoïde : billboard ANIMÉ (idle bob de respiration), rAF isolé — cf. `PovPerson`.
      const prof = entityRigProfile(refName, seed, {
        species: e.appearance?.species,
        tenue: e.appearance?.tenue,
        monster: e.appearance?.monster,
        features: e.appearance?.features,
        weapon: e.weapon,
        colors: e.appearance?.colors,
        parts: e.appearance?.parts,
        sex: e.appearance?.sex,
        build: e.appearance?.build,
        eyes: e.appearance?.eyes,
        traits: e.statblock?.traits,
        armour: e.statblock?.armour,
      });
      if (prof) persons.push({ id: e.id, depth: a.depth, node: <PovPerson key={e.id} id={e.id} prof={prof} view={view} mirror={mirror} a={a} /> });
    } else {
      // Gabarit corporel (quadrupède/ailé/serpentin/…) : billboard ANIMÉ de son anim de repos
      // (`plan.idlePose`), rAF isolé — cf. `PovCreature` (miroir de `PovPerson`).
      const plan = planById(r.plan);
      if (plan)
        persons.push({ id: e.id, depth: a.depth, node: <PovCreature key={e.id} id={e.id} plan={plan} species={r.species} view={view} mirror={mirror} colors={e.appearance?.colors} eyes={eyesArtFromKeys(e.appearance?.eyes)} a={a} /> });
    }
  }

  // 6) budget par famille, puis PEINTRE COMMUN (loin→près) : props et personnages s'occultent entre eux.
  const kept: Billboard[] = keepClosest(persons, MAX_PERSON_BILLBOARDS);
  for (const p of buildPropBillboards(scene, cam, visible))
    kept.push({ id: p.key, depth: p.depth, node: <g key={p.key} dangerouslySetInnerHTML={{ __html: p.svg }} /> });
  kept.sort((a, b) => b.depth - a.depth);

  return <g className="pov-billboards">{kept.map((b) => b.node)}</g>;
}
