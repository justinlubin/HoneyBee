const workspaceDiv = document.getElementById("blockly");

const workspace = Blockly.inject(workspaceDiv, {
  toolbox: BLOCKLY_TOOLBOX,
  move: { scrollbars: true, wheel: true },
  zoom: { controls: true },
  sounds: false,
});

workspace.addChangeListener(Blockly.Events.disableOrphans);

Blockly.Blocks["toplevel"] = {
  init: function () {
    this.setDeletable(false);
    this.setColour(120);
    this.appendStatementInput("facts").appendField("Facts");
    this.appendValueInput("goal").appendField("Goal");
  },
};
Blockly.JavaScript.forBlock["toplevel"] = function (block, _) {
  return "TODO";
};

function addTop() {
  Blockly.serialization.blocks.append(
    { type: "toplevel", x: 30, y: 30 },
    workspace,
  );
}

addTop();

function compile() {
  return Blockly.JavaScript.workspaceToCode(workspace);
}

function saveStorage() {
  const state = Blockly.serialization.workspaces.save(workspace);
  localStorage.setItem("workspace-state", JSON.stringify(state));
}

function loadStorage() {
  // Get your saved state from somewhere, e.g. local storage.
  const state = localStorage.getItem("workspace-state");

  // Deserialize the state.
  Blockly.serialization.workspaces.load(JSON.parse(state), workspace);
}

function clearStorage() {
  localStorage.removeItem("workspace-state");
}

function clearCurrent() {
  workspace.clear();
}

window.addEventListener("resize", function (_) {
  Blockly.svgResize(workspace);
});
