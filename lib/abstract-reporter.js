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

  static init(loggerName, options) {
    return new this(loggerName, options);
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

    this.logParams = true;
    this.logOnRequest = true;
    this.logAfterRequest = true;

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

    if (options.logParams != null) {
      assert(typeof options.logParams === 'boolean');
      this.logParams = options.logParams;
    }

    if (options.logOnRequest != null) {
      assert(typeof options.logOnRequest === 'boolean');
      this.logOnRequest = options.logOnRequest;
    }

    if (options.logAfterRequest != null) {
      assert(typeof options.logAfterRequest === 'boolean');
      this.logAfterRequest = options.logAfterRequest;
    }
  }
}

AbstractReporter.ReporterOptions = ReporterOptions;
module.exports = AbstractReporter;
