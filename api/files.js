const fs = require('fs');
const path = require('path');

module.exports = (req, res) => {
  try {
    const dataDir = path.join(process.cwd(), 'data');
    if (!fs.existsSync(dataDir)) {
      res.setHeader('Access-Control-Allow-Origin', '*');
      return res.status(200).json([]);
    }
    const files = fs.readdirSync(dataDir)
      .filter(file => /\.xlsx?$/i.test(file))
      .map(file => `data/${file}`);
    
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0');
    return res.status(200).json(files);
  } catch (error) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    return res.status(500).json({ error: error.message });
  }
};
