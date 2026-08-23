---
name: feedback-regle-1-jamais-commit-avec-reste-ouvert
description: "2026-08-23 : règle 1 du credo relue sous rappel utilisateur — un commit qui liste sa propre dette (« Reste ouvert », « fix-forward ») EST un élément différé ; « pas de deprecated » = aucun champ optionnel justifié par « absent = ancien comportement », aucun shim, aucune tombale"
metadata: 
  node_type: memory
  type: feedback
  originSessionId: 581b89eb-a389-4f97-87c2-713104a0fbca
  modified: 2026-08-23T18:40:01.870Z
---

Verbatims utilisateur (2026-08-23, chantier #1463) : « Suis bien le credo, surtout la régle 1. Il me faut une base solide pour évite toute nouvelle dérive » → « En tout cas régle 1 du credo, pas de deprecated » → « **Tu te rappel que je t'ai demandé explicitement de relire la régle 1 du credo ?** » (règle 1 : « Pas de code mort, de deprecated, de rétro-compatibilité, de dette technique, ni de code dupliqué […] Zéro dette non corrigée, zéro entorse au RAW, zéro élément différé ou "hors scope" »).

**Ce que j'avais fait :** committé L0 (`3a6017ebb`) avec un paragraphe « Reste ouvert sur #1465 (fix-forward) » listant des défauts CONNUS (graphies hors stock, commentaires non posés) — pour débloquer une session voisine dont le pre-commit butait sur mon WIP. Puis, devant 58 sites `legacy`/`rétro-compat`/shim mesurés dans `src`+`scripts`, j'ai annoncé « je consigne » au lieu de traiter.

**Why :** un commit qui documente sa dette la rend respectable (« fix-forward » n'existe pas dans le credo) ; « consigner » un constat est le signalement que le credo refuse (« le poison se corrige DANS LE GESTE — signaler n'est pas corriger ; hors périmètre → issue immédiate »). Et « pas de deprecated » vise aussi la forme la plus banale : le champ OPTIONNEL dont l'absence « vaut l'ancien comportement » (`ops.ts:1106` « IA/rétrocompat », `provisions.ts:341`…) — c'est une rétro-compatibilité déguisée en défaut.

**How to apply :**
1. Un lot se commite FINI : si un juge laisse des RÉFUTÉ, la passe de correction précède le commit — débloquer un voisin se fait en finissant plus vite, pas en committant de la dette. Jamais de « Reste ouvert » dans un message de commit.
2. Tout constat de legacy/deprecated/shim rencontré → ticket du chantier dans le même tour, chaque site AFFECTÉ au lot qui le tue (#1486), plus une garde décroissante — pas une note.
3. Dans la grammaire (#1466) : une valeur par défaut est une RÈGLE nommée (réf RAW nue ou `maison`), jamais « absent = ancien comportement » ; un champ devenu inutile est supprimé avec sa donnée migrée dans le même commit. Voir [[feedback-jamais-de-demi-migration]], [[feedback-registre-fossiles-transition]], [[feedback-jamais-de-constat-silencieux]].
