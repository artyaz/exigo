import { describe, expect, it } from "vitest";
import { RULES, runArm, runBench } from "./ux-bench-static.mjs";

const planted = `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><title>Planted</title>
<style>
 body{font-family:system-ui;background:#ffffff;color:#111;margin:0;padding:24px}
 .lowcontrast{color:#b9b9b9;background:#ffffff}
 .tiny{width:14px;height:14px;padding:0;font-size:8px}
 .ghost{color:#f2f2f2;background:#ffffff}
</style></head><body>
<h1>Dashboard</h1>
<h4 id="skipped">Recent activity</h4>
<p class="lowcontrast">Filter results by date range</p>
<p class="ghost">Your trial ends in 3 days</p>
<img src="chart.png">
<input type="text" placeholder="Search">
<button class="tiny">x</button>
<div onclick="alert(1)">Open settings</div>
<a href="#">click here</a>
</body></html>`;

const clean = `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><title>Clean</title>
<style>button{min-width:44px;min-height:44px;font-size:16px}</style></head><body>
<main>
<h1>Dashboard</h1>
<h2>Recent activity</h2>
<img src="chart.png" alt="Revenue over the last 30 days">
<label for="q">Search</label><input id="q" type="text">
<button type="button" aria-label="Dismiss notice">Dismiss</button>
<button type="button">Open settings</button>
<a href="/billing">Review your billing details</a>
</main>
</body></html>`;

describe("ux-bench-static rules", () => {
  it("hits every mechanical planted defect and skips perceptual rows", () => {
    const arm = runArm("planted", planted, true);
    expect(arm.pass).toBe(true);
    expect(arm.hits).toBe(6);
    expect(arm.skips).toBe(2);
    const byId = Object.fromEntries(arm.rows.map((r) => [r.id, r.result]));
    expect(byId[1]).toBe("skip");
    expect(byId[2]).toBe("skip");
    expect(byId[3]).toBe("hit");
    expect(byId[4]).toBe("hit");
    expect(byId[5]).toBe("hit");
    expect(byId[6]).toBe("hit");
    expect(byId[7]).toBe("hit");
    expect(byId[8]).toBe("hit");
  });

  it("reports zero false positives on the clean arm", () => {
    const arm = runArm("clean", clean, false);
    expect(arm.pass).toBe(true);
    expect(arm.false_positives).toBe(0);
    expect(arm.hits).toBe(0);
  });

  it("scopes wrapping labels to the current input (CodeRabbit r1)", () => {
    const rule = RULES.find((r) => r.id === 5);
    expect(rule).toBeDefined();
    const html = `<label>ok<input id="a"></label><input id="b" placeholder="orphan">`;
    expect(rule!.detect(html)).toBe("hit");
  });

  it("matches LABEL case-insensitively with word boundaries (CodeRabbit r2)", () => {
    const rule = RULES.find((r) => r.id === 5);
    expect(rule).toBeDefined();
    expect(rule!.detect(`<LABEL FOR="q">Search</LABEL><INPUT ID="q">`)).toBe("miss");
    expect(rule!.detect(`<labelled>nope</labelled><input id="z">`)).toBe("hit");
  });

  it("flags height-only tiny targets and ignores min-width (CodeRabbit r1/r2)", () => {
    const rule = RULES.find((r) => r.id === 6);
    expect(rule).toBeDefined();
    expect(rule!.detect(`<style>.tiny{width:44px;height:14px}</style><button class="tiny">x</button>`)).toBe("hit");
    expect(rule!.detect(`<style>.ok{min-width:12px;width:44px;height:44px}</style><button class="ok">x</button>`)).toBe("miss");
    expect(rule!.detect(`<button style="width:23.5px;height:40px">x</button>`)).toBe("hit");
  });

  it("runBench writes a passing report for the U001 fixtures", () => {
    const report = runBench("agents/ux-review/runs/2026-08-07-U001");
    expect(report.bench_pass).toBe(true);
    expect(report.bench_clean_fp_count).toBe(0);
  });
});
