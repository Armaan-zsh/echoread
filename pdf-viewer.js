// --- JIT + HYBRID OCR SCRIPT (v10.0 - The "Streaming" Fix) ---

import * as pdfjsLib from './pdf.js'; 

const tesseractPromise = new Promise((resolve, reject) => {
  const script = document.createElement('script');
  script.src = chrome.runtime.getURL('tesseract.min.js');
  script.onload = () => resolve(window.Tesseract);
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
let pdfUrl = urlParams.get('url');
if (pdfUrl) { pdfUrl = decodeURIComponent(pdfUrl); } // <-- This is our v9.1 fix

// --- STEP 3: DEFINE FUNCTIONS ---

// This is the new "Streaming" function for local files
async function loadLocalPdfWithStreaming(fileUrl) {
  ocrStatus.textContent = "Fetching local file...";
  
  // 1. Fetch the local file
  const response = await fetch(fileUrl);
  const total = parseInt(response.headers.get('content-length'), 10);
  const reader = response.body.getReader();
  
  // 2. Get just the first 64KB (enough for Page 1)
  ocrStatus.textContent = "Sipping first chunk (64KB)...";
  const { value: firstChunk } = await reader.read();
  const initialData = new Uint8Array(firstChunk);
  
  // 3. Create a "streaming" transport for PDF.js
  const transport = new pdfjsLib.PDFDataRangeTransport(total, initialData);
  
  // 4. Background: Continue loading the rest in chunks
  (async () => {
    let loaded = initialData.length;
    
    while (true) {
      const { done, value } = await reader.read();
      if (done) {
        transport.onDataRangeLoad(loaded, total);
        break;
      }
      
      const chunk = new Uint8Array(value);
      transport.onDataRange(loaded, chunk);
      loaded += chunk.length;
      
      // Optional: Update progress
      ocrStatus.textContent = `Loading PDF in background... (${Math.round(loaded/total*100)}%)`;
    }
  })();
  
  // 5. Tell PDF.js to load using our "stream"
  // This promise will resolve instantly
  return pdfjsLib.getDocument({
    range: transport,
    url: null 
  }).promise;
}

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

// THIS IS THE NEW MAIN FUNCTION
async function initializePdfViewer() {
  try {
    ocrStatus.textContent = "Loading PDF document...";
    pdfjsLib.GlobalWorkerOptions.workerSrc = chrome.runtime.getURL('pdf.worker.js');

    // --- THIS IS THE FIX ---
    if (pdfUrl.startsWith('file://')) {
      // It's a local file. Use the "Streaming" engine.
      ocrStatus.textContent = "Optimizing local PDF for fast loading...";
      pdfDoc = await loadLocalPdfWithStreaming(pdfUrl);
    } else {
      // It's a web file. Load it normally.
      const loadingTask = pdfjsLib.getDocument(pdfUrl);
      pdfDoc = await loadingTask.promise;
    }
    // --- END FIX ---

    totalPages = pdfDoc.numPages;
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
    
    const Tesseract = await tesseractPromise;

    tesseractWorker = await Tesseract.createWorker({
      workerPath: chrome.runtime.getURL('tesseract.min.js'),
      langPath: '',
      corePath: chrome.runtime.getURL('tesseract-core.wasm.js'),
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
      
      if (!ocrInitialized) {
        await initializeOcr();
      }
      
      await performOcr(num);

    } else { // It's a DIGITAL PDF
      textContentLayer.innerHTML = pageText;
      textContentLayer.style.display = 'block';
      // We check if the background load is still happening
      if (pdfDoc.transport && !pdfDoc.transport.done) {
         ocrStatus.textContent = `Page ${num} loaded (Digital) - Background load in progress...`;
      } else {
         ocrStatus.textContent = `Page ${num} loaded (Digital).`;
      }
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
