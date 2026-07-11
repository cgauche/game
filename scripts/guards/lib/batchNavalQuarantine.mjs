// Mécanique de scan de la QUARANTAINE d'import du BATCH GÉNÉRIQUE de cascade (#328). Le séquenceur
// générique (`state/cascade.ts`), la modale générique (`ui/CascadeModal.tsx`) et le module de types
// partagés côté cascade (`state/pendings.ts`) ne doivent IMPORTER RIEN du DOMAINE naval : ni équipage
// (`shipCrew`), ni manœuvre/rôles (`shipManeuver`), ni le catalogue de rôles/valeur d'équipage
// (`crewMorale`, `crew-roles`). Le batch a été DÉ-NAVALISÉ : le participant GÉNÉRIQUE porte sa
// présentation résolue à la construction par le flux propriétaire. Tout import naval ré-introduit le
// couplage machinerie→domaine (§3bis : la machinerie ne nomme aucune entité). Module ESM pur (node nu),
// même patron que `combatEventPort.mjs`.

/** Fragments de SOURCE d'import interdits (le couplage naval redevient inexprimable). @type {string[]} */
export const FORBIDDEN_SOURCES = ['shipCrew', 'shipManeuver', 'crewMorale', 'crew-roles'];

/**
 * Capture les IMPORTS/RÉEXPORTS (`import … from '…'` / `export … from '…'`, valeur OU type) dont la
 * SOURCE contient un fragment naval interdit. Un `import type` compte : le but est zéro dépendance de
 * domaine, structurelle comprise.
 * @param {string} contenu @returns {{ line: number, source: string }[]}
 */
export function scanBatchNavalQuarantine(contenu) {
  const findings = [];
  const rx = /(?:import|export)\b[^'"]*\bfrom\s+['"]([^'"]+)['"]/g;
  let m;
  while ((m = rx.exec(contenu)) !== null) {
    const src = m[1];
    for (const frag of FORBIDDEN_SOURCES) {
      if (src.includes(frag)) {
        const line = contenu.slice(0, m.index).split('\n').length;
        findings.push({ line, source: src });
      }
    }
  }
  return findings;
}
