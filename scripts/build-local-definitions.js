// Compile the keyboard definitions in definitions-local/ and add them to the app index.
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const {
  isKeyboardDefinitionV3,
  keyboardDefinitionV3ToVIADefinitionV3,
} = require('@the-via/reader');

const srcDir = path.join(__dirname, '..', 'definitions-local');
const outDir = path.join(__dirname, '..', 'public', 'definitions');
const indexPath = path.join(outDir, 'supported_kbs.json');

const index = JSON.parse(fs.readFileSync(indexPath, 'utf8'));

for (const file of fs.readdirSync(srcDir).filter((f) => f.endsWith('.json'))) {
  const definition = JSON.parse(fs.readFileSync(path.join(srcDir, file), 'utf8'));
  if (!isKeyboardDefinitionV3(definition)) {
    console.error(file, JSON.stringify(isKeyboardDefinitionV3.errors, null, 2));
    process.exit(1);
  }
  const compiled = keyboardDefinitionV3ToVIADefinitionV3(definition);
  const vpid = compiled.vendorProductId;
  fs.writeFileSync(path.join(outDir, 'v3', `${vpid}.json`), JSON.stringify(compiled));
  if (!index.vendorProductIds.v3.includes(vpid)) {
    index.vendorProductIds.v3.push(vpid);
  }
  console.log(`${file} -> v3/${vpid}.json`);
}

fs.writeFileSync(indexPath, JSON.stringify(index));

// Browsers cache the definition index by this hash, so it must change when the index changes.
const hash = crypto.createHash('sha256').update(JSON.stringify(index)).digest('hex').slice(0, 16);
fs.writeFileSync(path.join(outDir, 'hash.json'), JSON.stringify(hash));
