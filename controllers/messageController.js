const Message = require('../models/message');
const { User, Role } = require('../models');
const { Op } = require('sequelize');
const {
    PAID_PACKAGE_PRICE,
    PAID_PACKAGE_SECONDS,
    getQuotaStatusForUsers,
    purchaseOneHourPackage,
    createPayOSVideoPackagePayment,
    confirmPayOSVideoPackagePayment,
    createMomoVideoPackagePayment,
    confirmMomoVideoPackagePayment,
    handleMomoIpn
} = require('../services/videoCallQuota.service');

exports.getHistory = async (req, res) => {
    try {
        const userId = req.user.id; // From authMiddleware
        const { partnerId } = req.params;
        const partnerUserId = Number(partnerId);

        const messages = await Message.findAll({
            where: {
                [Op.or]: [
                    { sender_id: userId, receiver_id: partnerUserId },
                    { sender_id: partnerUserId, receiver_id: userId }
                ]
            },
            order: [['created_at', 'ASC']]
        });

        res.json({
            success: true,
            data: messages
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
};

exports.markConversationAsRead = async (req, res) => {
    try {
        const userId = req.user.id;
        const { partnerId } = req.params;
        const partnerUserId = Number(partnerId);

        if (!partnerUserId) {
            return res.status(400).json({ success: false, message: 'Invalid partner id' });
        }

        const [updatedCount] = await Message.update(
            { is_read: true },
            {
                where: {
                    sender_id: partnerUserId,
                    receiver_id: userId,
                    is_read: false
                }
            }
        );

        return res.json({
            success: true,
            data: { updatedCount }
        });
    } catch (error) {
        console.error('Mark conversation as read error:', error);
        return res.status(500).json({ success: false, message: 'Server error' });
    }
};


exports.getConversations = async (req, res) => {
    try {
        const userId = req.user.id; // Active user (Lawyer/Client)

        // Find all messages where user is sender OR receiver
        // We want to find distinct partners.

        // Approach: Get all messages involving user, order by time desc
        const messages = await Message.findAll({
            where: {
                [Op.or]: [
                    { sender_id: userId },
                    { receiver_id: userId }
                ]
            },
            order: [['created_at', 'DESC']],
            include: [
                { model: User, as: 'sender', attributes: ['id', 'full_name', 'email', 'avatar'] },
                { model: User, as: 'receiver', attributes: ['id', 'full_name', 'email', 'avatar'] }
            ]
        });

        // Process to get unique partners with last message
        const partnersMap = new Map();

        messages.forEach(msg => {
            const isSender = msg.sender_id === userId;
            const partner = isSender ? msg.receiver : msg.sender;

            if (!partner || !partner.id) return;

            if (!partnersMap.has(partner.id)) {
                partnersMap.set(partner.id, {
                    partnerId: partner.id,
                    partnerName: partner.full_name || 'Khách hàng',
                    partnerAvatar: partner.avatar,
                    lastMessage: msg.content,
                    lastMessageTime: msg.created_at,
                    unreadCount: (!isSender && !msg.is_read) ? 1 : 0
                });
            } else {
                // If we already have this partner, just increment unreadCount if message is from them and unread
                if (!isSender && !msg.is_read) {
                    const current = partnersMap.get(partner.id);
                    current.unreadCount += 1;
                    partnersMap.set(partner.id, current);
                }
            }
        });

        const conversations = Array.from(partnersMap.values());

        res.json({
            success: true,
            data: conversations
        });
    } catch (error) {
        console.error("Get conversations error:", error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
};

exports.getVideoCallQuota = async (req, res) => {
    try {
        const userId = req.user.id;
        const partnerId = Number(req.params.partnerId);
        if (!partnerId) {
            return res.status(400).json({ success: false, message: 'Invalid partner id' });
        }

        const quota = await getQuotaStatusForUsers(userId, partnerId);

        return res.json({
            success: true,
            data: {
                ...quota,
                package: {
                    seconds: PAID_PACKAGE_SECONDS,
                    price: quota.dynamicPrice
                },
                canPurchase: Number(userId) === Number(quota.clientId)
            }
        });
    } catch (error) {
        console.error('Get video call quota error:', error);
        return res.status(400).json({
            success: false,
            message: error.message || 'Cannot fetch video call quota'
        });
    }
};

exports.purchaseVideoCallPackage = async (req, res) => {
    try {
        const buyerId = req.user.id;
        const role = await Role.findByPk(req.user.roleId, { attributes: ['name'] });
        if (!role || role.name !== 'client') {
            return res.status(403).json({
                success: false,
                message: 'Only client role can purchase video call package'
            });
        }

        const partnerId = Number(req.params.partnerId);
        const slotId = req.body?.slotId || null;
        if (!partnerId) {
            return res.status(400).json({ success: false, message: 'Invalid partner id' });
        }

        const paymentMethod = String(req.body?.paymentMethod || 'payos').trim().toLowerCase();

        if (paymentMethod === 'payos') {
            const isMobile = req.body?.isMobile === true;
            const payos = await createPayOSVideoPackagePayment({ buyerId, partnerId, slotId, isMobile });
            return res.status(201).json({
                success: true,
                message: 'PayOS payment created',
                data: {
                    provider: 'payos',
                    payUrl: payos.checkoutUrl,
                    qrCode: payos.qrCode,
                    orderCode: payos.orderCode,
                    package: {
                        seconds: PAID_PACKAGE_SECONDS,
                        price: payos.amount || PAID_PACKAGE_PRICE
                    }
                }
            });
        }

        if (paymentMethod === 'momo') {
            const isMobile = req.body?.isMobile === true;
            const momo = await createMomoVideoPackagePayment({ buyerId, partnerId, slotId, isMobile });
            return res.status(201).json({
                success: true,
                message: 'MoMo payment created',
                data: {
                    provider: 'momo',
                    payUrl: momo.payUrl,
                    orderId: momo.orderId,
                    package: {
                        seconds: PAID_PACKAGE_SECONDS,
                        price: momo.amount || PAID_PACKAGE_PRICE
                    }
                }
            });
        }

        const result = await purchaseOneHourPackage({ buyerId, partnerId, paymentMethod });

        return res.status(201).json({
            success: true,
            message: 'Purchased video call package successfully',
            data: {
                ...result,
                package: {
                    seconds: PAID_PACKAGE_SECONDS,
                    price: result.amount || PAID_PACKAGE_PRICE
                }
            }
        });
    } catch (error) {
        console.error('Purchase video package error:', error);
        return res.status(400).json({
            success: false,
            message: error.message || 'Purchase failed'
        });
    }
};

exports.confirmPayOSVideoCallPayment = async (req, res) => {
    try {
        const buyerId = req.user?.id || null;
        if (req.user) {
            const role = await Role.findByPk(req.user.roleId, { attributes: ['name'] });
            if (!role || role.name !== 'client') {
                return res.status(403).json({
                    success: false,
                    message: 'Only client role can confirm video call package payment'
                });
            }
        }

        const { orderCode, status, code, cancel } = req.body || {};
        if (!orderCode) {
            return res.status(400).json({ success: false, message: 'orderCode is required' });
        }

        const result = await confirmPayOSVideoPackagePayment({
            buyerId,
            orderCode,
            status,
            code,
            cancel
        });

        return res.json({
            success: true,
            message: 'PayOS payment confirmed',
            data: result
        });
    } catch (error) {
        console.error('Confirm PayOS payment error:', error);
        return res.status(400).json({
            success: false,
            message: error.message || 'Confirm PayOS payment failed'
        });
    }
};

exports.confirmMomoVideoCallPayment = async (req, res) => {
    try {
        const buyerId = req.user?.id || null;
        if (req.user) {
            const role = await Role.findByPk(req.user.roleId, { attributes: ['name'] });
            if (!role || role.name !== 'client') {
                return res.status(403).json({
                    success: false,
                    message: 'Only client role can confirm video call package payment'
                });
            }
        }

        const { orderId, resultCode, transId } = req.body || {};
        if (!orderId) {
            return res.status(400).json({ success: false, message: 'orderId is required' });
        }

        const result = await confirmMomoVideoPackagePayment({
            buyerId,
            orderId,
            resultCode,
            transId
        });

        return res.json({
            success: true,
            message: 'MoMo payment confirmed',
            data: result
        });
    } catch (error) {
        console.error('Confirm MoMo payment error:', error);
        return res.status(400).json({
            success: false,
            message: error.message || 'Confirm MoMo payment failed'
        });
    }
};

exports.momoIpn = async (req, res) => {
    const { orderId, resultCode, transId } = req.body || {};
    const result = await handleMomoIpn({ orderId, resultCode, transId });
    return res.status(200).json({
        resultCode: result.success ? 0 : 1,
        message: result.success ? 'OK' : (result.message || 'FAILED')
    });
};
