
(() => {
  "use strict";
  const decks = [...document.querySelectorAll("[data-module-group]")];
  const reduced = matchMedia("(prefers-reduced-motion: reduce)");
  function activate(deck, panelId, { focus = false, remember = false } = {}) {
    const tabs = [
      ...deck.querySelectorAll(':scope > .module-tabs > [role="tab"]'),
    ];
    const panels = [
      ...deck.querySelectorAll(':scope > .module-panels > [role="tabpanel"]'),
    ];
    if (!panels.some((panel) => panel.id === panelId)) return;
    for (const tab of tabs) {
      const active = tab.getAttribute("aria-controls") === panelId;
      tab.setAttribute("aria-selected", String(active));
      tab.tabIndex = active ? 0 : -1;
      if (active && focus) tab.focus({ preventScroll: true });
    }
    for (const panel of panels) panel.hidden = panel.id !== panelId;
    deck.dataset.activePanel = panelId;
    if (remember && location.hash !== `#${panelId}`)
      history.pushState(null, "", `#${panelId}`);

    window.dispatchEvent(new Event("resize"));
  }
  for (const deck of decks) {
    const tabs = [
      ...deck.querySelectorAll(':scope > .module-tabs > [role="tab"]'),
    ];
    deck.dataset.activePanel = tabs
      .find((tab) => tab.getAttribute("aria-selected") === "true")
      ?.getAttribute("aria-controls");
    for (const tab of tabs) {
      tab.addEventListener("click", () =>
        activate(deck, tab.getAttribute("aria-controls"), { remember: true }),
      );
      tab.addEventListener("keydown", (event) => {
        const i = tabs.indexOf(tab);
        let next;
        if (event.key === "ArrowRight") next = tabs[(i + 1) % tabs.length];
        if (event.key === "ArrowLeft")
          next = tabs[(i - 1 + tabs.length) % tabs.length];
        if (event.key === "Home") next = tabs[0];
        if (event.key === "End") next = tabs.at(-1);
        if (!next) return;
        event.preventDefault();
        activate(deck, next.getAttribute("aria-controls"), {
          focus: true,
          remember: true,
        });
        next.scrollIntoView({
          block: "nearest",
          inline: "nearest",
          behavior: "instant",
        });
      });
    }
  }
  function revealTarget(hash, scroll = true) {
    let id;
    try {
      id = decodeURIComponent(hash.replace(/^#/, ""));
    } catch {
      return;
    }
    if (!id) return;
    const target = document.getElementById(id);
    if (!target) return;
    const panel = target.closest(".module-panel");
    if (panel) activate(panel.closest("[data-module-group]"), panel.id);
    for (
      let ancestor = target.parentElement;
      ancestor;
      ancestor = ancestor.parentElement
    ) {
      if (ancestor.tagName === "DETAILS") ancestor.open = true;
    }
    if (scroll)
      requestAnimationFrame(() => {
        const anchor = target.matches(".module-panel")
          ? target.closest(".module-deck")
          : target;
        anchor.scrollIntoView({
          block: "start",
          behavior: reduced.matches ? "instant" : "smooth",
        });
      });
  }
  document.addEventListener("click", (event) => {
    const anchor = event.target.closest('a[href^="#"]');
    if (
      !anchor ||
      event.defaultPrevented ||
      event.button !== 0 ||
      event.metaKey ||
      event.ctrlKey ||
      event.shiftKey ||
      event.altKey
    )
      return;
    const hash = anchor.getAttribute("href");
    if (hash.length < 2) return;
    const target = document.getElementById(hash.slice(1));
    if (!target) return;
    event.preventDefault();
    if (location.hash !== hash) history.pushState(null, "", hash);
    revealTarget(hash);
  });
  addEventListener("popstate", () => revealTarget(location.hash));
  addEventListener("hashchange", () => revealTarget(location.hash));
  revealTarget(location.hash);
})();
