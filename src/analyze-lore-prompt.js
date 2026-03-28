import { createLorePromptAnalysisReport } from './lib/workflow.js';

createLorePromptAnalysisReport().then((result) => {
  process.stdout.write(`Lore prompt analysis report: ${result.reportPath}\n`);
}).catch((error) => {
  process.stderr.write(`${error.stack || error.message}\n`);
  process.exitCode = 1;
});
