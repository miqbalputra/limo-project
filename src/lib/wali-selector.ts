export const WALI_ALL_CHILDREN_VALUE = "__all__";
export const WALI_CHILD_QUERY_PARAM = "anak";

const WALI_CHILD_SCOPED_PATHS = [
  "/wali/tugas",
  "/wali/materi",
  "/wali/rpp",
  "/wali/progres",
  "/wali/kalender",
  "/wali/presensi",
  "/wali/nilai",
  "/wali/tagihan",
  "/wali/pembayaran",
] as const;

export function isWaliChildScopedPath(pathname: string) {
  return pathname === "/wali" || WALI_CHILD_SCOPED_PATHS.some((path) => pathname === path || pathname.startsWith(`${path}/`));
}

export function getWaliChildIdFromLocation(pathname: string, searchParams: Pick<URLSearchParams, "get">) {
  if (!isWaliChildScopedPath(pathname)) {
    return null;
  }

  const segments = pathname.split("/").filter(Boolean);
  if (segments[0] !== "wali") {
    return null;
  }

  if (segments[1] === "progres" && segments[2]) {
    return segments[2];
  }

  if (segments[1] === "tugas" && segments[2] && segments[2] !== "attempt") {
    return segments[2];
  }

  return searchParams.get(WALI_CHILD_QUERY_PARAM);
}

export function withWaliChildContext(pathname: string, childId: string | null | undefined, searchParams?: Pick<URLSearchParams, "toString">) {
  const params = new URLSearchParams(searchParams?.toString());
  const normalizedChildId = childId?.trim();

  if (normalizedChildId && normalizedChildId !== WALI_ALL_CHILDREN_VALUE) {
    params.set(WALI_CHILD_QUERY_PARAM, normalizedChildId);
  } else {
    params.delete(WALI_CHILD_QUERY_PARAM);
  }

  const query = params.toString();
  return query ? `${pathname}?${query}` : pathname;
}
