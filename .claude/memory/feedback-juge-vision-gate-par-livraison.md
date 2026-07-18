---
name: feedback-juge-vision-gate-par-livraison
description: "Le juge vision est un GATE PAR LIVRAISON d'écran (au rang de tsc/suite), jamais une étape de fin de programme — vécu 2026-07-17 : ~15 livraisons pour 1 passe de juge, l'utilisateur a tenu le siège du juge toute la nuit"
metadata: 
  node_type: memory
  type: feedback
  originSessionId: fe239011-bf46-4e5d-b120-539f4c477f25
---

Verdict user (2026-07-17, nuit fiche #492, verbatim) : « Tu sers à quoi ? Ton credo dit bien de
vérifier le travail de l'agent ? D'utiliser un juge adversarial pour s'assurer que l'agent ne
fasse pas n'importe quoi ? » — après une nuit où CHAQUE fournée de défauts a été trouvée par lui.

**Le décompte qui condamne** : ~15 livraisons UI, 1 seule passe de juge vision. Diffs survolés sur
rendu aux derniers lots, suite complète abandonnée après minuit, claims « déjà correct/pas
reproduit » non contre-vérifiés (le `.sheet-etat` validé aux pixels sans vérifier la plomberie).

**Pourquoi ça dérive** : sous pression de flux (l'utilisateur réagit vite, les micro-gestes
s'enchaînent), chaque étape de vérification paraît « trop lourde pour CE petit fix » — et la somme
des petits fixes non jugés EST l'écran qui « se moque de nous ».

**La règle mécanique (pas promissoire)** — AUCUN commit de lot UI sans les 5 gates, même un
micro-fix :
1. **JUGE DE CODE adversarial sur le DIFF** (agent `juge`, pas moi — ma diligence fond sous le
   flux ; complément user 2026-07-17 : « Et donc sur de l'UI personne ne regarde le code ? »).
   Lentilles : primitives composées vs scopes mono-écran, variantes en data-attribute vs classes,
   morts réellement purgées (sélecteurs/props/markup), tests = contrats positifs, claims de
   l'agent contre-grepés. Les fautes d'écran de la nuit étaient TOUTES des fautes de code d'abord.
2. Diff LU par moi (pas le rendu de l'agent — le diff).
3. Gates de MA main (tsc + suite ciblée + cliquets ; suite COMPLÈTE avant commit).
4. Captures fraîches + MES yeux (mécanisme vérifié, pas que les pixels : le sélecteur existe,
   la prop est branchée).
5. **JUGE VISION adversarial** — par livraison, au même rang que tsc. Un lot « trop petit pour le
   juge » se cumule avec le suivant et les juges passent sur le cumul AVANT l'utilisateur.

Lié : [[feedback-audit-obligatoire-avant-annonce-de-fermeture]],
[[feedback-rendu-ui-sans-preuve-navigateur-refuse]], [[feedback-tests-tombale-contrat-positif]].
