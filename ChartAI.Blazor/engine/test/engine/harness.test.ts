import { beforeEach, describe, expect, test } from "bun:test";
import { resetEnv } from "../helpers/env.ts";
import { M, makeChart, range, series, startEngine } from "../helpers/engine.ts";
import { LineChart } from "../../src/charts/line.ts";

beforeEach(() => resetEnv());

describe("test harness", () => {
  test("a line chart uploads its series through the fake worker", async () => {
    const eng = await startEngine([LineChart]);
    const c = await makeChart(eng, { type: "line" });
    c.handle.setData([series("a", range(10), range(10, (i) => i * 2))]);
    const msg = eng.worker.last(M.UPDATE_SERIES, c.id);
    expect(msg).toBeDefined();
    expect(msg.series).toHaveLength(1);
    expect(eng.worker.messages(M.REGISTER_CHART, c.id)).toHaveLength(1);
    expect(eng.worker.messages(M.INIT)).toHaveLength(1);
  });
});
