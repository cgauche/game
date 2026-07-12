---
name: orchestrer-des-agents
description: À utiliser dès qu'une tâche implique d'écrire ou modifier du code, de dispatcher un agent ou un workflow — ou dès qu'on est tenté de coder soi-même « parce que c'est petit ». Aussi au retour d'un agent (avant de vérifier/committer son travail) et avant tout agent() sans modèle/effort explicites.
---

# Orchestrer des agents

**Je ne code pas — même le trivial.** Un guard d'une ligne, une regex, un refacto « couplé » →
un agent, avec un spec précis. Moi = décomposer, spécifier, vérifier, intégrer. Seul code de ma
main : l'intégration triviale et les gates. Violer la lettre de cette règle EST violer son esprit.

## Cycle

1. **Grounding** — sweep de 3+ fichiers → agent Explore (régions + rapport). 1-2 lectures ciblées
   inline pour trancher = OK. La décision d'archi reste dans mon fil ; **primitives cibles NOMMÉES
   avant tout code** (table « Primitives partagées » du CLAUDE.md, grep du concept en amont).
2. **Brief d'agent** — un brief contient : périmètre de fichiers exact, primitives cibles nommées,
   réfs RAW nues (`LDB 13 l.142` — jamais paraphrasées), le chemin ABSOLU du worktree à utiliser
   tel quel, l'interdit de tout `git checkout/restore/reset/stash/add/commit`, et « ton rendu
   final = données brutes, pas un message ».
3. **Dispatch** — l'effort de chaque étage est MAÎTRISÉ, jamais subi. Trois canaux : Workflow
   `agent()` (opts `model` + `effort` par appel — le seul contrôle par appel) ; tool Agent
   (`model` seul — l'effort vient de la définition du type dans `.claude/agents/*.md`, sinon
   HÉRITE de la session : ultracode = xhigh silencieux) ; définition d'agent épinglée (modèle +
   effort au frontmatter). Workflows lourds SÉQUENTIELS (3 en // = rate-limit serveur, finders
   morts) ; gros volume → lots séquentiels dans le script. ⚠ Un type épinglé qui hérite TOUS les
   outils (`tools:` omis) doit porter `disallowedTools: Agent, Workflow` — sinon l'agent voit son
   propre type « prévu pour ce travail » dans la liste et se re-délègue sa mission à l'infini
   (vécu : recetteur → recetteur → recetteur, 2026-07-08).
4. **Isolation** — agent qui MUTE des fichiers pendant qu'une session // est active →
   `isolation: "worktree"` ; à défaut committer immédiatement au retour. Deux strays d'agents
   consécutifs dans l'arbre principal = j'applique moi-même le patch chirurgical connu.
   **Les recetteurs sont un étage SÉQUENTIEL** : jamais deux en vol (même serveur dev, même
   navigateur piloté — clics croisés et captures polluées ; vécu 2026-07-12, flag de l'user).
5. **Attente** — un agent background n'est PAS fini avant sa `<task-notification>` : ne pas lire,
   tester ni diagnostiquer son WIP (erreurs fantômes garanties).
6. **Vérification (par MOI, jamais sur la foi du rapport)** — typecheck en sortie COMPLÈTE
   (`npm run typecheck 2>&1 | grep -cE "error TS"` + filtre sur mes fichiers, jamais `tail`) ;
   suite COMPLÈTE avant commit (les échecs s'attribuent, un arbre churné n'excuse rien) ; revue
   du diff ; règle/valeur → Atlas `docs/raw/` puis `Source/` ; UI → skill `recette-navigateur`.
   Livraison d'agent sur un sous-système → audit adversarial : fidélité RAW intégrale + éditabilité
   first-class (un raccourci « borne le reste » est un défaut, pas un choix).
   **Livraison d'ÉCRAN → trois passes, pas une** : recette fonctionnelle (DoD), ET jugement
   d'écran (captures → juges VISION en lentilles : charte/primitives, hiérarchie-densité,
   cohérence inter-écrans, ressenti joueur « prototype ou produit ? » — défauts concrets +
   ressentis, jamais des scores), ET lisibilité si du style a bougé. La conformité fonctionnelle
   ne voit ni le noir-sur-noir ni le « ça fait pas fini » (vécu 2026-07-12, trouvés par l'user).
   **Les CLAIMS ARCHITECTURAUX d'un rendu se contre-grep comme des faits** (« X est le seul
   seam », « la primitive n'existe pas », « il n'y a pas de couture pour ça ») — des portes
   vertes ne valident pas la FORME, et des tests verts sur un câblage PARTIEL ne révèlent
   jamais la surface oubliée (vécu : #341, la défense sans le −10 météo alors que le collecteur
   passif existait). Exiger dans tout brief la SORTIE BRUTE des portes au rendu (un exit code
   allégué = résultat fabriqué, vécu 2026-07-11). **Tout écart « consigné » dans un rendu
   devient un TICKET dans le même tour** — consigné-sans-ticket = backlog invisible = poison.
7. **Commit** — mes seuls fichiers par pathspec, jamais `--amend` en arbre partagé, git via
   l'outil PowerShell (RTK rend le Bash git lent/compressé).
8. **Fermeture (rituel OBLIGATOIRE — fermer a ses portes comme committer)** — toute vague qui
   ferme des tickets se termine par une **passe de réfutation NON demandée** (juges adversariaux,
   patron fini-vérifié : « tente de réfuter cette fermeture sur pièces ») AVANT toute annonce ;
   l'annonce porte les VERDICTS (TIENT/FRAGILE/RÉFUTÉ), jamais un score brut. Périmètre de la
   passe = les DÉCISIONS de la vague : fermetures, splits (leur prémisse est-elle vérifiée ?),
   claims d'agents, écarts consignés-non-ticketés. Fermer sur « déjà implémenté » ou
   « documentation faite » exige la relecture du DoD MOT À MOT (vécu #254 : documenter ≠ le DoD
   comportemental). Ces règles se durcissent SOUS pression de temps (« maximum de tickets »),
   elles ne s'y suspendent pas — vécu 2026-07-11 : 5 fermetures rouvertes, juges lancés
   seulement à la demande de l'utilisateur.

## Calibrage — routage et cérémonie

| Étage | Type épinglé (`.claude/agents/`) | Modèle | Effort |
|---|---|---|---|
| Lecture / comparaison de masse | `lecteur` | sonnet | medium |
| Vérification mécanique (existence, famille) | `verif-mecanique` | haiku | low |
| Code sous spec précise | `codeur` | sonnet | medium |
| Jugement dur (réfutation, synthèse, archi) | `juge` | opus | medium |

Via le tool Agent, préférer ces quatre types (modèle + effort épinglés au frontmatter) à
`general-purpose`, qui hérite l'effort de session.

**JAMAIS Sonnet en effort haut/xhigh** (coûte plus cher qu'un Opus medium). La cérémonie se
calibre à la taille/risque RÉEL, pas au flag ultracode : petite feature testée → 1 agent codeur
+ gates, sans fan-out ni reviewer dédié ; tâche large/incertaine (audit moteur, migration,
extraction massive) → workflow ; reviewer adversarial réservé aux régressions silencieuses
possibles et à l'art (l'audit aveugle EST la revue). Un arbitrage user nécessaire → couper la
boucle et poser les questions GROUPÉES, pas les parquer dans une spec.

## Rationalisations connues

| Excuse | Réalité |
|---|---|
| « C'est petit/couplé, je le fais moi-même » | 2026-06-29 : « le pire orchestrator que je connaisse ». Même une ligne → agent. |
| « L'agent rapporte tout vert » | Vécu : guillemets courbes qui cassaient tsc. Relancer les gates soi-même. |
| « `tail` suffit pour le typecheck » | TS2322 livrée en affirmant « clean » (`82c3f416`). Sortie complète, comptée. |
| « Arbre churné, la suite complète n'est pas attribuable » | Régression `92c70234` attrapée par la SEULE suite complète. |
| « L'effort par défaut fera l'affaire » | Héritage session = xhigh sous ultracode, hors de prix sur un fan-out. |
| « Ticket fermé = fini » | Combat de masse #69 livré à ~50 % avec tests verts. Auditer RAW + éditabilité. |
| « Le rendu dit que le seam/la primitive n'existe pas » | #341 : « attackEnv est le seul seam partagé » = FAUX (passiveMods existait) — la défense a été oubliée, trouvée par l'user. Contre-grep de 2 min. |
| « Documenter = résoudre » | #254 fermé sur traçabilité alors que le DoD exigeait un COMPORTEMENT. Relire le DoD mot à mot. |
| « L'audit adversarial, c'est quand on me le demande » | 2026-07-11 : juges lancés à la demande de l'user → 2 FRAGILES + 3 RÉFUTÉS sur 10. La passe est une ÉTAPE, pas un outil. |

## Red flags — STOP

- Je tape du code applicatif dans mon fil principal.
- Un dispatch dont l'effort n'est ni fixé (Workflow `effort`, définition d'agent) ni assumé
  sciemment comme hérité — un Agent `sonnet` en session à gros effort = Sonnet xhigh interdit.
- Deux workflows lourds lancés en parallèle.
- Lire ou tester les fichiers d'un agent background avant sa notification.
- Dire « vérifié » sans avoir moi-même relancé typecheck complet + suite complète.
- Annoncer des fermetures sans passe de réfutation NON demandée (étape 8).
- Accepter un « X est le seul mécanisme / ça n'existe pas » d'agent sans contre-grep.
- Un écart consigné dans un rendu qui ne devient pas un ticket dans le même tour.
