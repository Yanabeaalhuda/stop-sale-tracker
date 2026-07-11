const fs = require('fs');
const path = require('path');

const dataDir = path.join(__dirname, 'data');

try {
  if (!fs.existsSync(dataDir)) {
    console.error("Error: 'data' folder does not exist.");
    process.exit(1);
  }

  const files = fs.readdirSync(dataDir)
    .filter(file => /\.xlsx?$/i.test(file))
    .map(file => `data/${file}`);

  fs.writeFileSync(
    path.join(dataDir, 'manifest.json'),
    JSON.stringify(files, null, 2),
    'utf-8'
  );
  
  fs.writeFileSync(
    path.join(dataDir, 'files.json'),
    JSON.stringify(files, null, 2),
    'utf-8'
  );

  console.log(`Successfully updated manifests with ${files.length} Excel files:`);
  files.forEach(f => console.log(` - ${f}`));
} catch (error) {
  console.error("Failed to update manifests:", error);
  process.exit(1);
}
