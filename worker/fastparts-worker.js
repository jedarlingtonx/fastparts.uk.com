// Fast Parts website Worker. Handles the cookie-consent audit trail
// (POST /api/consent) and serves everything else from the static site files
// (404.html included). Records are deleted daily once past their retention period.

import { handleConsent, pruneConsent } from "./consent-log.js";

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const consent = await handleConsent(request, env, url);
    if (consent) return consent;
    if (url.pathname.startsWith("/api/")) {
      return new Response(JSON.stringify({ error: "not_found" }), {
        status: 404,
        headers: { "content-type": "application/json; charset=utf-8" },
      });
    }
    return env.ASSETS.fetch(request);
  },
  // Daily Cron Trigger (wrangler.jsonc): delete consent records past their retention period.
  async scheduled(event, env, ctx) {
    ctx.waitUntil(pruneConsent(env));
  },
};
