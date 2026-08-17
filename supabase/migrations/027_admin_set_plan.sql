-- Migration 027: RPC segura para que CEO/Admin asignen planes y roles

CREATE OR REPLACE FUNCTION public.admin_set_user_plan(
  target_user_id uuid,
  new_plan        text,
  new_role        text DEFAULT NULL
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER  -- corre como superuser de la función, pero valida el caller primero
SET search_path = public
AS $$
DECLARE
  caller_role text;
  target_email text;
BEGIN
  -- 1. Verificar que el caller sea CEO o Admin
  SELECT role INTO caller_role FROM public.users WHERE id = auth.uid();

  IF caller_role NOT IN ('ceo', 'admin') THEN
    RAISE EXCEPTION 'UNAUTHORIZED: solo CEO o Admin pueden modificar planes';
  END IF;

  -- 2. Validar plan
  IF new_plan NOT IN ('free', 'vip', 'comunidad') THEN
    RAISE EXCEPTION 'INVALID_PLAN: plan debe ser free, vip o comunidad';
  END IF;

  -- 3. Validar rol si se provee
  IF new_role IS NOT NULL AND new_role NOT IN ('ceo','admin','comunidad','vip','organizador','miembro') THEN
    RAISE EXCEPTION 'INVALID_ROLE: rol no válido';
  END IF;

  -- 4. CEO no puede ser modificado por un Admin (solo otro CEO)
  IF caller_role = 'admin' THEN
    DECLARE target_current_role text;
    BEGIN
      SELECT role INTO target_current_role FROM public.users WHERE id = target_user_id;
      IF target_current_role = 'ceo' THEN
        RAISE EXCEPTION 'UNAUTHORIZED: un Admin no puede modificar a un CEO';
      END IF;
    END;
  END IF;

  -- 5. Aplicar cambios
  IF new_role IS NOT NULL THEN
    UPDATE public.users
    SET plan = new_plan, role = new_role, updated_at = now()
    WHERE id = target_user_id
    RETURNING email INTO target_email;
  ELSE
    UPDATE public.users
    SET plan = new_plan, updated_at = now()
    WHERE id = target_user_id
    RETURNING email INTO target_email;
  END IF;

  -- 6. Actualizar estado del pago si hay uno pendiente
  UPDATE public.payments
  SET status = 'approved', reviewed_by = auth.uid(), updated_at = now()
  WHERE user_id = target_user_id AND status = 'pending';

  RETURN json_build_object(
    'ok', true,
    'plan', new_plan,
    'role', new_role,
    'user_id', target_user_id
  );
END;
$$;

-- Solo usuarios autenticados pueden llamar esta función
-- Pero la función internamente verifica CEO/Admin
REVOKE ALL ON FUNCTION public.admin_set_user_plan FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_set_user_plan TO authenticated;

-- Agregar columna reviewed_by y updated_at a payments si no existe
ALTER TABLE public.payments ADD COLUMN IF NOT EXISTS reviewed_by uuid REFERENCES public.users(id) ON DELETE SET NULL;
ALTER TABLE public.payments ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();

-- RLS: solo el owner ve su pago, CEO/Admin ven todos
DROP POLICY IF EXISTS "payments_select_own"  ON public.payments;
DROP POLICY IF EXISTS "payments_select_admin" ON public.payments;
DROP POLICY IF EXISTS "payments_insert_own"   ON public.payments;
DROP POLICY IF EXISTS "payments_update_admin" ON public.payments;

ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "payments_insert_own" ON public.payments
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE POLICY "payments_select_own" ON public.payments
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "payments_select_admin" ON public.payments
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role IN ('ceo','admin')));

CREATE POLICY "payments_update_admin" ON public.payments
  FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role IN ('ceo','admin')));

-- Índices útiles
CREATE INDEX IF NOT EXISTS idx_payments_status  ON public.payments(status);
CREATE INDEX IF NOT EXISTS idx_payments_user_id ON public.payments(user_id);
