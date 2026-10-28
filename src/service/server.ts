import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { Failure } from '../contracts.ts';
import { createCreditsService } from './credits.ts';

function send(response: ServerResponse, status: number, data: unknown) {
  response.writeHead(status, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' });
  response.end(JSON.stringify(data));
}

async function readBody(request: IncomingMessage): Promise<unknown> {
  if (!request.headers['content-type']?.startsWith('application/json')) throw new Failure('INVALID_REQUEST', 400);
  let size = 0;
  const chunks: Buffer[] = [];
  for await (const chunk of request) {
    size += chunk.length;
    if (size <= 4096) chunks.push(chunk);
  }
  if (size > 4096) throw new Failure('INVALID_REQUEST', 413);
  try { return JSON.parse(Buffer.concat(chunks).toString()); } catch { throw new Failure('INVALID_REQUEST', 400); }
}

export function createServiceServer(token: string, service = createCreditsService()) {
  if (!token) throw new Error('A service token is required');
  const server = createServer(async (request, response) => {
    if (request.headers.authorization !== `Bearer ${token}`) {
      send(response, 401, { error: 'UNAUTHORIZED' });
      return;
    }
    try {
      const url = new URL(request.url ?? '/', 'http://127.0.0.1');
      if (request.method === 'GET' && url.pathname === '/health') send(response, 200, { ok: true });
      else if (request.method === 'GET' && url.pathname === '/accounts') send(response, 200, await service.list(url.searchParams.get('refresh') === '1'));
      else if (request.method === 'POST' && url.pathname === '/redeem') send(response, 200, await service.redeem(await readBody(request)));
      else send(response, 404, { error: 'NOT_FOUND' });
    } catch (error) {
      send(response, error instanceof Failure ? error.status : 500, { error: error instanceof Failure ? error.code : 'SERVICE_ERROR' });
    }
  });
  server.requestTimeout = 20_000;
  server.headersTimeout = 10_000;
  return server;
}
