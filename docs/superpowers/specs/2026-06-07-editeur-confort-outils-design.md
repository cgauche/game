# Éditeur de niveau — passe « confort & outils »

*Spec — 2026-06-07. Ajout d'ergonomie de manipulation directe, sélection/navigation,
validation, et confort terrain/carte à l'éditeur de scène (`src/ui/editor/`).*

## 1. Contexte

L'éditeur est déjà solide (cf. cartographie multi-agents) : WYSIWYG fidèle au jeu (rendu
partagé avec `IsoStage`), undo/redo (`useSceneHistory`, Ctrl+Z/Y), projet multi-scènes,
rotation/zoom/pan caméra, palettes auto-générées des catalogues, triggers/dialogues/rencontres
structurés, statblock + parts, sélecteur d'orientation 8-dir. Aucun TODO/FIXME traînant.

Les **manques sont des conforts d'auteur**, tous vérifiés (file:line) :

- **Repositionner une entité** = taper X/Y dans l'inspecteur — et entités/props **n'ont même pas**
  ces champs → il faut **gommer + replacer** (`Editor.tsx:264-270`, inspecteur `:1035-1228`).
- **Aucun copier/coller/dupliquer** : refaire un PNJ stylé (apparence + mutations + arme + dialogue)
  champ par champ.
- **Aucune validation** : réfs cassées (dialogue/rencontre/scène), trigger hors-carte, ids
  dupliqués (`${kind}-${Date.now().toString(36)}` → collision même-ms, `:271`) ne se voient qu'au runtime.
- **Sélection limitée** : une entité n'est sélectionnable qu'en **cliquant sa case exacte**
  (impossible si cachée sous un bâtiment) ; pas de Suppr/flèches ; `<select>` créatures (57+) sans recherche.
- **Calques** non masquables : triggers/spawns `stopPropagation` (`:751-752,:779-780`) bloquent le
  clic/peinture en dessous.
- **Terrain** : 1 tuile/clic ; un trait inonde l'undo (1 tuile = 1 cran, `:683`). **Resize destructif**
  silencieux (`:418-423`).

## 2. Objectifs / non-objectifs

**Objectifs** — passe de confort, sans changer le schéma de Scène ni le rendu :
- Manipulation directe (glisser-déplacer, copier/coller/dupliquer).
- Sélection & navigation (liste d'entités, clavier Suppr/flèches, recherche palette, calques masquables).
- Validation pré-runtime (réfs cassées, hors-carte, ids dupliqués).
- Confort terrain/carte (pinceau, remplissage rect, resize non-destructif, recentrer).
- Garder `Editor.tsx` navigable : extraire les nouveaux panneaux/validateur en modules dédiés.

**Non-objectifs** : pas d'édition inline de la *logique* (effets/dialogues restent en modal) ;
pas de placement sub-tuile (tout reste quantifié case) ; pas de refonte du rendu.

## 3. Architecture

Nouveaux modules (gardent `Editor.tsx` du gonflement) :
- `src/state/entityId.ts` — `nextEntityId(kind, taken)` **pur** (id unique garanti).
- `src/state/validateScene.ts` — `validateScene(project) → Warning[]` **pur**.
- `src/ui/editor/EntityListPanel.tsx` — liste sélectionnable des entités.
- `src/ui/editor/ValidationPanel.tsx` — liste des avertissements, clic → sélectionne le fautif.

Modifiés : `Editor.tsx` (outils, pointer handlers, clavier, inspecteur, calques, recherche,
pinceau, resize, recentrer) ; le hook `useSceneHistory` (inline `Editor.tsx:54-84`) gagne la
coalescence d'undo.

## 4. Phases

### P0 — Fondation (invisible)

**`nextEntityId(kind: string, taken: Iterable<string>): string`** (`src/state/entityId.ts`, pur,
testé) : compteur monotone base36, incrémenté jusqu'à un id absent de `taken` → **unicité garantie**
même placement multiple/ms, duplication, import. Remplace `${kind}-${Date.now().toString(36)}`
(`Editor.tsx:271`) ; appelé avec `scene.entities.map(e=>e.id)`.

**Coalescence d'undo** : `useSceneHistory` expose `pushSnapshot()` (push manuel de l'état courant)
+ `setSceneNoHistory(next)` (mutation sans snapshot). Un **geste** (trait de peinture, glisser) :
`pushSnapshot()` au pointer-down, puis `setSceneNoHistory(...)` par move → **1 seul cran d'undo**.
Les actions discrètes (placer, supprimer, éditer un champ) gardent `setScene` (qui snapshote).

### P1 — Glisser-déplacer

Nouvel **outil « Sélection/Déplacer »** (flèche, `mode:'select'`, **outil par défaut**) :
- pointer-down sur une case occupée → sélectionne l'entité/prop/spawn + démarre un **drag** ;
- move → met à jour `pos` vers la case sous le curseur (snap via `screenToTile`) ;
- up → commit (1 undo via P0). Curseur `move` pendant le drag.
- **Bâtiments / triggers** (rects) : glisser déplace tout le `foot`/rect (clamp dans la carte).
- Drag sur une case vide (outil select) = rien ; les autres outils (paint/place) gardent leur comportement.

Bonus cohérence : ajouter des champs **X/Y** à l'inspecteur des entités/props (qui n'en ont pas).

### P2 — Copier / coller / dupliquer

État presse-papier (mémoire) : `clipboard: { kind: 'entity'|'building'|'trigger'|'spawn'; data } | null`,
deep-clone (`structuredClone`). Raccourcis (supprimés dans les inputs, comme l'undo) :
- **Ctrl+C** : copie la sélection courante.
- **Ctrl+V** : colle à la case survolée (sinon +1,+1), **id frais** (`nextEntityId`), auto-sélectionne.
- **Ctrl+D** : duplique la sélection à +1,+1 (copie+colle en un geste).
- Bouton **« Dupliquer »** dans l'inspecteur (chemin souris).

Portée : entités/props/spawns ; bâtiments/triggers inclus si le clone reste trivial (id frais + offset).

### P3 — Sélection & navigation

- **`EntityListPanel`** : liste de `scene.entities` (icône kind + label + pos), clic → sélectionne
  (même cachée/hors-écran) ; affichée dans l'inspecteur quand rien n'est sélectionné (à côté du motif
  « Bâtiments posés » existant `:1243-1252`).
- **Clavier** (hors inputs) : **Suppr/Backspace** = supprime la sélection (entité/bâtiment/trigger/spawn) ;
  **flèches** = nudge la sélection d'1 case (clamp carte).
- **Recherche palette** : champ texte type-to-filter au-dessus des `<select>` créatures
  (rencontre `:540-544`, spawn `:903-907`, apparence `:1088-1092`) — filtre les options affichées.
- **Calques masquables** : `layers: { triggers, spawns, buildings }` (cases à cocher) ; le rendu de
  chaque calque est gated → masquer supprime aussi leur `stopPropagation` (déblocage du clic en dessous).

### P4 — Validation

**`validateScene(project: Scene[]): Warning[]`** (`src/state/validateScene.ts`, pur, testé) avec
`Warning = { level:'error'|'warn'; sceneId: string; scope:'entity'|'building'|'trigger'|'dialogue'|'encounter'|'scene'; refId?: string; message: string }`.
Contrôles :
- **Réfs cassées** : `entity.dialogueId` → dialogue présent ; Effet `startDialogue`→dialogue,
  `startCombat`/encounter→rencontre, `transition.scene`→scène du projet, `building.interiorScene`→scène ;
  dialogue `start`/`choice.next`→nœud existant.
- **Hors-carte** : rect de trigger (ou pos d'entité) hors `dimensions`.
- **Ids dupliqués** : entités / bâtiments / triggers / rencontres / dialogues.

**`ValidationPanel`** : badge compteur (rouge si erreurs) + liste ; clic sur un warning → sélectionne
le fautif (entité/bâtiment/trigger) ou ouvre le modal concerné. Recalculé sur changement de scène (mémo).

### P5 — Confort terrain & carte

- **Pinceau taille 1/3/5** : `applyAt` peint un carré de rayon r autour de la case (clamp carte) ;
  contrôle dans la palette terrain. Trait = 1 undo (P0).
- **Remplissage rectangle** : sous-mode terrain « rect » → drag remplit le rect (réutilise le drag-rect).
- **Resize non-destructif** : avant de réduire `dimensions`, compter tuiles/entités/triggers/bâtiments
  hors nouvelles bornes ; si >0, **avertir + confirmer** (au lieu du drop silencieux `:418-423`).
- **Recentrer / fit-to-view** : bouton calculant zoom+pan pour cadrer toute la carte.

## 5. Tests

- **Unitaires (purs)** : `validateScene` (table : réfs OK / cassées par type, hors-carte, ids dupliqués) ;
  `nextEntityId` (unicité face à un set de pris, déterminisme).
- **Recette navigateur** (éditeur) : glisser une entité/bâtiment ; Ctrl+C/V/D ; Suppr + flèches ;
  liste d'entités → sélection d'une entité cachée ; recherche créature ; toggles de calques ; panneau de
  validation sur une scène volontairement cassée ; pinceau 3×3 + rect-fill ; resize réducteur (avertissement) ;
  recentrer. 0 erreur console.

## 6. Découpage (1 spec, exécuté en 2 vagues)

- **Vague A — manipulation directe** : P0 + P1 + P2. (Le plus gros confort.)
- **Vague B — navigation, sûreté, terrain** : P3 + P4 + P5.
Chaque vague : implémentée puis recette ; commits par pathspec (`Editor.tsx` partagé avec une autre session).

## 7. Risques

- **`Editor.tsx` est gros et partagé** (édité par une autre session : career/tenue, psy). Mitigation :
  extraire le neuf en modules dédiés (entityId/validateScene/panels), n'éditer `Editor.tsx` que par
  petits patchs ciblés, commits par pathspec, coordination si collision.
- **Outil « select » par défaut** : change le comportement du clic initial (avant, le 1er onglet
  ouvrait un outil de placement). Vérifier que placer reste fluide (basculer d'outil).
- **Drag vs paint** : bien distinguer le drag-de-sélection du drag-de-peinture/rect (par outil actif).
- **Coalescence d'undo** : ne pas casser l'undo des actions discrètes ; test de régression manuel.
