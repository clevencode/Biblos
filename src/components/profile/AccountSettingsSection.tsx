import { useEffect, useRef, useState, type FormEvent } from "react";
import {
  completeOnboarding,
  joinFullName,
  preferredDisplayName,
  splitFullName,
  type UserProfile,
} from "../../userProfile";
import { useUiLocale } from "../../i18n/UiLocaleContext";
import { SettingsGroup } from "./SettingsGroup";
import { SettingsRow } from "./SettingsRow";

export type AccountSettingsSectionProps = {
  guest: boolean;
  loading: boolean;
  profile: UserProfile;
  signOutBusy: boolean;
  deleteBusy: boolean;
  onRequestSignIn?: () => void;
  onRefreshProfile: () => void;
  onSignOut: () => void;
  onDeleteAccount: () => void;
};

/** Secção Compte — aberta pelo ícone settings do header. */
export function AccountSettingsSection({
  guest,
  loading,
  profile,
  signOutBusy,
  deleteBusy,
  onRequestSignIn,
  onRefreshProfile,
  onSignOut,
  onDeleteAccount,
}: AccountSettingsSectionProps) {
  const { t } = useUiLocale();
  const [editingName, setEditingName] = useState(false);
  const [confirmSignOut, setConfirmSignOut] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [fullName, setFullName] = useState(() =>
    joinFullName(profile.firstName, profile.lastName),
  );
  const nameInputRef = useRef<HTMLInputElement>(null);
  const displayName = preferredDisplayName(profile) || "…";
  const accountLabel = guest
    ? t("profile.connectAccount")
    : t("profile.accountNameWithBadge", { name: displayName });

  useEffect(() => {
    setFullName(joinFullName(profile.firstName, profile.lastName));
  }, [profile.firstName, profile.lastName]);

  function saveName(event: FormEvent) {
    event.preventDefault();
    const raw = (
      fullName.trim() ||
      nameInputRef.current?.value.trim() ||
      ""
    ).trim();
    const { firstName, lastName } = splitFullName(raw);
    if (!firstName) return;
    completeOnboarding({ firstName, lastName });
    onRefreshProfile();
    setEditingName(false);
  }

  return (
    <SettingsGroup id="profile-settings-account" title={t("profile.account")}>
      {guest ? (
        <SettingsRow
          icon="person"
          label={t("profile.connectAccount")}
          chevron
          disabled={loading}
          onClick={() => onRequestSignIn?.()}
        />
      ) : editingName ? (
        <form className="profile-name-edit settings-account-edit" onSubmit={saveName}>
          <label className="profile-field">
            <span>{t("onboarding.fullName")}</span>
            <input
              ref={nameInputRef}
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              maxLength={128}
              autoComplete="name"
              autoFocus
            />
          </label>
          <div className="profile-delete-actions">
            <button
              type="button"
              className="is-cancel"
              onClick={() => {
                setFullName(joinFullName(profile.firstName, profile.lastName));
                setEditingName(false);
              }}
            >
              {t("common.cancel")}
            </button>
            <button type="submit" className="profile-save-btn">
              {t("profile.saveName")}
            </button>
          </div>
        </form>
      ) : (
        <SettingsRow
          icon="person"
          label={accountLabel}
          value={profile.email || t("profile.connectedAccount")}
          chevron
          onClick={() => setEditingName(true)}
        />
      )}

      {!guest ? (
        <>
          {!confirmSignOut ? (
            <SettingsRow
              icon="close"
              label={t("profile.signOut")}
              disabled={signOutBusy}
              onClick={() => setConfirmSignOut(true)}
            />
          ) : (
            <div className="profile-delete-panel">
              <p>{t("auth.signOutConfirm")}</p>
              {typeof navigator !== "undefined" && !navigator.onLine ? (
                <p>{t("auth.signOutConfirmOffline")}</p>
              ) : null}
              <div className="profile-delete-actions">
                <button
                  type="button"
                  className="is-cancel"
                  disabled={signOutBusy}
                  onClick={() => setConfirmSignOut(false)}
                >
                  {t("common.cancel")}
                </button>
                <button
                  type="button"
                  className="is-confirm"
                  disabled={signOutBusy}
                  onClick={() => {
                    setConfirmSignOut(false);
                    onSignOut();
                  }}
                >
                  {t("auth.signOutConfirmAction")}
                </button>
              </div>
            </div>
          )}

          {!confirmDelete ? (
            <SettingsRow
              icon="delete"
              label={t("profile.deleteAccount")}
              danger
              disabled={deleteBusy}
              onClick={() => setConfirmDelete(true)}
            />
          ) : (
            <div className="profile-delete-panel">
              <p>{t("profile.deleteAccountConfirm")}</p>
              <div className="profile-delete-actions">
                <button
                  type="button"
                  className="is-cancel"
                  disabled={deleteBusy}
                  onClick={() => setConfirmDelete(false)}
                >
                  {t("common.cancel")}
                </button>
                <button
                  type="button"
                  className="is-confirm"
                  disabled={deleteBusy}
                  onClick={onDeleteAccount}
                >
                  {t("profile.deleteAccountAction")}
                </button>
              </div>
            </div>
          )}
        </>
      ) : null}
    </SettingsGroup>
  );
}
