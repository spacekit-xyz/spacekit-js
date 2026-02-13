/**
 * IDBKeyRange: static helpers only. Range is represented as lower/upper/open flags.
 */
export function bound(lower, upper, lowerOpen, upperOpen) {
    return {
        lower,
        upper,
        lowerOpen: lowerOpen ?? false,
        upperOpen: upperOpen ?? false,
    };
}
export function only(value) {
    return { lower: value, upper: value, lowerOpen: false, upperOpen: false };
}
export function lowerBound(lower, open) {
    return { lower, lowerOpen: open ?? false, upperOpen: false };
}
export function upperBound(upper, open) {
    return { upper, lowerOpen: false, upperOpen: open ?? false };
}
