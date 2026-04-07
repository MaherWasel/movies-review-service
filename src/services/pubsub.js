const { PubSub } = require('@google-cloud/pubsub');
const config = require('../config');
const logger = require('../logger');

const pubsub = new PubSub({ projectId: config.projectId });
const topic = pubsub.topic(config.pubsubTopic);

async function publishEvent(eventType, data) {
  const message = {
    eventType,
    data,
    timestamp: new Date().toISOString(),
  };

  try {
    const messageId = await topic.publishMessage({
      json: message,
      attributes: { eventType },
    });
    logger.info({ messageId, eventType }, 'Published Pub/Sub event');
    return messageId;
  } catch (err) {
    logger.error({ err, eventType }, 'Failed to publish Pub/Sub event');
    throw err;
  }
}

module.exports = { publishEvent };
