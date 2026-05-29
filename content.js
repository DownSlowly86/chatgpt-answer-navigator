(() => {
  const ROOT_ID = "cgpt-answer-navigator";
  if (document.getElementById(ROOT_ID)) {
    return;
  }

  const STORAGE_KEY = "cgpt-answer-navigator-state";
  const MESSAGE_SELECTOR = '[data-message-author-role="user"], [data-message-author-role="assistant"]';
  const ASSISTANT_SELECTOR = '[data-message-author-role="assistant"]';
  const TURN_SELECTOR = 'article, [data-testid^="conversation-turn-"], [data-testid*="conversation-turn"]';
  const SCROLL_OFFSET = 92;

  const state = {
    items: [],
    activeIndex: -1,
    scheduled: false,
    renderTimer: 0,
    observer: null,
    isCollapsed: false,
    isExpanded: false
  };

  const savedState = (() => {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
    } catch {
      return {};
    }
  })();

  state.isCollapsed = Boolean(savedState.isCollapsed);
  state.isExpanded = Boolean(savedState.isExpanded);

  const root = document.createElement("aside");
  root.id = ROOT_ID;
  root.setAttribute("aria-label", "ChatGPT 对话目录");

  const toggleButton = document.createElement("button");
  toggleButton.type = "button";
  toggleButton.className = "cgpt-answer-navigator__toggle";
  toggleButton.textContent = "目录";
  toggleButton.setAttribute("aria-label", "打开 ChatGPT 对话目录");

  const panel = document.createElement("section");
  panel.className = "cgpt-answer-navigator__panel";

  const header = document.createElement("header");
  header.className = "cgpt-answer-navigator__header";

  const titleWrap = document.createElement("div");
  const title = document.createElement("div");
  title.className = "cgpt-answer-navigator__title";
  title.textContent = "对话目录";

  const count = document.createElement("div");
  count.className = "cgpt-answer-navigator__count";

  titleWrap.append(title, count);

  const controls = document.createElement("div");
  controls.className = "cgpt-answer-navigator__controls";

  const modeButton = document.createElement("button");
  modeButton.type = "button";
  modeButton.className = "cgpt-answer-navigator__icon-button";

  const closeButton = document.createElement("button");
  closeButton.type = "button";
  closeButton.className = "cgpt-answer-navigator__icon-button";
  closeButton.textContent = "×";
  closeButton.setAttribute("aria-label", "收起目录");

  controls.append(modeButton, closeButton);
  header.append(titleWrap, controls);

  const list = document.createElement("ol");
  list.className = "cgpt-answer-navigator__list";

  const empty = document.createElement("div");
  empty.className = "cgpt-answer-navigator__empty";
  empty.textContent = "当前页面还没有可识别的回答";

  panel.append(header, list, empty);
  root.append(toggleButton, panel);
  (document.body || document.documentElement).appendChild(root);

  const cleanText = (value) => value.replace(/\s+/g, " ").trim();

  const truncate = (value, maxLength) => {
    if (!value) {
      return "";
    }

    if (value.length <= maxLength) {
      return value;
    }

    return `${value.slice(0, maxLength - 1)}…`;
  };

  const saveState = () => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({
        isCollapsed: state.isCollapsed,
        isExpanded: state.isExpanded
      }));
    } catch {
      // Some restricted browser contexts can block localStorage.
    }
  };

  const getMessageText = (element) => {
    const clone = element.cloneNode(true);
    clone.querySelectorAll("button, svg, menu, nav, script, style").forEach((node) => node.remove());
    return cleanText(clone.textContent || "");
  };

  const getConversationMessages = () => Array.from(document.querySelectorAll(MESSAGE_SELECTOR))
    .filter((node) => node instanceof HTMLElement);

  const getScrollTarget = (message) => message.closest(TURN_SELECTOR) || message;

  const getElementTop = (element) => {
    const rect = element.getBoundingClientRect();
    return rect.top + window.scrollY;
  };

  const isScrollable = (element) => {
    const style = window.getComputedStyle(element);
    return /(auto|scroll|overlay)/.test(style.overflowY) && element.scrollHeight > element.clientHeight;
  };

  const getScrollContainer = (element) => {
    let current = element.parentElement;

    while (current && current !== document.body) {
      if (isScrollable(current)) {
        return current;
      }

      current = current.parentElement;
    }

    return document.scrollingElement || document.documentElement;
  };

  const scrollToAnswer = (item) => {
    const container = getScrollContainer(item.scrollTarget);
    const containerIsPage = container === document.scrollingElement || container === document.documentElement || container === document.body;
    const top = containerIsPage
      ? getElementTop(item.scrollTarget) - SCROLL_OFFSET
      : item.scrollTarget.getBoundingClientRect().top - container.getBoundingClientRect().top + container.scrollTop - SCROLL_OFFSET;

    container.scrollTo({
      left: 0,
      top: Math.max(0, top),
      behavior: "smooth"
    });
  };

  const buildItems = () => {
    const messages = getConversationMessages();
    let latestQuestion = "";
    let answerNumber = 0;

    return messages.reduce((items, message) => {
      const role = message.getAttribute("data-message-author-role");

      if (role === "user") {
        latestQuestion = getMessageText(message);
        return items;
      }

      if (role === "assistant") {
        answerNumber += 1;
        const answerText = getMessageText(message);
        items.push({
          index: answerNumber,
          element: message,
          scrollTarget: getScrollTarget(message),
          question: latestQuestion || "未找到这次回答前的问题",
          answer: answerText || "回答生成中"
        });
      }

      return items;
    }, []);
  };

  const itemSignature = (items) => items
    .map((item) => `${item.index}:${item.question.slice(0, 80)}:${item.answer.slice(0, 120)}`)
    .join("|");

  const setModeButtonLabel = () => {
    modeButton.textContent = state.isExpanded ? "紧凑" : "展开";
    modeButton.setAttribute("aria-label", state.isExpanded ? "切换到紧凑目录" : "切换到展开目录");
  };

  const syncChrome = () => {
    root.classList.toggle("cgpt-answer-navigator--collapsed", state.isCollapsed);
    root.classList.toggle("cgpt-answer-navigator--expanded", state.isExpanded);
    setModeButtonLabel();
  };

  const renderList = () => {
    const fragment = document.createDocumentFragment();
    const questionLength = state.isExpanded ? 160 : 72;
    const answerLength = state.isExpanded ? 220 : 90;

    state.items.forEach((item, index) => {
      const row = document.createElement("li");
      row.className = "cgpt-answer-navigator__item";
      row.classList.toggle("cgpt-answer-navigator__item--active", index === state.activeIndex);

      const button = document.createElement("button");
      button.type = "button";
      button.className = "cgpt-answer-navigator__item-button";
      button.title = `Q${item.index}: ${item.question}`;
      button.setAttribute("aria-label", `跳转到第 ${item.index} 次回答`);
      button.addEventListener("click", () => scrollToAnswer(item));

      const number = document.createElement("span");
      number.className = "cgpt-answer-navigator__number";
      number.textContent = String(item.index);

      const body = document.createElement("span");
      body.className = "cgpt-answer-navigator__item-body";

      const question = document.createElement("span");
      question.className = "cgpt-answer-navigator__question";
      question.textContent = truncate(item.question, questionLength);

      const answer = document.createElement("span");
      answer.className = "cgpt-answer-navigator__answer";
      answer.textContent = truncate(item.answer, answerLength);

      body.append(question, answer);
      button.append(number, body);
      row.appendChild(button);
      fragment.appendChild(row);
    });

    list.replaceChildren(fragment);
  };

  const updateActiveItem = () => {
    if (!state.items.length) {
      state.activeIndex = -1;
      return;
    }

    const anchor = Math.min(240, window.innerHeight * 0.35);
    let nextActiveIndex = 0;

    state.items.forEach((item, index) => {
      if (item.scrollTarget.getBoundingClientRect().top <= anchor) {
        nextActiveIndex = index;
      }
    });

    if (nextActiveIndex === state.activeIndex) {
      return;
    }

    state.activeIndex = nextActiveIndex;
    Array.from(list.children).forEach((row, index) => {
      row.classList.toggle("cgpt-answer-navigator__item--active", index === nextActiveIndex);
    });
  };

  const updatePanelState = () => {
    count.textContent = `${state.items.length} 条回答`;
    empty.hidden = state.items.length !== 0;
    list.hidden = state.items.length === 0;
  };

  const refresh = () => {
    state.scheduled = false;

    if (!document.querySelector(ASSISTANT_SELECTOR)) {
      state.items = [];
      state.activeIndex = -1;
      renderList();
      updatePanelState();
      return;
    }

    const nextItems = buildItems();
    const nextSignature = itemSignature(nextItems);
    const currentSignature = itemSignature(state.items);

    state.items = nextItems;
    updateActiveItem();

    if (nextSignature !== currentSignature || list.children.length !== nextItems.length) {
      renderList();
    }

    updatePanelState();
  };

  const scheduleRefresh = () => {
    if (state.scheduled) {
      return;
    }

    state.scheduled = true;
    window.requestAnimationFrame(refresh);
  };

  const scheduleContentRefresh = () => {
    window.clearTimeout(state.renderTimer);
    state.renderTimer = window.setTimeout(scheduleRefresh, 120);
  };

  const observePage = () => {
    if (!document.body) {
      return;
    }

    state.observer?.disconnect();
    state.observer = new MutationObserver(scheduleContentRefresh);
    state.observer.observe(document.body, {
      childList: true,
      subtree: true,
      characterData: true,
      attributes: true,
      attributeFilter: ["data-message-author-role", "class"]
    });
  };

  toggleButton.addEventListener("click", () => {
    state.isCollapsed = false;
    syncChrome();
    saveState();
  });

  closeButton.addEventListener("click", () => {
    state.isCollapsed = true;
    syncChrome();
    saveState();
  });

  modeButton.addEventListener("click", () => {
    state.isExpanded = !state.isExpanded;
    syncChrome();
    saveState();
    renderList();
  });

  window.addEventListener("scroll", scheduleRefresh, { passive: true });
  document.addEventListener("scroll", scheduleRefresh, { passive: true, capture: true });
  window.addEventListener("resize", scheduleRefresh);

  syncChrome();
  observePage();
  scheduleRefresh();
})();
