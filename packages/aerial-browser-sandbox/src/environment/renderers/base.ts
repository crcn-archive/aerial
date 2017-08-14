import { getSEnvEventTargetClass, getSEnvEventClasses, SEnvMutationEventInterface } from "../events";
import { SEnvWindowInterface } from "../window";

const EventTarget = getSEnvEventTargetClass();
const { SEnvEvent, SEnvMutationEvent } = getSEnvEventClasses();

export interface SyntheticWindowRenderer extends EventTarget {
  mount: HTMLElement;
  sourceWindow: Window;
  getBoundingClientRect(element: HTMLElement): ClientRect;
  getComputedStyle(element: HTMLElement, pseudoElement?: HTMLElement): CSSStyleDeclaration;
}

export type SyntheticDOMRendererFactory = (window: Window) => SyntheticWindowRenderer;

export interface RenderedClientRects {
  [identifier: string]: ClientRect
};

export class SyntheticWindowRendererEvent extends SEnvEvent {
  static readonly PAINTED = "PAINTED";
  rects: RenderedClientRects;
  initRendererEvent(type: string, rects: RenderedClientRects) {
    super.initEvent(type, true, true);
    this.rects = rects;
  }
}

export abstract class BaseSyntheticWindowRenderer extends EventTarget implements SyntheticWindowRenderer {
  abstract readonly mount: HTMLElement;
  private _rects: RenderedClientRects;

  constructor(protected _sourceWindow: SEnvWindowInterface) {
    super();
    this._onDocumentLoad = this._onDocumentLoad.bind(this);
    this._onDocumentLoad2 = this._onDocumentLoad2.bind(this);
    this._onWindowResize = this._onWindowResize.bind(this);
    this._onWindowMutation = this._onWindowMutation.bind(this);
    this._addTargetListeners();
  }

  get clientRects(): RenderedClientRects {
    return this._rects;
  }

  get sourceWindow(): Window {
    return this._sourceWindow;
  }

  getBoundingClientRect(element: HTMLElement): ClientRect {
    return null;
  }

  getComputedStyle(element: HTMLElement, pseudoElement?: HTMLElement): CSSStyleDeclaration {
    return null;
  }

  protected _removeTargetListeners() {

  }

  protected _addTargetListeners() {
    this._sourceWindow.document.addEventListener("load", this._onDocumentLoad2);
    this._sourceWindow.addEventListener("resize", this._onWindowResize);
  }

  private _onDocumentLoad2(event: Event) {
    if (event.target !== this._sourceWindow.document) return;
    this._onDocumentLoad(event);
  }


  protected _onDocumentLoad(event: Event) {

    // document load is when the page is visible to the user, so only listen for 
    // mutations after stuff is loaded in (They'll be fired as the document is loaded in) (CC)
    this._sourceWindow.addEventListener(SEnvMutationEvent.MUTATION, this._onWindowMutation);
  }

  protected _onWindowResize(event: Event) {

  }

  protected _onWindowMutation(event: SEnvMutationEventInterface) {
    
  }

  protected setPaintedInfo(rects: RenderedClientRects, computedStyles?: any /* TODO */) {
    this._rects = rects;
    const event = new SyntheticWindowRendererEvent();
    event.initRendererEvent(SyntheticWindowRendererEvent.PAINTED, rects);
    this.dispatchEvent(event);
  }
}
