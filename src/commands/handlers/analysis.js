import {
  createLorePromptAnalysisReport,
  createPdfStructureAnalysisReport,
  createUntaggedRoutingAuditReport
} from '../../lib/workflow.js';

export async function analyzeLorePrompt() {
  const result = await createLorePromptAnalysisReport();
  process.stdout.write(`Lore prompt analysis report: ${result.reportPath}\n`);
}

export async function analyzePdfStructure() {
  const result = await createPdfStructureAnalysisReport();
  process.stdout.write(`PDF structure analysis report: ${result.reportPath}\n`);
}

export async function auditUntaggedRouting() {
  const result = await createUntaggedRoutingAuditReport();
  process.stdout.write(
    [
      `Untagged routing audit: ${result.reportPath}`,
      `Pending files: ${result.counts.pending}`,
      `Total source files: ${result.counts.total}`
    ].join('\n') + '\n'
  );
}
