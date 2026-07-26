---
name: feedback-toute-donnee-de-scene-editable-sans-ia
description: "Toute donnée de scène doit être éditable dans l'éditeur ; dépendre d'une IA pour modifier une carte est un défaut bloquant."
metadata: 
  node_type: memory
  type: feedback
  originSessionId: 28c99d31-0f31-42bf-b192-e530e82d7635
  modified: 2026-07-25T23:45:53.527Z
---

Arbitrage utilisateur, 2026-07-26, verbatim :

> « Assure toi toujours qu'on doit pouvoir éditer toutes les données de la scene, on ne doit pas
> dépendre d'une IA »

**Why:** l'utilisateur authore ses cartes lui-même, en série, depuis des planches de livre. Toute
donnée qu'il ne peut pas modifier au clic le rend dépendant d'un agent — donc bloqué dès que
l'assistance n'est pas là. C'est la règle stricte 2 du CLAUDE.md (« tout le contenu de campagne est
éditable dans l'éditeur, pas de scène codée en dur »), portée au rang de CRITÈRE D'ACCEPTATION de
tout lot d'éditeur.

Précédents mesurés le 2026-07-25/26 qui ont motivé l'arbitrage :
- masses de toiture authorées à la main → perdues en éditant la carte, impossible à recréer au clic ;
- zones DESCRIPTIVES (noms de pièces) authorées en grille ASCII séparée → non éditables, ne suivent
  pas le plan quand il change ;
- une primitive d'ajout qui pousse un élément FRAIS dans une collection z-portante sans paramètre `z` :
  l'élément atterrit au sol (0) et l'auteur ne peut pas choisir sa couche. **Check-list ÉNUMÉRABLE
  (épique #835, OUVERTE)** — les 4 surcouches concernées, mesurées au modèle `src/state/scene.ts` :
  `Trigger.rect.z` (`scene.ts:521`), `restZones[].rect.z` (`scene.ts:683`), `SceneEffectZone.z`
  (`scene.ts:643`), `SceneEntity.z` (`scene.ts:45`) ; côtés `scene` : `triggers`, `restZones`,
  `effectZones`, `entities` (`Z_BEARING_PROPS`). Le garde `scripts/guards/lib/sceneEditZWrite.mjs`
  échoue par AST sur toute fonction exportée de `state/sceneEdit.ts` qui pousse dans l'une d'elles
  sans déclarer de paramètre `z` ; `roofs` (FU-2) et `architecture` sont HORS de son périmètre ;
- un painter de `state/sceneEdit.ts` sans famille d'outil dans `src/ui/editor/Palette.tsx` ni appel
  depuis `src/ui/editor/EditorCanvas.tsx` — affordance morte.

**How to apply:**
- Tout lot touchant la Scène se clôt par la question : « l'auteur peut-il créer, modifier ET
  supprimer cette donnée au clic ? » Si non, le lot est incomplet.
- Un champ AJOUTÉ au schéma de Scène arrive avec son champ d'inspecteur ou son outil de palette,
  dans le MÊME lot. Un champ lu par le moteur et non écrit par l'éditeur est une dette immédiate.
- Une donnée DÉRIVÉE (toiture depuis les masses) ne se déclare pas à la main : elle se dérive du
  plan, et la surcharge explicite reste l'exception (cf. [[feedback-la-carte-decide-le-moteur-suit]]).
- Corollaire d'outillage : un aller-retour éditeur→fichier source doit être complet, sinon l'auteur
  ne peut pas rendre son travail.

Voisines : [[feedback-la-carte-decide-le-moteur-suit]] ·
[[feedback-fidelite-raw-et-editabilite-non-negociables]] · [[game-editeur-produit-final]] ·
[[feedback-affordance-morte-signaler]] · [[game-mapspec-unified-authoring]]
