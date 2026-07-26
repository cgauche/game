---
name: feedback-brief-fait-autorite-grounding-seconde-main
description: Un brief d'orchestrateur fait AUTORITÉ — toute règle qu'il affirme porte sa citation verbatim, sinon un fait de seconde main devient une consigne puis un commentaire committé
metadata:
  type: feedback
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
