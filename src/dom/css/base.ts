import {
  ISerializer,
  Mutation,
  serialize,
  deserialize,
  PropertyMutation,
  ITreeWalker,
  sourcePositionEquals
} from "@tandem/common";
import { SyntheticCSSStyleSheet } from "./style-sheet";
import { SyntheticDOMNode } from "@tandem/synthetic-browser/dom";
import {
  IEditable,
  IEditor,
  BaseContentEdit,
  SyntheticObjectEdit,
  ISyntheticObject,
  ISyntheticSourceInfo,
  generateSyntheticUID,
  SyntheticObjectEditor,
  syntheticSourceInfoEquals,
  SyntheticObjectSerializer,
  SyntheticObjectChangeTypes,
} from "@tandem/sandbox";

export class SyntheticCSSObjectEdit<T extends SyntheticCSSObject> extends SyntheticObjectEdit<T> {
}


export class SyntheticCSSObjectEditor<T extends SyntheticCSSObject> extends SyntheticObjectEditor<T> {

}

export abstract class SyntheticCSSObject implements ISyntheticObject, IEditable {

  public $source: ISyntheticSourceInfo;
  public $uid: any;
  public $parentStyleSheet: SyntheticCSSStyleSheet;
  public $parentRule: SyntheticCSSObject;
  public $ownerNode: SyntheticDOMNode;

  constructor() {
    this.$uid = generateSyntheticUID();
  }

  get parentStyleSheet() {
    return this.$parentStyleSheet || this.$parentRule && this.$parentRule.parentStyleSheet;
  }

  get ownerNode() {
    return this.$ownerNode || this.$parentRule && this.$parentRule.ownerNode || this.$parentStyleSheet && this.$parentStyleSheet.ownerNode;
  }

  get parentRule() {
    return this.$parentRule;
  }

  get uid() {
    return this.$uid;
  }

  get source() {
    return this.$source;
  }

  clone(deep?: boolean) {
    if (deep) return deserialize(serialize(this), null);
    return this.$linkClone(this.cloneShallow());
  }

  regenerateUID(deep?: boolean) {
    this.$uid = generateSyntheticUID();
    return this;
  }

  public $linkClone(clone: SyntheticCSSObject) {
    clone.$source = this.$source;
    clone.$uid    = this.$uid;
    return clone;
  }

  protected abstract cloneShallow(): SyntheticCSSObject;

  abstract createEdit(): BaseContentEdit<SyntheticCSSObject>;
  abstract createEditor(): IEditor;
  abstract visitWalker(walker: ITreeWalker);

  /**
   * Counts attribute differences of the target node, omitting children diffs.
   *
   * @abstract
   * @param {*} target
   * @param {boolean} [deep]
   */

  abstract countShallowDiffs(target: SyntheticCSSObject): number;
}

export const SyntheticCSSObjectSerializer = SyntheticObjectSerializer;