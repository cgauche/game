---
name: user-passage-fable-derives-opus
description: "L'utilisateur est passé à Fable 5 par défaut (2026-07-05) à cause des dérives d'Opus sur les migrations livre→jeu — attente : discipline architecturale, réutiliser/étendre l'existant"
metadata: 
  node_type: memory
  type: user
  originSessionId: 30e59dde-e0b8-422d-b195-f1627f86363e
  modified: 2026-08-30T06:31:12.753Z
---

Le 2026-07-05, l'utilisateur a basculé son modèle par défaut sur **Fable 5**, explicitement « pour profiter de ton expertise ». Motif : Opus dérivait systématiquement sur les migrations de contenu livre→jeu — soit **réinventer un module à part** alors qu'une primitive existe, soit **dupliquer le modèle général** pour faire à sa manière — malgré CLAUDE.md, memories et en dépit des commentaires trompeurs/docs legacy. Coût : temps de refactor très important, et « même ainsi fait à moitié ».

**Why:** le changement de modèle est SA solution retenue (plutôt que d'installer le kit TheColliny/FableClaudeMDForOpus, évalué ensemble : verdict = voler l'idée du reuse-sweep P3 et du cœur maigre, ne pas installer). L'attente envers Fable est donc élevée et précise : zéro réinvention, zéro fork du modèle général.

**How to apply:** sur toute migration livre→jeu : (1) sweep de la table « Primitives partagées » + grep de l'existant AVANT tout nouveau module ; (2) nommer les primitives cibles avant d'écrire le code, étendre le général plutôt que dupliquer ; (3) commentaires citant le RAW = suspects, ouvrir le `Source/` cité ; (4) finir le travail — pas de refactor à moitié. (5) **Je ne code PAS moi-même, même le trivial** (rappelé le 2026-07-05 : « je ne m'attendais pas à te voir coder ») — agents Sonnet/adaptés pour toute édition de code, moi = orchestration, revue, vérification ; idem pour les efforts : toujours explicites par étage. Offre en suspens : hook PreToolUse sur Write (nouveau fichier sous `src/` → exiger la primitive vérifiée) + dégraissage du CLAUDE.md, pertinents si Opus reprend du travail de masse.

**Ajout 2026-08-30 (verbatim) : « Evite les sous agent faible 5 s'il te plait »** — pas de SOUS-AGENTS sur Fable 5 : tout dispatch d'agent générique (`claude`, `general-purpose`…) porte un `model` EXPLICITE (`opus` pour codeur/juge de repli, la fiche [[feedback-svg-art-fable-pas-opus]] reste l'exception artiste) ; les types du repo (`codeur`/`juge`…) gardent leur modèle défini. Fable = l'orchestrateur seul.

Prolonge [[credo-exemples-calibrants]].
