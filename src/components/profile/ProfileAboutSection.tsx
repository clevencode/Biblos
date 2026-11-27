import { BIBLE_TEXT_VERSIONS } from "../../bible/bibleVersions";
import { useUiLocale } from "../../i18n/UiLocaleContext";
import { SettingsGroup } from "./SettingsGroup";
import { SettingsRow } from "./SettingsRow";

export type ProfileAboutSectionProps = {
  /** Convidado (sem abas): mostra o título « À propos » no grupo. */
  titled?: boolean;
};

/** Profil › À propos: app, versão e créditos dos textos bíblicos. */
export function ProfileAboutSection({ titled = false }: ProfileAboutSectionProps) {
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
