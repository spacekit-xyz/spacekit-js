/**
 * IDBKeyRange: static helpers only. Range is represented as lower/upper/open flags.
 */
export declare function bound(lower: IDBValidKey, upper: IDBValidKey, lowerOpen?: boolean, upperOpen?: boolean): {
    lower: IDBValidKey;
    upper: IDBValidKey;
    lowerOpen: boolean;
    upperOpen: boolean;
};
export declare function only(value: IDBValidKey): {
    lower: IDBValidKey;
    upper: IDBValidKey;
    lowerOpen: boolean;
    upperOpen: boolean;
};
export declare function lowerBound(lower: IDBValidKey, open?: boolean): {
    lower: IDBValidKey;
    upper?: undefined;
    lowerOpen: boolean;
    upperOpen: boolean;
};
export declare function upperBound(upper: IDBValidKey, open?: boolean): {
    lower?: undefined;
    upper: IDBValidKey;
    lowerOpen: boolean;
    upperOpen: boolean;
};
