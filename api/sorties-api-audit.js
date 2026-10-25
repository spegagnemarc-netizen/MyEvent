'use strict';

// Temporary Preview-only endpoint. No provider calls occur when this file is loaded.
const { createHandler } = require('../server/sorties-api-audit');
module.exports = createHandler();
