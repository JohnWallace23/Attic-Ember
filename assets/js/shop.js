/* ==========================================================================
   Attic & Ember — shop filter + sort
   Client-side (static site): filter the grid by source_type and reorder
   it by price/name. Progressive enhancement — with JS off, every product
   still shows in its default order.
   ========================================================================== */
(function () {
  "use strict";

  var section = document.querySelector(".shop");
  if (!section) return;
  var grid = section.querySelector(".grid");
  var controls = section.querySelector(".shop-controls");
  if (!grid || !controls) return;

  var chips = Array.prototype.slice.call(controls.querySelectorAll(".filter-chip"));
  var sortSel = controls.querySelector(".sort-select");
  var empty = section.querySelector(".shop-empty");
  var cards = Array.prototype.slice.call(grid.querySelectorAll(".card"));

  // remember the original (document) order for the default sort
  cards.forEach(function (c, i) { c.setAttribute("data-i", i); });

  var activeFilter = "all";

  function price(c) { return parseFloat(c.getAttribute("data-price")) || 0; }
  function name(c) { return (c.getAttribute("data-name") || "").toLowerCase(); }
  function order(c) { return parseInt(c.getAttribute("data-i"), 10) || 0; }

  function apply() {
    var mode = sortSel ? sortSel.value : "default";

    var ordered = cards.slice().sort(function (a, b) {
      if (mode === "price-asc") return price(a) - price(b);
      if (mode === "price-desc") return price(b) - price(a);
      if (mode === "name") return name(a).localeCompare(name(b));
      // default: document order, which the template already emits
      // newest-listed first.
      return order(a) - order(b);
    });
    ordered.forEach(function (c) { grid.appendChild(c); });

    var shown = 0;
    cards.forEach(function (c) {
      var ok = activeFilter === "all" || c.getAttribute("data-source") === activeFilter;
      c.style.display = ok ? "" : "none";
      if (ok) shown++;
    });
    if (empty) empty.hidden = shown > 0;
  }

  chips.forEach(function (chip) {
    chip.addEventListener("click", function () {
      activeFilter = chip.getAttribute("data-filter");
      chips.forEach(function (x) {
        var on = x === chip;
        x.classList.toggle("is-active", on);
        x.setAttribute("aria-pressed", on ? "true" : "false");
      });
      apply();
    });
  });

  if (sortSel) sortSel.addEventListener("change", apply);

  apply();
})();
