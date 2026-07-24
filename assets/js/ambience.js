/* ==========================================================================
   Attic & Ember — hearth ambience
   A real, CC0 campfire recording (assets/audio/fire-crackle.mp3) looped
   quietly behind the page, with a header mute toggle.

   Source: "Fireplace Sound Loop" by NenadSimic, OpenGameArt.org — CC0
   (public domain, no attribution required). Compressed to a small mono MP3.

   Manners:
     - Browsers block sound until the first user gesture, so we arm and
       fade in on first interaction rather than on load.
     - The MP3 only downloads when sound is actually turned on.
     - A header toggle mutes/unmutes; the choice is remembered.
     - Low volume, gentle fades, pauses when the tab is hidden.
     - Defaults OFF for visitors who prefer reduced motion.
   ========================================================================== */
(function () {
  "use strict";

  var reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  var STORE_KEY = "ae-sound";
  var MASTER = 0.7;           // ceiling volume (0..1)

  // audio file path (respects the site's baseurl via the script tag)
  var tag = document.querySelector("script[data-audio]");
  var AUDIO_URL = tag ? tag.getAttribute("data-audio") : "/assets/audio/fire-crackle.mp3";

  // Intent: on unless the visitor previously chose otherwise, or prefers
  // reduced motion (don't surprise them with sound).
  var stored = null;
  try { stored = localStorage.getItem(STORE_KEY); } catch (e) {}
  var soundOn = stored ? stored === "on" : !reduceMotion.matches;

  var audio = null;
  var playing = false;        // currently producing sound
  var started = false;        // first-gesture start has happened
  var fadeTimer = null;

  // ---- create the audio element on demand (so the MP3 only downloads
  //      once the visitor actually wants sound) ----
  function ensureAudio() {
    if (audio) return;
    audio = new Audio();
    audio.src = AUDIO_URL;
    audio.loop = true;
    audio.preload = "auto";
    audio.volume = 0;
  }

  function fadeTo(target, ms) {
    if (!audio) return;
    clearInterval(fadeTimer);
    var start = audio.volume;
    var t0 = Date.now();
    fadeTimer = setInterval(function () {
      var k = Math.min(1, (Date.now() - t0) / ms);
      audio.volume = Math.max(0, Math.min(1, start + (target - start) * k));
      if (k >= 1) {
        clearInterval(fadeTimer);
        if (target === 0) audio.pause();
      }
    }, 40);
  }

  function play() {
    ensureAudio();
    started = true;
    if (!playing) {
      playing = true;
      var p = audio.play();
      if (p && p.catch) p.catch(function () {});   // ignore autoplay rejections
      fadeTo(MASTER, 1600);      // gentle fade in
    }
    setBtn();
  }

  function stop() {
    if (playing) {
      playing = false;
      fadeTo(0, 500);            // fade out, then pause (handled in fadeTo)
    }
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
    btn.classList.toggle("muted", !soundOn);
    btn.classList.toggle("awaiting", soundOn && !started);  // pulse until it starts
    btn.setAttribute("aria-pressed", soundOn ? "true" : "false");
    btn.setAttribute("aria-label", soundOn ? "Mute the fire crackle" : "Play the fire crackle");
    btn.title = soundOn ? "Sound on — click to mute" : "Sound off — click to play";
  }

  btn.addEventListener("click", function () {
    soundOn = !soundOn;
    try { localStorage.setItem(STORE_KEY, soundOn ? "on" : "off"); } catch (e) {}
    if (soundOn) play(); else stop();
  });

  var headerRight = document.querySelector(".header-right");
  if (headerRight) headerRight.appendChild(btn);
  else document.body.appendChild(btn);
  setBtn();

  // ---- arm first-gesture start (only if the visitor wants sound on) ----
  var GESTURES = ["pointerdown", "keydown", "touchstart", "wheel"];
  function firstGesture() {
    GESTURES.forEach(function (ev) { window.removeEventListener(ev, firstGesture); });
    if (soundOn) play();
  }
  if (soundOn) {
    GESTURES.forEach(function (ev) {
      window.addEventListener(ev, firstGesture, { passive: true });
    });
  }

  // ---- pause while the tab is hidden, resume if sound is on ----
  document.addEventListener("visibilitychange", function () {
    if (!audio || !playing) return;
    if (document.hidden) {
      audio.pause();
    } else {
      var p = audio.play();
      if (p && p.catch) p.catch(function () {});
    }
  });
})();
