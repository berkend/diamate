/**
 * DiaMate Insights Screen
 * Personalized recommendations based on user data
 */
import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAppStore } from '../store/appStore';

interface Insight {
  id: string;
  type: 'tip' | 'warning' | 'achievement' | 'pattern';
  icon: string;
  title: string;
  description: string;
  action?: string;
}

export function InsightsScreen() {
  const { profile, getWeekStats, getTodayGlucose, glucoseReadings } = useAppStore();
  const [insights, setInsights] = useState<Insight[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    generateInsights();
  }, [glucoseReadings]);

  const generateInsights = () => {
    const newInsights: Insight[] = [];
    const weekStats = getWeekStats();
    const todayReadings = getTodayGlucose();
    const targetHigh = profile?.targetHigh || 180;

    // Time in range insight
    if (weekStats.timeInRange !== null) {
      if (weekStats.timeInRange >= 70) {
        newInsights.push({
          id: 'tir_good',
          type: 'achievement',
          icon: '🎯',
          title: 'Harika İş!',
          description: `Bu hafta zamanın %${weekStats.timeInRange}'ini hedef aralıkta geçirdiniz. Devam edin!`,
        });
      } else if (weekStats.timeInRange < 50) {
        newInsights.push({
          id: 'tir_low',
          type: 'warning',
          icon: '⚠️',
          title: 'Hedef Aralık Düşük',
          description: `Bu hafta zamanın sadece %${weekStats.timeInRange}'ini hedef aralıkta geçirdiniz. Yemek ve aktivite paternlerinizi gözden geçirin.`,
          action: 'Raporları İncele',
        });
      }
    }

    // Hypo events
    if (weekStats.hypoCount && weekStats.hypoCount > 3) {
      newInsights.push({
        id: 'hypo_frequent',
        type: 'warning',
        icon: '🚨',
        title: 'Sık Hipoglisemi',
        description: `Bu hafta ${weekStats.hypoCount} kez düşük kan şekeri yaşadınız. Doktorunuzla görüşmeyi düşünün.`,
        action: 'Detayları Gör',
      });
    }

    // Hyper events
    if (weekStats.hyperCount && weekStats.hyperCount > 5) {
      newInsights.push({
        id: 'hyper_frequent',
        type: 'warning',
        icon: '📈',
        title: 'Sık Hiperglisemi',
        description: `Bu hafta ${weekStats.hyperCount} kez yüksek kan şekeri yaşadınız. Karbonhidrat alımınızı gözden geçirin.`,
        action: 'Öğünleri İncele',
      });
    }

    // Morning glucose pattern
    const morningReadings = todayReadings.filter(r => {
      const hour = new Date(r.timestamp).getHours();
      return hour >= 5 && hour <= 9;
    });
    
    if (morningReadings.length > 0) {
      const avgMorning = Math.round(
        morningReadings.reduce((a, b) => a + b.mgdl, 0) / morningReadings.length
      );
      
      if (avgMorning > targetHigh) {
        newInsights.push({
          id: 'dawn_phenomenon',
          type: 'pattern',
          icon: '🌅',
          title: 'Sabah Yüksekliği',
          description: `Sabah ortalama glukozunuz ${avgMorning} mg/dL. Bu "şafak fenomeni" olabilir.`,
          action: 'Daha Fazla Bilgi',
        });
      }
    }

    // No readings today
    if (todayReadings.length === 0) {
      newInsights.push({
        id: 'no_readings',
        type: 'tip',
        icon: '📊',
        title: 'Bugün Ölçüm Yok',
        description: 'Henüz bugün için glukoz ölçümü yok. Sağlık uygulamanızı senkronize edin veya manuel ölçüm ekleyin.',
        action: 'Ölçüm Ekle',
      });
    }

    // General tips
    if (newInsights.length < 3) {
      const tips = [
        {
          id: 'tip_water',
          type: 'tip' as const,
          icon: '💧',
          title: 'Su İçmeyi Unutmayın',
          description: 'Yeterli su içmek kan şekeri kontrolüne yardımcı olur. Günde en az 8 bardak hedefleyin.',
        },
        {
          id: 'tip_walk',
          type: 'tip' as const,
          icon: '🚶',
          title: 'Yemek Sonrası Yürüyüş',
          description: 'Yemekten 15-30 dakika sonra kısa bir yürüyüş, kan şekeri yükselişini azaltabilir.',
        },
        {
          id: 'tip_sleep',
          type: 'tip' as const,
          icon: '😴',
          title: 'Kaliteli Uyku',
          description: 'Düzenli ve kaliteli uyku, insülin duyarlılığını artırır ve kan şekeri kontrolünü iyileştirir.',
        },
        {
          id: 'tip_fiber',
          type: 'tip' as const,
          icon: '🥗',
          title: 'Lif Alımı',
          description: 'Yüksek lifli yiyecekler kan şekerinin daha yavaş yükselmesine yardımcı olur.',
        },
      ];
      
      // Add random tips to fill
      const shuffled = tips.sort(() => 0.5 - Math.random());
      newInsights.push(...shuffled.slice(0, 3 - newInsights.length));
    }

    setInsights(newInsights);
  };

  const onRefresh = async () => {
    setRefreshing(true);
    generateInsights();
    setRefreshing(false);
  };

  const getInsightStyle = (type: Insight['type']) => {
    switch (type) {
      case 'warning':
        return { backgroundColor: '#FEF2F2', borderColor: '#FECACA' };
      case 'achievement':
        return { backgroundColor: '#ECFDF5', borderColor: '#A7F3D0' };
      case 'pattern':
        return { backgroundColor: '#EFF6FF', borderColor: '#BFDBFE' };
      default:
        return { backgroundColor: '#F9FAFB', borderColor: '#E5E7EB' };
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView
        style={styles.scrollView}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>💡 Kişisel Öneriler</Text>
          <Text style={styles.subtitle}>
            Verilerinize göre hazırlanmış öneriler
          </Text>
        </View>

        {/* Insights List */}
        <View style={styles.insightsList}>
          {insights.map((insight) => (
            <View
              key={insight.id}
              style={[styles.insightCard, getInsightStyle(insight.type)]}
            >
              <View style={styles.insightHeader}>
                <Text style={styles.insightIcon}>{insight.icon}</Text>
                <Text style={styles.insightTitle}>{insight.title}</Text>
              </View>
              <Text style={styles.insightDescription}>{insight.description}</Text>
              {insight.action && (
                <TouchableOpacity style={styles.insightAction}>
                  <Text style={styles.insightActionText}>{insight.action} →</Text>
                </TouchableOpacity>
              )}
            </View>
          ))}
        </View>

        {/* Disclaimer */}
        <View style={styles.disclaimer}>
          <Text style={styles.disclaimerText}>
            ⚠️ Bu öneriler genel bilgi amaçlıdır ve tıbbi tavsiye yerine geçmez. 
            Tedavi değişiklikleri için her zaman doktorunuza danışın.
          </Text>
        </View>

        <View style={{ height: 100 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  scrollView: {
    flex: 1,
  },
  header: {
    padding: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: '#1F2937',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 15,
    color: '#6B7280',
  },
  insightsList: {
    paddingHorizontal: 20,
  },
  insightCard: {
    padding: 20,
    borderRadius: 16,
    borderWidth: 1,
    marginBottom: 12,
  },
  insightHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  insightIcon: {
    fontSize: 24,
    marginRight: 10,
  },
  insightTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: '#1F2937',
  },
  insightDescription: {
    fontSize: 14,
    color: '#4B5563',
    lineHeight: 20,
  },
  insightAction: {
    marginTop: 12,
  },
  insightActionText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#16A34A',
  },
  disclaimer: {
    margin: 20,
    padding: 16,
    backgroundColor: '#FEF3C7',
    borderRadius: 12,
  },
  disclaimerText: {
    fontSize: 12,
    color: '#92400E',
    lineHeight: 18,
  },
});
