const crypto = require('crypto');

const buildPayOSSignature = (payload, checksumKey) => {
    const data = Object.keys(payload)
        .sort()
        .map((key) => `${key}=${payload[key]}`)
        .join('&');
    return crypto.createHmac('sha256', checksumKey).update(data).digest('hex');
};

const createPayOSLink = async ({ amount, description, orderCode, returnUrl, cancelUrl }) => {
    const clientId = process.env.PAYOS_CLIENT_ID;
    const apiKey = process.env.PAYOS_API_KEY;
    const checksumKey = process.env.PAYOS_CHECKSUM_KEY;
    const endpoint = (process.env.PAYOS_ENDPOINT || 'https://api-merchant.payos.vn').replace(/\/+$/, '');

    if (!clientId || !apiKey || !checksumKey) {
        throw new Error('PayOS is not configured. Missing PAYOS_CLIENT_ID/PAYOS_API_KEY/PAYOS_CHECKSUM_KEY');
    }

    const payload = {
        orderCode,
        amount,
        description: description.slice(0, 25),
        returnUrl,
        cancelUrl
    };

    const signature = buildPayOSSignature(payload, checksumKey);

    const body = {
        ...payload,
        items: [
            {
                name: description,
                quantity: 1,
                price: amount
            }
        ],
        expiredAt: Math.floor(Date.now() / 1000) + 15 * 60,
        signature
    };

    const response = await fetch(`${endpoint}/v2/payment-requests`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'x-client-id': clientId,
            'x-api-key': apiKey
        },
        body: JSON.stringify(body)
    });

    const data = await response.json();

    if (!response.ok || data?.code !== '00' || !data?.data?.checkoutUrl) {
        throw new Error(data?.desc || data?.message || 'Cannot create PayOS payment');
    }

    return {
        checkoutUrl: data.data.checkoutUrl,
        qrCode: data.data.qrCode || null
    };
};

const getPayOSPaymentStatus = async (orderCode) => {
    const clientId = process.env.PAYOS_CLIENT_ID;
    const apiKey = process.env.PAYOS_API_KEY;
    const endpoint = (process.env.PAYOS_ENDPOINT || 'https://api-merchant.payos.vn').replace(/\/+$/, '');

    const response = await fetch(`${endpoint}/v2/payment-requests/${orderCode}`, {
        method: 'GET',
        headers: {
            'x-client-id': clientId,
            'x-api-key': apiKey
        }
    });

    const data = await response.json();
    if (!response.ok) {
        throw new Error(data?.desc || data?.message || 'Cannot fetch PayOS payment status');
    }

    return data.data;
};

module.exports = {
    createPayOSLink,
    getPayOSPaymentStatus,
    buildPayOSSignature
};
