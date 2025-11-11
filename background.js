const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent?key=';

// --- A. SET YOUR API KEY ---
chrome.runtime.onInstalled.addListener(() => {
  // --- PASTE YOUR **NEW** API KEY HERE ---
  const API_KEY = "AIzaSyCi23ykqUp0L2AkFx2pSUq3mc9G5V-1nIo";
  // ---
  
  chrome.storage.local.set({ apiKey: API_KEY }, () => {
    console.log('EchoRead: API Key set.');
  });
});

// --- B. CREATE THE RIGHT-CLICK MENU ---
chrome.contextMenus.create({
  id: "echoread-simplify",
  title: "EchoRead: Simplify Text",
  contexts: ["selection"]
});

// --- C. LISTEN FOR THE RIGHT-CLICK ---
chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === "echoread-simplify" && info.selectionText) {
    simplifyText(info.selectionText, tab.id);
  }
});

// --- D. THE AI FUNCTION (THIS IS THE FIXED, SAFE VERSION) ---
async function simplifyText(text, tabId) {
  // 1. Get the API Key from storage
  const data = await chrome.storage.local.get('apiKey');
  const apiKey = data.apiKey;

  if (!apiKey || apiKey === "PASTE_YOUR_NEW_API_KEY_HERE") {
    console.error('EchoRead: API Key not set.');
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
    contents: [{ parts: [{ text: prompt }] }]
  };

  try {
    // 3. Call the API
    const response = await fetch(GEMINI_API_URL + apiKey, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    const responseData = await response.json();
    
    // 4. --- THIS IS THE FIX ---
    // We check if 'candidates' exists *before* we try to read it.
    
    if (responseData.candidates && responseData.candidates.length > 0) {
      // SUCCESS!
      const simplifiedText = responseData.candidates[0].content.parts[0].text;
      
      // 5. Send the result back to the page
      chrome.scripting.executeScript({
        target: { tabId: tabId },
        function: (newText) => {
          const selection = window.getSelection();
          if (selection.rangeCount > 0) {
            const range = selection.getRangeAt(0);
            range.deleteContents();
            
            const newNode = document.createElement('span');
            newNode.style.background = '#fff8e1'; // Highlight
            newNode.style.padding = '2px';
            newNode.textContent = newText;
            
            range.insertNode(newNode);
          }
        },
        args: [simplifiedText]
      });
      
    } else {
      // FAILURE! This code now runs instead of crashing.
      console.error('EchoRead: API Error/Block:', responseData);
      
      let errorMsg = "API Error: No text was returned.";
      
      // This will tell us *why* it failed (e.g., dead key)
      if (responseData.error) {
        errorMsg = `API Error: ${responseData.error.message}`;
      } else if (responseData.promptFeedback) {
        errorMsg = `API Blocked: ${responseData.promptFeedback.blockReason}`;
      }
      
      // Tell the user what went wrong
      chrome.scripting.executeScript({
        target: { tabId: tabId },
        function: (msg) => alert(msg),
        args: [errorMsg]
      });
    }
    // --- END OF FIX ---

  } catch (error) {
    // This catches network errors
    console.error('EchoRead: Error calling Gemini API:', error);
    chrome.scripting.executeScript({
      target: { tabId: tabId },
      function: (errorMsg) => alert(`EchoRead Network Error: ${errorMsg}`),
      args: [error.message]
    });
  }
}
