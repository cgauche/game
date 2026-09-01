---
name: env-doc-derive-determinisme-cross-os
description: "Un doc DÉRIVÉ généré sous Windows peut différer de sa régénération sur le runner Linux (ordre readdirSync, premier-site par parcours) — la CI rougit MUETTE ; tout générateur pose un ordre TOTAL et une morsure d'invariance"
metadata: 
  node_type: memory
  type: project
  originSessionId: 39a8970a-cba9-474a-be43-12bdf0b366e7
  modified: 2026-09-01T17:00:39.180Z
---

**Fait (2026-09-01, #1620 lot 1 → CI runs 33523707492/33524356220 rouges sur d4f09ccb1/24f1559e0)** : `docs/consommateurs-de-champs.md` régénéré localement (Windows) passait vert (`--check` OK, suite complète verte), puis la CI Linux le déclarait « PÉRIMÉ ». Cause instruite et PROUVÉE (36 cellules « Exemple » ont bougé après tri) : `listProdFiles` rendait l'ordre de `readdirSync` sans tri — NTFS le rend trié sans casse, ext4 par ordre de hash — et le « premier site » cité par champ suivait le PARCOURS, pas un ordre calculé. Le log CI ne montrait RIEN (assertion booléenne « PÉRIMÉ », pas de diff) : un rouge muet, diagnostiqué de mémoire.

**Why** : un doc dérivé est vérifié par « régénéré == committé » ; toute dépendance à l'ordre du FS, à `program.getSourceFiles()`, au `[0]` d'un `Set`/`Map` issu d'un parcours, à la casse d'un chemin ou au séparateur, produit un doc qui n'est reproductible que sur la machine qui l'a écrit. Le vert local ne prouve rien de cross-OS.

**How to apply** :
- Tout générateur de doc/stock pose un ORDRE TOTAL explicite (tri en unités de code sur chemin normalisé `/`, jamais `localeCompare` ; lignes comparées NUMÉRIQUEMENT ; « premier site » = minimum, jamais le premier rencontré) et le prouve par une MORSURE d'invariance committée (rapport bâti sur l'ordre INVERSE ⇒ byte-identique).
- Un test de fraîcheur imprime ses lignes divergentes (`apercuEcart`, patron `src/data/field-consumers.test.ts`) — un rouge NOMME sa cause.
- Après un push qui touche un générateur ou son doc : VÉRIFIER la CI sur le sha (`gh run list --branch main`) AVANT d'annoncer « POSÉ » — le vert local n'est pas le vert CI.
- Inventaire cross-OS à dérouler (11 points, #1620 lot 2) : readdirSync, getSourceFiles, Set/Map de parcours, `[0]`, casse, `sep`, cwd/chemins absolus, CRLF (`.gitattributes` `eol=lf`), corpus (`git ls-files` = walk), date/locale.
Liens : [[env-coordination-arbre-partage-sessions]], [[feedback-jamais-de-constat-silencieux]], [[game-doc-derivee-jamais-ecrite-a-la-main]].
