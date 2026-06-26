/**
 * Éditeurs STRUCTURÉS du Codex (lot E2) — sortent du repli `json` brut les champs « objet » /
 * « tableau d'objets » des datasets éditables, sur le MÊME patron que les éditeurs déjà en place
 * (filtrer le champ inféré + rendre un composant dédié au-dessus du formulaire). Tous réutilisent :
 *  - `RefField` (lot E1) pour les parties RÉFÉRENCE (compétence/talent/possession par id, +spec/+count) ;
 *  - le patron de LIGNES `RefField`/`GameOpEditor` (rangée + ✕ + « +Ajouter ») — pas de re-roll maison.
 * On édite les VRAIS objets de `src/data/*.json` (rien de transformé) → la donnée stockée reste celle
 * que le moteur lit (DiseaseSymptom / CombatFeature / AdvancementRef / TrappingRef).
 */
import { RefField } from './RefField';
import { datasetArray } from '../../data/overrides';
import { DIFFICULTY_LABELS, CHAR_KEYS, CHAR_LABELS, type Difficulty, type CharKey } from '../../engine/types';
import type { DiseaseSymptom } from '../../engine/disease';
import { formatDice, parseDice } from '../../engine/dice';
import type { CombatFeature, CastingKind } from '../../engine/combatFeatures/types';
import type { AdvancementRef, TrappingRef, Ref, CountSpec, DomainData, HarvestRarity, HarvestDanger, TalentTest, TestMatch } from '../../data';
import { ConditionEditor } from '../editor/ConditionEditor';
import type { TraitInstance } from '../../engine/statEntry';
import { parseTraitInstance, formatTrait } from '../../engine/traits/dispatch';
import { GameOpEditor } from '../editor/GameOpEditor';
import type { GameOp } from '../../engine/ops';

const DIFFICULTIES = Object.keys(DIFFICULTY_LABELS) as Difficulty[];

/* ─────────────────────────────────────────────────────────────────────────────
 * 1) maladies.symptoms — DiseaseSymptom[] = { symptomId, severity?, difficulty? }
 *    Le symptomId RÉFÉRENCE un symptôme de `symptoms.json` (catalogue éditable au Codex).
 * ──────────────────────────────────────────────────────────────────────────── */

export function SymptomsField({ value, onChange }: { value: DiseaseSymptom[] | undefined; onChange: (v: DiseaseSymptom[]) => void }) {
  const list = value ?? [];
  const syms = datasetArray('symptoms'); // catalogue live (id + label) — un nouveau symptôme apparaît tout seul
  const set = (i: number, patch: Partial<DiseaseSymptom>) => onChange(list.map((s, j) => (j === i ? { ...s, ...patch } : s)));
  return (
    <div className="ed-field">
      <span>symptômes (LDB 20 — chacun = un symptôme du catalogue + sévérité/difficulté éventuelles)</span>
      {list.map((s, i) => (
        <div className="de-reflrow" key={i}>
          <select value={s.symptomId} onChange={(e) => set(i, { symptomId: e.target.value })}>
            {syms.map((sym) => <option key={sym.id} value={sym.id}>{sym.label}</option>)}
          </select>
          <select value={s.severity ?? ''} onChange={(e) => set(i, { severity: (e.target.value || undefined) as DiseaseSymptom['severity'] })}>
            <option value="">— sévérité —</option>
            <option value="moderee">Modérée</option>
            <option value="grave">Grave</option>
          </select>
          <select value={s.difficulty ?? ''} onChange={(e) => set(i, { difficulty: (e.target.value || undefined) as Difficulty | undefined })}>
            <option value="">— difficulté —</option>
            {DIFFICULTIES.map((d) => <option key={d} value={d}>{DIFFICULTY_LABELS[d]}</option>)}
          </select>
          <button className="btn small danger" title="Retirer le symptôme" onClick={() => onChange(list.filter((_, j) => j !== i))}>✕</button>
        </div>
      ))}
      <button className="btn small" onClick={() => onChange([...list, { symptomId: syms[0]?.id ?? 'malaise' }])}>+ Symptôme</button>
    </div>
  );
}

/** symptoms[].onTick — Test de cycle quotidien d'un symptôme : difficulté + conséquence GameOp `onFail`
 *  (ex. Blessé → contractDisease 'blessure-purulente'). Difficulté vide = pas de Test de cycle. */
export function SymptomTickField({ value, onChange }: { value: { difficulty: Difficulty; onFail: GameOp[] } | undefined; onChange: (v: { difficulty: Difficulty; onFail: GameOp[] } | undefined) => void }) {
  return (
    <div className="ed-field">
      <span>Test de cycle quotidien (Blessé / Toxine) — difficulté + conséquence GameOp en cas d'échec</span>
      <select value={value?.difficulty ?? ''} onChange={(e) => onChange(e.target.value ? { difficulty: e.target.value as Difficulty, onFail: value?.onFail ?? [] } : undefined)}>
        <option value="">— aucun Test de cycle —</option>
        {DIFFICULTIES.map((d) => <option key={d} value={d}>{DIFFICULTY_LABELS[d]}</option>)}
      </select>
      {value && <GameOpEditor ops={value.onFail ?? []} onChange={(ops) => onChange({ difficulty: value.difficulty, onFail: ops })} />}
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────────────
 * 1bis) talents.test — { raw verbatim, matches: TestMatch[] } (LDB 10 : +DR sur un Test lié)
 *    `raw` = la ligne « Tests : » du livre (affichage) ; `matches` = la règle STRUCTURÉE id-based
 *    (skill XOR char, spec / « au choix » / sauf-spec, contexte `when` mécanisable, `manual` narratif).
 * ──────────────────────────────────────────────────────────────────────────── */

export function TalentTestField({ value, onChange }: { value: TalentTest | undefined; onChange: (v: TalentTest | undefined) => void }) {
  const raw = value?.raw ?? '';
  const matches = value?.matches ?? [];
  const skillsList = datasetArray('skills');
  const emit = (r: string, m: TestMatch[]) => onChange(r || m.length ? { raw: r, matches: m } : undefined);
  const setM = (i: number, patch: Partial<TestMatch>) => emit(raw, matches.map((x, j) => (j === i ? { ...x, ...patch } : x)));
  return (
    <div className="ed-field">
      <span>Tests liés (LDB 10 : +1 DR/niveau sur un Test lié RÉUSSI) — « raw » = ligne du livre (affichage, verbatim) ; « matches » = règle structurée</span>
      <input value={raw} placeholder="ligne « Tests : » du livre (verbatim)" onChange={(e) => emit(e.target.value, matches)} />
      {matches.map((m, i) => (
        <div key={i}>
          <div className="de-reflrow">
            <select value={m.char != null ? '@char' : (m.skill ?? '')} onChange={(e) => {
              const v = e.target.value;
              if (v === '@char') setM(i, { skill: undefined, spec: undefined, specFromInstance: undefined, exceptSpec: undefined, char: CHAR_KEYS[0] });
              else setM(i, { char: undefined, skill: v });
            }}>
              <option value="">— compétence —</option>
              {skillsList.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
              <option value="@char">▸ Caractéristique…</option>
            </select>
            {m.char != null && (
              <select value={m.char} onChange={(e) => setM(i, { char: e.target.value as CharKey })}>
                {CHAR_KEYS.map((ck) => <option key={ck} value={ck}>{CHAR_LABELS[ck]}</option>)}
              </select>
            )}
            {m.skill != null && !m.specFromInstance && (
              <input value={m.spec ?? ''} placeholder="spec" title="spécialisation FIXE (Langue (Magick)…)" onChange={(e) => setM(i, { spec: e.target.value || undefined })} />
            )}
            {m.skill != null && (
              <input value={m.exceptSpec ?? ''} placeholder="sauf spec" title="EXCLUT une spécialisation (Linguistique : toute Langue sauf Magick)" onChange={(e) => setM(i, { exceptSpec: e.target.value || undefined })} />
            )}
            {m.skill != null && (
              <label title="« (Au choix) » : matche la spécialisation CHOISIE du talent (Métier (Au choix)…)">
                <input type="checkbox" checked={!!m.specFromInstance} onChange={(e) => setM(i, { specFromInstance: e.target.checked || undefined, spec: undefined })} /> au choix
              </label>
            )}
            <label title="contexte NARRATIF inmécanisable → advisory, JAMAIS appliqué automatiquement">
              <input type="checkbox" checked={!!m.manual} onChange={(e) => setM(i, { manual: e.target.checked || undefined })} /> manuel
            </label>
            <button className="btn small danger" title="Retirer ce Test lié" onClick={() => emit(raw, matches.filter((_, j) => j !== i))}>✕</button>
          </div>
          {m.when ? (
            <div className="de-reflrow" style={{ marginLeft: 16 }}>
              <span>quand :</span>
              <ConditionEditor cond={m.when} onChange={(c) => setM(i, { when: c })} />
              <button className="btn small danger" title="Retirer le contexte" onClick={() => setM(i, { when: undefined })}>✕</button>
            </div>
          ) : (
            <button className="btn small" style={{ marginLeft: 16 }} title="Contexte de combat mécanisable (Condition)" onClick={() => setM(i, { when: { kind: 'engaged' } })}>+ contexte (when)</button>
          )}
        </div>
      ))}
      <button className="btn small" onClick={() => emit(raw, [...matches, { skill: skillsList[0]?.id ?? '' }])}>+ Test lié</button>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────────────
 * 2) talents.combat — CombatFeature partiel : ~40 drapeaux booléens + champs spéciaux
 * ──────────────────────────────────────────────────────────────────────────── */

/** Clés NON-booléennes de `CombatFeature` (rendues par des contrôles dédiés) — le RESTE est traité
 *  génériquement comme un drapeau booléen. Source unique pour ne PAS les compter comme des cases. */
const COMBAT_NON_BOOL = new Set<keyof CombatFeature>(['offHandPenalty', 'attackModes', 'castingKind', 'reverseFailed']);

/** Drapeaux booléens de `CombatFeature` (LDB 10) — DÉRIVÉS de la donnée existante (union des clés
 *  présentes dans `talents.json`, moins les clés spéciales) → un nouveau drapeau câblé dans la donnée
 *  s'édite tout seul, aucun libellé codé à la main. Le LABEL affiché est la clé (le type est la doc). */
function combatBoolKeys(all: (Partial<CombatFeature> | undefined)[]): (keyof CombatFeature)[] {
  const keys = new Set<keyof CombatFeature>();
  for (const c of all) if (c) for (const k of Object.keys(c) as (keyof CombatFeature)[]) if (!COMBAT_NON_BOOL.has(k)) keys.add(k);
  return [...keys].sort((a, b) => a.localeCompare(b));
}

const CASTING_KINDS: CastingKind[] = ['mineure', 'arcane', 'invocation', 'beni', 'chaos'];

export function CombatField(
  { value, onChange, allFeatures }:
  { value: Partial<CombatFeature> | undefined; onChange: (v: Partial<CombatFeature> | undefined) => void; allFeatures: (Partial<CombatFeature> | undefined)[] },
) {
  const c = value ?? {};
  // Patch CREUX : on ne stocke QUE les drapeaux à `true` et les champs spéciaux renseignés (pas de
  // `false`/`undefined` qui alourdiraient le JSON). Objet vide → champ supprimé (undefined).
  const emit = (next: Partial<CombatFeature>) => {
    const clean: Partial<CombatFeature> = {};
    for (const [k, v] of Object.entries(next)) if (v !== undefined && v !== false) (clean as Record<string, unknown>)[k] = v;
    onChange(Object.keys(clean).length ? clean : undefined);
  };
  const boolKeys = combatBoolKeys([...allFeatures, c]);
  const offHand = c.offHandPenalty;
  return (
    <div className="ed-field">
      <span>capacité de combat (drapeaux LDB 10 — n'afficher/stocker que les actifs)</span>
      <div className="de-grid de-flags">
        {boolKeys.map((k) => (
          <label className="ed-check" key={k}>
            <input type="checkbox" checked={!!c[k]} onChange={(e) => emit({ ...c, [k]: e.target.checked || undefined })} />
            <span>{k}</span>
          </label>
        ))}
      </div>
      <div className="tf-row">
        <label className="dr">Famille d'incantation
          <select value={c.castingKind ?? ''} onChange={(e) => emit({ ...c, castingKind: (e.target.value || undefined) as CastingKind | undefined })}>
            <option value="">— (aucune) —</option>
            {CASTING_KINDS.map((ck) => <option key={ck} value={ck}>{ck}</option>)}
          </select>
        </label>
      </div>
      <div className="ed-subfield">
        <span>Modes d'attaque ajoutés (ex. dual-wield)</span>
        {(c.attackModes ?? []).map((mode, i) => (
          <div className="de-reflrow" key={i}>
            <input value={mode} onChange={(e) => emit({ ...c, attackModes: (c.attackModes ?? []).map((m, j) => (j === i ? e.target.value : m)) })} />
            <button className="btn small danger" title="Retirer" onClick={() => { const next = (c.attackModes ?? []).filter((_, j) => j !== i); emit({ ...c, attackModes: next.length ? next : undefined }); }}>✕</button>
          </div>
        ))}
        <button className="btn small" onClick={() => emit({ ...c, attackModes: [...(c.attackModes ?? []), ''] })}>+ Mode d'attaque</button>
      </div>
      <div className="tf-row">
        <label className="dr"><input type="checkbox" checked={!!offHand} onChange={(e) => emit({ ...c, offHandPenalty: e.target.checked ? { perLevel: 10, zeroAt: 2 } : undefined })} /> Pénalité de main secondaire</label>
        {offHand && (
          <>
            <label className="dr">par niveau<input type="number" value={offHand.perLevel} onChange={(e) => emit({ ...c, offHandPenalty: { ...offHand, perLevel: Number(e.target.value) || 0 } })} /></label>
            <label className="dr">nulle à<input type="number" value={offHand.zeroAt} onChange={(e) => emit({ ...c, offHandPenalty: { ...offHand, zeroAt: Number(e.target.value) || 0 } })} /></label>
          </>
        )}
      </div>
      <div className="tf-row">
        <label className="dr"><input type="checkbox" checked={!!c.reverseFailed} onChange={(e) => emit({ ...c, reverseFailed: e.target.checked ? { skill: datasetArray('skills')[0]?.id ?? '' } : undefined })} /> Inverse un Test raté (Sociable…)</label>
        {c.reverseFailed && (
          <>
            <select value={c.reverseFailed.skill} onChange={(e) => emit({ ...c, reverseFailed: { ...c.reverseFailed!, skill: e.target.value } })}>
              {datasetArray('skills').map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
            </select>
            <input className="dr" placeholder="spec" value={c.reverseFailed.spec ?? ''} onChange={(e) => emit({ ...c, reverseFailed: { ...c.reverseFailed!, spec: e.target.value || undefined } })} />
            <label className="dr">cap DR<input type="number" value={c.reverseFailed.capDR ?? 0} onChange={(e) => emit({ ...c, reverseFailed: { ...c.reverseFailed!, capDR: Number(e.target.value) || undefined } })} /></label>
          </>
        )}
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────────────
 * 3) skills/talents d'avancement — AdvancementRef[] (espèce / niveau de carrière)
 *    union { ref } | { wildcard, specOptions? } | { choice[] } | { random }
 * ──────────────────────────────────────────────────────────────────────────── */

type AdvMode = 'ref' | 'wildcard' | 'choice' | 'random';
const ADV_MODE_LABEL: Record<AdvMode, string> = { ref: 'Réf.', wildcard: 'Joker (Au choix)', choice: 'Choix (A ou B)', random: 'Aléatoire (N)' };
const advMode = (a: AdvancementRef): AdvMode => ('ref' in a ? 'ref' : 'wildcard' in a ? 'wildcard' : 'choice' in a ? 'choice' : 'random');

/** Convertit une entrée vers un autre mode en gardant ce qui se transpose (la réf courante). */
function advTo(a: AdvancementRef, mode: AdvMode): AdvancementRef {
  const cur: Ref = 'ref' in a ? a.ref : 'wildcard' in a ? a.wildcard : { id: '' };
  switch (mode) {
    case 'ref': return { ref: cur };
    case 'wildcard': return { wildcard: cur };
    case 'choice': return { choice: 'choice' in a ? a.choice : [{ ref: cur }] };
    case 'random': return { random: 'random' in a ? a.random : 1 };
  }
}

/** `ds` = dataset cible des réfs (skills OU talents) selon le champ édité. */
export function AdvancementRefField(
  { ds, label, value, onChange }:
  { ds: 'skills' | 'talents'; label: string; value: AdvancementRef[] | undefined; onChange: (v: AdvancementRef[]) => void },
) {
  const list = value ?? [];
  const set = (i: number, a: AdvancementRef) => onChange(list.map((x, j) => (j === i ? a : x)));
  const refCfg = { ds, single: true as const, spec: true as const };
  return (
    <div className="ed-field">
      <span>{label} — emplacements d'avancement (réf / joker / choix / aléatoire)</span>
      {list.map((a, i) => {
        const mode = advMode(a);
        return (
          <div className="ed-subfield" key={i}>
            <div className="de-reflrow">
              <select value={mode} onChange={(e) => set(i, advTo(a, e.target.value as AdvMode))}>
                {(Object.keys(ADV_MODE_LABEL) as AdvMode[]).map((m) => <option key={m} value={m}>{ADV_MODE_LABEL[m]}</option>)}
              </select>
              <button className="btn small danger" title="Retirer l'emplacement" onClick={() => onChange(list.filter((_, j) => j !== i))}>✕</button>
            </div>
            {'ref' in a && (
              <RefField cfg={refCfg} fieldKey="réf" value={a.ref} onChange={(v) => set(i, { ref: (v as Ref) ?? { id: '' } })} />
            )}
            {'wildcard' in a && (
              <>
                <RefField cfg={refCfg} fieldKey="joker" value={a.wildcard} onChange={(v) => set(i, { wildcard: (v as Ref) ?? { id: '' }, specOptions: a.specOptions })} />
                <label className="dr">specs restreintes (CSV — vide = « Au choix »)
                  <input value={(a.specOptions ?? []).join(', ')} onChange={(e) => { const opts = e.target.value.split(',').map((s) => s.trim()).filter(Boolean); set(i, { wildcard: a.wildcard, specOptions: opts.length ? opts : undefined }); }} />
                </label>
              </>
            )}
            {'choice' in a && (
              <ChoiceList ds={ds} value={a.choice} onChange={(choice) => set(i, { choice })} />
            )}
            {'random' in a && (
              <label className="dr">nombre aléatoire<input type="number" min={1} value={a.random} onChange={(e) => set(i, { random: Math.max(1, Number(e.target.value) || 1) })} /></label>
            )}
          </div>
        );
      })}
      <button className="btn small" onClick={() => onChange([...list, { ref: { id: '' } }])}>+ Emplacement</button>
    </div>
  );
}

/** Branches d'un `{ choice: AdvancementRef[] }` — chaque branche est elle-même un AdvancementRef
 *  (récursif : on réutilise `AdvancementRefField` borné aux modes ref/joker pour rester lisible). */
function ChoiceList({ ds, value, onChange }: { ds: 'skills' | 'talents'; value: AdvancementRef[]; onChange: (v: AdvancementRef[]) => void }) {
  return (
    <div className="ed-subfield">
      <AdvancementRefField ds={ds} label="branches du choix" value={value} onChange={onChange} />
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────────────
 * 4) trappings (classe / niveau de carrière) — TrappingRef[]
 *    ( Ref & { count? } ) | { text, count? }
 * ──────────────────────────────────────────────────────────────────────────── */

const isText = (t: TrappingRef): t is { text: string; count?: CountSpec } => 'text' in t;

export function TrappingRefField({ value, onChange }: { value: TrappingRef[] | undefined; onChange: (v: TrappingRef[]) => void }) {
  const list = value ?? [];
  const set = (i: number, t: TrappingRef) => onChange(list.map((x, j) => (j === i ? t : x)));
  const refCfg = { ds: 'trappings' as const, single: true as const };
  // Quantité : nombre fixe « (3) » OU jet « (1d10) » — une seule entrée texte, jet si elle contient un d.
  const countOf = (t: TrappingRef): string => (t.count ? ('fixed' in t.count ? String(t.count.fixed) : formatDice(t.count.roll)) : '');
  const parseCount = (s: string): CountSpec | undefined => {
    const v = s.trim();
    if (!v) return undefined;
    const dc = parseDice(v);
    return dc ? { roll: dc } : { fixed: Number(v) || 1 };
  };
  return (
    <div className="ed-field">
      <span>possessions — par id du catalogue (+ quantité) ou texte narratif hors catalogue</span>
      {list.map((t, i) => (
        <div className="ed-subfield" key={i}>
          <div className="de-reflrow">
            <select value={isText(t) ? 'text' : 'ref'} onChange={(e) => set(i, e.target.value === 'text' ? { text: '', count: t.count } : { id: '', count: t.count })}>
              <option value="ref">Réf. (catalogue)</option>
              <option value="text">Texte (narratif)</option>
            </select>
            <label className="dr">quantité<input style={{ width: 80 }} placeholder="3 / 1d10" value={countOf(t)} onChange={(e) => set(i, { ...t, count: parseCount(e.target.value) })} /></label>
            <button className="btn small danger" title="Retirer la possession" onClick={() => onChange(list.filter((_, j) => j !== i))}>✕</button>
          </div>
          {isText(t)
            ? <input placeholder="possession narrative (ex. Pile de prospectus)" value={t.text} onChange={(e) => set(i, { text: e.target.value, count: t.count })} />
            : <RefField cfg={refCfg} fieldKey="possession" value={t.id} onChange={(v) => set(i, { id: typeof v === 'string' ? v : (v as Ref)?.id ?? '', count: t.count })} />}
        </div>
      ))}
      <button className="btn small" onClick={() => onChange([...list, { id: '' }])}>+ Possession</button>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────────────
 * 5) careerLevels.characteristics — CharKey[] (vocabulaire FERMÉ) : multi-sélection
 *    de `CHAR_KEYS` (pas de saisie libre — un id de carac ≠ libellé multilangue).
 * ──────────────────────────────────────────────────────────────────────────── */

export function CharKeysField({ value, onChange }: { value: CharKey[] | undefined; onChange: (v: CharKey[]) => void }) {
  const set = new Set(value ?? []);
  const toggle = (k: CharKey, on: boolean) => {
    const next = new Set(set);
    if (on) next.add(k); else next.delete(k);
    onChange(CHAR_KEYS.filter((c) => next.has(c))); // ordre canon stable, peu importe l'ordre de clic
  };
  return (
    <div className="ed-field">
      <span>caractéristiques avancées (LDB 07 — vocabulaire fermé, cocher celles du Niveau)</span>
      <div className="de-grid de-flags">
        {CHAR_KEYS.map((k) => (
          <label className="ed-check" key={k}>
            <input type="checkbox" checked={set.has(k)} onChange={(e) => toggle(k, e.target.checked)} />
            <span>{k} — {CHAR_LABELS[k]}</span>
          </label>
        ))}
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────────────
 * 6) stars.sub — tuple [number, number] : sous-fourchette d100 (1d10 interne) → min/max.
 * ──────────────────────────────────────────────────────────────────────────── */

export function StarSubField({ value, onChange }: { value: [number, number] | undefined; onChange: (v: [number, number] | undefined) => void }) {
  const on = value != null;
  const lo = value?.[0] ?? 1;
  const hi = value?.[1] ?? 1;
  const clamp = (s: string) => Math.max(1, Math.min(100, Number(s) || 1));
  return (
    <div className="ed-field">
      <span>sous-fourchette du 1d10 interne (Étoile du Sorcier — ADE2) : décocher = signe simple</span>
      <div className="tf-row">
        <label className="dr"><input type="checkbox" checked={on} onChange={(e) => onChange(e.target.checked ? [lo, hi] : undefined)} /> sous-tirage</label>
        {on && (
          <label className="dr">d100&nbsp;
            <input type="number" min={1} max={100} value={lo} onChange={(e) => onChange([clamp(e.target.value), hi])} />–
            <input type="number" min={1} max={100} value={hi} onChange={(e) => onChange([lo, clamp(e.target.value)])} />
          </label>
        )}
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────────────
 * 7) domains.castBonus / missile / afterCast — petits objets d'effet typés.
 *    `castBonus` { perCondition (label État), radiusStat (CharKey fermé), bonus }
 *    `missile`   { bypass ('metal'|'nonMagic'), bonusFromBypass? }
 *    `afterCast` { grantTrait (label de trait + Indice, ex. « Peur 1 »), durationDice }
 *  `grantTrait` reste un LIBELLÉ (parsé par `parseTraitInstance` côté moteur, indice inclus) → input
 *   texte avec autocomplétion des libellés de trait, PAS un RefField (qui stockerait un id sans indice).
 * ──────────────────────────────────────────────────────────────────────────── */

const BYPASS_LABEL: Record<NonNullable<DomainData['missile']>['bypass'], string> = {
  metal: 'PA métalliques', nonMagic: 'PA non magiques',
};

export function DomainEffectsField(
  { castBonus, missile, afterCast, onCastBonus, onMissile, onAfterCast }:
  {
    castBonus: DomainData['castBonus']; missile: DomainData['missile']; afterCast: DomainData['afterCast'];
    onCastBonus: (v: DomainData['castBonus']) => void; onMissile: (v: DomainData['missile']) => void; onAfterCast: (v: DomainData['afterCast']) => void;
  },
) {
  // `grantTrait` = LIBELLÉ + indice (« Peur 1 »), parsé par `parseTraitInstance` → autocomplétion des
  // libellés de trait (champ auto-suffisant, pas de prop plombée) ; pas un RefField (qui perdrait l'indice).
  const traitLabels = (datasetArray('traits') as { label: string }[]).map((t) => t.label);
  const dlTraits = 'dl-domain-grant-traits';
  return (
    <div className="ed-field">
      <span>attributs du domaine (LDB 48 — bonus d'incantation conditionnel / mitigation de Projectile / effet post-incantation)</span>
      <div className="ed-subfield">
        <label className="dr"><input type="checkbox" checked={!!castBonus} onChange={(e) => onCastBonus(e.target.checked ? { perCondition: '', radiusStat: 'FM', bonus: 10 } : undefined)} /> Bonus d'incantation conditionnel</label>
        {castBonus && (
          <div className="tf-row">
            <label className="dr">par État
              <input list="dl-etats" placeholder="ex. En flammes" value={castBonus.perCondition} onChange={(e) => onCastBonus({ ...castBonus, perCondition: e.target.value })} />
            </label>
            <label className="dr">rayon B-carac.
              <select value={castBonus.radiusStat} onChange={(e) => onCastBonus({ ...castBonus, radiusStat: e.target.value as CharKey })}>
                {CHAR_KEYS.map((k) => <option key={k} value={k}>{k}</option>)}
              </select>
            </label>
            <label className="dr">bonus<input type="number" value={castBonus.bonus} onChange={(e) => onCastBonus({ ...castBonus, bonus: Number(e.target.value) || 0 })} /></label>
          </div>
        )}
      </div>
      <div className="ed-subfield">
        <label className="dr"><input type="checkbox" checked={!!missile} onChange={(e) => onMissile(e.target.checked ? { bypass: 'metal' } : undefined)} /> Mitigation de Projectile</label>
        {missile && (
          <div className="tf-row">
            <label className="dr">ignore
              <select value={missile.bypass} onChange={(e) => onMissile({ ...missile, bypass: e.target.value as NonNullable<DomainData['missile']>['bypass'] })}>
                {(Object.keys(BYPASS_LABEL) as NonNullable<DomainData['missile']>['bypass'][]).map((b) => <option key={b} value={b}>{BYPASS_LABEL[b]}</option>)}
              </select>
            </label>
            <label className="dr"><input type="checkbox" checked={!!missile.bonusFromBypass} onChange={(e) => onMissile({ ...missile, bonusFromBypass: e.target.checked || undefined })} /> + ajoute aux Dégâts</label>
          </div>
        )}
      </div>
      <div className="ed-subfield">
        <label className="dr"><input type="checkbox" checked={!!afterCast} onChange={(e) => onAfterCast(e.target.checked ? { grantTrait: '', durationDice: 10 } : undefined)} /> Effet post-incantation (Trait au lanceur)</label>
        {afterCast && (
          <div className="tf-row">
            <label className="dr">Trait octroyé
              <input list={dlTraits} placeholder="ex. Peur 1" value={afterCast.grantTrait ?? ''} onChange={(e) => onAfterCast({ ...afterCast, grantTrait: e.target.value || undefined })} />
              <datalist id={dlTraits}>{traitLabels.map((l) => <option key={l} value={l} />)}</datalist>
            </label>
            <label className="dr">durée 1d<input type="number" min={1} value={afterCast.durationDice ?? 1} onChange={(e) => onAfterCast({ ...afterCast, durationDice: Math.max(1, Number(e.target.value) || 1) })} /></label>
          </div>
        )}
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────────────
 * 8) TraitInstance[] — liste de Traits de créature STRUCTURÉS (édités via la chaîne
 *    réversible `formatTrait` ⇄ `parseTraitInstance`, comme dans StatblockEditor).
 *    PARTAGÉ : StatblockEditor (traits fixes) + Codex `creatures.traits`/`.optionals`.
 *    L'auteur complète l'Indice/la Cible dans la chaîne (« Arme (Épée) +7 », « Peur 3 »).
 * ──────────────────────────────────────────────────────────────────────────── */

/** Suggestions d'autocomplétion : libellés du dataset `traits` (le param libre reste saisi à la main). */
const traitDatalistOptions = (): string[] => (datasetArray('traits') as { label: string }[]).map((t) => t.label);

export function TraitListField(
  { label, hint, value, onChange, suggestions }:
  { label: string; hint?: string; value: TraitInstance[] | undefined; onChange: (v: TraitInstance[]) => void; suggestions?: string[] },
) {
  const list = value ?? [];
  const set = (next: TraitInstance[]) => onChange(next);
  const dlId = `dl-traitlist-${label.replace(/\s+/g, '-')}`;
  const opts = suggestions ?? traitDatalistOptions();
  return (
    <div className="ed-field">
      <span>{label}{hint && <em className="de-hint"> {hint}</em>}</span>
      {list.map((t, i) => (
        <div key={i} className="trait-row">
          <input list={dlId} value={formatTrait(t)} onChange={(e) => set(list.map((x, j) => (j === i ? parseTraitInstance(e.target.value) : x)))} />
          <button className="btn small danger" title="Retirer ce trait" onClick={() => set(list.filter((_, j) => j !== i))}>✕</button>
        </div>
      ))}
      <datalist id={dlId}>{opts.map((o) => <option key={o} value={o} />)}</datalist>
      <button className="btn small" onClick={() => set([...list, { id: 'arme' }])}>+ Ajouter un trait</button>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────────────
 * 9) creatures.harvest — { rarity, danger, uses } (Précieuses Entrailles, ZI).
 *    Deux vocabulaires FERMÉS (selects) + un texte d'usage ; checkbox = présence.
 * ──────────────────────────────────────────────────────────────────────────── */

const HARVEST_RARITIES: HarvestRarity[] = ['Commune', 'Limitée', 'Rare', 'Exotique', 'Unique'];
const HARVEST_DANGERS: HarvestDanger[] = ['Inoffensive', 'Inquiétante', 'Menaçante', 'Mortelle'];

type Harvest = { rarity: HarvestRarity; danger: HarvestDanger; uses: string };

export function HarvestField({ value, onChange }: { value: Harvest | undefined; onChange: (v: Harvest | undefined) => void }) {
  const h = value;
  return (
    <div className="ed-field">
      <span>récolte « Précieuses Entrailles » (ZI — rareté + dangerosité → valeur par Enc, usages des organes)</span>
      <label className="dr"><input type="checkbox" checked={!!h} onChange={(e) => onChange(e.target.checked ? { rarity: 'Commune', danger: 'Inoffensive', uses: '' } : undefined)} /> récoltable</label>
      {h && (
        <>
          <div className="tf-row">
            <label className="dr">Rareté
              <select value={h.rarity} onChange={(e) => onChange({ ...h, rarity: e.target.value as HarvestRarity })}>
                {HARVEST_RARITIES.map((r) => <option key={r} value={r}>{r}</option>)}
              </select>
            </label>
            <label className="dr">Dangerosité
              <select value={h.danger} onChange={(e) => onChange({ ...h, danger: e.target.value as HarvestDanger })}>
                {HARVEST_DANGERS.map((d) => <option key={d} value={d}>{d}</option>)}
              </select>
            </label>
          </div>
          <label className="ed-subfield">Usages (organes, parties prélevées)
            <textarea rows={2} value={h.uses} onChange={(e) => onChange({ ...h, uses: e.target.value })} />
          </label>
        </>
      )}
    </div>
  );
}
