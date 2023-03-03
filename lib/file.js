/*!
 * file.js - File reporter.
 * Copyright (c) 2023, Nodari Chkuaselidze (MIT License)
 * https://github.com/nodech/hsd-bweb-log
 */

'use strict';

const assert = require('assert');
const AbstractReporter = require('./abstract-reporter');
const {ReporterOptions} = AbstractReporter;
const RotatingLogFile = require('./rotating-file');
const Validator = require('bval');

/** @typedef {import('./logger').FinishedMetaData} FinishedMetaData */

/**
 * @alias module:logger.FileReporter
 */

class FileReporter extends AbstractReporter {
  constructor(options) {
    super();

    this.options = new FileReporterOptions(options);
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
   * @returns {Object}
   */

  async getOptions() {
    return this.options.toJSON();
  }

  /**
   * @param {Object} req
   * @returns {Promise<FileReporter>}
   */

  async setOptions(req) {
    this.options.fromReq(req);
    return this;
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
      meta: meta.responseJSON(this.options.logResponse)
    };

    this.fileLogger.writeJSONLine(requestObject);
  }

  static id = 'file';
}

/**
 * Filter out important information.
 * @param {Object} obj
 * @returns {Object}
 */

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

class FileReporterOptions extends ReporterOptions {
  constructor(options) {
    super(options);

    this.logParams = true;
    this.logResponse = true;

    if (options)
      this.fromOptions(options);
  }

  fromOptions(options) {
    super.fromOptions(options);
    assert(typeof options === 'object');

    if (options.logParams != null) {
      assert(typeof options.logParams === 'boolean');
      this.logParams = options.logParams;
    }

    if (options.logResponse != null) {
      assert(typeof options.logResponse === 'boolean');
      this.logResponse = options.logResponse;
    }

    return this;
  }

  fromReq(req) {
    const valid = Validator.fromRequest(req);
    const params = valid.bool('params', this.logParams);
    const response = valid.bool('response', this.logResponse);

    return this.fromJSON({ params, response });
  }

  fromJSON(json) {
    assert(typeof json === 'object');
    assert(typeof json.params === 'boolean');
    assert(typeof json.response === 'boolean');

    this.logParams = json.params;
    this.logResponse = json.response;

    return this;
  }

  toJSON() {
    return {
      params: this.logParams,
      response: this.logResponse
    };
  }
}

module.exports = FileReporter;
