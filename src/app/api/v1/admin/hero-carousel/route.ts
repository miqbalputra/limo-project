import { requireActor } from "@/server/auth/session";
import { getEnv } from "@/server/env";
import { apiError, apiOk } from "@/server/http/api-response";
import { getRequestId } from "@/server/http/request-id";
import { assertSameOrigin } from "@/server/security/origin";
import { createHeroSlide, listHeroSlides } from "@/server/services/hero-carousel-service";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const requestId = getRequestId(request.headers);
  try { return apiOk(await listHeroSlides(await requireActor()), { requestId }); } catch (error) { return apiError(error, { requestId }); }
}

export async function POST(request: Request) {
  const requestId = getRequestId(request.headers);
  try {
    assertSameOrigin(request.headers, getEnv().APP_URL);
    const form = await request.formData();
    const desktop = form.get("desktopImage");
    const mobile = form.get("mobileImage");
    const input = Object.fromEntries(["sortOrder", "isActive", "eyebrow", "title", "subtitle", "description", "ctaLabel", "ctaHref", "cta2Label", "cta2Href", "altText"].map((key) => [key, form.get(key) ?? ""]));
    return apiOk(await createHeroSlide(await requireActor(), input, desktop instanceof File ? desktop : null, mobile instanceof File ? mobile : null), { requestId }, { status: 201 });
  } catch (error) { return apiError(error, { requestId }); }
}
