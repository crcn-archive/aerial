"use strict";
function __export(m) {
    for (var p in m) if (!exports.hasOwnProperty(p)) exports[p] = m[p];
}
Object.defineProperty(exports, "__esModule", { value: true });
var aerial_common_1 = require("aerial-common");
var commonjs_evaluator_1 = require("./commonjs-evaluator");
var aerial_sandbox_1 = require("aerial-sandbox");
exports.createJavaScriptSandboxProviders = function () {
    return [
        new aerial_common_1.MimeTypeProvider("js", aerial_common_1.JS_MIME_TYPE),
        // new DependencyLoaderFactoryProvider(JS_MIME_TYPE, CommonJSandboxLoader),
        new aerial_sandbox_1.SandboxModuleEvaluatorFactoryProvider(aerial_common_1.JS_MIME_TYPE, commonjs_evaluator_1.CommonJSSandboxEvaluator),
    ];
};
__export(require("./commonjs-evaluator"));
//# sourceMappingURL=index.js.map