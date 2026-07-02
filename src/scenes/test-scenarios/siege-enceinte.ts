import { pregenParty, PREGEN } from '../../data/pregens';
import { findTrappingById, weaponGroupLabel, type SkillRef } from '../../data';
import type { SceneEntity } from '../../state/scene';
import { buildScene, type MapSpec } from '../../state/mapSpec';
import type { TestScenario } from './_shared';

/**
 * SIÈGE COMPLET — défendre l'enceinte, entièrement DÉCLARÉ en UN `MapSpec` (plus aucune plomberie bespoke :
 * `buildScene` rejoue les primitives de l'éditeur). Carte PROFONDE (30×46, 2 couches) à l'échelle d'un vrai siège :
 *  - au NORD, le CAMP assaillant (tentes, braséros, bannières) et sa BATTERIE braquée sur la PORTE : une
 *    CATAPULTE pilonne de TRÈS LOIN en tir indirect (~71 m), un CANON de siège AVANCÉ tire en direct (~46 m) —
 *    l'IA cible la structure (Atout Siège), le canon BRÈCHE la porte tout seul ;
 *  - des FANTASSINS qui traversent le glacis, FRANCHISSENT la RIVIÈRE par le PONT (seul passage) et s'amassent
 *    à la porte tant qu'elle tient ;
 *  - le MUR D'ENCEINTE = des `WallSpec` (courtine `mur-en-pierre` + une `porte-de-ville` brèchable), SANS aucune
 *    hauteur de mur : la 3ᵉ dimension du rempart est sa COUCHE z1 ;
 *  - le CHEMIN DE RONDE = couche 1 'pierre' à 4 m (épais de 2 cases, y37 côté champ + y38 côté cour) garni de
 *    PIÈCES servies (baliste/canon) et d'ARCHERS PNJ alliés-IA, surmonté d'un PARAPET (`WallSpec` z1 sur l'arête
 *    EXTÉRIEURE) ; on le rejoint par UNE RAMPE au FLANC GAUCHE (cols 3-4, montant ≤1 m/case sur 5 cases — le moteur
 *    en fait une pente, plus aucun escalier), DÉPORTÉE de la porte pour dégager la cour DERRIÈRE la porte (zone de mort) ;
 *  - au SUD, une COUR pavée MODESTE où démarre le groupe.
 * Combat VERTICAL : les défenseurs (couche 1, 4 m) pilonnent en contrebas et la mêlée est refusée à travers le
 * vide (`combatDistance` ajoute la séparation métrique) ; le parapet ne coupe PAS la LdV plongeante (cross-niveau).
 *
 * TOUT est dans le `MapSpec` ci-dessous (grilles ASCII des 2 étages, relief, murs, binds de marqueurs, entités à
 * ids FIXES, rencontre). Les seules parts de code restantes = le `projForPiece` (Projectiles dérivée de la pièce)
 * et le `makeParty` (le SOLDAT reçoit les Spé de service). AUCUN push/setEncounters résiduel.
 */

// Compétence Projectiles APPROPRIÉE au Groupe de l'engin (AA p.122 l.3900) : un servant ne compte dans l'équipe
// QUE s'il la possède (sinon « n'est pas considéré comme un membre de l'équipe », l.3923). Dérivée de la pièce
// (`weaponGroup` du trapping) → la Spé = libellé du Groupe (Arbalète/Poudre noire/Catapulte). Test ~40.
const projForPiece = (trappingId: string): SkillRef[] => {
  const g = findTrappingById(trappingId)?.weaponGroup;
  return g ? [{ id: 'projectiles', spec: weaponGroupLabel(g), value: 40 }] : [];
};

// Servant de pièce (entité à id FIXE, référencé par le `crew` de l'emplacement) : une VRAIE créature du
// bestiaire (a une CT pour viser), SANS arme propre → sa seule arme à distance est la PIÈCE servie (l'IA tire
// donc la baliste/le canon, pas un arc). Posté à CÔTÉ de l'affût (x-1). On lui DONNE la Projectiles du Groupe de
// SA pièce → il compte comme membre d'équipe qualifié (sinon effectif 0). `ref` garde-du-village (défenseur) /
// brigand (assaillant).
const gunner = (
  id: string,
  pos: { x: number; y: number },
  trappingId: string,
  label: string,
  opts: { z?: number; facing?: SceneEntity['facing']; ref?: string } = {},
): SceneEntity => ({
  id,
  kind: 'personnage',
  pos,
  label,
  ref: opts.ref ?? 'garde-du-village',
  ...(opts.z ? { z: opts.z } : {}),
  ...(opts.facing ? { facing: opts.facing } : {}),
  combat: { skills: projForPiece(trappingId) },
});

const prop = (id: string, ref: string, x: number, y: number): SceneEntity => ({ id, kind: 'prop', ref, pos: { x, y } });

export const spec: MapSpec = {
  id: 'siege-enceinte',
  nom: 'Siège — défendre la muraille',
  description:
    "Un siège à grande échelle : au nord, le camp assaillant et sa batterie (canon + catapulte) qui pilonne la " +
    "porte de très loin ; des fantassins franchissent la rivière par le pont et s'amassent à la porte ; au sud, " +
    "l'enceinte à porte brèchable, son chemin de ronde (couche surélevée à 4 m) garni de pièces et d'archers, " +
    "rejoint par une rampe au flanc gauche, et une cour pavée.",
  size: [30, 46],
  metresPerTile: 2, // person-scale (LDB) : 1 case = 2 m → bandes de portée (canon 50 m / catapulte 75 m)
  ambiance: 'exterieur',
  ambientLight: 'jour', // plein jour : on voit l'assaut approcher sur tout le glacis
  startMessage:
    "Défendez l'enceinte. Gagnez le CHEMIN DE RONDE par la RAMPE du flanc gauche, SERVEZ une pièce et pilonnez " +
    "l'assaut en contrebas. La batterie ennemie brèche la porte de très loin — quand elle cède, qui se tient " +
    "sur la passerelle au-dessus chute. Les assaillants ne peuvent forcer le passage qu'une fois la porte abattue.",

  // ── Légende partagée (base z0='herbe', z1='vide'). Tout est POSÉ PAR L'ASCII (zéro coordonnée) : 'W'=chemin
  //    de ronde, '4/3/2/1'=paliers de rampe, 'M'=courtine, 'D'=porte — cf. `elevate`/`edgeWalls` ci-dessous. ─────
  legend: { '~': 'eau', '=': 'planches', P: 'pave', W: 'pierre', M: 'pave', D: 'pave', '1': 'pave', '2': 'pave', '3': 'pave', '4': 'pave' },
  // Terrain laissé sous un marqueur nettoyé : '@' garde la cour pavée ; A/G/B/K gardent la passerelle 'W'
  // (sinon le chemin de ronde aurait un TROU sous chaque pièce/archer). k/p/o (champ) → '.' par défaut (herbe).
  markerFill: { '@': 'P', A: 'W', G: 'W', B: 'W', K: 'W' },
  // HAUTEURS pilotées par l'ASCII : 'W' (chemin de ronde z1) = ZONE REMPART solide à 4 m, crénelée `mur-en-pierre`
  // (le rendu en tire face de maçonnerie + crénelure de PÉRIMÈTRE) ; '4/3/2/1' = paliers de la RAMPE (pente à ≤1 m/case).
  elevate: { W: { height: 4, parapet: 'mur-en-pierre' }, '4': 4, '3': 3, '2': 2, '1': 1 },
  // ENCEINTE posée par l'ASCII (arête N de la case marquée) : 'M' = courtine `mur-en-pierre`, 'D' = porte brèchable.
  edgeWalls: { M: { side: 'N', structure: 'mur-en-pierre' }, D: { side: 'N', structure: 'porte-de-ville' } },

  // ── Grilles ASCII des 2 étages (RECOPIÉES telles quelles, marqueurs inclus). La RAMPE n'est PAS un marqueur :
  //    ce sont des cases de cour dont la HAUTEUR monte (posée en `relief`). Marqueurs z0 : '@'=départ · 'k'=canon
  //    de siège ennemi · 'p'=catapulte ennemie · 'o'=fantassin ennemi. Marqueurs z1 : 'B'=baliste · 'K'=canon ·
  //    'A'=archer défenseur · 'G'=guetteur (au-dessus de la porte → chute quand la porte cède). ────────────────
  levels: {
    z0: [
      '..............................',
      '..............................',
      '........p.....................',
      '..............................',
      '..............................',
      '...............o..............',
      '....o....................o....',
      '..........o........o..........',
      '..............................',
      '..............................',
      '..............................',
      '..............................',
      '..............................',
      '..............................',
      '..............................',
      '.....................k........',
      '..............................',
      '..............................',
      '..............................',
      '..............................',
      '~~~~~~~~~~~~~====~~~~~~~~~~~~~',
      '~~~~~~~~~~~~~====~~~~~~~~~~~~~',
      '..............................',
      '..............................',
      '..............................',
      '..............................',
      '..............................',
      '..............................',
      '..............................',
      '..............................',
      '..............................',
      '..............................',
      '..............o...............',
      '..............................',
      '..............................',
      '..............................',
      '..............................',
      '..............................',
      'MMMMMMMMMMMMMMDDMMMMMMMMMMMMMM',
      'PPPPPPPPPPPPPPPPPPPPPPPPPPPPPP',
      'PPP44PPPPPPPPPPPPPPPPPPPPPPPPP',
      'PPP33PPPPPPPPPPPPPPPPPPPPPPPPP',
      'PPP22PPPPPPPPPPPPPPPPPPPPPPPPP',
      'PPP11PPPPPPPPPPPPPPPPPPPPPPPPP',
      'PPPPPPPPPPPPPP@PPPPPPPPPPPPPPP',
      'PPPPPPPPPPPPPPPPPPPPPPPPPPPPPP',
    ].join('\n'),
    z1: [
      '..............................',
      '..............................',
      '..............................',
      '..............................',
      '..............................',
      '..............................',
      '..............................',
      '..............................',
      '..............................',
      '..............................',
      '..............................',
      '..............................',
      '..............................',
      '..............................',
      '..............................',
      '..............................',
      '..............................',
      '..............................',
      '..............................',
      '..............................',
      '..............................',
      '..............................',
      '..............................',
      '..............................',
      '..............................',
      '..............................',
      '..............................',
      '..............................',
      '..............................',
      '..............................',
      '..............................',
      '..............................',
      '..............................',
      '..............................',
      '..............................',
      '..............................',
      '..............................',
      '..............................',
      'WWWWAWWWWWAWWWGWWWWAWWWWWAWWWW',
      'WWWWWWWWBWWWWWWWWWWWWKWWWWWWWW',
      '..............................',
      '..............................',
      '..............................',
      '..............................',
      '..............................',
      '..............................',
    ].join('\n'),
  },

  // ── TOUT est POSÉ PAR L'ASCII (zéro coordonnée) ────────────────────────────────────────────────────────────
  //  • CHEMIN DE RONDE : tuiles 'W' (z1, rows 38-39) marquées ZONE REMPART à 4 m (`elevate`) → face de maçonnerie
  //    pleine + crénelure de PÉRIMÈTRE (jamais à l'intérieur), INTÉRIEUR au mur. La courtine gameplay est ENSEVELIE.
  //  • RAMPE : paliers '4/3/2/1' (z0, cols 3-4, rows 40-43) → pente ≤1 m/case (`elevate`), sommet (y40, 4 m) jouxte
  //    le chemin (y39). • ENCEINTE : 'M'=courtine, 'D'=PORTE brèchable (z0, arête N de la row 38) via `edgeWalls`.
  //    La porte est une STRUCTURE brèchable (pas de `door`) : intacte elle bloque passage+vue ; abattue → BRÈCHE.

  // ── ENTITÉS à ids FIXES (référencées par les `crew` des emplacements) + décor du CAMP ────────────────────────
  entities: [
    // Servants de pièce DE REMPART (z1, côté défenseur) — postés à x-1 de leur affût (B(8,39)→(7,39), K(21,39)→(20,39)).
    gunner('crew-baliste', { x: 7, y: 39 }, 'baliste', 'Servant de baliste', { z: 1 }),
    gunner('crew-canon', { x: 20, y: 39 }, 'canon-petit', 'Servant de canon', { z: 1 }),
    // Servants de la BATTERIE assaillante (z0, côté assaut, facing S) — à x-1 de leur affût (k(21,15)→(20,15), p(8,2)→(7,2)).
    gunner('brg-canon', { x: 20, y: 15 }, 'canon-petit', 'Canonnier de siège', { facing: 'S', ref: 'brigand' }),
    gunner('brg-cata', { x: 7, y: 2 }, 'catapulte-petite', 'Servant de catapulte', { facing: 'S', ref: 'brigand' }),
    // CAMP assaillant (décor, nord).
    prop('camp-tente-0', 'tente', 3, 0), prop('camp-tente-1', 'tente', 14, 0), prop('camp-tente-2', 'tente', 26, 0),
    prop('camp-brasero-0', 'brasero', 8, 0), prop('camp-brasero-1', 'brasero', 21, 0),
    prop('camp-etendard-0', 'etendard', 12, 1), prop('camp-etendard-1', 'etendard', 17, 1),
  ],

  // ── BINDS des marqueurs → poses. Archers/guetteur = PNJ alliés-IA (arcs). Emplacements = affûts INERTES servis
  //    par leur équipage (crew ci-dessus), enrôlés SANS `ai` (aucun tour propre). Gobelins = fantassins ennemis. ─
  bind: {
    '@': 'heroStart',
    // Archers défenseurs (z1, arcs) : PNJ alliés-IA (agissent seuls).
    A: {
      entity: { kind: 'personnage', ref: 'garde-du-village', weapon: 'Arc', facing: 'N', z: 1, label: 'Archer du guet' },
      member: { enc: 'assaut', side: 'ally', ai: true },
    },
    // Guetteur au-dessus de la porte (chute à la brèche).
    G: {
      entity: { kind: 'personnage', ref: 'garde-du-village', weapon: 'Arc', facing: 'N', z: 1, label: 'Guetteur du corps de garde' },
      member: { enc: 'assaut', side: 'ally', ai: true },
    },
    // Pièces de REMPART : affûts INERTES (pas d'`ai`), servis par leur équipage QUALIFIÉ (crew), sur le chemin de ronde (z1).
    B: { emplacement: 'baliste', crew: 'crew-baliste', facing: 'N', member: { enc: 'assaut', side: 'ally' } },
    K: { emplacement: 'canon-petit', crew: 'crew-canon', facing: 'N', member: { enc: 'assaut', side: 'ally' } },
    // BATTERIE assaillante (z0) : affûts INERTES servis par les brigands-équipage, camp ennemi.
    k: { emplacement: 'canon-petit', crew: 'brg-canon', facing: 'S', member: { enc: 'assaut', side: 'enemy' } },
    p: { emplacement: 'catapulte-petite', crew: 'brg-cata', facing: 'S', member: { enc: 'assaut', side: 'enemy' } },
    // Fantassins gobelins (z0) : assaut ennemi qui traverse le pont et s'amasse à la porte.
    o: { entity: { kind: 'personnage', ref: 'gobelin', facing: 'S' }, member: { enc: 'assaut', side: 'enemy' } },
  },

  // ── RENCONTRE : le roster des servants (alliés-IA au rempart ; brigands ennemis à la batterie) — le RESTE
  //    (emplacements inertes, archers, guetteur, gobelins) arrive par bind→member ci-dessus. ────────────────────
  encounters: [
    {
      id: 'assaut',
      members: [
        { entityId: 'crew-baliste', side: 'ally', ai: true },
        { entityId: 'crew-canon', side: 'ally', ai: true },
        { entityId: 'brg-canon', side: 'enemy' },
        { entityId: 'brg-cata', side: 'enemy' },
      ],
    },
  ],
};

const scene = buildScene(spec);

export const scenario: TestScenario = {
  id: 'siege-enceinte',
  order: 41,
  category: 'combat',
  icon: 'scenario/siege',
  title: 'Siège — défendre la muraille',
  tests:
    'Siège à grande échelle (30×46, 2 couches) : champ d\'approche profond (~76 m) + camp & BATTERIE assaillante ' +
    '(canon direct + catapulte indirecte) qui BRÈCHE la porte de loin (IA cible la structure, Atout Siège) ; rivière ' +
    '+ pont qui canalise l\'assaut ; enceinte à porte brèchable (WallSpec sans hauteur) ; chemin de ronde = couche 1 ' +
    'à 4 m, rejoint par UNE RAMPE au FLANC GAUCHE (déportée de la porte), parapet z1 sur l\'arête extérieure ; ' +
    'pièces servies + ARCHERS PNJ alliés-IA ; combat VERTICAL (LdV plongeante, mêlée refusée à travers le vide).',
  partyNote: 'Groupe pré-tiré (Soldat / Chasseur / Sorcier / Tueur) : montez au rempart par la rampe du flanc gauche ; le SOLDAT sait servir les pièces (Baliste/Canon).',
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
