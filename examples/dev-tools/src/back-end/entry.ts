import { argv } from "yargs";
import { LogLevel } from "aerial-common2";
import { initApplication } from "./index";
import { applicationStarted } from "./actions";

const [dir] = argv._;

const app = initApplication({
  cwd: process.cwd(),
  http: {
    port: Number(argv.port || 8083)
  },
  log: {
    level: LogLevel.ALL
  }
});


app.dispatch(applicationStarted());