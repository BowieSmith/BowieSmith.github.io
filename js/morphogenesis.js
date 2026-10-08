// The Ten Thousand Things
// ------------------------------------------------------------------
// A generative morphogenesis piece. Its engine is the Gray-Scott
// reaction-diffusion model -- the mechanism Alan Turing proposed in
// "The Chemical Basis of Morphogenesis" (1952): two chemicals, one that
// builds and one that dissolves, diffusing at different speeds until a
// featureless medium spontaneously breaks symmetry into pattern.
//
// Around that engine we hang the other voices:
//   * Tao Te Ching / Alan Watts -- the two morphogens are activator and
//     inhibitor, yin and yang; from their interplay the ten thousand
//     forms arise, and they arise without being forced (wu wei).
//   * Claude Shannon -- we measure the field's Shannon entropy in bits,
//     the uncertainty in where the pattern will be found.
//   * Karl Friston -- we measure the field's "free energy" as the rate
//     at which it is still surprising itself; a self-organizing system
//     drives this down as it settles into the form that evidences it.
//   * Michael Levin -- the pattern's morphology is an attractor. Wound
//     it with the cursor and it navigates back toward its own shape
//     (anatomical homeostasis).
// ------------------------------------------------------------------

(function () {
  "use strict";

  // ---- grid ----------------------------------------------------------
  // Kept modest so the whole thing runs in vanilla JS at animation speed;
  // the canvas is scaled up in CSS, and smoothing lends a soft, living glow.
  const COLS = 200;
  const ROWS = 150;
  const N = COLS * ROWS;

  // Two morphogen concentration fields, plus scratch buffers for the
  // next timestep. u is the substrate (the fed medium); v is the
  // self-catalysing pattern-former.
  let u = new Float32Array(N);
  let v = new Float32Array(N);
  let u2 = new Float32Array(N);
  let v2 = new Float32Array(N);

  // Diffusion rates. v spreads more slowly than u -- the short-range
  // activator / long-range inhibitor asymmetry that makes Turing patterns
  // possible in the first place.
  const DU = 0.16;
  const DV = 0.08;

  // Feed and kill rates -- the two forces whose balance chooses which of
  // the ten thousand forms appears. These are the live parameters.
  let feed = 0.0545;
  let kill = 0.062;

  const SUBSTEPS = 8; // reaction-diffusion iterations per rendered frame
  let running = true;

  // ---- the void, and the seed ---------------------------------------
  // "The nameless is the origin of heaven and earth."
  // Begin full of substrate (u = 1) and empty of pattern (v = 0): the
  // uncarved block. Then drop a seed -- the One -- and let the Two arise.
  function toVoid() {
    for (let i = 0; i < N; i++) {
      u[i] = 1.0;
      v[i] = 0.0;
    }
  }

  function seed(cx, cy, radius) {
    for (let y = -radius; y <= radius; y++) {
      for (let x = -radius; x <= radius; x++) {
        if (x * x + y * y > radius * radius) continue;
        const gx = ((cx + x) % COLS + COLS) % COLS;
        const gy = ((cy + y) % ROWS + ROWS) % ROWS;
        const i = gy * COLS + gx;
        // A little noise so the symmetry-breaking has something to bite on.
        v[i] = 0.5 + Math.random() * 0.25;
        u[i] = 0.25;
      }
    }
  }

  function seedInitial() {
    toVoid();
    seed(COLS >> 1, ROWS >> 1, 8);
    // A few wandering seeds so the field feels sown rather than stamped.
    for (let s = 0; s < 4; s++) {
      seed(
        (Math.random() * COLS) | 0,
        (Math.random() * ROWS) | 0,
        3 + (Math.random() * 4) | 0
      );
    }
  }

  // ---- one reaction-diffusion step ----------------------------------
  // The Laplacian is taken on a torus (edges wrap), so the field is a
  // seamless whole with no privileged boundary -- one field, not a framed
  // picture. Weights: 0.2 to orthogonal neighbours, 0.05 to diagonals.
  function step() {
    let churn = 0; // accumulates |dv|: the field's rate of self-surprise

    for (let y = 0; y < ROWS; y++) {
      const yUp = (y - 1 + ROWS) % ROWS;
      const yDn = (y + 1) % ROWS;
      const rowUp = yUp * COLS;
      const rowDn = yDn * COLS;
      const row = y * COLS;

      for (let x = 0; x < COLS; x++) {
        const xL = (x - 1 + COLS) % COLS;
        const xR = (x + 1) % COLS;

        const i = row + x;
        const iUp = rowUp + x;
        const iDn = rowDn + x;

        const uc = u[i];
        const vc = v[i];

        // Laplacian of u and v via the 3x3 weighted stencil.
        const lapU =
          0.2 * (u[row + xL] + u[row + xR] + u[iUp] + u[iDn]) +
          0.05 * (u[rowUp + xL] + u[rowUp + xR] + u[rowDn + xL] + u[rowDn + xR]) -
          uc;
        const lapV =
          0.2 * (v[row + xL] + v[row + xR] + v[iUp] + v[iDn]) +
          0.05 * (v[rowUp + xL] + v[rowUp + xR] + v[rowDn + xL] + v[rowDn + xR]) -
          vc;

        // The reaction: v consumes u autocatalytically (uvv), u is fed
        // back toward 1, v is killed off toward 0.
        const uvv = uc * vc * vc;
        let nu = uc + (DU * lapU - uvv + feed * (1 - uc));
        let nv = vc + (DV * lapV + uvv - (kill + feed) * vc);

        if (nu < 0) nu = 0; else if (nu > 1) nu = 1;
        if (nv < 0) nv = 0; else if (nv > 1) nv = 1;

        u2[i] = nu;
        v2[i] = nv;
        const d = nv - vc;
        churn += d < 0 ? -d : d;
      }
    }

    // swap buffers
    let tu = u; u = u2; u2 = tu;
    let tv = v; v = v2; v2 = tv;

    return churn / N; // mean |dv| this substep
  }

  // ---- Shannon entropy of the field ---------------------------------
  // Bin the v concentrations and compute H = -sum p log2 p. High when the
  // pattern is rich and unpredictable, low when the field is uniform.
  const BINS = 24;
  const hist = new Float64Array(BINS);
  function shannonEntropy() {
    hist.fill(0);
    for (let i = 0; i < N; i++) {
      let b = (v[i] * BINS) | 0;
      if (b >= BINS) b = BINS - 1;
      hist[b]++;
    }
    let h = 0;
    for (let b = 0; b < BINS; b++) {
      if (hist[b] === 0) continue;
      const p = hist[b] / N;
      h -= p * Math.log2(p);
    }
    return h; // bits, in [0, log2(BINS)]
  }

  // ---- rendering -----------------------------------------------------
  const canvas = document.getElementById("field");
  canvas.width = COLS;
  canvas.height = ROWS;
  const ctx = canvas.getContext("2d");
  const image = ctx.createImageData(COLS, ROWS);
  const pixels = image.data;

  // A bioelectric colour ramp: from the near-black void up through deep
  // teal to a pale gold at the pattern's crests -- a nod to Levin's living
  // voltage maps.
  const STOPS = [
    [0.0, 8, 12, 16],
    [0.25, 16, 44, 52],
    [0.45, 26, 92, 96],
    [0.65, 70, 158, 140],
    [0.85, 190, 206, 150],
    [1.0, 238, 236, 214]
  ];

  function ramp(t, out) {
    if (t <= 0) { out[0] = STOPS[0][1]; out[1] = STOPS[0][2]; out[2] = STOPS[0][3]; return; }
    if (t >= 1) { const s = STOPS[STOPS.length - 1]; out[0] = s[1]; out[1] = s[2]; out[2] = s[3]; return; }
    for (let k = 1; k < STOPS.length; k++) {
      if (t <= STOPS[k][0]) {
        const a = STOPS[k - 1], b = STOPS[k];
        const f = (t - a[0]) / (b[0] - a[0]);
        out[0] = a[1] + (b[1] - a[1]) * f;
        out[1] = a[2] + (b[2] - a[2]) * f;
        out[2] = a[3] + (b[3] - a[3]) * f;
        return;
      }
    }
  }

  const rgb = [0, 0, 0];
  function render() {
    for (let i = 0; i < N; i++) {
      // Pattern lives around v ~ 0.0..0.4; scale so it fills the ramp.
      let t = v[i] * 2.6;
      if (t > 1) t = 1;
      ramp(t, rgb);
      const p = i << 2;
      pixels[p] = rgb[0];
      pixels[p + 1] = rgb[1];
      pixels[p + 2] = rgb[2];
      pixels[p + 3] = 255;
    }
    ctx.putImageData(image, 0, 0);
  }

  // ---- free-energy sparkline ----------------------------------------
  const spark = document.getElementById("spark");
  const sctx = spark.getContext("2d");
  const SPARK_LEN = 160;
  const history = new Float32Array(SPARK_LEN);
  let histHead = 0;

  function pushHistory(val) {
    history[histHead] = val;
    histHead = (histHead + 1) % SPARK_LEN;
  }

  function drawSpark() {
    const w = spark.width, h = spark.height;
    sctx.clearRect(0, 0, w, h);
    // autoscale to the recent maximum so the decay stays visible
    let max = 1e-6;
    for (let i = 0; i < SPARK_LEN; i++) if (history[i] > max) max = history[i];
    sctx.beginPath();
    for (let i = 0; i < SPARK_LEN; i++) {
      const idx = (histHead + i) % SPARK_LEN;
      const x = (i / (SPARK_LEN - 1)) * w;
      const y = h - (history[idx] / max) * (h - 4) - 2;
      if (i === 0) sctx.moveTo(x, y); else sctx.lineTo(x, y);
    }
    sctx.strokeStyle = "#7fb0a3";
    sctx.lineWidth = 1.5;
    sctx.shadowColor = "rgba(127,176,163,0.7)";
    sctx.shadowBlur = 6;
    sctx.stroke();
    sctx.shadowBlur = 0;
  }

  // ---- readouts ------------------------------------------------------
  const feValue = document.getElementById("fe_value");
  const entValue = document.getElementById("ent_value");
  let uiTick = 0;

  // ---- main loop -----------------------------------------------------
  function frame() {
    if (running) {
      let churn = 0;
      for (let s = 0; s < SUBSTEPS; s++) churn = step();
      render();

      // Free energy: the field's remaining rate of self-surprise. As the
      // pattern settles into its attractor this falls; a wound makes it
      // spike, then it falls again as the form heals.
      pushHistory(churn);
      drawSpark();

      if ((uiTick++ & 7) === 0) {
        feValue.textContent = (churn * 1000).toFixed(2) + " m";
        entValue.textContent = shannonEntropy().toFixed(2) + " bits";
      }
    }
    requestAnimationFrame(frame);
  }

  // ---- interaction: wounding and sowing -----------------------------
  // Painting on the field injects v -- at once a wound and a fresh seed.
  // Watch the morphology reassert itself: the shape is the goal.
  let painting = false;

  function paintAt(clientX, clientY) {
    const rect = canvas.getBoundingClientRect();
    const gx = ((clientX - rect.left) / rect.width * COLS) | 0;
    const gy = ((clientY - rect.top) / rect.height * ROWS) | 0;
    seed(gx, gy, 5);
  }

  canvas.addEventListener("pointerdown", (e) => {
    painting = true;
    canvas.setPointerCapture(e.pointerId);
    paintAt(e.clientX, e.clientY);
  });
  canvas.addEventListener("pointermove", (e) => {
    if (painting) paintAt(e.clientX, e.clientY);
  });
  canvas.addEventListener("pointerup", () => { painting = false; });
  canvas.addEventListener("pointerleave", () => { painting = false; });

  // ---- controls ------------------------------------------------------
  const feedSlider = document.getElementById("feed");
  const killSlider = document.getElementById("kill");

  function syncSliders() {
    feedSlider.value = feed;
    killSlider.value = kill;
  }
  feedSlider.addEventListener("input", () => {
    feed = parseFloat(feedSlider.value);
    clearPresetHighlight();
  });
  killSlider.addEventListener("input", () => {
    kill = parseFloat(killSlider.value);
    clearPresetHighlight();
  });

  // The ten thousand things: named regimes of the same two forces.
  const PRESETS = {
    coral:     { feed: 0.0545, kill: 0.0620 },
    mitosis:   { feed: 0.0367, kill: 0.0649 },
    labyrinth: { feed: 0.0290, kill: 0.0570 },
    spots:     { feed: 0.0300, kill: 0.0620 },
    flow:      { feed: 0.0250, kill: 0.0600 },
    bloom:     { feed: 0.0390, kill: 0.0580 }
  };

  const presetButtons = document.querySelectorAll("[data-preset]");
  function clearPresetHighlight() {
    presetButtons.forEach((b) => b.classList.remove("active"));
  }
  presetButtons.forEach((btn) => {
    btn.addEventListener("click", () => {
      const p = PRESETS[btn.dataset.preset];
      if (!p) return;
      feed = p.feed;
      kill = p.kill;
      syncSliders();
      clearPresetHighlight();
      btn.classList.add("active");
    });
  });

  document.getElementById("seed_btn").addEventListener("click", seedInitial);
  document.getElementById("void_btn").addEventListener("click", toVoid);
  const pauseBtn = document.getElementById("pause_btn");
  pauseBtn.addEventListener("click", () => {
    running = !running;
    pauseBtn.textContent = running ? "pause" : "resume";
  });

  // ---- contemplations ------------------------------------------------
  // Six voices circling one thing: how form arises and holds itself
  // against the tide of entropy.
  const VOICES = [
    { q: "The Tao gives birth to the One. The One gives birth to the Two. The Two give birth to the ten thousand things.",
      s: "Tao Te Ching, ch. 42" },
    { q: "A system of chemical substances, reacting together and diffusing, is adequate to account for the main phenomena of morphogenesis.",
      s: "Alan Turing, 1952" },
    { q: "We do not come into this world; we grow out of it, as leaves grow out of a tree.",
      s: "Alan Watts" },
    { q: "To persist is to resist surprise — a living thing must, in a sense, predict itself into being.",
      s: "after Karl Friston, the Free Energy Principle" },
    { q: "Information is the resolution of uncertainty. Surprise is the logarithm of the improbable.",
      s: "after Claude Shannon" },
    { q: "Each cell is a small agent, navigating toward the shape the whole remembers.",
      s: "after Michael Levin" },
    { q: "The named is the mother of the ten thousand things; the nameless, their origin.",
      s: "Tao Te Ching, ch. 1" },
    { q: "The way does nothing, and yet nothing is left undone.",
      s: "Tao Te Ching, ch. 37" }
  ];

  const quoteEl = document.getElementById("quote");
  const sourceEl = document.getElementById("source");
  let voiceIdx = 0;

  function showVoice() {
    quoteEl.classList.add("fade_out");
    sourceEl.classList.add("fade_out");
    setTimeout(() => {
      const voice = VOICES[voiceIdx];
      quoteEl.textContent = "“" + voice.q + "”";
      sourceEl.textContent = voice.s;
      quoteEl.classList.remove("fade_out");
      sourceEl.classList.remove("fade_out");
      voiceIdx = (voiceIdx + 1) % VOICES.length;
    }, 1400);
  }

  // ---- go ------------------------------------------------------------
  syncSliders();
  presetButtons.forEach((b) => { if (b.dataset.preset === "coral") b.classList.add("active"); });
  seedInitial();
  showVoice();
  setInterval(showVoice, 10000);
  requestAnimationFrame(frame);
})();
