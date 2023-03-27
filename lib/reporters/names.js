/*!
 * names.js - Report name request and their results.
 * Copyright (c) 2023, Nodari Chkuaselidze (MIT License)
 * https://github.com/nodech/hsd-bweb-log
 */

'use strict';

const assert = require('assert');
const Validator = require('bval');
const {REQUEST_BEGIN, REQUEST_FINISH} = require('../common');
const AbstractReporter = require('./abstract');
const {ReporterOptions} = AbstractReporter;
const RotatingLogFile = require('../store/rotating-file');

/** @typedef {import('../logger').FinishedMetaData} FinishedMetaData */

/**
 * @alias module:reporter.NameReporter
 */

class NameReporter extends AbstractReporter {
  constructor(options) {
    super();

    this.options = new NameReporterOptions(options);
    this.store = new this.options.Store({
      filename: this.options.filePath,
      maxFileSize: this.options.fileMaxSize,
      maxFiles: this.options.fileMaxFiles
    });
  }

  async open() {
    await this.store.open();
  }

  async close() {
    await this.store.close();
  }

  /**
   * @param {Object} req
   * @param {FinishedMetaData} meta
   * @returns {Promise}
   */

  async logRequest(req, meta) {
    const entries = this.nameEntriesFromRequest(req, meta, REQUEST_BEGIN);

    if (!entries)
      return;

    for (const entry of entries)
      await this.store.writeJSONLine(entry.requestJSON());
  }

  /**
   * @param {Object} req
   * @param {Object} res
   * @param {FinishedMetaData} meta
   * @returns {Promise}
   */

  async logRequestFinished(req, res, meta) {
    const entries = this.nameEntriesFromRequest(req, meta, REQUEST_FINISH);

    if (!entries)
      return;

    for (const entry of entries)
      await this.store.writeJSONLine(entry.responseJSON());
  }

  /**
   * Extract name related data.
   * @param {Object} req
   * @param {FinishedMetaData} meta
   * @param {String} logType
   * @returns {NameEntry[]}
   */

  nameEntriesFromRequest(req, meta, logType) {
    // All name related requests are POST.
    if (req.method !== 'POST')
      return null;

    if (req.path.length !== 3)
      return null;

    if (req.path[0] !== 'wallet')
      return null;

    switch (req.path[2]) {
      case 'open':
      case 'bid':
      case 'auction':
      case 'reveal':
      case 'redeem':
      case 'update':
      case 'renewal':
      case 'transfer':
      case 'cancel':
      case 'finalize':
      case 'revoke':
        break;
      default:
        return null;
    }

    const wallet = req.path[1];
    const type = req.path[2];
    return this.nameEntries(req, meta, wallet, type, logType);
  }

  /**
   * Handle normal name requests.
   * @param {Object} request
   * @param {FinishedMetaData} meta
   * @param {String} wallet
   * @param {String} type
   * @param {String} logType
   * @returns {NameEntry[]}
   */

  nameEntries(req, meta, wallet, type, logType) {
    if (type === 'auction')
      return this.auctionRequest(req, meta, wallet, type);

    const valid = Validator.fromRequest(req);

    let txHash;
    let extra;
    let name, broadcast;

    try {
      name = valid.str('name');
      broadcast = valid.bool('broadcast', true);
    } catch (e) {
      return null;
    }

    if (type === 'bid')
      extra = this.bidExtra(req);

    if (type === 'transfer')
      extra = this.transferExtra(req);

    if (logType === REQUEST_FINISH)
      txHash = meta.response?.hash;

    const entry = new NameEntry({
      wallet,
      type: type.toUpperCase(),
      name,
      broadcast,
      meta,
      extra,
      txHash
    });

    return [entry];
  }

  /**
   * Handle auction request.
   * @param {Object} request
   * @param {FinishedMetaData} meta
   * @param {String} wallet
   * @param {String} type
   * @returns {NameEntry[]}
   */

  auctionRequest(req, wallet) {
    // TODO
    return null;
  }

  /**
   * Get bid extra
   * @param {Object} req
   */

  bidExtra(req) {
    const valid = Validator.fromRequest(req);
    let bid, lockup;

    try {
      bid = valid.u64('bid');
      lockup = valid.u64('lockup');
      assert(bid != null);
      assert(lockup != null);
    } catch (e) {
      return null;
    }

    return { bid, lockup };
  }

  /**
   * Transfer extra.
   * @param {Object} req
   */

  transferExtra(req) {
    const valid = Validator.fromRequest(req);
    let address;

    try {
      address = valid.str('address');
      assert(address);
    } catch (e) {
      return null;
    }

    return { address };
  }

  static id = 'name';
}

class NameReporterOptions extends ReporterOptions {
  constructor(options) {
    super();

    this.Store = RotatingLogFile;
    this.filePath = null;
    this.fileMaxSize = 100 * (1 << 20); // 100 MiB
    this.fileMaxFiles = 10;

    if (options)
      this.fromOptions(options);
  }

  fromOptions(options) {
    super.fromOptions(options);

    assert(typeof options.filePath === 'string');
    this.filePath = options.filePath;

    if (options.Store != null) {
      assert(typeof options.Store === 'function');
      this.Store = options.Store;
    }

    if (options.fileMaxSize != null) {
      assert(typeof options.fileMaxSize === 'number');
      assert(Number.isSafeInteger(options.fileMaxSize));
      this.fileMaxSize = options.fileMaxSize;
    }

    if (options.fileMaxFiles != null) {
      assert(typeof options.fileMaxFiles === 'number');
      assert(Number.isSafeInteger(options.fileMaxSize));
      this.fileMaxFiles = options.fileMaxFiles;
    }

    if (options.Store != null) {
      assert(typeof options.Store === 'function');
      this.Store = options.Store;
    }
  }
}

/**
 * @property {String} wallet
 * @property {String} type
 * @property {String} name
 * @property {Boolean} broadcast
 * @property {FinishedMetaData?} meta
 * @property {Number} requestDate
 * @property {String} requestType
 * @property {String?} txHash
 */

class NameEntry {
  constructor(options) {
    this.wallet = '';
    this.type = '';
    this.name = '';
    this.broadcast = true;

    this.meta = null;
    this.extra = null;
    this.txHash = null;

    this.fromOptions(options);
  }

  fromOptions(options) {
    assert(typeof options === 'object');
    assert(typeof options.wallet === 'string');
    assert(typeof options.type === 'string');
    assert(typeof options.name === 'string');
    assert(typeof options.broadcast === 'boolean');

    assert(typeof options.meta === 'object');

    this.wallet = options.wallet;
    this.type = options.type;
    this.name = options.name;
    this.broadcast = options.broadcast;

    this.meta = options.meta;

    if (options.txHash != null) {
      assert(typeof options.txHash === 'string');
      this.txHash = options.txHash;
    }

    if (options.extra != null)
      this.extra = options.extra;
  }

  requestJSON(ts = Date.now()) {
    return {
      type: 'begin',
      timestamp: ts,
      date: new Date(ts),
      request: this.meta.requestJSON(),
      nameEvent: {
        wallet: this.wallet,
        type: this.type.toUpperCase(),
        name: this.name,
        broadcast: this.broadcast,
        extra: this.extra ?? undefined
      }
    };
  }

  responseJSON(ts = Date.now()) {
    return {
      type: 'finish',
      timestamp: ts,
      date: new Date(ts),
      response: this.meta.responseJSON(false),
      nameEvent: {
        wallet: this.wallet,
        type: this.type.toUpperCase(),
        name: this.name,
        broadcast: this.broadcast,
        txHash: this.txHash ?? undefined,
        extra: this.extra ?? undefined
      }
    };
  }
}

NameReporter.NameEntry = NameEntry;
NameReporter.NameReporterOptions = NameReporterOptions;
module.exports = NameReporter;
