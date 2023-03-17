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
    // to support older HSD configs.
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
  }

  init() {
    assert(!this.loaded, 'Plugin was already initialized.');

    this.loaded = true;
    if (this.isWalletNode)
      this.wallet = this.node;

    if (this.isNode && this.node.get('walletdb'))
      this.wallet = this.node.get('walletdb');

    if (this.node && this.logNode) {
      this.nodeLogger = new Logger({
        name: this.config.str('weblog-node-logname', 'node-http'),
        node: this.node,
        config: this.config
      });

      this.loggers.push(this.nodeLogger);
    }

    if (this.wallet && this.logWallet) {
      this.walletLogger = new Logger({
        node: this.wallet,
        config: this.config,
        name: this.config.str('weblog-wallet-logname', 'wallet-http')
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
      this.nodeReporters.push(ConsoleReporter);
      this.walletReporters.push(ConsoleReporter);
    }

    if (file) {
      this.nodeReporters.push(FileReporter);
      this.walletReporters.push(FileReporter);
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

    if (names)
      this.walletReporters.push(NameReporter);
  }

  async open() {
    if (this.memory)
      return;

    // Do this on open to make sure wdb has been loaded.
    this.init();

    for (const logger of this.loggers)
      logger.init();

    if (this.walletLogger)
      await this.register(this.walletLogger, this.walletReporters, true);

    if (this.nodeLogger)
      await this.register(this.nodeLogger, this.nodeReporters, true);
  }

  async close() {
    if (this.memory)
      return;
  }

  /**
   * Register reporter
   * @param {Logger} logger
   * @param {Function[]} reporters
   * @param {Boolean} [enable = false]
   * @returns {Promise}
   */

  async register(logger, reporters, enable = false) {
    const registers = [];

    for (const Reporter of reporters) {
      registers.push(logger.register(Reporter, enable));
    }

    await Promise.all(registers);
  }

  /**
   * Unregister reporters
   * @param {Logger} logger
   * @param {Function[]} reporters
   * @param {AbstractReporter}
   */

  async unregister(logger, reporters) {
    const unregisters = [];

    for (const Reporter of reporters)
      unregisters.push(logger.unregister(Reporter));

    await Promise.all(unregisters);
  }

  static init(node) {
    return new Plugin(node);
  }

  static id = 'weblog';
}

module.exports = Plugin;
