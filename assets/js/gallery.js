/* ==========================================================================
   Attic & Ember — product photo/video gallery
   Click a thumbnail to swap the main stage. Photos swap the <img>; video
   thumbnails reveal and play the <video>. Progressive enhancement: with
   JS off, the main photo and all thumbnails still show.
   ========================================================================== */
(function () {
  "use strict";

  var thumbs = Array.prototype.slice.call(document.querySelectorAll(".photo-thumbs .thumb"));
  if (thumbs.length === 0) return;

  var photoBox = document.getElementById("stage-photo");
  var mainPhoto = document.getElementById("main-photo");
  var mainVideo = document.getElementById("main-video");

  function activate(active) {
    thumbs.forEach(function (t) { t.classList.toggle("is-active", t === active); });
  }

  thumbs.forEach(function (t) {
    t.addEventListener("click", function () {
      var type = t.getAttribute("data-type");
      var src = t.getAttribute("data-full");

      if (type === "video" && mainVideo) {
        if (photoBox) photoBox.hidden = true;
        if (mainVideo.getAttribute("src") !== src) mainVideo.setAttribute("src", src);
        mainVideo.hidden = false;
        var p = mainVideo.play();
        if (p && p.catch) p.catch(function () {});   // ignore autoplay blocks
      } else {
        if (mainVideo) { mainVideo.pause(); mainVideo.hidden = true; }
        if (photoBox) photoBox.hidden = false;
        if (mainPhoto && src) mainPhoto.src = src;
      }
      activate(t);
    });
  });
})();
