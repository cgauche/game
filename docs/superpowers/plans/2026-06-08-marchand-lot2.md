# Marchand lot 2 — Marchandage / Évaluation / Réparation + objet non-identifié (magique) — Plan (#2c/d/e)

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:executing-plans (INLINE — `store.ts`/`combatFlow.ts`/`scene.ts`/`CampaignView.tsx`/`MerchantPanel.tsx` sont CHAUDS, édités par d'autres sessions //). Étapes en `- [ ]`.
> ⚠️ Fichiers chauds → relire l'ancre avant chaque edit ; committer **uniquement mes hunks** (index temporaire seedé sur HEAD + reverse-apply des hunks étrangers ; marqueurs : `bargain`/`appraise`/`identified`/`repair`/`Marchandage`/`Évaluation`/`Réparation`). Vérifier `git show --stat` avant commit. ⚠️ **Hazard vécu** : store.ts a été `git restore` sous moi une fois → committer VITE après chaque task, relire l'ancre à chaque edit. Finir les commits par `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`.
> **VF** : tout affiché en français ; RAW = LDB FR + ADE II uniquement, cité.

**Goal:** Compléter le Marchand : Marchandage (négocier −10/−20 %), Évaluation (révéler qualité cachée + estimer valeur), Réparation d'armure (10 %/PA), et le modèle d'objet non-identifié (qualités cachées révélées par l'Évaluation, skin légendaire = indice).

**Architecture:** Helpers purs (`bargain.ts`/`appraisal.ts`/`repair.ts`) ; flag `ItemInstance.identified` (n'affecte QUE l'affichage — les qualités restent actives au combat) ; deux modales de Test (`pendingAppraise` non-opposé, `pendingBargain` opposé) calquées sur `pendingReload`/`pendingDefense` ; qualités magiques = entrées du registre existant (ADE II). Réutilise `partyBest`/`testValue`/`opposedTest`/`craftPriceFactor`/`MERCHANTS`.

**Tech Stack:** TypeScript pur, Zustand, Vitest, React.

**Spec:** `docs/superpowers/specs/2026-06-08-marchand-lot2-design.md`. **RAW cité** : Marchandage LDB 60 l.12 ; Évaluation LDB 60 l.10 ; vente ¼–½ LDB 60 l.22 ; Réparation LDB 63 l.97-98 ; qualités magiques ADE II « 04 - Un peu de magie.md ».

---

## Task 1 : Helpers purs — `bargain.ts` + `appraisal.ts` + `repair.ts`

**Files:** Create `src/engine/bargain.ts` + `.test.ts` ; `src/engine/appraisal.ts` + `.test.ts` ; `src/engine/repair.ts` + `.test.ts`. *(à moi, commit direct.)*

- [ ] **Step 1 : Tests qui échouent** :

`src/engine/bargain.test.ts` :
```ts
import { describe, it, expect } from 'vitest';
import { bargainBuyFactor, bargainSellFactor } from './bargain';

describe('bargain — Marchandage RAW (LDB 60 l.12 / l.22)', () => {
  it('achat : perdu → 1, gagné → 0.9, gagné DR≥6 ou Négociateur → 0.8', () => {
    expect(bargainBuyFactor(false, 0, false)).toBe(1);
    expect(bargainBuyFactor(true, 0, false)).toBe(0.9);
    expect(bargainBuyFactor(true, 6, false)).toBe(0.8);
    expect(bargainBuyFactor(true, 2, true)).toBe(0.8); // Négociateur
  });
  it('vente (sur la base ½) : gagné → 1 (½), perdu → 0.5 (¼)', () => {
    expect(bargainSellFactor(true, 0, false)).toBe(1);
    expect(bargainSellFactor(false, 0, false)).toBe(0.5);
  });
});
```
`src/engine/appraisal.test.ts` :
```ts
import { describe, it, expect } from 'vitest';
import { appraiseEstimate } from './appraisal';

describe('appraisal — Évaluation estime ±10 % Rare/Exotique (LDB 60 l.10)', () => {
  it('Rare/Exotique → ±10 % ; sinon prix exact', () => {
    expect(appraiseEstimate('Rare', 100)).toEqual({ min: 90, max: 110 });
    expect(appraiseEstimate('Exotique', 200)).toEqual({ min: 180, max: 220 });
    expect(appraiseEstimate('Commune', 100)).toEqual({ min: 100, max: 100 });
  });
});
```
`src/engine/repair.test.ts` :
```ts
import { describe, it, expect } from 'vitest';
import { repairCostBrass } from './repair';

describe('repair — réparation armure (LDB 63 l.97-98)', () => {
  it('10 % du prix de base par PA perdu', () => {
    expect(repairCostBrass({ pa: 2, damageTaken: 1 } as any, 120)).toBe(12); // 1 PA perdu × 10 % de 120
    expect(repairCostBrass({ pa: 3, damageTaken: 2 } as any, 120)).toBe(24); // 2 PA × 10 %
  });
  it('pièce brisée (PA nette 0) → 30 % du prix de base', () => {
    expect(repairCostBrass({ pa: 1, damageTaken: 1 } as any, 100)).toBe(30); // brisée → 30 %
  });
  it('non endommagée → 0', () => {
    expect(repairCostBrass({ pa: 2, damageTaken: 0 } as any, 100)).toBe(0);
  });
});
```

- [ ] **Step 2 : Lancer → échouent.**

- [ ] **Step 3 : Implémenter** :

`src/engine/bargain.ts` :
```ts
/** Marchandage RAW (LDB 60). Gagner un Test opposé réduit le prix de 10 % (l.12), jusqu'à 20 %
 *  avec un Succès Stupéfiant (DR net ≥ 6) ou le talent Négociateur. Vente : base ½ du listé, ¼–½
 *  après Marchandage (l.22). */
export function bargainBuyFactor(won: boolean, drNet: number, negotiator: boolean): number {
  if (!won) return 1;
  return drNet >= 6 || negotiator ? 0.8 : 0.9;
}
/** Facteur appliqué à la base de vente (½ du listé) : gagné = ½ plein (1), perdu = ¼ (0.5). */
export function bargainSellFactor(won: boolean, _drNet: number, _negotiator: boolean): number {
  return won ? 1 : 0.5;
}
```
`src/engine/appraisal.ts` :
```ts
import type { Availability } from './disponibilite';
/** Évaluation (LDB 60 l.10) : « estimer les prix des objets Rares ou Exotiques à ±10 % » ; sinon exact. */
export function appraiseEstimate(av: Availability | null, basePrice: number): { min: number; max: number } {
  if (av === 'Rare' || av === 'Exotique') return { min: Math.round(basePrice * 0.9), max: Math.round(basePrice * 1.1) };
  return { min: basePrice, max: basePrice };
}
```
`src/engine/repair.ts` :
```ts
import type { ItemInstance } from './types';
/** Coût de réparation d'une armure en PA (sous de cuivre). RAW LDB 63 l.97-98 : 10 % du prix de base
 *  PAR PA perdu ; 30 % si la pièce est complètement brisée (PA nette 0). */
export function repairCostBrass(item: Pick<ItemInstance, 'pa' | 'damageTaken'>, basePriceBrass: number): number {
  const lost = item.damageTaken ?? 0;
  if (lost <= 0) return 0;
  const broken = (item.pa ?? 0) - lost <= 0;
  return Math.round(basePriceBrass * (broken ? 0.30 : 0.10 * lost));
}
```

- [ ] **Step 4 : Lancer → passent ; typecheck.**
- [ ] **Step 5 : Commit** : `git commit -- src/engine/bargain.ts src/engine/bargain.test.ts src/engine/appraisal.ts src/engine/appraisal.test.ts src/engine/repair.ts src/engine/repair.test.ts -m "feat(marchand): helpers purs bargain/appraisal/repair (RAW LDB 60/63) (#2)"`

---

## Task 2 : Flag `identified` (objet non-identifié) + masquage UI

**Files:** Modify `src/engine/types.ts` (`ItemInstance`) ; Modify `src/ui/MerchantPanel.tsx` (à moi) + `src/ui/CharacterSheet.tsx` (**CHAUD**) ; Test `src/engine/items.test.ts` (à moi).

Principe : `identified` n'affecte QUE l'affichage. Les qualités restent **actives mécaniquement** (le registre les applique). `itemFromTrapping` (achat) → identifié. Un loot authored pose `identified:false`.

- [ ] **Step 1 : Test** — dans `src/engine/items.test.ts`, vérifier que `itemFromTrapping` produit un objet `identified !== false` (les objets du catalogue sont connus) :
```ts
it('itemFromTrapping : objet du catalogue = identifié (qualités connues) (#2)', () => {
  const it = itemFromTrapping('Hallebarde');
  expect(it).toBeTruthy();
  expect(it!.identified).not.toBe(false); // connu (undefined = identifié par défaut)
});
```

- [ ] **Step 2 : Lancer** (passe déjà si `identified` n'est pas posé à false — mais ajoute le champ au type pour l'authoring) → on ajoute le champ.

- [ ] **Step 3 : `types.ts`** — ajouter à `ItemInstance` (après `skin?`) :
```ts
  /** Objet NON identifié (objet magique/légendaire trouvé) : ses qualités sont MASQUÉES à l'affichage
   *  (elles restent actives mécaniquement) tant qu'une Évaluation ne l'a pas révélé. Absent/true = identifié. */
  identified?: boolean;
```

- [ ] **Step 4 : Masquage UI** :
  - `MerchantPanel.tsx` (vente) : si `it.identified === false` → afficher « {it.name} (non identifié) » sans détail de qualité (le composant n'affiche pas les qualités de toute façon — vérifier).
  - `CharacterSheet.tsx` (**CHAUD**, ~l.290 zone inventaire) : pour un item `identified === false`, afficher un badge « Non identifié » et **masquer la liste des qualités** (là où elle est rendue). Relire l'ancre.

- [ ] **Step 5 : Lancer + typecheck + commit** (types/items à moi ; CharacterSheet chaud → isolé) :
```bash
git commit -- src/engine/types.ts src/engine/items.test.ts src/ui/MerchantPanel.tsx   # à moi
# CharacterSheet.tsx : commit isolé -m "feat(marchand): flag identified + masquage des qualites d'un objet non identifie (#2)"
```

---

## Task 3 : Réparation d'armure (#2d)

**Files:** Modify `src/state/store.ts` (**CHAUD** — action `repairArmour`) ; Modify `src/ui/MerchantPanel.tsx` (à moi) ; Test `src/state/store.test.ts` (**CHAUD**).

- [ ] **Step 1 : Test** (`store.test.ts`, dans le describe Marchand) :
```ts
it('repairArmour : reset damageTaken contre 10 %/PA, débite la Bourse', () => {
  const h = hero(); h.items = [{ uid: 'a', name: 'Chemise de mailles', kind: 'armor', pa: 3, damageTaken: 2, qualities: [], enc: 1, equipped: true } as any];
  const sc = merchantScene();
  useGame.setState({ party: [h], scene: sc, money: { gold: 5, silver: 0, brass: 0 } });
  useGame.getState().openMerchant('pnj');
  const before = toBrass(useGame.getState().money);
  useGame.getState().repairArmour('a', 'h');
  const st = useGame.getState();
  expect(st.party[0].items!.find((i) => i.uid === 'a')!.damageTaken).toBe(0); // réparé
  expect(toBrass(st.money)).toBeLessThan(before); // débité
});
```

- [ ] **Step 2 : Lancer → échoue.**

- [ ] **Step 3 : `store.ts`** — import `import { repairCostBrass } from '../engine/repair';` + signature `repairArmour: (uid: string, heroId: string) => void;` dans GameState + action (près de `sellItem`) :
```ts
  repairArmour: (uid, heroId) => {
    const m = get().merchant; if (!m) return;
    const hero = get().party.find((h) => h.id === heroId);
    const item = hero?.items?.find((i) => i.uid === uid);
    if (!item || item.kind !== 'armor' || (item.damageTaken ?? 0) <= 0) return;
    const t = findTrapping(item.name);
    const base = t ? toBrass(priceToMoney(t.price)) : 0;
    const cost = fromBrass(repairCostBrass(item, base));
    if (!canAfford(get().money, cost)) { get().log(`Bourse insuffisante pour réparer ${item.name}.`); return; }
    set((s) => ({
      money: moneySub(s.money, cost)!,
      party: s.party.map((h) => {
        if (h.id !== heroId) return h;
        const clone: Combatant = JSON.parse(JSON.stringify(h));
        const it = clone.items?.find((i) => i.uid === uid); if (it) it.damageTaken = 0;
        recomputeLoadout(clone);
        return clone;
      }),
    }));
    get().log(`Réparation : ${item.name}.`);
  },
```

- [ ] **Step 4 : `MerchantPanel.tsx`** — ajouter une 3ᵉ colonne/section « Réparation » listant les armures `damageTaken>0` du groupe avec coût + bouton **Réparer** (`onRepair(uid, heroId)` → `repairArmour`). Passer `onRepair` dans `MerchantPanelView` (props).

- [ ] **Step 5 : Lancer + suite + typecheck + commit** (store.ts/store.test.ts chauds → isolé ; MerchantPanel à moi) :
```bash
# commit isolé -m "feat(marchand): reparation d'armure (10%/PA, LDB 63) (#2)"
```

---

## Task 4 : Marchandage (#2c) — modale de Test opposé + resaleRate RAW

**Files:** Modify `src/state/store.ts` (**CHAUD**) ; Create `src/ui/BargainModal.tsx` (à moi) + `.test.tsx` ; Modify `src/ui/CampaignView.tsx` (**CHAUD**) ; Modify `src/state/merchants/defs/*.ts` (resaleRate 0.5) ; Modify `src/ui/MerchantPanel.tsx`.

Pattern : calqué sur `pendingDefense`/`opposedTest`. **1 marchandage par visite** (verrouillé sur l'état `merchant`).

- [ ] **Step 1 : `bargain.ts` déjà fait (Task 1).** Archétypes : passer `resaleRate` à **0.5** (Armurier + Herboriste) + ajouter `bargainSkill?: number` à `MerchantArchetypeDef` (valeur Marchandage du marchand, défaut 40). `npm run gen` si besoin (defs inchangés en structure).

- [ ] **Step 2 : État + actions `store.ts`** :
  - Type `PendingBargain { playerId; playerName; merchantName; merchantValue: number; playerSkill: number; mode: 'buy'|'sell'; roll: TestResult|null; result: OpposedResult|null; rerolled?: boolean }`.
  - GameState : `pendingBargain: PendingBargain | null;` (+ init null) ; `merchant` gagne `bargain?: { won: boolean; drNet: number; negotiator: boolean } | null` (résultat verrouillé) ; actions `startBargain(mode)`, `bargainRoll`, `bargainReroll`, `bargainBonusSL`, `bargainConfirm`, `bargainCancel`.
  - `startBargain(mode)` : si `get().merchant.bargain` existe → return (verrouillé). `best = partyBest(party, 'Marchandage', 'Soc')` ; merchantValue = archétype.bargainSkill ?? 40 ; set pendingBargain (roll null).
  - `bargainRoll` : `const player = rollTest(pb.playerSkill, 'intermediaire', makeRNG(...))` ; `const merchant = rollTest(pb.merchantValue, 'intermediaire', makeRNG(...))` ; `resolveOpposed(player, merchant)` → set result. (RNG seedé de la visite pour le marchand.)
  - `bargainConfirm` : verrouille `merchant.bargain = { won: result.attackerWins, drNet: result.netSL, negotiator: hasTalent(player, 'Négociateur') }` ; `set({ pendingBargain: null })`.
  - `hasTalent(c, name) = (c.talents ?? []).some((t) => t.name === name && t.times > 0)`.
  - **Intégrer au prix** : `buyItem` multiplie le coût par `bargainBuyFactor(b.won, b.drNet, b.negotiator)` si `merchant.bargain` ; `sellItem` : base ½ (resaleRate 0.5) × `bargainSellFactor(...)`.

- [ ] **Step 3 : `BargainModal.tsx`** — calqué sur `DefenseModal`/`ReloadModalView` (pure `BargainModalView` + connecté), affiche les 2 jets opposés + verdict + ChanceButtons. Monté dans `CampaignView` (`<BargainModal />`).

- [ ] **Step 4 : `MerchantPanel`** — bouton **Marchander** (désactivé si `merchant.bargain` déjà posé) → `startBargain('buy')`. Afficher le facteur courant.

- [ ] **Step 5 : Tests** (`store.test.ts`) : `startBargain` crée pendingBargain ; `bargainConfirm` verrouille `merchant.bargain` ; un 2ᵉ `startBargain` ne re-roule pas ; `buyItem` applique le facteur. Suite + golden + typecheck.

- [ ] **Step 6 : Commit isolé** (store.ts/store.test.ts/CampaignView chauds ; BargainModal+merchants à moi) — `-m "feat(marchand): Marchandage (Test oppose -10/-20%, 1 jet verrouille) + vente RAW 1/4-1/2 (#2c)"`.

---

## Task 5 : Évaluation (#2e) — modale de Test + révélation

**Files:** Modify `src/state/store.ts` (**CHAUD**) ; Create `src/ui/AppraiseModal.tsx` (à moi) + `.test.tsx` ; Modify `src/ui/CampaignView.tsx` (**CHAUD**) + `src/ui/MerchantPanel.tsx`.

Pattern : calqué sur `pendingReload` (Test non-opposé). Succès → `identified=true` (révèle) + estimation.

- [ ] **Step 1 : État + actions `store.ts`** :
  - Type `PendingAppraise { actorId; actorName; itemUid; itemName; truePriceBrass: number; availability: string|null; skillValue: number; difficulty: Difficulty; target: number; roll: number|null; success: boolean; sl: number; rerolled?: boolean }`.
  - GameState : `pendingAppraise: PendingAppraise|null` (+ init null) ; actions `appraiseItem(uid, heroId)`, `appraiseRoll`, `appraiseReroll`, `appraiseBonusSL`, `resolveAppraise`, `appraiseCancel`.
  - `appraiseItem(uid, heroId)` : trouve l'item (héros) ; `best = partyBest(party, 'Évaluation', 'Int')` ; `target = clamp(best.value + DIFFICULTY_MODIFIERS.intermediaire)` ; set pendingAppraise (roll null). (Réutilise EXACTEMENT le flux `reloadRoll`/`reloadReroll`/`reloadBonusSL` adapté — cf. carte modale-de-test.)
  - `resolveAppraise` : `set({ pendingAppraise: null })` ; si success → marquer l'item `identified = true` (map party, clone) + `get().log(estimation via appraiseEstimate(availability, truePriceBrass))`. Échec → reste non identifié, log.

- [ ] **Step 2 : `AppraiseModal.tsx`** — pure `AppraiseModalView` (props) + connecté (cf. carte modale-de-test, exactement le pattern ReloadModal). Monté dans `CampaignView` (`<AppraiseModal />`).

- [ ] **Step 3 : `MerchantPanel`** — sur un objet vendable `identified===false`, bouton **Évaluer** → `appraiseItem(uid, heroId)`.

- [ ] **Step 4 : Tests** (`store.test.ts`) : `appraiseItem` crée pendingAppraise ; `appraiseRoll` puis succès forcé → `resolveAppraise` met `identified=true` ; échec → reste false. + `AppraiseModal.test.tsx` (rendu vue). Suite + typecheck.

- [ ] **Step 5 : Commit isolé** — `-m "feat(marchand): Evaluation (Test, revele qualite cachee + estime +-10%) (#2e)"`.

---

## Task 6 : Contenu — 1 qualité magique ADE II + objet légendaire de démo

**Files:** Modify `src/engine/qualities/registry.ts` (**CHAUD** — 1 entrée) ; un loot authored dans une scène de test.

- [ ] **Step 1 : Qualité magique** — ajouter au `QUALITIES` du registre (`registry.ts`) la qualité **« De plaies atroces »** (ADE II « 04 - Un peu de magie.md » l.228 : « possède l'Atout Dévastatrice ») = même mécanique que Dévastatrice (déjà branchée `dmgDRMode:'maxUnits'`) :
```ts
  'De plaies atroces': { key: 'De plaies atroces', type: 'Atout', subType: 'Arme', dmgDRMode: 'maxUnits' }, // ADE II « Un peu de magie » l.228 (= Dévastatrice)
```
Vérifier l'allowlist de parité (le test de parité accepte les qualités enregistrées). Pas de changement de dispatch (réutilise `qualityDamageStep`).

- [ ] **Step 2 : Test** (`golden-combat` couvre l'iso ; ajouter un test ciblé que `hasQuality(item, 'De plaies atroces')` et que `qualityDamageStep` applique le max(DR,units)) — réutiliser un test existant de Dévastatrice comme modèle.

- [ ] **Step 3 : Objet légendaire de démo** — dans une scène de test (`src/scenes/test-scenarios/` ou un loot existant), poser un objet `interact`/loot qui donne un objet `{ ..., qualities: ['De plaies atroces'], identified: false, skin: { metal: '#7faaff' } }` (épée magique non identifiée, skin bleuté). *(Authoring data — pas de logique.)*

- [ ] **Step 4 : Suite + typecheck + commit** (registry.ts chaud → isolé) — `-m "feat(marchand): qualite magique ADE II 'De plaies atroces' + objet legendaire de demo (#2)"`.

---

## Task 7 : Vérification

- [ ] `npm test` + `npm run typecheck` verts ; golden-combat intact.
- [ ] **Recette** (si browser dispo) : trouver l'épée magique non identifiée (qualités masquées + skin) → l'Évaluer chez le marchand (modale) → qualités révélées (Dévastatrice active au combat) + estimation. Marchander (modale opposée) → prix −10/−20 %. Réparer une armure endommagée → 10 %/PA.

## Hors périmètre
Délai de réparation (#T3) ; jeu complet de qualités magiques ADE II (au-delà de la démo) ; Marchandage par-objet (v1 = 1/visite) ; contrefaçons / Évaluation côté vendeur.

## Self-review
- **Couverture spec** : helpers purs (T1), identified+UI (T2), Réparation (T3), Marchandage+resaleRate RAW (T4), Évaluation+révélation (T5), qualité magique ADE II (T6), vérif (T7). ✓
- **Pas de placeholder** : code complet (bargain/appraisal/repair, `identified`, repairArmour, pendingBargain/pendingAppraise via patterns ReloadModal/DefenseModal RÉELS, qualité registre). RAW cité (LDB 60 l.10/12/22, LDB 63 l.97-98, ADE II l.228).
- **Cohérence types** : `Availability` (disponibilite) réutilisé par appraisal ; `OpposedResult`/`TestResult`/`opposedTest`/`resolveOpposed` (tests.ts) pour bargain ; `partyBest`/`testValue`/`TalentInstance.name` pour skill+Négociateur ; `bargainBuyFactor`/`bargainSellFactor`/`appraiseEstimate`/`repairCostBrass` cohérents T1→T3/T4/T5 ; `QualityDef.dmgDRMode` (registry) pour T6.
- **Discipline** : helpers purs ; modales calquées sur le pattern existant (pendingReload/pendingDefense) ; `identified` n'affecte QUE l'affichage (qualités toujours actives — pas de divergence moteur) ; magie = registre existant (zéro nouveau moteur). 5 fichiers chauds → commits isolés + rapides.
- **Risque** : store.ts très sollicité (3 tasks) — relire l'ancre + committer vite (hazard `git restore` vécu) ; le « 1 marchandage/visite » est une simplification RAW assumée (canon « 1 jet par transaction »).
