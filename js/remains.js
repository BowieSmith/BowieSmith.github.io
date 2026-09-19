// What Remains: two small pieces that enact the essay.
// 1. A figure that draws itself slowly from random parameters, once.
// 2. A private list of what the reader chooses to keep doing themselves.
(function () {
    'use strict';

    var $ = function (id) { return document.getElementById(id); };

    // ---------------------------------------------------------------
    // The slow figure: a damped harmonograph. Parameters are drawn at
    // random when "begin" is pressed and are never stored, so each
    // figure is drawn exactly once.
    // ---------------------------------------------------------------

    (function figure() {
        var canvas = $('figure'), begin = $('figBegin'), status = $('figStatus');
        if (!canvas) return;
        var W = canvas.width, H = canvas.height;
        var dpr = window.devicePixelRatio || 1;
        canvas.width = W * dpr; canvas.height = H * dpr;
        var ctx = canvas.getContext('2d');
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

        var DURATION = 60000;   // one minute, more or less
        var running = false, drawn = 0;

        function rnd(lo, hi) { return lo + Math.random() * (hi - lo); }

        function newParams() {
            // two damped pendulums per axis, near-integer frequency ratios
            var base = rnd(1.5, 3.5);
            return {
                ax: rnd(0.35, 0.5) * W, ay: rnd(0.35, 0.5) * H,
                fx1: base, fx2: base * rnd(1.98, 3.02),
                fy1: base * rnd(0.98, 1.02), fy2: base * rnd(2.97, 4.03),
                px1: rnd(0, Math.PI * 2), px2: rnd(0, Math.PI * 2),
                py1: rnd(0, Math.PI * 2), py2: rnd(0, Math.PI * 2),
                d1: rnd(0.002, 0.006), d2: rnd(0.004, 0.012),
                mix: rnd(0.25, 0.55),
                tEnd: rnd(160, 260)
            };
        }

        function point(p, t) {
            var e1 = Math.exp(-p.d1 * t), e2 = Math.exp(-p.d2 * t);
            var x = p.ax * ((1 - p.mix) * Math.sin(p.fx1 * t + p.px1) * e1 + p.mix * Math.sin(p.fx2 * t + p.px2) * e2);
            var y = p.ay * ((1 - p.mix) * Math.sin(p.fy1 * t + p.py1) * e1 + p.mix * Math.sin(p.fy2 * t + p.py2) * e2);
            return { x: W / 2 + x, y: H / 2 + y };
        }

        function clear() {
            ctx.clearRect(0, 0, W, H);
            ctx.fillStyle = '#fff';
            ctx.fillRect(0, 0, W, H);
        }

        function start() {
            if (running) return;
            var p = newParams();
            running = true;
            begin.disabled = true;
            clear();
            ctx.strokeStyle = 'rgba(20, 20, 20, 0.55)';
            ctx.lineWidth = 0.9;
            ctx.lineJoin = 'round';
            ctx.lineCap = 'round';

            var t0 = null, lastT = 0, STEP = 0.02;
            var prev = point(p, 0);

            function frame(now) {
                if (t0 === null) t0 = now;
                var frac = Math.min(1, (now - t0) / DURATION);
                var tTarget = frac * p.tEnd;
                ctx.beginPath();
                ctx.moveTo(prev.x, prev.y);
                for (var t = lastT + STEP; t <= tTarget; t += STEP) {
                    var q = point(p, t);
                    ctx.lineTo(q.x, q.y);
                    prev = q;
                }
                ctx.stroke();
                lastT = tTarget;
                var secs = Math.round(frac * DURATION / 1000);
                status.textContent = frac < 1 ? (secs + 's') : '';
                if (frac < 1) {
                    window.requestAnimationFrame(frame);
                } else {
                    running = false;
                    drawn++;
                    p = null;   // the parameters are gone
                    begin.disabled = false;
                    begin.textContent = 'another';
                    status.textContent = drawn === 1 ?
                        'Done. This one will not be drawn again.' :
                        'Done. Neither will this one.';
                }
            }
            status.textContent = '';
            window.requestAnimationFrame(frame);
        }

        begin.addEventListener('click', start);
        clear();
    })();

    // ---------------------------------------------------------------
    // The kept list: stored only in this browser's localStorage.
    // ---------------------------------------------------------------

    (function keep() {
        var list = $('keepList'), form = $('keepForm'), input = $('keepInput'), count = $('keepCount');
        if (!list) return;
        var KEY = 'what-remains-kept';

        var DEFAULTS = [
            'write by hand',
            'cook without looking anything up',
            'do the arithmetic in my head',
            'walk without the map',
            'learn the poem instead of saving the link',
            'play an instrument, badly',
            'prove something that has already been proved',
            'read the whole book',
            'draw what is in front of me',
            'fix the thing instead of replacing it'
        ];

        function load() {
            try {
                var raw = window.localStorage.getItem(KEY);
                if (raw) {
                    var data = JSON.parse(raw);
                    if (data && Array.isArray(data.items)) return data.items;
                }
            } catch (e) { /* private window, blocked storage: start fresh */ }
            return DEFAULTS.map(function (t) { return { text: t, kept: false, own: false }; });
        }

        function save() {
            try { window.localStorage.setItem(KEY, JSON.stringify({ items: items })); } catch (e) { /* nothing to do */ }
        }

        var items = load();

        function render() {
            while (list.firstChild) list.removeChild(list.firstChild);
            var kept = 0;
            items.forEach(function (it, i) {
                var li = document.createElement('li');
                if (it.kept) { li.className = 'kept'; kept++; }
                var box = document.createElement('input');
                box.type = 'checkbox';
                box.id = 'keep-' + i;
                box.checked = !!it.kept;
                box.addEventListener('change', function () { it.kept = box.checked; save(); render(); });
                var label = document.createElement('label');
                label.htmlFor = box.id;
                label.textContent = it.text;
                li.appendChild(box);
                li.appendChild(label);
                if (it.own) {
                    var rm = document.createElement('button');
                    rm.type = 'button';
                    rm.className = 'remove';
                    rm.textContent = 'remove';
                    rm.setAttribute('aria-label', 'remove ' + it.text);
                    rm.addEventListener('click', function () { items.splice(i, 1); save(); render(); });
                    li.appendChild(rm);
                }
                list.appendChild(li);
            });
            count.textContent = kept === 0 ? 'Nothing kept yet.' :
                'You are keeping ' + kept + ' thing' + (kept === 1 ? '' : 's') + '. Stored only in this browser.';
        }

        form.addEventListener('submit', function (e) {
            e.preventDefault();
            var text = input.value.replace(/\s+/g, ' ').trim();
            if (!text) return;
            items.push({ text: text, kept: true, own: true });
            input.value = '';
            save();
            render();
        });

        render();
    })();
})();
