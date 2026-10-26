export default function PortalLoading() {
  return <main id="hauptinhalt" className="container portal-loading" aria-busy="true">
    <p className="eyebrow">DAS-Reiseportal.com</p>
    <p role="status">Ihre Seite wird geladen …</p>
    <div className="portal-loading-placeholder" aria-hidden="true" />
  </main>;
}
