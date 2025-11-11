// --- Get all our buttons and sliders ---
const cleanViewBtn = document.getElementById('clean-view-btn');
const fontToggleBtn = document.getElementById('font-toggle-btn');
const lineHeightSlider = document.getElementById('line-height-slider');
const letterSpacingSlider = document.getElementById('letter-spacing-slider');

// --- 1. "Clean View" Button (This code was already correct) ---
cleanViewBtn.addEventListener('click', () => {
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    const currentTab = tabs[0];
    
    // Step 1: Inject the Readability.js library
    chrome.scripting.executeScript({
      target: { tabId: currentTab.id },
      files: ['Readability.js']
    }, () => {
      // Step 2: After, run our parsing function
      chrome.scripting.executeScript({
        target: { tabId: currentTab.id },
        function: parseArticleWithReadability,
        args: [currentTab.url]
      });
    });
  });
});

function parseArticleWithReadability(pageUrl) {
  const documentClone = document.cloneNode(true);
  const article = new Readability(documentClone, {
    charThreshold: 500,
    pageUrl: pageUrl
  }).parse();

  if (article && article.content) {
    const readerView = document.createElement('div');
    readerView.style.cssText = `
      position: fixed; top: 0; left: 0;
      width: 100vw; height: 100vh;
      background: #f4f4f4; color: #333;
      padding: 5% 15%; box-sizing: border-box;
      overflow-y: scroll; z-index: 99999;
      font-size: 20px; line-height: 1.6;
    `;
    readerView.innerHTML = `<h1>${article.title}</h1>${article.content}`;
    document.body.innerHTML = ""; // Clear the body
    document.body.appendChild(readerView);
  } else {
    alert("Sorry, EchoRead couldn't find an article on this page.");
  }
}

// --- 2. Font Toggle Button (FIXED) ---
fontToggleBtn.addEventListener('click', () => {
  // We MUST use the proper async callback, just like in "Clean View"
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    chrome.scripting.executeScript({
      target: { tabId: tabs[0].id },
      function: toggleDyslexicFont
    });
  });
});

function toggleDyslexicFont() {
  const FONT_NAME = 'OpenDyslexic';
  const FONT_URL = chrome.runtime.getURL('OpenDyslexic-Regular.otf');
  const STYLE_ID = 'echoread-font-style-sheet';
  const existingStyleSheet = document.getElementById(STYLE_ID);

  if (existingStyleSheet) {
    existingStyleSheet.remove();
  } else {
    const css = `
      @font-face {
        font-family: '${FONT_NAME}';
        src: url('${FONT_URL}');
      }
      * {
        font-family: '${FONT_NAME}', sans-serif !important;
      }
    `;
    const styleEl = document.createElement('style');
    styleEl.id = STYLE_ID;
    styleEl.textContent = css;
    document.head.appendChild(styleEl);
  }
}

// --- 3. Spacing Sliders (FIXED) ---
lineHeightSlider.addEventListener('input', (e) => {
  const newHeight = e.target.value;
  // We MUST use the proper async callback here too
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    chrome.scripting.executeScript({
      target: { tabId: tabs[0].id },
      function: (height) => {
        const STYLE_ID = 'echoread-line-height-style';
        let styleEl = document.getElementById(STYLE_ID);
        if (!styleEl) {
          styleEl = document.createElement('style');
          styleEl.id = STYLE_ID;
          document.head.appendChild(styleEl);
        }
        styleEl.textContent = `* { line-height: ${height} !important; }`;
      },
      args: [newHeight]
    });
  });
});

letterSpacingSlider.addEventListener('input', (e) => {
  const newSpacing = e.target.value;
  // And the proper async callback here
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    chrome.scripting.executeScript({
      target: { tabId: tabs[0].id },
      function: (spacing) => {
        const STYLE_ID = 'echoread-letter-spacing-style';
        let styleEl = document.getElementById(STYLE_ID);
        if (!styleEl) {
          styleEl = document.createElement('style');
          styleEl.id = STYLE_ID;
          document.head.appendChild(styleEl);
        }
        styleEl.textContent = `* { letter-spacing: ${spacing}px !important; }`;
      },
      args: [newSpacing]
    });
  });
});
