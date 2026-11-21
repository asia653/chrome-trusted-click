/**
 * Trusted Click Debugger - Background Service Worker
 * Utilizes chrome.debugger API to dispatch genuine CDP Input events (isTrusted: true)
 */

// Set of currently attached tab IDs
const attachedTabs = new Set();

// Maximum recent history entries to store
const MAX_HISTORY = 30;

/**
 * Check if debugger is attached to a tab
 */
function isTabAttached(tabId) {
  return attachedTabs.has(tabId);
}

/**
 * Clean up tab attachment state on detach event
 */
chrome.debugger.onDetach.addListener((source, reason) => {
  if (source && source.tabId) {
    attachedTabs.delete(source.tabId);
    console.log(`[Debugger] Detached from tab ${source.tabId}. Reason: ${reason}`);
    broadcastStatus(source.tabId, false);
  }
});

/**
 * Clean up tab attachment state when tab is closed
 */
chrome.tabs.onRemoved.addListener((tabId) => {
  attachedTabs.delete(tabId);
});

/**
 * Attach debugger to tab safely
 */
async function attachDebugger(tabId) {
  if (attachedTabs.has(tabId)) {
    return true;
  }

  // Check if tab is valid and not chrome:// internal
  const tab = await chrome.tabs.get(tabId).catch(() => null);
  if (!tab || !tab.url) {
    throw new Error('Target tab is not available.');
  }

  if (tab.url.startsWith('chrome://') || tab.url.startsWith('chrome-extension://') || tab.url.startsWith('edge://')) {
    throw new Error('Chrome forbids debugger attachment on internal chrome:// or extension pages.');
  }

  try {
    await chrome.debugger.attach({ tabId }, '1.3');
    attachedTabs.add(tabId);
    console.log(`[Debugger] Attached successfully to tab ${tabId} (${tab.url})`);
    broadcastStatus(tabId, true);
    return true;
  } catch (err) {
    const msg = err.message || '';
    if (msg.includes('Already attached') || msg.includes('Another debugger is already attached')) {
      // If attached by us or compatible session
      attachedTabs.add(tabId);
      return true;
    }
    if (msg.includes('Developer Tools')) {
      throw new Error('Cannot attach debugger: Chrome Developer Tools is already open on this tab. Please close DevTools on the target tab or undock it.');
    }
    throw new Error(`Debugger attach failed: ${msg}`);
  }
}

/**
 * Detach debugger from tab safely
 */
async function detachDebugger(tabId) {
  if (!attachedTabs.has(tabId)) {
    return true;
  }

  try {
    await chrome.debugger.detach({ tabId });
  } catch (err) {
    console.warn(`[Debugger] Detach warning for tab ${tabId}:`, err);
  } finally {
    attachedTabs.delete(tabId);
    broadcastStatus(tabId, false);
  }
  return true;
}

/**
 * Send a CDP command with Promise wrapper
 */
function sendCdpCommand(tabId, method, params = {}) {
  return new Promise((resolve, reject) => {
    chrome.debugger.sendCommand({ tabId }, method, params, (result) => {
      if (chrome.runtime.lastError) {
        return reject(new Error(chrome.runtime.lastError.message));
      }
      resolve(result);
    });
  });
}

/**
 * Helper sleep utility
 */
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Dispatch genuine isTrusted click sequence via Chrome DevTools Protocol (CDP)
 */
async function dispatchTrustedClick(tabId, options = {}) {
  const startTime = Date.now();
  const {
    x = 0,
    y = 0,
    button = 'left',      // 'left' | 'right' | 'middle'
    clickCount = 1,       // 1 for single click, 2 for double click
    delay = 60,           // mousedown to mouseup dwell time in ms
    autoDetach = false,   // whether to detach after click
    selector = null
  } = options;

  const targetX = Math.round(Number(x));
  const targetY = Math.round(Number(y));

  if (isNaN(targetX) || isNaN(targetY) || targetX < 0 || targetY < 0) {
    throw new Error(`Invalid click coordinates: (${x}, ${y})`);
  }

  // Step 1: Ensure debugger is attached
  await attachDebugger(tabId);

  // Map mouse button names to CDP button and buttons bitmask
  let cdpButton = 'left';
  let cdpButtons = 1;

  if (button === 'right') {
    cdpButton = 'right';
    cdpButtons = 2;
  } else if (button === 'middle') {
    cdpButton = 'middle';
    cdpButtons = 4;
  }

  try {
    // Step 2: Move mouse cursor to target location
    await sendCdpCommand(tabId, 'Input.dispatchMouseEvent', {
      type: 'mouseMoved',
      x: targetX,
      y: targetY
    });

    await sleep(25);

    // Step 3: Mouse Down (mousePressed)
    await sendCdpCommand(tabId, 'Input.dispatchMouseEvent', {
      type: 'mousePressed',
      x: targetX,
      y: targetY,
      button: cdpButton,
      buttons: cdpButtons,
      clickCount: 1
    });

    // Step 4: Dwell time between press and release
    await sleep(Math.max(20, delay));

    // Step 5: Mouse Up (mouseReleased)
    await sendCdpCommand(tabId, 'Input.dispatchMouseEvent', {
      type: 'mouseReleased',
      x: targetX,
      y: targetY,
      button: cdpButton,
      buttons: 0,
      clickCount: 1
    });

    // Step 6: If double click requested, dispatch second click
    if (clickCount >= 2) {
      await sleep(40);
      await sendCdpCommand(tabId, 'Input.dispatchMouseEvent', {
        type: 'mousePressed',
        x: targetX,
        y: targetY,
        button: cdpButton,
        buttons: cdpButtons,
        clickCount: 2
      });

      await sleep(Math.max(20, delay));

      await sendCdpCommand(tabId, 'Input.dispatchMouseEvent', {
        type: 'mouseReleased',
        x: targetX,
        y: targetY,
        button: cdpButton,
        buttons: 0,
        clickCount: 2
      });
    }

    const duration = Date.now() - startTime;
    const logEntry = {
      id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
      timestamp: new Date().toLocaleTimeString(),
      tabId,
      x: targetX,
      y: targetY,
      button,
      clickCount,
      selector,
      duration,
      success: true,
      isTrusted: true
    };

    await recordHistory(logEntry);

    // Auto detach if requested
    if (autoDetach) {
      setTimeout(() => {
        detachDebugger(tabId);
      }, 150);
    }

    return logEntry;
  } catch (err) {
    const errorEntry = {
      id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
      timestamp: new Date().toLocaleTimeString(),
      tabId,
      x: targetX,
      y: targetY,
      button,
      clickCount,
      selector,
      duration: Date.now() - startTime,
      success: false,
      error: err.message
    };
    await recordHistory(errorEntry);
    throw err;
  }
}

/**
 * Record action in history (chrome.storage.local)
 */
async function recordHistory(entry) {
  try {
    const data = await chrome.storage.local.get('clickHistory');
    const history = Array.isArray(data.clickHistory) ? data.clickHistory : [];
    history.unshift(entry);
    if (history.length > MAX_HISTORY) {
      history.length = MAX_HISTORY;
    }
    await chrome.storage.local.set({ clickHistory: history });
  } catch (e) {
    console.warn('Failed to record click history:', e);
  }
}

/**
 * Broadcast debugger status change to popup or content scripts
 */
function broadcastStatus(tabId, isAttached) {
  chrome.runtime.sendMessage({
    type: 'DEBUGGER_STATUS_CHANGED',
    tabId,
    isAttached
  }).catch(() => {
    // Popup or listener may not be open, ignore error
  });
}

/**
 * Get active tab in current window
 */
async function getActiveTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab || null;
}

/**
 * Main Message Listener
 */
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  // We handle responses asynchronously
  (async () => {
    try {
      const action = message.action || message.type;

      if (action === 'GET_STATUS') {
        const targetTabId = message.tabId || (sender.tab ? sender.tab.id : (await getActiveTab())?.id);
        const attached = targetTabId ? isTabAttached(targetTabId) : false;
        let tabInfo = null;
        if (targetTabId) {
          tabInfo = await chrome.tabs.get(targetTabId).catch(() => null);
        }
        sendResponse({
          success: true,
          isAttached: attached,
          tabId: targetTabId,
          tabTitle: tabInfo ? tabInfo.title : '',
          tabUrl: tabInfo ? tabInfo.url : ''
        });
        return;
      }

      if (action === 'ATTACH_TAB') {
        const targetTabId = message.tabId || (sender.tab ? sender.tab.id : (await getActiveTab())?.id);
        if (!targetTabId) throw new Error('No target tab specified.');
        await attachDebugger(targetTabId);
        sendResponse({ success: true, tabId: targetTabId, isAttached: true });
        return;
      }

      if (action === 'DETACH_TAB') {
        const targetTabId = message.tabId || (sender.tab ? sender.tab.id : (await getActiveTab())?.id);
        if (!targetTabId) throw new Error('No target tab specified.');
        await detachDebugger(targetTabId);
        sendResponse({ success: true, tabId: targetTabId, isAttached: false });
        return;
      }

      if (action === 'DISPATCH_CLICK') {
        let targetTabId = message.tabId || (sender.tab ? sender.tab.id : null);
        if (!targetTabId) {
          const activeTab = await getActiveTab();
          targetTabId = activeTab?.id;
        }
        if (!targetTabId) throw new Error('Could not identify target tab.');

        const result = await dispatchTrustedClick(targetTabId, message);
        sendResponse({ success: true, ...result });
        return;
      }

      if (action === 'OPEN_TEST_PAGE') {
        const testPageUrl = chrome.runtime.getURL('test.html');
        const tab = await chrome.tabs.create({ url: testPageUrl });
        sendResponse({ success: true, tabId: tab.id });
        return;
      }

      if (action === 'CLEAR_HISTORY') {
        await chrome.storage.local.set({ clickHistory: [] });
        sendResponse({ success: true });
        return;
      }

      sendResponse({ success: false, error: `Unknown action: ${action}` });
    } catch (err) {
      console.error('[Background Worker Error]:', err);
      sendResponse({ success: false, error: err.message || String(err) });
    }
  })();

  return true; // Keep message port open for async response
});

console.log('[Trusted Click Debugger] Service worker initialized.');
