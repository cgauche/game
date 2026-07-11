// Mécanique de scan « le générique n'importe pas le domanial » (#329, pérennise la lentille
// adversariale du recensement #329). Réutilise la closure d'imports de `build-systemes.mjs`
// (`importGraph.mjs`, extraite pour #329 — jamais un 2ᵉ parseur) : un module de `src/` appartient à
// UN SEUL système si sa closure racine (`systemes.manifest.json`) ne l'atteint que via CE système
// (partagé par ≥2 systèmes = infra transverse légitime, PAS domanial). Une PRIMITIVE générique
// (`primitives.manifest.json`) qui IMPORTE (directement, imports relatifs) un module appartenant à
// un système unique importe du domaine dans le générique — exactement la faute-souche relevée par
// #329 (ex. `cascade.ts` → `shipManeuver.ts`, `CascadeModal.tsx` → `crewMorale.ts`/`data` naval).
// Module ESM pur (node nu), même patron que `combatEventPort.mjs`/`inBattleFind.mjs`.

import { readFileSync } from 'node:fs';
import { closureOf, directImportsOf } from './importGraph.mjs';

/**
 * Calcule, pour chaque module atteint par au moins une closure système, le NOMBRE de systèmes qui
 * l'atteignent. Un module compté par exactement 1 système est « domanial » (single-system) ; un
 * module compté par ≥2 est de l'infra partagée légitime.
 * @param {{ id: string, modules: string[] }[]} systemes
 * @returns {Map<string, string[]>} module (chemin POSIX) -> liste des ids système qui l'atteignent
 */
export function computeOwnerSystems(systemes) {
  const owners = new Map();
  for (const s of systemes) {
    for (const rel of closureOf(s.modules)) {
      const list = owners.get(rel) ?? [];
      list.push(s.id);
      owners.set(rel, list);
    }
  }
  return owners;
}

/**
 * Scanne les imports DIRECTS d'un fichier primitive et signale ceux qui résolvent vers un module
 * domanial (owner unique).
 * @param {string} primitiveFile chemin POSIX relatif à la racine du repo
 * @param {string} contenu
 * @param {Map<string, string[]>} ownerSystems (`computeOwnerSystems`)
 * @returns {{ target: string, systemId: string }[]}
 */
export function scanGenericDomainImport(primitiveFile, contenu, ownerSystems) {
  const findings = [];
  for (const target of directImportsOf(primitiveFile, contenu)) {
    if (target === primitiveFile) continue;
    const owners = ownerSystems.get(target);
    if (owners && owners.length === 1) findings.push({ target, systemId: owners[0] });
  }
  return findings;
}

/**
 * Scan complet : pour chaque primitive du manifeste, ses imports domaniaux.
 * @param {{ id: string, fichier: string }[]} primitives
 * @param {{ id: string, modules: string[] }[]} systemes
 * @param {(path: string) => string} [readFile] injectable (tests)
 * @returns {{ primitiveId: string, fichier: string, target: string, systemId: string }[]}
 */
export function scanAllPrimitives(primitives, systemes, readFile = (p) => readFileSync(p, 'utf8')) {
  const ownerSystems = computeOwnerSystems(systemes);
  const findings = [];
  for (const p of primitives) {
    const contenu = readFile(p.fichier);
    for (const f of scanGenericDomainImport(p.fichier, contenu, ownerSystems)) {
      findings.push({ primitiveId: p.id, fichier: p.fichier, target: f.target, systemId: f.systemId });
    }
  }
  return findings;
}
