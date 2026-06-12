/**
 * Worker relay coop : POST /rooms crée une room (code 6 chars + token hôte),
 * GET /room/:code (upgrade WS) route vers le Durable Object de la room.
 */
import { makeCode } from './roomLogic';
export { Room } from './room';

interface Env {
  ROOM: DurableObjectNamespace;
}

// Le jeu est servi depuis cgauche.github.io → le POST cross-origin a besoin de CORS.
const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    const url = new URL(req.url);
    if (req.method === 'OPTIONS') return new Response(null, { headers: CORS });

    if (req.method === 'POST' && url.pathname === '/rooms') {
      for (let i = 0; i < 5; i++) {
        const code = makeCode(Math.random);
        const stub = env.ROOM.get(env.ROOM.idFromName(code));
        const res = await stub.fetch('https://do/init', { method: 'POST' });
        if (res.ok) {
          const { hostToken } = (await res.json()) as { hostToken: string };
          return Response.json({ code, hostToken }, { headers: CORS });
        }
        // 409 = collision de code (room existante) → on retire
      }
      return new Response('service occupé, réessayez', { status: 503, headers: CORS });
    }

    const m = url.pathname.match(/^\/room\/([A-Z0-9]{6})$/);
    if (m && req.headers.get('Upgrade') === 'websocket') {
      const stub = env.ROOM.get(env.ROOM.idFromName(m[1]));
      return stub.fetch(req);
    }
    return new Response('not found', { status: 404 });
  },
} satisfies ExportedHandler<Env>;
