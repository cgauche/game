---
name: feedback-rendu-apres-stall-se-regate-integralement
description: "2026-09-01 : un agent repris après un STALL watchdog (ou un redémarrage du processus) rend des verdicts de gate PÉRIMÉS — le tsc FULL « vert » du L4 monnaie datait d'avant ses derniers renames ; 4 TS2353 à HEAD attrapés par la session voisine"
metadata:
  type: feedback
---

Précédent : codeur L-monnaie-4 (#1463), calé 600 s en plein lot, relancé depuis son transcript, rendu « tsc FULL : No errors found » — mais les 4 fixtures `cost` de CombatConsole.test.tsx n'étaient PAS migrées (3/4 après une 2e relance coupée par un redémarrage du harnais). HEAD poussé rouge au typecheck, mesuré par la session voisine sur SON gate.

**Why :** un agent repris ne rejoue pas ses gates depuis le début — il reprend « là où il en était », et ses verdicts d'avant-stall décrivent un arbre qui n'existe plus. Le rendu final mélange des mesures de deux états.

**How to apply :**
1. Tout rendu d'agent REPRIS (stall, watchdog, redémarrage, SendMessage de reprise) → l'orchestrateur REJOUE lui-même les gates décisifs (tsc FULL + la suite du périmètre) AVANT de committer, sans foi aux verdicts rapportés.
2. Au brief de reprise : exiger un ÉTAT DES LIEUX d'abord (git status + relecture des fichiers touchés) puis un re-gate complet en fin — jamais « continue là où tu étais ».
3. Corollaire de [[feedback-verifier-les-claims-architecturaux-des-agents]] et [[feedback-preuve-mesuree-sur-le-chemin-reel]].
