// Verrou de SUITE, à l'échelle de la MACHINE (#1679 L1c-M7) : deux suites complètes jouées en même
// temps (deux arbres de travail, deux sessions) se disputent les cœurs et la mémoire, et la classe
// « 245 rouges jsdom » en sort. Le verrou est CONSULTATIF : il refuse le second lanceur en NOMMANT
// le premier (PID + commande), il ne tue personne. Opt-out EXPLICITE par `WFRP_SUITE_LOCK=0`.
// PORTÉE : le chemin `npm test` (`scripts/test/run.mjs`). Les autres entrées de Vitest ne passent pas
// par ce lanceur et restent hors porte : `npm run test:watch`, `npm run test:map` (scripts/map, court)
// et tout `npx vitest run` tapé à la main — `scripts/lancer-local.mjs` leur sert au moins le vitest
// de CET arbre.
import fsReel from 'node:fs'
import os from 'node:os'
import path from 'node:path'

/** Fichier de verrou partagé par tous les arbres de la machine. */
export const CHEMIN_VERROU = path.join(os.tmpdir(), 'wfrp-suite.lock')

/** Message de refus : qui tient le verrou, et les DEUX sorties (attendre, ou tuer / opt-out). */
export function refusVerrou({ chemin, tenant }) {
  return [
    `[verrou] une suite complète tourne déjà sur cette machine : PID ${tenant.pid}`,
    `[verrou] commande : ${tenant.commande ?? '(inconnue)'}`,
    `[verrou] arbre : ${tenant.cwd ?? '(inconnu)'}${tenant.date ? ` · depuis ${tenant.date}` : ''}`,
    `[verrou] deux suites concurrentes se volent cœurs et mémoire — attendre la fin, ou tuer ce PID.`,
    `[verrou] verrou : ${chemin} · opt-out explicite : WFRP_SUITE_LOCK=0`,
  ].join('\n')
}

/**
 * PREND le verrou. REND `{ etat }` :
 *  - `pris` (+ `liberer()`) : le fichier a été créé par CE processus ;
 *  - `refus` (+ `message`) : un PID VIVANT le tient ;
 *  - `ignore` (+ `avertissement`) : opt-out `WFRP_SUITE_LOCK=0`.
 * Un verrou laissé par un PID MORT (machine éteinte, run tué) est REPRIS.
 * `fs` et `estVivant` sont injectés pour la mesure ; par défaut, le disque et `process.kill(pid, 0)`.
 */
export function prendreVerrou({
  chemin = CHEMIN_VERROU,
  pid = process.pid,
  commande = '',
  cwd = '',
  env = process.env,
  fs = fsReel,
  estVivant = (p) => {
    try {
      process.kill(p, 0)
      return true
    } catch {
      return false
    }
  },
  maintenant = () => new Date().toISOString(),
} = {}) {
  if (env.WFRP_SUITE_LOCK === '0') {
    return {
      etat: 'ignore',
      avertissement:
        `[verrou] WFRP_SUITE_LOCK=0 : verrou de suite DÉSACTIVÉ — une suite concurrente sur cette ` +
        `machine reste possible (cœurs et mémoire partagés).`,
    }
  }
  const liberer = () => {
    try {
      fs.rmSync(chemin, { force: true })
    } catch {
      /* verrou déjà retiré : rien à libérer */
    }
  }
  for (let essai = 0; essai < 3; essai += 1) {
    let fd
    try {
      fd = fs.openSync(chemin, 'wx')
    } catch (e) {
      if (e.code !== 'EEXIST') throw e
      const tenant = lireTenant(fs, chemin)
      if (tenant && estVivant(tenant.pid)) {
        return { etat: 'refus', message: refusVerrou({ chemin, tenant }), tenant }
      }
      // PID mort, ou verrou illisible (écriture interrompue) : le verrou est repris.
      try {
        fs.rmSync(chemin, { force: true })
      } catch {
        /* concurrence : le second essai tranchera */
      }
      continue
    }
    try {
      fs.writeSync(fd, JSON.stringify({ pid, commande, cwd, date: maintenant() }))
    } finally {
      fs.closeSync(fd)
    }
    return { etat: 'pris', liberer }
  }
  // Trois reprises de suite : un autre lanceur recrée le verrou aussi vite qu'on le retire.
  return {
    etat: 'refus',
    message:
      `[verrou] verrou disputé (${chemin}) : un autre lanceur le reprend en boucle — relancer.`,
  }
}

/**
 * Le verrou est-il REQUIS pour ce run ? Un positionnel qui désigne un DOSSIER est une suite (`npm
 * test src` énumère 1 580 fichiers) : seul un run dont CHAQUE filtre nomme un FICHIER s'en passe.
 * `estFichier` est injecté pour la mesure ; le lanceur y met un `statSync().isFile()`.
 */
export function verrouRequis(filtres, estFichier) {
  return filtres.length === 0 || !filtres.every((f) => estFichier(f))
}

/** Contenu du verrou, ou `null` s'il est illisible / sans PID exploitable. */
function lireTenant(fs, chemin) {
  try {
    const brut = JSON.parse(fs.readFileSync(chemin, 'utf8'))
    return Number.isInteger(brut?.pid) ? brut : null
  } catch {
    return null
  }
}
