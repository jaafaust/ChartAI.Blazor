// Cheap static checks of the WGSL shaders and of a few source-level contract points that cannot
// be observed without a GPU. Comments are stripped first, so a comment that mentions an old
// construct does not trip a check.
import { describe, expect, test } from "bun:test";
import fs from "fs";
import path from "path";

const SRC = path.resolve(import.meta.dir, "../../src");

function stripComments(s: string): string {
  return s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:"'`])\/\/.*$/gm, "$1");
}

function read(rel: string): string {
  return stripComments(fs.readFileSync(path.join(SRC, rel), "utf-8").replace(/\r\n?/g, "\n"));
}

function list(dir: string): string[] {
  const out: string[] = [];
  const walk = (d: string) => {
    for (const e of fs.readdirSync(path.join(SRC, d), { withFileTypes: true })) {
      const rel = path.posix.join(d, e.name);
      if (e.isDirectory()) walk(rel);
      else if (e.name.endsWith(".ts")) out.push(rel);
    }
  };
  walk(dir);
  return out.sort();
}

const shaderFiles = list("shaders");
const pluginFiles = list("plugins");

function offenders(files: string[], re: RegExp): string[] {
  const hits: string[] = [];
  for (const f of files) {
    const lines = read(f).split("\n");
    lines.forEach((l, i) => {
      if (re.test(l)) hits.push(`${f}:${i + 1}: ${l.trim()}`);
    });
  }
  return hits;
}

describe("WGSL shaders", () => {
  test("the shader sources are found", () => {
    expect(shaderFiles.length).toBeGreaterThanOrEqual(15);
  });

  test("B2 / K1: no shader reads the shared Uniforms.pointCount", () => {
    expect(offenders(shaderFiles, /\bu\.pointCount\b/)).toEqual([]);
  });

  test("K1: the per-point shaders take their range from SeriesInfo.visibleRange", () => {
    const perPoint = [
      "shaders/line.ts",
      "shaders/box.ts",
      "shaders/candlestick.ts",
      "shaders/scatter.ts",
      "shaders/boids.ts",
      "shaders/experimental/bubble.ts",
      "shaders/experimental/heatmap.ts",
      "shaders/experimental/histogram.ts",
      "shaders/experimental/error-band.ts",
      "shaders/experimental/waterfall.ts",
    ];
    const missing = perPoint.filter((f) => !/\bvisibleRange\b/.test(read(f)));
    expect(missing).toEqual([]);
  });

  test("B6: no early return on an absolute 1e-4 view range", () => {
    expect(offenders(shaderFiles, /if\s*\(.*\w*[Rr]ange\w*\s*<=?\s*(0?\.0001\b|1(\.0)?e-4\b)/)).toEqual([]);
  });

  test("B6: no absolute 1e-4 threshold on a range anywhere (select guards included)", () => {
    expect(offenders(shaderFiles, /\w*[Rr]ange\w*\s*[<>]=?\s*(0?\.0001\b|1(\.0)?e-4\b)/)).toEqual([]);
  });

  // Checked on the assembled WGSL: the 2-D sample index (SAMPLE_INDEX in shaders/shared.ts) is
  // interpolated into each shader, which then has to declare num_workgroups itself.
  test("B11: shaders indexing by id.y derive the row width from num_workgroups", async () => {
    const bad: string[] = [];
    for (const f of shaderFiles) {
      const mod = await import(path.join(SRC, f));
      for (const [name, value] of Object.entries(mod)) {
        if (typeof value !== "string" || !/@compute|@vertex|@fragment/.test(value)) continue;
        if (/\bid\.y\b/.test(value) && !/num_workgroups/.test(value)) bad.push(`${f}:${name}`);
      }
    }
    expect(bad).toEqual([]);
  });

  test("B11: the dead dispatchXCount uniform is gone", () => {
    expect(offenders([...shaderFiles, ...list("charts")], /dispatchXCount/)).toEqual([]);
  });

  test("B12: bar and candlestick compute shaders skip gap samples", () => {
    const gap = /-\s*1(\.0*)?e\+?38/;
    for (const f of ["shaders/box.ts", "shaders/candlestick.ts"]) expect({ file: f, skipsGaps: gap.test(read(f)) }).toEqual({ file: f, skipsGaps: true });
  });
});

describe("TypeScript sources", () => {
  test("C3: the GPU worker is type-checked (no @ts-nocheck)", () => {
    const raw = fs.readFileSync(path.join(SRC, "gpu-worker.ts"), "utf-8");
    expect(raw.includes("@ts-nocheck")).toBe(false);
  });

  test("B1: labels and labels-panel use the one niceTicks from plugins/shared.ts", () => {
    for (const f of ["plugins/labels.ts", "plugins/labels-panel.ts"]) {
      const s = read(f);
      expect({ file: f, ownCopy: /(const|let|function)\s+niceTicks\b/.test(s) }).toEqual({ file: f, ownCopy: false });
      expect({ file: f, usesShared: /import\s*\{[^}]*\bniceTicks\b[^}]*\}\s*from\s*["']\.\/shared(\.ts)?["']/.test(s) }).toEqual({
        file: f,
        usesShared: true,
      });
    }
  });

  test("B16: labels rebases the view on a home change instead of resetting it", () => {
    expect(/\brebaseViewOnHomeChange\b/.test(read("plugins/labels.ts"))).toBe(true);
  });

  test("B5 / K7: plugins commit view changes through ChartManager.commitView, not syncAllViews", () => {
    expect(offenders(pluginFiles, /\bsyncAllViews\s*\(/)).toEqual([]);
    for (const f of ["plugins/zoom.ts", "plugins/experimental/minimap.ts", "plugins/experimental/range-selector.ts"])
      expect({ file: f, commits: /\bcommitView\s*\(/.test(read(f)) }).toEqual({ file: f, commits: true });
  });

  test("B17: click handlers ignore the click that ends a drag", () => {
    for (const f of [
      "plugins/experimental/ruler.ts",
      "plugins/experimental/tooltip-pin.ts",
      "plugins/experimental/minimap.ts",
    ])
      expect({ file: f, checks: /\bclickFollowsDrag\s*\(/.test(read(f)) }).toEqual({ file: f, checks: true });
  });
});
