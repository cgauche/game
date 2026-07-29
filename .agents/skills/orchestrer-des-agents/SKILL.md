---
name: orchestrer-des-agents
description: À utiliser dès qu'une tâche implique d'écrire ou modifier du code, de dispatcher un agent ou un workflow — ou dès qu'on est tenté de coder soi-même « parce que c'est petit ». Aussi au retour d'un agent (avant de vérifier/committer son travail) et avant tout agent() sans modèle/effort explicites.
---
<!-- GENERATED: agents:sync; source=.claude/skills/orchestrer-des-agents/SKILL.md -->

# Orchestrer des agents

**Je ne code pas — même le trivial.** Un guard d'une ligne, une regex, un refacto « couplé » →
un agent, avec un spec précis. Moi = décomposer, spécifier, vérifier, intégrer. Seul code de ma
main : l'intégration triviale et les gates. Violer la lettre de cette règle EST violer son esprit.

## Cycle

0. **Vague qui reprend des tickets « déjà livrés » → AUDIT DE DoD D'ABORD**, jamais à la fin.
   Un agent `juge` relit le DoD MOT À MOT et confronte chaque point au dépôt (preuve exigée par
   point). Vécu 2026-07-26 : 3 tickets crus livrés, **0 fermable** — et l'audit a révélé une
   dépendance dure jamais écrite (#733 bloque #734 : le seul déclencheur RAW des Marques est une
   table du delta non livré). Lancé en fin de vague, ce constat arrive après le travail ; lancé au
   début, il RÉORDONNE le travail.
1. **Grounding** — sweep de 3+ fichiers → agent Explore (régions + rapport). 1-2 lectures ciblées
   inline pour trancher = OK. La décision d'archi reste dans mon fil ; **primitives cibles NOMMÉES
   avant tout code** (table « Primitives partagées » du AGENTS.md, grep du concept en amont).
   ⚠ Mon grounding est bon en LARGEUR (inventaires, comptages, greps) et faible en PROFONDEUR sur le
   `Source/` : je mesure pour DÉCIDER, presque jamais pour AFFIRMER. Mesuré 2026-07-26 : 5 lectures
   directes du Source dans la session → **5 résultats décisifs** (un bug de règle du LDB vieux du
   projet, une asymétrie bonus/malus, une liste RAW fermée à tort, une dispense gatée par spec, une
   prémisse de brief invalidée). Aucune autre pratique n'a ce rendement — et je ne l'emploie que
   quand quelque chose cloche DÉJÀ.
2. **Brief d'agent** — un brief contient : périmètre de fichiers exact, primitives cibles nommées,
   réfs RAW nues (`LDB 13 l.142` — jamais paraphrasées), le chemin ABSOLU du worktree à utiliser
   tel quel, l'interdit de tout `git checkout/restore/reset/stash/add/commit`, et « ton rendu
   final = données brutes, pas un message ».
   **Un brief POSE des questions, il ne les pré-répond pas** : toute classification factuelle
   que l'agent peut établir lui-même (provenance LDB/supplément d'une règle, existence d'un
   consommateur, état d'un fichier) se demande en SORTIE du lot, citation exigée — jamais
   fournie en entrée SANS cette citation. Ce que la règle bannit, c'est la classification NON
   citée (une affirmation de mémoire) — jamais une citation verbatim ni une sortie de sonde déjà
   collées : une réf RAW nue, une phrase source collée, une ligne de `package.json` recopiée ou
   une sortie de commande sont VÉRIFIABLES par l'agent qui les reçoit, donc légitimes en entrée.
   Un brief qui affirme peut mentir ; un brief qui exige la provenance en sortie, ou colle sa
   preuve à côté, ne le peut pas (vécu 2026-07-26 : 3 règles du Livre de base classées
   « nouveautés du supplément » par des briefs qui pré-répondaient une question de provenance
   SANS citation).
   ⚠ **TOUTE affirmation de RÈGLE dans un brief porte sa CITATION VERBATIM, jamais ta reformulation.**
   Un brief n'est pas une note : il arrive à l'agent avec force de CONSIGNE, il ne se discute pas, et
   il finit recopié en commentaire dans le dépôt. Vécu 2026-07-26 : « un Rituel n'est pas un
   `SpellData` » (inféré d'un RENDU D'AGENT lu plus tôt, jamais vérifié) → l'agent l'applique, ouvre un
   dataset parallèle, et l'inscrit en commentaire en citant `VDM 02 l.379`… qui dit « **Ceci fonctionne
   comme pour les Sorts** ». Coller la phrase du livre EXIGE de l'ouvrir : c'est un déclencheur de
   lecture au moment du risque maximal. **Le grounding de SECONDE MAIN est le vrai danger** — un rendu
   d'agent n'est pas une source ; recyclé dans un brief, il gagne l'autorité qu'il n'a jamais eue.
   ⚠ **La règle est GÉNÉRALE : toute référence s'écrit DÉRÉFÉRENCÉE** — on n'écrit un pointeur
   qu'à côté de son contenu fraîchement récupéré, quel que soit son type. Un `#N` s'écrit avec
   son TITRE recollé depuis `gh issue view <N> --json title` au moment de l'écriture (8 renvois
   faux en une session, tous de mémoire). Une bibliothèque/API prescrite s'écrit avec la ligne
   réelle de `package.json` ou un import existant collé (une lib prescrite non installée a
   produit une évasion de garde par l'agent qui l'a reçue en consigne). Un « bloqué par
   <dépendance externe> » s'écrit avec la sonde d'absence collée (commande + sortie) — une
   affirmation d'ABSENCE se prouve par sonde positive de la chose absente (vécu 2026-07-26 :
   « attend la ré-extraction du PDF » répété toute une nuit ; le PDF était dans le dépôt, un
   glob de dix secondes le trouvait). La règle Source de ce paragraphe n'est que le cas
   particulier RAW de celle-ci.
   ⚠ **Cette même généralité vaut pour toute AFFIRMATION D'ABSENCE : elle porte sa SONDE ET son
   PÉRIMÈTRE énoncé.** « Aucun X » est irrecevable ; « aucun X dans tel périmètre, mesuré par
   telle commande » est une donnée. Sept erreurs de la même forme en une session, aucune un
   pointeur ni un blocage : « aucun consommateur ne lit `spec` » (sonde sur trois dossiers,
   conclusion universelle — il y en avait un), « aucune couture n'exprime le second jet » (sonde
   sur un seul livre — le mécanisme servait 13 fois), « 78 résolutions par libellé » (sonde
   incluant les fichiers de test — il y en avait 12), « 13 % de couverture JSDoc » (sonde exigeant
   un `*/` seul sur sa ligne — c'était 83 %). Corollaire, le plus coûteux : **une convergence entre
   deux mesures ne vaut vérification que si leurs MÉTHODES DIFFÈRENT** — deux sondes partageant le
   même angle mort se confirment mutuellement (vécu deux fois le même jour, dont une où un agent
   dépêché exprès a confirmé mon erreur avec la même sonde).
   **Brief UI** : nommer AUSSI la couche atomique — AUCUN élément nu (`<button>` → `.btn`/`.chip`/
   primitive ; conteneur de contenu → `.panel` ; focusable custom → style de focus maison) ; citer
   la table « Primitives partagées » + `docs/charte-ui.md`. Vécu 2026-07-12 (« c'est de la
   folie ») : le hub composait le squelette (ScreenShell/MasterDetail) mais des feuilles à la
   main → noir-sur-noir, lignes nues, focus UA. Cliquet #373 garde la classe.
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
   ⚠ Les portes machine sont un PLANCHER, jamais un signal de correction : sur une session
   mesurée, typecheck + suite complète ont attrapé 0 des 10 trouvailles (règle inversée, chemin
   absent, test menteur — toutes prises par sonde exécutée ou recette). « Portes vertes » ne se
   dit jamais « vérifié ». Et la classe « mécanique juste, chemin absent » (4 instances en une
   session) est invisible à tout instrument qui regarde le diff : **tout lot qui ajoute une
   donnée ou une mécanique NOMME sa PORTE** — le geste joueur ou le déclencheur qui l'atteint —
   dans son DoD, et la recette la traverse. Donnée écrite, non tirée = dette (garde
   `src/data/tables.test.ts` pour les tables d'effets).
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
   allégué = résultat fabriqué, vécu 2026-07-11). **Toute trouvaille de juge établie par une
   SONDE → la sonde est promue en test committé (durci) dans le commit de fix** — le jugement
   cesse d'être un consommable : 10 trouvailles sur 10 d'une session venaient de sondes, toutes
   jetées avec les transcripts. **Tout écart « consigné » dans un rendu
   devient un TICKET dans le même tour** — consigné-sans-ticket = backlog invisible = poison.
   **Et tout ce qu'un grounding/juge ÉTABLIT sur un ticket ouvert (prémisse corrigée, état
   mesuré, dépendance découverte) se COMMENTE sur le ticket dans le même tour** (credo :
   « un ticket porte ses dépendances et son état mesuré ») — le prochain agent lit l'issue,
   pas mes transcripts.
7. **Commit** — mes seuls fichiers par pathspec, jamais `--amend` en arbre partagé, git via
   l'outil PowerShell (RTK rend le Bash git lent/compressé).
8. **Fermeture (rituel OBLIGATOIRE — fermer a ses portes comme committer)** — toute vague qui
   ferme des tickets se termine par une **passe de réfutation NON demandée** (juges adversariaux,
   patron fini-vérifié : « tente de réfuter cette fermeture sur pièces ») AVANT toute annonce ;
   l'annonce porte les VERDICTS (TIENT/FRAGILE/RÉFUTÉ), jamais un score brut. Périmètre de la
   passe = les DÉCISIONS de la vague : fermetures, splits (leur prémisse est-elle vérifiée ?),
   claims d'agents, écarts consignés-non-ticketés, les ABSTENTIONS (tout ticket déclaré
   « bloqué / dépendance externe / hors de portée » pendant la vague — question inversée :
   « tente de prouver que le blocage n'existe pas » ; une sonde d'existence suffit, étage
   `verif-mecanique`, pas un juge), et MES PROPRES COMMITS (gates, hooks, glue d'intégration :
   le canal « trivial » est le seul que personne ne relit — c'est par lui que sont passées les
   demi-corrections de hooks et l'auto-autorisation de cliquet). Fermer sur « déjà implémenté » ou
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
| « Je le sais, pas besoin de rouvrir le Source pour l'écrire dans le brief » | 2026-07-26 : « un Rituel n'est pas un `SpellData` » venait d'un RENDU D'AGENT, pas du livre — qui dit « les Rituels **sont des Sorts** ». Un fait non vérifié devient une CONSIGNE, puis un commentaire committé avec une réf qui l'étaye à l'envers. |
| « Le cliquet est redescendu, donc ça progresse » | 2026-07-26 : obtenabilité 8→1 parce que le DÉTECTEUR s'est mis à scanner `tables.json` — les Talents sont déclarés obtenables via des tables que RIEN ne tire. Détecteur modifié dans le même commit que le chiffre ⇒ l'écrire, sinon le compteur ment. |
| « La garde est verte » | Elle ne mesure que SA COUVERTURE. 3 fois en une session : `wounds` ne scannait que `spells.json` (16 muets ailleurs, dont un bug de règle du LDB), la continuité de folio ignorait les FINS de chapitre (21 trous), `hardcode.mjs` n'a jamais scanné `src/ui` (14 sites). Toute garde DÉCLARE son périmètre mesuré ET son angle mort. |
| « Chaque lot est petit, testé, mutation-prouvé, jugé — donc je réponds bien » | 2026-07-29, flag user : « modifications trop basiques ». L'incrémental-vérifié sécurise chaque PAS, pas la DIRECTION : 3 passes de juge ont rustiné les symptômes (#939 : 22 flux en réussite gratuite, garde vacueuse) pendant que l'utilisateur voyait deux fois la cause (le socle qui délègue sa logique aux specs). Vague transversale ⇒ paragraphe de DESIGN dans mon fil (invariant, qui possède quoi, critère « N+1 = une ligne ») attaqué par un juge AVANT le premier codeur. Deux passes corrigeant la même classe = défaut de design, remonter d'un niveau. |
| « Mon diagnostic est solide, il passe en consigne » | 2026-07-28/29 : DEUX diagnostics d'orchestrateur réfutés dans la même vague — « le mémo court-circuite le mock » (aucun mémo sur le chemin : `vi.mock` + `isolate:false` = liaison par ORDRE de worker, sonde `callsAfter=0`) et « NBSP = typographie française voulue » (1 ligne sur 41 : artefact de collage). Les deux fois, c'est la clause « REPRODUIS d'abord / ne me crois pas » du brief qui a sauvé le lot : un diagnostic s'écrit en HYPOTHÈSE À RÉFUTER avec sa sonde discriminante, jamais en fait établi — et le fix que je prescris d'avance peut être faux aussi (le « clés uniques » ne marchait pas : mesuré, pas discuté). |
| « Ces leçons-là, je les applique, pas besoin de les écrire » | 2026-07-26, flag de l'user : **ma pratique meurt avec ma session**. Ce qui n'est pas dans ce skill / le credo / la mémoire n'existe pas pour l'orchestrateur de demain. |

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
- **J'écris une RÈGLE dans un brief sans coller la phrase du `Source/` à côté** — et pire, je la
  tiens d'un rendu d'agent que je n'ai jamais vérifié.
- Un pointeur écrit sans être déréférencé au moment de l'écriture — un `#N` sans son titre
  recollé de `gh issue view`, une lib prescrite sans sa ligne de `package.json`, un blocage
  externe déclaré sans sa sonde d'absence collée.
- Un cliquet qui descend dans le même commit que la modification de son détecteur, sans que le
  message ne dise lequel des deux a bougé.
- Une hausse de cliquet/baseline justifiée par une phrase du fichier lui-même sans en avoir
  vérifié l'ORIGINE — toute permission citée se `git blame` : si la phrase est plus jeune que le
  chantier qui s'en réclame, c'est une auto-autorisation (vécu 2026-07-26 : la justification
  citée avait été écrite la veille par le même chantier pour le relèvement précédent).
- Une garde neuve dont je ne sais pas énoncer l'angle mort.
- Une leçon de méthode que je « retiens » au lieu de l'écrire ici — la session suivante repart à zéro.
