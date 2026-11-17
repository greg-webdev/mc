//! Licensed to the .NET Foundation under one or more agreements.
//! The .NET Foundation licenses this file to you under the MIT license.

const e=()=>(async()=>{try{return new WebAssembly.Module(Uint8Array.from(atob("AGFzbQEAAAABBAFgAAADAgEAChABDgACaR9AAQMAAAsACxoL"),e=>e.codePointAt(0))),!0}catch(e){return!1}})(),o=async()=>WebAssembly.validate(new Uint8Array([0,97,115,109,1,0,0,0,1,5,1,96,0,1,123,3,2,1,0,10,15,1,13,0,65,1,253,15,65,2,253,15,253,128,2,11])),t=async()=>WebAssembly.validate(new Uint8Array([0,97,115,109,1,0,0,0,1,5,1,96,0,1,123,3,2,1,0,10,10,1,8,0,65,0,253,15,253,98,11])),n=Symbol.for("wasm promise_control");function r(e,o){let t=null;const r=new Promise(function(n,r){t={isDone:!1,promise:null,resolve:o=>{t.isDone||(t.isDone=!0,n(o),e&&e())},reject:e=>{t.isDone||(t.isDone=!0,r(e),o&&o())}}});t.promise=r;const i=r;return i[n]=t,{promise:i,promise_control:t}}function i(e){return e[n]}function s(e){e&&function(e){return void 0!==e[n]}(e)||Ve(!1,"Promise is not controllable")}const a="__mono_message__",l=["debug","log","trace","warn","info","error"],c="MONO_WASM: ";let d,u,m,f;function g(e){f=e}function p(e){if(Ue.diagnosticTracing){const o="function"==typeof e?e():e;console.debug(c+o)}}function h(e,...o){console.info(c+e,...o)}function b(e,...o){console.info(e,...o)}function w(e,...o){console.warn(c+e,...o)}function y(e,...o){if(o&&o.length>0&&o[0]&&"object"==typeof o[0]){if(o[0].silent)return;if(o[0].toString)return void console.error(c+e,o[0].toString())}console.error(c+e,...o)}let v,_,A="",T=(new Date).valueOf();function x(e,o,t){return function(...n){try{let r=n[0];if(void 0===r)r="undefined";else if(null===r)r="null";else if("function"==typeof r)r=r.toString();else if("string"!=typeof r)try{r=JSON.stringify(r)}catch(e){r=r.toString()}if("string"==typeof r){if(Pe&&-1!==r.indexOf("keeping the worker alive for asynchronous operation"))return;if(0===r.indexOf("MONO_WASM: ")||0===r.indexOf("[MONO]")){const e=new Date;T!==e.valueOf()&&(A=e.toISOString().substring(11,23),T=e.valueOf()),r=`[${f} ${A}] ${r}`}}o(t?JSON.stringify({method:e,payload:r,arguments:n.slice(1)}):[e+r,...n.slice(1)])}catch(e){m.error(`proxyConsole failed: ${e}`)}}}function E(e,o,t){u=o,f=e,m={...o};const n=`${t}/console`.replace("https://","wss://").replace("http://","ws://");d=new WebSocket(n),d.addEventListener("error",S),d.addEventListener("close",M),function(){for(const e of l)u[e]=x(`console.${e}`,j,!0)}()}function R(e){let o=30;const t=()=>{d?0==d.bufferedAmount||0==o?(e&&b(e),function(){for(const e of l)u[e]=x(`console.${e}`,m.log,!1)}(),d.removeEventListener("error",S),d.removeEventListener("close",M),d.close(1e3,e),d=void 0):(o--,globalThis.setTimeout(t,100)):e&&m&&m.log(e)};t()}function j(e){d&&d.readyState===WebSocket.OPEN?d.send(e):m.log(e)}function S(e){m.error(`[${f}] proxy console websocket error: ${e}`,e)}function M(e){m.debug(`[${f}] proxy console websocket closed: ${e}`,e)}function D(){Ue.preferredIcuAsset=P(Ue.config);let e="invariant"==Ue.config.globalizationMode;if(!e)if(Ue.preferredIcuAsset)Ue.diagnosticTracing&&p("ICU data archive(s) available, disabling invariant mode");else{if("custom"===Ue.config.globalizationMode||"all"===Ue.config.globalizationMode||"sharded"===Ue.config.globalizationMode){const e="invariant globalization mode is inactive and no ICU data archives are available";throw y(`ERROR: ${e}`),new Error(e)}Ue.diagnosticTracing&&p("ICU data archive(s) not available, using invariant globalization mode"),e=!0,Ue.preferredIcuAsset=null}const o="DOTNET_SYSTEM_GLOBALIZATION_INVARIANT",t=Ue.config.environmentVariables;if(void 0===t[o]&&e&&(t[o]="1"),void 0===t.TZ)try{const e=Intl.DateTimeFormat().resolvedOptions().timeZone||null;e&&(t.TZ=e)}catch(e){h("failed to detect timezone, will fallback to UTC")}}function P(e){var o;if((null===(o=e.resources)||void 0===o?void 0:o.icu)&&"invariant"!=e.globalizationMode){const o=e.applicationCulture||(Oe?globalThis.navigator&&globalThis.navigator.languages&&globalThis.navigator.languages[0]:Intl.DateTimeFormat().resolvedOptions().locale);e.applicationCulture||(e.applicationCulture=o);const t=e.resources.icu;let n=null;if("custom"===e.globalizationMode){if(t.length>=1)return t[0].name}else o&&"all"!==e.globalizationMode?"sharded"===e.globalizationMode&&(n=function(e){const o=e.split("-")[0];return"en"===o||["fr","fr-FR","it","it-IT","de","de-DE","es","es-ES"].includes(e)?"icudt_EFIGS.dat":["zh","ko","ja"].includes(o)?"icudt_CJK.dat":"icudt_no_CJK.dat"}(o)):n="icudt.dat";if(n)for(let e=0;e<t.length;e++){const o=t[e];if(o.virtualPath===n)return o.name}}return e.globalizationMode="invariant",null}const O=class{constructor(e){this.url=e}toString(){return this.url}};async function C(e){if(Ce&&"function"!=typeof globalThis.atob){const e="ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";globalThis.atob=o=>{const t=String(o).replace(/=+$/,"");let n="";for(let o=0,r=0,i=0;i<t.length;i++){const s=e.indexOf(t.charAt(i));-1!==s&&(r=o%4?64*r+s:s,o++%4&&(n+=String.fromCharCode(255&r>>(-2*o&6))))}return n}}if(Se){const e=await import(/*! webpackIgnore: true */"process"),o=14;if(e.versions.node.split(".")[0]<o)throw new Error(`NodeJS at '${e.execPath}' has too low version '${e.versions.node}', please use at least ${o}.`)}const o=/*! webpackIgnore: true */import.meta.url,t=o.indexOf("?");var n;if(t>0&&(Ue.modulesUniqueQuery=o.substring(t)),Ue.scriptUrl=o.replace(/\\/g,"/").replace(/[?#].*/,""),Ue.scriptDirectory=(n=Ue.scriptUrl).slice(0,n.lastIndexOf("/"))+"/",Ue.locateFile=e=>"URL"in globalThis&&globalThis.URL!==O?new URL(e,Ue.scriptDirectory).toString():N(e)?e:Ue.scriptDirectory+e,Ue.fetch_like=I,Ue.out=console.log,Ue.err=console.error,Ue.onDownloadResourceProgress=e.onDownloadResourceProgress,Oe&&globalThis.navigator){const e=globalThis.navigator,o=e.userAgentData&&e.userAgentData.brands;o&&o.length>0?Ue.isChromium=o.some(e=>"Google Chrome"===e.brand||"Microsoft Edge"===e.brand||"Chromium"===e.brand):e.userAgent&&(Ue.isChromium=e.userAgent.includes("Chrome"),Ue.isFirefox=e.userAgent.includes("Firefox"))}void 0===globalThis.URL&&(globalThis.URL=O)}async function I(e,o){try{const t="function"==typeof globalThis.fetch;if(Se){const n=e.startsWith("file://");if(!n&&t)return globalThis.fetch(e,o||{credentials:"same-origin"});v||(_=await import(/*! webpackIgnore: true */"url"),v=await import(/*! webpackIgnore: true */"fs")),n&&(e=_.fileURLToPath(e));const r=await v.promises.readFile(e);return{ok:!0,headers:{length:0,get:()=>null},url:e,arrayBuffer:()=>r,json:()=>JSON.parse(r),text:()=>{throw new Error("NotImplementedException")}}}if(t)return globalThis.fetch(e,o||{credentials:"same-origin"});if("function"==typeof read)return{ok:!0,url:e,headers:{length:0,get:()=>null},arrayBuffer:()=>new Uint8Array(read(e,"binary")),json:()=>JSON.parse(read(e,"utf8")),text:()=>read(e,"utf8")}}catch(o){return{ok:!1,url:e,status:500,headers:{length:0,get:()=>null},statusText:"ERR28: "+o,arrayBuffer:()=>{throw o},json:()=>{throw o},text:()=>{throw o}}}throw new Error("No fetch implementation available")}const k=/^[a-zA-Z][a-zA-Z\d+\-.]*?:\/\//,U=/[a-zA-Z]:[\\/]/;function N(e){return Se||Ce?e.startsWith("/")||e.startsWith("\\")||-1!==e.indexOf("///")||U.test(e):k.test(e)}let L,$=0;const z=[],W=[],F=new Map,B={"js-module-runtime":!0,"js-module-dotnet":!0,"js-module-native":!0,"js-module-diagnostics":!0},V={...B,"js-module-library-initializer":!0},J={...B,dotnetwasm:!0,heap:!0,manifest:!0},q={...V,manifest:!0},H={...V,dotnetwasm:!0},Q={dotnetwasm:!0,symbols:!0},Z={...V,dotnetwasm:!0,symbols:!0},G={symbols:!0};function K(e){return!("icu"==e.behavior&&e.name!=Ue.preferredIcuAsset)}function X(e,o,t){null!=o||(o=[]),Ve(1==o.length,`Expect to have one ${t} asset in resources`);const n=o[0];return n.behavior=t,Y(n),e.push(n),n}function Y(e){J[e.behavior]&&F.set(e.behavior,e)}function ee(e){Ve(J[e],`Unknown single asset behavior ${e}`);const o=F.get(e);if(o&&!o.resolvedUrl)if(o.resolvedUrl=Ue.locateFile(o.name),B[o.behavior]){const e=pe(o);e?("string"!=typeof e&&Ve(!1,"loadBootResource response for 'dotnetjs' type should be a URL string"),o.resolvedUrl=e):o.resolvedUrl=de(o.resolvedUrl,o.behavior)}else if("dotnetwasm"!==o.behavior)throw new Error(`Unknown single asset behavior ${e}`);return o}function oe(e){const o=ee(e);return Ve(o,`Single asset for ${e} not found`),o}let te=!1;async function ne(){var e;if(!te){te=!0,Ue.diagnosticTracing&&p("mono_download_assets");try{const o=[],t=[],n=!Pe&&"0"!==(null===(e=Ue.config.environmentVariables)||void 0===e?void 0:e.MONO_WASM_WEBCIL_RANGE)&&[...z,...W].some(e=>"assembly"===e.behavior&&e.name.endsWith(".wasm")),r=[],i=(e,o)=>{!Z[e.behavior]&&K(e)&&Ue.expected_instantiated_assets_count++,!H[e.behavior]&&K(e)&&(Ue.expected_downloaded_assets_count++,o.push(ae(e)))};for(const e of z)i(e,o);for(const e of W)i(e,t);Ue.allDownloadsQueued.promise_control.resolve(),Promise.all([...o,...t]).then(()=>{Ue.allDownloadsFinished.promise_control.resolve()}).catch(e=>{throw Ue.err("Error in mono_download_assets: "+e),eo(1,e),e}),await Ue.runtimeModuleLoaded.promise;const s=async e=>{const o=await e;if(Q[o.behavior])return"symbols"===o.behavior&&(await ke.instantiate_symbols_asset(o),he(o)),void++Ue.actual_downloaded_assets_count;if(o.buffer){if(!Z[o.behavior]){o.buffer&&"object"==typeof o.buffer||Ve(!1,"asset buffer must be array-like or buffer-like or promise of these"),"string"!=typeof o.resolvedUrl&&Ve(!1,"resolvedUrl must be string");const e=o.resolvedUrl,t=await o.buffer,r=new Uint8Array(t);he(o);let i=null;n&&"assembly"===o.behavior&&r.length>8&&0===r[0]&&97===r[1]&&115===r[2]&&109===r[3]&&(i=WebAssembly.compile(r).then(e=>WebAssembly.Module.exports(e).some(e=>"getWebcilRange"===e.name)?e:null,()=>null)),await ke.beforeOnRuntimeInitialized.promise,await ke.afterInstantiateWasm.promise;const s=i?await i:null;s&&await ke.instantiate_webcil_range_asset(o,e,s)||ke.instantiate_asset(o,e,r)}}else o.isOptional||Ve(!1,"Expected asset to have the downloaded buffer"),!H[o.behavior]&&K(o)&&Ue.expected_downloaded_assets_count--,!Z[o.behavior]&&K(o)&&Ue.expected_instantiated_assets_count--},a=[],l=[],c=e=>{const o=s(e);return r.push(e.then(e=>"assembly"===e.behavior?o:void 0,()=>{})),o};for(const e of o)a.push(c(e));for(const e of t)l.push(c(e));n?Promise.all(r).catch(()=>{}).then(()=>ke.afterWebcilRange.promise_control.resolve()):ke.afterWebcilRange.promise_control.resolve(),Promise.all(a).then(()=>{Pe||ke.coreAssetsInMemory.promise_control.resolve()}).catch(e=>{throw Ue.err("Error in mono_download_assets: "+e),eo(1,e),e}),Promise.all(l).then(async()=>{Pe||(await ke.coreAssetsInMemory.promise,ke.allAssetsInMemory.promise_control.resolve())}).catch(e=>{throw Ue.err("Error in mono_download_assets: "+e),eo(1,e),e})}catch(e){throw Ue.err("Error in mono_download_assets: "+e),e}}}let re=!1;function ie(){if(re)return;re=!0;const e=Ue.config,o=[];if(e.assets)for(const o of e.assets)"object"!=typeof o&&Ve(!1,`asset must be object, it was ${typeof o} : ${o}`),"string"!=typeof o.behavior&&Ve(!1,"asset behavior must be known string"),"string"!=typeof o.name&&Ve(!1,"asset name must be string"),o.resolvedUrl&&"string"!=typeof o.resolvedUrl&&Ve(!1,"asset resolvedUrl could be string"),o.hash&&"string"!=typeof o.hash&&Ve(!1,"asset resolvedUrl could be string"),o.pendingDownload&&"object"!=typeof o.pendingDownload&&Ve(!1,"asset pendingDownload could be object"),o.isCore?z.push(o):W.push(o),Y(o);else if(e.resources){const t=e.resources;t.wasmNative||Ve(!1,"resources.wasmNative must be defined"),t.jsModuleNative||Ve(!1,"resources.jsModuleNative must be defined"),t.jsModuleRuntime||Ve(!1,"resources.jsModuleRuntime must be defined"),X(W,t.wasmNative,"dotnetwasm"),X(o,t.jsModuleNative,"js-module-native"),X(o,t.jsModuleRuntime,"js-module-runtime"),t.jsModuleDiagnostics&&X(o,t.jsModuleDiagnostics,"js-module-diagnostics");const n=(e,o,t)=>{const n=e;n.behavior=o,t?(n.isCore=!0,z.push(n)):W.push(n)};if(t.coreAssembly)for(let e=0;e<t.coreAssembly.length;e++)n(t.coreAssembly[e],"assembly",!0);if(t.assembly)for(let e=0;e<t.assembly.length;e++)n(t.assembly[e],"assembly",!t.coreAssembly);if(0!=e.debugLevel&&Ue.isDebuggingSupported()){if(t.corePdb)for(let e=0;e<t.corePdb.length;e++)n(t.corePdb[e],"pdb",!0);if(t.pdb)for(let e=0;e<t.pdb.length;e++)n(t.pdb[e],"pdb",!t.corePdb)}if(e.loadAllSatelliteResources&&t.satelliteResources)for(const e in t.satelliteResources)for(let o=0;o<t.satelliteResources[e].length;o++){const r=t.satelliteResources[e][o];r.culture=e,n(r,"resource",!t.coreAssembly)}if(t.coreVfs)for(let e=0;e<t.coreVfs.length;e++)n(t.coreVfs[e],"vfs",!0);if(t.vfs)for(let e=0;e<t.vfs.length;e++)n(t.vfs[e],"vfs",!t.coreVfs);const r=P(e);if(r&&t.icu)for(let e=0;e<t.icu.length;e++){const o=t.icu[e];o.name===r&&n(o,"icu",!1)}if(t.wasmSymbols)for(let e=0;e<t.wasmSymbols.length;e++)n(t.wasmSymbols[e],"symbols",!1)}if(e.appsettings)for(let o=0;o<e.appsettings.length;o++){const t=e.appsettings[o],n=be(t);"appsettings.json"!==n&&n!==`appsettings.${e.applicationEnvironment}.json`||W.push({name:t,behavior:"vfs",cache:"no-cache",useCredentials:!0})}e.assets=[...z,...W,...o]}async function se(e){const o=await ae(e);return await o.pendingDownloadInternal.response,o.buffer}async function ae(e){try{return await le(e)}catch(o){if(!Ue.enableDownloadRetry)throw o;if(Ce||Se)throw o;if(e.pendingDownload&&e.pendingDownloadInternal==e.pendingDownload)throw o;if(e.resolvedUrl&&-1!=e.resolvedUrl.indexOf("file://"))throw o;if(o&&404==o.status)throw o;e.pendingDownloadInternal=void 0,await Ue.allDownloadsQueued.promise;try{return Ue.diagnosticTracing&&p(`Retrying download '${e.name}'`),await le(e)}catch(o){return e.pendingDownloadInternal=void 0,await new Promise(e=>globalThis.setTimeout(e,100)),Ue.diagnosticTracing&&p(`Retrying download (2) '${e.name}' after delay`),await le(e)}}}async function le(e){for(;L;)await L.promise;try{++$,$==Ue.maxParallelDownloads&&(Ue.diagnosticTracing&&p("Throttling further parallel downloads"),L=r());const o=await async function(e){if(e.pendingDownload&&(e.pendingDownloadInternal=e.pendingDownload),e.pendingDownloadInternal&&e.pendingDownloadInternal.response)return e.pendingDownloadInternal.response;if(e.buffer){const o=await e.buffer;return e.resolvedUrl||(e.resolvedUrl="undefined://"+e.name),e.pendingDownloadInternal={url:e.resolvedUrl,name:e.name,response:Promise.resolve({ok:!0,arrayBuffer:()=>o,json:()=>JSON.parse(new TextDecoder("utf-8").decode(o)),text:()=>new TextDecoder("utf-8").decode(o),headers:{get:()=>{}}})},e.pendingDownloadInternal.response}const o=e.loadRemote&&Ue.config.remoteSources?Ue.config.remoteSources:[""];let t;for(let n of o){n=n.trim(),"./"===n&&(n="");const o=ce(e,n);e.name===o?Ue.diagnosticTracing&&p(`Attempting to download '${o}'`):Ue.diagnosticTracing&&p(`Attempting to download '${o}' for ${e.name}`);try{e.resolvedUrl=o;const n=fe(e);if(e.pendingDownloadInternal=n,t=await n.response,!t||!t.ok)continue;return t}catch(e){t||(t={ok:!1,url:o,status:0,statusText:""+e});continue}}const n=e.isOptional||e.name.match(/\.pdb$/)&&Ue.config.ignorePdbLoadErrors;if(t||Ve(!1,`Response undefined ${e.name}`),!n){const o=new Error(`download '${t.url}' for ${e.name} failed ${t.status} ${t.statusText}`);throw o.status=t.status,o}h(`optional download '${t.url}' for ${e.name} failed ${t.status} ${t.statusText}`)}(e);return o?(Q[e.behavior]||(e.buffer=await o.arrayBuffer(),++Ue.actual_downloaded_assets_count),e):e}finally{if(--$,L&&$==Ue.maxParallelDownloads-1){Ue.diagnosticTracing&&p("Resuming more parallel downloads");const e=L;L=void 0,e.promise_control.resolve()}}}function ce(e,o){let t;return null==o&&Ve(!1,`sourcePrefix must be provided for ${e.name}`),e.resolvedUrl?t=e.resolvedUrl:(t=""===o?"assembly"===e.behavior||"pdb"===e.behavior?e.name:"resource"===e.behavior&&e.culture&&""!==e.culture?`${e.culture}/${e.name}`:e.name:o+e.name,t=de(Ue.locateFile(t),e.behavior)),t&&"string"==typeof t||Ve(!1,"attemptUrl need to be path or url string"),t}function de(e,o){return Ue.modulesUniqueQuery&&q[o]&&(e+=Ue.modulesUniqueQuery),e}let ue=0;const me=new Set;function fe(e){try{e.resolvedUrl||Ve(!1,"Request's resolvedUrl must be set");const o=function(e){let o=e.resolvedUrl;if(Ue.loadBootResource){const t=pe(e);if(t instanceof Promise)return t;"string"==typeof t&&(o=t)}const t={};return e.cache?t.cache=e.cache:Ue.config.disableNoCacheFetch||(t.cache="no-cache"),e.useCredentials?t.credentials="include":!Ue.config.disableIntegrityCheck&&e.hash&&(t.integrity=e.hash),Ue.fetch_like(o,t)}(e),t={name:e.name,url:e.resolvedUrl,response:o};return me.add(e.name),t.response.then(()=>{"assembly"==e.behavior&&Ue.loadedAssemblies.push(e.name),ue++,Ue.onDownloadResourceProgress&&Ue.onDownloadResourceProgress(ue,me.size)}),t}catch(o){const t={ok:!1,url:e.resolvedUrl,status:500,statusText:"ERR29: "+o,arrayBuffer:()=>{throw o},json:()=>{throw o}};return{name:e.name,url:e.resolvedUrl,response:Promise.resolve(t)}}}const ge={resource:"assembly",assembly:"assembly",pdb:"pdb",icu:"globalization",vfs:"configuration",manifest:"manifest",dotnetwasm:"dotnetwasm","js-module-dotnet":"dotnetjs","js-module-native":"dotnetjs","js-module-runtime":"dotnetjs"};function pe(e){var o;if(Ue.loadBootResource){const t=null!==(o=e.hash)&&void 0!==o?o:"",n=e.resolvedUrl,r=ge[e.behavior];if(r){const o=Ue.loadBootResource(r,e.name,n,t,e.behavior);return"string"==typeof o?function(e){return"string"!=typeof e&&Ve(!1,"url must be a string"),!N(e)&&0!==e.indexOf("./")&&0!==e.indexOf("../")&&globalThis.URL&&globalThis.document&&globalThis.document.baseURI&&(e=new URL(e,globalThis.document.baseURI).toString()),e}(o):o}}}function he(e){e.pendingDownloadInternal=null,e.pendingDownload=null,e.buffer=null,e.moduleExports=null}function be(e){let o=e.lastIndexOf("/");return o>=0&&o++,e.substring(o)}async function we(e){e&&await Promise.all((null!=e?e:[]).map(e=>async function(e){try{const o=e.name;if(!e.moduleExports){const t=de(Ue.locateFile(o),"js-module-library-initializer");Ue.diagnosticTracing&&p(`Attempting to import '${t}' for ${e}`),e.moduleExports=await import(/*! webpackIgnore: true */t)}Ue.libraryInitializers.push({scriptName:o,exports:e.moduleExports})}catch(o){w(`Failed to import library initializer '${e}': ${o}`)}}(e)))}async function ye(e,o){if(!Ue.libraryInitializers)return;const t=[];for(let n=0;n<Ue.libraryInitializers.length;n++){const r=Ue.libraryInitializers[n];r.exports[e]&&t.push(ve(r.scriptName,e,()=>r.exports[e](...o)))}await Promise.all(t)}async function ve(e,o,t){try{await t()}catch(t){throw w(`Failed to invoke '${o}' on library initializer '${e}': ${t}`),eo(1,t),t}}function _e(e,o){if(e===o)return e;const t={...o};return void 0!==t.assets&&t.assets!==e.assets&&(t.assets=[...e.assets||[],...t.assets||[]]),void 0!==t.resources&&(t.resources=Te(e.resources||{assembly:[],jsModuleNative:[],jsModuleRuntime:[],wasmNative:[]},t.resources)),void 0!==t.environmentVariables&&(t.environmentVariables={...e.environmentVariables||{},...t.environmentVariables||{}}),void 0!==t.runtimeOptions&&t.runtimeOptions!==e.runtimeOptions&&(t.runtimeOptions=[...e.runtimeOptions||[],...t.runtimeOptions||[]]),Object.assign(e,t)}function Ae(e,o){if(e===o)return e;const t={...o};return t.config&&(e.config||(e.config={}),t.config=_e(e.config,t.config)),Object.assign(e,t)}function Te(e,o){if(e===o)return e;const t={...o};return void 0!==t.coreAssembly&&(t.coreAssembly=[...e.coreAssembly||[],...t.coreAssembly||[]]),void 0!==t.assembly&&(t.assembly=[...e.assembly||[],...t.assembly||[]]),void 0!==t.lazyAssembly&&(t.lazyAssembly=[...e.lazyAssembly||[],...t.lazyAssembly||[]]),void 0!==t.corePdb&&(t.corePdb=[...e.corePdb||[],...t.corePdb||[]]),void 0!==t.pdb&&(t.pdb=[...e.pdb||[],...t.pdb||[]]),void 0!==t.jsModuleNative&&(t.jsModuleNative=[...e.jsModuleNative||[],...t.jsModuleNative||[]]),void 0!==t.jsModuleDiagnostics&&(t.jsModuleDiagnostics=[...e.jsModuleDiagnostics||[],...t.jsModuleDiagnostics||[]]),void 0!==t.jsModuleRuntime&&(t.jsModuleRuntime=[...e.jsModuleRuntime||[],...t.jsModuleRuntime||[]]),void 0!==t.wasmSymbols&&(t.wasmSymbols=[...e.wasmSymbols||[],...t.wasmSymbols||[]]),void 0!==t.wasmNative&&(t.wasmNative=[...e.wasmNative||[],...t.wasmNative||[]]),void 0!==t.icu&&(t.icu=[...e.icu||[],...t.icu||[]]),void 0!==t.satelliteResources&&(t.satelliteResources=function(e,o){if(e===o)return e;for(const t in o)e[t]=[...e[t]||[],...o[t]||[]];return e}(e.satelliteResources||{},t.satelliteResources||{})),void 0!==t.modulesAfterConfigLoaded&&(t.modulesAfterConfigLoaded=[...e.modulesAfterConfigLoaded||[],...t.modulesAfterConfigLoaded||[]]),void 0!==t.modulesAfterRuntimeReady&&(t.modulesAfterRuntimeReady=[...e.modulesAfterRuntimeReady||[],...t.modulesAfterRuntimeReady||[]]),void 0!==t.extensions&&(t.extensions={...e.extensions||{},...t.extensions||{}}),void 0!==t.vfs&&(t.vfs=[...e.vfs||[],...t.vfs||[]]),Object.assign(e,t)}function xe(){const e=Ue.config;if(e.environmentVariables=e.environmentVariables||{},e.runtimeOptions=e.runtimeOptions||[],e.resources=e.resources||{assembly:[],jsModuleNative:[],jsModuleRuntime:[],wasmNative:[],vfs:[],satelliteResources:{}},e.assets){Ue.diagnosticTracing&&p("config.assets is deprecated, use config.resources instead");for(const o of e.assets){const t={};switch(o.behavior){case"assembly":t.assembly=[o];break;case"pdb":t.pdb=[o];break;case"resource":t.satelliteResources={},t.satelliteResources[o.culture]=[o];break;case"icu":t.icu=[o];break;case"symbols":t.wasmSymbols=[o];break;case"vfs":t.vfs=[o];break;case"dotnetwasm":t.wasmNative=[o];break;case"js-module-runtime":t.jsModuleRuntime=[o];break;case"js-module-native":t.jsModuleNative=[o];break;case"js-module-diagnostics":t.jsModuleDiagnostics=[o];break;case"js-module-dotnet":break;default:throw new Error(`Unexpected behavior ${o.behavior} of asset ${o.name}`)}Te(e.resources,t)}}e.debugLevel,void 0===e.virtualWorkingDirectory&&(e.virtualWorkingDirectory=Ie),e.applicationEnvironment||(e.applicationEnvironment="Production"),Number.isInteger(e.pthreadPoolInitialSize)||(e.pthreadPoolInitialSize=7),Number.isInteger(e.pthreadPoolUnusedSize)||(e.pthreadPoolUnusedSize=1),null==e.jsThreadBlockingMode&&(e.jsThreadBlockingMode="PreventSynchronousJSExport"),void 0===e.environmentVariables.MONO_SLEEP_ABORT_LIMIT&&(e.environmentVariables.MONO_SLEEP_ABORT_LIMIT="5000"),e.applicationCulture&&(e.environmentVariables.LANG=`${e.applicationCulture}.UTF-8`),ke.diagnosticTracing=Ue.diagnosticTracing=!!e.diagnosticTracing,ke.waitForDebugger=e.waitForDebugger,Ue.maxParallelDownloads=e.maxParallelDownloads||Ue.maxParallelDownloads,Ue.enableDownloadRetry=void 0!==e.enableDownloadRetry?e.enableDownloadRetry:Ue.enableDownloadRetry}let Ee=!1;async function Re(e){var o;if(Ee)await Ue.afterConfigLoaded.promise;else try{if(Ee=!0,xe(),await we(null===(o=Ue.config.resources)||void 0===o?void 0:o.modulesAfterConfigLoaded),await ye("onRuntimeConfigLoaded",[Ue.config]),e.onConfigLoaded)try{await e.onConfigLoaded(Ue.config,Le),xe()}catch(e){throw y("onConfigLoaded() failed",e),e}xe(),Ue.afterConfigLoaded.promise_control.resolve(Ue.config)}catch(o){const t=`Failed to initialize config ${o} ${null==o?void 0:o.stack}`;throw Ue.config=e.config=Object.assign(Ue.config,{message:t,error:o,isError:!0}),eo(1,new Error(t)),o}}function je(){return!!globalThis.navigator&&(Ue.isChromium||Ue.isFirefox)}const Se="object"==typeof process&&"object"==typeof process.versions&&"string"==typeof process.versions.node,Me="function"==typeof importScripts,De=Me&&"undefined"!=typeof dotnetSidecar,Pe=Me&&!De,Oe="object"==typeof window||Me&&!Se,Ce=!Oe&&!Se,Ie="/";let ke={},Ue={},Ne={},Le={},$e={},ze=!1;const We={},Fe={config:We},Be={mono:{},binding:{},internal:$e,module:Fe,loaderHelpers:Ue,runtimeHelpers:ke,diagnosticHelpers:Ne,api:Le};function Ve(e,o){if(e)return;const t="Assert failed: "+("function"==typeof o?o():o),n=new Error(t);y(t,n),ke.nativeAbort(n)}function Je(){return void 0!==Ue.exitCode}function qe(){return ke.runtimeReady&&!Je()}function He(){Je()&&Ve(!1,`.NET runtime already exited with ${Ue.exitCode} ${Ue.exitReason}. You can use dotnet.runMain() which doesn't exit the runtime.`),Pe?ke.runtimeReady||Ve(!1,"The WebWorker is not attached to the runtime. See https://github.com/dotnet/runtime/blob/main/src/mono/wasm/threads.md#JS-interop-on-dedicated-threads"):ke.runtimeReady||Ve(!1,".NET runtime didn't start yet. Please call dotnet.create() first.")}function Qe(){Oe&&(globalThis.addEventListener("unhandledrejection",to),globalThis.addEventListener("error",no))}let Ze,Ge;function Ke(){Ze=Fe.onAbort,Ge=Fe.onExit,Fe.onAbort=Ye,Fe.onExit=Xe}function Xe(e){Ge&&Ge(e),eo(e,Ue.exitReason)}function Ye(e){var o;if(Ze&&Ze(e||Ue.exitReason),(null===(o=Ue.config)||void 0===o?void 0:o.dumpThreadsOnNonZeroExit)&&ke.mono_wasm_print_thread_dump&&void 0===Ue.exitCode)try{ke.mono_wasm_print_thread_dump()}catch(e){}eo(1,e||Ue.exitReason)}function eo(e,o){var t,n;const r=o&&"object"==typeof o;e=r&&"number"==typeof o.status?o.status:void 0===e?-1:e;const i=r&&"string"==typeof o.message?o.message:""+o;(o=r?o:ke.ExitStatus?function(e,o){const t=new ke.ExitStatus(e);return t.message=o,t.toString=()=>o,t}(e,i):new Error("Exit with code "+e+" "+i)).status=e,o.message||(o.message=i);const s=""+(o.stack||(new Error).stack);try{Object.defineProperty(o,"stack",{get:()=>s})}catch(e){}const a=!!o.silent;if(o.silent=!0,Je())Ue.diagnosticTracing&&p("mono_exit called after exit");else{try{Fe.onAbort==Ye&&(Fe.onAbort=Ze),Fe.onExit==Xe&&(Fe.onExit=Ge),Oe&&(globalThis.removeEventListener("unhandledrejection",to),globalThis.removeEventListener("error",no)),ke.runtimeReady?(ke.jiterpreter_dump_stats&&ke.jiterpreter_dump_stats(!1),0===e&&(null===(t=Ue.config)||void 0===t?void 0:t.interopCleanupOnExit)&&ke.forceDisposeProxies(!0,!0),0!==e&&(null===(n=Ue.config)||void 0===n?void 0:n.dumpThreadsOnNonZeroExit)&&ke.dumpThreads()):(Ue.diagnosticTracing&&p(`abort_startup, reason: ${o}`),function(e){Ue.allDownloadsQueued.promise_control.reject(e),Ue.allDownloadsFinished.promise_control.reject(e),Ue.afterConfigLoaded.promise_control.reject(e),Ue.wasmCompilePromise.promise_control.reject(e),Ue.runtimeModuleLoaded.promise_control.reject(e),ke.dotnetReady&&(ke.dotnetReady.promise_control.reject(e),ke.afterInstantiateWasm.promise_control.reject(e),ke.afterPreRun.promise_control.reject(e),ke.beforeOnRuntimeInitialized.promise_control.reject(e),ke.afterOnRuntimeInitialized.promise_control.reject(e),ke.afterPostRun.promise_control.reject(e))}(o))}catch(e){w("mono_exit A failed",e)}try{a||(function(e,o){if(0!==e&&o){const e=ke.ExitStatus&&o instanceof ke.ExitStatus?p:y;"string"==typeof o?e(o):(void 0===o.stack&&(o.stack=(new Error).stack+""),o.message?e(ke.stringify_as_error_with_stack?ke.stringify_as_error_with_stack(o.message+"\n"+o.stack):o.message+"\n"+o.stack):e(JSON.stringify(o)))}!Pe&&Ue.config&&(Ue.config.logExitCode?Ue.config.forwardConsole?R("WASM EXIT "+e):b("WASM EXIT "+e):Ue.config.forwardConsole&&R())}(e,o),function(e){if(Oe&&!Pe&&Ue.config&&Ue.config.appendElementOnExit&&document){const o=document.createElement("label");o.id="tests_done",0!==e&&(o.style.background="red"),o.innerHTML=""+e,document.body.appendChild(o)}}(e))}catch(e){w("mono_exit B failed",e)}Ue.exitCode=e,Ue.exitReason||(Ue.exitReason=o),!Pe&&ke.runtimeReady&&Fe.runtimeKeepalivePop()}if(Ue.config&&Ue.config.asyncFlushOnExit&&0===e)throw(async()=>{try{await async function(){if(Se)try{const e=await import(/*! webpackIgnore: true */"process"),o=e=>new Promise((o,t)=>{e.on("error",t),e.end("","utf8",o)}),t=o(e.stderr),n=o(e.stdout);let r;const i=new Promise(e=>{r=setTimeout(()=>e("timeout"),1e3)});await Promise.race([Promise.all([n,t]),i]),clearTimeout(r)}catch(e){y(`flushing std* streams failed: ${e}`)}}()}finally{oo(e,o)}})(),o;oo(e,o)}function oo(e,o){if(Pe&&ke.runtimeReady&&ke.nativeAbort)throw ke.nativeAbort(o),o;if(ke.runtimeReady&&ke.nativeExit)try{ke.nativeExit(e)}catch(e){!ke.ExitStatus||e instanceof ke.ExitStatus||w("set_exit_code_and_quit_now failed: "+e.toString())}if(0!==e||!Oe)throw Se?process.exit(e):ke.quit&&ke.quit(e,o),o}function to(e){ro(e,e.reason,"rejection")}function no(e){ro(e,e.error,"error")}function ro(e,o,t){e.preventDefault();try{o||(o=new Error("Unhandled "+t)),void 0===o.stack&&(o.stack=(new Error).stack),o.stack=o.stack+"",o.silent||(y("Unhandled error:",o),eo(1,o))}catch(e){}}!function(n){if(ze)throw new Error("Loader module already loaded");ze=!0,ke=n.runtimeHelpers,Ue=n.loaderHelpers,Ne=n.diagnosticHelpers,Le=n.api,$e=n.internal,Object.assign(Le,{INTERNAL:$e,invokeLibraryInitializers:ye}),Object.assign(n.module,{config:_e(We,{environmentVariables:{}})});const a={mono_wasm_bindings_is_ready:!1,config:n.module.config,diagnosticTracing:!1,nativeAbort:e=>{throw e||new Error("abort")},nativeExit:e=>{throw new Error("exit:"+e)}},l={gitHash:"d3ef958a3712691b1af805be4724e41f9264ac34",config:n.module.config,diagnosticTracing:!1,maxParallelDownloads:16,enableDownloadRetry:!0,_loaded_files:[],loadedFiles:[],loadedAssemblies:[],libraryInitializers:[],workerNextNumber:1,actual_downloaded_assets_count:0,actual_instantiated_assets_count:0,expected_downloaded_assets_count:0,expected_instantiated_assets_count:0,afterConfigLoaded:r(),allDownloadsQueued:r(),allDownloadsFinished:r(),wasmCompilePromise:r(),runtimeModuleLoaded:r(),loadingWorkers:r(),is_exited:Je,is_runtime_running:qe,assert_runtime_running:He,mono_exit:eo,createPromiseController:r,getPromiseController:i,assertIsControllablePromise:s,mono_download_assets:ne,resolve_single_asset_path:oe,setup_proxy_console:E,set_thread_prefix:g,installUnhandledErrorHandler:Qe,retrieve_asset_download:se,invokeLibraryInitializers:ye,isDebuggingSupported:je,exceptionsFinal:e,simd:t,relaxedSimd:o};Object.assign(ke,a),Object.assign(Ue,l)}(Be);let io,so,ao,lo=!1,co=!1;async function uo(e){if(!co){if(co=!0,Oe&&Ue.config.forwardConsole&&void 0!==globalThis.WebSocket&&E("main",globalThis.console,globalThis.location.origin),Fe||Ve(!1,"Null moduleConfig"),Ue.config||Ve(!1,"Null moduleConfig.config"),"function"==typeof e){const o=e(Be.api);if(o.ready)throw new Error("Module.ready couldn't be redefined.");Object.assign(Fe,o),Ae(Fe,o)}else{if("object"!=typeof e)throw new Error("Can't use moduleFactory callback of createDotnetRuntime function.");Ae(Fe,e)}await C(Fe)}}async function mo(e){return await uo(e),Ue.config.exitOnUnhandledError&&Qe(),Ke(),async function(){var e;await Re(Fe),ie();const o=fo();(async function(){try{const e=oe("dotnetwasm");await ae(e),e&&e.pendingDownloadInternal&&e.pendingDownloadInternal.response||Ve(!1,"Can't load dotnet.native.wasm");const o=await e.pendingDownloadInternal.response,t=o.headers&&o.headers.get?o.headers.get("Content-Type"):void 0;let n;if("function"==typeof WebAssembly.compileStreaming&&"application/wasm"===t)n=await WebAssembly.compileStreaming(o);else{Oe&&"application/wasm"!==t&&w('WebAssembly resource does not have the expected content type "application/wasm", so falling back to slower ArrayBuffer instantiation.');const e=await o.arrayBuffer();Ue.diagnosticTracing&&p("instantiate_wasm_module buffered"),n=Ce?await Promise.resolve(new WebAssembly.Module(e)):await WebAssembly.compile(e)}e.pendingDownloadInternal=null,e.pendingDownload=null,e.buffer=null,e.moduleExports=null,Ue.wasmCompilePromise.promise_control.resolve(n)}catch(e){Ue.wasmCompilePromise.promise_control.reject(e)}})(),setTimeout(async()=>{try{D(),function(){const e=[];for(let o=0;o<Ue.config.pthreadPoolInitialSize;o++){const o=Ue.workerNextNumber++,t=new Worker(Ue.scriptUrl,{name:"dotnet-worker-"+o.toString().padStart(3,"0"),type:"module"});t.info={workerNumber:o,pthreadId:0,reuseCount:0,updateCount:0,threadPrefix:"          -    ",threadName:"emscripten-pool"},t.queue=[],t.handler=e=>t.queue.push(e),t.addEventListener("message",t.handler),e.push(t)}Ue.loadingWorkers.promise_control.resolve(e)}(),await ne()}catch(e){eo(1,e)}},0);const t=await Promise.all(o);return await go(t),await ke.dotnetReady.promise,await we(null===(e=Ue.config.resources)||void 0===e?void 0:e.modulesAfterRuntimeReady),await ye("onRuntimeReady",[Be.api]),Le}()}function fo(){const e=oe("js-module-runtime"),o=oe("js-module-native");if(io&&so)return[io,so,ao];"object"==typeof e.moduleExports?io=e.moduleExports:(Ue.diagnosticTracing&&p(`Attempting to import '${e.resolvedUrl}' for ${e.name}`),io=import(/*! webpackIgnore: true */e.resolvedUrl)),"object"==typeof o.moduleExports?so=o.moduleExports:(Ue.diagnosticTracing&&p(`Attempting to import '${o.resolvedUrl}' for ${o.name}`),so=import(/*! webpackIgnore: true */o.resolvedUrl));const t=ee("js-module-diagnostics");return t&&("object"==typeof t.moduleExports?ao=t.moduleExports:(Ue.diagnosticTracing&&p(`Attempting to import '${t.resolvedUrl}' for ${t.name}`),ao=import(/*! webpackIgnore: true */t.resolvedUrl))),[io,so,ao]}async function go(e){const{initializeExports:o,initializeReplacements:t,configureRuntimeStartup:n,configureEmscriptenStartup:r,configureWorkerStartup:i,setRuntimeGlobals:s,passEmscriptenInternals:a}=e[0],{default:l}=e[1],c=e[2];s(Be),o(Be),c&&c.setRuntimeGlobals(Be),await n(Fe),Ue.runtimeModuleLoaded.promise_control.resolve(),l(()=>(Object.assign(Fe,{__dotnet_runtime:{initializeReplacements:t,configureEmscriptenStartup:r,configureWorkerStartup:i,passEmscriptenInternals:a}}),Fe)).catch(e=>{if(e.message&&e.message.toLowerCase().includes("out of memory"))throw new Error(".NET runtime has failed to start, because too much memory was requested. Please decrease the memory by adjusting EmccMaximumHeapSize.");throw e})}Pe&&async function(){(function(){const e=new MessageChannel,o=e.port1,t=e.port2;o.addEventListener("message",e=>{e.data.webcilModules&&(globalThis.__monoWebcilModules=e.data.webcilModules),function(e){const o=JSON.parse(e.config),t=JSON.parse(e.monoThreadInfo);Fe.config=o,Fe.wasmModule=e.wasmModule,Fe.wasmMemory=e.wasmMemory,Fe.handlers=e.handlers,lo?Ue.diagnosticTracing&&p("mono config already received"):(_e(Ue.config,o),ke.monoThreadInfo=t,xe(),Ue.diagnosticTracing&&p("mono config received"),lo=!0,Ue.afterConfigLoaded.promise_control.resolve(Ue.config),Oe&&o.forwardConsole&&void 0!==globalThis.WebSocket&&Ue.setup_proxy_console("worker-idle",console,globalThis.location.origin))}(e.data),o.close(),t.close()},{once:!0}),o.start(),self.postMessage({[a]:{monoCmd:"preload",port:t}},[t])})(),await Ue.afterConfigLoaded.promise,function(){const e=Ue.config;e.assets||Ve(!1,"config.assets must be defined");for(const o of e.assets)Y(o),G[o.behavior]&&W.push(o)}(),await C(Fe);const e=fo(),o=await Promise.all(e);return globalThis.name="em-pthread",await go(o),Ue.config.exitOnUnhandledError&&Qe(),Ke(),Oe&&Ue.config.forwardConsole&&void 0!==globalThis.WebSocket&&E("main",globalThis.console,globalThis.location.origin),await ne(),self.dispatchEvent(new MessageEvent("message",{data:{cmd:1,handlers:Fe.handlers,wasmMemory:Fe.wasmMemory,wasmModule:Fe.wasmModule}})),Fe}().catch(e=>eo(1,e));const po=new class{withModuleConfig(e){try{return Ae(Fe,e),this}catch(e){throw eo(1,e),e}}withInterpreterPgo(e,o){try{return _e(We,{interpreterPgo:e,interpreterPgoSaveDelay:o}),We.runtimeOptions?We.runtimeOptions.push("--interp-pgo-recording"):We.runtimeOptions=["--interp-pgo-recording"],this}catch(e){throw eo(1,e),e}}withConfig(e){try{return _e(We,e),this}catch(e){throw eo(1,e),e}}withConfigSrc(e){return this}withVirtualWorkingDirectory(e){try{return e&&"string"==typeof e||Ve(!1,"must be directory path"),_e(We,{virtualWorkingDirectory:e}),this}catch(e){throw eo(1,e),e}}withEnvironmentVariable(e,o){try{const t={};return t[e]=o,_e(We,{environmentVariables:t}),this}catch(e){throw eo(1,e),e}}withEnvironmentVariables(e){try{return e&&"object"==typeof e||Ve(!1,"must be dictionary object"),_e(We,{environmentVariables:e}),this}catch(e){throw eo(1,e),e}}withDiagnosticTracing(e){try{return"boolean"!=typeof e&&Ve(!1,"must be boolean"),_e(We,{diagnosticTracing:e}),this}catch(e){throw eo(1,e),e}}withDebugging(e){try{return null!=e&&"number"==typeof e||Ve(!1,"must be number"),_e(We,{debugLevel:e}),this}catch(e){throw eo(1,e),e}}withApplicationArguments(...e){try{return e&&Array.isArray(e)||Ve(!1,"must be array of strings"),_e(We,{applicationArguments:e}),this}catch(e){throw eo(1,e),e}}withRuntimeOptions(e){try{return e&&Array.isArray(e)||Ve(!1,"must be array of strings"),We.runtimeOptions?We.runtimeOptions.push(...e):We.runtimeOptions=e,this}catch(e){throw eo(1,e),e}}withMainAssembly(e){try{return _e(We,{mainAssemblyName:e}),this}catch(e){throw eo(1,e),e}}withApplicationArgumentsFromQuery(){try{if(!globalThis.window)throw new Error("Missing window to the query parameters from");if(void 0===globalThis.URLSearchParams)throw new Error("URLSearchParams is supported");const e=new URLSearchParams(globalThis.window.location.search).getAll("arg");return this.withApplicationArguments(...e)}catch(e){throw eo(1,e),e}}withApplicationEnvironment(e){try{return _e(We,{applicationEnvironment:e}),this}catch(e){throw eo(1,e),e}}withApplicationCulture(e){try{return _e(We,{applicationCulture:e}),this}catch(e){throw eo(1,e),e}}withResourceLoader(e){try{return Ue.loadBootResource=e,this}catch(e){throw eo(1,e),e}}async download(){try{await async function(){uo(Fe),await Re(Fe),ie(),D(),ne(),await Ue.allDownloadsFinished.promise}()}catch(e){throw eo(1,e),e}}async create(){try{return this.instance||(this.instance=await async function(){return await mo(Fe),Be.api}()),this.instance}catch(e){throw eo(1,e),e}}run(){return this.runMainAndExit()}async runMainAndExit(){try{return Fe.config||Ve(!1,"Null moduleConfig.config"),this.instance||await this.create(),this.instance.runMainAndExit()}catch(e){throw eo(1,e),e}}async runMain(){try{return Fe.config||Ve(!1,"Null moduleConfig.config"),this.instance||await this.create(),this.instance.runMain()}catch(e){throw eo(1,e),e}}},ho=eo,bo=mo;Ce||"function"==typeof globalThis.URL||Ve(!1,"This browser/engine doesn't support URL API. Please use a modern version."),"function"!=typeof globalThis.BigInt64Array&&Ve(!1,"This browser/engine doesn't support BigInt64Array API. Please use a modern version. See also https://learn.microsoft.com/aspnet/core/blazor/supported-platforms"),globalThis.performance&&"function"==typeof globalThis.performance.now||Ve(!1,"This browser/engine doesn't support performance.now. Please use a modern version."),Ce||globalThis.crypto&&"object"==typeof globalThis.crypto.subtle||Ve(!1,"This engine doesn't support crypto.subtle. Please use a modern version."),Ce||globalThis.crypto&&"function"==typeof globalThis.crypto.getRandomValues||Ve(!1,"This engine doesn't support crypto.getRandomValues. Please use a modern version."),Se&&"function"!=typeof process.exit&&Ve(!1,"This engine doesn't support process.exit. Please use a modern version."),(Ce||Se)&&Ve(!1,"This build of dotnet is multi-threaded, it doesn't support shell environments like V8 or NodeJS."),void 0===globalThis.SharedArrayBuffer&&Ve(!1,"SharedArrayBuffer is not enabled on this page. Please use a modern browser and set Cross-Origin-Opener-Policy and Cross-Origin-Embedder-Policy http headers."),"function"!=typeof globalThis.EventTarget&&Ve(!1,"This browser/engine doesn't support EventTarget API. Please use a modern version. See also https://learn.microsoft.com/aspnet/core/blazor/supported-platforms"),po.withConfig(/*json-start*/{
  "mainAssemblyName": "IkvmWasm",
  "resources": {
    "hash": "sha256-Hr5rq0pgbxzMaBxIGtGjDAP1VEkGsPyJwgZTwriJJMY=",
    "jsModuleNative": [
      {
        "name": "dotnet.native.u6jrs8lzdz.js"
      }
    ],
    "jsModuleRuntime": [
      {
        "name": "dotnet.runtime.uqu9j4iyhz.js"
      }
    ],
    "wasmNative": [
      {
        "name": "dotnet.native.b6bvieg7s0.wasm",
        "hash": "sha256-U1Tp6VbAjcFlXSIaaNAIZNsU3ndPy74Y3m0YdtExF40=",
        "cache": "force-cache"
      }
    ],
    "icu": [
      {
        "virtualPath": "icudt_CJK.dat",
        "name": "icudt_CJK.5lgyv9xn0b.dat",
        "hash": "sha256-eZuX0pntrUwNrAmFCMwpxJjFA3/Myi/rW2x9mEZ+Mbg=",
        "cache": "force-cache"
      },
      {
        "virtualPath": "icudt_EFIGS.dat",
        "name": "icudt_EFIGS.xyuimhy3ww.dat",
        "hash": "sha256-SQcxb+bdx2UXUCU9tFdOWCr4Ctk64xghCnr0JGLWWKQ=",
        "cache": "force-cache"
      },
      {
        "virtualPath": "icudt_no_CJK.dat",
        "name": "icudt_no_CJK.h0en30vv0c.dat",
        "hash": "sha256-T8YllylpxyWp9Aq4AiF+BMAxKXqYyzWB9RA5RqY19vs=",
        "cache": "force-cache"
      }
    ],
    "coreAssembly": [
      {
        "payloadSize": 899152,
        "virtualPath": "IKVM.ByteCode.wasm",
        "name": "IKVM.ByteCode.g3yyu6lc1u.wasm",
        "hash": "sha256-HOcpDtSMKhxC0vP9jtOWI1Whv+G2umhyHx4eSsf4NOs=",
        "cache": "force-cache"
      },
      {
        "payloadSize": 781904,
        "virtualPath": "IKVM.CoreLib.wasm",
        "name": "IKVM.CoreLib.02kaemjyc9.wasm",
        "hash": "sha256-CBo7ujUftIZJLEOzMuBiIB6Kz8GHBVnpsFWHPETvDhc=",
        "cache": "force-cache"
      },
      {
        "payloadSize": 86215248,
        "virtualPath": "IKVM.Java.wasm",
        "name": "IKVM.Java.li66ykxjnb.wasm",
        "hash": "sha256-fWiznBwsPCQV6I1ePjevpOg6+dnuXGf4mHobjXtSfhc=",
        "cache": "force-cache"
      },
      {
        "payloadSize": 1218112,
        "virtualPath": "IKVM.Runtime.wasm",
        "name": "IKVM.Runtime.nw8xbulqie.wasm",
        "hash": "sha256-V5754kNrhbMdXf0GAukJ0CPcvckc4ZCW7F+7ckyRfjU=",
        "cache": "force-cache"
      },
      {
        "payloadSize": 102992,
        "virtualPath": "IkvmWasm.wasm",
        "name": "IkvmWasm.smfd40zor2.wasm",
        "hash": "sha256-ZEQYVYrU0n8hKfTQT/RzwLN8oEpvzMjGlH+bavvPQvA=",
        "cache": "force-cache"
      },
      {
        "payloadSize": 300624,
        "virtualPath": "Microsoft.CSharp.wasm",
        "name": "Microsoft.CSharp.ur9jvvl6td.wasm",
        "hash": "sha256-OuMUjAV6VLBQpu559sQVx0gjaLPjIuR9v06g2d/QAqM=",
        "cache": "force-cache"
      },
      {
        "payloadSize": 32848,
        "virtualPath": "Microsoft.Extensions.Caching.Abstractions.wasm",
        "name": "Microsoft.Extensions.Caching.Abstractions.t8f98s093j.wasm",
        "hash": "sha256-be18g5flMfcMgc8aflzQZxB+idn07zY/hIINhIxYJSQ=",
        "cache": "force-cache"
      },
      {
        "payloadSize": 16464,
        "virtualPath": "Microsoft.Extensions.Configuration.Abstractions.wasm",
        "name": "Microsoft.Extensions.Configuration.Abstractions.ux2x016e70.wasm",
        "hash": "sha256-3u7UoHT3kCrSYWXeVldMS2akxw2/3gRD+aIow3qNF/0=",
        "cache": "force-cache"
      },
      {
        "payloadSize": 56912,
        "virtualPath": "Microsoft.Extensions.DependencyInjection.Abstractions.wasm",
        "name": "Microsoft.Extensions.DependencyInjection.Abstractions.cgfd2uk4f9.wasm",
        "hash": "sha256-fEm1x2nrxrlu8HIRrdGvY9o5ipkaMlAukVhKiMsSQqw=",
        "cache": "force-cache"
      },
      {
        "payloadSize": 17488,
        "virtualPath": "Microsoft.Extensions.Diagnostics.Abstractions.wasm",
        "name": "Microsoft.Extensions.Diagnostics.Abstractions.tqbeoy98bq.wasm",
        "hash": "sha256-9aI3mAwNaCEGAU3Ca0T4jh+Mk5QNQW/SdF1HWMsF3AM=",
        "cache": "force-cache"
      },
      {
        "payloadSize": 11344,
        "virtualPath": "Microsoft.Extensions.FileProviders.Abstractions.wasm",
        "name": "Microsoft.Extensions.FileProviders.Abstractions.6i2s6ofcdk.wasm",
        "hash": "sha256-rhGnRJqkShVAWotlpXC+5kJoxZe7bm4Xhei8zvkwUrk=",
        "cache": "force-cache"
      },
      {
        "payloadSize": 22096,
        "virtualPath": "Microsoft.Extensions.Hosting.Abstractions.wasm",
        "name": "Microsoft.Extensions.Hosting.Abstractions.gm8p5c3zce.wasm",
        "hash": "sha256-GENq6QgHg/rvRfe/0tyD/JAifdA+Eq01W1xvGQm5CLA=",
        "cache": "force-cache"
      },
      {
        "payloadSize": 56400,
        "virtualPath": "Microsoft.Extensions.Logging.Abstractions.wasm",
        "name": "Microsoft.Extensions.Logging.Abstractions.rqdmjdsgmy.wasm",
        "hash": "sha256-E/YY5xJX8igXwzj6sE4RWrsT8/2d6r4f7DztWgHpKb8=",
        "cache": "force-cache"
      },
      {
        "payloadSize": 97872,
        "virtualPath": "Microsoft.Extensions.Options.wasm",
        "name": "Microsoft.Extensions.Options.mkr1fs4za5.wasm",
        "hash": "sha256-1qB4NVX9cxUGJ0Nt9GOqz+0BscJSOzsaaRR2G19Zcps=",
        "cache": "force-cache"
      },
      {
        "payloadSize": 35408,
        "virtualPath": "Microsoft.Extensions.Primitives.wasm",
        "name": "Microsoft.Extensions.Primitives.1zkdm58uz8.wasm",
        "hash": "sha256-k0q2drV5u5LmT8ZvxClstTxbHaNjty1UIlwGtDOD4os=",
        "cache": "force-cache"
      },
      {
        "payloadSize": 418384,
        "virtualPath": "Microsoft.VisualBasic.Core.wasm",
        "name": "Microsoft.VisualBasic.Core.elpq4s4yxj.wasm",
        "hash": "sha256-7sf+g+uWYPDKiDrHZLjzBOKnarfWm6Vaj3AdKFNAsL4=",
        "cache": "force-cache"
      },
      {
        "payloadSize": 6736,
        "virtualPath": "Microsoft.VisualBasic.wasm",
        "name": "Microsoft.VisualBasic.pzykqlnda0.wasm",
        "hash": "sha256-JWyWQwM410calUS6eXe2PG5IkDUPUjKisRKOxUZc3JA=",
        "cache": "force-cache"
      },
      {
        "payloadSize": 5200,
        "virtualPath": "Microsoft.Win32.Primitives.wasm",
        "name": "Microsoft.Win32.Primitives.g0q9vi7133.wasm",
        "hash": "sha256-8KKnhlCT74UT7f/sr1EslfthcoYO7VaeowyOmD/NCEM=",
        "cache": "force-cache"
      },
      {
        "payloadSize": 22608,
        "virtualPath": "Microsoft.Win32.Registry.wasm",
        "name": "Microsoft.Win32.Registry.63fddj8ncy.wasm",
        "hash": "sha256-XtkaWGftuAjf3e3OgqTcLmkNiMhYC3m7+HdneZKRAoA=",
        "cache": "force-cache"
      },
      {
        "payloadSize": 4688,
        "virtualPath": "System.AppContext.wasm",
        "name": "System.AppContext.8cpavkwfpm.wasm",
        "hash": "sha256-OFKAhORdwEeaSPPWyPGo720X8Oanef8Q1D1c/sEiy50=",
        "cache": "force-cache"
      },
      {
        "payloadSize": 4688,
        "virtualPath": "System.Buffers.wasm",
        "name": "System.Buffers.feml4flf8e.wasm",
        "hash": "sha256-p5SXmKM12gR4+E91JovWDuJGGuPLbG8Dmf3tnpDP/3M=",
        "cache": "force-cache"
      },
      {
        "payloadSize": 53328,
        "virtualPath": "System.Collections.Concurrent.wasm",
        "name": "System.Collections.Concurrent.qzoz262l2i.wasm",
        "hash": "sha256-uhwgbQeBEsPPP5wUQRky72jj6I2z98Uv1bDPOu9yISc=",
        "cache": "force-cache"
      },
      {
        "payloadSize": 242256,
        "virtualPath": "System.Collections.Immutable.wasm",
        "name": "System.Collections.Immutable.z993xn88rj.wasm",
        "hash": "sha256-t042T/HnIiI9u+lEU3amw2wioMll7VlQZsqGPzMAgsw=",
        "cache": "force-cache"
      },
      {
        "payloadSize": 37456,
        "virtualPath": "System.Collections.NonGeneric.wasm",
        "name": "System.Collections.NonGeneric.lyohvianbo.wasm",
        "hash": "sha256-nf9POE9N6DkTzNlTJwcpr7H9IOMX9xaqEP07KCyxodQ=",
        "cache": "force-cache"
      },
      {
        "payloadSize": 37456,
        "virtualPath": "System.Collections.Specialized.wasm",
        "name": "System.Collections.Specialized.p1z40jw1v9.wasm",
        "hash": "sha256-kwnveVTXjxeQTDQJB36V82519WDEmuTYhKqiDH+O63Y=",
        "cache": "force-cache"
      },
      {
        "payloadSize": 102480,
        "virtualPath": "System.Collections.wasm",
        "name": "System.Collections.gtxd23ewf0.wasm",
        "hash": "sha256-dPpGa1FxDAcxvpdqDLO2tWXcSUfVoKYlXhpDE1tUWPw=",
        "cache": "force-cache"
      },
      {
        "payloadSize": 109136,
        "virtualPath": "System.ComponentModel.Annotations.wasm",
        "name": "System.ComponentModel.Annotations.1d1onzuc8p.wasm",
        "hash": "sha256-GyDiAGKkjCzQ/JvkIdVIRasE9oED8VbY/gfjSC+wHLc=",
        "cache": "force-cache"
      },
      {
        "payloadSize": 6224,
        "virtualPath": "System.ComponentModel.DataAnnotations.wasm",
        "name": "System.ComponentModel.DataAnnotations.vb09uxrze3.wasm",
        "hash": "sha256-69up/9RqbL5VVEZtYW6LJcWuKN814fkJjPtcZtD6UGA=",
        "cache": "force-cache"
      },
      {
        "payloadSize": 15952,
        "virtualPath": "System.ComponentModel.EventBasedAsync.wasm",
        "name": "System.ComponentModel.EventBasedAsync.qqt6zf3yyr.wasm",
        "hash": "sha256-7tSaXkPtHPukaKixHBQ/Fzku2OUvUB8LB2W7XyI57eU=",
        "cache": "force-cache"
      },
      {
        "payloadSize": 31824,
        "virtualPath": "System.ComponentModel.Primitives.wasm",
        "name": "System.ComponentModel.Primitives.e6wiol74jt.wasm",
        "hash": "sha256-Zm+d7Pr42MMFG0pz4lUK+r4+dD/SqHgDTXa3vaZCL1Q=",
        "cache": "force-cache"
      },
      {
        "payloadSize": 307280,
        "virtualPath": "System.ComponentModel.TypeConverter.wasm",
        "name": "System.ComponentModel.TypeConverter.7mof9koic0.wasm",
        "hash": "sha256-oVxDgxowvbj7ejDZMXtS5cYK/zhusuY3EF2tARqa/d4=",
        "cache": "force-cache"
      },
      {
        "payloadSize": 5712,
        "virtualPath": "System.ComponentModel.wasm",
        "name": "System.ComponentModel.ku3snn404u.wasm",
        "hash": "sha256-fHUOQv1yCrcqD8h0pTNr/Fa9de5kcClv2lExiWCbClY=",
        "cache": "force-cache"
      },
      {
        "payloadSize": 8784,
        "virtualPath": "System.Configuration.wasm",
        "name": "System.Configuration.yfxcm3izez.wasm",
        "hash": "sha256-TtYYeHy9ykNXu5pAa3ztfLn0hRzeJdVfezXPh1RdrP0=",
        "cache": "force-cache"
      },
      {
        "payloadSize": 43088,
        "virtualPath": "System.Console.wasm",
        "name": "System.Console.x0bkwdrgak.wasm",
        "hash": "sha256-L2e+7BX4FU2Nu8te+26WF96BNwcz/0fKugytmDi482I=",
        "cache": "force-cache"
      },
      {
        "payloadSize": 12368,
        "virtualPath": "System.Core.wasm",
        "name": "System.Core.fi1wok9v6l.wasm",
        "hash": "sha256-pweuWPoHztwP9cicdbHtO8kTckx9TpFVkHoXWd0WvT0=",
        "cache": "force-cache"
      },
      {
        "payloadSize": 1007184,
        "virtualPath": "System.Data.Common.wasm",
        "name": "System.Data.Common.mufdon6vl5.wasm",
        "hash": "sha256-foVS602IVLd2klyqaERCJGKhU+im6JlP/xAyayCsr4Y=",
        "cache": "force-cache"
      },
      {
        "payloadSize": 5200,
        "virtualPath": "System.Data.DataSetExtensions.wasm",
        "name": "System.Data.DataSetExtensions.xru8v7mang.wasm",
        "hash": "sha256-zSi8NBRf3ilYFoU0Ii6bD4nF95V4o/c7V4v2ZQxW9zk=",
        "cache": "force-cache"
      },
      {
        "payloadSize": 14416,
        "virtualPath": "System.Data.wasm",
        "name": "System.Data.bdw3usvy2f.wasm",
        "hash": "sha256-nwRzUm/xUg046GH7euqfPfWwY9EwuKQZ3FfofflIDVA=",
        "cache": "force-cache"
      },
      {
        "payloadSize": 5712,
        "virtualPath": "System.Diagnostics.Contracts.wasm",
        "name": "System.Diagnostics.Contracts.pdodqlx5k6.wasm",
        "hash": "sha256-UyUI/VBq8UbWAa7uvCPHuYttb4h89cUqyu/1nG5ZPh4=",
        "cache": "force-cache"
      },
      {
        "payloadSize": 5200,
        "virtualPath": "System.Diagnostics.Debug.wasm",
        "name": "System.Diagnostics.Debug.nlirctw5w4.wasm",
        "hash": "sha256-FQkLrWV9NWfwOP7C0cl2Uwd6U2u0PwGkoZIp4wX7qo8=",
        "cache": "force-cache"
      },
      {
        "payloadSize": 198224,
        "virtualPath": "System.Diagnostics.DiagnosticSource.wasm",
        "name": "System.Diagnostics.DiagnosticSource.zswimavppo.wasm",
        "hash": "sha256-k+Qb/wXnOMA0cYvAwpkMBCT1IYubfTch0q4H4eGAeI4=",
        "cache": "force-cache"
      },
      {
        "payloadSize": 11856,
        "virtualPath": "System.Diagnostics.FileVersionInfo.wasm",
        "name": "System.Diagnostics.FileVersionInfo.hx6qkdtajg.wasm",
        "hash": "sha256-ld3zfU2he313l3V+J9rsCbO63jZtU8uML4M8ahrkxtw=",
        "cache": "force-cache"
      },
      {
        "payloadSize": 58448,
        "virtualPath": "System.Diagnostics.Process.wasm",
        "name": "System.Diagnostics.Process.7hk1otwitv.wasm",
        "hash": "sha256-FbYXl55QzKHidhT2CuMbvXPZChpNgYlSAoITSqmFeuo=",
        "cache": "force-cache"
      },
      {
        "payloadSize": 15440,
        "virtualPath": "System.Diagnostics.StackTrace.wasm",
        "name": "System.Diagnostics.StackTrace.639rymeutp.wasm",
        "hash": "sha256-wkD0i7TxVzpcj+jsDtyyBTNCkp1DUUo/EDTI+vGxucQ=",
        "cache": "force-cache"
      },
      {
        "payloadSize": 21072,
        "virtualPath": "System.Diagnostics.TextWriterTraceListener.wasm",
        "name": "System.Diagnostics.TextWriterTraceListener.plha0cao62.wasm",
        "hash": "sha256-ncfx+LTJh1cXzK2JdO/3npL6kRl4QcSNrT5hmqDu+bI=",
        "cache": "force-cache"
      },
      {
        "payloadSize": 4688,
        "virtualPath": "System.Diagnostics.Tools.wasm",
        "name": "System.Diagnostics.Tools.r6yjp4n5gn.wasm",
        "hash": "sha256-LdNYVgjPZp+14KJRcTq0UHHQKKLfJK8/4E8mZYhLZ+s=",
        "cache": "force-cache"
      },
      {
        "payloadSize": 48208,
        "virtualPath": "System.Diagnostics.TraceSource.wasm",
        "name": "System.Diagnostics.TraceSource.971hm6kygs.wasm",
        "hash": "sha256-q3HOy7PyCHKRxJXA6d7ikXhL2aLMgFKMv1OYEFNgrtI=",
        "cache": "force-cache"
      },
      {
        "payloadSize": 5712,
        "virtualPath": "System.Diagnostics.Tracing.wasm",
        "name": "System.Diagnostics.Tracing.tbo9x7vgvr.wasm",
        "hash": "sha256-l+8O4JZnyZ/AmM+dx2zIwxt6UFo8W2husR894JPXEF4=",
        "cache": "force-cache"
      },
      {
        "payloadSize": 54352,
        "virtualPath": "System.Drawing.Primitives.wasm",
        "name": "System.Drawing.Primitives.e4knvjq3m7.wasm",
        "hash": "sha256-Yi+W0thV3nyeiQsY2M0Jep8EOVdXnS4EKgVxHbn25TA=",
        "cache": "force-cache"
      },
      {
        "payloadSize": 9808,
        "virtualPath": "System.Drawing.wasm",
        "name": "System.Drawing.juudu2ejlx.wasm",
        "hash": "sha256-a6Ma9IZdyDIfb7mDWOTX1IbUQUowFm0oMT6cNs5SGtI=",
        "cache": "force-cache"
      },
      {
        "payloadSize": 5712,
        "virtualPath": "System.Dynamic.Runtime.wasm",
        "name": "System.Dynamic.Runtime.g6wkshf88r.wasm",
        "hash": "sha256-6E9pc7/QvvZ4aQDBmZ6yC3HKq2zPHa4YFKtnFS7yeSk=",
        "cache": "force-cache"
      },
      {
        "payloadSize": 96848,
        "virtualPath": "System.Formats.Asn1.wasm",
        "name": "System.Formats.Asn1.wvqvpjsc4x.wasm",
        "hash": "sha256-3D4Kx0iLDTl/nhsEC9qxwGDRRw8CXickfAffsedsMbE=",
        "cache": "force-cache"
      },
      {
        "payloadSize": 30288,
        "virtualPath": "System.Formats.Tar.wasm",
        "name": "System.Formats.Tar.1go44c94vc.wasm",
        "hash": "sha256-wRj5AIc+mJQ9+hWUyYy+9zfL5yLeAcApMduN9e39/so=",
        "cache": "force-cache"
      },
      {
        "payloadSize": 5200,
        "virtualPath": "System.Globalization.Calendars.wasm",
        "name": "System.Globalization.Calendars.drh99xa2j5.wasm",
        "hash": "sha256-11B5rNBFt9r5xQo9PsNvCXEELTxSfFj/7jWaL8KkymY=",
        "cache": "force-cache"
      },
      {
        "payloadSize": 5200,
        "virtualPath": "System.Globalization.Extensions.wasm",
        "name": "System.Globalization.Extensions.hd1m07m9pw.wasm",
        "hash": "sha256-dcweOgEI2XorsAICQJhRdKUcnYtrMo3z04ViILCwr+A=",
        "cache": "force-cache"
      },
      {
        "payloadSize": 5200,
        "virtualPath": "System.Globalization.wasm",
        "name": "System.Globalization.f6p4mi1427.wasm",
        "hash": "sha256-d8bcY1k1L3tgXua/FQwRodBY7lxyHnFV7ZIwOTK9y20=",
        "cache": "force-cache"
      },
      {
        "payloadSize": 17488,
        "virtualPath": "System.IO.Compression.Brotli.wasm",
        "name": "System.IO.Compression.Brotli.2eazup5wiu.wasm",
        "hash": "sha256-WlGR7Y8MIytZKPl6mVbqPTLuIGpWn99L8NcYaBjKZpw=",
        "cache": "force-cache"
      },
      {
        "payloadSize": 4688,
        "virtualPath": "System.IO.Compression.FileSystem.wasm",
        "name": "System.IO.Compression.FileSystem.bhewvyilog.wasm",
        "hash": "sha256-sUdypNoMYVrQigsNuLcHxQcZBCpAwTen5t87oBOhvD0=",
        "cache": "force-cache"
      },
      {
        "payloadSize": 56400,
        "virtualPath": "System.IO.Compression.ZipFile.wasm",
        "name": "System.IO.Compression.ZipFile.ohgz7xq93w.wasm",
        "hash": "sha256-xFYZ3GD9vbfrdsra9JCb2+qKpIZ31SZv7X1TKcZe7Dk=",
        "cache": "force-cache"
      },
      {
        "payloadSize": 210512,
        "virtualPath": "System.IO.Compression.wasm",
        "name": "System.IO.Compression.mydkqrbi4i.wasm",
        "hash": "sha256-rln6FIzKnIJ8CeVg9751Ptb55DJdI5szuYcCXX5GrpI=",
        "cache": "force-cache"
      },
      {
        "payloadSize": 21584,
        "virtualPath": "System.IO.FileSystem.AccessControl.wasm",
        "name": "System.IO.FileSystem.AccessControl.2r7fu50n5l.wasm",
        "hash": "sha256-AlnONLnODaH55/p+CPtbIyla2PPL9DEv/ye8BM3k5Wo=",
        "cache": "force-cache"
      },
      {
        "payloadSize": 13392,
        "virtualPath": "System.IO.FileSystem.DriveInfo.wasm",
        "name": "System.IO.FileSystem.DriveInfo.7817497llh.wasm",
        "hash": "sha256-CQZ3weqd7TilEx3PTFl60PZpFClTgkkFItE4kDx10dY=",
        "cache": "force-cache"
      },
      {
        "payloadSize": 4688,
        "virtualPath": "System.IO.FileSystem.Primitives.wasm",
        "name": "System.IO.FileSystem.Primitives.iucwsl9vxd.wasm",
        "hash": "sha256-Cmma4PKyC+5cGBVUJhcdcq2nFKKh1zqQUPeEAg0C81w=",
        "cache": "force-cache"
      },
      {
        "payloadSize": 22608,
        "virtualPath": "System.IO.FileSystem.Watcher.wasm",
        "name": "System.IO.FileSystem.Watcher.yhw4a70lw1.wasm",
        "hash": "sha256-hoMdMC+6wFwkfjf5JnZvCi/ASkksmONEZ6GoFQdzSJI=",
        "cache": "force-cache"
      },
      {
        "payloadSize": 5200,
        "virtualPath": "System.IO.FileSystem.wasm",
        "name": "System.IO.FileSystem.86ho7jtdw8.wasm",
        "hash": "sha256-EPCCLD8dv6urLVLYUTLDoLdw+0AcryRcVs+0nRwRs3E=",
        "cache": "force-cache"
      },
      {
        "payloadSize": 62544,
        "virtualPath": "System.IO.Hashing.wasm",
        "name": "System.IO.Hashing.bw4iwnem01.wasm",
        "hash": "sha256-tdpZA0hgO7mnZPpHMJp1Pelr6uXA38DXNBnbsB/7mUk=",
        "cache": "force-cache"
      },
      {
        "payloadSize": 24144,
        "virtualPath": "System.IO.IsolatedStorage.wasm",
        "name": "System.IO.IsolatedStorage.5db72d5vve.wasm",
        "hash": "sha256-Sdu+5oWkg5hjn3+i7WpK7AeflaaDXSR4z+YyFHHs6i0=",
        "cache": "force-cache"
      },
      {
        "payloadSize": 38480,
        "virtualPath": "System.IO.MemoryMappedFiles.wasm",
        "name": "System.IO.MemoryMappedFiles.urlnfo4h7y.wasm",
        "hash": "sha256-BuNBpl0+Uti/IaVQEM0U/Q/q2zGoL59Sk/3+PjBeQvU=",
        "cache": "force-cache"
      },
      {
        "payloadSize": 73296,
        "virtualPath": "System.IO.Pipelines.wasm",
        "name": "System.IO.Pipelines.cml26e1iez.wasm",
        "hash": "sha256-9CeaHifdHeBkrhYaFjOwCuq1GlmBJdtooqldViAzsKo=",
        "cache": "force-cache"
      },
      {
        "payloadSize": 12880,
        "virtualPath": "System.IO.Pipes.AccessControl.wasm",
        "name": "System.IO.Pipes.AccessControl.r4l9bacx6m.wasm",
        "hash": "sha256-OyaUKhVRl0EcFY+1WTAM4DyLjlcsMZ68HI/cjqElHHw=",
        "cache": "force-cache"
      },
      {
        "payloadSize": 32336,
        "virtualPath": "System.IO.Pipes.wasm",
        "name": "System.IO.Pipes.got0wa6c92.wasm",
        "hash": "sha256-wIF66wb4LU3C2FH5E2xC5iyZ7wy6QNvlkpU5nHeYqXw=",
        "cache": "force-cache"
      },
      {
        "payloadSize": 5200,
        "virtualPath": "System.IO.UnmanagedMemoryStream.wasm",
        "name": "System.IO.UnmanagedMemoryStream.cq5r5i1558.wasm",
        "hash": "sha256-PK2xIpBtWQj+BvmexMFhuldgufI5tYvAbjH1XpX0kKQ=",
        "cache": "force-cache"
      },
      {
        "payloadSize": 4688,
        "virtualPath": "System.IO.wasm",
        "name": "System.IO.nbeqxuc482.wasm",
        "hash": "sha256-A4TdasIsmtoHfbc+QLGDQhPZ1SDhmP/mjOs7M5IzhHg=",
        "cache": "force-cache"
      },
      {
        "payloadSize": 503888,
        "virtualPath": "System.Linq.AsyncEnumerable.wasm",
        "name": "System.Linq.AsyncEnumerable.n6gty0be6c.wasm",
        "hash": "sha256-L4lvxjwyLwAwjQvGiR5Xrqt79l05hc2wN/KeoMXF9yM=",
        "cache": "force-cache"
      },
      {
        "payloadSize": 565328,
        "virtualPath": "System.Linq.Expressions.wasm",
        "name": "System.Linq.Expressions.eauz3qi903.wasm",
        "hash": "sha256-Fm9GCLaxLrVdj3NrPXVTBz1m4IG77qWo6OBPf6CyoK8=",
        "cache": "force-cache"
      },
      {
        "payloadSize": 214608,
        "virtualPath": "System.Linq.Parallel.wasm",
        "name": "System.Linq.Parallel.n290rct9mm.wasm",
        "hash": "sha256-7+gmZDFxdhVeHoIJLyZUAEsfZNj+Ed+qe5AnJQmC1n4=",
        "cache": "force-cache"
      },
      {
        "payloadSize": 71248,
        "virtualPath": "System.Linq.Queryable.wasm",
        "name": "System.Linq.Queryable.57d2206dkl.wasm",
        "hash": "sha256-r26PIiVbvpiuq9E5ZoZrC6oF8nZY/+ocELBaxLdiwig=",
        "cache": "force-cache"
      },
      {
        "payloadSize": 202320,
        "virtualPath": "System.Linq.wasm",
        "name": "System.Linq.dipppbidw7.wasm",
        "hash": "sha256-ZXJsNoFnXT8BCbVkzNu6122HlSg2pZrcoyUhpOMZWrM=",
        "cache": "force-cache"
      },
      {
        "payloadSize": 49232,
        "virtualPath": "System.Memory.wasm",
        "name": "System.Memory.8raefhi0s0.wasm",
        "hash": "sha256-9KC66hDxwf9gzOYArB+muZMURAHEJm8AA6buKmB6Nis=",
        "cache": "force-cache"
      },
      {
        "payloadSize": 45648,
        "virtualPath": "System.Net.Http.Json.wasm",
        "name": "System.Net.Http.Json.2kyavjgfs2.wasm",
        "hash": "sha256-cjj3g0A+KU1TU3iUasFj9lEMs69iRKPrZxHoJmwrsEY=",
        "cache": "force-cache"
      },
      {
        "payloadSize": 293456,
        "virtualPath": "System.Net.Http.wasm",
        "name": "System.Net.Http.3qn2rib6vw.wasm",
        "hash": "sha256-ZWhwR3ZUpln+s/rETmOyu3WE/6/bYSIXGN84TwXI9Vo=",
        "cache": "force-cache"
      },
      {
        "payloadSize": 45648,
        "virtualPath": "System.Net.HttpListener.wasm",
        "name": "System.Net.HttpListener.x7u9a3nw97.wasm",
        "hash": "sha256-PacOvMOY5z9Uzd8WPzmrWrNH1DeWC4FyPzHwjOTHFGg=",
        "cache": "force-cache"
      },
      {
        "payloadSize": 126032,
        "virtualPath": "System.Net.Mail.wasm",
        "name": "System.Net.Mail.oy4yyeegvz.wasm",
        "hash": "sha256-YHhpC7Yea4nRRc2dGwU1aJEMu5RZvbPnkzbEQRpQ+ww=",
        "cache": "force-cache"
      },
      {
        "payloadSize": 21072,
        "virtualPath": "System.Net.NameResolution.wasm",
        "name": "System.Net.NameResolution.ml00abk8wq.wasm",
        "hash": "sha256-9mbT3nIusYSXC9B79gaQMowA67kcM8TOqRmq5gdIx/4=",
        "cache": "force-cache"
      },
      {
        "payloadSize": 31824,
        "virtualPath": "System.Net.NetworkInformation.wasm",
        "name": "System.Net.NetworkInformation.6ie9oqle3g.wasm",
        "hash": "sha256-rkFpzXsXqt14zy+dVls9y/o1ZrMcmJ6WMPtroRuWE6I=",
        "cache": "force-cache"
      },
      {
        "payloadSize": 17488,
        "virtualPath": "System.Net.Ping.wasm",
        "name": "System.Net.Ping.5m9ddsqka1.wasm",
        "hash": "sha256-E9GcpbZjHr2o8n8uCAPni40K77lWQ0Bo/qyd+QG7smo=",
        "cache": "force-cache"
      },
      {
        "payloadSize": 97872,
        "virtualPath": "System.Net.Primitives.wasm",
        "name": "System.Net.Primitives.a4kkwxrmui.wasm",
        "hash": "sha256-Julno471f7Dhpeb5R/SEBPxebSzREF+4AQ5sNVKgk4Q=",
        "cache": "force-cache"
      },
      {
        "payloadSize": 28752,
        "virtualPath": "System.Net.Quic.wasm",
        "name": "System.Net.Quic.y05n2uafa1.wasm",
        "hash": "sha256-zqxCpztc8j7vjMtt+h7OjozSr37qqDe1tPWvJ66BLgc=",
        "cache": "force-cache"
      },
      {
        "payloadSize": 55376,
        "virtualPath": "System.Net.Requests.wasm",
        "name": "System.Net.Requests.to0ht915eo.wasm",
        "hash": "sha256-Q5F469Gf0piLchOlJHar93FYzlHf4b8oca5ZVqFgVNQ=",
        "cache": "force-cache"
      },
      {
        "payloadSize": 113744,
        "virtualPath": "System.Net.Security.wasm",
        "name": "System.Net.Security.uzfe3gbc7o.wasm",
        "hash": "sha256-eht5reRiTt9e0whbVdCTAZyNRImg5wlR/iNGh1eAKOg=",
        "cache": "force-cache"
      },
      {
        "payloadSize": 31312,
        "virtualPath": "System.Net.ServerSentEvents.wasm",
        "name": "System.Net.ServerSentEvents.uswrvq9o74.wasm",
        "hash": "sha256-Mmq4BHmEbtz3xvU8DIF392oeNsCx/i7ZXvqRFOv1tLk=",
        "cache": "force-cache"
      },
      {
        "payloadSize": 4688,
        "virtualPath": "System.Net.ServicePoint.wasm",
        "name": "System.Net.ServicePoint.3vskll6378.wasm",
        "hash": "sha256-4We73Y/cv0juh1ZmwxEm/VAtMag5EfBoS8t0NFt2e58=",
        "cache": "force-cache"
      },
      {
        "payloadSize": 64080,
        "virtualPath": "System.Net.Sockets.wasm",
        "name": "System.Net.Sockets.w7kdx8fwyz.wasm",
        "hash": "sha256-ZIe7gAeU8IrjK52BoUWFzu8T2ilI7HDDkAmfjryDxc4=",
        "cache": "force-cache"
      },
      {
        "payloadSize": 46672,
        "virtualPath": "System.Net.WebClient.wasm",
        "name": "System.Net.WebClient.mmlw40gw8o.wasm",
        "hash": "sha256-frlOmMrCyTUoLd5N0tar8z0PqEyXeuaWi5Yva248QnQ=",
        "cache": "force-cache"
      },
      {
        "payloadSize": 22608,
        "virtualPath": "System.Net.WebHeaderCollection.wasm",
        "name": "System.Net.WebHeaderCollection.mwoecvdov1.wasm",
        "hash": "sha256-lq10GEfxqJ4x5lqWxwI2Y8tRjqR4z3J6B1cPBzxSQSw=",
        "cache": "force-cache"
      },
      {
        "payloadSize": 11856,
        "virtualPath": "System.Net.WebProxy.wasm",
        "name": "System.Net.WebProxy.czk5y54cr3.wasm",
        "hash": "sha256-iDBxfSny2l6v+QYOm0Ay/nSfO451uoAj4lHW+cD7ivw=",
        "cache": "force-cache"
      },
      {
        "payloadSize": 41552,
        "virtualPath": "System.Net.WebSockets.Client.wasm",
        "name": "System.Net.WebSockets.Client.z88kw8cwzp.wasm",
        "hash": "sha256-w2aLEtIIpgBAzbft7L6yPm0u5tTq3SQT1HP28bD7JNk=",
        "cache": "force-cache"
      },
      {
        "payloadSize": 100432,
        "virtualPath": "System.Net.WebSockets.wasm",
        "name": "System.Net.WebSockets.8svagab7ho.wasm",
        "hash": "sha256-aKe2T/c9mNl0Uayq6JjrNdZL+KX1dV2tB6rC9YXx1as=",
        "cache": "force-cache"
      },
      {
        "payloadSize": 6224,
        "virtualPath": "System.Net.wasm",
        "name": "System.Net.2bh97i557z.wasm",
        "hash": "sha256-IsHAbY3p5oegZXSSAV/4yahub17ezbM4O77O0zKiNbk=",
        "cache": "force-cache"
      },
      {
        "payloadSize": 5712,
        "virtualPath": "System.Numerics.Vectors.wasm",
        "name": "System.Numerics.Vectors.exehs5tbcb.wasm",
        "hash": "sha256-0sV41UWVlGwYlC54c7Lg48+E0jslDFUYonl+Tb9530M=",
        "cache": "force-cache"
      },
      {
        "payloadSize": 4688,
        "virtualPath": "System.Numerics.wasm",
        "name": "System.Numerics.qkm6kr8f4v.wasm",
        "hash": "sha256-yteyInLDE848X8n/D+i/b6lRnIO6DnLmlBTTskGrMSk=",
        "cache": "force-cache"
      },
      {
        "payloadSize": 30800,
        "virtualPath": "System.ObjectModel.wasm",
        "name": "System.ObjectModel.mzur5o0pc9.wasm",
        "hash": "sha256-oppHd3+NMJtrJYW97gCZ4gO5z3xI0UH9eXBrdEvoCw0=",
        "cache": "force-cache"
      },
      {
        "payloadSize": 5460560,
        "virtualPath": "System.Private.CoreLib.wasm",
        "name": "System.Private.CoreLib.kjfss1rjq2.wasm",
        "hash": "sha256-UBI8D6/TmZ+dyNZFvyXolo4AXYB53L/dmGNrxAdP6SQ=",
        "cache": "force-cache"
      },
      {
        "payloadSize": 848976,
        "virtualPath": "System.Private.DataContractSerialization.wasm",
        "name": "System.Private.DataContractSerialization.1c3wsw60ax.wasm",
        "hash": "sha256-H6t+jBCzjDGTDfVBRwVWK6QoXN2CfyKoKVE/bbFJLS8=",
        "cache": "force-cache"
      },
      {
        "payloadSize": 92240,
        "virtualPath": "System.Private.Uri.wasm",
        "name": "System.Private.Uri.2wwtr6zkjr.wasm",
        "hash": "sha256-wk7EU1Bzeb1E7hNgvfqowZsMFIp9E03omrcOzKGFz2A=",
        "cache": "force-cache"
      },
      {
        "payloadSize": 144464,
        "virtualPath": "System.Private.Xml.Linq.wasm",
        "name": "System.Private.Xml.Linq.43frj3dmxq.wasm",
        "hash": "sha256-ILQQdrglDZNjj5Vbtv8maCKMwxoSwrjvpdPFxZPKm5s=",
        "cache": "force-cache"
      },
      {
        "payloadSize": 3108944,
        "virtualPath": "System.Private.Xml.wasm",
        "name": "System.Private.Xml.9ihd8f7n17.wasm",
        "hash": "sha256-4W2UNxg+Ysde5ABGHIsd09h/0xabHiuvyCMPUot3ggg=",
        "cache": "force-cache"
      },
      {
        "payloadSize": 27728,
        "virtualPath": "System.Reflection.DispatchProxy.wasm",
        "name": "System.Reflection.DispatchProxy.ec0b7arbb9.wasm",
        "hash": "sha256-gurnVN20hLOWG05NMpJDvWWz5T6v8d+Awqw1ZML9gJA=",
        "cache": "force-cache"
      },
      {
        "payloadSize": 5200,
        "virtualPath": "System.Reflection.Emit.ILGeneration.wasm",
        "name": "System.Reflection.Emit.ILGeneration.b4m8m0w40q.wasm",
        "hash": "sha256-+/ecKX4IxKVC0jZwqEyF9s2jq+QH8EJleBPInXoZ4UA=",
        "cache": "force-cache"
      },
      {
        "payloadSize": 5200,
        "virtualPath": "System.Reflection.Emit.Lightweight.wasm",
        "name": "System.Reflection.Emit.Lightweight.3ia47vepzu.wasm",
        "hash": "sha256-1Y5d1prlDjmy0s7oWXmwLGadLZkhQhwkfbMG48Sn5Dg=",
        "cache": "force-cache"
      },
      {
        "payloadSize": 123984,
        "virtualPath": "System.Reflection.Emit.wasm",
        "name": "System.Reflection.Emit.cx1bajtj3c.wasm",
        "hash": "sha256-gOTImGUIOXAo/AtdHIsg7bIV5ogDtBCPb/k7F4X66wg=",
        "cache": "force-cache"
      },
      {
        "payloadSize": 4688,
        "virtualPath": "System.Reflection.Extensions.wasm",
        "name": "System.Reflection.Extensions.wuhf4tc5az.wasm",
        "hash": "sha256-KCDYG0wAMsMXEx/K1Wwq8k8wWikinX7owelbuNzpVAE=",
        "cache": "force-cache"
      },
      {
        "payloadSize": 493648,
        "virtualPath": "System.Reflection.Metadata.wasm",
        "name": "System.Reflection.Metadata.8fsckh85pu.wasm",
        "hash": "sha256-5FI/4e5vdQ8VkcOWPjG0qP9gDxCWXlSwIOvqL2hhzN8=",
        "cache": "force-cache"
      },
      {
        "payloadSize": 5200,
        "virtualPath": "System.Reflection.Primitives.wasm",
        "name": "System.Reflection.Primitives.hpd1z5g3e4.wasm",
        "hash": "sha256-Ww0vmwSY/u6blDkee9GT6JlXozZP23oFgcBlQZe2ePc=",
        "cache": "force-cache"
      },
      {
        "payloadSize": 13904,
        "virtualPath": "System.Reflection.TypeExtensions.wasm",
        "name": "System.Reflection.TypeExtensions.mtq882mz4a.wasm",
        "hash": "sha256-NlZtSpuiNaD+YxgprTYwQcPHEuR9jo2rXXVcF8RrDpM=",
        "cache": "force-cache"
      },
      {
        "payloadSize": 5712,
        "virtualPath": "System.Reflection.wasm",
        "name": "System.Reflection.8m3cjabuza.wasm",
        "hash": "sha256-UChWjb178ms44X9iZSUz/hksQrNjMAciQynGKovJl78=",
        "cache": "force-cache"
      },
      {
        "payloadSize": 4688,
        "virtualPath": "System.Resources.Reader.wasm",
        "name": "System.Resources.Reader.n1dd33ir9f.wasm",
        "hash": "sha256-SzL7Y8r/WSNrrD2FqjuGN+5gBYlI7ATg/4KFlnZWkic=",
        "cache": "force-cache"
      },
      {
        "payloadSize": 5200,
        "virtualPath": "System.Resources.ResourceManager.wasm",
        "name": "System.Resources.ResourceManager.b1m1v4o21t.wasm",
        "hash": "sha256-zzQxxX/loQIuyKAvTC4SDIiWhb+fdT7H4ESxkfvWWTI=",
        "cache": "force-cache"
      },
      {
        "payloadSize": 16464,
        "virtualPath": "System.Resources.Writer.wasm",
        "name": "System.Resources.Writer.26zxgfdo4o.wasm",
        "hash": "sha256-tlNgFdH94NmaUUea5DqpDS1dVGk8T8EHxlQWqs4n+ZI=",
        "cache": "force-cache"
      },
      {
        "payloadSize": 4688,
        "virtualPath": "System.Runtime.CompilerServices.Unsafe.wasm",
        "name": "System.Runtime.CompilerServices.Unsafe.8ux6ranuuc.wasm",
        "hash": "sha256-0EOHExB43X98jZZytjC/McA3kcZwkpnO7CI4nnuxlyM=",
        "cache": "force-cache"
      },
      {
        "payloadSize": 6736,
        "virtualPath": "System.Runtime.CompilerServices.VisualC.wasm",
        "name": "System.Runtime.CompilerServices.VisualC.nbjujghcy5.wasm",
        "hash": "sha256-UwCoCKDIcPcg2CK9z4cYS/IMgALcRhnXm+FEBaSwhI0=",
        "cache": "force-cache"
      },
      {
        "payloadSize": 7248,
        "virtualPath": "System.Runtime.Extensions.wasm",
        "name": "System.Runtime.Extensions.e1lus2mngy.wasm",
        "hash": "sha256-AsqDj3cvJ+VZnXJFqSUM6FjIuqkn5xICi52zCsM5Zvc=",
        "cache": "force-cache"
      },
      {
        "payloadSize": 5200,
        "virtualPath": "System.Runtime.Handles.wasm",
        "name": "System.Runtime.Handles.k1qkwjz099.wasm",
        "hash": "sha256-2DwJmgwy+BJOwaDqNUG89hwulLkWCJb3r/rmEzXt7hM=",
        "cache": "force-cache"
      },
      {
        "payloadSize": 98896,
        "virtualPath": "System.Runtime.InteropServices.JavaScript.wasm",
        "name": "System.Runtime.InteropServices.JavaScript.j8gsrolsrt.wasm",
        "hash": "sha256-M+zRTdypZScqdtuj5JhLYktyBjFcUn9PxItkJiwPBKQ=",
        "cache": "force-cache"
      },
      {
        "payloadSize": 5200,
        "virtualPath": "System.Runtime.InteropServices.RuntimeInformation.wasm",
        "name": "System.Runtime.InteropServices.RuntimeInformation.istc4mqpm9.wasm",
        "hash": "sha256-0p0vXf12CSBu5aunync1/0vQEtFKtO1SbSGOng/M1oQ=",
        "cache": "force-cache"
      },
      {
        "payloadSize": 53840,
        "virtualPath": "System.Runtime.InteropServices.wasm",
        "name": "System.Runtime.InteropServices.3b5pbi95ay.wasm",
        "hash": "sha256-HypMYKfT+U0+rJKaQ4eM+G2Rs9Pc7hmzCZc4W0AM5W4=",
        "cache": "force-cache"
      },
      {
        "payloadSize": 8272,
        "virtualPath": "System.Runtime.Intrinsics.wasm",
        "name": "System.Runtime.Intrinsics.93mzkj823s.wasm",
        "hash": "sha256-a+VTiPYSLGTcjSEidPli1g7bWM97/ABg3smHAzpfvXE=",
        "cache": "force-cache"
      },
      {
        "payloadSize": 5200,
        "virtualPath": "System.Runtime.Loader.wasm",
        "name": "System.Runtime.Loader.556rzq5eag.wasm",
        "hash": "sha256-2dLljpEeCbYUdpCD/RWU0vqte4jOnDg/AehdlRXwCyk=",
        "cache": "force-cache"
      },
      {
        "payloadSize": 180304,
        "virtualPath": "System.Runtime.Numerics.wasm",
        "name": "System.Runtime.Numerics.ecn68qnmao.wasm",
        "hash": "sha256-rlukPN3ADKFMXYgtPG9zKZWtVZM6wn44jgrrMmUlzcg=",
        "cache": "force-cache"
      },
      {
        "payloadSize": 126032,
        "virtualPath": "System.Runtime.Serialization.Formatters.wasm",
        "name": "System.Runtime.Serialization.Formatters.9hkx52nshp.wasm",
        "hash": "sha256-Ez2k+UhkvgiPJUFo5tS1BBW1LdoLRtU3XCVhacBZzp0=",
        "cache": "force-cache"
      },
      {
        "payloadSize": 5200,
        "virtualPath": "System.Runtime.Serialization.Json.wasm",
        "name": "System.Runtime.Serialization.Json.hr9hbfm59m.wasm",
        "hash": "sha256-rXKZIrMncU97F6gEi8yAedH+gBHIDUuz6XXdyNsWaJw=",
        "cache": "force-cache"
      },
      {
        "payloadSize": 12880,
        "virtualPath": "System.Runtime.Serialization.Primitives.wasm",
        "name": "System.Runtime.Serialization.Primitives.m6xf0gdrdp.wasm",
        "hash": "sha256-QtpEmGW3MiT43AnVlUyW0BLFO8zuOcuZpgBKGwsCbUE=",
        "cache": "force-cache"
      },
      {
        "payloadSize": 6224,
        "virtualPath": "System.Runtime.Serialization.Xml.wasm",
        "name": "System.Runtime.Serialization.Xml.qbobi8wlym.wasm",
        "hash": "sha256-5gEihK0UkAw22qwVckMyjt6UzmPHyWLbSoGJWFVGrgE=",
        "cache": "force-cache"
      },
      {
        "payloadSize": 6736,
        "virtualPath": "System.Runtime.Serialization.wasm",
        "name": "System.Runtime.Serialization.ewp06cud1t.wasm",
        "hash": "sha256-4uZDccgojbnV5pgyYCbK81goHQelRJlMutoKmZGM1lo=",
        "cache": "force-cache"
      },
      {
        "payloadSize": 35408,
        "virtualPath": "System.Runtime.wasm",
        "name": "System.Runtime.jq5w08md1w.wasm",
        "hash": "sha256-9VpOeeFRhLfnzRWzM/fa9b5r4c4c0ht6SAvZompfWRU=",
        "cache": "force-cache"
      },
      {
        "payloadSize": 47184,
        "virtualPath": "System.Security.AccessControl.wasm",
        "name": "System.Security.AccessControl.3r4v76nr5u.wasm",
        "hash": "sha256-MWdeCpTnTyLh4E4V+NGJ2yyB2Eu4hBfjRjwBHkCvDWI=",
        "cache": "force-cache"
      },
      {
        "payloadSize": 44112,
        "virtualPath": "System.Security.Claims.wasm",
        "name": "System.Security.Claims.9yu4nfgax1.wasm",
        "hash": "sha256-T/e66P1j0qrQvd0uWQE4I9nQFRuohUKUjmhsAUuEm90=",
        "cache": "force-cache"
      },
      {
        "payloadSize": 6736,
        "virtualPath": "System.Security.Cryptography.Algorithms.wasm",
        "name": "System.Security.Cryptography.Algorithms.6osdvvip5c.wasm",
        "hash": "sha256-Zo0Gu7HgqikaE4THbBuDPNEHClCELtVGkcPyput+Fvg=",
        "cache": "force-cache"
      },
      {
        "payloadSize": 5712,
        "virtualPath": "System.Security.Cryptography.Cng.wasm",
        "name": "System.Security.Cryptography.Cng.5105szgas3.wasm",
        "hash": "sha256-aRfNW3q+Uxto0jJ+yR3JA6ji3RRd2aZ9s6BpPW0oFVk=",
        "cache": "force-cache"
      },
      {
        "payloadSize": 5712,
        "virtualPath": "System.Security.Cryptography.Csp.wasm",
        "name": "System.Security.Cryptography.Csp.j6j8i239wp.wasm",
        "hash": "sha256-5eJ18JidKGjTUDNiguA2hpkg3hood4WBVNTxl4hEcxo=",
        "cache": "force-cache"
      },
      {
        "payloadSize": 5200,
        "virtualPath": "System.Security.Cryptography.Encoding.wasm",
        "name": "System.Security.Cryptography.Encoding.elopx9xi3j.wasm",
        "hash": "sha256-PqLP1D/ScYTIHelwmy0aMQPWSDBF14EiTjnTj8zvzdA=",
        "cache": "force-cache"
      },
      {
        "payloadSize": 5200,
        "virtualPath": "System.Security.Cryptography.OpenSsl.wasm",
        "name": "System.Security.Cryptography.OpenSsl.ldm4oqk0bt.wasm",
        "hash": "sha256-t7Wk82rBssj1A9UyF8l052Tcw1Iz2xzWpJawLUUbWdM=",
        "cache": "force-cache"
      },
      {
        "payloadSize": 5200,
        "virtualPath": "System.Security.Cryptography.Primitives.wasm",
        "name": "System.Security.Cryptography.Primitives.is1l3rf8ys.wasm",
        "hash": "sha256-ruS+m4KLM1LNAOxd4GlvDIEI10oxQAEn5xhruIuWe5k=",
        "cache": "force-cache"
      },
      {
        "payloadSize": 6736,
        "virtualPath": "System.Security.Cryptography.X509Certificates.wasm",
        "name": "System.Security.Cryptography.X509Certificates.n2dyisf8zy.wasm",
        "hash": "sha256-r6j+jn0StesbgWcM4bO7y/foA/fggGlK5jklaPtT4NE=",
        "cache": "force-cache"
      },
      {
        "payloadSize": 714320,
        "virtualPath": "System.Security.Cryptography.wasm",
        "name": "System.Security.Cryptography.eb73v5am4g.wasm",
        "hash": "sha256-yhpW3tH0VOMNnYRvNkPczmyMdukDmU2K7enxzZidXhw=",
        "cache": "force-cache"
      },
      {
        "payloadSize": 27216,
        "virtualPath": "System.Security.Principal.Windows.wasm",
        "name": "System.Security.Principal.Windows.192nk65gc7.wasm",
        "hash": "sha256-29jXG5xDwFvOlTz8hhraYoksbE3gQsRBja4pSsT6Alw=",
        "cache": "force-cache"
      },
      {
        "payloadSize": 4688,
        "virtualPath": "System.Security.Principal.wasm",
        "name": "System.Security.Principal.z7j8qrl1d4.wasm",
        "hash": "sha256-T0mnom0K2BtlmMP4wqHetJNf3y8vJ4cyvrK0+iBjfo4=",
        "cache": "force-cache"
      },
      {
        "payloadSize": 5200,
        "virtualPath": "System.Security.SecureString.wasm",
        "name": "System.Security.SecureString.rsp94if479.wasm",
        "hash": "sha256-JRldNDEoWP2WTF9y6lhUUGPEKifOgTRgfzfmt/UkIok=",
        "cache": "force-cache"
      },
      {
        "payloadSize": 7760,
        "virtualPath": "System.Security.wasm",
        "name": "System.Security.6zxjx0nz4f.wasm",
        "hash": "sha256-wiMJxZ35/sgf4DGHOYvMGB68HsB3EaKiMMS4M5fGpN8=",
        "cache": "force-cache"
      },
      {
        "payloadSize": 6224,
        "virtualPath": "System.ServiceModel.Web.wasm",
        "name": "System.ServiceModel.Web.255rwyiztn.wasm",
        "hash": "sha256-OuVjhpgNCPT9fhfLH7d9xaciNKerfaHVtzNuZJUP1hI=",
        "cache": "force-cache"
      },
      {
        "payloadSize": 5200,
        "virtualPath": "System.ServiceProcess.wasm",
        "name": "System.ServiceProcess.9tzvypjqya.wasm",
        "hash": "sha256-Dd1SGV/MAzkRRg0wHUlh/33tThWbWFiYN9NLzNPfSXA=",
        "cache": "force-cache"
      },
      {
        "payloadSize": 731728,
        "virtualPath": "System.Text.Encoding.CodePages.wasm",
        "name": "System.Text.Encoding.CodePages.n1b1oweg26.wasm",
        "hash": "sha256-K2Y9qjhEjeVxaRVITFK8bk3h91Rw6dwLQsSuYKPGsqU=",
        "cache": "force-cache"
      },
      {
        "payloadSize": 5200,
        "virtualPath": "System.Text.Encoding.Extensions.wasm",
        "name": "System.Text.Encoding.Extensions.qnsemkis5g.wasm",
        "hash": "sha256-lk6WKWgBthB+vFk63AtCtIWNUXN589R27BgRLaQxoxk=",
        "cache": "force-cache"
      },
      {
        "payloadSize": 5200,
        "virtualPath": "System.Text.Encoding.wasm",
        "name": "System.Text.Encoding.qb3z5guxis.wasm",
        "hash": "sha256-an9QHApQXVWM23hogz8ZWXys2X+sHq2GIdGPAKtf4PE=",
        "cache": "force-cache"
      },
      {
        "payloadSize": 55888,
        "virtualPath": "System.Text.Encodings.Web.wasm",
        "name": "System.Text.Encodings.Web.zv7li8ufj8.wasm",
        "hash": "sha256-Ly3u6YF/F78xqnVgpT5wnFaRuNHv/lgwHVMJj7i02bk=",
        "cache": "force-cache"
      },
      {
        "payloadSize": 726096,
        "virtualPath": "System.Text.Json.wasm",
        "name": "System.Text.Json.128ij5vyw0.wasm",
        "hash": "sha256-t28PQJ43wkLn6LmV68hlXHCcLzrN9SWteUdWMVN8dYk=",
        "cache": "force-cache"
      },
      {
        "payloadSize": 383568,
        "virtualPath": "System.Text.RegularExpressions.wasm",
        "name": "System.Text.RegularExpressions.spj8zmhblz.wasm",
        "hash": "sha256-0AC/mHBDQDYC7UrGgV33MKJrnDjuoeMcOcrqdCh9A5s=",
        "cache": "force-cache"
      },
      {
        "payloadSize": 22608,
        "virtualPath": "System.Threading.AccessControl.wasm",
        "name": "System.Threading.AccessControl.z3ni4q0xbb.wasm",
        "hash": "sha256-f7HlENMifNh9Fxkm+WyWat12+Brra9RflyLFY433o2c=",
        "cache": "force-cache"
      },
      {
        "payloadSize": 55888,
        "virtualPath": "System.Threading.Channels.wasm",
        "name": "System.Threading.Channels.18dfb25dgy.wasm",
        "hash": "sha256-T0zJsqhmzyGWlSmGRFtGOz0UlkckTTOL63IfjB/a3no=",
        "cache": "force-cache"
      },
      {
        "payloadSize": 5200,
        "virtualPath": "System.Threading.Overlapped.wasm",
        "name": "System.Threading.Overlapped.xhwlbxfvmg.wasm",
        "hash": "sha256-O6lFH/4snW/HG/2xx/fSVkaeA7k2J0gQ91+AV2rbrd8=",
        "cache": "force-cache"
      },
      {
        "payloadSize": 175696,
        "virtualPath": "System.Threading.Tasks.Dataflow.wasm",
        "name": "System.Threading.Tasks.Dataflow.9ujv3nx6ki.wasm",
        "hash": "sha256-z1pFfFP1FZfZ8zejtmVV1lWXDKxzHYZGyTlNaUWhhe4=",
        "cache": "force-cache"
      },
      {
        "payloadSize": 5200,
        "virtualPath": "System.Threading.Tasks.Extensions.wasm",
        "name": "System.Threading.Tasks.Extensions.6qyagoj0ml.wasm",
        "hash": "sha256-Tm6JSGtTPSZSc0yZO2tCGXUTgUtYUwT+Xgv0P9GDTc4=",
        "cache": "force-cache"
      },
      {
        "payloadSize": 51280,
        "virtualPath": "System.Threading.Tasks.Parallel.wasm",
        "name": "System.Threading.Tasks.Parallel.dorj6tp9hu.wasm",
        "hash": "sha256-3TyetxrT3w0TOYGVvzH97uOC8ckiM0kOzaI//mmj2qQ=",
        "cache": "force-cache"
      },
      {
        "payloadSize": 6224,
        "virtualPath": "System.Threading.Tasks.wasm",
        "name": "System.Threading.Tasks.nqvaqrce83.wasm",
        "hash": "sha256-L6VRRxcTif5RMLTLLT888fc+tgxb3u5x1ZkRKZTwjQU=",
        "cache": "force-cache"
      },
      {
        "payloadSize": 5200,
        "virtualPath": "System.Threading.Thread.wasm",
        "name": "System.Threading.Thread.e1ew53j4tb.wasm",
        "hash": "sha256-ElCHLIbAdRsajTBDhg5xHwcdgKCr/bmmPKCA9UBV0b8=",
        "cache": "force-cache"
      },
      {
        "payloadSize": 5200,
        "virtualPath": "System.Threading.ThreadPool.wasm",
        "name": "System.Threading.ThreadPool.wr5x1ueyw6.wasm",
        "hash": "sha256-hCtAzpJpaXaXP+yZI4dCN8VZBs3j+ffVlVlntDpRk6c=",
        "cache": "force-cache"
      },
      {
        "payloadSize": 4688,
        "virtualPath": "System.Threading.Timer.wasm",
        "name": "System.Threading.Timer.3c54vfqgnb.wasm",
        "hash": "sha256-A6+Lvc+4DuJI93xYCSBSeHz+Ea3wd3Hy+b9NX25UfkU=",
        "cache": "force-cache"
      },
      {
        "payloadSize": 34384,
        "virtualPath": "System.Threading.wasm",
        "name": "System.Threading.owcqidixj4.wasm",
        "hash": "sha256-2MkylKQmVNoV7uFQc5/OrrrgLLwgGk5nqEObWC04g+k=",
        "cache": "force-cache"
      },
      {
        "payloadSize": 164432,
        "virtualPath": "System.Transactions.Local.wasm",
        "name": "System.Transactions.Local.hkonroms5m.wasm",
        "hash": "sha256-32j02i1LBb3Aze3FnhGpQHzAjL0VOjX54e5k8Dp6yvE=",
        "cache": "force-cache"
      },
      {
        "payloadSize": 6224,
        "virtualPath": "System.Transactions.wasm",
        "name": "System.Transactions.tq3cvibnrv.wasm",
        "hash": "sha256-9RRn9jYUvqg5A1e0Dghd5jTgnuPI6hp0jsr8f/wsPD4=",
        "cache": "force-cache"
      },
      {
        "payloadSize": 5200,
        "virtualPath": "System.ValueTuple.wasm",
        "name": "System.ValueTuple.ici5owcoi0.wasm",
        "hash": "sha256-IkQsNXGQH+RxiRCnm5N5tSztFG7jdTtSuWhbdbt1pPI=",
        "cache": "force-cache"
      },
      {
        "payloadSize": 19536,
        "virtualPath": "System.Web.HttpUtility.wasm",
        "name": "System.Web.HttpUtility.2gng3dfes2.wasm",
        "hash": "sha256-soEws/eVqe0xaz0bTNQU7npBSKbIJZU20FOcXIiPwKs=",
        "cache": "force-cache"
      },
      {
        "payloadSize": 4176,
        "virtualPath": "System.Web.wasm",
        "name": "System.Web.4p4kv296yr.wasm",
        "hash": "sha256-ONT2esd823r475qqwG0x6aFjOmZ8dTvuUNG4dzfF/wU=",
        "cache": "force-cache"
      },
      {
        "payloadSize": 5200,
        "virtualPath": "System.Windows.wasm",
        "name": "System.Windows.hfx07rr9sz.wasm",
        "hash": "sha256-w7M9zcG2eFq4Zs9RWmhTARPACFDg6Uw11s7nFZptGpo=",
        "cache": "force-cache"
      },
      {
        "payloadSize": 5200,
        "virtualPath": "System.Xml.Linq.wasm",
        "name": "System.Xml.Linq.vq0v1d9jee.wasm",
        "hash": "sha256-h1rWBXebuMNf1JzQhtFQib+p4tUCeXtYKqm9vlfTVWc=",
        "cache": "force-cache"
      },
      {
        "payloadSize": 11344,
        "virtualPath": "System.Xml.ReaderWriter.wasm",
        "name": "System.Xml.ReaderWriter.0optyeuvvs.wasm",
        "hash": "sha256-MCFuKDDxSUtk6zzUdqtxBjSUcrTHsyeh9Jymdzjk2GU=",
        "cache": "force-cache"
      },
      {
        "payloadSize": 5712,
        "virtualPath": "System.Xml.Serialization.wasm",
        "name": "System.Xml.Serialization.cuojtmtifr.wasm",
        "hash": "sha256-hKm/rNSAN0wjho5xeHBRvrs5HihM0C/UwThVLQp2c/Y=",
        "cache": "force-cache"
      },
      {
        "payloadSize": 5200,
        "virtualPath": "System.Xml.XDocument.wasm",
        "name": "System.Xml.XDocument.vw6wybya33.wasm",
        "hash": "sha256-AQcPpjFRaQGpZXHC6BHqy6CmUlPPu+xXqW0dNlSkNG4=",
        "cache": "force-cache"
      },
      {
        "payloadSize": 5712,
        "virtualPath": "System.Xml.XPath.XDocument.wasm",
        "name": "System.Xml.XPath.XDocument.4h4ziy0cn1.wasm",
        "hash": "sha256-aBvWe+cTdqNbK0txE5IWYRseugzl7lbvr9j0qVWLXEM=",
        "cache": "force-cache"
      },
      {
        "payloadSize": 5200,
        "virtualPath": "System.Xml.XPath.wasm",
        "name": "System.Xml.XPath.twaxvw85i2.wasm",
        "hash": "sha256-fXRATj9bagZeTkioBobnDSd9fGpE0P4EmraptKapB2E=",
        "cache": "force-cache"
      },
      {
        "payloadSize": 5200,
        "virtualPath": "System.Xml.XmlDocument.wasm",
        "name": "System.Xml.XmlDocument.3rxb3v1pjq.wasm",
        "hash": "sha256-n469sNvnmsIY2jHKTazn6zUOfupTilDtl+pZiWKEKC0=",
        "cache": "force-cache"
      },
      {
        "payloadSize": 7248,
        "virtualPath": "System.Xml.XmlSerializer.wasm",
        "name": "System.Xml.XmlSerializer.wohn922lei.wasm",
        "hash": "sha256-sPXjVue8JKrsprU08+LZM6Ot9WEuC7exeq2afxQ7M6o=",
        "cache": "force-cache"
      },
      {
        "payloadSize": 12368,
        "virtualPath": "System.Xml.wasm",
        "name": "System.Xml.3e3om8c2bf.wasm",
        "hash": "sha256-K11SEd9LSFs8JxUYvn/RAUNXFqIwgqaJQZsZtC1VeHY=",
        "cache": "force-cache"
      },
      {
        "payloadSize": 38992,
        "virtualPath": "System.wasm",
        "name": "System.dwelevedb4.wasm",
        "hash": "sha256-rQhX+S9jIUJP+rbvzNN8slOEPGedRnjrduoL+LhfouU=",
        "cache": "force-cache"
      },
      {
        "payloadSize": 5200,
        "virtualPath": "WindowsBase.wasm",
        "name": "WindowsBase.9bntbwapjm.wasm",
        "hash": "sha256-RWYp+1Cj2bofjrPa3i7N9Mk+fyrU1Kl7e2AP6oqcCC4=",
        "cache": "force-cache"
      },
      {
        "payloadSize": 944208,
        "virtualPath": "ikvmc_asm-9.9.wasm",
        "name": "ikvmc_asm-9.9.ic8yec2t6v.wasm",
        "hash": "sha256-PsPzqYQsVSe4SYOm2J737P3eBCjc+7WeJ5VscKqOT/0=",
        "cache": "force-cache"
      },
      {
        "payloadSize": 55048784,
        "virtualPath": "ikvmc_fastutil-8.2.1.wasm",
        "name": "ikvmc_fastutil-8.2.1.p7zu3nq1mw.wasm",
        "hash": "sha256-O3N8MG30bJGP4CFRtH4uHeRkAKF5ipJ/GYS48MtrE6A=",
        "cache": "force-cache"
      },
      {
        "payloadSize": 532560,
        "virtualPath": "ikvmc_gson-2.8.0.wasm",
        "name": "ikvmc_gson-2.8.0.bp4x73ia3v.wasm",
        "hash": "sha256-D4lHhtWkMZJ190U3+7mmDANTZfwAXFZibhmYVdNY+Rc=",
        "cache": "force-cache"
      },
      {
        "payloadSize": 6857808,
        "virtualPath": "ikvmc_guava-21.0.wasm",
        "name": "ikvmc_guava-21.0.uasqdmasmd.wasm",
        "hash": "sha256-xvZJRPdaPSJR8HY0Y/FezuSuu9qA4DJ9aRhFdVpIAT4=",
        "cache": "force-cache"
      },
      {
        "payloadSize": 5970000,
        "virtualPath": "ikvmc_log4j-2.17.1.wasm",
        "name": "ikvmc_log4j-2.17.1.g88ebyf47s.wasm",
        "hash": "sha256-0DtQ+GCNm5TvCM2rKxfMXImIh//NB3+mv6DLNoMiOrE=",
        "cache": "force-cache"
      },
      {
        "payloadSize": 96829520,
        "virtualPath": "ikvmc_lwjgl3.wasm",
        "name": "ikvmc_lwjgl3.cpk6vfx08p.wasm",
        "hash": "sha256-UNmbc7tENMwah2HqIRHsHg3OsjaA98sh1K+2mBhlQhc=",
        "cache": "force-cache"
      },
      {
        "payloadSize": 10216016,
        "virtualPath": "ikvmc_netty-4.1.25.wasm",
        "name": "ikvmc_netty-4.1.25.bx6q3bjg42.wasm",
        "hash": "sha256-j8Qi3AxAnyYzJo5rUGHWgUVRjdbo6aBplQpxy6B3Dok=",
        "cache": "force-cache"
      },
      {
        "payloadSize": 48720,
        "virtualPath": "mscorlib.wasm",
        "name": "mscorlib.mq77ueyoss.wasm",
        "hash": "sha256-7hj9KTLQyXMCEOpSyZNq6kIfdFfzutrY22hzsZ7rViw=",
        "cache": "force-cache"
      },
      {
        "payloadSize": 90192,
        "virtualPath": "netstandard.wasm",
        "name": "netstandard.v0k86lnkwc.wasm",
        "hash": "sha256-oT5pZmuhXiSHt8qgyFBmXdonxcj+91IOUh5yB93OwP4=",
        "cache": "force-cache"
      }
    ],
    "assembly": []
  },
  "debugLevel": 0,
  "globalizationMode": "sharded",
  "runtimeConfig": {
    "runtimeOptions": {
      "configProperties": {
        "System.Diagnostics.Debugger.IsSupported": false,
        "System.Diagnostics.Metrics.Meter.IsSupported": false,
        "System.Diagnostics.Tracing.EventSource.IsSupported": false,
        "System.Globalization.Invariant": false,
        "System.TimeZoneInfo.Invariant": false,
        "System.Linq.Enumerable.IsSizeOptimized": true,
        "System.Net.Http.EnableActivityPropagation": false,
        "System.Net.Http.WasmEnableStreamingResponse": true,
        "System.Net.SocketsHttpHandler.Http3Support": false,
        "System.Reflection.Metadata.MetadataUpdater.IsSupported": false,
        "System.Resources.UseSystemResourceKeys": true,
        "System.Runtime.Serialization.EnableUnsafeBinaryFormatterSerialization": true,
        "System.Text.Encoding.EnableUnsafeUTF7Encoding": false,
        "System.Diagnostics.StackTrace.IsLineNumberSupported": false,
        "System.Runtime.CompilerServices.RuntimeFeature.IsMultithreadingSupported": true
      }
    }
  }
}/*json-end*/);export{bo as default,po as dotnet,ho as exit};
