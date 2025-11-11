// This function will change the text on the page
function increaseFontSize() {
  console.log("EchoRead: Making text bigger!");
  
  // Get all the paragraphs, headings, and list items on the page
  const allTextElements = document.querySelectorAll('p, h1, h2, h3, h4, li, span, a');

  for (const element of allTextElements) {
    // Get the current font size
    const currentSize = window.getComputedStyle(element).fontSize;
    
    // Convert it to a number and add 2
    const newSize = parseFloat(currentSize) + 2;
    
    // Apply the new font size
    element.style.fontSize = `${newSize}px`;
  }
}

// This "listens" for messages from our popup.js
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  // If the message's action is "increase-font"
  if (request.action === "increase-font") {
    increaseFontSize(); // Run our function!
  }
});
