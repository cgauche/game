# Phase C1b — Modale de Déviation Critique (côté JOUEUR) — Plan d'implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:executing-plans. Étapes en `- [ ]`.
> ⚠️ **Chirurgie de flux de combat + UI** : exige une **recette navigateur** (Playwright MCP) en fin.

**Goal:** Quand un **héros** subit un **Coup Critique** à une localisation où il a de la **PA**, lui offrir le choix **Dévier** (sacrifier 1 PA, ignorer le Critique, subir les Blessures recalculées PA−1) / **Subir** (prendre le Critique) — LDB 63 l.63-66. (Les ENNEMIS dévient déjà automatiquement — C1a.)

**Architecture — le piège central :** `applyAttackResult` est **synchrone** et appelée de **4 sites** : `defenseConfirm`, `defenseCancel`, `doAttack` (combatFlow), `applyCast` (sorts). Le Critique n'est connu qu'**après** résolution (dans `res`). Pour insérer un choix joueur SANS double application ni effets de bord dupliqués :

1. `applyAttackResult(..., deviated?: boolean): boolean` **renvoie `suspended`**. Au TOUT DÉBUT (avant `aiming`/`engage`/Blessures), si `deviated === undefined && res.hit && res.critical && target.kind === 'hero' && (target.armour[loc] ?? 0) > 0` → `set({ pendingDeviation: { attackerId, targetId, weapon, res } })` et **`return true`** (suspendu, **aucun** effet de bord).
2. **Chaque caller** vérifie le retour : si `suspended`, il **n'exécute PAS** ses post-étapes (autoCleave / Piétinement / pendingFumble / resumeEnemyTurn) — elles seront rejouées à la résolution de la modale.
3. La modale résout via `deviationApply(deviated)` qui : retrouve attaquant/cible, **rappelle `applyAttackResult(..., deviated)`** (le early-return est sauté → application complète UNE fois), puis **rejoue les post-étapes du contexte** (cf. `resumeAfter`), met `pendingDeviation = null`, et `resumeEnemyTurn`.
4. `resumeEnemyTurn` **garde** contre `pendingDeviation` (comme `pendingFumble`/`pendingFateSave`) → pas d'avance prématurée.

**Décision de simplification (réduit le risque) :** le cas FRÉQUENT et obligatoire est **ennemi→héros en mêlée** (via `pendingDefense` → `defenseConfirm`/`defenseCancel`) et **ennemi→héros sans défense** (`doAttack`). Le cas **sort→héros** (`applyCast`) est plus rare : on **gate** la déviation aux attaques (pas les sorts) en v1 (la modale ne s'ouvre que si `weapon` est une arme), et on documente le sort comme suite. Cela évite de toucher `applyCast`.

**Périmètre fichiers :** `src/state/store.ts` (état + actions), `src/state/combatFlow.ts` (applyAttackResult + callers + guard — WIP utilisateur, vérifier diff), `src/ui/DeviationModal.tsx` (neuf), `src/ui/CampaignView.tsx` (montage), `src/state/store.test.ts` (cycle suspend/resume).

---

## Task 1 : État `pendingDeviation` (store)

**Files:** Modify `src/state/store.ts`.

- [ ] **Step 1 : Interface (à côté de `PendingFumble`, ~l.152)**

```ts
/** Déviation Critique en attente (LDB 63 l.63-66) : un HÉROS a subi un Coup Critique à une
 *  localisation où il a de la PA ; il choisit Dévier (−1 PA, ignore le Critique) ou Subir.
 *  `res`/`weapon` figés pour rejouer `applyAttackResult` avec la décision. */
export interface PendingDeviation {
  attackerId: string;
  targetId: string; // héros
  weapon: Weapon;
  res: AttackResult;
  /** Reprendre le tour de l'IA après application (toujours vrai ici : déviation = tour ennemi). */
  resumeAfter: boolean;
}
```

- [ ] **Step 2 : Champ d'état + clear au `startCombat`**

Ajouter le champ à `GameState` (près de `pendingDefense: PendingDefense | null;`) :

```ts
  pendingDeviation: PendingDeviation | null;
```

Initialiser `pendingDeviation: null` à la création du store ET dans `startCombat` (là où `pendingDefense: null` est remis — chercher `pendingFumble: null` au `startCombat` et ajouter `pendingDeviation: null` à côté).

- [ ] **Step 3 : Vérifier le typecheck**

Run: `npm run typecheck`
Expected: erreurs « pendingDeviation manquant » aux endroits d'init → corriger jusqu'à 0. (Pas encore d'usage.)

---

## Task 2 : `applyAttackResult` renvoie `suspended` + intègre `deviated` (combatFlow)

**Files:** Modify `src/state/combatFlow.ts`.

- [ ] **Step 1 : Signature + early-return de suspension**

Changer la signature : `export function applyAttackResult(get, set, attacker, target, weapon, res: AttackResult, deviated?: boolean): boolean {`.

Insérer en TOUTE PREMIÈRE ligne du corps (avant `const battle = get().battle!;`) :

```ts
  const dloc = res.location ?? 'corps';
  if (deviated === undefined && res.hit && res.critical && target.kind === 'hero' && weapon.type !== undefined && (target.armour[dloc] ?? 0) > 0) {
    // Déviation Critique (héros) : suspendre pour le choix du joueur (LDB 63 l.63-66). Aucun effet de bord ici.
    set({ pendingDeviation: { attackerId: attacker.id, targetId: target.id, weapon, res, resumeAfter: true } });
    return true; // suspendu — le caller NE doit PAS exécuter ses post-étapes
  }
```

À la **fin** de la fonction, `return false;` (non suspendu). (Toutes les sorties anticipées existantes deviennent `return false;` — vérifier qu'il n'y a pas de `return;` nu ; sinon les transformer en `return false;`.)

- [ ] **Step 2 : Intégrer `deviated` dans le bloc Critique**

Dans le bloc `if (res.hit && res.woundsLost)`, remplacer la condition de déviation ennemie pour inclure le choix héros. Remplacer :

```ts
    if (res.critical && target.kind === 'enemy' && (target.armour[loc] ?? 0) > 0) {
      deviateArmour(target, weapon, res, critLog); // Déviation auto de l'ennemi (dévie toujours s'il a de la PA, LDB 63 l.63-66)
    } else if (res.critical || overkill > 0) {
```

par :

```ts
    const autoDeviate = res.critical && target.kind === 'enemy' && (target.armour[loc] ?? 0) > 0; // ennemi : toujours
    if (res.critical && (autoDeviate || deviated === true)) {
      deviateArmour(target, weapon, res, critLog);
    } else if (res.critical || overkill > 0) {
```

- [ ] **Step 3 : Garde `resumeEnemyTurn`**

Dans `resumeEnemyTurn` (chercher la condition qui teste `pendingFateSave`/`pendingFumble`), ajouter `|| get().pendingDeviation` pour ne pas avancer tant que la modale est ouverte.

- [ ] **Step 4 : Callers vérifient `suspended`**

Dans `defenseConfirm` (store.ts:1376-1380) — encadrer les post-étapes :

```ts
    if (attacker && defender) {
      const suspended = applyAttackResult(get, set, attacker, defender, pd.weapon, pd.result);
      if (suspended) return; // la modale de Déviation reprendra (autoCleave/fumble/resume rejoués au resolve)
      autoCleave(get, set, attacker, defender, pd.result);
      aiMaybeTrample(get, set, attacker);
    }
```

Idem `defenseCancel` (store.ts:1396-1401) :

```ts
    if (attacker && defender) {
      const res = resolveMeleePassive(attacker, defender, pd.weapon, pd.atk, pd.location ?? undefined);
      const suspended = applyAttackResult(get, set, attacker, defender, pd.weapon, res);
      if (suspended) return;
      autoCleave(get, set, attacker, defender, res);
      aiMaybeTrample(get, set, attacker);
    }
```

Dans `doAttack` (combatFlow.ts ~684) — là où `applyAttackResult` est appelé pour une attaque d'ennemi instantanée, capter le retour ; si `suspended`, **ne pas** enchaîner `resumeEnemyTurn`/advance (la modale s'en charge). *(Lire le site exact ; appliquer le même garde.)*

- [ ] **Step 5 : Vérifier (suite — comportement inchangé tant que pas de héros-crit-armuré joué)**

Run: `npm test` ; `npm run typecheck`
Expected: vert (les tests existants n'ouvrent pas la modale de déviation héros ; golden-master = résolution pure, intact).

---

## Task 3 : Actions de résolution (store)

**Files:** Modify `src/state/store.ts`.

- [ ] **Step 1 : `deviationApply` (Dévier=true / Subir=false)**

À côté de `defenseConfirm` :

```ts
  deviationApply: (deviate: boolean) => {
    const { battle, pendingDeviation: pdv } = get();
    if (!battle || !pdv) return;
    const attacker = battle.combatants.find((c) => c.id === pdv.attackerId);
    const target = battle.combatants.find((c) => c.id === pdv.targetId);
    set({ pendingDeviation: null }); // null AVANT la reprise (anti ré-entrance)
    if (attacker && target) applyAttackResult(get, set, attacker, target, pdv.weapon, pdv.res, deviate);
    if (pdv.resumeAfter) resumeEnemyTurn(get, set);
  },
```

*(NB : autoCleave/Piétinement sont déjà joués AVANT la suspension dans le caller ? Non — le caller `return` AVANT eux quand suspended. Donc les rejouer ici si nécessaire. **Décision** : pour la mêlée ennemi→héros, autoCleave/trample concernent l'attaquant balayant d'AUTRES héros — indépendants de cette cible. On les **rejoue ici** pour fidélité : ajouter `autoCleave(get,set,attacker,target,pdv.res); aiMaybeTrample(get,set,attacker);` avant `resumeEnemyTurn`. Importer/typer si besoin.)*

- [ ] **Step 2 : Typecheck** → 0.

---

## Task 4 : UI — `DeviationModal` + montage

**Files:** Create `src/ui/DeviationModal.tsx` ; Modify `src/ui/CampaignView.tsx`.

- [ ] **Step 1 : `DeviationModal.tsx`** (calqué sur `DefenseModal`/`FateSaveModal`)

```tsx
import { useGame } from '../state/store';
import { HIT_LOCATION_LABELS } from '../engine/types';

/** Modale de Déviation Critique (LDB 63 l.63-66) : le héros choisit de sacrifier 1 PA pour
 *  ignorer le Coup Critique (il subit quand même les Blessures normales, ~+1), ou de le subir. */
export function DeviationModal() {
  const pdv = useGame((s) => s.pendingDeviation);
  const battle = useGame((s) => s.battle);
  const apply = useGame((s) => s.deviationApply);
  if (!pdv || !battle) return null;
  const target = battle.combatants.find((c) => c.id === pdv.targetId);
  if (!target) return null;
  const loc = pdv.res.location ?? 'corps';
  const pa = target.armour[loc] ?? 0;
  return (
    <div className="modal-overlay">
      <div className="modal roll-modal">
        <h3>Coup Critique — {HIT_LOCATION_LABELS[loc]}</h3>
        <p className="rm-log">
          {target.name} subit un Coup Critique ({HIT_LOCATION_LABELS[loc]}). Sacrifier 1 PA d'armure
          (PA {pa} → {pa - 1}) pour l'ignorer ? Tu subiras quand même les Blessures (≈ +1).
        </p>
        <div className="modal-actions">
          <button className="btn" onClick={() => apply(false)} title="Subir le Coup Critique">Subir le critique</button>
          <button className="btn btn-primary" onClick={() => apply(true)} title="Sacrifier 1 PA pour ignorer le critique">
            🛡️ Dévier (−1 PA)
          </button>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2 : Monter dans `CampaignView.tsx`**

Importer `import { DeviationModal } from './DeviationModal';` et l'ajouter à côté de `<DefenseModal />` / `<FateSaveModal />` (ligne ~97-103) : `<DeviationModal />`.

---

## Task 5 : Test store du cycle suspend/resume

**Files:** Modify `src/state/store.test.ts`.

- [ ] **Step 1 : Test** — monter un combat minimal (cf. tests existants `store.test.ts`), forcer une attaque ennemie qui CRITE un héros armuré (arme Empaleuse + jet multiple de 10, ou injecter un `res` critique), vérifier :
  - `applyAttackResult(..., undefined)` retourne `true` et `pendingDeviation` est non-null.
  - `deviationApply(true)` → PA de la localisation réduite de 1, `criticalWounds` du héros **inchangé** (critique ignoré), `pendingDeviation` null.
  - `deviationApply(false)` → `criticalWounds` **incrémenté** (critique subi), PA inchangée.
  *(S'inspirer du fixtures de `store.test.ts` ; utiliser un RNG seedé.)*

- [ ] **Step 2 :** `npm test` vert.

---

## Task 6 : Recette navigateur (OBLIGATOIRE — UI + flux)

- [ ] Lancer `npm run dev`, ouvrir un scénario de test où un ennemi peut critiquer un héros armuré (menu 🧪). Provoquer un Critique sur un héros : la **modale Déviation** s'ouvre, « Dévier » réduit la PA et ignore le critique, « Subir » applique le critique. **Console 0 erreur**, le tour de l'IA **reprend** correctement (pas de blocage, pas de double-avance). Vérifier l'enchaînement défense→déviation (héros qui pare puis subit un critique).

---

## Fin — différé

- **Sort→héros critique** (`applyCast`) : la déviation y est gated OFF en v1 ; l'étendre = brancher le même early-return dans `applyCast` + son resume.
- **Réparation d'armure** (Marchand #2).

## Self-review

- **Couverture** : état (T1), suspend/resume re-entrant + intégration `deviated` + garde (T2), actions (T3), UI (T4), test store (T5), recette (T6). ✓
- **Pièges traités** : double-application (early-return sans effets de bord + re-call unique) ; caller-continuation (retour `suspended` + `if (suspended) return`) ; double-modale fumble+déviation (le caller `return` avant le check fumble) ; ordre autoCleave (rejoué au resolve) ; avance prématurée (garde `resumeEnemyTurn`). ✓
- **Risque résiduel** : `doAttack` (T2.4) doit être lu et gardé exactement ; le test store (T5) + la recette (T6) sont les filets. `combatFlow`/`store` = WIP utilisateur → vérifier les diffs avant commit.
