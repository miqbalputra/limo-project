import { requireActor } from "@/server/auth/session";
import { getEnv } from "@/server/env";
import { apiError, apiOk } from "@/server/http/api-response";
import { getRequestId } from "@/server/http/request-id";
import { assertSameOrigin } from "@/server/security/origin";
import { archiveHeroSlide, updateHeroSlide } from "@/server/services/hero-carousel-service";

export const runtime = "nodejs";

type Context = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, context: Context) {
  const requestId = getRequestId(request.headers);
  try {
    assertSameOrigin(request.headers, getEnv().APP_URL);
    const form = await request.formData();
    const input = Object.fromEntries(["sortOrder", "isActive", "eyebrow", "title", "description", "ctaLabel", "ctaHref", "altText"].filter((key) => form.has(key)).map((key) => [key, form.get(key) ?? ""]));
    const desktop = form.get("desktopImage");
    const mobile = form.get("mobileImage");
    const { id } = await context.params;
    return apiOk(await updateHeroSlide(await requireActor(), id, input, desktop instanceof File ? desktop : null, mobile instanceof File ? mobile : null), { requestId });
  } catch (error) { return apiError(error, { requestId }); }
}

export async function DELETE(request: Request, context: Context) {
  const requestId = getRequestId(request.headers);
  try { assertSameOrigin(request.headers, getEnv().APP_URL); const { id } = await context.params; return apiOk(await archiveHeroSlide(await requireActor(), id), { requestId }); } catch (error) { return apiError(error, { requestId }); }
}
