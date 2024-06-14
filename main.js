import init, { parse_library } from "./pkg/honeybee.js";

await init();

const LIBRARY_SRC = `; Sequencing

(ground fact Seq
(.sample Str) (.at Int) (.data Str))

(derived fact ReadCountMatrix1
(.sample Str) (.at Int))

(derived fact ReadCountMatrix2
(.sample1 Str) (.sample2 Str) (.at Int))

(computation load_local_reads ReadCountMatrix1
((seq Seq))
((= (.sample ret) (.sample seq))
 (= (.at ret) (.at seq))))

(computation aggregate_reads ReadCountMatrix2
((rcm1 ReadCountMatrix1) (rcm2 ReadCountMatrix1))
((= (.sample1 ret) (.sample rcm1))
 (= (.sample2 ret) (.sample rcm2))
 (= (.at ret) (.at q1))
 (= (.at q1) (.at q2))))

; Bulk RNA-seq

(derived fact DifferentialGeneExpression
(.sample1 Str) (.sample2 Str) (.at Int))

(computation combat_seq ReadCountMatrix2
((rcm ReadCountMatrix2))
((= (.sample1 ret) (.sample1 rcm))
 (= (.sample2 ret) (.sample2 rcm))
 (= (.at ret) (.at rcm))))

(computation deseq2 DifferentialGeneExpression
((rcm ReadCountMatrix2))
((= (.sample1 ret) (.sample1 rcm))
 (= (.sample2 ret) (.sample2 rcm))
 (= (.at ret) (.at rcm))))

; Transfection and growth

(ground fact Transfect
(.sample Str) (.at Int) (.library Str))

(derived fact GrowthPhenotype
(.sample Str) (.start Int) (.end Int))

(computation growth_phenotype GrowthPhenotype
((t Transfect)
 (rcm1 ReadCountMatrix1)
 (rcm2 ReadCountMatrix1))
((= (.sample ret) (.sample t))
 (= (.start ret) (.at rcm1))
 (= (.end ret) (.at rcm2))
 (= (.sample t) (.sample rcm1))
 (= (.sample t) (.sample rcm2))
 (< (.at t) (.at rcm1))
 (< (.at rcm1) (.at rcm2))))`;

const library = parse_library(LIBRARY_SRC);
console.log(library);

function toolboxEntry() {}

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
        s += ` ${value}`;
      } else if (parameter_type === "Str") {
        s += ` "${value}"`;
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

const workspaceDiv = document.querySelector("#blockly");

const workspace = Blockly.inject(workspaceDiv, {
  toolbox: blocklyToolbox,
  move: { scrollbars: true, wheel: true },
  zoom: { controls: true },
  sounds: false,
});

workspace.addChangeListener(Blockly.Events.disableOrphans);

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

window.addEventListener("resize", (_) => {
  Blockly.svgResize(workspace);
});

// CLI Helpers

export function compile() {
  return Blockly.JavaScript.workspaceToCode(workspace);
}

export function saveStorage() {
  const state = Blockly.serialization.workspaces.save(workspace);
  localStorage.setItem("workspace-state", JSON.stringify(state));
}

export function loadStorage() {
  const state = localStorage.getItem("workspace-state");
  Blockly.serialization.workspaces.load(JSON.parse(state), workspace);
}

export function clearStorage() {
  localStorage.removeItem("workspace-state");
}

export function clearCurrent() {
  workspace.clear();
}
