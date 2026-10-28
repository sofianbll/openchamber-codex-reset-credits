// src/service/server.ts
import { createServer } from "node:http";

// src/contracts.ts
class Failure extends Error {
  code;
  status;
  constructor(code, status = 502) {
    super(code);
    this.code = code;
    this.status = status;
  }
}
var isRecord = (value) => value !== null && typeof value === "object" && !Array.isArray(value);
var nullableText = (value) => {
  if (value === undefined || value === null)
    return null;
  if (typeof value !== "string" || value.length > 1e4)
    throw new Failure("INVALID_RESPONSE");
  return value;
};
var date = (value) => {
  const text = nullableText(value);
  if (text !== null && !Number.isFinite(Date.parse(text)))
    throw new Failure("INVALID_RESPONSE");
  return text;
};
function parseCredits(payload) {
  if (!isRecord(payload) || !Array.isArray(payload.credits) || payload.credits.length > 1000 || !Number.isSafeInteger(payload.available_count) || Number(payload.available_count) < 0) {
    throw new Failure("INVALID_RESPONSE");
  }
  const seen = new Set;
  const credits = payload.credits.map((credit) => {
    if (!isRecord(credit) || typeof credit.id !== "string" || !credit.id || credit.id.length > 500 || typeof credit.status !== "string" || !credit.status || typeof credit.reset_type !== "string" || !credit.reset_type || seen.has(credit.id))
      throw new Failure("INVALID_RESPONSE");
    seen.add(credit.id);
    return {
      id: credit.id,
      status: credit.status,
      reset_type: credit.reset_type,
      title: nullableText(credit.title),
      description: nullableText(credit.description),
      granted_at: date(credit.granted_at),
      expires_at: date(credit.expires_at)
    };
  });
  return { credits, availableCount: Number(payload.available_count) };
}
function canRedeem(credit, now = Date.now()) {
  return credit.status === "available" && !credit.redemption && (credit.expires_at === null || Date.parse(credit.expires_at) > now);
}
function parseRedeemInput(input) {
  if (!isRecord(input) || input.confirmed !== true || typeof input.credentialID !== "string" || !input.credentialID || input.credentialID.length > 500 || typeof input.creditID !== "string" || !input.creditID || input.creditID.length > 500) {
    throw new Failure("INVALID_REQUEST", 400);
  }
  return { credentialID: input.credentialID, creditID: input.creditID, confirmed: true };
}
function parseRedeemResult(input) {
  if (!isRecord(input) || typeof input.code !== "string" || !/^[a-zA-Z0-9_-]{1,80}$/.test(input.code) || input.windows_reset !== undefined && (!Number.isSafeInteger(input.windows_reset) || Number(input.windows_reset) < 0)) {
    throw new Failure("INVALID_RESPONSE");
  }
  return { code: input.code, windowsReset: input.windows_reset === undefined ? null : Number(input.windows_reset) };
}

// src/service/credits.ts
import { randomUUID } from "node:crypto";

// src/service/accounts.ts
import { execFile } from "node:child_process";
import { homedir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
var exec = promisify(execFile);
var defaultDatabase = join(homedir(), ".local", "share", "opencode", "opencode.db");
var query = `SELECT id, label, active,
  json_extract(value, '$.access') AS access,
  json_extract(value, '$.metadata.accountID') AS accountID
  FROM credential
  WHERE integration_id = 'openai' AND json_extract(value, '$.type') = 'oauth'
  ORDER BY time_created, id;`;
async function readAccounts(database = defaultDatabase) {
  let rows;
  try {
    const { stdout } = await exec("sqlite3", ["-readonly", "-json", database, query], {
      timeout: 5000,
      maxBuffer: 2 * 1024 * 1024
    });
    rows = stdout.trim() ? JSON.parse(stdout) : [];
  } catch (error) {
    throw new Failure(isRecord(error) && error.code === "ENOENT" ? "SQLITE_MISSING" : "DATABASE_UNAVAILABLE", 503);
  }
  if (!Array.isArray(rows))
    throw new Failure("DATABASE_SCHEMA", 503);
  return rows.map((row) => {
    if (!isRecord(row) || typeof row.id !== "string" || typeof row.label !== "string" || typeof row.access !== "string" || !row.access || row.active !== 0 && row.active !== 1 || row.accountID !== null && typeof row.accountID !== "string")
      throw new Failure("DATABASE_SCHEMA", 503);
    return { id: row.id, label: row.label, active: row.active === 1, access: row.access, accountID: row.accountID };
  });
}

// src/service/credits.ts
var backend = "https://chatgpt.com/backend-api/wham/rate-limit-reset-credits";
function createCreditsService(deps = { accounts: readAccounts, fetch: globalThis.fetch, now: Date.now }) {
  let cached = null;
  let loading = null;
  let revision = 0;
  const attempts = new Map;
  const key = (account, creditID) => JSON.stringify([account.accountID, creditID]);
  async function request(account, body) {
    if (!account.accountID)
      throw new Failure("ACCOUNT_ID_MISSING", 409);
    let response;
    try {
      response = await deps.fetch(body ? `${backend}/consume` : backend, {
        method: body ? "POST" : "GET",
        redirect: "error",
        signal: AbortSignal.timeout(8000),
        headers: {
          Authorization: `Bearer ${account.access}`,
          "ChatGPT-Account-Id": account.accountID,
          "User-Agent": "openchamber-codex-reset-credits",
          ...body ? { "Content-Type": "application/json" } : {}
        },
        ...body ? { body: JSON.stringify(body) } : {}
      });
    } catch {
      throw new Failure("CODEX_UNREACHABLE");
    }
    if (!response.ok) {
      const code = response.status === 401 ? "SIGN_IN_REQUIRED" : response.status === 403 ? "ACCESS_DENIED" : response.status === 429 ? "RATE_LIMITED" : response.status === 404 ? "NOT_SUPPORTED" : "CODEX_ERROR";
      throw new Failure(code);
    }
    try {
      return await response.json();
    } catch {
      throw new Failure("INVALID_RESPONSE");
    }
  }
  const creditsFor = async (account) => parseCredits(await request(account));
  function annotate(account, credits) {
    return credits.map((credit) => {
      const redemption = attempts.get(key(account, credit.id));
      return redemption ? { ...credit, redemption } : credit;
    });
  }
  async function list(force = false) {
    if (loading)
      return loading;
    if (!force && cached && deps.now() - Date.parse(cached.fetchedAt) < 30000)
      return cached;
    const started = revision;
    const operation = (async () => {
      const accounts = await deps.accounts();
      const results = await Promise.all(accounts.map(async (account) => {
        const visible = { id: account.id, label: account.label, active: account.active };
        try {
          const result = await creditsFor(account);
          return { ...visible, credits: annotate(account, result.credits), availableCount: result.availableCount, error: null };
        } catch (error) {
          return { ...visible, credits: null, availableCount: null, error: error instanceof Failure ? error.code : "CODEX_ERROR" };
        }
      }));
      const snapshot = { fetchedAt: new Date(deps.now()).toISOString(), accounts: results };
      if (started !== revision) {
        loading = null;
        return list(true);
      }
      cached = snapshot;
      return snapshot;
    })().finally(() => {
      if (loading === operation)
        loading = null;
    });
    loading = operation;
    return operation;
  }
  async function redeem(body) {
    const input = parseRedeemInput(body);
    const account = (await deps.accounts()).find((candidate) => candidate.id === input.credentialID);
    if (!account)
      throw new Failure("ACCOUNT_NOT_FOUND", 404);
    if (!account.accountID)
      throw new Failure("ACCOUNT_ID_MISSING", 409);
    const target = key(account, input.creditID);
    if (attempts.has(target))
      throw new Failure("ALREADY_REQUESTED", 409);
    attempts.set(target, "pending");
    cached = null;
    revision++;
    let sent = false;
    try {
      const { credits } = await creditsFor(account);
      const credit = credits.find((item) => item.id === input.creditID);
      if (!credit || !canRedeem(credit, deps.now()))
        throw new Failure("CREDIT_UNAVAILABLE", 409);
      sent = true;
      const response = await request(account, { credit_id: input.creditID, redeem_request_id: randomUUID() });
      const result = parseRedeemResult(response);
      attempts.set(target, "requested");
      return result;
    } catch (error) {
      if (sent) {
        attempts.set(target, "unknown");
        throw new Failure("REDEMPTION_UNKNOWN", 409);
      }
      attempts.delete(target);
      throw error;
    } finally {
      cached = null;
      revision++;
    }
  }
  return { list, redeem };
}

// src/service/server.ts
function send(response, status, data) {
  response.writeHead(status, { "Content-Type": "application/json", "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" });
  response.end(JSON.stringify(data));
}
async function readBody(request) {
  if (!request.headers["content-type"]?.startsWith("application/json"))
    throw new Failure("INVALID_REQUEST", 400);
  let size = 0;
  const chunks = [];
  for await (const chunk of request) {
    size += chunk.length;
    if (size <= 4096)
      chunks.push(chunk);
  }
  if (size > 4096)
    throw new Failure("INVALID_REQUEST", 413);
  try {
    return JSON.parse(Buffer.concat(chunks).toString());
  } catch {
    throw new Failure("INVALID_REQUEST", 400);
  }
}
function createServiceServer(token, service = createCreditsService()) {
  if (!token)
    throw new Error("A service token is required");
  const server = createServer(async (request, response) => {
    if (request.headers.authorization !== `Bearer ${token}`) {
      send(response, 401, { error: "UNAUTHORIZED" });
      return;
    }
    try {
      const url = new URL(request.url ?? "/", "http://127.0.0.1");
      if (request.method === "GET" && url.pathname === "/health")
        send(response, 200, { ok: true });
      else if (request.method === "GET" && url.pathname === "/accounts")
        send(response, 200, await service.list(url.searchParams.get("refresh") === "1"));
      else if (request.method === "POST" && url.pathname === "/redeem")
        send(response, 200, await service.redeem(await readBody(request)));
      else
        send(response, 404, { error: "NOT_FOUND" });
    } catch (error) {
      send(response, error instanceof Failure ? error.status : 500, { error: error instanceof Failure ? error.code : "SERVICE_ERROR" });
    }
  });
  server.requestTimeout = 20000;
  server.headersTimeout = 1e4;
  return server;
}

// src/service/main.ts
var port = Number(process.env.OPENCHAMBER_SERVICE_PORT);
var token = process.env.OPENCHAMBER_SERVICE_TOKEN;
if (!Number.isInteger(port) || port < 1 || port > 65535 || !token) {
  throw new Error("OPENCHAMBER_SERVICE_PORT and OPENCHAMBER_SERVICE_TOKEN are required");
}
createServiceServer(token).listen(port, "127.0.0.1");
