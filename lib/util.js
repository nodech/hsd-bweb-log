/*!
 * util.js - utils for hsd-bweb-log
 * Copyright (c) 2023, Nodari Chkuaselidze (MIT License)
 * https://github.com/nodech/hsd-bweb-log
 */

'use strict';

const util = exports;

const ns = 1n;
const us = 1000n * ns;
const ms = 1000n * us;
const s = 1000n * ms;

/**
 * @enum {BigInt}
 */

const TIME_TYPE = {
  ns,
  us,
  ms,
  s
};

/**
 * Format time (divisions with factor of 10)
 * @param {BigInt} time
 * @param {TIME_TYPE} [type = 's']
 * @param {Number} [prec = 3]
 * @returns {String}
 */

util.formatTime = (time, type = 's', prec = 2) => {
  const t = TIME_TYPE[type];

  const precExp = 10n ** BigInt(prec);
  const precLeft = t > precExp ? t / precExp : 1n;

  if (time > t) {
    const nt = time / t;
    const left = (time - (nt * t)) / precLeft;

    if (!left)
      return `${nt}${type}`;

    return `${nt}.${left.toString().padStart(prec, '0')}${type}`;
  }

  const left = time / precLeft;

  return '0.' + left.toString().padStart(prec, '0') + type;
};

/**
 * Get current time in unix time (seconds).
 * @returns {Number}
 */

util.now = function now() {
  return Math.floor(Date.now() / 1000);
};
