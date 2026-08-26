import { analysisAPI } from "../../config";
import RepoService from "../../services/RepoService";
import { findNavElement, resolveNavTabs } from "./find-nav";
const repoService = new RepoService(analysisAPI);

const DEPENDENCIES_URL = `#dependencies`;

/**
 * Checks if the url is a github pull request.
 * @param url the url to check
 * @returns true if the url is a github pull request, false otherwise
 */
function isUrlGithubPullRequest(url: string): boolean {
  const urlRegex = /^https:\/\/github.com\/.*\/pull\/\d+.*$/;
  return urlRegex.test(url);
}

/**
 * Checks if the url is already on the dependencies page.
 * @param url the url to check
 * @returns true if the url is already on the dependencies page, false otherwise
 */
function isAlreadyOnDependenciesUrl(url: string): boolean {
  return url.endsWith(DEPENDENCIES_URL);
}

/**
 * Checks if the url is on the commits tab.
 * @param url the url to check
 * @returns the url without the commits part if it is on the commits tab, null otherwise
 */
function isOnCommitsTab(url: string) {
  const urlRegex = /^(https:\/\/github.com\/.*\/pull\/\d+)(.*)$/;
  const groups = urlRegex.exec(url);
  if (groups?.[2].startsWith("/commits")) return groups[1];
  return null;
}

async function isRepoRegistered(owner: string, repo: string) {
  return await repoService.isRepoRegistered(owner, repo);
}

/**
 * Sends a message to the extension to go to the dependencies page.
 */
async function gotoDependencies() {
  // check if the url is on the commits tab
  const baseUrl = isOnCommitsTab(window.location.href);
  if (baseUrl) {
    window.location.href = `${baseUrl}${DEPENDENCIES_URL}`;
    return;
  }

  // send a message to the extension
  const response = await chrome.runtime.sendMessage({ message: "goto-dependencies" });
  console.log(response);
}

/**
 * Inserts the dependencies tab in the pull request page.
 */
const insertNavTab = async () => {
  // check if the url is a github pull request
  if (!isUrlGithubPullRequest(window.location.href)) return;

  // check if the repo is registered
  const owner = window.location.pathname.split("/")[1];
  const repo = window.location.pathname.split("/")[2];
  if (!(await isRepoRegistered(owner, repo))) return;

  // get the nav element
  const navElement = findNavElement();
  const navTabs = navElement ? resolveNavTabs(navElement) : null;
  if (!navElement || !navTabs) return console.warn("nav not found");

  queueTask(() =>
    runSilent(
      () => {
        // check if the tab already exists
        const existingTab = navTabs!.querySelector(`.tabnav-tab[href='${DEPENDENCIES_URL}']`);
        if (existingTab !== null) {
          return;
        } else {
          // create a new tab
          const tab = document.createElement("a");
          tab.setAttribute("role", "tab");
          tab.classList.add("tabnav-tab");
          tab.classList.add("flex-shrink-0");
          tab.classList.add("dependencies-tab");
          tab.href = DEPENDENCIES_URL;
          tab.innerHTML = "Dependencies";

          // sends a message to the extension when clicked
          tab.addEventListener("click", async () => {
            if (isAlreadyOnDependenciesUrl(window.location.href) && tab.classList.contains("selected"))
              return;
            await gotoDependencies();
          });

          navTabs!.appendChild(tab);
        }
      },
      // goes to the dependencies page if the url is already on it and the content is not loaded
      async () => {
        const content = document.querySelector("#dependencies-content-root");
        if (isAlreadyOnDependenciesUrl(window.location.href) && !content) {
          await gotoDependencies();
        }
      }
    )
  );
};

// observer logic (based on https://github.com/Justineo/github-hovercard 's observer logic)
const observer = new MutationObserver(async () => {
  await insertNavTab();
});

/**
 * Starts observing the DOM.
 */
const startObserve = () => {
  observer.observe(document.body, {
    childList: true,
    subtree: true
  });
};

/**
 * Stops observing the DOM.
 */
const stopObserve = () => {
  observer.disconnect();
};

// auxiliary functions

/**
 * Run a method in the next browsers's tick.
 * @param fn the method to run
 */
const nextTick = (fn: () => void) => {
  let p = Promise.resolve();
  p.then(fn);
};

/**
 * Runs a method without observer callbacks.
 * @param fn the method to run
 */
const runSilent = async (fn: () => void, callback?: () => Promise<void>) => {
  stopObserve();
  fn();
  if (callback) await callback();

  // nextTick will run **after** MutationObserver callbacks
  nextTick(startObserve);
};

// task queue logic (based on https://github.com/Justineo/github-hovercard 's task queue logic)
const taskQueue: Function[] = [];

/**
 * Queues a task to run in the next idle callback.
 * @param fn the task to run
 */
const queueTask = (fn: Function) => {
  if (!taskQueue.length) {
    scheduleRunTaskQueue();
  }

  taskQueue.push(fn);
};

/**
 * Schedules the task queue to run in the next idle callback.
 */
const scheduleRunTaskQueue = () => {
  requestIdleCallback(runTaskQueue);
};

/**
 * Runs the task queue.
 * @param deadline the idle deadline
 */
const runTaskQueue = (deadline: IdleDeadline) => {
  while (deadline.timeRemaining() > 0 && taskQueue.length) {
    let fn = taskQueue.shift();
    if (fn) fn();
  }

  if (taskQueue.length) {
    scheduleRunTaskQueue();
  }
};

// start observing
queueTask(startObserve);

export {};
