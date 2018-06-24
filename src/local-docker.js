const Docker = require('dockerode')
const isSubset = require('is-subset')

const EOSDockerImage = 'eosio/eos-dev:latest'

// 'status' in run's onProgress callback
const RUN_STATUS = {
  IMAGE_FOUND: 'IMAGE_FOUND',
  IMAGE_PULL_START: 'IMAGE_PULL_START',
  IMAGE_PULL_DOWNLOADING: 'IMAGE_PULL_DOWNLOADING',
  IMAGE_PULL_EXTRACTING: 'IMAGE_PULL_EXTRACTING',
  IMAGE_PULL_DONE: 'IMAGE_PULL_DONE',
  CONTAINER_FOUND: 'CONTAINER_FOUND',
  CONTAINER_CREATED: 'CONTAINER_CREATED',
  CONTAINER_CONFIG_MODIFIED: 'CONTAINER_CONFIG_MODIFIED',
  CONTAINER_STARTED: 'CONTAINER_STARTED',
}

const PULL_STATUS = {
  START: 'START',
  DOWNLOADING: 'DOWNLOADING',
  EXTRACTING: 'EXTRACTING',
  DONE: 'DONE',
}

/** Return container name started with '/' */
function normalizeContainerName(name) {
  if (name[0] === '/') return name
  return `/${name}`
}

class LocalDocker {
  constructor() {
    this.docker = new Docker()
    this.containers = {}
  }

  async pull(image = EOSDockerImage, onPullProgress = () => false) {
    const repo = image.split(':')[0]
    const tag = image.split(':')[1] || 'latest'

    return new Promise((resolve, reject) => {
      onPullProgress(PULL_STATUS.START)

      this.docker.modem.dial(
        {
          path: `/images/create?fromImage=${repo}&tag=${tag} `,
          method: 'POST',
          isStream: true,
          statusCodes: {
            200: true,
            500: 'server error',
          },
        },
        (err, stream) => {
          if (err) return reject(err)

          // List of download waiting
          const progress = {}
          let triggerExtracting = false

          this.docker.modem.followProgress(
            stream,
            () => {
              onPullProgress(PULL_STATUS.DONE)
              resolve()
            },
            e => {
              if (e.status === 'Waiting') {
                progress[e.id] = {
                  current: 0,
                  total: 0,
                }
              }
              if (e.status === 'Downloading') {
                progress[e.id] = e.progressDetail
                onPullProgress(PULL_STATUS.DOWNLOADING, progress)
              }

              if (e.status === 'Extracting' && !triggerExtracting) {
                triggerExtracting = true
                onPullProgress(PULL_STATUS.EXTRACTING, progress)
              }
            }
          )
        }
      )
    })
  }

  async run(options = {}, onRunProgress = () => false) {
    const {
      name = 'eosio',
      image = EOSDockerImage,
      binds = [],
      port = '8888',
    } = options

    // Pull docker image if needed
    const allImages = await this.docker.listImages()
    const existingImage = allImages.find(i => i.RepoTags.includes(image))

    if (!existingImage) {
      await this.pull(image, (status, progress) => {
        switch (status) {
          case PULL_STATUS.START:
            return onRunProgress({
              status: RUN_STATUS.IMAGE_PULL_START,
            })
          case PULL_STATUS.DOWNLOADING:
            return onRunProgress({
              status: RUN_STATUS.IMAGE_PULL_DOWNLOADING,
              progress,
            })
          case PULL_STATUS.EXTACTING:
            return onRunProgress({
              status: RUN_STATUS.IMAGE_PULL_EXTRACTING,
            })
          case PULL_STATUS.DONE:
            return
            return onRunProgress({
              status: RUN_STATUS.IMAGE_PULL_DONE,
            })
        }
      })
    } else {
      onRunProgress({ status: RUN_STATUS.IMAGE_FOUND })
    }

    const normalizedName = normalizeContainerName(name)

    const allContainers = await this.docker.listContainers({ all: true })
    const existingContainerInfo = allContainers.find(c =>
      c.Names.includes(normalizedName)
    )

    const containerConfig = {
      name: normalizedName,
      Image: image,
      Cmd: [
        '/bin/bash',
        '-c',
        'nodeos -e -p eosio --plugin eosio::wallet_api_plugin --plugin eosio::wallet_plugin --plugin eosio::producer_plugin --plugin eosio::history_plugin --plugin eosio::chain_api_plugin --plugin eosio::history_api_plugin --plugin eosio::http_plugin -d /mnt/dev/data --config-dir /mnt/dev/config --http-server-address=0.0.0.0:8888 --access-control-allow-origin=* --contracts-console',
      ],
      ExposedPorts: { '8888/tcp': {}, '9876/tcp': {} },
      HostConfig: {
        Binds: binds,
        PortBindings: {
          '8888/tcp': [{ HostIp: '', HostPort: String(port) }],
        },
      },
    }

    let container

    if (existingContainerInfo) {
      // Fetch the container configuration
      container = await this.docker.getContainer(existingContainerInfo.Id)
      const containerInfo = await container.inspect()

      // Check if the configuration has changed
      if (
        !isSubset(
          {
            name: normalizedName,
            ...containerInfo.Config,
            HostConfig: containerInfo.HostConfig,
          },
          containerConfig
        )
      ) {
        onRunProgress({ status: RUN_STATUS.CONTAINER_CONFIG_MODIFIED })
        try {
          await container.stop()
        } catch (e) {}
        try {
          await container.remove()
        } catch (e) {}
        container = null
      } else {
        onRunProgress({ status: RUN_STATUS.CONTAINER_FOUND })
      }
    }

    if (!container) {
      onRunProgress({ status: RUN_STATUS.CONTAINER_CREATED })
      container = await this.docker.createContainer(containerConfig)
    }

    return new Promise(resolve => {
      container.start((err, data) => {
        onRunProgress({
          status: RUN_STATUS.CONTAINER_STARTED,
          id: container.id,
        })
        resolve(container, data)
      })
    })
  }

  async stop(options = {}) {
    const { name = 'eosio' } = options

    const normalizedName = normalizeContainerName(name)

    const allContainers = await this.docker.listContainers({ all: true })
    const existingContainerInfo = allContainers.find(c =>
      c.Names.includes(normalizedName)
    )

    return this.docker.getContainer(existingContainerInfo.Id).stop()
  }

  list() {
    return Object.keys(this.containers)
  }
}

LocalDocker.RUN_STATUS = RUN_STATUS
LocalDocker.PULL_STATUS = PULL_STATUS

module.exports = LocalDocker
