# Audit de fidélité — Psychologie / États / Détermination / structure de tour (LDB FR)

Statut 2026-06-08. Audit multi-agents (8 agents, code↔LDB FR « Livre de base version corrigée »,
chaque manque contre-vérifié adversarialement). Source **FR uniquement** (`Source/Warhammer v4 -
Livre de base version corrigée/`). On corrige **l'ensemble** des manus confirmés, dans l'ordre des lots.

## Manques confirmés (verbatim sourcé)

### 🔴 Haute priorité
- **Détermination : immunité psy temporaire** — « Demeurer immunisé à Psychologie jusqu'à la fin du
  prochain Round » (LDB 17 l.62). Absent (l'action ne fait que retirer un État).
- **Détermination : ignorer les modificateurs de Blessure critique** jusqu'au début du prochain Round
  (LDB 17 l.64). Absent.
- **Source de Peur qui s'approche → Test de Calme Intermédiaire ou Brisé** (LDB 21 l.29). Absent
  (on a l'inverse : le héros apeuré ne peut pas s'approcher).
- **Brisé — restriction d'action** : Mouvement + Action forcés pour fuir **à couvert hors de vue**,
  puis Action = se cacher (LDB 16 l.55). Absent (seul le −10 est codé).
- **Brisé — récupération** : Test de Calme en fin de Round si **pas Engagé** (l.57) ; **−1 Brisé auto
  après 1 Round complet caché hors de vue** (l.59). Absent.
- **Surprise — établissement en début de combat** : Test opposé Discrétion/Perception, ou auto si
  l'ennemi n'est pas méfiant (LDB 13). L'État `Surpris` (+20, pas de défense) existe mais **n'est jamais
  posé**.
- **Flanc/dos +20** : « Attaquer un adversaire Engagé dans le dos ou sur les côtés » +20 (LDB 14 l.91).
  Le `facing` Dir8 est suivi (rendu) mais **pas consommé** en combat.

### 🟠 Moyenne
- **Surpris** : restriction Mouvement+Action (l.130-132) + **retrait après la 1ʳᵉ attaque** subie (l.136).
  Partiel (seuls +20 / pas-de-défense / dissipation fin de Round codés).
- **À Terre** : pénalité **−20 aux Tests de déplacement** (LDB 16 l.37). Absent.
- **Sonné** : l'attaquant gagne **+1 Avantage** (LDB 16 l.123). Absent.
- **Inconscient** : l'attaquant a « Je ne faillirai pas ! » gratuit **ou critique auto** ; tir = succès
  auto (LDB 16 l.112). Absent.
- **Empoisonné** : **Test de Résistance en fin de Round** pour retirer (l.70) + **+1 Exténué** après le
  dernier retiré (l.72). Absent.
- **Empêtré** : **−10** aux Tests de déplacement (l.85) + **Test opposé de Force** pour se libérer (l.61).
  Absent (seul Mouvement→0 codé).
- **Perte d'Avantage à l'ajout de TOUT État** (LDB 16 l.15) — aujourd'hui seulement sur perte de PB.
  *(À re-vérifier RAW : « tout État » vs « toute perte de PB ».)*
- **Trauma** : cauchemars (Test de Calme +40 nocturne → Exténué) + flashbacks contextuels (LDB 21
  l.89-92). Partiel (pénalités combat seulement).
- **Chance regagnée en début de session** (LDB 17 l.47) — pas de notion de session.
  → **DÉCISION UTILISATEUR : exposer dans l'ÉDITEUR** (Effet de scène, pas un hook caché).

### 🟢 Basse
- **En flammes** : Test d'**Athlétisme** pour retirer (1/DR, LDB 16 l.77). Absent.
- **Hémorragique** : **+1 Exténué** après le dernier retiré (l.109). Absent.
- **Stupidité** : confirmé **absent du chap. 21** → trait de créature (ailleurs), hors lot Psychologie.

### ✅ Déjà conformes (faux positifs écartés)
Aveuglé ; Hostilité (correctement *pas* un trait — conséquence) ; Brisé issu de Terreur (Indice+|DR−|) ;
Détermination « retirer un État +1 PB » ; « Je ne faillirai pas ! » ; Frénésie immunise vs psy ;
« bonus hors-LdV » = en fait **malus (Couvert) + blocage** (correct, pas de bonus).

## Lots (ordre d'exécution)

1. **Détermination + base immunité** : prédicat **`isPsychImmune(c)`** centralisé (Immunité trait /
   Frénésie / immunité temp / futurs Talents) consommé partout (collectHeroPsych, encounterPsych,
   resolvePsychAI) ; usages Détermination « immunisé psy jusqu'à fin du prochain Round » + « ignorer
   modifs de critique » (champs temp + expiration au passage de Round + entrées de modale).
2. **Brisé complet + approche** : restriction d'action (fuir à couvert / se cacher) + récupération
   (Calme fin de Round si pas Engagé / 1 Round caché) + **source de Peur qui s'approche → Test de Calme**.
3. **Surprise & orientation** : poser `Surpris` en début de combat (Test opposé Discrétion/Perception
   ou auto) + retrait après 1ʳᵉ attaque + **flanc/dos +20** (consommer le facing Dir8).
4. **Finitions d'États** : À Terre −20 dépl ; Sonné +1 Av ; Inconscient auto-crit/auto-tir ; Empoisonné
   (Résistance fin de Round + Exténué) ; Empêtré (−10 + Force opposée) ; perte d'Avantage à l'ajout
   d'État ; En flammes (Athlétisme) ; Hémorragique (+1 Exténué).
5. **Méta / éditeur** : Effet `restoreFortune` (Chance→Destin) **exposé dans l'éditeur** ; Trauma
   cauchemars (hook fin de jour) — selon temps.

Chaque correctif est **sourcé au LDB FR** (citation chap.+lignes) et **couvert par un test** avant commit.

## État (2026-06-08) — LOTS 1-5 LIVRÉS

- **Lot 1-3** : Détermination/immunité psy, Brisé+approche, Surprise/orientation (flanc-dos) — livrés.
- **Lot 4 (Finitions d'États)** : À Terre −20 dépl ; Sonné +1 Av ; **Inconscient** « Je ne faillirai pas ! »
  auto-réussite+critique / tir auto à bout portant (`0d9ebdd`) ; Empoisonné (Résistance fin de Round
  + Exténué) ; **Hémorragique** coagulation→Exténué (`892848e`) ; perte d'Avantage à l'ajout d'État ;
  **Empêtré « se libérer »** (Test opposé de Force vs source `sourceId`) + **En flammes « se rouler »**
  (Athlétisme) — Action + modale `pendingStateRecovery` + ActionBar + IA instantanée (`b24b578`).
- **Lot 5 (Méta/éditeur)** : Effet **`restoreFortune`** (Chance regagnée, max = Destin) exposé éditeur
  (`8e5129e`) ; **Trauma cauchemars** — `nightmareCheck` (Calme Facile +40 nocturne → Exténué),
  hook `nightsCrossed` dans `advanceTime`, flag héros `nightmares`, Effet éditeur `inflictNightmares`
  (l'auteur assigne le trauma — jamais inventé). Helper pur partagé `recoveredStacks` (Empêtré/En
  flammes/Hémorragie). Suite verte, typecheck propre.
