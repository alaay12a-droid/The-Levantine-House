import React, { useState, useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, SectionList, Switch, Image } from 'react-native';
import { useColors } from '@/hooks/useColors';
import { useMenuQuery, useCategoriesQuery, useUpdateMenuItem, ApiMenuItem } from '@/hooks/useApi';
import { Feather } from '@expo/vector-icons';

function money(value: number) {
  return `${value.toFixed(2)} ر.س`;
}

type GroupChoice = { name: string; extraPrice: number; available: boolean };
type OptionGroupData = { groupName: string; sourceItem: string; choices: GroupChoice[] };

type MenuListItem =
  | { kind: 'item'; value: ApiMenuItem }
  | { kind: 'option'; value: OptionGroupData };

type SectionData = {
  title: string;
  data: MenuListItem[];
};

export default function MenuScreen() {
  const colors = useColors();
  const { data: menu = [], isLoading: menuLoading, isError: menuError, error: menuErrorObj, refetch: refetchMenu } = useMenuQuery();
  const { data: categories = [], isLoading: catLoading, isError: catError, error: catErrorObj, refetch: refetchCats } = useCategoriesQuery();
  const [activeTab, setActiveTab] = useState<'items' | 'options'>('items');
  const [collapsedSections, setCollapsedSections] = useState<Set<string>>(new Set());

  const sections = useMemo<SectionData[]>(() => {
    if (activeTab === 'options') {
      const groupsMap: Record<string, OptionGroupData[]> = {};
      menu.forEach((item) => {
        item.options?.forEach((opt) => {
          if (!groupsMap[item.name]) groupsMap[item.name] = [];
          groupsMap[item.name].push({ groupName: opt.groupName, sourceItem: item.name, choices: opt.choices });
        });
      });
      return Object.entries(groupsMap).map(([title, data]) => ({
        title,
        data: collapsedSections.has(title)
          ? []
          : data.map((value) => ({ kind: 'option' as const, value })),
      }));
    }

    const map = new Map<string, ApiMenuItem[]>();
    categories.forEach((cat) => map.set(cat.id, []));
    menu.forEach((item) => {
      const arr = map.get(item.category) || [];
      arr.push(item);
      map.set(item.category, arr);
    });

    return Array.from(map.entries())
      .filter(([_, items]) => items.length > 0)
      .map(([title, data]) => ({
        title,
        data: collapsedSections.has(title)
          ? []
          : data.map((value) => ({ kind: 'item' as const, value })),
      }));
  }, [menu, categories, activeTab, collapsedSections]);

  const toggleSection = (title: string) => {
    setCollapsedSections((prev) => {
      const next = new Set(prev);
      if (next.has(title)) next.delete(title);
      else next.add(title);
      return next;
    });
  };

  const hasError = menuError || catError;
  const errorMsg = menuErrorObj?.message || catErrorObj?.message;

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <View style={[styles.tabs, { backgroundColor: colors.card, borderBottomColor: colors.border }]}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'items' && { borderBottomColor: colors.primary }]}
          onPress={() => setActiveTab('items')}
        >
          <Text style={[styles.tabLabel, { color: activeTab === 'items' ? colors.primaryDark : colors.mutedForeground }]}>الأصناف</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'options' && { borderBottomColor: colors.primary }]}
          onPress={() => setActiveTab('options')}
        >
          <Text style={[styles.tabLabel, { color: activeTab === 'options' ? colors.primaryDark : colors.mutedForeground }]}>مجموعات خيارات</Text>
        </TouchableOpacity>
      </View>

      {menuLoading || catLoading ? (
        <ActivityIndicator size="large" color={colors.primary} style={{ marginTop: 40 }} />
      ) : hasError ? (
        <View style={styles.errorState}>
          <Feather name="alert-triangle" size={32} color={colors.destructive} style={{ marginBottom: 16 }} />
          <Text style={[styles.errorTitle, { color: colors.destructive }]}>تعذر جلب القائمة</Text>
          <Text style={[styles.errorSubtitle, { color: colors.mutedForeground }]}>{errorMsg}</Text>
          <TouchableOpacity style={[styles.retryBtn, { backgroundColor: colors.primary }]} onPress={() => { refetchMenu(); refetchCats(); }}>
            <Text style={[styles.retryText, { color: colors.primaryForeground }]}>إعادة المحاولة</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <SectionList
          sections={sections}
          keyExtractor={(item, index) =>
            item.kind === 'item'
              ? `item-${item.value.itemId}`
              : `option-${item.value.sourceItem}-${item.value.groupName}-${index}`
          }
          contentContainerStyle={styles.listContent}
          renderSectionHeader={({ section }) => {
            const title = section.title;
            const displayTitle = categories.find((c) => c.id === title)?.name || title;
            const isCollapsed = collapsedSections.has(title);
            return (
              <TouchableOpacity
                style={[styles.sectionHeader, { backgroundColor: colors.background }]}
                onPress={() => toggleSection(title)}
              >
                <Feather name={isCollapsed ? "chevron-down" : "chevron-up"} size={20} color={colors.foreground} />
                <Text style={[styles.sectionTitle, { color: colors.foreground }]}>{displayTitle}</Text>
              </TouchableOpacity>
            );
          }}
          renderItem={({ item }) => {
            if (item.kind === 'option') {
              return <OptionGroupCard group={item.value} />;
            }
            return <ItemCard item={item.value} />;
          }}
        />
      )}
    </View>
  );
}

function ItemCard({ item }: { item: ApiMenuItem }) {
  const colors = useColors();
  const updateItem = useUpdateMenuItem();
  const isUpdating = updateItem.isPending && updateItem.variables?.itemId === item.itemId;
  const hasUpdateError = updateItem.isError && updateItem.variables?.itemId === item.itemId;

  return (
    <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <View style={styles.cardContent}>
        <View style={styles.cardInfo}>
          <Text style={[styles.itemName, { color: colors.foreground }]}>{item.name}</Text>
          <Text style={[styles.itemPrice, { color: colors.mutedForeground }]}>{money(item.price / 100)}</Text>
          <View style={styles.switchRow}>
            <Text style={[styles.switchLabel, { color: item.available ? colors.success : colors.mutedForeground }]}>
              {item.available ? 'متاح بشكل دوري' : 'غير متوفر حتى إعادة التفعيل'}
            </Text>
            {isUpdating ? (
              <ActivityIndicator size="small" color={colors.primary} style={{ marginLeft: 8 }} />
            ) : (
              <Switch
                value={item.available}
                onValueChange={(val) => updateItem.mutate({ itemId: item.itemId, available: val })}
                trackColor={{ false: colors.muted, true: colors.success }}
                thumbColor={colors.switchThumb}
                disabled={updateItem.isPending}
              />
            )}
          </View>
          {hasUpdateError && (
            <Text style={[styles.errorText, { color: colors.destructive }]}>
              {updateItem.error?.message}
            </Text>
          )}
        </View>
        {item.imageUrl && (
          <Image source={{ uri: item.imageUrl }} style={styles.itemImage} />
        )}
      </View>
    </View>
  );
}

function OptionGroupCard({ group }: { group: OptionGroupData }) {
  const colors = useColors();
  return (
    <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <Text style={[styles.itemName, { color: colors.foreground, textAlign: 'right', marginBottom: 8 }]}>{group.groupName}</Text>
      <View style={{ gap: 6 }}>
        {group.choices.map((choice: GroupChoice, idx: number) => (
          <View key={idx} style={[styles.choiceRow, { borderTopColor: colors.border }]}>
            <Text style={[styles.choicePrice, { color: colors.mutedForeground }]}>
              {choice.extraPrice > 0 ? `+ ${money(choice.extraPrice / 100)}` : 'مجانًا'}
            </Text>
            <Text style={[styles.choiceName, { color: colors.foreground }]}>{choice.name}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  tabs: {
    flexDirection: 'row-reverse',
    borderBottomWidth: 1,
    height: 48,
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabLabel: {
    fontSize: 14,
    fontFamily: 'Inter_600SemiBold',
  },
  listContent: {
    padding: 16,
    paddingBottom: 40,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    marginBottom: 8,
  },
  sectionTitle: {
    fontSize: 18,
    fontFamily: 'Inter_700Bold',
  },
  card: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
  },
  cardContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  itemImage: {
    width: 64,
    height: 64,
    borderRadius: 8,
    marginLeft: 12,
  },
  cardInfo: {
    flex: 1,
    alignItems: 'flex-end',
  },
  itemName: {
    fontSize: 15,
    fontFamily: 'Inter_600SemiBold',
  },
  itemPrice: {
    fontSize: 14,
    fontFamily: 'Inter_500Medium',
    marginTop: 4,
  },
  switchRow: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    marginTop: 8,
    gap: 8,
  },
  switchLabel: {
    fontSize: 13,
    fontFamily: 'Inter_500Medium',
  },
  choiceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: 6,
  },
  choiceName: {
    fontSize: 14,
    fontFamily: 'Inter_400Regular',
  },
  choicePrice: {
    fontSize: 13,
    fontFamily: 'Inter_500Medium',
  },
  errorState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
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
  errorText: {
    fontSize: 12,
    fontFamily: 'Inter_400Regular',
    marginTop: 6,
    textAlign: 'right',
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
