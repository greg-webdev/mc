import { installWorkerResourceLoader } from "./split-resources.js";
installWorkerResourceLoader();
// This code implements the `-sMODULARIZE` settings by taking the generated
// JS program code (INNER_JS_CODE) and wrapping it in a factory function.

// When targeting node and ES6 we use `await import ..` in the generated code
// so the outer function needs to be marked as async.
async function createDotnetRuntime(moduleArg = {}) {
  var Module = moduleArg;
// include: shell.js
// include: minimum_runtime_check.js
// end include: minimum_runtime_check.js
// The Module object: Our interface to the outside world. We import
// and export values on it. There are various ways Module can be used:
// 1. Not defined. We create it here
// 2. A function parameter, function(moduleArg) => Promise<Module>
// 3. pre-run appended it, var Module = {}; ..generated code..
// 4. External script tag defines var Module.
// We need to check if Module already exists (e.g. case 3 above).
// Substitution will be replaced with actual code on later stage of the build,
// this way Closure Compiler will not mangle it (e.g. case 4. above).
// Note that if you want to run closure, and also to use Module
// after the generated code, you will need to define   var Module = {};
// before the code. Then that object will be used in the code, and you
// can continue to use Module afterwards as well.
// Determine the runtime environment we are in. You can customize this by
// setting the ENVIRONMENT setting at compile time (see settings.js).
// Attempt to auto-detect the environment
var ENVIRONMENT_IS_WEB = !!globalThis.window;

var ENVIRONMENT_IS_WORKER = !!globalThis.WorkerGlobalScope;

// N.b. Electron.js environment is simultaneously a NODE-environment, but
// also a web environment.
var ENVIRONMENT_IS_NODE = globalThis.process?.versions?.node && globalThis.process?.type != "renderer";

var ENVIRONMENT_IS_SHELL = !ENVIRONMENT_IS_WEB && !ENVIRONMENT_IS_NODE && !ENVIRONMENT_IS_WORKER;

// Three configurations we can be running in:
// 1) We could be the application main() thread running in the main JS UI thread. (ENVIRONMENT_IS_WORKER == false and ENVIRONMENT_IS_PTHREAD == false)
// 2) We could be the application main() running directly in a worker. (ENVIRONMENT_IS_WORKER == true, ENVIRONMENT_IS_PTHREAD == false)
// 3) We could be an application pthread running in a worker. (ENVIRONMENT_IS_WORKER == true and ENVIRONMENT_IS_PTHREAD == true)
// The way we signal to a worker that it is hosting a pthread is to construct
// it with a specific name.
var ENVIRONMENT_IS_PTHREAD = ENVIRONMENT_IS_WORKER && globalThis.name == "em-pthread";

// --pre-jses are emitted after the Module integration code, so that they can
// refer to Module (if they choose; they can also define Module)
// include: /root/ikvmcraft/statics/dotnet/runtimes/browser-wasm/native/src/es6/dotnet.es6.pre.js
if (_nativeModuleLoaded) throw new Error("Native module already loaded");

_nativeModuleLoaded = true;

createDotnetRuntime = Module = moduleArg(Module);

// end include: /root/ikvmcraft/statics/dotnet/runtimes/browser-wasm/native/src/es6/dotnet.es6.pre.js
// include: /root/ikvmcraft/loader/wasmfs-wisp-transport.js
// The socket transport for WasmFS's AF_INET/AF_INET6 sockets (FNA-WASM-Build emsdk.12, src/lib/libwasmfs_sockets.js
// has the contract): TCP streams over one Wisp connection per worker, with wisp-js's client.
// Linked with --pre-js, so it is defined in every worker; emsdk.12 calls it only on its network pthread, and every
// event below is delivered there (the Wisp WebSocket belongs to that worker). Two environment variables, which the
// frontend sets, configure it: IKVM_WISP_URL (the Wisp server) and IKVM_WISP_CLIENT_URL (wisp-js's self-contained
// dist/wisp-client.mjs, served next to the app).
// What Wisp v1 cannot express, and so this does not offer: a connect acknowledgement (open is reported once the Wisp
// connection is up, and a refused or unreachable host arrives as a close with an errno), half-close (shutdown), and
// receive-side flow control (pause/resume: the server does not wait for the client).
Module["wasmfsSocketTransport"] = (() => {
  // Wisp CLOSE reasons -> the names emsdk.12 maps to errno. 0x02 (voluntary) is an orderly close.
  const closeErrno = reason => {
    switch (reason) {
     case 1:
     case 2:
      return 0;

     case 66:
      return "EHOSTUNREACH";

     case 67:
     case 71:
      return "ETIMEDOUT";

     case 68:
     case 72:
     case 73:
      return "ECONNREFUSED";

     default:
      return "ECONNRESET";
    }
  };
  // The C environment: the runtime setenv()s the config's environmentVariables at startup, into the one environ every
  // pthread shares. (Module.config, where main keeps them, read back nothing on the network pthread's worker.)
  const env = name => {
    const n = lengthBytesUTF8(name) + 1, p = _malloc(n);
    try {
      stringToUTF8(name, p, n);
      const v = _mono_wasm_getenv(p);
      if (!v) return undefined;
      try {
        return UTF8ToString(v);
      } finally {
        _free(v);
      }
    } finally {
      _free(p);
    }
  };
  // err() is emscripten's printErr, which a pthread forwards to the page's console
  let announced = false;
  let wisp = null;
  // the wisp-js client module, once imported
  let conn = null;
  // the ClientConnection, while it is up or connecting
  let connReady = null;
  // resolves once conn has its first CONTINUE (Wisp's "ready")
  const streams = new Map;
  // socket id -> { stream, events }
  async function connection() {
    if (conn && conn.connected) return conn;
    if (connReady) return connReady;
    connReady = (async () => {
      const url = env("IKVM_WISP_URL"), client = env("IKVM_WISP_CLIENT_URL");
      if (!url || !client) throw new Error("IKVM_WISP_URL / IKVM_WISP_CLIENT_URL are not set");
      wisp ??= (await import(/* webpackIgnore: true */ client)).client;
      const c = new wisp.ClientConnection(url);
      await new Promise((resolve, reject) => {
        c.onopen = resolve;
        c.onerror = () => reject(new Error(`wisp: cannot connect to ${url}`));
      });
      // the WebSocket went away: every stream on it is gone (cleanup() closes them with reason 0x03)
      c.onclose = () => {
        if (conn === c) {
          conn = null;
          connReady = null;
        }
      };
      conn = c;
      return c;
    })();
    try {
      return await connReady;
    } catch (e) {
      connReady = null;
      throw e;
    }
  }
  return {
    "connect"(id, host, port, family, events) {
      if (!announced) {
        announced = true;
        err(`[wisp transport] first connect ${host}:${port}; wisp ${env("IKVM_WISP_URL")}, client ${env("IKVM_WISP_CLIENT_URL")}`);
      }
      connection().then(c => {
        const stream = c.create_stream(host, port, 1);
        streams.set(id, {
          stream,
          events
        });
        stream.onmessage = bytes => events["data"](id, bytes);
        stream.onclose = reason => {
          if (!streams.delete(id)) return;
          const err = closeErrno(reason);
          if (!err) events["end"](id);
          events["close"](id, err);
        };
        // DATA that waited for CONTINUE credit leaves wisp-js's send_buffer here; report it drained then
        const cont = stream.continue_received.bind(stream);
        stream.continue_received = n => {
          const before = stream.send_buffer.reduce((a, b) => a + b.byteLength, 0);
          cont(n);
          const after = stream.send_buffer.reduce((a, b) => a + b.byteLength, 0);
          if (before > after) events["drained"](id, before - after);
        };
        events["open"](id);
      }, e => {
        err(`[wisp transport] ${host}:${port}: ${e && e.stack || e}`);
        events["close"](id, "ENETUNREACH");
      });
    },
    "send"(id, bytes) {
      const s = streams.get(id);
      if (!s) return;
      const queued = s.stream.buffer_size <= 0;
      s.stream.send(bytes);
      // sent now: it is the WebSocket's; queued: drained when CONTINUE releases it (above)
      if (!queued) s.events["drained"](id, bytes.byteLength);
    },
    "close"(id, abort) {
      const s = streams.get(id);
      if (!s) return;
      streams.delete(id);
      s.stream.close(abort ? 3 : 2);
    }
  };
})();

// end include: /root/ikvmcraft/loader/wasmfs-wisp-transport.js
var programArgs = [];

var thisProgram = "./this.program";

var quit_ = (status, toThrow) => {
  throw toThrow;
};

var _scriptName = import.meta.url;

// `/` should be present at the end if `scriptDirectory` is not empty
var scriptDirectory = "";

function locateFile(path) {
  if (Module["locateFile"]) {
    return Module["locateFile"](path, scriptDirectory);
  }
  return scriptDirectory + path;
}

// Hooks that are implemented differently in different runtime environments.
var readAsync, readBinary;

// Note that this includes Node.js workers when relevant (pthreads is enabled).
// Node.js workers are detected as a combination of ENVIRONMENT_IS_WORKER and
// ENVIRONMENT_IS_NODE.
if (ENVIRONMENT_IS_WEB || ENVIRONMENT_IS_WORKER) {
  try {
    scriptDirectory = new URL(".", _scriptName).href;
  } catch {}
  {
    // include: web_or_worker_shell_read.js
    if (ENVIRONMENT_IS_WORKER) {
      readBinary = url => {
        var xhr = new XMLHttpRequest;
        xhr.open("GET", url, false);
        xhr.responseType = "arraybuffer";
        xhr.send(null);
        return new Uint8Array(/** @type{!ArrayBuffer} */ (xhr.response));
      };
    }
    readAsync = async url => {
      var response = await fetch(url, {
        credentials: "same-origin"
      });
      if (response.ok) {
        return response.arrayBuffer();
      }
      throw new Error(response.status + " : " + response.url);
    };
  }
} else {}

var out = console.log.bind(console);

var err = console.error.bind(console);

// end include: shell.js
// include: preamble.js
// === Preamble library stuff ===
// Documentation for the public APIs defined in this file must be updated in:
//    site/source/docs/api_reference/preamble.js.rst
// A prebuilt local version of the documentation is available at:
//    site/build/text/docs/api_reference/preamble.js.txt
// You can also build docs locally as HTML or other formats in site/
// An online HTML version (which may be of a different version of Emscripten)
//    is up at http://kripken.github.io/emscripten-site/docs/api_reference/preamble.js.html
var wasmBinary;

// Wasm globals
// For sending to workers.
var wasmModule;

//========================================
// Runtime essentials
//========================================
// whether we are quitting the application. no code should run after this.
// set in exit() and abort()
var ABORT = false;

// set by exit() and abort().  Passed to 'onExit' handler.
// NOTE: This is also used as the process return code in shell environments
// but only when noExitRuntime is false.
var EXITSTATUS;

// In STRICT mode, we only define assert() when ASSERTIONS is set.  i.e. we
// don't define it at all in release modes.  This matches the behaviour of
// MINIMAL_RUNTIME.
// TODO(sbc): Make this the default even without STRICT enabled.
/** @type {function(*, string=)} */ function assert(condition, text) {
  if (!condition) {
    // This build was created without ASSERTIONS defined.  `assert()` should not
    // ever be called in this configuration but in case there are callers in
    // the wild leave this simple abort() implementation here for now.
    abort(text);
  }
}

/**
 * Indicates whether filename is delivered via file protocol (as opposed to http/https)
 * @noinline
 */ var isFileURI = filename => filename.startsWith("file://");

// include: runtime_common.js
// include: runtime_stack_check.js
// end include: runtime_stack_check.js
// include: runtime_exceptions.js
// end include: runtime_exceptions.js
// include: runtime_debug.js
// end include: runtime_debug.js
// Support for growable heap + pthreads, where the buffer may change, so JS views
// must be updated.
function growMemViews() {
  // `updateMemoryViews` updates all the views simultaneously, so it's enough to check any of them.
  if (wasmMemory.buffer != HEAP8.buffer) {
    updateMemoryViews();
  }
}

// include: runtime_pthread.js
// Pthread Web Worker handling code.
// This code runs only on pthread web workers and handles pthread setup
// and communication with the main thread via postMessage.
var startWorker;

if (ENVIRONMENT_IS_PTHREAD) {
  // Thread-local guard variable for one-time init of the JS state
  var initializedJS = false;
  // Turn unhandled rejected promises into errors so that the main thread will be
  // notified about them.
  self.onunhandledrejection = e => {
    throw e.reason || e;
  };
  function handleMessage(e) {
    try {
      var msgData = e.data;
      //dbg('msgData: ' + Object.keys(msgData));
      var cmd = msgData.cmd;
      if (cmd == 1) {
        // Preload command that is called once per worker to parse and load the Emscripten code.
        // Until we initialize the runtime, queue up any further incoming messages.
        let messageQueue = [];
        self.onmessage = e => messageQueue.push(e);
        // And add a callback for when the runtime is initialized.
        startWorker = () => {
          // Notify the main thread that this thread has loaded.
          postMessage({
            cmd: 3
          });
          // Process any messages that were queued before the thread was ready.
          for (let msg of messageQueue) {
            handleMessage(msg);
          }
          // Restore the real message handler.
          self.onmessage = handleMessage;
        };
        // Use `const` here to ensure that the variable is scoped only to
        // that iteration, allowing safe reference from a closure.
        for (const handler of msgData.handlers) {
          // If the main module has a handler for a certain event, but no
          // handler exists on the pthread worker, then proxy that handler
          // back to the main thread.
          if (!Module[handler] || Module[handler].proxy) {
            Module[handler] = (...args) => {
              postMessage({
                cmd: 9,
                handler,
                args
              });
            };
            // Rebind the out / err handlers if needed
            if (handler == "print") out = Module[handler];
            if (handler == "printErr") err = Module[handler];
          }
        }
        wasmMemory = msgData.wasmMemory;
        updateMemoryViews();
        wasmModule = msgData.wasmModule;
        createWasm();
        run();
        startWorker();
      } else if (cmd == 2) {
        // Call inside JS module to set up the stack frame for this pthread in JS module scope.
        // This needs to be the first thing that we do, as we cannot call to any C/C++ functions
        // until the thread stack is initialized.
        establishStackSpace(msgData.pthread_ptr);
        // Pass the thread address to wasm to store it for fast access.
        __emscripten_thread_init(msgData.pthread_ptr, /*is_main=*/ 0, /*is_runtime=*/ 0, /*can_block=*/ 1, 0, 0);
        PThread.receiveOffscreenCanvases(msgData);
        PThread.threadInitTLS();
        // Await mailbox notifications with `Atomics.waitAsync` so we can start
        // using the fast `Atomics.notify` notification path.
        __emscripten_thread_mailbox_await(msgData.pthread_ptr);
        if (!initializedJS) {
          initializedJS = true;
        }
        try {
          invokeEntryPoint(msgData.start_routine, msgData.arg);
        } catch (ex) {
          if (ex != "unwind") {
            // The pthread "crashed".  Do not call `_emscripten_thread_exit` (which
            // would make this thread joinable).  Instead, re-throw the exception
            // and let the top level handler propagate it back to the main thread.
            throw ex;
          }
        }
      } else if (cmd == 4) {
        if (initializedJS) {
          checkMailbox();
        }
      } else if (cmd) {
        // The received message looks like something that should be handled by this message
        // handler, (since there is a cmd field present), but is not one of the
        // recognized commands:
        err(`worker: received unknown command ${cmd}`);
        err(msgData);
      }
    } catch (ex) {
      if (runtimeInitialized) __emscripten_thread_crashed();
      throw ex;
    }
  }
  self.onmessage = handleMessage;
}

// ENVIRONMENT_IS_PTHREAD
// end include: runtime_pthread.js
// Memory management
var runtimeInitialized = false;

var runtimeExited = false;

// When ALLOW_MEMORY_GROWTH is enabled, the conversion from Wasm
// memory to ArrayBuffer requires some additional logic.
function getMemoryBuffer() {
  return wasmMemory.buffer;
}

function updateMemoryViews() {
  // If we already have a heap that is resizeable/growable buffer we don't
  // need to do anything in updateMemoryViews.
  if (HEAP8?.buffer?.growable) return;
  var b = getMemoryBuffer();
  Module["HEAP8"] = HEAP8 = new Int8Array(b);
  Module["HEAP16"] = HEAP16 = new Int16Array(b);
  Module["HEAPU8"] = HEAPU8 = new Uint8Array(b);
  Module["HEAPU16"] = HEAPU16 = new Uint16Array(b);
  Module["HEAP32"] = HEAP32 = new Int32Array(b);
  Module["HEAPU32"] = HEAPU32 = new Uint32Array(b);
  Module["HEAPF32"] = HEAPF32 = new Float32Array(b);
  Module["HEAPF64"] = HEAPF64 = new Float64Array(b);
  Module["HEAP64"] = HEAP64 = new BigInt64Array(b);
  Module["HEAPU64"] = HEAPU64 = new BigUint64Array(b);
}

// In non-standalone/normal mode, we create the memory here.
// include: runtime_init_memory.js
// Create the wasm memory. (Note: this only applies if IMPORTED_MEMORY is defined)
// check for full engine support (use string 'subarray' to avoid closure compiler confusion)
function initMemory() {
  if ((ENVIRONMENT_IS_PTHREAD)) {
    return;
  }
  {
    var INITIAL_MEMORY = 356712448;
    /** @suppress {checkTypes} */ wasmMemory = new WebAssembly.Memory({
      "initial": INITIAL_MEMORY / 65536,
      // In theory we should not need to emit the maximum if we want "unlimited"
      // or 4GB of memory, but VMs error on that atm, see
      // https://github.com/emscripten-core/emscripten/issues/14130
      // And in the pthreads case we definitely need to emit a maximum. So
      // always emit one.
      "maximum": 65535,
      "shared": true
    });
  }
  updateMemoryViews();
}

// end include: runtime_init_memory.js
// include: memoryprofiler.js
// end include: memoryprofiler.js
// end include: runtime_common.js
function preRun() {
  var preRun = Module["preRun"];
  if (preRun) {
    if (typeof preRun == "function") preRun = [ preRun ];
    onPreRuns.push(...preRun);
  }
  // Begin ATPRERUNS hooks
  callRuntimeCallbacks(onPreRuns);
}

function initRuntime() {
  runtimeInitialized = true;
  if (ENVIRONMENT_IS_PTHREAD) return;
  // No ATINITS hooks
  wasmExports["__wasm_call_ctors"]();
}

function exitRuntime() {
  ___funcs_on_exit();
  // Native atexit() functions
  // Begin ATEXITS hooks
  callRuntimeCallbacks(onExits);
  clearTimers();
  // End ATEXITS hooks
  PThread.terminateRuntime();
  runtimeExited = true;
}

function postRun() {
  var postRun = Module["postRun"];
  if (postRun) {
    if (typeof postRun == "function") postRun = [ postRun ];
    onPostRuns.push(...postRun);
  }
  // Begin ATPOSTRUNS hooks
  callRuntimeCallbacks(onPostRuns);
}

/**
 * @param {string|number=} what
 */ function abort(what) {
  Module["onAbort"]?.(what);
  what = `Aborted(${what})`;
  // TODO(sbc): Should we remove printing and leave it up to whoever
  // catches the exception?
  err(what);
  ABORT = true;
  what += ". Build with -sASSERTIONS for more info.";
  // Use a wasm runtime error, because a JS error might be seen as a foreign
  // exception, which means we'd run destructors on it. We need the error to
  // simply make the program stop.
  // FIXME This approach does not work in Wasm EH because it currently does not assume
  // all RuntimeErrors are from traps; it decides whether a RuntimeError is from
  // a trap or not based on a hidden field within the object. So at the moment
  // we don't have a way of throwing a wasm trap from JS. TODO Make a JS API that
  // allows this in the wasm spec.
  // Suppress closure compiler warning here. Closure compiler's builtin extern
  // definition for WebAssembly.RuntimeError claims it takes no arguments even
  // though it can.
  // TODO(https://github.com/google/closure-compiler/pull/3913): Remove if/when upstream closure gets fixed.
  // See above, in the meantime, we resort to wasm code for trapping.
  // In case abort() is called before the module is initialized, wasmExports
  // and its exported '__trap' function is not available, in which case we throw
  // a RuntimeError.
  // We trap instead of throwing RuntimeError to prevent infinite-looping in
  // Wasm EH code (because RuntimeError is considered as a foreign exception and
  // caught by 'catch_all'), but in case throwing RuntimeError is fine because
  // the module has not even been instantiated, even less running.
  if (runtimeInitialized) {
    ___trap();
  }
  /** @suppress {checkTypes} */ var e = new WebAssembly.RuntimeError(what);
  // Throw the error whether or not MODULARIZE is set because abort is used
  // in code paths apart from instantiation where an exception is expected
  // to be thrown when abort is called.
  throw e;
}

var wasmBinaryFile;

function findWasmBinary() {
  if (Module["locateFile"]) {
    return locateFile("dotnet.native.wasm");
  }
  // Use bundler-friendly `new URL(..., import.meta.url)` pattern; works in browsers too.
  return new URL("dotnet.native.wasm", import.meta.url).href;
}

function getBinarySync(file) {
  if (readBinary) {
    return readBinary(file);
  }
  // Throwing a plain string here, even though it not normally advisable since
  // this gets turning into an `abort` in instantiateArrayBuffer.
  throw "both async and sync fetching of the wasm failed";
}

async function getWasmBinary(binaryFile) {
  // If we don't have the binary yet, load it asynchronously using readAsync.
  if (!wasmBinary) {
    // Fetch the binary using readAsync
    try {
      var response = await readAsync(binaryFile);
      return new Uint8Array(response);
    } catch {}
  }
  // Otherwise, getBinarySync should be able to get it synchronously
  return getBinarySync(binaryFile);
}

async function instantiateArrayBuffer(binaryFile, imports) {
  try {
    var binary = await getWasmBinary(binaryFile);
    var instance = await WebAssembly.instantiate(binary, imports);
    return instance;
  } catch (reason) {
    err(`failed to asynchronously prepare wasm: ${reason}`);
    abort(reason);
  }
}

async function instantiateAsync(binary, binaryFile, imports) {
  if (!binary) {
    try {
      var response = fetch(binaryFile, {
        credentials: "same-origin"
      });
      var instantiationResult = await WebAssembly.instantiateStreaming(response, imports);
      return instantiationResult;
    } catch (reason) {
      // We expect the most common failure cause to be a bad MIME type for the binary,
      // in which case falling back to ArrayBuffer instantiation should work.
      err(`wasm streaming compile failed: ${reason}`);
      err("falling back to ArrayBuffer instantiation");
    }
  }
  return instantiateArrayBuffer(binaryFile, imports);
}

function getWasmImports() {
  assignWasmImports();
  // prepare imports
  var imports = {
    "env": wasmImports,
    "wasi_snapshot_preview1": wasmImports
  };
  return imports;
}

// Create the wasm instance.
// Receives the wasm imports, returns the exports.
async function createWasm() {
  // Load the wasm module and create an instance of using native support in the JS engine.
  // handle a generated wasm instance, receiving its exports and
  // performing other necessary setup
  function receiveInstance(instance, module) {
    wasmExports = instance.exports;
    wasmExports = applySignatureConversions(wasmExports);
    registerTLSInit(wasmExports["_emscripten_tls_init"]);
    assignWasmExports(wasmExports);
    Module["wasmExports"] = wasmExports;
    // We now have the Wasm module loaded up, keep a reference to the compiled module so we can post it to the workers.
    wasmModule = module;
    return wasmExports;
  }
  // Prefer streaming instantiation if available.
  function receiveInstantiationResult(result) {
    // 'result' is a ResultObject object which has both the module and instance.
    // receiveInstance() will swap in the exports (to Module.asm) so they can be called
    return receiveInstance(result["instance"], result["module"]);
  }
  var info = getWasmImports();
  // User shell pages can write their own Module.instantiateWasm = function(imports, successCallback) callback
  // to manually instantiate the Wasm module themselves. This allows pages to
  // run the instantiation parallel to any other async startup actions they are
  // performing.
  // Also pthreads and wasm workers initialize the wasm instance through this
  // path.
  var instantiateWasm = Module["instantiateWasm"];
  if (instantiateWasm) {
    return new Promise(resolve => {
      instantiateWasm(info, (inst, mod) => resolve(receiveInstance(inst, mod)));
    });
  }
  if ((ENVIRONMENT_IS_PTHREAD)) {
    // Instantiate from the module that was received via postMessage from
    // the main thread. We can just use sync instantiation in the worker.
    var instance = new WebAssembly.Instance(wasmModule, getWasmImports());
    return receiveInstance(instance, wasmModule);
  }
  wasmBinaryFile ??= findWasmBinary();
  var result = await instantiateAsync(wasmBinary, wasmBinaryFile, info);
  var exports = receiveInstantiationResult(result);
  return exports;
}

// end include: preamble.js
// Begin JS library code
class ExitStatus {
  name="ExitStatus";
  constructor(status) {
    this.message = `Program terminated with exit(${status})`;
    this.status = status;
  }
}

/** @type {!Int16Array} */ var HEAP16;

/** @type {!Int32Array} */ var HEAP32;

/** not-@type {!BigInt64Array} */ var HEAP64;

/** @type {!Int8Array} */ var HEAP8;

/** @type {!Float32Array} */ var HEAPF32;

/** @type {!Float64Array} */ var HEAPF64;

/** @type {!Uint16Array} */ var HEAPU16;

/** @type {!Uint32Array} */ var HEAPU32;

/** not-@type {!BigUint64Array} */ var HEAPU64;

/** @type {!Uint8Array} */ var HEAPU8;

var terminateWorker = worker => {
  worker.terminate();
  // terminate() can be asynchronous, so in theory the worker can continue
  // to run for some amount of time after termination.  However from our POV
  // the worker is now dead and we don't want to hear from it again, so we stub
  // out its message handler here.  This avoids having to check in each of
  // the onmessage handlers if the message was coming from a valid worker.
  worker.onmessage = e => {};
};

var cleanupThread = pthread_ptr => {
  var worker = PThread.pthreads[pthread_ptr];
  PThread.returnWorkerToPool(worker);
};

var callRuntimeCallbacks = callbacks => {
  while (callbacks.length > 0) {
    // Pass the module as the first argument.
    callbacks.shift()(Module);
  }
};

var onPreRuns = [];

var addOnPreRun = cb => onPreRuns.push(cb);

var spawnThread = threadParams => {
  var worker = PThread.getNewWorker();
  if (!worker) {
    // No available workers in the PThread pool.
    return 6;
  }
  // Add to pthreads map
  PThread.pthreads[threadParams.pthread_ptr] = worker;
  worker.pthread_ptr = threadParams.pthread_ptr;
  var msg = {
    cmd: 2,
    start_routine: threadParams.startRoutine,
    arg: threadParams.arg,
    pthread_ptr: threadParams.pthread_ptr
  };
  // Note that we do not need to quote these names because they are only used
  // in this file, and not from the external worker.js.
  msg.moduleCanvasId = threadParams.moduleCanvasId;
  msg.offscreenCanvases = threadParams.offscreenCanvases;
  // Ask the worker to start executing its pthread entry point function.
  worker.postMessage(msg, threadParams.transferList);
  return 0;
};

var runtimeKeepaliveCounter = 0;

var keepRuntimeAlive = () => noExitRuntime || runtimeKeepaliveCounter > 0;

var stackSave = () => _emscripten_stack_get_current();

var stackRestore = val => __emscripten_stack_restore(val);

var stackAlloc = sz => __emscripten_stack_alloc(sz);

/** @type{function(number, (number|boolean), ...number)} */ var proxyToMainThread = (funcIndex, emAsmAddr, proxyMode, ...callArgs) => {
  // EM_ASM proxying is done by passing a pointer to the address of the EM_ASM
  // content as `emAsmAddr`.  JS library proxying is done by passing an index
  // into `proxiedJSCallArgs` as `funcIndex`. If `emAsmAddr` is non-zero then
  // `funcIndex` will be ignored.
  // Additional arguments are passed after the first three are the actual
  // function arguments.
  // The serialization buffer contains the number of call params, and then
  // all the args here.
  // We also pass 'proxyMode' to C separately, since C needs to look at it.
  // Allocate a buffer (on the stack), which will be copied if necessary by
  // the C code.
  // First passed parameter specifies the number of arguments to the function.
  // When BigInt support is enabled, we must handle types in a more complex
  // way, detecting at runtime if a value is a BigInt or not (as we have no
  // type info here). To do that, add a "prefix" before each value that
  // indicates if it is a BigInt, which effectively doubles the number of
  // values we serialize for proxying. TODO: pack this?
  var bufSize = 8 * callArgs.length * 2;
  var sp = stackSave();
  var args = stackAlloc(bufSize);
  var b = ((args) >>> 3);
  for (var arg of callArgs) {
    if (typeof arg == "bigint") {
      // The prefix is non-zero to indicate a bigint.
      (growMemViews(), HEAP64)[b++ >>> 0] = 1n;
      (growMemViews(), HEAP64)[b++ >>> 0] = arg;
    } else {
      // The prefix is zero to indicate a JS Number.
      (growMemViews(), HEAP64)[b++ >>> 0] = 0n;
      (growMemViews(), HEAPF64)[b++ >>> 0] = arg;
    }
  }
  var rtn = __emscripten_run_js_on_main_thread(funcIndex, emAsmAddr, bufSize, args, proxyMode);
  stackRestore(sp);
  return rtn;
};

function _proc_exit(code) {
  if (ENVIRONMENT_IS_PTHREAD) return proxyToMainThread(0, 0, 1, code);
  EXITSTATUS = code;
  if (!keepRuntimeAlive()) {
    PThread.terminateAllThreads();
    Module["onExit"]?.(code);
    ABORT = true;
  }
  quit_(code, new ExitStatus(code));
}

function exitOnMainThread(returnCode) {
  if (ENVIRONMENT_IS_PTHREAD) return proxyToMainThread(1, 0, 0, returnCode);
  _exit(returnCode);
}

/** @param {boolean|number=} implicit */ var exitJS = (status, implicit) => {
  EXITSTATUS = status;
  if (ENVIRONMENT_IS_PTHREAD) {
    // implicit exit can never happen on a pthread
    // When running in a pthread we propagate the exit back to the main thread
    // where it can decide if the whole process should be shut down or not.
    // The pthread may have decided not to exit its own runtime, for example
    // because it runs a main loop, but that doesn't affect the main thread.
    exitOnMainThread(status);
    throw "unwind";
  }
  if (!keepRuntimeAlive()) {
    exitRuntime();
  }
  _proc_exit(status);
};

var _exit = exitJS;

var waitAsyncPolyfilled = false;

var PThread = {
  unusedWorkers: [],
  tlsInitFunctions: [],
  pthreads: {},
  init() {
    if ((!(ENVIRONMENT_IS_PTHREAD))) {
      PThread.initMainThread();
    }
  },
  initMainThread() {},
  terminateAllThreads: () => {
    // Attempt to kill all workers.  Sadly (at least on the web) there is no
    // way to terminate a worker synchronously, or to be notified when a
    // worker is actually terminated.  This means there is some risk that
    // pthreads will continue to be executing after `worker.terminate` has
    // returned.  For this reason, we don't call `returnWorkerToPool` here or
    // free the underlying pthread data structures.
    for (var worker of Object.values(PThread.pthreads)) {
      terminateWorker(worker);
    }
    for (var worker of PThread.unusedWorkers) {
      terminateWorker(worker);
    }
    PThread.unusedWorkers = [];
    PThread.pthreads = {};
  },
  terminateRuntime: () => {
    PThread.terminateAllThreads();
    var pthread_ptr = _pthread_self();
    ___set_thread_state(0, 0, 0, 1);
    if (!waitAsyncPolyfilled) {
      // Break the waitAsync loop.  Note that checkMailbox will not
      // re-register since the `___set_thread_state` above causes _pthread_self
      // to return 0.
      Atomics.notify((growMemViews(), HEAP32), ((pthread_ptr) >>> 2));
    }
  },
  returnWorkerToPool: worker => {
    // We don't want to run main thread queued calls here, since we are doing
    // some operations that leave the worker queue in an invalid state until
    // we are completely done (it would be bad if free() ends up calling a
    // queued pthread_create which looks at the global data structures we are
    // modifying). To achieve that, defer the free() until the very end, when
    // we are all done.
    var pthread_ptr = worker.pthread_ptr;
    delete PThread.pthreads[pthread_ptr];
    // Note: worker is intentionally not terminated so the pool can
    // dynamically grow.
    PThread.unusedWorkers.push(worker);
    // Not a running Worker anymore
    // Detach the worker from the pthread object, and return it to the
    // worker pool as an unused worker.
    worker.pthread_ptr = 0;
    // Finally, free the underlying (and now-unused) pthread structure in
    // linear memory.
    __emscripten_thread_free_data(pthread_ptr);
  },
  receiveOffscreenCanvases(data) {
    if (typeof GL != "undefined") {
      Object.assign(GL.offscreenCanvases, data.offscreenCanvases);
      if (!Module["canvas"] && data.moduleCanvasId && GL.offscreenCanvases[data.moduleCanvasId]) {
        Module["canvas"] = GL.offscreenCanvases[data.moduleCanvasId].offscreenCanvas;
        Module["canvas"].id = data.moduleCanvasId;
      }
    }
  },
  threadInitTLS() {
    // Call thread init functions (these are the _emscripten_tls_init for each
    // module loaded.
    PThread.tlsInitFunctions.forEach(f => f());
  },
  loadWasmModuleToWorker: worker => new Promise(onFinishedLoading => {
    worker.onmessage = e => {
      var d = e.data;
      var cmd = d.cmd;
      // If this message is intended to a recipient that is not the main
      // thread, forward it to the target thread. This is currently only
      // used by `CMD_CHECK_MAILBOX`.
      if (d.targetThread) {
        var targetWorker = PThread.pthreads[d.targetThread];
        targetWorker?.postMessage(d);
        return;
      }
      if (d === "setimmediate" || d === "_si") {
        // Worker wants to postMessage() to itself to implement setImmediate()
        // emulation.
        worker.postMessage(d);
        return;
      }
      switch (cmd) {
       case 4:
        checkMailbox();
        break;

       case 5:
        spawnThread(d);
        break;

       case 6:
        // cleanupThread needs to be run via callUserCallback since it calls
        // back into user code to free thread data. Without this it's possible
        // the unwind or ExitStatus exception could escape here.
        callUserCallback(() => cleanupThread(d.thread));
        break;

       case 3:
        onFinishedLoading(worker);
        break;

       case 9:
        Module[d.handler](...d.args);
        break;

       default:
        // The received message looks like something that should be handled by this message
        // handler, (since there is a e.data.cmd field present), but is not one of the
        // recognized commands:
        if (cmd) err(`worker sent an unknown command ${cmd}`);
      }
    };
    worker.onerror = e => {
      var message = "worker sent an error!";
      err(`${message} ${e.filename}:${e.lineno}: ${e.message}`);
      throw e;
    };
    // When running on a pthread, none of the incoming parameters on the module
    // object are present. Proxy known handlers back to the main thread if specified.
    var handlers = [];
    var knownHandlers = [ "onExit", "onAbort", "print", "printErr" ];
    for (var handler of knownHandlers) {
      if (Module.propertyIsEnumerable(handler)) {
        handlers.push(handler);
      }
    }
    // Ask the new worker to load up the Emscripten-compiled page. This is a heavy operation.
    worker.postMessage({
      cmd: 1,
      handlers,
      wasmMemory,
      wasmModule
    });
  }),
  allocateUnusedWorker() {
    var worker;
    // If we're using module output, use bundler-friendly pattern.
    // We need to generate the URL with import.meta.url as the base URL of the JS file
    // instead of just using new URL(import.meta.url) because bundlers only recognize
    // the first case in their bundling step. The latter ends up producing an invalid
    // URL to import from the server (e.g., for webpack the file:// path).
    // See https://github.com/webpack/webpack/issues/12638
    worker = new Worker(new URL("dotnet.native.js", import.meta.url), {
      "type": "module",
      // This is the way that we signal to the Web Worker that it is hosting
      // a pthread.
      "name": "em-pthread"
    });
    PThread.unusedWorkers.push(worker);
    return worker;
  },
  getNewWorker() {
    if (PThread.unusedWorkers.length == 0) {
      // PTHREAD_POOL_SIZE_STRICT should show a warning and, if set to level `2`, return from the function.
      var newWorker = PThread.allocateUnusedWorker();
      PThread.loadWasmModuleToWorker(newWorker);
    }
    return PThread.unusedWorkers.pop();
  }
};

var onPostRuns = [];

var addOnPostRun = cb => onPostRuns.push(cb);

function establishStackSpace(pthread_ptr) {
  var stackHigh = (growMemViews(), HEAPU32)[(((pthread_ptr) + (48)) >>> 2) >>> 0];
  var stackSize = (growMemViews(), HEAPU32)[(((pthread_ptr) + (52)) >>> 2) >>> 0];
  var stackLow = stackHigh - stackSize;
  // Set stack limits used by `emscripten/stack.h` function.  These limits are
  // cached in wasm-side globals to make checks as fast as possible.
  _emscripten_stack_set_limits(stackHigh, stackLow);
  // Call inside wasm module to set up the stack frame for this pthread in wasm module scope
  stackRestore(stackHigh);
}

/**
   * @param {number} ptr
   * @param {string} type
   */ function getValue(ptr, type = "i8") {
  if (type.endsWith("*")) type = "*";
  switch (type) {
   case "i1":
    return (growMemViews(), HEAP8)[ptr >>> 0];

   case "i8":
    return (growMemViews(), HEAP8)[ptr >>> 0];

   case "i16":
    return (growMemViews(), HEAP16)[((ptr) >>> 1) >>> 0];

   case "i32":
    return (growMemViews(), HEAP32)[((ptr) >>> 2) >>> 0];

   case "i64":
    return (growMemViews(), HEAP64)[((ptr) >>> 3) >>> 0];

   case "float":
    return (growMemViews(), HEAPF32)[((ptr) >>> 2) >>> 0];

   case "double":
    return (growMemViews(), HEAPF64)[((ptr) >>> 3) >>> 0];

   case "*":
    return (growMemViews(), HEAPU32)[((ptr) >>> 2) >>> 0];

   default:
    abort(`invalid type for getValue: ${type}`);
  }
}

var wasmTableMirror = [];

var getWasmTableEntry = funcPtr => {
  var func = wasmTableMirror[funcPtr];
  if (!func) {
    /** @suppress {checkTypes} */ wasmTableMirror[funcPtr] = func = wasmTable.get(funcPtr);
  }
  return func;
};

var invokeEntryPoint = (ptr, arg) => {
  // An old thread on this worker may have been canceled without returning the
  // `runtimeKeepaliveCounter` to zero. Reset it now so the new thread won't
  // be affected.
  runtimeKeepaliveCounter = 0;
  // Same for noExitRuntime.  The default for pthreads should always be false
  // otherwise pthreads would never complete and attempts to pthread_join to
  // them would block forever.
  // pthreads can still choose to set `noExitRuntime` explicitly, or
  // call emscripten_unwind_to_js_event_loop to extend their lifetime beyond
  // their main function.  See comment in src/runtime_pthread.js for more.
  noExitRuntime = 0;
  // pthread entry points are always of signature 'void *ThreadMain(void *arg)'
  // Native codebases sometimes spawn threads with other thread entry point
  // signatures, such as void ThreadMain(void *arg), void *ThreadMain(), or
  // void ThreadMain().  That is not acceptable per C/C++ specification, but
  // x86 compiler ABI extensions enable that to work. If you find the
  // following line to crash, either change the signature to "proper" void
  // *ThreadMain(void *arg) form, or try linking with the Emscripten linker
  // flag -sEMULATE_FUNCTION_POINTER_CASTS to add in emulation for this x86
  // ABI extension.
  var result = getWasmTableEntry(ptr)(arg);
  function finish(result) {
    // In MINIMAL_RUNTIME the noExitRuntime concept does not apply to
    // pthreads. To exit a pthread with live runtime, use the function
    // emscripten_unwind_to_js_event_loop() in the pthread body.
    if (keepRuntimeAlive()) {
      EXITSTATUS = result;
      return;
    }
    __emscripten_thread_exit(result);
  }
  finish(result);
};

var noExitRuntime = false;

var registerTLSInit = tlsInitFunc => PThread.tlsInitFunctions.push(tlsInitFunc);

/**
   * @param {number} ptr
   * @param {number} value
   * @param {string} type
   */ function setValue(ptr, value, type = "i8") {
  if (type.endsWith("*")) type = "*";
  switch (type) {
   case "i1":
    (growMemViews(), HEAP8)[ptr >>> 0] = value;
    break;

   case "i8":
    (growMemViews(), HEAP8)[ptr >>> 0] = value;
    break;

   case "i16":
    (growMemViews(), HEAP16)[((ptr) >>> 1) >>> 0] = value;
    break;

   case "i32":
    (growMemViews(), HEAP32)[((ptr) >>> 2) >>> 0] = value;
    break;

   case "i64":
    (growMemViews(), HEAP64)[((ptr) >>> 3) >>> 0] = BigInt(value);
    break;

   case "float":
    (growMemViews(), HEAPF32)[((ptr) >>> 2) >>> 0] = value;
    break;

   case "double":
    (growMemViews(), HEAPF64)[((ptr) >>> 3) >>> 0] = value;
    break;

   case "*":
    (growMemViews(), HEAPU32)[((ptr) >>> 2) >>> 0] = value;
    break;

   default:
    abort(`invalid type for setValue: ${type}`);
  }
}

var wasmMemory;

var DOTNET = {
  setup: function setup(emscriptenBuildOptions) {
    // PTHREADS is emscripten's define symbol, which is passed to acorn optimizer, so we could use it here
    const modulePThread = PThread;
    const dotnet_replacements = {
      fetch: globalThis.fetch,
      ENVIRONMENT_IS_WORKER,
      modulePThread,
      scriptDirectory
    };
    ENVIRONMENT_IS_WORKER = dotnet_replacements.ENVIRONMENT_IS_WORKER;
    Module.__dotnet_runtime.initializeReplacements(dotnet_replacements);
    noExitRuntime = dotnet_replacements.noExitRuntime;
    fetch = dotnet_replacements.fetch;
    scriptDirectory = dotnet_replacements.scriptDirectory;
    Module.__dotnet_runtime.passEmscriptenInternals({
      isPThread: ENVIRONMENT_IS_PTHREAD,
      quit_,
      ExitStatus,
      updateMemoryViews,
      getMemory: () => wasmMemory,
      getWasmIndirectFunctionTable: () => wasmTable
    }, emscriptenBuildOptions);
    if (ENVIRONMENT_IS_PTHREAD) {
      Module.config = {};
      Module.__dotnet_runtime.configureWorkerStartup(Module);
    } else {
      Module.__dotnet_runtime.configureEmscriptenStartup(Module);
    }
  }
};

function _SystemInteropJS_CancelPromise() {
  return {
    runtime_idx: 28
  };
}

function _SystemInteropJS_InstallWebWorkerInteropImpl() {
  return {
    runtime_idx: 43
  };
}

function _SystemInteropJS_InvokeJSFunction() {
  return {
    runtime_idx: 25
  };
}

function _SystemInteropJS_InvokeJSImportSync() {
  return {
    runtime_idx: 45
  };
}

function _SystemInteropJS_ReleaseCSOwnedObject() {
  return {
    runtime_idx: 23
  };
}

function _SystemInteropJS_ResolveOrRejectPromise() {
  return {
    runtime_idx: 27
  };
}

function _SystemInteropJS_UninstallWebWorkerInterop() {
  return {
    runtime_idx: 44
  };
}

function _SystemJS_ConsoleClear() {
  return {
    runtime_idx: 22
  };
}

function _SystemJS_GetCurrentProcessId() {
  return {
    runtime_idx: 21
  };
}

function _SystemJS_GetLocaleInfo() {
  return {
    runtime_idx: 29
  };
}

function _SystemJS_RandomBytes() {
  return {
    runtime_idx: 20
  };
}

function _SystemJS_WarnAboutBlockingWait() {
  return {
    runtime_idx: 46
  };
}

var INT53_MAX = 9007199254740992;

var INT53_MIN = -9007199254740992;

var bigintToI53Checked = num => (num < INT53_MIN || num > INT53_MAX) ? NaN : Number(num);

var UTF8Decoder = globalThis.TextDecoder && new TextDecoder;

/**
   * heapOrArray is either a regular array, or a JavaScript typed array view.
   * @param {number} idx
   * @param {number=} maxBytesToRead
   * @param {boolean=} ignoreNul
   * @return {number}
   */ var findStringEnd = (heapOrArray, idx, maxBytesToRead, ignoreNul) => {
  var maxIdx = idx + maxBytesToRead;
  if (ignoreNul) return maxIdx;
  // TextDecoder needs to know the byte length in advance, it doesn't stop on
  // null terminator by itself.
  // As a tiny code save trick, compare idx against maxIdx using a negation,
  // so that maxBytesToRead=undefined/NaN means Infinity.
  while (heapOrArray[idx] && !(idx >= maxIdx)) ++idx;
  return idx;
};

/**
   * Given a pointer 'idx' to a null-terminated UTF8-encoded string in the given
   * array that contains uint8 values, returns a copy of that string as a
   * Javascript String object.
   * heapOrArray is either a regular array, or a JavaScript typed array view.
   * @param {number=} idx
   * @param {number=} maxBytesToRead
   * @param {boolean=} ignoreNul - If true, the function will not stop on a NUL character.
   * @return {string}
   */ var UTF8ArrayToString = (heapOrArray, idx = 0, maxBytesToRead, ignoreNul) => {
  idx >>>= 0;
  var endPtr = findStringEnd(heapOrArray, idx, maxBytesToRead, ignoreNul);
  // When using conditional TextDecoder, skip it for short strings as the overhead of the native call is not worth it.
  if (endPtr - idx > 16 && heapOrArray.buffer && UTF8Decoder) {
    return UTF8Decoder.decode(heapOrArray.buffer instanceof ArrayBuffer ? heapOrArray.subarray(idx, endPtr) : heapOrArray.slice(idx, endPtr));
  }
  var str = "";
  while (idx < endPtr) {
    // For UTF8 byte structure, see:
    // http://en.wikipedia.org/wiki/UTF-8#Description
    // https://www.ietf.org/rfc/rfc2279.txt
    // https://tools.ietf.org/html/rfc3629
    var u0 = heapOrArray[idx++];
    if (!(u0 & 128)) {
      str += String.fromCharCode(u0);
      continue;
    }
    var u1 = heapOrArray[idx++] & 63;
    if ((u0 & 224) == 192) {
      str += String.fromCharCode(((u0 & 31) << 6) | u1);
      continue;
    }
    var u2 = heapOrArray[idx++] & 63;
    if ((u0 & 240) == 224) {
      u0 = ((u0 & 15) << 12) | (u1 << 6) | u2;
    } else {
      u0 = ((u0 & 7) << 18) | (u1 << 12) | (u2 << 6) | (heapOrArray[idx++] & 63);
    }
    if (u0 < 65536) {
      str += String.fromCharCode(u0);
    } else {
      var ch = u0 - 65536;
      str += String.fromCharCode(55296 | (ch >> 10), 56320 | (ch & 1023));
    }
  }
  return str;
};

/**
   * Given a pointer 'ptr' to a null-terminated UTF8-encoded string in the
   * emscripten HEAP, returns a copy of that string as a Javascript String object.
   *
   * @param {number} ptr
   * @param {number=} maxBytesToRead - An optional length that specifies the
   *   maximum number of bytes to read. You can omit this parameter to scan the
   *   string until the first 0 byte. If maxBytesToRead is passed, and the string
   *   at [ptr, ptr+maxBytesToReadr[ contains a null byte in the middle, then the
   *   string will cut short at that byte index.
   * @param {boolean=} ignoreNul - If true, the function will not stop on a NUL character.
   * @return {string}
   */ var UTF8ToString = (ptr, maxBytesToRead, ignoreNul) => {
  ptr >>>= 0;
  return ptr ? UTF8ArrayToString((growMemViews(), HEAPU8), ptr, maxBytesToRead, ignoreNul) : "";
};

function ___assert_fail(condition, filename, line, func) {
  condition >>>= 0;
  filename >>>= 0;
  func >>>= 0;
  return abort(`Assertion failed: ${UTF8ToString(condition)}, at: ` + [ filename ? UTF8ToString(filename) : "unknown filename", line, func ? UTF8ToString(func) : "unknown function" ]);
}

function ___call_sighandler(fp, sig) {
  fp >>>= 0;
  return getWasmTableEntry(fp)(sig);
}

function pthreadCreateProxied(pthread_ptr, attr, startRoutine, arg) {
  if (ENVIRONMENT_IS_PTHREAD) return proxyToMainThread(2, 0, 1, pthread_ptr, attr, startRoutine, arg);
  return ___pthread_create_js(pthread_ptr, attr, startRoutine, arg);
}

var _emscripten_has_threading_support = () => !!globalThis.SharedArrayBuffer;

function ___pthread_create_js(pthread_ptr, attr, startRoutine, arg) {
  pthread_ptr >>>= 0;
  attr >>>= 0;
  startRoutine >>>= 0;
  arg >>>= 0;
  if (!_emscripten_has_threading_support()) {
    return 6;
  }
  // List of JS objects that will transfer ownership to the Worker hosting the thread
  var transferList = [];
  var error = 0;
  // Deduce which WebGL canvases (HTMLCanvasElements or OffscreenCanvases) should be passed over to the
  // Worker that hosts the spawned pthread.
  // Comma-delimited list of CSS selectors that must identify canvases by IDs: "#canvas1, #canvas2, ..."
  var transferredCanvasNames = attr ? (growMemViews(), HEAPU32)[(((attr) + (40)) >>> 2) >>> 0] : 0;
  // Proxied canvases string pointer -1/MAX_PTR is used as a special token to
  // fetch whatever canvases were passed to build in
  // -sOFFSCREENCANVASES_TO_PTHREAD= command line.
  if (transferredCanvasNames == 4294967295) {
    transferredCanvasNames = "#canvas";
  } else {
    transferredCanvasNames = UTF8ToString(transferredCanvasNames).trim();
  }
  transferredCanvasNames = transferredCanvasNames ? transferredCanvasNames.split(",") : [];
  var offscreenCanvases = {};
  // Dictionary of OffscreenCanvas objects we'll transfer to the created thread to own
  var moduleCanvasId = Module["canvas"]?.id ?? "";
  // Note that transferredCanvasNames might be null (so we cannot do a for-of loop).
  for (var name of transferredCanvasNames) {
    name = name.trim();
    var offscreenCanvasInfo;
    try {
      if (name == "#canvas") {
        if (!Module["canvas"]) {
          err(`pthread_create: could not find canvas with ID "${name}" to transfer to thread!`);
          error = 28;
          break;
        }
        name = Module["canvas"].id;
      }
      if (GL.offscreenCanvases[name]) {
        offscreenCanvasInfo = GL.offscreenCanvases[name];
        GL.offscreenCanvases[name] = null;
        // This thread no longer owns this canvas.
        if (Module["canvas"] instanceof OffscreenCanvas && name === Module["canvas"].id) Module["canvas"] = null;
      } else if (!ENVIRONMENT_IS_PTHREAD) {
        var canvas = (Module["canvas"] && Module["canvas"].id === name) ? Module["canvas"] : document.querySelector(name);
        if (!canvas) {
          err(`pthread_create: could not find canvas with ID "${name}" to transfer to thread!`);
          error = 28;
          break;
        }
        if (canvas.controlTransferredOffscreen) {
          err(`pthread_create: cannot transfer canvas with ID "${name}" to thread, since the current thread does not have control over it!`);
          error = 63;
          // Operation not permitted, some other thread is accessing the canvas.
          break;
        }
        if (canvas.transferControlToOffscreen) {
          // Create a shared information block in heap so that we can control
          // the canvas size from any thread.
          if (!canvas.canvasSharedPtr) {
            canvas.canvasSharedPtr = _malloc(12);
            (growMemViews(), HEAP32)[((canvas.canvasSharedPtr) >>> 2) >>> 0] = canvas.width;
            (growMemViews(), HEAP32)[(((canvas.canvasSharedPtr) + (4)) >>> 2) >>> 0] = canvas.height;
            (growMemViews(), HEAPU32)[(((canvas.canvasSharedPtr) + (8)) >>> 2) >>> 0] = 0;
          }
          offscreenCanvasInfo = {
            offscreenCanvas: canvas.transferControlToOffscreen(),
            canvasSharedPtr: canvas.canvasSharedPtr,
            id: canvas.id
          };
          // After calling canvas.transferControlToOffscreen(), it is no
          // longer possible to access certain operations on the canvas, such
          // as resizing it or obtaining GL contexts via it.
          // Use this field to remember that we have permanently converted
          // this Canvas to be controlled via an OffscreenCanvas (there is no
          // way to undo this in the spec)
          canvas.controlTransferredOffscreen = true;
        } else {
          err(`pthread_create: cannot transfer control of canvas "${name}" to pthread, because current browser does not support OffscreenCanvas!`);
          // If building with OFFSCREEN_FRAMEBUFFER=1 mode, we don't need to
          // be able to transfer control to offscreen, but WebGL can be
          // proxied from worker to main thread.
          err("pthread_create: Build with -sOFFSCREEN_FRAMEBUFFER to enable fallback proxying of GL commands from pthread to main thread.");
          return 52;
        }
      }
      if (offscreenCanvasInfo) {
        transferList.push(offscreenCanvasInfo.offscreenCanvas);
        offscreenCanvases[offscreenCanvasInfo.id] = offscreenCanvasInfo;
      }
    } catch (e) {
      err(`pthread_create: failed to transfer control of canvas "${name}" to OffscreenCanvas! Error: ${e}`);
      return 28;
    }
  }
  // Synchronously proxy the thread creation to main thread if possible. If we
  // need to transfer ownership of objects, then proxy asynchronously via
  // postMessage.
  if (ENVIRONMENT_IS_PTHREAD && (transferList.length === 0 || error)) {
    return pthreadCreateProxied(pthread_ptr, attr, startRoutine, arg);
  }
  // If on the main thread, and accessing Canvas/OffscreenCanvas failed, abort
  // with the detected error.
  if (error) return error;
  // Register for each of the transferred canvases that the new thread now
  // owns the OffscreenCanvas.
  for (var canvas of Object.values(offscreenCanvases)) {
    // pthread ptr to the thread that owns this canvas.
    (growMemViews(), HEAPU32)[(((canvas.canvasSharedPtr) + (8)) >>> 2) >>> 0] = pthread_ptr;
  }
  var threadParams = {
    startRoutine,
    pthread_ptr,
    arg,
    moduleCanvasId,
    offscreenCanvases,
    transferList
  };
  if (ENVIRONMENT_IS_PTHREAD) {
    // The prepopulated pool of web workers that can host pthreads is stored
    // in the main JS thread. Therefore if a pthread is attempting to spawn a
    // new thread, the thread creation must be deferred to the main JS thread.
    threadParams.cmd = 5;
    postMessage(threadParams, transferList);
    // When we defer thread creation this way, we have no way to detect thread
    // creation synchronously today, so we have to assume success and return 0.
    return 0;
  }
  // We are the main thread, so we have the pthread warmup pool in this
  // thread and can fire off JS thread creation directly ourselves.
  return spawnThread(threadParams);
}

var __abort_js = () => abort("");

var getExecutableName = () => thisProgram;

var stringToUTF8Array = (str, heap, outIdx, maxBytesToWrite) => {
  outIdx >>>= 0;
  // Parameter maxBytesToWrite is not optional. Negative values, 0, null,
  // undefined and false each don't write out any bytes.
  if (!(maxBytesToWrite > 0)) return 0;
  var startIdx = outIdx;
  var endIdx = outIdx + maxBytesToWrite - 1;
  // -1 for string null terminator.
  for (var i = 0; i < str.length; ++i) {
    // For UTF8 byte structure, see http://en.wikipedia.org/wiki/UTF-8#Description
    // and https://www.ietf.org/rfc/rfc2279.txt
    // and https://tools.ietf.org/html/rfc3629
    var u = str.codePointAt(i);
    if (u <= 127) {
      if (outIdx >= endIdx) break;
      heap[outIdx++ >>> 0] = u;
    } else if (u <= 2047) {
      if (outIdx + 1 >= endIdx) break;
      heap[outIdx++ >>> 0] = 192 | (u >> 6);
      heap[outIdx++ >>> 0] = 128 | (u & 63);
    } else if (u <= 65535) {
      if (outIdx + 2 >= endIdx) break;
      heap[outIdx++ >>> 0] = 224 | (u >> 12);
      heap[outIdx++ >>> 0] = 128 | ((u >> 6) & 63);
      heap[outIdx++ >>> 0] = 128 | (u & 63);
    } else {
      if (outIdx + 3 >= endIdx) break;
      heap[outIdx++ >>> 0] = 240 | (u >> 18);
      heap[outIdx++ >>> 0] = 128 | ((u >> 12) & 63);
      heap[outIdx++ >>> 0] = 128 | ((u >> 6) & 63);
      heap[outIdx++ >>> 0] = 128 | (u & 63);
      // Gotcha: if codePoint is over 0xFFFF, it is represented as a surrogate pair in UTF-16.
      // We need to manually skip over the second code unit for correct iteration.
      i++;
    }
  }
  // Null-terminate the pointer to the buffer.
  heap[outIdx >>> 0] = 0;
  return outIdx - startIdx;
};

var stringToUTF8 = (str, outPtr, maxBytesToWrite) => stringToUTF8Array(str, (growMemViews(), 
HEAPU8), outPtr, maxBytesToWrite);

function __emscripten_get_progname(str, len) {
  str >>>= 0;
  return stringToUTF8(getExecutableName(), str, len);
}

function __emscripten_init_main_thread_js(tb) {
  tb >>>= 0;
  var can_block = !ENVIRONMENT_IS_WEB;
  // Feature detect whether the main thread can block.
  try {
    Atomics.wait((growMemViews(), HEAP32), 0, 0, 0);
    can_block = true;
  } catch (e) {}
  // Pass the thread address to the native code where they are stored in wasm
  // globals which act as a form of TLS. Global constructors trying
  // to access this value will read the wrong value, but that is UB anyway.
  __emscripten_thread_init(tb, /*is_main=*/ !ENVIRONMENT_IS_WORKER, /*is_runtime=*/ 1, can_block, /*default_stacksize=*/ 1048576, /*start_profiling=*/ false);
  PThread.threadInitTLS();
}

var handleException = e => {
  // Certain exception types we do not treat as errors since they are used for
  // internal control flow.
  // 1. ExitStatus, which is thrown by exit()
  // 2. "unwind", which is thrown by emscripten_unwind_to_js_event_loop() and others
  //    that wish to return to JS event loop.
  if (e instanceof ExitStatus || e == "unwind") {
    return EXITSTATUS;
  }
  quit_(1, e);
};

var maybeExit = () => {
  if (runtimeExited) {
    return;
  }
  if (!keepRuntimeAlive()) {
    try {
      if (ENVIRONMENT_IS_PTHREAD) {
        // exit the current thread, but only if there is one active.
        // TODO(https://github.com/emscripten-core/emscripten/issues/25076):
        // Unify this check with the runtimeExited check above
        if (_pthread_self()) __emscripten_thread_exit(EXITSTATUS);
        return;
      }
      _exit(EXITSTATUS);
    } catch (e) {
      handleException(e);
    }
  }
};

var callUserCallback = func => {
  if (runtimeExited || ABORT) {
    return;
  }
  try {
    return func();
  } catch (e) {
    handleException(e);
  } finally {
    maybeExit();
  }
};

function __emscripten_thread_mailbox_await(pthread_ptr) {
  pthread_ptr >>>= 0;
  if (!waitAsyncPolyfilled) {
    // Wait on the pthread's initial self-pointer field because it is easy and
    // safe to access from sending threads that need to notify the waiting
    // thread.
    // Note: Under wasm64 only the low 32-bit of the pthread_ptr are
    // read/compared here, but we don't actually care about the exact values
    // here as long as they match.
    var wait = Atomics.waitAsync((growMemViews(), HEAP32), ((pthread_ptr) >>> 2), pthread_ptr);
    wait.value.then(checkMailbox);
    var waitingAsync = pthread_ptr + 112;
    Atomics.store((growMemViews(), HEAP32), ((waitingAsync) >>> 2), 1);
  }
}

var checkMailbox = () => {
  // checkMailbox can be called after the pthread has shut down. See
  // Pthread.terminateRuntime().
  // In this case we return silently without re-registering using waitAsync.
  // Perhaps there is a more universal way we can detect runtime has exited.
  // TODO(https://github.com/emscripten-core/emscripten/issues/25076)
  var pthread_ptr = _pthread_self();
  if (!pthread_ptr) return;
  callUserCallback(() => {
    // If we are using Atomics.waitAsync as our notification mechanism, wait
    // for a notification before processing the mailbox to avoid missing any
    // work that could otherwise arrive after we've finished processing the
    // mailbox and before we're ready for the next notification.
    __emscripten_thread_mailbox_await(pthread_ptr);
    __emscripten_check_mailbox();
  });
};

function __emscripten_notify_mailbox_postmessage(targetThread, currThreadId) {
  targetThread >>>= 0;
  currThreadId >>>= 0;
  if (targetThread == currThreadId) {
    setTimeout(checkMailbox);
  } else if (ENVIRONMENT_IS_PTHREAD) {
    postMessage({
      targetThread,
      cmd: 4
    });
  } else {
    var worker = PThread.pthreads[targetThread];
    if (!worker) {
      return;
    }
    worker.postMessage({
      cmd: 4
    });
  }
}

var proxiedJSCallArgs = [];

function __emscripten_receive_on_main_thread_js(funcIndex, emAsmAddr, callingThread, bufSize, args, ctx, ctxArgs) {
  emAsmAddr >>>= 0;
  callingThread >>>= 0;
  args >>>= 0;
  ctx >>>= 0;
  ctxArgs >>>= 0;
  // Sometimes we need to backproxy events to the calling thread (e.g.
  // HTML5 DOM events handlers such as
  // emscripten_set_mousemove_callback()), so keep track in a globally
  // accessible variable about the thread that initiated the proxying.
  proxiedJSCallArgs.length = 0;
  var b = ((args) >>> 3);
  var end = ((args + bufSize) >>> 3);
  while (b < end) {
    var arg;
    if ((growMemViews(), HEAP64)[b++ >>> 0]) {
      // It's a BigInt.
      arg = (growMemViews(), HEAP64)[b++ >>> 0];
    } else {
      // It's a Number.
      arg = (growMemViews(), HEAPF64)[b++ >>> 0];
    }
    proxiedJSCallArgs.push(arg);
  }
  // Proxied JS library funcs use funcIndex and EM_ASM functions use emAsmAddr
  var func = emAsmAddr ? ASM_CONSTS[emAsmAddr] : proxiedFunctionTable[funcIndex];
  PThread.currentProxiedOperationCallerThread = callingThread;
  var rtn = func(...proxiedJSCallArgs);
  PThread.currentProxiedOperationCallerThread = 0;
  if (ctx) {
    rtn.then(rtn => __emscripten_run_js_on_main_thread_done(ctx, ctxArgs, rtn));
    return;
  }
  return rtn;
}

var __emscripten_runtime_keepalive_clear = () => {
  noExitRuntime = false;
  runtimeKeepaliveCounter = 0;
};

function __emscripten_thread_cleanup(thread) {
  thread >>>= 0;
  // Called when a thread needs to be cleaned up so it can be reused.
  // A thread is considered reusable when it either returns from its
  // entry point, calls pthread_exit, or acts upon a cancellation.
  // Detached threads are responsible for calling this themselves,
  // otherwise pthread_join is responsible for calling this.
  if (!ENVIRONMENT_IS_PTHREAD) cleanupThread(thread); else postMessage({
    cmd: 6,
    thread
  });
}

function __emscripten_thread_set_strongref(thread) {
  thread >>>= 0;
}

function __gmtime_js(time, tmPtr) {
  time = bigintToI53Checked(time);
  tmPtr >>>= 0;
  var date = new Date(time * 1e3);
  if (isNaN(date.getTime())) {
    return 1;
  }
  (growMemViews(), HEAP32)[((tmPtr) >>> 2) >>> 0] = date.getUTCSeconds();
  (growMemViews(), HEAP32)[(((tmPtr) + (4)) >>> 2) >>> 0] = date.getUTCMinutes();
  (growMemViews(), HEAP32)[(((tmPtr) + (8)) >>> 2) >>> 0] = date.getUTCHours();
  (growMemViews(), HEAP32)[(((tmPtr) + (12)) >>> 2) >>> 0] = date.getUTCDate();
  (growMemViews(), HEAP32)[(((tmPtr) + (16)) >>> 2) >>> 0] = date.getUTCMonth();
  (growMemViews(), HEAP32)[(((tmPtr) + (20)) >>> 2) >>> 0] = date.getUTCFullYear() - 1900;
  (growMemViews(), HEAP32)[(((tmPtr) + (24)) >>> 2) >>> 0] = date.getUTCDay();
  var start = Date.UTC(date.getUTCFullYear(), 0, 1, 0, 0, 0, 0);
  var yday = ((date.getTime() - start) / (1e3 * 60 * 60 * 24)) | 0;
  (growMemViews(), HEAP32)[(((tmPtr) + (28)) >>> 2) >>> 0] = yday;
  return 0;
}

var isLeapYear = year => year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);

var MONTH_DAYS_LEAP_CUMULATIVE = [ 0, 31, 60, 91, 121, 152, 182, 213, 244, 274, 305, 335 ];

var MONTH_DAYS_REGULAR_CUMULATIVE = [ 0, 31, 59, 90, 120, 151, 181, 212, 243, 273, 304, 334 ];

var ydayFromDate = date => {
  var leap = isLeapYear(date.getFullYear());
  var monthDaysCumulative = (leap ? MONTH_DAYS_LEAP_CUMULATIVE : MONTH_DAYS_REGULAR_CUMULATIVE);
  var yday = monthDaysCumulative[date.getMonth()] + date.getDate() - 1;
  // -1 since it's days since Jan 1
  return yday;
};

function __localtime_js(time, tmPtr) {
  time = bigintToI53Checked(time);
  tmPtr >>>= 0;
  var date = new Date(time * 1e3);
  if (isNaN(date.getTime())) {
    return 1;
  }
  (growMemViews(), HEAP32)[((tmPtr) >>> 2) >>> 0] = date.getSeconds();
  (growMemViews(), HEAP32)[(((tmPtr) + (4)) >>> 2) >>> 0] = date.getMinutes();
  (growMemViews(), HEAP32)[(((tmPtr) + (8)) >>> 2) >>> 0] = date.getHours();
  (growMemViews(), HEAP32)[(((tmPtr) + (12)) >>> 2) >>> 0] = date.getDate();
  (growMemViews(), HEAP32)[(((tmPtr) + (16)) >>> 2) >>> 0] = date.getMonth();
  (growMemViews(), HEAP32)[(((tmPtr) + (20)) >>> 2) >>> 0] = date.getFullYear() - 1900;
  (growMemViews(), HEAP32)[(((tmPtr) + (24)) >>> 2) >>> 0] = date.getDay();
  var yday = ydayFromDate(date) | 0;
  (growMemViews(), HEAP32)[(((tmPtr) + (28)) >>> 2) >>> 0] = yday;
  (growMemViews(), HEAP32)[(((tmPtr) + (36)) >>> 2) >>> 0] = -(date.getTimezoneOffset() * 60);
  // Attention: DST is in December in South, and some regions don't have DST at all.
  var start = new Date(date.getFullYear(), 0, 1);
  var summerOffset = new Date(date.getFullYear(), 6, 1).getTimezoneOffset();
  var winterOffset = start.getTimezoneOffset();
  var dst = (summerOffset != winterOffset && date.getTimezoneOffset() == Math.min(winterOffset, summerOffset)) | 0;
  (growMemViews(), HEAP32)[(((tmPtr) + (32)) >>> 2) >>> 0] = dst;
  return 0;
}

var timers = {};

var clearTimers = () => {
  for (var t of Object.values(timers)) {
    clearTimeout(t.id);
  }
};

var _emscripten_get_now = () => performance.timeOrigin + performance.now();

function __setitimer_js(which, timeout_ms) {
  if (ENVIRONMENT_IS_PTHREAD) return proxyToMainThread(3, 0, 1, which, timeout_ms);
  // First, clear any existing timer.
  if (timers[which]) {
    clearTimeout(timers[which].id);
    delete timers[which];
  }
  // A timeout of zero simply cancels the current timeout so we have nothing
  // more to do.
  if (!timeout_ms) return 0;
  var id = setTimeout(() => {
    delete timers[which];
    callUserCallback(() => __emscripten_timeout(which, _emscripten_get_now()));
  }, timeout_ms);
  timers[which] = {
    id,
    timeout_ms
  };
  return 0;
}

var __tzset_js = function(timezone, daylight, std_name, dst_name) {
  timezone >>>= 0;
  daylight >>>= 0;
  std_name >>>= 0;
  dst_name >>>= 0;
  // TODO: Use (malleable) environment variables instead of system settings.
  var currentYear = (new Date).getFullYear();
  var winter = new Date(currentYear, 0, 1);
  var summer = new Date(currentYear, 6, 1);
  var winterOffset = winter.getTimezoneOffset();
  var summerOffset = summer.getTimezoneOffset();
  // Local standard timezone offset. Local standard time is not adjusted for
  // daylight savings.  This code uses the fact that getTimezoneOffset returns
  // a greater value during Standard Time versus Daylight Saving Time (DST).
  // Thus it determines the expected output during Standard Time, and it
  // compares whether the output of the given date the same (Standard) or less
  // (DST).
  var stdTimezoneOffset = Math.max(winterOffset, summerOffset);
  // timezone is specified as seconds west of UTC ("The external variable
  // `timezone` shall be set to the difference, in seconds, between
  // Coordinated Universal Time (UTC) and local standard time."), the same
  // as returned by stdTimezoneOffset.
  // See http://pubs.opengroup.org/onlinepubs/009695399/functions/tzset.html
  (growMemViews(), HEAPU32)[((timezone) >>> 2) >>> 0] = stdTimezoneOffset * 60;
  (growMemViews(), HEAP32)[((daylight) >>> 2) >>> 0] = Number(winterOffset != summerOffset);
  var extractZone = timezoneOffset => {
    // Why inverse sign?
    // Read here https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Date/getTimezoneOffset
    var sign = timezoneOffset >= 0 ? "-" : "+";
    var absOffset = Math.abs(timezoneOffset);
    var hours = String(Math.floor(absOffset / 60)).padStart(2, "0");
    var minutes = String(absOffset % 60).padStart(2, "0");
    return `UTC${sign}${hours}${minutes}`;
  };
  var winterName = extractZone(winterOffset);
  var summerName = extractZone(summerOffset);
  if (summerOffset < winterOffset) {
    // Northern hemisphere
    stringToUTF8(winterName, std_name, 17);
    stringToUTF8(summerName, dst_name, 17);
  } else {
    stringToUTF8(winterName, dst_name, 17);
    stringToUTF8(summerName, std_name, 17);
  }
};

function __wasmfs_copy_preloaded_file_data(index, buffer) {
  buffer >>>= 0;
  return (growMemViews(), HEAPU8).set(wasmFSPreloadedFiles[index].fileData, buffer >>> 0);
}

var wasmFS$backends = {};

var wasmFS$JSMemoryRanges = {};

var wasmFS$fetchSizes = {};

async function __wasmfs_create_fetch_backend_js(backend) {
  backend >>>= 0;
  // Get a promise that fetches the data and stores it in JS memory (if it has
  // not already been fetched).
  function getFileUrl(file) {
    var fileUrl_p = __wasmfs_fetch_get_file_url(file);
    var fileUrl = UTF8ToString(fileUrl_p);
    var isAbs = fileUrl.indexOf("://") !== -1;
    if (isAbs) {
      return fileUrl;
    }
    try {
      var u = new URL(fileUrl, self.location.origin);
      return u.toString();
    } catch (_e) {
      throw {
        status: 404
      };
    }
  }
  async function getFileRange(file, offset, len) {
    var url = getFileUrl(file);
    var chunkSize = __wasmfs_fetch_get_chunk_size(file);
    offset ??= 0;
    len ??= chunkSize;
    // In which chunk does the seeked range start?  E.g., 5-14 with chunksize 8 will start in chunk 0.
    if (!(file in wasmFS$JSMemoryRanges)) {
      var fileInfo = await fetch(url, {
        method: "HEAD",
        headers: {
          "Range": "bytes=0-"
        }
      });
      if (fileInfo.ok && fileInfo.headers.has("Content-Length") && fileInfo.headers.get("Accept-Ranges") == "bytes" && (parseInt(fileInfo.headers.get("Content-Length"), 10) > chunkSize * 2)) {
        var size = parseInt(fileInfo.headers.get("Content-Length"), 10);
        wasmFS$JSMemoryRanges[file] = {
          size,
          chunks: [],
          chunkSize
        };
        len = Math.min(len, size - offset);
      } else {
        // may as well/forced to download the whole file
        var wholeFileReq = await fetch(url);
        if (!wholeFileReq.ok) {
          throw wholeFileReq;
        }
        var wholeFileData = new Uint8Array(await wholeFileReq.arrayBuffer());
        wasmFS$JSMemoryRanges[file] = {
          size: wholeFileData.byteLength,
          chunks: [ wholeFileData ],
          chunkSize: wholeFileData.byteLength
        };
        return;
      }
    }
    var firstChunk = (offset / chunkSize) | 0;
    // In which chunk does the seeked range end?  E.g., 5-14 with chunksize 8 will end in chunk 1, as will 5-16 (since byte 16 isn't requested).
    // This will always give us a chunk >= firstChunk since len > 0.
    var lastChunk = ((offset + len - 1) / chunkSize) | 0;
    var allPresent = true;
    var i;
    // Do we have all the chunks already?  If so, we don't need to do any fetches.
    for (i = firstChunk; i <= lastChunk; i++) {
      if (!wasmFS$JSMemoryRanges[file].chunks[i]) {
        allPresent = false;
        break;
      }
    }
    if (allPresent) {
      // The data is already here, so nothing to do before we continue on to
      // the actual read.
      return;
    }
    // This is the first time we want the chunks' data.  We'll make
    // one request for all the chunks we need, rather than one
    // request per chunk.
    var start = firstChunk * chunkSize;
    // We must fetch *up to* the last byte of the last chunk.
    var end = (lastChunk + 1) * chunkSize;
    var response = await fetch(url, {
      headers: {
        "Range": `bytes=${start}-${end - 1}`
      }
    });
    if (!response.ok) {
      throw response;
    }
    // Use the new .bytes() method to save a bit of code size when all target environments have it. https://developer.mozilla.org/en-US/docs/Web/API/Response/bytes
    var bytes = await response["bytes"]();
    for (i = firstChunk; i <= lastChunk; i++) {
      wasmFS$JSMemoryRanges[file].chunks[i] = bytes.slice(i * chunkSize - start, (i + 1) * chunkSize - start);
    }
  }
  wasmFS$backends[backend] = {
    // alloc/free operations are not actually async. Just forward to the
    // parent class, but we must return a Promise as the caller expects.
    allocFile: async file => {},
    freeFile: async file => {
      // free memory
      wasmFS$JSMemoryRanges[file] = undefined;
      delete wasmFS$fetchSizes[file];
    },
    write: async (file, buffer, length, offset) => {
      console.error("TODO: file writing in fetch backend? read-only for now");
    },
    // read/getSize fetch the data, then forward to the parent class.
    read: async (file, buffer, length, offset) => {
      // This function assumes that offset is non-negative and length is positive.
      // C read() doesn't take an offset and so doesn't have to deal with the former situation,
      // and if the length is 0 or the offset is negative there's no reasonable read we can make.
      if (offset < 0 || length <= 0) {
        return 0;
      }
      try {
        await getFileRange(file, offset || 0, length);
      } catch (failedResponse) {
        return failedResponse.status === 404 ? -44 : -8;
      }
      var fileInfo = wasmFS$JSMemoryRanges[file];
      length = Math.min(length, fileInfo.size - offset);
      // As above, we check the length just in case offset was beyond size and length is now negative.
      if (length <= 0) {
        return 0;
      }
      var chunks = fileInfo.chunks;
      var chunkSize = fileInfo.chunkSize;
      var firstChunk = (offset / chunkSize) | 0;
      // See comments in getFileRange.
      var lastChunk = ((offset + length - 1) / chunkSize) | 0;
      var readLength = 0;
      for (var i = firstChunk; i <= lastChunk; i++) {
        var chunk = chunks[i];
        var start = Math.max(i * chunkSize, offset);
        var chunkStart = i * chunkSize;
        var end = Math.min(chunkStart + chunkSize, offset + length);
        (growMemViews(), HEAPU8).set(chunk.subarray(start - chunkStart, end - chunkStart), buffer + (start - offset) >>> 0);
        readLength = end - offset;
      }
      return readLength;
    },
    getSize: async file => {
      // Until the file's data is wanted, answer from a HEAD's Content-Length: getFileRange downloads (and
      // keeps) the WHOLE file when the server offers no byte ranges or the file is under two chunks, which
      // would make every stat() of such a file a full download. (FNA-WASM-Build emsdk.6.)
      if (!wasmFS$JSMemoryRanges[file]) {
        var known = wasmFS$fetchSizes[file];
        if (known !== undefined) {
          return known;
        }
        try {
          var head = await fetch(getFileUrl(file), {
            method: "HEAD"
          });
          var len = head.headers.get("Content-Length");
          if (head.ok && len !== null && !head.headers.get("Content-Encoding")) {
            var n = Number(len);
            if (Number.isSafeInteger(n) && n >= 0) {
              wasmFS$fetchSizes[file] = n;
              return n;
            }
          }
        } catch (e) {}
      }
      try {
        await getFileRange(file, 0, 0);
      } catch (failedResponse) {
        return 0;
      }
      return wasmFS$JSMemoryRanges[file].size;
    }
  };
}

var wasmFSPreloadedDirs = [];

var __wasmfs_get_num_preloaded_dirs = () => wasmFSPreloadedDirs.length;

var wasmFSPreloadedFiles = [];

var wasmFSPreloadingFlushed = false;

var __wasmfs_get_num_preloaded_files = () => {
  // When this method is called from WasmFS it means that we are about to
  // flush all the preloaded data, so mark that. (There is no call that
  // occurs at the end of that flushing, which would be more natural, but it
  // is fine to mark the flushing here as during the flushing itself no user
  // code can run, so nothing will check whether we have flushed or not.)
  wasmFSPreloadingFlushed = true;
  return wasmFSPreloadedFiles.length;
};

function __wasmfs_get_preloaded_child_path(index, childNameBuffer) {
  childNameBuffer >>>= 0;
  var s = wasmFSPreloadedDirs[index].childName;
  var len = lengthBytesUTF8(s) + 1;
  stringToUTF8(s, childNameBuffer, len);
}

var __wasmfs_get_preloaded_file_mode = index => wasmFSPreloadedFiles[index].mode;

function __wasmfs_get_preloaded_file_size(index) {
  return wasmFSPreloadedFiles[index].fileData.length;
}

function __wasmfs_get_preloaded_parent_path(index, parentPathBuffer) {
  parentPathBuffer >>>= 0;
  var s = wasmFSPreloadedDirs[index].parentPath;
  var len = lengthBytesUTF8(s) + 1;
  stringToUTF8(s, parentPathBuffer, len);
}

var lengthBytesUTF8 = str => {
  var len = 0;
  for (var i = 0; i < str.length; ++i) {
    // Gotcha: charCodeAt returns a 16-bit word that is a UTF-16 encoded code
    // unit, not a Unicode code point of the character! So decode
    // UTF16->UTF32->UTF8.
    // See http://unicode.org/faq/utf_bom.html#utf16-3
    var c = str.charCodeAt(i);
    // possibly a lead surrogate
    if (c <= 127) {
      len++;
    } else if (c <= 2047) {
      len += 2;
    } else if (c >= 55296 && c <= 57343) {
      len += 4;
      ++i;
    } else {
      len += 3;
    }
  }
  return len;
};

function __wasmfs_get_preloaded_path_name(index, fileNameBuffer) {
  fileNameBuffer >>>= 0;
  var s = wasmFSPreloadedFiles[index].pathName;
  var len = lengthBytesUTF8(s) + 1;
  stringToUTF8(s, fileNameBuffer, len);
}

function __wasmfs_jsimpl_alloc_file(backend, file) {
  backend >>>= 0;
  file >>>= 0;
  return wasmFS$backends[backend].allocFile(file);
}

async function __wasmfs_jsimpl_async_alloc_file(ctx, backend, file) {
  ctx >>>= 0;
  backend >>>= 0;
  file >>>= 0;
  await wasmFS$backends[backend].allocFile(file);
  _emscripten_proxy_finish(ctx);
}

async function __wasmfs_jsimpl_async_free_file(ctx, backend, file) {
  ctx >>>= 0;
  backend >>>= 0;
  file >>>= 0;
  await wasmFS$backends[backend].freeFile(file);
  _emscripten_proxy_finish(ctx);
}

async function __wasmfs_jsimpl_async_get_size(ctx, backend, file, size_p) {
  ctx >>>= 0;
  backend >>>= 0;
  file >>>= 0;
  size_p >>>= 0;
  var size = await wasmFS$backends[backend].getSize(file);
  (growMemViews(), HEAP64)[((size_p) >>> 3) >>> 0] = BigInt(size);
  _emscripten_proxy_finish(ctx);
}

async function __wasmfs_jsimpl_async_read(ctx, backend, file, buffer, length, offset, result_p) {
  ctx >>>= 0;
  backend >>>= 0;
  file >>>= 0;
  buffer >>>= 0;
  length >>>= 0;
  offset = bigintToI53Checked(offset);
  result_p >>>= 0;
  var result = await wasmFS$backends[backend].read(file, buffer, length, offset);
  (growMemViews(), HEAPU32)[((result_p) >>> 2) >>> 0] = result;
  _emscripten_proxy_finish(ctx);
}

async function __wasmfs_jsimpl_async_write(ctx, backend, file, buffer, length, offset, result_p) {
  ctx >>>= 0;
  backend >>>= 0;
  file >>>= 0;
  buffer >>>= 0;
  length >>>= 0;
  offset = bigintToI53Checked(offset);
  result_p >>>= 0;
  var result = await wasmFS$backends[backend].write(file, buffer, length, offset);
  (growMemViews(), HEAPU32)[((result_p) >>> 2) >>> 0] = result;
  _emscripten_proxy_finish(ctx);
}

function __wasmfs_jsimpl_free_file(backend, file) {
  backend >>>= 0;
  file >>>= 0;
  return wasmFS$backends[backend].freeFile(file);
}

function __wasmfs_jsimpl_get_size(backend, file) {
  backend >>>= 0;
  file >>>= 0;
  return wasmFS$backends[backend].getSize(file);
}

function __wasmfs_jsimpl_read(backend, file, buffer, length, offset) {
  backend >>>= 0;
  file >>>= 0;
  buffer >>>= 0;
  length >>>= 0;
  offset = bigintToI53Checked(offset);
  if (!wasmFS$backends[backend].read) {
    return -28;
  }
  return wasmFS$backends[backend].read(file, buffer, length, offset);
}

function __wasmfs_jsimpl_set_size(backend, file, size) {
  backend >>>= 0;
  file >>>= 0;
  size = bigintToI53Checked(size);
  return wasmFS$backends[backend].setSize(file, size);
}

function __wasmfs_jsimpl_write(backend, file, buffer, length, offset) {
  backend >>>= 0;
  file >>>= 0;
  buffer >>>= 0;
  length >>>= 0;
  offset = bigintToI53Checked(offset);
  if (!wasmFS$backends[backend].write) {
    return -28;
  }
  return wasmFS$backends[backend].write(file, buffer, length, offset);
}

class HandleAllocator {
  allocated=[ undefined ];
  freelist=[];
  get(id) {
    return this.allocated[id];
  }
  has(id) {
    return this.allocated[id] !== undefined;
  }
  allocate(handle) {
    var id = this.freelist.pop() ?? this.allocated.length;
    this.allocated[id] = handle;
    return id;
  }
  free(id) {
    // Set the slot to `undefined` rather than using `delete` here since
    // apparently arrays with holes in them can be less efficient.
    this.allocated[id] = undefined;
    this.freelist.push(id);
  }
}

var wasmfsOPFSAccessHandles = new HandleAllocator;

var wasmfsOPFSProxyFinish = ctx => {
  // When using pthreads the proxy needs to know when the work is finished.
  // When used with JSPI the work will be executed in an async block so there
  // is no need to notify when done.
  _emscripten_proxy_finish(ctx);
};

async function __wasmfs_opfs_close_access(ctx, accessID, errPtr) {
  ctx >>>= 0;
  errPtr >>>= 0;
  let accessHandle = wasmfsOPFSAccessHandles.get(accessID);
  try {
    await accessHandle.close();
  } catch {
    let err = -29;
    (growMemViews(), HEAP32)[((errPtr) >>> 2) >>> 0] = err;
  }
  wasmfsOPFSAccessHandles.free(accessID);
  wasmfsOPFSProxyFinish(ctx);
}

var wasmfsOPFSBlobs = new HandleAllocator;

var __wasmfs_opfs_close_blob = blobID => {
  wasmfsOPFSBlobs.free(blobID);
};

function __wasmfs_opfs_flush_access(ctx, accessID, errPtr) {
  ctx >>>= 0;
  errPtr >>>= 0;
  let accessHandle = wasmfsOPFSAccessHandles.get(accessID);
  (globalThis.__opfsStats ||= {
    reads: 0,
    readBytes: 0,
    writes: 0,
    writeBytes: 0,
    sizes: 0,
    flushes: 0,
    opens: 0
  }).flushes++;
  try {
    accessHandle.flush();
  } catch {
    let err = -29;
    (growMemViews(), HEAP32)[((errPtr) >>> 2) >>> 0] = err;
  }
  wasmfsOPFSProxyFinish(ctx);
}

var wasmfsOPFSDirectoryHandles = new HandleAllocator;

var __wasmfs_opfs_free_directory = dirID => {
  wasmfsOPFSDirectoryHandles.free(dirID);
};

var wasmfsOPFSFileHandles = new HandleAllocator;

var __wasmfs_opfs_free_file = fileID => {
  wasmfsOPFSFileHandles.free(fileID);
};

var wasmfsOPFSGetOrCreateFile = async (parent, name, create) => {
  let parentHandle = wasmfsOPFSDirectoryHandles.get(parent);
  let fileHandle;
  try {
    fileHandle = await parentHandle.getFileHandle(name, {
      create
    });
  } catch (e) {
    if (e.name === "NotFoundError") {
      return -20;
    }
    if (e.name === "TypeMismatchError") {
      return -31;
    }
    return -29;
  }
  return wasmfsOPFSFileHandles.allocate(fileHandle);
};

var wasmfsOPFSGetOrCreateDir = async (parent, name, create) => {
  let parentHandle = wasmfsOPFSDirectoryHandles.get(parent);
  let childHandle;
  try {
    childHandle = await parentHandle.getDirectoryHandle(name, {
      create
    });
  } catch (e) {
    if (e.name === "NotFoundError") {
      return -20;
    }
    if (e.name === "TypeMismatchError") {
      return -54;
    }
    return -29;
  }
  return wasmfsOPFSDirectoryHandles.allocate(childHandle);
};

async function __wasmfs_opfs_get_child(ctx, parent, namePtr, childTypePtr, childIDPtr) {
  ctx >>>= 0;
  namePtr >>>= 0;
  childTypePtr >>>= 0;
  childIDPtr >>>= 0;
  let name = UTF8ToString(namePtr);
  let childType = 1;
  let childID = await wasmfsOPFSGetOrCreateFile(parent, name, false);
  if (childID == -31) {
    childType = 2;
    childID = await wasmfsOPFSGetOrCreateDir(parent, name, false);
  }
  (growMemViews(), HEAP32)[((childTypePtr) >>> 2) >>> 0] = childType;
  (growMemViews(), HEAP32)[((childIDPtr) >>> 2) >>> 0] = childID;
  wasmfsOPFSProxyFinish(ctx);
}

async function __wasmfs_opfs_get_entries(ctx, dirID, entriesPtr, errPtr) {
  ctx >>>= 0;
  entriesPtr >>>= 0;
  errPtr >>>= 0;
  let dirHandle = wasmfsOPFSDirectoryHandles.get(dirID);
  // TODO: Use 'for await' once Acorn supports that.
  try {
    let iter = dirHandle.entries();
    for (let entry; entry = await iter.next(), !entry.done; ) {
      let [name, child] = entry.value;
      let sp = stackSave();
      let namePtr = stringToUTF8OnStack(name);
      let type = child.kind == "file" ? 1 : 2;
      __wasmfs_opfs_record_entry(entriesPtr, namePtr, type);
      stackRestore(sp);
    }
  } catch {
    let err = -29;
    (growMemViews(), HEAP32)[((errPtr) >>> 2) >>> 0] = err;
  }
  wasmfsOPFSProxyFinish(ctx);
}

function __wasmfs_opfs_get_size_access(ctx, accessID, sizePtr) {
  ctx >>>= 0;
  sizePtr >>>= 0;
  let accessHandle = wasmfsOPFSAccessHandles.get(accessID);
  let size;
  try {
    size = accessHandle.getSize();
  } catch {
    size = -29;
  }
  (growMemViews(), HEAP64)[((sizePtr) >>> 3) >>> 0] = BigInt(size);
  (globalThis.__opfsStats ||= {
    reads: 0,
    readBytes: 0,
    writes: 0,
    writeBytes: 0,
    sizes: 0,
    flushes: 0,
    opens: 0
  }).sizes++;
  wasmfsOPFSProxyFinish(ctx);
}

var __wasmfs_opfs_get_size_blob = function(blobID) {
  var ret = (() => wasmfsOPFSBlobs.get(blobID).size)();
  return BigInt(ret);
};

async function __wasmfs_opfs_get_size_file(ctx, fileID, sizePtr) {
  ctx >>>= 0;
  sizePtr >>>= 0;
  let fileHandle = wasmfsOPFSFileHandles.get(fileID);
  let size;
  try {
    size = (await fileHandle.getFile()).size;
  } catch {
    size = -29;
  }
  (growMemViews(), HEAP64)[((sizePtr) >>> 3) >>> 0] = BigInt(size);
  wasmfsOPFSProxyFinish(ctx);
}

async function __wasmfs_opfs_init_root_directory(ctx) {
  ctx >>>= 0;
  // allocated.length starts off as 1 since 0 is a reserved handle
  if (wasmfsOPFSDirectoryHandles.allocated.length == 1) {
    // Closure compiler errors on this as it does not recognize the OPFS
    // API yet, it seems. Unfortunately an existing annotation for this is in
    // the closure compiler codebase, and cannot be overridden in user code
    // (it complains on a duplicate type annotation), so just suppress it.
    /** @suppress {checkTypes} */ let root = await navigator.storage.getDirectory();
    wasmfsOPFSDirectoryHandles.allocated.push(root);
  }
  wasmfsOPFSProxyFinish(ctx);
}

async function __wasmfs_opfs_insert_directory(ctx, parent, namePtr, childIDPtr) {
  ctx >>>= 0;
  namePtr >>>= 0;
  childIDPtr >>>= 0;
  let name = UTF8ToString(namePtr);
  let childID = await wasmfsOPFSGetOrCreateDir(parent, name, true);
  (growMemViews(), HEAP32)[((childIDPtr) >>> 2) >>> 0] = childID;
  wasmfsOPFSProxyFinish(ctx);
}

async function __wasmfs_opfs_insert_file(ctx, parent, namePtr, childIDPtr) {
  ctx >>>= 0;
  namePtr >>>= 0;
  childIDPtr >>>= 0;
  let name = UTF8ToString(namePtr);
  let childID = await wasmfsOPFSGetOrCreateFile(parent, name, true);
  (growMemViews(), HEAP32)[((childIDPtr) >>> 2) >>> 0] = childID;
  wasmfsOPFSProxyFinish(ctx);
}

async function __wasmfs_opfs_move_file(ctx, fileID, newParentID, namePtr, errPtr) {
  ctx >>>= 0;
  namePtr >>>= 0;
  errPtr >>>= 0;
  let name = UTF8ToString(namePtr);
  let fileHandle = wasmfsOPFSFileHandles.get(fileID);
  let newDirHandle = wasmfsOPFSDirectoryHandles.get(newParentID);
  try {
    await fileHandle.move(newDirHandle, name);
  } catch {
    let err = -29;
    (growMemViews(), HEAP32)[((errPtr) >>> 2) >>> 0] = err;
  }
  wasmfsOPFSProxyFinish(ctx);
}

var wasmfsOPFSModeSupported;

var wasmfsOPFSCreateSyncAccessHandle = async fileHandle => {
  // Check if `mode` is supported by the browser by seeing if the browser
  // reads it from options. A TypeError means the browser rejected the value.
  async function checkForModeSupport() {
    let modeRead = false;
    const options = {
      get mode() {
        modeRead = true;
        return "readwrite-unsafe";
      }
    };
    try {
      let handle = await fileHandle.createSyncAccessHandle(options);
      await handle.close();
    } catch (e) {
      if (e.name === "TypeError") return false;
    }
    return modeRead;
  }
  if (wasmfsOPFSModeSupported ??= await checkForModeSupport()) {
    return fileHandle.createSyncAccessHandle({
      mode: "readwrite-unsafe"
    });
  }
  return fileHandle.createSyncAccessHandle();
};

async function __wasmfs_opfs_open_access(ctx, fileID, accessIDPtr) {
  ctx >>>= 0;
  accessIDPtr >>>= 0;
  let fileHandle = wasmfsOPFSFileHandles.get(fileID);
  let accessID;
  try {
    let accessHandle;
    accessHandle = await wasmfsOPFSCreateSyncAccessHandle(fileHandle);
    accessID = wasmfsOPFSAccessHandles.allocate(accessHandle);
  } catch (e) {
    // TODO: Presumably only one of these will appear in the final API?
    if (e.name === "InvalidStateError" || e.name === "NoModificationAllowedError") {
      accessID = -2;
    } else {
      accessID = -29;
    }
  }
  (growMemViews(), HEAP32)[((accessIDPtr) >>> 2) >>> 0] = accessID;
  wasmfsOPFSProxyFinish(ctx);
}

async function __wasmfs_opfs_open_blob(ctx, fileID, blobIDPtr) {
  ctx >>>= 0;
  blobIDPtr >>>= 0;
  let fileHandle = wasmfsOPFSFileHandles.get(fileID);
  let blobID;
  try {
    let blob = await fileHandle.getFile();
    blobID = wasmfsOPFSBlobs.allocate(blob);
  } catch (e) {
    if (e.name === "NotAllowedError") {
      blobID = -2;
    } else {
      blobID = -29;
    }
  }
  (growMemViews(), HEAP32)[((blobIDPtr) >>> 2) >>> 0] = blobID;
  wasmfsOPFSProxyFinish(ctx);
}

async function __wasmfs_opfs_open_shared_access(ctx, fileID, accessIDPtr) {
  ctx >>>= 0;
  accessIDPtr >>>= 0;
  let accessID = -1;
  if (wasmfsOPFSModeSupported !== false) {
    let fileHandle = wasmfsOPFSFileHandles.get(fileID);
    try {
      let accessHandle = await wasmfsOPFSCreateSyncAccessHandle(fileHandle);
      if (wasmfsOPFSModeSupported) {
        accessID = wasmfsOPFSAccessHandles.allocate(accessHandle);
      } else {
        // Without 'mode' support this handle is exclusive, so release it.
        await accessHandle.close();
      }
    } catch (e) {}
  }
  (growMemViews(), HEAP32)[((accessIDPtr) >>> 2) >>> 0] = accessID;
  wasmfsOPFSProxyFinish(ctx);
}

function __wasmfs_opfs_read_access(accessID, bufPtr, len, pos) {
  bufPtr >>>= 0;
  pos = bigintToI53Checked(pos);
  let accessHandle = wasmfsOPFSAccessHandles.get(accessID);
  let data = (growMemViews(), HEAPU8).subarray(bufPtr >>> 0, bufPtr + len >>> 0);
  // Op accounting. Every one of these is a blocking cross-thread round trip for the calling thread, so the
  // COUNT is the thing worth knowing before trying to make each one cheaper -- a CPU profile cannot show it
  // (task-clock samples only on-CPU time, and a thread waiting on the proxy is off-CPU). Logged in batches so
  // the log stays readable; a plain global rather than an emscripten library symbol to avoid __deps plumbing.
  var S = (globalThis.__opfsStats ||= {
    reads: 0,
    readBytes: 0,
    writes: 0,
    writeBytes: 0,
    sizes: 0,
    flushes: 0,
    opens: 0
  });
  S.reads++;
  S.readBytes += len;
  if ((S.reads & 8191) === 0) err("OPFS_STATS reads=" + S.reads + " readMB=" + (S.readBytes / 1048576).toFixed(1) + " writes=" + S.writes + " writeMB=" + (S.writeBytes / 1048576).toFixed(1) + " getSize=" + S.sizes + " flush=" + S.flushes + " open=" + S.opens);
  try {
    return accessHandle.read(data, {
      at: pos
    });
  } catch (e) {
    if (e.name == "TypeError") {
      return -28;
    }
    return -29;
  }
}

async function __wasmfs_opfs_read_blob(ctx, blobID, bufPtr, len, pos, nreadPtr) {
  ctx >>>= 0;
  bufPtr >>>= 0;
  pos = bigintToI53Checked(pos);
  nreadPtr >>>= 0;
  let blob = wasmfsOPFSBlobs.get(blobID);
  let slice = blob.slice(pos, pos + len);
  let nread = 0;
  try {
    // TODO: Use ReadableStreamBYOBReader once
    // https://bugs.chromium.org/p/chromium/issues/detail?id=1189621 is
    // resolved.
    let buf = await slice.arrayBuffer();
    let data = new Uint8Array(buf);
    (growMemViews(), HEAPU8).set(data, bufPtr >>> 0);
    nread += data.length;
  } catch (e) {
    if (e instanceof RangeError) {
      nread = -21;
    } else {
      nread = -29;
    }
  }
  (growMemViews(), HEAP32)[((nreadPtr) >>> 2) >>> 0] = nread;
  wasmfsOPFSProxyFinish(ctx);
}

async function __wasmfs_opfs_remove_child(ctx, dirID, namePtr, errPtr) {
  ctx >>>= 0;
  namePtr >>>= 0;
  errPtr >>>= 0;
  let name = UTF8ToString(namePtr);
  let dirHandle = wasmfsOPFSDirectoryHandles.get(dirID);
  try {
    await dirHandle.removeEntry(name);
  } catch {
    let err = -29;
    (growMemViews(), HEAP32)[((errPtr) >>> 2) >>> 0] = err;
  }
  wasmfsOPFSProxyFinish(ctx);
}

async function __wasmfs_opfs_set_size_access(ctx, accessID, size, errPtr) {
  ctx >>>= 0;
  size = bigintToI53Checked(size);
  errPtr >>>= 0;
  let accessHandle = wasmfsOPFSAccessHandles.get(accessID);
  try {
    await accessHandle.truncate(size);
  } catch {
    let err = -29;
    (growMemViews(), HEAP32)[((errPtr) >>> 2) >>> 0] = err;
  }
  wasmfsOPFSProxyFinish(ctx);
}

async function __wasmfs_opfs_set_size_file(ctx, fileID, size, errPtr) {
  ctx >>>= 0;
  size = bigintToI53Checked(size);
  errPtr >>>= 0;
  let fileHandle = wasmfsOPFSFileHandles.get(fileID);
  try {
    let writable = await fileHandle.createWritable({
      keepExistingData: true
    });
    await writable.truncate(size);
    await writable.close();
  } catch {
    let err = -29;
    (growMemViews(), HEAP32)[((errPtr) >>> 2) >>> 0] = err;
  }
  wasmfsOPFSProxyFinish(ctx);
}

function __wasmfs_opfs_write_access(accessID, bufPtr, len, pos) {
  bufPtr >>>= 0;
  pos = bigintToI53Checked(pos);
  let accessHandle = wasmfsOPFSAccessHandles.get(accessID);
  let data = (growMemViews(), HEAPU8).subarray(bufPtr >>> 0, bufPtr + len >>> 0);
  var S = (globalThis.__opfsStats ||= {
    reads: 0,
    readBytes: 0,
    writes: 0,
    writeBytes: 0,
    sizes: 0,
    flushes: 0,
    opens: 0
  });
  S.writes++;
  S.writeBytes += len;
  try {
    return accessHandle.write(data, {
      at: pos
    });
  } catch (e) {
    if (e.name == "TypeError") {
      return -28;
    }
    return -29;
  }
}

var wasmfsSocketGetTransport = () => Module["wasmfsSocketTransport"] ?? globalThis["wasmfsSocketTransport"];

var __wasmfs_socket_close = (id, abort) => {
  try {
    wasmfsSocketGetTransport()?.["close"](id, !!abort);
  } catch (e) {
    err(`wasmfs: socket transport close() threw: ${e}`);
  }
};

var wasmfsSocketErrno = error => {
  if (!error) return 0;
  switch (error) {
   case "ECONNREFUSED":
    return 14;

   case "ECONNRESET":
    return 15;

   case "ETIMEDOUT":
    return 73;

   case "EHOSTUNREACH":
    return 23;

   case "ENETUNREACH":
    return 40;

   case "ECONNABORTED":
    return 13;

   case "EPIPE":
    return 64;
  }
  return 15;
};

var wasmfsSocketScratch = 0;

var wasmfsSocketEvents = () => ({
  "open": id => _wasmfs_socket_on_open(id),
  "data": (id, bytes) => {
    if (!(bytes instanceof Uint8Array)) bytes = new Uint8Array(bytes);
    if (!wasmfsSocketScratch) wasmfsSocketScratch = _malloc(65536);
    var pause = 0;
    for (var offset = 0; offset < bytes.length; offset += 65536) {
      var chunk = bytes.subarray(offset, offset + 65536);
      (growMemViews(), HEAPU8).set(chunk, wasmfsSocketScratch >>> 0);
      pause |= _wasmfs_socket_on_data(id, wasmfsSocketScratch, chunk.length);
    }
    if (pause) wasmfsSocketGetTransport()?.["pause"]?.(id);
  },
  "end": id => _wasmfs_socket_on_end(id),
  "drained": (id, n) => _wasmfs_socket_on_drained(id, n),
  "close": (id, error) => _wasmfs_socket_on_close(id, wasmfsSocketErrno(error))
});

function __wasmfs_socket_connect(id, host, port, family) {
  host >>>= 0;
  var transport = wasmfsSocketGetTransport();
  if (!transport) {
    _wasmfs_socket_on_close(id, 40);
    return;
  }
  try {
    transport["connect"](id, UTF8ToString(host), port, family, wasmfsSocketEvents());
  } catch (e) {
    err(`wasmfs: socket transport connect() threw: ${e}`);
    _wasmfs_socket_on_close(id, 14);
  }
}

var __wasmfs_socket_resume = id => {
  try {
    wasmfsSocketGetTransport()?.["resume"]?.(id);
  } catch (e) {
    err(`wasmfs: socket transport resume() threw: ${e}`);
  }
};

function __wasmfs_socket_send(id, buf, len) {
  buf >>>= 0;
  len >>>= 0;
  var bytes = (growMemViews(), HEAPU8).slice(buf, buf + len);
  try {
    wasmfsSocketGetTransport()["send"](id, bytes);
  } catch (e) {
    err(`wasmfs: socket transport send() threw: ${e}`);
    _wasmfs_socket_on_close(id, 15);
  }
}

var __wasmfs_socket_shutdown = id => {
  try {
    wasmfsSocketGetTransport()?.["shutdown"]?.(id);
  } catch (e) {
    err(`wasmfs: socket transport shutdown() threw: ${e}`);
  }
};

var __wasmfs_socket_thread_init = function(queue) {
  queue >>>= 0;
  if (!waitAsyncPolyfilled) return;
  var interval = setInterval(() => {
    if (ABORT) {
      clearInterval(interval);
    } else {
      _emscripten_proxy_execute_queue(queue);
    }
  }, 4);
};

var FS_stdin_getChar_buffer = [];

/** @type {function(string, boolean=, number=)} */ var intArrayFromString = (stringy, dontAddNull, length) => {
  var len = length > 0 ? length : lengthBytesUTF8(stringy) + 1;
  var u8array = new Array(len);
  var numBytesWritten = stringToUTF8Array(stringy, u8array, 0, u8array.length);
  if (dontAddNull) u8array.length = numBytesWritten;
  return u8array;
};

var FS_stdin_getChar = () => {
  if (!FS_stdin_getChar_buffer.length) {
    var result = null;
    if (globalThis.window?.prompt) {
      // Browser.
      result = window.prompt("Input: ");
      // returns null on cancel
      if (result !== null) {
        result += "\n";
      }
    } else {}
    if (!result) {
      return null;
    }
    FS_stdin_getChar_buffer = intArrayFromString(result, true);
  }
  return FS_stdin_getChar_buffer.shift();
};

var __wasmfs_stdin_get_char = () => {
  // Return the read character, or -1 to indicate EOF.
  var c = FS_stdin_getChar();
  if (typeof c === "number") {
    return c;
  }
  return -1;
};

var __wasmfs_thread_utils_heartbeat = function(queue) {
  queue >>>= 0;
  var intervalID = setInterval(() => {
    if (ABORT) {
      clearInterval(intervalID);
    } else {
      _emscripten_proxy_execute_queue(queue);
    }
  }, 2);
};

var _emscripten_get_now_res = () => 1e3;

var nowIsMonotonic = 1;

var checkWasiClock = clock_id => clock_id >= 0 && clock_id <= 3;

function _clock_res_get(clk_id, pres) {
  pres >>>= 0;
  if (!checkWasiClock(clk_id)) {
    return 28;
  }
  var nsec;
  // all wasi clocks but realtime are monotonic
  if (clk_id === 0) {
    nsec = 1e3 * 1e3;
  } else if (nowIsMonotonic) {
    nsec = _emscripten_get_now_res();
  } else {
    return 52;
  }
  (growMemViews(), HEAP64)[((pres) >>> 3) >>> 0] = BigInt(nsec);
  return 0;
}

var _emscripten_date_now = () => Date.now();

function _clock_time_get(clk_id, ignored_precision, ptime) {
  ignored_precision = bigintToI53Checked(ignored_precision);
  ptime >>>= 0;
  if (!checkWasiClock(clk_id)) {
    return 28;
  }
  var now;
  // all wasi clocks but realtime are monotonic
  if (clk_id === 0) {
    now = _emscripten_date_now();
  } else if (nowIsMonotonic) {
    now = _emscripten_get_now();
  } else {
    return 52;
  }
  // "now" is in ms, and wasi times are in ns.
  var nsec = Math.round(now * 1e3 * 1e3);
  (growMemViews(), HEAP64)[((ptime) >>> 3) >>> 0] = BigInt(nsec);
  return 0;
}

var readEmAsmArgsArray = [];

var readEmAsmArgs = (sigPtr, buf) => {
  readEmAsmArgsArray.length = 0;
  var ch;
  // Most arguments are i32s, so shift the buffer pointer so it is a plain
  // index into HEAP32.
  while (ch = (growMemViews(), HEAPU8)[sigPtr++ >>> 0]) {
    // Floats are always passed as doubles, so all types except for 'i'
    // are 8 bytes and require alignment.
    var wide = (ch != 105);
    wide &= (ch != 112);
    buf += wide && (buf % 8) ? 4 : 0;
    readEmAsmArgsArray.push(// Special case for pointers under wasm64 or CAN_ADDRESS_2GB mode.
    ch == 112 ? (growMemViews(), HEAPU32)[((buf) >>> 2) >>> 0] : ch == 106 ? (growMemViews(), 
    HEAP64)[((buf) >>> 3) >>> 0] : ch == 105 ? (growMemViews(), HEAP32)[((buf) >>> 2) >>> 0] : (growMemViews(), 
    HEAPF64)[((buf) >>> 3) >>> 0]);
    buf += wide ? 8 : 4;
  }
  return readEmAsmArgsArray;
};

var runMainThreadEmAsm = (emAsmAddr, sigPtr, argbuf, sync) => {
  var args = readEmAsmArgs(sigPtr, argbuf);
  if (ENVIRONMENT_IS_PTHREAD) {
    // EM_ASM functions are variadic, receiving the actual arguments as a buffer
    // in memory. the last parameter (argBuf) points to that data. We need to
    // always un-variadify that, *before proxying*, as in the async case this
    // is a stack allocation that LLVM made, which may go away before the main
    // thread gets the message. For that reason we handle proxying *after* the
    // call to readEmAsmArgs, and therefore we do that manually here instead
    // of using __proxy. (And for simplicity, do the same in the sync
    // case as well, even though it's not strictly necessary, to keep the two
    // code paths as similar as possible on both sides.)
    return proxyToMainThread(0, emAsmAddr, sync, ...args);
  }
  return ASM_CONSTS[emAsmAddr](...args);
};

function _emscripten_asm_const_async_on_main_thread(emAsmAddr, sigPtr, argbuf) {
  emAsmAddr >>>= 0;
  sigPtr >>>= 0;
  argbuf >>>= 0;
  return runMainThreadEmAsm(emAsmAddr, sigPtr, argbuf, 0);
}

function _emscripten_asm_const_int_sync_on_main_thread(emAsmAddr, sigPtr, argbuf) {
  emAsmAddr >>>= 0;
  sigPtr >>>= 0;
  argbuf >>>= 0;
  return runMainThreadEmAsm(emAsmAddr, sigPtr, argbuf, 1);
}

function _emscripten_asm_const_double_sync_on_main_thread(a1, a2, a3) {
  a1 >>>= 0;
  a2 >>>= 0;
  a3 >>>= 0;
  return _emscripten_asm_const_int_sync_on_main_thread(a1, a2, a3);
}

var runEmAsmFunction = (code, sigPtr, argbuf) => {
  var args = readEmAsmArgs(sigPtr, argbuf);
  return ASM_CONSTS[code](...args);
};

function _emscripten_asm_const_int(code, sigPtr, argbuf) {
  code >>>= 0;
  sigPtr >>>= 0;
  argbuf >>>= 0;
  return runEmAsmFunction(code, sigPtr, argbuf);
}

function _emscripten_asm_const_ptr_sync_on_main_thread(emAsmAddr, sigPtr, argbuf) {
  emAsmAddr >>>= 0;
  sigPtr >>>= 0;
  argbuf >>>= 0;
  return runMainThreadEmAsm(emAsmAddr, sigPtr, argbuf, 1);
}

var runtimeKeepalivePush = () => {
  runtimeKeepaliveCounter += 1;
};

var _emscripten_set_main_loop_timing = (mode, value) => {
  MainLoop.timingMode = mode;
  MainLoop.timingValue = value;
  if (!MainLoop.func) {
    return 1;
  }
  if (!MainLoop.running) {
    runtimeKeepalivePush();
    MainLoop.running = true;
  }
  if (mode == 0) {
    MainLoop.scheduler = function MainLoop_scheduler_setTimeout() {
      var timeUntilNextTick = Math.max(0, MainLoop.tickStartTime + value - _emscripten_get_now()) | 0;
      setTimeout(MainLoop.runner, timeUntilNextTick);
    };
  } else if (mode == 1) {
    MainLoop.scheduler = function MainLoop_scheduler_rAF() {
      MainLoop.requestAnimationFrame(MainLoop.runner);
    };
  } else {
    if (!MainLoop.setImmediate) {
      if (globalThis.scheduler) {
        // Some modern browsers implement scheduler.postTask, but not all.
        MainLoop.setImmediate = scheduler.postTask.bind(scheduler);
      } else {
        // Emulate setImmediate. (note: not a complete polyfill, we don't emulate clearImmediate() to keep code size to minimum, since not needed)
        var setImmediates = [];
        var emscriptenMainLoopMessageId = "setimmediate";
        /** @param {Event} event */ var MainLoop_setImmediate_messageHandler = event => {
          if (event.data === emscriptenMainLoopMessageId) {
            event.stopPropagation();
            setImmediates.shift()();
          }
        };
        addEventListener("message", MainLoop_setImmediate_messageHandler, true);
        MainLoop.setImmediate = /** @type{function(function(): ?, ...?): number} */ (func => {
          setImmediates.push(func);
          if (ENVIRONMENT_IS_WORKER) {
            // The postMessge API in a Worker, sends message to the main
            // thread and does not support the `targetOrigin` (*) argument.
            postMessage(emscriptenMainLoopMessageId);
          } else {
            postMessage(emscriptenMainLoopMessageId, "*");
          }
        });
      }
    }
    MainLoop.scheduler = function MainLoop_scheduler_setImmediate() {
      MainLoop.setImmediate(MainLoop.runner);
    };
  }
  return 0;
};

var runtimeKeepalivePop = () => {
  runtimeKeepaliveCounter -= 1;
};

/**
   * @param {number=} arg
   * @param {boolean=} noSetTiming
   */ var setMainLoop = (iterFunc, fps, simulateInfiniteLoop, arg, noSetTiming) => {
  MainLoop.func = iterFunc;
  MainLoop.arg = arg;
  var thisMainLoopId = MainLoop.currentlyRunningMainloop;
  function checkIsRunning() {
    if (thisMainLoopId < MainLoop.currentlyRunningMainloop) {
      runtimeKeepalivePop();
      maybeExit();
      return false;
    }
    return true;
  }
  // We create the loop runner here but it is not actually running until
  // _emscripten_set_main_loop_timing is called (which might happen at a
  // later time).  This member signifies that the current runner has not
  // yet been started so that we can call runtimeKeepalivePush when it
  // gets its timing set for the first time.
  MainLoop.running = false;
  MainLoop.runner = function MainLoop_runner() {
    if (ABORT) return;
    if (MainLoop.queue.length > 0) {
      var start = Date.now();
      var blocker = MainLoop.queue.shift();
      blocker.func(blocker.arg);
      if (MainLoop.remainingBlockers) {
        var remaining = MainLoop.remainingBlockers;
        var next = remaining % 1 == 0 ? remaining - 1 : Math.floor(remaining);
        if (blocker.counted) {
          MainLoop.remainingBlockers = next;
        } else {
          // not counted, but move the progress along a tiny bit
          next = next + .5;
          // do not steal all the next one's progress
          MainLoop.remainingBlockers = (8 * remaining + next) / 9;
        }
      }
      MainLoop.updateStatus();
      // catches pause/resume main loop from blocker execution
      if (!checkIsRunning()) return;
      setTimeout(MainLoop.runner, 0);
      return;
    }
    // catch pauses from non-main loop sources
    if (!checkIsRunning()) return;
    // Implement very basic swap interval control
    MainLoop.currentFrameNumber = MainLoop.currentFrameNumber + 1 | 0;
    if (MainLoop.timingMode == 1 && MainLoop.timingValue > 1 && MainLoop.currentFrameNumber % MainLoop.timingValue != 0) {
      // Not the scheduled time to render this frame - skip.
      MainLoop.scheduler();
      return;
    } else if (MainLoop.timingMode == 0) {
      MainLoop.tickStartTime = _emscripten_get_now();
    }
    MainLoop.runIter(iterFunc);
    // catch pauses from the main loop itself
    if (!checkIsRunning()) return;
    MainLoop.scheduler();
  };
  if (!noSetTiming) {
    if (fps > 0) {
      _emscripten_set_main_loop_timing(0, 1e3 / fps);
    } else {
      // Do rAF by rendering each frame (no decimating)
      _emscripten_set_main_loop_timing(1, 1);
    }
    MainLoop.scheduler();
  }
  if (simulateInfiniteLoop) {
    throw "unwind";
  }
};

var MainLoop = {
  running: false,
  scheduler: null,
  currentlyRunningMainloop: 0,
  func: null,
  arg: 0,
  timingMode: 0,
  timingValue: 0,
  currentFrameNumber: 0,
  queue: [],
  preMainLoop: [],
  postMainLoop: [],
  pause() {
    MainLoop.scheduler = null;
    // Incrementing this signals the previous main loop that it's now become old, and it must return.
    MainLoop.currentlyRunningMainloop++;
  },
  resume() {
    MainLoop.currentlyRunningMainloop++;
    var timingMode = MainLoop.timingMode;
    var timingValue = MainLoop.timingValue;
    var func = MainLoop.func;
    MainLoop.func = null;
    // do not set timing and call scheduler, we will do it on the next lines
    setMainLoop(func, 0, false, MainLoop.arg, true);
    _emscripten_set_main_loop_timing(timingMode, timingValue);
    MainLoop.scheduler();
  },
  updateStatus() {
    if (Module["setStatus"]) {
      var message = Module["statusMessage"] || "Please wait...";
      var remaining = MainLoop.remainingBlockers ?? 0;
      var expected = MainLoop.expectedBlockers ?? 0;
      if (remaining) {
        if (remaining < expected) {
          Module["setStatus"](`{message} ({expected - remaining}/{expected})`);
        } else {
          Module["setStatus"](message);
        }
      } else {
        Module["setStatus"]("");
      }
    }
  },
  init() {},
  runIter(func) {
    if (ABORT) return;
    for (var pre of MainLoop.preMainLoop) {
      if (pre() === false) {
        return;
      }
    }
    callUserCallback(func);
    for (var post of MainLoop.postMainLoop) {
      post();
    }
  },
  nextRAF: 0,
  fakeRequestAnimationFrame(func) {
    // try to keep 60fps between calls to here
    var now = Date.now();
    if (MainLoop.nextRAF === 0) {
      MainLoop.nextRAF = now + 1e3 / 60;
    } else {
      while (now + 2 >= MainLoop.nextRAF) {
        // fudge a little, to avoid timer jitter causing us to do lots of delay:0
        MainLoop.nextRAF += 1e3 / 60;
      }
    }
    var delay = Math.max(MainLoop.nextRAF - now, 0);
    setTimeout(func, delay);
  },
  requestAnimationFrame(func) {
    if (globalThis.requestAnimationFrame) {
      requestAnimationFrame(func);
    } else {
      MainLoop.fakeRequestAnimationFrame(func);
    }
  }
};

var _emscripten_cancel_main_loop = () => {
  MainLoop.pause();
  MainLoop.func = null;
};

var _emscripten_check_blocking_allowed = () => {};

function _emscripten_console_error(str) {
  str >>>= 0;
  console.error(UTF8ToString(str));
}

function _emscripten_console_log(str) {
  str >>>= 0;
  console.log(UTF8ToString(str));
}

function _emscripten_err(str) {
  str >>>= 0;
  return err(UTF8ToString(str));
}

var onExits = [];

var addOnExit = cb => onExits.push(cb);

var JSEvents = {
  removeAllEventListeners() {
    while (JSEvents.eventHandlers.length) {
      JSEvents._removeHandler(JSEvents.eventHandlers.length - 1);
    }
    JSEvents.deferredCalls = [];
  },
  registerRemoveEventListeners() {
    if (!JSEvents.removeEventListenersRegistered) {
      addOnExit(JSEvents.removeAllEventListeners);
      JSEvents.removeEventListenersRegistered = true;
    }
  },
  inEventHandler: 0,
  deferredCalls: [],
  deferCall(targetFunction, precedence, argsList) {
    function arraysHaveEqualContent(arrA, arrB) {
      if (arrA.length != arrB.length) return false;
      for (var i in arrA) {
        if (arrA[i] != arrB[i]) return false;
      }
      return true;
    }
    // Test if the given call was already queued, and if so, don't add it again.
    for (var call of JSEvents.deferredCalls) {
      if (call.targetFunction == targetFunction && arraysHaveEqualContent(call.argsList, argsList)) {
        return;
      }
    }
    JSEvents.deferredCalls.push({
      targetFunction,
      precedence,
      argsList
    });
    JSEvents.deferredCalls.sort((x, y) => x.precedence - y.precedence);
  },
  removeDeferredCalls(targetFunction) {
    JSEvents.deferredCalls = JSEvents.deferredCalls.filter(call => call.targetFunction != targetFunction);
  },
  canPerformEventHandlerRequests() {
    // Browsers that support navigator.userActivation.isActive: https://developer.mozilla.org/en-US/docs/Web/API/UserActivation/isActive
    // We are targeting modern browsers where navigator.userActivation.isActive is unconditionally supported.
    return navigator.userActivation.isActive;
  },
  runDeferredCalls() {
    if (!JSEvents.canPerformEventHandlerRequests()) {
      return;
    }
    var deferredCalls = JSEvents.deferredCalls;
    JSEvents.deferredCalls = [];
    for (var call of deferredCalls) {
      call.targetFunction(...call.argsList);
    }
  },
  eventHandlers: [],
  removeAllHandlersOnTarget: (target, eventTypeString) => {
    for (var i = 0; i < JSEvents.eventHandlers.length; ++i) {
      if (JSEvents.eventHandlers[i].target == target && (!eventTypeString || eventTypeString == JSEvents.eventHandlers[i].eventTypeString)) {
        JSEvents._removeHandler(i--);
      }
    }
  },
  _removeHandler(i) {
    var h = JSEvents.eventHandlers[i];
    h.target.removeEventListener(h.eventTypeString, h.eventListenerFunc, h.useCapture);
    JSEvents.eventHandlers.splice(i, 1);
  },
  registerOrRemoveHandler(eventHandler) {
    if (!eventHandler.target) {
      return -4;
    }
    if (eventHandler.callbackfunc) {
      eventHandler.eventListenerFunc = function(event) {
        // Increment nesting count for the event handler.
        ++JSEvents.inEventHandler;
        JSEvents.currentEventHandler = eventHandler;
        // Process any old deferred calls the user has placed.
        JSEvents.runDeferredCalls();
        // Process the actual event, calls back to user C code handler.
        eventHandler.handlerFunc(event);
        // Process any new deferred calls that were placed right now from this event handler.
        JSEvents.runDeferredCalls();
        // Out of event handler - restore nesting count.
        --JSEvents.inEventHandler;
      };
      eventHandler.target.addEventListener(eventHandler.eventTypeString, eventHandler.eventListenerFunc, eventHandler.useCapture);
      JSEvents.eventHandlers.push(eventHandler);
      JSEvents.registerRemoveEventListeners();
    } else {
      for (var i = 0; i < JSEvents.eventHandlers.length; ++i) {
        if (JSEvents.eventHandlers[i].target == eventHandler.target && JSEvents.eventHandlers[i].eventTypeString == eventHandler.eventTypeString) {
          JSEvents._removeHandler(i--);
        }
      }
    }
    return 0;
  },
  removeSingleHandler(eventHandler) {
    let success = false;
    for (let i = 0; i < JSEvents.eventHandlers.length; ++i) {
      const handler = JSEvents.eventHandlers[i];
      if (handler.target === eventHandler.target && handler.eventTypeId === eventHandler.eventTypeId && handler.callbackfunc === eventHandler.callbackfunc && handler.userData === eventHandler.userData) {
        // in some very rare cases (ex: Safari / fullscreen events), there is more than 1 handler (eventTypeString is different)
        JSEvents._removeHandler(i--);
        success = true;
      }
    }
    return success ? 0 : -5;
  },
  getTargetThreadForEventCallback(targetThread) {
    switch (targetThread) {
     case 1:
      // The event callback for the current event should be called on the
      // main browser thread. (0 == don't proxy)
      return 0;

     case 2:
      // The event callback for the current event should be backproxied to
      // the thread that is registering the event.
      // This can be 0 in the case that the caller uses
      // EM_CALLBACK_THREAD_CONTEXT_CALLING_THREAD but on the main thread
      // itself.
      return PThread.currentProxiedOperationCallerThread;

     default:
      // The event callback for the current event should be proxied to the
      // given specific thread.
      return targetThread;
    }
  },
  getNodeNameForTarget(target) {
    if (target == window) return "#window";
    if (target == screen) return "#screen";
    return target?.nodeName ?? "";
  },
  fullscreenEnabled() {
    return document.fullscreenEnabled;
  }
};

/** @type {Object} */ var specialHTMLTargets = [ 0, globalThis.document ?? 0, globalThis.window ?? 0 ];

var GLctx;

var webgl_enable_ANGLE_instanced_arrays = ctx => {
  // Extension available in WebGL 1 from Firefox 26 and Google Chrome 30 onwards. Core feature in WebGL 2.
  var ext = ctx.getExtension("ANGLE_instanced_arrays");
  // Because this extension is a core function in WebGL 2, assign the extension entry points in place of
  // where the core functions will reside in WebGL 2. This way the calling code can call these without
  // having to dynamically branch depending if running against WebGL 1 or WebGL 2.
  if (ext) {
    ctx["vertexAttribDivisor"] = (index, divisor) => ext["vertexAttribDivisorANGLE"](index, divisor);
    ctx["drawArraysInstanced"] = (mode, first, count, primcount) => ext["drawArraysInstancedANGLE"](mode, first, count, primcount);
    ctx["drawElementsInstanced"] = (mode, count, type, indices, primcount) => ext["drawElementsInstancedANGLE"](mode, count, type, indices, primcount);
    return 1;
  }
};

var webgl_enable_OES_vertex_array_object = ctx => {
  // Extension available in WebGL 1 from Firefox 25 and WebKit 536.28/desktop Safari 6.0.3 onwards. Core feature in WebGL 2.
  var ext = ctx.getExtension("OES_vertex_array_object");
  if (ext) {
    ctx["createVertexArray"] = () => ext["createVertexArrayOES"]();
    ctx["deleteVertexArray"] = vao => ext["deleteVertexArrayOES"](vao);
    ctx["bindVertexArray"] = vao => ext["bindVertexArrayOES"](vao);
    ctx["isVertexArray"] = vao => ext["isVertexArrayOES"](vao);
    return 1;
  }
};

var webgl_enable_WEBGL_draw_buffers = ctx => {
  // Extension available in WebGL 1 from Firefox 28 onwards. Core feature in WebGL 2.
  var ext = ctx.getExtension("WEBGL_draw_buffers");
  if (ext) {
    ctx["drawBuffers"] = (n, bufs) => ext["drawBuffersWEBGL"](n, bufs);
    return 1;
  }
};

var webgl_enable_EXT_polygon_offset_clamp = ctx => !!(ctx.extPolygonOffsetClamp = ctx.getExtension("EXT_polygon_offset_clamp"));

var webgl_enable_EXT_clip_control = ctx => !!(ctx.extClipControl = ctx.getExtension("EXT_clip_control"));

var webgl_enable_WEBGL_polygon_mode = ctx => !!(ctx.webglPolygonMode = ctx.getExtension("WEBGL_polygon_mode"));

var webgl_enable_WEBGL_multi_draw = ctx => // Closure is expected to be allowed to minify the '.multiDrawWebgl' property, so not accessing it quoted.
!!(ctx.multiDrawWebgl = ctx.getExtension("WEBGL_multi_draw"));

var getEmscriptenSupportedExtensions = ctx => {
  // Restrict the list of advertised extensions to those that we actually
  // support.
  var supportedExtensions = [ // WebGL 1 extensions
  "ANGLE_instanced_arrays", "EXT_blend_minmax", "EXT_disjoint_timer_query", "EXT_frag_depth", "EXT_shader_texture_lod", "EXT_sRGB", "OES_element_index_uint", "OES_fbo_render_mipmap", "OES_standard_derivatives", "OES_texture_float", "OES_texture_half_float", "OES_texture_half_float_linear", "OES_vertex_array_object", "WEBGL_color_buffer_float", "WEBGL_depth_texture", "WEBGL_draw_buffers", // WebGL 1 and WebGL 2 extensions
  "EXT_clip_control", "EXT_color_buffer_half_float", "EXT_depth_clamp", "EXT_float_blend", "EXT_polygon_offset_clamp", "EXT_texture_compression_bptc", "EXT_texture_compression_rgtc", "EXT_texture_filter_anisotropic", "KHR_parallel_shader_compile", "OES_texture_float_linear", "WEBGL_blend_func_extended", "WEBGL_compressed_texture_astc", "WEBGL_compressed_texture_etc", "WEBGL_compressed_texture_etc1", "WEBGL_compressed_texture_s3tc", "WEBGL_compressed_texture_s3tc_srgb", "WEBGL_debug_renderer_info", "WEBGL_debug_shaders", "WEBGL_lose_context", "WEBGL_multi_draw", "WEBGL_polygon_mode" ];
  // .getSupportedExtensions() can return null if context is lost, so coerce to empty array.
  return ctx.getSupportedExtensions()?.filter(ext => supportedExtensions.includes(ext)) ?? [];
};

var GL = {
  counter: 1,
  buffers: [],
  programs: [],
  framebuffers: [],
  renderbuffers: [],
  textures: [],
  shaders: [],
  vaos: [],
  contexts: {},
  offscreenCanvases: {},
  queries: [],
  stringCache: {},
  unpackAlignment: 4,
  unpackRowLength: 0,
  recordError: errorCode => {
    if (!GL.lastError) {
      GL.lastError = errorCode;
    }
  },
  getNewId: table => {
    var ret = GL.counter++;
    for (var i = table.length; i < ret; i++) {
      table[i] = null;
    }
    return ret;
  },
  genObject: (n, buffers, createFunction, objectTable) => {
    for (var i = 0; i < n; i++) {
      var buffer = GLctx[createFunction]();
      var id = buffer && GL.getNewId(objectTable);
      if (buffer) {
        buffer.name = id;
        objectTable[id] = buffer;
      } else {
        GL.recordError(1282);
      }
      (growMemViews(), HEAP32)[(((buffers) + (i * 4)) >>> 2) >>> 0] = id;
    }
  },
  getSource: (shader, count, string, length) => {
    var source = "";
    for (var i = 0; i < count; ++i) {
      var len = length ? (growMemViews(), HEAPU32)[(((length) + (i * 4)) >>> 2) >>> 0] : undefined;
      source += UTF8ToString((growMemViews(), HEAPU32)[(((string) + (i * 4)) >>> 2) >>> 0], len);
    }
    return source;
  },
  createContext: (/** @type {HTMLCanvasElement} */ canvas, webGLContextAttributes) => {
    var ctx = canvas.getContext("webgl", webGLContextAttributes);
    if (!ctx) return 0;
    var handle = GL.registerContext(ctx, webGLContextAttributes);
    return handle;
  },
  registerContext: (ctx, webGLContextAttributes) => {
    // with pthreads a context is a location in memory with some synchronized
    // data between threads
    var handle = _malloc(8);
    (growMemViews(), HEAPU32)[(((handle) + (4)) >>> 2) >>> 0] = _pthread_self();
    // the thread pointer of the thread that owns the control of the context
    var context = {
      handle,
      attributes: webGLContextAttributes,
      version: webGLContextAttributes.majorVersion,
      GLctx: ctx
    };
    // Store the created context object so that we can access the context
    // given a canvas without having to pass the parameters again.
    if (ctx.canvas) ctx.canvas.GLctxObject = context;
    GL.contexts[handle] = context;
    if (typeof webGLContextAttributes.enableExtensionsByDefault == "undefined" || webGLContextAttributes.enableExtensionsByDefault) {
      GL.initExtensions(context);
    }
    return handle;
  },
  makeContextCurrent: contextHandle => {
    // Active Emscripten GL layer context object.
    GL.currentContext = GL.contexts[contextHandle];
    // Active WebGL context object.
    Module["ctx"] = GLctx = GL.currentContext?.GLctx;
    return !(contextHandle && !GLctx);
  },
  getContext: contextHandle => GL.contexts[contextHandle],
  deleteContext: contextHandle => {
    if (GL.currentContext === GL.contexts[contextHandle]) {
      GL.currentContext = null;
    }
    if (typeof JSEvents == "object") {
      // Release all JS event handlers on the DOM element that the GL context is
      // associated with since the context is now deleted.
      JSEvents.removeAllHandlersOnTarget(GL.contexts[contextHandle].GLctx.canvas);
    }
    // Make sure the canvas object no longer refers to the context object so
    // there are no GC surprises.
    if (GL.contexts[contextHandle]?.GLctx.canvas) {
      GL.contexts[contextHandle].GLctx.canvas.GLctxObject = undefined;
    }
    _free(GL.contexts[contextHandle].handle);
    GL.contexts[contextHandle] = null;
  },
  initExtensions: context => {
    // If this function is called without a specific context object, init the
    // extensions of the currently active context.
    context ||= GL.currentContext;
    if (context.initExtensionsDone) return;
    context.initExtensionsDone = true;
    var GLctx = context.GLctx;
    // Detect the presence of a few extensions manually, since the GL interop
    // layer itself will need to know if they exist.
    // Extensions that are available in both WebGL 1 and WebGL 2
    webgl_enable_WEBGL_multi_draw(GLctx);
    webgl_enable_EXT_polygon_offset_clamp(GLctx);
    webgl_enable_EXT_clip_control(GLctx);
    webgl_enable_WEBGL_polygon_mode(GLctx);
    // Extensions that are only available in WebGL 1 (the calls will be no-ops
    // if called on a WebGL 2 context active)
    webgl_enable_ANGLE_instanced_arrays(GLctx);
    webgl_enable_OES_vertex_array_object(GLctx);
    webgl_enable_WEBGL_draw_buffers(GLctx);
    {
      GLctx.disjointTimerQueryExt = GLctx.getExtension("EXT_disjoint_timer_query");
    }
    for (var ext of getEmscriptenSupportedExtensions(GLctx)) {
      // WEBGL_lose_context, WEBGL_debug_renderer_info and WEBGL_debug_shaders
      // are not enabled by default.
      if (!ext.includes("lose_context") && !ext.includes("debug")) {
        // Call .getExtension() to enable that extension permanently.
        GLctx.getExtension(ext);
      }
    }
  }
};

var maybeCStringToJsString = cString => cString > 2 ? UTF8ToString(cString) : cString;

var findCanvasEventTarget = target => {
  target = maybeCStringToJsString(target);
  // When compiling with OffscreenCanvas support and looking up a canvas to target,
  // we first look up if the target Canvas has been transferred to OffscreenCanvas use.
  // These transfers are represented/tracked by GL.offscreenCanvases object, which contain
  // the OffscreenCanvas element for each regular Canvas element that has been transferred.
  // Note that each pthread/worker have their own set of GL.offscreenCanvases. That is,
  // when an OffscreenCanvas is transferred from a pthread/main thread to another pthread,
  // it will move in the GL.offscreenCanvases array between threads. Hence GL.offscreenCanvases
  // represents the set of OffscreenCanvases owned by the current calling thread.
  // First check out the list of OffscreenCanvases by CSS selector ID ('#myCanvasID')
  return GL.offscreenCanvases[target.slice(1)] || (target == "canvas" && Object.values(GL.offscreenCanvases)[0]) || specialHTMLTargets[target] || globalThis.document?.querySelector(target);
};

var getCanvasSizeCallingThread = (target, width, height) => {
  var canvas = findCanvasEventTarget(target);
  if (!canvas) return -4;
  if (canvas.canvasSharedPtr) {
    // N.B. Reading the size of the Canvas takes priority from our shared state structure, which is not the actual size.
    // However if is possible that there is a canvas size set event pending on an OffscreenCanvas owned by another thread,
    // so that the real sizes of the canvas have not updated yet. Therefore reading the real values would be racy.
    var w = (growMemViews(), HEAP32)[((canvas.canvasSharedPtr) >>> 2) >>> 0];
    var h = (growMemViews(), HEAP32)[(((canvas.canvasSharedPtr) + (4)) >>> 2) >>> 0];
    (growMemViews(), HEAP32)[((width) >>> 2) >>> 0] = w;
    (growMemViews(), HEAP32)[((height) >>> 2) >>> 0] = h;
  } else if (canvas.offscreenCanvas) {
    (growMemViews(), HEAP32)[((width) >>> 2) >>> 0] = canvas.offscreenCanvas.width;
    (growMemViews(), HEAP32)[((height) >>> 2) >>> 0] = canvas.offscreenCanvas.height;
  } else if (!canvas.controlTransferredOffscreen) {
    (growMemViews(), HEAP32)[((width) >>> 2) >>> 0] = canvas.width;
    (growMemViews(), HEAP32)[((height) >>> 2) >>> 0] = canvas.height;
  } else {
    return -4;
  }
  return 0;
};

function getCanvasSizeMainThread(target, width, height) {
  if (ENVIRONMENT_IS_PTHREAD) return proxyToMainThread(5, 0, 1, target, width, height);
  return getCanvasSizeCallingThread(target, width, height);
}

function _emscripten_get_canvas_element_size(target, width, height) {
  target >>>= 0;
  width >>>= 0;
  height >>>= 0;
  var canvas = findCanvasEventTarget(target);
  if (canvas) {
    return getCanvasSizeCallingThread(target, width, height);
  }
  return getCanvasSizeMainThread(target, width, height);
}

var stringToUTF8OnStack = str => {
  var size = lengthBytesUTF8(str) + 1;
  var ret = stackAlloc(size);
  stringToUTF8(str, ret, size);
  return ret;
};

var getCanvasElementSize = target => {
  var sp = stackSave();
  var w = stackAlloc(8);
  var h = w + 4;
  var targetInt = stringToUTF8OnStack(target.id);
  var ret = _emscripten_get_canvas_element_size(targetInt, w, h);
  var size = [ (growMemViews(), HEAP32)[((w) >>> 2) >>> 0], (growMemViews(), HEAP32)[((h) >>> 2) >>> 0] ];
  stackRestore(sp);
  return size;
};

var stringToNewUTF8 = str => {
  var size = lengthBytesUTF8(str) + 1;
  var ret = _malloc(size);
  if (ret) stringToUTF8(str, ret, size);
  return ret;
};

var setOffscreenCanvasSizeOnTargetThread = (targetThread, targetCanvas, width, height) => {
  targetCanvas = targetCanvas ? UTF8ToString(targetCanvas) : "";
  var targetCanvasPtr = 0;
  if (targetCanvas) {
    targetCanvasPtr = stringToNewUTF8(targetCanvas);
  }
  __emscripten_set_offscreencanvas_size_on_thread(targetThread, targetCanvasPtr, width, height);
};

var setCanvasElementSizeCallingThread = (target, width, height) => {
  var canvas = findCanvasEventTarget(target);
  if (!canvas) return -4;
  if (canvas.canvasSharedPtr) {
    // N.B. We hold the canvasSharedPtr info structure as the authoritative source for specifying the size of a canvas
    // since the actual canvas size changes are asynchronous if the canvas is owned by an OffscreenCanvas on another thread.
    // Therefore when setting the size, eagerly set the size of the canvas on the calling thread here, though this thread
    // might not be the one that actually ends up specifying the size, but the actual size change may be dispatched
    // as an asynchronous event below.
    (growMemViews(), HEAP32)[((canvas.canvasSharedPtr) >>> 2) >>> 0] = width;
    (growMemViews(), HEAP32)[(((canvas.canvasSharedPtr) + (4)) >>> 2) >>> 0] = height;
  }
  if (canvas.offscreenCanvas || !canvas.controlTransferredOffscreen) {
    if (canvas.offscreenCanvas) canvas = canvas.offscreenCanvas;
    var autoResizeViewport = false;
    if (canvas.GLctxObject?.GLctx) {
      var prevViewport = canvas.GLctxObject.GLctx.getParameter(2978);
      // TODO: Perhaps autoResizeViewport should only be true if FBO 0 is currently active?
      autoResizeViewport = (prevViewport[0] === 0 && prevViewport[1] === 0 && prevViewport[2] === canvas.width && prevViewport[3] === canvas.height);
    }
    canvas.width = width;
    canvas.height = height;
    if (autoResizeViewport) {
      // TODO: Add -sCANVAS_RESIZE_SETS_GL_VIEWPORT=0/1 option (default=1). This is commonly done and several graphics engines depend on this,
      // but this can be quite disruptive.
      canvas.GLctxObject.GLctx.viewport(0, 0, width, height);
    }
  } else if (canvas.canvasSharedPtr) {
    var targetThread = (growMemViews(), HEAPU32)[(((canvas.canvasSharedPtr) + (8)) >>> 2) >>> 0];
    setOffscreenCanvasSizeOnTargetThread(targetThread, target, width, height);
    return 1;
  } else {
    return -4;
  }
  return 0;
};

function setCanvasElementSizeMainThread(target, width, height) {
  if (ENVIRONMENT_IS_PTHREAD) return proxyToMainThread(6, 0, 1, target, width, height);
  return setCanvasElementSizeCallingThread(target, width, height);
}

function _emscripten_set_canvas_element_size(target, width, height) {
  target >>>= 0;
  var canvas = findCanvasEventTarget(target);
  if (canvas) {
    return setCanvasElementSizeCallingThread(target, width, height);
  }
  return setCanvasElementSizeMainThread(target, width, height);
}

var setCanvasElementSize = (target, width, height) => {
  if (!target.controlTransferredOffscreen) {
    target.width = width;
    target.height = height;
  } else {
    // This function is being called from high-level JavaScript code instead of asm.js/Wasm,
    // and it needs to synchronously proxy over to another thread, so marshal the string onto the heap to do the call.
    var sp = stackSave();
    var targetInt = stringToUTF8OnStack(target.id);
    _emscripten_set_canvas_element_size(targetInt, width, height);
    stackRestore(sp);
  }
};

var currentFullscreenStrategy = 0;

var callCanvasResizedCallback = strategy => {
  if (strategy.canvasResizedCallback) {
    if (strategy.canvasResizedCallbackTargetThread) __emscripten_run_callback_on_thread(strategy.canvasResizedCallbackTargetThread, strategy.canvasResizedCallback, 37, 0, 0, strategy.canvasResizedCallbackUserData); else getWasmTableEntry(strategy.canvasResizedCallback)(37, 0, strategy.canvasResizedCallbackUserData);
  }
};

var registerRestoreOldStyle = canvas => {
  var canvasSize = getCanvasElementSize(canvas);
  var oldWidth = canvasSize[0];
  var oldHeight = canvasSize[1];
  var oldCssWidth = canvas.style.width;
  var oldCssHeight = canvas.style.height;
  var oldBackgroundColor = canvas.style.backgroundColor;
  // Chrome reads color from here.
  var oldDocumentBackgroundColor = document.body.style.backgroundColor;
  // IE11 reads color from here.
  // Firefox always has black background color.
  var oldPaddingLeft = canvas.style.paddingLeft;
  // Chrome, FF, Safari
  var oldPaddingRight = canvas.style.paddingRight;
  var oldPaddingTop = canvas.style.paddingTop;
  var oldPaddingBottom = canvas.style.paddingBottom;
  var oldMarginLeft = canvas.style.marginLeft;
  // IE11
  var oldMarginRight = canvas.style.marginRight;
  var oldMarginTop = canvas.style.marginTop;
  var oldMarginBottom = canvas.style.marginBottom;
  var oldDocumentBodyMargin = document.body.style.margin;
  var oldDocumentOverflow = document.documentElement.style.overflow;
  // Chrome, Firefox
  var oldDocumentScroll = document.body.scroll;
  // IE
  var oldImageRendering = canvas.style.imageRendering;
  function restoreOldStyle() {
    if (!getFullscreenElement()) {
      document.removeEventListener("fullscreenchange", restoreOldStyle);
      setCanvasElementSize(canvas, oldWidth, oldHeight);
      canvas.style.width = oldCssWidth;
      canvas.style.height = oldCssHeight;
      canvas.style.backgroundColor = oldBackgroundColor;
      // Chrome
      // IE11 hack: assigning 'undefined' or an empty string to document.body.style.backgroundColor has no effect, so first assign back the default color
      // before setting the undefined value. Setting undefined value is also important, or otherwise we would later treat that as something that the user
      // had explicitly set so subsequent fullscreen transitions would not set background color properly.
      if (!oldDocumentBackgroundColor) document.body.style.backgroundColor = "white";
      document.body.style.backgroundColor = oldDocumentBackgroundColor;
      // IE11
      canvas.style.paddingLeft = oldPaddingLeft;
      // Chrome, FF, Safari
      canvas.style.paddingRight = oldPaddingRight;
      canvas.style.paddingTop = oldPaddingTop;
      canvas.style.paddingBottom = oldPaddingBottom;
      canvas.style.marginLeft = oldMarginLeft;
      // IE11
      canvas.style.marginRight = oldMarginRight;
      canvas.style.marginTop = oldMarginTop;
      canvas.style.marginBottom = oldMarginBottom;
      document.body.style.margin = oldDocumentBodyMargin;
      document.documentElement.style.overflow = oldDocumentOverflow;
      // Chrome, Firefox
      document.body.scroll = oldDocumentScroll;
      // IE
      canvas.style.imageRendering = oldImageRendering;
      if (canvas.GLctxObject) canvas.GLctxObject.GLctx.viewport(0, 0, oldWidth, oldHeight);
      callCanvasResizedCallback(currentFullscreenStrategy);
    }
  }
  document.addEventListener("fullscreenchange", restoreOldStyle);
  return restoreOldStyle;
};

var setLetterbox = (element, topBottom, leftRight) => {
  // Cannot use margin to specify letterboxes in FF or Chrome, since those ignore margins in fullscreen mode.
  element.style.paddingLeft = element.style.paddingRight = leftRight + "px";
  element.style.paddingTop = element.style.paddingBottom = topBottom + "px";
};

var getBoundingClientRect = e => specialHTMLTargets.indexOf(e) < 0 ? e.getBoundingClientRect() : {
  "left": 0,
  "top": 0
};

var JSEvents_resizeCanvasForFullscreen = (target, strategy) => {
  var restoreOldStyle = registerRestoreOldStyle(target);
  var cssWidth = strategy.softFullscreen ? innerWidth : screen.width;
  var cssHeight = strategy.softFullscreen ? innerHeight : screen.height;
  var rect = getBoundingClientRect(target);
  var windowedCssWidth = rect.width;
  var windowedCssHeight = rect.height;
  var canvasSize = getCanvasElementSize(target);
  var windowedRttWidth = canvasSize[0];
  var windowedRttHeight = canvasSize[1];
  if (strategy.scaleMode == 3) {
    setLetterbox(target, (cssHeight - windowedCssHeight) / 2, (cssWidth - windowedCssWidth) / 2);
    cssWidth = windowedCssWidth;
    cssHeight = windowedCssHeight;
  } else if (strategy.scaleMode == 2) {
    if (cssWidth * windowedRttHeight < windowedRttWidth * cssHeight) {
      var desiredCssHeight = windowedRttHeight * cssWidth / windowedRttWidth;
      setLetterbox(target, (cssHeight - desiredCssHeight) / 2, 0);
      cssHeight = desiredCssHeight;
    } else {
      var desiredCssWidth = windowedRttWidth * cssHeight / windowedRttHeight;
      setLetterbox(target, 0, (cssWidth - desiredCssWidth) / 2);
      cssWidth = desiredCssWidth;
    }
  }
  // If we are adding padding, must choose a background color or otherwise Chrome will give the
  // padding a default white color. Do it only if user has not customized their own background color.
  target.style.backgroundColor ||= "black";
  // IE11 does the same, but requires the color to be set in the document body.
  document.body.style.backgroundColor ||= "black";
  // IE11
  // Firefox always shows black letterboxes independent of style color.
  target.style.width = cssWidth + "px";
  target.style.height = cssHeight + "px";
  if (strategy.filteringMode == 1) {
    target.style.imageRendering = "optimizeSpeed";
    target.style.imageRendering = "-moz-crisp-edges";
    target.style.imageRendering = "-o-crisp-edges";
    target.style.imageRendering = "-webkit-optimize-contrast";
    target.style.imageRendering = "optimize-contrast";
    target.style.imageRendering = "crisp-edges";
    target.style.imageRendering = "pixelated";
  }
  var dpiScale = (strategy.canvasResolutionScaleMode == 2) ? devicePixelRatio : 1;
  if (strategy.canvasResolutionScaleMode != 0) {
    var newWidth = (cssWidth * dpiScale) | 0;
    var newHeight = (cssHeight * dpiScale) | 0;
    setCanvasElementSize(target, newWidth, newHeight);
    if (target.GLctxObject) target.GLctxObject.GLctx.viewport(0, 0, newWidth, newHeight);
  }
  return restoreOldStyle;
};

var JSEvents_requestFullscreen = (target, strategy) => {
  // EMSCRIPTEN_FULLSCREEN_SCALE_DEFAULT + EMSCRIPTEN_FULLSCREEN_CANVAS_SCALE_NONE is a mode where no extra logic is performed to the DOM elements.
  if (strategy.scaleMode != 0 || strategy.canvasResolutionScaleMode != 0) {
    JSEvents_resizeCanvasForFullscreen(target, strategy);
  }
  if (target.requestFullscreen) {
    target.requestFullscreen();
  } else {
    return JSEvents.fullscreenEnabled() ? -3 : -1;
  }
  currentFullscreenStrategy = strategy;
  callCanvasResizedCallback(strategy);
  return 0;
};

function _emscripten_exit_fullscreen() {
  if (ENVIRONMENT_IS_PTHREAD) return proxyToMainThread(4, 0, 1);
  if (!JSEvents.fullscreenEnabled()) return -1;
  // Make sure no queued up calls will fire after this.
  JSEvents.removeDeferredCalls(JSEvents_requestFullscreen);
  var d = specialHTMLTargets[1];
  if (d.exitFullscreen) {
    d.fullscreenElement && d.exitFullscreen();
  } else {
    return -1;
  }
  return 0;
}

var requestPointerLock = target => {
  if (target.requestPointerLock) {
    target.requestPointerLock();
  } else {
    // document.body is known to accept pointer lock, so use that to differentiate if the user passed a bad element,
    // or if the whole browser just doesn't support the feature.
    if (document.body.requestPointerLock) {
      return -3;
    }
    return -1;
  }
  return 0;
};

function _emscripten_exit_pointerlock() {
  if (ENVIRONMENT_IS_PTHREAD) return proxyToMainThread(7, 0, 1);
  // Make sure no queued up calls will fire after this.
  JSEvents.removeDeferredCalls(requestPointerLock);
  if (!document.exitPointerLock) return -1;
  document.exitPointerLock();
  return 0;
}

var _emscripten_exit_with_live_runtime = () => {
  runtimeKeepalivePush();
  throw "unwind";
};

function _emscripten_force_exit(status) {
  if (ENVIRONMENT_IS_PTHREAD) return proxyToMainThread(8, 0, 1, status);
  __emscripten_runtime_keepalive_clear();
  _exit(status);
}

function _emscripten_get_device_pixel_ratio() {
  if (ENVIRONMENT_IS_PTHREAD) return proxyToMainThread(9, 0, 1);
  return devicePixelRatio;
}

var findEventTarget = target => {
  target = maybeCStringToJsString(target);
  var domElement = specialHTMLTargets[target] || globalThis.document?.querySelector(target);
  return domElement;
};

function _emscripten_get_element_css_size(target, width, height) {
  if (ENVIRONMENT_IS_PTHREAD) return proxyToMainThread(10, 0, 1, target, width, height);
  target >>>= 0;
  width >>>= 0;
  height >>>= 0;
  target = findEventTarget(target);
  if (!target) return -4;
  var rect = getBoundingClientRect(target);
  (growMemViews(), HEAPF64)[((width) >>> 3) >>> 0] = rect.width;
  (growMemViews(), HEAPF64)[((height) >>> 3) >>> 0] = rect.height;
  return 0;
}

function getFullscreenElement() {
  return document.fullscreenElement || document.mozFullScreenElement || document.webkitFullscreenElement || document.webkitCurrentFullScreenElement || document.msFullscreenElement;
}

var fillFullscreenChangeEventData = eventStruct => {
  var fullscreenElement = getFullscreenElement();
  var isFullscreen = !!fullscreenElement;
  // Assigning a boolean to HEAP32 with expected type coercion.
  /** @suppress{checkTypes} */ (growMemViews(), HEAP8)[eventStruct >>> 0] = isFullscreen;
  (growMemViews(), HEAP8)[(eventStruct) + (1) >>> 0] = JSEvents.fullscreenEnabled();
  // If transitioning to fullscreen, report info about the element that is now fullscreen.
  // If transitioning to windowed mode, report info about the element that just was fullscreen.
  var reportedElement = isFullscreen ? fullscreenElement : JSEvents.previousFullscreenElement;
  var nodeName = JSEvents.getNodeNameForTarget(reportedElement);
  var id = reportedElement?.id ?? "";
  stringToUTF8(nodeName, eventStruct + 2, 128);
  stringToUTF8(id, eventStruct + 130, 128);
  (growMemViews(), HEAP32)[(((eventStruct) + (260)) >>> 2) >>> 0] = reportedElement?.clientWidth ?? 0;
  (growMemViews(), HEAP32)[(((eventStruct) + (264)) >>> 2) >>> 0] = reportedElement?.clientHeight ?? 0;
  (growMemViews(), HEAP32)[(((eventStruct) + (268)) >>> 2) >>> 0] = screen.width;
  (growMemViews(), HEAP32)[(((eventStruct) + (272)) >>> 2) >>> 0] = screen.height;
  if (isFullscreen) {
    JSEvents.previousFullscreenElement = fullscreenElement;
  }
};

function _emscripten_get_fullscreen_status(fullscreenStatus) {
  if (ENVIRONMENT_IS_PTHREAD) return proxyToMainThread(11, 0, 1, fullscreenStatus);
  fullscreenStatus >>>= 0;
  if (!JSEvents.fullscreenEnabled()) return -1;
  fillFullscreenChangeEventData(fullscreenStatus);
  return 0;
}

var fillGamepadEventData = (eventStruct, e) => {
  (growMemViews(), HEAPF64)[((eventStruct) >>> 3) >>> 0] = e.timestamp;
  for (var i = 0; i < e.axes.length; ++i) {
    (growMemViews(), HEAPF64)[(((eventStruct + i * 8) + (16)) >>> 3) >>> 0] = e.axes[i];
  }
  for (var i = 0; i < e.buttons.length; ++i) {
    if (typeof e.buttons[i] == "object") {
      (growMemViews(), HEAPF64)[(((eventStruct + i * 8) + (528)) >>> 3) >>> 0] = e.buttons[i].value;
    } else {
      (growMemViews(), HEAPF64)[(((eventStruct + i * 8) + (528)) >>> 3) >>> 0] = e.buttons[i];
    }
  }
  for (var i = 0; i < e.buttons.length; ++i) {
    if (typeof e.buttons[i] == "object") {
      (growMemViews(), HEAP8)[(eventStruct + i) + (1040) >>> 0] = e.buttons[i].pressed;
    } else {
      // Assigning a boolean to HEAP32, that's ok, but Closure would like to warn about it:
      /** @suppress {checkTypes} */ (growMemViews(), HEAP8)[(eventStruct + i) + (1040) >>> 0] = e.buttons[i] == 1;
    }
  }
  (growMemViews(), HEAP8)[(eventStruct) + (1104) >>> 0] = e.connected;
  (growMemViews(), HEAP32)[(((eventStruct) + (1108)) >>> 2) >>> 0] = e.index;
  (growMemViews(), HEAP32)[(((eventStruct) + (8)) >>> 2) >>> 0] = e.axes.length;
  (growMemViews(), HEAP32)[(((eventStruct) + (12)) >>> 2) >>> 0] = e.buttons.length;
  stringToUTF8(e.id, eventStruct + 1112, 64);
  stringToUTF8(e.mapping, eventStruct + 1176, 64);
};

function _emscripten_get_gamepad_status(index, gamepadState) {
  if (ENVIRONMENT_IS_PTHREAD) return proxyToMainThread(12, 0, 1, index, gamepadState);
  gamepadState >>>= 0;
  // INVALID_PARAM is returned on a Gamepad index that never was there.
  if (index < 0 || index >= JSEvents.lastGamepadState.length) return -5;
  // NO_DATA is returned on a Gamepad index that was removed.
  // For previously disconnected gamepads there should be an empty slot (null/undefined/false) at the index.
  // This is because gamepads must keep their original position in the array.
  // For example, removing the first of two gamepads produces [null/undefined/false, gamepad].
  if (!JSEvents.lastGamepadState[index]) return -7;
  fillGamepadEventData(gamepadState, JSEvents.lastGamepadState[index]);
  return 0;
}

var getHeapMax = () => // Stay one Wasm page short of 4GB: while e.g. Chrome is able to allocate
// full 4GB Wasm memories, the size will wrap back to 0 bytes in Wasm side
// for any code that deals with heap sizes, which would require special
// casing all heap size related code to treat 0 specially.
4294901760;

function _emscripten_get_heap_max() {
  return getHeapMax();
}

function _emscripten_get_main_loop_timing(mode, value) {
  mode >>>= 0;
  value >>>= 0;
  if (mode) (growMemViews(), HEAP32)[((mode) >>> 2) >>> 0] = MainLoop.timingMode;
  if (value) (growMemViews(), HEAP32)[((value) >>> 2) >>> 0] = MainLoop.timingValue;
}

function _emscripten_get_num_gamepads() {
  if (ENVIRONMENT_IS_PTHREAD) return proxyToMainThread(13, 0, 1);
  // N.B. Do not call emscripten_get_num_gamepads() unless having first called emscripten_sample_gamepad_data(), and that has returned EMSCRIPTEN_RESULT_SUCCESS.
  // Otherwise the following line will throw an exception.
  return JSEvents.lastGamepadState.length;
}

/** @param {number=} timeout */ var safeSetTimeout = (func, timeout) => {
  runtimeKeepalivePush();
  return setTimeout(() => {
    runtimeKeepalivePop();
    callUserCallback(func);
  }, timeout);
};

var warnOnce = text => {
  warnOnce.shown ||= {};
  if (!warnOnce.shown[text]) {
    warnOnce.shown[text] = 1;
    err(text);
  }
};

var preloadPlugins = [];

var Browser = {
  useWebGL: false,
  isFullscreen: false,
  pointerLock: false,
  moduleContextCreatedCallbacks: [],
  preloadedImages: {},
  preloadedAudios: {},
  getCanvas: () => Module["canvas"],
  init() {
    if (Browser.initted) return;
    Browser.initted = true;
    // Support for plugins that can process preloaded files. You can add more of these to
    // your app by creating and appending to preloadPlugins.
    // Each plugin is asked if it can handle a file based on the file's name. If it can,
    // it is given the file's raw data. When it is done, it calls a callback with the file's
    // (possibly modified) data. For example, a plugin might decompress a file, or it
    // might create some side data structure for use later (like an Image element, etc.).
    var imagePlugin = {};
    imagePlugin["canHandle"] = name => !Module["noImageDecoding"] && /\.(jpg|jpeg|png|bmp|webp)$/i.test(name);
    imagePlugin["handle"] = async (byteArray, name) => {
      var b = new Blob([ byteArray ], {
        type: Browser.getMimetype(name)
      });
      if (b.size !== byteArray.length) {
        // Safari bug #118630
        // Safari's Blob can only take an ArrayBuffer
        b = new Blob([ (new Uint8Array(byteArray)).buffer ], {
          type: Browser.getMimetype(name)
        });
      }
      var url = URL.createObjectURL(b);
      return new Promise((resolve, reject) => {
        var img = new Image;
        img.onload = () => {
          var canvas = /** @type {!HTMLCanvasElement} */ (document.createElement("canvas"));
          canvas.width = img.width;
          canvas.height = img.height;
          var ctx = canvas.getContext("2d");
          ctx.drawImage(img, 0, 0);
          Browser.preloadedImages[name] = canvas;
          URL.revokeObjectURL(url);
          resolve(byteArray);
        };
        img.onerror = event => {
          err(`Image ${url} could not be decoded`);
          reject();
        };
        img.src = url;
      });
    };
    preloadPlugins.push(imagePlugin);
    var audioPlugin = {};
    audioPlugin["canHandle"] = name => !Module["noAudioDecoding"] && name.slice(-4) in {
      ".ogg": 1,
      ".wav": 1,
      ".mp3": 1
    };
    audioPlugin["handle"] = async (byteArray, name) => new Promise((resolve, reject) => {
      var done = false;
      function finish(audio) {
        if (done) return;
        done = true;
        Browser.preloadedAudios[name] = audio;
        resolve(byteArray);
      }
      var b = new Blob([ byteArray ], {
        type: Browser.getMimetype(name)
      });
      var url = URL.createObjectURL(b);
      // XXX we never revoke this!
      var audio = new Audio;
      audio.addEventListener("canplaythrough", () => finish(audio));
      // use addEventListener due to chromium bug 124926
      audio.onerror = event => {
        if (done) return;
        err(`warning: browser could not fully decode audio ${name}, trying slower base64 approach`);
        function encode64(data) {
          var BASE = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
          var PAD = "=";
          var ret = "";
          var leftchar = 0;
          var leftbits = 0;
          for (var i = 0; i < data.length; i++) {
            leftchar = (leftchar << 8) | data[i];
            leftbits += 8;
            while (leftbits >= 6) {
              var curr = (leftchar >> (leftbits - 6)) & 63;
              leftbits -= 6;
              ret += BASE[curr];
            }
          }
          if (leftbits == 2) {
            ret += BASE[(leftchar & 3) << 4];
            ret += PAD + PAD;
          } else if (leftbits == 4) {
            ret += BASE[(leftchar & 15) << 2];
            ret += PAD;
          }
          return ret;
        }
        audio.src = "data:audio/x-" + name.slice(-3) + ";base64," + encode64(byteArray);
        finish(audio);
      };
      audio.src = url;
      // workaround for chrome bug 124926 - we do not always get oncanplaythrough or onerror
      safeSetTimeout(() => {
        finish(audio);
      }, 1e4);
    });
    preloadPlugins.push(audioPlugin);
    // Canvas event setup
    function pointerLockChange() {
      var canvas = Browser.getCanvas();
      Browser.pointerLock = document.pointerLockElement === canvas;
    }
    var canvas = Browser.getCanvas();
    if (canvas) {
      // forced aspect ratio can be enabled by defining 'forcedAspectRatio' on Module
      // Module['forcedAspectRatio'] = 4 / 3;
      document.addEventListener("pointerlockchange", pointerLockChange);
      if (Module["elementPointerLock"]) {
        canvas.addEventListener("click", ev => {
          if (!Browser.pointerLock && Browser.getCanvas().requestPointerLock) {
            Browser.getCanvas().requestPointerLock();
            ev.preventDefault();
          }
        });
      }
    }
  },
  createContext(/** @type {HTMLCanvasElement} */ canvas, useWebGL, setInModule, webGLContextAttributes) {
    if (useWebGL && Module["ctx"] && canvas == Browser.getCanvas()) return Module["ctx"];
    // no need to recreate GL context if it's already been created for this canvas.
    var ctx;
    var contextHandle;
    if (useWebGL) {
      // For GLES2/desktop GL compatibility, adjust a few defaults to be different to WebGL defaults, so that they align better with the desktop defaults.
      var contextAttributes = {
        antialias: false,
        alpha: false,
        majorVersion: 1
      };
      if (webGLContextAttributes) {
        for (var attribute in webGLContextAttributes) {
          contextAttributes[attribute] = webGLContextAttributes[attribute];
        }
      }
      // This check of existence of GL is here to satisfy Closure compiler, which yells if variable GL is referenced below but GL object is not
      // actually compiled in because application is not doing any GL operations. TODO: Ideally if GL is not being used, this function
      // Browser.createContext() should not even be emitted.
      if (typeof GL != "undefined") {
        contextHandle = GL.createContext(canvas, contextAttributes);
        if (contextHandle) {
          ctx = GL.getContext(contextHandle).GLctx;
        }
      }
    } else {
      ctx = canvas.getContext("2d");
    }
    if (!ctx) return null;
    if (setInModule) {
      Module["ctx"] = ctx;
      if (useWebGL) GL.makeContextCurrent(contextHandle);
      Browser.useWebGL = useWebGL;
      Browser.moduleContextCreatedCallbacks.forEach(callback => callback());
      Browser.init();
    }
    return ctx;
  },
  fullscreenHandlersInstalled: false,
  lockPointer: undefined,
  resizeCanvas: undefined,
  requestFullscreen(lockPointer, resizeCanvas) {
    Browser.lockPointer = lockPointer;
    Browser.resizeCanvas = resizeCanvas;
    if (typeof Browser.lockPointer == "undefined") Browser.lockPointer = true;
    if (typeof Browser.resizeCanvas == "undefined") Browser.resizeCanvas = false;
    var canvas = Browser.getCanvas();
    function fullscreenChange() {
      Browser.isFullscreen = false;
      var canvasContainer = canvas.parentNode;
      if (getFullscreenElement() === canvasContainer) {
        canvas.exitFullscreen = Browser.exitFullscreen;
        if (Browser.lockPointer) canvas.requestPointerLock();
        Browser.isFullscreen = true;
        if (Browser.resizeCanvas) {
          Browser.setFullscreenCanvasSize();
        } else {
          Browser.updateCanvasDimensions(canvas);
        }
      } else {
        // remove the full screen specific parent of the canvas again to restore the HTML structure from before going full screen
        canvasContainer.parentNode.insertBefore(canvas, canvasContainer);
        canvasContainer.parentNode.removeChild(canvasContainer);
        if (Browser.resizeCanvas) {
          Browser.setWindowedCanvasSize();
        } else {
          Browser.updateCanvasDimensions(canvas);
        }
      }
    }
    if (!Browser.fullscreenHandlersInstalled) {
      Browser.fullscreenHandlersInstalled = true;
      document.addEventListener("fullscreenchange", fullscreenChange);
      document.addEventListener("mozfullscreenchange", fullscreenChange);
      document.addEventListener("webkitfullscreenchange", fullscreenChange);
      document.addEventListener("MSFullscreenChange", fullscreenChange);
    }
    // create a new parent to ensure the canvas has no siblings. this allows browsers to optimize full screen performance when its parent is the full screen root
    var canvasContainer = document.createElement("div");
    canvas.parentNode.insertBefore(canvasContainer, canvas);
    canvasContainer.appendChild(canvas);
    // use parent of canvas as full screen root to allow aspect ratio correction (Firefox stretches the root to screen size)
    canvasContainer.requestFullscreen = canvasContainer["requestFullscreen"] || canvasContainer["mozRequestFullScreen"] || canvasContainer["msRequestFullscreen"] || (canvasContainer["webkitRequestFullscreen"] ? () => canvasContainer["webkitRequestFullscreen"](Element["ALLOW_KEYBOARD_INPUT"]) : null) || (canvasContainer["webkitRequestFullScreen"] ? () => canvasContainer["webkitRequestFullScreen"](Element["ALLOW_KEYBOARD_INPUT"]) : null);
    canvasContainer.requestFullscreen();
  },
  exitFullscreen() {
    // This is workaround for chrome. Trying to exit from fullscreen
    // not in fullscreen state will cause "TypeError: Document not active"
    // in chrome. See https://github.com/emscripten-core/emscripten/pull/8236
    if (!Browser.isFullscreen) {
      return false;
    }
    var CFS = document["exitFullscreen"] || document["cancelFullScreen"] || document["mozCancelFullScreen"] || document["msExitFullscreen"] || document["webkitCancelFullScreen"] || (() => {});
    CFS.apply(document, []);
    return true;
  },
  safeSetTimeout(func, timeout) {
    // Legacy function, this is used by the SDL2 port so we need to keep it
    // around at least until that is updated.
    // See https://github.com/libsdl-org/SDL/pull/6304
    return safeSetTimeout(func, timeout);
  },
  getMimetype(name) {
    return {
      "jpg": "image/jpeg",
      "jpeg": "image/jpeg",
      "png": "image/png",
      "bmp": "image/bmp",
      "ogg": "audio/ogg",
      "wav": "audio/wav",
      "mp3": "audio/mpeg"
    }[name.slice(name.lastIndexOf(".") + 1)];
  },
  getUserMedia(func) {
    window.getUserMedia ||= navigator["getUserMedia"] || navigator["mozGetUserMedia"];
    window.getUserMedia(func);
  },
  getMovementX(event) {
    return event["movementX"] || event["mozMovementX"] || event["webkitMovementX"] || 0;
  },
  getMovementY(event) {
    return event["movementY"] || event["mozMovementY"] || event["webkitMovementY"] || 0;
  },
  getMouseWheelDelta(event) {
    var delta = 0;
    switch (event.type) {
     case "DOMMouseScroll":
      // 3 lines make up a step
      delta = event.detail / 3;
      break;

     case "mousewheel":
      // 120 units make up a step
      delta = event.wheelDelta / 120;
      break;

     case "wheel":
      delta = event.deltaY;
      switch (event.deltaMode) {
       case 0:
        // DOM_DELTA_PIXEL: 100 pixels make up a step
        delta /= 100;
        break;

       case 1:
        // DOM_DELTA_LINE: 3 lines make up a step
        delta /= 3;
        break;

       case 2:
        // DOM_DELTA_PAGE: A page makes up 80 steps
        delta *= 80;
        break;

       default:
        abort("unrecognized mouse wheel delta mode: " + event.deltaMode);
      }
      break;

     default:
      abort("unrecognized mouse wheel event: " + event.type);
    }
    return delta;
  },
  mouseX: 0,
  mouseY: 0,
  mouseMovementX: 0,
  mouseMovementY: 0,
  touches: {},
  lastTouches: {},
  calculateMouseCoords(pageX, pageY) {
    // Calculate the movement based on the changes
    // in the coordinates.
    var canvas = Browser.getCanvas();
    var rect = canvas.getBoundingClientRect();
    var adjustedX = pageX - (window.scrollX + rect.left);
    var adjustedY = pageY - (window.scrollY + rect.top);
    // the canvas might be CSS-scaled compared to its backbuffer;
    // SDL-using content will want mouse coordinates in terms
    // of backbuffer units.
    adjustedX = adjustedX * (canvas.width / rect.width);
    adjustedY = adjustedY * (canvas.height / rect.height);
    return {
      x: adjustedX,
      y: adjustedY
    };
  },
  setMouseCoords(pageX, pageY) {
    const {x, y} = Browser.calculateMouseCoords(pageX, pageY);
    Browser.mouseMovementX = x - Browser.mouseX;
    Browser.mouseMovementY = y - Browser.mouseY;
    Browser.mouseX = x;
    Browser.mouseY = y;
  },
  calculateMouseEvent(event) {
    // event should be mousemove, mousedown or mouseup
    if (Browser.pointerLock) {
      // When the pointer is locked, calculate the coordinates
      // based on the movement of the mouse.
      // Workaround for Firefox bug 764498
      if (event.type != "mousemove" && ("mozMovementX" in event)) {
        Browser.mouseMovementX = Browser.mouseMovementY = 0;
      } else {
        Browser.mouseMovementX = Browser.getMovementX(event);
        Browser.mouseMovementY = Browser.getMovementY(event);
      }
      // add the mouse delta to the current absolute mouse position
      Browser.mouseX += Browser.mouseMovementX;
      Browser.mouseY += Browser.mouseMovementY;
    } else {
      if (event.type === "touchstart" || event.type === "touchend" || event.type === "touchmove") {
        var touch = event.touch;
        if (touch === undefined) {
          return;
        }
        var coords = Browser.calculateMouseCoords(touch.pageX, touch.pageY);
        if (event.type === "touchstart") {
          Browser.lastTouches[touch.identifier] = coords;
          Browser.touches[touch.identifier] = coords;
        } else if (event.type === "touchend" || event.type === "touchmove") {
          var last = Browser.touches[touch.identifier];
          last ||= coords;
          Browser.lastTouches[touch.identifier] = last;
          Browser.touches[touch.identifier] = coords;
        }
        return;
      }
      Browser.setMouseCoords(event.pageX, event.pageY);
    }
  },
  resizeListeners: [],
  updateResizeListeners() {
    var canvas = Browser.getCanvas();
    Browser.resizeListeners.forEach(listener => listener(canvas.width, canvas.height));
  },
  setCanvasSize(width, height, noUpdates) {
    var canvas = Browser.getCanvas();
    Browser.updateCanvasDimensions(canvas, width, height);
    if (!noUpdates) Browser.updateResizeListeners();
  },
  windowedWidth: 0,
  windowedHeight: 0,
  setFullscreenCanvasSize() {
    // check if SDL is available
    if (typeof SDL != "undefined") {
      var flags = (growMemViews(), HEAPU32)[((SDL.screen) >>> 2) >>> 0];
      flags = flags | 8388608;
      // set SDL_FULLSCREEN flag
      (growMemViews(), HEAP32)[((SDL.screen) >>> 2) >>> 0] = flags;
    }
    Browser.updateCanvasDimensions(Browser.getCanvas());
    Browser.updateResizeListeners();
  },
  setWindowedCanvasSize() {
    // check if SDL is available
    if (typeof SDL != "undefined") {
      var flags = (growMemViews(), HEAPU32)[((SDL.screen) >>> 2) >>> 0];
      flags = flags & ~8388608;
      // clear SDL_FULLSCREEN flag
      (growMemViews(), HEAP32)[((SDL.screen) >>> 2) >>> 0] = flags;
    }
    Browser.updateCanvasDimensions(Browser.getCanvas());
    Browser.updateResizeListeners();
  },
  updateCanvasDimensions(canvas, wNative, hNative) {
    if (wNative && hNative) {
      canvas.widthNative = wNative;
      canvas.heightNative = hNative;
    } else {
      wNative = canvas.widthNative;
      hNative = canvas.heightNative;
    }
    var w = wNative;
    var h = hNative;
    if ((getFullscreenElement() === canvas.parentNode) && (typeof screen != "undefined")) {
      var factor = Math.min(screen.width / w, screen.height / h);
      w = Math.round(w * factor);
      h = Math.round(h * factor);
    }
    if (Browser.resizeCanvas) {
      if (canvas.width != w) canvas.width = w;
      if (canvas.height != h) canvas.height = h;
      if (typeof canvas.style != "undefined") {
        canvas.style.removeProperty("width");
        canvas.style.removeProperty("height");
      }
    } else {
      if (canvas.width != wNative) canvas.width = wNative;
      if (canvas.height != hNative) canvas.height = hNative;
      if (typeof canvas.style != "undefined") {
        if (w != wNative || h != hNative) {
          canvas.style.setProperty("width", w + "px", "important");
          canvas.style.setProperty("height", h + "px", "important");
        } else {
          canvas.style.removeProperty("width");
          canvas.style.removeProperty("height");
        }
      }
    }
  }
};

function _emscripten_get_screen_size(width, height) {
  if (ENVIRONMENT_IS_PTHREAD) return proxyToMainThread(14, 0, 1, width, height);
  width >>>= 0;
  height >>>= 0;
  (growMemViews(), HEAP32)[((width) >>> 2) >>> 0] = screen.width;
  (growMemViews(), HEAP32)[((height) >>> 2) >>> 0] = screen.height;
}

var _emscripten_glActiveTexture = x0 => GLctx.activeTexture(x0);

var _emscripten_glAttachShader = (program, shader) => {
  GLctx.attachShader(GL.programs[program], GL.shaders[shader]);
};

var _emscripten_glBeginQueryEXT = (target, id) => {
  GLctx.disjointTimerQueryExt["beginQueryEXT"](target, GL.queries[id]);
};

function _emscripten_glBindAttribLocation(program, index, name) {
  name >>>= 0;
  GLctx.bindAttribLocation(GL.programs[program], index, UTF8ToString(name));
}

var _emscripten_glBindBuffer = (target, buffer) => {
  GLctx.bindBuffer(target, GL.buffers[buffer]);
};

var _emscripten_glBindFramebuffer = (target, framebuffer) => {
  GLctx.bindFramebuffer(target, GL.framebuffers[framebuffer]);
};

var _emscripten_glBindRenderbuffer = (target, renderbuffer) => {
  GLctx.bindRenderbuffer(target, GL.renderbuffers[renderbuffer]);
};

var _emscripten_glBindTexture = (target, texture) => {
  GLctx.bindTexture(target, GL.textures[texture]);
};

var _emscripten_glBindVertexArray = vao => {
  GLctx.bindVertexArray(GL.vaos[vao]);
};

var _glBindVertexArray = _emscripten_glBindVertexArray;

var _emscripten_glBindVertexArrayOES = _glBindVertexArray;

var _emscripten_glBlendColor = (x0, x1, x2, x3) => GLctx.blendColor(x0, x1, x2, x3);

var _emscripten_glBlendEquation = x0 => GLctx.blendEquation(x0);

var _emscripten_glBlendEquationSeparate = (x0, x1) => GLctx.blendEquationSeparate(x0, x1);

var _emscripten_glBlendFunc = (x0, x1) => GLctx.blendFunc(x0, x1);

var _emscripten_glBlendFuncSeparate = (x0, x1, x2, x3) => GLctx.blendFuncSeparate(x0, x1, x2, x3);

function _emscripten_glBufferData(target, size, data, usage) {
  size >>>= 0;
  data >>>= 0;
  // N.b. here first form specifies a heap subarray, second form an integer
  // size, so the ?: code here is polymorphic. It is advised to avoid
  // randomly mixing both uses in calling code, to avoid any potential JS
  // engine JIT issues.
  GLctx.bufferData(target, data ? (growMemViews(), HEAPU8).subarray(data >>> 0, data + size >>> 0) : size, usage);
}

var webglBufferSubData = (target, offset, size, data, src = (growMemViews(), HEAPU8)) => {
  GLctx.bufferSubData(target, offset, src.subarray(data, data + size));
};

function _emscripten_glBufferSubData(target, offset, size, data) {
  offset >>>= 0;
  size >>>= 0;
  data >>>= 0;
  return webglBufferSubData(target, offset, size, data);
}

var _emscripten_glCheckFramebufferStatus = x0 => GLctx.checkFramebufferStatus(x0);

var _emscripten_glClear = x0 => GLctx.clear(x0);

var _emscripten_glClearColor = (x0, x1, x2, x3) => GLctx.clearColor(x0, x1, x2, x3);

var _emscripten_glClearDepthf = x0 => GLctx.clearDepth(x0);

var _emscripten_glClearStencil = x0 => GLctx.clearStencil(x0);

var _emscripten_glClipControlEXT = (origin, depth) => {
  GLctx.extClipControl["clipControlEXT"](origin, depth);
};

var _emscripten_glColorMask = (red, green, blue, alpha) => {
  GLctx.colorMask(!!red, !!green, !!blue, !!alpha);
};

var _emscripten_glCompileShader = shader => {
  GLctx.compileShader(GL.shaders[shader]);
};

function _emscripten_glCompressedTexImage2D(target, level, internalFormat, width, height, border, imageSize, data) {
  data >>>= 0;
  // `data` may be null here, which means "allocate uninitialized space but
  // don't upload" in GLES parlance, but `compressedTexImage2D` requires the
  // final data parameter, so we simply pass a heap view starting at zero
  // effectively uploading whatever happens to be near address zero.  See
  // https://github.com/emscripten-core/emscripten/issues/19300.
  GLctx.compressedTexImage2D(target, level, internalFormat, width, height, border, (growMemViews(), 
  HEAPU8).subarray(data >>> 0, data + imageSize >>> 0));
}

function _emscripten_glCompressedTexSubImage2D(target, level, xoffset, yoffset, width, height, format, imageSize, data) {
  data >>>= 0;
  GLctx.compressedTexSubImage2D(target, level, xoffset, yoffset, width, height, format, (growMemViews(), 
  HEAPU8).subarray(data >>> 0, data + imageSize >>> 0));
}

var _emscripten_glCopyTexImage2D = (x0, x1, x2, x3, x4, x5, x6, x7) => GLctx.copyTexImage2D(x0, x1, x2, x3, x4, x5, x6, x7);

var _emscripten_glCopyTexSubImage2D = (x0, x1, x2, x3, x4, x5, x6, x7) => GLctx.copyTexSubImage2D(x0, x1, x2, x3, x4, x5, x6, x7);

var _emscripten_glCreateProgram = () => {
  var id = GL.getNewId(GL.programs);
  var program = GLctx.createProgram();
  // Store additional information needed for each shader program:
  program.name = id;
  // Lazy cache results of
  // glGetProgramiv(GL_ACTIVE_UNIFORM_MAX_LENGTH/GL_ACTIVE_ATTRIBUTE_MAX_LENGTH/GL_ACTIVE_UNIFORM_BLOCK_MAX_NAME_LENGTH)
  program.maxUniformLength = program.maxAttributeLength = program.maxUniformBlockNameLength = 0;
  program.uniformIdCounter = 1;
  GL.programs[id] = program;
  return id;
};

var _emscripten_glCreateShader = shaderType => {
  var id = GL.getNewId(GL.shaders);
  GL.shaders[id] = GLctx.createShader(shaderType);
  return id;
};

var _emscripten_glCullFace = x0 => GLctx.cullFace(x0);

function _emscripten_glDeleteBuffers(n, buffers) {
  buffers >>>= 0;
  for (var i = 0; i < n; i++) {
    var id = (growMemViews(), HEAP32)[(((buffers) + (i * 4)) >>> 2) >>> 0];
    var buffer = GL.buffers[id];
    // From spec: "glDeleteBuffers silently ignores 0's and names that do not
    // correspond to existing buffer objects."
    if (!buffer) continue;
    GLctx.deleteBuffer(buffer);
    buffer.name = 0;
    GL.buffers[id] = null;
  }
}

function _emscripten_glDeleteFramebuffers(n, framebuffers) {
  framebuffers >>>= 0;
  for (var i = 0; i < n; ++i) {
    var id = (growMemViews(), HEAP32)[(((framebuffers) + (i * 4)) >>> 2) >>> 0];
    var framebuffer = GL.framebuffers[id];
    if (!framebuffer) continue;
    // GL spec: "glDeleteFramebuffers silently ignores 0s and names that do not correspond to existing framebuffer objects".
    GLctx.deleteFramebuffer(framebuffer);
    framebuffer.name = 0;
    GL.framebuffers[id] = null;
  }
}

var _emscripten_glDeleteProgram = id => {
  if (!id) return;
  var program = GL.programs[id];
  if (!program) {
    // glDeleteProgram actually signals an error when deleting a nonexisting
    // object, unlike some other GL delete functions.
    GL.recordError(1281);
    return;
  }
  GLctx.deleteProgram(program);
  program.name = 0;
  GL.programs[id] = null;
};

function _emscripten_glDeleteQueriesEXT(n, ids) {
  ids >>>= 0;
  for (var i = 0; i < n; i++) {
    var id = (growMemViews(), HEAP32)[(((ids) + (i * 4)) >>> 2) >>> 0];
    var query = GL.queries[id];
    if (!query) continue;
    // GL spec: "unused names in ids are ignored, as is the name zero."
    GLctx.disjointTimerQueryExt["deleteQueryEXT"](query);
    GL.queries[id] = null;
  }
}

function _emscripten_glDeleteRenderbuffers(n, renderbuffers) {
  renderbuffers >>>= 0;
  for (var i = 0; i < n; i++) {
    var id = (growMemViews(), HEAP32)[(((renderbuffers) + (i * 4)) >>> 2) >>> 0];
    var renderbuffer = GL.renderbuffers[id];
    if (!renderbuffer) continue;
    // GL spec: "glDeleteRenderbuffers silently ignores 0s and names that do not correspond to existing renderbuffer objects".
    GLctx.deleteRenderbuffer(renderbuffer);
    renderbuffer.name = 0;
    GL.renderbuffers[id] = null;
  }
}

var _emscripten_glDeleteShader = id => {
  if (!id) return;
  var shader = GL.shaders[id];
  if (!shader) {
    // glDeleteShader actually signals an error when deleting a nonexisting
    // object, unlike some other GL delete functions.
    GL.recordError(1281);
    return;
  }
  GLctx.deleteShader(shader);
  GL.shaders[id] = null;
};

function _emscripten_glDeleteTextures(n, textures) {
  textures >>>= 0;
  for (var i = 0; i < n; i++) {
    var id = (growMemViews(), HEAP32)[(((textures) + (i * 4)) >>> 2) >>> 0];
    var texture = GL.textures[id];
    // GL spec: "glDeleteTextures silently ignores 0s and names that do not
    // correspond to existing textures".
    if (!texture) continue;
    GLctx.deleteTexture(texture);
    texture.name = 0;
    GL.textures[id] = null;
  }
}

function _emscripten_glDeleteVertexArrays(n, vaos) {
  vaos >>>= 0;
  for (var i = 0; i < n; i++) {
    var id = (growMemViews(), HEAP32)[(((vaos) + (i * 4)) >>> 2) >>> 0];
    GLctx.deleteVertexArray(GL.vaos[id]);
    GL.vaos[id] = null;
  }
}

var _glDeleteVertexArrays = _emscripten_glDeleteVertexArrays;

var _emscripten_glDeleteVertexArraysOES = _glDeleteVertexArrays;

var _emscripten_glDepthFunc = x0 => GLctx.depthFunc(x0);

var _emscripten_glDepthMask = flag => {
  GLctx.depthMask(!!flag);
};

var _emscripten_glDepthRangef = (x0, x1) => GLctx.depthRange(x0, x1);

var _emscripten_glDetachShader = (program, shader) => {
  GLctx.detachShader(GL.programs[program], GL.shaders[shader]);
};

var _emscripten_glDisable = x0 => GLctx.disable(x0);

var _emscripten_glDisableVertexAttribArray = index => {
  GLctx.disableVertexAttribArray(index);
};

var _emscripten_glDrawArrays = (mode, first, count) => {
  GLctx.drawArrays(mode, first, count);
};

var _emscripten_glDrawArraysInstanced = (mode, first, count, primcount) => {
  GLctx.drawArraysInstanced(mode, first, count, primcount);
};

var _glDrawArraysInstanced = _emscripten_glDrawArraysInstanced;

var _emscripten_glDrawArraysInstancedANGLE = _glDrawArraysInstanced;

var tempFixedLengthArray = [];

function _emscripten_glDrawBuffers(n, bufs) {
  bufs >>>= 0;
  var bufArray = tempFixedLengthArray[n];
  for (var i = 0; i < n; i++) {
    bufArray[i] = (growMemViews(), HEAP32)[(((bufs) + (i * 4)) >>> 2) >>> 0];
  }
  GLctx.drawBuffers(bufArray);
}

var _glDrawBuffers = _emscripten_glDrawBuffers;

var _emscripten_glDrawBuffersWEBGL = _glDrawBuffers;

function _emscripten_glDrawElements(mode, count, type, indices) {
  indices >>>= 0;
  GLctx.drawElements(mode, count, type, indices);
}

function _emscripten_glDrawElementsInstanced(mode, count, type, indices, primcount) {
  indices >>>= 0;
  GLctx.drawElementsInstanced(mode, count, type, indices, primcount);
}

var _glDrawElementsInstanced = _emscripten_glDrawElementsInstanced;

var _emscripten_glDrawElementsInstancedANGLE = _glDrawElementsInstanced;

var _emscripten_glEnable = x0 => GLctx.enable(x0);

var _emscripten_glEnableVertexAttribArray = index => {
  GLctx.enableVertexAttribArray(index);
};

var _emscripten_glEndQueryEXT = target => {
  GLctx.disjointTimerQueryExt["endQueryEXT"](target);
};

var _emscripten_glFinish = () => GLctx.finish();

var _emscripten_glFlush = () => GLctx.flush();

var _emscripten_glFramebufferRenderbuffer = (target, attachment, renderbuffertarget, renderbuffer) => {
  GLctx.framebufferRenderbuffer(target, attachment, renderbuffertarget, GL.renderbuffers[renderbuffer]);
};

var _emscripten_glFramebufferTexture2D = (target, attachment, textarget, texture, level) => {
  GLctx.framebufferTexture2D(target, attachment, textarget, GL.textures[texture], level);
};

var _emscripten_glFrontFace = x0 => GLctx.frontFace(x0);

function _emscripten_glGenBuffers(n, buffers) {
  buffers >>>= 0;
  GL.genObject(n, buffers, "createBuffer", GL.buffers);
}

function _emscripten_glGenFramebuffers(n, ids) {
  ids >>>= 0;
  GL.genObject(n, ids, "createFramebuffer", GL.framebuffers);
}

function _emscripten_glGenQueriesEXT(n, ids) {
  ids >>>= 0;
  for (var i = 0; i < n; i++) {
    var query = GLctx.disjointTimerQueryExt["createQueryEXT"]();
    if (!query) {
      GL.recordError(1282);
      while (i < n) (growMemViews(), HEAP32)[(((ids) + (i++ * 4)) >>> 2) >>> 0] = 0;
      return;
    }
    var id = GL.getNewId(GL.queries);
    query.name = id;
    GL.queries[id] = query;
    (growMemViews(), HEAP32)[(((ids) + (i * 4)) >>> 2) >>> 0] = id;
  }
}

function _emscripten_glGenRenderbuffers(n, renderbuffers) {
  renderbuffers >>>= 0;
  GL.genObject(n, renderbuffers, "createRenderbuffer", GL.renderbuffers);
}

function _emscripten_glGenTextures(n, textures) {
  textures >>>= 0;
  GL.genObject(n, textures, "createTexture", GL.textures);
}

function _emscripten_glGenVertexArrays(n, arrays) {
  arrays >>>= 0;
  GL.genObject(n, arrays, "createVertexArray", GL.vaos);
}

var _glGenVertexArrays = _emscripten_glGenVertexArrays;

var _emscripten_glGenVertexArraysOES = _glGenVertexArrays;

var _emscripten_glGenerateMipmap = x0 => GLctx.generateMipmap(x0);

var __glGetActiveAttribOrUniform = (funcName, program, index, bufSize, length, size, type, name) => {
  program = GL.programs[program];
  var info = GLctx[funcName](program, index);
  if (info) {
    // If an error occurs, nothing will be written to length, size and type and name.
    var numBytesWrittenExclNull = name && stringToUTF8(info.name, name, bufSize);
    if (length) (growMemViews(), HEAP32)[((length) >>> 2) >>> 0] = numBytesWrittenExclNull;
    if (size) (growMemViews(), HEAP32)[((size) >>> 2) >>> 0] = info.size;
    if (type) (growMemViews(), HEAP32)[((type) >>> 2) >>> 0] = info.type;
  }
};

function _emscripten_glGetActiveAttrib(program, index, bufSize, length, size, type, name) {
  length >>>= 0;
  size >>>= 0;
  type >>>= 0;
  name >>>= 0;
  return __glGetActiveAttribOrUniform("getActiveAttrib", program, index, bufSize, length, size, type, name);
}

function _emscripten_glGetActiveUniform(program, index, bufSize, length, size, type, name) {
  length >>>= 0;
  size >>>= 0;
  type >>>= 0;
  name >>>= 0;
  return __glGetActiveAttribOrUniform("getActiveUniform", program, index, bufSize, length, size, type, name);
}

function _emscripten_glGetAttachedShaders(program, maxCount, count, shaders) {
  count >>>= 0;
  shaders >>>= 0;
  var result = GLctx.getAttachedShaders(GL.programs[program]);
  var len = result.length;
  if (len > maxCount) {
    len = maxCount;
  }
  (growMemViews(), HEAP32)[((count) >>> 2) >>> 0] = len;
  for (var i = 0; i < len; ++i) {
    var id = GL.shaders.indexOf(result[i]);
    (growMemViews(), HEAP32)[(((shaders) + (i * 4)) >>> 2) >>> 0] = id;
  }
}

function _emscripten_glGetAttribLocation(program, name) {
  name >>>= 0;
  return GLctx.getAttribLocation(GL.programs[program], UTF8ToString(name));
}

var writeI53ToI64 = (ptr, num) => {
  (growMemViews(), HEAPU32)[((ptr) >>> 2) >>> 0] = num;
  var lower = (growMemViews(), HEAPU32)[((ptr) >>> 2) >>> 0];
  (growMemViews(), HEAPU32)[(((ptr) + (4)) >>> 2) >>> 0] = (num - lower) / 4294967296;
};

var emscriptenWebGLGet = (name_, p, type) => {
  // Guard against user passing a null pointer.
  // Note that GLES2 spec does not say anything about how passing a null
  // pointer should be treated.  Testing on desktop core GL 3, the application
  // crashes on glGetIntegerv to a null pointer, but better to report an error
  // instead of doing anything random.
  if (!p) {
    GL.recordError(1281);
    return;
  }
  var ret = undefined;
  switch (name_) {
   // Handle a few trivial GLES values
    case 36346:
    // GL_SHADER_COMPILER
    ret = 1;
    break;

   case 36344:
    // GL_SHADER_BINARY_FORMATS
    if (type != 0 && type != 1) {
      GL.recordError(1280);
    }
    // Do not write anything to the out pointer, since no binary formats are
    // supported.
    return;

   case 36345:
    // GL_NUM_SHADER_BINARY_FORMATS
    ret = 0;
    break;

   case 34466:
    // GL_NUM_COMPRESSED_TEXTURE_FORMATS
    // WebGL doesn't have GL_NUM_COMPRESSED_TEXTURE_FORMATS (it's obsolete
    // since GL_COMPRESSED_TEXTURE_FORMATS returns a JS array that can be
    // queried for length), so implement it ourselves to allow C++ GLES2
    // code to get the length.
    var formats = GLctx.getParameter(34467);
    ret = formats ? formats.length : 0;
    break;
  }
  if (ret === undefined) {
    var result = GLctx.getParameter(name_);
    switch (typeof result) {
     case "number":
      ret = result;
      break;

     case "boolean":
      ret = result ? 1 : 0;
      break;

     case "string":
      GL.recordError(1280);
      // GL_INVALID_ENUM
      return;

     case "object":
      if (result === null) {
        // null is a valid result for some (e.g., which buffer is bound -
        // perhaps nothing is bound), but otherwise can mean an invalid
        // name_, which we need to report as an error
        switch (name_) {
         case 34964:
         // ARRAY_BUFFER_BINDING
          case 35725:
         // CURRENT_PROGRAM
          case 34965:
         // ELEMENT_ARRAY_BUFFER_BINDING
          case 36006:
         // FRAMEBUFFER_BINDING or DRAW_FRAMEBUFFER_BINDING
          case 36007:
         // RENDERBUFFER_BINDING
          case 32873:
         // TEXTURE_BINDING_2D
          case 34229:
         // WebGL 2 GL_VERTEX_ARRAY_BINDING, or WebGL 1 extension OES_vertex_array_object GL_VERTEX_ARRAY_BINDING_OES
          case 34068:
          {
            // TEXTURE_BINDING_CUBE_MAP
            ret = 0;
            break;
          }

         default:
          {
            GL.recordError(1280);
            // GL_INVALID_ENUM
            return;
          }
        }
      } else if (result instanceof Float32Array || result instanceof Uint32Array || result instanceof Int32Array || result instanceof Array) {
        for (var i = 0; i < result.length; ++i) {
          switch (type) {
           case 0:
            (growMemViews(), HEAP32)[(((p) + (i * 4)) >>> 2) >>> 0] = result[i];
            break;

           case 2:
            (growMemViews(), HEAPF32)[(((p) + (i * 4)) >>> 2) >>> 0] = result[i];
            break;

           case 4:
            (growMemViews(), HEAP8)[(p) + (i) >>> 0] = result[i] ? 1 : 0;
            break;
          }
        }
        return;
      } else {
        try {
          ret = result.name | 0;
        } catch (e) {
          GL.recordError(1280);
          // GL_INVALID_ENUM
          err(`GL_INVALID_ENUM in glGet${type}v: Unknown object returned from WebGL getParameter(${name_})! (error: ${e})`);
          return;
        }
      }
      break;

     default:
      GL.recordError(1280);
      // GL_INVALID_ENUM
      err(`GL_INVALID_ENUM in glGet${type}v: Native code calling glGet${type}v(${name_}) and it returns ${result} of type ${typeof (result)}!`);
      return;
    }
  }
  switch (type) {
   case 1:
    writeI53ToI64(p, ret);
    break;

   case 0:
    (growMemViews(), HEAP32)[((p) >>> 2) >>> 0] = ret;
    break;

   case 2:
    (growMemViews(), HEAPF32)[((p) >>> 2) >>> 0] = ret;
    break;

   case 4:
    (growMemViews(), HEAP8)[p >>> 0] = ret ? 1 : 0;
    break;
  }
};

function _emscripten_glGetBooleanv(name_, p) {
  p >>>= 0;
  return emscriptenWebGLGet(name_, p, 4);
}

function _emscripten_glGetBufferParameteriv(target, value, data) {
  data >>>= 0;
  if (!data) {
    // GLES2 specification does not specify how to behave if data is a null
    // pointer. Since calling this function does not make sense if data ==
    // null, issue a GL error to notify user about it.
    GL.recordError(1281);
    return;
  }
  (growMemViews(), HEAP32)[((data) >>> 2) >>> 0] = GLctx.getBufferParameter(target, value);
}

var _emscripten_glGetError = () => {
  var error = GLctx.getError() || GL.lastError;
  GL.lastError = 0;
  return error;
};

function _emscripten_glGetFloatv(name_, p) {
  p >>>= 0;
  return emscriptenWebGLGet(name_, p, 2);
}

function _emscripten_glGetFramebufferAttachmentParameteriv(target, attachment, pname, params) {
  params >>>= 0;
  var result = GLctx.getFramebufferAttachmentParameter(target, attachment, pname);
  if (result instanceof WebGLRenderbuffer || result instanceof WebGLTexture) {
    result = result.name | 0;
  }
  (growMemViews(), HEAP32)[((params) >>> 2) >>> 0] = result;
}

function _emscripten_glGetIntegerv(name_, p) {
  p >>>= 0;
  return emscriptenWebGLGet(name_, p, 0);
}

function _emscripten_glGetProgramInfoLog(program, maxLength, length, infoLog) {
  length >>>= 0;
  infoLog >>>= 0;
  var log = GLctx.getProgramInfoLog(GL.programs[program]);
  if (log === null) log = "(unknown error)";
  var numBytesWrittenExclNull = (maxLength > 0 && infoLog) ? stringToUTF8(log, infoLog, maxLength) : 0;
  if (length) (growMemViews(), HEAP32)[((length) >>> 2) >>> 0] = numBytesWrittenExclNull;
}

function _emscripten_glGetProgramiv(program, pname, p) {
  p >>>= 0;
  if (!p) {
    // GLES2 specification does not specify how to behave if p is a null
    // pointer. Since calling this function does not make sense if p == null,
    // issue a GL error to notify user about it.
    GL.recordError(1281);
    return;
  }
  if (program >= GL.counter) {
    GL.recordError(1281);
    return;
  }
  program = GL.programs[program];
  if (pname == 35716) {
    // GL_INFO_LOG_LENGTH
    var log = GLctx.getProgramInfoLog(program);
    if (log === null) log = "(unknown error)";
    (growMemViews(), HEAP32)[((p) >>> 2) >>> 0] = log.length + 1;
  } else if (pname == 35719) {
    if (!program.maxUniformLength) {
      var numActiveUniforms = GLctx.getProgramParameter(program, 35718);
      for (var i = 0; i < numActiveUniforms; ++i) {
        program.maxUniformLength = Math.max(program.maxUniformLength, GLctx.getActiveUniform(program, i).name.length + 1);
      }
    }
    (growMemViews(), HEAP32)[((p) >>> 2) >>> 0] = program.maxUniformLength;
  } else if (pname == 35722) {
    if (!program.maxAttributeLength) {
      var numActiveAttributes = GLctx.getProgramParameter(program, 35721);
      for (var i = 0; i < numActiveAttributes; ++i) {
        program.maxAttributeLength = Math.max(program.maxAttributeLength, GLctx.getActiveAttrib(program, i).name.length + 1);
      }
    }
    (growMemViews(), HEAP32)[((p) >>> 2) >>> 0] = program.maxAttributeLength;
  } else if (pname == 35381) {
    if (!program.maxUniformBlockNameLength) {
      var numActiveUniformBlocks = GLctx.getProgramParameter(program, 35382);
      for (var i = 0; i < numActiveUniformBlocks; ++i) {
        program.maxUniformBlockNameLength = Math.max(program.maxUniformBlockNameLength, GLctx.getActiveUniformBlockName(program, i).length + 1);
      }
    }
    (growMemViews(), HEAP32)[((p) >>> 2) >>> 0] = program.maxUniformBlockNameLength;
  } else {
    (growMemViews(), HEAP32)[((p) >>> 2) >>> 0] = GLctx.getProgramParameter(program, pname);
  }
}

function _emscripten_glGetQueryObjecti64vEXT(id, pname, params) {
  params >>>= 0;
  if (!params) {
    // GLES2 specification does not specify how to behave if params is a null pointer. Since calling this function does not make sense
    // if p == null, issue a GL error to notify user about it.
    GL.recordError(1281);
    return;
  }
  var query = GL.queries[id];
  var param;
  {
    param = GLctx.disjointTimerQueryExt["getQueryObjectEXT"](query, pname);
  }
  var ret;
  if (typeof param == "boolean") {
    ret = param ? 1 : 0;
  } else {
    ret = param;
  }
  writeI53ToI64(params, ret);
}

function _emscripten_glGetQueryObjectivEXT(id, pname, params) {
  params >>>= 0;
  if (!params) {
    // GLES2 specification does not specify how to behave if params is a null pointer. Since calling this function does not make sense
    // if p == null, issue a GL error to notify user about it.
    GL.recordError(1281);
    return;
  }
  var query = GL.queries[id];
  var param = GLctx.disjointTimerQueryExt["getQueryObjectEXT"](query, pname);
  var ret;
  if (typeof param == "boolean") {
    ret = param ? 1 : 0;
  } else {
    ret = param;
  }
  (growMemViews(), HEAP32)[((params) >>> 2) >>> 0] = ret;
}

var _glGetQueryObjecti64vEXT = _emscripten_glGetQueryObjecti64vEXT;

var _emscripten_glGetQueryObjectui64vEXT = _glGetQueryObjecti64vEXT;

var _glGetQueryObjectivEXT = _emscripten_glGetQueryObjectivEXT;

var _emscripten_glGetQueryObjectuivEXT = _glGetQueryObjectivEXT;

function _emscripten_glGetQueryivEXT(target, pname, params) {
  params >>>= 0;
  if (!params) {
    // GLES2 specification does not specify how to behave if params is a null pointer. Since calling this function does not make sense
    // if p == null, issue a GL error to notify user about it.
    GL.recordError(1281);
    return;
  }
  (growMemViews(), HEAP32)[((params) >>> 2) >>> 0] = GLctx.disjointTimerQueryExt["getQueryEXT"](target, pname);
}

function _emscripten_glGetRenderbufferParameteriv(target, pname, params) {
  params >>>= 0;
  if (!params) {
    // GLES2 specification does not specify how to behave if params is a null pointer. Since calling this function does not make sense
    // if params == null, issue a GL error to notify user about it.
    GL.recordError(1281);
    return;
  }
  (growMemViews(), HEAP32)[((params) >>> 2) >>> 0] = GLctx.getRenderbufferParameter(target, pname);
}

function _emscripten_glGetShaderInfoLog(shader, maxLength, length, infoLog) {
  length >>>= 0;
  infoLog >>>= 0;
  var log = GLctx.getShaderInfoLog(GL.shaders[shader]);
  if (log === null) log = "(unknown error)";
  var numBytesWrittenExclNull = (maxLength > 0 && infoLog) ? stringToUTF8(log, infoLog, maxLength) : 0;
  if (length) (growMemViews(), HEAP32)[((length) >>> 2) >>> 0] = numBytesWrittenExclNull;
}

function _emscripten_glGetShaderPrecisionFormat(shaderType, precisionType, range, precision) {
  range >>>= 0;
  precision >>>= 0;
  var result = GLctx.getShaderPrecisionFormat(shaderType, precisionType);
  (growMemViews(), HEAP32)[((range) >>> 2) >>> 0] = result.rangeMin;
  (growMemViews(), HEAP32)[(((range) + (4)) >>> 2) >>> 0] = result.rangeMax;
  (growMemViews(), HEAP32)[((precision) >>> 2) >>> 0] = result.precision;
}

function _emscripten_glGetShaderSource(shader, bufSize, length, source) {
  length >>>= 0;
  source >>>= 0;
  var result = GLctx.getShaderSource(GL.shaders[shader]);
  if (!result) return;
  // If an error occurs, nothing will be written to length or source.
  var numBytesWrittenExclNull = (bufSize > 0 && source) ? stringToUTF8(result, source, bufSize) : 0;
  if (length) (growMemViews(), HEAP32)[((length) >>> 2) >>> 0] = numBytesWrittenExclNull;
}

function _emscripten_glGetShaderiv(shader, pname, p) {
  p >>>= 0;
  if (!p) {
    // GLES2 specification does not specify how to behave if p is a null
    // pointer. Since calling this function does not make sense if p == null,
    // issue a GL error to notify user about it.
    GL.recordError(1281);
    return;
  }
  if (pname == 35716) {
    // GL_INFO_LOG_LENGTH
    var log = GLctx.getShaderInfoLog(GL.shaders[shader]);
    if (log === null) log = "(unknown error)";
    // The GLES2 specification says that if the shader has an empty info log,
    // a value of 0 is returned. Otherwise the log has a null char appended.
    // (An empty string is falsey, so we can just check that instead of
    // looking at log.length.)
    var logLength = log ? log.length + 1 : 0;
    (growMemViews(), HEAP32)[((p) >>> 2) >>> 0] = logLength;
  } else if (pname == 35720) {
    // GL_SHADER_SOURCE_LENGTH
    var source = GLctx.getShaderSource(GL.shaders[shader]);
    // source may be a null, or the empty string, both of which are falsey
    // values that we report a 0 length for.
    var sourceLength = source ? source.length + 1 : 0;
    (growMemViews(), HEAP32)[((p) >>> 2) >>> 0] = sourceLength;
  } else {
    (growMemViews(), HEAP32)[((p) >>> 2) >>> 0] = GLctx.getShaderParameter(GL.shaders[shader], pname);
  }
}

var webglGetExtensions = () => {
  var exts = getEmscriptenSupportedExtensions(GLctx);
  exts = exts.concat(exts.map(e => "GL_" + e));
  return exts;
};

function _emscripten_glGetString(name_) {
  var ret = GL.stringCache[name_];
  if (!ret) {
    switch (name_) {
     case 7939:
      ret = stringToNewUTF8(webglGetExtensions().join(" "));
      break;

     case 7936:
     case 7937:
     case 37445:
     case 37446:
      var s = GLctx.getParameter(name_);
      if (!s) {
        GL.recordError(1280);
      }
      ret = s ? stringToNewUTF8(s) : 0;
      break;

     case 7938:
      var webGLVersion = GLctx.getParameter(7938);
      // return GLES version string corresponding to the version of the WebGL context
      var glVersion = `OpenGL ES 2.0 (${webGLVersion})`;
      ret = stringToNewUTF8(glVersion);
      break;

     case 35724:
      var glslVersion = GLctx.getParameter(35724);
      // extract the version number 'N.M' from the string 'WebGL GLSL ES N.M ...'
      var ver_re = /^WebGL GLSL ES ([0-9]\.[0-9][0-9]?)(?:$| .*)/;
      var ver_num = glslVersion.match(ver_re);
      if (ver_num !== null) {
        if (ver_num[1].length == 3) ver_num[1] = ver_num[1] + "0";
        // ensure minor version has 2 digits
        glslVersion = `OpenGL ES GLSL ES ${ver_num[1]} (${glslVersion})`;
      }
      ret = stringToNewUTF8(glslVersion);
      break;

     default:
      GL.recordError(1280);
    }
    GL.stringCache[name_] = ret;
  }
  return ret;
}

function _emscripten_glGetTexParameterfv(target, pname, params) {
  params >>>= 0;
  if (!params) {
    // GLES2 specification does not specify how to behave if params is a null
    // pointer. Since calling this function does not make sense if p == null,
    // issue a GL error to notify user about it.
    GL.recordError(1281);
    return;
  }
  (growMemViews(), HEAPF32)[((params) >>> 2) >>> 0] = GLctx.getTexParameter(target, pname);
}

function _emscripten_glGetTexParameteriv(target, pname, params) {
  params >>>= 0;
  if (!params) {
    // GLES2 specification does not specify how to behave if params is a null
    // pointer. Since calling this function does not make sense if p == null,
    // issue a GL error to notify user about it.
    GL.recordError(1281);
    return;
  }
  (growMemViews(), HEAP32)[((params) >>> 2) >>> 0] = GLctx.getTexParameter(target, pname);
}

/** @suppress {checkTypes} */ var jstoi_q = str => parseInt(str);

/** @noinline */ var webglGetLeftBracePos = name => name.slice(-1) == "]" && name.lastIndexOf("[");

var webglPrepareUniformLocationsBeforeFirstUse = program => {
  var uniformLocsById = program.uniformLocsById, // Maps GLuint -> WebGLUniformLocation
  uniformSizeAndIdsByName = program.uniformSizeAndIdsByName, // Maps name -> [uniform array length, GLuint]
  i, j;
  // On the first time invocation of glGetUniformLocation on this shader program:
  // initialize cache data structures and discover which uniforms are arrays.
  if (!uniformLocsById) {
    // maps GLint integer locations to WebGLUniformLocations
    program.uniformLocsById = uniformLocsById = {};
    // maps integer locations back to uniform name strings, so that we can lazily fetch uniform array locations
    program.uniformArrayNamesById = {};
    var numActiveUniforms = GLctx.getProgramParameter(program, 35718);
    for (i = 0; i < numActiveUniforms; ++i) {
      var u = GLctx.getActiveUniform(program, i);
      var nm = u.name;
      var sz = u.size;
      var lb = webglGetLeftBracePos(nm);
      var arrayName = lb > 0 ? nm.slice(0, lb) : nm;
      // Assign a new location.
      var id = program.uniformIdCounter;
      program.uniformIdCounter += sz;
      // Eagerly get the location of the uniformArray[0] base element.
      // The remaining indices >0 will be left for lazy evaluation to
      // improve performance. Those may never be needed to fetch, if the
      // application fills arrays always in full starting from the first
      // element of the array.
      uniformSizeAndIdsByName[arrayName] = [ sz, id ];
      // Store placeholder integers in place that highlight that these
      // >0 index locations are array indices pending population.
      for (j = 0; j < sz; ++j) {
        uniformLocsById[id] = j;
        program.uniformArrayNamesById[id++] = arrayName;
      }
    }
  }
};

function _emscripten_glGetUniformLocation(program, name) {
  name >>>= 0;
  name = UTF8ToString(name);
  if (program = GL.programs[program]) {
    webglPrepareUniformLocationsBeforeFirstUse(program);
    var uniformLocsById = program.uniformLocsById;
    // Maps GLuint -> WebGLUniformLocation
    var arrayIndex = 0;
    var uniformBaseName = name;
    // Invariant: when populating integer IDs for uniform locations, we must
    // maintain the precondition that arrays reside in contiguous addresses,
    // i.e. for a 'vec4 colors[10];', colors[4] must be at location
    // colors[0]+4.  However, user might call glGetUniformLocation(program,
    // "colors") for an array, so we cannot discover based on the user input
    // arguments whether the uniform we are dealing with is an array. The only
    // way to discover which uniforms are arrays is to enumerate over all the
    // active uniforms in the program.
    var leftBrace = webglGetLeftBracePos(name);
    // If user passed an array accessor "[index]", parse the array index off the accessor.
    if (leftBrace > 0) {
      arrayIndex = jstoi_q(name.slice(leftBrace + 1)) >>> 0;
      // "index]", coerce parseInt(']') with >>>0 to treat "foo[]" as "foo[0]" and foo[-1] as unsigned out-of-bounds.
      uniformBaseName = name.slice(0, leftBrace);
    }
    // Have we cached the location of this uniform before?
    // A pair [array length, GLint of the uniform location]
    var sizeAndId = program.uniformSizeAndIdsByName[uniformBaseName];
    // If a uniform with this name exists, and if its index is within the
    // array limits (if it's even an array), query the WebGLlocation, or
    // return an existing cached location.
    if (sizeAndId && arrayIndex < sizeAndId[0]) {
      arrayIndex += sizeAndId[1];
      // Add the base location of the uniform to the array index offset.
      if ((uniformLocsById[arrayIndex] = uniformLocsById[arrayIndex] || GLctx.getUniformLocation(program, name))) {
        return arrayIndex;
      }
    }
  } else {
    // N.b. we are currently unable to distinguish between GL program IDs that
    // never existed vs GL program IDs that have been deleted, so report
    // GL_INVALID_VALUE in both cases.
    GL.recordError(1281);
  }
  return -1;
}

var webglGetProgramUniformLocation = (program, location) => {
  if (program) {
    var webglLoc = program.uniformLocsById[location];
    // program.uniformLocsById[location] stores either an integer, or a
    // WebGLUniformLocation.
    // If an integer, we have not yet bound the location, so do it now. The
    // integer value specifies the array index we should bind to.
    if (typeof webglLoc == "number") {
      program.uniformLocsById[location] = webglLoc = GLctx.getUniformLocation(program, program.uniformArrayNamesById[location] + (webglLoc > 0 ? `[${webglLoc}]` : ""));
    }
    // Else an already cached WebGLUniformLocation, return it.
    return webglLoc;
  } else {
    GL.recordError(1282);
  }
};

/** @suppress{checkTypes} */ var emscriptenWebGLGetUniform = (program, location, params, type) => {
  if (!params) {
    // GLES2 specification does not specify how to behave if params is a null
    // pointer. Since calling this function does not make sense if params ==
    // null, issue a GL error to notify user about it.
    GL.recordError(1281);
    return;
  }
  program = GL.programs[program];
  webglPrepareUniformLocationsBeforeFirstUse(program);
  var data = GLctx.getUniform(program, webglGetProgramUniformLocation(program, location));
  if (typeof data == "number" || typeof data == "boolean") {
    switch (type) {
     case 0:
      (growMemViews(), HEAP32)[((params) >>> 2) >>> 0] = data;
      break;

     case 2:
      (growMemViews(), HEAPF32)[((params) >>> 2) >>> 0] = data;
      break;
    }
  } else {
    for (var i = 0; i < data.length; i++) {
      switch (type) {
       case 0:
        (growMemViews(), HEAP32)[(((params) + (i * 4)) >>> 2) >>> 0] = data[i];
        break;

       case 2:
        (growMemViews(), HEAPF32)[(((params) + (i * 4)) >>> 2) >>> 0] = data[i];
        break;
      }
    }
  }
};

function _emscripten_glGetUniformfv(program, location, params) {
  params >>>= 0;
  emscriptenWebGLGetUniform(program, location, params, 2);
}

function _emscripten_glGetUniformiv(program, location, params) {
  params >>>= 0;
  emscriptenWebGLGetUniform(program, location, params, 0);
}

function _emscripten_glGetVertexAttribPointerv(index, pname, pointer) {
  pointer >>>= 0;
  if (!pointer) {
    // GLES2 specification does not specify how to behave if pointer is a null
    // pointer. Since calling this function does not make sense if pointer ==
    // null, issue a GL error to notify user about it.
    GL.recordError(1281);
    return;
  }
  (growMemViews(), HEAP32)[((pointer) >>> 2) >>> 0] = GLctx.getVertexAttribOffset(index, pname);
}

/** @suppress{checkTypes} */ var emscriptenWebGLGetVertexAttrib = (index, pname, params, type) => {
  if (!params) {
    // GLES2 specification does not specify how to behave if params is a null
    // pointer. Since calling this function does not make sense if params ==
    // null, issue a GL error to notify user about it.
    GL.recordError(1281);
    return;
  }
  var data = GLctx.getVertexAttrib(index, pname);
  if (pname == 34975) {
    (growMemViews(), HEAP32)[((params) >>> 2) >>> 0] = data && data["name"];
  } else if (typeof data == "number" || typeof data == "boolean") {
    switch (type) {
     case 0:
      (growMemViews(), HEAP32)[((params) >>> 2) >>> 0] = data;
      break;

     case 2:
      (growMemViews(), HEAPF32)[((params) >>> 2) >>> 0] = data;
      break;

     case 5:
      (growMemViews(), HEAP32)[((params) >>> 2) >>> 0] = Math.fround(data);
      break;
    }
  } else {
    for (var i = 0; i < data.length; i++) {
      switch (type) {
       case 0:
        (growMemViews(), HEAP32)[(((params) + (i * 4)) >>> 2) >>> 0] = data[i];
        break;

       case 2:
        (growMemViews(), HEAPF32)[(((params) + (i * 4)) >>> 2) >>> 0] = data[i];
        break;

       case 5:
        (growMemViews(), HEAP32)[(((params) + (i * 4)) >>> 2) >>> 0] = Math.fround(data[i]);
        break;
      }
    }
  }
};

function _emscripten_glGetVertexAttribfv(index, pname, params) {
  params >>>= 0;
  // N.B. This function may only be called if the vertex attribute was
  // specified using the function glVertexAttrib*f(), otherwise the results
  // are undefined. (GLES3 spec 6.1.12)
  emscriptenWebGLGetVertexAttrib(index, pname, params, 2);
}

function _emscripten_glGetVertexAttribiv(index, pname, params) {
  params >>>= 0;
  // N.B. This function may only be called if the vertex attribute was
  // specified using the function glVertexAttrib*f(), otherwise the results
  // are undefined. (GLES3 spec 6.1.12)
  emscriptenWebGLGetVertexAttrib(index, pname, params, 5);
}

var _emscripten_glHint = (x0, x1) => GLctx.hint(x0, x1);

var _emscripten_glIsBuffer = buffer => {
  var b = GL.buffers[buffer];
  if (!b) return 0;
  return GLctx.isBuffer(b);
};

var _emscripten_glIsEnabled = x0 => GLctx.isEnabled(x0);

var _emscripten_glIsFramebuffer = framebuffer => {
  var fb = GL.framebuffers[framebuffer];
  if (!fb) return 0;
  return GLctx.isFramebuffer(fb);
};

var _emscripten_glIsProgram = program => {
  program = GL.programs[program];
  if (!program) return 0;
  return GLctx.isProgram(program);
};

var _emscripten_glIsQueryEXT = id => {
  var query = GL.queries[id];
  if (!query) return 0;
  return GLctx.disjointTimerQueryExt["isQueryEXT"](query);
};

var _emscripten_glIsRenderbuffer = renderbuffer => {
  var rb = GL.renderbuffers[renderbuffer];
  if (!rb) return 0;
  return GLctx.isRenderbuffer(rb);
};

var _emscripten_glIsShader = shader => {
  var s = GL.shaders[shader];
  if (!s) return 0;
  return GLctx.isShader(s);
};

var _emscripten_glIsTexture = id => {
  var texture = GL.textures[id];
  if (!texture) return 0;
  return GLctx.isTexture(texture);
};

var _emscripten_glIsVertexArray = array => {
  var vao = GL.vaos[array];
  if (!vao) return 0;
  return GLctx.isVertexArray(vao);
};

var _glIsVertexArray = _emscripten_glIsVertexArray;

var _emscripten_glIsVertexArrayOES = _glIsVertexArray;

var _emscripten_glLineWidth = x0 => GLctx.lineWidth(x0);

var _emscripten_glLinkProgram = program => {
  program = GL.programs[program];
  GLctx.linkProgram(program);
  // Invalidate earlier computed uniform->ID mappings, those have now become stale
  program.uniformLocsById = 0;
  // Mark as null-like so that glGetUniformLocation() knows to populate this again.
  program.uniformSizeAndIdsByName = {};
};

var _emscripten_glPixelStorei = (pname, param) => {
  if (pname == 3317) {
    GL.unpackAlignment = param;
  } else if (pname == 3314) {
    GL.unpackRowLength = param;
  }
  GLctx.pixelStorei(pname, param);
};

var _emscripten_glPolygonModeWEBGL = (face, mode) => {
  GLctx.webglPolygonMode["polygonModeWEBGL"](face, mode);
};

var _emscripten_glPolygonOffset = (x0, x1) => GLctx.polygonOffset(x0, x1);

var _emscripten_glPolygonOffsetClampEXT = (factor, units, clamp) => {
  GLctx.extPolygonOffsetClamp["polygonOffsetClampEXT"](factor, units, clamp);
};

var _emscripten_glQueryCounterEXT = (id, target) => {
  GLctx.disjointTimerQueryExt["queryCounterEXT"](GL.queries[id], target);
};

var computeUnpackAlignedImageSize = (width, height, sizePerPixel) => {
  function roundedToNextMultipleOf(x, y) {
    return (x + y - 1) & -y;
  }
  var plainRowSize = (GL.unpackRowLength || width) * sizePerPixel;
  var alignedRowSize = roundedToNextMultipleOf(plainRowSize, GL.unpackAlignment);
  return height * alignedRowSize;
};

var colorChannelsInGlTextureFormat = format => {
  // Micro-optimizations for size: map format to size by subtracting smallest
  // enum value (0x1902) from all values first.  Also omit the most common
  // size value (1) from the list, which is assumed by formats not on the
  // list.
  var colorChannels = {
    // 0x1902 /* GL_DEPTH_COMPONENT */ - 0x1902: 1,
    // 0x1906 /* GL_ALPHA */ - 0x1902: 1,
    5: 3,
    6: 4,
    // 0x1909 /* GL_LUMINANCE */ - 0x1902: 1,
    8: 2,
    29502: 3,
    29504: 4
  };
  return colorChannels[format - 6402] || 1;
};

var heapObjectForWebGLType = type => {
  // Micro-optimization for size: Subtract lowest GL enum number (0x1400/* GL_BYTE */) from type to compare
  // smaller values for the heap, for shorter generated code size.
  // Also the type HEAPU16 is not tested for explicitly, but any unrecognized type will return out HEAPU16.
  // (since most types are HEAPU16)
  type -= 5120;
  if (type == 1) return (growMemViews(), HEAPU8);
  if (type == 4) return (growMemViews(), HEAP32);
  if (type == 6) return (growMemViews(), HEAPF32);
  if (type == 5 || type == 28922) return (growMemViews(), HEAPU32);
  return (growMemViews(), HEAPU16);
};

var toTypedArrayIndex = (pointer, heap) => pointer >>> (31 - Math.clz32(heap.BYTES_PER_ELEMENT));

var emscriptenWebGLGetTexPixelData = (type, format, width, height, pixels) => {
  var heap = heapObjectForWebGLType(type);
  var sizePerPixel = colorChannelsInGlTextureFormat(format) * heap.BYTES_PER_ELEMENT;
  var bytes = computeUnpackAlignedImageSize(width, height, sizePerPixel);
  return heap.subarray(toTypedArrayIndex(pixels, heap) >>> 0, toTypedArrayIndex(pixels + bytes, heap) >>> 0);
};

function _emscripten_glReadPixels(x, y, width, height, format, type, pixels) {
  pixels >>>= 0;
  var pixelData = emscriptenWebGLGetTexPixelData(type, format, width, height, pixels);
  if (!pixelData) {
    GL.recordError(1280);
    return;
  }
  GLctx.readPixels(x, y, width, height, format, type, pixelData);
}

var _emscripten_glReleaseShaderCompiler = () => {};

var _emscripten_glRenderbufferStorage = (x0, x1, x2, x3) => GLctx.renderbufferStorage(x0, x1, x2, x3);

var _emscripten_glSampleCoverage = (value, invert) => {
  GLctx.sampleCoverage(value, !!invert);
};

var _emscripten_glScissor = (x0, x1, x2, x3) => GLctx.scissor(x0, x1, x2, x3);

function _emscripten_glShaderBinary(count, shaders, binaryformat, binary, length) {
  shaders >>>= 0;
  binary >>>= 0;
  GL.recordError(1280);
}

function _emscripten_glShaderSource(shader, count, string, length) {
  string >>>= 0;
  length >>>= 0;
  var source = GL.getSource(shader, count, string, length);
  GLctx.shaderSource(GL.shaders[shader], source);
}

var _emscripten_glStencilFunc = (x0, x1, x2) => GLctx.stencilFunc(x0, x1, x2);

var _emscripten_glStencilFuncSeparate = (x0, x1, x2, x3) => GLctx.stencilFuncSeparate(x0, x1, x2, x3);

var _emscripten_glStencilMask = x0 => GLctx.stencilMask(x0);

var _emscripten_glStencilMaskSeparate = (x0, x1) => GLctx.stencilMaskSeparate(x0, x1);

var _emscripten_glStencilOp = (x0, x1, x2) => GLctx.stencilOp(x0, x1, x2);

var _emscripten_glStencilOpSeparate = (x0, x1, x2, x3) => GLctx.stencilOpSeparate(x0, x1, x2, x3);

function _emscripten_glTexImage2D(target, level, internalFormat, width, height, border, format, type, pixels) {
  pixels >>>= 0;
  var pixelData = pixels ? emscriptenWebGLGetTexPixelData(type, format, width, height, pixels) : null;
  GLctx.texImage2D(target, level, internalFormat, width, height, border, format, type, pixelData);
}

var _emscripten_glTexParameterf = (x0, x1, x2) => GLctx.texParameterf(x0, x1, x2);

function _emscripten_glTexParameterfv(target, pname, params) {
  params >>>= 0;
  var param = (growMemViews(), HEAPF32)[((params) >>> 2) >>> 0];
  GLctx.texParameterf(target, pname, param);
}

var _emscripten_glTexParameteri = (x0, x1, x2) => GLctx.texParameteri(x0, x1, x2);

function _emscripten_glTexParameteriv(target, pname, params) {
  params >>>= 0;
  var param = (growMemViews(), HEAP32)[((params) >>> 2) >>> 0];
  GLctx.texParameteri(target, pname, param);
}

function _emscripten_glTexSubImage2D(target, level, xoffset, yoffset, width, height, format, type, pixels) {
  pixels >>>= 0;
  var pixelData = pixels ? emscriptenWebGLGetTexPixelData(type, format, width, height, pixels) : null;
  GLctx.texSubImage2D(target, level, xoffset, yoffset, width, height, format, type, pixelData);
}

var webglGetUniformLocation = location => webglGetProgramUniformLocation(GLctx.currentProgram, location);

var _emscripten_glUniform1f = (location, v0) => {
  GLctx.uniform1f(webglGetUniformLocation(location), v0);
};

var miniTempWebGLFloatBuffers = [];

function _emscripten_glUniform1fv(location, count, value) {
  value >>>= 0;
  if (count <= 288) {
    // avoid allocation when uploading few enough uniforms
    var view = miniTempWebGLFloatBuffers[count];
    for (var i = 0; i < count; ++i) {
      view[i] = (growMemViews(), HEAPF32)[(((value) + (4 * i)) >>> 2) >>> 0];
    }
  } else {
    var view = (growMemViews(), HEAPF32).subarray((((value) >>> 2)) >>> 0, ((value + count * 4) >>> 2) >>> 0);
  }
  GLctx.uniform1fv(webglGetUniformLocation(location), view);
}

var _emscripten_glUniform1i = (location, v0) => {
  GLctx.uniform1i(webglGetUniformLocation(location), v0);
};

var miniTempWebGLIntBuffers = [];

function _emscripten_glUniform1iv(location, count, value) {
  value >>>= 0;
  if (count <= 288) {
    // avoid allocation when uploading few enough uniforms
    var view = miniTempWebGLIntBuffers[count];
    for (var i = 0; i < count; ++i) {
      view[i] = (growMemViews(), HEAP32)[(((value) + (4 * i)) >>> 2) >>> 0];
    }
  } else {
    var view = (growMemViews(), HEAP32).subarray((((value) >>> 2)) >>> 0, ((value + count * 4) >>> 2) >>> 0);
  }
  GLctx.uniform1iv(webglGetUniformLocation(location), view);
}

var _emscripten_glUniform2f = (location, v0, v1) => {
  GLctx.uniform2f(webglGetUniformLocation(location), v0, v1);
};

function _emscripten_glUniform2fv(location, count, value) {
  value >>>= 0;
  if (count <= 144) {
    // avoid allocation when uploading few enough uniforms
    count *= 2;
    var view = miniTempWebGLFloatBuffers[count];
    for (var i = 0; i < count; i += 2) {
      view[i] = (growMemViews(), HEAPF32)[(((value) + (4 * i)) >>> 2) >>> 0];
      view[i + 1] = (growMemViews(), HEAPF32)[(((value) + (4 * i + 4)) >>> 2) >>> 0];
    }
  } else {
    var view = (growMemViews(), HEAPF32).subarray((((value) >>> 2)) >>> 0, ((value + count * 8) >>> 2) >>> 0);
  }
  GLctx.uniform2fv(webglGetUniformLocation(location), view);
}

var _emscripten_glUniform2i = (location, v0, v1) => {
  GLctx.uniform2i(webglGetUniformLocation(location), v0, v1);
};

function _emscripten_glUniform2iv(location, count, value) {
  value >>>= 0;
  if (count <= 144) {
    // avoid allocation when uploading few enough uniforms
    count *= 2;
    var view = miniTempWebGLIntBuffers[count];
    for (var i = 0; i < count; i += 2) {
      view[i] = (growMemViews(), HEAP32)[(((value) + (4 * i)) >>> 2) >>> 0];
      view[i + 1] = (growMemViews(), HEAP32)[(((value) + (4 * i + 4)) >>> 2) >>> 0];
    }
  } else {
    var view = (growMemViews(), HEAP32).subarray((((value) >>> 2)) >>> 0, ((value + count * 8) >>> 2) >>> 0);
  }
  GLctx.uniform2iv(webglGetUniformLocation(location), view);
}

var _emscripten_glUniform3f = (location, v0, v1, v2) => {
  GLctx.uniform3f(webglGetUniformLocation(location), v0, v1, v2);
};

function _emscripten_glUniform3fv(location, count, value) {
  value >>>= 0;
  if (count <= 96) {
    // avoid allocation when uploading few enough uniforms
    count *= 3;
    var view = miniTempWebGLFloatBuffers[count];
    for (var i = 0; i < count; i += 3) {
      view[i] = (growMemViews(), HEAPF32)[(((value) + (4 * i)) >>> 2) >>> 0];
      view[i + 1] = (growMemViews(), HEAPF32)[(((value) + (4 * i + 4)) >>> 2) >>> 0];
      view[i + 2] = (growMemViews(), HEAPF32)[(((value) + (4 * i + 8)) >>> 2) >>> 0];
    }
  } else {
    var view = (growMemViews(), HEAPF32).subarray((((value) >>> 2)) >>> 0, ((value + count * 12) >>> 2) >>> 0);
  }
  GLctx.uniform3fv(webglGetUniformLocation(location), view);
}

var _emscripten_glUniform3i = (location, v0, v1, v2) => {
  GLctx.uniform3i(webglGetUniformLocation(location), v0, v1, v2);
};

function _emscripten_glUniform3iv(location, count, value) {
  value >>>= 0;
  if (count <= 96) {
    // avoid allocation when uploading few enough uniforms
    count *= 3;
    var view = miniTempWebGLIntBuffers[count];
    for (var i = 0; i < count; i += 3) {
      view[i] = (growMemViews(), HEAP32)[(((value) + (4 * i)) >>> 2) >>> 0];
      view[i + 1] = (growMemViews(), HEAP32)[(((value) + (4 * i + 4)) >>> 2) >>> 0];
      view[i + 2] = (growMemViews(), HEAP32)[(((value) + (4 * i + 8)) >>> 2) >>> 0];
    }
  } else {
    var view = (growMemViews(), HEAP32).subarray((((value) >>> 2)) >>> 0, ((value + count * 12) >>> 2) >>> 0);
  }
  GLctx.uniform3iv(webglGetUniformLocation(location), view);
}

var _emscripten_glUniform4f = (location, v0, v1, v2, v3) => {
  GLctx.uniform4f(webglGetUniformLocation(location), v0, v1, v2, v3);
};

function _emscripten_glUniform4fv(location, count, value) {
  value >>>= 0;
  if (count <= 72) {
    // avoid allocation when uploading few enough uniforms
    var view = miniTempWebGLFloatBuffers[4 * count];
    // hoist the heap out of the loop for size and for pthreads+growth.
    var heap = (growMemViews(), HEAPF32);
    value = ((value) >>> 2);
    count *= 4;
    for (var i = 0; i < count; i += 4) {
      var dst = value + i;
      view[i] = heap[dst >>> 0];
      view[i + 1] = heap[dst + 1 >>> 0];
      view[i + 2] = heap[dst + 2 >>> 0];
      view[i + 3] = heap[dst + 3 >>> 0];
    }
  } else {
    var view = (growMemViews(), HEAPF32).subarray((((value) >>> 2)) >>> 0, ((value + count * 16) >>> 2) >>> 0);
  }
  GLctx.uniform4fv(webglGetUniformLocation(location), view);
}

var _emscripten_glUniform4i = (location, v0, v1, v2, v3) => {
  GLctx.uniform4i(webglGetUniformLocation(location), v0, v1, v2, v3);
};

function _emscripten_glUniform4iv(location, count, value) {
  value >>>= 0;
  if (count <= 72) {
    // avoid allocation when uploading few enough uniforms
    count *= 4;
    var view = miniTempWebGLIntBuffers[count];
    for (var i = 0; i < count; i += 4) {
      view[i] = (growMemViews(), HEAP32)[(((value) + (4 * i)) >>> 2) >>> 0];
      view[i + 1] = (growMemViews(), HEAP32)[(((value) + (4 * i + 4)) >>> 2) >>> 0];
      view[i + 2] = (growMemViews(), HEAP32)[(((value) + (4 * i + 8)) >>> 2) >>> 0];
      view[i + 3] = (growMemViews(), HEAP32)[(((value) + (4 * i + 12)) >>> 2) >>> 0];
    }
  } else {
    var view = (growMemViews(), HEAP32).subarray((((value) >>> 2)) >>> 0, ((value + count * 16) >>> 2) >>> 0);
  }
  GLctx.uniform4iv(webglGetUniformLocation(location), view);
}

function _emscripten_glUniformMatrix2fv(location, count, transpose, value) {
  value >>>= 0;
  if (count <= 72) {
    // avoid allocation when uploading few enough uniforms
    count *= 4;
    var view = miniTempWebGLFloatBuffers[count];
    for (var i = 0; i < count; i += 4) {
      view[i] = (growMemViews(), HEAPF32)[(((value) + (4 * i)) >>> 2) >>> 0];
      view[i + 1] = (growMemViews(), HEAPF32)[(((value) + (4 * i + 4)) >>> 2) >>> 0];
      view[i + 2] = (growMemViews(), HEAPF32)[(((value) + (4 * i + 8)) >>> 2) >>> 0];
      view[i + 3] = (growMemViews(), HEAPF32)[(((value) + (4 * i + 12)) >>> 2) >>> 0];
    }
  } else {
    var view = (growMemViews(), HEAPF32).subarray((((value) >>> 2)) >>> 0, ((value + count * 16) >>> 2) >>> 0);
  }
  GLctx.uniformMatrix2fv(webglGetUniformLocation(location), !!transpose, view);
}

function _emscripten_glUniformMatrix3fv(location, count, transpose, value) {
  value >>>= 0;
  if (count <= 32) {
    // avoid allocation when uploading few enough uniforms
    count *= 9;
    var view = miniTempWebGLFloatBuffers[count];
    for (var i = 0; i < count; i += 9) {
      view[i] = (growMemViews(), HEAPF32)[(((value) + (4 * i)) >>> 2) >>> 0];
      view[i + 1] = (growMemViews(), HEAPF32)[(((value) + (4 * i + 4)) >>> 2) >>> 0];
      view[i + 2] = (growMemViews(), HEAPF32)[(((value) + (4 * i + 8)) >>> 2) >>> 0];
      view[i + 3] = (growMemViews(), HEAPF32)[(((value) + (4 * i + 12)) >>> 2) >>> 0];
      view[i + 4] = (growMemViews(), HEAPF32)[(((value) + (4 * i + 16)) >>> 2) >>> 0];
      view[i + 5] = (growMemViews(), HEAPF32)[(((value) + (4 * i + 20)) >>> 2) >>> 0];
      view[i + 6] = (growMemViews(), HEAPF32)[(((value) + (4 * i + 24)) >>> 2) >>> 0];
      view[i + 7] = (growMemViews(), HEAPF32)[(((value) + (4 * i + 28)) >>> 2) >>> 0];
      view[i + 8] = (growMemViews(), HEAPF32)[(((value) + (4 * i + 32)) >>> 2) >>> 0];
    }
  } else {
    var view = (growMemViews(), HEAPF32).subarray((((value) >>> 2)) >>> 0, ((value + count * 36) >>> 2) >>> 0);
  }
  GLctx.uniformMatrix3fv(webglGetUniformLocation(location), !!transpose, view);
}

function _emscripten_glUniformMatrix4fv(location, count, transpose, value) {
  value >>>= 0;
  if (count <= 18) {
    // avoid allocation when uploading few enough uniforms
    var view = miniTempWebGLFloatBuffers[16 * count];
    // hoist the heap out of the loop for size and for pthreads+growth.
    var heap = (growMemViews(), HEAPF32);
    value = ((value) >>> 2);
    count *= 16;
    for (var i = 0; i < count; i += 16) {
      var dst = value + i;
      view[i] = heap[dst >>> 0];
      view[i + 1] = heap[dst + 1 >>> 0];
      view[i + 2] = heap[dst + 2 >>> 0];
      view[i + 3] = heap[dst + 3 >>> 0];
      view[i + 4] = heap[dst + 4 >>> 0];
      view[i + 5] = heap[dst + 5 >>> 0];
      view[i + 6] = heap[dst + 6 >>> 0];
      view[i + 7] = heap[dst + 7 >>> 0];
      view[i + 8] = heap[dst + 8 >>> 0];
      view[i + 9] = heap[dst + 9 >>> 0];
      view[i + 10] = heap[dst + 10 >>> 0];
      view[i + 11] = heap[dst + 11 >>> 0];
      view[i + 12] = heap[dst + 12 >>> 0];
      view[i + 13] = heap[dst + 13 >>> 0];
      view[i + 14] = heap[dst + 14 >>> 0];
      view[i + 15] = heap[dst + 15 >>> 0];
    }
  } else {
    var view = (growMemViews(), HEAPF32).subarray((((value) >>> 2)) >>> 0, ((value + count * 64) >>> 2) >>> 0);
  }
  GLctx.uniformMatrix4fv(webglGetUniformLocation(location), !!transpose, view);
}

var _emscripten_glUseProgram = program => {
  program = GL.programs[program];
  GLctx.useProgram(program);
  // Record the currently active program so that we can access the uniform
  // mapping table of that program.
  GLctx.currentProgram = program;
};

var _emscripten_glValidateProgram = program => {
  GLctx.validateProgram(GL.programs[program]);
};

var _emscripten_glVertexAttrib1f = (x0, x1) => GLctx.vertexAttrib1f(x0, x1);

function _emscripten_glVertexAttrib1fv(index, v) {
  v >>>= 0;
  GLctx.vertexAttrib1f(index, (growMemViews(), HEAPF32)[v >>> 2]);
}

var _emscripten_glVertexAttrib2f = (x0, x1, x2) => GLctx.vertexAttrib2f(x0, x1, x2);

function _emscripten_glVertexAttrib2fv(index, v) {
  v >>>= 0;
  GLctx.vertexAttrib2f(index, (growMemViews(), HEAPF32)[v >>> 2], (growMemViews(), 
  HEAPF32)[v + 4 >>> 2]);
}

var _emscripten_glVertexAttrib3f = (x0, x1, x2, x3) => GLctx.vertexAttrib3f(x0, x1, x2, x3);

function _emscripten_glVertexAttrib3fv(index, v) {
  v >>>= 0;
  GLctx.vertexAttrib3f(index, (growMemViews(), HEAPF32)[v >>> 2], (growMemViews(), 
  HEAPF32)[v + 4 >>> 2], (growMemViews(), HEAPF32)[v + 8 >>> 2]);
}

var _emscripten_glVertexAttrib4f = (x0, x1, x2, x3, x4) => GLctx.vertexAttrib4f(x0, x1, x2, x3, x4);

function _emscripten_glVertexAttrib4fv(index, v) {
  v >>>= 0;
  GLctx.vertexAttrib4f(index, (growMemViews(), HEAPF32)[v >>> 2], (growMemViews(), 
  HEAPF32)[v + 4 >>> 2], (growMemViews(), HEAPF32)[v + 8 >>> 2], (growMemViews(), 
  HEAPF32)[v + 12 >>> 2]);
}

var _emscripten_glVertexAttribDivisor = (index, divisor) => {
  GLctx.vertexAttribDivisor(index, divisor);
};

var _glVertexAttribDivisor = _emscripten_glVertexAttribDivisor;

var _emscripten_glVertexAttribDivisorANGLE = _glVertexAttribDivisor;

function _emscripten_glVertexAttribPointer(index, size, type, normalized, stride, ptr) {
  ptr >>>= 0;
  GLctx.vertexAttribPointer(index, size, type, !!normalized, stride, ptr);
}

var _emscripten_glViewport = (x0, x1, x2, x3) => GLctx.viewport(x0, x1, x2, x3);

var GLFW3 = {
  fDestructors: [],
  fWindowContexts: null,
  fCustomCursors: null,
  fScaleMQL: null,
  fScaleChangeCallback: null,
  fWindowResizeCallback: null,
  fKeyboardCallback: null,
  fClipboardCallback: null,
  fRequestFullscreen: null,
  fDeferredActions: [],
  fContext: null,
  fCSSValues: null,
  fErrorCodes: {
    GLFW_INVALID_VALUE: 65540,
    GLFW_PLATFORM_ERROR: 65544
  },
  onError(errorCode, errorMessage) {
    if (GLFW3.fErrorHandler) {
      const ptr = stringToNewUTF8(errorMessage);
      getWasmTableEntry(GLFW3.fErrorHandler)(GLFW3.fErrorCodes[errorCode], ptr);
      _free(ptr);
    }
  },
  onScaleChange() {
    if (GLFW3.fScaleChangeCallback) {
      getWasmTableEntry(GLFW3.fScaleChangeCallback)(GLFW3.fContext);
    }
  },
  onWindowResize(glfwWindow, width, height) {
    if (GLFW3.fWindowResizeCallback) {
      getWasmTableEntry(GLFW3.fWindowResizeCallback)(GLFW3.fContext, glfwWindow, width, height);
    }
  },
  isAnyElementFocused: () => document.activeElement !== document.body,
  isAnyOtherElementFocused() {
    return GLFW3.isAnyElementFocused() && GLFW3.findContext(document.activeElement) == null;
  },
  onPaste(e) {
    if (!GLFW3.isAnyOtherElementFocused()) {
      e.preventDefault();
    }
    let clipboardData = e.clipboardData || window.clipboardData;
    let pastedData = clipboardData.getData("text/plain");
    if (pastedData !== "" && GLFW3.fClipboardCallback) {
      const pastedString = stringToNewUTF8(pastedData);
      getWasmTableEntry(GLFW3.fClipboardCallback)(GLFW3.fContext, pastedString, null);
      _free(pastedString);
    }
  },
  onCutOrCopy(e) {
    if (GLFW3.fClipboardCallback) {
      const windowSelection = window.getSelection();
      if (windowSelection && windowSelection.toString() !== "") {
        const selection = stringToNewUTF8(windowSelection.toString());
        getWasmTableEntry(GLFW3.fClipboardCallback)(GLFW3.fContext, selection, null);
        _free(selection);
      } else {
        if (!GLFW3.isAnyOtherElementFocused()) {
          // this is to prevent the browser to beep on empty clipboard
          e.clipboardData.setData("text/plain", " ");
          e.preventDefault();
        }
      }
    }
  },
  onMouseEvent(e) {
    requestAnimationFrame(GLFW3.executeDeferredActions);
  },
  onKeyboardEvent(e) {
    if (e.type === "keydown") requestAnimationFrame(GLFW3.executeDeferredActions);
    if (GLFW3.fKeyboardCallback) {
      const code = stringToNewUTF8(e.code);
      const key = stringToNewUTF8(e.key);
      // see https://developer.mozilla.org/en-US/docs/Web/API/UI_Events/Keyboard_event_key_values
      var codepoint = e.key.charCodeAt(0);
      if (codepoint < 127 && e.key.length > 1) // case when eventKey is something like "Tab" (eventKey.charCodeAt(0) would be "T")
      codepoint = 0;
      var modifierBits = 0;
      if (e.shiftKey) modifierBits |= 1;
      if (e.ctrlKey) modifierBits |= 2;
      if (e.altKey) modifierBits |= 4;
      if (e.metaKey) modifierBits |= 8;
      // if(e.getModifierState('CapsLock')) modifierBits |= 0x0010;
      // if(e.getModifierState('NumLock')) modifierBits |= 0x0020;
      if (getWasmTableEntry(GLFW3.fKeyboardCallback)(GLFW3.fContext, e.type === "keydown", code, key, e.repeat, codepoint, modifierBits)) e.preventDefault();
      _free(key);
      _free(code);
    }
  },
  executeDeferredActions() {
    if (GLFW3.fDeferredActions.length > 0) {
      for (let action of GLFW3.fDeferredActions) action();
      GLFW3.fDeferredActions.length = 0;
    }
  },
  deferAction(action) {
    GLFW3.fDeferredActions.push(action);
  },
  findContextByCanvas(canvas) {
    for (let w in GLFW3.fWindowContexts) {
      if (GLFW3.fWindowContexts[w].canvas === canvas) {
        return GLFW3.fWindowContexts[w];
      }
    }
    return null;
  },
  findContextBySelector__deps: [ "$findEventTarget" ],
  findContextBySelector(canvasSelector) {
    return typeof canvasSelector === "string" ? GLFW3.findContextByCanvas(findEventTarget(canvasSelector)) : null;
  },
  findContext(any) {
    if (!any) return null;
    // is any a glfwWindow?
    if (GLFW3.fWindowContexts[any]) return GLFW3.fWindowContexts[any];
    // is any a canvas?
    if (any instanceof HTMLCanvasElement) return GLFW3.findContextByCanvas(any);
    // is any a selector?
    return GLFW3.findContextBySelector(any);
  },
  requestFullscreen(target, lockPointer, resizeCanvas) {
    if (GLFW3.fRequestFullscreen) {
      const ctx = GLFW3.findContext(target);
      getWasmTableEntry(GLFW3.fRequestFullscreen)(ctx ? ctx.glfwWindow : 0, lockPointer, resizeCanvas);
    }
  },
  backupCSSValues(element, ...names) {
    if (!GLFW3.fCSSValues.has(element)) {
      GLFW3.fCSSValues.set(element, {});
    }
    const properties = GLFW3.fCSSValues.get(element);
    names.forEach(name => properties[name] = element.style.getPropertyValue(name));
  },
  setCSSValue(element, name, value) {
    if (!GLFW3.fCSSValues.get(element)?.hasOwnProperty(name)) {
      GLFW3.backupCSSValues(element, name);
    }
    element.style.setProperty(name, value);
  },
  restoreCSSValues(element, ...names) {
    const properties = GLFW3.fCSSValues.get(element);
    if (!properties) return;
    if (names.length === 0) names = Object.keys(properties);
    names.forEach(name => {
      const value = properties[name];
      if (!value) element.style.removeProperty(name); else element.style.setProperty(name, value);
      delete properties[name];
    });
    if (Object.keys(properties).length === 0) {
      GLFW3.fCSSValues.delete(element);
    }
  },
  setCanvasResizeSelector__deps: [ "$findEventTarget" ],
  setCanvasResizeSelector: (any, canvasResizeSelector) => {
    const ctx = GLFW3.findContext(any);
    if (!ctx) {
      GLFW3.onError("GLFW_INVALID_VALUE", `Cannot find canvas [${any !== null ? any.toString() : "nullptr"}]`);
      return -4;
    }
    if (ctx.fCanvasResize) {
      ctx.fCanvasResize.destroy();
      delete ctx.fCanvasResize;
    }
    if (canvasResizeSelector) {
      const canvasResize = findEventTarget(canvasResizeSelector);
      if (!canvasResize) {
        GLFW3.onError("GLFW_INVALID_VALUE", `Cannot find canvas resize selector [${canvasResizeSelector}]`);
        return -4;
      }
      const glfwWindow = ctx.glfwWindow;
      ctx.fCanvasResize = {
        target: canvasResize,
        destructors: []
      };
      ctx.fCanvasResize.addEventListener = (elt, type, listener) => {
        elt.addEventListener(type, listener);
        ctx.fCanvasResize.destructors.push(() => {
          elt.removeEventListener(type, listener);
        });
      };
      ctx.fCanvasResize.destroy = () => {
        for (let destructor of ctx.fCanvasResize.destructors) destructor();
      };
      if (canvasResize === window) {
        ctx.fCanvasResize.computeSize = () => ({
          width: window.innerWidth,
          height: window.innerHeight
        });
        const listener = e => {
          const size = ctx.fCanvasResize.computeSize();
          GLFW3.onWindowResize(glfwWindow, size.width, size.height);
        };
        ctx.fCanvasResize.observer = {
          observe: elt => {
            window.addEventListener("resize", listener);
          },
          disconnect: () => {
            window.removeEventListener("resize", listener);
          }
        };
      } else {
        ctx.fCanvasResize.destructors.push(() => {
          GLFW3.restoreCSSValues(canvasResize);
        });
        ctx.fCanvasResize.computeSize = () => {
          const style = getComputedStyle(canvasResize);
          return {
            width: parseInt(style.width, 10),
            height: parseInt(style.height, 10)
          };
        };
        ctx.fCanvasResize.observer = new ResizeObserver(entries => {
          const ctx = GLFW3.fWindowContexts[glfwWindow];
          if (ctx.fCanvasResize) {
            for (const entry of entries) {
              if (entry.target === canvasResize) {
                const size = ctx.fCanvasResize.computeSize();
                GLFW3.onWindowResize(glfwWindow, size.width, size.height);
              }
            }
          }
        });
      }
      ctx.fCanvasResize.destructors.push(() => {
        ctx.fCanvasResize.observer.disconnect();
      });
      ctx.fCanvasResize.observer.observe(canvasResize);
      const size = ctx.fCanvasResize.computeSize();
      GLFW3.onWindowResize(glfwWindow, size.width, size.height);
    }
    return 0;
  },
  makeCanvasResizable__deps: [ "$findEventTarget" ],
  makeCanvasResizable: (any, resizableSelector, handleSelector) => {
    if (!resizableSelector) {
      GLFW3.onError("GLFW_INVALID_VALUE", `canvas resize selector is required`);
      return -4;
    }
    // first we set the canvas resize selector
    const res = GLFW3.setCanvasResizeSelector(any, resizableSelector);
    if (res !== 0) return res;
    // no handle, no need to continue
    if (!handleSelector) return 0;
    const ctx = GLFW3.findContext(any);
    const resizable = findEventTarget(resizableSelector);
    const handle = findEventTarget(handleSelector);
    if (!handle) {
      GLFW3.onError("GLFW_INVALID_VALUE", `Cannot find handle element with selector [${handleSelector}]`);
      return -4;
    }
    var lastDownX = 0;
    var lastDownY = 0;
    var size = undefined;
    var touchId = undefined;
    ctx.fCanvasResize.onSizeChanged = (width, height) => {
      if (size === undefined) {
        // while not resizing (otherwise it conflicts)
        GLFW3.setCSSValue(resizable, "width", `${width}px`);
        GLFW3.setCSSValue(resizable, "height", `${height}px`);
      }
    };
    function computeSize(element) {
      const style = getComputedStyle(element);
      return {
        width: parseFloat(style.width),
        height: parseFloat(style.height)
      };
    }
    // mouse down (target handle) => record size + location
    const onMouseDown = e => {
      size = computeSize(resizable);
      lastDownX = e.clientX;
      lastDownY = e.clientY;
    };
    ctx.fCanvasResize.addEventListener(handle, "mousedown", onMouseDown);
    // mouse move (target window) => if resizing, compute new size and make resizable this size
    const onMouseMove = e => {
      if (size !== undefined) {
        var offsetX = lastDownX - e.clientX;
        var offsetY = lastDownY - e.clientY;
        size.width -= offsetX;
        size.height -= offsetY;
        if (size.width < 0) size.width = 0;
        if (size.height < 0) size.height = 0;
        GLFW3.setCSSValue(resizable, "width", `${size.width}px`);
        GLFW3.setCSSValue(resizable, "height", `${size.height}px`);
        lastDownX = e.clientX;
        lastDownY = e.clientY;
      }
    };
    ctx.fCanvasResize.addEventListener(window, "mousemove", onMouseMove);
    // mouse up (target window) => if resizing, compute canvas size and adjust resizable accordingly
    const onMouseUp = e => {
      if (size !== undefined) {
        const canvasSize = computeSize(ctx.canvas);
        GLFW3.setCSSValue(resizable, "width", `${canvasSize.width}px`);
        GLFW3.setCSSValue(resizable, "height", `${canvasSize.height}px`);
        size = undefined;
      }
    };
    ctx.fCanvasResize.addEventListener(window, "mouseup", onMouseUp);
    // touchstart
    const onTouchStart = e => {
      if (touchId === undefined && e.touches && e.touches.length === 1) {
        const touch = e.touches[0];
        touchId = touch.identifier;
        e.preventDefault();
        onMouseDown(touch);
      }
    };
    ctx.fCanvasResize.addEventListener(handle, "touchstart", onTouchStart);
    // touchmove
    const onTouchMove = e => {
      if (size !== undefined && touchId !== undefined) {
        const touch = e.changedTouches ? Array.from(e.changedTouches).find(touch => touch.identifier === touchId) : undefined;
        if (touch !== undefined) {
          onMouseMove(touch);
        }
      }
    };
    ctx.fCanvasResize.addEventListener(window, "touchmove", onTouchMove);
    // touchend/touchcancel
    const onTouchEnd = e => {
      if (size !== undefined && touchId !== undefined) {
        const touch = e.changedTouches ? Array.from(e.changedTouches).find(touch => touch.identifier === touchId) : undefined;
        if (touch !== undefined) {
          touchId = undefined;
          onMouseUp(touch);
        }
      }
    };
    ctx.fCanvasResize.addEventListener(window, "touchend", onTouchEnd);
    ctx.fCanvasResize.addEventListener(window, "touchcancel", onTouchEnd);
    return 0;
  },
  unmakeCanvasResizable: any => GLFW3.setCanvasResizeSelector(any, null)
};

function _emscripten_glfw3_context_destroy() {
  if (ENVIRONMENT_IS_PTHREAD) return proxyToMainThread(15, 0, 1);
  GLFW3.fWindowContexts = null;
  GLFW3.fCustomCursors = null;
  GLFW3.fCSSValues = null;
  GLFW3.fScaleChangeCallback = null;
  GLFW3.fWindowResizeCallback = null;
  GLFW3.fKeyboardCallback = null;
  GLFW3.fClipboardCallback = null;
  GLFW3.fRequestFullscreen = null;
  for (let destructor of GLFW3.fDestructors) destructor();
  GLFW3.fContext = null;
}

function _emscripten_glfw3_context_get_fullscreen_window() {
  if (ENVIRONMENT_IS_PTHREAD) return proxyToMainThread(16, 0, 1);
  const ctx = GLFW3.findContextByCanvas(document.fullscreenElement);
  return ctx ? ctx.glfwWindow : null;
}

var _emscripten_glfw3_context_get_now = () => performance.now();

var GLFW3_perf = performance;

var _emscripten_glfw3_context_get_now_cached = () => GLFW3_perf.now();

function _emscripten_glfw3_context_get_pointer_lock_window() {
  if (ENVIRONMENT_IS_PTHREAD) return proxyToMainThread(17, 0, 1);
  const ctx = GLFW3.findContextByCanvas(document.pointerLockElement);
  return ctx ? ctx.glfwWindow : null;
}

function _emscripten_glfw3_context_init(context, scale, scaleChangeCallback, windowResizeCallback, keyboardCallback, clipboardCallback, requestFullscreen, errorHandler) {
  if (ENVIRONMENT_IS_PTHREAD) return proxyToMainThread(18, 0, 1, context, scale, scaleChangeCallback, windowResizeCallback, keyboardCallback, clipboardCallback, requestFullscreen, errorHandler);
  context >>>= 0;
  scaleChangeCallback >>>= 0;
  windowResizeCallback >>>= 0;
  keyboardCallback >>>= 0;
  clipboardCallback >>>= 0;
  requestFullscreen >>>= 0;
  errorHandler >>>= 0;
  // For backward compatibility with emscripten, defaults to getting the canvas from Module
  specialHTMLTargets["Module['canvas']"] = Module.canvas;
  specialHTMLTargets["window"] = window;
  GLFW3.fWindowContexts = {};
  GLFW3.fCustomCursors = {};
  GLFW3.fCSSValues = new Map;
  GLFW3.fScaleChangeCallback = scaleChangeCallback;
  GLFW3.fWindowResizeCallback = windowResizeCallback;
  GLFW3.fKeyboardCallback = keyboardCallback;
  GLFW3.fClipboardCallback = clipboardCallback;
  GLFW3.fRequestFullscreen = requestFullscreen;
  GLFW3.fErrorHandler = errorHandler;
  GLFW3.fContext = context;
  // handle scale change
  GLFW3.fScaleMQL = window.matchMedia("(resolution: " + scale + "dppx)");
  GLFW3.fScaleMQL.addEventListener("change", GLFW3.onScaleChange);
  GLFW3.fDestructors.push(() => {
    if (GLFW3.fScaleMQL) {
      GLFW3.fScaleMQL.removeEventListener("change", GLFW3.onScaleChange);
    }
  });
  // handle mouse
  document.addEventListener("mouseup", GLFW3.onMouseEvent);
  GLFW3.fDestructors.push(() => {
    document.removeEventListener("mouseup", GLFW3.onMouseEvent);
  });
  document.addEventListener("mousedown", GLFW3.onMouseEvent);
  GLFW3.fDestructors.push(() => {
    document.removeEventListener("mousedown", GLFW3.onMouseEvent);
  });
  // handle keyboard
  document.addEventListener("keydown", GLFW3.onKeyboardEvent);
  GLFW3.fDestructors.push(() => {
    document.removeEventListener("keydown", GLFW3.onKeyboardEvent);
  });
  document.addEventListener("keyup", GLFW3.onKeyboardEvent);
  GLFW3.fDestructors.push(() => {
    document.removeEventListener("keyup", GLFW3.onKeyboardEvent);
  });
  // handle clipboard
  document.addEventListener("cut", GLFW3.onCutOrCopy);
  GLFW3.fDestructors.push(() => {
    document.removeEventListener("cut", GLFW3.onCutOrCopy);
  });
  document.addEventListener("copy", GLFW3.onCutOrCopy);
  GLFW3.fDestructors.push(() => {
    document.removeEventListener("copy", GLFW3.onCutOrCopy);
  });
  document.addEventListener("paste", GLFW3.onPaste);
  GLFW3.fDestructors.push(() => {
    document.removeEventListener("paste", GLFW3.onPaste);
  });
}

function _emscripten_glfw3_context_is_any_element_focused() {
  if (ENVIRONMENT_IS_PTHREAD) return proxyToMainThread(19, 0, 1);
  return GLFW3.isAnyElementFocused();
}

function _emscripten_glfw3_context_is_runtime_platform_apple() {
  if (ENVIRONMENT_IS_PTHREAD) return proxyToMainThread(20, 0, 1);
  return navigator.platform.indexOf("Mac") === 0 || navigator.platform === "iPhone";
}

var _emscripten_glfw3_context_keyboard_lock = function(enable) {
  if (ENVIRONMENT_IS_PTHREAD) return proxyToMainThread(21, 0, 1, enable);
  if (!navigator.keyboard || !navigator.keyboard.lock) return;
  if (enable) {
    try {
      const p = navigator.keyboard.lock([ "Escape" ]);
      if (p && typeof p.catch === "function") p.catch(() => {});
    } catch (e) {}
  } else {
    try {
      navigator.keyboard.unlock();
    } catch (e) {}
  }
};

function _emscripten_glfw3_context_make_canvas_resizable(glfwWindow, resizableSelector, handleSelector) {
  if (ENVIRONMENT_IS_PTHREAD) return proxyToMainThread(22, 0, 1, glfwWindow, resizableSelector, handleSelector);
  glfwWindow >>>= 0;
  resizableSelector >>>= 0;
  handleSelector >>>= 0;
  resizableSelector = resizableSelector ? UTF8ToString(resizableSelector) : null;
  handleSelector = handleSelector ? UTF8ToString(handleSelector) : null;
  return GLFW3.makeCanvasResizable(glfwWindow, resizableSelector, handleSelector);
}

var _emscripten_glfw3_context_open_url = function(url, target) {
  if (ENVIRONMENT_IS_PTHREAD) return proxyToMainThread(23, 0, 1, url, target);
  url >>>= 0;
  target >>>= 0;
  if (url) {
    url = UTF8ToString(url);
    target = target ? UTF8ToString(target) : null;
    GLFW3.deferAction(() => {
      window.open(url, target);
    });
  }
};

var _emscripten_glfw3_context_set_clipboard_string = function(content) {
  if (ENVIRONMENT_IS_PTHREAD) return proxyToMainThread(24, 0, 1, content);
  content >>>= 0;
  content = content ? UTF8ToString(content) : "";
  const errorHandler = err => {
    if (GLFW3.fClipboardCallback) {
      const errorString = stringToNewUTF8(`${err}`);
      getWasmTableEntry(GLFW3.fClipboardCallback)(GLFW3.fContext, null, errorString);
      _free(errorString);
    } else {
      GLFW3.onError("GLFW_PLATFORM_ERROR", `Cannot set clipboard string [${err}]`);
    }
  };
  if (navigator.clipboard) {
    GLFW3.deferAction(() => {
      navigator.clipboard.writeText(content).then(() => {
        if (GLFW3.fClipboardCallback) {
          const string = stringToNewUTF8(content);
          getWasmTableEntry(GLFW3.fClipboardCallback)(GLFW3.fContext, string, null);
          _free(string);
        }
      }).catch(errorHandler);
    });
  } else {
    errorHandler("Missing navigator.clipboard");
  }
};

function _emscripten_glfw3_context_set_title(title) {
  if (ENVIRONMENT_IS_PTHREAD) return proxyToMainThread(25, 0, 1, title);
  title >>>= 0;
  if (title) document.title = UTF8ToString(title);
}

function _emscripten_glfw3_context_unmake_canvas_resizable(glfwWindow) {
  if (ENVIRONMENT_IS_PTHREAD) return proxyToMainThread(26, 0, 1, glfwWindow);
  glfwWindow >>>= 0;
  return GLFW3.unmakeCanvasResizable(glfwWindow);
}

function _emscripten_glfw3_create_custom_cursor(glfwCursor, width, height, pixels) {
  if (ENVIRONMENT_IS_PTHREAD) return proxyToMainThread(27, 0, 1, glfwCursor, width, height, pixels);
  glfwCursor >>>= 0;
  pixels >>>= 0;
  // Use a canvas element to get a dataURL that will be used as the CSS value (url(xx))
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  const imageData = ctx.createImageData(width, height);
  for (let i = 0; i < width * height * 4; i++) {
    var p = getValue(pixels + i, "i8");
    if (p < 0) p += 256;
    imageData.data[i] = p;
  }
  ctx.putImageData(imageData, 0, 0);
  GLFW3.fCustomCursors[glfwCursor] = canvas.toDataURL();
}

function _emscripten_glfw3_destroy_custom_cursor(glfwCursor) {
  if (ENVIRONMENT_IS_PTHREAD) return proxyToMainThread(28, 0, 1, glfwCursor);
  glfwCursor >>>= 0;
  delete GLFW3.fCustomCursors[glfwCursor];
}

function _emscripten_glfw3_window_change_focus(glfwWindow, isFocussed) {
  if (ENVIRONMENT_IS_PTHREAD) return proxyToMainThread(29, 0, 1, glfwWindow, isFocussed);
  glfwWindow >>>= 0;
  const canvas = GLFW3.fWindowContexts[glfwWindow].canvas;
  if (isFocussed) {
    canvas.focus();
  } else {
    canvas.blur();
  }
}

function _emscripten_glfw3_window_destroy(glfwWindow) {
  if (ENVIRONMENT_IS_PTHREAD) return proxyToMainThread(30, 0, 1, glfwWindow);
  glfwWindow >>>= 0;
  if (GLFW3.fWindowContexts) {
    const ctx = GLFW3.fWindowContexts[glfwWindow];
    if (!ctx) // could happen if error during init
    return;
    const canvas = ctx.canvas;
    ctx.restoreCSSValues();
    _emscripten_set_canvas_element_size(ctx.CSelector, ctx.originalSize.width, ctx.originalSize.height);
    _free(ctx.CSelector);
    if (ctx.fCanvasResize) {
      ctx.fCanvasResize.destroy();
      delete ctx.fCanvasResize;
    }
    delete GLFW3.fWindowContexts[glfwWindow];
  }
}

function _emscripten_glfw3_window_get_computed_opacity(glfwWindow) {
  if (ENVIRONMENT_IS_PTHREAD) return proxyToMainThread(31, 0, 1, glfwWindow);
  glfwWindow >>>= 0;
  return GLFW3.fWindowContexts[glfwWindow].getComputedCSSValue("opacity");
}

function _emscripten_glfw3_window_get_computed_visibility(glfwWindow) {
  if (ENVIRONMENT_IS_PTHREAD) return proxyToMainThread(32, 0, 1, glfwWindow);
  glfwWindow >>>= 0;
  return GLFW3.fWindowContexts[glfwWindow].getComputedCSSValue("display") !== "none";
}

function _emscripten_glfw3_window_get_position(glfwWindow, x, y) {
  if (ENVIRONMENT_IS_PTHREAD) return proxyToMainThread(33, 0, 1, glfwWindow, x, y);
  glfwWindow >>>= 0;
  x >>>= 0;
  y >>>= 0;
  const canvas = GLFW3.fWindowContexts[glfwWindow].canvas;
  const rect = getBoundingClientRect(canvas);
  (growMemViews(), HEAP32)[((x) >>> 2) >>> 0] = rect.x;
  (growMemViews(), HEAP32)[((y) >>> 2) >>> 0] = rect.y;
}

function _emscripten_glfw3_window_init(glfwWindow, canvasSelector) {
  if (ENVIRONMENT_IS_PTHREAD) return proxyToMainThread(34, 0, 1, glfwWindow, canvasSelector);
  glfwWindow >>>= 0;
  canvasSelector >>>= 0;
  canvasSelector = UTF8ToString(canvasSelector);
  const canvas = findEventTarget(canvasSelector);
  if (!canvas) return -4;
  // check for duplicate
  if (GLFW3.findContextByCanvas(canvas)) {
    return -3;
  }
  var canvasCtx = {};
  canvasCtx.glfwWindow = glfwWindow;
  canvasCtx.selector = canvasSelector;
  canvasCtx.CSelector = stringToNewUTF8(canvasSelector);
  canvasCtx.canvas = canvas;
  canvasCtx.originalSize = {
    width: canvas.width,
    height: canvas.height
  };
  canvasCtx.restoreCSSValue = name => {
    GLFW3.restoreCSSValues(canvas, name);
  };
  canvasCtx.restoreCSSValues = () => {
    GLFW3.restoreCSSValues(canvas);
  };
  canvasCtx.setCSSValue = (name, value) => {
    GLFW3.setCSSValue(canvas, name, value);
  };
  canvasCtx.getComputedCSSValue = name => window.getComputedStyle(canvas).getPropertyValue(name);
  GLFW3.fWindowContexts[canvasCtx.glfwWindow] = canvasCtx;
  return 0;
}

function _emscripten_glfw3_window_on_created(glfwWindow) {
  if (ENVIRONMENT_IS_PTHREAD) return proxyToMainThread(35, 0, 1, glfwWindow);
  glfwWindow >>>= 0;
  if (Module.glfwOnWindowCreated) {
    Module.glfwOnWindowCreated(glfwWindow, GLFW3.fWindowContexts[glfwWindow].selector);
  }
}

var _emscripten_glfw3_window_resize_offscreen_local = (width, height) => {
  if (typeof GL === "undefined" || !GL.offscreenCanvases) return;
  for (const key in GL.offscreenCanvases) {
    const info = GL.offscreenCanvases[key];
    const oc = info && info.offscreenCanvas;
    if (!oc) continue;
    try {
      if (oc.width !== width) oc.width = width;
      if (oc.height !== height) oc.height = height;
    } catch (e) {}
  }
};

function _emscripten_glfw3_window_set_custom_cursor(glfwWindow, glfwCursor, xhot, yhot) {
  if (ENVIRONMENT_IS_PTHREAD) return proxyToMainThread(36, 0, 1, glfwWindow, glfwCursor, xhot, yhot);
  glfwWindow >>>= 0;
  glfwCursor >>>= 0;
  const ctx = GLFW3.fWindowContexts[glfwWindow];
  const cursor = GLFW3.fCustomCursors[glfwCursor];
  if (cursor) ctx.setCSSValue("cursor", `url(${cursor}) ${xhot} ${yhot}, auto`); else ctx.restoreCSSValue("cursor");
}

function _emscripten_glfw3_window_set_opacity(glfwWindow, opacity) {
  if (ENVIRONMENT_IS_PTHREAD) return proxyToMainThread(37, 0, 1, glfwWindow, opacity);
  glfwWindow >>>= 0;
  const ctx = GLFW3.fWindowContexts[glfwWindow];
  ctx.setCSSValue("opacity", opacity);
}

function _emscripten_glfw3_window_set_size(glfwWindow, width, height, fbWidth, fbHeight) {
  if (ENVIRONMENT_IS_PTHREAD) return proxyToMainThread(38, 0, 1, glfwWindow, width, height, fbWidth, fbHeight);
  glfwWindow >>>= 0;
  const ctx = GLFW3.fWindowContexts[glfwWindow];
  const canvas = ctx.canvas;
  _emscripten_set_canvas_element_size(ctx.CSelector, fbWidth, fbHeight);
  // this will (on purpose) override any css setting
  ctx.setCSSValue("width", width + "px", "important");
  ctx.setCSSValue("height", height + "px", "important");
  if (ctx.fCanvasResize && ctx.fCanvasResize.onSizeChanged) ctx.fCanvasResize.onSizeChanged(width, height);
}

function _emscripten_glfw3_window_set_standard_cursor(glfwWindow, cursor) {
  if (ENVIRONMENT_IS_PTHREAD) return proxyToMainThread(39, 0, 1, glfwWindow, cursor);
  glfwWindow >>>= 0;
  cursor >>>= 0;
  const ctx = GLFW3.fWindowContexts[glfwWindow];
  if (cursor) ctx.setCSSValue("cursor", UTF8ToString(cursor)); else ctx.restoreCSSValue("cursor");
}

function _emscripten_glfw3_window_set_visibility(glfwWindow, visible) {
  if (ENVIRONMENT_IS_PTHREAD) return proxyToMainThread(40, 0, 1, glfwWindow, visible);
  glfwWindow >>>= 0;
  const ctx = GLFW3.fWindowContexts[glfwWindow];
  if (!visible) ctx.setCSSValue("display", "none"); else ctx.restoreCSSValue("display");
}

var _emscripten_has_asyncify = () => 0;

var _emscripten_num_logical_cores = () => navigator["hardwareConcurrency"];

function _emscripten_out(str) {
  str >>>= 0;
  return out(UTF8ToString(str));
}

var doRequestFullscreen = (target, strategy) => {
  if (!JSEvents.fullscreenEnabled()) return -1;
  target = findEventTarget(target);
  if (!target) return -4;
  if (!target.requestFullscreen) {
    return -3;
  }
  // Queue this function call if we're not currently in an event handler and
  // the user saw it appropriate to do so.
  if (!JSEvents.canPerformEventHandlerRequests()) {
    if (strategy.deferUntilInEventHandler) {
      JSEvents.deferCall(JSEvents_requestFullscreen, 1, [ target, strategy ]);
      return 1;
    }
    return -2;
  }
  return JSEvents_requestFullscreen(target, strategy);
};

function _emscripten_request_fullscreen(target, deferUntilInEventHandler) {
  if (ENVIRONMENT_IS_PTHREAD) return proxyToMainThread(41, 0, 1, target, deferUntilInEventHandler);
  target >>>= 0;
  var strategy = {
    // These options perform no added logic, but just bare request fullscreen.
    scaleMode: 0,
    canvasResolutionScaleMode: 0,
    filteringMode: 0,
    deferUntilInEventHandler,
    canvasResizedCallbackTargetThread: 2
  };
  return doRequestFullscreen(target, strategy);
}

function _emscripten_request_fullscreen_strategy(target, deferUntilInEventHandler, fullscreenStrategy) {
  if (ENVIRONMENT_IS_PTHREAD) return proxyToMainThread(42, 0, 1, target, deferUntilInEventHandler, fullscreenStrategy);
  target >>>= 0;
  fullscreenStrategy >>>= 0;
  var strategy = {
    scaleMode: (growMemViews(), HEAP32)[((fullscreenStrategy) >>> 2) >>> 0],
    canvasResolutionScaleMode: (growMemViews(), HEAP32)[(((fullscreenStrategy) + (4)) >>> 2) >>> 0],
    filteringMode: (growMemViews(), HEAP32)[(((fullscreenStrategy) + (8)) >>> 2) >>> 0],
    deferUntilInEventHandler,
    canvasResizedCallbackTargetThread: (growMemViews(), HEAP32)[(((fullscreenStrategy) + (20)) >>> 2) >>> 0],
    canvasResizedCallback: (growMemViews(), HEAP32)[(((fullscreenStrategy) + (12)) >>> 2) >>> 0],
    canvasResizedCallbackUserData: (growMemViews(), HEAP32)[(((fullscreenStrategy) + (16)) >>> 2) >>> 0]
  };
  return doRequestFullscreen(target, strategy);
}

function _emscripten_request_pointerlock(target, deferUntilInEventHandler) {
  if (ENVIRONMENT_IS_PTHREAD) return proxyToMainThread(43, 0, 1, target, deferUntilInEventHandler);
  target >>>= 0;
  target = findEventTarget(target);
  if (!target) return -4;
  if (!target.requestPointerLock) {
    return -1;
  }
  // Queue this function call if we're not currently in an event handler and
  // the user saw it appropriate to do so.
  if (!JSEvents.canPerformEventHandlerRequests()) {
    if (deferUntilInEventHandler) {
      JSEvents.deferCall(requestPointerLock, 2, [ target ]);
      return 1;
    }
    return -2;
  }
  return requestPointerLock(target);
}

var alignMemory = (size, alignment) => Math.ceil(size / alignment) * alignment;

var growMemory = size => {
  var oldHeapSize = wasmMemory.buffer.byteLength;
  var pages = ((size - oldHeapSize + 65535) / 65536) | 0;
  try {
    // round size grow request up to wasm page size (fixed 64KB per spec)
    wasmMemory.grow(pages);
    // .grow() takes a delta compared to the previous size
    updateMemoryViews();
    return 1;
  } catch (e) {}
};

function _emscripten_resize_heap(requestedSize) {
  requestedSize >>>= 0;
  var oldSize = (growMemViews(), HEAPU8).length;
  // With multithreaded builds, races can happen (another thread might increase the size
  // in between), so return a failure, and let the caller retry.
  if (requestedSize <= oldSize) {
    return false;
  }
  // Memory resize rules:
  // 1.  Always increase heap size to at least the requested size, rounded up
  //     to next page multiple.
  // 2a. If MEMORY_GROWTH_LINEAR_STEP == -1, excessively resize the heap
  //     geometrically: increase the heap size according to
  //     MEMORY_GROWTH_GEOMETRIC_STEP factor (default +20%), At most
  //     overreserve by MEMORY_GROWTH_GEOMETRIC_CAP bytes (default 96MB).
  // 2b. If MEMORY_GROWTH_LINEAR_STEP != -1, excessively resize the heap
  //     linearly: increase the heap size by at least
  //     MEMORY_GROWTH_LINEAR_STEP bytes.
  // 3.  Max size for the heap is capped at 2048MB-WASM_PAGE_SIZE, or by
  //     MAXIMUM_MEMORY, or by ASAN limit, depending on which is smallest
  // 4.  If we were unable to allocate as much memory, it may be due to
  //     over-eager decision to excessively reserve due to (3) above.
  //     Hence if an allocation fails, cut down on the amount of excess
  //     growth, in an attempt to succeed to perform a smaller allocation.
  // A limit is set for how much we can grow. We should not exceed that
  // (the wasm binary specifies it, so if we tried, we'd fail anyhow).
  var maxHeapSize = getHeapMax();
  if (requestedSize > maxHeapSize) {
    return false;
  }
  // Loop through potential heap size increases. If we attempt a too eager
  // reservation that fails, cut down on the attempted size and reserve a
  // smaller bump instead. (max 3 times, chosen somewhat arbitrarily)
  for (var cutDown = 1; cutDown <= 4; cutDown *= 2) {
    var overGrownHeapSize = oldSize * (1 + .2 / cutDown);
    // ensure geometric growth
    // but limit overreserving (default to capping at +96MB overgrowth at most)
    overGrownHeapSize = Math.min(overGrownHeapSize, requestedSize + 100663296);
    var newSize = Math.min(maxHeapSize, alignMemory(Math.max(requestedSize, overGrownHeapSize), 65536));
    var replacement = growMemory(newSize);
    if (replacement) {
      return true;
    }
  }
  return false;
}

/** @suppress {checkTypes} */ function _emscripten_sample_gamepad_data() {
  if (ENVIRONMENT_IS_PTHREAD) return proxyToMainThread(44, 0, 1);
  try {
    if (navigator.getGamepads) return (JSEvents.lastGamepadState = navigator.getGamepads()) ? 0 : -1;
  } catch (e) {
    navigator.getGamepads = null;
  }
  return -1;
}

var registerBeforeUnloadEventCallback = (target, userData, useCapture, callbackfunc, eventTypeId, eventTypeString) => {
  var beforeUnloadEventHandlerFunc = e => {
    // Note: This is always called on the main browser thread, since it needs synchronously return a value!
    var confirmationMessage = getWasmTableEntry(callbackfunc)(eventTypeId, 0, userData);
    if (confirmationMessage) {
      confirmationMessage = UTF8ToString(confirmationMessage);
    }
    if (confirmationMessage) {
      e.preventDefault();
      e.returnValue = confirmationMessage;
      return confirmationMessage;
    }
  };
  var eventHandler = {
    target: findEventTarget(target),
    eventTypeString,
    eventTypeId,
    userData,
    callbackfunc,
    handlerFunc: beforeUnloadEventHandlerFunc,
    useCapture
  };
  return JSEvents.registerOrRemoveHandler(eventHandler);
};

function _emscripten_set_beforeunload_callback_on_thread(userData, callbackfunc, targetThread) {
  if (ENVIRONMENT_IS_PTHREAD) return proxyToMainThread(45, 0, 1, userData, callbackfunc, targetThread);
  userData >>>= 0;
  callbackfunc >>>= 0;
  targetThread >>>= 0;
  if (typeof onbeforeunload == "undefined") return -1;
  // beforeunload callback can only be registered on the main browser thread, because the page will go away immediately after returning from the handler,
  // and there is no time to start proxying it anywhere.
  if (targetThread !== 1) return -5;
  return registerBeforeUnloadEventCallback(2, userData, true, callbackfunc, 28, "beforeunload");
}

var registerFocusEventCallback = (target, userData, useCapture, callbackfunc, eventTypeId, eventTypeString, targetThread) => {
  targetThread = JSEvents.getTargetThreadForEventCallback(targetThread);
  var eventSize = 256;
  JSEvents.focusEvent ||= _malloc(eventSize);
  var focusEventHandlerFunc = e => {
    var nodeName = JSEvents.getNodeNameForTarget(e.target);
    var id = e.target.id ?? "";
    var focusEvent = JSEvents.focusEvent;
    stringToUTF8(nodeName, focusEvent + 0, 128);
    stringToUTF8(id, focusEvent + 128, 128);
    if (targetThread) __emscripten_run_callback_on_thread(targetThread, callbackfunc, eventTypeId, focusEvent, eventSize, userData); else if (getWasmTableEntry(callbackfunc)(eventTypeId, focusEvent, userData)) e.preventDefault();
  };
  var eventHandler = {
    target: findEventTarget(target),
    eventTypeString,
    eventTypeId,
    userData,
    callbackfunc,
    handlerFunc: focusEventHandlerFunc,
    useCapture
  };
  return JSEvents.registerOrRemoveHandler(eventHandler);
};

function _emscripten_set_blur_callback_on_thread(target, userData, useCapture, callbackfunc, targetThread) {
  if (ENVIRONMENT_IS_PTHREAD) return proxyToMainThread(46, 0, 1, target, userData, useCapture, callbackfunc, targetThread);
  target >>>= 0;
  userData >>>= 0;
  callbackfunc >>>= 0;
  targetThread >>>= 0;
  return registerFocusEventCallback(target, userData, useCapture, callbackfunc, 12, "blur", targetThread);
}

var fillDeviceMotionEventData = (eventStruct, e, target) => {
  var a = e.acceleration;
  var ag = e.accelerationIncludingGravity;
  var rr = e.rotationRate;
  var supportedFields = 0;
  supportedFields |= a && 1;
  supportedFields |= ag && 2;
  supportedFields |= rr && 4;
  (growMemViews(), HEAP32)[(((eventStruct) + (72)) >>> 2) >>> 0] = supportedFields;
  (growMemViews(), HEAPF64)[((eventStruct) >>> 3) >>> 0] = a?.x;
  (growMemViews(), HEAPF64)[(((eventStruct) + (8)) >>> 3) >>> 0] = a?.y;
  (growMemViews(), HEAPF64)[(((eventStruct) + (16)) >>> 3) >>> 0] = a?.z;
  (growMemViews(), HEAPF64)[(((eventStruct) + (24)) >>> 3) >>> 0] = ag?.x;
  (growMemViews(), HEAPF64)[(((eventStruct) + (32)) >>> 3) >>> 0] = ag?.y;
  (growMemViews(), HEAPF64)[(((eventStruct) + (40)) >>> 3) >>> 0] = ag?.z;
  (growMemViews(), HEAPF64)[(((eventStruct) + (48)) >>> 3) >>> 0] = rr?.alpha;
  (growMemViews(), HEAPF64)[(((eventStruct) + (56)) >>> 3) >>> 0] = rr?.beta;
  (growMemViews(), HEAPF64)[(((eventStruct) + (64)) >>> 3) >>> 0] = rr?.gamma;
};

var registerDeviceMotionEventCallback = (target, userData, useCapture, callbackfunc, eventTypeId, eventTypeString, targetThread) => {
  targetThread = JSEvents.getTargetThreadForEventCallback(targetThread);
  var eventSize = 80;
  JSEvents.deviceMotionEvent ||= _malloc(eventSize);
  var deviceMotionEventHandlerFunc = e => {
    fillDeviceMotionEventData(JSEvents.deviceMotionEvent, e, target);
    // TODO: Thread-safety with respect to emscripten_get_devicemotion_status()
    if (targetThread) {
      __emscripten_run_callback_on_thread(targetThread, callbackfunc, eventTypeId, JSEvents.deviceMotionEvent, eventSize, userData);
    } else if (getWasmTableEntry(callbackfunc)(eventTypeId, JSEvents.deviceMotionEvent, userData)) e.preventDefault();
  };
  var eventHandler = {
    target: findEventTarget(target),
    eventTypeString,
    eventTypeId,
    userData,
    callbackfunc,
    handlerFunc: deviceMotionEventHandlerFunc,
    useCapture
  };
  return JSEvents.registerOrRemoveHandler(eventHandler);
};

function _emscripten_set_devicemotion_callback_on_thread(userData, useCapture, callbackfunc, targetThread) {
  if (ENVIRONMENT_IS_PTHREAD) return proxyToMainThread(47, 0, 1, userData, useCapture, callbackfunc, targetThread);
  userData >>>= 0;
  callbackfunc >>>= 0;
  targetThread >>>= 0;
  return registerDeviceMotionEventCallback(2, userData, useCapture, callbackfunc, 17, "devicemotion", targetThread);
}

function _emscripten_set_element_css_size(target, width, height) {
  if (ENVIRONMENT_IS_PTHREAD) return proxyToMainThread(48, 0, 1, target, width, height);
  target >>>= 0;
  target = findEventTarget(target);
  if (!target) return -4;
  target.style.width = width + "px";
  target.style.height = height + "px";
  return 0;
}

function _emscripten_set_focus_callback_on_thread(target, userData, useCapture, callbackfunc, targetThread) {
  if (ENVIRONMENT_IS_PTHREAD) return proxyToMainThread(49, 0, 1, target, userData, useCapture, callbackfunc, targetThread);
  target >>>= 0;
  userData >>>= 0;
  callbackfunc >>>= 0;
  targetThread >>>= 0;
  return registerFocusEventCallback(target, userData, useCapture, callbackfunc, 13, "focus", targetThread);
}

var registerFullscreenChangeEventCallback = (target, userData, useCapture, callbackfunc, eventTypeId, eventTypeString, targetThread) => {
  targetThread = JSEvents.getTargetThreadForEventCallback(targetThread);
  var eventSize = 276;
  JSEvents.fullscreenChangeEvent ||= _malloc(eventSize);
  var fullscreenChangeEventHandlerFunc = e => {
    var fullscreenChangeEvent = JSEvents.fullscreenChangeEvent;
    fillFullscreenChangeEventData(fullscreenChangeEvent);
    if (targetThread) __emscripten_run_callback_on_thread(targetThread, callbackfunc, eventTypeId, fullscreenChangeEvent, eventSize, userData); else if (getWasmTableEntry(callbackfunc)(eventTypeId, fullscreenChangeEvent, userData)) e.preventDefault();
  };
  var eventHandler = {
    target,
    eventTypeString,
    eventTypeId,
    userData,
    callbackfunc,
    handlerFunc: fullscreenChangeEventHandlerFunc,
    useCapture
  };
  return JSEvents.registerOrRemoveHandler(eventHandler);
};

function _emscripten_set_fullscreenchange_callback_on_thread(target, userData, useCapture, callbackfunc, targetThread) {
  if (ENVIRONMENT_IS_PTHREAD) return proxyToMainThread(50, 0, 1, target, userData, useCapture, callbackfunc, targetThread);
  target >>>= 0;
  userData >>>= 0;
  callbackfunc >>>= 0;
  targetThread >>>= 0;
  if (!JSEvents.fullscreenEnabled()) return -1;
  target = findEventTarget(target);
  if (!target) return -4;
  return registerFullscreenChangeEventCallback(target, userData, useCapture, callbackfunc, 19, "fullscreenchange", targetThread);
}

var registerGamepadEventCallback = (target, userData, useCapture, callbackfunc, eventTypeId, eventTypeString, targetThread) => {
  targetThread = JSEvents.getTargetThreadForEventCallback(targetThread);
  var eventSize = 1240;
  JSEvents.gamepadEvent ||= _malloc(eventSize);
  var gamepadEventHandlerFunc = e => {
    var gamepadEvent = JSEvents.gamepadEvent;
    fillGamepadEventData(gamepadEvent, e["gamepad"]);
    if (targetThread) __emscripten_run_callback_on_thread(targetThread, callbackfunc, eventTypeId, gamepadEvent, eventSize, userData); else if (getWasmTableEntry(callbackfunc)(eventTypeId, gamepadEvent, userData)) e.preventDefault();
  };
  var eventHandler = {
    target: findEventTarget(target),
    allowsDeferredCalls: true,
    eventTypeString,
    eventTypeId,
    userData,
    callbackfunc,
    handlerFunc: gamepadEventHandlerFunc,
    useCapture
  };
  return JSEvents.registerOrRemoveHandler(eventHandler);
};

function _emscripten_set_gamepadconnected_callback_on_thread(userData, useCapture, callbackfunc, targetThread) {
  if (ENVIRONMENT_IS_PTHREAD) return proxyToMainThread(51, 0, 1, userData, useCapture, callbackfunc, targetThread);
  userData >>>= 0;
  callbackfunc >>>= 0;
  targetThread >>>= 0;
  if (_emscripten_sample_gamepad_data()) return -1;
  return registerGamepadEventCallback(2, userData, useCapture, callbackfunc, 26, "gamepadconnected", targetThread);
}

function _emscripten_set_gamepaddisconnected_callback_on_thread(userData, useCapture, callbackfunc, targetThread) {
  if (ENVIRONMENT_IS_PTHREAD) return proxyToMainThread(52, 0, 1, userData, useCapture, callbackfunc, targetThread);
  userData >>>= 0;
  callbackfunc >>>= 0;
  targetThread >>>= 0;
  if (_emscripten_sample_gamepad_data()) return -1;
  return registerGamepadEventCallback(2, userData, useCapture, callbackfunc, 27, "gamepaddisconnected", targetThread);
}

var registerKeyEventCallback = (target, userData, useCapture, callbackfunc, eventTypeId, eventTypeString, targetThread) => {
  targetThread = JSEvents.getTargetThreadForEventCallback(targetThread);
  var eventSize = 160;
  JSEvents.keyEvent ||= _malloc(eventSize);
  var keyEventHandlerFunc = e => {
    var keyEventData = JSEvents.keyEvent;
    (growMemViews(), HEAPF64)[((keyEventData) >>> 3) >>> 0] = e.timeStamp;
    var idx = ((keyEventData) >>> 2);
    (growMemViews(), HEAP32)[idx + 2 >>> 0] = e.location;
    (growMemViews(), HEAP8)[keyEventData + 12 >>> 0] = e.ctrlKey;
    (growMemViews(), HEAP8)[keyEventData + 13 >>> 0] = e.shiftKey;
    (growMemViews(), HEAP8)[keyEventData + 14 >>> 0] = e.altKey;
    (growMemViews(), HEAP8)[keyEventData + 15 >>> 0] = e.metaKey;
    (growMemViews(), HEAP8)[keyEventData + 16 >>> 0] = e.repeat;
    (growMemViews(), HEAP32)[idx + 5 >>> 0] = e.charCode;
    (growMemViews(), HEAP32)[idx + 6 >>> 0] = e.keyCode;
    (growMemViews(), HEAP32)[idx + 7 >>> 0] = e.which;
    stringToUTF8(e.key ?? "", keyEventData + 32, 32);
    stringToUTF8(e.code ?? "", keyEventData + 64, 32);
    stringToUTF8(e.char ?? "", keyEventData + 96, 32);
    stringToUTF8(e.locale ?? "", keyEventData + 128, 32);
    if (targetThread) __emscripten_run_callback_on_thread(targetThread, callbackfunc, eventTypeId, keyEventData, eventSize, userData); else if (getWasmTableEntry(callbackfunc)(eventTypeId, keyEventData, userData)) e.preventDefault();
  };
  var eventHandler = {
    target: findEventTarget(target),
    eventTypeString,
    eventTypeId,
    userData,
    callbackfunc,
    handlerFunc: keyEventHandlerFunc,
    useCapture
  };
  return JSEvents.registerOrRemoveHandler(eventHandler);
};

function _emscripten_set_keydown_callback_on_thread(target, userData, useCapture, callbackfunc, targetThread) {
  if (ENVIRONMENT_IS_PTHREAD) return proxyToMainThread(53, 0, 1, target, userData, useCapture, callbackfunc, targetThread);
  target >>>= 0;
  userData >>>= 0;
  callbackfunc >>>= 0;
  targetThread >>>= 0;
  return registerKeyEventCallback(target, userData, useCapture, callbackfunc, 2, "keydown", targetThread);
}

function _emscripten_set_keypress_callback_on_thread(target, userData, useCapture, callbackfunc, targetThread) {
  if (ENVIRONMENT_IS_PTHREAD) return proxyToMainThread(54, 0, 1, target, userData, useCapture, callbackfunc, targetThread);
  target >>>= 0;
  userData >>>= 0;
  callbackfunc >>>= 0;
  targetThread >>>= 0;
  return registerKeyEventCallback(target, userData, useCapture, callbackfunc, 1, "keypress", targetThread);
}

function _emscripten_set_keyup_callback_on_thread(target, userData, useCapture, callbackfunc, targetThread) {
  if (ENVIRONMENT_IS_PTHREAD) return proxyToMainThread(55, 0, 1, target, userData, useCapture, callbackfunc, targetThread);
  target >>>= 0;
  userData >>>= 0;
  callbackfunc >>>= 0;
  targetThread >>>= 0;
  return registerKeyEventCallback(target, userData, useCapture, callbackfunc, 3, "keyup", targetThread);
}

function _emscripten_set_main_loop(func, fps, simulateInfiniteLoop) {
  func >>>= 0;
  var iterFunc = getWasmTableEntry(func);
  setMainLoop(iterFunc, fps, simulateInfiniteLoop);
}

var fillMouseEventData = (eventStruct, e, target) => {
  (growMemViews(), HEAPF64)[((eventStruct) >>> 3) >>> 0] = e.timeStamp;
  var idx = ((eventStruct) >>> 2);
  (growMemViews(), HEAP32)[idx + 2 >>> 0] = e.screenX;
  (growMemViews(), HEAP32)[idx + 3 >>> 0] = e.screenY;
  (growMemViews(), HEAP32)[idx + 4 >>> 0] = e.clientX;
  (growMemViews(), HEAP32)[idx + 5 >>> 0] = e.clientY;
  (growMemViews(), HEAP8)[eventStruct + 24 >>> 0] = e.ctrlKey;
  (growMemViews(), HEAP8)[eventStruct + 25 >>> 0] = e.shiftKey;
  (growMemViews(), HEAP8)[eventStruct + 26 >>> 0] = e.altKey;
  (growMemViews(), HEAP8)[eventStruct + 27 >>> 0] = e.metaKey;
  (growMemViews(), HEAP16)[idx * 2 + 14 >>> 0] = e.button;
  (growMemViews(), HEAP16)[idx * 2 + 15 >>> 0] = e.buttons;
  (growMemViews(), HEAP32)[idx + 8 >>> 0] = e["movementX"];
  (growMemViews(), HEAP32)[idx + 9 >>> 0] = e["movementY"];
  // Note: rect contains doubles (truncated to placate SAFE_HEAP, which is the same behaviour when writing to HEAP32 anyway)
  var rect = getBoundingClientRect(target);
  (growMemViews(), HEAP32)[idx + 10 >>> 0] = e.clientX - (rect.left | 0);
  (growMemViews(), HEAP32)[idx + 11 >>> 0] = e.clientY - (rect.top | 0);
};

var registerMouseEventCallback = (target, userData, useCapture, callbackfunc, eventTypeId, eventTypeString, targetThread) => {
  targetThread = JSEvents.getTargetThreadForEventCallback(targetThread);
  var eventSize = 64;
  JSEvents.mouseEvent ||= _malloc(eventSize);
  target = findEventTarget(target);
  var mouseEventHandlerFunc = e => {
    // TODO: Make this access thread safe, or this could update live while app is reading it.
    fillMouseEventData(JSEvents.mouseEvent, e, target);
    if (targetThread) {
      __emscripten_run_callback_on_thread(targetThread, callbackfunc, eventTypeId, JSEvents.mouseEvent, eventSize, userData);
    } else if (getWasmTableEntry(callbackfunc)(eventTypeId, JSEvents.mouseEvent, userData)) e.preventDefault();
  };
  var eventHandler = {
    target,
    allowsDeferredCalls: eventTypeString != "mousemove" && eventTypeString != "mouseenter" && eventTypeString != "mouseleave",
    // Mouse move events do not allow fullscreen/pointer lock requests to be handled in them!
    eventTypeString,
    eventTypeId,
    userData,
    callbackfunc,
    handlerFunc: mouseEventHandlerFunc,
    useCapture
  };
  return JSEvents.registerOrRemoveHandler(eventHandler);
};

function _emscripten_set_mousedown_callback_on_thread(target, userData, useCapture, callbackfunc, targetThread) {
  if (ENVIRONMENT_IS_PTHREAD) return proxyToMainThread(56, 0, 1, target, userData, useCapture, callbackfunc, targetThread);
  target >>>= 0;
  userData >>>= 0;
  callbackfunc >>>= 0;
  targetThread >>>= 0;
  return registerMouseEventCallback(target, userData, useCapture, callbackfunc, 5, "mousedown", targetThread);
}

function _emscripten_set_mouseenter_callback_on_thread(target, userData, useCapture, callbackfunc, targetThread) {
  if (ENVIRONMENT_IS_PTHREAD) return proxyToMainThread(57, 0, 1, target, userData, useCapture, callbackfunc, targetThread);
  target >>>= 0;
  userData >>>= 0;
  callbackfunc >>>= 0;
  targetThread >>>= 0;
  return registerMouseEventCallback(target, userData, useCapture, callbackfunc, 33, "mouseenter", targetThread);
}

function _emscripten_set_mouseleave_callback_on_thread(target, userData, useCapture, callbackfunc, targetThread) {
  if (ENVIRONMENT_IS_PTHREAD) return proxyToMainThread(58, 0, 1, target, userData, useCapture, callbackfunc, targetThread);
  target >>>= 0;
  userData >>>= 0;
  callbackfunc >>>= 0;
  targetThread >>>= 0;
  return registerMouseEventCallback(target, userData, useCapture, callbackfunc, 34, "mouseleave", targetThread);
}

function _emscripten_set_mousemove_callback_on_thread(target, userData, useCapture, callbackfunc, targetThread) {
  if (ENVIRONMENT_IS_PTHREAD) return proxyToMainThread(59, 0, 1, target, userData, useCapture, callbackfunc, targetThread);
  target >>>= 0;
  userData >>>= 0;
  callbackfunc >>>= 0;
  targetThread >>>= 0;
  return registerMouseEventCallback(target, userData, useCapture, callbackfunc, 8, "mousemove", targetThread);
}

function _emscripten_set_mouseup_callback_on_thread(target, userData, useCapture, callbackfunc, targetThread) {
  if (ENVIRONMENT_IS_PTHREAD) return proxyToMainThread(60, 0, 1, target, userData, useCapture, callbackfunc, targetThread);
  target >>>= 0;
  userData >>>= 0;
  callbackfunc >>>= 0;
  targetThread >>>= 0;
  return registerMouseEventCallback(target, userData, useCapture, callbackfunc, 6, "mouseup", targetThread);
}

var screenOrientation = () => {
  if (!window.screen) return undefined;
  return screen.orientation || screen["mozOrientation"] || screen["webkitOrientation"];
};

var fillOrientationChangeEventData = eventStruct => {
  // OrientationType enum
  var orientationsType1 = [ "portrait-primary", "portrait-secondary", "landscape-primary", "landscape-secondary" ];
  // alternative selection from OrientationLockType enum
  var orientationsType2 = [ "portrait", "portrait", "landscape", "landscape" ];
  var orientationIndex = 0;
  var orientationAngle = 0;
  var screenOrientObj = screenOrientation();
  if (typeof screenOrientObj === "object") {
    orientationIndex = orientationsType1.indexOf(screenOrientObj.type);
    if (orientationIndex < 0) {
      orientationIndex = orientationsType2.indexOf(screenOrientObj.type);
    }
    if (orientationIndex >= 0) {
      orientationIndex = 1 << orientationIndex;
    }
    orientationAngle = screenOrientObj.angle;
  }
  (growMemViews(), HEAP32)[((eventStruct) >>> 2) >>> 0] = orientationIndex;
  (growMemViews(), HEAP32)[(((eventStruct) + (4)) >>> 2) >>> 0] = orientationAngle;
};

var registerOrientationChangeEventCallback = (target, userData, useCapture, callbackfunc, eventTypeId, eventTypeString, targetThread) => {
  targetThread = JSEvents.getTargetThreadForEventCallback(targetThread);
  var eventSize = 8;
  JSEvents.orientationChangeEvent ||= _malloc(eventSize);
  var orientationChangeEventHandlerFunc = e => {
    var orientationChangeEvent = JSEvents.orientationChangeEvent;
    fillOrientationChangeEventData(orientationChangeEvent);
    if (targetThread) __emscripten_run_callback_on_thread(targetThread, callbackfunc, eventTypeId, orientationChangeEvent, eventSize, userData); else if (getWasmTableEntry(callbackfunc)(eventTypeId, orientationChangeEvent, userData)) e.preventDefault();
  };
  var eventHandler = {
    target,
    eventTypeString,
    eventTypeId,
    userData,
    callbackfunc,
    handlerFunc: orientationChangeEventHandlerFunc,
    useCapture
  };
  return JSEvents.registerOrRemoveHandler(eventHandler);
};

function _emscripten_set_orientationchange_callback_on_thread(userData, useCapture, callbackfunc, targetThread) {
  if (ENVIRONMENT_IS_PTHREAD) return proxyToMainThread(61, 0, 1, userData, useCapture, callbackfunc, targetThread);
  userData >>>= 0;
  callbackfunc >>>= 0;
  targetThread >>>= 0;
  if (!window.screen || !screen.orientation) return -1;
  return registerOrientationChangeEventCallback(screen.orientation, userData, useCapture, callbackfunc, 18, "change", targetThread);
}

var fillPointerlockChangeEventData = eventStruct => {
  var pointerLockElement = document.pointerLockElement;
  var isPointerlocked = !!pointerLockElement;
  // Assigning a boolean to HEAP32 with expected type coercion.
  /** @suppress{checkTypes} */ (growMemViews(), HEAP8)[eventStruct >>> 0] = isPointerlocked;
  var nodeName = JSEvents.getNodeNameForTarget(pointerLockElement);
  var id = pointerLockElement?.id ?? "";
  stringToUTF8(nodeName, eventStruct + 1, 128);
  stringToUTF8(id, eventStruct + 129, 128);
};

var registerPointerlockChangeEventCallback = (target, userData, useCapture, callbackfunc, eventTypeId, eventTypeString, targetThread) => {
  targetThread = JSEvents.getTargetThreadForEventCallback(targetThread);
  var eventSize = 257;
  JSEvents.pointerlockChangeEvent ||= _malloc(eventSize);
  var pointerlockChangeEventHandlerFunc = e => {
    var pointerlockChangeEvent = JSEvents.pointerlockChangeEvent;
    fillPointerlockChangeEventData(pointerlockChangeEvent);
    if (targetThread) __emscripten_run_callback_on_thread(targetThread, callbackfunc, eventTypeId, pointerlockChangeEvent, eventSize, userData); else if (getWasmTableEntry(callbackfunc)(eventTypeId, pointerlockChangeEvent, userData)) e.preventDefault();
  };
  var eventHandler = {
    target,
    eventTypeString,
    eventTypeId,
    userData,
    callbackfunc,
    handlerFunc: pointerlockChangeEventHandlerFunc,
    useCapture
  };
  return JSEvents.registerOrRemoveHandler(eventHandler);
};

function _emscripten_set_pointerlockchange_callback_on_thread(target, userData, useCapture, callbackfunc, targetThread) {
  if (ENVIRONMENT_IS_PTHREAD) return proxyToMainThread(62, 0, 1, target, userData, useCapture, callbackfunc, targetThread);
  target >>>= 0;
  userData >>>= 0;
  callbackfunc >>>= 0;
  targetThread >>>= 0;
  if (!document.body?.requestPointerLock) {
    return -1;
  }
  target = findEventTarget(target);
  if (!target) return -4;
  return registerPointerlockChangeEventCallback(target, userData, useCapture, callbackfunc, 20, "pointerlockchange", targetThread);
}

var registerPointerlockErrorEventCallback = (target, userData, useCapture, callbackfunc, eventTypeId, eventTypeString, targetThread) => {
  targetThread = JSEvents.getTargetThreadForEventCallback(targetThread);
  var pointerlockErrorEventHandlerFunc = e => {
    if (targetThread) __emscripten_run_callback_on_thread(targetThread, callbackfunc, eventTypeId, 0, 0, userData); else if (getWasmTableEntry(callbackfunc)(eventTypeId, 0, userData)) e.preventDefault();
  };
  var eventHandler = {
    target,
    eventTypeString,
    eventTypeId,
    userData,
    callbackfunc,
    handlerFunc: pointerlockErrorEventHandlerFunc,
    useCapture
  };
  return JSEvents.registerOrRemoveHandler(eventHandler);
};

function _emscripten_set_pointerlockerror_callback_on_thread(target, userData, useCapture, callbackfunc, targetThread) {
  if (ENVIRONMENT_IS_PTHREAD) return proxyToMainThread(63, 0, 1, target, userData, useCapture, callbackfunc, targetThread);
  target >>>= 0;
  userData >>>= 0;
  callbackfunc >>>= 0;
  targetThread >>>= 0;
  if (!document.body?.requestPointerLock) {
    return -1;
  }
  target = findEventTarget(target);
  if (!target) return -4;
  return registerPointerlockErrorEventCallback(target, userData, useCapture, callbackfunc, 38, "pointerlockerror", targetThread);
}

var registerUiEventCallback = (target, userData, useCapture, callbackfunc, eventTypeId, eventTypeString, targetThread) => {
  targetThread = JSEvents.getTargetThreadForEventCallback(targetThread);
  var eventSize = 36;
  JSEvents.uiEvent ||= _malloc(eventSize);
  target = findEventTarget(target);
  var uiEventHandlerFunc = e => {
    if (e.target != target) {
      // Never take ui events such as scroll via a 'bubbled' route, but always from the direct element that
      // was targeted. Otherwise e.g. if app logs a message in response to a page scroll, the Emscripten log
      // message box could cause to scroll, generating a new (bubbled) scroll message, causing a new log print,
      // causing a new scroll, etc..
      return;
    }
    var b = document.body;
    // Take document.body to a variable, Closure compiler does not outline access to it on its own.
    if (!b) {
      // During a page unload 'body' can be null, with "Cannot read property 'clientWidth' of null" being thrown
      return;
    }
    var uiEvent = JSEvents.uiEvent;
    (growMemViews(), HEAP32)[((uiEvent) >>> 2) >>> 0] = 0;
    // always zero for resize and scroll
    (growMemViews(), HEAP32)[(((uiEvent) + (4)) >>> 2) >>> 0] = b.clientWidth;
    (growMemViews(), HEAP32)[(((uiEvent) + (8)) >>> 2) >>> 0] = b.clientHeight;
    (growMemViews(), HEAP32)[(((uiEvent) + (12)) >>> 2) >>> 0] = innerWidth;
    (growMemViews(), HEAP32)[(((uiEvent) + (16)) >>> 2) >>> 0] = innerHeight;
    (growMemViews(), HEAP32)[(((uiEvent) + (20)) >>> 2) >>> 0] = outerWidth;
    (growMemViews(), HEAP32)[(((uiEvent) + (24)) >>> 2) >>> 0] = outerHeight;
    (growMemViews(), HEAP32)[(((uiEvent) + (28)) >>> 2) >>> 0] = pageXOffset | 0;
    // scroll offsets are float
    (growMemViews(), HEAP32)[(((uiEvent) + (32)) >>> 2) >>> 0] = pageYOffset | 0;
    if (targetThread) __emscripten_run_callback_on_thread(targetThread, callbackfunc, eventTypeId, uiEvent, eventSize, userData); else if (getWasmTableEntry(callbackfunc)(eventTypeId, uiEvent, userData)) e.preventDefault();
  };
  var eventHandler = {
    target,
    eventTypeString,
    eventTypeId,
    userData,
    callbackfunc,
    handlerFunc: uiEventHandlerFunc,
    useCapture
  };
  return JSEvents.registerOrRemoveHandler(eventHandler);
};

function _emscripten_set_resize_callback_on_thread(target, userData, useCapture, callbackfunc, targetThread) {
  if (ENVIRONMENT_IS_PTHREAD) return proxyToMainThread(64, 0, 1, target, userData, useCapture, callbackfunc, targetThread);
  target >>>= 0;
  userData >>>= 0;
  callbackfunc >>>= 0;
  targetThread >>>= 0;
  return registerUiEventCallback(target, userData, useCapture, callbackfunc, 10, "resize", targetThread);
}

var _emscripten_set_timeout = function(cb, msecs, userData) {
  cb >>>= 0;
  userData >>>= 0;
  return safeSetTimeout(() => getWasmTableEntry(cb)(userData), msecs);
};

var registerTouchEventCallback = (target, userData, useCapture, callbackfunc, eventTypeId, eventTypeString, targetThread) => {
  targetThread = JSEvents.getTargetThreadForEventCallback(targetThread);
  var eventSize = 1552;
  JSEvents.touchEvent ||= _malloc(eventSize);
  target = findEventTarget(target);
  var touchEventHandlerFunc = e => {
    var t, touches = {}, et = e.touches;
    // To ease marshalling different kinds of touches that browser reports (all touches are listed in e.touches,
    // only changed touches in e.changedTouches, and touches on target at a.targetTouches), mark a boolean in
    // each Touch object so that we can later loop only once over all touches we see to marshall over to Wasm.
    for (let t of et) {
      // Browser might recycle the generated Touch objects between each frame (Firefox on Android), so reset any
      // changed/target states we may have set from previous frame.
      t.isChanged = t.onTarget = 0;
      touches[t.identifier] = t;
    }
    // Mark which touches are part of the changedTouches list.
    for (let t of e.changedTouches) {
      t.isChanged = 1;
      touches[t.identifier] = t;
    }
    // Mark which touches are part of the targetTouches list.
    for (let t of e.targetTouches) {
      touches[t.identifier].onTarget = 1;
    }
    var touchEvent = JSEvents.touchEvent;
    (growMemViews(), HEAPF64)[((touchEvent) >>> 3) >>> 0] = e.timeStamp;
    (growMemViews(), HEAP8)[touchEvent + 12 >>> 0] = e.ctrlKey;
    (growMemViews(), HEAP8)[touchEvent + 13 >>> 0] = e.shiftKey;
    (growMemViews(), HEAP8)[touchEvent + 14 >>> 0] = e.altKey;
    (growMemViews(), HEAP8)[touchEvent + 15 >>> 0] = e.metaKey;
    var idx = touchEvent + 16;
    var targetRect = getBoundingClientRect(target);
    var numTouches = 0;
    for (let t of Object.values(touches)) {
      var idx32 = ((idx) >>> 2);
      // Pre-shift the ptr to index to HEAP32 to save code size
      (growMemViews(), HEAP32)[idx32 + 0 >>> 0] = t.identifier;
      (growMemViews(), HEAP32)[idx32 + 1 >>> 0] = t.screenX;
      (growMemViews(), HEAP32)[idx32 + 2 >>> 0] = t.screenY;
      (growMemViews(), HEAP32)[idx32 + 3 >>> 0] = t.clientX;
      (growMemViews(), HEAP32)[idx32 + 4 >>> 0] = t.clientY;
      (growMemViews(), HEAP32)[idx32 + 5 >>> 0] = t.pageX;
      (growMemViews(), HEAP32)[idx32 + 6 >>> 0] = t.pageY;
      (growMemViews(), HEAP8)[idx + 28 >>> 0] = t.isChanged;
      (growMemViews(), HEAP8)[idx + 29 >>> 0] = t.onTarget;
      (growMemViews(), HEAP32)[idx32 + 8 >>> 0] = t.clientX - (targetRect.left | 0);
      (growMemViews(), HEAP32)[idx32 + 9 >>> 0] = t.clientY - (targetRect.top | 0);
      idx += 48;
      if (++numTouches > 31) {
        break;
      }
    }
    (growMemViews(), HEAP32)[(((touchEvent) + (8)) >>> 2) >>> 0] = numTouches;
    if (targetThread) __emscripten_run_callback_on_thread(targetThread, callbackfunc, eventTypeId, touchEvent, eventSize, userData); else if (getWasmTableEntry(callbackfunc)(eventTypeId, touchEvent, userData)) e.preventDefault();
  };
  var eventHandler = {
    target,
    allowsDeferredCalls: eventTypeString == "touchstart" || eventTypeString == "touchend",
    eventTypeString,
    eventTypeId,
    userData,
    callbackfunc,
    handlerFunc: touchEventHandlerFunc,
    useCapture
  };
  return JSEvents.registerOrRemoveHandler(eventHandler);
};

function _emscripten_set_touchcancel_callback_on_thread(target, userData, useCapture, callbackfunc, targetThread) {
  if (ENVIRONMENT_IS_PTHREAD) return proxyToMainThread(65, 0, 1, target, userData, useCapture, callbackfunc, targetThread);
  target >>>= 0;
  userData >>>= 0;
  callbackfunc >>>= 0;
  targetThread >>>= 0;
  return registerTouchEventCallback(target, userData, useCapture, callbackfunc, 25, "touchcancel", targetThread);
}

function _emscripten_set_touchend_callback_on_thread(target, userData, useCapture, callbackfunc, targetThread) {
  if (ENVIRONMENT_IS_PTHREAD) return proxyToMainThread(66, 0, 1, target, userData, useCapture, callbackfunc, targetThread);
  target >>>= 0;
  userData >>>= 0;
  callbackfunc >>>= 0;
  targetThread >>>= 0;
  return registerTouchEventCallback(target, userData, useCapture, callbackfunc, 23, "touchend", targetThread);
}

function _emscripten_set_touchmove_callback_on_thread(target, userData, useCapture, callbackfunc, targetThread) {
  if (ENVIRONMENT_IS_PTHREAD) return proxyToMainThread(67, 0, 1, target, userData, useCapture, callbackfunc, targetThread);
  target >>>= 0;
  userData >>>= 0;
  callbackfunc >>>= 0;
  targetThread >>>= 0;
  return registerTouchEventCallback(target, userData, useCapture, callbackfunc, 24, "touchmove", targetThread);
}

function _emscripten_set_touchstart_callback_on_thread(target, userData, useCapture, callbackfunc, targetThread) {
  if (ENVIRONMENT_IS_PTHREAD) return proxyToMainThread(68, 0, 1, target, userData, useCapture, callbackfunc, targetThread);
  target >>>= 0;
  userData >>>= 0;
  callbackfunc >>>= 0;
  targetThread >>>= 0;
  return registerTouchEventCallback(target, userData, useCapture, callbackfunc, 22, "touchstart", targetThread);
}

var fillVisibilityChangeEventData = eventStruct => {
  var visibilityStates = [ "hidden", "visible", "prerender", "unloaded" ];
  var visibilityState = visibilityStates.indexOf(document.visibilityState);
  // Assigning a boolean to HEAP32 with expected type coercion.
  /** @suppress{checkTypes} */ (growMemViews(), HEAP8)[eventStruct >>> 0] = document.hidden;
  (growMemViews(), HEAP32)[(((eventStruct) + (4)) >>> 2) >>> 0] = visibilityState;
};

var registerVisibilityChangeEventCallback = (target, userData, useCapture, callbackfunc, eventTypeId, eventTypeString, targetThread) => {
  targetThread = JSEvents.getTargetThreadForEventCallback(targetThread);
  var eventSize = 8;
  JSEvents.visibilityChangeEvent ||= _malloc(eventSize);
  var visibilityChangeEventHandlerFunc = e => {
    var visibilityChangeEvent = JSEvents.visibilityChangeEvent;
    fillVisibilityChangeEventData(visibilityChangeEvent);
    if (targetThread) __emscripten_run_callback_on_thread(targetThread, callbackfunc, eventTypeId, visibilityChangeEvent, eventSize, userData); else if (getWasmTableEntry(callbackfunc)(eventTypeId, visibilityChangeEvent, userData)) e.preventDefault();
  };
  var eventHandler = {
    target,
    eventTypeString,
    eventTypeId,
    userData,
    callbackfunc,
    handlerFunc: visibilityChangeEventHandlerFunc,
    useCapture
  };
  return JSEvents.registerOrRemoveHandler(eventHandler);
};

function _emscripten_set_visibilitychange_callback_on_thread(userData, useCapture, callbackfunc, targetThread) {
  if (ENVIRONMENT_IS_PTHREAD) return proxyToMainThread(69, 0, 1, userData, useCapture, callbackfunc, targetThread);
  userData >>>= 0;
  callbackfunc >>>= 0;
  targetThread >>>= 0;
  if (!specialHTMLTargets[1]) {
    return -4;
  }
  return registerVisibilityChangeEventCallback(specialHTMLTargets[1], userData, useCapture, callbackfunc, 21, "visibilitychange", targetThread);
}

var registerWheelEventCallback = (target, userData, useCapture, callbackfunc, eventTypeId, eventTypeString, targetThread) => {
  targetThread = JSEvents.getTargetThreadForEventCallback(targetThread);
  var eventSize = 96;
  JSEvents.wheelEvent ||= _malloc(eventSize);
  // The DOM Level 3 events spec event 'wheel'
  var wheelHandlerFunc = e => {
    var wheelEvent = JSEvents.wheelEvent;
    fillMouseEventData(wheelEvent, e, target);
    (growMemViews(), HEAPF64)[(((wheelEvent) + (64)) >>> 3) >>> 0] = e["deltaX"];
    (growMemViews(), HEAPF64)[(((wheelEvent) + (72)) >>> 3) >>> 0] = e["deltaY"];
    (growMemViews(), HEAPF64)[(((wheelEvent) + (80)) >>> 3) >>> 0] = e["deltaZ"];
    (growMemViews(), HEAP32)[(((wheelEvent) + (88)) >>> 2) >>> 0] = e["deltaMode"];
    if (targetThread) __emscripten_run_callback_on_thread(targetThread, callbackfunc, eventTypeId, wheelEvent, eventSize, userData); else if (getWasmTableEntry(callbackfunc)(eventTypeId, wheelEvent, userData)) e.preventDefault();
  };
  var eventHandler = {
    target,
    allowsDeferredCalls: true,
    eventTypeString,
    eventTypeId,
    userData,
    callbackfunc,
    handlerFunc: wheelHandlerFunc,
    useCapture
  };
  return JSEvents.registerOrRemoveHandler(eventHandler);
};

function _emscripten_set_wheel_callback_on_thread(target, userData, useCapture, callbackfunc, targetThread) {
  if (ENVIRONMENT_IS_PTHREAD) return proxyToMainThread(70, 0, 1, target, userData, useCapture, callbackfunc, targetThread);
  target >>>= 0;
  userData >>>= 0;
  callbackfunc >>>= 0;
  targetThread >>>= 0;
  target = findEventTarget(target);
  if (!target) return -4;
  if (typeof target.onwheel != "undefined") {
    return registerWheelEventCallback(target, userData, useCapture, callbackfunc, 9, "wheel", targetThread);
  } else {
    return -1;
  }
}

function _emscripten_set_window_title(title) {
  if (ENVIRONMENT_IS_PTHREAD) return proxyToMainThread(71, 0, 1, title);
  title >>>= 0;
  return document.title = UTF8ToString(title);
}

var _emscripten_sleep = () => {
  abort("Please compile your program with async support in order to use asynchronous operations like emscripten_sleep");
};

var _emscripten_unwind_to_js_event_loop = () => {
  throw "unwind";
};

var registerPreMainLoop = f => {
  // Does nothing unless $MainLoop is included/used.
  typeof MainLoop != "undefined" && MainLoop.preMainLoop.push(f);
};

var _emscripten_supports_offscreencanvas = () => // TODO: Add a new build mode, e.g. OFFSCREENCANVAS_SUPPORT=2, which
// necessitates OffscreenCanvas support at build time, and "return 1;" here in that build mode.
typeof OffscreenCanvas != "undefined";

var webglPowerPreferences = [ "default", "low-power", "high-performance" ];

function _emscripten_webgl_do_create_context(target, attributes) {
  target >>>= 0;
  attributes >>>= 0;
  var attr32 = ((attributes) >>> 2);
  var powerPreference = (growMemViews(), HEAP32)[attr32 + (8 >> 2) >>> 0];
  var contextAttributes = {
    "alpha": !!(growMemViews(), HEAP8)[attributes + 0 >>> 0],
    "depth": !!(growMemViews(), HEAP8)[attributes + 1 >>> 0],
    "stencil": !!(growMemViews(), HEAP8)[attributes + 2 >>> 0],
    "antialias": !!(growMemViews(), HEAP8)[attributes + 3 >>> 0],
    "premultipliedAlpha": !!(growMemViews(), HEAP8)[attributes + 4 >>> 0],
    "preserveDrawingBuffer": !!(growMemViews(), HEAP8)[attributes + 5 >>> 0],
    "powerPreference": webglPowerPreferences[powerPreference],
    "failIfMajorPerformanceCaveat": !!(growMemViews(), HEAP8)[attributes + 12 >>> 0],
    "desynchronized": !!(growMemViews(), HEAP8)[attributes + 33 >>> 0],
    // The following are not predefined WebGL context attributes in the WebGL specification, so the property names can be minified by Closure.
    majorVersion: (growMemViews(), HEAP32)[attr32 + (16 >> 2) >>> 0],
    minorVersion: (growMemViews(), HEAP32)[attr32 + (20 >> 2) >>> 0],
    enableExtensionsByDefault: (growMemViews(), HEAP8)[attributes + 24 >>> 0],
    explicitSwapControl: (growMemViews(), HEAP8)[attributes + 25 >>> 0],
    proxyContextToMainThread: (growMemViews(), HEAP32)[attr32 + (28 >> 2) >>> 0],
    renderViaOffscreenBackBuffer: (growMemViews(), HEAP8)[attributes + 32 >>> 0]
  };
  var canvas = findCanvasEventTarget(target);
  // If our canvas from findCanvasEventTarget is actually an offscreen canvas record, we should extract the inner canvas.
  if (canvas?.canvas) {
    canvas = canvas.canvas;
  }
  if (!canvas) {
    return 0;
  }
  if (canvas.offscreenCanvas) canvas = canvas.offscreenCanvas;
  if (contextAttributes.explicitSwapControl) {
    var supportsOffscreenCanvas = canvas.transferControlToOffscreen || (_emscripten_supports_offscreencanvas() && canvas instanceof OffscreenCanvas);
    if (!supportsOffscreenCanvas) {
      return 0;
    }
    if (canvas.transferControlToOffscreen) {
      if (!canvas.controlTransferredOffscreen) {
        GL.offscreenCanvases[canvas.id] = {
          canvas: canvas.transferControlToOffscreen(),
          canvasSharedPtr: _malloc(12),
          id: canvas.id
        };
        canvas.controlTransferredOffscreen = true;
      } else if (!GL.offscreenCanvases[canvas.id]) {
        return 0;
      }
      canvas = GL.offscreenCanvases[canvas.id].canvas;
    }
  }
  var contextHandle = GL.createContext(canvas, contextAttributes);
  return contextHandle;
}

var _emscripten_webgl_create_context = _emscripten_webgl_do_create_context;

var _emscripten_webgl_destroy_context_calling_thread = contextHandle => {
  if (GL.currentContext == contextHandle) GL.currentContext = 0;
  GL.deleteContext(contextHandle);
};

var _emscripten_webgl_destroy_context_main_thread = _emscripten_webgl_destroy_context_calling_thread;

function _emscripten_webgl_destroy_context(p0) {
  p0 >>>= 0;
  return GL.contexts[p0] ? _emscripten_webgl_destroy_context_calling_thread(p0) : _emscripten_webgl_destroy_context_main_thread(p0);
}

function _emscripten_webgl_make_context_current(contextHandle) {
  contextHandle >>>= 0;
  var success = GL.makeContextCurrent(contextHandle);
  return success ? 0 : -5;
}

var readI53FromI64 = ptr => (growMemViews(), HEAPU32)[((ptr) >>> 2) >>> 0] + (growMemViews(), 
HEAP32)[(((ptr) + (4)) >>> 2) >>> 0] * 4294967296;

var WebGPU = {
  Internals: {
    jsObjects: [],
    jsObjectInsert: (ptr, jsObject) => {
      ptr >>>= 0;
      WebGPU.Internals.jsObjects[ptr] = jsObject;
    },
    bufferOnUnmaps: [],
    futures: [],
    futureInsert: (futureId, promise) => {}
  },
  getJsObject: ptr => {
    if (!ptr) return undefined;
    ptr >>>= 0;
    return WebGPU.Internals.jsObjects[ptr];
  },
  importJsAdapter: (obj, parentPtr = 0) => {
    var ptr = _emwgpuCreateAdapter(parentPtr);
    WebGPU.Internals.jsObjects[ptr >>> 0] = obj;
    return ptr;
  },
  importJsBindGroup: (obj, parentPtr = 0) => {
    var ptr = _emwgpuCreateBindGroup(parentPtr);
    WebGPU.Internals.jsObjects[ptr >>> 0] = obj;
    return ptr;
  },
  importJsBindGroupLayout: (obj, parentPtr = 0) => {
    var ptr = _emwgpuCreateBindGroupLayout(parentPtr);
    WebGPU.Internals.jsObjects[ptr >>> 0] = obj;
    return ptr;
  },
  importJsBuffer: (buffer, parentPtr = 0) => {
    // At the moment, we do not allow importing pending buffers.
    assert(buffer.mapState === "unmapped");
    var bufferPtr = _emwgpuImportBuffer(parentPtr);
    WebGPU.Internals.jsObjectInsert(bufferPtr, buffer);
    return bufferPtr;
  },
  importJsCommandBuffer: (obj, parentPtr = 0) => {
    var ptr = _emwgpuCreateCommandBuffer(parentPtr);
    WebGPU.Internals.jsObjects[ptr >>> 0] = obj;
    return ptr;
  },
  importJsCommandEncoder: (obj, parentPtr = 0) => {
    var ptr = _emwgpuCreateCommandEncoder(parentPtr);
    WebGPU.Internals.jsObjects[ptr >>> 0] = obj;
    return ptr;
  },
  importJsComputePassEncoder: (obj, parentPtr = 0) => {
    var ptr = _emwgpuCreateComputePassEncoder(parentPtr);
    WebGPU.Internals.jsObjects[ptr >>> 0] = obj;
    return ptr;
  },
  importJsComputePipeline: (obj, parentPtr = 0) => {
    var ptr = _emwgpuCreateComputePipeline(parentPtr);
    WebGPU.Internals.jsObjects[ptr >>> 0] = obj;
    return ptr;
  },
  importJsDevice: (device, parentPtr = 0) => {
    var queuePtr = _emwgpuCreateQueue(parentPtr);
    var devicePtr = _emwgpuCreateDevice(parentPtr, queuePtr);
    WebGPU.Internals.jsObjectInsert(queuePtr, device.queue);
    WebGPU.Internals.jsObjectInsert(devicePtr, device);
    return devicePtr;
  },
  importJsExternalTexture: (obj, parentPtr = 0) => {
    var ptr = _emwgpuCreateExternalTexture(parentPtr);
    WebGPU.Internals.jsObjects[ptr >>> 0] = obj;
    return ptr;
  },
  importJsPipelineLayout: (obj, parentPtr = 0) => {
    var ptr = _emwgpuCreatePipelineLayout(parentPtr);
    WebGPU.Internals.jsObjects[ptr >>> 0] = obj;
    return ptr;
  },
  importJsQuerySet: (obj, parentPtr = 0) => {
    var ptr = _emwgpuCreateQuerySet(parentPtr);
    WebGPU.Internals.jsObjects[ptr >>> 0] = obj;
    return ptr;
  },
  importJsQueue: (obj, parentPtr = 0) => {
    var ptr = _emwgpuCreateQueue(parentPtr);
    WebGPU.Internals.jsObjects[ptr >>> 0] = obj;
    return ptr;
  },
  importJsRenderBundle: (obj, parentPtr = 0) => {
    var ptr = _emwgpuCreateRenderBundle(parentPtr);
    WebGPU.Internals.jsObjects[ptr >>> 0] = obj;
    return ptr;
  },
  importJsRenderBundleEncoder: (obj, parentPtr = 0) => {
    var ptr = _emwgpuCreateRenderBundleEncoder(parentPtr);
    WebGPU.Internals.jsObjects[ptr >>> 0] = obj;
    return ptr;
  },
  importJsRenderPassEncoder: (obj, parentPtr = 0) => {
    var ptr = _emwgpuCreateRenderPassEncoder(parentPtr);
    WebGPU.Internals.jsObjects[ptr >>> 0] = obj;
    return ptr;
  },
  importJsRenderPipeline: (obj, parentPtr = 0) => {
    var ptr = _emwgpuCreateRenderPipeline(parentPtr);
    WebGPU.Internals.jsObjects[ptr >>> 0] = obj;
    return ptr;
  },
  importJsSampler: (obj, parentPtr = 0) => {
    var ptr = _emwgpuCreateSampler(parentPtr);
    WebGPU.Internals.jsObjects[ptr >>> 0] = obj;
    return ptr;
  },
  importJsShaderModule: (obj, parentPtr = 0) => {
    var ptr = _emwgpuCreateShaderModule(parentPtr);
    WebGPU.Internals.jsObjects[ptr >>> 0] = obj;
    return ptr;
  },
  importJsSurface: (obj, parentPtr = 0) => {
    var ptr = _emwgpuCreateSurface(parentPtr);
    WebGPU.Internals.jsObjects[ptr >>> 0] = obj;
    return ptr;
  },
  importJsTexture: (obj, parentPtr = 0) => {
    var ptr = _emwgpuCreateTexture(parentPtr);
    WebGPU.Internals.jsObjects[ptr >>> 0] = obj;
    return ptr;
  },
  importJsTextureView: (obj, parentPtr = 0) => {
    var ptr = _emwgpuCreateTextureView(parentPtr);
    WebGPU.Internals.jsObjects[ptr >>> 0] = obj;
    return ptr;
  },
  errorCallback: (callback, type, message, userdata) => {
    var sp = stackSave();
    var messagePtr = stringToUTF8OnStack(message);
    getWasmTableEntry(callback)(type, messagePtr, userdata);
    stackRestore(sp);
  },
  iterateExtensions: (root, handlers) => {
    for (var ptr = (growMemViews(), HEAPU32)[((root) >>> 2) >>> 0]; ptr; ptr = (growMemViews(), 
    HEAPU32)[((ptr) >>> 2) >>> 0]) {
      var sType = (growMemViews(), HEAP32)[(((ptr) + (4)) >>> 2) >>> 0];
      // This will crash if there's no handler indicating either a bogus
      // sType, or one we haven't implemented yet.
      var handler = handlers[sType](ptr);
    }
  },
  setStringView: (ptr, data, length) => {
    (growMemViews(), HEAPU32)[((ptr) >>> 2) >>> 0] = data;
    (growMemViews(), HEAPU32)[(((ptr) + (4)) >>> 2) >>> 0] = length;
  },
  makeStringFromStringView: stringViewPtr => {
    var ptr = (growMemViews(), HEAPU32)[((stringViewPtr) >>> 2) >>> 0];
    var length = (growMemViews(), HEAPU32)[(((stringViewPtr) + (4)) >>> 2) >>> 0];
    // UTF8ToString stops at the first null terminator character in the
    // string regardless of the length.
    return UTF8ToString(ptr, length);
  },
  makeStringFromOptionalStringView: stringViewPtr => {
    var ptr = (growMemViews(), HEAPU32)[((stringViewPtr) >>> 2) >>> 0];
    var length = (growMemViews(), HEAPU32)[(((stringViewPtr) + (4)) >>> 2) >>> 0];
    // If we don't have a valid string pointer, just return undefined when
    // optional.
    if (!ptr) {
      if (length === 0) {
        return "";
      }
      return undefined;
    }
    // UTF8ToString stops at the first null terminator character in the
    // string regardless of the length.
    return UTF8ToString(ptr, length);
  },
  makeColor: ptr => ({
    "r": (growMemViews(), HEAPF64)[((ptr) >>> 3) >>> 0],
    "g": (growMemViews(), HEAPF64)[(((ptr) + (8)) >>> 3) >>> 0],
    "b": (growMemViews(), HEAPF64)[(((ptr) + (16)) >>> 3) >>> 0],
    "a": (growMemViews(), HEAPF64)[(((ptr) + (24)) >>> 3) >>> 0]
  }),
  makeExtent3D: ptr => ({
    "width": (growMemViews(), HEAPU32)[((ptr) >>> 2) >>> 0],
    "height": (growMemViews(), HEAPU32)[(((ptr) + (4)) >>> 2) >>> 0],
    "depthOrArrayLayers": (growMemViews(), HEAPU32)[(((ptr) + (8)) >>> 2) >>> 0]
  }),
  makeOrigin3D: ptr => ({
    "x": (growMemViews(), HEAPU32)[((ptr) >>> 2) >>> 0],
    "y": (growMemViews(), HEAPU32)[(((ptr) + (4)) >>> 2) >>> 0],
    "z": (growMemViews(), HEAPU32)[(((ptr) + (8)) >>> 2) >>> 0]
  }),
  makeTexelCopyTextureInfo: ptr => ({
    "texture": WebGPU.getJsObject((growMemViews(), HEAPU32)[((ptr) >>> 2) >>> 0]),
    "mipLevel": (growMemViews(), HEAPU32)[(((ptr) + (4)) >>> 2) >>> 0],
    "origin": WebGPU.makeOrigin3D(ptr + 8),
    "aspect": WebGPU.TextureAspect[(growMemViews(), HEAP32)[(((ptr) + (20)) >>> 2) >>> 0]]
  }),
  makeTexelCopyBufferLayout: ptr => {
    var bytesPerRow = (growMemViews(), HEAPU32)[(((ptr) + (8)) >>> 2) >>> 0];
    var rowsPerImage = (growMemViews(), HEAPU32)[(((ptr) + (12)) >>> 2) >>> 0];
    return {
      "offset": readI53FromI64(ptr),
      "bytesPerRow": bytesPerRow === 4294967295 ? undefined : bytesPerRow,
      "rowsPerImage": rowsPerImage === 4294967295 ? undefined : rowsPerImage
    };
  },
  makeTexelCopyBufferInfo: ptr => {
    var layoutPtr = ptr + 0;
    var bufferCopyView = WebGPU.makeTexelCopyBufferLayout(layoutPtr);
    bufferCopyView["buffer"] = WebGPU.getJsObject((growMemViews(), HEAPU32)[(((ptr) + (16)) >>> 2) >>> 0]);
    return bufferCopyView;
  },
  optionalQuerySetIndex: index => index === 4294967295 ? undefined : index,
  makePassTimestampWrites: ptr => {
    if (ptr === 0) return undefined;
    return {
      "querySet": WebGPU.getJsObject((growMemViews(), HEAPU32)[(((ptr) + (4)) >>> 2) >>> 0]),
      "beginningOfPassWriteIndex": WebGPU.optionalQuerySetIndex((growMemViews(), HEAPU32)[(((ptr) + (8)) >>> 2) >>> 0]),
      "endOfPassWriteIndex": WebGPU.optionalQuerySetIndex((growMemViews(), HEAPU32)[(((ptr) + (12)) >>> 2) >>> 0])
    };
  },
  makePipelineConstants: (constantCount, constantsPtr) => {
    if (!constantCount) return;
    var constants = {};
    for (var i = 0; i < constantCount; ++i) {
      var entryPtr = constantsPtr + 24 * i;
      var key = WebGPU.makeStringFromStringView(entryPtr + 4);
      constants[key] = (growMemViews(), HEAPF64)[(((entryPtr) + (16)) >>> 3) >>> 0];
    }
    return constants;
  },
  makePipelineLayout: layoutPtr => {
    if (!layoutPtr) return "auto";
    return WebGPU.getJsObject(layoutPtr);
  },
  makeComputeState: ptr => {
    if (!ptr) return undefined;
    var desc = {
      "module": WebGPU.getJsObject((growMemViews(), HEAPU32)[(((ptr) + (4)) >>> 2) >>> 0]),
      "constants": WebGPU.makePipelineConstants((growMemViews(), HEAPU32)[(((ptr) + (16)) >>> 2) >>> 0], (growMemViews(), 
      HEAPU32)[(((ptr) + (20)) >>> 2) >>> 0]),
      "entryPoint": WebGPU.makeStringFromOptionalStringView(ptr + 8)
    };
    return desc;
  },
  makeComputePipelineDesc: descriptor => {
    var desc = {
      "label": WebGPU.makeStringFromOptionalStringView(descriptor + 4),
      "layout": WebGPU.makePipelineLayout((growMemViews(), HEAPU32)[(((descriptor) + (12)) >>> 2) >>> 0]),
      "compute": WebGPU.makeComputeState(descriptor + 16)
    };
    return desc;
  },
  makeRenderPipelineDesc: descriptor => {
    function makePrimitiveState(psPtr) {
      if (!psPtr) return undefined;
      return {
        "topology": WebGPU.PrimitiveTopology[(growMemViews(), HEAP32)[(((psPtr) + (4)) >>> 2) >>> 0]],
        "stripIndexFormat": WebGPU.IndexFormat[(growMemViews(), HEAP32)[(((psPtr) + (8)) >>> 2) >>> 0]],
        "frontFace": WebGPU.FrontFace[(growMemViews(), HEAP32)[(((psPtr) + (12)) >>> 2) >>> 0]],
        "cullMode": WebGPU.CullMode[(growMemViews(), HEAP32)[(((psPtr) + (16)) >>> 2) >>> 0]],
        "unclippedDepth": !!((growMemViews(), HEAPU32)[(((psPtr) + (20)) >>> 2) >>> 0])
      };
    }
    function makeBlendComponent(bdPtr) {
      if (!bdPtr) return undefined;
      return {
        "operation": WebGPU.BlendOperation[(growMemViews(), HEAP32)[((bdPtr) >>> 2) >>> 0]],
        "srcFactor": WebGPU.BlendFactor[(growMemViews(), HEAP32)[(((bdPtr) + (4)) >>> 2) >>> 0]],
        "dstFactor": WebGPU.BlendFactor[(growMemViews(), HEAP32)[(((bdPtr) + (8)) >>> 2) >>> 0]]
      };
    }
    function makeBlendState(bsPtr) {
      if (!bsPtr) return undefined;
      return {
        "alpha": makeBlendComponent(bsPtr + 12),
        "color": makeBlendComponent(bsPtr + 0)
      };
    }
    function makeColorState(csPtr) {
      var format = WebGPU.TextureFormat[(growMemViews(), HEAP32)[(((csPtr) + (4)) >>> 2) >>> 0]];
      return format ? {
        "format": format,
        "blend": makeBlendState((growMemViews(), HEAPU32)[(((csPtr) + (8)) >>> 2) >>> 0]),
        "writeMask": (growMemViews(), HEAPU32)[(((csPtr) + (16)) >>> 2) >>> 0]
      } : undefined;
    }
    function makeColorStates(count, csArrayPtr) {
      var states = [];
      for (var i = 0; i < count; ++i) {
        states.push(makeColorState(csArrayPtr + 24 * i));
      }
      return states;
    }
    function makeStencilStateFace(ssfPtr) {
      return {
        "compare": WebGPU.CompareFunction[(growMemViews(), HEAP32)[((ssfPtr) >>> 2) >>> 0]],
        "failOp": WebGPU.StencilOperation[(growMemViews(), HEAP32)[(((ssfPtr) + (4)) >>> 2) >>> 0]],
        "depthFailOp": WebGPU.StencilOperation[(growMemViews(), HEAP32)[(((ssfPtr) + (8)) >>> 2) >>> 0]],
        "passOp": WebGPU.StencilOperation[(growMemViews(), HEAP32)[(((ssfPtr) + (12)) >>> 2) >>> 0]]
      };
    }
    function makeDepthStencilState(dssPtr) {
      if (!dssPtr) return undefined;
      return {
        "format": WebGPU.TextureFormat[(growMemViews(), HEAP32)[(((dssPtr) + (4)) >>> 2) >>> 0]],
        "depthWriteEnabled": !!((growMemViews(), HEAPU32)[(((dssPtr) + (8)) >>> 2) >>> 0]),
        "depthCompare": WebGPU.CompareFunction[(growMemViews(), HEAP32)[(((dssPtr) + (12)) >>> 2) >>> 0]],
        "stencilFront": makeStencilStateFace(dssPtr + 16),
        "stencilBack": makeStencilStateFace(dssPtr + 32),
        "stencilReadMask": (growMemViews(), HEAPU32)[(((dssPtr) + (48)) >>> 2) >>> 0],
        "stencilWriteMask": (growMemViews(), HEAPU32)[(((dssPtr) + (52)) >>> 2) >>> 0],
        "depthBias": (growMemViews(), HEAP32)[(((dssPtr) + (56)) >>> 2) >>> 0],
        "depthBiasSlopeScale": (growMemViews(), HEAPF32)[(((dssPtr) + (60)) >>> 2) >>> 0],
        "depthBiasClamp": (growMemViews(), HEAPF32)[(((dssPtr) + (64)) >>> 2) >>> 0]
      };
    }
    function makeVertexAttribute(vaPtr) {
      return {
        "format": WebGPU.VertexFormat[(growMemViews(), HEAP32)[(((vaPtr) + (4)) >>> 2) >>> 0]],
        "offset": readI53FromI64((vaPtr) + (8)),
        "shaderLocation": (growMemViews(), HEAPU32)[(((vaPtr) + (16)) >>> 2) >>> 0]
      };
    }
    function makeVertexAttributes(count, vaArrayPtr) {
      var vas = [];
      for (var i = 0; i < count; ++i) {
        vas.push(makeVertexAttribute(vaArrayPtr + i * 24));
      }
      return vas;
    }
    function makeVertexBuffer(vbPtr) {
      if (!vbPtr) return undefined;
      var stepMode = WebGPU.VertexStepMode[(growMemViews(), HEAP32)[(((vbPtr) + (4)) >>> 2) >>> 0]];
      var attributeCount = (growMemViews(), HEAPU32)[(((vbPtr) + (16)) >>> 2) >>> 0];
      if (!stepMode && !attributeCount) {
        return null;
      }
      return {
        "arrayStride": readI53FromI64((vbPtr) + (8)),
        "stepMode": stepMode,
        "attributes": makeVertexAttributes(attributeCount, (growMemViews(), HEAPU32)[(((vbPtr) + (20)) >>> 2) >>> 0])
      };
    }
    function makeVertexBuffers(count, vbArrayPtr) {
      if (!count) return undefined;
      var vbs = [];
      for (var i = 0; i < count; ++i) {
        vbs.push(makeVertexBuffer(vbArrayPtr + i * 24));
      }
      return vbs;
    }
    function makeVertexState(viPtr) {
      if (!viPtr) return undefined;
      var desc = {
        "module": WebGPU.getJsObject((growMemViews(), HEAPU32)[(((viPtr) + (4)) >>> 2) >>> 0]),
        "constants": WebGPU.makePipelineConstants((growMemViews(), HEAPU32)[(((viPtr) + (16)) >>> 2) >>> 0], (growMemViews(), 
        HEAPU32)[(((viPtr) + (20)) >>> 2) >>> 0]),
        "buffers": makeVertexBuffers((growMemViews(), HEAPU32)[(((viPtr) + (24)) >>> 2) >>> 0], (growMemViews(), 
        HEAPU32)[(((viPtr) + (28)) >>> 2) >>> 0]),
        "entryPoint": WebGPU.makeStringFromOptionalStringView(viPtr + 8)
      };
      return desc;
    }
    function makeMultisampleState(msPtr) {
      if (!msPtr) return undefined;
      return {
        "count": (growMemViews(), HEAPU32)[(((msPtr) + (4)) >>> 2) >>> 0],
        "mask": (growMemViews(), HEAPU32)[(((msPtr) + (8)) >>> 2) >>> 0],
        "alphaToCoverageEnabled": !!((growMemViews(), HEAPU32)[(((msPtr) + (12)) >>> 2) >>> 0])
      };
    }
    function makeFragmentState(fsPtr) {
      if (!fsPtr) return undefined;
      var desc = {
        "module": WebGPU.getJsObject((growMemViews(), HEAPU32)[(((fsPtr) + (4)) >>> 2) >>> 0]),
        "constants": WebGPU.makePipelineConstants((growMemViews(), HEAPU32)[(((fsPtr) + (16)) >>> 2) >>> 0], (growMemViews(), 
        HEAPU32)[(((fsPtr) + (20)) >>> 2) >>> 0]),
        "targets": makeColorStates((growMemViews(), HEAPU32)[(((fsPtr) + (24)) >>> 2) >>> 0], (growMemViews(), 
        HEAPU32)[(((fsPtr) + (28)) >>> 2) >>> 0]),
        "entryPoint": WebGPU.makeStringFromOptionalStringView(fsPtr + 8)
      };
      return desc;
    }
    var desc = {
      "label": WebGPU.makeStringFromOptionalStringView(descriptor + 4),
      "layout": WebGPU.makePipelineLayout((growMemViews(), HEAPU32)[(((descriptor) + (12)) >>> 2) >>> 0]),
      "vertex": makeVertexState(descriptor + 16),
      "primitive": makePrimitiveState(descriptor + 48),
      "depthStencil": makeDepthStencilState((growMemViews(), HEAPU32)[(((descriptor) + (72)) >>> 2) >>> 0]),
      "multisample": makeMultisampleState(descriptor + 76),
      "fragment": makeFragmentState((growMemViews(), HEAPU32)[(((descriptor) + (92)) >>> 2) >>> 0])
    };
    return desc;
  },
  fillLimitStruct: (limits, limitsOutPtr) => {
    var nextInChainPtr = (growMemViews(), HEAPU32)[((limitsOutPtr) >>> 2) >>> 0];
    function setLimitValueU32(name, basePtr, limitOffset, fallbackValue = 0) {
      var limitValue = limits[name] ?? fallbackValue;
      (growMemViews(), HEAPU32)[(((basePtr) + (limitOffset)) >>> 2) >>> 0] = limitValue;
    }
    function setLimitValueU64(name, basePtr, limitOffset, fallbackValue = 0) {
      var limitValue = limits[name] ?? fallbackValue;
      // Limits are integer-valued JS `Number`s, so they fit in 'i53'.
      writeI53ToI64((basePtr) + (limitOffset), limitValue);
    }
    setLimitValueU32("maxTextureDimension1D", limitsOutPtr, 4);
    setLimitValueU32("maxTextureDimension2D", limitsOutPtr, 8);
    setLimitValueU32("maxTextureDimension3D", limitsOutPtr, 12);
    setLimitValueU32("maxTextureArrayLayers", limitsOutPtr, 16);
    setLimitValueU32("maxBindGroups", limitsOutPtr, 20);
    setLimitValueU32("maxBindGroupsPlusVertexBuffers", limitsOutPtr, 24);
    setLimitValueU32("maxBindingsPerBindGroup", limitsOutPtr, 28);
    setLimitValueU32("maxDynamicUniformBuffersPerPipelineLayout", limitsOutPtr, 32);
    setLimitValueU32("maxDynamicStorageBuffersPerPipelineLayout", limitsOutPtr, 36);
    setLimitValueU32("maxSampledTexturesPerShaderStage", limitsOutPtr, 40);
    setLimitValueU32("maxSamplersPerShaderStage", limitsOutPtr, 44);
    setLimitValueU32("maxStorageBuffersPerShaderStage", limitsOutPtr, 48);
    setLimitValueU32("maxStorageTexturesPerShaderStage", limitsOutPtr, 52);
    setLimitValueU32("maxUniformBuffersPerShaderStage", limitsOutPtr, 56);
    setLimitValueU32("minUniformBufferOffsetAlignment", limitsOutPtr, 80);
    setLimitValueU32("minStorageBufferOffsetAlignment", limitsOutPtr, 84);
    setLimitValueU64("maxUniformBufferBindingSize", limitsOutPtr, 64);
    setLimitValueU64("maxStorageBufferBindingSize", limitsOutPtr, 72);
    setLimitValueU32("maxVertexBuffers", limitsOutPtr, 88);
    setLimitValueU64("maxBufferSize", limitsOutPtr, 96);
    setLimitValueU32("maxVertexAttributes", limitsOutPtr, 104);
    setLimitValueU32("maxVertexBufferArrayStride", limitsOutPtr, 108);
    setLimitValueU32("maxInterStageShaderVariables", limitsOutPtr, 112);
    setLimitValueU32("maxColorAttachments", limitsOutPtr, 116);
    setLimitValueU32("maxColorAttachmentBytesPerSample", limitsOutPtr, 120);
    setLimitValueU32("maxComputeWorkgroupStorageSize", limitsOutPtr, 124);
    setLimitValueU32("maxComputeInvocationsPerWorkgroup", limitsOutPtr, 128);
    setLimitValueU32("maxComputeWorkgroupSizeX", limitsOutPtr, 132);
    setLimitValueU32("maxComputeWorkgroupSizeY", limitsOutPtr, 136);
    setLimitValueU32("maxComputeWorkgroupSizeZ", limitsOutPtr, 140);
    setLimitValueU32("maxComputeWorkgroupsPerDimension", limitsOutPtr, 144);
    // Note this limit is new and won't be present in all browsers for a while. Fall back to 0.
    setLimitValueU32("maxImmediateSize", limitsOutPtr, 148);
    if (nextInChainPtr !== 0) {
      var sType = (growMemViews(), HEAP32)[(((nextInChainPtr) + (4)) >>> 2) >>> 0];
      var compatibilityModeLimitsPtr = nextInChainPtr;
      // Note these limits are new and won't be present in all browsers for a while. Fall back to exposing the PerShaderStage limit.
      setLimitValueU32("maxStorageBuffersInVertexStage", compatibilityModeLimitsPtr, 8, limits.maxStorageBuffersPerShaderStage);
      setLimitValueU32("maxStorageBuffersInFragmentStage", compatibilityModeLimitsPtr, 16, limits.maxStorageBuffersPerShaderStage);
      setLimitValueU32("maxStorageTexturesInVertexStage", compatibilityModeLimitsPtr, 12, limits.maxStorageTexturesPerShaderStage);
      setLimitValueU32("maxStorageTexturesInFragmentStage", compatibilityModeLimitsPtr, 20, limits.maxStorageTexturesPerShaderStage);
    }
  },
  fillAdapterInfoStruct: (info, infoStruct) => {
    // Populate subgroup limits.
    (growMemViews(), HEAPU32)[(((infoStruct) + (52)) >>> 2) >>> 0] = info.subgroupMinSize;
    (growMemViews(), HEAPU32)[(((infoStruct) + (56)) >>> 2) >>> 0] = info.subgroupMaxSize;
    // Append all the strings together to condense into a single malloc.
    var strs = info.vendor + info.architecture + info.device + info.description;
    var strPtr = stringToNewUTF8(strs);
    var vendorLen = lengthBytesUTF8(info.vendor);
    WebGPU.setStringView(infoStruct + 4, strPtr, vendorLen);
    strPtr += vendorLen;
    var architectureLen = lengthBytesUTF8(info.architecture);
    WebGPU.setStringView(infoStruct + 12, strPtr, architectureLen);
    strPtr += architectureLen;
    var deviceLen = lengthBytesUTF8(info.device);
    WebGPU.setStringView(infoStruct + 20, strPtr, deviceLen);
    strPtr += deviceLen;
    var descriptionLen = lengthBytesUTF8(info.description);
    WebGPU.setStringView(infoStruct + 28, strPtr, descriptionLen);
    strPtr += descriptionLen;
    (growMemViews(), HEAP32)[(((infoStruct) + (36)) >>> 2) >>> 0] = 2;
    var adapterType = info.isFallbackAdapter ? 3 : 4;
    (growMemViews(), HEAP32)[(((infoStruct) + (40)) >>> 2) >>> 0] = adapterType;
    (growMemViews(), HEAPU32)[(((infoStruct) + (44)) >>> 2) >>> 0] = 0;
    (growMemViews(), HEAPU32)[(((infoStruct) + (48)) >>> 2) >>> 0] = 0;
    WebGPU.iterateExtensions(infoStruct, {
      327739: ext => {
        let configCount = 0;
        let configsPtr = 0;
        if (info.subgroupMatrixConfigs) {
          configCount = info.subgroupMatrixConfigs.length;
          configsPtr = _malloc(configCount * 28);
          for (const [i, cfg] of info.subgroupMatrixConfigs.entries()) {
            const ptr = configsPtr + i * 28;
            const componentType = WebGPU.SubgroupMatrixComponentType.indexOf(cfg.componentType);
            const resultComponentType = WebGPU.SubgroupMatrixComponentType.indexOf(cfg.resultComponentType);
            (growMemViews(), HEAP32)[((ptr) >>> 2) >>> 0] = componentType;
            (growMemViews(), HEAP32)[(((ptr) + (4)) >>> 2) >>> 0] = resultComponentType;
            (growMemViews(), HEAPU32)[(((ptr) + (8)) >>> 2) >>> 0] = cfg.M;
            (growMemViews(), HEAPU32)[(((ptr) + (12)) >>> 2) >>> 0] = cfg.N;
            (growMemViews(), HEAPU32)[(((ptr) + (16)) >>> 2) >>> 0] = cfg.K;
          }
        }
        (growMemViews(), HEAPU32)[(((ext) + (12)) >>> 2) >>> 0] = configsPtr;
        (growMemViews(), HEAPU32)[(((ext) + (8)) >>> 2) >>> 0] = configCount;
      }
    });
  },
  AddressMode: [ , "clamp-to-edge", "repeat", "mirror-repeat" ],
  BlendFactor: [ , "zero", "one", "src", "one-minus-src", "src-alpha", "one-minus-src-alpha", "dst", "one-minus-dst", "dst-alpha", "one-minus-dst-alpha", "src-alpha-saturated", "constant", "one-minus-constant", "src1", "one-minus-src1", "src1-alpha", "one-minus-src1-alpha" ],
  BlendOperation: [ , "add", "subtract", "reverse-subtract", "min", "max" ],
  BufferBindingType: [ , , "uniform", "storage", "read-only-storage" ],
  BufferMapState: [ , "unmapped", "pending", "mapped" ],
  CompareFunction: [ , "never", "less", "equal", "less-equal", "greater", "not-equal", "greater-equal", "always" ],
  CompilationInfoRequestStatus: [ , "success", "callback-cancelled" ],
  ComponentSwizzle: [ , "0", "1", "r", "g", "b", "a" ],
  CompositeAlphaMode: [ , "opaque", "premultiplied", "unpremultiplied", "inherit" ],
  CullMode: [ , "none", "front", "back" ],
  ErrorFilter: [ , "validation", "out-of-memory", "internal" ],
  FeatureLevel: [ , "compatibility", "core" ],
  FeatureName: {
    1: "core-features-and-limits",
    2: "depth-clip-control",
    3: "depth32float-stencil8",
    4: "texture-compression-bc",
    5: "texture-compression-bc-sliced-3d",
    6: "texture-compression-etc2",
    7: "texture-compression-astc",
    8: "texture-compression-astc-sliced-3d",
    9: "timestamp-query",
    10: "indirect-first-instance",
    11: "shader-f16",
    12: "rg11b10ufloat-renderable",
    13: "bgra8unorm-storage",
    14: "float32-filterable",
    15: "float32-blendable",
    16: "clip-distances",
    17: "dual-source-blending",
    18: "subgroups",
    19: "texture-formats-tier1",
    20: "texture-formats-tier2",
    21: "primitive-index",
    22: "texture-component-swizzle",
    23: "subgroup-size-control",
    24: "texture-compression-unaligned",
    25: "atomic-vec2u-min-max",
    327692: "chromium-experimental-unorm16-texture-formats",
    327729: "chromium-experimental-multi-draw-indirect",
    327732: "chromium-experimental-subgroup-matrix"
  },
  FilterMode: [ , "nearest", "linear" ],
  FrontFace: [ , "ccw", "cw" ],
  IndexFormat: [ , "uint16", "uint32" ],
  InstanceFeatureName: [ , "timed-wait-any", "shader-source-spirv", "multiple-devices-per-adapter" ],
  LoadOp: [ , "load", "clear" ],
  MipmapFilterMode: [ , "nearest", "linear" ],
  OptionalBool: [ "false", "true" ],
  PowerPreference: [ , "low-power", "high-performance" ],
  PredefinedColorSpace: [ , "srgb", "display-p3" ],
  PrimitiveTopology: [ , "point-list", "line-list", "line-strip", "triangle-list", "triangle-strip" ],
  QueryType: [ , "occlusion", "timestamp" ],
  SamplerBindingType: [ , , "filtering", "non-filtering", "comparison" ],
  Status: [ , "success", "error" ],
  StencilOperation: [ , "keep", "zero", "replace", "invert", "increment-clamp", "decrement-clamp", "increment-wrap", "decrement-wrap" ],
  StorageTextureAccess: [ , , "write-only", "read-only", "read-write" ],
  StoreOp: [ , "store", "discard" ],
  SubgroupMatrixComponentType: [ , "f32", "f16", "u32", "i32", "u8", "i8" ],
  SurfaceGetCurrentTextureStatus: [ , "success-optimal", "success-suboptimal", "timeout", "outdated", "lost", "error" ],
  TextureAspect: [ , "all", "stencil-only", "depth-only" ],
  TextureDimension: [ , "1d", "2d", "3d" ],
  TextureFormat: [ , "r8unorm", "r8snorm", "r8uint", "r8sint", "r16unorm", "r16snorm", "r16uint", "r16sint", "r16float", "rg8unorm", "rg8snorm", "rg8uint", "rg8sint", "r32float", "r32uint", "r32sint", "rg16unorm", "rg16snorm", "rg16uint", "rg16sint", "rg16float", "rgba8unorm", "rgba8unorm-srgb", "rgba8snorm", "rgba8uint", "rgba8sint", "bgra8unorm", "bgra8unorm-srgb", "rgb10a2uint", "rgb10a2unorm", "rg11b10ufloat", "rgb9e5ufloat", "rg32float", "rg32uint", "rg32sint", "rgba16unorm", "rgba16snorm", "rgba16uint", "rgba16sint", "rgba16float", "rgba32float", "rgba32uint", "rgba32sint", "stencil8", "depth16unorm", "depth24plus", "depth24plus-stencil8", "depth32float", "depth32float-stencil8", "bc1-rgba-unorm", "bc1-rgba-unorm-srgb", "bc2-rgba-unorm", "bc2-rgba-unorm-srgb", "bc3-rgba-unorm", "bc3-rgba-unorm-srgb", "bc4-r-unorm", "bc4-r-snorm", "bc5-rg-unorm", "bc5-rg-snorm", "bc6h-rgb-ufloat", "bc6h-rgb-float", "bc7-rgba-unorm", "bc7-rgba-unorm-srgb", "etc2-rgb8unorm", "etc2-rgb8unorm-srgb", "etc2-rgb8a1unorm", "etc2-rgb8a1unorm-srgb", "etc2-rgba8unorm", "etc2-rgba8unorm-srgb", "eac-r11unorm", "eac-r11snorm", "eac-rg11unorm", "eac-rg11snorm", "astc-4x4-unorm", "astc-4x4-unorm-srgb", "astc-5x4-unorm", "astc-5x4-unorm-srgb", "astc-5x5-unorm", "astc-5x5-unorm-srgb", "astc-6x5-unorm", "astc-6x5-unorm-srgb", "astc-6x6-unorm", "astc-6x6-unorm-srgb", "astc-8x5-unorm", "astc-8x5-unorm-srgb", "astc-8x6-unorm", "astc-8x6-unorm-srgb", "astc-8x8-unorm", "astc-8x8-unorm-srgb", "astc-10x5-unorm", "astc-10x5-unorm-srgb", "astc-10x6-unorm", "astc-10x6-unorm-srgb", "astc-10x8-unorm", "astc-10x8-unorm-srgb", "astc-10x10-unorm", "astc-10x10-unorm-srgb", "astc-12x10-unorm", "astc-12x10-unorm-srgb", "astc-12x12-unorm", "astc-12x12-unorm-srgb" ],
  TextureSampleType: [ , , "float", "unfilterable-float", "depth", "sint", "uint" ],
  TextureViewDimension: [ , "1d", "2d", "2d-array", "cube", "cube-array", "3d" ],
  ToneMappingMode: [ , "standard", "extended" ],
  VertexFormat: [ , "uint8", "uint8x2", "uint8x4", "sint8", "sint8x2", "sint8x4", "unorm8", "unorm8x2", "unorm8x4", "snorm8", "snorm8x2", "snorm8x4", "uint16", "uint16x2", "uint16x4", "sint16", "sint16x2", "sint16x4", "unorm16", "unorm16x2", "unorm16x4", "snorm16", "snorm16x2", "snorm16x4", "float16", "float16x2", "float16x4", "float32", "float32x2", "float32x3", "float32x4", "uint32", "uint32x2", "uint32x3", "uint32x4", "sint32", "sint32x2", "sint32x3", "sint32x4", "unorm10-10-10-2", "unorm8x4-bgra", "snorm10-10-10-2" ],
  VertexStepMode: [ , "vertex", "instance" ],
  WGSLLanguageFeatureName: [ , "readonly_and_readwrite_storage_textures", "packed_4x8_integer_dot_product", "unrestricted_pointer_parameters", "pointer_composite_access", "uniform_buffer_standard_layout", "subgroup_id", "texture_and_sampler_let", "subgroup_uniformity", "texture_formats_tier1", "linear_indexing", "immediate_address_space", "buffer_view", "swizzle_assignment", "fragment_depth" ]
};

function _emwgpuBufferDestroy(bufferPtr) {
  bufferPtr >>>= 0;
  var buffer = WebGPU.getJsObject(bufferPtr);
  var onUnmap = WebGPU.Internals.bufferOnUnmaps[bufferPtr];
  if (onUnmap) {
    for (var i = 0; i < onUnmap.length; ++i) {
      onUnmap[i]();
    }
    delete WebGPU.Internals.bufferOnUnmaps[bufferPtr];
  }
  buffer.destroy();
}

var _emwgpuBufferMapAsync = function(bufferPtr, futureId, mode, offset, size) {
  bufferPtr >>>= 0;
  futureId = bigintToI53Checked(futureId);
  mode = bigintToI53Checked(mode);
  offset >>>= 0;
  size >>>= 0;
  var buffer = WebGPU.getJsObject(bufferPtr);
  WebGPU.Internals.bufferOnUnmaps[bufferPtr] = [];
  if (size == 4294967295) size = undefined;
  runtimeKeepalivePush();
  // mapAsync
  WebGPU.Internals.futureInsert(futureId, buffer.mapAsync(mode, offset, size).then(() => {
    runtimeKeepalivePop();
    // mapAsync fulfilled
    callUserCallback(() => {
      _emwgpuOnMapAsyncCompleted(futureId, 1, 0);
    });
  }, ex => {
    runtimeKeepalivePop();
    // mapAsync rejected
    callUserCallback(() => {
      var sp = stackSave();
      var messagePtr = stringToUTF8OnStack(ex.message);
      var status = ex.name === "AbortError" ? 4 : ex.name === "OperationError" ? 3 : 0;
      _emwgpuOnMapAsyncCompleted(futureId, status, messagePtr);
      delete WebGPU.Internals.bufferOnUnmaps[bufferPtr];
    });
  }));
};

function _emwgpuBufferReadMappedRange(bufferPtr, offset, data, size) {
  bufferPtr >>>= 0;
  offset >>>= 0;
  data >>>= 0;
  size >>>= 0;
  var buffer = WebGPU.getJsObject(bufferPtr);
  var mapped;
  try {
    mapped = buffer.getMappedRange(offset, size);
  } catch (ex) {
    return 2;
  }
  (growMemViews(), HEAPU8).set(new Uint8Array(mapped), data >>> 0);
  return 1;
}

function _emwgpuBufferUnmap(bufferPtr) {
  bufferPtr >>>= 0;
  var buffer = WebGPU.getJsObject(bufferPtr);
  var onUnmap = WebGPU.Internals.bufferOnUnmaps[bufferPtr];
  if (!onUnmap) {
    // Already unmapped
    return;
  }
  for (var i = 0; i < onUnmap.length; ++i) {
    onUnmap[i]();
  }
  delete WebGPU.Internals.bufferOnUnmaps[bufferPtr];
  buffer.unmap();
}

function _emwgpuDelete(ptr) {
  ptr >>>= 0;
  delete WebGPU.Internals.jsObjects[ptr >>> 0];
}

function _emwgpuDeviceCreateBuffer(devicePtr, descriptor, bufferPtr) {
  devicePtr >>>= 0;
  descriptor >>>= 0;
  bufferPtr >>>= 0;
  var mappedAtCreation = !!((growMemViews(), HEAPU32)[(((descriptor) + (32)) >>> 2) >>> 0]);
  var desc = {
    "label": WebGPU.makeStringFromOptionalStringView(descriptor + 4),
    "usage": (growMemViews(), HEAPU32)[(((descriptor) + (16)) >>> 2) >>> 0],
    "size": readI53FromI64((descriptor) + (24)),
    "mappedAtCreation": mappedAtCreation
  };
  var device = WebGPU.getJsObject(devicePtr);
  var buffer;
  try {
    buffer = device.createBuffer(desc);
  } catch (ex) {
    // The only exception should be RangeError if mapping at creation ran out of memory.
    return false;
  }
  WebGPU.Internals.jsObjectInsert(bufferPtr, buffer);
  if (mappedAtCreation) {
    WebGPU.Internals.bufferOnUnmaps[bufferPtr] = [];
  }
  return true;
}

function _emwgpuDeviceCreateShaderModule(devicePtr, descriptor, shaderModulePtr) {
  devicePtr >>>= 0;
  descriptor >>>= 0;
  shaderModulePtr >>>= 0;
  var nextInChainPtr = (growMemViews(), HEAPU32)[((descriptor) >>> 2) >>> 0];
  var sType = (growMemViews(), HEAP32)[(((nextInChainPtr) + (4)) >>> 2) >>> 0];
  var desc = {
    "label": WebGPU.makeStringFromOptionalStringView(descriptor + 4),
    "code": ""
  };
  switch (sType) {
   case 2:
    {
      desc["code"] = WebGPU.makeStringFromStringView(nextInChainPtr + 8);
      break;
    }
  }
  var device = WebGPU.getJsObject(devicePtr);
  WebGPU.Internals.jsObjectInsert(shaderModulePtr, device.createShaderModule(desc));
}

var _emwgpuDeviceDestroy = devicePtr => {
  const device = WebGPU.getJsObject(devicePtr);
  // Remove the onuncapturederror handler which holds a pointer to the WGPUDevice.
  device.onuncapturederror = null;
  device.destroy();
};

var ENV = {};

var getEnvStrings = () => {
  if (!getEnvStrings.strings) {
    // Default values.
    var lang = (globalThis.navigator?.language ?? "C").replace("-", "_") + ".UTF-8";
    var env = {
      "USER": "web_user",
      "LOGNAME": "web_user",
      "PATH": "/",
      "PWD": "/",
      "HOME": "/home/web_user",
      "LANG": lang,
      "_": getExecutableName()
    };
    // Apply the user-provided values, if any.
    for (var x in ENV) {
      // x is a key in ENV; if ENV[x] is undefined, that means it was
      // explicitly set to be so. We allow user code to do that to
      // force variables with default values to remain unset.
      if (ENV[x] === undefined) delete env[x]; else env[x] = ENV[x];
    }
    var strings = [];
    for (var x in env) {
      strings.push(`${x}=${env[x]}`);
    }
    getEnvStrings.strings = strings;
  }
  return getEnvStrings.strings;
};

function _environ_get(__environ, environ_buf) {
  if (ENVIRONMENT_IS_PTHREAD) return proxyToMainThread(72, 0, 1, __environ, environ_buf);
  __environ >>>= 0;
  environ_buf >>>= 0;
  var bufSize = 0;
  var envp = 0;
  for (var string of getEnvStrings()) {
    var ptr = environ_buf + bufSize;
    (growMemViews(), HEAPU32)[(((__environ) + (envp)) >>> 2) >>> 0] = ptr;
    bufSize += stringToUTF8(string, ptr, Infinity) + 1;
    envp += 4;
  }
  return 0;
}

function _environ_sizes_get(penviron_count, penviron_buf_size) {
  if (ENVIRONMENT_IS_PTHREAD) return proxyToMainThread(73, 0, 1, penviron_count, penviron_buf_size);
  penviron_count >>>= 0;
  penviron_buf_size >>>= 0;
  var strings = getEnvStrings();
  (growMemViews(), HEAPU32)[((penviron_count) >>> 2) >>> 0] = strings.length;
  var bufSize = 0;
  for (var string of strings) {
    bufSize += lengthBytesUTF8(string) + 1;
  }
  (growMemViews(), HEAPU32)[((penviron_buf_size) >>> 2) >>> 0] = bufSize;
  return 0;
}

var _stackSave = stackSave;

var _stackRestore = stackSave;

var WINK = {
  waiting: [],
  lost: false,
  errors: 0,
  pending: null,
  running: false,
  scheduled: false,
  inRunner: false,
  runnerTop: 0,
  outerSP: 0,
  promisingRun: null,
  schedule: function() {
    if (WINK.running || WINK.scheduled) return;
    WINK.scheduled = true;
    // A fresh task-free stack: no wasm frames under the promising call.
    queueMicrotask(WINK.drain);
  },
  drain: async function() {
    WINK.scheduled = false;
    WINK.running = true;
    try {
      while (WINK.pending && WINK.pending.size) {
        var queues = Array.from(WINK.pending);
        WINK.pending.clear();
        for (var i = 0; i < queues.length; ++i) await WINK.runQueue(queues[i]);
      }
    } catch (e) {
      err("wink: main-thread runner failed: " + (e && e.stack || e));
    } finally {
      WINK.running = false;
    }
  },
  runQueue: async function(queue) {
    if (!WINK.promisingRun) {
      var size = Module["winkRunnerStackSize"] || 16 * 1024 * 1024;
      var base = _malloc(size);
      if (!base) throw new Error("no memory for the runner stack");
      WINK.runnerTop = (base + size) & ~15;
      WINK.promisingRun = WebAssembly.promising(wasmExports["wink_main_run_queue"]);
    }
    WINK.outerSP = stackSave();
    stackRestore(WINK.runnerTop);
    WINK.inRunner = true;
    try {
      await WINK.promisingRun(queue);
    } finally {
      WINK.inRunner = false;
      stackRestore(WINK.outerSP);
    }
  },
  suspend: function(promise) {
    if (!WINK.inRunner) return promise;
    var mine = stackSave();
    stackRestore(WINK.outerSP);
    return promise.then(function(value) {
      WINK.outerSP = stackSave();
      stackRestore(mine);
      return value;
    });
  },
  wakeAll: function() {
    var waiting = WINK.waiting;
    if (!waiting.length) return;
    WINK.waiting = [];
    for (var i = 0; i < waiting.length; ++i) waiting[i]();
  },
  features: [ "texture-compression-bc", "texture-compression-bc-sliced-3d", "texture-compression-etc2", "texture-compression-astc", "texture-compression-astc-sliced-3d", "depth32float-stencil8", "rg11b10ufloat-renderable", "depth-clip-control", "float32-filterable", "float32-blendable", "clip-distances", "dual-source-blending", "timestamp-query", "indirect-first-instance", "texture-formats-tier1", "texture-formats-tier2" ],
  limitsUp: {
    maxUniformBuffersPerShaderStage: 16,
    maxInterStageShaderVariables: 32,
    maxVertexAttributes: 32,
    maxStorageBuffersPerShaderStage: 24,
    maxStorageBuffersInVertexStage: 24,
    maxStorageBuffersInFragmentStage: 24,
    maxStorageTexturesPerShaderStage: 8,
    maxStorageTexturesInVertexStage: 8,
    maxStorageTexturesInFragmentStage: 8,
    maxDynamicUniformBuffersPerPipelineLayout: 32,
    maxDynamicStorageBuffersPerPipelineLayout: 16,
    maxSampledTexturesPerShaderStage: 56,
    maxSamplersPerShaderStage: 32,
    maxColorAttachmentBytesPerSample: 128,
    maxComputeInvocationsPerWorkgroup: 1024,
    maxComputeWorkgroupSizeX: 1024,
    maxComputeWorkgroupSizeY: 1024,
    maxComputeWorkgroupSizeZ: 64,
    maxComputeWorkgroupStorageSize: 65536,
    maxTextureDimension1D: 16384,
    maxTextureDimension2D: 16384,
    maxTextureDimension3D: 2048,
    maxTextureArrayLayers: 2048
  },
  limitsDown: {
    minUniformBufferOffsetAlignment: 32,
    minStorageBufferOffsetAlignment: 32
  },
  descriptor: function(adapter) {
    var requiredFeatures = WINK.features.filter(function(f) {
      return adapter["features"]["has"](f);
    });
    var requiredLimits = {};
    var have = adapter["limits"];
    var short = [];
    for (var up in WINK.limitsUp) {
      if (typeof have[up] != "number") continue;
      requiredLimits[up] = Math.min(have[up], WINK.limitsUp[up]);
      if (have[up] < WINK.limitsUp[up]) short.push(up + " " + have[up]);
    }
    for (var down in WINK.limitsDown) {
      if (typeof have[down] != "number") continue;
      requiredLimits[down] = Math.max(have[down], WINK.limitsDown[down]);
    }
    if (short.length) err("wink: adapter limits below what the driver can use: " + short.join(", "));
    return {
      "requiredFeatures": requiredFeatures,
      "requiredLimits": requiredLimits
    };
  },
  adopt: function(device) {
    device["lost"]["then"](function(info) {
      WINK.lost = true;
      _wink_set_device_lost();
      err("wink: WebGPU device lost: " + info["reason"] + ": " + info["message"]);
      // A waiter whose map will now never complete is woken to see the loss.
      WINK.wakeAll();
    });
    device["addEventListener"]("uncapturederror", function(e) {
      if (WINK.errors++ < 32) err("wink: WebGPU error: " + e["error"]["message"]);
    });
    return WebGPU.importJsDevice(device);
  }
};

function _gex_wgpu_jspi_signal() {
  WINK.wakeAll();
}

function _gex_wgpu_jspi_wait() {
  if (WINK.lost) return;
  return WINK.suspend(new Promise(function(resolve) {
    WINK.waiting.push(resolve);
  }));
}

function _mono_interp_flush_jitcall_queue() {
  return {
    runtime_idx: 14
  };
}

function _mono_interp_invoke_wasm_jit_call_trampoline() {
  return {
    runtime_idx: 13
  };
}

function _mono_interp_jit_wasm_entry_trampoline() {
  return {
    runtime_idx: 9
  };
}

function _mono_interp_jit_wasm_jit_call_trampoline() {
  return {
    runtime_idx: 12
  };
}

function _mono_interp_record_interp_entry() {
  return {
    runtime_idx: 8
  };
}

function _mono_interp_tier_prepare_jiterpreter() {
  return {
    runtime_idx: 7
  };
}

function _mono_jiterp_wasm_jit_patch_interp_entry() {
  return {
    runtime_idx: 10
  };
}

function _mono_jiterp_wasm_jit_unpatch_interp_entry() {
  return {
    runtime_idx: 11
  };
}

function _mono_wasm_dump_threads() {
  return {
    runtime_idx: 42
  };
}

function _mono_wasm_free_method_data() {
  return {
    runtime_idx: 15
  };
}

function _mono_wasm_pthread_on_pthread_attached() {
  return {
    runtime_idx: 36
  };
}

function _mono_wasm_pthread_on_pthread_registered() {
  return {
    runtime_idx: 35
  };
}

function _mono_wasm_pthread_on_pthread_unregistered() {
  return {
    runtime_idx: 37
  };
}

function _mono_wasm_pthread_set_name() {
  return {
    runtime_idx: 38
  };
}

function _mono_wasm_schedule_synchronization_context() {
  return {
    runtime_idx: 41
  };
}

function _mono_wasm_set_entrypoint_breakpoint() {
  return {
    runtime_idx: 19
  };
}

function _mono_wasm_start_deputy_thread_async() {
  return {
    runtime_idx: 39
  };
}

function _mono_wasm_start_io_thread_async() {
  return {
    runtime_idx: 40
  };
}

function _mono_wasm_trace_logger() {
  return {
    runtime_idx: 18
  };
}

var initRandomFill = () => view => (view.set(crypto.getRandomValues(new Uint8Array(view.byteLength))), 
0);

var randomFill = view => (randomFill = initRandomFill())(view);

function _random_get(buffer, size) {
  buffer >>>= 0;
  size >>>= 0;
  return randomFill((growMemViews(), HEAPU8).subarray(buffer >>> 0, buffer + size >>> 0));
}

function _wgpuCommandEncoderBeginComputePass(encoderPtr, descriptor) {
  encoderPtr >>>= 0;
  descriptor >>>= 0;
  var desc;
  if (descriptor) {
    desc = {
      "label": WebGPU.makeStringFromOptionalStringView(descriptor + 4),
      "timestampWrites": WebGPU.makePassTimestampWrites((growMemViews(), HEAPU32)[(((descriptor) + (12)) >>> 2) >>> 0])
    };
  }
  var commandEncoder = WebGPU.getJsObject(encoderPtr);
  var ptr = _emwgpuCreateComputePassEncoder(0);
  WebGPU.Internals.jsObjectInsert(ptr, commandEncoder.beginComputePass(desc));
  return ptr;
}

function _wgpuCommandEncoderBeginRenderPass(encoderPtr, descriptor) {
  encoderPtr >>>= 0;
  descriptor >>>= 0;
  function makeColorAttachment(caPtr) {
    var viewPtr = (growMemViews(), HEAPU32)[(((caPtr) + (4)) >>> 2) >>> 0];
    if (viewPtr === 0) {
      // Null `view` means no attachment in this slot.
      return undefined;
    }
    var depthSlice = (growMemViews(), HEAPU32)[(((caPtr) + (8)) >>> 2) >>> 0];
    if (depthSlice == 4294967295) depthSlice = undefined;
    return {
      "view": WebGPU.getJsObject(viewPtr),
      "depthSlice": depthSlice,
      "resolveTarget": WebGPU.getJsObject((growMemViews(), HEAPU32)[(((caPtr) + (12)) >>> 2) >>> 0]),
      "clearValue": WebGPU.makeColor(caPtr + 24),
      "loadOp": WebGPU.LoadOp[(growMemViews(), HEAP32)[(((caPtr) + (16)) >>> 2) >>> 0]],
      "storeOp": WebGPU.StoreOp[(growMemViews(), HEAP32)[(((caPtr) + (20)) >>> 2) >>> 0]]
    };
  }
  function makeColorAttachments(count, caPtr) {
    var attachments = [];
    for (var i = 0; i < count; ++i) {
      attachments.push(makeColorAttachment(caPtr + 56 * i));
    }
    return attachments;
  }
  function makeDepthStencilAttachment(dsaPtr) {
    if (dsaPtr === 0) return undefined;
    return {
      "view": WebGPU.getJsObject((growMemViews(), HEAPU32)[(((dsaPtr) + (4)) >>> 2) >>> 0]),
      "depthClearValue": (value => Number.isNaN(value) ? undefined : value)((growMemViews(), 
      HEAPF32)[(((dsaPtr) + (16)) >>> 2) >>> 0]),
      "depthLoadOp": WebGPU.LoadOp[(growMemViews(), HEAP32)[(((dsaPtr) + (8)) >>> 2) >>> 0]],
      "depthStoreOp": WebGPU.StoreOp[(growMemViews(), HEAP32)[(((dsaPtr) + (12)) >>> 2) >>> 0]],
      "depthReadOnly": !!((growMemViews(), HEAPU32)[(((dsaPtr) + (20)) >>> 2) >>> 0]),
      "stencilClearValue": (growMemViews(), HEAPU32)[(((dsaPtr) + (32)) >>> 2) >>> 0],
      "stencilLoadOp": WebGPU.LoadOp[(growMemViews(), HEAP32)[(((dsaPtr) + (24)) >>> 2) >>> 0]],
      "stencilStoreOp": WebGPU.StoreOp[(growMemViews(), HEAP32)[(((dsaPtr) + (28)) >>> 2) >>> 0]],
      "stencilReadOnly": !!((growMemViews(), HEAPU32)[(((dsaPtr) + (36)) >>> 2) >>> 0])
    };
  }
  function makeRenderPassDescriptor(descriptor) {
    var nextInChainPtr = (growMemViews(), HEAPU32)[((descriptor) >>> 2) >>> 0];
    var maxDrawCount = undefined;
    if (nextInChainPtr !== 0) {
      var sType = (growMemViews(), HEAP32)[(((nextInChainPtr) + (4)) >>> 2) >>> 0];
      var renderPassMaxDrawCount = nextInChainPtr;
      // Note: The user could have passed a really huge value here, which is technically valid in
      // C but will not be allowed by WebGPU in JS because of [EnforceRange]. We intentionally
      // ignore that case because it's not useful - apps can just pick a smaller maxDrawCount.
      maxDrawCount = readI53FromI64((renderPassMaxDrawCount) + (8));
    }
    var desc = {
      "label": WebGPU.makeStringFromOptionalStringView(descriptor + 4),
      "colorAttachments": makeColorAttachments((growMemViews(), HEAPU32)[(((descriptor) + (12)) >>> 2) >>> 0], (growMemViews(), 
      HEAPU32)[(((descriptor) + (16)) >>> 2) >>> 0]),
      "depthStencilAttachment": makeDepthStencilAttachment((growMemViews(), HEAPU32)[(((descriptor) + (20)) >>> 2) >>> 0]),
      "occlusionQuerySet": WebGPU.getJsObject((growMemViews(), HEAPU32)[(((descriptor) + (24)) >>> 2) >>> 0]),
      "timestampWrites": WebGPU.makePassTimestampWrites((growMemViews(), HEAPU32)[(((descriptor) + (28)) >>> 2) >>> 0]),
      "maxDrawCount": maxDrawCount
    };
    return desc;
  }
  var desc = makeRenderPassDescriptor(descriptor);
  var commandEncoder = WebGPU.getJsObject(encoderPtr);
  var ptr = _emwgpuCreateRenderPassEncoder(0);
  WebGPU.Internals.jsObjectInsert(ptr, commandEncoder.beginRenderPass(desc));
  return ptr;
}

function _wgpuCommandEncoderClearBuffer(encoderPtr, bufferPtr, offset, size) {
  encoderPtr >>>= 0;
  bufferPtr >>>= 0;
  offset = bigintToI53Checked(offset);
  size = bigintToI53Checked(size);
  var commandEncoder = WebGPU.getJsObject(encoderPtr);
  if (size == -1) size = undefined;
  var buffer = WebGPU.getJsObject(bufferPtr);
  commandEncoder.clearBuffer(buffer, offset, size);
}

function _wgpuCommandEncoderCopyBufferToBuffer(encoderPtr, srcPtr, srcOffset, dstPtr, dstOffset, size) {
  encoderPtr >>>= 0;
  srcPtr >>>= 0;
  srcOffset = bigintToI53Checked(srcOffset);
  dstPtr >>>= 0;
  dstOffset = bigintToI53Checked(dstOffset);
  size = bigintToI53Checked(size);
  var commandEncoder = WebGPU.getJsObject(encoderPtr);
  var src = WebGPU.getJsObject(srcPtr);
  var dst = WebGPU.getJsObject(dstPtr);
  commandEncoder.copyBufferToBuffer(src, srcOffset, dst, dstOffset, size);
}

function _wgpuCommandEncoderCopyBufferToTexture(encoderPtr, srcPtr, dstPtr, copySizePtr) {
  encoderPtr >>>= 0;
  srcPtr >>>= 0;
  dstPtr >>>= 0;
  copySizePtr >>>= 0;
  var commandEncoder = WebGPU.getJsObject(encoderPtr);
  var copySize = WebGPU.makeExtent3D(copySizePtr);
  commandEncoder.copyBufferToTexture(WebGPU.makeTexelCopyBufferInfo(srcPtr), WebGPU.makeTexelCopyTextureInfo(dstPtr), copySize);
}

function _wgpuCommandEncoderCopyTextureToBuffer(encoderPtr, srcPtr, dstPtr, copySizePtr) {
  encoderPtr >>>= 0;
  srcPtr >>>= 0;
  dstPtr >>>= 0;
  copySizePtr >>>= 0;
  var commandEncoder = WebGPU.getJsObject(encoderPtr);
  var copySize = WebGPU.makeExtent3D(copySizePtr);
  commandEncoder.copyTextureToBuffer(WebGPU.makeTexelCopyTextureInfo(srcPtr), WebGPU.makeTexelCopyBufferInfo(dstPtr), copySize);
}

function _wgpuCommandEncoderCopyTextureToTexture(encoderPtr, srcPtr, dstPtr, copySizePtr) {
  encoderPtr >>>= 0;
  srcPtr >>>= 0;
  dstPtr >>>= 0;
  copySizePtr >>>= 0;
  var commandEncoder = WebGPU.getJsObject(encoderPtr);
  var copySize = WebGPU.makeExtent3D(copySizePtr);
  commandEncoder.copyTextureToTexture(WebGPU.makeTexelCopyTextureInfo(srcPtr), WebGPU.makeTexelCopyTextureInfo(dstPtr), copySize);
}

function _wgpuCommandEncoderFinish(encoderPtr, descriptor) {
  encoderPtr >>>= 0;
  descriptor >>>= 0;
  // TODO: Use the descriptor.
  var commandEncoder = WebGPU.getJsObject(encoderPtr);
  var ptr = _emwgpuCreateCommandBuffer(0);
  WebGPU.Internals.jsObjectInsert(ptr, commandEncoder.finish());
  return ptr;
}

function _wgpuCommandEncoderResolveQuerySet(encoderPtr, querySetPtr, firstQuery, queryCount, destinationPtr, destinationOffset) {
  encoderPtr >>>= 0;
  querySetPtr >>>= 0;
  destinationPtr >>>= 0;
  destinationOffset = bigintToI53Checked(destinationOffset);
  var commandEncoder = WebGPU.getJsObject(encoderPtr);
  var querySet = WebGPU.getJsObject(querySetPtr);
  var destination = WebGPU.getJsObject(destinationPtr);
  commandEncoder.resolveQuerySet(querySet, firstQuery, queryCount, destination, destinationOffset);
}

function _wgpuComputePassEncoderDispatchWorkgroups(passPtr, x, y, z) {
  passPtr >>>= 0;
  var pass = WebGPU.getJsObject(passPtr);
  pass.dispatchWorkgroups(x, y, z);
}

function _wgpuComputePassEncoderEnd(passPtr) {
  passPtr >>>= 0;
  var pass = WebGPU.getJsObject(passPtr);
  pass.end();
}

function _wgpuComputePassEncoderSetBindGroup(passPtr, groupIndex, groupPtr, dynamicOffsetCount, dynamicOffsetsPtr) {
  passPtr >>>= 0;
  groupPtr >>>= 0;
  dynamicOffsetCount >>>= 0;
  dynamicOffsetsPtr >>>= 0;
  var pass = WebGPU.getJsObject(passPtr);
  var group = WebGPU.getJsObject(groupPtr);
  if (dynamicOffsetCount == 0) {
    pass.setBindGroup(groupIndex, group);
  } else {
    pass.setBindGroup(groupIndex, group, (growMemViews(), HEAPU32), ((dynamicOffsetsPtr) >>> 2), dynamicOffsetCount);
  }
}

function _wgpuComputePassEncoderSetPipeline(passPtr, pipelinePtr) {
  passPtr >>>= 0;
  pipelinePtr >>>= 0;
  var pass = WebGPU.getJsObject(passPtr);
  var pipeline = WebGPU.getJsObject(pipelinePtr);
  pass.setPipeline(pipeline);
}

var _wgpuDeviceCreateBindGroup = function(devicePtr, descriptor) {
  devicePtr >>>= 0;
  descriptor >>>= 0;
  function makeEntry(entryPtr) {
    var bufferPtr = (growMemViews(), HEAPU32)[(((entryPtr) + (8)) >>> 2) >>> 0];
    var samplerPtr = (growMemViews(), HEAPU32)[(((entryPtr) + (32)) >>> 2) >>> 0];
    var textureViewPtr = (growMemViews(), HEAPU32)[(((entryPtr) + (36)) >>> 2) >>> 0];
    var externalTexturePtr = 0;
    WebGPU.iterateExtensions(entryPtr, {
      14: ptr => {
        externalTexturePtr = (growMemViews(), HEAPU32)[(((ptr) + (8)) >>> 2) >>> 0];
      }
    });
    var resource;
    if (bufferPtr) {
      // Note the sentinel UINT64_MAX will be read as -1.
      var size = readI53FromI64((entryPtr) + (24));
      if (size == -1) size = undefined;
      resource = {
        "buffer": WebGPU.getJsObject(bufferPtr),
        "offset": readI53FromI64((entryPtr) + (16)),
        "size": size
      };
    } else {
      resource = WebGPU.getJsObject(samplerPtr || textureViewPtr || externalTexturePtr);
    }
    return {
      "binding": (growMemViews(), HEAPU32)[(((entryPtr) + (4)) >>> 2) >>> 0],
      "resource": resource
    };
  }
  function makeEntries(count, entriesPtrs) {
    var entries = [];
    for (var i = 0; i < count; ++i) {
      entries.push(makeEntry(entriesPtrs + 40 * i));
    }
    return entries;
  }
  var desc = {
    "label": WebGPU.makeStringFromOptionalStringView(descriptor + 4),
    "layout": WebGPU.getJsObject((growMemViews(), HEAPU32)[(((descriptor) + (12)) >>> 2) >>> 0]),
    "entries": makeEntries((growMemViews(), HEAPU32)[(((descriptor) + (16)) >>> 2) >>> 0], (growMemViews(), 
    HEAPU32)[(((descriptor) + (20)) >>> 2) >>> 0])
  };
  var device = WebGPU.getJsObject(devicePtr);
  var ptr = _emwgpuCreateBindGroup(0);
  WebGPU.Internals.jsObjectInsert(ptr, device.createBindGroup(desc));
  return ptr;
};

function _wgpuDeviceCreateBindGroupLayout(devicePtr, descriptor) {
  devicePtr >>>= 0;
  descriptor >>>= 0;
  function makeBufferEntry(substructPtr) {
    var typeInt = (growMemViews(), HEAPU32)[(((substructPtr) + (4)) >>> 2) >>> 0];
    if (!typeInt) return undefined;
    return {
      "type": WebGPU.BufferBindingType[typeInt],
      "hasDynamicOffset": !!((growMemViews(), HEAPU32)[(((substructPtr) + (8)) >>> 2) >>> 0]),
      "minBindingSize": readI53FromI64((substructPtr) + (16))
    };
  }
  function makeSamplerEntry(substructPtr) {
    var typeInt = (growMemViews(), HEAPU32)[(((substructPtr) + (4)) >>> 2) >>> 0];
    if (!typeInt) return undefined;
    return {
      "type": WebGPU.SamplerBindingType[typeInt]
    };
  }
  function makeTextureEntry(substructPtr) {
    var sampleTypeInt = (growMemViews(), HEAPU32)[(((substructPtr) + (4)) >>> 2) >>> 0];
    if (!sampleTypeInt) return undefined;
    return {
      "sampleType": WebGPU.TextureSampleType[sampleTypeInt],
      "viewDimension": WebGPU.TextureViewDimension[(growMemViews(), HEAP32)[(((substructPtr) + (8)) >>> 2) >>> 0]],
      "multisampled": !!((growMemViews(), HEAPU32)[(((substructPtr) + (12)) >>> 2) >>> 0])
    };
  }
  function makeStorageTextureEntry(substructPtr) {
    var accessInt = (growMemViews(), HEAPU32)[(((substructPtr) + (4)) >>> 2) >>> 0];
    if (!accessInt) return undefined;
    return {
      "access": WebGPU.StorageTextureAccess[accessInt],
      "format": WebGPU.TextureFormat[(growMemViews(), HEAP32)[(((substructPtr) + (8)) >>> 2) >>> 0]],
      "viewDimension": WebGPU.TextureViewDimension[(growMemViews(), HEAP32)[(((substructPtr) + (12)) >>> 2) >>> 0]]
    };
  }
  function makeEntry(entryPtr) {
    var entry = {
      "binding": (growMemViews(), HEAPU32)[(((entryPtr) + (4)) >>> 2) >>> 0],
      "visibility": (growMemViews(), HEAPU32)[(((entryPtr) + (8)) >>> 2) >>> 0],
      "buffer": makeBufferEntry(entryPtr + 24),
      "sampler": makeSamplerEntry(entryPtr + 48),
      "texture": makeTextureEntry(entryPtr + 56),
      "storageTexture": makeStorageTextureEntry(entryPtr + 72)
    };
    WebGPU.iterateExtensions(entryPtr, {
      13: ptr => {
        entry["externalTexture"] = {};
      }
    });
    return entry;
  }
  function makeEntries(count, entriesPtrs) {
    var entries = [];
    for (var i = 0; i < count; ++i) {
      entries.push(makeEntry(entriesPtrs + 88 * i));
    }
    return entries;
  }
  var desc = {
    "label": WebGPU.makeStringFromOptionalStringView(descriptor + 4),
    "entries": makeEntries((growMemViews(), HEAPU32)[(((descriptor) + (12)) >>> 2) >>> 0], (growMemViews(), 
    HEAPU32)[(((descriptor) + (16)) >>> 2) >>> 0])
  };
  var device = WebGPU.getJsObject(devicePtr);
  var ptr = _emwgpuCreateBindGroupLayout(0);
  WebGPU.Internals.jsObjectInsert(ptr, device.createBindGroupLayout(desc));
  return ptr;
}

function _wgpuDeviceCreateCommandEncoder(devicePtr, descriptor) {
  devicePtr >>>= 0;
  descriptor >>>= 0;
  var desc;
  if (descriptor) {
    desc = {
      "label": WebGPU.makeStringFromOptionalStringView(descriptor + 4)
    };
  }
  var device = WebGPU.getJsObject(devicePtr);
  var ptr = _emwgpuCreateCommandEncoder(0);
  WebGPU.Internals.jsObjectInsert(ptr, device.createCommandEncoder(desc));
  return ptr;
}

function _wgpuDeviceCreateComputePipeline(devicePtr, descriptor) {
  devicePtr >>>= 0;
  descriptor >>>= 0;
  var desc = WebGPU.makeComputePipelineDesc(descriptor);
  var device = WebGPU.getJsObject(devicePtr);
  var ptr = _emwgpuCreateComputePipeline(0);
  WebGPU.Internals.jsObjectInsert(ptr, device.createComputePipeline(desc));
  return ptr;
}

function _wgpuDeviceCreatePipelineLayout(devicePtr, descriptor) {
  devicePtr >>>= 0;
  descriptor >>>= 0;
  var bglCount = (growMemViews(), HEAPU32)[(((descriptor) + (12)) >>> 2) >>> 0];
  var bglPtr = (growMemViews(), HEAPU32)[(((descriptor) + (16)) >>> 2) >>> 0];
  var bgls = [];
  for (var i = 0; i < bglCount; ++i) {
    bgls.push(WebGPU.getJsObject((growMemViews(), HEAPU32)[(((bglPtr) + (4 * i)) >>> 2) >>> 0]));
  }
  var desc = {
    "label": WebGPU.makeStringFromOptionalStringView(descriptor + 4),
    "bindGroupLayouts": bgls,
    "immediateSize": (growMemViews(), HEAPU32)[(((descriptor) + (20)) >>> 2) >>> 0]
  };
  var device = WebGPU.getJsObject(devicePtr);
  var ptr = _emwgpuCreatePipelineLayout(0);
  WebGPU.Internals.jsObjectInsert(ptr, device.createPipelineLayout(desc));
  return ptr;
}

function _wgpuDeviceCreateQuerySet(devicePtr, descriptor) {
  devicePtr >>>= 0;
  descriptor >>>= 0;
  var desc = {
    "type": WebGPU.QueryType[(growMemViews(), HEAP32)[(((descriptor) + (12)) >>> 2) >>> 0]],
    "count": (growMemViews(), HEAPU32)[(((descriptor) + (16)) >>> 2) >>> 0]
  };
  var device = WebGPU.getJsObject(devicePtr);
  var ptr = _emwgpuCreateQuerySet(0);
  WebGPU.Internals.jsObjectInsert(ptr, device.createQuerySet(desc));
  return ptr;
}

function _wgpuDeviceCreateRenderPipeline(devicePtr, descriptor) {
  devicePtr >>>= 0;
  descriptor >>>= 0;
  var desc = WebGPU.makeRenderPipelineDesc(descriptor);
  var device = WebGPU.getJsObject(devicePtr);
  var ptr = _emwgpuCreateRenderPipeline(0);
  WebGPU.Internals.jsObjectInsert(ptr, device.createRenderPipeline(desc));
  return ptr;
}

function _wgpuDeviceCreateSampler(devicePtr, descriptor) {
  devicePtr >>>= 0;
  descriptor >>>= 0;
  var desc;
  if (descriptor) {
    desc = {
      "label": WebGPU.makeStringFromOptionalStringView(descriptor + 4),
      "addressModeU": WebGPU.AddressMode[(growMemViews(), HEAP32)[(((descriptor) + (12)) >>> 2) >>> 0]],
      "addressModeV": WebGPU.AddressMode[(growMemViews(), HEAP32)[(((descriptor) + (16)) >>> 2) >>> 0]],
      "addressModeW": WebGPU.AddressMode[(growMemViews(), HEAP32)[(((descriptor) + (20)) >>> 2) >>> 0]],
      "magFilter": WebGPU.FilterMode[(growMemViews(), HEAP32)[(((descriptor) + (24)) >>> 2) >>> 0]],
      "minFilter": WebGPU.FilterMode[(growMemViews(), HEAP32)[(((descriptor) + (28)) >>> 2) >>> 0]],
      "mipmapFilter": WebGPU.MipmapFilterMode[(growMemViews(), HEAP32)[(((descriptor) + (32)) >>> 2) >>> 0]],
      "lodMinClamp": (growMemViews(), HEAPF32)[(((descriptor) + (36)) >>> 2) >>> 0],
      "lodMaxClamp": (growMemViews(), HEAPF32)[(((descriptor) + (40)) >>> 2) >>> 0],
      "compare": WebGPU.CompareFunction[(growMemViews(), HEAP32)[(((descriptor) + (44)) >>> 2) >>> 0]],
      "maxAnisotropy": (growMemViews(), HEAPU16)[(((descriptor) + (48)) >>> 1) >>> 0]
    };
  }
  var device = WebGPU.getJsObject(devicePtr);
  var ptr = _emwgpuCreateSampler(0);
  WebGPU.Internals.jsObjectInsert(ptr, device.createSampler(desc));
  return ptr;
}

function _wgpuDeviceCreateTexture(devicePtr, descriptor) {
  devicePtr >>>= 0;
  descriptor >>>= 0;
  var nextInChainPtr = (growMemViews(), HEAPU32)[((descriptor) >>> 2) >>> 0];
  var textureBindingViewDimension;
  if (nextInChainPtr !== 0) {
    var sType = (growMemViews(), HEAP32)[(((nextInChainPtr) + (4)) >>> 2) >>> 0];
    var textureBindingViewDimensionDescriptor = nextInChainPtr;
    textureBindingViewDimension = WebGPU.TextureViewDimension[(growMemViews(), HEAP32)[(((textureBindingViewDimensionDescriptor) + (8)) >>> 2) >>> 0]];
  }
  var desc = {
    "label": WebGPU.makeStringFromOptionalStringView(descriptor + 4),
    "size": WebGPU.makeExtent3D(descriptor + 28),
    "mipLevelCount": (growMemViews(), HEAPU32)[(((descriptor) + (44)) >>> 2) >>> 0],
    "sampleCount": (growMemViews(), HEAPU32)[(((descriptor) + (48)) >>> 2) >>> 0],
    "dimension": WebGPU.TextureDimension[(growMemViews(), HEAP32)[(((descriptor) + (24)) >>> 2) >>> 0]],
    "format": WebGPU.TextureFormat[(growMemViews(), HEAP32)[(((descriptor) + (40)) >>> 2) >>> 0]],
    "usage": (growMemViews(), HEAPU32)[(((descriptor) + (16)) >>> 2) >>> 0],
    "textureBindingViewDimension": textureBindingViewDimension
  };
  var viewFormatCount = (growMemViews(), HEAPU32)[(((descriptor) + (52)) >>> 2) >>> 0];
  if (viewFormatCount) {
    var viewFormatsPtr = (growMemViews(), HEAPU32)[(((descriptor) + (56)) >>> 2) >>> 0];
    // viewFormatsPtr pointer to an array of TextureFormat which is an enum of size uint32_t
    desc["viewFormats"] = Array.from((growMemViews(), HEAP32).subarray((((viewFormatsPtr) >>> 2)) >>> 0, ((viewFormatsPtr + viewFormatCount * 4) >>> 2) >>> 0), format => WebGPU.TextureFormat[format]);
  }
  var device = WebGPU.getJsObject(devicePtr);
  var ptr = _emwgpuCreateTexture(0);
  WebGPU.Internals.jsObjectInsert(ptr, device.createTexture(desc));
  return ptr;
}

function _wgpuDeviceGetLimits(devicePtr, limitsOutPtr) {
  devicePtr >>>= 0;
  limitsOutPtr >>>= 0;
  var device = WebGPU.getJsObject(devicePtr);
  WebGPU.fillLimitStruct(device.limits, limitsOutPtr);
  return 1;
}

function _wgpuDeviceHasFeature(devicePtr, featureEnumValue) {
  devicePtr >>>= 0;
  var device = WebGPU.getJsObject(devicePtr);
  return device.features.has(WebGPU.FeatureName[featureEnumValue]);
}

function _wgpuQuerySetDestroy(querySetPtr) {
  querySetPtr >>>= 0;
  WebGPU.getJsObject(querySetPtr).destroy();
}

var _wgpuQueueSubmit = function(queuePtr, commandCount, commands) {
  queuePtr >>>= 0;
  commandCount >>>= 0;
  commands >>>= 0;
  var queue = WebGPU.getJsObject(queuePtr);
  var cmds = Array.from((growMemViews(), HEAP32).subarray((((commands) >>> 2)) >>> 0, ((commands + commandCount * 4) >>> 2) >>> 0), id => WebGPU.getJsObject(id));
  queue.submit(cmds);
};

function _wgpuQueueWriteBuffer(queuePtr, bufferPtr, bufferOffset, data, size) {
  queuePtr >>>= 0;
  bufferPtr >>>= 0;
  bufferOffset = bigintToI53Checked(bufferOffset);
  data >>>= 0;
  size >>>= 0;
  var queue = WebGPU.getJsObject(queuePtr);
  var buffer = WebGPU.getJsObject(bufferPtr);
  // There is a size limitation for ArrayBufferView. Work around by passing in a subarray
  // instead of the whole heap. crbug.com/1201109
  var subarray = (growMemViews(), HEAPU8).subarray(data >>> 0, data + size >>> 0);
  queue.writeBuffer(buffer, bufferOffset, subarray, 0, size);
}

function _wgpuQueueWriteTexture(queuePtr, destinationPtr, data, dataSize, dataLayoutPtr, writeSizePtr) {
  queuePtr >>>= 0;
  destinationPtr >>>= 0;
  data >>>= 0;
  dataSize >>>= 0;
  dataLayoutPtr >>>= 0;
  writeSizePtr >>>= 0;
  var queue = WebGPU.getJsObject(queuePtr);
  var destination = WebGPU.makeTexelCopyTextureInfo(destinationPtr);
  var dataLayout = WebGPU.makeTexelCopyBufferLayout(dataLayoutPtr);
  var writeSize = WebGPU.makeExtent3D(writeSizePtr);
  // This subarray isn't strictly necessary, but helps work around an issue
  // where Chromium makes a copy of the entire heap. crbug.com/1134457
  var subarray = (growMemViews(), HEAPU8).subarray(data >>> 0, data + dataSize >>> 0);
  queue.writeTexture(destination, subarray, dataLayout, writeSize);
}

function _wgpuRenderPassEncoderBeginOcclusionQuery(passPtr, queryIndex) {
  passPtr >>>= 0;
  var pass = WebGPU.getJsObject(passPtr);
  pass.beginOcclusionQuery(queryIndex);
}

function _wgpuRenderPassEncoderDraw(passPtr, vertexCount, instanceCount, firstVertex, firstInstance) {
  passPtr >>>= 0;
  firstVertex >>>= 0;
  firstInstance >>>= 0;
  var pass = WebGPU.getJsObject(passPtr);
  pass.draw(vertexCount, instanceCount, firstVertex, firstInstance);
}

function _wgpuRenderPassEncoderDrawIndexed(passPtr, indexCount, instanceCount, firstIndex, baseVertex, firstInstance) {
  passPtr >>>= 0;
  firstIndex >>>= 0;
  firstInstance >>>= 0;
  var pass = WebGPU.getJsObject(passPtr);
  pass.drawIndexed(indexCount, instanceCount, firstIndex, baseVertex, firstInstance);
}

function _wgpuRenderPassEncoderEnd(encoderPtr) {
  encoderPtr >>>= 0;
  var encoder = WebGPU.getJsObject(encoderPtr);
  encoder.end();
}

function _wgpuRenderPassEncoderEndOcclusionQuery(passPtr) {
  passPtr >>>= 0;
  var pass = WebGPU.getJsObject(passPtr);
  pass.endOcclusionQuery();
}

function _wgpuRenderPassEncoderSetBindGroup(passPtr, groupIndex, groupPtr, dynamicOffsetCount, dynamicOffsetsPtr) {
  passPtr >>>= 0;
  groupPtr >>>= 0;
  dynamicOffsetCount >>>= 0;
  dynamicOffsetsPtr >>>= 0;
  var pass = WebGPU.getJsObject(passPtr);
  var group = WebGPU.getJsObject(groupPtr);
  if (dynamicOffsetCount == 0) {
    pass.setBindGroup(groupIndex, group);
  } else {
    pass.setBindGroup(groupIndex, group, (growMemViews(), HEAPU32), ((dynamicOffsetsPtr) >>> 2), dynamicOffsetCount);
  }
}

function _wgpuRenderPassEncoderSetBlendConstant(passPtr, colorPtr) {
  passPtr >>>= 0;
  colorPtr >>>= 0;
  var pass = WebGPU.getJsObject(passPtr);
  var color = WebGPU.makeColor(colorPtr);
  pass.setBlendConstant(color);
}

function _wgpuRenderPassEncoderSetIndexBuffer(passPtr, bufferPtr, format, offset, size) {
  passPtr >>>= 0;
  bufferPtr >>>= 0;
  offset = bigintToI53Checked(offset);
  size = bigintToI53Checked(size);
  var pass = WebGPU.getJsObject(passPtr);
  var buffer = WebGPU.getJsObject(bufferPtr);
  if (size == -1) size = undefined;
  pass.setIndexBuffer(buffer, WebGPU.IndexFormat[format], offset, size);
}

function _wgpuRenderPassEncoderSetPipeline(passPtr, pipelinePtr) {
  passPtr >>>= 0;
  pipelinePtr >>>= 0;
  var pass = WebGPU.getJsObject(passPtr);
  var pipeline = WebGPU.getJsObject(pipelinePtr);
  pass.setPipeline(pipeline);
}

function _wgpuRenderPassEncoderSetScissorRect(passPtr, x, y, w, h) {
  passPtr >>>= 0;
  var pass = WebGPU.getJsObject(passPtr);
  pass.setScissorRect(x, y, w, h);
}

function _wgpuRenderPassEncoderSetStencilReference(passPtr, reference) {
  passPtr >>>= 0;
  reference >>>= 0;
  var pass = WebGPU.getJsObject(passPtr);
  pass.setStencilReference(reference);
}

function _wgpuRenderPassEncoderSetVertexBuffer(passPtr, slot, bufferPtr, offset, size) {
  passPtr >>>= 0;
  bufferPtr >>>= 0;
  offset = bigintToI53Checked(offset);
  size = bigintToI53Checked(size);
  var pass = WebGPU.getJsObject(passPtr);
  var buffer = WebGPU.getJsObject(bufferPtr);
  if (size == -1) size = undefined;
  pass.setVertexBuffer(slot, buffer, offset, size);
}

function _wgpuRenderPassEncoderSetViewport(passPtr, x, y, w, h, minDepth, maxDepth) {
  passPtr >>>= 0;
  var pass = WebGPU.getJsObject(passPtr);
  pass.setViewport(x, y, w, h, minDepth, maxDepth);
}

function _wgpuRenderPipelineGetBindGroupLayout(pipelinePtr, groupIndex) {
  pipelinePtr >>>= 0;
  var pipeline = WebGPU.getJsObject(pipelinePtr);
  var ptr = _emwgpuCreateBindGroupLayout(0);
  WebGPU.Internals.jsObjectInsert(ptr, pipeline.getBindGroupLayout(groupIndex));
  return ptr;
}

function _wgpuSurfaceConfigure(surfacePtr, config) {
  surfacePtr >>>= 0;
  config >>>= 0;
  var context = WebGPU.getJsObject(surfacePtr);
  var canvasSize = [ (growMemViews(), HEAPU32)[(((config) + (24)) >>> 2) >>> 0], (growMemViews(), 
  HEAPU32)[(((config) + (28)) >>> 2) >>> 0] ];
  if (canvasSize[0] !== 0) {
    context["canvas"]["width"] = canvasSize[0];
  }
  if (canvasSize[1] !== 0) {
    context["canvas"]["height"] = canvasSize[1];
  }
  var configuration = {
    "device": WebGPU.getJsObject((growMemViews(), HEAPU32)[(((config) + (4)) >>> 2) >>> 0]),
    "format": WebGPU.TextureFormat[(growMemViews(), HEAP32)[(((config) + (8)) >>> 2) >>> 0]],
    "usage": (growMemViews(), HEAPU32)[(((config) + (16)) >>> 2) >>> 0],
    "alphaMode": WebGPU.CompositeAlphaMode[(growMemViews(), HEAP32)[(((config) + (40)) >>> 2) >>> 0]]
  };
  var viewFormatCount = (growMemViews(), HEAPU32)[(((config) + (32)) >>> 2) >>> 0];
  if (viewFormatCount) {
    var viewFormatsPtr = (growMemViews(), HEAPU32)[(((config) + (36)) >>> 2) >>> 0];
    // viewFormatsPtr pointer to an array of TextureFormat which is an enum of size uint32_t
    configuration["viewFormats"] = Array.from((growMemViews(), HEAP32).subarray((((viewFormatsPtr) >>> 2)) >>> 0, ((viewFormatsPtr + viewFormatCount * 4) >>> 2) >>> 0), format => WebGPU.TextureFormat[format]);
  }
  {
    var nextInChainPtr = (growMemViews(), HEAPU32)[((config) >>> 2) >>> 0];
    if (nextInChainPtr !== 0) {
      var sType = (growMemViews(), HEAP32)[(((nextInChainPtr) + (4)) >>> 2) >>> 0];
      var surfaceColorManagement = nextInChainPtr;
      configuration.colorSpace = WebGPU.PredefinedColorSpace[(growMemViews(), HEAP32)[(((surfaceColorManagement) + (8)) >>> 2) >>> 0]];
      configuration.toneMapping = {
        mode: WebGPU.ToneMappingMode[(growMemViews(), HEAP32)[(((surfaceColorManagement) + (12)) >>> 2) >>> 0]]
      };
    }
  }
  context.configure(configuration);
}

function _wgpuSurfaceGetCurrentTexture(surfacePtr, surfaceTexturePtr) {
  surfacePtr >>>= 0;
  surfaceTexturePtr >>>= 0;
  var context = WebGPU.getJsObject(surfacePtr);
  try {
    var texturePtr = _emwgpuCreateTexture(0);
    WebGPU.Internals.jsObjectInsert(texturePtr, context.getCurrentTexture());
    (growMemViews(), HEAPU32)[(((surfaceTexturePtr) + (4)) >>> 2) >>> 0] = texturePtr;
    (growMemViews(), HEAP32)[(((surfaceTexturePtr) + (8)) >>> 2) >>> 0] = 1;
  } catch (ex) {
    (growMemViews(), HEAPU32)[(((surfaceTexturePtr) + (4)) >>> 2) >>> 0] = 0;
    (growMemViews(), HEAP32)[(((surfaceTexturePtr) + (8)) >>> 2) >>> 0] = 6;
  }
}

function _wgpuSurfaceUnconfigure(surfacePtr) {
  surfacePtr >>>= 0;
  var context = WebGPU.getJsObject(surfacePtr);
  context.unconfigure();
}

function _wgpuTextureCreateView(texturePtr, descriptor) {
  texturePtr >>>= 0;
  descriptor >>>= 0;
  var desc;
  if (descriptor) {
    var swizzle;
    var nextInChainPtr = (growMemViews(), HEAPU32)[((descriptor) >>> 2) >>> 0];
    if (nextInChainPtr !== 0) {
      var sType = (growMemViews(), HEAP32)[(((nextInChainPtr) + (4)) >>> 2) >>> 0];
      var swizzleDescriptor = nextInChainPtr;
      var swizzlePtr = swizzleDescriptor + 8;
      var r = WebGPU.ComponentSwizzle[(growMemViews(), HEAP32)[((swizzlePtr) >>> 2) >>> 0]] || "r";
      var g = WebGPU.ComponentSwizzle[(growMemViews(), HEAP32)[(((swizzlePtr) + (4)) >>> 2) >>> 0]] || "g";
      var b = WebGPU.ComponentSwizzle[(growMemViews(), HEAP32)[(((swizzlePtr) + (8)) >>> 2) >>> 0]] || "b";
      var a = WebGPU.ComponentSwizzle[(growMemViews(), HEAP32)[(((swizzlePtr) + (12)) >>> 2) >>> 0]] || "a";
      swizzle = `${r}${g}${b}${a}`;
    }
    var mipLevelCount = (growMemViews(), HEAPU32)[(((descriptor) + (24)) >>> 2) >>> 0];
    var arrayLayerCount = (growMemViews(), HEAPU32)[(((descriptor) + (32)) >>> 2) >>> 0];
    desc = {
      "label": WebGPU.makeStringFromOptionalStringView(descriptor + 4),
      "format": WebGPU.TextureFormat[(growMemViews(), HEAP32)[(((descriptor) + (12)) >>> 2) >>> 0]],
      "dimension": WebGPU.TextureViewDimension[(growMemViews(), HEAP32)[(((descriptor) + (16)) >>> 2) >>> 0]],
      "baseMipLevel": (growMemViews(), HEAPU32)[(((descriptor) + (20)) >>> 2) >>> 0],
      "mipLevelCount": mipLevelCount === 4294967295 ? undefined : mipLevelCount,
      "baseArrayLayer": (growMemViews(), HEAPU32)[(((descriptor) + (28)) >>> 2) >>> 0],
      "arrayLayerCount": arrayLayerCount === 4294967295 ? undefined : arrayLayerCount,
      "aspect": WebGPU.TextureAspect[(growMemViews(), HEAP32)[(((descriptor) + (36)) >>> 2) >>> 0]],
      "usage": (growMemViews(), HEAPU32)[(((descriptor) + (40)) >>> 2) >>> 0],
      "swizzle": swizzle
    };
  }
  var texture = WebGPU.getJsObject(texturePtr);
  var ptr = _emwgpuCreateTextureView(0);
  WebGPU.Internals.jsObjectInsert(ptr, texture.createView(desc));
  return ptr;
}

function _wgpuTextureDestroy(texturePtr) {
  texturePtr >>>= 0;
  WebGPU.getJsObject(texturePtr).destroy();
}

function _wgpuTextureGetDepthOrArrayLayers(texturePtr) {
  texturePtr >>>= 0;
  var texture = WebGPU.getJsObject(texturePtr);
  return texture.depthOrArrayLayers;
}

function _wgpuTextureGetDimension(texturePtr) {
  texturePtr >>>= 0;
  var texture = WebGPU.getJsObject(texturePtr);
  return WebGPU.TextureDimension.indexOf(texture.dimension);
}

function _wgpuTextureGetHeight(texturePtr) {
  texturePtr >>>= 0;
  var texture = WebGPU.getJsObject(texturePtr);
  return texture.height;
}

function _wgpuTextureGetWidth(texturePtr) {
  texturePtr >>>= 0;
  var texture = WebGPU.getJsObject(texturePtr);
  return texture.width;
}

function _wink_js_acquire_device() {
  var given = Module["winkDevice"] || Module["preinitializedWebGPUDevice"];
  if (given) return WINK.adopt(given);
  var gpu = typeof navigator != "undefined" ? navigator["gpu"] : undefined;
  if (!gpu) {
    err("wink: navigator.gpu is unavailable");
    return 0;
  }
  return WINK.suspend((async function() {
    try {
      var adapter = await gpu["requestAdapter"](Module["winkAdapterOptions"] || {
        "powerPreference": "high-performance"
      });
      if (!adapter) {
        err("wink: no WebGPU adapter");
        return 0;
      }
      var desc = WINK.descriptor(adapter);
      if (Module["winkDeviceDescriptor"]) desc = Module["winkDeviceDescriptor"](adapter, desc) || desc;
      return WINK.adopt(await adapter["requestDevice"](desc));
    } catch (e) {
      err("wink: requesting a WebGPU device failed: " + e);
      return 0;
    }
  })());
}

function _wink_js_create_surface(selectorPtr) {
  var selector = selectorPtr ? UTF8ToString(selectorPtr) : "";
  var provided = Module["winkCanvas"];
  var canvas = null;
  if (typeof provided == "function") canvas = provided(selector); else if (provided && !selector) canvas = provided;
  var owned = typeof GL != "undefined" && GL.offscreenCanvases || {};
  if (!canvas && selector) {
    var id = selector.charAt(0) == "#" ? selector.substr(1) : selector;
    if (owned[id]) canvas = owned[id].offscreenCanvas;
  }
  if (!canvas && (!selector || selector == "#canvas")) canvas = Module["canvas"];
  if (!canvas && selector && typeof document != "undefined") canvas = document.querySelector(selector);
  if (!canvas && typeof document == "undefined") {
    var ids = Object.keys(owned).filter(function(k) {
      return owned[k];
    });
    if (ids.length == 1) canvas = owned[ids[0]].offscreenCanvas;
  }
  if (!canvas) {
    err("wink: no canvas" + (selector ? " for " + selector : ""));
    return 0;
  }
  var context = canvas.getContext("webgpu");
  if (!context) {
    // Most often the canvas already has a WebGL or 2D context.
    err("wink: the canvas will not give a webgpu context");
    return 0;
  }
  var ptr = _emwgpuCreateSurface(0);
  WebGPU.Internals.jsObjectInsert(ptr, context);
  return ptr;
}

function _wink_js_get_env(buf, len) {
  var env = Module["winkEnv"];
  if (!env) return 0;
  var text = "";
  if (Array.isArray(env)) {
    for (var i = 0; i < env.length; ++i) text += env[i] + "\n";
  } else {
    for (var name in env) text += name + "=" + env[name] + "\n";
  }
  var need = lengthBytesUTF8(text) + 1;
  if (buf && len >= need) stringToUTF8(text, buf, len);
  return need;
}

function _wink_js_has_jspi() {
  return (typeof WebAssembly.Suspending == "function" && typeof WebAssembly.promising == "function") ? 1 : 0;
}

function _wink_js_kick(queue) {
  if (ENVIRONMENT_IS_PTHREAD) return proxyToMainThread(74, 0, 0, queue);
  queue >>>= 0;
  if (!WINK.pending) WINK.pending = new Set;
  WINK.pending.add(queue);
  WINK.schedule();
}

function _wink_js_yield_frame(frames) {
  return WINK.suspend(new Promise(function(resolve) {
    var left = frames;
    var settled = false;
    var done = function() {
      if (!settled) {
        settled = true;
        resolve();
      }
    };
    var tick = function() {
      if (--left <= 0) done(); else requestAnimationFrame(tick);
    };
    if (left > 0 && typeof requestAnimationFrame == "function") requestAnimationFrame(tick); else if (typeof scheduler != "undefined" && scheduler["yield"]) scheduler["yield"]().then(done, done); else setTimeout(done, 0);
    setTimeout(done, 1e3);
  }));
}

var writeArrayToMemory = (array, buffer) => {
  (growMemViews(), HEAP8).set(array, buffer >>> 0);
};

var autoResumeAudioContext = ctx => {
  for (var event of [ "keydown", "mousedown", "touchstart" ]) {
    for (var element of [ document, document.getElementById("canvas") ]) {
      element?.addEventListener(event, () => {
        if (ctx.state === "suspended") ctx.resume();
      }, {
        "once": true
      });
    }
  }
};

var dynCall = (sig, ptr, args = [], promising = false) => {
  var func = getWasmTableEntry(ptr);
  var rtn = func(...args);
  function convert(rtn) {
    return sig[0] == "p" ? rtn >>> 0 : rtn;
  }
  return convert(rtn);
};

var MEMFS = {
  createBackend(opts) {
    return _wasmfs_create_memory_backend();
  }
};

var PATH = {
  isAbs: path => path.charAt(0) === "/",
  splitPath: filename => {
    var splitPathRe = /^(\/?|)([\s\S]*?)((?:\.{1,2}|[^\/]+?|)(\.[^.\/]*|))(?:[\/]*)$/;
    return splitPathRe.exec(filename).slice(1);
  },
  normalizeArray: (parts, allowAboveRoot) => {
    // if the path tries to go above the root, `up` ends up > 0
    var up = 0;
    for (var i = parts.length - 1; i >= 0; i--) {
      var last = parts[i];
      if (last === ".") {
        parts.splice(i, 1);
      } else if (last === "..") {
        parts.splice(i, 1);
        up++;
      } else if (up) {
        parts.splice(i, 1);
        up--;
      }
    }
    // if the path is allowed to go above the root, restore leading ..s
    if (allowAboveRoot) {
      for (;up; up--) {
        parts.unshift("..");
      }
    }
    return parts;
  },
  normalize: path => {
    var isAbsolute = PATH.isAbs(path), trailingSlash = path.slice(-1) === "/";
    // Normalize the path
    path = PATH.normalizeArray(path.split("/").filter(p => !!p), !isAbsolute).join("/");
    if (!path && !isAbsolute) {
      path = ".";
    }
    if (path && trailingSlash) {
      path += "/";
    }
    return (isAbsolute ? "/" : "") + path;
  },
  dirname: path => {
    var result = PATH.splitPath(path), root = result[0], dir = result[1];
    if (!root && !dir) {
      // No dirname whatsoever
      return ".";
    }
    if (dir) {
      // It has a dirname, strip trailing slash
      dir = dir.slice(0, -1);
    }
    return root + dir;
  },
  basename: path => path && path.match(/([^\/]+|\/)\/*$/)[1],
  join: (...paths) => PATH.normalize(paths.join("/")),
  join2: (l, r) => PATH.normalize(l + "/" + r)
};

var withStackSave = f => {
  var stack = stackSave();
  var ret = f();
  stackRestore(stack);
  return ret;
};

var readI53FromU64 = ptr => (growMemViews(), HEAPU32)[((ptr) >>> 2) >>> 0] + (growMemViews(), 
HEAPU32)[(((ptr) + (4)) >>> 2) >>> 0] * 4294967296;

var FS_mknod = (path, mode, dev) => FS.handleError(withStackSave(() => {
  var pathBuffer = stringToUTF8OnStack(path);
  return __wasmfs_mknod(pathBuffer, mode, dev);
}));

var FS_create = (path, mode = 438) => {
  mode &= 4095;
  mode |= 32768;
  return FS_mknod(path, mode, 0);
};

var FS_fileDataToTypedArray = data => {
  if (typeof data == "string") {
    data = intArrayFromString(data, true);
  }
  if (!data.subarray) {
    data = new Uint8Array(data);
  }
  return data;
};

var FS_writeFile = (path, data) => {
  var sp = stackSave();
  var pathBuffer = stringToUTF8OnStack(path);
  data = FS_fileDataToTypedArray(data);
  var len = data.length;
  var dataBuffer = _malloc(len);
  (growMemViews(), HEAPU8).set(data, dataBuffer >>> 0);
  var ret = __wasmfs_write_file(pathBuffer, dataBuffer, len);
  _free(dataBuffer);
  stackRestore(sp);
  return ret;
};

var FS_createDataFile = (parent, name, fileData, canRead, canWrite, canOwn) => {
  var pathName = name ? parent + "/" + name : parent;
  var mode = FS_getMode(canRead, canWrite);
  if (!wasmFSPreloadingFlushed) {
    // WasmFS code in the wasm is not ready to be called yet. Cache the
    // files we want to create here in JS, and WasmFS will read them
    // later.
    wasmFSPreloadedFiles.push({
      pathName,
      fileData,
      mode
    });
  } else {
    // WasmFS is already running, so create the file normally.
    FS_create(pathName, mode);
    FS_writeFile(pathName, fileData);
  }
};

var asyncLoad = async url => {
  var arrayBuffer = await readAsync(url);
  return new Uint8Array(arrayBuffer);
};

var PATH_FS = {
  resolve: (...args) => {
    var resolvedPath = "", resolvedAbsolute = false;
    for (var i = args.length - 1; i >= -1 && !resolvedAbsolute; i--) {
      var path = (i >= 0) ? args[i] : FS.cwd();
      // Skip empty and invalid entries
      if (typeof path != "string") {
        throw new TypeError("Arguments to path.resolve must be strings");
      } else if (!path) {
        return "";
      }
      resolvedPath = path + "/" + resolvedPath;
      resolvedAbsolute = PATH.isAbs(path);
    }
    // At this point the path should be resolved to a full absolute path, but
    // handle relative paths to be safe (might happen when process.cwd() fails)
    resolvedPath = PATH.normalizeArray(resolvedPath.split("/").filter(p => !!p), !resolvedAbsolute).join("/");
    return ((resolvedAbsolute ? "/" : "") + resolvedPath) || ".";
  },
  relative: (from, to) => {
    from = PATH_FS.resolve(from).slice(1);
    to = PATH_FS.resolve(to).slice(1);
    function trim(arr) {
      var start = 0;
      for (;start < arr.length; start++) {
        if (arr[start] !== "") break;
      }
      var end = arr.length - 1;
      for (;end >= 0; end--) {
        if (arr[end] !== "") break;
      }
      if (start > end) return [];
      return arr.slice(start, end - start + 1);
    }
    var fromParts = trim(from.split("/"));
    var toParts = trim(to.split("/"));
    var length = Math.min(fromParts.length, toParts.length);
    var samePartsLength = length;
    for (var i = 0; i < length; i++) {
      if (fromParts[i] !== toParts[i]) {
        samePartsLength = i;
        break;
      }
    }
    var outputParts = [];
    for (var i = samePartsLength; i < fromParts.length; i++) {
      outputParts.push("..");
    }
    outputParts = outputParts.concat(toParts.slice(samePartsLength));
    return outputParts.join("/");
  }
};

var getUniqueRunDependency = id => id;

var dependenciesPromise = null;

var resolveRunDependencies = async () => dependenciesPromise;

var runDependencies = 0;

var dependenciesPromiseResolve = null;

var removeRunDependency = id => {
  runDependencies--;
  Module["monitorRunDependencies"]?.(runDependencies);
  if (!runDependencies) {
    dependenciesPromiseResolve();
  }
};

var addRunDependency = id => {
  if (!runDependencies) {
    dependenciesPromise = new Promise(resolve => dependenciesPromiseResolve = resolve);
  }
  runDependencies++;
  Module["monitorRunDependencies"]?.(runDependencies);
};

var FS_handledByPreloadPlugin = async (byteArray, fullname) => {
  // Ensure plugins are ready.
  if (typeof Browser != "undefined") Browser.init();
  for (var plugin of preloadPlugins) {
    if (plugin["canHandle"](fullname)) {
      return plugin["handle"](byteArray, fullname);
    }
  }
  // If no plugin handled this file then return the original/unmodified
  // byteArray.
  return byteArray;
};

var FS_preloadFile = async (parent, name, url, canRead, canWrite, dontCreateFile, canOwn, preFinish) => {
  // TODO we should allow people to just pass in a complete filename instead
  // of parent and name being that we just join them anyways
  var fullname = name ? PATH_FS.resolve(PATH.join2(parent, name)) : parent;
  var dep = getUniqueRunDependency(`cp ${fullname}`);
  // might have several active requests for the same fullname
  addRunDependency(dep);
  try {
    var byteArray = url;
    if (typeof url == "string") {
      byteArray = await asyncLoad(url);
    }
    byteArray = await FS_handledByPreloadPlugin(byteArray, fullname);
    preFinish?.();
    if (!dontCreateFile) {
      FS_createDataFile(parent, name, byteArray, canRead, canWrite, canOwn);
    }
  } finally {
    removeRunDependency(dep);
  }
};

var FS_createPreloadedFile = (parent, name, url, canRead, canWrite, onload, onerror, dontCreateFile, canOwn, preFinish) => {
  FS_preloadFile(parent, name, url, canRead, canWrite, dontCreateFile, canOwn, preFinish).then(onload).catch(onerror);
};

var FS_getMode = (canRead, canWrite) => {
  var mode = 0;
  if (canRead) mode |= 292 | 73;
  if (canWrite) mode |= 146;
  return mode;
};

var FS_modeStringToFlags = str => {
  if (typeof str != "string") return str;
  var flagModes = {
    "r": 0,
    "r+": 2,
    "w": 512 | 64 | 1,
    "w+": 512 | 64 | 2,
    "a": 1024 | 64 | 1,
    "a+": 1024 | 64 | 2
  };
  var flags = flagModes[str];
  if (typeof flags == "undefined") {
    throw new Error(`Unknown file open mode: ${str}`);
  }
  return flags;
};

var FS_mkdir = (path, mode = 511) => FS.handleError(withStackSave(() => {
  var buffer = stringToUTF8OnStack(path);
  return __wasmfs_mkdir(buffer, mode);
}));

/**
   * @param {number=} mode Optionally, the mode to create in. Uses mkdir's
   *                       default if not set.
   */ var FS_mkdirTree = (path, mode) => {
  var dirs = path.split("/");
  var d = "";
  for (var dir of dirs) {
    if (!dir) continue;
    if (d || PATH.isAbs(path)) d += "/";
    d += dir;
    try {
      FS_mkdir(d, mode);
    } catch (e) {
      if (e.errno != 20) throw e;
    }
  }
};

var FS_unlink = path => withStackSave(() => {
  var buffer = stringToUTF8OnStack(path);
  return __wasmfs_unlink(buffer);
});

var wasmFSDevices = {};

var wasmFSDeviceStreams = {};

var FS = {
  ErrnoError: class extends Error {
    name="ErrnoError";
    message="FS error";
    constructor(code) {
      super();
      this.errno = code;
    }
  },
  handleError(returnValue) {
    // Assume errors correspond to negative returnValues
    // since some functions like _wasmfs_open() return positive
    // numbers on success (some callers of this function may need to negate the parameter).
    if (returnValue < 0) {
      throw new FS.ErrnoError(-returnValue);
    }
    return returnValue;
  },
  createDataFile(parent, name, fileData, canRead, canWrite, canOwn) {
    FS_createDataFile(parent, name, fileData, canRead, canWrite, canOwn);
  },
  createPath(parent, path, canRead, canWrite) {
    // Cache file path directory names.
    var parts = path.split("/").reverse();
    while (parts.length) {
      var part = parts.pop();
      if (!part) continue;
      var current = PATH.join2(parent, part);
      if (!wasmFSPreloadingFlushed) {
        wasmFSPreloadedDirs.push({
          parentPath: parent,
          childName: part
        });
      } else {
        try {
          FS.mkdir(current);
        } catch (e) {
          if (e.errno != 20) throw e;
        }
      }
      parent = current;
    }
    return current;
  },
  createPreloadedFile(parent, name, url, canRead, canWrite, onload, onerror, dontCreateFile, canOwn, preFinish) {
    return FS_createPreloadedFile(parent, name, url, canRead, canWrite, onload, onerror, dontCreateFile, canOwn, preFinish);
  },
  async preloadFile(parent, name, url, canRead, canWrite, dontCreateFile, canOwn, preFinish) {
    return FS_preloadFile(parent, name, url, canRead, canWrite, dontCreateFile, canOwn, preFinish);
  },
  readFile(path, opts = {}) {
    opts.encoding = opts.encoding || "binary";
    if (opts.encoding !== "utf8" && opts.encoding !== "binary") {
      throw new Error(`Invalid encoding type "${opts.encoding}"`);
    }
    var buf, length;
    // Copy the file into a JS buffer on the heap.
    withStackSave(() => {
      var bufPtr = stackAlloc(4);
      var sizePtr = stackAlloc(4);
      FS.handleError(-__wasmfs_read_file(stringToUTF8OnStack(path), bufPtr, sizePtr));
      buf = (growMemViews(), HEAPU32)[((bufPtr) >>> 2) >>> 0];
      length = readI53FromI64(sizePtr);
    });
    // Default return type is binary.
    // The buffer contents exist 8 bytes after the returned pointer.
    return opts.encoding === "utf8" ? UTF8ToString(buf, length) : (growMemViews(), HEAPU8).slice(buf, buf + length);
  },
  cwd: () => UTF8ToString(__wasmfs_get_cwd()),
  analyzePath(path) {
    // TODO: Consider simplifying this API, which for now matches the JS FS.
    var exists = !!FS.findObject(path);
    return {
      exists,
      object: {
        contents: exists ? FS.readFile(path) : null
      }
    };
  },
  mkdir: (path, mode) => FS_mkdir(path, mode),
  mkdirTree: (path, mode) => FS_mkdirTree(path, mode),
  rmdir: path => FS.handleError(withStackSave(() => __wasmfs_rmdir(stringToUTF8OnStack(path)))),
  open: (path, flags, mode = 438) => withStackSave(() => {
    flags = FS_modeStringToFlags(flags);
    var buffer = stringToUTF8OnStack(path);
    var fd = FS.handleError(__wasmfs_open(buffer, flags, mode));
    return {
      fd
    };
  }),
  create: (path, mode) => FS_create(path, mode),
  close: stream => FS.handleError(-__wasmfs_close(stream.fd)),
  unlink: path => FS_unlink(path),
  chdir: path => withStackSave(() => __wasmfs_chdir(stringToUTF8OnStack(path))),
  read(stream, buffer, offset, length, position) {
    var seeking = typeof position != "undefined";
    var dataBuffer = _malloc(length);
    var bytesRead;
    if (seeking) {
      bytesRead = __wasmfs_pread(stream.fd, dataBuffer, length, BigInt(position));
    } else {
      bytesRead = __wasmfs_read(stream.fd, dataBuffer, length);
    }
    if (bytesRead > 0) {
      buffer.set((growMemViews(), HEAPU8).subarray(dataBuffer >>> 0, dataBuffer + bytesRead >>> 0), offset);
    }
    _free(dataBuffer);
    return FS.handleError(bytesRead);
  },
  write(stream, buffer, offset, length, position, canOwn) {
    var seeking = typeof position != "undefined";
    var dataBuffer = _malloc(length);
    for (var i = 0; i < length; i++) {
      (growMemViews(), HEAP8)[(dataBuffer) + (i) >>> 0] = buffer[offset + i];
    }
    var bytesRead;
    if (seeking) {
      bytesRead = __wasmfs_pwrite(stream.fd, dataBuffer, length, BigInt(position));
    } else {
      bytesRead = __wasmfs_write(stream.fd, dataBuffer, length);
    }
    _free(dataBuffer);
    return FS.handleError(bytesRead);
  },
  writeFile: (path, data) => FS_writeFile(path, data),
  mmap: (stream, length, offset, prot, flags) => {
    var buf = FS.handleError(__wasmfs_mmap(length, prot, flags, stream.fd, BigInt(offset)));
    return {
      ptr: buf,
      allocated: true
    };
  },
  msync: (stream, bufferPtr, offset, length, mmapFlags) => FS.handleError(__wasmfs_msync(bufferPtr, length, mmapFlags)),
  munmap: (addr, length) => (FS.handleError(__wasmfs_munmap(addr, length))),
  symlink: (target, linkpath) => withStackSave(() => (__wasmfs_symlink(stringToUTF8OnStack(target), stringToUTF8OnStack(linkpath)))),
  readlink(path) {
    return withStackSave(() => {
      var bufPtr = stackAlloc(4);
      FS.handleError(__wasmfs_readlink(stringToUTF8OnStack(path), bufPtr));
      var readBuffer = (growMemViews(), HEAPU32)[((bufPtr) >>> 2) >>> 0];
      return UTF8ToString(readBuffer);
    });
  },
  statBufToObject(statBuf) {
    // i53/u53 are enough for times and ino in practice.
    return {
      dev: (growMemViews(), HEAPU32)[((statBuf) >>> 2) >>> 0],
      mode: (growMemViews(), HEAPU32)[(((statBuf) + (4)) >>> 2) >>> 0],
      nlink: (growMemViews(), HEAPU32)[(((statBuf) + (8)) >>> 2) >>> 0],
      uid: (growMemViews(), HEAPU32)[(((statBuf) + (12)) >>> 2) >>> 0],
      gid: (growMemViews(), HEAPU32)[(((statBuf) + (16)) >>> 2) >>> 0],
      rdev: (growMemViews(), HEAPU32)[(((statBuf) + (20)) >>> 2) >>> 0],
      size: readI53FromI64((statBuf) + (24)),
      blksize: (growMemViews(), HEAP32)[(((statBuf) + (32)) >>> 2) >>> 0],
      blocks: (growMemViews(), HEAP32)[(((statBuf) + (36)) >>> 2) >>> 0],
      atime: readI53FromI64((statBuf) + (40)),
      mtime: readI53FromI64((statBuf) + (56)),
      ctime: readI53FromI64((statBuf) + (72)),
      ino: readI53FromU64((statBuf) + (88))
    };
  },
  stat(path) {
    return withStackSave(() => {
      var statBuf = stackAlloc(96);
      FS.handleError(__wasmfs_stat(stringToUTF8OnStack(path), statBuf));
      return FS.statBufToObject(statBuf);
    });
  },
  lstat(path) {
    return withStackSave(() => {
      var statBuf = stackAlloc(96);
      FS.handleError(__wasmfs_lstat(stringToUTF8OnStack(path), statBuf));
      return FS.statBufToObject(statBuf);
    });
  },
  chmod(path, mode) {
    return FS.handleError(withStackSave(() => {
      var buffer = stringToUTF8OnStack(path);
      return __wasmfs_chmod(buffer, mode);
    }));
  },
  lchmod(path, mode) {
    return FS.handleError(withStackSave(() => {
      var buffer = stringToUTF8OnStack(path);
      return __wasmfs_lchmod(buffer, mode);
    }));
  },
  fchmod(fd, mode) {
    return FS.handleError(__wasmfs_fchmod(fd, mode));
  },
  utime: (path, atime, mtime) => (FS.handleError(withStackSave(() => (__wasmfs_utime(stringToUTF8OnStack(path), atime, mtime))))),
  truncate(path, len) {
    return FS.handleError(withStackSave(() => (__wasmfs_truncate(stringToUTF8OnStack(path), BigInt(len)))));
  },
  ftruncate(fd, len) {
    return FS.handleError(__wasmfs_ftruncate(fd, BigInt(len)));
  },
  findObject(path) {
    var result = withStackSave(() => __wasmfs_identify(stringToUTF8OnStack(path)));
    if (result == 44) {
      return null;
    }
    return {
      isFolder: result == 31,
      isDevice: false
    };
  },
  readdir: path => withStackSave(() => {
    var pathBuffer = stringToUTF8OnStack(path);
    var entries = [];
    var state = __wasmfs_readdir_start(pathBuffer);
    if (!state) {
      // TODO: The old FS threw an ErrnoError here.
      throw new Error("No such directory");
    }
    var entry;
    while (entry = __wasmfs_readdir_get(state)) {
      entries.push(UTF8ToString(entry));
    }
    __wasmfs_readdir_finish(state);
    return entries;
  }),
  mount: (type, opts, mountpoint) => {
    var backendPointer = type.createBackend(opts);
    return FS.handleError(withStackSave(() => __wasmfs_mount(stringToUTF8OnStack(mountpoint), backendPointer)));
  },
  unmount: mountpoint => (FS.handleError(withStackSave(() => _wasmfs_unmount(stringToUTF8OnStack(mountpoint))))),
  mknod: (path, mode, dev) => FS_mknod(path, mode, dev),
  makedev: (ma, mi) => ((ma) << 8 | (mi)),
  registerDevice(dev, ops) {
    var backendPointer = _wasmfs_create_jsimpl_backend();
    var definedOps = {
      userRead: ops.read,
      userWrite: ops.write,
      allocFile: file => {
        wasmFSDeviceStreams[file] = {};
      },
      freeFile: file => {
        wasmFSDeviceStreams[file] = undefined;
      },
      getSize: file => {},
      // Devices cannot be resized.
      setSize: (file, size) => 0,
      read: (file, buffer, length, offset) => {
        var bufferArray = (growMemViews(), HEAP8).subarray(buffer >>> 0, buffer + length >>> 0);
        try {
          var bytesRead = definedOps.userRead(wasmFSDeviceStreams[file], bufferArray, 0, length, offset);
        } catch (e) {
          return -e.errno;
        }
        (growMemViews(), HEAP8).set(bufferArray, buffer >>> 0);
        return bytesRead;
      },
      write: (file, buffer, length, offset) => {
        var bufferArray = (growMemViews(), HEAP8).subarray(buffer >>> 0, buffer + length >>> 0);
        try {
          var bytesWritten = definedOps.userWrite(wasmFSDeviceStreams[file], bufferArray, 0, length, offset);
        } catch (e) {
          return -e.errno;
        }
        (growMemViews(), HEAP8).set(bufferArray, buffer >>> 0);
        return bytesWritten;
      }
    };
    wasmFS$backends[backendPointer] = definedOps;
    wasmFSDevices[dev] = backendPointer;
  },
  createDevice(parent, name, input, output) {
    if (typeof parent != "string") {
      // The old API allowed parents to be objects, which do not exist in WasmFS.
      throw new Error("Only string paths are accepted");
    }
    var path = PATH.join2(parent, name);
    var mode = FS_getMode(!!input, !!output);
    FS.createDevice.major ??= 64;
    var dev = FS.makedev(FS.createDevice.major++, 0);
    // Create a fake device with a set of stream ops to emulate
    // the old API's createDevice().
    FS.registerDevice(dev, {
      read(stream, buffer, offset, length, pos) {
        var bytesRead = 0;
        for (var i = 0; i < length; i++) {
          var result;
          try {
            result = input();
          } catch (e) {
            throw new FS.ErrnoError(29);
          }
          if (result === undefined && bytesRead === 0) {
            throw new FS.ErrnoError(6);
          }
          if (result === null || result === undefined) break;
          bytesRead++;
          buffer[offset + i] = result;
        }
        return bytesRead;
      },
      write(stream, buffer, offset, length, pos) {
        for (var i = 0; i < length; i++) {
          try {
            output(buffer[offset + i]);
          } catch (e) {
            throw new FS.ErrnoError(29);
          }
        }
        return i;
      }
    });
    return FS.mkdev(path, mode, dev);
  },
  mkdev(path, mode, dev) {
    if (typeof dev === "undefined") {
      dev = mode;
      mode = 438;
    }
    var deviceBackend = wasmFSDevices[dev];
    if (!deviceBackend) {
      throw new Error("Invalid device ID.");
    }
    return FS.handleError(withStackSave(() => (_wasmfs_create_file(stringToUTF8OnStack(path), mode, deviceBackend))));
  },
  rename(oldPath, newPath) {
    return FS.handleError(withStackSave(() => {
      var oldPathBuffer = stringToUTF8OnStack(oldPath);
      var newPathBuffer = stringToUTF8OnStack(newPath);
      return __wasmfs_rename(oldPathBuffer, newPathBuffer);
    }));
  },
  llseek(stream, offset, whence) {
    return FS.handleError(__wasmfs_llseek(stream.fd, BigInt(offset), whence));
  }
};

var getCFunc = ident => {
  var func = Module["_" + ident];
  // closure exported function
  return func;
};

/**
   * @param {string|null=} returnType
   * @param {Array=} argTypes
   * @param {Array=} args
   * @param {Object=} opts
   */ var ccall = (ident, returnType, argTypes, args, opts) => {
  // For fast lookup of conversion functions
  var toC = {
    "string": str => {
      var ret = 0;
      if (str !== null && str !== undefined && str !== 0) {
        // null string
        ret = stringToUTF8OnStack(str);
      }
      return ret;
    },
    "array": arr => {
      var ret = stackAlloc(arr.length);
      writeArrayToMemory(arr, ret);
      return ret;
    }
  };
  function convertReturnValue(ret) {
    if (returnType === "string") {
      return UTF8ToString(ret);
    }
    if (returnType === "pointer") return ret >>> 0;
    if (returnType === "boolean") return Boolean(ret);
    return ret;
  }
  var func = getCFunc(ident);
  var cArgs = [];
  var stack = 0;
  if (args) {
    for (var i = 0; i < args.length; i++) {
      var converter = toC[argTypes[i]];
      if (converter) {
        if (stack === 0) stack = stackSave();
        cArgs[i] = converter(args[i]);
      } else {
        cArgs[i] = args[i];
      }
    }
  }
  var ret = func(...cArgs);
  function onDone(ret) {
    if (stack !== 0) stackRestore(stack);
    return convertReturnValue(ret);
  }
  ret = onDone(ret);
  return ret;
};

/**
   * @param {string=} returnType
   * @param {Array=} argTypes
   * @param {Object=} opts
   */ var cwrap = (ident, returnType, argTypes, opts) => {
  // When the function takes numbers and returns a number, we can just return
  // the original function
  var numericArgs = !argTypes || argTypes.every(type => type === "number" || type === "boolean");
  var numericRet = returnType !== "string";
  if (numericRet && numericArgs && !opts) {
    return getCFunc(ident);
  }
  return (...args) => ccall(ident, returnType, argTypes, args, opts);
};

var FS_createPath = FS.createPath;

var updateTableMap = (offset, count) => {
  if (functionsInTableMap) {
    for (var i = offset; i < offset + count; i++) {
      var item = getWasmTableEntry(i);
      // Ignore null values.
      if (item) {
        functionsInTableMap.set(item, i);
      }
    }
  }
};

var functionsInTableMap;

var getFunctionAddress = func => {
  // First, create the map if this is the first use.
  if (!functionsInTableMap) {
    functionsInTableMap = new WeakMap;
    updateTableMap(0, wasmTable.length);
  }
  return functionsInTableMap.get(func) || 0;
};

var freeTableIndexes = [];

var getEmptyTableSlot = () => {
  // Reuse a free index if there is one, otherwise grow.
  if (freeTableIndexes.length) {
    return freeTableIndexes.pop();
  }
  // Grow the table
  return wasmTable["grow"](1);
};

var setWasmTableEntry = (idx, func) => {
  /** @suppress {checkTypes} */ wasmTable.set(idx, func);
  // With ABORT_ON_WASM_EXCEPTIONS wasmTable.get is overridden to return wrapped
  // functions so we need to call it here to retrieve the potential wrapper correctly
  // instead of just storing 'func' directly into wasmTableMirror
  /** @suppress {checkTypes} */ wasmTableMirror[idx] = wasmTable.get(idx);
};

var uleb128EncodeWithLen = arr => {
  const n = arr.length;
  // Note: this LEB128 length encoding produces extra byte for n < 128,
  // but we don't care as it's only used in a temporary representation.
  return [ (n % 128) | 128, n >> 7, ...arr ];
};

var wasmTypeCodes = {
  "i": 127,
  // i32
  "p": 127,
  // i32
  "j": 126,
  // i64
  "f": 125,
  // f32
  "d": 124,
  // f64
  "e": 111
};

var generateTypePack = types => uleb128EncodeWithLen(Array.from(types, type => {
  var code = wasmTypeCodes[type];
  return code;
}));

var convertJsFunctionToWasm = (func, sig) => {
  // TODO: If the type reflection proposal ever makes progress we can use
  // it here instead of creatign a new module.
  var bytes = Uint8Array.of(0, 97, 115, 109, // magic ("\0asm")
  1, 0, 0, 0, // version: 1
  1, // Type section code
  // The module is static, with the exception of the type section, which is
  // generated based on the signature passed in.
  ...uleb128EncodeWithLen([ 1, // count: 1
  96, // param types
  ...generateTypePack(sig.slice(1)), // return types (for now only supporting [] if `void` and single [T] otherwise)
  ...generateTypePack(sig[0] === "v" ? "" : sig[0]) ]), // The rest of the module is static
  2, 7, // import section
  // (import "e" "f" (func 0 (type 0)))
  1, 1, 101, 1, 102, 0, 0, 7, 5, // export section
  // (export "f" (func 0 (type 0)))
  1, 1, 102, 0, 0);
  // We can compile this wasm module synchronously because it is very small.
  // This accepts an import (at "e.f"), that it reroutes to an export (at "f")
  var module = new WebAssembly.Module(bytes);
  var instance = new WebAssembly.Instance(module, {
    "e": {
      "f": func
    }
  });
  var wrappedFunc = instance.exports["f"];
  return wrappedFunc;
};

/** @param {string=} sig */ var addFunction = (func, sig) => {
  // Check if the function is already in the table, to ensure each function
  // gets a unique index.
  var rtn = getFunctionAddress(func);
  if (rtn) {
    return rtn;
  }
  // It's not in the table, add it now.
  var ret = getEmptyTableSlot();
  // Set the new value.
  try {
    // Attempting to call this with JS function will cause table.set() to fail
    setWasmTableEntry(ret, func);
  } catch (err) {
    if (!(err instanceof TypeError)) {
      throw err;
    }
    var wrapped = convertJsFunctionToWasm(func, sig);
    setWasmTableEntry(ret, wrapped);
  }
  functionsInTableMap.set(func, ret);
  return ret;
};

PThread.init();

DOTNET.setup({
  wasmEnableSIMD: true,
  wasmEnableEH: true,
  enableAotProfiler: false,
  enableDevToolsProfiler: false,
  enableLogProfiler: false,
  enableEventPipe: false,
  runAOTCompilation: true,
  wasmEnableThreads: true,
  gitHash: "d3ef958a3712691b1af805be4724e41f9264ac34"
});

Module["requestAnimationFrame"] = MainLoop.requestAnimationFrame;

Module["pauseMainLoop"] = MainLoop.pause;

Module["resumeMainLoop"] = MainLoop.resume;

MainLoop.init();

for (let i = 0; i < 32; ++i) tempFixedLengthArray.push(new Array(i));

var miniTempWebGLFloatBuffersStorage = new Float32Array(288);

// Create GL_POOL_TEMP_BUFFERS_SIZE+1 temporary buffers, for uploads of size 0 through GL_POOL_TEMP_BUFFERS_SIZE inclusive
for (/**@suppress{duplicate}*/ var i = 0; i <= 288; ++i) {
  miniTempWebGLFloatBuffers[i] = miniTempWebGLFloatBuffersStorage.subarray(0, i);
}

var miniTempWebGLIntBuffersStorage = new Int32Array(288);

// Create GL_POOL_TEMP_BUFFERS_SIZE+1 temporary buffers, for uploads of size 0 through GL_POOL_TEMP_BUFFERS_SIZE inclusive
for (/**@suppress{duplicate}*/ var i = 0; i <= 288; ++i) {
  miniTempWebGLIntBuffers[i] = miniTempWebGLIntBuffersStorage.subarray(0, i);
}

// exports
Module["requestFullscreen"] = (lockPointer, resizeCanvas) => {
  GLFW3.requestFullscreen(null, lockPointer, resizeCanvas);
};

Module["glfwGetWindow"] = any => {
  const ctx = GLFW3.findContext(any);
  return ctx ? ctx.glfwWindow : null;
};

Module["glfwGetCanvas"] = any => {
  const ctx = GLFW3.findContext(any);
  return ctx ? ctx.canvas : null;
};

Module["glfwGetCanvasSelector"] = any => {
  const ctx = GLFW3.findContext(any);
  return ctx ? ctx.selector : null;
};

Module["glfwMakeCanvasResizable"] = (any, resizableSelector, handleSelector) => {
  GLFW3.makeCanvasResizable(any, resizableSelector, handleSelector);
};

Module["glfwUnmakeCanvasResizable"] = any => {
  GLFW3.unmakeCanvasResizable(any);
};

Module["glfwRequestFullscreen"] = GLFW3.requestFullscreen;

Module["glfwIsRuntimePlatformApple"] = () => _emscripten_glfw3_context_is_runtime_platform_apple();

registerPreMainLoop(() => {
  // If the current GL context is an OffscreenCanvas, but it was initialized
  // with implicit swap mode, perform the swap on behalf of the user.
  if (GL.currentContext && !GL.currentContextIsProxied && !GL.currentContext.attributes.explicitSwapControl && GL.currentContext.GLctx.commit) {
    GL.currentContext.GLctx.commit();
  }
});

if (typeof WebAssembly.Suspending == "function") _gex_wgpu_jspi_wait = new WebAssembly.Suspending(_gex_wgpu_jspi_wait);

if (typeof WebAssembly.Suspending == "function") _wink_js_acquire_device = new WebAssembly.Suspending(_wink_js_acquire_device);

if (typeof WebAssembly.Suspending == "function") _wink_js_yield_frame = new WebAssembly.Suspending(_wink_js_yield_frame);

// End JS library code
// include: postlibrary.js
// This file is included after the automatically-generated JS library code
// but before the wasm module is created.
{
  // With WASM_ESM_INTEGRATION this has to happen at the top level and not
  // delayed until processModuleArgs.
  initMemory();
  // Begin ATMODULES hooks
  if (Module["noExitRuntime"]) noExitRuntime = Module["noExitRuntime"];
  if (Module["print"]) out = Module["print"];
  if (Module["printErr"]) err = Module["printErr"];
  // End ATMODULES hooks
  if (Module["arguments"]) programArgs = Module["arguments"];
  if (Module["thisProgram"]) thisProgram = Module["thisProgram"];
  var preInit = Module["preInit"];
  if (preInit) {
    if (typeof preInit == "function") Module["preInit"] = preInit = [ preInit ];
    // Written as a loop so that preInit functions that themselves add more
    // preInit functions.  Is this actually needed?
    while (preInit.length > 0) {
      preInit.shift()();
    }
  }
}

// Begin runtime exports
Module["out"] = out;

Module["err"] = err;

Module["abort"] = abort;

Module["wasmExports"] = wasmExports;

Module["runtimeKeepalivePush"] = runtimeKeepalivePush;

Module["runtimeKeepalivePop"] = runtimeKeepalivePop;

Module["maybeExit"] = maybeExit;

Module["addRunDependency"] = addRunDependency;

Module["removeRunDependency"] = removeRunDependency;

Module["ccall"] = ccall;

Module["cwrap"] = cwrap;

Module["addFunction"] = addFunction;

Module["setValue"] = setValue;

Module["getValue"] = getValue;

Module["UTF8ArrayToString"] = UTF8ArrayToString;

Module["UTF8ToString"] = UTF8ToString;

Module["stringToUTF8Array"] = stringToUTF8Array;

Module["lengthBytesUTF8"] = lengthBytesUTF8;

Module["safeSetTimeout"] = safeSetTimeout;

Module["FS_preloadFile"] = FS_preloadFile;

Module["FS_unlink"] = FS_unlink;

Module["FS_createPath"] = FS_createPath;

Module["FS"] = FS;

Module["FS_createDataFile"] = FS_createDataFile;

Module["PThread"] = PThread;

// End runtime exports
// Begin JS library exports
Module["stackSave"] = stackSave;

Module["stackRestore"] = stackRestore;

Module["stackAlloc"] = stackAlloc;

Module["_emscripten_force_exit"] = _emscripten_force_exit;

// End JS library exports
// end include: postlibrary.js
// proxiedFunctionTable specifies the list of functions that can be called
// either synchronously or asynchronously from other threads in postMessage()d
// or internally queued events. This way a pthread in a Worker can synchronously
// access e.g. the DOM on the main thread.
var proxiedFunctionTable = [ _proc_exit, exitOnMainThread, pthreadCreateProxied, __setitimer_js, _emscripten_exit_fullscreen, getCanvasSizeMainThread, setCanvasElementSizeMainThread, _emscripten_exit_pointerlock, _emscripten_force_exit, _emscripten_get_device_pixel_ratio, _emscripten_get_element_css_size, _emscripten_get_fullscreen_status, _emscripten_get_gamepad_status, _emscripten_get_num_gamepads, _emscripten_get_screen_size, _emscripten_glfw3_context_destroy, _emscripten_glfw3_context_get_fullscreen_window, _emscripten_glfw3_context_get_pointer_lock_window, _emscripten_glfw3_context_init, _emscripten_glfw3_context_is_any_element_focused, _emscripten_glfw3_context_is_runtime_platform_apple, _emscripten_glfw3_context_keyboard_lock, _emscripten_glfw3_context_make_canvas_resizable, _emscripten_glfw3_context_open_url, _emscripten_glfw3_context_set_clipboard_string, _emscripten_glfw3_context_set_title, _emscripten_glfw3_context_unmake_canvas_resizable, _emscripten_glfw3_create_custom_cursor, _emscripten_glfw3_destroy_custom_cursor, _emscripten_glfw3_window_change_focus, _emscripten_glfw3_window_destroy, _emscripten_glfw3_window_get_computed_opacity, _emscripten_glfw3_window_get_computed_visibility, _emscripten_glfw3_window_get_position, _emscripten_glfw3_window_init, _emscripten_glfw3_window_on_created, _emscripten_glfw3_window_set_custom_cursor, _emscripten_glfw3_window_set_opacity, _emscripten_glfw3_window_set_size, _emscripten_glfw3_window_set_standard_cursor, _emscripten_glfw3_window_set_visibility, _emscripten_request_fullscreen, _emscripten_request_fullscreen_strategy, _emscripten_request_pointerlock, _emscripten_sample_gamepad_data, _emscripten_set_beforeunload_callback_on_thread, _emscripten_set_blur_callback_on_thread, _emscripten_set_devicemotion_callback_on_thread, _emscripten_set_element_css_size, _emscripten_set_focus_callback_on_thread, _emscripten_set_fullscreenchange_callback_on_thread, _emscripten_set_gamepadconnected_callback_on_thread, _emscripten_set_gamepaddisconnected_callback_on_thread, _emscripten_set_keydown_callback_on_thread, _emscripten_set_keypress_callback_on_thread, _emscripten_set_keyup_callback_on_thread, _emscripten_set_mousedown_callback_on_thread, _emscripten_set_mouseenter_callback_on_thread, _emscripten_set_mouseleave_callback_on_thread, _emscripten_set_mousemove_callback_on_thread, _emscripten_set_mouseup_callback_on_thread, _emscripten_set_orientationchange_callback_on_thread, _emscripten_set_pointerlockchange_callback_on_thread, _emscripten_set_pointerlockerror_callback_on_thread, _emscripten_set_resize_callback_on_thread, _emscripten_set_touchcancel_callback_on_thread, _emscripten_set_touchend_callback_on_thread, _emscripten_set_touchmove_callback_on_thread, _emscripten_set_touchstart_callback_on_thread, _emscripten_set_visibilitychange_callback_on_thread, _emscripten_set_wheel_callback_on_thread, _emscripten_set_window_title, _environ_get, _environ_sizes_get, _wink_js_kick ];

var ASM_CONSTS = {
  17747184: $0 => {
    console.debug(UTF8ToString($0));
    _free($0);
  },
  17747232: () => {
    console.log("[jiterp heat] no traces yet");
  },
  17747280: $0 => {
    var s = UTF8ToString($0);
    _free($0);
    console.log(s);
  },
  17747337: ($0, $1) => {
    var s = UTF8ToString($0);
    _free($0);
    var c = $1;
    (c == 3 ? console.error : c == 2 ? console.warn : c == 1 ? console.info : c == 4 ? console.debug : console.log)(s);
  },
  17747506: ($0, $1, $2) => {
    try {
      var w = $0 | 0;
      var h = $1 | 0;
      var p = $2 | 0;
      var c = document.createElement("canvas");
      c.width = w;
      c.height = h;
      var ctx = c.getContext("2d");
      var img = ctx.createImageData(w, h);
      img.data.set((growMemViews(), HEAPU8).subarray(p >>> 0, p + w * h * 4 >>> 0));
      ctx.putImageData(img, 0, 0);
      var url = c.toDataURL("image/png");
      var link = document.querySelector("link[rel~='icon']");
      if (!link) {
        link = document.createElement("link");
        link.rel = "icon";
        document.head.appendChild(link);
      }
      link.type = "image/png";
      link.href = url;
    } catch (e) {
      console.warn("[glfwSetWindowIcon] failed:", e);
    }
  },
  17748082: () => {
    try {
      var w = (typeof window !== "undefined") ? window : null;
      if (w && w.tinyfd && typeof w.tinyfd.beep === "function") {
        w.tinyfd.beep();
      }
    } catch (e) {}
  },
  17748243: ($0, $1, $2) => {
    try {
      var w = (typeof window !== "undefined") ? window : null;
      var f = w && w.tinyfd && w.tinyfd.notifyPopup;
      if (typeof f !== "function") return 0;
      return (f($0 ? UTF8ToString($0) : null, $1 ? UTF8ToString($1) : null, $2 ? UTF8ToString($2) : null) | 0);
    } catch (e) {
      return 0;
    }
  },
  17748530: ($0, $1, $2, $3, $4) => {
    try {
      var w = (typeof window !== "undefined") ? window : null;
      var f = w && w.tinyfd && w.tinyfd.messageBox;
      if (typeof f !== "function") return 0;
      var ret = f($0 ? UTF8ToString($0) : null, $1 ? UTF8ToString($1) : null, $2 ? UTF8ToString($2) : null, $3 ? UTF8ToString($3) : null, $4 | 0);
      return (ret | 0);
    } catch (e) {
      return 0;
    }
  },
  17748869: ($0, $1, $2, $3, $4, $5) => {
    try {
      var w = (typeof window !== "undefined") ? window : null;
      var f = w && w.tinyfd && w.tinyfd.colorChooser;
      if (typeof f !== "function") return 0;
      var title = $0 ? UTF8ToString($0) : null;
      var hex = $1 ? UTF8ToString($1) : null;
      var defRGB = null;
      if ($2) {
        defRGB = Array.of((growMemViews(), HEAPU8)[$2 >>> 0] | 0, (growMemViews(), HEAPU8)[$2 + 1 >>> 0] | 0, (growMemViews(), 
        HEAPU8)[$2 + 2 >>> 0] | 0);
      }
      var r = f.call(w.tinyfd, title, hex, defRGB);
      if (r == null) return 0;
      var s = r.toString();
      stringToUTF8(s, $4, $5);
      if ($3) {
        var m = /^#?([0-9a-fA-F]{6})/.exec(s);
        if (m) {
          var v = parseInt(m[1], 16);
          (growMemViews(), HEAPU8)[$3 >>> 0] = (v >> 16) & 255;
          (growMemViews(), HEAPU8)[$3 + 1 >>> 0] = (v >> 8) & 255;
          (growMemViews(), HEAPU8)[$3 + 2 >>> 0] = (v) & 255;
        }
      }
      return 1;
    } catch (e) {
      return 0;
    }
  },
  17749550: ($0, $1, $2, $3, $4, $5, $6, $7) => {
    try {
      var w = (typeof window !== "undefined") ? window : null;
      var name = $0 ? UTF8ToString($0) : "";
      var f = w && w.tinyfd && w.tinyfd[name];
      if (typeof f !== "function") return 0;
      var args = [];
      if ($1) args.push(UTF8ToString($1)); else args.push(null);
      if ($2) args.push(UTF8ToString($2)); else args.push(null);
      if ($3) args.push(UTF8ToString($3)); else args.push(null);
      if ($4) args.push(UTF8ToString($4)); else args.push(null);
      if ($5 !== -2147483648) args.push($5 | 0);
      var r = f.apply(w.tinyfd, args);
      if (r == null) return 0;
      stringToUTF8(r.toString(), $6, $7);
      return 1;
    } catch (e) {
      return 0;
    }
  },
  17750160: ($0, $1, $2, $3, $4, $5, $6, $7, $8) => {
    try {
      var w = (typeof window !== "undefined") ? window : null;
      var name = $0 ? UTF8ToString($0) : "";
      var f = w && w.tinyfd && w.tinyfd[name];
      if (typeof f !== "function") return 0;
      var title = $1 ? UTF8ToString($1) : null;
      var dflt = $2 ? UTF8ToString($2) : null;
      var n = $3 | 0;
      var arr = [];
      if ($4 && n > 0) {
        var base = $4 >> 2;
        for (var i = 0; i < n; i++) {
          var p = (growMemViews(), HEAPU32)[base + i >>> 0];
          arr.push(p ? UTF8ToString(p) : "");
        }
      }
      var desc = $5 ? UTF8ToString($5) : null;
      var multi = $6;
      var r;
      if (multi < 0) {
        r = f.call(w.tinyfd, title, dflt, arr, desc);
      } else {
        r = f.call(w.tinyfd, title, dflt, arr, desc, multi | 0);
      }
      if (r == null) return 0;
      stringToUTF8(r.toString(), $7, $8);
      return 1;
    } catch (e) {
      return 0;
    }
  },
  17750887: ($0, $1, $2, $3) => {
    var w = $0;
    var h = $1;
    var pixels = $2;
    var canvasId = UTF8ToString($3);
    var canvas = document.querySelector(canvasId);
    var SDL3 = Module["SDL3"];
    if (SDL3.ctxCanvas !== canvas) {
      SDL3.ctx = Browser.createContext(canvas, false, true);
      if (!SDL3.ctx) {
        return false;
      }
      SDL3.ctxCanvas = canvas;
    }
    if (SDL3.w !== w || SDL3.h !== h || SDL3.imageCtx !== SDL3.ctx) {
      SDL3.image = SDL3.ctx.createImageData(w, h);
      SDL3.w = w;
      SDL3.h = h;
      SDL3.imageCtx = SDL3.ctx;
    }
    var data = SDL3.image.data;
    var src = pixels / 4;
    if (SDL3.data32Data !== data) {
      SDL3.data32 = new Int32Array(data.buffer);
      SDL3.data32Data = data;
    }
    var data32 = SDL3.data32;
    data32.set((growMemViews(), HEAP32).subarray(src >>> 0, src + data32.length >>> 0));
    SDL3.ctx.putImageData(SDL3.image, 0, 0);
    return true;
  },
  17751636: () => {
    var SDL3 = Module["SDL3"];
    SDL3["mouse_x"] = 0;
    SDL3["mouse_y"] = 0;
    SDL3["mouse_buttons"] = [];
    for (var i = 0; i < 5; ++i) {
      SDL3["mouse_buttons"][i] = false;
    }
    document.addEventListener("mousemove", function(e) {
      var SDL3 = Module["SDL3"];
      SDL3["mouse_x"] = e.clientX;
      SDL3["mouse_y"] = e.clientY;
    });
    document.addEventListener("mousedown", function(e) {
      var SDL3 = Module["SDL3"];
      if (0 <= e.button && e.button < SDL3["mouse_buttons"].length) {
        SDL3["mouse_buttons"][e.button] = true;
      }
    });
    document.addEventListener("mouseup", function(e) {
      var SDL3 = Module["SDL3"];
      if (0 <= e.button && e.button < SDL3["mouse_buttons"].length) {
        SDL3["mouse_buttons"][e.button] = false;
      }
    });
  },
  17752324: ($0, $1, $2, $3, $4) => {
    var w = $0;
    var h = $1;
    var hot_x = $2;
    var hot_y = $3;
    var pixels = $4;
    var canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    var ctx = canvas.getContext("2d");
    var image = ctx.createImageData(w, h);
    var data = image.data;
    var src = pixels / 4;
    var data32 = new Int32Array(data.buffer);
    data32.set((growMemViews(), HEAP32).subarray(src >>> 0, src + data32.length >>> 0));
    ctx.putImageData(image, 0, 0);
    var url = hot_x === 0 && hot_y === 0 ? "url(" + canvas.toDataURL() + "), auto" : "url(" + canvas.toDataURL() + ") " + hot_x + " " + hot_y + ", auto";
    var urlBuf = _SDL_malloc(url.length + 1);
    stringToUTF8(url, urlBuf, url.length + 1);
    return urlBuf;
  },
  17752982: $0 => {
    if (Module["canvas"]) {
      Module["canvas"].style["cursor"] = UTF8ToString($0);
    }
  },
  17753065: () => {
    if (Module["canvas"]) {
      Module["canvas"].style["cursor"] = "none";
    }
  },
  17753134: () => Module["SDL3"]["mouse_x"],
  17753172: () => Module["SDL3"]["mouse_y"],
  17753210: $0 => Module["SDL3"]["mouse_buttons"][$0],
  17753258: $0 => {
    var data = $0;
    document.sdlEventHandlerLockKeysCheck = function(event) {
      if ((event.key != "CapsLock") && (event.key != "NumLock") && (event.key != "ScrollLock")) {
        _Emscripten_HandleLockKeysCheck(Module["SDL3"].JSVarToCPtr(data), event.getModifierState("CapsLock"), event.getModifierState("NumLock"), event.getModifierState("ScrollLock"));
      }
    };
    document.addEventListener("keydown", document.sdlEventHandlerLockKeysCheck);
  },
  17753685: () => {
    document.removeEventListener("keydown", document.sdlEventHandlerLockKeysCheck);
  },
  17753769: $0 => {
    var target = document;
    if (target) {
      target.sdlEventHandlerMouseButtonUpGlobal = function(event) {
        var SDL3 = Module["SDL3"];
        var d = SDL3.makePointerEventCStruct(0, 0, event);
        if (d != 0) {
          _Emscripten_HandleMouseButtonUpGlobal(SDL3.JSVarToCPtr($0), d);
          _SDL_free(d);
        }
      };
      target.addEventListener("pointerup", target.sdlEventHandlerMouseButtonUpGlobal);
    }
  },
  17754130: $0 => {
    var SDL3 = Module["SDL3"];
    if (SDL3.makePointerEventCStruct === undefined) {
      SDL3.makePointerEventCStruct = function(left, top, event) {
        var ptrtype = 0;
        if (event.pointerType == "mouse") {
          ptrtype = 1;
        } else if (event.pointerType == "touch") {
          ptrtype = 2;
        } else if (event.pointerType == "pen") {
          ptrtype = 3;
        } else {
          return 0;
        }
        var ptr = _SDL_malloc($0);
        if (ptr != 0) {
          var idx = SDL3.CPtrToHeap32Index(ptr);
          (growMemViews(), HEAP32)[idx++ >>> 0] = ptrtype;
          (growMemViews(), HEAP32)[idx++ >>> 0] = event.pointerId;
          (growMemViews(), HEAP32)[idx++ >>> 0] = (typeof (event.button) !== "undefined") ? event.button : -1;
          (growMemViews(), HEAP32)[idx++ >>> 0] = event.buttons;
          (growMemViews(), HEAP32)[idx++ >>> 0] = (event.type == "pointerdown") ? 1 : 0;
          (growMemViews(), HEAPF32)[idx++ >>> 0] = event.movementX;
          (growMemViews(), HEAPF32)[idx++ >>> 0] = event.movementY;
          (growMemViews(), HEAPF32)[idx++ >>> 0] = event.clientX - left;
          (growMemViews(), HEAPF32)[idx++ >>> 0] = event.clientY - top;
          if (ptrtype == 3) {
            (growMemViews(), HEAPF32)[idx++ >>> 0] = event.pressure;
            (growMemViews(), HEAPF32)[idx++ >>> 0] = event.tangentialPressure;
            (growMemViews(), HEAPF32)[idx++ >>> 0] = event.tiltX;
            (growMemViews(), HEAPF32)[idx++ >>> 0] = event.tiltY;
            (growMemViews(), HEAPF32)[idx++ >>> 0] = event.twist;
          }
        }
        return ptr;
      };
    }
  },
  17755122: $0 => {
    var id = UTF8ToString($0);
    try {
      var canvas = document.querySelector(id);
      if (canvas) {
        return canvas === document.activeElement;
      }
    } catch (e) {}
    return false;
  },
  17755288: () => document.hasFocus(),
  17755320: () => {
    var target = document;
    if (target) {
      target.removeEventListener("pointerup", target.sdlEventHandlerMouseButtonUpGlobal);
      target.sdlEventHandlerMouseButtonUpGlobal = undefined;
    }
  },
  17755502: () => document.body.clientWidth,
  17755540: () => document.body.clientHeight,
  17755579: () => window.innerWidth,
  17755609: () => window.innerHeight,
  17755640: () => window.outerWidth,
  17755670: () => window.outerHeight,
  17755701: () => window.pageXOffset,
  17755732: () => window.pageYOffset,
  17755763: ($0, $1) => {
    var target = document.querySelector(UTF8ToString($1));
    if (target) {
      var SDL3 = Module["SDL3"];
      var data = $0;
      target.sdlEventHandlerPointerEnter = function(event) {
        var rect = target.getBoundingClientRect();
        var d = SDL3.makePointerEventCStruct(rect.left, rect.top, event);
        if (d != 0) {
          _Emscripten_HandlePointerEnter(SDL3.JSVarToCPtr(data), d);
          _SDL_free(d);
        }
      };
      target.sdlEventHandlerPointerLeave = function(event) {
        var rect = target.getBoundingClientRect();
        var d = SDL3.makePointerEventCStruct(rect.left, rect.top, event);
        if (d != 0) {
          _Emscripten_HandlePointerLeave(SDL3.JSVarToCPtr(data), d);
          _SDL_free(d);
        }
      };
      target.sdlEventHandlerPointerGeneric = function(event) {
        var rect = target.getBoundingClientRect();
        var d = SDL3.makePointerEventCStruct(rect.left, rect.top, event);
        if (d != 0) {
          _Emscripten_HandlePointerGeneric(SDL3.JSVarToCPtr(data), d);
          _SDL_free(d);
        }
      };
      target.style.touchAction = "none";
      target.addEventListener("pointerenter", target.sdlEventHandlerPointerEnter);
      target.addEventListener("pointerleave", target.sdlEventHandlerPointerLeave);
      target.addEventListener("pointercancel", target.sdlEventHandlerPointerLeave);
      target.addEventListener("pointerdown", target.sdlEventHandlerPointerGeneric);
      target.addEventListener("pointermove", target.sdlEventHandlerPointerGeneric);
      target.addEventListener("pointerup", target.sdlEventHandlerPointerGeneric);
    }
  },
  17757151: ($0, $1, $2) => {
    var target = document.querySelector(UTF8ToString($1));
    if (target) {
      var data = $0;
      var SDL3 = Module["SDL3"];
      var makeDropEventCStruct = function(event) {
        var ptr = 0;
        ptr = _SDL_malloc($2);
        if (ptr != 0) {
          var idx = ptr >> 2;
          var rect = target.getBoundingClientRect();
          (growMemViews(), HEAP32)[idx++ >>> 0] = event.clientX - rect.left;
          (growMemViews(), HEAP32)[idx++ >>> 0] = event.clientY - rect.top;
        }
        return ptr;
      };
      SDL3.eventHandlerDropDragover = function(event) {
        event.preventDefault();
        var d = makeDropEventCStruct(event);
        if (d != 0) {
          _Emscripten_SendDragEvent(data, d);
          _SDL_free(d);
        }
      };
      target.addEventListener("dragover", SDL3.eventHandlerDropDragover);
      SDL3.drop_count = 0;
      try {
        FS.mkdir("/tmp/filedrop");
      } catch (e) {}
      SDL3.eventHandlerDropDrop = function(event) {
        event.preventDefault();
        if (event.dataTransfer.types.includes("text/plain")) {
          let plain_text = stringToNewUTF8(event.dataTransfer.getData("text/plain"));
          _Emscripten_SendDragTextEvent(data, plain_text);
          _Emscripten_force_free(plain_text);
        } else if (event.dataTransfer.types.includes("Files")) {
          let files_read = 0;
          const files_to_read = event.dataTransfer.files.length;
          for (let i = 0; i < files_to_read; i++) {
            const file = event.dataTransfer.files.item(i);
            const file_reader = new FileReader;
            file_reader.readAsArrayBuffer(file);
            file_reader.onload = function(event) {
              const fs_dropdir = `/tmp/filedrop/${SDL3.drop_count}`;
              SDL3.drop_count += 1;
              const fs_filepath = `${fs_dropdir}/${file.name}`;
              const c_fs_filepath = stringToNewUTF8(fs_filepath);
              const contents_array8 = new Uint8Array(event.target.result);
              try {
                FS.mkdir(fs_dropdir);
                var stream = FS.open(fs_filepath, "w");
                FS.write(stream, contents_array8, 0, contents_array8.length, 0);
                FS.close(stream);
                _Emscripten_SendDragFileEvent(data, c_fs_filepath);
              } catch (e) {}
              _Emscripten_force_free(c_fs_filepath);
              onFileRead();
            };
            file_reader.onerror = function(event) {
              onFileRead();
            };
          }
          function onFileRead() {
            ++files_read;
            if (files_read === files_to_read) {
              _Emscripten_SendDragCompleteEvent(data);
            }
          }
        }
        _Emscripten_SendDragCompleteEvent(data);
      };
      target.addEventListener("drop", SDL3.eventHandlerDropDrop);
      SDL3.eventHandlerDropDragend = function(event) {
        event.preventDefault();
        _Emscripten_SendDragCompleteEvent(data);
      };
      target.addEventListener("dragend", SDL3.eventHandlerDropDragend);
      target.addEventListener("dragleave", SDL3.eventHandlerDropDragend);
    }
  },
  17759518: $0 => {
    var target = document.querySelector(UTF8ToString($0));
    if (target) {
      var SDL3 = Module["SDL3"];
      target.removeEventListener("dragleave", SDL3.eventHandlerDropDragend);
      target.removeEventListener("dragend", SDL3.eventHandlerDropDragend);
      target.removeEventListener("drop", SDL3.eventHandlerDropDrop);
      SDL3.drop_count = undefined;
      function recursive_remove(dirpath) {
        FS.readdir(dirpath).forEach(filename => {
          const p = `${dirpath}/${filename}`;
          const p_s = FS.stat(p);
          if (FS.isFile(p_s.mode)) {
            FS.unlink(p);
          } else if (FS.isDir(p)) {
            recursive_remove(p);
          }
        });
        FS.rmdir(dirpath);
      }
      ("/tmp/filedrop");
      FS.rmdir("/tmp/filedrop");
      target.removeEventListener("dragover", SDL3.eventHandlerDropDragover);
      SDL3.eventHandlerDropDragover = undefined;
      SDL3.eventHandlerDropDrop = undefined;
      SDL3.eventHandlerDropDragend = undefined;
    }
  },
  17760348: $0 => {
    var target = document.querySelector(UTF8ToString($0));
    if (target) {
      target.removeEventListener("pointerenter", target.sdlEventHandlerPointerEnter);
      target.removeEventListener("pointerleave", target.sdlEventHandlerPointerLeave);
      target.removeEventListener("pointercancel", target.sdlEventHandlerPointerLeave);
      target.removeEventListener("pointerdown", target.sdlEventHandlerPointerGeneric);
      target.removeEventListener("pointermove", target.sdlEventHandlerPointerGeneric);
      target.removeEventListener("pointerup", target.sdlEventHandlerPointerGeneric);
      target.style.touchAction = "";
      target.sdlEventHandlerPointerEnter = undefined;
      target.sdlEventHandlerPointerLeave = undefined;
      target.sdlEventHandlerPointerGeneric = undefined;
    }
  },
  17761082: () => {
    if (!window.matchMedia) {
      return -1;
    }
    if (window.matchMedia("(prefers-color-scheme: light)").matches) {
      return 0;
    }
    if (window.matchMedia("(prefers-color-scheme: dark)").matches) {
      return 1;
    }
    return -1;
  },
  17761291: () => {
    if (typeof (Module["SDL3"]) !== "undefined") {
      var SDL3 = Module["SDL3"];
      SDL3.themeChangedMatchMedia.removeEventListener("change", SDL3.eventHandlerThemeChanged);
      SDL3.themeChangedMatchMedia = undefined;
      SDL3.eventHandlerThemeChanged = undefined;
    }
  },
  17761544: () => window.innerWidth,
  17761574: () => window.innerHeight,
  17761605: $0 => {
    Module["requestFullscreen"] = function(lockPointer, resizeCanvas) {
      _requestFullscreenThroughSDL($0);
    };
  },
  17761714: ($0, $1) => {
    var pngData = (growMemViews(), HEAPU8).buffer instanceof ArrayBuffer ? (growMemViews(), 
    HEAPU8).subarray($0 >>> 0, $0 + $1 >>> 0) : (growMemViews(), HEAPU8).slice($0, $0 + $1);
    var blob = new Blob([ pngData ], {
      type: "image/png"
    });
    var url = URL.createObjectURL(blob);
    var link = document.querySelector("link[rel~='icon']");
    if (!link) {
      link = document.createElement("link");
      link.rel = "icon";
      link.type = "image/png";
      document.head.appendChild(link);
    }
    if (link.href && link.href.startsWith("blob:")) {
      URL.revokeObjectURL(link.href);
    }
    link.href = url;
  },
  17762207: () => {
    Module["requestFullscreen"] = function(lockPointer, resizeCanvas) {};
  },
  17762281: () => window.innerWidth,
  17762311: () => window.innerHeight,
  17762342: $0 => {
    var canvas = document.querySelector(UTF8ToString($0));
    canvas.SDL3_original_position = canvas.style.position;
    canvas.SDL3_original_top = canvas.style.top;
    canvas.SDL3_original_left = canvas.style.left;
    var div = document.createElement("div");
    div.id = "SDL3_fill_document_background_elements";
    div.SDL3_canvas = canvas;
    div.SDL3_canvas_parent = canvas.parentNode;
    div.SDL3_canvas_nextsib = canvas.nextSibling;
    var children = Array.from(document.body.children);
    for (var child of children) {
      div.appendChild(child);
    }
    document.body.appendChild(div);
    div.style.display = "none";
    document.body.appendChild(canvas);
    canvas.style.position = "fixed";
    canvas.style.top = "0";
    canvas.style.left = "0";
  },
  17763040: () => {
    var div = document.getElementById("SDL3_fill_document_background_elements");
    if (div) {
      if (div.SDL3_canvas_nextsib) {
        div.SDL3_canvas_parent.insertBefore(div.SDL3_canvas, div.SDL3_canvas_nextsib);
      } else {
        div.SDL3_canvas_parent.appendChild(div.SDL3_canvas);
      }
      while (div.firstChild) {
        document.body.insertBefore(div.firstChild, div);
      }
      div.SDL3_canvas.style.position = div.SDL3_canvas.SDL3_original_position;
      div.SDL3_canvas.style.top = div.SDL3_canvas.SDL3_original_top;
      div.SDL3_canvas.style.left = div.SDL3_canvas.SDL3_original_left;
      div.remove();
    }
  },
  17763599: () => {
    if (window.matchMedia) {
      var SDL3 = Module["SDL3"];
      SDL3.eventHandlerThemeChanged = function(event) {
        _Emscripten_SendSystemThemeChangedEvent();
      };
      SDL3.themeChangedMatchMedia = window.matchMedia("(prefers-color-scheme: dark)");
      SDL3.themeChangedMatchMedia.addEventListener("change", SDL3.eventHandlerThemeChanged);
    }
  },
  17763921: ($0, $1, $2, $3, $4) => {
    var title = UTF8ToString($0);
    var message = UTF8ToString($1);
    var background = UTF8ToString($2);
    var color = UTF8ToString($3);
    var id = UTF8ToString($4);
    var dialog = document.createElement("dialog");
    dialog.classList.add("SDL3_messagebox");
    dialog.id = id;
    dialog.style.color = color;
    dialog.style.backgroundColor = background;
    document.body.append(dialog);
    var h1 = document.createElement("h1");
    h1.innerText = title;
    dialog.append(h1);
    var p = document.createElement("p");
    p.innerText = message;
    dialog.append(p);
    dialog.showModal();
  },
  17764462: ($0, $1, $2, $3, $4, $5, $6, $7) => {
    var dialog_id = UTF8ToString($0);
    var text = UTF8ToString($1);
    var responseId = $2;
    var clickOnReturn = $3;
    var clickOnEscape = $4;
    var border = UTF8ToString($5);
    var background = UTF8ToString($6);
    var hovered = UTF8ToString($7);
    var dialog = document.getElementById(dialog_id);
    if (!dialog) {
      return false;
    }
    var button = document.createElement("button");
    button.innerText = text;
    button.style.borderColor = border;
    button.style.backgroundColor = background;
    dialog.addEventListener("keydown", function(e) {
      if (clickOnReturn && e.key === "Enter") {
        e.preventDefault();
        button.click();
      } else if (clickOnEscape && e.key === "Escape") {
        e.preventDefault();
        button.click();
      }
    });
    dialog.addEventListener("cancel", function(e) {
      e.preventDefault();
    });
    button.onmouseenter = function(e) {
      button.style.backgroundColor = hovered;
    };
    button.onmouseleave = function(e) {
      button.style.backgroundColor = background;
    };
    button.onclick = function(e) {
      dialog.close(responseId);
    };
    dialog.append(button);
    return true;
  },
  17765471: $0 => {
    var dialog_id = UTF8ToString($0);
    var dialog = document.getElementById(dialog_id);
    if (!dialog) {
      return false;
    }
    return dialog.open;
  },
  17765609: $0 => {
    var dialog_id = UTF8ToString($0);
    var dialog = document.getElementById(dialog_id);
    if (!dialog) {
      return 0;
    }
    try {
      return parseInt(dialog.returnValue);
    } catch (e) {
      return 0;
    }
  },
  17765791: ($0, $1) => {
    alert(UTF8ToString($0) + "\n\n" + UTF8ToString($1));
  },
  17765848: () => {
    if (typeof (AudioContext) !== "undefined") {
      return true;
    } else if (typeof (webkitAudioContext) !== "undefined") {
      return true;
    }
    return false;
  },
  17765995: () => {
    if ((typeof (navigator.mediaDevices) !== "undefined") && (typeof (navigator.mediaDevices.getUserMedia) !== "undefined")) {
      return true;
    } else if (typeof (navigator.webkitGetUserMedia) !== "undefined") {
      return true;
    }
    return false;
  },
  17766229: () => {
    var SDL3 = Module["SDL3"];
    if (typeof (SDL3.audio_playback) === "undefined") {
      SDL3.audio_playback = {};
    }
    if (typeof (SDL3.audio_recording) === "undefined") {
      SDL3.audio_recording = {};
    }
    if (!SDL3.audioContext) {
      if (typeof (AudioContext) !== "undefined") {
        SDL3.audioContext = new AudioContext;
      } else if (typeof (webkitAudioContext) !== "undefined") {
        SDL3.audioContext = new webkitAudioContext;
      }
      if (SDL3.audioContext) {
        if ((typeof navigator.userActivation) === "undefined") {
          autoResumeAudioContext(SDL3.audioContext);
        }
      }
    }
    return (SDL3.audioContext !== undefined);
  },
  17766808: () => Module["SDL3"].audioContext.sampleRate,
  17766859: ($0, $1, $2, $3) => {
    var SDL3 = Module["SDL3"];
    var have_microphone = function(stream) {
      if (SDL3.audio_recording.silenceTimer !== undefined) {
        clearInterval(SDL3.audio_recording.silenceTimer);
        SDL3.audio_recording.silenceTimer = undefined;
        SDL3.audio_recording.silenceBuffer = undefined;
      }
      SDL3.audio_recording.mediaStreamNode = SDL3.audioContext.createMediaStreamSource(stream);
      SDL3.audio_recording.scriptProcessorNode = SDL3.audioContext.createScriptProcessor($1, $0, 1);
      SDL3.audio_recording.scriptProcessorNode.onaudioprocess = function(audioProcessingEvent) {
        if ((SDL3 === undefined) || (SDL3.audio_recording === undefined)) {
          return;
        }
        audioProcessingEvent.outputBuffer.getChannelData(0).fill(0);
        SDL3.audio_recording.currentRecordingBuffer = audioProcessingEvent.inputBuffer;
        dynCall("ip", $2, [ $3 ]);
      };
      SDL3.audio_recording.mediaStreamNode.connect(SDL3.audio_recording.scriptProcessorNode);
      SDL3.audio_recording.scriptProcessorNode.connect(SDL3.audioContext.destination);
      SDL3.audio_recording.stream = stream;
    };
    var no_microphone = function(error) {};
    SDL3.audio_recording.silenceBuffer = SDL3.audioContext.createBuffer($0, $1, SDL3.audioContext.sampleRate);
    SDL3.audio_recording.silenceBuffer.getChannelData(0).fill(0);
    var silence_callback = function() {
      SDL3.audio_recording.currentRecordingBuffer = SDL3.audio_recording.silenceBuffer;
      dynCall("ip", $2, [ $3 ]);
    };
    SDL3.audio_recording.silenceTimer = setInterval(silence_callback, ($1 / SDL3.audioContext.sampleRate) * 1e3);
    if ((navigator.mediaDevices !== undefined) && (navigator.mediaDevices.getUserMedia !== undefined)) {
      navigator.mediaDevices.getUserMedia({
        audio: true,
        video: false
      }).then(have_microphone).catch(no_microphone);
    } else if (navigator.webkitGetUserMedia !== undefined) {
      navigator.webkitGetUserMedia({
        audio: true,
        video: false
      }, have_microphone, no_microphone);
    }
  },
  17768700: ($0, $1, $2, $3) => {
    var SDL3 = Module["SDL3"];
    SDL3.audio_playback.scriptProcessorNode = SDL3.audioContext["createScriptProcessor"]($1, 0, $0);
    SDL3.audio_playback.scriptProcessorNode["onaudioprocess"] = function(e) {
      if ((SDL3 === undefined) || (SDL3.audio_playback === undefined)) {
        return;
      }
      if (SDL3.audio_playback.silenceTimer !== undefined) {
        clearInterval(SDL3.audio_playback.silenceTimer);
        SDL3.audio_playback.silenceTimer = undefined;
        SDL3.audio_playback.silenceBuffer = undefined;
      }
      SDL3.audio_playback.currentPlaybackBuffer = e["outputBuffer"];
      dynCall("ip", $2, [ $3 ]);
    };
    SDL3.audio_playback.scriptProcessorNode["connect"](SDL3.audioContext["destination"]);
    if (SDL3.audioContext.state === "suspended") {
      SDL3.audio_playback.silenceBuffer = SDL3.audioContext.createBuffer($0, $1, SDL3.audioContext.sampleRate);
      SDL3.audio_playback.silenceBuffer.getChannelData(0).fill(0);
      var silence_callback = function() {
        if ((typeof navigator.userActivation) !== "undefined") {
          if (navigator.userActivation.hasBeenActive) {
            SDL3.audioContext.resume();
          }
        }
        SDL3.audio_playback.currentPlaybackBuffer = SDL3.audio_playback.silenceBuffer;
        dynCall("ip", $2, [ $3 ]);
        SDL3.audio_playback.currentPlaybackBuffer = undefined;
      };
      SDL3.audio_playback.silenceTimer = setInterval(silence_callback, ($1 / SDL3.audioContext.sampleRate) * 1e3);
    }
  },
  17770016: $0 => {
    var SDL3 = Module["SDL3"];
    if ($0) {
      if (SDL3.audio_recording.silenceTimer !== undefined) {
        clearInterval(SDL3.audio_recording.silenceTimer);
      }
      if (SDL3.audio_recording.stream !== undefined) {
        var tracks = SDL3.audio_recording.stream.getAudioTracks();
        for (var i = 0; i < tracks.length; i++) {
          SDL3.audio_recording.stream.removeTrack(tracks[i]);
        }
      }
      if (SDL3.audio_recording.scriptProcessorNode !== undefined) {
        SDL3.audio_recording.scriptProcessorNode.onaudioprocess = function(audioProcessingEvent) {};
        SDL3.audio_recording.scriptProcessorNode.disconnect();
      }
      if (SDL3.audio_recording.mediaStreamNode !== undefined) {
        SDL3.audio_recording.mediaStreamNode.disconnect();
      }
      SDL3.audio_recording = undefined;
    } else {
      if (SDL3.audio_playback.scriptProcessorNode != undefined) {
        SDL3.audio_playback.scriptProcessorNode.disconnect();
      }
      if (SDL3.audio_playback.silenceTimer !== undefined) {
        clearInterval(SDL3.audio_playback.silenceTimer);
      }
      SDL3.audio_playback = undefined;
    }
    if ((SDL3.audioContext !== undefined) && (SDL3.audio_playback === undefined) && (SDL3.audio_recording === undefined)) {
      SDL3.audioContext.close();
      SDL3.audioContext = undefined;
    }
  },
  17771172: ($0, $1) => {
    var SDL3 = Module["SDL3"];
    var buf = SDL3.CPtrToHeap32Index($0);
    var numChannels = SDL3.audio_playback.currentPlaybackBuffer["numberOfChannels"];
    for (var c = 0; c < numChannels; ++c) {
      var channelData = SDL3.audio_playback.currentPlaybackBuffer["getChannelData"](c);
      if (channelData.length != $1) {
        throw "Web Audio playback buffer length mismatch! Destination size: " + channelData.length + " samples vs expected " + $1 + " samples!";
      }
      for (var j = 0; j < $1; ++j) {
        channelData[j] = (growMemViews(), HEAPF32)[buf + (j * numChannels + c) >>> 0];
      }
    }
  },
  17771705: ($0, $1) => {
    var SDL3 = Module["SDL3"];
    var numChannels = SDL3.audio_recording.currentRecordingBuffer.numberOfChannels;
    for (var c = 0; c < numChannels; ++c) {
      var channelData = SDL3.audio_recording.currentRecordingBuffer.getChannelData(c);
      if (channelData.length != $1) {
        throw "Web Audio recording buffer length mismatch! Destination size: " + channelData.length + " samples vs expected " + $1 + " samples!";
      }
      if (numChannels == 1) {
        for (var j = 0; j < $1; ++j) {
          setValue($0 + (j * 4), channelData[j], "float");
        }
      } else {
        for (var j = 0; j < $1; ++j) {
          setValue($0 + (((j * numChannels) + c) * 4), channelData[j], "float");
        }
      }
    }
  },
  17772332: () => {
    Module["SDL3"].dummy_audio = {};
    Module["SDL3"].dummy_audio.timers = [];
    Module["SDL3"].dummy_audio.timers[0] = undefined;
    Module["SDL3"].dummy_audio.timers[1] = undefined;
  },
  17772509: ($0, $1, $2, $3, $4) => {
    var a = Module["SDL3"].dummy_audio;
    if (a.timers[$0] !== undefined) {
      clearInterval(a.timers[$0]);
    }
    a.timers[$0] = setInterval(function() {
      dynCall("vi", $3, [ $4 ]);
    }, ($1 / $2) * 1e3);
  },
  17772701: $0 => {
    var a = Module["SDL3"].dummy_audio;
    if (a.timers[$0] !== undefined) {
      clearInterval(a.timers[$0]);
    }
    a.timers[$0] = undefined;
  },
  17772832: () => {
    Module["SDL3"].camera = {};
  },
  17772864: () => (navigator.mediaDevices === undefined) ? 0 : 1,
  17772923: ($0, $1, $2, $3, $4) => {
    const device = $0;
    const w = $1;
    const h = $2;
    const framerate_numerator = $3;
    const framerate_denominator = $4;
    const outcome = Module._SDLEmscriptenCameraPermissionOutcome;
    const iterate = Module._SDLEmscriptenThreadIterate;
    const constraints = {};
    if ((w <= 0) || (h <= 0)) {
      constraints.video = true;
    } else {
      constraints.video = {};
      constraints.video.width = w;
      constraints.video.height = h;
    }
    if ((framerate_numerator > 0) && (framerate_denominator > 0)) {
      var fps = framerate_numerator / framerate_denominator;
      constraints.video.frameRate = {
        ideal: fps
      };
    }
    function grabNextCameraFrame() {
      const SDL3 = Module["SDL3"];
      if ((typeof (SDL3) === "undefined") || (typeof (SDL3.camera) === "undefined") || (typeof (SDL3.camera.stream) === "undefined")) {
        return;
      }
      const nextframems = SDL3.camera.next_frame_time;
      const now = performance.now();
      if (now >= nextframems) {
        iterate(device);
        while (SDL3.camera.next_frame_time < now) {
          SDL3.camera.next_frame_time += SDL3.camera.fpsincrms;
        }
      }
      requestAnimationFrame(grabNextCameraFrame);
    }
    navigator.mediaDevices.getUserMedia(constraints).then(stream => {
      const settings = stream.getVideoTracks()[0].getSettings();
      const actualw = settings.width;
      const actualh = settings.height;
      const actualfps = settings.frameRate;
      console.log("Camera is opened! Actual spec: (" + actualw + "x" + actualh + "), fps=" + actualfps);
      if (outcome(device, 1, actualw, actualh, actualfps)) {
        const video = document.createElement("video");
        video.width = actualw;
        video.height = actualh;
        video.style.display = "none";
        video.srcObject = stream;
        const canvas = document.createElement("canvas");
        canvas.width = actualw;
        canvas.height = actualh;
        canvas.style.display = "none";
        const ctx2d = canvas.getContext("2d");
        const SDL3 = Module["SDL3"];
        SDL3.camera.width = actualw;
        SDL3.camera.height = actualh;
        SDL3.camera.fps = actualfps;
        SDL3.camera.fpsincrms = 1e3 / actualfps;
        SDL3.camera.stream = stream;
        SDL3.camera.video = video;
        SDL3.camera.canvas = canvas;
        SDL3.camera.ctx2d = ctx2d;
        SDL3.camera.next_frame_time = performance.now();
        video.play();
        video.addEventListener("loadedmetadata", () => {
          grabNextCameraFrame();
        });
      }
    }).catch(err => {
      console.error("Tried to open camera but it threw an error! " + err.name + ": " + err.message);
      outcome(device, 0, 0, 0, 0);
    });
  },
  17775229: () => {
    const SDL3 = Module["SDL3"];
    if ((typeof (SDL3) === "undefined") || (typeof (SDL3.camera) === "undefined") || (typeof (SDL3.camera.stream) === "undefined")) {
      return;
    }
    SDL3.camera.stream.getTracks().forEach(track => track.stop());
    SDL3.camera = {};
  },
  17775480: ($0, $1, $2) => {
    const w = $0;
    const h = $1;
    const rgba = $2;
    const SDL3 = Module["SDL3"];
    if ((typeof (SDL3) === "undefined") || (typeof (SDL3.camera) === "undefined") || (typeof (SDL3.camera.ctx2d) === "undefined")) {
      return 0;
    }
    SDL3.camera.ctx2d.drawImage(SDL3.camera.video, 0, 0, w, h);
    const imgrgba = SDL3.camera.ctx2d.getImageData(0, 0, w, h).data;
    (growMemViews(), HEAPU8).set(imgrgba, rgba >>> 0);
    return 1;
  },
  17775858: () => {
    if (typeof (Module["SDL3"]) !== "undefined") {
      Module["SDL3"].camera = undefined;
    }
  },
  17775945: $0 => {
    let gamepad = navigator["getGamepads"]()[$0];
    if (!gamepad) {
      return 0;
    }
    let vendor_str = "Vendor: ";
    if (gamepad["id"]["indexOf"](vendor_str) > 0) {
      let vendor_str_index = gamepad["id"]["indexOf"](vendor_str) + vendor_str["length"];
      return parseInt(gamepad["id"]["substr"](vendor_str_index, 4), 16);
    }
    let id_split = gamepad["id"]["split"]("-");
    if (id_split["length"] > 1 && !isNaN(parseInt(id_split[0], 16))) {
      return parseInt(id_split[0], 16);
    }
    return 0;
  },
  17776410: $0 => {
    let gamepad = navigator["getGamepads"]()[$0];
    if (!gamepad) {
      return 0;
    }
    let product_str = "Product: ";
    if (gamepad["id"]["indexOf"](product_str) > 0) {
      let product_str_index = gamepad["id"]["indexOf"](product_str) + product_str["length"];
      return parseInt(gamepad["id"]["substr"](product_str_index, 4), 16);
    }
    let id_split = gamepad["id"]["split"]("-");
    if (id_split["length"] > 1 && !isNaN(parseInt(id_split[1], 16))) {
      return parseInt(id_split[1], 16);
    }
    return 0;
  },
  17776882: $0 => {
    let gamepad = navigator["getGamepads"]()[$0];
    if (!gamepad) {
      return 0;
    }
    return gamepad["id"]["toLowerCase"]()["indexOf"]("xinput") >= 0;
  },
  17777025: $0 => {
    let gamepads = navigator["getGamepads"]();
    if (!gamepads) {
      return 0;
    }
    let gamepad = gamepads[$0];
    if (!gamepad || !gamepad["vibrationActuator"]) {
      return 0;
    }
    return 1;
  },
  17777200: ($0, $1, $2) => {
    let gamepads = navigator["getGamepads"]();
    if (!gamepads) {
      return 0;
    }
    let gamepad = gamepads[$0];
    if (!gamepad || !gamepad["vibrationActuator"]) {
      return 0;
    }
    gamepad["vibrationActuator"]["playEffect"]("dual-rumble", {
      "startDelay": 0,
      "duration": 3e3,
      "weakMagnitude": $2 / 65535,
      "strongMagnitude": $1 / 65535
    });
    return 1;
  },
  17777536: () => {
    if (typeof (Module["SDL3"]) === "undefined") {
      Module["SDL3"] = {};
    }
    var SDL3 = Module["SDL3"];
    if (typeof (SDL3.JSVarToCPtr) === "undefined") {
      SDL3.JSVarToCPtr = function(v) {
        return v;
      };
    }
    if (typeof (SDL3.CPtrToHeap32Index) === "undefined") {
      SDL3.CPtrToHeap32Index = function(ptr) {
        return ptr >>> 2;
      };
    }
  },
  17777850: () => {
    console.log("WASM_JIT_PLACEHOLDER_STRAY " + (new Error).stack);
  },
  17777922: ($0, $1, $2, $3, $4, $5, $6) => {
    var f = (new Error).stack.split("\n").slice(2, 18).map(function(l) {
      return l.trim().split(" ")[1];
    }).join("<");
    console.log("JITERP_ENTRY_SITE " + $0 + " " + ($1 ? "inst" : "static") + ($2 ? "_ret_" : "_") + $3 + ($4 ? " unbox" : "") + ($5 ? " slot" : "") + " | " + UTF8ToString($6) + " | " + f);
  },
  17778238: $0 => {
    var l = Error.stackTraceLimit;
    Error.stackTraceLimit = 40;
    var s = (new Error).stack;
    Error.stackTraceLimit = l;
    console.log(UTF8ToString($0) + " " + s);
  },
  17778401: $0 => {
    console.log(UTF8ToString($0));
  },
  17778438: ($0, $1) => {
    var lp = $1 < 0 ? $1 + 4294967296 : $1;
    var f = wasmTable.get($0);
    if (!f) return 0;
    (growMemViews(), HEAP32)[lp / 4 >>> 0] = (f.length | 0);
    if ((f.length | 0) !== 2) return 2;
    if (Module.__wjSlotFn && Module.__wjSlotFn.has($0) && Module.__wjSlotFn.get($0) !== f) return 3;
    return 1;
  },
  17778706: $0 => {
    setInterval(function() {
      Module._mono_wasm_jit_edge_tick();
    }, $0);
  },
  17778781: $0 => {
    setInterval(function() {
      Module._mono_wasm_jit_edge_tick();
    }, $0);
  },
  17778856: ($0, $1) => {
    var fn = wasmTable.get($1);
    wasmTable.set($0, fn);
    if (Module.__wjSlotFn) Module.__wjSlotFn.set($0, fn);
    if (!Module.__wjAliasOf) {
      Module.__wjAliasOf = new Map;
      Module.__wjAliasRepoints = 0;
      Module.__wjAliasRepoint = function(f, oldfn, newfn) {
        var al = Module.__wjAliasOf.get(f);
        if (!al || oldfn === newfn) return;
        var i = 0;
        while (i < al.length) {
          if (oldfn && wasmTable.get(al[i]) === oldfn) {
            wasmTable.set(al[i], newfn);
            if (Module.__wjSlotFn) Module.__wjSlotFn.set(al[i], newfn);
            Module.__wjAliasRepoints++;
            i++;
          } else {
            al[i] = al[al.length - 1];
            al.pop();
          }
        }
      };
    }
    var al = Module.__wjAliasOf.get($1);
    if (!al) Module.__wjAliasOf.set($1, al = []);
    if (al.indexOf($0) < 0) al.push($0);
  },
  17779573: () => {
    var err = new Error;
    console.log("Stacktrace: \n");
    console.log(err.stack);
  },
  17779653: ($0, $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15) => {
    var p = $2 < 0 ? $2 + 4294967296 : $2;
    var eb = $4 < 0 ? $4 + 4294967296 : $4;
    var op = $6 < 0 ? $6 + 4294967296 : $6;
    var t0 = performance.now();
    try {
      var b = (growMemViews(), HEAPU8).slice(p, p + $3);
      if (!Module.__wjHelperImports) {
        Module.__wjSlotFn = new Map;
        Module.__wjSlotChanged = 0;
        Module.__wjHelperImports = new Proxy({}, {
          get: function(t, k) {
            if (typeof k !== "string") return undefined;
            if (!/^[0-9]+$/.test(k)) return undefined;
            var i = Number(k);
            var f = wasmTable.get(i);
            if (Module.__wjSlotFn && Module.__wjSlotFn.has(i) && Module.__wjSlotFn.get(i) !== f) {
              Module.__wjSlotChanged = (Module.__wjSlotChanged | 0) + 1;
              if (Module.__wjSlotChanged <= 20) console.log("WASM_JIT_IMPORT_SLOT_CHANGED slot=" + i + " n=" + Module.__wjSlotChanged);
            }
            return f;
          }
        });
      }
      var inst = new WebAssembly.Instance(new WebAssembly.Module(b), {
        m: {
          h: wasmMemory
        },
        f: {
          f: wasmTable
        },
        x: {
          e: wasmExports && wasmExports["__cpp_exception"]
        },
        s: {
          p: wasmExports && wasmExports["__stack_pointer"],
          l: $7,
          c: $8,
          v: $9,
          n: $10,
          d: $11,
          m: $12,
          b: $13,
          i: $14,
          g: Module._mono_wasm_jit_worker_action_addr()
        },
        h: Module.__wjHelperImports
      });
      if (op) (growMemViews(), HEAPF64)[op / 8 >>> 0] = performance.now() - t0;
      if ($15) {
        if (!Module.__wjsw) Module.__wjsw = ({
          inst: new WeakMap,
          main: null,
          cls: new Map
        });
        Module.__wjsw.inst.set(inst, $15 | 0);
      }
      if ($0 > 0 && $1 > 0) {
        var oldf = wasmTable.get($1);
        wasmTable.set($0, inst.exports.e);
        wasmTable.set($1, inst.exports.f);
        if (Module.__wjSlotFn) {
          Module.__wjSlotFn.set($0, inst.exports.e);
          Module.__wjSlotFn.set($1, inst.exports.f);
        }
        if (Module.__wjAliasRepoint) Module.__wjAliasRepoint($1, oldf, inst.exports.f);
      }
      return 1;
    } catch (e) {
      if (op) (growMemViews(), HEAPF64)[op / 8 >>> 0] = performance.now() - t0;
      var _ex = "";
      try {
        _ex = " exports=[" + Object.keys(inst && inst.exports || {}).join(",") + "]";
      } catch (e2) {}
      try {
        var _hm = /"h" "([0-9]+)"/.exec("" + e);
        if (_hm) {
          var _hi = Number(_hm[1]);
          var _hf = wasmTable.get(_hi);
          var _vs = Module.__wjVslowFn;
          _ex += " [h " + _hi + ": table " + (_hf ? ("fn name=" + _hf.name + " len=" + _hf.length) : "null") + " vslow_here=" + !!(_vs && _vs.has(_hi)) + " same_fn=" + !!(_vs && _vs.get(_hi) === _hf) + " slotfn=" + !!(Module.__wjSlotFn && Module.__wjSlotFn.has(_hi)) + " aliased=" + !!(Module.__wjAliasOf && Module.__wjAliasOf.has(_hi)) + "]";
        }
      } catch (e3) {}
      if (eb) stringToUTF8("" + e + _ex, eb, $5);
      return 0;
    }
  },
  17782070: ($0, $1, $2) => {
    var p = $0 < 0 ? $0 + 4294967296 : $0;
    try {
      if (!Module.__wjHelperImports) {
        Module.__wjSlotFn = new Map;
        Module.__wjSlotChanged = 0;
        Module.__wjHelperImports = new Proxy({}, {
          get: function(t, k) {
            if (typeof k !== "string" || !/^[0-9]+$/.test(k)) return undefined;
            return wasmTable.get(Number(k));
          }
        });
      }
      new WebAssembly.Instance(new WebAssembly.Module((growMemViews(), HEAPU8).slice(p, p + $1)), {
        m: {
          h: wasmMemory
        },
        f: {
          f: wasmTable
        },
        s: {
          p: wasmExports["__stack_pointer"],
          l: 0,
          c: 0,
          v: 0,
          n: 0,
          d: 0,
          m: 0,
          b: 0,
          i: 0,
          g: 0
        },
        h: Module.__wjHelperImports
      });
      (Module.__wjVslowFn || (Module.__wjVslowFn = new Map)).set($2, wasmTable.get($2));
      return 1;
    } catch (e) {
      if ((Module.__wjVslowErr = (Module.__wjVslowErr | 0) + 1) <= 8) console.log("WASM_JIT_VSLOW_FAIL " + e);
      return 0;
    }
  },
  17782871: $0 => {
    Module.__wjswPending = $0;
  },
  17782902: ($0, $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15) => {
    var es = $0 < 0 ? $0 + 4294967296 : $0;
    var fs = $1 < 0 ? $1 + 4294967296 : $1;
    var p = $3 < 0 ? $3 + 4294967296 : $3;
    var eb = $5 < 0 ? $5 + 4294967296 : $5;
    var op = $7 < 0 ? $7 + 4294967296 : $7;
    var t0 = performance.now();
    try {
      var b = (growMemViews(), HEAPU8).slice(p, p + $4);
      if (!Module.__wjHelperImports) {
        Module.__wjSlotFn = new Map;
        Module.__wjSlotChanged = 0;
        Module.__wjHelperImports = new Proxy({}, {
          get: function(t, k) {
            if (typeof k !== "string") return undefined;
            if (!/^[0-9]+$/.test(k)) return undefined;
            var i = Number(k);
            var f = wasmTable.get(i);
            if (Module.__wjSlotFn && Module.__wjSlotFn.has(i) && Module.__wjSlotFn.get(i) !== f) {
              Module.__wjSlotChanged = (Module.__wjSlotChanged | 0) + 1;
              if (Module.__wjSlotChanged <= 20) console.log("WASM_JIT_IMPORT_SLOT_CHANGED slot=" + i + " n=" + Module.__wjSlotChanged);
            }
            return f;
          }
        });
      }
      var inst = new WebAssembly.Instance(new WebAssembly.Module(b), {
        m: {
          h: wasmMemory
        },
        f: {
          f: wasmTable
        },
        x: {
          e: wasmExports && wasmExports["__cpp_exception"]
        },
        s: {
          p: wasmExports && wasmExports["__stack_pointer"],
          l: $8,
          c: $9,
          v: $10,
          n: $11,
          d: $12,
          m: $13,
          b: $14,
          i: $15,
          g: Module._mono_wasm_jit_worker_action_addr()
        },
        h: Module.__wjHelperImports
      });
      if (op) (growMemViews(), HEAPF64)[op / 8 >>> 0] = performance.now() - t0;
      if (Module.__wjswPending) {
        if (!Module.__wjsw) Module.__wjsw = ({
          inst: new WeakMap,
          main: null,
          cls: new Map
        });
        Module.__wjsw.inst.set(inst, Module.__wjswPending | 0);
        Module.__wjswPending = 0;
      }
      var k = 0;
      var ef = null;
      var ff = null;
      var eslot = new Array($2);
      var fslot = new Array($2);
      var efn = new Array($2);
      var ffn = new Array($2);
      while (k < $2) {
        ef = inst.exports["e" + k];
        ff = inst.exports["f" + k];
        if (!ef || !ff) throw new Error("batched module missing export e" + k);
        eslot[k] = (growMemViews(), HEAP32)[es / 4 + k >>> 0];
        fslot[k] = (growMemViews(), HEAP32)[fs / 4 + k >>> 0];
        if (!(eslot[k] > 0) || !(fslot[k] > 0)) throw new Error("batched module bad slot for member " + k + ": e=" + eslot[k] + " f=" + fslot[k]);
        wasmTable.get(eslot[k]);
        wasmTable.get(fslot[k]);
        efn[k] = ef;
        ffn[k] = ff;
        k = k + 1;
      }
      k = 0;
      var oldf = null;
      while (k < $2) {
        oldf = wasmTable.get(fslot[k]);
        wasmTable.set(eslot[k], efn[k]);
        wasmTable.set(fslot[k], ffn[k]);
        if (Module.__wjSlotFn) {
          Module.__wjSlotFn.set(eslot[k], efn[k]);
          Module.__wjSlotFn.set(fslot[k], ffn[k]);
        }
        if (Module.__wjAliasRepoint) Module.__wjAliasRepoint(fslot[k], oldf, ffn[k]);
        k = k + 1;
      }
      return 1;
    } catch (e) {
      if (op) (growMemViews(), HEAPF64)[op / 8 >>> 0] = performance.now() - t0;
      var _ex = "";
      try {
        var _hm = /"h" "([0-9]+)"/.exec("" + e);
        if (_hm) {
          var _hi = Number(_hm[1]);
          var _hf = wasmTable.get(_hi);
          var _vs = Module.__wjVslowFn;
          _ex = " [h " + _hi + ": table " + (_hf ? ("fn name=" + _hf.name + " len=" + _hf.length) : "null") + " vslow_here=" + !!(_vs && _vs.has(_hi)) + " same_fn=" + !!(_vs && _vs.get(_hi) === _hf) + " slotfn=" + !!(Module.__wjSlotFn && Module.__wjSlotFn.has(_hi)) + " aliased=" + !!(Module.__wjAliasOf && Module.__wjAliasOf.has(_hi)) + "]";
        }
      } catch (e3) {}
      if (eb) stringToUTF8("" + e + _ex, eb, $6);
      return 0;
    }
  },
  17785965: $0 => {
    var s = Module.__wjStubFn && Module.__wjStubFn.get($0);
    if (!s) return 0;
    var old = wasmTable.get($0);
    if (old !== s) {
      wasmTable.set($0, s);
      if (Module.__wjAliasRepoint) Module.__wjAliasRepoint($0, old, s);
    }
    if (Module.__wjSlotFn) Module.__wjSlotFn.set($0, s);
    return 1;
  },
  17786247: () => {
    var o = Error.stackTraceLimit;
    Error.stackTraceLimit = 10;
    var st = (new Error).stack || "";
    Error.stackTraceLimit = o;
    var ls = st.split("\n");
    var fr = [];
    var fnv = function(x) {
      var h = 2166136261 | 0;
      for (var k = 0; k < x.length; k++) h = Math.imul(h ^ (x.charCodeAt(k) & 255), 16777619);
      return h || 1;
    };
    for (var i = 0; i < ls.length && fr.length < 2; i++) {
      var l = ls[i];
      var u = l.lastIndexOf(" (wasm://wasm/");
      if (u < 0) {
        if (fr.length && l.indexOf("    at ") === 0) fr.push([ 3, 0 ]);
        continue;
      }
      var url = l.slice(u + 14);
      var c = url.indexOf(":wasm-function[");
      if (c < 0) continue;
      var mh = url.slice(0, c);
      var d = mh.lastIndexOf("-");
      var mod = d > 0 ? mh.slice(0, d) : mh;
      if (mod === "dotnet.native.wasm") {
        if (fr.length) fr.push([ 1, 0 ]);
        continue;
      }
      var t = l.slice(l.indexOf("at ") + 3, u);
      var fn = t.indexOf(mod + ".") === 0 ? t.slice(mod.length + 1) : t;
      if (fr.length && (fn === "entry" || fn.slice(-8) === " [entry]")) {
        fr.push([ 2, 0 ]);
        continue;
      }
      fr.push([ 0, fnv(fn) ]);
    }
    if (fr.length === 2 && fr[0][0] === 0) Module._mono_wasm_jit_edge_record(fr[0][1], fr[1][0], fr[1][1]);
  },
  17787392: ($0, $1, $2) => {
    var p = $0 < 0 ? $0 + 4294967296 : $0;
    try {
      if (!Module.__wjHelperImports) {
        Module.__wjSlotFn = new Map;
        Module.__wjSlotChanged = 0;
        Module.__wjHelperImports = new Proxy({}, {
          get: function(t, k) {
            if (typeof k !== "string" || !/^[0-9]+$/.test(k)) return undefined;
            return wasmTable.get(Number(k));
          }
        });
      }
      var prev = $2 > 0 ? wasmTable.get($2) : null;
      new WebAssembly.Instance(new WebAssembly.Module((growMemViews(), HEAPU8).slice(p, p + $1)), {
        m: {
          h: wasmMemory
        },
        f: {
          f: wasmTable
        },
        s: {
          p: wasmExports["__stack_pointer"],
          l: 0,
          c: 0,
          v: 0,
          n: 0,
          d: 0,
          m: 0,
          b: 0,
          i: 0,
          g: 0
        },
        h: Module.__wjHelperImports
      });
      if ($2 > 0) {
        var stub = wasmTable.get($2);
        (Module.__wjStubFn || (Module.__wjStubFn = new Map)).set($2, stub);
        if (prev && prev !== stub && Module.__wjAliasRepoint) Module.__wjAliasRepoint($2, prev, stub);
      }
      return 1;
    } catch (e) {
      if ((Module.__wjLazyBankErr = (Module.__wjLazyBankErr | 0) + 1) <= 8) console.log("WASM_JIT_LAZY_BANK_FAIL " + e);
      return 0;
    }
  },
  17788377: $0 => {
    var m = Module.__wjSlotFn;
    var fn = m && m.get($0);
    if (!fn) return 0;
    if (wasmTable.get($0) !== fn) {
      wasmTable.set($0, fn);
      return 2;
    }
    return 1;
  }
};

function unbox_small_structs(type_ptr) {
  type_ptr = type_ptr;
  var type_id = (growMemViews(), HEAPU16)[(type_ptr + 6 >> 1) + 0 >>> 0];
  while (type_id === 13) {
    if ((growMemViews(), HEAPU32)[(type_ptr >> 2) + 0 >>> 0] > 16) {
      break;
    }
    var elements = (growMemViews(), HEAPU32)[(type_ptr + 8 >> 2) + 0 >>> 0];
    var first_element = (growMemViews(), HEAPU32)[(elements >> 2) + 0 >>> 0];
    if (first_element === 0) {
      type_id = 0;
      break;
    } else if ((growMemViews(), HEAPU32)[(elements >> 2) + 1 >>> 0] === 0) {
      type_ptr = first_element;
      type_id = (growMemViews(), HEAPU16)[(first_element + 6 >> 1) + 0 >>> 0];
    } else {
      break;
    }
  }
  return [ type_ptr, type_id ];
}

function ffi_call_js(cif, fn, rvalue, avalue) {
  cif = cif;
  fn = fn;
  rvalue = rvalue;
  avalue = avalue;
  var abi = (growMemViews(), HEAPU32)[(cif >> 2) + 0 >>> 0];
  var nargs = (growMemViews(), HEAPU32)[(cif >> 2) + 1 >>> 0];
  var nfixedargs = (growMemViews(), HEAPU32)[(cif >> 2) + 6 >>> 0];
  var arg_types_ptr = (growMemViews(), HEAPU32)[(cif >> 2) + 2 >>> 0];
  var flags = (growMemViews(), HEAPU32)[(cif >> 2) + 5 >>> 0];
  var rtype_unboxed = unbox_small_structs((growMemViews(), HEAPU32)[(cif >> 2) + 3 >>> 0]);
  var rtype_ptr = rtype_unboxed[0];
  var rtype_id = rtype_unboxed[1];
  var orig_stack_ptr = stackSave();
  var cur_stack_ptr = orig_stack_ptr;
  var args = [];
  var ret_by_arg = (!!0);
  if (rtype_id === 15) {
    throw new Error("complex ret marshalling nyi");
  }
  if (rtype_id < 0 || rtype_id > 15) {
    throw new Error("Unexpected rtype " + rtype_id);
  }
  if (rtype_id === 4 || rtype_id === 13) {
    args.push(rvalue);
    ret_by_arg = (!!1);
  }
  for (var i = 0; i < nfixedargs; i++) {
    var arg_ptr = (growMemViews(), HEAPU32)[(avalue >> 2) + i >>> 0];
    var arg_unboxed = unbox_small_structs((growMemViews(), HEAPU32)[(arg_types_ptr >> 2) + i >>> 0]);
    var arg_type_ptr = arg_unboxed[0];
    var arg_type_id = arg_unboxed[1];
    switch (arg_type_id) {
     case 1:
     case 10:
     case 9:
      args.push((growMemViews(), HEAPU32)[(arg_ptr >> 2) + 0 >>> 0]);
      break;

     case 2:
      args.push((growMemViews(), HEAPF32)[(arg_ptr >> 2) + 0 >>> 0]);
      break;

     case 3:
      args.push((growMemViews(), HEAPF64)[(arg_ptr >> 3) + 0 >>> 0]);
      break;

     case 5:
      args.push((growMemViews(), HEAPU8)[arg_ptr + 0 >>> 0]);
      break;

     case 6:
      args.push((growMemViews(), HEAP8)[arg_ptr + 0 >>> 0]);
      break;

     case 7:
      args.push((growMemViews(), HEAPU16)[(arg_ptr >> 1) + 0 >>> 0]);
      break;

     case 8:
      args.push((growMemViews(), HEAP16)[(arg_ptr >> 1) + 0 >>> 0]);
      break;

     case 11:
     case 12:
      args.push((growMemViews(), HEAPU64)[(arg_ptr >> 3) + 0 >>> 0]);
      break;

     case 4:
      args.push((growMemViews(), HEAPU64)[(arg_ptr >> 3) + 0 >>> 0]);
      args.push((growMemViews(), HEAPU64)[(arg_ptr >> 3) + 1 >>> 0]);
      break;

     case 13:
      var size = (growMemViews(), HEAPU32)[(arg_type_ptr >> 2) + 0 >>> 0];
      var align = (growMemViews(), HEAPU16)[(arg_type_ptr + 4 >> 1) + 0 >>> 0];
      ((cur_stack_ptr -= (size)), (cur_stack_ptr &= (~((align) - 1))));
      (growMemViews(), HEAP8).subarray(cur_stack_ptr >>> 0, cur_stack_ptr + size >>> 0).set((growMemViews(), 
      HEAP8).subarray(arg_ptr >>> 0, arg_ptr + size >>> 0));
      args.push(cur_stack_ptr);
      break;

     case 14:
      args.push((growMemViews(), HEAPU32)[(arg_ptr >> 2) + 0 >>> 0]);
      break;

     case 15:
      throw new Error("complex marshalling nyi");

     default:
      throw new Error("Unexpected type " + arg_type_id);
    }
  }
  if (flags & 1) {
    var struct_arg_info = [];
    for (var i = nargs - 1; i >= nfixedargs; i--) {
      var arg_ptr = (growMemViews(), HEAPU32)[(avalue >> 2) + i >>> 0];
      var arg_unboxed = unbox_small_structs((growMemViews(), HEAPU32)[(arg_types_ptr >> 2) + i >>> 0]);
      var arg_type_ptr = arg_unboxed[0];
      var arg_type_id = arg_unboxed[1];
      switch (arg_type_id) {
       case 5:
       case 6:
        ((cur_stack_ptr -= (1)), (cur_stack_ptr &= (~((1) - 1))));
        (growMemViews(), HEAPU8)[cur_stack_ptr + 0 >>> 0] = (growMemViews(), HEAPU8)[arg_ptr + 0 >>> 0];
        break;

       case 7:
       case 8:
        ((cur_stack_ptr -= (2)), (cur_stack_ptr &= (~((2) - 1))));
        (growMemViews(), HEAPU16)[(cur_stack_ptr >> 1) + 0 >>> 0] = (growMemViews(), HEAPU16)[(arg_ptr >> 1) + 0 >>> 0];
        break;

       case 1:
       case 9:
       case 10:
       case 2:
        ((cur_stack_ptr -= (4)), (cur_stack_ptr &= (~((4) - 1))));
        (growMemViews(), HEAPU32)[(cur_stack_ptr >> 2) + 0 >>> 0] = (growMemViews(), HEAPU32)[(arg_ptr >> 2) + 0 >>> 0];
        break;

       case 3:
       case 11:
       case 12:
        ((cur_stack_ptr -= (8)), (cur_stack_ptr &= (~((8) - 1))));
        (growMemViews(), HEAPU32)[(cur_stack_ptr >> 2) + 0 >>> 0] = (growMemViews(), HEAPU32)[(arg_ptr >> 2) + 0 >>> 0];
        (growMemViews(), HEAPU32)[(cur_stack_ptr >> 2) + 1 >>> 0] = (growMemViews(), HEAPU32)[(arg_ptr >> 2) + 1 >>> 0];
        break;

       case 4:
        ((cur_stack_ptr -= (16)), (cur_stack_ptr &= (~((8) - 1))));
        (growMemViews(), HEAPU32)[(cur_stack_ptr >> 2) + 0 >>> 0] = (growMemViews(), HEAPU32)[(arg_ptr >> 2) + 0 >>> 0];
        (growMemViews(), HEAPU32)[(cur_stack_ptr >> 2) + 1 >>> 0] = (growMemViews(), HEAPU32)[(arg_ptr >> 2) + 1 >>> 0];
        (growMemViews(), HEAPU32)[(cur_stack_ptr >> 2) + 2 >>> 0] = (growMemViews(), HEAPU32)[(arg_ptr >> 2) + 2 >>> 0];
        (growMemViews(), HEAPU32)[(cur_stack_ptr >> 2) + 3 >>> 0] = (growMemViews(), HEAPU32)[(arg_ptr >> 2) + 3 >>> 0];
        break;

       case 13:
        ((cur_stack_ptr -= (4)), (cur_stack_ptr &= (~((4) - 1))));
        struct_arg_info.push([ cur_stack_ptr, arg_ptr, (growMemViews(), HEAPU32)[(arg_type_ptr >> 2) + 0 >>> 0], (growMemViews(), 
        HEAPU16)[(arg_type_ptr + 4 >> 1) + 0 >>> 0] ]);
        break;

       case 14:
        ((cur_stack_ptr -= (4)), (cur_stack_ptr &= (~((4) - 1))));
        (growMemViews(), HEAPU32)[(cur_stack_ptr >> 2) + 0 >>> 0] = (growMemViews(), HEAPU32)[(arg_ptr >> 2) + 0 >>> 0];
        break;

       case 15:
        throw new Error("complex arg marshalling nyi");

       default:
        throw new Error("Unexpected argtype " + arg_type_id);
      }
    }
    args.push(cur_stack_ptr);
    for (var i = 0; i < struct_arg_info.length; i++) {
      var struct_info = struct_arg_info[i];
      var arg_target = struct_info[0];
      var arg_ptr = struct_info[1];
      var size = struct_info[2];
      var align = struct_info[3];
      ((cur_stack_ptr -= (size)), (cur_stack_ptr &= (~((align) - 1))));
      (growMemViews(), HEAP8).subarray(cur_stack_ptr >>> 0, cur_stack_ptr + size >>> 0).set((growMemViews(), 
      HEAP8).subarray(arg_ptr >>> 0, arg_ptr + size >>> 0));
      (growMemViews(), HEAPU32)[(arg_target >> 2) + 0 >>> 0] = cur_stack_ptr;
    }
  }
  stackRestore(cur_stack_ptr);
  stackAlloc(0);
  0;
  var result = getWasmTableEntry(fn).apply(null, args);
  stackRestore(orig_stack_ptr);
  if (ret_by_arg) {
    return;
  }
  switch (rtype_id) {
   case 0:
    break;

   case 1:
   case 9:
   case 10:
    (growMemViews(), HEAPU32)[(rvalue >> 2) + 0 >>> 0] = result;
    break;

   case 2:
    (growMemViews(), HEAPF32)[(rvalue >> 2) + 0 >>> 0] = result;
    break;

   case 3:
    (growMemViews(), HEAPF64)[(rvalue >> 3) + 0 >>> 0] = result;
    break;

   case 5:
   case 6:
    (growMemViews(), HEAPU8)[rvalue + 0 >>> 0] = result;
    break;

   case 7:
   case 8:
    (growMemViews(), HEAPU16)[(rvalue >> 1) + 0 >>> 0] = result;
    break;

   case 11:
   case 12:
    (growMemViews(), HEAPU64)[(rvalue >> 3) + 0 >>> 0] = result;
    break;

   case 14:
    (growMemViews(), HEAPU32)[(rvalue >> 2) + 0 >>> 0] = result;
    break;

   case 15:
    throw new Error("complex ret marshalling nyi");

   default:
    throw new Error("Unexpected rtype " + rtype_id);
  }
}

function mono_wasm_webcil_range_read_js(handle, dst, off, len) {
  var G = globalThis;
  var insts = G.__monoWebcilInstances || (G.__monoWebcilInstances = []);
  var inst = insts[handle];
  if (!inst) {
    var mods = G.__monoWebcilModules;
    var mod = mods && mods[handle];
    if (!mod) return 0;
    inst = new WebAssembly.Instance(mod, {
      webcil: {
        memory: wasmMemory
      }
    });
    insts[handle] = inst;
  }
  inst.exports.getWebcilRange(dst, off, len);
  return 1;
}

function wjsw_js_funcidx(tis, n, out) {
  var a = (tis < 0 ? tis + 4294967296 : tis) / 4;
  var o = (out < 0 ? out + 4294967296 : out) / 4;
  var i, f, fi;
  for (i = 0; i < n; i++) {
    fi = -1;
    try {
      f = wasmTable.get((growMemViews(), HEAP32)[a + i >>> 0]);
      if (f) fi = Number(f.name);
    } catch (e) {
      fi = -1;
    }
    (growMemViews(), HEAP32)[o + i >>> 0] = (fi >= 0) ? fi : -1;
  }
}

function wjsw_js_capture(buf, cap, limit, total) {
  var st = Module.__wjsw;
  if (!st) st = Module.__wjsw = {
    inst: new WeakMap,
    main: null,
    cls: new Map
  };
  var sp = Error.prepareStackTrace, sl = Error.stackTraceLimit, cs = null, h = {};
  try {
    Error.stackTraceLimit = limit;
    Error.prepareStackTrace = function(e, s) {
      return s;
    };
    Error.captureStackTrace(h);
    cs = h.stack;
  } catch (e) {
    cs = null;
  } finally {
    Error.prepareStackTrace = sp;
    Error.stackTraceLimit = sl;
  }
  if (!cs || typeof cs.length !== "number") return -1;
  var p = (buf < 0 ? buf + 4294967296 : buf) / 4;
  (growMemViews(), HEAP32)[(total < 0 ? total + 4294967296 : total) / 4 >>> 0] = cs.length;
  var n = 0, i, c, t, pl, encl, k, s, x, nm;
  for (i = 0; i < cs.length; i++) {
    c = cs[i];
    try {
      t = c.getThis();
    } catch (e) {
      t = undefined;
    }
    if (!t || typeof t !== "object") continue;
    pl = st.inst.get(t);
    if (pl === undefined) {
      if (st.main === null) {
        s = c.getFileName();
        if (typeof s !== "string" || s.indexOf("wasm://wasm/dotnet.native.wasm") !== 0) continue;
        st.main = t;
      } else if (t !== st.main) {
        continue;
      }
    }
    encl = c.getEnclosingColumnNumber();
    k = 0;
    if (pl === undefined) {
      k = st.cls.get(encl);
      if (k === undefined) {
        nm = c.getFunctionName() || "";
        if (nm === "mono_interp_exec_method") k = -2; else if (nm === "mini_llvmonly_resume_exception_il_state") k = -3; else if (nm === "interp_run_clause_with_il_state") k = -4; else {
          s = String(c.toString());
          x = s.lastIndexOf("wasm-function[");
          k = x >= 0 ? parseInt(s.substring(x + 14), 10) : -1;
          if (!(k >= 0)) k = -1;
        }
        st.cls.set(encl, k);
      }
      if (k === -1) continue;
    }
    if (n >= cap) return -2;
    (growMemViews(), HEAP32)[p + 4 * n >>> 0] = pl === undefined ? 2 : 1;
    (growMemViews(), HEAP32)[p + 4 * n + 1 >>> 0] = pl === undefined ? k : pl;
    (growMemViews(), HEAP32)[p + 4 * n + 2 >>> 0] = encl;
    (growMemViews(), HEAP32)[p + 4 * n + 3 >>> 0] = c.getPosition();
    n++;
  }
  return n;
}

// Imports from the Wasm binary.
var _wasmfs_create_file, _perform_thread_dump, _ikvm_native_used_mb, _ikvm_gc_heap_mb, _ikvm_heap_top_mb, _sbrk, _ikvm_wasm_memory_mb, _install_thread_log_forwarder, _pthread_self, _malloc, _dump_jiterp_trace_heat, _mono_jiterp_get_trace_count, _mono_jiterp_get_trace_method, _mono_jiterp_get_trace_hit_count, _mono_jiterp_get_trace_is_compiled, _mono_jiterp_get_trace_abort_reason, _free, _managed_em_loop_callback, _htons, _ntohs, _memalign, _sin, _cos, _log, _pow, _log10, _exp, _atan2, _fflush, _atan, _sinf, _cosf, _tanf, _emscripten_glfw3_get_frame_count, _Emscripten_force_free, _SDL_malloc, _SDL_calloc, _SDL_realloc, _SDL_free, _SDLEmscriptenCameraPermissionOutcome, _SDLEmscriptenThreadIterate, _Emscripten_HandlePointerEnter, _Emscripten_HandlePointerLeave, _Emscripten_HandlePointerGeneric, _Emscripten_HandleMouseButtonUpGlobal, _Emscripten_SendDragEvent, _Emscripten_SendDragCompleteEvent, _Emscripten_SendDragTextEvent, _Emscripten_SendDragFileEvent, _Emscripten_HandleLockKeysCheck, _Emscripten_SendSystemThemeChangedEvent, _requestFullscreenThroughSDL, _emscripten_proxy_execute_queue, _wink_main_run_queue, _wink_set_device_lost, _posix_memalign, _fmaf, _fma, _log2f, _powf, _tanh, _tanhf, _log2, _logf, _expf, _atanf, _acosf, _asinf, _atan2f, _emscripten_stack_set_limits, _gex_wgsl_cache_load, _gex_wgsl_cache_budget, _gex_wgsl_cache_dump, _gex_wgsl_cache_stats, _gex_wgsl_cache_stats2, _emwgpuCreateBindGroup, _emwgpuCreateBindGroupLayout, _emwgpuCreateCommandBuffer, _emwgpuCreateCommandEncoder, _emwgpuCreateComputePassEncoder, _emwgpuCreateComputePipeline, _emwgpuCreateExternalTexture, _emwgpuCreatePipelineLayout, _emwgpuCreateQuerySet, _emwgpuCreateRenderBundle, _emwgpuCreateRenderBundleEncoder, _emwgpuCreateRenderPassEncoder, _emwgpuCreateRenderPipeline, _emwgpuCreateSampler, _emwgpuCreateSurface, _emwgpuCreateTexture, _emwgpuCreateTextureView, _emwgpuCreateAdapter, _emwgpuImportBuffer, _emwgpuCreateDevice, _emwgpuCreateQueue, _emwgpuCreateShaderModule, _emwgpuOnCompilationInfoCompleted, _emwgpuOnCreateComputePipelineCompleted, _emwgpuOnCreateRenderPipelineCompleted, _emwgpuOnDeviceLostCompleted, _emwgpuOnMapAsyncCompleted, _emwgpuOnPopErrorScopeCompleted, _emwgpuOnRequestAdapterCompleted, _emwgpuOnRequestDeviceCompleted, _emwgpuOnWorkDoneCompleted, _emwgpuOnUncapturedError, _acos, _acosh, _acoshf, _asin, _asinh, _asinhf, _atanh, _atanhf, _cosh, _coshf, _sinh, _sinhf, _tan, _log10f, _cbrtf, _fmod, _fmodf, _scalbn, _scalbnf, _SystemInteropJS_RegisterGCRoot, _SystemInteropJS_UnregisterGCRoot, _mono_wasm_add_assembly, _mono_wasm_add_webcil_range_assembly, _mono_wasm_add_satellite_assembly, _mono_wasm_setenv, _mono_wasm_getenv, _mono_wasm_load_runtime, _mono_wasm_invoke_jsexport, _mono_wasm_print_thread_dump, _mono_wasm_invoke_jsexport_async_post, _mono_wasm_invoke_jsexport_sync, _mono_wasm_invoke_jsexport_sync_send, _mono_wasm_synchronization_context_pump, _mono_wasm_string_from_utf16_ref, _mono_wasm_exec_regression, _mono_wasm_exit, _mono_wasm_set_main_args, _mono_wasm_strdup, _mono_wasm_parse_runtime_options, _mono_wasm_intern_string_ref, _mono_wasm_string_get_data_ref, _mono_wasm_write_managed_pointer_unsafe, _mono_wasm_copy_managed_pointer, _mono_wasm_init_finalizer_thread, _mono_wasm_i52_to_f64, _mono_wasm_u52_to_f64, _mono_wasm_f64_to_u52, _mono_wasm_f64_to_i52, _mono_wasm_method_get_full_name, _mono_wasm_method_get_name, _mono_wasm_method_get_name_ex, _mono_wasm_get_f32_unaligned, _mono_wasm_get_f64_unaligned, _mono_wasm_get_i32_unaligned, _mono_wasm_is_zero_page_reserved, _mono_wasm_read_as_bool_or_null_unsafe, _mono_wasm_assembly_load, _mono_wasm_assembly_find_class, _mono_wasm_assembly_find_method, _diag_trace_request, _diag_trace_take_request, _diag_set_step, _diag_get_step, _diag_set_step2, _diag_get_step2, _diag_stream_append, _diag_stream_len, _diag_stream_ptr, _diag_stream_mark_done, _diag_stream_is_done, _diag_stream_reset, _mono_aot_System_Memory_get_method, _mono_aot_corlib_get_method, _mono_aot_IKVM_ByteCode_get_method, _mono_aot_IKVM_Runtime_get_method, _mono_wasm_send_dbg_command_with_parms, _mono_wasm_send_dbg_command, _mono_wasm_jit_prof_stat, _mono_wasm_jit_snapshot, _mono_wasm_jit_dump_hot_edges, _mono_wasm_jit_dump_blockers, _mono_jiterp_register_jit_call_thunk, _mono_jiterp_entry_adopt_info, _mono_jiterp_interp_entry_set_slot, _mono_wasm_jit_slot_live, _emscripten_stack_get_current, _mono_wasm_jit_note_invalid_cast, _mono_jiterp_stackval_to_data, _mono_jiterp_stackval_from_data, _mono_jiterp_get_arg_offset, _mono_jiterp_overflow_check_i4, _mono_jiterp_overflow_check_u4, _mono_jiterp_ld_delegate_method_ptr, _mono_jiterp_interp_entry, _cbrt, _mono_jiterp_get_polling_required_address, _mono_jiterp_prof_enter, _mono_jiterp_prof_samplepoint, _mono_jiterp_prof_leave, _mono_jiterp_do_safepoint, _mono_jiterp_imethod_to_ftnptr, _mono_jiterp_enum_hasflag, _mono_jiterp_get_simd_intrinsic, _mono_jiterp_get_simd_opcode, _mono_jiterp_get_opcode_info, _mono_jiterp_placeholder_trace, _mono_jiterp_placeholder_jit_call, _mono_jiterp_get_interp_entry_func, _mono_wasm_jit_method_known_dead, _mono_jiterp_is_enabled, _mono_jiterp_allocate_table_entry, _mono_jiterp_encode_leb64_ref, _mono_jiterp_encode_leb52, _mono_jiterp_encode_leb_signed_boundary, _mono_jiterp_increase_entry_count, _mono_jiterp_object_unbox, _mono_jiterp_type_is_byref, _mono_jiterp_value_copy, _mono_jiterp_try_newobj_inlined, _mono_jiterp_try_newstr, _mono_jiterp_try_newarr, _mono_jiterp_gettype_ref, _mono_jiterp_has_parent_fast, _mono_jiterp_implements_interface, _mono_jiterp_is_special_interface, _mono_jiterp_implements_special_interface, _mono_jiterp_cast_v2, _mono_jiterp_localloc, _mono_jiterp_ldtsflda, _mono_jiterp_box_ref, _mono_jiterp_conv, _mono_jiterp_relop_fp, _mono_jiterp_get_size_of_stackval, _mono_jiterp_type_get_raw_value_size, _mono_jiterp_trace_bailout, _mono_jiterp_get_trace_bailout_count, _mono_jiterp_adjust_abort_count, _mono_jiterp_wasm_jit_entry_ok, _mono_jiterp_interp_entry_prologue, _mono_jiterp_get_opcode_value_table_entry, _mono_jiterp_record_trace_abort, _mono_jiterp_parse_option, _mono_jiterp_get_options_version, _mono_jiterp_get_options_as_json, _mono_jiterp_get_option_as_int, _mono_jiterp_object_has_component_size, _mono_jiterp_get_hashcode, _mono_jiterp_try_get_hashcode, _mono_jiterp_get_signature_has_this, _mono_jiterp_get_signature_return_type, _mono_jiterp_get_signature_param_count, _mono_jiterp_get_signature_params, _mono_jiterp_type_to_ldind, _mono_jiterp_type_to_stind, _mono_jiterp_get_array_rank, _mono_jiterp_get_array_element_size, _mono_jiterp_set_object_field, _mono_jiterp_debug_count, _mono_jiterp_stelem_ref, _mono_jiterp_get_member_offset, _mono_jiterp_get_counter, _mono_jiterp_modify_counter, _mono_jiterp_write_number_unaligned, _mono_jiterp_get_rejected_trace_count, _mono_jiterp_boost_back_branch_target, _mono_jiterp_is_imethod_var_address_taken, _mono_jiterp_initialize_table, _mono_jiterp_get_table_used, _mono_jiterp_get_table_capacity, _mono_jiterp_allocate_table_entries, _mono_jiterp_table_remaining, _mono_jiterp_tlqueue_next, _mono_jiterp_tlqueue_add, _mono_jiterp_tlqueue_clear, _mono_interp_pgo_load_table, _mono_interp_pgo_save_table, _mono_llvm_cpp_catch_exception, _mono_jiterp_begin_catch, _mono_jiterp_end_catch, _emscripten_main_runtime_thread_id, _mono_wasm_create_deputy_thread, _mono_wasm_create_io_thread, _mono_wasm_register_ui_thread, _mono_wasm_register_io_thread, _mono_threads_wasm_sync_run_in_target_thread_done, _mono_wasm_gc_lock, _mono_wasm_gc_unlock, _mono_print_method_from_ip, _mono_wasm_jit_get_counter, _mono_wasm_jit_dump_stats, _mono_wasm_jit_dump_dep_graph, _mono_wasm_jit_dump_bail_hist, _mono_wasm_jit_dump_residual_ring, _mono_wasm_jit_slot_live_ptr_addr, _mono_wasm_jit_slot_live_cap_addr, _mono_wasm_jit_worker_reuse, _mono_wasm_jit_liveness, _mono_wasm_jit_eslot_probe, _mono_wasm_jit_registry_count, _mono_wasm_jit_worker_action_addr, _mono_wasm_jit_edge_record, _mono_wasm_jit_edge_tick, _mono_wasm_jit_entry_sig, _mono_wasm_jit_lazy_interp, _mono_wasm_jit_lazy_bind, _wasm_load_icu_data, __emscripten_tls_init, _emscripten_builtin_memalign, __emscripten_run_callback_on_thread, __emscripten_set_offscreencanvas_size_on_thread, _memset, ___funcs_on_exit, __emscripten_thread_init, ___set_thread_state, __emscripten_thread_crashed, _emscripten_proxy_finish, __emscripten_run_js_on_main_thread_done, __emscripten_run_js_on_main_thread, __emscripten_thread_free_data, __emscripten_thread_exit, __emscripten_timeout, __emscripten_check_mailbox, ___trap, __emscripten_stack_restore, __emscripten_stack_alloc, __wasmfs_fetch_get_file_url, __wasmfs_fetch_get_chunk_size, _wasmfs_socket_on_open, _wasmfs_socket_on_data, _wasmfs_socket_on_end, _wasmfs_socket_on_drained, _wasmfs_socket_on_close, __wasmfs_read_file, __wasmfs_write_file, __wasmfs_mkdir, __wasmfs_rmdir, __wasmfs_open, __wasmfs_mknod, __wasmfs_unlink, __wasmfs_chdir, __wasmfs_symlink, __wasmfs_readlink, __wasmfs_write, __wasmfs_pwrite, __wasmfs_chmod, __wasmfs_fchmod, __wasmfs_lchmod, __wasmfs_llseek, __wasmfs_rename, __wasmfs_read, __wasmfs_pread, __wasmfs_truncate, __wasmfs_ftruncate, __wasmfs_close, __wasmfs_mmap, __wasmfs_msync, __wasmfs_munmap, __wasmfs_utime, __wasmfs_stat, __wasmfs_lstat, __wasmfs_mount, __wasmfs_identify, __wasmfs_readdir_start, __wasmfs_readdir_get, __wasmfs_readdir_finish, __wasmfs_get_cwd, _wasmfs_create_jsimpl_backend, _wasmfs_create_memory_backend, _wasmfs_opfs_stat, _wasmfs_opfs_stat_shape, _wasmfs_opfs_invalidate_negative_cache, _wasmfs_opfs_negative_stat, __wasmfs_opfs_record_entry, _wasmfs_unmount, ___stack_pointer, __indirect_function_table, ___cpp_exception, wasmTable;

function assignWasmExports(wasmExports) {
  _wasmfs_create_file = wasmExports["wasmfs_create_file"];
  _perform_thread_dump = Module["_perform_thread_dump"] = wasmExports["perform_thread_dump"];
  _ikvm_native_used_mb = Module["_ikvm_native_used_mb"] = wasmExports["ikvm_native_used_mb"];
  _ikvm_gc_heap_mb = Module["_ikvm_gc_heap_mb"] = wasmExports["ikvm_gc_heap_mb"];
  _ikvm_heap_top_mb = Module["_ikvm_heap_top_mb"] = wasmExports["ikvm_heap_top_mb"];
  _sbrk = Module["_sbrk"] = wasmExports["sbrk"];
  _ikvm_wasm_memory_mb = Module["_ikvm_wasm_memory_mb"] = wasmExports["ikvm_wasm_memory_mb"];
  _install_thread_log_forwarder = Module["_install_thread_log_forwarder"] = wasmExports["install_thread_log_forwarder"];
  _pthread_self = wasmExports["pthread_self"];
  _malloc = Module["_malloc"] = wasmExports["malloc"];
  _dump_jiterp_trace_heat = Module["_dump_jiterp_trace_heat"] = wasmExports["dump_jiterp_trace_heat"];
  _mono_jiterp_get_trace_count = Module["_mono_jiterp_get_trace_count"] = wasmExports["mono_jiterp_get_trace_count"];
  _mono_jiterp_get_trace_method = Module["_mono_jiterp_get_trace_method"] = wasmExports["mono_jiterp_get_trace_method"];
  _mono_jiterp_get_trace_hit_count = Module["_mono_jiterp_get_trace_hit_count"] = wasmExports["mono_jiterp_get_trace_hit_count"];
  _mono_jiterp_get_trace_is_compiled = Module["_mono_jiterp_get_trace_is_compiled"] = wasmExports["mono_jiterp_get_trace_is_compiled"];
  _mono_jiterp_get_trace_abort_reason = Module["_mono_jiterp_get_trace_abort_reason"] = wasmExports["mono_jiterp_get_trace_abort_reason"];
  _free = Module["_free"] = wasmExports["free"];
  _managed_em_loop_callback = Module["_managed_em_loop_callback"] = wasmExports["managed_em_loop_callback"];
  _htons = Module["_htons"] = wasmExports["htons"];
  _ntohs = Module["_ntohs"] = wasmExports["ntohs"];
  _memalign = Module["_memalign"] = wasmExports["memalign"];
  _sin = Module["_sin"] = wasmExports["sin"];
  _cos = Module["_cos"] = wasmExports["cos"];
  _log = Module["_log"] = wasmExports["log"];
  _pow = Module["_pow"] = wasmExports["pow"];
  _log10 = Module["_log10"] = wasmExports["log10"];
  _exp = Module["_exp"] = wasmExports["exp"];
  _atan2 = Module["_atan2"] = wasmExports["atan2"];
  _fflush = wasmExports["fflush"];
  _atan = Module["_atan"] = wasmExports["atan"];
  _sinf = Module["_sinf"] = wasmExports["sinf"];
  _cosf = Module["_cosf"] = wasmExports["cosf"];
  _tanf = Module["_tanf"] = wasmExports["tanf"];
  _emscripten_glfw3_get_frame_count = Module["_emscripten_glfw3_get_frame_count"] = wasmExports["emscripten_glfw3_get_frame_count"];
  _Emscripten_force_free = Module["_Emscripten_force_free"] = wasmExports["Emscripten_force_free"];
  _SDL_malloc = Module["_SDL_malloc"] = wasmExports["SDL_malloc"];
  _SDL_calloc = Module["_SDL_calloc"] = wasmExports["SDL_calloc"];
  _SDL_realloc = Module["_SDL_realloc"] = wasmExports["SDL_realloc"];
  _SDL_free = Module["_SDL_free"] = wasmExports["SDL_free"];
  _SDLEmscriptenCameraPermissionOutcome = Module["_SDLEmscriptenCameraPermissionOutcome"] = wasmExports["SDLEmscriptenCameraPermissionOutcome"];
  _SDLEmscriptenThreadIterate = Module["_SDLEmscriptenThreadIterate"] = wasmExports["SDLEmscriptenThreadIterate"];
  _Emscripten_HandlePointerEnter = Module["_Emscripten_HandlePointerEnter"] = wasmExports["Emscripten_HandlePointerEnter"];
  _Emscripten_HandlePointerLeave = Module["_Emscripten_HandlePointerLeave"] = wasmExports["Emscripten_HandlePointerLeave"];
  _Emscripten_HandlePointerGeneric = Module["_Emscripten_HandlePointerGeneric"] = wasmExports["Emscripten_HandlePointerGeneric"];
  _Emscripten_HandleMouseButtonUpGlobal = Module["_Emscripten_HandleMouseButtonUpGlobal"] = wasmExports["Emscripten_HandleMouseButtonUpGlobal"];
  _Emscripten_SendDragEvent = Module["_Emscripten_SendDragEvent"] = wasmExports["Emscripten_SendDragEvent"];
  _Emscripten_SendDragCompleteEvent = Module["_Emscripten_SendDragCompleteEvent"] = wasmExports["Emscripten_SendDragCompleteEvent"];
  _Emscripten_SendDragTextEvent = Module["_Emscripten_SendDragTextEvent"] = wasmExports["Emscripten_SendDragTextEvent"];
  _Emscripten_SendDragFileEvent = Module["_Emscripten_SendDragFileEvent"] = wasmExports["Emscripten_SendDragFileEvent"];
  _Emscripten_HandleLockKeysCheck = Module["_Emscripten_HandleLockKeysCheck"] = wasmExports["Emscripten_HandleLockKeysCheck"];
  _Emscripten_SendSystemThemeChangedEvent = Module["_Emscripten_SendSystemThemeChangedEvent"] = wasmExports["Emscripten_SendSystemThemeChangedEvent"];
  _requestFullscreenThroughSDL = Module["_requestFullscreenThroughSDL"] = wasmExports["requestFullscreenThroughSDL"];
  _emscripten_proxy_execute_queue = wasmExports["emscripten_proxy_execute_queue"];
  _wink_main_run_queue = wasmExports["wink_main_run_queue"];
  _wink_set_device_lost = wasmExports["wink_set_device_lost"];
  _posix_memalign = Module["_posix_memalign"] = wasmExports["posix_memalign"];
  _fmaf = Module["_fmaf"] = wasmExports["fmaf"];
  _fma = Module["_fma"] = wasmExports["fma"];
  _log2f = Module["_log2f"] = wasmExports["log2f"];
  _powf = Module["_powf"] = wasmExports["powf"];
  _tanh = Module["_tanh"] = wasmExports["tanh"];
  _tanhf = Module["_tanhf"] = wasmExports["tanhf"];
  _log2 = Module["_log2"] = wasmExports["log2"];
  _logf = Module["_logf"] = wasmExports["logf"];
  _expf = Module["_expf"] = wasmExports["expf"];
  _atanf = Module["_atanf"] = wasmExports["atanf"];
  _acosf = Module["_acosf"] = wasmExports["acosf"];
  _asinf = Module["_asinf"] = wasmExports["asinf"];
  _atan2f = Module["_atan2f"] = wasmExports["atan2f"];
  _emscripten_stack_set_limits = wasmExports["emscripten_stack_set_limits"];
  _gex_wgsl_cache_load = Module["_gex_wgsl_cache_load"] = wasmExports["gex_wgsl_cache_load"];
  _gex_wgsl_cache_budget = Module["_gex_wgsl_cache_budget"] = wasmExports["gex_wgsl_cache_budget"];
  _gex_wgsl_cache_dump = Module["_gex_wgsl_cache_dump"] = wasmExports["gex_wgsl_cache_dump"];
  _gex_wgsl_cache_stats = Module["_gex_wgsl_cache_stats"] = wasmExports["gex_wgsl_cache_stats"];
  _gex_wgsl_cache_stats2 = Module["_gex_wgsl_cache_stats2"] = wasmExports["gex_wgsl_cache_stats2"];
  _emwgpuCreateBindGroup = wasmExports["emwgpuCreateBindGroup"];
  _emwgpuCreateBindGroupLayout = wasmExports["emwgpuCreateBindGroupLayout"];
  _emwgpuCreateCommandBuffer = wasmExports["emwgpuCreateCommandBuffer"];
  _emwgpuCreateCommandEncoder = wasmExports["emwgpuCreateCommandEncoder"];
  _emwgpuCreateComputePassEncoder = wasmExports["emwgpuCreateComputePassEncoder"];
  _emwgpuCreateComputePipeline = wasmExports["emwgpuCreateComputePipeline"];
  _emwgpuCreateExternalTexture = wasmExports["emwgpuCreateExternalTexture"];
  _emwgpuCreatePipelineLayout = wasmExports["emwgpuCreatePipelineLayout"];
  _emwgpuCreateQuerySet = wasmExports["emwgpuCreateQuerySet"];
  _emwgpuCreateRenderBundle = wasmExports["emwgpuCreateRenderBundle"];
  _emwgpuCreateRenderBundleEncoder = wasmExports["emwgpuCreateRenderBundleEncoder"];
  _emwgpuCreateRenderPassEncoder = wasmExports["emwgpuCreateRenderPassEncoder"];
  _emwgpuCreateRenderPipeline = wasmExports["emwgpuCreateRenderPipeline"];
  _emwgpuCreateSampler = wasmExports["emwgpuCreateSampler"];
  _emwgpuCreateSurface = wasmExports["emwgpuCreateSurface"];
  _emwgpuCreateTexture = wasmExports["emwgpuCreateTexture"];
  _emwgpuCreateTextureView = wasmExports["emwgpuCreateTextureView"];
  _emwgpuCreateAdapter = wasmExports["emwgpuCreateAdapter"];
  _emwgpuImportBuffer = wasmExports["emwgpuImportBuffer"];
  _emwgpuCreateDevice = wasmExports["emwgpuCreateDevice"];
  _emwgpuCreateQueue = wasmExports["emwgpuCreateQueue"];
  _emwgpuCreateShaderModule = wasmExports["emwgpuCreateShaderModule"];
  _emwgpuOnCompilationInfoCompleted = wasmExports["emwgpuOnCompilationInfoCompleted"];
  _emwgpuOnCreateComputePipelineCompleted = wasmExports["emwgpuOnCreateComputePipelineCompleted"];
  _emwgpuOnCreateRenderPipelineCompleted = wasmExports["emwgpuOnCreateRenderPipelineCompleted"];
  _emwgpuOnDeviceLostCompleted = wasmExports["emwgpuOnDeviceLostCompleted"];
  _emwgpuOnMapAsyncCompleted = wasmExports["emwgpuOnMapAsyncCompleted"];
  _emwgpuOnPopErrorScopeCompleted = wasmExports["emwgpuOnPopErrorScopeCompleted"];
  _emwgpuOnRequestAdapterCompleted = wasmExports["emwgpuOnRequestAdapterCompleted"];
  _emwgpuOnRequestDeviceCompleted = wasmExports["emwgpuOnRequestDeviceCompleted"];
  _emwgpuOnWorkDoneCompleted = wasmExports["emwgpuOnWorkDoneCompleted"];
  _emwgpuOnUncapturedError = wasmExports["emwgpuOnUncapturedError"];
  _acos = Module["_acos"] = wasmExports["acos"];
  _acosh = Module["_acosh"] = wasmExports["acosh"];
  _acoshf = Module["_acoshf"] = wasmExports["acoshf"];
  _asin = Module["_asin"] = wasmExports["asin"];
  _asinh = Module["_asinh"] = wasmExports["asinh"];
  _asinhf = Module["_asinhf"] = wasmExports["asinhf"];
  _atanh = Module["_atanh"] = wasmExports["atanh"];
  _atanhf = Module["_atanhf"] = wasmExports["atanhf"];
  _cosh = Module["_cosh"] = wasmExports["cosh"];
  _coshf = Module["_coshf"] = wasmExports["coshf"];
  _sinh = Module["_sinh"] = wasmExports["sinh"];
  _sinhf = Module["_sinhf"] = wasmExports["sinhf"];
  _tan = Module["_tan"] = wasmExports["tan"];
  _log10f = Module["_log10f"] = wasmExports["log10f"];
  _cbrtf = Module["_cbrtf"] = wasmExports["cbrtf"];
  _fmod = Module["_fmod"] = wasmExports["fmod"];
  _fmodf = Module["_fmodf"] = wasmExports["fmodf"];
  _scalbn = Module["_scalbn"] = wasmExports["scalbn"];
  _scalbnf = Module["_scalbnf"] = wasmExports["scalbnf"];
  _SystemInteropJS_RegisterGCRoot = Module["_SystemInteropJS_RegisterGCRoot"] = wasmExports["SystemInteropJS_RegisterGCRoot"];
  _SystemInteropJS_UnregisterGCRoot = Module["_SystemInteropJS_UnregisterGCRoot"] = wasmExports["SystemInteropJS_UnregisterGCRoot"];
  _mono_wasm_add_assembly = Module["_mono_wasm_add_assembly"] = wasmExports["mono_wasm_add_assembly"];
  _mono_wasm_add_webcil_range_assembly = Module["_mono_wasm_add_webcil_range_assembly"] = wasmExports["mono_wasm_add_webcil_range_assembly"];
  _mono_wasm_add_satellite_assembly = Module["_mono_wasm_add_satellite_assembly"] = wasmExports["mono_wasm_add_satellite_assembly"];
  _mono_wasm_setenv = Module["_mono_wasm_setenv"] = wasmExports["mono_wasm_setenv"];
  _mono_wasm_getenv = Module["_mono_wasm_getenv"] = wasmExports["mono_wasm_getenv"];
  _mono_wasm_load_runtime = Module["_mono_wasm_load_runtime"] = wasmExports["mono_wasm_load_runtime"];
  _mono_wasm_invoke_jsexport = Module["_mono_wasm_invoke_jsexport"] = wasmExports["mono_wasm_invoke_jsexport"];
  _mono_wasm_print_thread_dump = Module["_mono_wasm_print_thread_dump"] = wasmExports["mono_wasm_print_thread_dump"];
  _mono_wasm_invoke_jsexport_async_post = Module["_mono_wasm_invoke_jsexport_async_post"] = wasmExports["mono_wasm_invoke_jsexport_async_post"];
  _mono_wasm_invoke_jsexport_sync = Module["_mono_wasm_invoke_jsexport_sync"] = wasmExports["mono_wasm_invoke_jsexport_sync"];
  _mono_wasm_invoke_jsexport_sync_send = Module["_mono_wasm_invoke_jsexport_sync_send"] = wasmExports["mono_wasm_invoke_jsexport_sync_send"];
  _mono_wasm_synchronization_context_pump = Module["_mono_wasm_synchronization_context_pump"] = wasmExports["mono_wasm_synchronization_context_pump"];
  _mono_wasm_string_from_utf16_ref = Module["_mono_wasm_string_from_utf16_ref"] = wasmExports["mono_wasm_string_from_utf16_ref"];
  _mono_wasm_exec_regression = Module["_mono_wasm_exec_regression"] = wasmExports["mono_wasm_exec_regression"];
  _mono_wasm_exit = Module["_mono_wasm_exit"] = wasmExports["mono_wasm_exit"];
  _mono_wasm_set_main_args = Module["_mono_wasm_set_main_args"] = wasmExports["mono_wasm_set_main_args"];
  _mono_wasm_strdup = Module["_mono_wasm_strdup"] = wasmExports["mono_wasm_strdup"];
  _mono_wasm_parse_runtime_options = Module["_mono_wasm_parse_runtime_options"] = wasmExports["mono_wasm_parse_runtime_options"];
  _mono_wasm_intern_string_ref = Module["_mono_wasm_intern_string_ref"] = wasmExports["mono_wasm_intern_string_ref"];
  _mono_wasm_string_get_data_ref = Module["_mono_wasm_string_get_data_ref"] = wasmExports["mono_wasm_string_get_data_ref"];
  _mono_wasm_write_managed_pointer_unsafe = Module["_mono_wasm_write_managed_pointer_unsafe"] = wasmExports["mono_wasm_write_managed_pointer_unsafe"];
  _mono_wasm_copy_managed_pointer = Module["_mono_wasm_copy_managed_pointer"] = wasmExports["mono_wasm_copy_managed_pointer"];
  _mono_wasm_init_finalizer_thread = Module["_mono_wasm_init_finalizer_thread"] = wasmExports["mono_wasm_init_finalizer_thread"];
  _mono_wasm_i52_to_f64 = Module["_mono_wasm_i52_to_f64"] = wasmExports["mono_wasm_i52_to_f64"];
  _mono_wasm_u52_to_f64 = Module["_mono_wasm_u52_to_f64"] = wasmExports["mono_wasm_u52_to_f64"];
  _mono_wasm_f64_to_u52 = Module["_mono_wasm_f64_to_u52"] = wasmExports["mono_wasm_f64_to_u52"];
  _mono_wasm_f64_to_i52 = Module["_mono_wasm_f64_to_i52"] = wasmExports["mono_wasm_f64_to_i52"];
  _mono_wasm_method_get_full_name = Module["_mono_wasm_method_get_full_name"] = wasmExports["mono_wasm_method_get_full_name"];
  _mono_wasm_method_get_name = Module["_mono_wasm_method_get_name"] = wasmExports["mono_wasm_method_get_name"];
  _mono_wasm_method_get_name_ex = Module["_mono_wasm_method_get_name_ex"] = wasmExports["mono_wasm_method_get_name_ex"];
  _mono_wasm_get_f32_unaligned = Module["_mono_wasm_get_f32_unaligned"] = wasmExports["mono_wasm_get_f32_unaligned"];
  _mono_wasm_get_f64_unaligned = Module["_mono_wasm_get_f64_unaligned"] = wasmExports["mono_wasm_get_f64_unaligned"];
  _mono_wasm_get_i32_unaligned = Module["_mono_wasm_get_i32_unaligned"] = wasmExports["mono_wasm_get_i32_unaligned"];
  _mono_wasm_is_zero_page_reserved = Module["_mono_wasm_is_zero_page_reserved"] = wasmExports["mono_wasm_is_zero_page_reserved"];
  _mono_wasm_read_as_bool_or_null_unsafe = Module["_mono_wasm_read_as_bool_or_null_unsafe"] = wasmExports["mono_wasm_read_as_bool_or_null_unsafe"];
  _mono_wasm_assembly_load = Module["_mono_wasm_assembly_load"] = wasmExports["mono_wasm_assembly_load"];
  _mono_wasm_assembly_find_class = Module["_mono_wasm_assembly_find_class"] = wasmExports["mono_wasm_assembly_find_class"];
  _mono_wasm_assembly_find_method = Module["_mono_wasm_assembly_find_method"] = wasmExports["mono_wasm_assembly_find_method"];
  _diag_trace_request = Module["_diag_trace_request"] = wasmExports["diag_trace_request"];
  _diag_trace_take_request = Module["_diag_trace_take_request"] = wasmExports["diag_trace_take_request"];
  _diag_set_step = Module["_diag_set_step"] = wasmExports["diag_set_step"];
  _diag_get_step = Module["_diag_get_step"] = wasmExports["diag_get_step"];
  _diag_set_step2 = Module["_diag_set_step2"] = wasmExports["diag_set_step2"];
  _diag_get_step2 = Module["_diag_get_step2"] = wasmExports["diag_get_step2"];
  _diag_stream_append = Module["_diag_stream_append"] = wasmExports["diag_stream_append"];
  _diag_stream_len = Module["_diag_stream_len"] = wasmExports["diag_stream_len"];
  _diag_stream_ptr = Module["_diag_stream_ptr"] = wasmExports["diag_stream_ptr"];
  _diag_stream_mark_done = Module["_diag_stream_mark_done"] = wasmExports["diag_stream_mark_done"];
  _diag_stream_is_done = Module["_diag_stream_is_done"] = wasmExports["diag_stream_is_done"];
  _diag_stream_reset = Module["_diag_stream_reset"] = wasmExports["diag_stream_reset"];
  _mono_aot_System_Memory_get_method = Module["_mono_aot_System_Memory_get_method"] = wasmExports["mono_aot_System_Memory_get_method"];
  _mono_aot_corlib_get_method = Module["_mono_aot_corlib_get_method"] = wasmExports["mono_aot_corlib_get_method"];
  _mono_aot_IKVM_ByteCode_get_method = Module["_mono_aot_IKVM_ByteCode_get_method"] = wasmExports["mono_aot_IKVM_ByteCode_get_method"];
  _mono_aot_IKVM_Runtime_get_method = Module["_mono_aot_IKVM_Runtime_get_method"] = wasmExports["mono_aot_IKVM_Runtime_get_method"];
  _mono_wasm_send_dbg_command_with_parms = Module["_mono_wasm_send_dbg_command_with_parms"] = wasmExports["mono_wasm_send_dbg_command_with_parms"];
  _mono_wasm_send_dbg_command = Module["_mono_wasm_send_dbg_command"] = wasmExports["mono_wasm_send_dbg_command"];
  _mono_wasm_jit_prof_stat = Module["_mono_wasm_jit_prof_stat"] = wasmExports["mono_wasm_jit_prof_stat"];
  _mono_wasm_jit_snapshot = Module["_mono_wasm_jit_snapshot"] = wasmExports["mono_wasm_jit_snapshot"];
  _mono_wasm_jit_dump_hot_edges = Module["_mono_wasm_jit_dump_hot_edges"] = wasmExports["mono_wasm_jit_dump_hot_edges"];
  _mono_wasm_jit_dump_blockers = Module["_mono_wasm_jit_dump_blockers"] = wasmExports["mono_wasm_jit_dump_blockers"];
  _mono_jiterp_register_jit_call_thunk = Module["_mono_jiterp_register_jit_call_thunk"] = wasmExports["mono_jiterp_register_jit_call_thunk"];
  _mono_jiterp_entry_adopt_info = Module["_mono_jiterp_entry_adopt_info"] = wasmExports["mono_jiterp_entry_adopt_info"];
  _mono_jiterp_interp_entry_set_slot = Module["_mono_jiterp_interp_entry_set_slot"] = wasmExports["mono_jiterp_interp_entry_set_slot"];
  _mono_wasm_jit_slot_live = Module["_mono_wasm_jit_slot_live"] = wasmExports["mono_wasm_jit_slot_live"];
  _emscripten_stack_get_current = wasmExports["emscripten_stack_get_current"];
  _mono_wasm_jit_note_invalid_cast = Module["_mono_wasm_jit_note_invalid_cast"] = wasmExports["mono_wasm_jit_note_invalid_cast"];
  _mono_jiterp_stackval_to_data = Module["_mono_jiterp_stackval_to_data"] = wasmExports["mono_jiterp_stackval_to_data"];
  _mono_jiterp_stackval_from_data = Module["_mono_jiterp_stackval_from_data"] = wasmExports["mono_jiterp_stackval_from_data"];
  _mono_jiterp_get_arg_offset = Module["_mono_jiterp_get_arg_offset"] = wasmExports["mono_jiterp_get_arg_offset"];
  _mono_jiterp_overflow_check_i4 = Module["_mono_jiterp_overflow_check_i4"] = wasmExports["mono_jiterp_overflow_check_i4"];
  _mono_jiterp_overflow_check_u4 = Module["_mono_jiterp_overflow_check_u4"] = wasmExports["mono_jiterp_overflow_check_u4"];
  _mono_jiterp_ld_delegate_method_ptr = Module["_mono_jiterp_ld_delegate_method_ptr"] = wasmExports["mono_jiterp_ld_delegate_method_ptr"];
  _mono_jiterp_interp_entry = Module["_mono_jiterp_interp_entry"] = wasmExports["mono_jiterp_interp_entry"];
  _cbrt = Module["_cbrt"] = wasmExports["cbrt"];
  _mono_jiterp_get_polling_required_address = Module["_mono_jiterp_get_polling_required_address"] = wasmExports["mono_jiterp_get_polling_required_address"];
  _mono_jiterp_prof_enter = Module["_mono_jiterp_prof_enter"] = wasmExports["mono_jiterp_prof_enter"];
  _mono_jiterp_prof_samplepoint = Module["_mono_jiterp_prof_samplepoint"] = wasmExports["mono_jiterp_prof_samplepoint"];
  _mono_jiterp_prof_leave = Module["_mono_jiterp_prof_leave"] = wasmExports["mono_jiterp_prof_leave"];
  _mono_jiterp_do_safepoint = Module["_mono_jiterp_do_safepoint"] = wasmExports["mono_jiterp_do_safepoint"];
  _mono_jiterp_imethod_to_ftnptr = Module["_mono_jiterp_imethod_to_ftnptr"] = wasmExports["mono_jiterp_imethod_to_ftnptr"];
  _mono_jiterp_enum_hasflag = Module["_mono_jiterp_enum_hasflag"] = wasmExports["mono_jiterp_enum_hasflag"];
  _mono_jiterp_get_simd_intrinsic = Module["_mono_jiterp_get_simd_intrinsic"] = wasmExports["mono_jiterp_get_simd_intrinsic"];
  _mono_jiterp_get_simd_opcode = Module["_mono_jiterp_get_simd_opcode"] = wasmExports["mono_jiterp_get_simd_opcode"];
  _mono_jiterp_get_opcode_info = Module["_mono_jiterp_get_opcode_info"] = wasmExports["mono_jiterp_get_opcode_info"];
  _mono_jiterp_placeholder_trace = Module["_mono_jiterp_placeholder_trace"] = wasmExports["mono_jiterp_placeholder_trace"];
  _mono_jiterp_placeholder_jit_call = Module["_mono_jiterp_placeholder_jit_call"] = wasmExports["mono_jiterp_placeholder_jit_call"];
  _mono_jiterp_get_interp_entry_func = Module["_mono_jiterp_get_interp_entry_func"] = wasmExports["mono_jiterp_get_interp_entry_func"];
  _mono_wasm_jit_method_known_dead = Module["_mono_wasm_jit_method_known_dead"] = wasmExports["mono_wasm_jit_method_known_dead"];
  _mono_jiterp_is_enabled = Module["_mono_jiterp_is_enabled"] = wasmExports["mono_jiterp_is_enabled"];
  _mono_jiterp_allocate_table_entry = Module["_mono_jiterp_allocate_table_entry"] = wasmExports["mono_jiterp_allocate_table_entry"];
  _mono_jiterp_encode_leb64_ref = Module["_mono_jiterp_encode_leb64_ref"] = wasmExports["mono_jiterp_encode_leb64_ref"];
  _mono_jiterp_encode_leb52 = Module["_mono_jiterp_encode_leb52"] = wasmExports["mono_jiterp_encode_leb52"];
  _mono_jiterp_encode_leb_signed_boundary = Module["_mono_jiterp_encode_leb_signed_boundary"] = wasmExports["mono_jiterp_encode_leb_signed_boundary"];
  _mono_jiterp_increase_entry_count = Module["_mono_jiterp_increase_entry_count"] = wasmExports["mono_jiterp_increase_entry_count"];
  _mono_jiterp_object_unbox = Module["_mono_jiterp_object_unbox"] = wasmExports["mono_jiterp_object_unbox"];
  _mono_jiterp_type_is_byref = Module["_mono_jiterp_type_is_byref"] = wasmExports["mono_jiterp_type_is_byref"];
  _mono_jiterp_value_copy = Module["_mono_jiterp_value_copy"] = wasmExports["mono_jiterp_value_copy"];
  _mono_jiterp_try_newobj_inlined = Module["_mono_jiterp_try_newobj_inlined"] = wasmExports["mono_jiterp_try_newobj_inlined"];
  _mono_jiterp_try_newstr = Module["_mono_jiterp_try_newstr"] = wasmExports["mono_jiterp_try_newstr"];
  _mono_jiterp_try_newarr = Module["_mono_jiterp_try_newarr"] = wasmExports["mono_jiterp_try_newarr"];
  _mono_jiterp_gettype_ref = Module["_mono_jiterp_gettype_ref"] = wasmExports["mono_jiterp_gettype_ref"];
  _mono_jiterp_has_parent_fast = Module["_mono_jiterp_has_parent_fast"] = wasmExports["mono_jiterp_has_parent_fast"];
  _mono_jiterp_implements_interface = Module["_mono_jiterp_implements_interface"] = wasmExports["mono_jiterp_implements_interface"];
  _mono_jiterp_is_special_interface = Module["_mono_jiterp_is_special_interface"] = wasmExports["mono_jiterp_is_special_interface"];
  _mono_jiterp_implements_special_interface = Module["_mono_jiterp_implements_special_interface"] = wasmExports["mono_jiterp_implements_special_interface"];
  _mono_jiterp_cast_v2 = Module["_mono_jiterp_cast_v2"] = wasmExports["mono_jiterp_cast_v2"];
  _mono_jiterp_localloc = Module["_mono_jiterp_localloc"] = wasmExports["mono_jiterp_localloc"];
  _mono_jiterp_ldtsflda = Module["_mono_jiterp_ldtsflda"] = wasmExports["mono_jiterp_ldtsflda"];
  _mono_jiterp_box_ref = Module["_mono_jiterp_box_ref"] = wasmExports["mono_jiterp_box_ref"];
  _mono_jiterp_conv = Module["_mono_jiterp_conv"] = wasmExports["mono_jiterp_conv"];
  _mono_jiterp_relop_fp = Module["_mono_jiterp_relop_fp"] = wasmExports["mono_jiterp_relop_fp"];
  _mono_jiterp_get_size_of_stackval = Module["_mono_jiterp_get_size_of_stackval"] = wasmExports["mono_jiterp_get_size_of_stackval"];
  _mono_jiterp_type_get_raw_value_size = Module["_mono_jiterp_type_get_raw_value_size"] = wasmExports["mono_jiterp_type_get_raw_value_size"];
  _mono_jiterp_trace_bailout = Module["_mono_jiterp_trace_bailout"] = wasmExports["mono_jiterp_trace_bailout"];
  _mono_jiterp_get_trace_bailout_count = Module["_mono_jiterp_get_trace_bailout_count"] = wasmExports["mono_jiterp_get_trace_bailout_count"];
  _mono_jiterp_adjust_abort_count = Module["_mono_jiterp_adjust_abort_count"] = wasmExports["mono_jiterp_adjust_abort_count"];
  _mono_jiterp_wasm_jit_entry_ok = Module["_mono_jiterp_wasm_jit_entry_ok"] = wasmExports["mono_jiterp_wasm_jit_entry_ok"];
  _mono_jiterp_interp_entry_prologue = Module["_mono_jiterp_interp_entry_prologue"] = wasmExports["mono_jiterp_interp_entry_prologue"];
  _mono_jiterp_get_opcode_value_table_entry = Module["_mono_jiterp_get_opcode_value_table_entry"] = wasmExports["mono_jiterp_get_opcode_value_table_entry"];
  _mono_jiterp_record_trace_abort = Module["_mono_jiterp_record_trace_abort"] = wasmExports["mono_jiterp_record_trace_abort"];
  _mono_jiterp_parse_option = Module["_mono_jiterp_parse_option"] = wasmExports["mono_jiterp_parse_option"];
  _mono_jiterp_get_options_version = Module["_mono_jiterp_get_options_version"] = wasmExports["mono_jiterp_get_options_version"];
  _mono_jiterp_get_options_as_json = Module["_mono_jiterp_get_options_as_json"] = wasmExports["mono_jiterp_get_options_as_json"];
  _mono_jiterp_get_option_as_int = Module["_mono_jiterp_get_option_as_int"] = wasmExports["mono_jiterp_get_option_as_int"];
  _mono_jiterp_object_has_component_size = Module["_mono_jiterp_object_has_component_size"] = wasmExports["mono_jiterp_object_has_component_size"];
  _mono_jiterp_get_hashcode = Module["_mono_jiterp_get_hashcode"] = wasmExports["mono_jiterp_get_hashcode"];
  _mono_jiterp_try_get_hashcode = Module["_mono_jiterp_try_get_hashcode"] = wasmExports["mono_jiterp_try_get_hashcode"];
  _mono_jiterp_get_signature_has_this = Module["_mono_jiterp_get_signature_has_this"] = wasmExports["mono_jiterp_get_signature_has_this"];
  _mono_jiterp_get_signature_return_type = Module["_mono_jiterp_get_signature_return_type"] = wasmExports["mono_jiterp_get_signature_return_type"];
  _mono_jiterp_get_signature_param_count = Module["_mono_jiterp_get_signature_param_count"] = wasmExports["mono_jiterp_get_signature_param_count"];
  _mono_jiterp_get_signature_params = Module["_mono_jiterp_get_signature_params"] = wasmExports["mono_jiterp_get_signature_params"];
  _mono_jiterp_type_to_ldind = Module["_mono_jiterp_type_to_ldind"] = wasmExports["mono_jiterp_type_to_ldind"];
  _mono_jiterp_type_to_stind = Module["_mono_jiterp_type_to_stind"] = wasmExports["mono_jiterp_type_to_stind"];
  _mono_jiterp_get_array_rank = Module["_mono_jiterp_get_array_rank"] = wasmExports["mono_jiterp_get_array_rank"];
  _mono_jiterp_get_array_element_size = Module["_mono_jiterp_get_array_element_size"] = wasmExports["mono_jiterp_get_array_element_size"];
  _mono_jiterp_set_object_field = Module["_mono_jiterp_set_object_field"] = wasmExports["mono_jiterp_set_object_field"];
  _mono_jiterp_debug_count = Module["_mono_jiterp_debug_count"] = wasmExports["mono_jiterp_debug_count"];
  _mono_jiterp_stelem_ref = Module["_mono_jiterp_stelem_ref"] = wasmExports["mono_jiterp_stelem_ref"];
  _mono_jiterp_get_member_offset = Module["_mono_jiterp_get_member_offset"] = wasmExports["mono_jiterp_get_member_offset"];
  _mono_jiterp_get_counter = Module["_mono_jiterp_get_counter"] = wasmExports["mono_jiterp_get_counter"];
  _mono_jiterp_modify_counter = Module["_mono_jiterp_modify_counter"] = wasmExports["mono_jiterp_modify_counter"];
  _mono_jiterp_write_number_unaligned = Module["_mono_jiterp_write_number_unaligned"] = wasmExports["mono_jiterp_write_number_unaligned"];
  _mono_jiterp_get_rejected_trace_count = Module["_mono_jiterp_get_rejected_trace_count"] = wasmExports["mono_jiterp_get_rejected_trace_count"];
  _mono_jiterp_boost_back_branch_target = Module["_mono_jiterp_boost_back_branch_target"] = wasmExports["mono_jiterp_boost_back_branch_target"];
  _mono_jiterp_is_imethod_var_address_taken = Module["_mono_jiterp_is_imethod_var_address_taken"] = wasmExports["mono_jiterp_is_imethod_var_address_taken"];
  _mono_jiterp_initialize_table = Module["_mono_jiterp_initialize_table"] = wasmExports["mono_jiterp_initialize_table"];
  _mono_jiterp_get_table_used = Module["_mono_jiterp_get_table_used"] = wasmExports["mono_jiterp_get_table_used"];
  _mono_jiterp_get_table_capacity = Module["_mono_jiterp_get_table_capacity"] = wasmExports["mono_jiterp_get_table_capacity"];
  _mono_jiterp_allocate_table_entries = Module["_mono_jiterp_allocate_table_entries"] = wasmExports["mono_jiterp_allocate_table_entries"];
  _mono_jiterp_table_remaining = Module["_mono_jiterp_table_remaining"] = wasmExports["mono_jiterp_table_remaining"];
  _mono_jiterp_tlqueue_next = Module["_mono_jiterp_tlqueue_next"] = wasmExports["mono_jiterp_tlqueue_next"];
  _mono_jiterp_tlqueue_add = Module["_mono_jiterp_tlqueue_add"] = wasmExports["mono_jiterp_tlqueue_add"];
  _mono_jiterp_tlqueue_clear = Module["_mono_jiterp_tlqueue_clear"] = wasmExports["mono_jiterp_tlqueue_clear"];
  _mono_interp_pgo_load_table = Module["_mono_interp_pgo_load_table"] = wasmExports["mono_interp_pgo_load_table"];
  _mono_interp_pgo_save_table = Module["_mono_interp_pgo_save_table"] = wasmExports["mono_interp_pgo_save_table"];
  _mono_llvm_cpp_catch_exception = Module["_mono_llvm_cpp_catch_exception"] = wasmExports["mono_llvm_cpp_catch_exception"];
  _mono_jiterp_begin_catch = Module["_mono_jiterp_begin_catch"] = wasmExports["mono_jiterp_begin_catch"];
  _mono_jiterp_end_catch = Module["_mono_jiterp_end_catch"] = wasmExports["mono_jiterp_end_catch"];
  _emscripten_main_runtime_thread_id = Module["_emscripten_main_runtime_thread_id"] = wasmExports["emscripten_main_runtime_thread_id"];
  _mono_wasm_create_deputy_thread = Module["_mono_wasm_create_deputy_thread"] = wasmExports["mono_wasm_create_deputy_thread"];
  _mono_wasm_create_io_thread = Module["_mono_wasm_create_io_thread"] = wasmExports["mono_wasm_create_io_thread"];
  _mono_wasm_register_ui_thread = Module["_mono_wasm_register_ui_thread"] = wasmExports["mono_wasm_register_ui_thread"];
  _mono_wasm_register_io_thread = Module["_mono_wasm_register_io_thread"] = wasmExports["mono_wasm_register_io_thread"];
  _mono_threads_wasm_sync_run_in_target_thread_done = Module["_mono_threads_wasm_sync_run_in_target_thread_done"] = wasmExports["mono_threads_wasm_sync_run_in_target_thread_done"];
  _mono_wasm_gc_lock = Module["_mono_wasm_gc_lock"] = wasmExports["mono_wasm_gc_lock"];
  _mono_wasm_gc_unlock = Module["_mono_wasm_gc_unlock"] = wasmExports["mono_wasm_gc_unlock"];
  _mono_print_method_from_ip = Module["_mono_print_method_from_ip"] = wasmExports["mono_print_method_from_ip"];
  _mono_wasm_jit_get_counter = Module["_mono_wasm_jit_get_counter"] = wasmExports["mono_wasm_jit_get_counter"];
  _mono_wasm_jit_dump_stats = Module["_mono_wasm_jit_dump_stats"] = wasmExports["mono_wasm_jit_dump_stats"];
  _mono_wasm_jit_dump_dep_graph = Module["_mono_wasm_jit_dump_dep_graph"] = wasmExports["mono_wasm_jit_dump_dep_graph"];
  _mono_wasm_jit_dump_bail_hist = Module["_mono_wasm_jit_dump_bail_hist"] = wasmExports["mono_wasm_jit_dump_bail_hist"];
  _mono_wasm_jit_dump_residual_ring = Module["_mono_wasm_jit_dump_residual_ring"] = wasmExports["mono_wasm_jit_dump_residual_ring"];
  _mono_wasm_jit_slot_live_ptr_addr = Module["_mono_wasm_jit_slot_live_ptr_addr"] = wasmExports["mono_wasm_jit_slot_live_ptr_addr"];
  _mono_wasm_jit_slot_live_cap_addr = Module["_mono_wasm_jit_slot_live_cap_addr"] = wasmExports["mono_wasm_jit_slot_live_cap_addr"];
  _mono_wasm_jit_worker_reuse = Module["_mono_wasm_jit_worker_reuse"] = wasmExports["mono_wasm_jit_worker_reuse"];
  _mono_wasm_jit_liveness = Module["_mono_wasm_jit_liveness"] = wasmExports["mono_wasm_jit_liveness"];
  _mono_wasm_jit_eslot_probe = Module["_mono_wasm_jit_eslot_probe"] = wasmExports["mono_wasm_jit_eslot_probe"];
  _mono_wasm_jit_registry_count = Module["_mono_wasm_jit_registry_count"] = wasmExports["mono_wasm_jit_registry_count"];
  _mono_wasm_jit_worker_action_addr = Module["_mono_wasm_jit_worker_action_addr"] = wasmExports["mono_wasm_jit_worker_action_addr"];
  _mono_wasm_jit_edge_record = Module["_mono_wasm_jit_edge_record"] = wasmExports["mono_wasm_jit_edge_record"];
  _mono_wasm_jit_edge_tick = Module["_mono_wasm_jit_edge_tick"] = wasmExports["mono_wasm_jit_edge_tick"];
  _mono_wasm_jit_entry_sig = Module["_mono_wasm_jit_entry_sig"] = wasmExports["mono_wasm_jit_entry_sig"];
  _mono_wasm_jit_lazy_interp = Module["_mono_wasm_jit_lazy_interp"] = wasmExports["mono_wasm_jit_lazy_interp"];
  _mono_wasm_jit_lazy_bind = Module["_mono_wasm_jit_lazy_bind"] = wasmExports["mono_wasm_jit_lazy_bind"];
  _wasm_load_icu_data = Module["_wasm_load_icu_data"] = wasmExports["wasm_load_icu_data"];
  __emscripten_tls_init = wasmExports["_emscripten_tls_init"];
  _emscripten_builtin_memalign = wasmExports["emscripten_builtin_memalign"];
  __emscripten_run_callback_on_thread = wasmExports["_emscripten_run_callback_on_thread"];
  __emscripten_set_offscreencanvas_size_on_thread = wasmExports["_emscripten_set_offscreencanvas_size_on_thread"];
  _memset = Module["_memset"] = wasmExports["memset"];
  ___funcs_on_exit = wasmExports["__funcs_on_exit"];
  __emscripten_thread_init = wasmExports["_emscripten_thread_init"];
  ___set_thread_state = wasmExports["__set_thread_state"];
  __emscripten_thread_crashed = wasmExports["_emscripten_thread_crashed"];
  _emscripten_proxy_finish = wasmExports["emscripten_proxy_finish"];
  __emscripten_run_js_on_main_thread_done = wasmExports["_emscripten_run_js_on_main_thread_done"];
  __emscripten_run_js_on_main_thread = wasmExports["_emscripten_run_js_on_main_thread"];
  __emscripten_thread_free_data = wasmExports["_emscripten_thread_free_data"];
  __emscripten_thread_exit = wasmExports["_emscripten_thread_exit"];
  __emscripten_timeout = wasmExports["_emscripten_timeout"];
  __emscripten_check_mailbox = wasmExports["_emscripten_check_mailbox"];
  ___trap = wasmExports["__trap"];
  __emscripten_stack_restore = wasmExports["_emscripten_stack_restore"];
  __emscripten_stack_alloc = wasmExports["_emscripten_stack_alloc"];
  __wasmfs_fetch_get_file_url = wasmExports["_wasmfs_fetch_get_file_url"];
  __wasmfs_fetch_get_chunk_size = wasmExports["_wasmfs_fetch_get_chunk_size"];
  _wasmfs_socket_on_open = wasmExports["wasmfs_socket_on_open"];
  _wasmfs_socket_on_data = wasmExports["wasmfs_socket_on_data"];
  _wasmfs_socket_on_end = wasmExports["wasmfs_socket_on_end"];
  _wasmfs_socket_on_drained = wasmExports["wasmfs_socket_on_drained"];
  _wasmfs_socket_on_close = wasmExports["wasmfs_socket_on_close"];
  __wasmfs_read_file = wasmExports["_wasmfs_read_file"];
  __wasmfs_write_file = wasmExports["_wasmfs_write_file"];
  __wasmfs_mkdir = wasmExports["_wasmfs_mkdir"];
  __wasmfs_rmdir = wasmExports["_wasmfs_rmdir"];
  __wasmfs_open = wasmExports["_wasmfs_open"];
  __wasmfs_mknod = wasmExports["_wasmfs_mknod"];
  __wasmfs_unlink = wasmExports["_wasmfs_unlink"];
  __wasmfs_chdir = wasmExports["_wasmfs_chdir"];
  __wasmfs_symlink = wasmExports["_wasmfs_symlink"];
  __wasmfs_readlink = wasmExports["_wasmfs_readlink"];
  __wasmfs_write = wasmExports["_wasmfs_write"];
  __wasmfs_pwrite = wasmExports["_wasmfs_pwrite"];
  __wasmfs_chmod = wasmExports["_wasmfs_chmod"];
  __wasmfs_fchmod = wasmExports["_wasmfs_fchmod"];
  __wasmfs_lchmod = wasmExports["_wasmfs_lchmod"];
  __wasmfs_llseek = wasmExports["_wasmfs_llseek"];
  __wasmfs_rename = wasmExports["_wasmfs_rename"];
  __wasmfs_read = wasmExports["_wasmfs_read"];
  __wasmfs_pread = wasmExports["_wasmfs_pread"];
  __wasmfs_truncate = wasmExports["_wasmfs_truncate"];
  __wasmfs_ftruncate = wasmExports["_wasmfs_ftruncate"];
  __wasmfs_close = wasmExports["_wasmfs_close"];
  __wasmfs_mmap = wasmExports["_wasmfs_mmap"];
  __wasmfs_msync = wasmExports["_wasmfs_msync"];
  __wasmfs_munmap = wasmExports["_wasmfs_munmap"];
  __wasmfs_utime = wasmExports["_wasmfs_utime"];
  __wasmfs_stat = wasmExports["_wasmfs_stat"];
  __wasmfs_lstat = wasmExports["_wasmfs_lstat"];
  __wasmfs_mount = wasmExports["_wasmfs_mount"];
  __wasmfs_identify = wasmExports["_wasmfs_identify"];
  __wasmfs_readdir_start = wasmExports["_wasmfs_readdir_start"];
  __wasmfs_readdir_get = wasmExports["_wasmfs_readdir_get"];
  __wasmfs_readdir_finish = wasmExports["_wasmfs_readdir_finish"];
  __wasmfs_get_cwd = wasmExports["_wasmfs_get_cwd"];
  _wasmfs_create_jsimpl_backend = wasmExports["wasmfs_create_jsimpl_backend"];
  _wasmfs_create_memory_backend = wasmExports["wasmfs_create_memory_backend"];
  _wasmfs_opfs_stat = Module["_wasmfs_opfs_stat"] = wasmExports["wasmfs_opfs_stat"];
  _wasmfs_opfs_stat_shape = Module["_wasmfs_opfs_stat_shape"] = wasmExports["wasmfs_opfs_stat_shape"];
  _wasmfs_opfs_invalidate_negative_cache = Module["_wasmfs_opfs_invalidate_negative_cache"] = wasmExports["wasmfs_opfs_invalidate_negative_cache"];
  _wasmfs_opfs_negative_stat = Module["_wasmfs_opfs_negative_stat"] = wasmExports["wasmfs_opfs_negative_stat"];
  __wasmfs_opfs_record_entry = wasmExports["_wasmfs_opfs_record_entry"];
  _wasmfs_unmount = wasmExports["wasmfs_unmount"];
  ___stack_pointer = Module["___stack_pointer"] = wasmExports["__stack_pointer"];
  __indirect_function_table = wasmTable = wasmExports["__indirect_function_table"];
  ___cpp_exception = Module["___cpp_exception"] = wasmExports["__cpp_exception"];
}

var wasmImports;

function assignWasmImports() {
  wasmImports = {
    /** @export */ SystemInteropJS_CancelPromise: _SystemInteropJS_CancelPromise,
    /** @export */ SystemInteropJS_InstallWebWorkerInteropImpl: _SystemInteropJS_InstallWebWorkerInteropImpl,
    /** @export */ SystemInteropJS_InvokeJSFunction: _SystemInteropJS_InvokeJSFunction,
    /** @export */ SystemInteropJS_InvokeJSImportSync: _SystemInteropJS_InvokeJSImportSync,
    /** @export */ SystemInteropJS_ReleaseCSOwnedObject: _SystemInteropJS_ReleaseCSOwnedObject,
    /** @export */ SystemInteropJS_ResolveOrRejectPromise: _SystemInteropJS_ResolveOrRejectPromise,
    /** @export */ SystemInteropJS_UninstallWebWorkerInterop: _SystemInteropJS_UninstallWebWorkerInterop,
    /** @export */ SystemJS_ConsoleClear: _SystemJS_ConsoleClear,
    /** @export */ SystemJS_GetCurrentProcessId: _SystemJS_GetCurrentProcessId,
    /** @export */ SystemJS_GetLocaleInfo: _SystemJS_GetLocaleInfo,
    /** @export */ SystemJS_RandomBytes: _SystemJS_RandomBytes,
    /** @export */ SystemJS_WarnAboutBlockingWait: _SystemJS_WarnAboutBlockingWait,
    /** @export */ __assert_fail: ___assert_fail,
    /** @export */ __call_sighandler: ___call_sighandler,
    /** @export */ __pthread_create_js: ___pthread_create_js,
    /** @export */ _abort_js: __abort_js,
    /** @export */ _emscripten_get_progname: __emscripten_get_progname,
    /** @export */ _emscripten_init_main_thread_js: __emscripten_init_main_thread_js,
    /** @export */ _emscripten_notify_mailbox_postmessage: __emscripten_notify_mailbox_postmessage,
    /** @export */ _emscripten_receive_on_main_thread_js: __emscripten_receive_on_main_thread_js,
    /** @export */ _emscripten_runtime_keepalive_clear: __emscripten_runtime_keepalive_clear,
    /** @export */ _emscripten_thread_cleanup: __emscripten_thread_cleanup,
    /** @export */ _emscripten_thread_mailbox_await: __emscripten_thread_mailbox_await,
    /** @export */ _emscripten_thread_set_strongref: __emscripten_thread_set_strongref,
    /** @export */ _gmtime_js: __gmtime_js,
    /** @export */ _localtime_js: __localtime_js,
    /** @export */ _setitimer_js: __setitimer_js,
    /** @export */ _tzset_js: __tzset_js,
    /** @export */ _wasmfs_copy_preloaded_file_data: __wasmfs_copy_preloaded_file_data,
    /** @export */ _wasmfs_create_fetch_backend_js: __wasmfs_create_fetch_backend_js,
    /** @export */ _wasmfs_get_num_preloaded_dirs: __wasmfs_get_num_preloaded_dirs,
    /** @export */ _wasmfs_get_num_preloaded_files: __wasmfs_get_num_preloaded_files,
    /** @export */ _wasmfs_get_preloaded_child_path: __wasmfs_get_preloaded_child_path,
    /** @export */ _wasmfs_get_preloaded_file_mode: __wasmfs_get_preloaded_file_mode,
    /** @export */ _wasmfs_get_preloaded_file_size: __wasmfs_get_preloaded_file_size,
    /** @export */ _wasmfs_get_preloaded_parent_path: __wasmfs_get_preloaded_parent_path,
    /** @export */ _wasmfs_get_preloaded_path_name: __wasmfs_get_preloaded_path_name,
    /** @export */ _wasmfs_jsimpl_alloc_file: __wasmfs_jsimpl_alloc_file,
    /** @export */ _wasmfs_jsimpl_async_alloc_file: __wasmfs_jsimpl_async_alloc_file,
    /** @export */ _wasmfs_jsimpl_async_free_file: __wasmfs_jsimpl_async_free_file,
    /** @export */ _wasmfs_jsimpl_async_get_size: __wasmfs_jsimpl_async_get_size,
    /** @export */ _wasmfs_jsimpl_async_read: __wasmfs_jsimpl_async_read,
    /** @export */ _wasmfs_jsimpl_async_write: __wasmfs_jsimpl_async_write,
    /** @export */ _wasmfs_jsimpl_free_file: __wasmfs_jsimpl_free_file,
    /** @export */ _wasmfs_jsimpl_get_size: __wasmfs_jsimpl_get_size,
    /** @export */ _wasmfs_jsimpl_read: __wasmfs_jsimpl_read,
    /** @export */ _wasmfs_jsimpl_set_size: __wasmfs_jsimpl_set_size,
    /** @export */ _wasmfs_jsimpl_write: __wasmfs_jsimpl_write,
    /** @export */ _wasmfs_opfs_close_access: __wasmfs_opfs_close_access,
    /** @export */ _wasmfs_opfs_close_blob: __wasmfs_opfs_close_blob,
    /** @export */ _wasmfs_opfs_flush_access: __wasmfs_opfs_flush_access,
    /** @export */ _wasmfs_opfs_free_directory: __wasmfs_opfs_free_directory,
    /** @export */ _wasmfs_opfs_free_file: __wasmfs_opfs_free_file,
    /** @export */ _wasmfs_opfs_get_child: __wasmfs_opfs_get_child,
    /** @export */ _wasmfs_opfs_get_entries: __wasmfs_opfs_get_entries,
    /** @export */ _wasmfs_opfs_get_size_access: __wasmfs_opfs_get_size_access,
    /** @export */ _wasmfs_opfs_get_size_blob: __wasmfs_opfs_get_size_blob,
    /** @export */ _wasmfs_opfs_get_size_file: __wasmfs_opfs_get_size_file,
    /** @export */ _wasmfs_opfs_init_root_directory: __wasmfs_opfs_init_root_directory,
    /** @export */ _wasmfs_opfs_insert_directory: __wasmfs_opfs_insert_directory,
    /** @export */ _wasmfs_opfs_insert_file: __wasmfs_opfs_insert_file,
    /** @export */ _wasmfs_opfs_move_file: __wasmfs_opfs_move_file,
    /** @export */ _wasmfs_opfs_open_access: __wasmfs_opfs_open_access,
    /** @export */ _wasmfs_opfs_open_blob: __wasmfs_opfs_open_blob,
    /** @export */ _wasmfs_opfs_open_shared_access: __wasmfs_opfs_open_shared_access,
    /** @export */ _wasmfs_opfs_read_access: __wasmfs_opfs_read_access,
    /** @export */ _wasmfs_opfs_read_blob: __wasmfs_opfs_read_blob,
    /** @export */ _wasmfs_opfs_remove_child: __wasmfs_opfs_remove_child,
    /** @export */ _wasmfs_opfs_set_size_access: __wasmfs_opfs_set_size_access,
    /** @export */ _wasmfs_opfs_set_size_file: __wasmfs_opfs_set_size_file,
    /** @export */ _wasmfs_opfs_write_access: __wasmfs_opfs_write_access,
    /** @export */ _wasmfs_socket_close: __wasmfs_socket_close,
    /** @export */ _wasmfs_socket_connect: __wasmfs_socket_connect,
    /** @export */ _wasmfs_socket_resume: __wasmfs_socket_resume,
    /** @export */ _wasmfs_socket_send: __wasmfs_socket_send,
    /** @export */ _wasmfs_socket_shutdown: __wasmfs_socket_shutdown,
    /** @export */ _wasmfs_socket_thread_init: __wasmfs_socket_thread_init,
    /** @export */ _wasmfs_stdin_get_char: __wasmfs_stdin_get_char,
    /** @export */ _wasmfs_thread_utils_heartbeat: __wasmfs_thread_utils_heartbeat,
    /** @export */ clock_res_get: _clock_res_get,
    /** @export */ clock_time_get: _clock_time_get,
    /** @export */ emscripten_asm_const_async_on_main_thread: _emscripten_asm_const_async_on_main_thread,
    /** @export */ emscripten_asm_const_double_sync_on_main_thread: _emscripten_asm_const_double_sync_on_main_thread,
    /** @export */ emscripten_asm_const_int: _emscripten_asm_const_int,
    /** @export */ emscripten_asm_const_int_sync_on_main_thread: _emscripten_asm_const_int_sync_on_main_thread,
    /** @export */ emscripten_asm_const_ptr_sync_on_main_thread: _emscripten_asm_const_ptr_sync_on_main_thread,
    /** @export */ emscripten_cancel_main_loop: _emscripten_cancel_main_loop,
    /** @export */ emscripten_check_blocking_allowed: _emscripten_check_blocking_allowed,
    /** @export */ emscripten_console_error: _emscripten_console_error,
    /** @export */ emscripten_console_log: _emscripten_console_log,
    /** @export */ emscripten_date_now: _emscripten_date_now,
    /** @export */ emscripten_err: _emscripten_err,
    /** @export */ emscripten_exit_fullscreen: _emscripten_exit_fullscreen,
    /** @export */ emscripten_exit_pointerlock: _emscripten_exit_pointerlock,
    /** @export */ emscripten_exit_with_live_runtime: _emscripten_exit_with_live_runtime,
    /** @export */ emscripten_force_exit: _emscripten_force_exit,
    /** @export */ emscripten_get_canvas_element_size: _emscripten_get_canvas_element_size,
    /** @export */ emscripten_get_device_pixel_ratio: _emscripten_get_device_pixel_ratio,
    /** @export */ emscripten_get_element_css_size: _emscripten_get_element_css_size,
    /** @export */ emscripten_get_fullscreen_status: _emscripten_get_fullscreen_status,
    /** @export */ emscripten_get_gamepad_status: _emscripten_get_gamepad_status,
    /** @export */ emscripten_get_heap_max: _emscripten_get_heap_max,
    /** @export */ emscripten_get_main_loop_timing: _emscripten_get_main_loop_timing,
    /** @export */ emscripten_get_now: _emscripten_get_now,
    /** @export */ emscripten_get_num_gamepads: _emscripten_get_num_gamepads,
    /** @export */ emscripten_get_screen_size: _emscripten_get_screen_size,
    /** @export */ emscripten_glActiveTexture: _emscripten_glActiveTexture,
    /** @export */ emscripten_glAttachShader: _emscripten_glAttachShader,
    /** @export */ emscripten_glBeginQueryEXT: _emscripten_glBeginQueryEXT,
    /** @export */ emscripten_glBindAttribLocation: _emscripten_glBindAttribLocation,
    /** @export */ emscripten_glBindBuffer: _emscripten_glBindBuffer,
    /** @export */ emscripten_glBindFramebuffer: _emscripten_glBindFramebuffer,
    /** @export */ emscripten_glBindRenderbuffer: _emscripten_glBindRenderbuffer,
    /** @export */ emscripten_glBindTexture: _emscripten_glBindTexture,
    /** @export */ emscripten_glBindVertexArrayOES: _emscripten_glBindVertexArrayOES,
    /** @export */ emscripten_glBlendColor: _emscripten_glBlendColor,
    /** @export */ emscripten_glBlendEquation: _emscripten_glBlendEquation,
    /** @export */ emscripten_glBlendEquationSeparate: _emscripten_glBlendEquationSeparate,
    /** @export */ emscripten_glBlendFunc: _emscripten_glBlendFunc,
    /** @export */ emscripten_glBlendFuncSeparate: _emscripten_glBlendFuncSeparate,
    /** @export */ emscripten_glBufferData: _emscripten_glBufferData,
    /** @export */ emscripten_glBufferSubData: _emscripten_glBufferSubData,
    /** @export */ emscripten_glCheckFramebufferStatus: _emscripten_glCheckFramebufferStatus,
    /** @export */ emscripten_glClear: _emscripten_glClear,
    /** @export */ emscripten_glClearColor: _emscripten_glClearColor,
    /** @export */ emscripten_glClearDepthf: _emscripten_glClearDepthf,
    /** @export */ emscripten_glClearStencil: _emscripten_glClearStencil,
    /** @export */ emscripten_glClipControlEXT: _emscripten_glClipControlEXT,
    /** @export */ emscripten_glColorMask: _emscripten_glColorMask,
    /** @export */ emscripten_glCompileShader: _emscripten_glCompileShader,
    /** @export */ emscripten_glCompressedTexImage2D: _emscripten_glCompressedTexImage2D,
    /** @export */ emscripten_glCompressedTexSubImage2D: _emscripten_glCompressedTexSubImage2D,
    /** @export */ emscripten_glCopyTexImage2D: _emscripten_glCopyTexImage2D,
    /** @export */ emscripten_glCopyTexSubImage2D: _emscripten_glCopyTexSubImage2D,
    /** @export */ emscripten_glCreateProgram: _emscripten_glCreateProgram,
    /** @export */ emscripten_glCreateShader: _emscripten_glCreateShader,
    /** @export */ emscripten_glCullFace: _emscripten_glCullFace,
    /** @export */ emscripten_glDeleteBuffers: _emscripten_glDeleteBuffers,
    /** @export */ emscripten_glDeleteFramebuffers: _emscripten_glDeleteFramebuffers,
    /** @export */ emscripten_glDeleteProgram: _emscripten_glDeleteProgram,
    /** @export */ emscripten_glDeleteQueriesEXT: _emscripten_glDeleteQueriesEXT,
    /** @export */ emscripten_glDeleteRenderbuffers: _emscripten_glDeleteRenderbuffers,
    /** @export */ emscripten_glDeleteShader: _emscripten_glDeleteShader,
    /** @export */ emscripten_glDeleteTextures: _emscripten_glDeleteTextures,
    /** @export */ emscripten_glDeleteVertexArraysOES: _emscripten_glDeleteVertexArraysOES,
    /** @export */ emscripten_glDepthFunc: _emscripten_glDepthFunc,
    /** @export */ emscripten_glDepthMask: _emscripten_glDepthMask,
    /** @export */ emscripten_glDepthRangef: _emscripten_glDepthRangef,
    /** @export */ emscripten_glDetachShader: _emscripten_glDetachShader,
    /** @export */ emscripten_glDisable: _emscripten_glDisable,
    /** @export */ emscripten_glDisableVertexAttribArray: _emscripten_glDisableVertexAttribArray,
    /** @export */ emscripten_glDrawArrays: _emscripten_glDrawArrays,
    /** @export */ emscripten_glDrawArraysInstancedANGLE: _emscripten_glDrawArraysInstancedANGLE,
    /** @export */ emscripten_glDrawBuffersWEBGL: _emscripten_glDrawBuffersWEBGL,
    /** @export */ emscripten_glDrawElements: _emscripten_glDrawElements,
    /** @export */ emscripten_glDrawElementsInstancedANGLE: _emscripten_glDrawElementsInstancedANGLE,
    /** @export */ emscripten_glEnable: _emscripten_glEnable,
    /** @export */ emscripten_glEnableVertexAttribArray: _emscripten_glEnableVertexAttribArray,
    /** @export */ emscripten_glEndQueryEXT: _emscripten_glEndQueryEXT,
    /** @export */ emscripten_glFinish: _emscripten_glFinish,
    /** @export */ emscripten_glFlush: _emscripten_glFlush,
    /** @export */ emscripten_glFramebufferRenderbuffer: _emscripten_glFramebufferRenderbuffer,
    /** @export */ emscripten_glFramebufferTexture2D: _emscripten_glFramebufferTexture2D,
    /** @export */ emscripten_glFrontFace: _emscripten_glFrontFace,
    /** @export */ emscripten_glGenBuffers: _emscripten_glGenBuffers,
    /** @export */ emscripten_glGenFramebuffers: _emscripten_glGenFramebuffers,
    /** @export */ emscripten_glGenQueriesEXT: _emscripten_glGenQueriesEXT,
    /** @export */ emscripten_glGenRenderbuffers: _emscripten_glGenRenderbuffers,
    /** @export */ emscripten_glGenTextures: _emscripten_glGenTextures,
    /** @export */ emscripten_glGenVertexArraysOES: _emscripten_glGenVertexArraysOES,
    /** @export */ emscripten_glGenerateMipmap: _emscripten_glGenerateMipmap,
    /** @export */ emscripten_glGetActiveAttrib: _emscripten_glGetActiveAttrib,
    /** @export */ emscripten_glGetActiveUniform: _emscripten_glGetActiveUniform,
    /** @export */ emscripten_glGetAttachedShaders: _emscripten_glGetAttachedShaders,
    /** @export */ emscripten_glGetAttribLocation: _emscripten_glGetAttribLocation,
    /** @export */ emscripten_glGetBooleanv: _emscripten_glGetBooleanv,
    /** @export */ emscripten_glGetBufferParameteriv: _emscripten_glGetBufferParameteriv,
    /** @export */ emscripten_glGetError: _emscripten_glGetError,
    /** @export */ emscripten_glGetFloatv: _emscripten_glGetFloatv,
    /** @export */ emscripten_glGetFramebufferAttachmentParameteriv: _emscripten_glGetFramebufferAttachmentParameteriv,
    /** @export */ emscripten_glGetIntegerv: _emscripten_glGetIntegerv,
    /** @export */ emscripten_glGetProgramInfoLog: _emscripten_glGetProgramInfoLog,
    /** @export */ emscripten_glGetProgramiv: _emscripten_glGetProgramiv,
    /** @export */ emscripten_glGetQueryObjecti64vEXT: _emscripten_glGetQueryObjecti64vEXT,
    /** @export */ emscripten_glGetQueryObjectivEXT: _emscripten_glGetQueryObjectivEXT,
    /** @export */ emscripten_glGetQueryObjectui64vEXT: _emscripten_glGetQueryObjectui64vEXT,
    /** @export */ emscripten_glGetQueryObjectuivEXT: _emscripten_glGetQueryObjectuivEXT,
    /** @export */ emscripten_glGetQueryivEXT: _emscripten_glGetQueryivEXT,
    /** @export */ emscripten_glGetRenderbufferParameteriv: _emscripten_glGetRenderbufferParameteriv,
    /** @export */ emscripten_glGetShaderInfoLog: _emscripten_glGetShaderInfoLog,
    /** @export */ emscripten_glGetShaderPrecisionFormat: _emscripten_glGetShaderPrecisionFormat,
    /** @export */ emscripten_glGetShaderSource: _emscripten_glGetShaderSource,
    /** @export */ emscripten_glGetShaderiv: _emscripten_glGetShaderiv,
    /** @export */ emscripten_glGetString: _emscripten_glGetString,
    /** @export */ emscripten_glGetTexParameterfv: _emscripten_glGetTexParameterfv,
    /** @export */ emscripten_glGetTexParameteriv: _emscripten_glGetTexParameteriv,
    /** @export */ emscripten_glGetUniformLocation: _emscripten_glGetUniformLocation,
    /** @export */ emscripten_glGetUniformfv: _emscripten_glGetUniformfv,
    /** @export */ emscripten_glGetUniformiv: _emscripten_glGetUniformiv,
    /** @export */ emscripten_glGetVertexAttribPointerv: _emscripten_glGetVertexAttribPointerv,
    /** @export */ emscripten_glGetVertexAttribfv: _emscripten_glGetVertexAttribfv,
    /** @export */ emscripten_glGetVertexAttribiv: _emscripten_glGetVertexAttribiv,
    /** @export */ emscripten_glHint: _emscripten_glHint,
    /** @export */ emscripten_glIsBuffer: _emscripten_glIsBuffer,
    /** @export */ emscripten_glIsEnabled: _emscripten_glIsEnabled,
    /** @export */ emscripten_glIsFramebuffer: _emscripten_glIsFramebuffer,
    /** @export */ emscripten_glIsProgram: _emscripten_glIsProgram,
    /** @export */ emscripten_glIsQueryEXT: _emscripten_glIsQueryEXT,
    /** @export */ emscripten_glIsRenderbuffer: _emscripten_glIsRenderbuffer,
    /** @export */ emscripten_glIsShader: _emscripten_glIsShader,
    /** @export */ emscripten_glIsTexture: _emscripten_glIsTexture,
    /** @export */ emscripten_glIsVertexArrayOES: _emscripten_glIsVertexArrayOES,
    /** @export */ emscripten_glLineWidth: _emscripten_glLineWidth,
    /** @export */ emscripten_glLinkProgram: _emscripten_glLinkProgram,
    /** @export */ emscripten_glPixelStorei: _emscripten_glPixelStorei,
    /** @export */ emscripten_glPolygonModeWEBGL: _emscripten_glPolygonModeWEBGL,
    /** @export */ emscripten_glPolygonOffset: _emscripten_glPolygonOffset,
    /** @export */ emscripten_glPolygonOffsetClampEXT: _emscripten_glPolygonOffsetClampEXT,
    /** @export */ emscripten_glQueryCounterEXT: _emscripten_glQueryCounterEXT,
    /** @export */ emscripten_glReadPixels: _emscripten_glReadPixels,
    /** @export */ emscripten_glReleaseShaderCompiler: _emscripten_glReleaseShaderCompiler,
    /** @export */ emscripten_glRenderbufferStorage: _emscripten_glRenderbufferStorage,
    /** @export */ emscripten_glSampleCoverage: _emscripten_glSampleCoverage,
    /** @export */ emscripten_glScissor: _emscripten_glScissor,
    /** @export */ emscripten_glShaderBinary: _emscripten_glShaderBinary,
    /** @export */ emscripten_glShaderSource: _emscripten_glShaderSource,
    /** @export */ emscripten_glStencilFunc: _emscripten_glStencilFunc,
    /** @export */ emscripten_glStencilFuncSeparate: _emscripten_glStencilFuncSeparate,
    /** @export */ emscripten_glStencilMask: _emscripten_glStencilMask,
    /** @export */ emscripten_glStencilMaskSeparate: _emscripten_glStencilMaskSeparate,
    /** @export */ emscripten_glStencilOp: _emscripten_glStencilOp,
    /** @export */ emscripten_glStencilOpSeparate: _emscripten_glStencilOpSeparate,
    /** @export */ emscripten_glTexImage2D: _emscripten_glTexImage2D,
    /** @export */ emscripten_glTexParameterf: _emscripten_glTexParameterf,
    /** @export */ emscripten_glTexParameterfv: _emscripten_glTexParameterfv,
    /** @export */ emscripten_glTexParameteri: _emscripten_glTexParameteri,
    /** @export */ emscripten_glTexParameteriv: _emscripten_glTexParameteriv,
    /** @export */ emscripten_glTexSubImage2D: _emscripten_glTexSubImage2D,
    /** @export */ emscripten_glUniform1f: _emscripten_glUniform1f,
    /** @export */ emscripten_glUniform1fv: _emscripten_glUniform1fv,
    /** @export */ emscripten_glUniform1i: _emscripten_glUniform1i,
    /** @export */ emscripten_glUniform1iv: _emscripten_glUniform1iv,
    /** @export */ emscripten_glUniform2f: _emscripten_glUniform2f,
    /** @export */ emscripten_glUniform2fv: _emscripten_glUniform2fv,
    /** @export */ emscripten_glUniform2i: _emscripten_glUniform2i,
    /** @export */ emscripten_glUniform2iv: _emscripten_glUniform2iv,
    /** @export */ emscripten_glUniform3f: _emscripten_glUniform3f,
    /** @export */ emscripten_glUniform3fv: _emscripten_glUniform3fv,
    /** @export */ emscripten_glUniform3i: _emscripten_glUniform3i,
    /** @export */ emscripten_glUniform3iv: _emscripten_glUniform3iv,
    /** @export */ emscripten_glUniform4f: _emscripten_glUniform4f,
    /** @export */ emscripten_glUniform4fv: _emscripten_glUniform4fv,
    /** @export */ emscripten_glUniform4i: _emscripten_glUniform4i,
    /** @export */ emscripten_glUniform4iv: _emscripten_glUniform4iv,
    /** @export */ emscripten_glUniformMatrix2fv: _emscripten_glUniformMatrix2fv,
    /** @export */ emscripten_glUniformMatrix3fv: _emscripten_glUniformMatrix3fv,
    /** @export */ emscripten_glUniformMatrix4fv: _emscripten_glUniformMatrix4fv,
    /** @export */ emscripten_glUseProgram: _emscripten_glUseProgram,
    /** @export */ emscripten_glValidateProgram: _emscripten_glValidateProgram,
    /** @export */ emscripten_glVertexAttrib1f: _emscripten_glVertexAttrib1f,
    /** @export */ emscripten_glVertexAttrib1fv: _emscripten_glVertexAttrib1fv,
    /** @export */ emscripten_glVertexAttrib2f: _emscripten_glVertexAttrib2f,
    /** @export */ emscripten_glVertexAttrib2fv: _emscripten_glVertexAttrib2fv,
    /** @export */ emscripten_glVertexAttrib3f: _emscripten_glVertexAttrib3f,
    /** @export */ emscripten_glVertexAttrib3fv: _emscripten_glVertexAttrib3fv,
    /** @export */ emscripten_glVertexAttrib4f: _emscripten_glVertexAttrib4f,
    /** @export */ emscripten_glVertexAttrib4fv: _emscripten_glVertexAttrib4fv,
    /** @export */ emscripten_glVertexAttribDivisorANGLE: _emscripten_glVertexAttribDivisorANGLE,
    /** @export */ emscripten_glVertexAttribPointer: _emscripten_glVertexAttribPointer,
    /** @export */ emscripten_glViewport: _emscripten_glViewport,
    /** @export */ emscripten_glfw3_context_destroy: _emscripten_glfw3_context_destroy,
    /** @export */ emscripten_glfw3_context_get_fullscreen_window: _emscripten_glfw3_context_get_fullscreen_window,
    /** @export */ emscripten_glfw3_context_get_now: _emscripten_glfw3_context_get_now,
    /** @export */ emscripten_glfw3_context_get_now_cached: _emscripten_glfw3_context_get_now_cached,
    /** @export */ emscripten_glfw3_context_get_pointer_lock_window: _emscripten_glfw3_context_get_pointer_lock_window,
    /** @export */ emscripten_glfw3_context_init: _emscripten_glfw3_context_init,
    /** @export */ emscripten_glfw3_context_is_any_element_focused: _emscripten_glfw3_context_is_any_element_focused,
    /** @export */ emscripten_glfw3_context_is_runtime_platform_apple: _emscripten_glfw3_context_is_runtime_platform_apple,
    /** @export */ emscripten_glfw3_context_keyboard_lock: _emscripten_glfw3_context_keyboard_lock,
    /** @export */ emscripten_glfw3_context_make_canvas_resizable: _emscripten_glfw3_context_make_canvas_resizable,
    /** @export */ emscripten_glfw3_context_open_url: _emscripten_glfw3_context_open_url,
    /** @export */ emscripten_glfw3_context_set_clipboard_string: _emscripten_glfw3_context_set_clipboard_string,
    /** @export */ emscripten_glfw3_context_set_title: _emscripten_glfw3_context_set_title,
    /** @export */ emscripten_glfw3_context_unmake_canvas_resizable: _emscripten_glfw3_context_unmake_canvas_resizable,
    /** @export */ emscripten_glfw3_create_custom_cursor: _emscripten_glfw3_create_custom_cursor,
    /** @export */ emscripten_glfw3_destroy_custom_cursor: _emscripten_glfw3_destroy_custom_cursor,
    /** @export */ emscripten_glfw3_window_change_focus: _emscripten_glfw3_window_change_focus,
    /** @export */ emscripten_glfw3_window_destroy: _emscripten_glfw3_window_destroy,
    /** @export */ emscripten_glfw3_window_get_computed_opacity: _emscripten_glfw3_window_get_computed_opacity,
    /** @export */ emscripten_glfw3_window_get_computed_visibility: _emscripten_glfw3_window_get_computed_visibility,
    /** @export */ emscripten_glfw3_window_get_position: _emscripten_glfw3_window_get_position,
    /** @export */ emscripten_glfw3_window_init: _emscripten_glfw3_window_init,
    /** @export */ emscripten_glfw3_window_on_created: _emscripten_glfw3_window_on_created,
    /** @export */ emscripten_glfw3_window_resize_offscreen_local: _emscripten_glfw3_window_resize_offscreen_local,
    /** @export */ emscripten_glfw3_window_set_custom_cursor: _emscripten_glfw3_window_set_custom_cursor,
    /** @export */ emscripten_glfw3_window_set_opacity: _emscripten_glfw3_window_set_opacity,
    /** @export */ emscripten_glfw3_window_set_size: _emscripten_glfw3_window_set_size,
    /** @export */ emscripten_glfw3_window_set_standard_cursor: _emscripten_glfw3_window_set_standard_cursor,
    /** @export */ emscripten_glfw3_window_set_visibility: _emscripten_glfw3_window_set_visibility,
    /** @export */ emscripten_has_asyncify: _emscripten_has_asyncify,
    /** @export */ emscripten_num_logical_cores: _emscripten_num_logical_cores,
    /** @export */ emscripten_out: _emscripten_out,
    /** @export */ emscripten_request_fullscreen: _emscripten_request_fullscreen,
    /** @export */ emscripten_request_fullscreen_strategy: _emscripten_request_fullscreen_strategy,
    /** @export */ emscripten_request_pointerlock: _emscripten_request_pointerlock,
    /** @export */ emscripten_resize_heap: _emscripten_resize_heap,
    /** @export */ emscripten_sample_gamepad_data: _emscripten_sample_gamepad_data,
    /** @export */ emscripten_set_beforeunload_callback_on_thread: _emscripten_set_beforeunload_callback_on_thread,
    /** @export */ emscripten_set_blur_callback_on_thread: _emscripten_set_blur_callback_on_thread,
    /** @export */ emscripten_set_canvas_element_size: _emscripten_set_canvas_element_size,
    /** @export */ emscripten_set_devicemotion_callback_on_thread: _emscripten_set_devicemotion_callback_on_thread,
    /** @export */ emscripten_set_element_css_size: _emscripten_set_element_css_size,
    /** @export */ emscripten_set_focus_callback_on_thread: _emscripten_set_focus_callback_on_thread,
    /** @export */ emscripten_set_fullscreenchange_callback_on_thread: _emscripten_set_fullscreenchange_callback_on_thread,
    /** @export */ emscripten_set_gamepadconnected_callback_on_thread: _emscripten_set_gamepadconnected_callback_on_thread,
    /** @export */ emscripten_set_gamepaddisconnected_callback_on_thread: _emscripten_set_gamepaddisconnected_callback_on_thread,
    /** @export */ emscripten_set_keydown_callback_on_thread: _emscripten_set_keydown_callback_on_thread,
    /** @export */ emscripten_set_keypress_callback_on_thread: _emscripten_set_keypress_callback_on_thread,
    /** @export */ emscripten_set_keyup_callback_on_thread: _emscripten_set_keyup_callback_on_thread,
    /** @export */ emscripten_set_main_loop: _emscripten_set_main_loop,
    /** @export */ emscripten_set_main_loop_timing: _emscripten_set_main_loop_timing,
    /** @export */ emscripten_set_mousedown_callback_on_thread: _emscripten_set_mousedown_callback_on_thread,
    /** @export */ emscripten_set_mouseenter_callback_on_thread: _emscripten_set_mouseenter_callback_on_thread,
    /** @export */ emscripten_set_mouseleave_callback_on_thread: _emscripten_set_mouseleave_callback_on_thread,
    /** @export */ emscripten_set_mousemove_callback_on_thread: _emscripten_set_mousemove_callback_on_thread,
    /** @export */ emscripten_set_mouseup_callback_on_thread: _emscripten_set_mouseup_callback_on_thread,
    /** @export */ emscripten_set_orientationchange_callback_on_thread: _emscripten_set_orientationchange_callback_on_thread,
    /** @export */ emscripten_set_pointerlockchange_callback_on_thread: _emscripten_set_pointerlockchange_callback_on_thread,
    /** @export */ emscripten_set_pointerlockerror_callback_on_thread: _emscripten_set_pointerlockerror_callback_on_thread,
    /** @export */ emscripten_set_resize_callback_on_thread: _emscripten_set_resize_callback_on_thread,
    /** @export */ emscripten_set_timeout: _emscripten_set_timeout,
    /** @export */ emscripten_set_touchcancel_callback_on_thread: _emscripten_set_touchcancel_callback_on_thread,
    /** @export */ emscripten_set_touchend_callback_on_thread: _emscripten_set_touchend_callback_on_thread,
    /** @export */ emscripten_set_touchmove_callback_on_thread: _emscripten_set_touchmove_callback_on_thread,
    /** @export */ emscripten_set_touchstart_callback_on_thread: _emscripten_set_touchstart_callback_on_thread,
    /** @export */ emscripten_set_visibilitychange_callback_on_thread: _emscripten_set_visibilitychange_callback_on_thread,
    /** @export */ emscripten_set_wheel_callback_on_thread: _emscripten_set_wheel_callback_on_thread,
    /** @export */ emscripten_set_window_title: _emscripten_set_window_title,
    /** @export */ emscripten_sleep: _emscripten_sleep,
    /** @export */ emscripten_unwind_to_js_event_loop: _emscripten_unwind_to_js_event_loop,
    /** @export */ emscripten_webgl_create_context: _emscripten_webgl_create_context,
    /** @export */ emscripten_webgl_destroy_context: _emscripten_webgl_destroy_context,
    /** @export */ emscripten_webgl_make_context_current: _emscripten_webgl_make_context_current,
    /** @export */ emwgpuBufferDestroy: _emwgpuBufferDestroy,
    /** @export */ emwgpuBufferMapAsync: _emwgpuBufferMapAsync,
    /** @export */ emwgpuBufferReadMappedRange: _emwgpuBufferReadMappedRange,
    /** @export */ emwgpuBufferUnmap: _emwgpuBufferUnmap,
    /** @export */ emwgpuDelete: _emwgpuDelete,
    /** @export */ emwgpuDeviceCreateBuffer: _emwgpuDeviceCreateBuffer,
    /** @export */ emwgpuDeviceCreateShaderModule: _emwgpuDeviceCreateShaderModule,
    /** @export */ emwgpuDeviceDestroy: _emwgpuDeviceDestroy,
    /** @export */ environ_get: _environ_get,
    /** @export */ environ_sizes_get: _environ_sizes_get,
    /** @export */ exit: _exit,
    /** @export */ ffi_call_js,
    /** @export */ gex_wgpu_jspi_signal: _gex_wgpu_jspi_signal,
    /** @export */ gex_wgpu_jspi_wait: _gex_wgpu_jspi_wait,
    /** @export */ memory: wasmMemory,
    /** @export */ mono_interp_flush_jitcall_queue: _mono_interp_flush_jitcall_queue,
    /** @export */ mono_interp_invoke_wasm_jit_call_trampoline: _mono_interp_invoke_wasm_jit_call_trampoline,
    /** @export */ mono_interp_jit_wasm_entry_trampoline: _mono_interp_jit_wasm_entry_trampoline,
    /** @export */ mono_interp_jit_wasm_jit_call_trampoline: _mono_interp_jit_wasm_jit_call_trampoline,
    /** @export */ mono_interp_record_interp_entry: _mono_interp_record_interp_entry,
    /** @export */ mono_interp_tier_prepare_jiterpreter: _mono_interp_tier_prepare_jiterpreter,
    /** @export */ mono_jiterp_wasm_jit_patch_interp_entry: _mono_jiterp_wasm_jit_patch_interp_entry,
    /** @export */ mono_jiterp_wasm_jit_unpatch_interp_entry: _mono_jiterp_wasm_jit_unpatch_interp_entry,
    /** @export */ mono_wasm_dump_threads: _mono_wasm_dump_threads,
    /** @export */ mono_wasm_free_method_data: _mono_wasm_free_method_data,
    /** @export */ mono_wasm_pthread_on_pthread_attached: _mono_wasm_pthread_on_pthread_attached,
    /** @export */ mono_wasm_pthread_on_pthread_registered: _mono_wasm_pthread_on_pthread_registered,
    /** @export */ mono_wasm_pthread_on_pthread_unregistered: _mono_wasm_pthread_on_pthread_unregistered,
    /** @export */ mono_wasm_pthread_set_name: _mono_wasm_pthread_set_name,
    /** @export */ mono_wasm_schedule_synchronization_context: _mono_wasm_schedule_synchronization_context,
    /** @export */ mono_wasm_set_entrypoint_breakpoint: _mono_wasm_set_entrypoint_breakpoint,
    /** @export */ mono_wasm_start_deputy_thread_async: _mono_wasm_start_deputy_thread_async,
    /** @export */ mono_wasm_start_io_thread_async: _mono_wasm_start_io_thread_async,
    /** @export */ mono_wasm_trace_logger: _mono_wasm_trace_logger,
    /** @export */ mono_wasm_webcil_range_read_js,
    /** @export */ proc_exit: _proc_exit,
    /** @export */ random_get: _random_get,
    /** @export */ stackRestore: _stackRestore,
    /** @export */ stackSave: _stackSave,
    /** @export */ wgpuCommandEncoderBeginComputePass: _wgpuCommandEncoderBeginComputePass,
    /** @export */ wgpuCommandEncoderBeginRenderPass: _wgpuCommandEncoderBeginRenderPass,
    /** @export */ wgpuCommandEncoderClearBuffer: _wgpuCommandEncoderClearBuffer,
    /** @export */ wgpuCommandEncoderCopyBufferToBuffer: _wgpuCommandEncoderCopyBufferToBuffer,
    /** @export */ wgpuCommandEncoderCopyBufferToTexture: _wgpuCommandEncoderCopyBufferToTexture,
    /** @export */ wgpuCommandEncoderCopyTextureToBuffer: _wgpuCommandEncoderCopyTextureToBuffer,
    /** @export */ wgpuCommandEncoderCopyTextureToTexture: _wgpuCommandEncoderCopyTextureToTexture,
    /** @export */ wgpuCommandEncoderFinish: _wgpuCommandEncoderFinish,
    /** @export */ wgpuCommandEncoderResolveQuerySet: _wgpuCommandEncoderResolveQuerySet,
    /** @export */ wgpuComputePassEncoderDispatchWorkgroups: _wgpuComputePassEncoderDispatchWorkgroups,
    /** @export */ wgpuComputePassEncoderEnd: _wgpuComputePassEncoderEnd,
    /** @export */ wgpuComputePassEncoderSetBindGroup: _wgpuComputePassEncoderSetBindGroup,
    /** @export */ wgpuComputePassEncoderSetPipeline: _wgpuComputePassEncoderSetPipeline,
    /** @export */ wgpuDeviceCreateBindGroup: _wgpuDeviceCreateBindGroup,
    /** @export */ wgpuDeviceCreateBindGroupLayout: _wgpuDeviceCreateBindGroupLayout,
    /** @export */ wgpuDeviceCreateCommandEncoder: _wgpuDeviceCreateCommandEncoder,
    /** @export */ wgpuDeviceCreateComputePipeline: _wgpuDeviceCreateComputePipeline,
    /** @export */ wgpuDeviceCreatePipelineLayout: _wgpuDeviceCreatePipelineLayout,
    /** @export */ wgpuDeviceCreateQuerySet: _wgpuDeviceCreateQuerySet,
    /** @export */ wgpuDeviceCreateRenderPipeline: _wgpuDeviceCreateRenderPipeline,
    /** @export */ wgpuDeviceCreateSampler: _wgpuDeviceCreateSampler,
    /** @export */ wgpuDeviceCreateTexture: _wgpuDeviceCreateTexture,
    /** @export */ wgpuDeviceGetLimits: _wgpuDeviceGetLimits,
    /** @export */ wgpuDeviceHasFeature: _wgpuDeviceHasFeature,
    /** @export */ wgpuQuerySetDestroy: _wgpuQuerySetDestroy,
    /** @export */ wgpuQueueSubmit: _wgpuQueueSubmit,
    /** @export */ wgpuQueueWriteBuffer: _wgpuQueueWriteBuffer,
    /** @export */ wgpuQueueWriteTexture: _wgpuQueueWriteTexture,
    /** @export */ wgpuRenderPassEncoderBeginOcclusionQuery: _wgpuRenderPassEncoderBeginOcclusionQuery,
    /** @export */ wgpuRenderPassEncoderDraw: _wgpuRenderPassEncoderDraw,
    /** @export */ wgpuRenderPassEncoderDrawIndexed: _wgpuRenderPassEncoderDrawIndexed,
    /** @export */ wgpuRenderPassEncoderEnd: _wgpuRenderPassEncoderEnd,
    /** @export */ wgpuRenderPassEncoderEndOcclusionQuery: _wgpuRenderPassEncoderEndOcclusionQuery,
    /** @export */ wgpuRenderPassEncoderSetBindGroup: _wgpuRenderPassEncoderSetBindGroup,
    /** @export */ wgpuRenderPassEncoderSetBlendConstant: _wgpuRenderPassEncoderSetBlendConstant,
    /** @export */ wgpuRenderPassEncoderSetIndexBuffer: _wgpuRenderPassEncoderSetIndexBuffer,
    /** @export */ wgpuRenderPassEncoderSetPipeline: _wgpuRenderPassEncoderSetPipeline,
    /** @export */ wgpuRenderPassEncoderSetScissorRect: _wgpuRenderPassEncoderSetScissorRect,
    /** @export */ wgpuRenderPassEncoderSetStencilReference: _wgpuRenderPassEncoderSetStencilReference,
    /** @export */ wgpuRenderPassEncoderSetVertexBuffer: _wgpuRenderPassEncoderSetVertexBuffer,
    /** @export */ wgpuRenderPassEncoderSetViewport: _wgpuRenderPassEncoderSetViewport,
    /** @export */ wgpuRenderPipelineGetBindGroupLayout: _wgpuRenderPipelineGetBindGroupLayout,
    /** @export */ wgpuSurfaceConfigure: _wgpuSurfaceConfigure,
    /** @export */ wgpuSurfaceGetCurrentTexture: _wgpuSurfaceGetCurrentTexture,
    /** @export */ wgpuSurfaceUnconfigure: _wgpuSurfaceUnconfigure,
    /** @export */ wgpuTextureCreateView: _wgpuTextureCreateView,
    /** @export */ wgpuTextureDestroy: _wgpuTextureDestroy,
    /** @export */ wgpuTextureGetDepthOrArrayLayers: _wgpuTextureGetDepthOrArrayLayers,
    /** @export */ wgpuTextureGetDimension: _wgpuTextureGetDimension,
    /** @export */ wgpuTextureGetHeight: _wgpuTextureGetHeight,
    /** @export */ wgpuTextureGetWidth: _wgpuTextureGetWidth,
    /** @export */ wink_js_acquire_device: _wink_js_acquire_device,
    /** @export */ wink_js_create_surface: _wink_js_create_surface,
    /** @export */ wink_js_get_env: _wink_js_get_env,
    /** @export */ wink_js_has_jspi: _wink_js_has_jspi,
    /** @export */ wink_js_kick: _wink_js_kick,
    /** @export */ wink_js_yield_frame: _wink_js_yield_frame,
    /** @export */ wjsw_js_capture,
    /** @export */ wjsw_js_funcidx
  };
}

// Argument name here must shadow the `wasmExports` global so
// that it is recognised by metadce and minify-import-export-names
// passes.
function applySignatureConversions(wasmExports) {
  // First, make a copy of the incoming exports object
  wasmExports = Object.assign({}, wasmExports);
  var makeWrapper_pP = f => a0 => f(a0) >>> 0;
  var makeWrapper_p = f => () => f() >>> 0;
  var makeWrapper_pp = f => a0 => f(a0) >>> 0;
  var makeWrapper_ppp = f => (a0, a1) => f(a0, a1) >>> 0;
  var makeWrapper_pp_p = f => (a0, a1, a2) => f(a0, a1, a2) >>> 0;
  var makeWrapper_pp____ = f => (a0, a1, a2, a3, a4) => f(a0, a1, a2, a3, a4) >>> 0;
  wasmExports["sbrk"] = makeWrapper_pP(wasmExports["sbrk"]);
  wasmExports["pthread_self"] = makeWrapper_p(wasmExports["pthread_self"]);
  wasmExports["malloc"] = makeWrapper_pp(wasmExports["malloc"]);
  wasmExports["memalign"] = makeWrapper_ppp(wasmExports["memalign"]);
  wasmExports["emscripten_stack_get_current"] = makeWrapper_p(wasmExports["emscripten_stack_get_current"]);
  wasmExports["emscripten_main_runtime_thread_id"] = makeWrapper_p(wasmExports["emscripten_main_runtime_thread_id"]);
  wasmExports["_emscripten_tls_init"] = makeWrapper_p(wasmExports["_emscripten_tls_init"]);
  wasmExports["emscripten_builtin_memalign"] = makeWrapper_ppp(wasmExports["emscripten_builtin_memalign"]);
  wasmExports["memset"] = makeWrapper_pp_p(wasmExports["memset"]);
  wasmExports["_emscripten_stack_alloc"] = makeWrapper_pp(wasmExports["_emscripten_stack_alloc"]);
  wasmExports["_wasmfs_fetch_get_file_url"] = makeWrapper_pp(wasmExports["_wasmfs_fetch_get_file_url"]);
  wasmExports["_wasmfs_mmap"] = makeWrapper_pp____(wasmExports["_wasmfs_mmap"]);
  wasmExports["_wasmfs_readdir_start"] = makeWrapper_pp(wasmExports["_wasmfs_readdir_start"]);
  wasmExports["_wasmfs_readdir_get"] = makeWrapper_pp(wasmExports["_wasmfs_readdir_get"]);
  wasmExports["_wasmfs_get_cwd"] = makeWrapper_p(wasmExports["_wasmfs_get_cwd"]);
  wasmExports["wasmfs_create_jsimpl_backend"] = makeWrapper_p(wasmExports["wasmfs_create_jsimpl_backend"]);
  wasmExports["wasmfs_create_memory_backend"] = makeWrapper_p(wasmExports["wasmfs_create_memory_backend"]);
  return wasmExports;
}

// include: postamble.js
// === Auto-generated postamble setup entry stuff ===
async function run() {
  if ((ENVIRONMENT_IS_PTHREAD)) {
    initRuntime();
    return;
  }
  preRun();
  if (runDependencies) {
    await resolveRunDependencies();
  }
  var setStatus = Module["setStatus"];
  if (setStatus) {
    setStatus("Running...");
    // Yield to the event loop to allow the browser to paint "Running..."
    await new Promise(resolve => setTimeout(resolve, 1));
    // Then we want to clear the status text, but only after the rest of this function runs.
    setTimeout(setStatus, 1, "");
  }
  if (ABORT) return;
  initRuntime();
  Module["onRuntimeInitialized"]?.();
  postRun();
}

var wasmExports;

if ((!(ENVIRONMENT_IS_PTHREAD))) {
  // Call createWasm on startup if we are the main thread.
  // Worker threads call this once they receive the module via postMessage
  // In modularize mode the generated code is within a factory function so we
  // can use await here (since it's not top-level-await).
  wasmExports = await createWasm();
  await run();
}


  return Module;
}

// Export using a UMD style export, or ES6 exports if selected
export default createDotnetRuntime;

// Create code for detecting if we are running in a pthread.
// Normally this detection is done when the module is itself run but
// when running in MODULARIZE mode we need use this to know if we should
// run the module constructor on startup (true only for pthreads).
var isPthread = globalThis.name == 'em-pthread';

isPthread && createDotnetRuntime();


var fetch = fetch || undefined; var _nativeModuleLoaded = false;
