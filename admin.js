/* admin.js : panel pengelola. Dimuat hanya bila profil is_admin = true.
   Keamanan sebenarnya ada di basis data (fungsi admin_* memeriksa is_admin()); berkas ini hanya tampilan. */
(function () {
  'use strict';
  var C;
  function tabel(kolom, baris) {
    var t = C.el('table', { style: 'border-collapse:collapse;width:100%;font-size:14px' }), h = C.el('tr');
    kolom.forEach(function (k) { h.append(C.el('th', { style: 'text-align:left;border-bottom:2px solid var(--bd);padding:4px' }, k)); }); t.append(h);
    baris.forEach(function (r) { var tr = C.el('tr'); r.forEach(function (c) { tr.append(C.el('td', { style: 'border-bottom:1px solid var(--bd);padding:4px;word-break:break-word' }, c == null ? '' : c)); }); t.append(tr); });
    return C.el('div', { style: 'overflow-x:auto' }, t);
  }
  function csvSel(v) { v = v == null ? '' : String(v); if (/^[=+\-@\t\r]/.test(v)) v = "'" + v; return '"' + v.replace(/"/g, '""') + '"'; }
  function unduh(nama, kolom, baris) {
    var teks = '﻿' + [kolom].concat(baris).map(function (r) { return r.map(csvSel).join(','); }).join('\r\n');
    var a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([teks], { type: 'text/csv;charset=utf-8' })); a.download = nama; document.body.append(a); a.click(); a.remove();
    setTimeout(function () { URL.revokeObjectURL(a.href); }, 2000);
  }
  async function rpc(n, a) { var r = await C.sb.rpc(n, a); if (r.error) throw r.error; return r.data; }
  function aman(f) { return async function () { try { await f.apply(null, arguments); } catch (e) { C.toast(C.errTxt(e)); } }; }
  function bagian(b, judul) { b.append(C.el('h3', { style: 'margin:18px 0 6px' }, judul)); }

  async function statistik(b) {
    var s = await rpc('admin_statistik'), w = C.wilayah;
    bagian(b, 'Ringkasan');
    var per = Object.keys(s.hak_per_wilayah || {}).map(function (k) { return (w[k] ? w[k].nama : k) + ': ' + s.hak_per_wilayah[k]; }).join('; ') || '-';
    b.append(tabel(['Ukuran', 'Nilai'], [
      ['Peserta', s.peserta], ['Baru 7 hari', s.baru_7_hari], ['Poin beredar', C.fmt(s.poin_beredar)], ['Poin masuk', C.fmt(s.poin_masuk)],
      ['Poin terpakai', C.fmt(s.poin_terpakai)], ['Nilai terpakai (Rp, sesuai nilai saat transaksi)', C.fmt(s.pendapatan_terpakai_rp)],
      ['Voucher terbit / ditukar', s.voucher_terbit + ' / ' + s.voucher_ditukar], ['Peserta membuka wilayah berbayar pertama', s.konversi_persen + '%'], ['Wilayah dibuka', per]]));
  }

  /* ---------- analitik kelas ---------- */
  function gayaAdmin() {
    if (document.getElementById('gaya-admin')) return;
    var st = document.createElement('style'); st.id = 'gaya-admin';
    st.textContent = [
      '.ak{display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:8px;margin:8px 0}',
      '.ak div{border:1px solid var(--bd);border-radius:10px;padding:8px 10px;background:var(--bg)}',
      '.ak b{display:block;font-size:26px;line-height:1.1}.ak span{font-size:13px;color:var(--mu)}',
      '.ab-g{margin:12px 0 2px;font-weight:700;font-size:13px;color:var(--mu);border-bottom:1px solid var(--bd)}',
      '.ab-r{display:grid;grid-template-columns:minmax(120px,40%) 1fr 92px;gap:8px;align-items:center;margin:3px 0;font-size:13px}',
      '.ab-t{height:10px;background:rgba(127,127,127,.2);border-radius:2px}',
      '.ab-t i{display:block;height:100%;background:var(--ac);border-radius:0 4px 4px 0;min-width:2px}',
      '.ab-t i.nol{display:none}.ab-v{text-align:right;font-variant-numeric:tabular-nums;white-space:nowrap}',
      '@media(max-width:520px){.ab-r{grid-template-columns:1fr 96px}.ab-l{grid-column:1/-1}.ab-t{grid-column:1}}',
      'details.ab-d{margin:6px 0}details.ab-d summary{cursor:pointer;color:var(--mu);font-size:13px}'
    ].join('\n');
    document.head.append(st);
  }
  function batang(items) {
    var w = C.el('div', { role: 'list' });
    items.forEach(function (it) {
      if (it.grup) { w.append(C.el('div', { 'class': 'ab-g' }, it.grup)); return; }
      var pct = it.maks > 0 ? Math.max(0, Math.min(100, it.nilai * 100 / it.maks)) : 0;
      w.append(C.el('div', { 'class': 'ab-r', role: 'listitem', title: it.tip || '' }, C.el('span', { 'class': 'ab-l' }, it.label),
        C.el('span', { 'class': 'ab-t', 'aria-hidden': 'true' }, C.el('i', { 'class': pct ? '' : 'nol', style: 'width:' + pct + '%' })), C.el('span', { 'class': 'ab-v' }, it.teks)));
    });
    return w;
  }
  function tabelDetail(judul, kolom, baris) { return C.el('details', { 'class': 'ab-d' }, C.el('summary', null, 'Lihat ' + judul + ' sebagai tabel'), tabel(kolom, baris)); }
  function judulTahap(id) { var i = typeof ST !== 'undefined' ? ST.findIndex(function (x) { return x.id == id; }) : -1; return i >= 0 ? (i + 1) + '. ' + ST[i].t.replace(/^\d+\. /, '') : 'Tahap ' + id; }

  async function analitik(b) {
    gayaAdmin(); bagian(b, 'Analitik kelas');
    var pil = C.el('select', { 'aria-label': 'Pilih kelas untuk analitik' }, C.el('option', { value: '' }, 'Semua peserta')), isi = C.el('div', { 'aria-live': 'polite' });
    var rk = await C.sb.from('kelas').select('id,nama').order('dibuat', { ascending: false }); (rk.data || []).forEach(function (k) { pil.append(C.el('option', { value: k.id }, k.nama)); });
    async function muat() {
      isi.textContent = 'Memuat…';
      var a = await rpc('admin_analitik', { p_kelas: pil.value || null }); isi.innerHTML = '';
      if (!a.peserta) { isi.append(C.el('p', null, 'Belum ada peserta di pilihan ini.')); return; }
      var P = a.peserta, total = typeof ST !== 'undefined' ? ST.length : 29;
      isi.append(C.el('div', { 'class': 'ak' },
        C.el('div', null, C.el('b', null, P), C.el('span', null, 'peserta')),
        C.el('div', null, C.el('b', null, a.aktif_7_hari + ' (' + Math.round(a.aktif_7_hari * 100 / P) + '%)'), C.el('span', null, 'aktif 7 hari terakhir')),
        C.el('div', null, C.el('b', null, a.rata_tahap), C.el('span', null, 'rata-rata tahap selesai dari ' + total)),
        C.el('div', null, C.el('b', null, a.sertifikat), C.el('span', null, 'sertifikat terbit'))));
      // 1. kemajuan per tahap, dikelompokkan seperti navigasi
      var items = [], tb = [];
      (typeof PH !== 'undefined' ? PH : [['Semua tahap', ST.map(function (x) { return x.id; })]]).forEach(function (g) {
        items.push({ grup: g[0] });
        g[1].forEach(function (id) { var n = a.tahap[id] || 0, jd = judulTahap(id); items.push({ label: jd, nilai: n, maks: P, teks: n + ' (' + Math.round(n * 100 / P) + '%)', tip: jd + ': ' + n + ' dari ' + P + ' peserta' }); tb.push([jd, n, Math.round(n * 100 / P) + '%']); });
      });
      isi.append(C.el('h4', null, 'Peserta yang menyelesaikan tiap tahap'), batang(items), tabelDetail('kemajuan per tahap', ['Tahap', 'Selesai', 'Persen'], tb));
      // 2. soal tersulit
      var ks = Object.keys(a.kuis).map(function (id) { var x = a.kuis[id]; return { id: id, b: x.b, t: x.t, p: x.t ? x.b * 100 / x.t : 0 }; }).filter(function (x) { return x.t >= Math.min(3, P); }).sort(function (x, y) { return x.p - y.p || y.t - x.t; });
      isi.append(C.el('h4', null, 'Kuis yang paling banyak dijawab salah (perlu dibahas ulang)'));
      if (!ks.length) isi.append(C.el('p', null, 'Belum cukup jawaban kuis (minimal 3 jawaban per tahap).'));
      else { var sulit = ks.slice(0, 8); isi.append(batang(sulit.map(function (x) { var jd = judulTahap(x.id); return { label: jd, nilai: x.p, maks: 100, teks: Math.round(x.p) + '% (' + x.b + '/' + x.t + ')', tip: jd + ': ' + x.b + ' benar dari ' + x.t + ' jawaban' }; })),
        tabelDetail('kuis', ['Tahap', 'Benar', 'Dijawab', 'Persen benar'], ks.map(function (x) { return [judulTahap(x.id), x.b, x.t, Math.round(x.p) + '%']; }))); }
      // 3. sebaran kemajuan
      var seb = a.sebaran.map(function (x) { var sd = Math.min(x.dari + 4, total); return { label: x.dari + '–' + sd + ' tahap selesai', nilai: x.n, maks: P, teks: x.n + ' orang', tip: x.n + ' peserta menyelesaikan ' + x.dari + '–' + sd + ' tahap' }; });
      isi.append(C.el('h4', null, 'Sebaran kemajuan peserta'), batang(seb));
      // 4. wilayah
      var wb = [], regNama = (typeof REG !== 'undefined') ? REG : [];
      Object.keys(C.wilayah).map(Number).sort(function (x, y) { return x - y; }).forEach(function (id) {
        var w = C.wilayah[id], dibuka = w.gratis ? P : (a.wilayah[id] || 0), ins = a.insiden[id - 1] || 0;
        wb.push([id + '. ' + w.nama, w.gratis ? 'gratis' : dibuka + ' (' + Math.round(dibuka * 100 / P) + '%)', ins + ' (' + Math.round(ins * 100 / P) + '%)']);
      });
      isi.append(C.el('h4', null, 'Wilayah dibuka dan insiden diselesaikan'), tabel(['Wilayah', 'Dibuka', 'Insiden selesai'], wb));
      // 5. tertinggal
      isi.append(C.el('h4', null, 'Peserta yang belum aktif 7 hari atau lebih (maks. 50)'));
      if (!a.tertinggal.length) isi.append(C.el('p', null, 'Tidak ada. Semua peserta aktif dalam 7 hari terakhir.'));
      else {
        var tr = a.tertinggal.map(function (x) { return [x.nama, x.email, x.tahap, x.diubah ? new Date(x.diubah).toLocaleDateString('id-ID') : 'belum pernah']; });
        isi.append(tabel(['Nama', 'Email', 'Tahap selesai', 'Terakhir aktif'], tr), C.btn('Unduh CSV peserta tertinggal', function () { unduh('peserta-tertinggal.csv', ['nama', 'email', 'tahap_selesai', 'terakhir_aktif'], tr); }));
      }
    }
    pil.onchange = aman(muat); b.append(pil, isi); await muat();
  }

  async function sertifikatAdmin(b) {
    bagian(b, 'Sertifikat');
    var d = (await C.sb.rpc('admin_daftar_sertifikat')); if (d.error) throw d.error; var baris = d.data || [];
    var br = baris.map(function (x) { return [x.kode, x.nama, x.email, x.kelas, x.skor + '%', new Date(x.diterbitkan).toLocaleDateString('id-ID'), x.dicabut ? 'DICABUT' : 'sah']; });
    b.append(baris.length ? tabel(['Kode', 'Nama', 'Email', 'Kelas', 'Skor', 'Terbit', 'Status'], br) : C.el('p', null, 'Belum ada sertifikat yang diterbitkan.'));
    if (baris.length) b.append(C.btn('Unduh CSV sertifikat', function () { unduh('sertifikat.csv', ['kode', 'nama', 'email', 'kelas', 'skor', 'terbit', 'status'], br); }));
    var kd = C.inp('Kode sertifikat', { 'aria-label': 'Kode sertifikat' }), al = C.inp('Alasan pencabutan (wajib)', { 'aria-label': 'Alasan pencabutan' });
    var cb = C.btn('Cabut', aman(async function () { var r = await rpc('admin_set_sertifikat_cabut', { p_kode: kd.value, p_cabut: true, p_alasan: al.value }); C.toast(r.ok ? 'Sertifikat dicabut.' : r.pesan); }));
    var pb = C.btn('Pulihkan', aman(async function () { var r = await rpc('admin_set_sertifikat_cabut', { p_kode: kd.value, p_cabut: false, p_alasan: null }); C.toast(r.ok ? 'Sertifikat dipulihkan.' : r.pesan); }));
    b.append(C.el('h4', null, 'Cabut atau pulihkan sertifikat'), kd, al, cb, pb);
  }

  async function peserta(b) {
    bagian(b, 'Peserta dan pemberian poin');
    var q = C.inp('Cari nama atau email', { 'aria-label': 'Cari peserta' }), hasil = C.el('div');
    var cari = C.btn('Cari', aman(async function () {
      var d = await rpc('admin_cari_peserta', { p_q: q.value.trim() }); hasil.innerHTML = '';
      hasil.append(tabel(['Nama', 'Email', 'Kelas', 'Saldo', 'Tahap selesai'], d.map(function (r) { return [r.nama, r.email, r.kelas, r.saldo, r.tahap_selesai]; })));
      hasil.append(C.btn('Unduh CSV', function () { unduh('peserta.csv', ['nama', 'email', 'kelas', 'saldo', 'tahap_selesai', 'dibuat'], d.map(function (r) { return [r.nama, r.email, r.kelas, r.saldo, r.tahap_selesai, r.dibuat]; })); }));
    }));
    var em = C.inp('Email peserta', { type: 'email', 'aria-label': 'Email peserta' }), jm = C.inp('Jumlah poin (negatif = koreksi)', { type: 'number', 'aria-label': 'Jumlah poin' }), al = C.inp('Alasan (wajib, min. 5 huruf)', { 'aria-label': 'Alasan' });
    var kirim = C.btn('Tambah / koreksi poin', aman(async function () {
      var r = await rpc('admin_tambah_poin', { p_email: em.value.trim(), p_delta: parseInt(jm.value, 10), p_alasan: al.value });
      C.toast(r.ok ? 'Tersimpan. Saldo baru: ' + r.saldo : r.pesan);
    }));
    b.append(q, cari, hasil, C.el('h4', null, 'Pemberian poin manual'), em, jm, al, kirim);
  }
  async function voucher(b) {
    bagian(b, 'Voucher');
    var n = C.inp('Jumlah kode (1-200)', { type: 'number', 'aria-label': 'Jumlah kode' }), p = C.inp('Poin per kode', { type: 'number', 'aria-label': 'Poin per kode' }), ct = C.inp('Catatan (mis. Angkatan 2026)', { 'aria-label': 'Catatan' });
    var kl = C.el('select', { 'aria-label': 'Batasi ke kelas' }, C.el('option', { value: '' }, 'Semua peserta')), hasil = C.el('div');
    var rk = await C.sb.from('kelas').select('id,nama,kode').order('dibuat', { ascending: false }); (rk.data || []).forEach(function (k) { kl.append(C.el('option', { value: k.id }, k.nama)); });
    var buat = C.btn('Buat voucher', aman(async function () {
      var d = await rpc('admin_buat_voucher', { p_jumlah: parseInt(n.value, 10), p_poin: parseInt(p.value, 10), p_kelas: kl.value || null, p_catatan: ct.value || null });
      hasil.innerHTML = ''; hasil.append(C.el('p', null, d.length + ' kode dibuat. Simpan sekarang:'), C.el('textarea', { rows: '6', style: 'width:100%', readonly: 'readonly', 'aria-label': 'Kode voucher' }, d.join('\n')),
        C.btn('Unduh CSV', function () { unduh('voucher.csv', ['kode', 'poin', 'catatan'], d.map(function (k) { return [k, p.value, ct.value]; })); }));
    }));
    var bk = C.inp('Kode voucher yang dibatalkan', { 'aria-label': 'Kode dibatalkan' });
    var bt = C.btn('Batalkan voucher', aman(async function () { var r = await rpc('admin_batalkan_voucher', { p_kode: bk.value }); C.toast(r.pesan || (r.ok ? 'Dibatalkan.' : 'Gagal.')); }));
    b.append(n, p, ct, kl, buat, hasil, C.el('h4', null, 'Batalkan'), bk, bt);
  }
  async function kelas(b) {
    bagian(b, 'Kelas');
    var daftar = C.el('div'), nm = C.inp('Nama kelas baru', { 'aria-label': 'Nama kelas' }), prog = C.el('div');
    async function muat() {
      var r = await C.sb.from('kelas').select('id,nama,kode').order('dibuat', { ascending: false }); if (r.error) throw r.error; daftar.innerHTML = '';
      r.data.forEach(function (k) {
        daftar.append(C.el('p', null, C.el('b', null, k.nama), ' · kode kelas: ', C.el('code', null, k.kode), ' ', C.btn('Lihat kemajuan', aman(async function () {
          var d = await rpc('admin_progres_kelas', { p_kelas: k.id }); prog.innerHTML = '';
          var br = d.map(function (x) { return [x.nama, x.email, x.tahap_selesai, x.skor_benar + '/' + x.skor_total, x.wilayah_dibuka, x.diubah ? new Date(x.diubah).toLocaleString('id-ID') : '']; });
          prog.append(C.el('h4', null, 'Kemajuan: ' + k.nama), tabel(['Nama', 'Email', 'Tahap selesai', 'Skor', 'Wilayah dibuka', 'Terakhir'], br), C.btn('Unduh CSV', function () { unduh('kelas-' + k.nama + '.csv', ['nama', 'email', 'tahap_selesai', 'skor', 'wilayah_dibuka', 'terakhir'], br); }));
        }))));
      });
    }
    var buat = C.btn('Buat kelas', aman(async function () { var d = await rpc('admin_buat_kelas', { p_nama: nm.value }); C.toast('Kelas dibuat. Kode: ' + d.kode); nm.value = ''; await muat(); }));
    b.append(nm, buat, daftar, prog); await muat();
  }
  async function pengaturan(b) {
    bagian(b, 'Pengaturan'); var S = C.pengaturan, W = C.wilayah;
    function baris(k, label, tipe) {
      var i = tipe === 'bool' ? C.el('select', { 'aria-label': label }, C.el('option', { value: 'false' }, 'Mati'), C.el('option', { value: 'true' }, 'Hidup')) : C.inp(label, { type: tipe === 'str' ? 'text' : 'number', 'aria-label': label });
      i.value = String(S[k]); var tb = C.btn('Simpan', aman(async function () {
        var v = tipe === 'bool' ? i.value === 'true' : tipe === 'str' ? i.value : parseInt(i.value, 10);
        await rpc('admin_set_pengaturan', { p_kunci: k, p_nilai: v }); await C.refresh(); C.toast('Tersimpan.');
      }));
      b.append(C.el('label', null, label), i, tb);
    }
    baris('nilai_poin_rp', 'Nilai satu poin (Rupiah)', 'num'); baris('bundel_diskon_persen', 'Diskon paket semua wilayah (%)', 'num');
    baris('transfer_aktif', 'Pemindahan poin antarpeserta', 'bool'); baris('transfer_min', 'Pemindahan: minimal poin', 'num'); baris('transfer_maks_harian', 'Pemindahan: maksimal poin per hari', 'num'); baris('transfer_tahan_jam', 'Pemindahan: masa tahan poin baru (jam)', 'num');
    baris('versi_ketentuan', 'Versi ketentuan (ubah = semua peserta diminta menyetujui ulang)', 'str');
    baris('sertifikat_min_skor', 'Sertifikat: persen jawaban kuis benar minimal', 'num'); baris('sertifikat_penerbit', 'Sertifikat: nama penerbit (tercetak pada sertifikat baru)', 'str'); baris('sertifikat_penandatangan', 'Sertifikat: nama penandatangan (boleh kosong)', 'str');
    b.append(C.el('h4', null, 'Harga wilayah (poin) dan versi berkas'));
    Object.keys(W).map(Number).sort().forEach(function (id) {
      var w = W[id]; if (w.gratis) { b.append(C.el('p', null, 'Wilayah ' + id + ' ' + w.nama + ': gratis')); return; }
      var h = C.inp('Harga', { type: 'number', 'aria-label': 'Harga ' + w.nama }), v = C.inp('Versi berkas', { 'aria-label': 'Versi ' + w.nama }); h.value = w.harga_poin; v.value = w.versi_modul || '';
      b.append(C.el('label', null, 'Wilayah ' + id + ' ' + w.nama), h, v, C.btn('Simpan', aman(async function () { await rpc('admin_set_wilayah', { p_id: id, p_harga: parseInt(h.value, 10), p_versi: v.value }); await C.refresh(); C.toast('Tersimpan.'); })));
    });
  }
  async function buku(b) {
    bagian(b, 'Buku poin dan log admin');
    var hasil = C.el('div');
    b.append(C.btn('Tampilkan 200 transaksi terakhir', aman(async function () {
      var r = await C.sb.from('buku_poin').select('dibuat,user_id,delta,jenis,alasan,nilai_rp_per_poin').order('id', { ascending: false }).limit(200); if (r.error) throw r.error;
      var br = r.data.map(function (x) { return [new Date(x.dibuat).toLocaleString('id-ID'), x.user_id ? x.user_id.slice(0, 8) : '(akun dihapus)', x.delta, x.jenis, x.alasan, x.nilai_rp_per_poin]; });
      hasil.innerHTML = ''; hasil.append(tabel(['Waktu', 'Pengguna', 'Poin', 'Jenis', 'Alasan', 'Rp/poin'], br), C.btn('Unduh CSV', function () { unduh('buku-poin.csv', ['waktu', 'pengguna', 'poin', 'jenis', 'alasan', 'rp_per_poin'], br); }));
    })), C.btn('Unduh seluruh buku poin (CSV)', aman(async function () {
      var semua = [], dari = 0;
      for (;;) { var r = await C.sb.from('buku_poin').select('id,dibuat,user_id,delta,jenis,alasan,nilai_rp_per_poin').order('id').range(dari, dari + 999); if (r.error) throw r.error; semua = semua.concat(r.data); if (r.data.length < 1000) break; dari += 1000; }
      unduh('buku-poin-lengkap.csv', ['id', 'waktu', 'pengguna', 'poin', 'jenis', 'alasan', 'rp_per_poin'], semua.map(function (x) { return [x.id, x.dibuat, x.user_id, x.delta, x.jenis, x.alasan, x.nilai_rp_per_poin]; }));
    })), C.btn('Log tindakan admin', aman(async function () {
      var r = await C.sb.from('log_admin').select('*').order('id', { ascending: false }).limit(100); if (r.error) throw r.error;
      hasil.innerHTML = ''; hasil.append(C.el('pre', { style: 'white-space:pre-wrap;font-size:13px' }, r.data.map(function (x) { return JSON.stringify(x); }).join('\n')));
    })), hasil);
  }
  window.adminBuka = function (ctx) {
    C = ctx;
    C.openOv('🛠️ Panel pengelola', function (b) {
      b.append(C.el('p', { style: 'color:var(--mu)' }, 'Setiap perubahan dicatat di log admin. Unduh buku poin (CSV) secara berkala sebagai cadangan.'));
      (async function () {
        for (var f of [statistik, analitik, sertifikatAdmin, peserta, voucher, kelas, pengaturan, buku]) { try { await f(b); } catch (e) { b.append(C.el('p', { role: 'alert' }, 'Gagal memuat bagian: ' + C.errTxt(e))); } }
      })();
    });
  };
})();
