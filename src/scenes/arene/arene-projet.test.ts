import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { validateScene } from '../../state/validateScene';
import { parseProject } from '../../state/worldMap';
import { isWalkable, type Scene } from '../../state/scene';
import { findCreature, findTrapping } from '../../data';
import { MERCHANTS } from '../../state/merchants/index';
import { entitySize } from '../../state/spawn';
import { footprintTiles } from '../../state/footprint';
import { terrainWalkable } from '../../state/terrain';

/** Terrain de base d'une zone = tuile la PLUS fréquente (le sol remplit la grille ; murs/eau = minorité). */
function baseTerrain(tiles: string[]): string {
  const count: Record<string, number> = {};
  for (const t of tiles) count[t] = (count[t] ?? 0) + 1;
  return Object.entries(count).sort((a, b) => b[1] - a[1])[0][0];
}

/**
 * L'arène est un PROJET de données pures (créable/éditable dans l'éditeur) qui tourne sur le moteur
 * existant — aucun code applicatif dédié. Ce test verrouille que le JSON est VALIDE (transitions,
 * dialogues, ids) et que chaque ennemi référence une vraie créature du bestiaire (sinon mannequin B10).
 */
const doc = parseProject(JSON.parse(readFileSync(join(__dirname, 'arene-projet.json'), 'utf8')));
const project: Scene[] = doc.scenes;

describe('Arène — projet de données (zéro code applicatif)', () => {
  it('14 scènes, entrée = arene-zone1, hub + 13 zones reliées (rampe longue)', () => {
    expect(project).toHaveLength(14);
    expect(project[0].id).toBe('arene-zone1');
    const ids = project.map((s) => s.id);
    expect(ids).toContain('arene-hub');
    expect(ids).toContain('arene-zone13'); // L'Antre du Dragon (finale)
    // 13 zones distinctes (zone1..zone13)
    const zones = ids.filter((id) => id.startsWith('arene-zone'));
    expect(new Set(zones).size).toBe(13);
  });

  it('validateScene(projet + carte du monde) ne lève AUCUNE erreur (transitions/dialogues/ids/lieux OK)', () => {
    const errors = validateScene(project, doc.worldMap).filter((w) => w.level === 'error');
    expect(errors).toEqual([]);
  });

  it('chaque ennemi référence une vraie créature (pas de mannequin B10)', () => {
    const missing: string[] = [];
    for (const sc of project)
      for (const enc of sc.encounters)
        for (const e of enc.enemies)
          if (e.ref && !findCreature(e.ref)) missing.push(`${sc.id}:${e.ref}`);
    expect(missing).toEqual([]);
  });

  it('chaque ennemi spawn sur une EMPREINTE entière DANS la carte et MARCHABLE (mur/eau/décor exclus)', () => {
    // Footprint complet (Grande 2×2 / Énorme 3×3 / Monstrueuse 4×4) : toutes les cases occupées doivent
    // être dans la carte ET marchables — sinon un grand monstre déborde sur un mur (placement incohérent).
    const bad: string[] = [];
    for (const sc of project)
      for (const enc of sc.encounters)
        for (const e of enc.enemies) {
          const size = entitySize(e);
          for (const { x, y } of footprintTiles(e.pos, size)) {
            const inBounds = x >= 0 && y >= 0 && x < sc.dimensions.w && y < sc.dimensions.h;
            if (!inBounds || !isWalkable(sc, x, y)) bad.push(`${sc.id}:${e.ref ?? e.statblock?.name ?? '?'}@(${x},${y})`);
          }
        }
    expect(bad).toEqual([]);
  });

  it('couvre les types de rencontre ÉTENDUS : Surprise/embuscade, Nuée (statbloc), Terreur, Test interactif', () => {
    const encs = project.flatMap((s) => s.encounters);
    expect(encs.some((e) => e.surprise === 'party')).toBe(true); // embuscade
    expect(encs.some((e) => e.enemies.some((en) => (en.statblock?.traits ?? []).includes('Nuée')))).toBe(true); // Nuée = statbloc custom
    expect(encs.some((e) => e.enemies.some((en) => en.ref === 'Spectre de cairn'))).toBe(true); // créature Terreur
    const hub = project.find((s) => s.id === 'arene-hub')!;
    const hasTest = hub.dialogues.some((d) => d.nodes.some((n) => n.choices.some((c) => c.effects?.some((ef) => ef.type === 'test'))));
    expect(hasTest).toBe(true); // Effet `test` (Crochetage) avec branches succès/échec
  });

  it('une zone met en scène la CAVALERIE : un cavalier pré-monté + un cheval libre allié (montable)', () => {
    const allEnemies = project.flatMap((s) => s.encounters.flatMap((e) => e.enemies));
    expect(allEnemies.some((e) => e.rides != null)).toBe(true); // cavalier pré-monté (rides → index de la monture)
    expect(allEnemies.some((e) => e.mount && e.side === 'ally')).toBe(true); // monture LIBRE côté héros
  });

  it('FINALE : un boss MONSTRUEUX (4×4) au SOUFFLE de ténèbres (statbloc inline)', () => {
    const dragon = project
      .flatMap((s) => s.encounters.flatMap((e) => e.enemies))
      .find((e) => e.statblock?.size === 'monstrueuse');
    expect(dragon, 'un ennemi de Taille Monstrueuse').toBeTruthy();
    expect((dragon!.statblock!.traits ?? []).some((t) => /Souffle/i.test(t))).toBe(true); // attaque de Souffle
  });

  it('chaque zone est UNIQUE : terrains de base distincts (campagne démo)', () => {
    const zones = project.filter((s) => s.id.startsWith('arene-zone'));
    const bases = zones.map((z) => baseTerrain(z.tiles)); // sol dominant de la zone
    expect(new Set(bases).size).toBeGreaterThanOrEqual(10); // ≥10 sols différents sur 13 zones
  });

  it('VRAIS MURS : chaque zone est CLÔTURÉE par une structure (mur/eau/sous-bois), pas un champ vide', () => {
    // Un layout tactique cohérent est borné par des tuiles INFRANCHISSABLES : murs de pierre (intérieur),
    // sous-bois/eau (marais). On exige une masse structurelle ≥ périmètre minimal — preuve d'une enceinte
    // (et de structure interne), pas un empilement d'objets sur un sol vide.
    for (const sc of project.filter((s) => s.id.startsWith('arene-zone'))) {
      const structural = sc.tiles.filter((t) => !terrainWalkable(t)).length;
      const { w, h } = sc.dimensions;
      expect(structural, `${sc.id} doit être clôturé`).toBeGreaterThanOrEqual(w + h); // ~un demi-périmètre au moins
    }
  });

  it('VITRINE du bestiaire & des Traits (même non codés) : Champion, Corruption, Démoniaque, Venin, Taille', () => {
    // L'arène fait découvrir un large bestiaire et des Traits canoniques pas encore tous codés mais déjà
    // présents en DONNÉES (« ça reste des systèmes qu'on veut tester »). On vérifie qu'ils sont référencés.
    const refs = new Set(
      project.flatMap((s) => s.encounters.flatMap((e) => e.enemies.map((en) => en.ref).filter(Boolean))),
    );
    expect(refs.size).toBeGreaterThanOrEqual(18); // large vitrine (≥18 créatures distinctes)
    // Traits canoniques (LDB 85) portés par les créatures référencées.
    const traitsOf = (ref?: string) => (ref ? findCreature(ref)?.traits ?? [] : []);
    const allTraits = [...refs].flatMap((r) => traitsOf(r as string));
    for (const trait of [/^Champion$/, /^Corruption \(/, /^Démoniaque/, /^Venin$/]) {
      expect(allTraits.some((t) => trait.test(t)), `Trait ${trait}`).toBe(true);
    }
    // Une créature MONSTRUEUSE (Dragon, statbloc) + une Énorme (Vouivre, par ref) au moins.
    const sizes = project.flatMap((s) => s.encounters.flatMap((e) => e.enemies.map((en) => entitySize(en))));
    expect(sizes).toContain('monstrueuse');
    expect(sizes).toContain('enorme');
  });

  it('les ennemis d’une vague sont RÉPARTIS (pas tous dans la même colonne)', () => {
    for (const sc of project.filter((s) => s.id.startsWith('arene-zone'))) {
      const xs = new Set(sc.encounters[0].enemies.map((e) => e.pos.x));
      expect(xs.size, sc.id).toBeGreaterThanOrEqual(2); // au moins 2 colonnes distinctes
    }
  });

  it('boucle complète : chaque zone se solde par un retour au hub (transition)', () => {
    for (const z of project.filter((s) => s.id.startsWith('arene-zone'))) {
      const ov = z.encounters[0]?.onVictory ?? [];
      expect(ov.some((e) => e.type === 'transition' && e.scene === 'arene-hub')).toBe(true);
      expect(ov.some((e) => e.type === 'setFlag')).toBe(true);
    }
  });

  it('le hub ouvre la zone suivante via flags (porte gated zoneN_clear)', () => {
    const hub = project.find((s) => s.id === 'arene-hub')!;
    const door = hub.dialogues.find((d) => d.id === 'dlg-hub')!;
    const choices = door.nodes[0].choices;
    const doors = choices.filter((c) => c.effects?.some((e) => e.type === 'transition' && e.scene.startsWith('arene-zone')));
    expect(doors.length).toBeGreaterThanOrEqual(3); // zones 2,3,4 ouvertes par progression
    expect(doors.every((c) => /clear/.test(c.condition ?? ''))).toBe(true);
  });

  it('le hub a un Médecin (LDB 75) qui vend des soins ET des prothèses, curatifs garantis', () => {
    const hub = project.find((s) => s.id === 'arene-hub')!;
    const medecin = hub.entities.find((e) => e.id === 'medecin');
    expect(medecin?.merchant?.archetype).toBe('medecin');
    const arch = MERCHANTS['medecin'];
    expect(arch).toBeTruthy();
    expect(arch.category.subTypes).toContain('Herbes et potions');
    expect(arch.category.subTypes).toContain('Prothèses');
    // tous les articles garantis (curated) référencent un vrai trapping
    for (const label of arch.curated ?? []) expect(findTrapping(label), label).toBeTruthy();
  });
});
