/**
 * Verifikasi parity database (SQLite lokal ↔ MariaDB staging/produksi).
 *
 * Pakai:
 *   DATABASE_URL="mysql://user:pass@host:3306/limo" node scripts/verify-db-parity.mjs
 *
 * Untuk MariaDB, generate Prisma Client dengan schema utama lebih dulu:
 *   npx prisma generate --schema prisma/schema.prisma
 *
 * Skrip ini hanya membaca, kecuali probe tulis yang dijalankan di dalam
 * transaksi yang sengaja gagal (rollback) sehingga tidak mengubah data.
 */
const databaseUrl = process.env.DATABASE_URL || "";
if (!databaseUrl) {
  console.error("DATABASE_URL wajib diisi.");
  process.exit(2);
}

const isSqlite = databaseUrl.startsWith("file:");

const { PrismaClient } = await import("@prisma/client");
const prisma = new PrismaClient();

const results = [];

function check(name, ok, detail = "") {
  results.push({ ok: Boolean(ok) });
  console.log(`${ok ? "ok  " : "FAIL"} ${name}${detail ? ` — ${detail}` : ""}`);
}

const REQUIRED_TABLES = ["Voucher", "Pengumuman", "PengumumanRead", "DiskusiThread", "DiskusiBalasan", "DiskusiLaporan", "Sertifikat"];
const REQUIRED_COLUMNS = [
  ["HasilUjian", "releasedAt"],
  ["UjianAttempt", "siswaAccountId"],
  ["UjianAttempt", "startedByRole"],
  ["UjianAttempt", "violationCount"],
  ["Ujian", "secureMode"],
  ["Ujian", "showResultToSiswa"],
  ["Tagihan", "discountAmount"],
  ["Tagihan", "voucherId"],
  ["Voucher", "programId"],
  ["Voucher", "kelasId"],
  ["FileAsset", "diskusiBalasanId"],
  ["FileAsset", "diskusiThreadId"],
];

function firstLine(error) {
  return String(error instanceof Error ? error.message : error).split("\n")[0];
}

async function checkModelsAndColumns() {
  const tableProbes = {
    Voucher: () => prisma.voucher.count(),
    Pengumuman: () => prisma.pengumuman.count(),
    PengumumanRead: () => prisma.pengumumanRead.count(),
    DiskusiThread: () => prisma.diskusiThread.count(),
    DiskusiBalasan: () => prisma.diskusiBalasan.count(),
    DiskusiLaporan: () => prisma.diskusiLaporan.count(),
    Sertifikat: () => prisma.sertifikat.count(),
  };
  for (const [name, probe] of Object.entries(tableProbes)) {
    try {
      await probe();
      check(`tabel ${name}`, true);
    } catch (error) {
      check(`tabel ${name}`, false, firstLine(error));
    }
  }

  const columnProbes = [
    ["HasilUjian.releasedAt", () => prisma.hasilUjian.findFirst({ select: { releasedAt: true } })],
    ["UjianAttempt (siswaAccountId/startedByRole/violationCount)", () => prisma.ujianAttempt.findFirst({ select: { siswaAccountId: true, startedByRole: true, violationCount: true } })],
    ["Ujian (secureMode/showResultToSiswa)", () => prisma.ujian.findFirst({ select: { secureMode: true, showResultToSiswa: true } })],
    ["Tagihan (discountAmount/voucherId)", () => prisma.tagihan.findFirst({ select: { discountAmount: true, voucherId: true } })],
    ["Voucher (programId/kelasId)", () => prisma.voucher.findFirst({ select: { programId: true, kelasId: true } })],
    ["FileAsset.diskusiBalasanId", () => prisma.fileAsset.findFirst({ select: { diskusiBalasanId: true } })],
  ];
  for (const [name, probe] of columnProbes) {
    try {
      await probe();
      check(`kolom ${name}`, true);
    } catch (error) {
      check(`kolom ${name}`, false, firstLine(error));
    }
  }
}

async function checkMysqlSchema() {
  try {
    const rows = await prisma.$queryRawUnsafe("SELECT DEFAULT_CHARACTER_SET_NAME AS cs, DEFAULT_COLLATION_NAME AS coll FROM information_schema.SCHEMATA WHERE SCHEMA_NAME = DATABASE()");
    const schema = rows[0];
    const cs = String(schema?.cs ?? "").toLowerCase();
    check("charset database utf8mb4", cs.startsWith("utf8mb4"), `${schema?.cs ?? "?"} / ${schema?.coll ?? "?"}`);
  } catch (error) {
    check("charset database utf8mb4", false, firstLine(error));
  }

  try {
    const list = REQUIRED_TABLES.map((name) => `'${name}'`).join(",");
    const rows = await prisma.$queryRawUnsafe(`SELECT TABLE_NAME AS t FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME IN (${list})`);
    const found = new Set(rows.map((row) => row.t));
    const missing = REQUIRED_TABLES.filter((name) => !found.has(name));
    check("tabel wajib ada", missing.length === 0, missing.length ? `hilang: ${missing.join(", ")}` : `${found.size} tabel`);
  } catch (error) {
    check("tabel wajib ada", false, firstLine(error));
  }

  try {
    const list = REQUIRED_COLUMNS.map(([table, column]) => `'${table}.${column}'`).join(",");
    const rows = await prisma.$queryRawUnsafe(`SELECT TABLE_NAME AS t, COLUMN_NAME AS c FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND CONCAT(TABLE_NAME, '.', COLUMN_NAME) IN (${list})`);
    const found = new Set(rows.map((row) => `${row.t}.${row.c}`));
    const missing = REQUIRED_COLUMNS.map(([table, column]) => `${table}.${column}`).filter((key) => !found.has(key));
    check("kolom wajib ada", missing.length === 0, missing.length ? `hilang: ${missing.join(", ")}` : `${found.size} kolom`);
  } catch (error) {
    check("kolom wajib ada", false, firstLine(error));
  }

  try {
    const rows = await prisma.$queryRawUnsafe("SELECT TABLE_NAME AS t, COLUMN_NAME AS c, NUMERIC_PRECISION AS p, NUMERIC_SCALE AS s FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND DATA_TYPE = 'decimal' AND (NUMERIC_SCALE <> 2 OR NUMERIC_PRECISION < 10)");
    check("presisi Decimal(>=10,2)", rows.length === 0, rows.length ? `${rows.length} kolom di luar (10,2): ${rows.slice(0, 5).map((row) => `${row.t}.${row.c}`).join(", ")}` : "semua DECIMAL sesuai");
  } catch (error) {
    check("presisi Decimal(>=10,2)", false, firstLine(error));
  }

  try {
    const rows = await prisma.$queryRawUnsafe("SELECT TABLE_NAME AS t, COLUMN_NAME AS c, COLUMN_TYPE AS ct FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'Voucher' AND COLUMN_NAME = 'discountType'");
    const columnType = String(rows[0]?.ct ?? "");
    check("enum VoucherDiscountType", columnType.includes("PERCENT") && columnType.includes("FIXED"), columnType || "tidak ditemukan");
  } catch (error) {
    check("enum VoucherDiscountType", false, firstLine(error));
  }

  try {
    const rows = await prisma.$queryRawUnsafe("SELECT TABLE_NAME AS t, INDEX_NAME AS i, NON_UNIQUE AS nu FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME IN ('Tagihan','Voucher') AND NON_UNIQUE = 0");
    check("unique index Tagihan/Voucher", rows.length > 0, rows.length ? `${rows.length} unique index` : "tidak ada unique index");
  } catch (error) {
    check("unique index Tagihan/Voucher", false, firstLine(error));
  }
}

async function checkDecimalAndUniqueProbe() {
  const code = `PARITY-${Date.now()}`;
  let decimalOk = false;
  let uniqueOk = false;
  try {
    await prisma.$transaction(async (tx) => {
      const created = await tx.voucher.create({ data: { code, discountType: "PERCENT", discountValue: 12.34, isActive: true }, select: { discountValue: true } });
      decimalOk = Number(created.discountValue) === 12.34;
      // Duplikat harus ditolak; kegagalan ini me-rollback transaksi (tanpa data tertinggal).
      await tx.voucher.create({ data: { code, discountType: "FIXED", discountValue: 1 } });
    });
  } catch (error) {
    uniqueOk = typeof error === "object" && error !== null && "code" in error && error.code === "P2002";
  } finally {
    await prisma.voucher.deleteMany({ where: { code } }).catch(() => undefined);
  }

  check("round-trip Decimal(14,2)", decimalOk, decimalOk ? "" : "nilai tidak kembali 12.34");
  check("unique constraint Voucher.code", uniqueOk, uniqueOk ? "" : "duplikat tidak ditolak");
}

async function main() {
  console.log(`Parity check — provider: ${isSqlite ? "SQLite (lokal)" : "MySQL/MariaDB"}`);
  try {
    await prisma.$queryRawUnsafe("SELECT 1");
    check("koneksi database", true);
  } catch (error) {
    check("koneksi database", false, firstLine(error));
    await prisma.$disconnect();
    process.exitCode = 1;
    return;
  }

  if (!isSqlite) await checkMysqlSchema();
  await checkModelsAndColumns();
  await checkDecimalAndUniqueProbe();

  const failed = results.filter((result) => !result.ok).length;
  console.log(`\n${results.length - failed}/${results.length} pemeriksaan lulus.`);
  if (failed > 0) {
    console.log(`${failed} pemeriksaan GAGAL — jangan lanjutkan rilis sebelum diselesaikan.`);
    process.exitCode = 1;
  }
}

try {
  await main();
} finally {
  await prisma.$disconnect();
}
