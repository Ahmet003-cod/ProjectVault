'use strict';

const { adaptNetlifyHandler } = require('./_adapter');
const fn = require('../netlify/functions/ai-summary');

module.exports = adaptNetlifyHandler(fn.handler);
