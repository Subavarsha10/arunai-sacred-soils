module.exports = (err, req, res, next) => {
  if (res.headersSent) return next(err);
  let status = err.status || 500, message = err.expose ? err.message : 'Something went wrong on the server.';
  if (err.type === 'entity.parse.failed') { status = 400; message = 'Request body is not valid JSON.'; }
  else if (err.type === 'entity.too.large') { status = 413; message = 'Request is too large.'; }
  else if (err.code === 'ER_DUP_ENTRY') { status = 409; message = 'That record already exists.'; }
  else if (err.code === 'ER_NO_REFERENCED_ROW_2' || err.code === 'ER_ROW_IS_REFERENCED_2') { status = 409; message = 'This change conflicts with related records.'; }
  if (status >= 500) console.error('[error]', req.method, req.originalUrl, err);
  res.status(status).json({ success: false, message });
};
