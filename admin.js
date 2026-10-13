/* admin.js : panel pengelola. Dimuat hanya bila profil is_admin = true.
   Keamanan sebenarnya ada di basis data (fungsi admin_* memeriksa is_admin()); berkas ini hanya tampilan. */
(function () {
  'use strict';
  var C, B, tabel, unduh, rpc, aman, bagian, batang, tabelDetail, judulTahap;
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
  async function analitik(b) {
    B.gaya(); bagian(b, 'Analitik kelas');
    var pil = C.el('select', { 'aria-label': 'Pilih kelas untuk analitik' }, C.el('option', { value: '' }, 'Semua peserta')), isi = C.el('div', { 'aria-live': 'polite' });
    var rk = await C.sb.from('kelas').select('id,nama').order('dibuat', { ascending: false }); (rk.data || []).forEach(function (k) { pil.append(C.el('option', { value: k.id }, k.nama)); });
    async function muat() { isi.textContent = 'Memuat…'; B.tampilAnalitik(isi, await rpc('admin_analitik', { p_kelas: pil.value || null })); }
    pil.onchange = aman(muat); b.append(pil, isi); await muat();
  }

  /* ---------- guru ---------- */
  async function guruAdmin(b) {
    bagian(b, 'Guru'); var w = C.el('div'); b.append(w);
    async function muat() {
      var d = await rpc('admin_daftar_guru', {}); w.innerHTML = '';
      var tunggu = d.filter(function (x) { return x.diminta; }), aktif = d.filter(function (x) { return x.peran === 'guru'; });
      w.append(C.el('h4', null, 'Permintaan menjadi guru (' + tunggu.length + ')'));
      if (!tunggu.length) w.append(C.el('p', null, 'Tidak ada permintaan yang menunggu.'));
      tunggu.forEach(function (x) {
        w.append(C.el('p', null, C.el('b', null, x.nama || '(tanpa nama)'), ' · ' + x.email + ' · ' + (x.diminta_pada ? new Date(x.diminta_pada).toLocaleDateString('id-ID') : ''), ' ',
          C.btn('Setujui', aman(async function () { var r = await rpc('admin_set_guru', { p_id: x.id, p_jadi: true }); C.toast(r.ok ? 'Disetujui.' : r.pesan); await muat(); })),
          C.btn('Tolak', aman(async function () { var r = await rpc('admin_set_guru', { p_id: x.id, p_jadi: false }); C.toast(r.ok ? 'Ditolak.' : r.pesan); await muat(); }))));
      });
      w.append(C.el('h4', null, 'Guru aktif (' + aktif.length + ')'));
      if (!aktif.length) w.append(C.el('p', null, 'Belum ada guru.'));
      aktif.forEach(function (x) {
        w.append(C.el('p', null, C.el('b', null, x.nama || '(tanpa nama)'), ' · ' + x.email + ' · ' + x.kelas + ' kelas ',
          C.btn('Cabut peran guru', aman(async function () { var r = await rpc('admin_set_guru', { p_id: x.id, p_jadi: false }); C.toast(r.ok ? 'Peran dicabut.' : r.pesan); await muat(); }))));
      });
    }
    await muat();
  }
  async function diskonAdmin(b) {
    bagian(b, 'Pengajuan diskon pasca-tes'); var w = C.el('div'); b.append(w);
    async function muat() {
      var d = await rpc('admin_daftar_diskon', {}); w.innerHTML = '';
      if (!d.length) { w.append(C.el('p', null, 'Belum ada pengajuan.')); return; }
      d.forEach(function (x) {
        var p = C.el('p', null, C.el('b', null, x.kelas), ' · guru: ' + x.guru + ' · diminta ' + x.persen_diminta + '% · "' + x.alasan + '" · ' + (x.status === 'menunggu' ? 'MENUNGGU' : x.status + (x.persen_disetujui != null ? ' (' + x.persen_disetujui + '%)' : '')) + ' · ' + new Date(x.dibuat).toLocaleDateString('id-ID'));
        if (x.status === 'menunggu') {
          var ps = C.inp('%', { type: 'number', min: '0', max: '100', 'aria-label': 'Persen disetujui untuk ' + x.kelas }); ps.value = x.persen_diminta; ps.style.width = '80px';
          p.append(C.el('br'), ps, C.btn('Setujui', aman(async function () { var r = await rpc('admin_putuskan_diskon', { p_id: x.id, p_setuju: true, p_persen: parseInt(ps.value, 10) }); C.toast(r.ok ? 'Disetujui.' : r.pesan); await muat(); })),
            C.btn('Tolak', aman(async function () { var r = await rpc('admin_putuskan_diskon', { p_id: x.id, p_setuju: false, p_persen: null }); C.toast(r.ok ? 'Ditolak.' : r.pesan); await muat(); })));
        }
        w.append(p);
      });
    }
    await muat();
  }

  /* ---------- bank soal dan paket bawaan ---------- */
  async function paketBawaan(b) {
    bagian(b, 'Paket tes bawaan (siswa mandiri dan kelas yang belum menyusun paket sendiri)');
    var bank = await rpc('guru_bank_soal', {}), info = await rpc('admin_tes_bawaan', {});
    b.append(B.editorPaket({ bank: bank, info: info, jadwal: false, simpan: function (pra, pasca, acak, praAktif) { return rpc('admin_simpan_tes_bawaan', { p_pra: pra, p_pasca: pasca, p_acak: acak, p_pra_aktif: praAktif }); } }));
  }
  async function bankSoal(b) {
    bagian(b, 'Bank soal'); B.gaya();
    var w = C.el('div'); b.append(C.el('p', { style: 'color:var(--mu)' }, 'Pilihan jawaban diacak untuk tiap siswa, jadi tulis tiap pilihan berdiri sendiri (jangan "semua benar", "A dan B", dst.). Soal yang dinonaktifkan tidak muncul bagi guru.'), w);
    var tujuan = await rpc('daftar_tujuan_tes', {});
    async function muat() {
      var d = await rpc('admin_daftar_soal', {}); w.innerHTML = '';
      w.append(C.btn('+ Tambah soal', function () { form(null); }));
      var per = {}; d.forEach(function (s) { (per[s.tujuan] = per[s.tujuan] || []).push(s); });
      tujuan.forEach(function (t) {
        var det = C.el('details', { 'class': 'pk-g' }, C.el('summary', null, t.id + '. ' + t.nama + ' (' + (per[t.id] || []).length + ' soal)'));
        (per[t.id] || []).forEach(function (s) {
          det.append(C.el('div', { 'class': 'pk-s' }, C.el('div', null, '#' + s.id + (s.aktif ? ' ' : ' [NONAKTIF] ') + s.teks, C.el('small', null, s.pilihan.map(function (o, i) { return (i === s.kunci ? '✓ ' : '· ') + o; }).join('  |  '))), C.btn('Sunting', function () { form(s); })));
        });
        w.append(det);
      });
    }
    function form(s) {
      var tj = C.el('select', { 'aria-label': 'Tujuan belajar' }); tujuan.forEach(function (t) { tj.append(C.el('option', { value: t.id }, t.id + '. ' + t.nama)); }); tj.value = s ? s.tujuan : tujuan[0].id;
      var tk = C.el('textarea', { rows: '3', style: 'width:100%', 'aria-label': 'Teks soal', maxlength: '400' }); tk.value = s ? s.teks : '';
      var op = [], rd = [], baris = C.el('div');
      for (var i = 0; i < 5; i++) {
        (function (i) {
          var o = C.inp('Pilihan ' + (i + 1) + (i < 3 ? ' (wajib)' : ' (opsional)'), { 'aria-label': 'Pilihan ' + (i + 1), maxlength: '200' }); o.value = s && s.pilihan[i] ? s.pilihan[i] : '';
          var r = C.el('input', { type: 'radio', name: 'kunci-soal', 'aria-label': 'Pilihan ' + (i + 1) + ' adalah kunci' }); if (s ? s.kunci === i : i === 0) r.checked = true;
          op.push(o); rd.push(r); baris.append(C.el('div', { style: 'display:flex;gap:6px;align-items:center' }, r, o));
        })(i);
      }
      var pb = C.el('textarea', { rows: '2', style: 'width:100%', 'aria-label': 'Pembahasan', maxlength: '600' }); pb.value = s ? s.pembahasan : '';
      var ak = C.el('input', { type: 'checkbox' }); ak.checked = s ? s.aktif : true;
      C.openOv(s ? 'Sunting soal #' + s.id : 'Tambah soal', function (bb) {
        bb.append(C.el('label', null, 'Tujuan belajar'), tj, C.el('label', null, 'Teks soal'), tk, C.el('p', null, 'Pilihan jawaban (pilih bulatan di kiri untuk kunci):'), baris,
          C.el('label', null, 'Pembahasan (ditampilkan setelah peserta lulus)'), pb, C.el('p', null, C.el('label', null, ak, ' Aktif (dapat dipilih guru)')),
          C.btn('Simpan soal', aman(async function () {
            var pil = [], kunci = 0; op.forEach(function (o, i) { if (o.value.trim()) { if (rd[i].checked) kunci = pil.length; pil.push(o.value.trim()); } });
            var r = await rpc('admin_simpan_soal', { p_id: s ? s.id : null, p_tujuan: parseInt(tj.value, 10), p_teks: tk.value, p_pilihan: pil, p_kunci: kunci, p_pembahasan: pb.value, p_aktif: ak.checked });
            if (!r.ok) { C.toast(r.pesan); return; } C.toast('Soal tersimpan.'); C.closeOv(); window.adminBuka(C);
          })));
      });
    }
    await muat();
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
      var r = await C.sb.from('kelas').select('id,nama,kode,pemilik_id,dibuka,diskon_pascates').order('dibuat', { ascending: false }); if (r.error) throw r.error; daftar.innerHTML = '';
      var gr = (await rpc('admin_daftar_guru', {})).filter(function (x) { return x.peran === 'guru'; });
      r.data.forEach(function (k) {
        var pm = C.el('select', { 'aria-label': 'Pemilik kelas ' + k.nama }, C.el('option', { value: '' }, '(tanpa guru)'));
        gr.forEach(function (g) { pm.append(C.el('option', { value: g.id }, g.nama || g.email)); }); pm.value = k.pemilik_id || '';
        var df = C.inp('Diskon pasca-tes (%)', { type: 'number', min: '0', max: '100', 'aria-label': 'Diskon pasca-tes kelas ' + k.nama }); df.value = k.diskon_pascates; df.style.width = '90px';
        daftar.append(C.el('div', { style: 'border-top:1px solid var(--bd);padding:6px 0' },
          C.el('b', null, k.nama), ' · kode kelas: ', C.el('code', null, k.kode), k.dibuka ? '' : ' · (tertutup)', C.el('br'),
          C.el('label', null, 'Guru: '), pm, C.btn('Serahkan', aman(async function () { var x = await rpc('admin_serahkan_kelas', { p_kelas: k.id, p_guru: pm.value || null }); C.toast(x.ok ? 'Tersimpan.' : x.pesan); await muat(); })), C.el('br'),
          C.el('label', null, 'Diskon pasca-tes: '), df, ' %', C.btn('Simpan diskon', aman(async function () { var x = await rpc('admin_set_diskon_kelas', { p_kelas: k.id, p_persen: parseInt(df.value, 10) }); C.toast(x.ok ? 'Tersimpan.' : x.pesan); })), C.el('br'),
          C.btn('Lihat kemajuan', aman(async function () {
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
    baris('sertifikat_min_skor', 'Nilai minimal pasca-tes untuk lulus dan berhak sertifikat (%)', 'num'); baris('harga_pascates', 'Harga pasca-tes (poin per percobaan, sebelum diskon kelas)', 'num'); baris('pascates_maks_percobaan', 'Batas percobaan pasca-tes per peserta', 'num'); baris('sertifikat_penerbit', 'Sertifikat: nama penerbit (tercetak pada sertifikat baru)', 'str'); baris('sertifikat_penandatangan', 'Sertifikat: nama penandatangan (boleh kosong)', 'str');
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
    C = ctx; B = window.Bersama(C); tabel = B.tabel; unduh = B.unduh; rpc = B.rpc; aman = B.aman; bagian = B.bagian; batang = B.batang; tabelDetail = B.tabelDetail; judulTahap = B.judulTahap;
    B.gaya();
    var TAB = [
      { id: 'ringkasan', judul: 'Ringkasan', isi: [statistik] },
      { id: 'analitik', judul: 'Analitik', isi: [analitik] },
      { id: 'guru', judul: 'Guru dan kelas', isi: [guruAdmin, kelas, diskonAdmin], lencana: true },
      { id: 'tes', judul: 'Tes dan soal', isi: [paketBawaan, bankSoal] },
      { id: 'peserta', judul: 'Peserta dan poin', isi: [peserta, voucher] },
      { id: 'sertifikat', judul: 'Sertifikat', isi: [sertifikatAdmin] },
      { id: 'pengaturan', judul: 'Pengaturan', isi: [pengaturan] },
      { id: 'buku', judul: 'Buku poin dan log', isi: [buku] }
    ];
    C.openOv('🛠️ Panel pengelola', function (b) {
      b.append(C.el('p', { style: 'color:var(--mu);margin:0 0 6px' }, 'Setiap perubahan dicatat di log admin. Unduh buku poin (CSV) secara berkala sebagai cadangan.'));
      var bar = C.el('div', { 'class': 'tb-bar', role: 'tablist', 'aria-label': 'Bagian panel pengelola' }), wadah = C.el('div'), tombol = {}, panel = {}, termuat = {};
      function pilih(id, fokus) {
        TAB.forEach(function (t) { var on = t.id === id; tombol[t.id].setAttribute('aria-selected', on ? 'true' : 'false'); tombol[t.id].tabIndex = on ? 0 : -1; panel[t.id].hidden = !on; });
        if (fokus) tombol[id].focus();
        if (termuat[id]) return; termuat[id] = true;
        var p = panel[id], t = TAB.filter(function (x) { return x.id === id; })[0]; p.append(C.el('p', { role: 'status' }, 'Memuat…'));
        (async function () {
          var tmp = C.el('div');
          for (var f of t.isi) { try { await f(tmp); } catch (e) { tmp.append(C.el('p', { role: 'alert' }, 'Gagal memuat bagian: ' + C.errTxt(e))); } }
          p.innerHTML = ''; while (tmp.firstChild) p.append(tmp.firstChild);
        })();
      }
      TAB.forEach(function (t, i) {
        var x = C.el('button', { type: 'button', role: 'tab', id: 'tb-' + t.id, 'aria-controls': 'tp-' + t.id, 'aria-selected': 'false', 'class': 'tb' }, t.judul);
        x.onclick = function () { pilih(t.id); };
        x.onkeydown = function (e) {
          var k = e.key, j = k === 'ArrowRight' ? i + 1 : k === 'ArrowLeft' ? i - 1 : k === 'Home' ? 0 : k === 'End' ? TAB.length - 1 : -1;
          if (j < 0) return; e.preventDefault(); pilih(TAB[(j + TAB.length) % TAB.length].id, true);
        };
        tombol[t.id] = x; bar.append(x);
        var p = C.el('div', { role: 'tabpanel', id: 'tp-' + t.id, 'aria-labelledby': 'tb-' + t.id }); p.hidden = true; panel[t.id] = p; wadah.append(p);
      });
      b.append(bar, wadah); pilih('ringkasan');
      // lencana: jumlah permintaan guru dan pengajuan diskon yang menunggu keputusan
      (async function () {
        try {
          var g = await rpc('admin_daftar_guru', {}), d = await rpc('admin_daftar_diskon', {});
          var n = g.filter(function (x) { return x.diminta; }).length + d.filter(function (x) { return x.status === 'menunggu'; }).length;
          if (n) { tombol.guru.textContent = 'Guru dan kelas'; tombol.guru.append(C.el('span', { 'class': 'tb-n', 'aria-label': n + ' menunggu keputusan' }, String(n))); }
        } catch (e) { /* lencana hanya bantuan */ }
      })();
    });
  };
})();
