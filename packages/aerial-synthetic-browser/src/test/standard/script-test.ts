import { expect } from "chai";
import { LogLevel } from "aerial-common";
import { SyntheticBrowser, SyntheticHTMLElement } from "../..";
import { loadTestBrowser } from "../utils";

// poorly organized DOM spec tests. TODO - move these into sep fiels
describe(__filename + "#", () => {

  it("Can dynamically create a new script", async () => {
    const { window } = await loadTestBrowser({
      "index.html": `
        <span>
        </span>
        <script>
          var script = document.createElement("script");
          script.text = "document.querySelector('span').appendChild(document.createTextNode('a'))";
          document.appendChild(script);
        </script>
      `
    }, "index.html");

    expect(window.document.querySelector("span").textContent).to.contain("a");
  });

  it("Can set the text of a script after it's been added to the DOM", async () => {
    const { window } = await loadTestBrowser({
      "index.html": `
        <span>
        </span>
        <script>
          var script = document.createElement("script");
          document.appendChild(script);
          script.text = "document.querySelector('span').appendChild(document.createTextNode('a'))";
        </script>
      `
    }, "index.html");

    expect(window.document.querySelector("span").textContent).to.contain("a");
  });

});