/**
 * Inserts the new tab button.
 * @param tabId the id of the tab to insert the button
 */
function insertNavTab(tabId: number) {
  // add the new tab button
  chrome.scripting.executeScript({
    target: { tabId: tabId },
    files: ["./js/insert-nav-tab.js"]
  });
}

/**
 * Inserts the content root element of the tab.
 * @param tabId the id of the tab to insert the content
 */
function insertTabContentRoot(tabId: number) {
  chrome.scripting.executeScript(
    {
      target: { tabId: tabId },
      files: ["./js/insert-nav-content-root.js"]
    },
    () => console.log("Dependencies tab content root inserted")
  );
}

/**
 * Inserts the content of the tab.
 * @param tabId the id of the tab to insert the content
 */
function insertTabContent(tabId: number) {
  chrome.scripting.executeScript(
    {
      target: { tabId: tabId },
      files: ["./js/insert-nav-content.js"]
    },
    () => console.log("Dependencies tab content inserted")
  );
}

/**
 * Loads the CSS file.
 * @param tabId the id of the tab to load the CSS
 */
function loadCSS(tabId: number, cssFiles: string[]) {
  cssFiles.forEach((file) => {
    chrome.scripting.insertCSS(
      {
        target: { tabId: tabId },
        files: [`./js/${file}.css`]
      },
      () => console.log("CSS loaded")
    );
  });
}

// Injection logic for the styles and scripts (based on https://github.com/Justineo/github-hovercard 's logic)
const GITHUB_DOMAIN = "github.com";

/**
 * Inject the files when a navigation event is triggered.
 * @param details the details of the navigation
 */
const injector = (details: chrome.webNavigation.WebNavigationFramedCallbackDetails) => {
  loadCSS(details.tabId, ["diff2html", "tailwind", "dependency-plugin"]);
  insertNavTab(details.tabId);
};

/**
 * Binds the injector to the webNavigation event.
 */
const bindInjector = () => {
  if (chrome.webNavigation.onCommitted.hasListener(injector)) {
    chrome.webNavigation.onCommitted.removeListener(injector);
  }
  chrome.webNavigation.onCommitted.addListener(injector, {
    url: [{ hostEquals: GITHUB_DOMAIN }]
  });
};

// inject the files when the extension is installed or updated
chrome.runtime.onInstalled.addListener(bindInjector);

// inject the files when the extension is reloaded
bindInjector();

// Listen for messages from the content script
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  // Get the tabId
  const tabId = sender.tab?.id;
  if (tabId === undefined) {
    sendResponse({ message: "tabId not found" });
    throw new Error("tabId not found");
  }

  // Check if the message is valid
  if (request.message === "goto-dependencies") {
    // Insert the tab content root
    insertTabContentRoot(tabId);
    sendResponse({ message: "Navigating to dependencies tab" });
  } else if (request.message === "dependencies-root-ready") {
    // Insert the content of the tab
    insertTabContent(tabId);
    sendResponse({ message: "Dependencies content inserted" });
  } else {
    sendResponse({ message: "Invalid message" });
  }
});

export {};
