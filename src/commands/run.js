const routes = {
  'analyze:lore-prompt': ['./handlers/analysis.js', 'analyzeLorePrompt'],
  'analyze:pdf-structure': ['./handlers/analysis.js', 'analyzePdfStructure'],
  'audit:untagged': ['./handlers/analysis.js', 'auditUntaggedRouting'],
  'backfill-posted-message-ids': ['./handlers/maintenance.js', 'backfillMessageIds'],
  'clean-text-duplicates': ['./handlers/maintenance.js', 'cleanTextDuplicates'],
  'clear-message-hashtags': ['./handlers/maintenance.js', 'clearMessageHashtags'],
  'debug:history': ['./handlers/diagnostics.js', 'debugHistory'],
  'debug:message': ['./handlers/diagnostics.js', 'debugMessage'],
  fetch: ['./handlers/workflows.js', 'fetchFromTelegram'],
  'rebuild-ocr-reposts': ['./handlers/maintenance.js', 'rebuildReposts'],
  regenerate: ['./handlers/workflows.js', 'regenerateFromTelegram'],
  'set-message-hashtags': ['./handlers/maintenance.js', 'setMessageHashtags'],
  'set-ocr-hashtags': ['./handlers/maintenance.js', 'setOcrHashtags'],
  'update-text-message': ['./handlers/maintenance.js', 'updateTextMessage']
};

async function main(argv) {
  const [command, ...args] = argv;
  const route = routes[command];
  if (!route) {
    const available = Object.keys(routes).sort().join(', ');
    const error = new Error(`Unknown lore command: ${command || '<missing>'}\nAvailable commands: ${available}`);
    error.name = 'UsageError';
    throw error;
  }
  const [modulePath, exportName] = route;
  const handler = (await import(modulePath))[exportName];
  await handler(args);
}

main(process.argv.slice(2)).catch((error) => {
  process.stderr.write(`${error.name === 'UsageError' ? error.message : error.stack || error.message}\n`);
  process.exitCode = error.name === 'UsageError' ? 2 : 1;
});
