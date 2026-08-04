import { useState } from 'react';
import { router } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { Image } from 'expo-image';
import { Camera, Check, ImagePlus, Sparkles, X } from 'lucide-react-native';
import { Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Category } from '../src/data';
import { useFitlyStore } from '../src/store';
import { colors, fonts, shadow } from '../src/theme';

const categoryOptions: Exclude<Category, 'All'>[] = ['Tops', 'Bottoms', 'Dresses', 'Outerwear'];
const colorOptions = ['Cream', 'Black', 'Blue', 'Green', 'Red'];

export default function AddGarmentScreen() {
  const addGarment = useFitlyStore((s) => s.addGarment);
  const [image, setImage] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [category, setCategory] = useState<Exclude<Category, 'All'>>('Tops');
  const [color, setColor] = useState('Cream');
  const [size, setSize] = useState('M');
  const [processing, setProcessing] = useState(false);

  const pick = async (camera = false) => {
    const result = camera
      ? await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 0.8, allowsEditing: true })
      : await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.8, allowsEditing: true });
    if (!result.canceled) {
      setImage(result.assets[0].uri);
      if (!name) setName('New favorite');
    }
  };

  const save = () => {
    if (!image) {
      Alert.alert('Add a photo first', 'Take a clear photo of your garment on a hanger or flat surface.');
      return;
    }
    setProcessing(true);
    setTimeout(() => {
      addGarment({ id: Date.now().toString(), name: name.trim() || 'New favorite', category, color, size, season: 'All year', image, worn: 0 });
      router.back();
    }, 700);
  };

  return (
    <SafeAreaView style={styles.screen} edges={['top', 'bottom']}>
      <View style={styles.header}><Pressable onPress={() => router.back()} style={styles.close}><X size={20} color={colors.ink} /></Pressable><View><Text style={styles.eyebrow}>BUILD YOUR CLOSET</Text><Text style={styles.title}>Add a piece</Text></View><View style={styles.spacer} /></View>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {image ? (
          <View style={styles.photoReady}>
            <Image source={{ uri: image }} style={styles.preview} contentFit="cover" />
            <View style={styles.cleanBadge}><Sparkles size={13} color={colors.forest} /><Text style={styles.cleanText}>Ready to clean up</Text></View>
            <Pressable style={styles.change} onPress={() => setImage(null)}><Text style={styles.changeText}>Change photo</Text></Pressable>
          </View>
        ) : (
          <View style={styles.photoZone}>
            <View style={styles.cameraIcon}><ImagePlus size={27} color={colors.forest} /></View>
            <Text style={styles.photoTitle}>Show us the whole garment</Text>
            <Text style={styles.photoCopy}>Lay it flat or hang it up in good light. A plain background works best.</Text>
            <View style={styles.photoActions}>
              <Pressable style={styles.primaryPhoto} onPress={() => pick(true)}><Camera size={17} color={colors.white} /><Text style={styles.primaryPhotoText}>Take photo</Text></Pressable>
              <Pressable style={styles.secondaryPhoto} onPress={() => pick(false)}><ImagePlus size={17} color={colors.forest} /><Text style={styles.secondaryPhotoText}>Choose</Text></Pressable>
            </View>
          </View>
        )}

        <View style={styles.tip}><View style={styles.tipIcon}><Check size={13} color={colors.forest} /></View><Text style={styles.tipText}>Fitly removes the background and suggests details. You always get the final say.</Text></View>

        <Text style={styles.label}>NAME</Text>
        <TextInput value={name} onChangeText={setName} placeholder="e.g. Vintage denim jacket" placeholderTextColor="#9B9F9B" style={styles.input} />

        <Text style={styles.label}>CATEGORY</Text>
        <View style={styles.options}>{categoryOptions.map((item) => <Pressable key={item} onPress={() => setCategory(item)} style={[styles.option, category === item && styles.optionActive]}><Text style={[styles.optionText, category === item && styles.optionTextActive]}>{item}</Text></Pressable>)}</View>

        <Text style={styles.label}>COLOR</Text>
        <View style={styles.options}>{colorOptions.map((item) => <Pressable key={item} onPress={() => setColor(item)} style={[styles.option, color === item && styles.optionActive]}><Text style={[styles.optionText, color === item && styles.optionTextActive]}>{item}</Text></Pressable>)}</View>

        <Text style={styles.label}>SIZE</Text>
        <TextInput value={size} onChangeText={setSize} placeholder="M" placeholderTextColor="#9B9F9B" style={styles.input} />
      </ScrollView>
      <View style={styles.footer}><Pressable onPress={save} disabled={processing} style={[styles.save, processing && styles.saveDisabled]}><Sparkles size={18} color={colors.white} /><Text style={styles.saveText}>{processing ? 'Preparing your piece…' : 'Add to my closet'}</Text></Pressable></View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.canvas },
  header: { paddingHorizontal: 20, paddingVertical: 8, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  close: { width: 42, height: 42, borderRadius: 16, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: colors.line },
  spacer: { width: 42 },
  eyebrow: { fontFamily: fonts.body, color: colors.coral, fontSize: 9.5, fontWeight: '800', letterSpacing: 1.1, textAlign: 'center' },
  title: { fontFamily: fonts.display, color: colors.ink, fontSize: 25, textAlign: 'center', marginTop: 2 },
  content: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 130 },
  photoZone: { height: 276, borderRadius: 14, borderWidth: 1.5, borderStyle: 'dashed', borderColor: colors.sageDeep, backgroundColor: colors.sage, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 28 },
  cameraIcon: { width: 58, height: 58, borderRadius: 22, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center', ...shadow },
  photoTitle: { fontFamily: fonts.display, color: colors.ink, fontSize: 20, marginTop: 18 },
  photoCopy: { fontFamily: fonts.body, color: colors.muted, fontSize: 12, lineHeight: 18, textAlign: 'center', marginTop: 7 },
  photoActions: { flexDirection: 'row', gap: 9, marginTop: 18 },
  primaryPhoto: { height: 43, borderRadius: 15, backgroundColor: colors.forest, paddingHorizontal: 15, flexDirection: 'row', alignItems: 'center', gap: 7 },
  primaryPhotoText: { fontFamily: fonts.body, color: colors.white, fontSize: 12, fontWeight: '800' },
  secondaryPhoto: { height: 43, borderRadius: 15, backgroundColor: colors.surface, paddingHorizontal: 15, flexDirection: 'row', alignItems: 'center', gap: 7, borderWidth: 1, borderColor: colors.line },
  secondaryPhotoText: { fontFamily: fonts.body, color: colors.forest, fontSize: 12, fontWeight: '700' },
  photoReady: { height: 310, borderRadius: 27, overflow: 'hidden', backgroundColor: colors.sand },
  preview: { width: '100%', height: '100%' },
  cleanBadge: { position: 'absolute', left: 13, top: 13, flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: 'rgba(255,253,249,0.95)', borderRadius: 99, paddingHorizontal: 10, paddingVertical: 7 },
  cleanText: { fontFamily: fonts.body, color: colors.forest, fontSize: 10, fontWeight: '800' },
  change: { position: 'absolute', right: 13, bottom: 13, backgroundColor: 'rgba(27,33,29,0.76)', borderRadius: 99, paddingHorizontal: 12, paddingVertical: 8 },
  changeText: { fontFamily: fonts.body, color: colors.white, fontSize: 10.5, fontWeight: '700' },
  tip: { marginTop: 13, backgroundColor: colors.sage, borderRadius: 17, padding: 13, flexDirection: 'row', gap: 9, alignItems: 'center' },
  tipIcon: { width: 25, height: 25, borderRadius: 9, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center' },
  tipText: { flex: 1, fontFamily: fonts.body, color: '#5F5F64', fontSize: 10.5, lineHeight: 15 },
  label: { fontFamily: fonts.body, color: colors.muted, fontSize: 10, fontWeight: '800', letterSpacing: 1.1, marginTop: 21, marginBottom: 8, marginLeft: 2 },
  input: { height: 49, borderRadius: 16, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line, paddingHorizontal: 15, fontFamily: fonts.body, color: colors.ink, fontSize: 13 },
  options: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  option: { borderRadius: 99, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line, paddingHorizontal: 14, paddingVertical: 9 },
  optionActive: { backgroundColor: colors.forest, borderColor: colors.forest },
  optionText: { fontFamily: fonts.body, color: colors.muted, fontSize: 11.5, fontWeight: '600' },
  optionTextActive: { color: colors.white },
  footer: { position: 'absolute', left: 0, right: 0, bottom: 0, padding: 20, backgroundColor: 'rgba(247,244,238,0.98)' },
  save: { height: 56, borderRadius: 18, backgroundColor: colors.forest, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, ...shadow },
  saveDisabled: { opacity: 0.7 },
  saveText: { fontFamily: fonts.body, color: colors.white, fontSize: 14, fontWeight: '800' },
});
