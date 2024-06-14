import init, * as Honeybee from "./pkg/honeybee.js";

////////////////////////////////////////////////////////////////////////////////
// Helpers

// https://stackoverflow.com/a/18197341
function download(filename, text) {
  const element = document.createElement("a");
  element.setAttribute(
    "href",
    "data:text/plain;charset=utf-8," + encodeURIComponent(text),
  );
  element.setAttribute("download", filename);

  element.style.display = "none";
  document.body.appendChild(element);

  element.click();

  document.body.removeChild(element);
}

////////////////////////////////////////////////////////////////////////////////
// Initialize Rust

await init();

////////////////////////////////////////////////////////////////////////////////
// Load library

const libraryRes = await fetch("biology.hblib");
const librarySrc = await libraryRes.text();
const library = Honeybee.parse_library(librarySrc);

const impRes = await fetch("biology.py");
const impSrc = await impRes.text();

////////////////////////////////////////////////////////////////////////////////
// Construct Blockly blocks from library

const blockDefinitions = [];
const toolboxFacts = [];
const toolboxGoals = [];

for (const fs of library.fact_signatures) {
  const name = fs.name;

  let message = name;
  const params = [];
  for (const [i, [parameter_name, parameter_type]] of fs.params.entries()) {
    message += `\n• ${parameter_name}: %${i + 1}`;
    let field_type;
    if (parameter_type === "Int") {
      field_type = "number";
    } else if (parameter_type === "Str") {
      field_type = "input";
    } else {
      throw new Error(
        `Unknown parameter type for ${parameter_name}: ${parameter_type}`,
      );
    }

    params.push({ type: `field_${field_type}`, name: parameter_name });
  }

  let wrapper;

  if (fs.kind === "Annotation") {
    blockDefinitions.push({
      type: name,
      message0: message,
      args0: params,
      previousStatement: null,
      nextStatement: null,
      colour: 200,
    });

    toolboxFacts.push({ kind: "block", type: name });

    wrapper = (x) => x;
  } else if (fs.kind === "Analysis") {
    blockDefinitions.push({
      type: name,
      message0: message,
      args0: params,
      output: null,
      colour: 300,
    });

    toolboxGoals.push({ kind: "block", type: name });

    wrapper = (x) => [x, Blockly.JavaScript.ORDER_ATOMIC];
  } else {
    throw new Error(`Unknown fact signature kind: ${fs.kind}`);
  }

  Blockly.JavaScript.forBlock[name] = (block, _) => {
    let s = `(${name}`;

    for (const [parameter_name, parameter_type] of fs.params) {
      const value = block.getFieldValue(parameter_name);
      if (parameter_type === "Int") {
        s += ` (.${parameter_name} ${value})`;
      } else if (parameter_type === "Str") {
        s += ` (.${parameter_name} "${value}")`;
      } else {
        throw new Error(
          `Unknown parameter type for ${parameter_name}: ${parameter_type}`,
        );
      }
    }

    s += ")\n";

    return wrapper(s);
  };
}

Blockly.defineBlocksWithJsonArray(blockDefinitions);

const blocklyToolbox = {
  kind: "flyoutToolbox",
  contents: [
    {
      kind: "label",
      text: "Facts",
    },
  ]
    .concat(toolboxFacts)
    .concat([
      {
        kind: "label",
        text: "Goals",
      },
    ])
    .concat(toolboxGoals),
};

////////////////////////////////////////////////////////////////////////////////
// Initialize Blockly

const workspaceDiv = document.querySelector("#blockly");

const workspace = Blockly.inject(workspaceDiv, {
  toolbox: blocklyToolbox,
  move: { scrollbars: true, wheel: true },
  zoom: { controls: true },
  sounds: false,
});

workspace.addChangeListener(Blockly.Events.disableOrphans);

window.addEventListener("resize", (_) => {
  Blockly.svgResize(workspace);
});

////////////////////////////////////////////////////////////////////////////////
// Define Blockly top-level block

Blockly.Blocks.toplevel = {
  init() {
    this.setDeletable(false);
    this.setColour(120);
    this.appendStatementInput("facts").appendField("Facts");
    this.appendValueInput("goal").appendField("Goal");
  },
};

Blockly.JavaScript.forBlock.toplevel = (block, generator) => {
  const facts = generator.statementToCode(block, "facts");
  const goal = generator.valueToCode(
    block,
    "goal",
    Blockly.JavaScript.ORDER_ATOMIC,
  );
  return `(facts\n  ${facts.trim()})\n\n(goal\n  ${goal.trim()})`;
};

Blockly.serialization.blocks.append(
  { type: "toplevel", x: 30, y: 30 },
  workspace,
);

////////////////////////////////////////////////////////////////////////////////
// Compile

const compileButton = document.getElementById("compile");

compileButton.addEventListener("click", (_) => {
  const progSrc = Blockly.JavaScript.workspaceToCode(workspace);
  try {
    const notebook = Honeybee.generate_notebook(librarySrc, impSrc, progSrc);
    download("analysis.ipynb", notebook);
  } catch (e) {
    alert(e);
  }
});

////////////////////////////////////////////////////////////////////////////////
// Helpers

// export function saveStorage() {
//   const state = Blockly.serialization.workspaces.save(workspace);
//   localStorage.setItem("workspace-state", JSON.stringify(state));
// }
//
// export function loadStorage() {
//   const state = localStorage.getItem("workspace-state");
//   Blockly.serialization.workspaces.load(JSON.parse(state), workspace);
// }
//
// export function clearStorage() {
//   localStorage.removeItem("workspace-state");
// }
//
// export function clearCurrent() {
//   workspace.clear();
// }
