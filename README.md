# BowieSmith.github.io

A small personal site, served by GitHub Pages straight from this repository.
The home page is a list of artifacts, newest first. Each entry says what the
thing is, when it was finished, and who (or what) made it.

## Layout

```
index.html            the home page: the list of artifacts
html/                 one page per artifact
css/                  one stylesheet per page (main.css is the home page's)
js/                   one script per page that needs one
images/               pictures the pages show (the basement sketch and drawings)
lisp/                 Common Lisp: digits.lisp (the network), train.lisp (training)
scripts/              small Node scripts that prepare data
data/                 data the pages load (sample digits, trained weights)
vendor/               third-party code served with the site (JSCL)
mise.toml             tools: node, pnpm, sbcl
package.json          JavaScript libraries, and the project's commands
```

## Adding an artifact

1. Put the page in `html/`, its stylesheet in `css/`, its script in `js/`.
2. In `index.html`, copy an `<li class="artifact">` block into its year,
   newest at the top, and start a new `<section class="year">` for a new year.
   Fill in `data-by` (`hand`, `ai` or `both`), the matching stamp, the date,
   the title and link, the type and author, and a one- or two-sentence summary.
   The comment above the list spells out each field.

## Working on the site

Tools come from [mise](https://mise.jdx.dev) and JavaScript libraries from
[pnpm](https://pnpm.io). There is no build step: the files in the repository
are the site.

```sh
mise install          # node 24, pnpm 12 and sbcl 2.4.0, as pinned in mise.toml
pnpm install          # JavaScript libraries
pnpm dev              # serve the site at http://localhost:3000
```

If mise is not activated in your shell, put `mise exec --` in front of the
commands, for example `mise exec -- pnpm dev`.

## The Lisp blog post

"Teaching Lisp to Read" (`html/teaching_lisp_to_read.html`) runs Common Lisp
in the browser with [JSCL](https://github.com/jscl-project/jscl), in a Web
Worker (`js/lisp_worker.js`), and includes a small neural network, written in
Common Lisp, that reads handwritten digits. The same file, `lisp/digits.lisp`,
is trained by SBCL and run by JSCL.

The page works both served over http, as on GitHub Pages, and opened
straight from disk. Browsers stop a page opened from a `file://` address from
fetching files or starting a worker, so there it loads `data/bundle.js`
instead, a copy of the Lisp source and the data, and runs Lisp in the tab.
After editing `lisp/digits.lisp`, run `pnpm bundle` to refresh that copy.

The data the page loads is committed. To rebuild it:

```sh
pnpm vendor           # copy JSCL from node_modules into vendor/
pnpm mnist            # download MNIST into data/mnist/ (55 MB, not committed)
pnpm subset           # write data/digits-sample.png and .json for the page
pnpm train            # train with SBCL and write data/digits.weights
pnpm bundle           # refresh data/bundle.js (subset and train do this too)
```

`pnpm train` takes about eight minutes and reaches about 97.8% on the 10,000
MNIST test digits. It accepts optional arguments: epochs, hidden-layer size,
learning rate, and jitter in pixels, for example `pnpm train 10 64 0.05 1`.

## The basement post

"A Basement, Three Ways" (`html/a-basement-three-ways.html`) shows a
hand-drawn basement plan, photographed, next to two drawings made from it: a
clean floor plan and an axonometric view of the finished rooms. Both drawings
are SVG files written by one script, `scripts/basement-plan.mjs`, from a
description of the plan in feet at the top of that file. The images, including
the untouched photo, are in `images/basement/`.

```sh
pnpm basement         # redraw images/basement/plan.svg and isometric.svg
```
