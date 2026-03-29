const { Op } = require('sequelize');
const { sequelize, User, Role, VideoCallQuota, Payment, Consultation, LawyerAvailability } = require('../models');
const crypto = require('crypto');

const FREE_CALL_SECONDS = 5 * 60;
const PAID_PACKAGE_SECONDS = 60 * 60;
const PAID_PACKAGE_PRICE = 600000;

const ROLE_CLIENT = 'client';
const ROLE_LAWYER = 'lawyer';
const ALLOWED_PAYMENT_METHODS = new Set(['bank_transfer', 'credit_card', 'e_wallet', 'cash', 'momo', 'payos']);

const getUsersWithRoleName = async (userIds, transaction) => {
  const users = await User.findAll({
    where: { id: { [Op.in]: userIds } },
    attributes: ['id', 'role_id'],
    transaction
  });

  if (users.length !== 2) {
    throw new Error('Only client-lawyer calls are allowed');
  }

  const roleIds = [...new Set(users.map((u) => u.role_id))];
  const roles = await Role.findAll({
    where: { id: { [Op.in]: roleIds } },
    attributes: ['id', 'name'],
    transaction
  });
  const roleById = new Map(roles.map((r) => [r.id, r.name]));

  return users.map((u) => ({
    id: u.id,
    roleName: roleById.get(u.role_id)
  }));
};

const resolveClientLawyerPair = async (userAId, userBId, transaction) => {
  const users = await getUsersWithRoleName([userAId, userBId], transaction);
  const client = users.find((u) => u.roleName === ROLE_CLIENT);
  const lawyer = users.find((u) => u.roleName === ROLE_LAWYER);

  if (!client || !lawyer) {
    throw new Error('Video call is only available between one client and one lawyer');
  }

  return { clientId: client.id, lawyerId: lawyer.id };
};

const findOrCreateQuota = async (clientId, lawyerId, transaction, withLock = false) => {
  const findOptions = {
    where: { client_id: clientId, lawyer_id: lawyerId },
    transaction
  };

  if (withLock && transaction) {
    findOptions.lock = transaction.LOCK.UPDATE;
  }

  let quota = await VideoCallQuota.findOne(findOptions);
  if (!quota) {
    quota = await VideoCallQuota.create(
      {
        client_id: clientId,
        lawyer_id: lawyerId,
        free_seconds_used: 0,
        paid_seconds_remaining: 0
      },
      { transaction }
    );
  }

  return quota;
};

const computeQuotaStatus = (quota) => {
  const freeRemainingSeconds = Math.max(0, FREE_CALL_SECONDS - Number(quota.free_seconds_used || 0));
  const paidRemainingSeconds = Math.max(0, Number(quota.paid_seconds_remaining || 0));
  const totalRemainingSeconds = freeRemainingSeconds + paidRemainingSeconds;

  return {
    freeAllowedSeconds: FREE_CALL_SECONDS,
    freeRemainingSeconds,
    paidRemainingSeconds,
    totalRemainingSeconds
  };
};

const grantOneHourPackage = async ({ clientId, lawyerId, transaction }) => {
  const quota = await findOrCreateQuota(clientId, lawyerId, transaction, true);
  quota.paid_seconds_remaining = Number(quota.paid_seconds_remaining || 0) + PAID_PACKAGE_SECONDS;
  await quota.save({ transaction });
  return quota;
};

const getQuotaStatusForUsers = async (userId, partnerId) => {
  const { clientId, lawyerId } = await resolveClientLawyerPair(userId, partnerId);
  const quota = await findOrCreateQuota(clientId, lawyerId, null, false);
  return {
    clientId,
    lawyerId,
    ...computeQuotaStatus(quota)
  };
};

const consumeCallSecondsForUsers = async ({ userId, partnerId, elapsedSeconds }) => {
  const normalizedElapsed = Math.max(0, Math.floor(Number(elapsedSeconds) || 0));
  if (!normalizedElapsed) {
    return { consumedSeconds: 0, remaining: await getQuotaStatusForUsers(userId, partnerId) };
  }

  return sequelize.transaction(async (transaction) => {
    const { clientId, lawyerId } = await resolveClientLawyerPair(userId, partnerId, transaction);
    const quota = await findOrCreateQuota(clientId, lawyerId, transaction, true);
    const before = computeQuotaStatus(quota);

    let secondsToConsume = Math.min(before.totalRemainingSeconds, normalizedElapsed);

    const consumeFromFree = Math.min(before.freeRemainingSeconds, secondsToConsume);
    quota.free_seconds_used = Number(quota.free_seconds_used || 0) + consumeFromFree;
    secondsToConsume -= consumeFromFree;

    const consumeFromPaid = Math.min(before.paidRemainingSeconds, secondsToConsume);
    quota.paid_seconds_remaining = Math.max(0, Number(quota.paid_seconds_remaining || 0) - consumeFromPaid);

    await quota.save({ transaction });

    return {
      consumedSeconds: consumeFromFree + consumeFromPaid,
      remaining: {
        clientId,
        lawyerId,
        ...computeQuotaStatus(quota)
      }
    };
  });
};

const normalizePaymentMethod = (method) => {
  const value = String(method || '').trim().toLowerCase();
  if (!ALLOWED_PAYMENT_METHODS.has(value)) return 'e_wallet';
  if (value === 'momo' || value === 'payos') return 'e_wallet';
  return value;
};

const purchaseOneHourPackage = async ({ buyerId, partnerId, paymentMethod = 'e_wallet' }) => {
  return sequelize.transaction(async (transaction) => {
    const { clientId, lawyerId } = await resolveClientLawyerPair(buyerId, partnerId, transaction);
    if (clientId !== buyerId) {
      throw new Error('Only client can purchase video call package');
    }

    const quota = await grantOneHourPackage({ clientId, lawyerId, transaction });

    await Payment.create(
      {
        user_id: clientId,
        case_id: null,
        consultation_id: null,
        amount: PAID_PACKAGE_PRICE,
        payment_type: 'consultation',
        payment_method: normalizePaymentMethod(paymentMethod),
        status: 'completed',
        transaction_id: `VCALL-${Date.now()}-${clientId}-${Math.floor(Math.random() * 1000000)}`,
        payment_date: new Date(),
        notes: `Video call package 60m for lawyer ${lawyerId}`
      },
      { transaction }
    );

    return {
      clientId,
      lawyerId,
      ...computeQuotaStatus(quota)
    };
  });
};

const buildMomoSignature = ({ accessKey, secretKey, payload }) => {
  const crypto = require('crypto');
  const rawSignature =
    `accessKey=${accessKey}` +
    `&amount=${payload.amount}` +
    `&extraData=${payload.extraData}` +
    `&ipnUrl=${payload.ipnUrl}` +
    `&orderId=${payload.orderId}` +
    `&orderInfo=${payload.orderInfo}` +
    `&partnerCode=${payload.partnerCode}` +
    `&redirectUrl=${payload.redirectUrl}` +
    `&requestId=${payload.requestId}` +
    `&requestType=${payload.requestType}`;

  return crypto.createHmac('sha256', secretKey).update(rawSignature).digest('hex');
};

const validateSelectedSlot = async ({ slotId, lawyerId, transaction }) => {
  if (!slotId) return null;

  const slot = await LawyerAvailability.findOne({
    where: { id: slotId, lawyer_id: lawyerId },
    transaction,
    lock: transaction?.LOCK?.UPDATE
  });

  if (!slot) {
    throw new Error('Không tìm thấy khung giờ đã chọn');
  }

  if (slot.status !== 'available') {
    throw new Error('Khung giờ đã chọn không còn trống');
  }

  if (new Date(slot.start_time) <= new Date()) {
    throw new Error('Khung giờ đã chọn đã qua');
  }

  return slot;
};

const createMomoVideoPackagePayment = async ({ buyerId, partnerId, slotId = null, isMobile = false }) => {
  const partnerCode = process.env.MOMO_PARTNER_CODE;
  const accessKey = process.env.MOMO_ACCESS_KEY;
  const secretKey = process.env.MOMO_SECRET_KEY;
  const endpoint = process.env.MOMO_ENDPOINT || 'https://test-payment.momo.vn/v2/gateway/api/create';
  const frontendBase = process.env.FRONTEND_URL || 'http://localhost:3000';
  const backendBase = process.env.BACKEND_URL || 'http://localhost:3001';

  if (!partnerCode || !accessKey || !secretKey) {
    throw new Error('MoMo is not configured. Missing MOMO_PARTNER_CODE/MOMO_ACCESS_KEY/MOMO_SECRET_KEY');
  }

  const redirectUrl = isMobile
    ? (process.env.MOBILE_RETURN_URL || 'lawyerplatform://payment-success')
    : `${frontendBase}/payment/momo-return`;

  return sequelize.transaction(async (transaction) => {
    const { clientId, lawyerId } = await resolveClientLawyerPair(buyerId, partnerId, transaction);
    if (clientId !== buyerId) {
      throw new Error('Only client can purchase video call package');
    }

    if (!slotId) {
      throw new Error('Vui lòng chọn khung giờ tư vấn để tiếp tục đặt lịch');
    }
    const selectedSlot = await validateSelectedSlot({ slotId, lawyerId, transaction });

    const orderId = `VCALL-${Date.now()}-${clientId}-${lawyerId}`;
    const requestId = `${orderId}-REQ`;
    const extraData = Buffer.from(
      JSON.stringify({
        feature: 'video_call_package',
        clientId,
        lawyerId,
        partnerId
      })
    ).toString('base64');

    const payload = {
      partnerCode,
      partnerName: 'Lawyer Platform',
      storeId: 'LawyerPlatform',
      requestId,
      amount: String(PAID_PACKAGE_PRICE),
      orderId,
      orderInfo: `Nap 1 gio goi video cho luat su ${lawyerId}`,
      redirectUrl,
      ipnUrl: `${backendBase}/api/messages/video-call/momo/ipn`,
      lang: 'vi',
      requestType: 'captureWallet',
      autoCapture: true,
      extraData
    };

    const signature = buildMomoSignature({ accessKey, secretKey, payload });

    await Payment.create(
      {
        user_id: clientId,
        case_id: null,
        consultation_id: null,
        amount: PAID_PACKAGE_PRICE,
        payment_type: 'consultation',
        // Keep DB-compatible enum value even if schema has not been migrated yet.
        payment_method: 'e_wallet',
        status: 'pending',
        transaction_id: orderId,
        payment_date: null,
        notes: JSON.stringify({
          feature: 'video_call_package',
          paymentProvider: 'momo',
          clientId,
          lawyerId,
          partnerId,
          slotId: selectedSlot?.id || null
        })
      },
      { transaction }
    );

    const momoRes = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...payload, signature })
    });

    const momoData = await momoRes.json();

    if (!momoRes.ok || Number(momoData?.resultCode) !== 0 || !momoData?.payUrl) {
      await Payment.update(
        { status: 'failed' },
        { where: { transaction_id: orderId }, transaction }
      );
      throw new Error(momoData?.message || 'Cannot create MoMo payment');
    }

    return {
      payUrl: momoData.payUrl,
      orderId,
      requestId
    };
  });
};

const confirmMomoVideoPackagePayment = async ({ buyerId, orderId, resultCode, transId }) => {
  return sequelize.transaction(async (transaction) => {
    const payment = await Payment.findOne({
      where: {
        transaction_id: orderId
      },
      transaction,
      lock: transaction.LOCK.UPDATE
    });

    if (!payment) {
      throw new Error('Payment not found');
    }

    const effectiveBuyerId = buyerId || payment.user_id;
    if (payment.user_id !== effectiveBuyerId) {
      throw new Error('Buyer ID mismatch');
    }

    const quota = await grantOneHourPackage({
      clientId: payment.user_id,
      lawyerId: JSON.parse(payment.notes || '{}').lawyerId,
      transaction
    });

    if (payment.status === 'completed') {
      const notes = JSON.parse(payment.notes || '{}');
      return {
        orderId,
        status: 'completed',
        transId: payment.transaction_id,
        consultationId: payment.consultation_id || null,
        ...computeQuotaStatus(quota)
      };
    }

    if (String(resultCode) !== '0') {
      payment.status = 'failed';
      payment.notes = JSON.stringify({
        ...(JSON.parse(payment.notes || '{}')),
        momoResultCode: String(resultCode)
      });
      await payment.save({ transaction });
      throw new Error('MoMo payment failed or cancelled');
    }

    const notes = JSON.parse(payment.notes || '{}');

    payment.status = 'completed';
    payment.payment_date = new Date();
    payment.notes = JSON.stringify({
      ...notes,
      momoResultCode: '0',
      momoTransId: transId || null
    });
    await payment.save({ transaction });

    let createdConsultation = null;
    const n = JSON.parse(payment.notes || '{}');
    if (n.slotId) {
      const slot = await LawyerAvailability.findOne({
        where: { id: n.slotId, lawyer_id: n.lawyerId },
        transaction,
        lock: transaction.LOCK.UPDATE
      });

      if (slot && slot.status === 'available') {
        const start = new Date(slot.start_time);
        const end = new Date(slot.end_time);
        const duration = Math.max(15, Math.round((end.getTime() - start.getTime()) / 60000));

        createdConsultation = await Consultation.create(
          {
            client_id: n.clientId,
            lawyer_id: n.lawyerId,
            case_id: null,
            scheduled_at: start,
            duration,
            consultation_type: slot.consultation_type || 'video',
            status: 'confirmed',
            fee: PAID_PACKAGE_PRICE,
            notes: 'Tạo tự động từ thanh toán MoMo gói video 60 phút'
          },
          { transaction }
        );

        await slot.update(
          {
            status: 'booked',
            booked_by_client_id: n.clientId,
            booked_consultation_id: createdConsultation.id
          },
          { transaction }
        );

        payment.consultation_id = createdConsultation.id;
        await payment.save({ transaction });
      }
    } else {
      // Create a pending consultation even without a specific slot if user bought the package?
      // Or maybe just let it be. But the user asked for it to be saved.
      // Let's create one for "now" or "soon" if no slot? 
      // Actually, picking a slot IS safer.
    }

    return {
      orderId,
      status: 'completed',
      transId: transId || null,
      consultationId: createdConsultation?.id || payment.consultation_id || null,
      ...computeQuotaStatus(quota)
    };
  });
};

const buildPayOSSignature = (payload, checksumKey) => {
  const data = Object.keys(payload)
    .sort()
    .map((key) => `${key}=${payload[key]}`)
    .join('&');
  return crypto.createHmac('sha256', checksumKey).update(data).digest('hex');
};

const createPayOSVideoPackagePayment = async ({ buyerId, partnerId, slotId = null, isMobile = false }) => {
  const clientId = process.env.PAYOS_CLIENT_ID;
  const apiKey = process.env.PAYOS_API_KEY;
  const checksumKey = process.env.PAYOS_CHECKSUM_KEY;
  const endpoint = (process.env.PAYOS_ENDPOINT || 'https://api-merchant.payos.vn').replace(/\/+$/, '');
  const frontendBase = process.env.FRONTEND_URL || 'http://localhost:3000';

  const successUrl = isMobile
    ? (process.env.MOBILE_RETURN_URL || 'lawyerplatform://payment-success')
    : `${frontendBase}/payment/payos-return`;

  const failUrl = isMobile
    ? (process.env.MOBILE_CANCEL_URL || 'lawyerplatform://payment-cancel')
    : `${frontendBase}/payment/payos-return?cancel=true`;

  if (!clientId || !apiKey || !checksumKey) {
    throw new Error('PayOS is not configured. Missing PAYOS_CLIENT_ID/PAYOS_API_KEY/PAYOS_CHECKSUM_KEY');
  }

  return sequelize.transaction(async (transaction) => {
    const pair = await resolveClientLawyerPair(buyerId, partnerId, transaction);
    if (pair.clientId !== buyerId) {
      throw new Error('Only client can purchase video call package');
    }

    if (!slotId) {
      throw new Error('Vui lòng chọn khung giờ tư vấn để tiếp tục đặt lịch');
    }
    const selectedSlot = await validateSelectedSlot({ slotId, lawyerId: pair.lawyerId, transaction });

    const orderCode = Number(`${Date.now()}${Math.floor(Math.random() * 100).toString().padStart(2, '0')}`);
    const orderCodeStr = String(orderCode);
    const description = `Goi 1h LS ${pair.lawyerId}`.slice(0, 25);
    const returnUrl = successUrl;
    const cancelUrl = failUrl;

    const signature = buildPayOSSignature(
      {
        amount: PAID_PACKAGE_PRICE,
        cancelUrl,
        description,
        orderCode,
        returnUrl
      },
      checksumKey
    );

    await Payment.create(
      {
        user_id: pair.clientId,
        case_id: null,
        consultation_id: null,
        amount: PAID_PACKAGE_PRICE,
        payment_type: 'consultation',
        payment_method: 'e_wallet',
        status: 'pending',
        transaction_id: orderCodeStr,
        payment_date: null,
        notes: JSON.stringify({
          feature: 'video_call_package',
          paymentProvider: 'payos',
          clientId: pair.clientId,
          lawyerId: pair.lawyerId,
          partnerId,
          slotId: selectedSlot?.id || null
        })
      },
      { transaction }
    );

    const payload = {
      orderCode,
      amount: PAID_PACKAGE_PRICE,
      description,
      returnUrl,
      cancelUrl,
      items: [
        {
          name: 'Goi video 1 gio',
          quantity: 1,
          price: PAID_PACKAGE_PRICE
        }
      ],
      expiredAt: Math.floor(Date.now() / 1000) + 15 * 60,
      signature
    };

    const payosRes = await fetch(`${endpoint}/v2/payment-requests`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-client-id': clientId,
        'x-api-key': apiKey
      },
      body: JSON.stringify(payload)
    });
    const payosData = await payosRes.json();

    if (!payosRes.ok || payosData?.code !== '00' || !payosData?.data?.checkoutUrl) {
      await Payment.update(
        { status: 'failed' },
        { where: { transaction_id: orderCodeStr }, transaction }
      );
      throw new Error(payosData?.desc || payosData?.message || 'Cannot create PayOS payment');
    }

    return {
      checkoutUrl: payosData.data.checkoutUrl,
      qrCode: payosData.data.qrCode || null,
      orderCode: orderCodeStr
    };
  });
};

const confirmPayOSVideoPackagePayment = async ({
  buyerId,
  orderCode,
  status,
  code,
  cancel
}) => {
  const clientId = process.env.PAYOS_CLIENT_ID;
  const apiKey = process.env.PAYOS_API_KEY;
  const endpoint = (process.env.PAYOS_ENDPOINT || 'https://api-merchant.payos.vn').replace(/\/+$/, '');

  if (!clientId || !apiKey) {
    throw new Error('PayOS is not configured. Missing PAYOS_CLIENT_ID/PAYOS_API_KEY');
  }

  return sequelize.transaction(async (transaction) => {
    const payment = await Payment.findOne({
      where: {
        transaction_id: String(orderCode)
      },
      transaction,
      lock: transaction.LOCK.UPDATE
    });

    if (!payment) {
      throw new Error('Payment not found');
    }

    // Use payment.user_id if buyerId is not provided (Public verification)
    const effectiveBuyerId = buyerId || payment.user_id;

    if (payment.user_id !== effectiveBuyerId) {
      throw new Error('Buyer ID mismatch');
    }

    const notes = JSON.parse(payment.notes || '{}');
    if (payment.status === 'completed') {
      const quota = await findOrCreateQuota(notes.clientId, notes.lawyerId, transaction, false);
      return {
        orderCode: String(orderCode),
        status: 'completed',
        consultationId: payment.consultation_id || null,
        ...computeQuotaStatus(quota)
      };
    }

    const payosRes = await fetch(`${endpoint}/v2/payment-requests/${orderCode}`, {
      method: 'GET',
      headers: {
        'x-client-id': clientId,
        'x-api-key': apiKey
      }
    });
    const payosData = await payosRes.json();

    const payosStatus = String(payosData?.data?.status || '').toUpperCase();
    const isPaid = payosRes.ok && payosData?.code === '00' && payosStatus === 'PAID';

    if (!isPaid) {
      const isCancelled =
        String(cancel) === 'true' ||
        String(status || '').toUpperCase() === 'CANCELLED' ||
        String(code || '') !== '00';

      if (isCancelled) {
        payment.status = 'failed';
        payment.notes = JSON.stringify({
          ...notes,
          payosStatus,
          payosCode: code || payosData?.code || null
        });
        await payment.save({ transaction });
      }

      throw new Error('Giao dich VietQR chua thanh cong');
    }

    const quota = await grantOneHourPackage({
      clientId: notes.clientId,
      lawyerId: notes.lawyerId,
      transaction
    });

    let createdConsultation = null;
    if (notes.slotId) {
      const slot = await LawyerAvailability.findOne({
        where: { id: notes.slotId, lawyer_id: notes.lawyerId },
        transaction,
        lock: transaction.LOCK.UPDATE
      });

      if (slot && slot.status === 'available') {
        const start = new Date(slot.start_time);
        const end = new Date(slot.end_time);
        const duration = Math.max(15, Math.round((end.getTime() - start.getTime()) / 60000));

        createdConsultation = await Consultation.create(
          {
            client_id: notes.clientId,
            lawyer_id: notes.lawyerId,
            case_id: null,
            scheduled_at: start,
            duration,
            consultation_type: slot.consultation_type || 'video',
            status: 'confirmed',
            fee: PAID_PACKAGE_PRICE,
            notes: 'Tạo tự động từ thanh toán gói video 60 phút'
          },
          { transaction }
        );

        await slot.update(
          {
            status: 'booked',
            booked_by_client_id: notes.clientId,
            booked_consultation_id: createdConsultation.id
          },
          { transaction }
        );

        payment.consultation_id = createdConsultation.id;
      }
    }

    payment.status = 'completed';
    payment.payment_date = new Date();
    payment.notes = JSON.stringify({
      ...notes,
      payosStatus,
      payosCode: payosData?.code || null
    });
    await payment.save({ transaction });

    return {
      orderCode: String(orderCode),
      status: 'completed',
      consultationId: createdConsultation?.id || payment.consultation_id || null,
      ...computeQuotaStatus(quota)
    };
  });
};

const handleMomoIpn = async ({ orderId, resultCode, transId }) => {
  try {
    const payment = await Payment.findOne({
      where: {
        transaction_id: orderId
      }
    });

    if (!payment) {
      return { success: false, message: 'Payment not found' };
    }

    if (payment.status === 'completed') {
      return { success: true };
    }

    if (String(resultCode) !== '0') {
      await payment.update({ status: 'failed' });
      return { success: false, message: 'Payment failed' };
    }

    await confirmMomoVideoPackagePayment({
      buyerId: payment.user_id,
      orderId,
      resultCode,
      transId
    });

    return { success: true };
  } catch (error) {
    console.error('MoMo IPN handling error:', error);
    return { success: false, message: error.message || 'IPN error' };
  }
};

/**
 * Tự động hết hạn các lịch tư vấn đã quá 30 phút mà không có cuộc gọi.
 * Đồng thời xử lý việc trừ hạn mức (penalty) cho khách hàng không đến.
 */
const autoExpireConsultations = async () => {
  const { Consultation, LawyerAvailability, VideoCallQuota } = require('../models');
  const { Op } = require('sequelize');

  try {
    // 1. Tìm các lịch hẹn 'confirmed' đã quá 30 phút so với scheduled_at
    const thirtyMinsAgo = new Date(Date.now() - 30 * 60 * 1000);
    const overdueConsultations = await Consultation.findAll({
      where: {
        status: 'confirmed',
        scheduled_at: { [Op.lt]: thirtyMinsAgo }
      }
    });

    if (overdueConsultations.length === 0) return;

    for (const cons of overdueConsultations) {
      await sequelize.transaction(async (t) => {
        // Cập nhật trạng thái lịch hẹn thành 'no_show'
        await cons.update({ status: 'no_show' }, { transaction: t });

        // Cập nhật slot tương ứng của luật sư thành 'missed'
        await LawyerAvailability.update(
          { status: 'missed' },
          {
            where: { booked_consultation_id: cons.id },
            transaction: t
          }
        );

        // Phạt trừ hạn mức của khách hàng (60 phút = 3600s)
        const penaltySeconds = 3600;
        const quota = await VideoCallQuota.findOne({
          where: { client_id: cons.client_id, lawyer_id: cons.lawyer_id },
          transaction: t,
          lock: t.LOCK.UPDATE
        });

        if (quota) {
          quota.paid_seconds_remaining = Math.max(0, Number(quota.paid_seconds_remaining || 0) - penaltySeconds);
          await quota.save({ transaction: t });
        }
      });
      console.log(`[Cleaner] Marked consultation ${cons.id} as no_show and penalized client ${cons.client_id}`);
    }
  } catch (error) {
    console.error('[Cleaner] Error in autoExpireConsultations:', error);
  }
};

/**
 * Đánh dấu lịch tư vấn là hoàn thành sau khi cuộc gọi video kết thúc thành công (trên 60s).
 */
const markConsultationCompleted = async (callerId, calleeId) => {
  const { Consultation } = require('../models');
  const { Op } = require('sequelize');

  try {
    // Tìm lịch tư vấn 'confirmed' đang gần thời điểm hiện tại nhất của cặp đôi này
    const now = new Date();
    const twoHoursAgo = new Date(now.getTime() - 2 * 60 * 60 * 1000);
    const twoHoursFuture = new Date(now.getTime() + 2 * 60 * 60 * 1000);

    const activeCons = await Consultation.findOne({
      where: {
        [Op.or]: [
          { client_id: callerId, lawyer_id: calleeId },
          { client_id: calleeId, lawyer_id: callerId }
        ],
        status: 'confirmed',
        scheduled_at: { [Op.between]: [twoHoursAgo, twoHoursFuture] }
      },
      order: [['scheduled_at', 'ASC']]
    });

    if (activeCons) {
      await activeCons.update({ status: 'completed' });
      console.log(`[AutoFinish] Marked consultation ${activeCons.id} as completed.`);
    }
  } catch (error) {
    console.error('[AutoFinish] Error marking consultation completed:', error);
  }
};

/**
 * Tìm và thông báo các lịch hẹn video sắp diễn ra trong khoảng 30 phút tới.
 */
const notifyUpcomingConsultations = async (io) => {
  const { Consultation } = require('../models');
  const { Op } = require('sequelize');
  const notificationService = require('./notification.service');

  const now = new Date();
  // Quét dải từ 20-40 phút để đảm bảo không sót nếu setInterval chạy trễ
  const startTime = new Date(now.getTime() + 20 * 60 * 1000);
  const endTime = new Date(now.getTime() + 40 * 60 * 1000);

  try {
    const upcoming = await Consultation.findAll({
      where: {
        status: 'confirmed',
        scheduled_at: { [Op.between]: [startTime, endTime] },
        reminder_sent: false,
        consultation_type: 'video'
      }
    });

    if (upcoming.length === 0) return;

    for (const cons of upcoming) {
      const timeStr = new Date(cons.scheduled_at).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
      const payload = {
        message: `Lịch hẹn tư vấn video sẽ bắt đầu lúc ${timeStr}`,
        consultationId: cons.id,
        scheduledAt: cons.scheduled_at
      };

      // 1. Socket.io (Realtime Web/App)
      if (io) {
        io.to(String(cons.client_id)).emit('upcoming_consultation', payload);
        io.to(String(cons.lawyer_id)).emit('upcoming_consultation', payload);
      }

      // 2. Push Notification (FCM)
      await notificationService.sendToUser(
        cons.client_id,
        'Nhắc nhở lịch hẹn',
        `Bạn có lịch hẹn tư vấn video lúc ${timeStr}. Vui lòng chuẩn bị.`
      );
      await notificationService.sendToUser(
        cons.lawyer_id,
        'Nhắc nhở lịch hẹn',
        `Bạn có lịch hẹn tư vấn video với khách hàng lúc ${timeStr}.`
      );

      // 3. Đánh dấu đã gửi
      await cons.update({ reminder_sent: true });
      console.log(`[Reminder] Sent reminder for consultation ${cons.id} at ${timeStr}`);
    }
  } catch (error) {
    console.error('[Reminder] Error in notifyUpcomingConsultations:', error);
  }
};

module.exports = {
  FREE_CALL_SECONDS,
  PAID_PACKAGE_SECONDS,
  PAID_PACKAGE_PRICE,
  resolveClientLawyerPair,
  getQuotaStatusForUsers,
  consumeCallSecondsForUsers,
  purchaseOneHourPackage,
  createPayOSVideoPackagePayment,
  confirmPayOSVideoPackagePayment,
  createMomoVideoPackagePayment,
  confirmMomoVideoPackagePayment,
  handleMomoIpn,
  autoExpireConsultations,
  markConsultationCompleted,
  notifyUpcomingConsultations
};
