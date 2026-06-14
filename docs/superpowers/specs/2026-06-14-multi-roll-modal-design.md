# Conception — Modale de jet MULTI-PARTICIPANTS (générique)

## Problème

Le système de jet différé (« un jet = une modale ») est **mono-acteur** : `makeRollFlow` +
`RollFlowShell` gèrent UN jet, avec UN cycle Chance/Pacte/Résilience/relance. En parallèle,
`MultiRollList` affiche N jets… mais **en lecture seule, sans relance** (« jets d'entretien »).

De vrais cas réclament **N participants qui lancent chacun leur jet, chacun avec son propre cycle
d'influence** :

- **Contre-sort à plusieurs** (RAW, LDB 46 l.207 : *« Plusieurs lanceurs de Sorts tentant de
  dissiper le même Sort effectuent leur lancer séparément »*) — chaque dissipateur oppose son
  Langue (Magick) au jet ennemi figé ; n'importe quel succès dissipe.
- **Forçage de porte à plusieurs** (Test assisté/cumulé de Force/Athlétisme) — futur.
- **Bilan de Round / de nuit** (existe via `MultiRollList`) — aujourd'hui sans relance ; certains
  jets (récupération, Test de Calme) DEVRAIENT être influençables par la Chance.

## But

UNE capacité générique de jet multi-participants, paramétrable, qui **subsume** `MultiRollList` :
chaque rangée est un jet pouvant être **interactif** (son Lancer + Chance/Pacte/Résilience/relance)
ou **témoin** (lecture seule = cas dégénéré). Réutilisable, zéro flux parallèle.

## Décisions verrouillées (avec l'utilisateur)

- **Disposition : rangées parallèles.** Tous les participants visibles ; chaque rangée porte son
  jet et ses propres boutons d'influence. (Pas de séquentiel.)
- **Réaction type défense.** L'adversaire (sort ennemi, Difficulté de la porte) a son jet/contexte
  FIGÉ ; nos participants réagissent. Si aucun participant possible → pas de modale interactive,
  **révélation brève**.
- **Pas de duplication.** On réutilise la coquille `RollFlowShell`, la fabrique `makeRollFlow`
  (plomberie d'influence extraite et partagée), `OptionChooser` (sélection multi), et les
  résolutions métier existantes (`applyCounterspell`…).

## Modèle d'état

Le `Pending<Multi>` porte un tableau de participants + le contexte partagé figé :

```ts
interface RollSlot {            // l'état d'UN jet (réutilisé mono ET multi)
  result: ... | null;          // null = pas encore lancé
  rerolled?: boolean;
  forced?: boolean;            // Résilience (LDB 17 l.73)
}
interface RollParticipant extends RollSlot {
  id: string;                  // combattant qui lance
  label?: string;              // libellé de rangée (sinon nom)
  interactive?: boolean;       // false = rangée témoin (lecture seule, type MultiRollList)
}
interface PendingMulti {       // ex. PendingCounterspell
  participants: RollParticipant[];
  // … contexte partagé FIGÉ propre au flux (jet ennemi, Difficulté de la porte…)
}
```

`MultiRollList` (bilan de nuit) = `participants` tous `interactive:false`.

## Fabrique (`makeRollFlow` généralisée — sans duplication)

La plomberie d'influence (Chance « +1 DR », relance propre-ratée 1×, Bénédiction de Chance gratuite,
Sombre Pacte, Résilience `forceSuccess`/`setForcedRoll`) est **identique** par jet — qu'il soit seul
ou dans un groupe. On l'**extrait** en helpers opérant sur un `RollSlot` + son `actor`, partagés
par :

- la fabrique mono (slot = le pending entier) — comportement **inchangé** (N=1) ;
- la fabrique multi (`makeMultiRollFlow`) — slot = `pending.participants[pid]` ; les handlers
  générés prennent un **id de participant** (`roll(pid)`, `reroll(pid)`, `bonusSL(pid)`,
  `darkPact(pid)`, `forceSuccess(pid)`, `setForcedRoll(pid, n)`).

Spec multi additionnelle :

```ts
interface MultiRollFlowSpec<P> {
  key; rolled(slot); actor(s, p, participant);
  resolve(s, p, participant, actor, get, forced?): Partial<RollSlot> | null;  // résout UN participant
  failed(slot); bonus?; caps?;                                                // idem mono, par slot
  aggregate(s, p): { outcome; …; canApply: boolean };                         // combine les N → issue
}
```

`aggregate` = le métier de groupe : Contre-sort → dissipé si **un** participant gagne l'opposition ;
porte → DR cumulé/assisté ≥ seuil. `canApply` = tous les participants requis ont lancé (ou « Laisser
passer »).

## Coquille (`RollFlowShell` → N rangées)

`RollFlowShell` apprend à rendre **une liste de rangées de participant**, chacune = mini-cycle
d'influence (Lancer / Chance / Pacte / Résilience / relance) OU témoin (RollLine seule). Le flux
mono reste **un cas à 1 rangée** (aucun changement visuel/comportemental). La rangée de participant
est une sous-primitive partagée (réutilisée par `MultiRollList`, qui disparaît au profit d'elle).

## Sélection (`OptionChooser` multi-select)

Quand le flux est multi, `OptionChooser` passe en **multi-select** : « qui participe ? » (héros
contre-lanceurs éligibles, héros qui poussent la porte…) + une option « Laisser passer / Renoncer »
(= aucun participant → l'adversaire l'emporte / le sort se résout).

## Consommateurs

1. **Contre-sort à plusieurs** (`FLOWS.counterspell`) — 1er consommateur interactif :
   - `castSpell` (lanceur ENNEMI) : le moteur **roule l'incantation** (plus de « Lancer » joueur),
     fige le résultat.
   - `counterspellCandidates` (déjà écrit) → héros éligibles (Langue Magick, portée FM, LdV).
   - **≥1 éligible** → modale multi : rangées = héros choisis (multi-select) ; chacun oppose son
     Langue (Magick) via `resolveCounterspell`/`applyCounterspell` (déjà écrit) ; `aggregate` =
     dissipé si un gagne. « Laisser passer » = le sort se résout (`applyCast`). Reprise IA.
   - **0 éligible** → pas de modale : **révélation brève** (`pendingReveals`) + tour IA continue.
   - Supprime le chemin témoin « Lancer le dé ennemi » + le Contre-sort enfoui dans `postRollExtra`.
2. **Bilan de Round / nuit** — `MultiRollList` migre sur la rangée de participant partagée ; les
   jets RAW-influençables deviennent interactifs (relance Chance). Le reste reste témoin.
3. **Forçage de porte à plusieurs** (futur) — `FLOWS.forceDoor` : participants = héros poussant ;
   `aggregate` = Test assisté/cumulé.

## Étapes d'implémentation

- **Étape 1** — Cœur générique : extraire la plomberie d'influence en helpers `RollSlot` ;
  `makeMultiRollFlow` ; rangée de participant partagée dans `RollFlowShell` ; faire passer
  `MultiRollList` dessus (témoin). N=1 mono **inchangé** (suite verte = garde-fou).
- **Étape 2** — `FLOWS.counterspell` + `CounterspellModal` + rework `castSpell` (pré-roll, aiguillage
  modale/révélation). Tests unitaires + recette navigateur (scénario `pieuvre-lanceur`).
- **Étape 3** — Migration des jets de Round/nuit influençables sur la capacité (relance gagnée).
- **Étape 4** (différé) — `FLOWS.forceDoor`.

## Garde-fous

- `roll-modal-invariant.test.ts` (statique) doit rester vert : tout jet a sa modale.
- La suite (3280) verte après chaque étape ; N=1 mono ne doit montrer **aucune** différence.
- Fidélité RAW : `aggregate` du Contre-sort cite LDB 46 l.201-202/207 ; aucune règle inventée.
