import { useUiLocale } from "../i18n/UiLocaleContext";
import type { PwaInstallState } from "../hooks/usePwaInstall";

type InstallBannerProps = {
  install: PwaInstallState;
};

/** Banner install — APK (Android) ou hint iOS; mesma UI `.sw-update-banner`. */
export function InstallBanner({ install }: InstallBannerProps) {
  const { t } = useUiLocale();
  if (install.mode === "hidden") return null;

  const isIos = install.mode === "ios-hint";
  const isApk = install.mode === "apk-download";

  return (
    <div className="sw-update-banner" role="status" aria-live="polite">
      <div className="sw-update-banner-copy">
        <p className="sw-update-banner-title">{t("pwaInstall.title")}</p>
        <p className="sw-update-banner-meta">
          {isIos
            ? t("pwaInstall.iosLead")
            : isApk
              ? t("pwaInstall.apkLead")
              : t("pwaInstall.lead")}
        </p>
      </div>
      {isApk ? (
        <button
          type="button"
          className="sw-update-banner-cta"
          disabled={install.busy || !install.canInstall}
          onClick={() => void install.install()}
        >
          {install.busy ? t("pwaInstall.busy") : t("pwaInstall.apkCta")}
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
