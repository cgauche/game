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
import { ReactNode, useMemo, useState } from 'react';
import { useGame } from '../../state/store';
import { rosterAdd, rosterLoad } from '../../state/roster';
import {
  species as allSpecies,
  careersForSpecies,
  classes,
  findCareerById,
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
  characteristics as charData,
  stars as starsTable,
  spells as allSpells,
  SpeciesData,
  CareerData,
} from '../../data';
import { CHAR_KEYS, CharKey, CHAR_LABELS, Characteristics } from '../../engine/types';
import { rule } from '../../engine/policy';
import { bonus } from '../../engine/characteristics';
import { formatMoney } from '../../engine/money';
import { makeRNG } from '../../engine/dice';
import { generateName } from '../../engine/names';
import { RigSprite } from '../../gameIso/rig/composeRig';
import { DEFS } from '../../gameIso/sprites';
import { AppearancePanel } from '../AppearancePanel';
import { CodexRef, CodexTooltipOnly } from '../compendium/CodexRef';
import { TabbedEntry } from '../TabbedEntry';
import { CodexSections } from '../compendium/CodexEntry';
import { EntityRef, EntityChoice, SkillChip, TalentChip } from '../EntityChip';
import { raceCareerSection, raceDetailSection, raceCharSection, raceSkillSection, raceTalentSection, type CodexSection } from '../compendium/registry';
import { opSummary } from '../editor/GameOpEditor';
import type { Appearance } from '../../gameIso/rig/appearance';
import { CreatorSummary, previewHero } from './CreatorSummary';
import {
  CreatorDraft,
  newDraft,
  draftSpecies,
  draftLevel,
  withSpecies,
  withCareer,
  rollDraftSpecies,
  rollDraftCareer,
  speciesXp,
  careerXp,
  charsXp,
  charRolls,
  draftChars,
  resolvedSpeciesTalents,
  careerCharKeys,
  careerSkillEntries,
  careerAdvTotal,
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
  buildHero,
  draftFromHero,
  probeHero,
  isUnresolvedChoice,
  splitLabel,
  concreteLabel,
  splitTopLevelOu,
} from './draft';
import { wildcardSpecs } from '../../engine/careerSlots';

/** Métadonnées d'étape : libellé FR + fabrique de zones (rail/main). SOURCE UNIQUE du rendu, indexée
 *  par `StepId` stable — l'ordre ET la présence des étapes viennent de `stepIds()` (draft.ts, qui
 *  insère « Signe astral » selon la règle optionnelle ADE2), jamais d'un index positionnel codé. */
const STEP_META: Record<StepId, { label: string; zone: (p: StepProps) => { rail: ReactNode; main: ReactNode } }> = {
  species: { label: 'Race', zone: SpeciesZones },
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
const CORE = allSpecies.filter((s) => s.source.book === 'LDB').map((s) => s.label);

/** Choix proposés pour le trapping « Arme (Au choix) » : toutes les ARMES des données ({id, label}). */
const WEAPON_CHOICES = allTrappings
  .filter((t) => (t.type === 'melee' || t.type === 'ranged') && !/mains nues/i.test(t.label))
  .map((t) => ({ id: t.id, label: t.label }))
  .sort((a, b) => a.label.localeCompare(b.label, 'fr'));

/** Texte de données (desc HTML) → extrait lisible pour cartes et infobulles. */
function blurb(html: string | null | undefined, max = 160): string {
  if (!html) return '';
  const txt = html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
  return txt.length > max ? `${txt.slice(0, max)}…` : txt;
}
const skillTip = (name: string) => {
  const data = findSkill(splitLabel(name).name);
  if (!data) return '';
  return `${CHAR_LABELS[data.characteristic]} · Compétence ${data.type === 'base' ? 'de Base' : 'Avancée'}\n${blurb(data.desc, 280)}`;
};
const talentTip = (name: string) => blurb(findTalent(splitLabel(name).name)?.desc, 300);
/** Description des Caractéristiques (characteristics.json — LDB 05). */
const CHAR_DESC: Record<string, string> = Object.fromEntries(
  (charData as { abr?: string; desc?: string }[]).filter((c) => c.abr && CHAR_KEYS.includes(c.abr as CharKey)).map((c) => [c.abr!, blurb(c.desc, 240)]),
);
/** Clé de la Caractéristique liée à une compétence (« Ag »), pour annoter les listes. */
const skillCharKey = (name: string): CharKey | null => findSkill(splitLabel(name).name)?.characteristic ?? null;

/** Stepper +/− avec compteur — l'outil d'allocation standard des créateurs de RPG. */
function Stepper({ value, min = 0, max, onChange, disabled }: { value: number; min?: number; max: number; onChange: (v: number) => void; disabled?: boolean }) {
  return (
    <span className="stepper">
      <button type="button" className="btn small" disabled={disabled || value <= min} onClick={() => onChange(value - 1)}>
        −
      </button>
      <b>{value}</b>
      <button type="button" className="btn small" disabled={disabled || value >= max} onClick={() => onChange(value + 1)}>
        +
      </button>
    </span>
  );
}

/** Figurine SVG (rig) d'une espèce/carrière. */
function Figure({ speciesLabel, career, sex = 'M', seed = 7, className = 'row-figure' }: { speciesLabel: string; career?: string; sex?: 'M' | 'F'; seed?: number; className?: string }) {
  const appearance: Appearance = { species: speciesLabel, sex, build: 0.5, seed };
  return (
    <svg viewBox="14 6 92 138" className={className}>
      <defs dangerouslySetInnerHTML={{ __html: DEFS }} />
      <RigSprite appearance={appearance} equip={{ weapons: [], armour: [] }} career={career} />
    </svg>
  );
}

function XpBadge({ value }: { value: number }) {
  return value > 0 ? <span className="xp-badge">+{value} PX</span> : null;
}

/** Section de zone : titre en capitales + séparateur (pas de boîte flottante). */
function Section({ title, right, children }: { title: ReactNode; right?: ReactNode; children: ReactNode }) {
  return (
    <section className="zone-section">
      <h3>
        <span>{title}</span>
        {right && <span className="sect-right">{right}</span>}
      </h3>
      {children}
    </section>
  );
}

export function CharacterCreator() {
  const party = useGame((s) => s.party);
  const net = useGame((s) => s.net);
  const setScreen = useGame((s) => s.setScreen);
  const addHero = useGame((s) => s.partyAddHero);
  const removeHero = useGame((s) => s.partyRemoveHero);
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
      // Remplacement EN PLACE : on retire puis ré-ajoute au même siège pour préserver la possession.
      const seat = net.ownership[editing.heroId] ?? net.mySeat ?? 0;
      removeHero(editing.heroId);
      addHero(hero, undefined, seat); // pas de re-crédit de la Richesse (déjà comptée à la création)
    } else {
      addHero(hero, wealth); // côté invité : intent vers l'hôte (l'état arrive par snapshot)
    }
    closeCreator();
  };

  const zone = STEP_META[curId].zone({ d, setD });

  // Les références Codex de l'assistant sont popover-SEUL : un clic ne doit pas ouvrir le Compendium
  // plein écran (ce qui démontait l'assistant et perdait le brouillon, en cours de création).
  return (
    <CodexTooltipOnly.Provider value={true}>
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
        <p className="hint" style={{ margin: '4px 12px', color: 'var(--gold)' }}>
          ⚠️ Brouillon d'origine indisponible : race, carrière, identité et apparence sont repris, mais
          les tirages, allocations et Talents sont à revoir étape par étape avant d'enregistrer.
        </p>
      )}

      <div className="creator-shell">
        <aside className="creator-rail">{zone.rail}</aside>
        <main className="creator-main">{zone.main}</main>
        <CreatorSummary d={d} step={step} />
      </div>

      <footer className="bar">
        <button className="btn" disabled={step === 0} onClick={() => setStep(step - 1)}>
          ← Précédent
        </button>
        <span className="hint wizard-hint" style={{ color: err ? 'var(--gold)' : undefined }}>
          {err ?? ''}
        </span>
        {step < ids.length - 1 ? (
          <button className="btn btn-primary" disabled={!canNext} onClick={() => setStep(step + 1)}>
            Suivant →
          </button>
        ) : (
          <button className="btn btn-primary" disabled={(!editing && party.length >= 4) || !canNext} onClick={create}>
            {editing ? '💾 Enregistrer les modifications' : "⚔️ Créer l'aventurier"}
          </button>
        )}
      </footer>
    </div>
    </CodexTooltipOnly.Provider>
  );
}

type StepProps = { d: CreatorDraft; setD: (d: CreatorDraft) => void };

/** Famille d'une espèce : « Humains (Middenheim) » → « Humains » ; sans variante → le label. */
function speciesFamily(label: string): { family: string; variant: string | null } {
  const m = label.match(/^(.*?)\s*\((.*)\)\s*$/);
  return m ? { family: m[1].trim(), variant: m[2].trim() } : { family: label, variant: null };
}

/** Rendu HTML léger des textes de données (descriptions — données locales de confiance). */
function LoreText({ html }: { html: string | null | undefined }) {
  if (!html?.trim()) return null;
  return <div className="lore-text" dangerouslySetInnerHTML={{ __html: html }} />;
}

// ════ 1) Race (LDB 04 l.84-90) — rail : liste groupée par race ; détail : onglets ════
function SpeciesZones({ d, setD }: StepProps): { rail: ReactNode; main: ReactNode } {
  const sp = draftSpecies(d);

  // Groupes par race (les variantes des suppléments perdent leur préfixe répétitif),
  // les races du Livre de base d'abord — l'ordre des familles suit les données.
  // Le Gnome (et tout contenu NADJ) n'apparaît dans la grille que si la règle optionnelle l'autorise.
  const gnomeOn = !!rule('creation-gnome-jouable');
  const families: { family: string; list: SpeciesData[] }[] = [];
  for (const s of allSpecies) {
    if (s.source.book === 'NADJ' && !gnomeOn) continue;
    const { family } = speciesFamily(s.label);
    const g = families.find((f) => f.family === family);
    if (g) g.list.push(s);
    else families.push({ family, list: [s] });
  }
  families.sort((a, b) => Number(b.list.some((s) => CORE.includes(s.label))) - Number(a.list.some((s) => CORE.includes(s.label))));

  const row = (s: SpeciesData) => {
    const { variant } = speciesFamily(s.label);
    return (
      <button key={s.label} className={`pick-row ${d.speciesId === s.id ? 'selected' : ''}`} onClick={() => setD(withSpecies(d, s.id))}>
        <Figure speciesLabel={s.label} sex={d.sex} />
        <span className="row-body">
          <strong>{variant ?? s.label}</strong>
          <em>
            M {s.movement} · Destin {s.fate.fate} · Rés. {s.fate.resilience} · +{s.fate.extra}
          </em>
        </span>
      </button>
    );
  };

  const rail = (
    <>
      {families.map(({ family, list }) => (
        <div key={family}>
          <div className="rail-group">{family}</div>
          <div className="pick-list">{list.map(row)}</div>
        </div>
      ))}
    </>
  );

  // ── Onglet Profil : l'essentiel chiffré ──
  const profil = (
    <>
      <Section title="Tirage aléatoire" right={<XpBadge value={speciesXp(d)} />}>
        {!d.speciesRoll ? (
          <div className="row-flex">
            <button className="btn" onClick={() => setD(rollDraftSpecies(d))}>
              🎲 Tirer la race (d100) — +20 PX si vous acceptez
            </button>
          </div>
        ) : (
          <>
            <p className="hint" style={{ marginTop: 0 }}>
              Jet : <b>{d.speciesRoll.roll}</b>
              {d.speciesRoll.ids.length > 1 && ' — choisissez librement parmi les races de cette borne (le bonus est conservé)'}
            </p>
            <div className="talent-choices">
              {d.speciesRoll.ids.map((id) => (
                <label className="radio" key={id}>
                  <input type="radio" name="species-roll" checked={d.speciesId === id} onChange={() => setD(withSpecies(d, id))} />
                  <b>{findSpeciesById(id)?.label ?? id}</b> (+20 PX)
                </label>
              ))}
            </div>
          </>
        )}
      </Section>
      <div className="derived" style={{ margin: '2px 0 8px' }}>
        <span>
          Mouvement <b>{sp.movement}</b>
        </span>
        <span>
          Destin <b>{sp.fate.fate}</b> · Résilience <b>{sp.fate.resilience}</b> · +<b>{sp.fate.extra}</b> à répartir
        </span>
        {sp.small && <span title="Talent Petit : Blessures calculées sans le Bonus de Force">Taille <b>Petite</b></span>}
      </div>
      {/* Caractéristiques / Compétences / Talents : MÊMES sections que le Codex (source unique
          `raceCharSection`/`raceSkillSection`/`raceTalentSection`) → rendu identique des deux côtés. */}
      <CodexSections sections={[raceCharSection(sp), raceSkillSection(sp), raceTalentSection(sp)].filter((s): s is CodexSection => !!s)} />
    </>
  );

  // ── Onglets Carrières / Description / Détails : MÊME contenu que le Codex (source unique
  //    `raceCareerSection`/`raceDetailSection`) — plus de ré-implémentation divergente. ──
  const careerSec = raceCareerSection(sp);
  const carrieres = careerSec ? <CodexSections sections={[careerSec]} /> : <p className="hint">Aucune carrière accessible.</p>;
  const description = sp.desc ? <div className="codex-body" dangerouslySetInnerHTML={{ __html: sp.desc }} /> : null;
  const detailsTab = <CodexSections sections={[raceDetailSection(sp)]} />;

  const main = (
    <TabbedEntry
      figure={<Figure speciesLabel={sp.label} sex={d.sex} className="main-figure" />}
      title={<CodexRef category="races" label={sp.label}>{sp.label}</CodexRef>}
      blurb={blurb(sp.desc, 300)}
      tabs={[
        { id: 'profil', label: 'Profil', content: profil },
        { id: 'carrieres', label: 'Carrières', content: carrieres },
        { id: 'description', label: 'Description', content: description },
        { id: 'details', label: 'Détails', content: detailsTab },
      ]}
    />
  );
  return { rail, main };
}

// ════ 2) Carrière (LDB 05 l.186-365) — rail : classes + liste ; détail : plan complet ════
export function CareerZones({ d, setD }: StepProps): { rail: ReactNode; main: ReactNode } {
  const sp = draftSpecies(d);
  const accessible = careersForSpecies(sp.refCareer, d.ignoreRestrictions);
  const career = findCareerById(d.careerId);
  const levels = levelsForCareer(d.careerId);
  const lvl1 = levels.find((l) => l.level === 1);

  const rail = (
    <>
      <Section title={`Carrières (${accessible.length} accessibles)`}>
        <label className="radio" style={{ marginBottom: 8, fontSize: 12 }}>
          <input type="checkbox" checked={d.ignoreRestrictions} onChange={(e) => setD({ ...d, ignoreRestrictions: e.target.checked })} />
          Ignorer les restrictions de race
        </label>
        {classes.map((cl) => {
          const list = accessible.filter((c) => c.class === cl.id);
          if (!list.length) return null;
          return (
            <div key={cl.id}>
              <div className="rail-group"><CodexRef category="classes" label={cl.label}>{cl.label}</CodexRef></div>
              <div className="pick-list">
                {list.map((c: CareerData) => {
                  const l1 = levelsForCareer(c.id).find((l) => l.level === 1);
                  return (
                    <button key={c.id} className={`pick-row ${d.careerId === c.id ? 'selected' : ''}`} onClick={() => setD(withCareer(d, c.id))}>
                      <Figure speciesLabel={sp.label} career={c.label} sex={d.sex} />
                      <span className="row-body">
                        <strong>{c.label}</strong>
                        <em>{l1 ? `${l1.label} · ${l1.status}` : findClassById(c.class)?.label}</em>
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </Section>
    </>
  );

  const main = (
    <>
      <div className="main-head">
        <Figure speciesLabel={sp.label} career={career?.label} sex={d.sex} className="main-figure" />
        <div>
          <h2>
            <CodexRef category="careers" label={career?.label ?? d.careerId}>{career?.label ?? d.careerId}</CodexRef>{' '}
            {career?.class && (
              <span className="hint">(<CodexRef category="classes" label={findClassById(career.class)?.label ?? career.class}>{findClassById(career.class)?.label ?? career.class}</CodexRef>)</span>
            )}
          </h2>
          <p className="hint">{blurb(career?.desc, 460)}</p>
        </div>
      </div>
      <Section title="Tirage aléatoire" right={<XpBadge value={careerXp(d)} />}>
        <p className="hint" style={{ marginTop: 0 }}>
          1ᵉʳ jet accepté : +50 PX · choix parmi 3 jets : +25 PX · choix libre / relances : +0 PX.
        </p>
        {d.careerRolls.length === 0 && (
          <button className="btn" onClick={() => setD(rollDraftCareer(d))}>
            🎲 Tirer la carrière (d100)
          </button>
        )}
        {d.careerRolls.length > 0 && (
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
        )}
        {d.careerRolls.length === 1 && (
          <button className="btn small" style={{ marginTop: 8 }} onClick={() => setD(rollDraftCareer(d))}>
            🎲 Pas convaincu : 2 jets de plus (choix parmi 3, +25 PX)
          </button>
        )}
        {d.careerRolls.length >= 3 && (
          <button className="btn small" style={{ marginTop: 8 }} onClick={() => setD(rollDraftCareer(d))}>
            🎲 Continuer à relancer (0 PX)
          </button>
        )}
      </Section>
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
      {lvl1 && (
        <>
          <Section title="Caractéristiques de carrière">
            <div className="skill-tags">
              {lvl1.characteristics.map((c) => (
                <EntityRef key={c} category="characteristics" label={c} />
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
      )}
    </>
  );
  return { rail, main };
}

// ════ 3) Caractéristiques (LDB 05 l.370-491) — rail : méthode + répartitions ; détail : grille ════
export function CharZones({ d, setD }: StepProps): { rail: ReactNode; main: ReactNode } {
  const sp = draftSpecies(d);
  const rolls = charRolls(d);
  const chars = draftChars(d);
  const careerKeys = careerCharKeys(d);
  const allocTotal = Object.values(d.charAdvancesAlloc).reduce((a, b) => a + (b ?? 0), 0);
  const pbTotal = CHAR_KEYS.reduce((a, k) => a + d.pointBuy[k], 0);
  const splitTotal = d.fateSplit.fate + d.fateSplit.resilience;

  const rail = (
    <>
      <Section title="Méthode" right={<XpBadge value={charsXp(d)} />}>
        <div className="talent-choices">
          <label className="radio">
            <input type="radio" name="char-mode" checked={d.charMode === 'rolled'} onChange={() => setD({ ...d, charMode: 'rolled' })} />
            Garder le tirage 2d10 {d.charRerolls === 0 ? '(+50 PX)' : '(+0 PX)'}
          </label>
          <label className="radio">
            <input type="radio" name="char-mode" checked={d.charMode === 'reassigned'} onChange={() => setD({ ...d, charMode: 'reassigned' })} />
            Réassigner les dix jets {d.charRerolls === 0 ? '(+25 PX)' : '(+0 PX)'}
          </label>
          <label className="radio">
            <input type="radio" name="char-mode" checked={d.charMode === 'pointBuy'} onChange={() => setD({ ...d, charMode: 'pointBuy' })} />
            Répartir 100 Points (4-18, +0 PX)
          </label>
        </div>
        {d.charMode !== 'pointBuy' && (
          <button className="btn small" style={{ marginTop: 10 }} onClick={() => setD({ ...d, charRerolls: d.charRerolls + 1 })}>
            🎲 Relancer les dix jets (bonus perdus)
          </button>
        )}
      </Section>
      <Section title="Augmentations gratuites" right={<b className={allocTotal === 5 ? 'ok-text' : 'warn-text'}>{allocTotal}/5</b>}>
        <p className="hint" style={{ marginTop: 0 }}>
          À répartir sur les Caractéristiques de votre carrière.
        </p>
        {careerKeys.map((k) => (
          <div key={k} className="rail-line">
            <span><CodexRef category="characteristics" label={CHAR_LABELS[k]}>{CHAR_LABELS[k]}</CodexRef></span>
            <Stepper
              value={d.charAdvancesAlloc[k] ?? 0}
              max={Math.min(5, (d.charAdvancesAlloc[k] ?? 0) + (5 - allocTotal))}
              onChange={(v) => setD({ ...d, charAdvancesAlloc: { ...d.charAdvancesAlloc, [k]: v } })}
            />
          </div>
        ))}
      </Section>
      <Section title="Destin & Résilience" right={<b className={splitTotal === sp.fate.extra ? 'ok-text' : 'warn-text'}>{splitTotal}/{sp.fate.extra}</b>}>
        <p className="hint" style={{ marginTop: 0 }}>
          ☄️ Destin : survie & Chance. 🛡️ Résilience : Détermination (votre Motivation la recharge).
        </p>
        <div className="rail-line">
          <span>☄️ Destin (base {sp.fate.fate})</span>
          <Stepper
            value={d.fateSplit.fate}
            max={Math.min(sp.fate.extra, d.fateSplit.fate + (sp.fate.extra - splitTotal))}
            onChange={(v) => setD({ ...d, fateSplit: { ...d.fateSplit, fate: v } })}
          />
        </div>
        <div className="rail-line">
          <span>🛡️ Résilience (base {sp.fate.resilience})</span>
          <Stepper
            value={d.fateSplit.resilience}
            max={Math.min(sp.fate.extra, d.fateSplit.resilience + (sp.fate.extra - splitTotal))}
            onChange={(v) => setD({ ...d, fateSplit: { ...d.fateSplit, resilience: v } })}
          />
        </div>
      </Section>
    </>
  );

  const main = (
    <>
      <Section
        title="Caractéristiques"
        right={d.charMode === 'pointBuy' ? <b className={pbTotal === 100 ? 'ok-text' : 'warn-text'}>Points : {pbTotal}/100</b> : undefined}
      >
        <p className="hint" style={{ marginTop: 0 }}>
          💡 Les Caractéristiques <span className="tag char">carrière</span> progressent au coût normal en PX et comptent
          pour la complétion du Niveau. Les Blessures dépendent des <b>Bonus</b> (dizaine) de F, E et FM
          {sp.small ? ' (sans BF pour les Petits)' : ''} ; l'Initiative départage l'ordre du combat.
        </p>
        <div className="char-alloc-grid">
          {CHAR_KEYS.map((k, i) => (
            <div key={k} className="char-alloc">
              <CodexRef category="characteristics" label={CHAR_LABELS[k]} className="char-key">{k}</CodexRef>
              <span className="char-name">
                {CHAR_LABELS[k]}
                {careerKeys.includes(k) && <span className="tag char">carrière</span>}
              </span>
              <em>base {sp.baseChar[k] ?? 20}</em>
              {d.charMode === 'rolled' && <span className="char-roll">+{rolls[i]}</span>}
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
              <b className="char-total">
                {chars[k]}
                <em title="Bonus de Caractéristique (dizaine) — Blessures, Talents, Sorts">B{bonus(chars[k])}</em>
              </b>
            </div>
          ))}
        </div>
      </Section>
    </>
  );
  return { rail, main };
}

/** Sélecteur de spec pour une entrée « (Au choix) » — bound à specChoices[raw]. */
function SpecSelect({ d, setD, raw }: StepProps & { raw: string }) {
  const { name } = splitLabel(raw);
  const options = specOptionsFor(raw);
  const current = d.specChoices[raw] ? splitLabel(d.specChoices[raw]).spec ?? '' : '';
  return (
    <select
      value={current}
      onChange={(e) => {
        const specChoices = { ...d.specChoices };
        if (e.target.value) specChoices[raw] = concreteLabel(name, e.target.value);
        else delete specChoices[raw];
        setD({ ...d, specChoices });
      }}
    >
      <option value="">— spécialisation —</option>
      {options.map((s) => (
        <option key={s} value={s}>
          {s}
        </option>
      ))}
    </select>
  );
}

// ════ 3bis) Signe astral (ADE2 ch.03, optionnel) — rail : tirage/choix + effet ; détail : sens + astrologie ════
function StarZones({ d, setD }: StepProps): { rail: ReactNode; main: ReactNode } {
  const sign = d.star ? starsTable.find((s) => s.id === d.star) : undefined; // d.star = id STABLE
  // Talent « (Au choix) » octroyé par le signe (ex. Maître artisan) → spec à préciser (réutilise specChoices).
  const grantChoice = sign?.effect?.flatMap((o) => (o.op === 'grantTalent' && isUnresolvedChoice(talentConcrete(o)) ? [talentConcrete(o)] : []))[0];
  const grantOpts = grantChoice ? specOptionsFor(grantChoice) : [];
  const xp = starXp(d);

  const rail = (
    <Section title="Signe astral" right={<button className="btn small" onClick={() => setD(rollDraftStar(d))}>🎲 Tirer</button>}>
      <label>
        Signe
        <select value={d.star ?? ''} onChange={(e) => setD({ ...d, star: e.target.value || undefined })}>
          <option value="">— aucun —</option>
          {starsTable.map((s) => (
            <option key={s.id} value={s.id}>{s.label}</option>
          ))}
        </select>
      </label>
      {sign && (
        <>
          <p className="hint" style={{ margin: '2px 0 0' }}>{[sign.signe, sign.dates, sign.dieux && `Dieu : ${sign.dieux}`].filter(Boolean).join(' · ')}</p>
          {!!sign.effect?.length && <ul className="trapping-list">{sign.effect.map((o, i) => <li key={i}>{opSummary(o)}</li>)}</ul>}
          <p className="hint" style={{ margin: '4px 0 0', color: xp ? 'var(--gold)' : undefined }}>{xp ? `Tirage gardé : +${xp} PX` : 'Choix libre : +0 PX'}</p>
          {grantChoice && grantOpts.length > 0 && (
            <label>
              {splitLabel(grantChoice).name}
              <select
                value={d.specChoices[grantChoice] ?? ''}
                onChange={(e) => setD({ ...d, specChoices: { ...d.specChoices, [grantChoice]: e.target.value ? concreteLabel(splitLabel(grantChoice).name, e.target.value) : '' } })}
              >
                <option value="">— au choix —</option>
                {grantOpts.map((o) => <option key={o} value={o}>{o}</option>)}
              </select>
            </label>
          )}
        </>
      )}
    </Section>
  );

  const main = (
    <>
      <Section title={sign ? sign.label : 'Sous quel signe êtes-vous né ?'}>
        {sign ? <LoreText html={sign.desc} /> : <p className="hint">Gardez le tirage : +25 PX · Choix libre : +0 PX.</p>}
      </Section>
      <Section title="Astrologie (facultatif)" right={<button className="btn small" onClick={() => setD(rollDraftAstrology(d))}>🎲 Thème astral</button>}>
        {d.ascendant || d.dwellings?.length ? (
          <>
            {d.ascendant && <p style={{ margin: '0 0 4px' }}><b>Ascendant :</b> {d.ascendant}</p>}
            {d.dwellings?.length ? <ul className="trapping-list">{d.dwellings.map((h) => <li key={h.house}><b>{h.house} :</b> {h.sign}</li>)}</ul> : null}
          </>
        ) : (
          <p className="hint">Ascendant + 5 demeures célestes — pur roleplay (aucun effet de jeu).</p>
        )}
      </Section>
    </>
  );
  return { rail, main };
}

// ════ 4) Compétences & Talents (LDB 05 l.493-555) — rail : espèce ; détail : carrière ════
function SkillZones({ d, setD }: StepProps): { rail: ReactNode; main: ReactNode } {
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

  const togglePick = (list: 'speciesPlus5' | 'speciesPlus3', skill: string) => {
    const cur = d[list];
    const other = list === 'speciesPlus5' ? d.speciesPlus3 : d.speciesPlus5;
    if (cur.includes(skill)) setD({ ...d, [list]: cur.filter((s) => s !== skill) });
    else if (cur.length < 3 && !other.includes(skill)) setD({ ...d, [list]: [...cur, skill] });
  };

  const rail = (
    <>
      <Section
        title="Compétences de race"
        right={
          <b className={d.speciesPlus5.length === 3 && d.speciesPlus3.length === 3 ? 'ok-text' : 'warn-text'}>
            +5 : {d.speciesPlus5.length}/3 · +3 : {d.speciesPlus3.length}/3
          </b>
        }
      >
        <button className="btn small" style={{ marginBottom: 8 }} onClick={() => setD({ ...d, speciesPlus5: sp.skills.slice(0, 3).map((a) => advancementLabel('skills', a)), speciesPlus3: sp.skills.slice(3, 6).map((a) => advancementLabel('skills', a)) })}>
          Répartition par défaut
        </button>
        {sp.skills.map((a) => advancementLabel('skills', a)).map((raw) => {
          const { k, v } = charOf(raw);
          const adv = d.speciesPlus5.includes(raw) ? 5 : d.speciesPlus3.includes(raw) ? 3 : 0;
          return (
            <div key={raw} className="rail-line" title={skillTip(raw)}>
              <span>
                {raw} {k && <em className="tag-char">{k} {v}{adv ? ` → ${v + adv}` : ''}</em>}
                {isUnresolvedChoice(raw) && adv > 0 && <SpecSelect d={d} setD={setD} raw={raw} />}
              </span>
              <span className="row-flex">
                <label className="radio">
                  <input type="checkbox" checked={d.speciesPlus5.includes(raw)} onChange={() => togglePick('speciesPlus5', raw)} />
                  +5
                </label>
                <label className="radio">
                  <input type="checkbox" checked={d.speciesPlus3.includes(raw)} onChange={() => togglePick('speciesPlus3', raw)} />
                  +3
                </label>
              </span>
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

  const main = (
    <>
      <Section title="Compétences de carrière" right={<b className={total === 40 ? 'ok-text' : 'warn-text'}>{total}/40 · max 10</b>}>
        <button className="btn small" style={{ marginBottom: 8 }} onClick={() => setD({ ...d, skillAdvances: Object.fromEntries((draftLevel(d)?.skills ?? []).map((s) => [s, 5])) })}>
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
                  max={Math.min(10, adv + (40 - total))}
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
  return { rail, main };
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
                <em className="hint">NI {s.cn ?? 0} · {s.range} · {s.duration}</em>
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
  if (t.damage) bits.push(`Dégâts ${t.damage}`);
  if (t.pa) bits.push(`${t.pa} PA (${t.loc ?? ''})`);
  if (t.reach && t.type === 'melee') bits.push(`Allonge ${t.reach}`);
  if (t.reach && t.type === 'ranged') bits.push(`Portée ${t.reach}`);
  if (t.enc) bits.push(`Enc. ${t.enc}`);
  if (t.qualities?.length) bits.push(t.qualities.map(qualityRefLabel).join(', '));
  return bits.join(' · ');
}

// ════ 5) Possessions (LDB 05 l.559-585) — rail : richesse + choix ; détail : équipement ════
function TrappingZones({ d, setD }: StepProps): { rail: ReactNode; main: ReactNode } {
  const level = draftLevel(d);
  const klass = findClassById(findCareerById(d.careerId)?.class);
  const wealth = draftWealth(d);
  const careerTrappings = level?.trappings ?? []; // TrappingRef[]
  // Rendu d'une possession : libellé via trappingRefLabel, CodexRef par libellé (popover), meta par id.
  const item = (ref: import('../../data').TrappingRef, key: number) => {
    const label = trappingRefLabel(ref);
    const meta = 'id' in ref ? trappingMeta(ref.id) : '';
    return (
      <li key={key}>
        <CodexRef category="trappings" label={splitLabel(label).name}>{label}</CodexRef>
        {meta && <em className="item-meta"> — {meta}</em>}
      </li>
    );
  };
  const rail = (
    <>
      <Section title="Richesse initiale">
        <p className="hint" style={{ marginTop: 0 }}>
          Statut <b>{level?.status}</b> — Bronze : 2d10 sous × Standing · Argent : 1d10 pistoles × Standing · Or : 1 CO ×
          Standing. Le jet est figé.
        </p>
        <p style={{ margin: 0 }}>
          Bourse : <b>{formatMoney(wealth)}</b> (au groupe)
        </p>
      </Section>
      {careerTrappings.some((t) => 'text' in t && t.text === 'Arme (Au choix)') && (
        <Section title="Arme (au choix)">
          <select
            value={d.specChoices['Arme (Au choix)'] ?? ''}
            onChange={(e) => setD({ ...d, specChoices: { ...d.specChoices, 'Arme (Au choix)': e.target.value }, weaponChoice: e.target.value })}
          >
            <option value="">— choisir —</option>
            {WEAPON_CHOICES.map((w) => (
              <option key={w.id} value={w.label}>
                {w.label}
              </option>
            ))}
          </select>
          {d.weaponChoice && <p className="hint">{trappingMeta(WEAPON_CHOICES.find((w) => w.label === d.weaponChoice)?.id ?? '')}</p>}
        </Section>
      )}
    </>
  );
  const main = (
    <>
      <Section title={`Équipement de Classe (${klass?.label ?? '—'})`}>
        <ul className="trapping-list">{(klass?.trappings ?? []).map(item)}</ul>
      </Section>
      <Section title={`Équipement de Carrière (${level?.label ?? '—'})`}>
        <ul className="trapping-list">{careerTrappings.filter((t) => !('text' in t && t.text === 'Arme (Au choix)')).map(item)}</ul>
      </Section>
    </>
  );
  return { rail, main };
}

// ════ 6) Détails (LDB 05 l.587-744) — rail : détails physiques ; détail : identité + apparence ════
function DetailZones({ d, setD }: StepProps): { rail: ReactNode; main: ReactNode } {
  const sp = draftSpecies(d);
  const appearance: Appearance = { species: sp.label, sex: d.sex, build: d.build, seed: d.appSeed, colors: d.colors, parts: d.parts };
  const rail = (
    <Section
      title="Détails physiques"
      right={
        <button
          className="btn small"
          onClick={() => {
            const r = rolledDetails(d);
            setD({ ...d, age: r.age, height: r.height, eyes: r.eyes, hair: r.hair });
          }}
        >
          🎲 Tirer
        </button>
      }
    >
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
  );
  const main = (
    <>
      <Section title="Identité">
        <div className="form-cols">
          <label>
            Nom
            <span className="input-dice">
              <input value={d.name} onChange={(e) => setD({ ...d, name: e.target.value })} placeholder="Nom du personnage" />
              <button
                type="button"
                className="btn small"
                title="Nom aléatoire (race et sexe du personnage)"
                onClick={() => {
                  const n = generateName(sp.label, d.sex, makeRNG(Math.floor(Math.random() * 1e9)));
                  if (n) setD({ ...d, name: n });
                }}
              >
                🎲
              </button>
            </span>
          </label>
          <label>
            Motivation <em className="hint">(recharge la Détermination)</em>
            <input value={d.motivation} onChange={(e) => setD({ ...d, motivation: e.target.value })} placeholder="Ex. Devoir, Vengeance, Rebelle…" />
          </label>
          <label>
            Ambition à court terme <em className="hint">(accomplie : +50 PX)</em>
            <input value={d.ambitionShort} onChange={(e) => setD({ ...d, ambitionShort: e.target.value })} placeholder="Ex. Venger un camarade tombé au combat…" />
          </label>
          <label>
            Ambition à long terme <em className="hint">(accomplie : +500 PX)</em>
            <input value={d.ambitionLong} onChange={(e) => setD({ ...d, ambitionLong: e.target.value })} placeholder="Ex. Posséder un relais de diligences…" />
          </label>
        </div>
      </Section>
      <Section title="Apparence">
        <AppearancePanel
          value={appearance}
          equip={{ weapons: [], armour: [] }}
          career={findCareerById(d.careerId)?.label}
          onChange={(a) => setD({ ...d, sex: a.sex, build: a.build, appSeed: a.seed ?? d.appSeed, colors: a.colors, parts: a.parts })}
        />
      </Section>
    </>
  );
  return { rail, main };
}

// ════ 7) Récapitulatif ════
function RecapZones({ d }: { d: CreatorDraft }): { rail: ReactNode; main: ReactNode } {
  const hero = previewHero(d);
  const wealth = draftWealth(d);
  const speciesLabel = findSpeciesById(d.speciesId)?.label ?? d.speciesId;
  const careerLabel = findCareerById(d.careerId)?.label ?? d.careerId;
  const rail = (
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
  const main = (
    <>
      <Section title="Votre aventurier">
        <p>
          <b>{d.name.trim() || 'Aventurier'}</b> — <CodexRef category="races" label={speciesLabel}>{speciesLabel}</CodexRef>, {draftLevel(d)?.label} (<CodexRef category="careers" label={careerLabel}>{careerLabel}</CodexRef>) ·{' '}
          {draftLevel(d)?.status}. Richesse initiale : <b>{formatMoney(wealth)}</b> (créditée au groupe).
        </p>
        <p className="hint">
          {hero?.details?.age ? `${hero.details.age} ans · ` : ''}
          {hero?.details?.height ? `${hero.details.height} cm · ` : ''}
          {hero?.details?.eyes ? `yeux ${hero.details.eyes} · ` : ''}
          {hero?.details?.hair ? `cheveux ${hero.details.hair}` : ''}
        </p>
        {d.motivation && (
          <p className="hint">
            Motivation : <b>{d.motivation}</b>
          </p>
        )}
        {(d.ambitionShort || d.ambitionLong) && (
          <p className="hint">
            Ambitions : {d.ambitionShort || '—'} / {d.ambitionLong || '—'}
          </p>
        )}
      </Section>
      <Section title="Talents">
        <div className="skill-tags">
          {(hero?.talents ?? []).map((t) => (
            <TalentChip key={`${t.talentId}|${t.spec ?? ''}`} talent={t} />
          ))}
        </div>
      </Section>
      <Section title="Compétences formées">
        <div className="skill-tags">
          {(hero?.skills ?? [])
            .filter((s) => s.advances > 0)
            .map((s) => (
              <SkillChip key={`${s.skillId}|${s.spec ?? ''}`} skill={s} />
            ))}
        </div>
      </Section>
      <Section title="Équipement">
        <div className="skill-tags">
          {(hero?.items ?? []).map((it) => (
            <EntityRef key={it.uid} category="trappings" label={it.name} show={`${it.name}${it.qty ? ` ×${it.qty}` : ''}`} />
          ))}
        </div>
      </Section>
    </>
  );
  return { rail, main };
}
