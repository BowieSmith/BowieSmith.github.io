/* Cymatics: a Chladni plate bowed by the microphone.
 * Particles slide toward the nodal lines of a vibration mode chosen by pitch,
 * and are kicked at random in proportion to loudness times local vibration.
 */
(function () {
    'use strict';

    var canvas = document.getElementById('plate');
    var ctx = canvas.getContext('2d', { alpha: false });
    var startBox = document.getElementById('start');
    var listenBtn = document.getElementById('listen');
    var toast = document.getElementById('toast');
    var readout = document.getElementById('readout');
    var rNote = document.getElementById('rNote');
    var rHz = document.getElementById('rHz');
    var rMode = document.getElementById('rMode');
    var rLevel = document.getElementById('rLevel');
    var about = document.getElementById('about');
    var aboutLink = document.getElementById('aboutLink');
    var aboutClose = document.getElementById('aboutClose');

    /* ---------- geometry ---------- */
    var W = 0, H = 0, DPR = 1, ASPECT = 1, Y0 = 0; /* plate y runs from Y0 to Y0+ASPECT, centred on 0.5 */
    var px = null, py = null, vx = null, vy = null; /* plate coords: x in [0,1], y in [0,ASPECT] */
    var N = 0;

    function resize() {
        DPR = Math.min(window.devicePixelRatio || 1, 2);
        W = window.innerWidth;
        H = window.innerHeight;
        canvas.width = Math.round(W * DPR);
        canvas.height = Math.round(H * DPR);
        canvas.style.width = W + 'px';
        canvas.style.height = H + 'px';
        ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
        ASPECT = H / W;
        Y0 = 0.5 - ASPECT / 2;
        ctx.globalCompositeOperation = 'source-over';
        ctx.fillStyle = '#000';
        ctx.fillRect(0, 0, W, H);
        var want = Math.max(2500, Math.min(11000, Math.round(W * H / 55)));
        if (want !== N) allocate(want);
    }

    function allocate(n) {
        var oldN = N;
        var npx = new Float32Array(n), npy = new Float32Array(n);
        var nvx = new Float32Array(n), nvy = new Float32Array(n);
        for (var i = 0; i < n; i++) {
            if (i < oldN) { npx[i] = px[i]; npy[i] = Math.min(py[i], ASPECT); nvx[i] = vx[i]; nvy[i] = vy[i]; }
            else { npx[i] = Math.random(); npy[i] = Math.random() * ASPECT; }
        }
        px = npx; py = npy; vx = nvx; vy = nvy; N = n;
    }

    /* ---------- modes ---------- */
    /* Each mode is [n, m, s]: cos(n pi x) cos(m pi y) + s cos(m pi x) cos(n pi y).
     * The two signs are the two ways a square plate's degenerate pair can combine;
     * the minus family always has the diagonals as nodes, the plus family never does. */
    var MODES = [];
    for (var n = 1; n <= 7; n++) for (var m = n + 1; m <= 8; m++) { MODES.push([n, m, 1]); MODES.push([n, m, -1]); }
    MODES.sort(function (a, b) {
        var d = (a[0] * a[0] + a[1] * a[1]) - (b[0] * b[0] + b[1] * b[1]);
        return d !== 0 ? d : b[2] - a[2];
    });

    var F_LO = 70, F_HI = 1700; /* hum .. whistle */
    var LOG_LO = Math.log(F_LO), LOG_SPAN = Math.log(F_HI) - LOG_LO;

    function pitchToIndex(f) {
        var t = (Math.log(Math.max(f, 1)) - LOG_LO) / LOG_SPAN;
        if (t < 0) t = 0; if (t > 1) t = 1;
        return t * (MODES.length - 1);
    }

    /* ---------- sound state ---------- */
    var actx = null, analyser = null, stream = null;
    var freqBuf = null, timeBuf = null;
    var micOn = false;
    var freq = 220, level = 0;           /* current estimate */
    var freqS = 220, levelS = 0;         /* smoothed */
    var idxS = pitchToIndex(220);        /* smoothed mode index */
    var hueS = 40;
    var touching = false, touchFreq = 220, touchLevel = 0;
    var t0 = performance.now();

    function analyseMic() {
        analyser.getFloatTimeDomainData(timeBuf);
        var sum = 0, i;
        for (i = 0; i < timeBuf.length; i++) sum += timeBuf[i] * timeBuf[i];
        var rms = Math.sqrt(sum / timeBuf.length);
        var db = 20 * Math.log10(rms + 1e-9);
        var lv = (db + 60) / 54;            /* -60 dB .. -6 dB  ->  0 .. 1 */
        if (lv < 0) lv = 0; if (lv > 1) lv = 1;
        level = lv;

        if (lv < 0.06) return;               /* silence: keep the last pitch */
        analyser.getFloatFrequencyData(freqBuf);
        var binHz = actx.sampleRate / analyser.fftSize;
        var kLo = Math.max(2, Math.floor(60 / binHz));
        var kHi = Math.min(freqBuf.length - 1, Math.ceil(2200 / binHz));
        var best = -1, bestS = -Infinity, k;
        var kMax3 = Math.floor((freqBuf.length - 1) / 3);
        for (k = kLo; k <= kHi; k++) {
            /* harmonic product spectrum in the dB domain (sum of logs) */
            var s = freqBuf[k] * 1.6;
            s += (2 * k < freqBuf.length ? freqBuf[2 * k] : -100) * 0.9;
            s += (k <= kMax3 ? freqBuf[3 * k] : -100) * 0.5;
            if (s > bestS) { bestS = s; best = k; }
        }
        if (best < 1 || freqBuf[best] < -85) return;
        /* parabolic interpolation around the peak bin */
        var a = freqBuf[best - 1], b = freqBuf[best], c = freqBuf[best + 1];
        var denom = a - 2 * b + c;
        var delta = denom !== 0 ? 0.5 * (a - c) / denom : 0;
        if (delta > 0.5) delta = 0.5; if (delta < -0.5) delta = -0.5;
        freq = (best + delta) * binHz;
    }

    function demoSignal(t) {
        /* before the microphone starts: a slow wander through the modes */
        var s = t * 0.00009;
        var u = 0.5 + 0.5 * Math.sin(s) * Math.cos(s * 0.37 + 1.3);
        freq = Math.exp(LOG_LO + u * LOG_SPAN);
        level = 0.36 + 0.08 * Math.sin(t * 0.0013);
    }

    /* ---------- microphone ---------- */
    function showToast(msg, ms) {
        toast.textContent = msg;
        toast.hidden = false;
        toast.style.opacity = '1';
        clearTimeout(showToast.tm);
        if (ms) showToast.tm = setTimeout(function () {
            toast.style.opacity = '0';
            setTimeout(function () { toast.hidden = true; }, 450);
        }, ms);
    }

    function startMic() {
        var AC = window.AudioContext || window.webkitAudioContext;
        if (!AC || !navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
            micFail('this browser has no microphone access here. drag on the screen to play the plate by hand.');
            return;
        }
        listenBtn.disabled = true;
        listenBtn.textContent = '…';
        try {
            /* create and resume inside the tap: iOS requires the gesture */
            actx = actx || new AC();
            if (actx.state === 'suspended') actx.resume();
        } catch (e) { /* handled below */ }
        navigator.mediaDevices.getUserMedia({
            audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false }
        }).then(function (s) {
            stream = s;
            var src = actx.createMediaStreamSource(stream);
            analyser = actx.createAnalyser();
            analyser.fftSize = 4096;
            analyser.smoothingTimeConstant = 0.55;
            analyser.minDecibels = -110;
            analyser.maxDecibels = -10;
            src.connect(analyser);
            freqBuf = new Float32Array(analyser.frequencyBinCount);
            timeBuf = new Float32Array(analyser.fftSize);
            micOn = true;
            startBox.classList.add('gone');
            readout.hidden = false;
            showToast('listening. hum, sing, or whistle, and hold the note.', 4200);
            keepAwake();
        }).catch(function (err) {
            var name = err && err.name;
            var why;
            if (name === 'NotAllowedError' || name === 'SecurityError') {
                why = 'the microphone was refused. if no prompt appeared, this is probably an in-app browser: ' +
                      'open the page in Safari or Chrome itself. in Safari, tap AA in the address bar, ' +
                      'website settings, microphone, allow. then tap listen again.';
            } else if (name === 'NotFoundError') {
                why = 'no microphone was found.';
            } else if (name === 'NotReadableError') {
                why = 'another app is using the microphone. close it and tap listen again.';
            } else {
                why = 'the microphone could not be opened. tap listen to try again.';
            }
            micFail(why + ' or drag on the screen to play the plate by hand.');
        });
    }

    function micFail(msg) {
        /* keep the intro and the button so a retry is one tap away */
        listenBtn.disabled = false;
        listenBtn.textContent = 'listen';
        readout.hidden = false;
        showToast(msg, 14000);
    }

    function keepAwake() {
        try {
            if (navigator.wakeLock && navigator.wakeLock.request) {
                navigator.wakeLock.request('screen').catch(function () {});
            }
        } catch (e) { /* optional */ }
    }

    listenBtn.addEventListener('click', startMic);

    /* ---------- touch / drag control ---------- */
    function setTouch(e) {
        var x = e.clientX / W, y = e.clientY / H;
        if (x < 0) x = 0; if (x > 1) x = 1; if (y < 0) y = 0; if (y > 1) y = 1;
        touchFreq = Math.exp(LOG_LO + x * LOG_SPAN);
        touchLevel = 0.15 + 0.85 * (1 - y);
    }
    canvas.addEventListener('pointerdown', function (e) {
        touching = true;
        setTouch(e);
        try { canvas.setPointerCapture(e.pointerId); } catch (err) { /* fine */ }
        readout.hidden = false;
    });
    canvas.addEventListener('pointermove', function (e) { if (touching) setTouch(e); });
    function endTouch() { touching = false; }
    canvas.addEventListener('pointerup', endTouch);
    canvas.addEventListener('pointercancel', endTouch);

    /* ---------- about ---------- */
    function openAbout(e) {
        if (e) e.preventDefault();
        about.hidden = false;
        aboutLink.setAttribute('aria-expanded', 'true');
        about.scrollTop = 0;
    }
    function closeAbout(e) {
        if (e) e.preventDefault();
        about.hidden = true;
        aboutLink.setAttribute('aria-expanded', 'false');
    }
    aboutLink.addEventListener('click', function (e) { about.hidden ? openAbout(e) : closeAbout(e); });
    aboutClose.addEventListener('click', closeAbout);
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && !about.hidden) closeAbout(); });

    /* ---------- sprites ---------- */
    var SPR = 7; /* logical px */
    var sprites = {};
    function sprite(hue) {
        var key = Math.round(hue / 6) * 6;
        var s = sprites[key];
        if (s) return s;
        s = document.createElement('canvas');
        s.width = s.height = Math.ceil(SPR * DPR);
        var c = s.getContext('2d');
        var g = c.createRadialGradient(s.width / 2, s.height / 2, 0, s.width / 2, s.height / 2, s.width / 2);
        g.addColorStop(0, 'hsla(' + key + ',85%,88%,0.95)');
        g.addColorStop(0.35, 'hsla(' + key + ',90%,62%,0.55)');
        g.addColorStop(1, 'hsla(' + key + ',90%,50%,0)');
        c.fillStyle = g;
        c.fillRect(0, 0, s.width, s.height);
        sprites[key] = s;
        return s;
    }

    /* ---------- note names ---------- */
    var NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
    function noteName(f) {
        var midi = 69 + 12 * Math.log(f / 440) / Math.LN2;
        var r = Math.round(midi);
        return NAMES[((r % 12) + 12) % 12] + (Math.floor(r / 12) - 1);
    }

    /* ---------- main loop ---------- */
    var frame = 0, lastT = performance.now(), slow = 0;
    var TWO_PI = Math.PI * 2;

    function step(now) {
        requestAnimationFrame(step);
        var dt = now - lastT; lastT = now;
        frame++;

        /* adaptive particle count */
        if (dt > 26) { if (++slow > 20 && N > 2500) { allocate(Math.round(N * 0.85)); slow = 0; } }
        else if (dt < 18) slow = Math.max(0, slow - 1);

        /* --- sound --- */
        if (touching) { freq = touchFreq; level = touchLevel; }
        else if (micOn) analyseMic();
        else demoSignal(now - t0);

        /* smoothing: fast attack, slow release on level; pitch slews */
        levelS += (level - levelS) * (level > levelS ? 0.35 : 0.06);
        var active = levelS > 0.05;
        if (active) freqS += (freq - freqS) * 0.15;
        var targetIdx = pitchToIndex(freqS);
        idxS += (targetIdx - idxS) * 0.07;

        var i0 = Math.floor(idxS);
        if (i0 >= MODES.length - 1) i0 = MODES.length - 2;
        var tBlend = idxS - i0;
        var A = MODES[i0], B = MODES[i0 + 1];
        var nA = A[0], mA = A[1], sA = A[2], nB = B[0], mB = B[1], sB = B[2];
        var wA = 1 - tBlend, wB = tBlend;

        /* colour from pitch: low = ember, high = ice */
        var hueT = (Math.log(freqS) - LOG_LO) / LOG_SPAN;
        if (hueT < 0) hueT = 0; if (hueT > 1) hueT = 1;
        var hue = 20 + hueT * 230;
        hueS += (hue - hueS) * 0.05;
        var spr = sprite(hueS);

        /* --- physics --- */
        var amp = levelS;
        var slide = 0.00016 * (0.35 + amp);                 /* gradient step */
        var kick = 0.022 * amp * amp * amp;                       /* random jump  */
        var maxStep = 0.014;
        var scaleA = 1 / (Math.PI * (nA + mA)), scaleB = 1 / (Math.PI * (nB + mB));
        var pi = Math.PI;
        var i, x, y;
        for (i = 0; i < N; i++) {
            x = px[i]; y = py[i] + Y0;
            var cnx = Math.cos(nA * pi * x), cmy = Math.cos(mA * pi * y);
            var cmx = Math.cos(mA * pi * x), cny = Math.cos(nA * pi * y);
            var snx = Math.sin(nA * pi * x), smy = Math.sin(mA * pi * y);
            var smx = Math.sin(mA * pi * x), sny = Math.sin(nA * pi * y);
            var fA = cnx * cmy + sA * cmx * cny;
            var gxA = (-nA * snx * cmy - sA * mA * smx * cny) * pi;
            var gyA = (-mA * cnx * smy - sA * nA * cmx * sny) * pi;

            cnx = Math.cos(nB * pi * x); cmy = Math.cos(mB * pi * y);
            cmx = Math.cos(mB * pi * x); cny = Math.cos(nB * pi * y);
            snx = Math.sin(nB * pi * x); smy = Math.sin(mB * pi * y);
            smx = Math.sin(mB * pi * x); sny = Math.sin(nB * pi * y);
            var fB = cnx * cmy + sB * cmx * cny;
            var gxB = (-nB * snx * cmy - sB * mB * smx * cny) * pi;
            var gyB = (-mB * cnx * smy - sB * nB * cmx * sny) * pi;

            var f = wA * fA + wB * fB;
            var gx = wA * gxA * scaleA + wB * gxB * scaleB;
            var gy = wA * gyA * scaleA + wB * gyB * scaleB;

            /* slide toward the node, kick away from the antinode */
            var af = f < 0 ? -f : f;
            var sx = -f * gx * slide * 40, sy = -f * gy * slide * 40;
            var mag = Math.sqrt(sx * sx + sy * sy);
            if (mag > maxStep) { sx *= maxStep / mag; sy *= maxStep / mag; }
            var j = kick * af;
            var ang = Math.random() * TWO_PI, r = Math.random() * j;
            vx[i] = vx[i] * 0.45 + sx + Math.cos(ang) * r;
            vy[i] = vy[i] * 0.45 + sy + Math.sin(ang) * r;
            x += vx[i]; y = y - Y0 + vy[i];
            if (x < 0 || x > 1 || y < 0 || y > ASPECT) {
                /* fell off the plate: pour it back on */
                x = Math.random(); y = Math.random() * ASPECT; vx[i] = 0; vy[i] = 0;
            }
            px[i] = x; py[i] = y;
        }

        /* --- draw --- */
        ctx.globalCompositeOperation = 'source-over';
        ctx.fillStyle = 'rgba(0,0,0,' + (0.22 + 0.2 * amp) + ')';
        ctx.fillRect(0, 0, W, H);
        ctx.globalCompositeOperation = 'lighter';
        ctx.globalAlpha = 0.55 + 0.35 * amp;
        var half = SPR / 2;
        for (i = 0; i < N; i++) {
            ctx.drawImage(spr, px[i] * W - half, py[i] * W - half, SPR, SPR);
        }
        ctx.globalAlpha = 1;

        /* --- readout --- */
        if (!readout.hidden && frame % 6 === 0) {
            if (active || touching) {
                rNote.textContent = noteName(freqS);
                rHz.textContent = Math.round(freqS) + ' Hz';
            } else {
                rNote.textContent = micOn ? 'quiet' : '—';
                rHz.textContent = micOn ? '' : 'drag to play';
            }
            var M = tBlend < 0.5 ? A : B;
            rMode.textContent = 'mode ' + M[0] + '·' + M[1];
            rLevel.style.width = Math.round(levelS * 100) + '%';
        }
    }

    window.addEventListener('resize', resize);
    window.addEventListener('orientationchange', function () { setTimeout(resize, 200); });
    resize();
    requestAnimationFrame(step);
})();
