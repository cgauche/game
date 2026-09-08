import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it, expect } from 'vitest';
import { parseProject, type ProjectDoc } from '../state/worldMap';
import { validateScene } from '../state/validateScene';
import { books } from '../data';
import { rigSpeciesVocab } from '../gameIso/rig/appearance';
import { TENUE_BY_ID } from '../gameIso/rig/parts/tenues';

/**
 * Garde TRANSVERSE (#809) : tout paquet bundlé `src/scenes/*.../*-projet.json` doit se relire dans
 * le modèle COURANT — `parseProject` sans lever, avec une IDENTITÉ valide (`id`/`label`/
 * `versionContenu`, plats à la racine depuis #1467 L1b). Couvre TOUT paquet présent OU futur (glob
 * récursif de `src/scenes`, jamais une liste de noms en dur) : `scripts/arene/generate.mjs` était le
 * DERNIER générateur à écrire un littéral `schema: 2` sans identité (au lieu de `projectDoc()`,
 * `scripts/campagne/lib.mjs`) — cette garde empêche cette classe de dérive de revenir, pour ce
 * paquet comme pour tout futur paquet de campagne.
 */
const SCENES_DIR = join(__dirname);

function findBundledProjectFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...findBundledProjectFiles(full));
    else if (entry.isFile() && entry.name.endsWith('-projet.json')) out.push(full);
  }
  return out;
}

const bundledFiles = findBundledProjectFiles(SCENES_DIR);

/** Erreurs de contenu d'un paquet, chacune NOMMANT son fautif (scène / portée / réf) — jamais un compte. */
function erreursDe(doc: Pick<ProjectDoc, 'scenes' | 'worldMap'>): string[] {
  return validateScene(doc.scenes, doc.worldMap)
    .filter((w) => w.level === 'error')
    .map((w) => `${w.sceneId} [${w.scope}${w.refId ? ` ${w.refId}` : ''}] ${w.message}`);
}

describe('paquets de campagne bundlés — se relisent tous dans le modèle COURANT (#809)', () => {
  it('au moins un paquet trouvé (la garde couvre réellement quelque chose)', () => {
    expect(bundledFiles.length).toBeGreaterThan(0);
  });

  it.each(bundledFiles.map((f) => [f] as const))('%s : parseProject ne lève pas et porte une identité valide', (file) => {
    const raw = JSON.parse(readFileSync(file, 'utf8'));
    const doc = parseProject(raw);
    expect(doc.id, `${file} : identité absente — régénérer via projectDoc()`).toBeTruthy();
    expect(typeof doc.id).toBe('string');
    expect(doc.id!.length).toBeGreaterThan(0);
    expect(typeof doc.label).toBe('string');
    expect(doc.label!.length).toBeGreaterThan(0);
    expect(typeof doc.versionContenu).toBe('number');
    // L'identité est PLATE : la poche `meta` d'avant #1467 L1b ne survit nulle part.
    expect('meta' in (doc as Record<string, unknown>)).toBe(false);
  });

  /**
   * Une entité `personnage` n'a d'apparence à résoudre que par sa RÉF (créature/véhicule du catalogue)
   * ou par son ESPÈCE (`appearance.species`) : `entityRigProfileFor` (`src/gameIso/rig/enemyProfile.ts:270-274`)
   * n'en dérive AUCUNE sans l'une des deux, et le rendu signale l'entité muette en dev. Garde TRANSVERSE :
   * elle couvre les 4 paquets bundlés et tout paquet FUTUR par le même glob — aucune ligne à ajouter.
   */
  it.each(bundledFiles.map((f) => [f] as const))(
    '%s : toute entité PERSONNAGE résout son apparence (réf de catalogue OU Espèce du rig, tenue résolue)',
    (file) => {
      const doc = parseProject(JSON.parse(readFileSync(file, 'utf8')));
      const muettes: string[] = [];
      const inconnues: string[] = [];
      for (const sc of doc.scenes)
        for (const e of sc.entities) {
          if (e.kind !== 'personnage') continue;
          const species = e.appearance?.species;
          if (!e.ref && !species) muettes.push(`${sc.id}:${e.id} (${e.label ?? e.statblock?.label ?? 'sans nom'})`);
          if (species && !rigSpeciesVocab().has(species)) inconnues.push(`${sc.id}:${e.id} espèce « ${species} »`);
          if (e.appearance?.tenue && !TENUE_BY_ID[e.appearance.tenue]) inconnues.push(`${sc.id}:${e.id} tenue « ${e.appearance.tenue} »`);
        }
      expect(muettes, 'entité(s) de personnage sans réf NI Espèce — le rig n’a rien à dessiner et le rendu le signale en dev').toEqual([]);
      expect(inconnues, 'espèce/tenue hors des registres du rig — l’apparence retombe en repli muet').toEqual([]);
    },
  );

  /**
   * Toute entité `personnage` porte un NOM affichable au combat : soit sa réf de catalogue (le label
   * vient de la créature/du véhicule, `spawn.ts:275`), soit le label de son CustomStatblock d'auteur
   * (`spawn.ts:339` lit `sb.label` SANS repli — un statbloc sans label spawne un combattant anonyme).
   * Le `label` d'entité, lui, est facultatif : les ennemis de rencontre n'en portent pas.
   */
  it.each(bundledFiles.map((f) => [f] as const))('%s : toute entité PERSONNAGE porte un nom résoluble (réf, ou label de statbloc)', (file) => {
    const doc = parseProject(JSON.parse(readFileSync(file, 'utf8')));
    const anonymes: string[] = [];
    for (const sc of doc.scenes)
      for (const e of sc.entities) {
        if (e.kind !== 'personnage') continue;
        if (!e.ref && !e.statblock?.label && !e.label) anonymes.push(`${sc.id}:${e.id}`);
      }
    expect(anonymes, 'entité(s) de personnage sans nom — le combattant spawne anonyme (spawn.ts:339)').toEqual([]);
  });

  /**
   * `validateScene` est le juge du CONTENU d'un projet (réfs cassées, connectivité, empreinte de spawn,
   * porte orpheline, arrivée de carte du monde — familles couvertes sur fixtures par
   * `state/validateScene-contenu.test.ts`). Un paquet livré ne part avec AUCUNE de ses erreurs : la garde
   * ne nomme ni scène ni contenu, elle relit le verdict du moteur sur ce que le glob trouve.
   */
  it.each(bundledFiles.map((f) => [f] as const))('%s : validateScene ne rend AUCUNE erreur', (file) => {
    const doc = parseProject(JSON.parse(readFileSync(file, 'utf8')));
    expect(erreursDe(doc)).toEqual([]);
  });

  it('CONTRE-PREUVE : une réf de créature inexistante glissée dans une COPIE d’un paquet livré rougit la garde, en nommant la scène et l’entité', () => {
    // ⚠ copie EN MÉMOIRE — aucun fichier touché.
    const trouve = bundledFiles
      .map((file) => ({ file, doc: parseProject(JSON.parse(readFileSync(file, 'utf8'))) }))
      .flatMap(({ file, doc }) =>
        doc.scenes.flatMap((sc) =>
          sc.entities
            .filter((e) => e.kind === 'personnage' && e.ref && !e.statblock && !e.presetId)
            .map((e) => ({ file, doc, sceneId: sc.id, entityId: e.id, entity: e })),
        ),
      )[0];
    expect(trouve, 'aucun paquet livré ne porte de personnage à réf de bestiaire — la contre-preuve n’a plus de sujet').toBeTruthy();
    const { doc, sceneId, entityId, entity } = trouve!;
    const casse = {
      ...doc,
      scenes: doc.scenes.map((sc) =>
        sc.id !== sceneId ? sc : { ...sc, entities: sc.entities.map((e) => (e === entity ? { ...e, ref: 'creature-qui-n-existe-pas' } : e)) },
      ),
    };
    const erreurs = erreursDe(casse);
    expect(erreurs.some((m) => m.includes(sceneId) && m.includes(entityId) && m.includes('creature-qui-n-existe-pas'))).toBe(true);
  });

  it('CONTRE-PREUVE : un paquet ramené au format PRÉCÉDENT (schema 2, sans identité) est REFUSÉ À LA PORTE', () => {
    const raw = JSON.parse(readFileSync(bundledFiles[0], 'utf8'));
    // ⚠ copie EN MÉMOIRE — aucun fichier touché. Les scènes sont dépouillées de leur `type` : au
    // format 2, une scène ne s'annonçait pas (c'est `PROJECT_MIGRATIONS[6]` qui le pose, #1552).
    const scenes = raw.scenes.map(({ type: _s, ...reste }: Record<string, unknown>) => reste);
    const regressed = { schema: 2, scenes, worldMap: raw.worldMap };
    // La migration monte la forme 2→7 mais n'INVENTE aucune identité : la porte refuse, en la nommant.
    expect(() => parseProject(regressed)).toThrow(/id/);
  });
});

/**
 * Règle stricte 5 — une prose de campagne qui DÉCLARE sa source en est un COPIÉ/COLLÉ : chacun de ses
 * paragraphes se retrouve À L'OCTET dans le livre déclaré. Le livre se résout par le REGISTRE
 * (`books.json`, champ `dir` — patron `src/data/book-source-integrity.test.ts`), jamais par un chemin
 * écrit à la main, et AUCUN numéro de ligne du `Source/` n'est cité (CLAUDE.md § Sources VF : la
 * ré-extraction Marker 2026-06-22 les a fait dériver, le texte non). Garde TRANSVERSE : le même glob de
 * paquets livrés, aucune scène ni aucun titre nommé.
 */
const REPO_ROOT = join(__dirname, '..', '..');
/** Champs de PROSE VERBATIM du bloc narratif (`state/campaignNarratif.ts`) : `OuvertureBlock.pitch`, `IndiceStade.prose`. */
const PROSE_KEYS = ['pitch', 'prose'] as const;

interface ProseSourcee {
  chemin: string;
  texte: string;
  source: { book?: unknown; page?: unknown };
}

/** Toute prose du bloc narratif qui porte un `source` — la prose SANS source est authorée maison, hors sujet. */
function proseSourcees(node: unknown, chemin: string, out: ProseSourcee[]): void {
  if (node == null || typeof node !== 'object') return;
  if (Array.isArray(node)) {
    node.forEach((x, i) => proseSourcees(x, `${chemin}[${i}]`, out));
    return;
  }
  const rec = node as Record<string, unknown>;
  const source = rec.source;
  if (source != null && typeof source === 'object' && !Array.isArray(source))
    for (const key of PROSE_KEYS)
      if (typeof rec[key] === 'string') out.push({ chemin: `${chemin}.${key}`, texte: rec[key] as string, source: source as ProseSourcee['source'] });
  for (const [key, value] of Object.entries(rec)) proseSourcees(value, `${chemin}.${key}`, out);
}

function fichiersMd(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...fichiersMd(full));
    else if (entry.isFile() && entry.name.endsWith('.md')) out.push(full);
  }
  return out;
}

const texteParLivre = new Map<string, string>();
/** Tout le texte extrait d'un livre, en un seul tampon — la garde cherche le TEXTE, pas un chapitre. */
function texteDuLivre(bookId: string): string {
  const cache = texteParLivre.get(bookId);
  if (cache != null) return cache;
  const dir = books.find((b) => b.id === bookId)?.dir;
  if (!dir) throw new Error(`livre « ${bookId} » : aucun dossier Source déclaré dans books.json`);
  const texte = fichiersMd(join(REPO_ROOT, dir)).map((f) => readFileSync(f, 'utf8')).join('\n');
  texteParLivre.set(bookId, texte);
  return texte;
}

const prosesSourcees = bundledFiles.flatMap((file) => {
  const out: ProseSourcee[] = [];
  proseSourcees(parseProject(JSON.parse(readFileSync(file, 'utf8'))).narratif, file, out);
  return out;
});

describe('prose de campagne SOURCÉE — copiée À L’OCTET du livre déclaré (règle stricte 5)', () => {
  it('au moins une prose sourcée dans les paquets livrés (la garde couvre réellement quelque chose)', () => {
    expect(prosesSourcees.length).toBeGreaterThan(0);
  });

  it('chaque prose sourcée déclare un livre du REGISTRE et son folio', () => {
    const ids = new Set(books.map((b) => b.id));
    const fautives = prosesSourcees.flatMap((p) => {
      if (typeof p.source.book !== 'string' || !ids.has(p.source.book)) return [`${p.chemin} : book « ${String(p.source.book)} » absent de books.json`];
      if (typeof p.source.page !== 'number') return [`${p.chemin} : folio manquant (source.page)`];
      return [];
    });
    expect(fautives).toEqual([]);
  });

  it('chaque paragraphe d’une prose sourcée est contenu À L’OCTET dans son livre', () => {
    const introuvables = prosesSourcees.flatMap((p) => {
      if (typeof p.source.book !== 'string' || !books.some((b) => b.id === p.source.book)) return [];
      const source = texteDuLivre(p.source.book);
      const paragraphes = p.texte.split('\n\n').map((paragraphe) => paragraphe.trim()).filter((paragraphe) => paragraphe.length > 0);
      // Une prose VIDE qui déclare une source ne cite plus rien, et « chaque paragraphe est dans le
      // livre » y serait vrai sans rien vérifier : c'est l'anomalie elle-même.
      if (paragraphes.length === 0) return [`${p.chemin} → ${p.source.book} : prose VIDE alors qu’elle déclare une source`];
      return paragraphes
        .filter((paragraphe) => !source.includes(paragraphe))
        .map((paragraphe) => `${p.chemin} → ${p.source.book} : « ${paragraphe.slice(0, 60)}… » absent du livre (reformulation ou typographie « corrigée »)`);
    });
    expect(introuvables).toEqual([]);
  });
});
