import { Capacitor } from "@capacitor/core";
import { useState } from "react";
import { BIBLE_TEXT_VERSIONS } from "../../bible/bibleVersions";
import type { ApkUpdateState } from "../../hooks/useApkUpdate";
import type { PwaInstallState } from "../../hooks/usePwaInstall";
import { useUiLocale } from "../../i18n/UiLocaleContext";
import { applyPendingSwUpdate, checkForSwUpdate } from "../../swUpdateManager";
import { SettingsGroup } from "./SettingsGroup";
import { SettingsRow } from "./SettingsRow";

/** Estado de instalação / update vindo do shell (App). */
export type ProfileAppUpdates = {
  pwaInstall: PwaInstallState;
  apkUpdate: ApkUpdateState;
  swUpdatePending: boolean;
};

export type ProfileAboutSectionProps = {
  /** Convidado (sem abas): mostra o título « À propos » no grupo. */
  titled?: boolean;
  appUpdates?: ProfileAppUpdates | null;
};

/**
 * Instalar + atualizar, sempre visíveis (sem dismiss): os banners podem ser
 * fechados, esta secção não.
 */
function AppInstallUpdateRows({ pwaInstall, apkUpdate, swUpdatePending }: ProfileAppUpdates) {
  const { t } = useUiLocale();
  const [checking, setChecking] = useState(false);
  const mode = pwaInstall.aboutMode;

  const installRow =
    mode === "installed" ? (
      <SettingsRow
        icon="check_circle"
        iconFilled
        ready
        label={t("profile.aboutInstalled")}
      />
    ) : mode === "browser-install" || mode === "apk-download" ? (
      <SettingsRow
        icon="download"
        label={
          pwaInstall.busy
            ? t("pwaInstall.busy")
            : mode === "apk-download"
              ? t("pwaInstall.apkCta")
              : t("pwaInstall.cta")
        }
        value={mode === "apk-download" ? t("pwaInstall.apkLead") : t("pwaInstall.lead")}
        busy={pwaInstall.busy}
        disabled={pwaInstall.busy}
        chevron
        onClick={() =>
          void pwaInstall.install({
            source: mode === "apk-download" ? "menu" : "banner",
          })
        }
      />
    ) : (
      <SettingsRow
        icon={mode === "ios-hint" ? "ios_share" : "download"}
        label={t("pwaInstall.title")}
        value={
          mode === "ios-hint"
            ? t("pwaInstall.iosLead")
            : t("profile.aboutInstallBrowserHint")
        }
      />
    );

  const updateRow = swUpdatePending ? (
    <SettingsRow
      icon="sync"
      label={t("swUpdate.cta")}
      value={t("swUpdate.lead")}
      chevron
      onClick={() => void applyPendingSwUpdate()}
    />
  ) : apkUpdate.pending ? (
    <SettingsRow
      icon="sync"
      label={apkUpdate.busy ? t("pwaInstall.busy") : t("swUpdate.cta")}
      value={t("swUpdate.lead")}
      busy={apkUpdate.busy}
      disabled={apkUpdate.busy}
      chevron
      onClick={() => void apkUpdate.update()}
    />
  ) : Capacitor.isNativePlatform() ? (
    /* Nativo: verificação do APK corre no arranque (useApkUpdate). */
    <SettingsRow icon="check_circle" label={t("profile.aboutUpToDate")} />
  ) : (
    <SettingsRow
      icon="sync"
      label={checking ? t("profile.aboutChecking") : t("profile.aboutCheckUpdate")}
      value={t("profile.aboutUpToDate")}
      busy={checking}
      disabled={checking}
      onClick={() => {
        setChecking(true);
        void checkForSwUpdate().finally(() => setChecking(false));
      }}
    />
  );

  return (
    <SettingsGroup title={t("profile.aboutUpdates")}>
      {installRow}
      {updateRow}
    </SettingsGroup>
  );
}

/** Profil › À propos: app, versão, instalar/atualizar e créditos dos textos. */
export function ProfileAboutSection({
  titled = false,
  appUpdates = null,
}: ProfileAboutSectionProps) {
  const { t } = useUiLocale();
  return (
    <>
      <SettingsGroup title={titled ? t("profile.group.about") : undefined}>
        <div className="settings-row is-static profile-about-brand">
          <img
            src="/favicon.svg"
            alt=""
            className="profile-about-logo"
            width={40}
            height={40}
          />
          <span className="settings-row-body">
            <span className="settings-row-label">Biblos</span>
            <span className="settings-row-value muted">
              {t("profile.aboutTagline")}
            </span>
          </span>
        </div>
        <SettingsRow
          icon="info"
          label={t("profile.aboutAppVersion")}
          value={__APP_VERSION__}
        />
      </SettingsGroup>
      {appUpdates ? <AppInstallUpdateRows {...appUpdates} /> : null}
      <SettingsGroup title={t("profile.aboutTexts")}>
        {BIBLE_TEXT_VERSIONS.map((version) => (
          <SettingsRow
            key={version.id}
            icon="menu_book"
            label={`${version.title} (${version.abbreviation})`}
            value={version.copyright}
          />
        ))}
      </SettingsGroup>
      <p className="settings-hint muted profile-about-footnote">
        {t("profile.aboutMadeWith")}
      </p>
    </>
  );
}
