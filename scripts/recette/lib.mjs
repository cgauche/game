// Socle de preuve navigateur headless (agents) — moissonné de scripts scratchpad ad hoc répétés
// (des-v5-verify.mjs, gallery-v2-tour.mjs, repro-399.mjs, dice-reduced-motion.mjs) : CDP nu sur
// Chrome, zéro dépendance nouvelle. Voir docs/recette-navigateur.md § « Preuve headless (agents) ».
import { spawn } from 'node:child_process';
import { writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import os from 'node:os';

export const DEFAULT_URL = 'http://localhost:5173/';
const CHROME_CANDIDATES = [
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
];

/** Attend `ms` millisecondes. */
export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

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
      `d'utiliser le kit de recette (le kit s'ATTACHE, il ne démarre rien). Détail : ${e.message}`
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

/** Lance Chrome headless et attache une session CDP dédiée (targetId + sessionId propres). */
export async function launchSession({ chromePath, width = 1280, height = 900, port, mobile = false } = {}) {
  const cdpPort = port ?? 9222 + Math.floor(Math.random() * 2000);
  const profile = join(os.tmpdir(), `recette-cdp-profile-${Date.now()}-${Math.floor(Math.random() * 1e6)}`);
  mkdirSync(profile, { recursive: true });
  const chrome = spawn(resolveChromePath(chromePath), [
    '--headless=new', `--remote-debugging-port=${cdpPort}`, `--user-data-dir=${profile}`,
    `--window-size=${width},${height}`, '--no-first-run', '--no-default-browser-check', 'about:blank',
  ], { stdio: 'ignore' });

  const wsUrl = await waitForWsUrl(cdpPort);
  const ws = new WebSocket(wsUrl);
  await new Promise((resolve, reject) => { ws.onopen = resolve; ws.onerror = reject; });

  let id = 0;
  const pending = new Map();
  const listeners = new Set();
  ws.addEventListener('message', (ev) => {
    const m = JSON.parse(typeof ev.data === 'string' ? ev.data : ev.data.toString());
    if (m.id && pending.has(m.id)) {
      const { resolve, reject } = pending.get(m.id);
      pending.delete(m.id);
      m.error ? reject(new Error(m.error.message)) : resolve(m.result);
    }
    for (const fn of listeners) fn(m);
  });

  const session = { ws, chrome, listeners, sessionId: null, targetId: null };

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

  /** Ferme le target CDP + tue le process Chrome (toujours appeler en fin de script). */
  session.close = async () => {
    try { await session.rpc('Target.closeTarget', { targetId: session.targetId }); } catch {}
    ws.close();
    chrome.kill();
  };

  return session;
}

/** Évalue une expression JS dans la page (attend les promesses) et lève une erreur lisible si ça throw. */
export async function evaluate(session, expression) {
  const r = await session.rpc('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
  if (r.exceptionDetails) {
    throw new Error(r.exceptionDetails.exception?.description || JSON.stringify(r.exceptionDetails));
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
  await session.rpc('Page.navigate', { url });
  await waitFor(session, `typeof window.__wfrp?.screen === 'function'`, { timeoutMs: 10000 });
  return session;
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
