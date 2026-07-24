/* ==========================================================================
   Attic & Ember — the shop cat
   A small black cat that ambles along the bottom of the page, sits for
   long lazy stretches, and reacts when petted (clicked).
   Deliberately un-annoying:
     - Slow walk, long pauses (7–18s), small size, no sounds.
     - Only the cat itself is clickable — it never blocks the page.
     - Under prefers-reduced-motion it just sits quietly in the corner.
   ========================================================================== */
(function () {
  "use strict";

  var reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

  // Build the cat: speech bubble + a simple side-view silhouette.
  var cat = document.createElement("div");
  cat.className = "page-cat";
  cat.setAttribute("role", "button");
  cat.setAttribute("tabindex", "0");
  cat.setAttribute("aria-label", "The shop cat. Press to say hello.");
  cat.innerHTML =
    '<div class="cat-bubble" aria-hidden="true"></div>' +
    '<svg class="cat-svg" viewBox="0 0 64 44" width="64" height="44" aria-hidden="true">' +
      '<g class="cat-rig">' +
        '<path class="cat-tail" d="M8 24 Q -2 16 6 6" fill="none" stroke="#201C18" stroke-width="4.5" stroke-linecap="round"/>' +
        '<g fill="#201C18" stroke="#93A184" stroke-width="1" stroke-opacity="0.35">' +
          '<rect class="leg leg-a" x="17" y="28" width="4" height="12" rx="2"/>' +
          '<rect class="leg leg-b" x="25" y="28" width="4" height="12" rx="2"/>' +
          '<rect class="leg leg-a" x="35" y="28" width="4" height="12" rx="2"/>' +
          '<rect class="leg leg-b" x="43" y="28" width="4" height="12" rx="2"/>' +
          '<ellipse cx="31" cy="24" rx="19" ry="11"/>' +
          '<circle cx="50" cy="14" r="9"/>' +
          '<polygon points="44,8 42,0 49,5"/>' +
          '<polygon points="56,8 58,0 51,5"/>' +
        '</g>' +
        '<circle class="cat-eyes" cx="47.5" cy="13" r="1.4" fill="#D9A84E"/>' +
        '<circle class="cat-eyes" cx="53.5" cy="13" r="1.4" fill="#D9A84E"/>' +
      '</g>' +
    '</svg>';
  document.body.appendChild(cat);

  var svg = cat.querySelector(".cat-svg");
  var bubble = cat.querySelector(".cat-bubble");

  function rand(min, max) { return min + Math.random() * (max - min); }

  // ---- speech bubble ----
  var WORDS = ["mew!", "mrrp?", "purrrr…", "prrt!"];
  var bubbleTimer = null;
  function say(text, ms) {
    bubble.textContent = text;
    bubble.classList.add("show");
    clearTimeout(bubbleTimer);
    bubbleTimer = setTimeout(function () {
      bubble.classList.remove("show");
    }, ms || 1300);
  }

  // ---- petting reactions ----
  var busyUntil = 0;
  function react() {
    var now = performance.now();
    if (now < busyUntil) return;   // one reaction at a time
    busyUntil = now + 700;
    // The cat stops walking to acknowledge you. As cats occasionally do.
    pauseUntil = now + rand(4000, 9000);
    setWalking(false);
    if (Math.random() < 0.25) {
      // startled poof
      cat.classList.remove("poof"); void cat.offsetWidth;
      cat.classList.add("poof");
      say("!!", 900);
    } else {
      // pleased little hop
      cat.classList.remove("hop"); void cat.offsetWidth;
      cat.classList.add("hop");
      say(WORDS[(Math.random() * WORDS.length) | 0]);
    }
  }
  cat.addEventListener("click", react);
  cat.addEventListener("keydown", function (e) {
    if (e.key === "Enter" || e.key === " ") { e.preventDefault(); react(); }
  });
  cat.addEventListener("animationend", function () {
    cat.classList.remove("hop", "poof");
  });

  // ---- reduced motion: sit in the corner, still says hello on click ----
  if (reduceMotion.matches) {
    cat.classList.add("resting");
    cat.style.left = "auto";
    cat.style.right = "18px";
    return;
  }

  // ---- wandering ----
  var x = 24, dir = 1, target = 0;
  var walking = false;
  var pauseUntil = performance.now() + 2500;
  var rafId = null, lastTime = 0;

  function setWalking(on) {
    walking = on;
    cat.classList.toggle("walking", on);
  }
  function maxX() { return Math.max(12, window.innerWidth - 76); }
  function pickTarget() {
    target = rand(12, maxX());
    dir = target > x ? 1 : -1;
    // Face the direction of travel (bubble stays unflipped).
    svg.style.transform = dir < 0 ? "scaleX(-1)" : "";
    setWalking(true);
  }

  function tick(now) {
    var dt = Math.min((now - lastTime) / 1000, 0.05);
    lastTime = now;

    if (walking) {
      x += dir * 38 * dt;   // an amble, not a dash
      if ((dir > 0 && x >= target) || (dir < 0 && x <= target)) {
        x = target;
        setWalking(false);
        pauseUntil = now + rand(7000, 18000);  // long, lazy sits
      }
    } else if (now > pauseUntil && now > busyUntil) {
      pickTarget();
    }

    cat.style.transform = "translateX(" + x + "px)";
    rafId = requestAnimationFrame(tick);
  }

  function start() {
    if (rafId === null) {
      lastTime = performance.now();
      rafId = requestAnimationFrame(tick);
    }
  }
  function stop() {
    if (rafId !== null) { cancelAnimationFrame(rafId); rafId = null; }
  }

  document.addEventListener("visibilitychange", function () {
    if (document.hidden) stop(); else start();
  });
  window.addEventListener("resize", function () {
    x = Math.min(x, maxX());
  });
  reduceMotion.addEventListener("change", function (e) {
    if (e.matches) { stop(); setWalking(false); } else start();
  });

  start();
})();
