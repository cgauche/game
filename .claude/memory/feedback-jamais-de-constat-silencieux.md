---
name: feedback-jamais-de-constat-silencieux
description: "Arbitrage 2026-07-15 — un constat de dette formulé en prose (\"dis-moi si tu veux\") est interdit : il devient un ticket dans le geste, et sa CLASSE reçoit une garde qui ÉCHOUE"
metadata: 
  node_type: memory
  type: feedback
  originSessionId: f99ca0f7-6f7b-4bd6-9080-4fe86b48eb33
---

**Arbitrage utilisateur du 2026-07-15, verbatim :**
« Faudra recenser tous les "non implémentés" et renforcer la guard ... on ne devrait jamais avoir des
constats silencieux de ce genre »

Déclencheur : à une question RAW (« peut-on augmenter son Statut artificiellement ? »), j'ai répondu
juste, puis ajouté « c'est un constat, pas une proposition de chantier — dis-moi si tu veux que j'en
fasse quelque chose ». Recadrage immédiat de l'utilisateur : « on a un ticket sur ces sujets ou c'est
un constat silencieux ? »

**Why :** « Dis-moi si tu veux que j'en fasse quelque chose » EST le « à traiter plus tard qui n'existe
nulle part » que le credo interdit — déguisé en politesse. Le constat meurt avec la conversation ;
la dette, elle, reste. Pire : ici l'outillage CONNAÎT déjà la dette. `scripts/raw/reconcile.mjs`
détecte les règles RAW marquées « (non implémenté) » dans l'Atlas et les compte en CI — **157 au
comptage du 2026-07-15**, l'ordre de grandeur qui fonde la leçon (re-comptage du 2026-07-26,
`docs/raw/reconciliation.md` : 3 marqueurs côté LDB, 7 toutes fiches confondues ; chiffres à
REJOUER, l'Atlas bouge)… et ne contient
aucun `process.exit` → CI verte, 0 ticket. Une garde qui MESURE une classe sans la GATER fabrique le silence à l'échelle
industrielle, et le rapport qu'elle écrit (`docs/raw/reconciliation.md`) est un fichier que personne ne
lit. Cf. [[feedback-personne-ne-lit-le-journal]] : le dénouement doit atterrir sur une surface qui
force la lecture — pour une dette, c'est un ticket ; pour une classe, c'est un exit 1.

**How to apply :**
1. Toute dette rencontrée — même en répondant à une simple question, même hors périmètre — devient un
   **ticket GitHub au gabarit #101+ dans le geste** (quote, Source verbatim, racine, fix, DoD). Jamais
   une phrase de rendu, jamais une question à l'utilisateur.
2. Granularité = **la racine, pas la règle**. Étalon : #433 replie 4 règles RAW + 1 corollaire + 1 smell
   en UN ticket (racine unique : le Statut est dérivé, il n'a pas d'état). Un marqueur qui ne se replie
   sur rien reste un ticket seul.
3. Puis remonter d'un cran : **quelle CLASSE a laissé passer ça ?** La corriger par une garde qui
   ÉCHOUE (exit 1), pas par un rapport. Ici → #434 : tout marqueur « (non implémenté) » sans réf `#N`
   fait rougir la CI, + cliquet par domaine (patron `src/ui/ui-ratchets.test.ts` #236, mécanique
   partagée `scripts/guards/lib/`).
4. **Une garde qui compte sans gater est un faux ami** — pire qu'aucune garde, car elle donne l'illusion
   de la couverture. Réflexe à l'audit : `grep process.exit` sur toute garde avant de la croire.
   Cf. [[game-exhaustive-guard-vs-per-domain]] et [[feedback-gardes-structurelles-pas-greps]].

Voir aussi [[feedback-audit-nest-pas-ordre-de-travail]] : ticketer n'est PAS exécuter — le ticket rend
la dette visible et arbitrable, il ne s'auto-attribue pas le droit de la corriger.
