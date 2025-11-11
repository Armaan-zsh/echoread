// --- JIT + HYBRID OCR SCRIPT (Embedded in new page) ---
let pdfDoc = null;
let currentPageNum = 1;
let totalPages = 0; // Will be set after PDF loads
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

// --- Get the PDF URL from the query string ---
const urlParams = new URLSearchParams(window.location.search);
const pdfUrl = urlParams.get('url');

if (!pdfUrl) {
  ocrStatus.innerHTML = `<h2>Error</h2><p>No PDF URL provided. Please go back.</p>`;
  document.getElementById('nav-bar').style.display = 'none';
} else {
  initializePdfViewer(); // Start the viewer
}


async function performOcr(pageNum) {
  try {
    ocrStatus.textContent = `Running OCR on page ${pageNum}...`;
    const { data: { text } } = await tesseractWorker.recognize(canvas);
    
    textContentLayer.innerHTML = text.replace(/\n/g, '<br>');
    
    canvas.style.display = 'none'; // Hide image preview
    textContentLayer.style.display = 'block'; // Show text
    ocrStatus.textContent = `Page ${pageNum} loaded (from Scan).`;
    pendingOcrPage = null;
  } catch (err) {
    console.error('OCR failed:', err);
    ocrStatus.textContent = `OCR error on page ${pageNum}: ${err.message}. Showing image.`;
  }
}

async function initializePdfViewer() { // Renamed from initializePdf
  try {
    ocrStatus.textContent = "Loading PDF document...";
    
    // Pass worker URL and lang data URL from runtime
    pdfjsLib.GlobalWorkerOptions.workerSrc = chrome.runtime.getURL('pdf.worker.mjs');
    const loadingTask = pdfjsLib.getDocument(pdfUrl); // Use the URL from query string
    pdfDoc = await loadingTask.promise;
    totalPages = pdfDoc.numPages; // Set total pages here

    // Pre-load the OCR engine in the background
    initializeOcr();
    
    // Render the first page (no waiting for OCR)
    await renderPage(1);
    
  } catch (err) {
    console.error(err);
    ocrStatus.innerHTML = `<h2>Fatal Error loading PDF</h2><p>${err.message}</p>`;
  }
}

async function initializeOcr() {
  try {
    ocrStatus.textContent = "Loading OCR engine in background...";
    tesseractWorker = await Tesseract.createWorker({
      workerPath: chrome.runtime.getURL('tesseract.min.js'),
      langPath: '',
      corePath: 'https://cdn.jsdelivr.net/npm/tesseract.js-core@5.0.0/tesseract-core.wasm.js',
    });
    await tesseractWorker.loadLanguage(chrome.runtime.getURL('eng.traineddata')); // Get URL from runtime
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
      ocrStatus.textContent = `Page ${num} loaded (Digital).`;
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

prevBtn.addEventListener('click', () => { if (currentPageNum > 1) renderPage(currentPageNum - 1); });
nextBtn.addEventListener('click', () => { if (currentPageNum < totalPages) renderPage(currentPageNum + 1); });
