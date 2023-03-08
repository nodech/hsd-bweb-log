/*!
 * file.js - File reporter.
 * Copyright (c) 2023, Nodari Chkuaselidze (MIT License)
 * https://github.com/nodech/hsd-bweb-log
 */

'use strict';

const assert = require('assert');
const AbstractReporter = require('./abstract');
const {ReporterOptions} = AbstractReporter;
const RotatingLogFile = require('../rotating-file');
const Validator = require('bval');

/** @typedef {import('../logger').FinishedMetaData} FinishedMetaData */

/**
 * @alias module:reporter.FileReporter
 */

class FileReporter extends AbstractReporter {
  constructor(options) {
    super();

    this.options = new FileReporterOptions(options);
    this.config = this.options.config;
    this.name = this.options.name;
    this.fileName = this.options.fileName;
    this.filePath = this.options.filePath;
    this.fileLogger = new RotatingLogFile({
      filename: this.filePath,
      maxFileSize: this.options.fileMaxSize,
      maxFiles: this.options.fileMaxFiles
    });
  }

  async open() {
    await this.fileLogger.open();
  }

  async close() {
    await this.fileLogger.close();
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
      request: {
        method: req.method,
        pathname: req.pathname,
        params: filterObject(req.params, this.options.logParams),
        query: filterObject(req.query, this.options.logParams),
        body: filterObject(req.body, this.options.logParams),
        ...meta.requestJSON()
      }
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
      request: {
        method: req.method,
        pathname: req.pathname,
        params: filterObject(req.params, this.options.logParams),
        query: filterObject(req.query, this.options.logParams),
        body: filterObject(req.body, this.options.logParams)
      },
      response: meta.responseJSON(this.options.logResponse)
    };

    this.fileLogger.writeJSONLine(requestObject);
  }

  static id = 'file';
}

class FileReporterOptions extends ReporterOptions {
  constructor(options) {
    super();

    this.fileName = null;
    this.filePath = null;
    this.fileMaxSize = 100 * (1 << 20); // 100 MiB
    this.fileMaxFiles = 10;
    this.logParams = true;
    this.logResponse = false;

    if (options)
      this.fromOptions(options);
  }

  fromOptions(options) {
    super.fromOptions(options);
    assert(typeof options === 'object');

    this.fileName = this.config.str('weblog-file-name', this.name + '.log');
    this.filePath = this.config.location(this.fileName);
    this.fileMaxSize = this.config.mb('weblog-file-size', this.fileMaxSize);
    this.fileMaxFiles = this.config.int('weblog-max-files', this.fileMaxFiles);
    this.logParams = this.config.bool('weblog-file-params', this.logParams);
    this.logResponse = this.config.bool(
      'weblog-file-response',
      this.logResponse
    );

    assert(typeof this.fileMaxSize === 'number');

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

/**
 * Filter out important information.
 * @param {Object} obj
 * @param {Boolean} log
 * @returns {Object}
 */

function filterObject(obj, log) {
  if (!log)
    return undefined;

  const filtered = {};
  let entries = 0;

  for (const [k, v] of Object.entries(obj)) {
    if (k === 'token' || k === 'passphrase') {
      filtered[k] = '*****';
      entries++;
      continue;
    }

    filtered[k] = v;
    entries++;
  }

  if (!entries)
    return undefined;

  return filtered;
}

module.exports = FileReporter;