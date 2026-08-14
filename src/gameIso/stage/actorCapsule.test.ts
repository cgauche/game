import { describe, it, expect } from 'vitest';
import type { Dims } from '../../geometry/iso';
import { actorCapsuleOf } from './actorCapsule';
import { baseSkeleton, applyBuild, groundSkeleton } from '../rig/skeletons';
import { gabaritById, type GabaritDef } from '../rig/gabarits';
import { raceById } from '../rig/races';
import { worldTransforms, apply } from '../rig/kinematics';
import { BONE_IDS } from '../rig/bones';
import { sizeTokenScale } from '../sizeScale';
import { COMBAT_TOKEN_BASE } from '../builders/dynamicMarks';
import type { SizeCategory } from '../../engine/size';

/**
 * LA CAPSULE EST CALÉE SUR LE CORPS DESSINÉ (#907). Elle sert la visée CAMÉRA du sujet et la loi de
 * DÉGAGEMENT du monde (`IsoStage` → `cleared`) : trop étroite, elle manque les occulteurs posés sur
 * les épaules (le défaut d'origine) ; trop large, elle dégage des masses qui ne cachent rien.
 * Le contrat se REMESURE sur le rig, il ne fige aucun nombre.
 */
describe('actorCapsuleOf — la boîte du jeton est calée sur le CORPS DESSINÉ (#907)', () => {
  const dims: Dims = { w: 20, h: 20, rot: 0, view: 'iso' };
  const radiusOf = () => actorCapsuleOf({ x: 5, y: 5, h: 0 }, dims).radius;

  /** Échelle de token d'un combattant : `COMBAT_TOKEN_BASE` × speciesScale × `sizeTokenScale`.
   *  `speciesScale` vaut 1 pour toute espèce jouable — ni `perso.scale` sur la def de créature, ni
   *  `scale` sur la race (`raceAppearance.json`). */
  const tokenScale = (size: SizeCategory) => COMBAT_TOKEN_BASE * sizeTokenScale(size);

  /** Demi-largeur ÉCRAN de la silhouette RÉELLEMENT dessinée par le rig, sur le squelette de
   *  production (`groundedBodySkeleton`, composeRig.tsx) : FK de la pose de repos, extrémités de
   *  chaque os élargies de sa demi-épaisseur, écart maximal à l'axe du bassin — l'axe que `BodyToken`
   *  aligne sur le centre de la tuile. */
  const drawnHalfWidth = (g: GabaritDef, sex: 'M' | 'F', build: number, scale: number) => {
    const sk = groundSkeleton(applyBuild(baseSkeleton(g, sex), build));
    const world = worldTransforms(sk, {});
    let half = 0;
    for (const id of BONE_IDS) {
      const bone = sk[id];
      if (bone.thickness === 0 && bone.length === 0) continue;
      const t = bone.thickness / 2;
      for (const along of [0, bone.length])
        for (const across of [-t, t])
          half = Math.max(half, Math.abs(apply(world[id], { x: across, y: along }).x - sk.bassin.pivot.x));
    }
    return half * scale;
  };

  /** Carrures qu'un HÉROS présente à la capsule (elle ne sert que les héros et le meneur du groupe —
   *  `IsoStage`), de Taille Moyenne ou moindre. La Taille vient du talent d'espèce (`species.json` :
   *  `petit` → Petite, `talents.json`). */
  const HERO_RIGS: { race: string; size: SizeCategory }[] = [
    { race: 'Humain', size: 'moyenne' },
    { race: 'Nain', size: 'moyenne' },
    { race: 'Haut-Elfe', size: 'moyenne' },
    { race: 'Elfe sylvain', size: 'moyenne' },
    { race: 'Halfling', size: 'petite' },
    { race: 'Gnome', size: 'petite' },
  ];
  /** Gabarit résolu comme en production : celui de la race, surchargé par son `gabaritOverride`. */
  const gabaritOf = (raceId: string): GabaritDef => {
    const r = raceById(raceId);
    return { ...gabaritById(r.gabarit), ...(r.gabaritOverride ?? {}) };
  };
  const SEXES = ['M', 'F'] as const;
  const BUILDS = [0, 0.5, 1]; // `Appearance.build` est libre sur [0,1] — la carrure MAXIMALE compte

  const widestHeroBody = () => Math.max(...HERO_RIGS.flatMap(({ race, size }) =>
    SEXES.flatMap((sex) => BUILDS.map((b) => drawnHalfWidth(gabaritOf(race), sex, b, tokenScale(size))))));

  it('couvre le corps dessiné de CHAQUE carrure de héros, jusqu’à la carrure maximale', () => {
    const radius = radiusOf();
    for (const { race, size } of HERO_RIGS)
      for (const sex of SEXES)
        for (const build of BUILDS)
          expect(radius, `${race} ${sex} build=${build}`)
            .toBeGreaterThanOrEqual(drawnHalfWidth(gabaritOf(race), sex, build, tokenScale(size)));
  });

  it('sans doubler ce corps : la capsule n’est pas une colonne de verre', () => {
    expect(radiusOf()).toBeLessThan(widestHeroBody() * 1.3);
  });
});
