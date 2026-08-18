import "./load-env.ts";
import argon2 from "argon2";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const argon2Options = {
  type: argon2.argon2id,
  memoryCost: 19456,
  timeCost: 2,
  parallelism: 1,
} as const;

function required(name: string) {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`${name} wajib diisi.`);
  }
  return value;
}

async function main() {
  if (process.env.LIMO_ALLOW_ADMIN_BOOTSTRAP !== "true") {
    throw new Error("Bootstrap admin diblokir. Set LIMO_ALLOW_ADMIN_BOOTSTRAP=true hanya untuk eksekusi satu kali.");
  }

  const email = required("LIMO_BOOTSTRAP_ADMIN_EMAIL").toLowerCase();
  const name = required("LIMO_BOOTSTRAP_ADMIN_NAME");
  const password = required("LIMO_BOOTSTRAP_ADMIN_PASSWORD");

  if (!/^\S+@\S+\.\S+$/.test(email)) {
    throw new Error("LIMO_BOOTSTRAP_ADMIN_EMAIL harus berupa email yang valid.");
  }
  if (password.length < 12) {
    throw new Error("LIMO_BOOTSTRAP_ADMIN_PASSWORD minimal 12 karakter.");
  }

  const existingEmail = await prisma.user.findUnique({ where: { email }, select: { id: true, role: true } });
  if (existingEmail) {
    throw new Error(`Email ${email} sudah terdaftar sebagai ${existingEmail.role}. Tidak ada data yang diubah.`);
  }

  const existingAdmin = await prisma.user.findFirst({ where: { role: "ADMIN" }, select: { email: true } });
  if (existingAdmin) {
    throw new Error(`Admin sudah tersedia (${existingAdmin.email}). Gunakan fitur ganti password setelah login.`);
  }

  const passwordHash = await argon2.hash(password, argon2Options);
  const admin = await prisma.$transaction(async (tx) => {
    const created = await tx.user.create({
      data: {
        email,
        name,
        passwordHash,
        role: "ADMIN",
        status: "ACTIVE",
      },
    });

    await tx.auditLog.create({
      data: {
        actorId: created.id,
        action: "ADMIN_BOOTSTRAPPED",
        entityType: "User",
        entityId: created.id,
        reason: "Initial production administrator created through an explicit one-time bootstrap.",
      },
    });

    return created;
  });

  console.log(`Initial admin created: ${admin.email}`);
  console.log("Remove the bootstrap environment variables before the next deployment.");
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
