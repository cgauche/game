import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import {
  billboardDepthOffsetUnits,
  billboardPose,
  buildWorldGeometry,
  collectBillboards,
  contactShadow,
  contentBox,
  outdoorFog,
  skyTexture,
  sunContrast,
  sunRig,
  wantsContactShadow,
  worldFaces,
  worldShadowBox,
  AMBIENT_INTENSITY,
  BILLBOARD_BOX_ASPECT,
  BILLBOARD_DEPTH_BIAS_M,
  CONTACT_SHADOW_LIFT_M,
  DEPTH_BUFFER_BITS,
  LIGHT_COLOR,
  SHADOW_MAP_SIZE,
  SHADOW_NORMAL_BIAS_TEXELS,
  SUN_ELEVATION_DEG,
  SUN_INTENSITY,
} from './sceneMeshes';
import { facesGeometry, polyBounds, type Vec3 } from './worldTris';
import { anchorAndSize, billboardHeightM } from './billboardMath';
import { TINT_EXPLORED } from './visibilityTint';
import { buildScene } from '../../../state/mapSpec';
import { spec as siegeSpec } from '../../../scenes/test-scenarios/siege-enceinte';
import { scenario as arene } from '../../../scenes/test-scenarios/arene';
import { scenario as pontVitrine } from '../../../scenes/test-scenarios/pont-vitrine';
import { scenario as diligence } from '../../../scenes/test-scenarios/diligence';
import { buildOperaFloorplan } from '../../../scenes/opera/floorplan';
import { buildVitrineScene } from '../../../scenes/vitrine-batiments';
import { sceneMetresPerTile, type Scene, type Terrain } from '../../../state/scene';
import { PROPS, propSvg } from '../../catalog/decor';
import { AMBIANCE } from '../../catalog/ambiance';

const scene = buildScene(siegeSpec);
const mpt = sceneMetresPerTile(scene);
const plein = () => 1;

/** Les SIX scènes-témoins de l'écran de spike (`SpikeScreen.tsx`) — la population que l'utilisateur juge. */
const TEMOINS: [string, () => Scene][] = [
  ['siege-enceinte', () => scene],
  ['pont-vitrine', () => pontVitrine.scene],
  ['opera', () => buildOperaFloorplan()],
  ['arene', () => arene.scene],
  ['vitrine-batiments', () => buildVitrineScene()],
  ['diligence', () => diligence.scene],
];

/** Normale (unitaire) du triangle `i` de la géométrie fusionnée. */
function triNormal(pos: Float32Array | ArrayLike<number>, i: number) {
  const p = (k: number) => ({ x: pos[(i * 3 + k) * 3], y: pos[(i * 3 + k) * 3 + 1], z: pos[(i * 3 + k) * 3 + 2] });
  const [a, b, c] = [p(0), p(1), p(2)];
  const u = { x: b.x - a.x, y: b.y - a.y, z: b.z - a.z };
  const v = { x: c.x - a.x, y: c.y - a.y, z: c.z - a.z };
  const n = { x: u.y * v.z - u.z * v.y, y: u.z * v.x - u.x * v.z, z: u.x * v.y - u.y * v.x };
  const len = Math.hypot(n.x, n.y, n.z) || 1;
  const centre = { x: (a.x + b.x + c.x) / 3, y: (a.y + b.y + c.y) / 3, z: (a.z + b.z + c.z) / 3 };
  return { x: n.x / len, y: n.y / len, z: n.z / len, centre };
}

describe('FUSION — toute la scène en UNE géométrie', () => {
  it('une seule BufferGeometry non indexée porte position + couleur de tous les triangles', () => {
    const g = buildWorldGeometry(scene, mpt, plein);
    const pos = g.getAttribute('position');
    const col = g.getAttribute('color');
    expect(g.index).toBeNull(); // non indexée : `computeVertexNormals` donne la normale de FACE
    expect(pos.count).toBeGreaterThan(3000);
    expect(pos.count % 3).toBe(0);
    expect(col.count).toBe(pos.count);
    expect(g.getAttribute('normal').count).toBe(pos.count);
  });

  it('la teinte de visibilité MULTIPLIE la couleur de face (case explorée = plus sombre)', () => {
    const clair = buildWorldGeometry(scene, mpt, plein).getAttribute('color').array as Float32Array;
    const sombre = buildWorldGeometry(scene, mpt, () => TINT_EXPLORED).getAttribute('color').array as Float32Array;
    expect(sombre.length).toBe(clair.length);
    const somme = (a: Float32Array) => a.reduce((s, v) => s + v, 0);
    expect(somme(sombre)).toBeCloseTo(somme(clair) * TINT_EXPLORED, 1);
  });
});

describe('ORIENTATION — les triangles regardent DEHORS (la carte d’ombre en dépend)', () => {
  /** Le dehors d'une face ORIENTÉE est celui de SON volume ; celui d'une face sans orientation propre est
   *  le haut (horizontale) ou l'extérieur de la carte (verticale). */
  function bilan(scn: Scene) {
    const m = sceneMetresPerTile(scn);
    const pos = buildWorldGeometry(scn, m, plein).getAttribute('position').array as Float32Array;
    const geoms = facesGeometry(worldFaces(scn).map((f) => f.face), m);
    const cx = ((scn.dimensions.w - 1) / 2) * m;
    const cz = ((scn.dimensions.h - 1) / 2) * m;
    let i = 0;
    const b = { volumiques: 0, rentrantes: 0, horizontales: 0, versLeBas: 0, verticales: 0, versLInterieur: 0 };
    for (const g of geoms) {
      const boite = polyBounds(g.tris.flat());
      const mid: Vec3 = {
        x: (boite.lo.x + boite.hi.x) / 2,
        y: (boite.lo.y + boite.hi.y) / 2,
        z: (boite.lo.z + boite.hi.z) / 2,
      };
      for (let k = 0; k < g.tris.length; k++, i++) {
        const n = triNormal(pos, i);
        if (g.oriented) {
          const c = { x: n.centre.x, y: n.centre.y, z: n.centre.z };
          b.volumiques++;
          if (n.x * (c.x - mid.x) + n.y * (c.y - mid.y) + n.z * (c.z - mid.z) < 0) b.rentrantes++;
        } else if (Math.abs(n.y) > 1e-6) {
          b.horizontales++;
          if (n.y < 0) b.versLeBas++;
        } else {
          b.verticales++;
          if (n.x * (n.centre.x - cx) + n.z * (n.centre.z - cz) < 0) b.versLInterieur++;
        }
      }
    }
    expect(i * 3).toBe(pos.length / 3); // la fusion rend EXACTEMENT les triangles de `facesGeometry`
    return b;
  }

  for (const [nom, scn] of [['siege-enceinte', scene], ['arene', arene.scene]] as [string, Scene][])
    it(`${nom} : 0 triangle de mur à normale rentrante, 0 face libre retournée`, () => {
      const b = bilan(scn);
      expect(b.volumiques).toBeGreaterThan(1000);
      expect(b.horizontales).toBeGreaterThan(100);
      expect({ rentrantes: b.rentrantes, versLeBas: b.versLeBas, versLInterieur: b.versLInterieur }).toEqual({
        rentrantes: 0,
        versLeBas: 0,
        versLInterieur: 0,
      });
    });
});

describe('BILLBOARDS — sujets de la scène', () => {
  it('les personnages et le décor sont collectés, ancrés aux pieds, avec leur SVG par vue', () => {
    const subs = collectBillboards(scene, mpt, plein);
    const persos = subs.filter((s) => s.kind === 'personnage');
    expect(persos.length).toBeGreaterThan(0);
    expect(subs.some((s) => s.kind === 'prop')).toBe(true);
    const svg = persos[0].svg('front', false, 0);
    expect(svg).toContain('<defs>'); // le blob de rasterisation est un document ISOLÉ : défs incluses
    expect(svg).toContain('data-bone');
    expect(persos[0].svg('profile', false, 0)).not.toBe(svg); // la VUE demandée change le dessin
    expect(persos[0].box).toEqual({ w: 120, h: 150 });
  });

  it('le SVG d\'un PERSONNAGE ignore le cran de caméra, celui d\'un DÉCOR directionnel en dépend — c\'est ce qui règle la clé de cache', () => {
    const perso = collectBillboards(scene, mpt, plein).find((s) => s.kind === 'personnage')!;
    for (const camRot of [1, 2, 3] as const)
      expect(perso.svg('front', false, camRot)).toBe(perso.svg('front', false, 0));
    // Le décor délègue à `propSvg(ref, dir, camRot)` : un prop DIRECTIONNEL (`views`) pivote avec la
    // caméra, donc son cran reste dans la clé de cache. Lu sur le REGISTRE (les scènes du spike
    // n'en posent aucun aujourd'hui — une carte en posera un demain sans toucher au cache).
    const directionnels = Object.values(PROPS).filter((p) => p.views);
    expect(directionnels.length).toBeGreaterThan(0);
    expect(directionnels.every((p) => propSvg(p.id, 'S', 1) !== propSvg(p.id, 'S', 0))).toBe(true);
  });
});

describe('CONTENU — ce qu’un cadrage doit tenir', () => {
  const quadDe = (s: { kind: 'personnage' | 'prop'; scaleK: number }) =>
    anchorAndSize(billboardHeightM('jeu', s.kind) * s.scaleK, BILLBOARD_BOX_ASPECT);

  for (const [nom, faire] of TEMOINS)
    it(`${nom} : la boîte de contenu tient dans la géométrie élargie aux sujets, et porte tout le bâti`, () => {
      const scn = faire();
      const m = sceneMetresPerTile(scn);
      const geoBox = buildWorldGeometry(scn, m, plein).boundingBox!;
      const subs = collectBillboards(scn, m, plein);
      const box = contentBox(scn, m, subs, quadDe, geoBox);
      const englobante = worldShadowBox(geoBox, subs, quadDe);
      // La boîte englobante vient de l'attribut de position, en FLOAT32 : elle arrondit d'un ULP là où
      // la boîte de contenu lit les sommets en double. La marge est millimétrique, jamais métrique.
      expect(englobante.clone().expandByScalar(1e-3).containsBox(box)).toBe(true);
      // Toute face NON-TERRAIN (relief, structure, toiture) tient dans la boîte de contenu. Les rangs
      // coplanaires se mesurent sur la liste ENTIÈRE (contrat de `coplanarRanks`) : on filtre APRÈS.
      const toutes = worldFaces(scn).map((f) => f.face);
      const geoms = facesGeometry(toutes, m);
      let bati = 0;
      let dehors = 0;
      for (let i = 0; i < toutes.length; i++) {
        if (toutes[i].material.domain === 'terrain') continue;
        bati++;
        for (const tri of geoms[i].tris)
          for (const p of tri) if (!box.containsPoint(new THREE.Vector3(p.x, p.y, p.z))) dehors++;
      }
      expect(bati).toBeGreaterThan(0);
      expect(dehors).toBe(0);
    });

  it('elle ÉCARTE le terrain nu : la plaine d’herbe de vitrine-batiments sort du cadrage', () => {
    const scn = buildVitrineScene();
    const m = sceneMetresPerTile(scn);
    const geoBox = buildWorldGeometry(scn, m, plein).boundingBox!;
    const subs = collectBillboards(scn, m, plein);
    const box = contentBox(scn, m, subs, quadDe, geoBox);
    const t = (b: THREE.Box3) => b.getSize(new THREE.Vector3());
    // Mesuré #1176 : 60×48 m de géométrie pour 51,4×37,1 m de contenu.
    expect(t(box).x).toBeLessThan(t(geoBox).x - 5);
    expect(t(box).z).toBeLessThan(t(geoBox).z - 5);
  });

  it('une carte de PLAINE (aucune face hors terrain) retombe sur la boîte fournie', () => {
    const plaine: Scene = {
      ...scene,
      dimensions: { w: 6, h: 6 },
      layers: [{ z: 0, tiles: Array<Terrain>(36).fill('herbe') }],
      walls: [],
      architecture: [],
      entities: [],
    };
    const m = sceneMetresPerTile(plaine);
    expect(worldFaces(plaine).every((f) => f.face.material.domain === 'terrain')).toBe(true);
    const repli = new THREE.Box3(new THREE.Vector3(-3, 0, -4), new THREE.Vector3(3, 2, 4));
    expect(contentBox(plaine, m, [], quadDe, repli).equals(repli)).toBe(true);
  });
});

describe('LUMIÈRE — un soleil neutre et calibré', () => {
  it('les deux lumières sont NEUTRES : elles modulent la luminance, jamais la teinte de l’albédo', () => {
    const c = new THREE.Color(LIGHT_COLOR);
    expect([c.g - c.r, c.b - c.r]).toEqual([0, 0]); // gris pur : aucune dérive de teinte sur l'albédo
    expect(c.r).toBeGreaterThan(0.9); // et à pleine luminance : la lumière n'assombrit pas non plus
  });

  // Le RENDU réel se juge sur planche (`scripts/qc/spike-webgl.mjs`) — ici, seul le réglage est tenu :
  // sous le lambertien de three, une nappe au sol reçoit `AMBIENT + SUN·sin(élévation)` et une face dos au
  // soleil `AMBIENT`, soit un contraste `1 + sin(élévation)·SUN/AMBIENT`.
  it('le contraste nappe ÷ dos au soleil vaut 2,16 à 10 % près, l’ambiante ne descend pas au noir', () => {
    const cible = 1 + Math.sin((38 * Math.PI) / 180) * (0.85 / 0.45);
    expect(cible).toBeCloseTo(2.16, 2);
    expect(sunContrast()).toBeCloseTo(1 + Math.sin((SUN_ELEVATION_DEG * Math.PI) / 180) * (SUN_INTENSITY / AMBIENT_INTENSITY), 12);
    expect(sunContrast()).toBeGreaterThan(cible * 0.9);
    expect(sunContrast()).toBeLessThan(cible * 1.1);
    expect(AMBIENT_INTENSITY).toBeGreaterThan(0.35);
    expect(AMBIENT_INTENSITY + SUN_INTENSITY).toBeLessThan(1.5); // ni face brûlée
  });

  it('l’élévation ne dépend PAS de la taille de la carte (une grande scène ne met pas le soleil au zénith)', () => {
    const elevDe = (b: THREE.Box3) => {
      const rig = sunRig(b);
      const d = rig.position.clone().sub(rig.target);
      return (Math.atan2(d.y, Math.hypot(d.x, d.z)) * 180) / Math.PI;
    };
    const petite = new THREE.Box3(new THREE.Vector3(0, 0, 0), new THREE.Vector3(20, 4, 20));
    const grande = new THREE.Box3(new THREE.Vector3(0, 0, 0), new THREE.Vector3(400, 4, 400));
    expect(elevDe(petite)).toBeCloseTo(SUN_ELEVATION_DEG, 6);
    expect(elevDe(grande)).toBeCloseTo(SUN_ELEVATION_DEG, 6);
  });

  // Le frustum se calcule sur les CASTEURS : la géométrie ET les quads de billboard. Sur la seule boîte
  // de géométrie, un sujet du siège débordait de 0,769 m (3,44 m à `pont-vitrine` en `heroique`) — hors
  // frustum, la silhouette cesse de projeter.
  for (const [nom, faire] of TEMOINS)
    it(`${nom} : le frustum d’ombre contient la géométrie ET les billboards (ancres + sommets)`, () => {
      const scn = faire();
      const m = sceneMetresPerTile(scn);
      const geoBox = buildWorldGeometry(scn, m, plein).boundingBox!;
      const subs = collectBillboards(scn, m, plein);
      const quadDe = (s: (typeof subs)[number]) =>
        anchorAndSize(billboardHeightM('jeu', s.kind) * s.scaleK, BILLBOARD_BOX_ASPECT);
      const box = worldShadowBox(geoBox, subs, quadDe);
      const rig = sunRig(box);
      const vue = new THREE.Matrix4()
        .lookAt(rig.position, rig.target, new THREE.Vector3(0, 1, 0))
        .setPosition(rig.position)
        .invert();
      const points: THREE.Vector3[] = [];
      for (const x of [geoBox.min.x, geoBox.max.x])
        for (const y of [geoBox.min.y, geoBox.max.y])
          for (const z of [geoBox.min.z, geoBox.max.z]) points.push(new THREE.Vector3(x, y, z));
      for (const s of subs) {
        const q = quadDe(s);
        for (const dx of [-q.widthM / 2, q.widthM / 2])
          for (const dy of [0, q.heightM])
            for (const dz of [-q.widthM / 2, q.widthM / 2])
              points.push(s.anchor.clone().add(new THREE.Vector3(dx, dy, dz)));
      }
      let hors = 0;
      let horsBoite = 0;
      for (const p of points) {
        if (!box.containsPoint(p)) horsBoite++;
        const c = p.clone().applyMatrix4(vue);
        if (Math.abs(c.x) > rig.span || Math.abs(c.y) > rig.span || -c.z < rig.near || -c.z > rig.far) hors++;
      }
      // 8 coins de géométrie + les 8 sommets du quad de CHAQUE sujet : la garde couvre bien les billboards.
      expect({ points: points.length, horsBoite, hors }).toEqual({ points: 8 + 8 * subs.length, horsBoite: 0, hors: 0 });
    });

  it('le biais de normale se compte en TEXELS de la carte d’ombre (jamais un forfait métrique)', () => {
    const box = buildWorldGeometry(scene, mpt, plein).boundingBox!;
    const rig = sunRig(box);
    expect(rig.mapSize).toBe(SHADOW_MAP_SIZE);
    expect(rig.normalBias).toBeCloseTo(((2 * rig.span) / SHADOW_MAP_SIZE) * SHADOW_NORMAL_BIAS_TEXELS, 9);
    expect(rig.normalBias).toBeLessThan(0.25); // le forfait de 0,35 m mangeait l'ombre des blocs bas
  });
});

describe('CIEL & BRUME — les couleurs du POV, jamais des teintes propres au spike', () => {
  it('le dégradé va de la brume d’horizon (bas) au haut de ciel — les teintes du catalogue', () => {
    const tex = skyTexture();
    const d = tex.image.data as Uint8Array;
    const hex = (i: number) => `#${[0, 1, 2].map((k) => d[i * 4 + k].toString(16).padStart(2, '0')).join('')}`;
    expect(hex(0)).toBe(AMBIANCE.pov.fogOutdoor.toLowerCase());
    expect(hex(tex.image.height / 2 - 1)).toBe(AMBIANCE.pov.fogOutdoor.toLowerCase()); // horizon à mi-hauteur
    expect(hex(tex.image.height - 1)).toBe(AMBIANCE.pov.skyTop.toLowerCase());
    expect(tex.colorSpace).toBe(THREE.SRGBColorSpace);
  });

  it('la brume reprend la courbe de profondeur du POV, en CASES converties en mètres', () => {
    const fog = outdoorFog(mpt);
    const d = AMBIANCE.pov.depth.outdoor;
    expect(fog.near).toBeCloseTo(d.fogStartT * mpt, 9);
    expect(fog.far).toBeCloseTo(d.farTiles * mpt, 9);
    expect(`#${fog.color.getHexString(THREE.SRGBColorSpace)}`).toBe(AMBIANCE.pov.fogOutdoorSurface.toLowerCase());
  });
});

describe('BIAIS de PROFONDEUR — le quad ne bouge pas, seule sa profondeur ment', () => {
  it('l’ancre MONDE du quad est invariante par caméra : l’arête basse reste sur les pieds', () => {
    const ancre = new THREE.Vector3(12.5, 3.25, -7.75);
    const lift = 1.15;
    const cams = [
      new THREE.Quaternion(),
      new THREE.Quaternion().setFromEuler(new THREE.Euler(-0.6, 0.8, 0, 'YXZ')),
      new THREE.Quaternion().setFromEuler(new THREE.Euler(-1.1, 2.4, 0, 'YXZ')),
      new THREE.Quaternion().setFromEuler(new THREE.Euler(0.2, -3.0, 0, 'YXZ')),
    ];
    for (const q of cams) {
      const pos = billboardPose(ancre, lift, q);
      const up = new THREE.Vector3(0, 1, 0).applyQuaternion(q);
      const bas = pos.clone().addScaledVector(up, -lift);
      expect(bas.distanceTo(ancre)).toBeCloseTo(0, 9);
      // et AUCUNE composante le long du regard : le déplacement est colinéaire au haut d'écran.
      const regard = new THREE.Vector3(0, 0, -1).applyQuaternion(q);
      expect(pos.clone().sub(ancre).dot(regard)).toBeCloseTo(0, 9);
    }
  });

  it('le biais vaut BILLBOARD_DEPTH_BIAS_M de profondeur, vers l’œil, et rien de plus', () => {
    const units = billboardDepthOffsetUnits(100, 300);
    expect(units).toBeLessThan(0); // vers l'œil
    expect(units).toBeCloseTo((-BILLBOARD_DEPTH_BIAS_M / 200) * 2 ** DEPTH_BUFFER_BITS, 6);
    // PERSPECTIVE : la profondeur fenêtre n'est pas linéaire — le même mètre coûte 4× moins loin ×2.
    const proche = billboardDepthOffsetUnits(0.1, 400, 5);
    const loin = billboardDepthOffsetUnits(0.1, 400, 10);
    expect(proche / loin).toBeCloseTo(4, 6);
  });
});

describe('OMBRE DE CONTACT — ancrée sous les pieds', () => {
  it('le disque n’existe qu’en couleur CUITE : en éclairé, l’ombre PROJETÉE fait foi', () => {
    expect(wantsContactShadow('personnage', false)).toBe(true);
    expect(wantsContactShadow('personnage', true)).toBe(false);
    expect(wantsContactShadow('prop', false)).toBe(false); // le décor porte son ellipse dans son art
  });

  it('le disque est à l’aplomb EXACT de l’ancre, posé à plat sur le sol', () => {
    const ancre = new THREE.Vector3(12.5, 3.25, -7.75);
    const disque = contactShadow(ancre, 2);
    expect(disque.position.x).toBe(ancre.x);
    expect(disque.position.z).toBe(ancre.z);
    expect(disque.position.y).toBeCloseTo(ancre.y + CONTACT_SHADOW_LIFT_M, 9);
    expect(disque.rotation.x).toBeCloseTo(-Math.PI / 2, 9);
    expect(disque.geometry.parameters.radius).toBeGreaterThan(0);
  });
});
