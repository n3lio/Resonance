/**
 * Minimal QR Code generator (Mode Byte, ECC L, versions 1-10)
 * Generates a boolean matrix. Render with canvas.
 * Based on the QR spec — no external dependencies.
 */
var QR = (function() {
  var EXP = new Array(256), LOG = new Array(256);
  (function() {
    var x = 1;
    for (var i = 0; i < 255; i++) { EXP[i] = x; LOG[x] = i; x <<= 1; if (x & 256) x ^= 0x11d; }
    EXP[255] = EXP[0];
  })();

  function gfMul(a, b) { return a === 0 || b === 0 ? 0 : EXP[(LOG[a] + LOG[b]) % 255]; }

  function polyMul(p, q) {
    var r = new Array(p.length + q.length - 1).fill(0);
    for (var i = 0; i < p.length; i++)
      for (var j = 0; j < q.length; j++)
        r[i + j] ^= gfMul(p[i], q[j]);
    return r;
  }

  function eccPoly(n) {
    var p = [1];
    for (var i = 0; i < n; i++) p = polyMul(p, [1, EXP[i]]);
    return p;
  }

  function computeECC(data, eccLen) {
    var gen = eccPoly(eccLen);
    var msg = data.concat(new Array(eccLen).fill(0));
    for (var i = 0; i < data.length; i++) {
      var coeff = msg[i];
      if (coeff !== 0) {
        for (var j = 0; j < gen.length; j++) msg[i + j] ^= gfMul(gen[j], coeff);
      }
    }
    return msg.slice(data.length);
  }

  var VERSIONS = [
    null,
    [26,7,1],[44,10,1],[70,15,1],[100,20,1],[134,26,1],
    [172,18,2],[196,20,2],[242,24,2],[292,30,2],[346,18,2],
  ];

  function getVersion(dataLen) {
    for (var v = 1; v <= 10; v++) {
      var info = VERSIONS[v];
      var dataCodewords = info[0] - info[1] * info[2];
      if (dataLen <= dataCodewords) return v;
    }
    return 10;
  }

  function encode(text) {
    var data = [];
    for (var i = 0; i < text.length; i++) data.push(text.charCodeAt(i) & 0xff);

    var version = getVersion(data.length + 3);
    var info = VERSIONS[version];
    var totalCW = info[0], eccCW = info[1], numBlocks = info[2];
    var dataCW = totalCW - eccCW * numBlocks;

    var bits = [];
    function pushBits(val, len) { for (var i = len - 1; i >= 0; i--) bits.push((val >> i) & 1); }
    pushBits(4, 4);
    pushBits(data.length, 8);
    for (var i = 0; i < data.length; i++) pushBits(data[i], 8);
    pushBits(0, Math.min(4, dataCW * 8 - bits.length));
    while (bits.length % 8) bits.push(0);
    var padBytes = [0xec, 0x11], pi = 0;
    while (bits.length < dataCW * 8) { pushBits(padBytes[pi % 2], 8); pi++; }

    var codewords = [];
    for (var i = 0; i < bits.length; i += 8)
      codewords.push((bits[i]<<7)|(bits[i+1]<<6)|(bits[i+2]<<5)|(bits[i+3]<<4)|(bits[i+4]<<3)|(bits[i+5]<<2)|(bits[i+6]<<1)|bits[i+7]);

    var blocks = [], eccBlocks = [];
    var offset = 0;
    var blockDataCW = Math.floor(dataCW / numBlocks);
    for (var b = 0; b < numBlocks; b++) {
      var bLen = blockDataCW + (b < dataCW % numBlocks ? 1 : 0);
      blocks.push(codewords.slice(offset, offset + bLen));
      offset += bLen;
    }
    for (var b = 0; b < numBlocks; b++) {
      eccBlocks.push(computeECC(blocks[b], eccCW));
    }

    var interleaved = [];
    var maxDataLen = blocks.reduce(function(m, bl) { return Math.max(m, bl.length); }, 0);
    for (var i = 0; i < maxDataLen; i++)
      for (var b = 0; b < numBlocks; b++)
        if (i < blocks[b].length) interleaved.push(blocks[b][i]);
    for (var i = 0; i < eccCW; i++)
      for (var b = 0; b < numBlocks; b++)
        interleaved.push(eccBlocks[b][i]);

    var size = version * 4 + 17;
    var matrix = [], reserved = [];
    for (var y = 0; y < size; y++) { matrix.push(new Array(size).fill(0)); reserved.push(new Array(size).fill(false)); }

    function setModule(x, y, val) { matrix[y][x] = val ? 1 : 0; reserved[y][x] = true; }

    function finderPattern(cx, cy) {
      for (var dy = -4; dy <= 4; dy++) for (var dx = -4; dx <= 4; dx++) {
        var x = cx + dx, y = cy + dy;
        if (x < 0 || x >= size || y < 0 || y >= size) continue;
        var dist = Math.max(Math.abs(dx), Math.abs(dy));
        setModule(x, y, dist !== 3 && dist !== 4 ? 1 : 0);
      }
    }
    finderPattern(3, 3); finderPattern(size - 4, 3); finderPattern(3, size - 4);

    for (var i = 8; i < size - 8; i++) {
      if (!reserved[6][i]) setModule(i, 6, i % 2 === 0);
      if (!reserved[i][6]) setModule(6, i, i % 2 === 0);
    }

    var formatBits = 0x77c4;
    for (var i = 0; i < 15; i++) {
      var bit = (formatBits >> (14 - i)) & 1;
      if (i < 6) setModule(i, 8, bit);
      else if (i < 8) setModule(i + 1, 8, bit);
      else if (i < 9) setModule(8, 7, bit);
      else setModule(8, 14 - i, bit);
      if (i < 8) setModule(8, size - 1 - i, bit);
      else setModule(size - 15 + i, 8, bit);
    }
    setModule(8, size - 8, 1);

    var bitStream = [];
    for (var i = 0; i < interleaved.length; i++)
      for (var b = 7; b >= 0; b--) bitStream.push((interleaved[i] >> b) & 1);

    var bitIdx = 0;
    for (var right = size - 1; right >= 1; right -= 2) {
      if (right === 6) right = 5;
      for (var vert = 0; vert < size; vert++) {
        for (var j = 0; j < 2; j++) {
          var x = right - j;
          var upward = ((right + 1) / 2 | 0) % 2 === (right > 6 ? 1 : 0);
          var y = upward ? size - 1 - vert : vert;
          if (reserved[y][x]) continue;
          var dataBit = bitIdx < bitStream.length ? bitStream[bitIdx] : 0;
          var mask = (y + x) % 2 === 0 ? 1 : 0;
          matrix[y][x] = dataBit ^ mask;
          bitIdx++;
        }
      }
    }

    return { matrix: matrix, size: size };
  }

  function toCanvas(container, text, cellSize) {
    cellSize = cellSize || 4;
    var qr = encode(text);
    var quiet = 4;
    var totalSize = (qr.size + quiet * 2) * cellSize;
    var canvas = document.createElement('canvas');
    canvas.width = totalSize;
    canvas.height = totalSize;
    var ctx = canvas.getContext('2d');
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, totalSize, totalSize);
    ctx.fillStyle = '#000000';
    for (var y = 0; y < qr.size; y++)
      for (var x = 0; x < qr.size; x++)
        if (qr.matrix[y][x])
          ctx.fillRect((x + quiet) * cellSize, (y + quiet) * cellSize, cellSize, cellSize);
    while (container.firstChild) container.removeChild(container.firstChild);
    container.appendChild(canvas);
  }

  return { encode: encode, toCanvas: toCanvas };
})();
