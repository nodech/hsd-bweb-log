/*!
 * console.js - report to console.
 * Copyright (c) 2023, Nodari Chkuaselidze (MIT License)
 * https://github.com/nodech/hsd-bweb-log
 */

'use strict';

const util = require('../util');
const AbstractReporter = require('./abstract');
const {ReporterOptions} = AbstractReporter;

/** @typedef {import('../logger').FinishedMetaData} FinishedMetaData */

/**
 * @alias module:reporter.ConsoleReporter
 */

class ConsoleReporter extends AbstractReporter {
  /**
   * @param {Object} options
   */

  constructor(options) {
    super();

    this.options = new ReporterOptions(options);
    this.name = this.options.name + '-console';
    this.logger = this.options.logger.context(this.name);
  }

  async open() {
    ;
  }

  async close() {
    ;
  }

  /**
   * @param {Object} req
   * @param {Object} res
   * @param {FinishedMetaData} meta
   * @returns {Promise}
   */

  async logRequestFinished(req, res, meta) {
    const time = util.formatTime(meta.diff, 'ms');

    this.logger.debug('%s - %s - %s - %s',
      time,
      meta.statusCode,
      req.method,
      req.pathname
    );
  }

  static id = 'console';
}

ConsoleReporter.ReporterOptions = ReporterOptions;
module.exports = ConsoleReporter;
