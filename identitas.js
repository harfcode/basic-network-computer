// Identitas dan teks sertifikat. Ubah berkas ini saja; tidak perlu menyentuh cloud.js atau basis data.
// Untuk aplikasi lain (mis. keamanan komputer): salin seluruh folder web/, lalu ganti isi berkas ini dan logo.png.
// Catatan: teks sertifikat tidak disimpan di basis data, jadi perubahan di sini berlaku juga untuk sertifikat yang sudah terbit.
// Nama penerbit dan penandatangan diatur di panel admin (Pengaturan), bukan di sini.
// Tanda tangan pada sertifikat berupa kode QR digital (nama penandatangan, waktu terbit, kode sertifikat) dan dibuat otomatis.
window.APP_IDENTITAS = {
  // Logo di bagian atas sertifikat: nama berkas gambar di folder yang sama (PNG/SVG, sebaiknya berlatar transparan).
  // Kosongkan ('') untuk memakai gambar bawaan.
  logo: 'logo.png',
  logoAlt: 'harfcode',
  // Tinggi logo dalam satuan lebar sertifikat (angka lebih besar = logo lebih besar).
  logoTinggi: 7.5,

  judul: 'SERTIFIKAT PENYELESAIAN',
  subjudul: 'Petualangan Teknisi Jaringan Kampus',
  pengantar: 'Diberikan kepada',
  // Kalimat uraian. {tahap} = jumlah tahap inti, {skor} = nilai pasca-tes (persen).
  uraian: 'yang telah menyelesaikan {tahap} tahap inti pada enam wilayah simulasi jaringan komputer dasar, dengan nilai pasca-tes {skor}%.',
  catatan: 'Sertifikat ini menyatakan penyelesaian materi belajar mandiri. Bukan ijazah, transkrip, atau sertifikasi profesi.'
};
