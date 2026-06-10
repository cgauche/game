/**
 * Assistant de création de personnage (LDB 04/05 « Personnage ») — remplace le POC.
 * Étapes : Espèce → Carrière → Caractéristiques → Compétences & Talents → Possessions →
 * Détails → Récapitulatif. La logique (tirages figés, bonus de PX, validation, construction)
 * vit dans ./draft.ts (pur) ; ici uniquement le rendu et le câblage store.
 */
import { useMemo, useState } from 'react';
import { useGame } from '../../state/store';
import { species as allSpecies, careersForSpecies, classes, findCareer, findTalent } from '../../data';
import { CHAR_KEYS, CharKey, CHAR_LABELS, CHAR_BY_LABEL, Combatant } from '../../engine/types';
import { maxWounds } from '../../engine/characteristics';
import { formatMoney } from '../../engine/money';
import { AppearancePanel } from '../AppearancePanel';
import { CharCard } from '../CharCard';
import type { Appearance } from '../../gameIso/rig/appearance';
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
  xpTotal,
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

/** Espèces jouables principales (mises en avant) — labels exacts de la base. */
const CORE = ['Humains (Reiklander)', 'Nains', 'Halflings', 'Hauts elfes', 'Elfes sylvains'];

/** Choix proposés pour le trapping « Arme (Au choix) » (labels existants de trappings.json). */
const WEAPON_CHOICES = ['Arme simple', 'Dague', 'Couteau', 'Bâton de combat', 'Lance', 'Marteau de guerre', 'Hallebarde'];

function XpChip({ value, label }: { value: number; label: string }) {
  return (
    <span className="hint" style={{ color: value > 0 ? 'var(--gold)' : undefined }}>
      {label} : <b>+{value} PX</b>
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

  return (
    <div className="screen creator">
      <header className="bar">
        <button className="btn small" onClick={() => setScreen('party')}>
          ← Groupe
        </button>
        <h2>Créateur de personnage</h2>
        <span className="hint">
          PX bonus de création : <b>{xpTotal(d)}</b>
        </span>
      </header>

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

      <div className="creator-body wizard-body">
        {step === 0 && <StepSpecies d={d} setD={setD} />}
        {step === 1 && <StepCareer d={d} setD={setD} />}
        {step === 2 && <StepCharacteristics d={d} setD={setD} />}
        {step === 3 && <StepSkillsTalents d={d} setD={setD} />}
        {step === 4 && <StepTrappings d={d} setD={setD} />}
        {step === 5 && <StepDetails d={d} setD={setD} />}
        {step === 6 && <StepRecap d={d} />}
      </div>

      <footer className="bar">
        <button className="btn" disabled={step === 0} onClick={() => setStep(step - 1)}>
          ← Précédent
        </button>
        <span className={`hint ${err ? 'warn' : ''}`} style={{ flex: 1, color: err ? 'var(--gold)' : undefined }}>
          {err ?? (step < STEPS.length - 1 ? '' : 'Prêt !')}
        </span>
        {step < STEPS.length - 1 ? (
          <button className="btn btn-primary" disabled={!canNext} onClick={() => setStep(step + 1)}>
            Suivant →
          </button>
        ) : (
          <button className="btn btn-primary" disabled={party.length >= 4 || !canNext} onClick={create}>
            Créer l'aventurier
          </button>
        )}
      </footer>
    </div>
  );
}

type StepProps = { d: CreatorDraft; setD: (d: CreatorDraft) => void };

// ── 1) Espèce (LDB 04 l.84-90) ──
function StepSpecies({ d, setD }: StepProps) {
  const speciesList = useMemo(
    () => [...allSpecies].sort((a, b) => (CORE.includes(b.label) ? 1 : 0) - (CORE.includes(a.label) ? 1 : 0)),
    [],
  );
  const sp = draftSpecies(d);
  return (
    <>
      <section className="panel">
        <h3>Choisir une espèce</h3>
        <label>
          Espèce
          <select value={d.speciesLabel} onChange={(e) => setD(withSpecies(d, e.target.value))}>
            {speciesList.map((s) => (
              <option key={s.label} value={s.label}>
                {CORE.includes(s.label) ? '★ ' : ''}
                {s.label}
              </option>
            ))}
          </select>
        </label>
        <div className="derived">
          <span>
            Mouvement <b>{sp.movement}</b>
          </span>
          <span>
            Destin <b>{sp.fate.fate}</b> · Résilience <b>{sp.fate.resilience}</b> · à répartir <b>{sp.fate.extra}</b>
          </span>
        </div>
        <p className="hint">{sp.desc?.replace(/<[^>]+>/g, ' ').slice(0, 320)}…</p>
      </section>
      <section className="panel">
        <h3>… ou tirer au hasard (+20 PX)</h3>
        <p className="hint">
          « Lancez un d100 sur le Tableau des Races aléatoires et gagnez 20 PX si vous acceptez le premier résultat. »
          (LDB 04). Le tirage est unique : pas de relance.
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
            <p className="hint">Choisir une autre espèce reste possible, sans bonus.</p>
          </>
        )}
        <div style={{ marginTop: 10 }}>
          <XpChip value={speciesXp(d)} label="Bonus espèce" />
        </div>
      </section>
    </>
  );
}

// ── 2) Carrière (LDB 05 l.186-365) ──
function StepCareer({ d, setD }: StepProps) {
  const sp = draftSpecies(d);
  const list = careersForSpecies(sp.refCareer, d.ignoreRestrictions);
  const career = list.find((c) => c.label === d.careerLabel) ?? list[0];
  return (
    <>
      <section className="panel">
        <h3>Choisir une carrière</h3>
        <label className="radio" style={{ marginBottom: 10 }}>
          <input
            type="checkbox"
            checked={d.ignoreRestrictions}
            onChange={(e) => setD({ ...d, ignoreRestrictions: e.target.checked })}
          />
          Ignorer les restrictions d'espèce (« Mais je veux jouer un elfe sylvain Flagellant ! », LDB 05 — accord du MJ)
        </label>
        <label>
          Carrière ({list.length} accessibles aux {sp.label})
          <select value={d.careerLabel} onChange={(e) => setD(withCareer(d, e.target.value))}>
            {list.map((c) => (
              <option key={c.label} value={c.label}>
                {c.label} ({c.class})
              </option>
            ))}
          </select>
        </label>
        {career && <p className="hint">{career.desc?.replace(/<[^>]+>/g, ' ').slice(0, 320)}…</p>}
        {draftLevel(d) && (
          <div className="derived">
            <span>
              Niveau 1 : <b>{draftLevel(d)!.label}</b>
            </span>
            <span>
              Statut <b>{draftLevel(d)!.status}</b>
            </span>
          </div>
        )}
      </section>
      <section className="panel">
        <h3>… ou tirer au hasard</h3>
        <p className="hint">
          1ᵉʳ jet accepté : +50 PX. Sinon 2 jets de plus et choix parmi les 3 : +25 PX. Sinon choix libre ou relances : +0 PX
          (LDB 05).
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
                Jet {i + 1} : {r.roll} → <b>{r.label}</b>
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
        <div style={{ marginTop: 10 }}>
          <XpChip value={careerXp(d)} label="Bonus carrière" />
        </div>
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
  const wounds = maxWounds(chars, sp.small ? 'petite' : /ogre/i.test(sp.label) ? 'grande' : 'moyenne');

  return (
    <>
      <section className="panel">
        <h3>Méthode</h3>
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
        <div style={{ marginTop: 10 }}>
          <XpChip value={charsXp(d)} label="Bonus caractéristiques" />
        </div>
        <div className="derived" style={{ marginTop: 10 }}>
          <span>
            Blessures <b>{wounds}</b>
          </span>
          <span>
            Mouvement <b>{sp.movement}</b>
          </span>
        </div>
      </section>

      <section className="panel">
        <h3>Caractéristiques (base d'espèce incluse)</h3>
        {d.charMode === 'pointBuy' && (
          <p className={`adv-total ${pbTotal === 100 ? 'ok' : 'warn'}`}>Points répartis : {pbTotal}/100</p>
        )}
        <div className="char-edit-grid">
          {CHAR_KEYS.map((k, i) => (
            <label key={k} className="char-edit" title={CHAR_LABELS[k]}>
              <span>{k}</span>
              {d.charMode === 'rolled' && <b style={{ width: 64, textAlign: 'center' }}>{chars[k]}</b>}
              {d.charMode === 'reassigned' && (
                <select
                  value={d.assignment[k]}
                  onChange={(e) => {
                    const idx = Number(e.target.value);
                    // Échange avec la Caractéristique qui tenait ce jet (permutation garantie).
                    const holder = CHAR_KEYS.find((kk) => d.assignment[kk] === idx)!;
                    setD({ ...d, assignment: { ...d.assignment, [k]: idx, [holder]: d.assignment[k] } });
                  }}
                >
                  {rolls.map((r, j) => (
                    <option key={j} value={j}>
                      {r}
                    </option>
                  ))}
                </select>
              )}
              {d.charMode === 'pointBuy' && (
                <input
                  type="number"
                  min={4}
                  max={18}
                  value={d.pointBuy[k]}
                  onChange={(e) => setD({ ...d, pointBuy: { ...d.pointBuy, [k]: Number(e.target.value) || 0 } })}
                />
              )}
              <em>
                base {sp.baseChar[k] ?? 20}
                {d.charMode === 'rolled' ? ` + ${rolls[i]}` : d.charMode === 'reassigned' ? ` + ${rolls[d.assignment[k]]} = ${chars[k]}` : ` + ${d.pointBuy[k]} = ${chars[k]}`}
              </em>
            </label>
          ))}
        </div>
      </section>

      <section className="panel">
        <h3>Augmentations & Destin</h3>
        <p className={`adv-total ${allocTotal === 5 ? 'ok' : 'warn'}`}>
          5 Augmentations gratuites sur les Caractéristiques de carrière (LDB 05) : {allocTotal}/5
        </p>
        <div className="skill-adv-grid">
          {careerCharKeys.map((k) => (
            <label key={k} className="skill-adv">
              <span>{CHAR_LABELS[k]}</span>
              <input
                type="number"
                min={0}
                max={5}
                value={d.charAdvancesAlloc[k] ?? 0}
                onChange={(e) =>
                  setD({ ...d, charAdvancesAlloc: { ...d.charAdvancesAlloc, [k]: Math.max(0, Number(e.target.value) || 0) } })
                }
              />
            </label>
          ))}
        </div>
        <p className={`adv-total ${d.fateSplit.fate + d.fateSplit.resilience === sp.fate.extra ? 'ok' : 'warn'}`} style={{ marginTop: 12 }}>
          Points supplémentaires Destin/Résilience : {d.fateSplit.fate + d.fateSplit.resilience}/{sp.fate.extra}
        </p>
        <div className="skill-adv-grid">
          <label className="skill-adv">
            <span>Destin (base {sp.fate.fate})</span>
            <input
              type="number"
              min={0}
              max={sp.fate.extra}
              value={d.fateSplit.fate}
              onChange={(e) => setD({ ...d, fateSplit: { ...d.fateSplit, fate: Math.max(0, Number(e.target.value) || 0) } })}
            />
          </label>
          <label className="skill-adv">
            <span>Résilience (base {sp.fate.resilience})</span>
            <input
              type="number"
              min={0}
              max={sp.fate.extra}
              value={d.fateSplit.resilience}
              onChange={(e) => setD({ ...d, fateSplit: { ...d.fateSplit, resilience: Math.max(0, Number(e.target.value) || 0) } })}
            />
          </label>
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
          <button
            className="btn small"
            style={{ marginLeft: 'auto' }}
            onClick={() => setD({ ...d, speciesPlus5: sp.skills.slice(0, 3), speciesPlus3: sp.skills.slice(3, 6) })}
          >
            Défaut
          </button>
        </h3>
        <div className="skill-adv-grid">
          {sp.skills.map((raw) => (
            <div key={raw} className="skill-adv" style={{ display: 'flex' }}>
              <span>
                {raw}
                {isUnresolvedChoice(raw) && (d.speciesPlus5.includes(raw) || d.speciesPlus3.includes(raw)) && (
                  <SpecSelect d={d} setD={setD} raw={raw} />
                )}
              </span>
              <label className="radio" style={{ width: 56 }}>
                <input type="checkbox" checked={d.speciesPlus5.includes(raw)} onChange={() => togglePick('speciesPlus5', raw)} />
                +5
              </label>
              <label className="radio" style={{ width: 56 }}>
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
              <span key={entry} className="hint">
                {entry}
              </span>
            );
          })}
        </div>
        <p className="hint" style={{ marginTop: 8 }}>
          Talents obtenus : <b>{resolved.join(', ') || '—'}</b>
        </p>
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
                <select
                  value={d.randomSpecPicks[name] ?? spec}
                  onChange={(e) => setD({ ...d, randomSpecPicks: { ...d.randomSpecPicks, [name]: e.target.value } })}
                >
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
        <h3>Compétences de carrière — 40 Augmentations</h3>
        <p className={`adv-total ${total === 40 ? 'ok' : 'warn'}`}>Total : {total}/40 (max 10 par Compétence)</p>
        <div className="skill-adv-grid">
          {entries.map((raw) => (
            <label key={raw} className="skill-adv">
              <span>
                {raw}
                {isUnresolvedChoice(raw) && (d.skillAdvances[raw] ?? 0) > 0 && <SpecSelect d={d} setD={setD} raw={raw} />}
              </span>
              <input
                type="number"
                min={0}
                max={10}
                value={d.skillAdvances[raw] ?? 0}
                onChange={(e) =>
                  setD({ ...d, skillAdvances: { ...d.skillAdvances, [raw]: Math.max(0, Math.min(10, Number(e.target.value) || 0)) } })
                }
              />
            </label>
          ))}
        </div>
        <button
          className="btn small"
          style={{ marginTop: 8 }}
          onClick={() => setD({ ...d, skillAdvances: Object.fromEntries((draftLevel(d)?.skills ?? []).map((s) => [s, 5])) })}
        >
          Répartition simple : +5 sur les 8 Compétences du Niveau
        </button>
      </section>

      <section className="panel">
        <h3>Talent de carrière (un au choix)</h3>
        <div className="talent-choices">
          {careerTalentOptions(d).map(({ entry, choices, selected, maxed }) => (
            <label key={entry} className="radio" style={{ flexWrap: 'wrap' }}>
              <input
                type="radio"
                name="career-talent"
                disabled={!selected || maxed}
                checked={!!selected && d.careerTalent === selected}
                onChange={() => selected && setD({ ...d, careerTalent: selected })}
              />
              {entry}
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
              {!maxed && selected && probe.talents.some((t) => t.name === selected) && (
                <em className="hint">déjà possédé via l'espèce → passera ×2</em>
              )}
            </label>
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
          Statut <b>{level?.status}</b> — Bronze : 2d10 sous × Standing · Argent : 1d10 pistoles × Standing · Or : 1 CO ×
          Standing (LDB 05). Le jet est figé.
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
          Motivation
          <input value={d.motivation} onChange={(e) => setD({ ...d, motivation: e.target.value })} placeholder="Ex. Devoir, Vengeance…" />
        </label>
        <label>
          Ambition à court terme
          <input value={d.ambitionShort} onChange={(e) => setD({ ...d, ambitionShort: e.target.value })} placeholder="Ex. Venger un camarade…" />
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
            🎲 Tirer (âge, taille, yeux, cheveux)
          </button>
        </h3>
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
      </section>
      <section className="panel">
        <h3>Apparence</h3>
        <AppearancePanel
          value={appearance}
          equip={{ weapons: [], armour: [] }}
          career={d.careerLabel}
          onChange={(a) => {
            setD({ ...d, sex: a.sex, build: a.build, appSeed: a.seed ?? d.appSeed, colors: a.colors, parts: a.parts });
          }}
        />
      </section>
    </>
  );
}

// ── 7) Récapitulatif ──
function StepRecap({ d }: { d: CreatorDraft }) {
  const hero: Combatant | null = useMemo(() => {
    try {
      return buildHero(d, 'preview');
    } catch {
      return null;
    }
  }, [d]);
  const wealth = draftWealth(d);
  return (
    <>
      <section className="panel">
        <h3>Fiche</h3>
        {hero ? <CharCard hero={hero} /> : <p className="hint">Des choix restent à faire (revenez aux étapes en alerte).</p>}
      </section>
      <section className="panel">
        <h3>PX bonus de création (LDB 04/05)</h3>
        <ul className="hint">
          <li>Espèce aléatoire acceptée : +{speciesXp(d)} PX</li>
          <li>Carrière aléatoire : +{careerXp(d)} PX</li>
          <li>Caractéristiques : +{charsXp(d)} PX</li>
        </ul>
        <p>
          Total : <b>{xpTotal(d)} PX</b> — à dépenser dans la fiche (onglet Avancement), d'abord dans votre Niveau de
          Carrière (LDB 05 « Progression »).
        </p>
        <p>
          Richesse initiale : <b>{formatMoney(wealth)}</b>
        </p>
      </section>
      <section className="panel">
        <h3>Talents & Compétences retenus</h3>
        <p className="hint">Talents : {hero ? hero.talents.map((t) => (t.times > 1 ? `${t.name} ×${t.times}` : t.name)).join(', ') : '—'}</p>
        <p className="hint">
          Compétences :{' '}
          {hero
            ? hero.skills
                .filter((s) => s.advances > 0)
                .map((s) => `${s.name}${s.spec ? ` (${s.spec})` : ''} +${s.advances}`)
                .join(', ')
            : '—'}
        </p>
      </section>
    </>
  );
}
