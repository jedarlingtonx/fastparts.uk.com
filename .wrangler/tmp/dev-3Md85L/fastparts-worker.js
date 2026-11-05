var __defProp = Object.defineProperty;
var __name = (target, value) => __defProp(target, "name", { value, configurable: true });

// worker/consent-log.js
var ID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
var ACTIONS = /* @__PURE__ */ new Set(["accept", "reject", "changed", "withdrawn"]);
var VERSION_RE = /^v[0-9]{1,3}$/;
var SITE_RE = /^[a-z0-9]([a-z0-9.-]*[a-z0-9])?$/;
var MAX_BODY = 600;
function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" }
  });
}
__name(json, "json");
function siteOf(env) {
  const s = env && env.SITE;
  return typeof s === "string" && SITE_RE.test(s) ? s : null;
}
__name(siteOf, "siteOf");
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
__name(originAllowed, "originAllowed");
async function logChoice(request, env, site) {
  if (!originAllowed(request, site, env)) return json({ error: "forbidden" }, 403);
  const text = await request.text();
  if (text.length > MAX_BODY) return json({ error: "too_long" }, 413);
  let b;
  try {
    b = JSON.parse(text);
  } catch (e) {
    return json({ error: "bad_request" }, 400);
  }
  const id = b && b.id;
  const page = typeof (b && b.page) === "string" ? b.page.slice(0, 120) : "";
  if (typeof id !== "string" || !ID_RE.test(id)) return json({ error: "bad_request" }, 400);
  if (!ACTIONS.has(b.action)) return json({ error: "bad_request" }, 400);
  if (typeof b.version !== "string" || !VERSION_RE.test(b.version)) return json({ error: "bad_request" }, 400);
  if (typeof b.analytics !== "boolean") return json({ error: "bad_request" }, 400);
  try {
    await env.CONSENT_DB.prepare("INSERT INTO consent_log (site, consent_id, created_at, action, analytics, policy_version, page) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)").bind(site, id, (/* @__PURE__ */ new Date()).toISOString(), b.action, b.analytics ? 1 : 0, b.version, page).run();
  } catch (e) {
    console.error("consent log error:", String(e && e.message || e).slice(0, 160));
    return json({ error: "unavailable" }, 503);
  }
  return json({ ok: true }, 201);
}
__name(logChoice, "logChoice");
async function lookup(request, env, site, id) {
  const token = env.CONSENT_ADMIN_TOKEN;
  const auth = request.headers.get("authorization") || "";
  if (!token || auth !== "Bearer " + token) return json({ error: "forbidden" }, 403);
  if (!ID_RE.test(id)) return json({ error: "bad_request" }, 400);
  const rows = await env.CONSENT_DB.prepare("SELECT created_at, action, analytics, policy_version, page FROM consent_log WHERE site = ?1 AND consent_id = ?2 ORDER BY created_at, rowid").bind(site, id).all();
  return json({ site, consent_id: id, records: rows.results || [] });
}
__name(lookup, "lookup");
var DEFAULT_RETENTION_MONTHS = 12;
function retentionMonths(env) {
  const raw = env && env.CONSENT_RETENTION_MONTHS;
  if (raw === void 0 || raw === null || raw === "") return DEFAULT_RETENTION_MONTHS;
  const n = Number(raw);
  return Number.isInteger(n) && n >= 1 && n <= 120 ? n : null;
}
__name(retentionMonths, "retentionMonths");
async function pruneConsent(env, now = /* @__PURE__ */ new Date()) {
  const site = siteOf(env);
  const months = retentionMonths(env);
  if (!site || !env.CONSENT_DB || months === null) {
    console.error("consent prune skipped: SITE, CONSENT_DB or CONSENT_RETENTION_MONTHS not valid");
    return { skipped: true };
  }
  const cutoff = new Date(now.getTime());
  cutoff.setUTCMonth(cutoff.getUTCMonth() - months);
  const iso = cutoff.toISOString();
  const res = await env.CONSENT_DB.prepare("DELETE FROM consent_log WHERE site = ?1 AND created_at < ?2").bind(site, iso).run();
  const deleted = res && res.meta && res.meta.changes || 0;
  console.log("consent prune:", site, "deleted", deleted, "older than", iso);
  return { site, cutoff: iso, deleted };
}
__name(pruneConsent, "pruneConsent");
async function handleConsent(request, env, url) {
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
__name(handleConsent, "handleConsent");

// worker/fastparts-worker.js
var fastparts_worker_default = {
  async fetch(request, env) {
    const url = new URL(request.url);
    const consent = await handleConsent(request, env, url);
    if (consent) return consent;
    if (url.pathname.startsWith("/api/")) {
      return new Response(JSON.stringify({ error: "not_found" }), {
        status: 404,
        headers: { "content-type": "application/json; charset=utf-8" }
      });
    }
    return env.ASSETS.fetch(request);
  },
  // Daily Cron Trigger (wrangler.jsonc): delete consent records past their retention period.
  async scheduled(event, env, ctx) {
    ctx.waitUntil(pruneConsent(env));
  }
};

// ../.npm/_npx/c943b712072b77c4/node_modules/wrangler/templates/middleware/middleware-ensure-req-body-drained.ts
var drainBody = /* @__PURE__ */ __name(async (request, env, _ctx, middlewareCtx) => {
  try {
    return await middlewareCtx.next(request, env);
  } finally {
    try {
      if (request.body !== null && !request.bodyUsed) {
        const reader = request.body.getReader();
        while (!(await reader.read()).done) {
        }
      }
    } catch (e) {
      console.error("Failed to drain the unused request body.", e);
    }
  }
}, "drainBody");
var middleware_ensure_req_body_drained_default = drainBody;

// ../.npm/_npx/c943b712072b77c4/node_modules/wrangler/templates/middleware/middleware-miniflare3-json-error.ts
function reduceError(e) {
  return {
    name: e?.name,
    message: e?.message ?? String(e),
    stack: e?.stack,
    cause: e?.cause === void 0 ? void 0 : reduceError(e.cause)
  };
}
__name(reduceError, "reduceError");
var jsonError = /* @__PURE__ */ __name(async (request, env, _ctx, middlewareCtx) => {
  try {
    return await middlewareCtx.next(request, env);
  } catch (e) {
    const error = reduceError(e);
    const body = JSON.stringify(error);
    const headers = {
      "Content-Type": "application/json",
      "MF-Experimental-Error-Stack": "true"
    };
    const encoded = encodeURIComponent(body);
    if (encoded.length <= 8192) {
      headers["MF-Experimental-Error-Stack-Payload"] = encoded;
    }
    return new Response(body, { status: 500, headers });
  }
}, "jsonError");
var middleware_miniflare3_json_error_default = jsonError;

// .wrangler/tmp/bundle-YZxJzc/middleware-insertion-facade.js
var __INTERNAL_WRANGLER_MIDDLEWARE__ = [
  middleware_ensure_req_body_drained_default,
  middleware_miniflare3_json_error_default
];
var middleware_insertion_facade_default = fastparts_worker_default;

// ../.npm/_npx/c943b712072b77c4/node_modules/wrangler/templates/middleware/common.ts
var __facade_middleware__ = [];
function __facade_register__(...args) {
  __facade_middleware__.push(...args.flat());
}
__name(__facade_register__, "__facade_register__");
function __facade_invokeChain__(request, env, ctx, dispatch, middlewareChain) {
  const [head, ...tail] = middlewareChain;
  const middlewareCtx = {
    dispatch,
    next(newRequest, newEnv) {
      return __facade_invokeChain__(newRequest, newEnv, ctx, dispatch, tail);
    }
  };
  return head(request, env, ctx, middlewareCtx);
}
__name(__facade_invokeChain__, "__facade_invokeChain__");
function __facade_invoke__(request, env, ctx, dispatch, finalMiddleware) {
  return __facade_invokeChain__(request, env, ctx, dispatch, [
    ...__facade_middleware__,
    finalMiddleware
  ]);
}
__name(__facade_invoke__, "__facade_invoke__");

// .wrangler/tmp/bundle-YZxJzc/middleware-loader.entry.ts
var __Facade_ScheduledController__ = class ___Facade_ScheduledController__ {
  constructor(scheduledTime, cron, noRetry) {
    this.scheduledTime = scheduledTime;
    this.cron = cron;
    this.#noRetry = noRetry;
  }
  scheduledTime;
  cron;
  static {
    __name(this, "__Facade_ScheduledController__");
  }
  #noRetry;
  noRetry() {
    if (!(this instanceof ___Facade_ScheduledController__)) {
      throw new TypeError("Illegal invocation");
    }
    this.#noRetry();
  }
};
function wrapExportedHandler(worker) {
  if (__INTERNAL_WRANGLER_MIDDLEWARE__ === void 0 || __INTERNAL_WRANGLER_MIDDLEWARE__.length === 0) {
    return worker;
  }
  for (const middleware of __INTERNAL_WRANGLER_MIDDLEWARE__) {
    __facade_register__(middleware);
  }
  const fetchDispatcher = /* @__PURE__ */ __name(function(request, env, ctx) {
    if (worker.fetch === void 0) {
      throw new Error("Handler does not export a fetch() function.");
    }
    return worker.fetch(request, env, ctx);
  }, "fetchDispatcher");
  return {
    ...worker,
    fetch(request, env, ctx) {
      const dispatcher = /* @__PURE__ */ __name(function(type, init) {
        if (type === "scheduled" && worker.scheduled !== void 0) {
          const controller = new __Facade_ScheduledController__(
            Date.now(),
            init.cron ?? "",
            () => {
            }
          );
          return worker.scheduled(controller, env, ctx);
        }
      }, "dispatcher");
      return __facade_invoke__(request, env, ctx, dispatcher, fetchDispatcher);
    }
  };
}
__name(wrapExportedHandler, "wrapExportedHandler");
function wrapWorkerEntrypoint(klass) {
  if (__INTERNAL_WRANGLER_MIDDLEWARE__ === void 0 || __INTERNAL_WRANGLER_MIDDLEWARE__.length === 0) {
    return klass;
  }
  for (const middleware of __INTERNAL_WRANGLER_MIDDLEWARE__) {
    __facade_register__(middleware);
  }
  return class extends klass {
    #fetchDispatcher = /* @__PURE__ */ __name((request, env, ctx) => {
      this.env = env;
      this.ctx = ctx;
      if (super.fetch === void 0) {
        throw new Error("Entrypoint class does not define a fetch() function.");
      }
      return super.fetch(request);
    }, "#fetchDispatcher");
    #dispatcher = /* @__PURE__ */ __name((type, init) => {
      if (type === "scheduled" && super.scheduled !== void 0) {
        const controller = new __Facade_ScheduledController__(
          Date.now(),
          init.cron ?? "",
          () => {
          }
        );
        return super.scheduled(controller);
      }
    }, "#dispatcher");
    fetch(request) {
      return __facade_invoke__(
        request,
        this.env,
        this.ctx,
        this.#dispatcher,
        this.#fetchDispatcher
      );
    }
  };
}
__name(wrapWorkerEntrypoint, "wrapWorkerEntrypoint");
var WRAPPED_ENTRY;
if (typeof middleware_insertion_facade_default === "object") {
  WRAPPED_ENTRY = wrapExportedHandler(middleware_insertion_facade_default);
} else if (typeof middleware_insertion_facade_default === "function") {
  WRAPPED_ENTRY = wrapWorkerEntrypoint(middleware_insertion_facade_default);
}
var middleware_loader_entry_default = WRAPPED_ENTRY;
export {
  __INTERNAL_WRANGLER_MIDDLEWARE__,
  middleware_loader_entry_default as default
};
//# sourceMappingURL=fastparts-worker.js.map
