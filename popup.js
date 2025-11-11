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
  // Find out what page we're on
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    const currentTab = tabs[0];
    const url = currentTab.url;

    if (url.endsWith('.pdf')) {
      // If it's a PDF, show PDF controls
      pdfControls.classList.remove('hidden');
      htmlControls.classList.add('hidden');
    } else {
      // If it's HTML, show HTML controls
      pdfControls.classList.add('hidden');
      htmlControls.classList.remove('hidden');
    }
  });
});


// --- PDF CONVERSION LOGIC ---
convertPdfBtn.addEventListener('click', () => {
  convertPdfBtn.textContent = 'Converting...';
  convertPdfBtn.disabled = true;

  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    const currentTab = tabs[0];
    
    // Inject the pdf.js libraries
    chrome.scripting.executeScript({
      target: { tabId: currentTab.id },
      files: ['pdf.js']
    }, () => {
      // After pdf.js is in, inject our conversion code
      chrome.scripting.executeScript({
        target: { tabId: currentTab.id },
        function: parsePdf,
        args: [
          chrome.runtime.getURL('pdf.worker.mjs'), // Pass the worker URL
          chrome.runtime.getURL('viewer.css')      // Pass the CSS URL
        ]
      });
    });
  });
});

// This is the function that will run ON THE PAGE to convert the PDF
async function parsePdf(workerUrl, cssUrl) {
  // 1. Tell pdf.js where to find its "worker" file
  pdfjsLib.GlobalWorkerOptions.workerSrc = workerUrl;

  // 2. Get the PDF document from the current URL
  const loadingTask = pdfjsLib.getDocument(window.location.href);
  const pdf = await loadingTask.promise;

  // 3. Create a new, blank HTML document
  let newHtml = `
    <html>
    <head>
      <title>${pdf.numPages} Page PDF</title>
      <link rel="stylesheet" href="${cssUrl}">
      <style>
        body { background: #f5f5f5; padding: 20px; }
        .page { background: white; margin: 20px auto; max-width: 800px; box-shadow: 0 0 10px rgba(0,0,0,0.1); }
        .textLayer { line-height: 1.6; }
      </style>
    </head>
    <body>
      <h1>PDF Conversion (Total ${pdf.numPages} pages)</h1>
  `;

  // 4. Loop through every page of the PDF
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const textContent = await page.getTextContent();
    
    // Add a "page" container
    newHtml += `<div class="page" id="page-${i}">`;
    
    // Use pdf.js to render the text with correct positions
    // This is complex, so let's do a simpler text extraction
    
    let pageText = "";
    for (const item of textContent.items) {
      pageText += item.str + " ";
      if (item.hasEOL) { pageText += "<br>"; }
    }
    
    // A simpler way: just dump the text, line by line
    newHtml += `<div class="textLayer">${pageText}</div>`;
    newHtml += `</div>`;
  }

  // 5. Close the HTML and replace the page
  newHtml += `</body></html>`;
  
  document.open();
  document.write(newHtml);
  document.close();
}


// --- ALL OUR OLD HTML-PAGE FUNCTIONS (No changes) ---

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
      const newHtml = `... (Same as v1.3) ...`; // Full code omitted for brevity
      document.open();
      document.write(newHtml);
      document.close();
    } else {
      alert("Sorry, EchoRead couldn't find an article on this page.");
    }
  }, 1000);
}
// (This function needs to be complete, let me paste it)
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
