import Image from "next/image";
import Link from "next/link";
import type { AdCreative, AdPlacement } from "@/types/portal";
import { Icon } from "./icon";

export function AdBanner({ ad }: { ad: AdCreative }) {
  return (
    <Link href={ad.targetUrl} className="ad-banner" rel="sponsored">
      <Image
        src={ad.image.src}
        alt={ad.image.alt}
        fill
        sizes="(max-width: 700px) 100vw, 60vw"
      />
      <div className="ad-copy">
        <span>{ad.advertiser}</span>
        <strong>{ad.title}</strong>
        <span className="ad-cta">
          Demo ansehen <Icon name="arrow" size={17} />
        </span>
      </div>
    </Link>
  );
}

export function AdSlot({
  placement,
  ad,
}: {
  placement: AdPlacement;
  ad?: AdCreative;
}) {
  return (
    <section
      className={`ad-slot ${placement === "destination_top" ? "ad-top" : "ad-side"}`}
      data-placement={placement}
      aria-label={`Anzeige – ${ad?.advertiser ?? "freier Werbeplatz"}`}
    >
      <div className="ad-label">
        Anzeige <span>· Demobanner</span>
      </div>
      {ad ? (
        <AdBanner ad={ad} />
      ) : (
        <div className="ad-placeholder">Freier Werbeplatz</div>
      )}
    </section>
  );
}
