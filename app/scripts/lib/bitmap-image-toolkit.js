import { repoRoot } from '../../shared/repo-root.js';
import {
  checkProvenance as checkCoreProvenance,
  inputEntriesFromPaths as coreInputEntriesFromPaths,
  readPngHeader as readCorePngHeader,
  writeSheetManifest as writeCoreSheetManifest
} from '@microwavedev/backpack-game-core/tooling/image';

export * from '@microwavedev/backpack-game-core/tooling/image';
export { repoRoot };

export function readPngHeader(filePath) {
  return readCorePngHeader(filePath, { root: repoRoot });
}

export function inputEntriesFromPaths(entries) {
  return coreInputEntriesFromPaths(entries, { root: repoRoot });
}

export function writeSheetManifest(options) {
  return writeCoreSheetManifest({ ...options, root: repoRoot });
}

export function checkProvenance(options) {
  return checkCoreProvenance({ ...options, root: repoRoot });
}
