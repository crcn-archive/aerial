import { 
  Bounds,
  IDd,
  moved,
  removed,
  resized,
  update,
  Struct,
  moveBounds,
  zoomBounds,
  updateIn, 
  Translate,
  BaseEvent, 
  boundsFromRect,
  getBoundsSize,
  mergeBounds,
  mapImmutable, 
  keepBoundsCenter,
  getSmallestBounds,
  scaleInnerBounds,
  boundsIntersect,
  StructReference,
  getStructReference,
  pointIntersectsBounds,
  keepBoundsAspectRatio,
  centerTransformZoom,
} from "aerial-common2";

import { clamp } from "lodash";
import { fileCacheReducer, getFileCacheItemByUri, FileCacheItem, updateFileCacheItem } from "aerial-sandbox2";

import { 
  Workspace,
  ApplicationState,
  updateWorkspace,
  getWorkspaceById,
  ShortcutServiceState,
  getSelectedWorkspace,
  addWorkspaceSelection,
  setWorkspaceSelection,
  getSyntheticBrowserBounds,
  createApplicationState,
  clearWorkspaceSelection,
  removeWorkspaceSelection,
  toggleWorkspaceSelection,
  getSelectedWorkspaceFile,
  getWorkspaceSelectionBounds,
  getSyntheticNodeWorkspace,
  getBoundedWorkspaceSelection,
  getSyntheticWindowWorkspace,
  getStageToolMouseNodeTargetReference,
} from "front-end/state";

import {
  StageToolOverlayMouseMoved,
  StageToolOverlayClicked,
  STAGE_MOUNTED,
  StageMounted,
  StageToolEditTextChanged,
  STAGE_TOOL_EDIT_TEXT_CHANGED,
  STAGE_TOOL_OVERLAY_MOUSE_PAN_END,
  STAGE_TOOL_OVERLAY_MOUSE_LEAVE,
  STAGE_TOOL_OVERLAY_MOUSE_PAN_START,
  StageToolOverlayMousePanStart,
  StageToolOverlayMousePanEnd,
  SELECTOR_DOUBLE_CLICKED,
  SelectorDoubleClicked,
  WorkspaceSelectionDeleted,
  WORKSPACE_DELETION_SELECTED,
  STAGE_TOOL_OVERLAY_MOUSE_DOUBLE_CLICKED,
  STAGE_TOOL_OVERLAY_MOUSE_CLICKED,
  STAGE_TOOL_OVERLAY_MOUSE_MOVED,
  StageToolNodeOverlayHoverOut,
  StageToolNodeOverlayHoverOver,
  StageToolNodeOverlayClicked,
  STAGE_TOOL_WINDOW_KEY_DOWN,
  RESIZER_MOUSE_DOWN,
  ResizerMouseDown,
  STAGE_TOOL_WINDOW_BACKGROUND_CLICKED,
  StageWillWindowKeyDown,
  keyboardShortcutAdded,
  CANVAS_ELEMENTS_COMPUTED_PROPS_CHANGED,
  CanvasElementsComputedPropsChanged,
  ResizerPathMoved,
  FILE_NAVIGATOR_ADD_FOLDER_BUTTON_CLICKED,
  FILE_NAVIGATOR_ADD_FILE_BUTTON_CLICKED,
  StageWillWindowTitleClicked,
  STAGE_TOOL_WINDOW_TITLE_CLICKED,
  RESIZER_PATH_MOUSE_MOVED,
  ResizerMoved,
  RESIZER_MOVED,
  KeyboardShortcutAdded,
  TEXT_EDITOR_CHANGED,
  textEditorChanged,
  TOGGLE_LEFT_GUTTER_PRESSED,
  TOGGLE_RIGHT_GUTTER_PRESSED,
  PromptedNewWindowUrl,
  TREE_NODE_LABEL_CLICKED,
  TreeNodeLabelClicked,
  WindowPaneRowClicked,
  WINDOW_PANE_ROW_CLICKED,
  PROMPTED_NEW_WINDOW_URL,
  KEYBOARD_SHORTCUT_ADDED,
  DELETE_SHORCUT_PRESSED,
  DeleteShortcutPressed,
  VISUAL_EDITOR_WHEEL,
  StageWheel,
} from "front-end/actions";

import { 
  SyntheticNode,
  getSyntheticWindow, 
  getSyntheticBrowser,
  syntheticBrowserReducer, 
  openSyntheticWindowRequest,
  getSyntheticNodeById
} from "aerial-browser-sandbox";

import reduceReducers = require("reduce-reducers");

export const applicationReducer = (state: ApplicationState = createApplicationState(), event: BaseEvent) => {
  switch(event.type) {
    case TREE_NODE_LABEL_CLICKED: {
      const { node } = event as TreeNodeLabelClicked;
      return updateWorkspace(state, state.selectedWorkspaceId, {
        selectedFileId: node.$$id
      });
    }

    case TEXT_EDITOR_CHANGED: {
      const { file, value } = event as textEditorChanged;
      return updateFileCacheItem(state, file.$$id, { content: value });
    }

    case FILE_NAVIGATOR_ADD_FILE_BUTTON_CLICKED: {
      const changedEvent = event as textEditorChanged;
      break;
    }

    case FILE_NAVIGATOR_ADD_FOLDER_BUTTON_CLICKED: {
      const changedEvent = event as textEditorChanged;
      break;
    }
  }
  
  // state = canvasReducer(state, event);
  // state = syntheticBrowserReducer(state, event);
  state = syntheticBrowserReducer(state, event);
  state = stageReducer(state, event);
  state = windowPaneReducer(state, event);
  state = shortcutServiceReducer(state, event);
  state = fileCacheReducer(state, event);

  return state;
};

// const canvasReducer = (state: ApplicationState, event: BaseEvent) => {
//   switch(event.type) {
//     case CANVAS_ELEMENTS_COMPUTED_PROPS_CHANGED: {
//       const { allComputedStyles, allComputedBounds, syntheticWindowId } = event as CanvasElementsComputedPropsChanged;
//       const window = getSyntheticBrowserWindow(state, syntheticWindowId);
//       return updateStruct(state, window, {
//         ...window,
//         allComputedBounds,
//         allComputedStyles
//       });
//     }
//   }

//   return state;
// };

const PANE_SENSITIVITY = process.platform === "win32" ? 0.1 : 1;
const ZOOM_SENSITIVITY = process.platform === "win32" ? 2500 : 250;
const MIN_ZOOM = 0.02;
const MAX_ZOOM = 6400 / 100;
const INITIAL_ZOOM_PADDING = 50;

const stageReducer = (state: ApplicationState, event: BaseEvent) => {

  switch(event.type) {
    case VISUAL_EDITOR_WHEEL: {
      const { workspaceId, metaKey, ctrlKey, deltaX, deltaY, mouseX, mouseY, canvasHeight, canvasWidth } = event as StageWheel;
      const workspace = getWorkspaceById(state, workspaceId);
      let translate = workspace.stage.translate;

      if (metaKey || ctrlKey) {
        translate = centerTransformZoom(translate, boundsFromRect({
          width: canvasWidth,
          height: canvasHeight
        }), clamp(translate.zoom + translate.zoom * deltaY / ZOOM_SENSITIVITY, MIN_ZOOM, MAX_ZOOM), { left: mouseX, top: mouseY });

      } else {
        translate = {
          ...translate,
          left: translate.left - deltaX,
          top: translate.top - deltaY
        };
      }

      return updateWorkspace(state, workspace.$$id, {
        stage: {
          ...workspace.stage,
          translate
        }
      });
    }

    case RESIZER_PATH_MOUSE_MOVED: {
      let { workspaceId, anchor, box: newBounds, sourceEvent } = event as ResizerPathMoved;
      const workspace = getWorkspaceById(state, workspaceId);

      // TODO - possibly use BoundsStruct instead of Bounds since there are cases where box prop doesn't exist
      const bounds = getWorkspaceSelectionBounds(state, workspace);

      const keepAspectRatio = sourceEvent.shiftKey;
      const keepCenter      = sourceEvent.altKey;

      if (keepCenter) {
        // newBounds = keepBoundsCenter(newBounds, bounds, anchor);
      }

      if (keepAspectRatio) {
        newBounds = keepBoundsAspectRatio(newBounds, bounds, anchor, keepCenter ? { left: 0.5, top: 0.5 } : anchor);
      }

      for (const item of getBoundedWorkspaceSelection(state, workspace)) {
        const box = getSyntheticBrowserBounds(state, item);
        const scaledBounds = scaleInnerBounds(box, bounds, newBounds);
        state = applicationReducer(state, resized(item.$$id, item.$$type, scaleInnerBounds(box, bounds, newBounds)));
      }
      return state;
    }

    case PROMPTED_NEW_WINDOW_URL: {
      const { workspaceId, location } = event as PromptedNewWindowUrl;
      return applicationReducer(state, openSyntheticWindowRequest(location, getWorkspaceById(state, workspaceId).browserId));
    }

    case TOGGLE_LEFT_GUTTER_PRESSED: {
      const workspace = getSelectedWorkspace(state);
      return updateWorkspace(state, workspace.$$id, {
        stage: {
          ...workspace.stage,
          showLeftGutter: !workspace.stage.showLeftGutter
        }
      });
    }

    case STAGE_TOOL_OVERLAY_MOUSE_MOVED: {
      const { sourceEvent, windowId } = event as StageToolOverlayMouseMoved;
      const workspace = getSyntheticWindowWorkspace(state, windowId);

      // disable hovering while panning (scrolling)
      if (workspace.stage.panning) return updateWorkspace(state, workspace.$$id, {
        hoveringRefs: []
      });
      const targetRef = getStageToolMouseNodeTargetReference(state, event as StageToolOverlayMouseMoved);
      return updateWorkspace(state, workspace.$$id, {
        hoveringRefs: targetRef ? [targetRef] : []
      });
    }

    case STAGE_TOOL_OVERLAY_MOUSE_LEAVE: {
      const { sourceEvent, windowId } = event as StageToolOverlayMouseMoved;
      const workspace = getSyntheticWindowWorkspace(state, windowId);
      return updateWorkspace(state, workspace.$$id, {
        hoveringRefs: []
      });
    }

    case RESIZER_MOUSE_DOWN: {
      const { sourceEvent, workspaceId } = event as ResizerMouseDown;
      const metaKey = sourceEvent.metaKey || sourceEvent.ctrlKey;
      const workspace = getWorkspaceById(state, workspaceId);

      if (metaKey && workspace.selectionRefs.length === 1) {
        return setSelectedFileFromNodeId(state, workspace.$$id, workspace.selectionRefs[0][1]);
      }

      return state;
    }

    case STAGE_MOUNTED: {
      const { element } = event as StageMounted;
      const { width, height } = element.getBoundingClientRect();
      const workspace = getSelectedWorkspace(state);

      const innerBounds = getSyntheticBrowser(state, workspace.browserId).windows.map(window => window.box).reduce((a, b) => ({
        left: Math.min(a.left, b.left),
        top: Math.min(a.top, b.top),
        right: Math.max(a.right, b.right),
        bottom: Math.max(a.bottom, b.bottom)
      }), { left: 0, top: 0, right: 0, bottom: 0 });

      const innerSize = getBoundsSize(innerBounds);

      const centered = {
        left: innerBounds.left + width / 2 - (innerBounds.right - innerBounds.left) / 2,
        top: innerBounds.top + height / 2 - (innerBounds.bottom - innerBounds.top) / 2,
      };

      const scale = Math.min(
        (width - INITIAL_ZOOM_PADDING) / innerSize.width,
        (height - INITIAL_ZOOM_PADDING) / innerSize.height
      );

      return updateWorkspace(state, workspace.$$id, {
        stage: {
          ...workspace.stage,
          translate: centerTransformZoom({
            ...centered,
            zoom: 1
          }, { left: 0, top: 0, right: width, bottom: height }, scale)
        }
      });
    };

    case STAGE_TOOL_OVERLAY_MOUSE_PAN_START: {
      const { windowId } = event as StageToolOverlayMousePanStart;
      const workspace = getSyntheticWindowWorkspace(state, windowId);
      return updateWorkspace(state, workspace.$$id, {
        stage: {
          ...workspace.stage,
          panning: true
        }
      });
    }
    
    case STAGE_TOOL_OVERLAY_MOUSE_PAN_END: {
      const { windowId } = event as StageToolOverlayMousePanEnd;
      const workspace = getSyntheticWindowWorkspace(state, windowId)
      return updateWorkspace(state, workspace.$$id, {
        stage: {
          ...workspace.stage,
          panning: false
        }
      });
    }

    case STAGE_TOOL_OVERLAY_MOUSE_CLICKED: {
      const { sourceEvent, windowId } = event as StageToolNodeOverlayClicked;
      const metaKey = sourceEvent.metaKey || sourceEvent.ctrlKey;

      // alt key opens up a new link
      const altKey = sourceEvent.altKey;
      const workspace = getSyntheticWindowWorkspace(state, windowId);
      
      // do not allow selection while window is panning (scrolling)
      if (workspace.stage.panning) return state;

      const targetRef = getStageToolMouseNodeTargetReference(state, event as StageToolNodeOverlayClicked);
      if (!targetRef) {
        return clearWorkspaceSelection(state, workspace.$$id);
      }
      if (metaKey) {
        return setSelectedFileFromNodeId(state, workspace.$$id, targetRef[1]);
      } else if (!altKey) {
        state = handleWindowSelectionFromAction(state, targetRef, event as StageToolNodeOverlayClicked);
        state = updateWorkspace(state, workspace.$$id, {
          secondarySelection: false
        });
        return state;
      }
      return state;
    }

    case STAGE_TOOL_OVERLAY_MOUSE_DOUBLE_CLICKED: {
      const { sourceEvent, windowId } = event as StageToolNodeOverlayClicked;
      const workspace = getSyntheticWindowWorkspace(state, windowId);
      const targetRef = getStageToolMouseNodeTargetReference(state, event as StageToolNodeOverlayClicked);
      if (!targetRef) return state;      

      state = updateWorkspace(state, workspace.$$id, {
        secondarySelection: true
      });

      state = setWorkspaceSelection(state, workspace.$$id, targetRef);

      return state;
    }

    case SELECTOR_DOUBLE_CLICKED: {
      const { sourceEvent, item } = event as SelectorDoubleClicked;
      const workspace = getSyntheticNodeWorkspace(state, item.$$id);
      state = updateWorkspace(state, workspace.$$id, {
        secondarySelection: true
      });
      state = setWorkspaceSelection(state, workspace.$$id, getStructReference(item));
      return state;
    }

    case TOGGLE_RIGHT_GUTTER_PRESSED: {
      const workspace = getSelectedWorkspace(state);
      return updateWorkspace(state, workspace.$$id, {
        stage: {
          ...workspace.stage,
          showRightGutter: !workspace.stage.showRightGutter
        }
      });
    }

    case WORKSPACE_DELETION_SELECTED: {
      const { workspaceId } = event as WorkspaceSelectionDeleted;
      return clearWorkspaceSelection(state, workspaceId);
    }

    case STAGE_TOOL_WINDOW_TITLE_CLICKED: {
      return handleWindowSelectionFromAction(state, getStructReference(getSyntheticWindow(state, (event as WindowPaneRowClicked).windowId)), event as WindowPaneRowClicked);
    }

    case STAGE_TOOL_WINDOW_KEY_DOWN: {
      const e = event as StageWillWindowKeyDown;
      // return moveItemFromAction(state, e.windowId, e);
      return state;
    }

    case STAGE_TOOL_WINDOW_BACKGROUND_CLICKED: {
      const workspace = getSelectedWorkspace(state);
      return clearWorkspaceSelection(state, workspace.$$id);
    }
  }

  return state;
}

const moveItemFromAction = <T extends { sourceEvent: React.KeyboardEvent<any> }>(state: ApplicationState, itemId: string, event: T) => {
  const { sourceEvent } = event;
  const item = getSyntheticNodeById(state, itemId);

  // TODO - prop may not exist here -- need to use getBounds instead
  const box = item.box;
  switch(sourceEvent.key) {
    case "ArrowDown": {
      return applicationReducer(state, moved(item.$$id, item.$$type, moveBounds(box, { ...box, top: box.top + 1 })));
    }
    case "ArrowUp": {
      return applicationReducer(state, moved(item.$$id, item.$$type, moveBounds(box, { ...box, top: box.top - 1 })));
    }
    case "ArrowLeft": {
      return applicationReducer(state, moved(item.$$id, item.$$type, moveBounds(box, { ...box, left: box.left - 1 })));
    }
    case "ArrowRight": {
      return applicationReducer(state, moved(item.$$id, item.$$type, moveBounds(box, { ...box, left: box.left + 1 })));
    }
  }

  return state;
};

const handleWindowSelectionFromAction = <T extends { sourceEvent: React.MouseEvent<any>, windowId }>(state: ApplicationState, ref: StructReference, event: T) => {
  const { windowId, sourceEvent } = event;
  const workspace = getSyntheticWindowWorkspace(state, windowId);
  return sourceEvent.metaKey || sourceEvent.ctrlKey ? addWorkspaceSelection(state, workspace.$$id, ref) : toggleWorkspaceSelection(state, workspace.$$id, ref);
}

const windowPaneReducer = (state: ApplicationState, event: BaseEvent) => {
  switch (event.type) {
    case WINDOW_PANE_ROW_CLICKED: {
      return handleWindowSelectionFromAction(state, getStructReference(getSyntheticWindow(state, (event as WindowPaneRowClicked).windowId)), event as WindowPaneRowClicked);
    }
  }
  return state;
};

const setSelectedFileFromNodeId = (state: ApplicationState, workspaceId: string, nodeId: string) => {
  const { source: { uri, start } } = getSyntheticNodeById(state, nodeId) as SyntheticNode;
  const fileCacheItem = getFileCacheItemByUri(state, uri);
  if (fileCacheItem) {
    return updateWorkspace(state, workspaceId, {
      textCursorPosition: start,
      selectedFileId: fileCacheItem.$$id,
    });
  }
  return state;
}
const shortcutServiceReducer = <T extends ShortcutServiceState>(state: ApplicationState, event: BaseEvent) => {
  switch(event.type) {
    case KEYBOARD_SHORTCUT_ADDED: {
      const { keyCombo, action } = event as KeyboardShortcutAdded;
      return update(state, "shortcuts", [...(state.shortcuts || []), { keyCombo, action }]);
    }
  }
  return state;
}
