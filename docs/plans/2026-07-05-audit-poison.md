# Audit anti-poison — rapport du 2026-07-05 (ARTEFACT DATÉ)

> Workflow 224 agents (44 finders Sonnet-medium + 176 vérificateurs adversariaux Sonnet-medium/Haiku-low),
> périmètre : 154 fichiers src/engine+src/state (hors 4 fichiers WIP cascade), 24 docs/, CLAUDE.md.
> Hors périmètre (passes suivantes) : tests, src/ui, src/data, src/scenes, src/gameIso, fichiers chauds.
> Stats : 180 trouvailles brutes → 164 CONFIRMÉES / 16 réfutées.
> Sévérités confirmées : haute 36 · moyenne 42 · basse 86.


## RAW-MISMATCH — le commentaire/code contredit le Source (les plus graves) (33)

### src/engine/critical.ts:34 — sévérité haute
- **Quote** : if (dominant) t.ops = [{ op: 'charMod', char: 'CC', mod: -5 }, { op: 'charMod', char: 'CT', mod: -5 }];
- **Affirme** : La pénalité -5/CC et -5/CT par doigt perdu (et, plus bas, -20/CC-CT pour une main perdue) n'est appliquée que si la localisation est 'brasD' (comment ligne 32 : « Effet (main principale −5/doigt) posé ICI »).
- **Réalité** : LDB 18 « Doigts » (Traumatisme) : « vous subissez une pénalité de -5 à tous les Tests qui impliquent cette main par doigt perdu » — la pénalité s'applique à LA MAIN QUI A PERDU LE DOIGT, quelle que soit sa latéralité, pas seulement à la « main principale ». Idem pour « Main » (-20, LDB 18) : la pénalité de base touche la main perdue elle-même, dominante ou non (le -20 SUPPLÉMENTAIRE à la main secondaire ne s'applique qu'en cas de perte de la main principale). En gattant tout `ops` sur `dominant`, le code retire TOUTE pénalité mécanique quand la localisation touchée est brasG/jambeG — un doigt ou une main perdus au bras gauche (non-dominant) ne coûte plus rien en jeu.
- **Preuve** : Source/Warhammer v4 - Livre de base version corrigée/18 - Traumatisme.md l.251 : « Avec des doigts coupés... vous subissez une pénalité de -5 à tous les Tests qui impliquent cette main par doigt perdu. » ; l.263 (Main) : « Vous recevez une pénalité de -20 à tous les Tests qui utilisent cette main... Si la main perdue est votre main principale, vous subissez la pénalité habituelle de -20 ... avec votre main secondaire. »
- **Fix** : Appliquer la pénalité (-5 CC/CT par doigt, -20 CC/CT pour la main) inconditionnellement à la localisation touchée ; réserver `dominant` uniquement au calcul du malus SUPPLÉMENTAIRE à la main secondaire en cas de perte de la main principale.
- **Vérif adversariale** : Lu src/engine/critical.ts l.1-38 (le code réel : `if (dominant) t.ops = [...]` pour doigt-ampute et main-bras-ampute) et Source/Warhammer v4 - Livre de base version corrigée/18 - Traumatisme.md l.249-263 (« Doigts » : -5/doigt « cette main » sans condition de latéralité ; « Main » : -20 « cette main » + -20 supplémentaire à la main secondaire SEULEMENT si la main perdue est la principale). Confirme l'écart : le code retire toute pénalité CC/CT quand la localisation est brasG (non-dominant).

### src/engine/equipCompare.ts:70 — sévérité haute
- **Quote** : const baseline: WeaponDamageSpec | undefined = item.kind === 'melee' ? { plusBF: true, flat: -2 } : undefined; // mêlée : mains nues (LDB)
- **Affirme** : Les dégâts de référence « mains nues » (utilisés comme base de comparaison quand le héros ne tient aucune arme) valent +BF-2, et l'UI affiche « +BF-2 (mains nues) » (ligne 73).
- **Réalité** : Le LDB donne « Mains nues » à +BF+0 (table Bagarre, LDB 62), et c'est exactement la valeur canonique utilisée ailleurs dans le moteur : `src/engine/items.ts` définit `unarmedWeapon()` avec le commentaire « Arme « Mains nues » canonique, DÉRIVÉE du trapping (LDB 62 l.75 : +BF+0, Personnelle, Inoffensive) » et un fallback littéral `{ literal: '+BF+0' }`. Le baseline de equipCompare.ts contredit donc à la fois le livre et le reste du code du moteur — il sous-évalue le combattant à mains nues de 2 points de Dégâts à chaque comparaison d'arme de mêlée au marchand.
- **Preuve** : Source/Warhammer v4 - Livre de base version corrigée/62 - Les armes.md:28 « | Mains nues | ND | 0 | – | Personnelle | +BF +0 | Inoffensive |» ; src/engine/items.ts:345-352 « Arme « Mains nues » canonique, DÉRIVÉE du trapping (LDB 62 l.75 : +BF+0, Personnelle, Inoffensive) … damage: it.damage ?? { plusBF: true, flat: 0 } »
- **Fix** : Remplacer `{ plusBF: true, flat: -2 }` par `{ plusBF: true, flat: 0 }` (et le libellé UI « +BF-2 (mains nues) » par « +BF (mains nues) »), ou mieux : dériver le baseline de `unarmedWeapon().damage` pour ne plus dupliquer la valeur canonique.
- **Vérif adversariale** : Source/Warhammer v4 - Livre de base version corrigée/62 - Les armes.md:28 confirme « Mains nues | ND | 0 | – | Personnelle | +BF +0 | Inoffensive ». src/engine/equipCompare.ts ligne 70 et 73 lus directement : `const baseline: WeaponDamageSpec | undefined = item.kind === 'melee' ? { plusBF: true, flat: -2 } : undefined;` et libellé `'+BF-2 (mains nues)'` — code différent de items.ts::unarmedWeapon() qui, lui, utilise bien flat:0.

### src/engine/trauma.ts:234 — sévérité haute
- **Quote** : Doigts par bras (l.341) : −5 aux Tests d'Arme PAR doigt (main principale = brasD) ; **4+ doigts → règle de la main tranchée** (l.344 : `noTwoHanded` + −20).
- **Affirme** : La pénalité de −5/doigt perdu (et le −20 de la main tranchée) ne s'applique qu'à la main principale (brasD) — le commentaire présente cette restriction comme la règle canon.
- **Réalité** : LDB 18 p.179 « Doigts » dit : « vous subissez une pénalité de -5 à tous les Tests qui impliquent cette main par doigt perdu » — sans restriction de dominance, pour N'IMPORTE QUELLE main. De même « Main » (p.180) : « Vous recevez une pénalité de -20 à tous les Tests qui utilisent cette main » s'applique à TOUTE main perdue ; seule la clause additionnelle (-20 sur l'autre main) est conditionnée à la perte de la main PRINCIPALE. Le code (`consolidateAmputations`, `src/engine/trauma.ts` ~l.262 et ~l.257-259) ne pousse AUCUN `charMod` quand `loc==='brasG'` (non-dominant) : perdre des doigts ou une main gauche ne produit aujourd'hui STRICTEMENT AUCUN malus mécanique, contrairement au RAW qui pénalise toute main atteinte.
- **Preuve** : Code : `const ops: GameOp[] = dominant ? [{ op: 'charMod', char: 'CC', mod: -5 * total }, { op: 'charMod', char: 'CT', mod: -5 * total }] : [];` (finger case) et `if (dominant) ops.push({ op: 'charMod', char: 'CC', mod: -20 }, { op: 'charMode', char: 'CT', mod: -20 });` (hand case, aucun push sinon). Source : `18 - Traumatisme.md` l.251 « … par doigt perdu » et l.263 « Vous recevez une pénalité de -20 à tous les Tests qui utilisent cette main ».
- **Fix** : Appliquer le malus (−5×total ou −20) au CC/CT quel que soit `loc` (dominant ou non) ; ne réserver le +«pénalité additionnelle sur l'autre main» qu'au cas où la main PRINCIPALE est perdue, comme le prévoit le RAW.
- **Vérif adversariale** : Lu Source/Warhammer v4 - Livre de base version corrigée/18 - Traumatisme.md l.249-263 (§Doigts l.251 : « pénalité de -5 à tous les Tests qui impliquent cette main par doigt perdu » ; §Main l.263 : « pénalité de -20 à tous les Tests qui utilisent cette main […] Si la main perdue est votre main principale, vous subissez la pénalité habituelle de -20 […] sur votre main secondaire »). Comparé au code src/engine/trauma.ts l.253/258/262 : `const dominant = loc === 'brasD'` puis `dominant ? [...charMod CC/CT...] : []` — brasG (main non-dominante) ne génère aucun op.

### src/engine/woundsCalc.ts:22 — sévérité haute
- **Quote** : Une arme IMPARABLE (Résistant/Impénétrable/Bélier hors-porte) inflige 0 ; sinon le TOTAL de Dégâts est doublé par Siège AVANT le Bonus d'Endurance
- **Affirme** : Un Bélier utilisé contre une structure qui n'est pas une porte inflige 0 Blessure (imparable, comme Résistant/Impénétrable).
- **Réalité** : ADE II ch.08 dit l'inverse : le Bélier n'est "imparable" nulle part — hors des portes, il continue à infliger des dégâts, simplement comme une arme improvisée (donc pas 0).
- **Preuve** : Source/Warhammer v4 - Les archives de l'Empire volume 2/08 - Le théâtre de la guerre.md l.249 : « Les béliers n'infligent des dégâts qu'aux portes. Sinon, ils sont considérés comme une Arme improvisée. » — et src/engine/structures.ts::structureImmune traite bien ce cas comme un 0 Blessure (weaponHasCap(weapon,'ram') && structureKind(target)!=='porte' → true), ce qui matérialise l'erreur en code, pas seulement en commentaire.
- **Fix** : Corriger le commentaire ET structureImmune : un Bélier hors-porte ne doit pas être immunisé à 0, il doit être traité comme une arme improvisée (dégâts normaux, sans doublement Siège) contre une structure qui n'est pas une porte.
- **Vérif adversariale** : Lu Source/Warhammer v4 - Les archives de l'Empire volume 2/08 - Le théâtre de la guerre.md l.239-258 (tableau Bélier + note *) : phrase exacte confirmée. Lu src/engine/structures.ts l.61-73 : `structureImmune` retourne true (0 dégât) pour weaponHasCap(weapon,'ram') && structureKind(target)!=='porte', ce qui matérialise l'erreur en code, en plus du commentaire de woundsCalc.ts.

### src/state/combatSetup.ts:21 — sévérité haute
- **Quote** : `roll-i` (DÉFAUT, comportement RAW du jeu) : 1d10 + Initiative.
- **Affirme** : Le jet 1d10 + Initiative (`roll-i`) est présenté comme LE comportement RAW par défaut du jeu.
- **Réalité** : LDB 13 « Ordre d'Initiative » (l.27-31, hors tout encadré optionnel) pose la règle de base : « Les combattants agissent dans un ordre d'Initiative bien précis... où celui ayant la valeur la plus forte agit en premier » — un tri PUR sur la Caractéristique, SANS dé (= ce que le code appelle `fixed-i`). Le jet 1d10+Initiative n'apparaît que plus loin sous l'encadré « DÉTERMINEZ L'INITIATIVE ! » (l.35-41), explicitement présenté comme UNE option parmi d'autres pour « Certains groupes [qui] préfèrent déterminer l'Initiative au hasard ». Le RAW de base est donc `fixed-i`, pas `roll-i`.
- **Preuve** : Source/Warhammer v4 - Livre de base version corrigée/13 - Combat.md l.29 : « Les combattants agissent dans un ordre d'Initiative bien précis au cours d'un Round, où celui ayant la valeur la plus forte agit en premier » ; l.37 : « Certains groupes préfèrent déterminer l'Initiative au hasard. Choisissez celle que vous préférez parmi celles qui existent. » puis l.40 : « Chaque Joueur lance 1d10 et l'ajoute à son Initiative. »
- **Fix** : Reformuler : le RAW de base ordonne par Initiative brute sans dé (= `fixed-i`) ; `roll-i`/`roll-bi` sont les méthodes ALÉATOIRES optionnelles du livre (« Certains groupes préfèrent... ») — ne pas qualifier `roll-i` de « comportement RAW du jeu ».

### src/state/sceneRules.ts:13 — sévérité haute
- **Quote** : /** Cible dissimulée (obscurité de nuit ou brouillard) → −20 au tir (LDB 14 l.107). */
- **Affirme** : Une cible dissimulée par le brouillard/l'obscurité (nuit) inflige un malus de -20 au tir, sourcé LDB 14 l.107.
- **Réalité** : Le tableau « Difficulté de Combat » (LDB, chapitre 14, PDF p.163-164) classe explicitement cette entrée dans la bande Complexe (-10), pas Difficile (-20) : « La cible du tir est dissimulée par le brouillard, la brume ou l'obscurité » figure entre les exemples Complexe -10 (juste après « Tirer à Distance Longue » et juste avant la bande Difficile -20 qui commence avec la météo extrême). Le -20 correct existe bien dans le même tableau mais pour un autre cas (« Tirer dans l'obscurité » = Très Difficile -30, ou météo extrême = Difficile -20) — pas pour la simple dissimulation par brouillard/pénombre. Le doc-audit interne `docs/raw/combat.md` l.931 confirme déjà cette bande à -10 pour ce cas précis, contredisant le code.
- **Preuve** : LDB 14 ("14 - _GoBack.md") l.100-107 : "Complexe -10 ... la cible du tir est dissimulée par le brouillard, la brume ou l'obscurité." ; docs/raw/combat.md l.931 : "| Complexe | −10 | ... la cible du tir est dissimulée par le brouillard, la brume ou l'obscurité |". Code : src/state/combatFlow.ts:445 applique `value: -20` pour ce même flag `concealed`.
- **Fix** : Corriger le malus concealed à -10 (Complexe) dans sceneRules.ts et le site de consommation combatFlow.ts:445, et mettre à jour la réf en LDB 14 (Complexe -10, l.107).
- **Vérif adversariale** : Lu Source/Warhammer v4 - Livre de base version corrigée/14 - _GoBack.md l.60-86 : la ligne "Complexe -10" liste ses exemples de l.70 à l.75, dont l.75 "La cible du tir est dissimulée par le brouillard, la brume ou l'obscurité." ; la bande suivante "Difficile -20" commence l.76 avec "Attaquer sous la mousson... ou toute autre condition climatique extrême." Grep sur src confirme sceneRules.ts:32 (`// cible dissimulée −20 au tir (l.107)`) et combatFlow.ts:445 (`value: -20`) appliquent -20, contredisant la source qui classe ce cas à -10.

### src/state/turnEconomy.ts:51 — sévérité haute
- **Quote** : // Rapide (LDB 62 l.318-319) / Tir rapide (LDB 10) : attaque hors de l'ordre d'Initiative — gratuit.
- **Affirme** : Le talent Tir rapide permet une pré-emption d'initiative GRATUITE (sans contrepartie), au même titre que la Qualité d'arme Rapide.
- **Réalité** : RAW (LDB, talent « Tir rapide », section Talents) : « Si vous avez une arme à distance chargée, vous pouvez faire feu en dehors de l'ordre d'Initiative normal avant que tout autre combattant ne réagisse dans le Round suivant. […] Utiliser Tir rapide nécessite à la fois votre Action et votre Mouvement pour votre tour à venir, qui compteront comme ayant été dépensés pendant le prochain tour. » — ce n'est PAS gratuit : le prix est de perdre l'Action ET le Mouvement du tour SUIVANT. Seule la Qualité d'arme Rapide (LDB 62) est réellement sans contrepartie.
- **Preuve** : Source (chapitre Talents) : « Utiliser Tir rapide nécessite à la fois votre Action et votre Mouvement pour votre tour à venir, qui compteront comme ayant été dépensés pendant le prochain tour. » — vs. code `src/state/combatSlice.ts` `roundStartPromote`: `const free = !!hero && (canStrikeFirst(hero.weapons) || canPreemptRanged(hero));` qui ne débite ni l'Action ni le Mouvement du tour suivant pour le cas Tir rapide, traité EXACTEMENT comme la Qualité Rapide.
- **Fix** : Distinguer les deux cas : Rapide (arme) = pré-emption réellement gratuite ; Tir rapide (talent) = gratuite EN CHANCE mais consomme l'Action+Mouvement du tour suivant du porteur — implémenter ce débit ou a minima corriger le commentaire pour ne plus dire « gratuit » sans nuance.
- **Vérif adversariale** : Lu Source/Warhammer v4 - Livre de base version corrigée/11 - _3znysh7.md lignes 97-103 (texte complet du talent Tir rapide) — confirme la citation exacte du claim. Lu src/state/turnEconomy.ts (canActFirst l.47-52, freeActFirst l.54-58) et src/state/combatSlice.ts (roundStartPromote l.1322-1336) et src/engine/combatFeatures/dispatch.ts (canPreemptRanged l.149-153) : aucun débit de l'Action/Mouvement du tour suivant n'existe nulle part dans le code — le talent est traité comme purement gratuit, exactement comme la Qualité Rapide.

### src/state/turnEconomy.ts:56 — sévérité haute
- **Quote** : /** La pré-emption d'initiative est-elle GRATUITE pour `c` ? (arme Rapide, LDB 62 l.318-319 —  *  sinon elle coûte 1 point de Chance, LDB ch.17 l.27). */
- **Affirme** : freeActFirst regroupe Rapide (arme) et Tir rapide (talent) sous la même notion de gratuité totale, sans contrepartie autre que le point de Chance normalement requis.
- **Réalité** : Tir rapide n'est gratuit qu'en points de Chance ; il coûte réellement l'Action ET le Mouvement du tour suivant du personnage (RAW, talent Tir rapide) — un coût que ni le commentaire ni `canPreemptRanged`/`roundStartPromote` ne modélisent.
- **Preuve** : `export function freeActFirst(c: Combatant): boolean { return canStrikeFirst(c.weapons) || canPreemptRanged(c); // Rapide (LDB 62) / Tir rapide (LDB 10) }` — même traitement pour les deux, alors que seule l'arme Rapide est sans contrepartie RAW.
- **Fix** : Nuancer commentaire + comportement : Tir rapide gratuit en Chance mais débite l'Action+Mouvement du round suivant, pas une gratuité totale comme Rapide.
- **Vérif adversariale** : Lu src/state/turnEconomy.ts (freeActFirst l.54-58, canActFirst l.47-52), src/engine/combatFeatures/dispatch.ts (canPreemptRanged l.150-153), src/data/talents.json (entrée "tir-rapide" l.4218-4242, desc citant le coût Action+Mouvement du tour suivant), src/state/combatSlice.ts (roundStartPromote l.1323-1336, ne débite que fortune). Cherché "Tir rapide" dans Source/.../10 - Talents.md : absent tel quel (orthographe/format différents dans le .md source), mais la fiche JSON app-owned porte le texte verbatim de la règle (conforme à la règle projet #5 : desc = copié/collé de la source) — suffisant pour confirmer la contrepartie RAW manquante dans le code.

### src/engine/advantage.ts:5 — sévérité moyenne
- **Quote** : Plafond d'Avantage FIXE — règle optionnelle « Limiter les Avantages » (LDB 15-Dépl l.17 : « 10 fonctionne plutôt bien puisque vous pouvez facilement les comptabiliser avec 1d10 »).
- **Affirme** : La règle optionnelle « Limiter les Avantages » et la citation « 10 fonctionne plutôt bien... » se trouvent au chapitre 15 (Déplacement) du LDB.
- **Réalité** : Cette règle optionnelle (encadré « OPTION : LIMITER LES AVANTAGES ») est dans le chapitre 14 du LDB, pas le 15. Le chapitre 15 (Déplacement) ne contient aucune mention de plafond d'Avantage ou de cette option ; il traite de Poursuites/Fuite (+1 Avantage en chargeant, etc.).
- **Preuve** : Source/Warhammer v4 - Livre de base version corrigée/14 - _GoBack.md l.193-198 : « # OPTION : LIMITER LES AVANTAGES ... Le plafond d'Avantages possède une limite préétablie, telle que 2, 4 ou plus. 10 fonctionne plutôt bien puisque vous pouvez facilement les comptabiliser avec 1d10. » — citation verbatim mais rattachée au MAUVAIS chapitre dans le commentaire.
- **Fix** : Remplacer « LDB 15-Dépl l.17 » par « LDB 14 » (chapitre « Combat » suite / options de combat, pas Déplacement).
- **Vérif adversariale** : Lu Source/Warhammer v4 - Livre de base version corrigée/14 - _GoBack.md l.189-198 : titre « Avantage » puis « OPTION : LIMITER LES AVANTAGES » avec la citation verbatim « 10 fonctionne plutôt bien puisque vous pouvez facilement les comptabiliser avec 1d10. » Le chapitre 15 (Déplacement) ne contient pas cette section (non vérifié directement mais le grep n'a trouvé qu'un seul fichier contenant « LIMITER LES AVANTAGES » : le chapitre 14). Confirmé aussi le code src/engine/advantage.ts l.5 cite bien « LDB 15-Dépl l.17 », erreur de chapitre (pas juste un drift de numéro de ligne).

### src/engine/advantage.ts:14 — sévérité moyenne
- **Quote** : si « Plafond = Bonus d'Initiative » est actif (LDB 15-Dépl l.15), le Bonus d'Initiative du combattant prime (plafond par combattant)
- **Affirme** : La règle « un Avantage ne peut pas dépasser le Bonus d'Initiative » se trouve au chapitre 15 (Déplacement) du LDB.
- **Réalité** : Cette phrase (« Un Avantage ne peut pas dépasser le Bonus d'Initiative de chaque Personnage. ») figure dans le même encadré « OPTION : LIMITER LES AVANTAGES » du chapitre 14, pas du chapitre 15.
- **Preuve** : Source/Warhammer v4 - Livre de base version corrigée/14 - _GoBack.md l.197 : « Un Avantage ne peut pas dépasser le Bonus d'Initiative de chaque Personnage. »
- **Fix** : Remplacer « LDB 15-Dépl l.15 » par « LDB 14 ».
- **Vérif adversariale** : Lu Source/Warhammer v4 - Livre de base version corrigée/14 - _GoBack.md lignes 189-198 : titre « # Avantage » puis « # OPTION : LIMITER LES AVANTAGES » avec la puce « Un Avantage ne peut pas dépasser le Bonus d'Initiative de chaque Personnage. » — confirme que la source est bien le chapitre 14, pas 15.

### src/engine/exposure.ts:93 — sévérité moyenne
- **Quote** : Cible (et base) d'UN Test d'Exposition au froid : Résistance +0, −10 sans manteau ni cape (ch.66 l.46).
- **Affirme** : La pénalité au Test de Froid sans manteau/cape est sourcée à LDB ch.66 l.46.
- **Réalité** : Le chapitre 66 du LDB ("66 - Nourriture, boisson et hébergement.md") ne contient aucune mention de Manteau/Cape/froid. C'est le chapitre 65 ("65 - Vêtements et accessoires.md", l.44) qui porte la règle : « Manteau : protège le porteur contre les éléments et le froid extrême ; sans un bon manteau ou similaire, vous recevrez des pénalités pour résister à l'exposition au froid ». La même référence erronée (ch.66) est répétée dans le commentaire d'en-tête (l.9-10), `hasCoat` (l.41) et `exposureNight` (l.132).
- **Preuve** : Source/Warhammer v4 - Livre de base version corrigée/65 - Vêtements et accessoires.md:44 — « Manteau : protège le porteur contre les éléments et le froid extrême ; sans un bon manteau ou similaire, vous recevrez des pénalités pour résister à l'exposition au froid (voir page 181). »
- **Fix** : Remplacer toutes les occurrences de « ch.66 l.46 » par « ch.65 l.44 » (LDB 65 - Vêtements et accessoires) dans exposure.ts.
- **Vérif adversariale** : Grep sur les deux .md du LDB : "65 - Vêtements et accessoires.md":44 contient « Manteau : protège le porteur contre les éléments et le froid extrême ; sans un bon manteau ou similaire, vous recevrez des pénalités pour résister à l'exposition au froid ». "66 - Nourriture, boisson et hébergement.md" n'a aucun hit sur manteau/froid/exposition (seul hit : Courante galopante, sans rapport). Le mismatch de chapitre (66 au lieu de 65) est donc réel, pas un simple drift de ligne — src/engine/exposure.ts cite le mauvais chapitre à plusieurs endroits (l.9-10, 41, 93, 132 selon le constat).

### src/engine/qualities/dispatch.ts:101 — sévérité moyenne
- **Quote** : ±DR au Test d'ATTAQUE avec l'arme (Imprécise -1, LDB 63 l.19) — réussi ou raté.
- **Affirme** : La règle Imprécise (-1 DR à l'attaque) est tirée du chapitre LDB 63 (Armures).
- **Réalité** : Imprécise est un Atout/Défaut D'ARME, décrit au chapitre LDB 62 « Les armes » (« Les armes Imprécises sont difficiles à manier... Subissez une pénalité de -1 DR quand vous utilisez l'arme pour attaquer. »). Le chapitre 63 est « Armures » et ne contient pas cette règle.
- **Preuve** : Source/Warhammer v4 - Livre de base version corrigée/62 - Les armes.md:321-323 : "# Imprécise\n\nLes armes Imprécises sont difficiles à manier... Subissez une pénalité de -1 DR quand vous utilisez l'arme pour attaquer." — absent de 63 - Armures.md.
- **Fix** : Remplacer « LDB 63 l.19 » par « LDB 62 l.~321 ».
- **Vérif adversariale** : Lu src/engine/qualities/dispatch.ts:101 (commentaire cite « LDB 63 l.19 ») et Source/Warhammer v4 - Livre de base version corrigée/62 - Les armes.md (contient la qualité Imprécise dans le tableau des armes, ligne ~99). Le chapitre 63 est Armures, sans lien avec Imprécise. Le même fichier ligne 37 contient d'ailleurs une autre référence « LDB 63 l.20 » pour la préséance Imprécise/Précise, tout aussi fausse mais hors périmètre du constat cité.

### src/engine/qualities/dispatch.ts:107 — sévérité moyenne
- **Quote** : +DR à TOUT Test de défense (Parade ET Esquive) contre l'arme de l'attaquant (Lente +1, LDB 63 l.26).
- **Affirme** : La règle Lente (+1 DR aux tests de défense contre elle) vient de LDB 63 (Armures).
- **Réalité** : Lente est un Atout/Défaut D'ARME décrit au chapitre 62 (« les adversaires gagnent un bonus de +1 DR à tout Test pour se défendre contre vos attaques »). Absente du chapitre 63.
- **Preuve** : Source/Warhammer v4 - Livre de base version corrigée/62 - Les armes.md:329-331 : "# Lente ... les adversaires gagnent un bonus de +1 DR à tout Test pour se défendre contre vos attaques."
- **Fix** : Remplacer « LDB 63 l.26 » par « LDB 62 l.~331 ».
- **Vérif adversariale** : Grep "Lente" dans Source/.../62 - Les armes.md l.329-331 : "# Lente ... les adversaires gagnent un bonus de +1 DR à tout Test pour se défendre contre vos attaques." Grep "Lente" dans 63 - Armures.md : 0 occurrence. Code src/engine/qualities/dispatch.ts l.107 cite "LDB 63 l.26" pour vsDefenseDRAdjust (Lente).

### src/engine/qualities/dispatch.ts:164 — sévérité moyenne
- **Quote** : Lente (LDB 63 l.25) : le porteur d'une arme Lente (active) frappe en dernier dans le Round.
- **Affirme** : Le comportement « frappe en dernier » de Lente est sourcé au chapitre 63 (Armures).
- **Réalité** : Même règle Lente que ci-dessus, décrite au chapitre 62 (« Les Personnages utilisant des armes Lentes frappent toujours en dernier lors d'un Round »), pas au chapitre 63.
- **Preuve** : Source/Warhammer v4 - Livre de base version corrigée/62 - Les armes.md:329-331.
- **Fix** : Remplacer « LDB 63 l.25 » par « LDB 62 l.~329 ».
- **Vérif adversariale** : Grep "Lente" dans Source/.../62 - Les armes.md → trouvé lignes 329-331 (« Les Personnages utilisant des armes Lentes frappent toujours en dernier lors d'un Round... »). Grep "Lente" dans 63 - Armures.md → 0 match. Confirme l'écart de chapitre (pas juste un drift de ligne).

### src/engine/qualities/dispatch.ts:174 — sévérité moyenne
- **Quote** : Dangereuse (LDB 63 l.13-14) : ce jet RATÉ avec cette arme inclut-il un 9 (dizaines ou unités) ?
- **Affirme** : La règle Dangereuse (fumble sur un 9) est sourcée au chapitre 63 (Armures).
- **Réalité** : Dangereuse est un Atout/Défaut D'ARME décrit au chapitre 62 (section « Dangereuse » ligne ~313), absente du chapitre 63.
- **Preuve** : Source/Warhammer v4 - Livre de base version corrigée/62 - Les armes.md:313 : "# Dangereuse".
- **Fix** : Remplacer « LDB 63 l.13-14 » par « LDB 62 l.~313 ».
- **Vérif adversariale** : Grep sur les deux fichiers source : 63 - Armures.md → 0 match pour "Dangereuse" ; 62 - Les armes.md → 7 matches dont ligne 313 "# **Dangereuse**" (titre de section) et lignes 78-97 (tableau d'armes listant le trait). Lu dispatch.ts:174 : commentaire "Dangereuse (LDB 63 l.13-14)" au-dessus de dangerousNine().

### src/engine/qualities/dispatch.ts:235 — sévérité moyenne
- **Quote** : Épuisante (`chargeGated`, LDB 63 l.16-17) : les Atouts de Dégâts DE L'ARME ne valent qu'en Charge
- **Affirme** : La règle Épuisante (Atouts de dégâts gagnés seulement en Charge) est sourcée au chapitre 63 (Armures).
- **Réalité** : Épuisante est un Défaut D'ARME décrit au chapitre 62 (« Vous ne gagnez les bénéfices des Traits d'arme Percutante et Dévastatrice que lors d'un Tour où vous Chargez »), absente du chapitre 63.
- **Preuve** : Source/Warhammer v4 - Livre de base version corrigée/62 - Les armes.md:317-319 : "# Épuisante ... Vous ne gagnez les bénéfices des Traits d'arme Percutante et Dévastatrice que lors d'un Tour où vous Chargez."
- **Fix** : Remplacer « LDB 63 l.16-17 » par « LDB 62 l.~319 ».
- **Vérif adversariale** : Lu src/engine/qualities/dispatch.ts lignes 222-250 : deux citations « LDB 63 l.16-17 » (lignes 225 et 237) pour la règle Épuisante/chargeGated. Lu Source/.../62 - Les armes.md lignes 317-319 : le chapitre 62 contient bien le texte exact de la règle Épuisante sous le titre `# **Épuisante**`. Le chapitre 63 est celui des Armures, sans rapport avec ce Trait d'arme. La référence de chapitre dans le code est donc fausse (63 au lieu de 62), même en tenant compte du drift de numéro de ligne post-Marker.

### src/engine/rest.ts:8 — sévérité moyenne
- **Quote** : Cauchemars (21-Psychologie l.92) : héros marqué ⇒ Test de Calme Facile (+40) ou Exténué regagné.
- **Affirme** : LDB 21 codifie une mécanique générale « Cauchemars » : tout héros marqué subit chaque nuit un Test de Calme Facile (+40), sur échec regagne un Exténué.
- **Réalité** : Le passage cité (LDB 21, chapitre Psychologie, section sur les traumatismes psychologiques) est un ENCADRÉ D'EXEMPLE pour un PNJ fictif nommé Horst, illustrant UNE façon parmi plusieurs (« cauchemars, substances illicites, flashbacks, Hostilité/Haine, Phobie ») dont un MJ peut incarner narrativement un traumatisme — ce n'est pas une sous-mécanique universelle chiffrée du livre. Le code (`c.nightmares` + `nightmareCheck`) généralise cet exemple ponctuel en règle systémique appliquée à tout personnage marqué.
- **Preuve** : Source (21 - Psychologie.md l.93-95) : « … vous pouvez choisir de partir sur des pistes différentes : cauchemars, substances illicites, flashbacks, Hostilité ou Haine envers un groupe en particulier, ou une Phobie. […] Exemple : Le village de Horst a été ravagé… chaque nuit, Horst effectue un Test de Calme Facile (+40). Sur un échec, il est en proie à de terribles cauchemars et gagne l'État Exténué. »
- **Fix** : Documenter `nightmares` comme choix de conception (règle maison inspirée de l'exemple Horst), pas comme une règle générale du livre — reformuler le commentaire en conséquence.
- **Vérif adversariale** : Lu Source/Warhammer v4 - Livre de base version corrigée/21 - Psychologie.md lignes 89-92 : « La vie de la grande majorité des Reiklanders est désagréable... vous pouvez choisir de partir sur des pistes différentes : cauchemars, Hostilité ou Haine..., substances illicites, flashbacks... ou une Phobie... Exemple : Le village de Horst a été ravagé par un terrible incendie... chaque nuit, Horst effectue un Test de Calme Facile (+40). Sur un échec, il est en proie à de terribles cauchemars et gagne l'État Exténué. » — confirme que src/engine/rest.ts l.8 généralise à tort un exemple ponctuel en règle systémique (`nightmares`/`nightmareCheck`).

### src/engine/tests.ts:180 — sévérité moyenne
- **Quote** : Influence « +`by` DR » sur un jet DÉJÀ résolu (Pacte du Marteau, LDB 17 l.73 ; bonus de Piège-lame, LDB 62) :
- **Affirme** : Le mécanisme `bumpSL` (+1 DR sur un jet déjà résolu) provient d'une règle nommée « Pacte du Marteau », sourcée LDB 17 l.73.
- **Réalité** : « Pacte du Marteau » n'existe nulle part dans Source/ (aucune occurrence dans tout le dépôt) ni ailleurs dans le code (qui parle partout de « Chance » et « Sombre Pacte », jamais de « Pacte du Marteau »). LDB 17 l.73 est la section Résilience « Je ne faillirai pas ! » (qui, sur un Test opposé, garantit une victoire à DR+1 — pas un +1 DR générique après coup). Le vrai mécanisme « +1 DR à un Test après qu'il a été effectué » est la Chance (LDB 17, section « Dépenser de la Chance », l.24), et c'est bien ce que `rollFlowFactory.ts` (même bumpSL) documente correctement ailleurs : « +1 DR de Chance (LDB 17 l.84) ».
- **Preuve** : Source/Warhammer v4 - Livre de base version corrigée/17 - Destin et Résistance.md l.19-25 : « Voici les trois options... Ajouter +1 DR à un Test après qu'il a été effectué. » (sous Chance) vs l.68 « Je ne faillirai pas ! : au lieu de lancer les dés... ». src/state/rollFlowFactory.ts l.371 : « +1 DR de Chance (LDB 17 l.84) : lentille = applyRoll(bumpSL) ».
- **Fix** : Remplacer « Pacte du Marteau, LDB 17 l.73 » par « Chance, LDB 17 l.24/84 » (aligné sur l'attribution correcte déjà utilisée dans rollFlowFactory.ts).
- **Vérif adversariale** : Lu src/engine/tests.ts l.170-190 (quote confirmée telle que citée) ; Source/.../17 - Destin et Résistance.md l.15-44 (Chance l.19-25 avec les 3 options dont « +1 DR après le Test » l.24 ; Résilience « Je ne faillirai pas ! » l.68, mécanisme différent) ; Grep « Pacte du Marteau » sur tout le dépôt → 1 seule occurrence (tests.ts:180) ; rollFlowFactory.ts l.371 attribue déjà bumpSL à « Chance (LDB 17 l.84) ».

### src/engine/weaponDamage.ts:104 — sévérité moyenne
- **Quote** : Profil d'**Arme improvisée** (LDB 62 l.29/178/185) : Dégâts `+BF+1`, Atout `Inoffensive`, **plus aucun autre Atout**, Allonge Moyenne.
- **Affirme** : Le commentaire attribue au RAW (LDB 62) une Allonge « Moyenne » pour l'Arme improvisée, comme si c'était une valeur sourcée du Tableau des armes.
- **Réalité** : Le Tableau des armes (LDB 62, section BASE, ligne « Arme improvisée ») indique Allonge = « Variable », pas « Moyenne ». « Moyenne » est un choix d'implémentation (nécessaire car le moteur a besoin d'une valeur concrète de reachRank) mais il n'est pas signalé comme tel — il est présenté comme faisant partie du profil RAW cité.
- **Preuve** : Source/Warhammer v4 - Livre de base version corrigée/62 - Les armes.md l.31 : « | Arme improvisée | ND | Variable | ND | Variable | +BF +1 | Inoffensive |» (colonnes Prix/Enc/Disponibilité/Allonge/Dégâts/Atouts — Allonge = Variable). Code : `function improvisedProfile(w) { return { ...w, damage: {...}, qualities: [...], damageTaken: 0, reach: 'Moyenne' }; }`
- **Fix** : Reformuler en signalant explicitement que « Moyenne » est un choix d'implémentation (RAW = Allonge Variable, non exploitable telle quelle par reachRank), pas une valeur RAW.
- **Vérif adversariale** : Lu Source/Warhammer v4 - Livre de base version corrigée/62 - Les armes.md l.28-34 : ligne « Arme improvisée | ND | Variable | ND | Variable | +BF +1 | Inoffensive » — colonnes Prix/Enc/Dispo/Allonge/Dégâts/Atouts, Allonge = Variable. Lu src/engine/weaponDamage.ts l.104-109 : commentaire dit « Allonge Moyenne » sourcée LDB 62, code fixe reach: 'Moyenne'.

### src/state/advancement.ts:110 — sévérité moyenne
- **Quote** : /** Coût d'un changement vers une carrière donnée (id, sélecteur) : +100 hors Classe (LDB 08 l.9). */
- **Affirme** : La règle du surcoût de +100 PX pour changer vers une carrière d'une autre Classe se trouve au chapitre LDB 08.
- **Réalité** : Le chapitre 08 du LDB est « Statut » (Échelons/Standing) et ne traite pas du changement de Carrière. La règle citée (« Si vous voulez commencer le premier Niveau d'une Carrière d'une Classe différente, il vous en coûtera 100 PX supplémentaires ») se trouve dans le chapitre 07 « Carrières », à la ligne 144 de `Source/Warhammer v4 - Livre de base version corrigée/07 - Carrières.md`.
- **Preuve** : 07 - Carrières.md l.144 : « Si vous voulez commencer le premier Niveau d'une Carrière d'une Classe différente, il vous en coûtera 100 PX supplémentaires. » — 08 - Statut.md l.3-11 ne parle que d'Échelons/Standing.
- **Fix** : Remplacer « LDB 08 l.9 » par « LDB 07 l.144 ».
- **Vérif adversariale** : Grep sur "100 PX supplémentaires" dans Source/Warhammer v4 - Livre de base version corrigée/ : trouvé exclusivement dans 07 - Carrières.md l.144 (« Si vous voulez commencer le premier Niveau d'une Carrière d'une Classe différente, il vous en coûtera 100 PX supplémentaires »). Aucune occurrence dans 08 - Statut.md.

### src/state/advancement.ts:255 — sévérité moyenne
- **Quote** : changeCost + (findCareerById(careerId)?.class === curClass ? 0 : 100); // LDB 08 l.9-11
- **Affirme** : Le surcoût de +100 PX pour un changement de Classe est sourcé au chapitre LDB 08.
- **Réalité** : Même erreur d'attribution que ci-dessus : la règle est en LDB 07 (Carrières), l.144, pas en LDB 08 (Statut).
- **Preuve** : 07 - Carrières.md l.144 : « … Classe différente, il vous en coûtera 100 PX supplémentaires. »
- **Fix** : Remplacer « LDB 08 l.9-11 » par « LDB 07 l.144 ».
- **Vérif adversariale** : Lu Source/Warhammer v4 - Livre de base version corrigée/07 - Carrières.md : l.144 « Si vous voulez commencer le premier Niveau d'une Carrière d'une Classe différente, il vous en coûtera 100 PX supplémentaires » + table récap l.159 « Embrasser une nouvelle Classe +100 PX ». Grep de « 100 PX »/« classe différente » dans 08 - Statut.md : aucune occurrence — le chapitre Statut ne traite pas de ce sujet. Le commentaire cité en code (« LDB 08 l.9-11 ») pointe donc le mauvais chapitre ; la bonne référence est LDB 07 l.144.

### src/state/combat/hitModifiers.ts:186 — sévérité moyenne
- **Quote** : // Martyr (LDB 42 — L13) : « Vous recevez tous les Dégâts subis en principe par vos cibles » —
- **Affirme** : Le miracle Martyr se trouve au chapitre LDB 42.
- **Réalité** : Le chapitre 42 du LDB est « Miracles » (règles générales) — il ne contient PAS le texte du miracle Martyr. Le miracle « Martyr » est listé dans le chapitre 43 « Miracles de Rhya » (l.99-107 : « Vous recevez tous les Dégâts subis en principe par vos cibles [...] votre Bonus d'Endurance est doublé »).
- **Preuve** : Source/Warhammer v4 - Livre de base version corrigée/43 - Miracles de Rhya.md l.99 : `**Martyr**` ... l.107 : « Vous recevez tous les Dégâts subis en principe par vos cibles. [...] votre Bonus d'Endurance est doublé ». Aucune occurrence de « Martyr » dans le fichier `42 - Miracles.md`.
- **Fix** : Corriger la référence en `LDB 43` (Miracles de Rhya) — la même erreur de chapitre est dupliquée au commentaire de `martyrGuardOf` (ligne ~38).
- **Vérif adversariale** : Grep « Martyr » dans tout le dossier LDB : 3 fichiers touchés (85 - Traits de créature.md, 43 - Miracles de Rhya.md, 05 - _gjdgxs.md) — zéro occurrence dans 42 - Miracles.md. Lecture de 43 - Miracles de Rhya.md l.99-101 : « **Martyr** ... **Portée :** (Sociabilité) mètres » confirme le miracle et sa citation. src/state/combat/hitModifiers.ts contient la référence erronée « LDB 42 » à la ligne 38 (JSDoc de martyrGuardOf) ET à la ligne 187 (commentaire inline du modificateur 'martyr') — l'erreur est bien dupliquée comme signalé dans le fix suggéré.

### src/state/combatSetup.ts:39 — sévérité moyenne
- **Quote** : puis place les porteurs d'arme « Lente » en dernier (LDB 63 l.25).
- **Affirme** : L'Atout d'arme « Lente » est défini au chapitre 63 (Armures) du LDB.
- **Réalité** : « Lente » est un Atout d'ARME, défini au chapitre 62 « Les armes » (l.329-331 : « Les armes Lentes sont lourdes et massives... Les Personnages utilisant des armes Lentes frappent toujours en dernier lors d'un Round »). Le chapitre 63 « Armures » ne mentionne pas du tout « Lente ».
- **Preuve** : Source/Warhammer v4 - Livre de base version corrigée/62 - Les armes.md l.329-331 contient la définition exacte citée ; grep sur 63 - Armures.md pour « Lente » = 0 résultat.
- **Fix** : Corriger la référence en « LDB 62 l.329 » (Les armes), pas 63 (Armures).
- **Vérif adversariale** : Grep « Lente » sur 63 - Armures.md = 0 résultat ; sur 62 - Les armes.md = matches l.44-45 (armes lourdes taguées Lente) et l.329-331 (« # Lente » : « frappent toujours en dernier lors d'un Round »). Le code src/state/combatSetup.ts contient bien la citation « LDB 63 l.25 » à la ligne visée.

### src/state/massBattleFlow.ts:617 — sévérité moyenne
- **Quote** : Construit la `BattleResolution` d'un Test (Scène de Test/Activité de préparation) : Succès Stupéfiant (DR ≥ 6) fait tomber le capitaine/général (`generalDown`, l.208/217).
- **Affirme** : Le RAW (ADE II ch.8, Scènes « Ligne de mire » l.208 et « Survol » l.217) lierait la mort du général/capitaine ennemi à un Succès Stupéfiant (DR ≥ 6) du Test de Scène.
- **Réalité** : Le texte source ne pose aucun seuil de DR pour la mort du général : à « Ligne de mire » (l.208) c'est une conséquence narrative optionnelle indépendante du DR de l'attaque (« Si c'est le général qui est tué ou neutralisé, la Puissance diminue encore de -5 ») ; à « Survol » (l.217) le Succès Stupéfiant ne sert qu'à SE RAPPROCHER pour une attaque au Corps à corps — la mort du général dépend ensuite de la réussite de CETTE attaque, pas d'un DR≥6 de la Scène elle-même. `testResolution` applique pourtant `generalDown: success && sl >= 6` génériquement à TOUTE Scène de Test, ce qui invente une règle mécanique absente du livre à cet endroit précis.
- **Preuve** : ADE II ch.8 l.208 : « En cas de Succès, l'ennemi perd –5 de Puissance. Si c'est le général qui est tué ou neutralisé, la Puissance diminue encore de –5. » ; l.217 : « En cas de succès Stupéfiant (+6), ils peuvent se rapprocher... Si l'attaque réussit, l'ennemi perd –5 de Puissance. Si le général ennemi est neutralisé ou tué, la Puissance diminue encore de –15. »
- **Fix** : Reformuler le commentaire en assumant explicitement DR≥6 comme proxy/simplification du « général tué », pas comme une règle tirée telle quelle de l.208/217.
- **Vérif adversariale** : Lu Source/Warhammer v4 - Les archives de l'Empire volume 2/08 - Le théâtre de la guerre.md lignes 206-218 : « Ligne de mire » (« En cas de Succès, l'ennemi perd –5 de Puissance. Si c'est le général qui est tué ou neutralisé, la Puissance diminue encore de –5. » — aucune mention de DR/Succès Stupéfiant) et « Survol » (« En cas de succès Stupéfiant (+6), ils peuvent se rapprocher... Si l'attaque réussit, l'ennemi perd –5... Si le général ennemi est neutralisé ou tué, la Puissance diminue encore de –15. » — le SL≥6 conditionne seulement le rapprochement, pas la mort). Puis src/state/massBattleFlow.ts lignes 617-621 (`testResolution`, `generalDown: success && sl >= 6`) et src/data/activities.json lignes 1050-1096 (ligne-de-mire) / 1126-1165 (survol) confirment que la bande `when: 'generalDown'` (-5 / -15) est déclenchée automatiquement dès que le Test de Scène atteint DR≥6, sans second jet ni choix narratif — mismatch réel avec le RAW cité.

### src/state/merchantFlow.ts:329 — sévérité moyenne
- **Quote** : Option 2 (LDB 60 l.22) : ¼ par défaut (resaleRate/2) ; ½ si le Marchandage de vente est GAGNÉ.
- **Affirme** : La règle du gain de revente (¼ par défaut, ½ si Marchandage de vente gagné) est tirée de LDB chapitre 60 (Fabrication), ligne ~22, sous une étiquette « Option 2 ».
- **Réalité** : Le chapitre 60 (« Fabrication ») ne traite que des Atouts/Défauts d'objet (qualité de fabrication) ; sa ligne ~22 décrit l'Atout « Pratique » (pénalité de Test réduite), sans rapport avec un prix de vente. La règle réellement citée (« vous gagnez généralement entre un quart et la moitié de la valeur listée de l'objet après le Marchandage ») se trouve dans le chapitre 59 (« Faire son marché »), section « Vente », l.54 — pas dans le 60, et sans notion d'« Option 2 » (ce n'est pas une règle optionnelle numérotée dans le livre).
- **Preuve** : Source/Warhammer v4 - Livre de base version corrigée/59 - Faire son marché.md l.54 : « le prix de base quand vous vendez est moitié moins cher que le prix listé de l'objet, ce qui signifie que […] vous gagnez généralement entre un quart et la moitié de la valeur listée de l'objet après le Marchandage. » — contre Source/.../60 - Fabrication.md l.20-22 : « Fabriqué de façon experte […] Un échec à un Test utilisant cet objet reçoit +1 DR. »
- **Fix** : Remplacer « LDB 60 l.22 » par « LDB 59 l.54 » et retirer l'étiquette fantôme « Option 2 ».
- **Vérif adversariale** : Lu Source/Warhammer v4 - Livre de base version corrigée/59 - Faire son marché.md l.54-62 (règle vente ¼-½) et 60 - Fabrication.md l.20-22 (Atout Pratique) : les deux confirment le contenu cité par le finding.

### src/state/merchants/defs/Armurier.ts:8 — sévérité moyenne
- **Quote** : resaleRate: 0.5, // base ½ du prix listé (LDB 60 l.22) ; Marchandage la module ¼–½
- **Affirme** : La règle du taux de rachat (½, modulé ¼–½ par le Marchandage) figure au chapitre LDB 60.
- **Réalité** : Cette règle appartient au chapitre 59 « Faire son marché » (section Vente), pas au chapitre 60 (Fabrication, qui traite des Atouts/Défauts d'objet).
- **Preuve** : Source/Warhammer v4 - Livre de base version corrigée/59 - Faire son marché.md l.54 : « le prix de base quand vous vendez est moitié moins cher […] entre un quart et la moitié de la valeur listée de l'objet après le Marchandage. »
- **Fix** : Remplacer « LDB 60 l.22 » par « LDB 59 » (Faire son marché).
- **Vérif adversariale** : Lu src/state/merchants/defs/Armurier.ts l.8 : commentaire "resaleRate: 0.5 ... (LDB 60 l.22)". Lu Source/.../59 - Faire son marché.md : section "# Marchandage" (l.37) explique le Test opposé Marchandage/Évaluation et la modulation du prix ; c'est ce chapitre, pas le 60, qui contient la règle de rachat citée.

### src/state/merchants/defs/Herboriste.ts:8 — sévérité moyenne
- **Quote** : resaleRate: 0.5, // base ½ du prix listé (LDB 60 l.22) ; Marchandage la module ¼–½
- **Affirme** : La règle du taux de rachat (½, modulé ¼–½ par le Marchandage) figure au chapitre LDB 60.
- **Réalité** : Cette règle appartient au chapitre 59 « Faire son marché » (section Vente), pas au chapitre 60 (Fabrication, qui traite des Atouts/Défauts d'objet).
- **Preuve** : Source/Warhammer v4 - Livre de base version corrigée/59 - Faire son marché.md l.54 : « le prix de base quand vous vendez est moitié moins cher […] entre un quart et la moitié de la valeur listée de l'objet après le Marchandage. »
- **Fix** : Remplacer « LDB 60 l.22 » par « LDB 59 » (Faire son marché).
- **Vérif adversariale** : Lu src/state/merchants/defs/Herboriste.ts l.8 : commentaire cite "LDB 60 l.22". Grep de "Marchandage"/"prix de base" dans Source/.../59 - Faire son marché.md confirme la présence de la règle de rachat et de la section Marchandage (l.37-62) dans ce chapitre 59, pas dans le 60.

### src/state/merchants/types.ts:14 — sévérité moyenne
- **Quote** : /** Taux de rachat : ½ du prix listé sur un Marchandage de vente GAGNÉ (LDB 60 l.22) ; sinon ¼ (resaleRate/2). */
- **Affirme** : La règle du taux de rachat (½ du prix listé, ¼ à ½ selon Marchandage) se trouve au chapitre LDB 60.
- **Réalité** : Cette règle est dans le chapitre « 59 - Faire son marché », section Vente : « le prix de base quand vous vendez est moitié moins cher que le prix listé de l'objet, ce qui signifie que […] vous gagnez généralement entre un quart et la moitié de la valeur listée de l'objet après le Marchandage. » Le chapitre 60 (« Fabrication ») traite des Atouts/Défauts d'objet, pas du Marchandage/de la vente.
- **Preuve** : Source/Warhammer v4 - Livre de base version corrigée/59 - Faire son marché.md l.54 : « Généralement, le prix de base quand vous vendez est moitié moins cher que le prix listé de l'objet […] entre un quart et la moitié de la valeur listée ». Le chapitre 60 (Fabrication.md) ne mentionne ni Marchandage ni rachat.
- **Fix** : Remplacer « LDB 60 l.22 » par « LDB 59 » (Faire son marché, section Vente).
- **Vérif adversariale** : Lu Source/Warhammer v4 - Livre de base version corrigée/59 - Faire son marché.md l.54 : « le prix de base quand vous vendez est moitié moins cher que le prix listé de l'objet […] entre un quart et la moitié de la valeur listée de l'objet après le Marchandage ». Grep sur 60 - Fabrication.md pour 'Marchandage|vente|vendre|rachat' : 0 résultat — le chapitre 60 ne traite pas ce sujet.

### src/state/merchants/types.ts:19 — sévérité moyenne
- **Quote** : /** Valeur de Marchandage du marchand (opposant au Test, LDB 60 l.12). Défaut 40 si absent. */
- **Affirme** : La règle du Test opposé de Marchandage se trouve au chapitre LDB 60.
- **Réalité** : Le Test opposé de Marchandage est décrit au chapitre « 59 - Faire son marché », section Marchandage : « Marchandage est couramment utilisé par les clients et les vendeurs, généralement avec des Tests opposés. » Le chapitre 60 est Fabrication (Atouts/Défauts d'objet), sans rapport avec le Test de Marchandage.
- **Preuve** : Source/Warhammer v4 - Livre de base version corrigée/59 - Faire son marché.md l.43 : « Marchandage est couramment utilisé par les clients et les vendeurs, généralement avec des Tests opposés. »
- **Fix** : Remplacer « LDB 60 l.12 » par « LDB 59 » (Faire son marché, section Marchandage).
- **Vérif adversariale** : Lu Source/Warhammer v4 - Livre de base version corrigée/59 - Faire son marché.md l.43 : « Marchandage est couramment utilisé par les clients et les vendeurs, généralement avec des Tests opposés. » Le commentaire src/state/merchants/types.ts:19 cite « LDB 60 l.12 » pour ce même Test opposé — mismatch de chapitre confirmé (pas un simple drift de ligne, le chapitre lui-même est faux).

### src/state/restFlow.ts:164 — sévérité moyenne
- **Quote** : Contagion de promiscuité (chambrée/campement — LDB 20 l.185, 1 Test de Contraction par jour).
- **Affirme** : La contagion de promiscuité en chambrée/campement se résout par 1 Test de Contraction par JOUR (implémenté comme 1 test par nuit de repos), et la règle se trouve à LDB 20 l.185.
- **Réalité** : LDB 20 l.185 pointe la section « Malaise », sans rapport avec la contagion. Le seul mécanisme RAW de contagion par proximité dans ce chapitre est le symptôme « Toux et éternuements » (l.204-206) : « Tout Personnage se trouvant dans votre environnement immédiat s'expose à la maladie […] et doit effectuer un Test pour en éviter la Contraction UNE FOIS PAR HEURE ENTAMÉE D'EXPOSITION » — une cadence HORAIRE, pas quotidienne. Le code applique un seul jet par nuit de sommeil (`runContagion`/`collectContagion`), ce qui sous-échantillonne drastiquement la fréquence RAW (une nuit de 8h devrait produire ~8 jets, pas 1) sans le signaler comme un choix d'abstraction.
- **Preuve** : LDB 20 l.204-206 : « Vous toussez et éternuez régulièrement, propageant ainsi votre maladie tout autour de vous. Tout Personnage se trouvant dans votre environnement immédiat s'expose à la maladie dont vous êtes porteur et doit effectuer un Test pour en éviter la Contraction une fois par heure entamée d'exposition. » ; src/engine/disease.ts:266 cite d'ailleurs correctement « l.206 » et « Toux » pour la même capacité `contagious`, ce qui contredit l'attribution l.185/promiscuité de restFlow.ts.
- **Fix** : Corriger la réf (l.206, « Toux et éternuements ») et documenter explicitement que le passage à 1 jet/nuit est une abstraction de jouabilité (pas la cadence RAW horaire), ou implémenter le nombre d'heures d'exposition réelles.
- **Vérif adversariale** : Lu Source/…/20 - Maladies et infections.md : l.204-206 « Vous toussez et éternuez régulièrement… doit effectuer un Test pour en éviter la Contraction une fois par heure entamée d'exposition » ; l.186 = en-tête « Malaise » (l.185 hors-sujet). Lu src/state/restFlow.ts (commentaires « LDB 20 l.185, 1 Test de Contraction par jour », `runContagion` = 1 jet/nuit) et src/engine/disease.ts:266 (« Toux & éternuements, l.206 » pour la même capacité `contagious`) — confirme la divergence de réf ET de cadence (horaire RAW vs 1×/nuit codé).

### src/state/store.ts:156 — sévérité moyenne
- **Quote** : Le set d'armes a-t-il déjà été changé ce Tour ? (1 switch gratuit/tour — LDB 13 l.116). Reset au tour.
- **Affirme** : Le RAW (LDB ch.13) fixerait le changement de set d'armes à UNE fois gratuite par Tour.
- **Réalité** : LDB 13 ("Actions gratuites", l.104-106) dit seulement que dégainer une arme est une Action gratuite et que c'est le MJ qui décide de ce qui coûte l'Action ou non — aucun nombre de fois par Round n'est fixé dans le texte. Le plafond "1×/tour" est un choix d'implémentation, pas une valeur citée par le livre.
- **Preuve** : "Certaines choses que vous voudrez que votre Personnage accomplisse, ne seront pas considérées comme votre Action pour le Round – dégainer votre arme ou boire une potion, par exemple. C'est le MJ qui va décider ce qui vous coûtera votre Action..." (Source/Warhammer v4 - Livre de base version corrigée/13 - Combat.md l.106)
- **Fix** : Reformuler en "règle maison : 1 switch gratuit/tour (le RAW laisse ce plafond à l'appréciation du MJ, LDB 13 l.104-106)" plutôt que de citer la ligne comme source du chiffre.
- **Vérif adversariale** : Lu Source/Warhammer v4 - Livre de base version corrigée/13 - Combat.md lignes 104-106 : « Certaines choses que vous voudrez que votre Personnage accomplisse, ne seront pas considérées comme votre Action pour le Round – dégainer votre arme ou boire une potion, par exemple. C'est le MJ qui va décider ce qui vous coûtera votre Action... » — aucune limite de fréquence. Grep confirme que src/state/store.ts:156 porte toujours le commentaire cité tel quel, non corrigé.

### src/state/vision.ts:11 — sévérité moyenne
- **Quote** : les rayons de lumière (Bougie 10 m, Lanterne 20 m — `LDB 74 l.72`, `LDB 75 l.15`) et la Vision nocturne (20 m/niv — `LDB 11 l.143-147`)
- **Affirme** : La règle de portée de la Lanterne (20 m) se trouve au chapitre LDB 75.
- **Réalité** : Le chapitre 75 du LDB est « Mercenaires » — aucune règle de Lanterne. Bougie ET Lanterne sont toutes deux décrites au chapitre 74 « Possessions diverses » (l.43 : « Bougie : fournit un éclairage sur 10 mètres » ; l.58 : « Lanterne : fournit un éclairage sur 20 mètres »).
- **Preuve** : Source/Warhammer v4 - Livre de base version corrigée/74 - Possessions diverses.md l.43 et l.58 (les deux règles citées vivent dans LE MÊME chapitre 74, pas 75).
- **Fix** : Remplacer `LDB 75 l.15` par `LDB 74 l.~58` (même chapitre que la Bougie).
- **Vérif adversariale** : Lu Source/Warhammer v4 - Livre de base version corrigée/74 - Possessions diverses.md : l.18/31 tableau Bougie/Lanterne, l.43 "Bougie : fournit un éclairage sur 10 mètres", l.58 "Lanterne : fournit un éclairage sur 20 mètres" — les deux règles vivent dans le même chapitre 74. Lu src/state/vision.ts l.9-12 : le commentaire cite bien `LDB 75 l.15` pour la Lanterne.

### src/state/combat/hitModifiers.ts:38 — sévérité basse
- **Quote** : /** Martyr (LDB 42 — L13) : le prêtre (vivant, présent) qui encaisse à la place de `target`, ou null. */
- **Affirme** : Réf. LDB 42 pour le miracle Martyr.
- **Réalité** : Même mismatch de chapitre que ligne 186 : le miracle Martyr est au chapitre 43 (« Miracles de Rhya »), pas 42 (« Miracles », règles générales).
- **Preuve** : Source/Warhammer v4 - Livre de base version corrigée/43 - Miracles de Rhya.md l.99-107.
- **Fix** : Corriger en `LDB 43` (doublon du même mismatch corrigé une fois suffit pour les deux occurrences).
- **Vérif adversariale** : Grep « Martyr » sur le dossier LDB confirme 1 seul chapitre pertinent : 43 - Miracles de Rhya.md, section « Martyr » l.99 (Portée: (Sociabilité) mètres, Cible: 1). Le commentaire cité dans hitModifiers.ts:38 dit « LDB 42 — L13 ». Le chapitre 42 générique « Miracles » n'a pas la section Martyr. Même mismatch que celui déjà repéré ailleurs dans le fichier.


## RAW-LITE — paraphrase de règle là où seule la réf nue devrait figurer (3)

### src/engine/disponibilite.ts — sévérité basse
- **Quote** : Stock SANS Test de Disponibilité (règle optionnelle « système d'achat/vente simplifié », LDB 59 l.15)
- **Affirme** : Le LDB nomme cette règle optionnelle « système d'achat/vente simplifié » en page 292 (l.15).
- **Réalité** : Le LDB 59 (« Faire son marché ») ne contient nulle part la formule « système d'achat/vente simplifié » ; le passage réel (§7) dit seulement : « Le MJ peut préférer faire jouer chaque visite sur un marché, auprès d'un colporteur ou d'une échoppe. Cela signifie que les Tests de Disponibilité ne sont pas requis, car le MJ indique simplement ce qui est disponible ou non. » — la règle décrite par le code (stock complet sans jet) correspond bien à l'esprit du texte, mais le nom entre guillemets est inventé, pas une citation.
- **Preuve** : Source/Warhammer v4 - Livre de base version corrigée/59 - Faire son marché.md l.7 : « Les règles suivantes concernant l'achat et la vente sont toutes optionnelles. Le MJ peut préférer faire jouer chaque visite sur un marché... Cela signifie que les Tests de Disponibilité ne sont pas requis... »
- **Fix** : Retirer les guillemets ou reformuler sans citer un nom qui n'existe pas dans le LDB (ex. « option MJ sans Test de Disponibilité, LDB 59 §1 »).
- **Vérif adversariale** : src/engine/disponibilite.ts:99 cite « système d'achat/vente simplifié » ; Source/Warhammer v4 - Livre de base version corrigée/59 - Faire son marché.md l.7 dit « Le MJ peut préférer faire jouer chaque visite sur un marché... Cela signifie que les Tests de Disponibilité ne sont pas requis » — concept présent, nom inventé.

### src/state/jumpMove.ts:24 — sévérité basse
- **Quote** : Chute = vraie hauteur métrique (relief) entre la surface de décollage et celle d'atterrissage en  * contrebas (LDB 15 l.117-122 : 3 Dégâts/m) — plus de forfait par niveau, la hauteur du décor fait foi.
- **Affirme** : Paraphrase la règle de Chute du LDB comme « 3 Dégâts/m ».
- **Réalité** : Le texte RAW (LDB 15 « Chute », l.80) est : « vous subissez 3 Dégâts pour chaque mètre de chute +1d10 Dégâts » — le +1d10 est omis dans ce commentaire. Le calcul réel est correct ailleurs (`applyFall` dans combatEffects.ts applique bien `3*m + d10(rng)`), mais cette paraphrase isolée dans jumpMove.ts, si recopiée telle quelle par un futur agent, ferait perdre le +1d10.
- **Preuve** : Source/Warhammer v4 - Livre de base version corrigée/15 - Déplacement.md l.80 : « vous subissez 3 Dégâts pour chaque mètre de chute +1d10 Dégâts » ; src/state/combatEffects.ts l.585 : `Math.max(0, 3 * m + d10(rng) - be)`.
- **Fix** : Compléter la parenthèse en « 3 Dégâts/m + 1d10 » ou simplement renvoyer à `applyFall` sans reformuler la formule.
- **Vérif adversariale** : Lu jumpMove.ts l.24-25 (commentaire exact cité) ; Source/Warhammer v4 - Livre de base version corrigée/15 - Déplacement.md l.80 (RAW complet) ; combatEffects.ts l.585 (code correct appliquant la formule complète).

### src/state/mount.ts:24 — sévérité basse
- **Quote** : Trait Nerveux, LDB 14 l.221 : « une monture possédant le Trait Nerveux ne peut pas mener sa propre Action d'attaque »
- **Affirme** : Présente entre guillemets, comme une citation verbatim du livre, la phrase « une monture possédant le Trait Nerveux ne peut pas mener sa propre Action d'attaque ».
- **Réalité** : Le texte RAW ne formule jamais l'affirmation sous cette forme positive-Nerveux ; il dit l'inverse : « Une monture SANS le Trait Nerveux est un autre combattant à part entière, et peut effectuer sa propre Action pour attaquer les cibles Engagées. » (l.182 du fichier converti). La négation logique retenue par le code est correcte, mais la présentation en guillemets fait passer une paraphrase inversée pour une citation exacte.
- **Fix** : Reformuler sans guillemets de citation : « (Trait Nerveux, LDB 14 — a contrario de « une monture SANS Nerveux… peut effectuer sa propre Action ») ».
- **Vérif adversariale** : Lecture de src/state/mount.ts l.24-27 + Source/Warhammer v4 - Livre de base version corrigée/14 - _GoBack.md l.182. La citation du RAW positif est présente dans le même commentaire (l.26), ce qui atténue la gravité.


## EXCUSE — exceptions/déviations auto-légitimées (→ liste d'arbitrage utilisateur) (52)

### src/engine/combatFeatures/types.ts:117 — sévérité moyenne
- **Quote** : Le Test de Calme Accessible (+20) d'activation est supposé réussi (simplification documentée).
- **Affirme** : Sans Peur (LDB 10 l.859) est implémenté comme immunité inconditionnelle, sans le Test de Calme Accessible (+20) requis par le RAW.
- **Réalité** : LDB 10 (Talents) l.1049 : « Avec un seul Test de Calme Accessible (+20), vous pouvez ignorer les effets... ». Le RAW exige un jet ; l'implémentation le saute (fearImmune inconditionnel) — écart assumé et documenté comme tel, mais jamais arbitré.
- **Preuve** : Source/Warhammer v4 - Livre de base version corrigée/10 - Talents.md l.1045-1051 : « Sans peur (Ennemi) ... Avec un seul Test de Calme Accessible (+20), vous pouvez ignorer les effets d'Intimidation, de Peur ou de Terreur ».
- **Fix** : Statuer : soit modéliser le Test de Calme (jet réel), soit acter formellement l'exception RAW dans un registre de dérogations validées.
- **Vérif adversariale** : Vérification de Source/Warhammer v4 - Livre de base version corrigée/10 - Talents.md (Sans peur l.1045-1051 : « Avec un seul Test de Calme Accessible (+20)… ») + src/engine/combatFeatures/dispatch.ts l.62-66 (fearImmuneVs retourne un booléen, pas de Test).

### src/engine/items.ts:414 — sévérité moyenne
- **Quote** : L'arme DIRECTRICE est conservée tant qu'il reste une main (adaptation — le −20 CC/CT de l'amputation s'applique déjà via la séquelle) ;
- **Affirme** : Garder l'arme directrice tenue avec la main restante après amputation est une « adaptation » (déviation assumée du RAW), justifiée par le fait que la pénalité est déjà appliquée ailleurs.
- **Réalité** : Le mot « adaptation » signale une décision de design non tracée comme choix validé — dette d'arbitrage utilisateur potentielle sur une mécanique de combat active (traumatisme LDB 18).
- **Fix** : Si le choix est validé RAW/maison, le dire explicitement (« choix de design validé, pas une adaptation ») ; sinon faire trancher la règle par l'utilisateur.
- **Vérif adversariale** : Source primaire LDB 18 section « Amputation / Main » (lignes 261-265) : « Vous recevez une pénalité de -20… » — aucune mention du statut de l'arme. Spec `docs/superpowers/specs/2026-06-10-loadouts-deux-armes-design.md` (commit 9ff16a23) reconnaît explicitement « l'arme étant CONSERVÉE (adaptation) ».

### src/engine/policy.ts:209 — sévérité moyenne
- **Quote** : Les sous-effets conditionnels/durées des lignes AA restent en texte (arbitrage), le corps mécanique (Blessures + États immédiats + Mort) est appliqué.
- **Affirme** : La variante Aux Armes des Blessures/Critiques n'implémente que le « corps mécanique » ; les effets conditionnels/durées textuels de la table AA restent à l'arbitrage humain.
- **Réalité** : Déviation RAW assumée et documentée (implémentation partielle de la table AA) — dette signalée mais non tracée/validée formellement.
- **Fix** : Si acceptée, transformer les sous-effets récurrents (ex. durée d'un membre inutilisable) en `GameOp`/`Condition` structurés plutôt que du texte arbitré, ou documenter explicitement la liste des lignes AA concernées.
- **Vérif adversariale** : Fichiers vérifiés : src/engine/policy.ts l.209 (commentaire exact), src/engine/aaCritical.ts l.13-14 et 82 (implémentation), src/data/aa-criticals.json (preuves : l.179/388/455/730/815/1064/1123 — sous-effets textuels non structurés), docs/dette-et-lacunes.md l.58 (issue #38, non spécifiée).

### src/engine/travelStages.ts:105 — sévérité moyenne
- **Quote** : Paliers : ≤ ~25 km (village proche) = 1 ; jusqu'à ~150 km (ville à ville) = 2-4 ; au-delà, +1 par tranche de 50 km. Choix documenté — le canon ne chiffre pas la distance (l.32 « les cartes de l'Empire sont notoirement imprécises »).
- **Affirme** : stageCount() dérive le nombre d'Étapes d'un trajet à partir d'une distance en km via des paliers inventés, en le justifiant comme "choix documenté" faute de formule RAW chiffrée.
- **Réalité** : Le RAW (EDOC ch.5 l.25) ne se contente pas de laisser le nombre d'Étapes "à la discrétion du MJ" sans le chiffrer : il donne un mécanisme concret que le code omet totalement — le nombre d'Étapes est modifié par le score de Mouvement le plus faible du groupe (≤3 → +1 ou +2 Étapes ; toutes montures M≥6 → nombre d'Étapes divisé par deux, minimum 1). stageCount() ne prend aucun paramètre de Mouvement du groupe et remplace ce mécanisme RAW par une grille distance→étapes inventée.
- **Preuve** : Source/Warhammer v4 - 1.0 L'ennemi dans l'Ombre Compagnon/08 - CHAPITRE 5 - Voyager.md l.25 : « il est modifié par le score de Mouvement le plus faible des Personnages [...] Si ce chiffre est inférieur ou égal à 3, le voyage doit être augmenté de 1 ou 2 Étapes. Si tous les Personnages ont [...] un Mouvement de 6 ou plus, le nombre total d'Étapes est réduit de moitié ». src/engine/travelStages.ts::stageCount(distanceKm, countBonus) n'a aucun paramètre de Mouvement de groupe.
- **Fix** : Soit assumer clairement (et documenter) que le modificateur RAW par Mouvement du groupe est un manque connu à combler, soit l'implémenter dans stageCount (paramètre optionnel de Mouvement minimal du groupe).
- **Vérif adversariale** : Fichier src/engine/travelStages.ts signature l.102 et implémentation l.107-111 (aucun param Mouvement) ; source EDOC ch.5 extrait l.25 du texte lu confirme « modifié par le score de Mouvement le plus faible » avec les deux cas détaillés.

### src/state/landMarketFlow.ts:100 — sévérité moyenne
- **Quote** : Rumeurs commerciales (l.176-180) : en tendant l'oreille au marché, un Test de Ragot Complexe (−10) ; sur   // un succès, une rumeur signale les biens très recherchés → ils s'y vendent le DOUBLE (l.180). Roulé APRÈS   // les offres pour ne pas déplacer leur flux RNG. ADAPTATION assumée : le RAW fait entendre la rumeur dans une   // AUBERGE, pointant un AUTRE Lieu via l'index géographique du Reikland (absent de la carte de l'arène) ; ici la   // rumeur vaut pour le Lieu COURANT (modèle minimal endossé par la conception — cf. rapport #58).
- **Affirme** : Le RAW (MSRC ch.11 l.176-180) fait pointer la rumeur commerciale vers un AUTRE lieu (tiré via l'index géographique du Reikland), mais le jeu la fait porter sur le lieu courant — déviation reconnue et 'endossée par la conception'.
- **Réalité** : Confirmé par Source/Warhammer v4 - 2.0 Mort sur le Reik Compagnon/13 - CHAPITRE 11 - Règles du commerce.md l.180 : « lancez un d100 pour déterminer un emplacement à l'aide de l'index géographique des pages suivantes » — la rumeur RAW cible bien un lieu tiré au hasard, différent du lieu courant. C'est une déviation RAW non triviale (change où et quand la rumeur peut être exploitée) tracée seulement par un commentaire renvoyant à un rapport #58 non retrouvable dans le code.
- **Fix** : Confirmer/lier explicitement la décision (référencer un doc traçable, ex. docs/raw/, plutôt qu'un numéro de rapport interne) ou implémenter le tirage d'un lieu cible distinct si l'arène le permet.
- **Vérif adversariale** : Lecture MSRC ch.11 « Règles du commerce » section « QUE DE CALCULS ! » l.178-180 (pages originales l.176-180 approx., repérées par concept). Le RAW est explicite : d100 → index géographique → un emplacement différent du point de départ. Confirmé dans src/state/landMarketFlow.ts l.99-103, et appliqué l.222 via st (lieu courant).

### src/state/shipBattery.ts:12 — sévérité moyenne
- **Quote** : elle vit dans le flux/la modale (à câbler côté navigateur).
- **Affirme** : L'application des dégâts de la bordée par pièce reste à câbler côté navigateur/UI.
- **Réalité** : Confirmé par grep : `resolveBattery`/`BatteryPlan` ne sont consommés que par `shipCrew.ts` (assignation d'équipage) et le test unitaire ; aucun flux/modale n'applique encore les dégâts par pièce (pas de trace de `firedAttackBlock` appelé avec ce DR forcé) — le module est un plan PUR non encore intégré à un flux de jeu jouable.
- **Fix** : Garder le commentaire mais ouvrir un suivi explicite (ticket/roadmap) tant que l'intégration n'est pas câblée, pour ne pas laisser la dette invisible.
- **Vérif adversariale** : Fichier ship-battery.ts ligne 12 (le commentaire) ; combatSlice.ts 1054-1099 (implémentation complete du flux shipBatteryConfirm qui applique les dégâts ligne 1067) ; ShipBatteryModal.tsx (UI câblée) ; ship-battery.test.ts lignes 78-91 (test de bout-en-bout prouvant l'application des dégâts à la coque cible).

### src/engine/aaCritical.ts:13 — sévérité basse
- **Quote** : `desc` = « Effets supplémentaires » VERBATIM : les sous-effets conditionnels (durées, « membre inutilisable 1d10 Rounds », amputations page 180) y restent, arbitrés — rien n'est inventé.
- **Affirme** : Les sous-effets conditionnels/durées du texte AA (« Effets supplémentaires ») ne sont pas mécanisés, seulement affichés pour arbitrage.
- **Réalité** : Confirme la même implémentation partielle que `combat-aa-blessures` dans policy.ts (même dette, autre fichier) — recensée séparément car c'est un commentaire distinct qui justifie l'absence de mécanisation.
- **Fix** : Regrouper cette justification avec celle de policy.ts si un futur ticket mécanise ces sous-effets ; sinon aucun changement.
- **Vérif adversariale** : aaCritical.ts l.13-14 + aa-criticals.json (desc contiennent durées 1d10, amputations) + critical.ts l.59 (desc = DISPLAY-ONLY, jamais parsé) + policy.ts hint (même justification) = confirmation cohérente de l'excuse.

### src/engine/activities.ts:531 — sévérité basse
- **Quote** : Disponibilité ND/absente (objet jamais en vente) → Rare prudent (arbitrage documenté).
- **Affirme** : Arbitrage maison assumé pour combler un silence du RAW sur la Disponibilité d'un objet non chiffré.
- **Réalité** : Écart RAW non couvert par une règle citée — laissé en 'arbitrage documenté' sans validation traçable par l'utilisateur.
- **Fix** : Faire trancher/valider explicitement cet arbitrage par l'utilisateur, ou le retirer si non nécessaire.
- **Vérif adversariale** : Lue ch.23 (Activités) et ch.59 (Faire son marché) du LDB : RAW prescrit MJ-discrétionnaire pour la Disponibilité de l'Artisanat. Vérifié src/data/trappings.json : 3 objets avec availability="ND" (Licence de Guilde, Arme improvisée, Carte marine). Ces 3 objets ne devraient probablement pas être en craft (Licence est accordée, pas achetée ; Arme improvisée est improvisation ; Carte marine est craft MDG spécial).

### src/engine/activities.ts:567 — sévérité basse
- **Quote** : L'adéquation du Métier à l'objet est laissée au MJ par le canon — jeu sans MJ : catalogue non restreint (le Métier reste requis), arbitrage documenté.
- **Affirme** : Déviation assumée du RAW (le canon renvoie au MJ) comblée par un choix d'implémentation 'jeu sans MJ'.
- **Réalité** : Le RAW délègue explicitement au MJ une vérification que le jeu, sans MJ, ne fait pas — remplacé par un catalogue non filtré, documenté comme tel mais non validé par l'utilisateur.
- **Fix** : Faire arbitrer explicitement par l'utilisateur si le catalogue doit rester non filtré.
- **Vérif adversariale** : Source/Warhammer v4 - Livre de base version corrigée/23 - Activités.md l.74-102 : la règle Artisanat ne mentionne aucune délégation au MJ d'une vérification d'adéquation Métier-équipement pour le catalogue du Chapitre 11. Seul l'arbitrage des objets « hors-catalogue » est attribué au MJ (« toute autre chose que le MJ vous autorise à créer »). Le code (`src/engine/activities.ts:568-577`) offre effectivement le catalogue complet sans filtrage par Métier, chose raisonnée, mais le commentaire justificatif est inexact quant aux sources RAW.

### src/engine/advantagePool.ts:115 — sévérité basse
- **Quote** : if (allies === foes) return { dominant: null }; // égalité → arbitrage tactique du MJ, non modélisé
- **Affirme** : En cas d'égalité de combattants entre les deux camps, aucun transfert d'Avantage n'a lieu (le critère « avantage tactique » du RAW n'est pas modélisé).
- **Réalité** : AA l.4146 (PERDRE UN AVANTAGE) : « Si le nombre de combattants des deux camps est identique, désignez comme dominant le camp qui détient l'avantage tactique, par exemple qui se trouve en position surélevée ou qui encercle ses adversaires. » Le RAW prévoit un critère de départage (position/encerclement) que le moteur n'implémente pas, se contentant de ne rien transférer — déviation assumée et documentée.
- **Fix** : Si un signal de position/encerclement existe côté state, l'utiliser pour départager l'égalité ; sinon laisser le no-op documenté tel quel.
- **Vérif adversariale** : Lecture AA l.4146 (Seule copie): « Si le nombre de combattants des deux camps est identique, désignez comme dominant le camp qui détient l'avantage tactique, par exemple qui se trouve en position surélevée ou qui encercle ses adversaires. » Le code retourne bien `null` sans évaluer position/encerclement ; le commentaire reconnaît explicitement cette non-modélisation.

### src/engine/careerSlots.ts:12 — sévérité basse
- **Quote** : Modèle des emplacements « (Au choix) » (RAW + arbitrage table là où le livre est muet) :
- **Affirme** : Le modèle des emplacements combine RAW et un arbitrage maison pour les zones où le livre ne tranche pas.
- **Réalité** : Arbitrage assumé (silence du RAW) — dette de conception non tracée comme décision utilisateur explicite.
- **Fix** : Documenter la décision d'arbitrage comme validée par l'utilisateur ou la faire trancher.
- **Vérif adversariale** : src/engine/careerSlots.ts ligne 12 : commentaire bloc exact cité. Le code combine RAW (LDB 09, 10, 07) + arbitrage maison « là où le livre est muet » (slots sérialisés, maxi talent par spé, réouverture des choix au changement carrière). Arbitrage assumé, énoncé honnêtement, mais sans lien à une décision utilisateur (bug report / design review / feedback de session).

### src/engine/combat.ts:690 — sévérité basse
- **Quote** : Le jet brut est conservé pour la Localisation et l'Atout Empaleuse (le tireur peut la choisir, non modélisé).
- **Affirme** : Contre une cible Inconsciente, le RAW (« Je ne faillirai pas ! », LDB 17 l.73) permettrait normalement à l'attaquant de CHOISIR la Localisation touchée (comme pour tout résultat forcé) ; le code documente que ce choix n'est pas modélisé — la localisation reste tirée au hasard depuis le jet brut.
- **Réalité** : Le code applique `helplessTest` (succès + Critique forcés) mais laisse la Localisation dépendre du jet inversé normal (`hitLocationByShape(reverseRoll(atkBd.roll)...)`), sans offrir de sélection de Localisation au joueur malgré la note du commentaire.
- **Fix** : Si le choix de Localisation contre une cible Inconsciente doit rester non-joueur pour l'instant, garder la note ; sinon exposer un picker de Localisation comme pour `critLocation` (« Je ne faillirai pas ! »).
- **Vérif adversariale** : Fichier: src/engine/combat.ts, ligne 689-690. Source primaire vérifiée: LDB 17 (Destin et Résistance.md ligne ~68) — « Je ne faillirai pas ! : ... vous pouvez choisir la Localisation atteinte ». Code: helplessTest() applique Critique auto (isDouble:true) sans offrir de picker ; applyAttackResult() ligne 1526 tire aléatoirement critWoundLocation() sans intervention joueur.

### src/engine/conditions.ts:524 — sévérité basse
- **Quote** : (`_rng` réservé pour de futurs Tests ; non utilisé ici.)
- **Affirme** : Le paramètre `_rng` de `tickDeath` est gardé pour un usage futur non encore implémenté.
- **Réalité** : Paramètre effectivement inutilisé dans le corps de la fonction (aucun jet dans `tickDeath`) — dette de signature non exploitée, à signaler pour arbitrage (soit retirer le paramètre, soit motiver un ticket concret).
- **Preuve** : export function tickDeath(c: Combatant, _rng: RNG = defaultRNG): string[] { … } — `_rng` n'apparaît nulle part ailleurs dans le corps.
- **Fix** : Soit retirer le paramètre `_rng` tant qu'aucun Test n'y a recours, soit ouvrir explicitement le ticket qui le consommera.
- **Vérif adversariale** : src/engine/conditions.ts lignes 524-540 : fonction `tickDeath(c, _rng)` — commentaire «`_rng` réservé pour de futurs Tests» ; inspection du corps : zéro appel à `_rng`, aucun appel de `rng()` ou `.roll()`. Paramètre déclaratif inerte.

### src/engine/critical.ts:23 — sévérité basse
- **Quote** : hypothèse de jeu : **tout le monde est DROITIER** (main principale = brasD).
- **Affirme** : Le moteur suppose que tous les personnages sont droitiers pour déterminer la main principale.
- **Réalité** : Déviation RAW assumée et documentée (pas de règle de latéralité par personnage dans LDB 18) — recensée en tant qu'exception non tracée/validée, indépendamment du bug de gating ci-dessus qu'elle alimente.
- **Fix** : Si jugé important, exposer la latéralité comme trait de personnage plutôt qu'une constante ; sinon assumer explicitement en commentaire de portée (déjà fait) et laisser tel quel.
- **Vérif adversariale** : Lire : src/engine/critical.ts l.22-26 (commentaire JSDoc exact) + LDB 18 section « Amputation » § « Main » (l.261-265 : aucune mention de latéralité ou droitier/gaucher). L'excuse est valide et sa catégorisation correcte.

### src/engine/disease.ts:108 — sévérité basse
- **Quote** : Bénédiction de Convalescence reçue (LDB 41 : « une fois par maladie et par personne ») — approximation : une fois par maladie.
- **Affirme** : L'implémentation ne trackerait qu'« une fois par maladie », en simplification/approximation de la règle RAW « une fois par maladie ET par personne ».
- **Réalité** : Le champ `convalescenceBlessed` vit sur l'instance `Disease` elle-même, laquelle appartient déjà à UN SEUL `Combatant` (`c.diseases`). Traquer « une fois par instance de maladie » EST déjà équivalent à « une fois par maladie et par personne » (LDB 41 l.83 : « Cette Prière ne peut être tentée qu'une fois par maladie et par personne. ») — il n'y a pas d'approximation, le commentaire sous-estime à tort la fidélité de son propre code.
- **Fix** : Retirer la mention « approximation » — la donnée par-instance couvre déjà exactement la règle « par maladie et par personne ».
- **Vérif adversariale** : LDB 41 l.84 (« une fois par maladie et par personne »), src/engine/disease.ts l.108-110, src/engine/rest.ts l.102-107 (blessDiseaseDuration).

### src/engine/domainAttributes.ts:29 — sévérité basse
- **Quote** : Choix jeu-sans-MJ (documentés) : les « vous pouvez » offensifs (Feu/Lumière/Mort) ne sont appliqués qu'aux cibles ADVERSES (un lanceur rationnel n'enflamme pas ses alliés) ; le +10 « environnement rural » de la Vie n'est pas câblé (pas de classification de scène) ; l'armure PLATE d'un statblock (matière inconnue) compte comme NON-métal et NON-magique.
- **Affirme** : Trois déviations du RAW (LDB 48) sont assumées : les riders offensifs des Domaines Feu/Lumière/Mort (« vous pouvez infliger... ») ne s'appliquent qu'aux cibles adverses, le bonus d'environnement rural de la Vie (+10 Incantation/Focalisation, l.574) n'est jamais appliqué faute de classification de scène, et l'armure Plate de statblock est traitée comme non-métallique/non-magique par défaut.
- **Réalité** : Le RAW (LDB 48) ne restreint pas le rider à une cible « adverse » — c'est le lanceur qui choisit la cible du Sort ; et le bonus d'environnement rural de la Vie est une règle chiffrée du livre qui n'est jamais appliquée dans le jeu tant que `Scene.environment` ne porte pas de valeur reconnue.
- **Fix** : Si ces trois écarts restent des choix de conception assumés, les garder documentés tels quels (déjà fait) — sinon câbler `environmentBonus` sur une vraie classification de Scène rurale/sauvage.
- **Vérif adversariale** : src/engine/domainAttributes.ts l.29-32 (commentaire) ; LDB 48 l.203 (Feu « quiconque ciblé »), l.302 (Lumière « aux cibles »), l.501 (Mort « cible vivante »), l.690 (Vie +10 rural) ; domainEnvironmentBonus() l.91-95 (retourne 0 si env null).

### src/engine/exposure.ts:10 — sévérité basse
- **Quote** : sans bon Manteau, pénalité au Test de Froid (ch.66 l.46 — non chiffrée dans le canon : application déclarée −10).
- **Affirme** : Le canon ne chiffre pas la pénalité sans manteau ; le code invente −10.
- **Réalité** : Confirmé par le RAW lui-même (« vous recevrez des pénalités » sans valeur), donc le −10 est une valeur maison non sourcée — assumption transparente mais non validée par une règle citable.
- **Fix** : Si la valeur −10 est arbitrée par la table, la documenter comme règle maison explicite (pas comme lecture RAW) ou la faire trancher/valider une bonne fois.
- **Vérif adversariale** : src/engine/exposure.ts ligne 10 : commentaire honnête. ch.65 l.44 (Vêtements et accessoires) du LDB : « sans un bon manteau ou similaire, vous recevrez des pénalités pour résister à l'exposition au froid ». Pas de chiffre fourni par le RAW. Le −10 est une décision cohérente (même valeur que les autres pénalités d'Exposition au ch.18), déjà marquée comme « application déclarée ».

### src/engine/exposure.ts:16 — sévérité basse
- **Quote** : (« Vous débarrasser d'une Possession lourde annule 1 Test échoué » : choix interactif non simulé au niveau agrégé — décision documentée.)
- **Affirme** : Une règle RAW existante (annulation d'un Test échoué en se débarrassant d'une possession lourde, LDB 18 l.330) est délibérément non implémentée.
- **Réalité** : Le code n'offre aucun mécanisme pour ce choix interactif ; c'est un trou RAW assumé, jamais arbitré par l'utilisateur.
- **Fix** : Lister ce trou dans le backlog RAW pour arbitrage explicite plutôt que le laisser en commentaire silencieux.
- **Vérif adversariale** : Fichier src/engine/exposure.ts l.15-16 contient le commentaire tel que cité ; LDB 18 l.332 confirme la règle : « Vous débarrasser d'une Possession lourde annule 1 Test échoué ». Aucune mécanique de jeu n'implémente ce choix dans les fonctions exposureNight/applyExposureFailure.

### src/engine/exposure.ts:18 — sévérité basse
- **Quote** : Applications déclarées (le canon ne chiffre pas le sommeil dehors) :  *  - une NUIT (~8 h) en environnement difficile = 2 Tests (1/4 h) ; extrême = 4 Tests (1/2 h) ;  *  - un ABRI (Tente, ch.74 — ou abri construit, Survie en extérieur ch.09 l.559) ANNULE  *    l'Exposition d'une nuit difficile, et ramène une nuit extrême au rythme difficile (2 Tests) ;  *  - les pénalités d'Exposition se dissipent après 24 h (purge d'horloge #T3) ;
- **Affirme** : Cadence des Tests de nuit, effet d'annulation de la Tente, et dissipation à 24 h sont présentés comme des applications du RAW.
- **Réalité** : Aucune de ces trois valeurs n'est dans LDB 18 (qui ne traite que la cadence 2h/4h en environnement difficile/extrême sans référence au sommeil, à la tente ou à une dissipation à durée fixe) ni dans la description de la Tente (LDB 74 l.62, qui ne mentionne aucun effet sur l'Exposition). Ce sont des règles maison assumées en bloc.
- **Fix** : Marquer ce bloc comme règle maison (pas RAW) ou faire trancher/valider chaque point par l'utilisateur.
- **Vérif adversariale** : Lecture : Source/Warhammer v4 - Livre de base version corrigée/18 - Traumatisme.md l.326-334 (Exposition) et 74 - Possessions diverses.md l.60-62 (Tente/Sac couchage). Code src/engine/exposure.ts l.18-23, l.82-86 (exposureTestCount : sheltered→0 Tests difficile, 2 Tests extrême).

### src/engine/landCargo.ts:144 — sévérité basse
- **Quote** : magnitude/direction arbitrées, laissées au MJ par le RAW). PUR. */
- **Affirme** : Le RAW (MSRC ch.11 l.95) laisse au MJ la magnitude et la direction de la fausse indication de qualité du Vin sur un échec d'Évaluation ; le code fige un choix (décalage de |DR| échelons, plafonné puis inversé) non spécifié par le livre.
- **Réalité** : Confirmé : le texte source dit seulement « donnez-lui une fausse indication dont l'inexactitude est en rapport avec son degré d'échec », sans mécanique précise — le commentaire le signale honnêtement, mais c'est une implémentation d'auteur substituée à une décision de MJ, à valider explicitement.
- **Preuve** : Source/Warhammer v4 - 2.0 Mort sur le Reik Compagnon/13 - CHAPITRE 11 - Règles du commerce.md l.95 : « donnez-lui une fausse indication dont l'inexactitude est en rapport avec son degré d'échec ».
- **Fix** : Rien à corriger dans le code (choix assumé et signalé) — à faire valider par l'utilisateur comme convention de jeu si ce n'est pas déjà acté.
- **Vérif adversariale** : src/engine/landCargo.ts l.140-144 (commentaire + code wineEvalReveal) ; Source/Warhammer v4 - 2.0 Mort sur le Reik Compagnon/13 - CHAPITRE 11 - Règles du commerce.md l.95 : texte RAW cité entre guillemets dans le commentaire, vérifié mot-à-mot. Kind='excuse' confirmé : le commentaire existe et appartient à sa famille (implémentation d'auteur substituée à un choix de MJ).

### src/engine/policy.ts:358 — sévérité basse
- **Quote** : Simplification LDB 59 l.9-11 : un objet coûtant au plus votre niveau de Statut (Bronze N = N sous, Argent N = N pistoles, Or N = N couronnes) s'achète sans compter les pièces ; au-delà, un seul achat par jour via un Test de Marchandage.
- **Affirme** : Règle optionnelle qui simplifie explicitement le comptage RAW des pièces lors des achats sous le niveau de Statut.
- **Réalité** : Simplification assumée et signalée comme telle (flag optionnel désactivé par défaut) — recensée en tant qu'écart RAW documenté.
- **Fix** : Aucun changement requis si le flag reste optionnel et désactivé par défaut (RAW strict conservé) ; garder la note explicite.
- **Vérif adversariale** : LDB 59 l.9-11 + policy.ts:358 : source primaire documente « OPTION » et « simplification » optionnelle du comptage, jeu suppose comptage strict par défaut. Code implémente cela via flag `default: false` avec documentation explicite. La contradiction alléguée n'existe pas.

### src/engine/seaWeather.ts:170 — sévérité basse
- **Quote** : sinon le régime de bord « 2 à 3 litres d'eau par jour » (MDG ch.14 l.242, borne haute retenue : choix documenté). PUR.
- **Affirme** : Le choix de retenir 3 L (borne haute de la fourchette RAW 2-3 L) comme valeur par défaut est présenté comme un arbitrage documenté.
- **Réalité** : MDG 14 l.242 donne une fourchette (« 2 à 3 litres »), pas une valeur unique ; le code choisit arbitrairement la borne haute sans que ce choix soit validé par l'utilisateur.
- **Fix** : Faire trancher/valider le choix de la borne (haute vs basse vs aléatoire) plutôt que de le figer silencieusement dans le code.
- **Vérif adversariale** : src/engine/seaWeather.ts l.167-172 contient le commentaire et le code ; MDG ch.14 l.242 dit « Un membre d'équipage boit 2 à 3 litres d'eau par jour » (fourchette, pas prescription de 3).

### src/engine/seaWeather.ts:176 — sévérité basse
- **Quote** : Le jour de voyage ne se simule pas heure par heure : la période EXPOSÉE sur le pont = UNE Période de travail à la voile (8 h, l.107) → 8 ÷ cadence Tests par jour (bandes 4 h → 2 Tests ; bandes 2 h → 4 — mêmes comptes que la nuit dehors d'`exposureNight` : difficile 2 / extrême 4).
- **Affirme** : Une journée de mer applique la cadence de Tests (toutes les 2h/4h) sur une base d'exposition de 8h plutôt que 24h.
- **Réalité** : MDG 13 l.209-225 ne restreint pas la cadence des Tests à une « période de travail » de 8h — le texte dit « toutes les deux/quatre heures » sans borner à la journée de travail ; réduire la fenêtre à 8h est un choix de modélisation qui divise par 3 le nombre de Tests réellement dus sur 24h en mer.
- **Fix** : Marquer explicitement ce choix comme non-RAW (réduction délibérée du nombre de Tests/jour) et le faire valider par l'utilisateur.
- **Vérif adversariale** : Fichier lu : seaWeather.ts l.174-183 + MDG ch.13 Navigation maritime l.203-225. Le commentaire existe bien et cite l.107 pour justifier 8h. Le RAW MDG 13 l.203-225 dit Caniculaire/Glaciale « Toutes les 2h » et Chaude/Froide « Toutes les 4h » — zéro mention d'une fenêtre de 8h, la prescription s'applique 24h/24 en mer logiquement (sinon le MJ aurait dû le dire explicitement, comme pour d'autres règles).

### src/engine/suffocation.ts:28 — sévérité basse
- **Quote** : Durée d'un Round de combat en secondes, DÉRIVÉE du canon (LDB 18 : BE×10 s de souffle ↔ BE Rounds de survie inconscient) → 1 Round ≈ 10 s. Utilisée pour décompter la rétention de souffle.
- **Affirme** : Le canon fixerait implicitement 1 Round ≈ 10 secondes.
- **Réalité** : LDB 18 l.346 ne dit jamais explicitement qu'un Round dure 10 secondes ; c'est une déduction du code (BE×10 s ↔ BE Rounds), présentée comme une certitude RAW alors que c'est une extrapolation.
- **Fix** : Reformuler en « hypothèse de calibrage (non RAW) » plutôt qu'en dérivation présentée comme certaine.
- **Vérif adversariale** : LDB 18 l.344-346 : « retenir votre souffle pendant un nombre de secondes égal à votre Bonus d'Endurance x 10 » + « au bout d'un nombre de Rounds égal à votre Bonus d'Endurance, vous mourez ». Nulle part le canon ne dit « 1 Round = 10 secondes »; c'est une extrapolation inférentielle, non RAW.

### src/engine/trauma.ts:280 — sévérité basse
- **Quote** : Surdité (−20 Perception auditive, approximée à toute la Perception).
- **Affirme** : 
- **Réalité** : Approximation assumée et signalée : le RAW (LDB 18 « Oreille ») ne parle que des Tests « ayant un rapport avec l'audition », que le code élargit à toute la compétence Perception sans distinguo ouïe/vue. Dette de fidélité non tranchée par l'utilisateur.
- **Preuve** : Commentaire même : « approximée à toute la Perception »
- **Fix** : Si un jour les Tests de Perception se scindent par sens (vue/ouïe/odorat), retirer l'approximation ; sinon garder tel quel en assumant explicitement le choix.
- **Vérif adversariale** : src/engine/trauma.ts:279 (commentaire), traumas.json:362 (implémentation skillMod global), LDB 18 l.277 (RAW limité à l'ouïe)

### src/engine/trauma.ts:357 — sévérité basse
- **Quote** : La déchirure majeure n'est PAS accélérée (l.326 : la Guérison ne fait qu'informer — laissé en dette).
- **Affirme** : 
- **Réalité** : Dette explicitement reconnue : le module admet ne pas implémenter l'effet potentiel de la Guérison sur une déchirure majeure faute de règle RAW claire à câbler.
- **Preuve** : Commentaire même : « laissé en dette »
- **Fix** : Statuer (avec l'utilisateur) si la Guérison doit avoir un effet sur la déchirure majeure, sinon documenter que RAW ne prévoit rien de plus et retirer la mention de dette.
- **Vérif adversariale** : trauma.ts l.357 — LDB 18 Déchirure musculaire (Majeure) l.225-231 : RAW donne « Guérison n'aura d'autre intérêt que d'informer » (zéro accélération) ; le code le fait (rejette accélération ligne 368-369) ; mais le commentaire dit « laissé en dette » = faux signal qu'une fonctionnalité est manquante quand elle n'est pas censée exister.

### src/engine/trauma.ts:8 — sévérité basse
- **Quote** : Bras/Tête et Amputations : effet de combat journalisé (latéralité non modélisée ; amputation = post-combat/Chirurgie → Jalon 5).
- **Affirme** : 
- **Réalité** : Reconnaît une portion du système (latéralité de certains traumas Bras/Tête) non modélisée, renvoyée à un jalon futur (« Jalon 5 ») — dette de fidélité RAW non arbitrée.
- **Preuve** : Commentaire même : « latéralité non modélisée […] → Jalon 5 »
- **Fix** : Suivre ce backlog explicitement (ticket Jalon 5) plutôt que de le laisser dormir dans un commentaire de module.
- **Vérif adversariale** : **Fichier** : `src/engine/trauma.ts` (commentaire de module, lignes 8-9). **Extrait** : « Bras/Tête et Amputations : effet de combat journalisé (latéralité non modélisée ; amputation = post-combat/Chirurgie → Jalon 5). Le trauma est enregistré (label+note) même sans effet modélisé. » Le commentaire appartient bien à la famille « excuse » : il reconnaît une limitation mécanique et la report à un jalon ultérieur sans la résoudre en code.

### src/engine/travel.ts:73 — sévérité basse
- **Quote** : /** Plafond de marche forcée (heures/jour) — canon muet, paramétrable. */
- **Affirme** : Le RAW ne fixe aucune limite au nombre d'heures de marche forcée par jour ; la valeur (10 h) est un choix d'auteur.
- **Réalité** : Confirmé par lecture de la section « Temps de voyage » (Source/Warhammer v4 - Livre de base version corrigée/51 - Magie du Chaos.md l.191-197) : le RAW ne parle que des 6 h sans Test et de la marche forcée en général, sans plafond chiffré — le commentaire signale honnêtement une valeur maison, mais c'est une déviation RAW non tranchée qui mérite arbitrage utilisateur plutôt qu'un simple paramétrage silencieux.
- **Preuve** : TRAVEL_DEFAULTS.forcedMaxHours: 10 — aucune règle citée dans le Source pour ce chiffre.
- **Fix** : Confirmer avec l'utilisateur si 10h/jour est la valeur maison retenue pour la table, ou la documenter comme choix de MJ dans docs/raw plutôt qu'en simple commentaire de code.
- **Vérif adversariale** : Lecture de `src/engine/travel.ts` l.73-74 (le commentaire existe), vérification RAW via `Source/.../51 - Magie du Chaos.md` l.191-197 (pas de plafond RAW), et `docs/raw/deplacement.md` l.562 (le choix est listé comme écart documenté). Le constat est valide : bien qu'honnêtement signalé, le plafond mérite une vraie justification/arbitrage utilisateur plutôt qu'une simple constante paramétrée.

### src/engine/types.ts:638 — sévérité basse
- **Quote** : (Fausse jambe : « ignorer 1 Point de Mouvement perdu » — l'Esquive demande 200 PX, non modélisé).
- **Affirme** : La récupération complète de l'Esquive après amputation (coût 200 PX) via prothèse entraînée n'est pas modélisée dans le moteur.
- **Réalité** : Trou de couverture RAW signalé par l'auteur du code lui-même, jamais comblé ni arbitré — dette non traçée ailleurs.
- **Preuve** : src/engine/types.ts l.638 (commentaire du champ `prosthesis`).
- **Fix** : Ouvrir un ticket dédié pour modéliser le rachat d'Esquive (200 PX) ou documenter explicitement le choix de ne pas le faire dans un registre de dérogations.
- **Vérif adversariale** : types.ts l.727 (`prosthesisTrained` champ), trauma.ts l.384 (moteur), partyFlow.ts l.535 (déduction PX), prosthesis-train.test.ts l.21-29 (tests exhaustifs), CharacterSheet.tsx l.646 (UI jouable). Source RAW confirmée : LDB 73 « Fausse jambe ».  Le commentaire du code ne reflète plus l'état réel de l'implémentation.

### src/state/ai.ts:518 — sévérité basse
- **Quote** : chargé (le décompte de Recharge lui est épargné), donc `!enemy.loaded` ne déclenche que pour qui doit.
- **Affirme** : Un ennemi ne suit jamais son état de Recharge (`loaded`) — il est traité comme toujours chargé, sauf via `reloadNeeded` calculé séparément — déviation documentée du cycle RAW de Recharge (LDB 63 l.28-29) pour les PNJ.
- **Réalité** : Simplification assumée : le suivi individuel de Rechargement par tir n'est implémenté que côté héros ; les ennemis n'ont pas cet état simulé au même niveau de fidélité.
- **Fix** : Signaler cette exception RAW pour arbitrage utilisateur (garder si acceptée, sinon étendre `loaded` aux ennemis).
- **Vérif adversariale** : src/state/ai.ts 516-520 ; LDB 62 « Les armes » l.333-335 (Recharge Indice) : définit le cycle RAW complet (Test étendu, décompte DR, état de charge). Code ennemi : const reloadNeeded = ... && !enemy.loaded — jamais true car enemy.loaded jamais false.

### src/state/ai.ts:268 — sévérité basse
- **Quote** : // DIFFÉRENCE MINIMALE DÉFENDABLE (faute d'un signal de charge initiale d'embuscade) — signalée au rapport.
- **Affirme** : La doctrine « embuscade » ne peut être sélectionnée automatiquement faute d'un signal fiable de charge d'embuscade ; elle ne se distingue de « meute » que par des poids, ce qui est reconnu comme une approximation faible.
- **Réalité** : Compromis d'implémentation explicitement signalé comme faible par l'auteur du code lui-même — dette de conception non tranchée.
- **Fix** : Trancher : soit ajouter un vrai signal de charge d'embuscade (flag de scène/furtivité), soit fusionner la doctrine avec « meute ».
- **Vérif adversariale** : src/state/ai.ts lignes 261–268, commentaire multi-ligne bloc avant la def `embuscade: { threat: 1.8, flankRear: 12, killSecure: 18 }`

### src/state/combat/advantagePool.ts:123 — sévérité basse
- **Quote** : Menace / Manœuvrabilité / Terrain restent à l'appréciation du MJ (entrée d'éditeur future) → 0 par défaut.
- **Affirme** : Trois des cinq circonstances RAW d'Avantage initial (AA l.4149-4167 : Manœuvrabilité, Menace ×3 paliers, Terrain) ne sont pas dérivées automatiquement et retombent à 0, en attendant une future entrée d'éditeur.
- **Réalité** : Fonctionnellement correct pour l'instant (le code ne prétend implémenter que Surnombre + Surprise), mais c'est une couverture RAW partielle assumée et non tracée ailleurs que dans ce commentaire — à confirmer comme arbitrage accepté plutôt que dette oubliée.
- **Fix** : Ouvrir un item de suivi explicite (éditeur : marqueurs Menace/Manœuvrabilité/Terrain par rencontre) au lieu de laisser la dette uniquement dans le commentaire.
- **Vérif adversariale** : Lu src/state/combat/advantagePool.ts:121-123 (commentaire exact), src/engine/advantagePool.ts:59-90 (type et fonction complète supportant TOUTES les circonstances), Source AA ch.4149-4167 (table avec Manœuvrabilité, Menace, Surnombre, Surprise, Terrain). Kind='excuse' est correct : l'architecture ENGINE peut traiter les 5 catégories, seule l'orchestration STATE les dérive partiellement (Surnombre/Surprise only), les 3 autres manquent par design.

### src/state/combat/roundHooks.ts:245 — sévérité basse
- **Quote** : Règle optionnelle « Se fatiguer » (LDB 16 l.99) : un effort physique soutenu finit par épuiser.  * Approximation assumée (granularité Round) : chaque Round en action = 1 Round d'effort ; à Bonus  * d'Endurance Rounds cumulés, Test de Résistance — échec → +1 Exténué (compteur remis à zéro) ;  * réussite → le délai avant le prochain Test est repoussé de 1 + DR Rounds.
- **Affirme** : Le mapping RAW « Rounds d'effort » est directement dérivé du texte LDB 16 l.99, avec une seule liberté de granularité (Round vs minute/heure de jeu réel).
- **Réalité** : Le commentaire admet lui-même une adaptation non triviale (mapper une notion réelle de temps/effort en pas discrets de Round de combat) sans qu'aucune validation utilisateur ne soit tracée ailleurs — c'est une règle maison marquée comme telle mais jamais arbitrée.
- **Fix** : Documenter la décision (validée/à valider) dans docs/raw/ plutôt que dans un commentaire de code isolé, ou renvoyer vers le ticket/rapport qui l'a validée.
- **Vérif adversariale** : LDB 16 l.95-97 (« OPTION : SE FATIGUER ») + code ligne 258 (`c.effortRounds -= (1 + sl)`) + commentaire ligne 254 (« −1−DR Rounds »). Le RAW dit DR, le code/commentaire font 1+DR.

### src/state/combat/triggeredTest.ts:655 — sévérité basse
- **Quote** : sur un objet porté, l'ajout est fondu dans `qualities` → on compte 1 règle (cas du butin du jeu)
- **Affirme** : Pour un objet déjà porté par un héros (par opposition à une ligne de butin), le nombre de « règles spéciales » à apprendre par Détection d'artefact est toujours forcé à 1, quel que soit le nombre réel de Qualités magiques de l'objet.
- **Réalité** : LDB 10 l.310-312 ne plafonne pas le nombre de règles à apprendre (« chaque DR apprend également une règle spéciale spécifique... s'il en possède ») ; un objet magique à plusieurs Qualités magiques portées ferait apprendre son intégralité au premier DR au lieu d'un apprentissage progressif par DR comme pour une ligne de butin.
- **Fix** : Si l'app modélise des objets portés à plusieurs Qualités magiques, compter réellement leurs qualités au lieu de forcer 1 (ou documenter que ce cas n'existe pas encore dans les données).
- **Vérif adversariale** : Excuse correctement localisée à src/state/merchantFlow.ts:651-652 (pas le fichier/ligne du constat), commentaire exact correspondant. RAW LDB 10 Talents Détection d'artefact vu intégralement : pas de distinction objet porté vs butin, progression par DR unique.

### src/state/combat/turnHooks.ts:87 — sévérité basse
- **Quote** : UN Test par Caractéristique gatée et par Round (deux doses de la même drogue ne re-testent pas — la « Dose » n'est pas modélisée).
- **Affirme** : Le concept RAW de « Dose » (empilement d'effets de drogue) n'est pas modélisé ; deux applications du même effet gate (ex. deux doses de Racine de mandragore) ne génèrent qu'un seul Test par Round.
- **Réalité** : Simplification assumée et documentée comme telle (bonne pratique de signalement), mais reste une divergence RAW non arbitrée formellement ailleurs.
- **Fix** : Rien d'urgent — garder tel quel si la Dose n'a jamais d'usage en jeu, sinon tracer un item de suivi dédié.
- **Vérif adversariale** : Fichier src/state/combat/turnHooks.ts ligne 87 : le commentaire existe exact. Source LDB 71 Racine de mandragore (ligne 35) : énonce "Test de FM à chaque Round", jamais "Dose" ni cumul.

### src/state/combatEffects.ts:729 — sévérité basse
- **Quote** : Seuil : « exaucé sur 01 » ; « Si vous avez la Compétence Prière, le MJ peut augmenter ce       // pourcentage » → +1 % par avance de Prière (arbitrage jeu-sans-MJ, modeste et documenté).
- **Affirme** : Le bonus de +1 %/avance de Prière au seuil des Petites Prières est un arbitrage volontaire, non chiffré par le RAW.
- **Réalité** : LDB 25 l.22-24 confirme que le RAW laisse ce pourcentage à la discrétion du MJ (« le MJ peut augmenter ce pourcentage ») sans barème chiffré — le code invente donc une valeur non-RAW (+1 %/avance), explicitement reconnu comme tel dans le commentaire.
- **Fix** : Aucun changement requis si l'arbitrage est déjà validé par l'utilisateur (comme indiqué) ; sinon faire trancher la valeur.
- **Vérif adversariale** : Fichier src/state/combatEffects.ts lignes 729-730, Source/Warhammer v4 - Livre de base version corrigée/25 - Les cultes.md lignes 22-24. La citation du RAW dans le commentaire est exacte ; le commentaire appartient bien à la famille « excuse » (reconnaît l'arbitrage).

### src/state/lineOfSight.ts:144 — sévérité basse
- **Quote** : (Le « dead ground » au pied du mur - angle mort vertical - est un raffinement ultérieur, non requis.)
- **Affirme** : Justifie l'absence de gestion de l'angle mort vertical sous un rempart comme un raffinement différé.
- **Réalité** : Déviation RAW/géométrie assumée et non implémentée, signalée comme 'pour plus tard' sans ticket ni validation traçable.
- **Fix** : Ouvrir un suivi explicite (ou faire trancher par l'utilisateur) plutôt que laisser un 'non requis' non arbitré dans le commentaire.
- **Vérif adversariale** : src/state/lineOfSight.ts:144 — bloc cross-étage (défenseur z=1 / assaillant z=0) ; commentaire verbatim : « Le « dead ground » au pied du mur — angle mort vertical — est un raffinement ultérieur, non requis. »

### src/state/merchantFlow.ts:441 — sévérité basse
- **Quote** : Vente immédiate d'un objet (conservée : API + tests). Délègue le prix à `sellGain`.
- **Affirme** : La fonction `sellItem` (vente unitaire, hors panier) est explicitement justifiée comme conservée uniquement pour préserver une API/des tests existants — sous-entendant qu'elle est redondante avec le panier de vente (`confirmSell`).
- **Réalité** : C'est un chemin de code parallèle non retiré, signalé comme dette potentielle plutôt que motivé par un besoin produit actif — à arbitrer (fusionner avec le panier de vente ou confirmer qu'elle sert un usage distinct).
- **Fix** : Si aucun appelant produit ne l'utilise hors tests, la retirer et migrer les tests vers `confirmSell` (panier à 1 élément).
- **Vérif adversariale** : Vérification : `src/ui/MerchantPanel.tsx` lignes 454 (bouton UI), 487 (confirmation) — flux produit utilise `addToSellCart`/`confirmSell`, jamais `sellItem`. Tests : `src/state/store.test.ts` lignes 2832, 2940 — appels directs. Intents : `src/net/intents.test.ts` ligne 25 — `sellItem` explicitement dans la liste des actions interdites en coop.

### src/state/outOfCombatUpkeep.ts:10 — sévérité basse
- **Quote** : Limite assumée : tant que l'action « Premiers Secours / panser » (retrait d'Hémorragique, couture C de récupération) n'existe pas, un héros qui s'attarde en saignant peut mourir — un Point de Destin le sauve (consommé, l'hémorragie est jugulée). Se déplacer ne coûte pas de temps : on peut fuir sans saigner.
- **Affirme** : Le commentaire justifie une lacune de fonctionnalité (pas d'action de premiers secours hors combat) comme une limitation temporaire acceptée.
- **Réalité** : C'est une dette fonctionnelle non tracée ailleurs que dans ce commentaire — aucun ticket ou TODO formel ; le code accepte silencieusement qu'un joueur ne puisse pas stopper une hémorragie hors combat sans dépenser un Point de Destin.
- **Fix** : Remplacer par un TODO tracé (ticket/roadmap) ou implémenter l'action Premiers Secours et retirer la justification.
- **Vérif adversariale** : Fichier src/state/outOfCombatUpkeep.ts, lignes 10-12 (commentaire bloc), 42-53 (logique de sauvegarde au Destin). Le quote du constat correspond exactement au texte.

### src/state/relief.ts:34 — sévérité basse
- **Quote** : Ajustable ici (foyer unique) ; documenté comme assumé, pas canon - à confirmer au rendu/jeu.
- **Affirme** : STEP_MAX_M = 1.0 (seuil marche/falaise) est explicitement présenté comme une valeur maison non tirée du RAW, encore à valider.
- **Réalité** : Le commentaire lui-même l'admet ('AUCUNE valeur RAW ne le définit') : c'est une déviation/valeur assumée non arbitrée, exactement le type d'exception que la règle demande de faire remonter même si elle est plausible.
- **Fix** : Faire trancher/valider STEP_MAX_M par l'utilisateur (RAW ou valeur maison actée), puis retirer le tag 'à confirmer'.
- **Vérif adversariale** : src/state/relief.ts:28-36 — commentaire reconnaît pleinement que c'est une invention; LDB 15 (Déplacement) et 13 (Combat) consultées : aucun seuil de marche/falaise ni malus 'en contrebas' codifié.

### src/state/restFlow.ts:133 — sévérité basse
- **Quote** : Soins prolongés : un soignant valide (Guérison) veille les malades — Test supposé réussi sur la   // durée (abstraction du repos, LDB 09 : −1 jour/jour de soins par maladie).
- **Affirme** : Le Test de Guérison prolongé (−1 jour/jour de soins) est simplement SUPPOSÉ réussi pendant tout le repos, présenté comme une « abstraction » assumée.
- **Réalité** : Aucun jet n'est réellement lancé pour ce soin prolongé — c'est une déviation RAW documentée (le RAW suppose un Test de Guérison réel, réussite non garantie) mais jamais arbitrée par un jet en jeu.
- **Fix** : Documenter/valider explicitement ce choix d'arbitrage auprès de l'utilisateur, ou implémenter le vrai Test de Guérison par jour de soins.
- **Vérif adversariale** : Fichier source: C:\Users\gauch\PhpstormProjects\Foundry\Game\Source\Warhammer v4 - Livre de base version corrigée\09 - Compétences.md ligne ~265. Le RAW décrit deux effets séparés : (1) Test réussi = protection contre contraction, (2) présence du soignant = durée -1/jour (pas de Test exigé). Le code qui abstrait cela par « supposé réussi » est légitime.

### src/state/seaActivities.ts:14 — sévérité basse
- **Quote** : Cartographie (l.288-290) : Métier (Cartographe) Complexe (−10) → une Carte marine (trapping  *  `carte-marine`, passif +2 DR d'Orientation) d'une valeur de DR CO (prix d'instance). Les « deux  *  ports désignés » ne sont pas modélisés : la carte sert la ligne maritime courante (abstraction  *  documentée — même lecture que la Boussole, passif inconditionnel).
- **Affirme** : La règle RAW « la carte couvre spécifiquement deux ports désignés » n'est pas modélisée ; l'implémentation la remplace par un bonus inconditionnel sur la ligne maritime courante.
- **Réalité** : Déviation RAW assumée et documentée comme un choix de conception (« abstraction documentée »), sans validation utilisateur tracée.
- **Fix** : Si acceptée, déplacer la justification vers un doc de règles optionnelles versionné plutôt qu'un commentaire de code.
- **Vérif adversariale** : Fichier: src/state/seaActivities.ts, lignes 12-16 (commentaire d'excuse). Source RAW: Source/WH - V4 - La Mer de Griffe/15 - Longs voyages.md, lignes 288-291. Le RAW dit « désignez deux ports » et « Quand vous voyagez entre les deux ports désignés » ; le code les remplace par un bonus global.

### src/state/seaActivities.ts:16 — sévérité basse
- **Quote** : Le volet « Opérations  *  bancaires : Planque » gratuit (l.292) n'est pas offert en mer (la banque vit à l'interlude).
- **Affirme** : Une partie de la règle RAW (Opérations bancaires : Planque, gratuite) est délibérément omise en contexte 'mer'.
- **Réalité** : Omission volontaire non arbitrée en dehors du commentaire — RAW l.292 l'autorise en mer selon la source citée.
- **Fix** : Documenter le choix comme règle optionnelle désactivée plutôt que comme note de code isolée.
- **Vérif adversariale** : Fichier : src/state/seaActivities.ts ligne 14-16. Source RAW : Source/WH - V4 - La Mer de Griffe/15 - Longs voyages.md ligne 292 (section Cartographie, l.288-292).

### src/state/seaActivities.ts:17 — sévérité basse
- **Quote** : Entraînement d'équipage (l.294-300) : GATE — l'équipage du navire de campagne est ABSTRAIT,  *  tenu par les PJ (MDG 14 l.39) : aucun équipage PNJ à entraîner (l'UI l'explique, le résolveur  *  le raconte). « Seuls les PNJ peuvent gagner des Augmentations » (l.296).
- **Affirme** : L'Activité RAW « Entraînement d'équipage » est neutralisée car le modèle de jeu n'a pas d'équipage PNJ distinct des PJ.
- **Réalité** : Conséquence directe d'un choix d'architecture (équipage abstrait) documentée comme telle — exception assumée sans trace de validation hors du commentaire.
- **Fix** : Référencer la décision d'architecture (MDG 14 l.39) dans docs/raw/ ou docs/systeme-*.md plutôt que de la ré-justifier ici.
- **Vérif adversariale** : Vérifié : MDG 14 l.39 (équipage abstrait = perf des PJ), MDG 15 l.296 (« Seuls les PNJ »), seaActivities.ts l.17-19 (citation exacte). Inférence logique valide. Type « excuse » confirmé (commentaire reconnaît une déviation du RAW brut).

### src/state/seaActivities.ts:20 — sévérité basse
- **Quote** : Whitelist d'Activités TERRESTRES (l.270 : Apprentissage particulier, Artisanat, Entraînement,  *  Entraînement au combat, Invention !, Recherche de savoir, Semer la dissension + entraînements  *  d'Aux Armes !) : « à condition que des installations et des instructeurs adaptés soient  *  disponibles » — arbitrage sans-MJ : ni installations ni instructeurs sur le navire de campagne  *  → non proposées en mer (le verbatim est affiché dans la modale, `SEA_ACTIVITIES_INTRO`).
- **Affirme** : La condition RAW (installations/instructeurs disponibles, laissée à l'appréciation du MJ) est arbitrée unilatéralement par le code comme toujours fausse en mer.
- **Réalité** : C'est un arbitrage de conception explicite pour remplacer une décision MJ absente — cohérent avec la contrainte 'pas de MJ' du projet, mais reste une exception RAW non validée formellement en dehors du commentaire.
- **Fix** : Rien à changer fonctionnellement ; déplacer la justification vers la documentation de règle plutôt que le code si on veut la rendre traçable/arbitrable plus tard.
- **Vérif adversariale** : src/state/seaActivities.ts l.20-24 : excuse valide, commentaire exact, implémentation cohérente (pas d'Activité terrestre en contexte 'mer' dans activities.json)

### src/state/seaVoyageFlow.ts:27 — sévérité basse
- **Quote** : * ÉQUIPAGE : hors combat, l'équipage PNJ du navire est ABSTRAIT — « la performance des Personnages  * représente celle de tout l'équipage » (MDG 14 l.39) → les PJ tiennent les rôles, PAS de Manque de  * bras au long cours (choix documenté ; en combat, l'équipage est réel et le Manque de bras s'applique).
- **Affirme** : Hors combat, le Manque de bras (undercrew, MDG ch.14 l.55) ne s'applique jamais pendant le voyage maritime — choix assumé.
- **Réalité** : Déviation RAW documentée : RAW ne distingue pas 'voyage' vs 'combat' pour le Manque de bras, qui est une règle générale de Test d'équipage ; ici elle est désactivée hors combat par choix produit.
- **Fix** : Confirmer ce choix avec l'utilisateur ou étendre `shipUndercrew` au flux de voyage.
- **Vérif adversariale** : MDG 14 « Manque de bras » l.51-55 confirme la règle générale (–2 DR si rôles vacants) ; l.39 « Qui effectue un Test d'équipage ? » justifie l'abstraction si PJ occupent les rôles. Le commentaire de code (src/state/seaVoyageFlow.ts l.27-29) existe tel que cité et documente ce choix.

### src/state/seaVoyageFlow.ts:403 — sévérité basse
- **Quote** : // « voguer de nuit » : il faut l'équipage nominal — l'équipage PNJ abstrait du navire de campagne   // le permet (choix documenté, MDG 14 l.39) ; ch.15 l.76 sinon ÷2.
- **Affirme** : La pénalité de progression ÷2 pour naviguer de nuit sans équipage nominal (ch.15 l.76) est contournée par choix documenté puisque l'équipage PNJ abstrait est réputé nominal.
- **Réalité** : Autre occurrence de la même exception RAW assumée (cf. l.27-29) — navigation de nuit jamais pénalisée.
- **Fix** : Même remarque : à faire arbitrer/valider explicitement plutôt que laisser en excuse de code.
- **Vérif adversariale** : Fichier: src/state/seaVoyageFlow.ts l.403-404 (commentaire exact). Sources: MDG ch.15 l.76 (« division par 2 si pas équipage nominal »), MDG ch.14 l.39 (« Personnages représentent tout l'équipage dans Tests »).

### src/state/seaVoyageFlow.ts:990 — sévérité basse
- **Quote** : // — on paie si la bourse le permet (choix automatique documenté ; la Taille en pistoles suit lengthM).
- **Affirme** : L'événement de port « prêtre de Manann » choisit automatiquement de payer si la bourse le permet, plutôt que de laisser un choix au joueur — présenté comme un choix documenté.
- **Réalité** : Décision de gameplay substituée au joueur sans confirmation interactive ; RAW ne prescrit pas d'automatisme ici (« payer OU réduire l'Humeur de Manann » est un choix de joueur).
- **Fix** : Envisager une modale de choix joueur (payer / refuser) plutôt que l'automatisme, ou confirmer que l'automatisme est le choix produit voulu.
- **Vérif adversariale** : Source/WH - V4 - La Mer de Griffe/15 - Longs voyages.md ligne 246 : « Vous pouvez soit payer 1d10 CO plus la Taille du navire en pistoles pour une bénédiction, soit réduire l'Humeur de Manann de 4d10. » vs src/state/seaVoyageFlow.ts lignes 994-1000 : if (rest) paye automatiquement, else réduit Humeur automatiquement.

### src/state/targetingModes.ts:105 — sévérité basse
- **Quote** : Liste partielle ASSUMÉE : un buff non listé retombe en 'any' (réticule des deux côtés, jamais caché) — pire cas anodin (buff montrable sur un ennemi).
- **Affirme** : HELPFUL_TARGET_OPS est volontairement incomplète ; les ops bénéfiques absentes de la liste ne cassent rien de grave.
- **Réalité** : C'est une auto-justification explicite d'une couverture partielle (le mot « ASSUMÉE » le dit) du classement d'affinité des sorts — une op bénéfique non listée fait retomber le sort en ciblage 'any', ce qui autorise de viser un allié comme un ennemi sans distinction ; dette non tranchée par l'utilisateur.
- **Fix** : Lister exhaustivement les ops bénéfiques d'après spellOps/GameOp (comme HARMFUL_TARGET_OPS se veut « COMPLÈTE »), ou documenter le choix comme un arbitrage validé plutôt qu'une supposition.
- **Vérif adversariale** : src/state/targetingModes.ts lignes 105–113 : deux registres d'ops de ciblage (HARMFUL / HELPFUL) avec commentaires contrastés — le premier COMPLET, le second ASSUMÉ partiel. C'est une dette de design arbitrée mais non tranchée (validation utilisateur requise).

### src/state/travelFlow.ts:790 — sévérité basse
- **Quote** : Soins de l'ARRIVÉE au relais : le maréchal-ferrant remplace le fer (EDOC 07 l.166), la sellerie est réparée (l.174), la bête boiteuse est laissée aux bons soins de l'étape. Choix documenté : le RAW ne chiffre ni coût ni durée pour ces remises en état — on les résout à l'arrivée
- **Affirme** : Le RAW ne donne ni coût ni durée pour la remise en état des montures blessées ; le code choisit de tout résoudre à l'arrivée, gratuitement et instantanément.
- **Réalité** : Auto-justification explicite (« Choix documenté ») d'une lacune RAW comblée par une convention d'auteur non gatée par argent/temps — c'est une dette de conception assumée, pas une règle canonique.
- **Fix** : Si acceptable, garder tel quel mais retirer le vernis « RAW » du commentaire (c'est une convention de jeu, pas une règle) ; sinon chiffrer un coût/délai d'auteur au niveau de la carte.
- **Vérif adversariale** : EDOC ch.07 « Perte d'un fer » : « L'animal doit se déplacer au pas jusqu'à ce que le fer ait été remplacé » (l.166). « Sangle cassée » : « Jusqu'à ce que la partie abîmée soit réparée » (l.174). Zéro mention de coût ou durée. Le commentaire de src/state/travelFlow.ts lignes 790-794 porte une auto-justification explicite de cette lacune comblée.

### src/state/travelFlow.ts:172 — sévérité basse
- **Quote** : Plafond de marche forcée (heures/jour, canon muet — défaut 10) — paramétrable au niveau carte.
- **Affirme** : Le canon ne fixe aucune limite d'heures de marche forcée par jour ; le code invente un défaut de 10h.
- **Réalité** : Admission explicite (« canon muet ») que la valeur 10 est une invention d'auteur sans ancrage RAW — cohérent avec `WorldMapParams.forcedMaxHours` dans worldMap.ts (même aveu), mais reste une règle maison non validée comme telle par l'utilisateur.
- **Fix** : Rien à corriger côté fidélité (l'aveu est honnête) ; s'assurer que la valeur reste éditable et documentée comme choix de MJ dans l'UI, pas présentée comme RAW.
- **Vérif adversariale** : travelFlow.ts:171 + worldMap.ts:94-95, Warhammer v4 LDB ch.51 l.195 (« Temps de voyage »)

### src/state/travelFlow.ts:249 — sévérité basse
- **Quote** : transport : cadence du véhicule (RAW muet) = heures de route standard
- **Affirme** : Le RAW ne précise pas combien d'heures par jour un transport payant (diligence/barge) voyage ; le code retombe sur la cadence de base (6h) faute de règle.
- **Réalité** : Deuxième aveu de silence du RAW dans le même fichier — le choix (cadence de base) est raisonnable mais non sourcé, à faire trancher/valider explicitement plutôt que de rester un défaut implicite.
- **Fix** : Documenter ce choix dans docs/raw (déplacement) comme convention d'auteur assumée, ou laisser tel quel si déjà validé ailleurs.
- **Vérif adversariale** : EDOC « Chapitre 4 - Montures et véhicules » l.142 (montures : 12h) vs l.225-229 (véhicules : marche/trot seulement, durée quotidienne non spécifiée). Absence réelle et documentée correctement dans le commentaire du code.


## TOMBSTONE — pierres tombales / rappels de l'ancien (→ suppression) (33)

### src/engine/careerSlots.ts:23 — sévérité basse
- **Quote** : plus de round-trip `advancementLabel→parseEntry` au runtime.
- **Affirme** : Rappel qu'un ancien chemin de résolution par round-trip label a été retiré.
- **Réalité** : Pierre tombale d'une refonte passée (slotOptionsFromRef remplace l'ancien chemin).
- **Fix** : Supprimer le rappel de l'ancien round-trip (git porte l'historique).
- **Vérif adversariale** : Fichier: src/engine/careerSlots.ts, lignes 22-26 du bloc JSDoc de module. Le commentaire cite correctement le changement de moteur et documente pourquoi l'ancien chemin n'existe plus.

### src/engine/careerSlots.ts:320 — sévérité basse
- **Quote** : if (max == null) return null; // sans limite (ex-« Aucun »)
- **Affirme** : Rappel qu'un ancien littéral « Aucun » existait avant migration en `null`.
- **Réalité** : Pierre tombale d'une ancienne représentation de donnée, sans utilité pour la lecture du code actuel.
- **Fix** : Supprimer « (ex-« Aucun ») » (git porte l'historique).
- **Vérif adversariale** : src/engine/careerSlots.ts l.318-329 : fonction talentMaxById() + talentMaxLabel() montre que null est la représentation stable actuelle de « sans limite ». Le commentaire ex-« Aucun » ne documente que l'historique de la migration, pas la vérité courante.

### src/engine/combatFeatures/dispatch.ts:29 — sévérité basse
- **Quote** : remplace les checks en dur `talentId === 'magie-des-arcanes'`
- **Affirme** : Le commentaire documente que ce code remplace d'anciens checks en dur par nom de talent.
- **Réalité** : Rappel de l'ancien code supprimé — n'apporte aucune information sur le comportement actuel de `arcaneDomainOf`, juste un historique de migration.
- **Fix** : Supprimer la mention de l'ancien code (git porte l'historique) ; garder uniquement la description de la fonction actuelle.
- **Vérif adversariale** : Fichier : src/engine/combatFeatures/dispatch.ts, lignes 28-30. Le commentaire de `arcaneDomainOf` décrit le comportement (lire `castingKind` en donnée) puis ajoute « remplace les checks en dur `talentId === 'magie-des-arcanes'` ». L'auditeur affirme ce commentaire n'apporte aucune info sur le comportement actuel — c'est incorrect ; le problème est le mélange style-historique, pas l'absence de documentation du présent.

### src/engine/combatFeatures/dispatch.ts:185 — sévérité basse
- **Quote** : Tout trait/talent qui déclare la capacité contre — plus de branche par-nom `hasChampionDefense`/`hasRiposte`.
- **Affirme** : Documente qu'une ancienne branche nommée par talent/trait a été retirée au profit de la capacité générique `counterOnDefenseWin`.
- **Réalité** : Pierre tombale d'un mécanisme disparu, sans valeur pour comprendre `canCounterOnDefenseWin` aujourd'hui.
- **Fix** : Supprimer le rappel de l'ancienne implémentation nommée (git porte l'historique).
- **Vérif adversariale** : src/engine/combatFeatures/dispatch.ts l.185 — bloc JSDoc de `canCounterOnDefenseWin()`, énoncé exact : « plus de branche par-nom `hasChampionDefense`/`hasRiposte` »

### src/engine/combatFeatures/dispatch.ts:306 — sévérité basse
- **Quote** : Lu par merchantFlow à la conclusion (remplace le name-match `=== 'Négociateur'`).
- **Affirme** : Documente que `hasBargainBonus` remplace un ancien matching par libellé exact du talent.
- **Réalité** : Rappel de code legacy retiré, sans lien avec le comportement actuel de la fonction.
- **Fix** : Supprimer la mention de l'ancien name-match (git porte l'historique).
- **Vérif adversariale** : src/engine/combatFeatures/dispatch.ts lignes 305-309 : la mention du name-match existe bien en commentaire ; elle documente une vraie migration historique (critères pour identifier le talent passant de « comparaison de libellé » à « drapeau dans la donnée »). La fix proposée (supprimer la mention) est valide mais basseprioritaire.

### src/engine/combatFeatures/dispatch.ts:313 — sévérité basse
- **Quote** : Réf STRUCTURÉE par id (plus de match par libellé). LDB 10.
- **Affirme** : Documente qu'un ancien matching par libellé de compétence a été remplacé par un matching structuré par id.
- **Réalité** : Rappel de l'ancien mécanisme de matching, sans information supplémentaire sur `talentReverseFailed` lui-même.
- **Fix** : Supprimer le rappel de l'ancien mécanisme (git porte l'historique).
- **Vérif adversariale** : src/engine/combatFeatures/dispatch.ts:313 — bloc DOC de talentReverseFailed() contient « Réf STRUCTURÉE par id (plus de match par libellé). LDB 10. » — documenté comme rappel des changements passés, pas d'info mécanique actuelle. Le pattern est présent dans d'autres fonctions (hasBargainBonus l.306, talentEncumbranceBonus l.323, talentCorruptionThreshold l.328, hasSurgery l.333).

### src/engine/combatFeatures/dispatch.ts:37 — sévérité basse
- **Quote** : fin de l'incohérence Vent/Lore — plus de round-trip `domainByLabel`
- **Affirme** : Documente la fin d'un ancien va-et-vient de résolution de Domaine par libellé (`domainByLabel`).
- **Réalité** : Rappel de migration passée sans rapport avec le comportement présent de `arcaneDomainIdOf`.
- **Fix** : Supprimer le rappel de l'ancien round-trip (git porte l'historique).
- **Vérif adversariale** : src/engine/combatFeatures/dispatch.ts lignes 36-38 : docstring de `arcaneDomainIdOf`, mentionne explicitement « fin de l'incohérence Vent/Lore — plus de round-trip `domainByLabel` ».

### src/engine/conditions.ts:339 — sévérité basse
- **Quote** : // Hémorragique : dégâts par-round (« 1 Blessure par pion, en ignorant les modificateurs », l.104) MIGRÉS   // en données — etats.json hemorragique `effects: onRoundEnd → wounds {stacks:'self'}` (défaut : ignore   // BE+PA), avec `stacksReducedBy:'bleedIgnore'` pour l'Endurci (LDB 10), joué par fireConditionEffects.
- **Affirme** : Bloc de 4 commentaires successifs (l.339-354) documentant chacun qu'un comportement (Hémorragique/Empoisonné/En Flammes/Sonné/dissipations) a été « MIGRÉ » du code vers `etats.json`, avec le rappel qu'il n'y a « plus de branche par-nom » correspondante.
- **Réalité** : Pierre tombale de migration répétée 4-5 fois dans `endOfRound` — utile ponctuellement pour la revue de la migration, mais devenu du bruit de commentaire pérenne une fois la migration actée (git porte l'historique de la suppression du code par-nom).
- **Preuve** : endOfRound() ne contient plus aucune logique par-nom pour ces États — seul le bloc de commentaires en traces le fait.
- **Fix** : Condenser en une seule note de tête de fonction (« tous les effets périodiques d'État sont data-driven via etats.json/fireConditionEffects ») au lieu de 4 tombstones par État.

### src/engine/creatureEquip.ts:5 — sévérité basse
- **Quote** : Avant, ces fonctions vivaient dans `state/spawn` → inaccessibles au rendu → l'exploration n'affichait pas l'équipement.
- **Affirme** : Rappelle où vivait le code avant sa migration et le bug que cela causait.
- **Réalité** : Pur historique de refactor sans valeur pour comprendre le code actuel ; git porte déjà cet historique.
- **Preuve** : src/engine/creatureEquip.ts:5-6
- **Fix** : Supprimer la phrase « Avant, ces fonctions... » (garder seulement la justification structurelle du cycle de couches).
- **Vérif adversariale** : src/engine/creatureEquip.ts lignes 5-6 : « Avant, ces fonctions vivaient dans `state/spawn` → inaccessibles au rendu → l'exploration n'affichait pas l'équipement. » La justification structurelle valide est aux lignes 3-4 (source unique, cycle de couches). La phrase historique est redondante et peut être supprimée.

### src/engine/items.ts:676 — sévérité basse
- **Quote** : Les refs `{text}` (flavor hors catalogue : « Réseau d'informateurs ») n'ont pas de stats → ignorées (comme l'ancien runtime).
- **Affirme** : Comparaison au comportement d'un « ancien runtime » disparu.
- **Réalité** : Rappel de l'ancien code, sans valeur informative pour la compréhension du comportement actuel — git porte déjà l'historique.
- **Fix** : Supprimer « (comme l'ancien runtime) » — le comportement actuel se suffit à lui-même.
- **Vérif adversariale** : src/engine/items.ts lignes 673-680 : le commentaire de la fonction buildInventory cite exactement « (comme l'ancien runtime) » et le code suivant confirme le filtrage décrit (`if (!('id' in ref)) continue`).

### src/engine/miscast.ts:70 — sévérité basse
- **Quote** : value (e.g. `d(1,10,sin)` in the old inline code → `{ n:1, sides:10, sinPlus:true }` in JSON).
- **Affirme** : Rappel de l'ancienne forme de code (closure inline `d(1,10,sin)`) qui n'existe plus dans le fichier.
- **Réalité** : Le code actuel ne connaît que la forme JSON (`JsonDice`/`sinPlus`) ; l'« ancien code inline » a disparu et n'apporte plus d'information utile au lecteur du fichier tel qu'il est aujourd'hui.
- **Preuve** : interface JsonDice extends DiceSpec { sinPlus?: boolean; } — aucune trace de `d(n,s,sin)` ailleurs dans le fichier.
- **Fix** : Supprimer la référence à « l'ancien code inline » (git porte l'historique) ; ne garder que la description de la forme JSON actuelle.
- **Vérif adversariale** : Lignes 67-75 : commentaire complet du type `JsonDice` qui cite l'exemple `d(1,10,sin)` → `{ n:1, sides:10, sinPlus:true }`. Pattern répété (systématique) en 73-74 (« replaces the old closure »), 80 (« old inline »), 93 (« old inline »). Aucune trace de la syntaxe inline dans le runtime.

### src/engine/miscast.ts:80 — sévérité basse
- **Quote** : `{ sinPlus1: true }` encodes the pattern `1 + sin` (old inline: `amount: 1 + sin`).
- **Affirme** : Rappel d'une ancienne expression inline (`amount: 1 + sin`) remplacée par le format JSON.
- **Réalité** : Le fichier ne contient plus cette forme ; c'est un vestige de commentaire de migration.
- **Preuve** : type JsonFormula = number | { dice: JsonDice } | { sinPlus1: true };
- **Fix** : Supprimer le rappel « old inline » (git porte l'historique).
- **Vérif adversariale** : src/engine/miscast.ts lignes 78-81 : bloc de commentaire de spécification JsonFormula, documenting intentional la migration de syntaxe anciennes.

### src/engine/miscast.ts:91 — sévérité basse
- **Quote** : `sinPlus1Value`: when true the `value` of a `condition` op is `1 + sinPoints` at runtime (old inline: `cond('name', 1 + sin)`).
- **Affirme** : Rappel d'une ancienne fonction/expression `cond('name', 1 + sin)` qui n'existe plus.
- **Réalité** : Vestige de commentaire de migration décrivant le code d'avant le passage aux données JSON.
- **Preuve** : type JsonOp = { op: string; name?: string; value?: JsonFormula; sinPlus1Value?: boolean; ... }
- **Fix** : Supprimer le rappel « old inline » (git porte l'historique).
- **Vérif adversariale** : miscast.ts l.90-91, bloc de documentation du type JsonOp. Le commentaire est exact et fait bien partie des vestiges pédagogiques de migration (voir aussi l.80, l.93). Le pattern est correctement implémenté en JSON via les flags `sinPlus1Value`/`sinPlus` résolus par `resolveJsonFormula(f, sin)` (l.140).

### src/engine/policy.ts:527 — sévérité basse
- **Quote** : // NB : l'ancien flag POC `travel-forage` est RETIRÉ — l'Approvisionnement est désormais un POSTE // d'Activité (un héros assigné via `travelRole`), résolu par `travelPostes` sous « Voyage par Étapes ».
- **Affirme** : Pierre tombale documentant un ancien flag retiré et son remplacement.
- **Réalité** : Rappel de l'ancien système, sans valeur pour la compréhension du code actuel ; git porte déjà l'historique.
- **Fix** : Supprimer ce commentaire (l'historique est dans git).
- **Vérif adversariale** : src/engine/policy.ts l.527-528 : commentaire présent, pierre tombale avérée, documenting replaced travel-forage mechanism.

### src/engine/psychology.ts:241 — sévérité basse
- **Quote** : posé par l'entrée — Action héros / décision IA / Rage) — remplace l'ancien drapeau `Combatant.frenzied`.
- **Affirme** : Rappel qu'un ancien champ `Combatant.frenzied` existait et a été remplacé.
- **Réalité** : Pierre tombale de refactor — l'information n'apporte rien au lecteur actuel, l'historique est dans git.
- **Preuve** : export function isFrenzied(c: Combatant): boolean { … }
- **Fix** : Supprimer la mention de l'ancien drapeau (git porte l'historique).
- **Vérif adversariale** : src/engine/psychology.ts:241 — JSDoc de `isFrenzied(c)` cite le refactor (`Combatant.frenzied` → `psychState`). Commentaire superflu pour le lecteur actuel, l'historique vit dans git.

### src/engine/psychology.ts:326 — sévérité basse
- **Quote** : ce calcul que sur un ÉCHEC (le succès n'inflige rien) : SOURCE UNIQUE, ex-`terreurBrise` généralisée. */
- **Affirme** : Rappel qu'une fonction `terreurBrise` existait avant d'être généralisée en `failConditionAmount`.
- **Réalité** : Pierre tombale de refactor — rappel de l'ancien nom, sans valeur pour la compréhension du code actuel.
- **Preuve** : export function failConditionAmount(spec, indice, sl): number { … }
- **Fix** : Supprimer la mention « ex-`terreurBrise` » (git porte l'historique).
- **Vérif adversariale** : Lire src/engine/psychology.ts l.322-335 : le commentaire complet explique bien le paramètre `spec`, mais la phrase « SOURCE UNIQUE, ex-`terreurBrise` généralisée » est une note de contexte historique. Git porte l'histoire ; le code seul est suffisant.

### src/engine/qualities/dispatch.ts:7 — sévérité basse
- **Quote** : Plus de `defs/` mécaniques : la MÉCANIQUE de chaque qualité vit dans `qualities.json`, lue PAR ID
- **Affirme** : Rappel qu'un ancien mécanisme `defs/` a été retiré.
- **Réalité** : Pierre tombale d'une migration passée, sans valeur pour le lecteur actuel du fichier.
- **Fix** : Supprimer la mention de l'ancien `defs/` (git porte l'historique).
- **Vérif adversariale** : src/engine/qualities/dispatch.ts : lignes 7-9 documentent la structure ACTUELLE (qualityById → passive: GameOp[], capabilities) que le code ligne 33 et 42-43 utilise directement pour résoudre les qualités. Le rappel du `defs/` ancien donne du contexte mais la substance du commentaire reste une doc architecturale utile du présent.

### src/engine/woundsCalc.ts:6 — sévérité basse
- **Quote** : Comportement IDENTIQUE à l'ancien `combat.woundsFromHit` (refacto pure).
- **Affirme** : Rappel explicite de l'ancien emplacement/nom de la fonction avant extraction.
- **Réalité** : Rappel de l'ancien état du code sans valeur pour la compréhension actuelle du module — l'historique Git porte déjà cette information.
- **Preuve** : src/engine/woundsCalc.ts l.2-6 (bloc de commentaire d'en-tête).
- **Fix** : Supprimer la phrase (git porte l'historique).
- **Vérif adversariale** : Lu `src/engine/woundsCalc.ts` l.5-6 : le commentaire d'en-tête rappelle explicitement l'ancien nom `combat.woundsFromHit` et sa nature de refactoring pur — typique tombstone.

### src/state/aiSpellValue.ts:74 — sévérité basse
- **Quote** : (Ex-table CONDITION_THREAT retirée : ses clés `etourdi`/`hemorragie` étaient PÉRIMÉES — les vraies conditions sont `sonne`/`hemorragique` → l'IA sous-valorisait l'étourdissement.)
- **Affirme** : Documente un ancien mécanisme retiré (CONDITION_THREAT) et pourquoi.
- **Réalité** : Pierre tombale pure — rappelle une table qui n'existe plus dans le code ; l'historique est déjà porté par git.
- **Fix** : Supprimer le commentaire (git porte l'historique) et ne garder que la doc du mécanisme actuel (aiThreat en donnée).
- **Vérif adversariale** : Fichier src/state/aiSpellValue.ts lignes 74-75 : le commentaire existe exactement tel que cité, et explique bien pourquoi un ancien mécanisme (CONDITION_THREAT) a disparu.

### src/state/combat/hitModifiers.ts:4 — sévérité basse
- **Quote** : Les sauvegardes SYNCHRONES « après la touche » d'`applyAttackResult` (anciennement une suite de `if` dont l'ordre était implicite-dans-le-code) vivent ICI
- **Affirme** : Rappel de l'ancienne implémentation en `if` successifs, désormais remplacée par le registre `HitModifier`.
- **Réalité** : Pierre tombale de refactor — l'information utile (ordre RAW encodé par `order`) est déjà donnée juste après ; le rappel de l'ancien code n'apporte rien de plus (git porte l'historique).
- **Preuve** : src/state/combat/hitModifiers.ts l.1-22 (bloc de tête du module)
- **Fix** : Supprimer la parenthèse « anciennement une suite de `if`… » (git porte l'historique).
- **Vérif adversariale** : Fichier `src/state/combat/hitModifiers.ts` l.4-5 : phrase « (anciennement une suite de `if` dont l'ordre était implicite-dans-le-code) » — citation exacte du constat vérifiée. L'ordre RAW est bien documenté après (l.19-21), donc la suppression de cette parenthèse n'efface aucune information utile. Fix proposé (supprimer la parenthèse) est valide.

### src/state/combat/roundHooks.ts:126 — sévérité basse
- **Quote** : Mâchoires d'acier (LDB 10) NE vit PLUS comme un hook de franchissement de Round : c'est un effet // DÉCLENCHÉ `onGainCondition` data-driven (talents.json) — « chaque fois que vous gagnez un État Sonné », // résolu cadence-aware par la brique `combat/triggeredTest` (héros manuel → cascade influençable ; // ennemi/auto → jet inline). L'ordre 60 du franchissement de Round est désormais libre.
- **Affirme** : Rappel de l'ancien emplacement (hook d'ordre 60) et de son remplacement.
- **Réalité** : Pierre tombale pure : ne décrit plus rien du code présent, juste l'historique de la migration.
- **Fix** : Supprimer (git porte l'historique).
- **Vérif adversariale** : LDB 10 (Mâchoires d'acier = déclencheur onGainCondition, Test Résistance Intermédiaire quand État Sonné gagné) ; talents.json implémente bien ce trigger ; commit 7d0ec114 : migration du hardcode vers data-driven ; aucune référence à Mâchoires d'acier ni d'ordre 60 dans roundHooks.ts actuel.

### src/state/combat/roundHooks.ts:136 — sévérité basse
- **Quote** : Récupération du Brisé (LDB 16 l.55-59 ; Cœur vaillant LDB 10) MIGRÉE en DONNÉES (etats.json `brise.effects`, // 2 effets `onRoundEnd`) : ... Plus de hook `broken-recovery` ni de `brokenContext`/`brokenRecoveryApply`.
- **Affirme** : Rappel de l'ancien hook/fonctions supprimés (`broken-recovery`, `brokenContext`, `brokenRecoveryApply`).
- **Réalité** : Ces symboles n'existent plus dans le code ; le commentaire ne documente que leur absence passée.
- **Fix** : Supprimer (git porte l'historique).
- **Vérif adversariale** : Fichier: src/state/combat/roundHooks.ts lignes 136–142. Citation: « Plus de hook `broken-recovery` ni de `brokenContext`/`brokenRecoveryApply` ». Contexte: commentaire de migration documentant le retrait du code ancien.

### src/state/combat/roundHooks.ts:339 — sévérité basse
- **Quote** : (La Résistance à l'Empoisonné n'a PLUS d'applier dédié : son étape est de kind `triggeredTest` (générique), //  résolue par l'applier `triggeredTest` de la brique cadence-aware — la branche `success`/`fail` de la donnée //  (retire 1+DR, puis Exténué si vidé) y est rejouée. Plus de `poisonResistApply` par-nom.)
- **Affirme** : Rappel de l'ancienne fonction `poisonResistApply` supprimée.
- **Réalité** : Symbole absent du code actuel ; commentaire purement historique.
- **Fix** : Supprimer (git porte l'historique).
- **Vérif adversariale** : Lu `src/state/combat/roundHooks.ts` l.339-341 (commentaire cité) + `src/engine/conditions.ts` l.322-325 (confirmation suppression fonction, migration en donnée). Pas de résidu d'implémentation détecté par `Grep poisonResistApply` dans le source.

### src/state/combat/roundHooks.ts:343 — sévérité basse
- **Quote** : (La récupération du Brisé n'a PLUS d'applier dédié : son étape est de kind `triggeredTest` (générique), //  résolue par l'applier `triggeredTest` de la brique cadence-aware — la branche `success`/`fail` de la donnée //  (retire 1+DR, puis Exténué si vidé) y est rejouée. Plus de `brokenRecoveryApply` par-nom.)
- **Affirme** : Rappel de l'ancienne fonction `brokenRecoveryApply` supprimée.
- **Réalité** : Symbole absent du code actuel ; commentaire purement historique, redondant avec celui de la ligne 136.
- **Fix** : Supprimer (git porte l'historique).
- **Vérif adversariale** : Fichier lu : `src/state/combat/roundHooks.ts`, lignes 136–142 et 343–345. Grep `brokenRecoveryApply` : 1 unique occurrence (dans ce fichier, dans les deux commentaires). Aucune fonction existante portant ce nom.

### src/state/combat/turnHooks.ts:4 — sévérité basse
- **Quote** : séquence de début de tour de l'IA (anciennement 4 appels inline en tête de `runEnemyAI`) vit ICI
- **Affirme** : Rappel de l'ancienne structure (4 appels inline dans `runEnemyAI`) avant l'extraction en hooks.
- **Réalité** : Pierre tombale d'un refactor déjà effectué — l'historique git porte déjà cette information.
- **Fix** : Supprimer la mention « anciennement 4 appels inline… » (garder seulement la description du fonctionnement actuel).
- **Vérif adversariale** : src/state/combat/turnHooks.ts ligne 4 : fragment du bloc JSDoc « séquence de début de tour de l'IA (anciennement 4 appels inline en tête de `runEnemyAI`) vit ICI ». L'historique git suffit à documenter le refactor ; le commentaire peut se concentrer sur le fonctionnement présent.

### src/state/combatArea.ts:8 — sévérité basse
- **Quote** : Bout portant → la cible seule, **+Indice aux Dégâts** (RAW ; ≠ l'ancien « +Indice Blessures » brut) ;
- **Affirme** : Rappel comparatif d'un ancien comportement du code (« +Indice Blessures » brut) désormais remplacé.
- **Réalité** : Pierre tombale d'une ancienne implémentation ; n'apporte rien à la compréhension du comportement actuel (déjà décrit juste avant : « +Indice aux Dégâts »).
- **Preuve** : src/state/combatArea.ts ligne 8, dans l'en-tête de fichier.
- **Fix** : Supprimer le rappel « ≠ l'ancien… » (git porte l'historique).
- **Vérif adversariale** : src/state/combatArea.ts ligne 8 & 148-152 : en-tête JSDoc + code qui calcule `woundsFromHit(..., hit.damage + indice, ...)` (Indice aux Dégâts appliqué AVANT armure, non brut). La remarque parenthétique « ≠ l'ancien » est confirmée tombale et supprimable sans perte pédagogique.

### src/state/keybindings.ts:3 — sévérité basse
- **Quote** : la rotation caméra + Échap, jadis dans le keydown d'IsoStage, vivent désormais ICI : remappables comme le reste
- **Affirme** : Documente un déplacement de code depuis IsoStage vers ce registre.
- **Réalité** : Rappel de l'ancien emplacement, information déjà portée par git.
- **Fix** : Supprimer le rappel de l'ancien emplacement (git porte l'historique).
- **Vérif adversariale** : Fichier src/state/keybindings.ts, bloc 1-9 : docstring qui mentionne « jadis dans le keydown d'IsoStage, vivent désormais ICI » ; pure reminiscence d'ancien emplacement. Correspond exactement au feedback CLAUDE.md sur les commentaires-rappels. À supprimer.

### src/state/medicFlow.ts:4 — sévérité basse
- **Quote** : Remplace le POC à trois flux (HealModal hors combat, medicalAid mono-acte, chirurgie autonome).
- **Affirme** : Ce module remplace un ancien système à trois flux distincts.
- **Réalité** : Rappel de l'ancien code retiré ; n'apporte aucune information sur le comportement actuel.
- **Fix** : Supprimer cette phrase (git porte l'historique).
- **Vérif adversariale** : src/state/medicFlow.ts lignes 4-5 : la phrase « Remplace le POC à trois flux (HealModal hors combat, medicalAid mono-acte, chirurgie autonome). » cite une architecture supercédée. HealModal.tsx existe toujours mais réduit à un composant de flux de jet embarqué (dual : combat + hôte MedicModal), jamais une modale autonome hors combat.

### src/state/partyFlow.ts:617 — sévérité basse
- **Quote** : // (usePartyItem — consommable hors combat — vit désormais dans `state/consumableFlow.ts` : le Flow du //  consommable peut porter un nœud `test` → modale restreinte au buveur, hors de portée de ce module.)
- **Affirme** : Rappel de l'ancien emplacement de usePartyItem et pourquoi il a déménagé.
- **Réalité** : Pierre tombale en fin de fichier, sans code adjacent — pur rappel historique.
- **Fix** : Supprimer (git porte l'historique).
- **Vérif adversariale** : src/state/partyFlow.ts l.617-618 : pierre tombale confirmée, aucun code adjacent, consumableFlow.ts existe bel et bien. Le commentaire peut être supprimé.

### src/state/relief.ts:9 — sévérité basse
- **Quote** : Remplace les deux forfaits dispersés de l'ancien modèle : `FALL_METRES_PER_LEVEL` (jumpMove) et `TILES_PER_LEVEL` (footprint) - leurs lecteurs migrent vers les helpers d'ici.
- **Affirme** : Documente une migration passée depuis un ancien modèle de constantes.
- **Réalité** : Pierre tombale d'un modèle disparu ; git porte déjà cet historique.
- **Fix** : Supprimer le rappel de l'ancien modèle (git porte l'historique).
- **Vérif adversariale** : Fichier src/state/relief.ts lignes 9-10 : le texte « Remplace les deux forfaits dispersés de l'ancien modèle : `FALL_METRES_PER_LEVEL` (jumpMove) et `TILES_PER_LEVEL` (footprint) — leurs lecteurs migrent vers les helpers d'ici. » est confirmé. Grep: aucune déclaration de ces constantes en code actif, seulement commentaires historiques.

### src/state/relief.ts:58 — sévérité basse
- **Quote** : identique à l'ancien forfait `TILES_PER_LEVEL=2`, mais exact pour toute hauteur.
- **Affirme** : Compare la nouvelle formule à une ancienne constante retirée du code.
- **Réalité** : Rappel de code disparu, plus vérifiable dans l'arbre actuel.
- **Fix** : Supprimer la référence à l'ancien forfait (git porte l'historique).
- **Vérif adversariale** : src/state/relief.ts:58 — « vaut 2 cases, identique à l'ancien forfait `TILES_PER_LEVEL=2`, mais exact pour toute hauteur. » + contexte lignes 9-10 confirmant suppression de TILES_PER_LEVEL.

### src/state/rollFlowSpecs.ts:395 — sévérité basse
- **Quote** : « Annuler » (ex-`attackCancel`, migré verbatim) : défaire la charge misclic AVANT le jet
- **Affirme** : Rappelle l'ancien nom `attackCancel` de la fonction migrée.
- **Réalité** : Le code actuel n'a plus de fonction `attackCancel` séparée ; le rappel de l'ancien nom n'apporte rien au lecteur du code présent.
- **Preuve** : src/state/rollFlowSpecs.ts:395 — onCancel: (get, set) => { ... } (implémentation actuelle, sans trace d'un `attackCancel` distinct)
- **Fix** : Supprimer la mention « ex-attackCancel, migré verbatim » (git porte l'historique).
- **Vérif adversariale** : src/state/rollFlowSpecs.ts:395 — `// « Annuler » (ex-`attackCancel`, migré verbatim)` ; git suffit pour l'historique.

### src/state/rollFlowSpecs.ts:1276 — sévérité basse
- **Quote** : STRUCTURÉ `test.matches`, par id ; subsume l'ex-`talentTestDR`). Le contexte `when` n'est pas
- **Affirme** : Référence à une ancienne fonction `talentTestDR` désormais absorbée.
- **Réalité** : Rappel de nom historique sans valeur pour le code présent.
- **Preuve** : src/state/rollFlowSpecs.ts:1276
- **Fix** : Supprimer la mention de l'ex-`talentTestDR` (git porte l'historique).
- **Vérif adversariale** : Vérifié : `talentTestDR` n'existe que dans ce commentaire (ligne 1276). Le code utilise correctement `talentTestSLBonus` (définie src/engine/magic.ts:273, importée partout). Tombstone valide.


## DOC-STALE — affirmations de docs/ devenues fausses (30)

### docs/audit-data-driven.md:26 — sévérité haute
- **Quote** : 9 | Paliers d'Encombrement | `engine/encumbrance.ts:46-52` | Basse | ⏸️ DIFFÉRÉ | 3 paliers dont un `Infinity` (non-JSON) ; faible ROI, code clair (constantes LDB). À confirmer.
- **Affirme** : Les paliers d'Encombrement restent des constantes en dur dans le moteur, y compris un palier `Infinity` non représentable en JSON, et cette migration est différée.
- **Réalité** : Les paliers vivent désormais dans `src/data/encumbranceTiers.json` (chargé en `ENCUMBRANCE_TIERS`), et le palier `Infinity` a été remplacé par `movePenalty: null` + un flag booléen `immobile` — la migration est FAITE, pas différée.
- **Preuve** : src/engine/encumbrance.ts:41-43 : "Profils de pénalité par palier (LDB p.295) — DONNÉE (`src/data/encumbranceTiers.json`). Le palier 3 porte `movePenalty: null` (immobilisé : le flag `immobile` court-circuite, plus d'`Infinity`)" ; fichier src/data/encumbranceTiers.json existe (558B)
- **Vérif adversariale** : Lu src/engine/encumbrance.ts (lignes 1-70) : commentaire ligne 41-42 dit explicitement « DONNÉE (src/data/encumbranceTiers.json). Le palier 3 porte movePenalty: null (immobilisé : le flag immobile court-circuite, plus d'Infinity) ». Type EncumbrancePenalties (ligne 30) confirme movePenalty: number | null. Fichier src/data/encumbranceTiers.json vérifié présent, 558 octets — correspond exactement à l'evidence citée dans le constat.

### docs/audit-data-driven.md:9 — sévérité haute
- **Quote** : Seuls #8/#9 (bornés, faible ROI) restent différés.
- **Affirme** : Le bilan global affirme que deux îlots (Seuil Corps/Esprit et paliers d'Encombrement) restent non-migrés à ce jour.
- **Réalité** : Ces deux îlots ont depuis été migrés en JSON (voir findings ci-dessus sur les lignes 25-26) — le dépôt est en réalité 100% conforme à l'exigence data-driven pour ces items, contrairement à ce qu'affirme le bilan.
- **Preuve** : src/engine/corruption.ts:122-129, src/engine/encumbrance.ts:41-43, src/data/encumbranceTiers.json
- **Vérif adversariale** : src/engine/corruption.ts:122-128 : mutationKindFor délègue à mutationBodyMaxForSpecies(species), qui lit SpeciesData.mutationBodyMax (src/data/index.ts:1448-1449, champ défini ligne 153) — plus de match sur nom d'espèce en dur. src/engine/encumbrance.ts:41-56 : ENCUMBRANCE_TIERS = encumbranceTiersJson as EncumbrancePenalties[], et encumbrancePenalties() indexe ce tableau ; src/data/encumbranceTiers.json existe bien sur disque. Le tableau d'état du même fichier (lignes 9-10 du markdown) marque pourtant #8/#9 en ⏸️ DIFFÉRÉ — c'est ce tableau + la phrase de synthèse ligne 9 qui sont périmés.

### docs/audit-systemes.md:70 — sévérité haute
- **Quote** : **Fabrique de flux** — `rollFlow.ts` (générateur Lancer→Chance→Pacte→Résilience→Appliquer). 25. **Specs de flux** — `rollFlows.ts` (922 l., ~31 specs : attack/defense/cast/counterspell/focus/trample/...)
- **Affirme** : Les modules de la fabrique de flux de jet s'appellent `rollFlow.ts` et `rollFlows.ts`, ce dernier faisant 922 lignes.
- **Réalité** : Ces deux fichiers n'existent plus. Les modules actuels sont `src/state/rollFlowFactory.ts` (476 l.) et `src/state/rollFlowSpecs.ts` (1530 l.) — c'est d'ailleurs le nommage que le CLAUDE.md du projet utilise déjà. Un agent qui cherche `rollFlow.ts`/`rollFlows.ts` ne le trouvera pas et risque de recréer un module concurrent.
- **Preuve** : ls confirme l'absence de src/state/rollFlow.ts et rollFlows.ts ; src/state/rollFlowFactory.ts (476 l.) et src/state/rollFlowSpecs.ts (1530 l.) existent.
- **Vérif adversariale** : ls src/state/rollFlow*.ts renvoie rollFlowFactory.ts, rollFlowSpecs.ts et rollFlowWiring.test.ts — aucun rollFlow.ts ni rollFlows.ts. Le constat d'audit-systemes.md est bien obsolète.

### docs/combat-events-coherence.md:185 — sévérité haute
- **Quote** : ### Lot 4bis — `state/combat/roundHooks.ts` (11 sites) — contenu d'entité masqué en hook - `unstable` L89-94 → trait Instable `effects:onRoundEnd` ; `bestial-fire-fear` L109-116 → trait Bestial ;   `perturbing-aura` L122-127 → passif trait Perturbant ; `determination-*` L157-163 → talent Détermination ;   `suffocation-tick` L244-247 → **nouvel État interne suffocation** (`etats.json`).
- **Affirme** : Ces 5 hooks (unstable, bestial-fire-fear, perturbing-aura, determination-*, suffocation-tick) sont encore codés en dur dans roundHooks.ts et restent À migrer en donnée.
- **Réalité** : unstable, bestial-fire-fear, perturbing-aura et determination-* sont déjà migrés (le fichier actuel documente chaque migration en commentaire : « MIGRÉ en DONNÉES », « MIGRÉE sur le système de Durée UNIFIÉ »). Et suffocation-tick a été RECLASSÉ en sens inverse de ce que demande le doc : le code actuel argumente explicitement que c'est de la machinerie légitime (« MACHINERIE environnementale UNIVERSELLE... Ne NOMME aucune entité éditable »), pas un candidat à la donnée.
- **Preuve** : src/state/combat/roundHooks.ts lignes 80-142 (commentaires « MIGRÉ en DONNÉES ») et lignes 215-224 (hook suffocation-tick, commentaire justifiant qu'il reste machinerie).
- **Vérif adversariale** : Lu src/state/combat/roundHooks.ts en entier (359 lignes). Extraits clés : l.80-84 (commentaires migration unstable/bestial), l.85-108 (hook recompute-auras générique pour Perturbant), l.131-134 (commentaire Détermination migrée sur système de Durée unifié), l.215-224 (hook suffocation-tick + commentaire justifiant machinerie universelle).

### docs/combat-naval-modele.md — sévérité haute
- **Quote** : « Canon perdu » (`ch.13 l.765`) mécanisé — `loseRandomPoste` retire un poste de `hull.postes` + démancipe son chef (`mannedPoste`/arme) ; ✅ « Canon détaché » (`l.763-764`) mécanisé — `detachPosteCrewHit` : l'équipage du poste teste l'Athlétisme Intermédiaire
- **Affirme** : La mécanisation des critiques navals « Canon perdu » et « Canon détaché » repose sur deux fonctions nommées `loseRandomPoste` et `detachPosteCrewHit`.
- **Réalité** : Ces deux noms de fonction n'existent nulle part dans le repo (grep sur tout src/ : 0 occurrence). Le comportement décrit existe bien mais sous d'autres noms : l'op générique `removeShipPoste` (déclaré et traité dans src/engine/ops.ts l.751 et l.1326-1338, invoqué via applyOps(hull, crit.ops, …) dans applyHullCritical, src/engine/shipCritical.ts l.169-205) pour « Canon perdu », et la fonction data-driven `applyCrewHit` (même fichier, l.145-158, pilotée par un objet ShipCrewTest avec crewTarget:'poste') pour « Canon détaché ».
- **Preuve** : src/engine/ops.ts:751,1326-1338 ; src/engine/shipCritical.ts:145-158,169-205 — aucune trace de loseRandomPoste/detachPosteCrewHit
- **Vérif adversariale** : Grep sur src/ : 0 occurrence de loseRandomPoste/detachPosteCrewHit. Confirmé : ops.ts L751 `{ op: 'removeShipPoste' }`, L1326 `case 'removeShipPoste':`, L1337 `t('op.removeShipPoste', …)` ; shipCritical.ts L145 `export function applyCrewHit(hull, crew, crewTest, rng)`, L169 `applyHullCritical`, L202 `applyCrewHit(hull, crew, crit.crewTest, rng)`, avec un commentaire L194/199 qui référence lui-même `removeShipPoste`.

### docs/creer-une-creature.md — sévérité haute
- **Quote** : // tenues/defs/Ma-tenue.ts import { NU_TORSE_FRONT, NU_TORSE_BACK, NU_TORSE_PROFILE, NU_JAMBE } from '../nuViews'; export const tenue: TenueDef = {   name: 'Ma créature',     // = la career pointée par le def   career: true,
- **Affirme** : Une tenue se dépose dans tenues/defs/<Nom>.ts, importe des helpers NU_TORSE_FRONT/BACK/PROFILE, NU_JAMBE depuis un module ../nuViews, et son type TenueDef porte un champ career: true.
- **Réalité** : Le vrai chemin est src/gameIso/rig/parts/tenues/defs/<Nom>.ts (pas tenues/defs/ à la racine de rig/). TenueDef (src/gameIso/rig/parts/tenues/types.ts) = { name: string; set: TenueSet; palette?: StoredPalette; bareFoot?: boolean } — aucun champ career. Aucun fichier/export nuViews, NU_TORSE_FRONT, NU_TORSE_BACK, NU_TORSE_PROFILE, NU_JAMBE n'existe dans le dépôt (grep vide sur tout src/gameIso/rig). Les tenues réelles (Demonette.ts, Chamane-Bray.ts…) n'utilisent ni cet import ni ce champ.
- **Preuve** : src/gameIso/rig/parts/tenues/types.ts:23 (export type TenueDef = { name: string; set: TenueSet; palette?: StoredPalette; bareFoot?: boolean };) ; src/gameIso/rig/parts/tenues/defs/Demonette.ts (aucun career, aucun import nuViews)
- **Vérif adversariale** : Lu src/gameIso/rig/parts/tenues/types.ts (TenueDef = {name,set,palette?,bareFoot?}, aucun career) et docs/creer-une-creature.md lignes 65-91 (le snippet cite `career: true` et `import ... from '../nuViews'`, incohérent avec le vrai type et avec le reste du doc qui décrit career comme pointé par perso.career sur le CreatureDef).

### docs/creer-une-creature.md — sévérité haute
- **Quote** : tenue de carrière au registre : tenues/defs/<Nom>.ts avec career: true, et le def pointe perso.career: '<Nom>'.
- **Affirme** : Le def de créature pointe vers sa tenue via le champ perso.career.
- **Réalité** : Le champ réel dans CreaturePerso est perso.tenue, pas perso.career. Vérifié sur tous les defs de créature existants (Vermine-de-choc.ts : tenue: 'Vermine de choc', Rat-ogre.ts : tenue: 'Rat ogre', Demonette.ts : tenue: 'Démonette').
- **Preuve** : src/gameIso/rig/creatures/defs/Vermine-de-choc.ts:10 (tenue: 'Vermine de choc',) ; src/gameIso/rig/creatures/defs/Rat-ogre.ts:12 (tenue: 'Rat ogre',) ; src/gameIso/rig/creatures/defs/Demonette.ts:16 (tenue: 'Démonette',)
- **Vérif adversariale** : docs/creer-une-creature.md:70 cite littéralement `perso.career: '<Nom>'` ; src/gameIso/rig/creatures/defs/Vermine-de-choc.ts:10 utilise `tenue: 'Vermine de choc',` — aucun champ `career` dans le def.

### docs/i18n-seam.md:8 — sévérité haute
- **Quote** : **État (2026-06-20)** : **Phase A ✅** (primitive `src/i18n/` livrée) + **Phase B ✅** pour les **7 maps de labels du moteur**
- **Affirme** : Seules les Phases A et B sont livrées ; la Phase C (narration : `flowOutcomes`/`result.log`/`describeTestRoll`/`applyOps`) est gated « APRÈS l'unification de la session // ».
- **Réalité** : La Phase C est déjà substantiellement migrée : `describeTestRoll` (engine/ops.ts) appelle `t('op.testRoll', …)`, et un garde-fou dédié `state/i18n-narration-guard.test.ts` (commit 1f0b092b, 2026-06-23, 3 jours après ce doc) liste `engine/ops.ts`, `engine/psychology.ts`, `engine/conditions.ts`, `state/combatFlow.ts`, `state/combatSlice.ts`, `state/flowOutcomes.ts`, `state/combatManeuvers.ts`, `state/combat/turnHooks.ts`, `state/outOfCombatUpkeep.ts` comme entièrement migrés au catalogue — bien plus avancé que ce que le doc décrit.
- **Preuve** : src/engine/ops.ts l.932-939 (describeTestRoll utilise t('op.testRoll',…)) ; src/state/i18n-narration-guard.test.ts (liste MIGRATED, commit 1f0b092b du 2026-06-23).
- **Vérif adversariale** : Lu docs/i18n-seam.md (ligne 8-11 et 61 : Phase C encore « gated »/« restent »). Lu src/engine/ops.ts l.929-939 : describeTestRoll utilise t('op.testRoll', {...}). Lu src/state/i18n-narration-guard.test.ts en entier : liste MIGRATED de 9 fichiers avec baseline ZÉRO littéral FR, commit 1f0b092b daté 2026-06-22 (git log confirmé) — 2 jours après la date affichée dans le doc.

### docs/opera-scenario.md — sévérité haute
- **Quote** : `Trigger.temporalCondition` | Déclencheur **proximité + fenêtre horaire** (`after/before`, before exclusif) — spot-check « au bon endroit au bon moment » | `scene.ts` (`temporalConditionMet`), `checkTriggers` | LogicDock (champs ⏰)
- **Affirme** : Le primitif générique de déclencheur temporel s'appelle `Trigger.temporalCondition`, résolu par une fonction `temporalConditionMet` dans `scene.ts`.
- **Réalité** : `Trigger` n'a plus de champ `temporalCondition` : il expose `when?: Condition` (algèbre unifiée). `src/state/scene.ts:398` documente explicitement « Remplace les anciens `condition`/`temporalCondition` » et `scene.ts:405` : « Les anciens `condMet`/`temporalConditionMet` ont fondu dedans (algèbre de Conditions unifiée) » — évalués par `evalCondition` (`src/engine/flowCore.ts:236`, ré-exporté par `src/state/flow.ts`), pas par une fonction `temporalConditionMet` dans `scene.ts`. `TemporalCondition` (le type de fenêtre horaire) existe toujours mais dans `engine/flowCore.ts:33`, imbriqué comme `{kind:'time', window: TemporalCondition}` d'une `Condition`, pas comme champ direct de `Trigger`. Le scénario Opéra lui-même (`src/scenes/test-scenarios/opera.ts:230-277`) n'utilise d'ailleurs aucune fenêtre horaire — juste un trigger d'entrée `rect` + `delayedEffect`.
- **Preuve** : src/state/scene.ts:392-405 (Trigger interface + commentaire de fusion) ; src/engine/flowCore.ts:33,117,236 (TemporalCondition + evalCondition)
- **Vérif adversariale** : src/state/scene.ts:363,398-405 : `when?: Condition` + commentaire « Remplace les anciens condition/temporalCondition » et « condMet/temporalConditionMet ont fondu dedans ». src/engine/flowCore.ts:33 (TemporalCondition), :117 ({kind:'time', window: TemporalCondition} imbriqué dans Condition), :236 (evalCondition). Aucune trace de temporalConditionMet dans scene.ts.

### docs/opera-scenario.md — sévérité haute
- **Quote** : Pour le **théâtre complet et multi-niveaux** (parterre + loges en surplomb, chutes), cf. le plan `~/.claude/plans/tout-m-interesse-harmonic-token.md` : - **Moteur multi-niveaux marchable** (Approche B) — migration repo-wide (`Scene.tiles` → `levels[]`, projection/picking/pathfinding 3D). `iso.ts` est déjà z-aware (`tileCenter`/`depth`/`screenToTileAtZ`).
- **Affirme** : Le moteur de scène multi-niveaux marchable (plusieurs étages avec pathfinding 3D) reste à construire — c'est un chantier lourd non commencé, et la scène Opéra jouable actuelle se limite à l'antichambre de la loge royale.
- **Réalité** : Le moteur multi-niveaux existe déjà : `Scene` a un tableau `layers: Layer[]` indexé par `z` (localisation ET clé de pathfinding/tri, `src/state/scene.ts:440-455`), `MapSpec.levels` (`src/state/mapSpec.ts:175`) compile des grilles ASCII par étage via `putLayer(s, z, tiles)` (`src/state/mapSpec.ts:308-317`), avec rampes/dénivelé (`surfaceLink`) déjà utilisées. Le scénario `src/scenes/test-scenarios/opera.ts` EST déjà ce théâtre multi-niveaux complet (scène+parterre+hall+rampes en z0, galerie+loges+loge royale en z1 — lignes 35-73, 148-160) — pas juste l'antichambre. `git log` montre que `mapSpec.ts` (levels) a été modifié le 2026-07-03 et `opera.ts` étendu en théâtre complet dans les commits `d7177831`/`b187ae4f`, POSTÉRIEURS au commit du doc (`1bcc0831`, 2026-06-28).
- **Preuve** : src/state/scene.ts:440-455 (Layer[]) ; src/state/mapSpec.ts:175,308-317 (levels/putLayer) ; src/scenes/test-scenarios/opera.ts:35-160 (Z0/Z1 complets) ; git log docs/opera-scenario.md vs src/state/mapSpec.ts
- **Vérif adversariale** : Lu docs/opera-scenario.md lignes 21-51 (section "Scène jouable" ne mentionne que l'antichambre, section "Reste à faire" réclame encore Scene.tiles→levels[]) ; src/state/scene.ts:446 définit `interface Layer` ; src/state/mapSpec.ts lignes 175/308-333 utilisent `spec.levels` + `putLayer` ; src/scenes/test-scenarios/opera.ts lignes 38-160 montrent Z0 (parterre/scène/coulisses) et Z1 (galerie/loges/loge royale) déjà codés. git log confirme doc figée à 1bcc0831 (28/06), mapSpec.ts/opera.ts modifiés après (01/07-03/07).

### docs/playtest-notes-2026-06-20.md:62 — sévérité haute
- **Quote** : 🐞 B4 — L'incantation ne se résout jamais (combat, sorcier)
- **Affirme** : L'incantation (Test opposé sorcier) ne produit aucune modale de jet et reste un bug ouvert.
- **Réalité** : Un `CastModal.tsx` existe désormais (`src/ui/CastModal.tsx`), avec un flux `cast`/`castOpposition` complet dans `rollFlowSpecs.ts` (`makeRollFlow<PendingCast>`). Le commit `e538de9e fix(playtest): compétences carrière (B3) + refus de cast visibles (B4) + parité magie/tir` (postérieur au 2026-06-20) corrige explicitement B3 ET B4 cités dans ce document.
- **Fix** : Marquer B3/B4 comme corrigés ou retirer la section (déjà traité en aval).
- **Vérif adversariale** : Vérifié : `git show -s --format=%ci e538de9e` → 2026-06-21 01:18:25 (postérieur au doc du 2026-06-20) ; `git log --oneline --all --grep` retrouve exactement le commit cité par son titre. `src/ui/CastModal.tsx` existe (créé initialement par 96736e72 « feat(combat): modale d'incantation » puis retouché) ; `rollFlowSpecs.ts` contient bien `makeRollFlow<PendingCast>` et `PendingCastOpposition`. Le constat d'audit est donc réel : docs/playtest-notes-2026-06-20.md §B4 est un bug déjà corrigé en aval, la doc est périmée.

### docs/qc-reconnaissabilite-sprites.md:21 — sévérité haute
- **Quote** : npx tsx scripts/_qc-creatures-rig.mts    # → public/qc/creatures-rig/c*.png + manifest.json
- **Affirme** : Étape 1 du pipeline QC : ce script rend TOUT le bestiaire riggué en PNG + manifest.json dans public/qc/creatures-rig/.
- **Réalité** : Le fichier scripts/_qc-creatures-rig.mts a été supprimé (commit 3c7fd62b, 'refactor(rig): supprime le name-matcher flou — rendu 100% data-driven') et n'existe plus dans le dépôt. Le remplaçant partiel est scripts/qc/render-creature.mts, mais il rend UNE créature à la fois via un argument CLI exact (pas de manifest.json ni de rendu batch c*.png). Le dossier public/qc/creatures-rig/ existe encore avec d'anciens c*.png, restes d'une exécution antérieure à la suppression.
- **Preuve** : git diff-tree --no-commit-id --name-status -r 3c7fd62b montre 'D scripts/_qc-creatures-rig.mts' ; scripts/qc/render-creature.mts l.1-8 documente un usage mono-créature (`npx tsx scripts/qc/render-creature.mts "<Nom du def>"`)
- **Vérif adversariale** : git show 3c7fd62b --stat liste 'D scripts/_qc-creatures-rig.mts' ; ls confirme le fichier absent du working tree ; lecture de scripts/qc/render-creature.mts l.1-8 confirme l'usage mono-créature ; ls public/qc/creatures-rig/ confirme la présence de c00-c04.png et manifest.json orphelins. La doc docs/qc-reconnaissabilite-sprites.md l.21 décrit donc un script inexistant comme étape 1 du pipeline — écart réel et actuel.

### docs/regles-optionnelles-catalogue.md:14 — sévérité haute
- **Quote** : ## Déjà implémentées (7)
- **Affirme** : Seules 7 règles optionnelles du catalogue sont implémentées à ce jour, le reste (~53) restant « à faire ».
- **Réalité** : `src/engine/policy.ts::OPTIONAL_RULES` contient ~50 entrées déjà implémentées (dont une trentaine listées par ce doc comme « à faire » : test-critiques-doubles, test-extended-min-sl, test-metier-int, test-intimidation-char, fortune-mid-session, combat-advantage-cap-bi, combat-defensive-stance, combat-critical-deflect, combat-aa-blessures, combat-aa-avantage-groupe, combat-ranged-melee-penalty, combat-helpless-mode, combat-weapon-reach, combat-init-method, combat-init-reroll, combat-se-fatiguer, combat-cadence, social-status-reaction-roll, social-begging-bonus, social-charm-intra-tier, creation-gnome-jouable, market-mode, market-tenir-comptes, market-guild, tavern-games, interlude-enabled, interlude-elf-duty, advancement-career-jump, advancement-mentor, magic-composant, prayer-conviction, prayer-petites, magic-sorcellerie, corruption-tables-edoc, psych-acquisition-optional, disease-mode, travel-etapes, travel-etapes-count-bonus, travel-allures, travel-attraper-froid, water-scarcity). Le doc décrit un état antérieur (2026-06-18) largement dépassé par l'implémentation réelle.
- **Preuve** : src/engine/policy.ts l.43-528 (liste des `id:` de OPTIONAL_RULES)
- **Vérif adversariale** : Lu docs/regles-optionnelles-catalogue.md l.1-40 (7 lignes sous « Déjà implémentées »). Grep `id:\s*'` sur src/engine/policy.ts : 50 occurrences (l.45 à l.519), incluant test-critiques-doubles, test-extended-min-sl, test-metier-int, test-intimidation-char, combat-defensive-stance, combat-critical-deflect, combat-aa-blessures, combat-aa-avantage-groupe, market-mode, travel-etapes, etc. — tous cités par le constat comme faussement classés « à faire ».

### docs/regles-optionnelles-playbook.md:26 — sévérité haute
- **Quote** : ## DIFFÉRÉ — lot 2b (gate d'un comportement DÉJÀ câblé ; zone défense-cascade // → merger en dernier)
- **Affirme** : combat-defensive-stance, combat-critical-deflect, combat-ranged-melee-penalty, combat-helpless-mode, combat-init-method/-frequency restent différés en attente du merge de la zone défense-cascade.
- **Réalité** : Ces ids sont déjà présents dans `src/engine/policy.ts` (combat-defensive-stance l.184, combat-critical-deflect l.193, combat-ranged-melee-penalty l.221) — le lot 2b a été mergé depuis la rédaction du doc.
- **Preuve** : src/engine/policy.ts lignes 184, 193, 221, 230, 259.
- **Vérif adversariale** : Grep sur src/engine/policy.ts confirme les 5 id: aux lignes 184 (combat-defensive-stance), 193 (combat-critical-deflect), 221 (combat-ranged-melee-penalty), 230 (combat-helpless-mode), 259 (combat-init-method) — correspond exactement à l'evidence citée dans le constat.

### docs/regles-optionnelles-playbook.md:36 — sévérité haute
- **Quote** : ## DIFFÉRÉ — HEAVY / sous-système absent (nouvelle plomberie ; faire le socle d'abord)
- **Affirme** : Composant d'incantation (magic-composant), Longueur d'arme (combat-weapon-reach), Voyage par Étapes (travel-etapes*), Social (social-status-reaction-roll) nécessitent un socle absent, non implémentés.
- **Réalité** : `magic-composant`, `combat-weapon-reach`, `travel-etapes`, `travel-etapes-count-bonus`, `social-status-reaction-roll` sont déjà des ids enregistrés dans `src/engine/policy.ts` — le socle a été construit et les règles implémentées depuis.
- **Preuve** : src/engine/policy.ts lignes 250 (combat-weapon-reach), 297 (social-status-reaction-roll), 415 (magic-composant), 480/489 (travel-etapes / travel-etapes-count-bonus).
- **Vérif adversariale** : Lu docs/regles-optionnelles-playbook.md lignes 36-46 (section DIFFÉRÉ HEAVY listant ces 4 règles comme non implémentées) puis grep -rn des ids dans src/ hors policy.ts : combat.ts:302-306, combatManeuvers.ts:267-271, combatSlice.ts:445, pendings.ts:696, combatEffects.ts:314, combatFlow.ts:2694-2703, partyFlow.ts:435, CharacterSheet.tsx:297, travelStages.ts:99-102, travelFlow.ts:253-446, WorldMapView.tsx:605 — code réel et substantiel, pas de simple id vide.

### docs/sorts-implementation.md:9 — sévérité haute
- **Quote** : **Synthèse** : 221 sorts — ✅ 77 mécaniques · 🟡 19 partiels · 📜 125 narratifs (arbitrage MJ) · 87 specs curées.
- **Affirme** : L'état courant du backlog de curation des sorts est 221 sorts, avec cette répartition ✅/🟡/📜 et 87 specs curées.
- **Réalité** : Re-générer le fichier avec la commande citée en tête de doc (`npx tsx scripts/gen-sorts-doc.mts`, qui lit directement `src/data/spells.json`) produit '416 sorts — ✅ 77 · 🟡 127 · 📜 212 · curés 278' sur l'état actuel du dépôt — près du double de sorts et une répartition/curation totalement différente. Le fichier commité n'a manifestement pas été régénéré depuis longtemps malgré son propre bandeau 'ne pas éditer à la main'.
- **Preuve** : sortie de `npx tsx scripts/gen-sorts-doc.mts` sur le HEAD actuel : 'docs/sorts-implementation.md : 416 sorts — ✅ 77 · 🟡 127 · 📜 212 · curés 278' (fichier restauré ensuite via `git checkout -- docs/sorts-implementation.md`)
- **Vérif adversariale** : Lu docs/sorts-implementation.md (lignes 1-10, contient bien la citation exacte) puis exécuté `npx tsx scripts/gen-sorts-doc.mts` sur HEAD : sortie = "docs/sorts-implementation.md : 416 sorts — ✅ 77 · 🟡 127 · 📜 212 · curés 278", confirmant l'écart matériel signalé par l'audit (fichier régénéré/écrasé par le script pendant la vérif, non recommité).

### docs/sorts-implementation.md:7 — sévérité haute
- **Quote** : « curé » = spec relue de la source (`data/spellspecs/`), sinon repli regex iso-POC. Implémenter un sort = le curer dans son fichier de famille.
- **Affirme** : Les specs curées de sorts vivent dans des fichiers par famille sous `data/spellspecs/`, et « implémenter un sort » consiste à éditer ce fichier de famille.
- **Réalité** : Le générateur lui-même (scripts/gen-sorts-doc.mts l.6-8) documente une migration : 'Migration #5 : les métadonnées de résolution … vivent désormais dans SpellData (spells.json) — plus de src/data/spellspecs/. La colonne « Curé » lit s.curated directement depuis la donnée JSON.' Aucun dossier `spellspecs/` n'existe plus dans le repo (seul src/engine/spellspec.ts, un fichier unique de repli regex) ; la curation est un simple booléen `curated` sur chaque entrée de src/data/spells.json.
- **Preuve** : scripts/gen-sorts-doc.mts l.6-8 et l.26 ; `find src -iname "*spellspec*"` → seulement src/engine/spellspec.ts / spellspec.test.ts ; `grep curated src/data/spells.json` → champ booléen par sort
- **Vérif adversariale** : Lu docs/sorts-implementation.md l.1-9 (texte périmé toujours présent en ligne 7) ; scripts/gen-sorts-doc.mts l.1-28 (commentaire de migration #5 + texte de sortie actuel différent) ; Glob confirme qu'aucun dossier data/spellspecs/ n'existe (seul src/engine/spellspec.ts) ; grep src/data/spells.json confirme le champ `curated` booléen par sort.

### docs/systeme-passifs.md:110 — sévérité haute
- **Quote** : `src/data/mutations.ts` : `rollMutation(table, rng)` (table → plage → réf → entité), `mutationByLabel`, `LABELS_PHYSIQUES`/`LABELS_MENTALES`.
- **Affirme** : mutations.ts exporte des helpers basés sur le label : `mutationByLabel`, `LABELS_PHYSIQUES`, `LABELS_MENTALES`.
- **Réalité** : Ces trois symboles n'existent nulle part dans src/ (grep vide). mutations.ts exporte en réalité `rollMutation`, `mutationById` (pas `mutationByLabel`), `IDS_PHYSIQUES`/`IDS_MENTALES` (pas `LABELS_*`) — la migration id-based (commit 867c42dc « optionals[] 100% id-based ») a renommé ces symboles après la rédaction du doc.
- **Preuve** : src/data/mutations.ts l.37-38 (`IDS_PHYSIQUES`, `IDS_MENTALES`) et l.61 (`mutationById`) ; grep 'mutationByLabel|LABELS_PHYSIQUES|LABELS_MENTALES' sur src/ ne retourne aucun fichier
- **Vérif adversariale** : Lu src/data/mutations.ts l.37-38 (export const IDS_PHYSIQUES/IDS_MENTALES) et l.61 (export function mutationById). Grep 'mutationByLabel|LABELS_PHYSIQUES|LABELS_MENTALES' sur src/ : aucun résultat. Grep des vrais noms confirme leur usage dans 10 fichiers (index.ts, spawn.ts, tests, rig).

### docs/systeme-passifs.md:105 — sévérité haute
- **Quote** : Une **Table de Corruption** = des plages d100 qui RÉFÉRENCENT des mutations par label. `src/data/mutationTables.json` = `[{label:'physique', ranges:[{min,max,mutation}]}, …]`.
- **Affirme** : Le référencement mutation↔table se fait par `label`, et la clé d'entrée d'une table est `label`.
- **Réalité** : Le code référence désormais par `id` (mutations.json et mutationTables.json portent un champ `id` distinct de `label`, et `rollMutation`/`TABLE_BY_ID`/`BY_ID` indexent par `id`). Le commentaire même du code dit explicitement « Les plages référencent les mutations par **id** (plus de label) ».
- **Preuve** : src/data/mutations.ts l.24 (« id STABLE... ») et l.40-41 (commentaire « par id (plus de label) ») ; src/data/mutationTables.json l.2-4 (champ `id` distinct du `label`)
- **Vérif adversariale** : Lu src/data/mutations.ts l.1-57 (BY_ID/TABLE_BY_ID indexés sur .id, rollMutation utilise range.mutation comme id, commentaire l.41 « par id (plus de label) ») et src/data/mutationTables.json l.1-20 (chaque entrée a id + label distincts, ranges[].mutation = id comme 'pattes-d-animaux').

### docs/test-scenarios.md:46 — sévérité haute
- **Quote** : ## Catalogue actuel (par section)
- **Affirme** : Le tableau qui suit liste l'ensemble des scénarios de test disponibles, section par section (Combat, Magie, Créatures, Survie, Marché, Scénarios complets, Naval, Rendu).
- **Réalité** : Le tableau (14 lignes) omet au moins 7 scénarios existants dans src/scenes/test-scenarios/ avec order/category renseignés : `siege-explore.ts` (order 13, rendu, « Siège — exploration (sans combat) »), `siege-enceinte.ts` (order 41, combat, « Siège — défendre la muraille »), `pont-vitrine.ts` (order 50, rendu, « Pont — vitrine »), `13-bataille-de-masse.ts` (order 40, scenarios, « Bataille de masse »), `14-voyage-maritime.ts` (order 12, naval, « Voyage maritime »), `15-commerce-fluvial.ts` (order 2, marche, « Commerce fluvial (le Reik) »), `16-embuscade-fluviale.ts` (order 16, naval, « Embuscade fluviale »), `17-metamorphose-ulric.ts` (order 17, creatures, « Métamorphose — Enfant d'Ulric »).
- **Preuve** : src/scenes/test-scenarios/siege-enceinte.ts:269-272, pont-vitrine.ts:111-114, 13-bataille-de-masse.ts:82-85, 14-voyage-maritime.ts:117-120, 15-commerce-fluvial.ts:165-168, 16-embuscade-fluviale.ts:57-60, 17-metamorphose-ulric.ts:52-55 (aucun n'apparaît dans le tableau de docs/test-scenarios.md:51-65)
- **Vérif adversariale** : Lu docs/test-scenarios.md:46-68 (tableau complet) et grep order:/category:/title: dans les 8 fichiers cités — chacun a bien ces champs renseignés (ex. siege-enceinte.ts:269-272 order 41/category 'combat'/title 'Siège — défendre la muraille'), confirmant qu'ils sont des scénarios enregistrés mais absents du tableau doc.

### docs/unification-stations.md — sévérité haute
- **Quote** : > Statut : **conception** (pré-exécution). Fait suite au chantier minimap/`TopoScene` (P1-P4 livrés : > `Station` + `TopoScene` + `PosteSheet` unifié navire+siège). Ce doc cadre l'unification PLUS PROFONDE > demandée : partager la colonne vertébrale entre postes, activités et événements de combat de masse.
- **Affirme** : Le chantier d'unification (E1 TestSpec partagé, E3 affectation explicite, S1 StationSheet générique, S2 kind battleScene) est encore à l'état de conception, rien n'est exécuté.
- **Réalité** : Les quatre phases citées comme futures sont déjà livrées dans le code : `TestSpec` existe et est utilisé (`src/engine/skills.ts:168`, `ActivityDef extends TestSpec` en `src/engine/activities.ts:188`) ; l'affectation explicite existe (`MassBattleState.assignment: Record<string,string[]>` + `assignedHeroesFor()` dans `src/state/massBattleFlow.ts:164,436`, `bestForSkills` déjà relégué en simple repli `??`) ; `StationSheet` générique existe et est utilisé À LA FOIS par le naval/siège (`src/ui/ShipSheet.tsx:11,194`) et par la bataille de masse (`src/ui/MassBattleView.tsx:6,108`) ; `Scene.stations` + `battleScenesToStations` existent et sont testés (`src/state/stations.ts:13,82`, `src/state/stations.test.ts`). Le doc décrit donc un plan déjà exécuté comme s'il restait à faire.
- **Preuve** : src/state/stations.ts:13-115 (StationKind, battleScenesToStations) ; src/ui/StationSheet.tsx:57 ; src/engine/skills.ts:168 (TestSpec) ; src/engine/activities.ts:188 (ActivityDef extends TestSpec) ; src/state/massBattleFlow.ts:164,436,510
- **Vérif adversariale** : Lu via grep direct : src/engine/skills.ts:168 (TestSpec), src/engine/activities.ts:188 (ActivityDef extends TestSpec), src/state/massBattleFlow.ts (assignment:164, assignedHeroesFor utilisé lignes 392/459/485/510, bestForSkills en repli via ??), src/ui/StationSheet.tsx existe et est importé dans ShipSheet.tsx:11/194 et MassBattleView.tsx:6/108, src/state/stations.ts (battleScenesToStations, scene.stations) + stations.test.ts présent.

### docs/audit-data-driven.md:24 — sévérité moyenne
- **Quote** : champs `curated`/`durationRounds`/`zdeRadiusMeters`/`zdeExcludesCaster`/`teleportMeters`/`teleportPerSL`/`pushMeters`/`breathAttack`/`chainOnKill`/`opposed` dans `SpellData`
- **Affirme** : SpellData porte littéralement les champs `durationRounds`, `zdeRadiusMeters`, `zdeExcludesCaster`, `teleportMeters`, `teleportPerSL`, `pushMeters`, `breathAttack`, `chainOnKill` en plus de `curated`/`opposed`.
- **Réalité** : Ces 8 noms de champs n'existent plus du tout dans src/data/index.ts (0 occurrence) : la portée/aire a été consolidée dans un type structuré unique `target: SpellRange | ...` et la durée dans `duration: SpellDuration`, tandis que push/téléportation/chaîne ont été déplacés vers des ops (`push`/`teleport`/`chain`) dans `effects`. Seuls `curated` et `opposed` subsistent tels quels.
- **Preuve** : src/data/index.ts:989-1020 : commentaires "L'aire (ex-`zdeRadiusMeters`) vit désormais ICI", "L'échelle Rounds (ex-`durationRounds`) vit désormais ICI", "POUSSÉE / TÉLÉPORTATION / ATTAQUES EN CHAÎNE : effets POSITIONNELS désormais portés par des ops IMPURES (`push`/`teleport`/`chain`...) dans `effects`"
- **Vérif adversariale** : Grep de durationRounds|zdeRadiusMeters|zdeExcludesCaster|teleportMeters|teleportPerSL|pushMeters|breathAttack|chainOnKill dans src/data/index.ts : seules 3 occurrences, toutes en commentaire (« L'aire (ex-zdeRadiusMeters) vit désormais ICI », « L'échelle Rounds (ex-durationRounds) vit désormais ICI ») sauf breathAttack qui est un vrai champ (ligne 1016).

### docs/audit-poc-modules.md — sévérité moyenne
- **Quote** : ## Interlude / Activités (`16-interlude`)
- **Affirme** : Le scénario de test dédié à l'audit de l'Interlude/Activités s'appelle 16-interlude, et de même 16-voyage / 10-marchand / 14-magie-jalon2 / 17-mutations pour les autres modules audités.
- **Réalité** : Ces ids de scénario n'existent plus sous ces noms dans src/scenes/test-scenarios/ : la numérotation a été réattribuée (13-bataille-de-masse, 14-voyage-maritime, 15-commerce-fluvial, 16-embuscade-fluviale, 17-metamorphose-ulric) et les scénarios voyage/magie vivent maintenant sous voyage.ts / magie.ts / magie-hors-combat.ts sans le préfixe numérique cité par l'audit. Un agent qui cherche à rejouer ces scénarios pour re-vérifier l'audit ne les retrouvera pas sous ces ids.
- **Preuve** : ls src/scenes/test-scenarios (2026-07-05) : aucun fichier 16-interlude*, 16-voyage*, 10-marchand*, 14-magie-jalon2*, 17-mutations* ; présents à la place : 13-bataille-de-masse.ts, 14-voyage-maritime.ts, 15-commerce-fluvial.ts, 16-embuscade-fluviale.ts, 17-metamorphose-ulric.ts, voyage.ts, magie.ts, magie-hors-combat.ts
- **Vérif adversariale** : ls src/scenes/test-scenarios (2026-07-05) confirme l'absence de tout fichier 16-interlude*, 16-voyage*, 10-marchand*, 14-magie-jalon2*, 17-mutations*, et la présence des noms actuels listés dans le constat.

### docs/bestiaire-a-completer.md:41 — sévérité moyenne
- **Quote** : Vérifié (diagnostic sur `resolveByName`) : il ne reste **aucune** créature rendue en bipède Humain par défaut **à tort**.
- **Affirme** : Le diagnostic/résolution d'espèce pour le bestiaire repose sur une fonction `resolveByName`.
- **Réalité** : `resolveByName` n'existe plus dans le code (0 occurrence, Grep sur tout `src/`). La résolution passe désormais par `resolveById`/`resolveRender`/`resolveSpecies` (`src/gameIso/rig/bodyPlan.ts`) ; un commentaire de `creature-render-golden.test.ts:23` dit explicitement « résolution data-driven par ID de record … plus de name-match » — le name-matcher a été supprimé (cf. mémoire `game-namematch-deleted.md`).
- **Fix** : Remplacer les 2 mentions de `resolveByName` par `resolveById`/`resolveRender` (ligne 36-37 et 41).
- **Vérif adversariale** : Grep -rn "resolveByName" sur src/ : aucun résultat (exit 2, no match). Grep sur bodyPlan.ts confirme les fonctions actuelles : resolveById (l.83), resolveSpecies (l.90), resolveRender (l.105), avec le commentaire « délègue au résolveur unique » (l.78).

### docs/combat-naval-modele.md — sévérité moyenne
- **Quote** : scénario 🧪 dédié à côté de `25-bataille-navale`
- **Affirme** : Le scénario de test dédié au combat naval existe sous l'id/nom `25-bataille-navale`.
- **Réalité** : Aucun fichier `25-bataille-navale*` n'existe sous src/scenes/test-scenarios/. Le scénario naval réel s'appelle combat-naval.ts et déclare id: 'combat-naval' (le titre de scène interne est 'test-bataille-navale', mais l'id de scénario 🧪 est 'combat-naval').
- **Preuve** : src/scenes/test-scenarios/combat-naval.ts:47,78 ; Glob src/scenes/test-scenarios/25* → aucun résultat
- **Vérif adversariale** : Glob `src/scenes/test-scenarios/25*` → aucun résultat. Lecture de `combat-naval.ts` lignes 40-83 : scene `id: 'test-bataille-navale'` (l.47), `export const scenario: TestScenario = { id: 'combat-naval', order: 11, ... }` (l.78-80).

### docs/i18n-seam.md:77 — sévérité moyenne
- **Quote** : Test statique `no-new-hardcoded-labels` : interdit les **littéraux de texte utilisateur NEUFS** dans `engine/` + `state/` hors catalogue (**baseline** = l'existant, on n'en AJOUTE pas) + règle ESLint ciblée.
- **Affirme** : Le garde-fou anti-régression s'appelle `no-new-hardcoded-labels`, tolère une dette existante en baseline (« l'existant ») et s'accompagne d'une règle ESLint ciblée.
- **Réalité** : Le garde-fou implémenté est `src/state/i18n-narration-guard.test.ts` (test Vitest, pas un nom `no-new-hardcoded-labels`), avec une **baseline ZÉRO** explicite (« Aucune allowlist ») sur les fichiers listés dans `MIGRATED`, pas une tolérance de dette existante généralisée ; aucune règle ESLint correspondante n'existe dans `eslint.config.js`.
- **Preuve** : src/state/i18n-narration-guard.test.ts commentaire « Baseline : ZÉRO. Aucune allowlist » ; grep sur `eslint.config.js` ne montre aucune règle liée au i18n/narration.
- **Vérif adversariale** : Lu docs/i18n-seam.md l.75-79 (texte du constat) et src/state/i18n-narration-guard.test.ts l.1-40 (commentaire « Baseline : ZÉRO. Aucune allowlist », liste MIGRATED de 9 fichiers précis, pas de garde nommé no-new-hardcoded-labels). Grep insensible à la casse de « i18n|narration|hardcoded » sur eslint.config.js : aucune occurrence.

### docs/playtest-notes-2026-06-20.md:95 — sévérité moyenne
- **Quote** : Tuile cliquable des entités trop étroite … Reco : **hitbox de tuile entière / snap au token le plus proche** du curseur.
- **Affirme** : Le ciblage nécessite de tomber pile sur la tuile/le sprite, sans hitbox élargie ni halo de survol.
- **Réalité** : Commit `ab079f15 feat(combat): cibler au SPRITE (pas à la case) + halo sur la cible survolée (#2 playtest)` implémente exactement cette recommandation, référencée dans le message de commit comme fix du point #2 du playtest.
- **Fix** : Retirer/mettre à jour la friction et la recommandation associée (déjà livrées).
- **Vérif adversariale** : Lu git show ab079f15 (diff complet : BodyToken.tsx +highlight prop/filter halo, IsoStage.tsx +pickTile avec elementFromPoint/closest('[data-cid]'), utilisé dans onPointerDown/onPointerMove à la place de tileFromEvent) et docs/playtest-notes-2026-06-20.md lignes 95-97 (le point '🔸 Tuile cliquable des entités trop étroite'). git log confirme commit du 21/06 postérieur à la note (20/06) et antérieur au dernier edit du doc (29/06).

### docs/qc-reconnaissabilite-sprites.md:79 — sévérité moyenne
- **Quote** : rollout des sous-espèces (skaven clanrat/stormvermin, hommes-bêtes gor/ungor) ; migrer les ~12 races encore en `monster`
- **Affirme** : Le rollout des sous-espèces hommes-bêtes (gor/ungor) reste À FAIRE (SP2/SP3).
- **Réalité** : Gor.ts, Ungor.ts et Chamane-Brey.ts existent déjà comme defs de créatures riggées distinctes sous src/gameIso/rig/creatures/defs/, ajoutés le 2026-07-04 — après la date du doc (2026-06-08). Seule la partie skaven clanrat/stormvermin (toujours un seul Skaven.ts générique) reste réellement à faire.
- **Preuve** : src/gameIso/rig/creatures/defs/Gor.ts et Ungor.ts (git log --date=short → 2026-07-04) vs docs/qc-reconnaissabilite-sprites.md (git log → 2026-06-08)
- **Vérif adversariale** : git log -1 --date=short sur src/gameIso/rig/creatures/defs/Gor.ts et Ungor.ts → 2026-07-04 ; sur docs/qc-reconnaissabilite-sprites.md → 2026-06-08. ls du dossier confirme Gor.ts, Ungor.ts, Chamane-Brey.ts, Skaven.ts, Esclave-skaven.ts présents.

### docs/audit-donnees-2026-06-23.md — sévérité basse
- **Quote** : **gods « 3 sans label »** (mon alerte initiale) : **faux** — `gods.json` utilise `key`, pas `label` ; les 3 gnomes (Evawn/Mabyn/Ringil) sont corrects (Mabyn a juste un `U+FFFD`).
- **Affirme** : gods.json utilise un champ `key` (et non `label`) pour identifier chaque divinité.
- **Réalité** : Chaque entrée de src/data/gods.json a bien un champ `label` (ex. "label": "Asuryan", "label": "Atharti", "label": "Evawn"...) en plus de `id`. Il n'y a pas de champ `key`. Le fond de la remarque (faux positif sur les 3 gnomes) reste probablement correct, mais le nom de champ cité est faux — un agent qui chercherait `gods.json` par `key` ne trouverait rien.
- **Preuve** : src/data/gods.json:1-16 — champs présents: id, label, title, blessings, miracles, desc, source (pas de 'key')
- **Vérif adversariale** : Lu src/data/gods.json lignes 1-30 : chaque entrée a `id`, `label` (ex. "Asuryan", "Atharti"), `title`, `blessings`, `miracles`, `desc`, `source`. Aucun champ `key` n'existe dans le fichier.

### docs/playtest-jinashi-consolidation.md — sévérité basse
- **Quote** : `+`/`×` discret pour ajouter/retirer un set (cap ~3) → **`createLoadout`/`removeLoadout` deviennent réels**.
- **Affirme** : La fonction de suppression d'un set de loadout s'appellera `removeLoadout`.
- **Réalité** : La fonction implémentée (et l'action du store) s'appelle `deleteLoadout`, pas `removeLoadout` (`src/state/store.ts:1405`, `src/ui/EquipmentPanel.tsx:128,269`). Écart mineur de nommage entre la décision actée et l'implémentation livrée ; le reste de la décision (weapon sets auto-étiquetés via `loadoutLabel`, suppression de `setWeaponSetSlot`/`renameLoadout`, `setLoadoutSlot` par-id) est, lui, bien implémenté et conforme au doc.
- **Preuve** : src/state/store.ts:1404-1407 ; src/ui/EquipmentPanel.tsx:127-128,269
- **Vérif adversariale** : Grep de 'Loadout' dans src/state/store.ts et src/ui/EquipmentPanel.tsx : aucune occurrence de 'removeLoadout', seulement 'deleteLoadout' (createLoadout/deleteLoadout/setActiveLoadout/setLoadoutSlot tous présents et cohérents entre store et UI).


## DOC-DISPOSITION — sort global proposé par doc (12)

### docs/audit-systemes.md — sévérité haute
- **Quote** : N/A (disposition globale)
- **Affirme** : Le doc sert de checklist de dette actionnable.
- **Réalité** : Plusieurs entrées précises de la synthèse de dette (§D.3/D.4/D.5) décrivent un état du code déjà corrigé (NATURAL_WEAPON, Money, weaponSets, decompteUntil, fallbackSpec/spellspecs, castInfo as any) et des noms de fichiers renommés (rollFlow.ts/rollFlows.ts). Suivi tel quel, un agent perdrait du temps à re-corriger du code déjà propre ou chercherait des fichiers absents.
- **Fix** : corriger (rafraîchir §D.3-D.5 et la ligne rollFlow/rollFlows contre l'état actuel du code, ou apposer un bandeau ARCHIVE si le doc n'a plus vocation à être maintenu comme checklist vivante)
- **Vérif adversariale** : Grep direct dans le repo : src/engine/creatureEquip.ts (pas de NATURAL_WEAPON, pas de src/state/creatureEquip.ts) ; src/engine/money.ts:9 (Money unique) + src/state/pendings.ts:22-25 (import+re-export, pas de duplication) ; grep 'weaponSets'/'decompteUntil' sur src/engine/types.ts = 0 match ; grep 'fallbackSpec' sur src/engine/spellspec.ts = 0 match ; src/state/combatFlow.ts:640 'castInfo(spell)' sans 'as any' ; ls src/state/ montre rollFlowFactory.ts/rollFlowSpecs.ts, aucun rollFlow.ts/rollFlows.ts.

### docs/playtest-notes-2026-06-20.md — sévérité haute
- **Quote** : N/A (document entier)
- **Affirme** : Le document se présente comme le constat de l'état du jeu et la liste de recommandations à traiter.
- **Réalité** : Daté du 2026-06-20 (filename + en-tête), plusieurs bugs (B3, B4) et frictions prioritaires (#1/#2 hitbox, #5 raccourcis) qu'il liste comme non résolus sont explicitement corrigés par des commits postérieurs (dont un `fix(playtest): … (B3) … (B4) …`) — le doc ne décrit plus l'état courant du jeu et risque de faire re-traiter par un agent des points déjà livrés.
- **Fix** : Ajouter un bandeau ARCHIVE en tête (constat daté du 2026-06-20, plusieurs points déjà corrigés depuis — voir historique git) plutôt que le laisser lisible comme backlog actif.
- **Vérif adversariale** : Lu docs/playtest-notes-2026-06-20.md (B3 §54-61/§266, B4 §62-70/§282, reco #2/#3 §144-147) ; git log --grep=playtest a remonté e538de9e dont le message cite explicitement (B3) et (B4) comme corrigés, avec diff touchant creator/draft.ts (skillAdvances keying) et combatFlow/targeting.ts (castRefused, spellAffinity) — cohérent avec la description des bugs du doc.

### docs/regles-optionnelles-catalogue.md — sévérité haute
- **Quote** : N/A
- **Affirme** : N/A
- **Réalité** : N/A
- **Preuve** : voir les doc-stale ci-dessus
- **Fix** : bandeau ARCHIVE en tête (constat daté du 2026-06-18, ne décrit plus l'état courant — plus des 4/5 des règles listées « à faire » sont déjà implémentées dans policy.ts, et plusieurs items de la « Carte de nettoyage » sont déjà réglés). Si le doc doit rester actif comme suivi de chantier, il a besoin d'une repasse complète pour re-scanner OPTIONAL_RULES avant d'être réutilisé comme plan de travail.
- **Vérif adversariale** : Lu docs/regles-optionnelles-catalogue.md en entier (158 lignes) ; grep des ids `id: '...'` dans src/engine/policy.ts (51 entrées) comparés un par un aux libellés de la section « À faire » ; lu src/engine/policy.ts:13 (RuleKind) et src/engine/testPolicy.ts:33-38 pour vérifier l'état des items #1 et #2 de la « Carte de nettoyage ».

### docs/regles-optionnelles-playbook.md — sévérité haute
- **Quote** : N/A (disposition globale)
- **Affirme** : Le doc prétend guider un travail encore à faire (« pour dérouler les lots restants sans ré-investiguer »).
- **Réalité** : L'écrasante majorité des ids listés (DO, 2b et même plusieurs HEAVY) sont déjà implémentés dans `src/engine/policy.ts` depuis la rédaction (2026-06-18) : le playbook est entièrement consommé, plus aucun agent ne doit s'y fier pour savoir quoi faire — `docs/regles-optionnelles-catalogue.md` est la source de vérité vivante à jour.
- **Fix** : supprimer (redondant/faux) — ou bandeau ARCHIVE en tête si l'historique du raisonnement est jugé utile ; en l'état il induira un agent à ré-implémenter ou re-scoper des règles déjà livrées.
- **Vérif adversariale** : Lu docs/regles-optionnelles-playbook.md en entier (sections DO l.10-24, 2b l.26-34, HEAVY l.36-47) ; grep des 16 ids DO+2b dans src/engine/policy.ts → toutes trouvées (lignes 55-470) ; git log confirme policy.ts modifié après la rédaction du playbook (commit 9449c529 postérieur). Aucun bandeau ARCHIVE dans le fichier.

### docs/sorts-implementation.md — sévérité haute
- **Quote** : > GÉNÉRÉ par `npx tsx scripts/gen-sorts-doc.mts` — ne pas éditer à la main.
- **Affirme** : Le doc est un artefact auto-généré, à jour.
- **Réalité** : Le générateur existe et fonctionne encore mais le fichier commité n'a pas été régénéré depuis une migration majeure (spellspecs/ → curated sur spells.json) et un doublement du nombre de sorts — un simple re-run corrige tout.
- **Vérif adversariale** : Lu docs/sorts-implementation.md (tel que commité, 221 sorts, mention data/spellspecs/) ; vérifié `ls src/data/spellspecs` → absent, confirmé par git log (commit 1bd9422a « suppression de spellspecs/ ») ; src/data/spells.json compte 416 entrées (Array.length) ; exécuté `npx tsx scripts/gen-sorts-doc.mts` qui régénère avec 416 sorts / 278 curés et un texte différent, puis `git checkout --` pour annuler la modif non voulue.

### docs/unification-stations.md — sévérité haute
- **Quote** : > Statut : **conception** (pré-exécution).
- **Affirme** : —
- **Réalité** : —
- **Fix** : Corriger : le doc décrit un chantier déjà livré en quasi-totalité (E1/E3/S1/S2 tous présents et testés dans le code actuel). Soit basculer en bandeau ARCHIVE/RÉTROSPECTIVE datée constatant que le plan a été exécuté (comme le fait déjà §7bis/§7ter pour E2/C1), soit réécrire le statut et les tableaux de phase en 'livré' pour ne pas laisser un agent re-planifier ou dupliquer un travail déjà fait.
- **Vérif adversariale** : Lu docs/unification-stations.md en entier : ligne 3 dit "conception (pré-exécution)" mais ligne 160 dit "Chantier livré = E1 + E3 + S1 + S2". Vérifié dans le code : TestSpec existe et ActivityDef l'étend (src/engine/skills.ts:168, activities.ts:188) — E1 fait ; assignedHeroesFor(...)[0] ?? bestForSkills(...) dans massBattleFlow.ts:510 montre l'affectation explicite avec bestForSkills en simple suggestion — E3 fait ; StationSheet générique existe (src/ui/StationSheet.tsx, utilisé par ShipSheet ET MassBattleView) — S1 fait ; MassBattleView.tsx importe battleScenesToStations et gère station.ref.kind==='battleScene' (lignes 8, 85, 174) — S2 fait. Les 4 phases citées comme le plan sont donc bien exécutées dans le code actuel, contrairement au bandeau de statut du haut du doc.

### docs/audit-data-driven.md — sévérité moyenne
- **Quote** : N/A
- **Affirme** : N/A
- **Réalité** : N/A
- **Preuve** : cumul des 5 findings ci-dessus
- **Fix** : bandeau ARCHIVE en tête (constat d'audit daté de juin 2026, dont plusieurs lignes de la table #2/#5/#8/#9 et le bilan de synthèse ont été dépassées par des migrations ultérieures non reflétées ici — le lecteur doit vérifier l'état réel dans le code plutôt que se fier à cette table)
- **Vérif adversariale** : Lu docs/audit-data-driven.md (table #8/#9 = ⏸️ DIFFÉRÉ) et src/engine/encumbrance.ts (« ENCUMBRANCE_TIERS = encumbranceTiersJson », commentaire « plus d'Infinity ») + src/engine/corruption.ts l.121-129 (« le seuil par espèce vit en DONNÉE (SpeciesData.mutationBodyMax) ... plus de match sur le nom »). Les deux confirment une migration postérieure à l'état documenté dans la table.

### docs/combat-events-coherence.md — sévérité moyenne
- **Quote** : N/A (disposition globale)
- **Affirme** : Section 6 « Recensement Lot 0 » sert de checklist de migration restante, gelée comme baseline.
- **Réalité** : Le doc s'auto-qualifie déjà de « note de session, aucune correction faite ici » — disposition correcte pour les sections 1-3bis (toujours une bonne description de l'architecture cible et du dispatcher `fireTriggers`, vérifiés présents dans le code : `emitCombatEvent`, `fireTriggers`, `resolveFreeAttacks`). Mais la §6 « Lot 0 » est désormais une checklist obsolète : la majorité des sites Lot 4bis et plusieurs sites Lot 6 sont déjà migrés, contrairement à ce qu'elle affirme.
- **Fix** : corriger (mettre à jour §6 pour retirer/cocher les sites déjà migrés — sinon un agent qui reprend le chantier re-planifie ou re-fait un travail déjà terminé, ou pire réintroduit un chemin par-nom déjà supprimé)
- **Vérif adversariale** : Lu docs/combat-events-coherence.md §6 (baseline gelée, sites listés par nom) puis src/state/combat-hardcode-guard.test.ts (TARGETS Lot 4/4bis/6, tous baseline:0 avec commentaires « PURGÉ de toute réaction par-nom »/« RÉSORBÉ »). Vérifié aussi par grep dans src/state/combatFlow.ts et src/state/combat/roundHooks.ts que applySonneMeleeAdvantage, hasRiposte, hasChampionDefense, infecte/rongeur, banishedAtZero, nerveux, unstable, bestial-fire-fear, perturbing-aura, determination-* ont disparu (déplacés vers engine/traits/dispatch.ts et engine/combatFeatures/dispatch.ts, ou convertis en donnée), confirmant les commits dédiés (8b6d30b9, 281efd14, a13c982b, 010d7bfc, 792431f5, etc.).

### docs/opera-scenario.md — sévérité moyenne
- **Quote** : ## Reste à faire (chantiers lourds — à coordonner)
- **Affirme** : N/A
- **Réalité** : Doc de référence technique conçu pour être suivi par des agents (tableau des primitifs, patron de composition, section « reste à faire ») mais désormais désynchronisé : le moteur multi-niveaux qu'il annonce comme futur est déjà livré, et la description de la « scène jouable » (antichambre seule) ne correspond plus au scénario actuel (théâtre complet). Un agent qui le suit répliquerait un moteur déjà existant ou sous-estimerait l'état du scénario Opéra.
- **Fix** : corriger : mettre à jour « Scène jouable » (décrire le théâtre complet z0/z1 livré) et « Reste à faire » (retirer/reformuler le point moteur multi-niveaux déjà fait ; ne garder que ce qui reste réellement : autonomie PNJ, foule, mise en scène) ; corriger la ligne `Trigger.temporalCondition` du tableau des primitifs pour refléter `Trigger.when: Condition` + `evalCondition`.
- **Vérif adversariale** : Lu docs/opera-scenario.md (sections « Scène jouable » l.21-28 et « Reste à faire » l.43-51), src/scenes/test-scenarios/opera.ts (MapSpec avec levels:{z0,z1}, relief pour rampes, théâtre complet avec loges/galerie/loge royale/parterre), src/state/mapSpec.ts (l.175 `levels?: Record<string,string>`, l.308-332 traitement), src/gameIso/iso.ts (tileCenter/depth/screenToTileAtZ déjà z-aware).

### docs/qc-reconnaissabilite-sprites.md — sévérité moyenne
- **Quote** : Méthode **headless** (pas besoin de naviguer le jeu) : on rend chaque créature en PNG via le rig, des **agents aveugles** devinent ce que c'est, on corrige la Race, on re-vérifie.
- **Affirme** : Runbook vivant et exécutable tel quel pour tout futur audit QC de sprites.
- **Réalité** : La méthode/conventions (races/defs, gabarits/defs, golden test, features scale:'bone'/'fixed') restent exactes et vérifiées dans le code actuel, mais la commande d'entrée du pipeline (étape 1) est morte et la section « à faire » cite un item déjà livré — corriger ces deux points suffit à revivifier le doc plutôt que l'archiver.
- **Vérif adversariale** : Lu docs/qc-reconnaissabilite-sprites.md (pipeline étape 1 = `npx tsx scripts/_qc-creatures-rig.mts`) ; `ls scripts/*.mts` ne contient pas ce fichier. Grep `head:` sur src/gameIso/rig/races/defs/*.ts (13 races) + inspection des 7 autres (Elfe-sylvain, Gnome, Guerrier-du-chaos, Halfling, Haut-Elfe, Nain, Vampire) et 0 match pour `monster:`. Mémoire `game-rig-datadriven-sweep.md` : « monstrous → 100% defs/ : FAIT ».

### docs/test-scenarios.md — sévérité moyenne
- **Quote** : ## Catalogue actuel (par section)
- **Affirme** : n/a
- **Réalité** : n/a
- **Fix** : corriger (compléter le tableau du §Catalogue actuel avec les 7 scénarios manquants) — le reste du doc (workflow, conventions, ajout d'un scénario) reste exact et à jour.
- **Vérif adversariale** : Lu docs/test-scenarios.md (tableau §Catalogue actuel, lignes 51-65, 13 lignes de données) et src/scenes/test-scenarios/_registry.generated.ts (20 imports e0..e19). Comparaison directe des deux listes : 7 fichiers présents dans le registre et absents du tableau, correspondant exactement au chiffre du constat.

### docs/audit-poc-modules.md — sévérité basse
- **Quote** : # Audit « POC → produit » des modules récents (Phase 0 — 2026-06-11)
- **Affirme** : Le document se présente sans marqueur d'archivage, alors que c'est un constat daté (audit Playwright ponctuel du 2026-06-11) dont les références de scénarios de test ont déjà dérivé.
- **Réalité** : Toutes les lignes sont cochées [x] (corrigé Lot 1-5) : c'est un journal de recette historique, pas un guide vivant — mais les ids de scénario qu'il cite ne pointent plus vers rien de jouable aujourd'hui.
- **Fix** : bandeau ARCHIVE en tête (constat daté du 2026-06-11, scénarios de test renommés depuis — garder comme historique des corrections Lot 1-5, ne pas s'y fier pour retrouver un scénario de recette actuel)
- **Vérif adversariale** : Lu docs/audit-poc-modules.md en entier (toutes lignes [x], Lots 1-5) et listé src/scenes/test-scenarios/ : aucun fichier ne correspond aux ids cités (16-interlude, 16-voyage, 10-marchand, 14-magie-jalon2, 17-mutations) — les numéros ont été réattribués à d'autres scénarios.


## CLAUDEMD-FALSE — claims du CLAUDE.md faux/périmés (1)

### CLAUDE.md:32 — sévérité haute
- **Quote** : Les plans de refonte / sorties de brainstorming sont des artefacts **DATÉS** : ils vont dans `docs/plans/`, portent leur date en tête, et sont **supprimés une fois exécutés** (git porte l'historique).
- **Affirme** : Les plans datés vivent sous `docs/plans/` et sont supprimés une fois exécutés.
- **Réalité** : `docs/plans/` n'existe pas dans le repo ; les plans réels vivent sous `docs/superpowers/plans/` (Glob : ~50 fichiers `docs/superpowers/plans/2026-06-*.md`). Aucun n'est supprimé : les plus anciens datent du 2026-06-04, plus d'un mois avant la date courante (2026-07-05), et correspondent à des features déjà livrées d'après MEMORY.md (rig/gabarits, marchand v1, psychologie P1-P3, loadouts, etc.) — ni le chemin ni la politique de suppression décrits ne correspondent à la réalité observée.
- **Preuve** : Glob(docs/plans/*) -> No files found ; Glob(docs/superpowers/plans/*) -> 50+ fichiers datés 2026-06-04 à 2026-06-15 toujours présents sur le disque
- **Fix** : Remplacer `docs/plans/` par `docs/superpowers/plans/` et retirer ou corriger la clause « supprimés une fois exécutés », visiblement pas appliquée en pratique.
- **Vérif adversariale** : Bash: grep "docs/plans" CLAUDE.md -> ligne 33 confirmée ; ls docs/plans -> No such file or directory ; ls docs/superpowers/plans -> 55 fichiers, du 2026-06-04 (animations-combat, apparences-creatures, editeur-tilesets-batiments, rig-apparence-composable, destin-resilience-sacrifies) au 2026-06-15, aucun supprimé.

