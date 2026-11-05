// Cookie-consent audit trail. Reusable across sites: copy this file next to the
// site's Worker, set the SITE var, bind CONSENT_DB (see schema.sql) and route
// /api/consent* to handleConsent().
//
// Every cookie choice (accept, reject, change, withdraw) is stored in the D1
// table consent_log with the site name, a random consent ID, the choice, the
// policy version and the page path. No IP address or user agent is stored, and
// the time is set here on the server.
//
// Settings (wrangler.jsonc, and again under "previews" for staging):
//   vars.SITE            the site's domain, e.g. "fastparts.uk.com" (required)
//   CONSENT_DB           the D1 database binding (required)
//   CONSENT_ADMIN_TOKEN  secret for the lookup endpoint (optional)

const ID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const ACTIONS = new Set(["accept", "reject", "changed", "withdrawn"]);
const VERSION_RE = /^v[0-9]{1,3}$/;
const SITE_RE = /^[a-z0-9]([a-z0-9.-]*[a-z0-9])?$/;
const MAX_BODY = 600; // bytes

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" },
  });
}

function siteOf(env) {
  const s = env && env.SITE;
  return typeof s === "string" && SITE_RE.test(s) ? s : null;
}

// Only pages on this site (the domain itself or any subdomain, such as www or staging).
//
// Preview builds run on a workers.dev address, not the site's domain. Setting
// CONSENT_PREVIEW_WORKER (under "previews" only, never in production) to the
// Worker's name also allows that Worker's own workers.dev addresses.
function originAllowed(request, site, env) {
  const origin = request.headers.get("origin");
  if (!origin) return false;
  try {
    const host = new URL(origin).hostname;
    if (host === site || host.endsWith("." + site)) return true;
    const w = env && env.CONSENT_PREVIEW_WORKER;
    if (typeof w === "string" && /^[a-z0-9-]+$/.test(w)) {
      return new RegExp("^([a-z0-9-]+-)?" + w + "\\.[a-z0-9-]+\\.workers\\.dev$").test(host);
    }
    return false;
  } catch (e) {
    return false;
  }
}

async function logChoice(request, env, site) {
  if (!originAllowed(request, site, env)) return json({ error: "forbidden" }, 403);

  const text = await request.text();
  if (text.length > MAX_BODY) return json({ error: "too_long" }, 413);

  let b;
  try { b = JSON.parse(text); } catch (e) { return json({ error: "bad_request" }, 400); }

  const id = b && b.id;
  const page = typeof (b && b.page) === "string" ? b.page.slice(0, 120) : "";
  if (typeof id !== "string" || !ID_RE.test(id)) return json({ error: "bad_request" }, 400);
  if (!ACTIONS.has(b.action)) return json({ error: "bad_request" }, 400);
  if (typeof b.version !== "string" || !VERSION_RE.test(b.version)) return json({ error: "bad_request" }, 400);
  if (typeof b.analytics !== "boolean") return json({ error: "bad_request" }, 400);

  try {
    await env.CONSENT_DB
      .prepare("INSERT INTO consent_log (site, consent_id, created_at, action, analytics, policy_version, page) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)")
      .bind(site, id, new Date().toISOString(), b.action, b.analytics ? 1 : 0, b.version, page)
      .run();
  } catch (e) {
    console.error("consent log error:", String((e && e.message) || e).slice(0, 160));
    return json({ error: "unavailable" }, 503);
  }
  return json({ ok: true }, 201);
}

// GET /api/consent/<consent id>  with  Authorization: Bearer <CONSENT_ADMIN_TOKEN>
// Returns one visitor's history on THIS site only.
async function lookup(request, env, site, id) {
  const token = env.CONSENT_ADMIN_TOKEN;
  const auth = request.headers.get("authorization") || "";
  if (!token || auth !== "Bearer " + token) return json({ error: "forbidden" }, 403);
  if (!ID_RE.test(id)) return json({ error: "bad_request" }, 400);
  const rows = await env.CONSENT_DB
    .prepare("SELECT created_at, action, analytics, policy_version, page FROM consent_log WHERE site = ?1 AND consent_id = ?2 ORDER BY created_at, rowid")
    .bind(site, id)
    .all();
  return json({ site, consent_id: id, records: rows.results || [] });
}

// ---- Retention -----------------------------------------------------------
// Records are deleted once they are older than CONSENT_RETENTION_MONTHS (default
// 12). Run pruneConsent() daily from a Cron Trigger (see wrangler.jsonc). Each
// site deletes only its own rows, so sites sharing a database can use different
// periods. If the setting is invalid, nothing is deleted.
const DEFAULT_RETENTION_MONTHS = 12;

function retentionMonths(env) {
  const raw = env && env.CONSENT_RETENTION_MONTHS;
  if (raw === undefined || raw === null || raw === "") return DEFAULT_RETENTION_MONTHS;
  const n = Number(raw);
  return Number.isInteger(n) && n >= 1 && n <= 120 ? n : null;
}

export async function pruneConsent(env, now = new Date()) {
  const site = siteOf(env);
  const months = retentionMonths(env);
  if (!site || !env.CONSENT_DB || months === null) {
    console.error("consent prune skipped: SITE, CONSENT_DB or CONSENT_RETENTION_MONTHS not valid");
    return { skipped: true };
  }
  const cutoff = new Date(now.getTime());
  cutoff.setUTCMonth(cutoff.getUTCMonth() - months);
  const iso = cutoff.toISOString();
  const res = await env.CONSENT_DB
    .prepare("DELETE FROM consent_log WHERE site = ?1 AND created_at < ?2")
    .bind(site, iso)
    .run();
  const deleted = (res && res.meta && res.meta.changes) || 0;
  console.log("consent prune:", site, "deleted", deleted, "older than", iso);
  return { site, cutoff: iso, deleted };
}

// Returns a Response for /api/consent routes, or null for any other path.
export async function handleConsent(request, env, url) {
  const path = url.pathname;
  if (path !== "/api/consent" && !path.startsWith("/api/consent/")) return null;

  if (path === "/api/consent") {
    if (request.method !== "POST") return json({ error: "method_not_allowed" }, 405);
  } else if (request.method !== "GET") {
    return json({ error: "method_not_allowed" }, 405);
  }

  const site = siteOf(env);
  if (!site || !env.CONSENT_DB) return json({ error: "not_configured" }, 503);

  if (path === "/api/consent") return logChoice(request, env, site);
  return lookup(request, env, site, path.slice("/api/consent/".length));
}
