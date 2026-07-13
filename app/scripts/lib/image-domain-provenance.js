import { repoRoot } from '../../shared/repo-root.js';
import {
  checkImageDomainProvenance as checkCoreImageDomainProvenance
} from '@microwavedev/backpack-game-core/tooling/provenance';

export { metadataPathFromArgs } from '@microwavedev/backpack-game-core/tooling/provenance';

export function checkImageDomainProvenance(options) {
  return checkCoreImageDomainProvenance({ ...options, repoRoot });
}
