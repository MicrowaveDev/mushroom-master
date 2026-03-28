import { runIncrementalFetch } from './lib/workflow.js';

runIncrementalFetch().then((result) => {
  process.stdout.write(
    [
      `Fetched ${result.fetchedCount} messages from the channel.`,
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
