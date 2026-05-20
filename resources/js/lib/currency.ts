import { useEffect, useMemo, useState } from 'react';

export type CurrencyCode = 'USD' | 'CDF';

const STORAGE_KEY = 'app.currency';
const RATE_STORAGE_KEY = 'app.currency_rate';
const DEFAULT_CDF_PER_USD = 2850;

export function getStoredCurrency(): CurrencyCode {
    if (typeof window === 'undefined') {
        return 'USD';
    }

    const value = window.localStorage.getItem(STORAGE_KEY);

    return value === 'CDF' ? 'CDF' : 'USD';
}

export function setStoredCurrency(currency: CurrencyCode): void {
    if (typeof window === 'undefined') {
        return;
    }

    window.localStorage.setItem(STORAGE_KEY, currency);
    window.dispatchEvent(new CustomEvent('app:currency-changed', { detail: currency }));
}

export function getStoredRate(): number {
    if (typeof window === 'undefined') {
        return DEFAULT_CDF_PER_USD;
    }

    const value = window.localStorage.getItem(RATE_STORAGE_KEY);

    return value ? parseFloat(value) : DEFAULT_CDF_PER_USD;
}

export function setStoredRate(rate: number): void {
    if (typeof window === 'undefined') {
        return;
    }

    window.localStorage.setItem(RATE_STORAGE_KEY, rate.toString());
    window.dispatchEvent(new CustomEvent('app:rate-changed', { detail: rate }));
}

export function convertFromUsd(amount: number, currency: CurrencyCode, rate: number): number {
    if (currency === 'CDF') {
        return amount * rate;
    }

    return amount;
}

export function formatMoney(amountInUsd: number, currency: CurrencyCode, rate: number): string {
    const convertedValue = convertFromUsd(amountInUsd, currency, rate);

    return new Intl.NumberFormat('fr-FR', {
        style: 'currency',
        currency,
        maximumFractionDigits: currency === 'CDF' ? 0 : 2,
    }).format(convertedValue);
}

export function useCurrency() {
    const [currency, setCurrencyState] = useState<CurrencyCode>(() => getStoredCurrency());
    const [rate, setRateState] = useState<number>(() => getStoredRate());

    useEffect(() => {
        const handleStorage = (event: StorageEvent) => {
            if (event.key === STORAGE_KEY) {
                setCurrencyState(getStoredCurrency());
            } else if (event.key === RATE_STORAGE_KEY) {
                setRateState(getStoredRate());
            }
        };

        const handleCustomCurrency = () => setCurrencyState(getStoredCurrency());
        const handleCustomRate = () => setRateState(getStoredRate());

        window.addEventListener('storage', handleStorage);
        window.addEventListener('app:currency-changed', handleCustomCurrency);
        window.addEventListener('app:rate-changed', handleCustomRate);

        return () => {
            window.removeEventListener('storage', handleStorage);
            window.removeEventListener('app:currency-changed', handleCustomCurrency);
            window.removeEventListener('app:rate-changed', handleCustomRate);
        };
    }, []);

    const setCurrency = (nextCurrency: CurrencyCode) => {
        setStoredCurrency(nextCurrency);
        setCurrencyState(nextCurrency);
    };

    const setRate = (nextRate: number) => {
        setStoredRate(nextRate);
        setRateState(nextRate);
    };

    const formatCurrency = useMemo(() => {
        return (amountInUsd: number) => formatMoney(amountInUsd, currency, rate);
    }, [currency, rate]);

    return {
        currency,
        setCurrency,
        rate,
        setRate,
        formatCurrency,
        cdfPerUsd: rate,
    };
}
