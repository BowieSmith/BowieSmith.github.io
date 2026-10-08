;;;; digits.lisp -- a small neural network that learns to read
;;;; handwritten digits.
;;;;
;;;; This one file is the whole network. It runs unchanged in two
;;;; places:
;;;;   * in SBCL on a laptop, where train.lisp loads it and trains it
;;;;     on all 60,000 MNIST training digits, and
;;;;   * in JSCL in your browser, where the blog post "Teaching Lisp to
;;;;     Read" loads it, shows it to you a section at a time, and uses
;;;;     it to read what you draw.
;;;;
;;;; Lines beginning with ";;;; ---- name" mark the sections the blog
;;;; post shows as separate cells. They are comments; Lisp ignores
;;;; them.
;;;;
;;;; Written by Claude, guided by Bowie Smith, October 2026.

;;;; ---- vectors
;;; We keep numbers in plain vectors. A digit is a vector of 784
;;; pixels (28 x 28), each between 0.0 (paper) and 1.0 (ink).
;;; Everything the network knows is kept in vectors too.

(defun make-vector (n &optional (fill 0.0))
  (make-array n :initial-element fill))

(defun random-unit ()
  "A random number between 0 and 1. It is built from a whole number
because one of our two Lisps, JSCL, can only pick whole numbers."
  (/ (random 1000000) 1000000.0))

(defun random-vector (n scale)
  "A vector of N random numbers between -SCALE and SCALE."
  (let ((v (make-vector n)))
    (dotimes (i n v)
      (setf (aref v i) (* scale (- (* 2.0 (random-unit)) 1.0))))))

;;;; ---- neuron
;;; A neuron has one weight per input, and a bias. It multiplies
;;; each input by its weight, adds them all up with the bias, and
;;; that sum is its opinion. Everything else in this file is
;;; arranging neurons and adjusting their weights.

(defun weighted-sum (weights bias inputs)
  (let ((sum bias))
    (dotimes (i (length inputs) sum)
      (incf sum (* (aref weights i) (aref inputs i))))))

;;; The sigmoid squashes any number into the range (0, 1), smoothly:
;;; large negative sums go toward 0, large positive sums toward 1.
;;; Its slope is pleasant: if s = (sigmoid x), then ds/dx = s(1 - s).

(defun sigmoid (x)
  (/ 1.0 (+ 1.0 (exp (- x)))))

;;;; ---- layer
;;; A layer is many neurons looking at the same inputs. We store it
;;; as a vector of weight vectors (one per neuron) and a vector of
;;; biases.

(defstruct layer
  weights   ; one weight vector per neuron
  biases)   ; one bias per neuron

(defun make-random-layer (inputs outputs)
  "A layer of OUTPUTS neurons, each with INPUTS small random weights
and no bias."
  (let ((scale (/ 1.0 (sqrt inputs)))
        (weights (make-array outputs)))
    (dotimes (j outputs)
      (setf (aref weights j) (random-vector inputs scale)))
    (make-layer :weights weights :biases (make-vector outputs))))

(defun layer-size (layer)
  (length (layer-biases layer)))

(defun layer-sums (layer inputs)
  "Every neuron's weighted sum, as a vector."
  (let* ((n (layer-size layer))
         (sums (make-vector n)))
    (dotimes (j n sums)
      (setf (aref sums j)
            (weighted-sum (aref (layer-weights layer) j)
                          (aref (layer-biases layer) j)
                          inputs)))))

;;;; ---- network
;;; Our network is two layers. The hidden layer looks at the 784
;;; pixels and produces 64 numbers, each squashed by the sigmoid. The
;;; output layer looks at those 64 numbers and produces 10 sums, one
;;; per digit, which softmax turns into 10 probabilities that add up
;;; to 1.

(defstruct network hidden output)

(defun make-random-network (&key (inputs 784) (hidden 64)
                                 (outputs 10))
  (make-network :hidden (make-random-layer inputs hidden)
                :output (make-random-layer hidden outputs)))

(defun softmax (sums)
  "Turn a vector of sums into probabilities: exponentiate each, then
divide by the total. Subtracting the largest sum first changes
nothing mathematically, and keeps EXP from overflowing."
  (let* ((n (length sums))
         (biggest (aref sums 0))
         (probs (make-vector n))
         (total 0.0))
    (dotimes (j n)
      (when (> (aref sums j) biggest)
        (setf biggest (aref sums j))))
    (dotimes (j n)
      (let ((e (exp (- (aref sums j) biggest))))
        (setf (aref probs j) e)
        (incf total e)))
    (dotimes (j n probs)
      (setf (aref probs j) (/ (aref probs j) total)))))

(defun forward (net pixels)
  "Run PIXELS through NET. Returns two values: the 10 output
probabilities, and the hidden layer's activations, which the
training step needs."
  (let* ((hidden-sums (layer-sums (network-hidden net) pixels))
         (hidden (make-vector (length hidden-sums))))
    (dotimes (i (length hidden-sums))
      (setf (aref hidden i) (sigmoid (aref hidden-sums i))))
    (values (softmax (layer-sums (network-output net) hidden))
            hidden)))

;;;; ---- predict
;;; The network's answer is whichever digit it gives the highest
;;; probability.

(defun argmax (v)
  (let ((best 0))
    (dotimes (i (length v) best)
      (when (> (aref v i) (aref v best))
        (setf best i)))))

(defun predict (net pixels)
  (argmax (forward net pixels)))

;;;; ---- loss
;;; How wrong was the network? If it gave the right digit
;;; probability p, its loss is -log p: zero when it was certain and
;;; right, large when it was confident and wrong. This is called
;;; cross-entropy, and it is also the network's surprise at the
;;; truth.

(defun loss (probs label)
  (- (log (max (aref probs label) 1e-7))))

;;;; ---- train-step
;;; One step of learning, from one example. Run the network forward,
;;; measure how far each output was from the truth, pass that error
;;; backward through the output weights to find how far each hidden
;;; neuron was off, then nudge every weight a little in the direction
;;; that would have made the error smaller. The size of the nudge is
;;; the learning rate.
;;;
;;; The two error vectors ("deltas") are simple:
;;;   output delta_j = p_j - truth_j        (belief minus truth)
;;;   hidden delta_i = h_i (1 - h_i) * sum over j of w_ji delta_j
;;; The second is the first, carried back through the weights and
;;; scaled by the sigmoid's slope. That is all backpropagation is.

(defun train-step (net pixels label learning-rate)
  "Adjust NET so it is a little more likely to answer LABEL for
PIXELS. Returns the loss before the adjustment."
  (multiple-value-bind (probs hidden) (forward net pixels)
    (let* ((out (network-output net))
           (hid (network-hidden net))
           (n-out (layer-size out))
           (n-hid (layer-size hid))
           (out-delta (make-vector n-out))
           (hid-delta (make-vector n-hid)))
      ;; 1. How wrong was each output? Belief minus truth.
      (dotimes (j n-out)
        (setf (aref out-delta j)
              (- (aref probs j) (if (= j label) 1.0 0.0))))
      ;; 2. Carry the error back to the hidden neurons.
      (dotimes (i n-hid)
        (let ((back 0.0))
          (dotimes (j n-out)
            (incf back (* (aref (aref (layer-weights out) j) i)
                          (aref out-delta j))))
          (let ((h (aref hidden i)))
            (setf (aref hid-delta i) (* back h (- 1.0 h))))))
      ;; 3. Nudge the output layer's weights and biases.
      (dotimes (j n-out)
        (let ((w (aref (layer-weights out) j))
              (nudge (* learning-rate (aref out-delta j))))
          (dotimes (i n-hid)
            (decf (aref w i) (* nudge (aref hidden i))))
          (decf (aref (layer-biases out) j) nudge)))
      ;; 4. Nudge the hidden layer's weights and biases.
      (dotimes (i n-hid)
        (let ((w (aref (layer-weights hid) i))
              (nudge (* learning-rate (aref hid-delta i))))
          (dotimes (k (length pixels))
            (decf (aref w k) (* nudge (aref pixels k))))
          (decf (aref (layer-biases hid) i) nudge)))
      (loss probs label))))

;;;; ---- accuracy
;;; To judge the network honestly, ask it about digits it never
;;; trained on.

(defun accuracy (net images labels)
  "The fraction of IMAGES whose predicted digit matches LABELS."
  (let ((right 0)
        (n (length images)))
    (dotimes (i n)
      (when (= (predict net (aref images i)) (aref labels i))
        (incf right)))
    (/ (* 1.0 right) n)))

;;;; ---- center
;;; MNIST's digits were placed so that their center of mass sits in
;;; the middle of the 28 x 28 square. A digit you draw has to be
;;; moved the same way before the network sees it, or the network
;;; is looking at a kind of picture it has never seen. These shift
;;; an image by whole pixels until its ink is centered.

(defun center-of-mass (pixels &optional (size 28))
  "Returns two values: the row and the column of the ink's center
of mass."
  (let ((total 0.0) (row-sum 0.0) (col-sum 0.0))
    (dotimes (r size)
      (dotimes (c size)
        (let ((v (aref pixels (+ (* r size) c))))
          (incf total v)
          (incf row-sum (* r v))
          (incf col-sum (* c v)))))
    (if (> total 0.0)
        (values (/ row-sum total) (/ col-sum total))
        (values (/ (- size 1) 2.0) (/ (- size 1) 2.0)))))

(defun shift-image (pixels down right &optional (size 28))
  "A copy of PIXELS moved DOWN rows and RIGHT columns. Negative
numbers move it up and left."
  (let ((out (make-vector (* size size))))
    (dotimes (r size out)
      (dotimes (c size)
        (let ((src-r (- r down))
              (src-c (- c right)))
          (when (and (<= 0 src-r) (< src-r size)
                     (<= 0 src-c) (< src-c size))
            (setf (aref out (+ (* r size) c))
                  (aref pixels (+ (* src-r size) src-c)))))))))

(defun center-image (pixels &optional (size 28))
  "Move the ink so its center of mass sits where MNIST put it: on
pixel 14 of 28, counting from 0. That is half a pixel below and to
the right of the true middle, a rounding quirk of the original
pipeline that the network has learned to expect."
  (multiple-value-bind (row col) (center-of-mass pixels size)
    (let ((middle (/ size 2.0)))
      (shift-image pixels
                   (round (- middle row))
                   (round (- middle col))
                   size))))

;;;; ---- end
