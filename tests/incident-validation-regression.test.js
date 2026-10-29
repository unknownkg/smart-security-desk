const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

test('TC-06: недопустимый статус closed отклоняется и не сохраняется', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'incident-validation-'));
  const dbPath = path.join(dir, 'db.json');
  fs.writeFileSync(dbPath, JSON.stringify({cameras: [], events: [], incidents: []}));
  process.env.DB_PATH = dbPath;
  const app = require(process.env.EXERCISE_SERVER || '../server');
  const server = app.listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  const url = 'http://127.0.0.1:' + server.address().port;
  const request = (route, method, body) => fetch(url + route, {method, headers:{'Content-Type':'application/json'}, body:JSON.stringify(body)});
  try {
    const created = await request('/api/incidents', 'POST', {title:'Проверка',cameraId:'CAM-01',severity:'high'});
    assert.equal(created.status, 201);
    const incident = await created.json();
    const response = await request('/api/incidents/' + incident.id, 'PATCH', {status:'closed'});
    assert.equal(response.status, 400);
    assert.equal((await response.json()).error, 'Invalid incident status');
    const saved = JSON.parse(fs.readFileSync(dbPath, 'utf8')).incidents[0];
    assert.equal(saved.status, 'new');
  } finally {
    await new Promise(resolve => server.close(resolve));
    fs.rmSync(dir,{recursive:true,force:true});
  }
});
