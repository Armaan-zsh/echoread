// --- Get all our buttons and sliders ---
const cleanViewBtn = document.getElementById('clean-view-btn');
const fontToggleBtn = document.getElementById('font-toggle-btn');
const lineHeightSlider = document.getElementById('line-height-slider');
const letterSpacingSlider = document.getElementById('letter-spacing-slider');

// --- 1. "Clean View" Button (NEW v1.3) ---
cleanViewBtn.addEventListener('click', () => {
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    const currentTab = tabs[0];
    
    // Step 1: Inject the Readability.js library
    chrome.scripting.executeScript({
      target: { tabId: currentTab.id },
      files: ['Readability.js']
    }, () => {
      // Step 2: After, run our NEW "scroll and parse" function
      chrome.scripting.executeScript({
        target: { tabId: currentTab.id },
        function: scrollAndParse,
        args: [currentTab.url]
      });
    });
  });
});

// THIS IS OUR NEW, SMARTER FUNCTION
function scrollAndParse(pageUrl) {
  // 1. Scroll to the very bottom to trigger lazy-loading
  window.scrollTo(0, document.body.scrollHeight);

  // 2. Wait 1 second for the new content to load
  setTimeout(() => {
    // 3. Now, clone the document and run Readability
    const documentClone = document.cloneNode(true);
    const article = new Readability(documentClone, {
      charThreshold: 500, // Find content with at least 500 characters
      pageUrl: pageUrl  // Pass the URL to help find links/images
    }).parse();

    if (article && article.content) {
      // 4. (FIX FOR IMAGES) Create a new, full HTML document in a string
      const newHtml = `
        <html>
        <head>
          <title>${article.title}</title>
          <base href="${pageUrl}">
          <style>
            body {
              font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
              background: #f5f5f5;
              color: #1a1a1a;
              padding: 2% 10%;
              margin: 0;
              font-size: 20px;
              line-height: 1.6;
              max-width: 800px;
              margin: 0 auto;
            }
            h1, h2, h3 { line-height: 1.2; }
            /* This makes sure images and videos don't overflow */
            img, video, figure { max-width: 100%; height: auto; }
            a { color: #007bff; text-decoration: none; }
            a:hover { text-decoration: underline; }
          </style>
        </head>
        <body>
          <h1>${article.title}</h1>
          ${article.content}
        </body>
        </html>
      `;
      
      // 5. Replace the entire page with our new clean HTML
      // This is more powerful than just changing the body
      document.open();
      document.write(newHtml);
      document.close();

    } else {
      alert("Sorry, EchoRead couldn't find an article on this page.");
    }
  }, 1000); // 1-second (1000ms) delay
}


// --- 2. Font Toggle Button (Code is fine from v1.2) ---
fontToggleBtn.addEventListener('click', () => {
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

// --- 3. Spacing Sliders (Code is fine from v1.2) ---
lineHeightSlider.addEventListener('input', (e) => {
  const newHeight = e.target.value;
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
