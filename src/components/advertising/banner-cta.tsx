import styles from "./advertising.module.css";
// Part of the existing banner link: no second click target or tracking path.
export function BannerCta() {
  return <span className={styles.bannerCta} aria-hidden="true">Mehr entdecken →</span>;
}
