/* ==========================================================================
   Attic & Ember — drifting embers
   A lightweight canvas layer of warm embers rising behind the page.
   Design goals: subtle, cozy, and cheap to run.
     - No libraries. Just canvas + requestAnimationFrame.
     - Fully skipped when the visitor prefers reduced motion.
     - Loop pauses while the tab is hidden (saves battery/CPU).
     - Particle count scales to screen size, with a hard cap.
   ========================================================================== */
(function () {
  "use strict";

  // Respect the visitor's motion preference — if they'd rather not have
  // animation, we never build the canvas at all.
  var reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  if (reduceMotion.matches) return;

  // Warm ember colors, pulled from the site's palette (pumpkin + gold).
  var COLORS = ["#C9622D", "#B98A2E", "#E0A24E"];

  var canvas = document.createElement("canvas");
  canvas.className = "atmosphere-canvas";
  canvas.setAttribute("aria-hidden", "true");
  var ctx = canvas.getContext("2d");
  document.body.appendChild(canvas);

  var width = 0, height = 0, dpr = 1;
  var embers = [];
  var rafId = null;
  var lastTime = 0;

  // Random helper
  function rand(min, max) { return min + Math.random() * (max - min); }

  // How many embers to draw — sparse, scaled to viewport, capped so big
  // screens never get busy or slow.
  function targetCount() {
    return Math.min(30, Math.round((width * height) / 46000));
  }

  // Create one ember, starting somewhere in/below the viewport.
  function makeEmber(startBelow) {
    return {
      x: rand(0, width),
      y: startBelow ? rand(height, height + 60) : rand(0, height),
      r: rand(1, 3),                       // radius in px
      speed: rand(8, 26),                  // upward px per second
      driftAmp: rand(6, 22),               // horizontal sway distance
      driftSpeed: rand(0.3, 0.9),          // sway frequency
      phase: rand(0, Math.PI * 2),         // sway offset so they don't sync
      baseAlpha: rand(0.15, 0.5),          // faint by design
      flicker: rand(0.6, 1.4),             // per-ember flicker speed
      color: COLORS[(Math.random() * COLORS.length) | 0]
    };
  }

  // Size the canvas to the window, accounting for high-DPI screens (but
  // capping DPR at 2 so retina displays don't pay a huge fill-rate cost).
  function resize() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    width = window.innerWidth;
    height = window.innerHeight;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    canvas.style.width = width + "px";
    canvas.style.height = height + "px";
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    // Rebuild the ember pool to match the new size.
    var count = targetCount();
    embers = [];
    for (var i = 0; i < count; i++) embers.push(makeEmber(false));
  }

  function draw(now) {
    // Delta time in seconds, clamped so a long pause (e.g. tab switch)
    // can't make embers teleport on the next frame.
    var dt = Math.min((now - lastTime) / 1000, 0.05);
    lastTime = now;

    ctx.clearRect(0, 0, width, height);

    for (var i = 0; i < embers.length; i++) {
      var e = embers[i];

      // Rise, with a gentle side-to-side drift.
      e.y -= e.speed * dt;
      e.phase += e.driftSpeed * dt;
      var x = e.x + Math.sin(e.phase) * e.driftAmp;

      // Recycle embers once they float off the top.
      if (e.y < -10) {
        embers[i] = makeEmber(true);
        continue;
      }

      // Soft flicker + fade out over the top third of the screen.
      var flick = 0.75 + Math.sin(now / 1000 * e.flicker + e.phase) * 0.25;
      var fade = e.y < height * 0.33 ? e.y / (height * 0.33) : 1;
      var alpha = e.baseAlpha * flick * fade;

      // Draw each ember as a small radial glow.
      var g = ctx.createRadialGradient(x, e.y, 0, x, e.y, e.r * 3);
      g.addColorStop(0, e.color);
      g.addColorStop(1, "rgba(0,0,0,0)");
      ctx.globalAlpha = alpha;
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(x, e.y, e.r * 3, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;

    rafId = requestAnimationFrame(draw);
  }

  function start() {
    if (rafId === null) {
      lastTime = performance.now();
      rafId = requestAnimationFrame(draw);
    }
  }
  function stop() {
    if (rafId !== null) { cancelAnimationFrame(rafId); rafId = null; }
  }

  // Pause the whole animation when the tab isn't visible.
  document.addEventListener("visibilitychange", function () {
    if (document.hidden) stop(); else start();
  });

  // Debounced resize so dragging the window doesn't thrash.
  var resizeTimer;
  window.addEventListener("resize", function () {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(resize, 150);
  });

  // If the visitor turns reduced-motion ON while here, stop and clean up.
  reduceMotion.addEventListener("change", function (e) {
    if (e.matches) { stop(); ctx.clearRect(0, 0, width, height); }
    else start();
  });

  resize();
  start();
})();
