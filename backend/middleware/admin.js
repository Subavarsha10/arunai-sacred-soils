const { AppError } = require('../utils/helpers');
/** Use after auth.js. Role comes from the database row, never from the token or request body. */
module.exports = (req, res, next) => (req.user && req.user.role === 'admin' ? next() : next(new AppError(403, 'Administrator access required.')));
