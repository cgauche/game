---
name: game-footprint-taille-decouplage
description: "Empreinte de grille ⊥ Taille créature ; un navire a un footprint, pas une SizeCategory (sinon Peur de Taille parasite)"
metadata: 
  node_type: memory
  type: project
  originSessionId: fc8fbd88-39a7-45b7-a964-32b9d4050814
---

**Empreinte de grille (footprint N×N) et Taille créature (`SizeCategory`) sont DEUX concepts à NE PAS conflater.**
La `SizeCategory` (LDB 85) pilote 3 choses : échelle visuelle (`sizeTokenScale`), empreinte de grille
(`sizeFootprint`), ET les RÈGLES de Taille créature (Peur de Taille, Piétinement, ×Dégâts).

**Why:** donner une `SizeCategory` à un OBJET (un navire) pour le rendre gros le fait participer aux règles
créature → un navire « énorme » inspirait la **Peur de Taille** (Test de Sang-froid intempestif). Le GM l'a
repéré (« il est effrayant le bateau ») et a refusé le garde `bodyShape==='vehicule'` (band-aid par-effet).

**How to apply:** un objet qui occupe des cases sans être une créature porte `Combatant.footprint?` (côté N×N),
PAS `size`. Accesseur UNIQUE `footprintN(c) = c.footprint ?? sizeFootprint(c.size)` (`state/footprint.ts`). Les
primitives `footprintTiles`/`occupiesTile`/`footprintChebyshev`/`footprintsOverlap` prennent le **côté N (nombre)** ;
le mapping size|footprint→N se fait au BORD. Rendu : `footprintTokenScale(n)` (miroir de `sizeTokenScale`,
`gameIso/sizeScale.ts`). Navires : `ship.footprint` autoré dans `vehicles.json` (posé sur `c.footprint` par
`vehicleCombatant`), AUCUN `size` → aucune règle de Taille créature, sans garde par-effet. Commit `7c0b23b4`.
Armes de siège = items/postes (`enc`), pas d'entité → ni footprint ni size (un canon-décor du Pont prendrait un
footprint, jamais un size). Voir [[game-naval-tactical-chantier]], [[game-toise-echelles]].
