---
name: feedback-memoire-nest-pas-une-poubelle-tickets
description: "La mémoire ne porte que le DURABLE et le NON-DÉRIVABLE (qui est l'utilisateur, ses doctrines, les corrections de méthode, l'environnement) ; l'état d'un ticket, ce qui a été livré, les restes, les arbitrages scopés à un ticket vivent SUR LE TICKET (verbatim + date) et dans les commits — jamais en fiche « project-N livré »"
metadata:
  type: feedback
  originSessionId: 4407a64f-b0ad-4d3d-b30f-ffca252025d6
---

**Verbatim (2026-09-09)** : « La mémoire n'est pas une poubelle, les tickets servent a ca » — après une session qui avait écrit une fiche « project-1715 livré » (forme cible, restes, leçons) et une fiche « arbitrages du jour » alors que tout était déjà posté sur #1715, #1644, #1687, #1388 et dans les messages de commit.

**Why:** une fiche par ticket livré double le ticket, gonfle l'index chargé à chaque session et enterre les fiches qui comptent (doctrines, corrections de méthode). Le ticket est l'endroit indexé, daté, partagé avec l'utilisateur ; git porte les commits ; `.claude/soldes/` porte la preuve.

**How to apply :**
- Ne JAMAIS créer de fiche `project-<N>-…-livre` ni « arbitrages-<date> » scopée à des tickets : l'arbitrage utilisateur va en COMMENTAIRE du ticket (verbatim + date, doctrine CLAUDE.md § Pour TOUT agent) ; l'état, les restes, le fan-out vont au ticket et au solde.
- Une fiche mémoire ne naît que pour : une doctrine utilisateur GÉNÉRALE (`user-*`, verbatim), une correction de MÉTHODE (`feedback-*`, verbatim + why), un fait d'ENVIRONNEMENT non dérivable du dépôt (`env-*`), un pointeur externe (`reference-*`). Test avant d'écrire : « dans six mois, sans ce ticket ouvert, cette fiche change-t-elle ma façon de travailler ? » — sinon, ticket.
- Une leçon née d'un ticket se range dans la fiche `feedback-*`/`env-*` EXISTANTE qui la porte déjà (une ligne datée), jamais dans une fiche neuve nommée par le ticket.
- Les fiches `project-*` existantes de tickets FERMÉS se purgent (git porte l'historique) ; celles d'épiques OUVERTES se résorbent au fil des fermetures.

Liens : [[feedback-pilotage-epic-commentaire-github]], [[feedback-verbatim-au-ticket-decision-au-code]], [[feedback-tickets-dependances-etat-mesure]].
