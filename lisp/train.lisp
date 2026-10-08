;;;; train.lisp -- train the network in digits.lisp on MNIST, using SBCL,
;;;; and save its weights for the browser.
;;;;
;;;; Usage (from the repository root, with the MNIST files unpacked in data/mnist/):
;;;;
;;;;     sbcl --script lisp/train.lisp [epochs] [hidden-size] [learning-rate] [jitter]
;;;;
;;;; Defaults: 10 epochs, 64 hidden neurons, learning rate 0.05, jitter 1 pixel.
;;;; Writes data/digits.weights (see WRITE-WEIGHTS for the format).
;;;;
;;;; This file is SBCL-specific (it reads binary files and uses SBCL's float
;;;; helpers). The network itself, in digits.lisp, is portable Common Lisp.

(defvar *root* (merge-pathnames "../" (make-pathname :name nil :type nil
                                                    :defaults *load-truename*)))

(load (merge-pathnames "lisp/digits.lisp" *root*))

(defun command-line-arg (n default)
  (let ((args (cdr sb-ext:*posix-argv*)))
    (if (> (length args) n)
        (let ((*read-default-float-format* 'single-float))
          (read-from-string (nth n args)))
        default)))

(defparameter *epochs*        (command-line-arg 0 10))
(defparameter *hidden*        (command-line-arg 1 64))
(defparameter *learning-rate* (command-line-arg 2 0.05))
(defparameter *jitter*        (command-line-arg 3 1)
  "During training, shift each digit by up to this many pixels in a random
direction, so the network learns that a 7 is still a 7 when it moves.")

;;; ---- reading MNIST ---------------------------------------------------------
;;; The IDX format: a big-endian 32-bit magic number, then the dimensions
;;; (also big-endian 32-bit), then the bytes, row-major.

(defun read-u32-be (stream)
  (logior (ash (read-byte stream) 24)
          (ash (read-byte stream) 16)
          (ash (read-byte stream) 8)
          (read-byte stream)))

(defun read-idx-images (path)
  "A vector of images, each a vector of 784 single-floats in [0, 1]."
  (with-open-file (in path :element-type '(unsigned-byte 8))
    (let ((magic (read-u32-be in)))
      (unless (= magic 2051) (error "~a is not an IDX image file" path)))
    (let* ((count (read-u32-be in))
           (rows (read-u32-be in))
           (cols (read-u32-be in))
           (size (* rows cols))
           (bytes (make-array size :element-type '(unsigned-byte 8)))
           (images (make-array count)))
      (dotimes (i count images)
        (unless (= (read-sequence bytes in) size)
          (error "~a is truncated; delete it and run pnpm mnist" path))
        (let ((img (make-array size :element-type 'single-float)))
          (dotimes (k size)
            (setf (aref img k) (/ (aref bytes k) 255.0)))
          (setf (aref images i) img))))))

(defun read-idx-labels (path)
  (with-open-file (in path :element-type '(unsigned-byte 8))
    (let ((magic (read-u32-be in)))
      (unless (= magic 2049) (error "~a is not an IDX label file" path)))
    (let* ((count (read-u32-be in))
           (labels (make-array count)))
      (dotimes (i count labels)
        (setf (aref labels i)
              (or (read-byte in nil)
                  (error "~a is truncated; delete it and run pnpm mnist" path)))))))

;;; ---- writing the weights ---------------------------------------------------
;;; Format: the four bytes "DGW1"; then three little-endian uint32s: inputs,
;;; hidden, outputs; then little-endian IEEE-754 float32s in this order:
;;; hidden weights (hidden x inputs, row-major), hidden biases, output weights
;;; (outputs x hidden), output biases. The browser reads it with a DataView.

(defun write-u32-le (n out)
  (dotimes (k 4)
    (write-byte (ldb (byte 8 (* 8 k)) n) out)))

(defun write-f32-le (f out)
  (write-u32-le (ldb (byte 32 0) (sb-kernel:single-float-bits (float f 1.0))) out))

(defun write-layer (layer out)
  (let ((weights (layer-weights layer))
        (biases (layer-biases layer)))
    (dotimes (j (length weights))
      (let ((w (aref weights j)))
        (dotimes (i (length w))
          (write-f32-le (aref w i) out))))
    (dotimes (j (length biases))
      (write-f32-le (aref biases j) out))))

(defun write-weights (net path)
  (with-open-file (out path :element-type '(unsigned-byte 8)
                            :direction :output :if-exists :supersede)
    (let* ((hidden (network-hidden net))
           (output (network-output net))
           (inputs (length (aref (layer-weights hidden) 0))))
      (loop for ch across "DGW1" do (write-byte (char-code ch) out))
      (write-u32-le inputs out)
      (write-u32-le (layer-size hidden) out)
      (write-u32-le (layer-size output) out)
      (write-layer hidden out)
      (write-layer output out))))

;;; ---- training ----------------------------------------------------------------

(defun shuffle! (v)
  "Fisher-Yates: put the elements of V in random order, in place."
  (loop for i from (1- (length v)) downto 1
        do (rotatef (aref v i) (aref v (random (1+ i)))))
  v)

(defun jittered (image)
  (if (zerop *jitter*)
      image
      (shift-image image
                   (- (random (1+ (* 2 *jitter*))) *jitter*)
                   (- (random (1+ (* 2 *jitter*))) *jitter*))))

(defun seconds-since (start)
  (/ (- (get-internal-real-time) start) (float internal-time-units-per-second)))

(defun main ()
  (let* ((data (merge-pathnames "data/mnist/" *root*))
         (train-images (read-idx-images (merge-pathnames "train-images-idx3-ubyte" data)))
         (train-labels (read-idx-labels (merge-pathnames "train-labels-idx1-ubyte" data)))
         (test-images  (read-idx-images (merge-pathnames "t10k-images-idx3-ubyte" data)))
         (test-labels  (read-idx-labels (merge-pathnames "t10k-labels-idx1-ubyte" data)))
         (n (length train-images))
         (order (make-array n))
         (net (make-random-network :hidden *hidden*))
         (started (get-internal-real-time)))
    (dotimes (i n) (setf (aref order i) i))
    (format t "~d training digits, ~d test digits~%" n (length test-images))
    (format t "network: 784 -> ~d -> 10, learning rate ~a, jitter ~a px, ~d epochs~%~%"
            *hidden* *learning-rate* *jitter* *epochs*)
    (format t "before training: test accuracy ~,2f%~%"
            (* 100 (accuracy net test-images test-labels)))
    (dotimes (epoch *epochs*)
      (shuffle! order)
      (let ((total-loss 0.0)
            (epoch-started (get-internal-real-time)))
        (dotimes (k n)
          (let ((i (aref order k)))
            (incf total-loss
                  (train-step net (jittered (aref train-images i))
                              (aref train-labels i) *learning-rate*))))
        (format t "epoch ~2d: mean loss ~,4f   test accuracy ~,2f%   (~,1f s)~%"
                (1+ epoch) (/ total-loss n)
                (* 100 (accuracy net test-images test-labels))
                (seconds-since epoch-started))
        (finish-output)))
    (let ((path (merge-pathnames "data/digits.weights" *root*)))
      (write-weights net path)
      (format t "~%wrote ~a (~d bytes) in ~,1f s total~%"
              (enough-namestring path *root*)
              (with-open-file (f path :element-type '(unsigned-byte 8)) (file-length f))
              (seconds-since started)))))

;; SBCL normally signals an error on floating-point overflow. JavaScript never
;; does: it quietly produces infinity, and 1/(1+infinity) is 0. Masking the
;; traps gives the training run the same arithmetic the browser has.
(sb-int:with-float-traps-masked (:overflow :invalid :divide-by-zero :inexact)
  (setf *random-state* (sb-ext:seed-random-state 2026))
  (main))
