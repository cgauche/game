---
name: feedback-migration-donnees-ui-exige-recette-au-commit
description: "Une migration de DONNÉES qui alimente un écran exige une recette navigateur AU commit — les gates unitaires ne voient ni la régression d'affichage ni le crash de rendu (basculement possessions 2026-07-21)."
metadata:
  type: feedback
---

Le basculement mule-objet→possession (#617/#618) a été committé sur gates UNITAIRES vertes (tsc + suite complète) SANS recette navigateur. Deux défauts ont échappé et n'ont surgi qu'à la recette de #649, plus tard :
- la **perte du nom propre** de possession (« Gros blaireau apprivoisé » réduit à « Blaireau ») — signalée par l'USER, pas par le process (→ #650) ;
- un **crash de rendu** CodexRef (violation des Rules of Hooks : `useEffect` après un return anticipé) sur TOUTE fiche Carrière au Compendium, resté latent (→ #652).

**Why:** un test vert sur un câblage partiel ne rend pas l'écran — il ne voit ni un libellé perdu, ni un hook mal placé qui ne casse qu'au montage réel avec une entrée hors catalogue. La règle « preuve navigateur pour l'UI » ([[feedback-rendu-ui-sans-preuve-navigateur-refuse]]) ne s'arrête pas aux écrans NEUFS : une migration de DONNÉES (dotations, refs, schémas) qui alimente un écran EXISTANT est un changement d'UI déguisé.

**How to apply:** dès qu'un commit touche des données/refs consommées par un écran, dérouler une recette navigateur AU commit (pas en follow-up) — au minimum ouvrir l'écran concerné, vérifier l'affichage réel + 0 erreur console. Acté par la revue de palier 2026-07-21. Voir [[game-socle-possessions-programme]].
