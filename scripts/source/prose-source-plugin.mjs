// Plugin Vite `wfrp:prose-source` — la prose ADRESSÉE (`descRef`) est MATÉRIALISÉE AU BUILD.
//
// La donnée committée n'a plus qu'un porteur de prose : l'adresse. Le module JSON que Vite sert (dev)
// ou bundle (prod) est un DÉRIVÉ : le `transform` y injecte le `desc` que l'adresse résout, avant que
// `vite:json` ne fabrique le module — donc les consommateurs de l'application lisent `entry.desc` comme
// avant, et le navigateur ne résout RIEN sur le chemin joueur. Même classe que `registryGen()`
// (`vite.config.ts`), qui régénère `src/_registry.generated.ts` au `buildStart`.
//
// FAIL-CLOSED : toute adresse qui ne rend pas exactement son texte fait ÉCHOUER le module par
// `this.error` — `vite build` rouge, overlay en dev, import rouge en vitest.
//
// `configureServer` RECHARGE la page quand un chapitre du `Source/` change : `this.addWatchFile` est
// inopérant sur un module `.json` (`vite:import-analysis` saute les `.json`), donc le plugin tient son
// propre index chapitre → modules JSON dépendants, rempli par le `transform`.
import { lireChapitre, oublierChapitre } from './lecteur-fs.mjs'
import { cheminChapitre, materialiser } from './resoudre.mjs'
import { BOOKS } from '../raw/_lib.mjs'

/** Documents de catalogue, et eux seuls : `src/data/<nom>.json` à plat (les projets de `src/scenes`
 *  entrent au périmètre quand leur schéma compose la prose adressable). */
const CIBLE = /[\\/]src[\\/]data[\\/][^\\/]+\.json$/
/** Séparateurs POSIX — l'index de dépendance apparie des chemins Windows et des chemins Vite. */
const normalise = (chemin) => String(chemin).split('\\').join('/')

/** Accès au corpus `Source/` sur le DISQUE : le lecteur PARTAGÉ, sa mémoire et ses dossiers. */
const CORPUS_DISQUE = {
  dossiers: () => BOOKS.map(([, dir]) => dir),
  chemin: cheminChapitre,
  lire: lireChapitre,
  oublier: oublierChapitre,
}

/**
 * @param {{ corpus?: typeof CORPUS_DISQUE }} [options] `corpus` n'est injecté que par les tests du
 *   plugin (fixture hors dépôt) ; la production lit le `Source/` du dépôt.
 */
export function proseSource(options = {}) {
  const corpus = options.corpus ?? CORPUS_DISQUE
  /** chemin de chapitre (POSIX) → `{ book, ch, ids }` : les modules JSON qui en dépendent, et
   *  l'adresse du chapitre — le lecteur mémorise par `livre|chapitre`, chokidar parle en CHEMIN. */
  const dependants = new Map()

  return {
    name: 'wfrp:prose-source',
    enforce: 'pre',

    transform(code, id) {
      const propre = normalise(id)
      const marque = propre.indexOf('?')
      if (!CIBLE.test(marque === -1 ? propre : propre.slice(0, marque))) return null
      // Un id à QUERY demande une AUTRE forme du fichier, et l'id est vu ici (`vite:json` vient après) :
      // `?raw` sert la FORME DISQUE, celle que le schéma décrit et que `dev-validate` valide.
      if (marque !== -1) return null
      let materialise
      try {
        const res = materialiser(JSON.parse(code), {
          lecteur: corpus.lire,
          chemin: corpus.chemin,
          surDependance: (chemin, book, ch) => {
            const clef = normalise(chemin)
            const vu = dependants.get(clef) ?? { book, ch, ids: new Set() }
            vu.ids.add(id)
            dependants.set(clef, vu)
          },
        })
        if (res.materialises === 0) return null
        materialise = res.racine
      } catch (e) {
        this.error(`prose-source : ${propre} → ${e instanceof Error ? e.message : String(e)}`)
        return null
      }
      return { code: JSON.stringify(materialise), map: null }
    },

    configureServer(server) {
      for (const dossier of corpus.dossiers()) server.watcher.add(dossier)
      server.watcher.on('change', (fichier) => {
        const vu = dependants.get(normalise(fichier))
        if (!vu || vu.ids.size === 0) return
        corpus.oublier(vu.book, vu.ch)
        for (const id of vu.ids) {
          const mod = server.moduleGraph.getModuleById(id)
          if (mod) server.moduleGraph.invalidateModule(mod)
        }
        server.ws.send({ type: 'full-reload', path: '*' })
      })
    },
  }
}
