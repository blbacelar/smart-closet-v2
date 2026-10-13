import { router, useLocalSearchParams } from 'expo-router';
import { ArrowLeft, Send } from 'lucide-react-native';
import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  useMarketplaceMessages,
  useMarketplaceOffers,
  useSendMarketplaceMessage,
} from '../../src/features/marketplace/useMarketplace';
import { useAuth } from '../../src/providers/AuthProvider';
import { colors, fonts, shadow } from '../../src/theme';

export default function MarketplaceChatRoute() {
  const { offerId } = useLocalSearchParams<{ offerId: string }>();
  const { identity } = useAuth();
  const offers = useMarketplaceOffers(identity?.id);
  const messages = useMarketplaceMessages(identity?.id, offerId);
  const sendMessage = useSendMarketplaceMessage();
  const [draft, setDraft] = useState('');
  const [error, setError] = useState('');
  const scrollRef = useRef<ScrollView>(null);
  const offer = offers.data?.find((item) => item.id === offerId);
  const conversationOpen = offer?.status === 'pending' || offer?.status === 'accepted';

  useEffect(() => {
    scrollRef.current?.scrollToEnd({ animated: true });
  }, [messages.data?.length]);

  const send = async () => {
    const body = draft.trim();
    if (!body) {
      setError('Write a message first.');
      return;
    }
    setError('');
    try {
      await sendMessage.mutateAsync({ offerId, body });
      setDraft('');
    } catch (sendError) {
      setError(sendError instanceof Error ? sendError.message : 'Could not send that message.');
    }
  };

  return (
    <SafeAreaView edges={['top', 'bottom']} style={styles.screen}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.keyboard}>
        <View style={styles.header}>
          <Pressable accessibilityLabel="Back to marketplace activity" accessibilityRole="button" onPress={() => router.back()} style={styles.back}>
            <ArrowLeft color={colors.ink} size={20} />
          </Pressable>
          <View style={styles.headerCopy}>
            <Text numberOfLines={1} style={styles.headerTitle}>{offer?.listingName ?? 'Offer conversation'}</Text>
            <Text style={styles.headerStatus}>{offer?.status?.replaceAll('_', ' ') ?? 'Loading…'}</Text>
          </View>
          <View style={styles.headerSpacer} />
        </View>

        {offers.isLoading || messages.isLoading ? (
          <View style={styles.center}><ActivityIndicator color={colors.ink} /></View>
        ) : !offer || messages.isError ? (
          <View style={styles.center}>
            <Text style={styles.emptyTitle}>Could not open this conversation.</Text>
            <Pressable accessibilityRole="button" onPress={() => void Promise.all([offers.refetch(), messages.refetch()])} style={styles.retry}>
              <Text style={styles.retryText}>Try again</Text>
            </Pressable>
          </View>
        ) : (
          <>
            <ScrollView
              contentContainerStyle={styles.messages}
              keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
              keyboardShouldPersistTaps="handled"
              onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: false })}
              ref={scrollRef}
              showsVerticalScrollIndicator={false}
            >
              <View style={styles.safetyCard}>
                <Text style={styles.safetyTitle}>Keep personal details private</Text>
                <Text style={styles.safetyText}>Use this chat to agree on a public pickup place and time. Inspect the garment before confirming the handoff.</Text>
              </View>
              {(messages.data ?? []).length === 0 ? (
                <Text style={styles.empty}>Start the conversation about this offer.</Text>
              ) : (messages.data ?? []).map((item) => {
                const mine = item.senderId === identity?.id;
                return (
                  <View key={item.id} style={[styles.bubble, mine ? styles.mine : styles.theirs]}>
                    <Text style={[styles.body, mine && styles.mineText]}>{item.body}</Text>
                    <Text style={[styles.time, mine && styles.mineTime]}>
                      {new Date(item.createdAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}
                    </Text>
                  </View>
                );
              })}
            </ScrollView>

            {!!error && <Text accessibilityRole="alert" style={styles.error}>{error}</Text>}
            {conversationOpen ? (
              <View style={styles.composer}>
                <TextInput
                  accessibilityLabel="Marketplace message"
                  maxLength={1000}
                  multiline
                  onChangeText={(value) => { setDraft(value); setError(''); }}
                  placeholder="Message this member…"
                  placeholderTextColor="#9B9F9B"
                  style={styles.input}
                  value={draft}
                />
                <Pressable
                  accessibilityLabel="Send marketplace message"
                  accessibilityRole="button"
                  disabled={sendMessage.isPending}
                  onPress={() => void send()}
                  style={[styles.send, sendMessage.isPending && styles.disabled]}
                >
                  {sendMessage.isPending ? <ActivityIndicator color={colors.white} /> : <Send color={colors.white} size={18} />}
                </Pressable>
              </View>
            ) : (
              <Text style={styles.closed}>This conversation closed when the offer ended.</Text>
            )}
          </>
        )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.canvas },
  keyboard: { flex: 1 },
  header: { minHeight: 58, paddingHorizontal: 18, flexDirection: 'row', alignItems: 'center', borderBottomWidth: 1, borderBottomColor: colors.line },
  back: { width: 42, height: 42, borderRadius: 16, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line },
  headerCopy: { flex: 1, paddingHorizontal: 12, alignItems: 'center' },
  headerTitle: { maxWidth: '100%', fontFamily: fonts.body, color: colors.ink, fontSize: 13, fontWeight: '800' },
  headerStatus: { marginTop: 2, fontFamily: fonts.body, color: colors.muted, fontSize: 8.5, textTransform: 'uppercase' },
  headerSpacer: { width: 42 },
  center: { flex: 1, padding: 24, alignItems: 'center', justifyContent: 'center' },
  messages: { flexGrow: 1, paddingHorizontal: 18, paddingTop: 14, paddingBottom: 18 },
  safetyCard: { marginBottom: 18, padding: 13, borderRadius: 14, backgroundColor: colors.sage, borderWidth: 1, borderColor: colors.sageDeep },
  safetyTitle: { fontFamily: fonts.body, color: colors.ink, fontSize: 10.5, fontWeight: '800' },
  safetyText: { marginTop: 4, fontFamily: fonts.body, color: colors.muted, fontSize: 9.5, lineHeight: 14 },
  bubble: { maxWidth: '82%', marginBottom: 9, paddingHorizontal: 13, paddingTop: 10, paddingBottom: 7, borderRadius: 16 },
  mine: { alignSelf: 'flex-end', backgroundColor: colors.ink, borderBottomRightRadius: 5 },
  theirs: { alignSelf: 'flex-start', backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line, borderBottomLeftRadius: 5 },
  body: { fontFamily: fonts.body, color: colors.ink, fontSize: 12, lineHeight: 17 },
  mineText: { color: colors.white },
  time: { marginTop: 4, fontFamily: fonts.body, color: colors.muted, fontSize: 7.5, textAlign: 'right' },
  mineTime: { color: 'rgba(255,255,255,0.6)' },
  empty: { marginTop: 28, fontFamily: fonts.body, color: colors.muted, fontSize: 11, textAlign: 'center' },
  emptyTitle: { fontFamily: fonts.body, color: colors.ink, fontSize: 13, fontWeight: '800', textAlign: 'center' },
  retry: { minHeight: 44, marginTop: 14, paddingHorizontal: 18, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.ink },
  retryText: { fontFamily: fonts.body, color: colors.white, fontSize: 11, fontWeight: '800' },
  error: { marginHorizontal: 18, marginBottom: 8, fontFamily: fonts.body, color: '#8C3C34', fontSize: 10.5, textAlign: 'center' },
  composer: { paddingHorizontal: 14, paddingTop: 9, paddingBottom: 6, flexDirection: 'row', alignItems: 'flex-end', gap: 9, borderTopWidth: 1, borderTopColor: colors.line, backgroundColor: colors.surface },
  input: { flex: 1, maxHeight: 110, minHeight: 46, paddingHorizontal: 14, paddingVertical: 12, borderRadius: 16, backgroundColor: colors.canvas, borderWidth: 1, borderColor: colors.line, fontFamily: fonts.body, color: colors.ink, fontSize: 12 },
  send: { width: 46, height: 46, borderRadius: 16, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.ink, ...shadow },
  disabled: { opacity: 0.6 },
  closed: { margin: 14, padding: 12, borderRadius: 13, overflow: 'hidden', backgroundColor: colors.sage, fontFamily: fonts.body, color: colors.muted, fontSize: 10.5, textAlign: 'center' },
});
