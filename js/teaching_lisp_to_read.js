// Teaching Lisp to Read
// ------------------------------------------------------------------
// The page's JavaScript. Lisp runs in a Web Worker (js/lisp_worker.js);
// this file asks it to evaluate things and draws what comes back.
//   1. Every <div class="cell"> becomes a runnable Lisp cell.
//   2. lisp/digits.lisp is split at its ";;;; ---- name" comments. Each
//      section is shown in the cell marked data-section="name" and run, so
//      the demos further down have a network to call.
//   3. A sample of MNIST digits and the trained weights are handed to Lisp.
//   4. The demos: watch a network learn, draw a digit, see the mistakes.
// All the arithmetic in the demos is done by the Lisp. JavaScript only
// moves pixels around and draws.
// ------------------------------------------------------------------

(function () {
  "use strict";

  const $ = (id) => document.getElementById(id);

  // ---- status ------------------------------------------------------------

  const statusEl = $("lisp_status");
  let statusTimer = 0;

  function setStatus(text, state) {
    clearTimeout(statusTimer);
    statusEl.textContent = text;
    statusEl.className = state || "";
    if (state === "ready") statusTimer = setTimeout(() => statusEl.classList.add("quiet"), 4000);
  }

  // ---- Lisp, in a worker -------------------------------------------------

  const RESTARTED = "Stopped. Lisp was restarted, and the network and the digits were " +
    "loaded again; anything else you defined will need its cell run again.";

  const Lisp = {
    worker: null,
    pending: new Map(),
    nextId: 1,
    rejectStart: null,

    // Start a fresh Lisp, throwing away the old one if there is one.
    start() {
      if (this.worker) this.worker.terminate();
      if (this.rejectStart) this.rejectStart(new Error(RESTARTED));
      for (const p of this.pending.values()) p.reject(new Error(RESTARTED));
      this.pending.clear();
      const worker = new Worker("../js/lisp_worker.js");
      this.worker = worker;
      return new Promise((resolve, reject) => {
        this.rejectStart = reject;
        worker.onmessage = (event) => {
          const m = event.data;
          if (m.type === "ready") { this.rejectStart = null; resolve(m.version); }
          else if (m.type === "failed") { this.rejectStart = null; reject(new Error(m.error)); }
          else this.settle(m);
        };
        worker.onerror = (event) => {
          event.preventDefault();
          this.rejectStart = null;
          reject(new Error(event.message || "the Lisp worker could not start"));
        };
      });
    },

    settle(m) {
      const p = this.pending.get(m.id);
      if (!p) return;
      this.pending.delete(m.id);
      if (m.error !== undefined) p.reject(new Error(m.error));
      else p.resolve(m.result);
    },

    send(message) {
      const id = this.nextId++;
      return new Promise((resolve, reject) => {
        this.pending.set(id, { resolve, reject });
        this.worker.postMessage(Object.assign({ id }, message));
      });
    },

    // Evaluate every form in TEXT, as a cell does; resolves to a report string.
    // QUIET marks the page's own code, which needs no keyword fixing.
    run(text, quiet) { return this.send({ op: "run", text, quiet: !!quiet }); },
    // Evaluate one form; resolves to its value as plain JavaScript data.
    eval(form) { return this.send({ op: "eval", form }); },
    // Bind a Lisp global variable to an array (or an array of arrays).
    define(name, value) { return this.send({ op: "define", name, value }); },
  };

  // The current Lisp's loading, as a promise, and whether it has finished.
  let lispLoaded = null;
  let lispReady = false;

  // Wait until the current Lisp is loaded. If Lisp is restarted while we
  // wait, wait for the new one instead.
  async function whenLispReady() {
    for (;;) {
      const loading = lispLoaded;
      try {
        await loading;
      } catch (e) {
        if (loading === lispLoaded) throw e;
        continue;
      }
      if (loading === lispLoaded) return;
    }
  }

  // ---- cells -------------------------------------------------------------

  const cells = [];

  function autosize(ta) {
    ta.style.height = "auto";
    ta.style.height = ta.scrollHeight + 2 + "px";
  }

  function showReport(out, report) {
    out.textContent = "";
    if (!report) {
      const span = document.createElement("span");
      span.className = "note";
      span.textContent = "(nothing to evaluate)";
      out.appendChild(span);
      return;
    }
    const lines = report.replace(/\n$/, "").split("\n");
    lines.forEach((line, i) => {
      const span = document.createElement("span");
      if (line.startsWith("=> ")) span.className = "value";
      else if (line.startsWith("!! ")) span.className = "error";
      span.textContent = line + (i < lines.length - 1 ? "\n" : "");
      out.appendChild(span);
    });
  }

  function makeCell(div) {
    let ta = div.querySelector("textarea");
    if (!ta) {
      ta = document.createElement("textarea");
      div.appendChild(ta);
    }
    ta.spellcheck = false;
    ta.setAttribute("autocapitalize", "off");
    ta.setAttribute("autocomplete", "off");
    ta.setAttribute("aria-label", "Lisp code");

    const bar = document.createElement("div");
    bar.className = "bar";
    const btn = document.createElement("button");
    btn.textContent = "run";
    const hint = document.createElement("span");
    hint.className = "hint";
    hint.textContent = /Mac|iPhone|iPad/.test(navigator.platform) ? "⌘-enter" : "ctrl-enter";
    bar.appendChild(btn);
    bar.appendChild(hint);

    const out = document.createElement("pre");
    out.className = "output";
    out.setAttribute("aria-live", "polite");

    div.appendChild(bar);
    div.appendChild(out);

    const cell = {
      div, ta, out,
      section: div.dataset.section || null,
      running: false,
      stoppable: false,

      async run() {
        if (cell.running) return;
        cell.running = true;
        cell.stoppable = false;
        div.classList.add("running");
        btn.textContent = "running…";
        let report, slow = 0;
        try {
          await whenLispReady();
          // Only a cell that has been running a while can be stopped.
          slow = setTimeout(() => { cell.stoppable = true; btn.textContent = "stop"; }, 3000);
          report = await Lisp.run(ta.value);
        } catch (e) {
          report = "!! " + e.message + "\n";
        }
        clearTimeout(slow);
        cell.running = false;
        cell.stoppable = false;
        div.classList.remove("running");
        btn.textContent = "run";
        showReport(out, report);
      },
    };

    btn.addEventListener("click", () => {
      if (!cell.running) {
        cell.run();
      } else if (cell.stoppable) {
        cell.stoppable = false;
        btn.disabled = true;
        restartLisp().finally(() => { btn.disabled = false; });
      }
    });
    ta.addEventListener("keydown", (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
        e.preventDefault();
        cell.run();
      }
    });
    ta.addEventListener("input", () => autosize(ta));
    autosize(ta);
    cells.push(cell);
    return cell;
  }

  document.querySelectorAll(".cell").forEach(makeCell);
  // A textarea measured before the fonts settle can be a line short.
  window.addEventListener("load", () => cells.forEach((c) => autosize(c.ta)));
  if (document.fonts && document.fonts.ready) {
    document.fonts.ready.then(() => cells.forEach((c) => autosize(c.ta)));
  }

  // ---- digits.lisp, split into sections ----------------------------------

  async function loadNetworkSource() {
    const res = await fetch("../lisp/digits.lisp");
    if (!res.ok) throw new Error("could not fetch lisp/digits.lisp");
    const text = await res.text();
    const sections = {};
    let name = null, lines = [];
    const flush = () => { if (name) sections[name] = lines.join("\n").trim() + "\n"; };
    for (const line of text.split("\n")) {
      const m = line.match(/^;;;; ---- (\S+)/);
      if (m) { flush(); name = m[1]; lines = []; }
      else if (name) lines.push(line);
    }
    flush();
    for (const cell of cells) {
      if (!cell.section) continue;
      cell.ta.value = sections[cell.section] ||
        ";; section '" + cell.section + "' is missing from lisp/digits.lisp\n";
      autosize(cell.ta);
    }
  }

  // ---- the sample digits -------------------------------------------------
  // data/digits-sample.png is a grid of 28x28 digits, white ink on black.
  // data/digits-sample.json says how many there are, how many columns the
  // grid has, how many of them (the first ones) are for training, and the
  // label of each. The rest are held back: they come from MNIST's test set,
  // and no network on this page ever trains on them.

  const samples = { pixels: [], labels: [], train: 0, count: 0 };

  function loadImage(src) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error("could not load " + src));
      img.src = src;
    });
  }

  async function loadSamples() {
    const res = await fetch("../data/digits-sample.json");
    if (!res.ok) throw new Error("could not fetch data/digits-sample.json");
    const meta = await res.json();
    const img = await loadImage("../data/digits-sample.png");
    const canvas = document.createElement("canvas");
    canvas.width = img.width;
    canvas.height = img.height;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    ctx.drawImage(img, 0, 0);
    const data = ctx.getImageData(0, 0, img.width, img.height).data;
    for (let k = 0; k < meta.count; k++) {
      const gx = (k % meta.cols) * 28, gy = Math.floor(k / meta.cols) * 28;
      const v = new Array(784);
      for (let y = 0; y < 28; y++) {
        for (let x = 0; x < 28; x++) {
          v[y * 28 + x] = data[((gy + y) * img.width + gx + x) * 4] / 255;
        }
      }
      samples.pixels.push(v);
    }
    samples.labels = Array.from(meta.labels, Number);
    samples.train = meta.train;
    samples.count = meta.count;
  }

  function drawDigit(canvas, pixels) {
    const ctx = canvas.getContext("2d");
    const img = ctx.createImageData(28, 28);
    for (let i = 0; i < 784; i++) {
      const v = Math.max(0, Math.min(255, Math.round(pixels[i] * 255)));
      img.data[i * 4] = img.data[i * 4 + 1] = img.data[i * 4 + 2] = v;
      img.data[i * 4 + 3] = 255;
    }
    ctx.putImageData(img, 0, 0);
  }

  function digitTile(pixels, text, labelClass) {
    const wrap = document.createElement("div");
    wrap.className = "digit";
    const c = document.createElement("canvas");
    c.width = 28;
    c.height = 28;
    drawDigit(c, pixels);
    const label = document.createElement("span");
    label.className = "label" + (labelClass ? " " + labelClass : "");
    label.textContent = text;
    wrap.appendChild(c);
    wrap.appendChild(label);
    return wrap;
  }

  let sampleOffset = 0;
  function renderSamples() {
    const host = $("samples");
    host.textContent = "";
    for (let k = 0; k < 20; k++) {
      const i = (sampleOffset + k) % samples.train;
      host.appendChild(digitTile(samples.pixels[i], String(samples.labels[i])));
    }
  }

  // ---- the trained weights -----------------------------------------------
  // Written by lisp/train.lisp: the bytes "DGW1", three little-endian
  // uint32s (inputs, hidden, outputs), then little-endian float32s: hidden
  // weights (one row of INPUTS per hidden neuron), hidden biases, output
  // weights (one row of HIDDEN per output neuron), output biases.

  let trained = null;

  async function loadWeights() {
    const res = await fetch("../data/digits.weights");
    if (!res.ok) throw new Error("could not fetch data/digits.weights");
    const buf = await res.arrayBuffer();
    const dv = new DataView(buf);
    const magic = String.fromCharCode(dv.getUint8(0), dv.getUint8(1), dv.getUint8(2), dv.getUint8(3));
    if (magic !== "DGW1") throw new Error("data/digits.weights is not in the expected format");
    const inputs = dv.getUint32(4, true), hidden = dv.getUint32(8, true), outputs = dv.getUint32(12, true);
    const floats = new Float32Array(buf.slice(16));
    let at = 0;
    const take = (n) => { const a = Array.from(floats.subarray(at, at + n)); at += n; return a; };
    const rows = (count, length) => Array.from({ length: count }, () => take(length));
    const hiddenWeights = rows(hidden, inputs);
    const hiddenBiases = take(hidden);
    const outputWeights = rows(outputs, hidden);
    const outputBiases = take(outputs);
    if (at !== floats.length) throw new Error("data/digits.weights has the wrong length");
    trained = { inputs, hidden, outputs, hiddenWeights, hiddenBiases, outputWeights, outputBiases };
  }

  // ---- putting it all into Lisp ------------------------------------------

  const HELPERS = String.raw`
(defun sample-pixels (i)
  "The pixels of sample digit number I."
  (aref *sample-pixels* i))

(defun sample-label (i)
  "Which digit sample number I really is."
  (aref *sample-labels* i))

(defparameter *held-pixels* (subseq *sample-pixels* *training-count*))
(defparameter *held-labels* (subseq *sample-labels* *training-count*))

;; The training demo checks itself on these hundred held-back digits.
(defparameter *check-pixels* (subseq *held-pixels* 0 100))
(defparameter *check-labels* (subseq *held-labels* 0 100))

(defvar *net* (make-random-network))
`;

  const TRAINED = String.raw`
(defparameter *trained*
  (make-network :hidden (make-layer :weights *trained-hidden-weights*
                                    :biases *trained-hidden-biases*)
                :output (make-layer :weights *trained-output-weights*
                                    :biases *trained-output-biases*)))
`;

  async function runQuietly(text, cell) {
    const report = await Lisp.run(text, true);
    if (report.includes("!! ")) {
      if (cell) showReport(cell.out, report);
      else console.warn(report);
    }
  }

  // The page's files are fetched once; every Lisp, including one started
  // after a restart, is loaded from them.
  let filesLoaded = null;

  async function loadFiles() {
    const weights = loadWeights().then(renderNeurons).catch((e) => {
      console.error(e);
      $("trained_readout").textContent = "the trained weights did not load";
    });
    await Promise.all([loadNetworkSource(), loadSamples(), weights]);
    renderSamples();
  }

  // Start Lisp and give it everything the page needs: the network's code
  // (from the cells, so any edits survive a restart), the digits, and the
  // trained network.
  async function loadIntoLisp() {
    lispReady = false;
    await filesLoaded;
    setStatus("lisp: starting…");
    await Lisp.start();
    setStatus("lisp: reading digits.lisp…");
    for (const cell of cells) {
      if (cell.section) await runQuietly(cell.ta.value, cell);
    }
    setStatus("lisp: reading the digits…");
    await Lisp.define("*sample-pixels*", samples.pixels);
    await Lisp.define("*sample-labels*", samples.labels);
    await runQuietly("(defparameter *training-count* " + samples.train + ")");
    await runQuietly(HELPERS);
    if (trained) {
      await Lisp.define("*trained-hidden-weights*", trained.hiddenWeights);
      await Lisp.define("*trained-hidden-biases*", trained.hiddenBiases);
      await Lisp.define("*trained-output-weights*", trained.outputWeights);
      await Lisp.define("*trained-output-biases*", trained.outputBiases);
      await runQuietly(TRAINED);
    }
    lispReady = true;
    setStatus("lisp: ready", "ready");
  }

  // Everything that needs a loaded Lisp, done after every load.
  let mistakesShown = false;

  function afterLoad() {
    measureNet(training.gen).catch(() => {});
    if (!trained) {
      verdict.textContent = "The trained network did not load, so there is nothing to read with.";
      return;
    }
    if (inked) classify();
    else verdict.textContent = "";
    if (!mistakesShown) {
      mistakesShown = true;
      showMistakes().catch((e) => {
        mistakesShown = false;
        if (e.message !== RESTARTED) {
          console.error(e);
          $("trained_readout").textContent = "Lisp could not check the held-back digits: " + e.message;
        }
      });
    }
  }

  function startLisp() {
    const loading = loadIntoLisp();
    lispLoaded = loading;
    loading.then(() => {
      if (loading === lispLoaded) afterLoad();
    }, (e) => {
      if (loading !== lispLoaded || e.message === RESTARTED) return;
      console.error(e);
      setStatus("lisp: failed to load (" + e.message + ")", "failed");
    });
    return loading;
  }

  async function restartLisp() {
    resetTrainingDisplay();
    try {
      await startLisp();
    } catch (e) {
      // startLisp has already reported it.
    }
  }

  // ---- watch it learn ----------------------------------------------------

  // gen changes whenever the network is replaced, so that a batch of
  // training already on its way to Lisp is not counted against the new one.
  const training = {
    gen: 0, loopGen: -1, running: false,
    steps: 0, next: 0, recent: [], curve: [], stride: 1, bucket: [],
  };
  const STEPS_PER_MESSAGE = 5;
  const CHECK_EVERY = 200;
  const CURVE_POINTS = 2000;
  const spark = $("loss_spark");
  const trainBtn = $("train_btn");

  function cssVar(name, fallback) {
    return getComputedStyle(document.documentElement).getPropertyValue(name).trim() || fallback;
  }

  const mean = (xs) => xs.reduce((a, b) => a + b, 0) / xs.length;

  // Each point on the curve is the mean of STRIDE steps' smoothed surprise.
  // When the curve gets long, neighbouring points are merged and the
  // stride doubles, so the points stay evenly spaced in steps.
  function recordLoss(loss) {
    training.recent.push(loss);
    if (training.recent.length > 50) training.recent.shift();
    training.bucket.push(mean(training.recent));
    if (training.bucket.length < training.stride) return;
    training.curve.push(mean(training.bucket));
    training.bucket = [];
    if (training.curve.length >= CURVE_POINTS) {
      const merged = [];
      for (let i = 0; i + 1 < training.curve.length; i += 2) {
        merged.push((training.curve[i] + training.curve[i + 1]) / 2);
      }
      training.curve = merged;
      training.stride *= 2;
    }
  }

  function drawCurve() {
    const ratio = window.devicePixelRatio || 1;
    const w = spark.clientWidth || 600, h = spark.clientHeight || 72;
    if (spark.width !== Math.round(w * ratio)) spark.width = Math.round(w * ratio);
    if (spark.height !== Math.round(h * ratio)) spark.height = Math.round(h * ratio);
    const ctx = spark.getContext("2d");
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    ctx.clearRect(0, 0, w, h);
    const top = 3.0; // surprise at the top edge of the chart
    const y = (v) => h - 3 - (Math.min(v, top) / top) * (h - 8);
    // A network that spreads its belief evenly over ten digits has surprise
    // log 10, about 2.3, on every digit. That is the line to get below.
    const guess = y(Math.log(10));
    ctx.strokeStyle = cssVar("--muted", "#888");
    ctx.globalAlpha = 0.5;
    ctx.setLineDash([3, 4]);
    ctx.beginPath();
    ctx.moveTo(0, guess);
    ctx.lineTo(w, guess);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.globalAlpha = 1;
    ctx.fillStyle = cssVar("--muted", "#888");
    ctx.font = "11px ui-monospace, Menlo, Consolas, monospace";
    ctx.textAlign = "right";
    ctx.fillText("guessing", w - 6, guess - 5);
    ctx.textAlign = "left";
    const pts = training.curve;
    if (pts.length < 2) return;
    ctx.strokeStyle = cssVar("--accent", "#2a6f97");
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    pts.forEach((v, i) => {
      const x = 1 + (i / (pts.length - 1)) * (w - 2);
      if (i === 0) ctx.moveTo(x, y(v)); else ctx.lineTo(x, y(v));
    });
    ctx.stroke();
  }

  function updateTrainButton() {
    trainBtn.textContent = training.running ? "pause" : training.steps ? "continue" : "start";
  }

  async function measureNet(gen) {
    const acc = await Lisp.eval("(accuracy *net* *check-pixels* *check-labels*)");
    if (gen === training.gen) $("acc_now").textContent = Math.round(acc * 100) + " of 100";
  }

  async function trainLoop(gen) {
    training.loopGen = gen;
    try {
      while (training.running && gen === training.gen) {
        const rate = Number($("lr").value);
        const form =
          "(let ((losses nil))" +
          " (dotimes (k " + STEPS_PER_MESSAGE + " (nreverse losses))" +
          "  (let ((i (mod (+ " + training.next + " k) *training-count*)))" +
          "   (push (train-step *net* (sample-pixels i) (sample-label i) " + rate + ") losses))))";
        let losses;
        try {
          losses = await Lisp.eval(form);
        } catch (e) {
          if (gen === training.gen) {
            training.running = false;
            $("train_note").textContent = "Lisp said: " + e.message;
            updateTrainButton();
          }
          return;
        }
        if (gen !== training.gen) return;
        losses.forEach(recordLoss);
        training.next = (training.next + losses.length) % samples.train;
        training.steps += losses.length;
        $("steps").textContent = String(training.steps);
        $("loss_now").textContent = mean(training.recent).toFixed(2);
        drawCurve();
        if (training.steps % CHECK_EVERY === 0) {
          try { await measureNet(gen); } catch (e) { return; }
        }
      }
    } finally {
      if (training.loopGen === gen) training.loopGen = -1;
    }
  }

  // Forget the network being trained and everything shown about it.
  function resetTrainingDisplay() {
    training.gen++;
    training.running = false;
    training.steps = 0;
    training.next = 0;
    training.recent = [];
    training.curve = [];
    training.stride = 1;
    training.bucket = [];
    $("steps").textContent = "0";
    $("loss_now").textContent = "–";
    $("acc_now").textContent = "–";
    $("train_note").textContent = "";
    updateTrainButton();
    drawCurve();
  }

  trainBtn.addEventListener("click", async () => {
    if (training.running) {
      training.running = false;
      updateTrainButton();
      return;
    }
    training.running = true;
    updateTrainButton();
    $("train_note").textContent = "";
    const gen = training.gen;
    try {
      await whenLispReady();
    } catch (e) {
      training.running = false;
      updateTrainButton();
      return;
    }
    // Clicked again while waiting, or the network was replaced.
    if (!training.running || gen !== training.gen) return;
    // A loop still finishing its last batch picks up again by itself.
    if (training.loopGen !== gen) trainLoop(gen);
  });

  $("reset_btn").addEventListener("click", async () => {
    resetTrainingDisplay();
    const gen = training.gen;
    try {
      await whenLispReady();
      await Lisp.eval("(setf *net* (make-random-network))");
      if (gen === training.gen) await measureNet(gen);
    } catch (e) {
      // Lisp was restarted; it starts with a fresh network anyway.
    }
  });

  $("lr").addEventListener("input", () => {
    $("lr_value").textContent = Number($("lr").value).toFixed(2);
  });
  window.addEventListener("resize", drawCurve);

  // ---- the hidden neurons ------------------------------------------------
  // Each hidden neuron has 784 weights, one per pixel, so each can be drawn
  // as a 28 x 28 picture: blue where ink excites it, red where ink quiets it.

  function renderNeurons() {
    const host = $("neurons");
    host.textContent = "";
    const dark = window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches;
    const bg = dark ? [30, 30, 30] : [244, 242, 236];
    const pos = dark ? [124, 196, 234] : [42, 111, 151];
    const neg = dark ? [224, 138, 126] : [181, 82, 59];
    for (const w of trained.hiddenWeights) {
      const c = document.createElement("canvas");
      c.width = 28;
      c.height = 28;
      const ctx = c.getContext("2d");
      const img = ctx.createImageData(28, 28);
      const scale = Math.max(...w.map(Math.abs)) || 1;
      for (let i = 0; i < 784; i++) {
        const t = w[i] / scale;
        const col = t >= 0 ? pos : neg;
        const a = Math.min(1, Math.abs(t));
        for (let ch = 0; ch < 3; ch++) img.data[i * 4 + ch] = Math.round(bg[ch] + (col[ch] - bg[ch]) * a);
        img.data[i * 4 + 3] = 255;
      }
      ctx.putImageData(img, 0, 0);
      host.appendChild(c);
    }
  }

  // ---- your turn: the draw pad -------------------------------------------

  const pad = $("pad");
  const pctx = pad.getContext("2d", { willReadFrequently: true });
  const seen = $("seen");
  const bars = $("bars");
  const verdict = $("verdict");
  let drawing = false, last = null, inked = false;
  let padGen = 0; // changes when the pad is cleared

  function clearPad() {
    padGen++;
    again = false;
    pctx.fillStyle = "#000";
    pctx.fillRect(0, 0, pad.width, pad.height);
    inked = false;
    verdict.textContent = lispReady ? "" : "waiting for Lisp…";
    renderBars(null);
    drawDigit(seen, new Array(784).fill(0));
  }

  function padPoint(e) {
    const r = pad.getBoundingClientRect();
    return [(e.clientX - r.left) * pad.width / r.width, (e.clientY - r.top) * pad.height / r.height];
  }

  pad.addEventListener("pointerdown", (e) => {
    drawing = true;
    pad.setPointerCapture(e.pointerId);
    last = padPoint(e);
    pctx.strokeStyle = "#fff";
    pctx.lineWidth = 24;
    pctx.lineCap = "round";
    pctx.lineJoin = "round";
    pctx.beginPath();
    pctx.moveTo(last[0], last[1]);
    pctx.lineTo(last[0] + 0.01, last[1]);
    pctx.stroke();
    inked = true;
    classify();
  });
  pad.addEventListener("pointermove", (e) => {
    if (!drawing) return;
    const p = padPoint(e);
    pctx.beginPath();
    pctx.moveTo(last[0], last[1]);
    pctx.lineTo(p[0], p[1]);
    pctx.stroke();
    last = p;
    classify();
  });
  const finish = () => {
    if (!drawing) return;
    drawing = false;
    classify();
  };
  pad.addEventListener("pointerup", finish);
  pad.addEventListener("pointercancel", finish);
  $("clear_pad").addEventListener("click", clearPad);

  // Crop the drawing to its ink, shrink it so its longer side is 20 pixels
  // (averaging the pixels each new pixel covers), and put it on a 28 x 28
  // square, as MNIST did. Lisp then moves it so its center of mass is where
  // MNIST put it.
  function padTo28() {
    const w = pad.width, h = pad.height;
    const data = pctx.getImageData(0, 0, w, h).data;
    const ink = new Float32Array(w * h);
    let minX = w, minY = h, maxX = -1, maxY = -1;
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const v = data[(y * w + x) * 4] / 255;
        ink[y * w + x] = v;
        if (v > 0.05) {
          if (x < minX) minX = x;
          if (x > maxX) maxX = x;
          if (y < minY) minY = y;
          if (y > maxY) maxY = y;
        }
      }
    }
    if (maxX < 0) return null;
    const cw = maxX - minX + 1, ch = maxY - minY + 1;
    const scale = 20 / Math.max(cw, ch);
    const tw = Math.max(1, Math.round(cw * scale)), th = Math.max(1, Math.round(ch * scale));
    const ox = Math.floor((28 - tw) / 2), oy = Math.floor((28 - th) / 2);
    const out = new Array(784).fill(0);
    let peak = 0;
    for (let ty = 0; ty < th; ty++) {
      const y0 = minY + ty / scale, y1 = Math.min(minY + ch, minY + (ty + 1) / scale);
      for (let tx = 0; tx < tw; tx++) {
        const x0 = minX + tx / scale, x1 = Math.min(minX + cw, minX + (tx + 1) / scale);
        // Average the source pixels this target pixel covers, each weighted
        // by how much of it is covered.
        let sum = 0, area = 0;
        for (let y = Math.floor(y0); y < Math.ceil(y1); y++) {
          const fy = Math.min(y + 1, y1) - Math.max(y, y0);
          for (let x = Math.floor(x0); x < Math.ceil(x1); x++) {
            const f = fy * (Math.min(x + 1, x1) - Math.max(x, x0));
            sum += f * ink[y * w + x];
            area += f;
          }
        }
        const v = area > 0 ? sum / area : 0;
        out[(oy + ty) * 28 + ox + tx] = v;
        if (v > peak) peak = v;
      }
    }
    // Nearly every MNIST digit has at least one pixel of full ink.
    if (peak > 0) for (let i = 0; i < 784; i++) out[i] = Math.min(1, out[i] / peak);
    return out;
  }

  function renderBars(probs) {
    bars.textContent = "";
    const best = probs ? probs.indexOf(Math.max(...probs)) : -1;
    for (let d = 0; d < 10; d++) {
      const p = probs ? probs[d] : 0;
      const label = document.createElement("div");
      label.className = "d";
      label.textContent = String(d);
      const track = document.createElement("div");
      track.className = "track" + (d === best ? " top" : "");
      const fill = document.createElement("div");
      fill.className = "fill";
      fill.style.width = (p * 100).toFixed(1) + "%";
      track.appendChild(fill);
      const pct = document.createElement("div");
      pct.className = "pct";
      pct.textContent = probs ? (p * 100).toFixed(0) + "%" : "";
      bars.appendChild(label);
      bars.appendChild(track);
      bars.appendChild(pct);
    }
  }

  // One classification at a time; if more ink arrives meanwhile, classify
  // once more when the current one finishes. A result that comes back after
  // the pad was cleared is dropped.
  let classifying = false, again = false;
  async function classify() {
    if (!inked || !lispReady || !trained) return;
    if (classifying) { again = true; return; }
    classifying = true;
    try {
      do {
        again = false;
        const gen = padGen;
        const pixels = padTo28();
        if (!pixels) break;
        await Lisp.define("*drawn*", pixels);
        const [centered, probs] = await Lisp.eval(
          "(let ((centered (center-image *drawn*))) (list centered (forward *trained* centered)))");
        if (gen !== padGen) continue;
        drawDigit(seen, centered);
        renderBars(probs);
        const best = probs.indexOf(Math.max(...probs));
        const p = probs[best];
        verdict.textContent = p > 0.8 ? "That's a " + best + "."
          : p > 0.5 ? "Probably a " + best + "."
          : "It isn't sure. Maybe a " + best + "?";
      } while (again);
    } catch (e) {
      if (e.message !== RESTARTED && lispReady) verdict.textContent = "Lisp said: " + e.message;
    }
    classifying = false;
  }

  // ---- where it fails ----------------------------------------------------

  async function showMistakes() {
    const host = $("mistakes");
    const readout = $("trained_readout");
    readout.textContent = "Lisp is reading the " + (samples.count - samples.train) + " held-back digits…";
    const guesses = await Lisp.eval("(map 'vector (lambda (pixels) (predict *trained* pixels)) *held-pixels*)");
    host.textContent = "";
    let wrong = 0;
    guesses.forEach((guess, k) => {
      const i = samples.train + k;
      if (guess !== samples.labels[i]) {
        wrong++;
        host.appendChild(digitTile(samples.pixels[i], "read " + guess + ", is " + samples.labels[i], "wrong"));
      }
    });
    const right = guesses.length - wrong;
    const b = (text) => { const el = document.createElement("b"); el.textContent = text; return el; };
    readout.textContent = "";
    readout.append("reads ", b(String(right)), " of the ", b(String(guesses.length)),
      " held-back digits correctly (" + ((100 * right) / guesses.length).toFixed(1) + "%)");
    if (!wrong) host.textContent = "none, on these digits";
  }

  // ---- boot ----------------------------------------------------------------

  drawCurve();
  clearPad();
  $("more_samples").addEventListener("click", () => {
    if (!samples.train) return;
    sampleOffset = (sampleOffset + 20) % samples.train;
    renderSamples();
  });
  filesLoaded = loadFiles();
  filesLoaded.catch((e) => {
    console.error(e);
    setStatus("lisp: a file did not load (" + e.message + ")", "failed");
  });
  startLisp();
})();
