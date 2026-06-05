import { useMemo, useState } from 'react';
import { useGame } from '../state/store';
import { species as allSpecies, careers as allCareers, firstLevel } from '../data';
import { createHero, parseSkillRef, rollCharacteristics } from '../engine/character';
import { maxWounds } from '../engine/characteristics';
import { makeRNG } from '../engine/dice';
import { CHAR_KEYS, CharKey, CHAR_LABELS, Characteristics } from '../engine/types';
import { AppearancePanel } from './AppearancePanel';
import type { Appearance } from '../gameIso/rig/appearance';

/** Espèces jouables principales (mises en avant) — labels exacts de la base. */
const CORE = ['Humains (Reiklander)', 'Nains', 'Halflings', 'Hauts elfes', 'Elfes sylvains'];

export function CharacterCreator() {
  const party = useGame((s) => s.party);
  const setParty = useGame((s) => s.setParty);
  const setScreen = useGame((s) => s.setScreen);

  const speciesList = useMemo(
    () => [...allSpecies].sort((a, b) => (CORE.includes(b.label) ? 1 : 0) - (CORE.includes(a.label) ? 1 : 0)),
    [],
  );

  const [speciesLabel, setSpeciesLabel] = useState('Humains (Reiklander)');
  const [careerLabel, setCareerLabel] = useState('Soldat');
  const [name, setName] = useState('');
  const [motivation, setMotivation] = useState('');
  const [seed, setSeed] = useState(() => Date.now() & 0xffff);
  const [sex, setSex] = useState<'M' | 'F'>('M');
  const [build, setBuild] = useState(0.5);
  const [appSeed, setAppSeed] = useState(() => (Date.now() >> 4) & 0xffff);
  const [colors, setColors] = useState<Appearance['colors']>(undefined);
  const [chars, setChars] = useState<Characteristics>(() =>
    rollCharacteristics(allSpecies.find((s) => s.label === 'Humains (Reiklander)')!, makeRNG(Date.now() & 0xffff)),
  );

  const sp = allSpecies.find((s) => s.label === speciesLabel)!;
  const appearance: Appearance = { species: speciesLabel, sex, build, seed: appSeed, colors };
  const level = firstLevel(careerLabel);
  const careerSkills = level?.skills ?? [];
  const careerTalents = level?.talents ?? [];

  const [talentChoice, setTalentChoice] = useState(careerTalents[0] ?? '');
  const [skillAdv, setSkillAdv] = useState<Record<string, number>>(() => Object.fromEntries(careerSkills.map((s) => [s, 5])));

  const reroll = (s = seed, label = speciesLabel) => {
    const species = allSpecies.find((x) => x.label === label)!;
    setChars(rollCharacteristics(species, makeRNG(s)));
  };

  const onSpecies = (label: string) => {
    setSpeciesLabel(label);
    reroll(seed, label);
  };
  const onCareer = (label: string) => {
    setCareerLabel(label);
    const lvl = firstLevel(label);
    setSkillAdv(Object.fromEntries((lvl?.skills ?? []).map((s) => [s, 5])));
    setTalentChoice((lvl?.talents ?? [])[0] ?? '');
  };

  const randomAll = () => {
    const rs = allSpecies[Math.floor(Math.random() * Math.min(allSpecies.length, 10))];
    const rc = allCareers[Math.floor(Math.random() * allCareers.length)];
    const newSeed = Date.now() & 0xffff;
    setSeed(newSeed);
    setSpeciesLabel(rs.label);
    setCareerLabel(rc.label);
    const lvl = firstLevel(rc.label);
    setSkillAdv(Object.fromEntries((lvl?.skills ?? []).map((s) => [s, 5])));
    setTalentChoice((lvl?.talents ?? [])[0] ?? '');
    setChars(rollCharacteristics(rs, makeRNG(newSeed)));
  };

  const totalAdv = Object.values(skillAdv).reduce((a, b) => a + b, 0);
  const overCap = Object.values(skillAdv).some((v) => v > 10);
  const wounds = maxWounds(chars, sp.small);

  const create = () => {
    const hero = createHero({
      speciesLabel,
      careerLabel,
      name: name.trim() || 'Aventurier',
      manualChars: chars,
      careerTalent: talentChoice,
      skillAdvances: skillAdv,
      motivation: motivation.trim() || undefined,
    });
    hero.appearance = { species: speciesLabel, sex, build, seed: appSeed, colors };
    setParty([...party, hero]);
    setScreen('party');
  };

  return (
    <div className="screen creator">
      <header className="bar">
        <button className="btn small" onClick={() => setScreen('party')}>
          ← Groupe
        </button>
        <h2>Créateur de personnage</h2>
        <button className="btn" onClick={randomAll}>
          🎲 Aléatoire complet
        </button>
      </header>

      <div className="creator-body">
        <section className="panel">
          <h3>1. Identité</h3>
          <label>
            Nom
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Nom du personnage" />
          </label>
          <label>
            Espèce
            <select value={speciesLabel} onChange={(e) => onSpecies(e.target.value)}>
              {speciesList.map((s) => (
                <option key={s.label} value={s.label}>
                  {CORE.includes(s.label) ? '★ ' : ''}
                  {s.label}
                </option>
              ))}
            </select>
          </label>
          <label>
            Carrière
            <select value={careerLabel} onChange={(e) => onCareer(e.target.value)}>
              {allCareers.map((c) => (
                <option key={c.label} value={c.label}>
                  {c.label} ({c.class})
                </option>
              ))}
            </select>
          </label>
          <label>
            Motivation
            <input value={motivation} onChange={(e) => setMotivation(e.target.value)} placeholder="Ex. Devoir, Vengeance…" />
          </label>
          <div style={{ marginTop: 8 }}>
            <span style={{ fontWeight: 600, display: 'block', marginBottom: 6 }}>Apparence</span>
            <AppearancePanel
              value={appearance}
              equip={{ weapons: [], armour: [] }}
              career={careerLabel}
              onChange={(a) => {
                setSex(a.sex);
                setBuild(a.build);
                if (a.seed != null) setAppSeed(a.seed);
                setColors(a.colors);
              }}
            />
          </div>
          <div className="derived">
            <span>
              Blessures <b>{wounds}</b>
            </span>
            <span>
              Mouvement <b>{sp.movement}</b>
            </span>
            <span>
              Destin <b>{sp.fate.fate}</b> · Résil. <b>{sp.fate.resilience}</b> (+{sp.fate.extra})
            </span>
          </div>
        </section>

        <section className="panel">
          <h3>
            2. Caractéristiques
            <button className="btn small" onClick={() => reroll(Date.now() & 0xffff)} style={{ marginLeft: 'auto' }}>
              🎲 Relancer (2d10 + base)
            </button>
          </h3>
          <div className="char-edit-grid">
            {CHAR_KEYS.map((k: CharKey) => (
              <label key={k} className="char-edit">
                <span title={CHAR_LABELS[k]}>{k}</span>
                <input
                  type="number"
                  value={chars[k]}
                  onChange={(e) => setChars({ ...chars, [k]: Number(e.target.value) || 0 })}
                />
                <em>base {sp.baseChar[k] ?? 20}</em>
              </label>
            ))}
          </div>
          <p className="hint">Tirage = base d'espèce + 2d10. Vous pouvez ajuster manuellement.</p>
        </section>

        <section className="panel">
          <h3>3. Compétences de carrière (40 augmentations)</h3>
          <p className={`adv-total ${totalAdv !== 40 || overCap ? 'warn' : 'ok'}`}>
            Total : {totalAdv}/40 {overCap && '— max 10 par compétence à la création'}
          </p>
          <div className="skill-adv-grid">
            {careerSkills.map((s) => {
              const { name: n, spec } = parseSkillRef(s);
              return (
                <label key={s} className="skill-adv">
                  <span>
                    {n}
                    {spec ? ` (${spec})` : ''}
                  </span>
                  <input
                    type="number"
                    min={0}
                    max={10}
                    value={skillAdv[s] ?? 0}
                    onChange={(e) => setSkillAdv({ ...skillAdv, [s]: Math.max(0, Number(e.target.value) || 0) })}
                  />
                </label>
              );
            })}
          </div>

          <h3 style={{ marginTop: 16 }}>4. Talent de carrière (un au choix)</h3>
          <div className="talent-choices">
            {careerTalents.map((t) => (
              <label key={t} className="radio">
                <input type="radio" name="talent" checked={talentChoice === t} onChange={() => setTalentChoice(t)} />
                {t}
              </label>
            ))}
          </div>
        </section>
      </div>

      <footer className="bar">
        <span className="hint">{sp.desc?.replace(/<[^>]+>/g, ' ').slice(0, 120)}…</span>
        <button className="btn btn-primary" disabled={party.length >= 4} onClick={create}>
          Créer l'aventurier
        </button>
      </footer>
    </div>
  );
}
