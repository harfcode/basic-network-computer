/* guru.js : panel guru (dimuat hanya untuk akun berperan guru). Memakai Bersama (bersama.js).
   Hanya tampilan. Keamanan sebenarnya ada di basis data: setiap fungsi guru_* memeriksa bahwa pemanggil adalah pemilik kelas. */
(function () {
  'use strict';
  window.guruBuka = function (C) {
    var B = window.Bersama(C), rpc = B.rpc, aman = B.aman;
    B.gaya();

    function daftarKelas(b) {
      b.innerHTML = '';
      b.append(C.el('p', { style: 'color:var(--mu)' }, 'Kelas yang Anda buat. Siswa bergabung dengan kode kelas. Anda hanya melihat siswa dari kelas Anda sendiri.'));
      var nama = C.inp('Nama kelas baru (mis. Jaringan Dasar S2 2026)', { maxlength: '80', 'aria-label': 'Nama kelas baru' });
      var buat = C.btn('Buat kelas', aman(async function () {
        buat.disabled = true;
        try { var r = await rpc('guru_buat_kelas', { p_nama: nama.value }); if (!r.ok) { C.toast(r.pesan); return; } C.toast('Kelas dibuat. Kode: ' + r.kode); await tampil(); }
        finally { buat.disabled = false; }
      }), 'o');
      b.append(nama, buat);
      var wadah = C.el('div'); b.append(C.el('h3', null, 'Kelas saya'), wadah);
      async function tampil() {
        var k = await rpc('guru_kelas_saya', {}); wadah.innerHTML = '';
        if (!k.length) { wadah.append(C.el('p', null, 'Belum ada kelas. Buat kelas pertama Anda di atas.')); return; }
        wadah.append(B.tabel(['Kelas', 'Kode', 'Siswa', 'Pendaftaran', ''], k.map(function (x) {
          return [x.nama, x.kode, x.siswa, x.dibuka ? 'dibuka' : 'ditutup', C.btn('Buka', function () { detail(b, x); })];
        })));
      }
      tampil().catch(function (e) { wadah.append(C.el('p', { role: 'alert' }, C.errTxt(e))); });
    }

    function detail(b, kelas) {
      b.innerHTML = '';
      b.append(C.btn('← Daftar kelas', function () { daftarKelas(b); }), C.el('h3', null, kelas.nama), C.el('p', null, 'Kode kelas: ', C.el('b', null, kelas.kode)));
      var tab = C.el('div', { role: 'group', 'aria-label': 'Bagian kelas', style: 'display:flex;flex-wrap:wrap;gap:6px;margin:8px 0' }), isi = C.el('div');
      var bagian = [['Siswa', siswa], ['Analitik', analitik], ['Paket tes', paket], ['Laporan tes', laporan], ['Diskon', diskon], ['Pengaturan', atur]];
      bagian.forEach(function (x) {
        var t = C.btn(x[0], function () { Array.from(tab.children).forEach(function (c) { c.setAttribute('aria-pressed', c === t ? 'true' : 'false'); }); isi.innerHTML = ''; x[1](isi, kelas).catch(function (e) { isi.append(C.el('p', { role: 'alert' }, C.errTxt(e))); }); });
        t.setAttribute('aria-pressed', 'false'); tab.append(t);
      });
      b.append(tab, isi); tab.children[0].click();
    }

    async function siswa(b, kelas) {
      var d = await rpc('guru_siswa', { p_kelas: kelas.id }), total = typeof ST !== 'undefined' ? ST.length : 29;
      if (!d.length) { b.append(C.el('p', null, 'Belum ada siswa. Bagikan kode kelas ' + kelas.kode + '.')); return; }
      var tgl = function (x) { return x ? new Date(x).toLocaleDateString('id-ID') : 'belum pernah'; };
      var baris = d.map(function (s) { return [s.nama || '-', s.email, s.tahap_selesai + '/' + total, s.kuis_total ? s.kuis_benar + '/' + s.kuis_total : '-', s.pra == null ? '-' : s.pra + '%', s.pasca == null ? '-' : s.pasca + '%', s.lulus_pasca ? 'lulus' : '-', s.sertifikat ? 'ya' : '-', tgl(s.diubah)]; });
      var kol = ['Nama', 'Email', 'Tahap', 'Kuis benar', 'Pra-tes', 'Pasca-tes (terbaik)', 'Lulus', 'Sertifikat', 'Terakhir aktif'];
      b.append(C.el('p', null, d.length + ' siswa.'), B.tabel(kol.concat(['']), baris.map(function (r, i) {
        return r.concat([C.btn('Keluarkan', aman(async function () {
          if (!window.confirm('Keluarkan ' + (d[i].nama || d[i].email) + ' dari kelas? Kemajuan dan poin siswa tidak berubah.')) return;
          var x = await rpc('guru_keluarkan', { p_kelas: kelas.id, p_siswa: d[i].id }); C.toast(x.ok ? 'Siswa dikeluarkan.' : x.pesan);
          b.innerHTML = ''; await siswa(b, kelas);
        }))]);
      })), C.el('p'), C.btn('Unduh CSV siswa', function () { B.unduh('siswa-' + kelas.kode + '.csv', kol, baris); }));
    }

    async function analitik(b, kelas) { var a = await rpc('guru_analitik', { p_kelas: kelas.id }); B.tampilAnalitik(b, a); }

    async function paket(b, kelas) {
      var bank = await rpc('guru_bank_soal', {}), info = await rpc('guru_tes_kelas', { p_kelas: kelas.id });
      b.append(C.el('p', { style: 'color:var(--mu)' }, info.pra.ada || info.pasca.ada ? 'Kelas ini memakai paket tes sendiri.' : 'Kelas ini masih memakai paket bawaan. Simpan paket di bawah untuk membuat paket khusus kelas.'),
        B.editorPaket({ bank: bank, info: info, jadwal: true, simpan: function (pra, pasca, acak, praAktif, dibuka) { return rpc('guru_simpan_tes', { p_kelas: kelas.id, p_pra: pra, p_pasca: pasca, p_acak: acak, p_pra_aktif: praAktif, p_dibuka_pada: dibuka }); } }));
    }

    async function laporan(b, kelas) {
      var r = await rpc('guru_laporan_tes', { p_kelas: kelas.id });
      var rata = function (x) { return x == null ? '-' : x + '%'; };
      b.append(C.el('div', { 'class': 'ak' },
        C.el('div', null, C.el('b', null, rata(r.pra.rata)), C.el('span', null, 'rata-rata pra-tes (' + r.pra.n + ' siswa)')),
        C.el('div', null, C.el('b', null, rata(r.pasca.rata)), C.el('span', null, 'rata-rata pasca-tes terbaik (' + r.pasca.n + ' siswa)')),
        C.el('div', null, C.el('b', null, r.pasca.lulus), C.el('span', null, 'siswa lulus pasca-tes')),
        C.el('div', null, C.el('b', null, r.gain == null ? '-' : r.gain + '%'), C.el('span', null, 'kenaikan ternormalisasi (' + r.pasangan + ' siswa punya keduanya)'))));
      b.append(C.el('p', { style: 'color:var(--mu)' }, 'Kenaikan ternormalisasi = (pasca − pra) ÷ (100 − pra). Dengan 10 soal, angka ini hanya gambaran tingkat kelas, bukan ukuran tepat untuk individu.'));
      b.append(C.el('h4', null, 'Penguasaan per tujuan belajar (persen jawaban benar)'));
      if (!r.per_tujuan.length) b.append(C.el('p', null, 'Belum ada tes yang selesai.'));
      else {
        var it = []; r.per_tujuan.forEach(function (t) {
          it.push({ grup: t.tujuan + '. ' + t.nama });
          it.push({ label: 'Pra-tes', nilai: t.pra || 0, maks: 100, teks: t.pra == null ? '-' : t.pra + '%' });
          it.push({ label: 'Pasca-tes', nilai: t.pasca || 0, maks: 100, teks: t.pasca == null ? '-' : t.pasca + '%' });
        });
        b.append(B.batang(it), B.tabelDetail('penguasaan per tujuan', ['Tujuan', 'Pra', 'Pasca'], r.per_tujuan.map(function (t) { return [t.tujuan + '. ' + t.nama, rata(t.pra), rata(t.pasca)]; })));
      }
      b.append(C.el('h4', null, 'Soal yang paling banyak dijawab salah'));
      if (!r.soal_sulit.length) b.append(C.el('p', null, 'Belum ada data.'));
      else b.append(B.tabel(['Tes', 'Soal', 'Salah', 'Dijawab'], r.soal_sulit.map(function (s) { return [s.jenis, s.teks, s.salah, s.total]; })));
    }

    async function diskon(b, kelas) {
      var i = await rpc('guru_tes_kelas', { p_kelas: kelas.id }), pg = i.pengajuan;
      b.append(C.el('p', null, 'Harga pasca-tes: ', C.el('b', null, i.harga + ' poin'), ' per percobaan (harga dasar ' + i.harga_dasar + ' poin, diskon kelas ' + i.diskon + '%).'),
        C.el('p', { style: 'color:var(--mu)' }, 'Diskon ditetapkan admin. Ajukan bila siswa Anda perlu keringanan, sertai alasan.'));
      if (pg) b.append(C.el('p', { role: 'status' }, 'Pengajuan terakhir: ' + pg.diminta + '% — ' + ({ menunggu: 'menunggu keputusan admin', disetujui: 'disetujui (' + pg.disetujui + '%)', ditolak: 'ditolak' }[pg.status] || pg.status) + '. Alasan: ' + pg.alasan));
      if (pg && pg.status === 'menunggu') return;
      var p = C.inp('Persen diskon (1–100)', { type: 'number', min: '1', max: '100', 'aria-label': 'Persen diskon' }), a = C.inp('Alasan pengajuan (5–300 huruf)', { maxlength: '300', 'aria-label': 'Alasan' });
      var k = C.btn('Ajukan diskon', aman(async function () {
        k.disabled = true;
        try { var r = await rpc('guru_ajukan_diskon', { p_kelas: kelas.id, p_persen: parseInt(p.value, 10), p_alasan: a.value }); C.toast(r.ok ? 'Pengajuan terkirim.' : r.pesan); if (r.ok) { b.innerHTML = ''; await diskon(b, kelas); } }
        finally { k.disabled = false; }
      }), 'o');
      b.append(p, a, k);
    }

    async function atur(b, kelas) {
      var nama = C.inp('Nama kelas', { maxlength: '80', value: kelas.nama, 'aria-label': 'Nama kelas' }), buka = C.el('input', { type: 'checkbox' }); buka.checked = !!kelas.dibuka;
      var simpan = C.btn('Simpan', aman(async function () {
        var r = await rpc('guru_set_kelas', { p_kelas: kelas.id, p_dibuka: buka.checked, p_nama: nama.value }); C.toast(r.ok ? 'Tersimpan.' : r.pesan);
        if (r.ok) { kelas.nama = nama.value.trim(); kelas.dibuka = buka.checked; }
      }), 'o');
      var ganti = C.btn('Ganti kode kelas', aman(async function () {
        if (!window.confirm('Kode lama tidak berlaku lagi untuk pendaftar baru. Lanjutkan?')) return;
        var r = await rpc('guru_ganti_kode', { p_kelas: kelas.id }); if (r.ok) { kelas.kode = r.kode; C.toast('Kode baru: ' + r.kode); } else C.toast(r.pesan);
      }));
      b.append(C.el('p', null, C.el('label', null, 'Nama kelas ', nama)), C.el('p', null, C.el('label', null, buka, ' Terima pendaftar baru')), simpan, C.el('p'), ganti);
    }

    C.openOv('👩‍🏫 Kelas saya', function (b) { daftarKelas(b); });
  };
})();
