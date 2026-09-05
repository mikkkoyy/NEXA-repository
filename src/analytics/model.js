// Analytics model and constants.
const DateLayout = 'yyyy-MM-dd';

function day(t) {
  return t.toISOString().split('T')[0];
}

function sum(a, b) {
  return a + b;
}

function max(a, b) {
  return a > b ? a : b;
}

module.exports = {
  DateLayout,
  day,
  sum,
  max
};