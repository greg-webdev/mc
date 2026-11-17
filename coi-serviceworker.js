/*! coi-serviceworker - enables Cross-Origin-Opener-Policy & Cross-Origin-Embedder-Policy on static hosts like GitHub Pages */
if (typeof window === "undefined") {
	self.addEventListener("install", () => self.skipWaiting());
	self.addEventListener("activate", (e) => e.waitUntil(self.clients.claim()));
	self.addEventListener("fetch", (e) => {
		const req = e.request;
		if (req.cache === "only-if-cached" && req.mode !== "same-origin") return;
		e.respondWith(
			fetch(req).then((res) => {
				if (res.status === 0) return res;
				const headers = new Headers(res.headers);
				headers.set("Cross-Origin-Embedder-Policy", "require-corp");
				headers.set("Cross-Origin-Opener-Policy", "same-origin");
				return new Response(res.body, {
					status: res.status,
					statusText: res.statusText,
					headers,
				});
			})
		);
	});
} else if (!window.crossOriginIsolated && "serviceWorker" in navigator) {
	navigator.serviceWorker.register(new URL("coi-serviceworker.js", location.href).href).then((reg) => {
		reg.addEventListener("updatefound", () => location.reload());
		if (reg.active && !navigator.serviceWorker.controller) {
			location.reload();
		}
	});
}
