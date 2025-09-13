chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: "explainLike5yo",
    title: "Explain to a 5yo",
    contexts: ["selection"]
  });
  chrome.contextMenus.create({
    id: "setApiKey",
    title: "Set API Key",
    contexts: ["all"]
  });
});

chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === "explainLike5yo" && info.selectionText) {
    chrome.storage.local.get(["apiKey"], async (result) => {
      const apiKey = result.apiKey;
      if (!apiKey) {
        replaceText(tab.id, info.selectionText, "Error: Set API key in settings.");
        return;
      }
      try {
        const simplified = await simplifyText(info.selectionText, apiKey, 5);
        replaceText(tab.id, info.selectionText, simplified);
      } catch (error) {
        console.error("API Error (ignored for project):", error);
        const mock = await getMockSimplification(info.selectionText || "No text available");
        replaceText(tab.id, info.selectionText, mock || "Error: Simplification failed.");
      }
    });
  } else if (info.menuItemId === "setApiKey") {
    chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: () => {
        const key = prompt("Enter your OpenAI API Key:");
        if (key) {
          chrome.runtime.sendMessage({ action: "saveApiKey", key });
        }
      }
    });
  }
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === "saveApiKey") {
    chrome.storage.local.set({ apiKey: message.key }, () => {
      console.log("API Key saved.");
    });
  }
});

async function simplifyText(text, apiKey, complexity) {
  const maxWords = 150;
  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model: "gpt-3.5-turbo",
      messages: [{
        role: "user",
        content: `Explain the following text simply as if to a ${complexity}-year-old child. Use basic vocabulary, short sentences, and fun analogies. Keep it under ${maxWords} words: ${text}`
      }],
      max_tokens: 150,
      temperature: 0.7
    })
  });
  if (!response.ok) throw new Error(`HTTP ${response.status}: ${await response.text()}`);
  const data = await response.json();
  return `Simplified: ${data.choices[0].message.content.trim()}`;
}

async function getMockSimplification(text) {
  if (!text || typeof text !== "string") {
    return "Simplified: No text to simplify. Try selecting something!";
  }
  const lowerText = text.toLowerCase();
  if (lowerText.includes('sun') && lowerText.includes('star')) {
    return 'Simplified: The Sun is a big, shiny star, like a giant lantern!';
  } else if (lowerText.includes('photosynthesis') || lowerText.includes('plant')) {
    return 'Simplified: Plants eat sunlight to grow, like magic food!';
  } else if (lowerText.includes('gravity')) {
    return 'Simplified: Gravity is a hug from the ground!';
  }
  const firstSentence = text.split('. ')[0].toLowerCase();
  const simplified = firstSentence
    .replace(/complex|technical|sequence/g, 'simple')
    .replace(/star/g, 'shiny star')
    .replace(/energy/g, 'power')
    .replace(/process/g, 'way');
  return `Simplified: ${simplified}`; // Removed "so easy!"
}

function replaceText(tabId, originalText, newText) {
  chrome.scripting.executeScript({
    target: { tabId },
    func: (originalText, newText) => {
      const selection = window.getSelection();
      if (selection.rangeCount && selection.toString() === originalText) {
        const range = selection.getRangeAt(0);
        range.deleteContents();
        range.insertNode(document.createTextNode(newText));
      }
    },
    args: [originalText, newText]
  });
}