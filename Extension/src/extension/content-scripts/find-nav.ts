// labels (lowercase) of the tabs that must be present for an element to be considered the
// pull request nav element
const REQUIRED_TAB_LABELS = ["conversation", "commits", "checks", "files changed"];

/**
 * Gets the lowercased, trimmed text of every tab-like descendant (links and role="tab" elements)
 * of the given element.
 * @param el the element to inspect
 * @returns the list of tab texts found inside the element
 */
function getTabTexts(el: Element): string[] {
  return Array.from(el.querySelectorAll("a, [role='tab']")).map(
    (node) => node.textContent?.trim().toLowerCase() ?? ""
  );
}

/**
 * Checks if an element's tab-like descendants cover every required tab label.
 * @param tabTexts the tab texts found inside the element
 * @returns true if every required tab label is present
 */
function hasAllRequiredTabs(tabTexts: string[]): boolean {
  return REQUIRED_TAB_LABELS.every((label) => tabTexts.some((text) => text.startsWith(label)));
}

/**
 * Finds the pull request nav element by searching, inside every header element on the page, for
 * the smallest element whose descendants cover the "Conversation", "Commits", "Checks" and
 * "Files changed" tabs.
 * @returns the nav element, or null if none was found
 */
export function findNavElement(): Element | null {
  const headers = document.querySelectorAll("header");

  let bestMatch: Element | null = null;
  let bestMatchTabCount = Infinity;

  for (const header of headers) {
    const candidates = header.querySelectorAll("*");
    for (const candidate of candidates) {
      const tabTexts = getTabTexts(candidate);
      if (tabTexts.length < bestMatchTabCount && hasAllRequiredTabs(tabTexts)) {
        bestMatch = candidate;
        bestMatchTabCount = tabTexts.length;
      }
    }
  }

  return bestMatch;
}

/**
 * Resolves the element that directly holds the tab items, given the (possibly wrapping) nav element,
 * by finding one of the required tabs and returning its direct parent (the other tabs are its siblings).
 * @param navElement the nav element found by findNavElement
 * @returns the element that directly holds the tab items
 */
export function resolveNavTabs(navElement: Element): Element | null {
  const tabs = navElement.querySelectorAll("a, [role='tab']");
  for (const tab of tabs) {
    const text = tab.textContent?.trim().toLowerCase() ?? "";
    if (REQUIRED_TAB_LABELS.some((label) => text.startsWith(label))) return tab.parentElement;
  }
  return null;
}
