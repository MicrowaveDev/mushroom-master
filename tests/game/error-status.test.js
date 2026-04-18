// Pin the HTTP status code for every error message thrown by the loadout
// validators. Regression context: a round-2 save hit validateGridItems with
// an out-of-bounds item and the error middleware mapped it to 500 "Internal
// server error", which is opaque to the user. These are user-caused payload
// errors — they must surface as 4xx with the real message so the UI can show
// something actionable.
//
// If you add a new thrown error in a service file, add a case here too.
import test from 'node:test';
import assert from 'node:assert/strict';
import { mapErrorToStatus } from '../../app/server/create-app.js';

test('[regression] validateGridItems: out-of-bounds maps to 400, not 500', () => {
  assert.equal(mapErrorToStatus('Artifact placement is out of bounds'), 400);
});

test('[regression] validateGridItems: dimension mismatch maps to 400', () => {
  assert.equal(
    mapErrorToStatus('Stored artifact dimensions must match canonical definitions'),
    400
  );
});

test('[regression] validateGridItems: overlap maps to 400', () => {
  assert.equal(mapErrorToStatus('Artifact placements cannot overlap'), 400);
});

test('[regression] validateGridItems: bag-with-grid-coords maps to 400', () => {
  assert.equal(
    mapErrorToStatus('Bag moss_pouch cannot have grid coordinates'),
    400
  );
});

test('[regression] validateBagContents: bag full maps to 400', () => {
  assert.equal(mapErrorToStatus('Bag moss_pouch is full (2 slots)'), 400);
});

test('[regression] validateBagContents: bag-inside-bag maps to 400', () => {
  assert.equal(mapErrorToStatus('Bags cannot contain other bags'), 400);
});

test('[regression] validateCoinBudget: budget exceeded maps to 400', () => {
  assert.equal(mapErrorToStatus('Loadout exceeds 5-coin budget (cost 7)'), 400);
});

test('unknown application errors still fall through to 500', () => {
  assert.equal(mapErrorToStatus('Database connection lost'), 500);
  assert.equal(mapErrorToStatus('ECONNREFUSED'), 500);
  assert.equal(mapErrorToStatus(''), 500);
  assert.equal(mapErrorToStatus(null), 500);
});

test('existing keywords still resolve', () => {
  assert.equal(mapErrorToStatus('Game run not found'), 404);
  assert.equal(mapErrorToStatus('Player is not part of this active game run'), 403);
  assert.equal(mapErrorToStatus('Not enough coins'), 400);
  assert.equal(mapErrorToStatus('Unknown artifact: totally_fake'), 400);
});
