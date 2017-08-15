import { reader } from "../monad";
import { parallel, circular } from "mesh";
import { flowRight } from "lodash";
import { ImmutableObject } from "../immutable";
import { createStore, Reducer, Store, applyMiddleware, Middleware } from "redux";
import { SagaIterator, default as createSagaMiddleware } from "redux-saga";
import { fork } from "redux-saga/effects";
import { createAction, Dispatcher } from "../bus";
import { identify } from "lodash";
import { 
  logger,
  logInfoAction, 
  consoleLogSaga,
  ConsoleLogState,
} from "../log";

export type BaseApplicationState = ConsoleLogState;

export const initBaseApplication2 = <TState>(initialState: TState, reducer: Reducer<TState>, mainSaga: () => Iterator<any>, ...middleware: Middleware[]) => {
  const sagaMiddleware = createSagaMiddleware();
  const store = createStore(
    reducer, 
    initialState,
    applyMiddleware(sagaMiddleware, ...middleware)
  );

  sagaMiddleware.run(function*() {
    yield fork(consoleLogSaga);
    yield fork(mainSaga);
  });

  return store;
};
