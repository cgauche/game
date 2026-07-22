---
name: feedback-svg-art-fable-pas-opus
description: "Instruction user (2026-07-21) : l'agent artiste passe sur OPUS (plus Fable). Supersède l'observation 2026-07-11 « Fable meilleur que Opus pour le SVG »."
metadata: 
  node_type: memory
  type: feedback
  originSessionId: dcfa9f52-337e-40a6-9036-fb84db19e703
---

**Instruction user (2026-07-21, verbatim)** : « Tu peux modifier l'agent artiste pour ne plus utiliser Fable 5 mais Opus ? » → fait : `.claude/agents/artiste.md` frontmatter `model: opus` (effort medium inchangé).

**Why :** SUPERSÈDE l'observation du 2026-07-11 (« J'ai remarqué que Fable était meilleur pour faire du svg que Opus d'ailleurs »). L'utilisateur a tranché en sens inverse : l'art du rig SVG se dispatche désormais sur OPUS. Ne pas ré-appliquer l'ancienne préférence Fable.

**How to apply :** tout dispatch d'art SVG (rigs, props, navires, véhicules, vues multiples) → agent `artiste` (modèle Opus, épinglé au frontmatter). Ne PAS passer `model: 'fable'` sur ces gestes.

**Précision user (2026-07-21, verbatim) : « n'utilise plus Fable 5 si on n'a plus de décision architecturale à faire ».** → Fable UNIQUEMENT quand il reste une vraie DÉCISION d'architecture à concevoir (ex. le contrat de vues, l'invariant de silhouette, le canon du squelette — tranchés). Dès que l'architecture est décidée, l'IMPLÉMENTATION (art/géométrie qui exécute le contrat : bras/avant-bras, mains, casque, torse d'ogre, polish…) passe sur **Opus** (codeur/artiste). Ne pas rappeler Fable pour de l'exécution. Rappels liés : [[game-qc-reconnaissabilite]] (juges AVEUGLES pour le QC), [[feedback-rigs-vs-illustrations]] (rigs calés sur les illustrations officielles), [[game-rig-3vues-contrat-prod-chantier]] (la vague d'art dos/profil de la refonte prod passe par cet agent).
