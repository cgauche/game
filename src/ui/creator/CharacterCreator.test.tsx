import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { CharacterCreator, CareerZones, CharZones, SpeciesRaceScreen, SkillZones, StarZones, TrappingZones, DetailZones, PettySpellsSection } from './CharacterCreator';
import { CreatorSummary } from './CreatorSummary';
import {
  newDraft,
  withSpecies,
  withCareer,
  rollDraftSpecies,
  withSpeciesSkillTier,
  speciesSkillTier,
  speciesSkillStep,
  SPECIES_SKILLS_PLUS5,
  SPECIES_SKILLS_PLUS3,
} from './draft';
import { species as allSpecies, careersForSpecies, findCareerById, advancementLabel } from '../../data';
import { CHAR_LABELS } from '../../engine/types';

// Défauts dérivés (page blanche : plus de pré-tiré dans newDraft) — 1ʳᵉ espèce LDB + sa 1ʳᵉ carrière.
const SP = allSpecies.find((s) => s.source.book === 'livre-de-base')!;
const CAREER = careersForSpecies(SP.refCareer)[0]!;
const ready = () => withCareer(withSpecies(newDraft(7), SP.id), CAREER.id);

describe('CharacterCreator (assistant) — gabarit 3 zones + page blanche', () => {
  it('étape 1 (Race, #393 P1) : gabarit DEUX ZONES « Atelier du scribe » (MasterDetail) ; aucune race pré-tirée', () => {
    const html = renderToStaticMarkup(<CharacterCreator />);
    // Barre d'étapes — le signe astral (ADE2, règle activée par défaut) insère une étape après Caractéristiques.
    expect(html).toContain('1. Race');
    expect(html).toContain('4. Signe astral');
    expect(html).toContain('8. Récapitulatif');
    // Étape 1 : coquille DEUX zones (MasterDetail), pas de fiche vivante à ce stade.
    expect(html).toContain('creator-race-shell');
    expect(html).toContain('master-detail-list');
    expect(html).toContain('master-detail-detail');
    expect(html).not.toContain('creator-summary');
    // Page blanche : AUCUNE race sélectionnée au montage (fin du fantôme pré-tiré).
    expect(html).not.toContain('fig-tile sel');
    // Cérémonie « Aux dés » : tirage d100 de la race (LDB 04)
    expect(html).toContain('Aux dés');
    expect(html).toContain('Tirer la race (d100)');
    // Recherche + grille de figurines groupées par famille (GroupedPickGrid)
    expect(html).toContain('Rechercher une race');
    expect(html).toContain('role="listbox"');
    expect(html).toContain('role="option"');
    for (const s of ['Reiklander', 'Nains', 'Halflings', 'Hauts elfes', 'Elfes sylvains']) {
      expect(html).toContain(s);
    }
    // Validation : « Suivant » gardé tant que la race n'est pas choisie
    expect(html).toContain('Choisissez votre race.');
    expect(html).toContain('Suivant →');
  });

  it('remplissage progressif : une race choisie ouvre son détail (DetailFrame) et se sélectionne (grille)', () => {
    const html = renderToStaticMarkup(<SpeciesRaceScreen d={withSpecies(newDraft(7), SP.id)} setD={() => {}} />);
    expect(html).toContain('fig-tile sel'); // race sélectionnée
    expect(html).toContain('detail-frame'); // détail rendu (DetailFrame)
    expect(html).toContain('Caractéristiques de base'); // profil chiffré (CodexSections)
    expect(html).toContain('Compétences de race');
  });

  it('étape 1 — grille GROUPÉE par famille (listbox/option, GroupedPickGrid) + recherche, sans grille facettée', () => {
    const html = renderToStaticMarkup(<SpeciesRaceScreen d={newDraft(7)} setD={() => {}} />);
    expect(html).toContain('role="listbox"'); // grille de sélection a11y
    expect(html).toContain('role="option"');
    expect(html).toContain('gpg-grid');
    expect(html).not.toContain('pick-grid'); // mort du call-site Race de FacetedPickGrid
    expect(html).not.toContain('tabs tabs-sub'); // plus de facettes de famille (grille groupée directe)
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
    const html = renderToStaticMarkup(<SpeciesRaceScreen d={withSpecies(newDraft(7), SP.id)} setD={() => {}} />);
    // Le clic ouvre le Codex en MODALE par-dessus l'assistant (cf. CodexOverlay), sans changer d'écran.
    expect(html).toMatch(/class="codex-ref[^"]*"[^>]*role="button"/); // ≥1 ref cliquable
  });

  it('étape 5 (verdict 1) — UN seul widget d\'allocation : les Compétences de RACE passent au Stepper (fin des cases +5/+3)', () => {
    const { choice } = SkillZones({ d: withCareer(withSpecies(newDraft(7), SP.id), 'soldat'), setD: () => {} });
    const html = renderToStaticMarkup(<>{choice}</>);
    expect(html).toContain('Compétences de race');
    expect(html).toContain('class="stepper"'); // même widget que les Compétences de carrière
    // Plus de cases à cocher « +5 »/« +3 » : la double mécanique cases/steppers est morte.
    expect(html).not.toMatch(/type="checkbox"[^>]*\/>\s*\+5/);
    expect(html).not.toContain('>+5<'); // l'ancien libellé de case n'existe plus
  });

  it('draft — palier de Compétence de race (Stepper) : quotas 3×+5 / 3×+3 respectés, + saute +3 quand son quota est plein', () => {
    const base = withCareer(withSpecies(newDraft(7), SP.id), 'soldat');
    const names = SP.skills.map((a) => advancementLabel('skills', a));
    // On pose 3 Compétences à +3 : le quota +3 est plein, un 4ᵉ +3 est refusé (brouillon inchangé).
    let d = base;
    d = withSpeciesSkillTier(d, names[0], 3);
    d = withSpeciesSkillTier(d, names[1], 3);
    d = withSpeciesSkillTier(d, names[2], 3);
    expect(d.speciesPlus3.length).toBe(SPECIES_SKILLS_PLUS3);
    const refused = withSpeciesSkillTier(d, names[3], 3);
    expect(refused.speciesPlus3.length).toBe(SPECIES_SKILLS_PLUS3); // 4ᵉ +3 refusé (quota plein)
    // Le + d'une Compétence à 0, quota +3 plein mais +5 libre → saute directement à 5.
    expect(speciesSkillStep(d, names[3], 1)).toBe(5);
    // Quota +5 plein (3) : une 4ᵉ Compétence à 0 ne peut monter qu'au palier +3 encore libre.
    let e = withSpeciesSkillTier(base, names[0], 5);
    e = withSpeciesSkillTier(e, names[1], 5);
    e = withSpeciesSkillTier(e, names[2], 5);
    expect(e.speciesPlus5.length).toBe(SPECIES_SKILLS_PLUS5);
    expect(withSpeciesSkillTier(e, names[3], 5).speciesPlus5.length).toBe(SPECIES_SKILLS_PLUS5); // 4ᵉ +5 refusé
    expect(speciesSkillStep(e, names[3], 1)).toBe(3); // +5 plein → le + monte au +3 libre
    expect(speciesSkillTier(e, names[0])).toBe(5);
  });

  it('étape Signe astral (verdict 2) — ROUE CÉLESTE a11y (radiogroup) remplace le <select> ; desc verbatim en Zone B', () => {
    const rolled = { ...newDraft(7), star: 'la-grande-croix' };
    const { choice, detail } = StarZones({ d: rolled, setD: () => {} });
    const cHtml = renderToStaticMarkup(<>{choice}</>);
    expect(cHtml).toContain('celestial-wheel');
    expect(cHtml).toContain('role="radiogroup"');
    expect(cHtml).toMatch(/role="radio"[^>]*aria-checked="true"/); // signe choisi mis en évidence
    expect(cHtml).not.toContain('<select value="la-grande-croix"'); // fin du <select> de signe
    const dHtml = renderToStaticMarkup(<>{detail.body}</>);
    expect(dHtml).toContain('La Grande Croix'); // titre de la ParchmentCard
    expect(dHtml).toContain('Astrologie (pur roleplay)');
    expect(dHtml).not.toContain('trapping-list'); // classe libérée
  });

  it('étape Possessions (verdict 3) — revue d\'équipement : chips CodexRef + Encombrement total + bourse (plus de liste à puces)', () => {
    const d = withCareer(withSpecies(newDraft(7), SP.id), 'soldat');
    const { choice, detail } = TrappingZones({ d, setD: () => {} });
    const cHtml = renderToStaticMarkup(<>{choice}</>);
    expect(cHtml).toContain('Bourse de départ');
    const dHtml = renderToStaticMarkup(<>{detail.body}</>);
    expect(dHtml).toContain('Encombrement total');
    expect(dHtml).toContain('skill-tags'); // objets en chips
    expect(dHtml).toContain('Dotation de Classe');
    expect(dHtml).not.toContain('trapping-list');
    expect(dHtml).not.toContain('item-meta');
  });

  it('étape Détails (verdict 4) — identité fusionnée : nom + physique + motivation en Zone A ; apparence en Zone B', () => {
    const d = withCareer(withSpecies(newDraft(7), SP.id), 'soldat');
    const { choice, detail } = DetailZones({ d, setD: () => {} });
    const cHtml = renderToStaticMarkup(<>{choice}</>);
    // UNE région identité en Zone A : nom, âge/taille/yeux/cheveux, motivation/ambitions ensemble.
    expect(cHtml).toContain('Nom du personnage');
    expect(cHtml).toContain('Âge');
    expect(cHtml).toContain('Cheveux');
    expect(cHtml).toContain('Motivation'); // BackgroundFields présent en Zone A
    // Zone B = apparence seule (le personnalisateur), plus l'identité éclatée.
    const dHtml = renderToStaticMarkup(<>{detail.body}</>);
    expect(dHtml).toContain('appear-panel');
    expect(dHtml).not.toContain('Nom du personnage'); // le nom n'est plus dans le détail
  });

  it('étape Détails — bouton « Visage → Variante » (appSeed) change réellement le rig rendu (#bug visage figé)', () => {
    const d1 = withCareer(withSpecies(newDraft(7), SP.id), 'soldat');
    const { detail: detail1 } = DetailZones({ d: d1, setD: () => {} });
    const html1 = renderToStaticMarkup(<>{detail1.body}</>);
    const d2 = { ...d1, appSeed: (d1.appSeed ?? 0) + 1 };
    const { detail: detail2 } = DetailZones({ d: d2, setD: () => {} });
    const html2 = renderToStaticMarkup(<>{detail2.body}</>);
    expect(html1).not.toBe(html2);
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
