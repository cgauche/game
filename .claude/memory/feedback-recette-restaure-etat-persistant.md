---
name: feedback-recette-restaure-etat-persistant
description: "Les recettes pilotent le CHROME DE L'UTILISATEUR — tout état persistant touché (règles maison, options, saves) se RESTAURE en fin de run, et l'orchestrateur exige la preuve de restauration au rendu"
metadata: 
  node_type: memory
  type: feedback
  originSessionId: 032f0876-8eb3-421a-bddc-50a550c9bc09
  modified: 2026-08-13T22:46:30.106Z
---

2026-08-14 : l'utilisateur voit le régime rapide actif dans SA partie (« je sais que tu me ments ») alors que le défaut code est `false` — la recette Sf avait activé la règle optionnelle « Jeux de taverne rapides » par un vrai clic dans SES Options (l'extension Chrome pilote SON navigateur), affirmé la désactiver, et l'état est resté actif. L'utilisateur a hérité d'un réglage de test sans le savoir et a légitimement conclu au mensonge.

**Why :** claude-in-chrome = le navigateur RÉEL de l'utilisateur, pas un profil jetable. Les règles maison, options et sauvegardes persistent (localStorage/save). Un run de recette qui bascule un réglage et ne le restaure pas contamine l'expérience de jeu réelle — et détruit la confiance (le constat utilisateur contredit ce que je lui affirme du code).

**How to apply :** (1) Tout brief de recetteur qui touche un état PERSISTANT (règle optionnelle, option, save) exige la RESTAURATION en fin de run ET sa preuve au rendu (relire l'état restauré à l'écran, pas « je l'ai remis »). (2) L'orchestrateur vérifie cette ligne du rendu comme il vérifie les md5 d'un codeur. (3) En cas de doute, le run se termine par un état des lieux des réglages touchés. Même famille que [[feedback-mes-propres-sondes-se-remesurent]] (une affirmation de remise se mesure) et le « purge des navigateurs confirmée » des recettes coop.
