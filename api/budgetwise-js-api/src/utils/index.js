export const logRequest = (req, res, next) => {
  console.log(`${req.method} ${req.url}`);
  next();
};

export const handleError = (err, req, res, next) => {
  console.error(err.stack);
  res.status(500).send('Something broke!');
};