import "./overlay.scss";
const cx = require("classnames");
import * as React from "react";
import * as Hammer from "react-hammerjs";
import { Workspace } from "front-end/state";
import { difference } from "lodash";
import { mapValues, values } from "lodash";
import { compose, pure, withHandlers } from "recompose";
import { SyntheticNode, SyntheticWindow, SyntheticBrowser } from "aerial-browser-sandbox";
import { Dispatcher, Bounds, wrapEventToDispatch, weakMemo, StructReference } from "aerial-common2";
import { 
  stageToolOverlayMouseLeave,
  stageToolOverlayMousePanStart,
  stageToolOverlayMousePanning,
  stageToolOverlayMousePanEnd,
  stageToolOverlayMouseDoubleClicked,
} from "front-end/actions";

export type VisualToolsProps = {
  zoom: number;
  workspace: Workspace;
  browser: SyntheticBrowser;
  dispatch: Dispatcher<any>;
};

type WindowOverlayToolsOuterProps = {
  dispatch: Dispatcher<any>;
  window: SyntheticWindow;
  zoom: number;
  hoveringNodes: SyntheticNode[];
};

type WindowOverlayToolsInnerProps = {
  onPanStart(event: any);
  onPan(event: any);
  onPanEnd(event: any);
} & WindowOverlayToolsOuterProps;

type NodeOverlayProps = {
  windowId: string;
  bounds: Bounds;
  zoom: number;
  hovering: boolean;
  node: SyntheticNode;
  dispatch: Dispatcher<any>;
};

const NodeOverlayBase = ({ windowId, zoom, bounds, node, dispatch, hovering }: NodeOverlayProps) => {

  const borderWidth = 2 / zoom;

  const style = {
    left: bounds.left,
    top: bounds.top,
    width: bounds.right - bounds.left,
    height: bounds.bottom - bounds.top,
    boxShadow: `inset 0 0 0 ${borderWidth}px #00B5FF`
  };

  return <div 
  className={cx("visual-tools-node-overlay", { hovering: hovering })}
  style={style} />;
}

const NodeOverlay = pure(NodeOverlayBase as any) as typeof NodeOverlayBase;

const WindowOverlayToolsBase = ({ dispatch, window, hoveringNodes, zoom, onPanStart, onPan, onPanEnd }: WindowOverlayToolsInnerProps) => {

  const style = {
    position: "absolute",
    left: window.bounds.left,
    top: window.bounds.top,
    width: window.bounds.right - window.bounds.left,
    height: window.bounds.bottom - window.bounds.top
  };

  return <div style={style as any}>
    <Hammer onPanStart={onPanStart} onPan={onPan} onPanEnd={onPanEnd} direction="DIRECTION_ALL">
      <div 
        style={{ width: "100%", height: "100%", position: "absolute" } as any} 
        onDoubleClick={wrapEventToDispatch(dispatch, stageToolOverlayMouseDoubleClicked.bind(this, window.$id))}>
      {
        hoveringNodes.map((node) => <NodeOverlay 
          windowId={window.$id} 
          zoom={zoom} 
          key={node.$id} 
          node={node} 
          bounds={window.allComputedBounds[node.$id]} 
          dispatch={dispatch} 
          hovering={true} />)
      }
    </div>
    </Hammer>
  </div>
};

const enhanceWindowOverlayTools = compose<WindowOverlayToolsInnerProps, WindowOverlayToolsOuterProps>(
  pure,
  withHandlers({
    onPanStart: ({ dispatch, window }: WindowOverlayToolsOuterProps) => (event) => {
      dispatch(stageToolOverlayMousePanStart(window.$id));
    },
    onPan: ({ dispatch, window }: WindowOverlayToolsOuterProps) => (event) => {
      dispatch(stageToolOverlayMousePanning(window.$id, { left: event.center.x, top: event.center.y }, event.deltaY, event.velocityY));
    },
    onPanEnd: ({ dispatch, window }: WindowOverlayToolsOuterProps) => (event) => {

      setImmediate(() => {
        dispatch(stageToolOverlayMousePanEnd(window.$id));
      });
    }
  })
);

const WindowOverlayTools = enhanceWindowOverlayTools(WindowOverlayToolsBase);


const getSyntheticNodes = weakMemo((refs: StructReference[], allNodes: any) => {
  return refs.map(([type, id]) => allNodes[id]).filter((id) => !!id);
});


const getHoveringSyntheticNodes = weakMemo((workspace: Workspace, { allNodes }: SyntheticWindow) => {
  return difference(
    getSyntheticNodes(workspace.hoveringRefs, allNodes),
    getSyntheticNodes(workspace.selectionRefs, allNodes)
  );
});


export const  NodeOverlaysToolBase = ({ workspace, browser, dispatch, zoom }: VisualToolsProps) => {
  return <div className="visual-tools-layer-component">
    {
      browser.windows.map((window) => {
        return <WindowOverlayTools key={window.$id} hoveringNodes={getHoveringSyntheticNodes(workspace, window)} window={window} dispatch={dispatch} zoom={zoom} />;
      })
    }
  </div>
}

export const  NodeOverlaysTool = pure( NodeOverlaysToolBase as any) as typeof  NodeOverlaysToolBase;