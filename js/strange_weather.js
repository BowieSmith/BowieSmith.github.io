// Strange Weather
// ------------------------------------------------------------------
// A living gallery of strange attractors. Thousands of particles drift
// along the invisible geometry of a chaotic map, and because the map's
// four parameters slowly breathe over time (and lean toward your cursor),
// the form never settles -- it metamorphoses endlessly, like weather.
//
// Three classic 2D attractor maps are on offer -- Clifford, de Jong, and
// Svensson. Each takes a point (x, y) and four numbers (a, b, c, d) and
// hands back the next point. Iterated over a cloud of particles, with old
// positions fading slowly, the attractor draws itself in light.
// ------------------------------------------------------------------

(function () {
  "use strict";

  const canvas = document.getElementById("sky");
  const ctx = canvas.getContext("2d");

  // ---- the maps ------------------------------------------------------
  // Each family gives the update rule, a name for its equations, and how
  // far its attractor tends to wander (used to fit it on screen).
  const FAMILIES = {
    clifford: {
      name: "clifford",
      extent: 3.0,
      eq: "x' = sin(a·y) + c·cos(a·x)&nbsp;&nbsp;&nbsp;y' = sin(b·x) + d·cos(b·y)",
      step: function (x, y, a, b, c, d, out) {
        out[0] = Math.sin(a * y) + c * Math.cos(a * x);
        out[1] = Math.sin(b * x) + d * Math.cos(b * y);
      }
    },
    dejong: {
      name: "de jong",
      extent: 2.4,
      eq: "x' = sin(a·y) − cos(b·x)&nbsp;&nbsp;&nbsp;y' = sin(c·x) − cos(d·y)",
      step: function (x, y, a, b, c, d, out) {
        out[0] = Math.sin(a * y) - Math.cos(b * x);
        out[1] = Math.sin(c * x) - Math.cos(d * y);
      }
    },
    svensson: {
      name: "svensson",
      extent: 2.4,
      eq: "x' = d·sin(a·x) − sin(b·y)&nbsp;&nbsp;&nbsp;y' = c·cos(a·x) + cos(b·y)",
      step: function (x, y, a, b, c, d, out) {
        out[0] = d * Math.sin(a * x) - Math.sin(b * y);
        out[1] = c * Math.cos(a * x) + Math.cos(b * y);
      }
    }
  };

  let familyKey = "clifford";
  let family = FAMILIES[familyKey];

  // ---- particle cloud ------------------------------------------------
  const COUNT = 14000;
  const px = new Float32Array(COUNT);
  const py = new Float32Array(COUNT);
  const out = [0, 0];

  function scatter() {
    for (let i = 0; i < COUNT; i++) {
      px[i] = (Math.random() - 0.5) * 0.2;
      py[i] = (Math.random() - 0.5) * 0.2;
    }
  }

  // ---- parameters that breathe ---------------------------------------
  // The four live parameters ease toward a target each frame. When the
  // cursor is idle the target is a slow autonomous drift (each parameter
  // a sine wave of its own frequency and phase); when you move the mouse,
  // a and b lean toward the cursor so you can steer the weather.
  const params = [-1.4, 1.6, 1.0, 0.7];
  const target = params.slice();
  let base = [-1.4, 1.6, 1.0, 0.7];
  let amp = [0.9, 0.9, 0.6, 0.6];
  let phase = [0, 1.7, 3.1, 4.6];
  const FREQ = [0.00011, 0.00013, 0.00007, 0.00009];

  let mouseX = 0.5, mouseY = 0.5, lastMove = -1e9;

  function newWeather() {
    for (let k = 0; k < 4; k++) {
      base[k] = (Math.random() * 2 - 1) * 1.7;
      amp[k] = 0.4 + Math.random() * 0.9;
      phase[k] = Math.random() * Math.PI * 2;
    }
    scatter();
  }

  // ---- appearance ----------------------------------------------------
  let hue = 210;            // drifts continuously; old trails keep their colour
  let fadeAlpha = 0.055;    // how quickly old light dims -> trail length
  let paused = false;

  // ---- canvas sizing -------------------------------------------------
  let W = 0, H = 0, cx = 0, cy = 0, scale = 1;
  function resize() {
    W = canvas.width = window.innerWidth;
    H = canvas.height = window.innerHeight;
    cx = W / 2;
    cy = H / 2;
    scale = Math.min(W, H) / (2 * family.extent) * 0.92;
    // wipe to black on resize so we don't stretch old pixels
    ctx.fillStyle = "#04050a";
    ctx.fillRect(0, 0, W, H);
  }
  window.addEventListener("resize", resize);

  // ---- pointer steering ----------------------------------------------
  function pointerMove(clientX, clientY) {
    mouseX = clientX / window.innerWidth;
    mouseY = clientY / window.innerHeight;
    lastMove = performance.now();
  }
  window.addEventListener("pointermove", (e) => pointerMove(e.clientX, e.clientY));

  // ---- the loop ------------------------------------------------------
  const readEq = document.getElementById("eq");
  const readParams = document.getElementById("params");
  let uiTick = 0;

  function frame(now) {
    if (!paused) {
      // 1. update parameter targets
      const steering = now - lastMove < 3500;
      for (let k = 0; k < 4; k++) {
        target[k] = base[k] + amp[k] * Math.sin(now * FREQ[k] + phase[k]);
      }
      if (steering) {
        // map cursor onto the first two parameters, in [-2, 2]
        target[0] = (mouseX * 2 - 1) * 2.0;
        target[1] = (mouseY * 2 - 1) * 2.0;
      }
      for (let k = 0; k < 4; k++) {
        params[k] += (target[k] - params[k]) * 0.03;
      }

      // 2. dim the previous frame a touch, leaving trails
      ctx.globalCompositeOperation = "source-over";
      ctx.fillStyle = "rgba(4, 5, 10, " + fadeAlpha + ")";
      ctx.fillRect(0, 0, W, H);

      // 3. advance every particle one step of the map and plot it
      hue = (hue + 0.15) % 360;
      const a = params[0], b = params[1], c = params[2], d = params[3];
      ctx.globalCompositeOperation = "lighter";

      // two interleaved colour layers (a hue and its near-complement) give
      // the accumulated image depth without recolouring per particle
      for (let layer = 0; layer < 2; layer++) {
        ctx.fillStyle = "hsla(" +
          ((hue + layer * 150) % 360) + ", 85%, 62%, 0.32)";
        for (let i = layer; i < COUNT; i += 2) {
          family.step(px[i], py[i], a, b, c, d, out);
          let nx = out[0], ny = out[1];
          if (!(nx === nx) || !(ny === ny) || nx > 1e3 || nx < -1e3) {
            // a diverged particle: reseed it near the origin
            nx = (Math.random() - 0.5) * 0.2;
            ny = (Math.random() - 0.5) * 0.2;
          }
          px[i] = nx;
          py[i] = ny;
          ctx.fillRect(cx + nx * scale, cy + ny * scale, 1, 1);
        }
      }

      // 4. occasional readout refresh
      if ((uiTick++ & 31) === 0) {
        readParams.textContent =
          "a " + a.toFixed(2) + "   b " + b.toFixed(2) +
          "   c " + c.toFixed(2) + "   d " + d.toFixed(2);
      }
    }
    requestAnimationFrame(frame);
  }

  // ---- controls ------------------------------------------------------
  const famButtons = document.querySelectorAll("[data-family]");
  famButtons.forEach((btn) => {
    btn.addEventListener("click", () => {
      familyKey = btn.dataset.family;
      family = FAMILIES[familyKey];
      famButtons.forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      readEq.innerHTML = family.eq;
      scale = Math.min(W, H) / (2 * family.extent) * 0.92;
      scatter();
    });
  });

  document.getElementById("weather_btn").addEventListener("click", newWeather);

  const pauseBtn = document.getElementById("pause_btn");
  pauseBtn.addEventListener("click", () => {
    paused = !paused;
    pauseBtn.textContent = paused ? "resume" : "pause";
  });

  const trailSlider = document.getElementById("trails");
  trailSlider.addEventListener("input", () => {
    // higher slider = longer trails = slower fade
    fadeAlpha = 0.14 - parseFloat(trailSlider.value);
  });

  // ---- go ------------------------------------------------------------
  resize();
  scatter();
  readEq.innerHTML = family.eq;
  document.querySelector('[data-family="clifford"]').classList.add("active");
  requestAnimationFrame(frame);
})();
