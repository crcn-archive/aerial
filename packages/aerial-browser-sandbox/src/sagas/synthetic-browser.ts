import { fork, take, put, call, spawn, actionChannel, select } from "redux-saga/effects";
import { eventChannel, delay } from "redux-saga";
import { difference, debounce } from "lodash";
import { createQueue } from "mesh";

import { 
  FileCacheItem,
  getFileCacheStore,
  FileCacheRootState,
  createReadUriRequest,
  AddDependencyRequest, 
  AddDependencyResponse, 
  getFileCacheItemByUri,
  sandboxEnvironmentSaga,
  createAddDependencyRequest, 
  createReadCacheableUriRequest,
  createEvaluateDependencyRequest,
} from "aerial-sandbox2";

import {
  htmlContentEditorSaga
} from "./html-content-editor";

import {
  convertAbsoluteBoundsToRelative,
} from "../utils";

import {
  fileEditorSaga
} from "./file-editor";

import { 
  FetchRequest,
  FETCH_REQUEST,
  fetchRequest,
  OPEN_SYNTHETIC_WINDOW,
  SyntheticWindowScrolled,
  syntheticWindowScrolled,
  SYNTHETIC_WINDOW_SCROLLED,
  applyFileMutationsRequest,
  NODE_VALUE_STOPPED_EDITING,
  SyntheticNodeValueStoppedEditing,
  SyntheticNodeTextContentChanged,
  SyntheticWindowSourceChanged,
  syntheticWindowLoaded,
  SYNTHETIC_WINDOW_SOURCE_CHANGED,
  syntheticWindowRectsUpdated,
  OpenSyntheticBrowserWindow,
  SYNTHETIC_NODE_TEXT_CONTENT_CHANGED,
  NEW_SYNTHETIC_WINDOW_ENTRY_RESOLVED,
  syntheticWindowSourceChanged,
  syntheticWindowResourceLoaded,
  newSyntheticWindowEntryResolved
} from "../actions";

import { 
  watch,
  REMOVED,
  Removed,
  STOPPED_MOVING,
  request,
  shiftBounds,
  moveBounds,
  roundBounds,
  Mutation,
  diffArray,
  takeRequest, 
  Moved,
  pointToBounds,
  MOVED,
  eachArrayValueMutation,
} from "aerial-common2";

import {
  createSyntheticComment,
  createSyntheticDocument,
  createSyntheticElement,
  createSyntheticTextNode,
  SyntheticNode,
  SyntheticParentNode,
  SyntheticElement,
  SyntheticTextNode,
  SyntheticBrowserRootState,
  isSyntheticNodeType,
  SyntheticComment,
  getSyntheticNodeById,
  SyntheticDocument,
  BasicValueNode,
  SyntheticWindow,
  SyntheticBrowser,
  getSyntheticWindow,
  getSyntheticBrowser,
  getSyntheticBrowsers,
} from "../state";

import {
  diffWindow,
  diffDocument,
  patchWindow,
  SEnvNodeTypes,
  SEnvNodeInterface,
  SEnvTextInterface,
  getSEnvEventClasses,
  SEnvWindowInterface,
  SEnvElementInterface,
  SEnvHTMLElementInterface,
  SEnvCommentInterface,
  SyntheticDOMRenderer,
  SEnvDocumentInterface,
  waitForDocumentComplete,
  SyntheticWindowRendererEvent,
  createUpdateValueNodeMutation,
  openSyntheticEnvironmentWindow,
  createSetElementAttributeMutation,
  createSyntheticDOMRendererFactory,
  calculateUntransformedBoundingRect,
  createSetElementTextContentMutation,
  createParentNodeRemoveChildMutation,
} from "../environment";

export function* syntheticBrowserSaga() {
  yield fork(handleBrowserChanges);
  yield fork(handleFetchRequests);
  yield fork(htmlContentEditorSaga);
  yield fork(fileEditorSaga);
}

function* handleFetchRequests() {
  while(true) {
    yield takeRequest(FETCH_REQUEST, function*({ info }: FetchRequest) {
      return (yield yield request(createReadCacheableUriRequest(String(info)))).payload;
    });
  }
}

function* handleBrowserChanges() {
  let runningSyntheticBrowserIds = [];
  yield watch((root: SyntheticBrowserRootState) => getSyntheticBrowsers(root), function*(browsers: SyntheticBrowser[]) {
    const syntheticBrowserIds = browsers.map(item => item.$$id);
    yield* difference(syntheticBrowserIds, runningSyntheticBrowserIds).map((id) => (
      spawn(handleSyntheticBrowserSession, id)
    ));
    runningSyntheticBrowserIds = syntheticBrowserIds;
    return true;
  });
}

function* handleSyntheticBrowserSession(syntheticBrowserId: string) {
  let runningSyntheticWindowIds = [];
  yield watch((root: SyntheticBrowserRootState) => getSyntheticBrowser(root, syntheticBrowserId), function*(syntheticBrowser: SyntheticBrowser) {

    // stop the session if there is no synthetic window
    if (!syntheticBrowser) return false;
    const syntheticWindowIds = syntheticBrowser.windows.map(item => item.$$id);
    yield* difference(syntheticWindowIds, runningSyntheticWindowIds).map((id) => (
      spawn(handleSytheticWindowSession, id)
    ));

    runningSyntheticWindowIds = syntheticWindowIds;
    return true;
  });
}

function* handleSytheticWindowSession(syntheticWindowId: string) {
  let cwindow: SyntheticWindow;
  let cenv: SEnvWindowInterface;
  let cachedFiles: FileCacheItem[];
  const fetchQueue = createQueue();

  yield fork(function*() {
    yield watch((root: SyntheticBrowserRootState) => getSyntheticWindow(root, syntheticWindowId), function*(syntheticWindow) {
      if (!syntheticWindow) {
        if (cenv) {
          cenv.close();
        }
        return false;
      }
      yield spawn(handleSyntheticWindowChange, syntheticWindow);
      return true;
    });
  });

  function* getFetchedCacheFiles() {
    const state = yield select();
    return cwindow.externalResourceUris.map(uri => getFileCacheItemByUri(state, uri));
  }

  function* updateFetchedCacheFiles() {
    cachedFiles = yield getFetchedCacheFiles();
  }

  yield fork(function*() {
    yield watch((root: FileCacheRootState) => root.fileCacheStore, function*(fileCache) {
      const updatedCachedFiles = yield getFetchedCacheFiles();
      if (cachedFiles && cenv.document.readyState === "complete" && difference(cachedFiles, updatedCachedFiles).length !== 0) {
        yield spawn(reload);
      }
      yield updateFetchedCacheFiles();
      return true;
    });
  });

  yield fork(function*() {
    while(true) {
      const { value: [info, resolve] } = yield call(fetchQueue.next);
      const body = (yield yield request(fetchRequest(info))).payload;
      yield put(syntheticWindowResourceLoaded(syntheticWindowId, String(info)));
      resolve(body);
      yield updateFetchedCacheFiles();
    }
  });

  function* handleSyntheticWindowChange(syntheticWindow: SyntheticWindow) {
    yield fork(handleSizeChange, syntheticWindow),
    yield fork(handleLocationChange, syntheticWindow)
    cwindow = syntheticWindow;
  }

  function* handleSizeChange(syntheticWindow: SyntheticWindow) {
    if (!cwindow || cwindow.bounds === syntheticWindow.bounds) {
      return;
    }
    cenv.resizeTo(syntheticWindow.bounds.right - syntheticWindow.bounds.left, syntheticWindow.bounds.bottom - syntheticWindow.bounds.top)
  }

  function* handleLocationChange(syntheticWindow: SyntheticWindow) {
    if (cwindow && cwindow.location === syntheticWindow.location) {
      return;
    }
    yield reload(syntheticWindow);
  }

  function openTargetSyntheticWindow(syntheticWindow: SyntheticWindow) {
    return openSyntheticEnvironmentWindow(syntheticWindow.location, {
      console: {
        warn(...args) {
          console.warn('VM ', ...args);
        },
        log(...args) {
          console.log('VM ', ...args);
        },
        error(...args) {
          console.error('VM ', ...args);
        },
        info(...args) {
          console.info('VM ', ...args);
        }
      } as any,
      fetch(info: RequestInfo) {
        return new Promise((resolve) => {
          fetchQueue.unshift([info, ({ content, type }) => {
            resolve({
              text() {
                return Promise.resolve(String(content));
              }
            } as any);
          }]);
        });
      },
      createRenderer: !cenv && typeof window !== "undefined" ? createSyntheticDOMRendererFactory(document) : null
    });
  }

  async function getCurrentSyntheticWindowDiffs(syntheticWindow: SyntheticWindow = cwindow) {
    const nenv = openTargetSyntheticWindow(syntheticWindow);
    await waitForDocumentComplete(nenv);
    return diffWindow(cenv, nenv);
  }

  let _reloading: boolean;
  let _shouldReloadAgain: boolean;

  function* reload(syntheticWindow: SyntheticWindow = cwindow) {

    if (_reloading) {
      _shouldReloadAgain = true;
      return;
    }

    if (cenv) {
      try {
        _reloading = true;
        const diffs = yield call(getCurrentSyntheticWindowDiffs, syntheticWindow);
        patchWindow(cenv, diffs);

      } catch(e) {
        console.warn(e);
      }
      _reloading = false;
      if (_shouldReloadAgain) {
        _shouldReloadAgain = false;
        yield reload(syntheticWindow);
      }
    } else {
      cenv = openTargetSyntheticWindow(syntheticWindow);
      yield fork(watchNewWindow, syntheticWindow);
    }
  }

  const getAllNodes = () => {
    const allNodes = {};
    cenv.childObjects.forEach((value, key) => allNodes[key] = value.struct);
    return allNodes;
  }

  function* watchNewWindow(syntheticWindow: SyntheticWindow) {
    const { SEnvMutationEvent } = getSEnvEventClasses(cenv);
    const chan = eventChannel((emit) => {

      cenv.renderer.addEventListener(SyntheticWindowRendererEvent.PAINTED, ({ rects, styles }: SyntheticWindowRendererEvent) => {
        emit(syntheticWindowRectsUpdated(syntheticWindowId, rects, styles));
      });
      
      const emitStructChange = debounce(() => {
        emit(syntheticWindowLoaded(syntheticWindowId, cenv.document.struct, getAllNodes()));
      }, 0);

      cenv.addEventListener(SEnvMutationEvent.MUTATION, (event) => {
        if (cenv.document.readyState !== "complete") return;
        // multiple mutations may be fired, so batch everything in one go
        emitStructChange();
      });

      cenv.addEventListener("scroll", (event) => {
        emit(syntheticWindowScrolled(syntheticWindowId, {
          left: cenv.scrollX,
          top: cenv.scrollY
        }));
      });

      cenv.document.addEventListener("readystatechange", () => {
        if (cenv.document.readyState !== "complete") return;
        emit(syntheticWindowLoaded(syntheticWindowId, cenv.document.struct, getAllNodes()));
      });

      return () => {

      };
    });

    yield fork(function*() {
      while(true) {
        const e = yield take(chan);
        yield spawn(function*() {
          yield put(e);
        })
      }
    });

    yield put(syntheticWindowSourceChanged(syntheticWindow.$$id, cenv));
  }

  yield fork(function*() {
    while(true) {
      const { syntheticNodeId, textContent } = (yield take((action) => action.type === SYNTHETIC_NODE_TEXT_CONTENT_CHANGED && (action as SyntheticNodeTextContentChanged).syntheticWindowId === syntheticWindowId)) as SyntheticNodeTextContentChanged;
      const syntheticNode = cenv.childObjects.get(syntheticNodeId);
      syntheticNode.textContent = textContent;
    }
  }); 

  // TODO: deprecated. changes must be explicit in the editor instead of doing diff / patch work
  // since we may end up editing the wrong node otherwise (CC).
  yield fork(function*() {
    while(true) {
      const { nodeId } = (yield take(action => action.type === NODE_VALUE_STOPPED_EDITING && (action as SyntheticNodeValueStoppedEditing).syntheticWindowId === syntheticWindowId)) as SyntheticNodeValueStoppedEditing;
      const node = cenv.childObjects.get(nodeId) as HTMLElement;
      const mutation = createSetElementTextContentMutation(node, node.textContent);
      yield yield request(applyFileMutationsRequest(mutation));
    }
  });

  yield fork(function*() {
    while(true) {
      const { scrollPosition: { left, top }} = (yield take((action: SyntheticWindowScrolled) => action.type === SYNTHETIC_WINDOW_SCROLLED && action.syntheticWindowId === syntheticWindowId)) as SyntheticWindowScrolled;
      cenv.scrollTo(left, top);
    }
  });

  yield fork(function* handleRemoveNode() {
    while(true) {
      const {itemType, itemId}: Removed = (yield take((action: Removed) => action.type === REMOVED && isSyntheticNodeType(action.itemType) && cenv.childObjects.get(action.itemId)));
      const target = cenv.childObjects.get(itemId) as Node;
      const parent = target.parentNode;
      const removeMutation = createParentNodeRemoveChildMutation(parent, target);

      // remove immediately so that it's reflected in the canvas
      parent.removeChild(target);
      yield yield request(applyFileMutationsRequest(removeMutation));
    }
  });

  yield fork(function* handleMoveNode() {
    while(true) {
      const {itemType, itemId, point}: Moved = (yield take((action: Moved) => action.type === MOVED && isSyntheticNodeType(action.itemType) && cenv.childObjects.get(action.itemId)));

      // compute based on the data currently in the store
      const syntheticWindow = getSyntheticWindow(yield select(), cwindow.$$id);
      const syntheticNode = getSyntheticNodeById(yield select(), itemId);
      
      const originalRect = syntheticWindow.allComputedBounds[syntheticNode.$$id];
      const computedStyle = syntheticWindow.allComputedStyles[syntheticNode.$$id];

      // TODO - computed boxes MUST also contain the offset of the parent.
      const relativeRect = roundBounds(shiftBounds(convertAbsoluteBoundsToRelative(
        pointToBounds(point),
        syntheticNode as SyntheticElement,
        syntheticWindow
      ), {
        left: -syntheticWindow.bounds.left,
        top: -syntheticWindow.bounds.top
      }));

      const envElement = cenv.childObjects.get(syntheticNode.$$id);

      // TODO - get best CSS style
      if (computedStyle.position === "static") {
        envElement.style.position = "relative";
      }
      envElement.style.left = `${relativeRect.left}px`;
      envElement.style.top  = `${relativeRect.top}px`;
    }
  });

  yield fork(function* handleMoveNodeStopped() {
    while(true) {
      const {itemType, itemId}: Moved = (yield take((action: Moved) => action.type === STOPPED_MOVING && isSyntheticNodeType(action.itemType) && cenv.childObjects.get(action.itemId)));
      const target = cenv.childObjects.get(itemId) as HTMLElement;

      // TODO - prompt where to persist style
      const mutation = createSetElementAttributeMutation(target, "style", target.getAttribute("style"));
      yield yield request(applyFileMutationsRequest(mutation));
    }
  });
}

const mapSEnvAttribute = ({name, value}: Attr) => ({
  name,
  value
})