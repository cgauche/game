/**
 * GARDE de FORME des enjeux de nuit (#1117 L0b) — la leçon des deux lots : une vérification one-shot
 * n'existe pas, elle se COMMITTE. Chaque entrée de `night-stakes.json` déclare STRUCTURELLEMENT ce
 * qu'elle est (champ `form`), et la garde tient la promesse correspondante :
 *
 *  • `verbatim` (défaut) : CHAQUE bloc du `stake` est une sous-chaîne CONTIGUË d'UNE ligne du chapitre
 *    cité par `source.note` — donc recollable tel quel (règle stricte 5), sans préfixe fabriqué et
 *    sans fragment qui enjambe une coupure de folio (les marqueurs `data-folio` coupent les lignes) ;
 *  • `descripteur` : assemblage MÉCANIQUE assumé (ce que l'applier fait) — aucune contiguïté promise,
 *    mais la fiche `rule` est EXIGÉE : le verbatim intégral reste à un clic.
 *
 * Un assemblage NON déclaré échoue : c'est exactement le défaut qu'avait `disease-tick` (préfixes
 * « **Blessé :** »/« **Toxine :** » fabriqués, 2ᵉ fragment à cheval sur deux folios).
 */
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { NIGHT_STAKES, FLOW_STAKES, books, regles } from './index';

const RULE_IDS = new Set(regles.map((r) => r.id));

/** Lignes du fichier de CHAPITRE cité par une note (`LDB 18 l.343` → `18 - Traumatisme.md`). */
const chapterCache = new Map<string, string[]>();
function chapterLines(bookId: string, note: string): string[] {
  const chap = /^\S+\s+(\d+)/.exec(note)?.[1];
  if (!chap) throw new Error(`note sans numéro de chapitre : « ${note} »`);
  const key = `${bookId}#${chap}`;
  if (!chapterCache.has(key)) {
    const dir = books.find((b) => b.id === bookId)?.dir;
    if (!dir) throw new Error(`livre sans dossier d’extraction : ${bookId}`);
    const root = join(process.cwd(), dir);
    const file = readdirSync(root).find((f) => f.startsWith(`${chap.padStart(2, '0')} - `) && f.endsWith('.md'));
    if (!file) throw new Error(`chapitre ${chap} introuvable sous ${dir}`);
    chapterCache.set(key, readFileSync(join(root, file), 'utf8').split(/\r?\n/));
  }
  return chapterCache.get(key)!;
}

/** Un bloc est CONTIGU s'il est sous-chaîne d'UNE ligne du chapitre (jamais d'un corpus recollé :
 *  une concaténation ferait passer un fragment à cheval sur deux lignes/folios). */
const contigu = (lines: string[], bloc: string) => lines.some((l) => l.includes(bloc));

describe('night-stakes — la FORME de chaque enjeu est déclarée et tenue (#1117 L0b)', () => {
  it('tout `stake` déclaré VERBATIM est contigu au chapitre cité, bloc par bloc', () => {
    const defauts: string[] = [];
    for (const e of NIGHT_STAKES) {
      if (e.form === 'descripteur') continue;
      const lines = chapterLines(e.source.book, e.source.note ?? '');
      for (const bloc of e.stake.split('\n\n')) {
        if (!contigu(lines, bloc)) {
          defauts.push(`${e.id} : bloc NON contigu au Source (${e.source.note}) — « ${bloc.slice(0, 70)}… »`);
        }
      }
    }
    expect(defauts, 'un assemblage qui se présente comme du verbatim : le déclarer `descripteur` ou le rendre contigu').toEqual([]);
  });

  it('tout `stake` déclaré DESCRIPTEUR porte sa fiche (le verbatim reste à un clic)', () => {
    const sans = NIGHT_STAKES.filter((e) => e.form === 'descripteur' && (!e.rule || !RULE_IDS.has(e.rule))).map((e) => e.id);
    expect(sans, 'descripteur sans renvoi vers une fiche existante').toEqual([]);
  });

  it('les 15 entrées sont couvertes par l’un des deux régimes (aucune zone grise)', () => {
    expect(NIGHT_STAKES).toHaveLength(15);
    const inconnus = NIGHT_STAKES.filter((e) => e.form != null && e.form !== 'verbatim' && e.form !== 'descripteur');
    expect(inconnus).toEqual([]);
    // Le stock d'assemblages est NOMMÉ et borné : chaque `descripteur` est un choix motivé, pas un repli.
    expect(NIGHT_STAKES.filter((e) => e.form === 'descripteur').map((e) => e.id).sort())
      .toEqual(['disease-tick', 'nightmare']);
  });

  it('FAIL-CLOSED : un fragment fabriqué ou à cheval sur deux lignes est DÉTECTÉ', () => {
    const lines = chapterLines('livre-de-base', 'LDB 20 l.145');
    // Le vrai passage du symptôme Blessé — contigu.
    expect(contigu(lines, "ou subissez une Blessure Purulente si vous n'en avez pas déjà une.")).toBe(true);
    // Le préfixe FABRIQUÉ (la source titre `### **Blessé**`, elle n'écrit jamais « **Blessé :** »).
    expect(contigu(lines, '**Blessé :** Chaque jour')).toBe(false);
    // Un fragment recollé par-dessus la coupure de folio de Toxine (l.212 → l.215).
    expect(contigu(lines, 'tous les jours (en général pendant votre sommeil)')).toBe(false);
  });
});

/**
 * MÊME contrat de forme pour le dataset des MODALES MONO (#1117 L1b) : la promesse suit la
 * DÉCLARATION, pas la famille. `flow-stakes.json` rend `form` OBLIGATOIRE au schéma (pas de défaut
 * implicite) — la garde tient les deux régimes avec le MÊME `contigu`.
 */
describe('flow-stakes — la FORME de chaque enjeu de modale mono est déclarée et tenue (#1117 L1b)', () => {
  it('tout `template` déclaré VERBATIM est contigu au chapitre cité, bloc par bloc', () => {
    const defauts: string[] = [];
    for (const e of FLOW_STAKES) {
      if (e.form !== 'verbatim') continue;
      const lines = chapterLines(e.source.book, e.source.note ?? '');
      for (const bloc of e.template.split('\n\n')) {
        if (!contigu(lines, bloc)) {
          defauts.push(`${e.id} : bloc NON contigu au Source (${e.source.note}) — « ${bloc.slice(0, 70)}… »`);
        }
      }
    }
    expect(defauts, 'un assemblage qui se présente comme du verbatim : le déclarer `descripteur` ou le rendre contigu').toEqual([]);
  });

  it('tout `template` déclaré DESCRIPTEUR porte SA porte (le verbatim reste à un clic)', () => {
    const sans = FLOW_STAKES
      .filter((e) => e.form === 'descripteur' && !e.entryCategory && !(e.rule && e.ruleCategory))
      .map((e) => e.id);
    expect(sans, 'descripteur sans foyer ni catégorie d’entrée').toEqual([]);
  });

  it('chaque entrée est couverte par l’un des deux régimes, et son id de jet est UNIQUE', () => {
    expect(FLOW_STAKES.length).toBeGreaterThan(0);
    const inconnus = FLOW_STAKES.filter((e) => e.form !== 'verbatim' && e.form !== 'descripteur').map((e) => e.id);
    expect(inconnus, 'régime de forme inconnu').toEqual([]);
    const kinds = FLOW_STAKES.map((e) => `${e.flow}/${e.phase}`);
    expect(kinds.length, 'deux entrées se disputent le MÊME id de jet {flow, phase}').toBe(new Set(kinds).size);
  });
});
