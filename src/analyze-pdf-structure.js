import { createPdfStructureAnalysisReport } from './lib/workflow.js';

createPdfStructureAnalysisReport().then((result) => {
  process.stdout.write(`PDF structure analysis report: ${result.reportPath}\n`);
}).catch((error) => {
  process.stderr.write(`${error.stack || error.message}\n`);
  process.exitCode = 1;
});
