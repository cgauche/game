import { pregenParty, PREGEN } from '../../data/pregens';
import { scanMarkers, parseAsciiRows } from '../../state/asciiMap';
import { siegeEmplacementEntity } from '../../state/siegeEmplacement';
import { findTrappingById, weaponGroupLabel, type SkillRef } from '../../data';
import type { Scene, SceneEntity, WallSeg, Terrain, EncounterMember } from '../../state/scene';
import { setEncounters, type TestScenario } from './_shared';
import { Z0_ASCII, Z1_ASCII, WALL, WALL_ROW } from './siege-enceinte.ascii';

/**
 * SIÈGE COMPLET — défendre l'enceinte, reconstruit sur le RELIEF MÉTRIQUE. Carte PROFONDE (30×46, 2 couches)
 * à l'échelle d'un vrai siège :
 *  - au NORD, le CAMP assaillant (tentes, braséros, bannières) et sa BATTERIE braquée sur la PORTE : une
 *    CATAPULTE pilonne de TRÈS LOIN en tir indirect (~71 m), un CANON de siège AVANCÉ tire en direct (~46 m) —
 *    l'IA cible la structure (Atout Siège), le canon BRÈCHE la porte tout seul ;
 *  - des FANTASSINS qui traversent le glacis, FRANCHISSENT la RIVIÈRE par le PONT (seul passage) et s'amassent
 *    à la porte tant qu'elle tient ;
 *  - le MUR D'ENCEINTE = des `WallSeg` (courtine `mur-en-pierre` + une `porte-de-ville` brèchable), SANS aucune
 *    hauteur de mur : la 3ᵉ dimension du rempart est sa COUCHE z1 ;
 *  - le CHEMIN DE RONDE = couche 1 'pierre' à 4 m (épais de 2 cases, y37 côté champ + y38 côté cour) garni de
 *    PIÈCES servies (baliste/canon) et d'ARCHERS PNJ alliés-IA, surmonté d'un PARAPET (`WallSeg` z1 sur l'arête
 *    EXTÉRIEURE) ; on le rejoint par UNE RAMPE de la cour (cases montant ≤1 m/case sur 5 cases — le moteur en
 *    fait une pente, plus aucun escalier) ;
 *  - au SUD, une COUR pavée MODESTE où démarre le groupe, au pied de la rampe.
 * Combat VERTICAL : les défenseurs (couche 1, 4 m) pilonnent en contrebas et la mêlée est refusée à travers le
 * vide (`combatDistance` ajoute la séparation métrique) ; le parapet ne coupe PAS la LdV plongeante (cross-niveau).
 *
 * Carte = `siege-enceinte.ascii.ts` (ÉDITABLE). Ici : on parse les 2 grilles + l'enceinte, on POSE les hauteurs
 * métriques (rampe + chemin de ronde) en tableaux parallèles, et on pose les entités/rencontre depuis les
 * MARQUEURS scannés (aucune coordonnée d'unité en dur).
 */

const W = 30, H = 46;
const rowsOf = (s: string) => s.split('\n').slice(1, -1);

// ── Couches : marqueurs scannés PUIS nettoyés (fill = terrain SOUS le marqueur), terrain parsé ───────────
const z0 = scanMarkers(rowsOf(Z0_ASCII), '@kpo', { '@': 'P' }); // cour pavée sous @ ; champ sous k/p/o (défaut '.')
const z1 = scanMarkers(rowsOf(Z1_ASCII), 'BKAG', { B: 'W', K: 'W', A: 'W', G: 'W' }); // passerelle de pierre sous chaque marqueur
const g0 = parseAsciiRows(z0.cleaned, 'herbe', { P: 'pave', '~': 'eau', '=': 'planches' });
const g1 = parseAsciiRows(z1.cleaned, 'vide', { W: 'pierre' });

// ── HAUTEURS MÉTRIQUES (tableaux PARALLÈLES, indexation y·W+x) ────────────────────────────────────────────
const idx = (x: number, y: number) => y * W + x;
function fillRect(g: number[], x0: number, y0: number, x1: number, y1: number, h: number) {
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) g[idx(x, y)] = h;
}
// Couche 0 : la RAMPE d'accès (cols 14-15, derrière la porte) monte de la cour (0 m) au rempart (4 m) sur
// 5 cases, ≤1 m/case → pente continue jusqu'à rejoindre la couche 1 à hauteur ÉGALE (4 m) en y39.
const h0 = new Array(W * H).fill(0) as number[];
fillRect(h0, 14, 39, 15, 39, 4); // pied du tablier (rejoint le chemin de ronde y38 à 4 m)
fillRect(h0, 14, 40, 15, 40, 3);
fillRect(h0, 14, 41, 15, 41, 2);
fillRect(h0, 14, 42, 15, 42, 1); // (y43 reste à 0 : raccord plat avec la cour)
// Couche 1 : le chemin de ronde (y37-38) est à 4 m — la rampe l'y rejoint, le sol/champ est 4 m plus bas.
const h1 = new Array(W * H).fill(0) as number[];
fillRect(h1, 0, WALL_ROW - 1, W - 1, WALL_ROW, 4);

// ── Enceinte : 1 char/colonne sur l'arête N de WALL_ROW (porte brèchable, courtine/tours en pierre) ────────
// La porte de ville est une STRUCTURE brèchable, PAS une porte ouvrable : tant qu'elle tient, l'arête bloque
// passage+vue comme un mur plein ; elle ne s'ouvre QU'une fois ABATTUE (`structureIsDown` → BRÈCHE). Donc
// PAS de `door:true`. PLUS de champ `height` sur le mur (le contrat retire `WallSeg.height`).
const enceinte: WallSeg[] = [...WALL].flatMap((ch, x) =>
  ch === '.' ? [] : [{ x, y: WALL_ROW, side: 'N' as const, structure: ch === 'G' ? 'porte-de-ville' : 'mur-en-pierre' }]);
// PARAPET : `WallSeg` z1 sur l'arête EXTÉRIEURE (côté champ) du chemin de ronde (arête N de y37). Bloque la
// marche hors du rempart au même niveau, MAIS la LdV plongeante z1→z0 l'ignore (lineOfSightCover cross-niveau)
// → les défenseurs tirent par-dessus les créneaux sur le champ en contrebas.
const parapet: WallSeg[] = Array.from({ length: W }, (_, x) => ({ x, y: WALL_ROW - 1, side: 'N' as const, z: 1 }));
const walls: WallSeg[] = [...enceinte, ...parapet];

// ── DÉFENSEURS (couche 1) : archers PNJ alliés-IA + guetteur + pièces de rempart SERVIES par leur équipage ──
const archer = (id: string, p: { x: number; y: number }, label = 'Archer du guet'): SceneEntity =>
  ({ id, kind: 'personnage', z: 1, pos: { x: p.x, y: p.y }, facing: 'N', label, ref: 'garde-du-village', weapon: 'Arc' });
// Compétence Projectiles APPROPRIÉE au Groupe de l'engin (AA p.122 l.3900) : un servant ne compte dans l'équipe
// QUE s'il la possède (sinon « n'est pas considéré comme un membre de l'équipe », l.3923). Dérivée de la pièce
// (`weaponGroup` du trapping) → la Spé = libellé du Groupe (Arbalète/Poudre noire/Catapulte). Test ~40.
const projForPiece = (trappingId: string): SkillRef[] => {
  const g = findTrappingById(trappingId)?.weaponGroup;
  return g ? [{ id: 'projectiles', spec: weaponGroupLabel(g), value: 40 }] : [];
};
// Servant de pièce : une VRAIE créature du bestiaire (garde, a une CT pour viser), SANS arme propre → sa seule
// arme à distance est la PIÈCE servie (l'IA tire donc la baliste/le canon, pas un arc). Posté à CÔTÉ de l'affût.
// On lui DONNE la Projectiles du Groupe de SA pièce → il compte comme membre d'équipe qualifié (sinon effectif 0).
const gunner = (id: string, p: { x: number; y: number }, label: string, trappingId: string): SceneEntity =>
  ({ id, kind: 'personnage', z: 1, pos: { x: p.x, y: p.y }, facing: 'N', label, ref: 'garde-du-village',
     combat: { skills: projForPiece(trappingId) } });
// Affût servi via le builder PARTAGÉ : `ref` = engin (rig DÉRIVÉ, affût inerte RAW-pur AA p.122-123). Libellé surchargé.
const piece = (id: string, p: { x: number; y: number }, trappingId: string, label: string, crewId: string): SceneEntity =>
  ({ ...siegeEmplacementEntity(id, trappingId, p, { z: 1, facing: 'N', crewIds: [crewId] })!, label });

const archers = z1.positions['A'].map((p, i) => archer(`def-archer-${i}`, p));
const guetteur = archer('garde-porte', z1.positions['G'][0], 'Guetteur du corps de garde'); // au-dessus de la porte → chute à la brèche
const Bpos = z1.positions['B'][0], Kpos = z1.positions['K'][0];
const baliste = piece('empl-baliste', Bpos, 'baliste', 'Baliste de rempart', 'crew-baliste');
const balisteCrew = gunner('crew-baliste', { x: Bpos.x - 1, y: Bpos.y }, 'Servant de baliste', 'baliste');
const canon = piece('empl-canon', Kpos, 'canon-petit', 'Canon de rempart', 'crew-canon');
const canonCrew = gunner('crew-canon', { x: Kpos.x - 1, y: Kpos.y }, 'Servant de canon', 'canon-petit');
const defenders = [...archers, guetteur, balisteCrew, canonCrew]; // PNJ alliés-IA (arcs + servants de pièce)
const pieces = [baliste, canon];                                   // affûts INERTES servis par leur équipage

// ── CAMP assaillant (décor, nord) ───────────────────────────────────────────────────────────────────────
const prop = (id: string, ref: string, x: number, y: number): SceneEntity => ({ id, kind: 'prop', ref, pos: { x, y } });
const camp: SceneEntity[] = [
  prop('camp-tente-0', 'tente', 3, 0), prop('camp-tente-1', 'tente', 14, 0), prop('camp-tente-2', 'tente', 26, 0),
  prop('camp-brasero-0', 'brasero', 8, 0), prop('camp-brasero-1', 'brasero', 21, 0),
  prop('camp-etendard-0', 'etendard', 12, 1), prop('camp-etendard-1', 'etendard', 17, 1),
];

const tiles0: Terrain[] = g0.tiles, tiles1: Terrain[] = g1.tiles;

const entities: SceneEntity[] = [
  { id: 'start', kind: 'heroStart', pos: { ...z0.positions['@'][0] } }, // cour pavée, au pied de la rampe (couche 0)
  ...defenders, ...pieces, ...camp,
];

const scene: Scene = {
  id: 'siege-enceinte',
  nom: 'Siège — défendre la muraille',
  description:
    "Un siège à grande échelle : au nord, le camp assaillant et sa batterie (canon + catapulte) qui pilonne la " +
    "porte de très loin ; des fantassins franchissent la rivière par le pont et s'amassent à la porte ; au sud, " +
    "l'enceinte à porte brèchable, son chemin de ronde (couche surélevée à 4 m) garni de pièces et d'archers, " +
    "rejoint par une rampe, et une cour pavée.",
  dimensions: { w: W, h: H },
  metresPerTile: 2, // person-scale (LDB) : 1 case = 2 m → bandes de portée (canon 50 m / catapulte 75 m)
  ambiance: 'exterieur',
  ambientLight: 'jour', // plein jour : on voit l'assaut approcher sur tout le glacis
  layers: [
    { z: 0, tiles: tiles0, height: h0 },
    { z: 1, tiles: tiles1, height: h1 },
  ],
  walls,
  entities,
  dialogues: [],
  triggers: [],
  flags: {},
  encounters: [],
  startMessage:
    "Défendez l'enceinte. Gagnez le CHEMIN DE RONDE par la RAMPE de la cour, SERVEZ une pièce et pilonnez " +
    "l'assaut en contrebas. La batterie ennemie brèche la porte de très loin — quand elle cède, qui se tient " +
    "sur la passerelle au-dessus chute. Les assaillants ne peuvent forcer le passage qu'une fois la porte abattue.",
};

// ── ASSAILLANTS (couche 0) : la BATTERIE est faite d'AFFÛTS INERTES rendus comme des ENGINS (canon + catapulte),
//    chacun SERVI par un brigand-équipage adjacent — exactement comme les pièces de rempart : on neutralise la
//    pièce en tuant le brigand, pas en frappant l'affût. Les brigands (terse, index 0/1) reçoivent l'engin via le
//    poste de leur affût (`applyShipPostes`) → ils tirent dès le 1er tour ; puis les FANTASSINS gobelins. ─
const k = z0.positions['k'][0]; // affût canon de siège (avancé, à portée directe de la porte)
const cat = z0.positions['p'][0]; // affût catapulte (arrière, tir indirect)
setEncounters(scene, [
  {
    id: 'assaut',
    enemies: [
      // Brigands-équipage (ids déterministes enemy-assaut-0 = canon, enemy-assaut-1 = catapulte), SANS arme de
      // siège propre : leur seule arme à distance est la pièce servie via l'affût ci-dessous. Postés à CÔTÉ.
      // Chacun reçoit la Projectiles du Groupe de SA pièce → équipage qualifié (sinon l'assaut tire à vide).
      { ref: 'brigand', pos: { x: k.x - 1, y: k.y }, facing: 'S', label: 'Canonnier de siège', skills: projForPiece('canon-petit') },
      { ref: 'brigand', pos: { x: cat.x - 1, y: cat.y }, facing: 'S', label: 'Servant de catapulte', skills: projForPiece('catapulte-petite') },
      ...z0.positions['o'].map((p) => ({ ref: 'gobelin', pos: { ...p }, facing: 'S' as const })),
    ],
  },
]);

// Affûts assaillants = ENGINS inertes (builder PARTAGÉ, rig DÉRIVÉ de la ref) servis par les brigands ci-dessus.
const assautCanon = siegeEmplacementEntity('empl-assaut-canon', 'canon-petit', k, { facing: 'S', crewIds: ['enemy-assaut-0'] })!;
const assautCata = siegeEmplacementEntity('empl-assaut-catapulte', 'catapulte-petite', cat, { facing: 'S', crewIds: ['enemy-assaut-1'] })!;
scene.entities.push(assautCanon, assautCata);

// Défenseurs = membres ALLIÉS de l'assaut. Les ARCHERS/guetteur/servants agissent SEULS (`ai:true` → aiControlled) ;
// les AFFÛTS (rempart ET assaillants) sont INERTES (pas de tour, servis par leur équipage). Une SceneEntity à
// `z`/`postes` n'est enrôlée QUE si un `EncounterMember` la référence (roster = `members`).
const allyMembers: EncounterMember[] = [
  ...defenders.map((e) => ({ entityId: e.id, side: 'ally' as const, ai: true })),
  ...pieces.map((e) => ({ entityId: e.id, side: 'ally' as const })),
];
scene.encounters[0].members!.push(
  ...allyMembers,
  { entityId: assautCanon.id, side: 'enemy' as const }, // affût assaillant : camp ennemi, inerte (hors tour)
  { entityId: assautCata.id, side: 'enemy' as const },
);

export const scenario: TestScenario = {
  id: 'siege-enceinte',
  order: 41,
  category: '⚔️ Combat',
  icon: '🏰',
  title: 'Siège — défendre la muraille',
  tests:
    'Siège à grande échelle (30×46, 2 couches) : champ d\'approche profond (~76 m) + camp & BATTERIE assaillante ' +
    '(canon direct + catapulte indirecte) qui BRÈCHE la porte de loin (IA cible la structure, Atout Siège) ; rivière ' +
    '+ pont qui canalise l\'assaut ; enceinte à porte brèchable (WallSeg sans hauteur) ; chemin de ronde = couche 1 ' +
    'à 4 m, rejoint par UNE RAMPE (hauteurs croissantes, plus d\'escalier), parapet z1 sur l\'arête extérieure ; ' +
    'pièces servies + ARCHERS PNJ alliés-IA ; combat VERTICAL (LdV plongeante, mêlée refusée à travers le vide).',
  partyNote: 'Groupe pré-tiré (Soldat / Chasseur / Sorcier / Tueur) : montez au rempart par la rampe ; le SOLDAT sait servir les pièces (Baliste/Canon).',
  makeParty: () => {
    const party = pregenParty(PREGEN.soldat, PREGEN.chasseur, PREGEN.sorcier, PREGEN.tueur);
    // Le SOLDAT sait SERVIR les pièces de rempart : on lui octroie la Projectiles du Groupe de CHAQUE pièce
    // (Baliste→Arbalète, Canon→Poudre noire). Sans cette Spé, il ne COMPTE PAS dans l'effectif d'équipe (AA
    // p.122 l.3900) → la pièce qu'il prend tirerait en sous-effectif. Dérivé des pièces (aucun libellé en dur).
    const gunner0 = party[0];
    for (const tid of ['baliste', 'canon-petit'])
      for (const ref of projForPiece(tid))
        if (!gunner0.skills.some((s) => s.skillId === ref.id && s.spec === ref.spec))
          gunner0.skills.push({ skillId: ref.id, spec: ref.spec, characteristic: 'CT', advances: 20 });
    return party;
  },
  scene,
  autoCombat: 'assaut',
};
