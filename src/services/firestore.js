const { Firestore } = require('@google-cloud/firestore');
const config = require('../config');

const firestore = new Firestore({
  projectId: config.projectId,
});

module.exports = firestore;
