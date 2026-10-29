const express = require('express');
const nonempty = value => typeof value === 'string' && value.trim().length > 0;
module.exports = store => {
  const router = express.Router();
  router.get('/', (req, res) => {
    let items = store.read().events.slice();
    if (req.query.severity) items = items.filter(x => x.severity === req.query.severity);
    if (req.query.cameraId) items = items.filter(x => x.cameraId === req.query.cameraId);
    items.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    res.json(items);
  });
  router.post('/', (req, res) => {
    const {type, cameraId, severity, message} = req.body || {};
    if (![type, cameraId, severity, message].every(nonempty)) {
      return res.status(400).json({error: 'type, cameraId, severity, message are required'});
    }
    const db = store.read();
    const event = {id: store.nextId(db.events), type, cameraId, severity, message, createdAt: new Date().toISOString()};
    db.events.push(event);
    store.write(db);
    res.status(201).json(event);
  });
  return router;
};
