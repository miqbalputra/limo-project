import assert from "node:assert/strict";

process.env.DATABASE_URL ||= "file:./dev.db";

const { PrismaClient } = await import("@prisma/client");
const prisma = new PrismaClient();
const baseUrl = process.env.TEST_BASE_URL || "http://127.0.0.1:3000";
const origin = baseUrl;
const runId = `${Date.now()}-${Math.random().toString(16).slice(2)}`;

async function request(path, { method = "GET", body, cookie, headers = {}, skipOrigin = false } = {}) {
  const requestHeaders = new Headers(headers);
  if (method !== "GET" && !skipOrigin) requestHeaders.set("Origin", origin);
  if (cookie) requestHeaders.set("Cookie", cookie);
  if (body !== undefined) requestHeaders.set("Content-Type", "application/json");
  const response = await fetch(`${baseUrl}${path}`, { method, headers: requestHeaders, body: body === undefined ? undefined : JSON.stringify(body), redirect: "manual" });
  const contentType = response.headers.get("content-type") || "";
  const payload = contentType.includes("json") ? await response.json() : await response.text();
  return { response, payload };
}

async function login(identifier) {
  const result = await request("/api/v1/auth/login", { method: "POST", body: { email: identifier, password: "password-dev-only" } });
  assert.equal(result.response.status, 200, `Login failed for ${identifier}: ${JSON.stringify(result.payload)}`);
  const setCookie = result.response.headers.get("set-cookie") || "";
  return { ...result, cookie: setCookie.split(";")[0] };
}

function ok(label) {
  console.log(`ok - ${label}`);
}

try {
  const guru = await login("guru@limo.local");
  const student = await login("LIMO-DEV-001");
  const wali = await login("wali@limo.local");
  const guruUser = await prisma.user.findUniqueOrThrow({ where: { email: "guru@limo.local" }, include: { guruProfile: true } });
  const studentAccount = await prisma.siswaAccount.findFirstOrThrow({ where: { loginIdentifier: "limo-dev-001", status: "ACTIVE" } });
  const kelas = await prisma.kelas.findFirst({ where: { guruProfileId: guruUser.guruProfile.id, status: "ACTIVE", enrollments: { some: { siswaId: studentAccount.siswaId, status: "ACTIVE" } } } });
  assert.ok(kelas, "Seeded Guru and Siswa must share an active class");

  let material = await prisma.materi.findFirst({ where: { kelasId: kelas.id, status: "PUBLISHED" }, select: { id: true, title: true } });
  if (!material) {
    material = await prisma.materi.create({ data: { kelasId: kelas.id, type: "TEXT", status: "PUBLISHED", title: `Module material ${runId}`, content: "Existing material for Fase 2", createdById: guruUser.id }, select: { id: true, title: true } });
  }

  const create = await request(`/api/v1/guru/kelas/${kelas.id}/modul`, { method: "POST", cookie: guru.cookie, body: { title: `Fase 2 Module ${runId}`, description: "Structured learning flow", order: 0 } });
  assert.equal(create.response.status, 201, JSON.stringify(create.payload));
  const moduleId = create.payload.data.item.id;
  ok("Guru can create a learning module for an owned class");

  const add = await request(`/api/v1/guru/modul/${moduleId}/items`, { method: "POST", cookie: guru.cookie, body: { itemType: "MATERIAL", entityId: material.id, isRequired: true } });
  assert.equal(add.response.status, 201, JSON.stringify(add.payload));
  const duplicateItem = await request(`/api/v1/guru/modul/${moduleId}/items`, { method: "POST", cookie: guru.cookie, body: { itemType: "MATERIAL", entityId: material.id } });
  assert.equal(duplicateItem.response.status, 409, JSON.stringify(duplicateItem.payload));
  ok("Module item creation reuses existing material and rejects duplicate attachment");

  const listed = await request(`/api/v1/guru/kelas/${kelas.id}/modul`, { cookie: guru.cookie });
  assert.equal(listed.response.status, 200, JSON.stringify(listed.payload));
  const listedModule = listed.payload.data.items.find((item) => item.id === moduleId);
  assert.ok(listedModule);
  assert.equal(listedModule.items.length, 1);
  const itemId = listedModule.items[0].id;
  const reorder = await request(`/api/v1/guru/modul/${moduleId}/reorder`, { method: "PATCH", cookie: guru.cookie, body: { itemIds: [itemId] } });
  assert.equal(reorder.response.status, 200, JSON.stringify(reorder.payload));
  ok("Guru can list and transactionally reorder module items");

  const publish = await request(`/api/v1/guru/modul/${moduleId}/publish`, { method: "POST", cookie: guru.cookie });
  assert.equal(publish.response.status, 200, JSON.stringify(publish.payload));
  const studentModules = await request(`/api/v1/siswa/kelas/${kelas.id}/modul`, { cookie: student.cookie });
  assert.equal(studentModules.response.status, 200, JSON.stringify(studentModules.payload));
  assert.equal(studentModules.payload.data.items.some((item) => item.id === moduleId), true);
  const waliModules = await request(`/api/v1/wali/anak/${studentAccount.siswaId}/kelas/${kelas.id}/modul`, { cookie: wali.cookie });
  assert.equal(waliModules.response.status, 200, JSON.stringify(waliModules.payload));
  assert.equal(waliModules.payload.data.items.some((item) => item.id === moduleId), true);
  ok("Published modules are visible to the enrolled Siswa and related Wali");

  const guruPage = await request(`/guru/kelas/${kelas.id}/modul`, { cookie: guru.cookie });
  assert.equal(guruPage.response.status, 200);
  const studentPage = await request(`/siswa/kelas/${kelas.id}/modul`, { cookie: student.cookie });
  assert.equal(studentPage.response.status, 200);
  const waliPage = await request(`/wali/progres/${studentAccount.siswaId}/modul`, { cookie: wali.cookie });
  assert.equal(waliPage.response.status, 200);
  ok("Guru builder, Siswa structure, and Wali read-only pages render");

  const duplicate = await request(`/api/v1/guru/modul/${moduleId}/duplicate`, { method: "POST", cookie: guru.cookie });
  assert.equal(duplicate.response.status, 201, JSON.stringify(duplicate.payload));
  assert.equal(duplicate.payload.data.item.itemCount, 1);
  const archived = await request(`/api/v1/guru/modul/${moduleId}/archive`, { method: "POST", cookie: guru.cookie });
  assert.equal(archived.response.status, 200, JSON.stringify(archived.payload));
  const hiddenAfterArchive = await request(`/api/v1/siswa/kelas/${kelas.id}/modul`, { cookie: student.cookie });
  assert.equal(hiddenAfterArchive.response.status, 200);
  assert.equal(hiddenAfterArchive.payload.data.items.some((item) => item.id === moduleId), false);
  ok("Duplicate creates a draft copy and archived modules disappear from the Siswa view");
} finally {
  await prisma.$disconnect();
}
