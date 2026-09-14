import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { usePrinter } from '@/contexts/PrinterContext';
import { useColors } from '@/hooks/useColors';
import { Feather } from '@expo/vector-icons';

export function PrinterDiagnostics() {
  const { isConnected, activeOrderId, lastPrintedOrder, error, isPreview, printerLogs } = usePrinter();
  const colors = useColors();
  const [expanded, setExpanded] = useState(false);

  return (
    <View>
      <View style={[styles.container, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <View style={styles.content}>
          <View style={styles.textContainer}>
            <Text style={[styles.title, { color: colors.foreground }]}>
              {isPreview ? 'معاينة الواجهة' : isConnected ? 'متصل بخادم البيت الشامي' : 'الاتصال متوقف'}
            </Text>
            <Text style={[styles.subtitle, { color: error ? colors.destructive : colors.mutedForeground }]}>
              {isPreview
                ? 'الاتصال والطباعة التلقائية يعملان داخل تطبيق Android.'
                : error ?? (activeOrderId
                    ? `تتم الآن طباعة الطلب #${activeOrderId}`
                    : lastPrintedOrder
                    ? `آخر فاتورة مطبوعة #${lastPrintedOrder}`
                    : 'تتم مراقبة الطلبات كل 5 ثوانٍ')}
            </Text>
          </View>
          <View style={[styles.iconContainer, { backgroundColor: isPreview ? colors.primarySoft : isConnected ? colors.successSoft : colors.destructiveSoft }]}>
            <Feather
              name={isPreview ? 'monitor' : isConnected ? 'printer' : 'wifi-off'}
              size={20}
              color={isPreview ? colors.primaryDark : isConnected ? colors.success : colors.destructive}
            />
          </View>
        </View>
      </View>

      {!isPreview && printerLogs.length > 0 && (
        <View style={[styles.logCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <TouchableOpacity style={styles.logHeader} onPress={() => setExpanded(!expanded)}>
            <Feather name={expanded ? "chevron-up" : "chevron-down"} size={20} color={colors.foreground} />
            <View style={{ alignItems: 'flex-end' }}>
              <Text style={[styles.logTitle, { color: colors.foreground }]}>سجل الطابعة</Text>
              <Text style={[styles.logCount, { color: colors.mutedForeground }]}>آخر {printerLogs.length} أحداث</Text>
            </View>
          </TouchableOpacity>

          {expanded && (
            <View style={styles.logList}>
              {printerLogs.slice(0, 10).map((entry) => (
                <View key={entry.id} style={[styles.logRow, { borderTopColor: colors.border }]}>
                  <Text
                    selectable
                    style={[
                      styles.logMessage,
                      {
                        color:
                          entry.level === 'error'
                            ? colors.destructive
                            : entry.level === 'success'
                              ? colors.success
                              : colors.foreground,
                      },
                    ]}
                  >
                    {entry.message}
                  </Text>
                  <Text style={[styles.logTime, { color: colors.mutedForeground }]}>
                    {entry.at.toLocaleTimeString('ar-SA', {
                      hour: '2-digit',
                      minute: '2-digit',
                      second: '2-digit',
                    })}
                  </Text>
                </View>
              ))}
            </View>
          )}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    marginBottom: 16,
  },
  content: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  textContainer: {
    flex: 1,
    alignItems: 'flex-end',
    marginRight: 12,
  },
  title: {
    fontSize: 14,
    fontFamily: 'Inter_700Bold',
  },
  subtitle: {
    fontSize: 12,
    fontFamily: 'Inter_400Regular',
    marginTop: 2,
    textAlign: 'right',
  },
  iconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logCard: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    marginBottom: 16,
  },
  logHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  logTitle: {
    fontSize: 14,
    fontFamily: 'Inter_700Bold',
  },
  logCount: {
    fontSize: 12,
    fontFamily: 'Inter_400Regular',
  },
  logList: {
    marginTop: 12,
  },
  logRow: {
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingVertical: 8,
  },
  logMessage: {
    fontSize: 12,
    fontFamily: 'Inter_500Medium',
    textAlign: 'right',
  },
  logTime: {
    fontSize: 10,
    fontFamily: 'Inter_400Regular',
    marginTop: 4,
    textAlign: 'left',
  },
});
