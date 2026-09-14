
(() => {
  "use strict";
  function initialize() {
    const root = document.getElementById("reconstruction-demo");
    if (!root?.classList.contains("rr-figure")) return;
    const memo = new Map();
    const el = (id) => {
      if (!memo.has(id)) memo.set(id, root.querySelector(`#${id}`));
      return memo.get(id);
    };
    const set = (id, key, value) => el(id).setAttribute(key, String(value));
    const txt = (id, value) => {
      if (el(id).textContent !== value) el(id).textContent = value;
    };
    const show = (id, value) => set(id, "opacity", value);
    const move = (id, x, y) => set(id, "transform", `translate(${x} ${y})`);
    const inside = (t, a, b) => t >= a && t <= b;
    const smooth = (x) => {
      x = Math.max(0, Math.min(1, x));
      return x * x * (3 - 2 * x);
    };
    const small = matchMedia("(max-width:560px)");
    const reduced = matchMedia("(prefers-reduced-motion:reduce)");
    const duration = 27000;
    const reconstructionStart = 12400;
    const cycleSpan = 6200;
    const stops = [
      1050, 2650, 4250, 5850, 7150, 8750, 10350, 12150, 13850, 15350, 16850,
      18900, 20050, 21550, 23050,
    ];
    const cycles = [
      {
        h: "h₀",
        token: "yₜ",
        hidden: ["h₁", "h₂", "h₃"],
        drafts: ["d₁₁", "d₁₂", "d₁₃"],
        q: ["q₁₁", "q₁₂", "q₁₃"],
        p: ["p₁₁", "p₁₂", "p₁₃"],
        rejection: 1,
      },
      {
        h: "h₀′",
        token: "d̃₁₁",
        hidden: ["h₁′", "h₂′", "h₃′"],
        drafts: ["d₂₁", "d₂₂", "d₂₃"],
        q: ["q₂₁", "q₂₂", "q₂₃"],
        p: ["p₂₁", "p₂₂", "p₂₃"],
        rejection: 2,
      },
    ];
    let time = 0,
      speed = 1,
      seeking = false,
      wantsPlay = true,
      playing = false,
      last = performance.now(),
      timer = null,
      g,
      lastStage = "";
    const lengths = new Map();

    function path(id, d) {
      if (el(id).getAttribute("d") !== d) {
        set(id, "d", d);
        lengths.set(id, el(id).getTotalLength());
      }
    }
    function reshape(id, w, h) {
      const r = el(id).querySelector("rect");
      for (const [key, value] of Object.entries({
        x: -w / 2,
        y: -h / 2,
        width: w,
        height: h,
      }))
        r.setAttribute(key, value);
    }
    function layout() {
      g = small.matches
        ? {
            w: 520,
            h: 840,
            input: 76,
            head: 250,
            output: 435,
            portW: 86,
            headW: 94,
            ry: 105,
            ty: 595,
            rollKV: 197,
            tfKV: 750,
            prefixX: 75,
            kv: [164, 266, 368],
            rollKv: [164, 232, 300],
            drafts: [115, 185, 255],
            draftY: 268,
            targetX: 430,
            targetW: 110,
            recordTop: 330,
            recordH: 158,
            recordRows: [385, 447],
            recordName: 31,
            boundaryX: 156,
            boundaryW: 116,
            recordDrafts: [296, 370, 444],
            tfTitleY: 524,
            logits: [165, 270, 375],
            logitsY: 691,
            loopLeft: 32,
            loopRight: 488,
            rollLoopY: 38,
            tfLoopY: 804,
          }
        : {
            w: 900,
            h: 676,
            input: 125,
            head: 360,
            output: 600,
            portW: 140,
            headW: 110,
            ry: 116,
            ty: 509,
            rollKV: 214,
            tfKV: 600,
            prefixX: 158,
            kv: [240, 314, 388],
            rollKv: [240, 314, 388],
            drafts: [532, 590, 648],
            draftY: 214,
            targetX: 800,
            targetW: 118,
            recordTop: 270,
            recordH: 148,
            recordRows: [323, 382],
            recordName: 44,
            boundaryX: 215,
            boundaryW: 128,
            recordDrafts: [407, 537, 667],
            tfTitleY: 449,
            logits: [595, 681, 767],
            logitsY: 600,
            loopLeft: 35,
            loopRight: 700,
            rollLoopY: 46,
            tfLoopY: 650,
          };
      set("rr-canvas", "viewBox", `0 0 ${g.w} ${g.h}`);
      for (const [id, y] of [
        ["rr-roll-input", g.ry],
        ["rr-roll-output", g.ry],
        ["rr-tf-input", g.ty],
        ["rr-tf-output", g.ty],
      ]) {
        const x = id.endsWith("input") ? g.input : g.output;
        move(id, x, y);
        const group = el(id),
          rects = group.querySelectorAll("rect");
        rects[0].setAttribute("x", -g.portW / 2);
        rects[0].setAttribute("width", g.portW / 2 - 3);
        rects[1].setAttribute("x", 3);
        rects[1].setAttribute("width", g.portW / 2 - 3);
        group
          .querySelector('[data-field="h"]')
          .setAttribute("x", -g.portW / 4 - 1.5);
        group
          .querySelector('[data-field="d"]')
          .setAttribute("x", g.portW / 4 + 1.5);
        const captions = group.querySelectorAll(".rr-field-caption");
        captions[0].setAttribute("x", -g.portW / 4 - 1.5);
        captions[1].setAttribute("x", g.portW / 4 + 1.5);
        set(`${id}-label`, "x", x);
        set(`${id}-label`, "y", y - 36);
      }
      for (const [id, y] of [
        ["rr-roll-head", g.ry],
        ["rr-tf-head", g.ty],
      ]) {
        move(id, g.head, y);
        reshape(id, g.headW, 78);
      }
      set("rr-roll-step", "x", g.w - 28);
      set("rr-tf-step", "x", g.w - 28);
      set("rr-tf-step", "y", g.tfTitleY);
      set("rr-tf-title", "y", g.tfTitleY);
      for (const [id, x, y] of [
        ["rr-roll-kv-label", small.matches ? 31 : 112, g.rollKV + 5],
        ["rr-tf-kv-label", small.matches ? 31 : 112, g.tfKV + 5],
        ["rr-drafts-label", small.matches ? 61 : 485, g.draftY + 5],
        ["rr-logits-label", small.matches ? 89 : 540, g.logitsY + 5],
      ]) {
        set(id, "x", x);
        set(id, "y", y);
      }
      txt("rr-tf-kv-label", small.matches ? "KV" : "KV writes");
      txt("rr-logits-label", small.matches ? "Loss" : "Loss pairs");
      move("rr-roll-prefix", g.prefixX, g.rollKV);
      move("rr-tf-prefix", g.prefixX, g.tfKV);
      for (let k = 1; k <= 3; k++) {
        move(`rr-roll-kv-${k}`, g.rollKv[k - 1], g.rollKV);
        move(`rr-tf-kv-${k}`, g.kv[k - 1], g.tfKV);
        move(`rr-draft-${k}`, g.drafts[k - 1], g.draftY);
        move(`rr-logit-${k}`, g.logits[k - 1], g.logitsY);
      }
      move("rr-target", g.targetX, g.draftY);
      reshape("rr-target", g.targetW, 60);
      for (const [key, value] of Object.entries({
        x: small.matches ? 16 : 24,
        y: g.recordTop,
        width: g.w - (small.matches ? 32 : 48),
        height: g.recordH,
      }))
        set("rr-record-bg", key, value);
      set("rr-records-title", "x", small.matches ? 29 : 44);
      set("rr-records-title", "y", g.recordTop + 23);
      for (let r = 1; r <= 2; r++) {
        const y = g.recordRows[r - 1];
        set(`rr-record-name-${r}`, "x", g.recordName);
        set(`rr-record-name-${r}`, "y", y + 5);
        move(`rr-boundary-${r}`, g.boundaryX, y);
        reshape(`rr-boundary-${r}`, g.boundaryW, 34);
        for (let k = 1; k <= 3; k++)
          move(`rr-record-${r}-${k}`, g.recordDrafts[k - 1], y);
        path(
          `rr-record-link-${r}`,
          `M${g.boundaryX + g.boundaryW / 2 + 8} ${y}H${g.recordDrafts[0] - 36}`,
        );
      }
      path("rr-roll-in", `M${g.input} ${g.ry}H${g.head - g.headW / 2}`);
      path("rr-roll-out", `M${g.head + g.headW / 2} ${g.ry}H${g.output}`);
      path(
        "rr-roll-loop",
        `M${g.output} ${g.ry}H${g.loopRight - 18}Q${g.loopRight} ${g.ry} ${g.loopRight} ${g.ry - 18}V${g.rollLoopY + 18}Q${g.loopRight} ${g.rollLoopY} ${g.loopRight - 18} ${g.rollLoopY}H${g.loopLeft + 18}Q${g.loopLeft} ${g.rollLoopY} ${g.loopLeft} ${g.rollLoopY + 18}V${g.ry - 18}Q${g.loopLeft} ${g.ry} ${g.loopLeft + 18} ${g.ry}H${g.input}`,
      );
      path(
        "rr-batch",
        `M${g.drafts[2] + 23} ${g.draftY}H${g.targetX - g.targetW / 2}`,
      );
      path("rr-tf-in", `M${g.input} ${g.ty}H${g.head - g.headW / 2}`);
      path("rr-tf-out", `M${g.head + g.headW / 2} ${g.ty}H${g.output}`);
      path(
        "rr-tf-loop",
        `M${g.output - g.portW / 4} ${g.ty}H${g.loopRight - 18}Q${g.loopRight} ${g.ty} ${g.loopRight} ${g.ty + 18}V${g.tfLoopY - 18}Q${g.loopRight} ${g.tfLoopY} ${g.loopRight - 18} ${g.tfLoopY}H${g.loopLeft + 18}Q${g.loopLeft} ${g.tfLoopY} ${g.loopLeft} ${g.tfLoopY - 18}V${g.ty + 18}Q${g.loopLeft} ${g.ty} ${g.loopLeft + 18} ${g.ty}H${g.input - g.portW / 4}`,
      );
      render(time);
    }
    function bundle(id, h, d, origin = "head") {
      const e = el(id);
      e.querySelector('[data-field="h"]').textContent = h;
      e.querySelector('[data-field="d"]').textContent = d;
      e.setAttribute("data-origin", origin);
      e.setAttribute("data-token", d.includes("̃") ? "replacement" : "normal");
    }
    function tile(id, label, index, written, reference = false) {
      const e = el(id);
      e.querySelector("text").textContent = written ? label : "—";
      e.setAttribute(
        "class",
        `rr-tile rr-kv-${index === 0 ? "target" : "draft"}${written ? " rr-written" : ""}${reference ? " rr-kv-reference" : ""}`,
      );
    }
    function packet(id, route, value, kind, t, a, b) {
      if (!inside(t, a, b) || reduced.matches) return;
      const point = el(route).getPointAtLength(
        lengths.get(route) * smooth((t - a) / (b - a)),
      );
      move(id, point.x, point.y);
      show(id, 1);
      set(
        id,
        "class",
        `rr-packet ${kind === "target" ? "rr-target-data" : ""}`,
      );
      el(id).querySelector("text").textContent = value;
      reshape(
        id,
        Math.max(42, Math.min(118, [...value].length * 7 + 20)),
        small.matches ? 24 : 32,
      );
    }
    function sourcePath(r, k) {
      const sx = k === 0 ? g.boundaryX : g.recordDrafts[k - 1],
        sy = g.recordRows[r] + 17;
      const dx = k === 0 ? g.input : g.input + g.portW / 4 + 1.5,
        mid = g.ty - 45;
      path(
        "rr-source",
        `M${sx} ${sy}V${mid - 14}Q${sx} ${mid} ${sx - 14} ${mid}H${dx + 14}Q${dx} ${mid} ${dx} ${mid + 14}V${g.ty}`,
      );
      set(
        "rr-source",
        "class",
        `rr-wire ${k === 0 ? "rr-blue-wire" : "rr-green-wire"}`,
      );
    }
    function render(t) {
      const training = t >= reconstructionStart;
      const recCycle = training
        ? Math.min(1, Math.floor((t - reconstructionStart) / cycleSpan))
        : 0;
      const v = training
        ? Math.min(cycleSpan, t - reconstructionStart - recCycle * cycleSpan)
        : 0;
      const recStep = v < 2000 ? 1 : v < 3500 ? 2 : 3;
      const written = v >= 4350 ? 3 : v >= 2850 ? 2 : v >= 1350 ? 1 : 0;
      const r = training ? recCycle : t < 6100 ? 0 : 1;
      const c = cycles[r];
      const u = training
        ? [1050, 2650, 4250][recStep - 1]
        : Math.min(6100, t - r * 6100);
      const index = u < 1650 ? 0 : u < 3250 ? 1 : 2;
      const inputH = index === 0 ? c.h : c.hidden[index - 1];
      const inputToken = index === 0 ? c.token : c.drafts[index - 1];
      bundle(
        "rr-roll-input",
        inputH,
        inputToken,
        index === 0 ? "target" : "head",
      );
      let result = u >= 4200 ? 3 : u >= 2600 ? 2 : u >= 1000 ? 1 : 0;
      if (inside(u, 1800, 2599) || inside(u, 3400, 4199)) result = 0;
      bundle(
        "rr-roll-output",
        result ? c.hidden[result - 1] : "—",
        result ? c.drafts[result - 1] : "—",
      );
      const count = training
        ? 3
        : u >= 4350
          ? 3
          : u >= 2750
            ? 2
            : u >= 1150
              ? 1
              : 0;
      const verified = training || u >= 4900,
        decided = training || u >= 5150;
      for (let k = 1; k <= 3; k++) {
        const draft = el(`rr-draft-${k}`),
          accepted = decided && k < c.rejection,
          rejected = decided && k === c.rejection,
          discarded = decided && k > c.rejection;
        draft.querySelector(".rr-value").textContent =
          k <= count ? c.drafts[k - 1] : "—";
        draft.querySelector(".rr-verdict").textContent = accepted
          ? "✓"
          : rejected
            ? "×"
            : discarded
              ? "—"
              : "";
        draft.querySelector(".rr-probability").textContent = verified
          ? c.p[k - 1]
          : "";
        set(
          `rr-draft-${k}`,
          "class",
          `rr-draft ${k <= count ? "rr-produced" : ""} ${rejected ? "rr-rejected" : ""} ${discarded ? "rr-discarded" : ""}`,
        );
      }
      const cached = u >= 4200 ? 3 : u >= 2600 ? 2 : u >= 1000 ? 1 : 0;
      const cacheTokens = [c.token, ...c.drafts.slice(0, 2)];
      cacheTokens.forEach((label, k) =>
        tile(
          `rr-roll-kv-${k + 1}`,
          label,
          k,
          k < cached,
          training && written === k + 1,
        ),
      );
      txt(
        "rr-roll-step",
        training
          ? `Cycle ${r + 1} · reference ${recStep} / 3`
          : u < 4500
            ? `Cycle ${r + 1} · draft ${u < 1800 ? 1 : u < 3400 ? 2 : 3} / 3`
            : u < 5150
              ? `Cycle ${r + 1} · verify`
              : `Cycle ${r + 1} · record`,
      );
      txt(
        "rr-target-action",
        training
          ? "recorded logits"
          : u < 4500
            ? "wait for drafts"
            : u < 5150
              ? "verify K = 3"
              : r === 0
                ? "commit d̃₁₁"
                : "replace d₂₂",
      );
      el("rr-target").classList.toggle(
        "rr-target-active",
        !training && u >= 4500,
      );
      el("rr-roll-head").classList.toggle(
        "rr-computing",
        !training &&
          [
            [550, 850],
            [2150, 2450],
            [3750, 4050],
          ].some(([a, b]) => inside(u, a, b)),
      );

      for (let record = 0; record < 2; record++) {
        const elapsed = t - record * 6100,
          data = cycles[record];
        el(`rr-boundary-${record + 1}`).querySelector("text").textContent =
          elapsed >= 250 ? `${data.h} · ${data.token}` : "—";
        set(`rr-record-cycle-${record + 1}`, "data-active", record === r);
        el(`rr-boundary-${record + 1}`).classList.toggle(
          "rr-record-source",
          training && record === recCycle && recStep === 1,
        );
        for (let k = 1; k <= 3; k++) {
          const ready = elapsed >= [1550, 3150, 4700][k - 1],
            saved = elapsed >= 5150;
          const cell = el(`rr-record-${record + 1}-${k}`);
          cell.querySelector(".rr-value").textContent = ready
            ? data.drafts[k - 1]
            : "—";
          cell.querySelector(".rr-probability").textContent = saved
            ? data.p[k - 1]
            : "";
          cell.querySelector(".rr-record-verdict").textContent =
            saved && k === data.rejection ? "×" : "";
          set(
            `rr-record-${record + 1}-${k}`,
            "class",
            `rr-record-draft ${ready ? "rr-recorded" : ""} ${saved && k === data.rejection ? "rr-record-rejected" : ""} ${training && record === recCycle && recStep === k + 1 ? "rr-record-source" : ""}`,
          );
        }
      }

      const rc = cycles[recCycle],
        recInput = recStep === 1 ? rc.token : rc.drafts[recStep - 2];
      const recH = recStep === 1 ? rc.h : rc.hidden[recStep - 2];
      bundle(
        "rr-tf-input",
        training ? recH : "—",
        training ? recInput : "—",
        recStep === 1 ? "target" : "head",
      );
      const outputReady = training && written === recStep;
      bundle(
        "rr-tf-output",
        outputReady ? rc.hidden[written - 1] : "—",
        outputReady ? rc.q[written - 1] : "—",
      );
      el("rr-tf-output").classList.toggle("rr-matched", outputReady);
      el("rr-tf-prefix").classList.toggle(
        "rr-prefix-restoring",
        training && v < 900,
      );
      [rc.token, ...rc.drafts.slice(0, 2)].forEach((label, k) =>
        tile(`rr-tf-kv-${k + 1}`, label, k, training && k < written),
      );
      for (let k = 1; k <= 3; k++) {
        const pair = el(`rr-logit-${k}`),
          masked = k > rc.rejection;
        pair.querySelector(".rr-q-value").textContent = rc.q[k - 1];
        pair.querySelector(".rr-p-value").textContent = rc.p[k - 1];
        pair.querySelector(".rr-pair-mark").textContent = masked ? "×" : "↔";
        pair.classList.toggle("rr-masked", masked);
        pair.dataset.included = String(!masked);
        show(`rr-logit-${k}`, training && k <= written ? 1 : 0);
      }
      el("rr-tf-head").classList.toggle(
        "rr-computing",
        training &&
          [
            [700, 1050],
            [2200, 2550],
            [3850, 4100],
          ].some(([a, b]) => inside(v, a, b)),
      );
      txt(
        "rr-tf-step",
        !training
          ? "Uses the recorded cycles"
          : v < 800
            ? `Cycle ${recCycle + 1} · restore prefix`
            : v >= 4350
              ? "Hidden + KV match ✓"
              : `Cycle ${recCycle + 1} · step ${recStep} / 3`,
      );

      for (const id of [
        "rr-packet",
        "rr-token-packet",
        "rr-kv-packet",
        "rr-source",
        "rr-kv-write",
        "rr-store",
        "rr-record-store",
        "rr-batch",
      ])
        show(id, 0);
      const rollFeedback =
        !training && (inside(u, 1250, 1650) || inside(u, 2850, 3250));
      const recFeedback =
        training && (inside(v, 1550, 2000) || inside(v, 3050, 3500));
      show("rr-roll-loop", rollFeedback ? 1 : 0.24);
      el("rr-roll-loop").classList.toggle("rr-flow", rollFeedback);
      show("rr-tf-loop", recFeedback ? 1 : 0.2);
      el("rr-tf-loop").classList.toggle("rr-flow", recFeedback);
      if (!training) {
        for (let k = 1; k <= 3; k++) {
          const offset = (k - 1) * 1600,
            h = k === 1 ? c.h : c.hidden[k - 2],
            token = k === 1 ? c.token : c.drafts[k - 2];
          packet(
            "rr-packet",
            "rr-roll-in",
            `${h} · ${token}`,
            k === 1 ? "target" : "head",
            u,
            250 + offset,
            550 + offset,
          );
          packet(
            "rr-packet",
            "rr-roll-out",
            `${c.hidden[k - 1]} · ${c.drafts[k - 1]}`,
            "head",
            u,
            800 + offset,
            1000 + offset,
          );
          if (inside(u, 1000 + offset, 1150 + offset)) {
            path(
              "rr-store",
              `M${g.output + g.portW / 4} ${g.ry}C${g.output + g.portW / 4} ${g.draftY - 28} ${g.drafts[k - 1]} ${g.draftY - 35} ${g.drafts[k - 1]} ${g.draftY}`,
            );
            show("rr-store", 0.65);
            packet(
              "rr-token-packet",
              "rr-store",
              c.drafts[k - 1],
              "head",
              u,
              1000 + offset,
              1150 + offset,
            );
          }
          const a = [1300, 2900, 4450][k - 1],
            b = [1550, 3150, 4700][k - 1];
          if (inside(u, a, b)) {
            path(
              "rr-record-store",
              `M${g.drafts[k - 1]} ${g.draftY + 17}C${g.drafts[k - 1]} ${g.draftY + 45} ${g.recordDrafts[k - 1]} ${g.recordRows[r] - 50} ${g.recordDrafts[k - 1]} ${g.recordRows[r]}`,
            );
            show("rr-record-store", 0.55);
            packet(
              "rr-token-packet",
              "rr-record-store",
              c.drafts[k - 1],
              "head",
              u,
              a,
              b,
            );
          }
        }
        packet(
          "rr-packet",
          "rr-roll-loop",
          `${c.hidden[0]} · ${c.drafts[0]}`,
          "head",
          u,
          1250,
          1650,
        );
        packet(
          "rr-packet",
          "rr-roll-loop",
          `${c.hidden[1]} · ${c.drafts[1]}`,
          "head",
          u,
          2850,
          3250,
        );
        if (inside(u, 4500, 4850)) {
          show("rr-batch", 1);
          packet("rr-packet", "rr-batch", "3 drafts", "target", u, 4500, 4850);
        }
      }
      if (training) {
        const calls = [
          {
            k: 1,
            sourceA: 0,
            sourceB: 450,
            inA: 500,
            inB: 750,
            outA: 1000,
            outB: 1350,
          },
          {
            k: 2,
            sourceA: 1550,
            sourceB: 2000,
            inA: 2050,
            inB: 2300,
            outA: 2550,
            outB: 2850,
          },
          {
            k: 3,
            sourceA: 3050,
            sourceB: 3500,
            inA: 3550,
            inB: 3800,
            outA: 4000,
            outB: 4350,
          },
        ];
        for (const call of calls) {
          const { k } = call,
            h = k === 1 ? rc.h : rc.hidden[k - 2],
            token = k === 1 ? rc.token : rc.drafts[k - 2];
          if (inside(v, call.sourceA, call.sourceB)) {
            sourcePath(recCycle, k - 1);
            show("rr-source", 0.75);
            packet(
              "rr-token-packet",
              "rr-source",
              k === 1 ? `${h} · ${token}` : token,
              k === 1 ? "target" : "head",
              v,
              call.sourceA,
              call.sourceB,
            );
          }
          packet(
            "rr-packet",
            "rr-tf-in",
            `${h} · ${token}`,
            k === 1 ? "target" : "head",
            v,
            call.inA,
            call.inB,
          );
          packet(
            "rr-packet",
            "rr-tf-out",
            `${rc.hidden[k - 1]} · ${rc.q[k - 1]}`,
            "head",
            v,
            call.outA,
            call.outB,
          );
          if (inside(v, call.outA, call.outB)) {
            const x = g.kv[k - 1];
            path(
              "rr-kv-write",
              `M${g.head} ${g.ty + 39}C${g.head} ${g.ty + 75} ${x} ${g.tfKV - 40} ${x} ${g.tfKV}`,
            );
            show("rr-kv-write", 0.75);
            set(
              "rr-kv-write",
              "class",
              `rr-wire ${k === 1 ? "rr-blue-wire" : "rr-green-wire"}`,
            );
            packet(
              "rr-kv-packet",
              "rr-kv-write",
              "KV",
              k === 1 ? "target" : "head",
              v,
              call.outA,
              call.outB,
            );
          }
        }
        packet("rr-packet", "rr-tf-loop", rc.hidden[0], "head", v, 1550, 2000);
        packet("rr-packet", "rr-tf-loop", rc.hidden[1], "head", v, 3050, 3500);
      }
      let phase, caption;
      if (!training) {
        phase = `rollout-${r + 1}`;
        caption =
          r === 0
            ? "Record the boundary, draft tokens, and verification signals."
            : "The next rollout cycle records its own target boundary.";
      } else if (v < 900) {
        phase = `restore-${recCycle + 1}`;
        caption = `Restore cycle ${recCycle + 1}’s target boundary and rebuild its prefix KV.`;
      } else if (v < 2000) {
        phase = `reconstruct-${recCycle + 1}-1`;
        caption =
          "The recorded boundary produces the same first-step computation.";
      } else if (v < 3500) {
        phase = `reconstruct-${recCycle + 1}-2`;
        caption = `Feed back recorded ${rc.drafts[0]}; recompute hidden, logits, and KV.`;
      } else if (v < 4350) {
        phase = `reconstruct-${recCycle + 1}-3`;
        caption = `Continue with recorded ${rc.drafts[1]}, preserving the original draft path.`;
      } else {
        phase = `matched-${recCycle + 1}`;
        caption =
          recCycle === 0
            ? "The draft path matches. VGM masks loss pairs after the first rejection."
            : "Both cycles are reconstructed. Hidden, KV, and verification contexts align.";
      }
      if (phase !== lastStage) {
        lastStage = phase;
        root.dataset.phase = phase;
        txt("rr-caption", caption);
      }
      root.dataset.elapsed = String(Math.round(t));
      root.dataset.cycle = String(r + 1);
      root.dataset.reconstructionStep = String(training ? recStep : 0);
      root.dataset.reconstructed = String(training ? written : 0);
      const seconds = (t / 1000).toFixed(1);
      el("rr-progress").value = String(Math.round(t));
      el("rr-progress").style.setProperty(
        "--rr-progress",
        `${(t / duration) * 100}%`,
      );
      set("rr-progress", "aria-valuetext", `${seconds} of 27.0 seconds`);
      txt("rr-time", `${seconds} / 27.0 s`);
    }
    function inView() {
      const b = root.getBoundingClientRect();
      return b.top < innerHeight && b.bottom > 0;
    }
    function controls() {
      root.dataset.playing = String(playing);
      set(
        "rr-play",
        "aria-label",
        wantsPlay
          ? "Pause reconstruction animation"
          : "Play reconstruction animation",
      );
      txt("rr-play-label", wantsPlay ? "Pause" : "Play");
      set(
        "rr-play-icon",
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
    el("rr-play").addEventListener("click", () => {
      wantsPlay = !wantsPlay;
      last = performance.now();
      playing = wantsPlay && inView() && !document.hidden;
      controls();
    });
    el("rr-replay").addEventListener("click", () => {
      time = 0;
      lastStage = "";
      wantsPlay = true;
      last = performance.now();
      render(time);
      playing = inView() && !document.hidden;
      controls();
    });
    el("rr-next").addEventListener("click", () => {
      wantsPlay = false;
      time = stops.find((x) => x > time + 100) ?? 0;
      render(time);
      last = performance.now();
      playing = false;
      controls();
    });
    el("rr-speed").addEventListener("change", () => {
      tick();
      speed = Number(el("rr-speed").value);
      root.dataset.speed = String(speed);
      last = performance.now();
    });
    el("rr-progress").addEventListener("pointerdown", (event) => {
      if (event.button !== 0) return;
      seeking = true;
      playing = false;
      controls();
    });
    el("rr-progress").addEventListener("input", () => {
      time = Math.max(0, Math.min(duration, Number(el("rr-progress").value)));
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
    el("rr-progress").addEventListener("change", finishSeek);
    el("rr-progress").addEventListener("blur", finishSeek);
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
