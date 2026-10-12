# data/

Data the pages load. All of it can be rebuilt; see the README at the top of the
repository.

| file | what it is |
| --- | --- |
| digits-sample.png, digits-sample.json | 1,500 handwritten digits chosen from MNIST by `scripts/make-subset.mjs`: 1,000 from the training set and 500 from the test set, 150 of each digit |
| digits.weights | the trained network from `lisp/train.lisp`: the bytes `DGW1`, three little-endian uint32s (inputs, hidden, outputs), then little-endian float32 weights and biases |
| bundle.js | all of the above plus the text of `lisp/digits.lisp`, in one script, written by `scripts/bundle-data.mjs`; the page loads it only when opened straight from disk |
| mnist/ | the full MNIST files, downloaded by `pnpm mnist`; not committed |

The digits are from the MNIST database of Yann LeCun, Corinna Cortes and
Christopher J.C. Burges (archived at
https://web.archive.org/web/2023/http://yann.lecun.com/exdb/mnist/), which is
derived from NIST Special Databases 3 and 7. MNIST is commonly distributed under
the Creative Commons Attribution-Share Alike 3.0 license
(https://creativecommons.org/licenses/by-sa/3.0/), and the sample here is shared
under the same terms.
