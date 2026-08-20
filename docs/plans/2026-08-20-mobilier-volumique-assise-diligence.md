# Mobilier volumique et assise — salle principale de La Diligence

**Date :** 2026-08-20

**Statut :** Validée par l'utilisateur le 2026-08-20

**Nature :** spécification de conception, à supprimer une fois exécutée

## 1. Contexte

La salle principale de La Diligence (`zone-S-z0`, « Salle principale ») est structurellement
présente dans `src/scenes/diligence/diligence-projet.json`, mais elle ne contient aucun meuble. Le
plan fourni montre une cheminée, un comptoir en L, trois tables rondes avec tabourets et trois tables
murales avec tabourets. L'utilisateur a confirmé que les éléments le long du mur droit sont des
**tables murales avec tabourets**, et demande que les personnes puissent réellement s'y asseoir.

Le moteur actuel rend les `SceneEntity kind:'prop'` comme des panneaux SVG (`PropEl` sans faces,
`propSvg` puis quads WebGL). Le monde architectural, lui, est déjà volumique et passe par les
`Face[]` camera-free de `src/gameIso/builders/types.ts`. L'exploration ne montre qu'un corps du groupe,
le meneur visible, dans `src/gameIso/stage/MondeDeCampagne.tsx`; elle ne matérialise pas les quatre
héros côte à côte. Les PNJ authorés restent des `SceneEntity kind:'personnage'`.

La Diligence est un document JSON éditable. Elle n'a pas de source `MapSpec` dédiée à convertir ou à
remplacer. La compatibilité ASCII attendue est donc une compatibilité de **construction** : les mêmes
entités doivent pouvoir être produites par `MapSpec.entities` et `MapSpec.bind`, avec les mêmes ids de
catalogue. Elle ne signifie pas que l'export inverse `sceneToAscii` sait restituer toute la scène.

La correction séparée de la porte errante de la brasserie, arête `(27,30,N)`, ne change ni le plan ni
les coordonnées de la salle principale décrite ici.

## 2. Objectifs et hors périmètre

### Objectifs

- Donner aux meubles de la salle une géométrie 3D réelle, visible correctement en isométrique, vue du
  dessus et POV.
- Conserver le schéma éditable de scène et les ids stables du catalogue de props.
- Décrire dans les données les places assises utilisables des ensembles de tables et tabourets.
- Permettre au meneur visible du groupe de s'asseoir/se relever, et rendre les PNJ explicitement
  authorés assis sans leur ajouter d'action autonome.
- Persister proprement l'occupation sans transformer les props en personnages ni détourner la
  mécanique de monture.
- Reproduire fidèlement l'implantation du plan sans boucher les portes, fenêtres, la rampe ou l'allée
  publique.

### Hors périmètre

- Aucun système d'IA sociale : les PNJ ne choisissent pas spontanément une table.
- Aucun rendu simultané des quatre héros corporels en exploration.
- Aucun inventaire, service de taverne, consommation, animation de repas ou simulation d'auberge.
- Aucun modèle three.js écrit à la main, fichier glTF, nouveau `kind` d'entité ou branche par id de
  meuble dans le renderer.
- Aucun remplacement global immédiat de tous les props SVG existants : les refs sans recette
  volumique conservent leur chemin billboard.

## 3. Décisions structurantes

### 3.1 Identité et authoring

Un meuble reste une `SceneEntity` avec `kind:'prop'` et `ref` égal à un id de
`src/data/props.json`. Il n'existe pas de `kind:'furniture'`, de seconde liste de meubles ni d'id de
rendu distinct de l'id d'authoring. L'éditeur, le JSON de scène, `MapSpec.entities` et `MapSpec.bind`
manipulent les mêmes ids stables.

Les cinq nouvelles refs sont :

- `cheminee-interieure` ;
- `comptoir-droit` ;
- `comptoir-angle` ;
- `table-ronde-4-tabourets` ;
- `table-murale-2-tabourets`.

### 3.2 Géométrie volumique data-driven

`src/data/props.json` devient la source commune de la physique, de la recette volumique et des slots
d'assise d'un type de prop. Une recette décrit des primitives locales simples — boîtes, cylindres et
prismes — avec dimensions, transformation locale et référence de matériau. Les coordonnées
horizontales suivent l'espace monde des builders (unités de grille), les hauteurs sont métriques comme
`GP.h`. L'orientation de l'instance vient uniquement de `SceneEntity.facing` et transforme toute la
recette ; elle n'est jamais déduite du label ou d'un motif dans l'id.

Le builder de props transforme cette recette en `Face[]` camera-free. Le backend WebGL cuit ces faces
par le chemin géométrique existant (`facesGeometry`/`sceneMeshes`) ; il ne fabrique pas un `THREE.Mesh`
particulier par meuble. Une ref volumique n'entre pas dans le collecteur de quads billboard. Les
backends et politiques de vue reçoivent toujours le même monde, sans géométrie dupliquée par caméra.

Le contrat `PropEl` devient explicitement capable de porter soit des faces volumiques dérivées, soit
le chemin billboard historique. Il ne possède jamais une seconde vérité de dimensions ou
d'empreinte : physique, collision et dimensions viennent exclusivement de `PropData` et de sa recette.
Le champ legacy `SceneEntity.foot` est donc retiré du schéma et de l'éditeur ; les documents existants
sont migrés vers l'empreinte de leur `ref`, et le chargement dépouille cet ancien champ sans en faire
un override implicite. Lorsqu'une ref historique est réellement utilisée avec plusieurs empreintes,
la variante reçoit un id de type stable distinct : les meubles longs de l'Opéra deviennent
`table-2x1`, `bureau-2x1` et `etabli-2x1`, tandis que les tables historiques sans override restent
`table` 1×1. La preuve de migration couvre exhaustivement les vingt-quatre instances authorées qui
portaient `SceneEntity.foot` : onze dans l'Arène et treize dans le mobilier de l'Opéra.
Pour une ref volumique, `PropEl` transporte les `Face[]` déjà dérivées ainsi que l'`entId` nécessaire au
picking ; le clic d'une face doit restituer le `SceneEntity.id` source. Le SVG du registre
`src/gameIso/catalog/decor/` reste autorisé comme vignette de palette et comme fallback visible d'une
ref invalide ou legacy ; il n'est jamais le corps monde d'une ref dont la recette volumique est valide.
La cuisson multi-matériaux peut produire plusieurs plages de sommets pour le même `entId`; toute face
de ces plages restitue le même id. Une face monde sans plage de prop reste étrangère à ce picking et
ne doit pas masquer le clic historique d'un acteur derrière un mur, un sol ou un toit non-prop.

Les types de recette et de slots sont neutres et vivent côté donnée/état, afin que `src/state` puisse
les lire sans importer `src/gameIso`. Le builder importe ces types et les transforme ; la dépendance
ne va jamais du state vers le renderer.

Les matériaux nécessaires sont nommés dans une donnée de matériaux de props, résolus par un domaine
de `MaterialRef` dédié plutôt que par couleurs dans le builder : bois de chêne, pierre d'âtre, fer
noirci et braises. Les braises sont une matière chaude **non émissive** : aucun canal lumineux de face
n'est inventé. L'éclairage de la cheminée passe uniquement par le champ `SceneEntity.light` existant,
avec les valeurs par défaut de `PropData`, sans système de feu parallèle.

### 3.3 Slots d'assise dans les données

Les places sont déclarées sur le type de prop dans `src/data/props.json`, à côté de la recette
volumique. Chaque slot porte au minimum :

- un `id` stable et unique dans la ref ;
- un offset local d'ancrage du bassin, transformé par le `facing` de l'instance ;
- un cap local du personnage assis, lui aussi transformé en `Dir8` monde ;
- une case d'approche locale, transformée en case monde, depuis laquelle l'interaction est possible et
  où le personnage se tient logiquement lorsqu'il se relève.

`table-ronde-4-tabourets` déclare exactement quatre slots distincts. Chaque
`table-murale-2-tabourets` en déclare exactement deux. Les comptoirs et la cheminée ne déclarent aucun
slot dans ce lot. Les slots appartiennent à la ref du meuble : ils ne créent pas quatre ou deux
`SceneEntity` tabourets supplémentaires.

Le schéma strict de `props.json` refuse une forme ou un matériau inconnu. Un garde de données refuse
les ids de slots vides ou dupliqués, les dimensions non positives, les coordonnées non finies, une
case d'approche qui tombe dans l'empreinte solide du meuble et deux slots du même prop qui résolvent la
même case d'approche : toutes les places d'un ensemble doivent être simultanément occupables. Une
instance sans `facing` utilise le cap canonique déjà appliqué aux props directionnels (`S`), jamais une
inférence depuis sa position.

## 4. État d'occupation et source unique

### 4.1 Forme normalisée

`Scene` reçoit un champ optionnel `seatAssignments`. Sa structure est imbriquée, sans clé concaténée ni
séparateur à reproduire :

```ts
type SeatOccupant =
  | { kind: 'party'; heroId: string }
  | { kind: 'entity'; entityId: string };

type PropId = string;
type SlotId = string;
type SeatAssignments = Record<PropId, Record<SlotId, SeatOccupant>>;
```

`src/state/seating.ts` est le module pur et la source unique pour : résoudre une ref et ses slots,
transformer offsets/caps/approches locaux, lister les slots libres, trouver l'assise d'un occupant,
asseoir, relever et élaguer les affectations invalides. Ses helpers sont les seuls à indexer les deux
niveaux `propId`/`slotId`. Ni le renderer ni le store ne reconstruisent un accès, une clé ou une
transformation de slot à la main.

Une affectation est valide seulement si le prop existe encore, si son `ref` déclare le slot, si
l'occupant existe et si un occupant n'occupe qu'un slot. Un slot ne reçoit qu'un occupant. Pour un PNJ
authoré, `SceneEntity.pos` doit être exactement la case d'approche monde résolue de son slot ; une
affectation qui contredit cette position échoue à l'authoring. Le choix automatique du « premier slot
libre » suit l'ordre déclaré dans `props.json`, ce qui rend l'interaction déterministe et testable.

### 4.2 Persistance d'instance

`SceneMutation` dans `src/state/sceneInstance.ts` reçoit un override **complet** optionnel de
`seatAssignments`. `captureMutation` compare l'affectation runtime à l'affectation authorée ;
`applyMutation` remplace le champ en bloc quand l'override existe. Il ne fusionne pas les clés, car une
fusion ressusciterait une place libérée. Une affectation identique à l'authored ne produit pas de delta.

Les saves suivent la politique de version existante : si la forme persistée change, le lot augmente le
`SAVE_VERSION`; aucune migration silencieuse n'est ajoutée. Les scènes anciennes sans
`seatAssignments` valent « aucune affectation authorée ».

Au chargement et à l'application d'une mutation, `pruneSeatAssignments` élimine les références devenues
invalides. L'élagage est déterministe et observable en test ; une donnée authorée invalide échoue dans
les validateurs d'éditeur/MapSpec au lieu d'être corrigée silencieusement.

## 5. Interaction et cycle de vie

L'interaction réutilise `pendingInteract`, `setPendingInteract` et `interactEntity` dans
`src/state/store.ts`. Un prop possédant des slots est interactif même s'il n'a pas de Flow de fouille :
le stage lui donne la même affordance d'approche, et un clic éloigné arme le déplacement existant vers
une case d'approche résolue par `seating.ts`.

À portée :

1. si le meneur visible occupe déjà un slot de ce meuble, l'interaction le relève ;
2. sinon, le premier slot libre dont la case d'approche est atteignable est choisi dans l'ordre de la
   donnée ;
3. si aucun slot n'est libre ou atteignable, l'action ne mute rien et produit une raison française
   visible ;
4. une fois assis, « Se relever » reste disponible depuis l'interaction du meuble et depuis l'action
   contextuelle du personnage.

La réservation est une mutation atomique. `interactEntity` revalide au moment de l'écriture le prop,
la ref, le slot, la case d'approche, l'occupant courant et la liberté du slot ; il ne se fie pas à
l'état lu au clic ou avant le déplacement. En coop, seul le propriétaire autorisé du meneur peut
demander l'action et l'hôte applique cette même transaction autoritaire. Deux tentatives concurrentes
sur le dernier slot ne peuvent produire qu'un gagnant ; la seconde reçoit l'état « occupé » sans
écraser la première.

Le groupe ne se dédouble pas. Seul le héros qui est actuellement le meneur visible peut recevoir un
`SeatOccupant kind:'party'`; les trois autres portraits restent dans le HUD, sans corps ni réservation
de tabouret. Tout changement de meneur ou de composition du groupe libère d'abord l'assise du précédent
meneur : un héros devenu invisible ne réserve jamais un tabouret. Un PNJ est assis uniquement si son
`SeatOccupant kind:'entity'` est authoré dans la scène ; aucune action autonome ni IA sociale ne lui
permet de choisir une table dans ce lot.

La position logique du groupe ou du PNJ reste la case d'approche, tandis que le rendu applique l'ancre
fractionnaire du slot. Pour un PNJ authoré, cette égalité est un invariant du document. Une éventuelle
action de scénario future qui affecterait un PNJ à chaud devra déplacer/réconcilier atomiquement sa
`pos` et l'assignment ; cette action est hors périmètre du présent lot. Ainsi, se relever ne demande pas
de téléportation ambiguë et le pathfinding reste sur la grille existante.

Les verrous de place sont libérés aux coutures suivantes :

- avant tout déplacement du groupe assis ;
- avant tout changement de meneur ou de composition du groupe ;
- à l'ouverture d'un combat pour tout occupant qui y participe ;
- avant une transition de scène pour les occupants du groupe, afin qu'une scène quittée ne conserve pas
  un héros absent ;
- à la suppression du prop ou du PNJ occupant ;
- à la mort/indisponibilité d'un occupant ;
- lors du pruning après chargement ou remplacement de document.

Les affectations authorées de PNJ non supprimés restent la pose par défaut de la scène lors d'une
nouvelle visite. La transition ne doit donc pas fabriquer un delta vide qui effacerait ces poses.

## 6. Pose assise et rendu du personnage

La pose est une sœur non équestre de la pose montée. Elle réutilise les primitives de rig existantes —
notamment le corps assis de `src/gameIso/rig/mountedRig.ts`, les clips de
`src/gameIso/rig/anim/weaponClips.ts` et la composition camera-relative — mais ne pose jamais
`Combatant.mountId`, `riderId` ou un faux combattant-monture. Le contrat d'assise vient de
`seatAssignments`, pas de `state/mount.ts`.

Le token du meneur ou du PNJ reçoit une pose assise et une ancre monde dérivées par `seating.ts`. Les
armes et gestes incompatibles avec le repos assis restent rangés ; aucune attaque montée n'est
sélectionnée. La vue de dessus garde un pion sélectionnable sur l'ancre du slot. En POV, le personnage
est vu à la vraie position du tabouret et à la bonne hauteur, sans billboard traversant la table.

L'identité de token, le chrome, les halos, le picking, le focus caméra et le calcul d'occlusion utilisent
la même position visuelle d'assise. La caméra de suivi du meneur vise donc le slot pendant l'assise, et
non le centre de la case d'approche. Les règles de brouillard et de pièce continuent d'utiliser la case
logique, qui appartient à la même salle.

## 7. Éditeur et compatibilité ASCII

L'inspecteur de `src/ui/editor/Inspector.tsx` continue d'éditer une entité `prop` ordinaire : ref,
position, étage et orientation. Pour une ref volumique, dimensions et empreinte sont lues dans
`PropData` et ne sont pas surchargées dans `PropEl` ou l'inspecteur. Il affiche en lecture structurée
les slots fournis par la ref et permet d'authorer l'occupant initial avec des pickers d'ids existants : héros uniquement si le
document en porte réellement un, PNJ parmi les `SceneEntity kind:'personnage'` de la scène. Aucun champ
ne demande un label libre. Supprimer ou changer la ref d'un meuble déclenche le pruning des affectations
de cette instance dans la même mutation d'éditeur.

L'action contextuelle « Se relever » compose le pont d'exploration et sa commande vissée existants,
sans nouvelle classe CSS. Elle garde un nom accessible, le focus clavier, la cible tactile 44 px sous
`pointer: coarse` et le comportement du pont à 360 px.

`MapSpec.entities` accepte naturellement les props et PNJ puisqu'il conserve leurs ids. `MapSpec`
reçoit explicitement `seatAssignments` pour authorer une occupation seulement lorsque le prop et le
PNJ ciblés ont tous deux des ids fixes déclarés dans `entities`. Une affectation ne référence jamais
l'id généré d'une pose issue de `bind`.

`MapSpec.bind` doit démontrer qu'un marqueur tel que `T` ou `M` produit la même `SceneEntity
kind:'prop'`, la même `ref` et le même `facing` que la pose JSON ; cette preuve porte sur le meuble, pas
sur une affectation de siège. Le test de compatibilité couvre donc séparément : meubles via
`levels+bind`, assignments via `entities+seatAssignments`. Il ne prétend pas convertir le JSON entier
de La Diligence en une nouvelle source ASCII.

`sceneToAscii` reste honnête sur sa portée actuelle : `entities`, `bind` et `seatAssignments` figurent
dans `notRestored`. L'export inverse ne gagne pas dans ce lot une sérialisation des meubles ou des
affectations. Le critère ASCII est donc borné : **tout meuble et toute orientation de ce lot sont
exprimables par `MapSpec.entities`/`bind`, tandis qu'une affectation est exprimable par
`MapSpec.seatAssignments` seulement avec des ids fixes de `entities`; ces deux chemins construisent le
même document de scène et sont couverts par des tests distincts**.

## 8. Catalogue visuel du premier lot

| Ref | Composition volumique | Matériaux | Slots |
|---|---|---|---:|
| `cheminee-interieure` | socle et jambages de pierre, manteau, fond d'âtre, plaque/chenets et lit de braises | pierre d'âtre, fer noirci, braises | 0 |
| `comptoir-droit` | caisson plein, façade à panneaux, plateau débordant, plinthe | bois de chêne, ferrures | 0 |
| `comptoir-angle` | raccord d'angle continu compatible avec le module droit, plateau sans fente | bois de chêne, ferrures | 0 |
| `table-ronde-4-tabourets` | plateau cylindrique, pied central, quatre tabourets volumétriques intégrés | bois de chêne, fer noirci | 4 |
| `table-murale-2-tabourets` | plateau mural rectangulaire, consoles/pieds, deux tabourets intégrés | bois de chêne, fer noirci | 2 |

Les cinq refs ont une vignette SVG reconnaissable dans la palette, mais leur présence dans le monde
est exclusivement la recette volumique. Les quatre rotations doivent montrer les volumes, dessous de
plateaux, pieds, ferrures et profondeur de l'âtre ; aucun élément ne doit devenir une feuille sans
épaisseur vu de profil.

## 9. Implantation groundée dans `zone-S-z0`

La zone descriptive occupe le rectangle `(x=9..14, y=6..25)` et sa liste de tuiles authorée en est la
vérité précise. Le recalage image→grille est explicite : la gauche→droite de l'image suit `x`
croissant, tandis que le bas→haut de l'image suit `y` croissant. Deux ancres indépendantes le prouvent
dans la scène existante : la double porte visible en bas à droite est `(14,8,E)`–`(14,9,E)`, et la
rampe visible en haut à droite suit `(14,23)`–`(14,25)` puis `(13,25)`. La cheminée dessinée en bas à
gauche se place donc bien en `(10,8)`, adossée à l'ouest et ouverte vers l'est.

Ce recalage ne dépend pas de la présence durable du fichier image externe. Avant le placement final,
la première capture en vue du dessus doit toutefois être annotée avec ces deux ancres, les axes et la
cheminée ; une inversion ou un miroir arrête le lot avant toute validation des quinze poses.

Les poses suivantes sont celles à inscrire dans
`src/scenes/diligence/diligence-projet.json` :

| Élément | Positions d'ancrage | Orientation / intention |
|---|---|---|
| Cheminée | `(10,8)` | adossée à l'ouest, ouverture vers l'est |
| Comptoir, retour haut | `(10,24)` | ferme le haut de l'arrière-bar sans empiéter sur la rampe |
| Comptoir, angle | `(11,24)` | raccorde le retour à la ligne de service |
| Comptoir, ligne de service | `(11,23)`, `(11,22)`, `(11,21)`, `(11,20)`, `(11,19)` | façade de service vers l'est |
| Comptoir, retour bas | `(10,19)` | ferme le bas de l'arrière-bar |
| Tables rondes | `(10,23)`, `(12,14)`, `(10,10)` | quatre slots chacune |
| Tables murales | `(13,10)`, `(13,14)`, `(13,19)` | contre le mur est, `facing:'O'`, deux slots chacune |

Le comptoir forme huit cases solides. Avec la cheminée, les trois tables rondes et les trois tables
murales, le lot pose quinze cases solides. L'arrière-bar reste en `x=9..10` et l'allée publique en
`x=12..14`. La simulation groundée conserve **89 tuiles libres sur 104** et toutes les tuiles libres
restent dans une seule composante atteignable.

Les coutures suivantes restent obligatoirement libres :

- double porte est `(14,8,E)` et `(14,9,E)` ;
- porte de cuisine `(9,11,E)` ;
- porte de service `(8,20,E)` ;
- rampe `(14,23)`, `(14,24)`, `(14,25)`, `(13,25)` ;
- fenêtres est `(14,12,E)`, `(14,16,E)`, `(14,20,E)`, `(14,24,E)` ;
- fenêtre nord `(11,7,N)` et fenêtres sud `(10,26,N)`, `(13,26,N)`.

Un slot peut visuellement se rapprocher d'un mur, mais sa case d'approche et son corps assis ne doivent
couper ni une ouverture ni la rampe. Les volumes des meubles ne s'intersectent ni entre eux ni avec
les volumes des portes/fenêtres ; chaque corps assis reste entièrement dans `zone-S-z0`. Chaque case
d'approche de slot est marchable, non bloquée et distincte des approches de tous les autres slots
susceptibles d'être occupés simultanément.

La table ronde `(10,23)` est le cas frontière obligatoire : elle jouxte le retour de comptoir
`(10,24)` et la ligne de service `(11,23)`. Sa recette, ses quatre tabourets, ses quatre corps assis et
leurs approches doivent tenir sans intersection avec ces deux modules. Si cette preuve échoue, le lot
est réfuté et revient à validation d'implantation ; il ne décale pas silencieusement la table ni le
comptoir. Le test de scène vérifie les positions exactes, les quinze ancres, les dix-huit slots, toutes
ces contraintes spatiales et la connectivité après solidité.

## 10. Phasage de réalisation

Le phasage fixe les frontières de lots et leurs preuves ; le plan d'implémentation détaillé sera rédigé
avec `writing-plans` seulement après validation de cette spécification.

1. **Volume** — contrat de recette et matériaux, compilation en `Face[]`, cuisson WebGL, cinq refs et
   galeries unitaires, sans assise active.
2. **Slots, PNJ et mutation de scène** — contrat de slots, `seating.ts`, affectations authorées de PNJ,
   rendu assis, pruning, libération à l'ouverture du combat et override complet de
   `seatAssignments` dans `SceneMutation` (`captureMutation`/`applyMutation`). La phase est intégrable
   sans interaction du groupe et prouve qu'un PNJ relevé par le combat reste relevé après capture puis
   revisite.
3. **Meneur, coop et persistance** — interaction s'asseoir/se relever, revalidation atomique,
   ownership/transaction hôte, ancre caméra/chrome/POV, mouvement, changement de meneur/groupe,
   transition, save/reload, revisite et toutes les libérations de cycle de vie. Cette phase consomme la
   couture `SceneMutation` livrée en phase 2 ; elle ne la crée pas.
4. **Éditeur et ASCII** — inspecteur, gardes d'authoring, `MapSpec.seatAssignments` et preuves
   `MapSpec.bind` bornées ; aucune couture combat, coop ou persistance reportée ici.
5. **Placement et QC** — quinze meubles dans La Diligence, tests de connectivité, captures comparatives
   et corrections visuelles sans déplacer les murs ni ouvertures.

Chaque phase reste intégrable et testée ; une phase ne peut pas masquer une ref volumique derrière son
SVG pour paraître terminée.

## 11. Invariants et erreurs

- Une ref volumique valide produit au moins une `Face`, zéro quad billboard monde et des matériaux tous
  résolus.
- Une ref legacy sans volume conserve exactement le comportement billboard antérieur.
- Une ref inconnue conserve le fallback d'erreur visible existant et ne devient pas un meuble par
  défaut.
- Les builders restent purs, Node-safe et sans import React, three.js, store ou caméra.
- `src/state` n'importe aucun type depuis `src/gameIso`; les contrats de recette/slot restent neutres
  côté donnée/état.
- Le renderer ne compare jamais `ref` à l'un des cinq ids et ne branche pas sur un label.
- `PropEl` ne redéclare ni dimensions ni empreinte : `PropData` et la recette sont l'unique vérité ;
  ses faces conservent l'`entId` et le picking restitue le `SceneEntity.id` exact.
- Toute géométrie locale est transformée une seule fois depuis `SceneEntity.facing`; faces, slots,
  approches, picking et collision partagent cette transformation.
- Un occupant occupe au plus une place ; un slot contient au plus un occupant.
- Les approches de slots simultanément occupables sont distinctes, marchables et hors des empreintes
  solides.
- Un prop supprimé, une ref changée ou un PNJ supprimé ne laisse jamais d'affectation orpheline.
- Une mutation vide ne se persiste pas ; un override vide explicite reste distinguable de l'absence
  d'override lorsqu'il doit effacer des affectations authorées.
- Le meneur assis ne reçoit jamais de `mountId`; aucune règle de monture, taille effective ou attaque
  montée ne s'active.
- Le mouvement, le changement de meneur/groupe, le combat et les transitions ne laissent jamais un
  héros verrouillé dans une scène qu'il n'occupe plus.
- L'éditeur et `buildScene` refusent les assignments invalides avec un message portant `propId`,
  `slotId` et `occupant id`; le runtime de chargement élague les seules références legacy impossibles.
- Les quinze ancres de mobilier ne changent aucun mur, porte, fenêtre, escalier, terrain ou zone de la
  scène.

## 12. Preuves attendues

### Tests de données et géométrie

- Schéma strict des recettes, matériaux et slots ; ids de slot uniques.
- Golden d'une boîte, d'un cylindre et d'un prisme transformés pour les huit `Dir8` sans dépendance
  caméra.
- Chaque nouvelle ref produit des faces non dégénérées, des normales cohérentes et zéro paire
  coplanaire après le biais canonique.
- Les refs volumétriques sont absentes du lot billboard ; une ref legacy y reste présente.
- Dérivation exclusive des dimensions/empreintes depuis `PropData` ; `PropEl` ne porte pas de valeur
  concurrente.
- Chaque face volumique conserve l'`entId`; le picking d'une face rend le `SceneEntity.id` source.

### Tests d'assise et de persistance

- Transformation des offsets, caps et cases d'approche pour les huit orientations.
- Sélection déterministe du premier slot libre, refus d'un slot occupé et toggle se relever.
- Revalidation atomique de l'occupant et du slot au moment d'`interactEntity`.
- Double tentative coop sur le dernier slot : ownership respecté, transaction hôte unique, un gagnant
  et aucun écrasement.
- Deux occupants ne peuvent ni partager un slot ni occuper deux slots.
- Pour un PNJ authoré, `pos` égale exactement l'approche résolue ; deux slots simultanément occupables
  n'ont jamais la même approche.
- `captureMutation`/`applyMutation` round-tripent l'override complet, y compris le passage à `{}`.
- Pruning d'un prop supprimé, d'une ref changée, d'un slot retiré et d'un PNJ absent.
- Mouvement, changement de meneur/groupe, combat, transition et suppression libèrent les affectations
  concernées ; l'ancien meneur ne réserve plus invisiblement de slot.
- PNJ authoré assis → ouverture du combat → capture de mutation → revisite : le PNJ reste relevé, sans
  résurrection de son affectation authorée.
- Une save pendant l'assise restaure l'occupant et sa pose ; une version incompatible est rejetée selon
  la politique existante.

### Tests d'authoring et de scène

- `MapSpec.bind` construit une table murale orientée et une table ronde avec les mêmes refs/facings que
  `MapSpec.entities`.
- `MapSpec.seatAssignments` accepte une affectation dont le prop et le PNJ ont des ids fixes dans
  `entities`, et refuse toute référence à l'id généré d'un `bind`.
- `sceneToAscii.notRestored` et le texte exporté nomment explicitement les trois contenus non restaurés :
  `entities`, `bind` et `seatAssignments`.
- La Diligence contient exactement les quinze ancres attendues, réparties selon le tableau du §9, sans
  entité hors `zone-S-z0`.
- Les quatre portes, sept fenêtres et quatre cases de rampe citées restent libres.
- Les 89 tuiles non solides sur 104 restent atteignables depuis l'allée publique ; aucune poche n'est
  créée derrière le comptoir.
- Les ensembles fournissent exactement dix-huit slots : douze aux tables rondes, six aux tables
  murales.
- Les volumes de meubles ne s'intersectent ni entre eux ni avec les ouvertures ; les corps assis restent
  dans la zone et chaque approche est distincte, marchable et non bloquée. Une sonde dédiée couvre la
  table `(10,23)` contre le comptoir `(10,24)`/`(11,23)`.

### Recette navigateur

La recette suit `docs/recette-navigateur.md` et doit être réalisée sur la scène réelle :

- quatre rotations isométriques à zoom identique ;
- première vue du dessus annotée avec axes, double porte, rampe et cheminée avant placement final, puis
  vue du dessus finale sans annotation ;
- POV depuis l'allée, l'arrière-bar, devant la cheminée et devant chaque famille de table ;
- leader assis puis relevé sur une table ronde et une table murale ;
- PNJ authoré rendu assis et persistant, puis libéré par déplacement authoré, suppression ou combat ;
  aucune action autonome « s'asseoir » n'est attendue pour lui ;
- déplacement en étant assis, ouverture de combat, transition aller-retour et save/reload ;
- changement de meneur et de composition du groupe, avec preuve que l'ancien leader ne réserve plus le
  slot ;
- console navigateur à zéro erreur et zéro avertissement nouveau.

Les captures doivent réfuter : panneaux sans épaisseur, tabourets traversant les murs, clipping du
corps avec le plateau, braises flottantes, caméra visant la case d'approche, fenêtre/porte occultée,
rampe bloquée et disparition d'un meuble à une rotation.

## 13. Critères d'acceptation

Le chantier est accepté seulement si :

1. les cinq ids sont posables et éditables comme `SceneEntity kind:'prop'` ordinaires ;
2. leurs corps monde sont volumétriques dans toutes les vues et ne passent pas par un quad SVG ;
3. les trois tables rondes offrent quatre places chacune et les trois tables murales deux places
   chacune ;
4. le meneur visible peut s'asseoir, persister après save/reload et se relever ; un PNJ authoré est
   rendu assis et persiste, puis son affectation est libérée par déplacement, suppression ou combat,
   sans action autonome pour choisir un siège ;
5. aucun `mountId` ou chemin de règle équestre n'est utilisé ;
6. les affectations se libèrent sans orphelin aux coutures de mouvement, changement de meneur/groupe,
   combat, transition et suppression ;
7. le JSON de La Diligence demeure la source éditable ; les mêmes refs/facings sont démontrés via
   `MapSpec.bind`, et les assignments via `MapSpec.seatAssignments` avec ids fixes de `entities` ;
8. l'export inverse ASCII ne promet rien qu'il ne restaure pas ;
9. les quinze poses correspondent aux coordonnées du §9, les ouvertures et la rampe restent libres,
   les volumes/approches respectent les preuves spatiales, et les 89 cases libres restent connectées ;
10. les tests ciblés, typecheck, suite complète et recette navigateur sont verts, avec captures des
    quatre rotations, du dessus et du POV.

## 14. Fichiers probablement concernés après validation

Cette table délimite les familles probables ; elle ne remplace pas le futur plan d'implémentation
ligne par ligne.

| Domaine | Fichiers probables | Responsabilité |
|---|---|---|
| Données | `src/data/props.json`, `src/data/index.ts`, `src/data/schemas/defs/props.ts`, donnée/schéma de matériaux de props, `src/data/donnees.manifest.json`, registre de schémas généré | recettes, physique, lumière, matériaux, slots, atlas et registre générés |
| Catalogue/vignettes | `src/gameIso/catalog/types.ts`, `src/gameIso/catalog/decor/defs/`, registre généré | labels et vignettes/fallback ; aucune seconde vérité de physique ou d'empreinte |
| Builders | `src/gameIso/builders/props.ts`, `src/gameIso/builders/types.ts`, éventuel module pur de recette | compilation locale vers `Face[]`, `PropEl` sans seconde empreinte, conservation d'`entId` |
| Backend volumique | `src/gameIso/backends/webgl/sceneMeshes.ts`, résolution de matériaux/couleurs de faces | cuisson des faces, exclusion des billboards et picking face→`SceneEntity.id` |
| Schéma/état | `src/state/scene.ts`, nouveau `src/state/seating.ts`, `src/state/sceneInstance.ts`, `src/state/store.ts`, coutures mouvement/combat/transition/suppression | assignments, interaction, pruning, persistance |
| Rig/stage | `src/gameIso/rig/mountedRig.ts` ou extraction de primitives sœurs, `src/gameIso/rig/anim/`, `src/gameIso/builders/tokens.ts`, `src/gameIso/stage/MondeDeCampagne.tsx`, chrome/picking/caméra | pose assise non montée et ancre cohérente |
| Éditeur/ASCII | `src/ui/editor/Inspector.tsx`, primitives d'édition de scène, `src/state/mapSpec.ts`, tests `mapSpec`/`sceneToAscii` | occupant authoré, `MapSpec.seatAssignments` à ids fixes, preuve `bind` bornée |
| Scène | `src/scenes/diligence/diligence-projet.json`, test et snapshot de La Diligence | quinze poses, ouvertures libres, connectivité |
| QC | tests ciblés des modules ci-dessus et harnais `scripts/qc/capture-jeu.mjs` | preuves mécaniques et visuelles |

## 15. Points soumis à validation utilisateur

La présente spec n'a plus d'ambiguïté fonctionnelle connue. La validation demandée porte sur le lot
complet suivant : mobilier volumique data-driven, dix-huit places réellement utilisables, seul meneur
du groupe corporellement assis, PNJ assis uniquement quand authoré, et implantation exacte du §9. Une
fois validée, le prochain artefact est le plan d'implémentation détaillé, pas une nouvelle maquette de
plan ni une modification des murs.
