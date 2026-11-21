/**
 * Trusted Click Debugger - Page Bridge
 * Injected into the MAIN world to expose `window.sendTrustedClick` directly
 * to web pages, test suites, and Chrome DevTools Console.
 */

(function () {
  if (window.__trustedClickBridgeInstalled) return;
  window.__trustedClickBridgeInstalled = true;

  const pendingRequests = new Map();

  // Listen for responses from content script
  window.addEventListener('message', (event) => {
    if (event.source !== window || !event.data || event.data.source !== 'TRUSTED_CLICK_CONTENT') {
      return;
    }

    const { id, success, data, error } = event.data;
    if (pendingRequests.has(id)) {
      const { resolve, reject } = pendingRequests.get(id);
      pendingRequests.delete(id);

      if (success) {
        resolve(data);
      } else {
        reject(new Error(error || 'Failed to dispatch trusted click.'));
      }
    }
  });

  /**
   * Send a trusted click using Chrome Debugger API
   *
   * Usage examples:
   *   await window.sendTrustedClick('#my-button');
   *   await window.sendTrustedClick(document.querySelector('.submit-btn'));
   *   await window.sendTrustedClick(250, 400);
   *   await window.sendTrustedClick('#btn', { button: 'right', delay: 80 });
   */
  async function sendTrustedClick(...args) {
    let target = args[0];
    let options = {};
    let x = null;
    let y = null;
    let selector = null;

    if (typeof target === 'number' && typeof args[1] === 'number') {
      // (x, y, [options])
      x = target;
      y = args[1];
      options = args[2] || {};
    } else if (typeof target === 'string') {
      // (selector, [options])
      selector = target;
      options = args[1] || {};
      const el = document.querySelector(selector);
      if (!el) {
        throw new Error(`[TrustedClick] Element not found for selector: "${selector}"`);
      }
      el.scrollIntoView({ behavior: 'instant', block: 'center', inline: 'center' });
      const rect = el.getBoundingClientRect();
      x = Math.round(rect.left + rect.width / 2);
      y = Math.round(rect.top + rect.height / 2);
    } else if (target instanceof Element) {
      // (DOMElement, [options])
      options = args[1] || {};
      target.scrollIntoView({ behavior: 'instant', block: 'center', inline: 'center' });
      const rect = target.getBoundingClientRect();
      x = Math.round(rect.left + rect.width / 2);
      y = Math.round(rect.top + rect.height / 2);
      selector = target.tagName.toLowerCase() + (target.id ? `#${target.id}` : '') + (target.className ? `.${target.className.split(' ').filter(Boolean).join('.')}` : '');
    } else if (typeof target === 'object' && target !== null) {
      // ({ x, y, ...options })
      x = target.x;
      y = target.y;
      selector = target.selector;
      options = target;
    } else {
      throw new Error('[TrustedClick] Invalid arguments. Expected selector, DOM element, or (x, y) coordinates.');
    }

    if (typeof x !== 'number' || typeof y !== 'number' || isNaN(x) || isNaN(y)) {
      throw new Error(`[TrustedClick] Could not determine coordinates for target.`);
    }

    const requestId = 'tc_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 7);

    return new Promise((resolve, reject) => {
      // 10s timeout safety
      const timeoutId = setTimeout(() => {
        if (pendingRequests.has(requestId)) {
          pendingRequests.delete(requestId);
          reject(new Error('[TrustedClick] Request timed out. Ensure the extension is loaded and active.'));
        }
      }, 10000);

      pendingRequests.set(requestId, {
        resolve: (res) => {
          clearTimeout(timeoutId);
          console.log(
            `%c[TrustedClick]%c Dispatched native click at (%d, %d) %c(isTrusted: true)`,
            'background:#4f46e5;color:#ffffff;padding:2px 6px;border-radius:4px;font-weight:bold;',
            'color:#10b981;font-weight:bold;margin-left:4px;',
            x,
            y,
            'background:#10b981;color:#ffffff;padding:2px 5px;border-radius:4px;font-weight:bold;'
          );
          resolve(res);
        },
        reject: (err) => {
          clearTimeout(timeoutId);
          console.error('[TrustedClick] Error:', err.message);
          reject(err);
        }
      });

      window.postMessage({
        source: 'TRUSTED_CLICK_BRIDGE',
        type: 'DISPATCH_CLICK',
        id: requestId,
        payload: {
          x,
          y,
          selector,
          button: options.button || 'left',
          clickCount: options.clickCount || 1,
          delay: options.delay || 60,
          autoDetach: options.autoDetach !== undefined ? options.autoDetach : false
        }
      }, '*');
    });
  }

  // Expose global methods
  window.sendTrustedClick = sendTrustedClick;
  window.trustedClick = sendTrustedClick;

  console.log(
    '%c[Trusted Click Debugger]%c Ready! Use %cwindow.sendTrustedClick(selectorOrElement, options)%c in the console.',
    'background:#4f46e5;color:#ffffff;padding:2px 6px;border-radius:4px;font-weight:bold;',
    'color:#4f46e5;font-weight:500;margin-left:4px;',
    'background:#1e293b;color:#38bdf8;padding:2px 6px;border-radius:4px;font-family:monospace;font-weight:bold;',
    'color:#4f46e5;'
  );
})();
