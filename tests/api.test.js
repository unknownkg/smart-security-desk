const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'security-desk-test-'));
const dbPath = path.join(dir, 'db.json');
fs.writeFileSync(dbPath, JSON.stringify({
  cameras: [{id: 'CAM-01', name: 'Вход', location: '1 этаж', status: 'online', previewUrl: '', updatedAt: '2026-10-27T10:00:00Z'}],
  events: [], incidents: []
}));
process.env.DB_PATH = dbPath;
const app = require('../server');
let server, base;
test.before(async () => {
  server = app.listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  base = 'http://127.0.0.1:' + server.address().port;
});
test.after(async () => {
  if (server) await new Promise(resolve => server.close(resolve));
  fs.rmSync(dir, {recursive: true, force: true});
});
async function request(url, method = 'GET', body) {
  const response = await fetch(base + url, {method, headers: {'Content-Type': 'application/json'}, ...(body === undefined ? {} : {body: JSON.stringify(body)})});
  return {status: response.status, body: await response.json()};
}
test('TC-01: health', async () => {
  const r = await request('/api/health');
  assert.equal(r.status, 200);
  assert.equal(r.body.status, 'ok');
  assert.equal(r.body.service, 'smart-security-desk');
});
test('camera list and status validation', async () => {
  const list = await request('/api/cameras');
  assert.equal(list.status, 200);
  assert.equal(list.body[0].id, 'CAM-01');
  const changed = await request('/api/cameras/CAM-01', 'PATCH', {status: 'offline'});
  assert.equal(changed.status, 200);
  assert.equal(changed.body.status, 'offline');
  assert.notEqual(changed.body.updatedAt, '2026-10-27T10:00:00Z');
  assert.equal((await request('/api/cameras/CAM-01', 'PATCH', {status: 'broken'})).status, 400);
});
test('TC-02 and TC-03: event creation and required fields', async () => {
  const event = {type: 'motion', cameraId: 'CAM-01', severity: 'high', message: 'Движение'};
  const created = await request('/api/events', 'POST', event);
  assert.equal(created.status, 201);
  assert.equal(created.body.type, 'motion');
  const invalid = {...event}; delete invalid.cameraId;
  assert.equal((await request('/api/events', 'POST', invalid)).status, 400);
  const filtered = await request('/api/events?severity=high&cameraId=CAM-01');
  assert.equal(filtered.status, 200);
  assert.equal(filtered.body.length, 1);
  assert.equal((await request('/api/events?severity=low')).body.length, 0);
});
test('TC-04–TC-08: incidents and errors', async () => {
  const created = await request('/api/incidents', 'POST', {title: 'Движение', cameraId: 'CAM-01', severity: 'high'});
  assert.equal(created.status, 201);
  assert.equal(created.body.status, 'new');
  assert.equal(created.body.assignee, null);
  const id = created.body.id;
  const filtered = await request('/api/incidents?status=new&severity=high');
  assert.equal(filtered.status, 200);
  assert.ok(filtered.body.length > 0);
  assert.ok(filtered.body.every(item => item.status === 'new' && item.severity === 'high'));
  const changed = await request('/api/incidents/' + id, 'PATCH', {status: 'in_progress', assignee: 'Operator-01'});
  assert.equal(changed.status, 200);
  assert.equal(changed.body.assignee, 'Operator-01');
  assert.equal(changed.body.status, 'in_progress');
  assert.equal((await request('/api/incidents/' + id, 'PATCH', {status: 'closed'})).status, 400);
  assert.equal((await request('/api/cameras/UNKNOWN', 'PATCH', {status: 'online'})).status, 404);
  assert.equal((await request('/api/incidents/999999999', 'PATCH', {status: 'resolved'})).status, 404);
  assert.equal((await request('/api/incidents', 'POST', {title: 'Неполный'})).status, 400);
  assert.equal((await request('/api/incidents/' + id, 'PATCH', {status: ''})).status, 400);
});
