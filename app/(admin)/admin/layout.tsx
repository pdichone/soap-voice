import { redirect } from 'next/navigation';
import { getAdminUser } from '@/lib/admin-auth';
import { AdminNav } from '@/components/admin/AdminNav';

export const metadata = {
  title: 'BodyWorkFlow Admin',
  description: 'Super Admin Portal for BodyWorkFlow',
};

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const admin = await getAdminUser();

  // If not logged in as admin, redirect to login
  if (!admin) {
    redirect('/admin/login');
  }

  return (
    <div className="min-h-screen bg-slate-100">
      <AdminNav admin={admin} />
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {children}
      </main>
    </div>
  );
}
