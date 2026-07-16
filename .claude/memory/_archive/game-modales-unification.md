---
name: game-modales-unification
description: Unification des modales sur la coquille riche partagée (4 lots livrés 2026-06-10) — fin du custom
metadata: 
  node_type: memory
  type: project
  originSessionId: 9a11e89d-0497-4b0f-9249-26b8c86eb6bd
---

Demande forte de l'utilisateur : « **À mort les modales custom mal foutu** », « **Attaque/Défense c'est la base, on a presque tout dedans** », « **il ne faut pas dupliquer la logique de Détermination** ». Livré en 4 lots (branche `feat/wfrp4-rpg-foundation`, suite verte ~1996 tests) :

- **LOT 1** (`b15e46a`) — Attaque/Défense : UNE seule ligne d'issue, style journal (la verdict dupliquait le log). Composant partagé `NarratedLine.tsx` (`NarratedSegments`/`JournalLine`) ; dédup du LogDrawer.
- **LOT 2** (`c286a7f`) — PsychModal ET EncounterPsychModal sur `RollFlowShell` (fin du rendu bespoke « 52 / Toujours apeuré »). Résolveurs de Calme renvoient `target`+`sl` → `RollLine` riche. `RollLine` extrait dans son module. `CIBLE_LABEL`+`calmeBreakdown` partagés (`psychLabels.ts`). **Détermination = prop 1re classe de la coquille** (`determination`), action store dédupliquée via `spendResolveForPsychImmunity` (engine/psychology), tooltip non spécifique à la Peur, affichée AVANT le jet.
- **LOT 3** (`83c5522`) — **Déviation critique fusionnée sur la modale du Coup Critique** : le Critique est PRÉ-TIRÉ (graine figée) et affiché via `CriticalBody` (extrait de RevealModal, partagé) AVEC le choix Dévier/Subir, sur UNE modale. `applyCriticalToTarget(prerolled, suppressReveal)` ; `previewCritEntry` (révélation sans muter). « Subir » applique CE Critique sans re-tirer ; « Dévier » −1 PA l'ignore.
- **LOT 4** (`162d228`) — **Panier de VENTE marchand** (#22b, parité achat) SANS dupliquer l'achat : prix de revente centralisé dans `sellGain` (réutilisé sellItem/confirmSell/UI), retrait dans `removeSold`, UI réutilise les briques `cart-*`.

Coquille enrichie = `RollFlowShell` props additives : `breakdown` (RollLine | RollBreakdown[] pour les opposés), `outcome` (JournalLine), `determination`.

**2026-06-10 (suite) : migration TERMINÉE + voie legacy SUPPRIMÉE** (commits f2c82f5, a80d610) : les 10 flux restants (test/reload/focus/run/frenzy/bargain/appraise/recover/heal/trample) sont sur breakdown+outcome via helper partagé `src/ui/breakdown.ts::testBreakdown` (généralise calmeBreakdown ; étiquette la Difficulté en mod) ; `result`/`resultOk`/`.test-result` retirés de la coquille (la classe CSS sert encore aux modales hors coquille : Fumble/Reveal/Disengage). Moteur : resolveRun/resolveFrenzyEntry/resolveFocus exposent `target` (+`sl`) — additif, testé ; les derives Résilience pré-jet le préservent. Marchandage : jet marchand OPAQUE (dé+DR dans l'outcome, jamais sa cible). #23 complété : DrBar sur Focalisation et Rechargement. **Dé d100 ANIMÉ** : `src/ui/Dice.tsx` (le nombre roule ~0,5 s puis se pose ; rendu initial = valeur finale → SSR/tests stables ; prefers-reduced-motion ok), branché RollLine + Cast/Disengage/Fumble/Reveal.

**2026-06-12 : fusion du CYCLE DE VIE terminée (e027a74)** — l'unification UI avait laissé
Attaque/Défense/Incantation/Désengagement avec leur cycle Chance/Pacte/Résilience copié-collé
dans le store → divergence repérée par l'utilisateur (« pourquoi seules certaines modales… ») :
le choix du dé forcé (LDB 17 l.73) n'existait que sur l'Attaque. Correctif : 4 specs
`attack/defense/cast/disengage` dans `rollFlows.ts` (~230 lignes sur mesure supprimées du store,
câblage une-ligne `FLOWS.x.*`, mêmes noms d'action → UI/intents intacts). `rollFlow.ts` :
`resolve`/`reresolve` reçoivent `get` ; `forceRoll` (dé choisi) + drapeau `forced` génériques ;
sélecteur partagé `ForcedRollPicker` (11 = plus bas double → Critique, PAS le plus haut) rendu
par la coquille (`forcedRoll` prop) et les 3 modales riches. Restent métier PAR CONCEPTION :
jets initiaux d'attaque (Sonné/hors-portée/déviation), d'incantation (wards, Surincantation IA,
Contre-sort) et de désengagement (phase), + les `xConfirm`. **Règle : tout nouveau comportement
de jet se code dans `rollFlow.ts`/la spec, JAMAIS dans une modale ou une action sur mesure.**

Prolonge [[game-roll-modal-pattern]], [[game-jet-modale-exhaustif]], [[game-combat-events-structures]], [[game-marchand-v1]], [[game-resilience-prejet]].
