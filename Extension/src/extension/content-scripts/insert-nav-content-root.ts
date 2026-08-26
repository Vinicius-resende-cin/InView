import { findNavElement, resolveNavTabs } from "./find-nav";

const DEPENDENCIES_URL = `#dependencies`;
const dependenciesContentRootId = "dependencies-content-root";

const toggleOuterContainerSize = (expand: boolean) => {
  const outerContainer = document.querySelector("div#diff-comparison-viewer-container");
  if (outerContainer) {
    outerContainer.classList.toggle("container-xl", expand);
  }
};

const hideOldContent = () => {
  //get the contents of the page
  const contentWrapper = document.querySelector("div[class*='PageLayoutContent']")
    ?? document.querySelector("div[class*='pull-request-tab-content']");
  if (!contentWrapper) throw new Error("old content not found");

  // hide the content wrapper
  contentWrapper.classList.add("hidden");

  const outerWrapper = contentWrapper.parentElement;
  if (!outerWrapper) throw new Error("outer wrapper not found");
  return outerWrapper;
};

const hideOldContentChecksPage = (nav: Element) => {
  // get the nav parent element
  const navParent = nav.parentElement;
  if (!navParent) throw new Error("nav parent not found");

  // hide all the next siblings of the nav element (the old content) that are not the dependencies content root
  let sibling = navParent.nextElementSibling;
  while (sibling) {
    const nextSibling = sibling.nextElementSibling;
    if (!sibling.id.includes(dependenciesContentRootId)) {
      sibling.classList.add("hidden");
    }
    sibling = nextSibling;
  }

  // return the nav grandparent element as the content wrapper
  const outerWrapper = navParent.parentElement;
  if (!outerWrapper) throw new Error("outer wrapper not found");
  return outerWrapper;
};

const showContent = async (content: Element) => {
  content.classList.remove("hidden");

  // send a message to the background script
  const response = await chrome.runtime.sendMessage({ message: "dependencies-root-visible" });
  console.log(response);
};

const createContentRoot = async (nav: Element, outerWrapper: Element) => {
  // add an event listener to each tab that hides the content when clicked
  const tabs = nav.querySelectorAll("a[role='tab']") as NodeListOf<HTMLAnchorElement>;
  tabs.forEach((tab) => {
    if (tab.textContent === "Dependencies") return;
    tab.addEventListener("click", () => {
      // adjust the outer container size if changing to main pr page or commits page
      if (!tab.href.includes("/checks") && !tab.href.includes("/changes")) {
        toggleOuterContainerSize(true);
      }

      // show the old content
      const curHidden = document.querySelectorAll(`.hidden`);
      curHidden.forEach((el) => el.classList.remove("hidden"));

      // hide the dependencies content
      const dependenciesContent = document.querySelector(`#${dependenciesContentRootId}`);
      if (dependenciesContent) {
        dependenciesContent.classList.add("hidden");
      }

      // remove the selected class from the dependencies tab
      const dependenciesTab = nav.querySelector(`.tabnav-tab[href='${DEPENDENCIES_URL}']`);
      if (dependenciesTab) {
        dependenciesTab.removeAttribute("aria-selected");
        dependenciesTab.classList.remove("selected");
      }

      // add the selected class to the clicked tab
      tab.setAttribute("aria-selected", "true");
      const selectedClassName = tab.getAttribute("selected-class-name");
      if (selectedClassName) {
        tab.classList.add(selectedClassName);
      }
      tab.classList.add("selected");
    });
  });

  // insert a new div with the new content
  const content = document.createElement("div");
  content.id = dependenciesContentRootId;
  content.classList.add("tw-w-full");
  content.classList.add("pull-request-tab-content");
  content.classList.add("is-visible");
  content.innerHTML = ``;
  outerWrapper.appendChild(content);

  // send a message to the background script
  const response = await chrome.runtime.sendMessage({ message: "dependencies-root-created" });
  console.log(response);
};

const prepareDependenciesTab = async () => {
  // get the content container and make it the right size
  let contentContainer = document.querySelector("div#diff-comparison-viewer-container");
  if (contentContainer) {
    toggleOuterContainerSize(false);
  } else {
    const turboFrame = document.querySelector("turbo-frame#repo-content-turbo-frame");
    let contentContainer = turboFrame?.querySelector("div.clearfix");
    if (!contentContainer) throw new Error("content container not found");
    contentContainer.className = "clearfix mt-4 px-3 px-md-4 px-lg-5";
  }

  // get the nav element
  const navElement = findNavElement();
  const nav = navElement ? resolveNavTabs(navElement) : null;
  if (!nav) throw new Error("nav not found");

  // remove the selected class from the current selected tab
  let curSelected = nav.querySelector("[class*='selected']");
  if (curSelected) {
  } else {
    curSelected = nav.querySelector("[aria-selected='true']");
  }
  if (!curSelected) throw new Error("selected tab not found");
  curSelected.removeAttribute("aria-selected");
  // remove any class containing "selected"
  curSelected.classList.forEach((cls) => {
    if (cls.includes("selected")) {
      curSelected!.classList.remove(cls);
      curSelected!.setAttribute("selected-class-name", cls);
    }
  });

  // get the tab that was clicked
  const tab = nav.querySelector(`.tabnav-tab[href='${DEPENDENCIES_URL}']`);
  if (tab === null) throw new Error("tab not found");

  // add the selected class to the clicked tab
  tab.setAttribute("aria-selected", "true");
  tab.classList.add("selected");

  // hide the old content and get the wrapper element
  let outerWrapper: Element;
  if (window.location.href.includes("/checks")) {
    outerWrapper = hideOldContentChecksPage(nav);
  } else {
    outerWrapper = hideOldContent();
  }

  // create the content root if it doesn't exist, otherwise show it
  const existingContent = document.querySelector(`#${dependenciesContentRootId}`);
  if (existingContent) {
    await showContent(existingContent);
  } else {
    await createContentRoot(nav, outerWrapper);
  }
};

(async () => {
  if (window.location.href.includes(DEPENDENCIES_URL)) {
    await prepareDependenciesTab();
  }
})();

export {};
