// This file runs automatically on any page ending in .pdf

function createPdfButton() {
  const button = document.createElement('button');
  button.id = 'echoread-pdf-button';
  button.textContent = '📚 Read with EchoRead';
  
  // Style the button so we can see it
  button.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
    z-index: 999999;
    padding: 12px 20px;
    background-color: #007bff;
    color: white;
    font-size: 16px;
    font-weight: bold;
    border: none;
    border-radius: 8px;
    cursor: pointer;
    box-shadow: 0 4px 12px rgba(0,0,0,0.2);
  `;
  
  document.body.appendChild(button);
  
  // Add the click listener
  button.addEventListener('click', convertPdfToHtml);
}

function convertPdfToHtml() {
  alert('Starting PDF conversion! This may take a moment for large files...');
  
  // 1. Get the URL of the PDF file we are on
  const pdfUrl = window.location.href;
  
  // 2. We need to tell our main 'popup.js' to load the pdf.js scripts
  // This is a bit advanced: we're sending a message from this content script
  // to our extension's "background" (which 'popup.js' can listen to,
  // but for now, we'll build the logic right here.)
  
  // --- This is complex, let's simplify the plan ---
  // New plan: This button will send a message to our extension,
  // and the extension will open a *new tab* with our converted HTML.
  // This is cleaner.
  
  // For now, let's just make the button work.
  // The full conversion logic is very complex.
  
  // --- Let's do a simple version FIRST ---
  // The logic in 'popup.js' is for HTML pages.
  // The logic here is for PDF pages.
  // Let's make this button just prove it works.
  
  button.textContent = 'Converting...';
  
  // Send a message to our (soon-to-be-updated) popup.js
  // to handle the hard work.
  chrome.runtime.sendMessage(
    { action: "convertPdf", url: pdfUrl },
    (response) => {
      if (response.success) {
        button.textContent = 'Converted!';
      } else {
        button.textContent = 'Failed!';
      }
    }
  );
}

// Run the function to add the button
createPdfButton();
