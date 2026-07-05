# Arbitrage des commentaires-excuses — audit du 2026-07-05 (ARTEFACT DATÉ)

> 52 commentaires qui JUSTIFIENT une exception, une migration partielle ou une déviation RAW,
> extraits de l'audit anti-poison (`2026-07-05-audit-poison.md`), chacun vérifié adversarialement.
> Règle du credo : une exception sans validation utilisateur traçable = dette signalée.
> **Pour chaque entrée : verdict utilisateur requis** — ✅ légitime (documenter comme décision) ou ❌ dette (issue/chantier).

> ## ⚖️ VERDICTS RENDUS (utilisateur, 2026-07-05)
> - **Thème A** (silences du RAW comblés : n° 2, 5, 12, 19, 21, 25, 26, 34, 39, 50, 51, 52) : ✅ légitime sur le fond,
>   MAIS migration en donnée éditable taguée `maison` → **issue-chantier #133**.
> - **Thème B** (renvoi au MJ arbitré : n° 3, 16, 44) : ✅ légitime, entériné. **Exception n° 47** (prêtre de Manann
>   auto-payé) : ❌ → choix joueur, **issue #132**.
> - **Thème C** (règles RAW simplifiées/omises : n° 1, 6, 7, 10, 13, 14, 15, 17, 30, 31, 33, 35, 40-43, 45, 46) :
>   ❌ dette → **issues #113–#125**.
> - **Thème D** (triches IA/lacunes : n° 28, 29, 36, 38, 48, 49) : ❌ dette → **issues #126–#131** (priorité #126 : Recharge ennemie).
> - **Thème E** (nettoyages : n° 8, 27, 37) : à faire au fil de l'eau par l'orchestrateur (pas d'issue).
> - N° 4, 9, 11, 18, 20, 32 (design assumé) : ✅ entérinés. N° 22-24 (trauma.ts, extraction vide) : à relire manuellement.
>
> **Doctrine (précisée par l'utilisateur, 2026-07-05)** — house-rule ≠ lacune : (1) RAW silencieux / fourchette /
> renvoi au MJ → on propose, valeur maison PARAMÉTRABLE en donnée ; (2) mécanique RAW qu'on ne sait pas modéliser
> → « à notre sauce » n'est PAS une réponse acceptable : dette d'implémentation, on implémente ce qui manque.
> Le thème A relève du cas 1 (à re-vérifier entrée par entrée en traitant #133) ; les thèmes C/D relèvent du cas 2.

## 1. `src/engine/aaCritical.ts:13` — sévérité basse

**Quote** : `desc` = « Effets supplémentaires » VERBATIM : les sous-effets conditionnels (durées, « membre inutilisable 1d10 Rounds », amputations page 180) y restent, arbitrés — rien n'est inventé.
**Ce qu'il excuse** : Les sous-effets conditionnels/durées du texte AA (« Effets supplémentaires ») ne sont pas mécanisés, seulement affichés pour arbitrage.
**Réalité/contexte** : Confirme la même implémentation partielle que `combat-aa-blessures` dans policy.ts (même dette, autre fichier) — recensée séparément car c'est un commentaire distinct qui justifie l'absence de mécanisation.
**Traitement suggéré par l'audit** : Regrouper cette justification avec celle de policy.ts si un futur ticket mécanise ces sous-effets ; sinon aucun changement.
**Verdict utilisateur** : ☐ légitime  ☐ dette

## 2. `src/engine/activities.ts:531` — sévérité basse

**Quote** : Disponibilité ND/absente (objet jamais en vente) → Rare prudent (arbitrage documenté).
**Ce qu'il excuse** : Arbitrage maison assumé pour combler un silence du RAW sur la Disponibilité d'un objet non chiffré.
**Réalité/contexte** : Écart RAW non couvert par une règle citée — laissé en 'arbitrage documenté' sans validation traçable par l'utilisateur.
**Traitement suggéré par l'audit** : Faire trancher/valider explicitement cet arbitrage par l'utilisateur, ou le retirer si non nécessaire.
**Verdict utilisateur** : ☐ légitime  ☐ dette

## 3. `src/engine/activities.ts:567` — sévérité basse

**Quote** : L'adéquation du Métier à l'objet est laissée au MJ par le canon — jeu sans MJ : catalogue non restreint (le Métier reste requis), arbitrage documenté.
**Ce qu'il excuse** : Déviation assumée du RAW (le canon renvoie au MJ) comblée par un choix d'implémentation 'jeu sans MJ'.
**Réalité/contexte** : Le RAW délègue explicitement au MJ une vérification que le jeu, sans MJ, ne fait pas — remplacé par un catalogue non filtré, documenté comme tel mais non validé par l'utilisateur.
**Traitement suggéré par l'audit** : Faire arbitrer explicitement par l'utilisateur si le catalogue doit rester non filtré.
**Verdict utilisateur** : ☐ légitime  ☐ dette

## 4. `src/engine/advantagePool.ts:115` — sévérité basse

**Quote** : if (allies === foes) return { dominant: null }; // égalité → arbitrage tactique du MJ, non modélisé
**Ce qu'il excuse** : En cas d'égalité de combattants entre les deux camps, aucun transfert d'Avantage n'a lieu (le critère « avantage tactique » du RAW n'est pas modélisé).
**Réalité/contexte** : AA l.4146 (PERDRE UN AVANTAGE) : « Si le nombre de combattants des deux camps est identique, désignez comme dominant le camp qui détient l'avantage tactique, par exemple qui se trouve en position surélevée ou qui encercle ses adversaires. » Le RAW prévoit un critère de départage (position/encerclement) que le moteur n'implémente pas, se contentant de ne rien transférer — déviation assumée et documentée.
**Traitement suggéré par l'audit** : Si un signal de position/encerclement existe côté state, l'utiliser pour départager l'égalité ; sinon laisser le no-op documenté tel quel.
**Verdict utilisateur** : ☐ légitime  ☐ dette

## 5. `src/engine/careerSlots.ts:12` — sévérité basse

**Quote** : Modèle des emplacements « (Au choix) » (RAW + arbitrage table là où le livre est muet) :
**Ce qu'il excuse** : Le modèle des emplacements combine RAW et un arbitrage maison pour les zones où le livre ne tranche pas.
**Réalité/contexte** : Arbitrage assumé (silence du RAW) — dette de conception non tracée comme décision utilisateur explicite.
**Traitement suggéré par l'audit** : Documenter la décision d'arbitrage comme validée par l'utilisateur ou la faire trancher.
**Verdict utilisateur** : ☐ légitime  ☐ dette

## 6. `src/engine/combat.ts:690` — sévérité basse

**Quote** : Le jet brut est conservé pour la Localisation et l'Atout Empaleuse (le tireur peut la choisir, non modélisé).
**Ce qu'il excuse** : Contre une cible Inconsciente, le RAW (« Je ne faillirai pas ! », LDB 17 l.73) permettrait normalement à l'attaquant de CHOISIR la Localisation touchée (comme pour tout résultat forcé) ; le code documente que ce choix n'est pas modélisé — la localisation reste tirée au hasard depuis le jet brut.
**Réalité/contexte** : Le code applique `helplessTest` (succès + Critique forcés) mais laisse la Localisation dépendre du jet inversé normal (`hitLocationByShape(reverseRoll(atkBd.roll)...)`), sans offrir de sélection de Localisation au joueur malgré la note du commentaire.
**Traitement suggéré par l'audit** : Si le choix de Localisation contre une cible Inconsciente doit rester non-joueur pour l'instant, garder la note ; sinon exposer un picker de Localisation comme pour `critLocation` (« Je ne faillirai pas ! »).
**Verdict utilisateur** : ☐ légitime  ☐ dette

## 7. `src/engine/combatFeatures/types.ts:117` — sévérité moyenne

**Quote** : Le Test de Calme Accessible (+20) d'activation est supposé réussi (simplification documentée).
**Ce qu'il excuse** : Sans Peur (LDB 10 l.859) est implémenté comme immunité inconditionnelle, sans le Test de Calme Accessible (+20) requis par le RAW.
**Réalité/contexte** : LDB 10 (Talents) l.1049 : « Avec un seul Test de Calme Accessible (+20), vous pouvez ignorer les effets... ». Le RAW exige un jet ; l'implémentation le saute (fearImmune inconditionnel) — écart assumé et documenté comme tel, mais jamais arbitré.
**Traitement suggéré par l'audit** : Statuer : soit modéliser le Test de Calme (jet réel), soit acter formellement l'exception RAW dans un registre de dérogations validées.
**Verdict utilisateur** : ☐ légitime  ☐ dette

## 8. `src/engine/conditions.ts:524` — sévérité basse

**Quote** : (`_rng` réservé pour de futurs Tests ; non utilisé ici.)
**Ce qu'il excuse** : Le paramètre `_rng` de `tickDeath` est gardé pour un usage futur non encore implémenté.
**Réalité/contexte** : Paramètre effectivement inutilisé dans le corps de la fonction (aucun jet dans `tickDeath`) — dette de signature non exploitée, à signaler pour arbitrage (soit retirer le paramètre, soit motiver un ticket concret).
**Traitement suggéré par l'audit** : Soit retirer le paramètre `_rng` tant qu'aucun Test n'y a recours, soit ouvrir explicitement le ticket qui le consommera.
**Verdict utilisateur** : ☐ légitime  ☐ dette

## 9. `src/engine/critical.ts:23` — sévérité basse

**Quote** : hypothèse de jeu : **tout le monde est DROITIER** (main principale = brasD).
**Ce qu'il excuse** : Le moteur suppose que tous les personnages sont droitiers pour déterminer la main principale.
**Réalité/contexte** : Déviation RAW assumée et documentée (pas de règle de latéralité par personnage dans LDB 18) — recensée en tant qu'exception non tracée/validée, indépendamment du bug de gating ci-dessus qu'elle alimente.
**Traitement suggéré par l'audit** : Si jugé important, exposer la latéralité comme trait de personnage plutôt qu'une constante ; sinon assumer explicitement en commentaire de portée (déjà fait) et laisser tel quel.
**Verdict utilisateur** : ☐ légitime  ☐ dette

## 10. `src/engine/disease.ts:108` — sévérité basse

**Quote** : Bénédiction de Convalescence reçue (LDB 41 : « une fois par maladie et par personne ») — approximation : une fois par maladie.
**Ce qu'il excuse** : L'implémentation ne trackerait qu'« une fois par maladie », en simplification/approximation de la règle RAW « une fois par maladie ET par personne ».
**Réalité/contexte** : Le champ `convalescenceBlessed` vit sur l'instance `Disease` elle-même, laquelle appartient déjà à UN SEUL `Combatant` (`c.diseases`). Traquer « une fois par instance de maladie » EST déjà équivalent à « une fois par maladie et par personne » (LDB 41 l.83 : « Cette Prière ne peut être tentée qu'une fois par maladie et par personne. ») — il n'y a pas d'approximation, le commentaire sous-estime à tort la fidélité de son propre code.
**Traitement suggéré par l'audit** : Retirer la mention « approximation » — la donnée par-instance couvre déjà exactement la règle « par maladie et par personne ».
**Verdict utilisateur** : ☐ légitime  ☐ dette

## 11. `src/engine/domainAttributes.ts:29` — sévérité basse

**Quote** : Choix jeu-sans-MJ (documentés) : les « vous pouvez » offensifs (Feu/Lumière/Mort) ne sont appliqués qu'aux cibles ADVERSES (un lanceur rationnel n'enflamme pas ses alliés) ; le +10 « environnement rural » de la Vie n'est pas câblé (pas de classification de scène) ; l'armure PLATE d'un statblock (matière inconnue) compte comme NON-métal et NON-magique.
**Ce qu'il excuse** : Trois déviations du RAW (LDB 48) sont assumées : les riders offensifs des Domaines Feu/Lumière/Mort (« vous pouvez infliger... ») ne s'appliquent qu'aux cibles adverses, le bonus d'environnement rural de la Vie (+10 Incantation/Focalisation, l.574) n'est jamais appliqué faute de classification de scène, et l'armure Plate de statblock est traitée comme non-métallique/non-magique par défaut.
**Réalité/contexte** : Le RAW (LDB 48) ne restreint pas le rider à une cible « adverse » — c'est le lanceur qui choisit la cible du Sort ; et le bonus d'environnement rural de la Vie est une règle chiffrée du livre qui n'est jamais appliquée dans le jeu tant que `Scene.environment` ne porte pas de valeur reconnue.
**Traitement suggéré par l'audit** : Si ces trois écarts restent des choix de conception assumés, les garder documentés tels quels (déjà fait) — sinon câbler `environmentBonus` sur une vraie classification de Scène rurale/sauvage.
**Verdict utilisateur** : ☐ légitime  ☐ dette

## 12. `src/engine/exposure.ts:10` — sévérité basse

**Quote** : sans bon Manteau, pénalité au Test de Froid (ch.66 l.46 — non chiffrée dans le canon : application déclarée −10).
**Ce qu'il excuse** : Le canon ne chiffre pas la pénalité sans manteau ; le code invente −10.
**Réalité/contexte** : Confirmé par le RAW lui-même (« vous recevrez des pénalités » sans valeur), donc le −10 est une valeur maison non sourcée — assumption transparente mais non validée par une règle citable.
**Traitement suggéré par l'audit** : Si la valeur −10 est arbitrée par la table, la documenter comme règle maison explicite (pas comme lecture RAW) ou la faire trancher/valider une bonne fois.
**Verdict utilisateur** : ☐ légitime  ☐ dette

## 13. `src/engine/exposure.ts:16` — sévérité basse

**Quote** : (« Vous débarrasser d'une Possession lourde annule 1 Test échoué » : choix interactif non simulé au niveau agrégé — décision documentée.)
**Ce qu'il excuse** : Une règle RAW existante (annulation d'un Test échoué en se débarrassant d'une possession lourde, LDB 18 l.330) est délibérément non implémentée.
**Réalité/contexte** : Le code n'offre aucun mécanisme pour ce choix interactif ; c'est un trou RAW assumé, jamais arbitré par l'utilisateur.
**Traitement suggéré par l'audit** : Lister ce trou dans le backlog RAW pour arbitrage explicite plutôt que le laisser en commentaire silencieux.
**Verdict utilisateur** : ☐ légitime  ☐ dette

## 14. `src/engine/exposure.ts:18` — sévérité basse

**Quote** : Applications déclarées (le canon ne chiffre pas le sommeil dehors) :  *  - une NUIT (~8 h) en environnement difficile = 2 Tests (1/4 h) ; extrême = 4 Tests (1/2 h) ;  *  - un ABRI (Tente, ch.74 — ou abri construit, Survie en extérieur ch.09 l.559) ANNULE  *    l'Exposition d'une nuit difficile, et ramène une nuit extrême au rythme difficile (2 Tests) ;  *  - les pénalités d'Exposition se dissipent après 24 h (purge d'horloge #T3) ;
**Ce qu'il excuse** : Cadence des Tests de nuit, effet d'annulation de la Tente, et dissipation à 24 h sont présentés comme des applications du RAW.
**Réalité/contexte** : Aucune de ces trois valeurs n'est dans LDB 18 (qui ne traite que la cadence 2h/4h en environnement difficile/extrême sans référence au sommeil, à la tente ou à une dissipation à durée fixe) ni dans la description de la Tente (LDB 74 l.62, qui ne mentionne aucun effet sur l'Exposition). Ce sont des règles maison assumées en bloc.
**Traitement suggéré par l'audit** : Marquer ce bloc comme règle maison (pas RAW) ou faire trancher/valider chaque point par l'utilisateur.
**Verdict utilisateur** : ☐ légitime  ☐ dette

## 15. `src/engine/items.ts:414` — sévérité moyenne

**Quote** : L'arme DIRECTRICE est conservée tant qu'il reste une main (adaptation — le −20 CC/CT de l'amputation s'applique déjà via la séquelle) ;
**Ce qu'il excuse** : Garder l'arme directrice tenue avec la main restante après amputation est une « adaptation » (déviation assumée du RAW), justifiée par le fait que la pénalité est déjà appliquée ailleurs.
**Réalité/contexte** : Le mot « adaptation » signale une décision de design non tracée comme choix validé — dette d'arbitrage utilisateur potentielle sur une mécanique de combat active (traumatisme LDB 18).
**Traitement suggéré par l'audit** : Si le choix est validé RAW/maison, le dire explicitement (« choix de design validé, pas une adaptation ») ; sinon faire trancher la règle par l'utilisateur.
**Verdict utilisateur** : ☐ légitime  ☐ dette

## 16. `src/engine/landCargo.ts:144` — sévérité basse

**Quote** : magnitude/direction arbitrées, laissées au MJ par le RAW). PUR. */
**Ce qu'il excuse** : Le RAW (T2C ch.11 l.95) laisse au MJ la magnitude et la direction de la fausse indication de qualité du Vin sur un échec d'Évaluation ; le code fige un choix (décalage de |DR| échelons, plafonné puis inversé) non spécifié par le livre.
**Réalité/contexte** : Confirmé : le texte source dit seulement « donnez-lui une fausse indication dont l'inexactitude est en rapport avec son degré d'échec », sans mécanique précise — le commentaire le signale honnêtement, mais c'est une implémentation d'auteur substituée à une décision de MJ, à valider explicitement.
**Traitement suggéré par l'audit** : Rien à corriger dans le code (choix assumé et signalé) — à faire valider par l'utilisateur comme convention de jeu si ce n'est pas déjà acté.
**Verdict utilisateur** : ☐ légitime  ☐ dette

## 17. `src/engine/policy.ts:209` — sévérité moyenne

**Quote** : Les sous-effets conditionnels/durées des lignes AA restent en texte (arbitrage), le corps mécanique (Blessures + États immédiats + Mort) est appliqué.
**Ce qu'il excuse** : La variante Aux Armes des Blessures/Critiques n'implémente que le « corps mécanique » ; les effets conditionnels/durées textuels de la table AA restent à l'arbitrage humain.
**Réalité/contexte** : Déviation RAW assumée et documentée (implémentation partielle de la table AA) — dette signalée mais non tracée/validée formellement.
**Traitement suggéré par l'audit** : Si acceptée, transformer les sous-effets récurrents (ex. durée d'un membre inutilisable) en `GameOp`/`Condition` structurés plutôt que du texte arbitré, ou documenter explicitement la liste des lignes AA concernées.
**Verdict utilisateur** : ☐ légitime  ☐ dette

## 18. `src/engine/policy.ts:358` — sévérité basse

**Quote** : Simplification LDB 59 l.9-11 : un objet coûtant au plus votre niveau de Statut (Bronze N = N sous, Argent N = N pistoles, Or N = N couronnes) s'achète sans compter les pièces ; au-delà, un seul achat par jour via un Test de Marchandage.
**Ce qu'il excuse** : Règle optionnelle qui simplifie explicitement le comptage RAW des pièces lors des achats sous le niveau de Statut.
**Réalité/contexte** : Simplification assumée et signalée comme telle (flag optionnel désactivé par défaut) — recensée en tant qu'écart RAW documenté.
**Traitement suggéré par l'audit** : Aucun changement requis si le flag reste optionnel et désactivé par défaut (RAW strict conservé) ; garder la note explicite.
**Verdict utilisateur** : ☐ légitime  ☐ dette

## 19. `src/engine/seaWeather.ts:170` — sévérité basse

**Quote** : sinon le régime de bord « 2 à 3 litres d'eau par jour » (MDG ch.14 l.242, borne haute retenue : choix documenté). PUR.
**Ce qu'il excuse** : Le choix de retenir 3 L (borne haute de la fourchette RAW 2-3 L) comme valeur par défaut est présenté comme un arbitrage documenté.
**Réalité/contexte** : MDG 14 l.242 donne une fourchette (« 2 à 3 litres »), pas une valeur unique ; le code choisit arbitrairement la borne haute sans que ce choix soit validé par l'utilisateur.
**Traitement suggéré par l'audit** : Faire trancher/valider le choix de la borne (haute vs basse vs aléatoire) plutôt que de le figer silencieusement dans le code.
**Verdict utilisateur** : ☐ légitime  ☐ dette

## 20. `src/engine/seaWeather.ts:176` — sévérité basse

**Quote** : Le jour de voyage ne se simule pas heure par heure : la période EXPOSÉE sur le pont = UNE Période de travail à la voile (8 h, l.107) → 8 ÷ cadence Tests par jour (bandes 4 h → 2 Tests ; bandes 2 h → 4 — mêmes comptes que la nuit dehors d'`exposureNight` : difficile 2 / extrême 4).
**Ce qu'il excuse** : Une journée de mer applique la cadence de Tests (toutes les 2h/4h) sur une base d'exposition de 8h plutôt que 24h.
**Réalité/contexte** : MDG 13 l.209-225 ne restreint pas la cadence des Tests à une « période de travail » de 8h — le texte dit « toutes les deux/quatre heures » sans borner à la journée de travail ; réduire la fenêtre à 8h est un choix de modélisation qui divise par 3 le nombre de Tests réellement dus sur 24h en mer.
**Traitement suggéré par l'audit** : Marquer explicitement ce choix comme non-RAW (réduction délibérée du nombre de Tests/jour) et le faire valider par l'utilisateur.
**Verdict utilisateur** : ☐ légitime  ☐ dette

## 21. `src/engine/suffocation.ts:28` — sévérité basse

**Quote** : Durée d'un Round de combat en secondes, DÉRIVÉE du canon (LDB 18 : BE×10 s de souffle ↔ BE Rounds de survie inconscient) → 1 Round ≈ 10 s. Utilisée pour décompter la rétention de souffle.
**Ce qu'il excuse** : Le canon fixerait implicitement 1 Round ≈ 10 secondes.
**Réalité/contexte** : LDB 18 l.346 ne dit jamais explicitement qu'un Round dure 10 secondes ; c'est une déduction du code (BE×10 s ↔ BE Rounds), présentée comme une certitude RAW alors que c'est une extrapolation.
**Traitement suggéré par l'audit** : Reformuler en « hypothèse de calibrage (non RAW) » plutôt qu'en dérivation présentée comme certaine.
**Verdict utilisateur** : ☐ légitime  ☐ dette

## 22. `src/engine/trauma.ts:8` — sévérité basse

**Quote** : Bras/Tête et Amputations : effet de combat journalisé (latéralité non modélisée ; amputation = post-combat/Chirurgie → Jalon 5).
**Ce qu'il excuse** : 
**Réalité/contexte** : Reconnaît une portion du système (latéralité de certains traumas Bras/Tête) non modélisée, renvoyée à un jalon futur (« Jalon 5 ») — dette de fidélité RAW non arbitrée.
**Traitement suggéré par l'audit** : Suivre ce backlog explicitement (ticket Jalon 5) plutôt que de le laisser dormir dans un commentaire de module.
**Verdict utilisateur** : ☐ légitime  ☐ dette

## 23. `src/engine/trauma.ts:280` — sévérité basse

**Quote** : Surdité (−20 Perception auditive, approximée à toute la Perception).
**Ce qu'il excuse** : 
**Réalité/contexte** : Approximation assumée et signalée : le RAW (LDB 18 « Oreille ») ne parle que des Tests « ayant un rapport avec l'audition », que le code élargit à toute la compétence Perception sans distinguo ouïe/vue. Dette de fidélité non tranchée par l'utilisateur.
**Traitement suggéré par l'audit** : Si un jour les Tests de Perception se scindent par sens (vue/ouïe/odorat), retirer l'approximation ; sinon garder tel quel en assumant explicitement le choix.
**Verdict utilisateur** : ☐ légitime  ☐ dette

## 24. `src/engine/trauma.ts:357` — sévérité basse

**Quote** : La déchirure majeure n'est PAS accélérée (l.326 : la Guérison ne fait qu'informer — laissé en dette).
**Ce qu'il excuse** : 
**Réalité/contexte** : Dette explicitement reconnue : le module admet ne pas implémenter l'effet potentiel de la Guérison sur une déchirure majeure faute de règle RAW claire à câbler.
**Traitement suggéré par l'audit** : Statuer (avec l'utilisateur) si la Guérison doit avoir un effet sur la déchirure majeure, sinon documenter que RAW ne prévoit rien de plus et retirer la mention de dette.
**Verdict utilisateur** : ☐ légitime  ☐ dette

## 25. `src/engine/travel.ts:73` — sévérité basse

**Quote** : /** Plafond de marche forcée (heures/jour) — canon muet, paramétrable. */
**Ce qu'il excuse** : Le RAW ne fixe aucune limite au nombre d'heures de marche forcée par jour ; la valeur (10 h) est un choix d'auteur.
**Réalité/contexte** : Confirmé par lecture de la section « Temps de voyage » (Source/Warhammer v4 - Livre de base version corrigée/51 - Magie du Chaos.md l.191-197) : le RAW ne parle que des 6 h sans Test et de la marche forcée en général, sans plafond chiffré — le commentaire signale honnêtement une valeur maison, mais c'est une déviation RAW non tranchée qui mérite arbitrage utilisateur plutôt qu'un simple paramétrage silencieux.
**Traitement suggéré par l'audit** : Confirmer avec l'utilisateur si 10h/jour est la valeur maison retenue pour la table, ou la documenter comme choix de MJ dans docs/raw plutôt qu'en simple commentaire de code.
**Verdict utilisateur** : ☐ légitime  ☐ dette

## 26. `src/engine/travelStages.ts:105` — sévérité moyenne

**Quote** : Paliers : ≤ ~25 km (village proche) = 1 ; jusqu'à ~150 km (ville à ville) = 2-4 ; au-delà, +1 par tranche de 50 km. Choix documenté — le canon ne chiffre pas la distance (l.32 « les cartes de l'Empire sont notoirement imprécises »).
**Ce qu'il excuse** : stageCount() dérive le nombre d'Étapes d'un trajet à partir d'une distance en km via des paliers inventés, en le justifiant comme "choix documenté" faute de formule RAW chiffrée.
**Réalité/contexte** : Le RAW (EDOC ch.5 l.25) ne se contente pas de laisser le nombre d'Étapes "à la discrétion du MJ" sans le chiffrer : il donne un mécanisme concret que le code omet totalement — le nombre d'Étapes est modifié par le score de Mouvement le plus faible du groupe (≤3 → +1 ou +2 Étapes ; toutes montures M≥6 → nombre d'Étapes divisé par deux, minimum 1). stageCount() ne prend aucun paramètre de Mouvement du groupe et remplace ce mécanisme RAW par une grille distance→étapes inventée.
**Traitement suggéré par l'audit** : Soit assumer clairement (et documenter) que le modificateur RAW par Mouvement du groupe est un manque connu à combler, soit l'implémenter dans stageCount (paramètre optionnel de Mouvement minimal du groupe).
**Verdict utilisateur** : ☐ légitime  ☐ dette

## 27. `src/engine/types.ts:638` — sévérité basse

**Quote** : (Fausse jambe : « ignorer 1 Point de Mouvement perdu » — l'Esquive demande 200 PX, non modélisé).
**Ce qu'il excuse** : La récupération complète de l'Esquive après amputation (coût 200 PX) via prothèse entraînée n'est pas modélisée dans le moteur.
**Réalité/contexte** : Trou de couverture RAW signalé par l'auteur du code lui-même, jamais comblé ni arbitré — dette non traçée ailleurs.
**Traitement suggéré par l'audit** : Ouvrir un ticket dédié pour modéliser le rachat d'Esquive (200 PX) ou documenter explicitement le choix de ne pas le faire dans un registre de dérogations.
**Verdict utilisateur** : ☐ légitime  ☐ dette

## 28. `src/state/ai.ts:268` — sévérité basse

**Quote** : // DIFFÉRENCE MINIMALE DÉFENDABLE (faute d'un signal de charge initiale d'embuscade) — signalée au rapport.
**Ce qu'il excuse** : La doctrine « embuscade » ne peut être sélectionnée automatiquement faute d'un signal fiable de charge d'embuscade ; elle ne se distingue de « meute » que par des poids, ce qui est reconnu comme une approximation faible.
**Réalité/contexte** : Compromis d'implémentation explicitement signalé comme faible par l'auteur du code lui-même — dette de conception non tranchée.
**Traitement suggéré par l'audit** : Trancher : soit ajouter un vrai signal de charge d'embuscade (flag de scène/furtivité), soit fusionner la doctrine avec « meute ».
**Verdict utilisateur** : ☐ légitime  ☐ dette

## 29. `src/state/ai.ts:518` — sévérité basse

**Quote** : chargé (le décompte de Recharge lui est épargné), donc `!enemy.loaded` ne déclenche que pour qui doit.
**Ce qu'il excuse** : Un ennemi ne suit jamais son état de Recharge (`loaded`) — il est traité comme toujours chargé, sauf via `reloadNeeded` calculé séparément — déviation documentée du cycle RAW de Recharge (LDB 63 l.28-29) pour les PNJ.
**Réalité/contexte** : Simplification assumée : le suivi individuel de Rechargement par tir n'est implémenté que côté héros ; les ennemis n'ont pas cet état simulé au même niveau de fidélité.
**Traitement suggéré par l'audit** : Signaler cette exception RAW pour arbitrage utilisateur (garder si acceptée, sinon étendre `loaded` aux ennemis).
**Verdict utilisateur** : ☐ légitime  ☐ dette

## 30. `src/state/combat/advantagePool.ts:123` — sévérité basse

**Quote** : Menace / Manœuvrabilité / Terrain restent à l'appréciation du MJ (entrée d'éditeur future) → 0 par défaut.
**Ce qu'il excuse** : Trois des cinq circonstances RAW d'Avantage initial (AA l.4149-4167 : Manœuvrabilité, Menace ×3 paliers, Terrain) ne sont pas dérivées automatiquement et retombent à 0, en attendant une future entrée d'éditeur.
**Réalité/contexte** : Fonctionnellement correct pour l'instant (le code ne prétend implémenter que Surnombre + Surprise), mais c'est une couverture RAW partielle assumée et non tracée ailleurs que dans ce commentaire — à confirmer comme arbitrage accepté plutôt que dette oubliée.
**Traitement suggéré par l'audit** : Ouvrir un item de suivi explicite (éditeur : marqueurs Menace/Manœuvrabilité/Terrain par rencontre) au lieu de laisser la dette uniquement dans le commentaire.
**Verdict utilisateur** : ☐ légitime  ☐ dette

## 31. `src/state/combat/roundHooks.ts:245` — sévérité basse

**Quote** : Règle optionnelle « Se fatiguer » (LDB 16 l.99) : un effort physique soutenu finit par épuiser.  * Approximation assumée (granularité Round) : chaque Round en action = 1 Round d'effort ; à Bonus  * d'Endurance Rounds cumulés, Test de Résistance — échec → +1 Exténué (compteur remis à zéro) ;  * réussite → le délai avant le prochain Test est repoussé de 1 + DR Rounds.
**Ce qu'il excuse** : Le mapping RAW « Rounds d'effort » est directement dérivé du texte LDB 16 l.99, avec une seule liberté de granularité (Round vs minute/heure de jeu réel).
**Réalité/contexte** : Le commentaire admet lui-même une adaptation non triviale (mapper une notion réelle de temps/effort en pas discrets de Round de combat) sans qu'aucune validation utilisateur ne soit tracée ailleurs — c'est une règle maison marquée comme telle mais jamais arbitrée.
**Traitement suggéré par l'audit** : Documenter la décision (validée/à valider) dans docs/raw/ plutôt que dans un commentaire de code isolé, ou renvoyer vers le ticket/rapport qui l'a validée.
**Verdict utilisateur** : ☐ légitime  ☐ dette

## 32. `src/state/combat/triggeredTest.ts:655` — sévérité basse

**Quote** : sur un objet porté, l'ajout est fondu dans `qualities` → on compte 1 règle (cas du butin du jeu)
**Ce qu'il excuse** : Pour un objet déjà porté par un héros (par opposition à une ligne de butin), le nombre de « règles spéciales » à apprendre par Détection d'artefact est toujours forcé à 1, quel que soit le nombre réel de Qualités magiques de l'objet.
**Réalité/contexte** : LDB 10 l.310-312 ne plafonne pas le nombre de règles à apprendre (« chaque DR apprend également une règle spéciale spécifique... s'il en possède ») ; un objet magique à plusieurs Qualités magiques portées ferait apprendre son intégralité au premier DR au lieu d'un apprentissage progressif par DR comme pour une ligne de butin.
**Traitement suggéré par l'audit** : Si l'app modélise des objets portés à plusieurs Qualités magiques, compter réellement leurs qualités au lieu de forcer 1 (ou documenter que ce cas n'existe pas encore dans les données).
**Verdict utilisateur** : ☐ légitime  ☐ dette

## 33. `src/state/combat/turnHooks.ts:87` — sévérité basse

**Quote** : UN Test par Caractéristique gatée et par Round (deux doses de la même drogue ne re-testent pas — la « Dose » n'est pas modélisée).
**Ce qu'il excuse** : Le concept RAW de « Dose » (empilement d'effets de drogue) n'est pas modélisé ; deux applications du même effet gate (ex. deux doses de Racine de mandragore) ne génèrent qu'un seul Test par Round.
**Réalité/contexte** : Simplification assumée et documentée comme telle (bonne pratique de signalement), mais reste une divergence RAW non arbitrée formellement ailleurs.
**Traitement suggéré par l'audit** : Rien d'urgent — garder tel quel si la Dose n'a jamais d'usage en jeu, sinon tracer un item de suivi dédié.
**Verdict utilisateur** : ☐ légitime  ☐ dette

## 34. `src/state/combatEffects.ts:729` — sévérité basse

**Quote** : Seuil : « exaucé sur 01 » ; « Si vous avez la Compétence Prière, le MJ peut augmenter ce       // pourcentage » → +1 % par avance de Prière (arbitrage jeu-sans-MJ, modeste et documenté).
**Ce qu'il excuse** : Le bonus de +1 %/avance de Prière au seuil des Petites Prières est un arbitrage volontaire, non chiffré par le RAW.
**Réalité/contexte** : LDB 25 l.22-24 confirme que le RAW laisse ce pourcentage à la discrétion du MJ (« le MJ peut augmenter ce pourcentage ») sans barème chiffré — le code invente donc une valeur non-RAW (+1 %/avance), explicitement reconnu comme tel dans le commentaire.
**Traitement suggéré par l'audit** : Aucun changement requis si l'arbitrage est déjà validé par l'utilisateur (comme indiqué) ; sinon faire trancher la valeur.
**Verdict utilisateur** : ☐ légitime  ☐ dette

## 35. `src/state/landMarketFlow.ts:100` — sévérité moyenne

**Quote** : Rumeurs commerciales (l.176-180) : en tendant l'oreille au marché, un Test de Ragot Complexe (−10) ; sur   // un succès, une rumeur signale les biens très recherchés → ils s'y vendent le DOUBLE (l.180). Roulé APRÈS   // les offres pour ne pas déplacer leur flux RNG. ADAPTATION assumée : le RAW fait entendre la rumeur dans une   // AUBERGE, pointant un AUTRE Lieu via l'index géographique du Reikland (absent de la carte de l'arène) ; ici la   // rumeur vaut pour le Lieu COURANT (modèle minimal endossé par la conception — cf. rapport #58).
**Ce qu'il excuse** : Le RAW (T2C ch.11 l.176-180) fait pointer la rumeur commerciale vers un AUTRE lieu (tiré via l'index géographique du Reikland), mais le jeu la fait porter sur le lieu courant — déviation reconnue et 'endossée par la conception'.
**Réalité/contexte** : Confirmé par Source/Warhammer v4 - 2.0 Mort sur le Reik Compagnon/13 - CHAPITRE 11 - Règles du commerce.md l.180 : « lancez un d100 pour déterminer un emplacement à l'aide de l'index géographique des pages suivantes » — la rumeur RAW cible bien un lieu tiré au hasard, différent du lieu courant. C'est une déviation RAW non triviale (change où et quand la rumeur peut être exploitée) tracée seulement par un commentaire renvoyant à un rapport #58 non retrouvable dans le code.
**Traitement suggéré par l'audit** : Confirmer/lier explicitement la décision (référencer un doc traçable, ex. docs/raw/, plutôt qu'un numéro de rapport interne) ou implémenter le tirage d'un lieu cible distinct si l'arène le permet.
**Verdict utilisateur** : ☐ légitime  ☐ dette

## 36. `src/state/lineOfSight.ts:144` — sévérité basse

**Quote** : (Le « dead ground » au pied du mur - angle mort vertical - est un raffinement ultérieur, non requis.)
**Ce qu'il excuse** : Justifie l'absence de gestion de l'angle mort vertical sous un rempart comme un raffinement différé.
**Réalité/contexte** : Déviation RAW/géométrie assumée et non implémentée, signalée comme 'pour plus tard' sans ticket ni validation traçable.
**Traitement suggéré par l'audit** : Ouvrir un suivi explicite (ou faire trancher par l'utilisateur) plutôt que laisser un 'non requis' non arbitré dans le commentaire.
**Verdict utilisateur** : ☐ légitime  ☐ dette

## 37. `src/state/merchantFlow.ts:441` — sévérité basse

**Quote** : Vente immédiate d'un objet (conservée : API + tests). Délègue le prix à `sellGain`.
**Ce qu'il excuse** : La fonction `sellItem` (vente unitaire, hors panier) est explicitement justifiée comme conservée uniquement pour préserver une API/des tests existants — sous-entendant qu'elle est redondante avec le panier de vente (`confirmSell`).
**Réalité/contexte** : C'est un chemin de code parallèle non retiré, signalé comme dette potentielle plutôt que motivé par un besoin produit actif — à arbitrer (fusionner avec le panier de vente ou confirmer qu'elle sert un usage distinct).
**Traitement suggéré par l'audit** : Si aucun appelant produit ne l'utilise hors tests, la retirer et migrer les tests vers `confirmSell` (panier à 1 élément).
**Verdict utilisateur** : ☐ légitime  ☐ dette

## 38. `src/state/outOfCombatUpkeep.ts:10` — sévérité basse

**Quote** : Limite assumée : tant que l'action « Premiers Secours / panser » (retrait d'Hémorragique, couture C de récupération) n'existe pas, un héros qui s'attarde en saignant peut mourir — un Point de Destin le sauve (consommé, l'hémorragie est jugulée). Se déplacer ne coûte pas de temps : on peut fuir sans saigner.
**Ce qu'il excuse** : Le commentaire justifie une lacune de fonctionnalité (pas d'action de premiers secours hors combat) comme une limitation temporaire acceptée.
**Réalité/contexte** : C'est une dette fonctionnelle non tracée ailleurs que dans ce commentaire — aucun ticket ou TODO formel ; le code accepte silencieusement qu'un joueur ne puisse pas stopper une hémorragie hors combat sans dépenser un Point de Destin.
**Traitement suggéré par l'audit** : Remplacer par un TODO tracé (ticket/roadmap) ou implémenter l'action Premiers Secours et retirer la justification.
**Verdict utilisateur** : ☐ légitime  ☐ dette

## 39. `src/state/relief.ts:34` — sévérité basse

**Quote** : Ajustable ici (foyer unique) ; documenté comme assumé, pas canon - à confirmer au rendu/jeu.
**Ce qu'il excuse** : STEP_MAX_M = 1.0 (seuil marche/falaise) est explicitement présenté comme une valeur maison non tirée du RAW, encore à valider.
**Réalité/contexte** : Le commentaire lui-même l'admet ('AUCUNE valeur RAW ne le définit') : c'est une déviation/valeur assumée non arbitrée, exactement le type d'exception que la règle demande de faire remonter même si elle est plausible.
**Traitement suggéré par l'audit** : Faire trancher/valider STEP_MAX_M par l'utilisateur (RAW ou valeur maison actée), puis retirer le tag 'à confirmer'.
**Verdict utilisateur** : ☐ légitime  ☐ dette

## 40. `src/state/restFlow.ts:133` — sévérité basse

**Quote** : Soins prolongés : un soignant valide (Guérison) veille les malades — Test supposé réussi sur la   // durée (abstraction du repos, LDB 09 : −1 jour/jour de soins par maladie).
**Ce qu'il excuse** : Le Test de Guérison prolongé (−1 jour/jour de soins) est simplement SUPPOSÉ réussi pendant tout le repos, présenté comme une « abstraction » assumée.
**Réalité/contexte** : Aucun jet n'est réellement lancé pour ce soin prolongé — c'est une déviation RAW documentée (le RAW suppose un Test de Guérison réel, réussite non garantie) mais jamais arbitrée par un jet en jeu.
**Traitement suggéré par l'audit** : Documenter/valider explicitement ce choix d'arbitrage auprès de l'utilisateur, ou implémenter le vrai Test de Guérison par jour de soins.
**Verdict utilisateur** : ☐ légitime  ☐ dette

## 41. `src/state/seaActivities.ts:14` — sévérité basse

**Quote** : Cartographie (l.288-290) : Métier (Cartographe) Complexe (−10) → une Carte marine (trapping  *  `carte-marine`, passif +2 DR d'Orientation) d'une valeur de DR CO (prix d'instance). Les « deux  *  ports désignés » ne sont pas modélisés : la carte sert la ligne maritime courante (abstraction  *  documentée — même lecture que la Boussole, passif inconditionnel).
**Ce qu'il excuse** : La règle RAW « la carte couvre spécifiquement deux ports désignés » n'est pas modélisée ; l'implémentation la remplace par un bonus inconditionnel sur la ligne maritime courante.
**Réalité/contexte** : Déviation RAW assumée et documentée comme un choix de conception (« abstraction documentée »), sans validation utilisateur tracée.
**Traitement suggéré par l'audit** : Si acceptée, déplacer la justification vers un doc de règles optionnelles versionné plutôt qu'un commentaire de code.
**Verdict utilisateur** : ☐ légitime  ☐ dette

## 42. `src/state/seaActivities.ts:16` — sévérité basse

**Quote** : Le volet « Opérations  *  bancaires : Planque » gratuit (l.292) n'est pas offert en mer (la banque vit à l'interlude).
**Ce qu'il excuse** : Une partie de la règle RAW (Opérations bancaires : Planque, gratuite) est délibérément omise en contexte 'mer'.
**Réalité/contexte** : Omission volontaire non arbitrée en dehors du commentaire — RAW l.292 l'autorise en mer selon la source citée.
**Traitement suggéré par l'audit** : Documenter le choix comme règle optionnelle désactivée plutôt que comme note de code isolée.
**Verdict utilisateur** : ☐ légitime  ☐ dette

## 43. `src/state/seaActivities.ts:17` — sévérité basse

**Quote** : Entraînement d'équipage (l.294-300) : GATE — l'équipage du navire de campagne est ABSTRAIT,  *  tenu par les PJ (MDG 14 l.39) : aucun équipage PNJ à entraîner (l'UI l'explique, le résolveur  *  le raconte). « Seuls les PNJ peuvent gagner des Augmentations » (l.296).
**Ce qu'il excuse** : L'Activité RAW « Entraînement d'équipage » est neutralisée car le modèle de jeu n'a pas d'équipage PNJ distinct des PJ.
**Réalité/contexte** : Conséquence directe d'un choix d'architecture (équipage abstrait) documentée comme telle — exception assumée sans trace de validation hors du commentaire.
**Traitement suggéré par l'audit** : Référencer la décision d'architecture (MDG 14 l.39) dans docs/raw/ ou docs/systeme-*.md plutôt que de la ré-justifier ici.
**Verdict utilisateur** : ☐ légitime  ☐ dette

## 44. `src/state/seaActivities.ts:20` — sévérité basse

**Quote** : Whitelist d'Activités TERRESTRES (l.270 : Apprentissage particulier, Artisanat, Entraînement,  *  Entraînement au combat, Invention !, Recherche de savoir, Semer la dissension + entraînements  *  d'Aux Armes !) : « à condition que des installations et des instructeurs adaptés soient  *  disponibles » — arbitrage sans-MJ : ni installations ni instructeurs sur le navire de campagne  *  → non proposées en mer (le verbatim est affiché dans la modale, `SEA_ACTIVITIES_INTRO`).
**Ce qu'il excuse** : La condition RAW (installations/instructeurs disponibles, laissée à l'appréciation du MJ) est arbitrée unilatéralement par le code comme toujours fausse en mer.
**Réalité/contexte** : C'est un arbitrage de conception explicite pour remplacer une décision MJ absente — cohérent avec la contrainte 'pas de MJ' du projet, mais reste une exception RAW non validée formellement en dehors du commentaire.
**Traitement suggéré par l'audit** : Rien à changer fonctionnellement ; déplacer la justification vers la documentation de règle plutôt que le code si on veut la rendre traçable/arbitrable plus tard.
**Verdict utilisateur** : ☐ légitime  ☐ dette

## 45. `src/state/seaVoyageFlow.ts:27` — sévérité basse

**Quote** : * ÉQUIPAGE : hors combat, l'équipage PNJ du navire est ABSTRAIT — « la performance des Personnages  * représente celle de tout l'équipage » (MDG 14 l.39) → les PJ tiennent les rôles, PAS de Manque de  * bras au long cours (choix documenté ; en combat, l'équipage est réel et le Manque de bras s'applique).
**Ce qu'il excuse** : Hors combat, le Manque de bras (undercrew, MDG ch.14 l.55) ne s'applique jamais pendant le voyage maritime — choix assumé.
**Réalité/contexte** : Déviation RAW documentée : RAW ne distingue pas 'voyage' vs 'combat' pour le Manque de bras, qui est une règle générale de Test d'équipage ; ici elle est désactivée hors combat par choix produit.
**Traitement suggéré par l'audit** : Confirmer ce choix avec l'utilisateur ou étendre `shipUndercrew` au flux de voyage.
**Verdict utilisateur** : ☐ légitime  ☐ dette

## 46. `src/state/seaVoyageFlow.ts:403` — sévérité basse

**Quote** : // « voguer de nuit » : il faut l'équipage nominal — l'équipage PNJ abstrait du navire de campagne   // le permet (choix documenté, MDG 14 l.39) ; ch.15 l.76 sinon ÷2.
**Ce qu'il excuse** : La pénalité de progression ÷2 pour naviguer de nuit sans équipage nominal (ch.15 l.76) est contournée par choix documenté puisque l'équipage PNJ abstrait est réputé nominal.
**Réalité/contexte** : Autre occurrence de la même exception RAW assumée (cf. l.27-29) — navigation de nuit jamais pénalisée.
**Traitement suggéré par l'audit** : Même remarque : à faire arbitrer/valider explicitement plutôt que laisser en excuse de code.
**Verdict utilisateur** : ☐ légitime  ☐ dette

## 47. `src/state/seaVoyageFlow.ts:990` — sévérité basse

**Quote** : // — on paie si la bourse le permet (choix automatique documenté ; la Taille en pistoles suit lengthM).
**Ce qu'il excuse** : L'événement de port « prêtre de Manann » choisit automatiquement de payer si la bourse le permet, plutôt que de laisser un choix au joueur — présenté comme un choix documenté.
**Réalité/contexte** : Décision de gameplay substituée au joueur sans confirmation interactive ; RAW ne prescrit pas d'automatisme ici (« payer OU réduire l'Humeur de Manann » est un choix de joueur).
**Traitement suggéré par l'audit** : Envisager une modale de choix joueur (payer / refuser) plutôt que l'automatisme, ou confirmer que l'automatisme est le choix produit voulu.
**Verdict utilisateur** : ☐ légitime  ☐ dette

## 48. `src/state/shipBattery.ts:12` — sévérité moyenne

**Quote** : elle vit dans le flux/la modale (à câbler côté navigateur).
**Ce qu'il excuse** : L'application des dégâts de la bordée par pièce reste à câbler côté navigateur/UI.
**Réalité/contexte** : Confirmé par grep : `resolveBattery`/`BatteryPlan` ne sont consommés que par `shipCrew.ts` (assignation d'équipage) et le test unitaire ; aucun flux/modale n'applique encore les dégâts par pièce (pas de trace de `firedAttackBlock` appelé avec ce DR forcé) — le module est un plan PUR non encore intégré à un flux de jeu jouable.
**Traitement suggéré par l'audit** : Garder le commentaire mais ouvrir un suivi explicite (ticket/roadmap) tant que l'intégration n'est pas câblée, pour ne pas laisser la dette invisible.
**Verdict utilisateur** : ☐ légitime  ☐ dette

## 49. `src/state/targetingModes.ts:105` — sévérité basse

**Quote** : Liste partielle ASSUMÉE : un buff non listé retombe en 'any' (réticule des deux côtés, jamais caché) — pire cas anodin (buff montrable sur un ennemi).
**Ce qu'il excuse** : HELPFUL_TARGET_OPS est volontairement incomplète ; les ops bénéfiques absentes de la liste ne cassent rien de grave.
**Réalité/contexte** : C'est une auto-justification explicite d'une couverture partielle (le mot « ASSUMÉE » le dit) du classement d'affinité des sorts — une op bénéfique non listée fait retomber le sort en ciblage 'any', ce qui autorise de viser un allié comme un ennemi sans distinction ; dette non tranchée par l'utilisateur.
**Traitement suggéré par l'audit** : Lister exhaustivement les ops bénéfiques d'après spellOps/GameOp (comme HARMFUL_TARGET_OPS se veut « COMPLÈTE »), ou documenter le choix comme un arbitrage validé plutôt qu'une supposition.
**Verdict utilisateur** : ☐ légitime  ☐ dette

## 50. `src/state/travelFlow.ts:172` — sévérité basse

**Quote** : Plafond de marche forcée (heures/jour, canon muet — défaut 10) — paramétrable au niveau carte.
**Ce qu'il excuse** : Le canon ne fixe aucune limite d'heures de marche forcée par jour ; le code invente un défaut de 10h.
**Réalité/contexte** : Admission explicite (« canon muet ») que la valeur 10 est une invention d'auteur sans ancrage RAW — cohérent avec `WorldMapParams.forcedMaxHours` dans worldMap.ts (même aveu), mais reste une règle maison non validée comme telle par l'utilisateur.
**Traitement suggéré par l'audit** : Rien à corriger côté fidélité (l'aveu est honnête) ; s'assurer que la valeur reste éditable et documentée comme choix de MJ dans l'UI, pas présentée comme RAW.
**Verdict utilisateur** : ☐ légitime  ☐ dette

## 51. `src/state/travelFlow.ts:249` — sévérité basse

**Quote** : transport : cadence du véhicule (RAW muet) = heures de route standard
**Ce qu'il excuse** : Le RAW ne précise pas combien d'heures par jour un transport payant (diligence/barge) voyage ; le code retombe sur la cadence de base (6h) faute de règle.
**Réalité/contexte** : Deuxième aveu de silence du RAW dans le même fichier — le choix (cadence de base) est raisonnable mais non sourcé, à faire trancher/valider explicitement plutôt que de rester un défaut implicite.
**Traitement suggéré par l'audit** : Documenter ce choix dans docs/raw (déplacement) comme convention d'auteur assumée, ou laisser tel quel si déjà validé ailleurs.
**Verdict utilisateur** : ☐ légitime  ☐ dette

## 52. `src/state/travelFlow.ts:790` — sévérité basse

**Quote** : Soins de l'ARRIVÉE au relais : le maréchal-ferrant remplace le fer (EDOC 07 l.166), la sellerie est réparée (l.174), la bête boiteuse est laissée aux bons soins de l'étape. Choix documenté : le RAW ne chiffre ni coût ni durée pour ces remises en état — on les résout à l'arrivée
**Ce qu'il excuse** : Le RAW ne donne ni coût ni durée pour la remise en état des montures blessées ; le code choisit de tout résoudre à l'arrivée, gratuitement et instantanément.
**Réalité/contexte** : Auto-justification explicite (« Choix documenté ») d'une lacune RAW comblée par une convention d'auteur non gatée par argent/temps — c'est une dette de conception assumée, pas une règle canonique.
**Traitement suggéré par l'audit** : Si acceptable, garder tel quel mais retirer le vernis « RAW » du commentaire (c'est une convention de jeu, pas une règle) ; sinon chiffrer un coût/délai d'auteur au niveau de la carte.
**Verdict utilisateur** : ☐ légitime  ☐ dette

