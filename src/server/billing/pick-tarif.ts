export type TarifCandidate = {
  id: string;
  amount: unknown;
  effectiveFrom: Date;
  programId?: string | null;
  kelasId?: string | null;
  siswaId?: string | null;
};

export type TarifScope = {
  siswaId: string;
  kelasId?: string | null;
  programId?: string | null;
};

/**
 * Pilih tarif yang dipakai untuk seorang siswa.
 *
 * Prioritas: tarif khusus **siswa** > tarif **kelas** > tarif **program**.
 * Bila prioritasnya sama, dipakai `effectiveFrom` paling baru.
 */
export function pickTarifForStudent<T extends TarifCandidate>(candidates: T[], scope: TarifScope): T | null {
  const rankOf = (tarif: T) => {
    if (tarif.siswaId && tarif.siswaId === scope.siswaId) return 3;
    if (tarif.kelasId && scope.kelasId && tarif.kelasId === scope.kelasId) return 2;
    if (tarif.programId && scope.programId && tarif.programId === scope.programId) return 1;
    return 0;
  };

  let best: T | null = null;
  let bestRank = 0;

  for (const tarif of candidates) {
    const rank = rankOf(tarif);
    if (rank === 0) continue;
    if (!best || rank > bestRank || (rank === bestRank && tarif.effectiveFrom > best.effectiveFrom)) {
      best = tarif;
      bestRank = rank;
    }
  }

  return best;
}
