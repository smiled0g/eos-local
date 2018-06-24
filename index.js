/**
 * Support both CLI and
 */

if (require.main === module) {
  require('./src/cli')()
} else {
  module.exports = require('./src/local-docker')
}
