import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, Switch, TextInput, TouchableOpacity } from 'react-native';
import { KeyboardAwareScrollViewCompat } from '@/components/KeyboardAwareScrollViewCompat';
import { useColors } from '@/hooks/useColors';
import { useBranchHoursQuery, useUpdateBranchHours, BranchHours } from '@/hooks/useApi';
import { Feather } from '@expo/vector-icons';

const DAYS_AR = ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];

const TIME_REGEX = /^([01]\d|2[0-3]):([0-5]\d)$/;

export default function HoursScreen() {
  const colors = useColors();
  const { data: hours, isLoading, isError, error, refetch } = useBranchHoursQuery();
  const updateHours = useUpdateBranchHours();
  const [localHours, setLocalHours] = useState<BranchHours | null>(null);

  useEffect(() => {
    if (hours) {
      setLocalHours(JSON.parse(JSON.stringify(hours)));
    }
  }, [hours]);

  if (isError) {
    return (
      <View style={[styles.root, { backgroundColor: colors.background, justifyContent: 'center', alignItems: 'center', padding: 32 }]}>
        <Feather name="alert-triangle" size={32} color={colors.destructive} style={{ marginBottom: 16 }} />
        <Text style={[styles.errorTitle, { color: colors.destructive }]}>تعذر جلب ساعات العمل</Text>
        <Text style={[styles.errorSubtitle, { color: colors.mutedForeground }]}>{error?.message}</Text>
        <TouchableOpacity style={[styles.retryBtn, { backgroundColor: colors.primary }]} onPress={() => refetch()}>
          <Text style={[styles.retryText, { color: colors.primaryForeground }]}>إعادة المحاولة</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (isLoading || !localHours) {
    return (
      <View style={[styles.root, { backgroundColor: colors.background, justifyContent: 'center' }]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  const handleGlobalToggle = (val: boolean) => {
    const updated = { ...localHours, enabled: val };
    setLocalHours(updated);
    updateHours.mutate(updated);
  };

  const handleDayToggle = (idx: number, val: boolean) => {
    const newDays = [...localHours.days];
    newDays[idx] = { ...newDays[idx], enabled: val };
    const updated = { ...localHours, days: newDays };
    setLocalHours(updated);
    updateHours.mutate(updated);
  };

  const handleTimeChange = (idx: number, field: 'open' | 'close', val: string) => {
    const newDays = [...localHours.days];
    newDays[idx] = { ...newDays[idx], [field]: val };
    setLocalHours({ ...localHours, days: newDays });
  };

  const handleTimeBlur = (idx: number) => {
    const day = localHours.days[idx];
    if (TIME_REGEX.test(day.open) && TIME_REGEX.test(day.close)) {
      updateHours.mutate(localHours);
    }
  };

  return (
    <KeyboardAwareScrollViewCompat
      style={[styles.root, { backgroundColor: colors.background }]}
      contentContainerStyle={styles.content}
      bottomOffset={20}
      keyboardShouldPersistTaps="handled"
    >
      <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <View style={styles.row}>
          <Switch
            value={localHours.enabled}
            onValueChange={handleGlobalToggle}
            trackColor={{ false: colors.muted, true: colors.success }}
            thumbColor={colors.switchThumb}
            disabled={updateHours.isPending}
          />
          <View>
            <Text style={[styles.title, { color: colors.foreground }]}>استقبال الطلبات</Text>
            <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>تفعيل أو إيقاف استقبال الطلبات كليًا</Text>
          </View>
        </View>
      </View>

      <Text style={[styles.sectionTitle, { color: colors.foreground }]}>ساعات العمل الأسبوعية</Text>

      {updateHours.isError && (
        <View style={[styles.errorBox, { backgroundColor: colors.destructiveSoft, borderColor: colors.destructive }]}>
          <Text style={[styles.errorBoxText, { color: colors.destructive }]}>{updateHours.error?.message}</Text>
        </View>
      )}

      {localHours.days.map((day, idx) => {
        const isOpenInvalid = !TIME_REGEX.test(day.open);
        const isCloseInvalid = !TIME_REGEX.test(day.close);
        
        return (
          <View key={idx} style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border, marginBottom: 8 }]}>
            <View style={styles.dayRow}>
              <View style={styles.dayInfo}>
                <Switch
                  value={day.enabled}
                  onValueChange={(val) => handleDayToggle(idx, val)}
                  trackColor={{ false: colors.muted, true: colors.success }}
                  thumbColor={colors.switchThumb}
                  disabled={updateHours.isPending}
                />
                <Text style={[styles.dayName, { color: day.enabled ? colors.foreground : colors.mutedForeground }]}>
                  {DAYS_AR[idx]}
                </Text>
              </View>
              <View style={styles.timeInputsRow}>
                <TextInput
                  style={[
                    styles.timeInput,
                    { 
                      color: day.enabled ? colors.foreground : colors.mutedForeground,
                      borderColor: isCloseInvalid ? colors.destructive : colors.border,
                      backgroundColor: colors.inputBackground
                    }
                  ]}
                  value={day.close}
                  onChangeText={(val) => handleTimeChange(idx, 'close', val)}
                  onBlur={() => handleTimeBlur(idx)}
                  editable={day.enabled}
                  placeholder="23:59"
                  keyboardType="numbers-and-punctuation"
                />
                <Text style={{ color: colors.mutedForeground, marginHorizontal: 4 }}>-</Text>
                <TextInput
                  style={[
                    styles.timeInput,
                    { 
                      color: day.enabled ? colors.foreground : colors.mutedForeground,
                      borderColor: isOpenInvalid ? colors.destructive : colors.border,
                      backgroundColor: colors.inputBackground
                    }
                  ]}
                  value={day.open}
                  onChangeText={(val) => handleTimeChange(idx, 'open', val)}
                  onBlur={() => handleTimeBlur(idx)}
                  editable={day.enabled}
                  placeholder="08:00"
                  keyboardType="numbers-and-punctuation"
                />
              </View>
            </View>
            {(isOpenInvalid || isCloseInvalid) && day.enabled && (
              <Text style={[styles.validationError, { color: colors.destructive }]}>صيغة الوقت غير صحيحة (مثال: 08:30)</Text>
            )}
          </View>
        );
      })}
    </KeyboardAwareScrollViewCompat>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  content: { padding: 16 },
  card: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 16,
    marginBottom: 24,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  title: {
    fontSize: 16,
    fontFamily: 'Inter_700Bold',
    textAlign: 'right',
  },
  subtitle: {
    fontSize: 13,
    fontFamily: 'Inter_400Regular',
    textAlign: 'right',
    marginTop: 4,
  },
  sectionTitle: {
    fontSize: 16,
    fontFamily: 'Inter_600SemiBold',
    textAlign: 'right',
    marginBottom: 12,
  },
  dayRow: {
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  dayInfo: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 12,
  },
  dayName: {
    fontSize: 15,
    fontFamily: 'Inter_600SemiBold',
    width: 60,
    textAlign: 'right',
  },
  timeInputsRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  timeInput: {
    borderWidth: 1,
    borderRadius: 6,
    width: 60,
    height: 36,
    textAlign: 'center',
    fontFamily: 'Inter_500Medium',
    fontSize: 14,
  },
  validationError: {
    fontSize: 12,
    fontFamily: 'Inter_400Regular',
    textAlign: 'left',
    marginTop: 8,
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
});
