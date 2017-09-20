import { expect } from "chai";
import { SEnvWindowInterface, diffCSSStyleSheet, patchCSSStyleSheet, flattenSyntheticCSSStyleSheetSources, SEnvCSSStyleSheetInterface } from "../../environment";
import { wrapHTML, openTestWindow, waitForDocumentComplete, stripCSSWhitespace } from "./utils";

describe(__filename + "#", () => {
  describe("basic", () => {
    it("can parse a style rule", async () => {
      const window = await openTestWindow(wrapHTML(`
      <style>
        body {
          margin: 0;
          padding: 0;
        }
      </style>`));
      await waitForDocumentComplete(window);
      const style = window.document.querySelector("style") as HTMLStyleElement;
      expect(style).not.to.be.undefined;
      expect((style.sheet as CSSStyleSheet).cssRules.length).to.eql(1); 
      const rule = (style.sheet as CSSStyleSheet).cssRules.item(0) as CSSStyleRule;
      expect(rule.selectorText).to.eql("body");
      expect(rule.style.margin).to.eql("0");
      expect(rule.style.padding).to.eql("0");
    });

    it("can parse a media rule", async () => {
      const window = await openTestWindow(wrapHTML(`
      <style>
        @media screen {
          a {
            b: 1;
          }
          c {
            d: 2;
          }
        }
      </style>`));
      await waitForDocumentComplete(window);
      const style = window.document.querySelector("style") as HTMLStyleElement;
      const rule = (style.sheet as CSSStyleSheet).cssRules.item(0) as CSSMediaRule;
      expect(rule.cssRules.length).to.eql(2);
    });

    it("can parse a font rule", async () => {
      const window = await openTestWindow(wrapHTML(`
      <style>
        @font-face test {
          color: red;
        }
      </style>`));
      await waitForDocumentComplete(window);
      const style = window.document.querySelector("style") as HTMLStyleElement;
      const rule = (style.sheet as CSSStyleSheet).cssRules.item(0) as CSSFontFaceRule;
      expect(rule.style.color).to.eql("red");
    });

    it("can parse an unknown rule", async () => {
      const window = await openTestWindow(wrapHTML(`
      <style>
        @unknown screen {
          a {
            b: 1;
          }
          c {
            d: 2;
          }
        }
      </style>`));
      await waitForDocumentComplete(window);
      const style = window.document.querySelector("style") as HTMLStyleElement;
      const rule = (style.sheet as CSSStyleSheet).cssRules.item(0) as CSSMediaRule;
      expect(rule.cssRules.length).to.eql(2);
    });

    it("can parse a keyframes rule", async () => {
      const window = await openTestWindow(wrapHTML(`
      <style>
        @keyframes test {
          0% {
            color: red;
          }
        }
      </style>`));
      await waitForDocumentComplete(window);
      const style = window.document.querySelector("style") as HTMLStyleElement;
      const rule = (style.sheet as CSSStyleSheet).cssRules.item(0) as CSSKeyframesRule;
      expect(rule.cssRules.length).to.eql(1);
    }); 

    it("can parse a media rule", async () => {
      const window = await openTestWindow(wrapHTML(`
      <style>
        @media screen {
          .container {
            color: red;
          }
        }
      </style>`));
      await waitForDocumentComplete(window);
      const style = window.document.querySelector("style") as HTMLStyleElement;
      const rule = (style.sheet as CSSStyleSheet).cssRules.item(0) as CSSMediaRule;
      expect(rule.conditionText).to.eql(`screen`);
      expect(rule.cssRules.length).to.eql(1);
    }); 
  });

  describe("diff/patch#", () => {
    [
      [
        `a { color: red; }`,
        `a { color: blue; }`
      ],
      [
        `a { color: red; }`,
        `b { color: red; }`
      ],
      [
        `a { color: red; }`,
        `b { color: red; } c { color: red; }`
      ],
      [
        `a { color: red; } c { color: red; }`,
        `c { color: red; } a { color: red; }`
      ],
      [
        `a { color: red; } c { color: red; }`,
        `c { color: red; }`
      ],
      [
        `a { } b { } c { } d { }`,
        `d { } c { } b { } a { }`,
      ],
      [
        `@media screen { a { color: red; } }`,
        `@media screen2 { a { color: red; } }`
      ],
      [
        `@media screen { a { color: red; } }`,
        `@media screen { b { color: red; } }`
      ],
      [
        `@media screen { a { color: red; } }`,
        `@media screen { a { color: blue; } }`
      ],
    ].forEach((variants) => {
      it(`can diff & patch ${variants.join(" -> ")}`, async () => {
        let main: SEnvWindowInterface;
        for (const variant of variants) {
          const current = await openTestWindow(wrapHTML(`
            <style>
              ${variant}
            </style>
          `));

          await waitForDocumentComplete(current);

          if (!main) {
            main = current;
            continue;
          }

          const mutations = diffCSSStyleSheet(main.document.stylesheets[0] as CSSStyleSheet, current.document.stylesheets[0] as CSSStyleSheet);
          const allObjects = flattenSyntheticCSSStyleSheetSources((main.document.stylesheets[0] as SEnvCSSStyleSheetInterface).struct);

          for (const mutation of mutations) {
            const target = allObjects[mutation.target.$id];
            patchCSSStyleSheet(target, mutation);
          }
          
          expect(stripCSSWhitespace((main.document.styleSheets[0] as CSSStyleSheet).cssText)).to.eql(stripCSSWhitespace(variant));
        }
      });
    });
  });
});