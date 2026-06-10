/**
 * Assistant de création de personnage (LDB 04/05 « Personnage ») — UX type RPG vidéo :
 * colonne « fiche vivante » permanente (CreatorSummary : silhouette + stats en direct), cartes
 * de sélection illustrées (espèces, carrières par Classe), steppers d'allocation avec compteurs,
 * descriptions/infobulles tirées des données. La logique (tirages figés, bonus de PX,
 * validation, construction) vit dans ./draft.ts (pur) ; ici uniquement le rendu + store.
 */
import { useMemo, useState } from 'react';
import { useGame } from '../../state/store';
import { species as allSpecies, careersForSpecies, classes, findCareer, findSkill, findTalent, SpeciesData, CareerData } from '../../data';
import { CHAR_KEYS, CharKey, CHAR_LABELS, CHAR_BY_LABEL } from '../../engine/types';
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

/** Espèces jouables principales du Livre de base (cartes mises en avant). */
const CORE = ['Humains (Reiklander)', 'Nains', 'Halflings', 'Hauts elfes', 'Elfes sylvains'];

/** Choix proposés pour le trapping « Arme (Au choix) » (labels existants de trappings.json). */
const WEAPON_CHOICES = ['Arme simple', 'Dague', 'Couteau', 'Bâton de combat', 'Lance', 'Marteau de guerre', 'Hallebarde'];

/** Texte de données (desc HTML) → extrait lisible pour cartes et infobulles. */
function blurb(html: string | null | undefined, max = 160): string {
  if (!html) return '';
  const txt = html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
  return txt.length > max ? `${txt.slice(0, max)}…` : txt;
}
const skillTip = (name: string) => blurb(findSkill(splitLabel(name).name)?.desc, 300);
const talentTip = (name: string) => blurb(findTalent(splitLabel(name).name)?.desc, 300);

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

/** Figurine SVG (rig) d'une espèce/carrière pour les cartes de sélection. */
function Figure({ speciesLabel, career, sex = 'M', seed = 7 }: { speciesLabel: string; career?: string; sex?: 'M' | 'F'; seed?: number }) {
  const appearance: Appearance = { species: speciesLabel, sex, build: 0.5, seed };
  return (
    <svg viewBox="14 6 92 138" className="card-figure">
      <defs dangerouslySetInnerHTML={{ __html: DEFS }} />
      <RigSprite appearance={appearance} equip={{ weapons: [], armour: [] }} career={career} />
    </svg>
  );
}

function XpBadge({ value }: { value: number }) {
  return value > 0 ? <span className="xp-badge">+{value} PX</span> : null;
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
      </header>

      <div className="creator-layout layout-sidebar">
        <CreatorSummary d={d} step={step} />
        <div className="creator-step panel-grid layout-content">
          {step === 0 && <StepSpecies d={d} setD={setD} />}
          {step === 1 && <StepCareer d={d} setD={setD} />}
          {step === 2 && <StepCharacteristics d={d} setD={setD} />}
          {step === 3 && <StepSkillsTalents d={d} setD={setD} />}
          {step === 4 && <StepTrappings d={d} setD={setD} />}
          {step === 5 && <StepDetails d={d} setD={setD} />}
          {step === 6 && <StepRecap d={d} />}
        </div>
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

// ── 1) Espèce (LDB 04 l.84-90) — cartes illustrées ──
function StepSpecies({ d, setD }: StepProps) {
  const [showAll, setShowAll] = useState(!CORE.includes(d.speciesLabel));
  const core = CORE.map((label) => allSpecies.find((s) => s.label === label)!).filter(Boolean);
  const others = allSpecies.filter((s) => !CORE.includes(s.label));
  const card = (s: SpeciesData) => (
    <button key={s.label} className={`select-card ${d.speciesLabel === s.label ? 'selected' : ''}`} onClick={() => setD(withSpecies(d, s.label))}>
      <Figure speciesLabel={s.label} sex={d.sex} />
      <div className="card-body">
        <strong>{s.label}</strong>
        <span className="card-meta">
          Mouvement {s.movement} · Destin {s.fate.fate} · Résilience {s.fate.resilience} · +{s.fate.extra} à répartir
        </span>
        <p>{blurb(s.desc)}</p>
      </div>
    </button>
  );

  return (
    <>
      <section className="panel">
        <h3>
          Choisir une espèce
          <span className="hint" style={{ marginLeft: 'auto', fontWeight: 400 }}>
            ou tirage d100 ci-dessous (+20 PX)
          </span>
        </h3>
        <div className="select-cards">{core.map(card)}</div>
        <button className="btn small" style={{ marginTop: 10 }} onClick={() => setShowAll(!showAll)}>
          {showAll ? 'Masquer' : 'Afficher'} les autres origines ({others.length} — Archives de l'Empire)
        </button>
        {showAll && (
          <div className="chip-list">
            {others.map((s) => (
              <button key={s.label} className={`chip ${d.speciesLabel === s.label ? 'selected' : ''}`} onClick={() => setD(withSpecies(d, s.label))}>
                {s.label}
              </button>
            ))}
          </div>
        )}
      </section>
      <section className="panel">
        <h3>
          🎲 Tirage aléatoire <XpBadge value={speciesXp(d)} />
        </h3>
        <p className="hint">
          « Lancez un d100 sur le Tableau des Races aléatoires, et gagnez 20 PX si vous acceptez le premier résultat. »
          (LDB 04). Le jet est unique : pas de relance.
        </p>
        {!d.speciesRoll ? (
          <button className="btn" onClick={() => setD(rollDraftSpecies(d))}>
            🎲 Tirer l'espèce (d100)
          </button>
        ) : (
          <>
            <p>
              Jet : <b>{d.speciesRoll.roll}</b> → <b>{d.speciesRoll.label}</b>
            </p>
            {d.speciesLabel !== d.speciesRoll.label && (
              <button className="btn small" onClick={() => setD(withSpecies(d, d.speciesRoll!.label))}>
                Accepter {d.speciesRoll.label} (+20 PX)
              </button>
            )}
          </>
        )}
      </section>
    </>
  );
}

// ── 2) Carrière (LDB 05 l.186-365) — navigation par Classe, cartes ──
function StepCareer({ d, setD }: StepProps) {
  const sp = draftSpecies(d);
  const accessible = careersForSpecies(sp.refCareer, d.ignoreRestrictions);
  const selectedClass = findCareer(d.careerLabel)?.class ?? classes[0]?.label;
  const [tab, setTab] = useState(selectedClass);
  const inTab = accessible.filter((c) => c.class === tab);

  const card = (c: CareerData) => {
    const lvl1 = c.label === d.careerLabel ? draftLevel(d) : undefined;
    return (
      <button key={c.label} className={`select-card ${d.careerLabel === c.label ? 'selected' : ''}`} onClick={() => setD(withCareer(d, c.label))}>
        <Figure speciesLabel={d.speciesLabel} career={c.label} sex={d.sex} />
        <div className="card-body">
          <strong>{c.label}</strong>
          <span className="card-meta">{c.class}{lvl1 ? ` · Niveau 1 : ${lvl1.label} (${lvl1.status})` : ''}</span>
          <p>{blurb(c.desc)}</p>
        </div>
      </button>
    );
  };

  return (
    <>
      <section className="panel">
        <h3>
          Choisir une carrière
          <label className="radio" style={{ marginLeft: 'auto', fontSize: 12 }}>
            <input type="checkbox" checked={d.ignoreRestrictions} onChange={(e) => setD({ ...d, ignoreRestrictions: e.target.checked })} />
            Ignorer les restrictions d'espèce (accord du MJ, LDB 05)
          </label>
        </h3>
        <div className="class-tabs">
          {classes.map((cl) => {
            const n = accessible.filter((c) => c.class === cl.label).length;
            return (
              <button key={cl.label} className={`chip ${tab === cl.label ? 'selected' : ''}`} disabled={n === 0} onClick={() => setTab(cl.label)} title={blurb(cl.desc, 200)}>
                {cl.label} ({n})
              </button>
            );
          })}
        </div>
        <div className="select-cards">{inTab.map(card)}</div>
        {inTab.length === 0 && <p className="hint">Aucune carrière de cette Classe n'est accessible aux {sp.label}.</p>}
      </section>
      <section className="panel">
        <h3>
          🎲 Tirage aléatoire <XpBadge value={careerXp(d)} />
        </h3>
        <p className="hint">1ᵉʳ jet accepté : +50 PX · choix parmi 3 jets : +25 PX · choix libre / relances : +0 PX (LDB 05).</p>
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
      </section>
    </>
  );
}

// ── 3) Caractéristiques (LDB 05 l.370-491) ──
function StepCharacteristics({ d, setD }: StepProps) {
  const sp = draftSpecies(d);
  const level = draftLevel(d);
  const rolls = charRolls(d);
  const chars = draftChars(d);
  const careerCharKeys = (level?.characteristics ?? []).map((l) => CHAR_BY_LABEL[l]).filter(Boolean) as CharKey[];
  const allocTotal = Object.values(d.charAdvancesAlloc).reduce((a, b) => a + (b ?? 0), 0);
  const pbTotal = CHAR_KEYS.reduce((a, k) => a + d.pointBuy[k], 0);
  const splitTotal = d.fateSplit.fate + d.fateSplit.resilience;

  return (
    <>
      <section className="panel">
        <h3>
          Méthode <XpBadge value={charsXp(d)} />
        </h3>
        <div className="talent-choices">
          <label className="radio">
            <input type="radio" name="char-mode" checked={d.charMode === 'rolled'} onChange={() => setD({ ...d, charMode: 'rolled' })} />
            Garder le tirage 2d10 tel quel {d.charRerolls === 0 ? '(+50 PX)' : '(relancé : +0 PX)'}
          </label>
          <label className="radio">
            <input type="radio" name="char-mode" checked={d.charMode === 'reassigned'} onChange={() => setD({ ...d, charMode: 'reassigned' })} />
            Réassigner les dix jets entre les Caractéristiques {d.charRerolls === 0 ? '(+25 PX)' : '(relancé : +0 PX)'}
          </label>
          <label className="radio">
            <input type="radio" name="char-mode" checked={d.charMode === 'pointBuy'} onChange={() => setD({ ...d, charMode: 'pointBuy' })} />
            Répartir 100 Points (min 4, max 18 — +0 PX)
          </label>
        </div>
        {d.charMode !== 'pointBuy' && (
          <button className="btn small" style={{ marginTop: 10 }} onClick={() => setD({ ...d, charRerolls: d.charRerolls + 1 })}>
            🎲 Relancer les dix jets (0 PX — les bonus sont définitivement perdus)
          </button>
        )}
      </section>

      <section className="panel">
        <h3>
          Caractéristiques
          {d.charMode === 'pointBuy' && <span className={`adv-total ${pbTotal === 100 ? 'ok' : 'warn'}`} style={{ marginLeft: 'auto' }}>Points : {pbTotal}/100</span>}
        </h3>
        <div className="char-alloc-grid">
          {CHAR_KEYS.map((k, i) => (
            <div key={k} className="char-alloc" title={CHAR_LABELS[k]}>
              <span className="char-key">{k}</span>
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
              <b className="char-total">{chars[k]}</b>
            </div>
          ))}
        </div>
      </section>

      <section className="panel">
        <h3>
          Augmentations gratuites <span className={`adv-total ${allocTotal === 5 ? 'ok' : 'warn'}`} style={{ marginLeft: 'auto' }}>{allocTotal}/5</span>
        </h3>
        <p className="hint">5 Augmentations à répartir sur les 3 Caractéristiques de votre carrière (LDB 05).</p>
        <div className="skill-adv-grid">
          {careerCharKeys.map((k) => (
            <div key={k} className="skill-adv">
              <span>{CHAR_LABELS[k]}</span>
              <Stepper
                value={d.charAdvancesAlloc[k] ?? 0}
                max={Math.min(5, (d.charAdvancesAlloc[k] ?? 0) + (5 - allocTotal))}
                onChange={(v) => setD({ ...d, charAdvancesAlloc: { ...d.charAdvancesAlloc, [k]: v } })}
              />
            </div>
          ))}
        </div>
        <h3 style={{ marginTop: 16 }}>
          Destin & Résilience <span className={`adv-total ${splitTotal === sp.fate.extra ? 'ok' : 'warn'}`} style={{ marginLeft: 'auto' }}>{splitTotal}/{sp.fate.extra}</span>
        </h3>
        <p className="hint">« Plus de Destin = plus de chance ; plus de Résilience = faire face à n'importe quelle situation » (LDB 05).</p>
        <div className="skill-adv-grid">
          <div className="skill-adv">
            <span>☄️ Destin (base {sp.fate.fate})</span>
            <Stepper
              value={d.fateSplit.fate}
              max={Math.min(sp.fate.extra, d.fateSplit.fate + (sp.fate.extra - splitTotal))}
              onChange={(v) => setD({ ...d, fateSplit: { ...d.fateSplit, fate: v } })}
            />
          </div>
          <div className="skill-adv">
            <span>🛡️ Résilience (base {sp.fate.resilience})</span>
            <Stepper
              value={d.fateSplit.resilience}
              max={Math.min(sp.fate.extra, d.fateSplit.resilience + (sp.fate.extra - splitTotal))}
              onChange={(v) => setD({ ...d, fateSplit: { ...d.fateSplit, resilience: v } })}
            />
          </div>
        </div>
      </section>
    </>
  );
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

// ── 4) Compétences & Talents (LDB 05 l.493-555) ──
function StepSkillsTalents({ d, setD }: StepProps) {
  const sp = draftSpecies(d);
  const entries = careerSkillEntries(d);
  const total = careerAdvTotal(d);
  const resolved = resolvedSpeciesTalents(d);
  const probe = probeHero(d, false);

  const togglePick = (list: 'speciesPlus5' | 'speciesPlus3', skill: string) => {
    const cur = d[list];
    const other = list === 'speciesPlus5' ? d.speciesPlus3 : d.speciesPlus5;
    if (cur.includes(skill)) setD({ ...d, [list]: cur.filter((s) => s !== skill) });
    else if (cur.length < 3 && !other.includes(skill)) setD({ ...d, [list]: [...cur, skill] });
  };

  return (
    <>
      <section className="panel">
        <h3>
          Compétences d'espèce — 3 à +5, 3 à +3
          <span className={`adv-total ${d.speciesPlus5.length === 3 && d.speciesPlus3.length === 3 ? 'ok' : 'warn'}`} style={{ marginLeft: 'auto' }}>
            +5 : {d.speciesPlus5.length}/3 · +3 : {d.speciesPlus3.length}/3
          </span>
          <button className="btn small" style={{ marginLeft: 8 }} onClick={() => setD({ ...d, speciesPlus5: sp.skills.slice(0, 3), speciesPlus3: sp.skills.slice(3, 6) })}>
            Défaut
          </button>
        </h3>
        <div className="skill-adv-grid">
          {sp.skills.map((raw) => (
            <div key={raw} className="skill-adv" title={skillTip(raw)}>
              <span>
                {raw}
                {isUnresolvedChoice(raw) && (d.speciesPlus5.includes(raw) || d.speciesPlus3.includes(raw)) && <SpecSelect d={d} setD={setD} raw={raw} />}
              </span>
              <label className="radio" style={{ width: 54 }}>
                <input type="checkbox" checked={d.speciesPlus5.includes(raw)} onChange={() => togglePick('speciesPlus5', raw)} />
                +5
              </label>
              <label className="radio" style={{ width: 54 }}>
                <input type="checkbox" checked={d.speciesPlus3.includes(raw)} onChange={() => togglePick('speciesPlus3', raw)} />
                +3
              </label>
            </div>
          ))}
        </div>

        <h3 style={{ marginTop: 16 }}>Talents d'espèce</h3>
        <div className="talent-choices">
          {sp.talents.map((entry) => {
            const options = splitTopLevelOu(entry);
            if (options.length > 1) {
              return (
                <label key={entry}>
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
            return (
              <span key={entry} className="tag talent" title={talentTip(entry)}>
                {entry}
              </span>
            );
          })}
        </div>
        <div className="skill-tags" style={{ marginTop: 8 }}>
          {resolved.map((label) => (
            <span key={label} className="tag talent" title={talentTip(label)}>
              {label}
            </span>
          ))}
        </div>
        {/* Specs des talents aléatoires « (un au choix) » tirés : modifiables (le tirage reste figé). */}
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
              <label key={label}>
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
      </section>

      <section className="panel">
        <h3>
          Compétences de carrière
          <span className={`adv-total ${total === 40 ? 'ok' : 'warn'}`} style={{ marginLeft: 'auto' }}>
            {total}/40 · max 10
          </span>
        </h3>
        <div className="skill-adv-grid">
          {entries.map((raw) => (
            <div key={raw} className="skill-adv" title={skillTip(raw)}>
              <span>
                {raw}
                {isUnresolvedChoice(raw) && (d.skillAdvances[raw] ?? 0) > 0 && <SpecSelect d={d} setD={setD} raw={raw} />}
              </span>
              <Stepper
                value={d.skillAdvances[raw] ?? 0}
                max={Math.min(10, (d.skillAdvances[raw] ?? 0) + (40 - total))}
                onChange={(v) => setD({ ...d, skillAdvances: { ...d.skillAdvances, [raw]: v } })}
              />
            </div>
          ))}
        </div>
        <button className="btn small" style={{ marginTop: 8 }} onClick={() => setD({ ...d, skillAdvances: Object.fromEntries((draftLevel(d)?.skills ?? []).map((s) => [s, 5])) })}>
          Répartition simple : +5 sur les 8 Compétences du Niveau
        </button>
      </section>

      <section className="panel">
        <h3>Talent de carrière (un au choix)</h3>
        <div className="talent-choices">
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
      </section>
    </>
  );
}

// ── 5) Possessions (LDB 05 l.559-585) ──
function StepTrappings({ d, setD }: StepProps) {
  const level = draftLevel(d);
  const klass = classes.find((c) => c.label === findCareer(d.careerLabel)?.class);
  const wealth = draftWealth(d);
  const careerTrappings = level?.trappings ?? [];
  return (
    <>
      <section className="panel">
        <h3>Équipement de Classe ({klass?.label ?? '—'})</h3>
        <ul className="hint">{(klass?.trappings ?? []).map((t) => <li key={t}>{t}</li>)}</ul>
      </section>
      <section className="panel">
        <h3>Équipement de Carrière ({level?.label ?? '—'})</h3>
        <ul className="hint">
          {careerTrappings.map((t) =>
            t === 'Arme (Au choix)' ? (
              <li key={t}>
                Arme (au choix){' '}
                <select
                  value={d.specChoices[t] ?? ''}
                  onChange={(e) => setD({ ...d, specChoices: { ...d.specChoices, [t]: e.target.value }, weaponChoice: e.target.value })}
                >
                  <option value="">— choisir —</option>
                  {WEAPON_CHOICES.map((w) => (
                    <option key={w} value={w}>
                      {w}
                    </option>
                  ))}
                </select>
              </li>
            ) : (
              <li key={t}>{t}</li>
            ),
          )}
        </ul>
      </section>
      <section className="panel">
        <h3>Richesse initiale</h3>
        <p className="hint">
          Statut <b>{level?.status}</b> — Bronze : 2d10 sous × Standing · Argent : 1d10 pistoles × Standing · Or : 1 CO × Standing (LDB 05). Le jet est figé.
        </p>
        <p>
          Bourse de départ : <b>{formatMoney(wealth)}</b> (créditée au groupe)
        </p>
      </section>
    </>
  );
}

// ── 6) Détails (LDB 05 l.587-744) ──
function StepDetails({ d, setD }: StepProps) {
  const appearance: Appearance = { species: d.speciesLabel, sex: d.sex, build: d.build, seed: d.appSeed, colors: d.colors, parts: d.parts };
  return (
    <>
      <section className="panel">
        <h3>Identité</h3>
        <label>
          Nom
          <input value={d.name} onChange={(e) => setD({ ...d, name: e.target.value })} placeholder="Nom du personnage" />
        </label>
        <label>
          Motivation <em style={{ opacity: 0.7 }}>(redonne de la Détermination en jeu, LDB 05)</em>
          <input value={d.motivation} onChange={(e) => setD({ ...d, motivation: e.target.value })} placeholder="Ex. Devoir, Vengeance, Rebelle…" />
        </label>
        <label>
          Ambition à court terme
          <input value={d.ambitionShort} onChange={(e) => setD({ ...d, ambitionShort: e.target.value })} placeholder="Ex. Venger un camarade tombé au combat…" />
        </label>
        <label>
          Ambition à long terme
          <input value={d.ambitionLong} onChange={(e) => setD({ ...d, ambitionLong: e.target.value })} placeholder="Ex. Posséder un relais de diligences…" />
        </label>
      </section>
      <section className="panel">
        <h3>
          Détails physiques
          <button
            className="btn small"
            style={{ marginLeft: 'auto' }}
            onClick={() => {
              const r = rolledDetails(d);
              setD({ ...d, age: r.age, height: r.height, eyes: r.eyes, hair: r.hair });
            }}
          >
            🎲 Tirer (âge, taille, yeux, cheveux — tables LDB)
          </button>
        </h3>
        <div className="char-edit-grid">
          <label className="char-edit">
            <span style={{ width: 70 }}>Âge</span>
            <input type="number" value={d.age ?? ''} onChange={(e) => setD({ ...d, age: Number(e.target.value) || undefined })} />
          </label>
          <label className="char-edit">
            <span style={{ width: 70 }}>Taille</span>
            <input type="number" value={d.height ?? ''} onChange={(e) => setD({ ...d, height: Number(e.target.value) || undefined })} />
          </label>
          <label className="char-edit">
            <span style={{ width: 70 }}>Yeux</span>
            <input value={d.eyes ?? ''} onChange={(e) => setD({ ...d, eyes: e.target.value })} />
          </label>
          <label className="char-edit">
            <span style={{ width: 70 }}>Cheveux</span>
            <input value={d.hair ?? ''} onChange={(e) => setD({ ...d, hair: e.target.value })} />
          </label>
        </div>
      </section>
      <section className="panel">
        <h3>Apparence</h3>
        <AppearancePanel
          value={appearance}
          equip={{ weapons: [], armour: [] }}
          career={d.careerLabel}
          onChange={(a) => setD({ ...d, sex: a.sex, build: a.build, appSeed: a.seed ?? d.appSeed, colors: a.colors, parts: a.parts })}
        />
      </section>
    </>
  );
}

// ── 7) Récapitulatif ──
function StepRecap({ d }: { d: CreatorDraft }) {
  const hero = useMemo(() => previewHero(d), [d]);
  const wealth = draftWealth(d);
  return (
    <>
      <section className="panel">
        <h3>PX bonus de création (LDB 04/05)</h3>
        <ul className="hint">
          <li>Espèce aléatoire acceptée : +{speciesXp(d)} PX</li>
          <li>Carrière aléatoire : +{careerXp(d)} PX</li>
          <li>Caractéristiques : +{charsXp(d)} PX</li>
        </ul>
        <p>
          Ces PX se dépensent ensuite dans la fiche (onglet Avancement), d'abord dans votre Niveau de Carrière (LDB 05
          « Progression »). Richesse initiale : <b>{formatMoney(wealth)}</b>, créditée au groupe.
        </p>
      </section>
      <section className="panel">
        <h3>Détails</h3>
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
        <p className="hint">La fiche complète (Caractéristiques, Compétences, Talents, équipement) est dans la colonne de gauche.</p>
      </section>
    </>
  );
}
