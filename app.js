"use strict";

const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

const storyContent = {
  mismatch: {
    titles: [
      "Start at the cycle boundary",
      "Follow the head’s own proposals",
      "Verify and commit a prefix",
      "A new cycle restarts the recursion",
      "Compare the KV-cache construction",
      "Same tokens are not sufficient",
    ],
    captions: [
      [
        "A cycle starts from a target hidden state.",
        "Inference begins one recurrent chain at the end of the committed prefix. The prefix cache is constructed from target features.",
      ],
      [
        "Drafts become the context for later drafts.",
        "The head proposes d₁, then conditions on d₁ to propose d₂, and on both to propose d₃. Its recursive features enter the current cycle’s cache.",
      ],
      [
        "The committed response can lose the original draft path.",
        "The policy accepts d₁, rejects d₂, and commits a corrected replacement. The discarded d₂ and d₃ are absent from the final response.",
      ],
      [
        "Inference starts again at the next cycle boundary.",
        "Cycle 2 begins with the target feature at its new boundary. Teacher forcing on a flat response does not recover this cycle structure.",
      ],
      [
        "Even an identical token can have a different KV entry.",
        "At depth 2, teacher forcing builds prefix entries from depth-1 head features. Drafting uses target-derived entries behind its boundary. Token identity alone cannot align these states.",
      ],
      [
        "The gap is in the computation, not just the token sequence.",
        "Cycle starts, recursive inputs, and cache composition must agree. Increasing drafting depth makes the distinction more consequential.",
      ],
    ],
  },
  reconstruction: {
    titles: [
      "Record the rollout",
      "Keep the original cycle and draft path",
      "Rebuild the target-derived prefix cache",
      "Replay the drafts under the same context",
      "Learn through the first rejection",
      "Update the head, with detached features",
    ],
    captions: [
      [
        "Keep the signals that verification already computed.",
        "Record the cycle’s start hidden state, draft tokens, verification distributions, accepted length, and absolute position. These records preserve what the final response omits.",
      ],
      [
        "Reconstruction is a replay, not a new sample.",
        "The draft tokens become training inputs. Sampling again could change the entire recursive path, so GrowMTP feeds the recorded drafts back in their original order.",
      ],
      [
        "Restore the prefix before advancing the draft chain.",
        "Recorded target hidden states and committed token IDs rebuild the shared prefix KV. A cycle sees only its own committed prefix at the original positions.",
      ],
      [
        "Each q is paired with the p that verified that prefix.",
        "Replay the head’s recursion within the cycle to rebuild its draft KV entries. The reconstructed head distribution and recorded target distribution now share the same draft-conditioned history.",
      ],
      [
        "The first rejected position still teaches the head.",
        "VGM includes d₁ and the rejected d₂, while excluding d₃. The loss always includes the first draft position, even when the head is randomly initialized.",
      ],
      [
        "One RL loop, two separate gradient paths.",
        "DCA with VGM updates the draft-head parameters φ. Its gradients stop at the backbone inputs; the original RL objective independently updates policy parameters θ.",
      ],
    ],
  },
};

function tokenMarkup(
  label,
  { state = "", note = "", pending = false, learning = false, delay = 0 } = {},
) {
  return `<div class="scene-token ${state} ${pending ? "pending" : "entered"} ${learning ? "learning" : ""}" style="--enter-delay:${delay}ms"><span>${label}</span>${note ? `<small>${note}</small>` : ""}</div>`;
}
function hiddenState(head = false, small = "boundary") {
  return `<div class="state-node ${head ? "head-state" : ""}"><span>${head ? "h⁽¹⁾" : "h⁽⁰⁾"}</span><small>${small}</small></div>`;
}
function cacheMarkup(wrong, revealed, side, mode) {
  const recursivePrefix = wrong && revealed;
  const prefix = Array.from(
    { length: 3 },
    (_, i) =>
      `<span class="kv-entry ${recursivePrefix ? "recursive kv-wrong" : ""}">h${recursivePrefix ? "⁽¹⁾" : "⁽⁰⁾"}${i + 1}</span>`,
  ).join("");
  const note = recursivePrefix
    ? "<b>Prefix from head features</b> · wrong cache at depth 2"
    : "Target-derived prefix · own-cycle draft entries";
  return `<div class="cache-box"><div class="cache-title"><span>KV sources · draft depth 2</span><span>${mode === "reconstruction" && side === "right" ? "REBUILT" : "PREFIX | OWN DRAFT"}</span></div><div class="cache-entries">${prefix}<span class="cache-divider"></span><span class="kv-entry recursive">h̄₁</span></div><div class="cache-caption">${note}</div></div>`;
}
function panelMarkup(mode, side, frame, scenario) {
  const reconstruct = mode === "reconstruction";
  const right = side === "right";
  const acceptedAll = scenario === "accept";
  const verified = reconstruct || frame >= 2;
  const drafted = reconstruct ? !right || frame >= 1 : frame >= 1;
  const showCycle2 = reconstruct ? !right || frame >= 3 : frame >= 3;
  const teacher = right && !reconstruct;
  const changedPath = teacher && frame >= 3 && !acceptedAll;
  const showMask = right && reconstruct && frame >= 4;
  let title = right
    ? reconstruct
      ? "GrowMTP reconstruction"
      : "Teacher-forcing training"
    : reconstruct
      ? "Recorded rollout"
      : "Rollout-time drafting";
  const badge = right
    ? reconstruct
      ? "OUR TRAINING"
      : "FLAT RESPONSE"
    : "REFERENCE";
  let tokens;
  if (changedPath) {
    tokens =
      tokenMarkup("d₁", { note: "committed" }) +
      '<span class="scene-arrow">→</span>' +
      tokenMarkup("d̃₂", { state: "replacement", note: "replacement" }) +
      '<span class="scene-arrow">→</span>' +
      tokenMarkup("d₂₁", { note: "next cycle" });
  } else {
    tokens = [1, 2, 3]
      .map((i) => {
        const rejected = verified && !acceptedAll && i === 2;
        const discarded = verified && !acceptedAll && i === 3;
        const state = rejected ? "rejected" : discarded ? "discarded" : "";
        let note = !verified
          ? "draft"
          : rejected
            ? "rejected ×"
            : discarded
              ? "discarded"
              : "accepted ✓";
        if (showMask)
          note = discarded ? "masked" : rejected ? "learn · ×" : "learn · ✓";
        return `${i > 1 ? '<span class="scene-arrow">→</span>' : ""}${tokenMarkup(`d${["₁", "₂", "₃"][i - 1]}`, { state, note, pending: !drafted, learning: showMask && !discarded, delay: i * 100 })}`;
      })
      .join("");
  }
  let secondTokens;
  if (teacher)
    secondTokens =
      hiddenState(frame >= 4, frame >= 4 ? "head feature" : "each start") +
      '<span class="scene-arrow">→</span>' +
      tokenMarkup("fφ", { note: "same head" }) +
      '<span class="scene-arrow">→</span>' +
      tokenMarkup("gᵢ⁽²⁾", { note: "position i" });
  else
    secondTokens =
      hiddenState(false, "new boundary") +
      '<span class="scene-arrow">→</span>' +
      tokenMarkup("d₂₁") +
      '<span class="scene-arrow">→</span>' +
      tokenMarkup("d₂₂");
  const firstLabel =
    teacher && frame >= 3
      ? "Committed response, trained by right shift"
      : "Cycle 1 · start at m₁";
  const secondLabel = teacher
    ? "Training starts from every response position"
    : "Cycle 2 · restart at m₂";
  const resetNote = teacher
    ? frame >= 3
      ? "Cycle boundaries are not recovered from the flat response."
      : "A final response omits the original cycle structure."
    : acceptedAll
      ? "All accepted → commit 3 drafts + a bonus token, then restart."
      : "Reject d₂ → commit d₁ + replacement d̃₂, then restart.";
  return `<article class="scene-panel ${right ? "training-scene" : ""}"><div class="scene-panel-heading"><h4>${title}</h4><span class="panel-chip">${badge}</span></div><div class="cycle-label"><span>${firstLabel}</span><span>K = 3</span></div><div class="scene-lane">${hiddenState(false)}<span class="scene-arrow">→</span>${tokens}</div><p class="cycle-reset">${verified ? resetNote : "Prefix cache comes from target features."}</p><div class="scene-secondary ${showCycle2 ? "" : "hidden-until"}"><div class="cycle-label"><span>${secondLabel}</span></div><div class="scene-lane">${secondTokens}</div></div>${cacheMarkup(teacher, frame >= 4, side, mode)}</article>`;
}
function renderStory(root, mode, frame) {
  const scenario = $(`#${mode}-case`).value;
  const all = scenario === "accept";
  const stage = $(".comparison-stage", root);
  let bridge;
  if (mode === "reconstruction") {
    if (frame >= 5)
      bridge =
        '<span class="bridge-check">✓</span><span>DCA + VGM → φ &nbsp; · &nbsp; stop gradient at θ &nbsp; · &nbsp; RL objective → θ</span>';
    else if (frame >= 3)
      bridge = `<span class="bridge-check">✓</span><span>Same recorded prefix</span><div class="pair-chips"><span>q₁ ↔ p₁</span><span>q₂ ↔ p₂</span><span class="${frame >= 4 && !all ? "masked-pair" : ""}">${frame >= 4 && !all ? "q₃ · masked" : "q₃ ↔ p₃"}</span></div>`;
    else
      bridge =
        '<span class="bridge-check">↳</span><span>Record the boundary, drafts, target signals, and original positions.</span>';
  } else {
    bridge =
      frame >= 4
        ? '<span class="bridge-check">≠</span><span>At depth 2: target-derived prefix KV ≠ head-derived prefix KV.</span>'
        : frame >= 3
          ? '<span class="bridge-check">↳</span><span>Inference restarts at a cycle boundary. Flat-response training loses that structure.</span>'
          : '<span class="bridge-check">→</span><span>Watch the rollout first. Then compare the training computation.</span>';
  }
  stage.innerHTML =
    panelMarkup(mode, "left", frame, scenario) +
    panelMarkup(mode, "right", frame, scenario) +
    `<div class="scene-bridge">${bridge}</div>`;
  let [title, copy] = storyContent[mode].captions[frame];
  if (all && mode === "mismatch" && frame === 2) {
    title = "All drafts are accepted, but the cycle still ends.";
    copy =
      "Three accepted drafts and a target-sampled bonus token are committed. The next cycle restarts the head recursion from a fresh target-derived boundary.";
  }
  if (all && mode === "reconstruction" && frame === 4) {
    title = "All three draft positions provide supervision.";
    copy =
      "When all drafts are accepted, VGM includes all K positions. The target’s bonus token is not an additional draft position. DCA still reflects the chain dependence.";
  }
  $(".stage-badge", root).textContent = `${frame + 1} / 6`;
  $(".stage-title", root).textContent = storyContent[mode].titles[frame];
  $(".caption-title", root).textContent = title;
  $(".caption-body", root).textContent = copy;
  $(".frame-counter", root).textContent =
    `${String(frame + 1).padStart(2, "0")} / 06`;
  root.dataset.frame = String(frame);
  root.dataset.scenario = scenario;
}

class StoryPlayer {
  constructor(root, options) {
    this.root = root;
    this.options = options;
    this.progress = reducedMotion.matches || options.startAtEnd ? 1 : 0;
    this.wantsPlay = !reducedMotion.matches && !options.startAtEnd;
    this.visible = false;
    this.elapsed = this.progress * options.duration;
    this.last = null;
    this.raf = null;
    this.lastFrame = -1;
    this.lastRendered = 0;
    this.range = $(".timeline", root);
    this.button = $(".play-toggle", root);
    this.range.addEventListener("input", () => {
      this.wantsPlay = false;
      this.progress =
        (Number(this.range.value) - Number(this.range.min)) /
        (Number(this.range.max) - Number(this.range.min));
      this.elapsed = this.progress * options.duration;
      this.update(true);
      this.sync();
    });
    this.button.addEventListener("click", () => {
      this.wantsPlay = !this.wantsPlay;
      if (this.wantsPlay && this.progress >= 1) {
        this.elapsed = 0;
        this.progress = 0;
        this.lastFrame = -1;
      }
      this.sync();
    });
    $(".replay", root).addEventListener("click", () => {
      this.elapsed = 0;
      this.progress = 0;
      this.lastFrame = -1;
      this.wantsPlay = true;
      this.update(true);
      this.sync();
    });
    this.tick = this.tick.bind(this);
    this.update(true);
    this.sync();
  }
  update(force = false) {
    const frame = Math.min(5, Math.floor(this.progress * 6));
    if (this.options.continuous) this.options.render(this.progress);
    else if (force || frame !== this.lastFrame) this.options.render(frame);
    this.lastFrame = frame;
    this.range.value = String(
      Math.round(
        Number(this.range.min) +
          this.progress * (Number(this.range.max) - Number(this.range.min)),
      ),
    );
    this.range.setAttribute(
      "aria-valuetext",
      this.options.continuous
        ? `Training step ${this.range.value} of ${this.range.max}`
        : `Stage ${frame + 1} of 6: ${storyContent[this.options.kind].titles[frame]}`,
    );
  }
  sync() {
    const active = this.wantsPlay && this.visible && !document.hidden && !this.root.closest("[hidden]");
    this.root.dataset.playing = String(active);
    this.button.innerHTML =
      this.wantsPlay && this.visible
        ? '<span aria-hidden="true">Ⅱ</span> Pause'
        : '<span aria-hidden="true">▶</span> Play';
    this.button.setAttribute(
      "aria-label",
      `${this.wantsPlay && this.visible ? "Pause" : "Play"} ${this.options.label}`,
    );
    if (active && !this.raf) {
      this.last = null;
      this.raf = requestAnimationFrame(this.tick);
    }
    if (!active && this.raf) {
      cancelAnimationFrame(this.raf);
      this.raf = null;
      this.last = null;
    }
  }
  tick(time) {
    this.raf = null;
    if (!this.wantsPlay || !this.visible || document.hidden) return;
    const delta = this.last === null ? 0 : Math.min(time - this.last, 100);
    this.last = time;
    this.elapsed += delta;
    if (this.elapsed > this.options.duration + 3000) {
      this.elapsed = 0;
      this.lastFrame = -1;
    }
    this.progress = Math.min(1, this.elapsed / this.options.duration);
    if (time - this.lastRendered >= 33) {
      this.update();
      this.lastRendered = time;
    }
    this.raf = requestAnimationFrame(this.tick);
  }
  refresh() {
    this.update(true);
  }
}

const plot = { left: 45, right: 485, top: 18, bottom: 205 };
const plotX = (x, xmax) => plot.left + (x / xmax) * (plot.right - plot.left);
const plotY = (y, config) => plot.bottom - ((y - config.min) / (config.max - config.min)) * (plot.bottom - plot.top);
function linePath(points, config) {
  return points.map(([x, y], i) => `${i ? "L" : "M"}${plotX(x, config.xmax).toFixed(3)} ${plotY(y, config).toFixed(3)}`).join(" ");
}
function drawChart(config) {
  const fmt = config.format ?? String;
  const grid = config.ticks.map(v => `<line class="chart-grid" x1="${plot.left}" y1="${plotY(v, config)}" x2="${plot.right}" y2="${plotY(v, config)}"/><text class="chart-tick" x="${plot.left - 8}" y="${plotY(v, config) + 4}" text-anchor="end">${fmt(v)}</text>`).join("")
    + config.xticks.map(v => `<text class="chart-tick" x="${plotX(v, config.xmax)}" y="224" text-anchor="middle">${v}</text>`).join("");
  const early = config.crossover
    ? `<rect x="${plot.left}" y="${plot.top}" width="${plotX(config.crossover, config.xmax) - plot.left}" height="${plot.bottom - plot.top}" fill="#f6d9b8" opacity=".3"/><line class="rq1-crossover" x1="${plotX(config.crossover, config.xmax)}" x2="${plotX(config.crossover, config.xmax)}" y1="${plot.top}" y2="${plot.bottom}"/><text class="chart-annotation" x="${plotX(config.crossover, config.xmax) + 7}" y="31">Faster from step ${config.crossover}</text>`
    : "";
  const traces = config.series
    .map(({ points, className }) => `<path class="${className}" d="${linePath(points, config)}"/>`)
    .join("");
  const clip = `reveal-${config.container}`;
  $(`#${config.container}`).innerHTML = `<svg viewBox="0 0 500 250" role="img" aria-label="${config.label}, over ${config.xmax} RL steps, from ${config.figure}"><defs><clipPath id="${clip}"><rect x="${plot.left}" y="${plot.top - 3}" width="${plot.right - plot.left}" height="${plot.bottom - plot.top + 6}"/></clipPath></defs>${grid}${early}<g clip-path="url(#${clip})">${traces}</g><line class="chart-cursor" x1="485" x2="485" y1="18" y2="205"/><circle class="cursor-dot" r="3.5" cx="485" cy="200"/><text class="chart-axis-title" x="265" y="246" text-anchor="middle">RL training step</text></svg>`;
}
function interpolatePlotted(points, x) {
  if (x <= points[0][0]) return points[0][1];
  for (let i = 1; i < points.length; i++) {
    if (points[i][0] >= x) {
      const a = points[i - 1], b = points[i];
      return b[0] === a[0] ? b[1] : a[1] + ((b[1] - a[1]) * (x - a[0])) / (b[0] - a[0]);
    }
  }
  return points.at(-1)[1];
}

function advanceCharts(configs, step) {
  for (const config of configs) {
    const root = $(`#${config.container}`);
    if (!root?.firstElementChild) continue;
    const x = plotX(step, config.xmax);
    $("clipPath rect", root).setAttribute("width", String(x - plot.left));
    const cursor = $(".chart-cursor", root);
    cursor.setAttribute("x1", String(x)); cursor.setAttribute("x2", String(x));
    const dot = $(".cursor-dot", root);
    dot.setAttribute("cx", String(x));
    dot.setAttribute("cy", String(plotY(interpolatePlotted(config.cursor, step), config)));
  }
}
function chartFallback(selector, page, figures) {
  $$(selector).forEach((node) => {
    node.innerHTML = `<p class="rq1-chart-fallback">Curve data did not load. <a href="assets/GrowMTP.pdf#page=${page}" target="_blank" rel="noopener">View ${figures} ↗</a></p>`;
  });
}

const traces = window.RQ1_TRACES?.plots ?? null;
const rq1Base = { xmax: 500, xticks: [0, 100, 200, 300, 400, 500] };
const rq1Acceptance = { ...rq1Base, min: 0.9, max: 3.2, ticks: [1, 1.5, 2, 2.5, 3] };
const rq1Time = { ...rq1Base, min: 300, max: 1450, ticks: [400, 600, 800, 1000, 1200, 1400] };
function rq1Series(paths, ours) {
  return [
    paths.baselineRaw && { points: paths.baselineRaw, className: "trace-baseline-raw" },
    { points: paths.raw, className: "trace-raw" },
    { points: paths.baseline ?? [[0, 1], [500, 1]], className: "trace-baseline" },
    { points: ours, className: "trace-ours" },
  ].filter(Boolean);
}
const rq1Charts = !traces
  ? []
  : [
      { ...rq1Acceptance, container: "acceptance-chart", label: "Math: acceptance length", figure: "Figure 5a", paths: traces.acceptance },
      { ...rq1Time, container: "time-chart", label: "Math: end-to-end step time in seconds", figure: "Figure 5b", crossover: 30, paths: traces.time },
      { ...rq1Acceptance, container: "code-acceptance-chart", label: "Code: acceptance length", figure: "Figure 6a", paths: traces.codeAcceptance },
      { ...rq1Time, container: "code-time-chart", label: "Code: end-to-end step time in seconds", figure: "Figure 6b", crossover: 22, paths: traces.codeTime },
    ].map((config) => ({ ...config, cursor: config.paths.ours, series: rq1Series(config.paths, config.paths.ours) }));
rq1Charts.forEach(drawChart);
if (!traces) chartFallback("#growth-demo .training-chart", 17, "Figures 5 and 6");
function renderGrowth(progress) {
  const step = Math.max(1, Math.round(1 + progress * 499));
  $("#training-step").innerHTML = `${step}<span> / 500</span>`;
  $("#growth-demo .frame-counter").textContent = `${step} / 500`;
  advanceCharts(rq1Charts, step);
  let title;
  if (step < 22) {
    title = "Cold start: the head has to learn first.";
  } else if (step < 30) {
    title = "Code reaches the per-step crossover first.";
  } else if (step < 150) {
    title = "Early learning turns into faster steps in both domains.";
  } else if (step < 500) {
    title = "Capability grows within the RL loop.";
  } else {
    title = "500 steps: useful heads, grown from scratch.";
  }
  $("#growth-phase-title").textContent = title;
  $("#growth-demo").dataset.step = String(step);
}

const players = [];
for (const mode of ["reconstruction"]) {
  const root = $(`#${mode}-demo`);
  if (!root?.classList.contains("demo-shell")) continue;
  const player = new StoryPlayer(root, {
    kind: mode,
    label:
      mode === "mismatch"
        ? "train–inference mismatch animation"
        : "draft-path reconstruction animation",
    duration: 17000,
    render: (frame) => renderStory(root, mode, frame),
  });
  players.push(player);
  $(`#${mode}-case`).addEventListener("change", () => {
    player.refresh();
  });
}
players.push(
  new StoryPlayer($("#growth-demo"), {
    kind: "growth",
    continuous: true,
    startAtEnd: true,
    label: "Math and Code training curves",
    duration: 8000,
    render: renderGrowth,
  }),
);
const playerObserver = new IntersectionObserver(
  (entries) => {
    entries.forEach((entry) => {
      const player = players.find((p) => p.root === entry.target);
      player.visible = entry.isIntersecting && entry.intersectionRatio > 0.12;
      player.sync();
    });
  },
  { threshold: [0, 0.12, 0.3] },
);
players.forEach((player) => playerObserver.observe(player.root));
addEventListener("resize", () => players.forEach(player => player.sync()));
document.addEventListener("visibilitychange", () =>
  players.forEach((player) => player.sync()),
);
reducedMotion.addEventListener("change", (event) => {
  if (event.matches)
    players.forEach((player) => {
      player.wantsPlay = false;
      player.progress = 1;
      player.elapsed = player.options.duration;
      player.update(true);
      player.sync();
    });
});

const menu = $(".menu-toggle"),
  mobileNav = $("#mobile-nav");
function closeMenu() {
  menu.setAttribute("aria-expanded", "false");
  menu.setAttribute("aria-label", "Open navigation");
  mobileNav.hidden = true;
}
menu.addEventListener("click", () => {
  const open = menu.getAttribute("aria-expanded") !== "true";
  menu.setAttribute("aria-expanded", String(open));
  menu.setAttribute(
    "aria-label",
    open ? "Close navigation" : "Open navigation",
  );
  mobileNav.hidden = !open;
});
[...$$("a", mobileNav), ...$$(".nav-results")].forEach((link) =>
  link.addEventListener("click", closeMenu),
);
document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && !mobileNav.hidden) {
    closeMenu();
    menu.focus();
  }
});
document.addEventListener("click", (event) => {
  if (!mobileNav.hidden && !event.target.closest(".site-header")) closeMenu();
});
window.matchMedia("(min-width:1001px)").addEventListener("change", (event) => {
  if (event.matches) closeMenu();
});
const navLinks = $$(".main-nav a"),
  navSections = navLinks.map((link) => $(link.getAttribute("href")));
let scrollQueued = false;
function updateScroll() {
  const length = document.documentElement.scrollHeight - innerHeight;
  $(".reading-progress").style.transform =
    `scaleX(${length > 0 ? Math.min(1, Math.max(0, scrollY / length)) : 0})`;
  let active = -1;
  navSections.forEach((section, i) => {
    if (section.getBoundingClientRect().top <= 150) active = i;
  });
  navLinks.forEach((link, i) => {
    link.classList.toggle("active", i === active);
    if (i === active) link.setAttribute("aria-current", "location");
    else link.removeAttribute("aria-current");
  });
  scrollQueued = false;
}
addEventListener(
  "scroll",
  () => {
    if (!scrollQueued) {
      requestAnimationFrame(updateScroll);
      scrollQueued = true;
    }
  },
  { passive: true },
);
addEventListener("resize", updateScroll, { passive: true });
updateScroll();

const dialog = $("#figure-dialog");
let figureOpener = null;
$$("[data-zoom]").forEach((button) =>
  button.addEventListener("click", () => {
    figureOpener = button;
    $("#enlarged-figure").src = button.dataset.zoom;
    $("#enlarged-figure").alt = $("img", button).alt;
    $("#figure-dialog-title").textContent = button.dataset.title;
    dialog.showModal();
    document.body.style.overflow = "hidden";
  }),
);
$("#close-figure").addEventListener("click", () => dialog.close());
dialog.addEventListener("click", (event) => {
  const r = dialog.getBoundingClientRect();
  if (
    event.clientX < r.left ||
    event.clientX > r.right ||
    event.clientY < r.top ||
    event.clientY > r.bottom
  )
    dialog.close();
});
dialog.addEventListener("close", () => {
  document.body.style.overflow = "";
  figureOpener?.focus({ preventScroll: true });
});

(() => {
  const nav = document.getElementById("side-toc");
  const toggle = document.querySelector(".side-toc-toggle");
  if (!nav || !toggle) return;
  const links = [...nav.querySelectorAll("a")];
  const ids = [...new Set(links.map(a => a.hash.slice(1)))];
  const sections = ids.map(id => document.getElementById(id)).filter(Boolean);
  function close() { nav.classList.remove("is-open"); toggle.setAttribute("aria-expanded", "false"); }
  toggle.addEventListener("click", () => {
    const open = nav.classList.toggle("is-open");
    toggle.setAttribute("aria-expanded", String(open));
  });
  links.forEach(a => a.addEventListener("click", close));
  document.addEventListener("click", e => { if (!nav.contains(e.target) && !toggle.contains(e.target)) close(); });
  document.addEventListener("keydown", e => { if (e.key === "Escape" && nav.classList.contains("is-open")) { close(); toggle.focus(); } });
  let queued = false;
  function update() {
    let active = "";
    for (const section of sections) if (section.getBoundingClientRect().top <= 170) active = section.id;
    links.forEach(a => {
      const current = a.hash === "#" + active && (active !== "growth" || a.classList.contains("side-toc-child"));
      a.classList.toggle("is-current", current);
      if (current) a.setAttribute("aria-current", "location"); else a.removeAttribute("aria-current");
    });
    queued = false;
  }
  addEventListener("scroll", () => { if (!queued) { queued = true; requestAnimationFrame(update); } }, { passive: true });
  addEventListener("resize", update, { passive: true });
  update();
})();
