import { Image } from 'expo-image';
import { Camera, Lock, Trash2 } from 'lucide-react-native';
import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { PrivacyVisibilityLine } from '../../components/PrivacyVisibilityLine';
import { colors, fonts, shadow } from '../../theme';
import type { BodyPhoto } from './bodyPhotoRepository';

type BodyPhotoGalleryProps = {
  photos: BodyPhoto[];
  isLoading?: boolean;
  hasError?: boolean;
  maxPhotos?: number;
  undoDurationMs?: number;
  onAdd: () => void;
  onDelete: (photo: BodyPhoto) => Promise<void>;
  onRetry?: () => void;
};

const safeDeletionError = 'Could not delete that photo. Try again.';

export function BodyPhotoGallery({
  photos,
  isLoading = false,
  hasError = false,
  maxPhotos = 3,
  undoDurationMs = 5_000,
  onAdd,
  onDelete,
  onRetry,
}: BodyPhotoGalleryProps) {
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [hiddenIds, setHiddenIds] = useState<Set<string>>(() => new Set());
  const [pendingPhoto, setPendingPhoto] = useState<BodyPhoto | null>(null);
  const [isCommitting, setIsCommitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);

  useEffect(() => {
    const availableIds = new Set(photos.map((photo) => photo.id));
    setHiddenIds((current) => {
      const next = new Set([...current].filter((id) => availableIds.has(id)));
      return next.size === current.size ? current : next;
    });
  }, [photos]);

  const restorePhoto = (photoId: string) => {
    setHiddenIds((current) => {
      const next = new Set(current);
      next.delete(photoId);
      return next;
    });
  };

  const commitDeletion = async (photo: BodyPhoto) => {
    timer.current = null;
    setIsCommitting(true);
    try {
      await onDelete(photo);
      setPendingPhoto(null);
    } catch {
      restorePhoto(photo.id);
      setPendingPhoto(null);
      setErrorMessage(safeDeletionError);
    } finally {
      setIsCommitting(false);
    }
  };

  const queueDeletion = (photo: BodyPhoto) => {
    if (pendingPhoto || isCommitting) return;
    setErrorMessage('');
    setHiddenIds((current) => new Set(current).add(photo.id));
    setPendingPhoto(photo);
    timer.current = setTimeout(() => {
      void commitDeletion(photo);
    }, undoDurationMs);
  };

  const undoDeletion = () => {
    if (!pendingPhoto || isCommitting) return;
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    restorePhoto(pendingPhoto.id);
    setPendingPhoto(null);
  };

  const visiblePhotos = photos.filter((photo) => !hiddenIds.has(photo.id));

  return (
    <View>
      <View style={styles.header}>
        <Text style={styles.sectionLabel}>Your body photos</Text>
        <PrivacyVisibilityLine />
      </View>

      <View style={styles.photoRow}>
        {isLoading && (
          <View style={styles.photoLoading}>
            <ActivityIndicator color={colors.ink} />
          </View>
        )}
        {visiblePhotos.map((photo, index) => (
          <View key={photo.id} style={styles.bodyPhoto}>
            <Image
              accessibilityLabel={`Private body photo ${index + 1}`}
              source={{ uri: photo.signedUrl }}
              style={styles.bodyImage}
              contentFit="cover"
              contentPosition="top"
            />
            <View style={styles.lockBadge}><Lock size={11} color={colors.white} /></View>
            {photo.status !== 'approved' && (
              <View style={styles.statusBadge}>
                <Text style={styles.statusText}>{photo.status}</Text>
              </View>
            )}
            <Pressable
              accessibilityLabel={`Delete body photo ${index + 1}`}
              accessibilityRole="button"
              disabled={Boolean(pendingPhoto) || isCommitting}
              onPress={() => queueDeletion(photo)}
              style={styles.deleteButton}
            >
              <Trash2 size={13} color={colors.white} />
            </Pressable>
          </View>
        ))}
        {!isLoading && photos.length < maxPhotos && (
          <Pressable
            accessibilityLabel="Add body photo"
            accessibilityRole="button"
            onPress={onAdd}
            style={styles.addPhoto}
          >
            <Camera size={19} color={colors.muted} />
            <Text style={styles.addPhotoText}>Add photo</Text>
          </Pressable>
        )}
      </View>

      {hasError && (
        <Pressable accessibilityRole="button" onPress={onRetry} style={styles.retryRow}>
          <Text style={styles.retryText}>Could not load your photos. Tap to retry.</Text>
        </Pressable>
      )}

      {!!errorMessage && (
        <Text accessibilityRole="alert" style={styles.errorMessage}>{errorMessage}</Text>
      )}

      {pendingPhoto && (
        <View accessibilityLiveRegion="polite" style={styles.undoBar}>
          <Text style={styles.undoText}>{isCommitting ? 'Deleting body photo…' : 'Body photo removed'}</Text>
          {!isCommitting && (
            <Pressable
              accessibilityLabel="Undo body photo deletion"
              accessibilityRole="button"
              onPress={undoDeletion}
              style={styles.undoButton}
            >
              <Text style={styles.undoButtonText}>Undo</Text>
            </Pressable>
          )}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 },
  sectionLabel: { fontFamily: fonts.body, fontSize: 10, color: colors.muted, textTransform: 'uppercase', letterSpacing: 1.4 },
  photoRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 20 },
  bodyPhoto: { position: 'relative', width: 78, height: 106, borderRadius: 14, overflow: 'hidden', backgroundColor: colors.sage, borderWidth: 1, borderColor: colors.line },
  photoLoading: { width: 78, height: 106, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.sage },
  bodyImage: { width: '100%', height: '100%' },
  lockBadge: { position: 'absolute', left: 6, bottom: 6, width: 21, height: 21, borderRadius: 11, backgroundColor: colors.ink, alignItems: 'center', justifyContent: 'center' },
  deleteButton: { position: 'absolute', right: 0, bottom: 0, width: 44, height: 44, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(25,25,23,0.76)', borderTopLeftRadius: 18 },
  statusBadge: { position: 'absolute', right: 5, top: 5, paddingHorizontal: 5, paddingVertical: 3, borderRadius: 5, backgroundColor: 'rgba(255,255,255,0.9)' },
  statusText: { fontFamily: fonts.body, fontSize: 7, fontWeight: '800', color: colors.ink, textTransform: 'uppercase', letterSpacing: 0.5 },
  addPhoto: { width: 78, height: 106, borderRadius: 14, borderWidth: 1, borderStyle: 'dashed', borderColor: colors.line, alignItems: 'center', justifyContent: 'center', gap: 5 },
  addPhotoText: { fontFamily: fonts.body, color: colors.muted, fontSize: 9 },
  retryRow: { marginTop: -10, marginBottom: 18 },
  retryText: { fontFamily: fonts.body, color: '#8C3C34', fontSize: 11 },
  errorMessage: { marginBottom: 18, padding: 12, borderRadius: 12, overflow: 'hidden', backgroundColor: '#F4E5E2', fontFamily: fonts.body, color: '#8C3C34', fontSize: 11 },
  undoBar: { minHeight: 54, marginBottom: 20, paddingLeft: 16, paddingRight: 6, borderRadius: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: colors.ink, ...shadow },
  undoText: { fontFamily: fonts.body, color: colors.white, fontSize: 12, fontWeight: '700' },
  undoButton: { minWidth: 64, minHeight: 44, borderRadius: 11, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.white },
  undoButtonText: { fontFamily: fonts.body, color: colors.ink, fontSize: 11, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.7 },
});
