// src/utils/catchAsync.js
// Wraps async route handlers to catch errors and pass to error middleware
const catchAsync = (fn) => {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

module.exports = catchAsync;