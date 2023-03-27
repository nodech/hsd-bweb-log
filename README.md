Handshake bweb logger
=======================

Plugin for `hsd` and `bcoin` to log `bweb` request details into console and
file. It can be retroactively enabled/disabled and provides different levels
of details to the logs, which can be adjusted on the fly.

<!-- toc -->

- [Options](#options)
- [HTTP Endpoints](#http-endpoints)
- [Reporters](#reporters)
  * [Console](#console)
  * [File](#file)
  * [Names](#names)
- [Running](#running)
  * [Using NPM](#using-npm)
  * [Using git or path](#using-git-or-path)

<!-- tocstop -->

## Options
Plugin options:
  * `weblog-memory` - disables the whole thing. 
  * `weblog-node` - `true` or `false` - enable webloger plugin for the Node(default: `true`)
  * `weblog-wallet` - `true` or `false` - enable webloger plugin for the Wallet(default: `true`).
  * `weblog-node-logname` - Optionally pass different name for the node http logs. (default: `node-http`)
  * `weblog-wallet-logname` - Optionally pass different name for the wallet http logs. (default: `wallet-http`)

Available reporters:
  * `weblog-reporter-console` - `true` or `false` - enable console reporter (default: `true`)
  * `weblog-reporter-file` - `true` or `false` - enable file reporter (default: `true`)
  * `weblog-reporter-names` - `true` or `false` - enable name reporter (default: `true`)

Node file reporter options:
  * `weblog-node-file-name` - actual file name. (default: `wallet-node-logname` + `.log`)
  * `weblog-node-file-size` - Maximum size of a single log file. (default: `100` (MiB))
  * `weblog-node-max-files` - Maximum number of rotated files, everything else gets removed. (default: `10`)
  * `weblog-node-file-params` - Whether to include request parameters in the log file. (default: `true`)
  * `weblog-node-file-response` - Whether to include response json in the log file. (default: `false`)

Wallet file reporter options:
  * `weblog-wallet-file-name` - actual file name. (default: `weblog-wallet-logname` + `.log`)
  * `weblog-wallet-file-size` - Maximum size of a single log file. (default: `100` (MiB))
  * `weblog-wallet-max-files` - Maximum number of rotated files, everything else gets removed. (default: `10`)
  * `weblog-wallet-file-params` - Whether to include request parameters in the log file. (default: `true`)
  * `weblog-wallet-file-response` - Whether to include response json in the log file. (default: `false`)

Name reporter options:
  * `weblog-name-file-name` - actual file name. (default: `weblog-wallet-logname` + `-names.log`)
  * `weblog-name-file-size` - Maximum size of a single log file. (default: `100` (MiB))
  * `weblog-name-max-files` - Maximum number of rotated files, everything else gets removed. (default: `10`)

Example:
  `hsd --plugins=path/to/plugin --weblog-node=false --weblog-max-files=1 --weblog-file-response=true`

Or with config file `hsd.conf` or (`hsw.conf` if wallet runs standlone mode):

## HTTP Endpoints
Both wallet and node (separate) will have these endpoints availble for them on HTTP.
  * `GET /bweb-log` - get list of reporters and their status (enabled or not)
  * `PUT /bweb-log` - Enable or disable reporter.
    * `id` - reporter id.
    * `enabled` - boolean. (`true` to enable, `false` to disable)
  * `GET /bweb-log/:id` - get options for enabled reporter `id`.
  * `PUT /bweb-log/:id` - set options for enabled reporter (Check GET response for the reporter)

## Reporters

### Console
  Console is simple logger, that will log only small details about the request
(time it took to respond - status code returned - request type - path):
```
[debug] (wallet-http-console) 2.49ms - 200 - GET - /bweb-log
```
Or from the debug.log file:
```
[D:2023-03-08T12:11:44Z] (wallet-http) Request for method=GET path=/bweb-log (127.0.0.1).
[D:2023-03-08T12:11:44Z] (wallet-http-console) 2.49ms - 200 - GET - /bweb-log
```

### File

  File reporter logs information in JSON lines and supports rotation. It can also
log everything about the request. File reporter will omit `token` and `passphrase` from the logs.  
  - Note 1: JSON entries are per line but are not separated by the commas,
if you want to use something like `jq`, you may want to assemble them.
e.g. `(echo '['; paste -d, -s <(cat wallet-http*.log); echo ']') | jq`  
  - Note 2: Begin and Finish are not guaranteed to be in the same file after rotation.  
  - Note 3: Including Responses in the file may make some responses HUGE, like TX and Blocks
  that may even include full hex and whole JSON object.  
  - Note 4: If you want specific logger, might as well implement new reporter for this. E.g.
    name related events in `name.js` reporter.

Example, Log without response:
Request `curl http://127.0.0.1:14039/bweb-log/`
```json
{"type":"begin","date":1678277504039,"request":{"method":"GET","pathname":"/bweb-log","start":"661565188951496"}}
{"type":"finish","date":1678277504042,"request":{"method":"GET","pathname":"/bweb-log"},"response":{"start":"661565188951496","end":"661565191446711","diff":"2495215","diffStr":"2.49ms","status":200}}
```
Formatted:
```json
{
  "type": "begin",
  "date": 1678277504039,
  "request": {
    "method": "GET",
    "pathname": "/bweb-log",
    "start": "661565188951496"
  }
}
{
  "type": "finish",
  "date": 1678277504042,
  "request": {
    "method": "GET",
    "pathname": "/bweb-log"
  },
  "response": {
    "start": "661565188951496",
    "end": "661565191446711",
    "diff": "2495215",
    "diffStr": "2.49ms",
    "status": 200
  }
}
```

Log with response:
Request `curl http://127.0.0.1:14039/bweb-log/file\?token\=test -X PUT --data '{ "response": true }'`
```json
{"type":"begin","date":1678279523804,"request":{"method":"PUT","pathname":"/bweb-log/file","params":{"0":"file","id":"file"},"query":{"token":"*****"},"body":{"response":true},"start":"663581889266823"}}
{"type":"finish","date":1678279523808,"request":{"method":"PUT","pathname":"/bweb-log/file","params":{"0":"file","id":"file"},"query":{"token":"*****"},"body":{"response":true}},"response":{"start":"663581889266823","end":"663581896393225","diff":"7126402","diffStr":"7.12ms","status":200,"body":{"options":{"params":true,"response":true}}}}
```

Formatted:
```json
{
  "type": "begin",
  "date": 1678279523804,
  "request": {
    "method": "PUT",
    "pathname": "/bweb-log/file",
    "params": {
      "0": "file",
      "id": "file"
    },
    "query": {
      "token": "*****"
    },
    "body": {
      "response": true
    },
    "start": "663581889266823"
  }
}
{
  "type": "finish",
  "date": 1678279523808,
  "request": {
    "method": "PUT",
    "pathname": "/bweb-log/file",
    "params": {
      "0": "file",
      "id": "file"
    },
    "query": {
      "token": "*****"
    },
    "body": {
      "response": true
    }
  },
  "response": {
    "start": "663581889266823",
    "end": "663581896393225",
    "diff": "7126402",
    "diffStr": "7.12ms",
    "status": 200,
    "body": {
      "options": {
        "params": true,
        "response": true
      }
    }
  }
}
```

### Names

  Name reporter logs name operations that affect the name. It logs them similar
to File, in JSON Lines. Check file notes above.

TODO:
  - Add support for batches
  - Add account to the names.

Example:
Request: `curl $wallet/wallet/primary/bid -X POST \
  --data '{ "name": "handshake", "bid": 12000, "lockup": 25000 }'`

```json
{"type":"finish","timestamp":1679053480604,"date":"2023-03-17T11:44:40.604Z","response":{"start":"1117346173345","end":"1117377319705","diff":"31146360","diffStr":"31.14ms","status":200},"nameEvent":{"wallet":"primary","type":"BID","name":"xx","broadcast":true,"txHash":"4b9008b0fee8da7d471754d8cdf03e8fff6388c559d4c86791806a3e2ca81c3d","extra":{"bid":13000,"lockup":35000}}}
{"type":"begin","timestamp":1679053480660,"date":"2023-03-17T11:44:40.660Z","request":{"start":"1117433357333"},"nameEvent":{"wallet":"primary","type":"BID","name":"xx","broadcast":true,"extra":{"bid":12000,"lockup":25000}}}
```

Formatted:

```json
{
  "type": "finish",
  "timestamp": 1679053480604,
  "date": "2023-03-17T11:44:40.604Z",
  "response": {
    "start": "1117346173345",
    "end": "1117377319705",
    "diff": "31146360",
    "diffStr": "31.14ms",
    "status": 200
  },
  "nameEvent": {
    "wallet": "primary",
    "type": "BID",
    "name": "handshake",
    "broadcast": true,
    "txHash": "4b9008b0fee8da7d471754d8cdf03e8fff6388c559d4c86791806a3e2ca81c3d",
    "extra": {
      "bid": 13000,
      "lockup": 35000
    }
  }
}
{
  "type": "begin",
  "timestamp": 1679053480660,
  "date": "2023-03-17T11:44:40.660Z",
  "request": {
    "start": "1117433357333"
  },
  "nameEvent": {
    "wallet": "primary",
    "type": "BID",
    "name": "handshake",
    "broadcast": true,
    "extra": {
      "bid": 12000,
      "lockup": 25000
    }
  }
}
```

## Running
### Using NPM

  - install: `npm i -g hsd-weblog`
  - Make sure global node_modules resolves hsd-weblog
    - e.g. You could use `export NODE_PATH=/usr/lib/node_modules` (arch)
    - asdf example: ``export NODE_PATH="$NODE_PATH:`asdf
      where nodejs`/.npm/lib/node_modules"``
    - Basically, make sure `node -e 'require("hsd-weblog")'` does not
      throw an error.
  - run: `hsd --plugins hsd-weblog`

### Using git or path
  - Clone: `git clone https://github.com/nodech/hsd-weblog`
  - `cd hsd-weblog`
  - ``hsd --plugins `pwd` ``
