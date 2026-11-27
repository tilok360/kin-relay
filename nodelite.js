// "Node-lite": just enough of Node.js for Kin Relay's own library files and for a Kindroid app's main.js to run inside a
// browser page or Web Worker (the phone and web versions of Kin Relay). It is not Node: only the handful of modules those
// programs use exist (buffer, path, crypto, fs in memory, os, events, stream, child_process, zlib). Anything else
// answers "not available here" instead of pretending.
(function (root) {
  "use strict";
  const te = new TextEncoder(), td = new TextDecoder("utf-8");

  // ---------- Buffer ----------
  const B64 = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
  function b64encode(u8, url) {
    let s = ""; const n = u8.length;
    for (let i = 0; i < n; i += 3) {
      const a = u8[i], b = i + 1 < n ? u8[i + 1] : 0, c = i + 2 < n ? u8[i + 2] : 0;
      s += B64[a >> 2] + B64[((a & 3) << 4) | (b >> 4)] + (i + 1 < n ? B64[((b & 15) << 2) | (c >> 6)] : "=") + (i + 2 < n ? B64[c & 63] : "=");
    }
    return url ? s.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "") : s;
  }
  function b64decode(str) {
    str = String(str).replace(/-/g, "+").replace(/_/g, "/").replace(/[^A-Za-z0-9+/]/g, "");
    const out = new Uint8Array(Math.floor(str.length * 3 / 4)); let o = 0, buf = 0, bits = 0;
    for (let i = 0; i < str.length; i++) { buf = (buf << 6) | B64.indexOf(str[i]); bits += 6; if (bits >= 8) { bits -= 8; out[o++] = (buf >> bits) & 255; } }
    return out.subarray(0, o);
  }
  class Buffer extends Uint8Array {
    static from(v, enc) {
      if (typeof v === "string") {
        enc = String(enc || "utf8").toLowerCase();
        let u;
        if (enc === "hex") { u = new Uint8Array(v.length >> 1); for (let i = 0; i < u.length; i++) u[i] = parseInt(v.substr(i * 2, 2), 16); }
        else if (enc === "base64" || enc === "base64url") u = b64decode(v);
        else if (enc === "latin1" || enc === "binary" || enc === "ascii") { u = new Uint8Array(v.length); for (let i = 0; i < v.length; i++) u[i] = v.charCodeAt(i) & 255; }
        else u = te.encode(v);
        const b = new Buffer(u.length); b.set(u); return b;
      }
      if (v instanceof ArrayBuffer) { const b = new Buffer(v.byteLength); b.set(new Uint8Array(v)); return b; }
      if (ArrayBuffer.isView(v) || Array.isArray(v)) { const b = new Buffer(v.length); b.set(v); return b; }
      throw new TypeError("Buffer.from: unsupported input");
    }
    static alloc(n, fill) { const b = new Buffer(n); if (fill) b.fill(fill); return b; }
    static isBuffer(x) { return x instanceof Buffer; }
    static byteLength(s) { return typeof s === "string" ? te.encode(s).length : s.byteLength; }
    static concat(list, total) { total = total == null ? list.reduce((n, x) => n + x.length, 0) : total; const b = new Buffer(total); let o = 0; for (const x of list) { b.set(x.subarray(0, Math.max(0, total - o)), o); o += x.length; if (o >= total) break; } return b; }
    toString(enc, a, b) {
      const u = this.subarray(a || 0, b == null ? this.length : b); enc = String(enc || "utf8").toLowerCase();
      if (enc === "hex") { let s = ""; for (let i = 0; i < u.length; i++) s += (u[i] < 16 ? "0" : "") + u[i].toString(16); return s; }
      if (enc === "base64") return b64encode(u); if (enc === "base64url") return b64encode(u, true);
      if (enc === "latin1" || enc === "binary" || enc === "ascii") { let s = ""; for (let i = 0; i < u.length; i++) s += String.fromCharCode(u[i]); return s; }
      return td.decode(u);
    }
    toJSON() { return { type: "Buffer", data: Array.from(this) }; }
    readUInt16LE(o) { return this[o] | (this[o + 1] << 8); }
    readUInt32LE(o) { return (this[o] | (this[o + 1] << 8) | (this[o + 2] << 16) | (this[o + 3] * 0x1000000)) >>> 0; }
    readUInt8(o) { return this[o]; }
    equals(o) { if (this.length !== o.length) return false; for (let i = 0; i < this.length; i++) if (this[i] !== o[i]) return false; return true; }
    slice(a, b) { return this.subarray(a, b); }
    write(s, o) { const u = te.encode(s); this.set(u, o || 0); return u.length; }
  }

  // ---------- path (posix) ----------
  const norm = (p) => { const abs = p.startsWith("/"), out = []; for (const s of p.split("/")) { if (!s || s === ".") continue; if (s === "..") { if (out.length && out[out.length - 1] !== "..") out.pop(); else if (!abs) out.push(".."); } else out.push(s); } return (abs ? "/" : "") + out.join("/") || (abs ? "/" : "."); };
  const path = {
    sep: "/", delimiter: ":",
    normalize: norm,
    join: (...a) => norm(a.filter(Boolean).join("/")),
    resolve: (...a) => { let r = ""; for (let i = a.length - 1; i >= 0 && !r.startsWith("/"); i--) if (a[i]) r = a[i] + (r ? "/" + r : ""); if (!r.startsWith("/")) r = "/" + r; return norm(r); },
    dirname: (p) => { p = String(p).replace(/\/+$/, ""); const i = p.lastIndexOf("/"); return i < 0 ? "." : i === 0 ? "/" : p.slice(0, i); },
    basename: (p, ext) => { let b = String(p).replace(/\/+$/, ""); b = b.slice(b.lastIndexOf("/") + 1); return ext && b.endsWith(ext) ? b.slice(0, -ext.length) : b; },
    extname: (p) => { const b = path.basename(p), i = b.lastIndexOf("."); return i <= 0 ? "" : b.slice(i); },
    isAbsolute: (p) => String(p).startsWith("/"),
    relative: (a, b) => { const x = path.resolve(a).split("/").filter(Boolean), y = path.resolve(b).split("/").filter(Boolean); let i = 0; while (i < x.length && i < y.length && x[i] === y[i]) i++; return [...x.slice(i).map(() => ".."), ...y.slice(i)].join("/"); },
  };
  path.posix = path;

  // ---------- sha-256 and hmac (synchronous) ----------
  const K256 = new Uint32Array([0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5, 0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174, 0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da, 0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967, 0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85, 0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070, 0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3, 0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2]);
  function sha256(data) {
    const H = new Uint32Array([0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19]);
    const len = data.length, padded = new Uint8Array(((len + 9 + 63) >> 6) << 6); padded.set(data); padded[len] = 0x80;
    const dv = new DataView(padded.buffer); dv.setUint32(padded.length - 8, Math.floor(len / 0x20000000)); dv.setUint32(padded.length - 4, (len << 3) >>> 0);
    const w = new Uint32Array(64);
    for (let o = 0; o < padded.length; o += 64) {
      for (let i = 0; i < 16; i++) w[i] = dv.getUint32(o + i * 4);
      for (let i = 16; i < 64; i++) { const a = w[i - 15], b = w[i - 2]; w[i] = (w[i - 16] + (((a >>> 7) | (a << 25)) ^ ((a >>> 18) | (a << 14)) ^ (a >>> 3)) + w[i - 7] + (((b >>> 17) | (b << 15)) ^ ((b >>> 19) | (b << 13)) ^ (b >>> 10))) >>> 0; }
      let [a, b, c, d, e, f, g, h] = H;
      for (let i = 0; i < 64; i++) {
        const t1 = (h + (((e >>> 6) | (e << 26)) ^ ((e >>> 11) | (e << 21)) ^ ((e >>> 25) | (e << 7))) + ((e & f) ^ (~e & g)) + K256[i] + w[i]) >>> 0;
        const t2 = ((((a >>> 2) | (a << 30)) ^ ((a >>> 13) | (a << 19)) ^ ((a >>> 22) | (a << 10))) + ((a & b) ^ (a & c) ^ (b & c))) >>> 0;
        h = g; g = f; f = e; e = (d + t1) >>> 0; d = c; c = b; b = a; a = (t1 + t2) >>> 0;
      }
      H[0] += a; H[1] += b; H[2] += c; H[3] += d; H[4] += e; H[5] += f; H[6] += g; H[7] += h;
    }
    const out = new Buffer(32); const odv = new DataView(out.buffer, out.byteOffset, 32); for (let i = 0; i < 8; i++) odv.setUint32(i * 4, H[i]); return out;
  }
  function hmac(key, data) {
    if (key.length > 64) key = sha256(key);
    const k = new Uint8Array(64); k.set(key);
    const ip = new Uint8Array(64 + data.length), op = new Uint8Array(96);
    for (let i = 0; i < 64; i++) { ip[i] = k[i] ^ 0x36; op[i] = k[i] ^ 0x5c; }
    ip.set(data, 64); op.set(sha256(ip), 64); return sha256(op);
  }
  const bytes = (d, enc) => (typeof d === "string" ? Buffer.from(d, enc) : d);
  class Hasher { constructor(fn) { this.fn = fn; this.parts = []; } update(d, enc) { this.parts.push(bytes(d, enc)); return this; } digest(enc) { const r = this.fn(Buffer.concat(this.parts)); return enc ? r.toString(enc) : r; } }
  const webcrypto = root.crypto;
  const rnd = (n) => { const b = new Buffer(n); for (let o = 0; o < n; o += 65536) webcrypto.getRandomValues(b.subarray(o, Math.min(n, o + 65536))); return b; };
  const crypto = {
    webcrypto,
    getRandomValues: (a) => webcrypto.getRandomValues(a),
    randomBytes: (n) => rnd(n),
    randomInt: (a, b) => { let min = 0, max = a; if (b !== undefined && typeof b !== "function") { min = a; max = b; } const range = max - min; const lim = Math.floor(0x100000000 / range) * range; const u = new Uint32Array(1); do webcrypto.getRandomValues(u); while (u[0] >= lim); return min + (u[0] % range); },
    randomUUID: () => webcrypto.randomUUID(),
    createHash: (alg) => { if (String(alg).toLowerCase() !== "sha256") throw new Error("Only sha256 is available here."); return new Hasher(sha256); },
    createHmac: (alg, key) => { if (String(alg).toLowerCase() !== "sha256") throw new Error("Only sha256 is available here."); const k = bytes(key); return new Hasher((d) => hmac(k, d)); },
    timingSafeEqual: (a, b) => { if (a.length !== b.length) throw new RangeError("Input buffers must have the same byte length"); let x = 0; for (let i = 0; i < a.length; i++) x |= a[i] ^ b[i]; return x === 0; },
  };

  // ---------- events and streams ----------
  class EventEmitter {
    constructor() { this._ev = {}; }
    on(n, f) { (this._ev[n] = this._ev[n] || []).push(f); return this; }
    addListener(n, f) { return this.on(n, f); }
    prependListener(n, f) { (this._ev[n] = this._ev[n] || []).unshift(f); return this; }
    once(n, f) { const w = (...a) => { this.off(n, w); f.apply(this, a); }; w.f = f; return this.on(n, w); }
    off(n, f) { const l = this._ev[n]; if (l) this._ev[n] = l.filter((x) => x !== f && x.f !== f); return this; }
    removeListener(n, f) { return this.off(n, f); }
    removeAllListeners(n) { if (n) delete this._ev[n]; else this._ev = {}; return this; }
    emit(n, ...a) { const l = this._ev[n]; if (!l || !l.length) { if (n === "error") throw a[0]; return false; } for (const f of l.slice()) f.apply(this, a); return true; }
    listenerCount(n) { return (this._ev[n] || []).length; }
    listeners(n) { return (this._ev[n] || []).slice(); }
    setMaxListeners() { return this; }
  }
  const asBuf = (c) => (typeof c === "string" ? Buffer.from(c) : Buffer.from(c));
  class Readable extends EventEmitter {
    constructor() { super(); this._enc = null; this.readable = true; }
    setEncoding(e) { this._enc = e; return this; }
    push(c) { if (c == null) { this.emit("end"); this.emit("close"); return false; } this.emit("data", this._enc || typeof c === "string" ? (typeof c === "string" ? c : asBuf(c).toString(this._enc)) : asBuf(c)); return true; }
    pipe(dest) { this.on("data", (c) => dest.write(c)); this.on("end", () => dest.end && dest.end()); return dest; }
    resume() { return this; } pause() { return this; } destroy() { return this; }
  }
  class PassThrough extends Readable {
    write(c, enc, cb) { if (typeof enc === "function") cb = enc; this.push(c); if (cb) cb(); return true; }
    end(c) { if (c != null) this.push(c); if (!this._ended) { this._ended = true; this.push(null); } return this; }
  }
  class Writable extends EventEmitter {
    constructor(o) { super(); this._w = o && o.write; this._f = o && o.final; }
    write(c, enc, cb) { if (typeof enc === "function") cb = enc; const done = () => { if (cb) cb(); }; if (this._w) this._w.call(this, c, enc || "utf8", done); else done(); return true; }
    end(c) { if (c != null) this.write(c); const fin = () => { this.emit("finish"); this.emit("close"); }; if (this._f) this._f.call(this, fin); else fin(); return this; }
  }
  const stream = { Readable, PassThrough, Writable, Transform: PassThrough, Duplex: PassThrough, Stream: Readable };

  // ---------- zlib: a small inflate, so .gz and .zip files open without any library ----------
  function inflate(src, start, maxOut) {
    let pos = start, bitBuf = 0, bitCnt = 0, out = new Uint8Array(Math.max(1024, src.length * 4)), o = 0;
    const need = (n) => { if (o + n > out.length) { if (o + n > maxOut) throw new Error("maxOutputLength"); const bigger = new Uint8Array(Math.min(maxOut + 1, Math.max(out.length * 2, o + n))); bigger.set(out); out = bigger; } };
    const bits = (n) => { while (bitCnt < n) { if (pos >= src.length) throw new Error("unexpected end"); bitBuf |= src[pos++] << bitCnt; bitCnt += 8; } const v = bitBuf & ((1 << n) - 1); bitBuf >>>= n; bitCnt -= n; return v; };
    const build = (lengths) => { const count = new Uint16Array(16), offs = new Uint16Array(16), sym = new Uint16Array(lengths.length); for (const l of lengths) count[l]++; count[0] = 0; for (let i = 1; i < 16; i++) offs[i] = offs[i - 1] + count[i - 1]; for (let i = 0; i < lengths.length; i++) if (lengths[i]) sym[offs[lengths[i]]++] = i; return { count, sym }; };
    const decode = (h) => { let code = 0, first = 0, index = 0; for (let len = 1; len < 16; len++) { code |= bits(1); const c = h.count[len]; if (code - c < first) return h.sym[index + (code - first)]; index += c; first += c; first <<= 1; code <<= 1; } throw new Error("bad code"); };
    const LB = [3, 4, 5, 6, 7, 8, 9, 10, 11, 13, 15, 17, 19, 23, 27, 31, 35, 43, 51, 59, 67, 83, 99, 115, 131, 163, 195, 227, 258], LE = [0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 2, 2, 2, 2, 3, 3, 3, 3, 4, 4, 4, 4, 5, 5, 5, 5, 0];
    const DB = [1, 2, 3, 4, 5, 7, 9, 13, 17, 25, 33, 49, 65, 97, 129, 193, 257, 385, 513, 769, 1025, 1537, 2049, 3073, 4097, 6145, 8193, 12289, 16385, 24577], DE = [0, 0, 0, 0, 1, 1, 2, 2, 3, 3, 4, 4, 5, 5, 6, 6, 7, 7, 8, 8, 9, 9, 10, 10, 11, 11, 12, 12, 13, 13];
    let fixedL = null, fixedD = null;
    for (let last = 0; !last;) {
      last = bits(1); const type = bits(2);
      if (type === 0) {
        bitBuf = 0; bitCnt = 0; if (pos + 4 > src.length) throw new Error("unexpected end");
        const len = src[pos] | (src[pos + 1] << 8); pos += 4; need(len); out.set(src.subarray(pos, pos + len), o); o += len; pos += len;
      } else if (type === 1 || type === 2) {
        let lh, dh;
        if (type === 1) {
          if (!fixedL) { const l = new Uint8Array(288); l.fill(8, 0, 144); l.fill(9, 144, 256); l.fill(7, 256, 280); l.fill(8, 280, 288); fixedL = build(l); fixedD = build(new Uint8Array(30).fill(5)); }
          lh = fixedL; dh = fixedD;
        } else {
          const nl = bits(5) + 257, nd = bits(5) + 1, nc = bits(4) + 4, ord = [16, 17, 18, 0, 8, 7, 9, 6, 10, 5, 11, 4, 12, 3, 13, 2, 14, 1, 15], cl = new Uint8Array(19);
          for (let i = 0; i < nc; i++) cl[ord[i]] = bits(3);
          const ch = build(cl), lens = new Uint8Array(nl + nd);
          for (let i = 0; i < nl + nd;) { const s = decode(ch); if (s < 16) lens[i++] = s; else { let prev = 0, rep; if (s === 16) { prev = lens[i - 1]; rep = 3 + bits(2); } else if (s === 17) rep = 3 + bits(3); else rep = 11 + bits(7); while (rep--) lens[i++] = prev; } }
          lh = build(lens.subarray(0, nl)); dh = build(lens.subarray(nl));
        }
        for (;;) {
          const s = decode(lh);
          if (s < 256) { need(1); out[o++] = s; }
          else if (s === 256) break;
          else { const li = s - 257, len = LB[li] + bits(LE[li]), di = decode(dh), dist = DB[di] + bits(DE[di]); if (dist > o) throw new Error("bad distance"); need(len); for (let i = 0; i < len; i++) { out[o] = out[o - dist]; o++; } }
        }
      } else throw new Error("bad block");
    }
    return { data: out.subarray(0, o), end: pos };
  }
  const zlib = {
    inflateRawSync: (buf, opt) => Buffer.from(inflate(buf, 0, (opt && opt.maxOutputLength) || 1 << 30).data),
    gunzipSync: (buf, opt) => {
      if (buf[0] !== 0x1f || buf[1] !== 0x8b) throw new Error("not gzip");
      const flg = buf[3]; let p = 10;
      if (flg & 4) p += 2 + (buf[p] | (buf[p + 1] << 8));
      if (flg & 8) { while (buf[p++]); } if (flg & 16) { while (buf[p++]); } if (flg & 2) p += 2;
      return Buffer.from(inflate(buf, p, (opt && opt.maxOutputLength) || 1 << 30).data);
    },
  };

  // ---------- fs, in memory ----------
  function enoent(p, op) { const e = new Error(`ENOENT: no such file or directory, ${op} '${p}'`); e.code = "ENOENT"; return e; }
  class VFS {
    constructor() { this.files = new Map(); this.onWrite = null; this.onRemove = null; this.stdin = ""; }
    put(p, data) { this.files.set(path.resolve(p), data instanceof Buffer ? data : Buffer.from(data)); }
    api() {
      const self = this, abs = (p) => path.resolve(String(p));
      const encOf = (o) => (typeof o === "string" ? o : o && o.encoding) || null;
      const fs = {
        readFileSync(p, o) {
          if (p === 0 || p === "/dev/stdin") { const b = Buffer.from(self.stdin); return encOf(o) ? b.toString(encOf(o)) : b; }
          const b = self.files.get(abs(p)); if (!b) throw enoent(p, "open");
          return encOf(o) ? b.toString(encOf(o)) : Buffer.from(b);
        },
        writeFileSync(p, d, o) { const f = abs(p), b = typeof d === "string" ? Buffer.from(d, encOf(o) || "utf8") : Buffer.from(d); self.files.set(f, b); if (self.onWrite) self.onWrite(f, b); },
        appendFileSync(p, d, o) { const f = abs(p), old = self.files.get(f) || Buffer.alloc(0), b = Buffer.concat([old, typeof d === "string" ? Buffer.from(d, encOf(o) || "utf8") : Buffer.from(d)]); self.files.set(f, b); if (self.onWrite) self.onWrite(f, b); },
        existsSync(p) { const f = abs(p); if (self.files.has(f)) return true; const pre = f === "/" ? "/" : f + "/"; for (const k of self.files.keys()) if (k.startsWith(pre)) return true; return false; },
        mkdirSync() { return undefined; },
        accessSync(p) { if (!fs.existsSync(p)) throw enoent(p, "access"); },
        statSync(p) { const f = abs(p), b = self.files.get(f); if (b) return { isFile: () => true, isDirectory: () => false, size: b.length, mtimeMs: Date.now(), mtime: new Date() }; if (fs.existsSync(p)) return { isFile: () => false, isDirectory: () => true, size: 0, mtimeMs: Date.now(), mtime: new Date() }; throw enoent(p, "stat"); },
        readdirSync(p, o) {
          const f = abs(p), pre = f === "/" ? "/" : f + "/", names = new Map();
          for (const k of self.files.keys()) if (k.startsWith(pre)) { const rest = k.slice(pre.length), i = rest.indexOf("/"); names.set(i < 0 ? rest : rest.slice(0, i), i >= 0); }
          if (!names.size && !self.files.has(f) && f !== "/") throw enoent(p, "scandir");
          const list = [...names.keys()].sort();
          return o && o.withFileTypes ? list.map((n) => ({ name: n, isDirectory: () => names.get(n), isFile: () => !names.get(n) })) : list;
        },
        unlinkSync(p) { const f = abs(p); if (!self.files.delete(f)) throw enoent(p, "unlink"); if (self.onRemove) self.onRemove(f); },
        renameSync(a, b) {
          const x = abs(a), y = abs(b), d = self.files.get(x);
          if (!d) { // a folder: everything under it moves
            const pre = x + "/", moved = [...self.files.keys()].filter((k) => k.startsWith(pre)); if (!moved.length) throw enoent(a, "rename");
            for (const k of moved) { const v = self.files.get(k); self.files.delete(k); self.files.set(y + "/" + k.slice(pre.length), v); }
            return;
          }
          self.files.delete(x); self.files.set(y, d); if (self.onRemove) self.onRemove(x); if (self.onWrite) self.onWrite(y, d);
        },
        copyFileSync(a, b) { const d = self.files.get(abs(a)); if (!d) throw enoent(a, "copyfile"); fs.writeFileSync(b, d); },
        rmSync(p, o) { const f = abs(p), pre = f + "/"; let any = false; for (const k of [...self.files.keys()]) if (k === f || (o && o.recursive && k.startsWith(pre))) { self.files.delete(k); any = true; if (self.onRemove) self.onRemove(k); } if (!any && !(o && o.force)) throw enoent(p, "rm"); },
        rmdirSync() {}, chmodSync() {}, utimesSync() {},
      };
      fs.promises = {};
      for (const n of ["readFile", "writeFile", "appendFile", "unlink", "rename", "rm", "mkdir", "readdir", "stat", "copyFile", "access"]) fs.promises[n] = async (...a) => fs[n + "Sync"](...a);
      fs.constants = { F_OK: 0, R_OK: 4, W_OK: 2 };
      // callback style, for the few apps that use it
      for (const n of ["readFile", "writeFile", "appendFile", "unlink", "rename", "rm", "mkdir", "readdir", "stat", "access"]) fs[n] = (...a) => { const cb = a.pop(); try { const r = fs[n + "Sync"](...a); Promise.resolve().then(() => cb(null, r)); } catch (e) { Promise.resolve().then(() => cb(e)); } };
      return fs;
    }
  }

  // ---------- the rest of the small modules ----------
  const os = { tmpdir: () => "/tmp", homedir: () => "/home", platform: () => "linux", EOL: "\n", hostname: () => "kin-relay", cpus: () => [], type: () => "Linux", arch: () => "x64", release: () => "", totalmem: () => 1e9, freemem: () => 5e8, networkInterfaces: () => ({}) };
  function noProgram(file) { const e = new Error(`spawn ${file} ENOENT`); e.code = "ENOENT"; return e; }
  const child_process = {
    spawn(file) { const c = new EventEmitter(); c.stdout = new PassThrough(); c.stderr = new PassThrough(); c.stdin = new Writable(); c.kill = () => true; setTimeout(() => c.emit("error", noProgram(file)), 0); return c; },
    spawnSync(file) { return { pid: 0, status: null, signal: null, stdout: Buffer.alloc(0), stderr: Buffer.alloc(0), error: noProgram(file) }; },
    execFile(file, a, o, cb) { cb = [a, o, cb].find((x) => typeof x === "function"); setTimeout(() => cb && cb(noProgram(file), "", ""), 0); const c = new EventEmitter(); c.kill = () => true; return c; },
    execFileSync(file) { throw noProgram(file); },
    exec(cmd, o, cb) { cb = typeof o === "function" ? o : cb; setTimeout(() => cb && cb(noProgram(String(cmd).split(" ")[0]), "", ""), 0); const c = new EventEmitter(); c.kill = () => true; return c; },
    execSync(cmd) { throw noProgram(String(cmd).split(" ")[0]); },
  };
  const worker_threads = { isMainThread: true, get Worker() { throw new Error("A synchronous Kin ask isn't available in the phone and web versions (the program has to wait for the answer). Use the Windows or Mac app for this game, or play its screen here."); }, MessageChannel: root.MessageChannel, receiveMessageOnPort() { return undefined; } };

  // ---------- a small CommonJS loader ----------
  // modules: { "<absolute path>": source text }; builtins: name -> exports. process/Buffer are handed to each module.
  function loader({ sources, builtins, process, globals }) {
    const cache = new Map();
    const resolveFile = (from, req) => {
      const base = path.resolve(path.dirname(from), req), tries = [base, base + ".js", base + ".json", base + "/index.js"];
      for (const t of tries) if (sources[t] != null) return t;
      return null;
    };
    function make(file) {
      const req = (name) => {
        name = String(name).replace(/^node:/, "");
        if (name.startsWith("./") || name.startsWith("../") || name.startsWith("/")) {
          const f = resolveFile(file, name); if (!f) { const e = new Error(`Cannot find module '${name}'`); e.code = "MODULE_NOT_FOUND"; throw e; }
          return load(f);
        }
        if (builtins[name]) return typeof builtins[name] === "function" && !builtins[name].prototype ? builtins[name]() : builtins[name];
        const e = new Error(`Cannot find module '${name}'. Only built-in modules Kin Relay knows are available here.`); e.code = "MODULE_NOT_FOUND"; throw e;
      };
      req.resolve = (n) => resolveFile(file, n) || n;
      return req;
    }
    function load(file) {
      if (cache.has(file)) return cache.get(file).exports;
      const module = { exports: {}, id: file, filename: file }; cache.set(file, module);
      if (file.endsWith(".json")) { module.exports = JSON.parse(sources[file]); return module.exports; }
      const src = String(sources[file]).replace(/^#!.*/, "");
      const names = ["exports", "require", "module", "__filename", "__dirname", "process", "Buffer", ...Object.keys(globals || {})];
      let fn; try { fn = new Function(...names, src + "\n//# sourceURL=kin-app:" + file); } catch (e) { e.message = `${file}: ${e.message}`; throw e; }
      fn.call(module.exports, module.exports, make(file), module, file, path.dirname(file), process, Buffer, ...Object.values(globals || {}));
      return module.exports;
    }
    return { load, require: (from, name) => make(from)(name) };
  }

  root.NodeLite = { Buffer, path, crypto, sha256, hmac, EventEmitter, stream, zlib, VFS, os, child_process, worker_threads, loader, b64encode, b64decode };
})(typeof globalThis !== "undefined" ? globalThis : self);
