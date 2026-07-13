import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { CharacterCreator, CareerZones, CharZones, SpeciesZones, PettySpellsSection } from './CharacterCreator';
import { CreatorSummary } from './CreatorSummary';
import { newDraft, withSpecies, withCareer, rollDraftSpecies } from './draft';
import { species as allSpecies, careersForSpecies, findCareerById } from '../../data';
import { CHAR_LABELS } from '../../engine/types';

// Défauts dérivés (page blanche : plus de pré-tiré dans newDraft) — 1ʳᵉ espèce LDB + sa 1ʳᵉ carrière.
const SP = allSpecies.find((s) => s.source.book === 'livre-de-base')!;
const CAREER = careersForSpecies(SP.refCareer)[0]!;
const ready = () => withCareer(withSpecies(newDraft(7), SP.id), CAREER.id);

describe('CharacterCreator (assistant) — gabarit 3 zones + page blanche', () => {
  it('étape 1 : trois zones STABLES + « Aux dés » ; fiche vivante GRISÉE, aucune race pré-tirée', () => {
    const html = renderToStaticMarkup(<CharacterCreator />);
    // Barre d'étapes — le signe astral (ADE2, règle activée par défaut) insère une étape après Caractéristiques.
    expect(html).toContain('1. Race');
    expect(html).toContain('4. Signe astral');
    expect(html).toContain('8. Récapitulatif');
    // Coquille 3 zones : Zone A (choix), Zone B (détail), Zone C (fiche vivante)
    expect(html).toContain('creator-shell');
    expect(html).toContain('creator-rail');
    expect(html).toContain('creator-main');
    expect(html).toContain('creator-summary');
    // Page blanche : AUCUNE race sélectionnée au montage (fin du fantôme pré-tiré).
    expect(html).not.toContain('pick-card selected');
    // La fiche vivante démarre grisée mais STRUCTURÉE : tous les blocs présents dès l'étape 1.
    expect(html).toContain('Race à choisir');
    expect(html).toContain('Carrière à choisir');
    expect(html).toContain('Blessures');
    expect(html).toContain('PX bonus de création');
    expect(html).toContain('Talents'); // bloc Talents présent (grisé), plus d'apparition surprise
    // Cérémonie « Aux dés » : tirage d100 de la race (LDB 04)
    expect(html).toContain('Aux dés');
    expect(html).toContain('Tirer la race (d100)');
    // Espèces du Livre de base listées dans la Zone A (variantes + familles)
    for (const s of ['Reiklander', 'Nains', 'Halflings', 'Hauts elfes', 'Elfes sylvains']) {
      expect(html).toContain(s);
    }
    // Validation : « Suivant » gardé tant que la race n'est pas choisie
    expect(html).toContain('Choisissez votre race.');
    expect(html).toContain('Suivant →');
  });

  it('remplissage progressif : une race choisie ouvre son profil (Zone B) et se sélectionne (Zone A)', () => {
    const { choice, detail } = SpeciesZones({ d: withSpecies(newDraft(7), SP.id), setD: () => {} });
    expect(renderToStaticMarkup(<>{choice}</>)).toContain('pick-card selected'); // race sélectionnée
    const body = renderToStaticMarkup(<>{detail.body}</>);
    expect(body).toContain('Caractéristiques de base'); // profil chiffré (CodexSections)
    expect(body).toContain('Compétences de race');
  });

  it('étape 1 — grille facettée : facettes de famille (tablist) + grille de cartes (listbox/option), sans rail-ascenseur', () => {
    const html = renderToStaticMarkup(<>{SpeciesZones({ d: newDraft(7), setD: () => {} }).choice}</>);
    expect(html).toContain('tabs tabs-sub'); // facettes de famille = primitive Tabs (variante sub)
    expect(html).toContain('role="listbox"'); // grille de sélection a11y
    expect(html).toContain('role="option"');
    expect(html).toContain('pick-grid');
    expect(html).not.toContain('pick-row'); // mort de l'ancien rail-liste
    expect(html).not.toContain('rail-group');
  });

  it('étape 2 — grille facettée de carrière : recherche + facettes de CLASSE (données) + grille listbox', () => {
    const html = renderToStaticMarkup(<>{CareerZones({ d: withSpecies(newDraft(7), SP.id), setD: () => {} }).choice}</>);
    expect(html).toContain('Rechercher une carrière'); // SearchFilterField canonique en tête
    expect(html).toContain('tabs tabs-sub'); // facettes de classe = primitive Tabs
    expect(html).toContain('role="listbox"');
    // Les facettes viennent des données (classes.json), pas d'une liste en dur.
    for (const cl of ['Guerriers', 'Lettrés', 'Roublards']) expect(html).toContain(cl);
    expect(html).not.toContain('pick-row');
  });

  it('étape 2 — d100 → sélection VISIBLE : la carrière posée est active dans la grille ET sa facette de classe est active', () => {
    // « soldat » = classe Guerriers, PAS la première facette : le choix doit basculer la facette active
    // (comme un tirage d100 qui tombe hors de la classe affichée) et marquer la carte.
    const soldat = findCareerById('soldat')!;
    const html = renderToStaticMarkup(<>{CareerZones({ d: withCareer(withSpecies(newDraft(7), SP.id), 'soldat'), setD: () => {} }).choice}</>);
    expect(html).toContain('pick-card selected'); // carte de la carrière tirée = active
    expect(html).toContain(soldat.label); // et visible (sa facette de classe est ouverte)
    expect(html).toMatch(/aria-selected="true"/); // facette + carte marquées sélectionnées
  });

  it('PX en direct : accepter le tirage de race incrémente le compteur PX de la fiche vivante (+20)', () => {
    const d = rollDraftSpecies(withSpecies(newDraft(7), SP.id));
    const html = renderToStaticMarkup(<CreatorSummary d={d} />);
    expect(html).toContain('PX bonus de création');
    expect(html).toContain('Espèce +20'); // LDB 04 : race tirée et gardée → contribution EN DIRECT
  });

  it('page blanche : AUCUN PX bonus tant qu\'aucune race n\'est choisie', () => {
    const html = renderToStaticMarkup(<CreatorSummary d={newDraft(7)} />);
    expect(html).toContain('PX bonus de création : <b>+0</b>'); // fin du +50 fantôme (2d10 gardé par défaut)
  });

  it('étape 4 — Magie mineure choisie : la section des sorts inclus apparaît (compteur n/BFM)', () => {
    const d = { ...withCareer(withSpecies(newDraft(7), SP.id), 'Sorcier'), careerTalent: 'Magie mineure' };
    const html = renderToStaticMarkup(<PettySpellsSection d={d} setD={() => {}} />);
    expect(html).toContain('Sorts de Magie mineure (inclus au Talent)');
    expect(html).toContain('Fléchette'); // la liste des sorts de Magie mineure est proposée
    expect(html).toMatch(/0\/\d/); // compteur de quota (BFM)
    // Sans le Talent : aucune section.
    expect(renderToStaticMarkup(<PettySpellsSection d={withCareer(withSpecies(newDraft(7), SP.id), 'soldat')} setD={() => {}} />)).toBe('');
  });

  it('étape 3 — la grille des 5 Augmentations propose un stepper par Caractéristique de carrière (bug bloquant)', () => {
    // Régression : `level.characteristics` est déjà en CharKey ; un mapping libellé→clé renvoyait
    // une liste vide → aucun stepper → « Suivant » jamais actif → création infranchissable.
    const { choice } = CharZones({ d: withCareer(withSpecies(newDraft(7), SP.id), 'soldat'), setD: () => {} });
    const html = renderToStaticMarkup(<>{choice}</>);
    expect(html).toContain('Augmentations gratuites');
    expect(html).toContain(CHAR_LABELS['capacite-de-combat']); // Soldat : CC est de carrière → ligne présente
    expect(html).toContain('class="stepper"'); // contrôle d'allocation réellement rendu
  });

  it('étape 3 — la grille centrale (ÉDITION) ne montre PLUS la notation cryptique « B<bonus> » (source unique)', () => {
    const { detail } = CharZones({ d: withCareer(withSpecies(newDraft(7), SP.id), 'soldat'), setD: () => {} });
    const html = renderToStaticMarkup(<>{detail.body}</>);
    expect(html).toContain('char-total'); // le total d'ÉDITION est bien rendu
    // Plus de double notation « 30B3 » : la fiche vivante porte le RÉSULTAT, le centre la valeur seule.
    expect(html).not.toMatch(/>B\d</);
  });

  it('étape 2 — Possessions et tooltip d\'évolution affichent des libellés, jamais [object Object]', () => {
    const { detail } = CareerZones({ d: withCareer(withSpecies(newDraft(7), SP.id), 'soldat'), setD: () => {} });
    const html = renderToStaticMarkup(<>{detail.body}</>);
    expect(html).not.toContain('[object Object]');
    expect(html).toContain('Possessions &amp; Statut');
    expect(html).toContain('title="Compétences : '); // tooltip d'évolution → libellés résolus
  });

  it('les références Codex de l\'assistant sont INTERACTIVES (clic → fiche en modale, brouillon préservé)', () => {
    const html = renderToStaticMarkup(<>{SpeciesZones({ d: withSpecies(newDraft(7), SP.id), setD: () => {} }).detail.body}</>);
    // Le clic ouvre le Codex en MODALE par-dessus l'assistant (cf. CodexOverlay), sans changer d'écran.
    expect(html).toMatch(/class="codex-ref[^"]*"[^>]*role="button"/); // ≥1 ref cliquable
  });

  it('CreatorSummary : caractéristiques EN DIRECT du héros prévisualisé (talents/augmentations inclus)', () => {
    const d = ready();
    const html = renderToStaticMarkup(<CreatorSummary d={d} />);
    expect(html).toContain('Aventurier');
    expect(html).toContain(findCareerById(d.careerId)!.label); // carrière posée
    expect(html).toContain('Mouvement');
    expect(html).toContain('Destin');
    expect(html).toContain('Bourse');
    // Les 10 caractéristiques sont rendues
    for (const k of ['CC', 'CT', 'FM', 'Soc']) expect(html).toContain(`>${k}<`);
  });
});
