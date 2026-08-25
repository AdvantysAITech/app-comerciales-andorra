-- RLS sobre la tabla `leads`. Cierra C-30 por el lado de los datos.
-- El filtro de app/(app)/leads/page.tsx protege la pantalla; esto protege
-- la tabla frente a cualquiera que consulte con su propio token de sesión.
--
-- Idempotente: se puede volver a ejecutar sin error.

begin;

alter table leads enable row level security;

drop policy if exists leads_select on leads;
drop policy if exists leads_insert on leads;
drop policy if exists leads_update on leads;

-- Lectura: los propios siempre; los del resto solo con alcance equipo o total.
--
-- El `exists` consulta las filas de `permisos` DEL PROPIO USUARIO, así que no
-- hace falta ninguna función SECURITY DEFINER: si mañana `permisos` gana su
-- propia RLS, cualquier política que deje al usuario ver sus permisos deja
-- pasar también esta subconsulta.
create policy leads_select on leads
  for select to authenticated
  using (
    comercial_id = auth.uid()
    or exists (
      select 1 from permisos
      where profile_id = auth.uid()
        and modulo_clave = 'captacion'
        and alcance in ('equipo', 'total')
    )
  );

-- Alta: solo a nombre propio. Un comercial no puede insertar un lead
-- atribuido a otro, ni aunque manipule el cuerpo del POST.
create policy leads_insert on leads
  for insert to authenticated
  with check (comercial_id = auth.uid());

-- Actualización: la usa /api/leads para cerrar la reserva (`en_curso` →
-- `creado` / `error`). Solo sobre filas propias, y sin poder cambiar de dueño.
create policy leads_update on leads
  for update to authenticated
  using (comercial_id = auth.uid())
  with check (comercial_id = auth.uid());

-- Sin política de DELETE a propósito: nadie borra leads desde la app.
-- El histórico de intentos fallidos es auditoría, no basura.

commit;