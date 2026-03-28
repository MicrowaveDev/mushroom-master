import { cleanDuplicateTextMessages } from './lib/workflow.js';

cleanDuplicateTextMessages().then((result) => {
  process.stdout.write(
    [
      `Cleaned ${result.changedIds.length} text messages.`,
      `Report: ${result.reportPath}`
    ].join('\n') + '\n'
  );
}).catch((error) => {
  process.stderr.write(`${error.stack || error.message}\n`);
  process.exitCode = 1;
});
