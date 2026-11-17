'use strict';

const { adaptNetlifyHandler } = require('./_adapter');
const fn = require('../netlify/functions/document-analyze');

module.exports = adaptNetlifyHandler(fn.handler);
