/* r167 (27 Nov 2026, audit round 2): ONE delivery, returns and exchanges block for every product page (Founding Edition,
   Sahel, Sahra Trail, the bag), so the facts and wording never drift apart. Matches policies.html.
   AED amounts carry .sb-thr (a threshold, rounded up) or .sb-amt (a fee) so assets/sahra-market.js shows them in the
   visitor's currency. No flag emoji (Windows draws them as letter codes); the UAE flag is an inline SVG. */
const FLAG = '<svg class="shipflag" viewBox="0 0 30 20" aria-hidden="true"><rect width="30" height="20" fill="#fff"/><rect width="30" height="6.7" fill="#3F6B3A"/><rect y="13.3" width="30" height="6.7" fill="#000"/><rect width="8" height="20" fill="#FF0000"/></svg>';
const CARDS = `<div class="shipcards">
    <div class="shipcard shipcard-uae"><b>${FLAG} United Arab Emirates</b>
      <span>Next working day to every emirate, Al Ain included: order by 2 pm. <strong>Free on orders over AED 100</strong>, AED 15 below that</span>
      <span>Free returns and size or fit exchanges within 14 days</span></div>
    <div class="shipcard shipcard-gcc"><b>GCC <span class="shipsub">Saudi Arabia · Qatar · Oman · Bahrain · Kuwait</span></b>
      <span>3–5 working days: <span class="sb-amt" data-aed="50">AED 50</span>, <strong>free over <span class="sb-thr" data-aed="229">AED 229</span></strong></span>
      <span>Duties, if any, are payable on arrival</span></div>
    <div class="shipcard shipcard-intl"><b>Worldwide</b>
      <span>7–14 working days: <span class="sb-amt" data-aed="80">AED 80</span></span>
      <span>Duties and import taxes are payable on arrival</span></div>
  </div>`;
const FOOT = 'Order by 2 pm UAE time on a working day for same-day dispatch. Returns within 14 days, unworn with tags: free within the UAE; international customers cover return postage. We issue refunds within 5–7 working days of the return arriving.';
module.exports = { CARDS, FOOT };
