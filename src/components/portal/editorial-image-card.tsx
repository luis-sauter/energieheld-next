import Image from "next/image";
import Link from "next/link";
import styles from "./editorial-image-card.module.css";

export function EditorialImageCard({ title, text, href, image, alt, compact = false, sizes }: {
  title: string;
  text: string;
  href: string;
  image: string;
  alt: string;
  compact?: boolean;
  sizes?: string;
}) {
  return <Link href={href} className={`${styles.card}${compact ? ` ${styles.compact}` : ""}`}>
    <span className={styles.image}>
      <Image src={image} alt={alt} fill loading="lazy"
        sizes={sizes ?? (compact
          ? "(max-width: 600px) calc(100vw - 48px), (max-width: 1000px) 45vw, 290px"
          : "(max-width: 600px) calc(100vw - 48px), (max-width: 1340px) 45vw, 600px")} />
    </span>
    <div className={styles.content}>
      <div><h3>{title}</h3><span className={styles.text}>{text}</span></div>
      <span className={styles.arrow} aria-hidden="true">→</span>
    </div>
  </Link>;
}
