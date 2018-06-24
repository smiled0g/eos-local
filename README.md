# EOS Local

Node.js module for running local EOS docker container. It supports both CLI and normal node module.

[![NPM](https://nodei.co/npm/eos-local.png?downloads=true&downloadRank=true&stars=true)](https://nodei.co/npm/eos-local/)

[![Dependency Status](https://david-dm.org/smiled0g/eos-local.svg)](https://david-dm.org/smiled0g/eos-local)
[![devDependency Status](https://david-dm.org/smiled0g/eos-local/dev-status.svg)](https://david-dm.org/smiled0g/eos-local#info=devDependencies)

## Why build this library?

I build this while having [my jouney into EOS ecosystem](https://github.com/smiled0g/eos-experiments). While running EOS in docker makes it very convenient for developers to spin up local EOS test environments, there's no convenient way to run the docker containers within Node.js environment. The library offers a simple way to do exactly that with Node.js. Via `npx` interface, it also functions as CLI tool for folks who don't want to deal with docker.

## Dependencies

You need [Docker](https://www.docker.com/get-docker) and [Node.js v8+](https://nodejs.org/en/). The library is smart enough to pull the latest version of `eosio/eos-dev:latest` docker image for you if you don't already have it.

## Node.js Installation

```sh
$> npm install --save eos-local
```

## Node.js Example Usage

```js
const EOSLocal = require('eos-local')
const eos = new EOSLocal()

eos.run({
  name: 'eos-dev-container',
  port: '8888',
  binds: [
    '/tmp/work:/work',
    '/tmp/eosio/data:/mnt/dev/data',
    '/tmp/eosio/config:/mnt/dev/config',
  ],
})

/** Do your thing here */

eos.stop({
  name: 'eos-dev-container', // Same container name
})
```

Take a look at `bin/cli.js` for more example of Node.js use. More documentaiton coming soon.

## CLI Usage

Run with `npx`, without installing

```sh
$> npx eos-local run

# With some configuration

$> npx eos-local run -p 8888 -v /tmp/work:/work,/tmp/eosio/data:/mnt/dev/data eos-dev-container

# Do your usual hack til you're satisfied

$> npx eos-local stop eos-dev-container
```

You can pass the `--help` flag for all the options.

```
npx eos-local --help
npx eos-local run --help
npx eos-local stop --help
```

## License

[MIT = Do whatever you want with this](LICENSE.md)

## Contributions

All the pull requests are extremely welcome.
