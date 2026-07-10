import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Gardes du SYSTÈME DE COMPOSANTS unifié (#236). Une garde par classe de conformité, scan de source
 * (comme `comment-poison-guard`/`combat-hardcode-guard`). L'objectif : une primitive ABSENTE est une
 * invitation à réinventer — donc on verrouille les coquilles de dialogue/écran à leurs primitives
 * canoniques (`Modal`, `ScreenShell`, `RollShell`), l'a11y à `useModalA11y`, et la proéminence des
 * barres de jet à la déduction par rôle (plus de style au call-site).
 */

const UI = fileURLToPath(new URL('.', import.meta.url)); // src/ui/

function walk(dir: string, acc: string[] = []): string[] {
  for (const e of readdirSync(dir)) {
    const p = join(dir, e);
    if (statSync(p).isDirectory()) walk(p, acc);
    else if (/\.tsx$/.test(e) && !/\.test\./.test(e)) acc.push(p);
  }
  return acc;
}
/** Chemin relatif POSIX à `src/ui/`. */
const rel = (abs: string) => abs.slice(UI.length).split('\\').join('/');
const FILES = walk(UI).map((f) => ({ rel: rel(f), src: readFileSync(f, 'utf8') }));

/** Valeurs de tous les attributs `className=` (double/simple/accolade+template) d'un fichier. */
function classNames(src: string): string[] {
  const out: string[] = [];
  const re = /className=(?:"([^"]*)"|'([^']*)'|\{`([^`]*)`|`([^`]*)`)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(src))) out.push(m[1] ?? m[2] ?? m[3] ?? m[4] ?? '');
  return out;
}

/** Idem, mais UNIQUEMENT le `className` d'un `<div>` natif — un modificateur passé en props à un
 *  composant (`<ScreenShell className="port-overlay">`) n'est pas un voile hand-rollé : le composant
 *  possède déjà le voile réel. */
function divClassNames(src: string): string[] {
  const out: string[] = [];
  const tagRe = /<div\b[^>]*>/g;
  let tag: RegExpExecArray | null;
  while ((tag = tagRe.exec(src))) out.push(...classNames(tag[0]));
  return out;
}

// Coquilles CANONIQUES (définissent le voile + l'a11y) et semi-canoniques SANCTIONNÉES (markup propre,
// squelette maison mais a11y `useModalA11y` câblée). Toute AUTRE surface passe par une primitive.
const OVERLAY_OWNERS = ['Modal.tsx', 'ScreenShell.tsx'];
// VictoryScreen/CampaignView (defeat) : splash plein-écran de RÉSULTAT (bouton unique, non fermable
// par Échap) — pas un dialogue (pas de role="dialog"/useModalA11y), donc hors du périmètre a11y de
// la primitive. Dette connue distincte, pas couverte par ce ticket de garde (#285).
const OVERLAY_WHITELIST = ['CharacterSheet.tsx', 'ShipSheet.tsx', 'InspectPanel.tsx', 'compendium/CompendiumScreen.tsx', 'VictoryScreen.tsx', 'CampaignView.tsx'];

describe('#236 — gardes du système de composants unifié', () => {
  // ── (ii) Le voile plein écran est une PRIMITIVE : `modal-overlay`/`worldmap-overlay` n'apparaissent
  //    en className qu'au sein de `Modal`/`ScreenShell`, plus une whitelist EXPLICITE de semi-canoniques. ──
  it('(ii) modal-overlay / worldmap-overlay : hors Modal/ScreenShell + whitelist des semi-canoniques', () => {
    const offenders = FILES.filter(
      (f) =>
        !OVERLAY_OWNERS.includes(f.rel) &&
        !OVERLAY_WHITELIST.includes(f.rel) &&
        divClassNames(f.src).some((c) => /\b[\w-]*-overlay\b/.test(c)),
    ).map((f) => f.rel);
    expect(
      offenders,
      'Voile hand-rollé hors primitive — composer <Modal>/<ScreenShell> (ou, si semi-canonique légitime, ajouter à OVERLAY_WHITELIST avec useModalA11y) :\n' + offenders.join('\n'),
    ).toEqual([]);
  });

  // ── (iii) Tout markup portant `role="dialog"` câble l'a11y partagée (`useModalA11y`) DANS LE MÊME
  //    fichier — un dialogue sans focus/Échap/piège Tab est un cul-de-sac clavier. ──
  it('(iii) role="dialog" ⇒ useModalA11y dans le même fichier', () => {
    const offenders = FILES.filter((f) => f.src.includes('role="dialog"') && !f.src.includes('useModalA11y')).map((f) => f.rel);
    expect(offenders, 'role="dialog" sans useModalA11y — câbler l’a11y (ou passer par <Modal>/<ScreenShell>) :\n' + offenders.join('\n')).toEqual([]);
  });

  // ── (i) Registre des coquilles : tout fichier qui MONTE une surface de dialogue/écran (voile
  //    hand-rollé OU `aria-modal`) importe une primitive canonique — pas de coquille orpheline. ──
  it('(i) toute coquille montée importe une primitive canonique (Modal/ScreenShell/RollShell)', () => {
    const IMPORTS_SHELL = (src: string) => /from '\.{1,2}\/(Modal|ScreenShell|RollShell)'/.test(src);
    const offenders = FILES.filter((f) => {
      if (OVERLAY_OWNERS.includes(f.rel) || OVERLAY_WHITELIST.includes(f.rel)) return false;
      const isShell = f.src.includes('aria-modal') || divClassNames(f.src).some((c) => /\b[\w-]*-overlay\b/.test(c));
      return isShell && !IMPORTS_SHELL(f.src);
    }).map((f) => f.rel);
    expect(offenders, 'Coquille montée sans import de primitive canonique :\n' + offenders.join('\n')).toEqual([]);
  });

  // ── (vi) Proéminence NORMÉE : aucune barre d'action de jet ne choisit son style au call-site — le
  //    champ `kind` a disparu de `RollAction` (déduction par rôle dans RollShell). Le TYPAGE l'impose
  //    déjà (excess property) ; cette garde ferme la porte à sa réintroduction textuelle. ──
  it('(vi) aucune action de jet ne porte de style de proéminence au call-site (kind supprimé)', () => {
    const offenders = FILES.filter((f) => /kind:\s*'(?:primary|ghost|resource)'/.test(f.src)).map((f) => f.rel);
    expect(offenders, 'Style de proéminence au call-site — retirer `kind` (RollShell déduit par rôle) :\n' + offenders.join('\n')).toEqual([]);
  });
});
