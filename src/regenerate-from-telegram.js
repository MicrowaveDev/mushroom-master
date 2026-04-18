const argv = process.argv.slice(2);
const args = new Set(argv);
const force = args.has('--force');
const skipDownload = args.has('--skip-download') || args.has('--skip-telegram');
const skipBot = args.has('--skip-bot') || args.has('--no-send-pdf');
const renderExistingMarkdown = args.has('--render-existing-markdown');

function readArgValue(name) {
  const index = argv.indexOf(name);
  if (index === -1) {
    return '';
  }
  return String(argv[index + 1] || '').trim();
}

async function main() {
  if (renderExistingMarkdown) {
    const { renderExistingLoreMarkdown } = await import('./render-existing-lore.js');
    const result = await renderExistingLoreMarkdown({
      args: argv,
      sendPdf: !skipBot
    });
    process.stdout.write(
      [
        'Render existing markdown mode: yes',
        `Channel slug: ${result.channelSlug}`,
        `Render template: ${result.template}`,
        `Lore markdown: ${result.lorePath}`,
        `Lore HTML: ${result.htmlPath}`,
        `Lore PDF: ${result.pdfPath}`,
        `Page images: ${result.pageImagesDir}`,
        `Page image manifest: ${result.manifestPath}`,
        result.botResults.length > 0 ? `Bot delivery targets: ${result.botResults.map((item) => item.chatId).join(', ')}` : 'Bot delivery skipped.'
      ].join('\n') + '\n'
    );
    return;
  }

  const { runFullRegeneration } = await import('./lib/workflow.js');
  const result = await runFullRegeneration(undefined, {
    force,
    skipDownload,
    sendPdf: !skipBot,
    template: readArgValue('--template')
  });
  process.stdout.write(
    [
      force ? 'Forced lore rebuild: yes' : 'Forced lore rebuild: no',
      skipDownload ? 'Skipped Telegram download: yes' : 'Skipped Telegram download: no',
      `Render template: ${result.template}`,
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
}

main().catch((error) => {
  process.stderr.write(`${error.stack || error.message}\n`);
  process.exitCode = 1;
});
