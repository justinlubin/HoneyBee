// Blockly.defineBlocksWithJsonArray([
//   {
//     type: "Seq",
//     message0: "Seq\n• sample: %1\n• at: %2\n• data: %3",
//     args0: [
//       {
//         type: "field_input",
//         name: "sample",
//       },
//       {
//         type: "field_number",
//         name: "at",
//       },
//       {
//         type: "field_input",
//         name: "at",
//       },
//     ],
//     previousStatement: null,
//     nextStatement: null,
//     colour: 200,
//   },
//   {
//     type: "DifferentialExpression",
//     message0: "DifferentialExpression\n• sample1: %1\n• sample2: %2\n• at: %3",
//     args0: [
//       {
//         type: "field_input",
//         name: "sample1",
//       },
//       {
//         type: "field_input",
//         name: "sample2",
//       },
//       {
//         type: "field_number",
//         name: "at",
//       },
//     ],
//     output: null,
//     colour: 300,
//   },
// ]);

Blockly.JavaScript.forBlock["Seq"] = function (block, _) {
  const sample = block.getFieldValue("sample");
  const at = block.getFieldValue("at");
  return `  (Seq ${sample} ${at})\n`;
};

Blockly.JavaScript.forBlock["DifferentialExpression"] = function (block, _) {
  const sample1 = block.getFieldValue("sample1");
  const sample2 = block.getFieldValue("sample2");
  const at = block.getFieldValue("at");
  return `(DifferentialExpression ${sample1} ${sample2} ${at})`;
};
