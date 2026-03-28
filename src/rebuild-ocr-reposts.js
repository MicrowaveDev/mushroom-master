import { rebuildOcrReposts } from './lib/workflow.js';

rebuildOcrReposts().then((result) => {
  process.stdout.write(
    [
      `Rebuilt ${result.rebuilt.length} OCR repost records.`,
      `Report: ${result.reportPath}`
    ].join('\n') + '\n'
  );
}).catch((error) => {
  process.stderr.write(`${error.stack || error.message}\n`);
  process.exitCode = 1;
});
