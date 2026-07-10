// Mécanique de scan du garde-fou anti-icône-fantôme : toute réf d'icône LITTÉRALE (`icon: 'x/y'`
// en TS, `"icon": "x/y"` en JSON) doit résoudre dans le registre d'icônes généré
// (`src/ui/icons/_registry.generated.ts`). Module ESM pur, exécutable par `node` nu — consommé par
// src/ui/no-phantom-icon.test.ts (qui porte la POLICY : répertoires scannés, exceptions, import du
// registre). Ici ne vit QUE la mécanique d'extraction des réfs.

/** Réf littérale d'icône : clé `icon` (TS non-quotée ou JSON quotée) suivie d'une chaîne — ne capte
 *  PAS un accès dynamique (`cur.icon || 'x'`, pas de `:` immédiat après `icon`) ni une clé composée
 *  (`shipIcon:` — `\b` exige un début de mot juste avant `icon`).
 * @type {RegExp} */
const ICON_REF_RE = /(?:"icon"|\bicon)\s*:\s*['"]([A-Za-z0-9_/-]+)['"]/g;

/**
 * Toutes les réfs d'icône littérales d'un texte, dédupliquées, avec la ligne de leur PREMIÈRE
 * occurrence (utile pour pointer un fichier:ligne).
 * @param {string} text @returns {{ id: string, line: number }[]}
 */
export function iconRefsIn(text) {
  const found = new Map();
  let m;
  ICON_REF_RE.lastIndex = 0;
  while ((m = ICON_REF_RE.exec(text))) {
    if (!found.has(m[1])) {
      const line = text.slice(0, m.index).split('\n').length;
      found.set(m[1], line);
    }
  }
  return [...found].map(([id, line]) => ({ id, line }));
}
