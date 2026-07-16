---
name: game-interlude-ux-refonte-a-faire
description: "À FAIRE (session dédiée) : repenser l'UX/UI du système d'Activités d'interlude — l'utilisateur n'a jamais aimé l'interface actuelle"
metadata: 
  node_type: memory
  type: project
  originSessionId: 28544fb4-90ec-429e-93de-192a35c734a7
---

**Session dédiée à ouvrir** (décidé 2026-07-05) : repenser l'**UX/UI** du système d'Activités « entre deux aventures » (l'écran interlude). Le **backend est fini et data-driven** (cf. [[game-activites-unification-chantier]]) — c'est UNIQUEMENT la couche d'interaction à revoir. L'utilisateur : « je n'ai jamais aimé cette interface, elle est peut-être mal pensée. »

État actuel (committé b1c12918) : interlude = 3 phases (Événements → Activités → Clôture), un **volet par héros** où chacun pioche ses activités (Revenus/Artisanat/Apprentissage/Banque/Convalescence/activités de lieu/**prépa de bataille**), budget max-3 par héros.

**Directions données par l'utilisateur pour la refonte** :
- La **migration de la prépa de bataille DANS l'interlude était juste** — la garder (faite, b1c12918 : plus d'écran « conseil de guerre » séparé).
- Le **flag `assisted` (« peut être aidé ou non »)** est IMPORTANT — le garder en donnée.
- Idée : **séparer les activités de GROUPE dans une liste à part** dans les activités (vs les activités solo).
- Implication : les activités de groupe imposent une **validation PHASE PAR PHASE** (une activité de groupe = choisir qui aide → ça se valide en étapes, pas en un clic).

**Point RAW à trancher dans cette refonte** (laissé ouvert, cf. [[feedback-source-user-claims]]) : **assister une Activité coûte-t-il une Activité à l'assistant ?**
- `ADE II ch.8 l.81` (Planification) : « un Personnage […] **peut** aider au Test » — optionnel, muet sur le coût.
- L'ancien POC : « les DEUX consommés » (meneur + assistant dépensent chacun 1 créneau).
- Logique du budget (Activité = bloc de temps, max 3) : aider prend du temps → coûte plausiblement un créneau. L'utilisateur penche pour « ça coûte ». (J'avais asserté à tort « gratuit ».)
- Soutien multi-PJ des **Scènes en cours de bataille** (l.116-118, hors budget) reste distinct — c'est la prépa (budgetée) qui pose la question.

Ne PAS re-faire un patch d'assistance dans l'ancienne UI : passer par [[superpowers:brainstorming]] pour concevoir la nouvelle UX d'abord.
