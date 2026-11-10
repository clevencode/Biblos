import { EditorialAuthGate } from "./EditorialAuthGate";
import { useEditorialAuth } from "./hooks/useEditorialAuth";
import { AdminReadingPlansWorkspace } from "../../reading-plans/presentation/admin/AdminReadingPlansWorkspace";

type EditorialAdminAppProps = {
  onExit: () => void;
};

/**
 * Presentation — shell admin (Auth gate + workspace tempo real).
 */
export function EditorialAdminApp({ onExit }: EditorialAdminAppProps) {
  const { phase, user, error, signIn, signOut } = useEditorialAuth();

  return (
    <EditorialAuthGate phase={phase} error={error} onSignIn={signIn}>
      <AdminReadingPlansWorkspace
        onExit={onExit}
        userEmail={user?.email ?? null}
        onSignOut={signOut}
      />
    </EditorialAuthGate>
  );
}
