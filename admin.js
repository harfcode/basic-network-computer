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
        for (var f of [statistik, peserta, voucher, kelas, pengaturan, buku]) { try { await f(b); } catch (e) { b.append(C.el('p', { role: 'alert' }, 'Gagal memuat bagian: ' + C.errTxt(e))); } }
      })();
    });
  };
})();
