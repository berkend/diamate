// Quota management
const { supabaseAdmin } = require('./supabase');

// Quota limits from env or defaults
const QUOTAS = {
    FREE: {
        chatPerDay: parseInt(process.env.QUOTA_FREE_CHAT_PER_DAY) || 5,
        chatPerMonth: 0,
        visionPerMonth: 0,
        insightPerMonth: 0,
        weeklyPerMonth: 0
    },
    PRO: {
        chatPerDay: 0, // No daily limit for PRO
        chatPerMonth: parseInt(process.env.QUOTA_PRO_CHAT_PER_MONTH) || 500,
        visionPerMonth: parseInt(process.env.QUOTA_PRO_VISION_PER_MONTH) || 200,
        insightPerMonth: parseInt(process.env.QUOTA_PRO_INSIGHT_PER_MONTH) || 150,
        weeklyPerMonth: parseInt(process.env.QUOTA_PRO_WEEKLY_PER_MONTH) || 4
    }
};

// Rate limit: requests per minute per user
const RATE_LIMIT_PER_MINUTE = 10;

/**
 * Get user's entitlement status
 */
async function getEntitlement(userId) {
    const { data, error } = await supabaseAdmin.rpc('get_entitlement', { p_user_id: userId });
    
    if (error) {
        console.error('Entitlement error:', error);
        return null;
    }
    
    return data;
}

/**
 * Check if user can perform action
 * @returns {{ allowed: boolean, error?: string, code?: string }}
 */
async function checkQuota(userId, action) {
    const entitlement = await getEntitlement(userId);
    
    if (!entitlement) {
        return { allowed: false, error: 'Could not verify entitlement', code: 'entitlement_error' };
    }

    const isPro = entitlement.isPro;
    const usage = entitlement.usage;
    const quotas = isPro ? QUOTAS.PRO : QUOTAS.FREE;

    switch (action) {
        case 'chat':
            if (isPro) {
                // PRO: monthly limit
                if (usage.chatCount >= quotas.chatPerMonth) {
                    return { allowed: false, error: 'Monthly chat quota exceeded', code: 'quota_exceeded' };
                }
            } else {
                // FREE: daily limit
                if (usage.dailyChatCount >= quotas.chatPerDay) {
                    return { allowed: false, error: 'Daily chat quota exceeded', code: 'quota_exceeded' };
                }
            }
            break;

        case 'vision':
            if (!isPro) {
                return { allowed: false, error: 'Photo analysis requires PRO subscription', code: 'subscription_required' };
            }
            if (usage.visionCount >= quotas.visionPerMonth) {
                return { allowed: false, error: 'Monthly photo quota exceeded', code: 'quota_exceeded' };
            }
            break;

        case 'insight':
            if (!isPro) {
                return { allowed: false, error: 'AI insights require PRO subscription', code: 'subscription_required' };
            }
            if (usage.insightCount >= quotas.insightPerMonth) {
                return { allowed: false, error: 'Monthly insight quota exceeded', code: 'quota_exceeded' };
            }
            break;

        case 'weekly':
            if (!isPro) {
                return { allowed: false, error: 'Weekly summary requires PRO subscription', code: 'subscription_required' };
            }
            if (usage.weeklyCount >= quotas.weeklyPerMonth) {
                return { allowed: false, error: 'Monthly weekly summary quota exceeded', code: 'quota_exceeded' };
            }
            break;
    }

    return { allowed: true, entitlement };
}

/**
 * Increment usage counter
 */
async function incrementUsage(userId, action) {
    const monthKey = new Date().toISOString().slice(0, 7); // YYYY-MM
    const dayKey = new Date().toISOString().slice(0, 10); // YYYY-MM-DD

    const fieldMap = {
        chat: 'chat_count',
        vision: 'vision_count',
        insight: 'insight_count',
        weekly: 'weekly_count'
    };

    const field = fieldMap[action];
    if (!field) return;

    // Increment monthly usage
    await supabaseAdmin.rpc('increment_usage', {
        p_user_id: userId,
        p_month_key: monthKey,
        p_field: field,
        p_amount: 1
    });

    // For chat, also increment daily usage (for FREE tier tracking)
    if (action === 'chat') {
        await supabaseAdmin.rpc('increment_daily_usage', {
            p_user_id: userId,
            p_day_key: dayKey,
            p_amount: 1
        });
    }
}

/**
 * Simple in-memory rate limiter (for single instance)
 * In production, use Redis or similar
 */
const rateLimitMap = new Map();

function checkRateLimit(userId) {
    const now = Date.now();
    const windowMs = 60000; // 1 minute
    const key = userId;

    if (!rateLimitMap.has(key)) {
        rateLimitMap.set(key, []);
    }

    const timestamps = rateLimitMap.get(key);
    const windowStart = now - windowMs;

    // Remove old timestamps
    const recent = timestamps.filter(t => t > windowStart);
    rateLimitMap.set(key, recent);

    if (recent.length >= RATE_LIMIT_PER_MINUTE) {
        return { allowed: false, error: 'Rate limit exceeded', code: 'rate_limited' };
    }

    recent.push(now);
    return { allowed: true };
}

module.exports = { getEntitlement, checkQuota, incrementUsage, checkRateLimit, QUOTAS };
