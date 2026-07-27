/* ==========================================================================
   Attic & Ember — product photo gallery
   Click a thumbnail to swap the main photo. Progressive enhancement:
   with JS off, the main photo and all thumbnails still show as images.
   ========================================================================== */
(function () {
  "use strict";

  var main = document.getElementById("main-photo");
  var thumbs = Array.prototype.slice.call(document.querySelectorAll(".photo-thumbs .thumb"));
  if (!main || thumbs.length === 0) return;

  thumbs.forEach(function (t) {
    t.addEventListener("click", function () {
      var full = t.getAttribute("data-full");
      if (full) main.src = full;
      thumbs.forEach(function (x) { x.classList.toggle("is-active", x === t); });
    });
  });
})();
