function validateWordParam(req, res, next) {
  const { word } = req.params;
  console.log(word);
  if (!word || typeof word !== 'string' || !/^[a-zA-Z']+$/.test(word)) {
    return res.status(400).json({ error: 'Invalid word. Only letters are allowed.' });
  }

  next();
}

module.exports = validateWordParam;
