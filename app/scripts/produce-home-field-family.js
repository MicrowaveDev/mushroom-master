import { requireHomeFieldFamily } from '../shared/home-field/home-field-family-config.js';
import { produceGrassFamily } from './lib/home-field-grass-family-production.js';
import { producePathFamily } from './lib/home-field-path-family-production.js';

const argv = process.argv.slice(2);
if (argv.includes('--help') || argv.includes('-h')) {
  console.log(`Usage: node app/scripts/produce-home-field-family.js --family=grass|path [family options]

Selects the production implementation for a supported Home Field asset family.
Use the documented npm family command for the complete option list.`);
  process.exit(0);
}
const family = argv.find((arg) => arg.startsWith('--family='))?.slice('--family='.length);
requireHomeFieldFamily(family);
const familyArgs = argv.filter((arg) => !arg.startsWith('--family='));
if (family === 'grass') produceGrassFamily(familyArgs);
else producePathFamily(familyArgs);
