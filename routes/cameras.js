const express = require('express');
module.exports = store => {
  const router = express.Router();
  router.get('/', (req, res) => res.json(store.read().cameras));
  router.patch('/:id', (req, res) => {
    const db = store.read();
    const camera = db.cameras.find(item => item.id === req.params.id);
    if (!camera) return res.status(404).json({error: 'Camera not found'});
    if (!req.body || !['online', 'offline'].includes(req.body.status)) {
      return res.status(400).json({error: 'Invalid camera status'});
    }
    camera.status = req.body.status;
    camera.updatedAt = new Date().toISOString();
    store.write(db);
    res.json(camera);
  });
  return router;
};
