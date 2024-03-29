/*!
 * index.js - Bweb request logger.
 * Copyright (c) 2023, Nodari Chkuaselidze (MIT License).
 * https://github.com/nodech/hsd-bweb-log
 */

'use strict';

const assert = require('bsert');
const EventEmitter = require('events');
const Logger = require('./logger');
const {ConsoleReporter, FileReporter, NameReporter} = require('./reporters');

/** @typedef {import('./abstract-reporter')} AbstractReporter */

/**
 * @module logger
 */

class Plugin extends EventEmitter {
  constructor(node) {
    super();

    this.node = node;
    // NOTE: Don't use filter for now and use config directly
    // to support old hsd.
    // See: https://github.com/handshake-org/hsd/pull/806
    // this.config = node.config.filter('weblog');
    this.config = node.config;
    this.loaded = false;

    this.isNode = node.chain ? true : false;
    this.isWalletNode = node.wdb ? true : false;

    this.logNode = this.config.bool('weblog-node', true);
    this.logWallet = this.config.bool('weblog-wallet', true);

    // get memory from the actual NODE.
    this.memory = node.config.bool('memory', false);

    this.wallet = null;

    this.nodeLogger = null;
    this.walletLogger = null;
    this.loggers = [];
    this.reporters = [];

    this.nodeReporters = [];
    this.walletReporters = [];

    this.nodeLogName = null;
    this.walletLogName = null;
  }

  init() {
    assert(!this.loaded, 'Plugin was already initialized.');

    this.loaded = true;
    if (this.isWalletNode)
      this.wallet = this.node;

    if (this.isNode && this.node.get('walletdb'))
      this.wallet = this.node.get('walletdb');

    if (this.node && this.logNode) {
      this.nodeLogName = this.config.str('weblog-node-logname', 'node-http');
      this.nodeLogger = new Logger({
        name: this.nodeLogName,
        node: this.node,
        config: this.config
      });

      this.loggers.push(this.nodeLogger);
    }

    if (this.wallet && this.logWallet) {
      this.walletLogName = this.config.str(
        'weblog-wallet-logname',
        'wallet-http'
      );

      this.walletLogger = new Logger({
        name: this.walletLogName,
        node: this.wallet,
        config: this.config
      });

      this.loggers.push(this.walletLogger);
    }

    this.checkReporters();
    this.checkNodeReporters();
    this.checkWalletReporters();
  }

  /**
   * Check reporters that are common to both.
   */

  checkReporters() {
    const console = this.config.bool('weblog-reporter-console', true);
    const file = this.config.bool('weblog-reporter-file', true);

    if (console) {
      this.nodeReporters.push({ Reporter: ConsoleReporter, options: {} });
      this.walletReporters.push({ Reporter: ConsoleReporter, options: {} });
    }

    // register node file reporter
    if (file) {
      const fileName = this.config.str(
        'weblog-node-file-name',
        this.nodeLogName + '.log'
      );

      const filePath = this.config.location(fileName);
      const fileMaxSize = this.config.mb('weblog-node-file-size');
      const fileMaxFiles = this.config.int('weblog-node-max-files');
      const logParams = this.config.bool('weblog-node-file-params');
      const logResponse = this.config.bool('weblog-node-file-response');

      this.nodeReporters.push({
        Reporter: FileReporter,
        options: {
          name: this.nodeLogName,
          filePath,
          fileMaxSize,
          fileMaxFiles,
          logParams,
          logResponse
        }
      });
    }

    // register wallet file reporter
    if (file) {
      const fileName = this.config.str(
        'weblog-wallet-file-name',
        this.walletLogName + '.log'
      );

      const filePath = this.config.location(fileName);
      const fileMaxSize = this.config.mb('weblog-wallet-file-size');
      const fileMaxFiles = this.config.int('weblog-wallet-max-files');
      const logParams = this.config.bool('weblog-wallet-file-params');
      const logResponse = this.config.bool('weblog-wallet-file-response');

      this.walletReporters.push({
        Reporter: FileReporter,
        options: {
          name: this.walletLogName,
          filePath,
          fileMaxSize,
          fileMaxFiles,
          logParams,
          logResponse
        }
      });
    }
  }

  /**
   * Check node specific reporters.
   */

  checkNodeReporters() {
    if (!this.isNode)
      return;

    // Nothing to do.
  }

  /**
   * Check wallet specific reporters.
   */

  checkWalletReporters() {
    if (!this.wallet)
      return;

    const names = this.config.bool('weblog-reporter-names', true);

    if (names) {
      const fileName = this.config.str(
        'weblog-name-file-name',
        this.walletLogName + '-names.log'
      );

      const filePath = this.config.location(fileName);
      const fileMaxSize = this.config.mb('weblog-name-file-size');
      const fileMaxFiles = this.config.int('weblog-name-max-files');

      this.walletReporters.push({
        Reporter: NameReporter,
        options: {
          name: this.walletLogName,
          filePath,
          fileMaxSize,
          fileMaxFiles
        }
      });
    }
  }

  async open() {
    // Do this on open to make sure wdb has been loaded.
    this.init();

    for (const logger of this.loggers)
      logger.init();

    if (this.walletLogger) {
      this.walletLogger.on('error', (e) => {
        this.emit('error', e);
      });

      await this.register(
        this.walletLogger,
        this.walletReporters,
        !this.memory
      );
    }

    if (this.nodeLogger) {
      this.walletLogger.on('error', (e) => {
        this.emit('error', e);
      });

      await this.register(this.nodeLogger, this.nodeReporters, !this.memory);
    }
  }

  async close() {
  }

  /**
   * Register reporter
   * @param {Logger} logger
   * @param {Class[]} reporters
   * @param {Boolean} [enable = false]
   * @returns {Promise}
   */

  async register(logger, reporters, enable = false) {
    const registers = [];

    for (const {Reporter, options} of reporters)
      registers.push(logger.register(Reporter, options, enable));

    await Promise.all(registers);
  }

  /**
   * Unregister reporters
   * @param {Logger} logger
   * @param {Class[]} reporters
   * @param {AbstractReporter}
   */

  async unregister(logger, reporters) {
    const unregisters = [];

    for (const {Reporter} of reporters)
      unregisters.push(logger.unregister(Reporter));

    await Promise.all(unregisters);
  }

  static init(node) {
    return new Plugin(node);
  }

  static id = 'weblog';
}

module.exports = Plugin;
