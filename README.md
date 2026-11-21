# 🎯 Trusted Click Debugger - Chrome Extension

A Chrome Extension (Manifest V3) that utilizes the **Chrome Debugger API** and **Chrome DevTools Protocol (CDP)** to dispatch genuine, browser-level mouse clicks where **`event.isTrusted === true`**.

---

## ⚡ Why Use the Debugger API for Clicks?

In standard web pages or extensions, executing `element.click()` or `element.dispatchEvent(new MouseEvent('click'))` produces synthetic DOM events where:
```javascript
event.isTrusted === false
```
Modern web applications, anti-bot protections, CAPTCHA widgets, game engines, and restricted native inputs (such as file dialogs) check `event.isTrusted`. When `isTrusted` is `false`, they detect synthetic manipulation and reject the action.

By attaching via `chrome.debugger` and calling CDP's `Input.dispatchMouseEvent`, Chromium's browser and compositor treat the input identically to physical hardware mouse clicks, producing genuine events where:
```javascript
event.isTrusted === true
```

---

## ✨ Key Features

1. **🎯 Interactive Visual Element Picker**:
   - Click "Pick Element & Click" in the extension popup.
   - Hover over any element on the page to highlight it.
   - Click to dispatch an `isTrusted` click directly to its center. Press `Esc` to cancel.
2. **🔍 CSS Selector Dispatch**:
   - Enter any selector (e.g. `#submit-btn`, `.checkout-btn`, `input[type="checkbox"]`).
   - Automatically scrolls the element into view, computes its viewport coordinates, and dispatches the trusted click.
3. **📍 Viewport Coordinate Dispatch (X, Y)**:
   - Provide exact viewport pixel coordinates to click any arbitrary screen location.
4. **💻 DevTools Console & Web Page API**:
   - Access `window.sendTrustedClick` directly in the page console or scripts:
     ```javascript
     // By CSS selector
     await window.sendTrustedClick('#my-button');

     // By DOM element
     await window.sendTrustedClick(document.querySelector('.submit-btn'));

     // By coordinates (X, Y)
     await window.sendTrustedClick(350, 420);

     // With custom options
     await window.sendTrustedClick('#menu', { button: 'right', delay: 80 });
     ```
5. **⚙️ Click Customization**:
   - **Mouse Buttons**: Left, Right, Middle.
   - **Click Count**: Single click or Double click.
   - **Hold Delay**: Adjustable dwell time between `mousePressed` and `mouseReleased` (default: 60ms).
   - **Auto-detach**: Option to automatically detach the debugger after dispatching the click to dismiss the Chrome debugging banner.
6. **🧪 Built-in Verification Playground (`test.html`)**:
   - Includes an interactive test lab with anti-bot simulator, live event stream table, coordinate target zone, and file upload trigger.

---

## 📦 How to Install in Google Chrome

1. Open Google Chrome.
2. Navigate to `chrome://extensions/` in your address bar.
3. Enable **Developer mode** using the toggle switch in the top right corner.
4. Click the **Load unpacked** button in the top left.
5. Select this project directory:
   ```
   /Users/edward/Documents/projects/debugger-extension
   ```
6. The **Trusted Click Debugger** icon will appear in your Chrome toolbar!

---

## 🧪 Testing and Verifying `isTrusted`

1. Click the extension icon in your Chrome toolbar.
2. Click **🧪 Open Test Playground** in the popup footer (or open `chrome-extension://<EXTENSION_ID>/test.html`).
3. In the playground:
   - Click **Trigger Fake JS Click** (`element.click()`): Notice the status turns RED: ❌ `isTrusted: false (Synthetic Event Detected)`.
   - Click the extension icon, enter `#btnAntiBot` and click **Click**: Notice the status turns GREEN: ✅ `isTrusted: true (Native Click Verified)`.
   - Check the **Live Mouse Event Stream** table at the bottom to inspect `event.type`, `isTrusted`, `clientX`, `clientY`, and `button` in real time.

---

## 🏗️ Architecture & CDP Details

### Manifest V3 Components
- **`manifest.json`**: MV3 configuration with `"debugger"`, `"activeTab"`, `"tabs"`, `"scripting"` permissions.
- **`background.js`**: Background service worker managing `chrome.debugger` attachment state, detachment lifecycle, and CDP command sequences:
  1. `Input.dispatchMouseEvent` with `type: "mouseMoved"`
  2. `Input.dispatchMouseEvent` with `type: "mousePressed"` (`button`, `buttons`, `clickCount`)
  3. Hold delay timer (configurable dwell time)
  4. `Input.dispatchMouseEvent` with `type: "mouseReleased"` (`buttons: 0`)
- **`content.js`**: Injected into web pages to coordinate the interactive visual picker, calculate bounding client rects, and bridge page requests.
- **`page-bridge.js`**: Runs in the `MAIN` world to expose `window.sendTrustedClick` to the developer console and page scripts.
- **`popup.html` & `popup.js`**: Modern, responsive developer UI styled with Tailwind CSS (zero inline styles).
- **`test.html` & `test.js`**: Comprehensive test laboratory for verifying trusted event dispatch.

---

## ⚠️ Notes & Chrome Limitations

- **Chrome Debugging Banner**: Whenever `chrome.debugger` attaches to a tab, Chrome displays an infobar at the top stating *"`Trusted Click Debugger started debugging this browser`"*. This is a mandatory Chrome security feature. You can enable **Auto-detach after click** in the options to automatically dismiss this banner immediately after dispatching.
- **DevTools Conflict**: Chrome permits only one active debugger per tab. If you have Chrome DevTools (F12) docked and inspecting the target tab, close DevTools or undock it before attaching the extension debugger.
- **Internal Pages**: Chrome prohibits debugger attachment on internal pages like `chrome://`, `chrome-extension://`, or the Chrome Web Store.
