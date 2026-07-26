/**
 * Mémoïsation par IDENTITÉ de référence — le patron CANONIQUE de tout cache dérivé de la `Scene`
 * (opacité de vision, arêtes de murs, empreintes de décor…). Sûr car TOUTE mutation de la donnée
 * observée renvoie une NOUVELLE réf (jamais une mutation en place) : un pas d'exploration/combat
 * qui ne change rien ne change pas la réf → zéro reconstruction ; une mutation réelle (porte,
 * décor, structure) passe TOUJOURS par un spread `{ ...x, … }` qui invalide le cache pour l'appel
 * suivant. AUCUNE invalidation manuelle : une garde de synchronisation est un smell (credo) — la
 * seule source de vérité est l'identité de la réf observée. UN SEUL patron — ne pas en recréer un
 * second à côté.
 */
export function memoByRef<K extends object, V>(build: (key: K) => V): (key: K) => V {
  const cache = new WeakMap<K, V>();
  return (key: K) => {
    if (cache.has(key)) return cache.get(key)!;
    const value = build(key);
    cache.set(key, value);
    return value;
  };
}
