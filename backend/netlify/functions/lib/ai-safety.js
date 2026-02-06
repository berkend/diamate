// AI Safety Filter - Prevents direct insulin dose instructions

/**
 * Patterns that indicate a direct dose instruction request
 */
const DOSE_REQUEST_PATTERNS = [
    /kaç\s*(ünite|unite|birim)/i,
    /ne\s*kadar\s*insülin/i,
    /insülin\s*doz(u|unu)/i,
    /how\s*much\s*insulin/i,
    /how\s*many\s*units/i,
    /\d+\s*(ünite|unite|units?|u)\s*(yap|vur|al|inject)/i,
    /bolus\s*kaç/i,
    /düzeltme\s*doz/i,
    /correction\s*dose/i
];

/**
 * Patterns in AI response that indicate direct dose instruction
 */
const UNSAFE_RESPONSE_PATTERNS = [
    /(\d+)\s*(ünite|unite|units?|u)\s*(insülin|insulin)?\s*(yap|vur|al|inject|kullan)/i,
    /(\d+)\s*(ünite|unite|units?|u)\s*(bolus|basal|hızlı|rapid)/i,
    /tam\s*olarak\s*(\d+)\s*(ünite|unite|units?)/i,
    /exactly\s*(\d+)\s*(units?|u)/i,
    /take\s*(\d+)\s*(units?|u)/i,
    /inject\s*(\d+)\s*(units?|u)/i
];

/**
 * Check if user message is asking for direct dose
 */
function isDoseRequest(message) {
    const lowerMessage = message.toLowerCase();
    return DOSE_REQUEST_PATTERNS.some(pattern => pattern.test(lowerMessage));
}

/**
 * Check if AI response contains unsafe dose instruction
 */
function containsUnsafeDose(response) {
    return UNSAFE_RESPONSE_PATTERNS.some(pattern => pattern.test(response));
}

/**
 * Get safe response for dose requests
 */
function getSafeDoseResponse(lang = 'tr') {
    if (lang === 'en') {
        return {
            text: `⚠️ **Safety Notice**

I cannot provide specific insulin dose recommendations. Insulin dosing is highly individual and depends on many factors that require careful calculation.

**What you should do:**
1. 📱 Use the **Dose Calculator** in DiaMate - it uses your personal ICR and ISF ratios
2. 🩺 Consult your healthcare provider for dose adjustments
3. 📊 Review your glucose patterns in the Reports section

The dose calculator takes into account:
- Your current blood glucose
- Carbohydrates you're eating
- Your insulin-to-carb ratio (ICR)
- Your insulin sensitivity factor (ISF)
- Active insulin on board (IOB)

Would you like me to explain how to use the dose calculator, or help you understand your glucose patterns?`,
            isSafetyResponse: true,
            showCalculatorButton: true
        };
    }

    return {
        text: `⚠️ **Güvenlik Uyarısı**

Spesifik insülin doz önerisi veremem. İnsülin dozlaması kişiye özeldir ve dikkatli hesaplama gerektiren birçok faktöre bağlıdır.

**Yapmanız gerekenler:**
1. 📱 DiaMate'teki **Doz Hesaplayıcı**'yı kullanın - kişisel ICR ve ISF oranlarınızı kullanır
2. 🩺 Doz ayarlamaları için sağlık uzmanınıza danışın
3. 📊 Raporlar bölümünde glukoz paternlerinizi inceleyin

Doz hesaplayıcı şunları dikkate alır:
- Mevcut kan şekeriniz
- Yiyeceğiniz karbonhidrat
- İnsülin/karbonhidrat oranınız (ICR)
- İnsülin duyarlılık faktörünüz (ISF)
- Aktif insülin (IOB)

Doz hesaplayıcıyı nasıl kullanacağınızı açıklamamı veya glukoz paternlerinizi anlamanıza yardımcı olmamı ister misiniz?`,
        isSafetyResponse: true,
        showCalculatorButton: true
    };
}

/**
 * Filter AI response for safety
 */
function filterResponse(response, lang = 'tr') {
    if (containsUnsafeDose(response)) {
        // Replace unsafe content with safe alternative
        const safeResponse = getSafeDoseResponse(lang);
        return {
            text: safeResponse.text,
            wasFiltered: true,
            showCalculatorButton: true
        };
    }

    return {
        text: response,
        wasFiltered: false,
        showCalculatorButton: false
    };
}

/**
 * Get system prompt safety instructions
 */
function getSafetySystemPrompt() {
    return `
## CRITICAL SAFETY RULES - MUST FOLLOW:

1. **NEVER provide specific insulin doses** - Do not say "take X units" or "inject X units"
2. **NEVER calculate doses directly** - Always redirect to the app's dose calculator
3. **For dose questions**, respond with:
   - Acknowledge the question
   - Explain you cannot provide specific doses
   - Redirect to the dose calculator feature
   - Offer to explain how dosing factors work generally

4. **For hypoglycemia (low blood sugar)**:
   - Provide immediate action steps (15-20g fast carbs)
   - Recommend rechecking in 15 minutes
   - Suggest contacting someone if severe

5. **For hyperglycemia (high blood sugar)**:
   - Suggest checking ketones if very high
   - Recommend using the dose calculator
   - Advise hydration
   - Suggest contacting healthcare provider if persistent

6. **General safety**:
   - Always recommend consulting healthcare providers for medication changes
   - Never diagnose conditions
   - Encourage regular medical checkups
`;
}

module.exports = {
    isDoseRequest,
    containsUnsafeDose,
    getSafeDoseResponse,
    filterResponse,
    getSafetySystemPrompt
};
