import { useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import { AccountDeletionScreen } from '../src/features/account/AccountDeletionScreen';
import { useAuth } from '../src/providers/AuthProvider';
import { observability } from '../src/lib/observability';

export default function DeleteAccountRoute() {
  const queryClient = useQueryClient();
  const { deleteAccount } = useAuth();

  const handleDelete = async () => {
    await deleteAccount();
    observability.track('account_deleted');
    queryClient.clear();
  };

  return <AccountDeletionScreen onCancel={() => router.back()} onDelete={handleDelete} />;
}
