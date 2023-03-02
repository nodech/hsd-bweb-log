/*!
 * file.js - File reporter.
 * Copyright (c) 2023, Nodari Chkuaselidze (MIT License)
 * https://github.com/nodech/hsd-bweb-log
 */

'use strict';

const AbstractReporter = require('./abstract-reporter');
const {ReporterOptions} = AbstractReporter;
const RotatingLogFile = require('./rotating-file');

/** @typedef {import('./logger').FinishedMetaData} FinishedMetaData */

/**
 * @alias module:logger.FileReporter
 */

class FileReporter extends AbstractReporter {
  constructor(options) {
    super();

    this.options = new ReporterOptions(options);
    this.config = this.options.config;
    this.name = this.options.name;
    this.fileName = this.config.str('file-name', this.name + '.log');
    this.filePath = this.config.location(this.fileName);
    this.fileLogger = new RotatingLogFile({
      filename: this.filePath,
      maxFileSize: this.config.mb('file-size', 10e3),
      maxFiles: this.config.int('max-files', 5)
    });
  }

  async open() {
    await this.fileLogger.open();
  }

  async close() {
    await this.fileLogger.open();
  }

  /**
   * @param {Object} req
   * @param {FinishedMetaData} meta
   * @returns {Promise}
   */

  async logRequest(req, meta) {
    const requestObject = {
      type: 'begin',
      date: Date.now(),
      method: req.method,
      pathname: req.pathname,
      params: filterObject(req.params),
      query: filterObject(req.query),
      body: filterObject(req.body),
      meta: meta.requestJSON()
    };

    this.fileLogger.writeJSONLine(requestObject);
  }

  /**
   * @param {Object} req
   * @param {Object} res
   * @param {FinishedMetaData} meta
   * @returns {Promise}
   */

  async logRequestFinished(req, res, meta) {
    const requestObject = {
      type: 'finish',
      date: Date.now(),
      method: req.method,
      pathname: req.pathname,
      params: filterObject(req.params),
      query: filterObject(req.query),
      body: filterObject(req.body),
      meta: meta.responseJSON()
    };

    this.fileLogger.writeJSONLine(requestObject);
  }

  static id = 'file';
}

function filterObject(obj) {
  const filtered = {};
  let entries = 0;

  for (const [k, v] of Object.entries(obj)) {
    if (k === 'token')
      continue;

    if (k === 'passphrase')
      continue;

    filtered[k] = v;
    entries++;
  }

  if (!entries)
    return undefined;

  return filtered;
}

module.exports = FileReporter;
