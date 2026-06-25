
// Valida parámetro de palabra (solo letras y apóstrofes)
function validateWordParam(req, res, next) {
  const { word } = req.params;
  
  if (!word || typeof word !== 'string' || !/^[a-zA-Z']+$/.test(word)) {
    return res.status(400).json({ 
      error: 'Invalid word. Only letters and apostrophes are allowed.' 
    });
  }

  next();
}

module.exports = validateWordParam;
