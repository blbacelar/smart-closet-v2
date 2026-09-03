import { useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import { AccountDeletionScreen } from '../src/features/account/AccountDeletionScreen';
import { useAuth } from '../src/providers/AuthProvider';

export default function DeleteAccountRoute() {
  const queryClient = useQueryClient();
  const { deleteAccount } = useAuth();

  const handleDelete = async () => {
    await deleteAccount();
    queryClient.clear();
  };

  return <AccountDeletionScreen onCancel={() => router.back()} onDelete={handleDelete} />;
}
