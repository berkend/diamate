/**
 * DiaMate Profile View
 */
import { getProfile, setProfile, resetDB, isSetupComplete, getReminders, addReminder, toggleReminder, deleteReminder, getFavoriteMeals, deleteFavoriteMeal } from '../store.js';
import { createToast, showConfirm, t } from '../utils.js';
import { navigateTo } from '../router.js';
import { signOut, getCurrentUser, saveProfileToCloud, getSession } from '../supabase.js';
import { getEntitlement, clearEntitlementCache } from '../ai-assistant.js';

/**
 * Initialize profile view
 */
export function initProfile() {
    renderProfileView();
}

/**
 * Render profile view
 */
export async function renderProfileView() {
    const container = document.getElementById('profileScreen');
    if (!container) return;
    
    const profile = getProfile();
    const user = await getCurrentUser();
    const entitlement = await getEntitlement(true);
    const isPro = entitlement?.isPro || false;
    
    const diabetesLabels = {
        'T1': t('Tip 1 Diyabet', 'Type 1 Diabetes'),
        'T2': t('Tip 2 Diyabet', 'Type 2 Diabetes'),
        'type1': t('Tip 1 Diyabet', 'Type 1 Diabetes'),
        'type2': t('Tip 2 Diyabet', 'Type 2 Diabetes'),
        'gestational': t('Gebelik Diyabeti', 'Gestational Diabetes'),
        'prediabetes': t('Prediyabet', 'Prediabetes'),
        'Other': t('Diğer', 'Other')
    };
    
    const genderIcon = profile.gender === 'male' ? '👨' : profile.gender === 'female' ? '👩' : '👤';
    const bmi = profile.height && profile.weight ? 
        (profile.weight / Math.pow(profile.height / 100, 2)).toFixed(1) : '--';
    
    container.innerHTML = `
        <!-- Profile Header -->
        <div style="background: linear-gradient(135deg, var(--primary) 0%, var(--primary-light) 100%); padding: 30px 24px; border-radius: 24px; margin-bottom: 16px; text-align: center; color: white;">
            <div style="width: 90px; height: 90px; background: rgba(255,255,255,0.2); border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 44px; margin: 0 auto 16px; border: 3px solid rgba(255,255,255,0.3);">${genderIcon}</div>
            <div style="font-size: 24px; font-weight: 800;">${profile.name || t('Kullanıcı', 'User')}</div>
            <div style="font-size: 14px; opacity: 0.9; margin-top: 6px;">${diabetesLabels[profile.diabetesType] || t('Diyabet', 'Diabetes')}</div>
            ${user ? `<div style="font-size: 12px; opacity: 0.7; margin-top: 8px;">📧 ${user.email}</div>` : ''}
        </div>
        
        <!-- Account Status Card -->
        ${user ? `
        <div style="background: linear-gradient(135deg, #E8F5E9 0%, #C8E6C9 100%); padding: 16px; border-radius: 16px; margin-bottom: 16px; border: 1px solid rgba(76,175,80,0.3);">
            <div style="display: flex; align-items: center; gap: 12px;">
                <span style="font-size: 24px;">☁️</span>
                <div style="flex: 1;">
                    <div style="font-weight: 700; color: #2E7D32; margin-bottom: 4px;">${t('Bulut Senkronizasyonu Aktif', 'Cloud Sync Active')}</div>
                    <div style="font-size: 13px; color: #388E3C; line-height: 1.4;">${t('Verileriniz güvenle yedekleniyor', 'Your data is being backed up securely')}</div>
                </div>
            </div>
        </div>
        ` : `
        <div style="background: linear-gradient(135deg, #FFF3E0 0%, #FFE0B2 100%); padding: 16px; border-radius: 16px; margin-bottom: 16px; border: 1px solid rgba(255,152,0,0.3);">
            <div style="display: flex; align-items: center; gap: 12px;">
                <span style="font-size: 24px;">⚠️</span>
                <div style="flex: 1;">
                    <div style="font-weight: 700; color: #E65100; margin-bottom: 4px;">${t('Giriş Yapılmadı', 'Not Signed In')}</div>
                    <div style="font-size: 13px; color: #F57C00; line-height: 1.4;">${t('Verilerinizi yedeklemek için giriş yapın', 'Sign in to backup your data')}</div>
                </div>
            </div>
        </div>
        `}
        
        <!-- Subscription Card -->
        ${isPro ? `
        <div style="background: linear-gradient(135deg, #FFD700 0%, #FFA000 100%); padding: 16px; border-radius: 16px; margin-bottom: 16px; border: 1px solid rgba(255,215,0,0.3);">
            <div style="display: flex; align-items: center; gap: 12px;">
                <span style="font-size: 24px;">👑</span>
                <div style="flex: 1;">
                    <div style="font-weight: 700; color: #3E2723; margin-bottom: 4px;">DiaMate PRO</div>
                    <div style="font-size: 13px; color: #4E342E; line-height: 1.4;">${t('Tüm özellikler aktif', 'All features active')}</div>
                </div>
            </div>
        </div>
        ` : `
        <div style="background: linear-gradient(135deg, #F3E5F5 0%, #E1BEE7 100%); padding: 20px; border-radius: 16px; margin-bottom: 16px; border: 1px solid rgba(156,39,176,0.2);">
            <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 12px;">
                <span style="font-size: 24px;">🚀</span>
                <div style="flex: 1;">
                    <div style="font-weight: 700; color: #4A148C; margin-bottom: 4px;">DiaMate PRO${t('\'ya Yükselt', ' Upgrade')}</div>
                    <div style="font-size: 12px; color: #6A1B9A; line-height: 1.4;">${t('Sınırsız AI sohbet ve fotoğraf analizi', 'Unlimited AI chat and photo analysis')}</div>
                </div>
            </div>
            <div style="font-size: 12px; color: #7B1FA2; margin-bottom: 12px; line-height: 1.6;">
                ✅ ${t('Sınırsız AI sohbet', 'Unlimited AI chat')}<br>
                ✅ ${t('Sınırsız fotoğraf analizi', 'Unlimited photo analysis')}<br>
                ✅ ${t('PDF rapor indirme', 'PDF report download')}<br>
                ✅ ${t('Doktor paylaşım linki', 'Doctor share link')}<br>
                ✅ ${t('Bulut senkronizasyonu', 'Cloud sync')}
            </div>
            <button id="btnUpgradePro" style="width: 100%; padding: 14px; background: linear-gradient(135deg, #9C27B0 0%, #7B1FA2 100%); color: white; border: none; border-radius: 12px; font-size: 15px; font-weight: 700; cursor: pointer; box-shadow: 0 4px 15px rgba(156,39,176,0.3);">
                👑 ${t('PRO\'ya Yükselt', 'Upgrade to PRO')}
            </button>
        </div>
        `}
        
        <!-- Personal Info Card -->
        <div style="background: white; padding: 24px; border-radius: 24px; margin-bottom: 16px; box-shadow: var(--shadow);">
            <div style="font-size: 16px; font-weight: 700; color: var(--text-primary); margin-bottom: 16px;">${t('Kişisel Bilgiler', 'Personal Information')}</div>
            
            <div class="profile-row" style="display: flex; justify-content: space-between; padding: 14px 0; border-bottom: 1px solid var(--border);">
                <span style="color: var(--text-secondary); font-weight: 500;">${t('Ad Soyad', 'Full Name')}</span>
                <span style="font-weight: 600; color: var(--text-primary);">${profile.name || '-'}</span>
            </div>
            <div class="profile-row" style="display: flex; justify-content: space-between; padding: 14px 0; border-bottom: 1px solid var(--border);">
                <span style="color: var(--text-secondary); font-weight: 500;">${t('Yaş', 'Age')}</span>
                <span style="font-weight: 600; color: var(--text-primary);">${profile.age ? profile.age + ' ' + t('yaş', 'years') : '-'}</span>
            </div>
            <div class="profile-row" style="display: flex; justify-content: space-between; padding: 14px 0; border-bottom: 1px solid var(--border);">
                <span style="color: var(--text-secondary); font-weight: 500;">${t('Boy', 'Height')}</span>
                <span style="font-weight: 600; color: var(--text-primary);">${profile.height ? profile.height + ' cm' : '-'}</span>
            </div>
            <div class="profile-row" style="display: flex; justify-content: space-between; padding: 14px 0; border-bottom: 1px solid var(--border);">
                <span style="color: var(--text-secondary); font-weight: 500;">${t('Kilo', 'Weight')}</span>
                <span style="font-weight: 600; color: var(--text-primary);">${profile.weight ? profile.weight + ' kg' : '-'}</span>
            </div>
            <div class="profile-row" style="display: flex; justify-content: space-between; padding: 14px 0;">
                <span style="color: var(--text-secondary); font-weight: 500;">BMI</span>
                <span style="font-weight: 600; color: var(--text-primary);">${bmi} kg/m²</span>
            </div>
        </div>
        
        <!-- Diabetes Settings Card -->
        <div style="background: white; padding: 24px; border-radius: 24px; margin-bottom: 16px; box-shadow: var(--shadow);">
            <div style="font-size: 16px; font-weight: 700; color: var(--text-primary); margin-bottom: 16px;">${t('Diyabet Ayarları', 'Diabetes Settings')}</div>
            
            <div class="profile-row" style="display: flex; justify-content: space-between; padding: 14px 0; border-bottom: 1px solid var(--border);">
                <span style="color: var(--text-secondary); font-weight: 500;">${t('Diyabet Tipi', 'Diabetes Type')}</span>
                <span style="font-weight: 600; color: var(--text-primary);">${diabetesLabels[profile.diabetesType] || '-'}</span>
            </div>
            <div class="profile-row" style="display: flex; justify-content: space-between; padding: 14px 0; border-bottom: 1px solid var(--border);">
                <span style="color: var(--text-secondary); font-weight: 500;">${t('Hedef Aralık', 'Target Range')}</span>
                <span style="font-weight: 600; color: var(--text-primary);">${profile.targetLow || 70} - ${profile.targetHigh || 140} mg/dL</span>
            </div>
            <div class="profile-row" style="display: flex; justify-content: space-between; padding: 14px 0; border-bottom: 1px solid var(--border);">
                <span style="color: var(--text-secondary); font-weight: 500;">${t('İnsülin/Karb Oranı (ICR)', 'Insulin/Carb Ratio (ICR)')}</span>
                <span style="font-weight: 600; color: var(--text-primary);">1:${profile.icr || 10}</span>
            </div>
            <div class="profile-row" style="display: flex; justify-content: space-between; padding: 14px 0; border-bottom: 1px solid var(--border);">
                <span style="color: var(--text-secondary); font-weight: 500;">${t('Düzeltme Faktörü (ISF)', 'Correction Factor (ISF)')}</span>
                <span style="font-weight: 600; color: var(--text-primary);">1:${profile.isf || 30}</span>
            </div>
            <div class="profile-row" style="display: flex; justify-content: space-between; padding: 14px 0;">
                <span style="color: var(--text-secondary); font-weight: 500;">${t('Aktif İnsülin Süresi', 'Active Insulin Duration')}</span>
                <span style="font-weight: 600; color: var(--text-primary);">${profile.activeInsulinHours || 4} ${t('saat', 'hours')}</span>
            </div>
        </div>
        
        <!-- Edit Profile Button -->
        <button id="btnEditProfile" style="width: 100%; padding: 16px; background: linear-gradient(135deg, var(--primary) 0%, var(--primary-light) 100%); color: white; border: none; border-radius: 14px; font-size: 16px; font-weight: 700; cursor: pointer; margin-bottom: 12px; display: flex; align-items: center; justify-content: center; gap: 10px;">
            <span style="font-size: 18px;">✏️</span>
            <span>${t('Profili Düzenle', 'Edit Profile')}</span>
        </button>
        
        <!-- Reminders Card -->
        <div style="background: white; padding: 24px; border-radius: 24px; margin-bottom: 16px; box-shadow: var(--shadow);">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px;">
                <div style="font-size: 16px; font-weight: 700; color: var(--text-primary);">${t('Hatırlatıcılar', 'Reminders')}</div>
                <button id="btnAddReminder" style="padding: 8px 16px; background: var(--primary); color: white; border: none; border-radius: 10px; font-size: 13px; font-weight: 600; cursor: pointer;">+ ${t('Ekle', 'Add')}</button>
            </div>
            ${renderReminders()}
        </div>
        
        <!-- Favorite Meals Card -->
        <div style="background: white; padding: 24px; border-radius: 24px; margin-bottom: 16px; box-shadow: var(--shadow);">
            <div style="font-size: 16px; font-weight: 700; color: var(--text-primary); margin-bottom: 16px;">${t('Favori Yemekler', 'Favorite Meals')}</div>
            ${renderFavoriteMeals()}
        </div>
        
        ${user ? `
        <!-- Sign Out Button -->
        <button id="btnSignOut" style="width: 100%; padding: 16px; background: rgba(255,152,0,0.1); color: #E65100; border: 2px solid rgba(255,152,0,0.3); border-radius: 14px; font-size: 16px; font-weight: 700; cursor: pointer; margin-bottom: 12px;">
            ${t('Çıkış Yap', 'Sign Out')}
        </button>
        ` : ''}
        
        <!-- Reset Button -->
        <button id="btnReset" style="width: 100%; padding: 16px; background: rgba(244,67,54,0.1); color: var(--error); border: 2px solid rgba(244,67,54,0.3); border-radius: 14px; font-size: 16px; font-weight: 700; cursor: pointer;">
            ${t('Tüm Verileri Sil ve Sıfırla', 'Delete All Data and Reset')}
        </button>
    `;
    
    wireProfileEvents(user);
}

function wireProfileEvents(user) {
    document.getElementById('btnEditProfile')?.addEventListener('click', showEditProfileModal);
    document.getElementById('btnAddReminder')?.addEventListener('click', showAddReminderModal);
    
    // PRO Upgrade button
    document.getElementById('btnUpgradePro')?.addEventListener('click', async () => {
        if (!user) {
            createToast('warning', t('PRO abonelik için giriş yapmanız gerekiyor', 'Please sign in to subscribe to PRO'));
            return;
        }
        
        try {
            const btn = document.getElementById('btnUpgradePro');
            btn.disabled = true;
            btn.textContent = '⏳ ' + t('Yönlendiriliyor...', 'Redirecting...');
            
            const session = await getSession();
            const response = await fetch('/.netlify/functions/create-checkout', {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${session?.access_token || ''}`
                },
                body: JSON.stringify({
                    userId: user.id,
                    email: user.email,
                    plan: 'pro_monthly'
                })
            });
            
            const data = await response.json();
            
            if (data.url) {
                window.location.href = data.url;
            } else {
                throw new Error(data.error || 'Checkout failed');
            }
        } catch (e) {
            console.error('Checkout error:', e);
            createToast('error', t('Ödeme sayfası açılamadı: ' + e.message, 'Could not open checkout: ' + e.message));
            const btn = document.getElementById('btnUpgradePro');
            if (btn) {
                btn.disabled = false;
                btn.textContent = '👑 ' + t('PRO\'ya Yükselt', 'Upgrade to PRO');
            }
        }
    });
    
    // Reminder toggle/delete events
    document.querySelectorAll('.reminder-toggle').forEach(btn => {
        btn.addEventListener('click', () => {
            toggleReminder(btn.dataset.id);
            renderProfileView();
        });
    });
    
    document.querySelectorAll('.reminder-delete').forEach(btn => {
        btn.addEventListener('click', () => {
            deleteReminder(btn.dataset.id);
            createToast('success', t('Hatırlatıcı silindi', 'Reminder deleted'));
            renderProfileView();
        });
    });
    
    // Favorite meal delete events
    document.querySelectorAll('.fav-meal-delete').forEach(btn => {
        btn.addEventListener('click', () => {
            deleteFavoriteMeal(btn.dataset.id);
            createToast('success', t('Favori silindi', 'Favorite deleted'));
            renderProfileView();
        });
    });
    
    document.getElementById('btnSignOut')?.addEventListener('click', async () => {
        showConfirm(
            t('Çıkış Yap', 'Sign Out'),
            t('Hesabınızdan çıkış yapmak istediğinizden emin misiniz?', 'Are you sure you want to sign out?'),
            async () => {
                try {
                    await signOut();
                    createToast('success', t('Çıkış yapıldı', 'Signed out'));
                    navigateTo('login');
                } catch (e) {
                    console.error('Sign out error:', e);
                    createToast('error', t('Çıkış yapılamadı', 'Sign out failed'));
                }
            }
        );
    });
    
    document.getElementById('btnReset')?.addEventListener('click', () => {
        showConfirm(
            t('Tüm Verileri Sil', 'Delete All Data'),
            t('Bu işlem tüm glukoz, öğün ve insülin kayıtlarınızı kalıcı olarak silecektir. Bu işlem geri alınamaz!', 'This will permanently delete all your glucose, meal and insulin records. This action cannot be undone!'),
            async () => {
                resetDB();
                if (user) {
                    try {
                        await signOut();
                    } catch (e) {}
                }
                createToast('success', t('Tüm veriler silindi', 'All data deleted'));
                navigateTo('login');
            }
        );
    });
}

function showEditProfileModal() {
    const profile = getProfile();
    
    const overlay = document.createElement('div');
    overlay.id = 'editProfileOverlay';
    overlay.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: rgba(0,0,0,0.5);
        z-index: 10001;
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 20px;
    `;
    
    overlay.innerHTML = `
        <div style="background: white; border-radius: 24px; padding: 24px; max-width: 400px; width: 100%; max-height: 90vh; overflow-y: auto; box-shadow: 0 10px 40px rgba(0,0,0,0.2);">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
                <div style="font-size: 20px; font-weight: 700;">${t('Profili Düzenle', 'Edit Profile')}</div>
                <button id="closeEditModal" style="width: 36px; height: 36px; border: none; background: var(--background); border-radius: 10px; font-size: 18px; cursor: pointer;">✕</button>
            </div>
            
            <div class="input-group" style="margin-bottom: 16px;">
                <label style="display: block; font-size: 13px; font-weight: 600; color: var(--text-secondary); margin-bottom: 8px;">${t('AD SOYAD', 'FULL NAME')}</label>
                <input type="text" id="editName" class="input" value="${profile.name || ''}" style="padding: 14px;">
            </div>
            
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 16px;">
                <div class="input-group">
                    <label style="display: block; font-size: 13px; font-weight: 600; color: var(--text-secondary); margin-bottom: 8px;">${t('YAŞ', 'AGE')}</label>
                    <input type="number" id="editAge" class="input" value="${profile.age || ''}" style="padding: 14px;">
                </div>
                <div class="input-group">
                    <label style="display: block; font-size: 13px; font-weight: 600; color: var(--text-secondary); margin-bottom: 8px;">${t('CİNSİYET', 'GENDER')}</label>
                    <select id="editGender" class="input" style="padding: 14px;">
                        <option value="">${t('Seçiniz', 'Select')}</option>
                        <option value="male" ${profile.gender === 'male' ? 'selected' : ''}>${t('Erkek', 'Male')}</option>
                        <option value="female" ${profile.gender === 'female' ? 'selected' : ''}>${t('Kadın', 'Female')}</option>
                    </select>
                </div>
            </div>
            
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 16px;">
                <div class="input-group">
                    <label style="display: block; font-size: 13px; font-weight: 600; color: var(--text-secondary); margin-bottom: 8px;">${t('BOY (cm)', 'HEIGHT (cm)')}</label>
                    <input type="number" id="editHeight" class="input" value="${profile.height || ''}" style="padding: 14px;">
                </div>
                <div class="input-group">
                    <label style="display: block; font-size: 13px; font-weight: 600; color: var(--text-secondary); margin-bottom: 8px;">${t('KİLO (kg)', 'WEIGHT (kg)')}</label>
                    <input type="number" id="editWeight" class="input" value="${profile.weight || ''}" style="padding: 14px;">
                </div>
            </div>
            
            <div class="input-group" style="margin-bottom: 16px;">
                <label style="display: block; font-size: 13px; font-weight: 600; color: var(--text-secondary); margin-bottom: 8px;">${t('DİYABET TİPİ', 'DIABETES TYPE')}</label>
                <select id="editDiabetesType" class="input" style="padding: 14px;">
                    <option value="T1" ${profile.diabetesType === 'T1' || profile.diabetesType === 'type1' ? 'selected' : ''}>${t('Tip 1 Diyabet', 'Type 1 Diabetes')}</option>
                    <option value="T2" ${profile.diabetesType === 'T2' || profile.diabetesType === 'type2' ? 'selected' : ''}>${t('Tip 2 Diyabet', 'Type 2 Diabetes')}</option>
                    <option value="Other" ${profile.diabetesType === 'Other' ? 'selected' : ''}>${t('Diğer', 'Other')}</option>
                </select>
            </div>
            
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 16px;">
                <div class="input-group">
                    <label style="display: block; font-size: 13px; font-weight: 600; color: var(--text-secondary); margin-bottom: 8px;">${t('HEDEF DÜŞÜK', 'TARGET LOW')}</label>
                    <input type="number" id="editTargetLow" class="input" value="${profile.targetLow || 70}" style="padding: 14px;">
                </div>
                <div class="input-group">
                    <label style="display: block; font-size: 13px; font-weight: 600; color: var(--text-secondary); margin-bottom: 8px;">${t('HEDEF YÜKSEK', 'TARGET HIGH')}</label>
                    <input type="number" id="editTargetHigh" class="input" value="${profile.targetHigh || 140}" style="padding: 14px;">
                </div>
            </div>
            
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 16px;">
                <div class="input-group">
                    <label style="display: block; font-size: 13px; font-weight: 600; color: var(--text-secondary); margin-bottom: 8px;">ICR (1:X)</label>
                    <input type="number" id="editICR" class="input" value="${profile.icr || 10}" style="padding: 14px;">
                </div>
                <div class="input-group">
                    <label style="display: block; font-size: 13px; font-weight: 600; color: var(--text-secondary); margin-bottom: 8px;">ISF (1:X)</label>
                    <input type="number" id="editISF" class="input" value="${profile.isf || 30}" style="padding: 14px;">
                </div>
            </div>
            
            <button id="saveProfileBtn" style="width: 100%; padding: 16px; background: linear-gradient(135deg, var(--primary) 0%, var(--primary-light) 100%); color: white; border: none; border-radius: 14px; font-size: 16px; font-weight: 700; cursor: pointer;">
                ${t('Kaydet', 'Save')}
            </button>
        </div>
    `;
    
    document.body.appendChild(overlay);
    
    document.getElementById('closeEditModal').onclick = () => overlay.remove();
    overlay.onclick = (e) => { if (e.target === overlay) overlay.remove(); };
    
    document.getElementById('saveProfileBtn').onclick = async () => {
        const updates = {
            name: document.getElementById('editName').value.trim(),
            age: parseInt(document.getElementById('editAge').value) || null,
            gender: document.getElementById('editGender').value,
            height: parseInt(document.getElementById('editHeight').value) || null,
            weight: parseInt(document.getElementById('editWeight').value) || null,
            diabetesType: document.getElementById('editDiabetesType').value,
            targetLow: parseInt(document.getElementById('editTargetLow').value) || 70,
            targetHigh: parseInt(document.getElementById('editTargetHigh').value) || 140,
            icr: parseInt(document.getElementById('editICR').value) || 10,
            isf: parseInt(document.getElementById('editISF').value) || 30
        };
        
        setProfile(updates);
        
        // Save to cloud if logged in
        const user = await getCurrentUser();
        if (user) {
            try {
                await saveProfileToCloud(getProfile());
            } catch (e) {
                console.error('Error saving to cloud:', e);
            }
        }
        
        overlay.remove();
        createToast('success', t('Profil güncellendi', 'Profile updated'));
        renderProfileView();
        
        // Update header name
        const headerName = document.getElementById('headerName');
        if (headerName && updates.name) {
            headerName.textContent = updates.name.split(' ')[0];
        }
    };
}


/**
 * Render reminders list
 */
function renderReminders() {
    const reminders = getReminders();
    
    if (reminders.length === 0) {
        return `
            <div style="text-align: center; padding: 20px; color: var(--text-secondary);">
                <div style="font-size: 32px; margin-bottom: 8px;">⏰</div>
                <div>${t('Henüz hatırlatıcı yok', 'No reminders yet')}</div>
            </div>
        `;
    }
    
    const typeIcons = {
        'glucose': '🩸',
        'insulin': '💉',
        'meal': '🍽️',
        'custom': '📝'
    };
    
    return reminders.map(r => `
        <div style="display: flex; align-items: center; gap: 12px; padding: 12px; background: var(--background); border-radius: 12px; margin-bottom: 8px;">
            <span style="font-size: 24px;">${typeIcons[r.type] || '⏰'}</span>
            <div style="flex: 1;">
                <div style="font-weight: 600; color: var(--text-primary);">${r.title}</div>
                <div style="font-size: 12px; color: var(--text-secondary);">${r.time}</div>
            </div>
            <button class="reminder-toggle" data-id="${r.id}" style="padding: 6px 12px; background: ${r.enabled ? 'var(--success)' : 'var(--border)'}; color: ${r.enabled ? 'white' : 'var(--text-secondary)'}; border: none; border-radius: 8px; font-size: 11px; font-weight: 600; cursor: pointer;">
                ${r.enabled ? 'ON' : 'OFF'}
            </button>
            <button class="reminder-delete" data-id="${r.id}" style="padding: 6px 10px; background: rgba(244,67,54,0.1); color: var(--error); border: none; border-radius: 8px; font-size: 14px; cursor: pointer;">🗑️</button>
        </div>
    `).join('');
}

/**
 * Render favorite meals list
 */
function renderFavoriteMeals() {
    const meals = getFavoriteMeals();
    
    if (meals.length === 0) {
        return `
            <div style="text-align: center; padding: 20px; color: var(--text-secondary);">
                <div style="font-size: 32px; margin-bottom: 8px;">⭐</div>
                <div>${t('Henüz favori yemek yok', 'No favorite meals yet')}</div>
                <div style="font-size: 12px; margin-top: 4px;">${t('Yemek analizi yaptığınızda favorilere ekleyebilirsiniz', 'You can add favorites when analyzing meals')}</div>
            </div>
        `;
    }
    
    return meals.map(m => `
        <div style="display: flex; align-items: center; gap: 12px; padding: 12px; background: var(--background); border-radius: 12px; margin-bottom: 8px;">
            <span style="font-size: 24px;">🍽️</span>
            <div style="flex: 1;">
                <div style="font-weight: 600; color: var(--text-primary);">${m.name}</div>
                <div style="font-size: 12px; color: var(--text-secondary);">${m.totalCarbs}g karb • ${m.usageCount || 0}x kullanıldı</div>
            </div>
            <button class="fav-meal-delete" data-id="${m.id}" style="padding: 6px 10px; background: rgba(244,67,54,0.1); color: var(--error); border: none; border-radius: 8px; font-size: 14px; cursor: pointer;">🗑️</button>
        </div>
    `).join('');
}

/**
 * Show add reminder modal
 */
function showAddReminderModal() {
    const overlay = document.createElement('div');
    overlay.id = 'addReminderOverlay';
    overlay.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: rgba(0,0,0,0.5);
        z-index: 10001;
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 20px;
    `;
    
    overlay.innerHTML = `
        <div style="background: white; border-radius: 24px; padding: 24px; max-width: 400px; width: 100%; box-shadow: 0 10px 40px rgba(0,0,0,0.2);">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
                <div style="font-size: 20px; font-weight: 700;">${t('Hatırlatıcı Ekle', 'Add Reminder')}</div>
                <button id="closeReminderModal" style="width: 36px; height: 36px; border: none; background: var(--background); border-radius: 10px; font-size: 18px; cursor: pointer;">✕</button>
            </div>
            
            <div class="input-group" style="margin-bottom: 16px;">
                <label style="display: block; font-size: 13px; font-weight: 600; color: var(--text-secondary); margin-bottom: 8px;">${t('TİP', 'TYPE')}</label>
                <select id="reminderType" class="input" style="padding: 14px;">
                    <option value="glucose">🩸 ${t('Glukoz Ölçümü', 'Glucose Check')}</option>
                    <option value="insulin">💉 ${t('İnsülin', 'Insulin')}</option>
                    <option value="meal">🍽️ ${t('Öğün', 'Meal')}</option>
                    <option value="custom">📝 ${t('Özel', 'Custom')}</option>
                </select>
            </div>
            
            <div class="input-group" style="margin-bottom: 16px;">
                <label style="display: block; font-size: 13px; font-weight: 600; color: var(--text-secondary); margin-bottom: 8px;">${t('BAŞLIK', 'TITLE')}</label>
                <input type="text" id="reminderTitle" class="input" placeholder="${t('Sabah ölçümü', 'Morning check')}" style="padding: 14px;">
            </div>
            
            <div class="input-group" style="margin-bottom: 16px;">
                <label style="display: block; font-size: 13px; font-weight: 600; color: var(--text-secondary); margin-bottom: 8px;">${t('SAAT', 'TIME')}</label>
                <input type="time" id="reminderTime" class="input" value="08:00" style="padding: 14px;">
            </div>
            
            <button id="saveReminderBtn" style="width: 100%; padding: 16px; background: linear-gradient(135deg, var(--primary) 0%, var(--primary-light) 100%); color: white; border: none; border-radius: 14px; font-size: 16px; font-weight: 700; cursor: pointer;">
                ${t('Kaydet', 'Save')}
            </button>
        </div>
    `;
    
    document.body.appendChild(overlay);
    
    document.getElementById('closeReminderModal').onclick = () => overlay.remove();
    overlay.onclick = (e) => { if (e.target === overlay) overlay.remove(); };
    
    // Auto-fill title based on type
    document.getElementById('reminderType').onchange = (e) => {
        const titles = {
            'glucose': t('Glukoz ölçümü', 'Glucose check'),
            'insulin': t('İnsülin zamanı', 'Insulin time'),
            'meal': t('Öğün zamanı', 'Meal time'),
            'custom': ''
        };
        document.getElementById('reminderTitle').value = titles[e.target.value] || '';
    };
    
    document.getElementById('saveReminderBtn').onclick = () => {
        const type = document.getElementById('reminderType').value;
        const title = document.getElementById('reminderTitle').value.trim();
        const time = document.getElementById('reminderTime').value;
        
        if (!title) {
            createToast('warning', t('Başlık girin', 'Enter a title'));
            return;
        }
        
        addReminder({ type, title, time });
        overlay.remove();
        createToast('success', t('Hatırlatıcı eklendi', 'Reminder added'));
        renderProfileView();
        
        // Note: Web notifications would need to be implemented with Service Worker
        // For now, reminders are stored but notifications are not sent
    };
}
