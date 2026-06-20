# Audit data-driven — îlots de code (sémantique de jeu en TS au lieu de JSON)

Exigence : **toute sémantique/contenu de jeu vit dans le JSON** (`src/data/*.json`), le moteur ne
fait que lire/appliquer ; les `defs/` sont réservés au **rig/SVG**. Cet audit (3 agents + recoupement,
juin 2026) recense les îlots restants. **Verdict : le dépôt est très majoritairement data-driven**
(traits/`combatFeatures` à 100 % via `capabilities`/`passive` ; effets de sorts 393/393 dans
`spells.json.effects` ; mutations/création/criticals/oups dérivés de JSON). Restent des îlots bornés.

## État

| # | Îlot | Fichiers | Sévérité | État | Migration |
|---|---|---|---|---|---|
| 1 | Parsers Psychologie | `engine/psych/defs/*.ts` (9) + round-trip `parsePsychTraits` | Haute | ✅ FAIT | `capabilities` psy (`psychType`/`psychImmune`/`psychIndice`) dans `traits.json` ; lecture `id`/`value`/`arg` ; `defs/` supprimés |
| 3 | Tables d100 Imparfaite/Colère | `engine/miscast.ts:101-207` | Haute | ✅ FAIT | `src/data/miscast.json` ; miscast.ts = types + chargement + résolution |
| 6 | Table coût PX | `engine/advancement.ts` | Moyenne | ✅ FAIT | `src/data/advancementCosts.json` |
| 7 | Mod de tir / Taille | `engine/size.ts` | Moyenne | ✅ FAIT | `src/data/sizes.json` |
| 2 | Dégâts/Missile de sort par regex sur `desc` | `engine/magic.ts` (`parseSpellDamage`→`missileDamage`, `isMagicMissile`) | **Haute (BUG)** | ✅ FAIT | champs `missile`/`damage`/`ignorePA`/`ignoreBE` dans `SpellData`/`SpellLike` ; 32 sorts taggés (comportement préservé) ; **FIX `broyeur-d-os`** (Dégâts 4 + ignore PA). Suivi : modèle « Dégâts FIXES » des sorts frenchy (« 10 Points de Dégâts ») non géré (additif) ; classement IA des missiles BFM — à trancher séparément. |
| 4 | Effets de création de Talent | `engine/talentEffects.ts` `addCharacteristic`/`addSkill`/`addTalent` | Moyenne | ✅ FAIT | `addCharacteristic` ÉLIMINÉ : +5 carac/+1 Mvt → `charMod`/`moveMod` continus (collecteur) ; wounds/fortune/resolve → `attrMod` ; addSkill → `grantCareerSkill` ; Âme pure (corruption) = `combat.corruptionThreshold`. Résiduel assumé : `addTalent` (Flagellant) = ref AFFICHÉE seulement (octroi permanent = feature à part). Champs de TYPE vestigiaux `addCharacteristic?/addSkill?` à retirer au rebuild registry (Partie 3). |
| 5 | Métadonnées de spec de sort en TS | `src/data/spellspecs/*.ts` (30 fichiers, 228 entrées) | Moyenne (volumineux) | ⏳ À FAIRE | `durationRounds`/`zdeRadiusMeters`/… → champs `SpellData` ; supprimer les .ts |
| 8 | Seuil Corps/Esprit par espèce | `engine/corruption.ts:101-105` | Basse | ⏸️ DIFFÉRÉ | 4 valeurs, match par sous-chaîne couvrant 35 variantes — migrer dupliquerait la valeur ×35 ou inventerait une table de groupe ; code = mapping de règle LDB documenté, non éditable. À confirmer. |
| 9 | Paliers d'Encombrement | `engine/encumbrance.ts:46-52` | Basse | ⏸️ DIFFÉRÉ | 3 paliers dont un `Infinity` (non-JSON) ; faible ROI, code clair (constantes LDB). À confirmer. |

## Faux positifs (NE PAS migrer — code légitime)

Algorithmes de résolution (`resolvePeur`, dégâts, incantation) ; parsers de **format** (`statEntry`,
`size`/`magic` range/duration — décodent un format, pas un effet) ; maps de libellés FR (affichage) ;
`clock` (calendrier lore) ; `DIFFICULTY`/`PASSIVE_CANCELLERS` (schéma/méta-moteur) ; `spellspec.ts`
métadonnées de **résolution** (géométrie ZdE/opposition) ; `talentEffects.ts` lectures de données
(`passive`/`combat` déjà data-driven — seuls `addCharacteristic`/`addSkill`/`addTalent` restent, cf. #4).

## Patron de migration (éprouvé)

1) champ en JSON (source de vérité) + au type (`index.ts`) ; 2) le lecteur lit le champ ;
3) **supprimer** le code/regex/def (zéro back-compat, zéro mort) ; 4) suite **verte**. Format JSON
canonique obligatoire : `JSON.stringify(data, null, 2)` sans newline finale (garde-fou `serialize.test.ts`).
