import React from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import { PRIZMA } from './prizmaTheme';

/**
 * Never display a scraped or hotlinked branded image without explicit
 * commercial-use permission. Unknown license -> elegant neutral placeholder.
 */
type Props = {
  url?: string | null;
  licenseStatus?: 'approved' | 'unknown' | 'rejected' | null;
  alt: string;
  height?: number;
};
export default function LicensedProductImage({ url, licenseStatus, alt, height = 110 }: Props) {
  const approved = licenseStatus === 'approved' && !!url && /^https:\/\//i.test(url);
  if (!approved) {
    return <View style={[styles.placeholder, { height }]} accessibilityLabel={alt + ' için lisanslı görsel bulunmuyor'}>
      <Text style={styles.icon}>▢</Text>
      <Text style={styles.caption}>Ürün Görseli</Text>
    </View>;
  }
  return <Image source={{ uri: url! }} style={[styles.image, { height }]} resizeMode="contain" accessibilityLabel={alt}/>;
}
const styles = StyleSheet.create({
  image: { width: '100%', backgroundColor: PRIZMA.white, borderRadius: 12 },
  placeholder: { width: '100%', borderRadius: 12, backgroundColor: PRIZMA.white, borderWidth: 1, borderColor: PRIZMA.border, alignItems: 'center', justifyContent: 'center' },
  icon: { color: PRIZMA.purple, fontSize: 27 },
  caption: { color: PRIZMA.muted, fontSize: 10, marginTop: 6 },
});
