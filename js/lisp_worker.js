// lisp_worker.js -- a Common Lisp that lives in a Web Worker.
// ------------------------------------------------------------------
// "Teaching Lisp to Read" keeps its Lisp here, on a background thread, so
// that the long jobs (training a network, checking five hundred digits)
// never freeze the page. The page sends Lisp text; this worker sends back
// what Lisp printed and returned. The Lisp itself is JSCL
// (vendor/jscl.js), a Common Lisp compiler that produces JavaScript.
//
// Messages in:   { id, op: "run",    text, quiet }  evaluate a cell
//                { id, op: "eval",   form }         evaluate one form
//                { id, op: "define", name, value }  bind a global to an array
// Messages out:  { type: "ready", version } once, then { id, result } or
//                { id, error } for each message, in the order received.
// ------------------------------------------------------------------

"use strict";

// JSCL announces every file it loads on the console. Keep it quiet while it boots.
const consoleLog = console.log;
console.log = () => {};
try {
  importScripts("../vendor/jscl.js");
} finally {
  console.log = consoleLog;
}

const evaluate = (text) => jscl.evaluateString(text);

// Text from the page reaches Lisp through this slot rather than being pasted
// into Lisp source, so nothing in it ever needs escaping.
self.__lisp_in = null;

// The helpers live in CL-USER, and every call to them below names that
// package, so they keep working even after a cell moves the reader into
// another package with IN-PACKAGE.
const BRIDGE = String.raw`
(progn
  (defun %export-keywords ()
    "This build of JSCL forgets to export the keywords it reads, so they
print as ::NAME. Exporting them makes them print as :NAME, as in any
other Lisp."
    (let ((keywords (find-package "KEYWORD")))
      (do-symbols (s keywords)
        (export s keywords))))

  (defun %run (text &optional (fix-keywords t))
    "Evaluate every form in TEXT, the way a cell does, reading it in the
current package. Return one string: what the forms printed, then a line
per value returned, marked =>, or a line for an error, marked !!"
    (let ((in (make-string-input-stream text))
          (out (make-string-output-stream))
          (report (make-string-output-stream)))
      (handler-case
          (let ((*standard-output* out))
            (loop
              (let ((form (read in nil '%eof)))
                (when (eq form '%eof) (return))
                (when fix-keywords (%export-keywords))
                (dolist (v (multiple-value-list (eval form)))
                  (format report "~&=> ~s~%" v)))))
        (error (e)
          (format report "~&!! ~a~%" e)))
      (let ((printed (get-output-stream-string out)))
        (concatenate 'string
                     printed
                     ;; Start the values on a line of their own.
                     (if (and (> (length printed) 0)
                              (char/= (char printed (1- (length printed))) #\Newline))
                         (string #\Newline)
                         "")
                     (get-output-stream-string report)))))

  (defvar *%error* nil)

  (defun %call (thunk)
    "Call THUNK. If it signals an error, remember the message and return NIL."
    (setf *%error* nil)
    (handler-case (funcall thunk)
      (error (e)
        (setf *%error* (princ-to-string e))
        nil)))

  (defun %eval-text (text)
    "Read TEXT in CL-USER, whatever package the cells have moved to, and
evaluate it. The page's own forms come through here."
    (eval (let ((*package* (find-package "CL-USER")))
            (read-from-string text)))))
`;

// Turn whatever Lisp returned into plain data the page can receive: numbers,
// strings, arrays for vectors and proper lists, null for NIL, and the printed
// form of anything else.
const NIL = jscl.internals.intern("NIL");
const T = jscl.internals.intern("T");
const Cons = jscl.internals.Cons;

function plain(x) {
  if (x === undefined || x === null || x === false || x === NIL) return null;
  if (x === true || x === T) return true;
  if (typeof x === "number" || typeof x === "string") return x;
  if (typeof x === "object" && x.stringp === 1) return jscl.internals.xstring(x);
  if (Array.isArray(x) || ArrayBuffer.isView(x)) return Array.from(x, plain);
  if (x instanceof Cons) {
    const items = [];
    let cell = x;
    for (; cell instanceof Cons; cell = cell.$$jscl_cdr) items.push(plain(cell.$$jscl_car));
    if (cell === NIL) return items;
  }
  self.__lisp_in = x;
  return String(evaluate("(cl:prin1-to-string #j:__lisp_in)"));
}

function handle(message) {
  switch (message.op) {
    case "run": {
      self.__lisp_in = message.text;
      // The page's own code has no keywords to fix; skip the work for it.
      const report = evaluate(message.quiet
        ? "(cl-user::%run #j:__lisp_in cl:nil)"
        : "(cl-user::%run #j:__lisp_in)");
      if (typeof report !== "string") throw new Error("Lisp could not run the cell");
      return report;
    }
    case "eval": {
      self.__lisp_in = message.form;
      const value = evaluate("(cl-user::%call (cl:lambda () (cl-user::%eval-text #j:__lisp_in)))");
      const error = evaluate("cl-user::*%error*");
      if (typeof error === "string") throw new Error(error);
      return plain(value);
    }
    case "define": {
      if (!/^[*%a-z0-9-]+$/i.test(message.name)) throw new Error("bad name " + message.name);
      self.__lisp_in = message.value;
      evaluate("(cl:defparameter cl-user::" + message.name + " #j:__lisp_in)");
      return null;
    }
    default:
      throw new Error("unknown op " + message.op);
  }
}

self.onmessage = (event) => {
  const message = event.data;
  try {
    self.postMessage({ id: message.id, result: handle(message) });
  } catch (e) {
    self.postMessage({ id: message.id, error: e && e.message ? e.message : String(e) });
  } finally {
    self.__lisp_in = null;
  }
};

try {
  evaluate(BRIDGE);
  self.postMessage({ type: "ready", version: String(evaluate("(cl:lisp-implementation-version)")) });
} catch (e) {
  self.postMessage({ type: "failed", error: e && e.message ? e.message : String(e) });
}
