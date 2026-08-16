// Hook PreToolUse — garde anti-réinvention à la création d'un fichier sous `src/`.
//
// Deux régimes (#1318 V5, 2026-08-16) :
//   - `src/ui/**/*.tsx` NEUF (hors `*.test.tsx`) : BLOQUANT. Un composant d'UI est soit une PRIMITIVE
//     partagée (citée par la table « Primitives partagées » du CLAUDE.md), soit un ÉCRAN/panneau
//     inscrit au registre `scripts/hooks/ecrans-ui.json`. Ni l'un ni l'autre → sortie non-zéro : la
//     déclaration se fait AVANT le code, en une ligne de registre.
//   - tout autre fichier neuf sous `src/` : injection de contexte (rappel anti-réinvention).
//
// COUVERTURE RÉELLE (à énoncer, pas à supposer) — la garde ne voit que les outils listés au matcher
// `PreToolUse` des DEUX surfaces (`.claude/settings.json`, `.codex/hooks.json`) : `Write` et
// `mcp__lean-ctx__ctx_patch` (dont `op: "create"`, qui porte le chemin en `path` et non `file_path`).
// LIMITE RÉSIDUELLE assumée : tout chemin d'écriture qui ne passe pas par un outil matché échappe à
// la garde — redirection shell (`... > src/ui/X.tsx`, `tee`, `cp`), script Node lancé par un runner,
// éditeur externe. Le cliquet (xvii)/(x) de `src/ui/ui-ratchets.test.ts` et la revue restent la
// deuxième ligne ; ce hook est un rappel au geste, pas un mur étanche.
//
// Échappement documenté : `SKIP_NEW_SRC_GUARD=1` laisse passer et TRACE la dérogation (stderr +
// `.claude/logs/new-src-guard-skips.log`, gitignoré).
import { existsSync, readFileSync, appendFileSync, mkdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join, resolve, relative, isAbsolute } from 'node:path'

export const REPO = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
export const REGISTRE = join(REPO, 'scripts', 'hooks', 'ecrans-ui.json')
export const JOURNAL = join(REPO, '.claude', 'logs', 'new-src-guard-skips.log')

/**
 * Chemin relatif à la RACINE DU DÉPÔT, séparateurs POSIX — `null` si le fichier vit hors du dépôt
 * (un `D:/autre-projet/src/ui/X.tsx` ne regarde pas cette garde ; l'ancrage sur `lastIndexOf('src/')`
 * le prenait pour un composant maison).
 */
export function relPath(fp, repo = REPO) {
  const abs = isAbsolute(String(fp)) ? String(fp) : resolve(repo, String(fp))
  const rel = relative(repo, abs).replace(/\\/g, '/')
  // `relative` rend la cible TELLE QUELLE quand les racines diffèrent (autre volume Windows) —
  // un reste absolu ou préfixé d'une lettre de lecteur est donc « hors dépôt », pas un relatif.
  if (!rel || rel.startsWith('../') || isAbsolute(rel) || /^[A-Za-z]:/.test(rel)) return null
  return rel
}

/** Un composant d'UI soumis au régime bloquant (un harnais `.test.tsx` n'en est pas un). */
export function estComposantUI(rel) {
  return rel.startsWith('src/ui/') && rel.endsWith('.tsx') && !rel.endsWith('.test.tsx')
}

/** Déclaré = cité par la table des primitives du CLAUDE.md, OU inscrit au registre des écrans. */
export function estDeclare(rel, claudeMd, registre) {
  return claudeMd.includes(rel) || (registre.ecrans ?? []).includes(rel)
}

/** Corps du refus quand le registre est ILLISIBLE : le geste attendu est de le réparer. */
export function messageRegistreCasse(rel, cause) {
  return [
    `REFUS (fail-closed) — registre des composants d'UI ILLISIBLE : ${cause}`,
    '',
    `La déclaration de ${rel} ne peut pas être vérifiée : réparer d'abord`,
    '  scripts/hooks/ecrans-ui.json (JSON valide, clef "ecrans" = tableau de chemins)',
    "  ou CLAUDE.md s'il est absent de l'arbre (checkout partiel ?),",
    'puis relancer — la garde reprendra son cours normal.',
    '',
    "Ne PAS contourner en écrivant le fichier : sans registre lisible, plus rien n'est gardé.",
    'Urgence tracée : SKIP_NEW_SRC_GUARD=1 (journalisée dans .claude/logs/new-src-guard-skips.log).',
  ].join('\n')
}

export function messageRefus(rel) {
  return [
    `REFUS — composant d'UI NON DÉCLARÉ : ${rel}`,
    '',
    "Un nouveau .tsx de src/ui se déclare AVANT d'être écrit (#1318 V5) :",
    '  • PRIMITIVE partagée (réutilisable par N écrans) → ajouter sa ligne à la table',
    '    « Primitives partagées » du CLAUDE.md (besoin | primitive | fichier), puis relancer.',
    `  • ÉCRAN / panneau / modale / champ → ajouter "${rel}" au tableau "ecrans" de`,
    '    scripts/hooks/ecrans-ui.json (une ligne, ordre alphabétique), puis relancer.',
    '',
    "AVANT d'inscrire : vérifier qu'aucune primitive existante ne couvre le besoin (table du",
    'CLAUDE.md + 2-3 variantes du concept grepées dans src/ui) — la réutiliser ou l\'ÉTENDRE',
    'coûte moins que la Nᵉ copie.',
    '',
    'Dérogation pressée et TRACÉE : relancer avec SKIP_NEW_SRC_GUARD=1 (la dérogation est',
    'journalisée dans .claude/logs/new-src-guard-skips.log).',
  ].join('\n')
}

export const RAPPEL_SRC = (rel) =>
  `⚠ Ce Write CRÉE un nouveau fichier sous src/ (${rel}). ` +
  `Réflexe anti-réinvention : as-tu vérifié la table « Primitives partagées » du CLAUDE.md et grep 2-3 variantes du concept dans l'existant ? ` +
  `Si un module/primitive existant couvre le besoin, RÉUTILISE-le ou ÉTENDS-le (général + paramétrable) au lieu de créer ce fichier. ` +
  `Sinon, énonce explicitement pourquoi aucun existant ne convient avant de poursuivre.`

function trace(rel) {
  const ligne = `${new Date().toISOString()} SKIP_NEW_SRC_GUARD=1 ${rel}\n`
  try {
    mkdirSync(dirname(JOURNAL), { recursive: true })
    appendFileSync(JOURNAL, ligne)
  } catch {
    /* journal indisponible → la trace stderr ci-dessous reste */
  }
  process.stderr.write(`[new-src-file-guard] dérogation prise : ${ligne}`)
}

async function main() {
  let raw = ''
  process.stdin.setEncoding('utf8')
  for await (const chunk of process.stdin) raw += chunk

  // `Write` porte le chemin en `tool_input.file_path`, `ctx_patch` (op `create`) en `tool_input.path`.
  let fp
  try {
    const input = JSON.parse(raw)?.tool_input ?? {}
    fp = String(input.file_path ?? input.path ?? '')
  } catch {
    return // stdin illisible → silence
  }
  if (!fp || existsSync(fp)) return
  const rel = relPath(fp)
  if (!rel || !rel.startsWith('src/')) return // hors du dépôt, ou hors de src/

  if (estComposantUI(rel)) {
    // Registre ou CLAUDE.md illisible → on REFUSE (fail-closed) : un crash rendrait un statut 1,
    // que Claude Code traite comme non bloquant — la garde passerait à vide.
    let déclaré = false
    let panne = null
    try {
      const claudeMd = readFileSync(join(REPO, 'CLAUDE.md'), 'utf8')
      const registre = JSON.parse(readFileSync(REGISTRE, 'utf8'))
      déclaré = estDeclare(rel, claudeMd, registre)
    } catch (e) {
      panne = e.message
    }
    if (!déclaré) {
      if (process.env.SKIP_NEW_SRC_GUARD === '1') trace(rel)
      else {
        process.stderr.write((panne ? messageRegistreCasse(rel, panne) : messageRefus(rel)) + '\n')
        process.exit(2)
      }
    }
  }

  console.log(
    JSON.stringify({
      hookSpecificOutput: { hookEventName: 'PreToolUse', additionalContext: RAPPEL_SRC(rel) },
    }),
  )
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) await main()
