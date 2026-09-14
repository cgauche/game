---
name: user-doctrine-ui-coherente-par-primitives-comme-les-donnees
description: "Un concept d'interface = UNE primitive, avec la même rigueur d'inventaire et de convergence que les structures de données"
metadata:
  type: user
---

**Verbatim (2026-09-04)** : « N'oublie pas les concepts lié a l'UI et les primitives. Le but est toujours d'avoir une interface cohérente dans toute l'application, comme on fait avec notre structure de donnée. » puis « si on doit modifier l'interface, on n'a juste qu'a toucher aux primitives plutot que partir a la chasse de tous les écrans de l'application ».
**Corollaire (2026-07-12)** : « J'y crois pas une seule seconde à des classes mono-écrans personnellement, c'est une excuse à la dérive ».

**Why :** l'interface a la même maladie que les données divergentes (classes mono-écran, markup recodé, Nᵉ modale) et le même remède ; le test est « si demain on change ce concept, combien de fichiers bougent ? » — la bonne réponse est UN.

**How to apply :** tout brief d'écran commence par l'inventaire des formes existantes du concept et nomme ses primitives cibles (`docs/primitives.md`, `docs/charte-ui.md`) ; un concept sans primitive s'EXTRAIT de l'étalon existant, jamais une copie locale ; le motif se cherche d'abord dans la couche atomique et s'y étend, et s'il reste inexprimable il devient un générique PARTAGÉ, jamais une classe locale ; markup recodé, classe mono-écran, `select` brut, `<input>` nu, élément interactif nu ou lien Codex hors primitive sont bloquants au juge ; un écran touché s'audite EN ENTIER et les cliquets d'UI décroissent.
