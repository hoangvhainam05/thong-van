// Keep the Vercel service entrypoint outside dist so Node can resolve its dependencies.
module.exports = require('./dist/main').default;
