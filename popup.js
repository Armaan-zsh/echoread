// --- Get ALL our new controls ---
const pdfControls = document.getElementById('pdf-controls');
const htmlControls = document.getElementById('html-controls');
const statusMessage = document.getElementById('status-message');
const convertPdfBtn = document.getElementById('convert-pdf-btn');

const cleanViewBtn = document.getElementById('clean-view-btn');
const fontToggleBtn = document.getElementById('font-toggle-btn');
const lineHeightSlider = document.getElementById('line-height-slider');
const letterSpacingSlider = document.getElementById('letter-spacing-slider');

// --- Helper function to set the status message ---
function setStatus(message) {
  htmlControls.style.display = 'none';
  pdfControls.style.display = 'none';
  statusMessage.style.display = 'block';
  statusMessage.innerHTML = `<p>${message}</p>`;
}

// --- Main "main" function ---
document.addEventListener('DOMContentLoaded', () => {
  setStatus("Checking page...");

  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    if (!tabs[0] || !tabs[0].url) {
      setStatus("Cannot access this tab.");
      return;
    }
    const url = tabs[0].url;

    // Check if it's a browser-handled PDF
    const isBrowserPdf = url.startsWith('file://') && url.endsWith('.pdf');
    const isOurPdfViewer = url.startsWith(chrome.runtime.getURL('pdf-viewer.html'));

    if (isOurPdfViewer) {
        setStatus("You are already in EchoRead PDF Viewer!");
        return; // Don't show convert button if already in our viewer
    }

    chrome.scripting.executeScript({
      target: { tabId: tabs[0].id },
      function: () => true
    }, (results) => {
      if (chrome.runtime.lastError || !results || results.length === 0) {
        setStatus("EchoRead cannot run on this protected page.");
      } else if (isBrowserPdf || url.endsWith('.pdf')) { // If it's *any* PDF
        pdfControls.style.display = 'block';
        htmlControls.style.display = 'none';
        statusMessage.style.display = 'none';
      } else {
        htmlControls.style.display = 'block';
        pdfControls.style.display = 'none';
        statusMessage.style.display = 'none';
      }
    });
  });
});


// --- PDF CONVERSION BUTTON (Now redirects to our viewer) ---
convertPdfBtn.addEventListener('click', () => {
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    const currentTab = tabs[0];
    const pdfUrl = currentTab.url;
    
    // Redirect to our dedicated PDF viewer HTML page
    const viewerUrl = chrome.runtime.getURL(`pdf-viewer.html?url=${encodeURIComponent(pdfUrl)}`);
    chrome.tabs.update(currentTab.id, { url: viewerUrl });
  });
});


// --- ALL OUR OLD HTML-PAGE FUNCTIONS (No changes) ---
// (These are for blogs and normal sites)

cleanViewBtn.addEventListener('click', () => {
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    chrome.scripting.executeScript({ target: { tabId: tabs[0].id }, files: ['readability.js'] }, () => {
      if (chrome.runtime.lastError) return;
      chrome.scripting.executeScript({
        target: { tabId: tabs[0].id },
        function: parseArticleWithReadability,
        args: [tabs[0].url]
      });
    });
  });
});

function parseArticleWithReadability(pageUrl) {
  window.scrollTo(0, document.body.scrollHeight);
  setTimeout(() => {
    const documentClone = document.cloneNode(true);
    const article = new Readability(documentClone, { charThreshold: 500, pageUrl: pageUrl }).parse();
    if (article && article.content) {
      const newHtml = `
        <html><head><title>${article.title}</title><base href="${pageUrl}">
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; background: #f5f5f5; color: #1a1a1a; padding: 2% 10%; margin: 0; font-size: 20px; line-height: 1.6; max-width: 800px; margin: 0 auto; }
          h1, h2, h3 { line-height: 1.2; } img, video, figure { max-width: 100%; height: auto; } a { color: #007bff; text-decoration: none; } a:hover { text-decoration: underline; }
        </style></head>
        <body><h1>${article.title}</h1>${article.content}</body></html>
      `;
      document.open();
      document.write(newHtml);
      document.close();
    } else {
      alert("Sorry, EchoRead couldn't find an article on this page.");
    }
  }, 1000);
}

fontToggleBtn.addEventListener('click', () => {
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    chrome.scripting.executeScript({ target: { tabId: tabs[0].id }, function: toggleDyslexicFont });
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
      @font-face { font-family: '${FONT_NAME}'; src: url('${FONT_URL}'); }
      * { font-family: '${FONT_NAME}', sans-serif !important; }
    `;
    const styleEl = document.createElement('style');
    styleEl.id = STYLE_ID;
    styleEl.textContent = css;
    document.head.appendChild(styleEl);
  }
}

lineHeightSlider.addEventListener('input', (e) => {
  const newHeight = e.target.value;
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    chrome.scripting.executeScript({
      target: { tabId: tabs[0].id },
      function: (height) => {
        const STYLE_ID = 'echoread-line-height-style';
        let styleEl = document.getElementById(STYLE_ID);
        if (!styleEl) { styleEl = document.createElement('style'); styleEl.id = STYLE_ID; document.head.appendChild(styleEl); }
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
        if (!styleEl) { styleEl = document.createElement('style'); styleEl.id = STYLE_ID; document.head.appendChild(styleEl); }
        styleEl.textContent = `* { letter-spacing: ${spacing}px !important; }`;
      },
      args: [newSpacing]
    });
  });
});
