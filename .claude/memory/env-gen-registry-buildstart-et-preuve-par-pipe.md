---
name: gen-registry-buildstart-et-preuve-par-pipe
description: "« [inchangé] » de gen-registry après un run vitest est NORMAL (vite.config le régénère au buildStart) ; toute preuve de sortie de runner passe par redirection en fichier, jamais un pipe"
metadata: 
  node_type: memory
  type: project
  originSessionId: 64ff102c-858d-4a48-8874-499544f67ec4
  modified: 2026-08-24T17:48:35.591Z
---

Établi 2026-08-24 (réfutation par la session grammaire, reproduite 4 runs) : `gen-registry.mjs:612-616` compare le contenu émis AU BYTE avant d'écrire — « [inchangé] » ⇔ byte-identique, aucune écriture possible sous ce libellé. Quand un codeur voit « [inchangé] » alors que le diff vs HEAD montre ses ids neufs, deux causes réelles : (1) `vite.config.ts:9-20` (`registryGen`) appelle `genAll()` EN SILENCE au buildStart de TOUT vitest/vite dev — un test lancé entre l'édition de la donnée et le `npm run gen` a déjà écrit le fichier ; (2) le pont shell RTK/lean-ctx PIPÉ peut afficher une ligne non concordante avec l'état disque (reproduit : `npm run gen | tail` disant « [inchangé] » à la seconde où mtime+contenu prouvaient l'écriture).

**Why :** J'ai routé un « défaut de générateur » à une autre session sur la foi d'un libellé pipé — la prémisse était fausse, le générateur honnête. Même famille que [[env-faux-vert-pont-rtk-vitest-collecte]] et [[env-exit-code-avale-par-l-outillage-shell]].

**How to apply :** (1) Un « [inchangé] » post-tests n'est PAS une anomalie — le registre a pu être écrit par le buildStart. (2) Toute PREUVE fondée sur la sortie d'un runner/générateur : rediriger en FICHIER puis lire le fichier, jamais conclure d'un pipe. (3) Avant de router un défaut d'outillage à une session tierce : reproduire soi-même avec cette discipline.
