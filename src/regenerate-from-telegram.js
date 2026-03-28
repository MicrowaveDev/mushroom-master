import { runFullRegeneration } from './lib/workflow.js';

const args = new Set(process.argv.slice(2));
const force = args.has('--force');
const skipDownload = args.has('--skip-download') || args.has('--skip-telegram');

runFullRegeneration(undefined, { force, skipDownload }).then((result) => {
  process.stdout.write(
    [
      force ? 'Forced lore rebuild: yes' : 'Forced lore rebuild: no',
      skipDownload ? 'Skipped Telegram download: yes' : 'Skipped Telegram download: no',
      skipDownload
        ? 'Regenerated from stored local markdown/manifests while still delivering the PDF via bot.'
        : `Regenerated ${result.fetchedCount} source messages from Telegram.`,
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
