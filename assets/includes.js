// Lightweight include loader with recursion, base-URL resolution, timeouts, and script execution
const __INCLUDE_BASE = (() => {
  try {
    // 1) Explicit override
    if (window.__INCLUDE_BASE) return String(window.__INCLUDE_BASE).replace(/\/$/, '');
    // 2) <base href>
    const baseEl = document.querySelector('base[href]');
    if (baseEl) {
      const u = new URL(baseEl.getAttribute('href'), location.href);
      const p = u.pathname.replace(/\/$/, '');
      return p === '/' ? '' : p;
    }
    // 3) Derive from how *this* script was actually loaded.
    //    If it's served from "/something/assets/includes.js", use "/something" as base.
    const thisScript = [...document.scripts].find((s) => {
      if (!s.src) return false;
      const p = new URL(s.src, location.href).pathname;
      return /\/assets\/includes\.js($|\?)/.test(p);
    });
    if (thisScript) {
      const u = new URL(thisScript.src, location.href);
      const path = u.pathname.replace(/\/assets\/includes\.js.*$/, '');
      const normalized = path.replace(/\/$/, '');
      return normalized === '' || normalized === '/' ? '' : normalized;
    }
    // 4) GitHub Pages heuristic (kept, but not limited to github.io hosts)
    if (/\.github\.io$/i.test(location.hostname)) {
      const segs = location.pathname.split('/').filter(Boolean);
      if (segs.length) return '/' + segs[0];
    }
  } catch (_) {}
  return '';
})();

const __includesProcessed = new WeakSet();

// Normalize a path with the detected base; return an absolute href
function __normalizeIncludePath(p, baseForRel) {
  if (!p) return p;
  const s = String(p);
  const withBase = s.startsWith('/') ? __INCLUDE_BASE + s : s;
  return baseForRel ? new URL(withBase, baseForRel).href : new URL(withBase, window.location.href).href;
}

// Rewrite root-absolute URLs inside included fragments so they work on GH Pages
function __rewriteRootAbsoluteURLs(fragment) {
  // href-based
  fragment.querySelectorAll('a[href^="/"], link[href^="/"], use[href^="/"]').forEach((el) => {
    el.setAttribute('href', __INCLUDE_BASE + el.getAttribute('href'));
  });
  // src-based
  fragment.querySelectorAll('img[src^="/"], script[src^="/"], source[src^="/"], video[src^="/"], audio[src^="/"]').forEach((el) => {
    el.setAttribute('src', __INCLUDE_BASE + el.getAttribute('src'));
  });
  // nested data-include
  fragment.querySelectorAll('[data-include^="/"]').forEach((el) => {
    el.setAttribute('data-include', __INCLUDE_BASE + el.getAttribute('data-include'));
  });
}

async function injectIncludes() {
  // Run passes until no new nodes remain
  let pass = 0;
  while (true) {
    pass++;
    const nodes = [...document.querySelectorAll('[data-include]')].filter((el) => !__includesProcessed.has(el));
    if (!nodes.length) break;

    const results = [];

    await Promise.all(
      nodes.map(async (el) => {
        const urlAttr = el.getAttribute('data-include');
        if (!urlAttr) return;

        // Resolve include URL relative to document for top-level
        const srcUrl = new URL(__normalizeIncludePath(urlAttr), window.location.href);

        // Fetch with timeout
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 10000);
        try {
          const res = await fetch(srcUrl.href, { cache: 'no-cache', signal: controller.signal });
          clearTimeout(timer);
          if (!res.ok) throw new Error(res.status + ' ' + res.statusText);

          const html = await res.text();
          const tpl = document.createElement('template');
          tpl.innerHTML = html;
          __rewriteRootAbsoluteURLs(tpl.content);
          const fragment = tpl.content;

          // Rewrite nested [data-include] URLs to be absolute relative to this include's URL
          fragment.querySelectorAll('[data-include]').forEach((child) => {
            const childUrl = child.getAttribute('data-include');
            if (childUrl) child.setAttribute('data-include', __normalizeIncludePath(childUrl, srcUrl));
          });

          // Ensure any <script> inside the include executes
          [...fragment.querySelectorAll('script')].forEach((oldScript) => {
            const s = document.createElement('script');
            for (const { name, value } of [...oldScript.attributes]) s.setAttribute(name, value);
            if (!oldScript.src) s.textContent = oldScript.textContent || '';
            oldScript.replaceWith(s);
          });

          // Replace placeholder with the included content
          const clone = document.importNode(fragment, true);
          el.replaceWith(clone);
          __includesProcessed.add(el);
          results.push({ url: srcUrl.href });
        } catch (err) {
          clearTimeout(timer);
          // Visible inline error so failures aren't invisible
          const msg = document.createElement('div');
          msg.setAttribute('data-include-error', '');
          msg.style.cssText = 'padding:12px;border:1px dashed var(--color-border,#d0d7de);font-size:12px;color:#a00;background:#fff6f6;border-radius:6px;';
          msg.textContent = `Include failed: ${srcUrl.href} — ${err?.message || err}`;
          el.replaceWith(msg);
          __includesProcessed.add(el);
        }
      })
    );

    // Announce after each pass so listeners can react
    requestAnimationFrame(() => {
      const evt = new CustomEvent('includes:ready', { detail: { pass } });
      document.dispatchEvent(evt);
    });
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', injectIncludes, { once: true });
} else {
  injectIncludes();
}