import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const newTag = process.argv[2];
const envName = process.argv[3];

if (!newTag || !envName) {
  console.error('Usage: node update_deployment_tags.js <tag> <environment_name>');
  process.exit(1);
}

// Update next-app config
const configPath = path.join(__dirname, `../deployment/kluctl/services/next-app/config/${envName}.yaml`);

const configContent = `apiNode:
  version: ${newTag}
`;

try {
  fs.writeFileSync(configPath, configContent);
  console.log(`Updated ${configPath} with version: ${newTag}`);
} catch (error) {
  console.error(`Error updating ${configPath}:`, error);
  process.exit(1);
}

// Update seed job
const seedJobPath = path.join(__dirname, '../deployment/kluctl/manual/Job.db-seeding.yaml');

if (fs.existsSync(seedJobPath)) {
  try {
    let seedContent = fs.readFileSync(seedJobPath, 'utf8');
    const updatedSeedContent = seedContent.replace(
      /(image: hamzarach69\/aub-clubs-seed:).*/,
      `$1${newTag}`
    );
    fs.writeFileSync(seedJobPath, updatedSeedContent);
    console.log(`Updated ${seedJobPath} with version: ${newTag}`);
  } catch (error) {
    console.error(`Error updating ${seedJobPath}:`, error);
    // Don't exit process, this is optional
  }
}
