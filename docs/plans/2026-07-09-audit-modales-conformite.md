# Audit de conformité des modales & panneaux — 2026-07-09

> Rapport daté (politique docs/plans). Déclencheur : playtest utilisateur du 2026-07-09
> (« ces modales qui fonctionnent toutes à leur manière alors qu'on revient d'une refacto »).
> Inventaire exhaustif en lecture seule ; le CHANTIER (refonte + gardes) = vague 4 du programme #211,
> à décider avec l'utilisateur. Chaque classe traitée devra recevoir sa garde (credo).

## Verdict en une ligne
La mutualisation des modales de JET est réelle (~29 sur RollShell) et celle des modales de DÉCISION
aussi (~16 sur Modal+OptionChooser) — la douleur vient de 5 DIVERGENTS nommés (dont le négoce),
2 ORPHELINS de primitive (coquille plein-écran, onglets), ~83 hex hors tokens, et 3 trous a11y.

## Classification (preuves = imports + structure, fichier:ligne dans le corps du rapport d'agent)

- **CANONIQUE jet (RollShell, ~29)** : CrewTest (étalon multi), ShipManeuver, ShipBattery, Shanty,
  Cascade, Cast, Heal/Medic, Disengage, Grapple, AuContact, ForceDoor, Battement, Distraire,
  Maneuver, Approach, Ward, Run, Frenzy, Focus, Dispel, Reload, HandGate, StateRecovery, SteamSave,
  Corruption, Bargain, Appraise, Activity… Garde `assertActionVocabulary` au choke-point.
- **CANONIQUE décision (Modal + OptionChooser/ChoiceButtons, ~16)** : ManannPriest, ShoreLeave,
  Renounce, MountTarget, FateSave, TavernGame, Loot, Rest, Reveal, Document, Options, SessionEnd,
  SaveLoad, HouseRules, TravelRecap.
- **SEMI-CANONIQUE (squelette .modal + useModalA11y, sanctionné par Modal.tsx l.27)** :
  CharacterSheet, ShipSheet, InspectPanel, CompendiumScreen, Editor.
- **DIVERGENT (5)** :
  1. `MerchantPanel.tsx:549` — coquille hand-rollée SANS useModalA11y/role=dialog ; MAIS contenu =
     RÉFÉRENCE de qualité (Coins par ligne, panier+total courant, unaffordable stylé, fiches
     comparatives ▲▼, marchandage à effet explicite) — répliquer le contenu, réparer la coquille.
  2. `PortView.tsx:64,134-188` (Cargaison/négoce) — LE cas utilisateur : prix total d'achat
     UNIQUEMENT dans le `title` du bouton (l.157, invisible), « CO » en texte brut sans <Coins>,
     bouton Acheter dans la cellule (chevauchement), onglets maison, pas de panier/total. Cahier
     des charges : les motifs du MerchantPanel. → #228 escale-hub.
  3. `SeaActivitiesModal.tsx:51-74` — toggles de boutons à la main là où OptionChooser grid couvre.
  4. `PartyScreen.tsx:123,467` (CampaignSelect ×2) — .modal hand-rollé SANS a11y (Échap/focus).
  5. `DialogueBox.tsx:43` — choix codés main (prix/condition) ; proche ChoiceButtons, à évaluer.
- **ORPHELINS (2 besoins sans primitive)** : coquille d'ÉCRAN plein-écran (`.worldmap-overlay`
  partagée de facto par WorldMapView/PortView/LandMarket/MassBattle/Interlude/Victory/defeat —
  aucune primitive head+close+body) ; onglets (3 systèmes — écarté PAR DÉCISION, cf. CLAUDE.md).
- **HORS-CHARTE** : ~83 hex hors :root sur 11 modules css (combat-ui 28, combat-modals 11, hud 11,
  codex-edit 10, sheet 6, editor 5…, merchant #fff/#7fd6a0) — tri rgba-voile/hex-réel à faire.

## Gardes proposées (à écrire DANS le chantier vague 4, une par classe)
1. Registre ActiveModal : chaque composant monté importe Modal ou RollShell (scan d'imports).
2. `modal-overlay` interdit hors Modal.tsx + whitelist explicite des 5 semi-canoniques
   (généralisation de `Editor.test.tsx:45`) — MerchantPanel/PartyScreen tombent → décision.
3. `role="dialog"` ⇒ useModalA11y obligatoire (attrape PartyScreen).
4. Hex hors tokens : garde CSS avec budget décroissant (patron du chantier emoji).
5. Prix ⇒ <Coins>/formatMoney (heuristique « CO/PA/CA » accolé à une valeur, à calibrer).

## Non couvert
Corps de ~30 modales classées par imports seuls ; écrans plein-écran non ouverts ;
src/ui/editor/** et creator/** hors périmètre ; tri rgba/hex par module à faire.

## Cas 6 (constat utilisateur post-audit) — proéminence des actions NON normée DANS le canon
Même à l'intérieur des modales RollShell unifiées : `RollAction` porte sa clé de style au call-site
(`ACTION_CLASS` primary/ghost/resource, `RollShell.tsx:43`) → le MÊME « Tout lancer » est rouge
(primary) dans une modale et fond-de-modale (ghost) dans une autre, au choix de l'appelant ; tailles
de modale non gabarisées. Fix (vague 4) : la proéminence se DÉDUIT du rôle de l'action (clé) dans
RollShell — les appelants ne choisissent plus ; règle de charte + extension de la garde des verbes.
