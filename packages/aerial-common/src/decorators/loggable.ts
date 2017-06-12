import { inject } from "@tandem/common/decorators";
import { Logger } from "../logger";
import { NoopDispatcher } from "@tandem/mesh";
import { PrivateBusProvider } from "@tandem/common/ioc";

const noopDispatcher = new NoopDispatcher();

// TODO - use a singleton here? It might be okay
export function loggable () {
  return (clazz: any) => {

    const loggerBusProperty = "$$loggerBus";

    // this assumes the object is being injected -- it may not be.
    inject(PrivateBusProvider.ID)(clazz.prototype, loggerBusProperty);

    Object.defineProperty(clazz.prototype, "logger", {
      get() {
        if (this.$$logger) return this.$$logger;

        const bus = this[loggerBusProperty];

        // create a child logger so that the prefix here does
        // not get overwritten
        return this.$$logger = (new Logger(
          bus || noopDispatcher,
          `${this.constructor.name}: `
        ).createChild());
      }
    });
  };
}

// export function logCall() {

// }
