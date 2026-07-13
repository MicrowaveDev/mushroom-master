#!/usr/bin/env node

import path from 'node:path';
import { repoRoot } from '../../shared/repo-root.js';
import {
  formatScriptDocumentationResult,
  validateScriptDocumentation
} from '@microwavedev/backpack-game-core/tooling/commands';

const scriptsRoot = path.join(repoRoot, 'app', 'scripts');
const result = validateScriptDocumentation({
  packageJsonPath: path.join(repoRoot, 'package.json'),
  manifestPath: path.join(scriptsRoot, 'command-manifest.json'),
  readmePath: path.join(scriptsRoot, 'README.md'),
  scriptsRoot
});

const output = formatScriptDocumentationResult(result);
if (result.errors.length) {
  console.error(output);
  process.exitCode = 1;
} else {
  console.log(output);
}
