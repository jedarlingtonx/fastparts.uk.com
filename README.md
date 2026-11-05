# Fast Parts website (Pixel North build)

Static HTML/CSS/JS, no build step. Hosted on GitHub Pages.

## Before launch
1. Fill every highlighted `[placeholder]` (search the HTML for `class="todo"`): company name, number, registered office, VAT, privacy email, response time, credit terms, 1989 heritage, reviewer permission.
2. Forms: all three forms (parts enquiry on index.html and retail.html, trade credit on trade.html) post to Web3Forms. Each form has its own access key in a hidden field (`access_key`); enquiries and credit requests use different keys so they can be routed separately in the Web3Forms dashboard.
3. Indexing: live. The noindex tag has been removed and robots.txt allows crawling (except /api/).
4. Replace the recreated logo with Paul's original vector artwork if he has it, and the FP favicon once approved.
5. Domain: live on Cloudflare (zone fastparts.uk.com). The apex and www are Worker custom domains; the bare domain redirects to www.

Publish changes: `git add .`, `git commit -m "message"`, `git push`.

## Cookies and analytics (dormant)
The site sets no cookies. `cookies.html`, the footer "Cookie settings" link and `js/consent.js` are in place so analytics can be added later. To switch on: set `ANALYTICS_ID` in `js/consent.js`, update `cookies.html` and `privacy.html`, and set GA retention to 14 months with Google signals off. The banner has equal Accept and Reject and loads nothing before consent.

## Open items for Paul (removed from the pages, still to confirm)
- Google reviewer permission to show names and text.
- Credit account terms and the approval process (Trade page).
- About us story, team names and photos.

## SEO after launch
1. Search Console: add the https://www.fastparts.uk.com property, submit sitemap.xml, then use URL Inspection > Request indexing on the home page.
3. Google Business Profile: one listing per shop (Northwich, Winsford), with the same name, address, phone and hours as the site. Link both to the website.
4. Keep name, address and phone identical everywhere (Google, Facebook, Yell, Bing Places, Apple Business Connect).
5. Ask happy customers for Google reviews; reply to them.
6. Check at the Rich Results Test (search.google.com/test/rich-results) once live.
