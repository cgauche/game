---
name: game-itemicon-mediaselect-primitives
description: "Deux primitives UI livrées — ItemIcon (objet→icône SVG) et MediaSelect (select visuel média+texte) ; à réutiliser, pas réinventer"
metadata: 
  node_type: memory
  type: project
  originSessionId: c3105a24-7370-4ffa-98d7-11c98d1410bc
---

Deux primitives partagées livrées (lots L1→L5, commits cc94553→73053d4) sur la branche `feat/wfrp4-rpg-foundation`.

**`src/ui/ItemIcon.tsx`** — `<ItemIcon item={ItemInstance | Weapon} size={number|'sm'|'md'|'lg'} />`. SOURCE UNIQUE du rendu d'objet autonome. Résout l'art via `weaponPart`/`armourPart`(slot réellement couvert, torse d'abord)/`shieldPart` ; arme tournée −40° + recadrage `getBBox` (`useIsomorphicLayoutEffect`, cache module par art ; repli viewBox par catégorie en SSR/test) ; `<defs>` injecté SEULEMENT si l'art contient `url(#` (registre + armures = hex tokenisé) ; objets sans art → icône de catégorie du registre `src/ui/icons` (famille `item/*` : `item/ammo`, `item/cloak`, `item/consumable`, `item/armour`, `item/weapon`, `item/misc`) — jamais un émoji. Discrimine l'union par `'kind' in item`.

**`src/ui/MediaSelect.tsx`** — déclencheur + popover de rangées `{key, media, label, sub?, disabled?}`. Remplace les `<select>` natifs qui doivent montrer une icône. Options rendues EAGER dans le DOM (IMPÉRATIF : tests en `renderToStaticMarkup`, pas de jsdom/RTL → lazy casserait les assertions de texte). Combobox a11y, fermeture Échap/clic-extérieur. `media` = `ItemIcon` ou `CharFrame`.

Nouveau prédicat user-free **`isConsumable(item)`** dans `engine/consumables.ts` (factorisé via `parseConsumable` partagé avec `itemUse`).

Consommateurs déjà câblés : Sac (rangées), onglet Combat (LayerPicker + 6 sélecteurs d'armes + pièces/En main), hotbar (sets/munition/objets), menu Donner. Galerie QC : `scripts/gen-item-icon-gallery.mts` → `public/item-icon-gallery.html`. AVANT d'écrire un rendu d'objet ou un select à icône → utiliser ces deux-là. Prolonge [[credo-exemples-calibrants]].

RESTE : recette navigateur live (cadrage getBBox réel + interactions MediaSelect) non faite — navigateur Playwright verrouillé par session // au moment du dev.
