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
import {
  species as allSpecies,
  careersForSpecies,
  classes,
  findCareer,
  findSkill,
  findTalent,
  findTrapping,
  trappings as allTrappings,
  levelsForCareer,
  characteristics as charData,
  eyes as eyesTable,
  hairs as hairsTable,
  details as detailTables,
  SpeciesData,
  CareerData,
} from '../../data';
import { CHAR_KEYS, CharKey, CHAR_LABELS, CHAR_BY_LABEL, Characteristics } from '../../engine/types';
import { bonus } from '../../engine/characteristics';
import { formatMoney } from '../../engine/money';
import { RigSprite } from '../../gameIso/rig/composeRig';
import { DEFS } from '../../gameIso/sprites';
import { AppearancePanel } from '../AppearancePanel';
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
  careerSkillEntries,
  careerAdvTotal,
  careerTalentOptions,
  specOptionsFor,
  draftWealth,
  rolledDetails,
  validateStep,
  buildHero,
  probeHero,
  isUnresolvedChoice,
  splitLabel,
  concreteLabel,
  splitTopLevelOu,
} from './draft';

const STEPS = ['Espèce', 'Carrière', 'Caractéristiques', 'Compétences & Talents', 'Possessions', 'Détails', 'Récapitulatif'];

/** Espèces mises en avant : celles du Livre de base — dérivé des données, les suppléments
 *  apparaissent automatiquement à la suite. */
const CORE = allSpecies.filter((s) => s.source.book === 'LDB').map((s) => s.label);

/** Choix proposés pour le trapping « Arme (Au choix) » : toutes les ARMES des données. */
const WEAPON_CHOICES = allTrappings
  .filter((t) => (t.type === 'melee' || t.type === 'ranged') && !/mains nues/i.test(t.label))
  .map((t) => t.label)
  .sort((a, b) => a.localeCompare(b, 'fr'));

/** Texte de données (desc HTML) → extrait lisible pour cartes et infobulles. */
function blurb(html: string | null | undefined, max = 160): string {
  if (!html) return '';
  const txt = html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
  return txt.length > max ? `${txt.slice(0, max)}…` : txt;
}
const skillTip = (name: string) => {
  const data = findSkill(splitLabel(name).name);
  if (!data) return '';
  return `${data.characteristic} · Compétence ${data.type === 'base' ? 'de Base' : 'Avancée'}\n${blurb(data.desc, 280)}`;
};
const talentTip = (name: string) => blurb(findTalent(splitLabel(name).name)?.desc, 300);
/** Description des Caractéristiques (characteristics.json — LDB 05). */
const CHAR_DESC: Record<string, string> = Object.fromEntries(
  (charData as { abr?: string; desc?: string }[]).filter((c) => c.abr && CHAR_KEYS.includes(c.abr as CharKey)).map((c) => [c.abr!, blurb(c.desc, 240)]),
);
/** Clé de la Caractéristique liée à une compétence (« Ag »), pour annoter les listes. */
const skillCharKey = (name: string): CharKey | null => CHAR_BY_LABEL[findSkill(splitLabel(name).name)?.characteristic ?? ''] ?? null;

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

/** Puce Compétence : caractéristique liée + infobulle descriptive (+ valeur vivante). */
function SkillChip({ label, value }: { label: string; value?: number }) {
  const k = skillCharKey(label);
  return (
    <span className="tag" title={skillTip(label)}>
      {label}
      {k && <em className="tag-char">{k}{value != null ? ` ${value}` : ''}</em>}
    </span>
  );
}

/** Puce Talent : infobulle descriptive. */
function TalentChip({ label }: { label: string }) {
  return (
    <span className="tag talent" title={talentTip(label)}>
      {label}
    </span>
  );
}

const RANDOM_CHIP_RE = /^(?:(\d+)\s+)?Talents?\s+al[ée]atoires?$/i;

/**
 * ENTRÉE de talents d'une liste d'espèce/carrière : « A ou B » est éclaté en puces séparées
 * (chacune avec SA règle au survol — une puce unique « Perspicace ou Affable » n'a pas
 * d'infobulle) ; « N Talent aléatoire » reçoit une explication dédiée.
 */
function TalentEntryChips({ entry }: { entry: string }) {
  const options = splitTopLevelOu(entry);
  return (
    <span className="entry-chips">
      {options.map((opt, i) => {
        const mRand = opt.match(RANDOM_CHIP_RE);
        return (
          <span key={opt} className="entry-chips">
            {i > 0 && <em className="chip-ou">ou</em>}
            {mRand ? (
              <span className="tag talent" title={`${mRand[1] ?? 1} tirage(s) d100 sur le Tableau des Talents aléatoires — figé, relance seulement si déjà possédé.`}>
                {opt}
              </span>
            ) : (
              <TalentChip label={opt} />
            )}
          </span>
        );
      })}
    </span>
  );
}

export function CharacterCreator() {
  const party = useGame((s) => s.party);
  const setParty = useGame((s) => s.setParty);
  const setScreen = useGame((s) => s.setScreen);
  const creditPartyMoney = useGame((s) => s.creditPartyMoney);

  const [d, setD] = useState<CreatorDraft>(() => newDraft());
  const [step, setStep] = useState(0);

  const level = draftLevel(d);
  const err = validateStep(d, step + 1);
  const canNext = err == null;

  const create = () => {
    const hero = buildHero(d);
    setParty([...party, hero]);
    creditPartyMoney(draftWealth(d), `Richesse initiale de ${hero.name} (${level?.status ?? ''})`);
    setScreen('party');
  };

  const zones: { rail: ReactNode; main: ReactNode }[] = [
    SpeciesZones({ d, setD }),
    CareerZones({ d, setD }),
    CharZones({ d, setD }),
    SkillZones({ d, setD }),
    TrappingZones({ d, setD }),
    DetailZones({ d, setD }),
    RecapZones({ d }),
  ];

  return (
    <div className="screen creator">
      <header className="bar">
        <button className="btn small" onClick={() => setScreen('party')}>
          ← Groupe
        </button>
        <h2>Créateur de personnage</h2>
        <div className="wizard-steps">
          {STEPS.map((label, i) => (
            <button
              key={label}
              className={`step-chip ${i === step ? 'active' : ''} ${i < step ? 'done' : ''}`}
              disabled={i > step}
              onClick={() => setStep(i)}
            >
              {i + 1}. {label}
            </button>
          ))}
        </div>
        {/* Mobile : indicateur compact (pas de rangée défilante → pas de scrollbar). */}
        <div className="steps-progress">
          <span>
            Étape <b>{step + 1}</b>/{STEPS.length} · {STEPS[step]}
          </span>
          <div className="steps-bar">
            <i style={{ width: `${((step + 1) / STEPS.length) * 100}%` }} />
          </div>
        </div>
      </header>

      <div className="creator-shell">
        <aside className="creator-rail">{zones[step].rail}</aside>
        <main className="creator-main">{zones[step].main}</main>
        <CreatorSummary d={d} step={step} />
      </div>

      <footer className="bar">
        <button className="btn" disabled={step === 0} onClick={() => setStep(step - 1)}>
          ← Précédent
        </button>
        <span className="hint" style={{ flex: 1, color: err ? 'var(--gold)' : undefined }}>
          {err ?? ''}
        </span>
        {step < STEPS.length - 1 ? (
          <button className="btn btn-primary" disabled={!canNext} onClick={() => setStep(step + 1)}>
            Suivant →
          </button>
        ) : (
          <button className="btn btn-primary" disabled={party.length >= 4 || !canNext} onClick={create}>
            ⚔️ Créer l'aventurier
          </button>
        )}
      </footer>
    </div>
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

// ════ 1) Espèce (LDB 04 l.84-90) — rail : liste groupée par race ; détail : onglets ════
function SpeciesZones({ d, setD }: StepProps): { rail: ReactNode; main: ReactNode } {
  const sp = draftSpecies(d);
  const [tab, setTab] = useState<'profil' | 'carrieres' | 'description' | 'details'>('profil');

  // Groupes par race (les variantes des suppléments perdent leur préfixe répétitif),
  // les races du Livre de base d'abord — l'ordre des familles suit les données.
  const families: { family: string; list: SpeciesData[] }[] = [];
  for (const s of allSpecies) {
    const { family } = speciesFamily(s.label);
    const g = families.find((f) => f.family === family);
    if (g) g.list.push(s);
    else families.push({ family, list: [s] });
  }
  families.sort((a, b) => Number(b.list.some((s) => CORE.includes(s.label))) - Number(a.list.some((s) => CORE.includes(s.label))));

  const row = (s: SpeciesData) => {
    const { variant } = speciesFamily(s.label);
    return (
      <button key={s.label} className={`pick-row ${d.speciesLabel === s.label ? 'selected' : ''}`} onClick={() => setD(withSpecies(d, s.label))}>
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
              🎲 Tirer l'espèce (d100) — +20 PX si vous acceptez
            </button>
            <span className="hint">Le jet est unique : pas de relance.</span>
          </div>
        ) : (
          <div className="row-flex">
            <span>
              Jet : <b>{d.speciesRoll.roll}</b> → <b>{d.speciesRoll.label}</b>
            </span>
            {d.speciesLabel !== d.speciesRoll.label && (
              <button className="btn small" onClick={() => setD(withSpecies(d, d.speciesRoll!.label))}>
                Accepter {d.speciesRoll.label} (+20 PX)
              </button>
            )}
          </div>
        )}
      </Section>
      <Section title="Caractéristiques de base">
        <div className="base-char-grid">
          {CHAR_KEYS.map((k) => {
            const base = sp.baseChar[k] ?? 20;
            const diff = base - 20;
            return (
              <div key={k} className="base-char" title={`${CHAR_LABELS[k]} — ${CHAR_DESC[k] ?? ''}`}>
                <span className="char-key">{k}</span>
                <b>{base}</b>
                {diff !== 0 && <em className={diff > 0 ? 'up' : 'down'}>{diff > 0 ? `+${diff}` : diff}</em>}
              </div>
            );
          })}
        </div>
        <p className="hint" style={{ marginBottom: 0 }}>2d10 s'ajoutent à chaque valeur au tirage des Caractéristiques.</p>
        <div className="derived" style={{ marginTop: 8 }}>
          <span>
            Mouvement <b>{sp.movement}</b>
          </span>
          <span>
            Destin <b>{sp.fate.fate}</b> · Résilience <b>{sp.fate.resilience}</b> · +<b>{sp.fate.extra}</b> à répartir
          </span>
          {sp.small && <span title="Talent Petit : Blessures calculées sans le Bonus de Force">Taille <b>Petite</b></span>}
        </div>
      </Section>
      <Section title="Compétences d'espèce">
        <p className="hint" style={{ marginTop: 0 }}>Vous en formerez 3 à +5 et 3 à +3.</p>
        <div className="skill-tags">
          {sp.skills.map((s) => (
            <SkillChip key={s} label={s} />
          ))}
        </div>
      </Section>
      <Section title="Talents d'espèce">
        <div className="skill-tags">
          {sp.talents.map((t) => (
            <TalentEntryChips key={t} entry={t} />
          ))}
        </div>
      </Section>
    </>
  );

  // ── Onglet Carrières : ce que cette espèce peut embrasser ──
  const accessible = careersForSpecies(sp.refCareer);
  const carrieres = (
    <>
      <p className="hint" style={{ marginTop: 0 }}>
        {accessible.length} carrières accessibles aux {sp.label} — le choix se fait à l'étape suivante.
      </p>
      {classes.map((cl) => {
        const list = accessible.filter((c) => c.class === cl.label);
        if (!list.length) return null;
        return (
          <Section key={cl.label} title={`${cl.label} (${list.length})`}>
            <div className="skill-tags">
              {list.map((c) => (
                <span key={c.label} className="tag" title={blurb(c.desc, 260)}>
                  {c.label}
                </span>
              ))}
            </div>
          </Section>
        );
      })}
    </>
  );

  // ── Onglet Description : le texte complet ──
  const description = <LoreText html={sp.desc} />;

  // ── Onglet Détails : âge, taille, noms, yeux/cheveux (tables des données) ──
  const ref = sp.refChar;
  const txt = detailTables.texts;
  const eyeColors = [...new Set(eyesTable.map((e) => e.color[ref]).filter(Boolean))];
  const hairColors = [...new Set(hairsTable.map((e) => e.color[ref]).filter(Boolean))];
  const detailsTab = (
    <>
      <Section title="Âge">
        <p style={{ marginTop: 0 }}>
          Tirage : <b>{detailTables.ageBase[ref] ?? detailTables.ageBase['Humain']} + {Math.round(detailTables.ageRoll[ref] ?? 1)}d10</b> ans
        </p>
        <LoreText html={txt.age.bySpecies[ref] ?? ''} />
      </Section>
      <Section title="Taille">
        <p style={{ marginTop: 0 }}>
          Tirage : <b>{detailTables.heightBase[ref] ?? detailTables.heightBase['Humain']} + {Math.round(detailTables.heightRoll[ref] ?? 1)}d10</b> cm
        </p>
        <LoreText html={txt.taille.bySpecies[ref] ?? txt.taille.all} />
      </Section>
      <Section title="Noms">
        <LoreText html={txt.nom.bySpecies[ref] ?? txt.nom.bySpecies['Humain']} />
      </Section>
      <Section title="Yeux & cheveux">
        <p className="hint" style={{ marginTop: 0 }}>Couleurs tirées à l'étape Détails (2d10 sur les tables).</p>
        <div className="skill-tags">
          {eyeColors.map((c) => (
            <span key={`e-${c}`} className="tag">👁 {c}</span>
          ))}
        </div>
        <div className="skill-tags" style={{ marginTop: 6 }}>
          {hairColors.map((c) => (
            <span key={`h-${c}`} className="tag">💇 {c}</span>
          ))}
        </div>
      </Section>
    </>
  );

  const TABS = [
    ['profil', 'Profil'],
    ['carrieres', 'Carrières'],
    ['description', 'Description'],
    ['details', 'Détails'],
  ] as const;
  const main = (
    <>
      <div className="main-head">
        <Figure speciesLabel={sp.label} sex={d.sex} className="main-figure" />
        <div>
          <h2>{sp.label}</h2>
          <p className="hint">{blurb(sp.desc, 300)}</p>
        </div>
      </div>
      <div className="zone-tabs">
        {TABS.map(([key, label]) => (
          <button key={key} className={`zone-tab ${tab === key ? 'active' : ''}`} onClick={() => setTab(key)}>
            {label}
          </button>
        ))}
      </div>
      {tab === 'profil' && profil}
      {tab === 'carrieres' && carrieres}
      {tab === 'description' && description}
      {tab === 'details' && detailsTab}
    </>
  );
  return { rail, main };
}

// ════ 2) Carrière (LDB 05 l.186-365) — rail : classes + liste ; détail : plan complet ════
function CareerZones({ d, setD }: StepProps): { rail: ReactNode; main: ReactNode } {
  const sp = draftSpecies(d);
  const accessible = careersForSpecies(sp.refCareer, d.ignoreRestrictions);
  const career = findCareer(d.careerLabel);
  const levels = levelsForCareer(d.careerLabel);
  const lvl1 = levels.find((l) => l.level === 1);

  const rail = (
    <>
      <Section title={`Carrières (${accessible.length} accessibles)`}>
        <label className="radio" style={{ marginBottom: 8, fontSize: 12 }}>
          <input type="checkbox" checked={d.ignoreRestrictions} onChange={(e) => setD({ ...d, ignoreRestrictions: e.target.checked })} />
          Ignorer les restrictions d'espèce
        </label>
        {classes.map((cl) => {
          const list = accessible.filter((c) => c.class === cl.label);
          if (!list.length) return null;
          return (
            <div key={cl.label}>
              <div className="rail-group" title={blurb(cl.desc, 220)}>{cl.label}</div>
              <div className="pick-list">
                {list.map((c: CareerData) => {
                  const l1 = levelsForCareer(c.label).find((l) => l.level === 1);
                  return (
                    <button key={c.label} className={`pick-row ${d.careerLabel === c.label ? 'selected' : ''}`} onClick={() => setD(withCareer(d, c.label))}>
                      <Figure speciesLabel={d.speciesLabel} career={c.label} sex={d.sex} />
                      <span className="row-body">
                        <strong>{c.label}</strong>
                        <em>{l1 ? `${l1.label} · ${l1.status}` : c.class}</em>
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
        <Figure speciesLabel={d.speciesLabel} career={d.careerLabel} sex={d.sex} className="main-figure" />
        <div>
          <h2>
            {d.careerLabel} <span className="hint">({career?.class})</span>
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
              <label className="radio" key={`${r.label}-${i}`}>
                <input type="radio" name="career-roll" checked={d.careerLabel === r.label} onChange={() => setD(withCareer(d, r.label))} />
                Jet {i + 1} : {r.roll} → <b>{r.label}</b> ({findCareer(r.label)?.class})
              </label>
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
            <span key={l.level} className={`path-node ${l.level === 1 ? 'current' : ''}`} title={`Compétences : ${l.skills.join(', ')}\nTalents : ${l.talents.join(', ')}`}>
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
                <span key={c} className="tag char" title={CHAR_DESC[CHAR_BY_LABEL[c] ?? ''] ?? ''}>
                  {c}
                </span>
              ))}
            </div>
          </Section>
          <Section title="Compétences du Niveau 1">
            <div className="skill-tags">
              {lvl1.skills.map((s) => (
                <SkillChip key={s} label={s} />
              ))}
            </div>
          </Section>
          <Section title="Talents du Niveau 1">
            <div className="skill-tags">
              {lvl1.talents.map((t) => (
                <TalentEntryChips key={t} entry={t} />
              ))}
            </div>
          </Section>
          <Section title="Possessions & Statut">
            <p className="hint" style={{ margin: 0 }}>
              {lvl1.trappings.join(', ') || '—'} · Statut <b>{lvl1.status}</b>
            </p>
          </Section>
        </>
      )}
    </>
  );
  return { rail, main };
}

// ════ 3) Caractéristiques (LDB 05 l.370-491) — rail : méthode + répartitions ; détail : grille ════
function CharZones({ d, setD }: StepProps): { rail: ReactNode; main: ReactNode } {
  const sp = draftSpecies(d);
  const level = draftLevel(d);
  const rolls = charRolls(d);
  const chars = draftChars(d);
  const careerCharKeys = (level?.characteristics ?? []).map((l) => CHAR_BY_LABEL[l]).filter(Boolean) as CharKey[];
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
        {careerCharKeys.map((k) => (
          <div key={k} className="rail-line" title={CHAR_DESC[k]}>
            <span>{CHAR_LABELS[k]}</span>
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
            <div key={k} className="char-alloc" title={`${CHAR_LABELS[k]} — ${CHAR_DESC[k] ?? ''}`}>
              <span className="char-key">{k}</span>
              <span className="char-name">
                {CHAR_LABELS[k]}
                {careerCharKeys.includes(k) && <span className="tag char">carrière</span>}
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
        title="Compétences d'espèce"
        right={
          <b className={d.speciesPlus5.length === 3 && d.speciesPlus3.length === 3 ? 'ok-text' : 'warn-text'}>
            +5 : {d.speciesPlus5.length}/3 · +3 : {d.speciesPlus3.length}/3
          </b>
        }
      >
        <button className="btn small" style={{ marginBottom: 8 }} onClick={() => setD({ ...d, speciesPlus5: sp.skills.slice(0, 3), speciesPlus3: sp.skills.slice(3, 6) })}>
          Répartition par défaut
        </button>
        {sp.skills.map((raw) => {
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
      <Section title="Talents d'espèce">
        <div className="talent-choices">
          {sp.talents.map((entry) => {
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
            return <TalentChip key={entry} label={entry} />;
          })}
        </div>
        <div className="mini-title" style={{ marginTop: 10 }}>Talents obtenus</div>
        <div className="skill-tags">
          {resolved.map((label) => (
            <TalentChip key={label} label={label} />
          ))}
        </div>
        {resolved
          .filter((label) => {
            const { name, spec } = splitLabel(label);
            const specs = findTalent(name)?.specs ?? [];
            return spec != null && specs.length > 0 && !sp.talents.some((e) => e.includes(label));
          })
          .map((label) => {
            const { name, spec } = splitLabel(label);
            const free = (findTalent(name)?.specs ?? []).filter((s) => s === spec || !resolved.includes(concreteLabel(name, s)));
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
                {!maxed && selected && probe.talents.some((t) => t.name === selected) && <em className="hint">déjà possédé via l'espèce → passera ×2</em>}
              </label>
              <p className="hint talent-desc">{talentTip(selected ?? entry)}</p>
            </div>
          ))}
        </div>
      </Section>
    </>
  );
  return { rail, main };
}

/** Détail d'un objet d'équipement (trappings.json) : dégâts / PA / encombrement. */
function trappingMeta(label: string): string {
  const t = findTrapping(splitLabel(label).name);
  if (!t) return '';
  const bits: string[] = [];
  if (t.damage) bits.push(`Dégâts ${t.damage}`);
  if (t.pa) bits.push(`${t.pa} PA (${t.loc ?? ''})`);
  if (t.reach && t.type === 'melee') bits.push(`Allonge ${t.reach}`);
  if (t.reach && t.type === 'ranged') bits.push(`Portée ${t.reach}`);
  if (t.enc) bits.push(`Enc. ${t.enc}`);
  if (t.qualities?.length) bits.push(t.qualities.join(', '));
  return bits.join(' · ');
}

// ════ 5) Possessions (LDB 05 l.559-585) — rail : richesse + choix ; détail : équipement ════
function TrappingZones({ d, setD }: StepProps): { rail: ReactNode; main: ReactNode } {
  const level = draftLevel(d);
  const klass = classes.find((c) => c.label === findCareer(d.careerLabel)?.class);
  const wealth = draftWealth(d);
  const careerTrappings = level?.trappings ?? [];
  const item = (t: string) => {
    const meta = trappingMeta(t);
    return (
      <li key={t} title={blurb(findTrapping(splitLabel(t).name)?.desc, 240)}>
        {t}
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
      {careerTrappings.includes('Arme (Au choix)') && (
        <Section title="Arme (au choix)">
          <select
            value={d.specChoices['Arme (Au choix)'] ?? ''}
            onChange={(e) => setD({ ...d, specChoices: { ...d.specChoices, 'Arme (Au choix)': e.target.value }, weaponChoice: e.target.value })}
          >
            <option value="">— choisir —</option>
            {WEAPON_CHOICES.map((w) => (
              <option key={w} value={w}>
                {w}
              </option>
            ))}
          </select>
          {d.weaponChoice && <p className="hint">{trappingMeta(d.weaponChoice)}</p>}
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
        <ul className="trapping-list">{careerTrappings.filter((t) => t !== 'Arme (Au choix)').map(item)}</ul>
      </Section>
    </>
  );
  return { rail, main };
}

// ════ 6) Détails (LDB 05 l.587-744) — rail : détails physiques ; détail : identité + apparence ════
function DetailZones({ d, setD }: StepProps): { rail: ReactNode; main: ReactNode } {
  const appearance: Appearance = { species: d.speciesLabel, sex: d.sex, build: d.build, seed: d.appSeed, colors: d.colors, parts: d.parts };
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
            <input value={d.name} onChange={(e) => setD({ ...d, name: e.target.value })} placeholder="Nom du personnage" />
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
          career={d.careerLabel}
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
  const rail = (
    <Section title="PX bonus de création">
      <ul className="hint" style={{ margin: 0, paddingLeft: 18 }}>
        <li>Espèce aléatoire : +{speciesXp(d)} PX</li>
        <li>Carrière aléatoire : +{careerXp(d)} PX</li>
        <li>Caractéristiques : +{charsXp(d)} PX</li>
      </ul>
      <p className="hint">À dépenser dans la fiche (onglet Avancement), d'abord dans votre Niveau de Carrière.</p>
    </Section>
  );
  const main = (
    <>
      <Section title="Votre aventurier">
        <p>
          <b>{d.name.trim() || 'Aventurier'}</b> — {d.speciesLabel}, {draftLevel(d)?.label} ({d.careerLabel}) ·{' '}
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
            <span key={t.name} className="tag talent" title={talentTip(t.name)}>
              {t.name}
              {t.times > 1 ? ` ×${t.times}` : ''}
            </span>
          ))}
        </div>
      </Section>
      <Section title="Compétences formées">
        <div className="skill-tags">
          {(hero?.skills ?? [])
            .filter((s) => s.advances > 0)
            .map((s) => (
              <span key={`${s.name}|${s.spec ?? ''}`} className="tag" title={skillTip(s.name)}>
                {s.name}
                {s.spec ? ` (${s.spec})` : ''} +{s.advances}
              </span>
            ))}
        </div>
      </Section>
      <Section title="Équipement">
        <div className="skill-tags">
          {(hero?.items ?? []).map((it) => (
            <span key={it.uid} className="tag" title={trappingMeta(it.name)}>
              {it.name}
              {it.qty ? ` ×${it.qty}` : ''}
            </span>
          ))}
        </div>
      </Section>
    </>
  );
  return { rail, main };
}
