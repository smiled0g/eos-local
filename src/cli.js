const CLI = require('commander')
const ProgressBar = require('progress')
const Colors = require('colors')

const LocalDocker = require('./local-docker')

function log(topic, detail) {
  console.log(Colors.green(`${topic}:`), detail)
}

function error(topic, detail) {
  console.log(Colors.red(`${topic}:`), detail)
}

module.exports = function() {
  const docker = new LocalDocker()

  CLI.version('0.1.0')

  CLI.command('run [instance_name]')
    .option(
      '-m, --image <image>',
      'docker image (default = eosio/eos-dev:latest)'
    )
    .option('-p, --port <port>', 'nodeos HOST port binding (default = 8888)')
    .option('-v, --volumns <volumns>', 'comma-separated volumns bindings')
    .action(async (name = 'eosio', cmd) => {
      const volumns = cmd.volumns && cmd.volumns.split(',')
      const port = cmd.port
      const image = cmd.image

      let progressBar = null
      let totalProgress = 0
      let lastProgress = 0

      await docker.run(
        {
          name,
          port,
          binds: volumns,
        },
        runProgress => {
          switch (runProgress.status) {
            case LocalDocker.RUN_STATUS.IMAGE_FOUND:
              return log('Run', 'Found image')
            case LocalDocker.RUN_STATUS.IMAGE_PULL_START:
              return log('Run', 'Pulling image')
            case LocalDocker.RUN_STATUS.IMAGE_PULL_DOWNLOADING:
              if (!progressBar) {
                totalProgress = Object.keys(runProgress.progress).length * 100
                progressBar = new ProgressBar(
                  `${Colors.green('Run:')} Downloading [${Colors.magenta(
                    ':bar'
                  )}] :percent`,
                  {
                    complete: '=',
                    incomplete: ' ',
                    width: 50,
                    total: totalProgress,
                  }
                )
              }

              let currentProgress = 0
              Object.values(runProgress.progress).forEach(
                ({ current, total }) => {
                  if (total) currentProgress += (100 * current) / total
                }
              )

              progressBar.tick(currentProgress - lastProgress)
              lastProgress = currentProgress
              return false
            case LocalDocker.RUN_STATUS.IMAGE_PULL_EXTRACTING:
              progressBar.tick(totalProgress - lastProgress)
              return log('Run', 'Extracting image')
            case LocalDocker.RUN_STATUS.IMAGE_PULL_DONE:
              return log('Run', 'Image ready')
            case LocalDocker.RUN_STATUS.CONTAINER_FOUND:
              return log('Run', 'Container already existed')
            case LocalDocker.RUN_STATUS.CONTAINER_CREATED:
              return log('Run', 'Container has been created')
            case LocalDocker.RUN_STATUS.CONTAINER_CONFIG_MODIFIED:
              return log('Run', 'Container configuration mismatched')
            case LocalDocker.RUN_STATUS.CONTAINER_STARTED:
              return log(
                'Run',
                `EOS container is running\n\tname=${Colors.magenta(
                  name
                )}\n\tid=${Colors.magenta(runProgress.id)}`
              )
          }
        }
      )
    })
    .description('Run an EOS docker instance')

  CLI.command('stop [instance_name]')
    .action(async (name = 'eosio', cmd) => {
      try {
        await docker.stop({
          name,
        })
        log('Stop', `EOS container name=${Colors.magenta(name)} has stopped`)
      } catch (e) {
        error('Error', e)
      }
    })
    .description('Stop a running docker instance')

  CLI.parse(process.argv)

  // Display help by default
  if (!process.argv.slice(2).length) {
    CLI.outputHelp()
  }
}
