/**
 * Trusted Click Debugger - Popup Controller
 */

document.addEventListener('DOMContentLoaded', async () => {
  // Elements
  const statusIndicatorDot = document.getElementById('statusIndicatorDot');
  const btnToggleAttach = document.getElementById('btnToggleAttach');
  const tabTitle = document.getElementById('tabTitle');
  const tabStatusBadge = document.getElementById('tabStatusBadge');

  const btnPickElement = document.getElementById('btnPickElement');
  const tabBtnSelector = document.getElementById('tabBtnSelector');
  const tabBtnCoords = document.getElementById('tabBtnCoords');
  const sectionSelector = document.getElementById('sectionSelector');
  const sectionCoords = document.getElementById('sectionCoords');

  const inputSelector = document.getElementById('inputSelector');
  const btnClickSelector = document.getElementById('btnClickSelector');

  const inputCoordX = document.getElementById('inputCoordX');
  const inputCoordY = document.getElementById('inputCoordY');
  const btnClickCoords = document.getElementById('btnClickCoords');

  const selectButton = document.getElementById('selectButton');
  const selectClickCount = document.getElementById('selectClickCount');
  const inputDelay = document.getElementById('inputDelay');
  const checkAutoDetach = document.getElementById('checkAutoDetach');

  const btnCopySnippet = document.getElementById('btnCopySnippet');
  const btnOpenTestPage = document.getElementById('btnOpenTestPage');

  const statusBanner = document.getElementById('statusBanner');
  const statusBannerIcon = document.getElementById('statusBannerIcon');
  const statusBannerText = document.getElementById('statusBannerText');

  let currentTab = null;
  let isAttached = false;

  /**
   * Helper: Show notification banner
   */
  function showBanner(type, message) {
    statusBanner.classList.remove('hidden', 'bg-emerald-900/30', 'border-emerald-500/30', 'text-emerald-300', 'bg-red-900/30', 'border-red-500/30', 'text-red-300', 'bg-indigo-900/30', 'border-indigo-500/30', 'text-indigo-300');

    if (type === 'success') {
      statusBanner.classList.add('bg-emerald-900/30', 'border-emerald-500/30', 'text-emerald-300');
      statusBannerIcon.textContent = '✅';
    } else if (type === 'error') {
      statusBanner.classList.add('bg-red-900/30', 'border-red-500/30', 'text-red-300');
      statusBannerIcon.textContent = '❌';
    } else {
      statusBanner.classList.add('bg-indigo-900/30', 'border-indigo-500/30', 'text-indigo-300');
      statusBannerIcon.textContent = 'ℹ️';
    }

    statusBannerText.textContent = message;
  }

  /**
   * Update UI to reflect attachment status
   */
  function updateAttachmentState(attached) {
    isAttached = attached;
    if (attached) {
      statusIndicatorDot.classList.remove('bg-slate-600');
      statusIndicatorDot.classList.add('bg-emerald-500');

      tabStatusBadge.classList.remove('bg-slate-800', 'text-slate-400');
      tabStatusBadge.classList.add('bg-emerald-900/30', 'text-emerald-400', 'border', 'border-emerald-500/30');
      tabStatusBadge.textContent = 'Attached';

      btnToggleAttach.textContent = 'Detach';
      btnToggleAttach.classList.remove('bg-slate-800', 'text-slate-200');
      btnToggleAttach.classList.add('bg-red-900/30', 'hover:bg-red-600', 'text-red-300', 'border-red-500/30');
    } else {
      statusIndicatorDot.classList.remove('bg-emerald-500');
      statusIndicatorDot.classList.add('bg-slate-600');

      tabStatusBadge.classList.remove('bg-emerald-900/30', 'text-emerald-400', 'border', 'border-emerald-500/30');
      tabStatusBadge.classList.add('bg-slate-800', 'text-slate-400');
      tabStatusBadge.textContent = 'Detached';

      btnToggleAttach.textContent = 'Attach';
      btnToggleAttach.classList.remove('bg-red-900/30', 'hover:bg-red-600', 'text-red-300', 'border-red-500/30');
      btnToggleAttach.classList.add('bg-slate-800', 'text-slate-200');
    }
  }

  /**
   * Initialize Tab & Status
   */
  async function init() {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab) {
      tabTitle.textContent = 'No active tab found';
      return;
    }
    currentTab = tab;
    tabTitle.textContent = tab.title || tab.url || 'Active Tab';

    // Query status from background
    try {
      const response = await chrome.runtime.sendMessage({
        action: 'GET_STATUS',
        tabId: currentTab.id
      });
      if (response && response.success) {
        updateAttachmentState(response.isAttached);
      }
    } catch (e) {
      console.warn('Status query failed:', e);
    }
  }

  await init();

  /**
   * Listen for status broadcast from background
   */
  chrome.runtime.onMessage.addListener((msg) => {
    if (msg.type === 'DEBUGGER_STATUS_CHANGED' && currentTab && msg.tabId === currentTab.id) {
      updateAttachmentState(msg.isAttached);
    }
  });

  /**
   * Toggle Debugger Attachment
   */
  btnToggleAttach.addEventListener('click', async () => {
    if (!currentTab) return;
    try {
      if (isAttached) {
        await chrome.runtime.sendMessage({ action: 'DETACH_TAB', tabId: currentTab.id });
        updateAttachmentState(false);
        showBanner('info', 'Debugger detached.');
      } else {
        const res = await chrome.runtime.sendMessage({ action: 'ATTACH_TAB', tabId: currentTab.id });
        if (res.success) {
          updateAttachmentState(true);
          showBanner('success', 'Debugger attached! Ready for trusted clicks.');
        } else {
          showBanner('error', res.error || 'Failed to attach debugger.');
        }
      }
    } catch (err) {
      showBanner('error', err.message);
    }
  });

  /**
   * Tabs Switcher (Selector vs Coordinates)
   */
  tabBtnSelector.addEventListener('click', () => {
    tabBtnSelector.classList.add('bg-slate-700', 'text-white', 'shadow-xs');
    tabBtnSelector.classList.remove('text-slate-400');

    tabBtnCoords.classList.remove('bg-slate-700', 'text-white', 'shadow-xs');
    tabBtnCoords.classList.add('text-slate-400');

    sectionSelector.classList.remove('hidden');
    sectionCoords.classList.add('hidden');
  });

  tabBtnCoords.addEventListener('click', () => {
    tabBtnCoords.classList.add('bg-slate-700', 'text-white', 'shadow-xs');
    tabBtnCoords.classList.remove('text-slate-400');

    tabBtnSelector.classList.remove('bg-slate-700', 'text-white', 'shadow-xs');
    tabBtnSelector.classList.add('text-slate-400');

    sectionCoords.classList.remove('hidden');
    sectionSelector.classList.add('hidden');
  });

  /**
   * Pick Element & Click Mode
   */
  btnPickElement.addEventListener('click', async () => {
    if (!currentTab) return;
    try {
      await chrome.tabs.sendMessage(currentTab.id, { action: 'START_PICKER' });
      // Close popup so user interacts with page directly
      window.close();
    } catch (err) {
      showBanner('error', 'Could not start picker. Refresh the page or check permissions.');
    }
  });

  /**
   * Click by CSS Selector
   */
  btnClickSelector.addEventListener('click', async () => {
    const selector = inputSelector.value.trim();
    if (!selector) {
      showBanner('error', 'Please enter a CSS selector.');
      inputSelector.focus();
      return;
    }

    if (!currentTab) return;

    btnClickSelector.disabled = true;
    showBanner('info', `Locating element: ${selector}...`);

    try {
      // 1. Ask content script to find coordinates
      const coordsRes = await chrome.tabs.sendMessage(currentTab.id, {
        action: 'RESOLVE_SELECTOR',
        selector
      });

      if (!coordsRes || !coordsRes.success) {
        throw new Error(coordsRes ? coordsRes.error : 'Element not found on page.');
      }

      // 2. Dispatch trusted click via background CDP
      const clickRes = await chrome.runtime.sendMessage({
        action: 'DISPATCH_CLICK',
        tabId: currentTab.id,
        x: coordsRes.x,
        y: coordsRes.y,
        selector,
        button: selectButton.value,
        clickCount: parseInt(selectClickCount.value, 10),
        delay: parseInt(inputDelay.value, 10) || 60,
        autoDetach: checkAutoDetach.checked
      });

      if (clickRes && clickRes.success) {
        updateAttachmentState(!checkAutoDetach.checked);
        showBanner('success', `Clicked <${coordsRes.tagName}> at (${coordsRes.x}, ${coordsRes.y}) [isTrusted: true]`);
      } else {
        throw new Error(clickRes ? clickRes.error : 'Click dispatch failed.');
      }
    } catch (err) {
      showBanner('error', err.message);
    } finally {
      btnClickSelector.disabled = false;
    }
  });

  // Enter key trigger for selector input
  inputSelector.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      btnClickSelector.click();
    }
  });

  /**
   * Click by Coordinates
   */
  btnClickCoords.addEventListener('click', async () => {
    const x = parseFloat(inputCoordX.value);
    const y = parseFloat(inputCoordY.value);

    if (isNaN(x) || isNaN(y)) {
      showBanner('error', 'Please enter valid X and Y coordinates.');
      return;
    }

    if (!currentTab) return;

    btnClickCoords.disabled = true;
    showBanner('info', `Dispatching click at (${x}, ${y})...`);

    try {
      const clickRes = await chrome.runtime.sendMessage({
        action: 'DISPATCH_CLICK',
        tabId: currentTab.id,
        x,
        y,
        button: selectButton.value,
        clickCount: parseInt(selectClickCount.value, 10),
        delay: parseInt(inputDelay.value, 10) || 60,
        autoDetach: checkAutoDetach.checked
      });

      if (clickRes && clickRes.success) {
        updateAttachmentState(!checkAutoDetach.checked);
        showBanner('success', `Native click dispatched at (${x}, ${y}) [isTrusted: true]`);
      } else {
        throw new Error(clickRes ? clickRes.error : 'Click dispatch failed.');
      }
    } catch (err) {
      showBanner('error', err.message);
    } finally {
      btnClickCoords.disabled = false;
    }
  });

  /**
   * Copy Snippet Button
   */
  btnCopySnippet.addEventListener('click', () => {
    const customSel = inputSelector.value.trim() || '#my-button';
    const snippet = `await window.sendTrustedClick('${customSel}');`;
    navigator.clipboard.writeText(snippet);
    btnCopySnippet.textContent = 'Copied!';
    setTimeout(() => {
      btnCopySnippet.textContent = 'Copy';
    }, 1500);
  });

  /**
   * Open Test Playground
   */
  btnOpenTestPage.addEventListener('click', async () => {
    try {
      await chrome.runtime.sendMessage({ action: 'OPEN_TEST_PAGE' });
      window.close();
    } catch (e) {
      chrome.tabs.create({ url: chrome.runtime.getURL('test.html') });
      window.close();
    }
  });
});
