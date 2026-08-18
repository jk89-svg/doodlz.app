/* ------------------------------------------------------------------
 * doodly.io ad configuration
 *
 * Leave these EMPTY until your AdSense account is approved.
 * While they are empty no ad unit is requested, nothing is broken and
 * Google's Auto ads still fill the page on their own.
 *
 * After approval: AdSense -> Ads -> By ad unit -> Display ads ->
 * create a unit -> copy the data-ad-slot number (10 digits) here.
 * ------------------------------------------------------------------ */
window.DOODLY_ADS = {
  client: 'ca-pub-8471772384803302',
  slots: {
    home: '',   // unit shown on the home page under the login card
    page: '',   // unit shown on the About / How to play / Privacy / Terms pages
  },
};

(function () {
  var cfg = window.DOODLY_ADS;
  document.addEventListener('DOMContentLoaded', function () {
    document.querySelectorAll('[data-ad-place]').forEach(function (holder) {
      var slot = cfg.slots[holder.getAttribute('data-ad-place')];
      if (!slot || !/^\d{6,}$/.test(slot)) { holder.remove(); return; }
      var ins = document.createElement('ins');
      ins.className = 'adsbygoogle';
      ins.style.display = 'block';
      ins.setAttribute('data-ad-client', cfg.client);
      ins.setAttribute('data-ad-slot', slot);
      ins.setAttribute('data-ad-format', 'auto');
      ins.setAttribute('data-full-width-responsive', 'true');
      holder.appendChild(ins);
      try { (window.adsbygoogle = window.adsbygoogle || []).push({}); } catch (e) {}
    });
  });
})();
