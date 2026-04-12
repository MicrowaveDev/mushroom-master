import 'dotenv/config';
import { createApp } from './create-app.js';
import { pruneOldGhostSnapshots } from './services/game-service.js';

const port = Number(process.env.PORT || 3021);
const app = await createApp();

// Run ghost snapshot prune on startup and then every 24 hours.
const PRUNE_INTERVAL_MS = 24 * 60 * 60 * 1000;
async function runPrune() {
  try {
    const result = await pruneOldGhostSnapshots();
    if (result.prunedBots > 0 || result.prunedSnapshots > 0) {
      // eslint-disable-next-line no-console
      console.log(`Ghost prune: ${result.prunedBots} bot rows, ${result.prunedSnapshots} snapshot rows removed`);
    }
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('Ghost prune failed:', err.message);
  }
}

app.listen(port, () => {
  // eslint-disable-next-line no-console
  console.log(`Telegram mushroom autobattler listening on http://localhost:${port}`);

  runPrune();
  const pruneTimer = setInterval(runPrune, PRUNE_INTERVAL_MS);
  if (pruneTimer.unref) pruneTimer.unref();
});
