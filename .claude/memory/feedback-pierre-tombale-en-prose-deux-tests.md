---
name: feedback-pierre-tombale-en-prose-deux-tests
description: "User 2026-07-26 : la pierre tombale se glisse dans la PROSE (fiches de mémoire, docs, briefs) où aucune garde ne scanne — et une mention de suppression n'est de la connaissance que si le piège survit ET n'est écrit nulle part ailleurs."
metadata:
  node_type: memory
  type: feedback
---

**User 2026-07-26 (verbatim)** : « Tu met des pierres tombales ? » puis, sur mon exemple de défense :
« Pourquoi on vodurait recréer makeMultiRollFlow ? »

**Contexte** : je corrigeais une fiche de mémoire qui décrivait un mécanisme d'escalier disparu, et j'ai
écrit — dans la correction elle-même — « ⚠ PÉRIMÉ depuis », « N'EXISTENT PLUS », « est SUPPRIMÉ », « le
porteur a changé ». Trois pierres tombales en deux paragraphes, dans le geste censé nettoyer.

**Why** : la garde `src/comment-poison-guard.test.ts` ne scanne que les COMMENTAIRES de `src/**/*.ts(x)`
et de `scripts/guards/lib/**`. Les fiches de mémoire, les `docs/*.md` et les briefs d'agent sont hors de
sa portée — rien n'arrête la main. Or c'est précisément là que le réflexe est le plus fort : quand on
CORRIGE un écrit, on veut expliquer ce qu'on corrige. Le lecteur de demain n'a que faire du delta ; il
lui faut l'état courant. Et une fiche est versionnée comme du code : git porte son histoire.

Mesure du 2026-07-26 avec les motifs canoniques (`TOMBSTONE_FAMILIES`, `scripts/guards/lib/commentPoison.mjs`)
appliqués hors de leur portée : **32 détections dans `.claude/memory`** (26 fiches), **21 dans les docs
vivants** (14 fichiers). ⚠ Les familles sont calibrées pour du CODE : sur de la prose elles sur-détectent,
le tri se fait à la main avec les deux tests ci-dessous.

**How to apply** — une mention de suppression n'est de la CONNAISSANCE que si elle passe les DEUX tests :

1. **Le piège survit-il à la suppression ?** Nommer un symbole disparu ne protège de rien : personne ne
   retape un identifiant précis. Ce qui se recrée, c'est le GESTE — forker une primitive, rebrancher une
   génération sur des données curées, recopier un câblage.
2. **Le piège est-il déjà consigné ailleurs ?** `CLAUDE.md`, `.claude/credo.md`, un `docs/*.md` vivant,
   une garde mécanique. Si oui, la ligne de mémoire n'est que de l'histoire.

**Exemple calibrant** (celui que l'utilisateur a démonté) : « `makeMultiRollFlow` (un faux générique qui
recopiait le câblage) a été supprimé — ne pas le recréer ». Personne ne retaperait ce nom ; et le geste
réel est déjà dans la table des primitives du `CLAUDE.md` — « la MÊME coquille `RollShell` (le mono =
N=1) ». Les deux tests échouent → pierre tombale.

**Quand la connaissance porte mais que la formulation narre**, ne pas supprimer : convertir en CONTRAT
POSITIF. « X a été supprimé parce qu'il écrasait Y » devient « Y est la source ; rien ne la régénère ».
La règle se dit au présent, l'interdit demeure, l'histoire tombe. Même mouvement que pour les tests dans
[[feedback-tests-tombale-contrat-positif]].

Lié : [[game-doc-derivee-jamais-ecrite-a-la-main]], [[feedback-un-detecteur-ne-mesure-que-sa-couverture]]
(une garde ne vaut que sa portée — ici la prose est l'angle mort), [[game-exhaustive-guard-vs-per-domain]].
