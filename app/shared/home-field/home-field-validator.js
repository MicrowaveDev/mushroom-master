/**
 * Home Field validator — pure JS field checks, no external schema library.
 * Mirrors the lightweight validation style used by the artifact and season-image pipelines
 * (see app/scripts/lib/bitmap-image-toolkit.js: checkProvenance).
 *
 * Used by both the CLI (`app/scripts/validate-home-field-assets.js`) and the runtime
 * renderer's mount-time schema gate. Single source of truth for what counts as a valid
 * home-field-map.json / home-field-assets.json.
 */

export const ASSET_TYPES = new Set(['terrain', 'prop', 'exit', 'character', 'effect']);
export const COLLISION_KINDS = new Set(['walkable', 'blocked', 'partial']);
export const ASSET_STATUSES = new Set(['missing', 'generated', 'needs_review', 'rejected', 'approved', 'placeholder']);
const FACING = new Set(['up', 'down', 'left', 'right']);
const TILE_DIRECTIONS = ['n', 'e', 's', 'w'];
const TILE_PLACEMENTS = new Set([
  'free',
  'accent',
  'horizontal_connector',
  'horizontal_connector_accent',
  'vertical_connector',
  'vertical_connector_accent',
  'destination_row_connector',
  'transition',
  'blocked_edge',
  'corner',
  'isolated'
]);

export const ANCHOR_RULES = {
  terrain: { x: 0, y: 0, label: '{0, 0}' },
  prop: { x: 0.5, yRange: [0.85, 1.0], label: '{0.5, 0.85..1.0}' },
  exit: { x: 0.5, yRange: [0.85, 1.0], label: '{0.5, 0.85..1.0}' },
  effect: { x: 0.5, y: 0.5, label: '{0.5, 0.5}' }
};

export const LOCALE_SUFFIX = /_(en|ru|es|fr|de|it|pt|zh|ja|ko)$/i;

function isInt(n) {
  return Number.isInteger(n);
}

function isNonNegInt(n) {
  return isInt(n) && n >= 0;
}

function isPositiveInt(n) {
  return isInt(n) && n > 0;
}

function isRect(obj) {
  if (!obj || typeof obj !== 'object') return false;
  return ['x', 'y', 'w', 'h'].every((k) => isInt(obj[k])) && obj.w > 0 && obj.h > 0;
}

function pushErr(errors, code, message) {
  errors.push({ code, message });
}

function validateAnchorForType(asset) {
  const rule = ANCHOR_RULES[asset.type];
  if (!rule) return null;
  const a = asset.anchor;
  if (!a || typeof a !== 'object') return `anchor missing or not an object`;
  if (rule.x !== undefined && a.x !== rule.x) {
    return `anchor.x must be ${rule.x} for type "${asset.type}" (expected ${rule.label}), got ${a.x}`;
  }
  if (rule.y !== undefined && a.y !== rule.y) {
    return `anchor.y must be ${rule.y} for type "${asset.type}" (expected ${rule.label}), got ${a.y}`;
  }
  if (rule.yRange) {
    if (a.x !== rule.x) return `anchor.x must be ${rule.x} for type "${asset.type}", got ${a.x}`;
    if (typeof a.y !== 'number' || a.y < rule.yRange[0] || a.y > rule.yRange[1]) {
      return `anchor.y must be in [${rule.yRange[0]}, ${rule.yRange[1]}] for type "${asset.type}", got ${a.y}`;
    }
  }
  return null;
}

function validateAnimation(asset) {
  if (asset.animation === null) return null;
  const a = asset.animation;
  if (!a || typeof a !== 'object') return 'animation must be null or an object';
  if (!isPositiveInt(a.frameWidth)) return 'animation.frameWidth must be a positive integer';
  if (!isPositiveInt(a.frameHeight)) return 'animation.frameHeight must be a positive integer';
  if (!isPositiveInt(a.frames)) return 'animation.frames must be a positive integer';
  if (typeof a.fps !== 'number' || a.fps <= 0 || a.fps > 60) {
    return 'animation.fps must be in (0, 60]';
  }
  if (typeof a.loop !== 'boolean') return 'animation.loop must be a boolean';
  if (!isNonNegInt(a.stillFrameIndex) || a.stillFrameIndex >= a.frames) {
    return `animation.stillFrameIndex must be in [0, frames-1] (frames=${a.frames}), got ${a.stillFrameIndex}`;
  }
  if (asset.width !== a.frameWidth * a.frames) {
    return `animation strip width mismatch: width=${asset.width}, expected frameWidth(${a.frameWidth}) * frames(${a.frames}) = ${a.frameWidth * a.frames}`;
  }
  if (asset.height !== a.frameHeight) {
    return `animation strip height mismatch: height=${asset.height}, expected frameHeight=${a.frameHeight}`;
  }
  return null;
}

function validateTerrainTileContract(asset) {
  if (asset.type !== 'terrain') return [];
  const errors = [];
  const tile = asset.tile;
  if (!tile || typeof tile !== 'object') {
    pushErr(errors, 'asset.tile', `terrain asset "${asset.id}" missing tile connectivity contract`);
    return errors;
  }
  if (typeof tile.terrainSet !== 'string' || tile.terrainSet.length === 0) {
    pushErr(errors, 'asset.tile.terrainSet', `terrain asset "${asset.id}" tile.terrainSet must be a non-empty string`);
  }
  if (!TILE_PLACEMENTS.has(tile.placement)) {
    pushErr(errors, 'asset.tile.placement', `terrain asset "${asset.id}" tile.placement must be one of ${[...TILE_PLACEMENTS].join('|')}`);
  }
  if (!tile.connectors || typeof tile.connectors !== 'object') {
    pushErr(errors, 'asset.tile.connectors', `terrain asset "${asset.id}" missing tile.connectors`);
  } else {
    for (const dir of TILE_DIRECTIONS) {
      if (typeof tile.connectors[dir] !== 'string' || tile.connectors[dir].length === 0) {
        pushErr(errors, 'asset.tile.connectors', `terrain asset "${asset.id}" connector "${dir}" must be a non-empty string`);
      }
    }
  }
  if (tile.canTouch !== undefined && (!Array.isArray(tile.canTouch) || !tile.canTouch.every((v) => typeof v === 'string'))) {
    pushErr(errors, 'asset.tile.canTouch', `terrain asset "${asset.id}" tile.canTouch must be an array of asset ids`);
  }
  if (tile.needsTransitionFor !== undefined && (!Array.isArray(tile.needsTransitionFor) || !tile.needsTransitionFor.every((v) => typeof v === 'string'))) {
    pushErr(errors, 'asset.tile.needsTransitionFor', `terrain asset "${asset.id}" tile.needsTransitionFor must be an array of connector tokens`);
  }
  if (tile.maxPerViewport !== undefined && !isPositiveInt(tile.maxPerViewport)) {
    pushErr(errors, 'asset.tile.maxPerViewport', `terrain asset "${asset.id}" tile.maxPerViewport must be a positive integer`);
  }
  if (tile.requiresTransitionsAtEnds !== undefined && typeof tile.requiresTransitionsAtEnds !== 'boolean') {
    pushErr(errors, 'asset.tile.requiresTransitionsAtEnds', `terrain asset "${asset.id}" tile.requiresTransitionsAtEnds must be boolean`);
  }
  return errors;
}

function validateAssetEntry(asset, idx, knownIds) {
  const errors = [];
  const id = asset && asset.id;
  if (typeof id !== 'string' || id.length === 0) {
    pushErr(errors, 'asset.id', `assets[${idx}].id must be a non-empty string`);
    return errors;
  }
  if (!/^[a-z][a-z0-9_]*$/.test(id)) {
    pushErr(errors, 'asset.id_shape', `asset "${id}" must be lower_snake_case`);
  }
  if (LOCALE_SUFFIX.test(id)) {
    pushErr(errors, 'asset.locale_suffix', `asset "${id}" has a locale suffix; in-world text is rendered, not baked`);
  }
  if (knownIds.has(id)) {
    pushErr(errors, 'asset.duplicate', `asset id "${id}" is duplicated`);
  }
  knownIds.add(id);

  if (!ASSET_TYPES.has(asset.type)) {
    pushErr(errors, 'asset.type', `asset "${id}" type must be one of ${[...ASSET_TYPES].join('|')}, got "${asset.type}"`);
  }
  if (!COLLISION_KINDS.has(asset.collision)) {
    pushErr(errors, 'asset.collision', `asset "${id}" collision must be one of ${[...COLLISION_KINDS].join('|')}, got "${asset.collision}"`);
  }
  if (!ASSET_STATUSES.has(asset.status)) {
    pushErr(errors, 'asset.status', `asset "${id}" status must be one of ${[...ASSET_STATUSES].join('|')}, got "${asset.status}"`);
  }
  if (!isPositiveInt(asset.width) || !isPositiveInt(asset.height)) {
    pushErr(errors, 'asset.size', `asset "${id}" width/height must be positive integers`);
  }
  const anchorErr = validateAnchorForType(asset);
  if (anchorErr) pushErr(errors, 'asset.anchor', `asset "${id}": ${anchorErr}`);

  const animErr = validateAnimation(asset);
  if (animErr) pushErr(errors, 'asset.animation', `asset "${id}": ${animErr}`);
  errors.push(...validateTerrainTileContract(asset));

  for (const field of ['outputPath', 'publicPath', 'promptKey']) {
    if (typeof asset[field] !== 'string' || asset[field].length === 0) {
      pushErr(errors, `asset.${field}`, `asset "${id}" missing or invalid ${field}`);
    }
  }
  if (typeof asset.outputPath === 'string' && !asset.outputPath.startsWith('web/public/home-field/')) {
    pushErr(errors, 'asset.outputPath_prefix', `asset "${id}" outputPath must start with "web/public/home-field/"`);
  }
  if (typeof asset.publicPath === 'string' && !asset.publicPath.startsWith('/home-field/')) {
    pushErr(errors, 'asset.publicPath_prefix', `asset "${id}" publicPath must start with "/home-field/"`);
  }
  return errors;
}

export function validateAssets(assetsDoc) {
  const errors = [];
  if (!assetsDoc || typeof assetsDoc !== 'object') {
    return { ok: false, errors: [{ code: 'root', message: 'home-field-assets.json must be an object' }] };
  }
  if (assetsDoc.version !== 1) {
    pushErr(errors, 'root.version', 'version must be 1');
  }
  if (assetsDoc.tileSize !== 256) {
    pushErr(errors, 'root.tileSize', 'tileSize must be 256 for v1');
  }
  if (!Array.isArray(assetsDoc.assets)) {
    pushErr(errors, 'root.assets', 'assets must be an array');
    return { ok: false, errors };
  }
  const knownIds = new Set();
  assetsDoc.assets.forEach((asset, idx) => {
    errors.push(...validateAssetEntry(asset, idx, knownIds));
  });

  if (Array.isArray(assetsDoc.characters)) {
    assetsDoc.characters.forEach((c, idx) => {
      const id = c && c.id;
      if (typeof id !== 'string' || id.length === 0) {
        pushErr(errors, 'character.id', `characters[${idx}].id must be a non-empty string`);
        return;
      }
      // Allow leading underscore for built-in placeholders (e.g. `_placeholder`).
      if (!/^_?[a-z][a-z0-9_]*$/.test(id) && id !== '_placeholder') {
        pushErr(errors, 'character.id_shape', `character "${id}" must be lower_snake_case (leading underscore allowed for placeholders)`);
      }
      for (const field of ['outputPath', 'publicPath', 'sourcePath', 'promptKey']) {
        if (typeof c[field] !== 'string' || c[field].length === 0) {
          pushErr(errors, `character.${field}`, `character "${id}" missing or invalid ${field}`);
        }
      }
      if (typeof c.outputPath === 'string' && !c.outputPath.startsWith('web/public/home-field/characters/')) {
        pushErr(errors, 'character.outputPath_prefix', `character "${id}" outputPath must start with "web/public/home-field/characters/"`);
      }
      if (typeof c.publicPath === 'string' && !c.publicPath.startsWith('/home-field/characters/')) {
        pushErr(errors, 'character.publicPath_prefix', `character "${id}" publicPath must start with "/home-field/characters/"`);
      }
      if (!ASSET_STATUSES.has(c.status)) {
        pushErr(errors, 'character.status', `character "${id}" status must be one of ${[...ASSET_STATUSES].join('|')}, got "${c.status}"`);
      }
      if (!c.spritesheet || typeof c.spritesheet !== 'object') {
        pushErr(errors, 'character.spritesheet', `character "${id}" missing spritesheet block`);
        return;
      }
      const s = c.spritesheet;
      const expectedWidth = s.cols * s.frameWidth;
      const expectedHeight = s.rows * s.frameHeight;
      if (s.width !== expectedWidth) {
        pushErr(errors, 'character.spritesheet.width', `character "${id}" spritesheet.width=${s.width}, expected cols*frameWidth=${expectedWidth}`);
      }
      if (s.height !== expectedHeight) {
        pushErr(errors, 'character.spritesheet.height', `character "${id}" spritesheet.height=${s.height}, expected rows*frameHeight=${expectedHeight}`);
      }
      if (s.cols !== 8 || s.rows !== 4 || s.frameWidth !== 64 || s.frameHeight !== 64) {
        pushErr(errors, 'character.spritesheet.shape', `character "${id}" spritesheet must be 8 cols x 4 rows of 64x64 (v1 lock)`);
      }
      if (!Array.isArray(s.rowOrder) || s.rowOrder.length !== 4 || s.rowOrder.join(',') !== 'down,up,left,right') {
        pushErr(errors, 'character.spritesheet.rowOrder', `character "${id}" rowOrder must equal ["down","up","left","right"]`);
      }
    });
  }
  return { ok: errors.length === 0, errors };
}

export function validateMap(mapDoc, knownAssetIds) {
  const errors = [];
  if (!mapDoc || typeof mapDoc !== 'object') {
    return { ok: false, errors: [{ code: 'root', message: 'home-field-map.json must be an object' }] };
  }
  if (mapDoc.version !== 1) pushErr(errors, 'root.version', 'version must be 1');

  const world = mapDoc.world;
  if (!world || typeof world !== 'object') {
    pushErr(errors, 'world', 'world block missing');
    return { ok: false, errors };
  }
  if (!isPositiveInt(world.width)) pushErr(errors, 'world.width', 'world.width must be a positive integer');
  if (!isPositiveInt(world.height)) pushErr(errors, 'world.height', 'world.height must be a positive integer');
  if (world.tileSize !== 256) pushErr(errors, 'world.tileSize', 'world.tileSize must be 256 for v1');
  if (world.width % world.tileSize !== 0) pushErr(errors, 'world.width_align', `world.width (${world.width}) must be a multiple of tileSize (${world.tileSize})`);
  if (world.height % world.tileSize !== 0) pushErr(errors, 'world.height_align', `world.height (${world.height}) must be a multiple of tileSize (${world.tileSize})`);

  const spawn = mapDoc.spawn;
  if (!spawn || !isInt(spawn.x) || !isInt(spawn.y) || !FACING.has(spawn.facing)) {
    pushErr(errors, 'spawn', 'spawn must have integer x, y, and facing in up|down|left|right');
  } else if (spawn.x < 0 || spawn.x >= world.width || spawn.y < 0 || spawn.y >= world.height) {
    pushErr(errors, 'spawn.bounds', `spawn (${spawn.x},${spawn.y}) outside world bounds`);
  }

  const camera = mapDoc.camera;
  if (!camera) {
    pushErr(errors, 'camera', 'camera block missing');
  } else {
    if (!camera.initialTarget || !isInt(camera.initialTarget.x) || !isInt(camera.initialTarget.y)) {
      pushErr(errors, 'camera.initialTarget', 'camera.initialTarget must have integer x, y');
    }
    if (!isRect(camera.mobileSafeFrame)) {
      pushErr(errors, 'camera.mobileSafeFrame', 'camera.mobileSafeFrame must be an integer rect {x,y,w,h}');
    }
  }

  const assetIdSet = knownAssetIds || new Set();

  if (Array.isArray(mapDoc.layers)) {
    mapDoc.layers.forEach((layer, lIdx) => {
      if (!layer || typeof layer !== 'object') {
        pushErr(errors, `layers[${lIdx}]`, 'layer must be an object');
        return;
      }
      if (layer.type === 'tileLayer' && Array.isArray(layer.tiles)) {
        layer.tiles.forEach((tile, tIdx) => {
          if (!tile || typeof tile.assetId !== 'string') {
            pushErr(errors, `tile`, `layer "${layer.id}" tile[${tIdx}] missing assetId`);
            return;
          }
          if (knownAssetIds && !assetIdSet.has(tile.assetId)) {
            pushErr(errors, 'tile.unknown_asset', `layer "${layer.id}" tile[${tIdx}] references unknown asset "${tile.assetId}"`);
          }
          if (!isNonNegInt(tile.x) || !isNonNegInt(tile.y)) {
            pushErr(errors, 'tile.coords', `layer "${layer.id}" tile[${tIdx}] x/y must be non-negative integers`);
          } else if (world && world.tileSize) {
            if (tile.x % world.tileSize !== 0 || tile.y % world.tileSize !== 0) {
              pushErr(errors, 'tile.align', `layer "${layer.id}" tile[${tIdx}] x=${tile.x}, y=${tile.y} must be multiples of tileSize (${world.tileSize})`);
            }
          }
        });
      }
      if (layer.type === 'objectLayer' || layer.type === 'effectLayer') {
        const items = layer.type === 'objectLayer' ? layer.objects : layer.effects;
        if (!Array.isArray(items)) {
          pushErr(errors, `layer.items`, `layer "${layer.id}" missing ${layer.type === 'objectLayer' ? 'objects' : 'effects'} array`);
          return;
        }
        items.forEach((it, iIdx) => {
          if (!it || typeof it.assetId !== 'string') {
            pushErr(errors, `layer.item`, `layer "${layer.id}" item[${iIdx}] missing assetId`);
            return;
          }
          if (knownAssetIds && !assetIdSet.has(it.assetId)) {
            pushErr(errors, 'layer.unknown_asset', `layer "${layer.id}" item[${iIdx}] references unknown asset "${it.assetId}"`);
          }
          if (!isInt(it.x) || !isInt(it.y)) {
            pushErr(errors, 'layer.item.coords', `layer "${layer.id}" item[${iIdx}] x/y must be integers`);
          }
        });
      }
    });
  }

  if (Array.isArray(mapDoc.collision)) {
    mapDoc.collision.forEach((c, cIdx) => {
      if (!isRect(c)) {
        pushErr(errors, 'collision.rect', `collision[${cIdx}] must be integer rect {x,y,w,h}`);
        return;
      }
      if (c.x < 0 || c.y < 0 || c.x + c.w > world.width || c.y + c.h > world.height) {
        pushErr(errors, 'collision.bounds', `collision[${cIdx}] outside world bounds`);
      }
    });
  }

  if (Array.isArray(mapDoc.hotspots)) {
    mapDoc.hotspots.forEach((h, hIdx) => {
      if (!h || typeof h.id !== 'string') {
        pushErr(errors, 'hotspot.id', `hotspots[${hIdx}] missing id`);
        return;
      }
      if (typeof h.action !== 'string') pushErr(errors, 'hotspot.action', `hotspot "${h.id}" missing action`);
      if (typeof h.labelKey !== 'string') pushErr(errors, 'hotspot.labelKey', `hotspot "${h.id}" missing labelKey`);
      if (!isRect(h.rect)) {
        pushErr(errors, 'hotspot.rect', `hotspot "${h.id}" rect must be integer rect {x,y,w,h}`);
        return;
      }
      if (h.rect.x < 0 || h.rect.y < 0 || h.rect.x + h.rect.w > world.width || h.rect.y + h.rect.h > world.height) {
        pushErr(errors, 'hotspot.bounds', `hotspot "${h.id}" rect outside world bounds`);
      }
    });
  }

  if (Array.isArray(mapDoc.collision) && spawn && isInt(spawn.x) && isInt(spawn.y)) {
    for (const c of mapDoc.collision) {
      if (!isRect(c)) continue;
      if (spawn.x >= c.x && spawn.x < c.x + c.w && spawn.y >= c.y && spawn.y < c.y + c.h) {
        pushErr(errors, 'spawn.in_collision', `spawn (${spawn.x},${spawn.y}) is inside collision "${c.id || '?'}"`);
        break;
      }
    }
  }

  if (camera && isRect(camera.mobileSafeFrame) && Array.isArray(mapDoc.hotspots)) {
    const sf = camera.mobileSafeFrame;
    const arena = mapDoc.hotspots.find((h) => h.id === 'arena');
    const journey = mapDoc.hotspots.find((h) => h.id === 'journey');
    for (const [name, h] of [['arena', arena], ['journey', journey]]) {
      if (!h || !isRect(h.rect)) continue;
      const r = h.rect;
      const insideX = r.x >= sf.x && r.x + r.w <= sf.x + sf.w;
      const insideY = r.y >= sf.y && r.y + r.h <= sf.y + sf.h;
      if (!insideX || !insideY) {
        pushErr(errors, 'hotspot.safeFrame', `hotspot "${name}" rect not fully inside camera.mobileSafeFrame`);
      }
    }
  }

  return { ok: errors.length === 0, errors };
}

const OPPOSITE = { n: 's', e: 'w', s: 'n', w: 'e' };

export function validateTileConnectors(assetsDoc, mapDoc) {
  const errors = [];
  const tileSize = mapDoc?.world?.tileSize;
  if (!isPositiveInt(tileSize) || !Array.isArray(mapDoc?.layers) || !Array.isArray(assetsDoc?.assets)) {
    return { ok: true, errors };
  }

  const assetById = new Map(assetsDoc.assets.map((asset) => [asset.id, asset]));
  for (const layer of mapDoc.layers) {
    if (layer.type !== 'tileLayer' || !Array.isArray(layer.tiles)) continue;
    const byCell = new Map();
    for (const tile of layer.tiles) {
      if (!isNonNegInt(tile.x) || !isNonNegInt(tile.y)) continue;
      byCell.set(`${tile.x / tileSize},${tile.y / tileSize}`, tile);
    }

    for (const tile of layer.tiles) {
      if (!isNonNegInt(tile.x) || !isNonNegInt(tile.y)) continue;
      const asset = assetById.get(tile.assetId);
      const connectors = asset?.tile?.connectors;
      if (!connectors) continue;
      const cx = tile.x / tileSize;
      const cy = tile.y / tileSize;
      const neighbors = [
        ['n', cx, cy - 1],
        ['e', cx + 1, cy],
        ['s', cx, cy + 1],
        ['w', cx - 1, cy]
      ];
      for (const [dir, nx, ny] of neighbors) {
        const neighbor = byCell.get(`${nx},${ny}`);
        if (!neighbor) continue;
        const neighborAsset = assetById.get(neighbor.assetId);
        const neighborConnectors = neighborAsset?.tile?.connectors;
        if (!neighborConnectors) continue;
        const a = connectors[dir];
        const b = neighborConnectors[OPPOSITE[dir]];
        if (a !== b) {
          pushErr(
            errors,
            'tile.connector_mismatch',
            `layer "${layer.id}" tile "${tile.assetId}" at (${tile.x},${tile.y}) ${dir}=${a} touches "${neighbor.assetId}" ${OPPOSITE[dir]}=${b} at (${neighbor.x},${neighbor.y}); add a transition/end tile or change placement`
          );
        }
      }
    }
  }
  return { ok: errors.length === 0, errors };
}

export function validateAll(assetsDoc, mapDoc) {
  const a = validateAssets(assetsDoc);
  const knownAssetIds = new Set((assetsDoc && assetsDoc.assets) ? assetsDoc.assets.map((x) => x.id) : []);
  const m = validateMap(mapDoc, knownAssetIds);
  return {
    ok: a.ok && m.ok,
    errors: [
      ...a.errors.map((e) => ({ ...e, scope: 'assets' })),
      ...m.errors.map((e) => ({ ...e, scope: 'map' }))
    ]
  };
}
