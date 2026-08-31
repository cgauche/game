---
name: user-ressource-licence-chatgpt
description: "2026-08-31 : l'utilisateur dispose d'une licence ChatGPT « au besoin » — relève de quota (Codex CLI, miroir .codex/ déjà maintenu par agents:sync) et contre-juge d'une autre famille de modèles"
metadata: 
  node_type: memory
  type: user
  originSessionId: 7fa03aff-afd5-481d-b04f-f8c0892b5ff1
  modified: 2026-08-31T17:09:17.581Z
---

2026-08-31, verbatim : « D'ailleurs j'ai une licence chatGPT au besoin ».

CONTRAINTE (2026-08-31, verbatim) : « Je n'ai pas autant de ressource pour faire une review ou reprendre le travail » — tout usage qui exige du TRAVAIL utilisateur (coller des briefs, superviser une review, reprendre un lot) est EXCLU. Ne jamais proposer la licence comme canal de contre-jugement ou de reprise.

Usage VALIDÉ (2026-08-31, verbatim : « Mais il peut faire des images au besoin ») : GÉNÉRATION D'IMAGES à la demande — un prompt utilisateur, zéro suivi. Cas d'usage projet : référence d'art MANQUANTE (créature/tenue sans illustration officielle dans Source/) → image générée déposée dans `art-ref/` (gitignoré) → lue par les agents artistes avant de tracer le rig SVG (même flux que l'art officiel du bestiaire). Je formule le prompt d'image, l'utilisateur le colle. Respecter [[user-direction-art-epure-echelle-jeu]] et [[user-barre-art-relevee-2026-07-16]] dans les prompts.

Autre usage résiduel envisageable : relève de quota en UNE commande sans suivi (session Codex CLI lancée comme game-d6, autonome sur des lots sans goût — parité d'outillage déjà maintenue par `npm run agents:sync` → `.codex/hooks.json`, `.agents/` ; règles CLAUDE.md visent « TOUT agent dépêché sur ce repo »). À ne suggérer qu'à un épuisement de quota effectif, jamais comme charge pour l'utilisateur.

Voir [[env-charge-machine-un-seul-agent-lourd]].
