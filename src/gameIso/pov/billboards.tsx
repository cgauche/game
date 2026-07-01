/**
 * POV — couche ENTITÉS BILLBOARDS (la « vie » de la scène en vue première personne).
 *
 * En POV on regarde par les yeux du chef de groupe. Les PNJ/créatures debout dans la scène ne sont
 * PAS des polygones 3D : ce sont des sprites RIG PLATS (paper-doll) posés face à la caméra, ancrés
 * aux pieds, projetés en pixels viewport et RAPETISSÉS avec la distance. L'ANGLE présenté (face/dos/
 * profil + miroir) est piloté par `povView(cam.fwd, cam.right, facing)` — surtout PAS par la rotation
 * iso (`useRigAnim`/`RigToken` la dérivent du camRot iso : inutilisable ici). On passe donc par le
 * couple bas niveau `entityRigProfile` → `RigSprite`, en imposant `view`/`mirror`.
 *
 * PUR & TESTABLE : composant à PROPS (aucune lecture de store) → `renderToStaticMarkup`.
 * L'occlusion (LdV / brouillard) est déjà résolue en amont : `visible` porte les clés de case vues ;
 * une entité dont la case n'y est pas n'est simplement pas rendue.
 */
import { project, povView, fy, FAR_TILES, type CamPose } from './camera';
import { entityRigProfile } from '../rig/enemyProfile';
import { RigSprite } from '../rig/composeRig';
import { resolveRender } from '../rig/bodyPlan';
import { hashSeed } from '../appearance';
import { findCreatureById } from '../../data';
import { heightAt, type Scene } from '../../state/scene';

/** Taille métrique d'une personne debout (m) — hauteur écran = fy·H/profondeur. */
const ENT_H_M = 1.8;
/** Boîte locale du rig (repère paper-doll) : ~120 (large) × 150 (haut), pieds ancrés à (60,150). */
const RIG_W = 120;
const RIG_H = 150;
const FOOT_X = 60;
const FOOT_Y = 150;
/** Plafond de sprites rendus (les plus proches priment) — anti-surcharge d'une scène peuplée. */
const MAX_BILLBOARDS = 10;

/** Un billboard prêt à trier/rendre : profondeur caméra (m) + son nœud SVG déjà positionné. */
type Billboard = { id: string; depth: number; node: JSX.Element };

/**
 * Couche des entités vivantes en POV. Pour chaque `SceneEntity` de `kind:'personnage'` :
 *  1. CULL par visibilité (clé `x,y,z` absente de `visible` → sautée : le brouillard gère l'occlusion) ;
 *  2. projette le POINT DE PIEDS (centre de case, hauteur de surface) → skip si derrière le plan proche
 *     ou au-delà de la portée `FAR_TILES` ;
 *  3. ÉCHELLE : hauteur écran = fy·ENT_H_M/profondeur ; le rig fait ~150 unités locales → `s` divise par
 *     150 et multiplie par l'échelle d'espèce ;
 *  4. VUE/MIROIR imposés par `povView` (l'entité regarde `facing`, vue depuis la caméra) ;
 *  5. rig ancré aux pieds : `translate(sx,sy)` puis `translate(-60·s,-150·s) scale(s)` (repère local).
 *     Miroir = `translate(120,0) scale(-1,1)` AUTOUR de la boîte (comme `RigToken`) + `mirror` passé à
 *     `RigSprite` (profondeur de profil de l'arme/bouclier) ;
 *  6. TRI loin→près (grande profondeur d'abord) → les plus proches se peignent PAR-DESSUS ; cap au
 *     ~10 plus proches, le reste est droppé.
 */
export function PovBillboards({ scene, cam, visible }: { scene: Scene; cam: CamPose; visible: Set<string> }): JSX.Element {
  const far = FAR_TILES * cam.mpt;
  const bbs: Billboard[] = [];

  for (const e of scene.entities) {
    if (e.kind !== 'personnage') continue; // v1 : seule la « vie » (PNJ/créatures) — pas heroStart/prop
    const z = e.z ?? 0;
    if (!visible.has(`${e.pos.x},${e.pos.y},${z}`)) continue; // 1) culling LdV/brouillard

    // 2) point de PIEDS (centre de case, hauteur de surface) → projection
    const P = { x: e.pos.x * cam.mpt, y: e.pos.y * cam.mpt, z: heightAt(scene, e.pos.x, e.pos.y, z) };
    const pr = project(cam, P);
    if (pr.behind || pr.depth > far) continue; // derrière le plan proche ou hors de portée

    // Profil rig (apparence/tenue/équipement) — MÊME dérivation que `pickBackend` (ref/label→'villageois',
    // seed stable par id). null = créature non-humanoïde (gabarit corporel) : pas de billboard rig en v1.
    const seed = e.appearance?.seed ?? hashSeed(e.id);
    const refName = e.ref ?? e.label ?? 'villageois';
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
    if (!prof) continue;

    // 3) échelle : hauteur écran ÷ hauteur locale du rig × échelle d'espèce
    const s = ((fy * ENT_H_M) / pr.depth / RIG_H) * (speciesScaleOf(refName, e.appearance?.species) ?? 1);

    // 4) vue/miroir POV (l'entité regarde `facing` — défaut 'S')
    const { view, mirror } = povView(cam.fwd, cam.right, e.facing ?? 'S');

    // 5) rig ancré aux pieds. Le flip miroir se fait DANS le repère local (autour de la boîte 120×150),
    //    comme `RigToken` (translate(120,0) scale(-1,1)), et `mirror` va aussi à `RigSprite` (profil).
    const sprite = <RigSprite appearance={prof.appearance} equip={prof.equip} career={prof.tenue} view={view} mirror={mirror} />;
    const local = mirror ? <g transform={`translate(${RIG_W},0) scale(-1,1)`}>{sprite}</g> : sprite;
    const node = (
      <g key={e.id} transform={`translate(${pr.sx.toFixed(2)},${pr.sy.toFixed(2)})`}>
        <g transform={`translate(${(-FOOT_X * s).toFixed(2)},${(-FOOT_Y * s).toFixed(2)}) scale(${s.toFixed(4)})`}>{local}</g>
      </g>
    );
    bbs.push({ id: e.id, depth: pr.depth, node });
  }

  // 6) tri loin→près (peintre) puis cap aux plus proches
  bbs.sort((a, b) => b.depth - a.depth);
  const kept = bbs.length > MAX_BILLBOARDS ? bbs.slice(bbs.length - MAX_BILLBOARDS) : bbs;

  return <g className="pov-billboards">{kept.map((b) => b.node)}</g>;
}

/** Échelle d'espèce du rig (Nain plus petit, Ogre plus grand) — résolue par le classifieur UNIQUE
 *  `resolveRender` (mêmes règles que `pickBackend.speciesScale`). Repli 1 (bipède Humain). */
function speciesScaleOf(refName: string, species: string | undefined): number {
  const rec = findCreatureById(refName);
  return resolveRender(species ?? rec?.appearance?.species, rec?.traits, refName).scale;
}
