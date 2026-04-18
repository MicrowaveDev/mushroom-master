import { createUntaggedRoutingAuditReport } from './lib/workflow.js';

createUntaggedRoutingAuditReport().then((result) => {
  process.stdout.write(
    [
      `Untagged routing audit: ${result.reportPath}`,
      `Pending files: ${result.counts.pending}`,
      `Total source files: ${result.counts.total}`
    ].join('\n') + '\n'
  );
}).catch((error) => {
  process.stderr.write(`${error.stack || error.message}\n`);
  process.exitCode = 1;
});
