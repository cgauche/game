---
name: ajouter-un-flux-de-jet
description: À utiliser quand on ajoute ou modifie un jet ou Test (attaque, sort, compétence, manœuvre, résistance) et sa modale — ou dès qu'on est tenté d'appeler rollTest inline sur le chemin joueur, d'ouvrir une deuxième fenêtre de conséquences, ou de recoder Chance/Pacte/Résilience.
---

# Ajouter un flux de jet

Lire **`docs/ajouter-un-flux-de-jet.md`** — un nouveau jet = 1 spec (`rollFlowSpecs.ts`, table
`FLOW_VERBS`) + 1 xConfirm ; la modale = `RollShell` paramétrée (slots/jetProps, JAMAIS de mécanique
générique recodée) ; le résolveur porte les trois cas de résolution forcée ; mono = multi N=1.
Gardes réelles : `rollFlowWiring.test.ts` (câblage) et `maneuver-defense-cascade.test.ts` (surfaçage
contrôleur humain).
