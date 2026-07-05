> ⚠️ **ARCHIVE (2026-07-05)** — document DATÉ : constat/plan d'époque, ne décrit PAS l'état courant du code.
> Conservé pour l'historique du raisonnement. Ne JAMAIS s'appuyer dessus pour juger l'architecture ou l'état actuel.

# Audit données `src/data/*.json` ↔ sources RAW — 2026-06-23

Audit de **complétude** (ce qui manque) + **fidélité** (prose verbatim règle 5, valeurs règle 1) des
tables du jeu contre les **15 livres RAW FR** autorisés (`docs/raw/sources.md`). **frenchy.bzh exclu**
(source fan, hors corpus). Méthode : phase auto déterministe (listes fermées LDB) + workflow 13 catalogues
(26 agents). Totaux bruts : **141 manquants · 28 « en trop » · 79 écarts de fidélité** — mais une partie
est du **bruit de périmètre** (trié ci-dessous).

## Verdict global

La donnée est **globalement fidèle et complète**. Les listes fermées du LDB sont **100 %** : Talents
138/138, Compétences 45/45, États 12/12. Carrières 87/87, Dieux 13/13, Espèces 23/23 (dans le corpus),
Signes astraux 20/20, Sorts 164/165, Maladies 9/9 (LDB), Mutations 40/40 (LDB) — **0 invention pure**
confirmée (sauf 1 candidat, `Rongeur`). Les vrais sujets sont concentrés et listés par priorité.

---

## P1 — Bugs de valeur réels (règle 1) — à corriger

1. ~~**Carrières — tirage Middenheim/Middenland/Nordland.**~~ **FAUX POSITIF (résolu 2026-06-23).**
   L'agent a comparé à la table Middenheim de la source, mais **le PDF Middenheim est erroné** : il
   liste les carrières dans l'**ordre alphabétique ANGLAIS**, pas français → les valeurs d100 de la
   source sont décalées. **Nos données ont déjà été corrigées à la main** par l'utilisateur ; le JSON
   est juste, la source est fautive. **Ne rien changer.** (Leçon : cf. mémoire
   `game-sources-pdf-errors-verify-case-by-case` — vérifier cas par cas, la source n'est pas une
   autorité aveugle.)
2. **Espèces — Hauts elfes : mauvais talent au choix.** JSON « Imperturbable **ou Sociable** » ;
   source LDB 05 « Imperturbable **ou Perspicace** ».
3. **Créatures — Cornu : `Soc` = null** au lieu de **1** (ZI). Valeur perdue.
4. **Maladies — Peste Noire :** sévérité `toxine: "moderee"` **inventée** (la toxine LDB n'a pas de
   gravité). **Infection du Sang :** `contractDifficulty: "tresFacile"` (+60) **non sourcé** (LDB ne
   prescrit aucun Test de contraction).
5. **Sorts — La lance d'Ambre :** mot « **uniquement** » supprimé (change le sens : « …à la première
   cible » au lieu de « uniquement à la première cible »).
6. **Objets — besicles :** desc **tronquée**, perd la phrase + la valeur de règle **« +20 »**.
   **« Huile de lampe »** = mauvais libellé (c'est la **Lampe à huile**, l'objet). **« Costume de
   cour »** devrait être **« Habit de cour »** (LDB).
7. **Talents — Vice :** desc tronquée (manque le paragraphe du Trait Vice). **Empreint de la Magie**
   (→ EDOC) et **Empreint d'Ulgu** (→ NADAJ Gnomes) tagués `LDB` à tort.
8. **Signes astraux — Les Deux Bœufs :** `apparence` = « un danseur tourbillonnant » (copié par erreur
   du signe suivant) au lieu de « deux bœufs ».
9. **Traits — `Rongeur` :** introuvable dans LDB 85 / EDO → **probable invention** (helper rats/skavens).
   À sourcer ou retirer.
10. **Talents — `Officier de Siège` :** stub **vide** (desc="", page 0), introuvable dans AA →
    probable résidu frenchy jamais converti. À retirer ou re-sourcer.

## P2 — Hygiène de sourçage (codes/corpus)

- **Espèces — 12 entrées « hors-corpus » — RE-VÉRIFIÉ cas par cas (2026-06-23) :** le verdict « toutes
  hors des 15 » était FAUX (cf. mémoire `game-sources-pdf-errors...`). En réalité :
  - **`SOC` ×4 (Norse)** → viennent de **MDG** *La Mer des Griffes* (ch.7 « PERSONNAGES NORSES » =
    bloc de création complet vérifié). MDG **est** dans les 15. → **re-sourcer `SOC`→`MDG`**, ne PAS
    supprimer. (Le « Nains (Norse) » : MDG décrit la création norse humaine ; statut nain à confirmer.)
  - **`ADE3` ×5 (districts d'Altdorf + Nain Altdorfer)** → **aucun Archives vol III FR** n'existe ; le
    supplément **Altdorf** (autorisé) a les quartiers (Hexxerbezrik…) mais **pas de bloc de création
    par quartier** trouvé → probablement extrapolation maison d'après la VO *Archives of the Empire III*.
  - **`Salzemund` ×3** → Salzenmund hors des 15 (pas de FR) → VO-only / maison.
  → Décision à reprendre : re-sourcer les 4 Norse vers MDG ; garder (homebrew assumé) ou retirer les
  ~8 variantes VO-only (Altdorf districts, Salzenmund).
- **Codes-livres à normaliser :** `NADJ` → **NADAJ** ; `MSR` → **T2** (Eusapia Balacañon vient en
  fait du **Compagnon T2 ch.7**) ; sorts/talents/traits de Tzeentch tagués `EDO` → **EDOC** (Compagnon).
- **Atlas :** `docs/raw/00-index.md` dit « 14 livres » → **15** (MDG ajouté le 2026-06-22).

## P3 — Complétude : ce qui manque (à arbitrer selon le besoin gameplay)

| Catalogue | Manque réel | Source | Note |
|---|---|---|---|
| **Mutations** | **~76** | EDO App.2 (6) + EDOC ch.8 (~70) | Le JSON ne couvre que LDB 19 (40). **Plus gros gap**, mais **déjà acté « non implémenté »** dans `corruption.md`. |
| **Créatures** | 14 | **MDG ch.16** (bestiaire marin) | MDG est autorisé mais son bestiaire n'a **jamais été extrait**. |
| **Créatures** | 4 | Middenheim ch.4 | Prédateur sanglant, Enfant d'Ulric, Spectre, Loup Blanc. |
| **Traits** | 5 | EDO App.2 | Absorption, Amorphe, Contagieux, Décérébré, Voleur de chair (= trait de Gideon). |
| **Objets** | 11 | AA (munitions de siège) | Les armes de siège sont là, pas leurs munitions. Faible enjeu si non jouables. |
| **Maladies** | 3 | T2C ch.14 | Colique, Vers de carie, Vers du Reik (parasites à cycle atypique). |
| **Sorts** | 1 | EDOC ch.9 | Transformation de Tzeentch (NI 10). |
| **Créatures (PNJ)** | ~23 | T3 ch.10-11, MDG | Dramatis personae / capitaines nommés. **Probable choix de design** (le jeu modélise le bestiaire, pas les PNJ de scénario). |

Hors périmètre demandé mais signalés : **Stromfels** (culte MDG, dieux), sorts MDG (6), talent ADE I
`Sang Neuf`, maladies EDO/MDG (Fièvre cérébrale pourpre, Mal de mer, Scorbut).

## P4 — Fidélité systémique (règle 5) — à arbitrer en POLITIQUE (pas item par item)

1. **Formatage Markdown retiré partout** (italiques/gras des desc). C'est le **design assumé**
   (`<Prose>` auto-lie les mots-clés en `CodexRef` au lieu de l'italique). Sous règle 5 stricte
   (« formatage conservé »), c'est un écart → **documenter l'exception** ou restaurer.
2. **« En flammes » vs « Enflammé »** + **« État » vs « États »** (sing./plur.) dans les desc de sorts
   et traits. Le JSON a normalisé vers le nom canon de l'État (LDB 16) ; la source du sort écrit
   « Enflammé ». Sémantiquement correct, littéralement non-verbatim.
3. **Créatures ZI (~62) : desc paraphrasées.** L'import curé a **réécrit** les encarts narratifs à la
   1ʳᵉ personne du Zoo Impérial en descriptions propres (Cornu, Sangsue Caméléon, Stégadon, Razorgor,
   Grand Cerf…). **Foyer principal de non-verbatim** si règle 5 stricte.
4. **Qualités « Objet » (LDB 60)** : Léger, Raffiné, Solide, Bâclé… toutes **condensées**, jamais verbatim.
5. **Artefacts OCR** dans le JSON (ancien pymupdf4llm) : « Peut- être », « pref ere », espace avant
   virgule (carrières), `U+FFFD` (« imm�diatement », Mabyn). La source Marker (2026-06-22) est propre →
   **re-synchroniser la prose** depuis Marker réglerait P4-5 + une partie de P1-6/7.

### Écarts de fidélité ponctuels (échantillon, règle 5)
gods Ulric « Middenheimet » (mots fusionnés) · gods Rhya title « festilité » (typo) · traits Hurlement
fantomatique/Nerveux « État »→« États » · traits Bestial/Fabriqué ajout « de créature » · traits Cornes
ordre des params · objets lotus-noir « État »→« États » · maneuvers souffle-corrosif/vomissement
corrodent « cuir » seul au lieu de toute armure+arme, souffle-froid Sonné forfaitaire au lieu de 1/5 PB,
langue-prehensile portée = BE inventée (limitations moteur auto-signalées).

---

## Faux positifs / bruit écartés

- **« En trop » créatures (6)** : Furie/Horreur rose/bleue (EDO ch.9), Destrier/Demigriffon adulte (AA),
  Eusapia (T2C ch.7) — **toutes réelles**, juste hors des chapitres bundlés du catalogue Atlas.
- **« Manque » MDG sorts/Stromfels** : hors périmètre demandé (MDG), signalés pour info.
- **gods « 3 sans label »** (mon alerte initiale) : **faux** — `gods.json` utilise `key`, pas `label` ;
  les 3 gnomes (Evawn/Mabyn/Ringil) sont corrects (Mabyn a juste un `U+FFFD`).
- Plusieurs réfs `source.page` dérivées (post-Marker) : connu, le **chapitre** reste juste.

## Limites de l'audit

Catalogues Atlas parfois **incomplets** comme référence (carrières AA, espèces Tiléens/Gnomes/Ogres,
sorts EDOC/Gueule, qualités, traits non-verbatim) → les agents ont rouvert `Source/` ; **l'Atlas est à
amender** sur ces points. `canonCount` parfois estimatif (OCR ZI/MDG bruité). Fidélité = **échantillon**
(6-10 entrées/catalogue), pas exhaustive.
