/*
  Fast Parts cookie control settings. The engine is js/consent.js (Pixel North cookie control kit):
  do not edit it here. Change the engine in the Kit repo, then copy it across.
*/
window.COOKIE_CONTROL = {
  categories: {
    analytics: null,      // on because gaId is set below
    preferences: false,
    media: false,
    marketing: false
  },
  gaId: "G-MLMZ8SBB66",
  gaCookieDays: 395,      // 13 months, as the cookie policy says
  cookieName: "fp_consent",
  version: "v2",          // unchanged, so visitors who already chose are not asked again
  acceptDays: 365,
  declineDays: 365,
  policyUrl: "/cookies",
  logUrl: "/api/consent",
  // The previous Fast Parts website left its own cookies on this domain. Delete every cookie the
  // banner can see except the ones below and the ones the visitor has allowed.
  legacyCookies: ["*"],
  keepCookies: [],
  colors: { brand: "#031A78", text: "#1B2030", background: "#ffffff", focus: "#E1162C" },
  fonts: {
    body: "'Source Sans 3', Arial, sans-serif",
    heading: "'Barlow Semi Condensed', 'Source Sans 3', Arial, sans-serif"
  }
};
