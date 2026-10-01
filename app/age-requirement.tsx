import { AgeRequirementScreen } from '../src/features/auth/AgeRequirementScreen';
import { useAuth } from '../src/providers/AuthProvider';

export default function AgeRequirementRoute() {
  const { confirmAdultStatus } = useAuth();
  return <AgeRequirementScreen onConfirm={confirmAdultStatus} />;
}
