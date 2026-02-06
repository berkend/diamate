/**
 * DiaMate Safety Policy - Single source of truth for all safety-critical values
 */
export const SafetyPolicy = {
    // Glucose thresholds (mg/dL)
    hypoThreshold: 70,
    hyperThreshold: 180,
    
    // Insulin calculation
    roundingIncrement: 0.5,
    minBolus: 0,
    maxBolusDefault: 15,
    defaultActiveInsulinHours: 4,
    
    // Trend adjustments
    trendDownCorrectionMultiplier: 0, // Conservative: remove correction if trending down
    
    // Safety gates
    blockWhenBelowHypo: true,
    requireAcknowledgementAboveMax: true,
    requireTwoStepConfirmForRecording: true,
    
    // Default target range
    defaultTargetLow: 70,
    defaultTargetHigh: 140
};

/**
 * Check if glucose value indicates hypoglycemia
 */
export function isHypo(value) {
    return value < SafetyPolicy.hypoThreshold;
}

/**
 * Check if glucose value indicates hyperglycemia
 */
export function isHyper(value) {
    return value > SafetyPolicy.hyperThreshold;
}

/**
 * Get glucose status
 */
export function getGlucoseStatus(value) {
    if (isHypo(value)) return 'low';
    if (isHyper(value)) return 'high';
    return 'normal';
}

/**
 * Get status color
 */
export function getStatusColor(status) {
    const colors = {
        low: '#F44336',
        high: '#FF9800',
        normal: '#4CAF50'
    };
    return colors[status] || colors.normal;
}
