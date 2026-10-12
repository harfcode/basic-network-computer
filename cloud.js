/* cloud.js : masuk dengan Google, poin, penguncian wilayah, dan sinkronisasi kemajuan.
   Berjalan setelah skrip utama di index.html. Memakai hook global dari skrip utama:
   ST, RAW, QZ, RGI(window.gRGI), go, restore, payload, openOv, closeOv, KEY, I.            */
(function () {
  'use strict';
  var CFG = window.APP_CONFIG || {};
  var KET_TEKS = [
    'Akun Anda adalah akun Google. Kami menyimpan alamat email, nama tampilan, kemajuan belajar, dan riwayat poin Anda.',
    'Poin berlaku tanpa batas waktu, tidak dapat diuangkan, dan tidak ada pengembalian dana atas poin yang sudah diberikan atau dipakai.',
    'Poin diperoleh dari pengelola (pemberian langsung), voucher, atau kode kelas. Nilai satu poin dan harga wilayah dapat diubah pengelola untuk pembelian berikutnya.',
    'Materi wilayah berbayar hanya untuk penggunaan belajar pribadi. Dilarang menyalin atau menyebarkannya.',
    'Jika Anda menghapus akun, kemajuan dan sisa poin hilang dan tidak dapat dipulihkan. Catatan transaksi tetap disimpan tanpa identitas Anda.',
    'Pengelola dapat melihat kemajuan belajar peserta yang tergabung dalam kelas yang sama.'
  ];
  var sb = null, S = {}, W = {}, HAK = {}, PROFIL = null, SALDO = 0, UID = null, TUTUP = false;
  var $ = function (s) { return document.querySelector(s); };

  /* ---------- pembantu DOM (tanpa innerHTML untuk data dari server) ---------- */
  function el(tag, attrs) {
    var e = document.createElement(tag);
    if (attrs) for (var k in attrs) { if (k === 'class') e.className = attrs[k]; else if (k === 'onclick') e.onclick = attrs[k]; else if (attrs[k] !== undefined && attrs[k] !== null) e.setAttribute(k, attrs[k]); }
    for (var i = 2; i < arguments.length; i++) { var c = arguments[i]; if (c == null) continue; e.append(c.nodeType ? c : document.createTextNode(String(c))); }
    return e;
  }
  function btn(t, f, cls) { var b = el('button', { type: 'button', 'class': cls || '' }, t); b.onclick = f; return b; }
  function inp(ph, extra) { var i = el('input', Object.assign({ placeholder: ph, autocomplete: 'off', style: 'width:100%;margin:4px 0' }, extra || {})); return i; }
  function toast(t) { if (typeof window.gToast === 'function') return window.gToast(t); var x = $('#tst'); if (!x) return; x.textContent = t; x.hidden = false; clearTimeout(toast.t); toast.t = setTimeout(function () { x.hidden = true; }, 3500); }
  var fmt = function (n) { return new Intl.NumberFormat('id-ID').format(n); };
  var errTxt = function (e) { var m = e && (e.message || e.error_description || e.msg) || String(e); return m.length > 200 ? m.slice(0, 200) + '…' : m; };

  /* ---------- layar sambutan / masuk ---------- */
  function layar(judul, kids) {
    var wl = $('#wl'), wb = $('#wlb'); wb.innerHTML = '';
    wb.append(el('h2', { id: 'wlt' }, judul));
    kids.forEach(function (k) { wb.append(k); });
    wl.hidden = false;
    if (window.gSetInert) window.gSetInert(true);
    var f = wb.querySelector('input,button'); if (f) f.focus();
  }
  function tutupLayar() { $('#wl').hidden = true; if (window.gSetInert) window.gSetInert(false); }
  function pesanGalat(judul, e, ulang) {
    var k = [el('p', null, errTxt(e))];
    if (ulang) k.push(btn('Coba lagi', ulang, 'o'));
    layar(judul, k);
  }

  function layarMasuk(pesan) {
    var k = [
      el('p', null, 'Selamat datang di Kampus Cakrawala. Anda adalah teknisi jaringan baru. Bersama Alice dan Bob, Anda akan menelusuri enam wilayah kampus dan memecahkan masalah jaringan di setiap wilayah.'),
      el('p', null, 'Masuk dengan akun Google agar kemajuan Anda tersimpan dan dapat dilanjutkan dari perangkat mana pun. Dua wilayah pertama gratis.')
    ];
    if (pesan) k.push(el('p', { role: 'alert', style: 'color:var(--or);font-weight:700' }, pesan));
    k.push(btn('Masuk dengan Google', masukGoogle, 'o'));
    layar('🌐 Petualangan Teknisi Jaringan Kampus', k);
  }
  async function masukGoogle() {
    try {
      var r = await sb.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: location.origin + location.pathname, queryParams: { prompt: 'select_account' } } });
      if (r.error) throw r.error;
    } catch (e) { layarMasuk('Gagal memulai masuk: ' + errTxt(e)); }
  }

  /* ---------- ketentuan ---------- */
  function layarKetentuan(sesudah) {
    var cek = el('input', { type: 'checkbox', id: 'ktj' });
    var lanjut = btn('Setuju dan lanjut', async function () {
      if (!cek.checked) { toast('Centang persetujuan terlebih dahulu.'); return; }
      lanjut.disabled = true;
      try {
        var r = await sb.rpc('setujui_ketentuan', { p_versi: String(S.versi_ketentuan) });
        if (r.error) throw r.error;
        if (!r.data.ok) { toast(r.data.pesan); lanjut.disabled = false; return; }
        PROFIL.ketentuan_versi = String(S.versi_ketentuan);
        sesudah();
      } catch (e) { lanjut.disabled = false; toast('Gagal menyimpan persetujuan: ' + errTxt(e)); }
    }, 'o');
    var ul = el('ul'); KET_TEKS.forEach(function (t) { ul.append(el('li', null, t)); });
    layar('Ketentuan penggunaan (versi ' + S.versi_ketentuan + ')', [ul, el('label', null, cek, ' Saya telah membaca dan menyetujui ketentuan di atas.'), el('p'), lanjut]);
  }

  /* ---------- nama ---------- */
  function layarNama() {
    var u = PROFIL;
    var nama = inp('Nama panggilan Anda', { maxlength: '80', 'aria-label': 'Nama', value: (u.nama || '') });
    var mulai = btn('Mulai bertugas', async function () {
      var n = nama.value.trim().slice(0, 80);
      if (n.length < 2) { toast('Isi nama minimal 2 huruf.'); return; }
      mulai.disabled = true;
      if (n !== u.nama) { var r = await sb.from('profiles').update({ nama: n }).eq('id', UID); if (r.error) { toast('Nama belum tersimpan: ' + errTxt(r.error)); } else u.nama = n; }
      tutupLayar(); window.gBegin(n);
    }, 'o');
    nama.addEventListener('keydown', function (e) { if (e.key === 'Enter') mulai.click(); });
    layar('Halo, calon teknisi!', [el('p', null, 'Masuk sebagai ', el('b', null, u.email), '.'), el('p', null, 'Nama ini akan tampil di papan peringkat kelas dan laporan pengelola.'), nama, el('p'), mulai]);
  }

  /* ---------- kemajuan: gabung dan sinkron ---------- */
  function gabung(a, b) {
    a = a || {}; b = b || {};
    var d = Object.assign({}, a.d, b.d), q = Object.assign({}, b.q, a.q);
    Object.keys(b.q || {}).forEach(function (k) { if (q[k] && b.q[k] && b.q[k].ok && !q[k].ok) q[k] = b.q[k]; });
    var ga = a.g || {}, gb = b.g || {}, inc = Object.assign({}, gb.inc);
    Object.keys(ga.inc || {}).forEach(function (k) { var x = ga.inc[k], y = inc[k]; inc[k] = !y || (x.s || 0) > (y.s || 0) || ((x.s || 0) === (y.s || 0) && (x.t || 0) >= (y.t || 0)) ? x : y; });
    return { v: 2, d: d, q: q, ci: a.ci != null ? a.ci : b.ci, g: { seen: Object.assign({}, gb.seen, ga.seen), inc: inc } };
  }
  var tunda = null, timer = 0, sedang = false;
  window.cloudSave = function (p) { if (!sb || !UID || TUTUP) return; tunda = p; clearTimeout(timer); timer = setTimeout(window.cloudFlush, 6000); };
  window.cloudFlush = async function () {
    if (!sb || !UID || !tunda || sedang || TUTUP) return;
    clearTimeout(timer); var p = tunda; tunda = null; sedang = true;
    try {
      var r = await sb.from('progres').select('data').eq('user_id', UID).maybeSingle();
      var m = gabung(p, r.data && r.data.data);
      if (JSON.stringify(m).length > 55000) throw new Error('Data kemajuan terlalu besar.');
      var w = await sb.from('progres').upsert({ user_id: UID, data: m }, { onConflict: 'user_id' });
      if (w.error) throw w.error;
    } catch (e) { tunda = tunda || p; timer = setTimeout(window.cloudFlush, 20000); }
    sedang = false;
  };
  async function muatKemajuan() {
    var lokal = null; try { lokal = JSON.parse(localStorage.getItem(KEY) || 'null'); } catch (e) {}
    var r = await sb.from('progres').select('data').eq('user_id', UID).maybeSingle();
    if (r.error) throw r.error;
    return gabung(lokal, r.data && r.data.data);
  }

  /* ---------- modul wilayah berbayar ---------- */
  function terapkan(M) {
    for (var id in M.stages) {
      RAW[id] = M.stages[id];
      var i = ST.findIndex(function (s) { return s.id == id; });
      if (i >= 0) ST[i] = Object.assign({}, RAW[id], { core: ST[i].core, id: +id });
    }
    for (var q in (M.qz || {})) QZ[q] = M.qz[q];
    window.__INC = Object.assign(window.__INC || {}, M.inc || {});
  }
  async function muatModul(wid) {
    var w = W[wid]; if (!w || !w.berkas) return;
    var ck = 'simjar-mod:' + UID + ':' + w.berkas, teks = null;
    try { var c = JSON.parse(localStorage.getItem(ck) || 'null'); if (c && c.v === w.versi_modul) teks = c.t; } catch (e) {}
    if (!teks) {
      var r = await sb.storage.from('materi').download(w.berkas);
      if (r.error) throw r.error;
      teks = await r.data.text();
      try { localStorage.setItem(ck, JSON.stringify({ v: w.versi_modul, t: teks })); } catch (e) {}
    }
    (new Function(teks))();
    var M = (window.__MOD || {})[wid]; if (!M) throw new Error('Berkas materi wilayah ' + wid + ' tidak valid.');
    terapkan(M);
  }
  async function muatHak() {
    var r = await sb.from('hak_akses').select('wilayah_id'); if (r.error) throw r.error;
    HAK = {}; r.data.forEach(function (x) { HAK[x.wilayah_id] = 1; });
  }
  async function muatSaldo() { var r = await sb.rpc('saldo_saya'); if (r.error) throw r.error; SALDO = r.data || 0; var sd = $('#sd'); if (sd) sd.textContent = '💰 ' + fmt(SALDO) + ' poin'; }
  async function muatSemuaModul() {
    var wajib = Object.keys(W).filter(function (id) { return W[id].berkas && (HAK[id] || (PROFIL && PROFIL.is_admin)); });
    var gagal = [];
    for (var i = 0; i < wajib.length; i++) { try { await muatModul(+wajib[i]); } catch (e) { gagal.push(W[wajib[i]].nama); } }
    if (gagal.length) toast('Materi belum termuat: ' + gagal.join(', ') + '. Muat ulang halaman.');
  }

  /* ---------- tampilan wilayah terkunci ---------- */
  function wilayahTahap(pos) { return (window.gRGI[pos] || 0) + 1; }
  function sebelumnya(wid) {
    var l = Object.values(W).filter(function (x) { return !x.gratis && x.urutan < W[wid].urutan && !HAK[x.id]; }).sort(function (a, b) { return a.urutan - b.urutan; });
    return l[0] || null;
  }
  async function infoBundel() { var r = await sb.rpc('harga_bundel'); return r.error ? null : r.data; }
  window.lockUI = function () {
    var pos = I, wid = wilayahTahap(pos), w = W[wid]; if (!w) return;
    var R = window.gRegions[wid - 1];
    svg('<g><rect x="190" y="70" width="420" height="280" rx="18" fill="var(--bg)" stroke="var(--bd)" stroke-width="3"/><text x="400" y="150" text-anchor="middle" font-size="56">🔒</text>' +
      '<text x="400" y="200" text-anchor="middle" font-size="22" font-weight="700">' + esc('Wilayah ' + wid + ': ' + w.nama) + '</text>' +
      '<text x="400" y="235" text-anchor="middle" font-size="16">' + esc(fmt(w.harga_poin) + ' poin untuk membuka') + '</text>' +
      '<text x="400" y="275" text-anchor="middle" font-size="15">' + esc('Anda memiliki ' + fmt(SALDO) + ' poin') + '</text></g>');
    var daftar = el('ul'); ST.forEach(function (s, i) { if (window.gRGI[i] + 1 === wid) daftar.append(el('li', null, s.t)); });
    out.innerHTML = ''; out.append(el('p', null, R && R.pl ? R.pl : ''), el('b', null, 'Tahap di wilayah ini:'), daftar);
    var sb1 = sebelumnya(wid), yakin = 0;
    var b1 = B('Buka wilayah ini (' + fmt(w.harga_poin) + ' poin)', async function () {
      if (sb1) { say('Buka wilayah "' + sb1.nama + '" terlebih dahulu.', 'bad'); return; }
      if (!yakin) { yakin = 1; b1.textContent = 'Yakin? Klik lagi untuk membayar ' + fmt(w.harga_poin) + ' poin'; setTimeout(function () { yakin = 0; b1.textContent = 'Buka wilayah ini (' + fmt(w.harga_poin) + ' poin)'; }, 4000); return; }
      b1.disabled = true; await bukaWilayah(wid);
    });
    if (sb1) b1.setAttribute('aria-describedby', 'msg');
    infoBundel().then(function (bi) {
      if (!bi || bi.sisa < 2 || I !== pos) return;
      var y2 = 0, tx = 'Buka semua wilayah berbayar (' + fmt(bi.harga) + ' poin' + (bi.diskon ? ', hemat ' + bi.diskon + '%' : '') + ')';
      var b2 = B(tx, async function () {
        if (!y2) { y2 = 1; b2.textContent = 'Yakin? Klik lagi untuk membayar ' + fmt(bi.harga) + ' poin'; setTimeout(function () { y2 = 0; b2.textContent = tx; }, 4000); return; }
        b2.disabled = true; await bukaBundel();
      });
    });
    B('Tukar voucher / kode', function () { dialogPoin(); });
    if (SALDO < w.harga_poin) say('Poin Anda belum cukup. Tukarkan voucher atau minta poin kepada pengelola kelas.');
  };
  async function sesudahBuka(pesan) {
    await muatHak(); await muatSaldo(); await muatSemuaModul();
    toast(pesan || 'Wilayah terbuka!'); go(I); if (typeof upd === 'function') upd();
  }
  async function bukaWilayah(wid) {
    try {
      var r = await sb.rpc('buka_wilayah', { p_wilayah: wid }); if (r.error) throw r.error;
      if (!r.data.ok) { go(I); say(r.data.pesan, 'bad'); return; }
      await sesudahBuka('Wilayah terbuka. Selamat bertugas!');
    } catch (e) { say('Gagal membuka wilayah: ' + errTxt(e), 'bad'); }
  }
  async function bukaBundel() {
    try {
      var r = await sb.rpc('buka_bundel'); if (r.error) throw r.error;
      if (!r.data.ok) { go(I); say(r.data.pesan, 'bad'); return; }
      await sesudahBuka('Semua wilayah terbuka!');
    } catch (e) { say('Gagal membuka paket: ' + errTxt(e), 'bad'); }
  }

  /* ---------- dialog poin ---------- */
  var JENIS = { manual: 'Pemberian pengelola', bonus: 'Bonus', voucher: 'Tukar voucher', beli_wilayah: 'Buka wilayah', beli_bundel: 'Buka semua wilayah', transfer_keluar: 'Kirim poin', transfer_masuk: 'Terima poin', koreksi: 'Koreksi' };
  async function dialogPoin(pesan) {
    var rb = await sb.from('buku_poin').select('delta,jenis,alasan,dibuat').order('dibuat', { ascending: false }).limit(15);
    await muatSaldo();
    var kelas = null;
    if (PROFIL.kelas_id) { var rk = await sb.from('kelas').select('nama').eq('id', PROFIL.kelas_id).maybeSingle(); kelas = rk.data && rk.data.nama; }
    openOv('💰 Poin saya', function (b) {
      b.append(el('p', null, el('b', { style: 'font-size:22px' }, fmt(SALDO) + ' poin')), el('p', { style: 'color:var(--mu)' }, 'Poin tidak kedaluwarsa, tidak dapat diuangkan, dan tidak ada pengembalian dana. Satu poin setara Rp' + fmt(S.nilai_poin_rp || 0) + ' (nilai acuan pengelola).'));
      if (pesan) b.append(el('p', { role: 'status', style: 'font-weight:700' }, pesan));
      var vk = inp('Kode voucher', { 'aria-label': 'Kode voucher', maxlength: '40' });
      var vb = btn('Tukar voucher', async function () {
        vb.disabled = true;
        try { var r = await sb.rpc('tukar_voucher', { p_kode: vk.value }); if (r.error) throw r.error; await muatSaldo(); dialogPoin(r.data.ok ? 'Berhasil menambah ' + r.data.poin + ' poin.' : r.data.pesan); }
        catch (e) { vb.disabled = false; toast(errTxt(e)); }
      });
      b.append(el('h3', null, 'Tukar voucher'), vk, vb);
      var kk = inp('Kode kelas', { 'aria-label': 'Kode kelas', maxlength: '40' });
      var kb = btn('Gabung kelas', async function () {
        kb.disabled = true;
        try { var r = await sb.rpc('gabung_kelas', { p_kode: kk.value }); if (r.error) throw r.error; if (r.data.ok) PROFIL.kelas_id = r.data.kelas_id || PROFIL.kelas_id; dialogPoin(r.data.pesan || (r.data.ok ? 'Berhasil bergabung.' : 'Gagal.')); }
        catch (e) { kb.disabled = false; toast(errTxt(e)); }
      });
      b.append(el('h3', null, 'Kelas'), el('p', null, kelas ? 'Anda tergabung di kelas: ' + kelas : 'Anda belum tergabung di kelas.'), kk, kb);
      if (S.transfer_aktif === true) {
        var te = inp('Email penerima', { type: 'email', 'aria-label': 'Email penerima' }), tj = inp('Jumlah poin', { type: 'number', min: String(S.transfer_min || 1), 'aria-label': 'Jumlah poin' });
        var tb = btn('Kirim poin', async function () {
          tb.disabled = true;
          try { var r = await sb.rpc('kirim_poin', { p_email: te.value.trim(), p_jumlah: parseInt(tj.value, 10) }); if (r.error) throw r.error; await muatSaldo(); dialogPoin(r.data.pesan || (r.data.ok ? 'Poin terkirim.' : 'Gagal.')); }
          catch (e) { tb.disabled = false; toast(errTxt(e)); }
        });
        b.append(el('h3', null, 'Kirim poin ke peserta lain'), el('p', { style: 'color:var(--mu)' }, 'Ada batas minimal, batas harian, dan masa tahan untuk poin yang baru diterima.'), te, tj, tb);
      }
      b.append(el('h3', null, 'Riwayat terakhir'));
      var ul = el('ul'); ((rb.data) || []).forEach(function (x) { ul.append(el('li', null, (x.delta > 0 ? '+' : '') + x.delta + ' · ' + (JENIS[x.jenis] || x.jenis) + (x.alasan ? ' (' + x.alasan + ')' : '') + ' · ' + new Date(x.dibuat).toLocaleDateString('id-ID'))); });
      b.append(ul.children.length ? ul : el('p', null, 'Belum ada transaksi.'));
      var ket = btn('Baca ketentuan penggunaan', function () { var u = el('ul'); KET_TEKS.forEach(function (t) { u.append(el('li', null, t)); }); openOv('Ketentuan penggunaan', function (bb) { bb.append(u); }); });
      var hp = inp('Ketik HAPUS untuk mengonfirmasi', { 'aria-label': 'Konfirmasi hapus akun' });
      var hb = btn('Hapus akun saya', async function () {
        if (hp.value.trim() !== 'HAPUS') { toast('Ketik HAPUS dengan huruf besar.'); return; }
        hb.disabled = true;
        try { var r = await sb.rpc('hapus_akun_saya'); if (r.error) throw r.error; bersihkan(); await sb.auth.signOut(); location.reload(); }
        catch (e) { hb.disabled = false; toast('Gagal menghapus akun: ' + errTxt(e)); }
      });
      b.append(el('p'), ket, el('h3', null, 'Hapus akun'), el('p', { style: 'color:var(--mu)' }, 'Seluruh kemajuan dan sisa poin akan hilang dan tidak dapat dipulihkan.'), hp, hb);
    });
  }

  /* ---------- keluar ---------- */
  function bersihkan() {
    TUTUP = true; clearTimeout(timer);
    try { Object.keys(localStorage).filter(function (k) { return k.indexOf('simjar-mod:') === 0 || k === KEY; }).forEach(function (k) { localStorage.removeItem(k); }); } catch (e) {}
  }
  window.cloudKeluar = async function () {
    try { await window.cloudFlush(); } catch (e) {}
    bersihkan(); try { await sb.auth.signOut(); } catch (e) {}
    location.reload();
  };

  /* ---------- admin (dimuat hanya untuk admin) ---------- */
  function siapkanAdmin() {
    var a = $('#ad'); if (!a || !PROFIL.is_admin) return; a.hidden = false;
    a.onclick = function () {
      if (window.adminBuka) return window.adminBuka(ctx());
      var s = document.createElement('script'); s.src = 'admin.js'; s.onload = function () { window.adminBuka(ctx()); }; s.onerror = function () { toast('admin.js tidak dapat dimuat.'); }; document.head.append(s);
    };
  }
  function ctx() { return { sb: sb, el: el, btn: btn, inp: inp, toast: toast, openOv: openOv, closeOv: closeOv, fmt: fmt, errTxt: errTxt, pengaturan: S, wilayah: W, refresh: async function () { await muatPengaturan(); } }; }

  /* ---------- awal ---------- */
  async function muatPengaturan() {
    var a = await sb.from('pengaturan').select('kunci,nilai'); if (a.error) throw a.error;
    S = {}; a.data.forEach(function (x) { S[x.kunci] = x.nilai; });
    var b = await sb.from('wilayah').select('id,nama,urutan,gratis,harga_poin,berkas,versi_modul'); if (b.error) throw b.error;
    W = {}; b.data.forEach(function (x) { W[x.id] = x; });
  }
  function emailTerverifikasi(u) {
    if (!u || !u.email || !u.email_confirmed_at) return false;
    var ids = u.identities || [];
    return ids.some(function (i) { return i.provider === 'google' && (!i.identity_data || i.identity_data.email_verified !== false); });
  }
  async function mulai() {
    try {
      var s = await sb.auth.getSession();
      var q = new URLSearchParams(location.search), gal = q.get('error_description');
      if (location.search.indexOf('code=') >= 0 || gal) history.replaceState(null, '', location.pathname);
      if (!s.data.session) return layarMasuk(gal ? 'Masuk dibatalkan: ' + gal : '');
      var u = s.data.session.user;
      if (!emailTerverifikasi(u)) { await sb.auth.signOut(); return layarMasuk('Email akun Anda belum terverifikasi oleh Google. Gunakan akun Google lain.'); }
      UID = u.id; KEY = 'simjar-v3:' + UID;
      var p = await sb.from('profiles').select('id,email,nama,is_admin,kelas_id,ketentuan_versi').eq('id', UID).maybeSingle();
      if (p.error) throw p.error; if (!p.data) throw new Error('Profil belum dibuat. Muat ulang halaman.');
      PROFIL = p.data;
      if (!PROFIL.nama) PROFIL.nama = ((u.user_metadata && (u.user_metadata.full_name || u.user_metadata.name)) || '').slice(0, 80);
      await muatPengaturan();
      var lanjut = async function () {
        try {
          await Promise.all([muatHak(), muatSaldo()]);
          await muatSemuaModul();
          var m = await muatKemajuan(); restore(m);
          var pos = ST.findIndex(function (x) { return x.id == m.ci; }); go(pos >= 0 ? pos : 0);
          siapkanAdmin(); $('#pt').onclick = function () { dialogPoin(); };
          layarNama();
        } catch (e) { pesanGalat('Gagal memuat data', e, lanjut); }
      };
      if (PROFIL.ketentuan_versi !== String(S.versi_ketentuan)) layarKetentuan(lanjut); else lanjut();
    } catch (e) { pesanGalat('Tidak dapat terhubung', e, mulai); }
  }
  function init() {
    if (!CFG.SUPABASE_URL || !CFG.SUPABASE_ANON_KEY || /PROYEK-ANDA|ISI-DENGAN/.test(CFG.SUPABASE_URL + CFG.SUPABASE_ANON_KEY)) {
      return layar('Aplikasi belum dikonfigurasi', [el('p', null, 'Isi SUPABASE_URL dan SUPABASE_ANON_KEY pada berkas config.js (lihat PANDUAN.md).')]);
    }
    if (!window.supabase || !window.supabase.createClient) {
      return layar('Pustaka tidak termuat', [el('p', null, 'Pustaka Supabase gagal dimuat. Periksa koneksi internet lalu muat ulang halaman.')]);
    }
    sb = window.supabase.createClient(CFG.SUPABASE_URL, CFG.SUPABASE_ANON_KEY, { auth: { flowType: 'pkce', detectSessionInUrl: true, persistSession: true, autoRefreshToken: true } });
    window.__CLOUD = { client: sb };
    document.addEventListener('visibilitychange', function () { if (!document.hidden && UID && !TUTUP) { /* gabung kemajuan dari perangkat lain */ muatKemajuan().then(function (m) { restore(gabung(payload(), m)); if (typeof upd === 'function') upd(); }).catch(function () {}); } });
    sb.auth.onAuthStateChange(function (ev) { if (ev === 'SIGNED_OUT' && UID && !TUTUP) { TUTUP = true; location.reload(); } });
    mulai();
  }
  if (window.gReady) init(); else window.addEventListener('load', init);
})();
