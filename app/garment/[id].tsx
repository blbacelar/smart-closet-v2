import { router, useLocalSearchParams } from 'expo-router';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { GarmentDetailScreen } from '../../src/features/garments/GarmentDetailScreen';
import { useGarments, useUpdateGarment } from '../../src/features/garments/useGarments';
import type { GarmentDetails } from '../../src/features/garments/garmentValidation';
import { useAuth } from '../../src/providers/AuthProvider';
import { colors, fonts } from '../../src/theme';

export default function GarmentDetailRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { identity } = useAuth();
  const garments = useGarments(identity?.id);
  const update = useUpdateGarment(identity?.id ?? 'signed-out');
  const garment = garments.data?.find((item) => item.id === id);

  if (garments.isLoading) {
    return <View style={styles.center}><ActivityIndicator color={colors.ink} /></View>;
  }

  if (garments.isError) {
    return (
      <View style={styles.center}>
        <Text style={styles.message}>Could not load that garment.</Text>
        <Pressable accessibilityRole="button" onPress={() => garments.refetch()} style={styles.button}>
          <Text style={styles.buttonText}>Try again</Text>
        </Pressable>
      </View>
    );
  }

  if (!garment) {
    return (
      <View style={styles.center}>
        <Text style={styles.message}>That garment is no longer in your closet.</Text>
        <Pressable accessibilityRole="button" onPress={() => router.back()} style={styles.button}>
          <Text style={styles.buttonText}>Back to closet</Text>
        </Pressable>
      </View>
    );
  }

  const save = async (details: GarmentDetails) => {
    await update.mutateAsync({ garmentId: garment.id, details });
  };

  return <GarmentDetailScreen garment={garment} onBack={() => router.back()} onSave={save} />;
}

const styles = StyleSheet.create({
  center: { flex: 1, paddingHorizontal: 24, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.canvas },
  message: { fontFamily: fonts.body, color: colors.muted, fontSize: 13, textAlign: 'center' },
  button: { minHeight: 44, marginTop: 14, paddingHorizontal: 18, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.ink },
  buttonText: { fontFamily: fonts.body, color: colors.white, fontSize: 12, fontWeight: '800' },
});
