import { runFullRegeneration } from './lib/workflow.js';

runFullRegeneration().then((result) => {
  process.stdout.write(
    [
      `Regenerated ${result.fetchedCount} source messages from Telegram.`,
      `Removed local source records: ${result.removedSourceMessageIds.length}`,
      `Lore markdown: ${result.lorePath}`,
      `Lore HTML: ${result.htmlPath}`,
      `Lore PDF: ${result.pdfPath}`,
      result.botResults.length > 0 ? `Bot delivery targets: ${result.botResults.map((item) => item.chatId).join(', ')}` : 'Bot delivery skipped.'
    ].join('\n') + '\n'
  );
}).catch((error) => {
  process.stderr.write(`${error.stack || error.message}\n`);
  process.exitCode = 1;
});
