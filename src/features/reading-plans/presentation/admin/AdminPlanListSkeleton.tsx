import { Skeleton } from "../../../../skeleton/Skeleton";

const ROWS = 5;

/** CLS — mesma silhueta que `profile-row-btn` na lista admin. */
export function AdminPlanListSkeleton() {
  return (
    <ul
      className="editorial-admin-plan-stack editorial-admin-plan-stack--skeleton"
      role="status"
      aria-busy="true"
      aria-label="Chargement des plans"
    >
      {Array.from({ length: ROWS }, (_, i) => (
        <li key={`admin-plan-skel-${i}`} className="editorial-admin-plan-skel-row" aria-hidden>
          <Skeleton block height={52} borderRadius={14} />
        </li>
      ))}
    </ul>
  );
}
