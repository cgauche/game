---
name: credo-exemples-calibrants
description: "Exemples concrets qui calibrent les principes du credo — fusion des 10 fiches redondantes, 2026-07-05"
metadata: 
  node_type: memory
  type: feedback
  originSessionId: 4e6c5100-25b0-4b77-aea8-b26dd13e5d75
---

Chaque section calibre un principe du credo (`.claude/credo.md`) avec un cas réel — pas de rappel du principe lui-même.

## Contenu de campagne = donnée éditeur, jamais code

En une session, l'utilisateur a corrigé trois fois le même réflexe : (1) j'avais ajouté `scenes?` à
l'interface `TestScenario` + modifié `launch()` pour supporter le multi-zones → REVERT (« tu hack » ;
l'éditeur savait déjà charger un projet multi-scènes via `loadProject([scene,...others], id)`) ;
(2) « le système de vague c'est un concept, pas une fonctionnalité » → pas de `WAVES.map()`, juste des
`encounters` + dialogue flag-gaté en données ; (3) le médecin « ce n'est PAS un PJ » et « si je lui donne
un nom + ses stats + son id, ça marche ? » → oui, nom/id viennent de l'ENTITÉ de scène (`entityId`), pas
codés en dur.

Cas jumeau (l'Arène, #3) : j'avais d'abord ajouté `Scene.arena` + Effets dédiés `arenaNextWave`/
`arenaWaveCleared` + état store `arena`. L'utilisateur : « Tu as créé des attributs spéciaux ? Y'a pas
déjà ce qu'il faut dans l'éditeur ? ». Tout abandonné : les vagues sont redevenues des `encounters`
(bestiaire par `ref`=`label`) avec butin (`giveMoney`/`giveXp`) + `setFlag arene_vN` dans leur `onVictory` ;
le maître d'arène une entité `personnage` avec `dialogueId`+`merchant` ; le séquençage des conditions de
dialogue gated par flags (pas de compteur en dur). Seule généralisation légitime issue de ce cas :
la Condition de drapeau accepte des flags combinés en ET (« v1,!v2 », nécessaire pour gater « vague N »
= `arene_v(N-1),!arene_vN`). Cette sémantique vit dans l'algèbre CLOSE de Conditions du moteur
(`src/engine/flowCore.ts` — `{kind:'flag'; expr}`, évaluée par `evalCondition`) : SOURCE UNIQUE pour le
combat comme pour le dialogue, jamais une copie par consommateur. L'arène vit en JSON pur
(`src/scenes/arene/arene-projet.json`), pas via un helper `arena()`.

## Zéro dette, zéro « hors scope »

Livraison #76 (bugs `[object Object]` de stats d'arme) : `TrappingData.reach: string|null` stockait en
réalité des NOMBRES pour la Portée des armes à distance — un type menteur. Je voulais différer la
normalisation data au motif « hors scope / éviter un conflit avec la session parallèle » → refusé.
Correction exigée dans le même lot : migrer la donnée, retyper, corriger TOUS les consommateurs (grep
exhaustif — le premier passage avait loupé `Number(t.reach)` dans `MerchantPanel`), poser un garde-fou
(test data) qui verrouille l'invariant. Verbatim : « Pas de dette technique, je n'aime pas les "hors
scope" ».

## Orchestrateur qui vérifie, supprime et refait plutôt que rapiécer

Contrat énoncé 2026-06-27 pour la campagne de nettoyage post-empilement de features : dispatcher des
agents codeurs (un par tâche, fichiers disjoints), TOUJOURS repasser derrière (typecheck + test +
`git diff` + agent de revue adversariale), ne rien croire (ticket/commentaires/agents/moi-même) et
préférer supprimer+refaire au rapiéçage — y compris pour les tests (les réécrire de zéro plutôt que les
travestir pour qu'ils passent). Piège vécu : un agent a écrit un fichier de test avec des guillemets
courbes (`' '`) → `tsc`/vitest cassent silencieusement dans le rapport de l'agent → toujours relancer les
gardes soi-même.

**Contre-exemple vécu (échec, 2026-06-29, chantier engins de siège)** : après avoir bien orchestré la
grosse feature (4 agents), j'ai dérivé vers du hand-coding sur tout ce qui « semblait petit » — correction
d'une regex, deux fix-ups (FU1/FU2), et un refacto entier (artkit + defs + gen-registry + réécriture de
`composeEngin`). Verdict : « tu es le pire orchestrator que je connaisse ». Leçon opérationnelle : même un
garde d'une ligne ou un refacto ciblé passe par un agent avec un spec précis ; le seul code que je tape
moi-même est l'intégration triviale et la vérification. Le grounding/lecture (cartographier avant de
spécifier) et les gardes restent miens.

## Réutiliser avant de réinventer

Verbatim (excédé) : « j'en ai vraiment ras le bol que tu réinventes l'existant inlassablement dès que je
fais un nouveau prompt ». Cas concret : j'ai écrit à la main un `PassiveModField` (gestion de liste
add/remove + sélecteur de kind) alors que `GameOpEditor` éditait DÉJÀ une liste de `GameOp[]` — exactement
ce qu'`EffectList` lui passe (`<GameOpEditor ops=… onChange=… />`). J'avais aussi itéré la représentation
de la donnée trois fois (typé → `PassiveMod[]` → `GameOp[]`) au lieu de cadrer la forme d'emblée en
s'alignant sur le patron existant (`Trauma.ops`). Règle dérivée sur le vocabulaire d'ops : ne pas multiplier
les mots-clefs quand un op existant + params fait l'affaire (ex. `movementHalved` → généralisé en
`moveScale`).

## Garde de resynchronisation = smell, collapser en une source de vérité

Quand j'ai proposé un garde defense-in-depth pour « ré-héberger » une `pendingFumble` orpheline
(soft-lock combat), l'utilisateur a coupé : « Qu'on ait besoin de faire ça, ça indique un problème dans
notre fonctionnement, non ? ». Cause réelle : deux sources de vérité pour la même chose —
`pendingFumble` (donnée top-level) et l'étape de cascade `{jet:'fumble'}` (l'hôte visible) ; le « fold »
avait unifié la MODALE mais pas l'ÉTAT, donc n'importe quel chemin fermant la cascade orphelinait
`pendingFumble` et `combatGate` gelait le tour à jamais. Fix : payload déplacé sur `CascadeStep.fumble`
(comme `deviation`/`bladeTrap`/`knockdown`), suppression de `pendingFumble` et de son entrée dans
`combatGate`.

Corollaire fonctionnement observé le même jour : plusieurs sessions Claude éditant le MÊME working tree
sur la MÊME zone (combat/cascade) = collisions réelles (`combatFlow.ts` changé sous l'Edit, 18 tests cast
cassés par un refacto `spellLabel` en parallèle, EOL flippés par un `git stash`) — pour un fix de race dans
du code en cours de réécriture ailleurs, coordonner ou attendre l'atterrissage.

## Ne jamais croire l'utilisateur sur parole

Généralisé le 2026-06-14 : « ne me crois jamais sur parole, tu as tout à fait le droit de vérifier ce que
je te dis ». Vérifié le jour même : « le bestiaire LDB = des sous-types » / « les nommés ont un title » →
confirmé en lisant `creatures.json` (58/62 LDB `title=null`+`optionals` ; nommés `title`+`skills`) — et
trouvé une divergence non dite (le critère réel est `title`/`optionals`, pas `source.book` ; l'apparence
est partiellement du CODE) → signalée sans corriger silencieusement.

Cadrage renforcé le 2026-06-25 : le critère est le RAW, jamais « ce que tu veux ». Il affirme « on peut
être plusieurs par poste » → relu MDG ch.14, confirmé et cité (l.9 « Plusieurs Personnages peuvent
contribuer à un même Test d'équipage » + l.15 Mousse fourre-tout) → implémenté parce que le RAW le dit,
pas parce qu'il l'a dit.

## Un commentaire qui cite le RAW reste suspect

En une seule session, trois commentaires « sourcés » se sont révélés faux, chacun rattrapé par
l'utilisateur (coût : revert + re-scope) :
- `crewMorale.ts` : « advances = différence RAW délibérée » → FAUX, le RAW (MDG 14 l.38-39) ne connaît
  que la compétence (`testValue`), pas les avances.
- `massBattle.ts` : « une Scène par PJ (l.116-118) » → FAUX, le texte réel (ADE II ch.8 l.116-118/153/
  157/163) dit des Scènes MULTI-PJ résolues en Soutien (« tous les Personnages engagés », « en soutien »,
  « contre les Personnages »).

Réflexe dérivé : dès qu'une décision (surtout de cardinalité/mécanique) repose sur « le RAW dit… »,
rouvrir le `.md` de `Source/` cité et lire les lignes — jamais se fier au commentaire ni à l'Atlas seul.

## Zéro rétro-compatibilité, briques solides

Plan rejeté parce qu'il s'appuyait sur des unions transitoires `(string | Ref)[]`, des normaliseurs
tolérant l'ancien format, des lookups dépréciés « gardés pour l'instant », et une « phase de retrait plus
tard ». Verbatim : « Pas de rétro-compatibilité, de deprecated, de code mort, de legacy, de dette
technique, je veux des briques solides pour pouvoir construire dessus. » Exemple de migration exigée
atomique : `TraitList = (string|TraitInstance)[]` → `TraitInstance[]` en un seul commit vert (bascule
type strict + script + tous les consommateurs + suppression de l'ancien chemin, tests migrés aux
fixtures du nouveau format sans tolérance string).

## Supprimer le legacy franchement, pas le neutraliser

Verbatim : « Pense a faire les choses bien mais surtout a netoyer/supprimer le legacy ». Étendu le
2026-06-13 : « pas de rétro-compatibilité, pas de code dupliqué, pas de legacy/deprecated » — en ajoutant
le tooltip Codex partout, RETRAIT des `title={entry.desc}` bruts (pas de doublon) ; en ajoutant le lore
aux Dieux, extension de `CultDef` plutôt qu'un `gods.json` concurrent du module `cults/`.

Cas emblématique : `slice-soldat.ts` était un PROTOTYPE (« archétype pour valider le facing avant la
génération d'art de masse ») qui court-circuitait l'art réel via `SLICE_TENUES` (career.ts) et
`SLICE_HEADS` (cosmetic.ts). Supprimé en entier ; la forme générique d'épée (`epee`, repli du Groupe
`base` et défaut final, `src/gameIso/rig/parts/equipment.ts`) est une def du registre d'armes comme les
autres. Retirer ce shadow a exposé l'art réel sous-jacent à auditer : le visage généré
`Humain:M` (heads.ts) avait un `</g>` en trop (XML invalide) masqué depuis toujours par le slice —
détecté via `scripts/_dbg-heads.mts` (vérifier l'équilibre des balises après tout dé-shadowing).

