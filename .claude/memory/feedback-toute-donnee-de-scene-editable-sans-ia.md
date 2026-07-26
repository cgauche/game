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
- `Trigger.rect.z`, `SceneEffectZone.z`, `restZones[].rect.z`, `Roof.z` : champs LUS par le moteur,
  jamais ÉCRITS par l'éditeur (épique #835) ;
- `paintCrenellated` z-correct mais sans aucun outil qui l'appelle — affordance morte.

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
