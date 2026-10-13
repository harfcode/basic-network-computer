/* bersama.js : pembantu tampilan yang dipakai bersama oleh panel admin (admin.js) dan panel guru (guru.js).
   Hanya tampilan. Keamanan sebenarnya ada di basis data (fungsi admin_* dan guru_* memeriksa peran pemanggil). */
(function () {
  'use strict';
  window.Bersama = function (C) {
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

    /* ---------- gaya ---------- */
    function gaya() {
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
        'details.ab-d{margin:6px 0}details.ab-d summary{cursor:pointer;color:var(--mu);font-size:13px}',
        '.pk-g{border:1px solid var(--bd);border-radius:10px;margin:8px 0;padding:2px 10px;background:var(--bg)}',
        '.pk-g>summary{cursor:pointer;font-weight:700;padding:6px 0}',
        '.pk-s{display:grid;grid-template-columns:1fr 110px;gap:8px;align-items:start;padding:6px 0;border-top:1px solid var(--bd);font-size:14px}',
        '.pk-s small{color:var(--mu);display:block}.pk-s ol{margin:4px 0 0 18px;padding:0;font-size:13px}',
        '.pk-s li.kn{font-weight:700}',
        '.pk-r{position:sticky;top:0;background:var(--bg);border:1px solid var(--bd);border-radius:10px;padding:6px 10px;margin:8px 0;z-index:1}',
        '@media(max-width:520px){.pk-s{grid-template-columns:1fr}}',
        '.tb-bar{display:flex;flex-wrap:wrap;gap:4px;margin:0 0 12px;padding:4px 0;border-bottom:2px solid var(--bd);position:sticky;top:0;background:var(--bg);z-index:2}',
        '.tb-bar .tb{border-radius:8px 8px 0 0;padding:7px 12px;font-size:14px;white-space:nowrap}',
        '.tb-bar .tb[aria-selected="true"]{background:var(--ac);color:var(--bt);font-weight:700}',
        '.tb-n{display:inline-block;margin-left:6px;min-width:20px;padding:0 6px;border-radius:10px;background:#c0392b;color:#fff;font-size:12px;line-height:20px;text-align:center}'
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

    /* ---------- tampilan analitik (data dari admin_analitik / guru_analitik) ---------- */
    function tampilAnalitik(isi, a) {
      isi.innerHTML = '';
      if (!a.peserta) { isi.append(C.el('p', null, 'Belum ada peserta di pilihan ini.')); return; }
      var P = a.peserta, total = typeof ST !== 'undefined' ? ST.length : 29;
      isi.append(C.el('div', { 'class': 'ak' },
        C.el('div', null, C.el('b', null, P), C.el('span', null, 'peserta')),
        C.el('div', null, C.el('b', null, a.aktif_7_hari + ' (' + Math.round(a.aktif_7_hari * 100 / P) + '%)'), C.el('span', null, 'aktif 7 hari terakhir')),
        C.el('div', null, C.el('b', null, a.rata_tahap), C.el('span', null, 'rata-rata tahap selesai dari ' + total)),
        C.el('div', null, C.el('b', null, a.sertifikat), C.el('span', null, 'sertifikat terbit'))));
      var items = [], tb = [];
      (typeof PH !== 'undefined' ? PH : [['Semua tahap', ST.map(function (x) { return x.id; })]]).forEach(function (g) {
        items.push({ grup: g[0] });
        g[1].forEach(function (id) { var n = a.tahap[id] || 0, jd = judulTahap(id); items.push({ label: jd, nilai: n, maks: P, teks: n + ' (' + Math.round(n * 100 / P) + '%)', tip: jd + ': ' + n + ' dari ' + P + ' peserta' }); tb.push([jd, n, Math.round(n * 100 / P) + '%']); });
      });
      isi.append(C.el('h4', null, 'Peserta yang menyelesaikan tiap tahap'), batang(items), tabelDetail('kemajuan per tahap', ['Tahap', 'Selesai', 'Persen'], tb));
      var ks = Object.keys(a.kuis).map(function (id) { var x = a.kuis[id]; return { id: id, b: x.b, t: x.t, p: x.t ? x.b * 100 / x.t : 0 }; }).filter(function (x) { return x.t >= Math.min(3, P); }).sort(function (x, y) { return x.p - y.p || y.t - x.t; });
      isi.append(C.el('h4', null, 'Kuis yang paling banyak dijawab salah (perlu dibahas ulang)'));
      if (!ks.length) isi.append(C.el('p', null, 'Belum cukup jawaban kuis (minimal 3 jawaban per tahap).'));
      else { var sulit = ks.slice(0, 8); isi.append(batang(sulit.map(function (x) { var jd = judulTahap(x.id); return { label: jd, nilai: x.p, maks: 100, teks: Math.round(x.p) + '% (' + x.b + '/' + x.t + ')', tip: jd + ': ' + x.b + ' benar dari ' + x.t + ' jawaban' }; })),
        tabelDetail('kuis', ['Tahap', 'Benar', 'Dijawab', 'Persen benar'], ks.map(function (x) { return [judulTahap(x.id), x.b, x.t, Math.round(x.p) + '%']; }))); }
      var seb = a.sebaran.map(function (x) { var sd = Math.min(x.dari + 4, total); return { label: x.dari + '–' + sd + ' tahap selesai', nilai: x.n, maks: P, teks: x.n + ' orang', tip: x.n + ' peserta menyelesaikan ' + x.dari + '–' + sd + ' tahap' }; });
      isi.append(C.el('h4', null, 'Sebaran kemajuan peserta'), batang(seb));
      var wb = [];
      Object.keys(C.wilayah).map(Number).sort(function (x, y) { return x - y; }).forEach(function (id) {
        var w = C.wilayah[id], dibuka = w.gratis ? P : (a.wilayah[id] || 0), ins = a.insiden[id - 1] || 0;
        wb.push([id + '. ' + w.nama, w.gratis ? 'gratis' : dibuka + ' (' + Math.round(dibuka * 100 / P) + '%)', ins + ' (' + Math.round(ins * 100 / P) + '%)']);
      });
      isi.append(C.el('h4', null, 'Wilayah dibuka dan insiden diselesaikan'), tabel(['Wilayah', 'Dibuka', 'Insiden selesai'], wb));
      isi.append(C.el('h4', null, 'Peserta yang belum aktif 7 hari atau lebih (maks. 50)'));
      if (!a.tertinggal.length) isi.append(C.el('p', null, 'Tidak ada. Semua peserta aktif dalam 7 hari terakhir.'));
      else {
        var tr = a.tertinggal.map(function (x) { return [x.nama, x.email, x.tahap, x.diubah ? new Date(x.diubah).toLocaleDateString('id-ID') : 'belum pernah']; });
        isi.append(tabel(['Nama', 'Email', 'Tahap selesai', 'Terakhir aktif'], tr), C.btn('Unduh CSV peserta tertinggal', function () { unduh('peserta-tertinggal.csv', ['nama', 'email', 'tahap_selesai', 'terakhir_aktif'], tr); }));
      }
    }

    /* ---------- pemilih paket soal (guru: per kelas; admin: paket bawaan) ----------
       opsi: { bank:[{id,tujuan,tujuan_nama,teks,pilihan,kunci,pembahasan}], info:{pra,pasca,seimbang},
               simpan: async function(praIds, pascaIds, acak, praAktif, dibukaPada) -> {ok,pesan,info}, jadwal:boolean }
       Setiap soal hanya dapat dipilih untuk salah satu tes, sehingga soal yang sama tidak mungkin ada di keduanya. */
    function lokalIso(iso) { if (!iso) return ''; var d = new Date(iso), p = function (n) { return String(n).padStart(2, '0'); }; return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate()) + 'T' + p(d.getHours()) + ':' + p(d.getMinutes()); }
    function editorPaket(opsi) {
      gaya();
      var info = opsi.info, pil = {}, wadah = C.el('div'), selects = {}, ringkas = C.el('div', { 'class': 'pk-r', role: 'status', 'aria-live': 'polite' }), grupHitung = {};
      (info.pra.soal_ids || []).forEach(function (id) { pil[id] = 'pra'; }); (info.pasca.soal_ids || []).forEach(function (id) { pil[id] = 'pasca'; });
      var acak = C.el('input', { type: 'checkbox', id: 'pk-acak' }), praAktif = C.el('input', { type: 'checkbox', id: 'pk-pra' }), jadwal = C.el('input', { type: 'datetime-local', 'aria-label': 'Pasca-tes dibuka mulai (opsional)' });
      acak.checked = info.pra.acak !== false; praAktif.checked = info.pra.aktif !== false; jadwal.value = lokalIso(info.pasca.dibuka_pada);
      var pesan = C.el('p', { role: 'status', 'aria-live': 'polite', style: 'font-weight:700' });
      function hitung() {
        var n = { pra: 0, pasca: 0 }, per = {};
        opsi.bank.forEach(function (s) { var v = selects[s.id].value; if (v) { n[v]++; (per[s.tujuan] = per[s.tujuan] || { pra: 0, pasca: 0 })[v]++; } });
        var seimbang = Object.keys(per).every(function (k) { return per[k].pra === per[k].pasca; });
        ringkas.textContent = 'Pra-tes: ' + n.pra + ' soal · Pasca-tes: ' + n.pasca + ' soal (minimal 10 masing-masing). ' + (n.pra >= 10 && n.pasca >= 10 ? (seimbang ? '✅ Seimbang per tujuan belajar.' : '⚠️ Jumlah soal per tujuan belajar belum sama di kedua tes, sehingga nilai kenaikan kurang sebanding.') : '');
        Object.keys(grupHitung).forEach(function (k) { var g = per[k] || { pra: 0, pasca: 0 }; grupHitung[k].textContent = ' (pra ' + g.pra + ', pasca ' + g.pasca + ')' + (g.pra !== g.pasca ? ' ⚠️' : ''); });
        return n;
      }
      var tujuan = {}; opsi.bank.forEach(function (s) { (tujuan[s.tujuan] = tujuan[s.tujuan] || { nama: s.tujuan_nama, soal: [] }).soal.push(s); });
      Object.keys(tujuan).forEach(function (k) {
        var g = tujuan[k], hitungSpan = C.el('span', { style: 'font-weight:400;color:var(--mu)' }); grupHitung[k] = hitungSpan;
        var d = C.el('details', { 'class': 'pk-g' }, C.el('summary', null, k + '. ' + g.nama, hitungSpan));
        g.soal.forEach(function (s) {
          var sel = C.el('select', { 'aria-label': 'Pakai soal nomor ' + s.id + ' di' }, C.el('option', { value: '' }, 'Tidak dipakai'), C.el('option', { value: 'pra' }, 'Pra-tes'), C.el('option', { value: 'pasca' }, 'Pasca-tes'));
          sel.value = pil[s.id] || ''; sel.onchange = hitung; selects[s.id] = sel;
          var ol = C.el('ol', { type: 'a' }); s.pilihan.forEach(function (o, i) { ol.append(C.el('li', { 'class': i === s.kunci ? 'kn' : '' }, o + (i === s.kunci ? '  ✓ kunci' : ''))); });
          d.append(C.el('div', { 'class': 'pk-s' }, C.el('div', null, s.teks, ol, C.el('small', null, 'Pembahasan: ' + (s.pembahasan || '-'))), sel));
        });
        wadah.append(d);
      });
      var simpan = C.btn('Simpan paket tes', async function () {
        var pra = [], pasca = []; opsi.bank.forEach(function (s) { var v = selects[s.id].value; if (v === 'pra') pra.push(s.id); else if (v === 'pasca') pasca.push(s.id); });
        if (pra.length < 10 || pasca.length < 10) { pesan.textContent = 'Pilih minimal 10 soal untuk pra-tes dan 10 untuk pasca-tes.'; return; }
        simpan.disabled = true;
        try {
          var jd = jadwal.value ? new Date(jadwal.value).toISOString() : null;
          var r = await opsi.simpan(pra, pasca, acak.checked, praAktif.checked, opsi.jadwal ? jd : null);
          pesan.textContent = r.ok ? 'Paket tes tersimpan.' + (r.info && r.info.seimbang === false ? ' Catatan: jumlah soal per tujuan belum seimbang.' : '') : r.pesan;
        } catch (e) { pesan.textContent = C.errTxt(e); }
        simpan.disabled = false;
      });
      var kunci = (info.pra.terkunci || info.pasca.terkunci) ? C.el('p', { style: 'color:var(--mu)' }, '🔒 Sudah ada siswa yang mengerjakan paket ini. Bila Anda mengganti soal, tersimpan versi baru; hasil yang sudah ada tetap utuh tetapi tidak dibandingkan dengan versi baru.') : null;
      var kontrol = C.el('div', null,
        C.el('p', null, C.el('label', null, acak, ' Acak urutan soal dan pilihan jawaban untuk tiap siswa (disarankan)')),
        C.el('p', null, C.el('label', null, praAktif, ' Pra-tes diaktifkan untuk kelas ini')),
        opsi.jadwal ? C.el('p', null, C.el('label', null, 'Pasca-tes dibuka mulai (kosong = kapan saja setelah tahap inti selesai) '), jadwal) : null);
      hitung();
      return C.el('div', null,
        C.el('p', { style: 'color:var(--mu)' }, 'Pilih soal dari bank untuk tiap tes: minimal 10 soal untuk pra-tes dan 10 untuk pasca-tes. Satu soal hanya dapat dipakai di salah satu tes. Untuk membandingkan nilai dengan adil, usahakan jumlah soal per tujuan belajar sama di kedua tes. Pasca-tes selalu aktif karena menjadi syarat sertifikat.'),
        kunci, kontrol, ringkas, wadah, C.el('p'), simpan, pesan);
    }
    return { tabel: tabel, csvSel: csvSel, unduh: unduh, rpc: rpc, aman: aman, bagian: bagian, gaya: gaya, batang: batang, tabelDetail: tabelDetail, judulTahap: judulTahap, tampilAnalitik: tampilAnalitik, editorPaket: editorPaket };
  };
})();
