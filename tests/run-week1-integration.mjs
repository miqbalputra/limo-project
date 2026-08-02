import assert from "node:assert/strict";
import { createHash } from "node:crypto";

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
  if (body !== undefined && !(body instanceof FormData)) requestHeaders.set("Content-Type", "application/json");

  const response = await fetch(`${baseUrl}${path}`, {
    method,
    headers: requestHeaders,
    body: body instanceof FormData ? body : body === undefined ? undefined : JSON.stringify(body),
    redirect: "manual",
  });
  const contentType = response.headers.get("content-type") || "";
  const payload = contentType.includes("json") ? await response.json() : await response.text();
  return { response, payload };
}

async function login(email, password = "password-dev-only") {
  const result = await request("/api/v1/auth/login", { method: "POST", body: { email, password } });
  assert.equal(result.response.status, 200, `Login failed for ${email}: ${JSON.stringify(result.payload)}`);
  const setCookie = result.response.headers.get("set-cookie") || "";
  return { ...result, cookie: setCookie.split(";")[0], setCookie };
}

function ok(label) {
  console.log(`ok - ${label}`);
}

try {
  const health = await request("/api/health");
  assert.equal(health.response.status, 200);
  ok("SQLite-backed application health is available");

  const readiness = await request("/api/health/ready");
  assert.equal(readiness.response.status, 200, JSON.stringify(readiness.payload));
  assert.equal(readiness.payload.data.status, "ready");
  assert.equal(readiness.payload.data.checks.environment, "ok");
  assert.equal(readiness.payload.data.checks.database, "ok");
  assert.equal(readiness.payload.data.checks.privateStorage, "ok");
  ok("Readiness probe verifies environment, database, and private storage");

  const admin = await login("admin@limo.local");
  assert.equal(admin.payload.data.actor.role, "ADMIN");
  assert.match(admin.setCookie, /HttpOnly/i);
  assert.match(admin.setCookie, /SameSite=lax/i);
  assert.match(admin.setCookie, /Path=\//i);
  ok("Admin login returns secure session cookie defaults");

  const guru = await login("guru@limo.local");
  const wali = await login("wali@limo.local");
  assert.equal(guru.payload.data.actor.role, "GURU");
  assert.equal(wali.payload.data.actor.role, "WALI");
  ok("Guru and Wali login return their correct roles");

  const invalidLogin = await request("/api/v1/auth/login", { method: "POST", body: { email: "admin@limo.local", password: "incorrect-password" } });
  assert.equal(invalidLogin.response.status, 401);
  ok("Invalid login is rejected");

  const missingOrigin = await request("/api/v1/auth/login", { method: "POST", skipOrigin: true, body: { email: "admin@limo.local", password: "password-dev-only" } });
  assert.equal(missingOrigin.response.status, 403);
  const foreignOrigin = await request("/api/v1/auth/login", { method: "POST", skipOrigin: true, headers: { Origin: "https://example.com" }, body: { email: "admin@limo.local", password: "password-dev-only" } });
  assert.equal(foreignOrigin.response.status, 403);
  ok("Missing and foreign mutation origins are rejected");

  const registrationEmail = `week1-${runId}@example.test`;
  const registration = await request("/api/v1/pendaftaran", {
    method: "POST",
    body: {
      programKind: "ENGLISH",
      studentName: `Siswa Week1 ${runId}`,
      studentBirthDate: "2018-01-15",
      waliName: `Wali Week1 ${runId}`,
      waliEmail: registrationEmail,
      waliPhone: "081234567890",
    },
  });
  assert.equal(registration.response.status, 201, JSON.stringify(registration.payload));
  const registered = registration.payload.data.pendaftaran;

  const lookup = await request(`/api/v1/pendaftaran/status?kode=${encodeURIComponent(registered.kode)}&waliEmail=${encodeURIComponent(registrationEmail)}`);
  assert.equal(lookup.response.status, 200);
  assert.equal(lookup.payload.data.pendaftaran.status, "SUBMITTED");
  ok("Registration submit and protected status lookup work");

  const badUpload = new FormData();
  badUpload.set("kode", registered.kode);
  badUpload.set("waliEmail", registrationEmail);
  badUpload.set("file", new File(["%PDF-invalid"], "dokumen.jpg", { type: "application/pdf" }));
  const uploadResult = await request(`/api/v1/pendaftaran/${registered.id}/files`, { method: "POST", body: badUpload });
  assert.equal(uploadResult.response.status, 400);
  ok("Registration upload rejects extension and MIME mismatch");

  const validUpload = new FormData();
  validUpload.set("kode", registered.kode);
  validUpload.set("waliEmail", registrationEmail);
  validUpload.set("file", new File(["%PDF-1.4\n% Week 1 acceptance"], "dokumen.pdf", { type: "application/pdf" }));
  const validUploadResult = await request(`/api/v1/pendaftaran/${registered.id}/files`, { method: "POST", body: validUpload });
  assert.equal(validUploadResult.response.status, 201, JSON.stringify(validUploadResult.payload));
  assert.equal(typeof validUploadResult.payload.data.file.sizeBytes, "string");
  const fileId = validUploadResult.payload.data.file.id;
  const unauthorizedFile = await request(`/api/v1/files/${fileId}`, { cookie: wali.cookie });
  assert.equal(unauthorizedFile.response.status, 403);
  const adminFile = await request(`/api/v1/files/${fileId}`, { cookie: admin.cookie });
  assert.equal(adminFile.response.status, 200);
  ok("Private registration file is JSON-safe and authorization protected");

  const approve = await request(`/api/v1/admin/pendaftaran/${registered.id}/approve`, { method: "POST", cookie: admin.cookie });
  assert.equal(approve.response.status, 200, JSON.stringify(approve.payload));
  const approveAgain = await request(`/api/v1/admin/pendaftaran/${registered.id}/approve`, { method: "POST", cookie: admin.cookie });
  assert.equal(approveAgain.response.status, 200);
  assert.equal(approveAgain.payload.data.siswaId, approve.payload.data.siswaId);
  const approvedCount = await prisma.siswa.count({ where: { approvedPendaftaran: { id: registered.id } } });
  assert.equal(approvedCount, 1);
  const approvalNotification = await prisma.notifikasi.findFirst({ where: { recipient: registrationEmail, template: "pendaftaran-approved" } });
  assert.ok(approvalNotification);
  assert.match(approvalNotification.body, /reset-password\?token=/);
  ok("Approval is idempotent and creates activation notification");

  const rejectedEmail = `rejected-${runId}@example.test`;
  const rejectedRegistration = await request("/api/v1/pendaftaran", {
    method: "POST",
    body: { programKind: "ARABIC", studentName: `Rejected Student ${runId}`, studentBirthDate: "2019-03-10", waliName: "Rejected Guardian", waliEmail: rejectedEmail, waliPhone: "081234567891" },
  });
  assert.equal(rejectedRegistration.response.status, 201);
  const rejectedId = rejectedRegistration.payload.data.pendaftaran.id;
  const rejectWithoutReason = await request(`/api/v1/admin/pendaftaran/${rejectedId}/reject`, { method: "POST", cookie: admin.cookie, body: { reason: "singkat" } });
  assert.equal(rejectWithoutReason.response.status, 400);
  const rejectionReason = "Dokumen identitas perlu diperbarui";
  const reject = await request(`/api/v1/admin/pendaftaran/${rejectedId}/reject`, { method: "POST", cookie: admin.cookie, body: { reason: rejectionReason } });
  assert.equal(reject.response.status, 200);
  const rejectedCode = rejectedRegistration.payload.data.pendaftaran.kode;
  const rejectedStatus = await request(`/api/v1/pendaftaran/status?kode=${encodeURIComponent(rejectedCode)}&waliEmail=${encodeURIComponent(rejectedEmail)}`);
  assert.equal(rejectedStatus.payload.data.pendaftaran.status, "REJECTED");
  assert.equal(rejectedStatus.payload.data.pendaftaran.rejectionReason, rejectionReason);
  assert.ok(await prisma.notifikasi.findFirst({ where: { recipient: rejectedEmail, template: "pendaftaran-rejected" } }));
  ok("Rejection requires a safe reason and creates public status plus notification record");

  const nonAdminStudentAccess = await request("/api/v1/admin/siswa", { cookie: wali.cookie });
  assert.equal(nonAdminStudentAccess.response.status, 403);
  ok("Wali cannot bypass role protection for Student Data API");

  const foreignInvoice = await prisma.tagihan.create({
    data: { siswaId: approve.payload.data.siswaId, periode: new Date("2026-09-01T00:00:00.000Z"), jenis: `WEEK1-${runId}`, amount: 100000, status: "UNPAID", dueDate: new Date("2026-09-10T00:00:00.000Z") },
  });
  const foreignInvoiceAccess = await request(`/api/v1/tagihan/${foreignInvoice.id}`, { cookie: wali.cookie });
  assert.equal(foreignInvoiceAccess.response.status, 403);
  ok("Wali cannot access another student's invoice by ID");

  const program = await prisma.program.findFirstOrThrow({ where: { kind: "ENGLISH" } });
  const sourceClass = await prisma.kelas.findFirstOrThrow({ where: { programId: program.id } });
  const destinationClass = await prisma.kelas.create({
    data: { name: `Week1 Destination ${runId}`, programId: sourceClass.programId, levelId: sourceClass.levelId, guruProfileId: sourceClass.guruProfileId },
  });
  const otherGuruUser = await prisma.user.create({ data: { email: `other-guru-${runId}@example.test`, name: "Other Guru", passwordHash: "not-used", role: "GURU" } });
  const otherGuru = await prisma.guruProfile.create({ data: { userId: otherGuruUser.id } });
  const foreignClass = await prisma.kelas.create({ data: { name: `Foreign Class ${runId}`, programId: sourceClass.programId, levelId: sourceClass.levelId, guruProfileId: otherGuru.id } });
  const foreignClassAccess = await request(`/api/v1/guru/kelas/${foreignClass.id}/sesi`, { cookie: guru.cookie });
  assert.equal(foreignClassAccess.response.status, 403);
  ok("Guru cannot access a class assigned to another teacher");
  const guardian = await prisma.waliProfile.findFirstOrThrow({ where: { user: { email: "wali@limo.local" } } });
  const studentNumber = `W1-${runId}`;
  const createStudent = await request("/api/v1/admin/siswa", {
    method: "POST",
    cookie: admin.cookie,
    body: { nomorInduk: studentNumber, name: `Student CRUD ${runId}`, birthDate: "2017-02-10", programId: program.id, waliProfileId: guardian.id, kelasId: sourceClass.id, startDate: "2026-07-01" },
  });
  assert.equal(createStudent.response.status, 201, JSON.stringify(createStudent.payload));
  const studentId = createStudent.payload.data.item.id;

  const updateStudent = await request(`/api/v1/admin/siswa/${studentId}`, {
    method: "PATCH",
    cookie: admin.cookie,
    body: { name: `Student Updated ${runId}`, birthDate: "2017-02-10", programId: program.id, status: "ACTIVE" },
  });
  assert.equal(updateStudent.response.status, 200);

  const transfer = await request(`/api/v1/admin/siswa/${studentId}/transfer`, {
    method: "POST",
    cookie: admin.cookie,
    body: { kelasId: destinationClass.id, startDate: "2026-08-01" },
  });
  assert.equal(transfer.response.status, 201, JSON.stringify(transfer.payload));
  const enrollments = await prisma.kelasSiswa.findMany({ where: { siswaId: studentId }, orderBy: { startDate: "asc" } });
  assert.equal(enrollments.length, 2);
  assert.equal(enrollments[0].status, "TRANSFERRED");
  assert.equal(enrollments[1].status, "ACTIVE");

  const csv = await request("/api/v1/admin/siswa/export", { cookie: admin.cookie });
  assert.equal(csv.response.status, 200);
  assert.match(csv.response.headers.get("content-type") || "", /text\/csv/);
  assert.match(csv.payload, new RegExp(studentNumber));

  const archive = await request(`/api/v1/admin/siswa/${studentId}`, { method: "DELETE", cookie: admin.cookie });
  assert.equal(archive.response.status, 200);
  const restore = await request(`/api/v1/admin/siswa/${studentId}/restore`, { method: "POST", cookie: admin.cookie });
  assert.equal(restore.response.status, 200);
  ok("Student create, update, transfer history, CSV, archive, and restore work");

  const changed = await request("/api/v1/auth/change-password", {
    method: "POST",
    cookie: guru.cookie,
    body: { currentPassword: "password-dev-only", newPassword: "temporary-week1-password" },
  });
  assert.equal(changed.response.status, 200, JSON.stringify(changed.payload));
  const rotatedGuruCookie = (changed.response.headers.get("set-cookie") || "").split(";")[0];
  const oldSession = await request("/api/v1/auth/me", { cookie: guru.cookie });
  assert.equal(oldSession.response.status, 200);
  assert.equal(oldSession.payload.data.actor, null);
  const restorePassword = await request("/api/v1/auth/change-password", {
    method: "POST",
    cookie: rotatedGuruCookie,
    body: { currentPassword: "temporary-week1-password", newPassword: "password-dev-only" },
  });
  assert.equal(restorePassword.response.status, 200);
  const restoredGuruCookie = (restorePassword.response.headers.get("set-cookie") || "").split(";")[0];
  ok("Password change rotates session and revokes the previous session");

  const guruUser = await prisma.user.findUniqueOrThrow({ where: { email: "guru@limo.local" } });
  const expiredRawToken = `expired-${runId}`;
  await prisma.session.create({
    data: { tokenHash: createHash("sha256").update(expiredRawToken).digest("hex"), userId: guruUser.id, expiresAt: new Date(Date.now() - 60_000) },
  });
  const expiredSession = await request("/api/v1/auth/me", { cookie: `limo_session=${expiredRawToken}` });
  assert.equal(expiredSession.payload.data.actor, null);
  const revokeSessions = await request(`/api/v1/admin/users/${guruUser.id}/sessions/revoke`, { method: "POST", cookie: admin.cookie });
  assert.equal(revokeSessions.response.status, 200);
  const revokedSession = await request("/api/v1/auth/me", { cookie: restoredGuruCookie });
  assert.equal(revokedSession.payload.data.actor, null);
  ok("Expired and admin-revoked sessions are rejected");

  const temporaryEmail = `inactive-${runId}@example.test`;
  const createGuru = await request("/api/v1/admin/guru", { method: "POST", cookie: admin.cookie, body: { name: "Temporary User", email: temporaryEmail, phone: "", address: "" } });
  assert.equal(createGuru.response.status, 201);
  const temporaryUser = await prisma.user.findUniqueOrThrow({ where: { email: temporaryEmail } });
  const deactivate = await request(`/api/v1/admin/users/${temporaryUser.id}/status`, { method: "PATCH", cookie: admin.cookie, body: { status: "INACTIVE" } });
  assert.equal(deactivate.response.status, 200);
  assert.equal((await prisma.user.findUniqueOrThrow({ where: { id: temporaryUser.id } })).status, "INACTIVE");
  const activationNotification = await prisma.notifikasi.findFirst({ where: { recipient: temporaryEmail, template: "account-activation" } });
  assert.ok(activationNotification);
  ok("Admin-created account receives activation record and can be deactivated");
} finally {
  await prisma.$disconnect();
}
