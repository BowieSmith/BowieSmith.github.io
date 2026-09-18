// Interactive walkthrough of elliptic curve cryptography.
// Sections 2-4 work over the real numbers (smooth curve, draggable points).
// Sections 5-7 work over a finite field (dots on a grid, modular arithmetic).
(function () {
    'use strict';

    var $ = function (id) { return document.getElementById(id); };

    // ---------------------------------------------------------------
    // Canvas helpers
    // ---------------------------------------------------------------

    // Scale the backing store for high-DPI screens while keeping a fixed
    // logical coordinate system (the width/height attributes in the HTML).
    function setupCanvas(canvas) {
        var W = canvas.width, H = canvas.height;
        var dpr = window.devicePixelRatio || 1;
        canvas.width = W * dpr;
        canvas.height = H * dpr;
        canvas.style.maxWidth = W + 'px';
        var ctx = canvas.getContext('2d');
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        return { ctx: ctx, W: W, H: H };
    }

    // Pointer event -> logical canvas coordinates (CSS scaling aware).
    function canvasPos(canvas, W, H, ev) {
        var r = canvas.getBoundingClientRect();
        return {
            x: (ev.clientX - r.left) * W / r.width,
            y: (ev.clientY - r.top) * H / r.height
        };
    }

    // Generic drag handling. getHandles() returns pixel positions; onMove is
    // called with the index of the grabbed handle and the pointer position.
    function attachDrag(canvas, W, H, getHandles, onMove) {
        var active = -1;
        canvas.addEventListener('pointerdown', function (ev) {
            var m = canvasPos(canvas, W, H, ev);
            var hit = 30 * fontScale(canvas, W);
            var hs = getHandles(), best = -1, bd = hit * hit;
            for (var i = 0; i < hs.length; i++) {
                var d = (hs[i].x - m.x) * (hs[i].x - m.x) + (hs[i].y - m.y) * (hs[i].y - m.y);
                if (d < bd) { bd = d; best = i; }
            }
            if (best >= 0) {
                active = best;
                canvas.setPointerCapture(ev.pointerId);
                ev.preventDefault();
                onMove(active, m);
            }
        });
        canvas.addEventListener('pointermove', function (ev) {
            if (active < 0) return;
            ev.preventDefault();
            onMove(active, canvasPos(canvas, W, H, ev));
        });
        var end = function () { active = -1; };
        canvas.addEventListener('pointerup', end);
        canvas.addEventListener('pointercancel', end);
    }

    // On narrow screens the canvas is shrunk by CSS; scale text and hit
    // targets up by the same factor so they stay readable and tappable.
    function fontScale(canvas, W) {
        var rw = canvas.getBoundingClientRect().width || W;
        return Math.max(1, Math.min(1.8, W / rw));
    }

    // Each part of a readout stays on one line.
    function setReadout(id, parts) {
        $(id).innerHTML = parts.map(function (t) {
            return '<span class="nw">' + t + '</span>';
        }).join('');
    }

    function labelText(ctx, text, x, y, color, size) {
        ctx.font = 'bold ' + (size || 13) + 'px courier, monospace';
        ctx.lineWidth = 4;
        ctx.strokeStyle = 'rgba(255,255,255,0.9)';
        ctx.strokeText(text, x, y);
        ctx.fillStyle = color;
        ctx.fillText(text, x, y);
    }

    var BLUE = '#1f77b4', ORANGE = '#e07b00', GREEN = '#2ca02c', RED = '#d62728', GREY = '#666';

    // ---------------------------------------------------------------
    // Real-number curve math:  y^2 = x^3 + a x + b
    // ---------------------------------------------------------------

    function fReal(x, a, b) { return x * x * x + a * x + b; }

    // Find the root between lo (f<0) and hi (f>=0) so curve segments end
    // exactly on the axis instead of leaving a gap.
    function bisect(lo, hi, a, b) {
        for (var i = 0; i < 40; i++) {
            var m = (lo + hi) / 2;
            if (fReal(m, a, b) < 0) lo = m; else hi = m;
        }
        return hi;
    }

    // Sample the upper half of the curve as a list of connected segments.
    function sampleCurve(a, b, xr, N) {
        var segs = [], cur = null, prevX = null, prevF = null;
        for (var i = 0; i <= N; i++) {
            var x = xr[0] + (xr[1] - xr[0]) * i / N;
            var f = fReal(x, a, b);
            if (f >= 0) {
                if (!cur) {
                    cur = [];
                    if (prevX !== null && prevF < 0) cur.push({ x: bisect(prevX, x, a, b), y: 0 });
                }
                cur.push({ x: x, y: Math.sqrt(f) });
            } else if (cur) {
                cur.push({ x: bisect(x, prevX, a, b), y: 0 });
                segs.push(cur);
                cur = null;
            }
            prevX = x; prevF = f;
        }
        if (cur) segs.push(cur);
        return segs;
    }

    // Flatten segments into a list of points on both halves (for snapping).
    function allSamples(segs) {
        var out = [];
        segs.forEach(function (seg) {
            seg.forEach(function (pt) {
                out.push({ x: pt.x, y: pt.y });
                if (pt.y !== 0) out.push({ x: pt.x, y: -pt.y });
            });
        });
        return out;
    }

    // Chord-and-tangent addition. Returns the slope, the third intersection R
    // and the sum S (R flipped), or {inf:true} when the line is vertical.
    function addReal(P, Q, a, dbl) {
        var s;
        var same = Math.abs(P.x - Q.x) < 1e-9 && Math.abs(P.y - Q.y) < 1e-9;
        if (dbl || same) {
            if (Math.abs(P.y) < 1e-9) return { inf: true, dbl: true };
            s = (3 * P.x * P.x + a) / (2 * P.y);
            Q = P;
            dbl = true;
        } else if (Math.abs(P.x - Q.x) < 1e-9) {
            return { inf: true, dbl: false };
        } else {
            s = (Q.y - P.y) / (Q.x - P.x);
        }
        var x3 = s * s - P.x - Q.x;
        var yLine = P.y + s * (x3 - P.x);
        return { s: s, dbl: dbl, R: { x: x3, y: yLine }, S: { x: x3, y: -yLine } };
    }

    function fmt(v) {
        var t = (Math.abs(v) < 1e4) ? v.toFixed(2) : v.toExponential(1);
        return t.replace('-', '−');
    }
    function ptStr(P) { return '(' + fmt(P.x) + ', ' + fmt(P.y) + ')'; }

    function eqStr(a, b) {
        var s = 'y² = x³';
        var fa = parseFloat(a.toFixed(1)), fb = parseFloat(b.toFixed(1));
        if (fa !== 0) s += (fa < 0 ? ' − ' : ' + ') + (Math.abs(fa) === 1 ? '' : Math.abs(fa)) + 'x';
        if (fb !== 0) s += (fb < 0 ? ' − ' : ' + ') + Math.abs(fb);
        return s;
    }

    // ---------------------------------------------------------------
    // RealPlot: axes + curve on a canvas with a world->pixel mapping
    // ---------------------------------------------------------------

    function RealPlot(canvas, xr, yr) {
        var s = setupCanvas(canvas);
        this.canvas = canvas; this.ctx = s.ctx; this.W = s.W; this.H = s.H;
        this.xr = xr; this.yr = yr;
    }

    RealPlot.prototype.px = function (x, y) {
        return {
            x: (x - this.xr[0]) / (this.xr[1] - this.xr[0]) * this.W,
            y: this.H - (y - this.yr[0]) / (this.yr[1] - this.yr[0]) * this.H
        };
    };

    RealPlot.prototype.clear = function () {
        var ctx = this.ctx, W = this.W, H = this.H, i, q;
        ctx.clearRect(0, 0, W, H);
        ctx.fillStyle = '#fff';
        ctx.fillRect(0, 0, W, H);
        ctx.lineWidth = 1;
        ctx.strokeStyle = '#eee';
        ctx.beginPath();
        for (i = Math.ceil(this.xr[0]); i <= this.xr[1]; i++) {
            q = this.px(i, 0); ctx.moveTo(q.x, 0); ctx.lineTo(q.x, H);
        }
        for (i = Math.ceil(this.yr[0]); i <= this.yr[1]; i++) {
            q = this.px(0, i); ctx.moveTo(0, q.y); ctx.lineTo(W, q.y);
        }
        ctx.stroke();
        ctx.strokeStyle = '#bbb';
        ctx.beginPath();
        q = this.px(0, 0);
        ctx.moveTo(q.x, 0); ctx.lineTo(q.x, H);
        ctx.moveTo(0, q.y); ctx.lineTo(W, q.y);
        ctx.stroke();
        ctx.fillStyle = '#999';
        ctx.font = Math.round(10 * fontScale(this.canvas, W)) + 'px courier, monospace';
        for (i = Math.ceil(this.xr[0]); i <= this.xr[1]; i++) {
            if (i === 0) continue;
            q = this.px(i, 0); ctx.fillText(i, q.x + 2, q.y - 3);
        }
        for (i = Math.ceil(this.yr[0]); i <= this.yr[1]; i++) {
            if (i === 0) continue;
            q = this.px(0, i); ctx.fillText(i, q.x + 3, q.y - 2);
        }
    };

    RealPlot.prototype.drawCurve = function (segs) {
        var ctx = this.ctx, self = this;
        ctx.strokeStyle = '#333';
        ctx.lineWidth = 2;
        ctx.lineJoin = 'round';
        [1, -1].forEach(function (sign) {
            segs.forEach(function (seg) {
                ctx.beginPath();
                seg.forEach(function (pt, i) {
                    var q = self.px(pt.x, sign * pt.y);
                    if (i === 0) ctx.moveTo(q.x, q.y); else ctx.lineTo(q.x, q.y);
                });
                ctx.stroke();
            });
        });
    };

    // Line through P with slope s (or vertical when s is null).
    RealPlot.prototype.drawLine = function (P, s, color, alpha) {
        var ctx = this.ctx, a, b;
        ctx.save();
        ctx.globalAlpha = alpha === undefined ? 1 : alpha;
        ctx.strokeStyle = color; ctx.lineWidth = 1.5;
        ctx.beginPath();
        if (s === null) {
            a = this.px(P.x, this.yr[0]); b = this.px(P.x, this.yr[1]);
        } else {
            a = this.px(this.xr[0], P.y + s * (this.xr[0] - P.x));
            b = this.px(this.xr[1], P.y + s * (this.xr[1] - P.x));
        }
        ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y);
        ctx.stroke();
        ctx.restore();
    };

    RealPlot.prototype.drawDashed = function (A, B, color, alpha) {
        var ctx = this.ctx, a = this.px(A.x, A.y), b = this.px(B.x, B.y);
        ctx.save();
        ctx.globalAlpha = alpha === undefined ? 1 : alpha;
        ctx.strokeStyle = color; ctx.lineWidth = 1.5;
        ctx.setLineDash([5, 4]);
        ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
        ctx.restore();
    };

    // Draw a point; if it is outside the view, pin it to the edge and say so.
    RealPlot.prototype.drawPoint = function (P, opt) {
        var ctx = this.ctx, q = this.px(P.x, P.y), fs = fontScale(this.canvas, this.W);
        var r = (opt.r || 6) * (1 + (fs - 1) * 0.5), size = Math.round(13 * fs);
        var off = q.x < 0 || q.x > this.W || q.y < 0 || q.y > this.H;
        var cx = Math.max(12, Math.min(this.W - 12, q.x));
        var cy = Math.max(12, Math.min(this.H - 12, q.y));
        ctx.save();
        if (off) ctx.globalAlpha = 0.5;
        ctx.beginPath();
        ctx.arc(cx, cy, r, 0, Math.PI * 2);
        if (opt.fill === false) {
            ctx.fillStyle = '#fff'; ctx.fill();
            ctx.lineWidth = 2; ctx.strokeStyle = opt.color; ctx.stroke();
        } else {
            ctx.fillStyle = opt.color; ctx.fill();
        }
        if (opt.label) {
            var text = opt.label + (off ? ' (off screen)' : '');
            ctx.font = 'bold ' + size + 'px courier, monospace';
            var w = ctx.measureText(text).width;
            var lx = cx + r + 3, ly = cy - r - 2;
            if (lx + w > this.W - 2) lx = cx - r - 3 - w;
            if (ly < size) ly = cy + r + size + 1;
            labelText(ctx, text, lx, ly, opt.color, size);
        }
        ctx.restore();
    };

    function nearestSample(plot, samples, m) {
        var best = samples[0], bd = Infinity;
        for (var i = 0; i < samples.length; i++) {
            var q = plot.px(samples[i].x, samples[i].y);
            var d = (q.x - m.x) * (q.x - m.x) + (q.y - m.y) * (q.y - m.y);
            if (d < bd) { bd = d; best = samples[i]; }
        }
        return { x: best.x, y: best.y };
    }

    // ---------------------------------------------------------------
    // Section 2: the curve with sliders
    // ---------------------------------------------------------------

    (function sectionCurve() {
        var plot = new RealPlot($('curveCanvas'), [-4, 4], [-8, 8]);
        var aIn = $('curveA'), bIn = $('curveB');
        function draw() {
            var a = parseFloat(aIn.value), b = parseFloat(bIn.value);
            $('curveAVal').textContent = fmt(a).replace(/\.?0+$/, '');
            $('curveBVal').textContent = fmt(b).replace(/\.?0+$/, '');
            $('curveEq').textContent = eqStr(a, b);
            plot.clear();
            plot.drawCurve(sampleCurve(a, b, plot.xr, 800));
        }
        aIn.addEventListener('input', draw);
        bIn.addEventListener('input', draw);
        draw();
    })();

    // ---------------------------------------------------------------
    // Section 3: P + Q with draggable points
    // ---------------------------------------------------------------

    (function sectionAdd() {
        var A = -3, B = 3;
        var plot = new RealPlot($('addCanvas'), [-3.5, 3.5], [-6, 6]);
        var segs = sampleCurve(A, B, plot.xr, 700);
        var samples = allSamples(segs);
        var P = { x: -1, y: Math.sqrt(fReal(-1, A, B)) };
        var Q = { x: 0.5, y: Math.sqrt(fReal(0.5, A, B)) };
        var dblIn = $('addDouble');

        function draw() {
            var dbl = dblIn.checked;
            var res = addReal(P, Q, A, dbl);
            plot.clear();
            plot.drawCurve(segs);
            var readout;
            if (res.inf) {
                plot.drawLine(P, null, '#999');
                plot.drawPoint(P, { color: BLUE, label: 'P' });
                if (!res.dbl) plot.drawPoint(Q, { color: ORANGE, label: 'Q' });
                readout = 'The line is vertical: ' + (res.dbl ? '2P' : 'P + Q') +
                    ' = O, the point at infinity (the "zero").';
            } else {
                plot.drawLine(P, res.s, '#999');
                plot.drawDashed(res.R, res.S, GREEN);
                plot.drawPoint(res.R, { color: '#555', fill: false, label: 'R' });
                plot.drawPoint(res.S, { color: GREEN, label: res.dbl ? '2P' : 'P + Q' });
                plot.drawPoint(P, { color: BLUE, label: 'P' });
                if (!res.dbl) plot.drawPoint(Q, { color: ORANGE, label: 'Q' });
                readout = ['P = ' + ptStr(P)];
                if (!res.dbl) readout.push('Q = ' + ptStr(Q));
                readout.push((res.dbl ? '2P' : 'P + Q') + ' = ' + ptStr(res.S));
            }
            setReadout('addReadout', [].concat(readout));
        }

        attachDrag(plot.canvas, plot.W, plot.H, function () {
            var hs = [plot.px(P.x, P.y)];
            if (!dblIn.checked) hs.push(plot.px(Q.x, Q.y));
            return hs;
        }, function (i, m) {
            var pt = nearestSample(plot, samples, m);
            if (i === 0) P = pt; else Q = pt;
            draw();
        });
        dblIn.addEventListener('change', draw);
        draw();
    })();

    // ---------------------------------------------------------------
    // Section 4: repeated addition P, 2P, 3P ...
    // ---------------------------------------------------------------

    (function sectionHop() {
        var A = -3, B = 3;
        var plot = new RealPlot($('hopCanvas'), [-3.5, 3.5], [-6, 6]);
        var segs = sampleCurve(A, B, plot.xr, 700);
        var samples = allSamples(segs);
        var P0 = { x: -1.5, y: Math.sqrt(fReal(-1.5, A, B)) };
        var P = P0;
        var kIn = $('hopK');

        function draw() {
            var k = parseInt(kIn.value, 10);
            $('hopKVal').textContent = k;
            plot.clear();
            plot.drawCurve(segs);
            var mult = [null, P], last = P, stopped = null, i;
            for (i = 1; i < k; i++) {
                var res = addReal(mult[i], P, A, i === 1);
                if (res.inf) { stopped = i + 1; break; }
                plot.drawLine(mult[i], res.s, '#999', 0.35);
                plot.drawDashed(res.R, res.S, GREEN, 0.35);
                plot.drawPoint(res.R, { color: '#aaa', fill: false, r: 3 });
                mult.push(res.S);
                last = res.S;
            }
            for (i = 2; i < mult.length; i++) {
                var isLast = i === mult.length - 1;
                plot.drawPoint(mult[i], { color: isLast ? GREEN : '#777', r: isLast ? 6 : 4, label: i + 'P' });
            }
            plot.drawPoint(P, { color: BLUE, label: 'P' });
            var n = mult.length - 1;
            setReadout('hopReadout', stopped ?
                ['After ' + (stopped - 1) + ' hops the line went vertical: ' + stopped + 'P = O.'] :
                ['P = ' + ptStr(P), n + 'P = ' + ptStr(last)]);
        }

        attachDrag(plot.canvas, plot.W, plot.H, function () {
            return [plot.px(P.x, P.y)];
        }, function (i, m) {
            P = nearestSample(plot, samples, m);
            draw();
        });
        kIn.addEventListener('input', draw);
        $('hopStep').addEventListener('click', function () {
            kIn.value = Math.min(parseInt(kIn.max, 10), parseInt(kIn.value, 10) + 1);
            draw();
        });
        $('hopReset').addEventListener('click', function () {
            P = P0; kIn.value = 1; draw();
        });
        draw();
    })();

    // ---------------------------------------------------------------
    // Finite field math:  y^2 = x^3 + a x + b  (mod p)
    // The point at infinity O is represented by null.
    // ---------------------------------------------------------------

    function mod(a, p) { return ((a % p) + p) % p; }

    function egcd(a, b) {
        if (b === 0) return [a, 1, 0];
        var r = egcd(b, a % b);
        return [r[0], r[2], r[1] - Math.floor(a / b) * r[2]];
    }

    function modInv(a, p) {
        var r = egcd(mod(a, p), p);
        return r[0] === 1 ? mod(r[1], p) : null;
    }

    function addF(P, Q, a, p) {
        if (!P) return Q;
        if (!Q) return P;
        var s;
        if (P.x === Q.x) {
            if (mod(P.y + Q.y, p) === 0) return null;
            var inv2y = modInv(2 * P.y, p);
            if (inv2y === null) return null;
            s = mod((3 * P.x * P.x + a) * inv2y, p);
        } else {
            var invdx = modInv(Q.x - P.x, p);
            if (invdx === null) return null;
            s = mod((Q.y - P.y) * invdx, p);
        }
        var x3 = mod(s * s - P.x - Q.x, p);
        return { x: x3, y: mod(s * (P.x - x3) - P.y, p) };
    }

    // Double-and-add: k*G in about log2(k) steps.
    function mulF(k, G, a, p) {
        var R = null, T = G;
        while (k > 0) {
            if (k & 1) R = addF(R, T, a, p);
            T = addF(T, T, a, p);
            k >>= 1;
        }
        return R;
    }

    function pointsF(a, b, p) {
        var out = [];
        for (var x = 0; x < p; x++) {
            var rhs = mod(x * x * x + a * x + b, p);
            for (var y = 0; y < p; y++) if (mod(y * y, p) === rhs) out.push({ x: x, y: y });
        }
        return out;
    }

    function orderF(G, a, p) {
        var n = 1, R = G;
        while (R) { R = addF(R, G, a, p); n++; if (n > 4 * p + 10) return -1; }
        return n;
    }

    function samePt(P, Q) { return (!P && !Q) || (P && Q && P.x === Q.x && P.y === Q.y); }
    function fStr(P) { return P ? '(' + P.x + ', ' + P.y + ')' : 'O'; }

    var PRIMES = [5, 7, 11, 13, 17, 19, 23, 29, 31, 37, 41, 43, 47, 53, 59, 61, 67, 71, 73, 79,
        83, 89, 97, 101, 103, 107, 109, 113, 127, 131, 137, 139, 149, 151, 157, 163, 167, 173,
        179, 181, 191, 193, 197, 199];

    // ---------------------------------------------------------------
    // FinitePlot: p x p grid of dots
    // ---------------------------------------------------------------

    function FinitePlot(canvas) {
        var s = setupCanvas(canvas);
        this.canvas = canvas; this.ctx = s.ctx; this.S = s.W;
    }

    FinitePlot.prototype.px = function (P, p) {
        var cell = this.S / p;
        return { x: (P.x + 0.5) * cell, y: this.S - (P.y + 0.5) * cell };
    };

    // marks: [{pt, color, label, fill, r}], links: [[P, Q, alpha]]
    FinitePlot.prototype.draw = function (points, p, marks, links, midline) {
        var ctx = this.ctx, S = this.S, self = this, cell = S / p;
        var fs = fontScale(this.canvas, S), small = Math.round(10 * fs), big = Math.round(13 * fs);
        ctx.clearRect(0, 0, S, S);
        ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, S, S);
        ctx.fillStyle = '#999'; ctx.font = small + 'px courier, monospace';
        ctx.fillText('0', 3, S - 3);
        ctx.fillText('x = ' + (p - 1), S - 3 - ctx.measureText('x = ' + (p - 1)).width, S - 3);
        ctx.fillText('y = ' + (p - 1), 3, small + 1);
        if (midline) {
            ctx.save();
            ctx.strokeStyle = '#ddd'; ctx.setLineDash([4, 4]);
            ctx.beginPath(); ctx.moveTo(0, S / 2); ctx.lineTo(S, S / 2); ctx.stroke();
            ctx.restore();
        }
        var r = Math.max(1.5 * fs, Math.min(6, cell * 0.3));
        ctx.fillStyle = '#333';
        points.forEach(function (P) {
            var q = self.px(P, p);
            ctx.beginPath(); ctx.arc(q.x, q.y, r, 0, Math.PI * 2); ctx.fill();
        });
        (links || []).forEach(function (l) {
            var a = self.px(l[0], p), b = self.px(l[1], p);
            ctx.save();
            ctx.globalAlpha = l[2]; ctx.strokeStyle = GREEN; ctx.lineWidth = 1.5;
            ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
            ctx.restore();
        });
        (marks || []).forEach(function (m) {
            if (!m.pt) return;
            var q = self.px(m.pt, p), mr = (m.r || 7) * (1 + (fs - 1) * 0.5);
            ctx.beginPath(); ctx.arc(q.x, q.y, mr, 0, Math.PI * 2);
            if (m.fill === false) {
                ctx.lineWidth = 3; ctx.strokeStyle = m.color; ctx.stroke();
            } else {
                ctx.fillStyle = m.color; ctx.fill();
            }
            if (m.label) {
                ctx.font = (m.small ? small + 'px' : 'bold ' + big + 'px') + ' courier, monospace';
                var w = ctx.measureText(m.label).width;
                var lx = q.x + mr + 3, ly = q.y - mr - 2;
                if (lx + w > S) lx = q.x - mr - 3 - w;
                if (ly < big) ly = q.y + mr + big;
                ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(255,255,255,0.9)';
                ctx.strokeText(m.label, lx, ly);
                ctx.fillStyle = m.color; ctx.fillText(m.label, lx, ly);
            }
        });
    };

    FinitePlot.prototype.nearest = function (points, p, m, maxPx) {
        var best = null, bd = maxPx * maxPx;
        for (var i = 0; i < points.length; i++) {
            var q = this.px(points[i], p);
            var d = (q.x - m.x) * (q.x - m.x) + (q.y - m.y) * (q.y - m.y);
            if (d < bd) { bd = d; best = points[i]; }
        }
        return best;
    };

    // ---------------------------------------------------------------
    // Section 5: the curve mod p, tap a point and hop
    // ---------------------------------------------------------------

    (function sectionField() {
        var plot = new FinitePlot($('fieldCanvas'));
        var pIn = $('fieldP'), aIn = $('fieldA'), bIn = $('fieldB');
        var p, a, b, points, G = null, chain = [], done = false, timer = null;

        function rebuild() {
            p = PRIMES[parseInt(pIn.value, 10)];
            a = parseInt(aIn.value, 10);
            b = parseInt(bIn.value, 10);
            $('fieldPVal').textContent = p;
            $('fieldAVal').textContent = a;
            $('fieldBVal').textContent = b;
            $('fieldEq').textContent = eqStr(a, b) + '   (mod ' + p + ')';
            points = pointsF(a, b, p);
            var singular = mod(4 * a * a * a + 27 * b * b, p) === 0;
            $('fieldCount').textContent = points.length + ' dots on the grid, plus the invisible O: ' +
                (points.length + 1) + ' points in total.' +
                (singular ? ' (This a, b make a "singular" curve with a sharp corner; cryptographers skip those.)' : '');
            reset();
        }

        function reset() {
            stopRun();
            G = null; chain = []; done = false;
            $('fieldReadout').textContent = 'Tap a dot to choose G.';
            draw();
        }

        function stopRun() { if (timer) { clearInterval(timer); timer = null; } }

        function hop() {
            if (!G || done) return false;
            var last = chain[chain.length - 1];
            var next = addF(last, G, a, p);
            chain.push(next);
            if (!next) {
                done = true;
                $('fieldReadout').textContent = 'Hop ' + chain.length + ' lands on O and the sequence starts over. ' +
                    'The order of G is ' + chain.length + '.';
            } else {
                setReadout('fieldReadout', ['G = ' + fStr(G), chain.length + 'G = ' + fStr(next),
                    '(' + chain.length + ' hops so far)']);
            }
            draw();
            return !done;
        }

        function draw() {
            var marks = [], links = [], i;
            for (i = 1; i < chain.length; i++) {
                if (!chain[i]) break;
                var age = chain.length - 1 - i;
                if (age < 8) links.push([chain[i - 1], chain[i], 0.6 * Math.pow(0.7, age)]);
                var isLast = i === chain.length - 1;
                marks.push({ pt: chain[i], color: GREEN, r: isLast ? 7 : 4,
                    label: isLast ? (i + 1) + 'G' : String(i + 1), small: !isLast });
            }
            if (G) marks.push({ pt: G, color: BLUE, label: 'G' });
            plot.draw(points, p, marks, links, true);
        }

        plot.canvas.addEventListener('pointerdown', function (ev) {
            var m = canvasPos(plot.canvas, plot.S, plot.S, ev);
            var pt = plot.nearest(points, p, m, 24 * fontScale(plot.canvas, plot.S));
            if (!pt) return;
            ev.preventDefault();
            stopRun();
            G = pt; chain = [G]; done = false;
            $('fieldReadout').textContent = 'G = ' + fStr(G) + '.  Now add G to itself.';
            draw();
        });
        $('fieldHop').addEventListener('click', function () {
            if (!G) { $('fieldReadout').textContent = 'Tap a dot first to choose G.'; return; }
            stopRun(); hop();
        });
        $('fieldRun').addEventListener('click', function () {
            if (!G) { $('fieldReadout').textContent = 'Tap a dot first to choose G.'; return; }
            stopRun();
            timer = setInterval(function () { if (!hop() || chain.length > 1000) stopRun(); }, 180);
        });
        $('fieldReset').addEventListener('click', reset);
        [pIn, aIn, bIn].forEach(function (el) { el.addEventListener('input', rebuild); });
        rebuild();
    })();

    // ---------------------------------------------------------------
    // Shared fixed curve for sections 6 and 7: y^2 = x^3 + 7 mod 97
    // 79 points in total (a prime), so every point generates all of them.
    // ---------------------------------------------------------------

    var FP = 97, FA = 0, FB = 7;
    var FG = { x: 1, y: 28 };
    var FPOINTS = pointsF(FA, FB, FP);
    var FN = orderF(FG, FA, FP);   // 79
    function fmul(k) { return mulF(k, FG, FA, FP); }

    // ---------------------------------------------------------------
    // Section 6: guess the secret k from k*G
    // ---------------------------------------------------------------

    (function sectionDiscreteLog() {
        var plot = new FinitePlot($('dlCanvas'));
        var guessIn = $('dlGuess');
        guessIn.max = FN - 1;
        var secret, target, tried;

        function newSecret() {
            secret = 1 + Math.floor(Math.random() * (FN - 1));
            target = fmul(secret);
            tried = {};
            guessIn.value = 1;
            update();
        }

        function stepsText(k) {
            var bits = k.toString(2);
            var doublings = bits.length - 1;
            var additions = bits.split('1').length - 2;
            var total = doublings + additions;
            return 'k = ' + k + ' is ' + bits + ' in binary: ' + doublings + ' doubling' + (doublings === 1 ? '' : 's') +
                ' + ' + additions + ' addition' + (additions === 1 ? '' : 's') + ' = ' + total +
                ' operation' + (total === 1 ? '' : 's') + ' instead of ' + k + ' hops';
        }

        function update() {
            var k = parseInt(guessIn.value, 10);
            tried[k] = true;
            var count = Object.keys(tried).length;
            var mine = fmul(k);
            var hit = samePt(mine, target);
            $('dlGuessVal').textContent = k;
            $('dlSteps').textContent = stepsText(k);
            var marks = [{ pt: FG, color: GREY, label: 'G' }];
            if (hit) {
                marks.push({ pt: target, color: GREEN, label: 'match!  k = ' + k, r: 9 });
            } else {
                marks.push({ pt: target, color: RED, fill: false, label: 'k·G  (k = ?)', r: 9 });
                marks.push({ pt: mine, color: BLUE, label: k + '·G' });
            }
            plot.draw(FPOINTS, FP, marks, [[FG, mine, 0.3]], false);
            setReadout('dlReadout', ['The secret point is ' + fStr(target) + '.',
                'Your guess: ' + k + '·G = ' + fStr(mine) + '.']);
            var note = $('dlNote');
            if (hit) {
                note.innerHTML = '<span class="ok">Found it: k = ' + k + '.</span> It took you ' + count +
                    ' guess' + (count === 1 ? '' : 'es') + '. Notice there was nothing to reason about: ' +
                    'the blue dot gave no hint about how close you were.';
            } else {
                note.textContent = 'The red ring is where the computer landed. The blue dot is where your guess ' +
                    'lands. Guesses so far: ' + count + '.';
            }
        }

        guessIn.addEventListener('input', update);
        $('dlNew').addEventListener('click', newSecret);
        newSecret();
    })();

    // ---------------------------------------------------------------
    // Section 7: Diffie-Hellman key exchange
    // ---------------------------------------------------------------

    (function sectionDH() {
        var plot = new FinitePlot($('dhCanvas'));
        var aIn = $('dhA'), bIn = $('dhB');
        aIn.max = FN - 1; bIn.max = FN - 1;

        function update() {
            var a = parseInt(aIn.value, 10), b = parseInt(bIn.value, 10);
            var A = fmul(a), B = fmul(b);
            var S1 = mulF(a, B, FA, FP), S2 = mulF(b, A, FA, FP);
            $('dhAVal').textContent = a;
            $('dhBVal').textContent = b;
            $('dhAliceKnows').textContent =
                'secret a = ' + a + '\n' +
                'A = a·G = ' + fStr(A) + '\n' +
                'B from Bob = ' + fStr(B) + '\n' +
                'shared = a·B = ' + fStr(S1);
            $('dhBobKnows').textContent =
                'secret b = ' + b + '\n' +
                'B = b·G = ' + fStr(B) + '\n' +
                'A from Alice = ' + fStr(A) + '\n' +
                'shared = b·A = ' + fStr(S2);
            $('dhEveSees').textContent =
                'the curve\n' +
                'G = ' + fStr(FG) + '\n' +
                'A = ' + fStr(A) + '\n' +
                'B = ' + fStr(B) + '\n' +
                '...and needs a or b';
            var marks = [
                { pt: FG, color: GREY, label: 'G' },
                { pt: A, color: BLUE, label: 'A = ' + a + '·G' },
                { pt: B, color: ORANGE, label: 'B = ' + b + '·G' },
                { pt: S1, color: GREEN, label: 'shared', r: 9 }
            ];
            var links = [[FG, A, 0.35], [FG, B, 0.35], [A, S1, 0.35], [B, S1, 0.35]];
            plot.draw(FPOINTS, FP, marks, links, false);
            $('dhReadout').innerHTML = samePt(S1, S2) ?
                'a·B = b·A = ' + fStr(S1) + ' <span class="ok">✓</span> ' +
                '— both sides computed the same point without ever sending a or b.' :
                'Something went wrong: the two sides disagree.';
        }

        aIn.addEventListener('input', update);
        bIn.addEventListener('input', update);
        update();
    })();
})();
