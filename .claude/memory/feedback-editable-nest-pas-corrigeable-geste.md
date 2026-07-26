---
name: feedback-editable-nest-pas-corrigeable-geste
description: "User 2026-07-26 : « éditable » se mesure au GESTE, pas au champ — exposer chaque cellule d'une emprise en cases à cocher rend la donnée éditable et inutilisable ; la question est « par quel geste un humain corrige ça ? »."
metadata:
  node_type: memory
  type: feedback
---

**User 2026-07-26 (verbatim)**, devant l'inspecteur de zone de l'éditeur : « **De toute évidence ce n'est
pas fait pour un être humain** »

**Contexte** : le critère permanent du chantier est le sien — « Assure toi toujours qu'on doit pouvoir
éditer toutes les données de la scene, on ne doit pas dépendre d'une IA ». Je l'ai instruit comme une
**liste de champs** : chaque champ de `Scene` doit avoir un écrivain atteignable depuis l'interface. La
garde `sceneFieldEditability` mesure exactement ça, et elle était verte.

Résultat sur l'écran : pour retailler l'emprise d'une pièce, l'inspecteur affichait
« Emprise (82 / 156 cases — décochez pour une pièce en L) » suivi d'une **matrice de 156 cases à
cocher**. Corriger une zone qui déborde de 20 cases voulait dire retrouver et décocher 20 carrés de
~12 px dans une grille sans aucune correspondance visuelle avec la carte. Champ éditable, donnée
inatteignable.

**Why** : « éditable » est une propriété du GESTE, pas du modèle. Un champ atteignable par un formulaire
satisfait la garde et ne rend service à personne quand la donnée est spatiale, massive, ou dérivée d'un
tracé. Le même éditeur sait peindre le terrain, peindre les cotes, tracer une volée au glissé — et
proposait un formulaire pour la forme d'une pièce. La garde ne pouvait pas le voir : elle compte des
écrivains, pas des gestes.

Corollaire mesuré le même jour, même écran : montrer un défaut ne suffit pas non plus. Le panneau de
validation listait « la zone déborde du bâti : 62 de ses 82 cases seulement sont bâties » — et le clic
n'amenait nulle part (« je dois les calculer a la main »). Un défaut qui porte sur N cases doit les
mettre en évidence TOUTES : sans ça, même un bon pinceau est inutile, puisqu'on ignore où peindre.

**How to apply** — avant de déclarer une donnée éditable, écrire le geste de bout en bout :
1. **Comment l'auteur SAIT qu'il y a un problème ?** (un défaut affiché, en français d'auteur)
2. **Comment il ATTEINT la donnée fautive ?** (un clic qui met en évidence la ou les cases concernées,
   à la bonne couche)
3. **Comment il la CORRIGE ?** (le geste : pinceau, tracé, glissé — pas un formulaire quand la donnée
   est spatiale)
4. **Comment il VÉRIFIE ?** (le compteur baisse sous ses yeux)

Si l'une des quatre étapes manque, la donnée n'est pas éditable, quelle que soit la garde. Et une donnée
éditable de DEUX façons dont l'une est inutilisable n'a pas deux chemins : elle en a un mort, à
supprimer (cf. [[feedback-no-legacy-propping-fallbacks]]).

Le pendant côté outil : un validateur qui se tait est pire qu'absent — même écran, même jour, le panneau
affichait « ✓ Aucun problème détecté » sur une carte portant 150 défauts mesurés. Voir
[[feedback-un-detecteur-ne-mesure-que-sa-couverture]] : une garde DÉCLARE sa couverture.

Lié : [[feedback-toute-donnee-de-scene-editable-sans-ia]] (le critère d'origine, complété ici par le
geste), [[feedback-affordance-morte-signaler]], [[feedback-composer-primitives-jamais-markup-brut]],
[[game-editeur-produit-final]].
