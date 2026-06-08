# Marchand lot 2 — Marchandage, Évaluation, Réparation + objet non-identifié (magique) — Design (#2c/#2d/#2e)

*Date : 2026-06-08. Statut : design validé en brainstorming. Suite du Marchand v1 ([[game-marchand-v1]]).*

## Goal

Compléter le Marchand : **Marchandage** (négocier le prix), **Évaluation** (identifier la qualité cachée + estimer la valeur), **Réparation** d'armure, et le **modèle d'objet non-identifié / magique** (qualités cachées, révélées par l'Évaluation, avec le skin légendaire comme indice). Tout RAW (LDB 60 + 63 ; qualités magiques = ADE2), rien d'inventé.

## Décisions (brainstorming 2026-06-08)

- **Objet magique ≠ nouveau moteur** : un objet magique/légendaire = un objet avec des **qualités EN PLUS** (normales comme Dévastateur, ou magiques d'ADE2). Le **registre de qualités existant les applique déjà** au combat — on n'ajoute QUE le fait de les **cacher/révéler**.
- **Qualités cachées** via `ItemInstance.identified` ; le **skin légendaire** (déjà existant) reste l'indice visuel.
- **Évaluation** révèle les qualités (RAW LDB 60 l.10 « identifier la qualité ») + estime la valeur Rare/Exotique à ±10 %.
- **Sell price corrigé au RAW** : la v1 utilisait `resaleRate` 10 % (mal sourcé) ; RAW LDB 60 l.22 = **¼ à ½ du prix listé** (base ½). Le lot #2c remplace ça.
- **Qualités magiques ADE2** = contenu (defs du registre), extraites+citées au plan ; 1-2 en v1 pour prouver le pipeline, le reste = passes ultérieures.

## Architecture & composants

### 1. Objet non-identifié (`identified`) — `src/engine/types.ts` + UI
- `ItemInstance.identified?: boolean` (absent/`true` = identifié ; `false` = non identifié).
- **Moteur inchangé** : les qualités d'un objet non identifié sont **toujours actives mécaniquement** (le registre les applique) — `identified` ne masque que l'**affichage**. (Choix : un objet magique trouvé fonctionne ; on ne connaît juste pas ses propriétés tant qu'on n'a pas évalué.)
- `itemFromTrapping` (achat catalogue) → `identified: true` (objet connu). Un loot/coffre authored peut poser `identified: false` + des qualités cachées + un `skin`.
- **UI** (fiche perso + MerchantPanel) : objet non identifié → libellé « Objet non identifié » + skin visible, **qualités masquées** (« ? »), valeur incertaine.

### 2. Évaluation (#2e) — `src/engine/appraisal.ts` (pur) + modale
- `appraiseValueEstimate(av, basePrice): {min,max}` : pour Rare/Exotique → `basePrice ± 10 %` ; sinon prix exact (RAW LDB 60 l.10).
- Action store `appraiseItem(uid, heroId)` : **Test d'Évaluation** (`partyBest('Évaluation')`, Int) via le pattern modale existant (`pendingTest` / « un jet = une modale ») → succès : `identified = true` (révèle les qualités) + journal de l'estimation de valeur. Échec : reste non identifié.
- Disponible au marchand (bouton **Évaluer**) sur un objet `identified === false`.

### 3. Marchandage (#2c) — `src/engine/bargain.ts` (pur) + store + modale
- `bargainOutcome(won: boolean, drNet: number, hasNegotiator: boolean): number` → **facteur prix** : pas de remise si perdu ; **−10 %** si gagné ; **−20 %** si gagné avec **DR net ≥ 6 (Succès Stupéfiant)** ou talent **Négociateur** (RAW LDB 60 l.12). Renvoie 1 / 0.9 / 0.8.
- **Achat** : prix = base × `bargainOutcome`. **Vente** : base = **½ prix listé** (RAW LDB 60 l.22) ; un Marchandage perdu descend vers **¼** (`resaleRate` archétype = **0.5** désormais, plancher 0.25). Remplace le 0.10 de la v1.
- Store `bargain(...)` : **Test opposé de Marchandage** (PJ `partyBest('Marchandage')` vs valeur Marchandage du marchand sur l'archétype) via modale ; **un seul jet VERROUILLÉ par transaction** (drapeau sur l'état `merchant` — pas de re-tirage). Le talent **Négociateur** lu sur l'acteur (LDB Talents).
- Archétype : ajout `bargainSkill?: number` (valeur de Marchandage du marchand, défaut paramétrable) ; `resaleRate` défaut **0.5**.

### 4. Réparation d'armure (#2d) — `src/engine/repair.ts` (pur) + store + UI
- `repairCost(item, basePriceBrass): number` (PA) : **10 % du prix de base × PA perdus** (`damageTaken`) ; **30 %** si une pièce est brisée (PA nette 0). RAW LDB 63 l.97-98.
- Store `repairArmour(uid, heroId)` : débite la Bourse, `item.damageTaken = 0` + `recomputeLoadout`. UI : section **Réparation** au MerchantPanel listant les armures `damageTaken > 0` du groupe avec leur coût.

### 5. Qualités magiques (contenu) — registre `src/engine/qualities/`
- Source : **ADE2** (« règles de création d'objets magiques » — extraites+citées au plan). Ajoutées comme entrées du registre (subType `Magique`), branchées via le **dispatch existant** (comme Dévastateur). **1-2 en v1** pour prouver le pipeline ; le reste = contenu incrémental.
- Un objet magique de démo = un objet `identified:false` + qualité(s) (normale type Dévastateur et/ou magique ADE2) + skin, posé en loot authored.

### 6. UI — `MerchantPanel`
Boutons **Marchander** (au moment de l'achat/vente → modale opposée, verrouillée), **Réparer** (armures endommagées), **Évaluer** (objets non identifiés). Affichage du prix marchandé / coût de réparation / estimation.

## Flux de données
```
Évaluer  ─► appraiseItem ─► Test Évaluation (modale) ─► identified=true (révèle qualités) + estim. valeur (journal)
Marchander ─► bargain ─► Test OPPOSÉ Marchandage (modale, 1×/transaction) ─► bargainOutcome → facteur prix (achat) / ¼–½ (vente)
Réparer  ─► repairArmour ─► repairCost (10%/PA, 30% brisé) ─► débit Bourse + damageTaken=0 + recomputeLoadout
qualités d'un objet (identified ou non) ─► registre/dispatch (combat) — INCHANGÉ
```

## Tests
- `appraisal.ts` : estimation ±10 % Rare/Exotique ; prix exact Commune/Limitée.
- `bargain.ts` : 1 / 0.9 / 0.8 (perdu / gagné / gagné DR≥6|Négociateur).
- `repair.ts` : 10 %/PA (2 PA perdus → 20 %) ; 30 % si brisé ; coût en PA.
- store : `appraiseItem` (succès → identified=true ; échec → reste) ; `bargain` (verrouillé 1×/transaction ; applique le facteur ; opposé) ; `repairArmour` (débit + damageTaken=0 ; refus si Bourse insuffisante) ; `buyItem`/`sellItem` intègrent le facteur de marchandage + sell RAW ¼–½.
- UI : MerchantPanelView affiche Marchander/Réparer/Évaluer ; un objet non identifié masque ses qualités.
- registre : 1-2 qualités magiques ADE2 chargées + appliquées (golden-combat couvre l'iso-comportement).
- Suite complète verte + golden-combat intact + typecheck.

## Hors périmètre
- Délai de réparation (« attendrez un certain temps » LDB 63) = #T3 (temps). Pour v1 : réparation instantanée.
- Jeu complet de qualités magiques ADE2 (au-delà des 1-2 démos) = contenu ultérieur.
- Contrefaçons / Évaluation côté vendeur (LDB 60 l.10) = ultérieur.
- Marchandage à la **Disponibilité** (+10/+20 % LDB 60 l.19, Carrière Marchand/Receleur) = ultérieur.

## Self-review
- **Couverture** : objet non-identifié (1), Évaluation #2e (2), Marchandage #2c (3, + fix resaleRate RAW), Réparation #2d (4), qualités magiques (5), UI (6) + tests. ✓
- **Pas de placeholder** : signatures (`identified`, `appraiseValueEstimate`, `bargainOutcome`, `repairCost`, actions store) ; RAW **cité** (LDB 60 l.10/12/22, LDB 63 l.97-98) ; qualités magiques = ADE2, extraites au plan (source identifiée).
- **Discipline** : `appraisal/bargain/repair.ts` purs ; store en état ; UI React ; **réutilise le registre de qualités** (zéro nouveau moteur magique), `partyBest`, le pattern modale/Test opposé, le skin légendaire existant.
- **Cohérence** : `identified` ne change PAS la mécanique (qualités toujours actives), seulement l'affichage — pas de divergence moteur/rendu. Sell aligné RAW (¼–½) remplace le 10 % v1.
- **Risque** : le talent Négociateur + la valeur de Marchandage du marchand doivent être lus proprement (acteur / archétype) ; le « 1 jet verrouillé par transaction » doit résister au ré-ouverture du panneau (drapeau sur l'état `merchant`).
