---
name: feedback-migrer-l-existant-listes-doivent-decroitre
description: "User 2026-07-26 : toucher un système non conforme OBLIGE à le migrer dans le geste, CONSOMMATEURS COMPRIS ; les listes d'ancien comportement (baselines, cliquets, stocks, whitelists) doivent DÉCROÎTRE, jamais stagner."
metadata: 
  node_type: memory
  type: feedback
  originSessionId: 28c99d31-0f31-42bf-b192-e530e82d7635
  modified: 2026-07-26T06:50:48.841Z
---

**User 2026-07-26 (verbatim)** : « Quand tu vois que l'existant ne suis pas nos exigences, il faut le
migrer. On a pleins de système qui ne sont pas a niveau ou de liste d'ancien comportement qui doivent
decroitre. C'est ton travail quand tu touche a ces systèmes d'en profiter pour faire ces efforts de
migrations »

**Contexte** : chantier éditeur. J'avais dispatché des agents avec la consigne explicite « ne corrige pas
les offenseurs, LISTE-les », et j'envisageais de cliqueter les 9 trous d'éditabilité restants avec leur
ticket plutôt que de les combler. L'utilisateur a corrigé l'instruction en vol.

**Second volet, même jour (verbatim)** : « Quand tu juge que l'existant n'est pas bon, tu dois t'assurer de
migrer les éléments qui l'utilisent pour qu'ils fonctionnent aussi » — remplacer une primitive/un modèle
n'est PAS fini tant que tous ses CONSOMMATEURS n'ont pas été déplacés. Une migration à moitié faite laisse
deux mondes vivants : exactement le legacy propé que le credo interdit. Le balayage exhaustif des appelants
fait partie du geste, et se COMPTE dans le rendu.

**Troisième volet, même jour (verbatim)** : « Et on a pleins de guard avec une liste en dure d'élément a
migrer. » Une garde qui embarque sa liste d'offenseurs tolérés (baseline, stock, whitelist, allowlist,
tableau d'exemptions par nom de fichier) est elle-même le registre de la dette. Ces listes sont l'inventaire
du travail restant : elles se lisent comme un backlog, et toucher un système qui y figure oblige à en
retirer ses lignes.

**Inventaire mesuré le 2026-07-26** (nombre d'entrées ; à faire décroître, jamais croître) :
`scripts/guards/lib/paletteLiteralStock.mjs` **1268** (`PALETTE_LITERAL_RATCHET`) ·
`folioRatchetStock.mjs` **121** (`FOLIO_RATCHET`) · `rigPartViewStock.mjs` **76** (`PART_VIEW_RATCHET`)
**+3** (`PART_VIEW_ALIAS_RATCHET`) · `scripts/raw/folio-gaps-baseline.json` **46** ·
`fleshGradientStock.mjs` **44** (`FLESH_GRADIENT_RATCHET`) · `rollSeamWhitelist.mjs` **27**
(`ROLL_SEAM_FILE_WHITELIST`) · `battleRngEngineLeakWhitelist.mjs` **3** en propre
(`combatSlice.ts`/`portFlow.ts`/`tavernFlow.ts`, le reste de ses 30 lignes venant du spread de
`ROLL_SEAM_FILE_WHITELIST` — en retirer une là-bas allège les deux gardes) · plus les baselines
inline de `src/ui/ui-ratchets.test.ts` (boutons nus, hex hors tokens, `.panel` redéfini, `flex-wrap`) et
`scripts/raw/{dead-refs,graphy,reanchor-low}-baseline.json`.

**Why** : une garde élargie qui ne fait que RECENSER déplace la dette sans la réduire — et un cliquet dont
la baseline ne baisse jamais est une dette gelée qu'on a cessé de voir. Le contexte est CHAUD au moment où
on touche le système : c'est le seul moment où la migration coûte peu. Reporter, c'est garantir que
personne ne la fera. Corollaire dur : ajouter une entrée à une baseline est une régression ; en retirer
est le travail attendu, même quand ce n'est pas le sujet du ticket. Et une exemption PAR NOM D'OFFENSEUR
est toujours suspecte : une exemption légitime se formule par FORME (les tests, les migrations datées),
jamais par une liste de coupables.

**How to apply** : dès qu'un geste touche un système non conforme, la migration fait partie du geste, pas
d'un ticket de suite. Concrètement — (1) élargir une garde ⇒ migrer ce qu'elle révèle, pas seulement le
rapporter ; (2) toucher un fichier présent dans une baseline (`src/ui/ui-ratchets.test.ts`,
`*-baseline.json`, `*Stock.mjs`, `*Whitelist.mjs`, `folio-gaps-baseline.json`) ⇒ faire BAISSER sa ligne,
idéalement à 0, et supprimer l'entrée ; (3) le rendu de fin de lot annonce le delta CHIFFRÉ de chaque
liste touchée (avant → après), pas un « rien de nouveau ». Ce qui reste ouvert se dit sans euphémisme, avec
la raison — jamais par omission. Précédent du 2026-07-26 : les 5 rangées de liste recopiées de l'inspecteur
ont été migrées sur une primitive `ListRow` et 4 baselines de `<button>` nu supprimées, plutôt que d'ajouter
une 5ᵉ ligne au cliquet.

Complète [[feedback-bug-existant-trouve-se-traite-pas-juste-ticketise]] (bug adjacent : ticket ET fix) et
[[feedback-no-legacy-propping-fallbacks]] (le legacy se supprime, ne se prop pas) : ici la cible n'est plus
un bug ni un fallback, mais un SYSTÈME entier hors normes et les compteurs qui l'entérinent.
Lié : [[feedback-jamais-de-constat-silencieux]], [[game-existant-poc-refactor-libre]],
[[feedback-gardes-structurelles-pas-greps]].
