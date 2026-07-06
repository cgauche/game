import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  EXCUSE_GUARD_ACTIVE,
  TOMBSTONE_FAMILIES,
  tombstonesIn,
  untaggedExcuseMatch,
  extractComments,
  matchLine,
  excerptAt,
} from '../scripts/guards/lib/commentPoison.mjs';

/**
 * Garde-fou commentaires (#136) — l'app détecte elle-même le poison de commentaires (CLAUDE.md règle 6).
 * Deux familles scannées, dans les COMMENTAIRES de src/**\/*.ts(x) seulement (jamais les chaînes ni le
 * texte de scénario) :
 *   1. PIERRE TOMBALE (règle 6c) — rappelle un état de code qui n'existe plus. Tolérance ZÉRO, aucune
 *      liste d'exception : un cas légitime se reformule plutôt que d'être toléré.
 *   2. Commentaire-EXCUSE (règle 6b) — justifie une exception ou une déviation sans validation
 *      traçable. Seul un tag `[entériné AAAA-MM-JJ]` porté par le MÊME commentaire la neutralise.
 * MÉCANIQUE de scan (extraction de commentaires, familles de regex) dans
 * `scripts/guards/lib/commentPoison.mjs` — module .mjs pur, partagé avec un futur hook pre-commit
 * (exécutable par `node` nu, sans tsx). Ici : uniquement les données de POLICY (EXCUSE_GUARD_ACTIVE)
 * et le parcours fs.
 */

const ROOT = fileURLToPath(new URL('..', import.meta.url)); // racine du projet (src/ → ..)
const SRC_DIR = join(ROOT, 'src');

function scanSrcFiles(): string[] {
  const files: string[] = [];
  const walk = (dir: string) => {
    for (const e of readdirSync(dir)) {
      const p = join(dir, e);
      if (statSync(p).isDirectory()) walk(p);
      else if (/\.(ts|tsx)$/.test(e)) files.push(p);
    }
  };
  walk(SRC_DIR);
  return files;
}

// ---------------------------------------------------------------------------------------------
// Famille 1 — PIERRE TOMBALE (CLAUDE.md règle 6c). Tolérance ZÉRO, pas d'exception.
// Familles de regex + `tombstonesIn` : `scripts/guards/lib/commentPoison.mjs` (mécanique partagée).
// ---------------------------------------------------------------------------------------------

describe('garde-fou commentaires — pierres tombales (#136, CLAUDE.md règle 6c)', () => {
  it('cas planté : un rappel d\'ancien emplacement est détecté (preuve TDD)', () => {
    const planted = "// Cette logique vit ici anciennement dans un autre module.";
    expect(tombstonesIn(planted)).toContain('anciennement');
  });

  it('cas planté : "déplacé(e) vers/dans" est détecté même au féminin/pluriel (preuve TDD)', () => {
    expect(tombstonesIn('// Fonction déplacée vers state/foo.ts').length).toBeGreaterThan(0);
    expect(tombstonesIn('// Fonctions déplacées dans state/foo.ts').length).toBeGreaterThan(0);
  });

  it('faux positif écarté : "déplacé dans la boîte" (a11y, pas du code — affinage #136)', () => {
    expect(tombstonesIn('// focus déplacé dans la boîte à l\'ouverture.')).toEqual([]);
  });

  it('cas planté : "l\'ancien X a été supprimé" est détecté (preuve TDD affinage #136)', () => {
    expect(tombstonesIn("// L'ancien registre `FOO_BY_LABEL` a été supprimé.").length).toBeGreaterThan(0);
    expect(tombstonesIn('// Le marqueur `(2M)` a été supprimé.').length).toBeGreaterThan(0);
  });

  it('faux positif écarté : "une PA/ration a été retirée" (vocabulaire de jeu — affinage #136)', () => {
    expect(tombstonesIn('// RETOURNE true si une PA a été retirée.')).toEqual([]);
    expect(tombstonesIn("// Une ration a été retirée de l'inventaire.")).toEqual([]);
  });

  it('cas planté : "comme avant :" et "avant : «X»" sont détectés (preuve TDD affinage #136)', () => {
    expect(tombstonesIn('// ignorées (comme avant : un libellé non catalogué n\'était pas trouvé).').length).toBeGreaterThan(0);
    expect(tombstonesIn('// doit ouvrir la modale (avant : « hors de portée »)').length).toBeGreaterThan(0);
  });

  it('faux positif écarté : "avant" de façade/rendu/entraînement (affinage #136)', () => {
    expect(tombstonesIn("// Cadre d'avant : ARC VU DE CHANT.")).toEqual([]);
    expect(tombstonesIn("// vue de dos (plan avant : couvre le dos, plis)")).toEqual([]);
    expect(tombstonesIn("// qui pointe vers l'avant : sinon de profil la jambe est un poteau nu.")).toEqual([]);
    expect(tombstonesIn('// Espèces mises en avant : celles du Livre de base.')).toEqual([]);
    expect(tombstonesIn('// avant : Esquive pénalisée')).toEqual([]);
    expect(tombstonesIn("// avant : pas d'arme à 2 mains")).toEqual([]);
  });

  it('cas planté : un commentaire neutre ne matche aucune famille (contrôle négatif)', () => {
    expect(tombstonesIn('// Calcule le total des dégâts appliqués à la cible.')).toEqual([]);
  });

  it('aucun commentaire de src/**/*.ts(x) ne porte une pierre tombale (tolérance ZÉRO, pas d’exception)', () => {
    const offenders: string[] = [];
    for (const f of scanSrcFiles()) {
      const rel = relative(ROOT, f).split('\\').join('/');
      const text = readFileSync(f, 'utf8');
      for (const c of extractComments(text)) {
        for (const fam of TOMBSTONE_FAMILIES) {
          const m = fam.rx.exec(c.text);
          if (m) offenders.push(`${rel}:${matchLine(c, m.index)} [${fam.label}] ${excerptAt(c, m.index)}`);
        }
      }
    }
    expect(
      offenders,
      `Pierre(s) tombale(s) détectée(s) — à PURGER (jamais à taguer en exception, CLAUDE.md règle 6c) :\n${offenders.join('\n')}`,
    ).toEqual([]);
  });
});

// ---------------------------------------------------------------------------------------------
// Famille 2 — commentaire-EXCUSE (CLAUDE.md règle 6b). Un tag `[entériné AAAA-MM-JJ]` dans le MÊME
// commentaire neutralise la détection (décision utilisateur traçable).
// Regex + `untaggedExcuseMatch` : `scripts/guards/lib/commentPoison.mjs` (mécanique partagée).
// ---------------------------------------------------------------------------------------------

describe('garde-fou commentaires — excuses non tracées (#136, CLAUDE.md règle 6b)', () => {
  it('cas planté : une justification sans tag est détectée (preuve TDD)', () => {
    expect(untaggedExcuseMatch("// on garde X pour l'instant")).not.toBeNull();
  });

  it('cas planté : le tag [entériné AAAA-MM-JJ] neutralise la détection (preuve TDD)', () => {
    expect(untaggedExcuseMatch("// on garde X pour l'instant [entériné 2026-07-06]")).toBeNull();
  });

  it('cas planté : un commentaire neutre ne matche pas (contrôle négatif)', () => {
    expect(untaggedExcuseMatch('// Calcule le total des dégâts appliqués à la cible.')).toBeNull();
  });

  it('faux positifs écartés : « pas encore <participe de mécanique> » = état de partie (affinage 2026-07-06)', () => {
    expect(untaggedExcuseMatch('// null = pas encore lancé (rien à re-dériver).')).toBeNull();
    expect(untaggedExcuseMatch('// Round 1 pas encore commencé (sujet HORS-TOUR).')).toBeNull();
    expect(untaggedExcuseMatch('// chargée + pas encore tiré ce Round (Tir rapide).')).toBeNull();
    expect(untaggedExcuseMatch('// pas encore de Contre-sort ce Round.')).toBeNull();
    expect(untaggedExcuseMatch('// Test étendu de Calme pas encore au niveau.')).toBeNull();
  });

  it('faux positifs écartés : « temporairement <durée d\'effet> » et « épargné par <règle> » (affinage 2026-07-06)', () => {
    expect(untaggedExcuseMatch('// Chance accordée temporairement, retirée à expiration.')).toBeNull();
    expect(untaggedExcuseMatch('// temporairement insensible (Détermination, LDB 17).')).toBeNull();
    expect(untaggedExcuseMatch('// les PA magiques sont épargnés par Ulgu.')).toBeNull();
  });

  it('vraies excuses TOUJOURS détectées après affinage (preuve TDD)', () => {
    expect(untaggedExcuseMatch('// pas encore migré vers le registre canonique')).not.toBeNull();
    expect(untaggedExcuseMatch('// paramètre non utilisé pour l\'instant par les appelants')).not.toBeNull();
    expect(untaggedExcuseMatch('// on assume cette exception ici')).not.toBeNull();
  });

  (EXCUSE_GUARD_ACTIVE ? it : it.skip)(
    'aucune excuse de src/**/*.ts(x) sans tag [entériné AAAA-MM-JJ] (désactivée — cf. rapport agent)',
    () => {
      const offenders: string[] = [];
      for (const f of scanSrcFiles()) {
        const rel = relative(ROOT, f).split('\\').join('/');
        const text = readFileSync(f, 'utf8');
        for (const c of extractComments(text)) {
          const m = untaggedExcuseMatch(c.text);
          if (m) offenders.push(`${rel}:${matchLine(c, m.index)} ${excerptAt(c, m.index)}`);
        }
      }
      expect(
        offenders,
        `Excuse(s) sans tag \`[entériné AAAA-MM-JJ]\` (CLAUDE.md règle 6b) :\n${offenders.join('\n')}`,
      ).toEqual([]);
    },
  );
});
