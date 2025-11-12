// --- JIT + HYBRID OCR SCRIPT (v6.0 - ES Module Fix) ---

// --- STEP 1: IMPORT LIBRARIES ---
// This 'import' statement is guaranteed to run BEFORE any other code.
// The "use_dynamic_url" in manifest.json fixes the MIME type error.
import * as pdfjsLib from './pdf.mjs'; 

// Tesseract is not an ES module, so we must load it manually.
// We'll create a "promise" for it.
const tesseractPromise = new Promise((resolve, reject) => {
  const script = document.createElement('script');
  script.src = chrome.runtime.getURL('tesseract.min.js');
  script.onload = () => resolve(window.Tesseract); // It attaches to 'window'
  script.onerror = reject;
  document.head.appendChild(script);
});

// --- STEP 2: GET UI ELEMENTS ---
let pdfDoc = null;
let currentPageNum = 1;
let totalPages = 0;
let tesseractWorker = null;
let ocrInitialized = false;
let pendingOcrPage = null;

const pageNumDisplay = document.getElementById('page-num');
const textContentLayer = document.getElementById('text-content-layer');
const ocrStatus = document.getElementById('ocr-status');
const prevBtn = document.getElementById('prev-btn');
const nextBtn = document.getElementById('next-btn');
const canvas = document.getElementById('pdf-canvas');
const ctx = canvas.getContext('2d');

const urlParams = new URLSearchParams(window.location.search);
const pdfUrl = urlParams.get('url');

// --- STEP 3: DEFINE FUNCTIONS ---

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

async function initializePdfViewer() {
  try {
    ocrStatus.textContent = "Loading PDF document...";
    
    // 'pdfjsLib' is NOW DEFINED because of the 'import' at the top.
    pdfjsLib.GlobalWorkerOptions.workerSrc = chrome.runtime.getURL('pdf.worker.mjs');
    const loadingTask = pdfjsLib.getDocument(pdfUrl);
    pdfDoc = await loadingTask.promise;
    totalPages = pdfDoc.numPages;

    // This is the "lazy load" logic from v6.0
    // We do NOT load OCR until it's needed.
    
    await renderPage(1); // Render first page
    
  } catch (err) {
    console.error(err);
    ocrStatus.innerHTML = `<h2>Fatal Error loading PDF</h2><p>${err.message}</p>`;
  }
}

async function initializeOcr() {
  // This is now "on-demand"
  try {
    ocrStatus.textContent = "First-time setup: Loading 9MB OCR engine...";
    
    // We wait for the Tesseract script to finish loading
    const Tesseract = await tesseractPromise;

    tesseractWorker = await Tesseract.createWorker({
      workerPath: chrome.runtime.getURL('tesseract.min.js'),
      langPath: '',
      corePath: 'httpsS://cdn.jsdelivr.net/npm/tesseract.js-core@5.0.0/tesseract-core.wasm.js',
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

    // --- "Lazy Load" Logic ---
    if (pageText.trim().length < 50) { // It's a SCANNED PDF
      ocrStatus.textContent = `Digital text not found. Preparing scan...`;
      
      const viewport = page.getViewport({ scale: 1.5 });
      canvas.height = viewport.height;
      canvas.width = viewport.width;
      await page.render({ canvasContext: ctx, viewport: viewport }).promise;
      
      canvas.style.display = 'block';
      ocrStatus.textContent = `Image loaded. OCR in progress...`;
      
      // "ON-DEMAND" LOAD:
      if (!ocrInitialized) {
        await initializeOcr(); // This is the "slow" part, happens ONCE
      }
      
      await performOcr(num);

    } else { // It's a DIGITAL PDF
      textContentLayer.innerHTML = pageText;
      textContentLayer.style.display = 'block';
      ocrStatus.textContent = `Page ${num} loaded (Digital).`;
    }
    // --- End "Lazy Load" Logic ---
    
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

// --- STEP 4: ADD EVENT LISTENERS & START ---
prevBtn.addEventListener('click', () => { if (currentPageNum > 1) renderPage(currentPageNum - 1); });
nextBtn.addEventListener('click', () => { if (currentPageNum < totalPages) renderPage(currentPageNum + 1); });

// Start the app if we have a URL
if (pdfUrl) {
  initializePdfViewer();
} else {
  ocrStatus.innerHTML = `<h2>Error</h2><p>No PDF URL provided. Please go back.</p>`;
  document.getElementById('nav-bar').style.display = 'none';
}
