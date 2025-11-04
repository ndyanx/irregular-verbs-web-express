const logger = require('pino')();

/**
 * Validates word parameter in request
 * Only allows letters and apostrophes in words
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Next middleware function
 */
function validateWordParam(req, res, next) {
  const { word } = req.params;
  logger.info(`Validating word: ${word}`);
  
  if (!word || typeof word !== 'string' || !/^[a-zA-Z']+$/.test(word)) {
    return res.status(400).json({ 
      error: 'Invalid word. Only letters and apostrophes are allowed.' 
    });
  }

  next();
}

module.exports = validateWordParam;
