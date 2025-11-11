// --- Get all our buttons and sliders ---
const cleanViewBtn = document.getElementById('clean-view-btn');
const fontToggleBtn = document.getElementById('font-toggle-btn');
const lineHeightSlider = document.getElementById('line-height-slider');
const letterSpacingSlider = document.getElementById('letter-spacing-slider');

// --- Helper function to run code on the page ---
// (We don't need this helper anymore, we'll be more direct)

// --- 1. "Clean View" Button (NEW & IMPROVED) ---
cleanViewBtn.addEventListener('click', () => {
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    const currentTab = tabs[0];
    
    // Step 1: Inject the Readability.js library into the page
    chrome.scripting.executeScript({
      target: { tabId: currentTab.id },
      files: ['Readability.js']
    }, () => {
      // Step 2: After the library is loaded, run our parsing function
      chrome.scripting.executeScript({
        target: { tabId: currentTab.id },
        function: parseArticleWithReadability,
        args: [currentTab.url] // Pass the current URL to Readability
      });
    });
  });
});

function parseArticleWithReadability(pageUrl) {
  // We need to clone the document because Readability modifies it
  const documentClone = document.cloneNode(true);
  
  // We pass the URL so Readability can correctly find relative links
  const article = new Readability(documentClone, {
    charThreshold: 500, // Min content length
    nbTopCandidates: 5,  // How many sections to check
    pageUrl: pageUrl    // Pass the URL
  }).parse();

  if (article && article.content) {
    // Create our clean reader view
    const readerView = document.createElement('div');
    readerView.style.cssText = `
      position: fixed;
      top: 0; left: 0;
      width: 100vw; height: 100vh;
      background: #f4f4f4;
      color: #333;
      padding: 5% 15%;
      box-sizing: border-box; /* Important! */
      overflow-y: scroll;
      z-index: 99999; /* Make sure it's on top */
      font-size: 20px;
      line-height: 1.6;
    `;
    
    // Add the article title and clean content
    readerView.innerHTML = `<h1>${article.title}</h1>${article.content}`;
    
    // Clear the original body and add our new view
    document.body.innerHTML = "";
    document.body.appendChild(readerView);
  } else {
    alert("Sorry, EchoRead couldn't find an article on this page.");
  }
}

// --- 2. Font Toggle Button (NEW & IMPROVED) ---
fontToggleBtn.addEventListener('click', () => {
  chrome.scripting.executeScript({
    target: { tabId: (chrome.tabs.query({ active: true, currentWindow: true }, tabs => tabs[0].id))[0].id }, // A bit of a hack to get tabId
    function: toggleDyslexicFont
  });
});

// This function now uses the "nuclear" stylesheet injection method
function toggleDyslexicFont() {
  const FONT_NAME = 'OpenDyslexic';
  const FONT_URL = chrome.runtime.getURL('OpenDyslexic-Regular.otf');
  const STYLE_ID = 'echoread-font-style-sheet';

  const existingStyleSheet = document.getElementById(STYLE_ID);

  if (existingStyleSheet) {
    // If our stylesheet exists, remove it to toggle off
    existingStyleSheet.remove();
  } else {
    // If it doesn't exist, create it
    
    // This CSS is the "nuclear option"
    // 1. It defines the font face.
    // 2. It uses '*' (universal) and '!important' to force the font onto EVERYTHING.
    const css = `
      @font-face {
        font-family: '${FONT_NAME}';
        src: url('${FONT_URL}');
      }
      
      * {
        font-family: '${FONT_NAME}', sans-serif !important;
      }
    `;

    // Create the <style> tag
    const styleEl = document.createElement('style');
    styleEl.id = STYLE_ID;
    styleEl.textContent = css;
    
    // Add it to the <head> of the page
    document.head.appendChild(styleEl);
  }
}

// --- 3. Spacing Sliders (NEW & IMPROVED) ---
// We also need to make these sliders "win" against site CSS
lineHeightSlider.addEventListener('input', (e) => {
  const newHeight = e.target.value;
  chrome.scripting.executeScript({
    target: { tabId: (chrome.tabs.query({ active: true, currentWindow: true }, tabs => tabs[0].id))[0].id },
    function: (height) => {
      // We inject a stylesheet for this, too, to make sure it wins
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

letterSpacingSlider.addEventListener('input', (e) => {
  const newSpacing = e.target.value;
  chrome.scripting.executeScript({
    target: { tabId: (chrome.tabs.query({ active: true, currentWindow: true }, tabs => tabs[0].id))[0].id },
    function: (spacing) => {
      // And one for letter-spacing
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
