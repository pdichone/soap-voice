import { createServerSupabaseClient } from '@/lib/supabase-server';
import { ClientsList } from '@/components/clinical/ClientsList';

export default async function ClientsPage() {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();

  const { data: clients } = await supabase
    .from('clients')
    .select('*')
    .eq('therapist_id', user?.id || '')
    .order('name', { ascending: true });

  return <ClientsList initialClients={clients || []} />;
}
