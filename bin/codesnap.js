#!/usr/bin/env node

const { main } = require('../dist/index');

main().catch(err => {
    console.error(`Error: ${err.message}`);
    process.exit(1);
});