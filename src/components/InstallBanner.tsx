import { useUiLocale } from "../i18n/UiLocaleContext";
import type { PwaInstallState } from "../hooks/usePwaInstall";

type InstallBannerProps = {
  install: PwaInstallState;
};

/**
 * Banner só para install do navegador (A2HS / hint iOS).
 * Download APK fica no menu Bible — não aqui.
 */
export function InstallBanner({ install }: InstallBannerProps) {
  const { t } = useUiLocale();
  if (install.mode === "hidden") return null;

  const isIos = install.mode === "ios-hint";
  const isBrowser = install.mode === "browser-install";

  return (
    <div className="sw-update-banner" role="status" aria-live="polite">
      <div className="sw-update-banner-copy">
        <p className="sw-update-banner-title">{t("pwaInstall.title")}</p>
        <p className="sw-update-banner-meta">
          {isIos ? t("pwaInstall.iosLead") : t("pwaInstall.lead")}
        </p>
      </div>
      {isBrowser ? (
        <button
          type="button"
          className="sw-update-banner-cta"
          disabled={install.busy || !install.canInstall}
          onClick={() => void install.install({ source: "banner" })}
        >
          {install.busy ? t("pwaInstall.busy") : t("pwaInstall.cta")}
        </button>
      ) : null}
      <button
        type="button"
        className="sw-update-banner-dismiss"
        aria-label={t("common.close")}
        disabled={install.busy}
        onClick={install.dismiss}
      >
        ×
      </button>
    </div>
  );
}
