const express = require('express');
const router = express.Router();

router.get('/', (req, res) => {
  res.json({
    version: "1.0.0",
    description: "Cambridge Dictionary Audio API",
    endpoints: [
      {
        method: "GET",
        path: "/api/word/:word",
        description: "Get audio and pronunciation data for a given word"
      },
    ]
  });
});

module.exports = router;
