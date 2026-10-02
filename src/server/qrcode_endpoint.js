const express = require('express');
const qrcode = require('qrcode');
const router = express.Router();

router.get('/api/qrcode', async (req, res) => {
  const joinURL = req.query.url;
  if (!joinURL) {
    return res.status(400).send('Missing URL parameter');
  }
  try {
    const qrCode = await qrcode.toBuffer(joinURL);
    res.set('Content-Type', 'image/png');
    res.send(qrCode);
  } catch (err) {
    res.status(500).send('Error generating QR code');
  }
});

module.exports = router;