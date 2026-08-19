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
import { NIGHT_STAKES, FLOW_STAKES, ACTIVITY_STAKES, books, regles } from './index';
import { ACTIVITIES } from '../engine/activities';

const RULE_IDS = new Set(regles.map((r) => r.id));

/** Lignes du fichier de CHAPITRE cité par une note (`LDB 18 l.342` → `18 - Traumatisme.md`). */
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

/**
 * MÊME contrat de forme pour les ACTIVITÉS (#1117 L3), 4ᵉ dataset d'enjeux — porté par l'ENTITÉ
 * (`activities.json`, champs `stake`/`stakeForm`). La différence d'ancrage est nommée : une Activité
 * cite son folio (`source.page`), pas une ligne de chapitre — un enjeu déclaré `verbatim` doit donc
 * fournir `source.note` pour être localisable, faute de quoi la contiguïté n'est pas démontrable et
 * le régime est refusé. Aucune entrée n'est aujourd'hui `verbatim` (les 46 sont des descripteurs de
 * ce que le résolveur applique) : la branche est tenue par le FAIL-CLOSED ci-dessous, pas par un
 * échantillon — c'est le prix d'un régime ouvert mais inemployé.
 */
describe('activities — la FORME de chaque enjeu d’Activité est déclarée et tenue (#1117 L3)', () => {
  const avecEnjeu = ACTIVITY_STAKES.filter((a) => a.stake);

  it('toute Activité qui porte un enjeu DÉCLARE sa forme', () => {
    const sans = avecEnjeu.filter((a) => a.stakeForm !== 'verbatim' && a.stakeForm !== 'descripteur').map((a) => a.id);
    expect(sans, 'un assemblage qui ne dit pas ce qu’il est').toEqual([]);
  });

  it('tout `stake` déclaré VERBATIM est localisable ET contigu au chapitre cité, bloc par bloc', () => {
    const defauts: string[] = [];
    for (const a of avecEnjeu.filter((x) => x.stakeForm === 'verbatim')) {
      const entry = ACTIVITIES.find((x) => x.id === a.id)!;
      const note = (entry.source as { note?: string }).note;
      if (!note) { defauts.push(`${a.id} : verbatim sans source.note — passage non localisable`); continue; }
      const lines = chapterLines(entry.source.book, note);
      for (const bloc of a.stake!.split('\n\n')) {
        if (!contigu(lines, bloc)) defauts.push(`${a.id} : bloc NON contigu au Source (${note}) — « ${bloc.slice(0, 70)}… »`);
      }
    }
    expect(defauts, 'le déclarer `descripteur` ou le rendre contigu').toEqual([]);
  });

  it('le stock DESCRIPTEUR est celui mesuré, et chaque descripteur porte SA porte', () => {
    const descripteurs = avecEnjeu.filter((a) => a.stakeForm === 'descripteur');
    expect(descripteurs.length).toBe(46);
    expect(avecEnjeu.filter((a) => a.stakeForm === 'verbatim').length).toBe(0);
    // Porte = le foyer déclaré, ou l'Activité elle-même (qui doit alors porter sa `desc` verbatim —
    // vérifié nominativement par `activity-stake-ratchet`).
    const sansPorte = descripteurs.filter((a) => a.rule && !a.ruleCategory).map((a) => a.id);
    expect(sansPorte, 'foyer déclaré sans catégorie Codex').toEqual([]);
  });

  it('FAIL-CLOSED : le même `contigu` reconnaît un passage réel d’activité et rejette un assemblage', () => {
    const lines = chapterLines('ennemi-dans-l-ombre-compagnon', 'EDOC 8 l.157');
    expect(contigu(lines, 'les Personnages ne peuvent pas être surpris pendant cette étape de leur voyage.')).toBe(true);
    // Le descripteur mécanique de « Rester aux aguets » n'est PAS du verbatim — le déclarer tel échouerait.
    expect(contigu(lines, 'Réussite : le groupe ne peut pas être surpris pendant cette Étape.')).toBe(false);
  });
});
