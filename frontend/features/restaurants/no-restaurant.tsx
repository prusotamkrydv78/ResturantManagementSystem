import { Store } from "lucide-react";
import { Surface } from "@/components/ui/surface";
import { EmptyState } from "@/components/ui/states";

/**
 * What a manager sees before a restaurant has been assigned to them.
 *
 * A real state, not a failure: a platform admin can create a manager and assign the
 * restaurant later, so an account can legitimately sit here for a while. It is one
 * component rather than the same words written on nine screens, so the answer to
 * "why is this empty" cannot drift between them.
 *
 * Deliberately no retry. Every manager screen used to report this as an error with a
 * button, which was worse than saying nothing: it looked like something had broken,
 * and pressing the button could never have fixed it.
 */
export function NoRestaurantAssigned({ area }: { area?: string }) {
  return (
    <Surface>
      <EmptyState
        icon={<Store />}
        title="No restaurant assigned"
        description={
          area === undefined
            ? "A platform admin has not assigned a restaurant to this account yet. You will see it here once they do."
            : `${area} appear here once a platform admin assigns a restaurant to this account.`
        }
      />
    </Surface>
  );
}
