const express = require('express');
const fs = require('fs');
const path = require('path');

const app = express();
const dbPath = process.env.DB_PATH || path.join(__dirname, 'data', 'db.json');
const store = {
  read() { return JSON.parse(fs.readFileSync(dbPath, 'utf8')); },
  write(data) { fs.writeFileSync(dbPath, JSON.stringify(data, null, 2) + '\n'); },
  nextId(items) {
    return Math.max(Date.now(), ...items.map(item => Number(item.id) || 0)) + 1;
  }
};

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));
app.get('/api/health', (req, res) => res.json({status: 'ok', service: 'smart-security-desk'}));

for (const name of ['cameras', 'events', 'incidents']) {
  const routePath = path.join(__dirname, 'routes', name + '.js');
  if (fs.existsSync(routePath)) app.use('/api/' + name, require(routePath)(store));
}
app.use((err, req, res, next) => {
  if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {
    return res.status(400).json({error: 'Invalid JSON'});
  }
  console.error(err);
  res.status(500).json({error: 'Internal server error'});
});

if (require.main === module) {
  const port = process.env.PORT || 3000;
  app.listen(port, () => console.log('Smart Security Desk: http://localhost:' + port));
}
module.exports = app;
