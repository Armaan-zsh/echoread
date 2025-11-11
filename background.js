const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent?key=';

// --- A. SET YOUR API KEY ---
// We'll set the key when the extension is first installed.
chrome.runtime.onInstalled.addListener(() => {
  // --- PASTE YOUR API KEY HERE ---
  const API_KEY = "AIzaSyCVrBBvJI8Q5jxbI1Rq48CYJADLlAhlqMM";
  // ---
  
  chrome.storage.local.set({ apiKey: API_KEY }, () => {
    console.log('EchoRead: API Key set.');
  });
});

// --- B. CREATE THE RIGHT-CLICK MENU ---
chrome.contextMenus.create({
  id: "echoread-simplify",
  title: "EchoRead: Simplify Text",
  contexts: ["selection"] // Only show when text is selected
});

// --- C. LISTEN FOR THE RIGHT-CLICK ---
chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === "echoread-simplify") {
    const selectedText = info.selectionText;
    
    // Send the selected text to our AI function
    simplifyText(selectedText, tab.id);
  }
});

// --- D. THE AI FUNCTION ---
async function simplifyText(text, tabId) {
  // 1. Get the API Key from storage
  const data = await chrome.storage.local.get('apiKey');
  const apiKey = data.apiKey;

  if (!apiKey || apiKey === "PASTE_YOUR_API_KEY_HERE") {
    console.error('EchoRead: API Key not set.');
    // We should tell the user
    chrome.scripting.executeScript({
      target: { tabId: tabId },
      function: () => alert('EchoRead Error: API Key is not set in background.js')
    });
    return;
  }
  
  // 2. Prepare the data for Gemini
  const prompt = `You are an accessibility assistant. Rewrite the following text to be at an 8th-grade reading level, using simple sentences and clear language. Do not add any new information.
  
  Original text: "${text}"
  
  Simplified text:`;
  
  const payload = {
    contents: [{
      parts: [{ text: prompt }]
    }]
  };

  try {
    // 3. Call the API
    const response = await fetch(GEMINI_API_URL + apiKey, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    const responseData = await response.json();
    
    // 4. Get the simplified text from the response
    const simplifiedText = responseData.candidates[0].content.parts[0].text;
    
    // 5. Send the result back to the page
    chrome.scripting.executeScript({
      target: { tabId: tabId },
      function: (newText) => {
        // This code runs on the webpage
        // It replaces the selected text with the new simplified text
        const selection = window.getSelection();
        if (selection.rangeCount > 0) {
          const range = selection.getRangeAt(0);
          range.deleteContents();
          
          const newNode = document.createElement('span');
          newNode.style.background = '#fff8e1'; // Highlight the new text
          newNode.style.padding = '2px';
          newNode.textContent = newText;
          
          range.insertNode(newNode);
        }
      },
      args: [simplifiedText]
    });

  } catch (error) {
    console.error('EchoRead: Error calling Gemini API:', error);
    chrome.scripting.executeScript({
      target: { tabId: tabId },
      function: (errorMsg) => alert(`EchoRead Error: ${errorMsg}`),
      args: [error.message]
    });
  }
}
