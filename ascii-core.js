/* ASCII Art Studio — núcleo sin DOM (se puede probar con Node).
   Intérprete de fuentes FIGlet (.flf), composición con kerning, acentos sintéticos,
   efectos, espejos, juegos de caracteres, transformaciones y color.
   © Un Fantasma en el Sistema · MIT */
(function (root) {
  'use strict';

  // ───────────────────────── FIGlet ─────────────────────────
  const DEUTSCH = [196, 214, 220, 228, 246, 252, 223]; // Ä Ö Ü ä ö ü ß, obligatorios tras el ASCII 32-126

  function parseFLF(text) {
    const lines = text.replace(/\r\n?/g, '\n').split('\n');
    const head = lines[0].split(/\s+/);
    if (!/^flf2./.test(head[0])) throw new Error('No es una fuente FIGlet');
    const hardblank = head[0].charAt(5);
    const height = parseInt(head[1], 10);
    const comments = parseInt(head[5], 10) || 0;
    const oldLayout = parseInt(head[4], 10);   // -1 = ancho completo; 0 o más = letras ajustadas
    const glyphs = new Map();
    let i = 1 + comments;
    const readGlyph = () => {
      const rows = [];
      for (let r = 0; r < height; r++) {
        let l = (lines[i++] || '').replace(/\s+$/, '');
        const end = l.charAt(l.length - 1);
        // La marca de fin (normalmente @) se repite al final de cada fila; @@ en la última
        while (l.length && l.charAt(l.length - 1) === end) l = l.slice(0, -1);
        rows.push(l);
      }
      const w = Math.max(...rows.map(r => [...r].length));
      return rows.map(r => r + ' '.repeat(w - [...r].length));
    };
    for (let c = 32; c <= 126; c++) glyphs.set(c, readGlyph());
    for (const c of DEUTSCH) { if (i >= lines.length - 1) break; glyphs.set(c, readGlyph()); }
    // Caracteres con etiqueta de código: «código  comentario» y a continuación el glifo
    while (i < lines.length) {
      const tag = (lines[i] || '').trim();
      if (!tag) { i++; continue; }
      const m = /^(-?0[xX][0-9a-fA-F]+|-?0[0-7]*|-?\d+)/.exec(tag);
      if (!m) { i++; continue; }
      i++;
      let s = m[1], neg = s.startsWith('-'); if (neg) s = s.slice(1);
      const code = /^0[xX]/.test(s) ? parseInt(s, 16) : (/^0\d/.test(s) ? parseInt(s, 8) : parseInt(s, 10));
      const g = readGlyph();
      if (!neg && code > 0) glyphs.set(code, g);
    }
    return { hardblank, height, glyphs, fullWidth: oldLayout === -1 };
  }

  // Marcas diacríticas que se pueden dibujar encima (o debajo) de una letra de la fuente
  const MARKS_ABOVE = { '́': '´', '̀': '`', '̂': '^', '̃': '~', '̈': '¨', '̊': '°', '̌': 'ˇ' };
  const MARKS_BELOW = { '̧': ',', '̨': ',' };

  const swapCase = ch => { const u = ch.toUpperCase(); return u !== ch ? u : ch.toLowerCase(); };

  // Devuelve {rows, above, below} o null si no hay forma de representarlo
  function glyphFor(font, ch) {
    const cp = ch.codePointAt(0);
    if (font.glyphs.has(cp)) return { rows: font.glyphs.get(cp) };
    const alt = swapCase(ch).codePointAt(0);
    if (alt !== cp && font.glyphs.has(alt)) return { rows: font.glyphs.get(alt) };
    const d = ch.normalize('NFD');
    if (d.length > 1) {
      const base = glyphFor(font, d[0]);
      if (base && !base.above && !base.below) {
        const marks = [...d.slice(1)];
        const above = marks.map(m => MARKS_ABOVE[m]).filter(Boolean).join('');
        const below = marks.map(m => MARKS_BELOW[m]).filter(Boolean).join('');
        if (above || below) return { rows: base.rows, above, below, synth: true };
      }
    }
    return null;
  }

  const isBlank = (c, hb) => c === ' ';
  // Une un glifo a la derecha de un bloque. mode: 'fit' (kerning hasta tocarse) o 'full'
  function appendGlyph(block, g, mode, extra) {
    const h = block.length;
    if (!h) return g.map(r => r);
    if (mode === 'full' || extra > 0) {
      const sp = ' '.repeat(Math.max(0, extra));
      return block.map((r, i) => r + sp + g[i]);
    }
    let amount = Infinity;
    for (let r = 0; r < h; r++) {
      const L = [...block[r]], G = [...g[r]];
      let t = 0; for (let k = L.length - 1; k >= 0 && isBlank(L[k]); k--) t++;
      let l = 0; for (let k = 0; k < G.length && isBlank(G[k]); k++) l++;
      amount = Math.min(amount, t + l);
    }
    if (!isFinite(amount)) amount = 0;
    return block.map((row, r) => {
      const L = [...row], G = [...g[r]];
      let t = 0; for (let k = L.length - 1; k >= 0 && isBlank(L[k]); k--) t++;
      const k1 = Math.min(t, amount), k2 = amount - k1;
      return L.slice(0, L.length - k1).join('') + G.slice(k2).join('');
    });
  }

  // Compone una línea de texto. Devuelve {rows, missing:Set}
  // spacing: 0 = lo que pide la fuente, 1 = letras juntas, 2 = ancho de la fuente, 3-4 = más separación
  function composeLine(text, font, opts) {
    const sp = opts.spacing || 0;
    const mode = sp === 1 || (sp === 0 && !font.fullWidth) ? 'fit' : 'full', extra = Math.max(0, sp - 2);
    const items = [], missing = new Set();
    for (const ch of text) {
      let g = glyphFor(font, ch);
      if (!g) { missing.add(ch); g = glyphFor(font, '?') || { rows: font.glyphs.get(32) }; }
      items.push(g);
    }
    const needAbove = items.some(g => g.above), needBelow = items.some(g => g.below);
    let block = [];
    for (const g of items) {
      let rows = g.rows.slice();
      const w = [...rows[0]].length;
      // Centro horizontal de la parte dibujada del glifo, para colocar el acento
      let lo = w, hi = -1;
      rows.forEach(r => [...r].forEach((c, k) => { if (c !== ' ' && c !== font.hardblank) { lo = Math.min(lo, k); hi = Math.max(hi, k); } }));
      const mid = hi < 0 ? Math.floor(w / 2) : Math.floor((lo + hi) / 2);
      const markRow = m => { const a = Array(w).fill(' '); [...(m || '')].forEach((c, k) => { const p = Math.min(w - 1, Math.max(0, mid + k)); a[p] = c; }); return a.join(''); };
      if (needAbove) rows.unshift(markRow(g.above));
      if (needBelow) rows.push(markRow(g.below));
      block = appendGlyph(block, rows, mode, extra);
    }
    const hb = font.hardblank;
    return { rows: block.map(r => r.split(hb).join(' ')), missing };
  }

  // Texto completo: respeta saltos de línea y parte por palabras si supera maxWidth columnas
  function renderFiglet(text, font, opts = {}) {
    const maxWidth = opts.maxWidth || Infinity, out = [], missing = new Set();
    const width = rows => rows.length ? Math.max(...rows.map(r => [...r].length)) : 0;
    text.split('\n').forEach((para, pi) => {
      if (pi > 0) out.push('');
      const words = para.split(/(\s+)/).filter(s => s.length);
      let line = '';
      const flush = () => {
        if (!line.trim() && !line) return;
        const c = composeLine(line.replace(/\s+$/, ''), font, opts);
        c.missing.forEach(m => missing.add(m)); out.push(...c.rows); line = '';
      };
      for (const w of words) {
        const candidate = line + w;
        if (line.trim() && !/^\s+$/.test(w) && width(composeLine(candidate, font, opts).rows) > maxWidth) {
          flush(); line = w;
        } else line = candidate;
      }
      if (line.trim()) flush();
      else if (!para.length) out.push(...Array(font.height).fill(''));
    });
    // Fuera las filas vacías de arriba y de abajo (algunas fuentes reservan filas para los descendentes)
    const res = trimRight(out);
    while (res.length && !res[0].trim()) res.shift();
    while (res.length && !res[res.length - 1].trim()) res.pop();
    return { lines: res, missing };
  }

  const trimRight = lines => lines.map(l => l.replace(/\s+$/, ''));
  const widthOf = lines => lines.reduce((m, l) => Math.max(m, [...l].length), 0);
  const toGrid = lines => { const w = widthOf(lines); return lines.map(l => { const a = [...l]; while (a.length < w) a.push(' '); return a; }); };
  const fromGrid = g => trimRight(g.map(r => r.join('')));

  // ───────────────────────── Espejos ─────────────────────────
  const pairs = (s) => { const m = {}; for (let i = 0; i < s.length; i += 2) { m[s[i]] = s[i + 1]; m[s[i + 1]] = s[i]; } return m; };
  const MIRROR_H = pairs('()[]{}<>/\\db' + 'qp' + '▌▐▖▗▘▝▛▜▙▟╔╗╚╝╠╣┌┐└┘├┤╭╮╰╯╒╕╘╛╓╖╙╜◢◣◤◥');
  const MIRROR_V = pairs('/\\▀▄▖▘▗▝▙▛▟▜╔╚╗╝╦╩┌└┐┘┬┴╭╰╮╯◢◥◣◤vʌ' + "_‾',");
  const mirrorH = lines => toGrid(lines).map(r => r.reverse().map(c => MIRROR_H[c] || c).join('')).map(l => l.replace(/\s+$/, ''));
  const mirrorV = lines => lines.slice().reverse().map(l => [...l].map(c => MIRROR_V[c] || c).join(''));

  // ───────────────────────── Efectos ─────────────────────────
  function mulberry(seed) { return () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
  function hash(s) { let h = 2166136261; for (const c of s) { h ^= c.codePointAt(0); h = Math.imul(h, 16777619); } return h >>> 0; }

  function layered(lines, offsets) { // offsets: [{dx,dy,ch}] dibujados de atrás hacia delante, y el original encima
    const g = toGrid(lines), h = g.length, w = h ? g[0].length : 0;
    const mx = Math.max(0, ...offsets.map(o => o.dx)), my = Math.max(0, ...offsets.map(o => o.dy));
    const out = Array.from({ length: h + my }, () => Array(w + mx).fill(' '));
    offsets.forEach(o => { for (let r = 0; r < h; r++) for (let c = 0; c < w; c++) if (g[r][c] !== ' ') out[r + o.dy][c + o.dx] = o.ch; });
    for (let r = 0; r < h; r++) for (let c = 0; c < w; c++) if (g[r][c] !== ' ') out[r][c] = g[r][c];
    return fromGrid(out);
  }
  const EFFECTS = {
    none: l => l,
    shadow: l => layered(l, [{ dx: 2, dy: 1, ch: '░' }]),
    '3d': l => layered(l, [{ dx: 3, dy: 3, ch: '░' }, { dx: 2, dy: 2, ch: '▒' }, { dx: 1, dy: 1, ch: '▓' }]),
    outline: l => {
      const g = toGrid(l), h = g.length + 2, w = (g[0] || []).length + 2;
      const at = (r, c) => r >= 1 && r <= g.length && c >= 1 && c <= w - 2 && g[r - 1][c - 1] !== ' ';
      const out = [];
      for (let r = 0; r < h; r++) { let row = ''; for (let c = 0; c < w; c++) {
        if (at(r, c)) { row += g[r - 1][c - 1]; continue; }
        let n = false; for (let dr = -1; dr <= 1 && !n; dr++) for (let dc = -1; dc <= 1; dc++) if ((dr || dc) && at(r + dr, c + dc)) { n = true; break; }
        row += n ? '+' : ' ';
      } out.push(row); }
      return trimRight(out);
    },
    mirror_h: l => { const g = toGrid(l).map(r => r.join('')), m = mirrorH(l); const w = widthOf(g); return trimRight(g.map((r, i) => r.padEnd(w) + '  ' + (m[i] || '').padStart(w))); },
    mirror_v: l => [...l, '', ...mirrorV(l)],
    wave: l => l.map((line, i) => ' '.repeat(Math.round((Math.sin(i * 0.6) + 1) * 2)) + line),
    glitch: (l, seed) => { const rnd = mulberry(seed), gl = '!@#$%^&*░▒▓|\\'; return l.map(line => {
      const a = [...line]; if (rnd() < 0.35 && a.length) { const n = 1 + Math.floor(rnd() * 3); for (let k = 0; k < n; k++) a[Math.floor(rnd() * a.length)] = gl[Math.floor(rnd() * gl.length)]; }
      return (rnd() < 0.2 ? ' '.repeat(1 + Math.floor(rnd() * 2)) : '') + a.join(''); }); },
    stagger: l => l.map((line, i) => ' '.repeat(i % 4) + line),
  };
  const invert = (lines, ch) => fromGrid(toGrid(lines).map(r => r.map(c => c === ' ' ? ch : ' ')));
  const bold = lines => lines.map(l => [...l].map(c => c + c).join(''));
  function border(lines) {
    const w = widthOf(lines);
    return ['╔' + '═'.repeat(w + 2) + '╗', ...lines.map(l => '║ ' + l + ' '.repeat(w - [...l].length) + ' ║'), '╚' + '═'.repeat(w + 2) + '╝'];
  }

  // ───────────────────────── Juegos de caracteres ─────────────────────────
  const CHARSETS = {
    standard: '$@B%8&WM#*oahkbdpqwmZO0QLCJUYXzcvunxrjft/\\|()1{}[]?-_+~<>i!lI;:,"^`\'. ',
    blocks: '█▓▒░ ', minimal: '@+:. ', dense: '$@B%8&WM#*oahkbdpqwm ', dots: '●◉○•· ',
    matrix: '10 ', braille: '⣿⣷⣯⣟⡿⢿⣻⣽⣾⣶⣦⣤⣄⣀⡀ ', lines: '#|/-\\+:. ',
  };
  const LIGHT = ' .,\'`-_:;·', MID = '|/\\()[]{}+<>!?~^"*', HEAVY = '#@█▓%8&WMmwB$▒';
  // Cambia los caracteres de la fuente por los del juego elegido manteniendo la "densidad"
  function remap(lines, cs) {
    const levels = [...cs].filter(c => c !== ' ');
    if (!levels.length) return lines;
    return lines.map(line => [...line].map(ch => {
      if (ch === ' ') return ' ';
      if (levels.length === 1) return levels[0];
      let d = 0.75;
      if (HEAVY.includes(ch)) d = 1; else if (MID.includes(ch)) d = 0.5; else if (LIGHT.includes(ch)) d = 0.15;
      return levels[Math.min(levels.length - 1, Math.floor((1 - d) * levels.length))];
    }).join(''));
  }

  // ───────────────────────── Transformaciones ─────────────────────────
  const MORSE = { 'A':'.-','B':'-...','C':'-.-.','D':'-..','E':'.','F':'..-.','G':'--.','H':'....','I':'..','J':'.---','K':'-.-','L':'.-..','M':'--','N':'-.','Ñ':'--.--','O':'---','P':'.--.','Q':'--.-','R':'.-.','S':'...','T':'-','U':'..-','V':'...-','W':'.--','X':'-..-','Y':'-.--','Z':'--..','0':'-----','1':'.----','2':'..---','3':'...--','4':'....-','5':'.....','6':'-....','7':'--...','8':'---..','9':'----.','.':'.-.-.-',',':'--..--','?':'..--..','!':'-.-.--','/':'-..-.','@':'.--.-.','=':'-...-','-':'-....-' };
  const NATO = { 'A':'Alfa','B':'Bravo','C':'Charlie','D':'Delta','E':'Echo','F':'Foxtrot','G':'Golf','H':'Hotel','I':'India','J':'Juliett','K':'Kilo','L':'Lima','M':'Mike','N':'November','O':'Oscar','P':'Papa','Q':'Quebec','R':'Romeo','S':'Sierra','T':'Tango','U':'Uniform','V':'Victor','W':'Whiskey','X':'X-ray','Y':'Yankee','Z':'Zulu' };
  const strip = c => c.normalize('NFD').replace(/[̀-ͯ]/g, '');
  const utf8 = s => [...new TextEncoder().encode(s)];
  const TRANSFORMS = {
    none: t => t,
    upper: t => t.toUpperCase(),
    lower: t => t.toLowerCase(),
    reverse: t => t.split('\n').map(l => [...l].reverse().join('')).join('\n'),
    leet: t => [...t].map(c => ({ a: '4', e: '3', i: '1', o: '0', s: '5', t: '7', l: '1', b: '8', g: '9' }[strip(c).toLowerCase()] || c)).join(''),
    morse: t => t.split('\n').map(l => [...l.toUpperCase()].map(c => c === ' ' ? '/' : (MORSE[c] || MORSE[strip(c)] || c)).join(' ')).join('\n'),
    rot13: t => [...t].map(c => { const k = c.charCodeAt(0); if (k >= 65 && k <= 90) return String.fromCharCode((k - 52) % 26 + 65); if (k >= 97 && k <= 122) return String.fromCharCode((k - 84) % 26 + 97); return c; }).join(''),
    zalgo: (t, seed) => { const rnd = mulberry(seed), zc = ['̈','̃','̄','̆','̇','̊','̋','̌','̍','̎','̏','̐','̑','̒','̓','̔','̖','̗','̘','̙'];
      return [...t].map(c => /\s/.test(c) ? c : c + Array.from({ length: 1 + Math.floor(rnd() * 3) }, () => zc[Math.floor(rnd() * zc.length)]).join('')).join(''); },
    phonetic: t => t.split('\n').map(l => [...l.toUpperCase()].map(c => c === ' ' ? '-' : (NATO[strip(c)] || c)).join(' ')).join('\n'),
    binary: t => t.split('\n').map(l => utf8(l).map(b => b.toString(2).padStart(8, '0')).join(' ')).join('\n'),
    hex: t => t.split('\n').map(l => utf8(l).map(b => b.toString(16).toUpperCase().padStart(2, '0')).join(' ')).join('\n'),
    nato_morse: t => t.split('\n').map(l => [...l.toUpperCase()].map(c => c === ' ' ? '/' : `${NATO[strip(c)] || c}(${MORSE[c] || MORSE[strip(c)] || c})`).join(' ')).join('\n'),
  };

  // ───────────────────────── Color ─────────────────────────
  const hexToRgb = h => ({ r: parseInt(h.slice(1, 3), 16), g: parseInt(h.slice(3, 5), 16), b: parseInt(h.slice(5, 7), 16) });
  const lerp = (a, b, t) => `rgb(${Math.round(a.r + (b.r - a.r) * t)},${Math.round(a.g + (b.g - a.g) * t)},${Math.round(a.b + (b.b - a.b) * t)})`;
  // Matriz de colores (null = espacio) con la misma forma que las líneas
  function colorGrid(lines, mode, c1hex, c2hex, seed) {
    const c1 = hexToRgb(c1hex), c2 = hexToRgb(c2hex), rnd = mulberry(seed);
    const H = lines.length, W = widthOf(lines);
    return lines.map((line, ri) => [...line].map((ch, ci) => {
      if (ch === ' ') return null;
      const nt = ri / Math.max(H - 1, 1), nc = ci / Math.max(W - 1, 1);
      switch (mode) {
        case 'gradient_h': return lerp(c1, c2, nc);
        case 'gradient_v': return lerp(c1, c2, nt);
        case 'rainbow': return `hsl(${Math.round(nc * 330)},90%,60%)`;
        case 'heatmap': return `hsl(${Math.round((1 - nt) * 240)},80%,55%)`;
        case 'matrix_green': return `rgb(0,${Math.floor(110 + rnd() * 145)},${Math.floor(rnd() * 40)})`;
        case 'cyber': return (ci + ri) % 2 === 0 ? '#00e5c3' : '#c084fc';
        case 'fire': return `hsl(${Math.round(nt * 55)},100%,${Math.round(45 + nt * 25)}%)`;
        case 'random': return `hsl(${Math.floor(rnd() * 360)},80%,62%)`;
        default: return `rgb(${c1.r},${c1.g},${c1.b})`;
      }
    }));
  }
  const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  function colorHTML(lines, colors) {
    return lines.map((line, r) => {
      const a = [...line]; let out = '', cur = null, buf = '';
      const flush = () => { if (!buf) return; out += cur ? `<span style="color:${cur}">${esc(buf)}</span>` : esc(buf); buf = ''; };
      a.forEach((ch, c) => { const col = colors[r][c]; if (col !== cur && ch !== ' ') { flush(); cur = col; } buf += ch; });
      flush(); return out;
    }).join('\n');
  }

  const api = { parseFLF, glyphFor, renderFiglet, composeLine, mirrorH, mirrorV, EFFECTS, invert, bold, border, CHARSETS, remap, TRANSFORMS, colorGrid, colorHTML, hash, mulberry, widthOf, esc };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.AsciiCore = api;
})(typeof window !== 'undefined' ? window : globalThis);
