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
import { useMemo, useState, type ReactNode } from 'react';
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
  findTalentById,
  specLabel,
  SpeciesData,
  CareerData,
} from '../../data';
import { CHAR_KEYS, CharKey, CHAR_LABELS, Characteristics } from '../../engine/types';
import { rule } from '../../engine/policy';
import { damageString } from '../../engine/items';
import { rangeSpecLabel, ammoRangeModLabel } from '../weaponStats';
import { formatSpellRange, formatSpellDuration } from '../../engine/spellRangeFormat';
import { Coins } from '../Coins';
import { makeRNG } from '../../engine/dice';
import { generateName } from '../../engine/names';
import { CharacterPreview } from '../CharacterPreview';
import { Icon } from '../Icon';
import { OptionChooser } from '../OptionChooser';
import { RuleDivider } from '../Ornaments';
import { AppearancePanel } from '../AppearancePanel';
import { BackgroundFields } from '../BackgroundFields';
import { CodexRef } from '../compendium/CodexRef';
import { Prose, mdToText } from '../Prose';
import { CodexSections } from '../compendium/CodexEntry';
import { EntityRef, EntityChoice, SkillChip, TalentChip } from '../EntityChip';
import { raceCharSection, raceSkillSection, raceTalentSection, type CodexSection } from '../compendium/registry';
import { opSummary } from '../editor/GameOpEditor';
import type { Appearance } from '../../gameIso/rig/appearance';
import { previewHero } from './CreatorSummary';
import { CreatorStepFrame, Section, Stepper, type StepZones } from './CreatorStepFrame';
import { CreatorDice } from './CreatorDice';
import { useRollFrisson } from '../useRollFrisson';
import { DiceRoll } from '../DiceRoll';
import { d10PairFaces } from '../Dice';
import { FacetedPickGrid } from './FacetedPickGrid';
import { CelestialWheel } from './CelestialWheel';
import { MasterDetail } from '../MasterDetail';
import { GroupedPickGrid, type PickGridSection } from '../GroupedPickGrid';
import { DetailFrame } from '../DetailFrame';
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
  speciesXp,
  careerXp,
  charsXp,
  charRolls,
  charRollPairs,
  draftChars,
  resolvedSpeciesTalents,
  careerCharKeys,
  careerSkillEntries,
  careerAdvTotal,
  evenCareerSkillAdvances,
  careerTalentOptions,
  specOptionsFor,
  pettySpellQuota,
  draftWealth,
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
  CAREER_SKILL_ADVANCES,
  MAX_ADV_PER_SKILL,
  CAREER_CHAR_ADVANCES,
  buildHero,
  draftFromHero,
  probeHero,
  isUnresolvedChoice,
  splitLabel,
  concreteLabel,
  splitTopLevelOu,
} from './draft';
import { wildcardSpecs } from '../../engine/careerSlots';

/** Métadonnées d'étape : libellé FR + fabrique de zones (rail/main) OU écran de plein rendu
 *  (`screen`, gabarit propre — étapes transposées à la charte « Atelier du scribe », #393). SOURCE
 *  UNIQUE du rendu, indexée par `StepId` stable — l'ordre ET la présence des étapes viennent de
 *  `stepIds()` (draft.ts, qui insère « Signe astral » selon la règle optionnelle ADE2), jamais
 *  d'un index positionnel codé. */
const STEP_META: Record<StepId, { label: string; zone?: (p: StepProps) => StepZones; screen?: (p: StepProps) => ReactNode }> = {
  species: { label: 'Race', screen: SpeciesRaceScreen },
  career: { label: 'Carrière', zone: CareerZones },
  chars: { label: 'Caractéristiques', zone: CharZones },
  star: { label: 'Signe astral', zone: StarZones },
  skills: { label: 'Compétences & Talents', zone: SkillZones },
  trappings: { label: 'Possessions', zone: TrappingZones },
  details: { label: 'Détails', zone: DetailZones },
  recap: { label: 'Récapitulatif', zone: ({ d }) => RecapZones({ d }) },
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
const PICK_APPEARANCES = new Map<string, Appearance>();
function pickAppearance(speciesId: string, sex: 'M' | 'F'): Appearance {
  const key = `${speciesId}|${sex}`;
  let a = PICK_APPEARANCES.get(key);
  if (!a) {
    a = { species: rigSpeciesId(speciesId), sex, build: 0.5, seed: 7 };
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
  const stepProps: StepProps = { d, setD, charReroll };

  // Une réf Codex cliquée ouvre la fiche en MODALE par-dessus l'assistant (cf. CodexOverlay) : le
  // brouillon reste intact (plus de changement d'écran qui le réinitialisait).
  return (
    <div className="screen creator">
      <header className="bar">
        <button className="btn small" onClick={closeCreator}>
          ← Groupe
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

      {meta.screen ? meta.screen(stepProps) : <CreatorStepFrame d={d} step={step} zones={meta.zone!(stepProps)} />}

      <footer className="bar">
        <button className="btn" disabled={step === 0} onClick={() => setStep(step - 1)}>
          ← Précédent
        </button>
        <span className={`hint wizard-hint${err ? ' warn-text' : ''}`}>
          {err ?? ''}
        </span>
        {step < ids.length - 1 ? (
          <button className="btn btn-primary" disabled={!canNext} onClick={() => setStep(step + 1)}>
            Suivant →
          </button>
        ) : (
          <button className="btn btn-primary" disabled={(!editing && party.length >= 4) || !canNext} onClick={create}>
            {editing ? 'Enregistrer les modifications' : "Créer l'aventurier"}
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
};

/** Rendu Markdown des textes de données (descriptions — verbatim de la source, via la primitive Prose). */
function LoreText({ md }: { md: string | null | undefined }) {
  if (!md?.trim()) return null;
  return <div className="lore-text"><Prose md={md} /></div>;
}

// ════ 1) Race (LDB 04 l.84-90) — charte « Atelier du scribe » (#393 P1) : gabarit DEUX ZONES
//      (compose `MasterDetail`) — liste (recherche + « Aux dés » + `GroupedPickGrid` de `FigTile`
//      par famille) ⇄ détail (`DetailFrame` de l'élue). Pas de fiche vivante à cette étape
//      (arbitrage 2026-07-14) : mort du call-site Race de `FacetedPickGrid` — Carrière (#393 P2)
//      transpose son propre call-site séparément, `FacetedPickGrid` reste son composant jusque-là.
export function SpeciesRaceScreen({ d, setD }: StepProps): ReactNode {
  const [search, setSearch] = useState('');
  const sp = draftSpecies(d);

  // Groupes par race (`SpeciesData.family` — donnée, plus de regex sur le libellé),
  // les races du Livre de base d'abord — l'ordre des familles suit les données.
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

  const matchedIds = new Set(
    filterByLabel(
      families.flatMap((f) => f.list),
      (s) => s.variant ?? s.label,
      search,
    ).map((s) => s.id),
  );
  const sections: PickGridSection[] = families
    .map((f) => ({
      id: f.family,
      label: f.family,
      items: f.list
        .filter((s) => matchedIds.has(s.id))
        .map((s) => ({
          id: s.id,
          label: s.variant ?? s.label,
          sub: `M ${s.movement} · Destin ${s.fate.fate}`,
          preview: { appearance: pickAppearance(s.id, d.sex) },
        })),
    }))
    .filter((f) => f.items.length > 0);

  const dice = (
    <CreatorDice
      label="Tirer la race (d100)"
      hint="Gardez une race de la borne tirée : +20 PX (LDB 04) · Choix libre : +0 PX."
      rolled={!!d.speciesRoll}
      xp={speciesXp(d)}
      onRoll={() => setD(rollDraftSpecies(d))}
      roll={d.speciesRoll?.roll}
    >
      <p className="hint" style={{ marginTop: 0 }}>
        Jet : <b>{d.speciesRoll?.roll}</b>
        {(d.speciesRoll?.ids.length ?? 0) > 1 && ' — choisissez librement parmi les races de cette borne (le bonus est conservé)'}
      </p>
      <OptionChooser
        layout="grid"
        options={(d.speciesRoll?.ids ?? []).map((id) => ({
          key: id,
          label: `${findSpeciesById(id)?.label ?? id} (+20 PX)`,
          primary: d.speciesId === id,
          onSelect: () => setD(withSpecies(d, id)),
        }))}
      />
    </CreatorDice>
  );

  const list = (
    <>
      <SearchFilterField value={search} onChange={setSearch} icon placeholder="Rechercher une race…" />
      {dice}
      <GroupedPickGrid sections={sections} selectedId={d.speciesId || undefined} onSelect={(id) => setD(withSpecies(d, id))} label="Choix de la race" />
    </>
  );

  const detail = !sp ? (
    <p className="hint">
      Sélectionnez une race dans la liste, ou tirez-la aux dés (LDB 04 l.84-90). Le détail se remplira au fil de vos choix.
    </p>
  ) : (
    <DetailFrame
      name={<CodexRef category="races" id={sp.id} label={sp.label}>{sp.variant ?? sp.label}</CodexRef>}
      meta={
        <>
          <span className="stat-chip"><span className="sc-label">Mouvement</span><span className="sc-value">{sp.movement}</span></span>
          <span className="stat-chip"><span className="sc-label">Destin</span><span className="sc-value">{sp.fate.fate}</span></span>
          <span className="stat-chip"><span className="sc-label">Résilience</span><span className="sc-value">{sp.fate.resilience}</span></span>
          <span className="stat-chip"><span className="sc-label">À répartir</span><span className="sc-value">+{sp.fate.extra}</span></span>
          {sp.small && (
            <span className="stat-chip" title="Talent Petit : Blessures calculées sans le Bonus de Force">
              <span className="sc-label">Taille</span><span className="sc-value">Petite</span>
            </span>
          )}
        </>
      }
      // Caractéristiques / Compétences / Talents : MÊMES sections que le Codex (source unique
      // `raceCharSection`/`raceSkillSection`/`raceTalentSection`) → rendu identique des deux côtés,
      // « ou » en chips SÉPARÉES codex-liées (arbitrage 2026-07-14, `ChoiceChips` via `CodexSections`).
      sections={<CodexSections sections={[raceCharSection(sp), raceSkillSection(sp), raceTalentSection(sp)].filter((s): s is CodexSection => !!s)} />}
      prose={sp.desc}
      proseSelfLabel={sp.label}
      proseSelfCategory="races"
    />
  );

  return <MasterDetail className="creator-race-shell" listLabel="Choix de la race" list={list} detail={detail} />;
}

// ════ 2) Carrière (LDB 05 l.186-365) — Zone A : classes + liste + « Aux dés » ; Zone B : plan complet ════
export function CareerZones({ d, setD }: StepProps): StepZones {
  const sp = draftSpecies(d);
  const accessible = sp ? careersForSpecies(sp.refCareer, d.ignoreRestrictions) : [];
  const career = findCareerById(d.careerId);
  const levels = levelsForCareer(d.careerId);
  const lvl1 = levels.find((l) => l.level === 1);

  const dice = (
    <CreatorDice
      label="Tirer la carrière (d100)"
      hint="1ᵉʳ jet accepté : +50 PX · choix parmi 3 jets : +25 PX · choix libre / relances : +0 PX (LDB 05)."
      rolled={d.careerRolls.length > 0}
      xp={careerXp(d)}
      onRoll={() => setD(rollDraftCareer(d))}
      roll={d.careerRolls[d.careerRolls.length - 1]?.roll}
    >
      <div className="talent-choices">
        {d.careerRolls.map((r, i) => (
          <div key={`roll-${i}`} style={{ marginBottom: 4 }}>
            <div className="mini-title">
              Jet {i + 1} : {r.roll}
              {r.ids.length > 1 && <em className="hint"> — choisissez parmi les carrières de cette borne</em>}
            </div>
            {r.ids.map((id) => {
              const rc = findCareerById(id);
              return (
                <label className="radio" key={`${id}-${i}`}>
                  <input type="radio" name="career-roll" checked={d.careerId === id} onChange={() => setD(withCareer(d, id))} />
                  <b>{rc?.label}</b> ({findClassById(rc?.class)?.label})
                </label>
              );
            })}
          </div>
        ))}
      </div>
      {d.careerRolls.length === 1 && (
        <button className="btn small" style={{ marginTop: 8 }} onClick={() => setD(rollDraftCareer(d))}>
          <Icon id="nav/dice" size="sm" /> Pas convaincu : 2 jets de plus (choix parmi 3, +25 PX)
        </button>
      )}
      {d.careerRolls.length >= 3 && (
        <button className="btn small" style={{ marginTop: 8 }} onClick={() => setD(rollDraftCareer(d))}>
          <Icon id="nav/dice" size="sm" /> Continuer à relancer (0 PX)
        </button>
      )}
    </CreatorDice>
  );

  const choice = (
    <Section title={`Carrières (${accessible.length} accessibles)`}>
      <div className="row-flex" style={{ marginBottom: 8 }}>
        <label className="radio">
          <input type="checkbox" checked={d.ignoreRestrictions} onChange={(e) => setD({ ...d, ignoreRestrictions: e.target.checked })} />
          Ignorer les restrictions de race
        </label>
        {/* MDG 09 l.9 : choix AVANT le jet — basculer réinitialise les jets (même d100, autre table). */}
        {coastalSwapAvailable(d) && (
          <label className="radio">
            <input type="checkbox" checked={d.coastalSwap} onChange={(e) => setD(withCoastalSwap(d, e.target.checked))} />
            Côtiers à la place des Riverains
          </label>
        )}
      </div>
      <FacetedPickGrid
        label="Choix de la carrière"
        searchable
        searchPlaceholder="Rechercher une carrière…"
        groups={classes
          .filter((cl) => accessible.some((c) => c.class === cl.id))
          .map((cl) => ({ id: cl.id, label: cl.label }))}
        cards={accessible.map((c: CareerData) => ({
          id: c.id,
          group: c.class,
          label: c.label,
          title: c.label,
        }))}
        selectedId={d.careerId || undefined}
        onSelect={(id) => setD(withCareer(d, id))}
      />
    </Section>
  );

  if (!career || !lvl1) {
    return {
      dice,
      choice,
      detail: {
        title: 'Choisissez votre carrière',
        body: <p className="hint">Sélectionnez une carrière dans la liste, ou tirez-la aux dés (LDB 05 l.186-365).</p>,
      },
    };
  }

  const body = (
    <>
      <div className="main-head">
        <CharacterPreview appearance={pickAppearance(sp?.id ?? d.speciesId, d.sex)} career={d.careerId} size="md" ambiance="panel" />
        <div>
          <h2>
            <CodexRef category="careers" id={career.id} label={career.label ?? d.careerId}>{careerLabelFor({ career: d.careerId, appearance: { sex: d.sex } })}</CodexRef>{' '}
            {career.class && (
              <span className="hint">(<CodexRef category="classes" id={career.class} label={findClassById(career.class)?.label ?? career.class}>{findClassById(career.class)?.label ?? career.class}</CodexRef>)</span>
            )}
          </h2>
          <p className="hint">{blurb(career.desc, 460)}</p>
        </div>
      </div>
      <Section title="Évolution de carrière">
        <div className="career-path">
          {levels.map((l) => (
            <span key={l.level} className={`path-node ${l.level === 1 ? 'current' : ''}`} title={`Compétences : ${l.skills.map((a) => advancementLabel('skills', a)).join(', ')}\nTalents : ${l.talents.map((a) => advancementLabel('talents', a)).join(', ')}`}>
              <b>{l.level}.</b> {l.label}
              <em>{l.status}</em>
            </span>
          ))}
        </div>
      </Section>
      <Section title="Caractéristiques de carrière">
        <div className="skill-tags">
          {lvl1.characteristics.map((c) => (
            <EntityRef key={c} category="characteristics" id={c} label={c} />
          ))}
        </div>
      </Section>
      <Section title="Compétences du Niveau 1">
        <div className="skill-tags">
          {lvl1.skills.map((a) => advancementLabel('skills', a)).map((s) => (
            <EntityChoice key={s} category="skills" entry={s} />
          ))}
        </div>
      </Section>
      <Section title="Talents du Niveau 1">
        <div className="skill-tags">
          {lvl1.talents.map((a) => advancementLabel('talents', a)).map((t) => (
            <EntityChoice key={t} category="talents" entry={t} />
          ))}
        </div>
      </Section>
      <Section title="Possessions & Statut">
        <p className="hint" style={{ margin: 0 }}>
          {lvl1.trappings.map(trappingRefLabel).join(', ') || '—'} · Statut <b>{lvl1.status}</b>
        </p>
      </Section>
    </>
  );
  return {
    dice,
    choice,
    detail: { seal: d.careerRolls[0] ? { label: 'd100', roll: d.careerRolls[0].roll } : undefined, body },
  };
}

// ════ 3) Caractéristiques (LDB 05 l.370-491) — Zone A : « Aux dés » (méthode) + répartitions ; Zone B : grille (ÉDITION) ════
export function CharZones({ d, setD, charReroll }: StepProps): StepZones {
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
    return {
      choice: <p className="hint">Choisissez d'abord une race pour répartir vos Caractéristiques.</p>,
      detail: { title: 'Caractéristiques', body: <p className="hint">La grille apparaîtra une fois votre race choisie.</p> },
    };
  }

  const dice = (
    <CreatorDice rolled xp={charsXp(d)} hint="Garder le tirage 2d10 : +50 PX · Réassigner les dix jets : +25 PX · 100 Points : +0 PX (LDB 05).">
      <OptionChooser
        layout="grid"
        options={[
          { key: 'rolled', label: `Garder le tirage 2d10 ${d.charRerolls === 0 ? '(+50 PX)' : '(+0 PX)'}`, mode: 'rolled' as const },
          { key: 'reassigned', label: `Réassigner les dix jets ${d.charRerolls === 0 ? '(+25 PX)' : '(+0 PX)'}`, mode: 'reassigned' as const },
          { key: 'pointBuy', label: 'Répartir 100 Points (4-18, +0 PX)', mode: 'pointBuy' as const },
        ].map(({ key, label, mode }) => ({ key, label, primary: d.charMode === mode, onSelect: () => setD({ ...d, charMode: mode }) }))}
      />
      {d.charMode !== 'pointBuy' && (
        <button className="btn small" style={{ marginTop: 10 }} onClick={() => reroll.trigger()}>
          <Icon id="nav/dice" size="sm" /> Relancer les dix jets (bonus perdus)
        </button>
      )}
    </CreatorDice>
  );

  const choice = (
    <>
      <Section
        title="Augmentations gratuites"
        right={<b className={allocTotal === CAREER_CHAR_ADVANCES ? 'ok-text' : 'warn-text'}>{allocTotal}/{CAREER_CHAR_ADVANCES}</b>}
      >
        <p className="hint" style={{ marginTop: 0 }}>
          À répartir sur les Caractéristiques de votre carrière.
        </p>
        {careerKeys.map((k) => (
          <div key={k} className="rail-line">
            <span><CodexRef category="characteristics" id={k} label={CHAR_LABELS[k]}>{CHAR_LABELS[k]}</CodexRef></span>
            <Stepper
              value={d.charAdvancesAlloc[k] ?? 0}
              max={Math.min(CAREER_CHAR_ADVANCES, (d.charAdvancesAlloc[k] ?? 0) + (CAREER_CHAR_ADVANCES - allocTotal))}
              onChange={(v) => setD({ ...d, charAdvancesAlloc: { ...d.charAdvancesAlloc, [k]: v } })}
            />
          </div>
        ))}
      </Section>
      <Section title="Destin & Résilience" right={<b className={splitTotal === sp.fate.extra ? 'ok-text' : 'warn-text'}>{splitTotal}/{sp.fate.extra}</b>}>
        <p className="hint" style={{ marginTop: 0 }}>
          <Icon id="resource/fate" size="sm" /> Destin : survie & Chance. <Icon id="resource/resilience" size="sm" /> Résilience :
          Détermination (votre Motivation la recharge).
        </p>
        <div className="rail-line">
          <span><Icon id="resource/fate" size="sm" /> Destin (base {sp.fate.fate})</span>
          <Stepper
            value={d.fateSplit.fate}
            max={Math.min(sp.fate.extra, d.fateSplit.fate + (sp.fate.extra - splitTotal))}
            onChange={(v) => setD({ ...d, fateSplit: { ...d.fateSplit, fate: v } })}
          />
        </div>
        <div className="rail-line">
          <span><Icon id="resource/resilience" size="sm" /> Résilience (base {sp.fate.resilience})</span>
          <Stepper
            value={d.fateSplit.resilience}
            max={Math.min(sp.fate.extra, d.fateSplit.resilience + (sp.fate.extra - splitTotal))}
            onChange={(v) => setD({ ...d, fateSplit: { ...d.fateSplit, resilience: v } })}
          />
        </div>
      </Section>
    </>
  );

  const body = (
    <>
      <Section
        title="Caractéristiques"
        right={d.charMode === 'pointBuy' ? <b className={pbTotal === 100 ? 'ok-text' : 'warn-text'}>Points : {pbTotal}/100</b> : undefined}
      >
        <p className="hint" style={{ marginTop: 0 }}>
          Vous réglez ici la valeur d'ÉDITION (base d'espèce + tirage/allocation) ; la fiche vivante en montre
          le résultat. Les Caractéristiques <span className="tag char">carrière</span> progressent au coût normal
          en PX et comptent pour la complétion du Niveau ; l'Initiative départage l'ordre du combat.
        </p>
        <div className="char-alloc-grid">
          {CHAR_KEYS.map((k, i) => (
            <div key={k} className="char-alloc">
              <CodexRef category="characteristics" id={k} label={CHAR_LABELS[k]} className="char-key">{CHAR_ABR[k]}</CodexRef>
              <span className="char-name">
                {CHAR_LABELS[k]}
                {careerKeys.includes(k) && <span className="tag char">carrière</span>}
              </span>
              <em>base {sp.baseChar[k] ?? 20}</em>
              {d.charMode === 'rolled' && (reroll.rolling || reroll.landed) ? (
                <span className="char-roll">
                  <DiceRoll scene={false} landed={reroll.landed} faces={reroll.landed ? d10PairFaces(pairs[i]) : null} onSkip={reroll.skip} />
                </span>
              ) : d.charMode === 'rolled' ? (
                <span className="char-roll">+{rolls[i]}</span>
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
                <Stepper value={d.pointBuy[k]} min={4} max={18} onChange={(v) => setD({ ...d, pointBuy: { ...d.pointBuy, [k]: v } })} />
              )}
              <b className="char-total">{chars[k]}</b>
            </div>
          ))}
        </div>
      </Section>
    </>
  );
  return { dice, choice, detail: { title: 'Caractéristiques', body } };
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

  const choice = (
    <Section title="Roue céleste">
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
    </Section>
  );

  const body = (
    <>
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
    </>
  );
  // Pas de `title` ici (doublon) : le corps porte déjà son propre titre via `Section`
  // (sign.label ou la question de repli), même patron que CareerZones.
  return { dice, choice, detail: { body } };
}

// ════ 4) Compétences & Talents (LDB 05 l.493-555) — Zone A : espèce ; Zone B : carrière ════
export function SkillZones({ d, setD }: StepProps): StepZones {
  const sp = draftSpecies(d);
  const entries = careerSkillEntries(d);
  const total = careerAdvTotal(d);
  const resolved = resolvedSpeciesTalents(d);
  const probe = probeHero(d, false);
  // Valeurs vivantes : caractéristiques du héros prévisualisé (talents +5 et Augmentations incluses).
  const liveChars: Characteristics = previewHero(d)?.characteristics ?? draftChars(d);
  const charOf = (raw: string): { k: CharKey | null; v: number } => {
    const k = skillCharKey(raw);
    return { k, v: k ? liveChars[k] : 0 };
  };

  if (!sp) {
    return {
      choice: <p className="hint">Choisissez d'abord une race et une carrière.</p>,
      detail: { title: 'Compétences & Talents', body: <p className="hint">Les répartitions apparaîtront une fois race et carrière choisies.</p> },
    };
  }

  const choice = (
    <>
      <Section
        title="Compétences de race"
        right={
          <b className={d.speciesPlus5.length === SPECIES_SKILLS_PLUS5 && d.speciesPlus3.length === SPECIES_SKILLS_PLUS3 ? 'ok-text' : 'warn-text'}>
            +5 : {d.speciesPlus5.length}/{SPECIES_SKILLS_PLUS5} · +3 : {d.speciesPlus3.length}/{SPECIES_SKILLS_PLUS3}
          </b>
        }
      >
        <button
          className="btn small"
          style={{ marginBottom: 8 }}
          onClick={() =>
            setD({
              ...d,
              speciesPlus5: sp.skills.slice(0, SPECIES_SKILLS_PLUS5).map((a) => advancementLabel('skills', a)),
              speciesPlus3: sp.skills.slice(SPECIES_SKILLS_PLUS5, SPECIES_SKILLS_PLUS5 + SPECIES_SKILLS_PLUS3).map((a) => advancementLabel('skills', a)),
            })
          }
        >
          Répartition par défaut
        </button>
        {sp.skills.map((a) => advancementLabel('skills', a)).map((raw) => {
          const { k, v } = charOf(raw);
          const tier = speciesSkillTier(d, raw);
          return (
            <div key={raw} className="rail-line" title={skillTip(raw)}>
              <span>
                {raw} {k && <em className="tag-char">{k} {v}{tier ? ` → ${v + tier}` : ''}</em>}
                {isUnresolvedChoice(raw) && tier > 0 && <SpecSelect d={d} setD={setD} raw={raw} />}
              </span>
              {/* MÊME widget d'allocation que les Compétences de carrière (Stepper) — paliers 0/3/5
                  quota-gérés (LDB 05 l.484), le geste unifié tue la double mécanique cases/steppers. */}
              <Stepper
                value={tier}
                max={5}
                up={speciesSkillStep(d, raw, 1)}
                down={speciesSkillStep(d, raw, -1)}
                onChange={(t) => setD(withSpeciesSkillTier(d, raw, t as 0 | 3 | 5))}
              />
            </div>
          );
        })}
      </Section>
      <Section title="Talents de race">
        <div className="talent-choices">
          {sp.talents.map((a) => advancementLabel('talents', a)).map((entry) => {
            const options = splitTopLevelOu(entry);
            if (options.length > 1) {
              return (
                <label key={entry} title={options.map((o) => `${o} : ${talentTip(o) || '(tirage aléatoire)'}`).join('\n\n')}>
                  {entry}
                  <select
                    value={d.speciesTalentChoices[entry] ?? ''}
                    onChange={(e) => setD({ ...d, speciesTalentChoices: { ...d.speciesTalentChoices, [entry]: e.target.value } })}
                  >
                    <option value="">— choisir —</option>
                    {options.map((o) => (
                      <option key={o} value={o}>
                        {o}
                      </option>
                    ))}
                  </select>
                </label>
              );
            }
            return <EntityChoice key={entry} category="talents" entry={entry} />;
          })}
        </div>
        <div className="mini-title" style={{ marginTop: 10 }}>Talents obtenus</div>
        <div className="skill-tags">
          {resolved.map((label) => (
            <EntityChoice key={label} category="talents" entry={label} />
          ))}
        </div>
        {resolved
          .filter((label) => {
            const { name, spec } = splitLabel(label);
            const specs = wildcardSpecs(name);
            return spec != null && specs.length > 0 && !sp.talents.map((a) => advancementLabel('talents', a)).some((e) => e.includes(label));
          })
          .map((label) => {
            const { name, spec } = splitLabel(label);
            const free = wildcardSpecs(name).filter((s) => s === spec || !resolved.includes(concreteLabel(name, s)));
            return (
              <label key={label} style={{ display: 'block', marginTop: 6 }}>
                {name} (tiré) — spécialisation
                <select value={d.randomSpecPicks[name] ?? spec} onChange={(e) => setD({ ...d, randomSpecPicks: { ...d.randomSpecPicks, [name]: e.target.value } })}>
                  {free.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </label>
            );
          })}
      </Section>
    </>
  );

  const body = (
    <>
      <Section
        title="Compétences de carrière"
        right={<b className={total === CAREER_SKILL_ADVANCES ? 'ok-text' : 'warn-text'}>{total}/{CAREER_SKILL_ADVANCES} · max {MAX_ADV_PER_SKILL}</b>}
      >
        <button className="btn small" style={{ marginBottom: 8 }} onClick={() => setD({ ...d, skillAdvances: evenCareerSkillAdvances(d) })}>
          Répartition simple : +5 sur les 8 Compétences
        </button>
        <div className="skill-adv-grid">
          {entries.map((raw) => {
            const { k, v } = charOf(raw);
            const adv = d.skillAdvances[raw] ?? 0;
            return (
              <div key={raw} className="skill-adv" title={skillTip(raw)}>
                <span>
                  {raw} {k && <em className="tag-char">{k} {v}{adv ? ` → ${v + adv}` : ''}</em>}
                  {isUnresolvedChoice(raw) && adv > 0 && <SpecSelect d={d} setD={setD} raw={raw} />}
                </span>
                <Stepper
                  value={adv}
                  max={Math.min(MAX_ADV_PER_SKILL, adv + (CAREER_SKILL_ADVANCES - total))}
                  onChange={(val) => setD({ ...d, skillAdvances: { ...d.skillAdvances, [raw]: val } })}
                />
              </div>
            );
          })}
        </div>
      </Section>
      <Section title="Talent de carrière (un au choix)">
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
      </Section>
      <PettySpellsSection d={d} setD={setD} />
    </>
  );
  return { choice, detail: { title: 'Compétences & Talents de carrière', body } };
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

// ════ 5) Possessions (LDB 05 l.559-585) — Zone A : richesse + arme au choix ; Zone B : revue d'équipement ════
export function TrappingZones({ d, setD }: StepProps): StepZones {
  const level = draftLevel(d);
  const klass = findClassById(findCareerById(d.careerId)?.class);
  const wealth = draftWealth(d);
  const careerTrappings = level?.trappings ?? []; // TrappingRef[]
  const enc = previewHero(d)?.encumbrance;
  // Chip d'équipement : libellé via trappingRefLabel ; CodexRef par libellé → popover de stats au survol
  // (Dégâts/PA/Enc…) + fiche au clic. Plus de méta inline recodée.
  const chip = (ref: import('../../data').TrappingRef, key: number) => {
    const label = trappingRefLabel(ref);
    return (
      <CodexRef key={key} category="trappings" id={'id' in ref ? ref.id : undefined} label={splitLabel(label).name}>{label}</CodexRef>
    );
  };
  const choice = (
    <>
      <Section title="Richesse initiale">
        <p className="hint" style={{ marginTop: 0 }}>
          Statut <b>{level?.status}</b> — Bronze : 2d10 sous × Standing · Argent : 1d10 pistoles × Standing · Or : 1 CO ×
          Standing. Le jet est figé.
        </p>
        <p style={{ margin: 0 }}>
          Bourse de départ : <b><Coins money={wealth} /></b> <span className="hint">(créditée au groupe)</span>
        </p>
      </Section>
      {careerTrappings.some((t) => 'text' in t && t.text === 'Arme (Au choix)') && (
        <Section title="Arme (au choix)">
          <label>
            Choisissez votre arme de départ
            <select
              value={d.weaponChoice ?? ''}
              onChange={(e) => setD({ ...d, weaponChoice: e.target.value || undefined })}
            >
              <option value="">— choisir —</option>
              {WEAPON_CHOICES.map((w) => (
                <option key={w.id} value={w.id}>
                  {w.label}
                </option>
              ))}
            </select>
          </label>
          {d.weaponChoice && <p className="hint">{trappingMeta(d.weaponChoice)}</p>}
        </Section>
      )}
    </>
  );
  const body = (
    <>
      <Section
        title="Revue d'équipement"
        right={enc != null ? <span className="hint">Encombrement total <b>{enc}</b></span> : undefined}
      >
        <div className="mini-title">Dotation de Classe ({klass?.label ?? '—'})</div>
        <div className="skill-tags" style={{ marginBottom: 12 }}>{(klass?.trappings ?? []).map(chip)}</div>
        <div className="mini-title">Dotation de Carrière ({level?.label ?? '—'})</div>
        <div className="skill-tags">{careerTrappings.filter((t) => !('text' in t && t.text === 'Arme (Au choix)')).map(chip)}</div>
        <p className="hint" style={{ marginTop: 12 }}>
          Chaque objet ouvre sa fiche au clic ; l'Encombrement total est reporté dans la fiche vivante.
        </p>
      </Section>
    </>
  );
  return { choice, detail: { title: 'Possessions de départ', body } };
}

// ════ 6) Détails (LDB 05 l.587-744) — Zone A : UNE région identité (nom, physique, motivation) ; Zone B : apparence ════
export function DetailZones({ d, setD }: StepProps): StepZones {
  const sp = draftSpecies(d);
  if (!sp) {
    return {
      choice: <p className="hint">Choisissez d'abord une race.</p>,
      detail: { title: 'Détails', body: <p className="hint">Identité et apparence s'ouvriront une fois votre race choisie.</p> },
    };
  }
  const appearance: Appearance = { species: rigSpeciesId(d.speciesId), sex: d.sex, build: d.build, seed: d.appSeed, colors: d.colors, parts: d.parts };
  // Zone A = UNE seule région identité (nom+dé, physique, motivation/ambitions) — fin de l'identité
  // coupée en trois. Zone B = l'apparence/personnalisateur.
  const choice = (
    <>
      <Section
        title="Identité"
        right={
          <button
            className="btn small"
            onClick={() => {
              const r = rolledDetails(d);
              setD({ ...d, age: r.age, height: r.height, eyes: r.eyes, hair: r.hair });
            }}
          >
            <Icon id="nav/dice" size="sm" /> Tirer le physique
          </button>
        }
      >
        <label>
          Nom
          <span className="input-dice">
            <input value={d.name} onChange={(e) => setD({ ...d, name: e.target.value })} placeholder="Nom du personnage" />
            <button
              type="button"
              className="btn small"
              title="Nom aléatoire (race et sexe du personnage)"
              onClick={() => {
                const n = generateName(sp.refChar, d.sex, makeRNG(Math.floor(Math.random() * 1e9)));
                if (n) setD({ ...d, name: n });
              }}
            >
              <Icon id="nav/dice" size="sm" />
            </button>
          </span>
        </label>
        <label>
          Âge
          <input type="number" value={d.age ?? ''} onChange={(e) => setD({ ...d, age: Number(e.target.value) || undefined })} />
        </label>
        <label>
          Taille (cm)
          <input type="number" value={d.height ?? ''} onChange={(e) => setD({ ...d, height: Number(e.target.value) || undefined })} />
        </label>
        <label>
          Yeux
          <input value={d.eyes ?? ''} onChange={(e) => setD({ ...d, eyes: e.target.value })} />
        </label>
        <label>
          Cheveux
          <input value={d.hair ?? ''} onChange={(e) => setD({ ...d, hair: e.target.value })} />
        </label>
      </Section>
      <Section title="Motivation & ambitions">
        <BackgroundFields
          values={{ motivation: d.motivation, ambitionShort: d.ambitionShort, ambitionLong: d.ambitionLong }}
          onChange={(patch) => setD({ ...d, ...patch })}
        />
      </Section>
    </>
  );
  const body = (
    <Section title="Apparence">
      <AppearancePanel
        value={appearance}
        equip={{ weapons: [], armour: [] }}
        career={d.careerId}
        onChange={(a) => setD({ ...d, sex: a.sex, build: a.build, appSeed: a.seed ?? d.appSeed, colors: a.colors, parts: a.parts })}
      />
    </Section>
  );
  return { choice, detail: { title: 'Apparence', body } };
}

// ════ 7) Récapitulatif — la « feuille de personnage » cérémonielle : parchemin, figurine équipée
//      en double vue, et les descriptions RAW réelles (espèce, carrière, signe, talents) via Prose ════
export function RecapZones({ d }: { d: CreatorDraft }): StepZones {
  const hero = previewHero(d);
  const wealth = draftWealth(d);
  const sp = findSpeciesById(d.speciesId);
  const career = findCareerById(d.careerId);
  const speciesLabel = sp?.label ?? d.speciesId;
  const careerLabel = career?.label ?? d.careerId;
  const sign = d.star ? starsTable.find((s) => s.id === d.star) : undefined;
  const choice = (
    <Section title="PX bonus de création">
      <ul className="hint" style={{ margin: 0, paddingLeft: 18 }}>
        <li>Race aléatoire : +{speciesXp(d)} PX</li>
        <li>Carrière aléatoire : +{careerXp(d)} PX</li>
        <li>Caractéristiques : +{charsXp(d)} PX</li>
        {stepIds().includes('star') && <li>Signe astral : +{starXp(d)} PX</li>}
      </ul>
      <p className="hint">À dépenser dans la fiche (onglet Avancement), d'abord dans votre Niveau de Carrière.</p>
    </Section>
  );
  const body = (
    <div className="recap-sheet">
      <div className="recap-head">
        {hero && (
          <div className="recap-figures">
            <CharacterPreview hero={hero} view="front" size="lg" />
            <CharacterPreview hero={hero} view="profile" size="lg" />
          </div>
        )}
        <div className="recap-id">
          <h2>{d.name.trim() || 'Aventurier'}</h2>
          <p>
            <CodexRef category="races" id={d.speciesId} label={speciesLabel}>{speciesLabel}</CodexRef>, {displayLabelForSex(d.sex, draftLevel(d)?.label ?? '', draftLevel(d)?.labelF)} (
            <CodexRef category="careers" id={d.careerId} label={careerLabel}>{displayLabelForSex(d.sex, careerLabel, career?.labelF)}</CodexRef>) · {draftLevel(d)?.status}
          </p>
          <p className="recap-meta">
            {hero?.details?.age ? `${hero.details.age} ans · ` : ''}
            {hero?.details?.height ? `${hero.details.height} cm · ` : ''}
            {hero?.details?.eyes ? `yeux ${hero.details.eyes} · ` : ''}
            {hero?.details?.hair ? `cheveux ${hero.details.hair}` : ''}
          </p>
          {d.motivation && (
            <p className="recap-meta">
              Motivation : <b>{d.motivation}</b>
            </p>
          )}
          {(d.ambitionShort || d.ambitionLong) && (
            <p className="recap-meta">Ambitions : {d.ambitionShort || '—'} / {d.ambitionLong || '—'}</p>
          )}
          <p className="recap-meta">
            Richesse initiale : <b><Coins money={wealth} /></b> (créditée au groupe).
          </p>
        </div>
      </div>

      <RuleDivider label={speciesLabel} />
      {sp?.desc && <Prose md={sp.desc} selfLabel={sp.label} />}

      <RuleDivider label={careerLabel} />
      {career?.desc && <Prose md={career.desc} selfLabel={career.label} />}

      {sign && (
        <>
          <RuleDivider label={sign.label} />
          <p className="recap-meta">{[sign.signe, sign.dates, sign.dieux && `Dieu : ${sign.dieux}`].filter(Boolean).join(' · ')}</p>
          {sign.desc && <Prose md={sign.desc} />}
        </>
      )}

      <RuleDivider label="Talents" />
      {(hero?.talents ?? []).map((t) => {
        const data = findTalentById(t.talentId);
        return (
          <div key={`${t.talentId}|${t.spec ?? ''}`} className="recap-talent">
            <h4>
              <TalentChip talent={t} />
            </h4>
            {data?.desc && <Prose md={data.desc} selfLabel={data.label} />}
          </div>
        );
      })}

      <RuleDivider label="Compétences formées" />
      <div className="skill-tags">
        {(hero?.skills ?? [])
          .filter((s) => s.advances > 0)
          .map((s) => (
            <SkillChip key={`${s.skillId}|${s.spec ?? ''}`} skill={s} />
          ))}
      </div>

      <RuleDivider label="Équipement" />
      <div className="skill-tags">
        {(hero?.items ?? []).map((it) => (
          <EntityRef key={it.uid} category="trappings" id={it.trappingId} label={it.name} show={`${it.name}${it.qty ? ` ×${it.qty}` : ''}`} />
        ))}
      </div>
    </div>
  );
  return { choice, detail: { title: d.name.trim() || 'Aventurier', body } };
}
