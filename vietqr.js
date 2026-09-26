/* Giải mã mã QR thanh toán theo chuẩn EMVCo (VietQR của NAPAS, VNPAY-QR) */
(function (root) {
  'use strict';

  // BIN ngân hàng -> mã ngân hàng (dùng trong deeplink ba=STK@ma) và tên ngắn
  // Nguồn: api.vietqr.io/v2/banks
  const BANKS = {
    '970415': ['icb', 'VietinBank'], '970436': ['vcb', 'Vietcombank'], '970418': ['bidv', 'BIDV'],
    '970405': ['vba', 'Agribank'], '970448': ['ocb', 'OCB'], '970422': ['mb', 'MBBank'],
    '970407': ['tcb', 'Techcombank'], '970416': ['acb', 'ACB'], '970432': ['vpb', 'VPBank'],
    '970423': ['tpb', 'TPBank'], '970403': ['stb', 'Sacombank'], '970437': ['hdb', 'HDBank'],
    '970454': ['vccb', 'Bản Việt'], '970429': ['scb', 'SCB'], '970441': ['vib', 'VIB'],
    '970443': ['shb', 'SHB'], '970431': ['eib', 'Eximbank'], '970426': ['msb', 'MSB'],
    '546034': ['cake', 'CAKE'], '546035': ['ubank', 'Ubank'], '963388': ['timo', 'Timo'],
    '970400': ['sgicb', 'SaigonBank'], '970409': ['bab', 'Bắc Á'], '971025': ['momo', 'MoMo'],
    '970412': ['pvcb', 'PVcomBank'], '971133': ['pvdb', 'PVcomBank Pay'], '970414': ['mbv', 'MBV'],
    '970419': ['ncb', 'NCB'], '970424': ['shbvn', 'Shinhan'], '970425': ['abb', 'ABBANK'],
    '970427': ['vab', 'VietABank'], '970428': ['nab', 'Nam Á'], '970430': ['pgb', 'PGBank'],
    '970433': ['vietbank', 'VietBank'], '970438': ['bvb', 'BaoVietBank'], '970440': ['seab', 'SeABank'],
    '970446': ['coopbank', 'Co-opBank'], '970449': ['lpb', 'LPBank'], '970452': ['klb', 'KienLongBank'],
    '668888': ['kbank', 'KBank'], '422589': ['cimb', 'CIMB'], '970457': ['wvn', 'Woori'],
    '970406': ['vikki', 'Vikki'], '971005': ['vtlmoney', 'Viettel Money'], '971011': ['vnptmoney', 'VNPT Money']
  };

  // App ngân hàng trên iOS có deeplink (api.vietqr.io/v2/ios-app-deeplinks).
  // autofill = app tự điền STK/số tiền khi mở bằng deeplink.
  const APPS = [
    { id: 'mb', name: 'MB Bank', autofill: true },
    { id: 'icb', name: 'VietinBank iPay', autofill: true },
    { id: 'bidv', name: 'BIDV SmartBanking', autofill: true },
    { id: 'acb', name: 'ACB One', autofill: true },
    { id: 'ocb', name: 'OCB OMNI', autofill: true },
    { id: 'vcb', name: 'Vietcombank', autofill: false },
    { id: 'tcb', name: 'Techcombank', autofill: false },
    { id: 'vpb', name: 'VPBank NEO', autofill: false },
    { id: 'tpb', name: 'TPBank Mobile', autofill: false },
    { id: 'vba', name: 'Agribank', autofill: false },
    { id: 'cake', name: 'CAKE', autofill: false },
    { id: 'timo', name: 'Timo', autofill: false },
    { id: 'hdb', name: 'HDBank', autofill: false },
    { id: 'vib-2', name: 'MyVIB', autofill: false },
    { id: 'shb', name: 'SHB SAHA', autofill: false },
    { id: 'lpb', name: 'LPBank', autofill: false },
    { id: 'seab', name: 'SeAMobile', autofill: false },
    { id: 'scb', name: 'SCB Mobile', autofill: false },
    { id: 'eib', name: 'Eximbank EDigi', autofill: false },
    { id: 'shbvn', name: 'Shinhan SOL', autofill: false },
    { id: 'nab', name: 'Nam A Bank', autofill: false },
    { id: 'abb', name: 'ABBank', autofill: false },
    { id: 'pvcb', name: 'PVConnect', autofill: false },
    { id: 'klb', name: 'KienlongBank Plus', autofill: false },
    { id: 'cimb', name: 'OCTO by CIMB', autofill: false }
  ];

  function tlv(str) {
    const out = {};
    let i = 0;
    while (i + 4 <= str.length) {
      const tag = str.substr(i, 2);
      const len = parseInt(str.substr(i + 2, 2), 10);
      if (isNaN(len)) break;
      out[tag] = str.substr(i + 4, len);
      i += 4 + len;
    }
    return out;
  }

  function crc16(s) {
    let crc = 0xFFFF;
    for (let i = 0; i < s.length; i++) {
      crc ^= s.charCodeAt(i) << 8;
      for (let j = 0; j < 8; j++) crc = (crc & 0x8000) ? ((crc << 1) ^ 0x1021) : (crc << 1);
      crc &= 0xFFFF;
    }
    return crc.toString(16).toUpperCase().padStart(4, '0');
  }

  /** Trả về null nếu không phải mã QR thanh toán EMVCo. */
  function parse(raw) {
    if (typeof raw !== 'string') return null;
    const s = raw.trim();
    if (!s.startsWith('000201')) return null;
    const top = tlv(s);
    const res = {
      raw: s,
      type: 'unknown',
      amount: top['54'] ? Math.round(parseFloat(top['54'])) || 0 : 0,
      merchantName: (top['59'] || '').trim(),
      purpose: '',
      crcOk: false
    };
    const crcIdx = s.lastIndexOf('6304');
    if (crcIdx > 0 && s.length === crcIdx + 8) {
      res.crcOk = crc16(s.slice(0, crcIdx + 4)) === s.slice(crcIdx + 4).toUpperCase();
    }
    if (top['62']) {
      const add = tlv(top['62']);
      res.purpose = (add['08'] || '').trim();
    }
    // VietQR chuyển khoản: tag 38, GUID A000000727
    if (top['38']) {
      const m = tlv(top['38']);
      if ((m['00'] || '').toUpperCase() === 'A000000727' && m['01']) {
        const b = tlv(m['01']);
        res.type = 'vietqr';
        res.bin = b['00'] || '';
        res.account = b['01'] || '';
        const bk = BANKS[res.bin];
        res.bankCode = bk ? bk[0] : '';
        res.bankName = bk ? bk[1] : 'Ngân hàng ' + res.bin;
        res.key = res.bin + ':' + res.account;
        return res;
      }
    }
    // QR cửa hàng (VNPAY-QR và tương tự): tag 26..51 với GUID riêng
    for (let t = 26; t <= 51; t++) {
      const v = top[String(t)];
      if (!v) continue;
      const m = tlv(v);
      res.type = 'merchant';
      res.guid = m['00'] || '';
      res.merchantId = m['01'] || '';
      res.key = 'm:' + res.guid + ':' + res.merchantId + ':' + res.merchantName;
      return res;
    }
    return res;
  }

  function deeplink(appId, q, amount) {
    const e = encodeURIComponent;
    let url = 'https://dl.vietqr.io/pay?app=' + e(appId);
    if (q && q.type === 'vietqr' && q.account && q.bankCode) {
      url += '&ba=' + e(q.account) + '@' + e(q.bankCode);
      if (amount > 0) url += '&am=' + Math.round(amount);
      // Giữ đúng nội dung chuyển khoản của mã QR (bên nhận dùng để đối soát)
      const tn = (q.purpose || '').slice(0, 50);
      if (tn) url += '&tn=' + e(tn);
    }
    return url;
  }

  const api = { parse, deeplink, crc16, BANKS, APPS };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.VietQR = api;
})(typeof window !== 'undefined' ? window : globalThis);
