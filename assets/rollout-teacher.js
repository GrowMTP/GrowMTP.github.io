
(() => {
  "use strict";
  function initialize() {
    const root = document.getElementById("mismatch-demo");
    if (!root || !root.classList.contains("rt-figure")) return;
    const memo = new Map();
    const el = (id) => {
      if (!memo.has(id)) memo.set(id, root.querySelector(`#${id}`));
      return memo.get(id);
    };
    const set = (id, key, value) => el(id).setAttribute(key, String(value));
    const txt = (id, value) => {
      if (el(id).textContent !== value) el(id).textContent = value;
    };
    const show = (id, value) =>
      set(id, "opacity", Math.max(0, Math.min(1, value)));
    const move = (id, x, y) => set(id, "transform", `translate(${x} ${y})`);
    const inside = (t, a, b) => t >= a && t <= b;
    const smooth = (x) => {
      x = Math.max(0, Math.min(1, x));
      return x * x * (3 - 2 * x);
    };
    const small = matchMedia("(max-width:560px)");
    const reduced = matchMedia("(prefers-reduced-motion:reduce)");
    const duration = 22400;
    const stops = [
      1050, 2650, 4250, 5850, 7150, 8750, 10350, 12150, 13700, 15600, 17700,
    ];
    let time = 0,
      speed = 1,
      seeking = false,
      wantsPlay = true,
      last = performance.now(),
      playing = false,
      timer = null,
      g,
      lengths = {},
      lastStage = "";

    function reshape(id, width, height) {
      const r = el(id).querySelector("rect");
      r.setAttribute("x", -width / 2);
      r.setAttribute("y", -height / 2);
      r.setAttribute("width", width);
      r.setAttribute("height", height);
    }
    function layout() {
      g = small.matches
        ? {
            w: 520,
            h: 760,
            input: 76,
            head: 250,
            output: 435,
            portW: 86,
            headW: 94,
            ry: 105,
            ty: 515,
            rollKV: 197,
            tfKV: 670,
            prefixX: 75,
            kv: [164, 266, 368],
            rollKv: [164, 232, 300],
            drafts: [115, 185, 255],
            draftY: 268,
            targetX: 430,
            targetW: 110,
            commits: [72, 196, 316, 438],
            commitY: 377,
            commitTop: 330,
            commitH: 74,
            tfTitleY: 444,
            logits: [165, 270, 375],
            logitsY: 611,
            loopLeft: 32,
            loopRight: 488,
            rollLoopY: 38,
            tfLoopY: 724,
            slotW: 56,
            commitW: 59,
          }
        : {
            w: 900,
            h: 600,
            input: 125,
            head: 360,
            output: 600,
            portW: 140,
            headW: 110,
            ry: 116,
            ty: 435,
            rollKV: 214,
            tfKV: 526,
            prefixX: 158,
            kv: [240, 314, 388],
            rollKv: [240, 314, 388],
            drafts: [532, 590, 648],
            draftY: 214,
            targetX: 800,
            targetW: 118,
            commits: [267, 406, 554, 702],
            commitY: 304,
            commitTop: 270,
            commitH: 67,
            tfTitleY: 375,
            logits: [595, 681, 767],
            logitsY: 526,
            loopLeft: 35,
            loopRight: 700,
            rollLoopY: 46,
            tfLoopY: 574,
            slotW: 56,
            commitW: 72,
          };
      set("rt-canvas", "viewBox", `0 0 ${g.w} ${g.h}`);
      const movingBox = el("rt-packet").querySelector("rect");
      movingBox.setAttribute("y", small.matches ? -12 : -16);
      movingBox.setAttribute("height", small.matches ? 24 : 32);
      txt("rt-tf-kv-label", small.matches ? "KV" : "KV writes");
      for (const [id, x, y] of [
        ["rt-roll-input", g.input, g.ry],
        ["rt-roll-output", g.output, g.ry],
        ["rt-tf-input", g.input, g.ty],
        ["rt-tf-output", g.output, g.ty],
      ]) {
        move(id, x, y);
        const group = el(id),
          w = g.portW / 2 - 3;
        const rects = [...group.querySelectorAll("rect")];
        rects[0].setAttribute("x", -g.portW / 2);
        rects[0].setAttribute("width", w);
        rects[1].setAttribute("x", 3);
        rects[1].setAttribute("width", w);
        group
          .querySelector('[data-field="h"]')
          .setAttribute("x", -g.portW / 4 - 1.5);
        group
          .querySelector('[data-field="d"]')
          .setAttribute("x", g.portW / 4 + 1.5);
        const captions = [...group.querySelectorAll(".rt-field-caption")];
        captions[0].setAttribute("x", -g.portW / 4 - 1.5);
        captions[1].setAttribute("x", g.portW / 4 + 1.5);
      }
      move("rt-roll-head", g.head, g.ry);
      move("rt-tf-head", g.head, g.ty);
      reshape("rt-roll-head", g.headW, 78);
      reshape("rt-tf-head", g.headW, 78);
      for (const [id, x, y] of [
        ["rt-roll-input-label", g.input, g.ry - 36],
        ["rt-roll-output-label", g.output, g.ry - 36],
        ["rt-tf-input-label", g.input, g.ty - 36],
        ["rt-tf-output-label", g.output, g.ty - 36],
      ]) {
        set(id, "x", x);
        set(id, "y", y);
      }
      set("rt-roll-step", "x", g.w - 28);
      set("rt-tf-step", "x", g.w - 28);
      set("rt-tf-step", "y", g.tfTitleY);
      set("rt-tf-title", "y", g.tfTitleY);
      for (const [id, x, y] of [
        ["rt-roll-kv-label", small.matches ? 31 : 112, g.rollKV + 5],
        ["rt-tf-kv-label", small.matches ? 31 : 112, g.tfKV + 5],
        ["rt-drafts-label", small.matches ? 61 : 485, g.draftY + 5],
        ["rt-logits-label", small.matches ? 89 : 540, g.logitsY + 5],
      ]) {
        set(id, "x", x);
        set(id, "y", y);
      }
      move("rt-roll-prefix", g.prefixX, g.rollKV);
      move("rt-tf-prefix", g.prefixX, g.tfKV);
      for (let i = 1; i <= 3; i++) {
        move(`rt-roll-kv-${i}`, g.rollKv[i - 1], g.rollKV);
        move(`rt-tf-kv-${i}`, g.kv[i - 1], g.tfKV);
        move(`rt-draft-${i}`, g.drafts[i - 1], g.draftY);
        move(`rt-logit-${i}`, g.logits[i - 1], g.logitsY);
      }
      move("rt-target", g.targetX, g.draftY);
      reshape("rt-target", g.targetW, 60);
      set("rt-commit-bg", "x", small.matches ? 16 : 24);
      set("rt-commit-bg", "y", g.commitTop);
      set("rt-commit-bg", "width", g.w - (small.matches ? 32 : 48));
      set("rt-commit-bg", "height", g.commitH);
      set("rt-committed-label", "x", small.matches ? 29 : 45);
      set("rt-committed-label", "y", small.matches ? 352 : 309);
      move("rt-commit-prefix", g.commits[0], g.commitY);
      reshape("rt-commit-prefix", small.matches ? 57 : 79, 34);
      for (let i = 1; i <= 3; i++) {
        move(`rt-committed-${i}`, g.commits[i], g.commitY);
        reshape(`rt-committed-${i}`, g.commitW, 34);
        set(
          `rt-commit-link${i}`,
          "d",
          `M${g.commits[i - 1] + g.commitW / 2 + 5} ${g.commitY}H${g.commits[i] - g.commitW / 2 - 5}`,
        );
      }
      const routes = {
        "rt-roll-in": `M${g.input} ${g.ry}H${g.head - g.headW / 2}`,
        "rt-roll-out": `M${g.head + g.headW / 2} ${g.ry}H${g.output}`,
        "rt-roll-loop": `M${g.output} ${g.ry}H${g.loopRight - 18}Q${g.loopRight} ${g.ry} ${g.loopRight} ${g.ry - 18}V${g.rollLoopY + 18}Q${g.loopRight} ${g.rollLoopY} ${g.loopRight - 18} ${g.rollLoopY}H${g.loopLeft + 18}Q${g.loopLeft} ${g.rollLoopY} ${g.loopLeft} ${g.rollLoopY + 18}V${g.ry - 18}Q${g.loopLeft} ${g.ry} ${g.loopLeft + 18} ${g.ry}H${g.input}`,
        "rt-batch": `M${g.drafts[2] + 23} ${g.draftY}H${g.targetX - g.targetW / 2}`,
        "rt-commit-1": `M${g.targetX} ${g.draftY}C${g.targetX} ${g.draftY + 56} ${g.commits[1]} ${g.commitY - 52} ${g.commits[1]} ${g.commitY}`,
        "rt-commit-2": `M${g.drafts[0]} ${g.draftY}C${g.drafts[0]} ${g.draftY + 43} ${g.commits[2]} ${g.commitY - 44} ${g.commits[2]} ${g.commitY}`,
        "rt-commit-3": `M${g.targetX} ${g.draftY}C${g.targetX} ${g.draftY + 50} ${g.commits[3]} ${g.commitY - 42} ${g.commits[3]} ${g.commitY}`,
        "rt-tf-in": `M${g.input} ${g.ty}H${g.head - g.headW / 2}`,
        "rt-tf-out": `M${g.head + g.headW / 2} ${g.ty}H${g.output}`,
        "rt-tf-loop": `M${g.output - g.portW / 4} ${g.ty}H${g.loopRight - 18}Q${g.loopRight} ${g.ty} ${g.loopRight} ${g.ty + 18}V${g.tfLoopY - 18}Q${g.loopRight} ${g.tfLoopY} ${g.loopRight - 18} ${g.tfLoopY}H${g.loopLeft + 18}Q${g.loopLeft} ${g.tfLoopY} ${g.loopLeft} ${g.tfLoopY - 18}V${g.ty + 18}Q${g.loopLeft} ${g.ty} ${g.loopLeft + 18} ${g.ty}H${g.input - g.portW / 4}`,
      };
      Object.entries(routes).forEach(([id, d]) => set(id, "d", d));
      lengths = {};
      Object.keys(routes).forEach(
        (id) => (lengths[id] = el(id).getTotalLength()),
      );
      render(time);
    }
    function bundle(id, h, d, origin = "head", hiddenMismatch = false) {
      const e = el(id);
      e.querySelector('[data-field="h"]').textContent = h;
      e.querySelector('[data-field="d"]').textContent = d;
      e.setAttribute("data-origin", origin);
      e.setAttribute("data-token", d.includes("̃") ? "replacement" : "normal");
      e.setAttribute(
        "data-hidden-mismatch",
        String(hiddenMismatch && h !== "—"),
      );
    }
    function tile(id, label, kind, filled, reference = false) {
      const e = el(id);
      e.querySelector("text").textContent = filled ? label : "—";
      e.setAttribute(
        "class",
        `rt-tile ${filled ? "rt-written" : ""} rt-kv-${kind}${reference ? " rt-kv-reference" : ""}`,
      );
    }
    function path(id, d) {
      set(id, "d", d);
      lengths[id] = el(id).getTotalLength();
    }
    function packet(id, route, value, kind, t, a, b) {
      if (!inside(t, a, b) || reduced.matches) return;
      const pos = el(route).getPointAtLength(
        lengths[route] * smooth((t - a) / (b - a)),
      );
      move(id, pos.x, pos.y);
      show(id, 1);
      el(id).setAttribute(
        "class",
        `rt-packet ${kind === "target" ? "rt-target-data" : kind === "replace" ? "rt-replacement-data" : kind === "error" ? "rt-error-data" : kind === "hidden-error" ? "rt-hidden-error-data" : ""}`,
      );
      const label = el(id).querySelector("text");
      if (kind === "hidden-error") {

        const [hidden, rest] = value.split(" · ");
        const feature = document.createElementNS(
          "http://www.w3.org/2000/svg",
          "tspan",
        );
        feature.setAttribute("class", "rt-packet-hidden");
        feature.textContent = hidden;
        label.replaceChildren(feature, document.createTextNode(` · ${rest}`));
      } else label.textContent = value;
    }
    function sourcePath(index) {
      const sx = g.commits[index],
        dx = g.input + g.portW / 4 + 1.5;
      const mid = small.matches ? 410 : g.ty - 61;
      path(
        "rt-source",
        `M${sx} ${g.commitY + 17}V${mid - 14}Q${sx} ${mid} ${sx - 14} ${mid}H${dx + 14}Q${dx} ${mid} ${dx} ${mid + 14}V${g.ty}`,
      );
    }
    function cachePath(index) {
      const x = g.kv[index - 1];
      path(
        "rt-kv-write",
        `M${g.head} ${g.ty + 39}C${g.head} ${g.ty + 75} ${x} ${g.tfKV - 40} ${x} ${g.tfKV}`,
      );
    }
    function render(t) {
      const cycle = t < 6100 ? 1 : 2,
        base = cycle === 1 ? 0 : 6100,
        u = Math.min(t - base, 6100),
        prime = cycle === 1 ? "" : "′";
      const inStep = u < 1650 ? 0 : u < 3250 ? 1 : 2;
      const hInput =
        inStep === 0 ? `h₀${prime}` : `h${["", "₁", "₂"][inStep]}${prime}`;
      const tokInput =
        inStep === 0
          ? cycle === 1
            ? "yₜ"
            : "d̃₁₁"
          : `d${cycle === 1 ? "₁" : "₂"}${inStep === 1 ? "₁" : "₂"}`;
      bundle(
        "rt-roll-input",
        hInput,
        tokInput,
        inStep === 0 ? "target" : "head",
      );
      let n = u >= 4200 ? 3 : u >= 2600 ? 2 : u >= 1000 ? 1 : 0;
      if (inside(u, 1800, 2599) || inside(u, 3400, 4199)) n = 0;
      bundle(
        "rt-roll-output",
        n ? `h${["", "₁", "₂", "₃"][n]}${prime}` : "—",
        n ? `d${cycle === 1 ? "₁" : "₂"}${["", "₁", "₂", "₃"][n]}` : "—",
      );
      const count = u >= 4350 ? 3 : u >= 2750 ? 2 : u >= 1150 ? 1 : 0;
      const verify = u >= 4900;
      const decided = u >= 5150;
      for (let i = 1; i <= 3; i++) {
        const label = `d${cycle === 1 ? "₁" : "₂"}${["", "₁", "₂", "₃"][i]}`;
        const accepted = decided && cycle === 2 && i === 1;
        const rejected = decided && i === (cycle === 1 ? 1 : 2);
        const discarded = decided && i > (cycle === 1 ? 1 : 2);
        const e = el(`rt-draft-${i}`);
        e.querySelector(".rt-value").textContent = i <= count ? label : "—";
        e.querySelector(".rt-verdict").textContent = accepted
          ? "✓"
          : rejected
            ? "×"
            : discarded
              ? "—"
              : "";
        e.querySelector(".rt-probability").textContent = verify
          ? `p${cycle === 1 ? "₁" : "₂"}${["", "₁", "₂", "₃"][i]}`
          : "";
        e.setAttribute(
          "class",
          `rt-draft ${i <= count ? "rt-produced" : ""} ${rejected ? "rt-rejected" : ""} ${discarded ? "rt-discarded" : ""}`,
        );
      }
      const cached = u >= 4200 ? 3 : u >= 2600 ? 2 : u >= 1000 ? 1 : 0;
      const cacheTokens =
        cycle === 1 ? ["yₜ", "d₁₁", "d₁₂"] : ["d̃₁₁", "d₂₁", "d₂₂"];
      cacheTokens.forEach((label, i) =>
        tile(
          `rt-roll-kv-${i + 1}`,
          label,
          i === 0 ? "target" : "draft",
          i < cached,
          (t >= 15500 && t < 17600 && cycle === 2 && i === 0) ||
            (t >= 17600 && cycle === 2 && i === 1),
        ),
      );
      const committed = [t >= 5800, t >= 11700, t >= 12100];
      ["d̃₁₁", "d₂₁", "d̃₂₂"].forEach((label, i) => {
        const e = el(`rt-committed-${i + 1}`);
        e.querySelector("text").textContent = committed[i] ? label : "—";
        e.setAttribute(
          "class",
          `rt-tile rt-commit-token ${committed[i] ? "rt-filled" : ""} ${i !== 1 && committed[i] ? "rt-replacement" : ""}`,
        );
      });
      const upperActive = t < 12100;
      txt(
        "rt-roll-step",
        !upperActive
          ? "Complete"
          : u < 4500
            ? `Cycle ${cycle} · draft ${u < 1800 ? 1 : u < 3400 ? 2 : 3} / 3`
            : u < 5150
              ? `Cycle ${cycle} · verify`
              : `Cycle ${cycle} · commit`,
      );
      txt(
        "rt-target-action",
        !upperActive
          ? "recorded"
          : u < 4500
            ? "wait for drafts"
            : u < 4900
              ? "receive 3 drafts"
              : u < 5150
                ? "verify K = 3"
                : cycle === 1 && u > 5800
                  ? "refresh prefix"
                  : "resample / commit",
      );
      el("rt-target").classList.toggle(
        "rt-target-active",
        upperActive && u >= 4500,
      );
      el("rt-roll-head").classList.toggle(
        "rt-computing",
        upperActive &&
          [
            [550, 850],
            [2150, 2450],
            [3750, 4050],
          ].some(([a, b]) => inside(u, a, b)),
      );

      const tf = t < 12400 ? 0 : t < 14500 ? 1 : t < 16600 ? 2 : 3;
      const tfReady = t >= 12400;
      const tfInputs = ["yₜ", "d̃₁₁", "d₂₁"];
      bundle(
        "rt-tf-input",
        !tfReady ? "—" : tf === 1 ? "h₀" : tf === 2 ? "h₁ᵀ" : "h₂ᵀ",
        !tfReady ? "—" : tfInputs[tf - 1],
        tf <= 1 ? "target" : "head",
        tf >= 2,
      );
      const result = t >= 17600 ? 3 : t >= 15500 ? 2 : t >= 13600 ? 1 : 0;
      const processing = inside(t, 14500, 15499) || inside(t, 16600, 17599);
      bundle(
        "rt-tf-output",
        result && !processing ? `h${["", "₁", "₂", "₃"][result]}ᵀ` : "—",
        result && !processing ? `q${["", "₁", "₂", "₃"][result]}` : "—",
        "head",
        result >= 2 && !processing,
      );
      const writes = [t >= 13600, t >= 15500, t >= 17600];
      tfInputs.forEach((label, i) =>
        tile(
          `rt-tf-kv-${i + 1}`,
          label,
          i === 0 ? "target" : "error",
          writes[i],
        ),
      );
      for (let i = 1; i <= 3; i++) show(`rt-logit-${i}`, writes[i - 1] ? 1 : 0);
      el("rt-tf-head").classList.toggle(
        "rt-computing",
        [
          [12800, 13200],
          [14700, 15100],
          [16800, 17200],
        ].some(([a, b]) => inside(t, a, b)),
      );
      txt(
        "rt-tf-step",
        !tfReady
          ? "Uses the committed tokens"
          : t < 13600
            ? "Step 1 · logits + KV"
            : t < 14500
              ? "Next token from the response"
              : t < 15500
                ? "Step 2 · logits + KV"
                : t < 16600
                  ? "Next token from the response"
                  : t < 17600
                    ? "Step 3 · logits + KV"
                    : "Hidden + KV differ from rollout",
      );
      for (const id of [
        "rt-commit-prefix",
        "rt-committed-1",
        "rt-committed-2",
        "rt-committed-3",
      ])
        el(id).classList.remove("rt-source-selected");
      if (tfReady)
        el(
          tf === 1 ? "rt-commit-prefix" : `rt-committed-${tf - 1}`,
        ).classList.add("rt-source-selected");
      for (const id of ["rt-packet", "rt-token-packet", "rt-kv-packet"])
        show(id, 0);
      for (const id of [
        "rt-batch",
        "rt-commit-1",
        "rt-commit-2",
        "rt-commit-3",
        "rt-source",
        "rt-kv-write",
        "rt-store",
      ])
        show(id, 0);
      const fb =
        upperActive && (inside(u, 1250, 1650) || inside(u, 2850, 3250));
      show("rt-roll-loop", fb ? 1 : 0.24);
      el("rt-roll-loop").classList.toggle("rt-flow", fb);
      const tfb = inside(t, 13950, 14500) || inside(t, 16000, 16600);
      show("rt-tf-loop", tfb ? 1 : 0.2);
      el("rt-tf-loop").classList.toggle("rt-flow", tfb);

      el("rt-tf-loop").classList.toggle("rt-hidden-mismatch", t >= 13950);

      if (upperActive) {
        const calls = [
          {
            a: 250,
            b: 550,
            c: 800,
            d: 1000,
            h: `h₀${prime}`,
            tok: cycle === 1 ? "yₜ" : "d̃₁₁",
            k: 1,
          },
          {
            a: 1850,
            b: 2150,
            c: 2400,
            d: 2600,
            h: `h₁${prime}`,
            tok: `d${cycle === 1 ? "₁" : "₂"}₁`,
            k: 2,
          },
          {
            a: 3450,
            b: 3750,
            c: 4000,
            d: 4200,
            h: `h₂${prime}`,
            tok: `d${cycle === 1 ? "₁" : "₂"}₂`,
            k: 3,
          },
        ];
        calls.forEach((c) => {
          packet(
            "rt-packet",
            "rt-roll-in",
            `${c.h} · ${c.tok}`,
            c.k === 1 ? "target" : "head",
            u,
            c.a,
            c.b,
          );
          packet(
            "rt-packet",
            "rt-roll-out",
            `h${["", "₁", "₂", "₃"][c.k]}${prime} · d${cycle === 1 ? "₁" : "₂"}${["", "₁", "₂", "₃"][c.k]}`,
            "head",
            u,
            c.c,
            c.d,
          );
        });
        packet(
          "rt-packet",
          "rt-roll-loop",
          `h₁${prime} · d${cycle === 1 ? "₁" : "₂"}₁`,
          "head",
          u,
          1250,
          1650,
        );
        packet(
          "rt-packet",
          "rt-roll-loop",
          `h₂${prime} · d${cycle === 1 ? "₁" : "₂"}₂`,
          "head",
          u,
          2850,
          3250,
        );
        for (const [i, a, b] of [
          [1, 1000, 1150],
          [2, 2600, 2750],
          [3, 4200, 4350],
        ])
          if (inside(u, a, b)) {
            path(
              "rt-store",
              `M${g.output + g.portW / 4} ${g.ry}C${g.output + g.portW / 4} ${g.draftY - 28} ${g.drafts[i - 1]} ${g.draftY - 35} ${g.drafts[i - 1]} ${g.draftY}`,
            );
            packet(
              "rt-token-packet",
              "rt-store",
              `d${cycle === 1 ? "₁" : "₂"}${["", "₁", "₂", "₃"][i]}`,
              "head",
              u,
              a,
              b,
            );
            show("rt-store", 0.65);
          }
        if (inside(u, 4500, 4850)) {
          show("rt-batch", 1);
          packet("rt-packet", "rt-batch", "3 drafts", "target", u, 4500, 4850);
        }
      }
      if (inside(t, 5400, 5800)) {
        show("rt-commit-1", 0.7);
        packet(
          "rt-token-packet",
          "rt-commit-1",
          "d̃₁₁",
          "replace",
          t,
          5400,
          5800,
        );
      }
      if (inside(t, 11300, 11700)) {
        show("rt-commit-2", 0.7);
        packet(
          "rt-token-packet",
          "rt-commit-2",
          "d₂₁",
          "head",
          t,
          11300,
          11700,
        );
      }
      if (inside(t, 11700, 12100)) {
        show("rt-commit-3", 0.7);
        packet(
          "rt-token-packet",
          "rt-commit-3",
          "d̃₂₂",
          "replace",
          t,
          11700,
          12100,
        );
      }
      const trainingCalls = [
        {
          i: 1,
          sourceA: 12400,
          sourceB: 12800,
          inA: 12800,
          inB: 13000,
          outA: 13200,
          outB: 13600,
          h: "h₀",
          tok: "yₜ",
        },
        {
          i: 2,
          sourceA: 14000,
          sourceB: 14500,
          inA: 14700,
          inB: 14900,
          outA: 15100,
          outB: 15500,
          h: "h₁ᵀ",
          tok: "d̃₁₁",
        },
        {
          i: 3,
          sourceA: 16000,
          sourceB: 16600,
          inA: 16800,
          inB: 17000,
          outA: 17200,
          outB: 17600,
          h: "h₂ᵀ",
          tok: "d₂₁",
        },
      ];
      trainingCalls.forEach((c) => {
        if (inside(t, c.sourceA, c.sourceB)) {
          sourcePath(c.i - 1);
          show("rt-source", 0.75);
          packet(
            "rt-token-packet",
            "rt-source",
            c.tok,
            c.i === 2 ? "replace" : "target",
            t,
            c.sourceA,
            c.sourceB,
          );
        }
        packet(
          "rt-packet",
          "rt-tf-in",
          `${c.h} · ${c.tok}`,
          c.i === 1 ? "target" : "hidden-error",
          t,
          c.inA,
          c.inB,
        );
        packet(
          "rt-packet",
          "rt-tf-out",
          `h${["", "₁", "₂", "₃"][c.i]}ᵀ · q${["", "₁", "₂", "₃"][c.i]}`,
          c.i === 1 ? "head" : "hidden-error",
          t,
          c.outA,
          c.outB,
        );
        if (inside(t, c.outA, c.outB)) {
          cachePath(c.i);
          show("rt-kv-write", 0.75);
          packet(
            "rt-kv-packet",
            "rt-kv-write",
            "KV",
            c.i === 1 ? "target" : "error",
            t,
            c.outA,
            c.outB,
          );
        }
      });
      packet("rt-packet", "rt-tf-loop", "h₁ᵀ", "error", t, 13950, 14500);
      packet("rt-packet", "rt-tf-loop", "h₂ᵀ", "error", t, 16000, 16600);
      let caption, phase;
      if (t < 4900) {
        caption = "Rollout: draft three tokens with the same head.";
        phase = "rollout-1";
      } else if (t < 6100) {
        caption = "Reject d₁₁; commit its replacement d̃₁₁.";
        phase = "commit-1";
      } else if (t < 11000) {
        caption = "A new cycle starts from the updated target prefix.";
        phase = "rollout-2";
      } else if (t < 12400) {
        caption =
          "Commit d₂₁ and d̃₂₂. This sequence becomes the training data.";
        phase = "commit-2";
      } else if (t < 14500) {
        caption =
          "The first forward shares the rollout’s starting hidden state and KV.";
        phase = "teacher-1";
      } else if (t < 16600) {
        caption =
          "Teacher forcing reuses h₁ᵀ where rollout restarts from h₀′. Hidden and KV diverge.";
        phase = "teacher-2";
      } else {
        caption =
          "The mismatch carries forward: later hidden states and KV stay red.";
        phase = "teacher-3";
      }
      if (lastStage !== phase) {
        lastStage = phase;
        root.dataset.phase = phase;
        txt("rt-caption", caption);
      }
      root.dataset.elapsed = String(Math.round(t));
      root.dataset.cycle = String(cycle);
      root.dataset.teacherStep = String(tf);
      root.dataset.kvErrors = String(writes.slice(1).filter(Boolean).length);
      const seconds = (t / 1000).toFixed(1);
      el("rt-progress").value = String(Math.round(t));
      el("rt-progress").style.setProperty(
        "--rt-progress",
        `${(t / duration) * 100}%`,
      );
      set("rt-progress", "aria-valuetext", `${seconds} of 22.4 seconds`);
      txt("rt-time", `${seconds} / 22.4 s`);
    }
    function inView() {
      const r = root.getBoundingClientRect();
      return r.top < innerHeight && r.bottom > 0;
    }
    function controls() {
      root.dataset.playing = String(playing);
      el("rt-play").setAttribute(
        "aria-label",
        wantsPlay ? "Pause animation" : "Play animation",
      );
      txt("rt-play-label", wantsPlay ? "Pause" : "Play");
      set(
        "rt-play-icon",
        "d",
        wantsPlay ? "M5 4h3v12H5ZM12 4h3v12h-3Z" : "m7 4 9 6-9 6Z",
      );
    }
    function tick() {
      const now = performance.now(),
        active = wantsPlay && !seeking && inView() && !document.hidden;
      if (active) {
        time = (time + Math.min(now - last, 200) * speed) % duration;
        render(time);
      }
      last = now;
      if (active !== playing) {
        playing = active;
        controls();
      }
    }
    el("rt-play").addEventListener("click", () => {
      wantsPlay = !wantsPlay;
      last = performance.now();
      playing = wantsPlay && inView() && !document.hidden;
      controls();
    });
    el("rt-speed").addEventListener("change", () => {
      tick();
      speed = Number(el("rt-speed").value);
      root.dataset.speed = String(speed);
      last = performance.now();
    });
    el("rt-progress").addEventListener("pointerdown", (event) => {
      if (event.button !== 0) return;
      seeking = true;
      playing = false;
      controls();
    });
    el("rt-progress").addEventListener("input", () => {
      time = Math.max(0, Math.min(duration, Number(el("rt-progress").value)));

      if (!seeking) wantsPlay = false;
      playing = false;
      last = performance.now();
      render(time);
      controls();
    });
    function finishSeek() {
      if (!seeking) return;
      seeking = false;
      last = performance.now();
      playing = wantsPlay && inView() && !document.hidden;
      controls();
    }
    addEventListener("pointerup", finishSeek);
    addEventListener("pointercancel", finishSeek);
    el("rt-progress").addEventListener("change", finishSeek);
    el("rt-progress").addEventListener("blur", finishSeek);
    el("rt-replay").addEventListener("click", () => {
      time = 0;
      lastStage = "";
      wantsPlay = true;
      last = performance.now();
      render(time);
      playing = inView() && !document.hidden;
      controls();
    });
    el("rt-next").addEventListener("click", () => {
      wantsPlay = false;
      time = stops.find((x) => x > time + 100) ?? 0;
      render(time);
      last = performance.now();
      playing = false;
      controls();
    });
    small.addEventListener("change", layout);
    reduced.addEventListener("change", () => render(time));
    addEventListener("scroll", tick, { passive: true });
    addEventListener("resize", tick, { passive: true });
    document.addEventListener("visibilitychange", () => {
      last = performance.now();
      tick();
    });
    addEventListener("pagehide", () => {
      clearInterval(timer);
      timer = null;
    });
    addEventListener("pageshow", () => {
      last = performance.now();
      if (timer === null) timer = setInterval(tick, 40);
      tick();
    });
    layout();
    root.dataset.ready = "true";
    root.dataset.speed = String(speed);
    tick();
    controls();
    timer = setInterval(tick, 40);
  }
  if (document.readyState === "loading")
    document.addEventListener("DOMContentLoaded", initialize, { once: true });
  else initialize();
})();
