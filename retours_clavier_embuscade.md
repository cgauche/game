# Retour de playtest — « L'Embuscade » au clavier seul

**Date :** 2026-06-29
**Scénario :** `embuscade` — 🩸 L'Embuscade (exploration → trigger → dialogue → combat 5 mutants, ch.2)
**Groupe :** Sigmund Reikhardt (Soldat), Grunni Pierre-de-Fer (Tueur nain), Frère Anselm (Prêtre), Klein Bürger (Voleur halfling, fragile, 0 Destin)
**Méthode :** jeu au **vrai clavier** (`browser_press_key`), `window.__wfrp` utilisé **uniquement** pour observer (lecture) et le setup autorisé (lancement scénario, `goto`, `fight`). Navigateur : http://localhost:5176/.
**Couverture :** 2 rounds complets joués, ~tous les flux de combat traversés (déplacement, Course, charge/attaque, défense, attaque gratuite, psychologie, Critique, capacités, soin). 2 mutants tués, 2 héros mis à terre.

**Légende :** ✅ marche au clavier · ❌ impossible au clavier (= trou clavier) · ⚠️ marche mais avec réserve / anomalie.

---

## 1. Lancement

- `window.__wfrp` présent au chargement, scénario lancé via `__wfrp.scenario('embuscade')` (setup). **Je n'ai pas testé la navigation du menu d'accueil au clavier** (entrée par helper).
- À l'entrée de scène, une **modale de révélation** « 📍 Du Sang sur la Route » s'affiche (bouton *Continuer*).
  - ✅ **Entrée** la valide et la ferme proprement (`pendingReveals` vidé), à condition que le focus soit sur `document.body` (voir §4, problème de focus).

## 2. Exploration

- ❌ **Les flèches ne déplacent PAS le groupe.** Groupe figé à (2,7) après de multiples `ArrowRight` **et** `d` (WASD). Aucune caméra/curseur ne bouge non plus. **L'exploration est 100 % souris** (clic sur la case de destination).
- Pour franchir, j'ai dû utiliser `__wfrp.goto({x:9,y:7})` (setup autorisé) pour entrer dans le rectangle de trigger (`approche`, x∈[8,10] y∈[6,7]) qui lance le dialogue.
- **Trou clavier #1 : pas de déplacement d'exploration au clavier.**

## 3. Dialogue

Le trigger ouvre le dialogue `dlg-ambush` (« La forêt se referme… ») avec 2 choix : *Fondre sur les charognards* / *Reculer sans bruit*.

- ❌ **Les choix de dialogue ne sont pas pilotables au clavier.**
  - `1` (numéro) → rien (reste au nœud `a1`).
  - `ArrowDown` puis `Entrée` → rien sur le dialogue.
  - `Tab` ne va PAS sur les choix : il saute sur le **bouton ☰** (menu MJ) en haut à gauche — premier élément focusable de la page.
  - `Entrée` (sur ☰ ainsi focusé) → **ouvre le menu MJ** (Sauvegarder/Charger, Règles maison, Options, Quitter).
- ❌ **`Échap` ne ferme PAS le menu MJ** (testé focus sur body ET sur ☰). Le **seul** moyen clavier de le refermer : `Tab` (focus ☰) puis `Entrée` (re-toggle). Peu découvrable.
- Pour progresser, dialogue contourné via `__wfrp.fight('enc-mutants')` (setup).
  - ⚠️ **Fuite d'état** : lancer `fight()` pendant qu'un dialogue est ouvert **laisse la boîte de dialogue affichée derrière le combat** (la boîte ne se ferme pas). En relançant proprement (révélation fermée → `fight()` sans ouvrir le dialogue), pas de fuite.
- **Trous clavier #2 (dialogue souris-only) et #3 (menu ☰ infermable au clavier).**

## 4. Combat — le cœur du test

### 4.0 Démarrage de round + problème de focus (important)

- Modale `pendingRoundStart` « ⚔️ Commencer le combat ».
  - ✅ **Espace** l'acquitte… **mais seulement si le focus est sur `document.body`.**
  - ❌ Quand le focus restait **collé sur le bouton ☰** (après ma mésaventure de menu), **Espace ET Entrée ne faisaient rien** sur la pause de round. Il a fallu `blur()` l'élément actif pour que les raccourcis reprennent.
- ⚠️ **Constat UX transverse :** les raccourcis de combat (Espace/Entrée/flèches) exigent que le focus soit sur le body. Le jeu **ne restaure pas** le focus du body après une interaction bouton/modale → des touches « ne répondent pas » sans raison visible pour le joueur. C'est le piège n°1 d'une partie au clavier.

### 4.1 Round 1 — Klein (déplacement & Course)

- ✅ **1ʳᵉ flèche = le curseur de combat apparaît sur le héros actif** (Klein, 1,10), comme annoncé.
- ✅ **`ArrowRight` = grille +x** (vers les ennemis à l'est) — mapping écran→grille **intuitif** dans cette orientation.
- Curseur poussé 4 cases à l'est, **`Entrée`** sur une case hors de portée de marche → ✅ ouvre la modale **« Course »** (Test d'Athlétisme +20).
  - ⚠️ La modale **auto-focuse le bouton *Annuler*** (anneau jaune dessus). **Mais `Entrée` déclenche quand même *Lancer*** (le primaire) — il existe bien un handler global « Entrée = bouton primaire » qui prime sur le focus. Bon réflexe, mais le focus visuel sur *Annuler* est trompeur.
  - ✅ `Entrée` (Lancer) → jet (25 vs 55, réussi, +8 cases). `Entrée` (Appliquer) → Klein avance de 6 cases (Course consomme l'**Action**, `acted=true`).
- ✅ **Espace** finit le tour.

**IA :** Mikael/Erik/Terenz prennent leur Course vers le groupe ; le chef **Knud (arc) tire sur Sigmund et rate**. Puis **Terenz attaque Klein** → modale **Défense**.

- Défense de Klein (Esquive 38 / Parade 20, *Esquive* présélectionnée) :
  - ❌ **Le bascule Parade/Esquive n'est PAS clavier** : `1` et `ArrowLeft` ne changent pas le mode (reste `esquive`). Souris-only.
  - ✅ `Entrée` = Lancer (raté 64 vs 38), `Entrée` = Appliquer → Klein touché à la **Tête**, −7 PB.
  - ✅ **Attaque gratuite « Piétinement »** de Terenz → 2ᵉ défense enchaînée, gérée pareil (`Entrée`/`Entrée`). Klein 9 → 1 PB.

- ⚠️ **ANOMALIE — tour de héros sauté :** juste après cette cascade de défenses, **le tour de Frère Anselm (slot 5 de l'ordre, un HÉROS) a été passé sans s'arrêter pour la saisie joueur.** L'IA a enchaîné Johann (slot 6) et s'est arrêtée sur Grunni (slot 7). Les autres transitions de héros se sont, elles, bien arrêtées (Grunni, Sigmund, et Anselm **au round 2**), donc ça ressemble à un vrai **skip ponctuel** lié à la résolution de la cascade de défense. À investiguer.

### 4.2 Round 1 — Grunni (charge + attaque, ciblage)

- ✅ Flèche → curseur sur Grunni. **`Tab` → aimante l'ennemi valide le plus proche** (Erik, 2,10), `snappedId` posé.
- ✅ **`Entrée` = modèle unifié approche-puis-frappe** : Grunni **charge** (bandeau « charge Erik (+1 Avantage) »), s'auto-déplace au contact (1,8→2,9), et la modale **Attaque** s'ouvre (84 à toucher : +10 Avantage, +20 Surnombre).
- ✅ `Entrée` (Lancer) → touche (Bras droit, 18 dégâts) ; `Entrée` (Appliquer) → **Erik à 0 PB → « inconscient »** (bon modèle de mort WFRP4 : 0 PB ≠ mort).
- ✅ **Espace** finit le tour → s'arrête correctement sur **Sigmund** (héros suivant).

### 4.3 Round 1 — Sigmund (cyclage de cibles Tab/²)

- ✅ Flèche → curseur. **`Tab` cycle vers l'avant** : Johann → Terenz.
- ✅ **`²` (Backquote) cycle vers l'arrière** : Terenz → Johann. Le double sens marche parfaitement.
- ✅ `Entrée` → charge Johann (+1 Avantage), auto-contact, modale Attaque → Lancer/Appliquer → **Johann hors de combat** (8 dégâts).
- ✅ **Espace** → fin du round 1.

### 4.4 Round 2 — psychologie (Peur)

- La transition de round ouvre une cascade « **Fin de Round** » qui est en fait un **test de Psychologie** : Klein doit faire **« Calme 44 » contre Peur 1** (le chef Knud cause la Peur).
  - ✅ `Entrée` = Lancer (24 vs 44, réussi, DR 2), `Entrée` = confirmer. Flux psycho **clavier OK**.

### 4.5 Round 2 — Klein (capacité au numéro)

- ✅ **`1` = Défensive** : activée (le bouton passe à « 🛡️ Défensive ✓ », `acted=true`, journal « +20 en défense »). **L'activation de capacité au numéro fonctionne.**
- ✅ **Espace** finit le tour.
- **IA :** Mikael attaque Klein (1 PB). Esquive (montée à 58 grâce à Défensive) ratée (71). Klein touché 12 → **mis à terre**, et déclenche une **cascade de Coup Critique**.

### 4.6 Round 2 — LE BLOCAGE : Coup Critique « dévier ? »

Modale **« Coup Critique — dévier ? »** (Table des Critiques 52 = *Côtes fracturées*, 3 Blessures + Sonné + Fracture Mineure). Boutons : *🛡️ Dévier (−1 PA)*, *Subir*, *Terminer* (tous `enabled`, défaut = `devier`).

- ❌❌ **BLOCAGE DUR CLAVIER.** Le bouton *Terminer* (et le choix Dévier/Subir) **ne répond à RIEN** de jouable :
  - `Entrée` (×2) → rien (cascade reste `cursor:1`).
  - `Espace` → rien.
  - `element.click()` programmatique sur *Terminer* **et** sur *Dévier* → rien.
  - `__wfrp.roll()` (pilote `cascadeRoll`, renvoie « ✅ cascadeRoll() ») → **aucun effet**.
  - **Seul un VRAI clic souris Playwright sur *Terminer* débloque** → « Klein dévie le Critique sur son armure (−1 PA, Critique ignoré) ».
- **0 erreur console** pendant le blocage. Le bouton réagit donc à un *pointer event* réel mais pas au clavier, pas au `.click()` JS, pas au pilote de recette.
- **Conséquence : un joueur 100 % clavier est COINCÉ dès qu'un héros encaisse un Critique** (et c'est fréquent : 0 PB → cascade). **C'est le défaut le plus grave du test.**

### 4.7 Round 2 — Anselm (Incanter / prière) puis Grunni (Soigner)

Au round 2, Anselm **s'est bien arrêté** pour la saisie (≠ round 1).

- ✅ **`1` = Incanter** → ouvre le **sélecteur de prières** (Bénédiction de Guérison · Contact · 1 cible ; Bénédiction de Bataille). Le **soin existe** (via Incanter, pas de bouton « Soigner » sur la barre d'Anselm).
- ❌ **La sélection de prière n'est pas clavier** : `Entrée` sur le sélecteur **ANNULE** le mode incantation (`action→null`) au lieu de choisir une prière. Pas de touche pour sélectionner une prière → **Anselm n'a pas pu lancer son soin au clavier** (son tour s'est terminé sans cast).
- Sur le tour de **Grunni**, la barre montre **« 1 🩹 Soigner »** (action de premiers secours générique, présente car des alliés à terre sont proches).
  - ✅ `1` = entre en **mode « heal »**.
  - ❌ **Le ciblage du soin n'est pas clavier** : le curseur arrive bien sur la case du Sigmund à terre (3,9) mais **ne s'y aimante pas** (`snappedId` absent), **`Tab` n'aimante aucun allié**, et **`Entrée` sur la case ne fait rien** (aucun `pendingHeal`). Souris-only.

### 4.8 Fin de session

- ⚠️ Un **rechargement HMR** (autre session éditant des fichiers, comme prévenu dans CLAUDE.md) a renvoyé la page au **menu d'accueil** en plein test (console réinitialisée de 47 → 2 messages). C'est arrivé pendant le test du soin, **après** que tous les constats clavier aient été établis. **0 erreur** sur toute la session.

---

## 5. Synthèse — Ce qui va / Ce qui ne va pas / Suggestions

### ✅ Ce qui va (au clavier)
- **Curseur de combat** aux flèches ; 1ʳᵉ flèche pose le curseur sur l'actif ; mapping écran→grille intuitif.
- **Ciblage Tab (avant) / ² (arrière)** : impeccable, double sens.
- **Modèle d'attaque unifié** : `Entrée` sur une cible = approche/charge auto + modale d'attaque.
- **Handler global « Entrée = bouton primaire »** (Lancer puis Appliquer) — marche même quand le focus est sur *Annuler*.
- **Espace** = fin de tour / acquittement de pause de round.
- **Numéros 1-N** = activation des capacités de la barre (Défensive ✓, entrée des modes Incanter/Soigner).
- Flux **Course**, **Défense** (×2, + attaque gratuite Piétinement), **Psychologie (Peur)** entièrement pilotables au clavier.
- **Échap** annule le curseur.
- **0 erreur console** de bout en bout.

### ❌ Ce qui ne va pas (trous clavier)
1. ❌❌ **BLOCAGE : modale Coup Critique « dévier »** — aucun chemin clavier (ni `.click()` JS, ni pilote) ; **uniquement souris réelle**. Game-stopping.
2. ❌ **Exploration** : déplacement du groupe impossible au clavier (souris-only).
3. ❌ **Choix de dialogue** : non navigables au clavier (souris-only). `Tab` mène au menu ☰, `Entrée` l'ouvre.
4. ❌ **Menu ☰** : `Échap` ne le ferme pas ; refermable seulement en re-togglant ☰.
5. ❌ **Bascules de sous-choix dans les modales** souris-only : **Parade/Esquive**, **Dévier/Subir** (et vraisemblablement Localisation/Retenir ses coups/Garantie).
6. ❌ **Sélection de sort/prière** (sélecteur d'Incanter) : `Entrée` annule au lieu de choisir.
7. ❌ **Ciblage du Soin** : le curseur/`Tab` ne s'aimantent pas sur les alliés à terre ; `Entrée` sur leur case ne fait rien.

### ⚠️ Réserves / anomalies
- ⚠️ **Gestion du focus** : les raccourcis combat échouent silencieusement quand le focus est garé sur un bouton (ex. après avoir touché le menu) ; le jeu ne rend pas le focus au body.
- ⚠️ **Tour de héros sauté** : Anselm (round 1) passé sans saisie après une cascade de défense.
- ⚠️ **Fuite visuelle** : lancer un combat par-dessus un dialogue ouvert laisse la boîte de dialogue derrière l'arène.

### 💡 Suggestions
- Rendre **TOUS les boutons de cascade** (`Terminer`, Dévier/Subir, etc.) sensibles à `Entrée`/`Espace`, avec le choix par défaut routé — **priorité absolue** (le blocage Critique casse toute partie clavier).
- **Navigation clavier des choix de dialogue** (↑↓ + Entrée, ou touches numériques).
- **Pickers de sort/prière et ciblage de soin** : le curseur devrait **s'aimanter sur les alliés** en mode soin/cast ; `Tab` devrait **cycler les cibles valides** (alliés à terre inclus) ; `Entrée` sélectionne.
- **Déplacement d'exploration au clavier** (flèches), ou au moins l'assumer/documenter.
- **Toggles segmentés** (Parade/Esquive, Dévier/Subir) commutables aux **flèches gauche/droite** ou aux numéros.
- **Restaurer le focus** sur le canvas/body après toute interaction bouton/modale, pour que les raccourcis ne « meurent » pas.
- **`Échap` doit fermer le menu ☰**.

---

## 6. Verdict

**Le combat n'est PAS jouable de bout en bout au clavier seul.**

La **boucle nominale** (poser le curseur, cibler en Tab/², charger/attaquer, lancer & appliquer les jets, gérer défense et psychologie, activer une capacité au numéro, finir le tour à l'Espace) **est solide et agréable au clavier** — c'est un vrai bon socle. Mais elle bute sur des **murs souris-only**, dont un **blocage dur** : la modale **« Coup Critique — dévier »** arrête net la partie au clavier, et ça survient dès qu'un héros tombe (donc très tôt et souvent). S'y ajoutent l'impossibilité de **soigner/incanter** au clavier (sélection de prière + ciblage de soin), les **sous-choix de modale** (Parade/Esquive…), le **dialogue** et l'**exploration**, et un **piège de focus** qui fait « rien ne répond » sans cause visible.

En l'état : **clavier OK pour attaquer et enchaîner les tours du chemin heureux ; impossible de survivre à un combat complet sans la souris.**

---

*Erreurs console : **0** (niveau error) sur toute la session. Captures : `embuscade-01…13-*.png` à la racine du dépôt.*
