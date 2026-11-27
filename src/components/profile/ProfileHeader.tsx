import { YvIcon } from "../YvIcon";
import {
  preferredDisplayName,
  type UserProfile,
} from "../../userProfile";
import { FREE_MARK_QUOTA } from "../../verseMarks";
import { useUiLocale } from "../../i18n/UiLocaleContext";

function initialsFromName(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0] ?? ""}${parts[parts.length - 1][0] ?? ""}`.toUpperCase();
}

export type ProfileHeaderProps = {
  guest: boolean;
  profile: UserProfile;
  markedCount: number;
  showQuota: boolean;
  quotaPct: number;
  settingsOpen?: boolean;
  onOpenSettings?: () => void;
  /** Convidado: botão « Se connecter » no lugar da engrenagem. */
  onSignIn?: () => void;
  signInDisabled?: boolean;
};

/** Identidade no topo; ícone settings abre a secção Compte. */
export function ProfileHeader({
  guest,
  profile,
  markedCount,
  showQuota,
  quotaPct,
  settingsOpen = false,
  onOpenSettings,
  onSignIn,
  signInDisabled = false,
}: ProfileHeaderProps) {
  const { t } = useUiLocale();
  const displayName = preferredDisplayName(profile) || "…";
  const photoURL = profile.photoURL?.trim() || null;
  const initials = initialsFromName(displayName);

  return (
    <header className="profile-header">
      <div className="profile-header-identity">
        <div className="profile-header-avatar" aria-hidden="true">
          {photoURL ? (
            <img src={photoURL} alt="" className="profile-header-avatar-img" />
          ) : (
            <span className="profile-header-avatar-initials">{initials}</span>
          )}
        </div>
        <div className="profile-header-meta">
          {guest ? (
            <>
              <p className="profile-header-name">{t("profile.guestSaveTitle")}</p>
              <p className="profile-header-lead">{t("profile.guestSaveLead")}</p>
            </>
          ) : (
            <>
              <p className="profile-header-name">{displayName}</p>
              <p className="profile-header-email muted">
                {profile.email || t("profile.connectedAccount")}
              </p>
            </>
          )}
        </div>
        {guest && onSignIn ? (
          <button
            type="button"
            className="profile-header-signin"
            disabled={signInDisabled}
            onClick={onSignIn}
          >
            {t("profile.signIn")}
          </button>
        ) : onOpenSettings ? (
          <button
            type="button"
            className={`profile-header-settings${settingsOpen ? " is-on" : ""}`}
            aria-label={t("profile.account")}
            aria-pressed={settingsOpen}
            onClick={onOpenSettings}
          >
            <YvIcon name={settingsOpen ? "close" : "settings"} opsz={20} />
          </button>
        ) : null}
      </div>

      {guest && showQuota ? (
        <div className="profile-quota">
          <div className="profile-quota-bar" aria-hidden="true">
            <div
              className="profile-quota-fill"
              style={{ width: `${quotaPct}%` }}
            />
          </div>
          <p className="profile-quota-label">
            {t("profile.quotaHint", {
              used: markedCount,
              total: FREE_MARK_QUOTA,
            })}
          </p>
        </div>
      ) : null}
    </header>
  );
}
