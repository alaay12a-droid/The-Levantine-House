import React from 'react';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator, Switch, TouchableOpacity } from 'react-native';
import { useColors } from '@/hooks/useColors';
import { useSettingsSoundsQuery, useUpdateSettingsSounds, useSettingsPaymentQuery, useUpdateSettingsPayment } from '@/hooks/useApi';
import { Feather } from '@expo/vector-icons';

export default function SettingsScreen() {
  const colors = useColors();
  const { data: sounds, isLoading: soundsLoading, isError: soundsError, error: soundsErrorObj, refetch: refetchSounds } = useSettingsSoundsQuery();
  const { data: payment, isLoading: paymentLoading, isError: paymentError, error: paymentErrorObj, refetch: refetchPayment } = useSettingsPaymentQuery();
  const updateSounds = useUpdateSettingsSounds();
  const updatePayment = useUpdateSettingsPayment();

  if (soundsLoading || paymentLoading) {
    return (
      <View style={[styles.root, { backgroundColor: colors.background, justifyContent: 'center' }]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  const hasError = soundsError || paymentError;
  const errorMsg = soundsErrorObj?.message || paymentErrorObj?.message;

  if (hasError) {
    return (
      <View style={[styles.root, { backgroundColor: colors.background, justifyContent: 'center', alignItems: 'center', padding: 32 }]}>
        <Feather name="alert-triangle" size={32} color={colors.destructive} style={{ marginBottom: 16 }} />
        <Text style={[styles.errorTitle, { color: colors.destructive }]}>تعذر جلب الإعدادات</Text>
        <Text style={[styles.errorSubtitle, { color: colors.mutedForeground }]}>{errorMsg}</Text>
        <TouchableOpacity style={[styles.retryBtn, { backgroundColor: colors.primary }]} onPress={() => { refetchSounds(); refetchPayment(); }}>
          <Text style={[styles.retryText, { color: colors.primaryForeground }]}>إعادة المحاولة</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const safeSounds = sounds || { muted: false, order: true, message: true, delivery: true };
  const safePayment = payment || { cash: true, electronic: true, wallet: true };

  return (
    <ScrollView style={[styles.root, { backgroundColor: colors.background }]} contentContainerStyle={styles.content}>
      <Text style={[styles.sectionTitle, { color: colors.foreground }]}>الإشعارات الصوتية</Text>
      
      {updateSounds.isError && (
        <View style={[styles.errorBox, { backgroundColor: colors.destructiveSoft, borderColor: colors.destructive }]}>
          <Text style={[styles.errorBoxText, { color: colors.destructive }]}>{updateSounds.error?.message}</Text>
        </View>
      )}

      <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <SettingRow
          label="كتم جميع الأصوات"
          value={safeSounds.muted}
          onChange={(v) => updateSounds.mutate({ ...safeSounds, muted: v })}
          disabled={updateSounds.isPending}
        />
        <View style={[styles.divider, { backgroundColor: colors.border }]} />
        <SettingRow
          label="الطلبات الجديدة"
          value={safeSounds.order}
          onChange={(v) => updateSounds.mutate({ ...safeSounds, order: v })}
          disabled={updateSounds.isPending || safeSounds.muted}
        />
        <View style={[styles.divider, { backgroundColor: colors.border }]} />
        <SettingRow
          label="رسائل العملاء"
          value={safeSounds.message}
          onChange={(v) => updateSounds.mutate({ ...safeSounds, message: v })}
          disabled={updateSounds.isPending || safeSounds.muted}
        />
      </View>

      <Text style={[styles.sectionTitle, { color: colors.foreground, marginTop: 24 }]}>طرق الدفع المفعلة</Text>
      
      {updatePayment.isError && (
        <View style={[styles.errorBox, { backgroundColor: colors.destructiveSoft, borderColor: colors.destructive }]}>
          <Text style={[styles.errorBoxText, { color: colors.destructive }]}>{updatePayment.error?.message}</Text>
        </View>
      )}

      <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <SettingRow
          label="الدفع نقدًا"
          value={safePayment.cash}
          onChange={(v) => updatePayment.mutate({ ...safePayment, cash: v })}
          disabled={updatePayment.isPending}
        />
        <View style={[styles.divider, { backgroundColor: colors.border }]} />
        <SettingRow
          label="الدفع الإلكتروني (بطاقات)"
          value={safePayment.electronic}
          onChange={(v) => updatePayment.mutate({ ...safePayment, electronic: v })}
          disabled={updatePayment.isPending}
        />
        <View style={[styles.divider, { backgroundColor: colors.border }]} />
        <SettingRow
          label="المحافظ الرقمية (Apple Pay وغيرها)"
          value={safePayment.wallet}
          onChange={(v) => updatePayment.mutate({ ...safePayment, wallet: v })}
          disabled={updatePayment.isPending}
        />
      </View>
    </ScrollView>
  );
}

function SettingRow({ label, value, onChange, disabled }: { label: string; value: boolean; onChange: (v: boolean) => void; disabled?: boolean }) {
  const colors = useColors();
  return (
    <View style={styles.row}>
      <Switch
        value={value}
        onValueChange={onChange}
        trackColor={{ false: colors.muted, true: colors.success }}
        thumbColor={colors.switchThumb}
        disabled={disabled}
      />
      <Text style={[styles.label, { color: disabled ? colors.mutedForeground : colors.foreground }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  content: { padding: 16 },
  sectionTitle: {
    fontSize: 16,
    fontFamily: 'Inter_600SemiBold',
    textAlign: 'right',
    marginBottom: 12,
  },
  card: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 16,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 4,
  },
  label: {
    fontSize: 15,
    fontFamily: 'Inter_500Medium',
  },
  divider: {
    height: 1,
    marginVertical: 12,
  },
  errorTitle: {
    fontSize: 16,
    fontFamily: 'Inter_600SemiBold',
  },
  errorSubtitle: {
    fontSize: 14,
    fontFamily: 'Inter_400Regular',
    textAlign: 'center',
    marginTop: 4,
  },
  retryBtn: {
    marginTop: 16,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
  },
  retryText: {
    fontSize: 14,
    fontFamily: 'Inter_600SemiBold',
  },
  errorBox: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
  },
  errorBoxText: {
    fontSize: 14,
    fontFamily: 'Inter_500Medium',
    textAlign: 'center',
  },
});
