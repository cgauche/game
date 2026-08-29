---
name: user-arbitrage-raison-de-refus-au-survol-jamais-inline
description: "Arbitrage utilisateur 2026-08-24 : les textes de raison de refus INLINE sous le nom des capacités sont REJETÉS (jamais validés, illisibles) — la raison d'un slot désactivé vit au SURVOL/focus (patron Rogue Trader), la case reste propre ; supplante la ligne « GatedAction visible, pas un popover » de la spec HUD"
metadata:
  node_type: memory
  type: user
  originSessionId: 3c1689ae-eeaa-4da2-a83f-c35ecef5c557
  modified: 2026-08-23T21:14:52.527Z
---

Verbatim utilisateur (2026-08-24) : « Je n'ai jamais validé ces "textes" impossible a lire sous le nom des capacités, même Rogue Trader qui est notre interface de départ n'a pas un tel comportement. »

**Why :** la spec HUD (`docs/plans/2026-08-16-spec-hud-combat.md:291` « Raison de gate = patron GatedAction/aria-describedby (visible), pas un popover ») avait fait choisir un rendu INLINE permanent (bande de raison sous le libellé, cases à hauteur fixe) — mais ce rendu concret n'a jamais été validé à l'écran par l'utilisateur ([[feedback-ecran-de-gout-validation-user-avant-commit]], [[feedback-attendu-valide-est-un-arbitrage]]) et Rogue Trader, l'interface de référence, met la raison d'un slot désactivé dans l'infobulle de survol. La spec l.194 lève d'ailleurs l'interdit « nom au survol ».

**How to apply :** la case/pastille désactivée reste PROPRE (icône + libellé + touche, état grisé AA) ; la RAISON vit dans l'infobulle de survol/focus (patron `CodexRef tooltipOnly` ou l'infobulle du réticule) + `aria-describedby` pour l'a11y — jamais un texte permanent écrasé dans la case. Vaut pour la console, les pastilles d'entité, la frise. La ligne :291 de la spec est SUPPLANTÉE par cet arbitrage (le doc de plan est daté — ne pas s'y appuyer contre ce verbatim).
