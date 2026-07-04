import test from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import { createApp } from '../../app/server/create-app.js';
import { query } from '../../app/server/db.js';
import {
  equipAsset,
  getPackOddsForRuntime,
  getRuntimeAssetCatalog,
  portraitAssetId,
  rollAssetPack
} from '../../app/server/services/asset-service.js';
import { getPlayerState, selectActiveMushroom } from '../../app/server/services/game-service.js';
import { supportGrantAsset } from '../../app/server/services/support-ops-service.js';
import { grantCurrencyForPlayer } from '../../app/server/services/wallet-service.js';
import { createPlayer, freshDb } from './helpers.js';

async function withEnv(overrides, work) {
  const previous = {};
  for (const key of Object.keys(overrides)) {
    previous[key] = process.env[key];
    process.env[key] = overrides[key];
  }
  try {
    return await work();
  } finally {
    for (const key of Object.keys(overrides)) {
      if (previous[key] === undefined) delete process.env[key];
      else process.env[key] = previous[key];
    }
  }
}

const gachaHeaders = {
  authorization: 'Bearer support-test-token',
  'x-support-actor-id': 'gacha-admin-api'
};

const tinyPngDataUrl = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/p94AAAAASUVORK5CYII=';

function headersFor(actorId) {
  return {
    ...gachaHeaders,
    'x-support-actor-id': actorId
  };
}

async function createAdminSeasonAndCollection(app, {
  seasonId = 'admin_season_1',
  collectionId = 'admin_collection_1'
} = {}) {
  const season = await request(app)
    .post('/api/admin/gacha/seasons')
    .set(gachaHeaders)
    .send({
      id: seasonId,
      name: { en: 'Admin Season' },
      status: 'active',
      startsAt: '2026-08-01T00:00:00.000Z',
      endsAt: '2026-09-01T00:00:00.000Z',
      reason: 'test_admin_season'
    });
  assert.equal(season.status, 200);

  const collection = await request(app)
    .post('/api/admin/gacha/collections')
    .set(gachaHeaders)
    .send({
      id: collectionId,
      seasonId,
      name: { en: 'Admin Collection' },
      status: 'active',
      startsAt: '2026-08-01T00:00:00.000Z',
      endsAt: '2026-09-01T00:00:00.000Z',
      reason: 'test_admin_collection'
    });
  assert.equal(collection.status, 200);
  return { seasonId, collectionId };
}

async function createValidAdminPack(app, {
  packId = 'admin_runtime_pack',
  seasonId = 'admin_season_1',
  collectionId = 'admin_collection_1',
  price = 21
} = {}) {
  await createAdminSeasonAndCollection(app, { seasonId, collectionId });
  const commonA = portraitAssetId('thalla', '1');
  const rareA = portraitAssetId('axilin', '2');
  const pack = await request(app)
    .post('/api/admin/gacha/packs')
    .set(gachaHeaders)
    .send({
      id: packId,
      seasonId,
      collectionId,
      name: { en: 'Admin Runtime Pack' },
      status: 'active',
      startsAt: '2026-08-01T00:00:00.000Z',
      endsAt: '2026-09-01T00:00:00.000Z',
      rollPriceAmount: price,
      rollSize: 2,
      slots: [
        { rarityWeights: { common: 1 } },
        { rarityWeights: { rare: 1 } }
      ],
      metadata: {
        disclosure: { en: 'Contains two cosmetic portraits with one rare slot.' }
      },
      reason: 'test_admin_pack'
    });
  assert.equal(pack.status, 200);

  const items = await request(app)
    .put(`/api/admin/gacha/packs/${packId}/items`)
    .set(gachaHeaders)
    .send({
      reason: 'test_admin_pack_items',
      items: [
        { assetId: commonA, rarity: 'common', dropWeight: 100 },
        { assetId: rareA, rarity: 'rare', dropWeight: 10 }
      ]
    });
  assert.equal(items.status, 200);
  assert.equal(items.body.data.validation.ok, true);

  const publish = await request(app)
    .post(`/api/admin/gacha/packs/${packId}/transition`)
    .set(gachaHeaders)
    .send({
      action: 'publish',
      reason: 'test_admin_publish'
    });
  assert.equal(publish.status, 200);
  assert.equal(publish.body.data.pack.reviewStatus, 'approved');
  assert.equal(publish.body.data.pack.status, 'active');
  return { packId, commonA, rareA };
}

test('[Req 14-F] gacha admin API requires token, actor, and gacha operator role', async () => {
  await freshDb();
  const app = await createApp();

  const missingConfig = await request(app)
    .get('/api/admin/gacha/catalog')
    .set('x-support-actor-id', 'gacha-admin-api');
  assert.equal(missingConfig.status, 503);

  await withEnv({
    SUPPORT_ADMIN_API_TOKEN: 'support-test-token',
    SUPPORT_ADMIN_OPERATORS_JSON: JSON.stringify({
      support_viewer_api: ['support_viewer'],
      gacha_operator_api: ['gacha_operator'],
      gacha_admin_api: ['admin']
    })
  }, async () => {
    const missingActor = await request(app)
      .get('/api/admin/gacha/catalog')
      .set('authorization', 'Bearer support-test-token');
    assert.equal(missingActor.status, 400);

    const unknown = await request(app)
      .get('/api/admin/gacha/catalog')
      .set(headersFor('unknown_gacha_api'));
    assert.equal(unknown.status, 403);
    assert.equal(unknown.body.requiredRole, 'gacha_operator');

    const viewer = await request(app)
      .get('/api/admin/gacha/catalog')
      .set(headersFor('support_viewer_api'));
    assert.equal(viewer.status, 403);
    assert.equal(viewer.body.requiredRole, 'gacha_operator');

    const operator = await request(app)
      .get('/api/admin/gacha/catalog')
      .set(headersFor('gacha_operator_api'));
    assert.equal(operator.status, 200);
    assert.ok(Array.isArray(operator.body.data.assetOptions));
    assert.ok(operator.body.data.assetOptions.some((asset) => asset.assetId === 'portrait.axilin.1'));

    const admin = await request(app)
      .get('/api/admin/gacha/catalog')
      .set(headersFor('gacha_admin_api'));
    assert.equal(admin.status, 200);
  });
});

test('[Req 14-F] gacha admin API uploads, edits, reviews, and audits season plan images', async () => {
  await withEnv({
    SUPPORT_ADMIN_API_TOKEN: 'support-test-token'
  }, async () => {
    await freshDb();
    const app = await createApp();
    const { seasonId } = await createAdminSeasonAndCollection(app, {
      seasonId: 'admin_plan_season',
      collectionId: 'admin_plan_collection'
    });

    const created = await request(app)
      .post('/api/admin/gacha/plan-items')
      .set(gachaHeaders)
      .send({
        seasonId,
        characterId: 'thalla',
        rarity: 'common',
        dropWeight: 75,
        fileName: 'thalla-plan.png',
        imageData: tinyPngDataUrl,
        reason: 'test_plan_upload'
      });
    assert.equal(created.status, 200);
    assert.equal(created.body.data.item.seasonId, seasonId);
    assert.equal(created.body.data.item.characterId, 'thalla');
    assert.equal(created.body.data.item.dropWeight, 75);
    assert.match(created.body.data.item.imagePath, /^\/gacha-plan\/admin_plan_season\/gachaplan_/);

    const image = await request(app).get(created.body.data.item.imagePath);
    assert.equal(image.status, 200);
    assert.equal(image.headers['content-type'], 'image/png');

    const catalog = await request(app)
      .get('/api/admin/gacha/catalog')
      .set(gachaHeaders);
    assert.equal(catalog.status, 200);
    assert.equal(catalog.body.data.planItems.length, 1);
    assert.equal(catalog.body.data.planSummary.targetPerCharacter, 5);
    const seasonPlan = catalog.body.data.planSummary.seasons.find((row) => row.seasonId === seasonId);
    assert.equal(seasonPlan.total, 1);
    assert.equal(seasonPlan.characters.find((row) => row.characterId === 'thalla').missing, 4);

    const itemId = created.body.data.item.id;
    const updated = await request(app)
      .patch(`/api/admin/gacha/plan-items/${itemId}`)
      .set(gachaHeaders)
      .send({
        characterId: 'axilin',
        rarity: 'rare',
        dropWeight: 25,
        status: 'ready',
        reason: 'test_plan_update'
      });
    assert.equal(updated.status, 200);
    assert.equal(updated.body.data.item.characterId, 'axilin');
    assert.equal(updated.body.data.item.rarity, 'rare');
    assert.equal(updated.body.data.item.status, 'ready');

    const removed = await request(app)
      .delete(`/api/admin/gacha/plan-items/${itemId}`)
      .set(gachaHeaders)
      .send({ reason: 'test_plan_delete' });
    assert.equal(removed.status, 200);
    assert.equal(removed.body.data.item.id, itemId);

    const actions = await query(
      `SELECT action_type, target_type, target_id
       FROM support_actions
       WHERE target_type = 'gacha_plan_item'
       ORDER BY created_at ASC`,
      []
    );
    assert.deepEqual(actions.rows.map((row) => row.action_type), [
      'gacha_plan_item_create',
      'gacha_plan_item_update',
      'gacha_plan_item_delete'
    ]);
    assert.ok(actions.rows.every((row) => row.target_id === itemId));
  });
});

test('[Req 14-F] gacha admin API promotes ready season plan images into runtime pack assets', async () => {
  await withEnv({
    SUPPORT_ADMIN_API_TOKEN: 'support-test-token',
    ASSET_GACHA_ENABLED: 'true',
    ASSET_GACHA_DB_PACKS_ENABLED: 'true'
  }, async () => {
    await freshDb();
    const app = await createApp();
    const { seasonId, collectionId } = await createAdminSeasonAndCollection(app, {
      seasonId: 'admin_promote_season',
      collectionId: 'admin_promote_collection'
    });

    const uploaded = await request(app)
      .post('/api/admin/gacha/plan-items')
      .set(gachaHeaders)
      .send({
        seasonId,
        characterId: 'thalla',
        rarity: 'rare',
        dropWeight: 33,
        status: 'ready',
        fileName: 'thalla-promoted.png',
        imageData: tinyPngDataUrl,
        reason: 'test_plan_promote_upload'
      });
    assert.equal(uploaded.status, 200);
    const planItem = uploaded.body.data.item;

    const unpromotedPublicCatalog = await getRuntimeAssetCatalog();
    assert.equal(unpromotedPublicCatalog.some((asset) => asset.assetId === planItem.assetId), false);
    const unpromotedAdminCatalog = await getRuntimeAssetCatalog({ planAssetVisibility: 'all' });
    assert.equal(unpromotedAdminCatalog.some((asset) => asset.assetId === planItem.assetId), true);

    const packId = 'admin_promote_pack';
    const pack = await request(app)
      .post('/api/admin/gacha/packs')
      .set(gachaHeaders)
      .send({
        id: packId,
        seasonId,
        collectionId,
        name: { en: 'Promoted Plan Pack' },
        status: 'active',
        startsAt: '2026-01-01T00:00:00.000Z',
        endsAt: '2027-01-01T00:00:00.000Z',
        rollPriceAmount: 17,
        rollSize: 1,
        metadata: {
          disclosure: { en: 'Contains promoted season-plan portraits.' }
        },
        reason: 'test_plan_promote_pack'
      });
    assert.equal(pack.status, 200);
    assert.equal(pack.body.data.validation.ok, false);

    const promoted = await request(app)
      .post(`/api/admin/gacha/packs/${packId}/promote-plan-items`)
      .set(gachaHeaders)
      .send({
        seasonId,
        planItemIds: [planItem.id],
        reason: 'test_plan_promote'
      });
    assert.equal(promoted.status, 200);
    assert.equal(promoted.body.data.inserted.length, 1);
    assert.equal(promoted.body.data.inserted[0].assetId, planItem.assetId);
    assert.equal(promoted.body.data.validation.ok, true);

    const draftLinkedPublicCatalog = await getRuntimeAssetCatalog();
    assert.equal(draftLinkedPublicCatalog.some((asset) => asset.assetId === planItem.assetId), false);

    const storedPlan = await query(`SELECT metadata_json FROM asset_gacha_plan_items WHERE id = $1`, [planItem.id]);
    const planMetadata = JSON.parse(storedPlan.rows[0].metadata_json);
    assert.deepEqual(planMetadata.promotedPackIds, [packId]);
    assert.equal(planMetadata.promotedPackItemIds[packId], promoted.body.data.inserted[0].id);

    const publish = await request(app)
      .post(`/api/admin/gacha/packs/${packId}/transition`)
      .set(gachaHeaders)
      .send({
        action: 'publish',
        reason: 'test_plan_promote_publish'
      });
    assert.equal(publish.status, 200);
    assert.equal(publish.body.data.pack.reviewStatus, 'approved');

    const publishedPublicCatalog = await getRuntimeAssetCatalog();
    const publishedAsset = publishedPublicCatalog.find((asset) => asset.assetId === planItem.assetId);
    assert.equal(publishedAsset.path, planItem.imagePath);
    assert.deepEqual(publishedAsset.packIds, [packId]);

    const odds = await getPackOddsForRuntime(packId);
    assert.equal(odds.validation.ok, true);
    assert.equal(odds.items[0].asset.assetId, planItem.assetId);
    assert.equal(odds.items[0].asset.path, planItem.imagePath);

    const session = await createPlayer({ username: 'promoted_plan_player' });
    await selectActiveMushroom(session.player.id, 'thalla');
    await grantCurrencyForPlayer({
      playerId: session.player.id,
      currencyCode: 'soft_coin',
      amount: 25,
      reason: 'test_plan_promote_wallet',
      sourceType: 'test',
      sourceId: 'plan-promote'
    });

    const roll = await rollAssetPack(session.player.id, packId, { rng: () => 0.1 });
    assert.equal(roll.rollResult.assetId, planItem.assetId);
    assert.equal(roll.rollResult.assetPath, planItem.imagePath);

    const equip = await equipAsset(session.player.id, planItem.assetId);
    assert.equal(equip.targetId, 'thalla');
    assert.equal(equip.path, planItem.imagePath);

    const state = await getPlayerState(session.player.id);
    const promotedPortrait = state.progression.thalla.portraits.find((portrait) => portrait.assetId === planItem.assetId);
    assert.equal(promotedPortrait.owned, true);
    assert.equal(promotedPortrait.active, true);
    assert.equal(promotedPortrait.path, planItem.imagePath);

    const supportSession = await createPlayer({ username: 'promoted_plan_support_player' });
    const supportGrant = await supportGrantAsset({
      actorId: 'support-admin',
      playerId: supportSession.player.id,
      assetId: planItem.assetId,
      reason: 'test_plan_promote_support_grant'
    });
    assert.equal(supportGrant.asset.assetId, planItem.assetId);
    assert.equal(supportGrant.instance.assetId, planItem.assetId);

    const actions = await query(
      `SELECT action_type, target_type, target_id
       FROM support_actions
       WHERE action_type = 'gacha_plan_promote_pack_items'`,
      []
    );
    assert.equal(actions.rowCount, 1);
    assert.equal(actions.rows[0].target_type, 'gacha_pack');
    assert.equal(actions.rows[0].target_id, packId);
  });
});

test('[Req 14-F] gacha admin API can author, validate, publish, and audit a database pack', async () => {
  await withEnv({
    SUPPORT_ADMIN_API_TOKEN: 'support-test-token',
    ASSET_GACHA_DB_PACKS_ENABLED: 'true'
  }, async () => {
    await freshDb();
    const app = await createApp();
    const { seasonId, collectionId } = await createAdminSeasonAndCollection(app);
    const packId = 'admin_author_pack';
    const commonA = portraitAssetId('thalla', '1');
    const rareA = portraitAssetId('axilin', '2');

    const pack = await request(app)
      .post('/api/admin/gacha/packs')
      .set(gachaHeaders)
      .send({
        id: packId,
        seasonId,
        collectionId,
        name: { en: 'Author Pack' },
        status: 'active',
        startsAt: '2026-08-01T00:00:00.000Z',
        endsAt: '2026-09-01T00:00:00.000Z',
        rollPriceAmount: 31,
        rollSize: 2,
        slots: [
          { rarityWeights: { common: 1 } },
          { rarityWeights: { rare: 1 } }
        ],
        metadata: {
          disclosure: { en: 'Contains two cosmetic portraits with a guaranteed rare slot.' }
        },
        reason: 'test_author_pack'
      });
    assert.equal(pack.status, 200);
    assert.equal(pack.body.data.validation.ok, false);
    assert.ok(pack.body.data.validation.errors.some((issue) => issue.code === 'items_missing'));

    const directApproval = await request(app)
      .patch(`/api/admin/gacha/packs/${packId}`)
      .set(gachaHeaders)
      .send({ reviewStatus: 'approved', reason: 'test_direct_approval_rejected' });
    assert.equal(directApproval.status, 400);
    assert.match(directApproval.body.error, /transition action/i);

    const blockedPackId = 'admin_release_blocked_pack';
    const blockedPack = await request(app)
      .post('/api/admin/gacha/packs')
      .set(gachaHeaders)
      .send({
        id: blockedPackId,
        seasonId,
        collectionId,
        name: { en: 'Release Blocked Pack' },
        status: 'active',
        rollPriceAmount: 11,
        rollSize: 1,
        reason: 'test_release_blocked_pack'
      });
    assert.equal(blockedPack.status, 200);
    const blockedItems = await request(app)
      .put(`/api/admin/gacha/packs/${blockedPackId}/items`)
      .set(gachaHeaders)
      .send({
        reason: 'test_release_blocked_items',
        items: [
          { assetId: commonA, rarity: 'common', dropWeight: 100 }
        ]
      });
    assert.equal(blockedItems.status, 200);
    assert.equal(blockedItems.body.data.validation.ok, true);
    const blockedPublish = await request(app)
      .post(`/api/admin/gacha/packs/${blockedPackId}/transition`)
      .set(gachaHeaders)
      .send({ action: 'publish', reason: 'test_release_blocked_publish' });
    assert.equal(blockedPublish.status, 400);
    assert.match(blockedPublish.body.error, /release checklist failed/i);
    assert.match(blockedPublish.body.error, /pack_starts_at_missing/);

    const items = await request(app)
      .put(`/api/admin/gacha/packs/${packId}/items`)
      .set(gachaHeaders)
      .send({
        reason: 'test_author_items',
        items: [
          { assetId: commonA, rarity: 'common', dropWeight: 100 },
          { assetId: rareA, rarity: 'rare', dropWeight: 10, copyLimit: 2 }
        ]
      });
    assert.equal(items.status, 200);
    assert.equal(items.body.data.validation.ok, true);

    const validation = await request(app)
      .get(`/api/admin/gacha/packs/${packId}/validation`)
      .set(gachaHeaders);
    assert.equal(validation.status, 200);
    assert.equal(validation.body.data.validation.ok, true);
    assert.equal(validation.body.data.releaseChecklist.ok, true);
    assert.ok(validation.body.data.releaseChecklist.passed.some((issue) => issue.code === 'price_present'));
    assert.ok(validation.body.data.releaseChecklist.passed.some((issue) => issue.code === 'currency_ok'));
    assert.ok(validation.body.data.releaseChecklist.warnings.some((issue) => issue.code === 'asset_policy_mapping_recommended'));
    assert.equal(validation.body.data.preview.items.length, 2);

    const preview = await request(app)
      .get(`/api/admin/gacha/packs/${packId}/preview?trials=250`)
      .set(gachaHeaders);
    assert.equal(preview.status, 200);
    assert.equal(preview.body.data.releaseChecklist.ok, true);
    assert.equal(preview.body.data.simulation.trials, 250);
    assert.equal(preview.body.data.simulation.candidateCount, 2);
    assert.ok(preview.body.data.assetPolicyRecommendations.length >= 1);

    const publish = await request(app)
      .post(`/api/admin/gacha/packs/${packId}/transition`)
      .set(gachaHeaders)
      .send({ action: 'publish', reason: 'test_author_publish' });
    assert.equal(publish.status, 200);
    assert.equal(publish.body.data.pack.reviewStatus, 'approved');
    assert.equal(publish.body.data.pack.status, 'active');

    const odds = await getPackOddsForRuntime(packId);
    assert.equal(odds.source, 'database');
    assert.equal(odds.rollPriceAmount, 31);
    assert.equal(odds.validation.ok, true);

    const catalog = await request(app)
      .get('/api/admin/gacha/catalog')
      .set(gachaHeaders);
    assert.equal(catalog.status, 200);
    assert.ok(catalog.body.data.packs.some((row) => row.id === packId && row.validation.ok));

    const actions = await query(
      `SELECT action_type, target_type, target_id, result_json
       FROM support_actions
       WHERE target_id = $1
       ORDER BY created_at ASC`,
      [packId]
    );
    const actionTypes = actions.rows.map((row) => row.action_type);
    assert.ok(actionTypes.includes('gacha_pack_create'));
    assert.ok(actionTypes.includes('gacha_pack_items_replace'));
    assert.ok(actionTypes.includes('gacha_pack_publish'));
    assert.ok(actions.rows.every((row) => row.target_type === 'gacha_pack'));
    assert.ok(actions.rows.some((row) => JSON.parse(row.result_json).after?.reviewStatus === 'approved'));
  });
});

test('[Req 14-F] gacha admin API clones approved packs for edits and supports emergency disable', async () => {
  await withEnv({
    SUPPORT_ADMIN_API_TOKEN: 'support-test-token',
    ASSET_GACHA_DB_PACKS_ENABLED: 'true'
  }, async () => {
    await freshDb();
    const app = await createApp();
    const { packId } = await createValidAdminPack(app, {
      packId: 'admin_clone_pack',
      seasonId: 'admin_clone_season',
      collectionId: 'admin_clone_collection',
      price: 19
    });

    const cloneEdit = await request(app)
      .patch(`/api/admin/gacha/packs/${packId}`)
      .set(gachaHeaders)
      .send({
        rollPriceAmount: 77,
        name: { en: 'Draft Clone Pack' },
        reason: 'test_clone_edit'
      });
    assert.equal(cloneEdit.status, 200);
    assert.equal(cloneEdit.body.data.cloned, true);
    assert.equal(cloneEdit.body.data.clonedFromPackId, packId);
    assert.notEqual(cloneEdit.body.data.pack.id, packId);
    assert.equal(cloneEdit.body.data.pack.reviewStatus, 'draft');
    assert.equal(cloneEdit.body.data.pack.rollPriceAmount, 77);
    assert.equal(cloneEdit.body.data.pack.metadata.basePackId, packId);

    const originalOdds = await getPackOddsForRuntime(packId);
    assert.equal(originalOdds.rollPriceAmount, 19);
    assert.equal(originalOdds.reviewStatus, 'approved');

    const cloneActionRows = await query(
      `SELECT action_type, target_type, target_id, result_json
       FROM support_actions
       WHERE action_type = 'gacha_pack_clone_draft'
       ORDER BY created_at DESC
       LIMIT 1`,
      []
    );
    assert.equal(cloneActionRows.rowCount, 1);
    assert.equal(cloneActionRows.rows[0].target_type, 'gacha_pack');
    assert.equal(cloneActionRows.rows[0].target_id, packId);
    assert.equal(JSON.parse(cloneActionRows.rows[0].result_json).draftPackId, cloneEdit.body.data.pack.id);

    const rejectedInPlace = await request(app)
      .patch(`/api/admin/gacha/packs/${packId}`)
      .set(gachaHeaders)
      .send({
        cloneDraft: false,
        rollPriceAmount: 88,
        reason: 'test_reject_in_place'
      });
    assert.equal(rejectedInPlace.status, 400);
    assert.match(rejectedInPlace.body.error, /cloned draft/i);

    const disable = await request(app)
      .post(`/api/admin/gacha/packs/${packId}/transition`)
      .set(gachaHeaders)
      .send({ action: 'disable', reason: 'test_emergency_disable' });
    assert.equal(disable.status, 200);
    assert.equal(disable.body.data.pack.id, packId);
    assert.equal(disable.body.data.pack.status, 'disabled');
    assert.equal(disable.body.data.pack.reviewStatus, 'approved');

    await assert.rejects(
      () => getPackOddsForRuntime(packId),
      (err) => err.statusCode === 404 && /unknown asset pack/i.test(err.message)
    );
  });
});

test('[Req 14-F] gacha admin API exports, dry-runs, imports, and audits JSON fixtures', async () => {
  await withEnv({
    SUPPORT_ADMIN_API_TOKEN: 'support-test-token',
    ASSET_GACHA_DB_PACKS_ENABLED: 'true'
  }, async () => {
    await freshDb();
    const app = await createApp();
    const { packId } = await createValidAdminPack(app, {
      packId: 'admin_fixture_pack',
      seasonId: 'admin_fixture_season',
      collectionId: 'admin_fixture_collection',
      price: 23
    });

    const exported = await request(app)
      .get('/api/admin/gacha/export')
      .set(gachaHeaders);
    assert.equal(exported.status, 200);
    assert.equal(exported.body.data.schemaVersion, 'gacha-admin-fixture/v1');
    assert.equal(exported.body.data.counts.packs, 1);
    assert.equal(exported.body.data.packs[0].id, packId);
    assert.equal(exported.body.data.packs[0].reviewStatus, 'approved');
    assert.equal(exported.body.data.packs[0].items.length, 2);

    const blockedApproved = await request(app)
      .post('/api/admin/gacha/import')
      .set(gachaHeaders)
      .send({
        fixture: exported.body.data,
        dryRun: true,
        reason: 'test_fixture_import_blocked'
      });
    assert.equal(blockedApproved.status, 400);
    assert.match(blockedApproved.body.error, /allowApproved=true/);

    const dryRun = await request(app)
      .post('/api/admin/gacha/import')
      .set(gachaHeaders)
      .send({
        fixture: exported.body.data,
        dryRun: true,
        allowApproved: true,
        reason: 'test_fixture_import_dry_run'
      });
    assert.equal(dryRun.status, 200);
    assert.equal(dryRun.body.data.dryRun, true);
    assert.equal(dryRun.body.data.summary.byType.pack, 1);
    assert.ok(dryRun.body.data.operations.some((operation) => operation.type === 'pack_items' && operation.afterCount === 2));

    const fixture = structuredClone(exported.body.data);
    fixture.packs[0].rollPriceAmount = 44;
    fixture.packs[0].metadata = {
      ...fixture.packs[0].metadata,
      disclosure: { en: 'Fixture import keeps this approved pack release-ready.' }
    };
    const applied = await request(app)
      .post('/api/admin/gacha/import')
      .set(gachaHeaders)
      .send({
        fixture,
        dryRun: false,
        allowApproved: true,
        reason: 'test_fixture_import_apply'
      });
    assert.equal(applied.status, 200);
    assert.equal(applied.body.data.dryRun, false);
    assert.ok(applied.body.data.action.id);
    assert.ok(applied.body.data.packResults.every((result) => result.validation.ok && result.releaseChecklist.ok));

    const odds = await getPackOddsForRuntime(packId);
    assert.equal(odds.rollPriceAmount, 44);
    assert.equal(odds.reviewStatus, 'approved');

    const actions = await query(
      `SELECT action_type, target_type, result_json
       FROM support_actions
       WHERE action_type = 'gacha_fixture_import'
       ORDER BY created_at DESC
       LIMIT 1`
    );
    assert.equal(actions.rowCount, 1);
    assert.equal(actions.rows[0].target_type, 'gacha_fixture');
    const result = JSON.parse(actions.rows[0].result_json);
    assert.equal(result.allowApproved, true);
    assert.equal(result.summary.byType.pack_items, 1);
  });
});
