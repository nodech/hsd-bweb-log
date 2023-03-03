/*!
 * abstract-reporter.js - abstract reporter.
 * Copyright (c) 2023, Nodari Chkuaselidze (MIT License)
 */

'use strict';

const assert = require('bsert');

/** @typedef {import('./logger').FinishedMetaData} FinishedMetaData */

/**
 * @alias module:logger.AbstractReporter
 * @property {String} name
 * @property {ReporterOptions} options
 */

class AbstractReporter {
  constructor(options) {
    this.options = new ReporterOptions(options);
    this.name = this.options.name;
  }

  init() {
  }

  async open() {
    throw new Error('Not implemented.');
  }

  async close() {
    throw new Error('Not implemented.');
  }

  /**
   * @returns {Promise<Object>}
   */

  async getOptions() {
    return {};
  }

  /**
   * Set options
   * @param {Object} req
   * @returns {Promise<AbstractReporter>}
   */

  async setOptions(req) {
    return this;
  }

  /**
   * @param {Object} req
   */

  async logRequest(req) {
    ;
  }

  /**
   * @param {Object} req
   * @param {Object} res
   * @param {FinishedMetaData} meta
   */

  async logRequestFinished(req, res, meta) {
    ;
  }

  static id = 'abstract';

  /**
   * Initialize reporter
   * @param {ReporterOptions} options
   * @returns {AbstractReporter}
   */

  static init(options) {
    return new this(options);
  }
}

/**
 * @property {String} name - logger name
 * @property {Object} node
 * @property {Object} config
 * @property {Object} logger
 */

class ReporterOptions {
  /**
   * @param {Object} [options]
   */

  constructor(options) {
    this.name = 'abstract';
    this.node = null;
    this.config = null;
    this.logger = null;

    if (options)
      this.fromOptions(options);
  }

  /**
   * @param {Object} options
   * @returns {ReporterOptions}
   */

  fromOptions(options) {
    assert(typeof options === 'object');
    assert(typeof options.node === 'object');

    this.node = options.node;
    this.config = options.node.config;
    this.logger = options.node.logger;

    if (options.name != null) {
      assert(typeof options.name === 'string');
      this.name = options.name;
    }

    if (options.config != null) {
      assert(typeof options.config === 'object');
      this.config = options.config;
    }

    if (options.logger != null) {
      assert(typeof options.config === 'object');
      this.config = options.config;
    }

    assert(typeof this.config === 'object');
    assert(typeof this.logger === 'object');
  }

  fromReq(req) {
    return this;
  }

  fromJSON(json) {
    return this;
  }

  toJSON() {
    return {};
  }
}

AbstractReporter.ReporterOptions = ReporterOptions;
module.exports = AbstractReporter;
