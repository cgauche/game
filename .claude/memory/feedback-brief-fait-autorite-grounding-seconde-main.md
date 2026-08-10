---
name: feedback-brief-fait-autorite-grounding-seconde-main
description: "Un brief d'orchestrateur fait AUTORITÉ — toute règle qu'il affirme porte sa citation verbatim, sinon un fait de seconde main devient une consigne puis un commentaire committé"
metadata: 
  node_type: memory
  type: feedback
  originSessionId: 411c88e0-9fa2-4d10-a2f5-ee5cc57e7b0e
  modified: 2026-08-09T19:50:47.233Z
---

**Un brief n'est pas une note de travail : il arrive à l'agent avec force de CONSIGNE.** Il ne se
discute pas, il s'applique — et il finit recopié en commentaire dans le dépôt. Donc **toute
affirmation de RÈGLE dans un brief porte sa CITATION VERBATIM du `Source/`, jamais une
reformulation.**

**Le danger réel est le grounding de SECONDE MAIN.** Vécu 2026-07-26 (épique VDM) : j'ai écrit
« un Rituel n'est pas un `SpellData` » dans un brief. L'affirmation venait d'un **rendu d'agent**
lu plus tôt, trouvé plausible, jamais vérifié. L'agent l'a appliquée, a ouvert un dataset
parallèle, et l'a inscrite en commentaire **en citant `VDM 02 l.379`** — ligne qui dit
littéralement « **Ceci fonctionne comme pour les Sorts** », et `l.363` « les Rituels **sont des
Sorts** ». Trouvé par l'utilisateur, pas par les gardes.

La boucle : *agent → orchestrateur → brief → agent → commentaire committé*. À chaque passage
l'information gagne en autorité et perd sa source. À la fin, une paraphrase RAW **fausse** est dans
le dépôt, étayée par une réf qui dit l'inverse — le poison le plus durable, parce qu'il se relit
comme une vérité.

**Le volet CHIFFRES, mesuré le 2026-07-26 (chantier éditeur) : la même boucle vaut pour toute mesure,
pas seulement pour une règle RAW.** Trois briefs de la même journée ont porté des chiffres et des
inventaires recopiés d'un rendu d'agent précédent, et les trois ont été réfutés par leur exécutant :

| écrit dans mon brief | mesure de l'exécutant |
|---|---|
| « le rendu ne connaît les masses que par `buildRoofs` » | **6** sites de lecture (pignons, joints, ornements de faîte, libellés de pièce) — migrer le seul `roofs.ts` aurait créé une incohérence neuve |
| liste de symboles « supprimés » à réénoncer en interdit | `'trample'` (21 occ.), `colombage`, `wallFaces`, `BUILDINGS`, `builders/walls.ts` **vivants** ; `Roof.z` n'existe pas |
| « 63 cases bâties sans zone au rez » | **0 au rez, 119 à l'étage** |

Aucun de ces chiffres ne venait du dépôt : ils venaient de rendus que j'avais lus et relayés. Un
exécutant qui mesure les rattrape ; un exécutant qui obéit les grave dans le code. **Un chiffre dans un
brief se re-mesure au moment de l'écrire, ou se donne explicitement comme « à vérifier ».** Le coût est
d'une commande ; le coût de l'inverse est un lot entier bâti sur une prémisse fausse.

**Le volet NÉGATION, mesuré le 2026-07-26 quelques heures APRÈS l'écriture de cette fiche — elle n'a
pas prévenu sa propre récidive.** Un lecteur avait rendu, pour les pierres de pouvoir de VDM :
« **ABSENTE** (dupliquée en PROSE dans 8 fiches `spells.json`) » — dans une colonne dont l'en-tête était
*« Curée dans `tables.json` ? »*. J'ai écrit dans le brief suivant : « **aucun objet n'existe en
donnée** ». Les 8 pierres existaient, avec leur `desc` verbatim et leur folio juste ; et les 8 fiches
de prose dupliquée n'existaient pas non plus.

**Un constat négatif porte son PÉRIMÈTRE ; lui retirer son périmètre l'inverse.** « Absent de
`tables.json` » et « n'existe pas » sont deux phrases opposées, et la seconde s'obtient sans
mentir en oubliant trois mots. C'est plus vicieux que la paraphrase RAW : la phrase n'a pas été
déformée, elle a été **désancrée**, et rien dans sa forme ne signale la perte. Un brief qui dit
« X n'existe pas » envoie un agent CRÉER un doublon.

**Règle** : tout « n'existe pas / il n'y a aucun / rien ne fait X » écrit dans un brief se re-mesure
au dépôt à l'instant de l'écrire, ou se cite avec son périmètre littéral (« le lecteur n'a pas trouvé
d'entrée dans `tables.json` »). Ne jamais promouvoir une absence locale en absence générale — c'est
le même défaut de classe que [[feedback-un-detecteur-ne-mesure-que-sa-couverture]], appliqué à moi.

**Le volet ÉTIQUETTE, mesuré le 2026-08-09 (#1117 L2bis) — une partition ne se nomme jamais par sa
population TYPIQUE.** Le prédicat réel du lot L2 était `humanControlled` (possession + cadence
manuelle) ; mes notes l'avaient étiqueté « humains en bande / ennemis inline » — vrai dans la
configuration par défaut, faux sur l'axe qui compte (contrôle des ennemis en solo : `gmSeat` posé →
l'ennemi piloté remonte en bande). J'ai répondu à l'utilisateur depuis l'étiquette (« pas de modale
pour eux ») ET écrit le brief suivant avec — l'utilisateur a attrapé la phrase, le code était juste,
le brief serait devenu un branchement par camp. **Une étiquette qui décrit l'extension typique d'un
prédicat efface l'axe du prédicat** (camp ⇒ surface au lieu de possession ⇒ surface) ; le moment où
elle repart en aval (réponse d'autorité, brief) est le moment où on repasse du label au symbole.

**Why:** mes erreurs ne sont presque jamais dans le code (les agents l'écrivent) — elles sont dans
les **faits que j'affirme sans vérifier**. Je fais du grounding pour DÉCIDER, presque jamais pour
AFFIRMER. Mesuré le même jour : 5 lectures directes du `Source/` → **5 résultats décisifs** (bug de
règle du LDB vieux du projet, asymétrie bonus/malus des robes, liste RAW fermée à tort par le
catalogue, dispense gatée par spécialisation, prémisse de brief invalidée). Aucune autre pratique
n'a ce rendement, et je ne l'emploie que quand quelque chose cloche déjà.

**How to apply:** avant d'écrire une règle dans un brief, ouvrir le `Source/` et **coller la
phrase**. Coller EXIGE d'ouvrir : c'est un déclencheur de lecture au moment du risque maximal. Un
rendu d'agent, un commentaire de code, un ticket ou ma propre mémoire ne sont **pas** des sources.
Corollaire côté agents (appliqué dans `.claude/agents/codeur.md` et `juge.md`) : le codeur vérifie
au Source toute règle affirmée par son brief AVANT d'écrire ; le juge juge la **prémisse** en plus
du diff, et **exécute une sonde** plutôt que de raisonner sur du code.

Voir [[feedback-verifier-les-claims-architecturaux-des-agents]],
[[feedback-arbitrage-agent-source-en-main]], [[feedback-un-detecteur-ne-mesure-que-sa-couverture]],
[[game-doc-derivee-jamais-ecrite-a-la-main]].
