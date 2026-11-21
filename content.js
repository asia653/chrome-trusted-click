/**
 * Trusted Click Debugger - Content Script
 * Injected into web pages to bridge window.sendTrustedClick to background CDP service
 * and provide visual element inspection / picker mode.
 */

(function () {
  // Prevent duplicate injection
  if (window.__trustedClickContentInitialized) return;
  window.__trustedClickContentInitialized = true;

  /**
   * 1. Inject Page Bridge Script into MAIN world
   */
  function injectBridge() {
    try {
      const script = document.createElement('script');
      script.src = chrome.runtime.getURL('page-bridge.js');
      script.onload = () => script.remove();
      (document.head || document.documentElement).appendChild(script);
    } catch (e) {
      console.warn('[TrustedClick] Could not inject page bridge script:', e);
    }
  }

  injectBridge();

  /**
   * 2. Message Bridge: Relays requests between page-bridge.js and background.js
   */
  window.addEventListener('message', async (event) => {
    if (event.source !== window || !event.data || event.data.source !== 'TRUSTED_CLICK_BRIDGE') {
      return;
    }

    const { id, type, payload } = event.data;

    if (type === 'DISPATCH_CLICK') {
      try {
        const response = await chrome.runtime.sendMessage({
          action: 'DISPATCH_CLICK',
          ...payload
        });

        // Flash visual confirmation on target if selector was provided
        if (payload.selector) {
          flashElementSuccess(payload.selector);
        }

        window.postMessage({
          source: 'TRUSTED_CLICK_CONTENT',
          id,
          success: response && response.success,
          data: response,
          error: response ? response.error : 'No response from background worker'
        }, '*');
      } catch (err) {
        window.postMessage({
          source: 'TRUSTED_CLICK_CONTENT',
          id,
          success: false,
          error: err.message || String(err)
        }, '*');
      }
    }
  });

  /**
   * 3. Element Picker Mode
   */
  let isPickerActive = false;
  let hoveredElement = null;
  let pickerBanner = null;

  function flashElementSuccess(selectorOrElement) {
    const el = typeof selectorOrElement === 'string' ? document.querySelector(selectorOrElement) : selectorOrElement;
    if (!el) return;

    el.classList.add('ring-4', 'ring-emerald-400', 'ring-offset-2', 'transition-all');
    setTimeout(() => {
      el.classList.remove('ring-4', 'ring-emerald-400', 'ring-offset-2');
    }, 600);
  }

  function createPickerBanner() {
    if (pickerBanner) return;

    pickerBanner = document.createElement('div');
    pickerBanner.id = 'trusted-click-picker-banner';
    pickerBanner.className = 'fixed top-4 left-1/2 -translate-x-1/2 bg-slate-900 text-white px-5 py-2.5 rounded-full shadow-2xl border border-indigo-500 flex items-center gap-3 z-[999999] font-sans text-sm select-none animate-pulse';

    const iconSpan = document.createElement('span');
    iconSpan.className = 'text-base';
    iconSpan.textContent = '🎯';

    const textSpan = document.createElement('span');
    textSpan.className = 'font-medium text-slate-100';
    textSpan.textContent = 'Click any element to dispatch trusted click';

    const escBadge = document.createElement('span');
    escBadge.className = 'text-xs bg-slate-800 text-slate-300 px-2 py-0.5 rounded border border-slate-700 font-mono';
    escBadge.textContent = 'Esc to cancel';

    pickerBanner.appendChild(iconSpan);
    pickerBanner.appendChild(textSpan);
    pickerBanner.appendChild(escBadge);
    document.body.appendChild(pickerBanner);
  }

  function removePickerBanner() {
    if (pickerBanner && pickerBanner.parentNode) {
      pickerBanner.parentNode.removeChild(pickerBanner);
    }
    pickerBanner = null;
  }

  function onPickerMouseOver(e) {
    if (!isPickerActive) return;
    if (hoveredElement && hoveredElement !== e.target) {
      hoveredElement.classList.remove('ring-4', 'ring-indigo-500', 'ring-offset-2');
    }
    hoveredElement = e.target;
    // Don't highlight our own banner
    if (hoveredElement === pickerBanner || (pickerBanner && pickerBanner.contains(hoveredElement))) {
      return;
    }
    hoveredElement.classList.add('ring-4', 'ring-indigo-500', 'ring-offset-2');
  }

  function onPickerMouseOut(e) {
    if (!isPickerActive) return;
    if (e.target && e.target.classList) {
      e.target.classList.remove('ring-4', 'ring-indigo-500', 'ring-offset-2');
    }
  }

  async function onPickerClick(e) {
    if (!isPickerActive) return;
    // If clicked on banner, cancel
    if (pickerBanner && pickerBanner.contains(e.target)) {
      stopPicker();
      return;
    }

    e.preventDefault();
    e.stopPropagation();
    e.stopImmediatePropagation();

    const targetEl = e.target;
    stopPicker();

    // Calculate viewport coordinates
    targetEl.scrollIntoView({ behavior: 'instant', block: 'center', inline: 'center' });
    const rect = targetEl.getBoundingClientRect();
    const x = Math.round(rect.left + rect.width / 2);
    const y = Math.round(rect.top + rect.height / 2);

    const selector = generateSelector(targetEl);

    // Visual flash
    flashElementSuccess(targetEl);

    // Dispatch via background CDP
    try {
      await chrome.runtime.sendMessage({
        action: 'DISPATCH_CLICK',
        x,
        y,
        selector,
        button: 'left',
        clickCount: 1,
        delay: 60
      });
    } catch (err) {
      console.error('[TrustedClick] Picker dispatch failed:', err);
    }
  }

  function onPickerKeyDown(e) {
    if (e.key === 'Escape' && isPickerActive) {
      stopPicker();
    }
  }

  function startPicker() {
    if (isPickerActive) return;
    isPickerActive = true;
    createPickerBanner();

    document.addEventListener('mouseover', onPickerMouseOver, true);
    document.addEventListener('mouseout', onPickerMouseOut, true);
    document.addEventListener('click', onPickerClick, true);
    document.addEventListener('keydown', onPickerKeyDown, true);
  }

  function stopPicker() {
    if (!isPickerActive) return;
    isPickerActive = false;
    if (hoveredElement) {
      hoveredElement.classList.remove('ring-4', 'ring-indigo-500', 'ring-offset-2');
      hoveredElement = null;
    }
    removePickerBanner();

    document.removeEventListener('mouseover', onPickerMouseOver, true);
    document.removeEventListener('mouseout', onPickerMouseOut, true);
    document.removeEventListener('click', onPickerClick, true);
    document.removeEventListener('keydown', onPickerKeyDown, true);
  }

  function generateSelector(el) {
    if (el.id) return `#${CSS.escape(el.id)}`;
    let path = [];
    let current = el;
    while (current && current.nodeType === Node.ELEMENT_NODE && path.length < 3) {
      let tag = current.tagName.toLowerCase();
      if (current.id) {
        path.unshift(`#${CSS.escape(current.id)}`);
        break;
      }
      if (current.className && typeof current.className === 'string') {
        const classes = current.className.split(/\s+/).filter(c => c && !c.startsWith('ring-')).slice(0, 2);
        if (classes.length > 0) {
          tag += '.' + classes.map(c => CSS.escape(c)).join('.');
        }
      }
      path.unshift(tag);
      current = current.parentElement;
    }
    return path.join(' > ') || el.tagName.toLowerCase();
  }

  /**
   * 4. Listen for commands from Popup
   */
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === 'START_PICKER') {
      startPicker();
      sendResponse({ success: true, isPickerActive: true });
      return;
    }

    if (message.action === 'STOP_PICKER') {
      stopPicker();
      sendResponse({ success: true, isPickerActive: false });
      return;
    }

    if (message.action === 'RESOLVE_SELECTOR') {
      const { selector } = message;
      try {
        const el = document.querySelector(selector);
        if (!el) {
          sendResponse({ success: false, error: `No element found matching selector: "${selector}"` });
          return;
        }

        el.scrollIntoView({ behavior: 'instant', block: 'center', inline: 'center' });
        const rect = el.getBoundingClientRect();
        const x = Math.round(rect.left + rect.width / 2);
        const y = Math.round(rect.top + rect.height / 2);

        flashElementSuccess(el);

        sendResponse({
          success: true,
          x,
          y,
          rect: {
            left: Math.round(rect.left),
            top: Math.round(rect.top),
            width: Math.round(rect.width),
            height: Math.round(rect.height)
          },
          tagName: el.tagName.toLowerCase()
        });
      } catch (err) {
        sendResponse({ success: false, error: err.message });
      }
      return;
    }
  });

  console.log('[Trusted Click Debugger] Content script active.');
})();
