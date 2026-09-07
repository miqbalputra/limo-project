import { apiError, apiOk } from "@/server/http/api-response";
import { getRequestId } from "@/server/http/request-id";
import { listPublishedHeroSlides } from "@/server/services/hero-carousel-service";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const requestId = getRequestId(request.headers);
  try {
    const items = await listPublishedHeroSlides();
    return apiOk({ items: items.map((item) => ({
      id: item.id,
      sortOrder: item.sortOrder,
      isActive: item.isActive,
      eyebrow: item.eyebrow,
      title: item.title,
      description: item.description,
      ctaLabel: item.ctaLabel,
      ctaHref: item.ctaHref,
      altText: item.altText,
      desktopImageUrl: `/api/v1/public/hero-slides/${item.id}/image?variant=desktop`,
      mobileImageUrl: `/api/v1/public/hero-slides/${item.id}/image?variant=mobile`,
      desktopImageMimeType: item.desktopImageMimeType,
      mobileImageMimeType: item.mobileImageMimeType,
    })) }, { requestId });
  } catch (error) { return apiError(error, { requestId }); }
}
