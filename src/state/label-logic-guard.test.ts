import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { scanLabelLogic } from '../../scripts/guards/lib/labelLogic.mjs';

/**
 * Garde-fou « logique par LABEL interdite » (#142, doctrine CLAUDE.md bloc agents) : toute LOGIQUE est
 * keyée par `id` STABLE — le `label` est de l'AFFICHAGE (multilangue). Scanne `src/engine` + `src/state`
 * (moteur/store, #142) + `src/gameIso` + `src/ui` (#289, rendu iso + UI) récursif, `.ts`/`.tsx`, HORS
 * `*.test.*` : ÉCHEC si le code (commentaires retirés) porte une carte par label (`XXX_BY_LABEL`/
 * `byLabel`) ou une comparaison D'ÉGALITÉ sur `.label` (`x.label === …` / `… === x.label`) — les deux
 * formes remplacent un `id` STABLE par une identité de libellé.
 *
 * `src/engine`/`src/state` restent TOLÉRANCE ZÉRO, AUCUNE exception (l'instance de référence,
 * `creatureEquip.ts` SHAPE_BY_LABEL/RELOAD_BY_LABEL, est déjà migrée — rien ne justifie un répit
 * dans le moteur/store).
 *
 * `src/gameIso`/`src/ui` (#289, élargissement) portent un ratchet à EXCEPTIONS JUSTIFIÉES
 * (patron `no-emoji-affordance.test.ts`/LOT 4) : un `fichier:ligne` par site, chacun un pattern
 * DIFFÉRENT du FK-par-label originel (#142) — recherche/diagnostic, pas persistance de logique :
 *  - diagnostic DEV qui détecte PRÉCISÉMENT un mésusage label-au-lieu-d'id (comparer par id
 *    annulerait le diagnostic) ;
 *  - saisie/recherche UI par texte tapé (le label EST la clé de recherche humaine, motif `RefField`
 *    freeText déjà sanctionné) sur un type qui ne porte PAS d'id (aucune régression possible) ;
 *  - auto-liage de PROSE par texte (Codex) — matching textuel, pas une FK.
 * Chaque exception se justifie ligne par ligne ; une migration mécanique retire son entrée (CLIQUET).
 */
const ROOT = fileURLToPath(new URL('../..', import.meta.url)); // src/state/ → ../../ = racine du projet
const STRICT_DIRS = ['src/engine', 'src/state'];
const RATCHET_DIRS = ['src/gameIso', 'src/ui'];

// `src/data/index.ts` = SEULE couture label→id tolérée (au CHARGEMENT, cf. docstring ci-dessus) — hors
// périmètre même si `src/data` entrait un jour dans SCAN_DIRS.
const EXCLUDED = (rel: string) => /\.test\.[tj]sx?$/.test(rel) || rel === 'src/data/index.ts';

// Exceptions JUSTIFIÉES (#289, src/gameIso + src/ui SEULEMENT — src/engine/src/state restent à zéro).
// Une entrée = `fichier:ligne` EXACT constaté au recensement ; toute dérive de ligne ou nettoyage du
// site fait échouer le CLIQUET ci-dessous (à réviser, pas à re-décaler idempotemment). ⚠ `ligne` est
// celle rapportée par `scanLabelLogic` (contenu POST-retrait des commentaires de bloc, cf.
// `stripComments` — peut différer du numéro de ligne brut du fichier si un bloc `/* … */` multi-lignes
// précède le site).
const RATCHET_EXCEPTIONS: Record<string, string> = {
  'ui/CharacterSheet.tsx:805': "SlotChoiceRow : options éphémères {label, display, owned} SANS id — `label` EST la valeur de câblage documentée (cf. docstring du composant), pas une FK vers une entité de donnée.",
  'ui/compendium/CompendiumScreen.tsx:82': 'CodexItem (registry.ts) agrège ~20 catégories hétérogènes SANS id unifié — le Codex, navigateur de référence en LECTURE SEULE, sélectionne par label par construction.',
  'ui/compendium/CompendiumScreen.tsx:84': 'idem CompendiumScreen.tsx:82 (CodexItem sans id unifié).',
  'ui/compendium/CompendiumScreen.tsx:126': 'idem CompendiumScreen.tsx:82 (CodexItem sans id unifié).',
  'ui/compendium/relations.ts:311': "auto-liage de PROSE (tokenizeLinks) : matching TEXTUEL d'un terme de règle vers son entité, pas une FK — aucun id en jeu (le texte affiché EST la recherche).",
  'ui/creator/CharacterCreator.tsx:127': "WEAPON_ID_BY_LABEL : id disponible des deux côtés (trappings) — debt RÉELLE, migration différée (le state de draft `specChoices`/`weaponChoice` est un Record<string,string> partagé par TOUS les choix « au choix », pas juste l'arme — refactor multi-site hors périmètre garde).",
  'ui/creator/CharacterCreator.tsx:1084': 'idem CharacterCreator.tsx:127 (même WEAPON_ID_BY_LABEL).',
  'ui/InterludeScreen.tsx:649': "LearnPane : recherche par texte tapé (motif `RefField` freeText) sur `LearnOption` qui PORTE un id (`sel.id`) — migration possible vers id-first mais composant de saisie à refactorer, hors périmètre garde.",
  'ui/TabbedEntry.tsx:35': "fallback DÉLIBÉRÉ et documenté (JSDoc du composant) : résolution PAR ID en premier, repli par nom SEULEMENT pour garder un onglet actif au changement de fiche (UX, pas une FK).",
};

// Mécanique de scan (stripComments + BY_LABEL_RX/LABEL_EQ_RX + scanLabelLogic) :
// `scripts/guards/lib/labelLogic.mjs` (module .mjs pur, partagé avec un futur hook pre-commit).

function scanFiles(dirs: string[]): string[] {
  const files: string[] = [];
  const walk = (dir: string) => {
    for (const e of readdirSync(dir)) {
      const p = join(dir, e);
      if (statSync(p).isDirectory()) walk(p);
      else if (/\.tsx?$/.test(e)) files.push(p);
    }
  };
  for (const d of dirs) walk(join(ROOT, d));
  return files;
}

function findingsIn(dirs: string[]): { rel: string; line: number; detail: string }[] {
  const out: { rel: string; line: number; detail: string }[] = [];
  for (const f of scanFiles(dirs)) {
    const rel = relative(ROOT, f).split('\\').join('/');
    if (EXCLUDED(rel)) continue;
    const contenu = readFileSync(f, 'utf8');
    for (const finding of scanLabelLogic(rel, contenu)) out.push({ rel, line: finding.line, detail: finding.detail });
  }
  return out;
}

describe('garde-fou « logique par label interdite » (#142)', () => {
  it('src/engine + src/state : TOLÉRANCE ZÉRO, aucune carte/comparaison par label', () => {
    const offenders = findingsIn(STRICT_DIRS).map((f) => `${f.rel}:${f.line}: ${f.detail}`);
    expect(
      offenders,
      'Logique par LABEL détectée dans src/engine ou src/state — doctrine : `id` stable pour la logique, ' +
        '`label` = affichage seul. Migrer vers un keying par id (cf. `src/data/index.ts` pour la seule ' +
        'couture label→id tolérée, au CHARGEMENT).',
    ).toEqual([]);
  });

  it('src/gameIso + src/ui (#289) : aucune régression hors des exceptions justifiées', () => {
    const offenders: string[] = [];
    for (const f of findingsIn(RATCHET_DIRS)) {
      // `f.rel` est relatif à la racine (`src/gameIso/...`/`src/ui/...`) ; les clés d'exception omettent `src/`.
      const shortKey = `${f.rel.replace(/^src\//, '')}:${f.line}`;
      if (!(shortKey in RATCHET_EXCEPTIONS)) offenders.push(`${f.rel}:${f.line}: ${f.detail}`);
    }
    expect(
      offenders,
      "Logique par LABEL non-exceptée dans src/gameIso/src/ui — migrer vers un keying par id, ou ajouter " +
        'une entrée JUSTIFIÉE à RATCHET_EXCEPTIONS (label-logic-guard.test.ts) :\n' + offenders.join('\n'),
    ).toEqual([]);
  });

  it('CLIQUET : toute exception dont le site a bougé/disparu doit être RETIRÉE ou re-justifiée', () => {
    const findings = findingsIn(RATCHET_DIRS);
    const present = new Set(findings.map((f) => `${f.rel.replace(/^src\//, '')}:${f.line}`));
    const stale = Object.keys(RATCHET_EXCEPTIONS).filter((k) => !present.has(k));
    expect(stale, 'Exception(s) PÉRIMÉE(s) (site déplacé ou assaini) — retirer/re-pointer ces entrées de RATCHET_EXCEPTIONS :\n' + stale.join('\n')).toEqual([]);
  });
});
