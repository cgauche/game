import { describe, expect, it, vi } from 'vitest';
import { emptyScene, type Scene } from '../../state/scene';
import type { RoomPortal } from '../../state/roomPortals';
import { aretesUtilisables } from '../../state/aretes';
import { cleArete } from '../../state/wallIndex';
import { type Dims } from '../../geometry/iso';
import { poseFromDims, worldToScreen } from './projection';
import { projeterAretes } from './aretesProjetees';
import { areteSousLePixel, resoudrePixel, type CadreDePick, type EtatDePick, type Verdict } from './pickResolve';

/**
 * L'ÉTAGE `arete` DANS LA CHAÎNE (#1687, lot 1b-2) — ce que le pixel d'un seuil rend maintenant que
 * l'overlay ne prend plus le pointeur.
 *
 * Le pixel du CENTRE d'un seuil rend `nature:'arete'` et la clé que le survol nommait hier
 * (`cleArete`, l'identité de l'arête) ; un pixel plus loin que la demi-largeur de prise ne la rend
 * pas ; et sur tout autre pixel l'étage est INERTE — le verdict est celui de la MÊME chaîne appelée
 * sans arêtes. Ce dernier volet mesure l'inertie de l'étage sur l'arbre du jour, pas une égalité avec
 * une version antérieure du module.
 *
 * COÛT : deux prix distincts, et c'est le second qui pèse — le balayage des arêtes (borné relativement
 * à la chaîne) et l'INVERSION DU PIXEL, un `getBoundingClientRect()` que l'étage réclame dès qu'une
 * arête est offerte. Les deux se comptent ici.
 */

const dimsDe = (scene: Scene): Dims => ({ w: scene.dimensions.w, h: scene.dimensions.h, rot: 0, view: 'iso' });

/** Une salle 8×8 cloisonnée par un mur percé de DEUX accès : une porte et un passage. */
function scèneÀDeuxPièces(): Scene {
  const s = emptyScene(8, 8);
  s.walls = [
    ...[0, 3, 4, 5, 7].map((y) => ({ x: 3, y, side: 'E' as const })),
    { x: 3, y: 2, side: 'E' as const, door: true },
  ];
  return s;
}

/** Les accès que l'hôte calcule (`portalsForParty`) sur cette cloison — posés ici en littéraux : ce
 *  banc mesure la CHAÎNE, pas le zonage de pièces. */
const PORTAILS: readonly RoomPortal[] = [
  {
    id: '0:3,2:E:a:b', z: 0, edge: { x: 3, y: 2, side: 'E' },
    fromZoneId: 'a', toZoneId: 'b', kind: 'door-closed', exterior: false,
    from: { x: 3, y: 2 }, to: { x: 4, y: 2 },
  },
  {
    id: '0:3,6:E:a:b', z: 0, edge: { x: 3, y: 6, side: 'E' },
    fromZoneId: 'a', toZoneId: 'b', kind: 'passage', exterior: false,
    from: { x: 3, y: 6 }, to: { x: 4, y: 6 },
  },
];

const toutVisible = (scene: Scene): Set<string> => {
  const vu = new Set<string>();
  for (let x = 0; x < scene.dimensions.w; x += 1)
    for (let y = 0; y < scene.dimensions.h; y += 1) vu.add(`${x},${y},0`);
  return vu;
};

const milieu = (a: { cx: number; cy: number }, b: { cx: number; cy: number }) =>
  ({ x: (a.cx + b.cx) / 2, y: (a.cy + b.cy) / 2 });

/** Un acteur que le rayon peut NOMMER, pour le volet « aucune arête offerte » du coût. */
const acteur = { id: 'e1', pos: { x: 0, y: 0, z: 0 } };

const etat = (scene: Scene, partyPos = { x: 0, y: 0 }): EtatDePick =>
  ({ scene, mode: 'exploration', battle: null, partyPos }) as EtatDePick;

/** Le contexte de l'hôte pour les seules PORTES, tel que `MondeDeCampagne` le bâtit. */
function aretesDePortes(scene: Scene, portails: readonly RoomPortal[], dims: Dims) {
  return projeterAretes(
    aretesUtilisables({ scene, visible: toutVisible(scene), controleur: null, activeZ: 0, portails }),
    dims,
    () => 0,
  );
}

describe('L’étage `arete` : le seuil se résout dans la chaîne, plus par un hit-target SVG', () => {
  const scene = scèneÀDeuxPièces();
  const dims = dimsDe(scene);
  const pose = poseFromDims(dims);
  const portails = PORTAILS;
  const aretes = aretesDePortes(scene, portails, dims);
  const cadre: CadreDePick = { pose, dims, activeZ: 0, aretes };
  const sansAretes: CadreDePick = { ...cadre, aretes: [] };

  it('la scène du banc porte bien des accès dérivés (sans quoi rien n’est mesuré)', () => {
    expect(portails.length).toBeGreaterThan(0);
    expect(aretes).toHaveLength(portails.length);
  });

  it('au CENTRE d’un seuil : `nature:"arete"`, la clé d’hier, et la case d’où le geste part', () => {
    for (const { arete, a, b } of aretes) {
      const v = resoudrePixel(etat(scene), null, () => milieu(a, b), cadre);
      expect(v.nature, `${arete.cle} n’est pas résolue comme une arête`).toBe('arete');
      if (v.nature !== 'arete') continue;
      expect(v.arete.cle).toBe(cleArete(arete.x, arete.y, arete.side, arete.z));
      expect(v.via).toBe('arete');
      expect(v.tile).toEqual({ x: arete.ancrage.x, y: arete.ancrage.y, z: 0 });
      expect(v.arete.portail?.id).toBeTruthy();
    }
  });

  it('au-delà de la demi-largeur de prise, le seuil ne prend plus le pixel', () => {
    for (const { arete, a, b } of aretes) {
      const m = milieu(a, b);
      const nx = -(b.cy - a.cy) / Math.hypot(b.cx - a.cx, b.cy - a.cy);
      const ny = (b.cx - a.cx) / Math.hypot(b.cx - a.cx, b.cy - a.cy);
      const recul = arete.largeurPrise / 2 + 1;
      const dehors = { x: m.x + nx * recul, y: m.y + ny * recul };
      expect(resoudrePixel(etat(scene), null, () => dehors, cadre).nature).not.toBe('arete');
    }
  });

  it('HORS seuil, l’étage est INERTE : le verdict reste celui de la chaîne sans arêtes, pixel pour pixel', () => {
    const ecarts: string[] = [];
    const cle = (v: Verdict) => `${v.nature}|${v.via}|${v.tile ? `${v.tile.x},${v.tile.y},${v.tile.z}` : 'rien'}|${v.cid ?? '-'}`;
    for (let x = 0; x < dims.w; x += 1)
      for (let y = 0; y < dims.h; y += 1) {
        const g = worldToScreen(pose, { x, y, lift: 0 });
        const avec = resoudrePixel(etat(scene), null, () => g, cadre);
        if (avec.nature === 'arete') continue;
        const sans = resoudrePixel(etat(scene), null, () => g, sansAretes);
        if (cle(avec) !== cle(sans)) ecarts.push(`${x},${y} : ${cle(avec)} ≠ ${cle(sans)}`);
      }
    expect(ecarts).toEqual([]);
  });

  it('COÛT en MESURES DE LAYOUT : une inversion de pixel par résolution — zéro quand rien ne l’exige', () => {
    // Ce que le thunk porte, c'est un `getBoundingClientRect()` : le compter, c'est compter les
    // mesures de layout par `pointermove`. Avec des arêtes offertes, l'étage l'appelle — sur le seuil
    // comme à côté — et les étages de surface RÉUTILISENT ce point : jamais deux.
    const surLeSeuil = vi.fn(() => milieu(aretes[0].a, aretes[0].b));
    expect(resoudrePixel(etat(scene), null, surLeSeuil, cadre).nature).toBe('arete');
    expect(surLeSeuil).toHaveBeenCalledTimes(1);

    const aCote = vi.fn(() => ({ x: 1e5, y: 1e5 }));
    resoudrePixel(etat(scene), null, aCote, cadre);
    expect(aCote, 'l’étage d’arête et les surfaces partagent le MÊME point inversé').toHaveBeenCalledTimes(1);

    // Aucune arête offerte ET un rayon qui nomme sa cible : le pixel n'est pas inversé du tout.
    const enCombat = { ...etat(scene), mode: 'battle', battle: { combatants: [acteur], order: ['e1'], turn: 0 } } as unknown as EtatDePick;
    const jamais = vi.fn(() => milieu(aretes[0].a, aretes[0].b));
    expect(resoudrePixel(enCombat, { kind: 'combatant', id: 'e1' }, jamais, sansAretes).nature).toBe('combattant');
    expect(jamais).not.toHaveBeenCalled();
  });

  it('COÛT de l’étage : 89 arêtes balayées ne doublent pas le prix du survol', () => {
    // La population de la Diligence, mesurée au lot 1b-0 : 89 portails. L'étage les balaie TOUTES
    // quand le pixel n'en touche aucune — son pire cas, et celui du survol ordinaire.
    // Le budget est RELATIF à la chaîne SANS cet étage — ce que le survol payait déjà à chaque
    // `pointermove`. Un seuil en microsecondes mesurerait la charge de la MACHINE : le même balayage
    // vaut 2,8 µs seul et 7,1 µs sous la suite complète, là où le rapport, lui, tient. Mesuré :
    // 89 arêtes ≈ le prix de la chaîne entière (~31 ns par arête), donc le survol coûte au pire le
    // double — c'est ce plafond que ce banc verrouille, et une prise en O(n²) le crèverait.
    const beaucoup = Array.from({ length: 89 }, (_, i) => aretes[i % aretes.length]);
    const loin = { x: 1e5, y: 1e5 };
    const chrono = (tours: number, f: () => unknown): number => {
      const t0 = performance.now();
      for (let i = 0; i < tours; i += 1) f();
      return (performance.now() - t0) / tours;
    };
    const balayage = () => areteSousLePixel(loin, beaucoup);
    const chaineSeule = () => resoudrePixel(etat(scene), null, () => loin, sansAretes);
    chrono(2000, balayage); chrono(2000, chaineSeule); // chauffe
    const cout = chrono(20000, balayage);
    const reference = chrono(20000, chaineSeule);

    expect(balayage(), 'le pire cas mesuré est bien celui où AUCUNE arête ne prend le pixel').toBeNull();
    expect(cout / reference, `arête ${(cout * 1000).toFixed(2)} µs contre chaîne ${(reference * 1000).toFixed(2)} µs`)
      .toBeLessThan(2);
  });
});
