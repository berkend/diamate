/**
 * DiaMate Profile View
 */
import { getProfile, setProfile, resetDB, isSetupComplete } from '../store.js';
import { createToast, showConfirm, t } from '../utils.js';
import { navigateTo } from '../router.js';

/**
 * Initialize profile view
 */
export function initProfile() {
    renderProfileView();
}

/**
 * Render profile view
 */
export function renderProfileView() {
    const container = document.getElementById('profileScreen');
    if (!container) return;
    
    const profile = getProfile();
    
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
        </div>
        
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
        
        <!-- Data Storage Info -->
        <div style="background: linear-gradient(135deg, #E3F2FD 0%, #BBDEFB 100%); padding: 16px; border-radius: 16px; margin-bottom: 16px; border: 1px solid rgba(33,150,243,0.3);">
            <div style="display: flex; align-items: center; gap: 12px;">
                <span style="font-size: 24px;">🔒</span>
                <div>
                    <div style="font-weight: 700; color: #1565C0; margin-bottom: 4px;">${t('Veri Depolama: Sadece Yerel', 'Data Storage: Local Only')}</div>
                    <div style="font-size: 13px; color: #1976D2; line-height: 1.4;">${t('Tüm verileriniz bu cihazda güvenle saklanır. Sunucuya veri gönderilmez.', 'All your data is stored securely on this device. No data is sent to servers.')}</div>
                </div>
            </div>
        </div>
        
        <!-- Edit Profile Button -->
        <button id="btnEditProfile" style="width: 100%; padding: 16px; background: linear-gradient(135deg, var(--primary) 0%, var(--primary-light) 100%); color: white; border: none; border-radius: 14px; font-size: 16px; font-weight: 700; cursor: pointer; margin-bottom: 12px; display: flex; align-items: center; justify-content: center; gap: 10px;">
            <span style="font-size: 18px;">✏️</span>
            <span>${t('Profili Düzenle', 'Edit Profile')}</span>
        </button>
        
        <!-- Reset Button -->
        <button id="btnReset" style="width: 100%; padding: 16px; background: rgba(244,67,54,0.1); color: var(--error); border: 2px solid rgba(244,67,54,0.3); border-radius: 14px; font-size: 16px; font-weight: 700; cursor: pointer;">
            ${t('Tüm Verileri Sil ve Sıfırla', 'Delete All Data and Reset')}
        </button>
    `;
    
    wireProfileEvents();
}

function wireProfileEvents() {
    document.getElementById('btnEditProfile')?.addEventListener('click', showEditProfileModal);
    
    document.getElementById('btnReset')?.addEventListener('click', () => {
        showConfirm(
            t('Tüm Verileri Sil', 'Delete All Data'),
            t('Bu işlem tüm glukoz, öğün ve insülin kayıtlarınızı kalıcı olarak silecektir. Bu işlem geri alınamaz!', 'This will permanently delete all your glucose, meal and insulin records. This action cannot be undone!'),
            () => {
                resetDB();
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
    
    document.getElementById('saveProfileBtn').onclick = () => {
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
