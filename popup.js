// --- Get ALL our new controls ---
const pdfControls = document.getElementById('pdf-controls');
const htmlControls = document.getElementById('html-controls');
const convertPdfBtn = document.getElementById('convert-pdf-btn');

const cleanViewBtn = document.getElementById('clean-view-btn');
const fontToggleBtn = document.getElementById('font-toggle-btn');
const lineHeightSlider = document.getElementById('line-height-slider');
const letterSpacingSlider = document.getElementById('letter-spacing-slider');

// --- This is our "main" function. It runs as soon as the popup opens ---
document.addEventListener('DOMContentLoaded', () => {
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    const currentTab = tabs[0];
    const url = currentTab.url;

    if (url.endsWith('.pdf')) {
      pdfControls.classList.remove('hidden');
      htmlControls.classList.add('hidden');
    } else {
      pdfControls.classList.add('hidden');
      htmlControls.classList.remove('hidden');
    }
  });
});


// --- PDF CONVERSION LOGIC (NEW v2.2 "JIT Edition") ---
convertPdfBtn.addEventListener('click', () => {
  convertPdfBtn.textContent = 'Loading PDF...';
  convertPdfBtn.disabled = true;

  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    const currentTab = tabs[0];
    // Step 1: Inject pdf.js
    chrome.scripting.executeScript({
      target: { tabId: currentTab.id },
      files: ['pdf.js']
    }, () => {
      // Step 2: Inject our new 'Just-In-Time' parser
      chrome.scripting.executeScript({
        target: { tabId: currentTab.id },
        function: initializePdfViewer, // This is our new main function
        args: [
          chrome.runtime.getURL('pdf.worker.mjs'),
          chrome.runtime.getURL('viewer.css')
        ]
      });
    });
  });
});

// This function loads the PDF and builds the "viewer" shell
async function initializePdfViewer(workerUrl, cssUrl) {
  // 1. Setup PDF.js and load the document
  pdfjsLib.GlobalWorkerOptions.workerSrc = workerUrl;
  const loadingTask = pdfjsLib.getDocument(window.location.href);
  const pdf = await loadingTask.promise;

  // 2. Create the HTML for our new "Viewer"
  const newHtml = `
    <html>
    <head>
      <title>EchoRead - ${pdf.numPages} Page PDF</title>
      <link rel="stylesheet" href="${cssUrl}">
      <style>
        body { background: #f5f5f5; padding-top: 80px; font-family: sans-serif; }
        #page-container {
          background: white;
          margin: 20px auto;
          max-width: 800px;
          min-height: 80vh; /* Make sure it's tall */
          box-shadow: 0 0 10px rgba(0,0,0,0.1);
          padding: 40px;
        }
        .textLayer { line-height: 1.6; font-size: 18px; }
        
        /* Navigation Bar */
        #nav-bar {
          position: fixed; top: 0; left: 0;
          width: 100%;
          background: #333;
          color: white;
          display: flex;
          justify-content: center;
          align-items: center;
          padding: 10px;
          z-index: 9999;
          box-shadow: 0 2px 5px rgba(0,0,0,0.3);
        }
        #nav-bar button {
          font-size: 16px;
          padding: 8px 16px;
          margin: 0 10px;
          cursor: pointer;
        }
        #nav-bar button:disabled { background: #777; cursor: not-allowed; }
        #page-num { font-size: 18px; font-weight: bold; }
      </style>
    </head>
    <body>
      <div id="nav-bar">
        <button id="prev-btn">Previous</button>
        <span id="page-num">Loading...</span>
        <button id="next-btn">Next</button>
      </div>
      
      <div id="page-container">
        <div id="text-content-layer" class="textLayer">
          <h1>Loading Page 1...</h1>
        </div>
      </div>
      
      <script>
        // Global variables for this new page
        let pdfDoc = null;
        let currentPageNum = 1;
        let totalPages = ${pdf.numPages};
        
        // Get our new UI elements
        const pageNumDisplay = document.getElementById('page-num');
        const textContentLayer = document.getElementById('text-content-layer');
        const prevBtn = document.getElementById('prev-btn');
        const nextBtn = document.getElementById('next-btn');
        
        // This is our core "Just-In-Time" function
        async function renderPage(num) {
          try {
            // Get the page
            const page = await pdfDoc.getPage(num);
            const textContent = await page.getTextContent();
            
            // Build the HTML for the page
            let pageText = "";
            for (const item of textContent.items) {
              pageText += item.str + " ";
              if (item.hasEOL) { pageText += "<br>"; }
            }
            
            // Render it to the screen
            textContentLayer.innerHTML = pageText;
            
            // Update UI
            currentPageNum = num;
            pageNumDisplay.textContent = \`Page \${currentPageNum} / \${totalPages}\`;
            
            // Enable/disable buttons
            prevBtn.disabled = (currentPageNum <= 1);
            nextBtn.disabled = (currentPageNum >= totalPages);
            
            // Scroll to top
            window.scrollTo(0, 0);
            
          } catch (err) {
            console.error('Error rendering page:', err);
            textContentLayer.innerHTML = \`<h2>Error loading page \${num}</h2><p>\${err.message}</p>\`;
          }
        }
        
        // Add button event listeners
        prevBtn.addEventListener('click', () => {
          if (currentPageNum > 1) {
            renderPage(currentPageNum - 1);
          }
        });
        
        nextBtn.addEventListener('click', () => {
          if (currentPageNum < totalPages) {
            renderPage(currentPageNum + 1);
          }
        });
        
        // KICK IT OFF: Store the loaded PDF and render Page 1
        pdfDoc = pdfjsLib.getDocument(window.location.href).promise;
        
        // This is a bit tricky: 'pdf' in the outer scope
        // is not the same as 'pdfDoc' here. We need to
        // get the document *again* inside this new page.
        // Let's optimize this.
        
        // --- OPTIMIZATION ---
        // Storing the 'pdf' object is hard. Let's just
        // store the URL and re-load the library.
        
        (async function() {
          try {
            // Load the PDF library *inside* the new page
            const script = document.createElement('script');
            script.src = "${chrome.runtime.getURL('pdf.js')}";
            document.head.appendChild(script);
            
            script.onload = async () => {
              // Now that pdf.js is loaded, set up the worker
              pdfjsLib.GlobalWorkerOptions.workerSrc = "${chrome.runtime.getURL('pdf.worker.mjs')}";
              
              // Load the document
              const loadingTask = pdfjsLib.getDocument(window.location.href);
              pdfDoc = await loadingTask.promise; // Assign to our global var
              
              // Now, render the first page
              renderPage(1);
            }
          } catch (err) {
            console.error('Failed to load PDF lib:', err);
          }
        })();
        
      </script>
    </body>
    </html>
  `;

  // 3. Replace the page with our new viewer
  document.open();
  document.write(newHtml);
  document.close();
}


// --- ALL OUR OLD HTML-PAGE FUNCTIONS (No changes) ---
// (These are 100% the same as before, for HTML pages)

// --- 1. "Clean View" Button ---
cleanViewBtn.addEventListener('click', () => {
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    const currentTab = tabs[0];
    chrome.scripting.executeScript({ target: { tabId: currentTab.id }, files: ['Readability.js'] }, () => {
      chrome.scripting.executeScript({
        target: { tabId: currentTab.id },
        function: parseArticleWithReadability,
        args: [currentTab.url]
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
        <html>
        <head>
          <title>${article.title}</title>
          <base href="${pageUrl}">
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; background: #f5f5f5; color: #1a1a1a; padding: 2% 10%; margin: 0; font-size: 20px; line-height: 1.6; max-width: 800px; margin: 0 auto; }
            h1, h2, h3 { line-height: 1.2; } img, video, figure { max-width: 100%; height: auto; } a { color: #007bff; text-decoration: none; } a:hover { text-decoration: underline; }
          </style>
        </head>
        <body>
          <h1>${article.title}</h1>
          ${article.content}
        </body>
        </html>
      `;
      document.open();
      document.write(newHtml);
      document.close();
    } else {
      alert("Sorry, EchoRead couldn't find an article on this page.");
    }
  }, 1000);
}

// --- 2. Font Toggle Button ---
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

// --- 3. Spacing Sliders ---
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
