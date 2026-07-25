-- At least one active OWNER must always exist.
-- Active = role OWNER, status ACTIVE, deleted_at IS NULL.

CREATE OR REPLACE FUNCTION public.enforce_owner_invariants()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  remaining integer;
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF OLD.role = 'OWNER'
       AND OLD.status = 'ACTIVE'
       AND OLD.deleted_at IS NULL THEN
      SELECT COUNT(*)::integer INTO remaining
      FROM public.users
      WHERE role = 'OWNER'
        AND status = 'ACTIVE'
        AND deleted_at IS NULL
        AND id IS DISTINCT FROM OLD.id;
      IF remaining < 1 THEN
        RAISE EXCEPTION 'Cannot delete the last active OWNER'
          USING ERRCODE = 'check_violation';
      END IF;
    END IF;
    RETURN OLD;
  END IF;

  -- UPDATE: demotion, soft-delete, or deactivate that would leave zero active OWNERs
  IF OLD.role = 'OWNER'
     AND OLD.status = 'ACTIVE'
     AND OLD.deleted_at IS NULL THEN
    IF NEW.role IS DISTINCT FROM 'OWNER'
       OR NEW.status IS DISTINCT FROM 'ACTIVE'
       OR NEW.deleted_at IS NOT NULL THEN
      SELECT COUNT(*)::integer INTO remaining
      FROM public.users
      WHERE role = 'OWNER'
        AND status = 'ACTIVE'
        AND deleted_at IS NULL
        AND id IS DISTINCT FROM NEW.id;
      IF remaining < 1 THEN
        RAISE EXCEPTION 'Cannot demote, deactivate, or delete the last active OWNER'
          USING ERRCODE = 'check_violation';
      END IF;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;
--> statement-breakpoint
DROP TRIGGER IF EXISTS users_enforce_owner_invariants ON public.users;
--> statement-breakpoint
CREATE TRIGGER users_enforce_owner_invariants
  BEFORE UPDATE OR DELETE ON public.users
  FOR EACH ROW
  EXECUTE PROCEDURE public.enforce_owner_invariants();
