---
name: game-iso-depth-perface-hard
description: "Occlusion rempart siège : « l'escalier caché par le mur » = le BROUILLARD (split vis/!vis de CulledScene écrasait la profondeur), PAS le tri ni l'émission. Fix = voile PAR case entrelacé (fogVeilObjs). Diag = data-el+elementsFromPoint (remplissage réel, pas bbox). + capsSolid/cappedAbove (émission vue du sol) + garde bord-de-carte."
metadata:
  node_type: memory
  type: project
  originSessionId: 658a4d3a-3f5a-489f-92b0-3ae4352fd194
---

Bugs de rendu du rempart du siège (`siege-explore`) VUS DU SOL (groupe en z0). L'user : « les soucis de vision c'est quand tu regardes l'escalier/mur DEPUIS le z0 ».

**Fausse piste écartée** : ce n'était PAS le tri en profondeur. Un **diagnostic COULEUR** (aplats catégorisés triés par `floorDepth`/`wallDepth`, iso+edge×4 rot, `npm run qc:occlusion`) a PROUVÉ que le tri per-tuile est correct. Le prototype per-face naïf ne fait que régresser (casse l'ordre intra-tuile). → ne jamais refondre le tri.

**Vrai bug = l'ÉMISSION des couches quand `activeZ < z`** (le QC utilisait `activeZ=maxZ` → masquait tout). Corrigé dans `builders/floors.ts`, GÉNÉRAL (ne se déclenche que sur un terrain à bloc plein `solidHeightM>0`, jamais de code « rempart ») :
1. **Toit de bloc culé** (commit `c50df845`) : le chemin de ronde z1 posé sur la masse `mur` n'est pas un surplomb (bloc plein non-marchable dessous) → il était culé comme un fantôme, laissant le DESSUS BRUT du bloc à nu. `capsSolid(scene,x,y,z)` : un sol coiffant un bloc plein (hauteur d'affichage coïncidente) est la surface d'une structure solide → jamais fantôme (opaque), perçu comme le bloc.
2. **Pilotis dans le tunnel de porte + double dalle** (commit `70499d3c`) : (a) le chemin de ronde au-dessus de la PORTE est un surplomb (tunnel passable) → `floorFaces` y plantait des PILIERS verticaux absents du POV. `capsSolid` reconnaît le **TOIT DE GATEHOUSE** (tunnel bordé d'un bloc plein montant à sa hauteur) ; `floorFaces(...,caps)` saute les pilotis sous un tel toit (garde la dalle fine `deck` → BOUCHE dégagée, ne PAS emmurer). (b) le DESSUS du bloc `mur` était dessiné EN PLUS du chemin de ronde → sous le voile, l'un perçu/l'autre voilé = dalles « 2 types » (pierre vs dessus brut brun). `cappedAbove` : un bloc coiffé ne dessine plus son dessus redondant.

**Garde-fou** : `qc:occlusion` gagne une rangée **« vu du sol (z0) »** (scènes multi-couches) — c'est CE qui manquait pour attraper la classe (le bug ne vit qu'à `activeZ < z`). Tests dans `floors.test.ts` (capsSolid direct/gatehouse, dessus supprimé, pas de pilotis, surplomb réel reste fantôme).

**VRAIE cause de « l'escalier est caché par le mur » (résolue 2026-07-03, commit `eca7dbc5`)** : PAS le tri
en profondeur, PAS l'émission des couches — c'était le **BROUILLARD**. `CulledScene` sciait la scène en
DEUX paquets par **ligne de vue** : `!vis` (hors-vue) rendu SOUS le voile, `vis` (en vue) rendu AU-DESSUS —
ce qui **écrasait le tri en profondeur**. Une rampe HORS-vue (paquet du bas) se faisait recouvrir par un mur
EN vue (paquet du haut) **quelle que soit la profondeur** → « l'habillage en pierre du mur passe au-dessus
de l'escalier », **dépendant du brouillard** (d'où l'insistance de l'user sur « tu ne gères pas la ligne de
vue »). Un voile UNIQUE est incompatible avec la profondeur dès que visible/caché s'entrelacent : le voile
DOIT vivre à la profondeur de CHAQUE case cachée. Fix : `fogVeilObjs` (FogLayer.tsx, exempt du garde-couleur)
émet un voile PAR case à `depth(x,y,z)+0.55`, fusionné dans le flux trié (`mergeByDepth`) ; fin du sandwich
vis/!vis. Bords FRANCS (le flou de groupe fusionnait tout à un seul z → incompatible). **Diag qui a tranché** :
`data-el={el.key}` temporaire sur les `<g>` sol/mur → `elementsFromPoint` nomme la tuile exacte au-dessus de
la rampe (piège : sonder le remplissage RÉEL de la tuile, pas sa bbox — sinon la falaise du mur dans la bbox
donne un faux positif « mur au-dessus du sol derrière »). Le diag COULEUR headless (faces nues) NE reproduit
JAMAIS ce bug (pas de CulledScene/brouillard) — il ne voyait que le tri des faces, correct.

Bonus même chantier (`b77a5991`) : `capsSolid` clause (b) « gatehouse » se déclenchait à tort sur un tablier
en **bord de carte** (`tileAt` hors-carte rend un « mur » implicite `solidHeightM 4`) → garde de bornes sur
le voisin. Cf. [[game-iso-depth-z-secondary]], [[game-rampart-solid-block-height-unified]], [[game-vision-fog-of-war]].
