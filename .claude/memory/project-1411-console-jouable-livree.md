---
name: project-1411-console-jouable-livree
description: "#1411 Console jouable FERMÉ 2026-08-23 (tronc f4834726) : les 12 classes ActionBar→console ont leur surface, SANS_SURFACE = {} et CHANTIER_BRANCHEMENTS_OUVERT = false ; restes = arbitrages #1434 (grimoire >12 cases), #1476 (Échap), #1477 (off muet), #1471, #1453, #1487"
metadata:
  node_type: memory
  type: project
  originSessionId: 3c1689ae-eeaa-4da2-a83f-c35ecef5c557
  modified: 2026-08-23T21:02:08.995Z
---

Programme #1411 fermé le 2026-08-23 (solde au ticket). Jalons sur main : P0 `2fdea0fa` · P0-B `c0527f54` · P1 `f247f2f4` · G5 `57530cc6` · ActionBar morte `160a018c` (−1 677 l.) · P1-7+gates cible `c62c028e` · P2-A coop/fin-de-tour `f929d002`+`593d372` · P2-B Focaliser `9f069b3d` · P2-D aperçu coût/palier `cfa52890` · P2-C pastilles `f4834726`.

Acquis structurels réutilisables : `offresDuRegistre(surface, ctx)` + `ACTION_PORTEURS` ([[game-arbitrage-hud-console-rt-2026-08-16]] — le registre offre par candidat, console ET monde) ; surfaces du registre TOUTES consommées (`grille`/`deduite-du-set`/`geste-d-etat`/`pastille-etat`/`interlude`/`geste-secondaire`/`pastille-entite`/`frise`/`bandeau-de-phase`/`gouttiere-arche`/`coin-de-tour`/`selecteur-de-sets`) ; porte unique par GESTE (`runAction` — round-start, end-turn deux temps via `endTurnGuard`) ; `withAttackerAt` (aperçu = jet commis) ; `viewBoxUnitPx` (taille écran constante — le chrome PV/États ne l'utilise PAS encore) ; `useLongPress`, `ReadyRow`, `PastilleEntite`, `__wfrp.pickTileAt`.

Règles re-vérifiées au Source pendant le chantier : LdV de Distraire = invention retirée (LDB 10 l.364, AA 13 l.51) ; Engagement de Battement = RAW (LDB 13 l.114) ; Focalisation = Compétence avancée (LDB 09 l.30) ; `outOfRencontre` = état de la rencontre (LDB 17 l.31/35), remis à zéro au teardown ; Sonné pousse un engin (Action interdite, Mouvement à moitié) ; paliers de Difficulté = LDB 12 l.141-151 (« Intermédiaire », pas « Moyen »).

Restes actifs : arbitrages utilisateur #1434 (travées/écran de capacités Zone 6), #1476 (Échap : pile de couches), #1477 (`off` muet), #1471 (Échap zone), #1453 (IA 2 armes), #1487 (Charge montée), #1420/#1427/#1445 (antérieurs). Voir [[feedback-gate-de-lot-couvre-tous-les-consommateurs-du-registre]].
