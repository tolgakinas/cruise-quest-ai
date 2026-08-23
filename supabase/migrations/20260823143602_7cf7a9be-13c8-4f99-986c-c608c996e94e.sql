INSERT INTO public.user_roles (user_id, role)
VALUES ('a79bef80-a50f-4ba3-9a1f-84aecf1f72e4', 'admin')
ON CONFLICT (user_id, role) DO NOTHING;