# Re-audit UI/UX LIMO - Fase 7

Tanggal: 9 Agustus 2026  
Baseline: `docs/UI_UX_AUDIT.md` (audit awal 8 Agustus 2026)

## Metode

Nilai berikut adalah penilaian engineering terhadap source, flow role, dan regresi otomatis. Nilai ini bukan hasil usability study dengan pengguna. Baseline dipertahankan apa adanya di dokumen audit awal.

## Perbandingan Skor

| Dimensi | Audit awal | Setelah Fase 7 | Perubahan | Bukti utama |
|---|---:|---:|---:|---|
| Branding | 3/10 | 8/10 | +5 | Token LIMO konsisten, copy domain lokal, font Arab self-hosted, serta icon PWA PNG/maskable/Apple. |
| Hierarki visual | 5/10 | 7/10 | +2 | `MetricCard`, `StatusBadge`, dan `Money` menyatukan hirarki angka, status, dan nominal; layout mobile hero/invoice/empty state diregresikan. |
| Kekhususan domain | 7/10 | 9/10 | +2 | Workspace jadwal, ledger pembayaran, profil orang, tugas, rubric, gradebook, remedial, dan activity completion memiliki role scope nyata. |
| Mobile operasional | 5/10 | 8/10 | +3 | Visual regression 360px/390px pada Chromium dan WebKit, agenda/invoice/empty state mobile, serta target sentuh Wali >=44px. |
| Bahasa Arab/RTL | 3/10 | 8/10 | +5 | Content island memakai font Arab, `lang`, `dir`, dan `bdi`; flow Guru Arab dan Wali Arab diregresikan pada dua viewport dan dua engine. |
| Aksesibilitas | 5/10 | 8/10 | +3 | Axe WCAG 2 A/AA termasuk evaluasi contrast, keyboard skip link/nav, dan test target sentuh tersedia di CI. |
| State dan safety | 5/10 | 8/10 | +3 | Typed API error contract, lifecycle async bersama, loading/error role-aware, konfirmasi mutasi, serta SW yang menolak cache auth/API/private route. |

**Skor keseluruhan: 4/10 -> 8/10.**

## Implementasi Yang Menutup Temuan

- `src/lib/api-json-client.ts` dan `use-async-action.ts` menghapus parsing response/error lokal pada workspace utama.
- `StatusBadge`, `Money`, `MetricCard`, dan `formatRupiah` memakai sumber label/tone yang sama.
- `DashboardRoleProvider` memberi loading skeleton dan recovery CTA yang sesuai Admin, Guru, Wali, atau Siswa.
- PWA menggunakan icon nyata, install/update prompt eksplisit, cache publik exact-match, dan tidak menyimpan halaman autentikasi maupun data privat.
- `@axe-core/playwright`, keyboard test, touch-target test, PWA production test, dan workflow CI ditambahkan.
- Runner E2E membuat database SQLite unik per spec supaya mutasi antarskenario tidak mencemari hasil.
- Seed SQLite sekarang menyediakan tugas terbit untuk fixture role Siswa/Wali yang deterministik.

## Verifikasi

- `npm.cmd run test:e2e`: 49 browser test lulus, termasuk 16 visual test pada Chromium/WebKit mobile dan 3 accessibility test.
- `npm.cmd run test:week1` sampai `npm.cmd run test:week10`: seluruh integration suite lulus.
- `npm.cmd run typecheck`, `npm.cmd run lint`, `npm.cmd test`, `npm.cmd run check:colors`, dan `npm.cmd run build`: lulus.
- `npm.cmd run test:e2e:pwa`: 1 production PWA test lulus.

## Batas Yang Masih Ada

- Axe saat ini memeriksa navigasi publik, login, dan kontrol dashboard yang representatif; belum merupakan scan penuh setiap halaman dashboard/public.
- Role-aware loading/error mencakup workspace dashboard yang dibungkus shell; kegagalan root layout masih memakai fallback global.
- Warning non-blocking tersisa: deprecation `package.json#prisma`, aspect-ratio logo pada Next dev, dan warning normalisasi CRLF dari `git diff --check` pada worktree lama.
