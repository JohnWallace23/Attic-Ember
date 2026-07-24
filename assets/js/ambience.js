/* ==========================================================================
   Attic & Ember — hearth ambience
   A soft fire crackle, synthesized live with the Web Audio API (no audio
   file, no licensing, loops forever with no seam). A bed of filtered
   brown noise = the fire's roar; randomly scheduled pops = the crackle.

   Manners:
     - Browsers block sound until the first user gesture, so we arm and
       fade in on first interaction rather than on load.
     - A header toggle mutes/unmutes; the choice is remembered.
     - Low volume, gentle fades, pauses when the tab is hidden.
     - Defaults OFF for visitors who prefer reduced motion.
   ========================================================================== */
(function () {
  "use strict";

  var reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  var STORE_KEY = "ae-sound";

  // Intent: on unless the visitor previously chose otherwise, or prefers
  // reduced motion (in which case we don't surprise them with sound).
  var stored = null;
  try { stored = localStorage.getItem(STORE_KEY); } catch (e) {}
  var soundOn = stored ? stored === "on" : !reduceMotion.matches;

  var MASTER = 0.85;          // overall ceiling
  var ctx = null, master = null, crackleBus = null;
  var playing = false;        // audio currently producing sound
  var started = false;        // first-gesture start has happened
  var crackleTimer = null;

  // ---- build the audio graph on demand (needs a user gesture) ----
  function ensureAudio() {
    if (ctx) return;
    var AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    ctx = new AC();

    master = ctx.createGain();
    master.gain.value = 0;      // fade up from silence
    master.connect(ctx.destination);

    // --- airy bed: quiet white-noise hiss, rumble removed, gently
    //     "breathing" so the fire's air swells and settles. NOT a low
    //     roar (that read as traffic). ---
    var bedSecs = 3;
    var bedBuf = ctx.createBuffer(1, Math.floor(ctx.sampleRate * bedSecs), ctx.sampleRate);
    var bed = bedBuf.getChannelData(0);
    for (var i = 0; i < bed.length; i++) bed[i] = Math.random() * 2 - 1;
    var bedSrc = ctx.createBufferSource();
    bedSrc.buffer = bedBuf;
    bedSrc.loop = true;
    var hp = ctx.createBiquadFilter();       // kill the sub rumble
    hp.type = "highpass";
    hp.frequency.value = 220;
    hp.Q.value = 0.5;
    var lp = ctx.createBiquadFilter();       // soften the top hiss
    lp.type = "lowpass";
    lp.frequency.value = 3400;
    lp.Q.value = 0.3;
    var bedGain = ctx.createGain();
    bedGain.gain.value = 0.045;              // very quiet
    bedSrc.connect(hp).connect(lp).connect(bedGain).connect(master);
    bedSrc.start();
    // slow breathing: an LFO nudging the bed level up and down
    var lfo = ctx.createOscillator();
    lfo.frequency.value = 0.13 + Math.random() * 0.08;
    var lfoGain = ctx.createGain();
    lfoGain.gain.value = 0.02;
    lfo.connect(lfoGain).connect(bedGain.gain);
    lfo.start();

    // shared bus so crackle pops sit at a consistent level
    crackleBus = ctx.createGain();
    crackleBus.gain.value = 0.9;
    crackleBus.connect(master);
  }

  // ---- one spike: a single short click of noise with a fast exponential
  //      decay, through a *lowpass* (low Q) so it reads as a woody tick,
  //      never a resonant metallic ting. ---
  function spike(when, cutoff, dur, level) {
    var n = Math.max(1, Math.floor(ctx.sampleRate * dur));
    var buf = ctx.createBuffer(1, n, ctx.sampleRate);
    var d = buf.getChannelData(0);
    var decay = 16 + Math.random() * 26;
    for (var i = 0; i < n; i++) {
      d[i] = (Math.random() * 2 - 1) * Math.exp(-decay * (i / n));
    }
    var src = ctx.createBufferSource();
    src.buffer = buf;
    var f = ctx.createBiquadFilter();
    f.type = "lowpass";
    f.frequency.value = cutoff;
    f.Q.value = 0.6;
    var g = ctx.createGain();
    g.gain.value = level;
    src.connect(f).connect(g).connect(crackleBus);
    src.start(when);
  }

  // ---- a crackle event = a little cluster of ticks (the "sputter"),
  //      sometimes with a deeper low spit. This clustered stutter is the
  //      signature of fire, versus one clean pop. ---
  function crackle() {
    if (!playing || !ctx) return;
    var t0 = ctx.currentTime + 0.002;
    var ticks = 2 + Math.floor(Math.random() * 5);
    for (var k = 0; k < ticks; k++) {
      var when = t0 + k * (0.004 + Math.random() * 0.02);
      var hi = Math.random() < 0.55;                 // mix of high ticks + mid crackles
      var cutoff = hi ? 2600 + Math.random() * 3200 : 1100 + Math.random() * 1400;
      var level = (hi ? 0.06 : 0.12) + Math.random() * 0.1;
      spike(when, cutoff, 0.006 + Math.random() * 0.028, level);
    }
    if (Math.random() < 0.16) {                       // occasional deep "spit"
      spike(t0, 260 + Math.random() * 320, 0.05 + Math.random() * 0.06, 0.16 + Math.random() * 0.12);
    }
    crackleTimer = setTimeout(crackle, 60 + Math.random() * 480);
  }

  function ramp(to, secs) {
    if (!master) return;
    var t = ctx.currentTime;
    master.gain.cancelScheduledValues(t);
    master.gain.setValueAtTime(master.gain.value, t);
    master.gain.linearRampToValueAtTime(to, t + secs);
  }

  function play() {
    ensureAudio();
    if (!ctx) return;
    if (ctx.state === "suspended") ctx.resume();
    started = true;
    if (!playing) {
      playing = true;
      ramp(MASTER, 1.6);        // gentle fade in
      crackle();
    }
    setBtn();
  }

  function stop() {
    if (!playing) { setBtn(); return; }
    playing = false;
    clearTimeout(crackleTimer);
    ramp(0, 0.5);               // fade out, then idle the context
    var c = ctx;
    setTimeout(function () { if (!playing && c && c.state === "running") c.suspend(); }, 600);
    setBtn();
  }

  // ---- the header toggle button (built by JS = progressive enhancement) ----
  var btn = document.createElement("button");
  btn.className = "sound-toggle";
  btn.type = "button";
  btn.innerHTML =
    '<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">' +
      '<path class="spk" d="M4 9 h3 l4 -3.5 v13 l-4 -3.5 H4 Z" fill="currentColor"/>' +
      '<g class="waves" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round">' +
        '<path d="M15 9.5 C16.4 10.8 16.4 13.2 15 14.5"/>' +
        '<path d="M17.5 7.5 C20 9.8 20 14.2 17.5 16.5"/>' +
      '</g>' +
      '<line class="slash" x1="3" y1="3" x2="21" y2="21" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>' +
    '</svg>';

  function setBtn() {
    var on = soundOn;
    btn.classList.toggle("muted", !on);
    btn.classList.toggle("awaiting", on && !started);   // gentle pulse until it starts
    btn.setAttribute("aria-pressed", on ? "true" : "false");
    btn.setAttribute("aria-label", on ? "Mute the fire crackle" : "Play the fire crackle");
    btn.title = on ? "Sound on — click to mute" : "Sound off — click to play";
  }

  btn.addEventListener("click", function () {
    soundOn = !soundOn;
    try { localStorage.setItem(STORE_KEY, soundOn ? "on" : "off"); } catch (e) {}
    if (soundOn) play(); else stop();
  });

  // place it at the top-right, alongside the cart
  var headerRight = document.querySelector(".header-right");
  if (headerRight) headerRight.appendChild(btn);
  else document.body.appendChild(btn);
  setBtn();

  // ---- arm first-gesture start (only if the visitor wants sound on) ----
  function firstGesture() {
    removeGesture();
    if (soundOn) play();
  }
  function removeGesture() {
    ["pointerdown", "keydown", "touchstart", "wheel"].forEach(function (ev) {
      window.removeEventListener(ev, firstGesture);
    });
  }
  if (soundOn) {
    ["pointerdown", "keydown", "touchstart", "wheel"].forEach(function (ev) {
      window.addEventListener(ev, firstGesture, { passive: true, once: false });
    });
  }

  // ---- pause while the tab is hidden, resume if sound is on ----
  document.addEventListener("visibilitychange", function () {
    if (!ctx) return;
    if (document.hidden) {
      if (ctx.state === "running") ctx.suspend();
    } else if (playing && soundOn) {
      ctx.resume();
    }
  });
})();
