import { backfillPostedMessageIds } from './lib/workflow.js';

backfillPostedMessageIds().then((result) => {
  process.stdout.write(
    [
      `Updated ${result.repaired.length} OCR metadata records.`,
      `Report: ${result.reportPath}`
    ].join('\n') + '\n'
  );
}).catch((error) => {
  process.stderr.write(`${error.stack || error.message}\n`);
  process.exitCode = 1;
});
