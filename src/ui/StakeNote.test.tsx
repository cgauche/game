/**
 * SOCLE d'enjeu (#1117 L0b) — la porte UNIQUE et sa primitive de rendu.
 *
 * 1. `resolveStake` est FAIL-CLOSED aux deux bouts (clé inconnue, trou sans valeur) et DÉRIVE la fiche
 *    de règle de la MÊME entrée — un producteur ne nomme jamais la règle.
 * 2. `StakeNote` rend le texte résolu SOUS SA CLASSE PROPRIÉTAIRE `.rm-stake` (Z3b), avec le renvoi.
 * 3. `RollShell.stake` est une prop de PREMIER RANG : la coquille résout et rend sans passer par `extra`.
 */
import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { resolveStake, nightStakeRef, voyageStakeRef, symptoms } from '../data';
import { StakeNote } from './StakeNote';
import { RollShell } from './RollShell';
import { stepSubtitle } from './CascadeModal';

describe('resolveStake — la porte UNIQUE, fail-closed (#1117)', () => {
  it('rend le texte de la donnée et DÉRIVE la fiche de règle de la même entrée', () => {
    const r = resolveStake(nightStakeRef('recovery'));
    expect(r.text.length).toBeGreaterThan(10);
    expect(r.rule).toEqual({ category: 'regles', id: 'guerison-des-blessures' });
  });

  /**
   * La clé DESCEND à l'ENTRÉE jouée (`{dataset, kind, entryId}` du design #1117) — escalade user
   * 2026-08-06 : cliquer la règle de « Blessé (Blessure Purulente) » ouvrait l'INTRO DE CHAPITRE
   * (« Servez-vous en pour inventer des maladies bien répugnantes », du propos d'auteur MJ) au lieu
   * de la règle du symptôme joué. Le repli sur le `kind` reste, DÉCLARÉ, pour un id introuvable.
   */
  it('l’ENTRÉE jouée prime : une étape de maladie renvoie au SYMPTÔME, pas à l’intro de chapitre', () => {
    expect(resolveStake(nightStakeRef('diseaseTick', 'blesse')).rule).toEqual({ category: 'symptoms', id: 'blesse' });
    expect(resolveStake(nightStakeRef('diseaseGangrene', 'gangrene')).rule).toEqual({ category: 'symptoms', id: 'gangrene' });
    expect(resolveStake(nightStakeRef('diseasePersist', 'persistant')).rule).toEqual({ category: 'symptoms', id: 'persistant' });
  });

  it('la fiche du SYMPTÔME porte bien la règle attendue (le verbatim du Test quotidien)', () => {
    const fiche = symptoms.find((s) => s.id === 'blesse')!;
    expect(fiche.desc).toContain('Chaque jour, réussissez un Test de **Résistance Accessible (+20)**');
  });

  it('REPLI DÉCLARÉ : sans entrée jouée — ou entrée inconnue — la fiche du `kind` reprend la main', () => {
    expect(resolveStake(nightStakeRef('diseaseTick')).rule).toEqual({ category: 'regles', id: 'symptomes-des-maladies' });
    expect(resolveStake(nightStakeRef('diseaseTick', 'symptome-fantome')).rule).toEqual({ category: 'regles', id: 'symptomes-des-maladies' });
  });

  it('un `entryId` sur un kind SANS catalogue d’entrées est ignoré (aucun renvoi fabriqué)', () => {
    expect(resolveStake(nightStakeRef('recovery', 'blesse')).rule).toEqual({ category: 'regles', id: 'guerison-des-blessures' });
  });

  it('remplit les trous du gabarit avec les valeurs CALCULÉES', () => {
    const r = resolveStake(voyageStakeRef('riverNav', { driftKm: 7, driftPct: 25 }));
    expect(r.text).toContain('7');
    expect(r.text).not.toMatch(/\{[a-zA-Z]+\}/);
  });

  it('une clé INCONNUE jette (aucune surface muette en silence)', () => {
    expect(() => resolveStake({ key: { dataset: 'voyage', kind: 'kind-fantome' } })).toThrow(/aucune entrée d’enjeu|aucune entrée d'enjeu/);
    expect(() => voyageStakeRef('kind-fantome')).toThrow(/aucun gabarit d'enjeu/);
  });

  it('un TROU sans valeur jette (jamais un « {driftKm} » rendu au joueur)', () => {
    expect(() => resolveStake(voyageStakeRef('riverNav'))).toThrow(/driftKm/);
  });
});

describe('StakeNote — la primitive de la zone Z3b (#1117)', () => {
  it('rend la PHRASE sous SA classe propriétaire `.rm-stake`', () => {
    const html = renderToStaticMarkup(<StakeNote stake={nightStakeRef('recovery')} />);
    expect(html, 'Z3b a un propriétaire distinguable').toContain('class="rm-stake"');
    expect(html).toContain('Points de Blessure');
    // Ton NEUTRE : ni la note générique, ni la menace SUBIE (fond rouge).
    expect(html).not.toContain('rm-note');
    expect(html).not.toContain('rm-threat');
  });

  it('ne porte PLUS le lien textuel « la règle » (arbitrage user 2026-08-06 : le renvoi va au TITRE)', () => {
    const html = renderToStaticMarkup(<StakeNote stake={nightStakeRef('nightmare')} />);
    expect(html).not.toContain('la règle');
    // L'auto-liage de `<Prose>` (« Exténué » → sa fiche d'État) RESTE : chaque terme de règle est sa
    // propre porte (#1078). Ce qui meurt, c'est le LIEN NOMMÉ « la règle » posé sous la phrase.
    expect(html).not.toContain('ab-codex-info');
  });
});

describe('RollShell.stake — prop de PREMIER RANG (#1117)', () => {
  it('la coquille résout la RÉFÉRENCE et la rend en Z3b', () => {
    const html = renderToStaticMarkup(
      <RollShell
        title="Récupération"
        stake={nightStakeRef('recovery')}
        rolled={false}
        rows={[]}
        actions={[]}
        embedded
      />,
    );
    expect(html, 'l’enjeu est rendu par la coquille, sans passer par `extra`').toContain('class="rm-stake"');
    expect(html).toContain('Points de Blessure');
  });
});

/**
 * Le RENVOI vers la règle est une AFFORDANCE COMPACTE accolée au TITRE de l'étape — arbitrage user
 * 2026-08-06 : « "la régle" ? C'est moche. Je pensais que tu allais mettre un "i" a coté de
 * "Cauchemars", pas "la régle" en dessous ». Il compose le déclencheur-icône EXISTANT de `CodexRef`
 * (`ab-codex-info` + glyphe `journal/info`, patron de la barre d'action) — aucun bouton local, aucun
 * caractère typographique bricolé. La nuance de #1078 tient : les CHIPS restent leurs propres portes.
 */
describe('renvoi de règle AU TITRE d’étape (#1117, arbitrage 2026-08-06)', () => {
  const rule = { category: 'regles', id: 'trauma' };

  it('le titre porte le déclencheur-icône, NOMMÉ pour un lecteur d’écran', () => {
    const html = renderToStaticMarkup(<>{stepSubtitle('Cauchemars', 'creature/scream', { cursor: 0, total: 1 }, rule)}</>);
    expect(html).toContain('Cauchemars');
    expect(html, 'le déclencheur-icône partagé, pas un bouton local').toContain('ab-codex-info');
    expect(html, 'l’icône vient du pipeline (journal/info), jamais un caractère bricolé').toContain('<svg');
    expect(html, 'nom accessible dérivé du libellé d’étape').toContain('aria-label="Règle : Cauchemars"');
    expect(html).toContain('role="button"');
    // Le lien textuel est mort.
    expect(html).not.toContain('la règle');
  });

  it('sans règle, le titre reste NU (aucune icône morte)', () => {
    const html = renderToStaticMarkup(<>{stepSubtitle('Cauchemars', 'creature/scream', { cursor: 0, total: 1 })}</>);
    expect(html).toContain('Cauchemars');
    expect(html).not.toContain('ab-codex-info');
  });
});
