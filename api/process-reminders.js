'use strict';

const { adaptNetlifyHandler } = require('./_adapter');
const fn = require('../netlify/functions/process-reminders');

module.exports = adaptNetlifyHandler(fn.handler);
