import { describe, expect, it, vi } from 'vitest';
import * as THREE from 'three';
import { poseDynamicMarks, tetherDashCount, type DynMarkPools } from './dynamicMarkPose';
import { buildDynamicMarkMesh, dynSlotLiftM } from '../backends/webgl/dynamicMarkMeshes';
import { slotLiftM } from '../backends/webgl/highlightMeshes';
import { SPECKLE_LIFT_M } from '../backends/webgl/groundAccents';
import { resetDiagOnce } from '../rig/devDiag';
import { TETHER_DASH_K, TETHER_GAP_K, TETHER_WIDTH_K, type DynamicMarks } from '../builders/dynamicMarks';

/**
 * POSE PAR FRAME des marques dynamiques (#1176, P3-0d) — la passe PURE, mesurée hors de tout écran :
 * un lien d'engagement entre deux combattants dont l'un GLISSE doit avoir son chapelet de tirets aux
 * positions de l'instant, et non aux cases logiques. Ce qu'on vérifie ici est ce que la voie affine
 * obtient gratuitement en repeignant son SVG à chaque frame — et que le volumique n'obtient QUE si la
 * pose consomme le même canal de glissement.
 */
const MPT = 2;
const DASH_M = TETHER_DASH_K * MPT;
const GAP_M = TETHER_GAP_K * MPT;
const PLAT = () => 0;

function pools(): DynMarkPools {
  return {
    tether: buildDynamicMarkMesh('tether'),
    actif: buildDynamicMarkMesh('actif'),
    groupe: buildDynamicMarkMesh('groupe'),
  };
}

/** Position, lacet et échelle d'une instance écrite. */
function instance(mesh: THREE.InstancedMesh, i: number) {
  const m = new THREE.Matrix4();
  const pos = new THREE.Vector3();
  const quat = new THREE.Quaternion();
  const scl = new THREE.Vector3();
  mesh.getMatrixAt(i, m);
  m.decompose(pos, quat, scl);
  return { pos, quat, scl };
}

const PAIRE: DynamicMarks = {
  tethers: [{ a: { id: 'h1', cell: { x: 1, y: 1, z: 0 } }, b: { id: 'e1', cell: { x: 3, y: 1, z: 0 } } }],
  active: null,
  party: null,
};

describe('poseDynamicMarks — le lien d’engagement suit la glisse (#1176 P3-0d)', () => {
  it('une paire immobile : chapelet de tirets d’un centre de case à l’autre, au pas du gabarit', () => {
    const p = pools();
    const n = poseDynamicMarks(p, PAIRE, { mpt: MPT, glide: () => null, groundM: PLAT });
    // 2 cases d'écart = 4 m à `mpt` 2 ; le pas est celui de la voie affine (4 px de tiret, 3 de blanc).
    expect(n.tether).toBe(tetherDashCount(4, DASH_M, GAP_M));
    expect(p.tether!.count).toBe(n.tether);
    const premier = instance(p.tether!, 0);
    expect(premier.pos.x).toBeCloseTo(1 * MPT + DASH_M / 2, 5);
    expect(premier.pos.z).toBeCloseTo(1 * MPT, 5);
    expect(premier.scl.x).toBeCloseTo(DASH_M, 5); // longueur du tiret
    expect(premier.scl.z).toBeCloseTo(TETHER_WIDTH_K * MPT, 5); // épaisseur du trait
    // dernier tiret : entièrement dans le segment
    const dernier = instance(p.tether!, n.tether - 1);
    expect(dernier.pos.x).toBeLessThanOrEqual(3 * MPT);
    // le lien est tendu le long de +X : le lacet envoie l'axe du quad sur la direction du segment
    const axe = new THREE.Vector3(1, 0, 0).applyQuaternion(premier.quat);
    expect(axe.x).toBeCloseTo(1, 5);
    expect(axe.z).toBeCloseTo(0, 5);
  });

  it('un combattant qui GLISSE emporte SON extrémité — l’autre ne bouge pas', () => {
    const p = pools();
    const glissé = { dx: 1, dy: 0, dz: 0 };
    poseDynamicMarks(p, PAIRE, { mpt: MPT, glide: (cid) => (cid === 'h1' ? glissé : null), groundM: PLAT });
    const premier = instance(p.tether!, 0);
    // l'extrémité de `h1` est à 1·mpt + 1 m ; le premier tiret part de là.
    expect(premier.pos.x).toBeCloseTo(1 * MPT + 1 + DASH_M / 2, 5);
    // segment raccourci de 1 m → un tiret de moins que la version immobile
    expect(p.tether!.count).toBe(tetherDashCount(3, DASH_M, GAP_M));
  });

  it('le lacet du chapelet suit une direction quelconque (segment sur +Z)', () => {
    const p = pools();
    const versLeSud: DynamicMarks = {
      ...PAIRE,
      tethers: [{ a: { id: 'h1', cell: { x: 1, y: 1, z: 0 } }, b: { id: 'e1', cell: { x: 1, y: 4, z: 0 } } }],
    };
    poseDynamicMarks(p, versLeSud, { mpt: MPT, glide: () => null, groundM: PLAT });
    const axe = new THREE.Vector3(1, 0, 0).applyQuaternion(instance(p.tether!, 0).quat);
    expect(axe.x).toBeCloseTo(0, 5);
    expect(axe.z).toBeCloseTo(1, 5);
  });

  it('le contour de l’ACTIF couvre son empreinte et SUIT sa glisse ; le repère de GROUPE ne glisse pas', () => {
    const p = pools();
    const marks: DynamicMarks = {
      tethers: [],
      active: { id: 'm1', cell: { x: 4, y: 5, z: 0 }, n: 2 },
      party: { x: 7, y: 8, z: 0 },
    };
    const n = poseDynamicMarks(p, marks, {
      mpt: MPT,
      glide: () => ({ dx: 0.5, dy: 0, dz: 0 }),
      groundM: PLAT,
    });
    expect(n.actif).toBe(4); // empreinte 2×2
    const coins = Array.from({ length: 4 }, (_, i) => instance(p.actif!, i).pos);
    expect(coins.map((c) => `${c.x},${c.z}`).sort()).toEqual([
      `${4 * MPT + 0.5},${5 * MPT}`, `${4 * MPT + 0.5},${6 * MPT}`,
      `${5 * MPT + 0.5},${5 * MPT}`, `${5 * MPT + 0.5},${6 * MPT}`,
    ].sort());
    expect(instance(p.actif!, 0).scl.x).toBe(MPT); // le cadre couvre une case entière
    expect(n.groupe).toBe(1);
    const groupe = instance(p.groupe!, 0).pos;
    expect([groupe.x, groupe.z]).toEqual([7 * MPT, 8 * MPT]); // aucune glisse, comme en affine
  });

  it('la glisse VERTICALE (marche en pente) monte la marque avec son porteur', () => {
    const p = pools();
    poseDynamicMarks(p, { tethers: [], active: { id: 'h1', cell: { x: 0, y: 0, z: 1 }, n: 1 }, party: null }, {
      mpt: MPT,
      glide: () => ({ dx: 0, dy: 3, dz: 0 }),
      groundM: (_x, _y, z) => (z ? 5 : 0),
    });
    expect(instance(p.actif!, 0).pos.y).toBeCloseTo(5 + 3 + dynSlotLiftM('actif'), 5);
  });

  it('BIAIS : les trois marques dynamiques se posent AU-DESSUS de toutes les marques statiques', () => {
    // `rangeBand` est le rang le plus haut des marques de case (`highlightMeshes.SLOT_RANK`).
    expect(dynSlotLiftM('tether')).toBeGreaterThan(slotLiftM('rangeBand'));
    expect(dynSlotLiftM('actif')).toBeGreaterThan(dynSlotLiftM('tether'));
    expect(dynSlotLiftM('groupe')).toBeGreaterThan(dynSlotLiftM('actif'));
    // et chaque rang est un CRAN entier de décollement — jamais un demi (le z-fighting reviendrait)
    expect(dynSlotLiftM('actif') - dynSlotLiftM('tether')).toBeCloseTo(SPECKLE_LIFT_M, 12);
  });

  it('rien à peindre : les pools tombent à zéro instance, sans se démonter', () => {
    const p = pools();
    poseDynamicMarks(p, PAIRE, { mpt: MPT, glide: () => null, groundM: PLAT });
    const avant = p.tether!.instanceMatrix.array;
    const n = poseDynamicMarks(p, { tethers: [], active: null, party: null }, { mpt: MPT, glide: () => null, groundM: PLAT });
    expect(n).toEqual({ tether: 0, actif: 0, groupe: 0 });
    expect(p.tether!.count).toBe(0);
    expect(p.tether!.instanceMatrix.array).toBe(avant); // aucun tampon réalloué
  });

  it('SATURATION ATOMIQUE : un lien qui ne RENTRE pas ne s’ENTAME pas — le précédent reste entier', () => {
    resetDiagOnce();
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const deuxLiens: DynamicMarks = {
      tethers: [
        { a: { id: 'h1', cell: { x: 1, y: 1, z: 0 } }, b: { id: 'e1', cell: { x: 3, y: 1, z: 0 } } },
        { a: { id: 'h2', cell: { x: 1, y: 5, z: 0 } }, b: { id: 'e2', cell: { x: 3, y: 5, z: 0 } } },
      ],
      active: null,
      party: null,
    };
    const parLien = tetherDashCount(4, DASH_M, GAP_M); // 2 cases d'écart à `mpt` 2
    expect(parLien).toBeGreaterThan(2); // le témoin doit VRAIMENT avoir un chapelet à tronquer
    const cadre = { mpt: MPT, glide: () => null, groundM: PLAT };
    // Un quad de moins qu'il n'en faut pour les DEUX : le second lien est absent EN ENTIER.
    const p = { tether: buildDynamicMarkMesh('tether', parLien * 2 - 1) };
    const n = poseDynamicMarks(p, deuxLiens, cadre);
    expect(n.tether).toBe(parLien);
    expect(p.tether.count).toBe(parLien);
    // les tirets écrits sont ceux du PREMIER lien (z de sa rangée), aucun du second
    for (let i = 0; i < n.tether; i++) expect(instance(p.tether, i).pos.z).toBeCloseTo(1 * MPT, 5);
    // le PREMIER lien lui-même ne s'entame pas s'il ne tient pas
    const étroit = { tether: buildDynamicMarkMesh('tether', parLien - 1) };
    expect(poseDynamicMarks(étroit, deuxLiens, cadre).tether).toBe(0);
    // le DEV n'est prévenu qu'UNE fois — jamais soixante fois par seconde
    expect(warn.mock.calls.length).toBe(1);
    expect(String(warn.mock.calls[0][0])).toContain('tether');
    warn.mockRestore();
  });
});

describe('tetherDashCount — le pas du pointillé', () => {
  it('un segment plus court qu’un tiret en porte tout de même UN (cases voisines)', () => {
    expect(tetherDashCount(DASH_M / 2, DASH_M, GAP_M)).toBe(1);
  });
  it('aucun tiret sur un segment nul', () => {
    expect(tetherDashCount(0, DASH_M, GAP_M)).toBe(0);
  });
  it('un tiret de plus par période franchie', () => {
    const période = DASH_M + GAP_M;
    expect(tetherDashCount(période * 3, DASH_M, GAP_M)).toBe(3);
    expect(tetherDashCount(période * 3 + DASH_M * 1.5, DASH_M, GAP_M)).toBe(4);
  });
});
