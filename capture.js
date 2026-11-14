/* ==========================================================================
   capture.js — the welcome code offer as page markup (13 Nov 2026)
   ==========================================================================
   Faheem, 13 Nov 2026: "we need to maximize email capture". He chose a welcome code: AED 50 off a first order over
   AED 199, valid for 14 days, said on the site and sent only by email (Shopify Flow, from the welcome-code tag that
   api/subscribe.js writes). He also chose where it shows:
   - a block under the reviews on every product page            block('pdp')
   - the homepage and /shop/ forms moved up                     block('home') / tile() in the /shop/ grid
   - the shared newsletter block on the category and guide pages (build.js newsletterBlock, same words)
   - a gentle sheet and a line in the bag                       assets/sahra-welcome.js (no markup here)
   - "Tell me when it's back" on sold-out sizes                 assets/sahra-specimen.js

   The forms are [data-waitlist] forms, so assets/sahra-welcome.js saves them to Shopify with consent and shows the
   success line only once the address is stored. The two success lines: the code is on its way, or (an address that
   has ordered before) you are on the list. The Arabic pages get these words from content/ar-mirror like every page.
   Styles: assets/sahra-welcome.css (.sbc-*), loaded on every page.
   ========================================================================== */
'use strict';

const T = {
  eye: 'Welcome',
  h: 'AED 50 off your first order',
  p: 'On orders over AED 199. Leave your email and we send you a code, valid for 14 days. You also hear about each new release first.',
  btn: 'Email me my code',
  bad: 'Please enter a valid email address.',
  yes: 'Check your inbox. Your code is on its way, and it lasts 14 days.',
  no: 'You are on the list. The welcome code is for a first order, and this email has ordered with us before.',
  sent: 'You are on the list. We have already sent a welcome code to this email.',
  fine: 'One code per person. Unsubscribe any time.'
};

function form(src) {
  return `<form class="sbc-form" data-waitlist data-source="${src}" novalidate><input type="email" name="email" placeholder="you@email.com" aria-label="Email address" autocomplete="email" required><button type="submit">${T.btn}</button></form>
  <p class="sbc-err" data-err role="alert">${T.bad}</p>
  <p class="sbc-ok" role="status">${T.yes}</p><p class="sbc-ok sbc-ok-no" role="status">${T.no}</p><p class="sbc-ok sbc-ok-sent" role="status">${T.sent}</p>`;
}

/* src: where the sign-up came from, written to Shopify as the tag src-<src> */
function block(src, opts = {}) {
  const id = 'sbc-' + src;
  return `<section class="sbc-blk${opts.cls ? ' ' + opts.cls : ''}" id="${opts.id || 'welcome-code'}" data-waitlist-wrap aria-labelledby="${id}-h">
  <span class="sbc-eye">${T.eye}</span>
  <h2 id="${id}-h">${T.h}</h2>
  <p class="sbc-p">${T.p}</p>
  ${form(src)}
  <p class="sbc-fine">${T.fine}</p>
</section>`;
}

/* /shop/: the block as a full-width row inside the product grid, after the first rows of cards */
const tile = () => block('shop', { cls: 'sbc-tile', id: 'welcome-code' });

/* 14 Nov 2026 (Faheem: "Text link only" on product pages): one quiet line that opens the welcome sheet
   (assets/sahra-welcome.js); hidden once this browser has signed up (html.sb-cap-done) */
const link = src => `<p class="sbc-link"><a href="#welcome-code" data-sbc-open="${src}">AED 50 off your first order. <span>Get your code</span></a></p>`;

module.exports = { T, block, tile, form, link };
