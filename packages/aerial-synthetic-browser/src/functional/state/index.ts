import { DOMNodeType } from "../../dom";
import { 
  Struct, 
  Box, 
  Point, 
  weakMemo,
  getValueById,
  traverseObject,
  createStructFactory,
} from "aerial-common2";

/**
 * Constants
 */

export const DOM_TEXT_NODE              = "DOM_TEXT_NODE";
export const DOM_ELEMENT                = "DOM_ELEMENT";
export const DOM_DOCUMENT               = "DOM_DOCUMENT";
export const DOM_COMMENT                = "DOM_COMMENT";
export const SYTNTHETIC_BROWSER_WINDOW  = "SYNTHETIC_BROWSER_WINDOW";
export const SYNTHETIC_BROWSER          = "SYNTHETIC_BROWSER";

const DEFAULT_SYNTHETIC_WINDOW_BOX: Box = {
  left: 0,
  top: 0,

  // small screen size
  right: 800,
  bottom: 600
};

/**
 * Shapes
 */

export type SyntheticDOMNode2 = {
  nodeType: DOMNodeType;
  nodeName: string;
  childNodes: SyntheticDOMNode2[];
} & Struct;

export type SyntheticDOMValueNode2 = {
  nodeValue: string;
} & SyntheticDOMNode2;

export type SyntheticDOMComment2 = {
  nodeValue: string;
  nodeName: "#comment";
} & SyntheticDOMValueNode2;

export type SyntheticDOMTextNode2 = {
  nodeValue: string;
  nodeName: "#text";
} & SyntheticDOMValueNode2;

export type SyntheticCSSStyle2 = {

} & Struct;

export type SyntheticDOMElementAttributes2 = {
  [identifier: string]: string
} & Struct;

export type SyntheticDOMElement2 = {
  nodeName: string;
  boundingRect: Box;
  attributes: SyntheticDOMElementAttributes2;
  computedStyle: SyntheticCSSStyle2;
} & SyntheticDOMNode2;

export type SyntheticDOMDocument2 = {
  nodeName: "#document";
} & SyntheticDOMNode2;

export type SyntheticBrowserWindow2 = {
  document: SyntheticDOMDocument2;
  location: string;
  title: string;
  box: Box;
  computedBoxes: {
    [identifier: string]: Box;
  };
  computedStyles: {
    [identifier: string]: CSSStyleDeclaration
  }
} & Struct;

export type SyntheticBrowserRenderer2 = {

} & Struct;

export type SyntheticBrowserDOMRenderer2 = {
  syntheticBrowserWindowId: string;
  nativeDocumentElenent: HTMLElement;
} & SyntheticBrowserRenderer2;

export type SyntheticBrowser2 = {
  windows: SyntheticBrowserWindow2[]
} & Struct;

export const isSyntheticDOMNode = (value) => value && value.nodeType != null;
/**
 * Utilities
 */

export const createSyntheticBrowser2 = createStructFactory<SyntheticBrowser2>(SYNTHETIC_BROWSER, {
  windows: []
});

export const createSyntheticBrowserWindow2 = createStructFactory<SyntheticBrowserWindow2>(SYTNTHETIC_BROWSER_WINDOW, {
  computedStyles: {},
  computedBoxes: {},
  box: DEFAULT_SYNTHETIC_WINDOW_BOX
});

export const getSyntheticBrowserWindow = (root: any, id: string): SyntheticBrowserWindow2 => {
  return getValueById(root, id);
};

export const getSyntheticBrowser = (root: any, id: string): SyntheticBrowser2 => {
  return getValueById(root, id);
};

export const findSyntheticDOMNodes = weakMemo((root: any, filter: (node: SyntheticDOMNode2) => boolean): SyntheticDOMNode2[] => {
  const found: SyntheticDOMNode2[] = [];
  traverseObject(root, (item: any) => {
    if (isSyntheticDOMNode(item) && filter(item)) {
      found.push(item);
    }
  });
  return found;
});

export const getAllSyntheticDOMNodes = weakMemo((root: any) => findSyntheticDOMNodes(root, () => true));
export const getAllSyntheticDOMNodesAsIdMap = weakMemo((root: any): { [identifier: string]: SyntheticDOMNode2 } => {
  const allNodes = getAllSyntheticDOMNodes(root);
  const map = {};
  for (const node of allNodes) {
    map[node.$$id] = node;
  }
  return map;
});