const express = require('express');
const { notFound, errorHandler } = require('./middlewares/error');

const app = express();
app.use(express.json());

app.use(require('./routes/health.routes'));

app.use(notFound);
app.use(errorHandler);

module.exports = app;