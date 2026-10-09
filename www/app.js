/* 家庭学习打卡 - 纯前端版(数据存在手机本地 localStorage) */
(function () {
  'use strict';
  var ERR = ['不会', '粗心', '没时间'], SUBJ = ['语文', '数学', '英语'];
  var ADV = {
    '不会': '回补知识点:让孩子先讲思路,从最小的缺口开始补,补完隔几天再重做。',
    '粗心': '练检查习惯:做完圈出数字/符号/单位逐项核对,不用再讲一遍知识点。',
    '没时间': '练速度和答题顺序:先做会的、卡住就跳过,用计时器限时做同类题。'
  };
  var ERRCLS = { '不会': 't1', '粗心': 't2', '没时间': 't3' };
  var WD = ['一', '二', '三', '四', '五', '六', '日'];
  var KEY = 'fsa_v1';
  var CFG = window.APP_CONFIG || { version: '0.0.0', repo: '' };

  // ---------- 工具 ----------
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function ymd(d) { var m = d.getMonth() + 1, x = d.getDate(); return d.getFullYear() + '-' + (m < 10 ? '0' : '') + m + '-' + (x < 10 ? '0' : '') + x; }
  function parse(s) { var p = s.split('-').map(Number); return new Date(p[0], p[1] - 1, p[2]); }
  function addDays(d, n) { var x = new Date(d.getFullYear(), d.getMonth(), d.getDate()); x.setDate(x.getDate() + n); return x; }
  function isoWd(d) { return d.getDay() || 7; }
  function monday(d) { return addDays(d, -(isoWd(d) - 1)); }
  function today() { return ymd(new Date()); }
  function hashPin(p) { // 简单散列:只为防孩子误点,不是高强度安全
    var h1 = 0xdeadbeef, h2 = 0x41c6ce57, s = 'fsa:' + p;
    for (var i = 0; i < s.length; i++) { var c = s.charCodeAt(i); h1 = Math.imul(h1 ^ c, 2654435761); h2 = Math.imul(h2 ^ c, 1597334677); }
    h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
    h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
    return String(4294967296 * (2097151 & h2) + (h1 >>> 0));
  }
  var toastT;
  function toast(t) { var e = document.getElementById('toast'); e.textContent = t; e.classList.add('show'); clearTimeout(toastT); toastT = setTimeout(function () { e.classList.remove('show'); }, 2200); }

  // ---------- 数据 ----------
  var MWY = [
    ['汉字书写', 10, [1, 2, 3, 4, 5], '写慢写对;标准是"认真写",不是"好看"', 'zi'],
    ['英语书写', 10, [1, 2, 3, 4, 5], '抄写并朗读,对照字形', 'en'],
    ['语文:词语听写(家长报词)', 10, [1, 3], '错的词圈出来,再写3遍', 'ci'],
    ['数学:小数乘法练习', 15, [1, 2, 3, 4, 5, 6, 7], '写在本子上,做完让家长对答案', 'math'],
    ['数学错题订正', 25, [1, 4], '当天作业里的错题'],
    ['语文:错字词/阅读题订正', 25, [2], ''],
    ['英语:单词/课文朗读/错题', 25, [3], ''],
    ['自选一科(自己决定)', 25, [5], '培养主动性'],
    ['本周错题整理(家长陪同)', 30, [6], '按"不会/粗心/没时间"归类'],
    ['轻复习:把错题讲给家长听', 15, [7], '休息日,只做轻量复习']
  ];
  var MWN = [['英语:单词与课文', 20, [1, 2, 3, 4, 5], '']];
  var S;
  function seed() {
    var s = { v: 1, start: today(), pin: hashPin('1234'), defpin: true, nextId: 1, kids: [
      { id: 1, name: 'MWY', emoji: '🦁', grade: '五年级' }, { id: 2, name: 'MWN', emoji: '🐼', grade: '九年级' }],
      tasks: [], checkins: {}, mistakes: [], talks: {}, pauses: [], prog: {}, adv: {}, mig: 3 };
    [[1, MWY], [2, MWN]].forEach(function (kp) {
      kp[1].forEach(function (t, i) { s.tasks.push({ id: s.nextId++, kid: kp[0], name: t[0], minutes: t[1], days: t[2], note: t[3], kind: t[4] || '', active: true, sort: i }); });
    });
    return s;
  }
  function load() {
    try { S = JSON.parse(localStorage.getItem(KEY)); } catch (e) { S = null; }
    if (!S || !S.kids || !S.tasks) S = seed();
    if (!S.prog) S.prog = {};
    if (!S.adv) S.adv = {};
    if ((S.mig || 0) < 2) { // 旧版升级:给原有任务挂上学习内容,并补上新任务
      var KM = { '汉字书写': 'zi', '英语书写': 'en' };
      S.tasks.forEach(function (t) { if (t.kid === 1 && !t.kind && KM[t.name]) t.kind = KM[t.name]; });
      [['语文:词语听写(家长报词)', 10, [1, 3], '错的词圈出来,再写3遍', 'ci'], ['数学:小数乘法练习', 15, [2, 5], '写在本子上,做完让家长对答案', 'math']].forEach(function (x) {
        if (!S.tasks.some(function (t) { return t.kid === 1 && t.kind === x[4]; })) S.tasks.push({ id: S.nextId++, kid: 1, name: x[0], minutes: x[1], days: x[2], note: x[3], kind: x[4], active: true, sort: 50 });
      });
      S.mig = 2; save();
    }
    if ((S.mig || 0) < 3) { // 数学改为每天都有
      S.tasks.forEach(function (t) { if (t.kid === 1 && t.kind === 'math') t.days = [1, 2, 3, 4, 5, 6, 7]; });
      S.mig = 3; save();
    }
  }
  function save() { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) { toast('保存失败:存储不可用'); } }
  function kidOf(id) { return S.kids.filter(function (k) { return k.id === id; })[0]; }

  function tasksFor(kid, d) {
    var wd = isoWd(d);
    return S.tasks.filter(function (t) { return t.kid === kid && t.active && t.days.indexOf(wd) >= 0; }).sort(function (a, b) { return a.sort - b.sort || a.id - b.id; });
  }
  function doneList(day) { return S.checkins[day] || []; }
  function daySummary(kid, d) {
    var ts = tasksFor(kid, d), dn = doneList(ymd(d));
    return [ts.length, ts.filter(function (t) { return dn.indexOf(t.id) >= 0; }).length];
  }
  function streak(kid) {
    var d = new Date(), s = 0, r = daySummary(kid, d);
    if (r[0] && r[1] === r[0]) s++;
    d = addDays(d, -1);
    for (var i = 0; i < 400; i++) {
      if (ymd(d) < S.start) break;
      r = daySummary(kid, d);
      if (r[0] === 0) { d = addDays(d, -1); continue; }
      if (r[1] === r[0]) { s++; d = addDays(d, -1); } else break;
    }
    return s;
  }
  // ---------- 学习内容 ----------
  var CT = window.CONTENT || { ZI: [], CI: [], EN: [], math: function () { return { t: '', items: [] }; } };
  var SZ = { zi: 6, ci: 6 }, KN = { zi: '汉字(写字表)', ci: '词语(词语表)', en: '英语单词(北师大版5上)', math: '数学(小数乘法)' };
  function total(k) { return k === 'zi' ? Math.ceil(CT.ZI.length / 6) : k === 'ci' ? Math.ceil(CT.CI.length / 6) : k === 'en' ? CT.EN.length : 9999; }
  function curIdx(t) { return S.prog[t.kind] || 0; }
  function contentHtml(kind, idx, withAns) {
    if (idx >= total(kind)) return '<div class="cont">这一部分已经学完 🎉 家长可在「任务」页调整进度。</div>';
    var h = '';
    if (kind === 'zi') {
      var a = CT.ZI.slice(idx * 6, idx * 6 + 6);
      h = '<div class="ctt">写字表 第 ' + (idx * 6 + 1) + '–' + (idx * 6 + a.length) + ' 个字(共 ' + CT.ZI.length + ')</div><div class="chars">' + a.map(function (z) { return '<div class="ch"><div class="py">' + esc(z[1]) + '</div><div class="hz">' + esc(z[0]) + '</div><div class="rd">偏旁 ' + esc(z[2]) + '</div><div class="rd">词语:' + esc(z[4] || '') + '</div></div>'; }).join('') + '</div><div class="hint">每个字:读拼音 → 看清笔画 → 写 2 遍 → 盖住默写 1 遍。</div>';
    } else if (kind === 'ci') {
      var b = CT.CI.slice(idx * 6, idx * 6 + 6);
      h = '<div class="ctt">词语表 第 ' + (idx * 6 + 1) + '–' + (idx * 6 + b.length) + ' 个词(共 ' + CT.CI.length + ')</div><div class="words">' + b.map(function (w) { return '<span>' + esc(w[0]) + '<small>' + esc(w[1]) + '</small></span>'; }).join('') + '</div><div class="hint">家长报词,孩子默写;错的词圈出来再写 3 遍。</div>';
    } else if (kind === 'en') {
      var e = CT.EN[idx];
      h = '<div class="ctt">' + esc(e.t) + '</div><div class="words">' + e.w.map(function (w) { return '<span>' + esc(w[0]) + '<small>' + esc(w[1]) + '</small></span>'; }).join('') + '</div><div class="hint">每个词抄 2 遍并大声读;最后合上本子,看中文默写英文。</div>' +
        (e.g && e.g.length ? '<div class="ctt" style="margin-top:10px">句型(抄一遍,再换一个词仿写一句)</div>' + e.g.map(function (g) { return '<div class="sent">' + esc(g[0]) + '<small>' + esc(g[1]) + '</small></div>'; }).join('') : '') +
        (e.r && e.r.length ? '<div class="ctt" style="margin-top:10px">语法小贴士</div>' + e.r.map(function (r) { return '<div class="gram"><b>' + esc(r[0]) + '</b>' + esc(r[1]) + '</div>'; }).join('') : '');
    } else if (kind === 'math') {
      var m = CT.math(idx + 1);
      h = '<div class="ctt">' + esc(m.t) + ':6 道题,写在本子上</div><ol class="qs">' + m.items.map(function (x) { return '<li><span class="qk">' + esc(x.k) + '</span> ' + esc(x.q) + (withAns ? '<div class="ans">答案:' + esc(x.a) + '</div>' : '') + '</li>'; }).join('') + '</ol>' + (withAns ? '' : '<div class="hint">竖式要小数点对齐;算完先估一估,再让家长对答案。</div>');
    }
    if (!withAns) h += '<div class="row" style="margin-top:8px"><button class="sm ghost" onclick="event.stopPropagation();A.printKind(\'' + kind + '\',' + idx + ')">🖨 打印这份练习</button></div>';
    return '<div class="cont">' + h + '</div>';
  }
  function toggle(taskId) {
    var day = today(), arr = S.checkins[day] || [], i = arr.indexOf(taskId), done;
    var t = S.tasks.filter(function (x) { return x.id === taskId; })[0], ak = day + '|' + taskId;
    if (i >= 0) {
      arr.splice(i, 1); done = false;
      if (t.kind && S.adv[ak] != null) { if ((S.prog[t.kind] || 0) === S.adv[ak] + 1) S.prog[t.kind] = S.adv[ak]; delete S.adv[ak]; } // 取消打卡:进度退回
    } else {
      arr.push(taskId); done = true;
      if (t.kind) { var ix = S.prog[t.kind] || 0; if (ix < total(t.kind)) { S.adv[ak] = ix; S.prog[t.kind] = ix + 1; } } // 打卡:内容前进一份
    }
    S.checkins[day] = arr; save();
    var r = daySummary(t.kid, new Date());
    return { done: done, all: done && r[0] > 0 && r[1] === r[0] };
  }
  function stats(kid) {
    var d = new Date(), mon = monday(d), weeks = [], w, i;
    for (w = 3; w >= 0; w--) {
      var ws = addDays(mon, -7 * w), tot = 0, dn = 0;
      for (i = 0; i < 7; i++) {
        var dd = addDays(ws, i);
        if (ymd(dd) > ymd(d)) break;
        if (ymd(dd) < S.start) continue;
        var r = daySummary(kid, dd); tot += r[0]; dn += r[1];
      }
      weeks.push({ week: ymd(ws), total: tot, done: dn });
    }
    var since = ymd(addDays(d, -30)), byType = { '不会': 0, '粗心': 0, '没时间': 0 }, bySub = {};
    SUBJ.forEach(function (s) { bySub[s] = { '不会': 0, '粗心': 0, '没时间': 0 }; });
    S.mistakes.forEach(function (m) { if (m.kid === kid && m.day >= since) { byType[m.type]++; bySub[m.subject][m.type]++; } });
    var total = byType['不会'] + byType['粗心'] + byType['没时间'], top = null;
    if (total) top = ERR.slice().sort(function (a, b) { return byType[b] - byType[a]; })[0];
    var openN = S.mistakes.filter(function (m) { return m.kid === kid && !m.fixed; }).length;
    var p7 = S.pauses.filter(function (x) { return x >= ymd(addDays(d, -6)); }).length;
    return { weeks: weeks, byType: byType, bySub: bySub, total: total, top: top, share: top ? Math.round(byType[top] * 100 / total) : 0, open: openN, streak: streak(kid), pauses7: p7 };
  }

  // ---------- 版本更新 ----------
  var UPD = null;
  function vnum(v) { return String(v).replace(/^v/, '').split('.').map(function (x) { return parseInt(x, 10) || 0; }); }
  function newer(a, b) { var x = vnum(a), y = vnum(b); for (var i = 0; i < 3; i++) { if ((x[i] || 0) > (y[i] || 0)) return true; if ((x[i] || 0) < (y[i] || 0)) return false; } return false; }
  function checkUpdate(manual) {
    if (!CFG.repo) { if (manual) toast('网页测试版,没有设置更新地址'); return Promise.resolve(); }
    return fetch('https://api.github.com/repos/' + CFG.repo + '/releases/latest').then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); }).then(function (j) {
      var latest = String(j.tag_name || '').replace(/^v/, ''), apk = (j.assets || []).filter(function (a) { return /\.apk$/i.test(a.name); })[0];
      UPD = { latest: latest, has: newer(latest, CFG.version), url: apk ? apk.browser_download_url : j.html_url, notes: j.body || '' };
      if (manual) toast(UPD.has ? '发现新版本 ' + latest : '已是最新版本');
      if (view === 'parent') render();
    }).catch(function () { if (manual) toast('检查失败:请确认手机已联网'); });
  }
  function openUrl(u) {
    var P = window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.Browser;
    if (P && P.open) P.open({ url: u }); else window.open(u, '_blank');
  }
  function sheetHtml(kind, idx, ans, ci2) {
    var css = '@page{size:A4;margin:12mm}*{-webkit-print-color-adjust:exact;print-color-adjust:exact}body{font:14px/1.5 "Microsoft YaHei",sans-serif;margin:0;color:#000}h1{font-size:18px;margin:0 0 4px}.nm{font-size:12px;color:#444;margin-bottom:8px}' +
      '.row{display:flex;align-items:center;margin:0 0 2mm;page-break-inside:avoid}.lab{flex:none;width:20mm;text-align:center;font-size:11px;line-height:1.2}.lab b{display:block;font-size:13px;font-weight:normal}' +
      '.t{flex:none;position:relative;width:9mm;height:9mm;border:1px solid #222;box-sizing:border-box;font-size:6.5mm;line-height:9mm;text-align:center;color:#aaa}' +
      '.t:before{content:"";position:absolute;left:0;right:0;top:50%;border-top:1px dashed #bbb}.t:after{content:"";position:absolute;top:0;bottom:0;left:50%;border-left:1px dashed #bbb}' +
      '.l4{position:relative;height:8mm;border-top:1px solid #777;border-bottom:1px solid #777;margin:0 0 2mm}.l4:before{content:"";position:absolute;left:0;right:0;top:33.3%;border-top:1px solid #333}.l4:after{content:"";position:absolute;left:0;right:0;top:66.6%;border-top:1px solid #d33}' +
      '.w{font-size:15px;margin:3mm 0 1mm}.w small{color:#555;font-size:12px;margin-left:6px}.sec{font-weight:bold;margin:5mm 0 2mm;font-size:14px}.ln{border-bottom:1px solid #333;height:9mm;margin:0 0 1mm}' +
            '.q{page-break-inside:avoid;margin:0 0 4mm;font-size:16px}.sp{height:26mm}.g2{display:grid;grid-template-columns:1fr 1fr;gap:0 8mm}.pb{page-break-before:always}.gr{border:1px solid #888;padding:4px 8px;margin:3mm 0;font-size:13px}';
    var h = '', title = '';
    var head = function (t, sub) { return '<h1>' + esc(t) + '</h1><div class="nm">姓名:__________  日期:__________  ' + esc(sub || '') + '</div>'; };
    if (kind === 'zi') {
      var a = CT.ZI.slice(idx * 6, idx * 6 + 6); title = '汉字书写练习';
      var wordCells = function (w) { var c = ''; for (var i = 0; i < w.length; i++) c += '<div class="t">' + esc(w[i]) + '</div>'; return c + blank(Math.max(0, 10 - w.length)); };
      var blank = function (n) { var c = ''; for (var i = 0; i < n; i++) c += '<div class="t"></div>'; return c; };
      h = head(title, '每个字:先描灰字,再写在空格里;后面是这个字组成的词语,也描一描、写一写。') + a.map(function (z) {
        return '<div class="row"><div class="lab">' + esc(z[1]) + '<br>偏旁 ' + esc(z[2]) + '</div><div class="t">' + esc(z[0]) + '</div>' + blank(6) + '<div style="width:5mm;flex:none"></div>' + wordCells(z[4] || '') + '</div>';
      }).join('');
      if (ci2 != null && ci2 < total('ci')) {
        var cw = CT.CI.slice(ci2 * 6, ci2 * 6 + 6);
        h += '<div class="sec" style="margin-top:8mm">词语听写:家长报词,孩子写在横线上(写错的订正后再写 3 遍)</div>' + cw.map(function (w, i) { return '<div class="q" style="margin:0 0 2mm">' + (i + 1) + '. <span style="color:#555;font-size:13px">' + esc(w[1]) + '</span><div class="ln"></div></div>'; }).join('');
        if (ans) h += '<div class="sec">参考答案(家长用)</div><div style="font-size:16px">' + cw.map(function (w) { return esc(w[0]); }).join('  ') + '</div>';
      }
    } else if (kind === 'ci') {
      var b = CT.CI.slice(idx * 6, idx * 6 + 6); title = '词语听写练习';
      h = head(title, '家长报词,孩子写在横线上;写错的词订正后再写 3 遍。') + b.map(function (w, i) { return '<div class="q">' + (i + 1) + '. <span style="color:#555;font-size:13px">' + esc(w[1]) + '</span><div class="ln"></div></div>'; }).join('') +
        '<div class="pb"></div>' + head('词语听写 · 家长报词表') + b.map(function (w, i) { return '<div class="q">' + (i + 1) + '. ' + esc(w[0]) + ' <span style="color:#666;font-size:13px">' + esc(w[1]) + '</span></div>'; }).join('');
    } else if (kind === 'en') {
      var e = CT.EN[idx]; title = '英语书写练习';
      var wl = function (w) { return '<div><div class="w">' + esc(w[0]) + '<small>' + esc(w[1]) + '</small></div><div class="l4"></div></div>'; };
      h = head(title, e.t) + '<div class="sec">一、单词:每个抄一遍</div><div class="g2">' + e.w.map(wl).join('') + '</div>' +
        (e.g && e.g.length ? '<div class="sec">二、句子:抄一遍,再换一个词仿写一句</div>' + e.g.map(wl).join('') : '') +
        (e.r && e.r.length ? '<div class="sec">三、语法小贴士</div>' + e.r.map(function (r) { return '<div class="gr"><b>' + esc(r[0]) + '</b> ' + esc(r[1]) + '</div>'; }).join('') : '') +
        '<div class="sec">四、默写:看中文,写英文</div>' + e.w.map(function (w) { return '<div class="q" style="margin:0 0 2mm;font-size:14px;display:inline-block;width:49%">' + esc(w[1]) + ' → <span style="display:inline-block;width:42mm;border-bottom:1px solid #333">&nbsp;</span></div>'; }).join('');
    } else if (kind === 'math') {
      var m = CT.math(idx + 1); title = '数学练习';
      var HT = { '小数乘整数': '先当作整数乘,再看小数有几位,积就点几位小数。', '竖式:小数乘小数(注意对位)': '竖式末位对齐,先按整数乘;两个因数一共有几位小数,积就从右往左数几位点小数点。', '位数判断': '先数两个因数一共有几位小数,积就有几位小数。', '凑整简算': '先找能凑成整数的数相乘(如 0.25×4、1.25×0.8、2.5×0.4);带 101 的题可以想 101=100+1。', '四舍五入': '先算出准确的积,再看要保留位的后一位:4 以下舍去,5 以上进一。', '乘法分配律': '可以先算括号里的和;也可以用 (a+b)×c=a×c+b×c,看哪个更简便。', '阶梯计价应用题': '分段算:不超过的部分按第一种价,超过的部分按第二种价,最后把两段的钱加起来。' };
      h = head(title, m.t) + m.items.map(function (x, i) { return '<div class="q">(' + (i + 1) + ') ' + esc(x.q) + (HT[x.k] ? '<div style="font-size:11px;color:#666;margin-top:1mm">提示:' + esc(HT[x.k]) + '</div>' : '') + '<div class="sp"></div></div>'; }).join('') +
        (ans ? '<div class="pb"></div>' + head('数学练习 · 参考答案(家长用)', m.t) + m.items.map(function (x, i) { return '<div class="q">(' + (i + 1) + ') ' + esc(x.q) + '<br><span style="color:#2a7;font-size:14px">答案:' + esc(x.a) + '</span></div>'; }).join('') : '');
    }
    return { html: '<!doctype html><html><head><meta charset="utf-8"><style>' + css + '</style></head><body>' + h + '</body></html>', title: title };
  }
  function printHtml(html, title) {
    var C = window.Capacitor, P = C && C.isNativePlatform && C.isNativePlatform() && C.Plugins && C.Plugins.PrintHtml;
    if (P) { P.print({ html: html, title: title }).catch(function () { toast('打印失败'); }); return; }
    var f = document.createElement('iframe'); f.style.cssText = 'position:fixed;width:0;height:0;border:0'; document.body.appendChild(f);
    f.contentDocument.open(); f.contentDocument.write(html); f.contentDocument.close();
    setTimeout(function () { try { f.contentWindow.focus(); f.contentWindow.print(); } catch (e) { toast('此环境不能打印'); } }, 300);
  }

  // ---------- 视图 ----------
  var view = 'pick', kid = null, tab = '总览', parentOk = false, root = document.getElementById('root');
  function render() { ({ pick: vPick, kid: vKid, plogin: vLogin, parent: vParent })[view](); }
  function go(v) { view = v; render(); window.scrollTo(0, 0); }

  function vPick() {
    root.innerHTML = '<h1 style="text-align:center">你是谁?</h1><div class="kids">' + S.kids.map(function (k) {
      return '<button class="kidbtn" onclick="A.pick(' + k.id + ')">' + k.emoji + '<br>' + esc(k.name) + '<small>' + esc(k.grade) + '</small></button>';
    }).join('') + '</div><p style="text-align:center"><button class="ghost sm" onclick="A.toParent()">家长入口</button></p>' +
      '<p class="mute" style="text-align:center">版本 ' + esc(CFG.version) + '</p>';
  }
  function vKid() {
    var k = kidOf(kid), d = new Date(), ts = tasksFor(kid, d), dn = doneList(today()), st = streak(kid), mon = monday(d), cells = '';
    for (var i = 0; i < 7; i++) {
      var dd = addDays(mon, i), r = ymd(dd) < S.start ? [0, 0] : daySummary(kid, dd), cls = r[0] && r[1] === r[0] ? 'full' : (r[1] ? 'part' : ''), fut = ymd(dd) > ymd(d);
      cells += '<div class="day">周' + WD[i] + '<div class="dot ' + cls + ' ' + (ymd(dd) === ymd(d) ? 'today' : '') + '">' + (r[0] ? (r[1] === r[0] ? '✓' : (fut ? '' : r[1] + '/' + r[0])) : '·') + '</div></div>';
    }
    root.innerHTML = '<div class="row" style="justify-content:space-between"><button class="ghost sm" onclick="go(\'pick\')">← 换人</button><span class="mute">' + today() + '</span></div>' +
      '<div class="hero"><h1>' + k.emoji + ' ' + esc(k.name) + ',今天加油!</h1><div>' + (st > 0 ? '🔥 连续 <b>' + st + '</b> 天全部完成' : '今天完成全部任务,开始你的连续记录!') + '</div></div>' +
      (ts.length ? ts.map(function (t) {
        var dn1 = dn.indexOf(t.id) >= 0;
        return '<div class="task ' + (dn1 ? 'done' : '') + '" onclick="A.tap(' + t.id + ')"><div class="box">' + (dn1 ? '✓' : '') + '</div><div><div class="nm">' + esc(t.name) + '</div><div class="sub">' + t.minutes + ' 分钟' + (t.note ? ' · ' + esc(t.note) : '') + '</div></div></div>' + (t.kind ? contentHtml(t.kind, curIdx(t), false) : '');
      }).join('') : '<div class="card">今天没有任务,好好休息 😊</div>') +
      redoHtml() +
      '<div class="card"><b>本周</b><div class="week">' + cells + '</div></div>' +
      printCard() +
      '<details class="card"><summary class="mute">📥 收到新错题文件?点这里导入</summary><p class="mute">选微信里收到的错题文件(.json)就行,只会添加错题。</p><input type="file" id="m_file_k" accept=".json,.txt,application/json,text/plain" onchange="A.importFile(this)"></details>';
  }
  function printCard() {
    var pk = []; S.tasks.forEach(function (t) { if (t.kid === kid && t.active !== false && t.kind && pk.indexOf(t.kind) < 0) pk.push(t.kind); });
    if (pk.indexOf('zi') >= 0) pk = pk.filter(function (k) { return k !== 'ci'; });
    if (!pk.length) return '';
    return '<details class="card"><summary class="mute">🖨 打印练习纸(汉字+词语 / 英语 / 数学)</summary><div class="row" style="margin-top:8px">' + pk.map(function (k) { return '<button class="sm ghost" onclick="A.printKind(\'' + k + '\',' + (S.prog[k] || 0) + ')">🖨 ' + esc(k === 'zi' ? '汉字+词语' : (KN[k] || k)) + '</button>'; }).join('') + '</div><div class="mute" style="margin-top:6px">打印的是当前这一份练习。</div></details>';
  }
  function redoHtml() {
    var t = today(), due = S.mistakes.filter(function (m) { return m.kid === kid && !m.fixed && (m.next || m.day) <= t; }).sort(function (a, b) { return a.day < b.day ? -1 : (a.day > b.day ? 1 : a.id - b.id); }).slice(0, 3);
    if (!due.length) return '';
    return '<div class="card"><b>错题重做</b> <span class="mute">在本子上重做,连续做对 3 次就过关</span>' + due.map(function (m) {
      return '<div class="redo"><div class="mute">' + esc(m.subject) + ' · ' + m.day.slice(5) + (m.streak ? ' · 已连对 ' + m.streak + ' 次' : '') + '</div>' + (m.src ? '<div class="mute" style="font-size:12px">' + esc(m.src) + '</div>' : '') + '<div class="qtext">' + esc(m.q || m.topic) + '</div>' +
        '<div class="row" style="margin-top:6px"><button class="sm" onclick="A.mk(' + m.id + ',true)">做对了</button><button class="sm ghost" onclick="A.mk(' + m.id + ',false)">还不会</button></div></div>';
    }).join('') + '</div>';
  }
  function vLogin() {
    root.innerHTML = '<div class="card"><h1>家长入口</h1><div class="row"><input id="pin" type="password" inputmode="numeric" placeholder="PIN"><button onclick="A.login()">进入</button></div>' +
      '<p class="mute" id="lmsg">首次使用默认 PIN 为 1234,进入后请先在「设置」里修改。</p><button class="ghost sm" onclick="go(\'pick\')">← 返回</button></div>';
  }
  function vParent() {
    var T = ['总览', '错题', '任务', '沟通', '设置'];
    root.innerHTML = '<div class="row" style="justify-content:space-between"><h1>家长看板</h1><button class="ghost sm" onclick="A.exitParent()">退出</button></div>' +
      (S.defpin ? '<div class="card" style="background:#fff3cd">你还在用默认 PIN,请到「设置」里修改。</div>' : '') +
      (UPD && UPD.has ? '<div class="card banner"><b>有新版本 ' + esc(UPD.latest) + '</b><div class="mute">当前 ' + esc(CFG.version) + '</div><button class="sm" style="margin-top:6px" onclick="A.downloadUpdate()">下载并安装更新</button></div>' : '') +
      '<div class="row">' + S.kids.map(function (k) { return '<button class="' + (k.id === kid ? '' : 'ghost') + '" onclick="A.setKid(' + k.id + ')">' + k.emoji + ' ' + esc(k.name) + '</button>'; }).join('') + '</div>' +
      '<div class="tabs">' + T.map(function (t) { return '<button class="' + (t === tab ? 'on' : '') + '" onclick="A.setTab(\'' + t + '\')">' + t + '</button>'; }).join('') + '</div><div id="pv"></div>';
    ({ '总览': pOverview, '错题': pMistakes, '任务': pTasks, '沟通': pTalk, '设置': pSettings })[tab]();
  }
  function pv(h) { document.getElementById('pv').innerHTML = h; }
  function opts(arr, sel) { return arr.map(function (x) { return '<option' + (x === sel ? ' selected' : '') + '>' + x + '</option>'; }).join(''); }

  function pOverview() {
    var s = stats(kid), tt = s.total || 1;
    pv('<div class="card"><b>连续全部完成:</b> ' + s.streak + ' 天 · <b>待订正错题:</b> ' + s.open + ' 道 · <b>本周用暂停规则:</b> ' + s.pauses7 + ' 次</div>' +
      '<div class="card"><b>近 4 周打卡完成率</b>' + s.weeks.map(function (w) {
        var p = w.total ? Math.round(w.done * 100 / w.total) : 0;
        return '<div class="mute" style="margin-top:8px">' + w.week + ' 起 · ' + w.done + '/' + w.total + ' (' + p + '%)</div><div class="bar"><i style="width:' + p + '%"></i></div>';
      }).join('') + '</div>' +
      '<div class="card"><b>近 30 天错题归因</b> (共 ' + s.total + ' 道)' + (s.total ? ERR.map(function (t) {
        return '<div class="row" style="margin-top:6px"><span class="tag ' + ERRCLS[t] + '" style="width:64px;text-align:center">' + t + '</span><div class="bar" style="flex:1"><i style="width:' + Math.round(s.byType[t] * 100 / tt) + '%;background:var(--blue)"></i></div><span>' + s.byType[t] + '</span></div>';
      }).join('') : '<p class="mute">还没有录入错题。去「错题」页录入,这里会自动给出下周重点。</p>') +
      (s.top ? '<div class="card" style="background:#eef4ff;margin-top:12px"><b>下周重点:' + s.top + '占 ' + s.share + '%</b><br>' + esc(ADV[s.top]) + '</div>' : '') +
      (s.total ? '<table style="margin-top:10px"><tr><th>科目</th><th>不会</th><th>粗心</th><th>没时间</th></tr>' + SUBJ.map(function (k) { var v = s.bySub[k]; return '<tr><td>' + k + '</td><td>' + v['不会'] + '</td><td>' + v['粗心'] + '</td><td>' + v['没时间'] + '</td></tr>'; }).join('') + '</table>' : '') + '</div>' +
      '<div class="card"><b>我现在要发火了?</b><p class="mute">先走开,两分钟后回来。点一下记录,看看一周用了几次。</p><button onclick="A.pause()">我用了暂停规则</button></div>');
  }
  function pMistakes() {
    var list = S.mistakes.filter(function (m) { return m.kid === kid; }).sort(function (a, b) { return a.day < b.day ? 1 : (a.day > b.day ? -1 : b.id - a.id); });
    pv('<div class="card"><b>录入错题</b><div class="row" style="margin-top:8px"><select id="m_sub">' + opts(SUBJ) + '</select><select id="m_type">' + opts(ERR) + '</select><input type="date" id="m_day" value="' + today() + '"></div>' +
      '<input id="m_topic" placeholder="哪道题/哪个知识点(如:小数乘法竖式对位)" style="width:100%;margin-top:8px"><input id="m_note" placeholder="备注(可选)" style="width:100%;margin-top:8px">' +
      '<div class="mute" style="margin:6px 0">不会=讲不出思路或重做仍错 · 粗心=自己重看能改对 · 没时间=空题或后半段潦草</div><button onclick="A.addM()">保存</button></div>' +
      '<div class="card"><b>导入错题</b><p class="mute">点下面按钮,选微信收到的错题文件(.json)就会自动导入。同一天同一题不会重复导入。</p><div class="row"><input type="file" id="m_file" accept=".json,.txt,application/json,text/plain" onchange="A.importFile(this)"></div><details style="margin-top:8px"><summary class="mute">文件选不了?改为粘贴文本</summary><textarea id="m_imp" placeholder="粘贴导入文本"></textarea><div class="row" style="margin-top:8px"><button onclick="A.importM()">导入</button></div></details></div>' +
      '<div class="row"><button class="ghost" onclick="A.printMistakes()">🖨 打印待订正错题单</button></div>' +
      '<div class="card"><table><tr><th>日期</th><th>科目/内容</th><th>类型</th></tr>' + (list.map(function (m) {
        return '<tr style="' + (m.fixed ? 'opacity:.5' : '') + '"><td>' + m.day.slice(5) + '</td><td>' + m.subject + '<br>' + esc(m.topic) + (m.src ? '<div class="mute" style="font-size:12px">' + esc(m.src) + '</div>' : '') + '<div class="mute">' + esc(m.note) + (m.redo ? ' · 重做' + m.redo + '次' : '') + ((m.streak || 0) > 0 && !m.fixed ? ' · 连对 ' + m.streak + '/3' : '') + '</div>' +
          '<div class="row" style="margin-top:6px"><button class="sm ghost" onclick="A.redo(' + m.id + ')">重做+1</button><button class="sm" onclick="A.fix(' + m.id + ')">' + (m.fixed ? '撤销' : '已掌握') + '</button><button class="sm danger" onclick="A.delM(' + m.id + ')">删</button></div></td>' +
          '<td><select onchange="A.chType(' + m.id + ',this.value)">' + opts(ERR, m.type) + '</select></td></tr>';
      }).join('') || '<tr><td colspan="3" class="mute">暂无错题</td></tr>') + '</table></div>');
  }
  function pTasks() {
    var ts = S.tasks.filter(function (t) { return t.kid === kid && t.active; }).sort(function (a, b) { return a.sort - b.sort || a.id - b.id; });
    function boxes(cls, days) { return [1, 2, 3, 4, 5, 6, 7].map(function (d) { return '<label><input type="checkbox" class="' + cls + '" value="' + d + '"' + (days.indexOf(d) >= 0 ? ' checked' : '') + '>' + WD[d - 1] + '</label>'; }).join(' '); }
    var kinds = [], prog = '';
    ts.forEach(function (t) { if (t.kind && kinds.indexOf(t.kind) < 0) kinds.push(t.kind); });
    kinds.forEach(function (k) {
      var ix = S.prog[k] || 0, tt = total(k);
      prog += '<div class="card"><b>' + KN[k] + '</b> <span class="mute">' + (k === 'math' ? '已做 ' + ix + ' 天' : '下一份:第 ' + Math.min(ix + 1, tt) + ' / ' + tt + ' 份') + '</span>' +
        '<div class="row" style="margin-top:6px">从第 <input type="number" id="pg_' + k + '" value="' + (ix + 1) + '" min="1" style="width:70px"> 份开始 <button class="sm" onclick="A.saveProg(\'' + k + '\')">保存进度</button> <button class="sm ghost" onclick="A.printKind(\'' + k + '\',' + ix + ',1)">🖨 打印当前这份(数学含答案页)</button></div>' +
        (k === 'math' ? '<details style="margin-top:6px"><summary>查看今天数学题的答案</summary>' + contentHtml(k, ix, true) + '</details>' : '') + '</div>';
    });
    pv((prog ? '<div class="card"><b>学习内容进度</b> <span class="mute">(孩子每打一次卡,内容自动换下一份;可在这里改到课本实际进度)</span>' + prog + '</div>' : '') + '<div class="card"><b>每日任务</b> <span class="mute">(勾选哪几天出现)</span>' + ts.map(function (t) {
      return '<div class="card"><input id="n' + t.id + '" value="' + esc(t.name) + '" style="width:100%"><div class="row" style="margin-top:6px"><input type="number" id="m' + t.id + '" value="' + t.minutes + '" style="width:70px"> 分钟 ' + boxes('w' + t.id, t.days) + '</div>' +
        '<input id="o' + t.id + '" value="' + esc(t.note) + '" placeholder="备注" style="width:100%;margin-top:6px"><div class="row" style="margin-top:6px"><button class="sm" onclick="A.saveT(' + t.id + ')">保存</button><button class="sm danger" onclick="A.delT(' + t.id + ')">删除</button></div></div>';
    }).join('') + '</div><div class="card"><b>新增任务</b><input id="nn" placeholder="任务名" style="width:100%;margin:6px 0"><div class="row"><input type="number" id="nm" value="10" style="width:70px"> 分钟 ' + boxes('nw', [1, 2, 3, 4, 5, 6, 7]) + '<button onclick="A.addT()">添加</button></div></div>' +
      '<button class="ghost" onclick="A.printPlan()">🖨 打印一周安排</button>');
  }
  var SCRIPTS = [
    ['看到分数', '我看到了。你自己觉得这次哪里最可惜?', '怎么又考这么点?'], ['错题讲解', '这题你当时是怎么想的?讲给我听听。', '这么简单都错?'],
    ['粗心错误', '这一题你其实会,我们想个办法让它不再丢分。', '你就是不认真!'], ['书写练习', '今天这几个字比昨天稳了,尤其是这一个。', '写得还是这么难看。'],
    ['他抗拒时', '你不想写,是太累还是觉得没用?说出来我们商量。', '不写就别玩了!'], ['你情绪上来', '我现在有点急,先停一下,我们十分钟后再聊。', '(直接爆发)']];
  function weekKey() { return kid + '|' + ymd(monday(new Date())); }
  function pTalk() {
    var c = S.talks[weekKey()] || {}, hist = Object.keys(S.talks).filter(function (k) { return k.split('|')[0] == kid; }).sort().reverse().slice(0, 8);
    pv('<div class="card" style="background:#fff3e6"><b>暂停规则</b><br>发现自己要提高音量时,说:"我去倒杯水,两分钟后回来。"然后离开现场。事先和孩子约好:这是规则,不是惩罚。<br><b>看分数前:</b>先深呼吸,不当场评论,说"我看一下,晚点一起聊"。</div>' +
      '<div class="card"><b>可以直接用的句子</b><table><tr><th>场景</th><th>可以说</th><th>避免说</th></tr>' + SCRIPTS.map(function (s) { return '<tr><td>' + s[0] + '</td><td>' + s[1] + '</td><td class="mute">' + s[2] + '</td></tr>'; }).join('') + '</table></div>' +
      '<div class="card"><b>本周 10 分钟谈话</b><p class="mute">问孩子三个问题,把他的原话记下来。让他参与制定计划,执行阻力小。</p>' +
      '<label>这周哪件事你做得比上周好?</label><textarea id="t1">' + esc(c.better) + '</textarea><label>哪件事最难?</label><textarea id="t2">' + esc(c.hardest) + '</textarea>' +
      '<label>下周我能怎么帮你?</label><textarea id="t3">' + esc(c.help) + '</textarea><label>我自己的复盘(这周我哪次做得好/想改)</label><textarea id="t4">' + esc(c.mine) + '</textarea><button onclick="A.saveTalk()">保存</button></div>' +
      (hist.length > 1 ? '<div class="card"><b>往期</b>' + hist.map(function (k) { var h = S.talks[k]; return '<div class="mute" style="margin-top:8px">' + k.split('|')[1] + ':进步「' + esc(h.better) + '」· 最难「' + esc(h.hardest) + '」· 需要「' + esc(h.help) + '」</div>'; }).join('') + '</div>' : ''));
  }
  function pSettings() {
    pv('<div class="card"><b>版本</b><p>当前 ' + esc(CFG.version) + (UPD ? (UPD.has ? ' · 最新 ' + esc(UPD.latest) + '(有更新)' : ' · 已是最新') : '') + '</p>' +
      '<div class="row"><button onclick="A.check()">检查更新</button>' + (UPD && UPD.has ? '<button onclick="A.downloadUpdate()">下载并安装 ' + esc(UPD.latest) + '</button>' : '') + '</div>' +
      '<p class="mute">下载后点开 APK 文件安装即可覆盖更新,打卡数据会保留。首次需允许"安装未知应用"。</p></div>' +
      '<div class="card"><b>修改家长 PIN</b><div class="row"><input id="np" type="password" inputmode="numeric" placeholder="新PIN(至少4位)"><button onclick="A.chPin()">修改</button></div></div>' +
      '<div class="card"><b>备份与恢复</b><p class="mute">数据只存在这部手机里。换手机或重装前,先复制备份文本,发给自己保存;在新手机粘贴即可恢复。</p>' +
      '<button onclick="A.copyBackup()">复制备份文本</button><textarea id="bk" placeholder="恢复时把备份文本粘贴到这里" style="margin-top:8px"></textarea><button class="ghost" onclick="A.restore()">从文本恢复</button></div>');
  }

  // ---------- 动作 ----------
  var A = window.A = {
    pick: function (id) { kid = id; try { localStorage.setItem('fsa_kid', id); } catch (e) { } go('kid'); },
    tap: function (id) { var r = toggle(id); if (r.all) { var p = document.getElementById('party'); p.classList.add('show'); setTimeout(function () { p.classList.remove('show'); }, 1800); } render(); },
    toParent: function () { if (parentOk) { kid = kid || S.kids[0].id; go('parent'); } else go('plogin'); },
    login: function () {
      if (hashPin(document.getElementById('pin').value) === S.pin) { parentOk = true; kid = kid || S.kids[0].id; go('parent'); }
      else document.getElementById('lmsg').textContent = 'PIN不对';
    },
    exitParent: function () { parentOk = false; go('pick'); },
    setKid: function (id) { kid = id; render(); }, setTab: function (t) { tab = t; render(); },
    pause: function () { S.pauses.push(today()); save(); toast('已记录。这周共 ' + stats(kid).pauses7 + ' 次,做得好。'); render(); },
    addM: function () {
      var topic = document.getElementById('m_topic').value.trim(); if (!topic) return toast('请写一下是哪道题');
      S.mistakes.push({ id: S.nextId++, kid: kid, day: document.getElementById('m_day').value || today(), subject: document.getElementById('m_sub').value, type: document.getElementById('m_type').value, topic: topic, note: document.getElementById('m_note').value, fixed: false, redo: 0, streak: 0, next: document.getElementById('m_day').value || today() });
      save(); toast('已保存'); render();
    },
    chType: function (id, t) { S.mistakes.forEach(function (m) { if (m.id === id) m.type = t; }); save(); },
    redo: function (id) { S.mistakes.forEach(function (m) { if (m.id === id) m.redo++; }); save(); render(); },
    fix: function (id) { S.mistakes.forEach(function (m) { if (m.id === id) m.fixed = !m.fixed; }); save(); render(); },
    delM: function (id) { if (confirm('删除这条错题?')) { S.mistakes = S.mistakes.filter(function (m) { return m.id !== id; }); save(); render(); } },
    saveT: function (id) {
      var days = [].slice.call(document.querySelectorAll('.w' + id + ':checked')).map(function (x) { return +x.value; });
      S.tasks.forEach(function (t) { if (t.id === id) { t.name = document.getElementById('n' + id).value.trim() || t.name; t.minutes = +document.getElementById('m' + id).value || 10; t.days = days; t.note = document.getElementById('o' + id).value; } });
      save(); toast('已保存');
    },
    delT: function (id) { if (confirm('删除该任务?')) { S.tasks.forEach(function (t) { if (t.id === id) t.active = false; }); save(); render(); } },
    addT: function () {
      var n = document.getElementById('nn').value.trim(); if (!n) return;
      var days = [].slice.call(document.querySelectorAll('.nw:checked')).map(function (x) { return +x.value; });
      S.tasks.push({ id: S.nextId++, kid: kid, name: n, minutes: +document.getElementById('nm').value || 10, days: days, note: '', active: true, sort: 99 }); save(); render();
    },
    saveProg: function (k) { var v = parseInt(document.getElementById('pg_' + k).value, 10); if (!(v >= 1)) return toast('请填 1 以上的数字'); S.prog[k] = Math.min(v - 1, total(k)); save(); toast('进度已保存'); render(); },
    importM: function () { A.importText(document.getElementById('m_imp').value); },
    importFile: function (inp) {
      var f = inp.files && inp.files[0]; if (!f) return;
      var r = new FileReader();
      r.onload = function () { A.importText(String(r.result || '')); };
      r.onerror = function () { toast('文件读取失败'); };
      r.readAsText(f, 'utf-8');
    },
    importText: function (txt) {
      var v = String(txt || '').replace(/^\uFEFF/, '').trim(), o;
      try { o = JSON.parse(v); } catch (e) { return toast('这不是有效的导入文本'); }
      if (!o || o.fsa !== 'mistakes' || !o.items || !o.items.length) return toast('这不是错题导入文本');
      var k = kid; S.kids.forEach(function (x) { if (x.name === o.kid) k = x.id; });
      var n = 0, skip = 0, upd = 0;
      o.items.forEach(function (it) {
        if (!it || !it.topic) return;
        var day = /^\d{4}-\d{2}-\d{2}$/.test(it.day || '') ? it.day : today();
        var ex = null;
        S.mistakes.forEach(function (m) { if (m.kid === k && m.day === day && m.topic === it.topic) ex = m; });
        if (ex) {
          if (it.q && !ex.q) { ex.q = String(it.q); ex.src = String(it.src || ''); upd++; } else skip++;
          return;
        }
        S.mistakes.push({ id: S.nextId++, kid: k, day: day, subject: SUBJ.indexOf(it.subject) >= 0 ? it.subject : '数学', type: ERR.indexOf(it.type) >= 0 ? it.type : '不会', topic: String(it.topic), note: String(it.note || ''), q: it.q ? String(it.q) : '', src: it.src ? String(it.src) : '', fixed: false, redo: 0, streak: 0, next: day });
        n++;
      });
      save(); toast('已导入 ' + n + ' 条' + (upd ? ',补全原题 ' + upd + ' 条' : '') + (skip ? ',跳过重复 ' + skip + ' 条' : '')); render();
    },
    mk: function (id, ok) {
      S.mistakes.forEach(function (m) {
        if (m.id !== id) return;
        if (ok) {
          m.streak = (m.streak || 0) + 1; m.redo = (m.redo || 0) + 1;
          if (m.streak >= 3) { m.fixed = true; toast('这道题过关了 🎉'); }
          else { m.next = ymd(addDays(new Date(), [1, 3, 7][m.streak - 1])); toast('做对了!过几天再做一次'); }
        } else { m.streak = 0; m.redo = (m.redo || 0) + 1; m.next = ymd(addDays(new Date(), 1)); toast('没关系,明天再做一次'); }
      });
      save(); render();
    },
    saveTalk: function () { var g = function (i) { return document.getElementById(i).value; }; S.talks[weekKey()] = { better: g('t1'), hardest: g('t2'), help: g('t3'), mine: g('t4') }; save(); toast('已保存'); render(); },
    chPin: function () { var v = document.getElementById('np').value; if (v.length < 4) return toast('PIN至少4位'); S.pin = hashPin(v); S.defpin = false; save(); toast('已修改'); render(); },
    check: function () { checkUpdate(true); },
    downloadUpdate: function () { if (UPD) openUrl(UPD.url); },
    copyBackup: function () {
      var txt = JSON.stringify(S), done = function () { toast('已复制,去微信/备忘录里粘贴保存'); };
      if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(txt).then(done, function () { fallbackCopy(txt, done); }); else fallbackCopy(txt, done);
    },
    restore: function () {
      var v = document.getElementById('bk').value.trim(), o;
      try { o = JSON.parse(v); } catch (e) { return toast('这不是有效的备份文本'); }
      if (!o || !o.kids || !o.tasks || !o.checkins) return toast('这不是有效的备份文本');
      if (confirm('用备份覆盖现在手机里的全部数据?')) { S = o; save(); toast('已恢复'); render(); }
    },
    printPlan: function () {
      var k = kidOf(kid), ts = S.tasks.filter(function (t) { return t.kid === kid && t.active; }).sort(function (a, b) { return a.sort - b.sort || a.id - b.id; });
      printHtml(doc(k.name + ' 一周学习安排', '<table><tr><th>任务</th><th>分钟</th>' + WD.map(function (w) { return '<th>周' + w + '</th>'; }).join('') + '</tr>' + ts.map(function (t) {
        return '<tr><td>' + esc(t.name) + '<div class="m">' + esc(t.note) + '</div></td><td>' + t.minutes + '</td>' + [1, 2, 3, 4, 5, 6, 7].map(function (d) { return '<td class="c">' + (t.days.indexOf(d) >= 0 ? '☐' : '') + '</td>'; }).join('') + '</tr>';
      }).join('') + '</table>'), k.name + ' 一周安排');
    },
    printKind: function (kind, idx, ans) {
      var ci2 = null;
      if (kind === 'ci' && (S.prog.zi || 0) < total('zi')) { ci2 = idx; kind = 'zi'; idx = S.prog.zi || 0; }
      else if (kind === 'zi') { var cx = S.prog.ci || 0; if (cx < total('ci')) ci2 = cx; }
      if (idx >= total(kind)) return toast('这一部分已经学完');
      var r = sheetHtml(kind, idx, ans, ci2); if (ci2 != null) r.title = '汉字与词语练习'; printHtml(r.html, r.title);
    },
    printMistakes: function () {
      var k = kidOf(kid), ms = S.mistakes.filter(function (m) { return m.kid === kid && !m.fixed; }).sort(function (a, b) { return a.subject < b.subject ? -1 : 1; });
      printHtml(doc(k.name + ' 待订正错题单(' + today() + ')', '<p class="m">先让孩子讲思路,再自己重做;做对了在「重做」栏打勾。</p><table><tr><th>日期</th><th>科目</th><th>题目/知识点</th><th>类型</th><th class="b">重做①</th><th class="b">重做②</th></tr>' +
        (ms.map(function (m) { return '<tr><td>' + m.day.slice(5) + '</td><td>' + m.subject + '</td><td>' + (m.src ? '<div class="m">' + esc(m.src) + '</div>' : '') + '<div style="white-space:pre-wrap">' + esc(m.q || m.topic) + '</div></td><td>' + m.type + '</td><td></td><td></td></tr>'; }).join('') || '<tr><td colspan="6">没有待订正的错题 🎉</td></tr>') + '</table>'), k.name + ' 错题单');
    }
  };
  window.go = go;
  function fallbackCopy(txt, done) { var t = document.createElement('textarea'); t.value = txt; document.body.appendChild(t); t.select(); try { document.execCommand('copy'); done(); } catch (e) { toast('复制失败'); } document.body.removeChild(t); }
  function doc(title, body) {
    return '<!doctype html><html><head><meta charset="utf-8"><style>body{font:14px/1.5 "Microsoft YaHei",sans-serif;margin:16px}h1{font-size:20px}table{width:100%;border-collapse:collapse}td,th{border:1px solid #888;padding:8px;text-align:left}.c{text-align:center}.m{color:#666;font-size:12px}.b{width:70px}</style></head><body><h1>' + esc(title) + '</h1>' + body + '</body></html>';
  }

  // ---------- 启动 ----------
  load();
  try { var lk = +localStorage.getItem('fsa_kid'); if (lk && kidOf(lk)) kid = lk; } catch (e) { }
  render();
  checkUpdate(false);
})();
