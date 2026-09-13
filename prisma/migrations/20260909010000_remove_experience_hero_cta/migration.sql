-- Client meminta CTA pada semua slide hero dihapus (komponen hero-carousel
-- sekarang tidak lagi merender tombol CTA). Bersihkan juga baris yang sudah
-- ter-seed di environment existing.
UPDATE `HeroSlide`
SET `ctaLabel` = NULL,
    `ctaHref` = NULL,
    `cta2Label` = NULL,
    `cta2Href` = NULL;
