# 2ᵉ tour de chasse aux dettes — synthèse (programme #276)

> Artefact DATÉ (docs/plans/) — 2026-07-11. Supprimé une fois les lots exécutés. Base : 7 lentilles
> (registres générés, mort intra-fichier MESURÉ tsc, orphelins data, set()/net/server, QC+scénarios,
> tests-poison 2, chaînes i18n) + juge de synthèse avec re-vérification sur pièce.

## LE COMPTE (credo : doit décroître) — DÉCROISSANCE NETTE
1er tour : ~390 sites / 31 familles structurelles. Ce tour : **~150 sites / ~10 familles, quasi-tout P2, 2 P1**.
3 lentilles reviennent PROPRES après vérification adversariale : orphelins de données (0 P0/P1, tout câblé
Codex/moteur), registres générés (1 seul export mort), cœur des set() (netFlow/stateFields sains).
Le gisement structurel est ÉTEINT ; la dette restante est diffuse (hygiène), plus structurelle.

## P1 (traités en ronde immédiate — codeur dépêché 2026-07-11)
1. **Tokens de room prédictibles (CWE-338)** : `server/src/room.ts:30` (token HÔTE via Math.random), `:72`
   (reprise de siège), `index.ts:25` (code room). Fix : rand sur `crypto.getRandomValues` + garde grep
   `Math.random` interdit sous `server/src/**` hors tests.
2. **Garde qui ment** : `scripts/guards/lib/hardcode.mjs:29` — `TRAIT_TALENT_RX` omet `hasTalent\(`.
   4 sites au double poison (par-nom + par-label) lui échappent : `combatFlow.ts:3673` ('Diction
   instinctive'), `combatSlice.ts:2995` ('Harmonisation aethyrique'), `combatEffects.ts:770,774` ('Béni').
   Fix : regex étendue + baseline ; migration des 4 sites en DONNÉE = ticket dédié (grounding RAW requis).

## Lots P2 (tickets créés 2026-07-11)
- **L3+L5 hygiène** : ~50 imports morts `combatFlow.ts:61-155` + ~20 ailleurs (combat.ts:12-13,33,
  magic.ts:27, corruption.ts:19, items.ts:13, seaVoyage:27, store.ts:97, upkeep.ts:24, spawn.ts:5,
  massBattleFlow.ts:33, composeRig.tsx:1…) ; micro-cosmétique : `rocher.ts:9` hex→token,
  exports morts `APPENDAGE_OPTIONS`/`SPRITE_HEADROOM`, `net/session.ts:60` champ seat mort,
  convention `_s` rollFlowSpecs ×7.
- **L4 journal** : 18 occurrences `journal: [...slice(-40)]` dans 14 flows → action `log` unique
  (`store.ts:2117`) + quarantaine `.journal.slice(` hors de l'action.
- **L6 i18n** (ARBITRAGE USER requis avant chantier) : chaînes FR en dur hors catalogue — cibles denses
  MedicModal (~25), MassBattleView (~12), CascadeModal, validateScene (10), targetingModes (~15) ;
  le MOTEUR est propre. Mesure d'échantillon ~3-4 %, duplication non mesurée (risque de sur-compte).
- **P2 divers vérifiés** : `flowCore.ts:253` label-fallback objet custom = LÉGITIME, écrire le carve-out
  (1 ligne de doctrine) pour qu'il cesse d'être re-signalé ; tests par label pregen (42 occ / 16 fichiers)
  → helper `findPregen(id)` + interdiction, poser APRÈS migration des 16 fichiers.

## VERROUS 2ᵉ VAGUE (mandat user « étendre les classes verrouillées ») — avec moment de pose
| Classe | Mécanisme | Pose |
|---|---|---|
| hasTalent/hasTrait par-nom | TRAIT_TALENT_RX étendue + baseline | FAIT avec la ronde P1 |
| Math.random côté server | garde grep server/src | FAIT avec la ronde P1 |
| pregen-par-label (tests) | helper findPregen + ESLint no-restricted-syntax | après migration des 16 fichiers |
| journal.slice brut | quarantaine d'import vers l'action log | avec L4 |
| lookup [min,max] hors tables.ts | ESLint no-restricted-syntax hors engine/tables | avec #302 |
| export dupliqué difficultyFromModifier | test d'unicité (compte d'export) | avec #302 |
| sortByZ inline (12ᵉ composeur) | quarantaine d'import | à la prochaine touche rendu |
| écriture wounds/vessel hors seam | ESLint : `.wounds =` / `state.vessel.` en écriture hors shipDamage/seaVoyageFlow | avec #302 |
| anciens tokens CharKey | garde interdisant CC/CT/… en valeur de carac | FAIT de facto (grep #311) → pérenniser avec #302 |
| hardcode par-nom générique (sorts/maladies) | famille `id:'literal'` dans le scan hardcode | après recensement d'un lot |

## FAUX-DORMANTS (ne pas ticket)
brand nominal testOutcome, imports de contrainte structurelle, 3 mutations hors-tables mais référencées
(pattes-chevre/buveur-de-saumure/bosse-d-os), FK psychology/gods/careerLevels/trappings/spells : SAINES.

## NON COUVERT → 3ᵉ lentille à outiller (ticket créé)
- **Obtenabilité réelle** (LE gisement restant) : talents (179) / sorts (416) atteignables au Codex mais
  jamais OBTENABLES en jeu (aucune carrière/race/créature/source ne les confère) — à scripter.
- Exhaustivité id-par-id ICON_FAMILIES (~700) / SOUND / WEAPON / ARMOUR / TENUE_DEFS.
- ~48/54 scripts QC, ~27/29 scénarios, ~299/301 defs d'armes : grep-only.
- set() bruts des ~55 flows métier (resets ad hoc) vus seulement via grep journal.
- isBestial/hasPerturbingAura : même trou de couverture possible que hasTalent — re-vérifier.
