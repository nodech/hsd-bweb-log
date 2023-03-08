/*!
 * index.js - Bweb request logger.
 * Copyright (c) 2023, Nodari Chkuaselidze (MIT License).
 * https://github.com/nodech/hsd-bweb-log
 */

'use strict';

const assert = require('bsert');
const EventEmitter = require('events');
const ResponseLogger = require('./logger');
const {ConsoleReporter, FileReporter} = require('./reporters');

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
    this.console = this.config.bool('weblog-reporter-console', true);
    this.file = this.config.bool('weblog-reporter-file', true);
    // get memory from the actual NODE.
    this.memory = node.config.bool('memory', false);

    this.wallet = null;

    this.nodeLogger = null;
    this.walletLogger = null;
    this.loggers = [];
    this.reporters = [];
  }

  init() {
    assert(!this.loaded, 'Plugin was already initialized.');

    this.loaded = true;
    if (this.isWalletNode)
      this.wallet = this.node;

    if (this.isNode && this.node.get('walletdb'))
      this.wallet = this.node.get('walletdb');

    if (this.node && this.logNode) {
      this.nodeLogger = new ResponseLogger({
        name: this.config.str('weblog-node-logname', 'node-http'),
        node: this.node,
        config: this.config
      });

      this.loggers.push(this.nodeLogger);
    }

    if (this.wallet && this.logWallet) {
      this.walletLogger = new ResponseLogger({
        node: this.wallet,
        config: this.config,
        name: this.config.str('weblog-wallet-logname', 'wallet-http')
      });

      this.loggers.push(this.walletLogger);
    }

    if (this.console)
      this.reporters.push(ConsoleReporter);

    if (this.file)
      this.reporters.push(FileReporter);
  }

  async open() {
    if (this.memory)
      return;

    // Do this on open to make sure wdb has been loaded.
    this.init();

    for (const logger of this.loggers)
      logger.init();

    for (const reporter of this.reporters)
      await this.register(reporter, true);
  }

  async close() {
    if (this.memory)
      return;
  }

  /**
   * Register reporter
   * @param {AbstractReporter} Reporter
   * @param {Boolean} [enable = false]
   * @returns {Promise}
   */

  async register(Reporter, enable = false) {
    const registers = [];

    for (const logger of this.loggers)
      registers.push(logger.register(Reporter, enable));

    await Promise.all(registers);
  }

  /**
   * Unregister reporter
   * @param {AbstractReporter}
   */

  async unregister(Reporter, enable) {
    const unregisters = [];

    for (const logger of this.loggers)
      unregisters.push(logger.unregister(Reporter, enable));

    await Promise.all(unregisters);
  }

  static init(node) {
    return new Plugin(node);
  }

  static id = 'weblog';
}

module.exports = Plugin;
