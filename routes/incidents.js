const express = require('express');
const nonempty = value => typeof value === 'string' && value.trim().length > 0;
module.exports = store => {
  const router = express.Router();
  router.get('/', (req, res) => {
    let items = store.read().incidents.slice();
    if (req.query.status) items = items.filter(x => x.status === req.query.status);
    if (req.query.severity) items = items.filter(x => x.severity === req.query.severity);
    items.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    res.json(items);
  });
  router.post('/', (req, res) => {
    const {title, cameraId, severity, description = ''} = req.body || {};
    if (![title, cameraId, severity].every(nonempty)) {
      return res.status(400).json({error: 'title, cameraId, severity are required'});
    }
    if (typeof description !== 'string') return res.status(400).json({error: 'Invalid description'});
    const db = store.read();
    const timestamp = new Date().toISOString();
    const incident = {id: store.nextId(db.incidents), title, cameraId, severity, description, status: 'new', assignee: null, createdAt: timestamp, updatedAt: timestamp};
    db.incidents.push(incident);
    store.write(db);
    res.status(201).json(incident);
  });
  router.patch('/:id', (req, res) => {
    const db = store.read();
    const incident = db.incidents.find(x => String(x.id) === req.params.id);
    if (!incident) return res.status(404).json({error: 'Incident not found'});
    const body = req.body || {};
    if (Object.hasOwn(body, 'status') && !['new', 'in_progress', 'resolved'].includes(body.status)) {
      return res.status(400).json({error: 'Invalid incident status'});
    }
    if (Object.hasOwn(body, 'assignee') && body.assignee !== null && typeof body.assignee !== 'string') {
      return res.status(400).json({error: 'Invalid assignee'});
    }
    if (!Object.hasOwn(body, 'status') && !Object.hasOwn(body, 'assignee')) {
      return res.status(400).json({error: 'status or assignee is required'});
    }
    if (Object.hasOwn(body, 'status')) incident.status = body.status;
    if (Object.hasOwn(body, 'assignee')) incident.assignee = body.assignee;
    incident.updatedAt = new Date().toISOString();
    store.write(db);
    res.json(incident);
  });
  return router;
};
