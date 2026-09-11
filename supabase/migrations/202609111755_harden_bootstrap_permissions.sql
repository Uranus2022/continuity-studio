-- Final hardening applied to the live MVP after the base schema.
-- bootstrap_demo_project must run under the signed-in caller's RLS context.

alter function public.bootstrap_demo_project() security invoker;
revoke execute on function public.bootstrap_demo_project() from anon;
revoke execute on function public.bootstrap_demo_project() from public;
grant execute on function public.bootstrap_demo_project() to authenticated;
