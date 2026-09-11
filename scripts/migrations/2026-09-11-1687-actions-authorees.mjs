/**
 * Migration #1687 — les ACTIONS AUTHORÉES d'un décor, volet `src/scenes`.
 *
 * DEUX gestes, un seul passage, et le document passe en `schema: 11` :
 *  1. `interact: { flow, consume? }` → `usable.actions: [{ id: 'fouiller', flow, … }]` — la fouille
 *     n'est plus un CHAMP de l'entité, c'est une action du vocabulaire ouvert que l'auteur pose
 *     (`ActionAuthoree`, `src/state/scene.ts`) ; l'entité retirée après le geste garde `consume`, et
 *     celle qui restait « marquée fouillée » devient `unique` (le drapeau `__action_<ent>_<id>`
 *     remplace `__fouille_<ent>`, `cleActionJouee` de `src/state/usable.ts`).
 *  2. `usable: {}` → `usable: { assise: true }` — l'enveloppe VIDE que le passage du 2026-09-10 a
 *     posée sur les meubles à places disait « assise activée » par sa seule PRÉSENCE ; depuis ce lot
 *     elle porte des faits NOMMÉS, et une enveloppe vide n'offre plus rien.
 *
 * POURQUOI : l'offre d'une entité se dérive d'une source UNIQUE (`actionsDe`, `src/state/usable.ts`)
 * et s'exécute par un exécuteur UNIQUE (`jouerAction`, `src/state/store.ts`) ; `interact` était le
 * dernier champ que six lecteurs interrogeaient chacun à sa façon. Sans ce passage, les décors
 * fouillables des campagnes livrées seraient REFUSÉS au parse (`strictObject`, clé inconnue) et les
 * meubles à places redeviendraient muets. Zéro régression est le contrat.
 *
 * AUCUNE chaîne française n'est écrite en donnée : l'action porte l'id `fouiller`, et son libellé
 * vient du catalogue i18n à la clé `usable.fouiller`, résolu à l'AFFICHAGE.
 *
 * ENTRÉES : les `src/scenes/<campagne>/<campagne>-projet.json`.
 * CARDINAL ATTENDU, mesuré sur l'arbre au moment de l'écriture (2026-09-11) : 4 projets, 28 Scènes,
 * 32 décors fouillables, 5 décors à assise — les deux populations sont dites dans la forme d'AVANT
 * comme dans celle d'APRÈS, donc la porte tient aussi sur une reprise.
 * FORMATAGE PRÉSERVÉ : les documents de scène ont leur PROPRE sérialiseur —
 * `JSON.stringify(doc, null, 1) + '\n'`. Forme vérifiée AVANT toute écriture : non canonique =
 * sortie 1, jamais un reflow silencieux.
 * POSITION : `usable` prend la PLACE qu'occupait `interact` (renommage en place, patron `renommeCle`
 * de `src/state/worldMap.ts`) ; une entité qui portait DÉJÀ `usable` garde la place de son enveloppe
 * et y reçoit les actions. Parité avec `PROJECT_MIGRATIONS[10]` mesurée par
 * `src/state/projet-migration-10-vers-11.test.ts`.
 * IDEMPOTENT : rejouée sur l'état final, la migration n'écrit rien et sort 0 (plus aucun `interact`,
 * plus aucune enveloppe vide).
 * BORNE HAUTE CLOSE (`schema` ∈ {10, 11}, jamais « ≥ 10 ») : DERNIÈRE de la chaîne dans l'ordre
 * lexical, elle est la seule à savoir ce qui existe après elle et NOMME un `schema` futur, là où les
 * amont l'avalent par leur borne ouverte — celle de `2026-09-10-1687-usable-sieges.mjs` est ouverte
 * à « ≥ 10 », un document porté plus loin y traverse en NO-OP.
 * FAIL-FAST : `interact` de forme inattendue (clé hors `flow`/`consume`, `flow` absent), `usable` de
 * forme inattendue, `schema` absent, non numérique ou ∉ {10, 11} → rien n'est écrit, sortie 1.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('../../', import.meta.url));
const NOM = '2026-09-11-1687-actions-authorees';
const RACINE = path.join(ROOT, 'src/scenes');

/** Cardinaux mesurés (2026-09-11) — portes d'identité du périmètre. Les deux populations sont
 *  STABLES de part et d'autre du passage (une fouille reste une fouille, une assise une assise),
 *  donc gardées à l'identique sur une reprise : c'est ce qui rend la migration idempotente SANS
 *  relâcher la porte. */
const ATTENDU = { projets: 4, scenes: 28, fouilles: 32, assises: 5 };
/** Forme du document AVANT et APRÈS ce bump — la borne haute est CLOSE (cf. en-tête). */
const SCHEMA_AVANT = 10;
const SCHEMA_APRES = 11;
/** Id CANONIQUE de l'action née d'un ancien `interact` (`ACTION_FOUILLER`, `src/state/usable.ts`). */
const ACTION_FOUILLER = 'fouiller';

/** Forme canonique d'un document de projet de scène. */
const canonique = (doc) => `${JSON.stringify(doc, null, 1)}\n`;

const echecs = [];

/**
 * L'entité MIGRÉE, ou l'entité telle quelle si elle n'est concernée par aucun des deux gestes.
 * Les clés gardent leur ORDRE : `usable` occupe la place de l'`interact` qu'elle remplace.
 */
function migreEntite(ent, ou) {
  const aInteract = ent && typeof ent === 'object' && 'interact' in ent;
  const usableAvant = ent && typeof ent === 'object' ? ent.usable : undefined;
  const aUsable = usableAvant !== undefined;
  if (!aInteract && !aUsable) return { ent, interact: 0, vide: 0 };

  if (aUsable && (!usableAvant || typeof usableAvant !== 'object' || Array.isArray(usableAvant))) {
    echecs.push(`${ou} : \`usable\` de forme inattendue ${JSON.stringify(usableAvant)}`);
    return { ent, interact: 0, vide: 0 };
  }
  // Enveloppe VIDE = assise activée par sa seule présence (passage du 2026-09-10) ; elle se NOMME.
  const vide = aUsable && Object.keys(usableAvant).length === 0;
  const base = vide ? { assise: true } : aUsable ? { ...usableAvant } : {};

  let actions = 0;
  let usable = base;
  if (aInteract) {
    const it = ent.interact;
    const cles = it && typeof it === 'object' && !Array.isArray(it) ? Object.keys(it) : null;
    if (!cles || !it.flow || cles.some((k) => k !== 'flow' && k !== 'consume')) {
      echecs.push(`${ou} : \`interact\` de forme inattendue ${JSON.stringify(cles)}`);
      return { ent, interact: 0, vide: 0 };
    }
    if ((base.actions ?? []).some((a) => a?.id === ACTION_FOUILLER)) {
      echecs.push(`${ou} : \`interact\` ET une action \`${ACTION_FOUILLER}\` déjà authorée — l'id est l'identité de l'action sur l'entité`);
      return { ent, interact: 0, vide: 0 };
    }
    // `consume` = l'entité disparaît (rien à épuiser) ; sinon `unique`, l'état d'aujourd'hui (la
    // fouille sans butin restait, marquée jouée). Le `consume` absent ne s'écrit pas.
    const action = { id: ACTION_FOUILLER, flow: it.flow, ...(it.consume ? { consume: true } : { unique: true }) };
    usable = { ...base, actions: [...(base.actions ?? []), action] };
    actions = 1;
  }

  const sortie = Object.fromEntries(
    Object.entries(ent)
      .filter(([k]) => !(k === 'usable' && aInteract)) // l'enveloppe reprend la place de l'`interact`
      .map(([k, v]) => (k === 'interact' || k === 'usable' ? ['usable', usable] : [k, v])),
  );
  return { ent: sortie, interact: actions, vide: vide ? 1 : 0 };
}

const cibles = fs
  .readdirSync(RACINE, { withFileTypes: true })
  .filter((d) => d.isDirectory())
  .map((d) => path.join(RACINE, d.name, `${d.name}-projet.json`))
  .filter((p) => fs.existsSync(p));

const rapports = [];
let scenesVues = 0;
let interactsVus = 0;
let videsVues = 0;
/** Populations STABLES : une entité qui OFFRE une fouille (avant ou après), une entité ASSISE. */
let fouillesVues = 0;
let assisesVues = 0;

for (const abs of cibles) {
  const rel = path.relative(ROOT, abs).replace(/\\/g, '/');
  const brut = fs.readFileSync(abs, 'utf8');
  const doc = JSON.parse(brut);

  if (canonique(doc) !== brut) { echecs.push(`${rel} : FORME NON CANONIQUE`); continue; }
  if (doc.schema !== SCHEMA_AVANT && doc.schema !== SCHEMA_APRES) {
    echecs.push(`${rel} : \`schema\` inattendu ${JSON.stringify(doc.schema)} (${SCHEMA_AVANT} ou ${SCHEMA_APRES} attendus)`);
    continue;
  }
  if (!Array.isArray(doc.scenes)) { echecs.push(`${rel} : \`scenes\` absent ou non-tableau`); continue; }

  let interacts = 0;
  let vides = 0;
  const scenes = doc.scenes.map((s, i) => {
    scenesVues++;
    if (!Array.isArray(s?.entities)) return s;
    const entities = s.entities.map((e) => {
      if (e && typeof e === 'object') {
        if ('interact' in e || (e.usable?.actions ?? []).some((a) => a?.id === ACTION_FOUILLER)) fouillesVues++;
        if (e.usable && (Object.keys(e.usable).length === 0 || e.usable.assise === true)) assisesVues++;
      }
      const r = migreEntite(e, `${rel} › scenes[${i}] (${s?.id}) › ${e?.id}`);
      interacts += r.interact;
      vides += r.vide;
      return r.ent;
    });
    return { ...s, entities };
  });

  interactsVus += interacts;
  videsVues += vides;
  rapports.push({ rel, abs, brut, doc, scenes, interacts, vides });
}

if (cibles.length !== ATTENDU.projets) echecs.push(`${cibles.length} projet(s) de scène ≠ ${ATTENDU.projets} attendu(s)`);
if (scenesVues !== ATTENDU.scenes) echecs.push(`${scenesVues} Scène(s) embarquée(s) ≠ ${ATTENDU.scenes} attendue(s)`);
if (fouillesVues !== ATTENDU.fouilles) echecs.push(`${fouillesVues} décor(s) fouillable(s) ≠ ${ATTENDU.fouilles} attendu(s)`);
if (assisesVues !== ATTENDU.assises) echecs.push(`${assisesVues} décor(s) à assise ≠ ${ATTENDU.assises} attendu(s)`);

if (echecs.length) {
  console.error(`[${NOM}] ARBITRAGE REQUIS — ${echecs.length} anomalie(s), AUCUNE écriture :`);
  for (const m of echecs) console.error(`  ${m}`);
  process.exit(1);
}

for (const r of rapports) {
  const sortie = Object.fromEntries(
    Object.entries(r.doc).map(([k, v]) => (k === 'scenes' ? [k, r.scenes] : k === 'schema' ? [k, SCHEMA_APRES] : [k, v])),
  );
  const out = canonique(sortie);
  if (out !== r.brut) fs.writeFileSync(r.abs, out, 'utf8');

  // PREUVE post-écriture : plus AUCUN `interact`, plus AUCUNE enveloppe vide, et le document s'annonce.
  const apres = JSON.parse(out);
  const restes = apres.scenes
    .flatMap((s) => (Array.isArray(s.entities) ? s.entities : []))
    .filter((e) => 'interact' in e || (e.usable && Object.keys(e.usable).length === 0))
    .map((e) => e.id);
  if (restes.length || apres.schema !== SCHEMA_APRES) {
    console.error(`[${NOM}] VÉRIFICATION POST-ÉCRITURE ROUGE — ${r.rel} : schema=${apres.schema}, ${restes.join(', ')}`);
    process.exit(1);
  }
  console.log(`[${NOM}] ${r.rel} — schema ${r.doc.schema} → ${apres.schema}, actions authorées nées d'un \`interact\` : ${r.interacts}, enveloppes vides nommées \`assise\` : ${r.vides} (scènes : ${apres.scenes.length}) — fichier ${out !== r.brut ? 'réécrit' : 'INCHANGÉ'}`);
}

console.log(`[${NOM}] TOTAL — ${cibles.length} projet(s), ${scenesVues} Scène(s), ${interactsVus} \`interact\` migré(s), ${videsVues} enveloppe(s) vide(s) nommée(s) ; populations : ${fouillesVues} fouille(s), ${assisesVues} assise(s)`);
