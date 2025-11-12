//
//  pdf-viewer.js
//  This is our "Beast Mode" Hybrid Engine.
//  It is loaded by 'loader.js'
//

// This code runs AFTER loader.js has loaded all libraries.
// pdfjsLib and Tesseract are now global.

let pdfDoc = null;
let currentPageNum = 1;
let totalPages = 0;
let tesseractWorker = null;
let ocrInitialized = false;
let pendingOcrPage = null;

// We have to get the UI elements *after* we create them
let pageNumDisplay, textContentLayer, ocrStatus, prevBtn, nextBtn, canvas, ctx;

const urlParams = new URLSearchParams(window.location.search);
const pdfUrl = urlParams.get('url');

// --- DEFINE FUNCTIONS ---

async function performOcr(pageNum) {
  try {
    ocrStatus.textContent = `Running OCR on page ${pageNum}...`;
    const { data: { text } } = await tesseractWorker.recognize(canvas);
    
    textContentLayer.innerHTML = text.replace(/\n/g, '<br>');
    canvas.style.display = 'none'; 
    textContentLayer.style.display = 'block';
    ocrStatus.textContent = `Page ${pageNum} loaded (from Scan).`;
    pendingOcrPage = null;
  } catch (err) {
    console.error('OCR failed:', err);
    ocrStatus.textContent = `OCR error on page ${pageNum}: ${err.message}. Showing image.`;
  }
}

async function initializeOcr() {
  try {
    ocrStatus.textContent = "Loading OCR engine in background...";
    
    // Tesseract is now on the window
    tesseractWorker = await Tesseract.createWorker({
      workerPath: chrome.runtime.getURL('tesseract.min.js'),
      langPath: '',
      corePath: 'https://cdn.jsdelivr.net/npm/tesseract.js-core@5.0.0/tesseract-core.wasm.js',
    });
    await tesseractWorker.loadLanguage(chrome.runtime.getURL('eng.traineddata'));
    await tesseractWorker.initialize('eng');
    ocrInitialized = true;
    ocrStatus.textContent = "OCR engine ready.";
    
    if (pendingOcrPage) {
      await performOcr(pendingOcrPage);
    }
  } catch (err) {
    console.error("OCR Engine failed to load:", err);
    ocrStatus.textContent = "OCR engine failed to load. Scanned PDFs will show as images.";
    ocrInitialized = false;
  }
}

async function renderPage(num) {
  try {
    textContentLayer.innerHTML = "";
    textContentLayer.style.display = 'none';
    canvas.style.display = 'none';
    ocrStatus.textContent = `Loading page ${num}...`;
    prevBtn.disabled = true;
    nextBtn.disabled = true;

    const page = await pdfDoc.getPage(num);
    
    const textContent = await page.getTextContent();
    let pageText = "";
    if (textContent && textContent.items.length > 0) {
      for (const item of textContent.items) {
        pageText += item.str + " ";
        if (item.hasEOL) { pageText += "<br>"; }
      }
    }

    if (pageText.trim().length < 50) {
      ocrStatus.textContent = `Digital text not found. Preparing scan...`;
      
      const viewport = page.getViewport({ scale: 1.5 });
      canvas.height = viewport.height;
      canvas.width = viewport.width;
      await page.render({ canvasContext: ctx, viewport: viewport }).promise;
      
      canvas.style.display = 'block';
      ocrStatus.textContent = `Image loaded. OCR in progress...`;
      
      if (ocrInitialized) {
        await performOcr(num);
      } else {
        pendingOcrPage = num;
        ocrStatus.textContent = `Image loaded. OCR engine warming up... (first time only)`;
      }
    } else {
      textContentLayer.innerHTML = pageText;
      textContentLayer.style.display = 'block';
      ocrStatus.textContent = `Page ${pageNum} loaded (Digital).`;
    }
    
    currentPageNum = num;
    pageNumDisplay.textContent = `Page ${currentPageNum} / ${totalPages}`;
    prevBtn.disabled = (currentPageNum <= 1);
    nextBtn.disabled = (currentPageNum >= totalPages);
    
    window.scrollTo(0, 0);
    
  } catch (err) {
    console.error(`Error rendering page ${num}:`, err);
    ocrStatus.textContent = `Error on page ${num}: ${err.message}`;
  }
}

// --- This is the MAIN function that starts everything ---
async function initializePdfViewer() {
  
  // 1. Build the HTML shell
  // We replace the "Loading..." message with our real UI
  document.body.innerHTML = `
    <div id="nav-bar">
      <button id="prev-btn">Previous</button>
      <span id="page-num">Loading...</span>
      <button id="next-btn">Next</button>
    </div>
    <div id="page-container">
      <div id="ocr-status">Initializing...</div>
      <canvas id="pdf-canvas"></canvas>
      <div id="text-content-layer" class="textLayer"></div>
    </div>
  `;
  
  // 2. Get all the new elements
  pageNumDisplay = document.getElementById('page-num');
  textContentLayer = document.getElementById('text-content-layer');
  ocrStatus = document.getElementById('ocr-status');
  prevBtn = document.getElementById('prev-btn');
  nextBtn = document.getElementById('next-btn');
  canvas = document.getElementById('pdf-canvas');
  ctx = canvas.getContext('2d');

  if (!pdfUrl) {
    ocrStatus.innerHTML = `<h2>Error</h2><p>No PDF URL provided. Please go back.</p>`;
    document.getElementById('nav-bar').style.display = 'none';
    return;
  }

  try {
    // 3. Initialize PDF.js (FAST)
    ocrStatus.textContent = "Loading PDF document...";
    
    // 'pdfjsLib' is NOW GUARANTEED to be defined
    // workerSrc was set by loader.js
    
    // --- THIS IS THE FIX ---
    // We were setting the workerSrc in loader.js, but let's
    // be 100% sure and set it here, pointing to the correct file.
    pdfjsLib.GlobalWorkerOptions.workerSrc = chrome.runtime.getURL('pdf.worker.js');
    // --- END FIX ---
    
    const loadingTask = pdfjsLib.getDocument(pdfUrl);
    pdfDoc = await loadingTask.promise;
    totalPages = pdfDoc.numPages;
    
    // 4. Pre-load the OCR engine in the background (NON-BLOCKING)
    initializeOcr();
    
    // 5. Render the first page (FAST)
    await renderPage(1);
    
    // 6. Add button event listeners
    prevBtn.addEventListener('click', async () => {
      if (currentPageNum > 1) {
        await renderPage(currentPageNum - 1);
      }
    });
    nextBtn.addEventListener('click', async () => {
      if (currentPageNum < totalPages) {
        await renderPage(currentPageNum + 1);
      }
    });

  } catch (err) {
    console.error(err);
    ocrStatus.innerHTML = `<h2>Fatal Error</h2><p>${err.message}</p>`;
  }
}

// --- KICK IT OFF ---
// The 'loader.js' has loaded all libraries. Now, we run our main function.
initializePdfViewer();
