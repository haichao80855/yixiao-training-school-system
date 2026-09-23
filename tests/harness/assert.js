/**
 * 盛通教育「一校教培系统」E2E 测试断言工具库
 * 基于 Node.js 原生 assert，提供零外部依赖的强类型/结构化断言支持
 */

const assert = require('node:assert');

class TestAssert {
  static ok(value, message) {
    assert.ok(value, message || `Expected truthy value but got ${JSON.stringify(value)}`);
  }

  static isTrue(value, message) {
    assert.strictEqual(value, true, message || `Expected true but got ${JSON.stringify(value)}`);
  }

  static isFalse(value, message) {
    assert.strictEqual(value, false, message || `Expected false but got ${JSON.stringify(value)}`);
  }

  static equal(actual, expected, message) {
    assert.strictEqual(
      actual,
      expected,
      message || `Expected ${JSON.stringify(expected)} but got ${JSON.stringify(actual)}`
    );
  }

  static notEqual(actual, expected, message) {
    assert.notStrictEqual(
      actual,
      expected,
      message || `Expected actual not to strictly equal ${JSON.stringify(expected)}`
    );
  }

  static deepEqual(actual, expected, message) {
    assert.deepStrictEqual(
      actual,
      expected,
      message || `Deep equality mismatch:\nActual:   ${JSON.stringify(actual)}\nExpected: ${JSON.stringify(expected)}`
    );
  }

  static closeTo(actual, expected, delta = 0.001, message) {
    const diff = Math.abs(actual - expected);
    assert.ok(
      diff <= delta,
      message || `Expected ${actual} to be close to ${expected} within delta ${delta}, diff was ${diff}`
    );
  }

  static includes(haystack, needle, message) {
    if (typeof haystack === 'string') {
      assert.ok(
        haystack.includes(needle),
        message || `Expected string "${haystack}" to include "${needle}"`
      );
    } else if (Array.isArray(haystack)) {
      assert.ok(
        haystack.includes(needle),
        message || `Expected array to include element ${JSON.stringify(needle)}`
      );
    } else {
      throw new Error(`includes assertion requires string or array, got ${typeof haystack}`);
    }
  }

  static match(string, regex, message) {
    assert.match(string, regex, message || `Expected "${string}" to match regex ${regex}`);
  }

  static throws(fn, errorMatcher, message) {
    assert.throws(fn, errorMatcher, message);
  }

  static doesNotThrow(fn, message) {
    assert.doesNotThrow(fn, message);
  }

  static lengthOf(collection, length, message) {
    assert.strictEqual(
      collection ? collection.length : 0,
      length,
      message || `Expected length to be ${length} but got ${collection ? collection.length : 0}`
    );
  }

  static hasProperty(object, prop, message) {
    assert.ok(
      Object.prototype.hasOwnProperty.call(object || {}, prop),
      message || `Expected object to have property "${prop}"`
    );
  }
}

module.exports = TestAssert;
