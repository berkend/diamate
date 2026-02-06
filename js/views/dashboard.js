/**
 * DiaMate Dashboard View
 */
import { getProfile, getTodayEntries, listEntries, getLatestEntry } from '../store.js';
import { SafetyPolicy, getGlucoseStatus, getStatusColor } from '../safety.js';
import { formatRelativeTime, startOfDay, t } from '../utils.js';
import { navigateTo } from '../router.js';
import { getSmartSuggestions, getPersonalizedGreeting, hasApiKey } from '../ai-assistant.js';

/**
 * Render dashboard
 */
export function renderDashboard() {
    renderCurrentGlucose();
    renderTodayStats();
    renderAICard();
    renderRecentActivity();
    renderNudges();
}

/**
 * Render current glucose
 */
function renderCurrentGlucose() {
    const latestGlucose = getLatestEntry('glucose');
    const glucoseEl = document.getElementById('currentGlucose');
    const trendEl = document.getElementById('glucoseTrend');
    const statusEl = document.getElementById('glucoseStatus');
    
    if (!latestGlucose) {
        if (glucoseEl) glucoseEl.textContent = '--';
        if (trendEl) {
            trendEl.innerHTML = `
                <span style="font-size: 18px;">?</span>
                <span style="font-size: 13px; font-weight: 700; color: var(--text-secondary);">${t('Veri yok', 'No data')}</span>
            `;
            trendEl.style.background = 'var(--background)';
        }
        if (statusEl) {
            statusEl.textContent = t('Henüz glukoz ölçümü yok. İlk ölçümünüzü kaydedin!', 'No glucose readings yet. Record your first measurement!');
            statusEl.style.background = 'var(--background)';
            statusEl.style.color = 'var(--text-secondary)';
        }
        return;
    }
    
    const value = latestGlucose.value;
    const status = getGlucoseStatus(value);
    const color = getStatusColor(status);
    const timeSince = formatRelativeTime(latestGlucose.ts);
    
    if (glucoseEl) {
        glucoseEl.textContent = value;
        glucoseEl.style.color = color;
    }
    
    // Calculate trend from last 2 readings
    const recentGlucose = listEntries('glucose', { fromTs: Date.now() - 4 * 60 * 60 * 1000 });
    let trendIcon = '→';
    let trendText = t('Stabil', 'Stable');
    
    if (recentGlucose.length >= 2) {
        const diff = recentGlucose[0].value - recentGlucose[1].value;
        if (diff > 20) {
            trendIcon = '↑';
            trendText = t('Yükseliyor', 'Rising');
        } else if (diff < -20) {
            trendIcon = '↓';
            trendText = t('Düşüyor', 'Falling');
        }
    }
    
    if (trendEl) {
        trendEl.innerHTML = `
            <span style="font-size: 18px;">${trendIcon}</span>
            <span style="font-size: 13px; font-weight: 700; color: ${color};">${trendText}</span>
        `;
        trendEl.style.background = `${color}15`;
    }
    
    if (statusEl) {
        let statusText = '';
        if (status === 'low') {
            statusText = t('⚠️ Düşük - Hemen karbonhidrat alın!', '⚠️ Low - Take carbs immediately!');
        } else if (status === 'high') {
            statusText = t('⚠️ Yüksek - İnsülin dozunuzu kontrol edin', '⚠️ High - Check your insulin dose');
        } else {
            statusText = t('✓ Hedef aralıkta - Harika gidiyorsunuz!', '✓ In target range - Great job!');
        }
        statusText += ` • ${timeSince}`;
        
        statusEl.textContent = statusText;
        statusEl.style.background = `${color}15`;
        statusEl.style.color = color;
    }
}

/**
 * Render today's stats
 */
function renderTodayStats() {
    const todayGlucose = getTodayEntries('glucose');
    const todayMeals = getTodayEntries('meals');
    const todayInsulin = getTodayEntries('insulin');
    
    // Total carbs
    const totalCarbs = todayMeals.reduce((sum, m) => sum + (m.estimatedCarbs || 0), 0);
    const carbsEl = document.getElementById('todayCarbs');
    if (carbsEl) carbsEl.textContent = `${totalCarbs}g`;
    
    // Total rapid insulin
    const totalInsulin = todayInsulin
        .filter(i => i.insulinType === 'rapid')
        .reduce((sum, i) => sum + (i.units || 0), 0);
    const insulinEl = document.getElementById('todayInsulin');
    if (insulinEl) insulinEl.textContent = `${totalInsulin}u`;
    
    // Meal count
    const mealsEl = document.getElementById('todayMeals');
    if (mealsEl) mealsEl.textContent = todayMeals.length;
}

/**
 * Render recent activity
 */
function renderRecentActivity() {
    const container = document.getElementById('recentActivity');
    if (!container) return;
    
    // Get recent entries from all types
    const recentGlucose = listEntries('glucose', { fromTs: Date.now() - 24 * 60 * 60 * 1000 });
    const recentMeals = listEntries('meals', { fromTs: Date.now() - 24 * 60 * 60 * 1000 });
    const recentInsulin = listEntries('insulin', { fromTs: Date.now() - 24 * 60 * 60 * 1000 });
    
    // Merge and sort
    const allEntries = [
        ...recentGlucose.map(e => ({ ...e, type: 'glucose' })),
        ...recentMeals.map(e => ({ ...e, type: 'meal' })),
        ...recentInsulin.map(e => ({ ...e, type: 'insulin' }))
    ].sort((a, b) => b.ts - a.ts).slice(0, 5);
    
    if (allEntries.length === 0) {
        container.innerHTML = `
            <div style="text-align: center; padding: 30px; color: var(--text-secondary);">
                <div style="font-size: 40px; margin-bottom: 12px;">📝</div>
                <div style="font-weight: 600;">${t('Henüz aktivite yok', 'No activity yet')}</div>
                <div style="font-size: 13px; margin-top: 6px;">${t('Glukoz, öğün veya insülin kaydı ekleyin', 'Add glucose, meal or insulin record')}</div>
            </div>
        `;
        return;
    }
    
    let html = '';
    
    allEntries.forEach((entry, index) => {
        const isLast = index === allEntries.length - 1;
        const borderStyle = isLast ? '' : 'border-bottom: 1px solid var(--border);';
        
        if (entry.type === 'glucose') {
            const status = getGlucoseStatus(entry.value);
            const color = getStatusColor(status);
            const statusText = status === 'low' ? t('Düşük', 'Low') : status === 'high' ? t('Yüksek', 'High') : t('Normal', 'Normal');
            
            html += `
                <div style="display: flex; align-items: center; gap: 14px; padding: 14px 0; ${borderStyle}">
                    <div style="width: 44px; height: 44px; background: ${color}15; border-radius: 14px; display: flex; align-items: center; justify-content: center; font-size: 20px;">🩸</div>
                    <div style="flex: 1;">
                        <div style="font-weight: 600; color: var(--text-primary);">${entry.value} mg/dL</div>
                        <div style="font-size: 12px; color: var(--text-secondary);">${t('Glukoz ölçümü', 'Glucose reading')} • ${formatRelativeTime(entry.ts)}</div>
                    </div>
                    <div style="color: ${color}; font-size: 13px; font-weight: 600;">${statusText}</div>
                </div>
            `;
        } else if (entry.type === 'meal') {
            html += `
                <div style="display: flex; align-items: center; gap: 14px; padding: 14px 0; ${borderStyle}">
                    <div style="width: 44px; height: 44px; background: rgba(255,152,0,0.1); border-radius: 14px; display: flex; align-items: center; justify-content: center; font-size: 20px;">🍽️</div>
                    <div style="flex: 1;">
                        <div style="font-weight: 600; color: var(--text-primary);">${entry.items?.[0]?.name || t('Öğün', 'Meal')}</div>
                        <div style="font-size: 12px; color: var(--text-secondary);">${entry.estimatedCarbs}g ${t('karb', 'carbs')} • ${formatRelativeTime(entry.ts)}</div>
                    </div>
                    <div style="color: var(--accent); font-size: 13px; font-weight: 600;">${entry.estimatedCarbs}g</div>
                </div>
            `;
        } else if (entry.type === 'insulin') {
            html += `
                <div style="display: flex; align-items: center; gap: 14px; padding: 14px 0; ${borderStyle}">
                    <div style="width: 44px; height: 44px; background: rgba(33,150,243,0.1); border-radius: 14px; display: flex; align-items: center; justify-content: center; font-size: 20px;">💉</div>
                    <div style="flex: 1;">
                        <div style="font-weight: 600; color: var(--text-primary);">${entry.insulinType === 'rapid' ? t('Hızlı', 'Rapid') : t('Bazal', 'Basal')} ${t('İnsülin', 'Insulin')}</div>
                        <div style="font-size: 12px; color: var(--text-secondary);">${entry.units} ${t('ünite', 'units')} • ${formatRelativeTime(entry.ts)}</div>
                    </div>
                    <div style="color: var(--info); font-size: 13px; font-weight: 600;">${entry.units}u</div>
                </div>
            `;
        }
    });
    
    container.innerHTML = html;
}

/**
 * Render nudge chips
 */
function renderNudges() {
    // Find or create nudge container
    let nudgeContainer = document.getElementById('nudgeContainer');
    
    if (!nudgeContainer) {
        // Insert after quick actions card
        const quickActionsCard = document.querySelector('#dashboardScreen .quick-action')?.closest('div[style*="background: white"]');
        if (quickActionsCard) {
            nudgeContainer = document.createElement('div');
            nudgeContainer.id = 'nudgeContainer';
            nudgeContainer.style.cssText = 'display: flex; flex-wrap: wrap; gap: 10px; margin-bottom: 16px;';
            quickActionsCard.parentNode.insertBefore(nudgeContainer, quickActionsCard.nextSibling);
        }
    }
    
    if (!nudgeContainer) return;
    
    const nudges = [];
    const todayGlucose = getTodayEntries('glucose');
    
    // No glucose today
    if (todayGlucose.length === 0) {
        nudges.push({
            icon: '🩸',
            text: t('Bugün glukoz ölçümü yok', 'No glucose reading today'),
            action: () => navigateTo('log', 'add-glucose'),
            color: '#2196F3'
        });
    }
    
    // High readings today
    const highReadings = todayGlucose.filter(g => g.value > SafetyPolicy.hyperThreshold);
    if (highReadings.length >= 3) {
        nudges.push({
            icon: '⚠️',
            text: t(`Bugün ${highReadings.length} yüksek ölçüm`, `${highReadings.length} high readings today`),
            action: () => navigateTo('reports'),
            color: '#FF9800'
        });
    }
    
    // Low readings today
    const lowReadings = todayGlucose.filter(g => g.value < SafetyPolicy.hypoThreshold);
    if (lowReadings.length > 0) {
        nudges.push({
            icon: '🚨',
            text: t(`Bugün ${lowReadings.length} düşük ölçüm`, `${lowReadings.length} low readings today`),
            action: () => navigateTo('reports'),
            color: '#F44336'
        });
    }
    
    if (nudges.length === 0) {
        nudgeContainer.style.display = 'none';
        return;
    }
    
    nudgeContainer.style.display = 'flex';
    nudgeContainer.innerHTML = nudges.map(n => `
        <button onclick="this.nudgeAction()" style="
            display: flex;
            align-items: center;
            gap: 8px;
            padding: 10px 16px;
            background: ${n.color}15;
            border: 1px solid ${n.color}30;
            border-radius: 12px;
            font-size: 13px;
            font-weight: 600;
            color: ${n.color};
            cursor: pointer;
        ">
            <span>${n.icon}</span>
            <span>${n.text}</span>
        </button>
    `).join('');
    
    // Wire up actions
    nudgeContainer.querySelectorAll('button').forEach((btn, i) => {
        btn.nudgeAction = nudges[i].action;
    });
}

/**
 * Initialize dashboard
 */
export function initDashboard() {
    renderDashboard();
}

/**
 * Render AI Assistant Card
 */
function renderAICard() {
    // Find or create AI card container
    let aiCard = document.getElementById('aiAssistantCard');
    
    if (!aiCard) {
        // Insert after stats grid
        const statsGrid = document.querySelector('#dashboardScreen > div:nth-child(2)');
        if (statsGrid) {
            aiCard = document.createElement('div');
            aiCard.id = 'aiAssistantCard';
            statsGrid.parentNode.insertBefore(aiCard, statsGrid.nextSibling);
        }
    }
    
    if (!aiCard) return;
    
    const suggestions = getSmartSuggestions();
    const topSuggestion = suggestions[0];
    
    aiCard.innerHTML = `
        <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 20px; border-radius: 24px; margin-bottom: 16px; color: white; cursor: pointer; box-shadow: 0 4px 20px rgba(102,126,234,0.4);" onclick="window.DiaMate.navigateTo('chat')">
            <div style="display: flex; align-items: center; gap: 14px;">
                <div style="width: 50px; height: 50px; background: rgba(255,255,255,0.2); border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 26px;">🤖</div>
                <div style="flex: 1;">
                    <div style="font-size: 16px; font-weight: 700; margin-bottom: 4px;">${t('AI Asistanınız', 'Your AI Assistant')}</div>
                    <div style="font-size: 13px; opacity: 0.9; line-height: 1.4;">
                        ${topSuggestion ? topSuggestion.text.substring(0, 60) + (topSuggestion.text.length > 60 ? '...' : '') : t('Sohbet etmek için tıklayın', 'Tap to chat')}
                    </div>
                </div>
                <div style="font-size: 24px; opacity: 0.8;">→</div>
            </div>
        </div>
    `;
}
