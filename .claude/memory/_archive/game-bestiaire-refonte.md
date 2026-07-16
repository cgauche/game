---
name: game-bestiaire-refonte
description: "Jalon 8.5 — refonte esthétique du bestiaire non-humanoïde (validé : « tous affreux ») ; lot 1 quad livré ; lots 2-4 = ailes+anims de capacités (Bond/Vol), props de finesse, passe par créature"
metadata: 
  node_type: memory
  type: project
  originSessionId: dbb7bc70-76e7-4534-b7a5-d556ce0815d1
---

**Chantier validé par l'utilisateur (2026-06-11)** : les modèles non-humanoïdes sont « tous
affreux » → refonte en exploitant TOUTES les options de personnalisation + en AJOUTANT des
props. Exigence ajoutée : les capacités physiques (**Bond, Vol**…) reçoivent leur ANIMATION
(« une animation ça va avec »). Ordre validé : **montures + bêtes Tome 1 → gros monstres
iconiques (dragon/griffon/manticore) → exotiques (squig/amorphe/jabber)**. Suivi : ROADMAP
**Jalon 8.5**.

**Lot 1 LIVRÉ (commit b18b9d4)** — socle quadrupède + Tome 1 :
- `LEG_BUILD` par carrure (quadParts.ts) : masse cuisse/épaule en goutte SANS contour (fond
  dans la robe), segments coniques (`taper` : cuisse→genou→boulet), **contour des membres
  seulement sous 30 %** — la patte proche est rendue PAR-DESSUS le tronc (z 9 > 5), un contour
  complet imprimait des coutures sur le corps.
- **Arrière-main angulée** (quadSkeleton leg(rear=true) : cuisse −7/−4, jarret +16/+13,
  pied −9) — fini la « table à 4 pattes ». Face/dos non affectés (angles re-zérotés par vue).
- **Prop `QuadProps.mane`** : 'crin' (couché, mèches) / 'hirsute' (dents dressées + touffe de
  gorge — Loup) / 'sans' ; rétro-compat : défaut dérivé de `tail==='crin'` (équins).
- **Harnachement** (`mountTackBones` dans mountedRig.ts) : tapis rouge, selle pommeau/
  troussequin, quartier, sangle, étrier, rênes museau→pommeau (muserolle) — os SYNTHÉTIQUES
  (couleurs LITTÉRALES : les tokens sont déjà résolus à ce stade) z-calés : selle 5.5
  (au-dessus du barillet 5 et de la jambe lointaine 4.5, sous le cavalier 6.6), rênes 6.7.
  Composé par MountedToken quand monté (+ galerie clips). Toute monture future = harnachée gratis.

**Lot 2 LIVRÉ (26eaf19)** — WingState : ailes REPLIÉES au repos (art dédié, marqueur
`data-wing="folded"` ; face/dos = bosses d'épaule), DÉPLOYÉES en vol/attaque/mort étalée —
décidé par usePlanAnim (`ResolveOpts.wings`, défaut folded ; idle replié = flap ±2.5°) ;
**Bond animé** : `BodyPlan.leapPose` (hook) + `quadLeapPose` (ramassé→détente), joué au lieu
du trot si `hasLeap(traits)` (lu du store au ANIM_MOVE — data-driven, marche pour toute
créature d'éditeur) ; prop `wingSpan`. Galerie attaques passe `wings:'spread'`.

**Lot 3 LIVRÉ (eb541eb)** — props de finesse : `ridge` (épines déf. draconic/crête/plaques,
marqueurs data-ridge), `markings` (taches/rayures flanc + balzanes membres — Chien tacheté,
Cheval balzanes), `headScale`/`tailLen` (enveloppes scale 3 vues) ; yeux quad ANCRÉS
data-eye/data-ec (convention bipède).

**Lot 4 LIVRÉ (c547550) — workflow ultracode 70 agents** : les 28 defs rigués audités contre
le canon FR (refs ligne à ligne) + retouchés + **jugés À L'AVEUGLE** (juge ne voit que les
PNG anonymes `public/qc/blind/`) avec repêchage critique → 21/28 reconnues (2 laxistes :
Manticore lue pégase, Sangsue lue serpent — match sur alias trop large). Outil pérenne
`scripts/qc/render-creature.mts` ("Nom" [outdir] [prefix] / --list). Pattern workflow :
1 agent/créature (render→canon→edit son def→re-render→copie blind bN) puis 1 juge blind ;
pipeline 2 étages + repêchage ; agents n'ont touché QUE leurs defs (discipline OK).
⚠ args du Workflow arrivent SÉRIALISÉS en chaîne → toujours `typeof args==='string' ?
JSON.parse(args) : args` en tête de script.

**Lot 5a LIVRÉ (b9a2200)** : (b) pieds quad — patte = extrémité du membre couleur du CORPS
+ doigts ronds + griffes (fini les godets cuir sombres), serre = 3 doigts PLEINS au sol (fini
le râteau filaire), profil ET face ; (d) ailes pliées de FACE = panneau qui épouse le flanc
vers le bas (fini les « oreilles d'âne ») ; (g)+(a-spectral) : spectraux refondus — fondu de
transparence buste→volutes→langues (op. 0.85/0.5/0.25), regard luisant SANS pupille, bouche
hurlante déchirée, VRAIE VUE PROFIL (capuche-bec + œil unique, bras proche tendu/traîne).

**Lot 5b LIVRÉ (9677d16)** : squig — gueule = moitié inférieure du corps (mâchoire-bac à gros
crocs), yeux petits excentrés, griffes, VRAI PROFIL (gueule latérale, œil unique) ; jabber —
ailes de libellule COUCHÉES vers l'arrière (éventail de face), langue ANCRÉE pendant devant,
pupilles fendues + paupières, cou en S, profil dédié ; serpentins — boucles décalées +
croissants d'enroulement + queue émergente (fini « pile de pneus »), cou fuselé en S.

**Lot 5c LIVRÉ (0fbd372)** : araignée (pattes articulées genou haut, crochets courbés,
profil directionnel — sprawl avant/arrière + face décalée + abdomen traînant), pieuvre
(profil œil unique, manteau incliné, tentacules en éclaireurs + crosse enroulée), Bête des
marais (dôme de tête + épaulements « vaguement humanoïde », gueule fendue vers l'avant au
profil), faces quad raccordées au profil : dragon/basilic (cornes FINES balayées + museau
long denté + naseaux-fentes — fini âne/groin), loup (museau cunéiforme + truffe + crocs +
bajoues — fini ours/rat de face).

**Flanc quad REFAIT (46eed9f, sur retour utilisateur direct)** : le profil était 3 blobs
détourés (barrique + croupe-bulle + encolure) → le corps ENTIER est désormais UNE silhouette
continue par carrure dans le TRONC (poitrail→garrot→dos→croupe→cuisse→ventre ; volumes
internes sans contour) ; l'os `croupe` ne porte plus que pattes arrière + queue (art
supprimé, anim croupe ±7° sans perte visuelle). Queue `reptile` RETOURNÉE : traîne derrière
au sol via `rotate(-34) scale(-1,1)` compensant l'os queue à 42° — avant elle pendait sous
le ventre vers l'avant (« on dirait qu'il est en érection », basilic).

**Lot 5d LIVRÉ (f008ddc)** : catalogue d'yeux branché bout en bout sur les gabarits —
`ResolveOpts.eyes` (ARTS résolus) → `applyEyes` sur l'os tete dans resolveQuadFromProps
(no-op sans ancre) ; clés éditeur résolues au spawn (riggedAppearance, combattants) ou via
`eyesArtFromKeys` (tokens d'entité, pickBackend) ; AnimatedPlanToken/MountedToken threadent.
Les selects Œil G/D de l'éditeur pilotent donc AUSSI les créatures (loup œil-braise,
cheval yeux noirs, ours œil de chat — QC validé).

**Tenue Guerrier du Chaos (8d26503)** : tenue de carrière dédiée 3 vues (careerTenues MANUAL,
comme le Vampire) — heaume intégral cornu + CAMAIL (⚠ le COU se rend PAR-DESSUS le torse :
seul un camail accroché à l'os TÊTE peut le couvrir, pas un gorgerin du torse), cuirasse à
étoile, épaulières à pointes ; race def basculée (fini le plastron-overlay sur tenue Soldat).

**RÈGLES CODIFIÉES — éléments latéraux PAIRS (cornes/épaulières/oreilles/pointes)** :
1. **D'ABORD : poser l'élément sur l'OS PAIR s'il existe** (épaulière → os du BRAS, pas l'art
   du torse) — chaque côté rend le sien ⇒ face/dos/profil + G/D + près/loin cohérents PAR
   CONSTRUCTION (leçon ef6539f : l'épaulière dessinée DANS le torse par vue = pics de face
   absents de flanc/dos, 3 itérations perdues).
2. **Sinon (pas d'os pair — cornes de casque…)** : `lateralPair(svgProche,{dx,dy})`
   (`rig/parts/parallax.ts`) fabrique l'exemplaire LOINTAIN (décalé +x, tokens @X→@XO,
   peint avant).
CHECKLIST QC de toute planche : (1) éléments pairs visibles ×2 de profil ET de dos,
(2) cou/jonctions couverts sous rotation, (3) face↔profil même bête. Parades structurelles
de la famille : dorsalOverlays (queues/ailes), BACK_* (dos), mirrorClip (bras porteur),
os-pair/lateralPair (paires latérales).

**JALON 8.5 CLOS** (lots 1→5d + flanc continu). Seul reste : recette navigateur en jeu
(scénario 12 + bestiaire) quand Playwright sera libre.

**Méthode QC** : planches PNG resvg (zoom unitaire ×6 obligatoire — à l'échelle planche on ne
voit RIEN, deux itérations jugées « identiques » à tort) ; galeries pérennes (bestiaire/toise/
clips) régénérées + committées.

Prolonge [[game-toise-echelles]] + [[game-gabarits-corporels]] + [[game-qc-reconnaissabilite]].
