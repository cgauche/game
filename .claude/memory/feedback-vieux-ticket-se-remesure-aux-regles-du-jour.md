---
name: feedback-vieux-ticket-se-remesure-aux-regles-du-jour
description: "2026-09-03 — « Le ticket est très vieux, donc prends bien en compte nos règles d'aujourd'hui et potentiellement ce qui est cité a pu énormément changer » (à propos de #918, 2026-07-27) : un ticket ancien se REPREND par une re-mesure sur l'arbre courant et une confrontation aux doctrines du jour (bloc « Doctrines utilisateur » de CLAUDE.md), jamais par ses citations (fichiers, lignes, mécanismes, stocks peuvent avoir disparu ou changé de sens) — juge de grounding AVANT tout brief"
metadata:
  type: feedback
---

**Verbatim utilisateur (2026-09-03)** : « Le ticket est tres vieux, donc prends bien en compte nos régles d'aujourd'hui et potentiellement ce qui est cité a pu énormement changer » — en ajoutant #918 (2026-07-27, jets inline : garde qui blanchit 28 fichiers, coup dans le dos inline) au périmètre de la session, avec #1437 (2026-08-20).

**Why :** entre juillet et septembre le socle des jets a été refondu plusieurs fois (#939 dés fixés, #918-B formes, #1015/#1017 possession, #1066, #1262 porte typée/`worldOwner`, #1283 zéro jet silencieux par construction, #1426 dés de monde, #1479/#1508 forme canonique unique, B3 de #1657 : garde `flowTestEngineRoll`, registre `AUTO_RESOLUS` supprimé) : les lignes, les listes blanches et même les mécanismes cités par un vieux ticket ne décrivent plus l'arbre. Un brief écrit depuis le ticket recopierait un état mort ([[feedback-brief-fait-autorite-grounding-seconde-main]], [[feedback-reprise-chantier-recuperer-les-analyses-pas-que-le-wip]]).

**How to apply :**
1. Un ticket de plus de ~2 semaines se rouvre par un JUGE DE GROUNDING (lecture seule) : re-mesurer chaque constat sur l'arbre courant (le fichier/la ligne/le stock existe-t-il encore, la mécanique a-t-elle changé de porte), lister ce qui est déjà soldé par des trains postérieurs, et confronter ce qui reste aux doctrines du jour (bloc « Doctrines utilisateur », fiches `user-*`) — le brief du codeur part de cette re-mesure, jamais du texte du ticket.
2. Le ticket reçoit un commentaire « RE-MESURE <date> » qui dit ce qui est mort, ce qui reste, et sous quelle règle d'aujourd'hui ; les items déjà soldés sont pointés vers leurs commits.
3. Vaut pour #918 et #1437 (reprise après B3-3), et pour tout ticket de la file #1463 antérieur à la refonte des jets.
