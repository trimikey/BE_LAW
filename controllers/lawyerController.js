const { Case, Consultation, User, Payment, LawyerAvailability, Lawyer, Document, sequelize } = require('../models');
const { Op } = require('sequelize');
const lawyerService = require("../services/lawyer.service");
const { initializeCaseSteps } = require('./caseController');

const parsePaymentNotes = (notes) => {
    if (!notes) return {};
    if (typeof notes === 'object') return notes;
    try {
        return JSON.parse(notes);
    } catch {
        return {};
    }
};

const getLawyerOrderRows = async (lawyerId, { status, limit, offset = 0 } = {}) => {
    const caseRecords = await Case.findAll({
        where: { lawyer_id: lawyerId },
        attributes: ['id', 'client_id', 'title', 'case_type'],
        include: [{ model: User, as: 'client', attributes: ['id', 'full_name', 'email', 'phone', 'avatar'] }]
    });

    const consultationRecords = await Consultation.findAll({
        where: { lawyer_id: lawyerId },
        attributes: ['id', 'client_id', 'consultation_type', 'scheduled_at', 'duration', 'case_id'],
        include: [{ model: User, as: 'client', attributes: ['id', 'full_name', 'email', 'phone', 'avatar'] }]
    });

    const caseIds = caseRecords.map((item) => Number(item.id));
    const consultationIds = consultationRecords.map((item) => Number(item.id));

    const paymentWhere = {
        [Op.or]: [
            { case_id: { [Op.in]: caseIds.length ? caseIds : [0] } },
            { consultation_id: { [Op.in]: consultationIds.length ? consultationIds : [0] } },
            { notes: { [Op.like]: `%\"lawyerId\":${lawyerId}%` } }
        ]
    };

    if (status) {
        paymentWhere.status = status;
    }

    const { count, rows: payments } = await Payment.findAndCountAll({
        where: paymentWhere,
        include: [
            {
                model: Case,
                as: 'case',
                attributes: ['id', 'title', 'case_type'],
                include: [{ model: User, as: 'client', attributes: ['id', 'full_name', 'email', 'phone', 'avatar'] }]
            },
            {
                model: Consultation,
                as: 'consultation',
                attributes: ['id', 'consultation_type', 'scheduled_at', 'duration', 'case_id'],
                include: [{ model: User, as: 'client', attributes: ['id', 'full_name', 'email', 'phone', 'avatar'] }]
            },
            { model: User, as: 'user', attributes: ['id', 'full_name', 'email', 'phone', 'avatar'] }
        ],
        order: [['created_at', 'DESC']],
        limit: limit ? Number(limit) : undefined,
        offset: Number(offset)
    });

    const caseToClient = new Map(caseRecords.map((item) => [Number(item.id), Number(item.client_id)]));
    const consultationToClient = new Map(consultationRecords.map((item) => [Number(item.id), Number(item.client_id)]));
    const clientMeta = new Map();

    [...caseRecords, ...consultationRecords].forEach((item) => {
        if (item.client) {
            clientMeta.set(Number(item.client.id), {
                id: Number(item.client.id),
                full_name: item.client.full_name || 'Khách hàng',
                email: item.client.email || '',
                phone: item.client.phone || '',
                avatar: item.client.avatar || ''
            });
        }
    });

    const rows = payments.map((payment) => {
        const notes = parsePaymentNotes(payment.notes);
        const caseId = payment.case_id ? Number(payment.case_id) : null;
        const consultationId = payment.consultation_id ? Number(payment.consultation_id) : null;
        const clientId = caseId
            ? caseToClient.get(caseId)
            : consultationId
                ? consultationToClient.get(consultationId)
                : Number(notes.clientId || payment.user_id || 0);
        const client = clientMeta.get(clientId) || {
            id: clientId || Number(payment.user_id || 0),
            full_name: payment.case?.client?.full_name || payment.consultation?.client?.full_name || payment.user?.full_name || 'Khách hàng',
            email: payment.case?.client?.email || payment.consultation?.client?.email || payment.user?.email || '',
            phone: payment.case?.client?.phone || payment.consultation?.client?.phone || payment.user?.phone || '',
            avatar: payment.case?.client?.avatar || payment.consultation?.client?.avatar || payment.user?.avatar || ''
        };

        const isVideoPackage = notes.feature === 'video_call_package';
        return {
            id: payment.id,
            amount: Number(payment.amount || 0),
            netAmount: Number(payment.amount || 0) * 0.85,
            status: payment.status,
            paymentType: payment.payment_type,
            paymentMethod: payment.payment_method,
            transactionId: payment.transaction_id,
            createdAt: payment.created_at,
            paidAt: payment.payment_date || payment.created_at,
            client,
            caseId: payment.case?.id || null,
            consultationId: payment.consultation?.id || null,
            title: payment.case?.title || (isVideoPackage ? 'Gói video 60 phút' : 'Thanh toán lịch tư vấn'),
            caseType: payment.case?.case_type || payment.consultation?.consultation_type || (isVideoPackage ? 'video_package' : 'consultation'),
            sourceType: payment.case ? 'case' : payment.consultation ? 'consultation' : 'video_package',
            scheduledAt: payment.consultation?.scheduled_at || null,
            durationMinutes: payment.consultation?.duration || (isVideoPackage ? 60 : null)
        };
    });

    return { count, rows };
};
// Lấy thống kê của lawyer
const getDashboardStats = async (req, res) => {
    try {
        const lawyerId = req.user.id;
        const now = new Date();
        const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
        const nextMonthStart = new Date(now.getFullYear(), now.getMonth() + 1, 1);
        const previousMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        const yearStart = new Date(now.getFullYear(), 0, 1);
        const nextYearStart = new Date(now.getFullYear() + 1, 0, 1);

        const totalCases = await Case.count({ where: { lawyer_id: lawyerId } });
        const activeCases = await Case.count({
            where: {
                lawyer_id: lawyerId,
                status: { [Op.in]: ['pending', 'in_progress'] }
            }
        });
        const pendingCases = await Case.count({
            where: {
                lawyer_id: lawyerId,
                status: 'pending'
            }
        });
        const completedCases = await Case.count({
            where: {
                lawyer_id: lawyerId,
                status: 'completed'
            }
        });
        const completedCasesThisMonth = await Case.count({
            where: {
                lawyer_id: lawyerId,
                status: 'completed',
                completed_at: {
                    [Op.gte]: monthStart,
                    [Op.lt]: nextMonthStart
                }
            }
        });
        const newCasesThisMonth = await Case.count({
            where: {
                lawyer_id: lawyerId,
                created_at: {
                    [Op.gte]: monthStart,
                    [Op.lt]: nextMonthStart
                }
            }
        });
        const pendingConsultations = await Consultation.count({
            where: {
                lawyer_id: lawyerId,
                status: 'pending'
            }
        });

        const overdueConsultations = await Consultation.count({
            where: {
                lawyer_id: lawyerId,
                status: 'confirmed',
                scheduled_at: { [Op.lt]: now }
            }
        });

        const consultationsThisMonth = await Consultation.findAll({
            where: {
                lawyer_id: lawyerId,
                status: { [Op.in]: ['confirmed', 'completed', 'in_progress'] },
                scheduled_at: {
                    [Op.gte]: monthStart,
                    [Op.lt]: nextMonthStart
                }
            },
            attributes: ['duration']
        });

        const { rows: completedOrders } = await getLawyerOrderRows(lawyerId, { status: 'completed' });
        const completedOrderIds = completedOrders.map((item) => item.id);
        const paymentWhere = {
            id: { [Op.in]: completedOrderIds.length ? completedOrderIds : [0] }
        };

        const totalGrossRevenue = await Payment.sum('amount', { where: paymentWhere }) || 0;
        const totalNetRevenue = totalGrossRevenue * 0.85;

        const monthlyGrossRevenue = await Payment.sum('amount', {
            where: {
                ...paymentWhere,
                created_at: {
                    [Op.gte]: monthStart,
                    [Op.lt]: nextMonthStart
                }
            }
        }) || 0;
        const monthlyNetRevenue = monthlyGrossRevenue * 0.85;

        const previousMonthGrossRevenue = await Payment.sum('amount', {
            where: {
                ...paymentWhere,
                created_at: {
                    [Op.gte]: previousMonthStart,
                    [Op.lt]: monthStart
                }
            }
        }) || 0;
        const previousMonthNetRevenue = previousMonthGrossRevenue * 0.85;

        const yearlyPayments = await Payment.findAll({
            where: {
                ...paymentWhere,
                created_at: {
                    [Op.gte]: yearStart,
                    [Op.lt]: nextYearStart
                }
            },
            attributes: ['amount', 'created_at']
        });

        const monthlyTrend = Array.from({ length: 12 }, (_, index) => ({
            month: index + 1,
            label: 'T' + (index + 1),
            amount: 0
        }));

        monthlyTrend.forEach((trend) => {
            trend.grossAmount = 0;
            trend.netAmount = 0;
        });

        yearlyPayments.forEach((payment) => {
            const monthIndex = new Date(payment.created_at).getMonth();
            const amount = Number(payment.amount || 0);
            monthlyTrend[monthIndex].grossAmount += amount;
            monthlyTrend[monthIndex].netAmount += amount * 0.85;
            // set amount for backward compatibility if UI depends on it
            monthlyTrend[monthIndex].amount = monthlyTrend[monthIndex].netAmount;
        });

        const recentPayments = completedOrders.slice(0, 5);

        const recentlyProcessedCases = await Case.findAll({
            where: {
                lawyer_id: lawyerId,
                status: 'completed'
            },
            include: [
                { model: User, as: 'client', attributes: ['id', 'full_name', 'email'] }
            ],
            order: [['completed_at', 'DESC']],
            limit: 5
        });

        const consultationHours = consultationsThisMonth.reduce((sum, item) => sum + Number(item.duration || 0), 0) / 60;
        const inProgressPercent = totalCases ? Math.round((activeCases / totalCases) * 100) : 0;
        const completedPercent = totalCases ? Math.round((completedCases / totalCases) * 100) : 0;
        const pendingPercent = Math.max(0, 100 - inProgressPercent - completedPercent);
        const revenueGrowthPercent = previousMonthNetRevenue
            ? Math.round(((monthlyNetRevenue - previousMonthNetRevenue) / previousMonthNetRevenue) * 1000) / 10
            : (monthlyNetRevenue > 0 ? 100 : 0);

        res.json({
            success: true,
            data: {
                cases: {
                    total: totalCases,
                    active: activeCases,
                    pending: pendingCases,
                    completed: completedCases,
                    newThisMonth: newCasesThisMonth,
                    completedThisMonth: completedCasesThisMonth,
                    statusBreakdown: {
                        inProgress: activeCases,
                        completed: completedCases,
                        pending: pendingCases,
                        inProgressPercent,
                        completedPercent,
                        pendingPercent
                    },
                    recentlyProcessed: recentlyProcessedCases
                },
                consultations: {
                    pending: pendingConsultations,
                    overdue: overdueConsultations,
                    countThisMonth: consultationsThisMonth.length,
                    hoursThisMonth: consultationHours
                },
                revenue: {
                    total: totalNetRevenue,
                    totalGross: totalGrossRevenue,
                    monthly: monthlyNetRevenue,
                    monthlyGross: monthlyGrossRevenue,
                    previousMonth: previousMonthNetRevenue,
                    growthPercent: revenueGrowthPercent,
                    monthlyTrend,
                    recentPayments
                }
            }
        });
    } catch (error) {
        console.error('Error getting lawyer stats:', error);
        res.status(500).json({
            success: false,
            message: 'Loi khi lay thong ke'
        });
    }
};

const getMyCases = async (req, res) => {
    try {
        const lawyerId = req.user.id;
        const { status, clientId, page = 1, limit = 10 } = req.query;
        const offset = (page - 1) * limit;

        const where = { lawyer_id: lawyerId };
        if (status) where.status = status;
        if (clientId) where.client_id = clientId;

        const { count, rows } = await Case.findAndCountAll({
            where,
            include: [
                { model: User, as: 'client', attributes: ['id', 'full_name', 'email', 'phone'] }
            ],
            limit: parseInt(limit),
            offset: parseInt(offset),
            order: [['created_at', 'DESC']]
        });

        res.json({
            success: true,
            data: {
                cases: rows,
                pagination: {
                    total: count,
                    page: parseInt(page),
                    limit: parseInt(limit),
                    totalPages: Math.ceil(count / limit)
                }
            }
        });
    } catch (error) {
        console.error('Error getting cases:', error);
        res.status(500).json({
            success: false,
            message: 'Lỗi khi lấy danh sách vụ việc'
        });
    }
};

// Tìm kiếm khách hàng (dành cho lawyer)
const searchClients = async (req, res) => {
    console.log('--- Search Clients API Hit ---', req.query);
    try {
        const { search } = req.query;
        const where = { role_id: 3 }; // Client role index is 3

        if (search) {
            where[Op.or] = [
                { full_name: { [Op.like]: `%${search}%` } },
                { email: { [Op.like]: `%${search}%` } },
                { phone: { [Op.like]: `%${search}%` } }
            ];
        }

        const clients = await User.findAll({
            where,
            attributes: ['id', 'full_name', 'email', 'phone', 'avatar'],
            limit: 20
        });

        res.json({
            success: true,
            data: clients
        });
    } catch (error) {
        console.error('Error searching clients:', error);
        res.status(500).json({ success: false, message: 'Lỗi khi tìm kiếm khách hàng' });
    }
};

// Tạo vụ việc mới (dành cho lawyer)
const createCase = async (req, res) => {
    try {
        const { clientId, title, description, caseType, priority, estimatedFee, notes, paymentMode } = req.body;
        const lawyerId = req.user.id;

        const fee = Number(estimatedFee);
        if (fee < 2000000) {
            return res.status(400).json({
                success: false,
                message: 'Phí dự kiến tối thiểu phải từ 2,000,000 VNĐ'
            });
        }

        const caseRecord = await Case.create({
            client_id: clientId,
            lawyer_id: lawyerId,
            title,
            description: description || '',
            case_type: caseType || 'tax',
            priority: priority || 'medium',
            estimated_fee: fee,
            status: 'pending',
            notes: notes || null,
            payment_mode: paymentMode || 'step_by_step'
        });

        // Khởi tạo các bước mặc định
        await initializeCaseSteps(caseRecord.id, caseType || 'tax');

        res.status(201).json({
            success: true,
            message: 'Tạo vụ việc thành công',
            data: caseRecord
        });
    } catch (error) {
        console.error('Error creating case by lawyer:', error);
        res.status(500).json({ success: false, message: 'Lỗi khi tạo vụ việc' });
    }
};

// Cập nhật trạng thái case
const updateCaseStatus = async (req, res) => {
    try {
        const { caseId } = req.params;
        const { status, notes, estimatedFee, paymentMode } = req.body;

        const caseRecord = await Case.findOne({
            where: { id: caseId, lawyer_id: req.user.id }
        });

        if (!caseRecord) {
            return res.status(404).json({
                success: false,
                message: 'Không tìm thấy vụ việc'
            });
        }

        const updateData = {};
        if (status) updateData.status = status;
        if (estimatedFee !== undefined) {
            const fee = Number(estimatedFee);
            if (isNaN(fee) || fee < 2000000) {
                return res.status(400).json({
                    success: false,
                    message: 'Phí dự kiến tối thiểu phải từ 2,000,000 VNĐ'
                });
            }
            updateData.estimated_fee = fee;
        }
        if (paymentMode) updateData.payment_mode = paymentMode;

        await caseRecord.update(updateData);

        const io = req.app.get('io');
        if (io) {
            io.to(String(caseRecord.client_id)).emit('case_updated', {
                caseId: caseRecord.id,
                status: caseRecord.status,
                updatedAt: caseRecord.updated_at
            });
            io.to(String(req.user.id)).emit('case_updated', {
                caseId: caseRecord.id,
                status: caseRecord.status,
                updatedAt: caseRecord.updated_at
            });
        }

        res.json({
            success: true,
            message: 'Cập nhật trạng thái thành công',
            data: { case: caseRecord }
        });
    } catch (error) {
        console.error('Error updating case:', error);
        res.status(500).json({
            success: false,
            message: 'Lỗi khi cập nhật vụ việc'
        });
    }
};

// Lấy lịch tư vấn của lawyer
const getMyConsultations = async (req, res) => {
    try {
        const lawyerId = req.user.id;
        const { status, page = 1, limit = 10 } = req.query;
        const offset = (page - 1) * limit;

        const where = { lawyer_id: lawyerId };
        if (status) where.status = status;

        const { count, rows } = await Consultation.findAndCountAll({
            where,
            include: [
                { model: User, as: 'client', attributes: ['id', 'full_name', 'email', 'phone'] },
                { model: Case, as: 'case', attributes: ['id', 'title'] }
            ],
            limit: parseInt(limit),
            offset: parseInt(offset),
            order: [['scheduled_at', 'ASC']]
        });

        res.json({
            success: true,
            data: {
                consultations: rows,
                pagination: {
                    total: count,
                    page: parseInt(page),
                    limit: parseInt(limit),
                    totalPages: Math.ceil(count / limit)
                }
            }
        });
    } catch (error) {
        console.error('Error getting consultations:', error);
        res.status(500).json({
            success: false,
            message: 'Lỗi khi lấy lịch tư vấn'
        });
    }
};

// Chấp nhận/từ chối consultation
const updateConsultationStatus = async (req, res) => {
    try {
        const { consultationId } = req.params;
        const { status, meetingLink } = req.body;

        const consultation = await Consultation.findOne({
            where: { id: consultationId, lawyer_id: req.user.id }
        });

        if (!consultation) {
            return res.status(404).json({
                success: false,
                message: 'Không tìm thấy lịch tư vấn'
            });
        }

        const updateData = { status };
        if (meetingLink) updateData.meeting_link = meetingLink;

        await consultation.update(updateData);

        const io = req.app.get('io');
        if (io) {
            const payload = {
                consultationId: consultation.id,
                status: consultation.status,
                scheduledAt: consultation.scheduled_at
            };
            io.to(String(consultation.client_id)).emit('consultation_updated', payload);
            io.to(String(req.user.id)).emit('consultation_updated', payload);
        }

        res.json({
            success: true,
            message: 'Cập nhật lịch tư vấn thành công',
            data: { consultation }
        });
    } catch (error) {
        console.error('Error updating consultation:', error);
        res.status(500).json({
            success: false,
            message: 'Lỗi khi cập nhật lịch tư vấn'
        });
    }
};
const getLawyers = async (req, res) => {
    try {
        const {
            page = 1, limit = 10,
            search, specialty, city, experience, education,
            minFee, maxFee, minRating,
            sort
        } = req.query;

        console.log('DEBUG ARGV:', { search, specialty, city, experience, education, minFee, maxFee, minRating, sort });

        const result = await lawyerService.getLawyers({
            page: Number(page),
            limit: Number(limit),
            search,
            specialty,
            city,
            experience,
            education,
            minFee: minFee ? Number(minFee) : undefined,
            maxFee: maxFee ? Number(maxFee) : undefined,
            minRating: minRating ? Number(minRating) : undefined,
            sort
        });

        res.json({
            success: true,
            data: result,
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: "Server error" });
    }
};

const getMyAvailability = async (req, res) => {
    try {
        const slots = await LawyerAvailability.findAll({
            where: { lawyer_id: req.user.id },
            order: [['start_time', 'ASC']]
        });
        res.json({ success: true, data: slots });
    } catch (error) {
        console.error('Error getting availability slots:', error);
        res.status(500).json({ success: false, message: 'Lỗi lấy lịch trống' });
    }
};

const isSameCalendarDay = (start, end) =>
    start.getFullYear() === end.getFullYear() &&
    start.getMonth() === end.getMonth() &&
    start.getDate() === end.getDate();

const buildHourBlocks = (start, end) => {
    const diffMinutes = Math.round((end.getTime() - start.getTime()) / 60000);

    if (diffMinutes < 60) {
        return {
            ok: false,
            message: 'Khung gi? t?i thi?u ph?i l? 60 ph?t'
        };
    }

    if (diffMinutes % 60 !== 0) {
        return {
            ok: false,
            message: 'Khung gi? ph?i chia h?t cho 60 ph?t ?? h? th?ng t?ch th?nh t?ng slot ??t l?ch'
        };
    }

    const blocks = [];
    let cursor = new Date(start);

    while (cursor < end) {
        const next = new Date(cursor.getTime() + 60 * 60000);
        blocks.push({ start: new Date(cursor), end: next });
        cursor = next;
    }

    return { ok: true, blocks };
};

const createAvailability = async (req, res) => {
    try {
        const { startTime, endTime, consultationType, notes } = req.body;
        const start = new Date(startTime);
        const end = new Date(endTime);

        if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end <= start) {
            return res.status(400).json({ success: false, message: 'Kho?ng th?i gian kh?ng h?p l?' });
        }

        if (start <= new Date()) {
            return res.status(400).json({
                success: false,
                message: 'Chỉ được tạo lịch trống ở tương lai. Nếu tạo trong hôm nay, giờ bắt đầu phải lớn hơn giờ hiện tại.'
            });
        }

        if (!isSameCalendarDay(start, end)) {
            return res.status(400).json({
                success: false,
                message: 'Ch? ???c t?o l?ch tr?ng trong c?ng m?t ng?y. N?u mu?n nhi?u ng?y, h?y t?o t?ng ng?y ri?ng.'
            });
        }

        const blockResult = buildHourBlocks(start, end);
        if (!blockResult.ok) {
            return res.status(400).json({ success: false, message: blockResult.message });
        }

        const conflict = await LawyerAvailability.findOne({
            where: {
                lawyer_id: req.user.id,
                status: 'available',
                [Op.or]: [
                    { start_time: { [Op.between]: [start, end] } },
                    { end_time: { [Op.between]: [start, end] } },
                    {
                        [Op.and]: [
                            { start_time: { [Op.lte]: start } },
                            { end_time: { [Op.gte]: end } }
                        ]
                    }
                ]
            }
        });

        if (conflict) {
            return res.status(409).json({ success: false, message: 'Khung giờ bị trùng lịch đã tạo' });
        }

        const createdSlots = await sequelize.transaction(async (transaction) => {
            return LawyerAvailability.bulkCreate(
                blockResult.blocks.map((block) => ({
                    lawyer_id: req.user.id,
                    start_time: block.start,
                    end_time: block.end,
                    consultation_type: consultationType || 'video',
                    notes: notes || null,
                    status: 'available'
                })),
                { transaction }
            );
        });

        const io = req.app.get('io');
        if (io) {
            io.to(String(req.user.id)).emit('availability_updated', { lawyerId: req.user.id });
        }

        res.status(201).json({
            success: true,
            message: '?? t?o ' + createdSlots.length + ' slot l?ch tr?ng, m?i slot 60 ph?t',
            data: createdSlots
        });
    } catch (error) {
        console.error('Error creating availability slot:', error);
        res.status(500).json({ success: false, message: 'L?i t?o l?ch tr?ng' });
    }
};

const updateAvailability = async (req, res) => {
    try {
        const { slotId } = req.params;
        const { startTime, endTime, consultationType, notes } = req.body;

        const slot = await LawyerAvailability.findOne({
            where: { id: slotId, lawyer_id: req.user.id }
        });

        if (!slot) {
            return res.status(404).json({ success: false, message: 'Kh?ng t?m th?y l?ch tr?ng' });
        }

        if (slot.status === 'booked') {
            return res.status(400).json({ success: false, message: 'Không thể sửa lịch đã được đặt' });
        }

        const start = new Date(startTime);
        const end = new Date(endTime);

        if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end <= start) {
            return res.status(400).json({ success: false, message: 'Kho?ng th?i gian kh?ng h?p l?' });
        }

        if (start <= new Date()) {
            return res.status(400).json({
                success: false,
                message: 'Không thể cập nhật slot về thời điểm đã qua.'
            });
        }

        if (!isSameCalendarDay(start, end)) {
            return res.status(400).json({
                success: false,
                message: 'Ch? ???c c?p nh?t slot trong c?ng m?t ng?y.'
            });
        }

        const diffMinutes = Math.round((end.getTime() - start.getTime()) / 60000);
        if (diffMinutes !== 60) {
            return res.status(400).json({
                success: false,
                message: 'Một slot chỉ được phép có thời lượng đúng 60 phút.'
            });
        }

        const conflict = await LawyerAvailability.findOne({
            where: {
                lawyer_id: req.user.id,
                status: 'available',
                id: { [Op.ne]: slot.id },
                [Op.or]: [
                    { start_time: { [Op.between]: [start, end] } },
                    { end_time: { [Op.between]: [start, end] } },
                    {
                        [Op.and]: [
                            { start_time: { [Op.lte]: start } },
                            { end_time: { [Op.gte]: end } }
                        ]
                    }
                ]
            }
        });

        if (conflict) {
            return res.status(409).json({ success: false, message: 'Khung giờ bị trùng lịch đã tạo' });
        }

        await slot.update({
            start_time: start,
            end_time: end,
            consultation_type: consultationType || slot.consultation_type || 'video',
            notes: notes ?? slot.notes
        });

        const io = req.app.get('io');
        if (io) {
            io.to(String(req.user.id)).emit('availability_updated', { lawyerId: req.user.id });
        }

        return res.json({ success: true, message: 'Cập nhật lịch trống thành công', data: slot });
    } catch (error) {
        console.error('Error updating availability slot:', error);
        return res.status(500).json({ success: false, message: 'Lỗi cập nhật lịch trống' });
    }
};

const deleteAvailability = async (req, res) => {
    try {
        const { slotId } = req.params;
        const slot = await LawyerAvailability.findOne({
            where: { id: slotId, lawyer_id: req.user.id }
        });
        if (!slot) {
            return res.status(404).json({ success: false, message: 'Không tìm thấy lịch trống' });
        }
        if (slot.status === 'booked') {
            return res.status(400).json({ success: false, message: 'Không thể xóa lịch đã được đặt' });
        }

        await slot.update({ status: 'cancelled' });

        const io = req.app.get('io');
        if (io) {
            io.to(String(req.user.id)).emit('availability_updated', { lawyerId: req.user.id });
        }

        res.json({ success: true, message: 'Đã hủy lịch trống', data: slot });
    } catch (error) {
        console.error('Error deleting availability slot:', error);
        res.status(500).json({ success: false, message: 'Lỗi hủy lịch trống' });
    }
};

const getMyClients = async (req, res) => {
    try {
        const lawyerId = req.user.id;
        const query = String(req.query.q || '').trim().toLowerCase();
        const showArchived = req.query.showArchived === 'true';
        const limit = Math.max(1, Math.min(Number(req.query.limit) || 50, 100));

        // 1. Lấy clients thông qua cases
        const caseRecords = await Case.findAll({
            where: { lawyer_id: lawyerId },
            include: [
                {
                    model: User,
                    as: 'client',
                    attributes: ['id', 'full_name', 'email', 'phone', 'avatar']
                }
            ],
            order: [['updated_at', 'DESC']]
        });

        // 2. Lấy clients do chính lawyer này tạo ra (có thể chưa có case)
        const createdClients = await User.findAll({
            where: {
                created_by_id: lawyerId,
                role_id: 3,
                is_active: showArchived ? false : true
            },
            attributes: ['id', 'full_name', 'email', 'phone', 'avatar', 'is_active', 'created_at', 'updated_at']
        });

        // Gộp danh sách clients độc bản
        const clientsById = new Map();

        // 1. Lấy clients qua cases (với danh sách cases để đếm)
        caseRecords.forEach(c => {
            if (!c.client) return;
            const cid = Number(c.client.id);
            if (!clientsById.has(cid)) {
                clientsById.set(cid, {
                    ...c.client.toJSON(),
                    cases: [],
                    lastActivityAt: c.updated_at || c.created_at,
                    lastCaseTitle: c.title
                });
            }
            clientsById.get(cid).cases.push(c);
            const currentAct = new Date(c.updated_at || c.created_at);
            if (currentAct > new Date(clientsById.get(cid).lastActivityAt)) {
                clientsById.get(cid).lastActivityAt = currentAct;
                clientsById.get(cid).lastCaseTitle = c.title;
            }
        });

        // 2. Lấy clients do chính lawyer này tạo ra (có thể chưa có case)
        createdClients.forEach(u => {
            const cid = Number(u.id);
            if (!clientsById.has(cid)) {
                clientsById.set(cid, {
                    ...u.toJSON(),
                    cases: [],
                    lastActivityAt: u.updated_at || u.created_at,
                    lastCaseTitle: ''
                });
            }
        });

        const caseIds = caseRecords.map(c => c.id);
        const documentCounts = await Document.findAll({
            attributes: ['case_id', [sequelize.fn('COUNT', sequelize.col('id')), 'document_count']],
            where: { case_id: { [Op.in]: caseIds.length ? caseIds : [0] } },
            group: ['case_id'],
            raw: true
        });

        const docCountByCaseId = new Map(documentCounts.map(r => [Number(r.case_id), Number(r.document_count || 0)]));

        const allClients = Array.from(clientsById.values())
            .filter(c => {
                if (!query) return true;
                return (c.full_name || '').toLowerCase().includes(query) ||
                    (c.email || '').toLowerCase().includes(query) ||
                    (c.phone || '').includes(query);
            })
            .map(c => {
                const summary = {
                    id: c.id,
                    full_name: c.full_name,
                    email: c.email,
                    phone: c.phone,
                    avatar: c.avatar,
                    caseCount: c.cases.length,
                    activeCases: c.cases.filter(cs => ['pending', 'in_progress', 'reviewing'].includes(cs.status)).length,
                    completedCases: c.cases.filter(cs => cs.status === 'completed').length,
                    documentsCount: c.cases.reduce((sum, cs) => sum + (docCountByCaseId.get(Number(cs.id)) || 0), 0),
                    lastActivityAt: c.lastActivityAt,
                    lastCaseTitle: c.lastCaseTitle,
                    profileStatus: 'archived',
                    is_active: c.is_active
                };

                if (summary.activeCases > 0) {
                    summary.profileStatus = 'processing';
                } else if (summary.documentsCount === 0 && summary.completedCases === 0) {
                    summary.profileStatus = 'new';
                }
                return summary;
            })
            .sort((a, b) => new Date(b.lastActivityAt) - new Date(a.lastActivityAt));

        const page = parseInt(req.query.page) || 1;
        const limitNum = parseInt(req.query.limit) || 12;
        const offset = (page - 1) * limitNum;
        const paginatedClients = allClients.slice(offset, offset + limitNum);

        res.json({
            success: true,
            data: {
                clients: paginatedClients,
                pagination: {
                    total: allClients.length,
                    page,
                    limit: limitNum,
                    totalPages: Math.ceil(allClients.length / limitNum)
                }
            }
        });
    } catch (error) {
        console.error('Error in getMyClients:', error);
        res.status(500).json({ success: false, message: 'Lỗi khi lấy danh sách hồ sơ khách hàng' });
    }
};

const getRevenueByClient = async (req, res) => {
    try {
        const lawyerId = req.user.id;
        const clientIdFilter = req.query.clientId ? Number(req.query.clientId) : null;
        const now = new Date();
        const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
        const nextMonthStart = new Date(now.getFullYear(), now.getMonth() + 1, 1);

        const caseWhere = { lawyer_id: lawyerId };
        const consultationWhere = { lawyer_id: lawyerId };

        if (clientIdFilter) {
            caseWhere.client_id = clientIdFilter;
            consultationWhere.client_id = clientIdFilter;
        }

        const [caseRecords, consultationRecords] = await Promise.all([
            Case.findAll({
                where: caseWhere,
                attributes: ['id', 'client_id', 'title', 'created_at'],
                include: [{ model: User, as: 'client', attributes: ['id', 'full_name', 'email', 'phone', 'avatar'] }]
            }),
            Consultation.findAll({
                where: consultationWhere,
                attributes: ['id', 'client_id', 'consultation_type', 'scheduled_at', 'created_at'],
                include: [{ model: User, as: 'client', attributes: ['id', 'full_name', 'email', 'phone', 'avatar'] }]
            })
        ]);

        const caseIds = caseRecords.map((item) => item.id);
        const consultationIds = consultationRecords.map((item) => item.id);

        if (!caseIds.length && !consultationIds.length) {
            return res.json({
                success: true,
                data: clientIdFilter ? {
                    summary: null,
                    recentPayments: []
                } : {
                    summaries: [],
                    recentPayments: []
                }
            });
        }

        const caseToClient = new Map(caseRecords.map((item) => [Number(item.id), Number(item.client_id)]));
        const consultationToClient = new Map(consultationRecords.map((item) => [Number(item.id), Number(item.client_id)]));
        const clientMeta = new Map();

        caseRecords.forEach((item) => {
            if (item.client) {
                clientMeta.set(Number(item.client.id), {
                    id: Number(item.client.id),
                    full_name: item.client.full_name || 'Khach hang',
                    email: item.client.email || '',
                    phone: item.client.phone || '',
                    avatar: item.client.avatar || ''
                });
            }
        });

        consultationRecords.forEach((item) => {
            if (item.client && !clientMeta.has(Number(item.client.id))) {
                clientMeta.set(Number(item.client.id), {
                    id: Number(item.client.id),
                    full_name: item.client.full_name || 'Khach hang',
                    email: item.client.email || '',
                    phone: item.client.phone || '',
                    avatar: item.client.avatar || ''
                });
            }
        });

        const payments = await Payment.findAll({
            where: {
                status: 'completed',
                [Op.or]: [
                    { case_id: { [Op.in]: caseIds.length ? caseIds : [0] } },
                    { consultation_id: { [Op.in]: consultationIds.length ? consultationIds : [0] } }
                ]
            },
            include: [
                { model: Case, as: 'case', attributes: ['id', 'title', 'case_type'] },
                { model: Consultation, as: 'consultation', attributes: ['id', 'consultation_type'] },
                { model: User, as: 'user', attributes: ['id', 'full_name', 'email'] }
            ],
            order: [['created_at', 'DESC']]
        });

        const summariesByClient = new Map();

        payments.forEach((payment) => {
            const paymentCaseId = payment.case_id ? Number(payment.case_id) : null;
            const paymentConsultationId = payment.consultation_id ? Number(payment.consultation_id) : null;
            const clientId = paymentCaseId
                ? caseToClient.get(paymentCaseId)
                : consultationToClient.get(paymentConsultationId);

            if (!clientId) return;

            if (!summariesByClient.has(clientId)) {
                const client = clientMeta.get(clientId) || {
                    id: clientId,
                    full_name: payment.user?.full_name || 'Khach hang',
                    email: payment.user?.email || '',
                    phone: '',
                    avatar: ''
                };

                summariesByClient.set(clientId, {
                    client,
                    totalRevenue: 0,
                    monthlyRevenue: 0,
                    totalTransactions: 0,
                    latestPaymentAt: payment.created_at
                });
            }

            const summary = summariesByClient.get(clientId);
            const amount = Number(payment.amount || 0);
            summary.totalRevenue += amount;
            summary.totalTransactions += 1;

            const paidAt = new Date(payment.created_at);
            if (paidAt >= monthStart && paidAt < nextMonthStart) {
                summary.monthlyRevenue += amount;
            }

            if (new Date(summary.latestPaymentAt) < paidAt) {
                summary.latestPaymentAt = paidAt;
            }
        });

        const recentPayments = payments.slice(0, 10).map((payment) => {
            const paymentCaseId = payment.case_id ? Number(payment.case_id) : null;
            const paymentConsultationId = payment.consultation_id ? Number(payment.consultation_id) : null;
            const clientId = paymentCaseId
                ? caseToClient.get(paymentCaseId)
                : consultationToClient.get(paymentConsultationId);
            const client = clientMeta.get(clientId) || null;

            return {
                id: payment.id,
                amount: Number(payment.amount || 0),
                status: payment.status,
                paymentType: payment.payment_type,
                paymentMethod: payment.payment_method,
                paidAt: payment.created_at,
                transactionId: payment.transaction_id,
                clientId,
                clientName: client?.full_name || payment.user?.full_name || 'Khach hang',
                caseTitle: payment.case?.title || 'Thanh toan lich tu van',
                caseType: payment.case?.case_type || payment.consultation?.consultation_type || 'consultation'
            };
        });

        const summaries = Array.from(summariesByClient.values())
            .sort((a, b) => b.totalRevenue - a.totalRevenue)
            .map((item) => ({
                ...item,
                totalRevenue: Number(item.totalRevenue || 0),
                monthlyRevenue: Number(item.monthlyRevenue || 0)
            }));

        if (clientIdFilter) {
            const summary = summaries.find((item) => item.client.id === clientIdFilter) || null;
            return res.json({
                success: true,
                data: {
                    summary,
                    recentPayments: recentPayments.filter((item) => item.clientId === clientIdFilter)
                }
            });
        }

        res.json({
            success: true,
            data: {
                summaries,
                recentPayments
            }
        });
    } catch (error) {
        console.error('Error getting lawyer revenue by client:', error);
        res.status(500).json({
            success: false,
            message: 'Loi khi lay doanh so theo khach hang'
        });
    }
};

const getMyOrders = async (req, res) => {
    try {
        const lawyerId = req.user.id;
        const { status, page = 1, limit = 10 } = req.query;
        const offset = (page - 1) * limit;
        const { count, rows: orders } = await getLawyerOrderRows(lawyerId, {
            status,
            limit: Number(limit),
            offset: Number(offset)
        });

        res.json({
            success: true,
            data: {
                orders,
                pagination: {
                    total: count,
                    page: parseInt(page),
                    limit: parseInt(limit),
                    totalPages: Math.ceil(count / limit)
                }
            }
        });
    } catch (error) {
        console.error('Error getting lawyer orders:', error);
        res.status(500).json({
            success: false,
            message: 'Loi khi lay danh sach giao dich'
        });
    }
};

const restoreAvailabilitySlot = async (req, res) => {
    try {
        const { slotId } = req.params;
        const slot = await LawyerAvailability.findOne({
            where: { id: slotId, lawyer_id: req.user.id, status: 'missed' }
        });

        if (!slot) {
            return res.status(404).json({ success: false, message: 'Không tìm thấy lịch bị lỡ hoặc trạng thái không hợp lệ' });
        }

        await slot.update({ status: 'available' });

        const io = req.app.get('io');
        if (io) {
            io.to(String(req.user.id)).emit('availability_updated', { lawyerId: req.user.id });
        }

        res.json({ success: true, message: 'Đã mở lại lịch trống thành công', data: slot });
    } catch (error) {
        console.error('Error restoring availability slot:', error);
        res.status(500).json({ success: false, message: 'Lỗi khi mở lại lịch trống' });
    }
};

const createClient = async (req, res) => {
    try {
        const lawyerId = req.user.id;
        const { fullName, email, phone } = req.body;

        if (!fullName || !email) {
            return res.status(400).json({
                success: false,
                message: 'Vui lòng cung cấp đầy đủ họ tên và email'
            });
        }

        // Kiểm tra email đã tồn tại chưa
        const existingUser = await User.findOne({ where: { email } });

        if (existingUser) {
            // Nếu user đã tồn tại, kiểm tra role
            if (existingUser.role_id === 1 || existingUser.role_id === 2) {
                return res.status(400).json({
                    success: false,
                    message: 'Email này thuộc về một tài khoản Quản trị viên hoặc Luật sư'
                });
            }

            // Nếu là client, kiểm tra xem đã có người tạo chưa
            // Nếu chưa có, gán cho luật sư này
            if (!existingUser.created_by_id) {
                await existingUser.update({ created_by_id: lawyerId });
            }

            return res.status(200).json({
                success: true,
                message: 'Đã kết nối với hồ sơ khách hàng hiện có',
                data: {
                    id: existingUser.id,
                    full_name: existingUser.full_name,
                    email: existingUser.email,
                    phone: existingUser.phone
                }
            });
        }

        // Tạo user mới với role client (3)
        const newUser = await User.create({
            email,
            password: 'Client@123',
            full_name: fullName,
            phone: phone || null,
            role_id: 3,
            is_active: true,
            email_verified: true,
            created_by_id: lawyerId
        });

        res.status(201).json({
            success: true,
            message: 'Tạo hồ sơ khách hàng mới thành công',
            data: {
                id: newUser.id,
                full_name: newUser.full_name,
                email: newUser.email,
                phone: newUser.phone
            }
        });
    } catch (error) {
        console.error('Error creating client by lawyer:', error);
        res.status(500).json({ success: false, message: 'Lỗi khi tạo hồ sơ khách hàng' });
    }
};

const archiveClient = async (req, res) => {
    try {
        const { id } = req.params;
        const lawyerId = req.user.id;

        // Verify client permission (created by lawyer OR has case with lawyer)
        const isOwner = await User.findOne({ where: { id, created_by_id: lawyerId } });
        const hasCase = await Case.findOne({ where: { client_id: id, lawyer_id: lawyerId } });

        if (!isOwner && !hasCase) {
            return res.status(403).json({ success: false, message: 'Bạn không có quyền lưu trữ hồ sơ này' });
        }

        const client = await User.findByPk(id);
        if (!client) {
            return res.status(404).json({ success: false, message: 'Không tìm thấy hồ sơ' });
        }

        // Kiểm tra xem khách hàng có vụ việc đang xử lý không
        const activeCase = await Case.findOne({
            where: {
                client_id: id,
                lawyer_id: lawyerId,
                status: ['pending', 'in_progress', 'reviewing']
            }
        });

        if (activeCase) {
            return res.status(400).json({
                success: false,
                message: 'Không thể lưu trữ hồ sơ vì khách hàng đang có vụ việc đang xử lý'
            });
        }

        await client.update({ is_active: false });

        res.json({ success: true, message: 'Đã lưu trữ hồ sơ khách hàng' });
    } catch (error) {
        console.error('Error archiving client:', error);
        res.status(500).json({ success: false, message: 'Lỗi khi lưu trữ hồ sơ' });
    }
};

const restoreClient = async (req, res) => {
    try {
        const { id } = req.params;
        const lawyerId = req.user.id;

        // Verify permission (same logic)
        const isOwner = await User.findOne({ where: { id, created_by_id: lawyerId } });
        const hasCase = await Case.findOne({ where: { client_id: id, lawyer_id: lawyerId } });

        if (!isOwner && !hasCase) {
            return res.status(403).json({ success: false, message: 'Bạn không có quyền khôi phục hồ sơ này' });
        }

        const client = await User.findByPk(id);
        if (!client) {
            return res.status(404).json({ success: false, message: 'Không tìm thấy hồ sơ' });
        }

        await client.update({ is_active: true });

        res.json({ success: true, message: 'Đã khôi phục hồ sơ khách hàng' });
    } catch (error) {
        console.error('Error restoring client:', error);
        res.status(500).json({ success: false, message: 'Lỗi khi khôi phục hồ sơ' });
    }
};

module.exports = {
    getDashboardStats,
    getMyCases,
    searchClients,
    createCase,
    updateCaseStatus,
    getMyConsultations,
    updateConsultationStatus,
    getMyAvailability,
    createAvailability,
    updateAvailability,
    deleteAvailability,
    getMyClients,
    getRevenueByClient,
    getMyOrders,
    createClient,
    restoreAvailabilitySlot,
    getLawyers,
    getLawyerById: async (req, res) => {
        try {
            const { id } = req.params;
            const lawyer = await lawyerService.getLawyerById(id);
            if (!lawyer) {
                return res.status(404).json({ success: false, message: 'Lawyer not found' });
            }
            res.json({ success: true, data: { lawyer } });
        } catch (error) {
            console.error('Error getting lawyer details:', error);
            res.status(500).json({ success: false, message: 'Server error' });
        }
    },
    getMyProfile: async (req, res) => {
        try {
            const userId = req.user.id;
            const user = await User.findByPk(userId, {
                attributes: ['id', 'email', 'full_name', 'phone', 'avatar']
            });
            const lawyer = await Lawyer.findOne({
                where: { user_id: userId }
            });

            if (!user || !lawyer) {
                return res.status(404).json({ success: false, message: 'Không tìm thấy hồ sơ' });
            }

            res.json({
                success: true,
                data: { user, lawyer }
            });
        } catch (error) {
            console.error('Error getting my profile:', error);
            res.status(500).json({ success: false, message: 'Lỗi lấy thông tin hồ sơ' });
        }
    },
    updateMyProfile: async (req, res) => {
        try {
            const userId = req.user.id;
            const {
                fullName, phone,
                barNumber, certificateNumber, lawFirm,
                specialties, yearsOfExperience, bio,
                education, consultationFee, city,
                bankName, bankAccountNumber, bankAccountName
            } = req.body;

            const user = await User.findByPk(userId);
            const lawyer = await Lawyer.findOne({ where: { user_id: userId } });

            if (!user || !lawyer) {
                return res.status(404).json({ success: false, message: 'Không tìm thấy hồ sơ' });
            }

            // Update User
            const userUpdate = {};
            if (fullName) userUpdate.full_name = fullName;
            if (phone) userUpdate.phone = phone;
            if (req.file) {
                userUpdate.avatar = `uploads/avatars/${req.file.filename}`;
            }
            await user.update(userUpdate);

            // Update Lawyer
            const lawyerUpdate = {};
            if (barNumber) lawyerUpdate.bar_number = barNumber;
            if (certificateNumber) lawyerUpdate.certificate_number = certificateNumber;
            if (lawFirm) lawyerUpdate.law_firm = lawFirm;
            if (specialties) lawyerUpdate.specialties = typeof specialties === 'string' ? specialties : JSON.stringify(specialties);
            if (yearsOfExperience) lawyerUpdate.years_of_experience = yearsOfExperience;
            if (bio) lawyerUpdate.bio = bio;
            if (education) lawyerUpdate.education = education;
            if (consultationFee) lawyerUpdate.consultation_fee = consultationFee;
            if (city) lawyerUpdate.city = city;
            if (bankName) lawyerUpdate.bank_name = bankName;
            if (bankAccountNumber) lawyerUpdate.bank_account_number = bankAccountNumber;
            if (bankAccountName) lawyerUpdate.bank_account_name = bankAccountName;

            await lawyer.update(lawyerUpdate);

            res.json({
                success: true,
                message: 'Cập nhật hồ sơ thành công',
                data: { user, lawyer }
            });
        } catch (error) {
            console.error('Error updating profile:', error);
            res.status(500).json({ success: false, message: 'Lỗi cập nhật hồ sơ' });
        }
    },
    getMyReviews: async (req, res) => {
        try {
            const userId = req.user.id;
            const reviews = await require('../models').LawyerReview.findAll({
                where: { lawyer_id: userId, is_hidden: false },
                include: [
                    {
                        model: User,
                        as: 'clientUser',
                        attributes: ['id', 'full_name', 'avatar']
                    }
                ],
                order: [['created_at', 'DESC']]
            });

            // Calculate breakdown
            const total = reviews.length;
            const avg = total > 0 ? (reviews.reduce((sum, r) => sum + Number(r.rating), 0) / total).toFixed(1) : 0;

            const breakdown = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 };
            reviews.forEach(r => {
                const rating = Math.round(Number(r.rating));
                if (breakdown[rating] !== undefined) breakdown[rating]++;
            });

            res.json({
                success: true,
                data: {
                    reviews,
                    summary: {
                        averageRating: Number(avg),
                        totalReviews: total,
                        breakdown
                    }
                }
            });
        } catch (error) {
            console.error('Error fetching lawyer reviews:', error);
            res.status(500).json({ success: false, message: 'Lỗi khi lấy danh sách đánh giá' });
        }
    },
    archiveClient,
    restoreClient
};
