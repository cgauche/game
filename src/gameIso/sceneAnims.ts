/**
 * Animations d'ambiance d'une ENTITÉ de scène = classes CSS de `anim.css`, appliquées
 * au calque fx du token (donc sur le sprite composé — variantes comprises). Choisies
 * dans l'éditeur (inspecteur d'entité). Portées de public/ambush.html.
 */
export const SCENE_ANIMS: { key: string; label: string }[] = [
  { key: '', label: '— aucune (sprite fixe) —' },
  { key: 'breathe', label: 'Respire' },
  { key: 'feed', label: 'Dévore (charogne)' },
  { key: 'howl', label: 'Hurle' },
  { key: 'chop', label: 'Frappe (arme)' },
  { key: 'kick', label: 'S’agite' },
  { key: 'sway', label: 'Se balance' },
  { key: 'wrap', label: 'Ondule (tentacule)' },
  { key: 'glow', label: 'Luit' },
];

/** Ensemble des classes valides (pour validation/rendu). */
export const SCENE_ANIM_KEYS = new Set(SCENE_ANIMS.map((a) => a.key).filter(Boolean));
