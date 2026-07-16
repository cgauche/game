---
name: game-rechargement-test-etendu
description: "Recharger une arme à distance = Test étendu de Projectiles (un JET → une MODALE), cumul de DR jusqu'à l'Indice « Recharge N » ; pas « N actions »."
metadata: 
  node_type: memory
  type: project
  originSessionId: f0bbdd56-571f-4a6d-b783-75ddf35a3eea
---

Recharger une arme à distance dans le jeu suit le canon WFRP4, PAS une abstraction « N actions ».

**Source** : `63 - Armures.md` l.28-29 (le défaut *Recharge (Indice)* est mis-split hors du chapitre 62-Armes) : « Une arme déchargée … nécessite un **Test étendu de Projectiles** approprié au Groupe d'armes … et nécessite d'obtenir _Indice_ DR pour être rechargée. Si vous êtes interrompu …, vous devez recommencer à zéro. » + `12 - Tests.md` l.199-211 (Test étendu : on cumule les DR par Round jusqu'à la cible ; **si le total passe sous 0 → recommencer** ; DR 0 = aucune incidence) + `10 - Talents.md` l.804/42 (Rechargement rapide / Artilleur ajoutent des DR « à un Test pour recharger » → confirme que c'est un jet).

**Modèle** : `reloadProgress` = **DR cumulés** (pas un compteur d'actions). `Weapon.reload` = Indice DR cible (Arbalète « Recharge 1 » = 1 DR ; Arbalète lourde/Tromblon « Recharge 2 » = 2 DR ; Arc = pas de défaut → toujours chargé). Valeur du test = `combatValue(active,'ranged')` (CT + avances Projectiles), Difficulté **Intermédiaire (+0)** (le canon ne spécifie pas → défaut, ne rien inventer). Cumul : `progress = max(0, progressBefore + sl)` ; si `progress ≥ reload` → `loaded=true, progress=0`.

**Conséquence d'archi** : « [[game-roll-modal-pattern]] » s'applique — recharger ouvre une **modale** (`pendingReload` : Lancer→DR→Chance→Appliquer), comme attaque/test/défense. L'instruction utilisateur « si y'a un jet, y'a la modale » est une invariante du projet.

Le plan initial `docs/superpowers/plans/2026-06-05-rechargement-munitions.md` modélisait à tort « N actions, +1 chacune » → corrigé en cours d'exécution. Talent **Rechargement rapide** (+DR au jet) = extension future, non câblé.
