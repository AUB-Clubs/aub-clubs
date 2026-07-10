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

const serviceConfigs = [
  {
    path: path.join(__dirname, `../deployment/kluctl/services/next-app/config/${envName}.yaml`),
    content: `apiNode:\n  version: ${newTag}\n`,
  },
  {
    path: path.join(__dirname, `../deployment/kluctl/services/inference/config/${envName}.yaml`),
    content: `inferenceNode:\n  version: ${newTag}\n`,
  },
  {
    path: path.join(__dirname, `../deployment/kluctl/services/mcp-server/config/${envName}.yaml`),
    content: `mcpServerNode:\n  version: ${newTag}\n`,
  },
];

for (const serviceConfig of serviceConfigs) {
  try {
    fs.writeFileSync(serviceConfig.path, serviceConfig.content);
    console.log(`Updated ${serviceConfig.path} with version: ${newTag}`);
  } catch (error) {
    console.error(`Error updating ${serviceConfig.path}:`, error);
    process.exit(1);
  }
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
