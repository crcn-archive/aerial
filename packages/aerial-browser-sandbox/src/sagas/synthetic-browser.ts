import { fork, take, put, call, spawn, actionChannel, select } from "redux-saga/effects";
import { eventChannel, delay } from "redux-saga";
import { difference, debounce } from "lodash";
import { createQueue } from "mesh";

import { 
  FileCacheItem,
  UriCacheBusted,
  URI_CACHE_BUSTED,
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
  syntheticWindowMoved,
  SYNTHETIC_WINDOW_OPENED,
  SyntheticNodeValueStoppedEditing,
  SyntheticNodeTextContentChanged,
  syntheticWindowOpened,
  SyntheticWindowSourceChanged,
  syntheticWindowLoaded,
  syntheticWindowRectsUpdated,
  OpenSyntheticBrowserWindow,
  SyntheticWindowOpened,
  syntheticWindowResized,
  SYNTHETIC_NODE_TEXT_CONTENT_CHANGED,
  NEW_SYNTHETIC_WINDOW_ENTRY_RESOLVED,
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
  createRequestResponse,
  Resized,
  Mutation,
  diffArray,
  takeRequest, 
  Moved,
  pointToBounds,
  MOVED,
  RESIZED,
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
  SEnvWindowContext,
  SEnvElementInterface,
  SEnvCommentInterface,
  SyntheticDOMRenderer,
  SEnvDocumentInterface,
  waitForDocumentComplete,
  getSEnvWindowProxyClass,
  SEnvHTMLElementInterface,
  SEnvWindowOpenedEventInterface,
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
    const req = (yield take(FETCH_REQUEST)) as FetchRequest;
    yield put(createRequestResponse(req.$$id, (yield yield request(createReadCacheableUriRequest(String(req.info)))).payload));
   
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
  yield fork(handleOpenSyntheticWindow, syntheticBrowserId);
  yield fork(handleOpenedSyntheticWindow, syntheticBrowserId);
}

function* handleOpenSyntheticWindow(browserId: string) {
  while(true) {
    const request = (yield take((action: OpenSyntheticBrowserWindow) => action.type === OPEN_SYNTHETIC_WINDOW && action.syntheticBrowserId === browserId)) as OpenSyntheticBrowserWindow;
    const instance = (yield call(openSyntheticWindowEnvironment, request.uri)) as SEnvWindowInterface;
    if (request.left || request.top) {
      instance.moveTo(request.left, request.top);
    }
    yield put(syntheticWindowOpened(instance, browserId));
  }
}

function* openSyntheticWindowEnvironment(location: string) {

  const reload = async () => {
    const newWindow = openSyntheticEnvironmentWindow(location, {...context, createRenderer: null});
    await waitForDocumentComplete(newWindow);
    proxy.target = newWindow;
  };

  const context = yield call(createSyntheticWindowEnvironmentContext, reload);
  const SEnvWindowProxy = getSEnvWindowProxyClass(context);
  const proxy = new SEnvWindowProxy(location);

  reload();
  
  return proxy;
}

function* createSyntheticWindowEnvironmentContext(reload: () => any) {
  return {
    reload,
    console: getSEnvWindowConsole(),
    fetch: yield call(getSEnvWindowFetch, reload),
    createRenderer: createSyntheticDOMRendererFactory(document)
  } as any;
};

const getSEnvWindowConsole = () => ({
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
} as any as Console);


function* getSEnvWindowFetch(reload) {
  const fetchQueue = createQueue();
  let externalResources: string[] = [];

  yield spawn(function*() {
    while(true) {
      const { value: [info, resolve] } = yield call(fetchQueue.next);
      const body = (yield yield request(fetchRequest(info))).payload;
      externalResources.push(info);
      resolve(body);
    }
  });

  // watch for changes
  yield spawn(function*() {
    while(true) {
      const { uri } = (yield take(URI_CACHE_BUSTED)) as UriCacheBusted;
      if (externalResources.indexOf(uri) !== -1) {
        externalResources = [];
        reload();
      }
    }
  });

  return (info: RequestInfo) => {
    return new Promise((resolve) => {
      fetchQueue.unshift([info, ({ content, type }) => {
        resolve({
          text() {
            return Promise.resolve(String(content));
          }
        } as any);
      }]);
    });
  };
}

function* handleOpenedSyntheticWindow(browserId: string) {
  while(true) {
    const { instance } = (yield take(SYNTHETIC_WINDOW_OPENED)) as SyntheticWindowOpened;
    yield spawn(handleSyntheticWindowInstance, instance, browserId);
  }
}

function* handleSyntheticWindowInstance(window: SEnvWindowInterface, browserId: string) {
  yield fork(handleSyntheticWindowEvents, window, browserId);
  yield fork(handleSyntheticWindowMutations, window);
}

const getAllWindowObjects = (window: SEnvWindowInterface) => {
  const allNodes = {};
  window.childObjects.forEach((value, key) => allNodes[key] = value.struct);
  return allNodes;
}

function* handleSyntheticWindowEvents(window: SEnvWindowInterface, browserId: string) {
  const { SEnvMutationEvent, SEnvWindowOpenedEvent } = getSEnvEventClasses(window);

  const chan = eventChannel(function(emit) {
    window.renderer.addEventListener(SyntheticWindowRendererEvent.PAINTED, ({ rects, styles }: SyntheticWindowRendererEvent) => {
      emit(syntheticWindowRectsUpdated(window.uid, rects, styles));
    });
    
    const emitStructChange = debounce(() => {
      emit(syntheticWindowLoaded(window.uid, window.document.struct, getAllWindowObjects(window)));
    }, 0);

    window.addEventListener(SEnvMutationEvent.MUTATION, (event) => {
      if (window.document.readyState !== "complete") return;
      // multiple mutations may be fired, so batch everything in one go
      emitStructChange();
    });

    window.addEventListener("move", (event) => {
      emit(syntheticWindowMoved(window));
    });

    window.addEventListener("resize", (event) => {
      emit(syntheticWindowResized(window));
    });

    window.addEventListener(SEnvWindowOpenedEvent.WINDOW_OPENED, (event: SEnvWindowOpenedEventInterface) => {
      emit(syntheticWindowOpened(event.window, browserId, window.uid));
    })

    window.addEventListener("scroll", (event) => {
      emit(syntheticWindowScrolled(window.uid, {
        left: window.scrollX,
        top: window.scrollY
      }));
    });

    const triggerLoaded = () => {
      if (window.document.readyState !== "complete") return;
      emit(syntheticWindowLoaded(window.uid, window.document.struct, getAllWindowObjects(window)));
    };

    window.document.addEventListener("readystatechange", triggerLoaded);
    triggerLoaded();

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
}

function* handleSyntheticWindowMutations(window: SEnvWindowInterface) {

  const takeWindowAction = (type, test = (action) => action.syntheticWindowId === window.uid) => take((action) => action.type === type && test(action));

  yield fork(function* handleRemoveNode() {
    while(true) {
      const {itemType, itemId}: Removed = (yield take((action: Removed) => action.type === REMOVED && isSyntheticNodeType(action.itemType) && window.childObjects.get(action.itemId)));
      const target = window.childObjects.get(itemId) as Node;
      const parent = target.parentNode;
      const removeMutation = createParentNodeRemoveChildMutation(parent, target);

      // remove immediately so that it's reflected in the canvas
      parent.removeChild(target);
      yield yield request(applyFileMutationsRequest(removeMutation));
    }
  });

  yield fork(function* handleMoveNode() {
    while(true) {
      const {itemType, itemId, point}: Moved = (yield take((action: Moved) => action.type === MOVED && isSyntheticNodeType(action.itemType) && window.childObjects.get(action.itemId)));

      // compute based on the data currently in the store
      const syntheticWindow = getSyntheticWindow(yield select(), window.uid);
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

      const envElement = window.childObjects.get(syntheticNode.$$id);

      // TODO - get best CSS style
      if (computedStyle.position === "static") {
        envElement.style.position = "relative";
      }
      envElement.style.left = `${relativeRect.left}px`;
      envElement.style.top  = `${relativeRect.top}px`;
    }
  });

  yield fork(function*() {
    while(true) {
      const { syntheticNodeId, textContent } = (yield takeWindowAction(SYNTHETIC_NODE_TEXT_CONTENT_CHANGED)) as SyntheticNodeTextContentChanged;
      const syntheticNode = window.childObjects.get(syntheticNodeId);
      syntheticNode.textContent = textContent;
    }
  }); 

  // TODO: deprecated. changes must be explicit in the editor instead of doing diff / patch work
  // since we may end up editing the wrong node otherwise (CC).
  yield fork(function* handleNodeStoppedEditing() {
    while(true) {
      const { nodeId } = (yield takeWindowAction(NODE_VALUE_STOPPED_EDITING)) as SyntheticNodeValueStoppedEditing;
      const node = window.childObjects.get(nodeId) as HTMLElement;
      const mutation = createSetElementTextContentMutation(node, node.textContent);
      yield yield request(applyFileMutationsRequest(mutation));
    }
  });

  yield fork(function* handleMoveNodeStopped() {
    while(true) {
      const {itemType, itemId}: Moved = (yield take((action: Moved) => action.type === STOPPED_MOVING && isSyntheticNodeType(action.itemType) && window.childObjects.get(action.itemId)));
      const target = window.childObjects.get(itemId) as HTMLElement;

      // TODO - prompt where to persist style
      const mutation = createSetElementAttributeMutation(target, "style", target.getAttribute("style"));
      yield yield request(applyFileMutationsRequest(mutation));
    }
  });

  yield fork(function*() {
    while(true) {
      const { scrollPosition: { left, top }} = (yield takeWindowAction(SYNTHETIC_WINDOW_SCROLLED)) as SyntheticWindowScrolled;
      window.scrollTo(left, top);
    }
  });


  // case RESIZED: {
  //   const { itemId, itemType, bounds } = event as Resized;
  //   if (itemType === SYNTHETIC_WINDOW) {
  //     const window = getSyntheticWindow(root, itemId);
  //     if (window) {
  //       return updateSyntheticWindow(root, itemId, {
  //         bounds
  //       });
  //     }
  //     break;
  //   }
  // }

  yield fork(function* handleResized() {
    while(true) {
      const { bounds } = (yield takeWindowAction(RESIZED, (action: Resized) => action.itemId === window.uid)) as Resized;
      window.resizeTo(bounds.right - bounds.left, bounds.bottom - bounds.top);
    }
  })
}

function* handleSytheticWindowSession(syntheticWindowId: string) {
  let cwindow: SyntheticWindow;
  let cenv: SEnvWindowInterface;
  let cachedFiles: FileCacheItem[];
  const fetchQueue = createQueue();

  function* getFetchedCacheFiles() {
    const state = yield select();
    return cwindow.externalResourceUris.map(uri => getFileCacheItemByUri(state, uri));
  }

  function* updateFetchedCacheFiles() {
    cachedFiles = yield getFetchedCacheFiles();
  }

  function* handleSizeChange(syntheticWindow: SyntheticWindow) {
    if (!cwindow || cwindow.bounds === syntheticWindow.bounds) {
      return;
    }
    cenv.resizeTo(syntheticWindow.bounds.right - syntheticWindow.bounds.left, syntheticWindow.bounds.bottom - syntheticWindow.bounds.top)
  }

  function openTargetSyntheticWindow(syntheticWindow: SyntheticWindow) {
    // return openSyntheticEnvironmentWindow(syntheticWindow.location, {
    //   console: {
    //     warn(...args) {
    //       console.warn('VM ', ...args);
    //     },
    //     log(...args) {
    //       console.log('VM ', ...args);
    //     },
    //     error(...args) {
    //       console.error('VM ', ...args);
    //     },
    //     info(...args) {
    //       console.info('VM ', ...args);
    //     }
    //   } as any,
    //   fetch(info: RequestInfo) {
    //     return new Promise((resolve) => {
    //       fetchQueue.unshift([info, ({ content, type }) => {
    //         resolve({
    //           text() {
    //             return Promise.resolve(String(content));
    //           }
    //         } as any);
    //       }]);
    //     });
    //   },
    //   createRenderer: !cenv && typeof window !== "undefined" ? createSyntheticDOMRendererFactory(document) : null
    // });
  }

  // async function getCurrentSyntheticWindowDiffs(syntheticWindow: SyntheticWindow = cwindow) {
  //   const nenv = openTargetSyntheticWindow(syntheticWindow);
  //   await waitForDocumentComplete(nenv);
  //   return diffWindow(cenv, nenv);
  // }

  // let _reloading: boolean;
  // let _shouldReloadAgain: boolean;

  // function* reload(syntheticWindow: SyntheticWindow = cwindow) {

  //   if (_reloading) {
  //     _shouldReloadAgain = true;
  //     return;
  //   }

  //   if (cenv) {
  //     try {
  //       _reloading = true;
  //       const diffs = yield call(getCurrentSyntheticWindowDiffs, syntheticWindow);
  //       patchWindow(cenv, diffs);

  //     } catch(e) {
  //       console.warn(e);
  //     }
  //     _reloading = false;
  //     if (_shouldReloadAgain) {
  //       _shouldReloadAgain = false;
  //       yield reload(syntheticWindow);
  //     }
  //   } else {
  //     cenv = openTargetSyntheticWindow(syntheticWindow);
  //     // yield fork(watchNewWindow, syntheticWindow);
  //   }
  // }

}

const mapSEnvAttribute = ({name, value}: Attr) => ({
  name,
  value
})