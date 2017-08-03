import { weakMemo } from "aerial-common2";
import { getSEnvNodeClass } from "./node";
import { getSEnvHTMLCollectionClasses } from "./collections";
import { getDOMExceptionClasses } from "./exceptions";
import { getL3EventClasses } from "../level3";

export const getSEnvParentNodeClass = weakMemo((window: Window) => {

  const SEnvNode = getSEnvNodeClass(window);
  const { SEnvDOMException } = getDOMExceptionClasses(window);
  const { SEnvHTMLCollection } =  getSEnvHTMLCollectionClasses(window);
  const { SEnvMutationEvent } = getL3EventClasses(window);


  return class SEnvParentNode extends SEnvNode implements ParentNode {
    readonly children: HTMLCollection;
    constructor() {
      super();
      this.children = new SEnvHTMLCollection(this);
    }
    appendChild<T extends Node>(child: T) {
      this.$childNodesArray.push(child);
      return child;
    }
    removeChild<T extends Node>(child: T) {
      const index = this.$childNodesArray.indexOf(child);
      if (index === -1) {
        throw new SEnvDOMException("The node to be removed is not a child of this node.");
      }
      this.$childNodesArray.splice(index, 1);
      const event = document.createEvent("MutationEvent");
      console.log(event);
      event.initMutationEvent("DOMNodeInserted", true, true, this)
      this.dispatchEvent(event);
      return child;
    }
    replaceChild<T extends Node>(newChild: Node, oldChild: T): T {
      const index = this.$childNodesArray.indexOf(oldChild);
      if (index === -1) {
        throw new SEnvDOMException("The node to be replaced is not a child of this node.");
      }
      this.$childNodesArray.splice(index, 1, newChild);
      return oldChild;
    }
    get firstElementChild() {
      return this.children[0];
    }
    get lastElementChild() {
      return this.children[this.children.length - 1];
    }
    get childElementCount() {
      return this.children.length;
    }
  }
});