// PORTE DE VERSION DE NODE (#1801) : `package.json` `engines.node`, lu ici, confronté au Node qui
// évalue ce module. Non conforme → message sur stderr et sortie 1, AVANT le module principal.
//
// Chargé sans condition, par effet d'évaluation — un point d'entrée `import.meta.main` (Node >= 22.18)
// ne se déclare pas « principal » sous un Node plus ancien et sort 0 sans rien faire. Les points
// d'entrée qui rendent un verdict refusent donc avant lui :
//   - les hooks shell du `core.hooksPath` de `postinstall`, avant leur `.mjs` (un `post-*` sort 0 sans
//     le lancer) ;
//   - les pilotes de fusion `merge.<nom>.driver` de `postinstall` : leur premier import ;
//   - `npm run gates` : premier import de `scripts/gates/toutes.mjs` ;
//   - `npm install`/`npm ci` : `.npmrc` `engine-strict`.
// Un script lancé seul (`npm run docs:check`) n'est pas couvert. `.npmrc` `node-options` le
// couvrirait, mais npm y REMPLACE le `NODE_OPTIONS` de l'appelant.
import { readFileSync } from 'node:fs'

const FORME = /^\s*>=\s*v?(\d+)\.(\d+)\.(\d+)\s*$/

/**
 * Message de refus, ou `null` si `version` satisfait `plage`. PUR.
 * Seule la forme `>=M.m.p` se lit : toute autre plage (ou son absence) est un refus qui la nomme.
 * @param {string | undefined} plage valeur de `engines.node`
 * @param {string} version `process.versions.node`
 * @returns {string | null}
 */
export function refusDeVersion(plage, version) {
  const exigee = FORME.exec(plage ?? '')
  if (!exigee) {
    return `[node-requis] package.json engines.node « ${plage} » : seule la forme \`>=M.m.p\` est lue par scripts/node-requis.mjs.`
  }
  const courante = /^v?(\d+)\.(\d+)\.(\d+)/.exec(version)
  if (!courante) return `[node-requis] version de Node illisible : « ${version} ».`
  for (let i = 1; i <= 3; i += 1) {
    const ecart = Number(courante[i]) - Number(exigee[i])
    if (ecart > 0) return null
    if (ecart < 0) {
      return `[node-requis] Node ${version} ne satisfait pas package.json engines.node « ${plage.trim()} » : installe un Node conforme.`
    }
  }
  return null
}

const { engines } = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'))
const refus = refusDeVersion(engines?.node, process.versions.node)
if (refus) {
  console.error(refus)
  process.exit(1)
}
