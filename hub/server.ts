import crypto from 'crypto';
import fs from 'fs';
import http from 'http';
import path from 'path';
import { fileURLToPath } from 'url';
import { createImageLabApp } from '../modules/image-lab/server-app';

type ExpressApp = (req: http.IncomingMessage, res: http.ServerResponse) => void;

const HUB_HOST = '127.0.0.1';
const HUB_PORT = Number(process.env.BRAHMA_HUB_PORT) || 47821;
const HUB_VERSION = '1.0.0';
const hubDir = path.dirname(fileURLToPath(import.meta.url));
const dataDir = path.join(hubDir, 'data');
const tokenFile = path.join(dataDir, 'hub-token.txt');

fs.mkdirSync(dataDir, { recursive: true });
process.chdir(dataDir);

const loadToken = (): string => {
  const fromEnv = (process.env.BRAHMA_HUB_TOKEN || '').trim();
  if (fromEnv) return fromEnv;
  try {
    const existing = fs.readFileSync(tokenFile, 'utf8').trim();
    if (existing) return existing;
  } catch {}
  const token = crypto.randomBytes(24).toString('hex');
  fs.writeFileSync(tokenFile, `${token}\n`, { encoding: 'utf8', mode: 0o600 });
  return token;
};

const HUB_TOKEN = loadToken();

const allowedOrigin = (origin: string | undefined) => {
  if (!origin) return true;
  if (origin.startsWith('chrome-extension://')) return true;
  if (origin === `http://${HUB_HOST}:${HUB_PORT}`) return true;
  if (origin === `http://localhost:${HUB_PORT}`) return true;
  return false;
};

const setCors = (origin: string | undefined, res: http.ServerResponse) => {
  if (origin) res.setHeader('Access-Control-Allow-Origin', origin);
  res.setHeader('Vary', 'Origin');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Brahma-Token');
  res.setHeader('Access-Control-Expose-Headers', 'Content-Disposition, Content-Length');
  res.setHeader('Access-Control-Max-Age', '86400');
};

const sendJson = (res: http.ServerResponse, status: number, payload: unknown) => {
  if (res.writableEnded) return;
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(payload));
};

const validToken = (provided: string) => {
  const a = Buffer.from(provided);
  const b = Buffer.from(HUB_TOKEN);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
};

const start = async () => {
  const imageLabApp = (await createImageLabApp()) as unknown as ExpressApp;

  const server = http.createServer((req, res) => {
    const origin = typeof req.headers.origin === 'string' ? req.headers.origin : undefined;
    const requestUrl = new URL(req.url || '/', `http://${HUB_HOST}:${HUB_PORT}`);

    if (!allowedOrigin(origin)) {
      setCors(origin, res);
      sendJson(res, 403, { error: 'Origin not allowed. Use the Brahma extension.' });
      return;
    }

    setCors(origin, res);

    if (req.method === 'OPTIONS') {
      res.statusCode = 204;
      res.end();
      return;
    }

    const headerToken = req.headers['x-brahma-token'];
    const providedToken = String(
      (Array.isArray(headerToken) ? headerToken[0] : headerToken) || requestUrl.searchParams.get('token') || ''
    );

    if (!validToken(providedToken)) {
      sendJson(res, 401, {
        error: 'Unauthorized. Add the Brahma Hub token in Settings.',
        code: 'hub_token_required',
      });
      return;
    }

    if (requestUrl.pathname === '/api/hub/health' || requestUrl.pathname === '/api/hub/info') {
      sendJson(res, 200, {
        status: 'ok',
        service: 'Brahma Hub',
        version: HUB_VERSION,
        port: HUB_PORT,
        capabilities: ['image-lab'],
      });
      return;
    }

    imageLabApp(req, res);
  });

  server.listen(HUB_PORT, HUB_HOST, () => {
    console.log('');
    console.log('Brahma Hub is running.');
    console.log(`  URL:   http://${HUB_HOST}:${HUB_PORT}`);
    console.log(`  Token: ${HUB_TOKEN}`);
    console.log(`  Token file: ${tokenFile}`);
    console.log('');
    console.log('Paste the token into Brahma Settings -> Brahma Hub.');
    console.log('Keep this window open while using Image Lab. Press Ctrl+C to stop.');
    console.log('');
  });

  const shutdown = () => {
    server.close(() => process.exit(0));
    setTimeout(() => process.exit(0), 2000).unref();
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
};

start().catch((err) => {
  console.error('Failed to start Brahma Hub:', err);
  process.exit(1);
});
