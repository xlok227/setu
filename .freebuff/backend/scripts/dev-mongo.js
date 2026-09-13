// Keeps an in-memory MongoDB on 127.0.0.1:27017 for local demo use.
// Data resets when this process stops. Used by start-setu.bat / npm run mongo.
const { MongoMemoryServer } = require('mongodb-memory-server');

MongoMemoryServer.create({ instance: { port: 27017, ip: '127.0.0.1', dbName: 'setu_works' } })
  .then((m) => {
    console.log('in-memory MongoDB ready on 127.0.0.1:27017 (data resets when this stops)');
    const stop = async () => { await m.stop(); process.exit(0); };
    process.on('SIGINT', stop);
    process.on('SIGTERM', stop);
  })
  .catch((e) => {
    console.error('failed to start in-memory MongoDB:', e.message);
    process.exit(1);
  });
