import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import Ajv2020 from 'ajv/dist/2020.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const ajv = new Ajv2020({ allErrors: true, strict: false, validateFormats: false });
const pairs = [
  ['manifest.schema.json', 'manifest.json'],
  ['players.schema.json', 'players.json'],
  ['player-games.schema.json', 'player-games.json'],
  ['team-games.schema.json', 'team-games.json'],
];

for (const [schemaFile, dataFile] of pairs) {
  const schema = JSON.parse(fs.readFileSync(path.join(root, 'schema', schemaFile), 'utf8'));
  const data = JSON.parse(fs.readFileSync(path.join(root, 'public', 'data', 'v1', dataFile), 'utf8'));
  const validate = ajv.compile(schema);
  if (!validate(data)) {
    throw new Error(`${dataFile} violates ${schemaFile}: ${ajv.errorsText(validate.errors)}`);
  }
}

console.log('Canonical JSON contract validated in the JavaScript consumer.');
