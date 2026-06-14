# P1 — Conséquences de magie dans la séquence — Design

*2026-06-15. Tranche P1 de l'épopée « conséquences d'un jet dans la modale » (P0 + P0.5 livrés).*

## Acquis (P0 + P0.5)

- **P0** : moteur de séquence généralisé (`src/state/cascade.ts`) — étapes mixtes **jet / choix /
  affichage** inférées des champs (`target`/`options`/ni l'un ni l'autre), `cascadeChoose`,
  résolution d'office, bilan. Pur + testé, zéro combat.
- **P0.5** : rendu des étapes **choix** (`OptionChooser`) et **affichage** dans `CascadeModal`
  (lignes note-only `RollPanel`, contenu d'affichage pré-posé dans `outcome` préservé par
  `commitStep`). Vérifié au navigateur sur une séquence mixte synthétique.

P1 est le **premier consommateur combat réel** : il prouve la boucle de bout en bout sur la magie,
le flux combat le plus self-contained.

## État actuel (carte de la magie)

`castConfirm` → `applyCast`/`applyMiscast` (combatFlow.ts). Conséquences :

- **Imparfaite / Colère des dieux** : `applyMiscast` roule la table (`miscast.ts` → GameOps),
  **applique les ops** (mutation d'état + Corruption), puis `pushReveal({ kind:'miscast', dice,
  lines, severity })` → **RevealModal séparée** (gèle l'IA, auto-close).
- **Effets du sort** : `applyOps` appliqués, **muets** (journalisés à `finishPlayerAction`).
- La modale de Cast affiche **une** ligne d'issue (« Sort lancé ! » / « Imparfaite »).

## P1 — but

Montrer les conséquences d'un lancer (imparfaite/colère + effets) **inline, multiligne, dans la
séquence**, à la place de la `RevealModal` qui pop. Aucune nouvelle règle, aucune nouvelle mutation :
**les effets restent appliqués par le moteur** comme aujourd'hui ; **seule la PRÉSENTATION** passe de
la RevealModal à la séquence inline. Conséquences de magie = **étapes d'affichage** (le rendu P0.5
les gère déjà) — pas de choix côté magie (les choix dévier/piège-lame sont des concerns d'attaque,
P3).

## Approche

À `castConfirm`, après que le moteur a appliqué le sort/l'imparfaite (inchangé), **construire une
séquence d'étapes d'affichage** et l'ouvrir au lieu de pousser la RevealModal de cast :

1. **Builder pur** `buildCastConsequences(...) : CascadeStep[]` (nouveau fichier, ex.
   `src/state/castConsequences.ts`) — à partir du résultat de cast / miscast déjà calculé, produit
   les étapes d'affichage : 1 étape « imparfaite/colère » (icône 💥/⚡, `outcome` = les lignes de la
   table), + optionnellement 1 étape « effets » listant les effets appliqués (rend visibles les
   effets aujourd'hui muets). **Testable en isolation** (entrée = données de conséquence, sortie =
   `CascadeStep[]`), zéro dépendance combatFlow.
2. **Câblage** `castConfirm` : si `steps.length`, fermer `pendingCast` et `startCascade({ title,
   icon, purpose:'combat', steps })` — réutilise `CascadeModal` (rendu affichage P0.5). Sinon (cast
   propre sans conséquence notable), comportement actuel (ligne d'issue unique).
3. **Applier** : les étapes d'affichage de magie portent un applier **muet** (les mutations ont
   déjà eu lieu côté moteur) — `commitStep` préserve leur `outcome` pré-posé (P0.5). « Continuer »
   acquitte et enchaîne ; à la dernière étape, ferme la séquence.

## Décisions (tranchées — modifiables à la relecture)

- **Coexistence avec `RevealModal`** : on RE-ROUTE **uniquement** les conséquences de **cast**
  (imparfaite/colère). La `RevealModal` reste pour le reste (fin de Round, mutations de Corruption,
  bénédiction marchand, etc.). Migration incrémentale, faible risque.
- **`purpose:'combat'`** : nouvelle valeur de `PendingCascade['purpose']` ; sa finalisation =
  simple fermeture (pas de reprise de voyage). `cascadeFinish`/`cascadeNext` : aucune action
  spéciale pour `'combat'`.
- **Affichage-only en P1** : les mutations restent dans le moteur (pas de « un applier par effet »
  encore). Déplacer l'application DANS les appliers d'étape est un raffinement ultérieur (cohérence
  « un jet = une modale »), hors P1.
- **Effets du sort en étape d'affichage** : inclus (rend visibles les effets muets) — mais si la
  liste est vide/triviale, on n'ajoute pas l'étape (pas de bruit).

## Périmètre / Non-goals

- **P1 = magie uniquement.** Attaque (critique/Assommante/dévier/piège-lame) = P2/P3 ; défense
  réactive = P4. `Terreur→Peur` et autres modales = après les 3 principales.
- Pas de changement de règle ni de RNG : `miscast.ts`, `magic.ts`, l'application des ops restent
  identiques. P1 ne touche QUE la présentation (`castConfirm` + nouveau builder + `purpose`).

## Tests

- `castConsequences.test.ts` : builder pur — imparfaite → 1 étape d'affichage avec les bonnes lignes
  en `outcome` ; colère → idem ; effets non vides → étape effets ; cast propre → `[]`.
- Régression magie : `magic*.test.ts`, `roll-modal-invariant.test.ts` verts (le câblage ne change
  pas les mutations). Recette navigateur : lancer un sort qui rate (imparfaite) → la conséquence
  s'affiche **inline** dans la séquence (plus de RevealModal de cast).

## Risque & séquencement

- **Touche `combatFlow.castConfirm`** (cœur combat). **Bloqueur courant** : la session parallèle a du
  WIP non committé RED dans le cœur effets (`scheduledEffects`/`delayedEffect` — `combatEffects.ts`,
  `EffectList.tsx`). **Implémenter le câblage `castConfirm` quand l'arbre est VERT** pour ne pas
  bâtir sur / entrer en conflit avec leur refactor en cours. Le **builder pur** (étape 1) +
  ses tests sont additifs (nouveau fichier) et peuvent se faire avant — sans toucher combatFlow.
