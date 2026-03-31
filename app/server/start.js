import 'dotenv/config';
import { createApp } from './create-app.js';

const port = Number(process.env.PORT || 3021);
const app = await createApp();

app.listen(port, () => {
  // eslint-disable-next-line no-console
  console.log(`Telegram mushroom autobattler listening on http://localhost:${port}`);
});
