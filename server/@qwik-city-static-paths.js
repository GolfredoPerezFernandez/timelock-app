const staticPaths = new Set(["/_headers","/_redirects","/apple-touch-icon-180x180.png","/favicon.ico","/favicon.svg","/fonts/poppins-400.woff2","/fonts/poppins-500.woff2","/fonts/poppins-700.woff2","/images/merida-mountains.svg","/images/moa-logo.svg","/logo.png","/manifest.json","/maskable-icon-512x512.png","/pwa-192x192.png","/pwa-512x512.png","/pwa-64x64.png","/q-manifest.json","/qwik-prefetch-service-worker.js","/robots.txt","/screenshot.png","/service-worker.js","/sitemap.xml","/uploads/tree-1749148382999-ei57g3.jpeg","/uploads/tree-1749149119668-3hs3up.jpeg","/uploads/tree-1749157653642-0sutkl.jpeg"]);
function isStaticPath(method, url) {
  if (method.toUpperCase() !== 'GET') {
    return false;
  }
  const p = url.pathname;
  if (p.startsWith("/build/")) {
    return true;
  }
  if (p.startsWith("/assets/")) {
    return true;
  }
  if (staticPaths.has(p)) {
    return true;
  }
  if (p.endsWith('/q-data.json')) {
    const pWithoutQdata = p.replace(/\/q-data.json$/, '');
    if (staticPaths.has(pWithoutQdata + '/')) {
      return true;
    }
    if (staticPaths.has(pWithoutQdata)) {
      return true;
    }
  }
  return false;
}
export { isStaticPath };