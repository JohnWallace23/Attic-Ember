/* ==========================================================================
   Attic & Ember — seasonal paper garland
   A string of paper pennants swagged under the header, like the Beistle
   letter bunting the shop sells. The middle pennants spell out the season's
   greeting; plain ones carry the string out to either edge. Shows itself by
   month and takes itself down afterwards, so nobody has to remember to.

   Drawn by script rather than at build time on purpose: the site only
   rebuilds when something is pushed, so a build-time date check would
   leave October's garland up until the next unrelated change.

   Purely decorative — no pointer events, hidden from assistive tech, and
   still under prefers-reduced-motion.
   ========================================================================== */
(function () {
  "use strict";

  var tag = document.querySelector("script[data-garland]");
  var setting = ((tag && tag.getAttribute("data-garland")) || "auto").trim().toLowerCase();

  // Each holiday: paper colours, and the greeting spelled across the middle
  // (a space becomes a pennant with a star, so the words read apart). The
  // page ground is near-black, so there's no black pennant — it would
  // vanish. Plum stands in for it.
  var SEASONS = {
    halloween: {
      colours: ["#C9622D", "#6A4C82", "#D9A84E", "#EDE3D0"],
      message: "HAPPY HALLOWEEN"
    },
    // Cranberry and the light sage rather than the site's darker rust and
    // sage: on the night-brown ground those two barely separate from it.
    holidays: {
      colours: ["#A8423A", "#93A184", "#EDE3D0", "#D9A84E"],
      message: "HAPPY HOLIDAYS"
    }
  };
  // Which season "auto" hangs. Months are 0-indexed: 9 is October, 11 December.
  var BY_MONTH = { 9: "halloween", 11: "holidays" };

  var name = setting === "auto" ? BY_MONTH[new Date().getMonth()] : setting;
  var season = SEASONS[name];
  if (!season) return;

  var anchor = document.querySelector(".site-header + .scallop");
  if (!anchor) return;

  var SVGNS = "http://www.w3.org/2000/svg";
  var holder = document.createElement("div");
  holder.className = "garland";
  holder.setAttribute("aria-hidden", "true");
  anchor.parentNode.insertBefore(holder, anchor.nextSibling);

  // Letter colour per paper colour, chosen for contrast: ink on the light
  // papers, cream on the dark ones.
  var INK = { "#6A4C82": "#EDE3D0", "#A8423A": "#EDE3D0" };
  function letterColour(paper) { return INK[paper] || "#17120E"; }

  // Stable "handmade" wobble: the same pennant gets the same tilt and size
  // every time it's redrawn, so a resize doesn't reshuffle the whole string.
  function jitter(i, k) {
    var x = Math.sin(i * 12.9898 + k * 78.233) * 43758.5453;
    return x - Math.floor(x);       // 0..1
  }

  function el(tagName, attrs) {
    var n = document.createElementNS(SVGNS, tagName);
    for (var a in attrs) n.setAttribute(a, attrs[a]);
    return n;
  }

  // Pennants spaced evenly along one swag from x0 to x1.
  function swag(x0, x1, top, sag, count) {
    var cx = (x0 + x1) / 2, cy = top + sag * 2, slots = [];
    for (var k = 0; k < count; k++) {
      var t = (k + 1) / (count + 1), u = 1 - t;
      var dx = 2 * u * (cx - x0) + 2 * t * (x1 - cx);
      var dy = 2 * u * (cy - top) + 2 * t * (top - cy);
      slots.push({
        x: u * u * x0 + 2 * u * t * cx + t * t * x1,
        y: u * u * top + 2 * u * t * cy + t * t * top,
        ang: Math.atan2(dy, dx) * 180 / Math.PI
      });
    }
    return { line: [x0, x1, cx, cy], slots: slots };
  }

  // Plain swags filling the stretch from x0 to x1.
  function plainRun(x0, x1, top, sag, gap, swagLen) {
    var width = x1 - x0, out = [];
    if (width < gap) return out;
    var n = Math.max(1, Math.round(width / swagLen)), span = width / n;
    for (var s = 0; s < n; s++) {
      var count = Math.max(1, Math.floor((span - gap * 0.6) / gap));
      out.push(swag(x0 + s * span, x0 + (s + 1) * span, top, sag, count));
    }
    return out;
  }

  function draw() {
    var W = document.documentElement.clientWidth;
    var small = W < 560;
    var swagLen = small ? 150 : 230;
    var sag = small ? 8 : 13;
    var pw = small ? 21 : 32;
    var ph = small ? 26 : 39;
    var gap = small ? 26 : 40;
    var top = 6;
    var msg = season.message.split("");

    // The greeting hangs on one long swag of its own, so the tacks between
    // plain swags can't chop it into "HAP · PY · HALLO". On a narrow phone,
    // pull the letters closer (and a touch smaller) until it spans the width.
    var msgSpan = gap * (msg.length + 1);
    if (msgSpan > W) {
      gap = Math.max(16, W / (msg.length + 1));
      pw = Math.min(pw, gap - 2);
      ph = Math.round(pw * 1.22);
      msgSpan = gap * (msg.length + 1);
    }
    var side = (W - msgSpan) / 2;
    if (side < gap * 1.5) { side = 0; msgSpan = W; }   // no room for plain flags
    var msgSag = small ? sag + 4 : sag + 9;            // a long banner droops more

    var groups = plainRun(0, side, top, sag, gap, swagLen)
      .map(function (g) { g.plain = true; return g; });
    var banner = swag(side, side + msgSpan, top, msgSag, msg.length);
    groups.push(banner);
    groups = groups.concat(plainRun(side + msgSpan, W, top, sag, gap, swagLen)
      .map(function (g) { g.plain = true; return g; }));

    var H = top + msgSag + ph + 10;
    var slots = [];
    groups.forEach(function (g) {
      g.slots.forEach(function (sl, i) {
        sl.ch = g === banner ? msg[i] : null;
        slots.push(sl);
      });
    });

    var svg = el("svg", { width: W, height: H, viewBox: "0 0 " + W + " " + H });
    var strings = el("g", {}), flags = el("g", {}), tacks = el("g", {});
    var tackR = small ? 2.2 : 2.8;

    groups.forEach(function (g) {
      var sw = g.line;
      strings.appendChild(el("path", {
        d: "M" + sw[0] + " " + top + " Q" + sw[2] + " " + sw[3] + " " + sw[1] + " " + top,
        fill: "none", stroke: "#EDE3D0", "stroke-opacity": "0.45", "stroke-width": "1.2"
      }));
      tacks.appendChild(el("circle", { cx: sw[0], cy: top, r: tackR, fill: "#D9A84E" }));
    });
    tacks.appendChild(el("circle", { cx: W, cy: top, r: tackR, fill: "#D9A84E" }));

    slots.forEach(function (slot, idx) {
      var ch = slot.ch;
      var paper = season.colours[idx % season.colours.length];
      // letters hang a little straighter than the plain flags, to stay legible
      var wob = (jitter(idx, 1) - 0.5) * (ch ? 3 : 6);
      var w = pw * (0.94 + jitter(idx, 2) * 0.12);
      var h = ph * (0.94 + jitter(idx, 3) * 0.12);

      var place = el("g", {
        transform: "translate(" + slot.x.toFixed(1) + " " + slot.y.toFixed(1) + ") rotate(" + (slot.ang + wob).toFixed(1) + ")"
      });
      var sway = el("g", { "class": "garland-flag" });
      sway.style.animationDelay = (-jitter(idx, 4) * 4).toFixed(2) + "s";
      sway.style.animationDuration = (3.6 + jitter(idx, 5) * 1.6).toFixed(2) + "s";
      sway.appendChild(el("polygon", { points: (-w / 2) + ",0 " + (w / 2) + ",0 0," + h, fill: paper }));
      // one half a shade darker, like paper folded over the string
      sway.appendChild(el("polygon", { points: "0,0 " + (w / 2) + ",0 0," + h, fill: "#000", "fill-opacity": "0.14" }));

      if (ch === " ") {
        // the gap between words: the hero's four-point sparkle
        var r = w * 0.2, cy = h * 0.34;
        sway.appendChild(el("path", {
          d: "M0 " + (cy - r) + " L" + (r * 0.28) + " " + (cy - r * 0.28) + " L" + r + " " + cy +
             " L" + (r * 0.28) + " " + (cy + r * 0.28) + " L0 " + (cy + r) + " L" + (-r * 0.28) + " " + (cy + r * 0.28) +
             " L" + (-r) + " " + cy + " L" + (-r * 0.28) + " " + (cy - r * 0.28) + " Z",
          fill: letterColour(paper)
        }));
      } else if (ch) {
        var fs = h * 0.44;
        var letter = el("text", {
          x: "0", y: (h * 0.31 + fs * 0.36).toFixed(1),
          "text-anchor": "middle", "font-family": "Rye, Georgia, serif",
          "font-size": fs.toFixed(1), fill: letterColour(paper)
        });
        letter.textContent = ch;
        sway.appendChild(letter);
      }
      place.appendChild(sway);
      flags.appendChild(place);
    });

    svg.appendChild(strings);
    svg.appendChild(flags);
    svg.appendChild(tacks);
    holder.innerHTML = "";
    holder.appendChild(svg);
  }

  draw();
  var t;
  window.addEventListener("resize", function () {
    clearTimeout(t);
    t = setTimeout(draw, 150);
  });
})();
