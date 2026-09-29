// Loaded by bunfig.toml before every test file: installs happy-dom and the browser fakes of
// test/helpers/env.ts, so that importing the engine (whose ChartManager singleton touches the
// DOM when its module loads) works in every suite.
import { installEnv } from "../helpers/env.ts";

installEnv();
