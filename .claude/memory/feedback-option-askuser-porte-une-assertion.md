---
name: feedback-option-askuser-porte-une-assertion
description: "Feedback — une option d'AskUserQuestion (et sa description) est une AFFIRMATION : elle se mesure avant d'être proposée. Deux prémisses fausses proposées au vote en une session, 2026-08-10."
metadata:
  type: feedback
---

**Vécu 2026-08-10.** Deux fois dans la même session, j'ai posé à l'utilisateur des options dont la
prémisse était fausse — et c'est LUI qui a mesuré à ma place :

1. J'ai avancé, comme coût d'un design, que mettre de vrais objets sur une créature « ferait entrer
   les PA dans le **butin** ». Réponse : « Ton délire sur le "loot" n'a pas de sens, les loots ne
   marchent pas comme cela de toute maniere. » Il avait raison, et **la mesure était déjà dans le
   rapport d'agent que j'avais lu** (`gearFromEffects`, `src/state/combatEffects.ts:156` — ne
   moissonne que des `giveTrapping` authorés, ne lit ni l'armure ni les items).
2. J'ai proposé de brancher le **matériau** d'armure sur `appearance.armurePortee`. Réponse : « ce
   n'est pas le meilleur arbitrage si on compte prendre en compte la pénétration » — juste : ce
   drapeau répond « porté vs corps », pas « métal vs cuir ». Une brigandine de cuir est portée ET
   non métallique. Je rustinais un axe avec un autre.

**Why** : une option d'`AskUserQuestion` n'est pas une hypothèse de travail, c'est une AFFIRMATION
présentée avec autorité — l'utilisateur vote sur ma description, pas sur le dépôt. Une prémisse
fausse dans une option produit une décision fausse, et le coût retombe sur lui : c'est lui qui doit
faire le travail de réfutation que j'aurais dû faire. Même famille que
[[feedback-brief-fait-autorite-grounding-seconde-main]] — sauf qu'ici la victime est l'humain.

**How to apply** : avant d'écrire une option, **sonder chaque coût et chaque bénéfice que sa
description affirme**, exactement comme une affirmation de brief. Si je ne peux pas coller la sonde
à côté, l'option ne se propose pas : elle se mesure d'abord, ou elle s'énonce explicitement comme
non vérifiée. Et quand un rapport d'agent contient déjà la mesure : **le relire avant de rédiger**,
au lieu de puiser dans mon souvenir de ce rapport.

Corollaire mesuré la même session : ne jamais conclure d'une sonde qui n'a pas tourné. Mon
« 68 erreurs TS » venait d'un `/tmp` périmé (le `tee` avait échoué, le `grep -c` comptait un vieux
fichier) — le vrai compte était 0. Une sonde dont la sortie visible est VIDE mais dont le compteur
est non nul est une sonde cassée, pas un résultat.

Lié : [[feedback-mes-propres-sondes-se-remesurent]], [[feedback-questions-via-outil-askuser]],
[[feedback-verifier-les-claims-architecturaux-des-agents]].
