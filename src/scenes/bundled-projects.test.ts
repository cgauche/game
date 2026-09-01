import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it, expect } from 'vitest';
import { parseProject } from '../state/worldMap';
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
