/**
 * Assistant de création de personnage (LDB 04/05 « Personnage ») — composition « RPG vidéo »
 * en TROIS ZONES bord à bord (pas de panneaux flottants) :
 *
 *   ┌ header : titre + étapes ──────────────────────────────────────────┐
 *   │ RAIL (choix/actions)  │  DÉTAIL (le travail de l'étape)  │ FICHE  │
 *   │ liste de sélection,   │  profil d'espèce, plan de        │ vivante│
 *   │ tirages, méthodes     │  carrière, grilles d'allocation… │ sticky │
 *   └ footer : précédent / validation / suivant ────────────────────────┘
 *
 * Les sections internes utilisent des séparateurs (.zone-section), pas des boîtes. La logique
 * (tirages figés, bonus de PX, validation, construction) vit dans ./draft.ts (pur).
 */
import { useEffect, useMemo, useRef, useState, type KeyboardEvent, type ReactNode } from 'react';
import { useGame } from '../../state/store';
import { rosterAdd, rosterLoad } from '../../state/roster';
import {
  species as allSpecies,
  careersForSpecies,
  classes,
  findCareerById,
  careerLabelFor,
  displayLabelForSex,
  findSpeciesById,
  findClassById,
  findSkill,
  findTalent,
  talentConcrete,
  findTrappingById,
  trappingRefLabel,
  qualityRefLabel,
  advancementLabel,
  trappings as allTrappings,
  levelsForCareer,
  CHAR_ABR,
  stars as starsTable,
  celestialHouses,
  spells as allSpells,
  rigSpeciesId,
  specLabel,
  findBookById,
  skillInstanceLabel,
  SpeciesData,
  CareerData,
} from '../../data';
import { CHAR_KEYS, CharKey, CHAR_LABELS, Characteristics, Combatant } from '../../engine/types';
import { rule } from '../../engine/policy';
import { damageString } from '../../engine/items';
import { skillBaseValue } from '../../engine/skills';
import { rangeSpecLabel, ammoRangeModLabel } from '../weaponStats';
import { formatSpellRange, formatSpellDuration } from '../../engine/spellRangeFormat';
import { Coins } from '../Coins';
import { makeRNG } from '../../engine/dice';
import { generateName } from '../../engine/names';
import { CharacterPreview } from '../CharacterPreview';
import { Icon } from '../Icon';
import { OptionChooser } from '../OptionChooser';
import { Tabs } from '../Tabs';
import { RuleDivider } from '../Ornaments';
import { AppearancePanel } from '../AppearancePanel';
import { BackgroundFields } from '../BackgroundFields';
import { CodexRef } from '../compendium/CodexRef';
import { Prose, mdToText } from '../Prose';
import { CodexSections } from '../compendium/CodexEntry';
import { EntityRef, EntityChoice, SkillChip, TalentChip } from '../EntityChip';
import { raceSkillSection, raceTalentSection, type CodexSection } from '../compendium/registry';
import { CharStatsGrid } from '../CharStatsGrid';
import { opSummary } from '../editor/GameOpEditor';
import type { Appearance } from '../../gameIso/rig/appearance';
import { hash32 } from '../../gameIso/detail/hash';
import { previewHero, CreatorSummary } from './CreatorSummary';
import { CreatorStepFrame, Section, Band, XpBadge, type StepZones } from './CreatorStepFrame';
import { QtyStepper } from '../QtyStepper';
import { CreatorDice } from './CreatorDice';
import { useRollFrisson } from '../useRollFrisson';
import { DiceRoll, DieFace } from '../DiceRoll';
import { d10PairFaces, d100Faces, d10Face } from '../Dice';
import { CelestialWheel } from './CelestialWheel';
import { MasterDetail } from '../MasterDetail';
import { DetailFrame } from '../DetailFrame';
import { GroupedPickGrid, type PickGridSection } from '../GroupedPickGrid';
import { MetalStatus } from '../MetalStatus';
import { CareerPath } from '../CareerPath';
import { FigTile } from '../FigTile';
import { NotchGauge } from '../NotchGauge';
import { SearchFilterField, filterByLabel } from '../SearchFilterField';
import {
  CreatorDraft,
  newDraft,
  draftSpecies,
  draftLevel,
  withSpecies,
  withCareer,
  rollDraftSpecies,
  rollDraftCareer,
  withCoastalSwap,
  coastalSwapAvailable,
  careerRollPool,
  speciesXp,
  careerXp,
  charsXp,
  charRolls,
  charRollPairs,
  draftChars,
  careerCharKeys,
  careerSkillEntries,
  careerAdvTotal,
  evenCareerSkillAdvances,
  careerTalentOptions,
  specOptionsFor,
  pettySpellQuota,
  draftWealth,
  rollDraftWealth,
  rolledDetails,
  validateStep,
  stepIds,
  type StepId,
  starXp,
  rollDraftStar,
  rollDraftAstrology,
  SPECIES_SKILLS_PLUS5,
  SPECIES_SKILLS_PLUS3,
  speciesSkillTier,
  withSpeciesSkillTier,
  speciesSkillStep,
  speciesSkillsDone,
  careerSkillsDone,
  talentsDone,
  skillsSubMessage,
  type SkillsSub,
  speciesTalentFixedEntries,
  speciesTalentChoiceEntries,
  speciesTalentRandomCount,
  speciesTalentRandomDrawn,
  CAREER_SKILL_ADVANCES,
  MAX_ADV_PER_SKILL,
  CAREER_CHAR_ADVANCES,
  buildHero,
  draftFromHero,
  probeHero,
  xpTotal,
  isUnresolvedChoice,
  splitLabel,
  splitTopLevelOu,
} from './draft';
import { XP_CAREER_FIRST, XP_CAREER_TOP3, parseStatus } from '../../engine/creation';

/** Métadonnées d'étape : libellé FR + fabrique de zones (rail/main) OU écran de plein rendu
 *  (`screen`, gabarit propre — étapes transposées à la charte « Atelier du scribe », #393). SOURCE
 *  UNIQUE du rendu, indexée par `StepId` stable — l'ordre ET la présence des étapes viennent de
 *  `stepIds()` (draft.ts, qui insère « Signe astral » selon la règle optionnelle ADE2), jamais
 *  d'un index positionnel codé. */
const STEP_META: Record<StepId, { label: string; zone?: (p: StepProps) => StepZones; screen?: (p: StepProps) => ReactNode }> = {
  species: { label: 'Race', screen: SpeciesRaceScreen },
  career: { label: 'Carrière', screen: CareerScreen },
  chars: { label: 'Caractéristiques', screen: CharScreen },
  star: { label: 'Signe astral', zone: StarZones },
  skills: { label: 'Compétences & Talents', screen: SkillsScreen },
  trappings: { label: 'Possessions', screen: TrappingsScreen },
  details: { label: 'Détails', screen: DetailsScreen },
  presentation: { label: 'Présentation', screen: PresentationScreen },
};

/** Espèces mises en avant : celles du Livre de base — dérivé des données, les suppléments
 *  apparaissent automatiquement à la suite. */
const CORE = allSpecies.filter((s) => s.source.book === 'livre-de-base').map((s) => s.label);

/** Choix proposés pour le trapping « Arme (Au choix) » : toutes les ARMES des données ({id, label}). */
const WEAPON_CHOICES = allTrappings
  .filter((t) => (t.type === 'melee' || t.type === 'ranged') && !/mains nues/i.test(t.label))
  .map((t) => ({ id: t.id, label: t.label }))
  .sort((a, b) => a.label.localeCompare(b.label, 'fr'));
/** Demeure céleste par ID (ADE2 ch.03 l.504-512) — libellé affiché + desc RAW en tooltip du thème astral. */
const HOUSE_BY_ID = new Map(celestialHouses.map((h) => [h.id, h]));

/** Texte de données (desc Markdown) → extrait lisible pour cartes et infobulles. */
function blurb(md: string | null | undefined, max = 160): string {
  if (!md) return '';
  const txt = mdToText(md);
  return txt.length > max ? `${txt.slice(0, max)}…` : txt;
}
const skillTip = (name: string) => {
  const data = findSkill(splitLabel(name).name);
  if (!data) return '';
  return `${CHAR_LABELS[data.characteristic]} · Compétence ${data.type === 'base' ? 'de Base' : 'Avancée'}\n${blurb(data.desc, 280)}`;
};
const talentTip = (name: string) => blurb(findTalent(splitLabel(name).name)?.desc, 300);
/** Clé de la Caractéristique liée à une compétence (« Ag »), pour annoter les listes. */
const skillCharKey = (name: string): CharKey | null => findSkill(splitLabel(name).name)?.characteristic ?? null;

/** Apparence de PRÉ-SÉLECTION (rail/entête, avant tout réglage) d'une espèce par `id` rules —
 *  mêmes briques que le brouillon (`rigSpeciesId`), rendue par la primitive `CharacterPreview`.
 *  CACHE module-scope (entrées finies, objets immuables) : un objet STABLE par (espèce, sexe), sinon
 *  le `React.memo` de CharacterPreview ne prend jamais et les ~25 lignes du rail re-résolvent le rig
 *  à chaque rendu de l'étape. */
/** Cadrage des cartes de RACE (grille SERRÉE, #431, verdict user « ça écrase les visages » à 88 %
 *  plein champ) — comparaison 88/75 tranchée en faveur du plus digne (visage/silhouette respirent). */
const RACE_CARD_FILL = 0.75;

const PICK_APPEARANCES = new Map<string, Appearance>();
function pickAppearance(speciesId: string, sex: 'M' | 'F', variantId?: string): Appearance {
  const key = `${speciesId}|${sex}|${variantId ?? ''}`;
  let a = PICK_APPEARANCES.get(key);
  if (!a) {
    a = { species: rigSpeciesId(speciesId), sex, build: 0.5, seed: hash32(speciesId, sex, variantId ?? '') };
    PICK_APPEARANCES.set(key, a);
  }
  return a;
}

export function CharacterCreator() {
  const party = useGame((s) => s.party);
  const net = useGame((s) => s.net);
  const setScreen = useGame((s) => s.setScreen);
  const addHero = useGame((s) => s.partyAddHero);
  const replaceHero = useGame((s) => s.partyReplaceHero);
  const editingHeroId = useGame((s) => s.editingHeroId);
  const setEditingHero = useGame((s) => s.setEditingHero);

  // MODE ÉDITION : héros déjà dans le groupe (bouton « Modifier ») → on rouvre son brouillon.
  // Round-trip SANS perte si le roster a gardé le `draft` exact ; sinon reconstruction partielle
  // (espèce/carrière/identité/apparence — pas les tirages figés ni les allocations).
  const editing = useMemo(() => {
    if (!editingHeroId) return null;
    const hero = party.find((h) => h.id === editingHeroId);
    if (!hero) return null;
    const saved = rosterLoad().find((e) => e.hero.id === editingHeroId);
    const draft = saved?.draft ?? draftFromHero(hero);
    return { heroId: hero.id, draft, lossless: !!saved?.draft };
  }, [editingHeroId, party]);

  const [d, setD] = useState<CreatorDraft>(() => editing?.draft ?? newDraft());
  const [step, setStep] = useState(0);

  const ids = stepIds();
  const curId = ids[step] ?? ids[ids.length - 1]; // garde-fou si la règle change le nombre d'étapes
  const err = validateStep(d, curId);
  const canNext = err == null;
  const [skillsSub, setSkillsSub] = useState<SkillsSub>('race');
  const skillsSubDone =
    skillsSub === 'race' ? speciesSkillsDone(d) : skillsSub === 'career' ? careerSkillsDone(d) : talentsDone(d);

  const closeCreator = () => {
    setEditingHero(null);
    setScreen('party');
  };

  const create = () => {
    const hero = buildHero(d, editing?.heroId); // édition : on conserve l'id du héros
    const wealth = draftWealth(d);
    rosterAdd({ hero, wealth, draft: d }); // roster persistant + brouillon EXACT (round-trip futur)
    if (editing) {
      // Remplacement EN PLACE (primitive atomique) : préserve l'index/ordre et transfère la
      // possession au même siège — pas de re-crédit de la Richesse (déjà comptée à la création).
      const seat = net.ownership[editing.heroId] ?? net.mySeat ?? 0;
      replaceHero(editing.heroId, hero, seat);
    } else {
      addHero(hero, wealth); // côté invité : intent vers l'hôte (l'état arrive par snapshot)
    }
    closeCreator();
  };

  // Hook appelé INCONDITIONNELLEMENT (règles des hooks) — ordre stable quelle que soit l'étape
  // active ; seule `CharZones` le consomme (via `StepProps.charReroll`).
  const charReroll = useRollFrisson(() => setD({ ...d, charRerolls: d.charRerolls + 1 }));
  const meta = STEP_META[curId];
  const stepProps: StepProps = { d, setD, charReroll, skillsSub, setSkillsSub };

  // Récap de pied VALIDE — étapes Race/Carrière (#393 P2/P4) : le message d'erreur garde toujours
  // la priorité (cf. footer, `err ?? ...`) ; une fois le choix fait, la barre le redit.
  const raceFooterSummary = (): string | null => {
    const sp = draftSpecies(d);
    if (!sp) return null;
    return `Race ${sp.label} — M ${sp.movement} · Destin ${sp.fate.fate} · Résilience ${sp.fate.resilience} · +${sp.fate.extra} à répartir.`;
  };
  const careerFooterSummary = (): string | null => {
    const c = findCareerById(d.careerId);
    if (!c) return null;
    const lvl1 = levelsForCareer(d.careerId).find((l) => l.level === 1);
    const cl = findClassById(c.class);
    return `Classe ${cl?.label ?? c.class} · carrière ${c.label} — départ ${lvl1?.label ?? '—'}, ${lvl1?.status ?? ''}.`;
  };

  // Une réf Codex cliquée ouvre la fiche en MODALE par-dessus l'assistant (cf. CodexOverlay) : le
  // brouillon reste intact (plus de changement d'écran qui le réinitialisait).
  return (
    <div className="screen creator">
      <header className="bar">
        <button className="btn small row-flex" onClick={closeCreator}>
          ← <Icon id="nav/seat-owner" size="sm" /> Groupe ({party.length}/4)
        </button>
        <h2>{editing ? 'Modifier le personnage' : 'Créateur de personnage'}</h2>
        <div className="wizard-steps">
          {ids.map((id, i) => (
            <button
              key={id}
              className={`step-chip ${i === step ? 'active' : ''} ${i < step ? 'done' : ''}`}
              disabled={i > step}
              onClick={() => setStep(i)}
            >
              {i + 1}. {STEP_META[id].label}
            </button>
          ))}
        </div>
        {/* Mobile : indicateur compact (pas de rangée défilante → pas de scrollbar). */}
        <div className="steps-progress">
          <span>
            Étape <b>{step + 1}</b>/{ids.length} · {STEP_META[curId].label}
          </span>
          <div className="steps-bar">
            <i style={{ width: `${((step + 1) / ids.length) * 100}%` }} />
          </div>
        </div>
      </header>

      {editing && !editing.lossless && (
        <p className="hint warn-text" style={{ margin: '4px 12px' }}>
          <Icon id="ui/warning" size="sm" /> Brouillon d'origine indisponible : race, carrière, identité et apparence sont repris, mais
          les tirages, allocations et Talents sont à revoir étape par étape avant d'enregistrer.
        </p>
      )}

      {/* `screen` monté en JSX (jamais en appel de fonction nue) : chaque écran-étape (Race/Carrière)
          pose ses PROPRES hooks internes (recherche, `useRollFrisson`…) — un appel de fonction directe
          les compterait dans les hooks de CE composant `CharacterCreator`, en ordre instable d'une
          étape à l'autre (violation des Règles des Hooks, #393 P2 — crashait au passage Race→Carrière,
          chacun avec un nombre de hooks internes différent). En JSX, React isole chaque écran dans son
          PROPRE Fiber (identité = le type de composant) : bascule d'étape = démonte/remonte proprement. */}
      {meta.screen ? <meta.screen {...stepProps} /> : <CreatorStepFrame d={d} step={step} zones={meta.zone!(stepProps)} />}

      <footer className="bar">
        <button className="btn" disabled={step === 0} onClick={() => setStep(step - 1)}>
          ← Précédent
        </button>
        <span className={`hint wizard-hint${(curId === 'skills' ? !skillsSubDone : !!err) ? ' warn-text' : ''}`}>
          {curId === 'skills'
            ? skillsSubMessage(d, skillsSub)
            : err ??
              (curId === 'species'
                ? raceFooterSummary() ?? ''
                : curId === 'career'
                  ? careerFooterSummary() ?? ''
                  : curId === 'presentation'
                    ? 'Relisez votre héros — chaque étape reste modifiable avant l\'engagement.'
                    : '')}
        </span>
        {step < ids.length - 1 ? (
          <button className="btn btn-primary" disabled={!canNext} onClick={() => setStep(step + 1)}>
            Suivant →
          </button>
        ) : (
          <button className="btn btn-primary" disabled={(!editing && party.length >= 4) || !canNext} onClick={create}>
            {editing ? 'Enregistrer les modifications' : 'Engager ce héros →'}
          </button>
        )}
      </footer>
    </div>
  );
}

type StepProps = {
  d: CreatorDraft;
  setD: (d: CreatorDraft) => void;
  /** Frisson de la relance des dix 2d10 (LDB 05 l.385, #396 v5) — le hook DOIT être appelé
   *  INCONDITIONNELLEMENT par le vrai composant React (`CharacterCreator`, ordre de hooks stable
   *  quelle que soit l'étape active) puis PASSÉ à `CharZones` : les fonctions `*Zones` sont des
   *  fabriques de JSX simples (pas des composants), y appeler un hook directement romprait les
   *  règles des Hooks au changement d'étape. Absent (appel direct hors render, ex. tests) → repli
   *  inerte (pas d'animation, la relance s'applique quand même). */
  charReroll?: ReturnType<typeof useRollFrisson>;
  /** Sous-onglet actif de l'étape 5 (a/b/c) — levé jusqu'ici pour que le pied de page (footer,
   *  `CharacterCreator`) reflète le volet ACTIF plutôt que le premier blocage toutes-branches. */
  skillsSub?: SkillsSub;
  setSkillsSub?: (s: SkillsSub) => void;
};

/** Titre de la rubrique Talents de l'explorateur de carrière (LDB 05 l.288 : « Vous pouvez choisir un
 *  unique Talent » — un SEUL choix à la création, parmi les 4 du Niveau de DÉPART uniquement). Les
 *  niveaux supérieurs consultés (rangs 2-4, `CareerPath`) restent NEUTRES — de l'évolution future,
 *  jamais un choix de création (bug utilisateur 2026-07-15 : le rang 3 affichait la même note). */
export function careerLevelTalentsTitle(level: number): string {
  return level === 1 ? 'Talents — un au choix' : `Talents — Niveau ${level}`;
}

/** Rendu Markdown des textes de données (descriptions — verbatim de la source, via la primitive Prose). */
function LoreText({ md }: { md: string | null | undefined }) {
  if (!md?.trim()) return null;
  return <div className="lore-text"><Prose md={md} /></div>;
}

// ════ 1) Race (LDB 04 l.84-90) — charte « Atelier du scribe » (#393 P2, correction structurelle
//      du verdict utilisateur 2026-07-14) : gabarit DEUX ZONES (compose `MasterDetail`, grille
//      ~60 % / détail ~40 %) — liste = 7 GRANDES CARTES DE RACE (une par `SpeciesData.family`,
//      figurine généreuse + « N lignées ») ⇄ détail = la LIGNÉE choisie (chips-pills en tête du
//      panneau, une par variante de la famille — Reiklander/Middenheim/…) puis `DetailFrame` de la
//      lignée élue. Le brouillon reste keyé sur `speciesId` (id de LIGNÉE, ex. `humains-reiklander`)
//      — seule la PRÉSENTATION du choix se restructure en race→lignée, jamais la mécanique
//      (`withSpecies`/`rollDraftSpecies` inchangés). Pas de fiche vivante à cette étape (arbitrage
//      2026-07-14) : mort du call-site Race de `FacetedPickGrid` — Carrière (#393 P2 volet Carrière)
//      transpose son propre call-site séparément, `FacetedPickGrid` reste son composant jusque-là.
export function SpeciesRaceScreen({ d, setD }: StepProps): ReactNode {
  const [search, setSearch] = useState('');
  const sp = draftSpecies(d);
  const gridRef = useRef<HTMLDivElement>(null);
  const lineageRef = useRef<HTMLDivElement>(null);

  // Groupes par race (`SpeciesData.family` — donnée, plus de regex sur le libellé),
  // les races du Livre de base d'abord — l'ordre des familles suit les données ; au sein d'une
  // famille, la 1ʳᵉ lignée des données EST la canonique (ex. Reiklander pour Humains, LDB 04 l.84).
  // Le Gnome (et tout contenu NADJ) n'apparaît dans la grille que si la règle optionnelle l'autorise.
  const gnomeOn = !!rule('creation-gnome-jouable');
  const families: { family: string; list: SpeciesData[] }[] = [];
  for (const s of allSpecies) {
    if (s.source.book === 'nuits-agitees-et-dures-journees' && !gnomeOn) continue;
    const g = families.find((f) => f.family === s.family);
    if (g) g.list.push(s);
    else families.push({ family: s.family, list: [s] });
  }
  families.sort((a, b) => Number(b.list.some((s) => CORE.includes(s.label))) - Number(a.list.some((s) => CORE.includes(s.label))));
  const totalRaces = families.reduce((n, f) => n + f.list.length, 0);

  // La recherche filtre les RACES (nom de famille) ET les LIGNÉES (variantes) — une lignée matchée
  // garde/surligne sa carte de race (le filtre agit au niveau famille, jamais en éclatant la grille).
  const visibleFamilies = filterByLabel(families, (f) => `${f.family} ${f.list.map((s) => s.variant ?? s.label).join(' ')}`, search);
  const activeFamilyIdx = Math.max(0, visibleFamilies.findIndex((f) => f.family === sp?.family));
  const selectFamily = (list: SpeciesData[]) => setD(withSpecies(d, sp && list.some((s) => s.id === sp.id) ? sp.id : list[0].id));
  const onGridKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End'].includes(e.key) || !visibleFamilies.length) return;
    e.preventDefault();
    const delta = e.key === 'ArrowLeft' || e.key === 'ArrowUp' ? -1 : e.key === 'ArrowRight' || e.key === 'ArrowDown' ? 1 : 0;
    const next = e.key === 'Home' ? 0 : e.key === 'End' ? visibleFamilies.length - 1 : (activeFamilyIdx + delta + visibleFamilies.length) % visibleFamilies.length;
    selectFamily(visibleFamilies[next].list);
    gridRef.current?.querySelectorAll<HTMLButtonElement>('[role="option"]')[next]?.focus();
  };

  // Lignées de la famille COURANTE (chips en tête du panneau détail) — masquées si la famille n'a
  // qu'une lignée (Gnomes/Hauts elfes/Elfes sylvains/Ogres du LDB) : rien à trancher.
  const famList = sp ? families.find((f) => f.family === sp.family)?.list ?? [] : [];
  const onLineageKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (!sp || !['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End'].includes(e.key) || !famList.length) return;
    e.preventDefault();
    const activeIdx = Math.max(0, famList.findIndex((s) => s.id === sp.id));
    const delta = e.key === 'ArrowLeft' || e.key === 'ArrowUp' ? -1 : e.key === 'ArrowRight' || e.key === 'ArrowDown' ? 1 : 0;
    const next = e.key === 'Home' ? 0 : e.key === 'End' ? famList.length - 1 : (activeIdx + delta + famList.length) % famList.length;
    setD(withSpecies(d, famList[next].id));
    lineageRef.current?.querySelectorAll<HTMLButtonElement>('[role="radio"]')[next]?.focus();
  };

  // Encrier de tirage RACE (#393 P3, correction structurelle du verdict utilisateur 2026-07-14) :
  // rangée UNIQUE avec la recherche (recherche à gauche, encrier remplit le reste — pas de section
  // « Aux dés » séparée, pas de rangée d'aide flottante : le sous-titre PORTE la règle). Une fois le
  // d100 posé, le mur de boutons meurt : le résultat vit dans l'encrier (rendu laiton) et l'éligibilité
  // se marque sur les surfaces existantes (badge « +20 PX » des chips de lignée, liseré des cartes de
  // famille) — la sélection reste la même mécanique (chips/cartes), le bonus de PX inchangé (`speciesXp`).
  const rolledIds = d.speciesRoll?.ids ?? [];
  const rolledFamilies = new Set(rolledIds.map((id) => findSpeciesById(id)?.family).filter((f): f is string => !!f));
  const rolledFamily = d.speciesRoll ? (sp && rolledIds.includes(sp.id) ? sp.family : findSpeciesById(rolledIds[0])?.family) : undefined;
  const kept = speciesXp(d) > 0;
  const { rolling, landed, trigger, skip } = useRollFrisson(() => setD(rollDraftSpecies(d)));
  const faces = landed && d.speciesRoll ? d100Faces(d.speciesRoll.roll) : null;

  const diceCell = rolling || landed ? (
    <DiceRoll scene landed={landed} faces={faces} onSkip={skip} />
  ) : !d.speciesRoll ? (
    <button type="button" className="dicewell act emph" onClick={() => trigger()}>
      <span className="dicewell-tray">
        <span className="rm-die dicewell-die"><DieFace n={null} landed /></span>
        <span className="rm-die dicewell-die"><DieFace n={null} landed /></span>
      </span>
      <span className="dicewell-copy">
        <span className="dicewell-txt">Tirer aux dés — d100</span>
        <span className="dicewell-sub">sa race au hasard : <b>+20 PX de création</b> (garder le tirage)</span>
      </span>
    </button>
  ) : (
    <div className="dicewell done">
      <span className="dicewell-tray">
        <span className="rm-die dicewell-die"><DieFace n={d100Faces(d.speciesRoll.roll)[0]} landed /></span>
        <span className="rm-die dicewell-die"><DieFace n={d100Faces(d.speciesRoll.roll)[1]} landed /></span>
      </span>
      <span className="dicewell-copy">
        <span className="dicewell-txt">
          Jet : <b>{d.speciesRoll.roll}</b> — borne {rolledFamily} · {kept ? '+20 PX conservé' : '+0 PX (choix libre)'}
        </span>
      </span>
    </div>
  );

  const list = (
    <>
      <div className="creator-pick-toolbar">
        <div className="creator-pick-search">
          <SearchFilterField value={search} onChange={setSearch} icon placeholder="Rechercher une race…" />
        </div>
        {diceCell}
      </div>
      <p className="creator-pick-count">{families.length} races — {totalRaces} lignées</p>
      <div ref={gridRef} role="listbox" aria-label="Choix de la race" className="creator-race-grid" onKeyDown={onGridKeyDown}>
        {visibleFamilies.map((f, idx) => {
          const rep = f.list[0];
          const selected = sp?.family === f.family;
          const rolled = !selected && rolledFamilies.has(f.family);
          return (
            <FigTile
              key={f.family}
              preview={{
                appearance: pickAppearance(rep.id, d.sex, rep.variant ?? rep.id),
                career: rep.preview?.career,
                fillFraction: RACE_CARD_FILL,
              }}
              label={f.family}
              sub={`${f.list.length} lignée${f.list.length > 1 ? 's' : ''}`}
              selected={selected}
              ambiance="panel"
              tabIndex={idx === activeFamilyIdx ? 0 : -1}
              className={rolled ? 'rolled' : undefined}
              onClick={() => selectFamily(f.list)}
            />
          );
        })}
      </div>
    </>
  );

  const bookLabel = sp?.source ? findBookById(sp.source.book)?.label ?? sp.source.book : undefined;

  const detail = !sp ? (
    <p className="hint">
      Sélectionnez une race dans la liste, ou tirez-la aux dés (LDB 04 l.84-90). Le détail se remplira au fil de vos choix.
    </p>
  ) : (
    <DetailFrame
      topper={
        famList.length > 1 ? (
          <div ref={lineageRef} role="radiogroup" aria-label="Lignée" className="creator-race-lineages" onKeyDown={onLineageKeyDown}>
            {famList.map((s) => (
              <button
                key={s.id}
                type="button"
                role="radio"
                aria-checked={s.id === sp.id}
                tabIndex={s.id === sp.id ? 0 : -1}
                className={`chip creator-race-lineage${s.id === sp.id ? ' sel' : ''}`}
                onClick={() => setD(withSpecies(d, s.id))}
              >
                {s.variant ?? s.label}
              </button>
            ))}
          </div>
        ) : undefined
      }
      name={<CodexRef category="races" id={sp.id} label={sp.label}>{sp.label}</CodexRef>}
      sub={bookLabel && sp.source ? `${bookLabel} p. ${sp.source.page}` : undefined}
      meta={
        <>
          <span className="chip">Mouvement <b>{sp.movement}</b></span>
          <span className="chip">Destin <b>{sp.fate.fate}</b></span>
          <span className="chip">Résilience <b>{sp.fate.resilience}</b></span>
          <span className="chip"><b>+{sp.fate.extra}</b> à répartir</span>
          {sp.small && (
            <span className="chip" title="Talent Petit : Blessures calculées sans le Bonus de Force">
              Taille <b>Petite</b>
            </span>
          )}
        </>
      }
      // Caractéristiques : `CharStatsGrid` (source unique de la plaque .char-stats, #418) avec
      // `sp.baseChar` — plus de rows codex-kv ; le delta vs base humaine (20) passe en `note` (tooltip
      // discret), jamais dans la valeur affichée. Compétences/Talents : mêmes sections que le Codex
      // (source unique `raceSkillSection`/`raceTalentSection`), « ou » en chips SÉPARÉES codex-liées.
      sections={
        <>
          <div>
            <div className="mini-title">Caractéristiques de base</div>
            <CharStatsGrid
              size="md"
              value={(k) => sp.baseChar?.[k] ?? 20}
              note={(k) => {
                const base = sp.baseChar?.[k] ?? 20;
                const diff = base - 20;
                return diff !== 0 ? `Base humaine 20 (${diff > 0 ? '+' : ''}${diff})` : undefined;
              }}
            />
          </div>
          <CodexSections sections={[raceSkillSection(sp), raceTalentSection(sp)].filter((s): s is CodexSection => !!s)} />
        </>
      }
      prose={sp.desc}
      proseSelfLabel={sp.label}
      proseSelfCategory="races"
    />
  );

  return <MasterDetail className="creator-pick-shell" listLabel="Choix de la race" list={list} detail={detail} />;
}

// ════ 2) Carrière (LDB 05 l.186-365) — charte « Atelier du scribe » (#393 P2, MÊME gabarit DEUX
//      ZONES que Race, `MasterDetail`) : liste = TOUTES les classes en SECTIONS empilées
//      (`GroupedPickGrid`, une tuile-figurine compacte par carrière — `FigTile`/`CharacterPreview`,
//      ~6-7 par rangée, maquette ratifiée `finale-mock1-carriere.png`, corrigé 2026-07-14 : le brief
//      « nominatif sans figurine » venait du croquis initial, la planche RATIFIÉE montre bien de
//      petites figurines) ⇄ détail = la carrière élue (`DetailFrame` — `MetalStatus`+`CareerPath`,
//      1ers consommateurs réels, #412). Mort du call-site Carrière de `FacetedPickGrid` (DERNIER
//      consommateur, #393 P2) : le fichier meurt avec lui. Mécanique INCHANGÉE (`withCareer`/
//      `rollDraftCareer`, draft.ts) — présentation seule se restructure, patron encrier de Race
//      (rangée toolbar, résultat vit dans l'encrier plutôt qu'un mur de boutons).
export function CareerScreen({ d, setD }: StepProps): ReactNode {
  const [search, setSearch] = useState('');
  const sp = draftSpecies(d);
  // Table EFFECTIVE (#393 P2 correctif utilisateur) : `careersForSpecies` seule renvoie les DEUX
  // portions Riverains/Côtiers quand la colonne d'espèce les porte toutes deux — la grille doit
  // rester en phase avec la bascule `coastalSwap` (MÊME exclusivité que le tirage, `careerRollPool`),
  // sinon la classe désactivée reste visible/sélectionnable quel que soit l'état de la chip.
  const pool = careerRollPool(d);
  const accessible = sp ? careersForSpecies(sp.refCareer, d.ignoreRestrictions).filter((c) => pool.some((p) => p.id === c.id)) : [];
  const career = findCareerById(d.careerId);
  const levels = levelsForCareer(d.careerId);
  const lvl1 = levels.find((l) => l.level === 1);
  const lvlMax = levels.length ? levels.reduce((a, b) => (a.level > b.level ? a : b)) : undefined;

  // Rang CONSULTÉ (exploration en LECTURE du détail, #393 P2 correctif utilisateur) : la chaîne
  // `CareerPath` bascule les rubriques Caractéristiques/Compétences/Talents sur le niveau cliqué —
  // le CHOIX de création reste au niveau 1 (`draft.ts`/`buildHero` ne lisent jamais `exploredLevel`).
  const [exploredLevel, setExploredLevel] = useState(1);
  useEffect(() => setExploredLevel(1), [d.careerId]);
  const lvlExplored = levels.find((l) => l.level === exploredLevel) ?? lvl1;

  const sectionsAll: PickGridSection[] = sp
    ? classes
        .filter((cl) => accessible.some((c) => c.class === cl.id))
        .map((cl) => ({
          id: cl.id,
          label: cl.label,
          items: accessible
            .filter((c) => c.class === cl.id)
            .map((c: CareerData) => ({ id: c.id, label: c.label, preview: { appearance: pickAppearance(sp.id, d.sex, c.id), career: c.id } })),
        }))
    : [];
  const q = search.trim();
  const sections = q
    ? sectionsAll.map((s) => ({ ...s, items: filterByLabel(s.items, (it) => it.label, q) })).filter((s) => s.items.length)
    : sectionsAll;

  // Encrier de tirage CARRIÈRE (#393 P2, même patron que Race #393 P3) : rangée unique recherche +
  // encrier, le résultat vit dans l'encrier rendu (plus de mur de boutons de borne). LDB 05 l.191-195 :
  // 1ᵉʳ jet gardé = +50 PX ; pas convaincu → deux jets de plus (3 bornes au choix) = +25 PX ; au-delà,
  // relances libres = 0 PX (mécanique `rollDraftCareer`/`careerXp`, INCHANGÉE).
  const rolledLast = d.careerRolls[d.careerRolls.length - 1];
  const kept = careerXp(d) > 0;
  const { rolling, landed, trigger, skip } = useRollFrisson(() => setD(rollDraftCareer(d)));
  const faces = landed && rolledLast ? d100Faces(rolledLast.roll) : null;

  const diceCell = rolling || landed ? (
    <DiceRoll scene landed={landed} faces={faces} onSkip={skip} />
  ) : d.careerRolls.length === 0 ? (
    <button type="button" className="dicewell act emph" disabled={!sp} onClick={() => trigger()}>
      <span className="dicewell-tray">
        <span className="rm-die dicewell-die"><DieFace n={null} landed /></span>
        <span className="rm-die dicewell-die"><DieFace n={null} landed /></span>
      </span>
      <span className="dicewell-copy">
        <span className="dicewell-txt">Tirer aux dés — d100</span>
        <span className="dicewell-sub">
          sa carrière au hasard : <b>+{XP_CAREER_FIRST} PX</b> (1ᵉʳ jet) · pas convaincu, deux relances → <b>+{XP_CAREER_TOP3} PX</b> (LDB 05)
        </span>
      </span>
    </button>
  ) : (
    <div className="dicewell done">
      <span className="dicewell-tray">
        <span className="rm-die dicewell-die"><DieFace n={d100Faces(rolledLast.roll)[0]} landed /></span>
        <span className="rm-die dicewell-die"><DieFace n={d100Faces(rolledLast.roll)[1]} landed /></span>
      </span>
      <span className="dicewell-copy">
        <span className="dicewell-txt">
          {d.careerRolls.length >= 3 ? (
            <>Jets : <b>{d.careerRolls.map((r) => r.roll).join(' · ')}</b> — 3 choix · {kept ? `+${careerXp(d)} PX conservé` : '+0 PX (choix libre)'}</>
          ) : (
            <>Jet : <b>{rolledLast.roll}</b> — {kept ? `+${careerXp(d)} PX conservé` : '+0 PX (choix libre)'}</>
          )}
        </span>
        {d.careerRolls.length === 1 && (
          <button type="button" className="btn small" style={{ marginTop: 4 }} onClick={() => trigger()}>
            <Icon id="nav/dice" size="sm" /> Pas convaincu : 2 jets de plus (3 choix, +{XP_CAREER_TOP3} PX)
          </button>
        )}
        {d.careerRolls.length >= 3 && (
          <button type="button" className="btn small" style={{ marginTop: 4 }} onClick={() => trigger()}>
            <Icon id="nav/dice" size="sm" /> Continuer à relancer (0 PX)
          </button>
        )}
      </span>
    </div>
  );

  const list = !sp ? (
    <p className="hint">Choisissez d'abord une race pour découvrir les carrières accessibles.</p>
  ) : (
    <>
      <div className="creator-pick-toolbar">
        <div className="creator-pick-search">
          <SearchFilterField value={search} onChange={setSearch} icon placeholder="Rechercher une carrière…" />
        </div>
        {diceCell}
      </div>
      <div className="row-flex creator-pick-filters">
        <button
          type="button"
          className="chip"
          aria-pressed={d.ignoreRestrictions}
          onClick={() => setD({ ...d, ignoreRestrictions: !d.ignoreRestrictions })}
        >
          Ignorer les restrictions de race
        </button>
        {/* MDG 09 l.9 : choix AVANT le jet — VERROUILLÉE dès qu'un jet existe (`withCoastalSwap` refuse
            déjà le changement côté draft ; l'UI le reflète en désactivant la chip, anti-exploit
            relance gratuite, #393 P2 correctif utilisateur). */}
        {coastalSwapAvailable(d) && (
          <button
            type="button"
            className="chip"
            aria-pressed={d.coastalSwap}
            disabled={d.careerRolls.length > 0}
            title={
              d.careerRolls.length > 0
                ? 'MDG 09 l.9 — se choisit avant de lancer les dés (verrouillé après jet)'
                : 'MDG 09 l.9 — bascule avant le jet (variante Côtiers à la place des Riverains)'
            }
            onClick={() => setD(withCoastalSwap(d, !d.coastalSwap))}
          >
            Côtiers à la place des Riverains
          </button>
        )}
        <span className="creator-pick-count">{sectionsAll.length} classes — {accessible.length} carrières</span>
      </div>
      <GroupedPickGrid sections={sections} selectedId={d.careerId || undefined} onSelect={(id) => setD(withCareer(d, id))} label="Choix de la carrière" />
    </>
  );

  const bookLabel = career?.source ? findBookById(career.source.book)?.label ?? career.source.book : undefined;

  const detail = !sp ? (
    <p className="hint">Sélectionnez d'abord une race (étape précédente).</p>
  ) : !career || !lvl1 ? (
    <p className="hint">Sélectionnez une carrière dans la liste, ou tirez-la aux dés (LDB 05 l.186-365).</p>
  ) : (
    <DetailFrame
      name={<CodexRef category="careers" id={career.id} label={career.label ?? d.careerId}>{careerLabelFor({ career: d.careerId, appearance: { sex: d.sex } })}</CodexRef>}
      sub={bookLabel && career.source ? `${bookLabel} p. ${career.source.page}` : undefined}
      meta={
        <>
          {career.class && (
            <span className="chip">
              <CodexRef category="classes" id={career.class} label={findClassById(career.class)?.label ?? career.class}>{findClassById(career.class)?.label ?? career.class}</CodexRef>
            </span>
          )}
          <span className="chip">Départ <b>{lvl1.label}</b></span>
          <MetalStatus status={lvl1.status} size="chip" />
          {lvlMax && lvlMax.status !== lvl1.status && (
            <span className="chip">
              {lvl1.status} → {lvlMax.status}
            </span>
          )}
        </>
      }
      sections={
        <>
          <div>
            <div className="mini-title">Évolution — quatre niveaux <em className="hint">(cliquer un rang pour le consulter)</em></div>
            <CareerPath levels={levels} currentLevel={1} selected={exploredLevel} onSelect={setExploredLevel} />
          </div>
          {lvlExplored && (
            <>
              <div>
                <div className="mini-title">Caractéristiques — Niveau {lvlExplored.level}</div>
                <div className="skill-tags">
                  {lvlExplored.characteristics.map((c) => (
                    <EntityRef key={c} category="characteristics" id={c} label={CHAR_LABELS[c]} />
                  ))}
                </div>
              </div>
              <div>
                <div className="mini-title">Compétences — Niveau {lvlExplored.level}</div>
                <div className="skill-tags">
                  {lvlExplored.skills.map((a) => advancementLabel('skills', a)).map((s) => (
                    <EntityChoice key={s} category="skills" entry={s} />
                  ))}
                </div>
              </div>
              <div>
                {/* Le qualificatif « un au choix » + la note de tranchage n'est vrai QU'AU NIVEAU DE
                    DÉPART (LDB 05 l.288 : « Vous pouvez choisir un unique Talent » — un seul choix à
                    la création, parmi les 4 du Niveau 1 SEUL) ; les niveaux supérieurs consultés ici
                    ne sont que de l'ÉVOLUTION future, jamais un choix de création (bug utilisateur
                    2026-07-15 : le rang 3 affichait la même note « se tranche à l'étape 5 »). */}
                <div className="mini-title">{careerLevelTalentsTitle(lvlExplored.level)}</div>
                <div className="skill-tags">
                  {lvlExplored.talents.map((a) => advancementLabel('talents', a)).map((t) => (
                    <EntityChoice key={t} category="talents" entry={t} />
                  ))}
                  {lvlExplored.level === 1 && <em className="nb">se tranche à l'étape 5</em>}
                </div>
              </div>
            </>
          )}
        </>
      }
      prose={career.desc}
      proseSelfLabel={career.label}
      proseSelfCategory="careers"
    />
  );

  return <MasterDetail className="creator-pick-shell" listLabel="Choix de la carrière" list={list} detail={detail} />;
}

// ════ 3) Caractéristiques (LDB 05 l.370-491) — charte « Atelier du scribe » (#393 P3bis, correctif
//      utilisateur 2026-07-15 : « ni de près, ni de loin, la maquette » sur la composition 3-zones
//      d'origine) : gabarit DEUX ZONES (panneau + fiche vivante, MÊME composition que Race/Carrière/
//      Compétences) — plus de rail séparé, TOUT vit dans le panneau central en BANDES (`Band`, étalon
//      `finale-mock2-caracteristiques.png`) : La méthode (segmenté) → Le tirage (grille + jauge N/10)
//      → Augmentations gratuites (0ter, la maquette a PERDU ce bloc — transposé ICI, même bandage que
//      Destin & Résilience, jamais supprimé) → Destin & Résilience. Mécanique INCHANGÉE (draft.ts).
export function CharScreen({ d, setD, charReroll }: StepProps): ReactNode {
  const sp = draftSpecies(d);
  const rolls = charRolls(d);
  const pairs = charRollPairs(d);
  const chars = draftChars(d);
  const careerKeys = careerCharKeys(d);
  const allocTotal = Object.values(d.charAdvancesAlloc).reduce((a, b) => a + (b ?? 0), 0);
  const pbTotal = CHAR_KEYS.reduce((a, k) => a + d.pointBuy[k], 0);
  const splitTotal = d.fateSplit.fate + d.fateSplit.resilience;
  // Relance des dix jets (LDB 05 l.385) : MÊME primitive de frisson que les autres tirages du
  // créateur (arbitrage user « pareil pour toutes les modales », #396 v5) — un unique roulis pilote
  // les DIX rangées (une relance touche les dix jets à la fois) ; chaque rangée anime sa PROPRE paire
  // réelle (`pairs[i]`, `charRollPairs`), jamais une valeur reconstruite depuis la somme. Le hook vit
  // dans `CharacterCreator` (appel inconditionnel, cf. `StepProps.charReroll`) ; repli inerte hors render.
  const reroll = charReroll ?? { rolling: false, landed: false, trigger: () => setD({ ...d, charRerolls: d.charRerolls + 1 }), skip: () => {} };

  if (!sp) {
    return (
      <div className="creator-chars-screen">
        <div className="creator-chars-shell">
          <div className="creator-chars-main">
            <p className="hint">Choisissez d'abord une race pour répartir vos Caractéristiques.</p>
          </div>
        </div>
      </div>
    );
  }

  const tiredCount = d.charMode === 'rolled' ? (reroll.rolling ? 0 : 10) : 0;
  const tirageTitle = d.charMode === 'rolled' ? 'Le tirage — 2d10 par Caractéristique' : d.charMode === 'reassigned' ? 'Réassignation des dix jets' : 'Répartition des points';

  return (
    <div className="creator-chars-screen">
      <div className="creator-chars-shell">
        <div className="detail-frame creator-chars-main">
          <h3 className="creator-skills-title">Caractéristiques</h3>
          <p className="hint creator-skills-sub">Base + 2d10 — le profil se couche sur le registre</p>

          {/* LA MÉTHODE (#393 P3bis) : sélecteur PERMANENT segmenté — les trois options coexistent
              toujours (pas une cérémonie de tirage unique). */}
          <Band title="La méthode" right={<XpBadge value={charsXp(d)} />}>
            <OptionChooser
              layout="seg"
              options={[
                { key: 'rolled', label: `Aux dés — garder le tirage`, value: undefined, mode: 'rolled' as const, px: d.charRerolls === 0 ? '+50 PX' : '+0 PX' },
                { key: 'reassigned', label: `Aux dés — réorganiser ensuite`, mode: 'reassigned' as const, px: d.charRerolls === 0 ? '+25 PX' : '+0 PX' },
                { key: 'pointBuy', label: 'Répartir 100 points', mode: 'pointBuy' as const, px: '0 PX' },
              ].map(({ key, label, mode, px }) => ({
                key,
                label: <>{label} <em className="hint" style={{ fontStyle: 'normal' }}>{px}</em></>,
                selected: d.charMode === mode,
                onSelect: () => setD({ ...d, charMode: mode }),
              }))}
            />
            <p className="hint" style={{ marginTop: 8 }}>
              Chaque Caractéristique s'écrit base + 2d10 (LDB 05). Garder le tirage tel quel rapporte le plus de PX de création.
            </p>
          </Band>

          {/* LE TIRAGE (#393 P3bis) : jauge « N/10 tirées » en tête de bande — les DIX Caractéristiques
              roulent EN UN SEUL geste (`charReroll`, seed unique, LDB 05 l.385) ; la jauge reflète
              honnêtement ce mécanisme simultané (0/10 pendant le roulis, 10/10 posé). */}
          <Band
            title={tirageTitle}
            right={
              d.charMode === 'pointBuy' ? (
                <b className={pbTotal === 100 ? 'ok-text' : 'warn-text'}>Points : {pbTotal}/100</b>
              ) : d.charMode === 'rolled' ? (
                <NotchGauge value={tiredCount} max={10} notches={10} format={(v, m) => `${v}/${m} tirées`} tone={tiredCount === 10 ? 'ok' : 'neutral'} />
              ) : undefined
            }
          >
            <p className="hint" style={{ margin: '4px 0 10px' }}>
              Vous réglez ici la valeur d'ÉDITION (base d'espèce + tirage/allocation) ; la fiche vivante en montre
              le résultat. Les Caractéristiques <span className="tag char">carrière</span> progressent au coût normal
              en PX et comptent pour la complétion du Niveau ; l'Initiative départage l'ordre du combat.
            </p>
            <div className="char-alloc-grid">
              {CHAR_KEYS.map((k, i) => (
                <div key={k} className={`char-alloc${d.charMode === 'rolled' && reroll.rolling ? ' rolled' : ''}`}>
                  <CodexRef category="characteristics" id={k} label={CHAR_LABELS[k]} className="char-key">{CHAR_ABR[k]}</CodexRef>
                  <span className="char-name">
                    {CHAR_LABELS[k]}
                    {careerKeys.includes(k) && <span className="tag char">carrière</span>}
                  </span>
                  <em>base {sp.baseChar[k] ?? 20}</em>
                  {d.charMode === 'rolled' && (reroll.rolling || reroll.landed) ? (
                    <span className="char-roll row-flex">
                      <DiceRoll scene={false} landed={reroll.landed} faces={reroll.landed ? d10PairFaces(pairs[i]) : null} onSkip={reroll.skip} />
                    </span>
                  ) : d.charMode === 'rolled' ? (
                    <span className="char-roll row-flex">
                      <span className="rm-die char-die"><DieFace n={pairs[i][0]} landed /></span>
                      <span className="rm-die char-die"><DieFace n={pairs[i][1]} landed /></span>
                    </span>
                  ) : null}
                  {d.charMode === 'reassigned' && (
                    <select
                      value={d.assignment[k]}
                      onChange={(e) => {
                        const idx = Number(e.target.value);
                        const holder = CHAR_KEYS.find((kk) => d.assignment[kk] === idx)!; // échange → permutation garantie
                        setD({ ...d, assignment: { ...d.assignment, [k]: idx, [holder]: d.assignment[k] } });
                      }}
                    >
                      {rolls.map((r, j) => (
                        <option key={j} value={j}>
                          +{r}
                        </option>
                      ))}
                    </select>
                  )}
                  {d.charMode === 'pointBuy' && (
                    <AllocStepper value={d.pointBuy[k]} min={4} max={18} onChange={(v) => setD({ ...d, pointBuy: { ...d.pointBuy, [k]: v } })} label={CHAR_LABELS[k]} />
                  )}
                  <b className="char-total">{chars[k]}</b>
                </div>
              ))}
            </div>
            {d.charMode !== 'pointBuy' && (
              <button className="btn small" style={{ marginTop: 10 }} onClick={() => reroll.trigger()}>
                <Icon id="nav/dice" size="sm" /> Relancer les dix jets (bonus perdus)
              </button>
            )}
          </Band>

          {/* AUGMENTATIONS GRATUITES (arbitrage 0ter, 2026-07-15) : la maquette a PERDU ce bloc — la
              MÉCANIQUE (5 Augmentations de carrière) reste, transposée au même bandage que Destin &
              Résilience plutôt qu'un widget recopié de l'ancien créateur. */}
          <Band
            title={`Augmentations gratuites — ${allocTotal}/${CAREER_CHAR_ADVANCES} à répartir`}
            right={<b className={allocTotal === CAREER_CHAR_ADVANCES ? 'ok-text' : 'warn-text'}>{allocTotal}/{CAREER_CHAR_ADVANCES}</b>}
          >
            <p className="hint" style={{ margin: '4px 0 10px' }}>À répartir sur les Caractéristiques de votre carrière.</p>
            <div className="skill-row-grid">
              {careerKeys.map((k) => (
                <div key={k} className="skill-row">
                  <span className="skill-row-label"><CodexRef category="characteristics" id={k} label={CHAR_LABELS[k]}>{CHAR_LABELS[k]}</CodexRef></span>
                  <AllocStepper
                    value={d.charAdvancesAlloc[k] ?? 0}
                    max={Math.min(CAREER_CHAR_ADVANCES, (d.charAdvancesAlloc[k] ?? 0) + (CAREER_CHAR_ADVANCES - allocTotal))}
                    onChange={(v) => setD({ ...d, charAdvancesAlloc: { ...d.charAdvancesAlloc, [k]: v } })}
                    label={CHAR_LABELS[k]}
                  />
                </div>
              ))}
            </div>
          </Band>

          <Band
            title={`Destin & Résilience — +${sp.fate.extra} à répartir`}
            right={<b className={splitTotal === sp.fate.extra ? 'ok-text' : 'warn-text'}>{splitTotal}/{sp.fate.extra}</b>}
          >
            <p className="hint" style={{ margin: '4px 0 10px' }}>
              <Icon id="resource/fate" size="sm" /> Destin : survie & Chance. <Icon id="resource/resilience" size="sm" /> Résilience :
              Détermination (votre Motivation la recharge).
            </p>
            <div className="skill-row-grid">
              <div className="skill-row">
                <span className="skill-row-label"><Icon id="resource/fate" size="sm" /> Destin<em>race : {sp.fate.fate}</em></span>
                <AllocStepper
                  value={d.fateSplit.fate}
                  max={Math.min(sp.fate.extra, d.fateSplit.fate + (sp.fate.extra - splitTotal))}
                  onChange={(v) => setD({ ...d, fateSplit: { ...d.fateSplit, fate: v } })}
                  label="Destin"
                />
              </div>
              <div className="skill-row">
                <span className="skill-row-label"><Icon id="resource/resilience" size="sm" /> Résilience<em>race : {sp.fate.resilience}</em></span>
                <AllocStepper
                  value={d.fateSplit.resilience}
                  max={Math.min(sp.fate.extra, d.fateSplit.resilience + (sp.fate.extra - splitTotal))}
                  onChange={(v) => setD({ ...d, fateSplit: { ...d.fateSplit, resilience: v } })}
                  label="Résilience"
                />
              </div>
            </div>
          </Band>
        </div>
        <CreatorSummary d={d} step={stepIds().indexOf('chars')} />
      </div>
    </div>
  );
}

/** Adapte `QtyStepper` (primitive canonique, table CLAUDE.md) au vocabulaire LINÉAIRE de l'allocation
 *  du créateur (± 1 entre `min` et `max`) — un décrément/incrément d'UNE unité. Mort du `Stepper`
 *  local du créateur (verdict utilisateur 2026-07-15 : « on créait des primitives ou on fait encore
 *  du code spécifique création ? ») : ce site consomme la MÊME primitive que la table marchande. */
function AllocStepper({ value, min = 0, max, onChange, label }: { value: number; min?: number; max: number; onChange: (v: number) => void; label: string }) {
  return (
    <QtyStepper
      center={<b>{value}</b>}
      onDec={() => onChange(value - 1)}
      onInc={() => onChange(value + 1)}
      decDisabled={value <= min}
      incDisabled={value >= max}
      decLabel={`${label} : diminuer`}
      incLabel={`${label} : augmenter`}
    />
  );
}

/** Sélecteur de spec pour une entrée « (Au choix) » — bound à specChoices[raw]. La VALEUR stockée est
 *  la spec SEULE (id de Groupe d'arme pour Corps à corps/Projectiles, texte FR sinon) — jamais un
 *  libellé complet reparsé ; l'affichage passe par `specLabel`. */
function SpecSelect({ d, setD, raw }: StepProps & { raw: string }) {
  const { name } = splitLabel(raw);
  const options = specOptionsFor(raw);
  const current = d.specChoices[raw] ?? '';
  const skillId = findSkill(name)?.id ?? name;
  return (
    <select
      value={current}
      onChange={(e) => {
        const specChoices = { ...d.specChoices };
        if (e.target.value) specChoices[raw] = e.target.value;
        else delete specChoices[raw];
        setD({ ...d, specChoices });
      }}
    >
      <option value="">— spécialisation —</option>
      {options.map((s) => (
        <option key={s} value={s}>
          {specLabel('skills', skillId, s)}
        </option>
      ))}
    </select>
  );
}

// ════ 3bis) Signe astral (ADE2 ch.03, optionnel) — Zone A : « Aux dés » + ROUE CÉLESTE ; Zone B : sens + astrologie ════
export function StarZones({ d, setD }: StepProps): StepZones {
  const sign = d.star ? starsTable.find((s) => s.id === d.star) : undefined; // d.star = id STABLE
  // Talent « (Au choix) » octroyé par le signe (ex. Maître artisan) → spec à préciser (réutilise specChoices).
  const grantChoice = sign?.effect?.flatMap((o) => (o.op === 'grantTalent' && isUnresolvedChoice(talentConcrete(o)) ? [talentConcrete(o)] : []))[0];
  const grantOpts = grantChoice ? specOptionsFor(grantChoice) : [];

  const dice = (
    <CreatorDice
      label="Tirer le signe astral (d100)"
      hint="Gardez le tirage : +25 PX (ADE2 ch.03) · Choix libre : +0 PX."
      rolled={!!d.starRoll}
      xp={starXp(d)}
      roll={d.starRollValue}
      onRoll={() => setD(rollDraftStar(d))}
    >
      <p className="hint" style={{ marginTop: 0 }}>
        Signe tiré : <b>{starsTable.find((s) => s.id === d.starRoll)?.label ?? '—'}</b> — gardez-le ou choisissez librement sur la roue.
      </p>
    </CreatorDice>
  );

  // Rail SANS zone « choix » propre (#393 P3, étalon `finale-mock3-signe.png`) : la roue céleste est
  // le TRAVAIL de l'étape (Zone B, large), pas un contrôle annexe du rail — seul l'encrier d100 y reste.
  const choice = null;

  const body = (
    <div className="appear-panel">
      <div className="star-wheel-col">
        <p className="creator-pick-count">La roue céleste — {starsTable.length} signes — Archives de l'Empire II</p>
        <CelestialWheel
          signs={starsTable.map((s) => ({ id: s.id, label: s.label }))}
          selectedId={d.star}
          onSelect={(id) => setD({ ...d, star: id })}
        />
        {sign && (
          <button className="btn small" style={{ marginTop: 8 }} onClick={() => setD({ ...d, star: undefined })}>
            Aucun signe
          </button>
        )}
        {grantChoice && grantOpts.length > 0 && (
          <label style={{ marginTop: 10 }}>
            {splitLabel(grantChoice).name}
            <select
              value={d.specChoices[grantChoice] ?? ''}
              onChange={(e) => {
                const specChoices = { ...d.specChoices };
                if (e.target.value) specChoices[grantChoice] = e.target.value; // spec SEULE, jamais un libellé complet
                else delete specChoices[grantChoice];
                setD({ ...d, specChoices });
              }}
            >
              <option value="">— au choix —</option>
              {grantOpts.map((o) => <option key={o} value={o}>{o}</option>)}
            </select>
          </label>
        )}
      </div>
      <div className="appear-controls">
        <Section title={sign ? sign.label : 'Sous quel signe êtes-vous né ?'}>
          {sign ? (
            <>
              <p className="hint" style={{ margin: '0 0 8px' }}>{[sign.signe, sign.dates, sign.dieux && `Dieu : ${sign.dieux}`].filter(Boolean).join(' · ')}</p>
              {!!sign.effect?.length && (
                <div className="skill-tags" style={{ marginBottom: 10 }}>
                  {sign.effect.map((o, i) => <span key={i} className="tag">{opSummary(o)}</span>)}
                </div>
              )}
              <LoreText md={sign.desc} />
            </>
          ) : (
            <p className="hint">Choisissez ou tirez votre signe astral (ADE2 ch.03) — son sens apparaîtra ici.</p>
          )}
        </Section>
        <Section title="Astrologie (pur roleplay)" right={<button className="btn small" onClick={() => setD(rollDraftAstrology(d))}><Icon id="nav/dice" size="sm" /> Thème astral</button>}>
          {d.ascendant || d.dwellings?.length ? (
            <div className="lore-text">
              {d.ascendant && <p style={{ margin: '0 0 6px' }}><b>Ascendant :</b> {d.ascendant}</p>}
              {d.dwellings?.map((h) => (
                <p key={h.house} style={{ margin: '0 0 4px' }} title={mdToText(HOUSE_BY_ID.get(h.house)?.desc ?? '')}>
                  <b>{HOUSE_BY_ID.get(h.house)?.label ?? h.house} :</b> {h.sign}
                </p>
              ))}
            </div>
          ) : (
            <p className="hint">Ascendant + {celestialHouses.length} demeures célestes — flavor pur (aucun effet de jeu).</p>
          )}
        </Section>
      </div>
    </div>
  );
  // Pas de `title` ici (doublon) : le corps porte déjà son propre titre via `Section`
  // (sign.label ou la question de repli), même patron que CareerZones.
  return { dice, choice, detail: { body } };
}

// ════ 4) Compétences & Talents (LDB 05 l.493-555) — charte « Atelier du scribe » (#393 P4, étalons
//      `finale-mock4/5/6-5{a,b,c}`) : TROIS SOUS-ÉCRANS (`Tabs`, dock d'onglets « a/b/c ») — chacun
//      GABARIT DEUX ZONES (panneau de travail + fiche vivante `CreatorSummary`, MÊME composition que
//      Race/Carrière, #393 P2) : plus de rail séparé pour cette étape, l'encrier de sous-tirage/
//      répartition rejoint l'en-tête du panneau. Mécanique INCHANGÉE (draft.ts) — seule la
//      présentation se restructure en sous-écrans ; la fiche vivante RÉSOUT ses chips roadmap EN
//      DIRECT au fil des trois (`speciesSkillsDone`/`careerSkillsDone`/`talentsDone`), au lieu d'un
//      tout-ou-rien à l'arrivée sur l'étape (#417 suite). Talents d'espèce en TROIS lots dérivés de
//      la donnée (LDB 05 l.510, `draft.ts`) : ACQUIS D'OFFICE (fixes) / DE RACE — UN AU CHOIX
//      (« A ou B ») / TIRÉS AU D100 (figés par le seed dès la race choisie, jamais relancés).
export function SkillsScreen({ d, setD, skillsSub, setSkillsSub }: StepProps): ReactNode {
  // Contrôlé par `CharacterCreator` (pied de page par sous-onglet) quand fourni ; sinon état
  // local (tests qui montent l'écran seul, ex. CharacterCreator.test.tsx).
  const [localSub, setLocalSub] = useState<SkillsSub>('race');
  const sub = skillsSub ?? localSub;
  const setSub = setSkillsSub ?? setLocalSub;
  const sp = draftSpecies(d);
  const career = findCareerById(d.careerId);

  if (!sp || !career) {
    return (
      <div className="creator-skills-screen">
        <div className="creator-skills-shell">
          <div className="creator-skills-main">
            <p className="hint">Choisissez d'abord une race et une carrière.</p>
          </div>
        </div>
      </div>
    );
  }

  const tabs = [
    { key: 'race' as const, label: <>a. Compétences de race{speciesSkillsDone(d) ? ' ✓' : ''}</> },
    { key: 'career' as const, label: <>b. de carrière{careerSkillsDone(d) ? ' ✓' : ''}</> },
    { key: 'talents' as const, label: <>c. Talents{talentsDone(d) ? ' ✓' : ''}</> },
  ];

  return (
    <div className="creator-skills-screen">
      <Tabs tabs={tabs} active={sub} onChange={setSub} label="Sous-étape Compétences & Talents" className="creator-skills-tabnav" />
      <div className="creator-skills-shell">
        <div className="creator-skills-main">
          {sub === 'race' && <SpeciesSkillsPane d={d} setD={setD} sp={sp} />}
          {sub === 'career' && <CareerSkillsPane d={d} setD={setD} />}
          {sub === 'talents' && <TalentsPane d={d} setD={setD} sp={sp} />}
        </div>
        <CreatorSummary d={d} step={stepIds().indexOf('skills')} />
      </div>
    </div>
  );
}

/** Valeurs VIVANTES : caractéristique liée + valeur du héros prévisualisé (talents +5/Augmentations
 *  incluses) — partagé par les trois sous-écrans (annotation `<em class="tag-char">` des rangées). */
function useLiveCharOf(d: CreatorDraft) {
  const liveChars: Characteristics = previewHero(d)?.characteristics ?? draftChars(d);
  return (raw: string): { k: CharKey | null; v: number } => {
    const k = skillCharKey(raw);
    return { k, v: k ? liveChars[k] : 0 };
  };
}

// ── 5a) Compétences de race (LDB 05 l.484) ──
function SpeciesSkillsPane({ d, setD, sp }: StepProps & { sp: SpeciesData }) {
  const charOf = useLiveCharOf(d);
  const done = speciesSkillsDone(d);
  return (
    <div className="detail-frame creator-skills-card">
      <div className="creator-skills-head">
        <div>
          <h3 className="creator-skills-title">Compétences de race</h3>
          <p className="hint creator-skills-sub">Un seul geste — l'héritage du sang</p>
        </div>
        <button
          type="button"
          className={`dicewell${done ? ' done' : ' act emph'}`}
          onClick={() =>
            setD({
              ...d,
              speciesPlus5: sp.skills.slice(0, SPECIES_SKILLS_PLUS5).map((a) => advancementLabel('skills', a)),
              speciesPlus3: sp.skills.slice(SPECIES_SKILLS_PLUS5, SPECIES_SKILLS_PLUS5 + SPECIES_SKILLS_PLUS3).map((a) => advancementLabel('skills', a)),
            })
          }
        >
          <span className="dicewell-copy">
            <span className="dicewell-txt">Répartition par défaut</span>
            <span className="dicewell-sub">l'atelier répartit pour vous — modifiable ensuite</span>
          </span>
        </button>
      </div>
      <p className="hint" style={{ marginTop: 0 }}>
        Votre sang {sp.label} offre 3 Compétences à +5 et 3 à +3, parmi les {sp.skills.length} du registre. L'allocation
        de métier vient à l'écran suivant — les deux se cumulent sur une même Compétence.
      </p>
      <div className="row-flex creator-skill-quota-gauges">
        <NotchGauge
          value={d.speciesPlus5.length}
          max={SPECIES_SKILLS_PLUS5}
          notches={SPECIES_SKILLS_PLUS5}
          format={(v, m) => `${v}/${m} à +5`}
          tone={d.speciesPlus5.length === SPECIES_SKILLS_PLUS5 ? 'ok' : 'neutral'}
        />
        <NotchGauge
          value={d.speciesPlus3.length}
          max={SPECIES_SKILLS_PLUS3}
          notches={SPECIES_SKILLS_PLUS3}
          format={(v, m) => `${v}/${m} à +3`}
          tone={d.speciesPlus3.length === SPECIES_SKILLS_PLUS3 ? 'ok' : 'neutral'}
        />
      </div>
      <div className="skill-row-grid">
        {sp.skills.map((a) => advancementLabel('skills', a)).map((raw) => {
          const { k, v } = charOf(raw);
          const tier = speciesSkillTier(d, raw);
          return (
            <div key={raw} className="skill-row" title={skillTip(raw)}>
              <span className="skill-row-label">
                {raw}
                {k && <em>{CHAR_LABELS[k]} {v}{tier ? ` → ${v + tier}` : ''}</em>}
                {isUnresolvedChoice(raw) && tier > 0 && <SpecSelect d={d} setD={setD} raw={raw} />}
              </span>
              {/* Paliers 0/3/5 quota-gérés (LDB 05 l.484) : mode DISCRET de `QtyStepper` — la valeur
                  cible vient de `speciesSkillStep` (source unique), `null` grise le bouton. */}
              <QtyStepper
                center={<b>{tier}</b>}
                onDec={() => setD(withSpeciesSkillTier(d, raw, speciesSkillStep(d, raw, -1) as 0 | 3 | 5))}
                onInc={() => setD(withSpeciesSkillTier(d, raw, speciesSkillStep(d, raw, 1) as 0 | 3 | 5))}
                decDisabled={speciesSkillStep(d, raw, -1) == null}
                incDisabled={speciesSkillStep(d, raw, 1) == null}
                decLabel={`${raw} : palier inférieur`}
                incLabel={`${raw} : palier supérieur`}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── 5b) Compétences de carrière (LDB 05 l.535) ──
function CareerSkillsPane({ d, setD }: StepProps) {
  const charOf = useLiveCharOf(d);
  const entries = careerSkillEntries(d);
  const total = careerAdvTotal(d);
  const done = careerSkillsDone(d);
  return (
    <div className="detail-frame creator-skills-card">
      <div className="creator-skills-head">
        <div>
          <h3 className="creator-skills-title">Compétences de carrière</h3>
          <p className="hint creator-skills-sub">Un seul geste — l'école du métier</p>
        </div>
        <button type="button" className={`dicewell${done ? ' done' : ' act emph'}`} onClick={() => setD({ ...d, skillAdvances: evenCareerSkillAdvances(d) })}>
          <span className="dicewell-copy">
            <span className="dicewell-txt">+5 sur les huit</span>
            <span className="dicewell-sub">répartition simple, modifiable ensuite</span>
          </span>
        </button>
      </div>
      <p className="hint" style={{ marginTop: 0 }}>
        Votre métier enseigne {CAREER_SKILL_ADVANCES} points, {Math.floor(CAREER_SKILL_ADVANCES / (entries.length || 1))} au plus par Compétence
        d'un coup. Les +5/+3 de race sont acquis et se CUMULENT — la rangée le rappelle (« +5 de race »).
      </p>
      <p className="creator-pick-count">
        De carrière — {total}/{CAREER_SKILL_ADVANCES} points répartis · max {MAX_ADV_PER_SKILL} par Compétence
      </p>
      <NotchGauge
        value={total}
        max={CAREER_SKILL_ADVANCES}
        format={(v, m) => `${m} points · reste ${m - v}`}
        tone={done ? 'ok' : 'neutral'}
      />
      <div className="skill-row-grid">
        {entries.map((raw) => {
          const { k, v } = charOf(raw);
          const adv = d.skillAdvances[raw] ?? 0;
          const raceTier = speciesSkillTier(d, raw);
          return (
            <div key={raw} className="skill-row" title={skillTip(raw)}>
              <span className="skill-row-label">
                {raw}
                {k && <em>{CHAR_LABELS[k]} {v}{adv ? ` → ${v + adv}` : ''}</em>}
                {raceTier > 0 && <em>+{raceTier} de race</em>}
                {isUnresolvedChoice(raw) && adv > 0 && <SpecSelect d={d} setD={setD} raw={raw} />}
              </span>
              <AllocStepper
                value={adv}
                max={Math.min(MAX_ADV_PER_SKILL, adv + (CAREER_SKILL_ADVANCES - total))}
                onChange={(val) => setD({ ...d, skillAdvances: { ...d.skillAdvances, [raw]: val } })}
                label={raw}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── 5c) Talents (LDB 05 l.493-510) — de race « un au choix » ⇄ de carrière « un au choix » ⇄
//      tirés au d100 (figés dès la race choisie, listés ici en lecture — jamais une relance). ──
export function TalentsPane({ d, setD }: StepProps & { sp: SpeciesData }) {
  const probe = probeHero(d, false);
  const fixed = speciesTalentFixedEntries(d);
  const choiceEntries = speciesTalentChoiceEntries(d);
  const drawn = speciesTalentRandomDrawn(d);
  const randomCount = speciesTalentRandomCount(d);
  return (
    <div className="detail-frame creator-skills-card">
      <div className="creator-skills-head">
        <div>
          <h3 className="creator-skills-title">Talents</h3>
          <p className="hint creator-skills-sub">Ce que le sort a tranché</p>
        </div>
      </div>
      <p className="hint" style={{ marginTop: 0 }}>
        Un seul Talent de carrière au Niveau 1 — les trois autres s'achèteront en PX au fil du jeu.
      </p>
      <div className="creator-talents-cols">
        <div>
          <div className="mini-title">De race — un au choix</div>
          {choiceEntries.length === 0 ? (
            <p className="hint">Aucune décision ici — la race ne propose pas de branche « A ou B ».</p>
          ) : (
            <div className="talent-options-grid">
              {choiceEntries.map((entry) => {
                const options = splitTopLevelOu(entry);
                const selected = d.speciesTalentChoices[entry] ?? null;
                return (
                  <div key={entry} className={`talent-option ${selected ? 'selected' : ''}`}>
                    {options.map((opt, i) => (
                      <span key={opt}>
                        {i > 0 && <span className="talent-option-ou">ou</span>}
                        <label className="radio" style={{ display: 'flex', marginBottom: 4 }}>
                          <input
                            type="radio"
                            name={`species-talent-${entry}`}
                            checked={selected === opt}
                            onChange={() => setD({ ...d, speciesTalentChoices: { ...d.speciesTalentChoices, [entry]: opt } })}
                          />
                          <b>{opt}</b>
                        </label>
                      </span>
                    ))}
                    <p className="hint talent-desc">{talentTip(selected ?? options[0])}</p>
                  </div>
                );
              })}
            </div>
          )}
          {randomCount > 0 && (
            <>
              <div className="mini-title" style={{ marginTop: 12 }}>Tirés d'office — d100 — {randomCount} Talent{randomCount > 1 ? 's' : ''} rendu{randomCount > 1 ? 's' : ''}</div>
              <div className="skill-tags">
                {drawn.map((label) => (
                  <EntityChoice key={label} category="talents" entry={label} />
                ))}
              </div>
            </>
          )}
          {fixed.length > 0 && (
            <>
              <div className="mini-title" style={{ marginTop: 12 }}>Acquis d'office</div>
              <div className="skill-tags">
                {fixed.map((label) => (
                  <EntityChoice key={label} category="talents" entry={label} />
                ))}
              </div>
            </>
          )}
        </div>
        <div>
          <div className="mini-title">De carrière — un au choix</div>
          <div className="talent-options-grid">
            {careerTalentOptions(d).map(({ entry, choices, selected, maxed }) => (
              <div key={entry} className={`talent-option ${selected && d.careerTalent === selected ? 'selected' : ''}`}>
                <label className="radio" style={{ flexWrap: 'wrap' }}>
                  <input
                    type="radio"
                    name="career-talent"
                    disabled={!selected || maxed}
                    checked={!!selected && d.careerTalent === selected}
                    onChange={() => selected && setD({ ...d, careerTalent: selected })}
                  />
                  <b>{entry}</b>
                  {choices && (
                    <select
                      value={selected ?? ''}
                      onChange={(e) => {
                        const specChoices = { ...d.specChoices, [entry]: e.target.value };
                        const next = { ...d, specChoices };
                        setD(d.careerTalent && d.careerTalent === selected ? { ...next, careerTalent: e.target.value } : next);
                      }}
                    >
                      <option value="">— choisir —</option>
                      {choices.map((c) => (
                        <option key={c} value={c}>
                          {c}
                        </option>
                      ))}
                    </select>
                  )}
                  {maxed && <em className="hint">Maxi atteint (déjà possédé)</em>}
                  {!maxed && selected && probe.talents.some((t) => talentConcrete(t) === selected) && <em className="hint">déjà possédé via la race → passera ×2</em>}
                </label>
                <p className="hint talent-desc">{talentTip(selected ?? entry)}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
      <PettySpellsSection d={d} setD={setD} />
    </div>
  );
}

/** Sorts de Magie mineure INCLUS au Talent (LDB 10 l.587) : le Talent pris → choisir
 *  exactement BFM sorts, mémorisés de façon permanente à la création. */
export function PettySpellsSection({ d, setD }: StepProps) {
  const quota = pettySpellQuota(d);
  if (!quota) return null;
  const minors = allSpells.filter((s) => s.family === 'mineure');
  const toggle = (label: string) => {
    if (d.pettySpells.includes(label)) setD({ ...d, pettySpells: d.pettySpells.filter((x) => x !== label) });
    else if (d.pettySpells.length < quota) setD({ ...d, pettySpells: [...d.pettySpells, label] });
  };
  return (
    <Section
      title="Sorts de Magie mineure (inclus au Talent)"
      right={<b className={d.pettySpells.length === quota ? 'ok-text' : 'warn-text'}>{d.pettySpells.length}/{quota}</b>}
    >
      <div className="talent-options-grid">
        {minors.map((s) => {
          const picked = d.pettySpells.includes(s.label);
          return (
            <div key={s.label} className={`talent-option ${picked ? 'selected' : ''}`}>
              <label className="radio">
                <input type="checkbox" checked={picked} disabled={!picked && d.pettySpells.length >= quota} onChange={() => toggle(s.label)} />
                <b>{s.label}</b>
                <em className="hint">NI {s.cn ?? 0} · {s.range ? formatSpellRange(s.range) : '—'} · {s.duration ? formatSpellDuration(s.duration) : '—'}</em>
              </label>
              <p className="hint talent-desc">{blurb(s.desc, 220)}</p>
            </div>
          );
        })}
      </div>
    </Section>
  );
}

/** Détail d'un objet d'équipement (trappings.json) par `id` : dégâts / PA / encombrement / qualités. */
function trappingMeta(id: string): string {
  const t = findTrappingById(id);
  if (!t) return '';
  const bits: string[] = [];
  if (t.damage) bits.push(`Dégâts ${damageString(t.damage)}`);
  if (t.pa) bits.push(`${t.pa} PA (${t.loc ?? ''})`);
  if (t.reach && t.type === 'melee') bits.push(`Allonge ${t.reach}`);
  // Portée : « N m » (fixe) / « BF×k m » (jet) ; sinon le modificateur de la munition (« ×½ »).
  if (t.type === 'ranged' || t.type === 'ammunition') { const p = rangeSpecLabel(t.range) ?? ammoRangeModLabel(t.ammoRangeMod); if (p) bits.push(`Portée ${p}`); }
  if (t.enc) bits.push(`Enc. ${t.enc}`);
  if (t.qualities?.length) bits.push(t.qualities.map(qualityRefLabel).join(', '));
  return bits.join(' · ');
}

// ════ 6) Possessions (LDB 05 l.559-585) — charte « Atelier du scribe » (#393 P5, étalon
//      `finale-mock7-possessions.png`) : gabarit DEUX ZONES (panneau + fiche vivante, MÊME composition
//      que Caractéristiques/Compétences) — le panneau porte le statut en tête, puis les bandes « De
//      carrière » / « De classe » (chips d'équipement comptées) / « La bourse » (rappel de la formule +
//      montant, jet figé sans dés à rejouer) / « La classe » (prose RAW verbatim). Mécanique INCHANGÉE
//      (draftWealth/weaponChoice, draft.ts) — la fiche vivante RÉSOUT son chip roadmap « dotations » en
//      arrivant sur cette étape (`CreatorSummary`, `pending.possessions`).
/** Faces INDIVIDUELLES du jet de bourse — même graine/ordre RNG que `draftWealth`
 *  (`d.seed ^ 0x901d`, `rollInitialWealth`) : rejoue le MÊME nombre de `rng.int(1,10)` pour figer
 *  les dés à l'écran (mock7 : faces + total) au lieu du seul total texte (retouche juge vision
 *  #393 P5). Bronze N : 2N d10 ; Argent N : N d10 ; Or (aucun dé, CO=Standing) : []. */
function draftWealthDice(d: CreatorDraft): number[] {
  const status = parseStatus(draftLevel(d)?.status ?? 'Bronze 0');
  if (status.standing <= 0 || status.tier === 'Or') return [];
  const n = status.tier === 'Bronze' ? 2 * status.standing : status.standing;
  const rng = makeRNG(d.seed ^ 0x901d);
  return Array.from({ length: n }, () => d10Face(rng.int(1, 10)));
}

export function TrappingsScreen({ d, setD }: StepProps): ReactNode {
  const level = draftLevel(d);
  const career = findCareerById(d.careerId);
  const klass = findClassById(career?.class);
  const wealth = draftWealth(d);
  const { rolling, landed, trigger, skip } = useRollFrisson(() => setD(rollDraftWealth(d)));
  const careerTrappings = level?.trappings ?? []; // TrappingRef[]
  const weaponChoiceEntry = careerTrappings.some((t) => 'text' in t && t.text === 'Arme (Au choix)');

  if (!level || !career) {
    return (
      <div className="creator-trappings-screen">
        <div className="creator-trappings-shell">
          <div className="creator-trappings-main">
            <p className="hint">Choisissez d'abord une race et une carrière.</p>
          </div>
        </div>
      </div>
    );
  }

  const chip = (ref: import('../../data').TrappingRef, key: number) => {
    const label = trappingRefLabel(ref);
    return <EntityRef key={key} category="trappings" id={'id' in ref ? ref.id : undefined} label={splitLabel(label).name} show={label} />;
  };
  const classItems = klass?.trappings ?? [];
  const careerItems = careerTrappings.filter((t) => !('text' in t && t.text === 'Arme (Au choix)'));

  return (
    <div className="creator-trappings-screen">
      <div className="creator-trappings-shell">
        <div className="detail-frame creator-trappings-main">
          <div className="creator-skills-head">
            <div>
              <h3 className="creator-skills-title">Possessions</h3>
              <p className="hint creator-skills-sub">Ce que le départ vous met dans les mains</p>
            </div>
            <MetalStatus status={level.status} size="chip" />
          </div>
          <p className="hint" style={{ marginTop: 0 }}>
            Le statut <b>{level.status}</b> du {career.label} fixe la bourse de départ ({level.status.startsWith('Bronze') ? '2d10 sous de cuivre' : level.status.startsWith('Argent') ? '1d10 pistoles' : '1 couronne d\'or'} × Standing) et le
            train de vie entre les aventures. Chaque objet reçu s'ouvre sur sa fiche du Codex — encombrement et qualités comprises.
          </p>

          <Band title="De carrière" right={<span className="hint">{level.label} — {careerItems.length} objet{careerItems.length > 1 ? 's' : ''}</span>}>
            <div className="skill-tags">{careerItems.map(chip)}</div>
          </Band>

          <Band title="De classe" right={<span className="hint">{klass?.label ?? '—'} — {classItems.length} objet{classItems.length > 1 ? 's' : ''}</span>}>
            <div className="skill-tags">{classItems.map(chip)}</div>
          </Band>

          {weaponChoiceEntry && (
            <Band title="Arme (au choix)">
              <label>
                Choisissez votre arme de départ
                <select value={d.weaponChoice ?? ''} onChange={(e) => setD({ ...d, weaponChoice: e.target.value || undefined })}>
                  <option value="">— choisir —</option>
                  {WEAPON_CHOICES.map((w) => <option key={w.id} value={w.id}>{w.label}</option>)}
                </select>
              </label>
              {d.weaponChoice && <p className="hint">{trappingMeta(d.weaponChoice)}</p>}
            </Band>
          )}

          <Band
            title="La bourse"
            right={<span className="hint">statut <b>{level.status}</b></span>}
          >
            {rolling || landed ? (
              <DiceRoll scene landed={landed} faces={null} onSkip={skip} />
            ) : !d.wealthRoll ? (
              <button type="button" className="dicewell act emph" onClick={() => trigger()}>
                <span className="dicewell-tray">
                  <span className="rm-die dicewell-die"><DieFace n={null} landed /></span>
                  <span className="rm-die dicewell-die"><DieFace n={null} landed /></span>
                </span>
                <span className="dicewell-copy">
                  <span className="dicewell-txt">Tirer aux dés — la bourse</span>
                  <span className="dicewell-sub">
                    {level.status.startsWith('Bronze') ? '2d10 sous de cuivre' : level.status.startsWith('Argent') ? '1d10 pistoles' : '1 couronne d\'or'} × Standing — jet figé, aucune relance
                  </span>
                </span>
              </button>
            ) : (
              // Faces RÉELLES figées (draftWealthDice, même graine/ordre RNG que draftWealth) + total (mock7).
              <div className="row-flex" style={{ marginTop: 4 }}>
                <span className="dicewell-tray">
                  {draftWealthDice(d).map((n, i) => (
                    <span key={i} className="rm-die dicewell-die"><DieFace n={n} landed /></span>
                  ))}
                </span>
                <p className="creator-purse-line">
                  <Coins money={wealth} /> <span className="hint">— créditée au groupe à l'engagement</span>
                </p>
              </div>
            )}
          </Band>

          <RuleDivider label="La classe" />
          <div className="mini-title">{klass?.label ?? '—'}</div>
          <LoreText md={klass?.desc} />
        </div>
        <CreatorSummary d={d} step={stepIds().indexOf('trappings')} />
      </div>
    </div>
  );
}

/** Champ IDENTITÉ du registre d'état civil (nom/âge/taille/yeux/cheveux) — libellé au-dessus, contrôle
 *  + bouton d'effacement (`ui/undo`, mineur/réversible) en fin de rangée (étalon `finale-mock8-details.png`). */
function IdentityField({ label, value, onChange, onClear, type = 'text' }: {
  label: string;
  value: string | number;
  onChange: (v: string) => void;
  onClear: () => void;
  type?: 'text' | 'number';
}) {
  return (
    <label className="identity-field">
      {label}
      <span className="input-dice">
        <input type={type} value={value} onChange={(e) => onChange(e.target.value)} />
        <button type="button" className="btn small" title={`${label} : effacer`} onClick={onClear}>
          <Icon id="ui/undo" size="sm" />
        </button>
      </span>
    </label>
  );
}

// ════ 7) Détails (LDB 05 l.587-744) — charte « Atelier du scribe » (#393 P5, étalon
//      `finale-mock8-details.png`) : gabarit DEUX ZONES (panneau + fiche vivante) — encrier « Tirer
//      le physique » en tête (même patron `.dicewell` idle/done que Race/Carrière), grille Nom/Sexe/
//      Âge/Taille/Yeux/Cheveux, bande Motivation & Ambitions (`BackgroundFields`), bande Apparence
//      (`AppearancePanel`, personnalisateur INCHANGÉ). Mécanique INCHANGÉE (`rolledDetails`, draft.ts).
export function DetailsScreen({ d, setD }: StepProps): ReactNode {
  const sp = draftSpecies(d);
  if (!sp) {
    return (
      <div className="creator-details-screen">
        <div className="creator-details-shell">
          <div className="creator-details-main">
            <p className="hint">Choisissez d'abord une race.</p>
          </div>
        </div>
      </div>
    );
  }
  const appearance: Appearance = { species: rigSpeciesId(d.speciesId), sex: d.sex, build: d.build, seed: d.appSeed, colors: d.colors, parts: d.parts };
  const physiqueRolled = !!(d.age || d.height || d.eyes || d.hair);
  const { rolling, landed, trigger, skip } = useRollFrisson(() => {
    const r = rolledDetails(d);
    setD({ ...d, age: r.age, height: r.height, eyes: r.eyes, hair: r.hair });
  });

  return (
    <div className="creator-details-screen">
      <div className="creator-details-shell">
        <div className="detail-frame creator-details-main">
          <h3 className="creator-skills-title">Détails</h3>
          <p className="hint creator-skills-sub">Le registre d'état civil du héros</p>
          <p className="hint" style={{ marginTop: 0 }}>
            Le nom peut se tirer d'un générateur ou s'écrire à la plume ; âge, taille, yeux et cheveux se tirent aux dés,
            trait par trait — ou tous d'un coup. Motivation et ambitions sont libres — elles guident le jeu de rôle, pas les
            règles ; la Motivation est la donnée qui recharge la Détermination en jeu.
          </p>

          <div className="row-flex creator-details-toolbar">
            <button type="button" className="btn small" onClick={() => { const n = generateName(sp.refChar, d.sex, makeRNG(Math.floor(Math.random() * 1e9))); if (n) setD({ ...d, name: n }); }}>
              <Icon id="nav/dice" size="sm" /> Tirer le nom
            </button>
            {rolling || landed ? (
              <DiceRoll scene landed={landed} faces={null} onSkip={skip} />
            ) : (
              <button type="button" className={`dicewell${physiqueRolled ? ' done' : ' act emph'}`} onClick={() => trigger()}>
                <span className="dicewell-copy">
                  <span className="dicewell-txt">{physiqueRolled ? 'Aux dés — tout tiré' : 'Aux dés — tout d\'un coup'}</span>
                  <span className="dicewell-sub">âge, taille, yeux, cheveux — trait par trait, modifiable ensuite</span>
                </span>
              </button>
            )}
          </div>

          <div className="identity-grid">
            <label className="identity-field">
              Nom
              <input value={d.name} onChange={(e) => setD({ ...d, name: e.target.value })} placeholder="Nom du personnage" />
            </label>
            <label className="identity-field">
              Sexe
              <button type="button" className="btn small identity-sex-toggle" onClick={() => setD({ ...d, sex: d.sex === 'M' ? 'F' : 'M' })}>
                <Icon id="ui/branch" size="sm" /> {d.sex === 'F' ? 'Féminin' : 'Masculin'}
              </button>
            </label>
            <IdentityField label="Âge" type="number" value={d.age ?? ''} onChange={(v) => setD({ ...d, age: Number(v) || undefined })} onClear={() => setD({ ...d, age: undefined })} />
            <IdentityField label="Taille (cm)" type="number" value={d.height ?? ''} onChange={(v) => setD({ ...d, height: Number(v) || undefined })} onClear={() => setD({ ...d, height: undefined })} />
            <IdentityField label="Yeux" value={d.eyes ?? ''} onChange={(v) => setD({ ...d, eyes: v })} onClear={() => setD({ ...d, eyes: undefined })} />
            <IdentityField label="Cheveux" value={d.hair ?? ''} onChange={(v) => setD({ ...d, hair: v })} onClear={() => setD({ ...d, hair: undefined })} />
          </div>

          <Band title="Motivation & Ambitions" right={<span className="hint">recharge la Détermination · guide le rôle</span>}>
            <BackgroundFields
              values={{ motivation: d.motivation, ambitionShort: d.ambitionShort, ambitionLong: d.ambitionLong }}
              onChange={(patch) => setD({ ...d, ...patch })}
            />
          </Band>

          <Band title="Apparence" right={<span className="hint">la silhouette prend les teintes</span>}>
            <AppearancePanel
              value={appearance}
              equip={{ weapons: [], armour: [] }}
              career={d.careerId}
              onChange={(a) => setD({ ...d, sex: a.sex, build: a.build, appSeed: a.seed ?? d.appSeed, colors: a.colors, parts: a.parts })}
            />
          </Band>
        </div>
        <CreatorSummary d={d} step={stepIds().indexOf('details')} />
      </div>
    </div>
  );
}

/** Top-3 des Compétences par valeur de Test effective (Caractéristique + avances, `skillBaseValue`) —
 *  « Les jets qui le définissent » (mock9) : les épreuves où le héros excelle le plus. Composé de
 *  chips CodexRef réels (jamais un libellé de flavor inventé) + la valeur de Test. */
function topSkillTests(hero: Combatant, max = 3): { skillId: string; spec?: string; label: string; value: number }[] {
  return [...hero.skills]
    .filter((s) => s.advances > 0)
    .map((s) => ({ skillId: s.skillId, spec: s.spec, label: skillInstanceLabel(s), value: skillBaseValue(hero, s.skillId, s.spec) }))
    .sort((a, b) => b.value - a.value)
    .slice(0, max);
}

// ════ 8) Présentation (#393 P5, arbitrage README maquettes — renommage « Récapitulatif » →
//      « Présentation » : le personnage se PRÉSENTE) — étalon `finale-mock9-presentation.png` : mise
//      en scène finale DÉDIÉE (plus le gabarit 3 zones rail/détail/fiche partagé) — TROIS colonnes :
//      registre (Profil/dérivées/Identité/Motivation/Évolution) ⇄ grande figurine + nom ⇄ Compétences/
//      Talents/Possessions/« Les jets qui le définissent ». Aucune mécanique nouvelle — pure mise en
//      page du héros déjà construit (`previewHero`).
export function PresentationScreen({ d }: StepProps): ReactNode {
  const hero = previewHero(d);
  const sp = findSpeciesById(d.speciesId);
  const career = findCareerById(d.careerId);
  const level = draftLevel(d);
  const speciesLabel = sp?.label ?? d.speciesId;
  const careerLabel = career?.label ?? d.careerId;
  const sign = d.star ? starsTable.find((s) => s.id === d.star) : undefined;
  const levels = levelsForCareer(d.careerId);

  if (!hero) {
    return (
      <div className="creator-presentation-screen">
        <p className="hint">Complétez les étapes précédentes pour découvrir la présentation de votre héros.</p>
      </div>
    );
  }

  const jets = topSkillTests(hero);

  return (
    <div className="creator-presentation-screen">
      <div className="presentation-col presentation-left">
        <div className="mini-title">Profil</div>
        <CharStatsGrid size="sm" value={(k) => hero.characteristics[k]} />
        <div className="mini-title">Valeurs dérivées</div>
        <div className="creator-derived">
          <span><Icon id="resource/wounds" size="sm" /> Blessures <b>{hero.wounds.max}</b></span>
          <span><Icon id="resource/movement" size="sm" /> Mouvement <b>{hero.movement}</b></span>
          <span><Icon id="resource/fate" size="sm" /> Destin <b>{hero.fate ?? '—'}</b> · Chance <b>{hero.fortune ?? '—'}</b></span>
          <span><Icon id="resource/resilience" size="sm" /> Résilience <b>{hero.resilience ?? '—'}</b> · Dét. <b>{hero.resolve ?? '—'}</b></span>
          <span><Icon id="resource/gold-purse" size="sm" /> Bourse <b><Coins money={draftWealth(d)} /></b></span>
          <span>PX création <b>+{xpTotal(d)}</b></span>
        </div>
        <div className="mini-title">Identité</div>
        <div className="skill-tags">
          {sign && <CodexRef category="stars" id={sign.id} label={sign.label}><span className="chip">{sign.label}</span></CodexRef>}
          <span className="chip">{d.sex === 'F' ? 'Féminin' : 'Masculin'}</span>
          {hero.details?.age != null && <span className="chip">{hero.details.age} ans</span>}
          {hero.details?.height != null && <span className="chip">{hero.details.height} cm</span>}
          {hero.details?.eyes && <span className="chip">Yeux {hero.details.eyes}</span>}
          {hero.details?.hair && <span className="chip">Cheveux {hero.details.hair}</span>}
        </div>
        {(d.motivation || d.ambitionShort || d.ambitionLong) && (
          <>
            <div className="mini-title">Motivation &amp; Ambitions</div>
            <div className="skill-tags">
              {d.motivation && <span className="chip">Motivation — {d.motivation}</span>}
              {d.ambitionShort && <span className="chip">Court terme — {d.ambitionShort}</span>}
              {d.ambitionLong && <span className="chip">Long terme — {d.ambitionLong}</span>}
            </div>
          </>
        )}
      </div>

      <div className="presentation-col presentation-center">
        <div className="presentation-fig">
          <CharacterPreview hero={hero} view="front" size="fill" ambiance="spotlight" />
        </div>
        <h2 className="presentation-name">{hero.name}</h2>
        <p className="presentation-sub">
          <CodexRef category="races" id={d.speciesId} label={speciesLabel}>{speciesLabel}</CodexRef> ({displayLabelForSex(d.sex, careerLabel, career?.labelF)}) · {level?.status}
        </p>
        <div className="row-flex">
          {sign && <span className="chip">Signe <CodexRef category="stars" id={sign.id} label={sign.label}>{sign.label}</CodexRef></span>}
          <span className="chip">PX création <b>+{xpTotal(d)}</b></span>
        </div>
      </div>

      <div className="presentation-col presentation-right">
        <div className="mini-title">Compétences formées</div>
        <div className="skill-tags">
          {hero.skills.filter((s) => s.advances > 0).map((s) => <SkillChip key={`${s.skillId}|${s.spec ?? ''}`} skill={s} />)}
        </div>
        <div className="mini-title">Talents</div>
        <div className="skill-tags">
          {hero.talents.map((t) => <TalentChip key={`${t.talentId}|${t.spec ?? ''}`} talent={t} />)}
        </div>
        <div className="mini-title">Possessions</div>
        <div className="skill-tags">
          {(hero.items ?? []).map((it) => (
            <EntityRef key={it.uid} category="trappings" id={it.trappingId} label={it.name} show={`${it.name}${it.qty ? ` ×${it.qty}` : ''}`} />
          ))}
        </div>
        {jets.length > 0 && (
          <>
            <div className="mini-title">Les jets qui le définissent</div>
            <div className="skill-tags">
              {jets.map((j) => (
                <EntityRef key={`${j.skillId}|${j.spec ?? ''}`} category="skills" id={j.skillId} label={j.label} show={`${j.label} ${j.value}`} />
              ))}
            </div>
          </>
        )}
      </div>

      {/* Chemin d'évolution en rangée PLEINE LARGEUR sous les 3 colonnes (`grid-column: 1/-1`, seule
          couture propre à ce spanning — `.presentation-col` réutilisée pour la mise en page verticale) :
          `CareerPath` exige la largeur de ses 4 médaillons (2 lignes de nom, jamais d'ellipse), que la
          seule colonne registre ne peut jamais lui donner (retouche juge vision #393 P5, médaillons
          écrasés « Pamphl étaire »/« Bronz »). */}
      {levels.length > 0 && (
        <div className="presentation-col" style={{ gridColumn: '1 / -1' }}>
          <div className="mini-title">Évolution — {career?.class ? findClassById(career.class)?.label ?? '' : ''}</div>
          <CareerPath levels={levels} currentLevel={1} selected={1} />
        </div>
      )}
    </div>
  );
}
