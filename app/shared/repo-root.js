// Absolute path to the repository root, derived from this file's own
// location so the codebase works from whichever directory it's checked
// out under (standalone checkout, submodule inside the hub, a temporary
// worktree, a CI container, etc.). Previously the root was hardcoded to
// `/Users/microwavedev/workspace/mushroom-master`, which broke every
// consumer when the repo moved.

import path from 'path';
import { fileURLToPath } from 'url';

// This file lives at <repoRoot>/app/shared/repo-root.js — climb two
// directories to reach the root.
const here = path.dirname(fileURLToPath(import.meta.url));
export const repoRoot = path.resolve(here, '..', '..');
