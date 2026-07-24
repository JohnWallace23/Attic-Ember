/* ==========================================================================
   Attic & Ember — the shop cat
   ONE cat, two lives:
     - While the hero's crescent moon is in view, it perches there on all
       fours, perfectly still except the occasional blink.
     - Scroll the moon out of view and it leaps down, lands at the bottom
       of the page, stretches, and ambles around like it owns the place.
     - Scroll back up and it leaps home into the moon.
   Petting (click / Enter) gets a reaction. Deliberately un-annoying:
   slow, small, silent, long lazy pauses, never blocks the page.
   Under prefers-reduced-motion the cat just sits in the moon, still.
   ========================================================================== */
(function () {
  "use strict";

  var reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  var GROUND_SIZE = 64;

  // ---- build the cat: bubble + one svg with two poses ----
  var cat = document.createElement("div");
  cat.className = "page-cat";
  cat.setAttribute("role", "button");
  cat.setAttribute("tabindex", "0");
  cat.setAttribute("aria-label", "The shop cat. Press to say hello.");
  // Both poses are drawn as smooth solid silhouettes in one fill color —
  // no internal outlines. The soft rim that keeps the cat visible on the
  // dark ground comes from a CSS drop-shadow on the whole svg, so it
  // hugs the outer silhouette only.
  cat.innerHTML =
    '<div class="cat-bubble" aria-hidden="true"></div>' +
    '<svg class="cat-svg" viewBox="0 0 64 64" width="64" height="64" aria-hidden="true">' +
      '<g class="cat-rig">' +
        // side view, used while walking on the ground
        '<g class="pose-walk" fill="#201C18">' +
          '<path class="cat-tail" d="M12 44 C4 40 2 31 8 26 C12 22.5 15.5 24.5 14.5 28" fill="none" stroke="#201C18" stroke-width="4.5" stroke-linecap="round"/>' +
          '<rect class="leg leg-a" x="17" y="46" width="4.5" height="16" rx="2.2"/>' +
          '<rect class="leg leg-b" x="25" y="46" width="4.5" height="16" rx="2.2"/>' +
          '<rect class="leg leg-a" x="36" y="46" width="4.5" height="16" rx="2.2"/>' +
          '<rect class="leg leg-b" x="44" y="46" width="4.5" height="16" rx="2.2"/>' +
          // torso with an arched back, blending into the shoulders
          '<path d="M13 47 C13 38 21 32.5 31 32.5 C41 32.5 48.5 36 51 42 C52.5 46 51.5 50 47 51.5 C40 53.5 22 53.5 16.5 51 C14 50 13 48.5 13 47 Z"/>' +
          '<circle cx="51" cy="32" r="9.5"/>' +
          '<polygon points="45,26 43,17.5 50,23"/>' +
          '<polygon points="57,26 59,17.5 52,23"/>' +
          '<circle class="cat-eyes" cx="48.5" cy="31" r="1.5" fill="#D9A84E"/>' +
          '<circle class="cat-eyes" cx="54.5" cy="31" r="1.5" fill="#D9A84E"/>' +
        '</g>' +
        // perched in the moon: slim profile body, face turned to the
        // viewer, tail draped over the moon's edge and hanging down
        '<g class="pose-sit" fill="#201C18">' +
          '<path d="M16 58 C11 62 9 67 9.5 73 C10 78 14 79 15 74.5 C15.8 71 14.5 66 16 62" fill="none" stroke="#201C18" stroke-width="4.5" stroke-linecap="round"/>' +
          '<path d="M42 62 C44 50 44.5 36 43 24 L34 20 C25 24 15.5 33 13 45 C11 52 12 58 15 62 Z"/>' +
          '<circle cx="39" cy="12" r="9.5"/>' +
          '<polygon points="31.5,6.5 30.5,0.5 37,3.5"/>' +
          '<polygon points="46.5,6.5 47.5,0.5 41,3.5"/>' +
          '<circle class="cat-eyes" cx="35.5" cy="12" r="1.6" fill="#D9A84E"/>' +
          '<circle class="cat-eyes" cx="42.5" cy="12" r="1.6" fill="#D9A84E"/>' +
          '<g stroke="#93A184" stroke-width="0.8" stroke-opacity="0.5">' +
            '<path d="M25.5 14 L31.5 13.5"/><path d="M25.5 17.5 L31.5 16"/>' +
            '<path d="M52.5 14 L46.5 13.5"/><path d="M52.5 17.5 L46.5 16"/>' +
          '</g>' +
        '</g>' +
      '</g>' +
    '</svg>';

  var svg = cat.querySelector(".cat-svg");
  var bubble = cat.querySelector(".cat-bubble");
  var seatEl = document.querySelector(".moon-seat");
  var heroArt = seatEl ? seatEl.parentElement : null;

  function rand(min, max) { return min + Math.random() * (max - min); }
  function clamp(v, min, max) { return Math.max(min, Math.min(max, v)); }

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

  // ---- state ----
  // mode: "seated" | "ground" | "hopdown" | "hopup"
  var mode = "init";
  var desiredSeated = null;
  var x = 24, dir = 1, target = 0, walking = false;
  var pauseUntil = 0, busyUntil = 0;
  var hop = null;
  var rafId = null, lastTime = 0;

  function setWalking(on) {
    walking = on;
    cat.classList.toggle("walking", on);
  }
  function maxX() { return Math.max(12, window.innerWidth - GROUND_SIZE - 12); }
  function catSize() { return parseFloat(svg.getAttribute("width")); }

  // scale the cat to the moon when seated (the hero shrinks on mobile)
  function sizeForSeat() {
    var w = heroArt.getBoundingClientRect().width;
    var s = Math.round(clamp(w * 0.16, 40, 72));
    svg.setAttribute("width", s);
    svg.setAttribute("height", s);
  }
  function sizeForGround() {
    svg.setAttribute("width", GROUND_SIZE);
    svg.setAttribute("height", GROUND_SIZE);
  }

  // ---- mode changes ----
  function seat() {
    cat.classList.add("seated");
    cat.classList.remove("walking", "leaping", "landing", "stretching");
    sizeForSeat();
    cat.style.position = "absolute";
    cat.style.left = "0";
    cat.style.top = "0";
    cat.style.right = "auto";
    cat.style.bottom = "auto";
    cat.style.transform = "";        // CSS translate(-50%,-100%) takes over
    svg.style.transform = "";        // face the moon's opening
    seatEl.appendChild(cat);
    mode = "seated";
  }

  function ground(x0) {
    document.body.appendChild(cat);
    cat.classList.remove("seated", "leaping");
    sizeForGround();
    cat.style.position = "fixed";
    cat.style.left = "0";
    cat.style.right = "auto";
    cat.style.top = "auto";
    cat.style.bottom = "4px";
    x = clamp(x0, 12, maxX());
    cat.style.transform = "translateX(" + x + "px)";
    setWalking(false);
    mode = "ground";
  }

  function hopDown() {
    var r = cat.getBoundingClientRect();
    document.body.appendChild(cat);
    cat.classList.remove("seated");
    sizeForGround();
    cat.style.position = "fixed";
    cat.style.left = "0";
    cat.style.top = "0";
    cat.style.right = "auto";
    cat.style.bottom = "auto";
    // leap a little toward the middle of the page
    var xT = clamp(r.left + (r.left > window.innerWidth / 2 ? -70 : 70), 12, maxX());
    hop = { x0: r.left, y0: r.top, xT: xT, t0: performance.now(), dur: 750 };
    svg.style.transform = xT < r.left ? "scaleX(-1)" : "";
    cat.classList.add("leaping");
    mode = "hopdown";
  }

  function hopUp() {
    var r = cat.getBoundingClientRect();
    cat.classList.remove("walking", "stretching", "landing");
    sizeForSeat();
    cat.style.top = "0";
    cat.style.bottom = "auto";
    hop = { x0: r.left, y0: r.top, t0: performance.now(), dur: 750 };
    cat.classList.add("leaping");
    mode = "hopup";
  }

  // ---- reconcile where the cat is vs. where it should be ----
  function syncState() {
    if (desiredSeated === null) return;
    if (mode === "seated" && !desiredSeated) hopDown();
    else if (mode === "ground" && desiredSeated) hopUp();
    // transitions resolve themselves and re-check on arrival
  }

  // ---- petting ----
  function react() {
    var now = performance.now();
    if (now < busyUntil || mode === "hopdown" || mode === "hopup") return;
    busyUntil = now + 700;
    if (mode === "seated") {
      // perched cats do not perform. A word is all you get.
      say(WORDS[(Math.random() * WORDS.length) | 0]);
      return;
    }
    pauseUntil = now + rand(4000, 9000);
    setWalking(false);
    if (Math.random() < 0.25) {
      cat.classList.remove("poof"); void cat.offsetWidth;
      cat.classList.add("poof");
      say("!!", 900);
    } else {
      cat.classList.remove("hop"); void cat.offsetWidth;
      cat.classList.add("hop");
      say(WORDS[(Math.random() * WORDS.length) | 0]);
    }
  }
  cat.addEventListener("click", react);
  cat.addEventListener("keydown", function (e) {
    if (e.key === "Enter" || e.key === " ") { e.preventDefault(); react(); }
  });
  cat.addEventListener("animationend", function (e) {
    if (e.animationName === "cat-hop" || e.animationName === "cat-poof") {
      cat.classList.remove("hop", "poof");
    } else if (e.animationName === "cat-land") {
      cat.classList.remove("landing");
      cat.classList.add("stretching");     // land → big stretch
    } else if (e.animationName === "cat-stretch") {
      cat.classList.remove("stretching");
    }
  });

  // ---- ground wandering ----
  function pickTarget() {
    target = rand(12, maxX());
    dir = target > x ? 1 : -1;
    svg.style.transform = dir < 0 ? "scaleX(-1)" : "";
    setWalking(true);
  }

  // ---- the one loop that drives everything ----
  function tick(now) {
    var dt = Math.min((now - lastTime) / 1000, 0.05);
    lastTime = now;

    if (mode === "ground") {
      if (walking) {
        x += dir * 38 * dt;
        if ((dir > 0 && x >= target) || (dir < 0 && x <= target)) {
          x = target;
          setWalking(false);
          pauseUntil = now + rand(7000, 18000);
        }
        cat.style.transform = "translateX(" + x + "px)";
      } else if (now > pauseUntil && now > busyUntil &&
                 !cat.classList.contains("stretching") &&
                 !cat.classList.contains("landing")) {
        pickTarget();
      }
    } else if (mode === "hopdown") {
      var t = clamp((now - hop.t0) / hop.dur, 0, 1);
      var yT = window.innerHeight - GROUND_SIZE - 4;
      var cx = hop.x0 + (hop.xT - hop.x0) * t;
      // accelerating fall with a small initial rise
      var cy = hop.y0 + (yT - hop.y0) * t * t - 45 * 4 * t * (1 - t);
      cat.style.transform = "translate(" + cx + "px," + cy + "px)";
      if (t >= 1) {
        ground(hop.xT);
        cat.classList.add("landing");      // squash → stretch → wander
        pauseUntil = now + 2600;
        syncState();
      }
    } else if (mode === "hopup") {
      var t2 = clamp((now - hop.t0) / hop.dur, 0, 1);
      // chase the seat's live position — the page may still be scrolling
      var sr = seatEl.getBoundingClientRect();
      var s = catSize();
      var xT2 = sr.left - s / 2;
      var yT2 = sr.top - s;
      var ss = t2 * t2 * (3 - 2 * t2);   // smoothstep
      var cx2 = hop.x0 + (xT2 - hop.x0) * ss;
      var cy2 = hop.y0 + (yT2 - hop.y0) * ss - 55 * 4 * t2 * (1 - t2);
      svg.style.transform = xT2 < hop.x0 - 8 ? "scaleX(-1)" : "";
      cat.style.transform = "translate(" + cx2 + "px," + cy2 + "px)";
      if (t2 >= 1) {
        seat();
        syncState();
      }
    }
    // seated: nothing to do per-frame — the cat is being perfectly still

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

  // ---- wire up ----
  document.body.appendChild(cat);

  // No moon on this page (e.g. product pages): the cat has simply
  // wandered over from the homepage. Ground mode from the start.
  if (!seatEl) {
    if (reduceMotion.matches) {
      ground(24);
      cat.classList.add("resting");
      cat.style.left = "auto";
      cat.style.right = "18px";
      cat.style.transform = "";
      return;
    }
    ground(24);
    start();
  } else {
    // Reduced motion: the cat lives in the moon, permanently still.
    if (reduceMotion.matches) {
      seat();
      return;
    }
    // Initial placement without animation, based on where the page loaded.
    var hr = heroArt.getBoundingClientRect();
    var visible = Math.max(0, Math.min(hr.bottom, window.innerHeight) - Math.max(hr.top, 0));
    if (hr.height > 0 && visible / hr.height >= 0.3) seat();
    else ground(24);

    // Then let the moon's visibility drive everything.
    new IntersectionObserver(function (entries) {
      desiredSeated = entries[0].intersectionRatio >= 0.3;
      syncState();
    }, { threshold: [0, 0.3, 0.6] }).observe(heroArt);

    start();
  }

  document.addEventListener("visibilitychange", function () {
    if (document.hidden) stop(); else start();
  });
  window.addEventListener("resize", function () {
    if (mode === "seated") sizeForSeat();
    else if (mode === "ground") {
      x = clamp(x, 12, maxX());
      cat.style.transform = "translateX(" + x + "px)";
    }
  });
  reduceMotion.addEventListener("change", function (e) {
    if (e.matches) {
      stop();
      if (seatEl) seat();
      setWalking(false);
    } else {
      start();
    }
  });
})();
