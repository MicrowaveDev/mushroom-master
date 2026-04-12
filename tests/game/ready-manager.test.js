import test from 'node:test';
import assert from 'node:assert/strict';
import {
  setReady, setUnready, isReady, areBothReady, clearRound, clearRun
} from '../../app/server/services/ready-manager.js';

test('[Req 8-B] setReady marks player as ready', () => {
  const runId = 'test-run-1';
  clearRun(runId);
  setReady(runId, 'p1');
  assert.equal(isReady(runId, 'p1'), true);
  assert.equal(isReady(runId, 'p2'), false);
  clearRun(runId);
});

test('[Req 8-B] areBothReady returns false with one player ready', () => {
  const runId = 'test-run-2';
  clearRun(runId);
  setReady(runId, 'p1');
  const result = areBothReady(runId);
  assert.equal(result.ready, false);
  assert.equal(result.playerIds, null);
  clearRun(runId);
});

test('[Req 8-B] areBothReady returns true with both players ready', () => {
  const runId = 'test-run-3';
  clearRun(runId);
  setReady(runId, 'p1');
  setReady(runId, 'p2');
  const result = areBothReady(runId);
  assert.equal(result.ready, true);
  assert.equal(result.playerIds.length, 2);
  assert.ok(result.playerIds.includes('p1'));
  assert.ok(result.playerIds.includes('p2'));
  clearRun(runId);
});

test('[Req 8-B] setUnready reverts ready state', () => {
  const runId = 'test-run-4';
  clearRun(runId);
  setReady(runId, 'p1');
  setReady(runId, 'p2');
  setUnready(runId, 'p1');
  assert.equal(isReady(runId, 'p1'), false);
  assert.equal(isReady(runId, 'p2'), true);
  assert.equal(areBothReady(runId).ready, false);
  clearRun(runId);
});

test('[Req 8-B] clearRound resets all ready states', () => {
  const runId = 'test-run-5';
  clearRun(runId);
  setReady(runId, 'p1');
  setReady(runId, 'p2');
  clearRound(runId);
  assert.equal(isReady(runId, 'p1'), false);
  assert.equal(isReady(runId, 'p2'), false);
  clearRun(runId);
});

test('[Req 8-B] clearRun removes all state', () => {
  const runId = 'test-run-6';
  setReady(runId, 'p1');
  clearRun(runId);
  assert.equal(isReady(runId, 'p1'), false);
  assert.equal(areBothReady(runId).ready, false);
});
