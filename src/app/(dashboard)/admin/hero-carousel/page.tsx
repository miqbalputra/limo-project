import { HeroCarouselActions } from "@/components/dashboard/hero-carousel-actions";
import { HeroCarouselForm } from "@/components/dashboard/hero-carousel-form";
import { EmptyState } from "@/components/dashboard/dashboard-widgets";
import { requireActor } from "@/server/auth/session";
import { requirePermission } from "@/server/auth/permissions";
import { listHeroSlides } from "@/server/services/hero-carousel-service";

export const metadata = { title: "Hero Carousel" };

export default async function AdminHeroCarouselPage() {
  const actor = await requireActor();
  await requirePermission(actor, "admin.schedule.manage");
  const { items } = await listHeroSlides(actor);
  return (
    <main className="space-y-6">
      <div>
        <h1 className="tailadmin-page-title">Hero Carousel</h1>
        <p className="mt-2 tailadmin-muted">Kelola slide hero terpisah untuk desktop dan mobile.</p>
      </div>
      <HeroCarouselForm />
      {items.length > 0 ? <section className="grid gap-4 md:grid-cols-2">
        {items.map((item) => (
          <article key={item.id} className="tailadmin-card overflow-hidden p-5">
            <div className="grid gap-3 sm:grid-cols-2">
              <img src={`/api/v1/public/hero-slides/${item.id}/image?variant=desktop`} alt={item.altText} className="aspect-video w-full rounded-xl object-cover" />
              <img src={`/api/v1/public/hero-slides/${item.id}/image?variant=mobile`} alt="" aria-hidden="true" className="aspect-[4/5] w-full rounded-xl object-cover" />
            </div>
            <p className="mt-4 text-theme-xs font-bold uppercase tracking-wider text-limo-blue-700">{item.eyebrow || "Hero slide"}</p>
            <h2 className="mt-1 text-lg font-bold text-gray-900">{item.title}</h2>
            <p className="mt-2 text-sm text-gray-600">{item.description || "Tanpa deskripsi"}</p>
            <p className="mt-3 text-xs text-gray-500">Urutan {item.sortOrder} · {item.isActive ? "Aktif" : "Arsip"}</p>
            <HeroCarouselActions slide={{ id: item.id, active: item.isActive, sortOrder: item.sortOrder, eyebrow: item.eyebrow ?? "", title: item.title, subtitle: item.subtitle ?? "", description: item.description ?? "", textPosition: item.textPosition, textTheme: item.textTheme, ctaLabel: item.ctaLabel ?? "", ctaHref: item.ctaHref ?? "", cta2Label: item.cta2Label ?? "", cta2Href: item.cta2Href ?? "", altText: item.altText }} />
          </article>
        ))}
      </section> : <EmptyState icon="materials" title="Belum ada hero slide" description="Tambahkan slide pertama melalui formulir di atas agar tampil di halaman publik." />}
    </main>
  );
}
