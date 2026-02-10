import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const tagsFilePath = path.join(__dirname, '..', 'tags.json');
const newTag = process.argv[2];

if (!newTag) {
  console.error('Please provide a tag as an argument.');
  process.exit(1);
}

try {
  const tagsContent = fs.readFileSync(tagsFilePath, 'utf8');
  const tags = JSON.parse(tagsContent);

  tags.next = newTag;
  tags.migrate = newTag;

  fs.writeFileSync(tagsFilePath, JSON.stringify(tags, null, 2));
  console.log(`Updated tags.json with tag: ${newTag}`);
} catch (error) {
  console.error('Error updating tags.json:', error);
  process.exit(1);
}
