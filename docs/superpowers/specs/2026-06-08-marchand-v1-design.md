# Marchand v1 (transactionnel + Disponibilité RAW) — Design (#2)

*Date : 2026-06-08. Statut : design validé en brainstorming. Sous-projet #2 du Jalon 1.6, **remonté** devant #T2/#T3 (l'horloge #T1 suffit ; le re-stock dans le temps attendra #T3).*

## Goal

Un **marchand jouable** : on clique un PNJ marchand → un panneau pour **acheter/vendre** des objets, avec **prix RAW** (catalogue × qualité d'artisanat) et **stock = Disponibilité RAW** (Commune/Limitée/Rare/Exotique selon la taille d'agglomération). Pérenne et **paramétrable dans l'éditeur** (archétype + override par entité). Conçu **time-ready** : le re-stock au passage du temps est un seam branché plus tard (#T3).

## Décisions (validées en brainstorming 2026-06-08)

- **Périmètre v1 = transactionnel + Disponibilité RAW complète.** Lots suivants (HORS périmètre) : **Marchandage** (#2c), **Réparation d'armure** (#2d), **Évaluation** (#2e), re-stock dans le temps (#T3).
- **Stock = instantané par visite** : à la 1re ouverture du marchand, on lance le Test de Disponibilité de chaque article Limitée/Rare **une fois** + sa quantité ; figé pour la visite, **Tests montrés en révélation**. Re-test au passage du temps / changement d'agglo = **seam #T3** (no-op en v1).
- **Vente = depuis les `items` (équipement à stats) des héros** uniquement. L'inventaire party-level (`store.inventory`, noms de handouts/butin) **n'est pas vendable**.
- **Prix de rachat** : aucune règle RAW (LDB 59 « achat/vente optionnels ») → `resaleRate` **défaut 10 %**, paramétrable par archétype/entité.
- **Le marchand est un PNJ** (`SceneEntity` kind `personnage`) qui référence un **archétype** ; il n'est PAS un objet/décor.
- Les **données existent déjà** : `trappings.json` (270 articles) porte `availability` (Commune 148 / Limitée 56 / Rare 41 / Exotique 22 / ND 2 / null 1), `price {gold,silver,bronze}`, `type`/`subType`. `craftEconomy.ts` (livré) donne le facteur prix ×2/÷2 par qualité.

## Architecture & composants (moteur pur → état → UI)

### 1. `src/engine/money.ts` — monnaie (pur, testé)
Réconcilie `price.bronze` (data) = `Money.brass` (store) = la même pièce (PA).
```ts
export interface Money { gold: number; silver: number; brass: number; }
export const PA_PER_SC = 12, PA_PER_CO = 240; // RAW : 1 CO = 20 SC = 240 PA ; 1 SC = 12 PA
export function toBrass(m: Money): number;          // valeur totale en PA
export function fromBrass(pa: number): Money;        // normalise CO/SC/PA (gold = floor/240, …)
export function add(a: Money, b: Money): Money;
export function subtract(a: Money, b: Money): Money | null; // null si insuffisant
export function canAfford(purse: Money, cost: Money): boolean;
export function formatMoney(m: Money): string;       // « 2 CO 3 SC »
export function priceToMoney(p: { gold?: number; silver?: number; bronze?: number }): Money; // data → Money
```

### 2. `src/engine/disponibilite.ts` — Disponibilité (pur, seedé, testé)
```ts
export type Availability = 'Commune' | 'Limitée' | 'Rare' | 'Exotique';
export type Settlement = 'village' | 'ville' | 'cite';
export interface StockLine { label: string; qty: number; }   // qty>0 = en stock
/** Pour un article : en stock ? combien ? (Commune toujours ; Limitée/Rare = Test % + quantité ; Exotique = non). */
export function rollAvailability(av: Availability, settlement: Settlement, rng: RNG): { inStock: boolean; qty: number; test?: { roll: number; target: number } };
/** Instantané d'un catalogue filtré (catégorie de l'archétype) pour une agglo donnée. Curaté = forcé en stock. */
export function rollStock(catalog: CatalogItem[], settlement: Settlement, rng: RNG, curated?: string[]): StockLine[];
```
- **% de Disponibilité par (classe × agglo) et quantités (Village 1 / Ville 1d10 / Cité illimité)** : **RAW LDB 59**, **extraits+vérifiés du Livre de Base FR en Tâche 1 du plan** (source : `Source/Warhammer v4 - Livre de base version corrigée/` — JAMAIS un rulebook VO ; workflow adversarial comme le calendrier #T1 ; ne rien inventer ; citer `LDB 59 l.XX`). `ND`/`null` → traités comme non-vendables (exclus) par défaut.
- RNG **seedable** (`makeRNG`) → instantanés déterministes pour les tests.

### 3. Archétype marchand — 6ᵉ famille du registre `defs/`
```ts
export interface MerchantArchetype {
  id: string;                 // 'herboriste', 'armurier', 'general'…
  label: string;
  category: { types?: string[]; subTypes?: string[] }; // quelles familles il vend (filtre trappings)
  settlement: Settlement;     // défaut (overridable par l'entité)
  resaleRate: number;         // défaut 0.10
  curated?: string[];         // labels garantis en stock (qualités possibles plus tard)
}
```
Chargé par le codegen du registre (`gen-registry.mjs`, 1 fichier defs = 1 entrée), comme les 5 familles existantes.

### 4. État — slice marchand dans le store
- `SceneEntity` gagne `merchant?: { archetype: string; settlement?: Settlement; resaleRate?: number }` (override d'archétype).
- `openMerchant(entityId)` : résout l'archétype + agglo effective → `rollStock` (seedé), pousse les **Tests de Disponibilité en révélation** (file témoin existante `pendingReveals`), stocke l'instantané (transient, ré-ouvrable). État `merchant: { entityId, stock: StockLine[], resaleRate, settlement } | null`.
- `buyItem(label, heroId)` : prix = `priceToMoney(catalogue) × facteur craftEconomy`; si `canAfford` → `subtract` Bourse, `itemFromTrapping(label)` → `items` du héros + `recomputeLoadout`, décrémente la `qty` du stock. Sinon refuse (message).
- `sellItem(heroUid, heroId)` : prix de rachat = `round(resaleRate × prixCraft)` ; crédite la Bourse, retire l'`ItemInstance` des `items` du héros + `recomputeLoadout`.
- `closeMerchant()`. Seam `restockOnTimePassed()` = no-op (branché #T3).

### 5. UI — `src/ui/MerchantPanel.tsx`
Panneau (ouvert via clic sur le PNJ marchand, comme un dialogue) :
- **Colonne gauche — Stock en vente** : `label · prix (Money) · qty` ; bouton **[Acheter]** (désactivé si Bourse insuffisante).
- **Colonne droite — Vendable** : les `items` à stats des héros, `label · rachat` ; bouton **[Vendre]**.
- **Sélecteur de héros receveur** (achat) ; **Bourse** affichée ; rachat affiché. Pas de Marchandage en v1.

### 6. Éditeur
- Famille **archétype** dans le registre (édition d'un `defs/` marchand : category, settlement, resaleRate, curated).
- Sur l'entité PNJ : un champ « Marchand » (archétype + override agglo/resaleRate) — analogue au `dialogueId`.

## Flux de données
```
PNJ marchand (clic) ─► store.openMerchant(entityId)
   archetype (defs/) + settlement ─► disponibilite.rollStock(catalog∩category, settlement, rng)
        └─► Tests de Disponibilité en révélation (pendingReveals)  └─► merchant.stock (instantané)
MerchantPanel ◄── merchant.stock + party.items + money
   [Acheter] ─► buyItem : money.subtract + itemFromTrapping→hero.items + qty--
   [Vendre]  ─► sellItem : money.add(resaleRate×prix) + retrait hero.items
prix affiché = priceToMoney(catalogue) × craftEconomy(quality)
seam : restockOnTimePassed() ◄── (futur) EVT.TIME_ADVANCED (#T3)
```

## Tests
- `money.ts` : conversions (240 PA = 1 CO ; fromBrass normalise) ; `add/subtract` (insuffisant → null) ; `canAfford` ; `priceToMoney`.
- `disponibilite.ts` : Commune → toujours ; Exotique → jamais (sauf curaté) ; Limitée/Rare → Test % (seedé : un seed réussit, un autre échoue) ; quantités par agglo (Village 1, Ville 1..10, Cité illimité) ; déterminisme (même seed → même stock).
- store : `openMerchant` (instantané + révélations) ; `buyItem` (débite Bourse + objet sur le héros + qty-- ; Bourse insuffisante refuse) ; `sellItem` (crédite resaleRate×prix + retire l'objet) ; prix × facteur qualité.
- registre archétype : un `defs/` marchand → entrée chargée.
- Suite complète verte + golden-combat intact + typecheck.

## Hors périmètre (lots suivants)
- **Marchandage** (#2c) : Test opposé, −10 % / −20 % (DR≥6 ou Négociateur), **un jet verrouillé par transaction**.
- **Réparation d'armure** (#2d) : 10 %/PA (LDB 63).
- **Évaluation** (#2e) : révèle la qualité cachée ; estime ±10 % Rare/Exotique.
- **Re-stock dans le temps** (#T3) : `restockOnTimePassed` branché sur `EVT.TIME_ADVANCED`.

## Self-review
- **Couverture** : monnaie, Disponibilité, archétype, store buy/sell, UI, éditeur + tests. Les 3 décisions de brainstorming (périmètre full / instantané / vente depuis hero.items) sont câblées. ✓
- **Pas de placeholder** : APIs complètes (signatures money/disponibilite/archétype/store) ; les SEULES valeurs non figées (% et quantités Disponibilité) sont **RAW LDB 59, extraites en Tâche 1 du plan** (source identifiée, pas inventée — cf. méthode calendrier #T1). ✓
- **Discipline repo** : `money.ts`/`disponibilite.ts` purs (moteur, seedés) ; store en état ; `MerchantPanel`/éditeur en UI. Réutilise `craftEconomy` (livré), `itemFromTrapping`/`recomputeLoadout`, `pendingReveals`, le registre `defs/`. ✓
- **Risque** : la table Disponibilité RAW (LDB 59) doit être extraite proprement (OCR FR) — isolée dans `disponibilite.ts`, ajustable. Monnaie `bronze`↔`brass` : 1 seul point de vérité (`priceToMoney`).
