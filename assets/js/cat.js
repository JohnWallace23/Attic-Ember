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
  // Cute is proportions: big head, huge gold slit-pupil eyes, tall ears
  // with inner-ear color, tiny nose, plump body, rosy cheeks, a little
  // collar. Solid silhouettes, no internal outlines — the rim comes from
  // a CSS drop-shadow hugging the outer edge.
  cat.innerHTML =
    '<div class="cat-bubble" aria-hidden="true"></div>' +
    '<svg class="cat-svg" viewBox="0 0 64 64" width="64" height="64" aria-hidden="true">' +
      '<g class="cat-rig">' +
        // side view, used while walking on the ground
        '<g class="pose-walk">' +
          '<path class="cat-tail" d="M12 44 C4 40 2 31 8 26 C12 22.5 15.5 24.5 14.5 28" fill="none" stroke="#201C18" stroke-width="4.5" stroke-linecap="round"/>' +
          '<g fill="#201C18">' +
            '<rect class="leg leg-a" x="16" y="46" width="5" height="16" rx="2.4"/>' +
            '<rect class="leg leg-b" x="24" y="46" width="5" height="16" rx="2.4"/>' +
            '<rect class="leg leg-a" x="35" y="46" width="5" height="16" rx="2.4"/>' +
            '<rect class="leg leg-b" x="43" y="46" width="5" height="16" rx="2.4"/>' +
            '<path d="M12 48 C12 40 19 35 30 35 C40 35 46.5 38 49.5 43 C51.5 47 50.5 51 45 52.5 C37 54.5 20 54.5 15.5 52 C13 50.5 12 49.5 12 48 Z"/>' +
            '<circle cx="47" cy="25" r="11"/>' +
            '<polygon points="39.5,17.5 38.5,7 47,13"/>' +
            '<polygon points="54.5,17.5 56.5,7 48.5,13"/>' +
          '</g>' +
          '<polygon points="41.5,15.5 41,10 45.5,13.2" fill="#B4726B" opacity="0.85"/>' +
          '<g class="cat-eye">' +
            '<ellipse cx="49.5" cy="24" rx="3.4" ry="3.9" fill="#EDB94F"/>' +
            '<ellipse cx="49.5" cy="24" rx="1.1" ry="3" fill="#201C18"/>' +
            '<circle cx="48.3" cy="22.6" r="0.7" fill="#EDE3D0" opacity="0.9"/>' +
          '</g>' +
          '<circle cx="42.5" cy="29.5" r="1.6" fill="#C9622D" opacity="0.55"/>' +
          '<polygon points="57.2,25.5 58.8,26.8 57,27.8" fill="#B4726B"/>' +
          '<path d="M41 33.5 Q46.5 36.5 52.5 34.5 L52.5 37.5 Q46.5 39.5 41 36.5 Z" fill="#C9622D"/>' +
          '<circle cx="47" cy="38" r="1.6" fill="#D9A84E"/>' +
        '</g>' +
        // perched in the moon: plump front-facing sit, tail draped over
        // the moon\'s edge and hanging down
        '<g class="pose-sit">' +
          '<path class="sit-tail" d="M16 58 C11 62 9 67 9.5 73 C10 78 14 79 15 74.5 C15.8 71 14.5 66 16 62" fill="none" stroke="#201C18" stroke-width="4.5" stroke-linecap="round"/>' +
          '<g fill="#201C18">' +
            '<path d="M20 62 C13.5 56 12.5 45 17 37.5 C20 32 26 28.5 32 28.5 C38 28.5 44 32 47 37.5 C51.5 45 50.5 56 44 62 Z"/>' +
            '<circle cx="32" cy="17" r="12.5"/>' +
            '<polygon points="22,9.5 19,0.5 29.5,5.5"/>' +
            '<polygon points="42,9.5 45,0.5 34.5,5.5"/>' +
          '</g>' +
          '<polygon points="23.2,7.8 21.5,2.8 27.5,5.6" fill="#B4726B" opacity="0.85"/>' +
          '<polygon points="40.8,7.8 42.5,2.8 36.5,5.6" fill="#B4726B" opacity="0.85"/>' +
          '<g class="cat-eye">' +
            '<ellipse cx="26" cy="17.5" rx="4.1" ry="4.5" fill="#EDB94F"/>' +
            '<ellipse cx="26" cy="17.5" rx="1.2" ry="3.4" fill="#201C18"/>' +
            '<circle cx="24.6" cy="15.8" r="0.8" fill="#EDE3D0" opacity="0.9"/>' +
          '</g>' +
          '<g class="cat-eye">' +
            '<ellipse cx="38" cy="17.5" rx="4.1" ry="4.5" fill="#EDB94F"/>' +
            '<ellipse cx="38" cy="17.5" rx="1.2" ry="3.4" fill="#201C18"/>' +
            '<circle cx="36.6" cy="15.8" r="0.8" fill="#EDE3D0" opacity="0.9"/>' +
          '</g>' +
          '<polygon points="30.6,23.5 33.4,23.5 32,25.4" fill="#B4726B"/>' +
          '<path d="M30 26.6 Q31 27.6 32 26.6 Q33 27.6 34 26.6" fill="none" stroke="#EDE3D0" stroke-width="0.7" stroke-opacity="0.4"/>' +
          '<circle cx="20" cy="21.5" r="1.9" fill="#C9622D" opacity="0.5"/>' +
          '<circle cx="44" cy="21.5" r="1.9" fill="#C9622D" opacity="0.5"/>' +
          '<g stroke="#93A184" stroke-width="0.8" stroke-opacity="0.5">' +
            '<path d="M13.5 19 L20 18.5"/><path d="M13.5 22.5 L20 21"/>' +
            '<path d="M50.5 19 L44 18.5"/><path d="M50.5 22.5 L44 21"/>' +
          '</g>' +
          '<path d="M24 28.8 Q32 32.3 40 28.8 L40 32 Q32 35.5 24 32 Z" fill="#C9622D"/>' +
          '<circle cx="32" cy="33.8" r="2" fill="#D9A84E"/>' +
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

  function hopDur(dx, dy) {
    return clamp(Math.sqrt(dx * dx + dy * dy) * 0.9 + 320, 500, 950);
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
    cat.style.transform = "translate(" + r.left + "px," + r.top + "px)";
    // leap a little toward the middle of the page
    var xT = clamp(r.left + (r.left > window.innerWidth / 2 ? -70 : 70), 12, maxX());
    var yT = window.innerHeight - GROUND_SIZE - 4;
    // anticipation: crouch for a beat (t0 in the future), then launch
    hop = { x0: r.left, y0: r.top, xT: xT,
            t0: performance.now() + 170, dur: hopDur(xT - r.left, yT - r.top) };
    svg.style.transform = xT < r.left ? "scaleX(-1)" : "";
    cat.classList.add("crouch");
    mode = "hopdown";
  }

  function hopUp() {
    var r = cat.getBoundingClientRect();
    var sr = seatEl.getBoundingClientRect();
    cat.classList.remove("walking", "stretching", "landing");
    cat.style.top = "0";
    cat.style.bottom = "auto";
    cat.style.transform = "translate(" + r.left + "px," + r.top + "px)";
    hop = { x0: r.left, y0: r.top,
            t0: performance.now() + 170, dur: hopDur(sr.left - r.left, sr.top - r.top) };
    cat.classList.add("crouch");
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
      // a settle-beat between landing and stretching — cats don't rush
      setTimeout(function () {
        if (mode === "ground") cat.classList.add("stretching");
      }, 280);
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
      var t = (now - hop.t0) / hop.dur;
      if (t >= 0 && cat.classList.contains("crouch")) {
        cat.classList.remove("crouch");    // launch!
        cat.classList.add("leaping");
      }
      if (t >= 0) {
        t = clamp(t, 0, 1);
        var yT = window.innerHeight - GROUND_SIZE - 4;
        var cx = hop.x0 + (hop.xT - hop.x0) * t;
        // ballistic: accelerating fall with a launch rise at the start
        var cy = hop.y0 + (yT - hop.y0) * t * t - 50 * 4 * t * (1 - t);
        cat.style.transform = "translate(" + cx + "px," + cy + "px)";
        if (t >= 1) {
          cat.classList.remove("leaping");
          ground(hop.xT);
          cat.classList.add("landing");    // squash, settle, then stretch
          pauseUntil = now + 3200;
          syncState();
        }
      }
    } else if (mode === "hopup") {
      var t2 = (now - hop.t0) / hop.dur;
      if (t2 >= 0 && cat.classList.contains("crouch")) {
        cat.classList.remove("crouch");    // spring!
        cat.classList.add("leaping");
        sizeForSeat();
      }
      if (t2 >= 0) {
        t2 = clamp(t2, 0, 1);
        // chase the seat's live position — the page may still be scrolling
        var sr = seatEl.getBoundingClientRect();
        var s = catSize();
        var xT2 = sr.left - s / 2;
        var yT2 = sr.top - s;
        // fast initial spring that settles at the top
        var ss = 1 - (1 - t2) * (1 - t2) * (1 - t2);
        var cx2 = hop.x0 + (xT2 - hop.x0) * ss;
        var cy2 = hop.y0 + (yT2 - hop.y0) * ss - 55 * 4 * t2 * (1 - t2);
        svg.style.transform = xT2 < hop.x0 - 8 ? "scaleX(-1)" : "";
        cat.style.transform = "translate(" + cx2 + "px," + cy2 + "px)";
        if (t2 >= 1) {
          cat.classList.remove("leaping");
          seat();
          syncState();
        }
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
