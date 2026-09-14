import "server-only";
import { normalizeEmail } from "@/server/auth/password";
import { prisma } from "@/server/db/prisma";
import { NotFoundError } from "@/server/errors/application-error";
import { normalizePhone } from "@/lib/phone";
import { removePrivateFile, storePrivateFile } from "@/server/providers/storage/local-storage";

export async function uploadDokumenPendaftaran(input: {
  pendaftaranId: string;
  kode: string;
  identitas?: string;
  waliEmail?: string;
  file: File;
}) {
  const identitas = (input.identitas && input.identitas.trim()) || input.waliEmail || "";
  const identitasEmail = normalizeEmail(identitas);
  const identitasPhone = normalizePhone(identitas);
  const identityFilters: Record<string, string>[] = [];

  if (identitasEmail.includes("@")) {
    identityFilters.push({ waliEmail: identitasEmail });
  }

  if (identitasPhone.length >= 8) {
    identityFilters.push({ waliPhone: identitasPhone });
  }

  if (identityFilters.length === 0) {
    throw new NotFoundError("Pendaftaran tidak ditemukan atau tidak dapat menerima dokumen");
  }

  const pendaftaran = await prisma.pendaftaran.findFirst({
    where: {
      id: input.pendaftaranId,
      kode: input.kode,
      status: { in: ["SUBMITTED", "UNDER_REVIEW"] },
      OR: identityFilters,
    },
    select: { id: true },
  });

  if (!pendaftaran) {
    throw new NotFoundError("Pendaftaran tidak ditemukan atau tidak dapat menerima dokumen");
  }

  const storedFile = await storePrivateFile(input.file, `pendaftaran/${pendaftaran.id}`);

  const asset = await prisma.fileAsset.create({
    data: {
      ownerType: "PENDAFTARAN",
      ownerId: pendaftaran.id,
      pendaftaranId: pendaftaran.id,
      originalName: storedFile.originalName,
      storedName: storedFile.storedName,
      storagePath: storedFile.storagePath,
      mimeType: storedFile.mimeType,
      sizeBytes: storedFile.sizeBytes,
      checksumSha256: storedFile.checksumSha256,
      visibility: "PRIVATE",
    },
    select: {
      id: true,
      originalName: true,
      mimeType: true,
      sizeBytes: true,
      createdAt: true,
    },
  }).catch(async (error) => {
    await removePrivateFile(storedFile.storagePath);
    throw error;
  });

  return { file: { ...asset, sizeBytes: asset.sizeBytes.toString() } };
}
