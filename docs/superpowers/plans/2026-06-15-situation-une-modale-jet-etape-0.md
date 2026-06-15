# « Une situation = une modale » — le jet de combat devient l'étape 0 de la séquence

> **Pour exécutants :** plan TDD, incréments testés + vérif navigateur. Cases `- [ ]`.

**Goal :** une passe d'armes (attaque/défense/magie) se déroule dans UNE seule fenêtre continue —
le jet en tête, ses conséquences (Critique, Maladresse, Assommante, Abattre, Destin, Déviation,
Piège-à-lame, Colère/Imparfaite) empilées dessous — au lieu de `RollModal`→ferme→`CascadeModal`.

**Architecture :** réutiliser l'EXISTANT, ne rien créer de parallèle.
- La coquille unique `RollFlowShell` et le moteur de séquence `cascade.ts` (déjà utilisés par la
  nuit/repos) rendent TOUT.
- La situation de combat est un `pendingCascade` (purpose `'combat'`). **L'étape 0 = le jet.**
  `CascadeModal` reste montée du jet jusqu'à « Terminer » → une seule `RollFlowShell` (pas de
  démontage/remontage = pas de 2ᵉ fenêtre).
- Le jet conserve son UI riche : on EXTRAIT le paramétrage de `RollModal`/`DefenseModal`/`CastModal`
  en *builders de props* que `CascadeModal` appelle pour l'étape-jet ; les conséquences gardent le
  rendu d'étape générique existant. Aucune mécanique de `RollFlowShell` réécrite.
- Les **données** du jet restent dans `pendingAttack`/`pendingDefense`/`pendingCast` (les actions
  `attack*`/`defense*`/`cast*` INCHANGÉES) ; le `pendingCascade` coexiste pour MONTER la coquille et
  séquencer. Le confirm du jet enchaîne le curseur au lieu de fermer.
- **Attaque gratuite de créature = nouvelle attaque = NOUVELLE séquence** (fenêtre suivante, comme
  aujourd'hui les `DefenseModal` successives) — PAS une étape de la même séquence.
- **Atouts d'arme** (Assommante, Piège-à-lame…) et **traits** déclenchés par CE coup = étapes de
  conséquence de la MÊME séquence (déjà routés vers `pendingCascade` aujourd'hui).

**Tech :** Vite + TS + React, Zustand, Vitest, `window.__wfrp` + Playwright pour la recette.

---

## État actuel (vérifié) — le « seam » à supprimer

- Joueur frappe un ennemi → `pendingAttack` → `RollModal`. `attackConfirm` : `applyAttackResult`
  **APPEND** les conséquences à un `pendingCascade` (via `pushReveal`/`pushCombatStep`, purpose
  `'combat'`, titre « Conséquences »), PUIS `set({pendingAttack:null})` → `CascadeModal` prend la
  main = **2ᵉ fenêtre**.
- Ennemi frappe un héros → `pendingDefense` → `DefenseModal` (jet ennemi figé) → même seam au confirm.
- `applyMiscast` (Colère/Imparfaite d'un héros) : `startCascade(purpose:'combat')` directement.
- Reste DEHORS de la séquence (encore des modales séparées) : `pendingFumble` (`FumbleModal`),
  `pendingKnockdown` (`KnockdownModal`), `pendingFateSave` (`FateSaveModal`).

## Cible — un seul `pendingCascade` du jet à la fin

```
pendingCascade { purpose:'combat', title:'Attaque', cursor:0, participants:[
  cursor 0 → { kind:'attackJet' }      ← CascadeModal rend les props d'attaque (depuis pendingAttack)
  cursor 1 → { kind:'critical', … }    ← rendu d'étape générique (déjà là)
  cursor 2 → { kind:'fumble', … }      ← Maladresse foldée (étape, plus de FumbleModal)
  …
] }  « Terminer » → resumeSuspendedAI
```

`CascadeModal` : si l'étape courante est un *jet de combat* (`attackJet`/`defenseJet`/`castJet`),
elle rend `<RollFlowShell {...buildAttackProps(state, actions)} />` (builder extrait) ; sinon, le
rendu d'étape générique actuel. UNE `RollFlowShell` montée en continu.

---

## Phase A — ATTAQUE (joueur → ennemi), tranche verticale de validation

### Task A1 : extraire le builder de props d'attaque (refacto pure, zéro changement visible)

**Files :**
- Create : `src/ui/jetProps/attackJetProps.tsx` (builder pur : `(deps) => RollFlowShellProps`)
- Modify : `src/ui/RollModal.tsx` (consomme le builder ; rendu identique)
- Test : `src/ui/RollModal.test.tsx` si présent, sinon recette navigateur

- [ ] **Step 1** — Écrire `attackJetProps(deps)` qui retourne l'objet de props passé aujourd'hui à
  `<RollFlowShell>` dans `RollModal` (title `'Attaque'`, `extra=<VsHeader/>`, `setup`, `preInfluence`,
  `rows`, `outcome`, `forcedRoll`, influence, `onConfirm`, …). `deps` = `{ pa, battle, attacker,
  target, actions }`. Aucune logique nouvelle : déplacement 1:1 depuis `RollModal`.
- [ ] **Step 2** — `RollModal` devient `return <RollFlowShell {...attackJetProps(deps)} />`.
- [ ] **Step 3** — `npm run typecheck` propre.
- [ ] **Step 4** — Recette navigateur : scénario `ciblage`, une attaque → modale identique (VsHeader,
  sélecteur d'arme, localisation, Lancer→Chance→Appliquer). Console 0 erreur. Screenshot avant/après.
- [ ] **Step 5** — Commit `refactor(ui): extraire attackJetProps de RollModal (rendu identique)`.

### Task A2 : démarrer la séquence AU début de l'attaque (jet = étape 0)

**Files :**
- Modify : `src/state/pendings.ts` (`CascadeStep` : ajouter `jet?: 'attack'|'defense'|'cast'`)
- Modify : ouverture d'attaque joueur (là où `pendingAttack` est posé) + `attackConfirm` (store.ts)
- Modify : `src/state/modalArbiter.ts` (l'étape-jet de combat appartient à l'attaquant)
- Test : `src/state/store.test.ts` (séquence créée, curseur, fin → resume)

- [ ] **Step 1 (failing test)** — « ouvrir une attaque joueur crée un `pendingCascade` purpose
  `'combat'` avec `participants[0].jet==='attack'`, `cursor 0`, et `pendingAttack` posé ».
- [ ] **Step 2** — À l'ouverture de l'attaque : en plus de `pendingAttack`, `set({ pendingCascade:
  { title:'Attaque', icon:'⚔️', purpose:'combat', cursor:0, log:[], participants:[{ id:'jet',
  kind:'attackJet', actorId: attacker.id, jet:'attack', interactive:true }] } })`.
- [ ] **Step 3** — `attackConfirm` : APRÈS sa logique actuelle (qui append déjà les conséquences au
  `pendingCascade`), ne PAS laisser le curseur sur l'étape-jet : `advanceCascade`-like → curseur sur
  la 1ʳᵉ conséquence, ou `finalizeCascade`+`resumeSuspendedAI` s'il n'y en a aucune. (Réutiliser
  `advanceCascade`/`finalizeCascade` ; l'étape-jet n'a pas d'applier → commit muet.)
- [ ] **Step 4** — `pushReveal`/`pushCombatStep`/`applyMiscast` : APPEND au `pendingCascade` existant
  (déjà le cas) — vérifier qu'ils insèrent APRÈS l'étape-jet, pas avant.
- [ ] **Step 5** — `modalArbiter` : `cascade` rend l'étape-jet de combat → owner = `actorId` de
  l'étape (déjà le cas). `attack` reste en repli (sera retiré en Phase D).
- [ ] **Step 6** — Tests verts (`store.test`, `reveal-combat.test`, `roll-modal-invariant.test`,
  `cascade.test`).
- [ ] **Step 7** — Commit `feat(combat): demarrer la sequence de combat au jet (etape 0)`.

### Task A3 : CascadeModal rend l'étape-jet via le builder (la 2ᵉ fenêtre disparaît)

**Files :**
- Modify : `src/ui/CascadeModal.tsx` (branche `jet de combat` → `attackJetProps`)
- Modify : confirm de l'étape-jet câblé sur `attackConfirm` (qui enchaîne le curseur, A2)

- [ ] **Step 1** — Dans `CascadeModal`, si `stepInteraction(cur)==='jet'` ET `cur.jet==='attack'` :
  rendre `<RollFlowShell {...attackJetProps({ ...deps, onConfirm: attackConfirm })} />` (la modale
  reste la même `RollFlowShell`). Les étapes suivantes : rendu générique actuel.
- [ ] **Step 2** — Retirer la création d'un `pendingCascade` titré « Conséquences » distinct : le
  titre de la séquence est « Attaque » dès l'étape 0 (plus jamais de fenêtre « Conséquences »).
- [ ] **Step 3** — Recette navigateur : attaque qui CRIT → UNE seule fenêtre « Attaque » : jet en
  tête (figé après Lancer), Coup Critique en dessous (panneau riche), « Continuer », pas de
  réouverture. Attaque normale (touche simple) → jet puis « Terminer ». Attaque ratée → idem.
  Console 0 erreur. GIF de la séquence.
- [ ] **Step 4** — Commit `feat(combat): rendre le jet d'attaque dans la sequence (une fenetre)`.

## Phase B — DÉFENSE (ennemi → héros)
Même patron : `defenseJetProps` (Task B1), démarrer la séquence à `maybeOpenDefense` avec étape-jet
`defenseJet` (B2), `CascadeModal` branche `defenseJet` + `defenseConfirm`/`defenseCancel` enchaînent
le curseur (B3). Recette : ennemi frappe un héros, parade ratée → Critique inline, une fenêtre.

## Phase C — MAGIE
`castJetProps` (C1) ; démarrer la séquence à l'ouverture de `pendingCast` (C2) ; `CascadeModal`
branche `castJet` + Opposition/Surincantation/Critique/Imparfaite en étapes ou slots de l'étape-jet
(C3). Cas : Projectile magique critique, Imparfaite, Surincantation — une fenêtre.

## Phase D — FOLD Maladresse/Abattre/Destin + retrait des modales-jet autonomes
- [ ] `pendingFumble`→ étape `fumble` (applier = logique `fumbleConfirm`), retirer `FumbleModal`.
- [ ] `pendingKnockdown`→ étape `knockdown`, retirer `KnockdownModal`.
- [ ] `pendingFateSave`→ étape `fateSave` (le choix Destin = étape `choix`), retirer `FateSaveModal`.
- [ ] Retirer les entrées `attack`/`defense`/`cast` de `modalArbiter` + `RollModal`/`DefenseModal`/
  `CastModal` comme composants montés par `ActiveModal` (leur paramétrage vit dans les builders).
- [ ] Garde-fou : `active-modal.test` (combat = `cascade` seule), `roll-modal-invariant.test`.

## Vérification (chaque phase)
1. `npm run typecheck` propre.
2. `npm test` : combat + cascade + invariant verts (ignorer les reds de la session // : serialize
   CRLF, golden snapshots, frenchy `_tmp_gen_races`).
3. Recette navigateur (`window.__wfrp`, serveur dev) : la situation entière dans UNE fenêtre, jet en
   tête figé, conséquences empilées, « Continuer »/« Terminer », IA reprend à la fermeture, 0 erreur
   console. Comparer à la cascade de nuit (même look/feel).

## Hors périmètre (signalé)
- La nuit/repos/voyage gardent leur `pendingCascade` (déjà conforme) — on ne touche qu'au rendu
  partagé si une branche commune est extraite.
- Les reds de la session parallèle (données frenchy, golden, serialize CRLF) ne sont PAS de ce lot.
