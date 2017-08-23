// https://github.com/tandemcode/tandem/blob/master/src/%40tandem/editor/browser/components/pages/workspace/mid/center/canvas/index.tsx#L270

import "./index.scss";
import * as React from "react";
import { Workspace } from "front-end/state";
import * as cx from "classnames";
import { ToolsLayer } from "./tools";
import { Windows } from "./windows";
import { Isolate } from "front-end/components/isolated";
import { Motion, spring } from "react-motion";
import { SyntheticBrowser, getSyntheticWindow } from "aerial-browser-sandbox";
import { Dispatcher, BaseEvent, Point } from "aerial-common2";
import { stageWheel, stageContainerMounted, stageMouseMoved } from "front-end/actions";
import { lifecycle, compose, withState, withHandlers, pure, withProps } from "recompose";


const stiffSpring = (amount: number) => spring(amount, { stiffness: 330, damping: 30 });

const PANE_SENSITIVITY = process.platform === "win32" ? 0.1 : 1;
const ZOOM_SENSITIVITY = process.platform === "win32" ? 2500 : 250;

export type StageOuterProps = {
  workspace: Workspace;
  browser: SyntheticBrowser;
  dispatch: Dispatcher<any>;
};

export type StageInnerProps = {
  canvasOuter: HTMLElement;
  onWheel: (event: React.SyntheticEvent<MouseEvent>) => any;
  shouldTransitionZoom: boolean;
  stageContainer: HTMLElement;
  setStageContainer(element: HTMLElement);
  onDrop: (event: React.SyntheticEvent<any>) => any;
  onMouseEvent: (event: React.SyntheticEvent<any>) => any;
  onMouseDown: (event: React.SyntheticEvent<any>) => any;
  onDragEnter: (event: React.SyntheticEvent<any>) => any;
  onDragExit: (event: React.SyntheticEvent<any>) => any;
  setCanvasOuter: (element: HTMLElement) => any;
} & StageOuterProps;

const enhanceStage = compose<StageInnerProps, StageOuterProps>(
  pure,
  withState('canvasOuter', 'setCanvasOuter', null),
  withState('stageContainer', 'setStageContainer', null),
  withHandlers({
    onMouseEvent: ({ setMousePosition, dispatch }) => (event: React.MouseEvent<any>) => {
      dispatch(stageMouseMoved(event));
    },
    setStageContainer: ({ dispatch, setStageContainer }) => (element: HTMLDivElement) => {
      setStageContainer(element);
      dispatch(stageContainerMounted(element));
    },
    onWheel: ({ workspace, dispatch, canvasOuter }: StageInnerProps) => (event: React.WheelEvent<any>) => {
      const rect = canvasOuter.getBoundingClientRect();
      event.preventDefault();
      dispatch(stageWheel(workspace.$id, rect.width, rect.height, event));
    }
  })
);

export const StageBase = ({ 
  setCanvasOuter,
  setStageContainer,
  workspace, 
  browser,
  dispatch, 
  onWheel,
  onDrop,
  onMouseEvent,
  shouldTransitionZoom,
  onDragEnter,
  onMouseDown,
  onDragExit
}: StageInnerProps) => {
  if (!workspace) return null;

  const { translate, cursor, fullScreenWindowId, smooth } = workspace.stage;

  const fullScreenWindow = fullScreenWindowId ? getSyntheticWindow(browser, fullScreenWindowId) : null;

  const outerStyle = {
    cursor: cursor || "default"
  }

  const motionTranslate = fullScreenWindow ? { left: -fullScreenWindow.bounds.left, top: -fullScreenWindow.bounds.top, zoom: 1 } : translate;
  

  const zoom = fullScreenWindow ? 1 : workspace.stage.translate.zoom;

  return <div className="stage-component" ref={setStageContainer}>
    <Isolate 
    inheritCSS 
    ignoreInputEvents
    className="stage-component-isolate"
    onWheel={onWheel} 
    scrolling={false} 
    translateMousePositions={false}
    >
      <span>
        <style>
          {
            `html, body {
              overflow: hidden;
            }`
          }
        </style>
        <div
          ref={setCanvasOuter}
          onMouseMove={onMouseEvent}
          onDragOver={onDragEnter}
          onDrop={onDrop}
          onMouseDown={onMouseDown}
          tabIndex={-1}
          onDragExit={onDragExit}
          className="stage-inner"
          style={outerStyle}>
            <Motion defaultStyle={{left:0, top: 0, zoom: 0}} style={{ left: smooth ? stiffSpring(motionTranslate.left) : motionTranslate.left, top: smooth ? stiffSpring(motionTranslate.top) : motionTranslate.top, zoom: smooth ? stiffSpring(motionTranslate.zoom) : motionTranslate.zoom }}>
              {(translate) => {
                  return <div style={{ transform: `translate(${translate.left}px, ${translate.top}px) scale(${translate.zoom})` }} className={cx({"stage-inner": true })}>

                  <Windows browser={browser} smooth={smooth} dispatch={dispatch} fullScreenWindowId={workspace.stage.fullScreenWindowId} />
                  <ToolsLayer workspace={workspace} translate={translate} dispatch={dispatch} browser={browser} />
                </div>
              }}
            </Motion>
        </div>
      </span>
    </Isolate>
  </div>;
}


export const Stage = enhanceStage(StageBase);

export * from "./tools";
