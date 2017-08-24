import { BaseSyntheticWindowRenderer } from "./base";
import { SEnvWindowInterface } from "../window";

export class NoopRendererer extends BaseSyntheticWindowRenderer {
  readonly container: HTMLElement = null;
}

export const createNoopRenderer = (window: SEnvWindowInterface) => {
  return new NoopRendererer(window);
}