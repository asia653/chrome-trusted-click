/**
 * Trusted Click Debugger - Verification Playground Controller
 */

document.addEventListener('DOMContentLoaded', () => {
  const eventLogBody = document.getElementById('eventLogBody');
  const eventCounter = document.getElementById('eventCounter');
  const btnClearLog = document.getElementById('btnClearLog');

  const antiBotStatus = document.getElementById('antiBotStatus');
  const antiBotStatusText = document.getElementById('antiBotStatusText');
  const btnSyntheticTest = document.getElementById('btnSyntheticTest');
  const btnAntiBot = document.getElementById('btnAntiBot');

  const targetZone = document.getElementById('targetZone');
  const targetZoneCoords = document.getElementById('targetZoneCoords');
  const btnClickTargetViaExt = document.getElementById('btnClickTargetViaExt');

  const testCheckbox = document.getElementById('testCheckbox');
  const checkboxTrustBadge = document.getElementById('checkboxTrustBadge');
  const btnDoubleClick = document.getElementById('btnDoubleClick');

  const testFileInput = document.getElementById('testFileInput');
  const btnTriggerFile = document.getElementById('btnTriggerFile');
  const filePickerStatus = document.getElementById('filePickerStatus');

  const btnCopyConsoleCode = document.getElementById('btnCopyConsoleCode');

  let totalEvents = 0;

  /**
   * Format timestamp
   */
  function getTimestamp() {
    const d = new Date();
    const pad = (n, s = 2) => String(n).padStart(s, '0');
    return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}.${pad(d.getMilliseconds(), 3)}`;
  }

  /**
   * Log Mouse Event in Stream
   */
  function logEvent(e) {
    totalEvents++;
    if (totalEvents === 1) {
      eventLogBody.innerHTML = '';
    }
    eventCounter.textContent = `${totalEvents} event${totalEvents === 1 ? '' : 's'} logged`;

    const tr = document.createElement('tr');
    tr.className = 'hover:bg-slate-900/60 transition-colors';

    // Time
    const tdTime = document.createElement('td');
    tdTime.className = 'px-3.5 py-2 text-slate-400 font-mono';
    tdTime.textContent = getTimestamp();

    // Event Type
    const tdType = document.createElement('td');
    tdType.className = 'px-3.5 py-2 font-semibold text-slate-200';
    tdType.textContent = e.type;

    // isTrusted Badge
    const tdTrust = document.createElement('td');
    tdTrust.className = 'px-3.5 py-2';
    const badge = document.createElement('span');
    badge.className = e.isTrusted
      ? 'inline-flex items-center px-2 py-0.5 rounded text-[11px] font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
      : 'inline-flex items-center px-2 py-0.5 rounded text-[11px] font-bold bg-red-500/20 text-red-400 border border-red-500/30';
    badge.textContent = e.isTrusted ? '✓ true (Trusted)' : '✗ false (Synthetic)';
    tdTrust.appendChild(badge);

    // Coordinates
    const tdCoords = document.createElement('td');
    tdCoords.className = 'px-3.5 py-2 text-indigo-300 font-mono';
    tdCoords.textContent = `(${e.clientX}, ${e.clientY})`;

    // Button
    const tdButton = document.createElement('td');
    tdButton.className = 'px-3.5 py-2 text-slate-400';
    const btnNames = ['Left (0)', 'Middle (1)', 'Right (2)'];
    tdButton.textContent = btnNames[e.button] || `Button ${e.button}`;

    // Target Element
    const tdTarget = document.createElement('td');
    tdTarget.className = 'px-3.5 py-2 text-slate-400 truncate max-w-xs';
    const targetTag = e.target.tagName ? e.target.tagName.toLowerCase() : 'element';
    const targetId = e.target.id ? `#${e.target.id}` : '';
    tdTarget.textContent = `${targetTag}${targetId}`;

    tr.appendChild(tdTime);
    tr.appendChild(tdType);
    tr.appendChild(tdTrust);
    tr.appendChild(tdCoords);
    tr.appendChild(tdButton);
    tr.appendChild(tdTarget);

    eventLogBody.insertBefore(tr, eventLogBody.firstChild);

    // Limit log rows to 100
    if (eventLogBody.children.length > 100) {
      eventLogBody.removeChild(eventLogBody.lastChild);
    }
  }

  // Global listeners on window to capture all clicks and presses
  ['click', 'mousedown', 'mouseup', 'dblclick'].forEach(eventType => {
    window.addEventListener(eventType, (e) => {
      // Don't clutter with log clear button clicks
      if (e.target === btnClearLog) return;
      logEvent(e);
    }, true);
  });

  /**
   * Clear Log
   */
  btnClearLog.addEventListener('click', () => {
    totalEvents = 0;
    eventCounter.textContent = '0 events logged';
    eventLogBody.innerHTML = `
      <tr>
        <td colspan="6" class="px-3.5 py-6 text-center text-slate-500">
          Log cleared. Awaiting new events...
        </td>
      </tr>
    `;
  });

  /**
   * Test 1: Anti-Bot Simulator
   */
  btnAntiBot.addEventListener('click', (e) => {
    antiBotStatus.classList.remove('bg-slate-950', 'bg-emerald-900/30', 'border-emerald-500/30', 'bg-red-900/30', 'border-red-500/30');

    if (e.isTrusted) {
      antiBotStatus.classList.add('bg-emerald-900/30', 'border-emerald-500/30');
      antiBotStatusText.className = 'font-semibold text-emerald-300';
      antiBotStatusText.textContent = `✅ ACCESS GRANTED: Native click verified (isTrusted: true at ${getTimestamp()})`;
    } else {
      antiBotStatus.classList.add('bg-red-900/30', 'border-red-500/30');
      antiBotStatusText.className = 'font-semibold text-red-300';
      antiBotStatusText.textContent = `❌ ACCESS DENIED: Synthetic JS click detected (isTrusted: false at ${getTimestamp()})`;
    }
  });

  // Synthetic click trigger (demonstrates failure of normal JS event dispatch)
  btnSyntheticTest.addEventListener('click', () => {
    // Dispatch fake synthetic click event
    const syntheticEvent = new MouseEvent('click', {
      bubbles: true,
      cancelable: true,
      view: window
    });
    btnAntiBot.dispatchEvent(syntheticEvent);
  });

  /**
   * Test 2: Target Zone
   */
  targetZone.addEventListener('click', (e) => {
    targetZoneCoords.textContent = `Clicked at (${e.clientX}, ${e.clientY}) [isTrusted: ${e.isTrusted}]`;
  });

  btnClickTargetViaExt.addEventListener('click', async () => {
    if (typeof window.sendTrustedClick === 'function') {
      try {
        await window.sendTrustedClick('#targetZone');
      } catch (err) {
        alert('Bridge call failed: ' + err.message);
      }
    } else {
      alert('Extension page bridge is active when loaded into Chrome. You can also click the extension popup and click "Pick Element & Click"!');
    }
  });

  /**
   * Test 3: Checkbox & Double Click
   */
  testCheckbox.addEventListener('change', (e) => {
    checkboxTrustBadge.className = e.isTrusted
      ? 'text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-900/30 text-emerald-300 border border-emerald-500/30 ml-auto'
      : 'text-[10px] font-mono px-2 py-0.5 rounded bg-red-900/30 text-red-300 border border-red-500/30 ml-auto';
    checkboxTrustBadge.textContent = e.isTrusted ? 'isTrusted: true' : 'isTrusted: false';
  });

  btnDoubleClick.addEventListener('dblclick', (e) => {
    btnDoubleClick.classList.add('bg-emerald-600', 'text-white');
    btnDoubleClick.textContent = `Double Clicked! (isTrusted: ${e.isTrusted})`;
    setTimeout(() => {
      btnDoubleClick.classList.remove('bg-emerald-600', 'text-white');
      btnDoubleClick.textContent = 'Double Click Me (#btnDoubleClick)';
    }, 1500);
  });

  /**
   * Test 4: File Input Trigger
   */
  btnTriggerFile.addEventListener('click', (e) => {
    if (e.isTrusted) {
      filePickerStatus.className = 'text-[11px] font-mono text-emerald-400 text-center';
      filePickerStatus.textContent = '✅ Trusted click verified: Triggering native file picker...';
      testFileInput.click();
    } else {
      filePickerStatus.className = 'text-[11px] font-mono text-red-400 text-center';
      filePickerStatus.textContent = '❌ Synthetic click rejected: File picker blocked.';
    }
  });

  testFileInput.addEventListener('change', () => {
    if (testFileInput.files && testFileInput.files[0]) {
      filePickerStatus.textContent = `File selected: ${testFileInput.files[0].name}`;
    }
  });

  /**
   * Copy Console Code
   */
  btnCopyConsoleCode.addEventListener('click', () => {
    navigator.clipboard.writeText("await window.sendTrustedClick('#btnAntiBot');");
    btnCopyConsoleCode.textContent = 'Copied!';
    setTimeout(() => {
      btnCopyConsoleCode.textContent = 'Copy';
    }, 1500);
  });
});
