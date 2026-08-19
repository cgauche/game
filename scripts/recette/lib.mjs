// Socle de preuve navigateur headless (agents) — moissonné de scripts scratchpad ad hoc répétés
// (des-v5-verify.mjs, gallery-v2-tour.mjs, repro-399.mjs, dice-reduced-motion.mjs) : CDP nu sur
// Chrome, zéro dépendance nouvelle. Voir docs/recette-navigateur.md § « Preuve headless (agents) ».
import { spawn, spawnSync } from 'node:child_process';
import { writeFileSync, mkdirSync, existsSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import os from 'node:os';

export const DEFAULT_URL = 'http://localhost:5173/';
const CHROME_CANDIDATES = [
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
];

/** Attend `ms` millisecondes. */
export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** Code porté par tout rejet dû à un rechargement de la page (voir `isNavigationError`). */
export const TARGET_NAVIGATED = 'TARGET_NAVIGATED';

/** Messages CDP émis quand le contexte de page a été recréé sous les pieds de l'appel en vol. */
const NAV_MESSAGES = [
  /Inspected target navigated or closed/i,
  /Execution context was destroyed/i,
  /Cannot find context with specified id/i,
  /Target closed/i,
  /Session with given id not found/i,
  /No target with given id/i,
];

/** Sondes d'app évaporée : un helper `window.__x` posé au chargement redevient `undefined`. */
const CLEARED_GLOBALS = /Cannot read properties of (?:undefined|null) \(reading '[^']+'\)|window\.__\w+ is (?:not a function|undefined)/;

/**
 * Vrai si l'erreur vient d'un rechargement de page (Vite full-reload déclenché par une écriture
 * dans `src/` en cours de recette, #1196) plutôt que d'un défaut du scénario : soit le CDP le dit
 * (`Inspected target navigated or closed`), soit l'évaluation a buté sur un helper de DEV évaporé.
 * Fonction PURE — testable sans navigateur.
 */
export function isNavigationError(err) {
  if (!err) return false;
  if (err.code === TARGET_NAVIGATED) return true;
  const msg = typeof err === 'string' ? err : String(err.message ?? '');
  if (!msg) return false;
  return NAV_MESSAGES.some((re) => re.test(msg)) || CLEARED_GLOBALS.test(msg);
}

/** Fabrique un rejet CATCHABLE typé : les appelants retentent au lieu de mourir. */
function cdpError(message) {
  const e = new Error(message);
  if (isNavigationError(e)) e.code = TARGET_NAVIGATED;
  return e;
}

/**
 * Tue TOUT l'arbre de process Chrome (`chrome.kill()` ne tue que le PID racine — Chrome se
 * découpe en crashpad-handler/gpu-process/renderer×N/utility×N, tous ENFANTS survivants qui
 * gardent le profil temp verrouillé sous Windows, vécu 2026-07-16 sur le ticket #424 : la fuite
 * de handles persistait malgré `chrome.kill()` + retries de `rmSync`). `taskkill /T` (arbre) est
 * la seule primitive Windows fiable ici ; `proc.kill()` reste le filet hors Windows.
 */
function killChromeTree(chrome) {
  if (process.platform === 'win32' && chrome.pid) {
    spawnSync('taskkill', ['/PID', String(chrome.pid), '/T', '/F'], { stdio: 'ignore' });
  } else {
    try { chrome.kill(); } catch {}
  }
}

/**
 * Filet de sécurité process-wide : tout Chrome spawné par ce module qui survivrait à un chemin
 * d'échec non couvert (SIGINT, script tiers oubliant son try/finally) est tué + son profil purgé
 * à la sortie du process — jamais de fuite silencieuse. `process.on('exit')` est SYNCHRONE : on
 * ne peut pas y `await`, `rmSync` reste best-effort en une passe (pas de retry possible ici).
 */
const activeChildren = new Set();
process.on('exit', () => {
  for (const { chrome, profile } of activeChildren) {
    try { killChromeTree(chrome); } catch {}
    try { rmSync(profile, { recursive: true, force: true }); } catch {}
  }
});

function resolveChromePath(explicit) {
  if (explicit) return explicit;
  return CHROME_CANDIDATES.find((p) => existsSync(p)) ?? CHROME_CANDIDATES[0];
}

/** Vérifie que le serveur de dev répond (le kit ne le DÉMARRE jamais) — message d'aide sinon. */
export async function checkServer(url = DEFAULT_URL) {
  try {
    const r = await fetch(url);
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
  } catch (e) {
    throw new Error(
      `Serveur de dev injoignable sur ${url} — lancer "npm run dev" dans un autre terminal avant ` +
      `d'utiliser le kit de recette (le kit s'ATTACHE, il ne démarre rien). Détail : ${e.message}`,
      { cause: e }
    );
  }
}

async function waitForWsUrl(port, timeoutMs = 10000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const r = await fetch(`http://localhost:${port}/json/version`);
      const j = await r.json();
      if (j.webSocketDebuggerUrl) return j.webSocketDebuggerUrl;
    } catch {}
    await sleep(250);
  }
  throw new Error(`Chrome (CDP) indisponible sur le port ${port} après ${timeoutMs}ms.`);
}

/**
 * Supprime le profil temporaire CDP — tolérant : Windows peut retenir des handles quelques
 * instants après `chrome.kill()` (EBUSY/EPERM), on réessaie avant d'abandonner sans jamais lever.
 */
async function removeProfileDir(profile, attempts = 5, delayMs = 200) {
  for (let i = 0; i < attempts; i++) {
    try {
      rmSync(profile, { recursive: true, force: true });
      return;
    } catch {
      await sleep(delayMs);
    }
  }
}

/**
 * Lance Chrome headless et attache une session CDP dédiée (targetId + sessionId propres).
 *
 * Largeur par DÉFAUT = 1600 : c'est la largeur à laquelle les maquettes sont DESSINÉES
 * (`docs/plans/2026-07-14-maquettes-createur/*.html`, `.mock{width:1600px}`) — donc la seule où une
 * capture se compare à l'étalon. Le défaut historique de 1280 a fait juger « étriqués » pendant deux
 * jours des écrans qui rendaient juste à leur largeur de référence (lot « matières & proportions »
 * #393). Une recette MOBILE passe sa largeur explicitement (`setMobileViewport`, 360×740).
 */
export async function launchSession({ chromePath, width = 1600, height = 900, port, mobile = false } = {}) {
  const cdpPort = port ?? 9222 + Math.floor(Math.random() * 2000);
  const profile = join(os.tmpdir(), `recette-cdp-profile-${Date.now()}-${Math.floor(Math.random() * 1e6)}`);
  mkdirSync(profile, { recursive: true });
  const chrome = spawn(resolveChromePath(chromePath), [
    '--headless=new', '--mute-audio', `--remote-debugging-port=${cdpPort}`, `--user-data-dir=${profile}`,
    `--window-size=${width},${height}`, '--no-first-run', '--no-default-browser-check', 'about:blank',
  ], { stdio: 'ignore' });
  const childEntry = { chrome, profile };
  activeChildren.add(childEntry);

  // Tout échec APRÈS le spawn (avant qu'un `session` ne soit rendu à l'appelant, donc avant qu'il
  // puisse appeler `session.close()`) doit tuer ce Chrome et purger son profil ici — sinon fuite.
  try {
    const wsUrl = await waitForWsUrl(cdpPort);
    const ws = new WebSocket(wsUrl);
    await new Promise((resolve, reject) => { ws.onopen = resolve; ws.onerror = reject; });

    let id = 0;
    const pending = new Map();
    const listeners = new Set();
    ws.addEventListener('message', (ev) => {
      const m = JSON.parse(typeof ev.data === 'string' ? ev.data : ev.data.toString());
      if (m.method === 'Runtime.executionContextsCleared' && (!m.sessionId || m.sessionId === session.sessionId)) {
        session.contextCleared = true;
      }
      if (m.id && pending.has(m.id)) {
        const { resolve, reject } = pending.get(m.id);
        pending.delete(m.id);
        if (m.error) reject(cdpError(m.error.message)); else resolve(m.result);
      }
      for (const fn of listeners) fn(m);
    });
    // Socket coupée alors que des appels sont en vol : les rejeter TYPÉS plutôt que de les laisser
    // pendre pour toujours (un `await session.rpc(...)` jamais réglé fige le script sans message).
    ws.addEventListener('close', () => {
      for (const [mid, { reject }] of pending) {
        pending.delete(mid);
        const e = new Error('Inspected target navigated or closed');
        e.code = TARGET_NAVIGATED;
        reject(e);
      }
    });

    const session = { ws, chrome, listeners, sessionId: null, targetId: null, profile, contextCleared: false };

    session.rpc = (method, params = {}) => new Promise((resolve, reject) => {
      const mid = ++id;
      const msg = { id: mid, method, params };
      if (session.sessionId) msg.sessionId = session.sessionId;
      pending.set(mid, { resolve, reject });
      ws.send(JSON.stringify(msg));
    });

    const { targetId } = await session.rpc('Target.createTarget', { url: 'about:blank' });
    session.targetId = targetId;
    const { sessionId } = await session.rpc('Target.attachToTarget', { targetId, flatten: true });
    session.sessionId = sessionId;

    await session.rpc('Page.enable');
    await session.rpc('Runtime.enable');
    await session.rpc('Emulation.setDeviceMetricsOverride', {
      width, height, deviceScaleFactor: 1, mobile,
    });

    /** Ferme le target CDP + tue le process Chrome + purge le profil temp (toujours appeler en fin de script). */
    session.close = async () => {
      try { await session.rpc('Target.closeTarget', { targetId: session.targetId }); } catch {}
      try { ws.close(); } catch {}
      killChromeTree(chrome);
      await removeProfileDir(profile);
      activeChildren.delete(childEntry);
    };

    return session;
  } catch (e) {
    killChromeTree(chrome);
    await removeProfileDir(profile);
    activeChildren.delete(childEntry);
    throw e;
  }
}

/** Évalue une expression JS dans la page (attend les promesses) et lève une erreur lisible si ça throw. */
export async function evaluate(session, expression) {
  const r = await session.rpc('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
  if (r.exceptionDetails) {
    throw cdpError(r.exceptionDetails.exception?.description || JSON.stringify(r.exceptionDetails));
  }
  return r.result.value;
}

/** Attend qu'une expression JS devienne vraie (poll), lève si le délai expire. */
export async function waitFor(session, expression, { timeoutMs = 8000, intervalMs = 200 } = {}) {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    if (await evaluate(session, expression)) return true;
    if (Date.now() >= deadline) throw new Error(`Condition jamais vraie après ${timeoutMs}ms : ${expression}`);
    await sleep(intervalMs);
  }
}

/** Expression d'app prête — `__wfrp.screen` est posé par `installDevtools` (cf. `openApp`). */
const APP_READY = `typeof window.__wfrp?.screen === 'function'`;

/** Attend l'app SANS lever : pendant un rechargement, chaque évaluation peut elle-même échouer. */
async function waitForAppSilently(session, timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    try {
      if (await evaluate(session, APP_READY)) return true;
    } catch {}
    if (Date.now() >= deadline) return false;
    await sleep(250);
  }
}

/**
 * Rejoue `fn` quand la page a été RECHARGÉE sous les pieds du scénario (#1196 : une autre session
 * écrit dans `src/`, Vite full-reload, le contexte de page et ses helpers `window.__*` disparaissent).
 * Entre deux tentatives : on ré-attend l'app, puis `resettle` remet l'écran courant en place.
 * Toute erreur qui n'est PAS une navigation remonte telle quelle (aucun masquage de vrai défaut).
 */
export async function withReloadRetry(session, fn, { tries = 3, resettle, onRetry, timeoutMs = 20000 } = {}) {
  let last;
  for (let i = 0; i < tries; i++) {
    session.contextCleared = false;
    try {
      return await fn();
    } catch (e) {
      if (!isNavigationError(e) && !session.contextCleared) throw e;
      last = e;
      if (i === tries - 1) break;
      if (onRetry) await onRetry(e, i + 1, tries);
      await sleep(500);
      if (!(await waitForAppSilently(session, timeoutMs))) continue;
      if (resettle) {
        try { await resettle(session); } catch (re) { last = re; }
      }
    }
  }
  throw new Error(
    `Rechargement de page pendant la recette : ${tries} tentatives épuisées (dernier échec : ${last?.message ?? last}). ` +
    `arbre src/ en écriture par une autre session ? relancer en fenêtre calme (#1196)`,
    { cause: last },
  );
}

/**
 * Vérifie le serveur, lance Chrome, navigue et attend que `window.__wfrp` soit prêt.
 * `window.__wfrp` existe TÔT (le collecteur d'erreurs le pose en premier, `src/main.tsx`) mais
 * `installDevtools` le RÉASSIGNE en bloc peu après (chargement async, DEV uniquement) — attendre
 * `screen` (helper de navigation) plutôt que la seule présence de `__wfrp` sous peine de courir
 * après un objet encore partiel (`errors`/`exportErrors` seuls).
 */
export async function openApp(url = DEFAULT_URL, opts = {}) {
  await checkServer(url);
  const session = await launchSession(opts);
  try {
    await session.rpc('Page.navigate', { url });
    await waitFor(session, APP_READY, { timeoutMs: 10000 });
    return session;
  } catch (e) {
    await session.close();
    throw e;
  }
}

/** Navigue vers un écran via `__wfrp.screen(name)` — id validé côté app (throw si invalide). */
export async function gotoScreen(session, name, { settleMs = 600 } = {}) {
  await evaluate(session, `window.__wfrp.screen(${JSON.stringify(name)})`);
  await sleep(settleMs);
}

/** Capture un PNG nommé dans `dir` (créé si absent) — retourne le chemin écrit. */
export async function shot(session, name, dir = process.cwd()) {
  mkdirSync(dir, { recursive: true });
  const r = await session.rpc('Page.captureScreenshot', { format: 'png' });
  const path = join(dir, name.endsWith('.png') ? name : `${name}.png`);
  writeFileSync(path, Buffer.from(r.data, 'base64'));
  return path;
}

/**
 * Collecte erreurs/warnings console + exceptions, filtrés sur LA session courante — le CDP
 * multiplexe plusieurs sessions/onglets sur la même connexion, un piège vécu en recette (buffer
 * partagé, cf. docs/recette-navigateur.md « Pièges vécus ») : sans ce filtre par `sessionId`,
 * une 2e session ouverte dans le même process récupère aussi les messages d'une session PRÉCÉDENTE.
 */
export function consoleGuard(session) {
  const entries = [];
  const handler = (m) => {
    if (m.sessionId !== session.sessionId) return;
    if (m.method === 'Runtime.consoleAPICalled' && (m.params.type === 'error' || m.params.type === 'warning')) {
      const text = (m.params.args || []).map((a) => a.value ?? a.description ?? '').join(' ');
      entries.push({ type: m.params.type, text });
    }
    if (m.method === 'Runtime.exceptionThrown') {
      const ex = m.params.exceptionDetails;
      entries.push({ type: 'exception', text: ex.exception?.description || ex.text });
    }
  };
  session.listeners.add(handler);
  return {
    entries,
    errors: () => entries.filter((e) => e.type === 'error' || e.type === 'exception'),
    stop: () => session.listeners.delete(handler),
  };
}

/**
 * Monkey-patch `setTimeout` pour figer une animation le temps d'une capture : les délais fournis
 * (`delays`, dans l'ordre d'appel) remplacent ceux demandés par l'app, le dernier de la liste étant
 * réutilisé pour tout appel excédentaire — passer `[0]` fige tout à l'instantané.
 */
export async function freezeTimeout(session, delays = [0]) {
  await evaluate(session, `(() => {
    if (window.__recetteOrigSetTimeout) return;
    window.__recetteOrigSetTimeout = window.setTimeout.bind(window);
    const forced = ${JSON.stringify(delays)};
    let i = 0;
    window.setTimeout = (fn, ms, ...args) =>
      window.__recetteOrigSetTimeout(fn, forced.length ? forced[Math.min(i++, forced.length - 1)] : ms, ...args);
  })()`);
}

/** Annule `freezeTimeout` — restaure le vrai `setTimeout`. */
export async function unfreezeTimeout(session) {
  await evaluate(session, `(() => {
    if (window.__recetteOrigSetTimeout) {
      window.setTimeout = window.__recetteOrigSetTimeout;
      delete window.__recetteOrigSetTimeout;
    }
  })()`);
}

/** Force `prefers-reduced-motion: reduce` côté page (CDP `Emulation.setEmulatedMedia`). */
export async function emulateReducedMotion(session) {
  await session.rpc('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'reduce' }] });
}

/** Redimensionne le viewport (mobile = largeur ≤ 480px active l'émulation tactile). */
export async function setViewport(session, width, height) {
  await session.rpc('Emulation.setDeviceMetricsOverride', {
    width, height, deviceScaleFactor: 1, mobile: width <= 480,
  });
}

/** Raccourci `setViewport` au format mobile canon (360×740, cf. charte-ui.md — testable dès 360px). */
export async function setMobileViewport(session) {
  await setViewport(session, 360, 740);
}

/**
 * Clique un `<button>`/`[role="button"]` par son TEXTE (sous-chaîne, espaces normalisés) via un
 * VRAI clic CDP (`Input.dispatchMouseEvent`, pas `.click()` JS) — le SEUL pilotage qui traverse les
 * mêmes gestionnaires que la souris (delegation, `pointerdown`…). SCROLL-AWARE : un bouton hors
 * viewport a un rect `{x,y}` qui ne correspond à RIEN de cliquable tant qu'on ne l'a pas fait défiler
 * dans le viewport — lire le rect AVANT `scrollIntoView` fait rater le clic SILENCIEUSEMENT (aucune
 * erreur, juste aucun effet), piège vécu en recette (#514). L'apostrophe est MIXTE selon l'écran
 * (typographique U+2019 ou droite U+0027) — les deux formes sont normalisées vers une seule avant
 * comparaison, texte cherché ET texte DOM (piège vécu, écrans « Tenter un Test d'Athlétisme » vs
 * « Dormir jusqu'à l'aube »).
 */
export async function clickButtonByText(session, texte, { exact = false } = {}) {
  const rect = await evaluate(session, `(() => {
    const norm = (s) => (s || '').replace(/\\s+/g, ' ').replace(/[\\u2019']/g, "'").trim();
    const target = norm(${JSON.stringify(texte)});
    const els = Array.from(document.querySelectorAll('button, [role="button"]'));
    const el = els.find((b) => ${exact} ? norm(b.textContent) === target : norm(b.textContent).includes(target));
    if (!el) return null;
    el.scrollIntoView({ block: 'center', inline: 'center' });
    const r = el.getBoundingClientRect();
    return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
  })()`);
  if (!rect) throw new Error(`clickButtonByText : aucun bouton ne matche « ${texte} »`);
  await session.rpc('Input.dispatchMouseEvent', { type: 'mouseMoved', x: rect.x, y: rect.y });
  await session.rpc('Input.dispatchMouseEvent', { type: 'mousePressed', x: rect.x, y: rect.y, button: 'left', clickCount: 1 });
  await session.rpc('Input.dispatchMouseEvent', { type: 'mouseReleased', x: rect.x, y: rect.y, button: 'left', clickCount: 1 });
  return rect;
}

/** Table des touches courantes non imprimables (`key` DOM → code virtuel Windows CDP). */
const KEY_CODES = {
  Enter: 13, Escape: 27, Tab: 9, Backspace: 8, Delete: 46, ' ': 32, Space: 32,
  ArrowUp: 38, ArrowDown: 40, ArrowLeft: 37, ArrowRight: 39, Home: 36, End: 35,
  PageUp: 33, PageDown: 34,
};

/**
 * Envoie une frappe RÉELLE (`Input.dispatchKeyEvent`, keyDown puis keyUp) — traverse les mêmes
 * handlers que le clavier physique (`keybindings.ts`), contrairement à un `KeyboardEvent` JS
 * synthétique (souvent ignoré par les listeners posés en natif sur `window`).
 */
export async function realKey(session, key) {
  const code = KEY_CODES[key] ?? (key.length === 1 ? key.toUpperCase().charCodeAt(0) : 0);
  const common = { key, code: key.length === 1 ? `Key${key.toUpperCase()}` : key, windowsVirtualKeyCode: code, nativeVirtualKeyCode: code };
  await session.rpc('Input.dispatchKeyEvent', { type: 'rawKeyDown', ...common });
  if (key.length === 1) await session.rpc('Input.dispatchKeyEvent', { type: 'char', text: key, ...common });
  await session.rpc('Input.dispatchKeyEvent', { type: 'keyUp', ...common });
}

/**
 * SAISIE RÉELLE dans un champ (`session, selecteur, texte`) — le pendant clavier de
 * `clickButtonByText`, pour les formulaires que la recette doit remplir AUX GESTES (nom de joueur et
 * code de room du salon coop, `src/ui/CoopLobby.tsx`).
 *
 * Deux étages, tous deux CDP :
 *  1. FOCUS par un VRAI clic (`Input.dispatchMouseEvent` au centre du champ, après `scrollIntoView`) —
 *     la frappe va au champ FOCALISÉ, pas au sélecteur : sans ce clic, `Input.insertText` atterrit
 *     dans l'élément actif du moment (souvent `<body>`), sans erreur ni effet.
 *  2. `Input.insertText` — l'insertion passe par le pipeline d'ÉDITION du navigateur, donc l'`input`
 *     event porte la valeur native et le `onChange` React s'exécute. C'est ce qui la sépare d'un
 *     `evaluate()` + `.value = …`, qui écrit dans le DOM sans réveiller React (piège documenté dans
 *     `docs/recette-navigateur.md`, « Champ CONTRÔLÉ React »).
 *
 * MESURÉ sur le salon coop (Chrome headless du kit, 2026-08-13) : `.coop-code-input` frappé
 * `ab12cd` se lit `AB12CD` — la valeur est donc passée par le `onChange` React
 * (`e.target.value.toUpperCase()`, `CoopLobby.tsx`), pas seulement par le DOM ; et le bouton
 * « Héberger », `disabled` tant que le nom est vide, s'arme après la frappe du champ de nom.
 *
 * `clear` (défaut) sélectionne le contenu existant (`select()` — une SÉLECTION, pas une écriture
 * d'état) pour que l'insertion le remplace ; un champ pré-rempli (code d'invitation `?join=`) se
 * réécrit ainsi sans `Backspace` répétés. Rend la valeur LUE dans le champ après la frappe.
 *
 * AUTO-CONTRÔLE : la valeur relue est comparée au texte demandé. Un `onChange` a le DROIT de la
 * transformer (le code de room passe en majuscules) — un écart n'est donc pas une erreur en soi, et
 * la comparaison par défaut AVERTIT sur `stderr` au lieu de jeter (`console.warn`). Ce qu'elle
 * attrape : la frappe ADDITIVE — un re-render entre `select()` et l'insertion perd la sélection, le
 * texte s'ajoute au lieu de remplacer (`AB12CDab12cd`), et sans ce contrôle seul l'appelant qui relit
 * s'en apercevrait. `attendu` (chaîne ou prédicat) durcit le contrôle en ERREUR quand le site connaît
 * la valeur exacte à obtenir.
 */
export async function typeInField(session, selecteur, texte, { clear = true, attendu } = {}) {
  const rect = await evaluate(session, `(() => {
    const el = document.querySelector(${JSON.stringify(selecteur)});
    if (!el) return null;
    el.scrollIntoView({ block: 'center', inline: 'center' });
    const r = el.getBoundingClientRect();
    return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
  })()`);
  if (!rect) throw new Error(`typeInField : aucun élément ne matche « ${selecteur} »`);
  await session.rpc('Input.dispatchMouseEvent', { type: 'mouseMoved', x: rect.x, y: rect.y });
  await session.rpc('Input.dispatchMouseEvent', { type: 'mousePressed', x: rect.x, y: rect.y, button: 'left', clickCount: 1 });
  await session.rpc('Input.dispatchMouseEvent', { type: 'mouseReleased', x: rect.x, y: rect.y, button: 'left', clickCount: 1 });
  if (clear) await evaluate(session, `(() => { const el = document.querySelector(${JSON.stringify(selecteur)}); el.select ? el.select() : el.setSelectionRange(0, el.value.length); return true; })()`);
  await session.rpc('Input.insertText', { text: texte });
  const lu = await evaluate(session, `document.querySelector(${JSON.stringify(selecteur)}).value`);
  if (attendu !== undefined) {
    const ok = typeof attendu === 'function' ? attendu(lu) : lu === attendu;
    if (!ok) throw new Error(`typeInField « ${selecteur} » : champ à « ${lu} », attendu « ${attendu} » (frappé « ${texte} »)`);
  } else if (lu !== texte) {
    console.warn(`typeInField « ${selecteur} » : champ à « ${lu} » après avoir frappé « ${texte} » — transformation du onChange (casse, filtre) OU frappe additive : contrôler avant de continuer.`);
  }
  return lu;
}

/**
 * CLIC D'UNE CASE DE CONSOLE PAR SON ID D'ACTION (`data-action`, registre `src/data/actions.json`).
 * Le DOM de la console publie l'identité de chaque alvéole : la recette n'a donc plus à viser un
 * libellé (qui bouge avec la donnée) ni une position (qui bouge avec le set au poing).
 *
 * Trois refus EXPLICITES, jamais un clic silencieux qui « n'a rien fait » :
 *  - case ABSENTE (l'action n'est pas offerte dans cette situation) ;
 *  - case GATÉE (`data-gated`/`disabled`) — la RAISON affichée est remontée telle quelle, et le geste
 *    n'est pas forcé : un gate qui se déclenche est un RÉSULTAT de recette, pas un obstacle ;
 *  - case INERTE (`.cc-inert`, action `blocked` du registre) — dite comme telle.
 * Rend `{ actionId, label, rect }` au succès. Même dispatch souris réel que `clickButtonByText`.
 */
export async function cliquerAction(session, actionId, { racine = '.combat-console' } = {}) {
  const etat = await evaluate(session, `(() => {
    const el = document.querySelector(${JSON.stringify('%RACINE% [data-action="%ID%"]')});
    if (!el) {
      const offertes = Array.from(document.querySelectorAll(${JSON.stringify('%RACINE% [data-action]')})).map((b) => b.getAttribute('data-action'));
      return { absente: true, offertes };
    }
    el.scrollIntoView({ block: 'center', inline: 'center' });
    const r = el.getBoundingClientRect();
    const raison = el.querySelector('[data-gate]');
    return {
      gate: el.hasAttribute('data-gated') ? (raison ? raison.textContent.trim() : '(sans raison affichée)') : null,
      inerte: el.classList.contains('cc-inert'),
      disabled: !!el.disabled,
      label: (el.getAttribute('aria-label') || el.textContent || '').trim(),
      x: r.x + r.width / 2, y: r.y + r.height / 2,
    };
  })()`.replace(/%RACINE%/g, racine).replace(/%ID%/g, actionId));
  if (!etat || etat.absente) {
    throw new Error(`cliquerAction « ${actionId} » : aucune case de console ne porte cet id — offertes : ${((etat && etat.offertes) || []).join(', ') || '(aucune)'}`);
  }
  if (etat.gate) throw new Error(`cliquerAction « ${actionId} » : case GATÉE — raison affichée : « ${etat.gate} » (geste non forcé)`);
  if (etat.inerte) throw new Error(`cliquerAction « ${actionId} » : case INERTE (action déclarée sans dispatcher au registre) — rien à cliquer`);
  if (etat.disabled) throw new Error(`cliquerAction « ${actionId} » : case DÉSACTIVÉE (${etat.label}) — la situation ne l'offre pas`);
  await session.rpc('Input.dispatchMouseEvent', { type: 'mouseMoved', x: etat.x, y: etat.y });
  await session.rpc('Input.dispatchMouseEvent', { type: 'mousePressed', x: etat.x, y: etat.y, button: 'left', clickCount: 1 });
  await session.rpc('Input.dispatchMouseEvent', { type: 'mouseReleased', x: etat.x, y: etat.y, button: 'left', clickCount: 1 });
  return { actionId, label: etat.label, rect: { x: etat.x, y: etat.y } };
}

/** Frappe RÉELLE d'une touche — alias FRANÇAIS de `realKey` (même geste, même pipeline CDP). */
export const frapperTouche = realKey;