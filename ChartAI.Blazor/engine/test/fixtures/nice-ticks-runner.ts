// Runs plugins/shared.ts niceTicks over the cases in the NICE_TICKS_CASES environment variable
// (JSON [[min, max, count], ...]) and prints {results} or {missing} as JSON. Spawned as a child
// process by test/pure/plugin-helpers.test.ts so a niceTicks that never returns (B1) fails the
// test on a timeout instead of freezing the whole run.
import { installEnv } from "../helpers/env.ts";

installEnv();

const cases: [number, number, number][] = JSON.parse(process.env.NICE_TICKS_CASES ?? "[]");
const mod: any = await import("../../src/plugins/shared.ts");
if (typeof mod.niceTicks !== "function") {
  console.log(JSON.stringify({ missing: true }));
} else {
  const results = cases.map(([min, max, count]) => {
    const t0 = performance.now();
    const ticks = Array.from(mod.niceTicks(min, max, count) as ArrayLike<number>);
    return { ticks, ms: performance.now() - t0 };
  });
  console.log(JSON.stringify({ results }));
}
process.exit(0);
