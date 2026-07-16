---
name: game-sources-pdf-errors-verify-case-by-case
description: "Les PDF/sources WFRP4 contiennent des erreurs ; un écart JSON↔source peut être une correction volontaire — vérifier cas par cas, jamais appliquer la source en aveugle"
metadata: 
  node_type: memory
  type: feedback
  originSessionId: 79086e8f-2b86-464f-8a9e-6f2bc67f4515
---

Les livres `Source/` (PDF → Marker/OCR) **ne sont pas exempts d'erreurs**. Un écart entre
`src/data/*.json` et la source n'implique PAS que le JSON est faux : nos données ont parfois été
**corrigées à la main** par l'utilisateur contre une erreur de la source.

**Exemple fondateur (2026-06-23) :** le PDF Middenheim liste les carrières dans l'**ordre alphabétique
ANGLAIS** (pas français) → les valeurs de tirage d100 Middenheim/Middenland/Nordland sont décalées
dans la source. L'utilisateur avait **déjà corrigé** `careers.json` (`rand.Middenheim/Middenland/
Nordland`). Un audit a signalé « JSON faux, source dit 96/96/96 » → **FAUX POSITIF** : c'est la source
qui est fautive, le JSON est juste. Ne PAS « corriger » vers la source.

**Why :** appliquer la source en aveugle ré-introduit les bugs que l'utilisateur a déjà éliminés, et
viole l'esprit de la règle 1 (fidélité au RAW *correct*, pas à l'artefact OCR).

**How to apply :** sur tout audit/correction de données contre `Source/`, traiter chaque écart **cas
par cas** — présenter la preuve (citation source + valeur JSON), se demander « est-ce un bug JSON ou une
correction volontaire d'une erreur source ? », et **demander/flaguer** quand c'est ambigu plutôt que
d'éditer. Complément inverse de [[feedback-source-user-claims]] (vérifier les dires user contre la
source) : ici c'est la **source** qu'on met en doute. Voir l'audit `docs/audit-donnees-2026-06-23.md`.

**VO comme arbitre (2026-06-23, user) :** la donnée du jeu reste **FR** (cf. [[game-francais-jamais-anglais]]),
mais **quand on a un DOUTE sur la VF** (valeur suspecte, ordre de table, traduction louche, OCR cassé),
on **regarde la VO** pour trancher — les livres VO sont dans `Source/` (Enemy Within EN, Up in Arms,
Archives of the Empire, The Imperial Zoo, Sea of Claws…). La VO est un **tie-breaker de vérification**,
pas la source de la donnée affichée (qui reste recollée du FR).

**LIMITE de la VO :** elle aide pour un doute de **valeur** (une stat, un mot, une orthographe), PAS
pour un défaut de **collation/ordre propre à la VF**. Ex. Middenheim : la table de carrières FR a gardé
l'**ordre alphabétique anglais** ; la VO étant elle aussi en ordre anglais, elle ne révèle rien — le
correctif exige de **re-trier selon l'alphabet français** (fait à la main par l'user). Donc : VO pour
les valeurs, jugement FR + re-tri pour les ordres.
