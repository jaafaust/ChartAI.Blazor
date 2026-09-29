// A recording stand-in for the engine's ChartManager, used to test wwwroot/chartai-blazor.js in
// isolation (see test/interop). Every call is logged in order; methods the interop may call that
// are not modelled here are recorded and do nothing.

export interface Call {
  target: string; // "mgr" or a chart id
  name: string;
  args: any[];
}

export interface FakeChartHandle {
  id: string;
  readonly _c: any;
  destroyed: boolean;
  [k: string]: any;
}

export function createFakeManager() {
  const calls: Call[] = [];
  const viewListeners = new Set<(id: string) => void>();
  const charts = new Map<string, any>();
  const handles: FakeChartHandle[] = [];
  let initResult: Promise<boolean> = Promise.resolve(true);
  let n = 0;
  let dark = false;
  let syncViews: any = false;

  const log = (target: string, name: string, args: any[]) => calls.push({ target, name, args });

  function makeHandle(cfg: any): FakeChartHandle {
    const id = `fake-${++n}`;
    const el = document.createElement("div");
    el.dataset.chartId = id;
    cfg?.container?.appendChild?.(el);
    const internal: any = {
      id,
      config: { ...cfg },
      el,
      width: 400,
      height: 200,
      dpr: 1,
      series: [],
      bounds: { minX: 0, maxX: 1, minY: 0, maxY: 1 },
      view: { panX: 0, panY: 0, zoomX: 1, zoomY: 1 },
      homeView: { panX: -0.1, panY: -0.2, zoomX: 0.8, zoomY: 0.7 },
      visible: true,
      dragging: false,
      plugins: [] as any[],
      yAxes: null,
    };
    charts.set(id, internal);
    const h: FakeChartHandle = {
      id,
      destroyed: false,
      get _c() {
        return h.destroyed ? undefined : internal;
      },
      setData(series: any[], opts?: any) {
        log(id, "setData", [series, opts]);
        internal.series = series;
      },
      patchData(patch: any) {
        log(id, "patchData", [patch]);
        if (patch?.bounds) internal.bounds = { ...patch.bounds };
      },
      setBounds(b: any) {
        log(id, "setBounds", [b]);
        internal.bounds = { ...b };
      },
      configure(patch: any) {
        log(id, "configure", [patch]);
        Object.assign(internal.config, patch);
      },
      addPlugin(p: any) {
        log(id, "addPlugin", [p]);
        internal.plugins.push(p);
      },
      removePlugin(name: string) {
        log(id, "removePlugin", [name]);
      },
      hasPlugin(name: string) {
        return internal.plugins.some((p: any) => p?.name === name);
      },
      resetView() {
        log(id, "resetView", []);
      },
      destroy() {
        log(id, "destroy", []);
        h.destroyed = true;
        el.remove();
        charts.delete(id);
      },
    };
    handles.push(h);
    return h;
  }

  const base: any = {
    // test controls
    calls,
    charts,
    handles,
    viewListeners,
    setInitResult(p: Promise<boolean>) {
      initResult = p;
    },
    emitViewChange(id: string) {
      for (const fn of [...viewListeners]) fn(id);
    },
    lastHandle(): FakeChartHandle {
      return handles[handles.length - 1];
    },
    handleFor(internalId: string): FakeChartHandle | undefined {
      return handles.find((h) => h.id === internalId);
    },
    callsOf(name: string, target?: string): Call[] {
      return calls.filter((c) => c.name === name && (target === undefined || c.target === target));
    },
    reset() {
      calls.length = 0;
    },

    // ChartManager surface
    get isDark() {
      return dark;
    },
    get syncViews() {
      return syncViews;
    },
    use(p: any) {
      log("mgr", "use", [p]);
    },
    init() {
      log("mgr", "init", []);
      return initResult;
    },
    setTheme(d: boolean) {
      log("mgr", "setTheme", [d]);
      dark = d;
    },
    setSyncViews(s: any) {
      log("mgr", "setSyncViews", [s]);
      syncViews = s === true ? "both" : s || false;
    },
    create(cfg: any) {
      log("mgr", "create", [cfg]);
      return makeHandle(cfg);
    },
    onViewChange(fn: (id: string) => void) {
      log("mgr", "onViewChange", [fn]);
      viewListeners.add(fn);
      return () => {
        viewListeners.delete(fn);
      };
    },
    commitView(c: any) {
      log("mgr", "commitView", [c]);
      base.emitViewChange(c?.id);
    },
    requestRender(id: string) {
      log("mgr", "requestRender", [id]);
    },
    drawChart(c: any) {
      log("mgr", "drawChart", [c]);
    },
    onStats() {
      return () => {};
    },
    getStats() {
      return { fps: 0, renderMs: 0, total: 0, active: 0 };
    },
  };

  const ignored = new Set<PropertyKey>(["then", "toJSON", "constructor", "$$typeof", "asymmetricMatch", "nodeType"]);
  return new Proxy(base, {
    get(t, k, r) {
      if (k in t) return Reflect.get(t, k, r);
      if (typeof k !== "string" || ignored.has(k)) return undefined;
      return (...args: any[]) => {
        log("mgr", k, args);
        return undefined;
      };
    },
  });
}
