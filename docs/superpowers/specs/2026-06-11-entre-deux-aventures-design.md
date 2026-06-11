# Entre deux aventures — Événements, Activités, Artisanat (design)

**Sources RAW** (lues 2026-06-11) : `22 - Événements.md` (séquence + Tableau des Événements d100),
`23 - Activités.md` (cadre 1/semaine max 3, Activités générales + de Classe, Faveurs),
`60 - Fabrication.md` (qualité d'artisanat — DÉJÀ livrée via le registre des qualités ; le
« crafting » réel est l'Activité **Artisanat** du ch.23), `09 - Compétences.md` l.343 (Métier).

**Ce que couvre ce design** : le dernier gros morceau du Jalon 5 — « fabrication » (= Activité
Artisanat) et « activités entre aventures ». Tout vient des ch.22-23 ; rien d'inventé, les
arbitrages jeu-sans-MJ sont listés en §7.

---

## 1. Séquence RAW (ch.22 l.12)

« Déterminer un Événement aléatoirement → dépenser tout l'argent (Argent à gaspiller) →
Activités → résoudre les conséquences → prochaine aventure. »

En jeu : un **interlude** est déclenché par le contenu (Effet d'éditeur, §6) avec une durée en
semaines. Phases de l'écran :

1. **Événement** — 1d100 par héros sur le Tableau des Événements (révélation par héros,
   « un jet = une modale » assoupli : une carte-événement par héros sur l'écran).
2. **Activités** — chaque héros dispose de `min(3, semaines)` Activités (RAW ch.23 l.6 :
   1/semaine, max 3 quel que soit le temps). Résolution héros par héros (hotseat).
3. **Clôture — Argent à gaspiller** (ch.23 l.14) : l'argent NON sécurisé disparaît. Récap puis
   retour à la campagne.

## 2. Activités V1 (mécanisées)

| Activité | RAW | Mécanique |
|---|---|---|
| **Revenus** | ch.23 l.174-181 | Gagner le revenu standard du Statut (LDB 08, « Gagner de l'argent grâce au Statut ») — Test de compétence de carrière Intermédiaire ; crédité au DÉBUT de la prochaine aventure (après le gaspillage). Maintient le Niveau 3-4 (« Avec le pouvoir », l.30 : niveaux 3-4 sans Revenus → −1 Niveau de carrière, gratuit, Statut réduit). |
| **Artisanat** | ch.23 l.65-92 | Prérequis : Compétence **Métier** appropriée (≥1 avance) + matériaux = **¼ du prix** payés à l'engagement. **Test ÉTENDU de Métier** : Difficulté par Disponibilité (Commune +20 / Limitée +0 / Rare −10 / Exotique −30), DR cible par gamme de prix (Bronze 5 / Argent 10 / Or 15+), **chaque Défaut ÷2 le DR requis, chaque Atout +5 (après Défauts)**. **1 jet par Activité** ; travail inachevé CONSERVÉ (reprise à l'interlude suivant). Achevé → `itemFromTrapping` (+ Atouts/Défauts choisis) chez le héros. |
| **Apprentissage particulier** | ch.23 l.58-63 | Talent HORS carrière : coût tuteur **2d10 pa / 100 PX** du talent + le coût PX ; **Test Difficile (−20)** de la Caractéristique/Compétence la plus pertinente (V1 : la Caractéristique du talent s'il a un `char`, sinon Int) ; échec = PX/argent perdus, **+10 par tentative ratée** (compteur persistant). |
| **Entraînement** | ch.23 l.121-124 | Avance hors-carrière de Compétence de base/Caractéristique : coût PX normal **+ 1d10 sc × (PX/10 ?)** — RAW : « PX + 1d10 sous de cuivre, où PX est le coût d'achat » (lecture : autant de sc que 1d10, par Augmentation) ; Compétences Avancées : **tuteur ×2**. ⚠ Audit à l'implémentation : aujourd'hui `advancement.ts` autorise le hors-carrière ×2 SANS Activité — vérifier LDB 07 « Progrès » et, si le RAW l'exige, réserver le hors-carrière à cette Activité (changement de comportement à signaler). |
| **Opérations bancaires** | ch.23 l.154-165 | **Investir** (Statut Or/Argent) : choisir/lancer l'Indice 1-10 = % d'intérêts ET risque ; **retirer** (une autre Activité, ou plus tard) : d100 ≤ Indice → faillite (tout perdu), sinon capital + intérêts. **Planque** (tous) : pas d'intérêts, retrait SANS Activité ; d100 ≤ 10 au retrait → perdu. L'argent déposé échappe au Gaspillage. |
| **Changement de carrière** | ch.23 l.94-97 | Expose l'action moteur existante (gratuit si carrière complétée, sinon 100 PX) comme une Activité. |
| **Passer commande** | ch.23 l.167-172 | Objet **Exotique** : payer maintenant (prix listé), reçu **au prochain interlude** (file `pendingOrders`). 1 objet/Activité. |
| **Entraînement au combat** (Classe) | ch.23 l.190-192 | Test de CC/Projectiles Intermédiaire (+1 cran plus dur hors Guerriers/Itinérants) → succès : **1 inversion de Test** de la compétence pour la prochaine aventure (drapeau consommable, pattern `freeReroll`). |

## 3. Activités V2 / différées (journalisées si choisies — rien d'inventé)

Consulter un expert (Relance experte — dépend d'un contenu d'« information » à fournir),
Invention (Planifier+Construire — combinaisons libres = arbitrage), Dressage (pas de système
d'animaux hors montures), Dernières Nouvelles / Observer une cible / Recherche de savoir
(rumeurs/infos = contenu MJ), Réputation (Standing temporaire — V2 simple possible), Semer la
dissension (2 Activités, effets d'aventure narratifs), Faveurs (ardoise narrative). **V1 : ces
cartes sont visibles mais grisées « non modélisée »** — le joueur sait qu'elles existent.

## 4. Tableau des Événements (ch.22, d100) — V1

Entrées MÉCANISABLES appliquées automatiquement, le reste journalisé verbatim (arbitrage table) :
- 22-25 Le Prévôt arrive : **−30 % de l'argent** avant Activités.
- 26-29 Fausse monnaie : banque/Revenus **−20 %**.
- 30-33 Profits abondants : Revenus **+50 %** (Riverains).
- 34-36 Un homme averti : **+1 Chance max** pour la prochaine aventure.
- 37-40 Festivités : **−1 Activité**.
- 01-03 / 04-06 / 07-10 / 11-14 / 15-18 / 19-21 / 41+ : narratifs ou conditionnels MJ →
  **journalisés** (texte verbatim) sans effet mécanique inventé. (Relire l'intégralité du
  tableau à l'implémentation — seule la moitié est listée ici.)

## 5. État & données

- `GameState.interlude: { weeks; phase: 'event'|'activities'|'closing'; current: number;
  perHero: Record<heroId, { event?: {roll, label, applied: string[]}; left: number;
  craft?: { label; drDone; drTarget; difficulty; spent: boolean } ; trainFails?: Record<string, number> }> } | null`
- `GameState.bank: { heroId; kind: 'invest'|'stash'; amount: Money; rate?: number }[]` —
  SURVIT à l'interlude (et voyage dans la save — gratis, clés de `getInitialState`).
- `GameState.pendingOrders: { heroId; trapping: string }[]` — livrés à l'interlude suivant.
- Moteur pur : `src/engine/activities.ts` (calculs sourcés : DR d'artisanat, coûts, banque,
  revenus par Statut) + table Événements `src/data/interludeEvents.ts` (verbatim, manuscrite —
  même statut que criticals.ts/oups.ts).

## 6. Déclenchement (contenu = donnée)

Nouvel **Effet d'éditeur** `{ type: 'interlude', weeks: number }` (EffectList) — le créateur de
campagne le pose en fin de chapitre. Avance l'horloge de `weeks` semaines à la clôture.
Un scénario de test « 16-interlude » l'exerce.

## 7. Arbitrages jeu-sans-MJ (documentés)

1. **Argent à gaspiller** : la bourse est PARTY-LEVEL → le gaspillage frappe la bourse du
   groupe à la clôture ; seuls les dépôts bancaires/planqués (par héros) survivent + les
   Revenus crédités après coup. L'UI l'annonce AVANT (pas de piège silencieux).
2. **Difficulté/Disponibilité d'artisanat** : « fixée par le MJ » → dérivée mécaniquement de la
   Disponibilité et du prix listés (tables RAW ci-dessus), Atouts/Défauts choisis à l'engagement.
3. **Matériaux** : « ¼ du prix, Disponibilité décidée par le MJ » → achat direct (pas de test de
   Disponibilité — simplification V1 documentée).
4. **Événements narratifs** : journalisés verbatim, aucun effet inventé.
5. **Elfes** (ch.23 l.50) : −1 Activité si ≥ 3 semaines (« contact avec leur race »), journalisé.

## 8. Tests

- engine/activities : DR d'artisanat (gammes + Atouts/Défauts), coûts d'apprentissage (2d10 pa),
  banque (faillite ≤ Indice ; planque ≤ 10), revenus par Statut — seedés.
- state : flux complet d'un interlude 3 semaines (événement → 3 activités → gaspillage),
  artisanat multi-interludes (travail conservé), banque dépôt/retrait, ordre Exotique livré.
- UI : smoke test de l'écran.

## 9. Découpage (plan d'exécution)

P0 moteur pur + données événements → P1 état interlude + Effet éditeur → P2 UI écran (3 phases,
modales de jet via la fabrique rollFlow) → P3 activités V1 restantes (banque/commande/combat) →
P4 « Avec le pouvoir » + elfes + recette. Détail : plan du même jour.
