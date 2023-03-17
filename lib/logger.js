/*!
 * logger.js - Logger.
 * Copyright (c) 2023, Nodari Chkuaselidze (MIT License).
 * https://github.com/nodech/hsd-bweb-log
 */

'use strict';

const assert = require('bsert');
const util = require('./util');
const Validator = require('bval');

/** @typedef {import('./reporters/abstract')} AbstractReporter */

/**
 * Metadata for the finished request.
 * @alias module:logger.FinishedMetaData
 * @property {BigInt} start
 * @property {BigInt} end
 * @property {BigInt} diff
 */

class FinishedMetaData {
  constructor() {
    this.start = 0n;
    this.end = 0n;

    this.errored = null;
    this.statusCode = -1;
    this.response = null;
  }

  get diff() {
    return this.end - this.start;
  }

  requestJSON() {
    return {
      start: this.start.toString()
    };
  }

  responseJSON(response) {
    return {
      start: this.start.toString(),
      end: this.end.toString(),
      diff: this.diff.toString(),
      diffStr: util.formatTime(this.diff, 'ms'),
      status: this.statusCode,
      error: this.errored ?? undefined,
      body: response ? (this.response ?? undefined) : undefined
    };
  }
}

/**
 * Manager for the requests and reporters.
 * @alias module:logger.Logger
 * @property {String} name
 * @property {Object} http
 * @property {Object} config
 * @property {Map<String, AbstractReporter>} availableReporters
 * @property {Map<String, AbstractReporter>} enabledReporters
 */

class Logger {
  constructor(options) {
    this.options = new LoggerOptions(options);

    this.name = this.options.name;
    this.config = this.options.config;
    this.http = this.options.http;
    this.availableReporters = new Map();
    this.enabledReporters = new Map();
  }

  /**
   * Initialize
   */

  init() {
    this.initManagerRoutes();
    this.wrapRouter();
  }

  /**
   * Wrap the router methods.
   */

  wrapRouter() {
    const router = this.http.routes;
    const types = ['_get', '_post', '_put', '_del', '_patch'];

    for (const type of types) {
      const routes = router[type];

      for (const route of routes) {
        route.handler = this.wrapHandle(route.handler);
      }
    }

    this.wrapError();
  }

  wrapResponse(res) {
    return new WrappedResponse(res);
  }

  wrapError() {
    if (!this.http.onError)
      return;

    const _onError = this.http.onError.bind(this.http);

    this.http.onError = async (err, req, res) => {
      const wres = this.wrapResponse(res);

      await _onError(err, req, wres);

      if (!req.meta)
        return;

      const meta = req.meta;

      meta.statusCode = res.statusCode;
      meta.errored = wres.sentObj;
      meta.end = process.hrtime.bigint();

      await this.logRequestFinished(req, res, meta);
    };
  };

  wrapHandle(handler) {
    const whandler = async (req, res) => {
      const wres = this.wrapResponse(res);

      const meta = new FinishedMetaData();
      meta.start = process.hrtime.bigint();

      await this.logRequest(req, meta);

      let result;
      try {
        result = await handler(req, wres);
        meta.statusCode = res.statusCode;
        meta.response = wres.sentObj;
      } catch (e) {
        req.meta = meta;
        throw e;
      }

      meta.end = process.hrtime.bigint();
      await this.logRequestFinished(req, res, meta);

      return result;
    };

    whandler._handler = handler;

    return whandler;
  }

  /**
   * Setup log manager routes
   */

  initManagerRoutes() {
    this.http.get('/bweb-log', async (req, res) => {
      const reporters = this.listReportersStatuses();

      res.json(200, { reporters });
    });

    this.http.put('/bweb-log', async (req, res) => {
      const valid = Validator.fromRequest(req);
      const id = valid.str('id');
      const status = valid.bool('enabled');

      enforce(this.hasReporter(id), `Reporter ${id} does not exist.`);

      const isEnabled = this.isEnabled(id);

      if (!status && isEnabled)
        await this.disableReporter(id);

      if (status && !isEnabled)
        await this.enableReporter(id);

      const reporters = this.listReportersStatuses();

      res.json(200, { reporters });
    });

    this.http.get('/bweb-log/:id', async (req, res) => {
      const valid = Validator.fromRequest(req);
      const id = valid.str('id');

      enforce(this.hasReporter(id), `Reporter ${id} does not exist.`);
      enforce(this.isEnabled(id), `Reporter ${id} is not enabled.`);

      const reporter = this.enabledReporters.get(id);

      res.json(200, {
        options: await reporter.getOptions()
      });
    });

    this.http.put('/bweb-log/:id', async (req, res) => {
      const valid = Validator.fromRequest(req);
      const id = valid.str('id');

      enforce(this.hasReporter(id), `Reporter ${id} does not exist.`);
      enforce(this.isEnabled(id), `Reporter ${id} is not enabled.`);

      const reporter = this.enabledReporters.get(id);
      await reporter.setOptions(req);

      res.json(200, {
        options: await reporter.getOptions()
      });
    });
  }

  /**
   * @param {Object} req
   * @param {FinishedMetaData} meta
   * @returns {Promise}
   */

  async logRequest(req, meta) {
    const all = [];
    for (const reporter of this.enabledReporters.values())
      all.push(reporter.logRequest(req, meta));
    await Promise.all(all);
  }

  /**
   * @param {Object} req
   * @param {Object} res
   * @param {FinishedMetaData} meta
   * @returns {Promise}
   */

  async logRequestFinished(req, res, meta) {
    assert(res.sent);

    const all = [];
    for (const reporter of this.enabledReporters.values())
      all.push(reporter.logRequestFinished(req, res, meta));
    await Promise.all(all);
  }

  /**
   * Register reporter
   * @param {AbstractReporter} Reporter
   * @param {Boolean} [enable = false]
   * @returns {Promise}
   */

  async register(Reporter, enable = false) {
    assert(typeof Reporter === 'function');
    assert(typeof Reporter.id === 'string');
    assert(!this.availableReporters.has(Reporter.id),
      'Reporter already exists.');

    this.availableReporters.set(Reporter.id, Reporter);

    if (enable)
      await this.enableReporter(Reporter.id);
  }

  /**
   * Unregister reporter
   * @param {AbstractReporter} Reporter
   * @returns {Promise}
   */

  async unregister(Reporter) {
    const id = Reporter.id;
    assert(this.availableReporters.has(id));
    assert(this.availableReporters.get(id) === Reporter);

    if (this.enabledReporters.has(id))
      await this.disableReporter(Reporter.id);

    this.repoterCache.delete(Reporter);
    this.availableReporters.delete(id);
  }

  /**
   * Get object with reporters.
   * @returns {Object}
   */

  listReportersStatuses() {
    const reporters = {};

    for (const id of this.availableReporters.keys())
      reporters[id] = this.isEnabled(id);

    return reporters;
  }

  /**
   * Enable reporter
   * @param {String} id
   * @returns {Promise}
   */

  async enableReporter(id) {
    assert(this.availableReporters.has(id));
    const Reporter = this.availableReporters.get(id);

    const instance = Reporter.init(this.options);
    await instance.open();

    this.enabledReporters.set(id, instance);
  }

  /**
   * Disable reporter.
   * @param {String} id
   * @returns {Promise}
   */

  async disableReporter(id) {
    assert(this.availableReporters.has(id));
    assert(this.enabledReporters.has(id));

    const instance = this.enabledReporters.get(id);

    await instance.close();
    this.enabledReporters.delete(id);
  }

  /**
   * Is reporter enabled
   * @param {String} id
   * @returns {Boolean}
   */

  isEnabled(id) {
    return this.enabledReporters.has(id);
  }

  /**
   * Has reporter
   * @param {String} id
   * @returns {Boolean}
   */

  hasReporter(id) {
    return this.availableReporters.has(id);
  }
}

/**
 * @private
 */

class LoggerOptions {
  constructor(options) {
    this.name = 'bweb-logger';
    this.node = null;
    this.nodeConfig = null;
    this.config = null;
    this.http = null;

    this.fromOptions(options);
  }

  fromOptions(options) {
    assert(typeof options === 'object');
    assert(typeof options.node === 'object');

    this.node = options.node;
    this.config = this.node.config;
    this.nodeConfig = this.node.config;
    this.http = this.node.http;

    if (options.name != null) {
      assert(typeof options.name === 'string');
      this.name = options.name;
    }

    if (options.config != null) {
      assert(typeof options.config === 'object');
      this.config = options.config;
    }

    if (options.http != null) {
      assert(typeof options.http === 'object');
      this.http = options.http;
    }
  }
}

class WrappedResponse {
  constructor(res) {
    this.res = res;
    this.sentObj = null;
  }

  get sent() {
    return this.res.sent;
  }

  json(code, json) {
    assert(!this.sent);
    this.sentObj = json;
    return this.res.json(code, json);
  }
}

function enforce(value, msg) {
  if (!value) {
    const err = new Error(msg);
    err.statusCode = 400;
    throw err;
  }
}

Logger.FinishedMetaData = FinishedMetaData;
module.exports = Logger;
